/** ── CHI STA RALLENTANDO: tu, il cliente, il ponte o il tuo computer ───────
 *
 *  Richiesta del committente: «mostrami, quando lagga, se sta laggando il
 *  server, la mia connessione o la connessione dell'utente».
 *
 *  PERCHÉ SERVE DAVVERO. Quando l'immagine si impunta, in consulenza succede
 *  sempre la stessa scena: ci si scusa con il cliente dando la colpa alla
 *  «linea», senza sapere di chi. Se è la sua, si può dirgli di avvicinarsi al
 *  router; se è la tua, si spegne la camera e si continua a voce; se è il
 *  computer, si chiude qualcos'altro; se è il ponte, non può farci niente
 *  nessuno dei due e va detto. Sono quattro reazioni diverse, e senza questo
 *  numero si tirava a indovinare.
 *
 *  ── COSA SI GUARDA, E PERCHÉ BASTA ───────────────────────────────────────
 *  Tutto viene da `getStats()` della connessione viva, cioè da misure, non da
 *  stime:
 *   · `limite` — lo dice l'encoder stesso: «cpu» = il computer non ce la fa a
 *     comprimere, «rete» = non c'è banda per quello che sto mandando;
 *   · `persiSu` — la frazione di pacchetti che l'ALTRO dichiara di aver perso
 *     su quello che gli mandiamo (arriva nei suoi rapporti di ritorno). È la
 *     misura del percorso verso di lui;
 *   · `persiGiu` — la frazione che PERDIAMO NOI su quello che lui manda: è il
 *     percorso dalla sua parte verso di noi, cioè quasi sempre la sua linea in
 *     salita;
 *   · `rttMs` — quanto ci mette un pacchetto ad andare e tornare. Alto su un
 *     percorso diretto è distanza o rete mobile; alto quando si passa dal
 *     ponte è il ponte;
 *   · `ponte` — il video passa da un relay TURN invece che da punto a punto.
 *
 *  ⚠️ UNA SOLA COLPA ALLA VOLTA, E LA PIÙ PROBABILE. Non è un referto medico:
 *   è una frase da leggere in mezzo secondo mentre si parla con un cliente.
 *   Le regole sono in ordine di certezza — prima quello che il browser
 *   DICHIARA (il limite dell'encoder), poi quello che si misura sui due
 *   percorsi, e solo alla fine il ponte, che è un sospetto.
 *  ⚠️ E QUANDO VA TUTTO BENE NON SI DICE NIENTE: una spia che accusa sempre
 *   qualcuno non la guarda più nessuno.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Quanta perdita è «niente»: sotto l'1% nessuno vede niente, e i pacchetti
 *  persi si rimandano. Sopra il 3% l'immagine comincia a impuntarsi davvero. */
export const PERSI_SOSPETTI = 0.03;
export const PERSI_TANTI = 0.08;
/** Oltre questo ritardo la voce comincia ad accavallarsi: si parla sopra. */
export const RTT_ALTO_MS = 300;
/** Sotto questa banda in salita non si manda un video decente comunque. */
export const BANDA_SCARSA_KBIT = 500;

export type Colpevole = "nessuno" | "tu" | "cliente" | "ponte" | "computer";

export interface MisureLinea {
  /** Banda in salita misurata sulla connessione, in kbit/s. 0 = non si sa. */
  kbit?: number;
  /** Andata e ritorno, in millisecondi. 0 = non si sa. */
  rttMs?: number;
  /** Frazione (0–1) di pacchetti persi su quello che MANDIAMO. */
  persiSu?: number;
  /** Frazione (0–1) di pacchetti persi su quello che RICEVIAMO. */
  persiGiu?: number;
  /** Cosa dichiara l'encoder: "cpu", "rete" o niente. */
  limite?: "cpu" | "rete" | "";
  /** Il video passa da un ponte (relay TURN) invece che punto a punto. */
  ponte?: boolean;
}

