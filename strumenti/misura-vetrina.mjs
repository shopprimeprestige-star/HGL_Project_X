#!/usr/bin/env node
/** ── VETRINA V1 · T92 · LO STRUMENTO DI MISURA (PIANO-V1 D92, D105; criteri V1-T3, T10-T15, H5) ─────────────────────────
 *  Misura le pagine della VETRINA FINTA (`strumenti/vetrina-finta/avvia.mjs`) con un browser vero e scrive su stdout un JSON con un ok/no per punto.
 *
 *  ⚠️ Playwright NON è una dipendenza del progetto (decisione del titolare, D92): si scarica FUORI dal repository, in una cartella `mktemp -d`,
 *     e si passa con `--playwright <cartella>` (o `MISURA_PLAYWRIGHT`). `axe` e Lighthouse non li usa questo strumento: si lanciano a parte (T103c).
 *  ⚠️ Mai il sito vero né il database vero: accetta solo http://127.0.0.1, http://localhost o http://[::1]. Due difese insieme:
 *     (1) il browser parte con `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE [::1]"`: ogni nome esterno non si risolve,
 *         comunque ci si arrivi (redirect, WebSocket, preconnect, sottorisorse); (2) un filtro di Playwright su ogni richiesta fa passare SOLO l'origine di
 *         `--base` e abortisce le quattro rotte con un indirizzo vero scritto nel codice. Il filtro da solo NON basterebbe: Playwright non lo chiama sui
 *         redirect, né sui WebSocket. Legge dall'ambiente solo `MISURA_*`.
 *  ⚠️ Non scrive file: l'esito va su stdout; il browser gira in un contesto senza profilo e si chiude in un `finally`.
 *
 *  Uso:  node strumenti/misura-vetrina.mjs --playwright <cartella> [--base http://127.0.0.1:5199] [--pagine /shop,/shop/cerca,/shop/carrello]
 *                                          [--scheda /shop/prodotto/<slug> --sku <SKU>[,<SKU>]] [--scenario stress] [--solo T3,T11]
 *                                          [--canale chrome] [--finestra "<css del bottone che apre una finestra>"]
 *  Codice di uscita: 0 tutto ok, 1 almeno un punto no, 2 non si è potuto misurare (argomenti, Playwright o browser mancanti),
 *  3 nessun rosso ma non tutto misurato (almeno un punto `null`: saltato o misura incompleta; i punti esclusi con `--solo` non contano). */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* ══ 1 · ERRORI E INDIRIZZI: SOLO LOCALI ═════════════════════════════════════════════════════════════════════════ */

export class ErroreMisura extends Error {}

const LOCALI = new Set(["127.0.0.1", "localhost", "[::1]"]);
/** Le quattro rotte con un indirizzo Supabase vero scritto nel codice (LEGGIMI della vetrina finta): mai visitate. */
const ROTTE_VIETATE = ["/api/og/anteprima", "/media", "/prova-anteprima"];

/** Un percorso è una delle quattro rotte vietate? Senza badare alle maiuscole né alla codifica `%xx`; `/prova-anteprima-a` compreso. */
export function rottaVietata(percorso) {
  let p = String(percorso).split(/[?#]/)[0];
  for (let i = 0; i < 2; i++) { try { p = decodeURIComponent(p); } catch { break; } }
  p = p.toLowerCase();
  return p.startsWith("/prova-anteprima-") || ROTTE_VIETATE.some((r) => p === r || p.startsWith(`${r}/`));
}
const COME_SI_USA = "Uso: node strumenti/misura-vetrina.mjs --playwright <cartella> [--base http://127.0.0.1:5199] (solo 127.0.0.1, localhost o [::1])";

/** Restituisce l'origine (`http://127.0.0.1:5199`) o lancia. Il messaggio non ripete mai utente e password. */
export function verificaIndirizzoLocale(testo) {
  const t = typeof testo === "string" ? testo.trim() : "";
  let u;
  try { u = new URL(t); } catch { throw new ErroreMisura("indirizzo non valido: serve http://127.0.0.1:<porta> o http://localhost:<porta>"); }
  if (u.protocol !== "http:") throw new ErroreMisura("solo http: la vetrina finta è locale, senza https (usa http://127.0.0.1 o http://localhost)");
  if (u.username || u.password) throw new ErroreMisura("l'indirizzo non deve avere utente e password (usa http://127.0.0.1 o http://localhost)");
  if (!LOCALI.has(u.hostname)) throw new ErroreMisura(`«${u.hostname}» non è un indirizzo locale: lo strumento misura solo la vetrina finta (http://127.0.0.1 o http://localhost)`);
  return u.origin;
}

/** Un percorso del sito (`/shop/cerca?q=a`) → indirizzo intero sulla stessa origine. Rifiuta ciò che esce dall'origine e le quattro rotte vietate. */
export function verificaPercorso(p, base) {
  if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) throw new ErroreMisura(`percorso «${String(p).slice(0, 40)}»: deve cominciare con una sola «/»`);
  const u = new URL(p, base);
  if (u.origin !== new URL(base).origin) throw new ErroreMisura(`percorso «${p.slice(0, 40)}»: esce dall'origine`);
  if (rottaVietata(u.pathname)) throw new ErroreMisura(`percorso «${u.pathname}»: ha un indirizzo vero scritto nel codice, non si visita`);
  return u.href;
}

/* ══ 2 · ARGOMENTI ═══════════════════════════════════════════════════════════════════════════════════════════════ */

export const SCENARI = ["completo", "vuoto", "pochi", "guasto", "vecchio", "stress"];
/** I punti che si possono scegliere con `--solo` (la parte prima del trattino dell'id). */
export const FAMIGLIE = ["T3", "T10", "T11", "T12", "T13", "T14", "T15", "H5", "D105"];
const PAGINE_DI_PARTENZA = ["/shop", "/shop/cerca", "/shop/carrello"];
const CON_VALORE = new Set(["--base", "--playwright", "--pagine", "--scheda", "--sku", "--scenario", "--solo", "--canale", "--finestra"]);

/** `argv` senza i primi due; `env` = l'ambiente (si leggono solo `MISURA_BASE`, `MISURA_PLAYWRIGHT`, `MISURA_CANALE`). Mai un'eccezione: gli errori vanno in `errori`. */
export function leggiArgomenti(argv, env = {}) {
  const errori = [];
  const v = {};
  let aiuto = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--aiuto" || a === "-h") { aiuto = true; continue; }
    if (!CON_VALORE.has(a)) { errori.push(`opzione sconosciuta: ${String(a).slice(0, 40)}`); continue; }
    const valore = argv[i + 1];
    if (valore === undefined || valore.startsWith("--")) { errori.push(`${a} vuole un valore`); continue; }
    v[a.slice(2)] = valore;
    i++;
  }
  const lista = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
  const opzioni = {
    base: v.base ?? env.MISURA_BASE ?? "http://127.0.0.1:5199",
    playwright: v.playwright ?? env.MISURA_PLAYWRIGHT,
    pagine: v.pagine ? lista(v.pagine) : PAGINE_DI_PARTENZA,
    scheda: v.scheda,
    sku: lista(v.sku),
    scenario: v.scenario,
    solo: lista(v.solo),
    canale: v.canale ?? env.MISURA_CANALE,
    finestra: v.finestra,
  };
  if (aiuto) return { aiuto, errori, opzioni };
  const prova = (f) => { try { return f(); } catch (e) { errori.push(String(e.message)); return undefined; } };
  const origine = prova(() => verificaIndirizzoLocale(opzioni.base));
  if (origine) {
    opzioni.base = origine;
    for (const p of [...opzioni.pagine, ...(opzioni.scheda ? [opzioni.scheda] : [])]) prova(() => verificaPercorso(p, origine));
  }
  if (opzioni.scenario && !SCENARI.includes(opzioni.scenario)) errori.push(`scenario «${opzioni.scenario}» sconosciuto (${SCENARI.join(", ")})`);
  for (const s of opzioni.solo) if (!FAMIGLIE.includes(s)) errori.push(`--solo «${s}» sconosciuto (${FAMIGLIE.join(", ")})`);
  if (opzioni.scheda && !opzioni.sku.length) errori.push("--scheda vuole anche --sku (lo SKU del prodotto di quella scheda)");
  if (!opzioni.scheda && opzioni.sku.length) errori.push("--sku vuole anche --scheda (il percorso della scheda)");
  return { aiuto, errori, opzioni };
}

/* ══ 3 · PLAYWRIGHT DA FUORI ═════════════════════════════════════════════════════════════════════════════════════ */

