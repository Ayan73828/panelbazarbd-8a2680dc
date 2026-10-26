import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Store, Wallet, Percent, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
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
  const [busy, setBusy] = useState(false);
  const active = !!profile?.is_reseller;
  const balance = Number(profile?.balance ?? 0);

  async function activate() {
    if (busy || active) return;
    if (balance < 300) {
      toast.error("Reseller upgrade-এর জন্য Wallet-এ কমপক্ষে ৳৩০০ রাখুন।");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("activate_reseller");
      if (error) throw error;
      if (data === "OK") {
        refresh();
        toast.success("Reseller Dashboard চালু হয়েছে!");
      } else if (data === "ALREADY_RESELLER") {
        refresh();
        toast.info("আপনার Reseller status আগেই চালু আছে।");
      } else if (data === "INSUFFICIENT_BALANCE") {
        toast.error("Wallet balance পর্যাপ্ত নয়।");
      } else {
        toast.error("Upgrade সম্পন্ন করা যায়নি। Support-এ যোগাযোগ করুন।");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upgrade failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Reseller Dashboard" description="Reseller membership ও সুবিধা পরিচালনা করুন।" />
      <div className="panel space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><Store className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{active ? "Reseller membership active" : "Upgrade to Reseller"}</h2>
            <p className="text-sm text-muted-foreground">{active ? "আপনার অ্যাকাউন্টে Reseller status চালু আছে।" : "একবারের activation fee ৳৩০০।"}</p>
          </div>
          {active && <BadgeCheck className="h-6 w-6 text-primary" />}
        </div>
        <div className={active ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
          <div className="rounded-xl border border-border p-3">
            <Wallet className="mb-2 h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Current Wallet</p>
            <p className="font-bold">{money(balance, settings.currency_symbol)}</p>
          </div>
          {active && (
            <div className="rounded-xl border border-border p-3">
              <Percent className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Reseller discount</p>
              <p className="font-bold">{profile?.reseller_discount_percent ?? 7}%</p>
            </div>
          )}
        </div>
        {!active ? (
          <>
            <p className="text-sm text-muted-foreground">Upgrade করলে Wallet থেকে ৳৩০০ কাটা হবে এবং Reseller status চালু হবে।</p>
            {balance < 300 && <div className="rounded-lg bg-muted p-3 text-sm">আপনার Wallet-এ আরও ৳{Math.ceil(300 - balance)} দরকার। <Link className="font-semibold text-primary underline" to="/dashboard/wallet">Wallet-এ টাকা যোগ করুন</Link></div>}
            <Button className="w-full" onClick={activate} disabled={busy || balance < 300}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</> : "Upgrade Now — ৳৩০০"}
            </Button>
          </>
        ) : (
          <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">আপনার Reseller membership active.</div>
        )}
      </div>
      {active && <p className="text-xs text-muted-foreground">নোট: activation fee সফলভাবে কাটা হলেই status চালু হবে। Reseller Dashboard active থাকলে eligible পণ্যে ৭% discount পাবেন। Auto-provider পণ্যে এই discount প্রযোজ্য নয়।</p>}
    </div>
  );
}
