/** ── PONTE WHATSAPP (Baileys): I CONTRATTI ──────────────────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T0 (PIANO.md §b, §c, §e).
 *  I nomi, le forme e i valori di questo file sono CONGELATI: tutti gli altri
 *  compiti si appoggiano qui e partono in parallelo. Se a un compito manca
 *  qualcosa lo scrive in LAVAGNA; non si cambia da soli.
 *
 *  Tre confini, tre gruppi di tipi:
 *   1. Mac → rotta: il corpo JSON che manda il servizio (`LottoPonte`,
 *      `BattitoPonte`) e le risposte (`RispostaLotto`, `RispostaBattito`,
 *      `RispostaErrore`). Li usano T3 (lettura), T5/T6 (il servizio, in .mjs:
 *      le stesse forme, citate per nome nel JSDoc).
 *   2. Logica → database: le forme JSON dei parametri e dei risultati delle tre
 *      funzioni SQL (obiezione 9 del revisore). T1 le scrive in SQL e le prova
 *      su Postgres vero con questi stessi JSON (`prove/sql/ponte-wa.sql`); T4
 *      le passa alle RPC così come sono, senza rinominare un campo.
 *   3. Logica → porte: `PortePonte`, che T3 usa e T4 implementa.
 *
 *  Puro: nessun import dal database, nessun `fetch`. Le uniche funzioni con
 *  corpo sono `chiaveMessaggio` e `cifre`, che servono identiche a T3 e T4.
 *
 *  ⚠️ Nei log solo codici e contatori (`CodiceAvviso`): mai numeri, nomi, testi,
 *   id WhatsApp, uuid.
 *  ───────────────────────────────────────────────────────────────────────── */

// ── Limiti e finestre ─────────────────────────────────────────────────────

/** I limiti del §b. Il server li applica anche se il ponte li rispetta già. */
export const LIMITI = {
  /** corpo della richiesta, letto a flusso con `leggiCorpoLimitato` (256 KB) */
  corpoByte: 262144,
  /** messaggi per lotto `vivo` */
  messaggi: 200,
  /** messaggi per lotto `storico` */
  messaggiStorico: 50,
  /** caratteri del testo, oltre si tronca */
  testo: 4000,
  /** caratteri di un nome di `nomi` */
  nome: 80,
  /** caratteri dell'`id` WhatsApp (`[A-Za-z0-9_.-]`) */
  id: 128,
  /** voci di `nomi` */
  nomi: 200,
  /** chiavi di `storico` e di `contatori` nel battito, dopo la ripulitura */
  chiaviContatori: 20,
  /** `ts` accettato fino ad adesso + 10 minuti */
  tsOltreMinuti: 10,
  /** caratteri minimi di `PONTE_WA_TOKEN`: sotto, 503 `non_configurato` */
  tokenMinimo: 32,
} as const;

/** Finestra del pari con testo uguale: |ts_ponte − created_at_CRM| ≤ 180 s (§c1.4). */
export const FINESTRA_PARI_S = 180;
/** Finestra del pari «opaco» (il CRM non ha il testo vero): ≤ 120 s (§c1.4-5). */
export const FINESTRA_OPACA_S = 120;
/** Il testo normalizzato si confronta sui primi 1000 caratteri (§c1.5). */
export const CONFRONTO_CARATTERI = 1000;
/** Il controllo tardivo riprende le righe del ponte degli ultimi 60 minuti (§c1.8). */
export const RICONCILIA_MINUTI = 60;
/** D8: un messaggio uscito dal telefono sposta `risposto_il` solo se è degli ultimi 7 giorni. */
export const EFFETTO_MAX_GIORNI = 7;
/** `ts` più vecchio accettato: 1/1/2009 00:00 UTC, in secondi (§b2). */
export const TS_MINIMO = 1230768000;
/** `body` dei candidati, tagliato dall'SQL (§e.5, `ponte_wa_candidati`). */
export const BODY_CANDIDATI = 1200;

/** Valore di `whatsapp_messages.canale` e del lato non cliente
 *  (`from_number` delle uscite, `to_number` delle entrate) delle righe del
 *  ponte; anche `whatsapp_contacts.origine` dei contatti che crea (§0, §e.3). */
