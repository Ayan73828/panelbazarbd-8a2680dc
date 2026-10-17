import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetCustomerAgentRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.userId)
      .eq("role", "customer_agent");
    if (readError) throw new Error(readError.message);
    if (data.enabled) {
      if (!existing?.length) {
        const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: "customer_agent" });
        if (error) throw new Error(error.message);
      }
    } else if (existing?.length) {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "customer_agent");
      if (error) throw new Error(error.message);
    }
    return { ok: true, enabled: data.enabled };
  });

export const adminSetUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    roles: z.array(z.enum(["user", "customer_agent", "admin"])).max(3),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (String(context.claims?.email ?? "").toLowerCase() !== "ishak777998@gmail.com") {
      throw new Error("Only the main admin can assign roles");
    }
    if (data.userId !== context.userId && data.roles.includes("admin")) throw new Error("Only the protected main admin account may hold the full admin role");
    if (data.userId === context.userId && !data.roles.includes("admin")) throw new Error("You cannot remove your own admin role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error: targetError } = await supabaseAdmin.from("profiles").select("email").eq("id", data.userId).maybeSingle();
    if (targetError) throw new Error(targetError.message);
    if (String(target?.email ?? "").toLowerCase() === "ishak777998@gmail.com" && data.userId !== context.userId) throw new Error("Main admin account is protected");
    const { error: deleteError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (deleteError) throw new Error(deleteError.message);
    if (data.roles.length) {
      const { error: insertError } = await supabaseAdmin.from("user_roles").insert([...new Set(data.roles)].map((role) => ({ user_id: data.userId, role })));
      if (insertError) throw new Error(insertError.message);
    }
    return { ok: true, roles: [...new Set(data.roles)] };
  });

export const adminSaveUserPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    permissions: z.array(z.enum(["products","categories","keys","orders","users","payments","wallet","support","customer_agents","announcements","homepage","settings","telegram_broadcast"])).max(13),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (String(context.claims?.email ?? "").toLowerCase() !== "ishak777998@gmail.com") throw new Error("Only the main admin can manage permissions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error: targetError } = await supabaseAdmin.from("profiles").select("email").eq("id", data.userId).maybeSingle();
    if (targetError) throw new Error(targetError.message);
    if (!target) throw new Error("User not found");
    if (String(target.email ?? "").toLowerCase() === "ishak777998@gmail.com") throw new Error("Main admin permissions cannot be restricted here");
    if (data.permissions.length === 0) {
      const { error } = await supabaseAdmin.from("admin_subadmins").delete().eq("user_id", data.userId);
      if (error) throw new Error(error.message);
      return { ok: true, permissions: [] };
    }
    const { error } = await supabaseAdmin.from("admin_subadmins").upsert({
      user_id: data.userId, email: String(target.email ?? "").toLowerCase(),
      permissions: [...new Set(data.permissions)], created_by: context.userId, updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, permissions: [...new Set(data.permissions)] };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminConnectTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { tgApi, SITE_URL } = await import("@/lib/telegram-bot.server");
    const { telegramWebhookSecret } = await import("@/routes/api/public/telegram/webhook");
    const r = await tgApi("setWebhook", {
      url: `${SITE_URL}/api/public/telegram/webhook`,
      secret_token: telegramWebhookSecret(process.env["TELEGRAM_BOT_TOKEN"]!),
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    if (!r.ok) throw new Error(r.description ?? "Telegram error");
    await tgApi("setMyCommands", { commands: [{ command: "start", description: "Menu" }, { command: "login", description: "Login" }, { command: "logout", description: "Logout" }] });
    const me = await tgApi("getMe", {});
    return { ok: true, bot: me.result?.username as string | undefined };
  });

export const adminTelegramBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().trim().min(1).max(200),
      message: z.string().trim().min(1).max(3500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { tgApi } = await import("@/lib/telegram-bot.server");
    if (!process.env["TELEGRAM_BOT_TOKEN"]) throw new Error("Telegram bot is not configured");

    const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const text = `<b>📢 ${escapeHtml(data.title.trim())} ${escapeHtml(data.message.trim())}</b>`;
    if (text.length > 4096) throw new Error("Announcement is too long for Telegram");

    let offset = 0;
    let sent = 0;
    let failed = 0;
    const pageSize = 500;
    while (true) {
      const { data: rows, error } = await supabaseAdmin
        .from("telegram_sessions")
        .select("chat_id")
        .order("chat_id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error("Could not load Telegram bot users: " + error.message);
      const chatIds = (rows ?? [])
        .map((row: { chat_id: number | string | null }) => Number(row.chat_id))
        .filter((id: number) => Number.isFinite(id) && id !== 0);

      for (const chatId of chatIds) {
        try {
          const result = await tgApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
          if (result?.ok) sent++;
          else failed++;
        } catch {
          failed++;
        }
        await new Promise((resolve) => setTimeout(resolve, 45));
      }
      if (!rows || rows.length < pageSize) break;
      offset += pageSize;
    }
    return { ok: true, sent, failed, total: sent + failed };
  });


export const adminSendSupportEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    to: z.string().trim().email().max(254),
    subject: z.string().trim().min(2).max(200),
    message: z.string().trim().min(2).max(10000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (String(context.claims?.email ?? "").toLowerCase() !== "ishak777998@gmail.com") {
      throw new Error("Only the main admin can send Support Mail");
    }
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured on the website server");
    const escapeHtml = (value: string) => value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;white-space:pre-wrap">${escapeHtml(data.message.trim())}<hr><p style="font-size:12px;color:#6b7280">PANEL BAZAR BD Support</p></body></html>`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "PANEL BAZAR BD <verification@panelbazarbd.shop>",
        to: [data.to.trim().toLowerCase()],
        subject: data.subject.trim(),
        text: data.message.trim(),
        html,
      }),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
    if (!response.ok) throw new Error(result.message || result.name || "Email provider rejected the message");
    return { ok: true, id: result.id ?? null, to: data.to.trim().toLowerCase() };
  });
