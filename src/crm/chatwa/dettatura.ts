/** ── LA CHAT WHATSAPP · DETTATURA: REGOLE PURE ─────────────────────────────
 *
 *  Commessa 2026-10-28-chat-dettatura. Si parla, il testo finisce nella casella
 *  (non parte mai da solo). Qui le regole senza React né rete, usate dal
 *  registratore (./Dettatura) e dalla route `/api/crm/dettatura`:
 *  `prove/prove.mjs` le impacchetta con la voce `chatwa/dettatura`, prove in
 *  `prove/manychat/chat-dettatura.mjs`.
 *  ⚠️ NIENTE VOCALI AL CLIENTE: ManyChat non manda audio su WhatsApp via API.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Una registrazione dura al massimo 2 minuti: poi si ferma da sola. */
export const DURATA_MAX_MS = 120_000;
/** E pesa al massimo ~10 MB (2 minuti ne pesano 1-2: è un tetto di sicurezza). */
export const BYTE_MAX = 10 * 1024 * 1024;
/** Il registratore si ferma con un po' di ritardo: tanto di tolleranza sul server. */
const TOLLERANZA_MS = 5_000;
/** Sotto 1 KB non c'è voce (il registratore chiuso subito). */
const BYTE_MIN = 1024;
/** Il dettato più lungo che si mette nella casella (2 minuti parlati ne fanno ~2000). */
const CARATTERI_MAX = 4000;

export type FormatoAudio = "m4a" | "webm" | "ogg" | "mp3" | "wav" | "aac";

/** Il `format` di OpenRouter dal mimeType del registratore: iPhone dà audio/mp4,
 *  Chrome audio/webm, Firefox audio/ogg. Sconosciuto = null (la route rifiuta). */
export function formatoDaMime(mime: string): FormatoAudio | null {
  const tipo = (mime ?? "").split(";")[0].trim().toLowerCase();
  const noti: Record<string, FormatoAudio> = {
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/webm": "webm",
    "video/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/aac": "aac",
  };
  return noti[tipo] ?? null;
}

/** Che cosa chiedere a MediaRecorder, in ordine: il primo che il browser sa fare.
 *  Nessuno = "" (decide il browser, e il mimeType vero si legge dalla registrazione). */
export function mimeDaRegistrare(supportato: (tipo: string) => boolean): string {
  for (const t of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]) {
    try {
      if (supportato(t)) return t;
    } catch {
      return "";
    }
  }
  return "";
}

export type CodiceDettatura =
  | "microfono_negato"
  | "microfono_assente"
  | "non_supportato"
  | "audio_vuoto"
  | "troppo_grande"
  | "troppo_lungo"
  | "formato"
  | "durata"
  | "niente_parlato"
  | "trascrizione"
  | "non_configurata"
  | "sessione"
  | "rete";

/** Il primo motivo per non trascrivere, o null. La dimensione per prima: è il
 *  solo dato che il browser non può falsare (la durata la dichiara lui). */
export function erroreAudio(a: {
  byte: number;
  formato: FormatoAudio | null;
  durataMs: number;
}): CodiceDettatura | null {
  if (a.byte > BYTE_MAX) return "troppo_grande";
  if (a.byte < BYTE_MIN) return "audio_vuoto";
  if (!a.formato) return "formato";
  if (!Number.isFinite(a.durataMs) || a.durataMs < 0) return "durata";
  if (a.durataMs > DURATA_MAX_MS + TOLLERANZA_MS) return "troppo_lungo";
  return null;
}

/** Base64 semplice, senza «data:…;base64,»: è quello che chiede `input_audio.data`.
 *  A pezzi: `String.fromCharCode(...tutto)` su un audio di MB fa saltare lo stack. */
export function base64DaByte(byte: Uint8Array): string {
  let s = "";
  for (let i = 0; i < byte.length; i += 0x8000) {
    s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** Legge il corpo fino a `tetto` byte; oltre, smette e dà null (un corpo enorme
 *  non entra mai tutto in memoria, qualunque cosa dica Content-Length). */
export async function leggiConTetto(
  corpo: ReadableStream<Uint8Array> | null,
  tetto: number,
): Promise<Uint8Array | null> {
  if (!corpo) return new Uint8Array(0);
  const lettore = corpo.getReader();
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.length;
    if (totale > tetto) {
      await lettore.cancel().catch(() => {});
      return null;
    }
    pezzi.push(value);
  }
  const tutto = new Uint8Array(totale);
  let at = 0;
  for (const p of pezzi) {
    tutto.set(p, at);
    at += p.length;
  }
  return tutto;
}

/** Il testo dalla risposta `{ text }`: spazi doppi e tabulazioni via, a capo
 *  tenuti, tetto di lunghezza. Vuoto, errore o forma strana = null. */
export function testoDaRisposta(r: unknown): string | null {
  if (!r || typeof r !== "object") return null;
  const o = r as { text?: unknown; error?: unknown };
  if (o.error || typeof o.text !== "string") return null;
  const t = o.text
    .split("\n")
    .map((riga) => riga.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t ? t.slice(0, CARATTERI_MAX) : null;
}

/** Il dettato si AGGIUNGE alla bozza (mai la sostituisce), in coda. */
export function bozzaConDettato(bozza: string, dettato: string): string {
  const d = dettato.trim();
  if (!d) return bozza;
  if (!bozza.trim()) return d;
  return /\s$/.test(bozza) ? `${bozza}${d}` : `${bozza} ${d}`;
}

/** Da `getUserMedia` che fallisce al nostro codice. */
export function codiceDaErroreMicrofono(nome: string): CodiceDettatura {
  if (nome === "NotAllowedError" || nome === "SecurityError") return "microfono_negato";
  if (nome === "NotFoundError" || nome === "NotReadableError" || nome === "OverconstrainedError")
    return "microfono_assente";
  return "non_supportato";
}

const FRASI: Record<CodiceDettatura, string> = {
  microfono_negato:
    "Microfono negato: consentilo nelle impostazioni del browser, oppure usa il microfono della tastiera.",
  microfono_assente: "Nessun microfono disponibile (o è usato da un'altra app).",
  non_supportato:
    "Questo browser non registra: usa il microfono della tastiera, o apri il CRM in Safari o Chrome.",
  audio_vuoto: "Registrazione troppo breve: parla, poi tocca «Fatto».",
  troppo_grande: "Registrazione troppo grande: massimo 2 minuti.",
  troppo_lungo: "Registrazione troppo lunga: massimo 2 minuti.",
  formato: "Formato audio non riconosciuto: usa il microfono della tastiera.",
  durata: "Trascrizione non riuscita, riprova.",
  niente_parlato: "Non ho sentito parole: riprova più vicino al microfono.",
  trascrizione: "Trascrizione non riuscita, riprova.",
  non_configurata: "Dettatura non configurata: manca la chiave del servizio.",
  sessione: "Sessione scaduta: rientra nel CRM.",
  rete: "Connessione assente: trascrizione non riuscita, riprova.",
};

export function fraseErrore(codice: string): string {
  return FRASI[codice as CodiceDettatura] ?? FRASI.trascrizione;
}
