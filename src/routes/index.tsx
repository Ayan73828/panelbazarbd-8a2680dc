import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Megaphone, MessageCircle, Phone, Send, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard, ProductCardSkeleton, type ProductRow } from "@/components/site/ProductCard";
import { EmptyState, ErrorState } from "@/components/site/States";
import { useActiveAnnouncements, useCategories, useSections, useSettings } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { tgLink, telLink, waLink } from "@/lib/site";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "PANEL BAZAR BD — Premium Digital Products & Reseller Panel" },
      {
        name: "description",
        content:
          "Buy premium digital products instantly with your wallet balance. Featured products, categories and 24/7 support from PANEL BAZAR BD.",
      },
      { property: "og:title", content: "PANEL BAZAR BD — Premium Digital Products" },
      {
        property: "og:description",
        content: "Buy premium digital products instantly with your wallet balance.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function useHomeProducts() {
  return useQuery({
    queryKey: ["products", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
    staleTime: 30_000,
  });
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string | null | undefined }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function HomePage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const sections = useSections();
  const categories = useCategories();
  const announcements = useActiveAnnouncements();
  const products = useHomeProducts();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const enabled = (key: string) => {
    const row = sections.data?.find((s) => s.key === key);
    return row ? row.is_enabled : true;
  };
  const section = (key: string) => sections.data?.find((s) => s.key === key);
  const categoryName = (id: string | null) =>
    categories.data?.find((c) => c.id === id)?.name ?? undefined;

  const featured = (products.data ?? []).filter((p) => p.is_featured).slice(0, 8);
  const latest = (products.data ?? []).slice(0, 8);
  const currency = settings.currency_symbol;
  const banner = announcements.data?.find((a) => a.type === "banner" || a.type === "popup");

  return (
    <SiteLayout>
      {!selectedCategoryId && enabled("featured") && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-6 pt-4 sm:pb-8 sm:pt-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tight sm:text-2xl">
                {section("featured")?.title || "Explore Products"}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {section("featured")?.subtitle || "Browse products and choose what you need"}
              </p>
            </div>
            <Link to="/products" className="shrink-0 text-sm font-semibold text-primary">
              View all <ArrowRight className="ml-1 inline h-4 w-4" />
            </Link>
          </div>
          {products.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : products.isError ? (
            <ErrorState onRetry={() => products.refetch()} />
          ) : (featured.length > 0 ? featured : latest).length === 0 ? (
            <EmptyState title="No products yet" description="Products will appear here when available." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {(featured.length > 0 ? featured : latest).slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} categoryName={categoryName(p.category_id)} currency={currency} />
              ))}
            </div>
          )}
        </section>
      )}
      {enabled("hero") && (
        <section className="relative isolate overflow-hidden border-b border-border/60 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.12),transparent_45%)]">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.16] [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-9 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-20">
            <div className="space-y-5 sm:space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm">
                <Zap className="h-3.5 w-3.5" /> DIGITAL PRODUCTS · FAST DELIVERY
              </span>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-3xl font-black leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
                  <span className="text-gradient-brand">{settings.hero_title}</span>
                </h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                  {settings.hero_subtitle || settings.site_description}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full px-6 shadow-lg shadow-primary/20">
                  <Link to="/products">Explore products <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                {!user && (
                  <Button asChild size="lg" variant="outline" className="rounded-full border-border/80 bg-background/60 px-6 backdrop-blur">
                    <Link to="/auth" search={{ mode: "register" }}>Create account</Link>
                  </Button>
                )}
              </div>
              <div className="grid max-w-xl grid-cols-3 gap-2 pt-1 sm:gap-3">
                <div className="rounded-2xl border border-border/70 bg-background/55 p-3 backdrop-blur sm:p-4">
                  <Zap className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-xs font-bold sm:text-sm">Fast delivery</p>
                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">Quick order flow</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/55 p-3 backdrop-blur sm:p-4">
                  <ShieldCheck className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-xs font-bold sm:text-sm">Secure checkout</p>
                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">Wallet payments</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/55 p-3 backdrop-blur sm:p-4">
                  <MessageCircle className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-xs font-bold sm:text-sm">Need help?</p>
                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">Support available</p>
                </div>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
              <div className="absolute -inset-5 rounded-[2rem] bg-primary/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-card/80 p-3 shadow-2xl shadow-black/20 backdrop-blur sm:p-4">
                {settings.hero_image_url ? (
                  <img src={settings.hero_image_url} alt={settings.hero_title} fetchPriority="high" className="aspect-[5/4] w-full rounded-[1.25rem] object-cover" />
                ) : (
                  <div className="relative flex aspect-[5/4] flex-col justify-between overflow-hidden rounded-[1.25rem] bg-[radial-gradient(ellipse_at_25%_20%,hsl(var(--primary)/0.34),transparent_45%),linear-gradient(145deg,hsl(var(--card)),hsl(var(--background)))] p-5 sm:p-7">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">PANEL BAZAR BD</span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Zap className="h-5 w-5" /></span>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Your digital store</p>
                      <p className="mt-2 text-2xl font-black tracking-tight sm:text-4xl">Shop smarter.<br /><span className="text-gradient-brand">Get it instantly.</span></p>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/65 p-3 backdrop-blur">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><ShieldCheck className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-bold">Simple & secure</p><p className="text-xs text-muted-foreground">Browse · Order · Receive</p></div>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {enabled("announcement") && (settings.announcement_text || banner) && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-8">
          <div className="panel flex items-start gap-3 border-primary/30 bg-primary/5 p-4">
            <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              {banner && <p className="font-semibold">{banner.title}</p>}
              <p className="text-muted-foreground">{banner?.message || settings.announcement_text}</p>
            </div>
          </div>
        </section>
      )}

      {enabled("categories") && (
        <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                {section("categories")?.title || "Categories"}
              </h2>
              {section("categories")?.subtitle && (
                <p className="mt-0.5 text-xs text-muted-foreground">{section("categories")?.subtitle}</p>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">Swipe to explore →</span>
          </div>
          {categories.isLoading ? (
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-surface-2" />
              ))}
            </div>
          ) : (categories.data ?? []).length === 0 ? (
            <EmptyState title="No categories yet" description="Add categories from the Admin Panel." />
          ) : (
            <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
              <button type="button" aria-pressed={selectedCategoryId === null} onClick={() => setSelectedCategoryId(null)} className={`panel inline-flex min-h-10 shrink-0 snap-start items-center rounded-full border px-4 py-2 text-sm font-medium ${selectedCategoryId === null ? "border-primary bg-primary/15 text-primary" : "border-border/70 bg-surface"}`}>All Products</button>
              {categories.data!.map((c) => (
                <button key={c.id} type="button" aria-pressed={selectedCategoryId === c.id} onClick={() => setSelectedCategoryId((current) => current === c.id ? null : c.id)} className={`panel inline-flex min-h-10 shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors active:scale-[0.98] ${selectedCategoryId === c.id ? "border-primary bg-primary/15 text-primary" : "border-border/70 bg-surface hover:border-primary/50 hover:bg-primary/5"}`}>
                  {c.image_url ? <img src={c.image_url} alt="" loading="lazy" className="h-5 w-5 rounded-full object-cover" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary"><Zap className="h-3 w-3" /></span>}
                  <span className="whitespace-nowrap">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedCategoryId && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-10" aria-live="polite">
          <SectionTitle title={categories.data?.find((c) => c.id === selectedCategoryId)?.name || "Selected category"} subtitle="Selected category products" />
          {products.isLoading ? <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div> : products.isError ? <ErrorState onRetry={() => products.refetch()} /> : (products.data ?? []).filter((p) => p.category_id === selectedCategoryId).length === 0 ? <EmptyState title="No products in this category" description="Choose another category or check back later." /> : <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">{(products.data ?? []).filter((p) => p.category_id === selectedCategoryId).map((p) => <ProductCard key={p.id} product={p} categoryName={categoryName(p.category_id)} currency={currency} />)}</div>}
        </section>
      )}

      {!selectedCategoryId && (categories.data ?? []).map((c) => {
        const list = (products.data ?? []).filter((p) => p.category_id === c.id);
        if (list.length === 0) return null;
        return (
          <section key={c.id} className="mx-auto w-full max-w-6xl px-4 pb-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold uppercase tracking-wide sm:text-2xl">{c.name}</h2>
              <Link to="/products" search={{ category: c.slug }} className="text-sm text-primary">See all</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {list.slice(0, 6).map((p) => (
                <ProductCard key={p.id} product={p} categoryName={c.name} currency={currency} />
              ))}
            </div>
          </section>
        );
      })}

      {!selectedCategoryId && enabled("latest") && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-10">
          <SectionTitle
            title={section("latest")?.title || "Latest Products"}
            subtitle={section("latest")?.subtitle}
          />
          {products.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : latest.length === 0 ? (
            <EmptyState title="No products yet" description="Add products from the Admin Panel." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {latest.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  categoryName={categoryName(p.category_id)}
                  currency={currency}
                />
              ))}
            </div>
          )}
          <div className="mt-6 text-center">
            <Button asChild variant="secondary" className="rounded-full">
              <Link to="/products">View all products</Link>
            </Button>
          </div>
        </section>
      )}

      {enabled("contact") && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-14">
          <SectionTitle
            title={section("contact")?.title || "Contact Us"}
            subtitle={section("contact")?.subtitle}
          />
          <div className="grid gap-3">
            {settings.contact_phone && (
              <a href={telLink(settings.contact_phone)} className="panel flex items-center gap-3 p-4">
                <Phone className="h-5 w-5 text-primary" />
                <span className="text-sm">
                  <span className="block text-muted-foreground">Call</span>
                  {settings.contact_phone}
                </span>
              </a>
            )}
            {settings.whatsapp_number && (
              <a
                href={waLink(settings.whatsapp_number, `Hello ${settings.site_name}`)}
                target="_blank"
                rel="noreferrer"
                className="panel flex items-center gap-3 p-4"
              >
                <MessageCircle className="h-5 w-5 text-success" />
                <span className="text-sm">
                  <span className="block text-muted-foreground">WhatsApp</span>
                  {settings.whatsapp_number}
                </span>
              </a>
            )}
            {settings.telegram_username && (
              <a
                href={tgLink(settings.telegram_username)}
                target="_blank"
                rel="noreferrer"
                className="panel flex items-center gap-3 p-4"
              >
                <Send className="h-5 w-5 text-accent" />
                <span className="text-sm">
                  <span className="block text-muted-foreground">Telegram</span>@
                  {settings.telegram_username.replace(/^@/, "")}
                </span>
              </a>
            )}
          </div>
        </section>
      )}
    </SiteLayout>
  );
}
