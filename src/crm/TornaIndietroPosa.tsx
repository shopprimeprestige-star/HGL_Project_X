/** ── TORNA ALLO STATO DI PRIMA, DALLE INSTALLAZIONI ────────────────────────
 *
 *  L'ICONA È QUELLA DELLA PAGINA OGGI, NON UNA SECONDA COPIA
 *  Il pulsante è `TornaIndietro` di crm/MeetGiornalieri: legge
 *  `lead.data.statoPrecedente` — che `CRMContext.updateLead` scrive da solo a
 *  ogni cambio di stato, nell'unico punto da cui passano tutte le modifiche —
 *  compare solo se c'è davvero uno stato a cui tornare, e chiama chi glielo
 *  passa. Qui non se ne riscrive uno uguale: la stessa idea scritta due volte,
 *  fra un mese, si comporta in due modi diversi, e a quel punto nessuna delle
 *  due è quella giusta.
 *
 *  ALLORA COSA AGGIUNGE QUESTO FILE? LA DOMANDA SUI SOLDI.
 *  Sulla pagina Oggi si torna indietro fra esiti di consulenza — "cliente
 *  assente" premuto al posto di "da riprogrammare" — e disfare non costa
 *  niente. Nelle installazioni le righe sono VENDITE, e lo stato precedente di
 *  una pratica chiusa è quasi sempre quello di PRIMA della vendita
 *  («Appuntamento fissato», «In valutazione»…): riportarcela vuol dire toglierla
 *  dai conti, perché il fatturato del periodo, i clienti acquisiti e
 *  l'attribuzione delle campagne leggono tutti lo STATO (`eConversione`, in
 *  crm/kpi-calcoli). Un gesto che sposta il fatturato del mese non può essere un
 *  tocco solo e silenzioso: quando la pratica esce dai conti si chiede conferma,
 *  e la finestra dice per esteso cosa succede agli importi già registrati.
 *  Quando invece il ritorno resta dentro i conti — ed è il caso normale delle
 *  correzioni fra chiusure vinte — si scrive subito, con l'«Annulla» nel
 *  messaggio come ogni altra azione di questa pagina: chiedere conferma per
 *  annullare raddoppia i clic proprio a chi ha appena sbagliato.
 *
 *  ⚠️ DOVE SI FINISCE NON È SEMPRE DOVE SI CHIEDE DI ANDARE
 *  `applyAutoStatus` (crm/types) gira dentro `updateLead` a ogni salvataggio e
 *  ha l'ultima parola: con un acconto in cassa riporta la pratica ad «Acconto
 *  incassato» invece che allo stato chiesto, e su «Perditempo» AZZERA gli
 *  importi della scheda. Qui nessuna delle due regole è ricopiata: si chiede a
 *  lei cosa succederebbe (`simula`) e si racconta quello che si è letto.
 *  Ricopiarle avrebbe voluto dire una finestra che promette una cosa e un
 *  salvataggio che ne fa un'altra — e il posto in cui se ne accorge qualcuno
 *  sono i totali di fine mese.
 *
 *  ── E CON LO STATO SE NE VA ANCHE LA POSA PROGRAMMATA ────────────────────
 *  Una vendita, qui dentro, non è solo uno stato: quando si registra si fissa
 *  anche la posa (il selettore di stato chiede giorno e ora nello stesso
 *  momento, vedi crm/QuickStatusDialog). Disfare la vendita e lasciare in piedi
 *  l'intervento vuol dire tenere occupata la fascia del consulente — e le tre
 *  ore di strada del driver, che booking-utils blocca su TUTTE le altre
 *  schermate — per un lavoro che non esiste più. Nessuno andrebbe a pulirlo: la
 *  riga non è più nel percorso di nessuno, e il posto in cui salta fuori è
 *  l'agenda di un collega che non trova più spazio quel giorno.
 *  Quindi le due cose si tolgono INSIEME, in un salvataggio solo — due
 *  scritture di fila lascerebbero, nel mezzo, una pratica non più venduta con la
 *  posa ancora addosso, e se la seconda non parte quello resta lo stato finale.
 *  Cosa esattamente se ne va lo dice `senzaProgrammazione` nel modulo
 *  installazioni, che è dove quei campi sono nati: qui non se ne tiene un
 *  secondo elenco, o il giorno che nasce un campo nuovo della posa questo
 *  continuerebbe a togliere i cinque di ieri.
 *
 *  ── E SE NE VA ANCHE DALLA SCHEDA IN CUI STAVA ───────────────────────────
 *  Le schede «A domicilio» e «Da spedire» non filtrano per stato: filtrano per
 *  MODO DI CONSEGNA (crm/spedizione.ts). Finché questo gesto scriveva il solo
 *  stato, riportare una pratica da «A domicilio» a «Nel nostro centro»
 *  riusciva — compariva il messaggio, con l'«Annulla» — e la riga restava
 *  IDENTICA nella scheda «A domicilio»: la scrittura era andata, ma per chi
 *  guardava il pulsante non aveva fatto niente. Stato e classificazione
 *  dicevano due cose diverse sulla stessa pratica.
 *  Adesso i due campi si spostano INSIEME, nello stesso salvataggio: la regola
 *  di cosa dichiara quale consegna sta in `consegnaDaAllineare`, cioè accanto
 *  al dato, e da qui si legge soltanto. Quello che è stato scritto a mano —
 *  indirizzo, tracciamento, costo del viaggio — NON si cancella: cambia la
 *  scheda in cui la riga si vede, non il lavoro che c'è dentro. E quando la
 *  riga non si può spostare perché il pacco è già partito, il messaggio lo
 *  dice invece di lasciare che ci si arrivi da soli.
 *  ⚠️ «Non si cancella» non vuol dire «non cambia niente», e la differenza sta
 *   tutta nel COSTO DEL VIAGGIO: quello vive in `payment.costi` e il margine
 *   continua a sottrarlo (ricavoNetto, kpi-netto), mentre il campo per leggerlo
 *   e correggerlo esiste solo dentro la scheda «A domicilio» — cioè proprio
 *   quella da cui la riga è appena uscita. Restava un'uscita a carico di una
 *   vendita, invisibile. Non si azzera — sarebbe un gesto che ne cancella un
 *   altro, e «Annulla» non basterebbe più a rimettere le cose a posto — ma lo
 *   dice il messaggio, insieme al rimedio (vedi `raccontaConsegna`).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { AlertTriangle, CalendarX2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCRM } from "./CRMContext";
import {
  compensoDriver,
  giaIncassato,
  incassoRegistrato,
  nomeAccompagnatore,
  nomeCompleto,
  nomeDriver,
  nomeTecnico,
  posaCompletata,
  posaProgrammata,
  prezzoVendita,
  senzaProgrammazione,
  senzaTecnico,
} from "./InstallationScheduleDialog";
//  Il criterio dei conti è quello dei KPI, non uno scritto qui: se questa
//  finestra giudicasse "vendita" con una regola sua, avvertirebbe su pratiche
//  che i totali non contano e tacerebbe su quelle che contano.
import { eConversione } from "./kpi-calcoli";
import { TornaIndietro } from "./MeetGiornalieri";
//  Come arriva l'impianto al cliente lo decide un file solo, ed è quello che le
//  due schede leggono per sapere quali righe mostrare: qui non si giudica quale
//  scheda sia quella giusta, si chiede.
import {
  consegnaDaAllineare,
  modoConsegna,
  paccoInPreparazione,
  paccoPartitoNonSiSposta,
  type ModoConsegna,
} from "./spedizione";
import {
  LEAD_STATUS_LABEL,
  applyAutoStatus,
  type Consultant,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "./types";
import { dataBreve, eur } from "./ui";
import { Finestra, NotaFinestra } from "./ui/Finestra";

/* ═══════════════════════════════════════════════════════════════════════════
   1. COSA SUCCEDEREBBE — si chiede a chi decide, non si indovina
   ═════════════════════════════════════════════════════════════════════════ */

