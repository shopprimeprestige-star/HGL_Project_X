/** ── NEGOZIO · V1 · T73 · I BLOCCHI DELLA LANDING ESTRATTI NON CAMBIANO LA LANDING ──
 *  `Pillola`, `Testata`, `Pilastro`, `Trascrizione` (e le costanti `SEZIONE` e `H2`) stavano scritti due volte, in
 *  `routes/invisible-derm.tsx` e `routes/invisible-derm-v1.tsx`; ora stanno in `components/landing/blocchi.tsx`.
 *  La landing porta le prenotazioni ed è online: il suo HTML deve restare IDENTICO, anche di un solo byte.
 *  Il file `_istantanea-blocchi.json` è la fotografia presa PRIMA dell'estrazione, dal commit di base 99d94d3:
 *   - il testo dei blocchi (uguale nelle due pagine, carattere per carattere);
 *   - l'HTML reso delle due pagine in due scenari (senza media, con tutti i media): impronta sha256 e lunghezza (l'HTML intero
 *     pesa mezzo megabyte; per vederlo si rifà con `--scatta` su un'altra copia del commit di base).
 *  La prova controlla: (1) i blocchi in `blocchi.tsx` sono quelli dell'istantanea; (2) le pagine non li definiscono più
 *  e li importano, mentre `Cta`, `Bottone` e il contesto del popup sono rimasti dove stavano; (3) l'HTML di oggi è uguale
 *  a quello fotografato.
 *  Per rifare l'istantanea (solo da un commit di base che si vuole riconoscere): `node prove/negozio/blocchi-istantanea.mjs --scatta`.
 *  Non tocca database: i server e il router sono finti, gli effetti (`useEffect`) non girano. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const requireQui = createRequire(import.meta.url);
const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, "..", "..");
const ISTANTANEA = join(QUI, "_istantanea-blocchi.json");
const BASE = "99d94d3";
const PAGINE = { "invisible-derm": "src/routes/invisible-derm.tsx", "invisible-derm-v1": "src/routes/invisible-derm-v1.tsx" };
const BLOCCHI = ["Pillola", "Testata", "Pilastro", "Trascrizione"];
const COSTANTI = ["SEZIONE", "H2"];

/** Il testo di ogni blocco, com'è scritto in `sorgente` (senza l'eventuale `export `): funzione dalla sua riga fino alla `}` a inizio riga, costante su una riga. */
export function estraiBlocchi(sorgente) {
  const fuori = {};
  for (const n of BLOCCHI) fuori[n] = sorgente.match(new RegExp(`^(?:export )?(function ${n}\\([\\s\\S]*?^\\})$`, "m"))?.[1] ?? null;
  for (const n of COSTANTI) fuori[n] = sorgente.match(new RegExp(`^(?:export )?(const ${n} = .*;)$`, "m"))?.[1] ?? null;
  return fuori;
}

// ── il disegno vero della pagina, con router, tracciamenti e server finti (nessun database, nessuna rete) ──
const FINTI = {
  "@tanstack/react-router": `
    import React from "react";
    export const createFileRoute = () => (opts) => opts;
    export const Link = ({ to, children, className }) => React.createElement("a", { href: String(to), className }, children);
    export const useRouterState = ({ select }) => select({ location: { pathname: globalThis.__percorso, searchStr: "" } });`,
  "@/integrations/supabase/client": `export const supabase = { auth: { getSession: async () => ({ data: { session: null } }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), insert: async () => ({ error: null }) }) };`,
};

