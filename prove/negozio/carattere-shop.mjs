/** ── SHOP V1 · T71 · INTER E `lang="it"` SOLO SULLE CINQUE PAGINE V1 (D72, D73) ───────────
 *  `usaInter` e `paginaInItaliano` (src/lib/carattere.ts) ammettono `/shop`, `/shop/c/<slug>`, `/shop/cerca`,
 *  `/shop/prodotto/<slug>` e `/shop/carrello`: le stesse cinque di `guscioPerPercorso` (l'allineamento fra le due
 *  liste lo prova T93). Cassa, ordine e collaudo di R2 restano come sono, anche per carattere e lingua.
 *  Dati: solo percorsi inventati, nessun database. */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function prove(mod, { c, gruppo, radice }) {
  const CAR = mod["lib/carattere"];
  gruppo("SHOP V1 · T71 · INTER E LINGUA SULLE CINQUE PAGINE V1 (23/11/2026)");
  c("il modulo c'è", true, !!CAR);
  if (!CAR) return;
  const { usaInter, paginaInItaliano } = CAR;

  /* Le cinque pagine V1, anche con query, hash, barra finale e maiuscole (il router non distingue). */
  const V1 = [
    "/shop", "/shop/", "/SHOP", "/shop?utm_source=meta", "/shop#prodotti",
    "/shop/c/patch", "/shop/c/patch/", "/Shop/C/Patch?ordine=prezzo",
    "/shop/cerca", "/shop/cerca?q=toupee", "/shop/Cerca/",
    "/shop/prodotto/lace-front", "/shop/prodotto/lace-front?anteprima=abc", "/SHOP/PRODOTTO/Lace-Front/",
    "/shop/carrello", "/shop/carrello/", "/shop/Carrello?x=1#top",
  ];
  c("Inter vale sulle cinque pagine V1", V1.map(() => true), V1.map(usaInter));
  c("lang=\"it\" vale sulle cinque pagine V1", V1.map(() => true), V1.map(paginaInItaliano));

  /* Tutto il resto di /shop, compresi i tre percorsi di R2, resta com'è oggi (inglese, carattere di sempre). */
  const FUORI = [
    "/shopx", "/shopping", "/shop/checkout", "/shop/checkout/", "/Shop/Checkout?x=1",
    "/shop/ordine", "/shop/ordine/HG-1", "/shop/ordine/HG-1?t=abc", "/shop/collaudo", "/shop/collaudo/",
    "/shop/xyz", "/shop/c", "/shop/c/", "/shop/c/a/b", "/shop/prodotto", "/shop/prodotto/",
    "/shop/prodotto/a/b", "/shop/cerca/altro", "/shop/carrello/altro", "/shop/cercare", "/shop/carrelli",
    "/shopx/carrello", "/x/shop", "/shop-r2",
  ];
  c("Inter NON vale fuori dalle cinque pagine", FUORI.map(() => false), FUORI.map(usaInter));
  c("lang=\"it\" NON vale fuori dalle cinque pagine", FUORI.map(() => false), FUORI.map(paginaInItaliano));

  /* Il resto del sito non cambia: stessa risposta di prima per le altre rotte. */
  const INTER_SI = ["/", "/blog", "/blog/un-articolo", "/CRM", "/CRM/agenda", "/chat", "/invisible-derm", "/invisible-derm-v1"];
  const INTER_NO = ["/preventivo", "/meetly/abc", "/presenta", "/slide", "/prova-capelli", "/CRM/webinar", "/CRM/webinar/abc", "/nuova", "/consulente"];
  c("Inter: le rotte di prima valgono ancora", INTER_SI.map(() => true), INTER_SI.map(usaInter));
  c("Inter: le esclusioni di prima valgono ancora", INTER_NO.map(() => false), INTER_NO.map(usaInter));
  c("lang=\"it\": solo le due landing, come prima", [true, true, false, false, false, false],
    ["/invisible-derm", "/invisible-derm-v1", "/", "/blog", "/CRM/agenda", "/preventivo"].map(paginaInItaliano));

  /* La radice non cambia: gli attributi su <html> si calcolano ancora con queste due funzioni. */
  const sorgenteRadice = readFileSync(join(radice, "src/routes/__root.tsx"), "utf8");
  c("la radice usa paginaInItaliano per lang", true, /lang=\{paginaInItaliano\(percorso\) \? "it" : "en"\}/.test(sorgenteRadice));
  c("la radice usa usaInter per data-carattere", true, /data-carattere=\{inter \? "inter" : undefined\}/.test(sorgenteRadice) && /const inter = usaInter\(percorso\)/.test(sorgenteRadice));
}
