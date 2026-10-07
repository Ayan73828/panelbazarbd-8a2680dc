import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSite";
import { playMoneyAdd } from "@/lib/sounds";
import { uddoktapayCreateCharge } from "@/lib/uddoktapay.functions";

export function AddFund({ initialAmount, autoStart }: { initialAmount?: number | undefined; autoStart?: boolean | undefined } = {}) {
  const { settings } = useSettings();
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"auto" | "manual">("auto");
  const [method, setMethod] = useState<"bkash" | "nagad">("bkash");
  const [amount, setAmount] = useState(initialAmount ? String(Math.max(10, Math.ceil(initialAmount))) : "");
  const started = useRef(false);
  const [trx, setTrx] = useState("");
  const [busy, setBusy] = useState(false);
  const number = method === "bkash" ? settings.bkash_number : settings.nagad_number;

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

  const submit = async () => {
    const n = Number(amount);
    if (!(n > 0)) { toast.error("Enter a valid amount"); return; }
    if (!trx.trim()) { toast.error("Enter your TRX ID"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("verify_payment", { p_method: method, p_amount: n, p_trx: trx.trim().toUpperCase() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    playMoneyAdd();
    toast.success(typeof data === "string" && data ? data : "Payment verified — balance added");
    setAmount("");
    setTrx("");
    refresh();
    void qc.invalidateQueries();
  };

  return (
    <div className="panel w-full min-w-0 space-y-3 overflow-hidden p-4">
      <h2 className="font-semibold">Add fund</h2>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-11" variant={tab === "auto" ? "default" : "secondary"} onClick={() => setTab("auto")}>Auto (bKash/Nagad)</Button>
        <Button type="button" className="h-11" variant={tab === "manual" ? "default" : "secondary"} onClick={() => setTab("manual")}>Manual TRX</Button>
      </div>

      {tab === "auto" ? (
        <>
          <p className="text-sm text-muted-foreground">Pay with bKash or Nagad — balance is added automatically after payment.</p>
          {initialAmount ? <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">আপনার ব্যালেন্স কম। প্রোডাক্ট কিনতে ৳{Math.max(10, Math.ceil(initialAmount))} যোগ করুন — পেমেন্ট পেজ খুলছে…</p> : null}
          <Input className="h-11" type="number" inputMode="decimal" placeholder="Amount (min ৳10)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button className="h-11 w-full" disabled={busy} onClick={payAuto}>{busy ? "Starting…" : "Pay now"}</Button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(["bkash", "nagad"] as const).map((m) => (
              <Button key={m} type="button" className="h-11" variant={method === m ? "default" : "secondary"} onClick={() => setMethod(m)}>{m === "bkash" ? "bKash" : "Nagad"}</Button>
            ))}
          </div>
          {number ? (
            <p className="text-sm">Send Money to <b className="text-primary">{number}</b>, then enter the amount and TRX ID below.</p>
          ) : (
            <p className="text-sm text-muted-foreground">This payment number is not set yet. Please contact the admin.</p>
          )}
          <Input className="h-11" type="number" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input className="h-11 uppercase" placeholder="TRX ID" maxLength={64} value={trx} onChange={(e) => setTrx(e.target.value)} />
          <Button className="h-11 w-full" disabled={busy || !number} onClick={submit}>{busy ? "Verifying…" : "Verify & add balance"}</Button>
        </>
      )}
    </div>
  );
}
