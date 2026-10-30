/** ── RISPOSTE SCRITTE DALL'AI, DAL MAC: LE REGOLE ────────────────────────────
 *
 *  Richiesta del titolare (29/10/2026): nella chat WhatsApp del CRM si
 *  scelgono 1, 2, 3, 4 messaggi e il CRM prepara la risposta. La scrive Claude
 *  (Haiku, il modello meno costoso) sul Mac del titolare, con le informazioni
 *  dell'azienda che stanno in AIOS. Va anche dal telefono, basta che il Mac
 *  sia acceso.
 *
 *  Il giro:
 *   1. il CRM scrive una riga in `wa_risposte_ai` («in_coda»);
 *   2. il servizio sul Mac (`strumenti/risposte-ai`) chiede lavoro a
 *      POST /api/public/risposte-ai con la chiave del ponte WhatsApp;
 *   3. la rotta gli dà la richiesta con i messaggi scelti, gli ultimi della
 *      chat e due righe sulla scheda (`lavoroPerMac`);
 *   4. il Mac scrive la risposta e la consegna; il CRM la mette nella casella.
 *  ⚠️ LA RISPOSTA NON SI INVIA MAI DA SOLA: finisce nella casella, si rilegge.
 *  ⚠️ Qui solo regole pure (provate in prove/prove.mjs, proveDelleRisposteAi).
 *  ───────────────────────────────────────────────────────────────────────── */
import { LEAD_STATUS_LABEL, type LeadData, type LeadStatus } from "@/crm/types";

/** Quanti messaggi si possono scegliere (la tabella ne accetta fino a 8). */
export const MAX_SCELTI = 4;
/** Quanti messaggi della chat, prima e intorno ai scelti, servono da contesto. */
export const MESSAGGI_CONTESTO = 20;
/** Il Mac chiede lavoro ogni pochi secondi: se tace da più di così è spento. */
export const PC_SPENTO_DOPO_S = 45;
/** Dopo quanto il CRM smette di aspettare: la migrazione usa la stessa finestra. */
export const ATTESA_MAX_S = 180;
export const CHIAVE_BATTITO = "risposte_ai_battito";
export const LIMITE_RISPOSTA = 4000;
export const LIMITE_INDICAZIONE = 500;

/* ── IDEE DEL 30/10/2026: BOZZE PRONTE E ORARI LIBERI ──────────────────── */

/** Gli orari liberi nella richiesta: la colonna `orari` accetta fino a 600. */
export const LIMITE_ORARI = 600;
export const ORARI_MAX = 8;
export const ORARI_CARATTERI = 400;
/** Quante bozze automatiche al massimo in 24 ore (il tetto prudente). */
export const BOZZE_AL_GIORNO = 40;
/** Una bozza automatica si prepara solo per un messaggio arrivato da meno di così. */
export const BOZZA_ENTRO_ORE = 24;
/** Quante chat in attesa si guardano a ogni ricerca di una bozza da preparare. */
export const BOZZE_CHAT_MAX = 15;
/** A coda vuota il Mac chiede ogni pochi secondi: la ricerca di una bozza si fa al massimo così spesso. */
export const BOZZA_OGNI_S = 30;

/* ── LE RICHIESTE DEL MAC ──────────────────────────────────────────────── */

