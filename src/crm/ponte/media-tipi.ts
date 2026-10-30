/** ── PONTE WHATSAPP · LE IMMAGINI: I CONTRATTI ──────────────────────────────
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T5 (PIANO c.3, c.4). Le
 *  forme che il Mac (T6), il server (`media.ts`, `media.server.ts`) e la
 *  migrazione (T4) si scambiano. Il Worker non vede mai i byte di una foto:
 *  dà al Mac un permesso con un indirizzo di carico firmato, il Mac carica su
 *  Storage da solo e poi dice «fatto».
 *
 *  Puro: nessun database, nessun `fetch`, nessun log.
 *
 *  ⚠️ Nei log solo codici e contatori: mai numeri, chiavi, percorsi, indirizzi.
 *  ───────────────────────────────────────────────────────────────────────── */

// ── Limiti e nomi ─────────────────────────────────────────────────────────

/** Una foto pesa al più 8 MiB (anche il bucket ha lo stesso limite). */
export const MEDIA_MAX_BYTE = 8 * 1024 * 1024;

/** Solo questi tipi: mai SVG né HTML (il bucket li rifiuta comunque). */
export const MEDIA_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** Perché il Worker rifiuta una foto, come lo dice al Mac. `spenta` e `tetto`
 *  sono passeggeri (il Mac trattiene il lavoro), gli altri definitivi. */
export const MOTIVI_RIFIUTO_MEDIA = ["spenta", "tetto", "troppo_grande", "tipo"] as const;
export type MotivoRifiutoMedia = (typeof MOTIVI_RIFIUTO_MEDIA)[number];

/** Il bucket privato di Storage (lo crea la migrazione di T4). */
export const BUCKET_MEDIA = "ponte-media";

/** La riga di `app_config` con l'interruttore: testo `{"acceso":false,"tettoGB":0.8}`. */
export const CHIAVE_INTERRUTTORE = "ponte_immagini";
export const TETTO_GB_DI_SERIE = 0.8;

/** Quanto vale il link di lettura che il browser riceve. */
export const FIRMA_LETTURA_S = 300;

/** `bw:<cifre del numero>:<id WhatsApp>`: la stessa di `chiaveMessaggio` (`tipi.ts`). */
export const CHIAVE_MEDIA = /^bw:(\d{8,15}):([A-Za-z0-9_.-]{1,128})$/;

// ── Mac → server (estende `POST /api/public/ponte-whatsapp`) ───────────────

export interface CorpoMediaPermesso {
  v: 1;
  tipo: "media_permesso";
  chiave: string;
  mime: string;
  /** il peso dichiarato dal Mac: serve a rifiutare presto, non è la verità */
  byte: number;
}

export interface CorpoMediaFatto {
  v: 1;
  tipo: "media_fatto";
  chiave: string;
}

/** Risposta a `media_permesso`. `carica`: il Mac scarica da WhatsApp e fa un
 *  PUT su `url_carico`; `gia_presente`: niente da fare; `rifiutato`: vedi
 *  `MOTIVI_RIFIUTO_MEDIA`. */
export type RispostaMediaPermesso =
  | { ok: true; esito: "carica"; url_carico: string }
  | { ok: true; esito: "gia_presente" }
  | { ok: true; esito: "rifiutato"; motivo: MotivoRifiutoMedia };

/** Risposta a `media_fatto`: `pronta` = Storage ha l'oggetto e la riga è chiusa;
 *  `in_caricamento` = Storage non lo vede ancora (il Mac riprova); `assente` =
 *  nessun permesso per quella chiave. */
export type RispostaMediaFatto = { ok: true; esito: "pronta" | "in_caricamento" | "assente" };

/** Errori HTTP delle due richieste: `migrazione` = funzione o tabella assente
 *  (il Mac trattiene); `database` = guasto (il Mac ritenta). */
export type ErroreMedia = "corpo_non_valido" | "migrazione" | "database";

// ── Le funzioni SQL di T4 (jsonb) ─────────────────────────────────────────

/** `ponte_wa_media_permesso(p_user_id, p_chiave, p_numero, p_mime, p_byte,
 *  p_tetto_byte)`. `path` è il percorso scelto dal database (nome casuale,
 *  senza il numero). */
export type EsitoPermessoSql =
  | { esito: "carica"; path: string }
  | { esito: "gia_presente" }
  | { esito: "rifiutato"; motivo: "tetto" | "troppo_grande" | "tipo" };

/** `ponte_wa_media_fatto(p_user_id, p_chiave)`: il peso lo legge da Storage. */
export interface EsitoFattoSql {
  stato: "pronta" | "in_caricamento" | "assente";
}

// ── L'interruttore ────────────────────────────────────────────────────────

export interface Interruttore {
  acceso: boolean;
  tettoGB: number;
}

// ── Browser → server (`GET /api/crm/ponte-media?chiave=bw:…`) ──────────────

export type MotivoLettura =
  | "non_autorizzato"
  | "chiave_non_valida"
  | "non_trovata"
  | "database"
  | "migrazione";

export interface RispostaLettura {
  stato: number;
  corpo: { ok: true; url: string } | { ok: false; motivo: MotivoLettura };
}

// ── Le porte ──────────────────────────────────────────────────────────────

/** Codici per i log (`[ponte-media] <codice>` più contatori). Lista chiusa. */
export type CodiceAvvisoMedia =
  | "media_permesso"
  | "media_rifiutato"
  | "media_fatto"
  | "media_lettura"
  | "media_non_valido"
  | "media_database"
  | "media_migrazione";

/** Le porte dei media (`media.server.ts` le implementa, `media.ts` le usa).
 *  Tutte tranne `avviso` LANCIANO `{ code }` se il database dice di no: mai il
 *  messaggio d'errore, che può contenere numeri o percorsi. */
export interface PorteMedia {
  /** `manychat_config.user_id` (riga `id=1`); null = non configurato. */
  utente(): Promise<string | null>;
  /** Il valore GREZZO di `app_config` per `CHIAVE_INTERRUTTORE`; null = assente. */
  interruttore(): Promise<unknown>;
  /** `ponte_wa_media_permesso`. */
  permesso(
    userId: string,
    p: { chiave: string; numero: string; mime: string; byte: number; tettoByte: number },
  ): Promise<EsitoPermessoSql>;
  /** URL di carico firmato (Storage, senza `upsert`) per `path`. */
  firmaCarico(path: string): Promise<string>;
  /** `ponte_wa_media_fatto`. */
  fatto(userId: string, chiave: string): Promise<EsitoFattoSql>;
  /** Il percorso di una riga `pronta` di QUESTO utente; null = non c'è. */
  percorsoPronto(userId: string, chiave: string): Promise<string | null>;
  /** Link di lettura a tempo; null = l'oggetto non c'è in Storage. */
  firmaLettura(path: string, secondi: number): Promise<string | null>;
  /** Una riga di log: solo il codice e, se servono, contatori numerici. */
  avviso(codice: CodiceAvvisoMedia, conteggi?: Record<string, number>): void;
}
