export const DEFAULT_SETTINGS = {
  site_name: "PANEL BAZAR BD",
  maintenance_mode: "false",
  site_description: "Premium digital products and reseller panel services.",
  logo_url: "",
  favicon_url: "/favicon.ico",
  primary_color: "#22c55e",
  secondary_color: "#0ea5e9",
  currency_symbol: "Tk",
  contact_phone: "",
  whatsapp_number: "",
  telegram_username: "",
  contact_email: "",
  hero_title: "PANEL BAZAR BD",
  hero_subtitle: "",
  hero_image_url: "",
  hero_button_text: "Browse Products",
  hero_button_url: "/products",
  announcement_text: "",
  footer_text: "",
  footer_copyright: "",
  bkash_number: "",
  nagad_number: "",
};

export function money(value: number | null | undefined, symbol = "Tk") {
  const n = Number(value ?? 0);
  return `${symbol} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function effectivePrice(p: { price: number; discount_price?: number | null }) {
  return p.discount_price && Number(p.discount_price) > 0 ? Number(p.discount_price) : Number(p.price);
}

/** Builds a wa.me link from a stored phone number (Bangladesh local numbers get 88 prefix). */
export function waLink(raw: string, text?: string) {
  let digits = (raw || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `88${digits.slice(1)}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}

export function tgLink(raw: string) {
  const handle = (raw || "").trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
  return handle ? `https://t.me/${handle}` : "";
}

export function telLink(raw: string) {
  const digits = (raw || "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

export const ORDER_STATUSES = ["pending", "processing", "completed", "cancelled", "refunded"] as const;
export const PRODUCT_STATUSES = ["in_stock", "limited", "out_of_stock", "coming_soon"] as const;

export function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
