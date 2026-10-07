import { createFileRoute } from "@tanstack/react-router";
import { AdminHeader, Loadable, useTable } from "@/components/admin/kit";
import { formatDate } from "@/components/site/Confirm";
import { EmptyState } from "@/components/site/States";
import { useSettings } from "@/hooks/useSite";
import { money, statusLabel } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/wallet")({ component: AdminWallet });

function AdminWallet() {
  const q = useTable("wallet_transactions");
  const users = useTable("profiles");
  const { settings } = useSettings();
  const names = new Map((users.data ?? []).map((u) => [u.id, u.name || u.email]));
  return (
    <div className="space-y-4">
      <AdminHeader title="Wallet" description="Every balance change across all users. Adjust balances from the Users page." />
      <Loadable q={q}>
        {(q.data ?? []).length === 0 ? <EmptyState title="No transactions yet" /> : (
          <div className="space-y-2">
            {(q.data ?? []).map((t) => (
              <div key={t.id} className="panel flex items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{names.get(t.user_id) ?? "User"}</span> · {statusLabel(t.type)}
                  <span className="block truncate text-xs text-muted-foreground">{t.description} · {formatDate(t.created_at)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={Number(t.amount) >= 0 ? "text-success" : "text-destructive"}>{money(t.amount, settings.currency_symbol)}</span>
                  <span className="block text-xs text-muted-foreground">after {money(t.balance_after, settings.currency_symbol)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Loadable>
    </div>
  );
}