/** La scheda come sarebbe DOPO il ritorno indietro, passata per la stessa
 *  funzione che gira dentro `updateLead`. È una prova a vuoto: non salva
 *  niente, serve solo a poter dire la verità prima di salvare. */
function simula(l: Lead, richiesto: LeadStatus): LeadData {
  //  ⚠️ `statoScelto: true` perché qui lo stato lo sta scegliendo una persona,
  //   ed è esattamente quello che farà il salvataggio vero: senza, questa prova
  //   a vuoto direbbe «resta com'è» e la finestra prometterebbe il contrario di
  //   quello che succede un secondo dopo.
  return applyAutoStatus({ ...l.data, stato: richiesto }, { statoScelto: true });
}

/** Il lead come sarebbe dopo, in forma di lead: così gli importi si leggono con
 *  le stesse funzioni della riga (`prezzoVendita`, `giaIncassato`) e non con una
 *  seconda lettura scritta per l'occasione. */
function leadSimulato(l: Lead, richiesto: LeadStatus): Lead {
  return { ...l, data: simula(l, richiesto) };
}

/** ── LA PRATICA ESCE DAI CONTI? ───────────────────────────────────────────
 *  Vero solo se OGGI conta come vendita e DOPO non conterebbe più. Non è la
 *  stessa cosa di "lo stato precedente non è una chiusura vinta": una pratica
 *  con l'acconto in cassa resta vinta comunque (ci pensa `applyAutoStatus`), e
 *  fermare quel gesto con una finestra sarebbe un allarme su niente — cioè il
 *  modo più rapido per insegnare a premere "Sì" senza leggere.
 *  Non è esportata di proposito: la domanda ha senso solo davanti a questo
 *  gesto, e un file che esporta funzioni accanto ai componenti spegne il
 *  ricaricamento a caldo di tutta la pagina. */
function esceDaiConti(l: Lead, richiesto: LeadStatus): boolean {
  return eConversione(l) && !eConversione({ data: simula(l, richiesto) });
}

/** ── SI PORTA VIA ANCHE LA POSA PROGRAMMATA? ──────────────────────────────
 *  Tre condizioni, e ognuna evita un danno diverso.
 *
 *  1. C'È UNA POSA. Su una pratica senza niente in agenda non c'è niente da
 *     togliere, e riscrivere l'installazione uguale a sé stessa sarebbe una
 *     modifica finta che finisce comunque nello storico della scheda.
 *
 *  2. NON È GIÀ STATA FATTA. Un intervento avvenuto è un fatto, non una
 *     prenotazione: cancellargli giorno e tecnico riscriverebbe il passato, e
 *     nessuno saprebbe più chi c'è andato. Chi vuole rimetterla fra quelle da
 *     fare ha il comando apposta nel menu «…» («Ancora da fare»): toglie il
 *     segno «fatta» e lascia in piedi giorno, ora e persone.
 *
 *  3. QUELLO CHE SI STA DISFACENDO È LA VENDITA. È la condizione che tiene
 *     insieme questo gesto, ed è la stessa di `esceDaiConti`: la posa esiste
 *     PERCHÉ c'è stata una vendita, quindi se ne va con lei. Al contrario, la
 *     correzione fra due chiusure vinte — «posa in sede» premuto al posto di
 *     «a domicilio», l'errore di tutti i giorni — non deve toccarla: quella
 *     pratica è ancora venduta, il cliente ha ancora l'appuntamento, e
 *     cancellarglielo per una parola cambiata sarebbe il danno che questo file
 *     esiste per evitare. Vale anche per la pratica con l'acconto in cassa, che
 *     `applyAutoStatus` tiene fra le vendite comunque: se la vendita resta,
 *     resta anche la posa.
 *
 *  ⚠️ QUELLO CHE QUESTA REGOLA NON COPRE, detto perché non si scopra da soli:
 *   una posa RIPROGRAMMATA per sbaglio (persona o giorno sbagliati, vendita che
 *   resta valida) non si disfa da qui, perché qui non si sta disfacendo nessuna
 *   vendita. Si ripara dov'è stata fatta: l'«Annulla» del messaggio che compare
 *   subito dopo «Programma», che rimette l'installazione esattamente com'era. */
