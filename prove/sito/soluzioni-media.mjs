/** ── PROVA S2 · CARATTERI, CSS DEL TEMA, MEDIA, FOOTER MINIMO ─────────────
 *  `node prove/sito/soluzioni-media.mjs`. Sul codice vero (esbuild, come le altre prove).
 *   S2.0  i file dei caratteri e la loro licenza, nessun servizio esterno, il CSS del tema:
 *         ogni regola nuova sta sotto `.tema-soluzioni`, i contrasti della 4.1 tornano,
 *         il testo del bottone blu è sempre blu notte, il movimento si spegne.
 *   S2.1  Foto, VideoParlato, ClipLoop (sorgente e disegno).
 *   S2.2  Footer: quello di oggi identico alla fotografia G1, e la variante `minimo`.
 *  ───────────────────────────────────────────────────────────────────────── */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { carica, leggi, nuovaProva, radice } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("soluzioni-media");
const richiedi = createRequire(join(radice, "package.json"));

/* ── S2.0 · I caratteri sono nostri ────────────────────────────────────── */
const FONT = {
  anton: ["anton-latin-400-normal.woff2", "anton-latin-ext-400-normal.woff2"],
  "inter-tight": ["inter-tight-latin-wght-normal.woff2", "inter-tight-latin-ext-wght-normal.woff2"],
};
for (const [famiglia, file] of Object.entries(FONT)) {
  const cartella = join(radice, "public/fonts", famiglia, "5.3.0");
  vero(`${famiglia}: la licenza OFL c'è`, existsSync(join(cartella, "LICENSE")) && /SIL OPEN FONT LICENSE/i.test(readFileSync(join(cartella, "LICENSE"), "utf8")));
  for (const f of file) {
    const p = join(cartella, f);
    vero(`${famiglia}/${f}: è un woff2 vero`, existsSync(p) && readFileSync(p).subarray(0, 4).toString("latin1") === "wOF2");
  }
}
//  Gli stessi byte della versione 5.3.0 dei pacchetti @fontsource (verificato con `npm pack`, vedi il commit).
const SHA = {
  "anton/5.3.0/anton-latin-400-normal.woff2": "d0fa07ff63dd60cbc0e2f58e29c802dca2a5ae0276c999f59c6111ab7bbaec3b",
  "inter-tight/5.3.0/inter-tight-latin-wght-normal.woff2": "77fefe8ca19b9f69b5284832c519e0493127c1f091f0a8936884be7721c4e618",
};
for (const [p, sha] of Object.entries(SHA)) {
  c(`sha256 di ${p}`, sha, createHash("sha256").update(readFileSync(join(radice, "public/fonts", p))).digest("hex"));
}
vero("Instrument Serif non è nel progetto", !existsSync(join(radice, "public/fonts/instrument-serif")));

