/** ── VETRINA V1 · T87a · LA SCELTA DELLA VARIANTE (IL COMPONENTE) ─────────────────────────────────────────────
 *  `src/components/shop/scheda/SelettoreVariante.tsx`, disegnato davvero (esbuild + react-dom/server, `_rende.mjs`).
 *  Cosa deve valere (SPEC §4.5.4 n. 3-4; V1-S3 parte, V1-S4, V1-T11, V1-T12):
 *   · ogni opzione è un `radiogroup` col suo nome; il colore è a campioni a cerchio con la foto vera (o la prima lettera su notte, mai un
 *     colore inventato), le altre opzioni sono pillole; tutti i bersagli da 44 px, anello di fuoco `shop-anello`;
 *   · una sola tappa di tabulazione per gruppo (il valore scelto, o il primo); frecce/Home/End spostano e scelgono (`passoDaTasto`, che
 *     riusa `comandoDaTasto` e `stepGalleria` di T105);
 *   · il valore scelto ha l'anello + la spunta e il suo nome sotto; un valore esaurito ha la diagonale e la parola «Esaurito» nell'etichetta
 *     (`etichettaCampione`) ma si può scegliere: è così che il bottone di T87b diventa «Esaurito» (V1-S4);
 *   · senza scelta il messaggio «Scegli il colore.» (da `testi-shop.ts`) sta accanto al gruppo, in una zona `aria-live`; un'opzione che non ha
 *     il suo testo non mostra mai «undefined»: ripiego = il nome dell'opzione;
 *   · la scelta di una variante intera si conta (`shop_variante_scelta`, solo lo SKU, mai alle piattaforme).
 *  Fuoco vero, frecce nel browser e `aria-live` che annuncia non girano senza browser (D103): si provano le funzioni pure, gli attributi e il
 *  marchio; il resto è a T103c/T104. Dati inventati (`_dati-vetrina.mjs`), nessuna rete. */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATALOGO, CATALOGO_UNA_FOTO, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
const FILE = "src/components/shop/scheda/SelettoreVariante.tsx";
const per = (slug, catalogo = CATALOGO) => catalogo.find((p) => p.slug === slug);
const copia = (x) => structuredClone(x);
/** Il testo che si legge: senza marcatura. */
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;
/** Le aperture `<button …>` dei radio, in ordine di documento, con gli attributi letti in un oggetto. */
function radio(html) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, a, dentro]) => ({
    attr: Object.fromEntries([...a.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])),
    cru: a,
    dentro,
  }));
}
/** I gruppi `<div role="radiogroup" …>`: l'apertura, e tutto il resto fino al prossimo gruppo (basta per le prove). */
const gruppi = (html) => html.split(/(?=<div[^>]*role="radiogroup")/).filter((x) => x.includes('role="radiogroup"'));

