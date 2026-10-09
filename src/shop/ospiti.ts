/** ── PIÙ DI UN OSPITE NELLA STESSA CONSULENZA ──────────────────────────────
 *
 *  Richiesta del committente: «fai che possono entrare anche 3 ospiti o più
 *  nella consulenza, se già non c'è questa opzione».
 *
 *  ⚠️ ENTRARE SI POTEVA GIÀ, e non è una risposta completa. Il collegamento è
 *   a maglia — una connessione per ciascuno — la sala d'attesa tiene una LISTA
 *   di chi bussa, e la griglia delle camere si ridispone da sola fino a nove
 *   riquadri. Quello che NON funzionava è ciò che si vede quando gli ospiti
 *   sono più di uno, e sono due cose precise:
 *
 *   1. LA FORMA DELLO SCHERMO DEL CLIENTE. Il presentatore ha un'anteprima
 *      «come lo vede lui», e la misura arrivava da OGNI ospite: uno al
 *      telefono in verticale e uno al computer se la riscrivevano a vicenda
 *      ogni pochi secondi, e l'anteprima cambiava forma da sola mentre si
 *      parlava. Serve UN ospite di riferimento, e dichiarato.
 *   2. «LA CAMERA DEL CLIENTE». Con un ospite solo non c'è dubbio; con tre, il
 *      programma prendeva il PRIMO che trovava nell'elenco — che è l'ordine in
 *      cui sono arrivati, cioè un dettaglio invisibile a chi guarda. Ora è lo
 *      stesso ospite di riferimento, ed è quello che il presentatore può
 *      scegliere fissandolo (la puntina).
 *
 *  ⚠️ E LA LINEA NON SI MOLTIPLICA. Ogni ospite in più è una copia in più del
 *   video che parte da qui: in tre si manda tre volte. Il tetto si spartisce
 *   già da sé (vedi `shop/banda`), ma il presentatore deve SAPERLO prima di
 *   ritrovarsi a chiedersi perché si vede peggio che ieri — e la risposta non
 *   può essere «la linea», che è la non-risposta di sempre.
 *
 *  Sta fuori da `call.tsx` perché sono decisioni, non disegno: si provano.
 *  ───────────────────────────────────────────────────────────────────────── */

export interface VoceRoster {
  pid: string;
  name?: string;
  role?: "host" | "viewer" | string | null;
  camOn?: boolean;
}

/** Gli ospiti, nell'ordine in cui sono arrivati (l'elenco li accoda). */
export function ospitiDi(roster?: VoceRoster[] | null): VoceRoster[] {
  return (Array.isArray(roster) ? roster : []).filter(
    (r) => !!r && !!r.pid && r.role === "viewer",
  );
}

/** ── L'OSPITE DI RIFERIMENTO ───────────────────────────────────────────────
 *  Quello a cui si riferiscono le cose che possono valere per UNO solo: la
 *  forma dello schermo per l'anteprima, e «la camera del cliente» nella
 *  camerina che il presentatore si guarda.
 *
 *  L'ordine è: chi il presentatore ha messo a tutto schermo («Solo lui», cioè
 *  `focusPid`: è una scelta esplicita e va rispettata), altrimenti il PRIMO
 *  ARRIVATO — che è anche quello che si comportava già così, e quindi con un
 *  ospite solo non cambia niente per nessuno.
 *  ⚠️ Non «chi parla»: cambierebbe a ogni frase, e una forma di schermo che
 *   cambia a ogni frase è esattamente il difetto che si sta togliendo.
 *  ⚠️ Un pid focalizzato che non è (più) un ospite collegato si ignora: il
 *   focus resta appeso a chi è uscito, e senza questo controllo l'anteprima
 *   seguirebbe un fantasma.
 *  ⚠️ E LA REGOLA È UNA SOLA, per tutti quelli che la usano: se la forma dello
 *   schermo seguisse un ospite e «la camera del cliente» un altro, si
 *   guarderebbe una persona dentro la cornice di un'altra. */