export type RichiestaMac =
  | { azione: "prendi" }
  | { azione: "consegna"; id: string; risposta: string }
  | { azione: "fallita"; id: string; errore: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un codice d'errore breve: niente testi liberi del Mac nel database. */
const CODICE = /^[a-z0-9_]{1,40}$/;

/** Il corpo del Mac, controllato. `null` se non è valido. */
export function leggiRichiestaMac(corpo: unknown): RichiestaMac | null {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return null;
  const c = corpo as Record<string, unknown>;
  if (c.azione === "prendi") return { azione: "prendi" };
  if (typeof c.id !== "string" || !UUID.test(c.id)) return null;
  if (c.azione === "consegna") {
    const risposta = pulisciRisposta(c.risposta);
    return risposta ? { azione: "consegna", id: c.id, risposta } : null;
  }
  if (c.azione === "fallita") {
    const errore = typeof c.errore === "string" && CODICE.test(c.errore) ? c.errore : "errore";
    return { azione: "fallita", id: c.id, errore };
  }
  return null;
}

/** Il testo del modello, pronto per la casella: senza virgolette o blocchi di
 *  codice intorno, senza «Risposta:» in testa, senza righe vuote in eccesso,
 *  tagliato al limite. Vuoto se non resta niente. */
export function pulisciRisposta(t: unknown): string {
  if (typeof t !== "string") return "";
  let s = t.replace(/\r\n?/g, "\n").split("\u0000").join("").trim();
  s = s
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();
  s = s.replace(/^(risposta|messaggio|bozza)\s*:\s*/i, "").trim();
  const virgolette: [string, string][] = [
    ['"', '"'],
    ["«", "»"],
    ["“", "”"],
  ];
  for (const [a, b] of virgolette)
    if (s.length > 1 && s.startsWith(a) && s.endsWith(b) && !s.slice(1, -1).includes(b))
      s = s.slice(1, -1).trim();
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.slice(0, LIMITE_RISPOSTA).trim();
}

/* ── IL LAVORO PER IL MAC ──────────────────────────────────────────────── */

export interface MessaggioRiga {
  id: string;
  direction: string;
  body: string | null;
  created_at: string;
}

export interface MessaggioLavoro {
  chi: "cliente" | "noi";
  testo: string;
  quando: string;
  scelto: boolean;
}

export interface LavoroMac {
  id: string;
  indicazione: string | null;
  cliente: {
    nome: string;
    stato: string | null;
    consulenza: string | null;
    consulente: string | null;
    note: string | null;
  };
  /** in ordine di tempo, dal più vecchio; i scelti hanno `scelto: true` */
  messaggi: MessaggioLavoro[];
  /** gli orari liberi veri dei prossimi giorni, in una riga; `null` se non ci sono */
  orari: string | null;
}

const ORA_ROMA = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const corto = (t: unknown, max: number): string | null => {
  const s = typeof t === "string" ? t.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** Cosa riceve il Mac: i messaggi scelti dentro gli ultimi della chat (così
 *  il modello capisce il discorso), e poche righe sulla scheda. Niente
 *  telefono, email o id: al modello non servono. */
export function lavoroPerMac(p: {
  id: string;
  indicazione?: string | null;
  scelti: string[];
  /** gli ultimi messaggi della chat, in qualunque ordine */
  messaggi: MessaggioRiga[];
  lead?: Partial<LeadData> | null;
  consulente?: string | null;
  /** gli orari liberi scritti dal CRM nella richiesta */
  orari?: string | null;
}): LavoroMac | null {
  const scelti = new Set(p.scelti);
  const ordinati = [...p.messaggi]
    .filter((m) => typeof m.body === "string" && m.body.trim())
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  //  I scelti ci sono tutti; il contesto si taglia dai più vecchi.
  const ultimoScelto = ordinati.reduce((n, m, i) => (scelti.has(m.id) ? i : n), -1);
  if (ultimoScelto < 0) return null;
  const fine = ordinati.length;
  const inizio = Math.max(0, fine - MESSAGGI_CONTESTO);
  const primoScelto = ordinati.findIndex((m) => scelti.has(m.id));
  const tagliati = ordinati.slice(Math.min(inizio, primoScelto), fine);
  const l = p.lead ?? {};
  const consulenza =
    l.dataMeeting && /^\d{4}-\d{2}-\d{2}/.test(l.dataMeeting)
      ? `${l.dataMeeting.slice(0, 10)}${l.oraMeeting ? ` alle ${l.oraMeeting}` : ""}`
      : null;
  return {
    id: p.id,
    indicazione: corto(p.indicazione, LIMITE_INDICAZIONE),
    cliente: {
      nome: corto(l.nome, 40) ?? "",
      stato: l.stato ? (LEAD_STATUS_LABEL[l.stato as LeadStatus] ?? null) : null,
      consulenza,
      consulente: corto(p.consulente, 60),
      note: corto(l.note, 600),
    },
    messaggi: tagliati.map((m) => ({
      chi: m.direction === "inbound" ? "cliente" : "noi",
      testo: String(m.body).trim().slice(0, 2000),
      quando: ORA_ROMA(m.created_at),
      scelto: scelti.has(m.id),
    })),
    orari: corto(typeof p.orari === "string" ? p.orari.replace(/\s+/g, " ") : null, LIMITE_ORARI),
  };
}

/* ── NEL CRM ───────────────────────────────────────────────────────────── */

/** I messaggi da proporre già scelti: quelli del cliente dopo la nostra
 *  ultima risposta (al massimo `MAX_SCELTI`, i più recenti). */
export function sceltiDiPartenza(
  messaggi: { id: string; direction: string; body?: string | null }[],
): string[] {
  const out: string[] = [];
  for (let i = messaggi.length - 1; i >= 0 && out.length < MAX_SCELTI; i--) {
    const m = messaggi[i];
    if (m.direction !== "inbound") break;
    if (m.body?.trim()) out.unshift(m.id);
  }
  return out;
}

/** Il Mac è acceso se ha chiesto lavoro da poco. `null` se non si sa. */
export function pcAcceso(battito: string | null | undefined, adesso: Date): boolean | null {
  const t = Date.parse(String(battito ?? ""));
  if (!Number.isFinite(t)) return null;
  return adesso.getTime() - t < PC_SPENTO_DOPO_S * 1000;
}

/** La frase per un errore consegnato dal Mac. */
export function erroreInChiaro(codice: string | null | undefined): string {
  switch (codice) {
    case "claude_non_trovato":
      return "Sul Mac non trovo Claude: va reinstallato il servizio delle risposte.";
    case "tempo_scaduto":
      return "Claude ci ha messo troppo. Riprova.";
    case "risposta_vuota":
      return "Claude non ha scritto niente. Riprova, magari con un'indicazione.";
    case "messaggi_mancanti":
      return "Non trovo più i messaggi scelti. Ricarica la chat e riprova.";
    case "accesso_claude":
      return "Claude sul Mac non è collegato all'account. Apri Claude sul Mac e accedi.";
    //  «Rispiega con AI» (30/10/2026): vedi ./rispiega.
    case "senza_nostro":
      return "Per rispiegare serve anche almeno un tuo messaggio: scegline uno e riprova.";
    case "troppo_testo":
      return "I messaggi scelti sono troppo lunghi: togline qualcuno e riprova.";
    default:
      return "Il Mac non è riuscito a scrivere la risposta. Riprova.";
  }
}

/* ── ORARI LIBERI NELLA RISPOSTA (idea 6) ──────────────────────────────── */

const GIORNI_BREVI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const MESI_BREVI = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ORA_HHMM = /^\d{1,2}:\d{2}$/;

const dataPiu = (data: string, n: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** «oggi», «domani», «ven 6 nov». */
const giornoBreve = (data: string, oggi: string): string => {
  if (data === oggi) return "oggi";
  if (data === dataPiu(oggi, 1)) return "domani";
  const d = new Date(`${data}T12:00:00Z`);
  return `${GIORNI_BREVI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI_BREVI[d.getUTCMonth()]}`;
};

/** `k` orari sparsi nel giorno (il primo, uno di mezzo, l'ultimo): più scelta che tre orari attaccati. */
const sparsi = (ore: string[], k: number): string[] => {
  if (ore.length <= k) return ore;
  if (k <= 1) return ore.slice(0, 1);
  return Array.from({ length: k }, (_, i) => ore[Math.round((i * (ore.length - 1)) / (k - 1))]);
};

/** Gli orari liberi veri in una riga compatta: «oggi 15:00, 17:30 · domani 10:00 …».
 *  Al massimo `ORARI_MAX` orari e `ORARI_CARATTERI` caratteri, tre per giorno al
 *  massimo. `giorni` è quello di `useGiorniLiberi` (già senza ore passate o
 *  prese); `oggi` è «AAAA-MM-GG». `null` se non c'è nessun orario. */
export function testoOrari(
  giorni: { data: string; fasce: { ora: string }[] }[],
  oggi: string,
  o: { maxOrari?: number; maxCaratteri?: number; perGiorno?: number } = {},
): string | null {
  const maxOrari = o.maxOrari ?? ORARI_MAX;
  const maxCaratteri = o.maxCaratteri ?? ORARI_CARATTERI;
  const perGiorno = o.perGiorno ?? 3;
  if (!DATA_ISO.test(oggi)) return null;
  const parti: string[] = [];
  let n = 0;
  for (const g of Array.isArray(giorni) ? giorni : []) {
    if (n >= maxOrari) break;
    if (!g || !DATA_ISO.test(g.data) || g.data < oggi) continue;
    const ore = (Array.isArray(g.fasce) ? g.fasce : [])
      .map((f) => String(f?.ora ?? "").trim())
      .filter((ora) => ORA_HHMM.test(ora));
    const scelte = sparsi(ore, Math.min(perGiorno, maxOrari - n));
    if (scelte.length === 0) continue;
    const parte = `${giornoBreve(g.data, oggi)} ${scelte.join(", ")}`;
    if ([...parti, parte].join(" · ").length > maxCaratteri) break;
    parti.push(parte);
    n += scelte.length;
  }
  return parti.length ? parti.join(" · ") : null;
}

/** La colonna (o la tabella) non c'è: la migrazione non è applicata. Vale per
 *  Postgres (42703) e per PostgREST (PGRST204) quando si scrive una colonna ignota. */
export function colonnaMancante(errore: { code?: string } | null | undefined): boolean {
  return ["42703", "PGRST204"].includes(String(errore?.code ?? ""));
}

/* ── BOZZE PRONTE SU «DA RISPONDERE» (idea 5) ──────────────────────────── */

/** I campi di `whatsapp_contacts` che servono a scegliere una chat per la bozza. */
export interface ContattoBozza {
  phone_e164: string | null;
  lead_id: string | null;
  ultimo_in_entrata_il: string | null;
  risposto_il: string | null;
  non_scrivere_dal: string | null;
}

const ms = (t: unknown): number => {
  const v = Date.parse(String(t ?? ""));
  return Number.isFinite(v) ? v : NaN;
};

/** Le chat che aspettano una risposta e meritano una bozza: con la scheda, senza
 *  STOP, l'ultimo messaggio del cliente arrivato nelle ultime 24 ore e non
 *  ancora risposto. Dalla più recente, al massimo `BOZZE_CHAT_MAX`. */
export function chatPerBozza(
  contatti: ContattoBozza[],
  adesso: Date,
): { telefono: string; leadId: string }[] {
  const limite = adesso.getTime() - BOZZA_ENTRO_ORE * 3_600_000;
  return contatti
    .filter((c) => {
      const entrata = ms(c.ultimo_in_entrata_il);
      const risposto = ms(c.risposto_il);
      return (
        Boolean(c.phone_e164) &&
        Boolean(c.lead_id) &&
        !c.non_scrivere_dal &&
        Number.isFinite(entrata) &&
        entrata >= limite &&
        entrata <= adesso.getTime() + 60_000 &&
        (!Number.isFinite(risposto) || entrata > risposto)
      );
    })
    .sort((a, b) => ms(b.ultimo_in_entrata_il) - ms(a.ultimo_in_entrata_il))
    .slice(0, BOZZE_CHAT_MAX)
    .map((c) => ({ telefono: String(c.phone_e164), leadId: String(c.lead_id) }));
}

/** I messaggi da rispondere con la bozza: l'ultimo messaggio della chat deve
 *  essere del cliente, con del testo, arrivato nelle ultime 24 ore. Restituisce
 *  gli id (come `sceltiDiPartenza`) e l'ora di quell'ultimo messaggio. */
export function sceltiPerBozza(
  messaggi: MessaggioRiga[],
  adesso: Date,
): { scelti: string[]; ultimoIl: string } | null {
  const ordinati = messaggi
    .filter((m) => Number.isFinite(ms(m.created_at)))
    .sort((a, b) => ms(a.created_at) - ms(b.created_at));
  const ultimo = ordinati.at(-1);
  if (!ultimo || ultimo.direction !== "inbound" || !ultimo.body?.trim()) return null;
  if (adesso.getTime() - ms(ultimo.created_at) > BOZZA_ENTRO_ORE * 3_600_000) return null;
  const scelti = sceltiDiPartenza(ordinati);
  return scelti.length ? { scelti, ultimoIl: ultimo.created_at } : null;
}

/** Ha senso cercare una bozza adesso? Al massimo una ricerca a vuoto ogni `BOZZA_OGNI_S`. */
export function tempoDiCercareBozza(ultimaRicerca: number, adesso: number): boolean {
  return !(adesso - ultimaRicerca < BOZZA_OGNI_S * 1000);
}

export interface BozzaRiga {
  id: string;
  risposta: string | null;
  creata_il: string;
}

/** La bozza automatica da mostrare sopra la casella: `pronta`, non scartata,
 *  più recente dell'ultimo messaggio del cliente e senza una nostra uscita dopo
 *  (se abbiamo già risposto non serve più). La più recente. */
export function bozzaDaMostrare(
  bozze: BozzaRiga[],
  messaggi: { direction: string; created_at: string }[],
  scartate: readonly string[],
): BozzaRiga | null {
  let ultimoCliente = NaN;
  let ultimaNostra = NaN;
  for (const m of messaggi) {
    const t = ms(m.created_at);
    if (!Number.isFinite(t)) continue;
    if (m.direction === "inbound") ultimoCliente = Math.max(ultimoCliente || t, t);
    else ultimaNostra = Math.max(ultimaNostra || t, t);
  }
  if (!Number.isFinite(ultimoCliente)) return null;
  const buone = bozze
    .filter((b) => {
      const t = ms(b.creata_il);
      return (
        Boolean(b.risposta?.trim()) &&
        !scartate.includes(b.id) &&
        Number.isFinite(t) &&
        t > ultimoCliente &&
        (!Number.isFinite(ultimaNostra) || ultimaNostra < t)
      );
    })
    .sort((a, b) => ms(b.creata_il) - ms(a.creata_il));
  return buone[0] ?? null;
}
