/** ── VetrinaHome · VETRINA V1 · T91 ───────────────────────────────────────────
 *  «Da qui si parte»: fino a 6 patch su fondo chiaro con trama (documento §4.5.2). Le card sono quelle scelte da `scegliVetrina` (T76), già leggere
 *  (la pagina le calcola nel loader); le colonne le decide `colonneVetrina`: 2 sul telefono, 4 prodotti = 4 sul computer, 5-6 = 3.
 *  Con meno di 2 card non si monta (D78): l'hero porta già alle categorie. Nessuna foto è `prima`: la sola `eager` della home è quella dell'hero.
 *  I testi vengono dal contenuto dello shop (`testiDi`): uno svuotato nel CRM non si disegna. Il badge «Pronta consegna» lo accende il testo confermato. */
import { Link } from "@tanstack/react-router";
import { GrigliaCard } from "@/components/shop/GrigliaCard";
import type { CardLeggera } from "@/shop/cms/vetrina-card";
import { HREF_PATCH_PRONTE } from "@/shop/cms/vetrina-carrello";
import { confermatiDa, testiDi } from "@/shop/cms/vetrina-contenuto";
import { colonneVetrina } from "@/shop/cms/vetrina-home";

export function VetrinaHome({ card, contenuto }: { card?: readonly CardLeggera[] | null; contenuto?: unknown }) {
  const lista: readonly CardLeggera[] = Array.isArray(card) ? card : [];
  const colonne = colonneVetrina(lista.length);
  if (!colonne) return null;
  const t = testiDi(contenuto);
  const titolo = t["shop.vetrina.titolo"];
  const sottotitolo = t["shop.vetrina.sottotitolo"];
  const vediTutte = t["shop.vetrina.link"];
  return (
    <section id="vetrina" aria-labelledby={titolo ? "vetrina-titolo" : undefined} className="bg-white-trama">
      {/* Telefono: titolo, griglia, link. Computer: titolo a sinistra e link a destra sopra la griglia (stesso ordine nel codice, un solo link). */}
      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-8 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_auto] lg:px-10 lg:py-28">
        {(titolo || sottotitolo) && (
          <div className="lg:col-start-1 lg:row-start-1">
            {titolo && (
              <h2 id="vetrina-titolo" tabIndex={-1} className="text-balance text-3xl font-bold leading-[1.05] tracking-tight text-ink focus:outline-none md:text-5xl">
                {titolo}
              </h2>
            )}
            {sottotitolo && <p className="mt-3 text-base leading-relaxed text-ink-muted md:text-lg">{sottotitolo}</p>}
          </div>
        )}
        <GrigliaCard card={lista} colonne={colonne.computer} testi={confermatiDa(contenuto)} livello="h3" className="lg:col-span-2 lg:row-start-2" />
        {vediTutte && (
          <Link
            to={HREF_PATCH_PRONTE}
            className="shop-anello inline-flex min-h-11 items-center justify-self-start font-semibold text-brand underline underline-offset-4 hover:text-ink lg:col-start-2 lg:row-start-1 lg:self-end"
          >
            {vediTutte}
          </Link>
        )}
      </div>
    </section>
  );
}
