/** ── VETRINA V1 · T86 · LA GALLERIA E LA LIGHTBOX DELLA SCHEDA ────────────────────────────────────────────────
 *  `src/components/shop/scheda/GalleriaProdotto.tsx` e `Lightbox.tsx`, disegnati davvero (esbuild + react-dom/server, `_rende.mjs`).
 *  Cosa deve valere (V1-S2, V1-T11, D82, D98, D103):
 *   · scorrimento nativo (`scroll-snap`), `aria-roledescription` di galleria e diapositive, contatore «1/6», frecce da 44 px solo da 768,
 *     miniature verticali solo sul computer, prima foto `eager` e tutte le altre `lazy`, il video è una diapositiva con la sua copertina
 *     e NON si scarica finché non si tocca;
 *   · UNA foto sola = nessuna freccia, nessun contatore, nessuna miniatura (la regola è `controlliGalleria`, non riscritta qui);
 *   · la lightbox è Radix Dialog caricata IN RITARDO (`lazy`): non è nel pacchetto della galleria e si scarica solo al primo tocco;
 *   · i testi (etichette aria comprese) vengono tutti da `testi-shop.ts`: nessuna frase scritta nei due file.
 *  ⚠️ Senza browser `react-dom/server` non fa girare né gli eventi né gli stati. Qui si usa un BANCO: un `react` finto (solo `useState`,
 *  `useRef` e `lazy`; ogni altro hook LANCIA, così un effetto o un timer aggiunto dopo non passa inosservato) che richiama il componente vero
 *  dopo ogni cambio di stato, con nodi finti al posto dei `ref`. Ogni gestore del componente (tasti, scorrimento, tocco, chiusura della
 *  lightbox, fuoco restituito) gira davvero e ne si legge lo STATO e il disegno che ne segue. Il fuoco VERO, Esc nel documento e
 *  `scroll-snap` nel browser restano [M]/[T] (D103): li guardano T103c e T106.
 *  Dati inventati, nessuna rete. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);

/** Radix Dialog finto (come nella prova dell'header): ogni pezzo si disegna sul posto e registra le proprietà in `pagina.radix`. */
const RADIX = `
import React from "react";
const nota = (nome, p) => { (globalThis.__pagina.radix ??= []).push({ nome, props: p }); };
const pezzo = (nome, tag) => (props) => {
  nota(nome, props);
  const { children, asChild, forceMount, onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown, onPointerDownOutside, onInteractOutside, ...dom } = props;
  return React.createElement(tag, { "data-radix": nome, ...dom }, children);
};
export const Root = (props) => { nota("Root", props); return props.open ? props.children : null; };
export const Portal = ({ children }) => children;
export const Overlay = pezzo("Overlay", "div");
export const Content = pezzo("Content", "div");
export const Title = pezzo("Title", "h2");
export const Description = pezzo("Description", "p");
export const Close = pezzo("Close", "button");
`;

/** Il `react` del banco: tutto il vero, tranne gli hook, che passano per `pagina.banco`. `lazy` carica davvero (con una promessa) e, arrivato il modulo, segna lo stato «da ridisegnare». */
const reactFinto = (reale) => `
export * from ${JSON.stringify(reale)};
const B = () => globalThis.__pagina.banco;
export const useState = (i) => B().useState(i);
export const useRef = (i) => B().useRef(i);
const vietato = (nome) => () => { throw new Error("banco: l'hook " + nome + " non è previsto (nessun effetto, nessun timer: se serve, il banco va esteso)"); };
export const useEffect = vietato("useEffect");
export const useLayoutEffect = vietato("useLayoutEffect");
export const useMemo = vietato("useMemo");
export const useCallback = vietato("useCallback");
export const useReducer = vietato("useReducer");
import * as R from ${JSON.stringify(reale)};
export default R;
export const lazy = (carica) => {
  let m = null;
  let chiesto = false;
  return (props) => {
    if (!chiesto) {
      chiesto = true;
      carica().then((x) => { m = x.default; B().sporco = true; B().caricati++; });
    }
    return m ? R.createElement(m, props) : null;
  };
};
`;

/** Il banco: richiama il componente, tiene gli stati, mette nodi finti ai `ref`, e fa girare i gestori. `b` è l'oggetto che i finti del
 *  disegno già leggono (`pagina.banco`): si riempie sul posto. */
function inizializza(b, Componente, props, finta) {
  Object.assign(b, {
    slot: [], k: 0, sporco: false, caricati: 0, el: null, log: [], nodi: new Map(), render: 0,
    useState(iniziale) {
      const i = b.k++;
      if (!b.slot[i]) {
        const s = { v: typeof iniziale === "function" ? iniziale() : iniziale };
        s.set = (n) => { const nv = typeof n === "function" ? n(s.v) : n; if (!Object.is(nv, s.v)) { s.v = nv; b.sporco = true; } };
        b.slot[i] = s;
      }
      return [b.slot[i].v, b.slot[i].set];
    },
    useRef(iniziale) {
      const i = b.k++;
      if (!b.slot[i]) b.slot[i] = { current: iniziale };
      return b.slot[i];
    },
    ridisegna() {
      b.k = 0; b.sporco = false; b.render++;
      b.el = Componente(props);
      collega(b.el, b);
      return b.el;
    },
    /** Esegue `fn` (un gestore) e, se ha cambiato uno stato, ridisegna finché non cambia più niente. */
    agisci(fn) {
      fn();
      for (let n = 0; b.sporco; n++) { if (n > 20) throw new Error("banco: il componente non si assesta"); b.ridisegna(); }
    },
    /** Lascia arrivare i moduli in ritardo (`lazy`) e ridisegna. */
    async attendi() {
      for (let n = 0; n < 5; n++) await new Promise((r) => setTimeout(r, 0));
      if (b.sporco) b.agisci(() => {});
    },
    html() { globalThis.__pagina.radix = []; return finta.renderToStaticMarkup(b.el); },
    radix(nome) { return (globalThis.__pagina.radix ?? []).filter((x) => x.nome === nome).map((x) => x.props); },
    /** Il nodo finto del `data-…` dato (chi lo ha chiamato `focus`, `scrollTo`…): lo stesso fra un disegno e l'altro. */
    nodo(chiave) { return b.nodi.get(chiave); },
  });
  b.ridisegna();
  return b;
}

