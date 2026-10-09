import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { PRODUCTS, formatPrice } from "@/shop/catalog";
import { ShopVisual } from "@/shop/ShopVisual";
import { useCart } from "@/shop/CartContext";

export const Route = createFileRoute("/shop/carrello")({
  component: CartPage,
});

const SHIPPING_THRESHOLD = 59;
const SHIPPING_COST = 4.9;

function CartPage() {
  const { lines, setQty, remove, subtotal, count } = useCart();
  const shipping = subtotal >= SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;

  if (count === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
        <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-white/30" />
        <h1 className="text-xl font-semibold">Il carrello è vuoto</h1>
        <p className="mt-2 text-sm text-white/55">Aggiungi protesi o prodotti per la cura per iniziare.</p>
        <Link
          to="/shop"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-medium text-white transition hover:brightness-110"
        >
          Vai al catalogo <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Carrello <span className="text-white/40">({count})</span></h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* righe */}
        <div className="space-y-3">
          {lines.map((line) => {
            const p = PRODUCTS.find((pr) => pr.id === line.productId);
            if (!p) return null;
            return (
              <div key={line.key} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <Link to="/shop/prodotto/$slug" params={{ slug: p.slug }} className="shrink-0">
                  <ShopVisual product={p} className="h-24 w-24" compact />
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link to="/shop/prodotto/$slug" params={{ slug: p.slug }} className="font-medium text-white hover:text-brand">
                        {p.name}
                      </Link>
                      {line.variant && (
                        <p className="mt-0.5 text-xs text-white/45">
                          {Object.entries(line.variant).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </p>
                      )}
                    </div>
                    <button onClick={() => remove(line.key)} className="text-white/40 transition hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-lg border border-white/15 bg-white/5">
                      <button onClick={() => setQty(line.key, line.qty - 1)} className="px-2.5 py-2 text-white/70 hover:text-white">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm">{line.qty}</span>
                      <button onClick={() => setQty(line.key, line.qty + 1)} className="px-2.5 py-2 text-white/70 hover:text-white">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="font-semibold">{formatPrice(p.price * line.qty)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* riepilogo */}
        <div className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 font-semibold">Riepilogo</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-white/70">
              <span>Subtotale</span>
              <span className="text-white">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Spedizione</span>
              <span className={shipping === 0 ? "text-emerald-300" : "text-white"}>
                {shipping === 0 ? "Gratuita" : formatPrice(shipping)}
              </span>
            </div>
            {shipping > 0 && (
              <p className="text-xs text-white/45">
                Aggiungi {formatPrice(SHIPPING_THRESHOLD - subtotal)} per la spedizione gratuita.
              </p>
            )}
            <div className="my-3 border-t border-white/10" />
            <div className="flex justify-between text-base font-bold">
              <span>Totale</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
          <Link
            to="/shop/checkout"
            className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-brand py-3 font-semibold text-white transition hover:brightness-110"
          >
            Procedi al checkout <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/shop" className="mt-3 block text-center text-sm text-white/50 hover:text-white">
            Continua lo shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