/** Disegna `componente` di `file` e restituisce l'HTML. `pieno`: ogni testo e ogni media della landing ha un valore (si vedono i rami con video, foto e trascrizione). */
async function disegna(file, pieno) {
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-blocchi-"));
  try {
    globalThis.__percorso = "/" + file.match(/routes\/(.*)\.tsx$/)[1];
    const contenuto = join(RADICE, "src/landing/landing-content.ts");
    const entrata = join(dir, "entrata.tsx");
    writeFileSync(
      entrata,
      `import { renderToStaticMarkup } from "react-dom/server";
       import React from "react";
       import { Route } from ${JSON.stringify(join(RADICE, file))};
       export const html = () => renderToStaticMarkup(React.createElement(Route.component));`,
    );
    const r = await esbuild.build({
      entryPoints: [entrata],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      loader: { ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl", ".webp": "dataurl", ".jpg": "dataurl" },
      alias: { "@": join(RADICE, "src") },
      absWorkingDir: RADICE,
      nodePaths: [join(RADICE, "node_modules")],
      logLevel: "silent",
      define: { "import.meta.env": `{"VITE_SUPABASE_URL":"https://prova.test","VITE_SUPABASE_PUBLISHABLE_KEY":"chiave-di-prova"}` },
      plugins: [
        {
          name: "finti",
          setup(b) {
            b.onResolve({ filter: /^@tanstack\/react-router$|^@\/integrations\/supabase\/client$/ }, (a) => ({ path: a.path, namespace: "finto" }));
            // il contenuto vero della landing, con tutti i media riempiti quando lo scenario è «pieno»
            b.onResolve({ filter: /^@\/landing\/landing-content$/ }, (a) => ({ path: a.path, namespace: "contenuto" }));
            b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI[a.path], loader: "tsx", resolveDir: RADICE }));
            b.onLoad({ filter: /.*/, namespace: "contenuto" }, () => ({
              contents: `export * from ${JSON.stringify(contenuto)};
                import { useLandingContent as vero } from ${JSON.stringify(contenuto)};
                export const useLandingContent = () => {
                  const r = vero();
                  if (!${pieno}) return r;
                  return { ...r, text: (k) => r.text(k) || "Testo di prova " + k, media: (k) => r.media(k) || "https://prova.test/" + k + (/video|clip/i.test(k) ? ".mp4" : ".jpg") };
                };`,
              loader: "ts",
              resolveDir: RADICE,
            }));
          },
        },
      ],
    });
    const f = join(dir, "pagina.cjs");
    writeFileSync(f, r.outputFiles[0].text);
    return requireQui(f).html();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const sha = (t) => createHash("sha256").update(t).digest("hex");
const SCENARI = { vuoto: false, pieno: true };

/** L'HTML di ogni pagina in ogni scenario, così com'è oggi. */
// Il calendario delle prenotazioni della landing disegna i giorni a partire da «oggi»: l'HTML cambia ogni giorno. Si disegna
// sempre con l'orologio fermo a questo istante (l'istantanea risulta identica con questa data), poi l'orologio vero torna.
export const DATA_FOTO = "2026-11-23T12:00:00Z";
async function conOrologioFermo(fn) {
  const Vero = globalThis.Date;
  const fermo = new Vero(DATA_FOTO).getTime();
  class Fermo extends Vero {
    constructor(...a) { super(...(a.length ? a : [fermo])); }
    static now() { return fermo; }
  }
  globalThis.Date = Fermo;
  try { return await fn(); } finally { globalThis.Date = Vero; }
}

async function fotografaHtml() {
  return conOrologioFermo(async () => {
    const fuori = {};
    for (const [nome, file] of Object.entries(PAGINE)) {
      fuori[nome] = {};
      for (const [scenario, pieno] of Object.entries(SCENARI)) fuori[nome][scenario] = await disegna(file, pieno);
    }
    return fuori;
  });
}