export const CANALE_PONTE = "baileys";

/** Versione del corpo JSON (campo `v`): ogni altro valore è 400. */
export const VERSIONE_CORPO = 1;

// ── Parole chiuse ─────────────────────────────────────────────────────────

export type Origine = "storico" | "vivo";
/** `in` = cliente → noi; `out` = uscito dal nostro numero (qualunque dispositivo). */
export type Direzione = "in" | "out";

export const TIPI_CONTENUTO = [
  "testo",
  "foto",
  "vocale",
  "audio",
  "video",
  "documento",
  "sticker",
  "posizione",
  "contatto",
  "altro",
] as const;
export type TipoContenuto = (typeof TIPI_CONTENUTO)[number];

/** Stato di un messaggio `out` (§b2). Un `in` si scrive sempre `delivered`,
 *  come fanno le entrate di ManyChat e del webhook Cloud. */
export const STATI_INVIO = ["sent", "delivered", "read", "failed"] as const;
export type StatoInvio = (typeof STATI_INVIO)[number];

/** Lista chiusa degli stati del ponte (§b3). Fuori lista → `errore`. */
export const STATI_PONTE = [
  "collegato",
  "in_collegamento",
  "attesa_qr",
  "sessione_scaduta",
  "sostituita",
  "rete_assente",
  "coda_piena",
  "errore",
  "fermo",
] as const;
export type StatoPonteWa = (typeof STATI_PONTE)[number];

// ── 1. Mac → rotta (`POST /api/public/ponte-whatsapp`, §b) ────────────────

/** Un messaggio, già estratto dal ponte (`estrai.mjs`). */
export interface MessaggioPonte {
  /** `key.id` di WhatsApp, 1-128 caratteri `[A-Za-z0-9_.-]` */
  id: string;
  /** solo cifre, 8-15, internazionale senza «+», mai un `@lid` */
  numero: string;
  dir: Direzione;
  /** secondi UNIX interi (orario vero di WhatsApp, `messageTimestamp`) */
  ts: number;
  /** testo o segnaposto del media (§b4) */
  testo: string;
  tipo: TipoContenuto;
  /** solo per `out`; di serie `sent` */
  stato?: StatoInvio;
}

/** Corpo di un lotto. `nomi`: cifre → nome come lo conosce WhatsApp. */
export interface LottoPonte {
  v: 1;
  tipo: "lotto";
  origine: Origine;
  messaggi: MessaggioPonte[];
  nomi?: Record<string, string>;
}

/** Corpo del battito (ogni 60 s), come lo manda il ponte. Il QR non c'è mai.
 *  `storico` porta anche un booleano (`{ fatto: true, avanzamento: 100 }`): il
 *  server lo riduce a numeri (vedi `BattitoPulito`). */
export interface BattitoPonte {
  v: 1;
  tipo: "battito";
  stato: StatoPonteWa;
  /** ISO 8601 */
  collegato_dal?: string | null;
  /** ISO 8601 */
  ultimo_messaggio_il?: string | null;
  storico?: Record<string, number | boolean>;
  in_coda?: number;
  scartati?: number;
  contatori?: Record<string, number>;
  /** versione di Baileys, es. `7.0.0-rc14` */
  versione?: string;
}

/** Il battito dopo `leggiBattito` (T3), cioè la riga che `PortePonte.battito`
 *  scrive in `ponte_wa_stato` (T4). Ripulitura (§b3): `stato` fuori lista →
 *  `errore`; in `storico` e `contatori` solo numeri finiti (un booleano vale
 *  1 o 0, il resto si scarta), chiavi di sole lettere minuscole e `_`, al più
 *  `LIMITI.chiaviContatori` ciascuno; `in_coda` e `scartati` finiscono dentro
 *  `contatori`; date non valide → null; `versione` al più 40 caratteri. */
export interface BattitoPulito {
  stato: StatoPonteWa;
  collegato_dal: string | null;
  ultimo_messaggio_il: string | null;
  storico: Record<string, number>;
  contatori: Record<string, number>;
  versione: string | null;
}

/** Codici di errore della rotta e loro stato HTTP (§b1). */
export const ERRORI_HTTP = {
  non_configurato: 503,
  non_autorizzato: 401,
  troppo_grande: 413,
  corpo_non_valido: 400,
  database: 500,
} as const;
export type CodiceErrore = keyof typeof ERRORI_HTTP;

