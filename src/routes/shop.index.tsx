import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { Search, Star, ShieldCheck, Truck, Sparkles, Plus } from "lucide-react";
import { CATEGORIES, PRODUCTS, formatPrice, type CategoryKey, type Product } from "@/shop/catalog";
import { ShopVisual } from "@/shop/ShopVisual";
import { useCart } from "@/shop/CartContext";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/")({
  component: Storefront,
});

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;
function icon(name: string): IconType {
  return (Lucide as unknown as Record<string, IconType>)[name] ?? Lucide.Package;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-amber-300">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3 w-3" fill={i < Math.round(rating) ? "currentColor" : "none"} strokeWidth={1.5} />
      ))}
    </span>
  );
}

function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const hasVariants = !!product.variants?.length;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-brand/60 hover:bg-white/[0.06]">
      <Link to="/shop/prodotto/$slug" params={{ slug: product.slug }} className="block">
        <ShopVisual product={product} className="aspect-[4/3] w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <Stars rating={product.rating} />
          <span className="text-[11px] text-white/40">{product.reviews} recensioni</span>
        </div>
        <Link
          to="/shop/prodotto/$slug"
          params={{ slug: product.slug }}
          className="line-clamp-1 font-semibold text-white transition hover:text-brand"
        >
          {product.name}
        </Link>
        <p className="line-clamp-2 text-sm text-white/55">{product.short}</p>
        {product.badges && (
          <div className="flex flex-wrap gap-1.5">
            {product.badges.map((b) => (
              <span key={b} className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                {b}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between pt-2">
          <div className="flex flex-col">
            {product.compareAt && (
              <span className="text-xs text-white/40 line-through">{formatPrice(product.compareAt)}</span>
            )}
            <span className="text-lg font-bold text-white">{formatPrice(product.price)}</span>
          </div>
          {hasVariants ? (
            <Link
              to="/shop/prodotto/$slug"
              params={{ slug: product.slug }}
              className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:brightness-110"
            >
              Scegli
            </Link>
          ) : (
            <button
              onClick={() => {
                add(product, 1);
                toast.success(`${product.name} aggiunto al carrello`);
              }}
              className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Aggiungi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Storefront() {
  const [cat, setCat] = useState<CategoryKey | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (query && !(`${p.name} ${p.short} ${p.description}`.toLowerCase().includes(query))) return false;
      return true;
    });
  }, [cat, q]);

  return (
    <div className="space-y-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center sm:py-16">
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative mx-auto max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Collezione Bio-Mimetic™
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Toupee <span className="text-brand">indistinguibili</span> e tutto per curarli.
          </h1>
          <p className="mx-auto max-w-xl text-white/60">
            Protesi lace e skin di grado premium, più shampoo, balsami, districanti, solventi e adesivi.
            La cura completa per chi indossa un sistema di capelli.
          </p>
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca protesi, shampoo, remover…"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-xs text-white/50">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand" /> Capelli veri Remy</span>
            <span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-brand" /> Spedizione gratis &gt; €59</span>
            <span className="flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-300" /> 4.8/5 · 1.500+ clienti</span>
          </div>
        </div>
      </section>

      {/* CATEGORIE */}
      <section>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCat("all")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              cat === "all" ? "bg-brand text-white" : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Tutti
          </button>
          {CATEGORIES.map((c) => {
            const Icon = icon(c.icon);
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active ? "bg-brand text-white" : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" /> {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* GRIGLIA */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            {cat === "all" ? "Tutti i prodotti" : CATEGORIES.find((c) => c.key === cat)?.label}
          </h2>
          <span className="text-sm text-white/40">{filtered.length} articoli</span>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            Nessun prodotto trovato per «{q}».
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
