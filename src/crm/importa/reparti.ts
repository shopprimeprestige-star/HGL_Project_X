/** ── TRE LINGUETTE E UN MENU «ALTRO» ───────────────────────────────────────
 *
 *  Richiesta del titolare (12/10): la setter apre «Lead importati» per una cosa
 *  sola, sapere chi chiamare adesso. Con tre porte e dieci sotto-schede doveva
 *  scegliere fra venti cose prima della prima telefonata.
 *
 *  ── COM'ERA ──────────────────────────────────────────────────────────────
 *  Tre porte (Da fare adesso, In attesa, Il mio lavoro) con le stanze dentro:
 *  la prima ne aveva sei (Coda, Oggi, Di ritorno, Tutta la lista, Ripesca,
 *  Doppioni). La stessa persona stava in due stanze — un ritorno era in cima
 *  alla Coda e anche in «Di ritorno» — e il numero sulla porta non era la somma.
 *
 *  ── COM'È ADESSO ─────────────────────────────────────────────────────────
 *    DA CHIAMARE    una lista sola, in ordine di «chi chiamare adesso», con la
 *                   targhetta del perché (crm/importa/chi-chiamare). Anche chi è
 *                   di ritorno e chi ha una promessa sono lì: si trovano con il
 *                   filtro Stato.
 *    IN ATTESA      la palla non è mia: WhatsApp, Vedi dopo, Messi da parte
 *    FISSATI DA ME  quello che ho fissato io, com'è finito
 *    ALTRO          il menu per le cose che si usano ogni tanto: Tutta la lista
 *                   (azioni a gruppi), Ripesca, Doppioni, Note e promemoria,
 *                   Elenco completo (un'altra pagina)
 *
 *  ⚠️ NIENTE VIENE CANCELLATO. Il tipo `Vista` ha ancora i dieci nomi di prima
 *   e ogni vista ha lo stesso contenuto e gli stessi gesti: si è spostato solo
 *   il modo di arrivarci (`percorsoVista` lo scrive a parole, e la prova
 *   controlla che nessuna sia rimasta senza strada). «Di ritorno» non ha più
 *   una stanza sua: è la voce «Di ritorno» del filtro Stato.
 *  ⚠️ UNA STANZA VUOTA NON SI MOSTRA, MA QUELLA APERTA SÌ: nascondere la vista
 *   in cui si sta guardando la farebbe sparire sotto le dita appena si svuota.
 *  ⚠️ IL NUMERO SU «DA CHIAMARE» È LA LISTA E BASTA. Le note scadute, i ritorni
 *   e le promesse stanno già dentro la lista o dentro Altro: sommarli direbbe
 *   che c'è il doppio del lavoro che c'è.
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

export type Linguetta = "dachiamare" | "attesa" | "miei";

export interface DescrizioneVista {
  vista: Vista;
  /** Il nome sulla linguetta. Gli stessi di prima: chi lavora qui li conosce. */
  nome: string;
  /** La spiegazione al passaggio del dito. */
  titolo: string;
}

export interface DescrizioneLinguetta {
  linguetta: Linguetta;
  nome: string;
  titolo: string;
  /** Le stanze che si aprono da questa linguetta. */
  viste: DescrizioneVista[];
  /** C'è sempre, anche a zero: è il lavoro di tutti i giorni, e una linguetta
   *  che sparisce quando è in pari non si ritrova più. */
  sempre?: boolean;
}

export const LINGUETTE: DescrizioneLinguetta[] = [
  {
    linguetta: "dachiamare",
    nome: "Da chiamare",
    titolo: "Chi chiamare adesso, in ordine, con il motivo scritto su ogni riga",
    sempre: true,
    viste: [
      {
        vista: "coda",
        nome: "Da chiamare",
        titolo: "Una lista sola: promesse, contatti di ritorno, nuovi, prime chiamate e ritenti",
      },
    ],
  },
  {
    linguetta: "attesa",
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
    linguetta: "miei",
    nome: "Fissati da me",
    titolo: "Le consulenze che hai fissato tu, com'è finita compresa",
    sempre: true,
    viste: [
      {
        vista: "miei",
        nome: "Fissati da me",
        titolo: "Le consulenze che hai preso tu: da qui si aprono e si correggono",
      },
    ],
  },
];

