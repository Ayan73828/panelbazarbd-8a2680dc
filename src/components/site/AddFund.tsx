import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uddoktapayCreateCharge } from "@/lib/uddoktapay.functions";

const MIN = 50;
const PRESETS = [50, 100, 500, 1000];

export function AddFund({ initialAmount, autoStart, indianPaymentLink }: { initialAmount?: number | undefined; autoStart?: boolean | undefined; indianPaymentLink?: string | undefined } = {}) {
  const fromProduct = !!initialAmount;
  const requiredAmount = initialAmount ? Math.max(MIN, Math.ceil(initialAmount)) : undefined;
  const [amount, setAmount] = useState(requiredAmount ? String(requiredAmount) : "");
  const started = useRef(false);
  const [busy, setBusy] = useState(false);

  const pay = async (value: number) => {
    if (!(Number.isFinite(value) && value >= MIN)) { toast.error(`কমপক্ষে ৳${MIN} ডিপোজিট করতে হবে`); return; }
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
    if (autoStart && initialAmount && !started.current) {
      started.current = true;
      void pay(Math.max(MIN, Math.ceil(initialAmount)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialAmount]);

  return (
    <div className="panel w-full min-w-0 space-y-3 overflow-hidden p-4">
      <h2 className="font-semibold">Add fund</h2>
      <p className="text-sm text-muted-foreground">bKash / Nagad / Binance Pay দিয়ে পেমেন্ট করুন — ব্যালেন্স অটো যোগ হবে।</p>
      {fromProduct ? (
        <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">প্রোডাক্ট কিনতে ব্যালেন্স কম। সর্বনিম্ন ৳{MIN} যোগ করতে হবে; ৳{requiredAmount} টাকার পেমেন্ট পেজ খুলছে…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((v) => (
            <Button key={v} variant="secondary" className="h-12 font-semibold" disabled={busy} onClick={() => pay(v)}>৳{v}</Button>
          ))}
        </div>
      )}
      {indianPaymentLink ? <Button asChild variant="outline" className="h-11 w-full rounded-full"><a href={indianPaymentLink} target="_blank" rel="noreferrer">Indian Payment / UPI</a></Button> : null}
      <Input className="h-11" type="number" min={MIN} inputMode="numeric" placeholder={`অন্য পরিমাণ (সর্বনিম্ন ৳${MIN})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <p className="text-xs font-medium text-muted-foreground">আপনি ৳৫০-এর কম ডিপোজিট করতে পারবেন না। সর্বনিম্ন ডিপোজিট ৳৫০।</p>
      <Button className="h-11 w-full" disabled={busy} onClick={() => pay(Number(amount))}>{busy ? "Starting…" : "Pay now"}</Button>
    </div>
  );
}
