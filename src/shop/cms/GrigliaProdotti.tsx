/** ── LA GRIGLIA DEI PRODOTTI, USATA DALL'ELENCO E DALLA CATEGORIA ─────────────
 *  Commessa 2026-11-20-shop-completo (T19). La scheda è QUELLA DI OGGI (D29: nel Rilascio 1 l'aspetto non cambia); cambia solo
 *  ciò che non si può dire con il catalogo CMS:
 *   · stelle e «N recensioni» solo se ci sono davvero (`reviews > 0`): l'adattatore dà 0, quindi con il CMS non compaiono;
 *     con il catalogo del codice sono sempre presenti, e la scheda è identica a oggi;
 *   · badge e prezzo barrato esistono solo se il prodotto li porta (l'adattatore non li dà);
 *   · Invisible Derm (o un prodotto senza prezzo dal server, D39) non ha mai un prezzo: si legge «Il costo lo vedi in consulenza.» e si va alla scheda;
 *   · un prodotto esaurito non si aggiunge: «Esaurito»; un prodotto con scelte (colore, misura…) manda alla scheda;
 *   · se le varianti hanno prezzi diversi il prezzo è «Da …». */
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/shop/catalog";
import { ShopVisual } from "@/shop/ShopVisual";
import { useCart } from "@/shop/CartContext";
import { EVENTO_CONSENSO } from "@/lib/consenso";
import { emettiEvento } from "@/lib/tracciamento/api";
import type { CategoriaPubblica } from "./modello";
import { daAggiungereDalCard, datiListaVisualizzata, emettiUnaVolta, haPrezziDiversi, senzaPrezzo, suScelta, type VoceElenco } from "./elenco";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-amber-300">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3 w-3" fill={i < Math.round(rating) ? "currentColor" : "none"} strokeWidth={1.5} />
      ))}
    </span>
  );
}

const BOTTONE = "flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:brightness-110";

export function ProductCard({ voce }: { voce: VoceElenco }) {
  const { add } = useCart();
  const { product, pubblico } = voce;
  const hasVariants = !!product.variants?.length;
  const derm = senzaPrezzo(voce);
  const esaurito = !!pubblico && !pubblico.varianti.some((v) => v.disponibile);
  const rapido = daAggiungereDalCard(voce);
  const allaScheda = hasVariants || (!!pubblico && !rapido);
  const alla = (testo: string) => (
    <Link to="/shop/prodotto/$slug" params={{ slug: product.slug }} className={BOTTONE}>
      {testo}
    </Link>
  );
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-brand/60 hover:bg-white/[0.06]">
      <Link to="/shop/prodotto/$slug" params={{ slug: product.slug }} className="block">
        <ShopVisual product={product} className="aspect-[4/3] w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.reviews > 0 && (
          <div className="flex items-center justify-between gap-2">
            <Stars rating={product.rating} />
            <span className="text-[11px] text-white/40">{product.reviews} recensioni</span>
          </div>
        )}
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
          {derm ? (
            <p className="max-w-[9rem] text-sm text-white/60">Il costo lo vedi in consulenza.</p>
          ) : (
            <div className="flex flex-col">
              {product.compareAt && (
                <span className="text-xs text-white/40 line-through">{formatPrice(product.compareAt)}</span>
              )}
              <span className="text-lg font-bold text-white">
                {haPrezziDiversi(pubblico) && <span className="mr-1 text-xs font-normal text-white/55">Da</span>}
                {formatPrice(product.price)}
              </span>
            </div>
          )}
          {derm ? (
            alla("Scopri")
          ) : esaurito ? (
            <span className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/60">Esaurito</span>
          ) : allaScheda ? (
            alla("Scegli")
          ) : (
            <button
              onClick={() => {
                add(product, 1, undefined, rapido ?? undefined);
                toast.success(`${product.name} aggiunto al carrello`);
              }}
              className={BOTTONE}
            >
              <Plus className="h-4 w-4" /> Aggiungi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GrigliaProdotti({ voci }: { voci: readonly VoceElenco[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {voci.map((v) => (
        <ProductCard key={v.product.id} voce={v} />
      ))}
    </div>
  );
}

/** Le categorie del catalogo CMS, come indirizzi veri (`/shop/c/<slug>`): chi arriva da una ricerca o da un link le ritrova. */
export function ChipCategorie({ categorie, attiva }: { categorie: readonly CategoriaPubblica[]; attiva?: string }) {
  //  Una categoria senza prodotti pubblicati non esiste (il suo indirizzo rimanda a /shop): non è un chip.
  const visibili = categorie.filter((c) => c.quanti > 0);
  if (visibili.length === 0) return null;
  const classe = (on: boolean) =>
    `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
      on ? "bg-brand text-white" : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
    }`;
  return (
    <section>
      <div className="flex flex-wrap gap-2">
        <Link to="/shop" className={classe(!attiva)} aria-current={!attiva ? "page" : undefined}>
          Tutti
        </Link>
        {visibili.map((c) => (
          <Link key={c.slug} to="/shop/c/$slug" params={{ slug: c.slug }} className={classe(c.slug === attiva)} aria-current={c.slug === attiva ? "page" : undefined}>
            {c.nome}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** `ViewContent` della lista (product_group), una volta per visita e per lista. Dipende solo da `chiave`: l'elenco di una
 *  pagina non cambia mentre la si guarda (shortcut: se un giorno cambia, la chiave deve cambiare con lui).
 *  `emettiEvento` NON mette in coda: senza consenso non parte e non si segna. Perciò si riprova dopo la scelta sul banner
 *  (`suScelta`), anche se arriva dopo il caricamento della pagina. */
export function useListaVista(chiave: string, voci: readonly VoceElenco[], categoria?: string) {
  useEffect(() => {
    const dati = datiListaVisualizzata(voci, categoria);
    if (!dati) return;
    let archivio: Storage | null = null;
    try {
      archivio = window.sessionStorage;
    } catch {
      /* archivio non disponibile */
    }
    const prova = () => emettiUnaVolta(archivio, chiave, () => emettiEvento("ViewContent", dati));
    prova();
    return suScelta(window, EVENTO_CONSENSO, prova);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave]);
}