function posaDaTogliere(l: Lead, richiesto: LeadStatus): boolean {
  return posaProgrammata(l) && !posaCompletata(l) && esceDaiConti(l, richiesto);
}

/** ── QUESTA POSA TOGLIEVA DAVVERO DELLE ORE A QUALCUNO? ───────────────────
 *  Solo se aveva un GIORNO. `posaProgrammata` dice sì anche a una posa con il
 *  tecnico e il driver già scelti e la data ancora da trovare — ed è giusto che
 *  lo dica, quelle persone risultano impegnate su questo intervento — ma
 *  booking-utils blocca la fascia (e le tre ore di strada del driver) solo
 *  quando `dataInstallazione` c'è: senza giorno non esiste nessuna fascia da
 *  liberare.
 *  Serve a non promettere in un messaggio un'agenda che si libera quando non
 *  c'era niente di occupato. Una frase così non fa danni il giorno che la si
 *  legge: li fa il mese dopo, quando ci si accorge che i messaggi di questa
 *  pagina dicono cose che non si possono controllare, e si smette di leggerli. */
function bloccavaLAgenda(l: Lead): boolean {
  return !!l.data.installazione?.dataInstallazione;
}

/** La posa in una riga, per dirla a chi sta per perderla: senza giorno, ora e
 *  nome, «la posa programmata è stata tolta» non permette di controllare se era
 *  davvero quella sbagliata — e non permette nemmeno di rifissarla uguale, che è
 *  la prima cosa che serve se il ritorno indietro era l'errore. */
