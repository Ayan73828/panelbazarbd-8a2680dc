import { Link } from "@tanstack/react-router";
import { ExternalLink, ImageIcon, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/site";
import { useSettings } from "@/hooks/useSite";

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  image_url: string | null;
  price: number;
  discount_price: number | null;
  stock: number;
  status: string;
  demo_url: string | null;
  is_featured: boolean;
  is_best_seller: boolean;
  category_id: string | null;
  provider_name?: string | null;
};

export function ProductCard({
  product,
  categoryName,
  currency,
}: {
  product: ProductRow;
  categoryName?: string | undefined;
  currency: string;
}) {
  const { settings } = useSettings();
  const campaignActive = settings.global_discount_enabled === "true"
    && Number(settings.global_discount_percent) > 0
    && Number(settings.global_discount_percent) <= 90
    && !!settings.global_discount_until
    && new Date(settings.global_discount_until).getTime() > Date.now();
  const basePrice = !!product.discount_price && Number(product.discount_price) > 0 ? Number(product.discount_price) : Number(product.price);
  const displayPrice = campaignActive ? Math.round(basePrice * (1 - Number(settings.global_discount_percent) / 100) * 100) / 100 : basePrice;
  const hasDiscount = (!!product.discount_price && Number(product.discount_price) > 0) || campaignActive;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm shadow-black/[0.03] transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/[0.08]">
      <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-muted/70 via-surface-2 to-primary/10">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
          <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 sm:left-3 sm:top-3">
            {product.is_featured && (
              <Badge className="bg-primary text-primary-foreground">Featured</Badge>
            )}
            {product.is_best_seller && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3" /> Best
              </Badge>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
          <span className="truncate">{categoryName ?? "Uncategorized"}</span>
        </div>

        <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug tracking-tight transition-colors group-hover:text-primary sm:text-base">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-end gap-2">
          <span className="text-base font-black leading-tight tracking-tight text-primary sm:text-xl">
            {money(displayPrice, currency)}
          </span>
          {hasDiscount && (
            <span className="text-xs leading-tight text-muted-foreground line-through">
              {money(campaignActive ? basePrice : product.price, currency)}
            </span>
          )}
        </div>

        {product.short_description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{product.short_description}</p>
        )}

        <div className="mt-2 flex gap-2 border-t border-border/60 pt-3 [&_button]:min-h-10">
          <Button asChild size="sm" className="flex-1 rounded-full">
            <Link to="/products/$slug" params={{ slug: product.slug }}>
              View product
            </Link>
          </Button>
          {product.demo_url && (
            <Button asChild size="sm" variant="secondary" className="rounded-full">
              <a href={product.demo_url} target="_blank" rel="noreferrer">
                Demo <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="panel overflow-hidden">
      <div className="aspect-[16/10] w-full animate-pulse bg-surface-2" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-8 w-full animate-pulse rounded-full bg-surface-2" />
      </div>
    </div>
  );
}
