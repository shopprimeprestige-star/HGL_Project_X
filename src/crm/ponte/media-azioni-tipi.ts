/** ── PONTE WHATSAPP · MEDIA: LE AZIONI, I TIPI ───────────────────────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T3 (PIANO c.1, c.3, c2,
 *  d.3). Costanti, forme JSON e porte delle azioni sui media: «Mostra» dal
 *  segnaposto (`richiedi`, `media_prendi`, `media_esito`), il timer, «Libera»
 *  (per chiave, per cliente, tutto) e l'hook che libera i media scaduti e
 *  toglie gli orfani. La logica sta in `media-azioni.ts`, le porte vere in
 *  `media-azioni.server.ts`. I permessi e i tipi dei file (`PorteMedia`) sono di
 *  `media-tipi.ts` (T2): qui niente si ripete.
 *
 *  ⚠️ Le porte (tranne `avviso`) LANCIANO `{ code }` se il database o Storage
 *   dicono di no: mai il messaggio d'errore, che può portare numeri o percorsi.
 *  ───────────────────────────────────────────────────────────────────────── */

/** I timer ammessi, in secondi: 5 minuti, 1 ora, 24 ore, 7 giorni, 30 giorni.
 *  «Tieni sempre» è `null`; «Elimina ora» è `libera`. Gli stessi cinque ammette l'SQL. */
export const TIMER_AMMESSI = [300, 3600, 86400, 604800, 2592000] as const;
export type TimerSecondi = (typeof TIMER_AMMESSI)[number];

/** Righe di `ponte_wa_media_richieste` che `media_prendi` consegna al Mac in una volta. */
export const MAX_PRENDI = 5;
/** `media_v` del battito: il Worker sa servire le quattro categorie e «Mostra» (D8). */
export const MEDIA_V = 2;

/** File liberati in un passo di `libera` (≈ 8 sottorichieste: utente, lettura, 5 rimozioni, segnatura). */
export const PASSO_LIBERA = 500;
/** Percorsi per ogni `remove` di Storage. */
export const GRUPPO_REMOVE = 100;
/** Media scaduti per giro dell'hook (uno al minuto). */
export const SCADUTE_PER_GIRO = 200;
/** Oggetti orfani per giro. */
export const ORFANI_PER_GIRO = 100;
/** L'hook non ha memoria: orfani e pulizie si fanno quando il minuto è multiplo di questo. */
export const ORFANI_OGNI_MINUTI = 30;
/** Una `in_corso` più vecchia di così rientra fra le richieste da servire (come nell'SQL). */
export const RICHIESTA_SCADE_MINUTI = 10;

/** Corpo massimo di `POST /api/crm/ponte-media-azione`: 200 chiavi lunghe (≈ 65 caratteri) ci stanno. */
export const CORPO_AZIONE_MAX_BYTE = 16_384;
/** Chiavi al più in una `libera {chiavi}` (la selezione del pannello). */
export const CHIAVI_MAX = 200;

/** Gli esiti con cui il Mac chiude un lavoro richiesto (c2.3). Gli stessi che ammette l'SQL. */
export const ESITI_RICHIESTA = [
  "non_catalogato",
  "scaduta",
  "troppo_grande",
  "tipo",
  "tetto",
  "spenta",
  "errore",
] as const;
export type EsitoRichiesta = (typeof ESITI_RICHIESTA)[number];

/** Codici per i log (`[ponte-media] <codice>` più contatori). Lista chiusa: mai numeri, chiavi, percorsi. */
export type CodiceAvvisoAzioni =
  | "media_prendi"
  | "media_esito"
  | "media_azione"
  | "media_liberati"
  | "media_scadute"
  | "media_orfani"
  | "media_pulizia"
  | "media_percorso"
  | "media_non_valido"
  | "media_database"
  | "media_storage"
  | "media_migrazione";

// ── Le funzioni SQL (jsonb) ───────────────────────────────────────────────

/** `ponte_wa_media_richiedi(p_user_id, p_chiave, p_timer_s)`. */
export interface EsitoRichiediSql {
  esito: "in_attesa" | "gia_pronta" | "non_trovata";
}

/** `ponte_wa_media_timer(p_user_id, p_chiave, p_secondi)`. */
export interface EsitoTimerSql {
  ok: boolean;
  stato: "pronta" | "richiesta" | "assente";
  scade_il?: string | null;
}

