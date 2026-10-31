/** ── PONTE WHATSAPP · I MEDIA: I CONTRATTI ───────────────────────────────────
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T5 (PIANO c.3, c.4),
 *  estesa il 31/10 (commessa 2026-10-31-media-e-archiviazione, compito T2, PIANO
 *  a.1/a.4): foto, vocali, video e documenti. Le forme che il Mac, il server
 *  (`media.ts`, `media.server.ts`) e la migrazione si scambiano. Il Worker non
 *  vede mai i byte: dà al Mac un permesso con un indirizzo di carico firmato, il
 *  Mac carica su Storage da solo e poi dice «fatto».
 *
 *  ⚠️ LA TABELLA DELLE CATEGORIE (limiti, mime, estensioni) è scritta tre volte:
 *   qui, nel Mac (`immagini.mjs`) e nella migrazione A. La prova di parità (T11)
 *   le confronta: se cambia una, cambiano tutte.
 *
 *  Puro: nessun database, nessun `fetch`, nessun log.
 *
 *  ⚠️ Nei log solo codici e contatori: mai numeri, chiavi, percorsi, indirizzi.
 *  ───────────────────────────────────────────────────────────────────────── */

// ── Le categorie, i limiti, i tipi ────────────────────────────────────────

/** Le quattro categorie. La decide il Worker dal mime (mai il mittente). */
export const CATEGORIE_MEDIA = ["foto", "audio", "video", "documento"] as const;
export type CategoriaMedia = (typeof CATEGORIE_MEDIA)[number];

const MIB = 1024 * 1024;

/** Il peso massimo per categoria (il bucket ha il più largo: 45 MiB = 47.185.920 B, sotto i 50 MB decimali di Storage). */
export const LIMITI_MEDIA: Record<CategoriaMedia, number> = {
  foto: 8 * MIB,
  audio: 16 * MIB,
  video: 45 * MIB,
  documento: 25 * MIB,
};

/** Solo questi tipi, mai altro (niente SVG, HTML, ZIP, OLE, txt, csv). Un `documentMessage` con mime
 *  immagine non è un documento: è un segnaposto (decide il Mac); qui un mime immagine è sempre «foto». */
export const MIME_PER_CATEGORIA: Record<CategoriaMedia, readonly string[]> = {
  foto: ["image/jpeg", "image/png", "image/webp"],
  audio: ["audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/amr"],
  video: ["video/mp4", "video/3gpp", "video/quicktime", "video/webm"],
  documento: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
};

/** Tutti i mime canonici. */
export const MEDIA_MIME: readonly string[] = CATEGORIE_MEDIA.flatMap((k) => MIME_PER_CATEGORIA[k]);

/** L'estensione del file in Storage (e di quello scaricato) per mime. Se ne sceglie una sola per tipo. */
export const ESTENSIONE_PER_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** La categoria di un mime canonico, o null (fuori elenco, con parametri, maiuscole, non testo). */
export function categoriaDi(mime: unknown): CategoriaMedia | null {
  if (typeof mime !== "string") return null;
  return CATEGORIE_MEDIA.find((k) => MIME_PER_CATEGORIA[k].includes(mime)) ?? null;
}

/** Perché il Worker rifiuta un media, come lo dice al Mac. `spenta`, `tetto` sono passeggeri (il Mac
 *  trattiene il lavoro), gli altri definitivi: `liberato` (il titolare l'ha tolto), `manuale` (categoria
 *  non automatica: resta nel catalogo del Mac per «Mostra»). */
export const MOTIVI_RIFIUTO_MEDIA = [
  "spenta",
  "tetto",
  "troppo_grande",
  "tipo",
  "liberato",
  "manuale",
] as const;
export type MotivoRifiutoMedia = (typeof MOTIVI_RIFIUTO_MEDIA)[number];

/** Il bucket privato di Storage (lo crea la migrazione di T4). */
export const BUCKET_MEDIA = "ponte-media";

