import { createFileRoute } from "@tanstack/react-router";
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
  const { profile } = useAuth();
  const { amount, auto } = Route.useSearch();
  const { settings } = useSettings();
  const txs = useMyTransactions();
  const wa = waLink(settings.whatsapp_number, `Hi, I want to add balance. My username: ${profile?.username ?? profile?.email ?? ""}`);
  const tg = tgLink(settings.telegram_username);
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
      <AddFund initialAmount={amount} autoStart={auto} />
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
