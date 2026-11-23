/** ── NEGOZIO · T107 · `vite dev` NON DEVE ROMPERSI PER UN IMPORT DEL SERVER DENTRO UN FILE DEL CLIENT ────────────────────
 *  Il guasto (T106, nato in T67): `collaudoDellaRichiesta` (esportata da `catalogo.functions.ts`) faceva `await import("@tanstack/react-start/server")`
 *  fuori da una funzione del server. In `vite dev` quel file finisce anche nel client; `import-protection` di TanStack lo rifiuta con un 500
 *  («Import denied in client environment»), il client non si idrata e si rompe TUTTO `vite dev`, CRM compreso. `vite build` e `collaudo.mjs`
 *  non lo vedono: per questo serve questa prova.
 *  Due parti:
 *   1. il SORGENTE (costa niente): nessun file di `src/` importa in modo dinamico `@tanstack/react-start/server`; l'accesso alle intestazioni
 *      passa da `createServerOnlyFn`;
 *   2. il `vite dev` VERO, in ambiente chiuso (`strumenti/vetrina-finta/avvia.mjs`: finto Supabase su 127.0.0.1, variabili tutte finte): ogni
 *      `*.functions.ts` richiesto come lo chiede il browser non risponde 500, e la rotta `/src/routes/shop.tsx` risponde 200.
 *  ⚠️ Nessun `.env` (il lanciatore si ferma se lo trova), cacheDir di vite in una cartella temporanea (mai la `.vite` condivisa di `node_modules`),
 *  `src/routeTree.gen.ts` rimesso com'era, ogni processo chiuso in un `finally`. */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SERVER_DI_START = /import\(\s*["'`]@tanstack\/react-start\/server["'`]\s*\)/;

/** Tutti i file `.ts`/`.tsx` sotto `cartella` (percorsi assoluti). */
function elenca(cartella) {
  return readdirSync(cartella).flatMap((n) => {
    const p = join(cartella, n);
    return statSync(p).isDirectory() ? elenca(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

const libera = () =>
  new Promise((ok, no) => {
    const s = createServer();
    s.once("error", no);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => ok(port)); });
  });
const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("T107 · `vite dev`: NIENTE import del server nei file del client");
  const src = join(radice, "src");
  const file = elenca(src);

  /* ══ 1 · IL SORGENTE ═══════════════════════════════════════════════════════════════════════════════════════ */
  const dinamici = file.filter((f) => SERVER_DI_START.test(senzaCommenti(readFileSync(f, "utf8")))).map((f) => f.slice(radice.length + 1));
  c("nessun file di src/ fa `import(\"@tanstack/react-start/server\")` dinamico (nel client darebbe «Import denied»)", [], dinamici);
  const funz = readFileSync(join(src, "shop/cms/catalogo.functions.ts"), "utf8");
  c("catalogo.functions.ts: `collaudoDellaRichiesta` legge il cookie con `createServerOnlyFn` (lancia nel client, il `try/catch` risponde `false`)", true, /createServerOnlyFn\(/.test(funz) && /getRequestHeader\(/.test(funz));

  /* ══ 2 · `vite dev` VERO ═══════════════════════════════════════════════════════════════════════════════════ */
  const { avvia, ErroreSalvaguardia } = await import(pathToFileURL(join(radice, "strumenti/vetrina-finta/avvia.mjs")).href);
  const base = mkdtempSync(join(tmpdir(), "vite-dev-client-"));
  const albero = join(radice, "src/routeTree.gen.ts");
  const alberoPrima = existsSync(albero) ? readFileSync(albero, "utf8") : null; // `vite dev` lo rigenera: si rimette com'era
  let avviato = null;
  let log = "";
  try {
    // la configurazione del progetto, con la sola `cacheDir` spostata nella cartella temporanea
    const cartellaCfg = mkdtempSync(join(base, "c-"));
    symlinkSync(join(radice, "node_modules"), join(cartellaCfg, "node_modules"));
    writeFileSync(join(cartellaCfg, "vite.config.mjs"), `import { defineConfig } from "@lovable.dev/vite-tanstack-config";\nexport default defineConfig({ vite: { cacheDir: ${JSON.stringify(join(base, "cache"))} } });\n`);
    const porta = await libera();
    try {
      avviato = await avvia({
        scenario: "completo",
        radice,
        portaApp: porta,
        stdio: ["ignore", "pipe", "pipe"],
        comando: [process.execPath, join(radice, "node_modules/vite/bin/vite.js"), "dev", "--config", join(cartellaCfg, "vite.config.mjs"), "--host", "127.0.0.1", "--port", String(porta), "--strictPort"],
      });
    } catch (e) {
      return c("il lanciatore sicuro avvia `vite dev` (nessun .env, ambiente chiuso)", "ok", e instanceof ErroreSalvaguardia ? `RIFIUTATO: ${e.message}` : String(e?.message ?? e));
    }
    avviato.figlio.stdout.on("data", (d) => { log += d; });
    avviato.figlio.stderr.on("data", (d) => { log += d; });
    const url = (p) => `http://127.0.0.1:${porta}${p}`;
    const chiedi = async (p) => { const r = await fetch(url(p), { signal: AbortSignal.timeout(60_000) }); return { stato: r.status, testo: await r.text() }; };

    let pronto = false;
    for (let i = 0; i < 120 && !pronto; i++) {
      try { pronto = (await chiedi("/shop")).stato === 200; } catch { await aspetta(500); }
    }
    c("`vite dev` risponde su /shop (ambiente chiuso, finto Supabase)", true, pronto);
    if (!pronto) return c("…log di `vite dev`", "", log.slice(-400));

    // come il browser: il modulo si chiede con l'indirizzo del file; un 500 qui è l'«Import denied in client environment»
    const funzioni = file.filter((f) => f.endsWith(".functions.ts")).map((f) => f.slice(radice.length).split("\\").join("/")).sort();
    c("ci sono file `*.functions.ts` da provare (catalogo.functions.ts fra questi)", true, funzioni.includes("/src/shop/cms/catalogo.functions.ts"));
    const stati = {};
    for (const p of funzioni) {
      try { stati[p] = (await chiedi(p)).stato; } catch (e) { stati[p] = `errore: ${String(e?.message ?? e).slice(0, 80)}`; }
    }
    const rotti = Object.entries(stati).filter(([, s]) => s !== 200).map(([p, s]) => `${p} → ${s}`);
    c("nel client nessun `*.functions.ts` risponde 500: ognuno è un modulo normale (200)", [], rotti);
    c("la rotta /src/routes/shop.tsx e la radice del CRM rispondono 200", [200, 200], [(await chiedi("/src/routes/shop.tsx")).stato, (await chiedi("/")).stato]);
    c("nel log di `vite dev` non c'è «Import denied in client environment»", false, /Import denied in client environment/i.test(log));
  } finally {
    if (avviato) await avviato.chiudi();
    if (alberoPrima !== null && existsSync(albero) && readFileSync(albero, "utf8") !== alberoPrima) writeFileSync(albero, alberoPrima);
    rmSync(base, { recursive: true, force: true });
  }
}
