import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Search, SearchX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { ProductCard, ProductCardSkeleton, type ProductRow } from "@/components/site/ProductCard";
import { EmptyState, ErrorState } from "@/components/site/States";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories, useSettings } from "@/hooks/useSite";
import { effectivePrice } from "@/lib/site";

type ProductSearch = { q?: string | undefined; category?: string | undefined; sort?: string | undefined; min?: number | undefined; max?: number | undefined };

export const Route = createFileRoute("/products/")({
  validateSearch: (s: Record<string, unknown>): ProductSearch => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    category: typeof s["category"] === "string" && s["category"] ? s["category"] : undefined,
    sort: typeof s["sort"] === "string" && s["sort"] ? s["sort"] : undefined,
    min: s["min"] !== undefined && s["min"] !== "" && !isNaN(Number(s["min"])) ? Number(s["min"]) : undefined,
    max: s["max"] !== undefined && s["max"] !== "" && !isNaN(Number(s["max"])) ? Number(s["max"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "All Products — PANEL BAZAR BD" },
      { name: "robots", content: "index,follow" },
      { name: "description", content: "Browse premium digital products and reseller services with instant wallet checkout." },
      { property: "og:title", content: "All Products — PANEL BAZAR BD" },
      { property: "og:description", content: "Browse premium digital products and reseller services." },
      { property: "og:url", content: "https://panelbazarbd.shop/products/" },
    ],
    links: [{ rel: "canonical", href: "https://panelbazarbd.shop/products/" }],
  }),
  component: ProductsPage,
});

export function useAllProducts() {
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
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

function ProductsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/products/" });
  const { settings } = useSettings();
  const products = useAllProducts();
  const cats = useCategories();
  const catMap = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c])), [cats.data]);

  const set = (patch: Partial<ProductSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const filtered = useMemo(() => {
    const q = (search.q ?? "").toLowerCase().trim();
    let list = (products.data ?? []).filter((p) => {
      const cat = p.category_id ? catMap.get(p.category_id) : undefined;
      if (search.category && cat?.slug !== search.category) return false;
      const price = effectivePrice(p);
      if (search.min !== undefined && price < search.min) return false;
      if (search.max !== undefined && price > search.max) return false;
      if (!q) return true;
      return [p.name, p.short_description, p.full_description, cat?.name]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(q));
    });
    const s = search.sort ?? "default";
    if (s === "newest") list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (s === "price_asc") list = [...list].sort((a, b) => effectivePrice(a) - effectivePrice(b));
    if (s === "price_desc") list = [...list].sort((a, b) => effectivePrice(b) - effectivePrice(a));
    if (s === "featured") list = list.filter((p) => p.is_featured);
    return list;
  }, [products.data, catMap, search]);

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <PageHeader title="Products" description="Search, filter and buy instantly with your wallet balance." />
        <div className="panel mb-6 grid gap-3 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, category, description…"
              className="pl-9"
              value={search.q ?? ""}
              onChange={(e) => set({ q: e.target.value || undefined })}
              aria-label="Search products"
            />
          </div>
          <Select value={search.category ?? "all"} onValueChange={(v) => set({ category: v === "all" ? undefined : v })}>
            <SelectTrigger aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(cats.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={search.sort ?? "default"} onValueChange={(v) => set({ sort: v === "default" ? undefined : v })}>
            <SelectTrigger aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Recommended</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: low to high</SelectItem>
              <SelectItem value="price_desc">Price: high to low</SelectItem>
              <SelectItem value="featured">Featured only</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" min={0} placeholder="Min price" value={search.min ?? ""} onChange={(e) => set({ min: e.target.value === "" ? undefined : Number(e.target.value) })} />
          <Input type="number" min={0} placeholder="Max price" value={search.max ?? ""} onChange={(e) => set({ max: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </div>

        {products.isError ? (
          <ErrorState message="Could not load products." onRetry={() => products.refetch()} />
        ) : products.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title="No products found"
            description="Try a different search or clear the filters."
            action={<Button variant="secondary" onClick={() => navigate({ search: {}, replace: true })}>Clear filters</Button>}
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">{filtered.length} product(s)</p>
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p as ProductRow}
                  categoryName={p.category_id ? catMap.get(p.category_id)?.name : undefined}
                  currency={settings.currency_symbol}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
