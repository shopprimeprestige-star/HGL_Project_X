/** ── IL CATALOGO DEI MESSAGGI AUTOMATICI ───────────────────────────────────
 *
 *  Commessa 2026-10-31-interruttori-automatici (richiesta del titolare: «tutti i
 *  messaggi che partono da soli, ognuno con un interruttore»). Questo file è
 *  l'ELENCO CHIUSO dei 25 messaggi WhatsApp che il CRM manda senza che nessuno
 *  prema un tasto. Ognuno ha una CHIAVE: è la stessa nel database
 *  (`messaggi_automatici.chiave`), nel controllo in porta (`messaggio:`), nel
 *  pannello e nelle prove. Una chiave che non è qui è spenta.
 *
 *  Puro: nessuna rete, nessun database, nessun orologio. I testi dei modelli non
 *  stanno qui (li dà `findMetaTemplate`), qui c'è solo il NOME del modello.
 *
 *  ⚠️ Le chiavi dei messaggi per stato sono `stato:<stato>` (come in
 *   `manychat_config.stati`). «Cliente assente» è UNA chiave sola per `no_show`
 *   e `non_fatto`; «Ricontatto fissato» è lo stato `da_ricontattare`.
 *  ⚠️ Cosa NON è qui, apposta: i messaggi scritti a mano (chat, invito al meet,
 *   ponte, prova modelli), `assenza_auto` e il giro «attesa → da chiamare» (spostano
 *   schede, non scrivono), il modello nuovo/vecchio di `modelli_utility_311026`
 *   (sceglie QUALE modello, non SE parte).
 *  ───────────────────────────────────────────────────────────────────────── */

import type { TipoInvio } from "../types";

/** Le 25 chiavi, nell'ordine in cui il piano le numera (e in cui le mostra il pannello dentro ogni momento). */
export const CHIAVI_MESSAGGI = [
  "primo_contatto",
  "richiamo_24h",
  "ritorno",
  "casi_reali",
  "ricontatto_fissato",
  "stato:sta_valutando",
  "stato:gestire_in_chat",
  "stato:fissa_meet_dopo",
  "stato:non_risponde",
  "stato:segreteria",
  "stato:irreperibile",
  "conferma_consulenza",
  "meet_domani",
  "meet_oggi",
  "promemoria_meet",
  "meet_adesso",
  "stato:richiamo",
  "stato:viene_in_sede",
  "stato:sede_disdetta",
  "prenota_chat",
  "stato:no_show",
  "stato:da_spostare",
  "stato:in_attesa_acconto",
  "dati_fattura",
  "webinar_in_diretta",
] as const;

export type ChiaveMessaggio = (typeof CHIAVI_MESSAGGI)[number];

/** Quello che passa dalla porta degli invii: un messaggio automatico del catalogo, oppure un invio a mano (mai bloccato). */
export type MessaggioDiInvio = ChiaveMessaggio | "manuale";

const INSIEME_CHIAVI: ReadonlySet<string> = new Set(CHIAVI_MESSAGGI);

/** Vero solo per le 25 chiavi (anche «manuale» è falso: non è un messaggio del catalogo). */
export const eChiaveMessaggio = (x: unknown): x is ChiaveMessaggio =>
  typeof x === "string" && INSIEME_CHIAVI.has(x);

/** I sei momenti del pannello, nell'ordine in cui si vedono. */
export const GRUPPI = [
  { id: "primo_contatto", titolo: "Primo contatto" },
  { id: "solleciti", titolo: "Solleciti" },
  { id: "consulenza", titolo: "Consulenza" },
  { id: "dopo_consulenza", titolo: "Dopo la consulenza" },
  { id: "acconto_fattura", titolo: "Acconto e fattura" },
  { id: "webinar", titolo: "Webinar" },
] as const;

export type GruppoMessaggio = (typeof GRUPPI)[number]["id"];

export interface VoceCatalogo {
  chiave: ChiaveMessaggio;
  gruppo: GruppoMessaggio;
  /** il nome per il titolare */
  nome: string;
  /** il modello Meta (o il testo del CRM con nome proprio) di cui si mostra l'anteprima */
  modello?: string;
  /** un secondo modello della stessa voce: lo mostra l'anteprima sotto il primo
   *  (il giorno prima a pagamento, la mattina col link, il primo contatto a tre fasce) */
  variante?: string;
  /** solo dove non c'è un modello: una frase che dice cosa va al cliente */
  testoFisso?: string;
  /** quando parte, in una riga */
  quando: string;
  /** la voce c'è ma NON si accende: la spegne una costante nel codice. Si toglie questo
   *  campo solo insieme alla costante (la prova `catalogo.mjs` le tiene d'accordo). */
  bloccataDalCodice?: true;
}

const A_DATA = "Il giorno della data di ricontatto, dalle 9 alle 20";

