import { createFileRoute } from "@tanstack/react-router";

// Telegram payments return here instead of the website's authenticated success page.
// The gateway invoice is verified server-side before any balance is credited.
export const Route = createFileRoute("/api/public/uddoktapay/telegram-return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const invoiceId = new URL(request.url).searchParams.get("invoice_id")?.trim();
        const html = (title: string, message: string, ok: boolean) => new Response(
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — PANEL BAZAR BD</title><body style="font-family:system-ui,sans-serif;background:#f5f7fb;padding:24px;color:#182230"><main style="max-width:520px;margin:10vh auto;background:white;padding:28px;border-radius:16px"><h2>${title}</h2><p>${message}</p><p>Return to Telegram and open Panel Bazar BD bot to check your balance.</p><a href="https://t.me/panelbazarbd_bot">Open Telegram Bot</a></main></body></html>`,
          { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
        );
        if (!invoiceId || invoiceId.length > 100) return html("Payment reference missing", "We could not find the payment reference. Please contact support if money was deducted.", false);
        try {
          const { verifyAndCredit } = await import("@/lib/uddoktapay.server");
          const result = await verifyAndCredit(invoiceId);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: payment } = await supabaseAdmin.from("uddoktapay_payments").select("user_id,amount,status").eq("invoice_id", invoiceId).maybeSingle();
          if (payment?.user_id) {
            const { data: account } = await supabaseAdmin.from("telegram_accounts").select("telegram_chat_id").eq("user_id", payment.user_id).maybeSingle();
            const { privateSetting } = await import("@/lib/uddoktapay.server");
            const token = (await privateSetting("telegram_bot_token")) || process.env["TELEGRAM_BOT_TOKEN"];
            if (account?.telegram_chat_id && token && result.status === "completed") {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: account.telegram_chat_id,
                  text: `✅ Payment verified!\n\n💰 Amount added: ৳${Number(payment.amount).toLocaleString("en-US")}\nStatus: Completed\n\nTelegram bot-এ ফিরে Profile/Wallet খুলে balance দেখুন।`,
                }),
              }).catch((error) => console.error("Telegram payment return notification failed", error));
            }
          }
          if (result.status === "completed") return html("Payment successful", `৳${Number(result.amount).toLocaleString("en-US")} payment verified. Your Telegram balance has been credited.`, true);
          if (result.status === "pending") return html("Payment processing", "The gateway has not confirmed this payment yet. The webhook will update the balance when confirmation arrives.", true);
          return html("Payment not completed", result.message || "The payment could not be verified. If money was deducted, contact support.", false);
        } catch (error) {
          console.error("Telegram payment return verification failed", error);
          return html("Verification pending", "We could not finish verification right now. Please return to Telegram and check again shortly; do not pay again unless the previous transaction is confirmed failed.", false);
        }
      },
    },
  },
});
