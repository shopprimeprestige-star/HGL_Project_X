/** ── I FILTRI DELLA CHAT, A GRUPPI (30/10/2026) ─────────────────────────────
 *
 *  Richiesta del titolare: «i filtri sono caotici, "chiuso" e "aperto" non si
 *  capisce cosa significano». Sei gruppi, ognuno risponde a una domanda di lavoro.
 *
 *  ── ESCLUSIVI (31/10/2026) ──────────────────────────────────────────────
 *  Richiesta del titolare: «non si possono selezionare più filtri insieme». Se ne accende UNO
 *  solo: toccarne un altro spegne il primo e accende quello toccato; toccare quello acceso lo
 *  spegne (torna «Tutte»). Vale per pastiglie e pannello. Il **consulente** e la **ricerca**
 *  non sono filtri da azzerare: restano com'erano e si sommano alla voce scelta.
 *  Il motore (`passaFiltri`) sa ancora comporre i gruppi in E: serve per consulente + voce; ciò
 *  che cambia è COME SI SCELGONO (`commuta`), COSA SI CONTA (`contaVoce`) e COSA SI RILEGGE dal
 *  dispositivo (`soloUno`).
 *
 *   1. Cosa fare adesso   coda (Da rispondere · Da chiamare) + stelle (acceso/spento)
 *   2. Fase del lead      Attesa WhatsApp · Per ora no · un altro stato: una sola
 *   3. Finestra WhatsApp  Si può scrivere · Finestra chiusa: una sola
 *   4. Pagamento          Acconto versato (acceso/spento)
 *   5. Tipo di contatto   Con scheda · Senza scheda · Clienti: una sola
 *   6. Consulente         uno solo
 *
 *  ⚠️ `passaFiltro` (cercaChat.ts) NON si tocca: è provata da migliaia di
 *   controlli e decide chi entra in ogni voce. Qui si COMPONE, in E, una
 *   chiamata per gruppo. Cambia solo come si scelgono e si combinano le voci.
 *
 *  ⚠️ I NUMERI SONO «COSA VEDRESTI SE LA SCEGLIESSI» (a faccette): la chat
 *   deve passare la voce E gli altri gruppi già accesi, con la ricerca fuori.
 *   Il guasto del 29/10 («In osservazione 2» con l'elenco vuoto) era un numero
 *   calcolato su una cosa e un elenco su un'altra: qui sono la stessa funzione
 *   (`passaFiltri`).
 *
 *  Tutto puro: niente React, niente Supabase. Provato in prove/idee/filtri-chat.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import { LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "@/crm/types";
import { eConversione } from "@/crm/kpi-calcoli";
import { passaFiltro } from "./cercaChat";
import {
  giornoValido,
  nomeGiorno,
  passaGiorno,
  type ChatPerGiorno,
  type GiornoChat,
} from "./giorno";
import { STATI_PER_STATO } from "./perStato";
import {
  eMioRicontatto,
  ESITI_RICONTATTO,
  ESITO_NESSUNO,
  passaRisentire,
  type ChatRicontatto,
  type FiltroRisentire,
} from "./ricontatti";

export type CodaChat = "da-rispondere" | "da-chiamare";
export type FinestraChat = "aperta" | "chiusa";
export type TipoContatto = "con-scheda" | "senza-scheda" | "cliente";

/** Lo stato dei filtri. `null`/`false`/`""` = gruppo spento. */
export interface FiltriChat {
  coda: CodaChat | null;
  stelle: boolean;
  /** `attesa-whatsapp`, `per-ora-no` oppure `stato:<valore>` (vedi perStato.ts). */
  fase: string | null;
  finestra: FinestraChat | null;
  acconto: boolean;
  tipo: TipoContatto | null;
  /** id del consulente, o `""` = tutti */
  consulente: string;
  /** «Ricontatti» (31/10/2026): i miei lead a data. Acceso/spento, esclusivo come gli altri. */
  ricontatti: boolean;
  /** Dentro «Ricontatti» (31/10/2026): esito e data si COMBINANO (vedi ricontatti.ts). Non sono
   *  filtri della riga: restano vuoti se «Ricontatti» è spento e non contano sul tasto «Filtri». */
  rEsito: string;
  rData: FiltroRisentire["data"];
  /** Dentro OGNI filtro acceso (09/11/2026): Ieri · Oggi · Domani · Questa/Prossima settimana, `""` = Tutti.
   *  Interno come `rEsito`: non conta sul tasto «Filtri», si azzera quando il filtro principale si spegne
   *  o cambia. Quale data guarda dipende dal filtro: vedi giorno.ts. */
  giorno: GiornoChat;
  /** Chi è dentro, come consulente (id di chi ha digitato il PIN), o `""` se non lo è. NON è un
   *  filtro e non si salva: lo mette la pagina (`filtriValidi`) a ogni disegno. Serve a «Ricontatti». */
  io: string;
}

