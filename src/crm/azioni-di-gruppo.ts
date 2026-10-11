/** ── LE AZIONI DI GRUPPO: LO SCHELETRO, UNA VOLTA SOLA ─────────────────────
 *
 *  Cambiare stato a venti schede, rimetterne cinquanta in coda, eliminarne
 *  trecento: sono gesti diversi con la stessa ossatura — scorri a lotti, scrivi
 *  una riga per volta, tieni il conto di com'è andata, aggiorna il contatore a
 *  schermo.
 *
 *  ⚠️ ERA SCRITTO DENTRO routes/CRM.importa, e ci stava bene finché le azioni di
 *   gruppo esistevano in una pagina sola. Adesso ce l'ha anche «Da fare oggi»
 *   (richiesta del committente: prendere venti righe della giornata e cambiare
 *   loro l'esito in un colpo), e ricopiare il ciclo avrebbe voluto dire due
 *   posti in cui un giorno il contatore smette di salire in uno solo — e nessuno
 *   se ne accorge finché non capita sulla lista da trecento.
 *  ⚠️ E DA UNA ROTTA NON SI IMPORTA: i file in routes/ esportano una `Route`, e
 *   tirarne fuori una funzione di servizio lega due pagine per un dettaglio che
 *   non è di nessuna delle due.
 *
 *  Qui dentro non c'è niente di React e niente di Supabase: si passano le righe
 *  e la funzione che ne scrive una. Chi chiama sa cosa sono le righe.
 *  ───────────────────────────────────────────────────────────────────────── */

/** ── QUANTE RIGHE PER LOTTO ────────────────────────────────────────────────
 *  ⚠️ QUI C'ERA UN DIVIETO, ADESSO C'È UN LOTTO. Le azioni di gruppo di questa
 *   pagina degli importati si rifiutavano di scrivere oltre `TETTO_SELEZIONE` (50 righe):
 *   «Troppe insieme, non ho scritto niente». Il motivo era vero — `updateLead`
 *   e `deleteLead` scrivono UNA riga per volta, e trecento salvataggi di fila
 *   sono un minuto di pagina ferma in cui sembra tutto rotto — ma il rimedio
 *   costava il gesto: chi aveva trecento righe da sistemare doveva prenderle
 *   cinquanta per volta e ricordarsi dove era arrivato, cioè fare a mano
 *   proprio il lavoro che stava chiedendo alla macchina.
 *   Il lotto risolve il problema vero invece di vietare il gesto: si scrive
 *   venti righe per volta e fra un lotto e l'altro sale un contatore a schermo
 *   (`avanzamento`), che è l'unica differenza fra «sta lavorando» e «si è
 *   piantato».
 *  ⚠️ NON È IL BLOCCO DELL'IMPORTAZIONE (`BLOCCO = 50` in PannelloCarica): là
 *   il blocco è UNA richiesta al database con dentro cinquanta righe nuove, e
 *   serve a non farsi respingere a metà strada; qui ogni riga resta il suo
 *   salvataggio, e il lotto è il passo del CONTATORE, non quello della rete.
 *   Venti e non cinquanta perché è il numero che si vede muovere: su una
 *   selezione di sessanta un contatore a passi di cinquanta fa due scatti e in
 *   mezzo sembra fermo. */
const LOTTO = 20;

/** Com'è finita UNA riga di un'azione di gruppo. Tre risposte e non due, perché
 *  sono tre fatti diversi: `saltata` non è un errore (la scheda aveva già quello
 *  stato: non c'era niente da scrivere) ma non è nemmeno lavoro svolto, e
 *  contarla fra le fatte gonfierebbe il numero che si legge alla fine. */
export type EsitoRiga = "fatta" | "saltata" | "fallita";

/** ── L'IMPALCATURA DELLE AZIONI DI GRUPPO, UNA SOLA ────────────────────────
 *  Tre gesti di questa pagina scrivono su un gruppo di righe — rimetti in coda,
 *  cambia stato, elimina — e tutti e tre hanno lo stesso scheletro: scorri a
 *  lotti, scrivi una riga per volta, tieni il conto di com'è andata, aggiorna
 *  l'avanzamento. Sta scritto una volta sola perché tre copie dello stesso ciclo
 *  sono tre posti in cui un giorno il contatore smette di salire in uno solo, e
 *  nessuno se ne accorge finché non capita sulla lista da trecento.
 *  Le righe fallite tornano INTERE e non come numero: servono per nome nel
 *  messaggio d'errore e servono al chiamante per lasciarle selezionate.
 *
 *  ⚠️ UN LOTTO INTERO FALLITO FERMA TUTTO. Venti rifiuti di fila non sono
 *   sfortuna: è l'archivio che non sta accettando scritture (sessione scaduta,
 *   permesso negato dal database, rete giù). Insistere per altre duecentottanta
 *   righe vuol dire duecentottanta richieste inutili, duecentottanta messaggi
 *   d'errore addosso a chi guarda, e mezzo minuto prima di poter riprovare. Le
 *   righe non provate tornano fra le fallite — restano selezionate, si riprova
 *   quando l'archivio risponde — e non fra le riuscite: dire che sono state
 *   fatte sarebbe la solita bugia da cui non si torna indietro.
 *
 *  ⚠️ NON PRENDE `setAvanzamento` MA UNA FUNZIONE: così questa resta una
 *   funzione di modulo, senza niente di React dentro, e si legge per quello che
 *   fa senza dover sapere in quale componente vive. */
export async function aLotti<T>(
  righe: T[],
  passo: (riga: T) => Promise<EsitoRiga>,
  avanza: (fatti: number, totale: number) => void,
): Promise<{ fatte: number; saltate: number; falliti: T[] }> {
  const totale = righe.length;
  let fatte = 0;
  let saltate = 0;
  const falliti: T[] = [];
  //  Il contatore parte da zero PRIMA della prima scrittura: chi ha premuto
  //  deve vedere che il lavoro è cominciato subito, non venti salvataggi dopo.
  avanza(0, totale);
  for (let i = 0; i < totale; i += LOTTO) {
    const lotto = righe.slice(i, i + LOTTO);
    let fallitiNelLotto = 0;
    for (const riga of lotto) {
      const esito = await passo(riga);
      if (esito === "fatta") fatte++;
      else if (esito === "saltata") saltate++;
      else {
        falliti.push(riga);
        fallitiNelLotto++;
      }
    }
    avanza(Math.min(i + LOTTO, totale), totale);
    if (fallitiNelLotto === lotto.length) {
      falliti.push(...righe.slice(i + LOTTO));
      break;
    }
  }
  return { fatte, saltate, falliti };
}
