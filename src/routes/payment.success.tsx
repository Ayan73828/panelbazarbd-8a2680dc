import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { uddoktapayVerify } from "@/lib/uddoktapay.functions";
import { playMoneyAdd } from "@/lib/sounds";

export const Route = createFileRoute("/payment/success")({
  validateSearch: (s: Record<string, unknown>): { invoice_id?: string | undefined } => ({
    invoice_id: typeof s["invoice_id"] === "string" ? (s["invoice_id"] as string) : undefined,
  }),
  head: () => ({ meta: [{ title: "Payment — PANEL BAZAR BD" }] }),
  component: PaymentSuccess,
});

function PaymentSuccess() {
  const { invoice_id } = Route.useSearch();
  const { user, refresh } = useAuth();
  const [state, setState] = useState<"loading" | "completed" | "pending" | "failed">("loading");
  const [amount, setAmount] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => {
    setReturnTo(sessionStorage.getItem("kr_return_to"));
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!invoice_id) { setState("failed"); setMsg("Missing payment reference."); return; }
    let cancelled = false;
    const run = async () => {
      try {
        const r = await uddoktapayVerify({ data: { invoice_id } });
        if (cancelled) return;
        setAmount(Number(r.amount));
        setMsg(r.message ?? "");
        if (r.status === "completed") {
          setState("completed");
          playMoneyAdd();
          refresh();
        } else if (r.status === "pending") {
          setState("pending");
        } else {
          setState("failed");
        }
      } catch (e) {
        if (!cancelled) {
          setMsg(e instanceof Error ? e.message : "");
          setState("failed");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [invoice_id, user, refresh]);

  useEffect(() => {
    if (state !== "completed") return;
    const t = setTimeout(() => {
      const back = sessionStorage.getItem("kr_return_to");
      sessionStorage.removeItem("kr_return_to");
      window.location.href = back || "/dashboard/wallet";
    }, 3000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <SiteLayout>
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p>Verifying your payment…</p>
          </>
        )}
        {state === "completed" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h1 className="font-display text-2xl font-bold">Payment successful!</h1>
            <p className="text-muted-foreground">৳{amount} has been added to your wallet.</p>
            <p className="text-xs text-muted-foreground">৩ সেকেন্ডের মধ্যে ফিরিয়ে নেওয়া হচ্ছে…</p>
            {returnTo ? (
              <Button className="h-12 w-full" onClick={() => { sessionStorage.removeItem("kr_return_to"); window.location.href = returnTo; }}>Back to product — Buy now</Button>
            ) : null}
            <Button asChild variant={returnTo ? "secondary" : "default"} className="h-12 w-full"><Link to="/dashboard/wallet">Go to Wallet</Link></Button>
          </>
        )}
        {state === "pending" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h1 className="font-display text-xl font-bold">Payment is processing</h1>
            <p className="text-muted-foreground">Your payment is being confirmed. Check your wallet in a minute.</p>
            <Button asChild variant="secondary" className="h-12 w-full"><Link to="/dashboard/wallet">Go to Wallet</Link></Button>
          </>
        )}
        {state === "failed" && (
          <>
            <XCircle className="h-12 w-12 text-destructive" />
            <h1 className="font-display text-xl font-bold">Payment not completed</h1>
            <p className="text-muted-foreground">No money was added. If you paid, contact the admin.</p>
            {msg && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{msg}</p>}
            <Button asChild variant="secondary" className="h-12 w-full"><Link to="/dashboard/wallet">Back to Wallet</Link></Button>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