export function ospiteDiRiferimento(
  roster?: VoceRoster[] | null,
  opz?: { focusPid?: string | null },
): VoceRoster | null {
  const ospiti = ospitiDi(roster);
  if (!ospiti.length) return null;
  const f = opz?.focusPid ? ospiti.find((o) => o.pid === opz!.focusPid) : undefined;
  return f || ospiti[0];
}

/** Comodo per i confronti: solo il pid, o stringa vuota. */
export function pidDiRiferimento(
  roster?: VoceRoster[] | null,
  opz?: { focusPid?: string | null },
): string {
  return ospiteDiRiferimento(roster, opz)?.pid || "";
}

/** Com'è messa la camera degli ospiti: serve all'interruttore unico («spegni
 *  le camere di tutti»), che deve sapere se accendere o spegnere. */
export function statoCamereOspiti(roster?: VoceRoster[] | null): {
  quanti: number; accese: number; spente: number;
  tutteAccese: boolean; tutteSpente: boolean;
  /** Cosa fa il pulsante unico: `false` = spegni tutte, `true` = accendi tutte. */
  prossimaAzione: boolean;
} {
  const ospiti = ospitiDi(roster);
  //  ⚠️ `camOn` assente vale ACCESA: è il valore con cui entra chi non ha
  //   ancora mandato il suo primo annuncio, e trattarlo come spento farebbe
  //   comparire «accendi le camere» mentre le camere sono accese.
  const accese = ospiti.filter((o) => o.camOn !== false).length;
  const quanti = ospiti.length;
  const spente = quanti - accese;
  return {
    quanti, accese, spente,
    tutteAccese: quanti > 0 && spente === 0,
    tutteSpente: quanti > 0 && accese === 0,
    //  Finché ne resta una accesa il pulsante spegne: è la richiesta («voglio
    //  lo schermo pulito»), e mezza misura non la soddisfa.
    prossimaAzione: quanti > 0 && accese === 0,
  };
}

/** Sotto questa banda a testa non ci sta una camera in «Alta» (vedi
 *  `listinoVideo` in shop/banda: 1,6 Mbit pieni, 1 Mbit scarso per un viso). */
export const BANDA_PER_OSPITE_KBIT = 1000;

/** ── COSA DIRE QUANDO SONO IN TANTI ───────────────────────────────────────
 *  Non è un allarme: è il conto che il presentatore non può fare a mente
 *  mentre parla. Con la linea misurata lo si fa con i numeri veri; senza, si
 *  dice solo la regola — e non si spaventa nessuno con cifre inventate. */
export function consiglioPerTantiOspiti(
  quantiOspiti: number,
  kbitMisurati = 0,
): { testo: string; grave: boolean } | null {
  const n = Math.max(0, Math.round(Number(quantiOspiti) || 0));
  if (n < 2) return null;
  const kbit = Math.max(0, Math.round(Number(kbitMisurati) || 0));
  if (kbit <= 0) {
    return {
      testo: `${n} ospiti: la tua camera parte ${n} volte, una per ciascuno. Se qualcuno ti vede a scatti, abbassa la tua qualità o spegni le camere di chi non serve.`,
      grave: false,
    };
  }
  //  La stessa spartizione che applica il tetto di invio: la linea è una.
  const aTesta = Math.round((kbit * 0.85) / n);
  if (aTesta < BANDA_PER_OSPITE_KBIT)
    return {
      testo: `${n} ospiti su una linea da ${kbit} kbit: restano circa ${aTesta} kbit a testa, meno di quanto serve per l'alta qualità. Metti la qualità su Media, o spegni le camere di chi non deve essere visto.`,
      grave: true,
    };
  return {
    testo: `${n} ospiti: circa ${aTesta} kbit a testa, la tua linea li regge.`,
    grave: false,
  };
}