const COME_PREPARARE =
  "Playwright non è nel progetto (decisione del titolare): scaricalo FUORI dal repository, per esempio\n" +
  '  D="$(mktemp -d)" && (cd "$D" && npm init -y >/dev/null && npm i playwright-core)\n' +
  "e rilancia con  --playwright \"$D\"  (oppure MISURA_PLAYWRIGHT=\"$D\"). Poi cancella la cartella.";

export function messaggioBrowserMancante(canale) {
  return (
    `Il browser ${canale ? `«${canale}» ` : ""}non parte. Playwright non scarica niente da solo qui: usa un Chrome già installato con --canale chrome ` +
    'oppure, nella cartella esterna, "npx playwright install chromium" (sono circa 150 MB: nella cartella temporanea, da cancellare dopo).'
  );
}

/** Carica Playwright dalla cartella esterna. Mai un'eccezione: o `{ pw }` o `{ errore }`. */
export async function caricaPlaywright(cartella) {
  if (!cartella) return { errore: `Playwright non indicato.\n${COME_PREPARARE}` };
  if (!existsSync(cartella)) return { errore: `La cartella «${cartella}» non esiste.\n${COME_PREPARARE}` };
  const richiedi = createRequire(join(resolve(cartella), "package.json"));
  let percorso;
  for (const nome of ["playwright", "playwright-core"]) {
    try { percorso = richiedi.resolve(nome); break; } catch { /* prova il prossimo */ }
  }
  if (!percorso) return { errore: `In «${cartella}» non trovo Playwright (né playwright né playwright-core in node_modules).\n${COME_PREPARARE}` };
  try {
    const pw = richiedi(percorso);
    if (!pw?.chromium) return { errore: `Il Playwright di «${cartella}» non si carica come previsto (manca chromium).` };
    return { pw };
  } catch (e) {
    return { errore: `Il Playwright di «${cartella}» non si carica: ${String(e?.message ?? e).split("\n")[0]}` };
  }
}

/* ══ 4 · COLORI E CONTRASTI (SPEC §4.2.2) ═══════════════════════════════════════════════════════════════════════ */

const num = (s) => Number.parseFloat(s);

