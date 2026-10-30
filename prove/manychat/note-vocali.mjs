/** ── PROVE: NOTE VOCALI NELLA SCHEDA LEAD ──────────────────────────────────────
 *
 *  Commessa 2026-10-30-ottimizzazioni, pacchetto p7. La dettatura della chat
 *  (stessa rotta /api/crm/dettatura) scrive NELLE NOTE della scheda: mai un invio,
 *  mai una risposta. Qui le regole pure di `src/crm/nota-vocale.ts` e i controlli
 *  sul sorgente (nessun invio, niente nei log, tasto «info» della chat al suo posto).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveNoteVocali(mod, { c, gruppo, radice }) {
  const N = mod["nota-vocale"];
  const leggi = (f) => readFileSync(join(radice, f), "utf8");

  gruppo("NOTE VOCALI · L'ETICHETTA (GIORNO E ORA ITALIANI)");
  //  30/10/2026 12:32 UTC = 13:32 in Italia (ora solare dal 25/10).
  c("ora solare", "30/10 13:32", N.etichettaVocale(new Date("2026-10-30T12:32:00Z")));
  //  15/7/2026 12:05 UTC = 14:05 con l'ora legale.
  c("ora legale", "15/07 14:05", N.etichettaVocale(new Date("2026-07-15T12:05:00Z")));

  gruppo("NOTE VOCALI · IL DETTATO SI AGGIUNGE ALLE NOTE");
  const q = new Date("2026-10-30T12:32:00Z");
  c("note vuote: solo la riga del vocale", "[Vocale 30/10 13:32] Richiamare giovedì",
    N.notaConDettato("", "Richiamare giovedì", q));
  c("note solo spazi: come vuote", "[Vocale 30/10 13:32] Richiamare giovedì",
    N.notaConDettato("  \n ", "Richiamare giovedì", q));
  c("note esistenti: restano intatte, il vocale va sotto dopo una riga vuota",
    "Voleva il preventivo\n\n[Vocale 30/10 13:32] Richiamare giovedì",
    N.notaConDettato("Voleva il preventivo", "Richiamare giovedì", q));
  c("note che finiscono già con a capo: niente righe vuote di troppo",
    "Voleva il preventivo\n\n[Vocale 30/10 13:32] Richiamare giovedì",
    N.notaConDettato("Voleva il preventivo\n\n", "Richiamare giovedì", q));
  c("il dettato è ripulito dagli spazi", "[Vocale 30/10 13:32] ok",
    N.notaConDettato("", "  ok \n", q));
  c("dettato vuoto: le note non cambiano (anche undefined)", ["a  b", undefined],
    [N.notaConDettato("a  b", "   ", q), N.notaConDettato(undefined, "", q)]);
  c("note undefined: si parte da zero", "[Vocale 30/10 13:32] ciao",
    N.notaConDettato(undefined, "ciao", q));
  c("un dettato su più righe resta su più righe", "[Vocale 30/10 13:32] uno\ndue",
    N.notaConDettato("", "uno\ndue", q));

  gruppo("NOTE VOCALI · SOLO NELLE NOTE, MAI UN INVIO (SORGENTE)");
  const comp = leggi("src/crm/NotaVocale.tsx");
  const dialog = leggi("src/crm/LeadDialog.tsx");
  c("la scheda usa il registratore delle note", true, /<NotaVocale\b/.test(dialog));
  c("la trascrizione entra in `note` (non in altri campi)", true,
    /update\(\s*"note"/.test(dialog) && /notaConDettato/.test(dialog));
  c("riusa la dettatura della chat (stessa rotta, nessuna copia)", true,
    /useDettatura/.test(comp) && !/\/api\/crm\/dettatura/.test(comp));
  c("nessun invio né risposta automatica dal componente", false,
    /fetchCRM|fetch\(|invia|manda|whatsapp|manychat|risposta/i.test(comp.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));
  c("niente console.* con il testo", false, /console\./.test(comp));

  gruppo("NOTE VOCALI · IL «TASTO INFO» DELLA CHAT C'È GIÀ (RISPOSTE DEL MODULO)");
  const conv = leggi("src/crm/chatwa/Conversazione.tsx");
  c("la testata della chat mostra InfoModulo per il lead", true,
    /<InfoModulo[\s\S]{0,200}attiva\.lead\.data/.test(conv));
  c("InfoModulo elenca le risposte del modulo (vociModulo)", true,
    /vociModulo\(modulo\)/.test(leggi("src/crm/chatwa/InfoModulo.tsx")));
}