export const FILTRI_VUOTI: FiltriChat = {
  coda: null,
  stelle: false,
  fase: null,
  finestra: null,
  acconto: false,
  tipo: null,
  consulente: "",
  ricontatti: false,
  rEsito: "",
  rData: "",
  giorno: "",
  io: "",
};

/** I campi che sono filtri (`io` no: dice chi sei, non cosa mostrare; `rEsito`, `rData` no:
 *  sono i filtri interni di «Ricontatti»; `giorno` no: sta dentro il filtro acceso, qualunque sia). */
export type CampoFiltro = Exclude<keyof FiltriChat, "io" | "rEsito" | "rData" | "giorno">;
const CAMPI_INTERNI = ["io", "rEsito", "rData", "giorno"] as const;

/** I due filtri interni di «Ricontatti»: ognuno ha la sua etichetta con la ✕ nel riepilogo. */
export type CampoRisentireFiltri = "rEsito" | "rData";
/** Gli interni che hanno la loro ✕ nel riepilogo: i due di «Ricontatti» e il giorno. */
export type CampoInterno = CampoRisentireFiltri | "giorno";

/** I due filtri interni di «Ricontatti», come li vuole `passaRisentire`. */
export const risentireDi = (f: FiltriChat): FiltroRisentire => ({
  esito: f.rEsito,
  data: f.rData,
});

/** Quello che serve di una chat per filtrarla (la riga di `ChatItem`, in piccolo). */
export type ChatFiltrabile = Parameters<typeof passaFiltro>[0] &
  ChatRicontatto &
  ChatPerGiorno & {
    phone: string;
    /** L'ultimo messaggio della chat: serve a «In sospeso» (l'ultima parola è nostra). */
    lastMessage?: { direction: string; status: string } | null;
    daRispondere?: { attesa?: boolean } | null;
    lead?: { data?: { consulenteId?: string | null } | null } | null;
  };

/** Le stelle di una chat (0-3): le dà `useStelle`. */
export type StelleDi = (phone: string) => number;

// ── Nomi e spiegazioni (una sola fonte per griglia, pannello e riepilogo) ──────────────────

export interface VoceFiltro {
  campo: CampoFiltro;
  /** `true` per i campi acceso/spento */
  valore: string | true;
  nome: string;
  /** La riga che spiega cosa significa, mostrata nel pannello. */
  spiega: string;
  /** Pallino accanto al nome: «rosso» = bloccato, «verde» = via libera. */
  segno?: "rosso" | "verde";
}

export interface GruppoFiltri {
  id: string;
  titolo: string;
  voci: VoceFiltro[];
}

/** «Ricontatti» (31/10/2026): i MIEI lead negli stati a data, tutti insieme, dal lead più recente.
 *  Le regole stanno in ricontatti.ts. */
export const VOCE_RICONTATTI: VoceFiltro = {
  campo: "ricontatti",
  valore: true,
  nome: "Ricontatti",
  spiega: "I tuoi lead da risentire, dal più recente.",
};

