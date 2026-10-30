/** ── I FILTRI DELLA CHAT, A GRUPPI (30/10/2026) ─────────────────────────────
 *
 *  Richiesta del titolare: «i filtri sono caotici, "chiuso" e "aperto" non si
 *  capisce cosa significano». Prima: dieci pastiglie in una fila, UNA sola
 *  scelta alla volta. Ora: sei gruppi, ognuno risponde a una domanda di lavoro.
 *
 *  Regola unica: **gruppi diversi si sommano (E); dentro un gruppo la scelta è
 *  una sola; «Azzera» toglie tutto.** La ricerca si somma sempre a tutto.
 *
 *   1. Cosa fare adesso   coda (Da rispondere · Da chiamare): una sola
 *                         + stelle (acceso/spento, si combina con tutto)
 *   2. Fase del lead      Attesa WhatsApp · Per ora no · un altro stato: una sola
 *   3. Finestra WhatsApp  Si può scrivere · Finestra chiusa: una sola
 *   4. Pagamento          Acconto versato (acceso/spento)
 *   5. Tipo di contatto   Con scheda · Senza scheda: una sola
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
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/crm/types";
import { passaFiltro } from "./cercaChat";
import { STATI_PER_STATO } from "./perStato";

export type CodaChat = "da-rispondere" | "da-chiamare";
export type FinestraChat = "aperta" | "chiusa";
export type TipoContatto = "con-scheda" | "senza-scheda";

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
}

export const FILTRI_VUOTI: FiltriChat = {
  coda: null,
  stelle: false,
  fase: null,
  finestra: null,
  acconto: false,
  tipo: null,
  consulente: "",
};

export type CampoFiltro = keyof FiltriChat;

/** Quello che serve di una chat per filtrarla (la riga di `ChatItem`, in piccolo). */
export type ChatFiltrabile = Parameters<typeof passaFiltro>[0] & {
  phone: string;
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

/** I gruppi del pannello, nell'ordine in cui si mostrano. «Altri stati» (dopo le due voci della
 *  fase) e il consulente non stanno qui: sono dinamici e li disegna il pannello. */
export const GRUPPI_FILTRI: readonly GruppoFiltri[] = [
  {
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
    titolo: "Fase del lead",
    voci: [
      {
        campo: "fase",
        valore: "attesa-whatsapp",
        nome: "Attesa WhatsApp",
        spiega: "Abbiamo scritto e aspettiamo la risposta del cliente.",
      },
      {
        campo: "fase",
        valore: "per-ora-no",
        nome: "Per ora no",
        spiega: "Da non disturbare fino alla data indicata nella scheda.",
      },
    ],
  },
  {
    id: "finestra",
    titolo: "Appuntamenti fissati: finestra WhatsApp",
    voci: [
      {
        campo: "finestra",
        valore: "aperta",
        nome: "Si può scrivere",
        spiega:
          "Appuntamento fissato e il cliente ha scritto nelle ultime 24 ore: rispondi gratis.",
        segno: "verde",
      },
      {
        campo: "finestra",
        valore: "chiusa",
        nome: "Finestra chiusa",
        spiega:
          "Appuntamento fissato, ma sono passate 24 ore dall'ultimo messaggio del cliente: per scrivere serve un modello a pagamento, oppure il telefono.",
        segno: "rosso",
      },
    ],
  },
  {
    id: "pagamento",
    titolo: "Pagamento",
    voci: [
      {
        campo: "acconto",
        valore: true,
        nome: "Acconto versato",
        spiega: "Hanno lasciato un acconto, in qualunque fase siano.",
      },
    ],
  },
  {
    id: "tipo",
    titolo: "Tipo di contatto",
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
    ],
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

/** ── LA RIGA DEI FILTRI RAPIDI (30/10/2026) ─────────────────────────────────
 *  Sul telefono una riga sola che scorre di lato, nell'ordine d'uso: Tutte · Da rispondere ·
 *  Da chiamare · Con stelle · Sconosciuti. «Tutte» (spenti tutti i filtri) la disegna `ElencoChat`;
 *  qui ci sono le quattro voci vere. Il consulente sta nel pannello «Filtri». */
export const VOCI_RIGA: readonly VoceFiltro[] = [...VOCI_GRIGLIA, VOCE_SCONOSCIUTI];

/** La voce di uno stato scelto da «Altri stati»: nome del CRM, nessuna spiegazione. */
export const voceDelloStato = (stato: LeadStatus): VoceFiltro => ({
  campo: "fase",
  valore: `stato:${stato}`,
  nome: LEAD_STATUS_LABEL[stato],
  spiega: "",
});

/** «Altri stati»: gli stati che hanno un filtro, nell'ordine del CRM, uno per etichetta. */
export const STATI_ALTRI: readonly LeadStatus[] = STATI_PER_STATO;

// ── Chi passa ─────────────────────────────────────────────────────────────────────────────────────

const FILTRO_FASE_VALIDO = new Set<string>([
  "attesa-whatsapp",
  "per-ora-no",
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

/** La chat passa TUTTI i gruppi accesi (E)? Non guarda la ricerca. */
export function passaFiltri(c: ChatFiltrabile, f: FiltriChat, stelleDi: StelleDi): boolean {
  if (f.coda && !passaCoda(c, f.coda)) return false;
  if (f.stelle && stelleDi(c.phone) <= 0) return false;
  if (f.fase && (!faseValida(f.fase) || !passaFiltro(c, f.fase as "per-ora-no"))) return false;
  if (f.finestra && !passaFiltro(c, f.finestra === "aperta" ? "aperto-24h" : "chiuso-24h"))
    return false;
  if (f.acconto && !passaFiltro(c, "acconto")) return false;
  if (f.tipo && !passaFiltro(c, f.tipo === "con-scheda" ? "with-lead" : "unknown")) return false;
  if (f.consulente && c.lead?.data?.consulenteId !== f.consulente) return false;
  return true;
}

/** La voce `campo = valore` è accesa? */
export const eAcceso = (f: FiltriChat, campo: CampoFiltro, valore: string | true): boolean =>
  valore === true ? f[campo] === true : f[campo] === valore;

/** Tocca una voce: se è accesa si spegne, altrimenti prende il posto di quella del suo gruppo. */
export function commuta(f: FiltriChat, campo: CampoFiltro, valore: string | true): FiltriChat {
  if (valore === true) return { ...f, [campo]: !f[campo] };
  return { ...f, [campo]: f[campo] === valore ? (campo === "consulente" ? "" : null) : valore };
}

/** Il gruppo `campo` torna spento. */
export function togli(f: FiltriChat, campo: CampoFiltro): FiltriChat {
  return { ...f, [campo]: FILTRI_VUOTI[campo] };
}

/** Quanti filtri sono accesi (il numero sul tasto «Filtri»). */
export const contaAccesi = (f: FiltriChat): number =>
  (Object.keys(FILTRI_VUOTI) as CampoFiltro[]).filter((k) => f[k] !== FILTRI_VUOTI[k]).length;

/** Quante chat vedresti se accendessi `campo = valore` tenendo gli altri gruppi come sono
 *  (ricerca esclusa). Il gruppo di `campo` viene sostituito, non sommato. */
export function contaVoce(
  chats: readonly ChatFiltrabile[],
  f: FiltriChat,
  stelleDi: StelleDi,
  campo: CampoFiltro,
  valore: string | true,
): number {
  const prova = { ...f, [campo]: valore } as FiltriChat;
  return chats.filter((c) => passaFiltri(c, prova, stelleDi)).length;
}

/** Quante chat passano i filtri così come sono (ricerca esclusa). */
export const contaVisibili = (
  chats: readonly ChatFiltrabile[],
  f: FiltriChat,
  stelleDi: StelleDi,
): number => chats.filter((c) => passaFiltri(c, f, stelleDi)).length;

// ── Il riepilogo sotto la griglia ─────────────────────────────────────────────────────────────

export interface EtichettaAccesa {
  campo: CampoFiltro;
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
  if (f.fase) out.push({ campo: "fase", etichetta: nomeDi("fase", f.fase) });
  if (f.finestra) out.push({ campo: "finestra", etichetta: nomeDi("finestra", f.finestra) });
  if (f.acconto) out.push({ campo: "acconto", etichetta: "Acconto versato" });
  if (f.tipo) out.push({ campo: "tipo", etichetta: nomeDi("tipo", f.tipo) });
  if (f.consulente) out.push({ campo: "consulente", etichetta: nomeConsulente(f.consulente) });
  return out;
}

// ── Valori salvati ─────────────────────────────────────────────────────────────────────────────
//  Il consulente si ricorda sul dispositivo (localStorage); gli altri filtri finché la scheda del
//  browser resta aperta (sessionStorage). Cosa si legge può essere vecchio, rotto o scritto da una
//  versione diversa: ogni valore che non si riconosce si ignora, senza errori.

const CODE: readonly string[] = ["da-rispondere", "da-chiamare"];

/** Gli altri filtri, come stringa per `sessionStorage` (il consulente ha il suo posto). */
export function scriviFiltriSessione(f: FiltriChat): string {
  const { consulente: _consulente, ...resto } = f;
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
  return {
    coda: typeof o.coda === "string" && CODE.includes(o.coda) ? (o.coda as CodaChat) : null,
    stelle: o.stelle === true,
    fase: faseValida(o.fase) ? o.fase : null,
    finestra: o.finestra === "aperta" || o.finestra === "chiusa" ? o.finestra : null,
    acconto: o.acconto === true,
    tipo: o.tipo === "con-scheda" || o.tipo === "senza-scheda" ? o.tipo : null,
    consulente: typeof consulente === "string" ? consulente.slice(0, 80) : "",
  };
}

/** Il consulente salvato esiste ancora? Se è stato cancellato il filtro non vale (e non si vede
 *  nemmeno: sarebbe un filtro acceso senza etichetta). Con l'elenco dei consulenti ancora vuoto
 *  (CRM che si carica) vale «tutti»: non si toglie niente dal salvataggio, solo dalla vista. */
export function filtriValidi(f: FiltriChat, consulentiNoti: ReadonlySet<string>): FiltriChat {
  return f.consulente && !consulentiNoti.has(f.consulente) ? { ...f, consulente: "" } : f;
}