export const CATALOGO: readonly VoceCatalogo[] = [
  {
    chiave: "primo_contatto",
    gruppo: "primo_contatto",
    nome: "Primo contatto",
    modello: "hgl_primo_contatto",
    variante: "hgl_primo_contatto_tre_fasce",
    quando:
      "Subito all'ingresso del lead, dalle 9 alle 20 da lunedì a sabato; vale anche per gli importati",
  },
  {
    chiave: "richiamo_24h",
    gruppo: "solleciti",
    nome: "Sollecito dopo 24 ore",
    modello: "hgl_richiamo_24h",
    quando:
      "24 ore dopo il primo contatto, se il cliente non ha risposto; dalle 9 alle 20, entro 48 ore",
  },
  {
    chiave: "ritorno",
    gruppo: "primo_contatto",
    nome: "Ritorno del contatto",
    modello: "hgl_ritorno",
    quando: "Quando il lead ricompare da modulo, foglio o file",
  },
  {
    chiave: "casi_reali",
    gruppo: "primo_contatto",
    nome: "Casi reali (secondo messaggio)",
    modello: "hgl_casi_reali",
    quando: "Dopo che il primo contatto è arrivato, se il cliente non ha risposto",
  },
  {
    chiave: "ricontatto_fissato",
    gruppo: "solleciti",
    nome: "Ricontatto fissato",
    modello: "hgl_ricontatto_consulenza",
    quando: A_DATA + "; uno ogni 27-33 minuti",
  },
  {
    chiave: "stato:sta_valutando",
    gruppo: "solleciti",
    nome: "In valutazione",
    modello: "hgl_ricontatto_consulenza",
    quando: A_DATA,
  },
  {
    chiave: "stato:gestire_in_chat",
    gruppo: "solleciti",
    nome: "Lead in chat",
    modello: "hgl_ricontatto_consulenza",
    quando: A_DATA,
  },
  {
    chiave: "stato:fissa_meet_dopo",
    gruppo: "solleciti",
    nome: "Meet da fissare",
    modello: "hgl_meet_da_fissare",
    quando: A_DATA,
  },
  {
    chiave: "stato:non_risponde",
    gruppo: "solleciti",
    nome: "Non risponde",
    modello: "hgl_non_risponde",
    quando: "15 minuti dopo che lo stato è stato messo, entro 48 ore",
  },
  {
    chiave: "stato:segreteria",
    gruppo: "solleciti",
    nome: "Segreteria",
    modello: "hgl_non_risponde",
    quando: "15 minuti dopo che lo stato è stato messo, entro 48 ore",
  },
  {
    chiave: "stato:irreperibile",
    gruppo: "solleciti",
    nome: "Ultimo tentativo (Irreperibile)",
    modello: "hgl_ultimo_tentativo",
    quando: "1 ora dopo che lo stato è stato messo, una volta sola per numero",
  },
  {
    chiave: "conferma_consulenza",
    gruppo: "consulenza",
    nome: "Conferma della consulenza («risponda SÌ»)",
    modello: "consulenza_conferma_presenza",
    quando: "A chi ha appena prenotato; al massimo 3 per scheda",
  },
  {
    chiave: "meet_domani",
    gruppo: "consulenza",
    nome: "Promemoria il giorno prima",
    modello: "hgl_meet_domani_testo",
    variante: "hgl_meet_domani",
    quando:
      "Il giorno prima dalle 9, mai dopo le 20; gratis se la finestra di 24 ore è aperta, a pagamento solo se fissata da oltre 3 giorni",
  },
  {
    chiave: "meet_oggi",
    gruppo: "consulenza",
    nome: "Mattina del meet",
    modello: "hgl_meet_oggi",
    variante: "hgl_meet_oggi_link",
    quando: "Dalle 9 del giorno del meet (dalle 7:30 se il meet è prima delle 10)",
  },
  {
    chiave: "promemoria_meet",
    gruppo: "consulenza",
    nome: "Promemoria 20 minuti prima",
    modello: "hgl_promemoria_meet",
    quando: "20 minuti prima del meet",
  },
  {
    chiave: "meet_adesso",
    gruppo: "consulenza",
    nome: "Messaggio all'ora della consulenza (col link)",
    modello: "hgl_meet_adesso",
    quando:
      "Da 0 a 10 minuti dopo l'inizio. Spento nel codice dal 30/10/2026: non si accende da qui",
    bloccataDalCodice: true,
  },
  {
    chiave: "stato:richiamo",
    gruppo: "consulenza",
    nome: "Richiamo concordato",
    modello: "hgl_richiamo_concordato",
    quando: "Da 30 a 10 minuti prima della chiamata concordata",
  },
  {
    chiave: "stato:viene_in_sede",
    gruppo: "consulenza",
    nome: "Appuntamento in sede (il giorno prima)",
    modello: "hgl_promemoria_sede",
    quando: "Il giorno prima dell'appuntamento, dalle 9 alle 20; serve l'indirizzo della sede",
  },
  {
    chiave: "stato:sede_disdetta",
    gruppo: "consulenza",
    nome: "Appuntamento in sede disdetto",
    modello: "hgl_sede_disdetta",
    quando: "15 minuti dopo la disdetta",
  },
  {
    chiave: "prenota_chat",
    gruppo: "consulenza",
    nome: "Risposta con gli orari liberi (prenota in chat)",
    // shortcut: una frase che descrive, non il testo vero (cambia con gli orari liberi); mostrare un esempio vero quando ne serve uno.
    testoFisso:
      "La risposta in chat con gli orari liberi per la consulenza e la conferma di quello scelto.",
    quando: "Quando il cliente scrive in chat per prenotare",
  },
  {
    chiave: "stato:no_show",
    gruppo: "dopo_consulenza",
    nome: "Cliente assente",
    modello: "hgl_cliente_assente",
    quando: "30 minuti dopo che lo stato è stato messo (vale anche per «Non fatto»)",
  },
  {
    chiave: "stato:da_spostare",
    gruppo: "dopo_consulenza",
    nome: "Da riprogrammare",
    modello: "hgl_da_riprogrammare",
    quando: "Alla data fissata; senza data, 30 minuti dopo che lo stato è stato messo",
  },
  {
    chiave: "stato:in_attesa_acconto",
    gruppo: "acconto_fattura",
    nome: "Sollecito acconto",
    modello: "hgl_acconto",
    quando: A_DATA + ". Spento nel codice dal 30/10/2026: non si accende da qui",
    bloccataDalCodice: true,
  },
  {
    chiave: "dati_fattura",
    gruppo: "acconto_fattura",
    nome: "Richiesta dei dati per la fattura",
    modello: "hgl_dati_fattura",
    quando: "Una sola volta, a chi ha versato un acconto",
  },
  {
    chiave: "webinar_in_diretta",
    gruppo: "webinar",
    nome: "Webinar: «siamo in diretta»",
    // shortcut: il testo dipende dalla sala (modello Meta suo o testo del CRM); descritto, non copiato.
    testoFisso:
      "L'avviso agli iscritti, con il link della sala, nell'istante in cui il conduttore va in onda.",
    quando: "Nell'istante in cui il conduttore avvia la diretta; non si recupera dopo",
  },
];

