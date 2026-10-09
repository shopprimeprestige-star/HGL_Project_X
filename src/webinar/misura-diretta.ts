/** ── COM'È ANDATA UNA DIRETTA ──────────────────────────────────────────────
 *
 *  ⚠️ SENZA QUESTO NUMERO OGNI MIGLIORAMENTO È UN'OPINIONE. Si può cambiare il
 *   titolo, l'ora, la scaletta, l'offerta — e non sapere mai se è servito.
 *   Peggio: si finisce per credere alle impressioni, e l'impressione di chi
 *   conduce è sempre la stessa (è andata bene, si sentivano poco, la chat era
 *   viva) perché chi conduce guarda la sala, non chi se ne va.
 *
 *  ⚠️ LA CURVA DI ABBANDONO È LA COSA CHE VALE. Il totale degli entrati dice
 *   se la promozione ha funzionato; la permanenza media dice se la diretta
 *   regge. Ma solo la curva dice DOVE si rompe: il minuto in cui se ne vanno
 *   in venti è il minuto in cui hai detto qualcosa che non teneva, ed è
 *   l'unica informazione che si traduce in una cosa da fare.
 *
 *  ⚠️ SI CALCOLA DA DUE SOLI ISTANTI PER PERSONA — quando è entrata e quando
 *   l'abbiamo vista l'ultima volta. Non serve registrare niente minuto per
 *   minuto: per sapere quante persone c'erano al minuto N basta contare quelle
 *   entrate prima e uscite dopo. Una tabella di presenze al minuto sarebbe
 *   cinquecento righe al minuto per niente.
 */

export interface Presenza {
  /** quando è entrata, in millisecondi */
  entrata: number;
  /** l'ultima volta che l'abbiamo vista, in millisecondi */
  uscita: number;
}

export interface PuntoCurva {
  /** minuto dall'inizio della diretta */
  minuto: number;
  /** quante persone c'erano in quel momento */
  presenti: number;
}

export interface MisuraDiretta {
  /** quante persone diverse sono entrate */
  entrati: number;
  /** il massimo di persone contemporaneamente in sala */
  picco: number;
  /** a che minuto è arrivato il picco */
  minutoDelPicco: number;
  /** quanto è rimasta in media una persona, in minuti */
  permanenzaMedia: number;
  /** la permanenza di chi sta nel mezzo: regge meglio agli estremi della media */
  permanenzaMediana: number;
  /** quante persone hanno fatto il gesto finale */
  conversioni: number;
  /** conversioni su entrati, da 0 a 100 */
  tassoConversione: number;
  /** quanti c'erano, minuto per minuto */
  curva: PuntoCurva[];
  /** il minuto in cui se n'è andata più gente, e quanta */
  peggiorMinuto: { minuto: number; persi: number } | null;
}

const MINUTO = 60_000;

/** ⚠️ La mediana e non solo la media: in una sala da cinquanta persone bastano
 *  tre che restano un'ora perché la media dica venti minuti mentre la metà se
 *  n'è andata in cinque. La media dice quanto tempo hai «venduto», la mediana
 *  quanto è durata l'esperienza tipica. Servono tutte e due. */
function mediana(valori: number[]): number {
  if (!valori.length) return 0;
  const o = [...valori].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export function misuraDiretta(o: {
  presenze: readonly Presenza[];
  /** quando è cominciata la diretta, in millisecondi */
  inizio: number;
  /** quando è finita; se manca si prende l'ultima uscita */
  fine?: number;
  /** quante persone hanno fatto il gesto finale */
  conversioni?: number;
}): MisuraDiretta {
  //  ⚠️ Si buttano le righe storte invece di lasciarle sporcare tutto: una
  //   presenza che finisce prima di cominciare è un orologio sbagliato, e
  //   contarla darebbe permanenze negative dentro una media.
  const buone = (o.presenze ?? []).filter(
    (p) => Number.isFinite(p.entrata) && Number.isFinite(p.uscita) && p.uscita >= p.entrata,
  );
  const vuota: MisuraDiretta = {
    entrati: 0, picco: 0, minutoDelPicco: 0, permanenzaMedia: 0, permanenzaMediana: 0,
    conversioni: 0, tassoConversione: 0, curva: [], peggiorMinuto: null,
  };
  if (!buone.length || !Number.isFinite(o.inizio)) return vuota;

  const fine = Number.isFinite(o.fine as number)
    ? (o.fine as number)
    : Math.max(...buone.map((p) => p.uscita));
  //  ⚠️ Almeno un minuto: una diretta durata quaranta secondi non deve dare una
  //   curva vuota, che si legge come «non è entrato nessuno».
  const durata = Math.max(1, Math.ceil((fine - o.inizio) / MINUTO));

  const curva: PuntoCurva[] = [];
  for (let m = 0; m <= durata; m++) {
    const istante = o.inizio + m * MINUTO;
    //  Chi era già entrato e non era ancora uscito.
    const presenti = buone.filter((p) => p.entrata <= istante && p.uscita >= istante).length;
    curva.push({ minuto: m, presenti });
  }

  let picco = 0;
  let minutoDelPicco = 0;
  for (const p of curva) if (p.presenti > picco) { picco = p.presenti; minutoDelPicco = p.minuto; }

  //  ⚠️ Il peggior minuto si cerca DOPO il picco: prima del picco la gente
  //   sta ancora arrivando, e un calo lì dentro è un'onda di arrivi, non un
  //   abbandono. Cercarlo su tutta la curva farebbe puntare il dito sul minuto
  //   uno praticamente sempre.
  let peggiorMinuto: MisuraDiretta["peggiorMinuto"] = null;
  for (let i = minutoDelPicco + 1; i < curva.length; i++) {
    const persi = curva[i - 1].presenti - curva[i].presenti;
    if (persi > 0 && (!peggiorMinuto || persi > peggiorMinuto.persi)) {
      peggiorMinuto = { minuto: curva[i].minuto, persi };
    }
  }

  const permanenze = buone.map((p) => (p.uscita - p.entrata) / MINUTO);
  const conversioni = Math.max(0, Math.floor(o.conversioni || 0));

  return {
    entrati: buone.length,
    picco,
    minutoDelPicco,
    permanenzaMedia: Math.round((permanenze.reduce((a, b) => a + b, 0) / permanenze.length) * 10) / 10,
    permanenzaMediana: Math.round(mediana(permanenze) * 10) / 10,
    conversioni,
    //  ⚠️ Mai sopra cento: contare due volte la stessa persona darebbe un
    //   numero impossibile, e un numero impossibile toglie fiducia a tutti gli
    //   altri della schermata.
    tassoConversione: Math.min(100, Math.round((conversioni / buone.length) * 1000) / 10),
    curva,
    peggiorMinuto,
  };
}
