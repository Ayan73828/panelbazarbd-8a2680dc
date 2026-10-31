import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Wallet, Loader2, ChevronDown } from "lucide-react";
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

type PackageKind = "normal" | "pro" | "bundle";

function ResellerDashboard() {
  const { profile, refresh } = useAuth();
  const { settings } = useSettings();
  const [selected, setSelected] = useState<PackageKind | null>(null);
  const [busy, setBusy] = useState<PackageKind | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const normalActive = !!profile?.is_reseller;
  const proActive = !!profile?.is_pro_reseller;
  const proPurchased = !!profile?.pro_reseller_package_purchased;
  const [proStatus, setProStatus] = useState<any>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setClock(Date.now()), 30_000); return () => window.clearInterval(id); }, []);
  useEffect(() => { if (!proPurchased) { setProStatus(null); return; } let live = true; const load = async () => { const { data, error } = await (supabase as any).rpc("get_pro_reseller_activation_status"); if (!error && live) setProStatus(data); }; void load(); const id = window.setInterval(() => { void load(); void refresh(); }, 30_000); return () => { live = false; window.clearInterval(id); }; }, [proPurchased, refresh]);
  const deadline = profile?.pro_reseller_cycle_deadline ? new Date(profile.pro_reseller_cycle_deadline).getTime() : 0;
  const remainingMs = Math.max(0, deadline - clock);
  const remainingDays = Math.floor(remainingMs / 86_400_000);
  const remainingHours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
  const remainingMinutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  const balance = Number(profile?.balance ?? 0);
  const currency = settings.currency_symbol || "৳";
  const prices: Record<PackageKind, number> = {
    normal: normalActive ? 0 : 300,
    pro: proActive || proPurchased ? 0 : 250,
    bundle: normalActive && (proActive || proPurchased) ? 0 : normalActive ? (proPurchased ? 0 : 250) : (proActive || proPurchased) ? 300 : 500,
  };
  const selectedPrice = selected ? prices[selected] : 0;

  function choose(kind: PackageKind) {
    setSelected(kind);
    setCouponCode("");
    setCouponApplied(null);
    setCouponOpen(false);
  }

  async function pasteCoupon() {
    try {
      if (!navigator.clipboard?.readText) {
        toast.error("Paste করতে input-এ চাপ দিয়ে Paste নির্বাচন করুন");
        return;
      }
      const pasted = (await navigator.clipboard.readText()).trim();
      if (!pasted) { toast.error("Clipboard-এ কোনো coupon code নেই"); return; }
      setCouponCode(pasted.toUpperCase());
      setCouponApplied(null);
      toast.success("Coupon code paste হয়েছে");
    } catch {
      toast.error("Paste permission না পেলে input-এ চাপ দিয়ে Paste নির্বাচন করুন");
    }
  }

  async function applyCoupon() {
    if (!selected || !selectedPrice) return;
    const code = couponCode.trim().toUpperCase();
    if (!code) { toast.error("Discount coupon code লিখুন"); return; }
    setCouponBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("validate_discount_coupon", {
        p_code: code, p_subtotal: selectedPrice,
      });
      if (error) throw error;
      setCouponApplied(data);
      setCouponCode(code);
      toast.success("Coupon " + code + " apply হয়েছে");
    } catch (e: any) {
      setCouponApplied(null);
      const msg = String(e?.message || "");
      const minMatch = msg.match(/COUPON_MIN_ORDER:([0-9.]+)/);
      toast.error(msg.includes("COUPON_EXPIRED") ? "এই coupon-এর মেয়াদ শেষ"
        : msg.includes("COUPON_LIMIT_REACHED") ? "Coupon ব্যবহারের সীমা শেষ"
        : msg.includes("COUPON_NOT_ELIGIBLE_FOR_RESELLER") ? "এই coupon reseller dashboard-এ প্রযোজ্য নয়"
        : minMatch ? "এই coupon ব্যবহার করতে ন্যূনতম ৳" + minMatch[1] + " লাগবে"
        : "Coupon সঠিক নয় বা বর্তমানে চালু নেই");
    } finally { setCouponBusy(false); }
  }

  async function activate(kind: PackageKind) {
    if (busy || !selected || selected !== kind) return;
    if (kind === "pro" && !normalActive) { toast.error("Pro Dashboard চালু করতে আগে Normal Reseller Dashboard Active থাকতে হবে। দুটো একসঙ্গে নিতে Bundle নির্বাচন করুন।"); return; }
    if (kind === "normal" && normalActive) return;
    if (kind === "pro" && proActive) return;
    if (kind === "pro" && !normalActive) { toast.error("আগে Normal Reseller Dashboard Active করুন অথবা Normal + Pro Bundle নিন।"); return; }
    if (kind === "bundle" && normalActive && proActive) return;
    setBusy(kind);
    try {
      const rpc = kind === "normal" ? "activate_reseller_with_coupon"
        : kind === "pro" ? "activate_pro_reseller" : "activate_reseller_bundle";
      const args = { p_coupon_code: couponApplied?.code ?? null };
      const { data, error } = await (supabase as any).rpc(rpc, args);
      if (error) throw error;
      if (data === "OK") {
        setCouponCode("");
        setCouponApplied(null);
        await refresh();
        if (kind === "pro") toast.success("Pro প্যাকেজ কেনা হয়েছে। Access চালু করতে নতুন ৳৫০০ Deposit করে Verify করুন।");
        else if (kind === "bundle") toast.success(proActive ? "Normal Reseller চালু হয়েছে! আপনার Pro Access আগেই Active আছে।" : "Normal Reseller চালু হয়েছে। Pro Access পেতে ৳৫০০ Deposit করে Verify করুন।");
        else toast.success("Normal Reseller চালু হয়েছে!");
      } else if (data === "NORMAL_RESELLER_REQUIRED") {
        toast.error("Pro Dashboard চালু করতে আগে Normal Reseller Dashboard Active করুন, অথবা Normal + Pro Bundle নিন।");
      } else if (data === "NORMAL_RESELLER_REQUIRED") {
        toast.error("Pro Dashboard চালু করতে আগে Normal Reseller Dashboard Active থাকতে হবে। Normal + Pro Bundle নিতে পারেন।");
      } else if (data === "PRO_PACKAGE_PENDING") {
        await refresh();
        toast.info("Pro প্যাকেজ আগেই কেনা আছে। ৳৫০০ Deposit করে Verify করুন।");
      } else if (["ALREADY_RESELLER", "ALREADY_PRO_RESELLER", "ALREADY_BOTH"].includes(data)) {
        await refresh();
        toast.info("এই membership আগেই চালু আছে।");
      } else if (data === "INSUFFICIENT_BALANCE") {
        toast.error("Wallet balance পর্যাপ্ত নয়।");
      } else {
        toast.error("Activation সম্পন্ন করা যায়নি। Support-এ যোগাযোগ করুন।");
      }
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? error);
      toast.error(message.includes("COUPON_INVALID") ? "কুপনটি সঠিক নয় বা নিষ্ক্রিয়।"
        : message.includes("COUPON_EXPIRED") ? "কুপনের মেয়াদ শেষ।"
        : message.includes("COUPON_LIMIT_REACHED") ? "কুপনের ব্যবহারসীমা শেষ।"
        : message.includes("COUPON_MIN_ORDER") ? "কুপনের ন্যূনতম মূল্য পূরণ হয়নি।"
        : message.includes("COUPON_NOT_ELIGIBLE_FOR_RESELLER") ? "এই কুপনটি এখানে প্রযোজ্য নয়।"
        : message || "Activation failed");
    } finally { setBusy(null); }
  }

  const choices: { id: PackageKind; title: string; description: string }[] = [
    { id: "normal", title: "Normal Reseller Dashboard", description: "Normal reseller সুবিধা" },
    { id: "pro", title: "Pro Reseller Dashboard", description: "Pro reseller সুবিধা" },
    { id: "bundle", title: "Normal + Pro Both", description: "দুইটি membership একসঙ্গে" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><PageHeader title="Reseller Dashboard" description="আপনার পছন্দের membership নির্বাচন করুন।" /></div>{proActive && <div className="shrink-0 rounded-xl border border-border bg-surface-2 px-3 py-2 text-right text-xs">{profile?.pro_reseller_verified ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><BadgeCheck className="h-4 w-4" /> Pro Reseller Verified</span> : <><p className="font-semibold text-foreground">৳৫০০ Deposit বাকি</p><p className="mt-1 text-muted-foreground">{deadline && remainingMs > 0 ? `${remainingDays} দিন ${remainingHours} ঘণ্টা ${remainingMinutes} মিনিট বাকি` : "সময় শেষ — status update হচ্ছে"}</p></>}</div>}</div>
      <div className="panel space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><Wallet className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Current Wallet</p>
            <p className="text-xl font-bold">{money(balance, currency)}</p>
          </div>
        </div>

        {proPurchased && <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="font-bold">Pro Reseller Activation</h3><span className={`rounded-full px-2 py-1 text-xs font-semibold ${proActive ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{proActive ? "Active" : "Activation Pending"}</span></div>
          <p className="text-sm text-muted-foreground">{!normalActive ? "Pro Access চালু করার আগে Normal Reseller Dashboard Active করুন অথবা Normal + Pro Bundle নিন।" : proActive ? "পরবর্তী ১৫ দিনের Cycle চালু রাখতে নতুন করে ৳৫০০ Deposit করে Verify করুন।" : proStatus?.cycle_started_at ? "পরবর্তী Cycle-এর জন্য নতুন করে ৳৫০০ Deposit প্রয়োজন।" : "প্রথমবার Pro Access চালু করতে Wallet Balance কমপক্ষে ৳৫০০ থাকতে হবে."}</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-background p-2"><p className="text-muted-foreground">Required</p><p className="mt-1 font-bold">৳৫০০</p></div><div className="rounded-lg bg-background p-2"><p className="text-muted-foreground">{proStatus?.cycle_started_at ? "New deposits" : "Wallet balance"}</p><p className="mt-1 font-bold">{money(Number(proStatus?.deposited ?? 0), currency)}</p></div><div className="rounded-lg bg-background p-2"><p className="text-muted-foreground">Still short</p><p className="mt-1 font-bold text-destructive">{money(Number(proStatus?.short ?? 500), currency)}</p></div></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, Number(proStatus?.deposited ?? 0) / 5))}%` }} /></div>
          {Number(proStatus?.short ?? 500) > 0 && <p className="text-sm font-medium text-destructive">{proStatus?.cycle_started_at ? "এই Cycle-এ" : "Wallet-এ"} আরও {money(Number(proStatus?.short ?? 500), currency)} {proStatus?.cycle_started_at ? "নতুন Deposit" : "যোগ"} করা বাকি। সর্বনিম্ন ৳৫০ করে Deposit করতে পারবেন।</p>}
          <div className="flex flex-col gap-2 sm:flex-row"><Button asChild variant="outline" className="flex-1"><Link to="/dashboard/wallet">Add Balance</Link></Button><Button className="flex-1" disabled={verifyBusy || !normalActive || Number(proStatus?.short ?? 500) > 0} onClick={async () => { setVerifyBusy(true); try { const { data, error } = await (supabase as any).rpc("verify_pro_reseller_deposit"); if (error) throw error; if (data?.status === "ACTIVATED") { await refresh(); const { data: status } = await (supabase as any).rpc("get_pro_reseller_activation_status"); setProStatus(status); toast.success("Pro Reseller Access চালু হয়েছে! নতুন ১৫ দিনের Cycle শুরু হয়েছে।"); } else if (data?.status === "SHORT") { setProStatus(data); toast.error(`আরও ৳${Number(data.short).toFixed(2)} Deposit প্রয়োজন।`); } else if (data?.status === "NORMAL_RESELLER_REQUIRED") { toast.error("আগে Normal Reseller Dashboard Active করুন অথবা Normal + Pro Bundle নিন।"); } else toast.error("Verification সম্পন্ন হয়নি। আবার চেষ্টা করুন।"); } catch (e: any) { toast.error(e?.message || "Verification failed"); } finally { setVerifyBusy(false); } }}>{verifyBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : proActive ? "Verify & Renew 15-Day Cycle" : "Verify Account & Activate Pro"}</Button></div>
          {proActive && deadline > 0 && <p className="text-xs text-muted-foreground">বর্তমান Cycle শেষ হবে: {new Date(deadline).toLocaleString()}</p>}
        </div>}

        <Button className="w-full justify-between" variant="outline" onClick={() => setShowPackages(v => !v)}>
          <span>Upgrade to Reseller Dashboard</span>
          <ChevronDown className={showPackages ? "h-4 w-4 rotate-180 transition-transform" : "h-4 w-4 transition-transform"} />
        </Button>

        {showPackages && <div className="space-y-3">
          <div className="grid gap-2">
            {choices.map((choice) => {
              const active = choice.id === "normal" ? normalActive
                : choice.id === "pro" ? proActive : normalActive && proActive;
              const locked = choice.id === "pro" && !normalActive && !proPurchased;
              return <button key={choice.id} type="button" disabled={locked} onClick={() => choose(choice.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${locked ? "cursor-not-allowed opacity-50" : ""} ${selected === choice.id ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{choice.title}</span>
                  {active && <span className="flex items-center gap-1 text-xs text-success"><BadgeCheck className="h-4 w-4" /> Active</span>}
                  {choice.id === "pro" && proPurchased && !proActive && <span className="text-xs font-semibold text-amber-600">Activation Pending</span>}
                  {selected === choice.id && !active && <span className="text-xs font-semibold text-primary">Selected</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{choice.description}</p>
                {blocked && <p className="mt-1 text-xs font-medium text-destructive">আগে Normal Reseller Dashboard Active করুন অথবা Normal + Pro Bundle নির্বাচন করুন।</p>}
                {locked && <p className="mt-2 text-xs font-medium text-amber-600">আগে Normal Reseller Dashboard চালু করুন অথবা Normal + Pro Bundle নিন।</p>}
              </button>;
            })}
          </div>

          {selected && <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{choices.find(x => x.id === selected)?.title}</div>
              {((selected === "normal" && normalActive) || (selected === "pro" && proActive) || (selected === "bundle" && normalActive && proActive))
                && <span className="text-xs text-success">Already Active</span>}
            </div>
            {selected === "bundle" && !normalActive && !proActive && <p className="text-xs font-medium text-emerald-600">একসাথে Normal + Pro নিলে ৳৫০ ছাড় — আলাদা দাম ৳৫৫০, Bundle ৳৫০০। Normal সঙ্গে সঙ্গে Active হবে; Pro চালু হবে ৳৫০০ activation eligibility ও Verify সম্পন্ন হলে।</p>}
            {selected === "pro" && !normalActive && <p className="text-xs font-medium text-destructive">Pro Dashboard কিনতে হলে আগে Normal Reseller Dashboard Active থাকতে হবে। Bundle নির্বাচন করে একসঙ্গে নিতে পারবেন।</p>}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Package price</span>
              <span className="text-xl font-bold text-primary">{money(selectedPrice, currency)}</span>
            </div>

            {selectedPrice > 0 && <div className="space-y-2">
              {couponApplied ? (
                <div className="flex items-center justify-between gap-2 text-xs text-emerald-600">
                  <span>Coupon {couponApplied.code} applied · −{money(Number(couponApplied.discount), currency)}</span>
                  <button type="button" className="text-muted-foreground underline" onClick={() => { setCouponApplied(null); setCouponCode(""); }}>Remove</button>
                </div>
              ) : <>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => setCouponOpen(v => !v)} className="text-xs font-medium text-primary underline underline-offset-2">
                    {couponOpen ? "Hide discount coupon" : "I have a discount coupon"}
                  </button>
                </div>
                {couponOpen && <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Input value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponApplied(null); }} placeholder="Coupon code" maxLength={40} className="h-9 uppercase" />
                    <Button type="button" size="sm" variant="ghost" className="h-9 px-2" onClick={() => void pasteCoupon()}>Paste</Button>
                    <Button type="button" size="sm" variant="secondary" className="h-9 px-3" disabled={couponBusy || !couponCode.trim()} onClick={() => void applyCoupon()}>{couponBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}</Button>
                  </div>
                </div>}
              </>}
              {couponApplied && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Payable after coupon</span><span className="font-bold text-primary">{money(Number(couponApplied.total), currency)}</span></div>}
              <Button className="w-full" onClick={() => void activate(selected)} disabled={!!busy || (selected === "normal" && normalActive) || (selected === "pro" && (proActive || !normalActive)) || (selected === "bundle" && normalActive && proActive)}>
                {busy === selected ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</> : "Activate " + (selected === "normal" ? "Normal" : selected === "pro" ? "Pro" : "Both") + " — " + money(Number(couponApplied?.total ?? selectedPrice), currency)}
              </Button>
            </div>}
            {selectedPrice === 0 && <p className="text-sm text-muted-foreground">{selected === "pro" && proPurchased && !proActive ? "Pro প্যাকেজ কেনা আছে। উপরের Activation Task সম্পন্ন করুন।" : "এই membership ইতিমধ্যে চালু আছে।"}</p>}
          </div>}
        </div>}

        {normalActive && proActive && <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">আপনার সব membership চালু আছে।</div>}
      </div>
      <div className="panel space-y-3 p-4">
        <h3 className="font-bold">Pro Reseller Benefits</h3>
        <ul className="list-disc space-y-2 pl-5 text-sm"><li>প্রতি মাসের ১ তারিখে যেকোনো ধরনের Panel ৭ দিনের জন্য সম্পূর্ণ ফ্রিতে পাবেন (বালা মোড ও Troll মোড ছাড়া)।</li><li>Panel-এর Device / Key Reset সুবিধা — আপনি যেকোনো সময় নিজের Panel-এর Device বা Key Reset করতে পারবেন।</li><li>Pro Reseller-এর বিশেষ Discount সুবিধা।</li><li>আপনার অ্যাকাউন্টে Pro Reseller Verified Badge দেখাবে।</li></ul>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><p className="font-bold text-destructive">গুরুত্বপূর্ণ নিয়ম</p><ul className="mt-2 list-disc space-y-1 pl-5 text-destructive"><li>Pro Dashboard প্যাকেজ মূল্য ৳২৫০; প্যাকেজ কিনলেই Pro Access চালু হবে না।</li><li>Activation ও প্রতি ১৫ দিনের নতুন Cycle-এর জন্য নতুন করে মোট ৳৫০০ Deposit করে Verify করতে হবে। আগের Cycle-এর Deposit গণনা হবে না।</li><li>প্রতিটি Deposit-এর সর্বনিম্ন পরিমাণ ৳৫০। একাধিক Deposit যোগ হয়ে ৳৫০০ পূর্ণ হতে পারবে।</li><li>Verify করার সময় কোনো টাকা Wallet থেকে কাটা হবে না।</li><li>১৫ দিনের মধ্যে নতুন ৳৫০০ Deposit করে Verify না করলে Pro Access বন্ধ হয়ে Normal Reseller Dashboard-এ Downgrade হবে। পরে নতুন ৳৫০০ Deposit করে আবার Pro চালু করতে পারবেন।</li></ul></div>
      </div>
      <div className="text-xs text-muted-foreground">Balance কম হলে <Link className="font-semibold text-primary underline" to="/dashboard/wallet">Wallet-এ টাকা যোগ করুন</Link>।</div>
    </div>
  );
}