/** I gruppi del pannello, nell'ordine in cui si mostrano. «Altri stati» (dopo le due voci della
 *  fase) e il consulente non stanno qui: sono dinamici e li disegna il pannello. */
export const GRUPPI_FILTRI: readonly GruppoFiltri[] = [
  {
    //  Tutto nella riga delle scorciatoie: il pannello non lo ripete (vedi `voceInRiga`).
    id: "coda",
    titolo: "Cosa fare adesso",
    voci: [
      {
        campo: "coda",
        valore: "da-rispondere",
        nome: "Da rispondere",
        spiega: "Il cliente ha scritto e nessuno ha ancora risposto.",
      },
      {
        campo: "coda",
        valore: "da-chiamare",
        nome: "Da chiamare",
        spiega:
          "Da sentire al telefono: da chiamare, non risponde, segreteria, richiamo concordato, ci ricontatta lui, e i numeri senza scheda con la finestra chiusa.",
      },
      {
        campo: "stelle",
        valore: true,
        nome: "Con stelle",
        spiega: "Chat che hai segnato con 1, 2 o 3 stelle.",
      },
    ],
  },
  {
    id: "fase",
    titolo: "Stato",
    voci: [
      {
        campo: "fase",
        valore: "attesa-whatsapp",
        nome: "Attesa WhatsApp",
        spiega: "Abbiamo scritto, aspettiamo la risposta.",
      },
      {
        campo: "fase",
        valore: "per-ora-no",
        nome: "Per ora no",
        spiega: "Da non disturbare fino alla data in scheda.",
      },
      {
        campo: "fase",
        valore: "sospeso-clienti",
        nome: "In sospeso",
        spiega:
          "Clienti fermi in attesa: attesa WhatsApp, in valutazione, da ricontattare, attesa acconto e gli altri stati in sospeso.",
      },
      {
        campo: "acconto",
        valore: true,
        nome: "Acconto versato",
        spiega: "Hanno lasciato un acconto, in qualunque stato.",
      },
    ],
  },
  {
    id: "finestra",
    titolo: "Finestra 24h",
    voci: [
      {
        campo: "finestra",
        valore: "aperta",
        nome: "Si può scrivere",
        spiega: "Appuntamento fissato, ha scritto da meno di 24 ore.",
        segno: "verde",
      },
      {
        campo: "finestra",
        valore: "chiusa",
        nome: "Finestra chiusa",
        spiega: "Appuntamento fissato, 24 ore passate: serve un modello.",
        segno: "rosso",
      },
    ],
  },
  {
    id: "tipo",
    titolo: "Chi",
    voci: [
      {
        campo: "tipo",
        valore: "con-scheda",
        nome: "Con scheda",
        spiega: "Numeri collegati a un lead del CRM.",
      },
      {
        campo: "tipo",
        valore: "senza-scheda",
        nome: "Senza scheda",
        spiega: "Numeri non ancora collegati a un lead: da abbinare o creare.",
      },
      {
        campo: "tipo",
        valore: "cliente",
        nome: "Clienti",
        spiega:
          "Hanno comprato: acconto incassato, oppure posa nel nostro centro, a domicilio o da spedire.",
      },
    ],
  },
  {
    //  Nella riga, non nel pannello.
    id: "ricontatti",
    titolo: "Ricontatti",
    voci: [VOCE_RICONTATTI],
  },
];

/** Le voci della coda: Da rispondere, Da chiamare, Con stelle. */
export const VOCI_GRIGLIA: readonly VoceFiltro[] = GRUPPI_FILTRI[0].voci;

/** «Sconosciuti» (numeri senza scheda): stesso filtro di «Senza scheda» del pannello, in vista. */
export const VOCE_SCONOSCIUTI: VoceFiltro = {
  campo: "tipo",
  valore: "senza-scheda",
  nome: "Sconosciuti",
  spiega: "Numeri non ancora collegati a un lead del CRM.",
};

