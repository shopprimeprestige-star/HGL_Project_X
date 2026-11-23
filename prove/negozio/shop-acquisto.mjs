/** ── VETRINA V1 · T87b · IL BLOCCO D'ACQUISTO DELLA SCHEDA ───────────────────────────────────────────────────────
 *  `src/components/shop/scheda/BloccoAcquisto.tsx`: il gesto (`useAcquisto`) e il disegno (`BloccoAcquisto`).
 *  Cosa deve valere (SPEC §4.5.4 n. 2-5; V1-S1, V1-S3, V1-S4, V1-T3, V1-T9):
 *   · testata: eyebrow (categoria), H1, riga di presentazione, prezzo con «IVA inclusa», riga «Spedizione» SOLO con una tariffa vera;
 *     «Pronta consegna» solo se vera; poi la scelta, il bottone «Aggiungi al carrello» da 56 px, la riga di fiducia SOTTO il bottone;
 *   · il prezzo viene dai dati del server (la variante scelta, o «Da …» se le varianti costano cifre diverse), mai da altro;
 *   · «Aggiungi» senza scelta: il fuoco va alla scelta mancante, con il suo messaggio; il bottone NON si spegne (si spegne solo per «Esaurito»);
 *   · mai una riga nel carrello senza SKU (scelta mancante, combinazione che non esiste, variante esaurita, anteprima, Invisible Derm);
 *   · dopo l'aggiunta: «Aggiunto» per 2 secondi, poi di nuovo «Aggiungi al carrello» (il timer CAMBIA lo stato: lo si vede ridisegnare),
 *     e la striscia «{nome} è nel carrello · Vai al carrello»; nessun avviso a comparsa, nessun «Acquista ora»;
 *   · variante esaurita scelta: bottone «Esaurito» spento e una frase accanto che dice perché.
 *  ⚠️ Senza browser `react-dom/server` non fa girare né gli stati né i timer. Il GESTO (`useAcquisto`) si prova con un BANCO: un `react` finto
 *  (useState, useRef, useEffect che tengono i valori fra un disegno e l'altro) e un orologio finto (`setTimeout`, `Date.now`): girano il clic,
 *  il timer e lo smontaggio veri. Il DISEGNO si prova con `rendiComponente` (react-dom/server), dando al componente ciò che il gesto ha prodotto.
 *  Il fuoco VERO, l'annuncio di `aria-live` e il disegno a 390/1280 px restano [M]/[T] (D103): li guardano T103c e T106. Dati inventati, nessuna rete. */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const FILE = "src/components/shop/scheda/BloccoAcquisto.tsx";
const copia = (x) => structuredClone(x);
const per = (slug) => D.CATALOGO.find((p) => p.slug === slug);
const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const formatta = (cent) => EURO.format(cent / 100).replace(/\u00a0/g, " ");

/* ── piccoli lettori di marcatura ─────────────────────────────────────────────────────────────────────────────── */
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|\u00a0/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const conta = (testo, ago) => (typeof ago === "string" ? testo.split(ago).length - 1 : (testo.match(ago) ?? []).length);
const attr = (t, nome) => (t.match(new RegExp(`\\s${nome}="([^"]*)"`)) ?? [])[1];
const classi = (t) => (attr(t, "class") ?? "").split(/\s+/).filter(Boolean);
/** Tutti i tag di apertura `<tipo …>`. */
const tutti = (html, tipo) => [...html.matchAll(new RegExp(`<${tipo}(?=[\\s>])[^>]*>`, "g"))].map((m) => m[0]);
/** L'apertura del tag che contiene `segno`, o `""`. */
function tagCon(html, segno) {
  const i = html.indexOf(segno);
  return i < 0 ? "" : html.slice(html.lastIndexOf("<", i), html.indexOf(">", i) + 1);
}
/** Il contenuto del `<div>` che si apre in `da`, fino al suo `</div>` (si contano le aperture annidate). */
function dentroDiv(html, da) {
  let prof = 0;
  for (const m of html.slice(da).matchAll(/<div(?=[\s>])|<\/div>/g)) {
    prof += m[0] === "</div>" ? -1 : 1;
    if (prof === 0) return html.slice(da, da + m.index + m[0].length);
  }
  return html.slice(da);
}
const buttonDi = (html, testo) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, a, d]) => ({ a, d })).find((b) => leggibile(b.d).includes(testo));

/* ── il banco: i componenti con gli hook che ricordano, e un orologio finto ──────────────────────────────────── */

/** Impacchetta il file vero più i moduli puri di cui la prova ha bisogno. `react` DENTRO `src/` è un finto (useState, useRef, useEffect passano
 *  dal banco); il carrello e il tracciamento sono finti che registrano; lucide, il `jsx` di React e il resto sono veri. */
async function caricaBanco(radice) {
  const richiedi = createRequire(join(radice, "package.json"));
  const esbuild = richiedi("esbuild");
  const reale = richiedi.resolve("react");
  const dir = mkdtempSync(join(tmpdir(), "prova-t87b-"));
  try {
    const entrata = join(dir, "entrata.tsx");
    writeFileSync(
      entrata,
      `export * from ${JSON.stringify(join(radice, FILE))};
       export * from "@/shop/cms/vetrina-varianti";
       export * from "@/shop/cms/vetrina-eventi";
       export * from "@/shop/cms/vetrina-scheda";
       export * from "@/shop/cms/vetrina-fiducia";
       export * from "@/shop/cms/vetrina-interazioni";
       export * from "@/landing/testi-shop";
       export { ATTRIBUTO_BLOCCO } from "@/components/shop/guscio/BarreFisse";`,
    );
    const FINTI = {
      "@/shop/CartContext": `export const useCart = () => globalThis.__banco.carrello;`,
      "@/lib/tracciamento/api": `export const emettiEvento = (n, d) => (globalThis.__banco.eventi.push([n, d]), "id"); export const emettiSoloContatore = (n, d) => { globalThis.__banco.contatori.push([n, d]); };`,
      "@tanstack/react-router": `import React from "react"; export const Link = ({ to, children, ...r }) => React.createElement("a", { ...r, href: to }, children);`,
      react: `
        export * from ${JSON.stringify(reale)};
        export const useState = (i) => globalThis.__banco.useState(i);
        export const useRef = (i) => globalThis.__banco.useRef(i);
        export const useEffect = (f, d) => globalThis.__banco.useEffect(f, d);`,
    };
    const r = await esbuild.build({
      entryPoints: [entrata], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", loader: { ".tsx": "tsx" },
      alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ DEV: false, PROD: true, SSR: true }) },
      plugins: [{
        name: "finti",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => {
            if (a.path === "react") return a.importer.startsWith(join(radice, "src")) ? { path: a.path, namespace: "finto" } : null;
            return FINTI[a.path] !== undefined ? { path: a.path, namespace: "finto" } : null;
          });
          b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI[a.path], loader: "js", resolveDir: radice }));
        },
      }],
    });
    const file = join(dir, "banco.cjs");
    writeFileSync(file, r.outputFiles[0].text);
    return richiedi(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Un orologio finto: `setTimeout`, `clearTimeout` e `Date.now` sono i suoi finché non si chiama `ripristina`. */
function orologio() {
  const salvati = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, now: Date.now };
  let ora = 1_000_000;
  let n = 0;
  const coda = [];
  globalThis.setTimeout = (f, ms) => { coda.push({ id: ++n, a: ora + (ms ?? 0), f }); return n; };
  globalThis.clearTimeout = (id) => { const i = coda.findIndex((t) => t.id === id); if (i >= 0) coda.splice(i, 1); };
  Date.now = () => ora;
  return {
    /** Fa passare `ms`, facendo scattare ogni timer nel suo istante. */
    avanza(ms) {
      const fine = ora + ms;
      for (;;) {
        const t = coda.filter((x) => x.a <= fine).sort((x, y) => x.a - y.a)[0];
        if (!t) break;
        coda.splice(coda.indexOf(t), 1);
        ora = Math.max(ora, t.a);
        t.f();
      }
      ora = fine;
    },
    /** Fa scattare ora i timer pendenti SENZA far passare il tempo (un timer che arriva in anticipo di un soffio). */
    scattaOra() { for (const t of coda.splice(0)) t.f(); },
    pendenti: () => coda.length,
    adesso: () => ora,
    ripristina() { Object.assign(globalThis, { setTimeout: salvati.setTimeout, clearTimeout: salvati.clearTimeout }); Date.now = salvati.now; },
  };
}

