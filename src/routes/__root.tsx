import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { playUiClick } from "@/lib/sounds";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PANEL BAZAR BD" },
      {
        name: "description",
        content: "Premium digital products and reseller panel services at reseller prices.",
      },
      { property: "og:site_name", content: "PANEL BAZAR BD" },
      { property: "og:title", content: "PANEL BAZAR BD — Digital Products & Reseller Panel" },
      { name: "twitter:title", content: "PANEL BAZAR BD — Digital Products & Reseller Panel" },
      { name: "twitter:description", content: "Premium digital products and reseller panel services at reseller prices." },
      { property: "og:url", content: "https://panelbazarbd.shop/" },
      { name: "application-name", content: "PANEL BAZAR BD" },
      { name: "theme-color", content: "#111827" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://panelbazarbd.shop/" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
      },
      // Use the official brand image directly so crawlers do not pick the default Lovable icon.
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try { var p = localStorage.getItem("panelbazarbd_primary_color"); var a = localStorage.getItem("panelbazarbd_secondary_color"); if (p) document.documentElement.style.setProperty("--primary", p); if (a) document.documentElement.style.setProperty("--accent", a); } catch (_) {}` }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Applies admin-editable brand colors at runtime. */
function BrandTheme() {
  const { settings } = useSettings();
  const { isFetched } = useSettings();

  // Apply the fetched theme before the browser paints the hydrated page.
  // useEffect runs after paint and caused a visible default-color flash on refresh.
  useLayoutEffect(() => {
    const root = document.documentElement;

    // Do not apply DEFAULT_SETTINGS while the real Supabase settings are still
    // loading: doing so overwrites cached colors and causes a visible flash.
    if (isFetched) {
      if (settings.primary_color) {
        root.style.setProperty("--primary", settings.primary_color);
        try { window.localStorage.setItem("panelbazarbd_primary_color", settings.primary_color); } catch {}
      }
      if (settings.secondary_color) {
        root.style.setProperty("--accent", settings.secondary_color);
        try { window.localStorage.setItem("panelbazarbd_secondary_color", settings.secondary_color); } catch {}
      }
      root.classList.add("brand-theme-ready");
    }

  }, [settings, isFetched]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const handleClick = () => playUiClick();
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrandTheme />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <MaintenanceGate><Outlet /></MaintenanceGate>
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}


function MaintenanceGate({ children }: { children: ReactNode }) {
  const { settings, isLoading } = useSettings();
  const { isAdmin, loading: authLoading, profileLoading } = useAuth();
  const cachedMaintenance = typeof window !== "undefined"
    ? window.localStorage.getItem("panelbazarbd_maintenance_mode")
    : null;

  useEffect(() => {
    if (!isLoading && typeof window !== "undefined") {
      window.localStorage.setItem("panelbazarbd_maintenance_mode", settings.maintenance_mode === "true" ? "true" : "false");
    }
  }, [isLoading, settings.maintenance_mode]);

  if (isAdmin) return <>{children}</>;

  // Do not render any interim maintenance/loading artwork on refresh.
  // Render the requested page immediately; show maintenance only after the
  // current site setting confirms it is enabled (never trust stale localStorage).
  const shouldShowMaintenance = !isLoading && settings.maintenance_mode === "true";
  if (!shouldShowMaintenance) return <>{children}</>;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-12 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10rem] h-80 w-80 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-5rem] h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl backdrop-blur sm:p-10">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-400/10">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-10 w-10 text-sky-300" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a5 5 0 0 0-6.9 6.9L3 18l3 3 4.8-4.8a5 5 0 0 0 6.9-6.9l-3 3-3-3 3-3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m14 4 2-2 6 6-2 2" />
          </svg>
        </div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Website Maintenance</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">আমাদের ওয়েবসাইটে আপডেট চলছে</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-slate-300 sm:text-base">
          PANEL BAZAR BD-তে আরও ভালো অভিজ্ঞতা দেওয়ার জন্য আমরা কিছু কাজ করছি। সাময়িক অসুবিধার জন্য দুঃখিত। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।
        </p>
        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          Update in progress
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3">
          {settings.whatsapp_number?.trim() && (
            <a
              href={`https://wa.me/${settings.whatsapp_number.replace(/\\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <span aria-hidden="true">◉</span> WhatsApp Support
            </a>
          )}
          {settings.telegram_username?.trim() && (
            <a
              href={`https://t.me/${settings.telegram_username.trim().replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
            >
              <span aria-hidden="true">➤</span> Telegram Support
            </a>
          )}
        </div>
        <p className="mt-8 text-xs text-slate-500">Thank you for your patience · PANEL BAZAR BD</p>
      </section>
    </main>
  );
}