/** Una riga da liberare: la chiave e il percorso LETTO DAL DATABASE. */
export interface VoceMedia {
  chiave: string;
  path: string;
}

/** Una riga scaduta (`ponte_wa_media_scadute`). */
export interface ScadutaSql extends VoceMedia {
  user_id: string;
}

// ── Le porte ──────────────────────────────────────────────────────────────

export interface PorteMediaAzioni {
  avviso(codice: CodiceAvvisoAzioni, conteggi?: Record<string, number>): void;
  /** `manychat_config.user_id` (riga `id=1`); null = non configurato. */
  utente(): Promise<string | null>;
  /** Il valore GREZZO di `app_config` per `CHIAVE_INTERRUTTORE`; null = assente. */
  interruttore(): Promise<unknown>;
  /** `ponte_wa_media_richiedi`. */
  richiedi(userId: string, chiave: string, timerS: number | null): Promise<EsitoRichiediSql>;
  /** `ponte_wa_media_prendi`: le chiavi, `in_attesa` → `in_corso`. */
  prendi(userId: string, max: number): Promise<string[]>;
  /** `ponte_wa_media_richiesta_esito`. */
  richiestaEsito(userId: string, chiave: string, esito: EsitoRichiesta): Promise<void>;
  /** Quante richieste aspettano il Mac: `in_attesa` e le `in_corso` da più di 10 minuti. */
  inAttesa(userId: string): Promise<number>;
  /** `ponte_wa_media_timer`. */
  timer(userId: string, chiave: string, secondi: number | null): Promise<EsitoTimerSql>;
  /** `ponte_wa_media_da_liberare`: solo `pronta`, con il percorso del database.
   *  `numero` e `chiavi` nulli insieme = tutto: chi chiama lo sceglie esplicitamente. */
  daLiberare(
    userId: string,
    numero: string | null,
    chiavi: string[] | null,
    limite: number,
  ): Promise<VoceMedia[]>;
  /** Toglie da Storage (SOLO il bucket `ponte-media`) i percorsi già controllati; restituisce i byte
   *  che Storage dichiara tolti (0 se non li dice). Un oggetto già assente non è un errore. */
  rimuovi(paths: string[]): Promise<number>;
  /** `ponte_wa_media_liberato`: segna solo `pronta` con lo stesso `path`; restituisce le righe cambiate. */
  liberato(userId: string, voci: VoceMedia[]): Promise<number>;
  /** `ponte_wa_media_scadute`. */
  scadute(limite: number): Promise<ScadutaSql[]>;
  /** `ponte_wa_media_orfani`: nomi di oggetti del bucket senza riga `pronta` / `in_caricamento`. */
  orfani(limite: number): Promise<string[]>;
  /** `ponte_wa_media_pulizia`: richieste chiuse da più di 7 giorni, `in_caricamento` da più di 3. */
  pulizia(): Promise<void>;
}

// ── Il browser ────────────────────────────────────────────────────────────

/** Che cosa si libera. `chiave` sola = chiunque veda la chat; il resto chiede «impostazioni». */
export type SelezioneLibera =
  | { tipo: "chiave"; chiave: string }
  | { tipo: "chiavi"; chiavi: string[] }
  | { tipo: "numero"; numero: string }
  | { tipo: "tutto" };

export type AzioneBrowser =
  | { azione: "richiedi"; chiave: string; timerS: number | null }
  | { azione: "timer"; chiave: string; timerS: number | null }
  | { azione: "libera"; selezione: SelezioneLibera };

export type MotivoAzione =
  | "non_autorizzato"
  | "permesso"
  | "corpo_non_valido"
  | "corpo_troppo_grande"
  | "spenta"
  | "non_trovata"
  | "migrazione"
  | "storage"
  | "database";

/** Risposta dell'azione: lo stato HTTP e il corpo (`{ ok:true, … }` o `{ ok:false, motivo, … }`). */
export interface RispostaAzione {
  stato: number;
  corpo: Record<string, unknown>;
}

/** Il risultato di un passo di `libera` (e quello che sa il giro dell'hook). */
export interface RisultatoLibera {
  liberati: number;
  byte: number;
  /** quanti restano da liberare dopo questo passo (un minimo: al più `PASSO_LIBERA`); 0 = finito */
  restano: number;
  /** quanti non si sono potuti liberare (Storage o database): il pannello si ferma e lo dice */
  non_riusciti: number;
}
