import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendProResellerWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, is_pro_reseller, pro_reseller_cycle_started_at, pro_reseller_cycle_deadline")
      .eq("id", context.userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile?.is_pro_reseller || !profile.pro_reseller_cycle_started_at) {
      throw new Error("Pro Reseller activation is not active");
    }

    const to = String(profile.email || context.claims.email || "").trim().toLowerCase();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { ok: true, sent: false, reason: "NO_EMAIL" };
    }

    const apiKey = process.env["RESEND_API_KEY"] || process.env["RESEND_API_TOKEN"];
    if (!apiKey) throw new Error("Resend is not configured");

    const escapeHtml = (value: string) => value
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const name = String(profile.name || "Reseller");
    const deadline = profile.pro_reseller_cycle_deadline
      ? new Date(profile.pro_reseller_cycle_deadline).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })
      : "15 days from activation";
    const text = `স্বাগতম, ${name}!\n\nঅভিনন্দন! আপনার PANEL BAZAR BD Pro Reseller Dashboard সফলভাবে Active হয়েছে।\nআপনার Pro Reseller সুবিধা এখন ব্যবহার করতে পারবেন।\n\nএই Cycle-এর মেয়াদ: ১৫ দিন\nপরবর্তী Cycle শেষ হবে: ${deadline}\n\nPro Reseller সুবিধা উপভোগ করুন। ধন্যবাদ, PANEL BAZAR BD Team`;
    const html = `<!doctype html><html lang="bn"><body style="margin:0;background:#f3f4f6;padding:32px 12px;font-family:Arial,sans-serif;color:#111827"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px 24px"><div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#059669">PANEL BAZAR BD</div><h1 style="font-size:25px;margin:22px 0 12px">🎉 Welcome to Pro Reseller!</h1><p>স্বাগতম, ${escapeHtml(name)}!</p><p>অভিনন্দন! আপনার <strong>Pro Reseller Dashboard</strong> সফলভাবে Active হয়েছে। এখন থেকে আপনি Pro Reseller-এর বিশেষ সুবিধাগুলো ব্যবহার করতে পারবেন।</p><div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;margin:22px 0"><p style="margin:0 0 8px;color:#047857;font-weight:700">Pro Reseller Activated</p><p style="margin:0">Cycle: <strong>15 Days</strong></p><p style="margin:8px 0 0">Cycle ends: <strong>${escapeHtml(deadline)}</strong></p></div><p>আপনার Pro Reseller যাত্রার জন্য শুভকামনা। আমাদের সঙ্গে থাকার জন্য ধন্যবাদ।</p><p style="margin-top:28px;color:#6b7280;font-size:13px">Regards,<br><strong>PANEL BAZAR BD Team</strong></p></div></body></html>`;

    const idempotencyKey = `pro-reseller-welcome:${profile.id}:${profile.pro_reseller_cycle_started_at}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        from: "PANEL BAZAR BD <verification@panelbazarbd.shop>",
        to: [to],
        subject: "🎉 Welcome to PANEL BAZAR BD Pro Reseller!",
        text,
        html,
      }),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
    if (!response.ok) throw new Error(result.message || result.name || "Welcome email could not be sent");
    return { ok: true, sent: true, id: result.id ?? null };
  });
