export type CartItem = { id: string; slug: string; name: string; price: number; image_url: string | null };
const KEY = "panelbazarbd_cart_v1";
export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === "string" && typeof x.slug === "string") as CartItem[] : [];
  } catch { return []; }
}
export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}
export function addCartItem(item: CartItem) {
  const items = readCart();
  const index = items.findIndex((x) => x.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  saveCart(items);
}
export function removeCartItem(id: string) { saveCart(readCart().filter((x) => x.id !== id)); }
export function clearCart() { saveCart([]); }
export function getCartCount() { return readCart().length; }
