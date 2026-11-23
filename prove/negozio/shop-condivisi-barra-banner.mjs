/** ── VETRINA V1 · T84b1 · BARRA DELLA CONSULENZA E BANNER COOKIE: LA LANDING NON DEVE CAMBIARE ─────────────────
 *  `BarraConsulenza.tsx` (landing e sito pubblico) e `BannerCookie.tsx` (tutto il sito) sono file CONDIVISI: la vetrina nuova li
 *  usa, la landing li usa già. PIANO-V1 D83, T84b1; criteri V1-H5 (impilamento), V1-T13 (hover scuro), V1-T3.
 *  Prova DOPPIA, perché da sola nessuna delle due basta:
 *   (1) IL SORGENTE CONTRO IL BASE (`git show 99d94d3:<file>`): ammesse le righe AGGIUNTE e le sole righe SPOSTATE nella funzione pura
 *       `classiBarra`, con la stringa di classe uguale byte per byte (la prova la ritrova nel corpo della funzione). Qualunque altra riga
 *       tolta o cambiata è rossa. Senza la storia git la prova è rossa con una frase chiara (non «passa» per assenza).
 *       Una sola riga cambiata è dichiarata e fissata alla lettera: la firma di `BarraConsulenza`, che deve prendere le due proprietà.
 *   (2) IL DISEGNO VERO: `BannerCookie` con e senza la riga `data-banner-cookie` (e col base) → unica differenza l'attributo; `classiBarra`
 *       provata con ogni combinazione; `BarraConsulenza` di per sé non disegna nulla in `react-dom/server` (D83), quindi vale la funzione pura.
 *  Niente rete, niente database: dati inventati. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { rendiComponente } from "./_rende.mjs";

const BASE = "99d94d3";
const F_BARRA = "src/components/landing/consulenza/BarraConsulenza.tsx";
const F_BANNER = "src/components/tracciamento/BannerCookie.tsx";

/** La firma di oggi e quella nuova: l'UNICA riga tolta che non è una stringa di classe spostata. */
const FIRMA_BASE = "export function BarraConsulenza({ provenienza, prodotto }: Props) {";
const FIRMA_NUOVA = "export function BarraConsulenza({ provenienza, prodotto, sopraAlBanner = false, hoverScuro = false }: Props) {";
const RIGA_BANNER = 'data-banner-cookie=""';

/** Il sorgente del file com'era nel commit di base; `null` se la storia git non c'è. */
function dalBase(radice, file) {
  try {
    return execFileSync("git", ["show", `${BASE}:${file}`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 24 });
  } catch {
    return null;
  }
}

/** Righe tolte e righe aggiunte fra due testi (sottosequenza comune più lunga, righe intere). */
function differenze(prima, dopo) {
  const a = prima.split("\n");
  const b = dopo.split("\n");
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const tolte = [];
  const aggiunte = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; }
    else if (j < b.length && (i === a.length || L[i][j + 1] >= L[i + 1][j])) aggiunte.push(b[j++]);
    else tolte.push(a[i++]);
  }
  return { tolte, aggiunte };
}

/** Il corpo di `classiBarra`: dalla sua riga fino alla prima `}` in prima colonna. Vuoto se la funzione non c'è. */
function corpoClassiBarra(src) {
  const i = src.indexOf("export function classiBarra");
  if (i < 0) return "";
  const fine = src.indexOf("\n}", i);
  return fine < 0 ? "" : src.slice(i, fine + 2);
}

/** Una riga tolta è «spostata» se, tolte le stringhe di classe (che devono stare, uguali, nel corpo di `classiBarra`) e la colla di JSX,
 *  non resta niente. Restituisce il perché se non lo è. */
