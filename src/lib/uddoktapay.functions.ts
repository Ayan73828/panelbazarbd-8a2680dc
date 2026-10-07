import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const uddoktapayCreateCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        amount: z.number().min(10).max(100000),
        origin: z.string().url().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { paymentBaseUrl } = await import("./uddoktapay.server");
    const apiKey = process.env["UDDOKTAPAY_API_KEY"];
    if (!apiKey) throw new Error("UddoktaPay is not configured yet");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name, email, username")
      .eq("id", context.userId)
      .single();

    // Create our own record first; its id travels in metadata so the
    // redirect/webhook invoice id can be matched back to it.
    const ref = crypto.randomUUID();
    const { error: insErr } = await supabaseAdmin.from("uddoktapay_payments").insert({
      id: ref,
      user_id: context.userId,
      invoice_id: `pending-${ref}`,
      amount: data.amount,
      status: "pending",
    });
    if (insErr) throw new Error(insErr.message);

    const res = await fetch(`${paymentBaseUrl()}/checkout-v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "RT-UDDOKTAPAY-API-KEY": apiKey,
      },
      body: JSON.stringify({
        full_name: profile?.name || profile?.username || "Customer",
        email: profile?.email || "customer@example.com",
        amount: String(data.amount),
        metadata: { user_id: context.userId, ref },
        redirect_url: `${data.origin}/payment/success`,
        return_type: "GET",
        cancel_url: `${data.origin}/payment/cancel`,
        webhook_url: `${data.origin}/api/public/uddoktapay/webhook`,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.payment_url) {
      console.error("uddoktapay checkout failed", res.status, body);
      await supabaseAdmin.from("uddoktapay_payments").update({ status: "failed", raw: body }).eq("id", ref);
      throw new Error(body?.message || "Could not start payment. Please try again.");
    }
    await supabaseAdmin.from("uddoktapay_payments").update({ raw: body }).eq("id", ref);
    return { payment_url: body.payment_url as string };
  });

export const uddoktapayVerify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ invoice_id: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { verifyAndCredit } = await import("./uddoktapay.server");
    return verifyAndCredit(data.invoice_id, context.userId);
  });