/** Una voce del menu «Altro»: una vista della pagina, oppure un'altra pagina
 *  (`href`). Sono le cinque cose che non si usano a ogni telefonata. */
export interface VoceAltro {
  vista?: Vista;
  href?: string;
  nome: string;
  titolo: string;
}

export const ALTRO: VoceAltro[] = [
  {
    vista: "tutti",
    nome: "Tutta la lista",
    titolo:
      "Tutti i contatti arrivati da una lista che devono ancora essere telefonati: da qui si prendono a gruppi",
  },
  {
    vista: "ripesca",
    nome: "Ripesca",
    titolo:
      "Le schede ferme da mesi che nessuno riapre più: si scelgono da quanto tacciono e si riscrive, con il messaggio giusto per com'era finita",
  },
  {
    vista: "doppioni",
    nome: "Doppioni",
    titolo:
      "Due schede con lo stesso numero: si guardano una accanto all'altra, si uniscono senza perdere niente, oppure si dichiara che sono due persone",
  },
  {
    //  La vista si chiama ancora `oggi` (e la prova la cerca con quel nome), ma la
    //  setter la conosce per quello che contiene.
    vista: "oggi",
    nome: "Note e promemoria",
    titolo:
      "Le note che ti sei scritto e i richiami, in ordine di orologio: si scrive anche una nota nuova",
  },
  {
    href: "/CRM/avanzamento",
    nome: "Elenco completo",
    titolo:
      "La stessa roba in tabella: filtri per stato e consulente, azioni su venti righe insieme, esportazione in CSV",
  },
];

/** ── LA VOCE «DI RITORNO» DEL FILTRO STATO, ACCESA O SPENTA ────────────────
 *  Una voce a zero si spegne (se sparisse, la fila si accorcerebbe sotto il
 *  dito) e quella scelta non si spegne mai. Ma «Di ritorno» ha un conto in più:
 *  la vecchia stanza mostrava anche chi NON è in lista — i «mi richiama lui»
 *  arrivati dal sito, quelli con un giorno futuro, i ritorni con una promessa
 *  per dopo — e quelle persone si trovano solo da lì. Finché ce n'è anche una,
 *  la voce resta accesa anche se nella lista non c'è nessuna riga di ritorno.
 *  `nInLista` = righe della lista con quello Stato; `ritorni` = tutti i contatti
 *  di ritorno e «si fanno vivi loro» (`Conti.ritorno`). */
export function voceStatoAttiva(
  valore: string,
  nInLista: number,
  scelto: string,
  ritorni: number,
): boolean {
  if (valore === scelto) return true;
  if (nInLista > 0) return true;
  return valore === "ritorno" && ritorni > 0;
}

/** La riga della fascia che richiama i contatti di ritorno: «N contatti di
 *  ritorno da decidere, più M che si fanno vivi loro». Vuota = niente fascia. */
export function fasciaDeiRitorni(daDecidere: number, siFannoVivi: number): string {
  const n = Math.max(0, Math.floor(daDecidere) || 0);
  const m = Math.max(0, Math.floor(siFannoVivi) || 0);
  if (n === 0 && m === 0) return "";
  if (n === 0) return m === 1 ? "1 si fa vivo lui" : `${m} si fanno vivi loro`;
  const prima =
    n === 1 ? "1 contatto di ritorno da decidere" : `${n} contatti di ritorno da decidere`;
  return m === 0 ? prima : `${prima}, più ${m} che si fanno vivi loro`;
}

