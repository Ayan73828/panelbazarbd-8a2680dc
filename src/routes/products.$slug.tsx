import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { effectivePrice, money } from "@/lib/site";
import { playMoneyDeduct } from "@/lib/sounds";
import { addCartItem } from "@/lib/cart";
import { telegramNotifyEvent } from "@/lib/telegram-notifications.functions";

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

const packagesQuery = (productId: string) =>
  queryOptions({
    queryKey: ["packages", productId],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_packages")
        .select("id,name,duration,price,pro_reseller_price,sort_order,provider_auto_api,provider_product_id,provider_duration")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((x) => ({
        ...x,
        price: Number(x.price),
        pro_reseller_price: x.pro_reseller_price == null ? null : Number(x.pro_reseller_price),
        available: x.provider_auto_api ? 20 : 1,
      }));
    },
  });

export const Route = createFileRoute("/products/$slug")({
  validateSearch: (search: Record<string, unknown>): { buy?: string } => ({
    buy: search.buy === "1" ? "1" : undefined,
  }),
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    // Best-effort preload only: a package-query issue must never break the product page.
    await context.queryClient.ensureQueryData(packagesQuery(p.id)).catch(() => undefined);
    return { name: p.name, desc: p.short_description ?? "", image: p.image_url, price: effectivePrice(p) };
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
  const { buy } = Route.useSearch();
  const { data: p } = useSuspenseQuery(productQuery(slug));
  const { settings } = useSettings();
  const { profile } = useAuth();
  const cur = settings.currency_symbol;
  const [priceView, setPriceView] = useState<"normal" | "reseller" | "pro" | null>(null);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const images = p ? [p.image_url, ...(p.images ?? [])].filter((x): x is string => !!x) : [];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (buy === "1") {
      setOpen(true);
      void navigate({ to: "/products/$slug", params: { slug }, search: {}, replace: true });
    }
  }, [buy, navigate, slug]);

  // Load purchase options independently from stock calculation so a slow stock RPC
  // never hides the Duration/Validity selector in the Buy Now dialog.
  const pkgs = useQuery(packagesQuery(p.id));
  const packageStock = useQuery({
    queryKey: ["package-stock", p?.id],
    enabled: !!p?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("package_stock", { p_product_id: p!.id });
      if (error) throw error;
      return new Map((data ?? []).map((r: { package_id: string; available: number }) => [r.package_id, Number(r.available)]));
    },
  });
  const packages = (pkgs.data ?? []).map((pkg) => ({
    ...pkg,
    available: pkg.provider_auto_api ? 20 : (packageStock.data?.get(pkg.id) ?? 1),
  }));

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
  const campaignActive = settings.global_discount_enabled === "true" && Number(settings.global_discount_percent) > 0 && Number(settings.global_discount_percent) <= 90 && !!settings.global_discount_until && new Date(settings.global_discount_until).getTime() > Date.now();
  const campaignPercent = campaignActive ? Number(settings.global_discount_percent) : 0;
  const discounted = (price: number) => campaignPercent ? Math.round(price * (100 - campaignPercent)) / 100 : price;
  const hasDiscount = (!!p.discount_price && Number(p.discount_price) > 0) || campaignActive;
  const cat = p.categories as { name: string; slug: string } | null;
  const hasPackages = packages.length > 0;
  const resellerPercent = Math.min(50, Math.max(0, Number(profile?.reseller_discount_percent ?? (settings as any).reseller_discount_percent ?? 7)));
  // Compare Reseller Benefits is a public comparison: always show all three tiers.
  // Purchase eligibility and actual checkout pricing are enforced separately.
  const allowedPriceViews = [
    ["normal", "Normal"],
    ["reseller", "Normal Reseller"],
    ["pro", "Pro Reseller"],
  ] as const;
  const activePriceView = priceView;
  const displayPrice = (pkg: Pkg) => activePriceView === "pro"
    ? (pkg.pro_reseller_price && pkg.pro_reseller_price > 0 ? pkg.pro_reseller_price : null)
    : activePriceView === "reseller"
      ? Math.round(pkg.price * (100 - resellerPercent)) / 100
      : pkg.price;

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
        <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/products" className="hover:text-foreground">Products</Link>
          {cat && <> / <Link to="/products" search={{ category: cat.slug }} className="hover:text-foreground">{cat.name}</Link></>}
        </nav>
        <div className="grid items-start gap-5 sm:gap-7 lg:grid-cols-2 lg:gap-10">
          <div>
            <div className="panel group relative mx-auto aspect-[5/3] w-full max-w-[440px] overflow-hidden border-white/[0.08] bg-surface-2 shadow-glow">
              {images[active] ? (
                <img src={images[active]} alt={p.name} fetchPriority="high" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
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
          <div className="space-y-5 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-4 sm:p-6 lg:sticky lg:top-24">
            <div className="flex flex-wrap gap-2">
              {cat && <Badge variant="secondary">{cat.name}</Badge>}
              {p.is_featured && <Badge>Featured</Badge>}
              {p.is_best_seller && <Badge variant="outline">Best Seller</Badge>}
            </div>
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{p.name}</h1>
            {p.short_description && <p className="text-muted-foreground">{p.short_description}</p>}
            {hasPackages ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-end gap-2">
                    <span className="text-sm text-muted-foreground">From</span>
                    <span className="font-display text-3xl font-bold text-primary">{money(discounted(Math.min(...packages.filter((x) => x.price > 0).map((x) => x.price), Infinity) === Infinity ? 0 : Math.min(...packages.filter((x) => x.price > 0).map((x) => x.price))), cur)}</span>
                  </div>
                  <button type="button" aria-expanded={priceListOpen} onClick={() => setPriceListOpen((value) => !value)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-500 shadow-sm transition-colors hover:border-rose-500/60 hover:bg-rose-500/15 sm:px-3 sm:text-xs">
                    <span>Compare Reseller Benefits</span><span className="text-[11px]">{priceListOpen ? "−" : "+"}</span>
                  </button>
                </div>
                <div className="space-y-2 rounded-xl border border-border p-3">
                  {priceListOpen && (
                    <>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
                        {allowedPriceViews.map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={priceView === key}
                            onClick={() => setPriceView(key)}
                            className={`rounded-md px-1 py-2 text-[10px] font-semibold leading-tight sm:px-2 sm:text-[11px] ${priceView === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                          >{label}</button>
                        ))}
                      </div>
                      {priceView && (
                        <div className="space-y-1.5">
                          {packages.map((pkg) => {
                            const shown = displayPrice(pkg);
                            return <div key={pkg.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-muted-foreground">{pkg.duration || pkg.name}</span><span className="shrink-0 font-semibold">{shown === null ? <span className="text-xs text-muted-foreground">Not set</span> : money(discounted(shown), cur)}</span></div>;
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{packages.length} purchase option{packages.length === 1 ? "" : "s"} available</p>{campaignActive && <Badge variant="destructive">{campaignPercent}% OFF</Badge>}
                <Button size="lg" className="h-12 w-full rounded-full" onClick={() => { setOpen(true); }} >
                  <ShoppingCart className="mr-2 h-4 w-4" /> {pkgs.isLoading ? "Loading options…" : "Buy Now"}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold text-primary">{money(discounted(effectivePrice(p)), cur)}</span>
                  {hasDiscount && <span className="text-muted-foreground line-through">{money(effectivePrice(p), cur)}</span>}{campaignActive && <Badge variant="destructive">{campaignPercent}% OFF</Badge>}
                </div>
                <Button size="lg" className="h-12 w-full rounded-full" onClick={() => setOpen(true)}>
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
          <section className="panel mt-6 p-4 sm:mt-8 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold">Description</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.full_description}</p>
          </section>
        )}
        {(related.data?.length ?? 0) > 0 && (
          <section className="mt-8 sm:mt-10">
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
        product={{ id: p.id, name: p.name, slug: p.slug, unit: effectivePrice(p), stock: p.stock }}
        packages={packages}
        packagesLoading={pkgs.isLoading}
        packagesError={!!pkgs.error}
        onRetryPackages={() => void pkgs.refetch()}
      />
    </SiteLayout>
  );
}

type Pkg = { id: string; name: string; duration: string; price: number; pro_reseller_price?: number | null; available: number; provider_auto_api?: boolean; provider_product_id?: string | null; provider_duration?: string | null };

function BuyDialog({ open, onOpenChange, product, packages, packagesLoading, packagesError, onRetryPackages }: { open: boolean; onOpenChange: (v: boolean) => void; product: { id: string; name: string; unit: number; slug: string; stock: number }; packages: Pkg[]; packagesLoading: boolean; packagesError: boolean; onRetryPackages: () => void }) {
  const { user, profile, refresh } = useAuth();
  const { settings } = useSettings();
  const cur = settings.currency_symbol;
  const publicResellerPercent = Math.min(50, Math.max(0, Number((settings as any).reseller_discount_percent ?? 7)));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [pkgId, setPkgId] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [minDepositOpen, setMinDepositOpen] = useState(false);
  const hasPk = packages.length > 0;
  const sel = packages.find((x) => x.id === pkgId) ?? null;
  const campaignActive = settings.global_discount_enabled === "true" && Number(settings.global_discount_percent) > 0 && Number(settings.global_discount_percent) <= 90 && !!settings.global_discount_until && new Date(settings.global_discount_until).getTime() > Date.now();
  const campaignPercent = campaignActive ? Number(settings.global_discount_percent) : 0;
  const rawUnit = hasPk ? (profile?.is_pro_reseller ? (sel?.pro_reseller_price ?? 0) : (sel?.price ?? 0)) : product.unit;
  const unit = campaignPercent ? Math.round(rawUnit * (100 - campaignPercent)) / 100 : rawUnit;
  const maxQty = Math.max(1, Math.min(20, hasPk ? (sel?.provider_auto_api ? 20 : (sel?.available ?? 1)) : product.stock));
  const discountPercent = profile?.is_reseller && !profile?.is_pro_reseller
    ? Math.min(50, Math.max(0, Number(profile.reseller_discount_percent ?? (settings as any).reseller_discount_percent ?? 7)))
    : 0;
  // Reseller pricing applies to every package, including supplier API packages.
  const discountEligible = discountPercent > 0;
  const resellerUnit = discountEligible ? Math.round(rawUnit * (100 - discountPercent)) / 100 : rawUnit;
  const effectiveUnit = campaignPercent ? Math.round(resellerUnit * (100 - campaignPercent)) / 100 : resellerUnit;
  const originalTotal = rawUnit * qty;
  const baseTotal = effectiveUnit * qty;
  const couponDiscount = couponApplied ? Number(couponApplied.discount) : 0;
  const total = Math.max(0, baseTotal - couponDiscount);
  const balance = Number(profile?.balance ?? 0);
  const insufficient = balance < total;

  async function pasteCoupon() {
    try {
      if (!navigator.clipboard?.readText) {
        toast.error("Paste করতে input-এ চাপ দিয়ে Paste নির্বাচন করুন");
        return;
      }
      const pasted = (await navigator.clipboard.readText()).trim();
      if (!pasted) { toast.error("Clipboard-এ কোনো coupon code নেই"); return; }
      setCouponCode(pasted.toUpperCase());
      setCouponApplied(null);
      toast.success("Coupon code paste হয়েছে");
    } catch {
      toast.error("Paste permission না পেলে input-এ চাপ দিয়ে Paste নির্বাচন করুন");
    }
  }

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) { toast.error("Discount coupon code লিখুন"); return; }
    
    if (hasPk && !sel) { toast.error("আগে Validity / Duration নির্বাচন করুন"); return; }
    setCouponBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("validate_discount_coupon", { p_code: code, p_subtotal: effectiveUnit * qty, p_product_id: product.id });
      if (error) throw error;
      setCouponApplied(data);
      setCouponCode(code);
      toast.success("Coupon " + code + " apply হয়েছে");
    } catch (e: any) {
      setCouponApplied(null);
      const msg = String(e?.message || "");
      const minMatch = msg.match(/COUPON_MIN_ORDER:([0-9.]+)/);
      toast.error(msg.includes("COUPON_EXPIRED") ? "এই coupon-এর মেয়াদ শেষ" : msg.includes("COUPON_LIMIT_REACHED") ? "Coupon ব্যবহারের সীমা শেষ" : msg.includes("COUPON_PRODUCT_NOT_ELIGIBLE") ? "এই coupon এই প্রোডাক্টে ব্যবহার করা যাবে না" : minMatch ? "এই coupon ব্যবহার করতে ন্যূনতম ৳" + minMatch[1] + " অর্ডার করতে হবে" : msg.includes("COUPON_MIN_ORDER") ? "এই coupon-এর minimum order পূরণ হয়নি" : "Coupon সঠিক নয় বা বর্তমানে চালু নেই");
    } finally { setCouponBusy(false); }
  }

  function close(v: boolean) {
    onOpenChange(v);
    if (!v) { setStep(1); setError(""); setQty(1); }
  }
  function addSelectedToCart() {
    if (hasPk && !sel) { setError("আগে Validity / Duration নির্বাচন করুন।"); return; }
    if (unit <= 0 || maxQty < 1) { setError("এই অপশনটি এখন কেনা যাবে না।"); return; }
    addCartItem({
      id: sel ? product.id + ":" + sel.id : product.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: rawUnit,
      image_url: null,
      packageId: sel?.id ?? null,
      variantName: sel?.name ?? null,
      duration: sel?.duration ?? null,
      quantity: qty,
      stock: maxQty,
    });
    toast.success("Cart-এ যোগ হয়েছে");
    close(false);
  }

  function goAddMoney() {
    const shortfall = Math.ceil(total - balance);
    sessionStorage.setItem("kr_return_to", `/products/${product.slug}`);
    close(false);
    if (shortfall < 50) { setMinDepositOpen(true); return; }
    navigate({ to: "/dashboard/wallet", search: { amount: shortfall, auto: true } });
  }

  function confirmMinimumDeposit() {
    setMinDepositOpen(false);
    navigate({ to: "/dashboard/wallet", search: { amount: 50, auto: true } });
  }

  async function buy() {
    if (busy) return;
    if (insufficient) { goAddMoney(); return; }
    if (hasPk && !sel) { setError("আগে Validity / Duration নির্বাচন করুন।"); return; }
    setBusy(true);
    setError("");
    let done = 0;
    let orderId: string | null = null;
    let failure = "";
    let pending = false;

    if (sel?.provider_auto_api && sel.provider_product_id && sel.provider_duration) {
      const { data, error } = await supabase.functions.invoke("banti-checkout", {
        body: { package_id: sel.id, quantity: qty, idempotency_key: crypto.randomUUID(), ...(couponApplied ? { coupon_code: couponApplied.code } : {}) },
      });
      if (error) {
        failure = error.message || "অটো অর্ডার ব্যর্থ হয়েছে।";
      } else if (data?.status === "pending" || data?.status === "processing") {
        pending = true;
        orderId = typeof data.order_id === "string" ? data.order_id : null;
      } else if (data?.status !== "completed" || !Array.isArray(data?.keys) || data.keys.length < qty) {
        failure = typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : "অটো ডেলিভারি নিশ্চিত হয়নি। Support-এর সঙ্গে যোগাযোগ করুন; একই অর্ডার আবার দেবেন না।";
        orderId = typeof data?.order_id === "string" ? data.order_id : null;
      } else {
        done = qty;
        orderId = typeof data.order_id === "string" ? data.order_id : null;
      }
    } else {
      for (let i = 0; i < qty; i++) {
        const result = sel
          ? (couponApplied
              ? await supabase.rpc("purchase_package_with_coupon", { p_package_id: sel.id, p_coupon_code: couponApplied.code })
              : await supabase.rpc("purchase_package", { p_package_id: sel.id }))
          : (couponApplied
              ? await supabase.rpc("purchase_product_with_coupon", { p_product_id: product.id, p_coupon_code: couponApplied.code })
              : await supabase.rpc("purchase_product", { p_product_id: product.id, p_quantity: 1 }));
        if (result.error || typeof result.data !== "string") {
          failure = result.error?.message || "অর্ডারের নিশ্চিত ফলাফল পাওয়া যায়নি। My Orders দেখে নিন।";
          break;
        }
        done++;
        orderId = result.data;
        void telegramNotifyEvent({ data: { event: "order", recordId: result.data } })
          .catch((notifyError) => console.error("Telegram order notification failed", notifyError));
      }
    }

    if (orderId && sel?.provider_auto_api) {
      void telegramNotifyEvent({ data: { event: "order", recordId: orderId } })
        .catch((notifyError) => console.error("Telegram order notification failed", notifyError));
    }
    setBusy(false);
    refresh();
    qc.invalidateQueries({ queryKey: ["product", product.slug] });
    qc.invalidateQueries({ queryKey: ["packages"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["my"] });
    qc.invalidateQueries({ queryKey: ["orders"] });

    if (pending) {
      toast.message("অর্ডার যাচাই চলছে", { description: "My Orders-এ স্ট্যাটাস দেখুন। নিশ্চিত না হওয়া পর্যন্ত একই অর্ডার আবার দেবেন না।" });
      close(false);
      navigate({ to: "/dashboard/orders" });
      return;
    }
    if (failure) {
      setError(failure.includes("INSUFFICIENT_BALANCE")
        ? `ব্যালেন্স কম — ${done}টি অর্ডার সম্পন্ন হয়েছে। Wallet-এ ব্যালেন্স যোগ করুন।`
        : `অর্ডার সম্পন্ন হয়নি। ${done > 0 ? `${done}টি অর্ডার সম্পন্ন হয়েছে। ` : ""}${failure} My Orders দেখে নিন; একই অর্ডার আবার দেওয়ার আগে স্ট্যাটাস যাচাই করুন।`);
      return;
    }

    playMoneyDeduct();
    toast.success(`${done}টি কেনার অর্ডার সফল! Key পাবেন My Orders-এ।`);
    close(false);
    navigate({ to: "/dashboard/orders" });
  }

  const steps = ["Validity", "Account", "Payment"];
  return (
    <>
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader><DialogTitle className="truncate">{product.name}</DialogTitle></DialogHeader>
        {!user ? (
          <div className="space-y-4 text-sm">
            <div className="flex gap-2">
              {["Price List", "Review", "Create Account"].map((label, i) => <div key={label} className={`flex-1 rounded-full py-1 text-center text-[10px] font-semibold ${step >= i + 1 ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>{i + 1}. {label}</div>)}
            </div>
            {step === 1 && <div className="space-y-3">
              <p className="font-semibold">সব Reseller Tier-এর Public Price List</p>
              {hasPk ? <div className="max-h-64 space-y-2 overflow-y-auto">
                {packages.map((pk) => {
                  const resellerBase = Math.round(pk.price * (100 - publicResellerPercent)) / 100;
                  const resellerPrice = campaignPercent ? Math.round(resellerBase * (100 - campaignPercent)) / 100 : resellerBase;
                  const proBase = Number(pk.pro_reseller_price ?? 0);
                  const proPrice = campaignPercent && proBase > 0 ? Math.round(proBase * (100 - campaignPercent)) / 100 : proBase;
                  return <button key={pk.id} type="button" onClick={() => setPkgId(pk.id)} className={`w-full rounded-xl border p-3 text-left ${pkgId === pk.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}>
                    <span className="font-semibold">{pk.duration || pk.name}</span>
                    <span className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                      <span className="rounded-lg bg-surface-2 p-2"><span className="block text-muted-foreground">Normal</span><b className="mt-1 block">{money(pk.price, cur)}</b></span>
                      <span className="rounded-lg bg-surface-2 p-2"><span className="block text-muted-foreground">Reseller</span><b className="mt-1 block">{money(resellerPrice, cur)}</b></span>
                      <span className="rounded-lg bg-surface-2 p-2"><span className="block text-muted-foreground">Pro</span><b className="mt-1 block">{proPrice > 0 ? money(proPrice, cur) : "—"}</b></span>
                    </span>
                  </button>;
                })}
              </div> : <div className="flex justify-between rounded-lg bg-surface-2 p-3"><span>Product price</span><strong>{money(unit, cur)}</strong></div>}
              <div className="flex items-center justify-between"><span className="font-medium">Quantity</span><div className="flex items-center gap-3"><Button type="button" size="icon" variant="secondary" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</Button><strong>{qty}</strong><Button type="button" size="icon" variant="secondary" onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>+</Button></div></div>
              <p className="text-xs text-muted-foreground">Reseller / Pro price প্রযোজ্য হবে সংশ্লিষ্ট membership Active থাকলে।</p>
            </div>}
            {step === 2 && <div className="space-y-3 rounded-lg bg-surface-2 p-4">
              <p className="font-semibold">আপনার Price List</p>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Product</span><strong className="text-right">{product.name}</strong></div>
              {sel && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Validity</span><strong>{sel.duration || sel.name}</strong></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Normal price</span><strong>{money(unit, cur)}</strong></div>
              {sel && <><div className="flex justify-between"><span className="text-muted-foreground">Normal Reseller price</span><strong>{money(campaignPercent ? Math.round(Math.round(sel.price * (100 - publicResellerPercent)) / 100 * (100 - campaignPercent)) / 100 : Math.round(sel.price * (100 - publicResellerPercent)) / 100, cur)}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Pro Reseller price</span><strong>{Number(sel.pro_reseller_price ?? 0) > 0 ? money(campaignPercent ? Math.round(Number(sel.pro_reseller_price) * (100 - campaignPercent)) / 100 : Number(sel.pro_reseller_price), cur) : "Not set"}</strong></div></>}
              <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><strong>{qty}</strong></div>
              <div className="flex justify-between border-t border-border pt-3 text-base"><span className="font-bold">Total</span><strong className="text-primary">{money(unit * qty, cur)}</strong></div>
            </div>}
            {step === 3 && <div className="space-y-3 text-center">
              <p className="font-semibold">Price list দেখা সম্পন্ন। Order করতে account খুলুন অথবা Login করুন।</p>
              <Button asChild className="w-full"><Link to="/auth" search={{ mode: "register", product: product.slug }}>Create Account & Continue</Link></Button>
              <Button asChild variant="outline" className="w-full"><Link to="/auth" search={{ mode: "login", product: product.slug }}>Already have an account? Login</Link></Button>
            </div>}
            <div className="flex justify-end gap-2">
              {step > 1 && <Button type="button" variant="secondary" onClick={() => setStep((v) => v - 1)}>Back</Button>}
              {step < 3 && <Button type="button" onClick={() => setStep((v) => v + 1)} disabled={packagesLoading || (hasPk && !sel) || (!hasPk && unit <= 0)}>Next</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            {packagesLoading && packages.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Loading available durations…
              </div>
            )}
            {packagesError && packages.length === 0 && (
              <div className="space-y-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                <p>Duration list could not be loaded. Please try again.</p>
                <Button type="button" size="sm" variant="secondary" onClick={onRetryPackages}>Retry</Button>
              </div>
            )}
            <div className="flex gap-2">
              {steps.map((s, i) => (
                <div key={s} className={`flex-1 rounded-full py-1 text-center text-xs font-semibold ${step >= i + 1 ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>{i + 1}. {s}</div>
              ))}
            </div>
            {step === 1 && (
              <div className="space-y-4">
                {hasPk && (
                  <div className="space-y-2">
                    <span className="font-medium">Choose Validity / Duration</span>
                    {packages.length > 0 ? (
                      <select
                        className="h-11 w-full rounded-lg border border-input bg-background px-3"
                        value={pkgId}
                        onChange={(e) => { setPkgId(e.target.value); setQty(1); setCouponApplied(null); setError(""); }}
                      >
                        <option value="">Select an option</option>
                        {packages.map((pk) => {
                          const selectedBase = profile?.is_pro_reseller ? (pk.pro_reseller_price ?? 0) : profile?.is_reseller ? Math.round(pk.price * (100 - discountPercent)) / 100 : pk.price;
                          const selectedPrice = campaignPercent ? Math.round(selectedBase * (100 - campaignPercent)) / 100 : selectedBase;
                          return (
                            <option key={pk.id} value={pk.id} disabled={selectedBase <= 0}>
                              {pk.duration || pk.name} — {selectedBase > 0 ? money(selectedPrice, cur) : "Pro price not set"}
                            </option>
                          );
                        })}
                      </select>
                    ) : !packagesLoading && !packagesError ? (
                      <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground">No active duration options are available for this product.</p>
                    ) : null}
                  </div>
                )}
                <div className="space-y-1.5">
                  <span className="font-medium">Quantity</span>
                  <div className="flex items-center gap-3">
                    <Button type="button" size="icon" variant="secondary" onClick={() => { setQty((q) => Math.max(1, q - 1)); setCouponApplied(null); }}>−</Button>
                    <span className="w-8 text-center text-lg font-bold">{qty}</span>
                    <Button type="button" size="icon" variant="secondary" onClick={() => { setQty((q) => Math.min(maxQty, q + 1)); setCouponApplied(null); }}>+</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {couponApplied ? (
                    <div className="flex items-center justify-between gap-2 text-xs text-emerald-600">
                      <span>Coupon {couponApplied.code} applied · −{money(couponDiscount, cur)}</span>
                      <button type="button" className="text-muted-foreground underline" onClick={() => { setCouponApplied(null); setCouponCode(""); }}>Remove</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setCouponOpen((value) => !value)} className="text-xs font-medium text-primary underline underline-offset-2">
                      {couponOpen ? "Hide discount coupon" : "Have a discount coupon?"}
                    </button>
                  )}
                  {couponOpen && !couponApplied && <div className="flex items-center gap-1.5">
                    <input type="text" inputMode="text" autoComplete="off" autoCorrect="off" spellCheck={false} style={{ fontSize: "14px" }} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs uppercase" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponApplied(null); }} placeholder="Coupon code" maxLength={40} />
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => void pasteCoupon()}>Paste</Button>
                    <Button type="button" size="sm" variant="secondary" className="h-8 px-2 text-xs" disabled={couponBusy || !couponCode.trim()} onClick={() => void applyCoupon()}>{couponBusy ? "…" : "Apply"}</Button>
                  </div>}
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Total</span><span className="text-primary">{money(total, cur)}</span></div>
                {discountEligible && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Price</span><span className="text-right"><span className="mr-2 text-muted-foreground line-through">{money(originalTotal, cur)}</span><span className="font-semibold text-primary">{money(baseTotal, cur)}</span></span></div>}
              </div>
            )}
            {step === 2 && (
              <div className="space-y-2 rounded-lg bg-surface-2 p-3">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Name</span><span className="font-medium">{profile?.name || "—"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Email</span><span className="min-w-0 break-all text-right font-medium">{profile?.email ?? user.email}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Balance</span><span className={insufficient ? "text-destructive" : "text-success"}>{money(balance, cur)}</span></div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-2">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Item</span><span className="text-right font-medium">{sel ? sel.name : product.name} × {qty}</span></div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Total</span><span className="text-primary">{money(total, cur)}</span></div>
                {discountEligible && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Price</span><span className="text-right"><span className="mr-2 text-muted-foreground line-through">{money(originalTotal, cur)}</span><span className="font-semibold text-primary">{money(baseTotal, cur)}</span></span></div>}
                {insufficient && <p className="rounded-lg bg-primary/10 p-3 text-primary">ব্যালেন্স কম। "Add money" চাপলে পেমেন্ট পেজ খুলবে।</p>}
              </div>
            )}
            {error && <p className="rounded-lg bg-destructive/10 p-3 text-destructive">{error}</p>}
          </div>
        )}
        {user && (
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => (step === 1 ? close(false) : setStep(step - 1))}>{step === 1 ? "Cancel" : "Back"}</Button>
            {step === 1 && (
              <Button variant="outline" onClick={addSelectedToCart} disabled={(hasPk && !sel) || unit <= 0 || busy}>
                <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
              </Button>
            )}
            {step < 3 ? (
              <Button disabled={packagesLoading || (hasPk && !sel) || (!hasPk && packagesError) || unit <= 0} onClick={() => setStep(step + 1)}>Next</Button>
            ) : (
              <Button onClick={buy} disabled={busy}>{busy ? "Processing…" : insufficient ? "Add money" : `Pay Now ${money(total, cur)}`}</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
    <Dialog open={minDepositOpen} onOpenChange={setMinDepositOpen}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader><DialogTitle>সর্বনিম্ন ডিপোজিট ৳৫০</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">আপনার নির্বাচিত পণ্যের দাম ৳৫০-এর কম হলেও ডিপোজিটের সর্বনিম্ন পরিমাণ ৳৫০। আপনি কি ৳৫০ ডিপোজিট করে পেমেন্টে যেতে চান?</p>
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => setMinDepositOpen(false)}>না, ফিরে যান</Button>
          <Button onClick={confirmMinimumDeposit}>হ্যাঁ, পেমেন্টে যান</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
