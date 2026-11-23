/** ── NEGOZIO · T59 · IL CARRELLO MOSTRA LA TARIFFA DEL SERVER ───────────────
 *  `src/shop/cassa/tariffa-carrello.ts` (il lettore puro), `src/shop/useTariffa.ts` (il gancio, accanto a `useRivalidaCarrello`) e la modifica minima di `src/routes/shop.carrello.tsx`
 *  (PIANO-R2 T59, D51). Cosa deve valere:
 *   · solo con il catalogo `cms` spedizione e totale vengono da `tariffaSpedizione` del server; con `codice` il ramo è quello di oggi
 *     (la prova «identico a oggi» di shop-carrello.mjs resta verde) e il gancio non legge niente;
 *   · carrello e cassa leggono la STESSA funzione: stesso importo per lo stesso carrello (provato con la funzione vera sul finto database
 *     e con `calcolaOrdine` della cassa);
 *   · tariffa assente, guasto o risposta storta: nessun totale inventato («—»); con la cassa `stripe` il pulsante dice «Il negozio sta per aprire»;
 *   · nessuna costante di spedizione nel ramo `cms` del carrello. Dati inventati, nessuna rete. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tariffaSeme } from "./_dati-r2.mjs";
import { rendi } from "./_rende.mjs";

const ORA = Date.parse("2026-11-21T12:00:00.000Z");
const nudo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ok = (costoCent) => ({ stato: "ok", costoCent, confermata: false, corriere: null, tempi: null, frase: null });
const assente = { stato: "assente" };

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · IL CARRELLO MOSTRA LA TARIFFA DEL SERVER (21/11/2026, T59)");
  //  Il lettore è puro e sta in `src/shop/cassa/` (le prove impacchettano ogni `.ts` di quella cartella: lì dentro non può importare il server);
  //  il gancio che lo collega a `tariffaSpedizione` sta in `src/shop/`, come `useRivalidaCarrello`.
  const H = mod["shop/cassa/tariffa-carrello"];
  c("il modulo src/shop/cassa/tariffa-carrello.ts esiste", true, !!H);
  if (!H) return;
  const T = mod["shop/cassa/tariffe.server"];
  const CALCOLO = mod["shop/cassa/calcolo"];

  // ── il lettore: stati, memoria, nessun errore verso la pagina ──
  /** Un lettore nuovo con funzioni finte che contano le chiamate; `t` è l'orologio. */
  const nuovo = ({ tariffa = async () => ok(490), cassa = async () => "vecchia" } = {}) => {
    const n = { tariffa: 0, cassa: 0, t: ORA };
    const lettore = H.creaLettoreTariffa({
      tariffa: async () => (n.tariffa++, tariffa()),
      cassa: async () => (n.cassa++, cassa()),
      adesso: () => n.t,
    });
    return { n, leggi: () => lettore.leggi() };
  };
  const a = nuovo();
  c("tariffa `ok`: stato ok, costo in centesimi dal server, cassa non aperta", { stato: "ok", costoCent: 490, chiusa: false }, await a.leggi());
  c("…la cassa non si interroga quando c'è una tariffa (una sola chiamata, quella della tariffa)", [1, 0], [a.n.tariffa, a.n.cassa]);
  const zero = await nuovo({ tariffa: async () => ok(0) }).leggi();
  c("un costo 0 deciso dal titolare è una cifra vera (non «assente»)", ["ok", 0], [zero.stato, zero.costoCent]);

  const sAss = await nuovo({ tariffa: async () => assente, cassa: async () => "stripe" }).leggi();
  c("tariffa assente con cassa `stripe`: nessuna cifra, cassa chiusa («Il negozio sta per aprire»)", { stato: "assente", costoCent: null, chiusa: true }, sAss);
  const vAss = await nuovo({ tariffa: async () => assente, cassa: async () => "vecchia" }).leggi();
  c("tariffa assente con cassa vecchia: nessuna cifra, cassa NON chiusa (la cassa vecchia lavora)", { stato: "assente", costoCent: null, chiusa: false }, vAss);
  const cGuasta = await nuovo({ tariffa: async () => assente, cassa: async () => { throw new Error("rete"); } }).leggi();
  c("tariffa assente e la cassa non risponde: nessuna cifra, cassa non dichiarata chiusa", { stato: "assente", costoCent: null, chiusa: false }, cGuasta);

  const g = await nuovo({ tariffa: async () => { throw new Error("rete"); } }).leggi();
  c("il server non risponde: stato `guasto`, nessuna cifra, nessuna eccezione verso la pagina", { stato: "guasto", costoCent: null, chiusa: false }, g);
  for (const [nome, risposta] of [["costo negativo", ok(-1)], ["costo decimale", ok(4.9)], ["costo in testo", ok("490")], ["costo mancante", { stato: "ok" }], ["costo NaN", ok(NaN)], ["stato strano", { stato: "boh", costoCent: 490 }], ["nulla", null], ["testo", "ok"]]) {
    const r = await nuovo({ tariffa: async () => risposta }).leggi();
    c(`risposta storta (${nome}): guasto, mai una cifra inventata`, ["guasto", null], [r.stato, r.costoCent]);
  }

  const m = nuovo();
  await m.leggi(); await m.leggi();
  c("memoria breve: due letture entro 30 s = una chiamata al server", 1, m.n.tariffa);
  m.n.t = ORA + 29_000; await m.leggi();
  c("…a 29 s ancora la stessa", 1, m.n.tariffa);
  m.n.t = ORA + 31_000; await m.leggi();
  c("…dopo 31 s si rilegge", 2, m.n.tariffa);
  const insieme = nuovo();
  await Promise.all([insieme.leggi(), insieme.leggi(), insieme.leggi()]);
  c("tre letture contemporanee = una sola chiamata", 1, insieme.n.tariffa);
  let cambia = 0;
  const gu = nuovo({ tariffa: async () => { if (cambia++ === 0) throw new Error("rete"); return ok(490); } });
  const g1 = await gu.leggi(), g2 = await gu.leggi();
  c("un guasto NON si ricorda a lungo: alla lettura dopo il server risponde e la cifra torna", ["guasto", "ok"], [g1.stato, g2.stato]);

  // ── carrello e cassa leggono la stessa funzione: stesso importo per lo stesso carrello ──
  if (T && CALCOLO) {
    const dbCon = (costo) => fintoDb({ tabelle: { shop_spedizioni_tariffe: [tariffaSeme({ costo_cent: costo })] } });
    const riga = (prezzo_cent) => ({ sku: "PROVA-A", slug: "prodotto-a", nome: "Prodotto A", nome_variante: null, prezzo_cent, attiva: true, pubblicato: true, giacenza: 50 });
    const diverse = [];
    for (const costo of [490, 590, 0, 99900]) {
      const db = dbCon(costo);
      const vera = () => T.tariffaSpedizione({ db, adesso: () => ORA, cassa: async () => "vecchia" });
      const carrello = (await H.creaLettoreTariffa({ tariffa: vera, cassa: async () => "vecchia", adesso: () => ORA }).leggi()).costoCent;
      for (const [prezzo, qty] of [[2890, 1], [2890, 3], [19900, 1]]) {
        const cassa = CALCOLO.calcolaOrdine([riga(prezzo)], [{ sku: "PROVA-A", qty }], { paese: "IT", costo_cent: costo, gratis_da_cent: null, attiva: true });
        if (!cassa.ok || cassa.spedizioneCent !== carrello) diverse.push([costo, prezzo, qty, carrello, cassa.spedizioneCent]);
      }
    }
    c("carrello e cassa: stesso importo di spedizione per lo stesso carrello (4 tariffe × 3 carrelli, anche sopra i 59 €)", [], diverse);
  }

  // ── il sorgente del gancio ──
  const gancio = nudo(readFileSync(join(radice, "src/shop/useTariffa.ts"), "utf8"));
  const lettore = nudo(readFileSync(join(radice, "src/shop/cassa/tariffa-carrello.ts"), "utf8"));
  c("il gancio legge `tariffaSpedizione` di `tariffe.functions` (la funzione che legge anche la cassa) e la cassa da `cassaDelSito`", [true, true], [/import \{[^}]*\btariffaSpedizione\b[^}]*\} from "@\/shop\/cassa\/tariffe\.functions"/.test(gancio), /import \{[^}]*\bcassaDelSito\b[^}]*\} from "@\/shop\/cms\/cassa-sito\.functions"/.test(gancio)]);
  c("…con `attiva` falsa non legge niente (il catalogo `codice` non chiama il server)", true, /if \(!attiva\) return/.test(gancio));
  c("…il lettore non importa il server (resta impacchettabile dalle prove) e nessuna costante di spedizione né nel lettore né nel gancio (né 490, né `SPEDIZIONE_CMS_CENT`, né la soglia dei 59 €)", [false, false], [/\.functions"/.test(lettore), /\b490\b|SPEDIZIONE_CMS_CENT|SHIPPING_|\b59\b/.test(gancio + lettore)]);

  // ── il sorgente del carrello ──
  const FILE = "src/routes/shop.carrello.tsx";
  const carr = nudo(readFileSync(join(radice, FILE), "utf8"));
  c("carrello: importa `useTariffa` e non importa più `SPEDIZIONE_CMS_CENT`", [true, false], [/import \{ useTariffa \} from "@\/shop\/useTariffa"/.test(carr), /SPEDIZIONE_CMS_CENT/.test(carr)]);
  c("carrello: il gancio si chiama sempre (regola degli hook) e legge solo con `cms`", true, /const tariffa = useTariffa\(cms\)/.test(carr));
  const ramoCms = /const shipping = cms \? ([^:]+) : /.exec(carr)?.[1] ?? "";
  c("carrello: nel ramo `cms` la spedizione è la cifra del server, senza `SPEDIZIONE_CMS_CENT`, `SHIPPING_COST` né `SHIPPING_THRESHOLD`", [true, false], [ramoCms.includes("tariffa.costoCent"), /SPEDIZIONE_CMS_CENT|SHIPPING_COST|SHIPPING_THRESHOLD/.test(ramoCms)]);
  c("carrello: il ramo `codice` è quello di oggi (soglia 59 € e 4,90 € nella stessa riga, la nota «Aggiungi … per la spedizione gratuita» solo fuori da `cms`)", [true, true], [
    /const shipping = cms \? [^:]+ : subtotal >= SHIPPING_THRESHOLD \|\| subtotal === 0 \? 0 : SHIPPING_COST;/.test(carr), /shipping > 0 && !cms && \(\s*<p[^>]*>\s*Aggiungi/.test(carr)]);

  // ── il marchio reso ──
  const riga1 = { productId: "PROVA-001-A", qty: 2, key: "PROVA-001-A", sku: "PROVA-001-A", snap: { nome: "Prodotto di prova", slug: "prodotto-di-prova", prezzoCent: 2890, foto: null, varianteNome: "Variante X" } };
  const carrelloFinto = (sub) => ({ lines: [riga1], subtotal: sub, count: 2, setQty() {}, remove() {}, clear() {}, replaceLines() {}, add() {} });
  const rivFinto = { stato: "ok", avviso: null, controlla: async () => ({ stato: "non_verificabile" }) };
  const rendiCon = (tariffa, modo = "cms", sub = 57.8) => rendi(radice, FILE, { loaderData: { modo }, carrello: carrelloFinto(sub), rivalida: rivFinto, tariffa });
  //  T98: il riepilogo nuovo è una lista di definizioni (`RiepilogoOrdine`): «Spedizione» e «Totale (IVA inclusa)» con la cifra accanto
  const spedizione = (h) => /<dt>Spedizione<\/dt><dd[^>]*>([^<]*)</.exec(h)?.[1];
  const totale = (h) => /<dt[^>]*>Totale <span[^>]*>\(IVA inclusa\)<\/span><\/dt><dd[^>]*>([^<]*)</.exec(h)?.[1];
  //  il carrello di `codice` è quello di oggi: le sue cifre stanno ancora in due `<span>`
  const spedizioneOggi = (h) => /Spedizione<\/span><span[^>]*>([^<]*)</.exec(h)?.[1];
  const sp = (s) => s?.replace(/\s/g, " ");

  for (const [nome, costo, spesa, tot] of [["4,90", 490, "4,90 €", "62,70 €"], ["5,90 (il titolare l'ha cambiata)", 590, "5,90 €", "63,70 €"], ["12,00", 1200, "12,00 €", "69,80 €"]]) {
    const r = await rendiCon({ stato: "ok", costoCent: costo, chiusa: false });
    c(`CARRELLO CMS con la tariffa del server a ${nome}: spedizione e totale seguono quella cifra`, [spesa, tot], [sp(spedizione(r.html)), sp(totale(r.html))]);
  }
  const gratis = await rendiCon({ stato: "ok", costoCent: 0, chiusa: false });
  c("CARRELLO CMS con la tariffa a 0 decisa dal titolare: una cifra vera (0,00 €, senza parole di soglia) e totale = subtotale", ["0,00 €", "57,80 €", false], [sp(spedizione(gratis.html)), sp(totale(gratis.html)), /gratuit/i.test(gratis.html)]);
  const sopra = await rendiCon({ stato: "ok", costoCent: 490, chiusa: false }, "cms", 86.7);
  c("CARRELLO CMS sopra i 59 €: la spedizione non diventa gratis (nessuna soglia nel ramo cms)", ["4,90 €", /per la spedizione/.test(sopra.html)], [sp(spedizione(sopra.html)), false]);
  //  T79/T89: in attesa della tariffa spedizione e totale sono «…» (si sta controllando), se la cifra non c'è e non arriverà sono «—»
  for (const [nome, t, segno] of [["in attesa", { stato: "attesa", costoCent: null, chiusa: false }, "…"], ["assente con cassa vecchia", { stato: "assente", costoCent: null, chiusa: false }, "—"], ["assente con cassa stripe", { stato: "assente", costoCent: null, chiusa: true }, "—"], ["guasto", { stato: "guasto", costoCent: null, chiusa: false }, "—"]]) {
    const r = await rendiCon(t);
    const vietato = /4,90|5,90|62,70|\bGratuita\b/.test(spedizione(r.html) + totale(r.html));
    c(`CARRELLO CMS con la tariffa ${nome}: spedizione e totale «${segno}», nessuna cifra inventata né «Gratuita»`, [segno, segno, false], [spedizione(r.html), totale(r.html), vietato]);
  }
  const chiusa = await rendiCon({ stato: "assente", costoCent: null, chiusa: true });
  const aperta = await rendiCon({ stato: "assente", costoCent: null, chiusa: false });
  const normale = await rendiCon({ stato: "ok", costoCent: 490, chiusa: false });
  //  T98: il bottone del carrello nuovo è sempre «Vai alla cassa» verso la cassa di oggi (che dice lei, se il negozio sta per aprire): mai spento, mai le parole di prima
  c("pulsante: con la cassa chiusa, aperta o normale è sempre «Vai alla cassa» verso `/shop/checkout`; mai «Procedi al checkout»", [true, true, true, false], [
    [chiusa, aperta, normale].every((r) => /<a [^>]*href="\/shop\/checkout"[^>]*>Vai alla cassa<\/a>/.test(r.html)), [chiusa, aperta, normale].every((r) => !/<a [^>]*href="\/shop\/checkout"[^>]*disabled/.test(r.html)), /<a data-barra-nascondi="vista" href="\/shop\/checkout"/.test(chiusa.html),
    [chiusa, aperta, normale].some((r) => /Procedi al checkout/.test(r.html))]);

  const codice = await rendi(radice, FILE, { loaderData: { modo: "codice" }, carrello: { ...carrelloFinto(57.8), lines: [] , count: 0 }, rivalida: rivFinto, tariffa: { stato: "ok", costoCent: 999, chiusa: true } });
  c("CARRELLO `codice`: il gancio è chiamato con `false` (non legge) e la cifra del server non si vede mai", [[false], false], [codice.pagina.tariffaChiesta, /9,99/.test(codice.html)]);
  const codicePieno = await rendi(radice, FILE, { loaderData: { modo: "codice" }, carrello: { ...carrelloFinto(30), lines: [{ productId: "t01", qty: 1, key: "t01" }] }, rivalida: rivFinto, tariffa: { stato: "ok", costoCent: 999, chiusa: true } });
  c("CARRELLO `codice` con una riga: spedizione 4,90 € come oggi (sotto i 59 €), pulsante normale, anche se il finto del server dice altro", ["4,90 €", true, false], [sp(spedizioneOggi(codicePieno.html)), /Procedi al checkout/.test(codicePieno.html), /sta per aprire/.test(codicePieno.html)]);
  const tre = await rendi(radice, FILE, { loaderData: { modo: "codice" }, carrello: { ...carrelloFinto(86.7), lines: [{ productId: "t01", qty: 3, key: "t01" }] }, rivalida: rivFinto });
  c("CARRELLO `codice` da 59 € in su: «Gratuita» come oggi", "Gratuita", spedizioneOggi(tre.html));
}
