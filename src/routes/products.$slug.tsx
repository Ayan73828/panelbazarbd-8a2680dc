import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, ImageIcon, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard, type ProductRow } from "@/components/site/ProductCard";
import { ErrorState } from "@/components/site/States";
import { errMsg } from "@/components/site/Confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSite";
import { effectivePrice, money, statusLabel } from "@/lib/site";
import { playMoneyDeduct } from "@/lib/sounds";

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(id,name,slug)")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    return { name: p.name, desc: p.short_description ?? "", image: p.image_url, price: effectivePrice(p), inStock: p.stock > 0 };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Product not found" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.name} — PANEL BAZAR BD`;
    const img = loaderData.image && /^https:\/\//.test(loaderData.image) ? loaderData.image : null;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.desc || loaderData.name },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.desc || loaderData.name },
        { property: "og:type", content: "product" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: loaderData.name,
            description: loaderData.desc,
            sku: params.slug,
            ...(img ? { image: img } : {}),
            offers: {
              "@type": "Offer",
              price: loaderData.price,
              priceCurrency: "BDT",
              availability: loaderData.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            },
          }),
        },
      ],
    };
  },
  component: ProductDetail,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been removed or disabled.</p>
        <Button asChild className="mt-6"><Link to="/products">Back to products</Link></Button>
      </div>
    </SiteLayout>
  ),
  errorComponent: ({ reset }) => (
    <SiteLayout><div className="mx-auto max-w-md px-4 py-20"><ErrorState message="Could not load this product." onRetry={reset} /></div></SiteLayout>
  ),
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(productQuery(slug));
  const { settings } = useSettings();
  const cur = settings.currency_symbol;
  const images = p ? [p.image_url, ...(p.images ?? [])].filter((x): x is string => !!x) : [];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const pkgs = useQuery({
    queryKey: ["packages", p?.id],
    enabled: !!p?.id,
    queryFn: async () => {
      const [{ data, error }, { data: stock }] = await Promise.all([
        supabase.from("product_packages").select("id,name,duration,price,sort_order").eq("product_id", p!.id).eq("is_active", true).order("sort_order"),
        supabase.rpc("package_stock", { p_product_id: p!.id }),
      ]);
      if (error) throw error;
      const st = new Map((stock ?? []).map((r: { package_id: string; available: number }) => [r.package_id, Number(r.available)]));
      return (data ?? []).map((x) => ({ ...x, price: Number(x.price), available: st.get(x.id) ?? 0 }));
    },
  });
  const [pkgId, setPkgId] = useState<string | null>(null);

  const related = useQuery({
    queryKey: ["related", p?.category_id, p?.id],
    enabled: !!p?.category_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("category_id", p!.category_id!)
        .neq("id", p!.id)
        .limit(4);
      return data ?? [];
    },
  });

  if (!p) return null;
  const hasDiscount = !!p.discount_price && Number(p.discount_price) > 0;
  const soldOut = p.stock <= 0 || p.status === "out_of_stock" || p.status === "coming_soon";
  const cat = p.categories as { name: string; slug: string } | null;
  const packages = pkgs.data ?? [];
  const hasPackages = packages.length > 0;
  const selected = packages.find((x) => x.id === pkgId) ?? null;

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <nav className="mb-4 text-xs text-muted-foreground">
          <Link to="/products" className="hover:text-foreground">Products</Link>
          {cat && <> / <Link to="/products" search={{ category: cat.slug }} className="hover:text-foreground">{cat.name}</Link></>}
        </nav>
        <div className="grid gap-8">
          <div>
            <div className="panel aspect-[4/3] overflow-hidden bg-surface-2">
              {images[active] ? (
                <img src={images[active]} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="h-10 w-10" /></div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((src, i) => (
                  <button key={src + i} onClick={() => setActive(i)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border ${i === active ? "border-primary" : "border-border"}`}>
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {cat && <Badge variant="secondary">{cat.name}</Badge>}
              {p.is_featured && <Badge>Featured</Badge>}
              {p.is_best_seller && <Badge variant="outline">Best Seller</Badge>}
            </div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{p.name}</h1>
            {p.short_description && <p className="text-muted-foreground">{p.short_description}</p>}
            {hasPackages ? (
              <div className="space-y-3">
                <h2 className="font-semibold">Select package</h2>
                <div className="grid grid-cols-2 gap-2">
                  {packages.map((pk) => {
                    const off = pk.price <= 0 || pk.available <= 0;
                    const on = pk.id === pkgId;
                    return (
                      <button
                        key={pk.id}
                        type="button"
                        onClick={() => setPkgId(pk.id)}
                        className={`min-w-0 rounded-xl border p-3 text-left transition-colors ${on ? "border-primary bg-primary/10" : "border-border bg-surface-2"}`}
                      >
                        <p className="truncate text-sm font-bold uppercase">{pk.name}</p>
                        <p className="font-display text-lg font-bold text-primary">{pk.price > 0 ? money(pk.price, cur) : "—"}</p>
                        <p className={`text-xs ${off ? "text-destructive" : "text-success"}`}>
                          {pk.price <= 0 ? "Price not set" : pk.available > 0 ? `${pk.available} in stock` : "Stock out"}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {selected && selected.available <= 0 && selected.price > 0 && (
                  <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">এই প্যাকেজের Key বর্তমানে শেষ।</p>
                )}
                <Button
                  size="lg"
                  className="h-12 w-full rounded-full"
                  disabled={!selected || selected.available <= 0 || selected.price <= 0}
                  onClick={() => setOpen(true)}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" /> {selected ? `Buy Now — ${money(selected.price, cur)}` : "Select a package"}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold text-primary">{money(effectivePrice(p), cur)}</span>
                  {hasDiscount && <span className="text-muted-foreground line-through">{money(p.price, cur)}</span>}
                </div>
                <p className={`text-sm font-medium ${soldOut ? "text-destructive" : "text-success"}`}>
                  {soldOut ? (p.status === "coming_soon" ? "Coming soon" : "Out of stock") : `${statusLabel(p.status)} — ${p.stock} available`}
                </p>
                <Button size="lg" className="h-12 w-full rounded-full" disabled={soldOut || pkgs.isLoading} onClick={() => setOpen(true)}>
                  <ShoppingCart className="mr-2 h-4 w-4" /> Buy Now
                </Button>
              </>
            )}
            {p.demo_url && (
              <Button asChild size="lg" variant="secondary" className="h-12 w-full rounded-full">
                <a href={p.demo_url} target="_blank" rel="noreferrer">View Demo <ExternalLink className="ml-2 h-4 w-4" /></a>
              </Button>
            )}
            {p.features?.length > 0 && (
              <div className="panel p-4">
                <h2 className="mb-3 font-semibold">Features</h2>
                <ul className="space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        {p.full_description && (
          <section className="panel mt-8 p-5">
            <h2 className="mb-3 text-lg font-semibold">Description</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.full_description}</p>
          </section>
        )}
        {(related.data?.length ?? 0) > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">Related products</h2>
            <div className="grid grid-cols-2 gap-3">
              {related.data!.map((r) => <ProductCard key={r.id} product={r as ProductRow} categoryName={cat?.name} currency={cur} />)}
            </div>
          </section>
        )}
      </div>
      <BuyDialog
        open={open}
        onOpenChange={setOpen}
        product={{
          id: p.id,
          name: selected ? `${p.name} — ${selected.name}` : p.name,
          unit: selected ? selected.price : effectivePrice(p),
          slug: p.slug,
          packageId: selected?.id ?? null,
        }}
      />
    </SiteLayout>
  );
}

function BuyDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (v: boolean) => void; product: { id: string; name: string; unit: number; slug: string; packageId: string | null } }) {
  const { user, profile, refresh } = useAuth();
  const { settings } = useSettings();
  const cur = settings.currency_symbol;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = product.unit;
  const balance = Number(profile?.balance ?? 0);
  const insufficient = balance < total;

  function goAddMoney() {
    sessionStorage.setItem("kr_return_to", `/products/${product.slug}`);
    onOpenChange(false);
    navigate({ to: "/dashboard/wallet", search: { amount: total, auto: true } });
  }

  async function buy() {
    if (busy) return;
    if (insufficient) { goAddMoney(); return; }
    setBusy(true);
    setError("");
    const { error } = product.packageId
      ? await supabase.rpc("purchase_package", { p_package_id: product.packageId })
      : await supabase.rpc("purchase_product", { p_product_id: product.id, p_quantity: 1 });
    setBusy(false);
    if (error) {
      if (error.message.includes("INSUFFICIENT_BALANCE")) { goAddMoney(); return; }
      setError(error.message.includes("NO_KEYS") ? "এই প্যাকেজের Key বর্তমানে শেষ।" : errMsg(error));
      return;
    }
    playMoneyDeduct();
    toast.success("Purchase successful! Your key is in My Orders.");
    refresh();
    qc.invalidateQueries({ queryKey: ["product", product.slug] });
    qc.invalidateQueries({ queryKey: ["packages"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["my"] });
    onOpenChange(false);
    navigate({ to: "/dashboard/orders" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader><DialogTitle>Confirm purchase</DialogTitle></DialogHeader>
        {!user ? (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">Please log in to buy this product.</p>
            <Button asChild className="w-full"><Link to="/auth" search={{ mode: "login" }}>Login</Link></Button>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Product</span><span className="min-w-0 break-words text-right font-medium">{product.name}</span></div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Price</span><span className="text-primary">{money(total, cur)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Your balance</span><span className={insufficient ? "text-destructive" : "text-success"}>{money(balance, cur)}</span></div>
            {insufficient && !error && (
              <p className="rounded-lg bg-primary/10 p-3 text-primary">ব্যালেন্স কম। "Add money" চাপলে ৳{Math.max(10, Math.ceil(total))} এর পেমেন্ট পেজ খুলবে — বিকাশ/নগদে পে করে ফিরে এসে আবার Buy Now চাপুন।</p>
            )}
            {error && <p className="rounded-lg bg-destructive/10 p-3 text-destructive">{error}</p>}
          </div>
        )}
        {user && (
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={buy} disabled={busy}>{busy ? "Processing…" : insufficient ? `Add money ৳${Math.max(10, Math.ceil(total))}` : `Pay ${money(total, cur)}`}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
