import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/expire-agent-chats")({
  server: { handlers: { POST: async ({ request }) => {
    const expected = process.env["CRON_SECRET"];
    const authorization = request.headers.get("authorization");
    if (!expected || authorization !== "Bearer " + expected) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !service) return Response.json({ error: "Support backend is not configured." }, { status: 503 });
    const headers = { apikey: service, Authorization: "Bearer " + service };
    try {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const listResponse = await fetch(url + "/rest/v1/support_tickets?select=id,user_id,subject,created_at&source=eq.customer_agent&status=eq.open&created_at=lte." + encodeURIComponent(cutoff), { headers });
      if (!listResponse.ok) throw new Error("Could not load expired chats: " + listResponse.status);
      const tickets = await listResponse.json() as Array<{ id: string; user_id: string; subject: string; created_at: string }>;
      let closed = 0;
      let skipped = 0;
      for (const ticket of tickets) {
        const replyResponse = await fetch(url + "/rest/v1/support_replies?select=id&ticket_id=eq." + encodeURIComponent(ticket.id) + "&user_id=neq." + encodeURIComponent(ticket.user_id) + "&limit=1", { headers });
        if (!replyResponse.ok) throw new Error("Could not check agent replies for " + ticket.id);
        const replies = await replyResponse.json() as Array<{ id: string }>;
        if (replies.length) { skipped++; continue; }
        const updateResponse = await fetch(url + "/rest/v1/support_tickets?id=eq." + encodeURIComponent(ticket.id) + "&status=eq.open", {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ status: "closed", updated_at: new Date().toISOString() }),
        });
        if (!updateResponse.ok) throw new Error("Could not close chat " + ticket.id);
        const updated = await updateResponse.json() as Array<{ id: string }>;
        if (!updated.length) continue;
        closed++;
        const profileResponse = await fetch(url + "/rest/v1/profiles?select=email&id=eq." + encodeURIComponent(ticket.user_id), { headers });
        const profiles = profileResponse.ok ? await profileResponse.json() as Array<{ email?: string | null }> : [];
        const email = profiles[0]?.email;
        const apiKey = process.env["RESEND_API_KEY"];
        if (apiKey && email) {
          const from = process.env["SUPPORT_EMAIL_FROM"] || "Panel Bazar BD Support <support@panelbazarbd.shop>";
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              from, to: [email], subject: "Customer Agent chat closed - Panel Bazar BD",
              text: "Hello,\n\nYour Customer Agent chat was automatically closed because no representative replied within 10 minutes.\n\nTicket ID: " + ticket.id + "\nSubject: " + ticket.subject + "\n\nPanel Bazar BD Support",
            }),
          });
        }
      }
      return Response.json({ ok: true, checked: tickets.length, closed, skippedAgentReplied: skipped });
    } catch (error) {
      console.error("Scheduled customer agent chat auto-close failed", error);
      return Response.json({ error: "Auto-close job failed." }, { status: 500 });
    }
  } } }
});
