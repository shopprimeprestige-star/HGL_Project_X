/** ── PaginaHome · VETRINA V1 · T94 ────────────────────────────────────────────
 *  La home dello shop con il catalogo CMS: l'hero (con la fascia di fiducia) e «Da qui si parte». Il guscio (header, footer, barre) non è di questa pagina.
 *  `datiHome` è ciò che il `loader` della rotta dà alla pagina: SOLO dati leggeri (V1-T14). I prodotti non escono interi dal server verso il browser:
 *  restano le card della vetrina (≤ 6, `CardLeggera`) e gli indirizzi delle categorie piene. Il contenuto e la tariffa li legge da sé l'hero (`HeroShop`).
 *  ⚠️ Le categorie piene vanno all'hero: senza `categorieConProdotti` i suoi due bottoni non si mostrano (meglio nessun bottone che una categoria vuota).
 *  ⚠️ Un solo H1 (quello dell'hero). La fascia è dentro l'hero (`vociDellaFascia`): qui non si compone nessuna voce a mano. */
import { HeroShop } from "@/components/shop/home/HeroShop";
import { VetrinaHome } from "@/components/shop/home/VetrinaHome";
import type { SpedizionePubblica } from "@/shop/cassa/spedizione";
import type { CategoriaPubblica, ProdottoPubblico } from "@/shop/cms/modello";
import type { CardLeggera } from "@/shop/cms/vetrina-card";
import type { ContenutoShop } from "@/shop/cms/vetrina-contenuto";
import { scegliVetrina } from "@/shop/cms/vetrina-home";

export interface DatiHome {
  contenuto: ContenutoShop;
  /** `null` = la tariffa non si è letta: la fascia resta con le voci che non ne hanno bisogno. */
  tariffa: SpedizionePubblica | null;
  /** Gli indirizzi (slug) delle categorie che hanno prodotti pubblicati. */
  categorieConProdotti: string[];
  /** Le card di «Da qui si parte» (D78), o `null` se le patch sono meno di 2. */
  vetrina: CardLeggera[] | null;
}

/** Dalle risposte del server ai dati leggeri della pagina. Una risposta storta (non un elenco, un prodotto senza categorie) vale «niente», mai un errore.
 *  Una categoria è piena se ha `quanti` > 0 per il pubblico E almeno un prodotto dell'elenco la nomina (la sua pagina avrebbe qualcosa da mostrare). */
export function datiHome(da: { contenuto: ContenutoShop; tariffa: SpedizionePubblica | null; prodotti: unknown; categorie: unknown }): DatiHome {
  const prodotti = (Array.isArray(da.prodotti) ? da.prodotti : []) as ProdottoPubblico[];
  const categorie = (Array.isArray(da.categorie) ? da.categorie : []) as CategoriaPubblica[];
  const nominate = new Set(prodotti.flatMap((p) => (Array.isArray(p?.categorie) ? p.categorie.map((x) => x?.slug) : [])));
  return {
    contenuto: da.contenuto,
    tariffa: da.tariffa,
    categorieConProdotti: categorie.filter((k) => !!k && k.quanti > 0 && nominate.has(k.slug)).map((k) => k.slug),
    vetrina: scegliVetrina(prodotti),
  };
}

export function PaginaHome({ dati }: { dati: DatiHome }) {
  return (
    <>
      <HeroShop contenuto={dati.contenuto} tariffa={dati.tariffa} categorieConProdotti={dati.categorieConProdotti} />
      <VetrinaHome card={dati.vetrina} contenuto={dati.contenuto} />
    </>
  );
}
