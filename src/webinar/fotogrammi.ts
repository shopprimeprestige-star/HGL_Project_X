/** ── STANNO ARRIVANDO FOTOGRAMMI? ──────────────────────────────────────────
 *
 *  ⚠️ IL CONTO CHE C'ERA SI ROMPEVA DA SOLO quando qualcuno saliva o scendeva
 *   dal palco, e il difetto era esattamente questo: si prendeva il MASSIMO dei
 *   `framesDecoded` fra tutti i flussi in arrivo e lo si confrontava col
 *   massimo di prima. Finché i flussi sono sempre gli stessi funziona. Ma il
 *   flusso che teneva il massimo — uno arrivato prima, con il contatore più
 *   alto — prima o poi se ne va, e da quel momento il nuovo massimo è più
 *   BASSO del vecchio: per sempre. Il conto legge «fermo» a ogni giro e dopo
 *   sei secondi la sala scrive «sei collegato ma il video non arriva» SOPRA un
 *   video che si sta vedendo benissimo. Segnalato con la foto, e succedeva
 *   proprio nelle dirette con ospiti che vanno e vengono — cioè quelle per cui
 *   il salotto esiste.
 *
 *  ⚠️ LA DOMANDA GIUSTA NON È «IL TOTALE È CRESCIUTO», è «QUALCUNO STA
 *   DECODIFICANDO». Si tiene il conto di ciascun flusso separatamente e basta
 *   che UNO sia avanzato. Così un flusso che sparisce si porta via solo il suo
 *   numero, e non trascina con sé la risposta.
 *
 *  ⚠️ Un flusso NUOVO fermo a zero non conta come «avanzato»: appena agganciato
 *   non ha ancora decodificato niente, e contarlo vorrebbe dire dire «va tutto
 *   bene» proprio nell'istante in cui non è ancora arrivato nulla.
 */
export function qualcunoAvanza(
  prima: Readonly<Record<string, number>>,
  dopo: Readonly<Record<string, number>>,
): boolean {
  for (const chiave of Object.keys(dopo)) {
    const adesso = dopo[chiave];
    if (!Number.isFinite(adesso)) continue;
    const era = Number.isFinite(prima?.[chiave]) ? prima[chiave] : 0;
    if (adesso > era) return true;
  }
  return false;
}
