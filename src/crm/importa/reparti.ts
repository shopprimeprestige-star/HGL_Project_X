/** ── TRE PORTE, NON OTTO ───────────────────────────────────────────────────
 *
 *  Segnalazione del committente: «riorganizza tutto da 0, ripensa tutto senza
 *  perdere progressi: ora è troppo caotico, difficile, e si perdono funzioni
 *  importanti».
 *
 *  ── COM'ERA ──────────────────────────────────────────────────────────────
 *  Otto linguette tutte sulla stessa riga, tutte allo stesso livello: Da
 *  chiamare, Oggi, Lead saltati, Di ritorno, Scritti su WhatsApp, Vedi dopo,
 *  Fissati da me, Da chiamare in lista. Ognuna è nata da una richiesta vera e
 *  nessuna è di troppo — ma messe in fila chiedono a chi lavora di scegliere
 *  fra OTTO cose ogni volta che alza gli occhi, e in mezzo a otto una si
 *  perde: è successo proprio con «Fissati da me», che per mesi mostrava un
 *  quinto di quello che il setter aveva fissato senza che nessuno se ne
 *  accorgesse.
 *
 *  ── COM'È ADESSO ─────────────────────────────────────────────────────────
 *  Le domande vere di chi apre questa pagina sono tre, e sono queste:
 *
 *    DA FARE ADESSO   la palla è mia e si muove col telefono in mano
 *                     (la coda, i richiami scaduti, i contatti di ritorno da
 *                      decidere, la lista intera)
 *    IN ATTESA        la palla non è mia: si guarda da quanto aspetta
 *                     (scritti su WhatsApp, vedi dopo, messi da parte)
 *    IL MIO LAVORO    quello che ho fissato io, com'è finito
 *
 *  Le otto viste non spariscono: diventano le stanze DENTRO le tre porte, e si
 *  vedono solo quando quella porta è aperta. La scelta, in ogni istante, è fra
 *  tre cose.
 *
 *  ⚠️ NIENTE VIENE CANCELLATO. Questo file sposta soltanto: ogni vista ha lo
 *   stesso nome, lo stesso contenuto e gli stessi gesti di prima. Era la
 *   condizione del committente — «senza perdere progressi» — ed è anche
 *   l'unico modo di rifare una navigazione senza rifare le regole, che stanno
 *   nei moduli provati qui accanto.
 *  ⚠️ UNA STANZA VUOTA NON SI MOSTRA, MA QUELLA APERTA SÌ: nascondere la vista
 *   in cui si sta guardando la farebbe sparire sotto le dita appena si svuota.
 *  ⚠️ DUE STANZE DELLA STESSA PORTA POSSONO CONTENERE LE STESSE PERSONE — i
 *   contatti di ritorno stanno anche in cima alla coda, i richiami scaduti pure
 *   — e allora il numero sulla PORTA non è la somma: sommarle direbbe che c'è
 *   il doppio del lavoro che c'è. Chi somma e chi no è dichiarato qui sotto,
 *   una volta sola.
 *  ───────────────────────────────────────────────────────────────────────── */

export type Vista =
  | "coda"
  | "oggi"
  | "ritorno"
  | "tutti"
  | "ripesca"
  | "doppioni"
  | "whatsapp"
  | "rimandati"
  | "saltati"
  | "miei";

export type Reparto = "adesso" | "attesa" | "mio";

export interface DescrizioneVista {
  vista: Vista;
  /** Il nome sulla linguetta. Gli stessi di prima: chi lavora qui li conosce. */
  nome: string;
  /** La spiegazione al passaggio del dito. */
  titolo: string;
  /** C'è sempre, anche a zero: è il lavoro di tutti i giorni, e una porta che
   *  sparisce quando è in pari non si ritrova più. */
  sempre?: boolean;
  /** Il suo numero NON si somma su quello della porta. Due motivi, tutti e
   *  due buoni:
   *   · le sue righe stanno già dentro un'altra stanza (i contatti di ritorno
   *     sono anche in cima alla coda): sommarle direbbe che c'è il doppio del
   *     lavoro che c'è;
   *   · è un magazzino, non una coda di oggi (Ripesca, Doppioni): ottocento
   *     schede ferme da mesi sul numero della porta farebbero sembrare
   *     impossibile una giornata in cui ci sono diciassette telefonate. */
  nonSomma?: boolean;
}

export interface DescrizioneReparto {
  reparto: Reparto;
  nome: string;
  titolo: string;
  viste: DescrizioneVista[];
}

