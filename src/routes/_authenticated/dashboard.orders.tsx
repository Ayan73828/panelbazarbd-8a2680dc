import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/site/SiteLayout";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/site/States";
import { OrderList } from "@/components/site/OrderList";
import { Button } from "@/components/ui/button";
import { useMyOrders } from "@/hooks/useMyData";
import { useSettings } from "@/hooks/useSite";
import { ORDER_STATUSES, statusLabel } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/dashboard/orders")({
  component: MyOrders,
});

function MyOrders() {
  const orders = useMyOrders();
  const { settings } = useSettings();
  const [status, setStatus] = useState<string>("all");
  const list = (orders.data ?? []).filter((o) => status === "all" || o.status === status);
  return (
    <div>
      <PageHeader title="My Orders" description="Every order you have placed." />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {["all", ...ORDER_STATUSES].map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "secondary"} className="rounded-full" onClick={() => setStatus(s)}>
            {s === "all" ? "All" : statusLabel(s)}
          </Button>
        ))}
      </div>
      {orders.isLoading ? <RowSkeleton /> : orders.error ? <ErrorState onRetry={() => orders.refetch()} /> : list.length === 0 ? (
        <EmptyState title="No orders found" action={<Button asChild size="sm"><Link to="/products">Browse products</Link></Button>} />
      ) : (
        <OrderList orders={list as never} currency={settings.currency_symbol} />
      )}
    </div>
  );
}
