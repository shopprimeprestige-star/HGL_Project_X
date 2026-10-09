/** ─────────────────────────────────────────────────────────────────────────
 *  quando-per-stato.ts — QUALI STATI CHIEDONO UNA DATA
 *
 *  PERCHÉ QUESTO FILE ESISTE
 *  La tabella stava dentro LeadDialog.tsx e non era esportata, così CRM.tsx se
 *  n'era fatta una copia — con tanto di commento che lo ammetteva («la tabella
 *  è ricopiata e non importata»). Due tabelle gemelle sopravvivono finché
 *  qualcuno aggiunge uno stato con data da una parte sola: da quel giorno la
 *  ricerca ⌘K non chiede più la data che la scheda chiede, e il lead esce dalle
 *  code di lavoro senza che nessuno se ne accorga.
 *  Adesso la tabella è UNA, qui, e la leggono tutti: la scheda del lead, la
 *  ricerca, e il selettore di stato — che ci disegna sopra l'icona calendario.
 *
 *  IL CRITERIO, in una riga: uno stato chiede la data quando PROMETTE UN
 *  MOMENTO. «Ricontatto fissato» dice che risentiremo il cliente, «Visita in
 *  sede» che ci vediamo, «Appuntamento fissato» che c'è una consulenza. Se la
 *  promessa non porta con sé un giorno, il lead esce dalle code di lavoro
 *  (che ordinano per data) e non ci rientra: è così che nascono gli arretrati.
 *
 *  NON la chiedono, e non è una dimenticanza:
 *   · da_contattare, non_risponde, segreteria — sono il giro di telefonate: si
 *     premono venti volte al giorno dal blocco della chiamata, e una
 *     finestrella a ogni tocco renderebbe il lavoro più lento invece che più
 *     sicuro. La data del richiamo resta scrivibile lì sotto, nei suoi campi;
 *   · annullato, perdi_tempo, no_show, non_fatto, concluso — non promettono
 *     niente: chiedono semmai un motivo, ed è il blocco «perché è andato perso»;
 *   · fatto — la consulenza è avvenuta: quello che manca è il prezzo, non una
 *     data;
 *   · venduto e acconto — quello che manca sono gli importi e la posa, che
 *     hanno la loro schermata (la consegna).
 *
 *  OGNI VOCE NOMINA IL SUO CAMPO. È la garanzia che rende impossibile ripetere
 *  il guasto storico della vecchia barra: lì il campo di destinazione lo
 *  decideva lo stato corrente, così su certi stati la data digitata finiva in
 *  un campo diverso da quello che l'elenco leggeva, e sembrava «non si può
 *  cambiare». Qui la destinazione è scritta nella tabella, e la finestrella la
 *  scrive perfino a schermo sotto la data.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { LeadStatus } from "./types";

export type ChiaveData = "dataMeeting" | "dataRicontatto" | "dataVieneInSede";
export type ChiaveOra = "oraMeeting" | "oraRicontatto" | "oraVieneInSede";

export interface RichiestaQuando {
  chiaveData: ChiaveData;
  chiaveOra: ChiaveOra;
  /** Come si chiama il campo sulla scheda: è quello che si legge a schermo. */
  nomeCampo: string;
  /** L'azione, non l'oggetto: è il titolo della finestrella. */
  titolo: string;
  nota: string;
  /** true = l'ora fa parte della promessa fatta al cliente. */
  oraObbligatoria: boolean;
  /** true = ha senso passare all'agenda del consulente (solo la consulenza). */
  conOrariLiberi?: boolean;
}

export const QUANDO_CONSULENZA: RichiestaQuando = {
  chiaveData: "dataMeeting",
  chiaveOra: "oraMeeting",
  nomeCampo: "Data della consulenza",
  titolo: "Quando è la consulenza",
  nota: "Giorno e ora della videoconsulenza",
  oraObbligatoria: true,
  conOrariLiberi: true,
};

/*  La stessa domanda, fatta quando l'appuntamento c'è già: cambia solo il
 *  verbo. Scritta una volta sola perché la usano tre punti diversi (il tasto
 *  «Sposta» del blocco dell'appuntamento, quello del blocco dell'esito e lo
 *  stato «Da riprogrammare»), e tre copie che divergono sono tre finestre che
 *  si comportano in tre modi. */
export const SPOSTA_CONSULENZA: RichiestaQuando = {
  ...QUANDO_CONSULENZA,
  titolo: "Sposta la consulenza",
  nota: "La data nuova sostituisce quella in agenda",
};

