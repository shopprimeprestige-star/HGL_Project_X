import type { Product } from "./catalog";
import { ProductVisual } from "./ProductVisual";
import { HairSystemVisual } from "./HairSystemVisual";

/**
 * Immagine prodotto.
 * 1) Se il prodotto ha `image` (una TUA foto o royalty-free) → mostra la foto.
 * 2) Altrimenti: SVG accurato per le protesi, gradiente per la cura.
 */
export function ShopVisual({
  product,
  className = "",
  compact = false,
}: {
  product: Product;
  className?: string;
  compact?: boolean;
}) {
  if (product.image) {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-[#0b1b3a] ${className}`}>
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        {/* brackets in stile store */}
        <span className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l-2 border-t-2 border-brand/80" />
        <span className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r-2 border-t-2 border-brand/80" />
        <span className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-brand/80" />
        <span className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-brand/80" />
      </div>
    );
  }
  if (product.category === "toupee") {
    return <HairSystemVisual product={product} className={className} compact={compact} />;
  }
  return <ProductVisual product={product} className={className} compact={compact} />;
}
