/** ── LE PROVE DEL FOGLIO GOOGLE · l'ingresso ───────────────────────────────
 *
 *  Commessa 2026-10-25 (Lead da Google Sheets + sequenze WhatsApp). Come
 *  `prove/manychat.mjs`: `prove/prove.mjs` impacchetta i moduli (voci
 *  `sheets/…`, `importa/origine`, `stato-dal` di MODULI) e chiama
 *  `proveSheets(mod, aiuti)`, che chiama in ordine i file d'area di
 *  `prove/sheets/`.
 *
 *  ⚠️ UN FILE PER AREA, UN COMPITO PER FILE. Questo e `prove.mjs` li tocca solo
 *   il compito 0, una volta. Un file d'area ancora vuoto passa.
 *  ⚠️ `aiuti` = { c, gruppo, radice }: `c(nome, atteso, letto)` conta il
 *   controllo, `gruppo(titolo)` apre un blocco, `radice` è la cartella del
 *   progetto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { proveIngresso } from "./sheets/ingresso.mjs";
import { proveMigrazioneSheets } from "./sheets/migrazione.mjs";
import { proveOrigine } from "./sheets/origine.mjs";

/** Lo scheletro del compito 0: i moduli nuovi esistono e hanno le firme
 *  concordate nel piano. Se un compito le cambia senza dirlo, qui si vede. */
function proveDelloScheletro(mod, { c, gruppo }) {
  gruppo("SHEETS · LO SCHELETRO (compito 0)");
  const funzioni = {
    "sheets/ingresso": ["leggiRichiesta", "schedaDaRiga", "chiaveIngresso", "gestisciIngresso"],
    "importa/origine": ["origineDi", "daGoogleSheets"],
    "stato-dal": ["conStatoDal"],
  };
  for (const [nome, attese] of Object.entries(funzioni)) {
    c(
      `${nome}: espone ${attese.join(", ")}`,
      attese.map(() => "function"),
      attese.map((f) => typeof mod[nome]?.[f]),
    );
  }
}

export async function proveSheets(mod, aiuti) {
  proveDelloScheletro(mod, aiuti);
  await proveIngresso(mod, aiuti);
  await proveMigrazioneSheets(mod, aiuti);
  await proveOrigine(mod, aiuti);
}
