import { createFileRoute } from "@tanstack/react-router";

async function sendEmail(apiKey: string | undefined, to: string | undefined, subject: string, text: string) {
  if (!apiKey || !to) return { sent: false };
  const from = process.env["SUPPORT_EMAIL_FROM"] || "Panel Bazar BD Support <support@panelbazarbd.shop>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!response.ok) console.error("Support ticket email failed", response.status, (await response.text()).slice(0, 250));
  return { sent: response.ok };
}

export const Route = createFileRoute("/api/public/support/create-ticket")({
  server: { handlers: { POST: async ({ request }) => {
    const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const anon = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
    const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const auth = request.headers.get("authorization");
    if (!url || !anon || !service) return Response.json({ error: "Support backend is not configured." }, { status: 503 });
    if (!auth?.startsWith("Bearer ")) return Response.json({ error: "Please log in first." }, { status: 401 });
    try {
      const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
      if (!userRes.ok) return Response.json({ error: "Your login session expired. Please log in again." }, { status: 401 });
      const user = await userRes.json() as { id: string; email?: string };
      const body = await request.json() as { subject?: string; message?: string; source?: string };
      const subject = String(body.subject || "AI Support Request").slice(0, 160);
      const message = String(body.message || "").slice(0, 5000);
      if (!message.trim()) return Response.json({ error: "Ticket details are required." }, { status: 400 });
      const insertRes = await fetch(`${url}/rest/v1/support_tickets`, {
        method: "POST",
        headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ user_id: user.id, subject, message, source: body.source === "customer_agent" ? "customer_agent" : body.source === "customer" ? "customer" : "website_ai_timeout", status: "open" }),
      });
      const inserted = await insertRes.json() as Array<{ id: string; created_at: string }> | { message?: string };
      if (!insertRes.ok || !Array.isArray(inserted) || !inserted[0]?.id) {
        console.error("Support ticket insert failed", JSON.stringify(inserted).slice(0, 300));
        return Response.json({ error: "Could not create support ticket." }, { status: 500 });
      }
      const profileRes = await fetch(`${url}/rest/v1/profiles?select=email&id=eq.${user.id}`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
      const profile = await profileRes.json() as Array<{ email?: string | null }>;
      const email = user.email || profile?.[0]?.email || undefined;
      const ticket = inserted[0];
      const emailResult = await sendEmail(process.env["RESEND_API_KEY"], email, `Support request created: ${subject}`,
        `Hello,\n\nYour Panel Bazar BD support request has been created.\nTicket ID: ${ticket.id}\nSubject: ${subject}\n\nDetails:\n${message}\n\nWe will review your request.\nPanel Bazar BD Support`);
      let telegramNotified = false;
      if (body.source === "customer_agent") {
        const botToken = process.env["TELEGRAM_SUPPORT_BOT_TOKEN"] || process.env["SUPPORT_TELEGRAM_BOT_TOKEN"] || process.env["TELEGRAM_BOT_TOKEN"];
        const chatId = process.env["TELEGRAM_SUPPORT_CHAT_ID"] || process.env["SUPPORT_TELEGRAM_CHAT_ID"] || process.env["TELEGRAM_CHAT_ID"];
        if (botToken && chatId) {
          const telegramText = [
            "🟢 NEW CUSTOMER AGENT CHAT",
            `Ticket: ${ticket.id}`,
            `Customer: ${email || user.id}`,
            `Subject: ${subject}`,
            "",
            "Customer requested a live representative. Reply from the website Customer Agent inbox.",
          ].join("\\n");
          try {
            const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: telegramText }),
            });
            const telegramBody = await telegramRes.json() as { ok?: boolean; description?: string };
            telegramNotified = telegramRes.ok && telegramBody.ok === true;
            if (!telegramNotified) console.error("Customer agent Telegram notification failed", telegramRes.status, telegramBody.description || "Telegram API rejected the message");
          } catch (telegramError) {
            console.error("Customer agent Telegram notification failed", telegramError);
          }
        } else {
          console.error("Customer agent Telegram notification skipped: bot token or chat ID is missing");
        }
      }
      return Response.json({ ok: true, ticketId: ticket.id, emailSent: emailResult.sent, telegramNotified });
    } catch (error) {
      console.error("Create support ticket failed", error);
      return Response.json({ error: "Could not create support ticket." }, { status: 500 });
    }
  } } }
});
