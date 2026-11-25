/** ── VETRINA V1 · T114 · osservazioni 4, 5, 6 del marketing (24/11/2026) ───────────────────────────────────────────────────
 *  (4) scheda a 390: nome scelto sulla riga dell'etichetta, niente margine per la zona messaggio vuota, spazi più stretti (il bottone sale di 47 px: misura a mano in Chrome);
 *  (5) carrello: riga di fiducia (voci vere) sotto il totale, loader `cms` con le stesse fonti della scheda;
 *  (6) scheda tutta esaurita: uscita «Continua a guardare» verso la categoria. (7) «Roma» ripetuto: NON toccato (D96, vedi lavagna). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";
import { rendi, rendiComponente } from "./_rende.mjs";

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const leggibile = (h) => h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T114 · SPAZI DELLA SCELTA, RIGA DI FIDUCIA NEL CARRELLO, USCITA DALL'ESAURITO");
  const leggi = (f) => senzaCommenti(readFileSync(join(radice, "src", f), "utf8"));
  const sel = leggi("components/shop/scheda/SelettoreVariante.tsx");
  const blocco = leggi("components/shop/scheda/BloccoAcquisto.tsx");

  // ── (4)
  const alfa = D.CATALOGO.find((p) => p.slug === "patch-prova-alfa");
  const h = (await rendiComponente(radice, "src/components/shop/scheda/SelettoreVariante.tsx", "SelettoreVariante", { prodotto: alfa, scelta: { Colore: "Castano" }, onScegli() {} }, {})).html;
  c("T114-4: il nome scelto sta sulla riga dell'etichetta (prima dei campioni, non sotto)", true, h.indexOf("data-scelto") > 0 && h.indexOf("data-scelto") < h.indexOf('role="radiogroup"'));
  c("T114-4: spazi stretti: gruppi `space-y-4` (non 5), nessun `space-y-2` nel gruppo, messaggio con il suo `mt-2`", [true, false, false, true], [
    sel.includes('className="space-y-4"'), sel.includes("space-y-5"), sel.includes('<div className="space-y-2">'), /<p className="mt-2 flex items-start/.test(sel)]);
  c("T114-4: il blocco d'acquisto ha `gap-4` (non 5) fra testata, prezzo, scelta e bottone", [true, false], [/className="flex flex-col gap-4"/.test(blocco), /className="flex flex-col gap-5"/.test(blocco)]);

  // ── (6)
  const bloccoAcq = { id: "acquisto", acquistabile: true, rigaSpedizione: false };
  const esaurito = D.CATALOGO.find((p) => p.slug === "patch-prova-epsilon");
  const props = (p) => ({ prodotto: p, blocco: bloccoAcq, scelta: {}, onScegli() {}, acquisto: { aggiungi() {}, variante: null, esaurito: true, aggiunto: false, nelCarrello: false, mancante: null, frase: null, selettoreRef: { current: null } }, voci: [], testi: {}, formatta: (x) => String(x) });
  const hE = (await rendiComponente(radice, "src/components/shop/scheda/BloccoAcquisto.tsx", "BloccoAcquisto", props(esaurito), {})).html;
  const link = [...hE.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([^<]*)</g)].find((m) => m[2] === "Continua a guardare");
  c("T114-6: prodotto tutto esaurito: c'è «Continua a guardare» (testo già nel codice) verso la sua categoria", [true, `/shop/c/${esaurito.categorie[0].slug}`], [!!link, link?.[1]]);
  const hOk = (await rendiComponente(radice, "src/components/shop/scheda/BloccoAcquisto.tsx", "BloccoAcquisto", { ...props(alfa), acquisto: { ...props(alfa).acquisto, esaurito: false } }, {})).html;
  c("T114-6: prodotto con varianti disponibili: nessuna uscita in più", false, leggibile(hOk).includes("Continua a guardare"));

  // ── (5)
  const R = "src/routes/shop.carrello.tsx";
  const server = (tariffa) => ({ modalitaCatalogo: () => "cms", tariffaSpedizione: () => tariffa, contenutoShop: () => ({ testi: {}, media: { } , conf: 0 }), cassaPubblica: () => null });
  const caricato = async (tariffa, contenuto) => {
    const { route, pagina } = await rendi(radice, R, { loaderData: { modo: "cms" }, server: { ...server(tariffa), contenutoShop: () => contenuto } });
    return { v: await route.loader(), chiamate: [...pagina.chiamate].sort() };
  };
  const conReso = { testi: { "shop.conf.reso": "Reso di prova in una frase." }, media: {} };
  const r1 = await caricato(D.TARIFFA_OK, conReso);
  c("T114-5: loader `cms`: le tre fonti della scheda in più, e un valore `{ modo, voci }`", [["cassaPubblica", "contenutoShop", "modalitaCatalogo", "tariffaSpedizione"], ["modo", "voci"]], [r1.chiamate, Object.keys(r1.v).sort()]);
  c("T114-5: spedizione con i tempi confermati: la voce c'è (testo della scheda); senza tempi non si ripete il costo del riepilogo", [true, false], [
    r1.v.voci.some((x) => x.id === "spedizione"), (await caricato({ stato: "ok", costoCent: 490, confermata: false }, conReso)).v.voci.some((x) => x.id === "spedizione")]);
  const hC = (await rendi(radice, "src/components/shop/pagine/PaginaCarrello.tsx", { loaderData: { modo: "cms" }, carrello: D.CARRELLO_NUOVO ? { lines: D.CARRELLO_NUOVO, setQty() {}, remove() {}, add() {}, count: 2 } : null, rivalida: { stato: "ok", avviso: null, controlla: async () => {} }, tariffa: D.TARIFFA_CARRELLO_OK }, "PaginaCarrello").catch(() => ({ html: "" }))).html;
  c("T114-5: sorgente: `PaginaCarrello` monta `BloccoFiducia` DOPO `RiepilogoOrdine`, con le voci date dalla rotta (nessun testo scritto a mano)", [true, true], [
    /<RiepilogoOrdine[^>]*\/>\s*(?:\{\}\s*)?<BloccoFiducia voci=\{voci \?\? \[\]\}/.test(leggi("components/shop/pagine/PaginaCarrello.tsx")), hC === "" || !/undefined|\[object/.test(hC)]);
}