/** «Clienti» (30/10/2026): chi ha comprato davvero. Stessa voce del gruppo «Tipo di contatto». */
export const VOCE_CLIENTI: VoceFiltro = {
  campo: "tipo",
  valore: "cliente",
  nome: "Clienti",
  spiega:
    "Hanno comprato: acconto incassato, oppure posa nel nostro centro, a domicilio o da spedire.",
};

/** La voce di uno stato scelto da «Altri stati»: nome del CRM, nessuna spiegazione. */
export const voceDelloStato = (stato: LeadStatus): VoceFiltro => ({
  campo: "fase",
  valore: `stato:${stato}`,
  nome: LEAD_STATUS_LABEL[stato],
  spiega: "",
});

/** «Non risponde» e «Da riprogrammare» (31/10/2026): due stati già filtrabili da «Altri stati», portati in riga.
 *  Sono voci della fase (`stato:<valore>`, vedi perStato.ts): nessuna regola di filtro nuova, e il nome è quello del CRM. */
export const VOCE_NON_RISPONDE: VoceFiltro = {
  ...voceDelloStato("non_risponde"),
  spiega:
    "Tutti i lead in stato «Non risponde»: li hai chiamati e non hanno risposto, anche se poi hanno scritto.",
};
export const VOCE_DA_RIPROGRAMMARE: VoceFiltro = {
  ...voceDelloStato("da_spostare"),
  spiega:
    "Tutti i lead in stato «Da riprogrammare»: l'incontro è saltato e aspetta una nuova data.",
};

/** «Da recuperare» (31/10/2026, titolare: «metti il filtro da recuperare, dove dentro ci sono i clienti
 *  assenti»): lo stato «Cliente assente» (`no_show` e `non_fatto`, una sola voce: vedi perStato.ts). */
export const VOCE_DA_RECUPERARE: VoceFiltro = {
  ...voceDelloStato("no_show"),
  nome: "Da recuperare",
  spiega: "I clienti assenti alla consulenza: da ricontattare per fissarla di nuovo.",
};

/** «In sospeso» (06/11/2026): clienti (stessa definizione di «Clienti») con uno stato fermo in attesa.
 *  Elenco esplicito degli stati con fase «in sospeso» (vedi LEAD_STATUS_PHASE in crm/types.ts) più
 *  «Attesa WhatsApp», «In valutazione» e «Da ricontattare». Se cambia la fase di uno stato, si aggiorna qui. */
const STATI_IN_SOSPESO_CLIENTI: readonly LeadStatus[] = [
  "non_fatto",
  "da_spostare",
  "in_attesa_acconto",
  "irreperibile",
  "ricontatto_aperto",
  "sede_disdetta",
  "attesa_whatsapp",
  "sta_valutando",
  "da_ricontattare",
];
export const VOCE_IN_SOSPESO_CLIENTI: VoceFiltro = {
  campo: "fase",
  valore: "sospeso-clienti",
  nome: "In sospeso",
  spiega:
    "Clienti fermi in attesa: attesa WhatsApp, in valutazione, da ricontattare, attesa acconto e gli altri stati in sospeso.",
};

/** ── LA RIGA DEI FILTRI RAPIDI (30/10/2026) ─────────────────────────────────
 *  Sul telefono una riga sola che scorre di lato, nell'ordine d'uso: Tutte · Da rispondere · Da chiamare ·
 *  Con stelle · Sconosciuti · Ricontatti · Da recuperare · Clienti. «Tutte» (spenti tutti i
 *  filtri) la disegna `ElencoChat`; qui ci sono le voci vere. Il consulente sta nel pannello «Filtri».
 *  Il pannello NON ripete le voci della riga: vedi `voceInRiga`.
 *  Gli stati di chiamata (Non risponde, Segreteria…) sono i sottofiltri di «Da chiamare». */