// ── scatto dell'istantanea: si lancia a mano, sul commit di base, prima di estrarre ──
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes("--scatta")) {
  const sorgenti = Object.fromEntries(Object.entries(PAGINE).map(([n, f]) => [n, estraiBlocchi(readFileSync(join(RADICE, f), "utf8"))]));
  const html = await fotografaHtml();
  for (const n of Object.keys(html)) for (const s of Object.keys(html[n])) html[n][s] = { sha256: sha(html[n][s]), lunghezza: html[n][s].length };
  const identiche = [...BLOCCHI, ...COSTANTI].every((k) => sorgenti["invisible-derm"][k] && sorgenti["invisible-derm"][k] === sorgenti["invisible-derm-v1"][k]);
  writeFileSync(ISTANTANEA, JSON.stringify({ base: BASE, identiche, sorgenti: sorgenti["invisible-derm-v1"], html }, null, 1) + "\n");
  console.log(`istantanea scritta: blocchi identici nelle due pagine = ${identiche}`);
}

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · V1 · T73: I BLOCCHI DELLA LANDING ESTRATTI, LA LANDING NON CAMBIA (23/11/2026)");
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const foto = JSON.parse(readFileSync(ISTANTANEA, "utf8"));
  const tutti = [...BLOCCHI, ...COSTANTI];

  // ── l'istantanea è quella del commit di base (se la storia c'è) e le due copie erano uguali ──
  c("istantanea: presa dal commit di base 99d94d3", BASE, foto.base);
  c("istantanea: le due copie dei blocchi erano identiche (si estrae da entrambe le pagine)", true, foto.identiche);
  c("istantanea: ci sono tutti i blocchi e le due costanti", [], tutti.filter((k) => !foto.sorgenti[k]));
  for (const [nome, file] of Object.entries(PAGINE)) {
    let base = null;
    try {
      base = execFileSync("git", ["show", `${BASE}:${file}`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      /* storia non disponibile (copia senza .git): il confronto col commit si salta, resta quello con il JSON */
    }
    if (base !== null) c(`istantanea: i blocchi di ${nome} nel commit ${BASE} sono quelli del JSON`, foto.sorgenti, estraiBlocchi(base));
  }

  // ── blocchi.tsx: i corpi sono quelli dell'istantanea, byte per byte, e sono esportati ──
  const blocchi = leggi("src/components/landing/blocchi.tsx");
  const inBlocchi = estraiBlocchi(blocchi);
  c("blocchi.tsx: ogni blocco e le costanti sono uguali all'istantanea (carattere per carattere)", [], tutti.filter((k) => inBlocchi[k] !== foto.sorgenti[k]));
  c("blocchi.tsx: esporta i quattro blocchi e le costanti SEZIONE e H2", [], tutti.filter((k) => !new RegExp(`^export (?:function|const) ${k}\\b`, "m").test(blocchi)));
  c("blocchi.tsx: non definisce Cta, Bottone né il contesto del popup (restano nelle pagine)", false, /\b(?:function|const) (?:Cta|Bottone|ApriPrenota|PopupPrenota)\b|createContext/.test(blocchi));

  // ── le pagine: non definiscono più i blocchi, li importano; Cta e Bottone non si sono mossi ──
  for (const [nome, file] of Object.entries(PAGINE)) {
    const t = leggi(file);
    const importo = t.match(/import \{([^}]*)\} from "@\/components\/landing\/blocchi";/)?.[1] ?? "";
    const importati = importo.split(",").map((s) => s.trim()).filter(Boolean);
    c(`${nome}: non definisce più i blocchi né le costanti`, [], tutti.filter((k) => new RegExp(`^(?:export )?(?:function|const) ${k}\\b`, "m").test(t)));
    c(`${nome}: importa da blocchi.tsx i quattro blocchi e le costanti`, [...tutti].sort(), importati.sort());
    c(`${nome}: Cta e Bottone sono ancora scritti nella pagina`, [true, true], [/^function Cta\(\{ traccia \}/m.test(t), /^function Bottone\(\{ traccia/m.test(t)]);
  }

  // ── l'HTML di oggi è quello fotografato ──
  const oggi = await fotografaHtml();
  const ancora = await fotografaHtml();
  for (const nome of Object.keys(PAGINE)) {
    for (const scenario of Object.keys(SCENARI)) {
      const atteso = foto.html[nome][scenario].sha256;
      const html = oggi[nome][scenario];
      c(`${nome} (${scenario}): il disegno non ha parti casuali (due disegni uguali)`, true, html === ancora[nome][scenario]);
      c(`${nome} (${scenario}): HTML uguale all'istantanea, byte per byte (${foto.html[nome][scenario].lunghezza} caratteri)`, atteso, sha(html));
    }
  }
  c("lo scenario «pieno» mostra davvero i rami con media (un `details` di trascrizione e il tasto di un video)", [true, true, true, true],
    Object.keys(PAGINE).flatMap((n) => [/<details/.test(oggi[n].pieno), /Guarda il video/.test(oggi[n].pieno)]));
}