/** ── ACCENDERE LA CAMERA DELL'OSPITE: PERCHÉ NON BASTA CHIEDERLO ───────────
 *
 *  Segnalazione del committente: «fai che posso attivare e disattivare la
 *  camera degli ospiti».
 *
 *  ⚠️ SPEGNERLA RIESCE SEMPRE, RIACCENDERLA NO. Spegnere è una cosa che si fa
 *   sul dispositivo dell'ospite senza chiedere niente a nessuno. Riaccendere
 *   vuol dire riaprire la camera, cioè `getUserMedia` — e quella il browser la
 *   concede a certe condizioni: il permesso deve esserci ancora, la camera non
 *   deve essere occupata da un'altra applicazione, e su iPhone spesso serve un
 *   TOCCO della persona. Un comando che arriva dal canale non è un tocco.
 *   Quando il browser rifiuta, l'apertura fallisce e — prima di questa
 *   correzione — nessuno lo sapeva: il presentatore premeva «accendi», non
 *   succedeva niente, e la conclusione era «questo comando non funziona».
 *
 *  Da qui nascono le due cose che servono: l'ospite deve VEDERE la richiesta
 *  (così può accendere lui con un tocco, che al browser basta) e il
 *  presentatore deve SAPERE che non è riuscita (così non ripreme a vuoto).
 *  Questa funzione decide solo QUALE delle due cose dire all'ospite. */
/*  ── ⚠️ E IL MICROFONO FA PARTE DELLA RICHIESTA ────────────────────────────
    Richiesta del committente: «quando mi arriva il messaggio che la camera
    dell'utente è spenta, che ci sia un pulsante sopra la sua schermata per
    inviare di nuovo la richiesta di accedere a camera e microfono, e
    all'utente arriva di nuovo la notifica dove può autorizzare».
    Prima di qui passava solo la camera, e il microfono non aveva nessun modo
    di essere richiesto: era l'altra metà della stessa telefonata («non ti
    sento»), e si risolveva a voce. Adesso una richiesta può riguardare l'una,
    l'altro, o tutti e due — e sono tre frasi diverse, perché «accendi la
    camera» detto a chi ha solo il microfono chiuso non si capisce. */
export type AvvisoCamera =
  | "niente"
  | "spenta-dal-consulente"
  | "chiesta-dal-consulente"
  | "chiesto-microfono"
  | "chiesti-camera-e-microfono";

export function avvisoCameraOspite(s: {
  camOn?: boolean;
  /** Il microfono è aperto adesso. */
  micOn?: boolean;
  /** Il consulente l'ha spenta lui. */
  spentaDalConsulente?: boolean;
  /** Il consulente ha chiesto di accenderla e non è (ancora) riuscita. */
  chiestaDalConsulente?: boolean;
  /** Lo stesso, per il microfono. */
  micChiestoDalConsulente?: boolean;
  /** Fuori dalla consulenza non si dice niente a nessuno. */
  joined?: boolean;
}): AvvisoCamera {
  if (!s.joined) return "niente";
  //  ⚠️ Quello che è GIÀ aperto non si chiede: una richiesta che resta appesa
  //   dopo che il problema è passato è il modo più rapido di insegnare a
  //   ignorare gli avvisi.
  const mancaCamera = !s.camOn && !!s.chiestaDalConsulente;
  const mancaMicrofono = !s.micOn && !!s.micChiestoDalConsulente;
  if (mancaCamera && mancaMicrofono) return "chiesti-camera-e-microfono";
  if (mancaCamera) return "chiesta-dal-consulente";
  //  ⚠️ Il microfono si chiede ANCHE a camera accesa: sono due permessi
  //   separati, e «non ti sento» capita con la faccia perfettamente visibile.
  if (mancaMicrofono) return "chiesto-microfono";
  if (s.camOn) return "niente";
  //  La richiesta di ACCENDERE è più recente dello spegnimento che l'ha
  //  preceduta (si spegne, poi si riaccende), e chiede un'azione: viene prima.
  if (s.spentaDalConsulente) return "spenta-dal-consulente";
  return "niente";
}
