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
    default:
      return "Il Mac non è riuscito a scrivere la risposta. Riprova.";
  }
}
