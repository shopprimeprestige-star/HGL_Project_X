/** ── CHE COSA SI VEDE IN «OGGI» ────────────────────────────────────────────
 *
 *  Richiesta del titolare (14/10/2026): la setter fissa appuntamenti tutto il
 *  giorno e le serve un posto tranquillo dove vedere la giornata delle
 *  consulenze. Oggi entra in «Oggi» e vede tutto, di tutti: gli esiti
 *  premibili sulle consulenze dei colleghi e l'Andamento con il fatturato.
 *
 *  ⚠️ UNA TABELLA DI SÌ/NO, NON UNA SERIE DI `if` NELLA PAGINA. La pagina
 *   legge questa tabella e basta: così la regola si prova senza browser, e
 *   chi la cambia la cambia in un posto solo.
 *
 *  ── LA REGOLA ─────────────────────────────────────────────────────────────
 *   CHI FA CONSULENZE (`faConsulenze`, cioè ha `preventivi`): «Oggi» come
 *   prima. Consulente, setter+consulente e admin vedono la stessa pagina.
 *   CHI NON LE FA: sola lettura. La giornata di tutti con la scritta
 *   «fissato da te», la striscia dei posti liberi in cima; niente esiti,
 *   Avvia, note, contatori, Da recuperare, Da ricontattare, In sede,
 *   Andamento (fatturato, ROAS, CPL).
 *
 *  ⚠️ LA STRISCIA SOLO A CHI HA `agenda`. Senza, la rotta delle ore tenute
 *   per una persona sola risponde 403 e i posti sarebbero più alti del vero:
 *   meglio nessun numero che un numero sbagliato.
 *  ⚠️ LE INSTALLAZIONI RESTANO A CHI LE FA (correzione del revisore, 14/10).
 *   Installatore, accompagnatore, driver e manutentore non hanno
 *   `preventivi` ma vedevano la sezione Installazioni: nessuno ha deciso di
 *   togliergliela. La setter semplice non ha `installazioni`, quindi per lei
 *   la decisione del titolare resta.
 *  ⚠️ È SOLA LETTURA DELL'INTERFACCIA, NON DEL SERVER. Esiti e stati scrivono
 *   con la sessione del proprietario: nascondere i pulsanti toglie l'errore
 *   per sbaglio, non è una protezione (vedi PIANO della commessa).
 *  ───────────────────────────────────────────────────────────────────────── */
import { faConsulenze, type Permesso } from "@/crm/permessi";

export interface VistaOggi {
  /** il riquadro ADESSO con la fascia POI */
  adesso: boolean;
  /** i cinque contatori */
  contatori: boolean;
  recuperare: boolean;
  ricontatti: boolean;
  sede: boolean;
  installazioni: boolean;
  /** la sezione Andamento, compreso l'avviso della salute dei conti */
  andamento: boolean;
  /** esiti, stato premibile, stella, note, Avvia, invii */
  gesti: boolean;
  /** la striscia dei posti liberi in cima */
  striscia: boolean;
  /** la scritta «fissato da te» sulle righe */
  fissatiDaMe: boolean;
  /** la striscia «Da sentire»: chi non ha confermato la consulenza su WhatsApp */
  confermeDaSentire: boolean;
  /** il tasto «Confermato a voce» */
  confermaAVoce: boolean;
  /** la striscia «Hanno risposto / Non hanno risposto» al ricontatto automatico
   *  dei consulenti (ManyChat): la leggono e la lavorano solo i consulenti */
  risposteOggi: boolean;
}

export function vistaOggi(puo: (p: Permesso) => boolean): VistaOggi {
  const consulenze = faConsulenze(puo);
  return {
    adesso: consulenze,
    contatori: consulenze,
    recuperare: consulenze,
    ricontatti: consulenze,
    sede: consulenze,
    installazioni: consulenze || puo("installazioni"),
    andamento: consulenze,
    gesti: consulenze,
    striscia: !consulenze && puo("agenda"),
    fissatiDaMe: !consulenze,
    //  ⚠️ L'UNICA ECCEZIONE ALLA SOLA LETTURA (commessa 2026-10-22, approvata
    //   dal revisore): «Confermato a voce» serve proprio alla setter, per non
    //   richiamare chi ha già confermato al telefono. Non è un esito di
    //   consulenza e scrive solo `promemoria.confermatoIl/Via`.
    confermeDaSentire: true,
    confermaAVoce: true,
    risposteOggi: consulenze,
  };
}
