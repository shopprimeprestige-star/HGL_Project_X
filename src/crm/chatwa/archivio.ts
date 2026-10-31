/** ── IL PANNELLO «ARCHIVIAZIONE» · LA PARTE SENZA REACT ─────────────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T9 (piano d). Qui stanno
 *  le cose che si provano senza browser:
 *    · le letture difensive delle tre funzioni SQL `ponte_wa_archivio_*` (il
 *      browser legge, mai scrive), con la RLS che fa già il filtro per utente;
 *    · pesi e frasi come le legge il titolare («3,4 GB», «12 foto · 3 vocali»);
 *    · `liberaAPassi`: chiama la rotta `POST /api/crm/ponte-media-azione`
 *      (l'unica che cancella, solo con il permesso «impostazioni» per chiavi,
 *      numero e tutto) e RIPETE finché il server dice `restano: 0`.
 *
 *  ⚠️ I passi da 500 file li decide il SERVER (`ponte_wa_media_da_liberare`,
 *   ≤ 500 per richiesta, ≈ 7 sottorichieste a Storage): il browser non sceglie
 *   la misura, rifà la stessa richiesta e legge `restano`. Solo la selezione a
 *   mano (`chiavi`) viene spezzata qui, a lotti di 200, perché la lista arriva
 *   dal browser.
 *  ⚠️ Nessun log, nessun indirizzo firmato, nessun percorso di Storage: del file
 *   il pannello conosce solo la chiave del messaggio (`bw:…`), che è già nella chat. */

// ── I tipi e le misure ────────────────────────────────────────────────────

export type Tipo = "foto" | "audio" | "video" | "documento";
export const TIPI: readonly Tipo[] = ["foto", "audio", "video", "documento"];

/** Righe per pagina nell'elenco dei media di una chat (il server ne dà al più 100). */
export const PAGINA = 50;
/** Chiavi per richiesta quando si libera una selezione a mano. */
export const MAX_CHIAVI = 200;
/** `ponte_wa_archivio_chat` dà al più questo numero di chat: oltre, il pannello lo dice. */
export const CHAT_MAX = 2000;
/** Un tetto ai passi: a 500 file ciascuno sono 1.000.000 di file. Se il server non finisse mai, ci si ferma. */
const PASSI_MAX = 2000;

/** Il tetto di serie, in GB di 10^9 byte (come la somma di `storage.objects`). */
const TETTO_GB_DI_SERIE = 5;
const TETTO_GB_MAX = 100;

export const PERCORSO_AZIONE = "/api/crm/ponte-media-azione";

export interface Conteggi {
  n: number;
  byte: number;
}
export interface Riassunto {
  byteTotali: number;
  file: number;
  senzaFile: number;
  conTimer: number;
  liberati: number;
  perTipo: Record<Tipo, Conteggi>;
}
export interface ChatArchivio {
  numero: string;
  byte: number;
  foto: number;
  audio: number;
  video: number;
  documento: number;
  ultimoIl: string | null;
}
export interface VoceMedia {
  chiave: string;
  categoria: Tipo;
  nome: string | null;
  byte: number;
  durataS: number | null;
  miniatura: string | null;
  scadeIl: string | null;
  creatoIl: string;
}

// ── Leggere senza fidarsi ─────────────────────────────────────────────────

const oggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
/** Un numero finito e non negativo, o 0. */
const quanto = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
const eNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function leggiRiassunto(grezzo: unknown): Riassunto | null {
  if (!oggetto(grezzo)) return null;
  const pt = oggetto(grezzo.per_tipo) ? grezzo.per_tipo : {};
  const conta = (t: Tipo): Conteggi => {
    const x = oggetto(pt[t]) ? pt[t] : {};
    return { n: quanto(x.n), byte: quanto(x.byte) };
  };
  return {
    byteTotali: quanto(grezzo.byte_totali),
    file: quanto(grezzo.file),
    senzaFile: quanto(grezzo.senza_file),
    conTimer: quanto(grezzo.con_timer),
    liberati: quanto(grezzo.liberati),
    perTipo: {
      foto: conta("foto"),
      audio: conta("audio"),
      video: conta("video"),
      documento: conta("documento"),
    },
  };
}

