import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uddoktapayCreateCharge } from "@/lib/uddoktapay.functions";

export function AddFund({ initialAmount, autoStart }: { initialAmount?: number | undefined; autoStart?: boolean | undefined } = {}) {
  const [amount, setAmount] = useState(initialAmount ? String(Math.max(10, Math.ceil(initialAmount))) : "");
  const started = useRef(false);
  const [busy, setBusy] = useState(false);

  const payAuto = async () => {
    const n = Number(amount);
    if (!(n >= 10)) { toast.error("কমপক্ষে ৳10 দিন"); return; }
    setBusy(true);
    try {
      const r = await uddoktapayCreateCharge({
        data: { amount: n, origin: window.location.origin },
      });
      window.location.href = r.payment_url;
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not start payment");
    }
  };

  useEffect(() => {
    if (autoStart && initialAmount && !started.current) {
      started.current = true;
      void payAuto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialAmount]);

  return (
    <div className="panel w-full min-w-0 space-y-3 overflow-hidden p-4">
      <h2 className="font-semibold">Add fund</h2>
      <p className="text-sm text-muted-foreground">Pay with bKash or Nagad — balance is added automatically after payment.</p>
      {initialAmount ? <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">আপনার ব্যালেন্স কম। প্রোডাক্ট কিনতে ৳{Math.max(10, Math.ceil(initialAmount))} যোগ করুন — পেমেন্ট পেজ খুলছে…</p> : null}
      <Input className="h-11" type="number" inputMode="decimal" placeholder="Amount (min ৳10)" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Button className="h-11 w-full" disabled={busy} onClick={payAuto}>{busy ? "Starting…" : "Pay now"}</Button>
    </div>
  );
}