/** Monta `useAcquisto(prodotto, scelta)` nel banco. `agisci(fn)` esegue un gesto e ridisegna finché lo stato non si assesta. */
function montaGesto(M, prodotto, scelta = {}) {
  const b = {
    slot: [], k: 0, sporco: false, render: 0, eventi: [], contatori: [], aggiunte: [], effetti: [], puliture: [], args: [prodotto, scelta], ris: null,
    carrello: { add: (...a) => b.aggiunte.push(a) },
    useState(iniziale) {
      const i = b.k++;
      if (!b.slot[i]) {
        const s = { v: typeof iniziale === "function" ? iniziale() : iniziale };
        s.set = (x) => { const nv = typeof x === "function" ? x(s.v) : x; if (!Object.is(nv, s.v)) { s.v = nv; b.sporco = true; } };
        b.slot[i] = s;
      }
      return [b.slot[i].v, b.slot[i].set];
    },
    useRef(iniziale) {
      const i = b.k++;
      if (!b.slot[i]) b.slot[i] = { current: iniziale };
      return b.slot[i];
    },
    useEffect(f) {
      const i = b.k++;
      if (!b.slot[i]) { b.slot[i] = { effetto: true }; b.effetti.push(f); }
    },
    ridisegna() {
      globalThis.__banco = b;
      b.k = 0; b.sporco = false; b.render++;
      b.ris = M.useAcquisto(...b.args);
      return b.ris;
    },
    agisci(fn) {
      globalThis.__banco = b;
      fn();
      for (let n = 0; b.sporco; n++) { if (n > 20) throw new Error("banco: il gesto non si assesta"); b.ridisegna(); }
      return b.ris;
    },
    /** Cambia gli argomenti (la scelta, o il prodotto) e ridisegna. */
    con(prodotto2, scelta2) { return b.agisci(() => { b.args = [prodotto2 ?? b.args[0], scelta2 ?? b.args[1]]; b.sporco = true; }); },
    /** Ridisegna senza cambiare niente (rilegge l'ora): serve a vedere cosa direbbe il componente adesso. */
    rileggi() { return b.agisci(() => { b.sporco = true; }); },
    smonta() { for (const p of b.puliture.splice(0)) p?.(); },
  };
  b.ridisegna();
  for (const f of b.effetti.splice(0)) b.puliture.push(f());
  return b;
}

