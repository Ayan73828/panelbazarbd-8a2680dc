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
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </SiteLayout>
  );
}
