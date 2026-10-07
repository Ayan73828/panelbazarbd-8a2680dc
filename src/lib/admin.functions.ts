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
    const r = await tgApi("setWebhook", {
      url: `${SITE_URL}/api/public/telegram/webhook`,
      secret_token: process.env["TELEGRAM_WEBHOOK_SECRET"],
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    if (!r.ok) throw new Error(r.description ?? "Telegram error");
    await tgApi("setMyCommands", { commands: [{ command: "start", description: "Menu" }, { command: "login", description: "Login" }, { command: "logout", description: "Logout" }] });
    const me = await tgApi("getMe", {});
    return { ok: true, bot: me.result?.username as string | undefined };
  });