const chiaveNodo = (p) => p["data-diapositiva"] !== undefined ? `diapositiva-${p["data-diapositiva"]}` : p["data-scorritore"] !== undefined ? "scorritore" : p["data-video"] !== undefined ? "video" : p["data-miniatura"] !== undefined ? `miniatura-${p["data-miniatura"]}` : null;
/** Dà un nodo finto a ogni elemento con `ref` (callback o oggetto) nell'albero che il componente ha restituito. */
function collega(el, b) {
  if (Array.isArray(el)) return el.forEach((x) => collega(x, b));
  if (!el || typeof el !== "object" || !el.props) return;
  const p = el.props;
  if (p.ref) {
    const chiave = chiaveNodo(p) ?? `ref-${b.nodi.size}`;
    if (!b.nodi.has(chiave)) {
      b.nodi.set(chiave, {
        chiave, clientWidth: 400, scrollLeft: 0,
        focus: (o) => b.log.push(["focus", chiave, o ?? null]),
        scrollTo: (o) => b.log.push(["scrollTo", chiave, o]),
      });
    }
    const nodo = b.nodi.get(chiave);
    if (typeof p.ref === "function") p.ref(nodo);
    else p.ref.current = nodo;
  }
  collega(p.children, b);
}
/** Gli elementi dell'albero (solo quelli scritti dal componente, non quelli dei figli) che rispondono alla domanda. */
function trova(el, domanda, trovati = []) {
  if (Array.isArray(el)) { el.forEach((x) => trova(x, domanda, trovati)); return trovati; }
  if (!el || typeof el !== "object" || !el.props) return trovati;
  if (typeof el.type === "string" && domanda(el)) trovati.push(el);
  trova(el.props.children, domanda, trovati);
  return trovati;
}
const testoDi = (n) => (n == null || typeof n === "boolean" ? "" : Array.isArray(n) ? n.map(testoDi).join("") : typeof n === "object" ? testoDi(n.props?.children) : String(n));
const evento = (extra = {}) => { const e = { chiamate: [], preventDefault() { e.chiamate.push("preventDefault"); }, ...extra }; return e; };

