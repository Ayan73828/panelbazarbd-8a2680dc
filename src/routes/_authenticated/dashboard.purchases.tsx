import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/SiteLayout";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/site/States";
import { OrderList } from "@/components/site/OrderList";
import { Button } from "@/components/ui/button";
import { useMyOrders } from "@/hooks/useMyData";
import { useSettings } from "@/hooks/useSite";

export const Route = createFileRoute("/_authenticated/dashboard/purchases")({
  component: Purchases,
});

function Purchases() {
  const orders = useMyOrders();
  const { settings } = useSettings();
  const list = (orders.data ?? []).filter((o) => !["cancelled", "refunded"].includes(o.status));
  return (
    <div>
      <PageHeader title="Purchased Products" description="Products you own. Access appears once the order is completed." />
      {orders.isLoading ? <RowSkeleton /> : orders.error ? <ErrorState onRetry={() => orders.refetch()} /> : list.length === 0 ? (
        <EmptyState title="No purchases yet" action={<Button asChild size="sm"><Link to="/products">Browse products</Link></Button>} />
      ) : (
        <OrderList orders={list as never} currency={settings.currency_symbol} showAccess />
      )}
    </div>
  );
}