export interface DiagnosiLinea {
  chi: Colpevole;
  /** Due parole per la spia. */
  titolo: string;
  /** La riga che spiega, e che dice COSA FARE. */
  cosa: string;
  tono: "ok" | "attenzione" | "grave";
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function diagnosiLinea(m: MisureLinea): DiagnosiLinea {
  const kbit = num(m.kbit);
  const rtt = num(m.rttMs);
  const su = num(m.persiSu);
  const giu = num(m.persiGiu);
  const ponte = !!m.ponte;

  //  1. L'ENCODER LO DICHIARA. È l'unica informazione che non è dedotta: se il
  //     browser dice «sto comprimendo al limite della CPU», il collo di
  //     bottiglia è questo computer, e nessun intervento sulla rete lo toglie.
  if (m.limite === "cpu")
    return {
      chi: "computer",
      titolo: "Il tuo computer",
      cosa: "Il computer non riesce a comprimere il video abbastanza in fretta. Chiudi le altre schede pesanti, oppure abbassa la qualità della tua camera.",
      tono: "attenzione",
    };

  //  2. IL PERCORSO VERSO IL CLIENTE. La perdita che dichiara LUI su quello
  //     che gli mandiamo. Se insieme c'è poca banda in salita da qui, la causa
  //     sta da questa parte; altrimenti è la sua linea in discesa.
  if (su >= PERSI_TANTI || (su >= PERSI_SOSPETTI && m.limite === "rete")) {
    const miaBandaScarsa = kbit > 0 && kbit < BANDA_SCARSA_KBIT;
    return miaBandaScarsa || m.limite === "rete"
      ? {
          chi: "tu",
          titolo: "La tua connessione",
          cosa: `Quello che mandi non passa tutto (${percento(su)} perso) e la tua linea in salita è al limite${kbit > 0 ? ` (${kbit} kbit/s` + ")" : ""}. Spegni la tua camera: la voce resta pulita e i contenuti continuano ad arrivare.`,
          tono: su >= PERSI_TANTI ? "grave" : "attenzione",
        }
      : {
          chi: "cliente",
          titolo: "La connessione del cliente",
          cosa: `Il cliente perde ${percento(su)} di quello che gli mandi, mentre la tua linea regge. Digli di avvicinarsi al router o di passare al telefono con i dati.`,
          tono: su >= PERSI_TANTI ? "grave" : "attenzione",
        };
  }

  //  3. IL PERCORSO DAL CLIENTE. Quello che perdiamo noi ricevendo è quasi
  //     sempre la sua linea in SALITA, che sulle connessioni di casa è la metà
  //     debole.
  if (giu >= PERSI_SOSPETTI)
    return {
      chi: "cliente",
      titolo: "La connessione del cliente",
      cosa: `Arriva a pezzi quello che manda lui (${percento(giu)} perso): è la sua linea in salita. Se serve vederlo, digli di avvicinarsi al router; altrimenti si può continuare con la sua camera spenta.`,
      tono: giu >= PERSI_TANTI ? "grave" : "attenzione",
    };

  //  4. IL PONTE. Solo quando il ritardo è alto E il video passa da un relay:
  //     su un percorso diretto un ritardo alto è distanza o rete mobile, e
  //     dare la colpa al ponte sarebbe un'accusa senza prove.
  if (rtt >= RTT_ALTO_MS && ponte)
    return {
      chi: "ponte",
      titolo: "Il ponte (server)",
      cosa: `Il video non passa da punto a punto ma da un server di appoggio, e il giro è lungo (${Math.round(rtt)} ms). Non dipende né da te né dal cliente: se dà fastidio, riavviate la chiamata — spesso al secondo tentativo il collegamento diventa diretto.`,
      tono: "attenzione",
    };

  //  5. Ritardo alto senza ponte e senza perdite: la voce si accavalla ma
  //     l'immagine tiene. Si dice, senza accusare nessuno.
  if (rtt >= RTT_ALTO_MS)
    return {
      chi: "nessuno",
      titolo: "Ritardo alto",
      cosa: `Fra voi passano ${Math.round(rtt)} ms: non si perde niente, ma la voce può accavallarsi. Lasciate mezzo secondo di pausa prima di rispondervi.`,
      tono: "attenzione",
    };

  return {
    chi: "nessuno",
    titolo: "Linea a posto",
    cosa: "Nessuna perdita e ritardo normale: se qualcosa si impunta non è la connessione.",
    tono: "ok",
  };
}

/** La percentuale come si dice a voce: «3%», non «0.0312». */
export function percento(frazione: number): string {
  const p = num(frazione) * 100;
  return `${p >= 10 ? Math.round(p) : Math.round(p * 10) / 10}%`;
}
