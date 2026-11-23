/** ── VETRINA V1 · T79 · QUALE GUSCIO E QUALE BARRA FISSA PER OGNI PERCORSO (D72, D83) ───────────────────
 *  Funzioni pure: niente React, niente rete, niente schermo. Le usa `GuscioShop` (T93) e le barre (T84a).
 *  · `guscioPerPercorso`: il guscio NUOVO vale solo sulle cinque pagine V1 (`/shop`, `/shop/c/<slug>`, `/shop/cerca`,
 *    `/shop/prodotto/<slug>`, `/shop/carrello`); cassa, ordine, collaudo e percorsi sconosciuti restano nel guscio di oggi.
 *    ⚠️ È la STESSA lista di `usaInter`/`paginaInItaliano` (`src/lib/carattere.ts`, T71) e la stessa normalizzazione
 *    (minuscolo, senza `?…`, `#…` e barra finale; lo slug è un segmento solo): una prova le confronta su una tabella.
 *  · `barraFissa`: UNA barra sola per pagina (§4.5.12): consulenza su home e categoria, acquisto su scheda e carrello,
 *    nessuna altrove (ricerca, cassa, ordine, 404…). Chi la chiede dice anche in che stato è la pagina: una pagina «non
 *    trovata», in errore o con un prodotto che non si vende non ha barre (l'indirizzo è lo stesso della pagina buona).
 *  · `spazioRiservato`: lo spazio che la barra occupa in fondo alla pagina, perché nemmeno il piè di pagina resti sotto. */

export type Guscio = "nuovo" | "oggi";
export type Barra = "consulenza" | "acquisto";
/** Com'è la pagina: `normale` o una che non deve avere barre (404, 500, anteprima o prodotto senza vendita, es. Invisible Derm). */
export type StatoPagina = "normale" | "non_trovata" | "errore" | "non_in_vendita";

type Pagina = "home" | "categoria" | "cerca" | "scheda" | "carrello";

/** Il percorso come lo legge il router: senza `?…`, senza `#…`, senza barra finale, in minuscolo. */
function normalizza(percorso: unknown): string {
  if (typeof percorso !== "string") return "";
  const pulito = percorso.split("#")[0].split("?")[0].toLowerCase().replace(/\/+$/, "");
  return pulito === "" ? "/" : pulito;
}

/** Quale delle cinque pagine V1 è; `null` per tutto il resto. Una lista sola per guscio e barre. */
function paginaV1(percorso: unknown): Pagina | null {
  const p = normalizza(percorso);
  if (p === "/shop") return "home";
  if (p === "/shop/cerca") return "cerca";
  if (p === "/shop/carrello") return "carrello";
  if (/^\/shop\/c\/[^/]+$/.test(p)) return "categoria";
  if (/^\/shop\/prodotto\/[^/]+$/.test(p)) return "scheda";
  return null;
}

export function guscioPerPercorso(percorso: unknown): Guscio {
  return paginaV1(percorso) ? "nuovo" : "oggi";
}

const BARRA_PER_PAGINA: Record<Pagina, Barra | null> = { home: "consulenza", categoria: "consulenza", scheda: "acquisto", carrello: "acquisto", cerca: null };

/** Quale barra fissa ha questa pagina. Chiuso, mai aperto: uno stato che non sia `normale` (anche uno sconosciuto) = nessuna barra. */
export function barraFissa(percorso: unknown, stato: StatoPagina = "normale"): Barra | null {
  if (stato !== "normale") return null;
  const pagina = paginaV1(percorso);
  return pagina ? BARRA_PER_PAGINA[pagina] : null;
}

/** Zona dei gesti dell'iPhone, in fondo allo schermo. */
const ZONA_GESTI = "env(safe-area-inset-bottom, 0px)";
/** 56 px = la barra della consulenza di oggi (`BarraConsulenza`). */
const ALTEZZA_CONSULENZA_PX = 56;
/** shortcut: 72 px = bottone da 56 px più 8 px d'aria sopra e sotto; si cambia con il disegno della barra d'acquisto (T84a) se la misura è un'altra. */
const ALTEZZA_ACQUISTO_PX = 72;

/** Lo spazio da riservare in fondo alla pagina per questa barra, come lunghezza CSS (`"0px"` se non c'è nessuna barra). */
export function spazioRiservato(barra: Barra | null | undefined): string {
  if (barra === "consulenza") return `calc(${ALTEZZA_CONSULENZA_PX}px + ${ZONA_GESTI})`;
  if (barra === "acquisto") return `calc(${ALTEZZA_ACQUISTO_PX}px + ${ZONA_GESTI})`;
  return "0px";
}