//  ⚠️ 31/10/2026, correzione del titolare: «Non risponde» e gli altri stati di
//   chiamata stanno SOLO dentro «Da chiamare» (i suoi sottofiltri), non nella
//   riga generale. «Da riprogrammare» resta in Filtri → Altri stati.
export const VOCI_RIGA: readonly VoceFiltro[] = [
  ...VOCI_GRIGLIA.filter((v) => v.campo !== "stelle"),
  ...VOCI_GRIGLIA.filter((v) => v.campo === "stelle"),
  VOCE_SCONOSCIUTI,
  VOCE_RICONTATTI,
  VOCE_DA_RECUPERARE,
  VOCE_CLIENTI,
  VOCE_IN_SOSPESO_CLIENTI,
];

/** La voce sta già nella riga delle scorciatoie? Allora il pannello non la ripete (31/10/2026). */
export const voceInRiga = (v: Pick<VoceFiltro, "campo" | "valore">): boolean =>
  VOCI_RIGA.some((r) => r.campo === v.campo && r.valore === v.valore);

/** «Altri stati»: gli stati che hanno un filtro, nell'ordine del CRM, uno per etichetta. */
export const STATI_ALTRI: readonly LeadStatus[] = STATI_PER_STATO;

// ── Chi passa ─────────────────────────────────────────────────────────────────────────────────────

const FILTRO_FASE_VALIDO = new Set<string>([
  "attesa-whatsapp",
  "per-ora-no",
  "sospeso-clienti",
  ...STATI_PER_STATO.map((s) => `stato:${s}`),
]);

/** Il valore della fase esiste ancora? Uno stato scomparso dal CRM non filtra più. */
export const faseValida = (v: unknown): v is string =>
  typeof v === "string" && FILTRO_FASE_VALIDO.has(v);

/** «Da rispondere»: l'ultimo messaggio è del cliente (regola unica, vedi `daRispondere` in stato.ts). */
function passaCoda(c: ChatFiltrabile, coda: CodaChat): boolean {
  if (coda === "da-chiamare") return passaFiltro(c, "da-chiamare");
  return c.daRispondere?.attesa === true;
}

/** L'ultimo messaggio della chat è nostro e non è fallito: il cliente non ha ancora risposto. */
function ultimaParolaNostra(c: ChatFiltrabile): boolean {
  const m = c.lastMessage;
  return !!m && m.direction === "outbound" && m.status !== "failed";
}

/** La chat passa TUTTI i gruppi accesi (E)? Non guarda la ricerca. Il giorno (09/11/2026) vale solo se
 *  si dice che ora è (`adesso`): senza, non si sa che giorno sia e il giorno non filtra. L'elenco, i
 *  numeri dei segmenti e quelli delle voci passano tutti da qui con la stessa ora. */
export function passaFiltri(
  c: ChatFiltrabile,
  f: FiltriChat,
  stelleDi: StelleDi,
  adesso?: Date,
): boolean {
  if (f.coda && !passaCoda(c, f.coda)) return false;
  if (f.stelle && stelleDi(c.phone) <= 0) return false;
  if (f.fase === "sospeso-clienti") {
    //  Cliente per la definizione del CRM, e stato fermo in attesa. Senza scheda non lo è.
    const stato = (c.lead?.data as { stato?: LeadStatus } | undefined)?.stato;
    if (!c.lead || !eConversione(c.lead as Pick<Lead, "data">)) return false;
    if (!stato || !STATI_IN_SOSPESO_CLIENTI.includes(stato)) return false;
    //  «A chi ho risposto, ma lui non ha risposto»: l'ultima parola è nostra e non è fallita.
    if (!ultimaParolaNostra(c)) return false;
  } else if (f.fase && (!faseValida(f.fase) || !passaFiltro(c, f.fase as "per-ora-no"))) return false;
  if (f.finestra && !passaFiltro(c, f.finestra === "aperta" ? "aperto-24h" : "chiuso-24h"))
    return false;
  if (f.acconto && !passaFiltro(c, "acconto")) return false;
  if (f.tipo === "cliente") {
    //  Cliente = la definizione del CRM (`eConversione`, kpi-calcoli): acconto incassato (importo),
    //  una chiusura vinta o il vecchio «venduto». Nessuna regola nuova. Senza scheda non lo è.
    if (!c.lead || !eConversione(c.lead as Pick<Lead, "data">)) return false;
  } else if (f.tipo && !passaFiltro(c, f.tipo === "con-scheda" ? "with-lead" : "unknown"))
    return false;
  //  «Ricontatti»: solo i MIEI, per tutti e senza eccezioni (anche l'admin). Il menu del consulente
  //  non si somma: scegliere un altro non mostra i suoi. Senza `io` non passa nessuno.
  if (f.ricontatti && !eMioRicontatto(c, f.io)) return false;
  if (f.ricontatti && !passaRisentire(c, risentireDi(f))) return false;
  if (f.consulente && !f.ricontatti && c.lead?.data?.consulenteId !== f.consulente) return false;
  if (f.giorno && adesso && !passaGiorno(c, f, adesso)) return false;
  return true;
}

