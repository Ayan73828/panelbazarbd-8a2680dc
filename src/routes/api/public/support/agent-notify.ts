import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/support/agent-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
        const botToken = process.env["TELEGRAM_SUPPORT_BOT_TOKEN"];
        const chatId = process.env["TELEGRAM_SUPPORT_CHAT_ID"];
        const authorization = request.headers.get("authorization");
        if (!supabaseUrl || !supabaseKey) {
          return Response.json({ error: "Support backend is not configured." }, { status: 503 });
        }
        if (!botToken || !chatId) {
          return Response.json({ error: "Telegram agent notifications are not configured yet." }, { status: 503 });
        }
        if (!authorization?.startsWith("Bearer ")) {
          return Response.json({ error: "Please log in to request a customer agent." }, { status: 401 });
        }

        try {
          const body = await request.json() as { ticketId?: string; message?: string };
          if (!body.ticketId || !/^[0-9a-f-]{36}$/i.test(body.ticketId)) {
            return Response.json({ error: "Invalid support request." }, { status: 400 });
          }
          const headers = { apikey: supabaseKey, Authorization: authorization };
          const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
          if (!userResponse.ok) return Response.json({ error: "Your login session expired. Please log in again." }, { status: 401 });
          const user = await userResponse.json() as { id?: string; email?: string; user_metadata?: { username?: string; name?: string } };
          if (!user.id) return Response.json({ error: "Unable to verify your account." }, { status: 401 });

          const ticketResponse = await fetch(`${supabaseUrl}/rest/v1/support_tickets?id=eq.${body.ticketId}&user_id=eq.${user.id}&select=id,subject,message,created_at`, { headers });
          if (!ticketResponse.ok) return Response.json({ error: "Could not verify support request." }, { status: 502 });
          const tickets = await ticketResponse.json() as Array<{ id: string; subject: string; message: string; created_at: string }>;
          const ticket = tickets[0];
          if (!ticket) return Response.json({ error: "Support request not found." }, { status: 404 });

          const username = user.user_metadata?.username || user.user_metadata?.name || user.email || user.id;
          const telegramText = [
            "🟢 Panel Bazar BD — Customer Agent Request",
            `Ticket: ${ticket.id}`,
            `Customer: ${username}`,
            `User ID: ${user.id}`,
            `Subject: ${ticket.subject}`,
            "",
            body.message ? "New customer message:" : "Initial request:",
            (body.message || ticket.message).slice(0, 1800),
            "",
            "Reply from the Telegram admin chat using:",
            `/reply ${ticket.id} Your reply here`
          ].join("\n");
          const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: telegramText, disable_web_page_preview: true })
          });
          if (!telegramResponse.ok) {
            console.error("Telegram support notification failed", telegramResponse.status, (await telegramResponse.text()).slice(0, 200));
            return Response.json({ error: "Your chat request was created, but the agent notification could not be sent." }, { status: 502 });
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Support agent notification failed", error);
          return Response.json({ error: "Could not notify the customer agent." }, { status: 500 });
        }
      }
    }
  }
});