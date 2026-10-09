/** ── QUANDO LA CHAT SI PUÒ CHIUDERE, E QUANDO SI CHIUDE DA SOLA ────────────
 *
 *  ⚠️ UN TASTO CHE NON SERVE È PEGGIO DI UN TASTO CHE MANCA. In una sala con
 *   tre persone la chat NON è un ingombro: è la sala. Chiuderla vuol dire
 *   restare da soli davanti a un video, e chi lo fa per sbaglio non capisce
 *   dove sono finiti gli altri. Lì il tasto non c'è proprio — non disabilitato,
 *   non nascosto a metà: non c'è.
 *
 *  ⚠️ Le due soglie non sono la stessa cosa e non vanno confuse:
 *   · DA DIECI PERSONE compare il tasto. Sotto, la chat è una conversazione a
 *     cui stai partecipando; da lì in su comincia a essere un flusso che
 *     scorre, e uno può volerlo mettere via per un po'.
 *   · DA QUARANTA si chiude da sola la prima volta. A quel punto i messaggi
 *     arrivano più in fretta di quanto si legga, e chi entra vuole prima
 *     vedere cosa sta succedendo. Resta comunque a un tocco.
 *
 *  ⚠️ E LA SCELTA DI CHI GUARDA VINCE SEMPRE, appena la fa. Le regole qui
 *   sotto decidono solo il punto di partenza: una chat che si richiude da sola
 *   dopo che l'hai aperta è una chat rotta.
 */

/** Da qui in su compare il tasto per chiudere la chat. */
export const PERSONE_PER_IL_TASTO = 10;
/** Da qui in su la chat parte già chiusa. */
export const PERSONE_PER_CHIUDERLA = 40;

export interface StatoChat {
  /** la chat si vede? */
  aperta: boolean;
  /** c'è il tasto per aprirla e chiuderla? */
  tasto: boolean;
}

export function regolaChat(o: {
  /** quante persone ci sono in sala adesso */
  persone: number;
  /** chi conduce sta mostrando una slide, un preventivo, un media? */
  contenuti: boolean;
  /** cosa ha scelto chi guarda, se ha scelto (null = non ha ancora toccato) */
  scelta: boolean | null;
  /** siamo su uno schermo largo (computer), dove le due colonne ci stanno? */
  largo?: boolean;
}): StatoChat {
  const persone = Math.max(0, Math.floor(o.persone || 0));
  const scelto = o.scelta !== null && o.scelta !== undefined;

  //  ── ⚠️ SUL COMPUTER LA CHAT NON SI CHIUDE MAI ───────────────────────
  //   Le regole qui sotto sono nate per lo SPAZIO: su un telefono la chat e la
  //   cosa da guardare non ci stanno insieme, e una delle due deve cedere. Su
  //   un computer ci stanno tutte e due — la chat prende ventun rem e alla
  //   diretta resta tutto il resto — quindi non c'è niente da contendersi e
  //   niente da decidere. Chiuderla lì vuol dire togliere la sala dalla vista
  //   di chi conduce la conversazione, in cambio di spazio che non serviva.
  //  ⚠️ E il tasto sparisce con lei: un comando che non ha niente da fare va
  //   comunque letto e scartato ogni volta che l'occhio ci passa sopra.
  if (o.largo) return { aperta: true, tasto: false };

  //  ── ⚠️ UN CONTENUTO IN ONDA CAMBIA LE CARTE ─────────────────────────
  //   Quando chi conduce manda una slide, un preventivo o una foto, quella È
  //   la cosa da guardare: si prende tutto lo schermo e la chat si sposta via.
  //   Vale anche in una sala da tre persone — anzi soprattutto lì, perché su
  //   un telefono la chat si prende metà pagina e la slide diventa illeggibile.
  //  ⚠️ E QUI IL TASTO C'È SEMPRE, quale che sia il numero di persone: è
  //   l'unica regola che chiude la chat da sola, e chiuderla senza lasciare
  //   il modo di riaprirla vorrebbe dire toglierla per tutta la diretta.
  if (o.contenuti) return { aperta: scelto ? !!o.scelta : false, tasto: true };

  const tasto = persone >= PERSONE_PER_IL_TASTO;

  //  ⚠️ Senza contenuti e con poca gente la chat non è un ingombro: è la sala.
  //   Il tasto non c'è proprio — non disabilitato, non nascosto a metà.
  if (!tasto) return { aperta: true, tasto: false };

  if (scelto) return { aperta: !!o.scelta, tasto: true };

  return { aperta: persone < PERSONE_PER_CHIUDERLA, tasto: true };
}

/** ── COM'È VESTITO IL TASTO DELLA CHAT ─────────────────────────────────────
 *
 *  ⚠️ QUESTA SCELTA SI È RIBALTATA TRE VOLTE, quindi adesso sta in un posto
 *   solo ed è sotto prova. Non è una questione di gusto lasciata al disegno:
 *   è una decisione presa dal committente guardando entrambe le versioni a
 *   schermo, e il codice deve poterla dichiarare senza che qualcuno debba
 *   ricostruirla leggendo un ternario dentro una classe CSS lunga tre righe.
 *
 *   LA REGOLA: il verde sta sul tasto che APRE. Colore, icona e scritta dicono
 *   tutti e tre la stessa cosa — cosa succede se lo premi — perché un tasto
 *   non è una spia dello stato, è l'azione.
 *
 *     chat CHIUSA  → verde,  fumetto pieno,   «Apri chat»
 *     chat APERTA  → grigio, fumetto barrato, «Chiudi chat»
 *
 *  ⚠️ Se un giorno sembra al contrario, la risposta è che l'ha deciso lui.
 *   Non si inverte senza chiederlo: cambiare qui fa fallire le prove, ed è
 *   voluto.
 */
export interface VestitoTasto {
  /** verde = il tasto porta la chat; grigio = la manda via */
  colore: "verde" | "grigio";
  /** pieno = fumetto intero; barrato = fumetto con la riga sopra */
  icona: "pieno" | "barrato";
  scritta: string;
}

export function vestitoDelTasto(aperta: boolean): VestitoTasto {
  return aperta
    ? { colore: "grigio", icona: "barrato", scritta: "Chiudi chat" }
    : { colore: "verde", icona: "pieno", scritta: "Apri chat" };
}
