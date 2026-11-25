/** ── VETRINA V1 · T109b · testo al 200 %: riga del carrello, stepper, riepilogo, striscia «nel carrello» (23/11/2026) ──────────
 *  Collaudo T103b (difetti 2 e 4): a testo 200 % la riga sporgeva e il «+» non si raggiungeva; la striscia dava il nome una parola per riga.
 *  Qui si legge il sorgente (senza commenti): la riga e lo stepper vanno a capo, la colonna non ha `flex-1` (base 0 = non va mai a capo),
 *  i tasti restano da 44 px. Le misure vere (390/320 a 200 %, scrollWidth = finestra) sono state prese con Chrome su una pagina statica, non sono in suite.
 *  La prova della griglia a scheletri (T109b-5) è in `shop-filtri.mjs`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARRELLO_NUOVO, CATALOGO, TARIFFA_CARRELLO_OK, carrelloFinto, rivalidaFinta } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T109b · TESTO AL 200 %: RIGA, STEPPER, RIEPILOGO, STRISCIA (23/11/2026)");
  const leggi = (f) => senzaCommenti(readFileSync(join(radice, "src/components/shop", f), "utf8"));
  const riga = leggi("carrello/RigaCarrelloShop.tsx");
  const stepper = leggi("carrello/StepperQuantita.tsx");
  const riepilogo = leggi("carrello/RiepilogoOrdine.tsx");
  const acquisto = leggi("scheda/BloccoAcquisto.tsx");

  c("T109b-1: la riga del carrello va a capo (`li` flex-wrap) e la colonna cresce da una base (`grow basis-48`), non da 0 (`flex-1`)", [true, true, false], [
    /<li className="flex flex-wrap gap-3/.test(riga), /<div className="grid min-w-0 grow basis-48 grid-cols-\[minmax\(0,1fr\)_auto\]/.test(riga), /<div className="grid min-w-0 flex-1/.test(riga)]);
  c("T109b-1: lo stepper va a capo (flex-wrap) e i tasti restano da 44 px (h-11 w-11)", [true, true], [
    /<div className="flex flex-wrap items-center gap-2">/.test(stepper), /flex h-11 w-11 items-center justify-center/.test(stepper)]);
  c("T109b-1: la riga del totale del riepilogo va a capo (la cifra grande non spinge fuori la pagina)", true, /mt-1 flex flex-wrap items-baseline justify-between/.test(riepilogo));
  c("T109b-2: la striscia «nel carrello» va a capo e il nome parte da una base (`grow basis-28`), il link resta intero (shrink-0)", [true, true, true], [
    /justify-between gap-3 flex-wrap/.test(acquisto), /<span className="min-w-0 grow basis-28 py-2">/.test(acquisto), /inline-flex min-h-11 shrink-0 items-center font-semibold underline/.test(acquisto)]);

  // ── T109b-3: CLS del carrello. Al primo disegno il carrello è vuoto, poi arrivano le righe da `localStorage`: il piè di pagina scendeva (0,075 / 0,166 / 0,266).
  //    Il contenitore ha un'altezza minima da schermo intero (meno 3 rem, sempre meno dell'header): il piè di pagina sta sotto la piega nel vuoto e con le righe.
  //    Le misure vere (LayoutShift di Chrome, 1280/390/320) sono prese a mano, non in suite.
  const MINIMA = /^<div class="[^"]*\bmin-h-\[calc\(100svh-3rem\)\]/;
  const carrelloHtml = async (righe) => (await rendiComponente(radice, "src/components/shop/pagine/PaginaCarrello.tsx", "PaginaCarrello", {}, { carrello: carrelloFinto(righe), rivalida: rivalidaFinta(), tariffa: TARIFFA_CARRELLO_OK, pathname: "/shop/carrello" })).html;
  const vuotoHtml = await carrelloHtml([]);
  const pienoHtml = await carrelloHtml(CARRELLO_NUOVO);
  c("T109b-3: lo stato vuoto e lo stato con le righe sono disegnati davvero (non due vuoti)", [true, true], [/<h1/.test(vuotoHtml) && !/<li\b/.test(vuotoHtml), /<li\b/.test(pienoHtml)]);
  c("T109b-3: il contenitore della pagina ha `min-h-[calc(100svh-3rem)]` sia nel vuoto sia con le righe (stessa altezza = il piè di pagina non scende)", [true, true], [MINIMA.test(vuotoHtml), MINIMA.test(pienoHtml)]);

  // ── T109b-4: pillola A15. La spunta della pillola scelta allargava il bottone di 22 px e spingeva la vicina: ora c'è sempre, invisibile se non scelta.
  const delta = CATALOGO.find((p) => p.slug === "patch-prova-delta"); // solo Misura
  const sceltaHtml = (await rendiComponente(radice, "src/components/shop/scheda/SelettoreVariante.tsx", "SelettoreVariante", { prodotto: delta, scelta: { Misura: "Media" }, onScegli() {} }, {})).html;
  const pillole = [...sceltaHtml.matchAll(/<button\b[^>]*aria-checked="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)].map(([, scelta, dentro]) => ({ scelta: scelta === "true", dentro }));
  const spunta = (p) => p.dentro.match(/<svg\b[^>]*>/g) ?? [];
  c("T109b-4: ogni pillola ha la spunta (stessa larghezza scelta o no), nascosta alla lettura", [true, true, true], pillole.map((p) => spunta(p).length === 1 && /aria-hidden="true"/.test(spunta(p)[0])));
  c("T109b-4: la spunta è invisibile (ma occupa lo spazio) in tutte le pillole tranne quella scelta", pillole.map((p) => !p.scelta), pillole.map((p) => spunta(p).length === 1 && /\binvisible\b/.test(spunta(p)[0])));
}
