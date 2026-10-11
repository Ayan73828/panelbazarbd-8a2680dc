import { createFileRoute } from "@tanstack/react-router";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { id?: number; username?: string };
  };
};

export const Route = createFileRoute("/api/telegram/support-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TELEGRAM_SUPPORT_WEBHOOK_SECRET"];
        const expectedChatId = process.env["TELEGRAM_SUPPORT_CHAT_ID"];
        const expectedAdminUserId = process.env["TELEGRAM_SUPPORT_ADMIN_USER_ID"];
        const botToken = process.env["TELEGRAM_SUPPORT_BOT_TOKEN"];
        const supabaseUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
        const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!secret || !expectedChatId || !expectedAdminUserId || !botToken || !supabaseUrl || !serviceKey) {
          return Response.json({ ok: false, error: "Telegram support webhook is not configured." }, { status: 503 });
        }
        if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
          return Response.json({ ok: false }, { status: 401 });
        }

        try {
          const update = await request.json() as TelegramUpdate;
          const message = update.message;
          const text = message?.text?.trim() || "";
          if (!message?.chat?.id || String(message.chat.id) !== expectedChatId || String(message.from?.id || "") !== expectedAdminUserId || !text) {
            return Response.json({ ok: true });
          }
          const match = text.match(/^\/reply\s+([0-9a-f-]{36})\s+([\s\S]+)$/i);
          if (!match) {
            const help = "To reply to a website customer, send:\n/reply TICKET_UUID Your message here";
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: expectedChatId, text: help })
            });
            return Response.json({ ok: true });
          }

          const ticketId = match[1];
          const replyText = match[2].trim().slice(0, 3000);
          if (!replyText) return Response.json({ ok: true });

          const headers = {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
          };
          const ticketResponse = await fetch(`${supabaseUrl}/rest/v1/support_tickets?id=eq.${ticketId}&select=id,user_id,status,subject`, { headers });
          if (!ticketResponse.ok) throw new Error("Could not look up support ticket");
          const tickets = await ticketResponse.json() as Array<{ id: string; user_id: string; status: string; subject: string }>;
          const ticket = tickets[0];
          if (!ticket || ticket.status !== "open") {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: expectedChatId, text: "Ticket not found or already closed." })
            });
            return Response.json({ ok: true });
          }

          const adminResponse = await fetch(`${supabaseUrl}/rest/v1/user_roles?role=eq.admin&select=user_id&limit=1`, { headers });
          if (!adminResponse.ok) throw new Error("Could not find an admin account");
          const admins = await adminResponse.json() as Array<{ user_id: string }>;
          const adminId = admins[0]?.user_id;
          if (!adminId) throw new Error("No admin user is configured");

          const insertResponse = await fetch(`${supabaseUrl}/rest/v1/support_replies`, {
            method: "POST",
            headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({ ticket_id: ticket.id, user_id: adminId, message: replyText })
          });
          if (!insertResponse.ok) {
            console.error("Telegram support reply insert failed", insertResponse.status, (await insertResponse.text()).slice(0, 200));
            throw new Error("Could not save agent reply");
          }

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: expectedChatId, text: `Reply sent to customer.\nTicket: ${ticket.id}` })
          });
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Telegram support webhook failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      }
    }
  }
});