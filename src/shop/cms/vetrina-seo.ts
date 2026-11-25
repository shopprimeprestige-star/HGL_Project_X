/** ── VETRINA V1 · T77 · I META, L'IMMAGINE DI CONDIVISIONE, L'INDIRIZZO CANONICO (D97) ───────────────────────
 *  Funzioni pure che danno i testi e gli indirizzi per la `head` delle pagine nuove (categoria, home, ricerca). I testi vengono da
 *  `testi-shop.ts` (documento §3.4 e §3.14): qui non si scrive nessuna frase, tranne il modello con il nome, che è provvisorio.
 *  ⚠️ Meta title e description di una categoria = quelli scritti nel CMS (`seo`), altrimenti la riga di §3.4, altrimenti il modello con il
 *   nome (D97). Ogni testo si sceglie da solo: titolo del CMS e descrizione del documento possono stare insieme. Un testo vuoto o con
 *   un segnaposto a doppia graffa non vale. Le righe di §3.4 e i modelli con il nome sono diversi per categoria (V1-C3: «unici»); due categorie che
 *   scrivessero lo stesso testo nel CMS restano affare di chi le scrive.
 *  ⚠️ Mai l'indirizzo dello studio, mai un prezzo, mai una parola vietata nei meta (le righe del documento sono già pulite).
 *  Criteri: V1-C3 (meta unici), V1-C4 (ricerca `noindex`). */
import { TESTI_SHOP } from "@/landing/testi-shop";

export interface MetaPagina {
  titolo: string;
  descrizione: string;
}

/** Quello che serve di una categoria: lo slug (per trovare la riga del documento), il nome e i testi SEO del CMS. */
export interface CategoriaPerMeta {
  slug: string;
  nome: string;
  seo?: { titolo: string | null; descrizione: string | null } | null;
}

/** Provvisorio (D97, «un modello con il nome»): il documento non lo dà. Da portare in `testi-shop.ts` quando il copywriter lo conferma.
 *  Stessa forma delle righe del documento («Spazzole per patch capillari»), nessuna parola vietata, nessun prezzo. */
const MODELLO = {
  titolo: (nome: string) => `${nome} per patch capillari`,
  descrizione: (nome: string) => `${nome}: prodotti per la patch capillare, scelti e spiegati da uno studio di Roma che applica patch.`,
};

/** Il segnaposto «da confermare» (doppia graffa aperta), scritto a pezzi: nel sorgente non compare. */
const SEGNAPOSTO = "{" + "{";

/** Un testo del CMS che si può usare: scritto davvero (non vuoto) e senza segnaposto. */
const scritto = (t: unknown): string | null => (typeof t === "string" && t.trim() !== "" && !t.includes(SEGNAPOSTO) ? t.trim() : null);

/** Titolo e descrizione per la `head` della categoria: il CMS, poi la riga del documento, poi il modello con il nome. */
export function metaCategoria(cat: CategoriaPerMeta): MetaPagina {
  const riga = TESTI_SHOP.categorie.find((x) => x.slug === cat.slug);
  return {
    titolo: scritto(cat.seo?.titolo) ?? riga?.metaTitolo ?? MODELLO.titolo(cat.nome),
    descrizione: scritto(cat.seo?.descrizione) ?? riga?.metaDescrizione ?? MODELLO.descrizione(cat.nome),
  };
}

/** I meta di tutte le categorie, uno per categoria nello stesso ordine, MAI uguali fra loro (D97): se un testo scritto nel CMS coincide con
 *  uno già dato a una categoria precedente, la seconda torna alla riga del documento, poi al modello con il nome, poi al modello con lo slug. */
export function metaCategorie(elenco: readonly CategoriaPerMeta[]): MetaPagina[] {
  const usati = { titolo: new Set<string>(), descrizione: new Set<string>() };
  const scegli = (campo: keyof MetaPagina, candidati: (string | null | undefined)[]): string => {
    const buoni = candidati.filter((t): t is string => !!t);
    const t = buoni.find((x) => !usati[campo].has(x)) ?? buoni[buoni.length - 1];
    usati[campo].add(t);
    return t;
  };
  return elenco.map((cat) => {
    const riga = TESTI_SHOP.categorie.find((x) => x.slug === cat.slug);
    return {
      titolo: scegli("titolo", [scritto(cat.seo?.titolo), riga?.metaTitolo, MODELLO.titolo(cat.nome), MODELLO.titolo(`${cat.nome} (${cat.slug})`)]),
      descrizione: scegli("descrizione", [scritto(cat.seo?.descrizione), riga?.metaDescrizione, MODELLO.descrizione(cat.nome), MODELLO.descrizione(`${cat.nome} (${cat.slug})`)]),
    };
  });
}

/** Titolo e descrizione della home dello shop (documento §3.14). */
export function metaHome(): MetaPagina {
  const { titolo, descrizione } = TESTI_SHOP.meta.home;
  return { titolo, descrizione };
}

/** Un indirizzo che i motori e le app di condivisione possono scaricare: solo `https://`. */
const https = (u: unknown): u is string => typeof u === "string" && u.startsWith("https://");

/** L'immagine di condivisione, o `null` (nessun tag: mai un'immagine inventata, mai il logo).
 *  Scheda: quella scelta nel CMS, altrimenti la foto principale a 1600. Home: lo slot `shop.condivisione`, altrimenti la foto dell'hero. */
export function immagineCondivisione(da?: {
  prodotto?: { seo: { immagine: string | null }; media: { slot: string; src: { w1600: string } | null }[] };
  condivisione?: string | null;
  heroFoto?: string | null;
}): string | null {
  if (!da) return null;
  const candidate = da.prodotto
    ? [da.prodotto.seo.immagine, da.prodotto.media.find((m) => m.slot === "principale")?.src?.w1600]
    : [da.condivisione, da.heroFoto];
  return candidate.find(https) ?? null;
}

/** L'indirizzo canonico: sito + percorso, senza parametri (i filtri non fanno una pagina nuova), senza ancora, senza barra finale né barre doppie.
 *  Resta sempre dentro il sito: di un indirizzo completo si tiene solo il percorso. */
export function canonical(percorso: string, sito: string): string {
  const soloPercorso = percorso
    .replace(/^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#]*/i, "")
    .split(/[?#]/)[0]
    .replace(/\/{2,}/g, "/")
    .replace(/^\/?/, "/")
    .replace(/(.)\/$/, "$1");
  return `${sito.replace(/\/+$/, "")}${soloPercorso}`;
}

/** La ricerca non si indicizza (V1-C4). Un oggetto nuovo a ogni chiamata, nella forma dei `meta` della `head`. */
export function robotsCerca(): { name: string; content: string } {
  return { name: "robots", content: "noindex" };
}
