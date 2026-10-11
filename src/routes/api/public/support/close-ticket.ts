import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/support/close-ticket")({
  server: { handlers: { POST: async ({ request }) => {
    const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const anon = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
    const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const auth = request.headers.get("authorization");
    if (!url || !anon || !service) return Response.json({ error: "Support backend is not configured." }, { status: 503 });
    if (!auth?.startsWith("Bearer ")) return Response.json({ error: "Please log in first." }, { status: 401 });
    try {
      const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
      if (!userRes.ok) return Response.json({ error: "Invalid login session." }, { status: 401 });
      const user = await userRes.json() as { id: string; email?: string };
      const rolesRes = await fetch(`${url}/rest/v1/user_roles?select=role&user_id=eq.${user.id}`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
      const roles = await rolesRes.json() as Array<{ role: string }>;
      if (!rolesRes.ok || !roles.some((row) => row.role === "admin")) return Response.json({ error: "Admin access required." }, { status: 403 });
      const body = await request.json() as { ticketId?: string };
      if (!body.ticketId || !/^[0-9a-f-]{36}$/i.test(body.ticketId)) return Response.json({ error: "Invalid ticket ID." }, { status: 400 });
      const ticketRes = await fetch(`${url}/rest/v1/support_tickets?select=id,user_id,subject,status&id=eq.${body.ticketId}`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
      const tickets = await ticketRes.json() as Array<{ id: string; user_id: string; subject: string; status: string }>;
      const ticket = tickets[0];
      if (!ticket) return Response.json({ error: "Ticket not found." }, { status: 404 });
      if (ticket.status === "closed" || ticket.status === "resolved") return Response.json({ ok: true, alreadyClosed: true });
      const updateRes = await fetch(`${url}/rest/v1/support_tickets?id=eq.${ticket.id}`, {
        method: "PATCH", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status: "resolved", updated_at: new Date().toISOString() }),
      });
      if (!updateRes.ok) return Response.json({ error: "Could not close ticket." }, { status: 500 });
      const profileRes = await fetch(`${url}/rest/v1/profiles?select=email&id=eq.${ticket.user_id}`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
      const profile = await profileRes.json() as Array<{ email?: string | null }>;
      const authUserRes = await fetch(`${url}/auth/v1/admin/users/${ticket.user_id}`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
      const authUser = authUserRes.ok ? await authUserRes.json() as { email?: string } : {};
      const email = authUser.email || profile?.[0]?.email;
      let emailSent = false;
      if (process.env["RESEND_API_KEY"] && email) {
        const from = process.env["SUPPORT_EMAIL_FROM"] || "Panel Bazar BD Support <support@panelbazarbd.shop>";
        const mailRes = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env["RESEND_API_KEY"]}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], subject: `Support ticket closed: ${ticket.subject}`, text: `Hello,\n\nYour Panel Bazar BD support request has been marked as resolved/closed.\nTicket ID: ${ticket.id}\nSubject: ${ticket.subject}\n\nIf the issue is not resolved, please contact support again.\nPanel Bazar BD Support` }) });
        emailSent = mailRes.ok;
        if (!mailRes.ok) console.error("Ticket closure email failed", mailRes.status, (await mailRes.text()).slice(0, 250));
      }
      return Response.json({ ok: true, emailSent });
    } catch (error) {
      console.error("Close support ticket failed", error);
      return Response.json({ error: "Could not close support ticket." }, { status: 500 });
    }
  } } }
});
