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
 *  non deve sembrare una prova che passa. */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const cartella = join(dirname(fileURLToPath(import.meta.url)), "negozio");
const AIUTI = new Set(["dati.mjs"]);

export async function proveNegozio(mod, ctx) {
  const file = readdirSync(cartella)
    .filter((f) => f.endsWith(".mjs") && !AIUTI.has(f) && !f.startsWith("_"))
    .sort();
  for (const f of file) {
    const m = await import(pathToFileURL(join(cartella, f)).href);
    if (typeof m.prove !== "function") throw new Error(`prove/negozio/${f}: manca «export async function prove»`);
    await m.prove(mod, ctx);
  }
}
