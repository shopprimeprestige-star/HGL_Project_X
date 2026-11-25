/** ── LE PROVE DEL NEGOZIO: L'AGGREGATORE ───────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T01). Stesso schema di `prove/ecommerce.mjs`:
 *  `prove/prove.mjs` lo chiama una volta e basta.
 *
 *  Ogni compito aggiunge un suo file `prove/negozio/<nome>.mjs` che esporta
 *      export async function prove(mod, { c, gruppo, radice }) { … }
 *  e viene trovato da solo, in ordine alfabetico: niente elenco da aggiornare.
 *  Non sono prove, e quindi non si chiamano: `dati.mjs` e i file che iniziano
 *  per `_` (aiuti condivisi).
 *  `mod` ha già dentro i moduli impacchettati: `src/shop/cms/*.ts` (chiave
 *  `shop/cms/<nome>`), `src/crm/negozio/*.ts` (`negozio/<nome>`),
 *  `src/crm/tracciamento/*.ts` (`tracciamento/<nome>`), `src/lib/tracciamento/*.ts`
 *  (`lib/tracciamento/<nome>`) e `src/lib/consenso.ts` (`lib/consenso`), che esistono
 *  (elenco in MODULI di prove.mjs; i `*.functions.ts` restano fuori: sono solo
 *  l'involucro delle funzioni del server).
 *  ⚠️ Un file senza `prove` è un errore, non un salto: una prova che non gira
 *  non deve sembrare una prova che passa. Per questo un file che lancia (o che non si carica, o senza `prove`) diventa un controllo
 *  ROSSO col nome del file e il messaggio, e la suite va avanti con i file dopo (T100b). */
import { readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const cartella = join(dirname(fileURLToPath(import.meta.url)), "negozio");
const AIUTI = new Set(["dati.mjs"]);

/** ── LA MEMORIA: CHE COSA TRATTENEVA I PACCHETTI (23/11/2026) ───────────────────────────────────────────────────
 *  Le prove che disegnano una pagina la impacchettano con esbuild (≈87.000 righe `.cjs`: React, react-dom/server, la pagina) e la caricano con
 *  `require` da una cartella temporanea. Ogni pacchetto restava vivo fino alla fine della suite, per DUE vie indipendenti (tolta una, l'altra basta):
 *   1. Node: `require.cache[file]` e, anche dopo `delete`, `modulo.parent.children` (qui il genitore è il `createRequire` della prova, che non muore mai);
 *   2. `globalThis.__pagine[N]` / `__pagina` (`_rende.mjs`): la pagina del disegno, con i `gestori` (le chiusure `onClick` del pacchetto).
 *  Dopo ogni file di prove si staccano tutte e due: i moduli caricati da una cartella temporanea durante la prova, e i registri delle pagine.
 *  Prima: oltre 6 GB residenti e «heap out of memory» col limite normale; dopo: vedi la lavagna. Nessun controllo cambia. */
const require_ = createRequire(import.meta.url);
const TMP = realpathSync(tmpdir());
// shortcut: stacca solo i moduli sotto tmpdir() comparsi durante la prova (quelli di `prove-contabilita` c'erano già); se una prova dovesse caricare altro, estendere qui
function liberaDopoProva(giaCaricati) {
  for (const k of Object.keys(require_.cache)) {
    if (giaCaricati.has(k) || !k.startsWith(TMP)) continue;
    const modulo = require_.cache[k];
    delete require_.cache[k];
    const figli = modulo?.parent?.children;
    if (figli) { const i = figli.indexOf(modulo); if (i >= 0) figli.splice(i, 1); }
  }
  delete globalThis.__pagine;
  delete globalThis.__pagina;
  delete globalThis.__PROVA_PAGINA__;
}

/** `dir` si cambia solo nella prova di questo aggregatore (una cartella di file finti, fuori dal repo): la suite vera non lo passa. */
export async function proveNegozio(mod, ctx, dir = cartella) {
  const file = readdirSync(dir)
    .filter((f) => f.endsWith(".mjs") && !AIUTI.has(f) && !f.startsWith("_"))
    .sort();
  for (const f of file) {
    const giaCaricati = new Set(Object.keys(require_.cache));
    try {
      const m = await import(pathToFileURL(join(dir, f)).href);
      if (typeof m.prove !== "function") throw new Error("manca «export async function prove»");
      await m.prove(mod, ctx);
    } catch (e) {
      // Un file che lancia (o che non si carica, o senza `prove`) è UN rosso con il suo nome: la suite non si ferma e i file dopo girano.
      // Il controllo in più compare solo qui: una suite verde ha lo stesso totale di prima.
      const messaggio = String(e instanceof Error ? e.message : e).replace(/\s+/g, " ").trim();
      ctx.c(`prove/negozio/${f}: la prova ha lanciato un'eccezione`, "nessuna eccezione", messaggio);
    } finally {
      liberaDopoProva(giaCaricati);
    }
  }
}