/** L'apertura del tag che contiene `segno` (l'intero `<…>`), o `""`. */
function tag(html, segno, da = 0) {
  const i = html.indexOf(segno, da);
  if (i < 0) return "";
  return html.slice(html.lastIndexOf("<", i), html.indexOf(">", i) + 1);
}
const classi = (t) => (t.match(/\sclass="([^"]*)"/) ?? [])[1]?.split(/\s+/).filter(Boolean) ?? [];
const attr = (t, nome) => (t.match(new RegExp(`\\s${nome}="([^"]*)"`)) ?? [])[1];
const conta = (testo, ago) => (typeof ago === "string" ? testo.split(ago).length - 1 : (testo.match(ago) ?? []).length);
const solo = (html) => html.replace(/<[^>]*>/g, "");
/** Tutti i tag di apertura `<tipo …>` dell'html. */
const tutti = (html, tipo) => [...html.matchAll(new RegExp(`<${tipo}(?=[\\s>])[^>]*>`, "g"))].map((m) => m[0]);

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T86 · LA GALLERIA E LA LIGHTBOX DELLA SCHEDA (23/11/2026)");

  const fileGalleria = join(radice, "src/components/shop/scheda/GalleriaProdotto.tsx");
  const fileLightbox = join(radice, "src/components/shop/scheda/Lightbox.tsx");
  const ci = [existsSync(fileGalleria), existsSync(fileLightbox)];
  c("i due file esistono (GalleriaProdotto.tsx e Lightbox.tsx in components/shop/scheda)", [true, true], ci);
  if (ci.includes(false)) return;
  const srcG = readFileSync(fileGalleria, "utf8");
  const srcL = readFileSync(fileLightbox, "utf8");
  const tutto = srcG + "\n" + srcL;

  // ── i pezzi puri e i testi, dallo stesso impacchettamento dei componenti ──
  const dir = mkdtempSync(join(tmpdir(), "prova-t86-"));
  try {
    const calc = join(dir, "Calc.tsx");
    writeFileSync(
      calc,
      `import * as G from ${JSON.stringify(fileGalleria)};
       import * as L from ${JSON.stringify(fileLightbox)};
       import { ordinaGalleria } from "@/shop/cms/vetrina-galleria";
       import { TESTI_PROVVISORI, riempi } from "@/landing/testi-shop";
       import * as I from "@/shop/cms/vetrina-interazioni";
       import { renderToStaticMarkup } from "react-dom/server";
       export function Calc() { globalThis.__t86 = { G, L, ordinaGalleria, TESTI_PROVVISORI, riempi, I, renderToStaticMarkup }; return null; }`,
    );
    const FINTI = { "@radix-ui/react-dialog": RADIX };
    await rendiComponente(radice, calc, "Calc", {}, { finti: FINTI });
    const { ordinaGalleria, TESTI_PROVVISORI: P, riempi, I } = globalThis.__t86;
    const T = P.galleria;

    // ── i dati: sei diapositive (cinque foto + video) e le sue varianti ──
    const patch = D.PRODOTTI.find((p) => p.media.some((m) => m.slot === "video"));
    const SEI = ordinaGalleria(patch.media.filter((m) => m.slot !== "foto5"));
    const CINQUE = SEI.filter((d) => d.tipo === "foto");
    const UNA = ordinaGalleria(patch.media.filter((m) => m.slot === "principale"));
    const SOLO_VIDEO = ordinaGalleria(patch.media.filter((m) => m.slot === "video"));
    c("i dati della prova: sei diapositive (principale, scala, due foto, video: cinque foto e il video) e il video è l'ultima", [6, 5, "video"], [SEI.length, CINQUE.length, SEI[5].tipo]);

    const galleria = (diapositive, stato = {}) => rendiComponente(radice, fileGalleria, "GalleriaProdotto", { diapositive }, { finti: FINTI, ...stato });
    const lightbox = (props = {}) =>
      rendiComponente(radice, fileLightbox, "Lightbox", { aperto: true, onApertoChange() {}, foto: CINQUE, indice: 0, onVai() {}, onRendiFuoco() {}, ...props }, { finti: FINTI });

    // ═══ 1 · il disegno con sei diapositive ═══
    const sei = (await galleria(SEI)).html;
    const sezione = tag(sei, "<section");
    c("la galleria è una regione con nome e `aria-roledescription` (parole da testi-shop)", [T.carosello, T.etichetta], [attr(sezione, "aria-roledescription"), attr(sezione, "aria-label")]);
    const gruppi = tutti(sei, "div").filter((t) => attr(t, "role") === "group");
    c("sei diapositive: ognuna è un gruppo con `aria-roledescription` e «Foto n di 6»", [6, true, [1, 2, 3, 4, 5, 6].map((n) => riempi(T.numero, { n, m: 6 }))], [gruppi.length, gruppi.every((g) => attr(g, "aria-roledescription") === T.diapositiva), gruppi.map((g) => attr(g, "aria-label"))]);
    const scorritore = tag(sei, "snap-x");
    c("scorrimento nativo: `snap-x snap-mandatory`, `overflow-x-auto`, `scroll-smooth`, barra nascosta, ogni diapositiva `snap-center` a tutta larghezza", [true, true, true, true, 6, 6], [classi(scorritore).includes("snap-mandatory"), classi(scorritore).includes("overflow-x-auto"), classi(scorritore).includes("scroll-smooth"), /scrollbar/.test(scorritore), conta(sei, "snap-center"), gruppi.filter((g) => classi(g).includes("w-full") && classi(g).includes("shrink-0")).length]);
    c("il contatore è «1/6» ed è un `role=\"status\"` (lo annuncia a chi non vede)", true, /<p[^>]*role="status"[^>]*>1\/6<\/p>/.test(sei));

    // le foto: una sola `eager`
    // nell'ordine del documento: prima le sei miniature (colonna a sinistra sul computer), poi le sei foto della galleria
    const tutteImg = tutti(sei, "img");
    const miniatureImg = tutteImg.slice(0, 6);
    const img = tutteImg.slice(6);
    c("sei foto grandi e sei miniature; la PRIMA è `eager` con `fetchpriority=\"high\"`, TUTTE le altre (anche le miniature) `lazy`", [6, 6, 1, 1, 11], [img.length + (tutteImg.length - 12), miniatureImg.length, conta(tutteImg.join(), 'loading="eager"'), conta(tutteImg.join(), /fetchpriority="high"/gi), conta(tutteImg.join(), 'loading="lazy"')]);
    c("la foto grande ha `srcset` 480/960/1600 e `sizes` della galleria; width e height dichiarati", [true, true, true, true], [/srcset="[^"]*480w[^"]*960w[^"]*1600w/i.test(img[0]), /sizes="\(min-width: 1024px\) 50vw, 100vw"/.test(img[0]), /\swidth="\d+"/.test(img[0]), /\sheight="\d+"/.test(img[0])]);
    c("l'alt della foto è quello del CMS", CINQUE.map((d) => d.alt), CINQUE.map((d) => attr(img.find((i) => attr(i, "alt") === d.alt) ?? "", "alt")));
    const zoom = tutti(sei, "button").filter((t) => t.includes('data-diapositiva="0"'));
    c("ogni foto è un bottone «Ingrandisci la foto» (il nome gli viene da testi-shop, l'alt resta nel nome); il video no (ha il suo bottone)", [5, true], [conta(sei, `${T.ingrandisci}</span>`), zoom.length === 1 && attr(zoom[0], "aria-haspopup") === "dialog"]);
    const bottoniDiapositiva = tutti(sei, "button").filter((t) => /data-diapositiva=/.test(t));
    c("roving tabindex: solo la diapositiva corrente (la prima) è raggiungibile con Tab", [6, 1, 5, "0"], [bottoniDiapositiva.length, bottoniDiapositiva.filter((t) => attr(t, "tabindex") === "0").length, bottoniDiapositiva.filter((t) => attr(t, "tabindex") === "-1").length, attr(bottoniDiapositiva[0], "tabindex")]);

    // le frecce e le miniature
    const frecce = tutti(sei, "button").filter((t) => attr(t, "aria-label") === T.precedente || attr(t, "aria-label") === T.successiva);
    c("frecce: due, da 44 px (`h-11 w-11`), nascoste sotto i 768 px (`hidden md:inline-flex`), con il nome da testi-shop", [2, true, true], [frecce.length, frecce.every((f) => classi(f).includes("h-11") && classi(f).includes("w-11")), frecce.every((f) => classi(f).includes("hidden") && classi(f).includes("md:inline-flex"))]);
    c("alla prima foto la freccia indietro è `aria-disabled=\"true\"` e la avanti `\"false\"` (il fuoco non si perde: non è `disabled`)", [["true", "false"], false], [[attr(frecce[0], "aria-disabled"), attr(frecce[1], "aria-disabled")], frecce.some((f) => /\sdisabled(=|\s|>)/.test(f))]);
    const miniature = tutti(sei, "button").filter((t) => /data-miniatura=/.test(t));
    const elenco = tutti(sei, "ul").find((t) => classi(t).includes("lg:flex")) ?? "";
    c("miniature: sei bottoni, solo dal computer (`hidden lg:flex`), in colonna, quadrate da 96, con «Foto n di 6»; la corrente è `aria-current`", [6, true, true, true, ["true"]], [miniature.length, classi(elenco).includes("hidden") && classi(elenco).includes("lg:flex") && classi(elenco).includes("flex-col"), miniature.every((m) => classi(m).includes("h-24") && classi(m).includes("w-24")), miniature.map((m) => attr(m, "aria-label")).join() === [1, 2, 3, 4, 5, 6].map((n) => riempi(T.numero, { n, m: 6 })).join(), miniature.map((m) => attr(m, "aria-current")).filter(Boolean)]);

    // il video
    const bottoneVideo = tutti(sei, "button").filter((t) => t.includes('data-diapositiva="5"'));
    c("video: una diapositiva con la COPERTINA e il bottone «Guarda il video»; nessun `<video>` finché non si tocca (nessun scaricamento)", [true, 0, true], [sei.includes(`${T.guardaVideo}</span>`), conta(sei, "<video"), bottoneVideo.length === 1]);
    c("video: la copertina sta nella galleria con l'alt del video; la miniatura del video usa la stessa copertina", [true, true], [img.some((i) => attr(i, "src") === SEI[5].copertina && attr(i, "alt") === SEI[5].alt), tutteImg.filter((i) => attr(i, "src") === SEI[5].copertina).length === 2]);

    // ═══ 2 · una foto sola, due, nessuna, solo il video ═══
    const una = (await galleria(UNA)).html;
    c("UNA foto: nessuna freccia, nessun contatore, nessuna miniatura, nessun `aria-roledescription`", [0, 0, 0, 0], [conta(una, "data-miniatura"), conta(una, T.precedente) + conta(una, T.successiva), conta(una, /\d\/\d/g), conta(una, "aria-roledescription")]);
    c("UNA foto: la foto c'è ed è `eager`, si può ancora ingrandire", [1, 1, 1], [conta(una, "<img"), conta(una, 'loading="eager"'), conta(una, `${T.ingrandisci}</span>`)]);
    c("la regola «una foto = nessun controllo» è `controlliGalleria` di T105 (importata, non riscritta: nessun «> 1» nei due file)", [true, false, false], [/controlliGalleria/.test(srcG) && /controlliGalleria/.test(srcL), /(length|totale|\bn)\s*>\s*1\b/.test(tutto), I.controlliGalleria({ indice: 0, totale: 1 }).mostra]);
    c("nessuna diapositiva: la galleria non disegna niente (nessun riquadro vuoto)", "", (await galleria([])).html);
    c("`diapositive` mancante o null: niente, non lancia", ["", ""], [(await galleria(undefined)).html, (await galleria(null)).html]);
    const soloVideo = (await galleria(SOLO_VIDEO)).html;
    c("solo il video (una diapositiva): copertina `eager` e bottone «Guarda il video»; nessun controllo", [true, 1, 0, 0], [soloVideo.includes(`${T.guardaVideo}</span>`), conta(soloVideo, 'loading="eager"'), conta(soloVideo, "data-miniatura"), conta(soloVideo, "aria-roledescription")]);


    // ═══ 3 · la lightbox disegnata (Radix finto) ═══
    const apertaLb = await lightbox();
    const lb = apertaLb.html;
    /** Il contatore della lightbox (quello della galleria sta prima, fuori dal `Content`). */
    const ctLb = (h) => (h.slice(Math.max(h.indexOf('data-radix="Content"'), 0)).match(/<p[^>]*role="status"[^>]*>([^<]*)<\/p>/) ?? [])[1];
    c("lightbox aperta: titolo (non si vede), bottone di chiusura da 44 px con il nome da testi-shop, contatore «1/5»", [T.titoloLightbox, true, "1/5"], [(lb.match(/<h2[^>]*>([^<]*)<\/h2>/) ?? [])[1], classi(tag(lb, `aria-label="${T.chiudi}"`)).includes("h-11") && classi(tag(lb, `aria-label="${T.chiudi}"`)).includes("w-11"), ctLb(lb)]);
    const imgLb = tutti(lb, "img");
    c("lightbox: UNA foto grande, la prima del giro, `eager`, con `srcset` fino a 1600 e `sizes` a tutta larghezza", [1, CINQUE[0].alt, true, true, true], [imgLb.length, attr(imgLb[0], "alt"), /1600w/.test(imgLb[0]), /sizes="100vw"/.test(imgLb[0]), /loading="eager"/.test(imgLb[0])]);
    c("lightbox: lo zoom con le dita è del browser (`touch-action: pinch-zoom`), nessun codice di zoom", [true, false], [/\[touch-action:pinch-zoom\]/.test(lb), /gesture|wheel|transform:\s*scale|useGesture/i.test(srcL)]);
    c("lightbox: due frecce con i nomi di testi-shop, la «indietro» `aria-disabled` alla prima", [[T.precedente, T.successiva], "true", "false"], [[attr(tag(lb, `aria-label="${T.precedente}"`), "aria-label"), attr(tag(lb, `aria-label="${T.successiva}"`), "aria-label")], attr(tag(lb, `aria-label="${T.precedente}"`), "aria-disabled"), attr(tag(lb, `aria-label="${T.successiva}"`), "aria-disabled")]);
    const ultima = (await lightbox({ indice: 4 })).html;
    c("lightbox all'ultima foto: contatore «5/5», la «avanti» `aria-disabled`, la «indietro» no", ["5/5", "true", "false"], [ctLb(ultima), attr(tag(ultima, `aria-label="${T.successiva}"`), "aria-disabled"), attr(tag(ultima, `aria-label="${T.precedente}"`), "aria-disabled")]);
    c("lightbox: un indice fuori campo si porta dentro (99 → ultima, -3 → prima)", ["5/5", "1/5"], [ctLb((await lightbox({ indice: 99 })).html), ctLb((await lightbox({ indice: -3 })).html)]);
    const unaLb = (await lightbox({ foto: [CINQUE[0]] })).html;
    c("lightbox con UNA foto: la foto e la chiusura; nessuna freccia, nessun contatore", [1, 1, 0, 0], [conta(unaLb, "<img"), conta(unaLb, `aria-label="${T.chiudi}"`), conta(unaLb, T.precedente) + conta(unaLb, T.successiva), ctLb(unaLb) ?? 0]);
    c("lightbox chiusa, senza foto o senza elenco: niente", ["", "", ""], [(await lightbox({ aperto: false })).html, (await lightbox({ foto: [] })).html, (await lightbox({ foto: undefined })).html]);
    // i gestori della lightbox: tasti e fuoco
    {
      const vai = []; let fuoco = 0;
      const L = await lightbox({ onVai: (x) => vai.push(x), onRendiFuoco: () => fuoco++ });
      const contenuto = L.pagina.radix.find((x) => x.nome === "Content").props;
      const tasto = (key) => { const e = evento({ key }); contenuto.onKeyDown(e); return e.chiamate; };
      c("lightbox, tastiera: frecce, Home e End vanno alla galleria (`avanti`, `indietro`, `primo`, `ultimo`) e non scorrono la pagina", [["avanti", "indietro", "primo", "ultimo"], [["preventDefault"], ["preventDefault"], ["preventDefault"], ["preventDefault"]]], [(() => { const r = ["ArrowRight", "ArrowLeft", "Home", "End"].map(tasto); return [vai.slice(), r]; })()[0], ["ArrowRight", "ArrowLeft", "Home", "End"].map(tasto)]);
      c("lightbox, tastiera: un altro tasto (lettera, Tab, Esc) non è suo (Esc lo gestisce Radix)", [[], [], []], [tasto("a"), tasto("Tab"), tasto("Escape")]);
      const pronto = evento();
      contenuto.onCloseAutoFocus(pronto);
      c("lightbox: alla chiusura impedisce a Radix di spostare il fuoco e lo restituisce a chi la possiede (`onRendiFuoco`)", [["preventDefault"], 1], [pronto.chiamate, fuoco]);
      const freccia = (nome) => L.pagina.gestori.find((g) => g.tipo === "button" && g.props["aria-label"] === nome)?.props.onClick;
      vai.length = 0;
      freccia(T.successiva)(); freccia(T.precedente)();
      c("lightbox: le frecce a schermo mandano `avanti` e `indietro` (sul telefono non ci sono i tasti)", ["avanti", "indietro"], vai);
      c("lightbox: Radix gestisce Esc e il fuoco intrappolato, il file chiede la chiusura con `onApertoChange` (finestra modale, titolo senza descrizione)", [true, true], [typeof L.pagina.radix.find((x) => x.nome === "Root").props.onOpenChange === "function", L.pagina.radix.find((x) => x.nome === "Content").props["aria-describedby"] === undefined && L.pagina.radix.some((x) => x.nome === "Title")]);
    }

    // ═══ 4 · il sorgente ═══
    const codice = (src) => src.split("\n").filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r)).join("\n");
    c("lazy: la galleria carica `Lightbox` con `lazy(() => import(...))` e NON importa Radix (Radix non pesa sulla prima pagina)", [true, false, true], [/lazy\(\(\) => import\("\.\/Lightbox"\)\)/.test(srcG), /@radix-ui/.test(srcG), /@radix-ui\/react-dialog/.test(srcL)]);
    c("lazy: `Lightbox` ha un'esportazione di default (serve a `lazy`) e la galleria non la importa in modo statico", [true, false], [/export default Lightbox/.test(srcL), /^import[^\n]*["']\.\/Lightbox["']/m.test(srcG)]);
    c("nessuna frase scritta nei file: niente testo tra i tag, niente `aria-label`/`alt`/`title` con una stringa", [[], []], [
      codice(tutto).split("\n").filter((r) => />\s*[A-Za-zÀ-ÿ][^<>{}=]*</.test(r) && !/\b(Array|Promise|Record|Partial|Omit|Pick|useRef|useState|ReturnType|HTMLElement|KeyboardEvent|UIEvent)</.test(r)),
      codice(tutto).split("\n").filter((r) => /(aria-label|alt|title|aria-roledescription)="[^"]/.test(r)),
    ]);
    c("nessun «da confermare» e nessun segnaposto `{{` nei due file, commenti compresi", [false, false], [/da confermare/i.test(tutto), /\{\{/.test(tutto)]);
    c("nessun timer (`setTimeout`, `setInterval`, `Date.now`) e nessun effetto (`useEffect`): ogni stato cambia da un gesto, e il banco lo prova", [false, false], [/setTimeout|setInterval|Date\.now/.test(codice(tutto)), /useEffect|useLayoutEffect/.test(codice(tutto))]);
    c("stile: niente ombre, sfocature, gradienti, animazioni proprie; nessun HTML iniettato; lucide importata una per una", [false, false, false, true], [/shadow-|backdrop-|gradient|animate-/.test(tutto), /dangerouslySetInnerHTML/.test(tutto), /from "lucide-react"/.test(tutto) && /import \*/.test(tutto.match(/import[^\n]*lucide-react[^\n]*/g)?.join("") ?? ""), /import \{[^}]*\} from "lucide-react"/.test(srcG)]);
    c("le foto passano tutte da `FotoShop` (nessun `<img` scritto a mano)", [true, false], [/FotoShop/.test(srcG) && /FotoShop/.test(srcL), /<img\b/.test(codice(tutto))]);
    c("il fuoco è visibile: ogni controllo ha `shop-anello` (o la variante per fondi scuri)", true, tutti(sei, "button").every((t) => /shop-anello/.test(t)));

    // ═══ 5 · il banco: tasti, scorrimento, frecce, miniature, video, lightbox ═══
    const reale = requireQui.resolve("react", { paths: [radice] });
    const calcB = join(dir, "CalcB.tsx");
    writeFileSync(
      calcB,
      `import { GalleriaProdotto } from ${JSON.stringify(fileGalleria)};
       import { renderToStaticMarkup } from "react-dom/server";
       export function CalcB() { globalThis.__t86b = { GalleriaProdotto, renderToStaticMarkup }; return null; }`,
    );
    const nuovo = async (diapositive) => {
      const banco = {};
      await rendiComponente(radice, calcB, "CalcB", {}, { finti: { ...FINTI, react: reactFinto(reale) }, banco });
      const { GalleriaProdotto, renderToStaticMarkup } = globalThis.__t86b;
      return inizializza(banco, GalleriaProdotto, { diapositive }, { renderToStaticMarkup });
    };
    const contatore = (h) => (h.match(/<p[^>]*role="status"[^>]*>(\d\/\d)<\/p>/) ?? [])[1];
    const per = (g, domanda) => trova(g.el, domanda)[0];
    const scorr = (g) => per(g, (e) => e.props["data-scorritore"] !== undefined);
    const bottone = (g, etichetta) => per(g, (e) => e.type === "button" && e.props["aria-label"] === etichetta);
    const miniatura = (g, i) => per(g, (e) => e.props["data-miniatura"] === i);
    const diapositivaBtn = (g, i) => per(g, (e) => e.props["data-diapositiva"] === i);
    const tasto = (g, key, extra = {}) => { const e = evento({ key, target: { tagName: "DIV" }, ...extra }); g.agisci(() => scorr(g).props.onKeyDown(e)); return e.chiamate; };

    const g = await nuovo(SEI);
    c("banco: parte alla prima foto (contatore «1/6»), la lightbox non è stata chiesta e Radix non è caricato", ["1/6", 0, 0], [contatore(g.html()), g.caricati, g.radix("Root").length]);
    c("tastiera: freccia destra → «2/6», il browser non scorre la pagina, la galleria scorre di UNA larghezza e il fuoco segue alla nuova foto (senza far scorrere)", [["preventDefault"], "2/6", ["scrollTo", "scorritore", { left: 400 }], ["focus", "diapositiva-1", { preventScroll: true }]], [tasto(g, "ArrowRight"), contatore(g.html()), g.log.findLast((x) => x[0] === "scrollTo"), g.log.findLast((x) => x[0] === "focus")]);
    c("tastiera: la nuova foto è l'unica raggiungibile con Tab (roving)", [["-1", "0", "-1", "-1", "-1", "-1"]], [[0, 1, 2, 3, 4, 5].map((i) => attr(tag(g.html(), `data-diapositiva="${i}"`), "tabindex"))]);
    tasto(g, "End");
    c("tastiera: Fine → ultima («6/6»); freccia destra all'ultima resta lì (ai bordi si ferma, non gira)", ["6/6", "6/6"], [contatore(g.html()), (tasto(g, "ArrowRight"), contatore(g.html()))]);
    c("tastiera: Inizio → prima («1/6»), freccia sinistra alla prima resta lì", ["1/6", "1/6"], [(tasto(g, "Home"), contatore(g.html())), (tasto(g, "ArrowLeft"), contatore(g.html()))]);
    c("tastiera: un tasto che non è suo (lettera, Esc, Tab) non fa niente e non viene fermato", [[], [], [], "1/6"], [tasto(g, "a"), tasto(g, "Escape"), tasto(g, "Tab"), contatore(g.html())]);
    c("tastiera: sul video che parte (tasti del lettore) la galleria non ruba le frecce", [[], "1/6"], [tasto(g, "ArrowRight", { target: { tagName: "VIDEO" } }), contatore(g.html())]);
    // scorrimento col dito
    const scorri = (scrollLeft, clientWidth = 400) => g.agisci(() => scorr(g).props.onScroll({ currentTarget: { scrollLeft, clientWidth } }));
    scorri(800);
    c("scorrimento col dito: a 800 px su 400 → terza foto («3/6»)", "3/6", contatore(g.html()));
    scorri(610);
    c("scorrimento: si va alla foto più vicina (610/400 = 1,5 → «3/6»; 590 → «2/6»)", ["3/6", "2/6"], [contatore(g.html()), (scorri(590), contatore(g.html()))]);
    scorri(99999);
    c("scorrimento: oltre l'ultima o prima della prima si ferma ai bordi («6/6», «1/6»)", ["6/6", "1/6"], [contatore(g.html()), (scorri(-80), contatore(g.html()))]);
    scorri(800);
    scorri(0, 0);
    c("scorrimento: una larghezza zero (galleria nascosta) non cambia niente", "3/6", contatore(g.html()));
    // frecce a schermo
    g.agisci(() => bottone(g, T.successiva).props.onClick());
    c("freccia «foto successiva» → «4/6» e la galleria scorre fin lì", ["4/6", ["scrollTo", "scorritore", { left: 1200 }]], [contatore(g.html()), g.log.findLast((x) => x[0] === "scrollTo")]);
    c("…e la «indietro» non è più `aria-disabled`; all'ultima è la «avanti» ad esserlo (e il clic non esce dai bordi)", ["false", "true", "6/6"], [attr(tag(g.html(), `aria-label="${T.precedente}"`), "aria-disabled"), (g.agisci(() => bottone(g, T.successiva).props.onClick()), g.agisci(() => bottone(g, T.successiva).props.onClick()), attr(tag(g.html(), `aria-label="${T.successiva}"`), "aria-disabled")), (g.agisci(() => bottone(g, T.successiva).props.onClick()), contatore(g.html()))]);
    // miniature
    g.agisci(() => miniatura(g, 1).props.onClick());
    const hm = g.html();
    c("miniatura 2 → «2/6», sola `aria-current` e scorrimento a 400", ["2/6", ["1"], ["scrollTo", "scorritore", { left: 400 }]], [contatore(hm), [...hm.matchAll(/data-miniatura="(\d)"[^>]*aria-current="true"|aria-current="true"[^>]*data-miniatura="(\d)"/g)].map((m) => m[1] ?? m[2]), g.log.findLast((x) => x[0] === "scrollTo")]);

    // il video
    c("video: finché non si tocca niente `<video>`; la trascrizione c'è solo sulla diapositiva del video", [0, 0], [conta(g.html(), "<video"), conta(g.html(), "<details")]);
    g.agisci(() => miniatura(g, 5).props.onClick());
    const hv = g.html();
    c("sulla diapositiva del video compare «Leggi il testo del video» (da testi-shop) con il testo parlato", [1, true, true], [conta(hv, "<details"), hv.includes(`>${P.scheda.trascrizione}<`), hv.includes(SEI[5].testoParlato)]);
    g.agisci(() => diapositivaBtn(g, 5).props.onClick());
    const hp = g.html();
    const video = per(g, (e) => e.type === "video");
    c("tocco sul video: parte il VIDEO (file, copertina, comandi, senza schermo intero forzato), il bottone della copertina sparisce, nessuna lightbox", [true, true, true, true, true, 0, 0, 0], [video?.props.src === SEI[5].video, video?.props.poster === SEI[5].copertina, video?.props.controls === true, video?.props.playsInline === true, (video.props.ref(g.nodo("video")), g.log.some((x) => x[0] === "focus" && x[1] === "video")), conta(hp, `${T.guardaVideo}</span>`), g.radix("Root").length, conta(hp, 'role="dialog"')]);
    c("il video che suona continua se si scorre un poco senza cambiare foto, e si ferma (torna la copertina) passando a un'altra foto", [1, 0, 1], [(g.agisci(() => scorr(g).props.onScroll({ currentTarget: { scrollLeft: 2050, clientWidth: 400 } })), conta(g.html(), "<video")), (g.agisci(() => scorr(g).props.onScroll({ currentTarget: { scrollLeft: 1600, clientWidth: 400 } })), conta(g.html(), "<video")), conta(g.html(), `${T.guardaVideo}</span>`)]);
    c("video: `muted` segue il dato del CMS (`muto`)", [SEI[5].muto, true], [video?.props.muted, (await (async () => { const m = await nuovo([{ ...SEI[5], muto: true }]); m.agisci(() => diapositivaBtn(m, 0).props.onClick()); return per(m, (e) => e.type === "video")?.props.muted; })())]);

    // la lightbox: apertura in ritardo, giro, chiusura, fuoco
    const h = await nuovo(SEI);
    h.html();
    c("lightbox in ritardo: prima del primo tocco il modulo NON è stato chiesto", 0, h.caricati);
    h.agisci(() => diapositivaBtn(h, 2).props.onClick());
    h.html();
    await h.attendi();
    const aperta = h.html();
    c("tocco sulla terza foto: il modulo arriva (una volta), la lightbox è aperta su «3/5» con la foto giusta", [1, true, "3/5", true], [h.caricati, h.radix("Root").at(-1)?.open, ctLb(aperta), aperta.includes(`alt="${CINQUE[2].alt}"`)]);
    const contenuto = () => h.radix("Content").at(-1);
    h.agisci(() => contenuto().onKeyDown(evento({ key: "ArrowRight" })));
    c("in lightbox: freccia destra → «4/5»", "4/5", ctLb(h.html()));
    h.agisci(() => h.radix("Content").at(-1).onKeyDown(evento({ key: "End" })));
    c("in lightbox: Fine → «5/5»; ancora avanti resta lì (si ferma ai bordi)", ["5/5", "5/5"], [ctLb(h.html()), (h.agisci(() => h.radix("Content").at(-1).onKeyDown(evento({ key: "ArrowRight" }))), ctLb(h.html()))]);
    const chiudi = h.radix("Content").at(-1);
    h.agisci(() => h.radix("Root").at(-1).onOpenChange(false));
    const dopo = h.html();
    c("Esc / X / tocco fuori (Radix chiama `onApertoChange(false)`): la lightbox si chiude", [0, 0], [conta(dopo, 'data-radix="Content"'), h.radix("Content").length]);
    const prontoLb = evento();
    chiudi.onCloseAutoFocus(prontoLb);
    h.agisci(() => {});
    c("fuoco restituito: la galleria si riallinea alla foto vista in lightbox (la quinta, «5/6») e il fuoco va alla SUA diapositiva, senza far scorrere", [["preventDefault"], "5/6", ["scrollTo", "scorritore", { left: 1600 }], ["focus", "diapositiva-4", { preventScroll: true }]], [prontoLb.chiamate, contatore(h.html()), h.log.findLast((x) => x[0] === "scrollTo"), h.log.findLast((x) => x[0] === "focus")]);
    // aprire e chiudere senza muoversi: il fuoco torna ALLA diapositiva da cui si è partiti
    const k = await nuovo(SEI);
    k.html();
    k.agisci(() => diapositivaBtn(k, 1).props.onClick());
    k.html(); await k.attendi(); k.html();
    const chiudiK = k.radix("Content").at(-1);
    k.agisci(() => k.radix("Root").at(-1).onOpenChange(false));
    k.agisci(() => chiudiK.onCloseAutoFocus(evento()));
    c("lightbox aperta dalla seconda foto e chiusa subito: il fuoco torna alla seconda diapositiva (la galleria sta a «2/6»)", [["focus", "diapositiva-1", { preventScroll: true }], "2/6"], [k.log.findLast((x) => x[0] === "focus"), contatore(k.html())]);
    k.agisci(() => k.radix("Root").at(-1).onOpenChange(true));
    c("`onApertoChange(true)` da Radix non apre né chiude niente (apre solo il tocco sulla foto)", 0, conta(k.html(), 'data-radix="Content"'));
    // Radix che dice «aperto» mentre è aperta non la chiude
    {
      const a = await nuovo(SEI);
      a.html(); a.agisci(() => diapositivaBtn(a, 0).props.onClick()); a.html(); await a.attendi(); a.html();
      a.agisci(() => a.radix("Root").at(-1).onOpenChange(true));
      c("con la lightbox aperta, `onApertoChange(true)` da Radix non la chiude", true, a.radix("Root").at(-1).open);
    }
    // un video davanti alle foto (l'ordine normale lo mette in fondo, ma il componente non ci conta): l'indice della lightbox è fra le sole foto
    {
      const v = await nuovo([SEI[5], SEI[0], SEI[1]]);
      v.html(); v.agisci(() => diapositivaBtn(v, 2).props.onClick()); v.html(); await v.attendi();
      const hv2 = v.html();
      c("video in testa: la seconda FOTO (terza diapositiva) si apre come «2/2», con la sua foto", ["2/2", true], [ctLb(hv2), hv2.includes(`alt="${SEI[1].alt}"`)]);
      const cont = v.radix("Content").at(-1);
      v.agisci(() => v.radix("Root").at(-1).onOpenChange(false));
      v.agisci(() => cont.onCloseAutoFocus(evento()));
      c("…e chiusa, il fuoco torna alla diapositiva giusta (la terza, non la seconda)", ["focus", "diapositiva-2", { preventScroll: true }], v.log.findLast((x) => x[0] === "focus"));
    }
    // una foto sola: nessun tasto
    const u = await nuovo(UNA);
    c("una foto sola, tastiera: nessun tasto è suo (nessun «preventDefault»)", [[], []], [tasto(u, "ArrowRight"), tasto(u, "End")]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
