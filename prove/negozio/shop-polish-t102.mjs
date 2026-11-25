/** ── VETRINA V1 · T102 · `polish`: LE CORREZIONI DI DESIGN DELLA VETRINA (23/11/2026) ─────────────────────────────────
 *  Le correzioni dell'audit T101 (A1-A22, tranne quelle che aspettano il titolare) lasciano un segno nelle classi dei componenti di
 *  `src/components/shop/**`. Qui si legge il sorgente (senza commenti) e si controlla che il segno ci sia e che non torni quello vecchio:
 *  le prove che DISEGNANO i componenti (hero, scheda, carrello, filtri…) sono negli altri file; questo guarda solo ciò che il disegno non mostra bene.
 *  Nessun modulo di `mod`, nessuna rete: solo lettura di file. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T102 · POLISH: LE CORREZIONI DI T101 (23/11/2026)");
  const leggi = (f) => senzaCommenti(readFileSync(join(radice, "src/components/shop", f), "utf8"));
  const F = {
    filtri: leggi("categoria/FiltriCategoria.tsx"),
    stepper: leggi("carrello/StepperQuantita.tsx"),
    cerca: leggi("pagine/PaginaCerca.tsx"),
    carrello: leggi("pagine/PaginaCarrello.tsx"),
    scheda: leggi("pagine/PaginaScheda.tsx"),
    galleria: leggi("scheda/GalleriaProdotto.tsx"),
    acquisto: leggi("scheda/BloccoAcquisto.tsx"),
    variante: leggi("scheda/SelettoreVariante.tsx"),
    riepilogo: leggi("carrello/RiepilogoOrdine.tsx"),
    riga: leggi("carrello/RigaCarrelloShop.tsx"),
    vuoto: leggi("StatoVuoto.tsx"),
    header: leggi("guscio/ShopHeader.tsx"),
  };

  c("A5: sul telefono il numero dei prodotti sta accanto a «Filtra» (aria-hidden, tabulare) e la regione `status` resta", [true, true, true], [
    /<p aria-hidden="true" className="shrink-0 text-sm tabular-nums text-ink-muted">/.test(F.filtri),
    /flex items-center gap-3[^"]*lg:hidden/.test(F.filtri) && /\bflex-1\b[^"]*border-\[#7C8695\]/.test(F.filtri),
    /<p role="status" className="sr-only">/.test(F.filtri),
  ]);
  c("A6: la colonna filtri del computer lascia 4 px per l'anello del fuoco (-m-1 p-1)", true, /<aside[^>]*className="-m-1 [^"]*\bp-1\b[^"]*lg:overflow-y-auto"/.test(F.filtri));
  const VECCHI = /border-ink\/(25|30|40)|border-\[#0A1430\]\/30/;
  c("A7: i bordi dei controlli (pillole filtro, «Filtra», stepper, campo di ricerca) sono #7C8695 (3,7:1), non più ink/25-40", [false, false, false, true, true, true], [
    VECCHI.test(F.filtri), VECCHI.test(F.stepper), VECCHI.test(F.cerca),
    /border-\[#7C8695\] bg-white text-ink hover:border-\[#0A1430\]/.test(F.filtri), (F.stepper.match(/border-\[#7C8695\]/g) ?? []).length === 2, /border-\[#7C8695\] bg-white px-3/.test(F.cerca),
  ]);
  c("A9: gli H1 di ricerca e carrello sono `text-2xl leading-[1.1] md:text-4xl` come il documento", [true, true], [
    /<h1 className="[^"]*\btext-2xl\b[^"]*\bleading-\[1\.1\][^"]*\bmd:text-4xl\b/.test(F.cerca),
    /<h1 className="[^"]*\btext-2xl\b[^"]*\bleading-\[1\.1\][^"]*\bmd:text-4xl\b/.test(F.carrello),
  ]);
  c("A10: i risultati della ricerca sono in 4 colonne (come i suggeriti)", true, /<GrigliaCard card=\{trovati\} colonne=\{4\}/.test(F.cerca));
  c("A11: ogni diapositiva della galleria è `relative` (gli sr-only non sfuggono al ritaglio)", true, /className="relative w-full shrink-0 snap-center"/.test(F.galleria));
  c("A13: la striscia «nel carrello» non ha più il «·» e il link non va a capo (justify-between, link shrink-0)", [false, true, true], [
    /<span aria-hidden="true">·<\/span>/.test(F.acquisto),
    /flex items-center justify-between gap-3[^"]*px-4/.test(F.acquisto),
    /shop-anello inline-flex min-h-11 shrink-0 items-center font-semibold underline/.test(F.acquisto),
  ]);
  c("A15: la pillola scelta ha anche la spunta (non solo il riempimento)", [true, true], [/<Check className=\{`size-4 \$\{scelto \? "" : "invisible"\}`\} aria-hidden="true" \/>/.test(F.variante), /inline-flex min-h-11 min-w-11 items-center justify-center gap-1\.5/.test(F.variante)]);
  c("A16: la scheda sale di 8 px e 12 px (pt-4, gap-5; dal computer invariata)", [true, true], [/pb-16 pt-4 /.test(F.scheda) && /lg:pt-10/.test(F.scheda), /grid gap-5 lg:grid-cols-/.test(F.scheda) && /lg:gap-x-12 lg:gap-y-10/.test(F.scheda)]);
  c("A17: il Totale del carrello è 24 px (28 dal computer), in grassetto, più piccolo dell'H1 (24/36)", true, /<dd className="ml-auto text-2xl font-bold tabular-nums lg:text-\[28px\]">/.test(F.riepilogo));
  c("A18: l'avviso di riga non è giallo pieno: filetto ambra a sinistra (#8A5A00) su bianco", [false, true, true], [/amber/.test(F.riga), /border-l-4 border-ink\/10 border-l-\[#8A5A00\] bg-white/.test(F.riga), /text-\[#8A5A00\]/.test(F.riga)]);
  c("A19: i bottoni dello stato vuoto hanno la stessa larghezza (contenitore sm:w-64, bottoni w-full, niente min-w-48)", [true, 2, false], [/flex-col items-center gap-3 sm:w-64/.test(F.vuoto), (F.vuoto.match(/\bw-full\b[^`]*sm:min-w-0/g) ?? []).length, /min-w-48|sm:w-auto/.test(F.vuoto)]);
  c("A21: i due angoli del logo nell'header sono decorativi (aria-hidden)", [true, true], [/<span className="br-tr" aria-hidden="true" \/>/.test(F.header), /<span className="br-bl" aria-hidden="true" \/>/.test(F.header)]);
}
