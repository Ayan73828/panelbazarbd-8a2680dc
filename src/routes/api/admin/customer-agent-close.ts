import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/customer-agent-close")({
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
      const agent = await authResponse.json() as { id: string };
      const headers = { apikey: service, Authorization: "Bearer " + service };
      const roleResponse = await fetch(url + "/rest/v1/user_roles?select=role&user_id=eq." + agent.id, { headers });
      const roles = await roleResponse.json() as Array<{ role: string }>;
      if (!roleResponse.ok || !roles.some((row) => ["admin", "customer_agent"].includes(row.role))) {
        return Response.json({ error: "Admin or Customer Agent role required." }, { status: 403 });
      }
      const body = await request.json() as { ticketId?: string };
      if (!body.ticketId || !/^[0-9a-f-]{36}$/i.test(body.ticketId)) return Response.json({ error: "Invalid ticket ID." }, { status: 400 });
      const ticketResponse = await fetch(url + "/rest/v1/support_tickets?select=id,user_id,subject,message,status,source&id=eq." + body.ticketId, { headers });
      const rows = await ticketResponse.json() as Array<{ id: string; user_id: string; subject: string; message: string; status: string; source: string }>;
      const ticket = rows[0];
      if (!ticket || ticket.source !== "customer_agent") return Response.json({ error: "Customer Agent chat not found." }, { status: 404 });
      if (ticket.status !== "open") return Response.json({ ok: true, alreadyClosed: true, emailSent: false });
      const patchResponse = await fetch(url + "/rest/v1/support_tickets?id=eq." + ticket.id + "&status=eq.open", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ status: "closed", updated_at: new Date().toISOString() }),
      });
      const patched = await patchResponse.json() as Array<{ id: string }>;
      if (!patchResponse.ok) return Response.json({ error: "Could not close this chat." }, { status: 500 });
      if (!patched.length) return Response.json({ ok: true, alreadyClosed: true, emailSent: false });
      const [authUserResponse, profileResponse] = await Promise.all([
        fetch(url + "/auth/v1/admin/users/" + ticket.user_id, { headers }),
        fetch(url + "/rest/v1/profiles?select=email,name,username&id=eq." + ticket.user_id, { headers }),
      ]);
      const authUser = authUserResponse.ok ? await authUserResponse.json() as { email?: string } : {};
      const profiles = await profileResponse.json() as Array<{ email?: string | null; name?: string | null; username?: string | null }>;
      const email = authUser.email || profiles[0]?.email || undefined;
      let emailSent = false;
      const apiKey = process.env["RESEND_API_KEY"];
      if (apiKey && email) {
        const mailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env["SUPPORT_EMAIL_FROM"] || "Panel Bazar BD Support <support@panelbazarbd.shop>",
            to: [email],
            subject: "Your Customer Agent chat has been closed",
            text: "Hello,\n\nYour Panel Bazar BD Customer Agent chat has been closed by our support representative. If you still need help, you can start a new chat from the website.\n\nTicket ID: " + ticket.id + "\nSubject: " + ticket.subject + "\n\nThank you,\nPanel Bazar BD Support",
          }),
        });
        emailSent = mailResponse.ok;
        if (!mailResponse.ok) console.error("Customer Agent manual-close email failed", mailResponse.status, (await mailResponse.text()).slice(0, 250));
      }
      return Response.json({ ok: true, closed: true, emailSent });
    } catch (error) {
      console.error("Customer Agent manual close failed", error);
      return Response.json({ error: "Could not close Customer Agent chat." }, { status: 500 });
    }
  } } }
});
