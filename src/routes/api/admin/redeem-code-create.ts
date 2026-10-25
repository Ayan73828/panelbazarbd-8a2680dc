import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/redeem-code-create")({
  server: { handlers: { POST: async ({ request }) => {
    const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const anon = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
    const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !anon || !service) return Response.json({ error: "Redeem backend is not configured." }, { status: 503 });
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Login required." }, { status: 401 });
    const authResponse = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: authorization } });
    if (!authResponse.ok) return Response.json({ error: "Login session expired." }, { status: 401 });
    const user = await authResponse.json() as { id?: string };
    if (!user.id) return Response.json({ error: "Login required." }, { status: 401 });
    const adminHeaders = { apikey: service, Authorization: "Bearer " + service };
    const roleResponse = await fetch(url + "/rest/v1/user_roles?select=role&user_id=eq." + encodeURIComponent(user.id), { headers: adminHeaders });
    const roles = await roleResponse.json() as Array<{ role: string }>;
    if (!roleResponse.ok || !roles.some((row) => row.role === "admin")) return Response.json({ error: "Admin only" }, { status: 403 });
    let body: { amount?: unknown; maxUses?: unknown };
    try { body = await request.json() as { amount?: unknown; maxUses?: unknown }; }
    catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
    const amount = Number(body.amount);
    const maxUses = Number(body.maxUses);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) return Response.json({ error: "Amount must be between 1 and 100000." }, { status: 400 });
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) return Response.json({ error: "Max uses must be between 1 and 10000." }, { status: 400 });
    const code = "PB-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
    const createResponse = await fetch(url + "/rest/v1/rpc/create_redeem_code_for_bot", {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ p_amount: amount, p_code: code, p_max_uses: maxUses, p_expires_at: null }),
    });
    const result = await createResponse.json() as { code?: string; amount?: number; max_uses?: number } | { message?: string; details?: string };
    if (!createResponse.ok) {
      console.error("Website redeem-code create failed", result);
      return Response.json({ error: "Redeem code creation failed. Check the database function and permissions." }, { status: 500 });
    }
    const created = Array.isArray(result) ? result[0] : result;
    if (!created || !("code" in created) || !created.code) return Response.json({ error: "Redeem code was not returned." }, { status: 500 });
    return Response.json({ code: created.code, amount: created.amount, max_uses: created.max_uses });
  } } },
});