/** La riga di `app_config` con l'interruttore: testo `{"acceso":false,"tettoGB":5,"auto":["foto"]}`. */
export const CHIAVE_INTERRUTTORE = "ponte_immagini";
export const TETTO_GB_DI_SERIE = 5;
/** Senza `auto` nell'interruttore si scaricano da sole solo le foto (come prima del 31/10). */
export const AUTO_DI_SERIE: readonly CategoriaMedia[] = ["foto"];

/** Quanto vale il link di lettura che il browser riceve; il video, che si guarda a lungo, 30 minuti. */
export const FIRMA_LETTURA_S = 300;
export const FIRMA_VIDEO_S = 1800;

/** Gli usi del link di lettura (`?uso=`): `vedi` foto e vocali (blob), `video` il lettore, `apri` documenti
 *  (e il vocale da scaricare). Senza `uso` vale `vedi`. Quali usi per quale categoria: `USI_PER_CATEGORIA`. */
export const USI_LETTURA = ["vedi", "video", "apri"] as const;
export type UsoLettura = (typeof USI_LETTURA)[number];
export const USI_PER_CATEGORIA: Record<CategoriaMedia, readonly UsoLettura[]> = {
  foto: ["vedi"],
  audio: ["vedi", "apri"],
  video: ["video"],
  documento: ["apri"],
};

/** `bw:<cifre del numero>:<id WhatsApp>`: la stessa di `chiaveMessaggio` (`tipi.ts`). */
export const CHIAVE_MEDIA = /^bw:(\d{8,15}):([A-Za-z0-9_.-]{1,128})$/;

/** L'identificativo di un file per la lettura: il suo nome in Storage, `<uuid>.<ext>` con `ext` di 2-5 lettere
 *  o cifre minuscole (nessun elenco: la sceglie il database). Non porta dati del cliente: la GET lo mette
 *  nell'indirizzo al posto della chiave `bw:<numero>:<id>`, che finirebbe nei log di accesso. */
export const ID_MEDIA =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/;

/** Il percorso di un oggetto del bucket: `<uuid utente>/<uuid>.<ext>`. Prima di ogni rimozione. */
export const PERCORSO_MEDIA =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/;

// ── Mac → server (estende `POST /api/public/ponte-whatsapp`) ───────────────

