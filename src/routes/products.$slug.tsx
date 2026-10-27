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

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
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
        supabase.from("product_packages").select("id,name,duration,price,sort_order,provider_auto_api,provider_product_id,provider_duration").eq("product_id", p!.id).eq("is_active", true).order("sort_order"),
        supabase.rpc("package_stock", { p_product_id: p!.id }),
      ]);
      if (error) throw error;
      const st = new Map((stock ?? []).map((r: { package_id: string; available: number }) => [r.package_id, Number(r.available)]));
      return (data ?? []).map((x) => ({ ...x, price: Number(x.price), available: x.provider_auto_api ? 1 : (st.get(x.id) ?? 0) }));
    },
  });

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
  const packages = pkgs.data ?? [];
  const hasPackages = packages.length > 0;

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
        <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/products" className="hover:text-foreground">Products</Link>
          {cat && <> / <Link to="/products" search={{ category: cat.slug }} className="hover:text-foreground">{cat.name}</Link></>}
        </nav>
        <div className="grid items-start gap-5 sm:gap-7 lg:grid-cols-2 lg:gap-10">
          <div>
            <div className="panel group relative aspect-[4/3] overflow-hidden border-white/[0.08] bg-surface-2 shadow-glow">
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
                <div className="flex items-end gap-2">
                  <span className="text-sm text-muted-foreground">From</span>
                  <span className="font-display text-3xl font-bold text-primary">{money(discounted(Math.min(...packages.filter((x) => x.price > 0).map((x) => x.price), Infinity) === Infinity ? 0 : Math.min(...packages.filter((x) => x.price > 0).map((x) => x.price))), cur)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{packages.length} purchase option{packages.length === 1 ? "" : "s"} available</p>{campaignActive && <Badge variant="destructive">{campaignPercent}% OFF</Badge>}
                <Button size="lg" className="h-12 w-full rounded-full" disabled={!packages.some((x) => x.price > 0)} onClick={() => setOpen(true)}>
                  <ShoppingCart className="mr-2 h-4 w-4" /> Buy Now
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold text-primary">{money(discounted(effectivePrice(p)), cur)}</span>
                  {hasDiscount && <span className="text-muted-foreground line-through">{money(effectivePrice(p), cur)}</span>}{campaignActive && <Badge variant="destructive">{campaignPercent}% OFF</Badge>}
                </div>
                <Button size="lg" className="h-12 w-full rounded-full" disabled={pkgs.isLoading} onClick={() => setOpen(true)}>
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
      />
    </SiteLayout>
  );
}

type Pkg = { id: string; name: string; duration: string; price: number; available: number; provider_auto_api?: boolean; provider_product_id?: string | null; provider_duration?: string | null };

