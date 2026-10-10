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

    const text = `📢 <b>${data.title.trim()}</b> <b>${data.message.trim()}</b>`;
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
          const result = await tgApi("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
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
