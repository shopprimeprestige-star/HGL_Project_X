/** ── PONTE WHATSAPP · INVIO A MANO DOPO LE 24 ORE: I CONTRATTI ───────────────
 *
 *  Commessa 2026-10-30-ponte-invio-manuale, compito T0 (PIANO.md §3.1, §4.1).
 *  I nomi, le forme e i valori di questo file sono CONGELATI: server, Mac e chat
 *  si appoggiano qui. Se a un compito manca qualcosa lo scrive in LAVAGNA; non
 *  si cambia da soli (una prova in `prove/ponte/invio-scheletro.mjs` li guarda).
 *
 *  Il giro: il browser mette un testo in coda (`ponte_wa_invii`), il battito
 *  del ponte dice quante righe aspettano, il Mac le prende (`prendi`), manda
 *  col suo collegamento e riporta l'esito (`esito`).
 *
 *  Puro: nessun database, nessun `fetch`. Le regole stanno in `invio.ts`.
 *
 *  ⚠️ Nei log solo codici e contatori: mai testo dei messaggi, numeri, nomi, id.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { RispostaBattito } from "./tipi";

// ── Limiti ────────────────────────────────────────────────────────────────

/** I numeri contro il blocco, in un solo posto. Il server li passa come
 *  parametri alla funzione SQL `ponte_wa_invii_prendi`; il Mac ha la sua copia
 *  in `.mjs` (doppia guardia) e una prova confronta le due.
 *  `ponteFrescoMs` è uguale a `SOGLIA_BATTITO_MS` di `chatwa/avvisoPonte.ts`
 *  (la prova lo controlla: qui non si importa la chat). */
export const LIMITI_INVIO = {
  /** caratteri del testo (punti di codice, come `char_length` in SQL) */
  caratteri: 2000,
  /** secondi fra un prelievo e il successivo */
  intervalloS: 20,
  /** prelievi nelle ultime `giornoOre` ore */
  alGiorno: 20,
  /** minuti oltre i quali una riga `in_attesa` non parte più */
  scadenzaMin: 10,
  /** minuti oltre i quali una riga `in_invio` diventa «non so se è partito» */
  incertoMin: 3,
  /** righe aperte (`in_attesa` o `in_invio`) al più */
  inCodaMax: 3,
  chiaveMin: 8,
  chiaveMax: 64,
  /** battito più vecchio di così: il ponte non risponde */
  ponteFrescoMs: 180_000,
  /** una riga `inviato` resta in vista al più questi secondi */
  nascostoDopoS: 90,
  giornoOre: 24,
  /** le righe terminate più vecchie di così si cancellano (all'accodamento) */
  retentionGiorni: 30,
} as const;

// ── Parole chiuse ─────────────────────────────────────────────────────────

export const STATI_CODA = ["in_attesa", "in_invio", "inviato", "non_inviato"] as const;
export type StatoCoda = (typeof STATI_CODA)[number];

/** Perché una riga è `non_inviato` (si salva in `ponte_wa_invii.motivo`). */
export const MOTIVI_INVIO = [
  "mai_scritto",
  "stop",
  "scaduto",
  "non_collegato",
  "numero_non_valido",
  "testo_non_valido",
  "limite_ponte",
  "esito_incerto",
  "errore_invio",
] as const;
export type MotivoInvio = (typeof MOTIVI_INVIO)[number];

/** Perché il server rifiuta subito (non si salva niente, risposta al browser). */
export const MOTIVI_RIFIUTO = [
  "testo_vuoto",
  "testo_lungo",
  "numero_non_valido",
  "ponte_non_collegato",
  "invii_spenti",
  "mai_scritto",
  "stop",
  "limite_giornaliero",
  "coda_piena",
  "non_autorizzato",
  "non_riprovabile",
] as const;
export type MotivoRifiuto = (typeof MOTIVI_RIFIUTO)[number];

// ── La coda (database) ────────────────────────────────────────────────────

/** Una riga di `ponte_wa_invii`, con le colonne che la lettura chiede. */
export interface RigaCoda {
  id: string;
  /** scelta dal browser, 8-64 caratteri `[A-Za-z0-9_-]` (idempotenza) */
  chiave: string;
  /** solo cifre, 8-15 */
  numero: string;
  testo: string;
  stato: StatoCoda;
  /** solo con `non_inviato`: un valore di `MOTIVI_INVIO` */
  motivo: string | null;
  /** ISO 8601 */
  created_at: string;
  preso_il: string | null;
  inviato_il: string | null;
  /** id WhatsApp, solo dopo l'invio */
  wa_message_id: string | null;
}

/** Uscita di `ponte_wa_invio_fatti(p_user_id, p_numero)` (jsonb). `entrata` =
 *  il cliente ci ha scritto almeno una volta (qualunque canale); `stop` = ha
 *  chiesto di non essere contattato; `ponte_*` dalla riga di `ponte_wa_stato`;
 *  `invii_attivi` = il Mac ha dichiarato `INVII_ATTIVI=1`; `ultime24h` =
 *  prelievi nelle ultime 24 ore; `in_coda` = righe `in_attesa` o `in_invio`. */
export interface FattiInvio {
  entrata: boolean;
  stop: boolean;
  ponte_stato: string | null;
  /** ISO 8601 dell'ultimo battito */
  ponte_battito: string | null;
  invii_attivi: boolean;
  ultime24h: number;
  in_coda: number;
}

/** Uscita di `ponte_wa_invii_prendi` (jsonb). `invio` è la riga appena portata
 *  a `in_invio`; `attendi_s` quanto il Mac deve aspettare prima di richiedere
 *  (0 = coda vuota); `limite` = si è fermato il tetto giornaliero. */