export interface RispostaErrore {
  ok: false;
  errore: CodiceErrore;
}

/** Risposta 200 a un lotto (§b2). `non_noti`: solo per i lotti `vivo`, gli
 *  `id` WhatsApp da ritentare (D7); per lo `storico` è sempre `[]` e i non noti
 *  si contano in `fuori_rubrica`. `doppioni` = righe scritte con un pari. */
export interface RispostaLotto {
  ok: true;
  ricevuti: number;
  nuovi: number;
  gia_presenti: number;
  doppioni: number;
  scartati: number;
  fuori_rubrica: number;
  non_noti: string[];
}

/** Risposta 200 a un battito: `riconciliati` = pari tardivi trovati (§c1.8). */
export interface RispostaBattito {
  ok: true;
  riconciliati: number;
}

// ── 2. Logica → database: le forme JSON delle tre funzioni SQL (§e.5) ─────
//
//  Le chiavi sono di una lettera apposta (lotti da 200 righe dentro un jsonb):
//  T1 le legge con `->>` esattamente con questi nomi, T4 le passa così.

/** `wa_message_id` di una riga del ponte (§b5): `bw:<cifre>:<id WhatsApp>`. */
export function chiaveMessaggio(numero: string, id: string): string {
  return `bw:${numero}:${id}`;
}

/** Solo le cifre di un numero (`+39 333…` → `39333…`): la regola unica per
 *  confrontare il cliente (§c1.2). */
export function cifre(numero: string | null | undefined): string {
  return (numero ?? "").replace(/\D/g, "");
}

/** Una voce di `p_righe` di `ponte_wa_scrivi`. NON porta `duplicato_di`: il
 *  pari arriva solo da `p_pari` (con la stessa `k`), così la regola
 *  `unique_violation` → riga visibile e `pari_persi` (§e.5) sta in un punto. */
export interface RigaScrittura {
  /** `chiaveMessaggio(n, id)` → `wa_message_id` */
  k: string;
  /** cifre del cliente, senza «+»; l'SQL scrive `'+' || n` nel lato cliente */
  n: string;
  /** `in` → `inbound`, `from_number='+'||n`, `to_number='baileys'`;
   *  `out` → `outbound`, `from_number='baileys'`, `to_number='+'||n` */
  d: Direzione;
  /** secondi UNIX → `created_at = to_timestamp(t)` */
  t: number;
  /** testo già ripulito e tagliato (`body`) */
  x: string;
  /** D8: `vivo` + `out` + senza pari + `t` entro `EFFETTO_MAX_GIORNI` → porta
   *  avanti `risposto_il` del contatto, solo se la riga è inserita adesso */
  e: boolean;
  /** `media_type`: il tipo se non è `testo`, altrimenti null */
  m: Exclude<TipoContenuto, "testo"> | null;
  /** `status`: per `in` sempre `delivered`, per `out` lo stato (di serie `sent`) */
  s: StatoInvio;
}

/** Un pari (§c1.7): la riga del ponte `k` è il doppione della riga CRM `crm`.
 *  È anche la voce di `p_pari`. Uscita di `abbinaPari` (T3). */
export interface Pari {
  k: string;
  /** uuid della riga CRM (`whatsapp_messages.id`) */
  crm: string;
}

/** `p_nomi`: cifre → nome. L'SQL lo usa solo se il contatto non ha già un nome. */
export type NomiScrittura = Record<string, string>;

/** Cosa riceve `PortePonte.scrivi`: T4 lo passa come `p_righe`, `p_pari`,
 *  `p_nomi`. Il controllo tardivo manda `righe: []`, `nomi: {}` e solo `pari`. */
export interface Scrittura {
  righe: RigaScrittura[];
  pari: Pari[];
  nomi: NomiScrittura;
}

