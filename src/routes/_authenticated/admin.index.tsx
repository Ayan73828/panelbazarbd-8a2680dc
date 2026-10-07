import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader, Loadable } from "@/components/admin/kit";
import { formatDate, StatusBadge } from "@/components/site/Confirm";
import { useSettings } from "@/hooks/useSite";
import { money } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminHome });

type Stats = {
  total_users: number; total_products: number; total_orders: number; pending_orders: number;
  completed_orders: number; total_sales: number; total_wallet: number;
};

function AdminHome() {
  const { settings } = useSettings();
  const cur = settings.currency_symbol;
  const q = useQuery({
    queryKey: ["admin", "dash"],
    queryFn: async () => {
      const [s, u, o] = await Promise.all([
        supabase.rpc("admin_stats"),
        supabase.from("profiles").select("id,name,email,created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("orders").select("id,product_name,total,status,created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      if (s.error) throw s.error;
      return { stats: (s.data ?? {}) as unknown as Stats, users: u.data ?? [], orders: o.data ?? [] };
    },
  });
  const st = q.data?.stats;
  const cards = st
    ? [
        ["Total users", st.total_users], ["Total products", st.total_products], ["Total orders", st.total_orders],
        ["Pending orders", st.pending_orders], ["Completed orders", st.completed_orders],
        ["Total sales", money(st.total_sales, cur)], ["Wallet balance (all users)", money(st.total_wallet, cur)],
      ]
    : [];
  return (
    <div>
      <AdminHeader title="Dashboard" description="Overview of your store." />
      <Loadable q={q}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(([l, v]) => (
            <div key={String(l)} className="panel p-4">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="mt-1 font-display text-xl font-bold">{String(v ?? 0)}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="panel p-4">
            <h2 className="mb-3 font-semibold">Recent users</h2>
            {q.data?.users.length ? q.data.users.map((u) => (
              <div key={u.id} className="flex justify-between border-t border-border py-2 text-sm first:border-0">
                <span>{u.name}<span className="block text-xs text-muted-foreground">{u.email}</span></span>
                <span className="text-xs text-muted-foreground">{formatDate(u.created_at)}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground">No users yet.</p>}
          </div>
          <div className="panel p-4">
            <h2 className="mb-3 font-semibold">Recent orders</h2>
            {q.data?.orders.length ? q.data.orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-0">
                <span className="min-w-0 truncate">{o.product_name}<span className="block text-xs text-muted-foreground">{money(o.total, cur)}</span></span>
                <StatusBadge status={o.status} />
              </div>
            )) : <p className="text-sm text-muted-foreground">No orders yet.</p>}
          </div>
        </div>
      </Loadable>
    </div>
  );
}
