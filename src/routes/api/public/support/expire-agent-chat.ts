import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/support/expire-agent-chat")({
  server: { handlers: { POST: async ({ request }) => {
    const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const anon = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
    const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const authorization = request.headers.get("authorization");
    if (!url || !anon || !service) return Response.json({ error: "Support backend is not configured." }, { status: 503 });
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Login required." }, { status: 401 });
    try {
      const authResponse = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: authorization } });
      if (!authResponse.ok) return Response.json({ error: "Login session expired." }, { status: 401 });
      const user = await authResponse.json() as { id: string; email?: string };
      const body = await request.json() as { ticketId?: string };
      if (!body.ticketId || !/^[0-9a-f-]{36}$/i.test(body.ticketId)) return Response.json({ error: "Invalid ticket ID." }, { status: 400 });

      const headers = { apikey: service, Authorization: "Bearer " + service };
      const ticketResponse = await fetch(url + "/rest/v1/support_tickets?select=id,user_id,subject,message,status,source,created_at&id=eq." + body.ticketId + "&user_id=eq." + user.id, { headers });
      const ticketRows = await ticketResponse.json() as Array<{ id: string; user_id: string; subject: string; message: string; status: string; source: string; created_at: string }>;
      const ticket = ticketRows[0];
      if (!ticket) return Response.json({ error: "Chat request not found." }, { status: 404 });
      if (ticket.source !== "customer_agent") return Response.json({ error: "Not a Customer Agent chat." }, { status: 400 });
      if (ticket.status !== "open") return Response.json({ ok: true, closed: ticket.status === "closed" || ticket.status === "resolved", alreadyClosed: true });
      if (Date.now() - new Date(ticket.created_at).getTime() < 10 * 60 * 1000) return Response.json({ ok: true, closed: false, tooEarly: true });

      const replyResponse = await fetch(url + "/rest/v1/support_replies?select=id&ticket_id=eq." + ticket.id + "&user_id=neq." + user.id + "&limit=1", { headers });
      const replies = await replyResponse.json() as Array<{ id: string }>;
      if (!replyResponse.ok) return Response.json({ error: "Could not check agent replies." }, { status: 500 });
      if (replies.length) return Response.json({ ok: true, closed: false, agentReplied: true });

      const updateResponse = await fetch(url + "/rest/v1/support_tickets?id=eq." + ticket.id + "&status=eq.open", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ status: "closed", updated_at: new Date().toISOString() }),
      });
      const updated = await updateResponse.json() as Array<{ id: string }>;
      if (!updateResponse.ok) return Response.json({ error: "Could not close the chat." }, { status: 500 });
      if (!updated.length) return Response.json({ ok: true, closed: false, alreadyClosed: true });

      const profileResponse = await fetch(url + "/rest/v1/profiles?select=email&id=eq." + user.id, { headers });
      const profile = await profileResponse.json() as Array<{ email?: string | null }>;
      const email = user.email || profile[0]?.email || undefined;
      let emailSent = false;
      const apiKey = process.env["RESEND_API_KEY"];
      if (apiKey && email) {
        const from = process.env["SUPPORT_EMAIL_FROM"] || "Panel Bazar BD Support <support@panelbazarbd.shop>";
        const mailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [email],
            subject: "Customer Agent chat closed - Panel Bazar BD",
            text: "Hello,\n\nYour Customer Agent chat request was automatically closed because no representative replied within 10 minutes.\n\nTicket ID: " + ticket.id + "\nSubject: " + ticket.subject + "\n\nYou can open a new Customer Agent request from the website at any time.\nPanel Bazar BD Support",
          }),
        });
        emailSent = mailResponse.ok;
        if (!mailResponse.ok) console.error("Customer agent auto-close email failed", mailResponse.status, (await mailResponse.text()).slice(0, 250));
      }
      return Response.json({ ok: true, closed: true, emailSent });
    } catch (error) {
      console.error("Expire customer agent chat failed", error);
      return Response.json({ error: "Could not expire Customer Agent chat." }, { status: 500 });
    }
  } } }
});