export const REPARTI: DescrizioneReparto[] = [
  {
    reparto: "adesso",
    nome: "Da fare adesso",
    titolo: "La palla è tua: si lavora col telefono in mano",
    viste: [
      {
        vista: "coda",
        nome: "Coda",
        titolo: "Chi c'è da chiamare adesso, uno alla volta",
        sempre: true,
      },
      {
        vista: "oggi",
        nome: "Oggi",
        titolo: "I richiami che hai promesso e le note che ti sei scritto, in ordine di orologio",
        sempre: true,
        //  Un richiamo scaduto è già in coda: contarlo due volte raddoppierebbe
        //  il lavoro che si legge sulla porta.
        nonSomma: true,
      },
      {
        vista: "ritorno",
        nome: "Di ritorno",
        titolo:
          "Chi è già passato di qui e si rifà vivo: ricomparso in una lista, oppure ha detto che richiama lui",
        //  Stanno anche in cima alla coda, apposta: è la telefonata migliore
        //  della giornata.
        nonSomma: true,
      },
      {
        vista: "tutti",
        nome: "Tutta la lista",
        titolo:
          "Tutti i contatti arrivati da una lista che devono ancora essere telefonati: da qui si prendono a gruppi",
        nonSomma: true,
      },
      /*  ── ⚠️ IL MAGAZZINO, DIETRO LA STESSA PORTA ───────────────────────
          Misurato il 7/10/2026: 823 schede su 1.081 ferme in «annullato»,
          «non si è presentato» o «da ricontattare», e diciassette in coda. Il
          lavoro vero non era in coda: era in un magazzino che nessuna
          schermata apriva, e l'unico modo di riaprirlo era ricaricare un file
          che per caso contenesse quelle persone.
          Sta qui perché è lavoro che si fa col telefono in mano, come il
          resto di questa porta; non si somma perché non è lavoro di oggi. */
      {
        vista: "ripesca",
        nome: "Ripesca",
        titolo:
          "Le schede ferme da mesi che nessuno riapre più: si scelgono da quanto tacciono e si riscrive, con il messaggio giusto per com'era finita",
        sempre: true,
        nonSomma: true,
      },
      /*  Ventinove numeri con due schede a testa, la stessa persona con due
          storie. L'avviso del campo rosso ferma i doppioni NUOVI; quelli già
          dentro non li trovava e non li univa nessuno. */
      {
        vista: "doppioni",
        nome: "Doppioni",
        titolo:
          "Due schede con lo stesso numero: si guardano una accanto all'altra, si uniscono senza perdere niente, oppure si dichiara che sono due persone",
        nonSomma: true,
      },
    ],
  },
  {
    reparto: "attesa",
    nome: "In attesa",
    titolo: "La palla non è tua: qui si guarda da quanto aspettano",
    viste: [
      {
        vista: "whatsapp",
        nome: "Scritti su WhatsApp",
        titolo: "Gli hai scritto e aspetti la risposta: i più vecchi in cima",
      },
      {
        vista: "rimandati",
        nome: "Vedi dopo",
        titolo: "I contatti di ritorno su cui hai premuto «Vedi dopo»: qui si decide con calma",
      },
      {
        vista: "saltati",
        nome: "Messi da parte",
        titolo: "Chi è stato saltato: da qui si rimette in coda, anche a gruppi",
      },
    ],
  },
  {
    reparto: "mio",
    nome: "Il mio lavoro",
    titolo: "Le consulenze che hai fissato tu, com'è finita compresa",
    viste: [
      {
        vista: "miei",
        nome: "Fissati da me",
        titolo: "Le consulenze che hai preso tu: da qui si aprono e si correggono",
        sempre: true,
      },
    ],
  },
];

/** Quante righe ha ogni vista. Chi non c'è vale zero. */
export type Conti = Partial<Record<Vista, number>>;

const quante = (c: Conti, v: Vista): number => Math.max(0, Number(c?.[v] ?? 0) || 0);

/** In quale porta sta questa vista. */
export function repartoDi(vista: Vista): Reparto {
  return REPARTI.find((r) => r.viste.some((v) => v.vista === vista))?.reparto ?? "adesso";
}

/** Il numero da scrivere sulla porta: solo le stanze che non si ripetono. */
export function contoReparto(reparto: Reparto, conti: Conti): number {
  const r = REPARTI.find((x) => x.reparto === reparto);
  if (!r) return 0;
  return r.viste.filter((v) => !v.nonSomma).reduce((t, v) => t + quante(conti, v.vista), 0);
}

/** Le stanze da mostrare dentro la porta aperta: quelle che hanno qualcosa,
 *  quelle che ci sono sempre, e — qualunque cosa succeda — quella aperta. */
export function sottoViste(
  reparto: Reparto,
  conti: Conti,
  attiva?: Vista | null,
): DescrizioneVista[] {
  const r = REPARTI.find((x) => x.reparto === reparto);
  if (!r) return [];
  return r.viste.filter((v) => v.sempre || quante(conti, v.vista) > 0 || v.vista === attiva);
}

/** Una porta si mostra se ha qualcosa dentro, o se è quella aperta, o se una
 *  delle sue stanze c'è sempre. */
export function repartiDaMostrare(conti: Conti, attiva?: Vista | null): DescrizioneReparto[] {
  const aperta = attiva ? repartoDi(attiva) : null;
  return REPARTI.filter(
    (r) =>
      r.reparto === aperta ||
      r.viste.some((v) => v.sempre) ||
      r.viste.some((v) => quante(conti, v.vista) > 0),
  );
}

/** Premendo una porta, dove si entra: la prima stanza che ha qualcosa da fare;
 *  se sono tutte vuote, la prima che c'è sempre; se non ce n'è, la prima.
 *  ⚠️ Se la porta è già quella aperta non si sposta niente: premerla di nuovo
 *   non deve far saltare altrove chi sta leggendo. */
export function vistaDiIngresso(reparto: Reparto, conti: Conti, attiva?: Vista | null): Vista {
  const r = REPARTI.find((x) => x.reparto === reparto);
  if (!r || !r.viste.length) return "coda";
  if (attiva && repartoDi(attiva) === reparto) return attiva;
  const piena = r.viste.find((v) => quante(conti, v.vista) > 0);
  if (piena) return piena.vista;
  return (r.viste.find((v) => v.sempre) ?? r.viste[0]).vista;
}
