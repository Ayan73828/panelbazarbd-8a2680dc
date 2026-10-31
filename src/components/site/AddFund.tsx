import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { uddoktapayCreateCharge } from "@/lib/uddoktapay.functions";

const NORMAL_MIN = 50;
const PRESETS = [50, 100, 500, 1000];

export function AddFund({ initialAmount, autoStart, indianPaymentLink }: { initialAmount?: number | undefined; autoStart?: boolean | undefined; indianPaymentLink?: string | undefined } = {}) {
  const { profile, profileLoading } = useAuth();
  const minDeposit = profile?.is_pro_reseller ? 500 : NORMAL_MIN;
  const fromProduct = !!initialAmount;
  const requiredAmount = initialAmount ? Math.max(minDeposit, Math.ceil(initialAmount)) : undefined;
  const [amount, setAmount] = useState(requiredAmount ? String(requiredAmount) : "");
  const started = useRef(false);
  const [busy, setBusy] = useState(false);

  const pay = async (value: number) => {\n    if (profileLoading) { toast.error("অ্যাকাউন্ট তথ্য লোড হচ্ছে, একটু অপেক্ষা করুন"); return; }
    if (!(Number.isFinite(value) && value >= minDeposit)) {
      toast.error(`কমপক্ষে ৳${minDeposit} ডিপোজিট করতে হবে`);
      return;
    }
    setBusy(true);
    try {
      const r = await uddoktapayCreateCharge({ data: { amount: value, origin: window.location.origin } });
      window.location.href = r.payment_url;
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not start payment");
    }
  };

  useEffect(() => {
    if (!profileLoading && autoStart && initialAmount && !started.current) {
      started.current = true;
      void pay(Math.max(minDeposit, Math.ceil(initialAmount)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialAmount, minDeposit, profileLoading]);

  const presets = profile?.is_pro_reseller ? [500, 1000, 2000, 5000] : PRESETS;

  return (
    <div className="panel w-full min-w-0 space-y-3 overflow-hidden p-4">
      <h2 className="font-semibold">Add fund</h2>
      <p className="text-sm text-muted-foreground">bKash / Nagad / Binance Pay দিয়ে পেমেন্ট করুন — ব্যালেন্স অটো যোগ হবে।</p>
      {fromProduct ? (
        <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">প্রোডাক্ট কিনতে ব্যালেন্স কম। ${`প্রোডাক্টের মূল্য বা সর্বনিম্ন ৳${minDeposit} — যেটি বেশি, সেই পরিমাণ যোগ করতে হবে; ৳${requiredAmount} টাকার পেমেন্ট পেজ খুলছে…`}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {presets.map((v) => (
            <Button key={v} variant="secondary" className="h-12 font-semibold" disabled={busy} onClick={() => pay(v)}>৳{v}</Button>
          ))}
        </div>
      )}
      {indianPaymentLink ? <Button asChild variant="outline" className="h-11 w-full rounded-full"><a href={indianPaymentLink} target="_blank" rel="noreferrer">Indian Payment / UPI</a></Button> : null}
      <Input className="h-11" type="number" min={minDeposit} inputMode="numeric" placeholder={`অন্য পরিমাণ (সর্বনিম্ন ৳${minDeposit})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <p className="text-xs font-medium text-muted-foreground"> {profile?.is_pro_reseller ? "Pro Reseller-এর জন্য একবারে সর্বনিম্ন ৳৫০০ Deposit করতে হবে।" : "সর্বনিম্ন ডিপোজিট ৳৫০।"}</p>
      <Button className="h-11 w-full" disabled={busy} onClick={() => pay(Number(amount))}>{busy ? "Starting…" : "Pay now"}</Button>
    </div>
  );
}
