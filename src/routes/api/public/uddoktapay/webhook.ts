import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Gateway callback. Never trusts the body: the invoice is re-verified with the
// gateway API (server-side key) before any credit happens.
export const Route = createFileRoute("/api/public/uddoktapay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = z.object({ invoice_id: z.string().min(1).max(100) }).safeParse(body);
        if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
        try {
          const { verifyAndCredit } = await import("@/lib/uddoktapay.server");
          const r = await verifyAndCredit(parsed.data.invoice_id);
          return Response.json({ ok: true, status: r.status });
        } catch (e) {
          console.error("uddoktapay webhook error", e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
