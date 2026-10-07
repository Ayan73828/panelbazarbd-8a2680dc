import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { KeyRound, LayoutDashboard, LogOut, Package, ReceiptText, ShoppingBag, User, Wallet } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — PANEL BAZAR BD" },
      { name: "description", content: "Your orders, wallet balance and purchased products." },
      { property: "og:title", content: "My Dashboard — PANEL BAZAR BD" },
      { property: "og:description", content: "Your orders, wallet balance and purchased products." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardLayout,
});

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/products", label: "Products", icon: Package, exact: false },
  { to: "/dashboard/orders", label: "My Orders", icon: ReceiptText, exact: false },
  { to: "/dashboard/purchases", label: "Purchased", icon: ShoppingBag, exact: false },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet, exact: false },
  { to: "/dashboard/profile", label: "Profile", icon: User, exact: false },
  { to: "/dashboard/password", label: "Password", icon: KeyRound, exact: false },
] as const;

function DashboardLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <SiteLayout>
      <div className="mx-auto grid w-full min-w-0 max-w-lg grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6">
        <aside className="min-w-0">
          <nav className="flex gap-1 overflow-x-auto pb-1">
            {items.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
              >
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
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </SiteLayout>
  );
}