/** Il numero di una chat: solo cifre, 8-15 (lo stesso controllo della funzione SQL). */
const NUMERO = /^[0-9]{8,15}$/;

/** Le chat per peso decrescente; le righe malformate si scartano. */
export function leggiChat(grezzo: unknown): ChatArchivio[] {
  if (!Array.isArray(grezzo)) return [];
  const righe: ChatArchivio[] = [];
  for (const r of grezzo) {
    if (!oggetto(r) || typeof r.numero !== "string" || !NUMERO.test(r.numero) || !eNumero(r.byte))
      continue;
    righe.push({
      numero: r.numero,
      byte: r.byte,
      foto: quanto(r.foto),
      audio: quanto(r.audio),
      video: quanto(r.video),
      documento: quanto(r.documento),
      ultimoIl: typeof r.ultimo_il === "string" ? r.ultimo_il : null,
    });
  }
  return righe.sort((a, b) => b.byte - a.byte);
}

/** `bw:<cifre>:<id WhatsApp>` (come in usaMediaPonte.ts e in src/crm/ponte/tipi.ts). */
const CHIAVE = /^bw:\d{5,20}:[A-Za-z0-9_.-]{1,128}$/;
/** Una miniatura JPEG in base64: la stessa regola del CHECK della colonna. Finisce in un `src`, quindi si ricontrolla. */
const MINIATURA = /^\/9j\/[A-Za-z0-9+/]*={0,2}$/;

export function leggiMedia(grezzo: unknown): VoceMedia[] {
  if (!Array.isArray(grezzo)) return [];
  const voci: VoceMedia[] = [];
  for (const r of grezzo) {
    if (!oggetto(r) || typeof r.chiave !== "string" || !CHIAVE.test(r.chiave)) continue;
    const categoria = TIPI.find((t) => t === r.categoria);
    if (!categoria || typeof r.creato_il !== "string") continue;
    const mini =
      typeof r.miniatura === "string" && r.miniatura.length <= 12000 && MINIATURA.test(r.miniatura);
    voci.push({
      chiave: r.chiave,
      categoria,
      nome: typeof r.nome === "string" && r.nome.trim() ? r.nome.trim().slice(0, 200) : null,
      byte: quanto(r.byte),
      durataS: eNumero(r.durata_s) ? r.durata_s : null,
      miniatura: mini ? (r.miniatura as string) : null,
      scadeIl: typeof r.scade_il === "string" ? r.scade_il : null,
      creatoIl: r.creato_il,
    });
  }
  return voci;
}

/** `app_config.ponte_immagini` (testo JSON, o già oggetto) → il tetto in byte. Valore assente = `null`
 *  (niente barra); rotto o assurdo = 5 GB di serie, come fa il Worker.
 *  shortcut: copia di `leggiInterruttore` (src/crm/ponte/media.ts), che è un file server di T2; quando il
 *  tetto avrà una rotta propria, leggerlo da lì. */
export function leggiTetto(grezzo: unknown): number | null {
  if (grezzo === null || grezzo === undefined) return null;
  let v: unknown = grezzo;
  if (typeof grezzo === "string") {
    try {
      v = JSON.parse(grezzo);
    } catch {
      return TETTO_GB_DI_SERIE * 1e9;
    }
  }
  const t = oggetto(v) ? v.tettoGB : undefined;
  const gb =
    typeof t === "number" && Number.isFinite(t) && t > 0 && t <= TETTO_GB_MAX
      ? t
      : TETTO_GB_DI_SERIE;
  return Math.floor(gb * 1e9);
}

// ── Pesi e frasi ──────────────────────────────────────────────────────────