function BuyDialog({ open, onOpenChange, product, packages }: { open: boolean; onOpenChange: (v: boolean) => void; product: { id: string; name: string; unit: number; slug: string; stock: number }; packages: Pkg[] }) {
  const { user, profile, refresh } = useAuth();
  const { settings } = useSettings();
  const cur = settings.currency_symbol;
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
  const [minDepositOpen, setMinDepositOpen] = useState(false);
  const hasPk = packages.length > 0;
  const sel = packages.find((x) => x.id === pkgId) ?? null;
  const campaignActive = settings.global_discount_enabled === "true" && Number(settings.global_discount_percent) > 0 && Number(settings.global_discount_percent) <= 90 && !!settings.global_discount_until && new Date(settings.global_discount_until).getTime() > Date.now();
  const campaignPercent = campaignActive ? Number(settings.global_discount_percent) : 0;
  const rawUnit = hasPk ? (sel?.price ?? 0) : product.unit;
  const unit = campaignPercent ? Math.round(rawUnit * (100 - campaignPercent)) / 100 : rawUnit;
  const maxQty = Math.max(1, Math.min(20, hasPk ? (sel?.provider_auto_api ? 20 : (sel?.available ?? 1)) : product.stock));
  const discountPercent = profile?.is_reseller ? Math.min(50, Math.max(0, Number(profile.reseller_discount_percent ?? 7))) : 0;
  const discountEligible = discountPercent > 0 && !sel?.provider_auto_api;
  const effectiveUnit = discountEligible ? Math.round(unit * (100 - discountPercent)) / 100 : unit;
  const originalTotal = unit * qty;
  const baseTotal = effectiveUnit * qty;
  const couponDiscount = couponApplied ? Number(couponApplied.discount) * qty : 0;
  const total = Math.max(0, baseTotal - couponDiscount);
  const balance = Number(profile?.balance ?? 0);
  const insufficient = balance < total;

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) { toast.error("Discount coupon code লিখুন"); return; }
    if (sel?.provider_auto_api) { toast.error("এই auto-delivery product-এ coupon এখন সমর্থিত নয়"); return; }
    if (hasPk && !sel) { toast.error("আগে Validity / Duration নির্বাচন করুন"); return; }
    setCouponBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("validate_discount_coupon", { p_code: code, p_subtotal: effectiveUnit });
      if (error) throw error;
      setCouponApplied(data);
      setCouponCode(code);
      toast.success("Coupon " + code + " apply হয়েছে");
    } catch (e: any) {
      setCouponApplied(null);
      const msg = String(e?.message || "");
      toast.error(msg.includes("COUPON_EXPIRED") ? "এই coupon-এর মেয়াদ শেষ" : msg.includes("COUPON_LIMIT_REACHED") ? "Coupon ব্যবহারের সীমা শেষ" : msg.includes("COUPON_MIN_ORDER") ? "এই coupon-এর minimum order পূরণ হয়নি" : "Coupon সঠিক নয় বা বর্তমানে চালু নেই");
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
      price: unit,
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
        body: { package_id: sel.id, quantity: qty, idempotency_key: crypto.randomUUID() },
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
            <p className="text-muted-foreground">কিনতে আগে লগইন করুন।</p>
            <Button asChild className="w-full"><Link to="/auth" search={{ mode: "login" }}>Login</Link></Button>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex gap-2">
              {steps.map((s, i) => (
                <div key={s} className={`flex-1 rounded-full py-1 text-center text-xs font-semibold ${step >= i + 1 ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>{i + 1}. {s}</div>
              ))}
            </div>
            {step === 1 && (
              <div className="space-y-4">
                {hasPk && (
                  <label className="block space-y-1.5">
                    <span className="font-medium">Choose Validity / Duration</span>
                    <select className="h-11 w-full rounded-lg border border-input bg-background px-3" value={pkgId} onChange={(e) => { setPkgId(e.target.value); setQty(1); setCouponApplied(null); }}>
                      <option value="">Select an option</option>
                      {packages.map((pk) => (
                        <option key={pk.id} value={pk.id} disabled={pk.price <= 0}>
                          {pk.duration || pk.name} — {campaignPercent ? <><span className="line-through text-muted-foreground">{money(pk.price, cur)}</span> <span className="font-semibold text-primary">{money(Math.round(pk.price * (100 - campaignPercent)) / 100, cur)}</span></> : money(pk.price, cur)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="space-y-1.5">
                  <span className="font-medium">Quantity</span>
                  <div className="flex items-center gap-3">
                    <Button type="button" size="icon" variant="secondary" onClick={() => { setQty((q) => Math.max(1, q - 1)); setCouponApplied(null); }}>−</Button>
                    <span className="w-8 text-center text-lg font-bold">{qty}</span>
                    <Button type="button" size="icon" variant="secondary" onClick={() => { setQty((q) => Math.min(maxQty, q + 1)); setCouponApplied(null); }}>+</Button>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="block space-y-1.5">
                    <span className="font-medium">Discount Coupon</span>
                    <span className="text-xs text-muted-foreground">কুপন থাকলে কোড দিন, না থাকলে ফাঁকা রাখুন।</span>
                    <div className="flex gap-2">
                      <input className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 uppercase" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponApplied(null); }} placeholder="ENTER COUPON CODE" maxLength={40} />
                      <Button type="button" variant="secondary" disabled={couponBusy || !couponCode.trim() || !!sel?.provider_auto_api} onClick={() => void applyCoupon()}>{couponBusy ? "Checking…" : couponApplied ? "Apply again" : "Apply"}</Button>
                    </div>
                  </label>
                  {couponApplied && <div className="flex items-center justify-between text-sm text-emerald-600"><span>Coupon {couponApplied.code} applied</span><span>−{money(couponDiscount, cur)}</span></div>}
                  {sel?.provider_auto_api && <p className="text-xs text-muted-foreground">Auto-delivery items currently do not support discount coupons.</p>}
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Total</span><span className="text-primary">{money(total, cur)}</span></div>
                {discountEligible && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reseller discount ({discountPercent}%)</span><span><span className="mr-2 text-muted-foreground line-through">{money(originalTotal, cur)}</span><span className="text-primary">−{money(originalTotal - total, cur)}</span></span></div>}
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
                {discountEligible && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reseller discount ({discountPercent}%)</span><span><span className="mr-2 text-muted-foreground line-through">{money(originalTotal, cur)}</span><span className="text-primary">−{money(originalTotal - total, cur)}</span></span></div>}
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
              <Button disabled={(hasPk && !sel) || unit <= 0} onClick={() => setStep(step + 1)}>Next</Button>
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
