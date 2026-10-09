import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Star, ShieldCheck, Truck, RotateCcw, Check, Minus, Plus, ChevronRight, ShoppingBag } from "lucide-react";
import { CATEGORIES, PRODUCTS, formatPrice, getProduct } from "@/shop/catalog";
import { ShopVisual } from "@/shop/ShopVisual";
import { useCart } from "@/shop/CartContext";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/prodotto/$slug")({
  component: ProductDetail,
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const product = getProduct(slug);
  const navigate = useNavigate();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    getProduct(slug)?.variants?.forEach((v) => (init[v.label] = v.options[0]));
    return init;
  });

  if (!product) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-20 text-center">
        <p className="text-white/60">Prodotto non trovato.</p>
        <Link to="/shop" className="mt-4 inline-block text-brand hover:underline">
          Torna al catalogo
        </Link>
      </div>
    );
  }

  const category = CATEGORIES.find((c) => c.key === product.category);
  const related = PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  const addToCart = (go: boolean) => {
    add(product, qty, product.variants?.length ? variant : undefined);
    if (go) navigate({ to: "/shop/carrello" });
    else toast.success(`${product.name} × ${qty} aggiunto al carrello`);
  };

  return (
    <div className="space-y-12">
      {/* breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-white/45">
        <Link to="/shop" className="hover:text-white">Shop</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white/70">{category?.label}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white/70">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* visual */}
        <div className="space-y-3">
          <ShopVisual product={product} className="aspect-square w-full" />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <ShieldCheck className="mx-auto mb-1 h-5 w-5 text-brand" />
              <span className="text-[11px] text-white/60">Qualità premium</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <Truck className="mx-auto mb-1 h-5 w-5 text-brand" />
              <span className="text-[11px] text-white/60">Spedizione 24/48h</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <RotateCcw className="mx-auto mb-1 h-5 w-5 text-brand" />
              <span className="text-[11px] text-white/60">Reso 14 giorni</span>
            </div>
          </div>
        </div>

        {/* info */}
        <div className="space-y-5">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-brand">{category?.label}</span>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-0.5 text-amber-300">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4" fill={i < Math.round(product.rating) ? "currentColor" : "none"} strokeWidth={1.5} />
                ))}
              </span>
              <span className="text-white/50">{product.rating} · {product.reviews} recensioni</span>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold">{formatPrice(product.price)}</span>
            {product.compareAt && (
              <>
                <span className="pb-1 text-lg text-white/40 line-through">{formatPrice(product.compareAt)}</span>
                <span className="mb-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  -{Math.round((1 - product.price / product.compareAt) * 100)}%
                </span>
              </>
            )}
          </div>

          <p className="text-white/70">{product.description}</p>

          {/* varianti */}
          {product.variants?.map((v) => (
            <div key={v.label} className="space-y-2">
              <span className="text-sm font-medium text-white/80">{v.label}</span>
              <div className="flex flex-wrap gap-2">
                {v.options.map((opt) => {
                  const active = variant[v.label] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setVariant((prev) => ({ ...prev, [v.label]: opt }))}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        active ? "border-brand bg-brand/15 text-white" : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
                      }`}
                    >
                      {active && <Check className="mr-1 inline h-3.5 w-3.5 text-brand" />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* qty + add */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center rounded-lg border border-white/15 bg-white/5">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2.5 text-white/70 hover:text-white">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-medium">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(99, q + 1))} className="px-3 py-2.5 text-white/70 hover:text-white">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => addToCart(false)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand bg-brand/10 px-5 py-3 font-medium text-white transition hover:bg-brand/20"
            >
              <ShoppingBag className="h-4 w-4" /> Aggiungi al carrello
            </button>
          </div>
          <button
            onClick={() => addToCart(true)}
            className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:brightness-110"
          >
            Acquista ora
          </button>

          <p className="text-xs text-white/40">
            {product.stock > 0 ? (
              <span className="text-emerald-300">● Disponibile</span>
            ) : (
              <span className="text-white/40">Esaurito</span>
            )}{" "}
            · Spedizione gratuita per ordini superiori a €59
          </p>

          {/* bullets */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="mb-2 block text-sm font-medium text-white/80">Caratteristiche</span>
            <ul className="space-y-2">
              {product.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-white/65">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" /> {b}
                </li>
              ))}
            </ul>
          </div>

          {/* specifiche tecniche */}
          {product.specs && product.specs.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/10 px-4 py-2.5 text-sm font-medium text-white/80">
                Specifiche tecniche
              </div>
              <dl className="divide-y divide-white/5">
                {product.specs.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-white/50">{s.label}</dt>
                    <dd className="text-right font-medium text-white/85">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* correlati */}
      {related.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Ti potrebbe servire anche</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <Link
                key={p.id}
                to="/shop/prodotto/$slug"
                params={{ slug: p.slug }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-brand/60"
              >
                <ShopVisual product={p} className="aspect-[4/3] w-full" compact />
                <div className="p-3">
                  <span className="line-clamp-1 text-sm font-medium text-white transition group-hover:text-brand">{p.name}</span>
                  <span className="text-sm font-bold text-white/80">{formatPrice(p.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