export interface EsitoPrendi {
  invio: { id: string; numero: string; testo: string } | null;
  attendi_s: number;
  limite: boolean;
  scaduti: number;
  incerti: number;
  respinti: number;
}

/** Uscita di `ponte_wa_invio_esito` (jsonb). `ok:false` = riga assente o in uno
 *  stato che non accetta l'esito; `nuovo:false` = era già così (ripetizione). */
export interface EsitoEsitoSql {
  ok: boolean;
  stato: StatoCoda | null;
  nuovo: boolean;
}

// ── Browser → server (`POST /api/crm/ponte-invio`) ────────────────────────

export type RichiestaBrowser =
  | { azione: "accoda"; numero: string; testo: string; chiave: string }
  | { azione: "riprova"; id: string; confermaIncerto?: boolean };

// ── Mac → server (estende `POST /api/public/ponte-whatsapp`) ──────────────

export interface CorpoPrendi {
  v: 1;
  tipo: "prendi";
}

export interface CorpoEsito {
  v: 1;
  tipo: "esito";
  id: string;
  esito: "inviato" | "errore";
  /** id WhatsApp (`key.id`): obbligatorio con `inviato` */
  wa_id?: string;
  /** secondi UNIX dell'invio, se il Mac li sa */
  ts?: number;
  /** solo con `errore`: un valore di `MOTIVI_INVIO` */
  motivo?: string;
}

export interface RispostaPrendi {
  ok: true;
  invio: { id: string; numero: string; testo: string } | null;
  attendi_s: number;
  limite: boolean;
}

export interface RispostaEsito {
  ok: true;
  stato: StatoCoda;
}

/** Il battito, se la richiesta ha la porta `invii`: porta anche quante righe
 *  aspettano. `RispostaBattito` di `tipi.ts` NON cambia. */
export type RispostaBattitoInvii = RispostaBattito & { invii_in_attesa: number };

// ── Le porte (T5 le implementa, `invio-giro.ts` le usa) ───────────────────

/** Codici per i log (`[ponte-invio] <codice>` più contatori). Lista chiusa. */
export type CodiceAvvisoInvio =
  | "invio_accodato"
  | "invio_prelevato"
  | "invio_esito"
  | "invio_rifiutato"
  | "invio_database"
  | "invio_migrazione";

/** Le porte della coda. Quelle di scrittura/lettura della coda lanciano
 *  `{ code }` su errore del database (mai il messaggio). **`inviatiDalCrm` e
 *  `inAttesa` NON LANCIANO MAI**: su qualunque errore (tabella assente,
 *  permessi, rete) tornano `[]` / `0`, con un solo avviso per processo
 *  (`invio_migrazione`), così il ponte già online procede come oggi. */
export interface PorteInvio {
  /** `manychat_config.user_id`; null = non configurato. */
  utente(): Promise<string | null>;
  /** `ponte_wa_invio_fatti`. */
  fatti(userId: string, numero: string): Promise<FattiInvio>;
  /** Mette in coda (idempotente sulla `chiave`) e pulisce le righe terminate
   *  più vecchie di `retentionGiorni`. */
  accoda(
    userId: string,
    r: { chiave: string; numero: string; testo: string; creato_da: string },
  ): Promise<{ id: string; stato: StatoCoda; nuovo: boolean }>;
  riga(userId: string, id: string): Promise<RigaCoda | null>;
  /** `UPDATE` condizionato sulla stessa riga (D10); `null` = la riga non c'è. */
  riprova(
    userId: string,
    id: string,
    confermaIncerto: boolean,
  ): Promise<{ stato: StatoCoda | null }>;
  /** `ponte_wa_invii_prendi` con `LIMITI_INVIO` come parametri. */
  prendi(userId: string): Promise<RispostaPrendi>;
  /** `ponte_wa_invio_esito`; `null` = la riga non c'è (404). */
  esito(userId: string, c: CorpoEsito): Promise<RispostaEsito | null>;
  /** Delle `chiavi` (`bw:<numero>:<id>`) quelle che sono nostre invii. Non lancia. */
  inviatiDalCrm(userId: string, chiavi: string[]): Promise<string[]>;
  /** Righe `in_attesa` (per il battito). Non lancia. */
  inAttesa(userId: string): Promise<number>;
  /** Una riga di log: solo il codice e, se servono, contatori numerici. */
  avviso(codice: CodiceAvvisoInvio, conteggi?: Record<string, number>): void;
}

// ── La chat (T6 i dati, T4 il disegno) ────────────────────────────────────

/** Una riga della coda, pronta da disegnare come bolla. */
export interface BollaCoda {
  id: string;
  testo: string;
  fase: StatoCoda;
  /** ISO 8601 */
  quando: string;
  /** la frase da mostrare (senza gergo) */
  frase: string;
  incerto: boolean;
  puoRiprovare: boolean;
}

export interface ApiPonteInvio {
  /** visibile solo se ok: regola pura (ponte, «ha già una chat», STOP) */
  puo: { ok: true } | { ok: false; motivo: MotivoRifiuto };
  /** righe di QUESTA chat, già passate da `vistaCoda` */
  coda: BollaCoda[];
  /** messaggi ancora possibili nelle prossime 24 h (null = non si sa) */
  restanti: number | null;
  inviando: boolean;
  /** true = in coda; false = rifiuto già mostrato */
  invia: (testo: string) => Promise<boolean>;
  riprova: (id: string, confermaIncerto?: boolean) => Promise<boolean>;
}