export const QUANDO_PER_STATO: Partial<Record<LeadStatus, RichiestaQuando>> = {
  appuntamento_fissato: QUANDO_CONSULENZA,
  //  Il cliente di ritorno chiede giorno e ora esattamente come il primo
  //  appuntamento: un «Appuntamento rifissato» senza data sarebbe la stessa
  //  contraddizione, con in più la storia alle spalle.
  appuntamento_rifissato: QUANDO_CONSULENZA,
  da_spostare: SPOSTA_CONSULENZA,
  viene_in_sede: {
    chiaveData: "dataVieneInSede",
    chiaveOra: "oraVieneInSede",
    nomeCampo: "Data in sede",
    titolo: "Quando viene in sede",
    nota: "La visita occupa l'agenda del consulente",
    oraObbligatoria: true,
  },
  /*  ── ⚠️ L'ORA DEL RICONTATTO È FACOLTATIVA, TUTTA LA FAMIGLIA ─────────
      Richiesta del committente: «quando metto questi stati, l'orario di quando
      vanno ricontattati sia opzionale».
      Qui l'ora era obbligatoria su due stati e facoltativa sugli altri cinque
      che scrivono NEGLI STESSI CAMPI: la stessa promessa — «ti risento» —
      chiedeva un passaggio in più o no a seconda dello stato scelto, e nei due
      casi obbligatori si finiva per inventare un orario pur di chiudere la
      finestra. Un orario inventato è peggio di nessun orario: il cliente lo
      legge nel messaggio («ci sentiamo alle 15») e a quell'ora aspetta.
      ⚠️ IL GIORNO RESTA OBBLIGATORIO, e non è una dimenticanza: è la data che
       riporta la scheda nelle code di lavoro. Senza, il lead esce dal giro e
       non ci rientra — è così che nascono gli arretrati. */
  richiamo: {
    chiaveData: "dataRicontatto",
    chiaveOra: "oraRicontatto",
    nomeCampo: "Data del richiamo",
    titolo: "Quando lo richiami",
    nota: "L'ora è facoltativa: mettila se l'ha chiesta lui",
    oraObbligatoria: false,
  },
  da_ricontattare: {
    chiaveData: "dataRicontatto",
    chiaveOra: "oraRicontatto",
    nomeCampo: "Data del richiamo",
    titolo: "Fissa il ricontatto",
    nota: "È la data che lo riporta nelle code di lavoro. L'ora è facoltativa",
    oraObbligatoria: false,
  },
  /*  ── CI RICONTATTA LUI ──────────────────────────────────────────────
      Richiesta del committente: «aggiungi come stato ci ricontatta lui, e
      segna la data di quando lo ha detto — quella di oggi, sempre — e quando
      dice che ricontatta».
      La data che si chiede qui è la SECONDA: entro quando ha detto che si fa
      vivo. La prima — il giorno in cui l'ha detto — non si chiede a nessuno:
      è oggi, e la scrive il programma (vedi `ciRicontattaDettoIl` in
      crm/types e updateLead in crm/CRMContext).
      ⚠️ IL GIORNO RESTA OBBLIGATORIO anche se la palla ce l'ha lui: è quello
       che riporta la scheda in coda se quel giorno passa in silenzio. Senza,
       «ti faccio sapere io» è il modo più elegante di perdere un lead. */
  ci_ricontatta_lui: {
    chiaveData: "dataRicontatto",
    chiaveOra: "oraRicontatto",
    nomeCampo: "Entro quando si fa vivo",
    titolo: "Entro quando ricontatta",
    nota: "L'ha detto lui: se quel giorno passa in silenzio, la scheda torna in coda",
    oraObbligatoria: false,
  },
  fissa_meet_dopo: {
    chiaveData: "dataRicontatto",
    chiaveOra: "oraRicontatto",
    nomeCampo: "Data del richiamo",
    titolo: "Quando lo risenti per fissare",
    nota: "L'ora è facoltativa: qui conta il giorno",
    oraObbligatoria: false,
  },
  sta_valutando: {
    chiaveData: "dataRicontatto",
    chiaveOra: "oraRicontatto",
    nomeCampo: "Data del richiamo",
    titolo: "Quando lo risenti",
    nota: "Sta valutando: senza una data non lo richiama nessuno",
    oraObbligatoria: false,
  },
  gestire_in_chat: {
    chiaveData: "dataRicontatto",
    chiaveOra: "oraRicontatto",
    nomeCampo: "Data del richiamo",
    titolo: "Quando lo risenti",
    nota: "Anche una chat ha bisogno di un giorno in cui riprenderla",
    oraObbligatoria: false,
  },
  in_attesa_acconto: {
    chiaveData: "dataRicontatto",
    chiaveOra: "oraRicontatto",
    nomeCampo: "Data del richiamo",
    titolo: "Quando solleciti l'acconto",
    nota: "Un acconto atteso e mai sollecitato è un lead perso",
    oraObbligatoria: false,
  },
  sede_disdetta: {
    chiaveData: "dataRicontatto",
    chiaveOra: "oraRicontatto",
    nomeCampo: "Data del richiamo",
    titolo: "Quando lo risenti",
    nota: "La visita è saltata: serve il giorno in cui la si riprende",
    oraObbligatoria: false,
  },
};

/** ── L'AVVISO DEL CALENDARIO ──────────────────────────────────────────────
 *  Le chiavi della tabella qui sopra, e nient'altro: è DERIVATA, non un secondo
 *  elenco da tenere allineato a mano. Il selettore di stato la legge per
 *  disegnare l'icona calendario sul pulsante — un avviso, non un comando: dice
 *  che scegliendo quello stato verrà chiesta una data. Il giorno in cui uno
 *  stato entra o esce dalla tabella, l'icona lo segue da sola. */
export const STATI_CON_DATA: ReadonlySet<LeadStatus> = new Set(
  Object.keys(QUANDO_PER_STATO) as LeadStatus[],
);

/** Vero se scegliere questo stato farà comparire la domanda «quando».
 *  Accetta anche stati sconosciuti o mancanti: dal database arriva di tutto e
 *  un `undefined` qui dentro non deve diventare un errore di render. */
export function chiedeUnaData(s: LeadStatus | string | null | undefined): boolean {
  return !!s && STATI_CON_DATA.has(s as LeadStatus);
}