/** Una radice finta per `fuocoSullaScelta`: i gruppi (`data-opzione`) che ci sono, e il registro dei fuochi. */
function radiceFinta(opzioni) {
  const fuochi = [];
  const gruppo = (o) => ({ dataset: { opzione: o }, querySelector: () => ({ focus: () => fuochi.push(o) }) });
  return { radice: { querySelectorAll: () => opzioni.map(gruppo) }, fuochi };
}

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T87b · BLOCCO D'ACQUISTO DELLA SCHEDA (23/11/2026)");

  const file = join(radice, FILE);
  const esiste = existsSync(file);
  c("il file esiste (components/shop/scheda/BloccoAcquisto.tsx)", true, esiste);
  if (!esiste) return;
  const src = readFileSync(file, "utf8");
  const M = await caricaBanco(radice);
  const T = M.TESTI_SHOP;
  const P = M.TESTI_PROVVISORI;

  const alfa = per("patch-prova-alfa"); // Colore ×3 (con la foto dei campioni); prezzi 289,00 · 290,00 · 291,00
  const gamma = per("patch-prova-gamma"); // Colore, Lunghezza, Misura; esaurite: Nero/Corta/Piccola e Castano/Corta/Grande
  const delta = per("patch-prova-delta"); // solo Misura
  const epsilon = per("patch-prova-epsilon"); // un solo colore, tutto esaurito
  const kit = per("kit-prova"); // nessuna opzione, una sola variante
  const shampoo = per("shampoo-prova");
  const derm = D.INVISIBLE_DERM;
  const skuDi = (p, scelta) => M.skuScelto(p, scelta);
  const varDi = (p, scelta) => M.varianteScelta(p, scelta);

  // ════ 0 · I TESTI NUOVI ═════════════════════════════════════════════════════════════════════════════════════
  c("i due testi nuovi stanno in `TESTI_PROVVISORI.scheda` (frase della variante esaurita, della scelta che non esiste), non vuoti", [true, true], [
    typeof P.scheda.sceltaEsaurita === "string" && P.scheda.sceltaEsaurita.trim() !== "",
    typeof P.scheda.sceltaNonDisponibile === "string" && P.scheda.sceltaNonDisponibile.trim() !== "",
  ]);
  c("…senza parole vietate né segnaposto", [[], []], [D.trovaParoleVietate(P.scheda.sceltaEsaurita), D.trovaParoleVietate(P.scheda.sceltaNonDisponibile)]);

  const inAnteprima = { ...copia(alfa), anteprima: { nascosti: [] } };

  // ════ 1 · IL GESTO: «AGGIUNGI AL CARRELLO» ═══════════════════════════════════════════════════════════════════
  let ora = orologio();
  try {
    // ── senza scelta: il fuoco va alla scelta mancante, il bottone resta acceso ──
    let g = montaGesto(M, alfa, {});
    let { radice: r1, fuochi } = radiceFinta(["Colore"]);
    g.ris.selettoreRef.current = r1;
    c("nulla scelto (alfa): il bottone è «aggiungi» e non è spento (mai per una scelta mancante)", [false, false, null], [g.ris.esaurito, g.ris.aggiunto, g.ris.mancante]);
    g.agisci(() => g.ris.aggiungi());
    c("«Aggiungi» senza scegliere: NIENTE nel carrello e nessun evento (mai una riga senza SKU)", [0, 0], [g.aggiunte.length, g.eventi.length]);
    c("…il fuoco va alla scelta mancante (il gruppo del Colore), una volta", [["Colore"]], [fuochi]);
    c("…e il messaggio accanto è quello di `messaggioMancante` (opzione + chiave), il bottone non si spegne", [{ opzione: "Colore", chiave: "scheda.scegli.colore" }, false, null], [g.ris.mancante, g.ris.esaurito, g.ris.frase]);
    c("…non parte nessuna conferma «Aggiunto» e nessun timer", [false, false, 0], [g.ris.aggiunto, g.ris.nelCarrello, ora.pendenti()]);
    g.con(alfa, { Colore: "Castano" });
    c("scelto il colore: il messaggio sparisce da solo (la scelta mancante non manca più)", null, g.ris.mancante);

    // ── due opzioni: il messaggio resta finché manca QUELLA scelta, e non salta alla prossima senza un nuovo clic ──
    g = montaGesto(M, gamma, { Colore: "Nero" });
    g.ris.selettoreRef.current = radiceFinta(["Colore", "Lunghezza", "Misura"]).radice;
    g.agisci(() => g.ris.aggiungi());
    c("gamma con il solo colore: manca la Lunghezza (la prima non scelta, nell'ordine dei dati)", [{ opzione: "Lunghezza", chiave: "scheda.scegli.lunghezza" }, 0], [g.ris.mancante, g.aggiunte.length]);
    g.con(gamma, { Colore: "Nero", Misura: "Grande" });
    c("scelta un'altra opzione (la Misura) ma non la Lunghezza: il messaggio resta sulla Lunghezza", "Lunghezza", g.ris.mancante?.opzione);
    g.con(gamma, { Colore: "Nero", Misura: "Grande", Lunghezza: "Media" });
    c("completata la Lunghezza: via il messaggio, e non ne compare uno nuovo (non c'è altro da scegliere)", null, g.ris.mancante);
    g = montaGesto(M, gamma, { Colore: "Nero", Lunghezza: "Media" });
    g.ris.selettoreRef.current = radiceFinta(["Colore", "Lunghezza", "Misura"]).radice;
    g.agisci(() => g.ris.aggiungi());
    g.con(gamma, { Colore: "Nero", Lunghezza: "Media", Misura: "Grande" });
    c("manca la Misura → scelta la Misura: il messaggio non resta né passa a un'altra opzione", [null, null], [g.ris.mancante, g.ris.frase]);
    g = montaGesto(M, alfa, { Colore: "Fucsia" });
    g.ris.selettoreRef.current = radiceFinta(["Colore"]).radice;
    g.agisci(() => g.ris.aggiungi());
    c("un valore che non esiste più ({Colore: «Fucsia»}) vale come non scelto: fuoco e messaggio, niente nel carrello", ["Colore", 0], [g.ris.mancante?.opzione, g.aggiunte.length]);

    // ── il ripiego: `fuocoSullaScelta` dà false (nessun gruppo disegnato per quell'opzione) ──
    g = montaGesto(M, alfa, {});
    g.ris.selettoreRef.current = radiceFinta([]).radice;
    g.agisci(() => g.ris.aggiungi());
    c("ripiego: il fuoco non trova il gruppo → il messaggio va accanto al bottone («scelta non disponibile»), niente nel carrello", ["nonDisponibile", null, 0, 0], [g.ris.frase, g.ris.mancante, g.aggiunte.length, g.eventi.length]);
    g.con(alfa, { Colore: "Nero" });
    c("…e passa quando la scelta c'è", null, g.ris.frase);
    g = montaGesto(M, alfa, {});
    g.agisci(() => g.ris.aggiungi());
    c("ripiego: nessuna radice (il selettore non è ancora montato) → la stessa cosa, senza errori", ["nonDisponibile", 0], [g.ris.frase, g.aggiunte.length]);

    // ── scelta completa: nel carrello con lo SKU, il prezzo del server, l'evento, «Aggiunto» ──
    g = montaGesto(M, alfa, { Colore: "Castano" });
    const sku = skuDi(alfa, { Colore: "Castano" });
    const v = varDi(alfa, { Colore: "Castano" });
    const t0 = ora.adesso();
    g.agisci(() => g.ris.aggiungi());
    c("scelta completa: UNA riga nel carrello, con lo SKU della variante e quantità 1", [1, { id: sku }, 1], [g.aggiunte.length, g.aggiunte[0]?.[0], g.aggiunte[0]?.[1]]);
    c("…`variant` non passato e la riga è quella del catalogo CMS (`sku` e `snap`)", [undefined, sku], [g.aggiunte[0]?.[2], g.aggiunte[0]?.[3]?.sku]);
    c("…lo `snap` ha nome, indirizzo, prezzo e foto dal prodotto del server, e il nome della variante", { nome: alfa.nome, slug: alfa.slug, prezzoCent: v.prezzoCent, foto: alfa.media.find((m) => m.slot === "principale").src, varianteNome: v.nome }, g.aggiunte[0]?.[3]?.snap);
    c("…il prezzo dello snap è quello della VARIANTE scelta (non il «da» del prodotto)", [true, alfa.prezzoDaCent !== v.prezzoCent], [g.aggiunte[0][3].snap.prezzoCent === v.prezzoCent, true]);
    c("AddToCart: un solo evento, quello di `eventoAggiungi` (SKU della variante, centesimi interi, un pezzo)", [[["AddToCart", { contentIds: [sku], contentName: alfa.nome, contentType: "product", valueCent: v.prezzoCent, numItems: 1 }]], true], [g.eventi, JSON.stringify(g.eventi[0]) === JSON.stringify([M.eventoAggiungi(alfa, sku).nome, M.eventoAggiungi(alfa, sku).dati])]);
    c("il gesto non emette nessun conteggio (la scelta della variante la conta il selettore)", 0, g.contatori.length);
    c("subito dopo: «Aggiunto» e la striscia, e nessun messaggio", [true, true, null, null], [g.ris.aggiunto, g.ris.nelCarrello, g.ris.mancante, g.ris.frase]);
    c("un timer di 2 secondi è in attesa (la durata è `DURATA_AGGIUNTO_MS` di T105)", [1, 2000], [ora.pendenti(), M.DURATA_AGGIUNTO_MS]);

    // ── il timer CAMBIA lo stato ──
    ora.avanza(1999);
    const disegni = g.render;
    c("dopo 1999 ms nessun timer è scattato (nessun cambio di stato, nessun disegno) e rileggendo l'ora è ancora «Aggiunto» (T105: fino a 1999)", [disegni, true], [g.render, g.rileggi().aggiunto]);
    const prima = g.render;
    g.agisci(() => ora.avanza(1));
    c("a 2000 ms il timer scatta: torna «Aggiungi» e il componente è stato RIDISEGNATO dal cambio di stato", [false, prima + 1], [g.ris.aggiunto, g.render]);
    c("…la striscia resta (finché non si cambia pagina) e il timer non c'è più", [true, 0], [g.ris.nelCarrello, ora.pendenti()]);
    c("…e lo stato di `statoAggiunta` a quell'istante è «aggiungi» (tempo passato: 2000 ms)", ["aggiungi", 2000], [M.statoAggiunta(t0, ora.adesso()), ora.adesso() - t0]);

    // un timer che arriva in anticipo di un soffio (T105, osservazione 3): non deve lasciare «Aggiunto» in eterno
    g = montaGesto(M, alfa, { Colore: "Castano" });
    g.agisci(() => g.ris.aggiungi());
    ora.avanza(1999);
    g.agisci(() => ora.scattaOra());
    c("il timer scatta 1 ms in anticipo (l'orologio dice 1999): torna comunque «Aggiungi» (il timer cambia uno stato, non rilegge il tempo)", [false, 0], [g.ris.aggiunto, ora.pendenti()]);

    // un secondo clic ricomincia i 2 secondi (e non lascia due timer)
    g = montaGesto(M, alfa, { Colore: "Castano" });
    g.agisci(() => g.ris.aggiungi());
    ora.avanza(1000);
    g.agisci(() => g.ris.aggiungi());
    c("secondo clic dopo 1 s: due righe aggiunte (la quantità la somma il carrello) e un solo timer", [2, 1], [g.aggiunte.length, ora.pendenti()]);
    g.agisci(() => ora.avanza(1999));
    c("…i 2 secondi ripartono da lui: a +1999 dal secondo clic è ancora «Aggiunto»", true, g.ris.aggiunto);
    g.agisci(() => ora.avanza(1));
    c("…e a +2000 torna «Aggiungi»", false, g.ris.aggiunto);

    // smontare la pagina ferma il timer
    g = montaGesto(M, alfa, { Colore: "Castano" });
    g.agisci(() => g.ris.aggiungi());
    const dopoClic = g.render;
    g.smonta();
    c("smontando il componente il timer si cancella", 0, ora.pendenti());
    ora.avanza(5000);
    c("…e dopo nessun cambio di stato (nessun disegno in più)", dopoClic, g.render);

    // la striscia è di QUEL prodotto: cambiando prodotto non resta lì
    g = montaGesto(M, alfa, { Colore: "Castano" });
    g.agisci(() => g.ris.aggiungi());
    g.con(delta, {});
    c("cambiando prodotto la striscia «è nel carrello» non resta (è di quello aggiunto)", [false, false], [g.ris.nelCarrello, g.ris.aggiunto]);

    // ── una sola variante, senza opzioni (kit, cura semplice): un clic basta ──
    g = montaGesto(M, kit, {});
    g.ris.selettoreRef.current = radiceFinta([]).radice;
    g.agisci(() => g.ris.aggiungi());
    c("kit senza opzioni: nessuna scelta mancante, e la sua unica variante va nel carrello", [null, 1, kit.varianti[0].sku], [g.ris.mancante, g.aggiunte.length, g.aggiunte[0]?.[3]?.sku]);
    c("…con `varianteNome` nullo (la variante si chiama come il prodotto)", null, g.aggiunte[0]?.[3]?.snap.varianteNome);

    // ── variante esaurita: il bottone si spegne, la frase dice perché, e il gesto non aggiunge ──
    const esaurita = { Colore: "Nero", Lunghezza: "Corta", Misura: "Piccola" };
    g = montaGesto(M, gamma, esaurita);
    c("variante scelta ed esaurita: `esaurito` vero, la frase «esaurita» accanto al bottone", [true, "esaurita"], [g.ris.esaurito, g.ris.frase]);
    c("…`esaurito` è `statoBottone` di T78 (stessa regola)", "esaurito", M.statoBottone(varDi(gamma, esaurita), gamma.varianti));
    g.agisci(() => g.ris.aggiungi());
    c("…anche chiamando il gesto (la barra d'acquisto) non si aggiunge niente e nessun evento", [0, 0, false], [g.aggiunte.length, g.eventi.length, g.ris.aggiunto]);
    g.con(gamma, { Colore: "Castano", Lunghezza: "Media", Misura: "Piccola" });
    c("scelta una variante disponibile: il bottone torna acceso e la frase sparisce", [false, null], [g.ris.esaurito, g.ris.frase]);
    g = montaGesto(M, epsilon, {});
    c("prodotto TUTTO esaurito, nulla scelto: `esaurito` vero (SPEC §3.13), niente frase di «scelta»", [true, null], [g.ris.esaurito, g.ris.frase]);
    g.ris.selettoreRef.current = radiceFinta(["Colore"]).radice;
    g.agisci(() => g.ris.aggiungi());
    c("…e il gesto non fa niente: né carrello, né evento, né fuoco alla scelta", [0, 0, null], [g.aggiunte.length, g.eventi.length, g.ris.mancante]);

    // ── una combinazione che non esiste: nessuno SKU, nessuna aggiunta ──
    const senzaUna = copia(gamma);
    const persa = skuDi(gamma, { Colore: "Castano", Lunghezza: "Media", Misura: "Piccola" });
    senzaUna.varianti = senzaUna.varianti.filter((x) => x.sku !== persa);
    const comboPersa = { Colore: "Castano", Lunghezza: "Media", Misura: "Piccola" };
    g = montaGesto(M, senzaUna, comboPersa);
    c("combinazione senza variante: nessuno SKU (`skuScelto` nullo)", [persa !== null, null], [true, skuDi(senzaUna, comboPersa)]);
    c("…il bottone è «aggiungi» (non si spegne: `statoBottone` con nessuna variante scelta), senza frase finché non si preme", [false, null], [g.ris.esaurito, g.ris.frase]);
    g.agisci(() => g.ris.aggiungi());
    c("…premendo: niente nel carrello, nessun evento, e la frase accanto al bottone dice che non c'è", [0, 0, "nonDisponibile"], [g.aggiunte.length, g.eventi.length, g.ris.frase]);
    g.con(senzaUna, { Colore: "Nero", Lunghezza: "Media", Misura: "Grande" });
    c("…cambiando la scelta in una che esiste, la frase passa", null, g.ris.frase);
    g = montaGesto(M, alfa, { Colore: "Castano", Taglia: "XL" });
    g.agisci(() => g.ris.aggiungi());
    c("una scelta con un'opzione che il prodotto non ha ({Taglia}): nessuno SKU, quindi niente nel carrello", [0, "nonDisponibile"], [g.aggiunte.length, g.ris.frase]);

    // ── dove non si vende ──
    g = montaGesto(M, derm, {});
    g.agisci(() => g.ris.aggiungi());
    c("Invisible Derm (non acquistabile): il gesto non aggiunge e non emette niente", [0, 0], [g.aggiunte.length, g.eventi.length]);
    g = montaGesto(M, inAnteprima, { Colore: "Castano" });
    g.agisci(() => g.ris.aggiungi());
    c("anteprima (bozza vista con la chiave): non si vende, niente nel carrello e nessun evento", [0, 0, false], [g.aggiunte.length, g.eventi.length, g.ris.aggiunto]);
    const senzaPrezzo = copia(alfa);
    senzaPrezzo.varianti = senzaPrezzo.varianti.map((x) => ({ ...x, prezzoCent: null }));
    g = montaGesto(M, senzaPrezzo, { Colore: "Castano" });
    g.agisci(() => g.ris.aggiungi());
    c("una variante senza prezzo (D39): non si mette nel carrello", [0, 0], [g.aggiunte.length, g.eventi.length]);
    const prezzoRotto = copia(alfa);
    prezzoRotto.varianti = prezzoRotto.varianti.map((x) => ({ ...x, prezzoCent: 12.5 }));
    g = montaGesto(M, prezzoRotto, { Colore: "Castano" });
    g.agisci(() => g.ris.aggiungi());
    c("un prezzo che non è un intero di centesimi: non si mette nel carrello", 0, g.aggiunte.length);
  } finally {
    ora.ripristina();
  }

  // ════ 2 · IL DISEGNO ═══════════════════════════════════════════════════════════════════════════════════════
  /** Il gesto in una situazione (scelta, e se premuto) → ciò che il componente riceve; poi il disegno vero. */
  const situazione = (p, scelta = {}, { premuto = false, radiceCon = null } = {}) => {
    const o = orologio();
    try {
      const g = montaGesto(M, p, scelta);
      g.ris.selettoreRef.current = (radiceCon ?? radiceFinta(p.opzioni.map((x) => x.nome)).radice);
      if (premuto) g.agisci(() => g.ris.aggiungi());
      return { acquisto: { ...g.ris }, aggiunte: g.aggiunte.length };
    } finally {
      o.ripristina();
    }
  };
  const bloccoDi = (p, tariffa = D.TARIFFA_OK) => M.bloccheScheda(p, { tariffa }).find((x) => x.id === "acquisto");
  const vociDi = (p, extra = {}) => M.vociFiducia({ tariffa: D.TARIFFA_OK, testi: D.TESTI_CONFERMATI_PIENI, prodotto: p, cassa: { sicuro: true, metodi: ["Carta", "PayPal"] }, ...extra });
  const disegna = async (p, scelta = {}, extra = {}, sit = {}) => {
    const { acquisto } = situazione(p, scelta, sit);
    const props = {
      prodotto: p, blocco: bloccoDi(p, extra.tariffa), scelta, onScegli() {}, acquisto,
      voci: vociDi(p, extra.tariffa ? { tariffa: extra.tariffa } : {}), testi: D.TESTI_CONFERMATI_PIENI, formatta, ...extra.props,
    };
    return rendiComponente(radice, FILE, "BloccoAcquisto", props, {});
  };

  // ── la testata: l'ordine e il contenuto ──
  const base = (await disegna(alfa)).html;
  const testo = leggibile(base);
  c("il disegno non è vuoto e non porta «undefined», «null», «NaN» né «[object»", [true, false], [base.length > 200, /undefined|\bnull\b|NaN|\[object/.test(base)]);
  c("un solo H1, con il nome del prodotto", [1, alfa.nome], [conta(base, "<h1"), leggibile((base.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1] ?? "")]);
  c("l'eyebrow è il nome della categoria (dal server), PRIMA dell'H1", [true, true], [testo.includes(alfa.categorie[0].nome), base.indexOf(alfa.categorie[0].nome) < base.indexOf("<h1")]);
  c("la riga di presentazione (dal server) sta dopo l'H1", [true, true], [testo.includes(alfa.rigaPresentazione), base.indexOf(alfa.rigaPresentazione) > base.indexOf("</h1>")]);
  c("il prezzo è scritto con «IVA inclusa» (da testi-shop), e il prezzo non è mai «da calcolare»", [true, false], [testo.includes(`${formatta(alfa.prezzoDaCent)} ${T.carrello.ivaInclusa}`.replace(/\s+/g, " ")) || /Da [\d.,]+\s*€ IVA inclusa/.test(testo), /da calcolare/i.test(testo)]);
  const prezzoNodo = (base.match(/<span[^>]*tabular-nums[^>]*>([^<]*)<\/span>/) ?? [])[1] ?? "";
  const h1Classi = classi(tagCon(base, "<h1"));
  c("il prezzo non è mai il carattere più grande (V1-T9): l'H1 ha un corpo almeno pari al prezzo (text-2xl) e a 1024 px più grande", [true, true], [h1Classi.includes("text-2xl") && h1Classi.includes("lg:text-4xl"), classi(tagCon(base, "tabular-nums")).includes("text-2xl")]);
  const voceSped = vociDi(alfa).find((x) => x.id === "spedizione").testo.replace(/\u00a0/g, " ");
  c("la riga «Spedizione» c'è, con il testo della voce di fiducia (stessa frase: «Spedizione: {costo}, {tempi}.»)", [true, true], [testo.includes(voceSped), voceSped.startsWith("Spedizione: ")]);
  c("…compare UNA sola volta nella scheda (la riga di fiducia non la ripete)", 1, conta(testo, "Spedizione:"));
  const senzaTariffa = (await disegna(alfa, {}, { tariffa: D.TARIFFA_ASSENTE })).html;
  c("senza tariffa: nessuna riga «Spedizione» (SPEC: solo con tariffa), e niente «da calcolare»", [0, false], [conta(leggibile(senzaTariffa), "Spedizione"), /da calcolare/i.test(senzaTariffa)]);
  c("…il resto resta: titolo, prezzo e bottone", [1, true, true], [conta(senzaTariffa, "<h1"), /IVA inclusa/.test(senzaTariffa), !!buttonDi(senzaTariffa, T.scheda.aggiungi)]);

  // ── il prezzo: dal server, «Da» o quello della variante ──
  c("nulla scelto e prezzi diversi: «Da 289,00 €» (la parola «Da» è `TESTI_PROVVISORI.card.da`)", true, testo.includes(P.card.da.replace("{prezzo}", formatta(alfa.prezzoDaCent)).replace(/\s+/g, " ")));
  const castano = (await disegna(alfa, { Colore: "Castano" })).html;
  const vCastano = varDi(alfa, { Colore: "Castano" });
  c("scelta una variante: il prezzo di QUELLA variante, senza «Da»", [true, false], [leggibile(castano).includes(`${formatta(vCastano.prezzoCent)} ${T.carrello.ivaInclusa}`), /\bDa\s[\d.,]+\s*€/.test(leggibile(castano))]);
  const alfaCambiato = copia(alfa);
  alfaCambiato.varianti = alfaCambiato.varianti.map((x) => ({ ...x, prezzoCent: x.prezzoCent + 5000 }));
  alfaCambiato.prezzoDaCent = alfa.prezzoDaCent + 5000;
  c("il prezzo segue SOLO i dati del prodotto: se il server dà un altro prezzo, si vede quello (nessuna altra fonte)", true, leggibile((await disegna(alfaCambiato, { Colore: "Castano" })).html).includes(formatta(vCastano.prezzoCent + 5000)));
  const unico = (await disegna(kit)).html;
  c("una variante sola: il prezzo senza «Da»", [true, false], [leggibile(unico).includes(formatta(kit.prezzoDaCent)), /\bDa\s[\d.,]+\s*€/.test(leggibile(unico))]);
  const senzaCifra = copia(alfa);
  senzaCifra.prezzoDaCent = null;
  senzaCifra.varianti = senzaCifra.varianti.map((x) => ({ ...x, prezzoCent: null }));
  const htmlSenzaCifra = (await disegna(senzaCifra)).html;
  c("un prodotto che si vende ma il server non dà nessun prezzo: nessuna cifra inventata (nessun «0,00 €», nessun prezzo, nessun «IVA inclusa»)", [false, 0, false], [/0,00/.test(htmlSenzaCifra), conta(htmlSenzaCifra, "tabular-nums"), /IVA inclusa/.test(htmlSenzaCifra)]);

  // ── la pillola «Pronta consegna»: solo se vera ──
  c("«Pronta consegna» c'è col testo del titolare confermato e una variante disponibile (UNA volta, la parola è di testi-shop)", 1, conta(testo, T.card.prontaConsegna));
  const senzaConferma = (await disegna(alfa, {}, { props: { testi: D.TESTI_CONFERMATI_VUOTI } })).html;
  c("…non c'è senza la conferma del titolare", 0, conta(leggibile(senzaConferma), T.card.prontaConsegna));
  c("…non c'è se la variante scelta è esaurita", 0, conta(leggibile((await disegna(gamma, esaurita2())).html), T.card.prontaConsegna));
  c("…non c'è se il prodotto è tutto esaurito", 0, conta(leggibile((await disegna(epsilon)).html), T.card.prontaConsegna));
  c("…e sta fra la riga «Spedizione» e la scelta (SPEC: dopo la spedizione)", true, base.indexOf("Spedizione:") < base.indexOf(T.card.prontaConsegna) && base.indexOf(T.card.prontaConsegna) < base.indexOf('role="radiogroup"'));
  function esaurita2() { return { Colore: "Nero", Lunghezza: "Corta", Misura: "Piccola" }; }

  // ── la scelta, il bottone, la fiducia: l'ordine ──
  const iSel = base.indexOf('role="radiogroup"');
  const iBtn = base.indexOf(T.scheda.aggiungi);
  const iFid = base.indexOf('<ul role="list"');
  c("ordine nel documento: eyebrow, H1, riga, prezzo, scelta, bottone, riga di fiducia (SOTTO il bottone)", true, base.indexOf(alfa.categorie[0].nome) < base.indexOf("<h1") && base.indexOf("</h1>") < base.indexOf(alfa.rigaPresentazione) && base.indexOf(alfa.rigaPresentazione) < base.indexOf("IVA inclusa") && base.indexOf("IVA inclusa") < iSel && iSel < iBtn && iBtn < iFid);
  c("il selettore è quello di T87a, a campioni (colore) con la foto, dentro il blocco", [3, 1], [conta(base, 'role="radio"'), conta(base, 'role="radiogroup"')]);
  const bottone = buttonDi(base, T.scheda.aggiungi);
  c("il bottone è «Aggiungi al carrello» (da testi-shop), di tipo button, tutta la larghezza e alto 56 px (`h-14`)", [true, "button", true, true], [!!bottone, attr(`<button${bottone.a}>`, "type"), classi(`<button${bottone.a}>`).includes("w-full"), classi(`<button${bottone.a}>`).includes("h-14")]);
  c("…pieno notte, con l'anello di fuoco `shop-anello`, e NON è spento", [true, true, false], [classi(`<button${bottone.a}>`).includes("bg-[#0A1430]"), classi(`<button${bottone.a}>`).includes("shop-anello"), /\sdisabled/.test(bottone.a)]);
  const fiducia = base.slice(iFid, base.indexOf("</ul>", iFid));
  const attese = vociDi(alfa).filter((x) => ["reso", "pagamenti", "whatsapp"].includes(x.id)).map((x) => x.testo);
  c("la riga di fiducia ha le voci vere (reso, pagamenti, assistenza), e NON la spedizione (già nella testata)", [attese, false], [attese.filter((t) => leggibile(fiducia).includes(t)), /Spedizione:/.test(fiducia)]);
  c("senza voci vere la riga di fiducia non si monta (nessun elenco vuoto)", [0, true], [conta((await disegna(alfa, {}, { props: { voci: [] } })).html, '<ul role="list"'), true]);
  c("con una sola voce di fiducia (la spedizione, già in testata) l'elenco non si monta", 0, conta((await disegna(alfa, {}, { props: { voci: vociDi(alfa).filter((x) => x.id === "spedizione") } })).html, '<ul role="list"'));

  // ── il blocco che la barra d'acquisto osserva ──
  const marcato = tagCon(base, "data-barra-nascondi");
  const dentro = marcato ? dentroDiv(base, base.indexOf(marcato)) : "";
  c("`data-barra-nascondi=\"vista\"` (ATTRIBUTO_BLOCCO di T84a) c'è UNA volta", [1, "vista", JSON.stringify(M.ATTRIBUTO_BLOCCO)], [conta(base, "data-barra-nascondi"), attr(marcato, "data-barra-nascondi"), '{"data-barra-nascondi":"vista"}']);
  c("…e abbraccia nome, prezzo, scelta e bottone (non la riga di fiducia)", [true, true, true, true, false], [dentro.includes("<h1"), dentro.includes("IVA inclusa"), dentro.includes('role="radiogroup"'), dentro.includes(T.scheda.aggiungi), dentro.includes('<ul role="list"')]);
  const radiceBlocco = base.slice(0, base.indexOf(">") + 1);
  c("sul computer il blocco resta in vista: `lg:sticky lg:top-24`, e `lg:self-start` perché in una griglia non si stiri", [true, true, true], ["lg:sticky", "lg:top-24", "lg:self-start"].map((k) => classi(radiceBlocco).includes(k)));

  // ── messaggio, fuoco: il bottone non si spegne ──
  const premuto = await disegna(alfa, {}, {}, { premuto: true });
  c("premuto «Aggiungi» senza scelta: il messaggio «Scegli il colore.» (testi-shop) accanto alla scelta", true, leggibile(premuto.html).includes(P.scheda.scegli.colore));
  const bPremuto = buttonDi(premuto.html, T.scheda.aggiungi);
  c("…e il bottone è ancora «Aggiungi al carrello» e acceso (mai spento per una scelta mancante)", [true, false, false], [!!bPremuto, /\sdisabled/.test(bPremuto.a), /aria-disabled/.test(bPremuto.a)]);
  c("nel disegno senza scelta nessun bottone ha `disabled`", 0, conta(base, /\sdisabled/g));
  const ripiego = await disegna(alfa, {}, {}, { premuto: true, radiceCon: radiceFinta([]).radice });
  c("ripiego: la frase «scelta non disponibile» sta accanto al bottone, in una zona `aria-live`", [true, true], [leggibile(ripiego.html).includes(P.scheda.sceltaNonDisponibile), /aria-live="polite"[^>]*>(?:(?!<\/div>)[\s\S])*Questa scelta non è/.test(ripiego.html)]);

  // ── esaurito ──
  const esau = (await disegna(gamma, esaurita2())).html;
  const bEsau = buttonDi(esau, T.scheda.esaurito);
  c("variante esaurita scelta: il bottone dice «Esaurito» (testi-shop) ed è spento (`disabled`)", [true, true], [!!bEsau, /\sdisabled/.test(bEsau?.a ?? "")]);
  c("…non è più il pieno notte (un solo bottone pieno: quello spento è di contorno, testo `ink-muted`)", [false, true, true], [classi(`<button${bEsau.a}>`).includes("bg-[#0A1430]"), classi(`<button${bEsau.a}>`).includes("text-ink-muted"), classi(`<button${bEsau.a}>`).some((x) => x.startsWith("border"))]);
  c("…«Aggiungi al carrello» non c'è più, e la frase accanto dice perché (in `aria-live`)", [false, true, true], [leggibile(esau).includes(T.scheda.aggiungi), leggibile(esau).includes(P.scheda.sceltaEsaurita), /aria-live="polite"[^>]*>(?:(?!<\/div>)[\s\S])*Questa scelta è esaurita/.test(esau)]);
  c("…il bottone resta 56 px", true, classi(`<button${bEsau.a}>`).includes("h-14"));
  c("NON c'è «Avvisami quando torna» (il Modulo 4 non è consegnato)", false, /avvisami/i.test(esau));
  const tuttoEsaurito = (await disegna(epsilon)).html;
  c("prodotto tutto esaurito, nulla scelto: bottone «Esaurito» spento, nessuna frase «questa scelta»", [true, true, false], [!!buttonDi(tuttoEsaurito, T.scheda.esaurito), /\sdisabled/.test(buttonDi(tuttoEsaurito, T.scheda.esaurito)?.a ?? ""), leggibile(tuttoEsaurito).includes(P.scheda.sceltaEsaurita)]);

  // ── aggiunto e striscia ──
  const aggiunto = await disegna(alfa, { Colore: "Castano" }, {}, { premuto: true });
  const tAgg = leggibile(aggiunto.html);
  const bAgg = buttonDi(aggiunto.html, T.scheda.aggiunto);
  c("dopo l'aggiunta: il bottone dice «Aggiunto» con la spunta (un'icona), ed è acceso", [true, 1, false], [!!bAgg, conta(bAgg?.d ?? "", "<svg"), /\sdisabled/.test(bAgg?.a ?? "")]);
  c("…e NON dice più «Aggiungi al carrello»", false, tAgg.includes(T.scheda.aggiungi));
  c("la striscia «{nome} è nel carrello · Vai al carrello»", true, tAgg.includes(`${alfa.nome} è nel carrello`) && tAgg.includes(T.scheda.vaiAlCarrello));
  const linkCarrello = tutti(aggiunto.html, "a").find((t) => t.includes('href="/shop/carrello"'));
  c("…«Vai al carrello» è un link a /shop/carrello (non un bottone pieno), con l'area da 44 px", [true, false, true], [!!linkCarrello, classi(linkCarrello ?? "").includes("bg-[#0A1430]"), classi(linkCarrello ?? "").includes("min-h-11")]);
  c("…la striscia sta SOTTO il bottone e prima della riga di fiducia", true, aggiunto.html.indexOf(T.scheda.aggiunto) < aggiunto.html.indexOf(T.scheda.vaiAlCarrello) && aggiunto.html.indexOf(T.scheda.vaiAlCarrello) < aggiunto.html.indexOf('<ul role="list"'));
  c("…in una regione `role=\"status\"` (annuncio per chi non vede)", true, /role="status"[^>]*>(?:(?!<\/div>)[\s\S])*è nel carrello/.test(aggiunto.html));
  c("la regione `role=\"status\"` c'è anche PRIMA dell'aggiunta, vuota (una regione nuova non verrebbe letta)", [1, false], [conta(base, 'role="status"'), /role="status"[^>]*>(?:(?!<\/div>)[\s\S])*è nel carrello/.test(base)]);
  const dopoTimer = (() => {
    const o = orologio();
    try {
      const g = montaGesto(M, alfa, { Colore: "Castano" });
      g.agisci(() => g.ris.aggiungi());
      g.agisci(() => o.avanza(2000));
      return { ...g.ris };
    } finally { o.ripristina(); }
  })();
  const htmlDopo = (await rendiComponente(radice, FILE, "BloccoAcquisto", { prodotto: alfa, blocco: bloccoDi(alfa), scelta: { Colore: "Castano" }, onScegli() {}, acquisto: dopoTimer, voci: vociDi(alfa), testi: D.TESTI_CONFERMATI_PIENI, formatta }, {})).html;
  c("passati i 2 secondi, nel DISEGNO: di nuovo «Aggiungi al carrello» (non «Aggiunto») e la striscia resta", [true, false, true], [!!buttonDi(htmlDopo, T.scheda.aggiungi), !!buttonDi(htmlDopo, T.scheda.aggiunto), leggibile(htmlDopo).includes(T.scheda.vaiAlCarrello)]);
  c("nessun avviso a comparsa: nessun toast nel disegno né nel sorgente", [false, false], [/toast|sonner/i.test(aggiunto.html), /toast|sonner/i.test(src)]);
  c("nessun «Acquista ora» (in nessuno stato, né nel sorgente)", false, /acquista ora/i.test([base, esau, aggiunto.html, premuto.html, src].join("\n")));

  // ── Invisible Derm e anteprima: si mostra la scheda, non si compra ──
  const dermHtml = (await disegna(derm, {}, { props: { blocco: bloccoDi(derm) } })).html;
  c("Invisible Derm (non acquistabile): c'è la testata (H1, riga) e NIENTE bottone, prezzo, «Spedizione», scelta, fiducia", [1, 0, 0, false, false, 0, 0], [conta(dermHtml, "<h1"), conta(dermHtml, "<button"), conta(dermHtml, 'role="radiogroup"'), /€|IVA/.test(dermHtml), /Spedizione/.test(dermHtml), conta(dermHtml, '<ul role="list"'), conta(dermHtml, "data-barra-nascondi")]);
  const anteprimaHtml = (await disegna(inAnteprima, {}, { props: { blocco: bloccoDi(inAnteprima) } })).html;
  c("anteprima: la testata e il prezzo ci sono, ma il bottone d'acquisto MANCA (D94: non vende) e nessuna scelta, riga di fiducia né barra", [1, true, 0, false, 0, 0], [conta(anteprimaHtml, "<h1"), /IVA inclusa/.test(anteprimaHtml), conta(anteprimaHtml, "<button"), leggibile(anteprimaHtml).includes(T.scheda.aggiungi), conta(anteprimaHtml, '<ul role="list"'), conta(anteprimaHtml, "data-barra-nascondi")]);
  const shamp = (await disegna(shampoo, { Misura: "250 ml" })).html;
  c("una cura (shampoo, due misure): stessa struttura, senza eyebrow di patch ma con la sua categoria", [true, true], [leggibile(shamp).includes(shampoo.categorie[0].nome), !!buttonDi(shamp, T.scheda.aggiungi)]);
  const senzaCategoria = (await disegna({ ...copia(alfa), categorie: [] })).html;
  c("senza categoria: nessun eyebrow vuoto (il disegno non ha un nodo senza testo davanti all'H1)", false, /<p[^>]*>\s*<\/p>/.test(senzaCategoria.slice(0, senzaCategoria.indexOf("<h1"))));
  c("un nome con marcatura non diventa marcatura (`<b>` nel nome è testo)", false, (await disegna({ ...copia(alfa), nome: "<b>x</b> Patch" })).html.includes("<b>x</b>"));
  const senzaRiga = (await disegna({ ...copia(alfa), rigaPresentazione: null })).html;
  c("la riga di presentazione mancante non lascia un paragrafo vuoto nella testata (il posto del nome del campione, più sotto, è un'altra cosa)", false, /<p[^>]*>\s*<\/p>/.test(senzaRiga.slice(0, senzaRiga.indexOf('role="radiogroup"'))));

  // ── nessuna parola vietata, nessun segnaposto, nessun indirizzo ──
  const tuttiHtml = [base, esau, aggiunto.html, premuto.html, dermHtml, anteprimaHtml, senzaTariffa, tuttoEsaurito, shamp].join("\n");
  c("nessuna parola vietata né segnaposto né indirizzo dello studio nel disegno, in nessuno stato", [[], false], [D.trovaParoleVietate(leggibile(tuttiHtml)), /\{\{|da confermare|Scipioni/i.test(tuttiHtml)]);
  c("nessuna stella, nessun barrato, nessuna scarsità («ultimi pezzi», «solo 3»)", false, /ultim[io] pezz|solo \d+|stell|line-through|<del|<s>/i.test(leggibile(tuttiHtml)) || /line-through|<del|<s>/.test(tuttiHtml));
  c("nessuna ombra, nessuna sfocatura, nessun gradiente nel disegno (colori e bordi, non effetti)", false, /shadow-|backdrop-|blur-|bg-gradient|animate-/.test(tuttiHtml));
  c("nessuna tinta fuori dal sistema (solo notte, bianco, `ink`, `ink-muted`): niente colori a elenco", false, /(bg|text|border)-(red|blue|green|yellow|orange|amber|stone|zinc|gray|slate|rose|emerald)-/.test(tuttiHtml));

  // ════ 3 · IL SORGENTE ════════════════════════════════════════════════════════════════════════════════════
  c("riusa la logica già provata: `statoBottone`, `varianteScelta`, `messaggioMancante` (T78), `statoAggiunta`, `DURATA_AGGIUNTO_MS` (T105), `eventoAggiungi` (T79)", [true, true, true, true, true, true], ["statoBottone", "varianteScelta", "messaggioMancante", "statoAggiunta", "DURATA_AGGIUNTO_MS", "eventoAggiungi"].map((n) => new RegExp(`\\b${n}\\b`).test(src)));
  c("…e i componenti già fatti: `SelettoreVariante`, `fuocoSullaScelta` (T87a), `BloccoFiducia` (T85), `ATTRIBUTO_BLOCCO` (T84a), `badgeProntaConsegna` (T76)", [true, true, true, true, true], ["SelettoreVariante", "fuocoSullaScelta", "BloccoFiducia", "ATTRIBUTO_BLOCCO", "badgeProntaConsegna"].map((n) => new RegExp(`\\b${n}\\b`).test(src)));
  c("`useCart().add` è l'unico modo di mettere nel carrello (e `useCart` non serve a leggere righe o prezzi)", [true, false], [/\badd\(/.test(src), /\b(lines|subtotal)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))]);
  c("nessuna lettura di `localStorage` né di righe alterabili: il prezzo viene dal prodotto", false, /localStorage|sessionStorage/.test(src));
  c("nessuna frase scritta nel componente: niente «Aggiungi al carrello», «Aggiunto», «Esaurito», «IVA inclusa», «Vai al carrello» fra virgolette", [false, false, false, false, false], ["Aggiungi al carrello", "Aggiunto", "Esaurito", "IVA inclusa", "Vai al carrello"].map((f) => new RegExp(`["'\`]\\s*${f}`).test(src)));
  c("nessun «da confermare» né `{{` nel sorgente, nemmeno nei commenti", [false, false], [/da confermare/i.test(src), /\{\{/.test(src)]);
  c("nessun indirizzo dello studio nel sorgente (né via, né civico)", false, /Scipioni|\bVia\s+[A-Z]\w+\s+\d/.test(src));
  c("nessun `fbq`, `ttq`, `gtag` (l'evento passa da `emettiEvento`, che rispetta il consenso), nessun `dangerouslySetInnerHTML`", [false, false, true], [/\b(fbq|ttq|gtag)\b/.test(src), /dangerouslySetInnerHTML/.test(src), /emettiEvento/.test(src)]);
  c("nessun `toast` né `sonner`, e nessun «Acquista ora»", [false, false], [/toast|sonner/i.test(src), /acquista ora/i.test(src)]);
  c("il bottone si spegne SOLO per «Esaurito»: `disabled` dipende da `esaurito` e basta", [1, true], [conta(src, /\bdisabled=\{/g), /disabled=\{(acquisto\.)?esaurito\}/.test(src)]);
  c("il timer cambia uno stato (`setAggiunta`/`set…` dentro il `setTimeout`) e si cancella allo smontaggio (`clearTimeout` in un effetto)", [true, true], [/setTimeout\(\s*\(\)\s*=>\s*set\w+\(/.test(src), /useEffect\([\s\S]*clearTimeout/.test(src)]);
  c("nessuna rotta monta il blocco (lo monta T97b) e `routeTree.gen.ts` non lo nomina", 0, [...camminaSrc(join(radice, "src/routes")), join(radice, "src/routeTree.gen.ts")].filter((f) => /BloccoAcquisto/.test(readFileSync(f, "utf8"))).length);
  c("nessun file di `src/` importa questo componente (non è ancora montato)", 0, camminaSrc(join(radice, "src")).filter((f) => !f.endsWith("BloccoAcquisto.tsx") && /scheda\/BloccoAcquisto/.test(readFileSync(f, "utf8"))).length);
}

const camminaSrc = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? camminaSrc(join(d, e.name)) : /\.(tsx?|mjs)$/.test(e.name) ? [join(d, e.name)] : [])) : []);
