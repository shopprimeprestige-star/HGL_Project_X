/** ── «RISPIEGA CON AI»: LE REGOLE ────────────────────────────────────────────
 *
 *  Richiesta del titolare (30/10/2026): quando un cliente non capisce una
 *  risposta, si sceglie nella chat la NOSTRA risposta e una o più domande del
 *  cliente, e il Mac scrive una nuova spiegazione, più semplice e chiara, che
 *  va nella casella come bozza. Stessa strada di «Rispondi con AI» (riga in
 *  `wa_risposte_ai`, servizio sul Mac), con `modo = 'rispiega'` e un prompt suo.
 *  ⚠️ LA BOZZA NON SI INVIA MAI DA SOLA, e la finestra di 24 ore non cambia.
 *  ⚠️ Al modello vanno SOLO i testi scelti e il nome: niente telefono, email,
 *   note, stato, orari né messaggi non scelti (`lavoroRispiega`).
 *  Regole pure, usate dal CRM (scelta) e dalla rotta del Mac (lavoro): provate
 *  in prove/idee/rispiega.mjs. Il prompt sta in strumenti/risposte-ai/src.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "@/crm/types";
import type { MessaggioRiga } from "./regole";

/** Quante bolle si possono scegliere (la tabella ne accetta fino a 8). */
export const MAX_RISPIEGA = 8;
/** Il testo di tutte le bolle scelte, insieme: oltre, la richiesta è troppo lunga per una bozza breve. */
export const CARATTERI_MAX_RISPIEGA = 4000;

/** Ciò che serve sapere di un messaggio per sceglierlo. */
export interface MessaggioScelta {
  id: string;
  direction: string;
  body?: string | null;
  created_at?: string;
}

/** Una bolla con testo vero. Un modello salvato come «[template:nome]» o un
 *  «[messaggio senza testo]» (reazione, sticker, posizione) non è ciò che ha letto il cliente. */
export function selezionabile(m: Pick<MessaggioScelta, "body">): boolean {
  const t = typeof m.body === "string" ? m.body.trim() : "";
  return t !== "" && !/^\[(template:|messaggio senza testo)/i.test(t);
}

/** Un tocco: aggiunge la bolla in fondo o la toglie. Al massimo non ne aggiunge altre. */
export function commuta(scelti: readonly string[], id: string, max = MAX_RISPIEGA): string[] {
  if (scelti.includes(id)) return scelti.filter((x) => x !== id);
  return scelti.length >= max ? [...scelti] : [...scelti, id];
}

export type MotivoNo = "vuota" | "senza_nostro" | "mancanti" | "troppi" | "troppo_testo";
export type Controllo = { ok: true; ids: string[] } | { ok: false; motivo: MotivoNo };

const quando = (m: MessaggioScelta) => {
  const t = Date.parse(String(m.created_at ?? ""));
  return Number.isFinite(t) ? t : 0;
};

/** La scelta si può mandare? Almeno una bolla NOSTRA (è lei da rispiegare), tutte con
 *  testo e presenti, entro il massimo e il tetto di caratteri. `ids` esce in ordine di chat. */
export function controllaScelta(
  scelti: readonly string[],
  messaggi: readonly MessaggioScelta[],
  o: { max?: number; caratteri?: number } = {},
): Controllo {
  if (scelti.length === 0) return { ok: false, motivo: "vuota" };
  if (scelti.length > (o.max ?? MAX_RISPIEGA)) return { ok: false, motivo: "troppi" };
  const voluti = new Set(scelti);
  const trovati = messaggi.filter((m) => voluti.has(m.id));
  if (trovati.length !== voluti.size || !trovati.every(selezionabile))
    return { ok: false, motivo: "mancanti" };
  if (!trovati.some((m) => m.direction !== "inbound")) return { ok: false, motivo: "senza_nostro" };
  const caratteri = trovati.reduce((n, m) => n + String(m.body).trim().length, 0);
  if (caratteri > (o.caratteri ?? CARATTERI_MAX_RISPIEGA))
    return { ok: false, motivo: "troppo_testo" };
  //  Stabile: a parità di ora resta l'ordine in cui arrivano.
  const ordinati = trovati
    .map((m, i) => ({ m, i }))
    .sort((a, b) => quando(a.m) - quando(b.m) || a.i - b.i);
  return { ok: true, ids: ordinati.map((x) => x.m.id) };
}

/** La frase per il titolare. */
export function fraseControllo(motivo: MotivoNo): string {
  switch (motivo) {
    case "vuota":
      return "Tocca le bolle da rispiegare: la tua risposta e le domande del cliente.";
    case "senza_nostro":
      return "Scegli anche almeno un tuo messaggio: è quello che l'AI rispiega.";
    case "troppi":
      return `Hai scelto troppe bolle: il massimo è ${MAX_RISPIEGA}.`;
    case "troppo_testo":
      return "I messaggi scelti sono troppo lunghi: togline qualcuno e riprova.";
    case "mancanti":
    default:
      return "Non trovo più alcuni messaggi scelti, o non hanno testo. Ricarica la chat e riprova.";
  }
}

/* ── IL LAVORO PER IL MAC ──────────────────────────────────────────────── */

export interface LavoroRispiega {
  id: string;
  modo: "rispiega";
  /** Solo il nome del cliente (o vuoto): niente altro dalla scheda. */
  nome: string;
  /** Solo i messaggi scelti, dal più vecchio. Niente ora né id. */
  messaggi: { chi: "cliente" | "noi"; testo: string }[];
}

/** Cosa riceve il Mac per «rispiega»: i testi scelti e il nome. Errore con un codice
 *  breve (lo scrive la rotta in `wa_risposte_ai.errore`, `erroreInChiaro` lo traduce). */
export function lavoroRispiega(p: {
  id: string;
  scelti: readonly string[];
  messaggi: readonly MessaggioRiga[];
  lead?: Partial<LeadData> | null;
}): { lavoro: LavoroRispiega } | { errore: "messaggi_mancanti" | "senza_nostro" | "troppo_testo" } {
  const k = controllaScelta(p.scelti, p.messaggi);
  if (!k.ok) {
    //  «vuota» e «troppi» non arrivano dalla tabella (1-8 messaggi): se capitasse, mancano.
    return {
      errore:
        k.motivo === "senza_nostro" || k.motivo === "troppo_testo" ? k.motivo : "messaggi_mancanti",
    };
  }
  const per = new Map(p.messaggi.map((m) => [m.id, m]));
  const nome =
    typeof p.lead?.nome === "string" ? p.lead.nome.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  return {
    lavoro: {
      id: p.id,
      modo: "rispiega",
      nome,
      messaggi: k.ids.map((id) => {
        const m = per.get(id)!;
        return {
          chi: m.direction === "inbound" ? ("cliente" as const) : ("noi" as const),
          testo: String(m.body).trim(),
        };
      }),
    },
  };
}
