/** ── LE PROVE DI «FATTURE DALLA CHAT»: L'AGGREGATORE ───────────────────────
 *  Commessa 2026-11-13-fatture-dalla-chat. `prove/prove.mjs` lo chiama una volta
 *  e basta (T0): da qui in poi nessuno tocca più quel file.
 *
 *  Ogni compito aggiunge un suo file `prove/fatture-dalla-chat/<nome>.mjs` che esporta
 *      export async function prove(mod, { c, gruppo, radice }) { … }
 *  e viene trovato da solo, in ordine alfabetico: niente elenco da aggiornare,
 *  quindi niente conflitti fra chi lavora in parallelo (stesso schema di
 *  prove/fatture-bulk.mjs).
 *  Non sono prove, e quindi non si chiamano: `dati.mjs` e i file che iniziano
 *  per `_` (aiuti condivisi).
 *  `mod` ha già dentro tutti i moduli impacchettati (`fatture/dalla-chat/…` e
 *  `fatture/bulk/…`, elenco in MODULI di prove.mjs). ⚠️ Un file senza `prove` è un
 *  errore, non un salto: una prova che non gira non deve sembrare una prova che passa. */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const cartella = join(dirname(fileURLToPath(import.meta.url)), "fatture-dalla-chat");
const AIUTI = new Set(["dati.mjs"]);

export async function proveFattureDallaChat(mod, ctx) {
  const file = readdirSync(cartella)
    .filter((f) => f.endsWith(".mjs") && !AIUTI.has(f) && !f.startsWith("_"))
    .sort();
  for (const f of file) {
    const m = await import(pathToFileURL(join(cartella, f)).href);
    if (typeof m.prove !== "function")
      throw new Error(`prove/fatture-dalla-chat/${f}: manca «export async function prove»`);
    await m.prove(mod, ctx);
  }
}
