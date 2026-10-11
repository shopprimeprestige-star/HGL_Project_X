// ── LE SOGLIE DELLA PAGINA KPI ──────────────────────────────────────────────
//  Non sono formule (quelle stanno tutte in `@/crm/kpi-calcoli` e non si
//  toccano): sono decisioni di lettura — quando un numero merita un colore e
//  quando è troppo poco per essere una media. Stanno in un file loro perché la
//  pagina e la scheda delle risposte del modulo devono usare LO STESSO taglio:
//  una tabella che nasconde le righe sotto cinque lead accanto a una scheda che
//  le mostra fa sembrare rotta una delle due.

/** ── PERCHÉ SOTTO 5 È UN SEGNALE ───────────────────────────────────────────
 *  Il punteggio lo dichiara la persona nel modulo: quanto le pesa il problema,
 *  da 1 a 10. Sotto la metà si sta parlando con chi «si sta informando», non
 *  con chi vuole risolvere: la consulenza si fa lo stesso e costa lo stesso, ma
 *  chiude molto meno. È l'unico numero di qualità che vale un colore. */
export const SOGLIA_LPS = 5;

/** ── QUANTI LEAD SERVONO PER FARE UNA MEDIA ────────────────────────────────
 *  Sotto i cinque lead una percentuale si sposta di venti punti per una
 *  risposta sola: non è un dato, è rumore con la virgola. Le righe che non ci
 *  arrivano restano visibili — sparire farebbe pensare a un errore — ma la
 *  loro percentuale non si mostra. */
export const VOLUME_MINIMO_LPS = 5;

/** ── QUANDO UN TASSO DI CONVERSIONE È UN PROBLEMA ──────────────────────────
 *  È il taglio che usava già la tabella «KPI consulente» di KPI manuale, e
 *  vale adesso sia nella scheda «Consulenti» sia nel riquadro «Conversione» di
 *  «Da fare»: lo stesso numero non può cambiare colore cambiando linguetta —
 *  chi lo vede rosso di là e nero di qua smette di fidarsi di tutti e due. */
export const CVR_BASSO = 15;

/** Sotto tre consulenze svolte il tasso non si colora: una consulenza sola
 *  andata male fa 0% e non è una notizia, è un caso. */
export const CONSULENZE_MINIME = 3;