/** Quante righe ha ogni vista. Chi non c'è vale zero. */
export type Conti = Partial<Record<Vista, number>>;

const quante = (c: Conti, v: Vista): number => Math.max(0, Number(c?.[v] ?? 0) || 0);

const NOME_ALTRO = (v: Vista): string => ALTRO.find((x) => x.vista === v)?.nome ?? v;

const STANZA = (v: Vista): { linguetta: DescrizioneLinguetta; vista: DescrizioneVista } | null => {
  for (const linguetta of LINGUETTE) {
    const vista = linguetta.viste.find((x) => x.vista === v);
    if (vista) return { linguetta, vista };
  }
  return null;
};

/** Da quale linguetta si arriva a questa vista; «altro» se sta nel menu.
 *  «Di ritorno» non ha più una stanza: è il filtro Stato della lista. */
export function linguettaDi(vista: Vista): Linguetta | "altro" {
  if (vista === "ritorno") return "dachiamare";
  const s = STANZA(vista);
  if (s) return s.linguetta.linguetta;
  return "altro";
}

/** La strada a parole, uno o due passi: serve alla prova (nessuna vista senza
 *  strada) e alla riga che dice dove si è quando si è dentro «Altro». */
export function percorsoVista(vista: Vista): string[] {
  if (vista === "ritorno") return ["Da chiamare", "Stato: Di ritorno"];
  const l = linguettaDi(vista);
  if (l === "altro") return ["Altro", NOME_ALTRO(vista)];
  const linguetta = LINGUETTE.find((x) => x.linguetta === l)!;
  //  Le linguette con una stanza sola non ripetono il nome.
  if (linguetta.viste.length === 1) return [linguetta.nome];
  return [linguetta.nome, STANZA(vista)?.vista.nome ?? vista];
}

/** Il numero da scrivere sulla linguetta. */
export function contoLinguetta(linguetta: Linguetta, conti: Conti): number {
  const l = LINGUETTE.find((x) => x.linguetta === linguetta);
  if (!l) return 0;
  if (linguetta === "dachiamare") return quante(conti, "coda");
  return l.viste.reduce((t, v) => t + quante(conti, v.vista), 0);
}

/** Le stanze da mostrare dentro la linguetta aperta: quelle che hanno qualcosa
 *  e — qualunque cosa succeda — quella aperta. */
export function stanzeDi(
  linguetta: Linguetta,
  conti: Conti,
  attiva?: Vista | null,
): DescrizioneVista[] {
  const l = LINGUETTE.find((x) => x.linguetta === linguetta);
  if (!l) return [];
  return l.viste.filter((v) => quante(conti, v.vista) > 0 || v.vista === attiva);
}

/** Una linguetta si mostra se è di tutti i giorni, se ha qualcosa dentro o se è
 *  quella in cui si sta guardando. */
export function linguetteDaMostrare(conti: Conti, attiva?: Vista | null): DescrizioneLinguetta[] {
  const aperta = attiva ? linguettaDi(attiva) : null;
  return LINGUETTE.filter(
    (l) => l.sempre || l.linguetta === aperta || l.viste.some((v) => quante(conti, v.vista) > 0),
  );
}

/** Premendo una linguetta, dove si entra: la prima stanza che ha qualcosa da
 *  fare, altrimenti la prima. ⚠️ Se la linguetta è già quella aperta non si
 *  sposta niente: premerla di nuovo non deve far saltare altrove chi sta
 *  leggendo. */
export function vistaDiIngresso(linguetta: Linguetta, conti: Conti, attiva?: Vista | null): Vista {
  const l = LINGUETTE.find((x) => x.linguetta === linguetta);
  if (!l || !l.viste.length) return "coda";
  if (attiva && linguettaDi(attiva) === linguetta) return attiva;
  const piena = l.viste.find((v) => quante(conti, v.vista) > 0);
  return (piena ?? l.viste[0]).vista;
}
