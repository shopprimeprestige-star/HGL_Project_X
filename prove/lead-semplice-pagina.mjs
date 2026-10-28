/** ── LE PROVE DELLA PAGINA «LEAD IMPORTATI SEMPLICE» · il disegno ──────────
 *
 *  Commessa 2026-10-28-lead-importati-semplice. Come `prove/sheets.mjs`:
 *  `prove/prove.mjs` chiama `proveLeadSemplicePagina(mod, aiuti)` dopo
 *  `proveSheets`. Le prove di questo file leggono il TESTO dei sorgenti della
 *  pagina (le regole pure stanno in `prove/lead-semplice.mjs`).
 *
 *  ⚠️ `aiuti` = { c, gruppo, radice }, come per `proveSheets`.
 *  ⚠️ Un file ancora vuoto passa: lo riempiono i compiti T4-T7 del piano.
 *  ───────────────────────────────────────────────────────────────────────── */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** I pezzi che la pagina ha ceduto ad altri file (compito T3). Il primo è la
 *  rotta; gli altri si saltano finché non esistono. */
export const FILE_DELLA_PAGINA = [
  "src/routes/CRM.importa.tsx",
  "src/crm/importa/SchedaProssimo.tsx",
  "src/crm/importa/PannelloAssegna.tsx",
  "src/crm/importa/RicercaContatto.tsx",
  "src/crm/importa/SchedaMiei.tsx",
  "src/crm/importa/SchedaGiorno.tsx",
  "src/crm/importa/FinestraElimina.tsx",
  "src/crm/importa/BloccoRitorno.tsx",
  //  T4-T5: i pezzi nuovi del disegno (si saltano finché non esistono).
  "src/crm/importa/PannelloBasso.tsx",
  "src/crm/importa/BarraPillole.tsx",
  "src/crm/importa/PannelloFiltra.tsx",
  "src/crm/importa/Intestazione.tsx",
  "src/crm/importa/FraseGiro.tsx",
  "src/crm/importa/FasciaAvvisi.tsx",
  "src/crm/importa/BarraEsiti.tsx",
];

/** Tra un file e l'altro: una riga col nome e un riempitivo lungo, senza spazi.
 *  Una regex come `[\s\S]{0,400}` o `\s*` non lo attraversa, quindi non può
 *  fingere di trovare un pezzo nel file accanto. (Il più lungo `{0,N}` delle
 *  prove è 8000; il riempitivo è 12000.) */
const separatore = (nome) => `\n/*«««FILE: ${nome}»»»*/\n${"▒".repeat(12000)}\n`;

/** Il sorgente della pagina = la rotta + i file che ne sono stati estratti,
 *  uniti col separatore. Le prove sui GESTI (`segna`, `salta`, `vediDopo`…)
 *  leggono la sola rotta, non questo. */
export function sorgentePagina(radice) {
  return FILE_DELLA_PAGINA.filter((f) => existsSync(join(radice, f)))
    .map((f) => separatore(f) + readFileSync(join(radice, f), "utf8"))
    .join("");
}

export async function proveLeadSemplicePagina(mod, aiuti) {
  void mod;
  void aiuti;
}