/** Un colore come lo scrive Chrome (`rgb()`, `rgba()`, `color(srgb …)`), o `#rgb`/`#rrggbb`. Altro (oklch, nomi…) → `null`. */
export function leggiColore(testo) {
  const t = String(testo ?? "").trim().toLowerCase();
  if (t === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join("") : m[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(t);
  if (m) return { r: num(m[1]), g: num(m[2]), b: num(m[3]), a: m[4] === undefined ? 1 : m[4].endsWith("%") ? num(m[4]) / 100 : num(m[4]) };
  m = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(t);
  if (m) return { r: num(m[1]) * 255, g: num(m[2]) * 255, b: num(m[3]) * 255, a: m[4] === undefined ? 1 : m[4].endsWith("%") ? num(m[4]) / 100 : num(m[4]) };
  return null;
}

const comeColore = (x) => (typeof x === "string" ? leggiColore(x) : x);
const luminanza = ({ r, g, b }) => {
  const [R, G, B] = [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
/** Il primo colore messo sopra il secondo (opaco), con la sua trasparenza. */
export const componi = (sopra, sotto) => ({ r: sopra.r * sopra.a + sotto.r * (1 - sopra.a), g: sopra.g * sopra.a + sotto.g * (1 - sopra.a), b: sopra.b * sopra.a + sotto.b * (1 - sopra.a), a: 1 });
/** Rapporto di contrasto WCAG fra due colori opachi (stringhe o `{r,g,b}`). */
export function rapportoContrasto(a, b) {
  const l1 = luminanza(comeColore(a));
  const l2 = luminanza(comeColore(b));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Le coppie della tabella §4.2.2 (rapporti scritti nel documento il 20/11). `atteso` = il valore ricalcolato quando il documento è fuori di oltre 0,15
 *  (nei due casi il vero è PIÙ ALTO di quello scritto: nessun rischio, ma il documento va corretto). `vietata`: la coppia che non si usa. */
export const COPPIE_CONTRASTO = [
  { uso: "testo principale su bianco", fg: "#0C121A", bg: "#FFFFFF", dichiarato: 18.8 },
  { uso: "testo principale su #EFF2F5", fg: "#0C121A", bg: "#EFF2F5", dichiarato: 16.2, atteso: 16.7 },
  { uso: "testo secondario su bianco", fg: "#5C646F", bg: "#FFFFFF", dichiarato: 6.0 },
  { uso: "testo secondario su #EFF2F5", fg: "#5C646F", bg: "#EFF2F5", dichiarato: 5.3 },
  { uso: "bianco 100 % su blueprint", fg: "#FFFFFF", bg: "#0A1A3A", dichiarato: 17.2 },
  { uso: "bianco 85 % su blueprint", fg: "#FFFFFF", alfa: 0.85, bg: "#0A1A3A", dichiarato: 12, atteso: 12.6 },
  { uso: "bianco 75 % su blueprint", fg: "#FFFFFF", alfa: 0.75, bg: "#0A1A3A", dichiarato: 10.0 },
  { uso: "bianco 60 % su blueprint (il minimo)", fg: "#FFFFFF", alfa: 0.6, bg: "#0A1A3A", dichiarato: 6.8 },
  { uso: "bianco 45 % su blueprint", fg: "#FFFFFF", alfa: 0.45, bg: "#0A1A3A", dichiarato: 4.4, vietata: true },
  { uso: "blu del marchio come testo su scuro", fg: "#0F90FE", bg: "#0A1A3A", dichiarato: 5.3 },
  { uso: "blu come testo su bianco", fg: "#006CC4", bg: "#FFFFFF", dichiarato: 5.3 },
  { uso: "blu come testo su #EFF2F5", fg: "#006CC4", bg: "#EFF2F5", dichiarato: 4.7 },
  { uso: "bottone notte", fg: "#FFFFFF", bg: "#0A1430", dichiarato: 18.2 },
  { uso: "bottone consulenza", fg: "#FFFFFF", bg: "#0C72CB", dichiarato: 4.9 },
  { uso: "bianco su blu pieno del marchio", fg: "#FFFFFF", bg: "#0F90FE", dichiarato: 3.3, vietata: true },
  { uso: "bordo dei campi su bianco", fg: "#7C8695", bg: "#FFFFFF", dichiarato: 3.7 },
  { uso: "bordo dei campi su #EFF2F5", fg: "#7C8695", bg: "#EFF2F5", dichiarato: 3.3 },
  { uso: "errore su bianco", fg: "#B3261E", bg: "#FFFFFF", dichiarato: 6.5 },
  { uso: "errore su #EFF2F5", fg: "#B3261E", bg: "#EFF2F5", dichiarato: 5.8 },
  { uso: "errore su scuro", fg: "#FF6B6B", bg: "#0A1A3A", dichiarato: 6.2 },
  { uso: "successo su bianco", fg: "#0B7A3E", bg: "#FFFFFF", dichiarato: 5.4 },
  { uso: "successo su #EFF2F5", fg: "#0B7A3E", bg: "#EFF2F5", dichiarato: 4.8 },
  { uso: "avviso su bianco", fg: "#8A5A00", bg: "#FFFFFF", dichiarato: 5.9 },
  { uso: "anello di fuoco su chiaro", fg: "#006CC4", bg: "#FFFFFF", dichiarato: 5.3 },
  { uso: "anello di fuoco su scuro", fg: "#FFFFFF", bg: "#0A1A3A", dichiarato: 17.2 },
];

/** Controlla la TABELLA contro la formula: se qualche numero del documento non torna, lo dice (non è un controllo sulla pagina). */
export function controllaTabellaContrasti() {
  const scarti = [];
  for (const k of COPPIE_CONTRASTO) {
    const fondo = leggiColore(k.bg);
    const testo = componi({ ...leggiColore(k.fg), a: k.alfa ?? 1 }, fondo);
    const calcolato = rapportoContrasto(testo, fondo);
    if (Math.abs(calcolato - (k.atteso ?? k.dichiarato)) > 0.15) scarti.push({ uso: k.uso, dichiarato: k.dichiarato, calcolato: Math.round(calcolato * 100) / 100 });
  }
  return { ok: scarti.length === 0, scarti, dettaglio: scarti.length ? `${scarti.length} coppie non tornano col calcolo` : `${COPPIE_CONTRASTO.length} coppie tornano col calcolo` };
}

const BIANCO = { r: 255, g: 255, b: 255, a: 1 };
const distanza = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
const BLU_MARCHIO = leggiColore("#0F90FE");

/** Voci della pagina `{sel, testo, fg, sfondi (dal più vicino alla radice), px, peso, conImmagineSfondo}` (colori già portati a sRGB dal browser).
 *  ≥ 4,5:1 (3:1 se grande); mai bianco su blu pieno del marchio. Non è mai verde a vuoto: zero testi misurati = rosso; colori illeggibili = `null`. */
export function controllaContrasti(voci) {
  const violazioni = [];
  const illeggibili = [];
  let controllati = 0;
  let nonMisurati = 0;
  for (const v of voci) {
    if (v.conImmagineSfondo) { nonMisurati++; continue; }
    const fg = leggiColore(v.fg);
    const strati = (v.sfondi ?? []).map(leggiColore);
    if (!fg || strati.some((x) => !x)) { illeggibili.push(v.sel); continue; }
    let fondo = BIANCO;
    for (const x of [...strati].reverse()) fondo = componi(x, fondo);
    const testo = componi(fg, fondo);
    const rapporto = rapportoContrasto(testo, fondo);
    const grande = v.px >= 24 || (v.px >= 18.66 && v.peso >= 700);
    const soglia = grande ? 3 : 4.5;
    const biancoSuBlu = Math.min(testo.r, testo.g, testo.b) >= 250 && distanza(fondo, BLU_MARCHIO) <= 12;
    controllati++;
    if (rapporto < soglia || biancoSuBlu) violazioni.push({ sel: v.sel, testo: String(v.testo ?? "").slice(0, 40), rapporto: Math.round(rapporto * 100) / 100, soglia, motivo: biancoSuBlu ? "bianco su blu pieno" : undefined });
  }
  const ok = violazioni.length ? false : controllati === 0 ? false : illeggibili.length ? null : true;
  const elenco = violazioni.slice(0, 8).map((x) => `${x.sel} «${x.testo}» ${x.rapporto}:1 (serve ${x.soglia}:1${x.motivo ? `, ${x.motivo}` : ""})`).join("; ");
  const dettaglio = `${controllati} testi misurati, ${nonMisurati} sopra foto o gradienti (non misurabili), ${illeggibili.length} con colore illeggibile${illeggibili.length ? ` (${[...new Set(illeggibili)].slice(0, 5).join(", ")}): misura incompleta` : ""}${violazioni.length ? `; sotto soglia: ${elenco}` : ""}${controllati === 0 ? "; nessun testo misurato: la misura non vale" : ""}`;
  return { ok, controllati, nonMisurati, illeggibili: illeggibili.length, violazioni, dettaglio };
}

/* ══ 5 · TELEFONO: BERSAGLI, CAMPI, BARRE, BOTTONI PIENI ═════════════════════════════════════════════════════════ */

const contiene = (a, b) => a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;
const distanzaRett = (a, b) => Math.hypot(Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0), Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0));
const riassunto = (violazioni, quanti, soggetto, regola) => `${quanti} ${violazioni.length ? `${soggetto}; ${violazioni.length} fuori: ${violazioni.slice(0, 8).map((x) => `${x.sel} ${x.motivo}`).join("; ")}` : `${soggetto}, ${regola}`}`;

/** Voci `{sel, x, y, w, h, inLinea, fisso}` (rettangoli in pixel CSS): ≥ 44 × 44 e a ≥ 8 px dagli altri. Un elemento che ne contiene un altro (scheda con bottone) e i link in mezzo al testo non contano. */
export function controllaBersagli(voci) {
  const v = voci.filter((x) => !x.inLinea);
  const violazioni = [];
  for (const x of v) if (x.w < 44 || x.h < 44) violazioni.push({ sel: x.sel, motivo: `${Math.round(x.w)} × ${Math.round(x.h)} px (minimo 44 × 44)` });
  for (let i = 0; i < v.length; i++) {
    for (let j = i + 1; j < v.length; j++) {
      const [a, b] = [v[i], v[j]];
      if (a.fisso !== b.fisso || contiene(a, b) || contiene(b, a)) continue;
      const d = distanzaRett(a, b);
      if (d < 8) violazioni.push({ sel: `${a.sel} e ${b.sel}`, motivo: `a ${Math.round(d)} px l'uno dall'altro (minimo 8)` });
    }
  }
  return { ok: voci.length > 0 && violazioni.length === 0, violazioni, dettaglio: voci.length ? riassunto(violazioni, v.length, "elementi interattivi", "tutti ≥ 44 × 44 e a ≥ 8 px") : "nessun elemento interattivo trovato: la misura non vale" };
}

/** Voci `{sel, fontPx}` dei campi di testo: 16 px (sotto, iOS ingrandisce la pagina). Nessun campo = niente da dire. */
export function controllaCampi(voci) {
  const violazioni = voci.filter((x) => x.fontPx < 16).map((x) => ({ sel: x.sel, motivo: `${x.fontPx} px (minimo 16)` }));
  return { ok: violazioni.length === 0, violazioni, dettaglio: riassunto(violazioni, voci.length, "campi di testo", "tutti a 16 px o più") };
}

/** `{larghezzaPagina, larghezzaFinestra, eccedenti: [sel]}`: nessuna barra orizzontale (1 px di tolleranza per gli arrotondamenti). */
export function controllaBarre({ larghezzaPagina, larghezzaFinestra, eccedenti = [] }) {
  const ok = larghezzaPagina <= larghezzaFinestra + 1;
  return { ok, dettaglio: ok ? `pagina larga ${larghezzaPagina} px in una finestra di ${larghezzaFinestra}: nessuna barra orizzontale` : `pagina larga ${larghezzaPagina} px in una finestra di ${larghezzaFinestra}${eccedenti.length ? `; escono: ${eccedenti.join(", ")}` : ""}` };
}

const TAVOLOZZA = [["notte", "#0A1430"], ["bianco", "#FFFFFF"], ["blu", "#0C72CB"], ["blu", "#0F90FE"], ["rosso", "#FF3B3B"]].map(([n, c]) => [n, leggiColore(c)]);
/** Il fondo pieno di un bottone → «notte», «bianco», «blu», «rosso» o «altro» (entro 30 di distanza nello spazio RGB). */
export function classificaPieno(sfondo) {
  const c = leggiColore(sfondo);
  if (!c) return "altro";
  return TAVOLOZZA.find(([, t]) => distanza(c, t) <= 30)?.[0] ?? "altro";
}

/** Voci `{sel, testo, sfondo}` dei bottoni a fondo pieno visibili a scorrimento fermo: un solo pieno (notte o bianco) per schermo; il blu solo per la consulenza
 *  (si riconosce dal testo: shortcut); il rosso del brand mai. */
export function controllaPieni(voci) {
  const violazioni = [];
  let chiari = 0;
  for (const v of voci) {
    const tipo = classificaPieno(v.sfondo);
    if (tipo === "rosso") violazioni.push({ sel: v.sel, motivo: `«${v.testo}» è rosso pieno: mai` });
    else if (tipo === "blu") { if (!/consulenza/i.test(v.testo ?? "")) violazioni.push({ sel: v.sel, motivo: `«${v.testo}» è blu pieno ma non è la consulenza` }); }
    else chiari++;
  }
  if (chiari > 1) violazioni.push({ sel: "schermata", motivo: `${chiari} bottoni pieni (${voci.filter((v) => !["blu", "rosso"].includes(classificaPieno(v.sfondo))).map((v) => `«${v.testo}»`).join(", ")}): ne serve uno solo` });
  return { ok: violazioni.length === 0, violazioni, dettaglio: violazioni.map((x) => `${x.sel} ${x.motivo}`).join("; ") || `${voci.length} bottoni pieni a schermo, nei limiti (uno solo, blu solo per la consulenza, mai rosso)` };
}

/* ══ 6 · IMMAGINI, VIDEO, TERZE PARTI ═════════════════════════════════════════════════════════════════════════════ */

/** La larghezza che il file serve: la larghezza naturale; solo per gli SVG di prova (che non hanno una larghezza vera) il suffisso del nome (`…-960.svg`). */
export function larghezzaServita(img) {
  const m = /-(\d{2,4})\.svg(?:\?.*)?$/i.exec(img.src ?? "");
  return m ? Number(m[1]) : img.naturalW || 0;
}

/** Scostamenti dichiarati dal doppio del riquadro (D99 e nota di T74), con limiti stretti: il ritratto (240 px in 56-72), la miniatura del carrello e della
 *  tendina (480 px in 80-112), la card prodotto (960 px in 200-320). Qualunque altro caso resta soggetto al doppio. */
const ECCEZIONI_IMMAGINI = [
  { nome: "ritratto", da: 0, a: 72, serviteMax: 240 },
  { nome: "miniatura", da: 80, a: 112, serviteMax: 480 },
  { nome: "card", da: 200, a: 320, serviteMax: 960 },
];

/** Voci `{sel, src, naturalW, w}`: nessuna immagine servita più larga del doppio del suo riquadro, salvo le eccezioni dichiarate. */
export function controllaImmagini(voci) {
  const violazioni = [];
  const usate = {};
  let misurate = 0;
  let eccezioni = 0;
  for (const v of voci) {
    const servita = larghezzaServita(v);
    const riquadro = Math.ceil(v.w);
    if (!servita || !riquadro) continue;
    misurate++;
    if (servita <= 2 * riquadro) continue;
    const e = ECCEZIONI_IMMAGINI.find((x) => riquadro >= x.da && riquadro <= x.a && servita <= x.serviteMax);
    if (e) { eccezioni++; usate[e.nome] = (usate[e.nome] ?? 0) + 1; }
    else violazioni.push({ sel: v.sel, motivo: `servita a ${servita} px in un riquadro da ${riquadro} (massimo ${2 * riquadro})` });
  }
  const dichiarate = Object.entries(usate).map(([n, q]) => `${n} ${q}`).join(", ");
  return { ok: violazioni.length === 0, violazioni, misurate, eccezioni, dettaglio: riassunto(violazioni, misurate, "immagini misurate", `nessuna oltre il doppio del riquadro${eccezioni ? ` (scostamenti dichiarati D99: ${dichiarate})` : ""}`) };
}

/** Voci `{sel, loading, dentroFascia}`: fuori da testata e piè, solo la prima foto è caricata subito. */
export function controllaEager(voci) {
  const subito = voci.filter((v) => v.loading !== "lazy" && !v.dentroFascia);
  return { ok: subito.length <= 1, dettaglio: subito.length <= 1 ? `${subito.length} foto caricate subito (massimo 1)` : `${subito.length} foto caricate subito (massimo 1): ${subito.slice(0, 5).map((v) => v.sel).join(", ")}` };
}

const SUFFISSI = {
  meta: ["facebook.com", "facebook.net", "fbcdn.net", "fb.com"],
  tiktok: ["tiktok.com", "tiktokcdn.com", "byteoversea.com", "ibytedtos.com"],
  google: ["google.com", "google.it", "google-analytics.com", "googletagmanager.com", "googleadservices.com", "googlesyndication.com", "doubleclick.net", "googleapis.com", "gstatic.com"],
  stripe: ["stripe.com", "stripe.network"],
};
export const TUTTE = ["meta", "tiktok", "google", "stripe"];

/** L'indirizzo di una richiesta → «meta», «tiktok», «google», «stripe», «locale» o «altro» (si confronta il dominio intero, mai «contiene»). */
export function classificaHost(url) {
  let u;
  try { u = new URL(url); } catch { return "altro"; }
  if (["data:", "blob:", "about:"].includes(u.protocol)) return "locale";
  const h = u.hostname.toLowerCase();
  if (LOCALI.has(h)) return "locale";
  for (const [piattaforma, domini] of Object.entries(SUFFISSI)) if (domini.some((d) => h === d || h.endsWith(`.${d}`))) return piattaforma;
  return "altro";
}

/** Richieste `{url}`: nessuna verso le piattaforme `vietate`. */
export function controllaTerzeParti(richieste, vietate) {
  const viste = richieste.map((r) => ({ url: r.url, p: classificaHost(r.url) })).filter((r) => vietate.includes(r.p));
  const nomi = [...new Set(viste.map((r) => r.p))];
  return { ok: viste.length === 0, richieste: viste, dettaglio: viste.length ? `${viste.length} richieste a ${nomi.join(", ")}: ${viste.slice(0, 3).map((r) => new URL(r.url).host).join(", ")}` : `${richieste.length} richieste, nessuna a ${vietate.join("/")}` };
}

/** Richieste `{url, tipo}`: nessun file video scaricato prima del tocco. */
export function controllaVideo(richieste) {
  const video = richieste.filter((r) => r.tipo === "media" || /\.(?:mp4|webm|mov|m4v|m3u8|ogv)$/i.test(safePath(r.url)));
  return { ok: video.length === 0, dettaglio: video.length ? `${video.length} file video scaricati prima del tocco: ${video.slice(0, 3).map((r) => safePath(r.url)).join(", ")}` : "nessun file video scaricato prima del tocco" };
}
const safePath = (url) => { try { return new URL(url).pathname; } catch { return ""; } };

/* ══ 7 · «ACCETTA» E «RIFIUTA» (V1-T10) ═══════════════════════════════════════════════════════════════════════════ */

const ids = (x) => (Array.isArray(x) ? x.filter((i) => typeof i === "string") : []);
/** Le code che le piattaforme lasciano nella pagina (`fbq.queue`, `ttq`, `dataLayer`) → `[{piattaforma, nome, ids}]`. Mai un'eccezione. */
export function normalizzaEventi(grezzi) {
  const lista = (x) => (Array.isArray(x) ? x.filter((e) => Array.isArray(e)) : []);
  const fuori = [];
  for (const a of lista(grezzi?.fbq)) if ((a[0] === "track" || a[0] === "trackCustom") && typeof a[1] === "string") fuori.push({ piattaforma: "meta", nome: a[1], ids: ids(a[2]?.content_ids) });
  for (const a of lista(grezzi?.ttq)) if (a[0] === "track" && typeof a[1] === "string") fuori.push({ piattaforma: "tiktok", nome: a[1], ids: ids((Array.isArray(a[2]?.contents) ? a[2].contents : []).map((c) => c?.content_id)) });
  for (const a of lista(grezzi?.dataLayer)) if (a[0] === "event" && typeof a[1] === "string") fuori.push({ piattaforma: "google", nome: a[1], ids: ids((Array.isArray(a[2]?.items) ? a[2].items : []).map((c) => c?.item_id)) });
  return fuori;
}

/** Il nome di ogni evento per piattaforma (tabella §1.9; `null` = quella piattaforma non lo riceve). */
const NOMI_PER_PIATTAFORMA = {
  ViewContent: { meta: "ViewContent", tiktok: "ViewContent", google: "view_item" },
  AddToCart: { meta: "AddToCart", tiktok: "AddToCart", google: "add_to_cart" },
  ViewCart: { meta: "ViewCart", tiktok: null, google: "view_cart" },
};

/** «Accetta»: ogni piattaforma che ha eventi li ha tutti e con `content_ids` = uno degli SKU. Una piattaforma senza pixel configurato non conta; nessuna piattaforma = rosso. */
export function controllaAccetta(eventi, skus, attesi) {
  const piattaforme = [...new Set(eventi.map((e) => e.piattaforma))];
  const manca = [];
  for (const p of piattaforme) {
    for (const { nome } of attesi) {
      const voluto = NOMI_PER_PIATTAFORMA[nome]?.[p];
      if (!voluto) continue;
      if (!eventi.some((e) => e.piattaforma === p && e.nome === voluto && e.ids.some((i) => skus.includes(i)))) manca.push(`${p}: ${voluto} con content_ids = ${skus.join("/")}`);
    }
  }
  if (!piattaforme.length) return { ok: false, piattaforme, dettaglio: "nessun evento visto sulle piattaforme: i pixel non sono configurati nella vetrina finta, o il consenso non li ha accesi" };
  return { ok: manca.length === 0, piattaforme, dettaglio: manca.length ? `mancano: ${manca.join("; ")}` : `eventi attesi presenti su ${piattaforme.join(", ")} con content_ids = ${skus.join("/")}` };
}

/** «Rifiuta»: nessuna richiesta alle piattaforme (né a Stripe) e nessun evento in coda; i soli conteggi interni (`/api/public/evento`) sono permessi. */
export function controllaRifiuta(richieste, eventi) {
  const terze = controllaTerzeParti(richieste, TUTTE);
  const interne = richieste.filter((r) => classificaHost(r.url) === "locale" && safePath(r.url).startsWith("/api/public/evento")).length;
  const ok = terze.ok && eventi.length === 0;
  return { ok, interne, dettaglio: ok ? `nessuna richiesta alle piattaforme e nessun evento in coda (${interne} conteggi interni)` : [!terze.ok ? terze.dettaglio : "", eventi.length ? `${eventi.length} eventi in coda alle piattaforme: ${[...new Set(eventi.map((e) => `${e.piattaforma} ${e.nome}`))].join(", ")}` : ""].filter(Boolean).join("; ") };
}

/* ══ 8 · SIMULAZIONI ═════════════════════════════════════════════════════════════════════════════════════════════ */

const secca = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;

/** Banner aperto con barra visibile (V1-H5): `{banner, posizioni: [[{sel,x,y,w,h}]] (le barre viste a ogni posizione di scorrimento), paginaScorribile, barraAttesa}`.
 *  Il banner non copre la barra, mai due barre insieme, la pagina non si blocca. Nessuna barra in nessuna posizione: `null` (misura non valida), rosso se la barra era attesa. */
export function controllaImpilamento({ banner, posizioni, paginaScorribile, barraAttesa = false }) {
  if (!banner) return { ok: false, dettaglio: "il banner non è comparso: la misura non vale (pagina non ammessa? scelta già salvata?)" };
  const guasti = new Set();
  for (const barre of posizioni) {
    for (const b of barre) if (secca(banner, b)) guasti.add(`il banner copre ${b.sel}`);
    if (barre.length > 1) guasti.add(`${barre.length} barre fisse insieme (${barre.map((b) => b.sel).join(", ")})`);
  }
  if (!paginaScorribile) guasti.add("la pagina non scorre con il banner aperto");
  if (guasti.size) return { ok: false, dettaglio: [...guasti].join("; ") };
  if (!posizioni.some((b) => b.length)) {
    return barraAttesa
      ? { ok: false, dettaglio: `la barra attesa non si vede in nessuna delle ${posizioni.length} posizioni di scorrimento` }
      : { ok: null, dettaglio: `misura non valida: nessuna barra visibile in nessuna delle ${posizioni.length} posizioni di scorrimento (la condizione «banner e barra insieme» non è stata provata)` };
  }
  return { ok: true, dettaglio: "banner sopra la barra a ogni posizione di scorrimento, la pagina scorre" };
}

/** Ogni finestra aperta è modale (Radix non scrive `aria-modal`), salvo `aria-modal="false"`. */
export const eFinestraModale = (ariaModal) => ariaModal !== "false";

/** Finestra: `{aperta, modale, fuocoDentro: [bool], chiusaConEsc, fuocoRestituito}`. */
export function controllaFinestra({ aperta, modale, fuocoDentro, chiusaConEsc, fuocoRestituito }) {
  if (!aperta) return { ok: false, dettaglio: "la finestra non si è aperta" };
  const guasti = [];
  if (modale && fuocoDentro.some((x) => !x)) guasti.push("con Tab il fuoco esce dalla finestra");
  if (!chiusaConEsc) guasti.push("Esc non la chiude");
  if (!fuocoRestituito) guasti.push("il fuoco non torna a chi l'ha aperta");
  return { ok: guasti.length === 0, dettaglio: guasti.length ? guasti.join("; ") : `finestra ${modale ? "modale" : "non modale"}: si apre, Esc chiude e il fuoco torna${modale ? ", Tab resta dentro" : ""}` };
}

/** «Aggiunto» sul bottone per 2 secondi (tolleranza di un decimo e mezzo: si legge ogni 100 ms). */
export function controllaAggiunto({ visto, durataMs }) {
  if (!visto) return { ok: false, dettaglio: "il bottone non ha mai detto «Aggiunto»" };
  const ok = durataMs >= 1700 && durataMs <= 2700;
  return { ok, dettaglio: `«Aggiunto» è rimasto ${durataMs} ms (atteso circa 2000)` };
}

/** Scheletri `[{ms, presente}]` dopo l'inizio dell'attesa: niente prima dei 300 ms, poi presenti. */
export function controllaScheletri(campioni) {
  const prima = campioni.filter((x) => x.ms < 300);
  const dopo = campioni.filter((x) => x.ms >= 300);
  if (!prima.length || !dopo.length) return { ok: false, dettaglio: "campioni troppo pochi per dire (servono prima e dopo i 300 ms)" };
  const guasti = [];
  if (prima.some((x) => x.presente)) guasti.push("gli scheletri compaiono prima dei 300 ms (lampeggiano)");
  if (!dopo.some((x) => x.presente)) guasti.push("gli scheletri non compaiono nemmeno dopo i 300 ms");
  return { ok: guasti.length === 0, dettaglio: guasti.length ? guasti.join("; ") : "scheletri assenti prima dei 300 ms e presenti dopo" };
}

export function controllaOffline({ avvisoVisibile, avvisoSparito, carrelloIntatto }) {
  const guasti = [];
  if (!avvisoVisibile) guasti.push("senza rete non compare l'avviso");
  if (!avvisoSparito) guasti.push("tornata la rete l'avviso resta");
  if (!carrelloIntatto) guasti.push("il carrello è cambiato");
  return { ok: guasti.length === 0, dettaglio: guasti.length ? guasti.join("; ") : "avviso offline visibile, sparisce al ritorno della rete, carrello com'era" };
}

/** Peso della ricerca (D105): più di 60 KB = serve `elencoLeggero()`. */
export function controllaPeso(byte, soglia = 60 * 1024, htmlByte = 0) {
  return { ok: byte <= soglia, dettaglio: `${Math.round(byte / 1024)} KB di chiamate dati (soglia ${Math.round(soglia / 1024)} KB)${htmlByte ? `; HTML della pagina ${Math.round(htmlByte / 1024)} KB, non conteggiato (se l'elenco arriva già nell'HTML lo guarda T103c)` : ""}` };
}

export function controllaH1(n) {
  return { ok: n === 1, dettaglio: `${n} h1 visibili (deve essere 1)` };
}

/* ══ 9 · L'USCITA ════════════════════════════════════════════════════════════════════════════════════════════════ */

/** `punti`: `[{id, criteri, ok: true|false|null (saltato o incompleto), dettaglio}]`. Verde solo se tutti i punti scelti sono ok: un no, un null o nessun punto = non verde.
 *  `incompleto` = nessun rosso ma almeno un punto non misurato. */
export function riassumi(punti) {
  const totali = { ok: punti.filter((p) => p.ok === true).length, no: punti.filter((p) => p.ok === false).length, saltati: punti.filter((p) => p.ok === null).length };
  return { ok: punti.length > 0 && totali.no === 0 && totali.saltati === 0, incompleto: totali.no === 0 && totali.saltati > 0, totali, punti };
}
/** 0 verde · 1 almeno un rosso · 3 nessun rosso ma non tutto misurato (il 2 è «non si è potuto misurare», lo dà `main`). */
export const codiceUscita = (r) => (r.ok ? 0 : r.incompleto ? 3 : 1);
/** `--solo` sceglie per famiglia (la parte prima del trattino): `T1` non prende `T10`. Senza `--solo` valgono tutti. */
export const puntoScelto = (id, solo) => !solo.length || solo.includes(id.split("-")[0]);
/** Un controllo che lancia diventa un punto no col messaggio (una riga, mai la pila). */
export const puntoDaErrore = (id, criteri, e) => ({ id, criteri, ok: false, dettaglio: `errore nel controllo: ${String(e?.message ?? e).split("\n")[0].slice(0, 300)}` });

/* ══ 10 · DENTRO LA PAGINA (girano nel browser: niente riferimenti fuori) ═════════════════════════════════════════ */
/* shortcut: queste funzioni girano solo in un browser vero, la suite non le prova (D92: niente browser nella suite); le ho provate a mano con Chrome su una pagina finta (lavagna). Si rifanno a mano quando cambia il disegno. */

function inPaginaBersagli() {
  const sel = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`;
  const vis = (el) => !el.closest("[inert]") && (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true);
  const trovati = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [tabindex]:not([tabindex="-1"])')) {
    if (!vis(el)) continue;
    let r = el.getBoundingClientRect();
    const etichetta = (el.type === "checkbox" || el.type === "radio") && el.labels?.[0];
    if (etichetta && vis(etichetta)) { const l = etichetta.getBoundingClientRect(); const x = Math.min(r.left, l.left); const y = Math.min(r.top, l.top); r = { left: x, top: y, width: Math.max(r.right, l.right) - x, height: Math.max(r.bottom, l.bottom) - y, right: Math.max(r.right, l.right), bottom: Math.max(r.bottom, l.bottom) }; }
    if (r.width <= 1 || r.height <= 1 || r.right <= 0 || r.bottom <= 0) continue;
    const stile = getComputedStyle(el);
    const fisso = (() => { for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const pos = getComputedStyle(p).position; if (pos === "fixed" || pos === "sticky") return true; } return false; })();
    const inLinea = el.tagName === "A" && stile.display === "inline" && el.parentElement && el.parentElement.textContent.length - el.textContent.length > 20;
    trovati.push({ sel: sel(el), testo: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30), x: r.left + (fisso ? 0 : scrollX), y: r.top + (fisso ? 0 : scrollY), w: r.width, h: r.height, inLinea: !!inLinea, fisso });
    if (trovati.length >= 400) break;
  }
  return trovati;
}

function inPaginaCampi() {
  const campi = document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="image"]), textarea, select');
  return [...campi].filter((el) => el.checkVisibility?.() ?? true).map((el) => ({ sel: `${el.tagName.toLowerCase()}${el.name ? `[name=${el.name}]` : ""}`, fontPx: Number.parseFloat(getComputedStyle(el).fontSize) }));
}

function inPaginaBarre() {
  const larghezzaFinestra = document.documentElement.clientWidth;
  const eccedenti = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= larghezzaFinestra + 1) continue;
    let tagliato = false;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) { tagliato = true; break; }
    if (!tagliato && eccedenti.length < 5) eccedenti.push(`${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`);
  }
  return { larghezzaPagina: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), larghezzaFinestra, eccedenti };
}

function inPaginaTesti() {
  // il browser dà `oklch()`, `color-mix()` ecc. come li ha scritti il CSS: una tela 1×1 li porta tutti a sRGB (se non li legge restano come sono e il Node li conta «illeggibili»)
  const tela = document.createElement("canvas");
  tela.width = tela.height = 1;
  const g = tela.getContext("2d", { willReadFrequently: true });
  const sRGB = (c) => {
    if (/^rgba?\(/.test(c)) return c;
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = "#010203";
    g.fillStyle = c;
    if (g.fillStyle === "#010203" && c.trim().toLowerCase() !== "#010203") return c;
    g.fillRect(0, 0, 1, 1);
    const [r, v, b, a] = g.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${v}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  };
  const voci = [];
  const visti = new Set();
  const camminatore = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = camminatore.nextNode(); n && voci.length < 800; n = camminatore.nextNode()) {
    const el = n.parentElement;
    if (!el || visti.has(el) || !n.textContent.trim() || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    visti.add(el);
    if (!(el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true) || el.closest(":disabled, [inert]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    const stile = getComputedStyle(el);
    const sfondi = [];
    let conImmagineSfondo = false;
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      const sf = sRGB(s.backgroundColor);
      sfondi.push(sf);
      if (s.backgroundImage !== "none") { conImmagineSfondo = true; break; }
      if (/^rgb\(/.test(sf) || /,\s*1\)$/.test(sf)) break;
    }
    voci.push({ sel: `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`, testo: n.textContent.trim().slice(0, 40), fg: sRGB(stile.color), sfondi, px: Number.parseFloat(stile.fontSize), peso: Number.parseInt(stile.fontWeight, 10) || 400, conImmagineSfondo });
  }
  return voci;
}

function inPaginaPieni() {
  // il browser dà `oklch()`, `color-mix()` ecc. come li ha scritti il CSS: una tela 1×1 li porta tutti a sRGB (se non li legge restano come sono e il Node li conta «illeggibili»)
  const tela = document.createElement("canvas");
  tela.width = tela.height = 1;
  const g = tela.getContext("2d", { willReadFrequently: true });
  const sRGB = (c) => {
    if (/^rgba?\(/.test(c)) return c;
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = "#010203";
    g.fillStyle = c;
    if (g.fillStyle === "#010203" && c.trim().toLowerCase() !== "#010203") return c;
    g.fillRect(0, 0, 1, 1);
    const [r, v, b, a] = g.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${v}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  };
  const voci = [];
  for (const el of document.querySelectorAll('button, a, [role="button"], input[type="submit"]')) {
    if (el.closest("[inert]") || !(el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 30 || r.height > 80 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const testo = (el.textContent || el.value || "").trim();
    if (!testo || testo.length > 60) continue;
    const sfondo = sRGB(getComputedStyle(el).backgroundColor);
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(sfondo);
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.95)) continue;
    const sopra = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
    if (!sopra || !(el.contains(sopra) || sopra.contains(el))) continue;
    let padre = el.parentElement;
    while (padre && /^rgba\(.*,\s*0\)$/.test(sRGB(getComputedStyle(padre).backgroundColor))) padre = padre.parentElement;
    if (padre && sRGB(getComputedStyle(padre).backgroundColor) === sfondo) continue;
    voci.push({ sel: `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`, testo: testo.slice(0, 40), sfondo, w: r.width, h: r.height });
  }
  return voci;
}

function inPaginaImmagini() {
  return [...document.images].filter((i) => i.currentSrc && i.checkVisibility?.()).map((i) => ({ sel: `img${i.id ? `#${i.id}` : ""}${i.className ? `.${String(i.className).trim().split(/\s+/)[0]}` : ""}`, src: i.currentSrc, naturalW: i.naturalWidth, w: i.getBoundingClientRect().width, loading: i.getAttribute("loading") || "eager", dentroFascia: !!i.closest("header, footer, nav") }));
}

async function inPaginaBanner() {
  const banner = document.querySelector("[data-banner-cookie]");
  const rett = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const barreOra = () => {
    const elementi = [];
    const barre = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (banner?.contains(el) || el.closest("[inert]") || elementi.some((e) => e.contains(el))) continue;
      if (getComputedStyle(el).position !== "fixed" || !(el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true)) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 200 || r.height < 30 || r.width < innerWidth * 0.3 || r.bottom < innerHeight / 2 || r.top >= innerHeight) continue;
      elementi.push(el);
      barre.push({ sel: `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`, ...rett(el) });
    }
    return barre;
  };
  // la barra d'acquisto è nascosta finché il suo bottone è a schermo e quella della consulenza compare dopo l'hero: si guarda a più posizioni di scorrimento
  const fondo = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const posizioni = [];
  for (const y of new Set([0, innerHeight * 0.75, innerHeight * 1.5, innerHeight * 3, fondo].map((v) => Math.round(Math.min(Math.max(v, 0), fondo))))) {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 450));
    posizioni.push(barreOra());
  }
  scrollTo(0, 0);
  return { banner: banner && banner.checkVisibility?.() ? rett(banner) : null, posizioni, scorribile: ![document.documentElement, document.body].some((e) => /^(hidden|clip)$/.test(getComputedStyle(e).overflowY)) && getComputedStyle(document.body).position !== "fixed" };
}

function inPaginaCodeEventi() {
  const copia = (x) => Array.from(x ?? [], (a) => { try { return JSON.parse(JSON.stringify(Array.from(a))); } catch { return []; } });
  return { fbq: copia(window.fbq?.queue), ttq: copia(window.ttq), dataLayer: copia(window.dataLayer) };
}

/* ══ 11 · IL BROWSER ═════════════════════════════════════════════════════════════════════════════════════════════ */

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const TELEFONO = { width: 390, height: 844 };
const PICCOLO = { width: 320, height: 640 };
const COMPUTER = { width: 1280, height: 800 };
const TABLET = { width: 700, height: 900 };

/** Il filtro di ogni contesto: passa SOLO l'origine di `--base` (mai un'altra porta di loopback, mai `localhost` se la base è 127.0.0.1) e mai le quattro rotte vietate.
 *  Tutto il resto è fermato. Non vede i redirect né i WebSocket: per quelli c'è la regola del resolver nel `launch`. */
export function instradaPer(base) {
  const origine = new URL(base).origin;
  return async (route) => {
    let passa = false;
    try {
      const u = new URL(route.request().url());
      passa = u.origin === origine && !u.username && !u.password && !rottaVietata(u.pathname);
    } catch { /* indirizzo storto: si ferma */ }
    if (passa) await route.continue();
    else await route.abort("blockedbyclient");
  };
}

/** I nomi esterni non si risolvono (redirect, WebSocket e preconnect compresi): solo il loopback. */
export const ARGOMENTI_BROWSER = ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE [::1]"];

async function conPagina(browser, viewport, fn, { dopoRichieste } = {}) {
  const contesto = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width <= 500, hasTouch: viewport.width <= 500, serviceWorkers: "block", locale: "it-IT" });
  const richieste = [];
  try {
    await contesto.route("**/*", instradaPer(browser.base));
    contesto.setDefaultTimeout(15_000);
    contesto.on("request", (r) => richieste.push({ url: r.url(), tipo: r.resourceType() }));
    const pagina = await contesto.newPage();
    return await fn(pagina, contesto, richieste);
  } finally {
    await contesto.close().catch(() => {});
  }
}

async function vai(pagina, base, percorso) {
  await pagina.goto(verificaPercorso(percorso, base), { waitUntil: "load" });
  await pagina.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await pausa(300);
}
/** Scorre fino in fondo e torna su, per far partire le immagini «lazy». */
async function scorri(pagina) {
  await pagina.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    scrollTo(0, 0);
  });
  await pausa(400);
}

/** Più esiti (true, false, null = misura incompleta) → uno: un no vince, poi un null; vuoto = no (mai verde a vuoto). */
export function unisciEsiti(esiti) {
  if (!esiti.length || esiti.includes(false)) return false;
  return esiti.includes(null) ? null : true;
}

/** Per ogni pagina e larghezza: raccoglie dentro la pagina, valuta con la funzione pura; il punto è ok solo se lo sono tutte. */
async function perPagine(browser, o, larghezze, { id, criteri, raccogli, valuta, prima }) {
  const dettagli = [];
  for (const percorso of o.pagine) {
    for (const larghezza of larghezze) {
      const r = await conPagina(browser, larghezza, async (pagina, contesto, richieste) => {
        await vai(pagina, o.base, percorso);
        if (prima) await prima(pagina);
        return valuta(await pagina.evaluate(raccogli), richieste, pagina, percorso);
      });
      dettagli.push({ ok: r.ok === true, esito: r.ok, testo: `${percorso} @${larghezza.width}: ${r.dettaglio}` });
    }
  }
  const guasti = dettagli.filter((d) => !d.ok).map((d) => d.testo);
  return { id, criteri, ok: unisciEsiti(dettagli.map((d) => d.esito)), dettaglio: guasti.length ? guasti.join(" | ") : `${dettagli.length} misure, tutte ok (${dettagli[0]?.testo ?? "nessuna"})` };
}

const saltato = (id, criteri, perche) => ({ id, criteri, ok: null, dettaglio: `saltato: ${perche}` });
const CERCA_ACCETTA = /^accetta/i;
const CERCA_RIFIUTA = /^rifiuta/i;
const AGGIUNGI = /aggiungi al carrello/i;

async function sceltaBanner(browser, o, bottone, vuoleAggiungere) {
  return conPagina(browser, TELEFONO, async (pagina, _c, richieste) => {
    await vai(pagina, o.base, o.scheda);
    const dentro = pagina.locator("[data-banner-cookie]").getByRole("button", { name: bottone }).first();
    if (!(await dentro.isVisible().catch(() => false))) return { banner: false, richieste, eventi: [] };
    await dentro.click();
    await pausa(800);
    await pagina.reload({ waitUntil: "load" });
    await pagina.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    if (vuoleAggiungere) { await pagina.getByRole("button", { name: AGGIUNGI }).first().click().catch(() => {}); await pausa(1200); }
    return { banner: true, richieste, eventi: normalizzaEventi(await pagina.evaluate(inPaginaCodeEventi)) };
  });
}

const PUNTI = [
  { id: "T3-pieni", criteri: ["V1-T3"], esegui: (b, o) => perPagine(b, o, [TELEFONO, COMPUTER], { id: "T3-pieni", criteri: ["V1-T3"], raccogli: inPaginaPieni, valuta: controllaPieni }) },
  {
    id: "T10-prima-scelta", criteri: ["V1-T10"],
    esegui: async (b, o) => perPagine(b, o, [TELEFONO], { id: "T10-prima-scelta", criteri: ["V1-T10"], raccogli: inPaginaCodeEventi, prima: () => pausa(1200), valuta: (_d, richieste) => controllaTerzeParti(richieste, TUTTE) }),
  },
  {
    id: "T10-accetta", criteri: ["V1-T10"],
    esegui: async (b, o) => {
      if (!o.scheda) return saltato("T10-accetta", ["V1-T10"], "serve --scheda e --sku");
      const r = await sceltaBanner(b, o, CERCA_ACCETTA, true);
      if (!r.banner) return { id: "T10-accetta", criteri: ["V1-T10"], ok: false, dettaglio: "il banner o il bottone «Accetta» non c'è" };
      const e = controllaAccetta(r.eventi, o.sku, [{ nome: "ViewContent" }, { nome: "AddToCart" }]);
      const stripe = controllaTerzeParti(r.richieste, ["stripe"]);
      return { id: "T10-accetta", criteri: ["V1-T10"], ok: e.ok && stripe.ok, dettaglio: `${e.dettaglio}; ${stripe.dettaglio}` };
    },
  },
  {
    id: "T10-rifiuta", criteri: ["V1-T10"],
    esegui: async (b, o) => {
      if (!o.scheda) return saltato("T10-rifiuta", ["V1-T10"], "serve --scheda e --sku");
      const r = await sceltaBanner(b, o, CERCA_RIFIUTA, true);
      if (!r.banner) return { id: "T10-rifiuta", criteri: ["V1-T10"], ok: false, dettaglio: "il banner o il bottone «Rifiuta» non c'è" };
      const e = controllaRifiuta(r.richieste, r.eventi);
      return { id: "T10-rifiuta", criteri: ["V1-T10"], ok: e.ok, dettaglio: e.dettaglio };
    },
  },
  { id: "T11-bersagli", criteri: ["V1-T11"], esegui: (b, o) => perPagine(b, o, [TELEFONO], { id: "T11-bersagli", criteri: ["V1-T11"], raccogli: inPaginaBersagli, valuta: controllaBersagli }) },
  { id: "T11-campi", criteri: ["V1-T11"], esegui: (b, o) => perPagine(b, o, [TELEFONO], { id: "T11-campi", criteri: ["V1-T11"], raccogli: inPaginaCampi, valuta: controllaCampi }) },
  { id: "T11-barre320", criteri: ["V1-T11"], esegui: (b, o) => perPagine(b, o, [PICCOLO], { id: "T11-barre320", criteri: ["V1-T11"], raccogli: inPaginaBarre, valuta: controllaBarre }) },
  {
    // shortcut: il testo al 200 % si approssima con `font-size: 200%` sulla radice (cambiano le misure in rem, non lo zoom vero del browser); lo zoom vero si guarda a mano in T103c.
    id: "T11-testo200", criteri: ["V1-T11"],
    esegui: (b, o) => perPagine(b, o, [TELEFONO], { id: "T11-testo200", criteri: ["V1-T11"], prima: async (p) => { await p.addStyleTag({ content: "html{font-size:200% !important}" }); await pausa(300); }, raccogli: inPaginaBarre, valuta: (d) => { const r = controllaBarre(d); return { ...r, dettaglio: `${r.dettaglio} [approssimazione: font-size 200% sulla radice, non lo zoom vero del testo; testo tagliato e sovrapposizioni a mano in T103c]` }; } }),
  },
  { id: "T12-h1", criteri: ["V1-T12"], esegui: (b, o) => perPagine(b, o, [TELEFONO], { id: "T12-h1", criteri: ["V1-T12"], raccogli: () => [...document.querySelectorAll("h1")].filter((h) => h.checkVisibility?.() ?? true).length, valuta: controllaH1 }) },
  {
    id: "T12-finestra", criteri: ["V1-T12"],
    esegui: async (b, o) => {
      if (!o.finestra) return saltato("T12-finestra", ["V1-T12"], "serve --finestra con il selettore CSS del bottone che apre una finestra (menu, ricerca, galleria…)");
      return conPagina(b, TELEFONO, async (pagina) => {
        await vai(pagina, o.base, o.pagine[0]);
        const apre = pagina.locator(o.finestra).first();
        await apre.click();
        await pausa(500);
        const nelleFinestre = () => pagina.evaluate(() => { const f = document.querySelector('[role="dialog"]:not([data-banner-cookie]), dialog[open], [aria-modal="true"]'); return { aperta: !!f && (f.checkVisibility?.() ?? true), ariaModal: f ? f.getAttribute("aria-modal") : null, dentro: !!f && f.contains(document.activeElement) }; });
        const iniziale = await nelleFinestre();
        const fuocoDentro = [];
        for (let i = 0; i < 6 && iniziale.aperta; i++) { await pagina.keyboard.press("Tab"); fuocoDentro.push((await nelleFinestre()).dentro); }
        await pagina.keyboard.press("Escape");
        await pausa(500);
        const chiusa = !(await nelleFinestre()).aperta;
        const restituito = await apre.evaluate((el) => el === document.activeElement || el.contains(document.activeElement));
        const r = controllaFinestra({ aperta: iniziale.aperta, modale: eFinestraModale(iniziale.ariaModal), fuocoDentro, chiusaConEsc: chiusa, fuocoRestituito: restituito });
        return { id: "T12-finestra", criteri: ["V1-T12"], ok: r.ok, dettaglio: r.dettaglio };
      });
    },
  },
  { id: "T13-contrasti", criteri: ["V1-T13"], esegui: (b, o) => perPagine(b, o, [TELEFONO, COMPUTER], { id: "T13-contrasti", criteri: ["V1-T13"], raccogli: inPaginaTesti, valuta: controllaContrasti }) },
  { id: "T14-immagini", criteri: ["V1-T14"], esegui: (b, o) => perPagine(b, o, [TELEFONO, COMPUTER], { id: "T14-immagini", criteri: ["V1-T14"], prima: scorri, raccogli: inPaginaImmagini, valuta: controllaImmagini }) },
  { id: "T14-eager", criteri: ["V1-T14"], esegui: (b, o) => perPagine(b, o, [TELEFONO], { id: "T14-eager", criteri: ["V1-T14"], raccogli: inPaginaImmagini, valuta: controllaEager }) },
  { id: "T14-video", criteri: ["V1-T14"], esegui: (b, o) => perPagine(b, o, [TELEFONO], { id: "T14-video", criteri: ["V1-T14"], raccogli: () => 0, valuta: (_d, richieste) => controllaVideo(richieste) }) },
  {
    id: "H5-impilamento", criteri: ["V1-H5"],
    esegui: (b, o) => perPagine(b, { ...o, pagine: o.scheda ? [...o.pagine, o.scheda] : o.pagine }, [TELEFONO, TABLET], {
      id: "H5-impilamento", criteri: ["V1-H5"], raccogli: inPaginaBanner,
      // shortcut: «la pagina non si blocca» = né `html` né `body` hanno `overflow: hidden`/`clip` e il `body` non è `fixed` (non si prova una rotellina vera: il telefono con la tastiera in T103c)
      valuta: (d, _r, _p, percorso) => controllaImpilamento({ banner: d.banner, posizioni: d.posizioni, paginaScorribile: d.scorribile, barraAttesa: percorso === o.scheda || /carrello|prodotto/.test(percorso) }),
    }),
  },
  {
    id: "T15-offline", criteri: ["V1-T15"],
    esegui: (b, o) => conPagina(b, TELEFONO, async (pagina, contesto) => {
      await vai(pagina, o.base, o.pagine.find((p) => p.includes("carrello")) ?? o.pagine[0]);
      const memoria = () => pagina.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
      const prima = await memoria();
      const avviso = () => pagina.getByText(/connessione.*interrotta/i).first().isVisible().catch(() => false);
      await contesto.setOffline(true);
      await pausa(900);
      const visibile = await avviso();
      await contesto.setOffline(false);
      await pausa(900);
      const sparito = !(await avviso());
      const r = controllaOffline({ avvisoVisibile: visibile, avvisoSparito: sparito, carrelloIntatto: (await memoria()) === prima });
      return { id: "T15-offline", criteri: ["V1-T15"], ok: r.ok, dettaglio: r.dettaglio };
    }),
  },
  {
    // shortcut: «Aggiunto» si legge ogni 100 ms con un `button` che comincia per «Aggiunto»: la durata ha 100-200 ms di incertezza (tolleranza 1,7-2,7 s).
    id: "T15-aggiunto", criteri: ["V1-T15"],
    esegui: async (b, o) => {
      if (!o.scheda) return saltato("T15-aggiunto", ["V1-T15"], "serve --scheda e --sku");
      return conPagina(b, TELEFONO, async (pagina) => {
        await vai(pagina, o.base, o.scheda);
        const dice = () => pagina.evaluate(() => [...document.querySelectorAll("button")].some((x) => /^aggiunto/i.test(x.textContent.trim()) && (x.checkVisibility?.() ?? true)));
        await pagina.getByRole("button", { name: AGGIUNGI }).first().click();
        let inizio = null;
        let durataMs = 0;
        for (const t0 = Date.now(); Date.now() - t0 < 6000; await pausa(100)) {
          const adesso = await dice();
          if (adesso && inizio === null) inizio = Date.now();
          if (!adesso && inizio !== null) { durataMs = Date.now() - inizio; break; }
        }
        const r = controllaAggiunto({ visto: inizio !== null, durataMs });
        return { id: "T15-aggiunto", criteri: ["V1-T15"], ok: r.ok, dettaglio: r.dettaglio };
      });
    },
  },
  {
    // shortcut: gli scheletri si cercano con `[data-scheletro], [aria-busy="true"], .animate-pulse` e l'attesa si crea ritardando di 1,5 s le chiamate `/_serverFn/`; se i nomi cambiano, cambiare qui.
    id: "T15-scheletri", criteri: ["V1-T15"],
    esegui: async (b, o) => {
      if (!o.scheda) return saltato("T15-scheletri", ["V1-T15"], "serve --scheda (un collegamento alla scheda dalla prima pagina)");
      return conPagina(b, TELEFONO, async (pagina) => {
        await vai(pagina, o.base, o.pagine[0]);
        const percorso = new URL(verificaPercorso(o.scheda, o.base)).pathname;
        const link = pagina.locator(`a[href="${percorso}"]`).first();
        if (!(await link.count())) return { id: "T15-scheletri", criteri: ["V1-T15"], ok: null, dettaglio: `saltato: nella pagina ${o.pagine[0]} non c'è un collegamento a ${percorso}` };
        await pagina.route(/\/_serverFn\//, async (route) => { await pausa(1500); await route.fallback(); });
        const campioni = [];
        const t0 = Date.now();
        const click = link.click();
        while (Date.now() - t0 < 900) {
          campioni.push({ ms: Date.now() - t0, presente: await pagina.evaluate(() => !!document.querySelector('[data-scheletro], [aria-busy="true"], .animate-pulse')) });
          await pausa(50);
        }
        await click.catch(() => {});
        const r = controllaScheletri(campioni);
        return { id: "T15-scheletri", criteri: ["V1-T15"], ok: r.ok, dettaglio: r.dettaglio };
      });
    },
  },
  {
    id: "D105-ricerca", criteri: ["D105", "V1-T14"],
    esegui: async (b, o) => {
      if (o.scenario !== "stress") return saltato("D105-ricerca", ["D105", "V1-T14"], "serve la vetrina finta con lo scenario stress e --scenario stress");
      return conPagina(b, TELEFONO, async (pagina, contesto) => {
        const dati = [];
        const html = [];
        contesto.on("response", (r) => {
          const tipo = r.request().resourceType();
          if (!["document", "fetch", "xhr"].includes(tipo)) return;
          (tipo === "document" ? html : dati).push(r.request().sizes().then((s) => s.responseBodySize, () => r.body().then((x) => x.length, () => 0)));
        });
        await vai(pagina, o.base, o.pagine.find((p) => p.includes("cerca")) ?? "/shop/cerca");
        const campo = pagina.locator('input[type="search"], input[name="q"], [role="searchbox"], [role="combobox"]').first();
        if (await campo.count()) { await campo.fill("a"); await pausa(1000); }
        const somma = async (l) => (await Promise.all(l)).reduce((s, x) => s + x, 0);
        const r = controllaPeso(await somma(dati), undefined, await somma(html));
        return { id: "D105-ricerca", criteri: ["D105", "V1-T14"], ok: r.ok, dettaglio: `${r.dettaglio}; scenario stress dichiarato a mano (--scenario), 50 prodotti da verificare` };
      });
    },
  },
];

/** Lancia i punti scelti. Il browser si chiude sempre; un punto che lancia diventa un punto no col messaggio. Playwright viene passato da fuori. */
export async function misura(pw, opzioni) {
  let browser;
  try { browser = await pw.chromium.launch({ channel: opzioni.canale, headless: true, args: ARGOMENTI_BROWSER }); }
  catch { throw new ErroreMisura(messaggioBrowserMancante(opzioni.canale)); }
  const punti = [];
  const ambiente = { newContext: (o) => browser.newContext(o), base: opzioni.base };
  try {
    for (const p of PUNTI) {
      if (!puntoScelto(p.id, opzioni.solo)) continue;
      try { punti.push(await p.esegui(ambiente, opzioni)); }
      catch (e) { punti.push(puntoDaErrore(p.id, p.criteri, e)); }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return riassumi(punti);
}

/* ══ 12 · DALLA RIGA DI COMANDO ══════════════════════════════════════════════════════════════════════════════════ */

async function main() {
  const { aiuto, errori, opzioni } = leggiArgomenti(process.argv.slice(2), process.env);
  if (aiuto) { console.log(`${COME_SI_USA}\n\n${COME_PREPARARE}\n\nUscita: 0 tutto ok · 1 almeno un no · 2 non si è potuto misurare · 3 nessun no ma non tutto misurato (punti null: saltati o incompleti)\n\nPunti: ${PUNTI.map((p) => p.id).join(", ")}`); return 0; }
  if (errori.length) { console.error(`RIFIUTATO: ${errori.join("\nRIFIUTATO: ")}\n${COME_SI_USA}`); return 2; }
  const { pw, errore } = await caricaPlaywright(opzioni.playwright);
  if (errore) { console.error(errore); return 2; }
  try {
    console.error(`Misuro ${opzioni.base} (solo indirizzi locali; ogni richiesta esterna viene fermata)…`);
    const esito = await misura(pw, opzioni);
    console.log(JSON.stringify({ strumento: "misura-vetrina", base: opzioni.base, ...esito }, null, 2));
    return codiceUscita(esito);
  } catch (e) {
    console.error(e instanceof ErroreMisura ? e.message : `Errore imprevisto: ${String(e?.message ?? e).split("\n")[0]}`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
