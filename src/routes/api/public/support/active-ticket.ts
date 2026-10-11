import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/support/active-ticket")({
  server: { handlers: { GET: async ({ request }) => {
    const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const anon = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
    const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const authorization = request.headers.get("authorization");
    if (!url || !anon || !service) return Response.json({ error: "Support backend is not configured." }, { status: 503 });
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Login required." }, { status: 401 });
    try {
      const authResponse = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: authorization } });
      if (!authResponse.ok) return Response.json({ error: "Login session expired." }, { status: 401 });
      const user = await authResponse.json() as { id: string };
      const response = await fetch(url + "/rest/v1/support_tickets?select=id,subject,message,status,source,created_at&user_id=eq." + encodeURIComponent(user.id) + "&status=eq.open&source=in.(customer_agent,customer,website_ai_timeout)&order=created_at.desc&limit=1", {
        headers: { apikey: service, Authorization: "Bearer " + service },
      });
      const tickets = await response.json() as Array<{ id: string; subject: string; message: string; status: string; source: string; created_at: string }> | { message?: string };
      if (!response.ok || !Array.isArray(tickets)) {
        console.error("Active support ticket lookup failed", JSON.stringify(tickets).slice(0, 250));
        return Response.json({ error: "Could not load active support request." }, { status: 500 });
      }
      return Response.json({ ok: true, ticket: tickets[0] ?? null });
    } catch (error) {
      console.error("Active support ticket lookup failed", error);
      return Response.json({ error: "Could not load active support request." }, { status: 500 });
    }
  } } }
});
