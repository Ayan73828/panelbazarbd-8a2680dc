import { Link } from "@tanstack/react-router";
import { ExternalLink, ImageIcon, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/site";

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
  const hasDiscount = !!product.discount_price && Number(product.discount_price) > 0;

  return (
    <article className="panel group flex flex-col overflow-hidden transition-colors hover:border-primary/40">
      <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-2">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
          <div className="absolute left-2 top-2 flex gap-1.5">
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

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-xs text-muted-foreground">
          <span className="truncate">{categoryName ?? "Uncategorized"}</span>
        </div>

        <Link to="/products/$slug" params={{ slug: product.slug }}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
            {product.name}
          </h3>
        </Link>

        {product.short_description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{product.short_description}</p>
        )}

        <div className="mt-auto flex items-end gap-2 pt-2">
          <span className="text-lg font-bold text-primary">
            {money(hasDiscount ? product.discount_price : product.price, currency)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">
              {money(product.price, currency)}
            </span>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button asChild size="sm" className="flex-1 rounded-full">
            <Link to="/products/$slug" params={{ slug: product.slug }}>
              Buy Now
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
