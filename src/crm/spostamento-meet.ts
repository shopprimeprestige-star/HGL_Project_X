/** ── QUANDO UNA CONSULENZA CAMBIA GIORNO, IL LINK VA RIFATTO ───────────────
 *
 *  Richiesta del committente: «se sposto un appuntamento a un cliente,
 *  l'anteprima la cambia: genera un nuovo link di Meetly, con la nuova
 *  anteprima aggiornata con il nuovo giorno e orario».
 *
 *  ── PERCHÉ NON BASTA RIDISEGNARE L'IMMAGINE ──────────────────────────────
 *  L'anteprima di un link è un file depositato sotto il CODICE della stanza
 *  (`anteprima:invito:<codice>`, vedi routes/api.anteprima.ts). Spostando
 *  l'appuntamento si può benissimo riscrivere quel file con la data nuova —
 *  ed è quello che si faceva — ma il cliente continua a vedere il vecchio:
 *  l'indirizzo dell'immagine non è cambiato, e i server di WhatsApp tengono in
 *  cache l'anteprima di un link per giorni. Il messaggio con le 15:00 resta
 *  con le 15:00 scritte sopra anche dopo che l'appuntamento è passato alle 18.
 *
 *  L'unica cosa che i programmi di messaggistica rileggono davvero è un link
 *  che non hanno mai visto. Quindi uno spostamento conia un CODICE NUOVO: link
 *  nuovo, indirizzo dell'immagine nuovo, anteprima nuova, e nel messaggio che
 *  si manda per avvisare del cambio c'è già tutto giusto.
 *
 *  ── ⚠️ E IL LINK VECCHIO? NON MUORE ───────────────────────────────────────
 *  È la regola che in questo programma non si può violare: il codice di un
 *  appuntamento è l'unica cosa che il cliente ha in mano, ed è già partito per
 *  WhatsApp. Chi coniava un codice nuovo lasciando il vecchio a vuoto ha già
 *  prodotto il guasto peggiore che ci sia — «il cliente non riesce a entrare»,
 *  con il consulente che trasmette in una stanza e il cliente fermo sulla
 *  schermata d'attesa di un'altra.
 *  Per questo lo spostamento lascia un RINVIO: una riga che dice «il codice
 *  vecchio adesso è questo qui» (routes/api.crm.meeting-session, `rigenera`).
 *  Chi apre il link vecchio viene portato in quello nuovo dalla stessa
 *  richiesta che già fa mentre aspetta (routes/api.presenter.session risponde
 *  con `rinvio`): nessuna richiesta in più, nessun ritardo all'ingresso.
 *
 *  ── PERCHÉ LA REGOLA STA QUI E NON DENTRO IL SALVATAGGIO ─────────────────
 *  Perché si prova. «L'appuntamento si è spostato?» sembra una domanda da una
 *  riga (`prima.dataMeeting !== dopo.dataMeeting`) e non lo è: le date in
 *  archivio arrivano in tre forme diverse, un appuntamento appena fissato non
 *  è uno spostamento, e una consulenza disdetta nemmeno. Sbagliare in un senso
 *  vuol dire non rifare il link quando serve; sbagliare nell'altro vuol dire
 *  coniare un codice nuovo a ogni salvataggio di una scheda, cioè invalidare
 *  link veri per niente. Vedi proveDelloSpostamento in prove/prove.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import { dataPulita, durataPulita, oraPulita } from "./invito";

/** Quello che serve sapere di una scheda per rispondere alle domande qui sotto.
 *  Volutamente MINIMO: così la regola si prova con tre campi, senza costruire
 *  una scheda finta di quaranta. */
export interface QuandoConsulenza {
  dataMeeting?: string;
  oraMeeting?: string;
  durataMeeting?: number;
}

/** Il momento della consulenza come lo si scrive alla stanza: «2026-09-30T15:00».
 *  Stringa vuota quando un appuntamento non c'è, o quando giorno e ora non si
 *  riescono a leggere — che è diverso da «è cambiato». */
export function momentoConsulenza(d: QuandoConsulenza | null | undefined): string {
  const giorno = dataPulita(d?.dataMeeting);
  const ora = oraPulita(d?.oraMeeting);
  return giorno && ora ? `${giorno}T${ora}` : "";
}

/** ── L'APPUNTAMENTO SI È SPOSTATO? ─────────────────────────────────────────
 *  Vero SOLO quando c'era un appuntamento leggibile e adesso ce n'è un altro,
 *  in un momento diverso. Le tre esclusioni non sono cautela, sono la
 *  definizione:
 *
 *   · PRIMA non c'era niente → è un appuntamento appena fissato, non uno
 *     spostamento: la stanza nasce adesso (vedi `assicuraStanza`) e il link è
 *     già nuovo. Coniarne un secondo subito dopo vorrebbe dire due link per lo
 *     stesso appuntamento nello stesso minuto.
 *   · ADESSO non c'è niente → la consulenza è stata disdetta o rimandata a
 *     data da destinarsi. Non c'è nessun giorno nuovo da scrivere
 *     sull'anteprima, e invalidare il link di una persona a cui si dovrà
 *     comunque riscrivere non serve a nessuno.
 *   · LO STESSO MOMENTO → si salva la scheda per mille altri motivi (una nota,
 *     lo stato, il consulente). ⚠️ Questa è la riga che impedisce a un
 *     salvataggio qualunque di far cambiare il link a un cliente.
 *
 *  ⚠️ La DURATA non entra qui, di proposito: allungare una consulenza di
 *   quindici minuti non sposta l'appuntamento e non giustifica di bruciare il
 *   link che il cliente ha in mano. Cambia però quello che c'è scritto sul
 *   biglietto («dalle 15:00 alle 15:45»), quindi l'anteprima va comunque
 *   ridisegnata: è la domanda separata qui sotto. */
export function consulenzaSpostata(
  prima: QuandoConsulenza | null | undefined,
  dopo: QuandoConsulenza | null | undefined,
): boolean {
  const a = momentoConsulenza(prima);
  const b = momentoConsulenza(dopo);
  return !!a && !!b && a !== b;
}

/** ── IL BIGLIETTO VA RIDISEGNATO? ──────────────────────────────────────────
 *  Domanda più larga della precedente: comprende la durata, perché sul
 *  biglietto c'è scritta l'ora di fine. Si usa quando la stanza resta quella —
 *  stesso codice, stesso indirizzo dell'immagine — e va solo riscritto il file
 *  con i dati di adesso: costa un disegno e serve a chi apre il link da capo. */
export function anteprimaDaRifare(
  prima: QuandoConsulenza | null | undefined,
  dopo: QuandoConsulenza | null | undefined,
): boolean {
  if (!momentoConsulenza(dopo)) return false;
  if (consulenzaSpostata(prima, dopo)) return true;
  //  Stesso momento: resta la durata. Si confrontano i valori RIPULITI, o un
  //  45 scritto come "45" passerebbe per una modifica a ogni salvataggio.
  return durataPulita(prima?.durataMeeting) !== durataPulita(dopo?.durataMeeting);
}

/** La chiave della riga che rinvia dal codice vecchio a quello nuovo.
 *  Sta qui, accanto alla regola che la fa nascere, e non scritta a mano nei due
 *  punti che la usano: due forme diverse della stessa chiave vogliono dire un
 *  cliente che resta fuori dalla stanza, ed è il guasto che questa riga esiste
 *  per evitare. */
export const chiaveRinvio = (codice: string) => `meet-rinvio:${String(codice || "").trim()}`;