/** Uscita di `ponte_wa_scrivi` (jsonb, solo interi ≥ 0):
 *  `nuovi` righe inserite; `gia_presenti` righe già nel database (stessa `k`);
 *  `doppioni` righe che ora hanno `duplicato_di` (inserite col pari o
 *  aggiornate da `p_pari`); `pari_persi` pari non scritti per
 *  `unique_violation` (candidato preso da un'altra richiesta: riga visibile);
 *  `contatti_nuovi` contatti creati (`origine='baileys'`); `risposto` contatti
 *  con `risposto_il` portato avanti (D8). */
export interface EsitoScrittura {
  nuovi: number;
  gia_presenti: number;
  doppioni: number;
  pari_persi: number;
  contatti_nuovi: number;
  risposto: number;
}

/** Una voce di `p_righe` di `ponte_wa_candidati`: chiave, cifre, direzione,
 *  secondi. È un sottoinsieme di `RigaScrittura`. */
export interface RichiestaCandidato {
  k: string;
  n: string;
  d: Direzione;
  t: number;
}

/** Una riga restituita da `ponte_wa_candidati` (§c1.1-4): riga CRM dello
 *  stesso utente e cliente, stessa direzione, entro `FINESTRA_PARI_S`, `canale`
 *  diverso da `baileys`, `duplicato_di` vuoto, `status` diverso da `failed`,
 *  non già presa. `k` dice per quale richiesta è candidata (una riga CRM può
 *  tornare per più `k`: l'uno a uno lo decide `abbinaPari`). */
export interface CandidatoCrm {
  k: string;
  id: string;
  /** ISO 8601, come lo restituisce PostgREST */
  created_at: string;
  direction: "inbound" | "outbound";
  /** tagliato a `BODY_CANDIDATI` caratteri; può essere null */
  body: string | null;
  canale: string | null;
}

/** `ponte_wa_noti(p_user_id, p_numeri text[]) returns text[]`: entrano e
 *  escono solo cifre (D7). */
export type NumeriNoti = string[];

/** Una riga del ponte da riabbinare (controllo tardivo, §c1.8), letta da
 *  `PortePonte.recentiDelPonte`; è anche l'ingresso di `abbinaPari`. `m` null =
 *  testo (come `media_type`). */
export type RigaDaAbbinare = Pick<RigaScrittura, "k" | "n" | "d" | "t" | "x" | "m">;

// ── 3. Logica → porte (T3 le usa, T4 le implementa) ───────────────────────

/** Codici per i log (`[ponte-wa] <codice>` più contatori). Lista chiusa. */
export const CODICI_AVVISO = [
  "non_configurato",
  "segreto_corto",
  "non_autorizzato",
  "troppo_grande",
  "corpo_non_valido",
  "database",
  "funzioni_assenti",
  "lotto",
  "battito",
  "riconciliati",
  "pari_persi",
] as const;
export type CodiceAvviso = (typeof CODICI_AVVISO)[number];

/** Le porte del ponte. Ogni porta che fallisce lancia `{ code }` (il codice
 *  di Postgres o di PostgREST), mai il messaggio d'errore: chi chiama risponde
 *  500 `database`. */
export interface PortePonte {
  /** `manychat_config.user_id` (riga `id=1`); null = non configurato (503).
   *  L'utente non arriva mai dal corpo. */
  utente(): Promise<string | null>;
  /** `ponte_wa_noti`: dei `numeri` (cifre) quelli che il CRM conosce. */
  noti(userId: string, numeri: string[]): Promise<NumeriNoti>;
  /** `ponte_wa_candidati`, `p_righe` = `righe`. */
  candidati(userId: string, righe: RichiestaCandidato[]): Promise<CandidatoCrm[]>;
  /** `ponte_wa_scrivi`, una transazione. */
  scrivi(userId: string, scrittura: Scrittura): Promise<EsitoScrittura>;
  /** Le righe `canale='baileys'` con `duplicato_di` vuoto e `created_at ≥ dal`
   *  (di solito adesso − `RICONCILIA_MINUTI`). */
  recentiDelPonte(userId: string, dal: Date): Promise<RigaDaAbbinare[]>;
  /** Upsert della riga dell'utente in `ponte_wa_stato` (`aggiornato_il = now()`). */
  battito(userId: string, b: BattitoPulito): Promise<void>;
  /** Una riga di log: solo il codice e, se servono, contatori numerici. */
  avviso(codice: CodiceAvviso, conteggi?: Record<string, number>): void;
}
