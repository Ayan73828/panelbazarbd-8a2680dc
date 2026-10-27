import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { AddFund } from "@/components/site/AddFund";
import { MessageCircle, Send } from "lucide-react";
import { PageHeader } from "@/components/site/SiteLayout";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/site/States";
import { TxList } from "@/components/site/TxList";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyTransactions } from "@/hooks/useMyData";
import { useSettings } from "@/hooks/useSite";
import { money, tgLink, waLink } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/dashboard/wallet")({
  validateSearch: (s: Record<string, unknown>): { amount?: number | undefined; auto?: boolean | undefined } => {
    const n = Number(s["amount"]);
    return { amount: Number.isFinite(n) && n > 0 ? n : undefined, auto: s["auto"] === true || s["auto"] === "1" || s["auto"] === 1 ? true : undefined };
  },
  component: WalletPage,
});

function WalletPage() {
  const { profile, refresh } = useAuth();
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const redeem = async () => {
    const code = redeemCode.trim();
    if (!code) { toast.error("Redeem code লিখুন"); return; }
    setRedeeming(true);
    try {
      const { data, error } = await (supabase as any).rpc("redeem_code", { p_code: code });
      if (error) throw error;
      const result = data as { success?: boolean; amount?: number; balance?: number } | null;
      if (!result?.success) throw new Error("Redeem code গ্রহণ করা যায়নি");
      toast.success(`৳${Number(result.amount ?? 0).toFixed(2)} ব্যালেন্স যোগ হয়েছে`);
      setRedeemCode("");
      refresh();
      await txs.refetch();
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? error);
      toast.error(message.includes("REDEEM_CODE_USED") ? "এই কোডটি ইতিমধ্যে ব্যবহার হয়েছে" : message.includes("REDEEM_CODE_EXPIRED") ? "এই কোডের মেয়াদ শেষ" : message.includes("INVALID_REDEEM_CODE") ? "Redeem code সঠিক নয়" : "কোড রিডিম করা যায়নি। আবার চেষ্টা করুন।");
    } finally { setRedeeming(false); }
  };
  const { amount, auto } = Route.useSearch();
  const { settings } = useSettings();
  const txs = useMyTransactions();
  const wa = waLink(settings.whatsapp_number, `Hi, I want to add balance. My username: ${profile?.username ?? profile?.email ?? ""}`);
  const tg = tgLink(settings.telegram_username);
  const indianPaymentMessage = [
    "Hello Panel Bazar, I want to make a deposit using Indian Payment / UPI. Please help me with the payment process.",
    `My username: ${profile?.username ?? profile?.email ?? "Not available"}`,
  ].join("\n");
  const indianPaymentLink = tg ? `${tg}?text=${encodeURIComponent(indianPaymentMessage)}` : "";
  return (
    <div className="space-y-6">
      <PageHeader title="Wallet" description="Your balance and transaction history." />
      <div className="panel w-full min-w-0 overflow-hidden p-4">
        <p className="text-sm text-muted-foreground">Current balance</p>
        <p className="font-display break-all text-3xl font-bold text-primary">{money(profile?.balance, settings.currency_symbol)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {wa && <Button asChild size="sm" className="rounded-full"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" /> WhatsApp</a></Button>}
          {tg && <Button asChild size="sm" variant="secondary" className="rounded-full"><a href={tg} target="_blank" rel="noreferrer"><Send className="mr-1 h-4 w-4" /> Telegram</a></Button>}
        </div>
      </div>
      <div className="panel space-y-3 p-4">
        <div className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /><h2 className="font-semibold">Indian Payment / UPI</h2></div>
        <p className="text-sm text-muted-foreground">ভারতীয় পেমেন্ট বা UPI দিয়ে ব্যালেন্স যোগ করতে Telegram-এ আমাদের মেসেজ পাঠান। মেসেজটি আগে থেকেই লেখা থাকবে—আপনাকে শুধু Send চাপতে হবে।</p>
        {indianPaymentLink ? (
          <Button asChild className="w-full rounded-full">
            <a href={indianPaymentLink} target="_blank" rel="noreferrer"><Send className="mr-2 h-4 w-4" /> Indian Payment / UPI</a>
          </Button>
        ) : (
          <p className="text-sm text-destructive">Telegram username সেট করা নেই। Admin Settings-এ Telegram username যোগ করুন।</p>
        )}
      </div>
      <AddFund initialAmount={amount} autoStart={auto} />
      <div className="panel space-y-3 p-4">
        <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /><h2 className="font-semibold">Redeem Code</h2></div>
        <p className="text-sm text-muted-foreground">আপনার Redeem Code দিয়ে ওয়ালেটে ব্যালেন্স যোগ করুন। প্রতিটি কোড একবারই ব্যবহার করা যাবে—ওয়েবসাইট বা Telegram যেকোনো এক জায়গায়।</p>
        <Input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} placeholder="যেমন: PB-AB12CD34EF56" autoCapitalize="characters" />
        <Button className="w-full" onClick={() => void redeem()} disabled={redeeming}>{redeeming ? "Redeem হচ্ছে…" : "Redeem Code"}</Button>
      </div>
      <div>
        <h2 className="mb-3 font-semibold">Transactions</h2>
        {txs.isLoading ? <RowSkeleton /> : txs.error ? <ErrorState onRetry={() => txs.refetch()} /> : (txs.data ?? []).length === 0 ? (
          <EmptyState title="No transactions yet" />
        ) : (
          <TxList txs={txs.data!} currency={settings.currency_symbol} />
        )}
      </div>
    </div>
  );
}
