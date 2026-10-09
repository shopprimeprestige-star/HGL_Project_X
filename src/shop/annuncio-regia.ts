/** ── «HO CAMBIATO QUALCOSA»: DETTO, NON INDOVINATO ─────────────────────────
 *  Il consulente accende o spegne un preventivo e il cliente deve accorgersene
 *  subito. Due modi: chiederlo di continuo (e pagarlo in richieste, vedi
 *  shop/stato-stanza) oppure DIRLO quando succede. Qui c'è il filo per dirlo.
 *
 *  ⚠️ STA IN UN FILE SUO per non chiudere un anello fra i moduli: lo chiama
 *   shop/regia-gruppo (che shop/call importa già) e lo riempie shop/call, che
 *   è l'unico che ha in mano il canale della stanza. Stessa ragione meccanica
 *   di shop/mio-preventivo e shop/stato-stanza.
 *  ⚠️ E se nessuno l'ha riempito non succede niente: il giro di sicurezza
 *   arriva lo stesso, solo qualche secondo dopo. */

let dillo: (() => void) | null = null;

/** Lo registra il motore della consulenza (shop/call). */
export function registraAnnuncioRegia(f: (() => void) | null) { dillo = f; }

/** La regia è cambiata: chi è nella stanza lo sappia adesso. */
export function annunciaRegiaCambiata() {
  try { dillo?.(); } catch { /* il canale può non esserci: resta il giro */ }
}
