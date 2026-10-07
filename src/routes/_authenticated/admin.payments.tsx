import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminHeader, db, Loadable } from "@/components/admin/kit";
import { formatDate, StatusBadge } from "@/components/site/Confirm";
import { EmptyState } from "@/components/site/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/hooks/useSite";
import { money } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/payments")({ component: AdminPayments });

const STATUSES = ["all", "completed", "invalid", "used", "rejected", "pending"];

function AdminPayments() {
  const { settings } = useSettings();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async () => {
      const [p, u] = await Promise.all([
        db.from("payments").select("*").order("created_at", { ascending: false }).limit(500),
        db.from("profiles").select("id,name,username,email"),
      ]);
      if (p.error) throw p.error;
      const users = new Map((u.data ?? []).map((x: { id: string }) => [x.id, x]));
      return (p.data ?? []).map((x: { user_id: string }) => ({ ...x, user: users.get(x.user_id) })) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  });
  const s = search.toLowerCase();
  const list = (q.data ?? []).filter((p) => (status === "all" || p.status === status) && (!s || p.trx_id.toLowerCase().includes(s) || (p.user?.email ?? "").toLowerCase().includes(s) || (p.user?.username ?? "").toLowerCase().includes(s)));
  return (
    <div className="space-y-4">
      <AdminHeader title="Payments" description="Every deposit verification attempt." />
      <Input placeholder="Search TRX, username or email…" className="h-12 text-base" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map((x) => <Button key={x} size="sm" variant={status === x ? "default" : "secondary"} className="shrink-0 rounded-full capitalize" onClick={() => setStatus(x)}>{x}</Button>)}
      </div>
      <Loadable q={q}>
        {list.length === 0 ? <EmptyState title="No payments found" /> : (
          <div className="space-y-2">
            {list.map((p) => (
              <div key={p.id} className="panel p-3 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-bold">{money(p.amount, settings.currency_symbol)}</span><StatusBadge status={p.status} /></div>
                <p className="text-xs text-muted-foreground">{p.user?.name || p.user?.username || "Unknown"} ({p.user?.email ?? "—"})</p>
                <p className="text-xs text-muted-foreground">{p.method === "bkash" ? "bKash" : "Nagad"} · <code>{p.trx_id}</code> · {formatDate(p.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </Loadable>
    </div>
  );
}
