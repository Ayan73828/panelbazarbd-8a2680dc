import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment/cancel")({
  head: () => ({ meta: [{ title: "Payment Cancelled — PANEL BAZAR BD" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PaymentCancel,
});

function PaymentCancel() {
  return (
    <SiteLayout>
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
        <XCircle className="h-12 w-12 text-destructive" />
        <h1 className="font-display text-xl font-bold">Payment cancelled</h1>
        <p className="text-muted-foreground">You cancelled the payment. No money was taken.</p>
        <Button asChild className="h-12 w-full"><Link to="/dashboard/wallet">Back to Wallet</Link></Button>
      </div>
    </SiteLayout>
  );
}