/** La voce `campo = valore` è accesa? */
export const eAcceso = (f: FiltriChat, campo: CampoFiltro, valore: string | true): boolean =>
  valore === true ? f[campo] === true : f[campo] === valore;

/** Tocca una voce (filtri esclusivi): se è accesa si spegne; altrimenti si spegne qualunque altra e si
 *  accende questa. Il consulente non è un filtro da azzerare: scegliere un consulente non spegne la
 *  voce accesa, e toccare una voce non toglie il consulente. */
export function commuta(f: FiltriChat, campo: CampoFiltro, valore: string | true): FiltriChat {
  if (campo === "consulente")
    return { ...f, consulente: f.consulente === valore ? "" : String(valore) };
  if (eAcceso(f, campo, valore)) return togli(f, campo);
  return { ...FILTRI_VUOTI, consulente: f.consulente, io: f.io, [campo]: valore };
}

/** Il gruppo `campo` torna spento. */
export function togli(f: FiltriChat, campo: CampoFiltro | CampoInterno): FiltriChat {
  const spento = { ...f, [campo]: FILTRI_VUOTI[campo] } as FiltriChat;
  //  Spegnendo «Ricontatti» i suoi due filtri non restano accesi di nascosto.
  const senzaInterni: FiltriChat = campo === "ricontatti" ? { ...spento, rEsito: "", rData: "" } : spento;
  //  Il giorno vive dentro il filtro acceso: se questo si spegne, va con lui. Il consulente non è un
  //  filtro (resta com'è, giorno compreso).
  //  Esito e Data di «Ricontatti» sono altri interni: toglierli lascia il giorno.
  return campo === "consulente" || campo === "rEsito" || campo === "rData"
    ? senzaInterni
    : { ...senzaInterni, giorno: "" };
}

/** Quanti filtri sono accesi (il numero sul tasto «Filtri»). */
export const contaAccesi = (f: FiltriChat): number =>
  (Object.keys(FILTRI_VUOTI) as (keyof FiltriChat)[]).filter(
    //  In «Ricontatti» il menu del consulente non conta: vale solo chi è dentro (vedi passaFiltri).
    (k) =>
      !(CAMPI_INTERNI as readonly string[]).includes(k) &&
      !(k === "consulente" && f.ricontatti) &&
      f[k] !== FILTRI_VUOTI[k],
  ).length;

/** Quante chat vedresti se toccassi `campo = valore`: la voce da sola (sostituisce quella accesa) più
 *  il consulente (ricerca esclusa). Per il consulente stesso: la voce accesa resta. */
export function contaVoce(
  chats: readonly ChatFiltrabile[],
  f: FiltriChat,
  stelleDi: StelleDi,
  campo: CampoFiltro,
  valore: string | true,
  /** Serve solo per il consulente, che tiene il giorno scelto; le altre voci ripartono da zero. */
  adesso?: Date,
): number {
  const prova = (
    campo === "consulente"
      ? { ...f, consulente: valore }
      : { ...FILTRI_VUOTI, consulente: f.consulente, io: f.io, [campo]: valore }
  ) as FiltriChat;
  return chats.filter((c) => passaFiltri(c, prova, stelleDi, adesso)).length;
}

