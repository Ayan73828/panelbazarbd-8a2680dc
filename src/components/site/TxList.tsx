import { formatDate } from "@/components/site/Confirm";
import { money, statusLabel } from "@/lib/site";

type Tx = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  balance_after: number;
  created_at: string;
};

export function TxList({ txs, currency }: { txs: Tx[]; currency: string }) {
  return (
    <div className="space-y-2">
      {txs.map((t) => {
        const pos = Number(t.amount) >= 0;
        return (
          <div key={t.id} className="panel flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{statusLabel(t.type)}</p>
              <p className="truncate text-xs text-muted-foreground">{t.description || "—"}</p>
              <p className="text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${pos ? "text-success" : "text-destructive"}`}>
                {pos ? "+" : ""}
                {money(t.amount, currency)}
              </p>
              <p className="text-xs text-muted-foreground">Balance: {money(t.balance_after, currency)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
