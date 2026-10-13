import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, BellRing, CheckCircle2, Clock, Gift, ReceiptText, Wallet } from "lucide-react";
import { PageHeader } from "@/components/site/SiteLayout";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/site/States";
import { OrderList } from "@/components/site/OrderList";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyOrders, useMyTransactions } from "@/hooks/useMyData";
import { useActiveAnnouncements, useSettings } from "@/hooks/useSite";
import { money } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const orders = useMyOrders();
  const transactions = useMyTransactions();
  const notices = useActiveAnnouncements();
  const list = orders.data ?? [];
  const cur = settings.currency_symbol;
  const notificationItems = [
    ...(transactions.data ?? []).map((tx) => ({
      id: `tx-${tx.id}`,
      title: tx.type === "referral_reward" ? "Referral reward received" : tx.type === "deposit" || tx.type === "add_funds" ? "Wallet balance updated" : tx.type === "purchase" ? "Purchase activity" : "Wallet activity",
      message: tx.description || (tx.type === "referral_reward" ? "You received a referral reward." : `${tx.type}: ${money(tx.amount, cur)}`),
      createdAt: tx.created_at,
      kind: tx.type === "referral_reward" ? "referral" as const : "wallet" as const,
    })),
    ...list.slice(0, 5).map((order) => ({
      id: `order-${order.id}`,
      title: "Order update",
      message: `Your order status is ${order.status}.`,
      createdAt: order.created_at,
      kind: "order" as const,
    })),
    ...(notices.data ?? []).filter((notice) => notice.type !== "popup").map((notice) => ({
      id: `announcement-${notice.id}`,
      title: notice.title,
      message: notice.message,
      createdAt: notice.created_at,
      kind: "announcement" as const,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  const stats = [
    { label: "Balance", value: money(profile?.balance, cur), icon: Wallet },
    { label: "Total orders", value: String(list.length), icon: ReceiptText },
    { label: "Successful", value: String(list.filter((o) => o.status === "completed").length), icon: CheckCircle2 },
    { label: "Pending", value: String(list.filter((o) => o.status === "pending" || o.status === "processing").length), icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome${profile?.name ? `, ${profile.name}` : ""}`} description="Here is an overview of your account." />
      <section className="panel space-y-3 p-4" aria-label="Notifications">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" /><h2 className="font-semibold">Notifications</h2></div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{notificationItems.length}</span>
        </div>
        {transactions.isLoading || orders.isLoading || notices.isLoading ? <p className="text-sm text-muted-foreground">Loading notifications…</p> : notificationItems.length === 0 ? <p className="text-sm text-muted-foreground">No notifications yet. Referral rewards, wallet activity, order updates and announcements will appear here.</p> : <div className="divide-y divide-border">{notificationItems.map((item) => <div key={item.id} className="flex gap-3 py-3 first:pt-1 last:pb-0"><span className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">{item.kind === "referral" ? <Gift className="h-4 w-4" /> : item.kind === "wallet" ? <Wallet className="h-4 w-4" /> : item.kind === "order" ? <ReceiptText className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.message}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></div></div>)}</div>}
        {(transactions.error || orders.error || notices.error) && <p className="text-xs text-muted-foreground">Some notifications could not be loaded right now.</p>}
      </section>
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