export interface CorpoMediaPermesso {
  v: 1;
  tipo: "media_permesso";
  chiave: string;
  mime: string;
  /** il peso dichiarato dal Mac: serve a rifiutare presto, non è la verità */
  byte: number;
  /** lavoro chiesto dal titolare con «Mostra»: vale solo se c'è una richiesta `in_corso` per la chiave */
  richiesto?: boolean;
  /** per ridisegnare la bolla; tutti facoltativi, fuori misura = ignorati */
  nome?: string;
  durata_s?: number;
  larghezza?: number;
  altezza?: number;
  miniatura?: string;
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
 *  nessun permesso per quella chiave; `tipo` / `troppo_grande` = Storage ha un oggetto di tipo
 *  o peso sbagliato, il Worker l'ha rimosso e il lavoro è finito (definitivo). */
export type RispostaMediaFatto = {
  ok: true;
  esito: "pronta" | "in_caricamento" | "assente" | "tipo" | "troppo_grande";
};

/** Errori HTTP delle due richieste: `migrazione` = funzione o tabella assente
 *  (il Mac trattiene); `database` = guasto (il Mac ritenta). */
export type ErroreMedia = "corpo_non_valido" | "migrazione" | "database";

// ── Le funzioni SQL (jsonb) ───────────────────────────────────────────────

/** `ponte_wa_media_permesso(p_user_id, p_chiave, p_numero, p_mime, p_byte,
 *  p_tetto_byte)`. `path` è il percorso scelto dal database (nome casuale,
 *  senza il numero). */
export type EsitoPermessoSql =
  | { esito: "carica"; path: string }
  | { esito: "gia_presente" }
  | { esito: "rifiutato"; motivo: "tetto" | "troppo_grande" | "tipo" | "liberato" | "manuale" };

/** `ponte_wa_media_fatto(p_user_id, p_chiave)`: il peso e il mime li legge da Storage. `tipo` e
 *  `troppo_grande` portano `path`: l'oggetto da rimuovere (la riga è già passata a `liberato`). */
export interface EsitoFattoSql {
  ok?: boolean;
  stato: "pronta" | "in_caricamento" | "assente" | "tipo" | "troppo_grande";
  path?: string;
}

/** I dettagli per ridisegnare la bolla, già ripuliti (`null` = non c'è o fuori misura). */
export interface DettagliMedia {
  nome: string | null;
  durata_s: number | null;
  larghezza: number | null;
  altezza: number | null;
  miniatura: string | null;
}

/** La riga `pronta` che serve alla lettura. */
export interface RigaMediaPronta {
  path: string;
  categoria: CategoriaMedia | null;
  mime: string | null;
  nome: string | null;
}

// ── L'interruttore ────────────────────────────────────────────────────────

export interface Interruttore {
  acceso: boolean;
  tettoGB: number;
  /** le categorie che il Mac scarica da sole; le altre solo con «Mostra» */
  auto: CategoriaMedia[];
}

// ── Browser → server (`GET /api/crm/ponte-media?id=<uuid>.<ext>&uso=vedi|video|apri`) ───────────

/** `storage` = Storage non ha firmato per un guasto passeggero (non perché l'oggetto manca):
 *  la chat lascia «Riprova» invece di dire che la foto non c'è più. */
export type MotivoLettura =
  | "non_autorizzato"
  | "id_non_valido"
  | "uso_non_valido"
  | "non_trovata"
  | "database"
  | "migrazione"
  | "storage";

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
  | "media_storage"
  | "media_migrazione";

/** Le porte dei media (`media.server.ts` le implementa, `media.ts` le usa).
 *  Tutte tranne `avviso` LANCIANO `{ code }` se il database dice di no: mai il
 *  messaggio d'errore, che può contenere numeri o percorsi. */
export interface PorteMedia {
  /** `manychat_config.user_id` (riga `id=1`); null = non configurato. */
  utente(): Promise<string | null>;
  /** Il valore GREZZO di `app_config` per `CHIAVE_INTERRUTTORE`; null = assente. */
  interruttore(): Promise<unknown>;
  /** C'è una richiesta `in_corso` di QUESTO utente per la chiave? (`ponte_wa_media_richieste`) */
  richiestaInCorso(userId: string, chiave: string): Promise<boolean>;
  /** `ponte_wa_media_permesso`. */
  permesso(
    userId: string,
    p: { chiave: string; numero: string; mime: string; byte: number; tettoByte: number },
  ): Promise<EsitoPermessoSql>;
  /** `ponte_wa_media_dettagli`: nome, durata, dimensioni, miniatura (solo dopo un `carica`). */
  dettagli(userId: string, chiave: string, d: DettagliMedia): Promise<void>;
  /** URL di carico firmato (Storage, senza `upsert`) per `path`. */
  firmaCarico(path: string): Promise<string>;
  /** `ponte_wa_media_fatto`. */
  fatto(userId: string, chiave: string): Promise<EsitoFattoSql>;
  /** Toglie da Storage UN oggetto del bucket `ponte-media`; `path` è già stato controllato (`PERCORSO_MEDIA`). */
  rimuovi(path: string): Promise<void>;
  /** La riga `pronta` di QUESTO utente, dal nome del file (`ID_MEDIA`); null = non c'è. */
  percorsoPronto(userId: string, id: string): Promise<RigaMediaPronta | null>;
  /** Link di lettura a tempo; null = l'oggetto non c'è in Storage. Con `download` il link serve il file come
   *  allegato con quel nome. LANCIA `{ code: "storage" }` se Storage non risponde per un altro motivo
   *  (guasto passeggero: non è «assente»). */
  firmaLettura(
    path: string,
    secondi: number,
    opzioni?: { download?: string },
  ): Promise<string | null>;
  /** Una riga di log: solo il codice e, se servono, contatori numerici. */
  avviso(codice: CodiceAvvisoMedia, conteggi?: Record<string, number>): void;
}
