/** ── VETRINA V1 · T84a · LE BARRE FISSE DEL TELEFONO (D83, V1-H5, V1-S6, V1-K1) ───────────────────────────
 *  `src/components/shop/guscio/BarreFisse.tsx`: `BarraAcquisto` (scheda), `BarraCarrello` (carrello), `useAltezzaBanner`.
 *  Cosa deve valere:
 *   · la logica che nasconde la barra è una FUNZIONE PURA (`bloccoCopre`), provata sui bordi: la barra c'è solo quando
 *     il blocco marcato `data-barra-nascondi` è fuori dallo schermo (e non copre mai un bottone);
 *   · il collegamento al browser (`collegaBlocchi`, `collegaAltezzaBanner`) gira qui con un documento FINTO: ascolta,
 *     si scollega, scrive `--banner-h` su `[data-shop-v1]` e lo toglie;
 *   · il disegno (`react-dom/server`): barra BIANCA, `inert` quando nascosta, spazio riservato solo sotto 1024 px,
 *     `bottom: var(--banner-h)`, nessun blu della consulenza, nessun rosso, testi solo da `testi-shop.ts`, prezzi solo da
 *     `PrezzoVista` (mai dalla memoria del browser), carrello vuoto = nessuna barra e nessuno spazio.
 *  Dati inventati, nessuna rete. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gestore, rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
const FILE = "src/components/shop/guscio/BarreFisse.tsx";

/** Impacchetta il file (con un finto del router) e ne restituisce le esportazioni, per le funzioni pure e i collegamenti. */
async function carica(radice, file = FILE) {
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-barre-"));
  try {
    const finto = join(dir, "router.mjs");
    writeFileSync(finto, `import React from "react"; export const Link = ({ to, children, ...r }) => React.createElement("a", { ...r, href: to }, children);`);
    const entrata = join(dir, "entrata.ts");
    writeFileSync(entrata, `export * from ${JSON.stringify(join(radice, file))};`);
    const r = await esbuild.build({
      entryPoints: [entrata], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      alias: { "@": join(radice, "src"), "@tanstack/react-router": finto }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
      define: { "import.meta.env.PROD": "true", "import.meta.env.DEV": "false" },
    });
    const uscita = join(dir, "barre.cjs");
    writeFileSync(uscita, r.outputFiles[0].text);
    return requireQui(uscita);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Un documento e una finestra finti, quanto basta ai collegamenti: eventi, rAF, osservatori, `querySelector`. */
function ambiente({ alto = 800, blocchi = [], banner = null, radice = true, osservatori = true } = {}) {
  const el = (r) => ({ dataset: r.tipo === undefined ? {} : { barraNascondi: r.tipo }, getBoundingClientRect: () => ({ top: r.top, bottom: r.bottom, width: r.width ?? 100, height: r.height ?? 100 }) });
  const stato = { blocchi: blocchi.map(el), banner: banner && { rect: banner }, ascolti: new Map(), raf: new Map(), prossimoRaf: 1, osservati: [], staccati: 0, mutazioni: [], proprieta: {}, tolte: [] };
  const win = {
    innerHeight: alto,
    addEventListener: (t, f) => stato.ascolti.set(t, f),
    removeEventListener: (t, f) => { if (stato.ascolti.get(t) === f) stato.ascolti.delete(t); },
    requestAnimationFrame: (f) => { const n = stato.prossimoRaf++; stato.raf.set(n, f); return n; },
    cancelAnimationFrame: (n) => stato.raf.delete(n),
  };
  if (osservatori) {
    win.ResizeObserver = class { constructor(f) { this.f = f; stato.resize = this; } observe(x) { stato.osservati.push(x); } unobserve(x) { stato.osservati = stato.osservati.filter((y) => y !== x); } disconnect() { stato.staccati++; stato.osservati = []; } };
    win.MutationObserver = class { constructor(f) { this.f = f; stato.mutazioni.push(this); } observe(x, o) { this.opzioni = o; this.radice = x; } disconnect() { this.staccato = true; } };
  }
  const bannerEl = banner && { getBoundingClientRect: () => stato.banner.rect };
  const radiceEl = { style: { setProperty: (n, v) => { stato.proprieta[n] = v; }, removeProperty: (n) => { delete stato.proprieta[n]; stato.tolte.push(n); } } };
  const doc = {
    body: { nome: "body" }, documentElement: { nome: "html" },
    querySelectorAll: (s) => (s === "[data-barra-nascondi]" ? stato.blocchi : []),
    querySelector: (s) => (s === "[data-shop-v1]" ? (radice ? radiceEl : null) : s === "[data-banner-cookie]" ? (stato.banner ? bannerEl : null) : null),
  };
  /** Fa scorrere un fotogramma: esegue (una volta) ciò che era in attesa. */
  const fotogramma = () => { const l = [...stato.raf.values()]; stato.raf.clear(); l.forEach((f) => f()); };
  return { win, doc, stato, fotogramma };
}

/** `rendiComponente` non definisce `import.meta.env` (serve al vero `FotoShop`, già provato da `foto-shop.mjs`): qui un finto con lo stesso contratto (classi del riquadro, alt, uso). */
const FOTO_FINTA = { "@/components/shop/FotoShop": `import React from "react"; export const FotoShop = ({ foto, alt, uso, className }) => foto ? React.createElement("span", { className, "data-uso": uso }, React.createElement("img", { src: foto.w480, alt, width: 96, height: 96 })) : null;` };
const SENZA_TAG = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const FOTO = { w480: "https://m.prova.test/p-480.jpg", w960: "https://m.prova.test/p-960.jpg", w1600: "https://m.prova.test/p-1600.jpg" };
const EURO = (cent) => `${(cent / 100).toFixed(2).replace(".", ",")} €`;

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T84a · BARRE FISSE (23/11/2026)");
  const B = await carica(radice);
  const S = (await carica(radice, "src/landing/testi-shop.ts")).TESTI_SHOP;
  const CARR = mod["shop/cms/vetrina-carrello"];
  const BAR = mod["shop/cms/vetrina-barre"];
  c("le esportazioni ci sono: BarraAcquisto, BarraCarrello, useAltezzaBanner e la parte pura", [true, true, true, true, true, true, true], [
    typeof B.BarraAcquisto === "function", typeof B.BarraCarrello === "function", typeof B.useAltezzaBanner === "function",
    typeof B.bloccoCopre === "function", typeof B.altezzaBanner === "function", typeof B.collegaBlocchi === "function", typeof B.collegaAltezzaBanner === "function",
  ]);

  // ── la logica di nascondimento (pura) ──
  const V = (top, bottom, extra = {}) => ({ tipo: "vista", top, bottom, width: 100, height: bottom - top, ...extra });
  const F = (top, bottom) => ({ tipo: "fondo", top, bottom, width: 100, height: bottom - top });
  const copre = (bl, alto = 800, margine = 88) => B.bloccoCopre(bl, alto, margine);
  c("nessun blocco → la barra non è coperta (può comparire)", false, copre([]));
  c("blocco «vista» a metà schermo → la barra si nasconde", true, copre([V(200, 500)]));
  c("blocco «vista» uscito dall'alto (bordo basso a 0 o sopra) → la barra compare", [false, false], [copre([V(-300, 0)]), copre([V(-300, -10)])]);
  c("blocco «vista» che mostra anche 1 px dall'alto → la barra resta nascosta", true, copre([V(-300, 1)]));
  c("blocco «vista» ancora sotto lo schermo (bordo alto = altezza o oltre) → la barra compare", [false, false], [copre([V(800, 1000)]), copre([V(900, 1100)])]);
  c("blocco «vista» che entra dal basso di 1 px → la barra si nasconde", true, copre([V(799, 1000)]));
  c("blocco più alto dello schermo che lo attraversa → nascosta", true, copre([V(-500, 1500)]));
  c("blocco «fondo»: copre solo se il suo bordo basso entra nell'area della barra (margine) e il bordo alto è a schermo", [false, true, true, false], [
    copre([F(300, 700)], 800, 88), copre([F(300, 713)], 800, 88), copre([F(780, 1000)], 800, 88), copre([F(800, 1000)], 800, 88),
  ]);
  c("«fondo»: il margine è quello dato (la barra vera può essere più alta)", [false, true], [copre([F(300, 700)], 800, 88), copre([F(300, 700)], 800, 120)]);
  c("un blocco senza dimensioni (display:none) non conta", [false, false], [copre([V(200, 500, { width: 0, height: 0 })]), copre([F(700, 900)].map((b) => ({ ...b, width: 0, height: 0 })))]);
  c("un valore sconosciuto dell'attributo non nasconde niente", false, copre([{ tipo: "altro", top: 100, bottom: 400, width: 100, height: 300 }, { tipo: undefined, top: 100, bottom: 400, width: 100, height: 300 }]));
  c("basta UN blocco a schermo tra molti", true, copre([V(-900, -500), V(1200, 1500), V(300, 400)]));
  c("la funzione non cambia l'elenco ricevuto", true, (() => { const bl = [V(200, 500)]; const copia = JSON.stringify(bl); copre(bl); return JSON.stringify(bl) === copia; })());

  // ── l'altezza del banner ──
  const R = (top, height = 100) => ({ top, height, bottom: top + height, width: 390 });
  c("altezzaBanner: nessun banner → 0", [0, 0], [B.altezzaBanner(null, 800), B.altezzaBanner(undefined, 800)]);
  c("altezzaBanner: la parte dello schermo che il banner occupa dal basso (telefono: altezza; scheda ≥ 640: altezza + distanza dal fondo)", [200, 216], [B.altezzaBanner(R(600, 200), 800), B.altezzaBanner(R(584, 200), 800)]);
  c("altezzaBanner: arrotonda, mai negativa, mai oltre lo schermo; banner senza altezza = 0", [201, 0, 800, 0], [B.altezzaBanner(R(598.6, 200), 800), B.altezzaBanner(R(900, 50), 800), B.altezzaBanner(R(-40, 900), 800), B.altezzaBanner(R(600, 0), 800)]);
  c("altezzaBanner: valori non numerici → 0", [0, 0], [B.altezzaBanner({ top: NaN, height: 100 }, 800), B.altezzaBanner(R(600, 200), NaN)]);

  // ── il collegamento ai blocchi (documento finto) ──
  {
    const letture = [];
    const a = ambiente({ blocchi: [{ tipo: "vista", top: 200, bottom: 500 }] });
    const scollega = B.collegaBlocchi(a.win, a.doc, () => 88, (x) => letture.push(x));
    c("collegaBlocchi: subito una lettura (prima del disegno), blocco a schermo → coperta", [true], letture.slice());
    a.stato.blocchi.length = 0;
    c("collegaBlocchi: ascolta scroll e resize, osserva il corpo della pagina", [true, true, ["body"]], [a.stato.ascolti.has("scroll"), a.stato.ascolti.has("resize"), a.stato.osservati.map((x) => x.nome)]);
    a.stato.ascolti.get("scroll")(); a.stato.ascolti.get("scroll")(); a.stato.ascolti.get("resize")();
    c("collegaBlocchi: più eventi di fila = un solo ricalcolo al fotogramma (non uno per evento)", [1, 1], [a.stato.raf.size, letture.length]);
    a.fotogramma();
    c("collegaBlocchi: al fotogramma rilegge le posizioni (il blocco non c'è più → non coperta)", [true, false], letture);
    a.stato.resize.f(); // la pagina cambia altezza (contenuti che arrivano dopo)
    c("collegaBlocchi: anche il cambio di altezza della pagina pianifica un ricalcolo", 1, a.stato.raf.size);
    scollega();
    c("collegaBlocchi: scollegando toglie gli ascolti, stacca l'osservatore e annulla il fotogramma in attesa", [false, false, 1, 0], [a.stato.ascolti.has("scroll"), a.stato.ascolti.has("resize"), a.stato.staccati, a.stato.raf.size]);
  }
  {
    const letture = [];
    const a = ambiente({ blocchi: [{ tipo: "vista", top: -200, bottom: -10 }], osservatori: false });
    const scollega = B.collegaBlocchi(a.win, a.doc, () => 88, (x) => letture.push(x));
    c("collegaBlocchi senza ResizeObserver (browser vecchio): non lancia, funziona con scroll e resize", [[false], true], [letture, a.stato.ascolti.has("scroll")]);
    scollega();
  }
  {
    // il margine è letto ogni volta (la barra vera può cambiare altezza: zona dei gesti)
    let margine = 88;
    const letture = [];
    const a = ambiente({ blocchi: [{ tipo: "fondo", top: 300, bottom: 740 }] });
    B.collegaBlocchi(a.win, a.doc, () => margine, (x) => letture.push(x));
    margine = 40; a.stato.ascolti.get("scroll")(); a.fotogramma();
    c("collegaBlocchi: il margine è quello di adesso, non quello del primo calcolo", [true, false], letture);
  }

  // ── il collegamento al banner (documento finto) ──
  {
    const a = ambiente({ banner: R(600, 200) });
    const scollega = B.collegaAltezzaBanner(a.win, a.doc);
    c("useAltezzaBanner: scrive --banner-h su [data-shop-v1] subito", { "--banner-h": "200px" }, a.stato.proprieta);
    c("useAltezzaBanner: osserva il banner e la pagina (arriva e sparisce), con l'attributo di T84b1", [[a.doc.querySelector("[data-banner-cookie]")], true, ["data-banner-cookie", "data-shop-v1"]], [
      a.stato.osservati, a.stato.mutazioni.length === 1 && a.stato.mutazioni[0].opzioni.childList === true && a.stato.mutazioni[0].opzioni.subtree === true, [...(a.stato.mutazioni[0].opzioni.attributeFilter ?? [])].sort(),
    ]);
    a.stato.banner.rect = R(500, 300); // si aprono le preferenze: il banner è più alto
    a.stato.resize.f(); a.fotogramma();
    c("useAltezzaBanner: se il banner cambia altezza, il valore segue", "300px", a.stato.proprieta["--banner-h"]);
    a.stato.banner = null; // scelta fatta: il banner sparisce
    a.stato.mutazioni[0].f(); a.fotogramma();
    c("useAltezzaBanner: banner sparito → 0px (la barra torna in fondo)", "0px", a.stato.proprieta["--banner-h"]);
    a.stato.banner = { rect: R(560, 240) }; // «Preferenze cookie» nel piè di pagina lo riapre
    a.stato.mutazioni[0].f(); a.fotogramma();
    c("useAltezzaBanner: banner riaperto → di nuovo la sua altezza", "240px", a.stato.proprieta["--banner-h"]);
    a.stato.ascolti.get("resize")(); a.fotogramma();
    scollega();
    c("useAltezzaBanner: scollegando toglie --banner-h, stacca gli osservatori, toglie gli ascolti", [["--banner-h"], {}, true, false, false], [a.stato.tolte, a.stato.proprieta, a.stato.mutazioni[0].staccato === true, a.stato.ascolti.has("resize"), a.stato.raf.size > 0]);
  }
  {
    const a = ambiente({ radice: false, banner: R(600, 200) });
    let lancia = "no";
    try { B.collegaAltezzaBanner(a.win, a.doc)(); } catch (e) { lancia = e.message; }
    c("useAltezzaBanner: senza l'elemento [data-shop-v1] (pagina di oggi) non scrive e non lancia", ["no", {}], [lancia, a.stato.proprieta]);
    const b = ambiente({ osservatori: false });
    c("useAltezzaBanner: senza osservatori (browser vecchio) non lancia", "ok", (() => { try { B.collegaAltezzaBanner(b.win, b.doc)(); return "ok"; } catch (e) { return e.message; } })());
  }

  // ── --barra-h: il fuoco non finisce sotto la barra ──
  {
    const a = ambiente({});
    const barraEl = { offsetHeight: 72 };
    const scollega = B.collegaBarraH(a.win, a.doc, barraEl);
    c("--barra-h: l'altezza vera della barra + il banner che le sta sotto (calcolato dal browser)", { "--barra-h": "calc(var(--banner-h, 0px) + 72px)" }, a.stato.proprieta);
    barraEl.offsetHeight = 106; a.stato.resize.f();
    c("--barra-h: segue la barra se cambia altezza (zona dei gesti)", "calc(var(--banner-h, 0px) + 106px)", a.stato.proprieta["--barra-h"]);
    barraEl.offsetHeight = 0; a.stato.resize.f();
    c("--barra-h: barra non disegnata (sopra i 1024 px, display:none) → niente spazio per il fuoco", {}, a.stato.proprieta);
    barraEl.offsetHeight = 72; a.stato.resize.f(); scollega();
    c("--barra-h: scollegando lo toglie e stacca l'osservatore", [{}, 1], [a.stato.proprieta, a.stato.staccati]);
    const b = ambiente({ osservatori: false });
    c("--barra-h senza ResizeObserver: scrive una volta e non lancia", { "--barra-h": "calc(var(--banner-h, 0px) + 72px)" }, (() => { B.collegaBarraH(b.win, b.doc, { offsetHeight: 72 }); return b.stato.proprieta; })());
  }
  c("ATTRIBUTO_BLOCCO è `data-barra-nascondi=\"vista\"` (il valore che le barre leggono)", { "data-barra-nascondi": "vista" }, B.ATTRIBUTO_BLOCCO);
  c("misuraBlocchi legge attributo e misure dal documento", [{ tipo: "vista", top: 10, bottom: 50, width: 100, height: 40 }], (() => {
    const a = ambiente({ blocchi: [{ tipo: "vista", top: 10, bottom: 50, height: 40 }] });
    return B.misuraBlocchi(a.doc);
  })());

  // ── il disegno: barra d'acquisto ──
  const FIGLIO = "<span>figlio</span>";
  const acq = async (props = {}, stato = {}) => (await rendiComponente(radice, FILE, "BarraAcquisto", { nome: "Patch Prova Alfa", prezzo: { tipo: "cifra", cent: 28900 }, formatta: EURO, foto: FOTO, esaurito: false, onAggiungi: () => {}, ...props }, { finti: FOTO_FINTA, ...stato }));
  const { html: h, pagina: p } = await acq();
  const classe = (html, marca) => (html.match(new RegExp(`<div[^>]*${marca}[^>]*>`)) ?? [""])[0];
  const barra = classe(h, "data-barra-fissa");
  const spazio = classe(h, "data-barra-spazio");
  c("barra d'acquisto: è una regione con nome accessibile (il bottone), marcata come barra d'acquisto", [true, true], [/role="region"/.test(barra) && barra.includes(`aria-label="${S.scheda.aggiungi}"`), /data-barra-fissa="acquisto"/.test(barra)]);
  c("barra d'acquisto: parte NASCOSTA (prima del primo controllo) = inert, invisibile, spostata fuori, segnata", [true, true, true], [/\sinert(=""|\s|>)/.test(barra), /\binvisible\b/.test(barra) && /translate-y-full/.test(barra), /data-nascosta/.test(barra)]);
  c("barra d'acquisto: BIANCA, bordo alto ink/10, ombra galleggiante, sotto il banner (z-40, il banner è z-50)", [true, true, true, true], [/\bbg-white\b/.test(barra), /\bborder-t\b/.test(barra) && /border-ink\/10/.test(barra), /shadow-galleggiante/.test(barra), /\bz-40\b/.test(barra)]);
  c("barra d'acquisto: SOLO sotto i 1024 px (lg:hidden) e sopra il banner con --banner-h", [true, true], [/\blg:hidden\b/.test(barra), /bottom-\[var\(--banner-h,0px\)\]/.test(barra)]);
  c("barra d'acquisto: nessun blu della consulenza, nessun rosso, nessuno sfondo scuro sulla barra", [false, false, false, false], [/brand/.test(barra), /FF3B3B|destructive|bg-red/i.test(h), /#081634/.test(h), /bg-\[#0A1430\]/.test(barra)]);
  c("lo spazio riservato in fondo alla pagina: 72 px + zona dei gesti (la stessa di `spazioRiservato`), solo sotto 1024 px, nascosto ai lettori di schermo", [true, true, true], [
    spazio.includes(`height:${BAR.spazioRiservato("acquisto")}`) && BAR.spazioRiservato("acquisto").includes("72px"), /\blg:hidden\b/.test(spazio), /aria-hidden="true"/.test(spazio),
  ]);
  c("barra d'acquisto: lo spazio sta PRIMA della barra (resta nel flusso, sotto non c'è altro)", true, h.indexOf("data-barra-spazio") < h.indexOf("data-barra-fissa"));
  c("barra d'acquisto: altezza 72 e area dei gesti (padding che si toglie se sotto c'è il banner)", [true, true], [h.includes("h-[72px]"), /padding-bottom:max\(0px, ?calc\(env\(safe-area-inset-bottom, ?0px\) ?- ?var\(--banner-h, ?0px\)\)\)/.test(barra)]);
  const testoBarra = SENZA_TAG(h.replace(/aria-label="[^"]*"/g, ""));
  c("barra d'acquisto: il testo visibile è solo nome, prezzo e il bottone (testo da testi-shop.ts)", `Patch Prova Alfa 289,00 € ${S.scheda.aggiungi}`, testoBarra);
  c("barra d'acquisto: il bottone è pieno «notte» 48 px, e di tipo button", [true, true, true], [/<button[^>]*type="button"/.test(h), /bg-\[#0A1430\]/.test(h) && /hover:bg-\[#1B2A4E\]/.test(h) && /text-white/.test(h), /\bh-12\b/.test(h)]);
  c("barra d'acquisto: anello di fuoco di T74 (azzurro, perché la barra è chiara)", true, /shop-anello(\s|")/.test(h));
  c("barra d'acquisto: il nome si taglia a una riga", true, /<p[^>]*\btruncate\b[^>]*>Patch Prova Alfa/.test(h));
  c("barra d'acquisto: miniatura 48 px, decorativa (alt vuoto, il nome è accanto), nascosta sotto 360 px", [true, true, true], [/<img[^>]*alt=""/.test(h), /\bh-12\b[^"]*\bw-12\b|\bw-12\b[^"]*\bh-12\b/.test(h), /max-\[359px\]:hidden/.test(h)]);
  c("barra d'acquisto: «Aggiungi» chiama quello che dà il genitore (lo stesso gesto del bottone nel blocco)", 1, await (async () => {
    let n = 0;
    const { pagina } = await acq({ onAggiungi: () => { n++; } });
    gestore(pagina, "button", S.scheda.aggiungi)();
    return n;
  })());
  // prezzi: solo da PrezzoVista
  const testoPrezzo = async (prezzo) => SENZA_TAG((await acq({ prezzo })).html.replace(/aria-label="[^"]*"/g, "")).replace("Patch Prova Alfa ", "").replace(` ${S.scheda.aggiungi}`, "");
  c("prezzo: cifra solo se è `cifra`; in controllo «…»; non verificabile «—» (mai la cifra ricordata dal browser)", ["289,00 €", "…", "—"], [await testoPrezzo({ tipo: "cifra", cent: 28900 }), await testoPrezzo({ tipo: "attesa" }), await testoPrezzo({ tipo: "assente" })]);
  c("prezzo: stessa funzione del carrello (`testoPrezzo` di vetrina-carrello)", true, ["cifra", "attesa", "assente"].every((t) => CARR.testoPrezzo({ tipo: t, cent: 100 }, EURO) === { cifra: "1,00 €", attesa: "…", assente: "—" }[t]));
  // stati del bottone
  const esa = (await acq({ esaurito: true })).html;
  c("esaurito: il bottone è disabilitato e dice «Esaurito» (bordo e testo attenuati, mai grigio pieno)", [true, true, true], [/<button[^>]*\sdisabled(=""|\s|>)/.test(esa), SENZA_TAG(esa).endsWith(S.scheda.esaurito), /disabled:border-ink\/30/.test(esa) && /disabled:text-ink-muted/.test(esa)]);
  c("esaurito: la parola è quella della scheda in testi-shop.ts", true, SENZA_TAG(esa).includes(S.scheda.esaurito));
  const agg = (await acq({ aggiunto: true })).html;
  c("«Aggiunto» (2 s dopo il tocco): parola da testi-shop.ts, con la spunta, annunciata", [true, true, true], [SENZA_TAG(agg).endsWith(S.scheda.aggiunto), /<svg/.test(agg), /aria-live="polite"/.test(agg)]);
  c("senza `aggiunto` e senza `esaurito` il bottone dice «Aggiungi al carrello» ed è attivo", [true, false], [SENZA_TAG(h).endsWith(S.scheda.aggiungi), /<button[^>]*\sdisabled(=""|\s|>)/.test(h)]);
  const senzaFoto = (await acq({ foto: null })).html;
  c("senza foto: nessuna miniatura e nessun riquadro vuoto", [false, `Patch Prova Alfa 289,00 € ${S.scheda.aggiungi}`], [/<img|<span[^>]*aspect-ratio/.test(senzaFoto), SENZA_TAG(senzaFoto.replace(/aria-label="[^"]*"/g, ""))]);
  {
    const strano = (await acq({ nome: `<b>x</b> & "y"` })).html;
    c("nome con `<b>` e virgolette: nessun tag `<b>` nel disegno, il testo è scritto con le sue entità", [false, true], [/<b>/.test(strano), strano.includes("&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;")]);
  }

  // ── il contenitore, nei due stati ──
  const cont = async (visibile) => (await rendiComponente(radice, FILE, "ContenitoreBarra", { visibile, etichetta: "Prova", children: FIGLIO }, {})).html;
  const aperta = await cont(true), chiusa = await cont(false);
  const contAperto = classe(aperta, "data-barra-fissa"), contChiuso = classe(chiusa, "data-barra-fissa");
  c("contenitore: VISIBILE = niente inert, niente data-nascosta, al suo posto (translate-y-0)", [false, false, true, false], [/\sinert/.test(contAperto), /data-nascosta/.test(contAperto), /translate-y-0/.test(contAperto), /\binvisible\b/.test(contAperto)]);
  c("contenitore: NASCOSTO = inert + invisibile + spostato + segnato (mai raggiungibile con Tab)", [true, true, true, false], [/\sinert/.test(contChiuso), /\binvisible\b/.test(contChiuso), /data-nascosta/.test(contChiuso), /translate-y-0/.test(contChiuso)]);
  c("contenitore: lo spazio riservato c'è in entrambi i casi (la pagina non salta quando la barra compare)", [true, true], [aperta.includes("data-barra-spazio"), chiusa.includes("data-barra-spazio")]);
  c("contenitore: movimento ridotto → nessuna transizione", true, /motion-reduce:transition-none/.test(contAperto));

  // ── il disegno: barra del carrello ──
  const car = async (props = {}) => (await rendiComponente(radice, FILE, "BarraCarrello", { righe: 2, totale: { tipo: "cifra", cent: 31300 }, formatta: EURO, ...props }, {})).html;
  const hc = await car();
  const barraC = classe(hc, "data-barra-fissa");
  c("barra del carrello: «Totale», la cifra e «Vai alla cassa» (testi da testi-shop.ts)", `${S.carrello.totale} 313,00 € ${S.carrello.vaiAllaCassa}`, SENZA_TAG(hc.replace(/aria-label="[^"]*"/g, "")));
  c("barra del carrello: [Vai alla cassa] è un collegamento alla cassa di oggi, pieno notte 48 px", [true, true, true], [new RegExp(`<a[^>]*href="${CARR.PERCORSO_CASSA}"`).test(hc), /bg-\[#0A1430\]/.test(hc) && /\bh-12\b/.test(hc), /shop-anello(\s|")/.test(hc)]);
  c("barra del carrello: stessa famiglia della barra d'acquisto (bianca, sotto 1024, sopra il banner, nascosta = inert, spazio riservato)", [true, true, true, true, true, true], [
    /\bbg-white\b/.test(barraC), /\blg:hidden\b/.test(barraC), /bottom-\[var\(--banner-h,0px\)\]/.test(barraC), /\sinert/.test(barraC), /data-barra-fissa="acquisto"/.test(barraC), hc.includes("data-barra-spazio"),
  ]);
  c("barra del carrello: nessuna barra di spedizione gratuita, nessun invito alla consulenza, niente blu", [false, false, false], [/gratis|gratuit/i.test(hc), /consulenza/i.test(hc), /brand/.test(hc)]);
  c("carrello vuoto (0 righe, o un numero rovinato): NESSUNA barra e NESSUNO spazio riservato", ["", "", "", ""], [await car({ righe: 0 }), await car({ righe: -1 }), await car({ righe: NaN }), await car({ righe: undefined })]);
  const tot = async (totale) => SENZA_TAG((await car({ totale })).replace(/aria-label="[^"]*"/g, "")).replace(`${S.carrello.totale} `, "").replace(` ${S.carrello.vaiAllaCassa}`, "");
  c("totale: cifra solo da `PrezzoVista` `cifra`; «…» se si sta controllando; «—» se non si sa", ["313,00 €", "…", "—"], [await tot({ tipo: "cifra", cent: 31300 }), await tot({ tipo: "attesa" }), await tot({ tipo: "assente" })]);
  c("la barra del carrello usa `barraCarrello` di T79 (nascosta col bottone del riepilogo = inert)", [true, false], [CARR.barraCarrello({ righe: 2, nascondiConBottone: true }).inert, CARR.barraCarrello({ righe: 2 }).inert]);

  // ── regole sul sorgente ──
  const src = readFileSync(join(radice, FILE), "utf8");
  const codice = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  c("prezzi solo da vetrina-carrello: nessun accesso alla memoria del browser, nessuna riga del carrello, nessun `useCart`", [false, false, false, false], [/localStorage|sessionStorage/.test(codice), /useCart|CartContext/.test(codice), /\.snap\b|prezzoCent/.test(codice), /fetch\(|supabase/i.test(codice)]);
  c("importa `testoPrezzo` e `barraCarrello` da vetrina-carrello e `spazioRiservato` da vetrina-barre", [true, true, true], [/testoPrezzo/.test(codice) && /vetrina-carrello/.test(codice), /barraCarrello/.test(codice), /spazioRiservato/.test(codice) && /vetrina-barre/.test(codice)]);
  c("non importa la barra della consulenza (V1-T8: la monta solo il guscio), né colori del blu o del rosso", [false, false, false], [/BarraConsulenza/.test(codice.replace(/\bBarra(Acquisto|Carrello)\b/g, "")), /brand-scuro|bg-brand|text-brand/.test(codice), /FF3B3B|destructive/i.test(codice)]);
  c("l'altezza 72 del documento di Design è in un punto solo e `--barra-h` la include (il fuoco non finisce sotto la barra)", [true, true], [(codice.match(/\b72\b/g) ?? []).length >= 1, /--barra-h/.test(codice)]);
}
