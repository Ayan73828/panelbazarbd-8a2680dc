import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { CreditCard, FolderTree, KeyRound, ListChecks, Home, LayoutDashboard, LogOut, Megaphone, Package, ReceiptText, Settings, ShieldAlert, Users, Wallet } from "lucide-react";
import { Brand } from "@/components/site/Brand";
import { EmptyState, RowSkeleton } from "@/components/site/States";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — PANEL BAZAR BD" },
      { name: "description", content: "Manage products, orders, users and website settings." },
      { property: "og:title", content: "Admin Panel — PANEL BAZAR BD" },
      { property: "og:description", content: "Manage products, orders, users and website settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/keys", label: "Packages & Keys", icon: KeyRound, exact: false },
  { to: "/admin/categories", label: "Categories", icon: FolderTree, exact: false },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText, exact: false },
  { to: "/admin/users", label: "Users", icon: Users, exact: false },
  { to: "/admin/payments", label: "Payments", icon: CreditCard, exact: false },
  { to: "/admin/wallet", label: "Wallet", icon: Wallet, exact: false },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone, exact: false },
  { to: "/admin/homepage", label: "Homepage", icon: Home, exact: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function AdminLayout() {
  const { isAdmin, profileLoading, loading, signOut } = useAuth();
  const navigate = useNavigate();
  if (loading || profileLoading) return <div className="mx-auto max-w-5xl p-6"><RowSkeleton rows={6} /></div>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md p-6 pt-20">
        <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="Access denied" description="This area is for administrators only." action={<Button asChild size="sm"><Link to="/dashboard">Go to my dashboard</Link></Button>} />
      </div>
    );
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg border-x border-border/60">
      <aside className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">View site</Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          {items.map(({ to, label, icon: Icon, exact }) => (
            <Link key={to} to={to} activeOptions={{ exact }} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary">
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth", search: { mode: "login" }, replace: true });
            }}
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </nav>
      </aside>
      <main className="min-w-0 p-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <Outlet />
      </main>
    </div>
  );
}
