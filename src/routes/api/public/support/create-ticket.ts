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
      const requestedSource = body.source === "customer_agent" ? "customer_agent" : body.source === "customer" ? "customer" : "website_ai_timeout";
      const ticketRes = await fetch(`${url}/rest/v1/rpc/create_or_get_support_ticket`, {
        method: "POST",
        headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_user_id: user.id, p_subject: subject, p_message: message, p_source: requestedSource }),
      });
      const ticketRows = await ticketRes.json() as Array<{ ticket_id: string; created: boolean; ticket_source: string; ticket_created_at: string }> | { message?: string };
      if (!ticketRes.ok || !Array.isArray(ticketRows) || !ticketRows[0]?.ticket_id) {
        const dbMessage = ticketRows && !Array.isArray(ticketRows) ? String(ticketRows.message || "") : "";
        const cooldown = dbMessage.match(/SUPPORT_COOLDOWN:(\\d+):(support|agent)/);
        if (cooldown) {
          const seconds = Number(cooldown[1]);
          const minutes = Math.ceil(seconds / 60);
          const kind = cooldown[2] === "agent" ? "Customer Agent" : "Support";
          return Response.json({
            ok: false,
            cooldown: true,
            retryAfterSeconds: seconds,
            error: cooldown[2] === "agent"
              ? `আপনার আগের Customer Agent request বন্ধ হওয়ার পর ১ ঘণ্টা পূর্ণ না হওয়া পর্যন্ত নতুন Customer Agent request করা যাবে না। আরও প্রায় ${minutes} মিনিট অপেক্ষা করুন।`
              : `আপনার আগের Support ticket বন্ধ হওয়ার পর ৩০ মিনিট পূর্ণ না হওয়া পর্যন্ত নতুন Support request করা যাবে না। আরও প্রায় ${minutes} মিনিট অপেক্ষা করুন।`,
          }, { status: 429 });
        }
        console.error("Support ticket create/reuse failed", JSON.stringify(ticketRows).slice(0, 300));
        return Response.json({ error: "Could not create support ticket." }, { status: 500 });
      }
      const activeTicket = ticketRows[0];
      if (activeTicket.ticket_source !== requestedSource) {
        return Response.json({
          ok: false,
          error: activeTicket.ticket_source === "customer_agent"
            ? "আপনার একটি Customer Agent chat ইতিমধ্যে open আছে। সেটি শেষ না হওয়া পর্যন্ত অন্য Support request খোলা যাবে না।"
            : "আপনার একটি Support request ইতিমধ্যে open আছে। সেটি শেষ না হওয়া পর্যন্ত Customer Agent খোলা যাবে না।",
          activeSource: activeTicket.ticket_source,
          ticketId: activeTicket.ticket_id,
        }, { status: 409 });
      }
      const ticket = { id: activeTicket.ticket_id, created_at: activeTicket.ticket_created_at };
      const isNewTicket = activeTicket.created;
      const profileRes = await fetch(`${url}/rest/v1/profiles?select=name,username,email,phone,balance&id=eq.${user.id}`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
      const profile = await profileRes.json() as Array<{ name?: string | null; username?: string | null; email?: string | null; phone?: string | null; balance?: number | string | null }>;
      const customerProfile = profile?.[0];
      const email = user.email || customerProfile?.email || undefined;
      const emailResult = isNewTicket ? await sendEmail(process.env["RESEND_API_KEY"], email, `Support request created: ${subject}`,
        `Hello,\n\nYour Panel Bazar BD support request has been created.\nTicket ID: ${ticket.id}\nSubject: ${subject}\n\nDetails:\n${message}\n\nWe will review your request.\nPanel Bazar BD Support`) : { sent: false };
      let telegramNotified = false;
      if (isNewTicket && (requestedSource === "customer_agent" || requestedSource === "website_ai_timeout" || requestedSource === "customer")) {
        const botToken = process.env["TELEGRAM_SUPPORT_BOT_TOKEN"] || process.env["SUPPORT_TELEGRAM_BOT_TOKEN"] || process.env["TELEGRAM_BOT_TOKEN"];
        const chatId = process.env["TELEGRAM_SUPPORT_CHAT_ID"] || process.env["SUPPORT_TELEGRAM_CHAT_ID"] || process.env["TELEGRAM_CHAT_ID"];
        if (botToken && chatId) {
          const telegramText = [
            requestedSource === "customer_agent" ? "🟢 NEW CUSTOMER AGENT CHAT" : "🚨 NEW AI SUPPORT TICKET",
            `Ticket: ${ticket.id}`,
            `Customer name: ${customerProfile?.name || customerProfile?.username || "Not set"}`,
            `Username: ${customerProfile?.username || "Not set"}`,
            `User ID: ${user.id}`,
            `Email: ${email || "Not set"}`,
            `Account phone: ${customerProfile?.phone || "Not set"}`,
            `Balance: ${customerProfile?.balance ?? "Not available"}`,
            `Subject: ${subject}`,
            "",
            "Customer details / conversation:",
            message.slice(0, 3500),
            "",
            requestedSource === "customer_agent" ? "Reply from the website Customer Agent inbox." : "Please review this ticket in the admin/support panel.",
          ].join("\\n");
          try {
            const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: telegramText }),
            });
            const telegramBody = await telegramRes.json() as { ok?: boolean; description?: string };
            telegramNotified = telegramRes.ok && telegramBody.ok === true;
            if (!telegramNotified) console.error("Support Telegram notification failed", telegramRes.status, telegramBody.description || "Telegram API rejected the message");
          } catch (telegramError) {
            console.error("Support Telegram notification failed", telegramError);
          }
        } else {
          console.error("Support Telegram notification skipped: bot token or chat ID is missing");
        }
      }
      return Response.json({ ok: true, ticketId: ticket.id, emailSent: emailResult.sent, telegramNotified, reused: !isNewTicket, ticketSource: activeTicket.ticket_source, createdAt: activeTicket.ticket_created_at });
    } catch (error) {
      console.error("Create support ticket failed", error);
      return Response.json({ error: "Could not create support ticket." }, { status: 500 });
    }
  } } }
});
