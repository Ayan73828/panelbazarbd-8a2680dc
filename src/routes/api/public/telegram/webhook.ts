import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

export function telegramWebhookSecret(token: string) {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("hex");
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return new Response("not configured", { status: 503 });
        const expected = Buffer.from(telegramWebhookSecret(token));
        const actual = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
          return new Response("unauthorized", { status: 401 });
        }
        try {
          const update = await request.json();
          const { handleUpdate } = await import("@/lib/telegram-bot.server");
          await handleUpdate(update);
        } catch (e) {
          console.error("telegram webhook", e);
        }
        return new Response("ok");
      },
    },
  },
});
