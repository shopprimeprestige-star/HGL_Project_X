/** ── LA CAUSALE DEL BONIFICO, E IL NUMERO DEL PREVENTIVO ───────────────────
 *
 *  Richiesta del committente: «fai che posso cambiare l'ID del preventivo e la
 *  causale del preventivo; vedi tu come farlo nel modo migliore».
 *
 *  ── CHE COS'È LA CAUSALE, QUI ────────────────────────────────────────────
 *  È la riga che il cliente COPIA nel bonifico. Non è un'etichetta: è il filo
 *  con cui quel versamento si lega al documento. La stessa frase compare in
 *  tre posti — la pagina del preventivo, la bozza di fattura e la finestra
 *  della fattura — e finora era scritta a mano in tutti e tre
 *  («Conferma ordine - IDXXXXX»), con l'avvertenza, nel codice, che dovevano
 *  combaciare «parola per parola». Tre copie di una frase che deve combaciare
 *  sono tre occasioni di non combaciare più: adesso si scrive qui.
 *
 *  ── IL MODELLO, NON LA FRASE ─────────────────────────────────────────────
 *  Si imposta un MODELLO con dentro dei segnaposto, non una frase fissa:
 *  altrimenti cambiarla vorrebbe dire riscriverla per ogni preventivo, e
 *  soprattutto una frase senza il numero dentro non lega più niente.
 *   · `{numero}`  il numero del preventivo (IDXXXXX)
 *   · `{nome}`    il nome del cliente
 *   · `{totale}`  il totale del preventivo, come lo legge una persona
 *
 *  ⚠️ IL NUMERO CI DEVE ESSERE. Una causale senza numero è un bonifico che
 *   arriva in banca e non si sa di chi è: se il modello non lo nomina, il
 *   numero si aggiunge in coda. Meglio una causale un po' più lunga di un
 *   incasso da rintracciare a mano.
 *  ⚠️ E LA CAUSALE DI UN PREVENTIVO NON CAMBIA PIÙ DA SOLA: viaggia nella
 *   fotografia del documento (shop/condizioni-preventivo), come i prezzi.
 *   Cambiare il modello vale per i preventivi nuovi; per uno già emesso c'è
 *   il comando apposta nel pannello dei preventivi.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Come si è sempre letta, ed è quella che resta se nessuno dice altro.
 *  ⚠️ IL TRATTINO NON È UN DETTAGLIO: la fattura scrive la stessa identica
 *   frase, ed è così che il versamento si riconosce. */
export const MODELLO_DI_CASA = "Conferma ordine - {numero}";

/** I segnaposto ammessi, per poterli scrivere nell'aiuto del pannello senza
 *  che i due elenchi prendano strade diverse. */
export const SEGNAPOSTO = ["{numero}", "{nome}", "{totale}"] as const;

const testo = (v: unknown): string => String(v ?? "").trim();

export function causaleDi(p: {
  /** Il modello scelto. Vuoto o assente = quello di casa. */
  modello?: string | null;
  numero: string;
  nome?: string | null;
  totale?: string | null;
}): string {
  const numero = testo(p.numero);
  const modello = testo(p.modello) || MODELLO_DI_CASA;
  let out = modello
    .replaceAll("{numero}", numero)
    .replaceAll("{nome}", testo(p.nome))
    .replaceAll("{totale}", testo(p.totale))
    //  Un segnaposto scritto male resta scritto: cancellarlo in silenzio
    //  vorrebbe dire una causale che sembra giusta e non lo è.
    .replace(/\s{2,}/g, " ")
    .trim();
  //  ⚠️ Senza numero non è una causale: si aggiunge in coda (vedi in testa).
  if (numero && !out.toUpperCase().includes(numero.toUpperCase())) out = `${out} ${numero}`.trim();
  //  Un modello fatto di soli spazi non lascia il cliente senza niente da
  //  copiare: si torna a quella di casa.
  return out || causaleDi({ numero });
}
