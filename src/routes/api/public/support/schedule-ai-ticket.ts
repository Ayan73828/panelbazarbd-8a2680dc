import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/support/schedule-ai-ticket")({
  server: { handlers: { POST: async ({ request }) => {
    const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const anon = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
    const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const authorization = request.headers.get("authorization");
    if (!url || !anon || !service) return Response.json({ error: "Support backend is not configured." }, { status: 503 });
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Please log in first." }, { status: 401 });
    try {
      const authRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: authorization } });
      if (!authRes.ok) return Response.json({ error: "Please log in first." }, { status: 401 });
      const user = await authRes.json() as { id: string };
      const body = await request.json() as { action?: string; subject?: string; message?: string };
      const headers = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
      if (body.action === "status") {
        const statusRes = await fetch(`${url}/rest/v1/ai_support_pending_tickets?user_id=eq.${user.id}&select=id,status,ticket_id,due_at&order=created_at.desc&limit=1`, { headers });
        const rows = await statusRes.json() as Array<{ id: string; status: string; ticket_id?: string | null; due_at: string }>;
        if (!statusRes.ok || !Array.isArray(rows)) return Response.json({ error: "Could not check ticket status." }, { status: 502 });
        if (!rows[0]) return Response.json({ ok: true, status: "missing" });
        return Response.json({ ok: true, status: rows[0].status, ticketId: rows[0].ticket_id || undefined, dueAt: rows[0].due_at });
      }
      if (body.action === "cancel") {
        const cancelRes = await fetch(`${url}/rest/v1/ai_support_pending_tickets?user_id=eq.${user.id}&status=eq.pending`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() })
        });
        if (!cancelRes.ok) return Response.json({ error: "Could not cancel pending support request." }, { status: 502 });
        return Response.json({ ok: true, cancelled: true });
      }
      const subject = String(body.subject || "AI Support Request").slice(0, 160);
      const message = String(body.message || "").trim().slice(0, 5000);
      if (!message) return Response.json({ error: "Ticket details are required." }, { status: 400 });
      const cancelRes = await fetch(`${url}/rest/v1/ai_support_pending_tickets?user_id=eq.${user.id}&status=eq.pending`, {
        method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() })
      });
      if (!cancelRes.ok) throw new Error("Could not replace pending support request");
      const insertRes = await fetch(`${url}/rest/v1/ai_support_pending_tickets`, {
        method: "POST", headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ user_id: user.id, subject, message, due_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), status: "pending" })
      });
      const rows = await insertRes.json() as Array<{ id: string; due_at: string }> | { message?: string };
      if (!insertRes.ok || !Array.isArray(rows) || !rows[0]) {
        console.error("Could not schedule AI support ticket", JSON.stringify(rows).slice(0, 200));
        return Response.json({ error: "Could not schedule the Support Ticket. Please use Normal Support." }, { status: 502 });
      }
      return Response.json({ ok: true, pendingId: rows[0].id, dueAt: rows[0].due_at });
    } catch (error) {
      console.error("Schedule AI support ticket failed", error);
      return Response.json({ error: "Could not schedule the Support Ticket." }, { status: 500 });
    }
  } } }
});
