/** ── LE PROVE DEL SITO (giro 2) ────────────────────────────────────────────
 *  `node prove/sito.mjs` esegue in ordine alfabetico ogni `prove/sito/*.mjs`
 *  (una per compito) e esce con 1 se anche una sola fallisce. I file che
 *  iniziano con «_» sono aiuti comuni, non prove.
 *  `prove/prove.mjs` lo chiama con un aggancio di poche righe (compito A7).
 *  ───────────────────────────────────────────────────────────────────────── */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const qui = dirname(fileURLToPath(import.meta.url));
const cartella = join(qui, "sito");
const prove = readdirSync(cartella)
  .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
  .sort();

let fallite = 0;
for (const f of prove) {
  console.log(`\n── prove/sito/${f}`);
  const r = spawnSync(process.execPath, [join(cartella, f)], { stdio: "inherit" });
  if (r.status !== 0) {
    fallite++;
    console.error(`✗ ${f} è fallita (uscita ${r.status})`);
  }
}
console.log(fallite ? `\n✗ prove del sito: ${fallite} su ${prove.length} fallite` : `\n✓ prove del sito: ${prove.length} su ${prove.length} passate`);
process.exit(fallite ? 1 : 0);
