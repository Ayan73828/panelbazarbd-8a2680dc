import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const telegramNotifyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      event: z.enum(["signup", "order", "support", "support_reply"]),
      message: z.string().max(2000).optional(),
      recordId: z.string().uuid().optional(),
      productName: z.string().max(200).optional(),
      quantity: z.number().int().min(1).max(100).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { notifyOwner } = await import("@/lib/uddoktapay.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name, username, email, phone")
      .eq("id", context.userId)
      .maybeSingle();
    const who = profile?.username || profile?.name || profile?.email || String(context.claims.email ?? context.userId);
    const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (data.event === "signup") {
      await notifyOwner(`🆕 <b>New Signup</b>\nName: ${esc(profile?.name || context.claims.user_metadata?.name || "New user")}\nUsername: ${esc(profile?.username || "-")}\nEmail: ${esc(profile?.email || context.claims.email || "-")}\nPhone: ${esc(profile?.phone || context.claims.user_metadata?.phone || "-")}`);
      return { ok: true };
    }
    if (data.event === "order") {
      if (!data.recordId) throw new Error("Order reference is required");
      const { data: order } = await supabaseAdmin.from("orders").select("id, product_name, total, quantity, status").eq("id", data.recordId).eq("user_id", context.userId).maybeSingle();
      if (!order) throw new Error("Order not found");
      await notifyOwner(`🛒 <b>New Order</b>\nUser: ${esc(who)}\nProduct: ${esc(order.product_name || data.productName || "Product")}\nQuantity: ${order.quantity ?? data.quantity ?? 1}\nAmount: ৳${Number(order.total ?? 0).toLocaleString("en-US")}\nOrder: #${esc(String(order.id).slice(0, 8))}\nStatus: ${esc(order.status)}`);
      return { ok: true };
    }
    if (data.event === "support_reply") {
      if (!data.recordId || !data.message?.trim()) throw new Error("Ticket and reply message are required");
      const { data: role } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
      if (!role) throw new Error("Admin access required");
      const { data: ticket } = await supabaseAdmin.from("support_tickets").select("id,telegram_chat_id,status").eq("id", data.recordId).maybeSingle();
      if (!ticket) throw new Error("Support ticket not found");
      if (ticket.telegram_chat_id) {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) throw new Error("Telegram bot token is not configured");
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: ticket.telegram_chat_id, text: `📩 Support থেকে উত্তর এসেছে\\n\\n${data.message.trim().slice(0, 2000)}`, disable_web_page_preview: true }),
        });
        const result = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
        if (!response.ok || result?.ok !== true) throw new Error(`Telegram reply failed: ${result?.description ?? response.status}`);
      }
      return { ok: true, telegramSent: Boolean(ticket.telegram_chat_id) };
    }
    if (!data.recordId) throw new Error("Support ticket reference is required");
    const { data: ticket } = await supabaseAdmin.from("support_tickets").select("id, subject, message").eq("id", data.recordId).eq("user_id", context.userId).maybeSingle();
    if (!ticket) throw new Error("Support ticket not found");
    await notifyOwner(
      `📩 <b>New Support Ticket</b>\\nSource: Website\\nUser: ${esc(who)}\\nSubject: ${esc(ticket.subject)}\\nMessage: ${esc(String(ticket.message).slice(0, 1200))}\\nTicket: <code>${esc(ticket.id)}</code>`,
      { inline_keyboard: [[{ text: "↩️ Reply", callback_data: "supportreply:" + ticket.id }, { text: "✅ Close", callback_data: "supportclose:" + ticket.id }]] },
    );
    return { ok: true };
  });