function spiegaRigaTolta(riga, corpo) {
  if (riga.trim() === "") return null;
  let resto = riga;
  const letterali = [...riga.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  resto = resto.replace(/"[^"]*"/g, "");
  for (const m of resto.matchAll(/`([^`$]*)/g)) letterali.push(m[1]);
  resto = resto.replace(/`[^`$]*/g, "`");
  for (const l of letterali) {
    if (l.trim() !== "" && !corpo.includes(l.trim())) return `la stringa «${l.trim().slice(0, 40)}…» non sta uguale nel corpo di classiBarra`;
  }
  resto = resto.replace(/className|visibile/g, "");
  if (!/^[\s={}$`?:]*$/.test(resto)) return `contiene altro che stringhe di classe: «${riga.trim().slice(0, 60)}»`;
  return null;
}

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T84b1 · BARRA DELLA CONSULENZA E BANNER COOKIE (23/11/2026)");
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const barra = leggi(F_BARRA);
  const banner = leggi(F_BANNER);
  const barraBase = dalBase(radice, F_BARRA);
  const bannerBase = dalBase(radice, F_BANNER);
  const tmp = mkdtempSync(join(tmpdir(), "prova-t84b1-"));
  try {
    /* ───────────────── 1 · IL SORGENTE CONTRO IL BASE ───────────────── */
    const storia = barraBase !== null && bannerBase !== null;
    c(`la storia git c'è (commit ${BASE}): senza, il diff non si può fare e la prova è ROSSA, non verde`, true, storia);

    if (storia) {
      /* BarraConsulenza */
      const dB = differenze(barraBase, barra);
      const corpo = corpoClassiBarra(barra);
      c("`classiBarra` è una funzione esportata (corpo trovato)", true, corpo !== "");
      const tolteB = dB.tolte.filter((r) => r !== FIRMA_BASE);
      c("BarraConsulenza: nessuna riga tolta che non sia una stringa di classe SPOSTATA in `classiBarra` (stessi byte) o la firma",
        [], tolteB.map((r) => [r.trim().slice(0, 50), spiegaRigaTolta(r, corpo)]).filter(([, perche]) => perche !== null));
      c("BarraConsulenza: le stringhe di classe tolte ci sono tutte (almeno una per il contenitore e una per il bottone)", true,
        dB.tolte.some((r) => r.includes("fixed inset-x-0")) && dB.tolte.some((r) => r.includes("bg-brand-scuro")));
      c("BarraConsulenza: la firma cambia solo per le due proprietà, con valore di partenza `false` (= la landing di oggi)",
        [true, [FIRMA_NUOVA], dB.tolte.includes(FIRMA_BASE)], [dB.tolte.includes(FIRMA_BASE), dB.aggiunte.filter((r) => r.startsWith("export function BarraConsulenza")), barra.includes(FIRMA_NUOVA)]);
      c("BarraConsulenza: la funzione, l'export di default e le tracce di oggi ci sono ancora", [true, true, true, true, true],
        ["export default BarraConsulenza;", 'traccia("consulenza_barra_vista"', 'traccia("consulenza_barra_click"', 'traccia("consulenza_barra_chiusa"', "data-barra-consulenza"].map((s) => barra.includes(s)));
      c("BarraConsulenza: i due elementi usano `classiBarra({ visibile, sopraAlBanner, hoverScuro })`",
        [true, true, true], [/classiBarra\(\{\s*visibile,\s*sopraAlBanner,\s*hoverScuro\s*\}\)/.test(barra), /className=\{classi\.contenitore\}/.test(barra), /className=\{classi\.bottone\}/.test(barra)]);

      /* BannerCookie: UNA riga in più, nessuna tolta */
      const dN = differenze(bannerBase, banner);
      c("BannerCookie: nessuna riga tolta", [], dN.tolte);
      c("BannerCookie: UNA sola riga aggiunta, ed è l'attributo `data-banner-cookie`", [RIGA_BANNER], dN.aggiunte.map((r) => r.trim()));
    }

    /* ───────────────── 2 · IL DISEGNO VERO ───────────────── */
    /* BannerCookie con la riga, senza la riga e (se c'è la storia) com'era nel base: i file di prova stanno nella cartella temporanea,
       con le importazioni relative riscritte sul posto vero (`./controllo`, `./testi-cookie`). */
    const dirBanner = join(radice, dirname(F_BANNER));
    const altrove = (src) => src.replace(/from "\.\/([^"]+)"/g, (_, n) => `from ${JSON.stringify(join(dirBanner, n))}`);
    const senzaRiga = banner.split("\n").filter((r) => !r.includes("data-banner-cookie")).join("\n");
    writeFileSync(join(tmp, "BannerConRiga.tsx"), altrove(banner));
    writeFileSync(join(tmp, "BannerSenzaRiga.tsx"), altrove(senzaRiga));
    if (bannerBase !== null) writeFileSync(join(tmp, "BannerBase.tsx"), altrove(bannerBase));

    const finti = { onScelta() {}, onChiudi() {} };
    const SCENARI = {
      "domanda (prima volta)": { ...finti, attuale: null },
      "scelte, banner riaperto": { ...finti, attuale: { statistiche: true, marketing: false }, vistaIniziale: "scelte", daUtente: true },
      "conferma salvata": { ...finti, attuale: null, esito: "ok" },
      "errore del browser": { ...finti, attuale: null, esito: "errore" },
    };
    for (const [nome, props] of Object.entries(SCENARI)) {
      const disegna = async (f) => (await rendiComponente(radice, join(tmp, f), "BannerCookie", props)).html;
      const con = await disegna("BannerConRiga.tsx");
      const senza = await disegna("BannerSenzaRiga.tsx");
      c(`BannerCookie (${nome}): è il banner vero (dialogo, non una stringa vuota)`, true, con.length > 200 && /role="dialog"/.test(con));
      c(`BannerCookie (${nome}): l'attributo c'è una volta, sul dialogo, e senza la riga non c'è`,
        [1, true, 0], [con.split("data-banner-cookie").length - 1, /^<div[^>]*role="dialog"[^>]*data-banner-cookie=""/.test(con), senza.split("data-banner-cookie").length - 1]);
      c(`BannerCookie (${nome}): UNICA differenza è l'attributo (tolto, l'HTML è uguale byte per byte)`, senza, con.replace(` ${RIGA_BANNER}`, ""));
      if (bannerBase !== null) c(`BannerCookie (${nome}): senza l'attributo è identico al base`, (await disegna("BannerBase.tsx")), con.replace(` ${RIGA_BANNER}`, ""));
    }

    /* classiBarra con ogni combinazione, e BarraConsulenza che di per sé non disegna nulla (D83). */
    c("`classiBarra` è esportata dal sorgente", true, /export function classiBarra\(/.test(barra));
    if (/export function classiBarra\(/.test(barra)) {
      const COMBO = [];
      for (const visibile of [true, false]) for (const sopraAlBanner of [false, true]) for (const hoverScuro of [false, true]) COMBO.push({ visibile, sopraAlBanner, hoverScuro });
      writeFileSync(join(tmp, "Classi.tsx"), `import { classiBarra } from ${JSON.stringify(join(radice, F_BARRA))};
        export const Classi = ({ combo }) => <pre>{JSON.stringify(combo.map((o) => classiBarra(o)))}</pre>;
        export const ClassiSenza = () => <pre>{JSON.stringify(classiBarra({ visibile: true }))}</pre>;`);
      const leggiJson = (html) => JSON.parse(html.replace(/^<pre>|<\/pre>$/g, "").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&"));
      const classi = leggiJson((await rendiComponente(radice, join(tmp, "Classi.tsx"), "Classi", { combo: COMBO })).html);
      const soloVisibile = leggiJson((await rendiComponente(radice, join(tmp, "Classi.tsx"), "ClassiSenza", {})).html);

      /* Le stringhe di oggi, lette dal BASE (se manca la storia, dal solo sorgente: il controllo di sopra è già rosso). */
      const sorgenteDiOggi = barraBase ?? barra;
      const contenitoreOggi = (v) => {
        const m = sorgenteDiOggi.match(/className=\{`([^`$]*)\$\{\s*visibile \? "([^"]*)" : "([^"]*)"\s*\}`\}/);
        return m ? m[1] + (v ? m[2] : m[3]) : null;
      };
      const bottoneOggi = sorgenteDiOggi.match(/onClick=\{apri\}\s*className="([^"]*)"/)?.[1] ?? null;
      c("le stringhe di oggi si ritrovano nel base (la prova sa cosa confrontare)", [true, true], [contenitoreOggi(true) !== null, bottoneOggi !== null]);

      const PIU = "max-sm:bottom-[var(--banner-h,0px)]";
      COMBO.forEach((o, k) => {
        const r = classi[k];
        const nome = `visibile=${o.visibile} sopraAlBanner=${o.sopraAlBanner} hoverScuro=${o.hoverScuro}`;
        if (!o.sopraAlBanner) c(`classiBarra (${nome}): il contenitore è quello di oggi, byte per byte`, contenitoreOggi(o.visibile), r.contenitore);
        else c(`classiBarra (${nome}): il contenitore è quello di oggi più UNA classe, `+ "`bottom` sotto il banner solo sul telefono", contenitoreOggi(o.visibile) + " " + PIU, r.contenitore);
        if (!o.hoverScuro) c(`classiBarra (${nome}): il bottone è quello di oggi, byte per byte`, bottoneOggi, r.bottone);
        else c(`classiBarra (${nome}): il bottone è quello di oggi con SOLO l'hover più scuro (mai più chiaro: 4,2:1 → ≥ 4,5:1)`,
          [bottoneOggi.replace("hover:brightness-110", "hover:brightness-90"), false, true], [r.bottone, r.bottone.includes("brightness-110"), r.bottone.includes("hover:brightness-90")]);
      });
      c("classiBarra senza opzioni (`visibile` sola) = la landing di oggi", [contenitoreOggi(true), bottoneOggi], [soloVisibile[0]?.contenitore ?? soloVisibile.contenitore, soloVisibile[0]?.bottone ?? soloVisibile.bottone]);
      c("la barra nascosta è invisibile e fuori schermo (con `inert` nel componente), in ogni combinazione",
        COMBO.filter((o) => !o.visibile).map(() => true), COMBO.map((o, k) => [o, classi[k]]).filter(([o]) => !o.visibile).map(([, r]) => /\binvisible translate-y-full\b/.test(r.contenitore) && !/\btranslate-y-0\b/.test(r.contenitore)));
    }

    /* D83: la barra non disegna nulla sul server (legge `sessionStorage` solo dopo il montaggio): lo provo, così se un giorno disegna la landing
       cambia HTML e questa prova lo dice. */
    let disegno = null;
    try { disegno = (await rendiComponente(radice, join(radice, F_BARRA), "BarraConsulenza", { provenienza: "consulenza" }, { pathname: "/" })).html; } catch (e) { disegno = `ERRORE: ${e.message.slice(0, 120)}`; }
    c("BarraConsulenza non disegna nulla in react-dom/server (D83): l'HTML della landing non cambia", "", disegno);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
