import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uddoktapayCreateCharge } from "@/lib/uddoktapay.functions";

const MIN = 100;
const PRESETS = [100, 500, 1000];

export function AddFund({ initialAmount, autoStart }: { initialAmount?: number | undefined; autoStart?: boolean | undefined } = {}) {
  // When coming from a product purchase, the exact shortfall is allowed (no minimum).
  const fromProduct = !!initialAmount;
  const [amount, setAmount] = useState(initialAmount ? String(Math.max(1, Math.ceil(initialAmount))) : "");
  const started = useRef(false);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"local" | "binance">("local");

  const pay = async (value: number, allowAny = false) => {
    if (!(value >= (allowAny ? 1 : MIN))) { toast.error(`কমপক্ষে ৳${MIN} দিন`); return; }
    if (method === "binance") { toast.error("Binance Pay এখনো সংযুক্ত করা হয়নি; merchant/API configuration প্রয়োজন।"); return; }
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
      void pay(Math.ceil(initialAmount), true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialAmount]);

  return (
    <div className="panel w-full min-w-0 space-y-3 overflow-hidden p-4">
      <h2 className="font-semibold">Add fund</h2>
      <p className="text-sm text-muted-foreground">পেমেন্ট সফলভাবে যাচাই হলে ব্যালেন্স অটো যোগ হবে।</p>
      {!fromProduct && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setMethod("local")} className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${method === "local" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>bKash / Nagad</button><button type="button" onClick={() => setMethod("binance")} className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${method === "binance" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>Binance Pay</button></div>}
      {method === "binance" && !fromProduct && <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-muted-foreground">Binance Pay চালু করতে merchant/API credentials ও server-side verification যুক্ত করতে হবে।</p>}
      {fromProduct ? (
        <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">প্রোডাক্ট কিনতে ৳{Math.ceil(initialAmount!)} প্রয়োজন — পেমেন্ট পেজ খুলছে…</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((v) => (
            <Button key={v} variant="secondary" className="h-12 font-semibold" disabled={busy} onClick={() => pay(v)}>৳{v}</Button>
          ))}
        </div>
      )}
      <Input className="h-11" type="number" inputMode="decimal" placeholder={fromProduct ? "Amount" : `অন্য পরিমাণ (min ৳${MIN})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Button className="h-11 w-full" disabled={busy} onClick={() => pay(Number(amount), fromProduct)}>{busy ? "Starting…" : "Pay now"}</Button>
    </div>
  );
}
