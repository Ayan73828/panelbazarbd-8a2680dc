import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/support/process-ai-tickets")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["AI_SUPPORT_SCHEDULER_SECRET"];
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !service) return Response.json({ error: "Support backend is not configured." }, { status: 503 });
    const headers = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
    try {
      const pendingRes = await fetch(`${url}/rest/v1/ai_support_pending_tickets?status=eq.pending&due_at=lte.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,subject,message,due_at&order=due_at.asc&limit=25`, { headers });
      const pending = await pendingRes.json() as Array<{ id: string; user_id: string; subject: string; message: string; due_at: string }>;
      if (!pendingRes.ok || !Array.isArray(pending)) throw new Error("Could not fetch pending tickets");
      const processed: Array<{ pendingId: string; ticketId?: string; error?: string }> = [];
      for (const item of pending) {
        const claimRes = await fetch(`${url}/rest/v1/ai_support_pending_tickets?id=eq.${item.id}&status=eq.pending`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({ status: "processed", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        });
        const claimed = await claimRes.json() as Array<{ id: string }> | { message?: string };
        if (!claimRes.ok || !Array.isArray(claimed) || !claimed.length) continue;
        try {
          const ticketRes = await fetch(`${url}/rest/v1/rpc/create_or_get_support_ticket`, {
            method: "POST", headers,
            body: JSON.stringify({ p_user_id: item.user_id, p_subject: item.subject, p_message: item.message, p_source: "website_ai_timeout" })
          });
          const ticketRows = await ticketRes.json() as Array<{ ticket_id: string; created: boolean; ticket_source: string }> | { message?: string };
          if (!ticketRes.ok || !Array.isArray(ticketRows) || !ticketRows[0]?.ticket_id || ticketRows[0].ticket_source !== "website_ai_timeout") {
            throw new Error("Ticket creation was blocked or failed");
          }
          const ticket = ticketRows[0];
          const profileRes = await fetch(`${url}/rest/v1/profiles?select=name,username,email,phone,balance&id=eq.${item.user_id}`, { headers });
          const profiles = await profileRes.json() as Array<{ name?: string; username?: string; email?: string; phone?: string; balance?: number | string }>;
          const profile = profiles[0];
          let telegramNotified = false;
          const botToken = process.env["TELEGRAM_SUPPORT_BOT_TOKEN"] || process.env["SUPPORT_TELEGRAM_BOT_TOKEN"] || process.env["TELEGRAM_BOT_TOKEN"];
          const chatId = process.env["TELEGRAM_SUPPORT_CHAT_ID"] || process.env["SUPPORT_TELEGRAM_CHAT_ID"] || process.env["TELEGRAM_CHAT_ID"];
          if (ticket.created && botToken && chatId) {
            const telegramText = [
              "🚨 NEW AI SUPPORT TICKET (AUTO)",
              `Ticket: ${ticket.ticket_id}`,
              `Customer: ${profile?.name || profile?.username || "Not set"}`,
              `Username: ${profile?.username || "Not set"}`,
              `User ID: ${item.user_id}`,
              `Email: ${profile?.email || "Not set"}`,
              `Phone: ${profile?.phone || "Not set"}`,
              `Balance: ${profile?.balance ?? "Not available"}`,
              `Subject: ${item.subject}`,
              "",
              "Customer-provided details:",
              item.message.slice(0, 3000),
              "",
              "Please review this ticket in the admin/support panel."
            ].join("\n");
            const notifyRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: telegramText })
            });
            const notifyBody = await notifyRes.json() as { ok?: boolean };
            telegramNotified = notifyRes.ok && notifyBody.ok === true;
          }
          const updateRes = await fetch(`${url}/rest/v1/ai_support_pending_tickets?id=eq.${item.id}`, {
            method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({ ticket_id: ticket.ticket_id, updated_at: new Date().toISOString() })
          });
          if (!updateRes.ok) console.error("Could not attach created ticket to pending row", item.id);
          processed.push({ pendingId: item.id, ticketId: ticket.ticket_id, error: telegramNotified ? undefined : "Ticket created; Telegram notification could not be confirmed." });
        } catch (error) {
          console.error("Scheduled AI support ticket failed", item.id, error);
          await fetch(`${url}/rest/v1/ai_support_pending_tickets?id=eq.${item.id}`, {
            method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({ status: "failed", updated_at: new Date().toISOString() })
          });
          processed.push({ pendingId: item.id, error: "Ticket processing failed" });
        }
      }
      return Response.json({ ok: true, processed });
    } catch (error) {
      console.error("AI support ticket scheduler failed", error);
      return Response.json({ error: "Could not process pending support tickets." }, { status: 500 });
    }
  } } }
});