/** `v` con al più `d` decimali, la virgola e nessuno zero inutile (`2,0` → `2`). */
const dec = (v: number, d: number) => String(Number(v.toFixed(d))).replace(".", ",");

/** «12,4 MB», «340 MB», «1,24 GB»: unità decimali (1 MB = 10^6 byte), come Storage e il tetto. */
export function formatoPeso(byte: unknown): string {
  const b = quanto(byte);
  if (b < 1e3) return `${Math.round(b)} B`;
  if (b < 1e6) return `${Math.round(b / 1e3)} KB`;
  if (b < 1e9) return b < 1e8 ? `${dec(b / 1e6, 1)} MB` : `${Math.round(b / 1e6)} MB`;
  return `${dec(b / 1e9, 2)} GB`;
}

/** Il punto delle migliaia: 4200 → «4.200». */
export const numero = (n: number): string =>
  String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const fraseFile = (n: number): string => `${numero(n)} file`;

/** «12 foto · 3 vocali · 1 video · 4 doc», senza gli zeri. */
export function etichettaTipi(c: Pick<ChatArchivio, Tipo>): string {
  const parti: string[] = [];
  if (c.foto) parti.push(`${numero(c.foto)} foto`);
  if (c.audio) parti.push(`${numero(c.audio)} ${c.audio === 1 ? "vocale" : "vocali"}`);
  if (c.video) parti.push(`${numero(c.video)} video`);
  if (c.documento) parti.push(`${numero(c.documento)} doc`);
  return parti.join(" · ");
}

/** «tra 5 min», «tra 3 h», «tra 7 g»; già scaduto = «in eliminazione»; nessun timer = `null`. */
export function fraseScadenza(scadeIl: string | null, adesso: number): string | null {
  if (!scadeIl) return null;
  const t = Date.parse(scadeIl);
  if (!Number.isFinite(t)) return null;
  const ms = t - adesso;
  if (ms <= 0) return "in eliminazione";
  if (ms < 3_600_000) return `tra ${Math.ceil(ms / 60_000)} min`;
  if (ms < 86_400_000) return `tra ${Math.ceil(ms / 3_600_000)} h`;
  return `tra ${Math.ceil(ms / 86_400_000)} g`;
}

// ── Liberare a passi ──────────────────────────────────────────────────────

/** Cosa si libera: una chiave (chiunque veda la chat), oppure `chiavi`, `numero`, `tutto` (solo «impostazioni», lo dice il server). */
export type CorpoLibera =
  | { azione: "libera"; chiave: string }
  | { azione: "libera"; chiavi: string[] }
  | { azione: "libera"; numero: string }
  | { azione: "libera"; tutto: true };

export type MotivoErrore =
  | "permesso"
  | "sessione"
  | "migrazione"
  | "server"
  | "rete"
  | "risposta"
  | "bloccato"
  | "troppi_passi";

const FRASI_ERRORE: Record<MotivoErrore, string> = {
  permesso: "Non hai il permesso di liberare lo spazio: serve il permesso «Impostazioni».",
  sessione: "La sessione è scaduta: esci e rientra nel CRM, poi riprova.",
  migrazione: "L'archivio non è ancora pronto sul database: manca un aggiornamento da applicare.",
  server: "Il server non è riuscito a liberare lo spazio. Riprova fra poco.",
  rete: "Non riesco a collegarmi: controlla la connessione e riprova.",
  risposta: "Il server ha risposto in un modo che non capisco. Riprova fra poco.",
  bloccato: "Alcuni file non si riescono a liberare in questo momento. Riprova più tardi.",
  troppi_passi: "Il lavoro è più lungo del previsto e si è fermato. Riprendi per continuare.",
};
export const fraseErrore = (m: MotivoErrore): string => FRASI_ERRORE[m];

export interface Avanzamento {
  liberati: number;
  byte: number;
  /** File che il server dice di avere ancora da liberare (`null` prima del primo passo). */
  restano: number | null;
  /** Quelli che Storage non ha liberato nell'ULTIMO passo (restano nell'archivio, si riprovano). */
  nonRiusciti: number;
}
export interface EsitoLavoro extends Avanzamento {
  esito: "finito" | "fermato" | "errore";
  motivo?: MotivoErrore;
}