function descriviPosa(l: Lead, consulenti: Consultant[]): string {
  const inst = l.data.installazione;
  const quando = inst?.dataInstallazione
    ? `${dataBreve(inst.dataInstallazione)}${
        inst.orarioInstallazione ? ` alle ${inst.orarioInstallazione}` : ""
      }`
    : "senza giorno fissato";
  const guida = nomeDriver(l, consulenti);
  const compenso = compensoDriver(l);
  //  ⚠️ E CHI ANDAVA A POSARE INSIEME. Questa riga elencava solo il driver, e
  //  la squadra di una posa può essere di tre persone: chi esegue, chi affianca
  //  e chi guida (vedi `accompagnatoreDi` in InstallationScheduleDialog, che
  //  spiega perché gli ultimi due non sono la stessa cosa). Senza questo nome la
  //  frase serviva a metà proprio nel momento in cui serve tutta — è l'unica
  //  copia della posa che resta a chi la sta togliendo, e senza l'accompagnatore
  //  non si può rimetterla com'era: quell'agenda si libera in silenzio e nessuno
  //  sa più che quel pomeriggio uscivano in due.
  const affianca = nomeAccompagnatore(l, consulenti);
  return [
    quando,
    //  `nomeTecnico` risponde comunque «Tecnico da assegnare»: in un elenco di
    //  cose che spariscono quella frase si legge come un nome, e non lo è.
    senzaTecnico(l) ? null : nomeTecnico(l, consulenti),
    //  Prima del driver, come nella fila delle pastiglie negli elenchi: l'ordine
    //  è quello del lavoro — chi posa, chi lo affianca, chi lo porta — e due
    //  posti diversi per le stesse tre persone si leggono come tre squadre.
    affianca ? `con ${affianca}` : null,
    guida ? `driver ${guida}${compenso > 0 ? ` · ${eur(compenso)}` : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   1 bis. DOVE VA A FINIRE LA RIGA
   ═════════════════════════════════════════════════════════════════════════ */

/** Una riga che cambia scheda sparisce da sotto gli occhi di chi ha premuto: se
 *  nessuno dice dov'è andata, l'unico modo di ritrovarla è cercarla lente per
 *  lente. Si dice la scheda per NOME, con le stesse parole che stanno scritte
 *  sulla banda dei filtri.
 *  ⚠️ E si dice anche cosa NON è stato cancellato. L'indirizzo di una posa a
 *   domicilio e il costo del viaggio sono ore di lavoro di qualcuno: chi vede
 *   la riga cambiare scheda deve sapere che restano scritti, o li riscriverà a
 *   mano il giorno che la pratica torna dov'era. */
function raccontaConsegna(l: Lead, da: ModoConsegna, a: ModoConsegna): string {
  //  ⚠️ «NEL NOSTRO CENTRO» NON È UNA SCHEDA, È UNA LENTE, E TIENE SOLO IL DA
  //   FARE (`inNostroCentro(l) && !fatta`: la regola sta in crm/spedizione.ts,
  //   la lente in routes/CRM.installazioni.index).
  //   Una posa GIÀ FATTA che torna in sede lì dentro non c'è: mandarcela a
  //   cercare sarebbe di nuovo «il pulsante dice una cosa e lo schermo un'altra»,
  //   cioè esattamente il guasto che questo gesto è appena stato riparato per non
  //   rifare. Le altre due schede invece le fatte le mostrano — «Fatte» e
  //   «Spedite», in crm/SpedizioniPannello — quindi il distinguo serve solo qui.
  const dove =
    a === "domicilio"
      ? "Adesso è nella scheda «A domicilio»"
      : a === "spedizione"
        ? "Adesso è nella scheda «Da spedire»"
        : `Esce dalla scheda «${
            da === "spedizione" ? "Da spedire" : "A domicilio"
          }» e torna fra le pose nel nostro centro${
            posaCompletata(l)
              ? ", fra le «Completate»: la lente «Nel nostro centro» tiene solo il da fare"
              : ""
          }`;
  const resta =
    da === "domicilio"
      ? //  ── «RESTANO SCRITTI IN SCHEDA» ERA UNA CONSOLAZIONE NON VERIFICABILE ─
        //   I due campi si vedono in UN posto solo, la scheda «A domicilio»
        //   (crm/SpedizioniPannello): fuori di lì non li mostra nessuno, nemmeno
        //   la finestra della programmazione — apre i campi dell'indirizzo solo
        //   quando la posa è a domicilio (`casa`, in InstallationScheduleDialog).
        //   Dire «restano scritti in scheda» a chi poi non li trova da nessuna
        //   parte è il modo di insegnare a non fidarsi dei messaggi di questa
        //   pagina, che è la stessa ragione per cui l'agenda che si libera si
        //   promette solo quando c'era un giorno (vedi bloccavaLAgenda).
        //   ⚠️ E IL VIAGGIO NON È UN DATO FERMO: `ricavoNetto` e kpi-netto lo
        //    sottraggono dal margine di questa vendita comunque, per una
        //    trasferta che da adesso non è più in programma. È l'unica parte di
        //    questo gesto che tocca dei soldi senza che si veda, quindi si dice —
        //    con il rimedio, che è rimettere la pratica dov'era.
        a === "spedizione"
        ? "L'indirizzo se lo porta dietro: è lo stesso campo. Il costo del viaggio invece resta salvato senza vedersi più da nessuna parte, e il margine continua a sottrarlo."
        : "Indirizzo e costo del viaggio non si cancellano, ma da qui in poi non si vedono più: tornano rimettendola «A domicilio» dal menu «…». Il viaggio intanto continua a essere sottratto dal margine."
      : //  ⚠️ UN PACCO IN PREPARAZIONE NON SI TOGLIE DI MEZZO IN SILENZIO. Se
        //   qualcuno ha già confermato un indirizzo o incollato un
        //   tracciamento, quella riga stava per partire: si dice che quei dati
        //   restano e si dice come rimetterla di là, perché il ritorno indietro
        //   può benissimo essere lui, l'errore.
        da === "spedizione" && paccoInPreparazione(l)
        ? "Indirizzo e tracciamento restano scritti, ma il pacco non risulta più da preparare: se invece deve partire, rimettila «Da spedire» dal menu «…»."
        : "";
  return [`${dove}.`, resta].filter(Boolean).join(" ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. IL PULSANTE — quello della pagina Oggi, con la domanda sui soldi davanti
   ═════════════════════════════════════════════════════════════════════════ */

/** L'icona «torna indietro» per le righe delle installazioni: pacchi da
 *  spedire, pose a domicilio ed elenco normale la montano tutte e tre uguale.
 *  Non ha `onStato`: lo stato lo scrive lei, con `updateLead` del CRMContext —
 *  la stessa strada di tutte le altre azioni di questa pagina. */
export function TornaIndietroPosa({ lead }: { lead: Lead }) {
  const { consultants, updateLead } = useCRM();
  //  Lo stato da confermare, non un booleano: quando la finestra si apre deve
  //  poter dire DOVE si sta tornando, e un "true" non lo sa.
  const [daConfermare, setDaConfermare] = useState<LeadStatus | null>(null);

  const scrivi = async (richiesto: LeadStatus) => {
    const statoPrima = lead.data.stato;
    const pagamentoPrima = lead.data.payment;
    //  Com'era la posa PRIMA: serve sia a raccontarla nel messaggio (dopo il
    //  salvataggio quei campi non ci sono più) sia a rimetterla con «Annulla».
    const installazionePrima = lead.data.installazione;
    const toglieLaPosa = posaDaTogliere(lead, richiesto);
    const posaTolta = toglieLaPosa ? descriviPosa(lead, consultants) : "";
    //  Si guarda PRIMA di salvare, come tutto il resto di questo blocco: dopo la
    //  scrittura la data non c'è più, e la domanda «bloccava qualcosa?» non
    //  avrebbe più una risposta.
    const oreBloccate = toglieLaPosa && bloccavaLAgenda(lead);
    //  ⚠️ DOVE SI FINISCE, CHIESTO PRIMA DI SCRIVERE E NON DOPO. Serviva già a
    //   raccontare il messaggio; adesso serve anche a scrivere, perché è lo
    //   stato IN ARRIVO — non quello chiesto — a dire in quale scheda va la
    //   riga. Con un acconto in cassa `applyAutoStatus` può portarla altrove, e
    //   allineare la consegna a uno stato in cui la pratica non finisce sarebbe
    //   il guasto di prima con i campi invertiti.
    const arrivato = simula(lead, richiesto).stato;
    //  L'installazione senza la posa programmata, se questo gesto la porta via:
    //  è la base su cui va scritto anche il cambio di consegna, altrimenti la
    //  seconda scrittura rimetterebbe dentro il giorno appena tolto.
    //  ⚠️ OGGI LE DUE COSE NON CAPITANO MAI INSIEME, ed è scritto qui perché non
    //   si perda mezz'ora a cercare quando succede: togliere la posa richiede che
    //   la pratica ESCA dai conti, e gli unici stati che dichiarano una consegna
    //   (MODO_CONSEGNA_DA_STATO) sono le tre chiusure vinte, cioè quelle che nei
    //   conti la tengono. Passare la base resta la cosa giusta lo stesso: è la
    //   riga che tiene in piedi l'invariante il giorno che quella tabella
    //   imparasse uno stato che non è una chiusura vinta.
    const installazionePulita = toglieLaPosa ? senzaProgrammazione(installazionePrima) : undefined;
    //  ── LA SCHEDA IN CUI SI VEDE LA RIGA SEGUE LO STATO ─────────────────────
    //   La regola sta in crm/spedizione.ts, accanto al dato che le due schede
    //   leggono per filtrare: qui si prende quello che c'è da scrivere. Torna
    //   `undefined` quando non c'è niente da spostare — lo stato non dichiara
    //   nessuna consegna, il modo è già quello giusto, oppure il pacco è già
    //   partito e quello è un fatto avvenuto.
    const modoPrima = modoConsegna(lead);
    const spostamento = consegnaDaAllineare(lead, arrivato, installazionePulita);
    //  Il pacco partito è l'unico caso in cui, dopo il gesto, la riga non si
    //  muove affatto: si guarda adesso perché fra due righe la scheda è già
    //  un'altra.
    const paccoFermo = paccoPartitoNonSiSposta(lead, arrivato);
    const installazioneDaScrivereBase = spostamento?.installazione ?? installazionePulita;
    //  ── ⚠️ SU UNA POSA GIÀ FATTA, TORNARE INDIETRO DEVE DISFARE ANCHE «FATTA»
    //  Osservato dal committente: su una posa completata compariva la conferma
    //  «→ Acconto incassato» e a schermo non cambiava niente. Era vero a metà —
    //  lo stato cambiava davvero (con un acconto in cassa `applyAutoStatus` lo
    //  porta lì), ma la riga resta fra le «Completate» finché c'è
    //  `completataIl`, perché quelle lenti guardano il fatto, non lo stato.
    //  Il gesto si chiama «torna a com'era»: se la posa era stata segnata fatta
    //  DOPO il momento in cui si sta tornando, quel segno va tolto con il
    //  resto, o il pulsante continua a dire una cosa e lo schermo un'altra.
    const disfaCompletata = posaCompletata(lead);
    const senzaCompletata = (() => {
      if (!disfaCompletata) return installazioneDaScrivereBase;
      const i = { ...(installazioneDaScrivereBase ?? {}) };
      delete (i as { completataIl?: string }).completataIl;
      return i;
    })();
    const installazioneDaScrivere = senzaCompletata;
    //  ⚠️ LA RISPOSTA SI LEGGE. `updateLead` torna `false` anche senza errore di
    //   rete — per esempio quando lavora su un lead che l'elenco in memoria non
    //   ha — e senza questo controllo comparirebbe la conferma di una scrittura
    //   mai partita: la riga resterebbe dov'è e nessuno saprebbe perché.
    //   ⚠️ UNA SCRITTURA SOLA per stato, posa E consegna: separandole, una rete
    //    che cade fra le due lascerebbe la pratica fuori dai conti con
    //    l'intervento ancora in agenda, o con lo stato tornato indietro e la
    //    riga ancora nella scheda di prima — cioè esattamente lo sporco che
    //    questo gesto esiste per non lasciare.
    const salvato = await updateLead(lead.id, {
      stato: richiesto,
      ...(installazioneDaScrivere ? { installazione: installazioneDaScrivere } : {}),
      //  ⚠️ Il costo del viaggio si azzera uscendo dal domicilio, e viaggia
      //  nella STESSA scrittura: separarlo lascerebbe, se la seconda non parte,
      //  una pratica in sede con addosso il costo di una trasferta che non si
      //  farà — cioè proprio il numero invisibile che questo azzeramento
      //  esiste per togliere. Il perché sta in `consegnaDaAllineare`.
      ...(spostamento?.payment ? { payment: spostamento.payment } : {}),
    });
    if (!salvato) {
      toast.error("Non è stato salvato: la pratica resta com'era. Riprova.");
      return;
    }
    const incassato = giaIncassato(lead);
    /** ── RIMETTERE TUTTO COM'ERA ──────────────────────────────────────────
     *  Stato, importi e installazione insieme, per la stessa ragione per cui
     *  vanno insieme all'andata: un ripristino a metà lascerebbe la cassa a zero
     *  o la riga nella scheda nuova.
     *  ⚠️ ANCHE QUESTA RISPOSTA SI LEGGE. `updateLead` torna `false` anche senza
     *   errore di rete, e un «Annulla» fallito in silenzio è peggio del gesto che
     *   disfa: chi l'ha premuto è convinto di aver rimesso a posto i soldi e la
     *   posa, e va a controllare solo settimane dopo, sui totali. */
    const rimettiComEra = async () => {
      //  ⚠️ SI RIMETTE TUTTO QUELLO CHE SI ERA TOLTO, non il solo stato.
      //   Tornare a «Perditempo» azzera gli importi della scheda (vedi
      //   `applyAutoStatus`) e questo gesto può aver tolto la posa: un
      //   "Annulla" parziale direbbe di aver disfatto tutto e lascerebbe la
      //   cassa a zero o il consulente libero per un intervento che invece
      //   c'è. L'installazione si rimette INTERA — `updateLead` sostituisce
      //   il campo tutto insieme, e un `undefined` lascerebbe in scheda
      //   proprio la versione senza posa.
      //   ⚠️ LA CONDIZIONE È «È STATA SCRITTA?», non più «è stata tolta la
      //    posa?»: adesso l'installazione si scrive anche solo per spostare
      //    la consegna, e con la vecchia condizione «Annulla» rimetteva lo
      //    stato di prima lasciando la riga nella scheda nuova — cioè il
      //    guasto appena riparato, di nuovo, dalla parte opposta.
      const rimesso = await updateLead(lead.id, {
        stato: statoPrima,
        ...(pagamentoPrima ? { payment: pagamentoPrima } : {}),
        ...(installazioneDaScrivere ? { installazione: installazionePrima ?? {} } : {}),
      });
      if (!rimesso) {
        toast.error(
          "«Annulla» non è riuscito: la pratica è rimasta come l'ha lasciata il ritorno indietro. Riprova.",
        );
      }
    };
    //  Le cose da dire stanno in una riga sola, nell'ordine in cui interessano:
    //  prima dove è finita la pratica, poi in quale scheda si vede adesso, poi
    //  cosa si è liberato in agenda. Un messaggio per ciascuna sarebbe stato
    //  tre messaggi con tre «Annulla» diversi, e ognuno avrebbe disfatto un
    //  pezzo solo del gesto.
    const spiegazioni = [
      arrivato === richiesto
        ? null
        : `Non torna a «${LEAD_STATUS_LABEL[richiesto] ?? richiesto}»: con ${eur(
            incassato,
          )} già incassati la scheda resta fra le vendite.`,
      //  ── LA RIGA HA CAMBIATO SCHEDA, E SI DICE QUALE ──────────────────────
      //   È la frase che mancava: senza, il gesto riusciva e la riga spariva —
      //   o, peggio, restava lì identica — senza che nessuno sapesse perché.
      spostamento ? raccontaConsegna(lead, modoPrima, spostamento.modo) : null,
      //  ⚠️ E QUANDO INVECE NON SI MUOVE, LO SI DICE LO STESSO. Un pacco già
      //   partito non torna a essere una posa da fare: quello che è successo è
      //   successo, e la riga resta fra le «Spedite» perché è lì che si guarda
      //   quando il cliente chiama e chiede dov'è. Tacere qui rifarebbe il
      //   guasto di prima al contrario — schermo fermo, nessuna spiegazione.
      paccoFermo
        ? "Il pacco risulta già partito, quindi la pratica resta fra le «Spedite»: una spedizione avvenuta non torna indietro con lo stato."
        : null,
      //  ⚠️ «L'agenda torna libera» si dice SOLO se c'era un giorno: su una posa
      //   con le persone già scelte e la data ancora da trovare non era bloccato
      //   niente, e annunciare uno sblocco che non è avvenuto insegna a non
      //   fidarsi anche degli altri messaggi di questa pagina.
      posaTolta
        ? `Tolta anche la posa programmata (${posaTolta})${
            oreBloccate ? ": l'agenda torna libera" : ""
          }.`
        : null,
    ].filter(Boolean);
    toast.success(`${nomeCompleto(lead)} → ${LEAD_STATUS_LABEL[arrivato] ?? arrivato}`, {
      description: spiegazioni.length ? spiegazioni.join(" ") : undefined,
      action: {
        label: "Annulla",
        onClick: () => void rimettiComEra(),
      },
    });
  };

  /** ── ⚠️ SU UNA POSA ESEGUITA «INDIETRO» VUOL DIRE UNA COSA SOLA ────────
   *  Segnalato dal committente: «faccio tornare un'installazione completata
   *  allo stato precedente e il lead si cancella». Non si cancellava — ma da
   *  dove guardava lui era peggio, perché non c'era modo di saperlo.
   *
   *  Cosa succedeva davvero: chiudere una posa NON cambia lo stato, scrive
   *  `completataIl`. Quindi `statoPrecedente` non è lo stato di prima della
   *  chiusura: è quello di prima della VENDITA — «Appuntamento fissato», «In
   *  valutazione». Tornarci sopra toglieva la pratica dai vinti, e con lei
   *  dalle installazioni, dai conti del mese e dall'attribuzione della
   *  campagna. La riga spariva dalla schermata in cui si era premuto il
   *  pulsante, e nessuno può indovinare che è andata a finire fra i lead
   *  aperti.
   *  ⚠️ E su uno `statoPrecedente` uguale a «Perditempo» sarebbe stata perdita
   *   di dati vera: `applyAutoStatus` azzera prezzo, acconto e saldo.
   *
   *  Adesso su una posa ESEGUITA il pulsante disfa L'ESECUZIONE e basta: via
   *  `completataIl`, lo stato non si tocca, la vendita resta. È la stessa cosa
   *  che fa «Eseguita → riportala fra quelle da fare», ed è giusto che le due
   *  porte facciano la stessa cosa invece di due cose diverse.
   *  Chi vuole davvero disfare la VENDITA lo fa quando la posa non risulta più
   *  eseguita, cioè premendo due volte: due gesti per due decisioni diverse. */
  const disfaSoloLEsecuzione = async () => {
    const installazionePrima = lead.data.installazione;
    const i = { ...(installazionePrima ?? {}) };
    delete (i as { completataIl?: string }).completataIl;
    const ok = await updateLead(lead.id, { installazione: i });
    if (!ok) {
      toast.error("Non è stato salvato: la posa resta eseguita. Riprova.");
      return;
    }
    toast.success(`Posa di nuovo da fare · ${nomeCompleto(lead)}`, {
      description:
        "La vendita non si è toccata: il cliente resta venduto, gli importi restano scritti e il mese continua a contarla. Premendo di nuovo si può tornare anche allo stato di prima.",
      action: {
        label: "Annulla",
        onClick: () => void updateLead(lead.id, { installazione: installazionePrima ?? {} }),
      },
    });
  };

  const chiedi = (l: Lead, richiesto: LeadStatus) => {
    //  ⚠️ Prima di tutto il resto: vedi `disfaSoloLEsecuzione`.
    if (posaCompletata(l)) {
      void disfaSoloLEsecuzione();
      return;
    }
    /*  ── ⚠️ IL RITORNO CHE NON PORTA DA NESSUNA PARTE ────────────────────
        Segnalato dal committente: premendo la freccia compariva il messaggio
        «→ Acconto incassato» e la riga restava identica. Non era un difetto di
        aggiornamento dello schermo — non stava andando da nessuna parte.
        `applyAutoStatus` (crm/types) ha l'ultima parola su ogni salvataggio e
        con dei soldi in cassa riporta la scheda ad «Acconto incassato»: se è
        già lì, lo stato chiesto viene riscritto in quello di partenza e la
        scrittura è una modifica finta. Partiva lo stesso, annunciava un cambio
        mai avvenuto e offriva pure «Annulla» per disfarlo.
        Dove nessuno stato si muove non si muove nemmeno il resto: la consegna
        si allinea allo stato IN ARRIVO (che è quello di adesso) e la posa si
        toglie solo se la pratica esce dai conti, che qui non succede. Quindi è
        un vero nulla di fatto, e l'unica cosa giusta da fare è dirlo — con la
        cifra che lo impedisce e con il rimedio, perché «non si può» senza un
        seguito è un pulsante che sembra rotto. */
    const arrivato = simula(l, richiesto).stato;
    if (arrivato === l.data.stato) {
      const incassato = giaIncassato(l);
      toast.warning(`${nomeCompleto(l)} resta «${LEAD_STATUS_LABEL[arrivato] ?? arrivato}»`, {
        description: `Non si torna a «${
          LEAD_STATUS_LABEL[richiesto] ?? richiesto
        }»: finché ci sono ${eur(
          incassato,
        )} incassati la scheda resta fra le vendite, e lo stato ci viene riportato da solo a ogni salvataggio. Per portarla davvero indietro va prima tolto l'acconto dalla scheda del cliente.`,
      });
      return;
    }
    if (esceDaiConti(l, richiesto)) {
      setDaConfermare(richiesto);
      return;
    }
    void scrivi(richiesto);
  };

  return (
    <>
      <TornaIndietro lead={lead} onStato={chiedi} />
      {/*  La finestra si monta SOLO quando serve: qui le righe sono centinaia e
          una finestra per riga, tenuta chiusa, è lavoro pagato ogni volta che
          l'elenco si ridisegna. */}
      {daConfermare && (
        <ConfermaRitorno
          lead={lead}
          richiesto={daConfermare}
          //  I nomi si risolvono dove l'elenco dei consulenti c'è già: la
          //  finestra riceve delle persone e non cerca nessuno.
          consulenti={consultants}
          onChiudi={() => setDaConfermare(null)}
          onConferma={() => {
            setDaConfermare(null);
            void scrivi(daConfermare);
          }}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA CONFERMA — si chiede solo quando i soldi si muovono davvero
   ═════════════════════════════════════════════════════════════════════════ */

/** Cosa perde questa pratica tornando indietro, detto per esteso e con le
 *  cifre in euro: "esce dai conti" senza numeri non si capisce quanto pesa.
 *  Non è una conferma di rito — questa finestra si apre solo sulle pratiche che
 *  oggi contano come vendita e domani non conterebbero più. */
function ConfermaRitorno({
  lead,
  richiesto,
  consulenti,
  onChiudi,
  onConferma,
}: {
  lead: Lead;
  richiesto: LeadStatus;
  consulenti: Consultant[];
  onChiudi: () => void;
  onConferma: () => void;
}) {
  const etichetta = LEAD_STATUS_LABEL[richiesto] ?? richiesto;
  const dopo = leadSimulato(lead, richiesto);
  const incassato = giaIncassato(lead);
  const prezzo = prezzoVendita(lead);
  //  Gli importi non si cancellano quasi mai — restano scritti in scheda e
  //  smettono solo di essere sommati. Su «Perditempo» invece spariscono davvero,
  //  e lo si scopre confrontando la scheda di adesso con quella simulata: la
  //  regola sta in `applyAutoStatus` e va letta da lì, non riconosciuta a
  //  memoria dal nome dello stato.
  const importiAzzerati = giaIncassato(dopo) < incassato || prezzoVendita(dopo) < prezzo;
  //  La stessa domanda che si fa il salvataggio, fatta con le stesse parole: se
  //  qui dicesse una cosa e la scrittura ne facesse un'altra, il posto in cui
  //  ci si accorgerebbe è l'agenda di un collega.
  const toglieLaPosa = posaDaTogliere(lead, richiesto);
  //  ⚠️ QUI NON SI PARLA DI SCHEDE DELLA CONSEGNA, E NON È UNA DIMENTICANZA.
  //   Questa finestra si apre SOLO quando la pratica esce dai conti, cioè
  //   quando lo stato in arrivo non è una delle tre chiusure vinte — e sono
  //   quelle le uniche che dichiarano una consegna (MODO_CONSEGNA_DA_STATO in
  //   types.ts). Dove non c'è una consegna dichiarata la riga non cambia
  //   scheda: il pacco resta da preparare e la posa a domicilio resta a
  //   domicilio, che è quello che serve — una pratica riportata «in
  //   valutazione» non smette di avere l'impianto già imballato. Lo spostamento
  //   di scheda vive tutto sull'altra strada, quella senza conferma
  //   (`scrivi`), dove si corregge una chiusura con un'altra chiusura.
  //  ⚠️ IL CASO CHE NON SI PUÒ DISFARE: la posa risulta GIÀ FATTA. Non si
  //   cancella — chi c'è andato e quando è un fatto avvenuto, non una
  //   prenotazione — e va detto qui, perché la finestra promette di riportare la
  //   pratica indietro e questa è la parte che resta dov'è.
  const posaGiaFatta = posaProgrammata(lead) && posaCompletata(lead);
  //  Senza una data di posa e senza un euro incassato la pratica esce anche
  //  dall'insieme di questa pagina (vedi `inLavorazione` in
  //  routes/CRM.installazioni.index): la riga sparisce sotto le dita, e chi non
  //  se l'aspetta la cerca per mezz'ora.
  //  ⚠️ La data va guardata DOPO: se questo gesto porta via la posa, la riga
  //   sparisce anche a chi una data ce l'aveva — cioè proprio nel caso in cui
  //   prima questa nota taceva.
  const senzaData = toglieLaPosa || !lead.data.installazione?.dataInstallazione;
  //  ⚠️ SENZA DATA CI SONO DUE MODI DI USCIRE DA QUESTA PAGINA, e prima se ne
  //   guardava uno solo. `inLavorazione` tiene una pratica senza giorno se ha
  //   incassato qualcosa, MA prima ancora butta fuori "concluso" e
  //   "perdi_tempo" senza nemmeno guardare la cassa. Una pratica riaperta e
  //   richiusa torna indietro proprio a «concluso»: con l'acconto in cassa la
  //   nota taceva, e la riga spariva lo stesso sotto le dita.
  //   Su "perdi_tempo" la condizione era già vera per un'altra strada
  //   (`applyAutoStatus` azzera gli importi, quindi l'incassato simulato è 0):
  //   scriverlo per esteso costa una riga e non lascia la cosa appesa a un
  //   effetto collaterale di un'altra funzione.
  const fuoriDaQuestaPagina = dopo.data.stato === "concluso" || dopo.data.stato === "perdi_tempo";
  const rigaSparisce = senzaData && (fuoriDaQuestaPagina || giaIncassato(dopo) === 0);
  //  L'incasso del saldo è l'esempio da manuale di quello che tornare indietro
  //  NON disfa: i soldi sono entrati davvero, e nessuno stato li fa uscire dal
  //  cassetto. Si dice con la cifra e con la data, o non si è detto niente.
  const incasso = incassoRegistrato(lead);

  return (
    <Finestra
      aperta
      onCambio={(v) => {
        if (!v) onChiudi();
      }}
      //  Un clic fuori non deve valere né "sì" né "no" su una finestra che
      //  muove il fatturato: si esce da uno dei due pulsanti.
      bloccante
      larghezza="sm"
      icona={Undo2}
      titolo={`Torna a «${etichetta}»?`}
      contesto={nomeCompleto(lead)}
      classeCorpo="space-y-2"
      azioni={
        <>
          <Button variant="outline" onClick={onChiudi}>
            Lascia com&apos;è
          </Button>
          <Button onClick={onConferma}>Sì, torna indietro</Button>
        </>
      }
    >
      <NotaFinestra tono="attenzione" icona={AlertTriangle}>
        Oggi questa pratica conta come una vendita. Riportandola a «{etichetta}» smette di contarci:
        esce dal fatturato del periodo, dai clienti acquisiti e dall&apos;attribuzione delle
        campagne.
      </NotaFinestra>

      {importiAzzerati ? (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          «{etichetta}» azzera anche gli importi scritti in scheda: {eur(incassato)} già incassati e{" "}
          {eur(prezzo)} di totale tornano a zero. L&apos;«Annulla» del messaggio li rimette, ma solo
          finché il messaggio è a schermo.
        </NotaFinestra>
      ) : (
        <NotaFinestra>
          Gli importi restano scritti in scheda — {eur(incassato)} già incassati, {eur(prezzo)} di
          totale — e non si cancella niente: semplicemente nessun totale li somma più.
        </NotaFinestra>
      )}

      {/*  ── LA POSA SE NE VA CON LA VENDITA ────────────────────────────────
          Detta per esteso, con giorno, ora e nomi: «viene tolta la
          programmazione» non permette di controllare se era davvero quella
          sbagliata, e soprattutto non permette di rifissarla uguale se il
          ritorno indietro era l'errore. Il tono è di attenzione come quello del
          fatturato, perché il peso è lo stesso: da questo momento quel giorno,
          per quel consulente, torna prenotabile da chiunque. */}
      {toglieLaPosa && (
        <NotaFinestra tono="attenzione" icona={CalendarX2}>
          Se ne va anche la posa programmata — {descriviPosa(lead, consulenti)} —{" "}
          {/*  ⚠️ LE DUE FRASI NON SONO INTERCAMBIABILI. Le ore in agenda le
              blocca `dataInstallazione`, non le persone scritte in scheda:
              senza un giorno non c'è nessuna fascia che si libera, e prometterla
              lo stesso è una riga che chi lavora non può verificare. */}
          {bloccavaLAgenda(lead)
            ? `e con lei le ore bloccate in agenda: quella fascia torna prenotabile da chiunque, e la pratica esce dalla sua giornata negli elenchi delle installazioni.`
            : `cioè le persone che erano già state impegnate su questo intervento. In agenda non si libera niente, perché senza un giorno fissato non c'era ancora nessuna fascia occupata.`}{" "}
          L&apos;«Annulla» del messaggio la rimette esattamente com&apos;era, ma solo finché il
          messaggio è a schermo.
        </NotaFinestra>
      )}

      {/*  Quello che NON si disfa si dice qui, non si scopre dopo. */}
      {posaGiaFatta && (
        <NotaFinestra>
          La posa risulta già fatta: giorno, ora e chi ci è andato restano scritti. Un intervento
          avvenuto non si cancella tornando indietro con lo stato — per rimetterlo fra quelli da
          fare c&apos;è «Ancora da fare» nel menu «…» della riga.
        </NotaFinestra>
      )}

      {incasso && incasso.importo > 0 && (
        <NotaFinestra>
          L&apos;incasso del saldo già registrato — {eur(incasso.importo)}{" "}
          {incasso.conIva ? `con IVA ${incasso.aliquotaIva}%` : "senza IVA"}
          {incasso.data ? ` il ${dataBreve(incasso.data)}` : ""} — resta com&apos;è: quei soldi sono
          entrati davvero e nessuno stato li fa tornare indietro. Se il denaro va restituito, è un
          movimento da registrare a parte.
        </NotaFinestra>
      )}

      {rigaSparisce && (
        <NotaFinestra>
          Senza una data di posa e senza acconto la riga esce anche da questa pagina: la si ritrova
          dall&apos;elenco dei lead.
        </NotaFinestra>
      )}

      {/*  Il giorno della conversione non si tocca tornando indietro, ed è
          giusto così finché la vendita si richiude: chiudendola di nuovo resta
          attribuita al giorno in cui fu vinta la prima volta, cioè al mese in
          cui è stata fatta. Va detto, perché è l'unica parte di questo gesto
          che NON si disfa da sola. */}
      <NotaFinestra>
        La data di conversione già registrata resta com&apos;è: se la pratica si richiude, la
        vendita continua a contare nel giorno in cui è stata vinta la prima volta.
      </NotaFinestra>
    </Finestra>
  );
}
