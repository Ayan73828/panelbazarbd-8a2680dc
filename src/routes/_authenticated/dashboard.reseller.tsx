import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Crown, Store, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSite";
import { money } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/reseller")({
  component: ResellerDashboard,
});

function ResellerDashboard() {
  const { profile, refresh } = useAuth();
  const { settings } = useSettings();
  const [busy, setBusy] = useState<"normal" | "pro" | "bundle" | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const normalActive = !!profile?.is_reseller;
  const proActive = !!profile?.is_pro_reseller;
  const balance = Number(profile?.balance ?? 0);

  async function activate(kind: "normal" | "pro" | "bundle") {
    if (busy) return;
    if ((kind === "normal" && normalActive) || (kind === "pro" && proActive) || (kind === "bundle" && (normalActive || proActive))) return;
    setBusy(kind);
    try {
      const rpc = kind === "normal"
        ? "activate_reseller_with_coupon"
        : kind === "pro"
          ? "activate_pro_reseller"
          : "activate_reseller_bundle";
      const args = kind === "normal" ? { p_coupon_code: couponCode.trim() || null } : {};
      const { data, error } = await (supabase as any).rpc(rpc, args);
      if (error) throw error;

      if (data === "OK") {
        setCouponCode("");
        await refresh();
        toast.success(kind === "normal" ? "Normal Reseller চালু হয়েছে!" : kind === "pro" ? "Pro Reseller চালু হয়েছে!" : "দুইটি membership চালু হয়েছে!");
      } else if (data === "ALREADY_RESELLER" || data === "ALREADY_PRO_RESELLER" || data === "ALREADY_BOTH") {
        await refresh();
        toast.info("এই membership আগেই চালু আছে।");
      } else if (data === "INSUFFICIENT_BALANCE") {
        toast.error("Wallet balance পর্যাপ্ত নয়।");
      } else {
        toast.error("Activation সম্পন্ন করা যায়নি। Support-এ যোগাযোগ করুন।");
      }
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? error);
      toast.error(
        message.includes("COUPON_INVALID") ? "কুপনটি সঠিক নয় বা নিষ্ক্রিয়।"
          : message.includes("COUPON_EXPIRED") ? "কুপনের মেয়াদ শেষ।"
          : message.includes("COUPON_LIMIT_REACHED") ? "কুপনের ব্যবহারসীমা শেষ।"
          : message.includes("COUPON_MIN_ORDER") ? "এই কুপনের জন্য ন্যূনতম মূল্য পূরণ হয়নি।"
          : message.includes("COUPON_NOT_ELIGIBLE_FOR_RESELLER") ? "এই কুপনটি এখানে প্রযোজ্য নয়।"
          : message.includes("INSUFFICIENT_BALANCE") ? "Wallet balance পর্যাপ্ত নয়।"
          : message || "Activation failed"
      );
    } finally {
      setBusy(null);
    }
  }

  const buttonLabel = (kind: "normal" | "pro" | "bundle", label: string) =>
    busy === kind ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</> : label;

  return (
    <div className="space-y-5">
      <PageHeader title="Reseller Dashboard" description="আপনার পছন্দের membership নির্বাচন করুন।" />
      <div className="panel space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><Wallet className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Current Wallet</p>
            <p className="text-xl font-bold">{money(balance, settings.currency_symbol)}</p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold"><Store className="h-4 w-4 text-primary" /> Normal Reseller</div>
              {normalActive && <span className="flex items-center gap-1 text-sm text-success"><BadgeCheck className="h-4 w-4" /> Active</span>}
            </div>
            {!normalActive ? <>
              <p className="text-sm text-muted-foreground">৳৩০০</p>
              <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Discount coupon (optional)" maxLength={40} />
              <Button className="w-full" onClick={() => activate("normal")} disabled={!!busy}>{buttonLabel("normal", "Activate Normal — ৳৩০০")}</Button>
            </> : <p className="text-sm text-muted-foreground">এই membership চালু আছে।</p>}
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold"><Crown className="h-4 w-4 text-primary" /> Pro Reseller</div>
              {proActive && <span className="flex items-center gap-1 text-sm text-success"><BadgeCheck className="h-4 w-4" /> Active</span>}
            </div>
            {!proActive ? <>
              <p className="text-sm text-muted-foreground">৳২৫০</p>
              <Button className="w-full" onClick={() => activate("pro")} disabled={!!busy}>{buttonLabel("pro", "Activate Pro — ৳২৫০")}</Button>
            </> : <p className="text-sm text-muted-foreground">এই membership চালু আছে।</p>}
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">Normal + Pro Bundle</p>
              {normalActive && proActive && <span className="flex items-center gap-1 text-sm text-success"><BadgeCheck className="h-4 w-4" /> Active</span>}
            </div>
            {!normalActive && !proActive ? <>
              <p className="text-sm text-muted-foreground">দুইটি membership একসঙ্গে — ৳৫০০</p>
              <Button variant="secondary" className="w-full" onClick={() => activate("bundle")} disabled={!!busy}>{buttonLabel("bundle", "Activate Both — ৳৫০০")}</Button>
            </> : normalActive && proActive
              ? <p className="text-sm text-muted-foreground">দুইটি membership-ই চালু আছে।</p>
              : <p className="text-sm text-muted-foreground">আপনার একটি membership ইতিমধ্যে চালু আছে। বাকি membership উপরের অপশন থেকে চালু করুন।</p>}
          </div>
        </div>

        {normalActive && proActive && <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">আপনার সব membership চালু আছে।</div>}
      </div>
      <div className="text-xs text-muted-foreground">Balance কম হলে <Link className="font-semibold text-primary underline" to="/dashboard/wallet">Wallet-এ টাকা যোগ করুন</Link>।</div>
    </div>
  );
}
