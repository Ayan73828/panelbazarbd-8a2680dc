import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Trash2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/site";
import { useSettings } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { readCart, removeCartItem, saveCart, clearCart, type CartItem } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { telegramNotifyEvent } from "@/lib/telegram-notifications.functions";
import { playMoneyDeduct } from "@/lib/sounds";

export const Route = createFileRoute("/cart")({ component: CartPage });
function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { settings } = useSettings();
  const { user, profile, refresh } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    const refreshCart = () => setItems(readCart());
    refreshCart();
    window.addEventListener("cart-updated", refreshCart);
    window.addEventListener("storage", refreshCart);
    return () => { window.removeEventListener("cart-updated", refreshCart); window.removeEventListener("storage", refreshCart); };
  }, []);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const balance = Number(profile?.balance ?? 0);
  const insufficient = balance < total;
  function updateQty(id: string, quantity: number) {
    const next = readCart().map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min(item.stock, quantity)) } : item);
    saveCart(next); setItems(next);
  }
  async function checkout() {
    if (!user) { toast.error("Checkout করতে লগইন করুন"); navigate({ to: "/auth", search: { mode: "login" } }); return; }
    if (!items.length || busy) return;
    if (insufficient) { toast.error("ব্যালেন্স কম। আগে Add Balance করুন।"); navigate({ to: "/dashboard/wallet", search: { amount: Math.ceil(total - balance), auto: true } }); return; }
    setBusy(true); setErr("");
    const completed = new Set<string>();
    let failed = "";
    for (const item of items) {
      for (let i = 0; i < item.quantity; i++) {
        const result = item.packageId
          ? await supabase.rpc("purchase_package", { p_package_id: item.packageId })
          : await supabase.rpc("purchase_product", { p_product_id: item.productId, p_quantity: 1 });
        if (result.error) { failed = result.error.message; break; }
        if (typeof result.data === "string") {
          void telegramNotifyEvent({ data: { event: "order", recordId: result.data } }).catch((e) => console.error("Telegram order notification failed", e));
        }
      }
      if (failed) break;
      completed.add(item.id);
    }
    const remaining = readCart().filter((item) => !completed.has(item.id));
    saveCart(remaining); setItems(remaining);
    await refresh();
    if (completed.size > 0) playMoneyDeduct();
    setBusy(false);
    if (failed) { setErr("কিছু অর্ডার সম্পন্ন হয়েছে, কিন্তু একটি অর্ডার ব্যর্থ হয়েছে: " + failed + "। সফল অর্ডারগুলো My Orders-এ দেখুন।"); return; }
    clearCart(); setItems([]);
    toast.success("সব পণ্যের অর্ডার সফল হয়েছে!");
    navigate({ to: "/dashboard/orders" });
  }
  return <SiteLayout><div className="mx-auto w-full max-w-6xl px-4 py-8">
    <PageHeader title="Shopping Cart" description="Validation বেছে নিন, সব পণ্য একসঙ্গে checkout করুন." />
    {!items.length ? <div className="panel p-8 text-center"><ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Your cart is empty</p><p className="mt-1 text-sm text-muted-foreground">প্রোডাক্টে Buy Now চাপুন, Validation/Duration বেছে Add to Cart করুন।</p><Button asChild className="mt-4 rounded-full"><Link to="/products">Browse products</Link></Button></div> :
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">{items.map((item) => <article key={item.id} className="panel flex gap-3 p-3">
          {item.image_url ? <img src={item.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <div className="h-16 w-16 rounded-lg bg-surface-2" />}
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.name}</p>{item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}{item.duration ? " · " + item.duration : ""}</p>}<p className="mt-1 text-sm font-bold text-primary">{money(item.price, settings.currency_symbol)} × {item.quantity}</p>
            <div className="mt-2 flex items-center gap-2"><Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => updateQty(item.id, item.quantity - 1)}><Minus className="h-3 w-3" /></Button><span className="w-5 text-center">{item.quantity}</span><Button size="icon" variant="secondary" className="h-8 w-8" disabled={item.quantity >= item.stock} onClick={() => updateQty(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></Button></div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Remove item" onClick={() => { removeCartItem(item.id); setItems(readCart()); }}><Trash2 className="h-4 w-4" /></Button>
        </article>)}</div>
        <aside className="panel h-fit space-y-3 p-4"><h2 className="font-semibold">Order summary</h2><div className="flex justify-between text-sm"><span className="text-muted-foreground">Items</span><span>{items.reduce((n, item) => n + item.quantity, 0)}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Wallet balance</span><span>{money(balance, settings.currency_symbol)}</span></div><div className="flex justify-between border-t pt-3 font-bold"><span>Total</span><span className="text-primary">{money(total, settings.currency_symbol)}</span></div>
          {insufficient && <p className="rounded-lg bg-primary/10 p-3 text-xs text-primary">ব্যালেন্স কম। Checkout চাপলে ঘাটতি Add Balance করতে পারবেন।</p>}{err && <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{err}</p>}
          <Button className="w-full rounded-full" disabled={busy} onClick={checkout}>{busy ? "Processing…" : insufficient ? "Add Balance & Checkout" : "Checkout · " + money(total, settings.currency_symbol)}</Button><p className="text-xs text-muted-foreground">সব আইটেমের মোট মূল্য দেখানো হচ্ছে; checkout-এ অর্ডারগুলো একে একে যাচাই হবে।</p>
        </aside>
      </div>}
  </div></SiteLayout>;
}
