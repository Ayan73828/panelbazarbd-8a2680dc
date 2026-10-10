import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const telegramNotifyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      event: z.enum(["signup", "order", "support"]),
      recordId: z.string().uuid().optional(),
      productName: z.string().max(200).optional(),
      quantity: z.number().int().min(1).max(100).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { notifyOwner } = await import("@/lib/uddoktapay.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name, username, email, phone")
      .eq("id", context.userId)
      .maybeSingle();
    const who = profile?.username || profile?.name || profile?.email || String(context.claims.email ?? context.userId);
    const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (data.event === "signup") {
      await notifyOwner(`🆕 <b>New Signup</b>\nName: ${esc(profile?.name || context.claims.user_metadata?.name || "New user")}\nUsername: ${esc(profile?.username || "-")}\nEmail: ${esc(profile?.email || context.claims.email || "-")}\nPhone: ${esc(profile?.phone || context.claims.user_metadata?.phone || "-")}`);
      return { ok: true };
    }
    if (data.event === "order") {
      if (!data.recordId) throw new Error("Order reference is required");
      const { data: order } = await supabaseAdmin.from("orders").select("id, product_name, total, quantity, status").eq("id", data.recordId).eq("user_id", context.userId).maybeSingle();
      if (!order) throw new Error("Order not found");
      await notifyOwner(`🛒 <b>New Order</b>\nUser: ${esc(who)}\nProduct: ${esc(order.product_name || data.productName || "Product")}\nQuantity: ${order.quantity ?? data.quantity ?? 1}\nAmount: ৳${Number(order.total ?? 0).toLocaleString("en-US")}\nOrder: #${esc(String(order.id).slice(0, 8))}\nStatus: ${esc(order.status)}`);
      return { ok: true };
    }
    if (!data.recordId) throw new Error("Support ticket reference is required");
    const { data: ticket } = await supabaseAdmin.from("support_tickets").select("id, subject, message").eq("id", data.recordId).eq("user_id", context.userId).maybeSingle();
    if (!ticket) throw new Error("Support ticket not found");
    await notifyOwner(
      `📩 <b>New Support Ticket</b>\\nSource: Website\\nUser: ${esc(who)}\\nSubject: ${esc(ticket.subject)}\\nMessage: ${esc(String(ticket.message).slice(0, 1200))}\\nTicket: <code>${esc(ticket.id)}</code>`,
      { inline_keyboard: [[{ text: "↩️ Reply", callback_data: "supportreply:" + ticket.id }, { text: "✅ Close", callback_data: "supportclose:" + ticket.id }]] },
    );
    return { ok: true };
  });
