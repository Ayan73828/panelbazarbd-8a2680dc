import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminHeader, db, Loadable, useInvalidateAll } from "@/components/admin/kit";
import { Confirm, errMsg, formatDate, StatusBadge } from "@/components/site/Confirm";
import { EmptyState } from "@/components/site/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSite";
import { money, ORDER_STATUSES, statusLabel } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/orders")({ component: AdminOrders });

function AdminOrders() {
  const { settings } = useSettings();
  const invalidate = useInvalidateAll();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const [o, p] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,name,email"),
      ]);
      if (o.error) throw o.error;
      const users = new Map((p.data ?? []).map((u) => [u.id, u]));
      return (o.data ?? []).map((x) => ({ ...x, user: users.get(x.user_id) }));
    },
  });
  const s = search.toLowerCase();
  const list = (q.data ?? []).filter(
    (o) => (status === "all" || o.status === status) &&
      (!s || o.product_name.toLowerCase().includes(s) || o.id.includes(s) || (o.user?.email ?? "").toLowerCase().includes(s) || (o.user?.name ?? "").toLowerCase().includes(s)),
  );
  const setOrderStatus = async (id: string, st: string) => {
    const { error } = await db.from("orders").update({ status: st }).eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(`Order marked ${statusLabel(st)}`);
    invalidate();
  };
  const refund = async (id: string) => {
    const { error } = await supabase.rpc("admin_refund_order", { p_order_id: id });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Order refunded to the customer's wallet");
    invalidate();
  };
  return (
    <div>
      <AdminHeader title="Orders" description="Search, update status, cancel or refund orders." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search product, customer or order ID…" className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        {["all", ...ORDER_STATUSES].map((x) => (
          <Button key={x} size="sm" variant={status === x ? "default" : "secondary"} className="rounded-full" onClick={() => setStatus(x)}>{x === "all" ? "All" : statusLabel(x)}</Button>
        ))}
      </div>
      <Loadable q={q}>
        {list.length === 0 ? <EmptyState title="No orders found" /> : (
          <div className="grid gap-2">
            {list.map((o) => (
              <div key={o.id} className="panel grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{o.product_name}</span><StatusBadge status={o.status} /></div>
                  <p className="text-xs text-muted-foreground">
                    {o.user?.name ?? "Unknown"} ({o.user?.email ?? "—"}) · Qty {o.quantity} × {money(o.unit_price, settings.currency_symbol)} = <b className="text-foreground">{money(o.total, settings.currency_symbol)}</b>
                  </p>
                  <p className="text-xs text-muted-foreground">#{o.id.slice(0, 8)} · {formatDate(o.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {o.status !== "refunded" && (
                    <select aria-label="Change status" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={o.status} onChange={(e) => setOrderStatus(o.id, e.target.value)}>
                      {ORDER_STATUSES.filter((x) => x !== "refunded").map((x) => <option key={x} value={x}>{statusLabel(x)}</option>)}
                    </select>
                  )}
                  {o.status !== "refunded" && (
                    <Confirm title="Refund this order?" description={`${money(o.total, settings.currency_symbol)} will be added back to the customer's wallet.`} confirmText="Refund" onConfirm={() => void refund(o.id)} trigger={<Button size="sm" variant="secondary">Refund</Button>} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Loadable>
    </div>
  );
}
