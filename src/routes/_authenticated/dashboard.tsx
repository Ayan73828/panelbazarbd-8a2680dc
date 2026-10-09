import { createFileRoute, Outlet } from "@tanstack/react-router";
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
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </SiteLayout>
  );
}