/** Tutti i file di testo sotto una cartella (i binari si saltano). */
function filiDiTesto(cartella) {
  const fuori = [];
  for (const nome of readdirSync(cartella)) {
    const p = join(cartella, nome);
    if (statSync(p).isDirectory()) fuori.push(...filiDiTesto(p));
    else if (!/\.(woff2?|png|jpe?g|webp|gif|ico|mp4|webm|pdf)$/i.test(nome)) fuori.push(p);
  }
  return fuori;
}
for (const cartella of ["src", "public"]) {
  const tutti = filiDiTesto(join(radice, cartella)).map((p) => [relative(radice, p), readFileSync(p, "utf8")]);
  vero(`${cartella}: nessun fonts.googleapis né gstatic`, tutti.every(([, t]) => !/fonts\.googleapis|fonts\.gstatic|gstatic\.com\/s\//i.test(t)));
}

/* ── S2.0 · Il CSS del tema ────────────────────────────────────────────── */
const css = leggi("src/styles.css");
const INIZIO = "/* ═══ LANDING «TRE SOLUZIONI»";
const posizione = css.indexOf(INIZIO);
vero("styles.css: il blocco della landing v3 c'è, in fondo", posizione > 0);
const blocco = css.slice(posizione);
const prima = css.slice(0, posizione);

//  Solo aggiunte: tutto quello che c'era a d42e5d9 è rimasto, byte per byte, e viene prima.
try {
  const vecchio = execFileSync("git", ["show", "d42e5d9:src/styles.css"], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  vero("styles.css: il file di d42e5d9 è intatto (solo aggiunte in fondo)", prima.startsWith(vecchio));
} catch {
  console.log("  (git non risponde: confronto con d42e5d9 saltato)");
}

/** Divide il CSS in regole di primo livello `{ testa, corpo }`, senza commenti. */
function regole(testo) {
  const t = testo.replace(/\/\*[\s\S]*?\*\//g, "");
  const fuori = [];
  let i = 0;
  while (i < t.length) {
    const a = t.indexOf("{", i);
    if (a < 0) break;
    let livello = 1;
    let j = a + 1;
    while (j < t.length && livello) {
      if (t[j] === "{") livello++;
      else if (t[j] === "}") livello--;
      j++;
    }
    fuori.push({ testa: t.slice(i, a).trim(), corpo: t.slice(a + 1, j - 1) });
    i = j;
  }
  return fuori;
}
//  Le regole stanno in `@layer components` (sotto le utility di Tailwind): si guarda dentro il layer.
const alto = regole(blocco);
vero("le regole del tema stanno in @layer components, sotto le utility", alto.some((r) => r.testa === "@layer components"));
const primoLivello = alto.flatMap((r) => (r.testa === "@layer components" ? regole(r.corpo) : [r]));
vero("il blocco ha delle regole", primoLivello.length > 20);

const brutte = [];
function controlla(r, dentroMedia) {
  if (r.testa.startsWith("@font-face") || r.testa.startsWith("@keyframes")) return;
  if (/^@(media|supports)/.test(r.testa) && !dentroMedia) {
    regole(r.corpo).forEach((x) => controlla(x, true));
    return;
  }
  const selettori = r.testa.split(",").map((s) => s.trim());
  for (const s of selettori) if (!s.startsWith(".tema-soluzioni")) brutte.push(s);
}
primoLivello.forEach((r) => controlla(r, false));
c("ogni regola nuova inizia con .tema-soluzioni (o è @font-face / @keyframes)", [], brutte);

const faces = primoLivello.filter((r) => r.testa.startsWith("@font-face"));
const famiglie = faces.map((f) => /font-family:\s*"([^"]+)"/.exec(f.corpo)?.[1]);
vero("@font-face: AntonHGL e InterTightHGL (latin e latin-ext)", famiglie.filter((f) => f === "AntonHGL").length === 2 && famiglie.filter((f) => f === "InterTightHGL").length === 2);
vero("@font-face: nessun instrument", faces.every((f) => !/instrument/i.test(f.corpo)));
vero("@font-face: tutti font-display swap", faces.every((f) => /font-display:\s*swap/.test(f.corpo)));
const ripieghi = faces.filter((f) => /font-family:\s*"[^"]*Ripiego"/.test(f.corpo));
vero("@font-face: ci sono i ripieghi e hanno size-adjust", ripieghi.length >= 2 && ripieghi.every((f) => /size-adjust:\s*[\d.]+%/.test(f.corpo) && /src:\s*local\(/.test(f.corpo)));
vero("@font-face: i file puntano ai nostri woff2", faces.filter((f) => /woff2/.test(f.corpo)).every((f) => /url\("\/fonts\/(anton|inter-tight)\/5\.3\.0\/[a-z0-9-]+\.woff2"\)/.test(f.corpo)));

/** Le dichiarazioni di una regola, in un oggetto (l'ultima vince). */
function dichiarazioni(corpo) {
  const o = {};
  for (const m of corpo.matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)) o[m[1]] = m[2].trim();
  return o;
}
const tema = primoLivello.find((r) => r.testa === ".tema-soluzioni");
vero("regola .tema-soluzioni c'è", !!tema);
const T = dichiarazioni(tema?.corpo ?? "");

const TOKEN = {
  "--hgl-notte": "#0A1430",
  "--hgl-elettrico": "#0F90FE",
  "--hgl-titoli": "#5CB6FF",
  "--hgl-chiaro": "#EEF2FF",
  "--hgl-carta": "#FFFFFF",
  "--hgl-dettagli": "#C9D6FF",
  "--hgl-elettrico-su-chiaro": "#0B5FB0",
  "--hgl-notte-barra": "#111C3D",
};
for (const [k, v] of Object.entries(TOKEN)) c(`token ${k}`, v, T[k]?.toUpperCase());

/* Contrasti, formula WCAG 2.2: i numeri della tabella 4.1 */
function luce(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrasto(a, b) {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}
const N = TOKEN["--hgl-notte"], E = TOKEN["--hgl-elettrico"], K = TOKEN["--hgl-chiaro"], S = TOKEN["--hgl-elettrico-su-chiaro"];
c("bianco su notte 18,17", 18.17, contrasto("#FFFFFF", N));
c("dettagli su notte 12,59", 12.59, contrasto(TOKEN["--hgl-dettagli"], N));
c("titoli su notte 8,30", 8.3, contrasto(TOKEN["--hgl-titoli"], N));
c("notte su elettrico 5,57 (testo del bottone blu)", 5.57, contrasto(N, E));
c("notte su chiaro 16,25", 16.25, contrasto(N, K));
c("su-chiaro su chiaro 5,73", 5.73, contrasto(S, K));
c("elettrico su chiaro 2,92: vietato per testo", 2.92, contrasto(E, K));
c("bianco su barra 16,70", 16.7, contrasto("#FFFFFF", TOKEN["--hgl-notte-barra"]));
vero("bianco su elettrico resta sotto 4,5 (per questo è vietato)", contrasto("#FFFFFF", E) < 4.5);

/* Il bottone blu: testo sempre blu notte su blu; sul chiaro bordo 1 px su-chiaro */
const regola = (testa) => primoLivello.concat(primoLivello.flatMap((r) => (/^@media/.test(r.testa) ? regole(r.corpo) : []))).filter((r) => r.testa.split(",").map((s) => s.trim()).includes(testa));
const P = dichiarazioni(regola(".tema-soluzioni .sol-btn-primario")[0]?.corpo ?? "");
c("primario: sfondo elettrico", "var(--hgl-elettrico)", P.background);
c("primario: testo blu notte", "var(--hgl-notte)", P.color);
c("primario: altezza 56", "56px", P["min-height"]);
c("primario: raggio 8", "8px", P["border-radius"]);
c("primario: peso 600", "600", P["font-weight"]);
c("primario: 100% su telefono", "100%", P.width);
c("primario sul chiaro: bordo su-chiaro", "1px solid var(--hgl-elettrico-su-chiaro)", dichiarazioni(regola(".tema-soluzioni .sol-fondo-chiaro .sol-btn-primario")[0]?.corpo ?? "").border);
c("primario: hover titoli", "var(--hgl-titoli)", dichiarazioni(regola(".tema-soluzioni .sol-btn-primario:hover")[0]?.corpo ?? "").background);
c("primario: sul computer 360", "360px", dichiarazioni(primoLivello.filter((r) => /^@media \(min-width:\s*1024px\)/.test(r.testa)).flatMap((r) => regole(r.corpo)).find((r) => r.testa === ".tema-soluzioni .sol-btn-primario")?.corpo ?? "").width);
//  Mai colore bianco sul fondo blu, e il blu elettrico mai come colore di testo.
vero("nessuna regola mette il testo bianco sul blu elettrico", ![...blocco.matchAll(/\{([^{}]*)\}/g)].some(([, d]) => /background(-color)?:\s*var\(--hgl-elettrico\)/.test(d) && /(^|[;\s])color:\s*(#fff|#ffffff|white|var\(--hgl-carta\))/i.test(d)));
vero("il blu elettrico non è mai un colore di testo", !/(^|[;{\s])color:\s*(var\(--hgl-elettrico\)|#0F90FE)/i.test(blocco));
vero("niente #FF3B3B nel tema", !/#FF3B3B/i.test(blocco));

const C = dichiarazioni(regola(".tema-soluzioni .sol-btn-contorno")[0]?.corpo ?? "");
c("contorno: bordo 1,5 px dettagli", "1.5px solid var(--hgl-dettagli)", C.border);
c("contorno: testo bianco", "var(--hgl-carta)", C.color);
c("contorno: fondo trasparente", "transparent", C.background);
c("contorno: alto 40 (44 di tocco)", "40px", C["min-height"]);
c("contorno: raggio 8", "8px", C["border-radius"]);
vero("contorno: area di tocco a 44 (::before)", /inset:\s*-2px 0/.test(regola(".tema-soluzioni .sol-btn-contorno::before")[0]?.corpo ?? ""));
vero("contorno: l'icona ruota di 45° da aperto", /rotate\(45deg\)/.test(regola('.tema-soluzioni .sol-btn-contorno[aria-expanded="true"] .sol-btn-icona')[0]?.corpo ?? ""));
const L = dichiarazioni(regola(".tema-soluzioni .sol-link")[0]?.corpo ?? "");
c("link: peso 600", "600", L["font-weight"]);
c("link: sottolineatura 2 px a 4 px", ["2px", "4px"], [L["text-decoration-thickness"], L["text-underline-offset"]]);
c("link: area di tocco 44", "44px", L["min-height"]);
c("link: sottolineatura titoli su notte", "var(--hgl-titoli)", L["text-decoration-color"]);
c("link sul chiaro: sottolineatura su-chiaro", "var(--hgl-elettrico-su-chiaro)", dichiarazioni(regola(".tema-soluzioni .sol-fondo-chiaro .sol-link")[0]?.corpo ?? "")["text-decoration-color"]);

/* Fuoco: anello 2 px a 2 px, bianco su notte, blu notte su chiaro */
const F = dichiarazioni(regola(".tema-soluzioni :focus-visible")[0]?.corpo ?? "");
c("fuoco: 2 px, distanza 2 px", ["2px solid var(--sol-fuoco)", "2px"], [F.outline, F["outline-offset"]]);
c("fuoco: bianco di base", "var(--hgl-carta)", T["--sol-fuoco"]);
c("fuoco: blu notte sul chiaro", "var(--hgl-notte)", dichiarazioni(regola(".tema-soluzioni .sol-fondo-chiaro")[0]?.corpo ?? "")["--sol-fuoco"]);

/* Fondi con la griglia da 72 px */
for (const f of ["notte", "chiaro"]) {
  const d = dichiarazioni(regola(`.tema-soluzioni .sol-fondo-${f}`)[0]?.corpo ?? "");
  c(`fondo ${f}: griglia 72 px`, "72px 72px", d["background-size"]);
  vero(`fondo ${f}: colore del token`, d["background-color"] === (f === "notte" ? "var(--hgl-notte)" : "var(--hgl-chiaro)"));
}

/* Scala tipografica 390 / 1440 */
const TIPO = {
  ".sol-h1": ["AntonHGL", "2rem", "4rem", "1"],
  ".sol-h2-nome": ["AntonHGL", "1.375rem", "2rem", null],
  ".sol-h2-spiegazione": ["AntonHGL", "1.75rem", "2.75rem", null],
};
for (const [k, [carattere, min, max, lh]] of Object.entries(TIPO)) {
  const d = dichiarazioni(regola(`.tema-soluzioni ${k}`)[0]?.corpo ?? "");
  vero(`${k}: carattere ${carattere}`, d["font-family"]?.includes("--hgl-font-titoli"));
  vero(`${k}: da ${min} a ${max}`, new RegExp(`^clamp\\(${min.replace(".", "\\.")},[^,]+,\\s*${max.replace(".", "\\.")}\\)$`).test(d["font-size"] ?? ""));
  vero(`${k}: maiuscolo da CSS, mai grassetto finto`, d["text-transform"] === "uppercase" && d["font-synthesis"] === "none");
  if (lh) c(`${k}: interlinea ${lh}`, lh, d["line-height"]);
}
c(".sol-h1: tracking 0,005em", "0.005em", dichiarazioni(regola(".tema-soluzioni .sol-h1")[0].corpo)["letter-spacing"]);
const PICCOLI = {
  ".sol-etichetta": ["0.8125rem", "0.8125rem", "600"],
  ".sol-sottotitolo": ["0.9375rem", "1.25rem", "400"],
  ".sol-riga": ["0.9375rem", "1.0625rem", "400"],
  ".sol-testo": ["1.0625rem", "1.125rem", "400"],
  ".sol-didascalia": ["0.875rem", "0.9375rem", "500"],
};
for (const [k, [telefono, computer, peso]] of Object.entries(PICCOLI)) {
  const base = dichiarazioni(regola(`.tema-soluzioni ${k}`)[0]?.corpo ?? "");
  const lg = dichiarazioni(primoLivello.filter((r) => /^@media \(min-width:\s*1024px\)/.test(r.testa)).flatMap((r) => regole(r.corpo)).find((r) => r.testa === `.tema-soluzioni ${k}`)?.corpo ?? "");
  c(`${k}: telefono ${telefono}, computer ${computer}, peso ${peso}`, [telefono, computer, peso], [base["font-size"], lg["font-size"] ?? base["font-size"], base["font-weight"]]);
}
c(".sol-etichetta: tracking 0,14em maiuscolo", ["0.14em", "uppercase"], [dichiarazioni(regola(".tema-soluzioni .sol-etichetta")[0]?.corpo ?? "")["letter-spacing"], dichiarazioni(regola(".tema-soluzioni .sol-etichetta")[0]?.corpo ?? "")["text-transform"]]);
c(".sol-testo: lh 1,55 e 62ch", ["1.55", "62ch"], [dichiarazioni(regola(".tema-soluzioni .sol-testo")[0]?.corpo ?? "")["line-height"], dichiarazioni(regola(".tema-soluzioni .sol-testo")[0]?.corpo ?? "")["max-width"]]);
vero("nessun testo sotto 13 px (0,8125rem) nel blocco", [...blocco.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)].every(([, n, u]) => (u === "px" ? +n : +n * 16) >= 13));

/* I mirini: 16 px, dettagli al 50% */
const B = primoLivello.filter((r) => r.testa.includes(".brackets"));
vero(".brackets: regole sotto il tema", B.length >= 2 && B.every((r) => r.testa.split(",").every((s) => s.trim().startsWith(".tema-soluzioni "))));
vero(".brackets: 16 px", B.some((r) => /width:\s*16px/.test(r.corpo) && /height:\s*16px/.test(r.corpo)));
vero(".brackets: colore dei dettagli al 50%", /rgb\(201 214 255 \/ 50%\)|rgba\(201,\s*214,\s*255,\s*0?\.5\)/.test(B.map((r) => r.corpo).join(" ")));

/* Movimento */
const ridotto = primoLivello.filter((r) => /^@media \(prefers-reduced-motion:\s*reduce\)/.test(r.testa));
vero("c'è un @media prefers-reduced-motion: reduce", ridotto.length >= 1);
const spento = ridotto.map((r) => r.corpo).join(" ");
vero("ridotto: transizioni e animazioni a zero", /transition:\s*none|transition-duration:\s*0/.test(spento) && /animation:\s*none/.test(spento));
const anim = [...blocco.matchAll(/(transition|animation)[\w-]*:\s*([^;]+);/g)].map((m) => m[0]).join("\n");
vero("nessuna animazione infinita, nessun lampo", !/infinite/.test(blocco) && !/@keyframes[^{]*(shine|glitch|flash|strobe|blink|pulse)/i.test(blocco));
vero("apertura della spiegazione: 240 ms con la curva del tema", /240ms\s+cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/.test(blocco) && /grid-template-rows/.test(anim + blocco));

/* I tre file di base */
const azioni = leggi("src/landing/sito/soluzioni/Azioni.tsx");
vero("Azioni: i tre ruoli, mai altri", ["BottonePrimario", "BottoneContorno", "LinkAzione"].every((n) => new RegExp(`export function ${n}\\b`).test(azioni)) && (azioni.match(/export function /g) ?? []).length === 3);
vero('Azioni: il primario porta data-barra-nascondi="fondo"', /data-barra-nascondi="fondo"/.test(azioni));
vero("Azioni: nessun colore scritto a mano (stanno nel CSS del tema)", !/#[0-9a-f]{6}\b/i.test(azioni));
const font = leggi("src/landing/sito/soluzioni/font.ts");
vero("font.ts: esporta PRECARICA_FONT_SOLUZIONI", /export const PRECARICA_FONT_SOLUZIONI\b/.test(font));
const F2 = await carica("src/landing/sito/soluzioni/font.ts", "font-soluzioni");
c("PRECARICA_FONT_SOLUZIONI: due soli file (Anton 400 latin, Inter Tight latin)", ["/fonts/anton/5.3.0/anton-latin-400-normal.woff2", "/fonts/inter-tight/5.3.0/inter-tight-latin-wght-normal.woff2"], F2.PRECARICA_FONT_SOLUZIONI.map((l) => l.href));
vero("precarico: font/woff2, as=font, crossOrigin anonymous", F2.PRECARICA_FONT_SOLUZIONI.every((l) => l.rel === "preload" && l.as === "font" && l.type === "font/woff2" && l.crossOrigin === "anonymous"));
vero("i file precaricati esistono davvero", F2.PRECARICA_FONT_SOLUZIONI.every((l) => existsSync(join(radice, "public", l.href))));
const mov = leggi("src/landing/sito/soluzioni/movimento.ts");
vero("movimento.ts: usaMovimentoRidotto legge matchMedia del movimento ridotto", /export function usaMovimentoRidotto\b/.test(mov) && /prefers-reduced-motion:\s*reduce/.test(mov) && /matchMedia/.test(mov));

/* ── S2.1 · Foto, VideoParlato, ClipLoop ───────────────────────────────── */
{
  const DIR = "src/landing/sito/soluzioni";
  const foto = leggi(`${DIR}/Foto.tsx`);
  const video = leggi(`${DIR}/VideoParlato.tsx`);
  const clip = leggi(`${DIR}/ClipLoop.tsx`);
  const tutti = { Foto: foto, VideoParlato: video, ClipLoop: clip };

  for (const [nome, sorgente] of Object.entries(tutti)) {
    vero(`${nome}: esporta la funzione col suo nome`, new RegExp(`export function ${nome}\\b`).test(sorgente));
    vero(`${nome}: niente autoPlay`, !/autoPlay/i.test(sorgente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
    vero(`${nome}: non importa MediaSlot, PlaceholderBox né LandingContent`, !/MediaSlot|PlaceholderBox|LandingContent/.test(sorgente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
    vero(`${nome}: nessun colore scritto a mano`, !/#[0-9a-f]{6}\b/i.test(sorgente));
  }
  vero("VideoParlato: preload none, playsInline, controlli solo dopo il tocco", /preload="none"/.test(video) && /playsInline/.test(video) && /controls=\{/.test(video));
  vero("VideoParlato: l'audio non è mai spento", !/\bmuted\b/.test(video.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
  vero("VideoParlato: avvisa la barra (segnaVideo true e false)", /segnaVideo\(true\)/.test(video) && /segnaVideo\(false\)/.test(video));
  vero("VideoParlato: gli eventi del video", ["invisible_video_play", "invisible_video_50", "video_play", "video_50", "video_fine"].every((e) => video.includes(`"${e}"`)) && /voce:\s*"invisibleVideo"/.test(video));
  vero("VideoParlato: la trascrizione è un <details> solo se c'è", /<details/.test(video) && /trascrizione\?\.trim\(\)|trascrizione\s*&&|trim\(\)/.test(video));
  vero("ClipLoop: muted, loop, preload none, playsInline, aria-hidden", ["muted", "loop", 'preload="none"', "playsInline", 'aria-hidden="true"'].every((x) => clip.includes(x)));
  vero("ClipLoop: legge il movimento ridotto e usa IntersectionObserver", /usaMovimentoRidotto/.test(clip) && /IntersectionObserver/.test(clip) && /threshold:\s*0\.5/.test(clip) && /200px/.test(clip));
  vero("ClipLoop: descrizione nascosta e figcaption", /sr-only/.test(clip) && /<figcaption/.test(clip));
  vero("Foto: aspect-ratio, width/height, fetchPriority, decoding", ["aspectRatio", "width={", "height={", "fetchPriority", 'decoding="async"', "objectPosition"].every((x) => foto.includes(x)));

  const R = richiedi("react");
  const { renderToStaticMarkup: disegna } = richiedi("react-dom/server");
  const h = R.createElement;
  const slot = { src: "https://x.test/storage/v1/object/public/landing-media/v.mp4", poster: "https://x.test/storage/v1/object/public/landing-media/p.webp", alt: "Il titolare ti guarda in camera." };

  /* Foto */
  const FO = await carica(`${DIR}/Foto.tsx`, "foto-s2", { reactVero: true });
  c("Foto con slot null → stringa vuota", "", disegna(h(FO.Foto, { slot: null, formato: "1:1", larghezza: 72, altezza: 72 })));
  c("Foto con src vuoto → stringa vuota", "", disegna(h(FO.Foto, { slot: { ...slot, src: "" }, formato: "1:1", larghezza: 72, altezza: 72 })));
  {
    const html = disegna(h(FO.Foto, { slot: { src: slot.poster, poster: "", alt: "Una patch tenuta in mano." }, formato: "3:2", larghezza: 373, altezza: 249, posizione: "50% 30%" }));
    vero("Foto: una sola <img> con src, alt, width e height", (html.match(/<img /g) ?? []).length === 1 && html.includes(`src="${slot.poster}"`) && html.includes('alt="Una patch tenuta in mano."') && html.includes('width="373"') && html.includes('height="249"'));
    vero("Foto: aspect-ratio 3 / 2, cover, object-position", html.includes("aspect-ratio:3 / 2") && html.includes("object-fit:cover") && html.includes("object-position:50% 30%"));
    vero("Foto: di base subito, decodifica asincrona", html.includes('loading="eager"') && html.includes('decoding="async"') && !html.includes("fetchpriority"));
    const alta = disegna(h(FO.Foto, { slot, formato: "1:1", larghezza: 96, altezza: 96, priorita: "alta" }));
    vero("Foto alta: fetchpriority high, mai lazy", alta.includes('fetchPriority="high"') || alta.includes('fetchpriority="high"'));
    vero("Foto alta: niente loading lazy", !alta.includes('loading="lazy"'));
    vero("Foto pigra: loading lazy", disegna(h(FO.Foto, { slot, formato: "4:5", larghezza: 481, altezza: 601, priorita: "pigra" })).includes('loading="lazy"'));
    vero("Foto: className passa", disegna(h(FO.Foto, { slot, formato: "1:1", larghezza: 72, altezza: 72, className: "rounded-full" })).includes('class="rounded-full"'));
    //  Un alt con virgolette o tag resta testo.
    vero("Foto: l'alt è testo, non HTML", !disegna(h(FO.Foto, { slot: { ...slot, alt: '"><script>x</script>' }, formato: "1:1", larghezza: 1, altezza: 1 })).includes("<script"));
  }

  /* VideoParlato */
  const VP = await carica(`${DIR}/VideoParlato.tsx`, "video-s2", { reactVero: true });
  const testi = { pillola: "Te lo spiego in 30 secondi", riguarda: "Riguarda", etichettaPlay: "Guarda il video: che cos'è Invisible Derm, con audio", leggiTesto: "Leggi il testo del video" };
  {
    const html = disegna(h(VP.VideoParlato, { slot, formato: "4:5", testi, trascrizione: "Ciao, sono io. Ti spiego." }));
    c("VideoParlato: un solo <button> (la copertina)", 1, (html.match(/<button\b/g) ?? []).length);
    vero("VideoParlato: il nome del bottone comincia dalla pillola e porta l'etichetta del play (WCAG 2.5.3)", html.includes(`aria-label="${(testi.pillola + ". " + testi.etichettaPlay).replace(/'/g, "&#x27;")}"`));
    vero("VideoParlato: la pillola dice il testo, in HTML", html.includes(testi.pillola));
    vero("VideoParlato: la copertina è la poster", html.includes(`src="${slot.poster}"`));
    vero("VideoParlato: video preload none, playsinline, senza autoplay né controlli", /<video\b[^>]*preload="none"/.test(html) && /<video\b[^>]*playsinline/i.test(html) && !/autoplay/i.test(html) && !/<video\b[^>]*\bcontrols/.test(html));
    vero("VideoParlato: il video non si scarica da solo (src solo dopo il tocco o con preload none)", !/<video\b[^>]*preload="auto"/.test(html));
    vero("VideoParlato: <details> con «Leggi il testo del video» e la trascrizione", html.includes("<details") && html.includes("<summary") && html.includes(testi.leggiTesto) && html.includes("Ciao, sono io. Ti spiego."));
    vero("VideoParlato: «Riguarda» non si vede prima di finire", !html.includes(">Riguarda<"));
  }
  vero("VideoParlato senza trascrizione (vuota o spazi): niente <details>", ["", "   ", null].every((tr) => !disegna(h(VP.VideoParlato, { slot, formato: "4:5", testi, trascrizione: tr })).includes("<details")));
  {
    //  Il testo scritto nel CRM resta testo (nota g del revisore).
    const html = disegna(h(VP.VideoParlato, { slot, formato: "4:5", testi, trascrizione: "</script><img src=x onerror=alert(1)>" }));
    vero("VideoParlato: la trascrizione è escapata", !html.includes("<img src=x") && html.includes("&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;"));
  }

  /* ClipLoop */
  const CL = await carica(`${DIR}/ClipLoop.tsx`, "clip-s2", { reactVero: true });
  {
    const etichette = { ferma: "Metti in pausa il video", riparti: "Fai partire il video" };
    const html = disegna(h(CL.ClipLoop, { slot, formato: "4:5", descrizione: "Primo piano dell'attaccatura. Video breve senza audio.", didascalia: "Da 10 centimetri, alla luce dello studio.", etichette }));
    vero("ClipLoop: <video> muted loop playsinline preload none aria-hidden", /<video\b[^>]*\bmuted/.test(html) && /<video\b[^>]*\bloop/.test(html) && /<video\b[^>]*playsinline/i.test(html) && /<video\b[^>]*preload="none"/.test(html) && /<video\b[^>]*aria-hidden="true"/.test(html));
    vero("ClipLoop: nessun autoplay e nessun src prima dei 200 px", !/autoplay/i.test(html) && !/<video\b[^>]*\bsrc=/.test(html));
    vero("ClipLoop: la copertina è la poster", html.includes(`poster="${slot.poster}"`));
    vero("ClipLoop: <figure> con <figcaption> e descrizione nascosta", html.startsWith("<figure") && html.includes("<figcaption") && html.includes("Da 10 centimetri, alla luce dello studio.") && /class="[^"]*sr-only[^"]*"[^>]*>Primo piano/.test(html));
    c("ClipLoop: un solo bottone (play/pausa)", 1, (html.match(/<button\b/g) ?? []).length);
    vero("ClipLoop: il bottone, da fermo, dice «Fai partire il video»", html.includes('aria-label="Fai partire il video"'));
    vero("ClipLoop: il bottone è alto e largo 44 (classe del tema)", /<button\b[^>]*class="[^"]*sol-media-tasto/.test(html));
  }
  //  Il CSS dei pezzi nuovi sta nel tema (la regola generale sopra lo controlla); qui che le classi usate esistano.
  for (const cl of ["sol-copertina", "sol-pillola", "sol-pillola-play", "sol-media-tasto", "sol-video", "sol-clip"]) {
    vero(`CSS: .${cl} definita`, regola(`.tema-soluzioni .${cl}`).length > 0);
  }
  c("CSS: il tasto della clip è 44 × 44", ["44px", "44px"], [dichiarazioni(regola(".tema-soluzioni .sol-media-tasto")[0]?.corpo ?? "").width, dichiarazioni(regola(".tema-soluzioni .sol-media-tasto")[0]?.corpo ?? "").height]);
  c("CSS: la pillola è blu notte all'88%, in basso a sinistra", ["rgb(10 20 48 / 88%)", "12px", "12px"], [dichiarazioni(regola(".tema-soluzioni .sol-pillola")[0]?.corpo ?? "").background, dichiarazioni(regola(".tema-soluzioni .sol-pillola")[0]?.corpo ?? "").left, dichiarazioni(regola(".tema-soluzioni .sol-pillola")[0]?.corpo ?? "").bottom]);
  c("CSS: il cerchio del play è 48 px, blu con triangolo blu notte", ["48px", "var(--hgl-elettrico)", "var(--hgl-notte)"], [dichiarazioni(regola(".tema-soluzioni .sol-pillola-play")[0]?.corpo ?? "").width, dichiarazioni(regola(".tema-soluzioni .sol-pillola-play")[0]?.corpo ?? "").background, dichiarazioni(regola(".tema-soluzioni .sol-pillola-play")[0]?.corpo ?? "").color]);
}

/* ── S2.2 · Footer: quello di oggi identico, e la variante minimo ───────── */
{
  const { writeFileSync, rmSync } = await import("node:fs");
  const R = richiedi("react");
  const { renderToStaticMarkup: disegna } = richiedi("react-dom/server");
  const norma = (html) => html.replace(/© \d{4}/g, "© AAAA");

  const FT = await carica("src/components/landing/Footer.tsx", "footer-s22", { reactVero: true, routerFinto: true });
  const oggi = disegna(R.createElement(FT.Footer));
  c("<Footer /> e <Footer variante=\"completo\" /> sono lo stesso HTML", oggi, disegna(R.createElement(FT.Footer, { variante: "completo" })));

  //  Il Footer di d42e5d9 (git), disegnato con gli stessi caricatori: il file si scrive dentro prove/ per trovare node_modules.
  let vecchio = null;
  try {
    const sorgente = execFileSync("git", ["show", "d42e5d9:src/components/landing/Footer.tsx"], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const temp = join(radice, "prove/sito/.footer-d42e5d9.tmp.tsx");
    writeFileSync(temp, sorgente);
    try {
      const FV = await carica("prove/sito/.footer-d42e5d9.tmp.tsx", "footer-d42e5d9", { reactVero: true, routerFinto: true });
      vecchio = disegna(R.createElement(FV.Footer));
    } finally {
      rmSync(temp, { force: true });
    }
  } catch {
    console.log("  (git non risponde: confronto del Footer con d42e5d9 saltato)");
  }
  if (vecchio !== null) vero("<Footer /> = HTML del Footer di d42e5d9, byte per byte", norma(oggi) === norma(vecchio));
  //  La fotografia G1 della commessa, se c'è su questa macchina.
  const g1 = "/Users/admin/Documents/Reel Studio/11-tecnico/commesse/2026-10-14-sito-catalogo-protocol/collaudo-soluzioni/g1-prima/footer.html";
  if (existsSync(g1)) vero("<Footer /> = fotografia G1 (g1-prima/footer.html)", norma(oggi) === norma(readFileSync(g1, "utf8").replace(/\n$/, "")));
  vero("Footer di oggi: promessa, contatti e P.IVA ancora lì", oggi.includes("Indistinguibile dalla cute.") && oggi.includes("mailto:") && oggi.includes("tel:") && oggi.includes("P.IVA 18486531009"));

  const minimo = disegna(R.createElement(FT.Footer, { variante: "minimo" }));
  vero("minimo: ragione sociale, indirizzo, P.IVA", minimo.includes("HAIR GENIUS LABS SRLS") && minimo.includes("Via degli Scipioni 132, 00192 Roma (RM)") && minimo.includes("18486531009"));
  vero("minimo: il logo con l'alt «Hair Genius Labs»", /<img[^>]*alt="Hair Genius Labs"/.test(minimo));
  vero("minimo: Privacy, Cookie, Termini", ["/privacy-policy", "/cookie-policy", "/termini-e-condizioni"].every((h) => minimo.includes(`href="${h}"`)) && ["Privacy Policy", "Cookie Policy", "Termini e condizioni"].every((x) => minimo.includes(x)));
  vero("minimo: niente promessa («Indistinguibile»)", !/indistinguibil/i.test(minimo));
  vero("minimo: niente tel:, mailto:, WhatsApp", !/tel:|mailto:|wa\.me|whatsapp/i.test(minimo));
  vero("minimo: niente «Contatti»", !/contatti/i.test(minimo));
  c("minimo: sono tre i collegamenti, e basta", 3, (minimo.match(/<a /g) ?? []).length);
  vero("minimo: porta il tema (caratteri e fuoco della pagina)", /<footer[^>]*class="[^"]*tema-soluzioni/.test(minimo));
}

finisci();