/** Quante chat vedresti con il segmento `giorno` (09/11/2026): i filtri accesi come sono, il giorno
 *  sostituito (ricerca esclusa, come i numeri delle voci). È `passaFiltri` con la stessa ora
 *  dell'elenco: il numero e l'elenco non possono dire cose diverse. */
export const contaGiorno = (
  chats: readonly ChatFiltrabile[],
  f: FiltriChat,
  stelleDi: StelleDi,
  adesso: Date,
  giorno: GiornoChat,
): number => chats.filter((c) => passaFiltri(c, { ...f, giorno }, stelleDi, adesso)).length;

/** Quante chat passano i filtri così come sono (ricerca esclusa). */
export const contaVisibili = (
  chats: readonly ChatFiltrabile[],
  f: FiltriChat,
  stelleDi: StelleDi,
): number => chats.filter((c) => passaFiltri(c, f, stelleDi)).length;

// ── Il riepilogo sotto la griglia ─────────────────────────────────────────────────────────────

export interface EtichettaAccesa {
  campo: CampoFiltro | CampoInterno;
  etichetta: string;
}

/** Le etichette dei filtri accesi, nell'ordine dei gruppi: ognuna si toglie con la sua ✕. */
export function etichetteAccese(
  f: FiltriChat,
  nomeConsulente: (id: string) => string,
): EtichettaAccesa[] {
  const nomi = new Map<string, string>();
  for (const g of GRUPPI_FILTRI)
    for (const v of g.voci) if (v.valore !== true) nomi.set(`${v.campo}:${v.valore}`, v.nome);
  const out: EtichettaAccesa[] = [];
  const nomeDi = (campo: CampoFiltro, valore: string) => {
    if (campo === "fase" && valore.startsWith("stato:"))
      return LEAD_STATUS_LABEL[valore.slice(6) as LeadStatus] ?? valore;
    return nomi.get(`${campo}:${valore}`) ?? valore;
  };
  if (f.coda) out.push({ campo: "coda", etichetta: nomeDi("coda", f.coda) });
  if (f.stelle) out.push({ campo: "stelle", etichetta: "Con stelle" });
  if (f.ricontatti) out.push({ campo: "ricontatti", etichetta: "Ricontatti" });
  //  I due filtri di «Ricontatti»: una etichetta per filtro acceso, ognuna si toglie con la sua ✕.
  if (f.ricontatti && f.rEsito)
    out.push({
      campo: "rEsito",
      etichetta:
        f.rEsito === ESITO_NESSUNO
          ? "Senza esito"
          : (ESITI_RICONTATTO.find((e) => e.v === f.rEsito)?.nome ?? f.rEsito),
    });
  if (f.ricontatti && f.rData)
    out.push({ campo: "rData", etichetta: f.rData === "con" ? "Con data" : "Senza data" });
  if (f.fase) out.push({ campo: "fase", etichetta: nomeDi("fase", f.fase) });
  if (f.finestra) out.push({ campo: "finestra", etichetta: nomeDi("finestra", f.finestra) });
  if (f.acconto) out.push({ campo: "acconto", etichetta: "Acconto versato" });
  if (f.tipo) out.push({ campo: "tipo", etichetta: nomeDi("tipo", f.tipo) });
  if (f.giorno) out.push({ campo: "giorno", etichetta: nomeGiorno(f.giorno) });
  if (f.consulente && !f.ricontatti)
    out.push({ campo: "consulente", etichetta: nomeConsulente(f.consulente) });
  return out;
}

// ── Valori salvati ─────────────────────────────────────────────────────────────────────────────
//  Il consulente si ricorda sul dispositivo (localStorage); gli altri filtri finché la scheda del
//  browser resta aperta (sessionStorage). Cosa si legge può essere vecchio, rotto o scritto da una
//  versione diversa: ogni valore che non si riconosce si ignora, senza errori.

const CODE: readonly string[] = ["da-rispondere", "da-chiamare"];

