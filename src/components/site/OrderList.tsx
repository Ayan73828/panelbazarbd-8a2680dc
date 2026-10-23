import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { formatDate, StatusBadge } from "@/components/site/Confirm";
import { money } from "@/lib/site";

type Order = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  status: string;
  created_at: string;
  note: string | null;
  delivered_key?: string | null;
  products: { slug: string; image_url: string | null; purchase_url: string | null; setup_tutorial_url?: string | null } | null;
};

export function OrderList({
  orders,
  currency,
  showAccess = false,
}: {
  orders: Order[];
  currency: string;
  showAccess?: boolean;
}) {
  return (
    <div className="space-y-2">
      {orders.map((o) => (
        <div key={o.id} className="panel flex flex-wrap items-center gap-3 p-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            {o.products?.image_url && (
              <img src={o.products.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {o.products ? (
              <Link to="/products/$slug" params={{ slug: o.products.slug }} className="block truncate text-sm font-semibold hover:text-primary">
                {o.product_name}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold">{o.product_name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {o.quantity} × {money(o.unit_price, currency)} · {formatDate(o.created_at)}
            </p>
            {o.note && <p className="mt-1 text-xs text-muted-foreground">Note: {o.note}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm font-bold">{money(o.total, currency)}</span>
            <StatusBadge status={o.status} />
          </div>
          {o.delivered_key && (
            <div className="flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
              <KeyRound className="h-4 w-4 shrink-0 text-primary" />
              <code className="min-w-0 flex-1 break-all text-sm font-semibold">{o.delivered_key}</code>
              <button
                type="button"
                aria-label="Copy key"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
                onClick={() => { void navigator.clipboard.writeText(o.delivered_key!); toast.success("Key copied"); }}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="w-full text-[11px] text-muted-foreground">Order ID: {o.id}</p>
          {o.status === "completed" && o.products?.setup_tutorial_url && (o.products.setup_tutorial_url.startsWith("https://") || o.products.setup_tutorial_url.startsWith("http://")) && (
            <a href={o.products.setup_tutorial_url} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-1 rounded-lg border border-primary/20 bg-primary/5 py-2 text-xs font-semibold text-primary">
              📖 Setup Tutorial <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {showAccess && o.status === "completed" && o.products?.purchase_url && (
            <a
              href={o.products.purchase_url}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary/10 py-2 text-xs font-semibold text-primary"
            >
              Open access <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