/** Come `fetchCRM`: aggiunge la sessione. */
export type Chiedi = (percorso: string, init: RequestInit) => Promise<Response>;

export interface OpzioniPassi {
  /** Si guarda FRA un passo e l'altro, mai a metà di una richiesta. */
  fermato: () => boolean;
  onPasso: (a: Avanzamento) => void;
  passiMax?: number;
}

type Passo = { liberati: number; byte: number; restano: number; nonRiusciti: number };

/** Una richiesta alla rotta: il passo letto, o il motivo per cui non va avanti. */
async function unPasso(corpo: CorpoLibera, chiedi: Chiedi): Promise<Passo | MotivoErrore> {
  let r: Response;
  try {
    r = await chiedi(PERCORSO_AZIONE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      cache: "no-store",
    });
  } catch {
    return "rete";
  }
  const j: unknown = await r.json().catch(() => null);
  const motivo = oggetto(j) ? j.motivo : undefined;
  if (r.status === 401) return "sessione";
  if (r.status === 403) return "permesso";
  if (!r.ok) return r.status === 503 && motivo === "migrazione" ? "migrazione" : "server";
  if (
    !oggetto(j) ||
    j.ok !== true ||
    !eNumero(j.liberati) ||
    !eNumero(j.byte) ||
    !eNumero(j.restano)
  ) {
    return "risposta";
  }
  return {
    liberati: j.liberati,
    byte: j.byte,
    restano: j.restano,
    nonRiusciti: quanto(j.non_riusciti),
  };
}

/** Libera e RIPETE finché il server dice `restano: 0`. Non lancia mai: ogni guasto è un `esito: "errore"`
 *  che porta con sé quanto è già stato liberato (ripartire dopo un errore rifà la stessa richiesta: il
 *  server libera solo ciò che è ancora `pronta`, quindi non si rifà niente).
 *  Si ferma da solo se un passo non libera nulla mentre qualcosa resta (altrimenti girerebbe all'infinito). */
export async function liberaAPassi(
  corpo: CorpoLibera,
  chiedi: Chiedi,
  o: OpzioniPassi,
): Promise<EsitoLavoro> {
  const lotti: CorpoLibera[] = [];
  if ("chiavi" in corpo) {
    for (let i = 0; i < corpo.chiavi.length; i += MAX_CHIAVI) {
      lotti.push({ azione: "libera", chiavi: corpo.chiavi.slice(i, i + MAX_CHIAVI) });
    }
  } else {
    lotti.push(corpo);
  }
  const tot: Avanzamento = { liberati: 0, byte: 0, restano: null, nonRiusciti: 0 };
  const max = o.passiMax ?? PASSI_MAX;
  let passi = 0;
  for (let i = 0; i < lotti.length; i++) {
    //  Quanti file hanno ancora i lotti che non sono ancora partiti (conta solo per la selezione a mano).
    const dopo = lotti.slice(i + 1).reduce((s, l) => s + ("chiavi" in l ? l.chiavi.length : 0), 0);
    for (;;) {
      if (o.fermato()) return { esito: "fermato", ...tot };
      if (passi >= max) return { esito: "errore", motivo: "troppi_passi", ...tot };
      passi++;
      const p = await unPasso(lotti[i], chiedi);
      if (typeof p === "string") return { esito: "errore", motivo: p, ...tot };
      tot.liberati += p.liberati;
      tot.byte += p.byte;
      tot.restano = p.restano + dopo;
      tot.nonRiusciti = p.nonRiusciti;
      o.onPasso({ ...tot });
      if (p.restano === 0) break;
      if (p.liberati === 0) return { esito: "errore", motivo: "bloccato", ...tot };
    }
  }
  return { esito: "finito", ...tot, restano: 0 };
}
