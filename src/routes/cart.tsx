import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/site";
import { useSettings } from "@/hooks/useSite";
import { readCart, removeCartItem, type CartItem } from "@/lib/cart";

export const Route = createFileRoute("/cart")({ component: CartPage });
function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const { settings } = useSettings();
  useEffect(() => {
    const refresh = () => setItems(readCart());
    refresh();
    window.addEventListener("cart-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("cart-updated", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  return <SiteLayout><div className="mx-auto w-full max-w-6xl px-4 py-8">
    <PageHeader title="Shopping Cart" description="Your saved products." />
    {items.length === 0 ? <div className="panel p-8 text-center"><ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Your cart is empty</p><p className="mt-1 text-sm text-muted-foreground">Add products to your cart to see them here.</p><Button asChild className="mt-4 rounded-full"><Link to="/products">Browse products</Link></Button></div> : <div className="space-y-3">{items.map((item) => <article key={item.id} className="panel flex items-center gap-3 p-3">
      {item.image_url ? <img src={item.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <div className="h-16 w-16 rounded-lg bg-surface-2" />}
      <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{item.name}</p><p className="mt-1 text-sm font-bold text-primary">{money(item.price, settings.currency_symbol)}</p><Button asChild size="sm" className="mt-2 rounded-full"><Link to="/products/$slug" params={{ slug: item.slug }}>Choose options / Buy</Link></Button></div>
      <Button variant="ghost" size="icon" aria-label="Remove from cart" onClick={() => { removeCartItem(item.id); setItems(readCart()); }}><Trash2 className="h-4 w-4" /></Button>
    </article>)}</div>}
  </div></SiteLayout>;
}
