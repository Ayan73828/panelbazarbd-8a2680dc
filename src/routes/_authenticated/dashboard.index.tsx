import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCircle2, Clock, ReceiptText, Wallet } from "lucide-react";
import { PageHeader } from "@/components/site/SiteLayout";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/site/States";
import { OrderList } from "@/components/site/OrderList";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyOrders } from "@/hooks/useMyData";
import { useActiveAnnouncements, useSettings } from "@/hooks/useSite";
import { money } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const orders = useMyOrders();
  const notices = useActiveAnnouncements();
  const list = orders.data ?? [];
  const cur = settings.currency_symbol;
  const stats = [
    { label: "Balance", value: money(profile?.balance, cur), icon: Wallet },
    { label: "Total orders", value: String(list.length), icon: ReceiptText },
    { label: "Successful", value: String(list.filter((o) => o.status === "completed").length), icon: CheckCircle2 },
    { label: "Pending", value: String(list.filter((o) => o.status === "pending" || o.status === "processing").length), icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome${profile?.name ? `, ${profile.name}` : ""}`} description="Here is an overview of your account." />
      {(notices.data ?? []).filter((n) => n.type !== "popup").slice(0, 3).map((n) => (
        <div key={n.id} className="panel flex gap-3 border-primary/30 p-4">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">{n.title}</p>
            <p className="text-sm text-muted-foreground">{n.message}</p>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="panel p-4">
            <Icon className="h-4 w-4 text-primary" />
            <p className="mt-3 text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{orders.isLoading && label !== "Balance" ? "…" : value}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent orders</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard/orders">View all</Link></Button>
        </div>
        {orders.isLoading ? (
          <RowSkeleton />
        ) : orders.error ? (
          <ErrorState onRetry={() => orders.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState title="No orders yet" description="Browse products and make your first purchase." action={<Button asChild size="sm"><Link to="/products">Browse products</Link></Button>} />
        ) : (
          <OrderList orders={list.slice(0, 5) as never} currency={cur} />
        )}
      </div>
    </div>
  );
}
