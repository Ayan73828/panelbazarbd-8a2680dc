import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

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

function DashboardLayout() {
  return (
    <SiteLayout>
      <div className="mx-auto grid w-full min-w-0 max-w-lg grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6">
        <section className="min-w-0 space-y-4">
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link to="/dashboard" className="rounded-full border border-border px-3 py-2">Dashboard</Link>
            <Link to="/dashboard/profile" className="rounded-full border border-border px-3 py-2">Profile</Link>
            <Link to="/dashboard/wallet" className="rounded-full border border-border px-3 py-2">Wallet</Link>
            <Link to="/dashboard/referral" className="rounded-full border border-primary/40 bg-primary/10 px-3 py-2 font-medium text-primary">🤝 Referral Program</Link>
          </nav>
          <Outlet />
        </section>
      </div>
    </SiteLayout>
  );
}
