/** ── FATTURE DALLA CHAT · T13 · SELEZIONE DELLE BOLLE (VIA 2) ────────────────
 *  PIANO §2bis/§4 (T13), SPEC §9.3 passo 2, §9.4 (bolla non leggibile), §9.6
 *  (tetto di 10 bolle): il titolare tiene premuta una bolla di testo o di
 *  immagine per sceglierla come fonte della fattura, in UNA sola chat.
 *
 *  ⚠️ NON importa `risposte-ai/rispiega.ts` di proposito (§0bis.1 del piano):
 *  è una seconda selezione, indipendente, con le sue regole pure — zero
 *  coupling con «Rispiega con AI»/«Rispondi con AI», così un bug in una delle
 *  due non può rompere l'altra. `selezionabileFattura`/`commutaFattura` sono
 *  quindi SCRITTE DI NUOVO con lo stesso criterio minimo, non importate.
 *  Per le immagini si riusa invece `mediaDelPonte` (`chatwa/usaMediaPonte.ts`),
 *  per import, non copia: non è compito di questo file decidere se
 *  un'immagine è già scaricata o leggibile (lo scopre il server quando la
 *  legge, PIANO T11.3) — qui si decide solo se è una bolla vera, testo o
 *  immagine, mai uno sticker/una reazione/un messaggio vuoto. */
import { mediaDelPonte } from "../../chatwa/usaMediaPonte";

/** SPEC §9.6: fino a 10 bolle insieme (testo + immagini), più del tetto di 8
 *  immagini della Via 1 — qui il titolare le tocca col dito, raramente più
 *  di 3-4, ma un tetto comunque serve. */
export const MAX_BOLLE_FATTURA = 10;

/** Ciò che serve sapere di un messaggio per sceglierlo come bolla della fattura. */
export interface MessaggioBollaFattura {
  id: string;
  body?: string | null;
  canale?: string | null;
  wa_message_id?: string | null;
}

/** Una bolla con testo vero (stesso criterio minimo di `selezionabile` in
 *  `risposte-ai/rispiega.ts`, duplicato apposta — vedi commento di testa) o
 *  una bolla-immagine del ponte (`mediaDelPonte` non nullo: foto, vocale,
 *  video o documento, scaricata o ancora un segnaposto — non è compito di
 *  questo file saperlo). Sticker, reazioni e messaggi senza testo: mai. */
export function selezionabileFattura(m: MessaggioBollaFattura): boolean {
  const t = typeof m.body === "string" ? m.body.trim() : "";
  const testoValido = t !== "" && !/^\[(template:|messaggio senza testo)/i.test(t);
  return testoValido || mediaDelPonte(m) !== null;
}

/** Un tocco: aggiunge la bolla in fondo o la toglie. Al massimo non ne aggiunge altre.
 *  Stesso schema di `commuta` in `risposte-ai/rispiega.ts`, duplicato apposta (§0bis.1). */
export function commutaFattura(
  scelti: readonly string[],
  id: string,
  max = MAX_BOLLE_FATTURA,
): string[] {
  if (scelti.includes(id)) return scelti.filter((x) => x !== id);
  return scelti.length >= max ? [...scelti] : [...scelti, id];
}
