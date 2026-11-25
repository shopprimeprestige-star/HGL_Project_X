/*  ── ⚠️ DOVE VALE IL CARATTERE INTER ──────────────────────────────────────
    Inter (famiglia `InterHGL`, vedi `styles.css`) vale solo dove la radice mette
    `<html data-carattere="inter">`: homepage, blog, CRM e le cinque pagine della vetrina V1. Le schermate della
    chiamata (preventivo, Meetly, prova capelli, presentazione, slide) restano
    col carattere di sempre fino alla fase 4: Inter è un po' più largo, e prima
    di vederlo su una cifra del preventivo lo si vuole provare in una chiamata
    vera, non davanti a un cliente.

    ⚠️ SI ELENCANO LE ROTTE AMMESSE, NON LE ESCLUSE. Una rotta dimenticata
     nell'elenco delle ammesse resta com'era (nessuno se ne accorge); una
     dimenticata in quello delle escluse cambia carattere in chiamata (se ne
     accorge il cliente). L'elenco sbaglia per difetto, mai per eccesso.
    ⚠️ `/CRM/webinar` è fuori anche se sta sotto `/CRM`: dentro c'è la regia
     della sala, che è una schermata di chiamata.
    ⚠️ Il router non distingue maiuscole e minuscole (`/CRM/Webinar` apre la
     regia), quindi il confronto è tutto in minuscolo. */

/** Il file del carattere da precaricare: lo stesso indirizzo del @font-face `latin` di styles.css (il secondo: il primo è latin-ext). */
export const CARATTERE_INTER = "/fonts/inter/5.3.0/inter-latin-wght-normal.woff2";

/** Il percorso come lo legge il router: senza `?…`, senza `#…`, senza barra finale, in minuscolo. */
function normalizza(percorso: string): string {
  const pulito = percorso.split("#")[0].split("?")[0].toLowerCase().replace(/\/+$/, "");
  return pulito === "" ? "/" : pulito;
}

/** Le cinque pagine della vetrina V1: `/shop`, `/shop/c/<slug>`, `/shop/cerca`, `/shop/prodotto/<slug>`, `/shop/carrello`.
 *  ⚠️ Stessa lista di `guscioPerPercorso` (vetrina-barre.ts): cassa (`/shop/checkout`), ordine e collaudo restano
 *  com'erano, nel carattere e nella lingua, fino a V2. Il percorso è già normalizzato. */
function paginaVetrinaV1(p: string): boolean {
  return p === "/shop" || p === "/shop/cerca" || p === "/shop/carrello" || /^\/shop\/(c|prodotto)\/[^/]+$/.test(p);
}

/** true solo per "/", "/blog", "/blog/*", "/CRM", "/CRM/*" tranne "/CRM/webinar" e "/CRM/webinar/*",
 *  "/chat" (la chat WhatsApp del CRM da sola, che deve avere lo stesso aspetto),
 *  "/invisible-derm" (la landing, che ha la grammatica della home) e le cinque pagine della vetrina V1. */
export function usaInter(percorso: string): boolean {
  const p = normalizza(percorso);
  if (p === "/" || p === "/chat" || p === "/invisible-derm" || p === "/invisible-derm-v1") return true;
  if (paginaVetrinaV1(p)) return true;
  if (p === "/blog" || p.startsWith("/blog/")) return true;
  if (p === "/crm/webinar" || p.startsWith("/crm/webinar/")) return false;
  return p === "/crm" || p.startsWith("/crm/");
}

/** true per le pagine scritte in italiano da capo a fondo (`lang="it"`): le due landing e le cinque pagine della vetrina V1;
 *  le altre restano come sono. */
export function paginaInItaliano(percorso: string): boolean {
  const p = normalizza(percorso);
  return p === "/invisible-derm" || p === "/invisible-derm-v1" || paginaVetrinaV1(p);
}