/** I quattro messaggi che oggi dividono UN interruttore («Lead nuovo»). */
export const FAMIGLIA_LEAD_NUOVO = [
  "primo_contatto",
  "richiamo_24h",
  "ritorno",
  "casi_reali",
] as const;
/** I due che oggi dividono «Giorno del meet» (il messaggio all'ora ha la sua costante). */
export const FAMIGLIA_GIORNO_MEET = ["meet_oggi", "meet_domani"] as const;

/** Lo stato della scheda → la chiave, per i soli stati che hanno un messaggio. */
const CHIAVE_DELLO_STATO: Readonly<Record<string, ChiaveMessaggio>> = {
  da_ricontattare: "ricontatto_fissato",
  sta_valutando: "stato:sta_valutando",
  gestire_in_chat: "stato:gestire_in_chat",
  fissa_meet_dopo: "stato:fissa_meet_dopo",
  non_risponde: "stato:non_risponde",
  segreteria: "stato:segreteria",
  irreperibile: "stato:irreperibile",
  richiamo: "stato:richiamo",
  viene_in_sede: "stato:viene_in_sede",
  sede_disdetta: "stato:sede_disdetta",
  no_show: "stato:no_show",
  non_fatto: "stato:no_show",
  da_spostare: "stato:da_spostare",
  in_attesa_acconto: "stato:in_attesa_acconto",
};

/** Dal tipo dell'invio (e dallo stato della scheda) alla chiave del messaggio.
 *  `null` = nessuna chiave: tipo o stato che non hanno un messaggio nel catalogo, e
 *  «ricontatto» senza stato. Chi chiede NON deve mandare niente (chiave sconosciuta = spenta).
 *  «chat», «prova» e «webinar» danno `null` anche da soli: sono invii a mano, o (il
 *  webinar «in diretta», la richiesta dei dati della fattura) dichiarano la chiave a mano. */
export function chiaveDi(x: {
  tipo: TipoInvio | string;
  stato?: string | null;
}): ChiaveMessaggio | null {
  switch (x.tipo) {
    case "primo_contatto":
    case "richiamo_24h":
    case "ritorno":
    case "casi_reali":
    case "meet_oggi":
    case "meet_domani":
    case "meet_adesso":
      return x.tipo;
    case "promemoria":
      return "promemoria_meet";
    case "promemoria_chiamata":
      return "stato:richiamo";
    case "promemoria_sede":
      return "stato:viene_in_sede";
    case "conferma":
      return "conferma_consulenza";
    case "ricontatto":
      return (x.stato && CHIAVE_DELLO_STATO[x.stato]) || null;
    default:
      return null;
  }
}