export async function prove(mod, { c, gruppo, radice }) {
  const V = mod["shop/cms/vetrina-varianti"];
  const E = mod["shop/cms/vetrina-eventi"];
  const T = await carica(radice, "src/landing/testi-shop.ts");

  gruppo("VETRINA V1 · T87a · SCELTA DELLA VARIANTE (23/11/2026)");

  const alfa = per("patch-prova-alfa"); // Colore ×3, con la foto dei campioni
  const alfaSenzaFoto = per("patch-prova-alfa", CATALOGO_UNA_FOTO); // Colore ×3, nessun campione
  const gamma = per("patch-prova-gamma"); // Colore, Lunghezza, Misura; esaurite: Nero/Corta/Piccola e Castano/Corta/Grande
  const delta = per("patch-prova-delta"); // solo Misura
  const kit = per("kit-prova"); // nessuna opzione

  const disegna = async (p, scelta = {}, extra = {}) => {
    const onScegli = (s) => (r.pagina.scelte ??= []).push(s);
    const r = await rendiComponente(radice, FILE, "SelettoreVariante", { prodotto: p, scelta, onScegli, ...extra }, {});
    return r;
  };

  // ════ i gruppi ════════════════════════════════════════════════════════════
  const a = await disegna(alfa);
  c("un'opzione = un gruppo `radiogroup` (alfa: solo Colore)", 1, conta(a.html, /role="radiogroup"/g));
  c("tre campioni = tre radio", 3, conta(a.html, /role="radio"/g));
  const gr = (await disegna(gamma)).html;
  c("tre opzioni = tre gruppi, nell'ordine dei dati", ["Colore", "Lunghezza", "Misura"], gruppi(gr).map((g) => g.match(/data-opzione="([^"]*)"/)?.[1]));
  c("ogni gruppo ha il suo nome (aria-labelledby → un testo con il nome dell'opzione)", [true, true, true], gruppi(gr).map((g) => {
    const id = g.match(/aria-labelledby="([^"]*)"/)?.[1];
    const testo = id && gr.match(new RegExp(`id="${id.replace(/[:]/g, "\\$&")}"[^>]*>([^<]*)<`))?.[1];
    return testo === g.match(/data-opzione="([^"]*)"/)?.[1];
  }));
  c("gamma: 2 + 2 + 2 = 6 radio (colore a campioni, lunghezza e misura a pillole)", 6, conta(gr, /role="radio"/g));
  c("kit (nessuna opzione): niente da disegnare", "", (await disegna(kit)).html);
  c("opzioni non valide → niente, nessun errore", ["", ""], [(await disegna({ ...alfa, opzioni: null })).html, (await disegna({ ...alfa, opzioni: [] })).html]);

  // ── campioni: foto vera, o la prima lettera su notte ──
  const sa = radio(a.html);
  c("con la foto: un'immagine per campione, quella del campione (480)", alfa.opzioni[0].valori.map((v) => v.campione.w480), sa.map((r) => r.dentro.match(/<img[^>]*\ssrc="([^"]*)"/)?.[1]));
  c("…con `alt` vuoto (il nome sta nell'etichetta del radio) e senza lettera", [true, false], [sa.every((r) => /<img[^>]*\salt=""/.test(r.dentro)), sa.some((r) => /[NCB]</.test(r.dentro))]);
  const sf = radio((await disegna(alfaSenzaFoto)).html);
  c("senza la foto: la prima lettera (N, C, B) e nessuna immagine", [["N", "C", "B"], 0], [sf.map((r) => leggibile(r.dentro)), sf.reduce((n, r) => n + conta(r.dentro, /<img/g), 0)]);
  c("…su fondo notte (mai un colore inventato dal nome)", true, sf.every((r) => /bg-\[#0A1430\]/.test(r.dentro) && !/style="[^"]*background/.test(r.dentro)));
  const sd = radio((await disegna(delta)).html);
  c("misura = pillole col testo, nessuna immagine", [["Piccola", "Media", "Grande"], 0], [sd.map((r) => leggibile(r.dentro)), sd.reduce((n, r) => n + conta(r.dentro, /<img/g), 0)]);
  c("in gamma solo il Colore è a campioni (lunghezza e misura sono pillole col testo)", [2, 0], [conta(gruppi(gr)[0], /<img/g), conta(gruppi(gr)[1] + gruppi(gr)[2], /<img/g)]);

  // ── una tappa di tabulazione per gruppo: il valore scelto o il primo ──
  c("nulla scelto: Tab raggiunge solo il PRIMO radio di ogni gruppo (gli altri -1)", [["0", "-1", "-1"]], [sa.map((r) => r.attr.tabindex)]);
  const sc = radio((await disegna(alfa, { Colore: "Castano" })).html);
  c("scelto Castano: aria-checked solo su di lui, ed è lui la tappa (0)", [["false", "true", "false"], ["-1", "0", "-1"]], [sc.map((r) => r.attr["aria-checked"]), sc.map((r) => r.attr.tabindex)]);
  c("un valore che non c'è più vale come non scelto: tappa sul primo, nessun checked", [["0", "-1", "-1"], 0], [radio((await disegna(alfa, { Colore: "Fucsia" })).html).map((r) => r.attr.tabindex), conta((await disegna(alfa, { Colore: "Fucsia" })).html, /aria-checked="true"/g)]);
  const gs = gruppi((await disegna(gamma, { Colore: "Castano", Lunghezza: "Media" })).html);
  c("gamma, due scelte fatte: ogni gruppo ha UNA tappa (3 in tutto)", 3, conta(gs.join(""), /tabindex="0"/g));
  c("nessun radio con `disabled` e nessun `aria-disabled`: si tabula sempre e si può sempre scegliere", 0, conta(gr, /\sdisabled|aria-disabled/g));
  c("i radio sono bottoni di tipo `button` (mai un invio di modulo)", true, radio(gr).every((r) => r.attr.type === "button"));

  // ── selezionato = anello + spunta + nome sotto ──
  const sel = radio((await disegna(alfa, { Colore: "Castano" })).html);
  c("la spunta c'è solo nel valore scelto", [0, 1, 0], sel.map((r) => conta(r.dentro, /<svg/g)));
  c("…l'anello è un bordo notte (non c'è in quelli non scelti)", [false, true, false], sel.map((r) => /border-\[#0A1430\](?!\/)/.test(r.attr.class ?? "")));
  const sottoDi = (html) => html.match(/<p[^>]*data-scelto[^>]*>([^<]*)</)?.[1];
  c("il nome del valore scelto sta sotto i campioni (vuoto se non si è scelto)", ["Castano", ""], [sottoDi((await disegna(alfa, { Colore: "Castano" })).html), sottoDi(a.html)]);
  c("sotto i campioni c'è sempre il posto del nome (`min-h-`: niente salti al momento della scelta)", true, /<p[^>]*data-scelto[^>]*min-h-/.test(a.html) || /<p[^>]*min-h-[^>]*data-scelto/.test(a.html));
  c("le pillole non hanno la riga del nome (il nome è la pillola)", 0, conta((await disegna(delta, { Misura: "Media" })).html, /data-scelto/g));
  const pillole = radio((await disegna(delta, { Misura: "Media" })).html);
  c("la pillola scelta si riempie di notte con il testo bianco (e ha aria-checked: non solo il colore)", [[false, true, false], [false, true, false]], [pillole.map((r) => /bg-\[#0A1430\]/.test(r.attr.class)), pillole.map((r) => r.attr["aria-checked"] === "true")]);

  // ── esaurito: diagonale + parola nell'etichetta ──
  const sg = radio((await disegna(gamma, { Lunghezza: "Corta", Misura: "Piccola" })).html);
  c("etichette dei colori: «Nero, Esaurito» (Nero/Corta/Piccola è esaurita) e «Castano»", ["Nero, Esaurito", "Castano"], sg.slice(0, 2).map((r) => r.attr["aria-label"]));
  c("…la parola viene da `testi-shop.ts` (non scritta nel componente)", true, sg[0].attr["aria-label"].endsWith(`, ${T.TESTI_SHOP.scheda.esaurito}`));
  c("…e le etichette sono quelle di `etichettaCampione` con `valoreEsaurito` (nessuna regola riscritta)", ["Nero, Esaurito", "Castano"], ["Nero", "Castano"].map((v) => V.etichettaCampione(v, V.valoreEsaurito(gamma, "Colore", v, { Lunghezza: "Corta", Misura: "Piccola" }))));
  c("la diagonale c'è solo sul valore esaurito (data-esaurito) e non nell'altro", [true, false], [/data-esaurito/.test(sg[0].dentro), /data-esaurito/.test(sg[1].dentro)]);
  c("con altre scelte cambia: Lunghezza Corta + Misura Grande → Castano esaurito, Nero no", ["Nero", "Castano, Esaurito"], radio((await disegna(gamma, { Lunghezza: "Corta", Misura: "Grande" })).html).slice(0, 2).map((r) => r.attr["aria-label"]));
  c("l'esaurito si può scegliere (V1-S4: «scegliendola il bottone è disabilitato Esaurito»): il radio è un bottone vivo, senza disabled", [false, false], [/\sdisabled/.test(sg[0].cru), /aria-disabled/.test(sg[0].cru)]);
  const sp = radio((await disegna(gamma, { Colore: "Castano", Lunghezza: "Corta" })).html).slice(4);
  c("misura con Castano/Corta: Grande esaurita, Piccola no (etichetta e diagonale)", [["Piccola", "Grande, Esaurito"], [false, true]], [sp.map((r) => r.attr["aria-label"]), sp.map((r) => /data-esaurito/.test(r.dentro))]);
  c("nessun prodotto, nemmeno tutto esaurito, mette `disabled` sui radio (epsilon)", 0, conta((await disegna(per("patch-prova-epsilon"))).html, /\sdisabled/g));
  c("epsilon (tutto esaurito, un solo colore): il campione è «Unico, Esaurito»", ["Unico, Esaurito"], radio((await disegna(per("patch-prova-epsilon"))).html).map((r) => r.attr["aria-label"]));

  // ── il messaggio accanto alla scelta mancante ──
  const senza = await disegna(alfa);
  c("senza messaggio: la zona `aria-live` c'è (vuota) e nessun testo «Scegli»", [true, false], [/aria-live="polite"/.test(senza.html), /Scegli/.test(senza.html)]);
  const colore = V.messaggioMancante(alfa.opzioni, {});
  const msg = await disegna(alfa, {}, { mancante: colore });
  c("manca il colore: «Scegli il colore.» accanto al gruppo del colore", true, leggibile(msg.html).includes("Scegli il colore."));
  c("…il testo viene da `testi-shop.ts` (TESTI_PROVVISORI.scheda.scegli.colore)", true, leggibile(msg.html).includes(T.TESTI_PROVVISORI.scheda.scegli.colore));
  c("…dentro la zona `aria-live` (il lettore di schermo lo dice)", true, /aria-live="polite"[^>]*>(?:(?!<\/div>)[\s\S])*Scegli il colore\./.test(msg.html));
  c("…e il gruppo lo richiama con aria-describedby (stesso id del messaggio)", true, (() => { const id = msg.html.match(/role="radiogroup"[^>]*aria-describedby="([^"]*)"/)?.[1] ?? msg.html.match(/aria-describedby="([^"]*)"[^>]*role="radiogroup"/)?.[1]; return !!id && msg.html.includes(`id="${id}"`); })());
  c("senza messaggio il gruppo non punta a niente (nessun aria-describedby)", 0, conta(senza.html, /aria-describedby/g));
  c("il messaggio sta nel gruppo giusto: manca la Lunghezza → solo lì, non nel Colore", [false, true, false], gruppi((await disegna(gamma, { Colore: "Nero" }, { mancante: V.messaggioMancante(gamma.opzioni, { Colore: "Nero" }) })).html).map((g) => g.includes("Scegli")));
  c("manca la misura → «Scegli la misura.»", true, leggibile((await disegna(delta, {}, { mancante: V.messaggioMancante(delta.opzioni, {}) })).html).includes("Scegli la misura."));
  c("il messaggio non è disegnato come un errore di solo colore: ha un'icona", true, /<svg/.test(msg.html.slice(msg.html.indexOf('aria-live="polite"'))));
  // un nome libero del CRM: nessuna chiave nei testi → ripiego, mai «undefined»
  const strano = { ...copia(alfa), opzioni: [{ nome: "Finitura", valori: [{ valore: "Opaca", campione: null }, { valore: "Lucida", campione: null }] }], varianti: [{ sku: "PAT-ALFA-01", nome: "Opaca", opzioni: { Finitura: "Opaca" }, prezzoCent: 100, disponibile: true }, { sku: "PAT-ALFA-02", nome: "Lucida", opzioni: { Finitura: "Lucida" }, prezzoCent: 100, disponibile: true }] };
  const mStrano = V.messaggioMancante(strano.opzioni, {});
  const rStrano = await disegna(strano, {}, { mancante: mStrano });
  c("opzione «Finitura» (nome libero, nessun testo previsto): la chiave non esiste ma si legge il nome, mai «undefined»", [{ opzione: "Finitura", chiave: "scheda.scegli.finitura" }, true, false, false], [mStrano, leggibile(rStrano.html).includes("Finitura"), /undefined|null|NaN|\[object/.test(rStrano.html), leggibile(rStrano.html).includes("scheda.scegli")]);
  c("…e anche con una chiave senza opzione nei dati (messaggio vecchio): niente errori", "string", typeof (await disegna(alfa, {}, { mancante: { opzione: "Altro", chiave: "scheda.scegli.altro" } })).html);
  c("il nome di un'opzione non prende mai il posto dell'HTML (nessuna marcatura dal nome)", false, (await disegna({ ...copia(strano), opzioni: [{ nome: "<b>x</b>", valori: [{ valore: "<i>y</i>", campione: null }] }] })).html.includes("<b>x</b>"));

  // ── la scelta: cosa fa il clic ──
  const clicca = async (p, scelta, etichetta) => {
    const r = await disegna(p, scelta);
    const g = r.pagina.gestori.find((x) => x.tipo === "button" && (x.props["aria-label"] === etichetta || leggibile(JSON.stringify(x.props.children)).includes(etichetta)));
    if (!g) throw new Error(`nessun radio «${etichetta}»`);
    g.props.onClick({ preventDefault() {} });
    return r.pagina;
  };
  let p1 = await clicca(alfa, {}, "Castano");
  c("clic su Castano: onScegli con la scelta nuova (le altre scelte restano)", [{ Colore: "Castano" }], p1.scelte);
  c("…e una variante intera è scelta: il conteggio `shop_variante_scelta` con il solo SKU", [["shop_variante_scelta", { sku: V.skuScelto(alfa, { Colore: "Castano" }) }]], p1.contatori);
  c("…lo SKU è quello della variante (lo stesso di `contaVariante`)", E.contaVariante(V.skuScelto(alfa, { Colore: "Castano" })).payload, p1.contatori[0][1]);
  let p2 = await clicca(gamma, { Lunghezza: "Media" }, "Nero");
  c("gamma, scelta ancora incompleta: onScegli sì, il conteggio no (non c'è ancora una variante)", [[{ Lunghezza: "Media", Colore: "Nero" }], undefined], [p2.scelte, p2.contatori]);
  let p3 = await clicca(gamma, { Lunghezza: "Media", Misura: "Grande" }, "Nero");
  c("gamma, completata col colore: una variante, un conteggio con il suo SKU", [1, V.skuScelto(gamma, { Lunghezza: "Media", Misura: "Grande", Colore: "Nero" })], [p3.contatori.length, p3.contatori[0][1].sku]);
  let p4 = await clicca(alfa, { Colore: "Castano" }, "Castano");
  c("clic sul valore già scelto: niente cambia, niente conteggio (un conteggio per scelta, non per clic)", [undefined, undefined], [p4.scelte, p4.contatori]);
  let p5 = await clicca(gamma, { Colore: "Nero", Lunghezza: "Corta" }, "Piccola, Esaurito");
  c("si sceglie anche un esaurito (Nero/Corta/Piccola): onScegli, e il conteggio parte con quello SKU", [[{ Colore: "Nero", Lunghezza: "Corta", Misura: "Piccola" }], 1], [p5.scelte, p5.contatori?.length]);
  c("la scelta passata non viene toccata (nuovo oggetto, mai la stessa memoria)", true, await (async () => { const scelta = { Colore: "Nero" }; const r = await disegna(gamma, scelta); r.pagina.gestori.find((x) => x.tipo === "button" && x.props["aria-label"] === "Media")?.props.onClick({}); return JSON.stringify(scelta) === '{"Colore":"Nero"}'; })());

  // ── tastiera: la logica pura (e il fuoco, con un albero finto) ──
  const K = await carica(radice, FILE);
  const passo = K.passoDaTasto;
  c("frecce destra/giù = il prossimo; sinistra/su = il precedente", [1, 2, 0, 1], [passo("ArrowRight", 0, 3), passo("ArrowDown", 1, 3), passo("ArrowLeft", 1, 3), passo("ArrowUp", 2, 3)]);
  c("Home e End vanno al primo e all'ultimo", [0, 2], [passo("Home", 2, 3), passo("End", 0, 3)]);
  c("ai bordi ci si ferma (come la galleria: nessun giro)", [2, 0], [passo("ArrowRight", 2, 3), passo("ArrowLeft", 0, 3)]);
  c("un valore solo: nessun tasto lo muove", [0, 0, 0], [passo("ArrowRight", 0, 1), passo("Home", 0, 1), passo("End", 0, 1)]);
  c("gli altri tasti (Tab, Invio, Spazio, lettere, Esc) non sono suoi: null, il browser li gestisce", [null, null, null, null, null], ["Tab", "Enter", " ", "a", "Escape"].map((t) => passo(t, 0, 3)));
  c("nessun valore: null", null, passo("ArrowRight", 0, 0));
  const fuochi = [];
  const radioFinto = (nome) => ({ focus: () => fuochi.push(nome) });
  const gruppoFinto = (opzione, r) => ({ dataset: { opzione }, querySelector: (s) => (/tabindex="0"/.test(s) ? r : null) });
  const radiceFinta = { querySelectorAll: () => [gruppoFinto("Colore", radioFinto("colore")), gruppoFinto("Misura", radioFinto("misura"))] };
  c("`fuocoSullaScelta`: porta il fuoco sul radio-tappa del gruppo dell'opzione mancante", [true, ["misura"]], [K.fuocoSullaScelta(radiceFinta, "Misura"), fuochi]);
  c("…un'opzione che non c'è, o nessuna radice: false e nessun fuoco", [false, false, 1], [K.fuocoSullaScelta(radiceFinta, "Lunghezza"), K.fuocoSullaScelta(null, "Colore"), fuochi.length]);

  // ── regole sul sorgente ──
  const src = readFileSync(join(radice, FILE), "utf8");
  c("`passoDaTasto` è una sola regola: riusa `comandoDaTasto` e `stepGalleria` di T105 (nessuna regola riscritta)", [true, true], [/comandoDaTasto/.test(src), /stepGalleria/.test(src)]);
  c("nessuna parola italiana scritta nel componente: i testi vengono da `testi-shop.ts` (niente «Esaurito», «Scegli», «Colore»)", [false, false, false], [/["'`]\s*Esaurito/.test(src), /["'`]\s*Scegli/.test(src), /["'`]\s*Colore\b/.test(src)]);
  c("nessun «da confermare» né `{{` nel sorgente, nemmeno nei commenti", [false, false], [/da confermare/i.test(src), /\{\{/.test(src)]);
  c("nessun `fbq`, `ttq`, `gtag` (solo `emettiSoloContatore`)", [false, true], [/\b(fbq|ttq|gtag)\b/.test(src), /emettiSoloContatore/.test(src)]);
  c("nessun `dangerouslySetInnerHTML`, `backdrop-` né ombra (`shadow-`)", [false, false, false], [/dangerouslySetInnerHTML/.test(src), /backdrop-/.test(src), /shadow-/.test(src)]);
  c("nessuna rotta lo monta (lo monta T97b) e `routeTree.gen.ts` non lo nomina", 0, [...walk(join(radice, "src/routes")), join(radice, "src/routeTree.gen.ts")].filter((f) => /SelettoreVariante/.test(readFileSync(f, "utf8"))).length);
  const tutto = (await disegna(gamma, {}, { mancante: V.messaggioMancante(gamma.opzioni, {}) })).html;
  c("tutti i bersagli sono da 44 px (`size-11` per i campioni, `min-h-11` per le pillole) e hanno l'anello di fuoco", [true, true], [radio(tutto).every((r) => /size-11|min-h-11/.test(r.attr.class)), radio(tutto).every((r) => /shop-anello(?!-)/.test(r.attr.class))]);
  c("nessun colore a elenco scritto per nome (il campione non inventa tinte)", false, /bg-(red|blue|green|yellow|orange|amber|stone|zinc|gray|slate)-/.test(src));
  c("nessuna parola vietata né segnaposto nel testo disegnato", [[], false], [trovaParoleVietate(leggibile(tutto)), /\{\{|da confermare/i.test(tutto)]);
  c("nessuna stella, nessun «ultimi pezzi» (niente scarsità)", false, /ultim[io] pezz|solo \d+|stell/i.test(leggibile(tutto)));
}

const walk = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])) : []);

/** Impacchetta un modulo vero (cartella temporanea, cancellata subito) per chiamarne le funzioni pure. */
async function carica(radice, file) {
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-variante-"));
  try {
    const r = await esbuild.build({
      entryPoints: [join(radice, file)], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ DEV: false, PROD: true, SSR: true }) },
    });
    const fuori = join(dir, "modulo.cjs");
    writeFileSync(fuori, r.outputFiles[0].text);
    return requireQui(fuori);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