/** Quale tenere se ne trovi più d'uno, dal più specifico al più generico. */
const PRIORITA: readonly Exclude<CampoFiltro, "consulente">[] = [
  "fase",
  "finestra",
  "acconto",
  "coda",
  "tipo",
  "stelle",
  "ricontatti",
];

/** Filtri esclusivi: se ne sono accesi più d'uno (salvati da una versione che li combinava) ne resta
 *  uno solo, il più specifico. Il consulente non conta e non cambia. Non muta l'ingresso. */
export function soloUno(f: FiltriChat): FiltriChat {
  const tenuto = PRIORITA.find((k) => f[k] !== FILTRI_VUOTI[k]);
  const out: FiltriChat = { ...FILTRI_VUOTI, consulente: f.consulente, io: f.io };
  if (tenuto) (out as unknown as Record<string, unknown>)[tenuto] = f[tenuto];
  //  Il giorno sta dentro il filtro acceso: senza filtro non resta di nascosto.
  if (tenuto) out.giorno = f.giorno;
  //  I filtri interni vivono solo con «Ricontatti» acceso.
  if (tenuto === "ricontatti") {
    out.rEsito = f.rEsito;
    out.rData = f.rData;
  }
  return out;
}

/** Gli altri filtri, come stringa per `sessionStorage` (il consulente ha il suo posto). */
export function scriviFiltriSessione(f: FiltriChat): string {
  //  `io` non si salva: lo rimette la pagina a ogni disegno (chi è dentro può cambiare).
  const { consulente: _consulente, io: _io, ...resto } = f;
  return JSON.stringify(resto);
}

/** Rimette insieme i filtri dai due posti. Mai un errore: il peggio è «tutto spento». */
export function leggiFiltri(sessione: string | null, consulente: string | null): FiltriChat {
  let o: Record<string, unknown> = {};
  try {
    const v: unknown = sessione ? JSON.parse(sessione) : {};
    if (v && typeof v === "object" && !Array.isArray(v)) o = v as Record<string, unknown>;
  } catch {
    /* testo rotto: si riparte da zero */
  }
  return soloUno({
    coda: typeof o.coda === "string" && CODE.includes(o.coda) ? (o.coda as CodaChat) : null,
    stelle: o.stelle === true,
    fase: faseValida(o.fase) ? o.fase : null,
    finestra: o.finestra === "aperta" || o.finestra === "chiusa" ? o.finestra : null,
    acconto: o.acconto === true,
    tipo:
      o.tipo === "con-scheda" || o.tipo === "senza-scheda" || o.tipo === "cliente" ? o.tipo : null,
    ricontatti: o.ricontatti === true,
    rEsito:
      o.rEsito === ESITO_NESSUNO || ESITI_RICONTATTO.some((e) => e.v === o.rEsito)
        ? (o.rEsito as string)
        : "",
    rData: o.rData === "con" || o.rData === "senza" ? o.rData : "",
    giorno: giornoValido(o.giorno) ? o.giorno : "",
    consulente: typeof consulente === "string" ? consulente.slice(0, 80) : "",
    io: "",
  });
}

/** Il consulente salvato esiste ancora? Se è stato cancellato il filtro non vale (e non si vede
 *  nemmeno: sarebbe un filtro acceso senza etichetta). Con l'elenco dei consulenti ancora vuoto
 *  (CRM che si carica) vale «tutti»: non si toglie niente dal salvataggio, solo dalla vista. */
export function filtriValidi(
  f: FiltriChat,
  consulentiNoti: ReadonlySet<string>,
  /** Chi è dentro come consulente (`useConsulenteCollegato`); omesso = nessuno. Lo mette qui, in un
   *  posto solo, perché `passaFiltri` lo trovi in ogni conto («Ricontatti» è sempre «i miei»). */
  io = "",
): FiltriChat {
  const valido = f.consulente && !consulentiNoti.has(f.consulente) ? { ...f, consulente: "" } : f;
  return valido.io === io ? valido : { ...valido, io };
}
