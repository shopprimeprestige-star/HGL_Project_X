/** ── FATTURE BULK · IL MAGAZZINO DELLA ROTTA (bulk.server.ts) ──────────────
 *  Commessa 2026-11-12-fatture-bulk, T9 (PIANO §4, D11-D14). Tutte le azioni della rotta TRANNE
 *  l'emissione (`emetti-riga` sta in emissione.server.ts, T12). Le azioni prendono PORTE (archivio,
 *  lucchetti, bucket, AI, orologio), così si provano con finti; il client Supabase vero si crea solo
 *  nella rotta.
 *  ⚠️ Deve restare importabile senza ambiente: niente `process.env`, niente client creato a livello
 *   di modulo, o si rompe il bundle di tutte le prove.
 *
 *  ── LE REGOLE CHE TIENE QUESTO FILE ───────────────────────────────────────
 *  · Niente dati personali nei log: `porte.log` riceve solo CODICI. Nessun `console.` qui dentro.
 *  · Un GET non cancella mai. Le cancellazioni (annulla, pulisci, scarto, chiusura del lotto) sono POST;
 *    il ritentativo di una cancellazione fallita è `pulisci`.
 *  · Ogni azione sta sotto le 40 sottorichieste (MAX_SOTTORICHIESTE; limite del piano Free: 50): le
 *    cancellazioni vanno per prefisso in una chiamata sola, `storage.remove` a gruppi di 100, e le
 *    azioni che toccano molte chiavi sono limitate (elenco dei lotti, miniature).
 *  · Una sola chiamata all'AI per lettura, con scadenza di 55 s e NESSUNA ripetizione qui: le
 *    ripetizioni le fa solo il browser (coda.ts).
 *  · I file del browser non si fidano mai: l'id del lotto, l'indice, l'impronta, il tipo di file e ogni
 *    campo corretto sono controllati prima di costruire una chiave o un percorso. I percorsi del bucket
 *    che stanno in `app_config` (scrivibile da ogni utente del CRM) si ricontrollano a ogni uso.
 *  · I percorsi del bucket sono `<utente>/bulk/<lotto>/<uuid>.jpg`: nessun nome di persona. */
import { documentoAccettabile } from "../lettura-documento";
import { leggiAziendaSu } from "../archivio";
import {
  cartellaBucket,
  chiaveEmittente,
  chiaveFile,
  chiaveReclamo,
  chiaveRiga,
  chiaveTestata,
  GIORNI_LOTTO_APERTO,
  idRigaDa,
  lottoValido,
  MAX_FILE,
  MAX_SOTTORICHIESTE,
  MAX_URL_PER_CHIAMATA,
  PREFISSO_TESTATA,
  prefissoFile,
  prefissoReclami,
  prefissoRighe,
  RIMUOVI_A_GRUPPI,
  SCADENZA_EMITTENTE_MS,
  SCADENZA_RECLAMO_MS,
  TIMEOUT_AI_MS,
  URL_FIRMATI_SECONDI,
} from "./chiavi";
import type { ArchivioProtetto } from "./emissione-bulk";
import { corpoRichiesta, leggiCorpoRisposta, leggiRispostaGruppo } from "./lettura-bulk";
import { prendi, prendiIlControllo, rilascia, type PortaLucchetto } from "./lucchetto.server";
import { ricomponi, tipiPerRicomporre } from "./raggruppa";
import { controllaLotto, firmaImpostazioni } from "./regole-lotto";
import type {
  CampiRiga,
  CodiceErrore,
  DecisioniRiga,
  DettaglioLotto,
  FileLotto,
  LetturaFile,
  RichiestaBulk,
  RispostaBulk,
  RispostaEmettiRiga,
  RispostaErrore,
  SchedaPerAbbinamento,
  SintesiLotto,
  TestataLotto,
} from "./tipi";

/* ══ 1. LE PORTE ═══════════════════════════════════════════════════════════ */

/** Come finisce UN tentativo all'AI: il testo e il motivo di fine, oppure un codice (mai stringhe libere). */
export type EsitoAI =
  | { testo: string; fine: string }
  | { errore: CodiceErrore; messaggio?: string };

export interface PorteBulk {
  archivio: ArchivioProtetto;
  /** Lo stesso archivio, avvolto per l'EMISSIONE: ammette soltanto `creaSeAssente` sulle chiavi delle fatture emesse (il numero
   *  della fattura). Lo riceve solo `emettiProtettoSu` (T12): ogni altra azione usa `archivio`, che non scrive fatture. */
  archivioEmissione: ArchivioProtetto;
  /** Lucchetti e reclami (compare-and-swap su `app_config`); serve anche a `file` per riprendere un `caricando` scaduto. */
  lucchetto: PortaLucchetto;
  bucket: {
    /** Carica con `upsert: false`. Torna il messaggio d'errore, o null. */
    carica: (percorso: string, dataUrl: string) => Promise<string | null>;
    /** Il file come data URL, o null se non si scarica. */
    scarica: (percorso: string) => Promise<string | null>;
    /** I NOMI (file o cartelle) direttamente dentro la cartella; null = errore (non somiglia a «vuota»). */
    elenca: (cartella: string) => Promise<string[] | null>;
    /** Una chiamata per gruppo; torna il messaggio d'errore, o null. */
    rimuovi: (percorsi: string[]) => Promise<string | null>;
    firma: (percorso: string, secondi: number) => Promise<string | null>;
  };
  /** UN solo tentativo, con scadenza; la porta vera è `chiamaOpenRouter`. */
  ai: (immagini: string[], timeoutMs: number) => Promise<EsitoAI>;
  /** Millisecondi dall'epoca. */
  adesso: () => number;
  /** Un id casuale nuovo (UUID minuscolo): lotti, percorsi, proprietario dei reclami. */
  id: () => string;
  /** Solo CODICI (`"ai_429"`): mai id, nomi, percorsi o testi. */
  log: (codice: string) => void;
  /** Utente proprietario dei dati (per i percorsi del bucket). */
  utente: string;
  /** TUTTE le schede del CRM, nella forma dell'abbinamento (T12: la riga si rivaluta sul server prima di emettere,
   *  e una scelta a mano su una scheda mancante dall'elenco verrebbe bloccata). Rilancia se non le legge. */
  schede: () => Promise<SchedaPerAbbinamento[]>;
}

/** ⚠️ Scrivere e cancellare, da qui, vale SOLO per le chiavi `bulk_fatture_*`: una chiave `fattura:*` o
 *  `fattura_bozza:*` non si tocca mai (sarebbe una fattura persa). La rotta avvolge le sue porte vere con
 *  queste due funzioni; le letture restano libere. */
const chiaveBulk = (k: string) => k.startsWith("bulk_fatture_");
const VIETATA = "chiave fuori dal bulk: non ammessa";

export function archivioSoloBulk(a: ArchivioProtetto): ArchivioProtetto {
  return {
    ...a,
    scrivi: async (k, v) => (chiaveBulk(k) ? a.scrivi(k, v) : VIETATA),
    elimina: async (k) => (chiaveBulk(k) ? a.elimina(k) : VIETATA),
    creaSeAssente: async (k, v) =>
      chiaveBulk(k) ? a.creaSeAssente(k, v) : { stato: "errore", errore: VIETATA },
  };
}

export function lucchettoSoloBulk(p: PortaLucchetto): PortaLucchetto {
  return {
    leggi: p.leggi,
    creaSeAssente: async (k, v) => chiaveBulk(k) && p.creaSeAssente(k, v),
    sostituisciSe: async (k, a, n) => chiaveBulk(k) && p.sostituisciSe(k, a, n),
    eliminaSe: async (k, a) => chiaveBulk(k) && p.eliminaSe(k, a),
  };
}

/* ══ 2. ERRORI E RISPOSTE ══════════════════════════════════════════════════ */

const MESSAGGI: Record<CodiceErrore, string> = {
  timeout: "La lettura ha impiegato troppo: riprova fra poco.",
  limite: "Troppe richieste all'intelligenza artificiale: si riprova fra poco.",
  credito: "Il credito dell'intelligenza artificiale è finito.",
  rete: "Collegamento interrotto: riprova fra poco.",
  troncata:
    "La risposta dell'intelligenza artificiale è stata tagliata: rileggi il gruppo con «Rileggi».",
  illeggibile:
    "Dagli screenshot non sono riuscito a leggere niente di sicuro: rileggi il gruppo con «Rileggi».",
  occupato: "Un'altra scheda sta già lavorando su questo: riprova fra poco.",
  non_autorizzato: "Serve l'accesso al CRM: rientra col tuo PIN.",
  non_permesso: "Non hai il permesso per le fatture.",
  richiesta_non_valida: "Richiesta non valida.",
  non_trovato: "Non trovo il caricamento: forse è stato annullato o concluso.",
  troppi_file: `Troppi file: al massimo ${MAX_FILE} per caricamento.`,
  file_non_valido: "Il file non è valido: carica uno screenshot (JPG) più leggero di 8 MB.",
  impostazioni_cambiate: "I dati per la fattura sono cambiati: ricomincia il caricamento.",
  emittente_occupato: "Un'altra scheda sta emettendo le fatture di questo caricamento.",
  lucchetto_occupato: "Un'altra emissione è in corso: riprova fra poco.",
  scrittura_fallita: "Non sono riuscito a salvare: riprova.",
  conflitto: "Il dato è cambiato nel frattempo: riprova.",
  altra_origine: "La fattura risulta di un'altra origine: ci si ferma.",
  politica_dati:
    "Nessun fornitore dell'intelligenza artificiale accetta la regola «non conservare i dati»: le letture sono ferme, avvisa l'assistenza.",
  interno: "Errore interno: riprova; se si ripete avvisa l'assistenza.",
};

const STATO_HTTP: Record<CodiceErrore, number> = {
  timeout: 504,
  limite: 429,
  credito: 402,
  rete: 502,
  troncata: 502,
  illeggibile: 502,
  occupato: 409,
  non_autorizzato: 401,
  non_permesso: 403,
  richiesta_non_valida: 400,
  non_trovato: 404,
  troppi_file: 413,
  file_non_valido: 400,
  impostazioni_cambiate: 409,
  emittente_occupato: 409,
  lucchetto_occupato: 409,
  scrittura_fallita: 500,
  conflitto: 409,
  altra_origine: 409,
  politica_dati: 502,
  interno: 500,
};

export class ErroreBulk extends Error {
  constructor(
    readonly codice: CodiceErrore,
    readonly messaggio: string = MESSAGGI[codice],
  ) {
    super(codice);
    this.name = "ErroreBulk";
  }
}

const INTESTAZIONI = { "Content-Type": "application/json", "Cache-Control": "no-store" };
/** ⚠️ Nessuna intestazione CORS, di proposito: la rotta è solo della stessa origine. */
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: INTESTAZIONI });

const risposteErrore = (codice: CodiceErrore, messaggio?: string): RispostaErrore => ({
  ok: false,
  codice,
  messaggio: messaggio ?? MESSAGGI[codice],
});

/** Un errore qualunque → la risposta della rotta. Nei log solo il codice. */
function rispostaDaErrore(e: unknown, porte: PorteBulk, azione: string): Response {
  const codice: CodiceErrore = e instanceof ErroreBulk ? e.codice : "interno";
  porte.log(`${azione} ${codice}`);
  const messaggio = e instanceof ErroreBulk ? e.messaggio : MESSAGGI.interno;
  return json(risposteErrore(codice, messaggio), STATO_HTTP[codice]);
}

/* ══ 3. PICCOLI AIUTI ══════════════════════════════════════════════════════ */

const iso = (ms: number) => new Date(ms).toISOString();

function leggiJson<T>(grezzo: string | null | undefined): T | null {
  if (!grezzo) return null;
  try {
    const v = JSON.parse(grezzo) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

/** Il percorso di un file DEL LOTTO, o null: i valori di `app_config` li può scrivere ogni utente del CRM,
 *  quindi un percorso letto da lì non si firma né si scarica se non sta nella cartella giusta. */
function percorsoDelLotto(utente: string, lotto: string, percorso: unknown): string | null {
  if (typeof percorso !== "string") return null;
  const cartella = cartellaBucket(utente, lotto);
  if (!percorso.startsWith(cartella)) return null;
  return /^[0-9a-f-]{8,40}\.jpg$/.test(percorso.slice(cartella.length)) ? percorso : null;
}

/** Il file com'è mostrato al browser: né percorso né scadenza (non gli servono). */
function perIlBrowser(f: FileLotto): FileLotto {
  const { percorso: _percorso, scadeIl: _scadeIl, ...resto } = f;
  return resto;
}

async function inGruppi<T>(
  elementi: T[],
  dimensione: number,
  lavoro: (gruppo: T[]) => Promise<void>,
) {
  for (let i = 0; i < elementi.length; i += dimensione)
    await lavoro(elementi.slice(i, i + dimensione));
}

/** Una scrittura che, se fallisce, si ripete UNA volta: dopo una lettura a pagamento perderla sarebbe pagare due volte. */
async function scrivi(
  porte: PorteBulk,
  chiave: string,
  valore: unknown,
  ripetizione = false,
): Promise<void> {
  const testo = JSON.stringify(valore);
  let errore = await porte.archivio.scrivi(chiave, testo);
  if (errore && ripetizione) errore = await porte.archivio.scrivi(chiave, testo);
  if (errore) throw new ErroreBulk("scrittura_fallita");
}

export async function testataDi(porte: PorteBulk, lotto: string): Promise<TestataLotto | null> {
  return leggiJson<TestataLotto>(await porte.archivio.leggi(chiaveTestata(lotto)));
}

async function testataOppureErrore(porte: PorteBulk, lotto: string): Promise<TestataLotto> {
  const t = await testataDi(porte, lotto);
  if (!t) throw new ErroreBulk("non_trovato");
  return t;
}

/** Tutti i file del lotto, per indice. UNA lettura (≤ 600 chiavi). */
export async function fileDelLotto(
  porte: PorteBulk,
  lotto: string,
): Promise<Map<number, FileLotto>> {
  const righe = await porte.archivio.leggiPrefissoPerChiave(prefissoFile(lotto));
  const m = new Map<number, FileLotto>();
  for (const r of righe) {
    const f = leggiJson<FileLotto>(r.value);
    if (f && Number.isInteger(f.indice)) m.set(f.indice, f);
  }
  return m;
}

export async function righeDelLotto(
  porte: PorteBulk,
  lotto: string,
): Promise<Map<string, DecisioniRiga>> {
  const righe = await porte.archivio.leggiPrefissoPerChiave(prefissoRighe(lotto));
  const m = new Map<string, DecisioniRiga>();
  for (const r of righe) {
    const d = leggiJson<DecisioniRiga>(r.value);
    if (d && typeof d.idRiga === "string") m.set(d.idRiga, d);
  }
  return m;
}

const comeTipi = (files: Iterable<FileLotto>) => tipiPerRicomporre(files);

/** Il reclamo (`bulk_fatture_c`) di uno o più gruppi, preso prima del lavoro e SEMPRE rilasciato dopo.
 *  Se è di un altro e non è scaduto → `occupato`. La scadenza (90 s) è più lunga della richiesta più lunga (55 s + giri). */
async function conReclami<T>(
  porte: PorteBulk,
  lotto: string,
  gruppi: number[],
  lavoro: () => Promise<T>,
): Promise<T> {
  const io = porte.id();
  const presi: number[] = [];
  try {
    for (const g of gruppi) {
      const p = await prendi(
        porte.lucchetto,
        chiaveReclamo(lotto, g),
        io,
        SCADENZA_RECLAMO_MS,
        porte.adesso(),
      );
      if (!p.ok) throw new ErroreBulk("occupato");
      presi.push(g);
    }
    return await lavoro();
  } finally {
    for (const g of presi)
      await rilascia(porte.lucchetto, chiaveReclamo(lotto, g), io).catch(() =>
        porte.log("reclamo_non_rilasciato"),
      );
  }
}

/* ══ 4. LA CHIAMATA ALL'AI (UN TENTATIVO) ══════════════════════════════════ */

/** Il 404 di OpenRouter con `data_collection: "deny"`: nessun fornitore del modello dichiara di non
 *  conservare i dati. ⚠️ Non si toglie `deny` per farla passare: sono tessere sanitarie. */
export const MESSAGGIO_POLITICA_DATI =
  "OpenRouter non trova nessun fornitore che accetti la regola «non conservare i dati» per questo modello, " +
  "quindi le letture sono ferme. Non si toglie la regola (sono tessere sanitarie): avvisa l'assistenza.";

function codiceDaStatoAI(stato: number): CodiceErrore {
  if (stato === 402) return "credito";
  if (stato === 429) return "limite";
  if (stato === 408 || stato === 504) return "timeout";
  if (stato >= 500) return "rete";
  return "interno";
}

/** UN tentativo a OpenRouter, con scadenza `timeoutMs` (55 s) su richiesta E lettura della risposta.
 *  Nessuna ripetizione (D12). Il testo della risposta non esce mai da qui, nemmeno nei messaggi d'errore. */
export async function chiamaOpenRouter(o: {
  fetch: typeof fetch;
  chiave: string;
  immagini: string[];
  timeoutMs: number;
}): Promise<EsitoAI> {
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), o.timeoutMs);
  try {
    const r = await o.fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${o.chiave}`,
        "HTTP-Referer": "https://hair-genius-hub.hair",
        "X-Title": "Fatture da screenshot",
      },
      body: JSON.stringify(corpoRichiesta(o.immagini)),
      signal: controllo.signal,
    });
    const grezzo = await r.text();
    if (!r.ok) {
      if (r.status === 404)
        return /data.?polic|no endpoints/i.test(grezzo.slice(0, 600))
          ? { errore: "politica_dati", messaggio: MESSAGGIO_POLITICA_DATI }
          : {
              errore: "interno",
              messaggio:
                "OpenRouter non trova il modello dell'intelligenza artificiale: avvisa l'assistenza.",
            };
      if (r.status === 401 || r.status === 403)
        return {
          errore: "interno",
          messaggio: "OpenRouter non accetta la chiave: si controlla da Impostazioni.",
        };
      return { errore: codiceDaStatoAI(r.status) };
    }
    let corpo: unknown;
    try {
      corpo = JSON.parse(grezzo);
    } catch {
      return { errore: "illeggibile" };
    }
    //  OpenRouter a volte risponde 200 con un oggetto `error` dentro.
    const errore = (corpo as { error?: { code?: unknown } } | null)?.error;
    if (errore) return { errore: codiceDaStatoAI(Number(errore.code) || 500) };
    return leggiCorpoRisposta(corpo);
  } catch (e) {
    return { errore: (e as { name?: string })?.name === "AbortError" ? "timeout" : "rete" };
  } finally {
    clearTimeout(timer);
  }
}

/* ══ 5. LEGGERE I LOTTI (GET) ══════════════════════════════════════════════ */

/** I lotti nell'elenco: oltre questo numero si vedono solo i più recenti (2 letture a lotto, D13). */
const MAX_LOTTI_ELENCO = 15;

export async function elencoLotti(porte: PorteBulk): Promise<SintesiLotto[]> {
  const testate = (await porte.archivio.leggiPrefissoPerChiave(PREFISSO_TESTATA))
    .map((r) => leggiJson<TestataLotto>(r.value))
    .filter((t): t is TestataLotto => !!t && lottoValido(String(t.lotto)))
    .sort((a, b) => String(b.creatoIl).localeCompare(String(a.creatoIl)))
    .slice(0, MAX_LOTTI_ELENCO);
  const out: SintesiLotto[] = [];
  for (const t of testate) {
    const [file, righe] = [await fileDelLotto(porte, t.lotto), await righeDelLotto(porte, t.lotto)];
    const chiuse = (s: string) => [...righe.values()].filter((d) => d.stato === s).length;
    const clienti = ricomponi(comeTipi(file.values())).length;
    out.push({
      lotto: t.lotto,
      creatoIl: t.creatoIl,
      file: file.size,
      letti: [...file.values()].filter((f) => f.stato === "letto").length,
      righeAperte: Math.max(0, clienti - chiuse("emessa") - chiuse("scartata")),
      righeEmesse: chiuse("emessa"),
    });
  }
  return out;
}

export async function dettaglioLotto(
  porte: PorteBulk,
  lotto: string,
): Promise<DettaglioLotto | null> {
  if (!lottoValido(lotto)) throw new ErroreBulk("richiesta_non_valida");
  const testata = await testataDi(porte, lotto);
  if (!testata) return null;
  const [file, righe] = [await fileDelLotto(porte, lotto), await righeDelLotto(porte, lotto)];
  return {
    testata,
    file: [...file.values()].sort((a, b) => a.indice - b.indice).map(perIlBrowser),
    righe: [...righe.values()],
  };
}

/** Indirizzi FIRMATI (60 s) per le miniature: solo file di QUESTO lotto, al massimo 6 per chiamata, solo
 *  se il file è ancora nel bucket. Chiave = l'indice a 4 cifre. Un file «copia» usa lo screenshot dell'originale. */
export async function urlMiniature(
  porte: PorteBulk,
  lotto: string,
  indici: number[],
): Promise<Record<string, string>> {
  if (!lottoValido(lotto)) throw new ErroreBulk("richiesta_non_valida");
  const unici = [...new Set(indici)];
  if (
    unici.length === 0 ||
    unici.length > MAX_URL_PER_CHIAMATA ||
    unici.some((i) => !Number.isInteger(i) || i < 0 || i >= MAX_FILE)
  )
    throw new ErroreBulk("richiesta_non_valida");
  const leggi = async (indiciDaLeggere: number[]) =>
    (await porte.archivio.leggiMolte(indiciDaLeggere.map((i) => chiaveFile(lotto, i))))
      .map((r) => leggiJson<FileLotto>(r.value))
      .filter((f): f is FileLotto => !!f);
  const richiesti = await leggi(unici);
  const originali = new Map<number, FileLotto>();
  const daCercare = [
    ...new Set(
      richiesti.filter((f) => !f.percorso && typeof f.copiaDi === "number").map((f) => f.copiaDi!),
    ),
  ];
  if (daCercare.length)
    for (const f of await leggi(
      daCercare.filter((i) => Number.isInteger(i) && i >= 0 && i < MAX_FILE),
    ))
      originali.set(f.indice, f);
  const out: Record<string, string> = {};
  for (const f of richiesti) {
    const sorgente =
      f.percorso ??
      (typeof f.copiaDi === "number" ? originali.get(f.copiaDi)?.percorso : undefined);
    const percorso = percorsoDelLotto(porte.utente, lotto, sorgente);
    if (!percorso || f.stato === "emessa" || f.stato === "scartata") continue;
    const url = await porte.bucket.firma(percorso, URL_FIRMATI_SECONDI);
    if (url) out[String(f.indice).padStart(4, "0")] = url;
  }
  return out;
}

/* ══ 6. CANCELLARE ═════════════════════════════════════════════════════════ */

/** Toglie dal bucket i percorsi (a gruppi di 100). Torna true se tutto è andato. */
async function togliDalBucket(porte: PorteBulk, percorsi: string[]): Promise<boolean> {
  let bene = true;
  await inGruppi(percorsi, RIMUOVI_A_GRUPPI, async (g) => {
    if (await porte.bucket.rimuovi(g)) bene = false;
  });
  return bene;
}

/** Cancella UN lotto per intero: file nel bucket (dalla cartella, orfani compresi), poi le chiavi per
 *  prefisso (f, r, c), poi emittente e testata. La testata per ULTIMA: se qualcosa si ferma a metà, il
 *  lotto resta visibile e si può riprovare. Torna quanti file ha tolto dal bucket. */
async function cancellaLotto(porte: PorteBulk, lotto: string): Promise<number> {
  const cartella = cartellaBucket(porte.utente, lotto);
  const nomi = await porte.bucket.elenca(cartella);
  if (nomi === null) throw new ErroreBulk("scrittura_fallita");
  const percorsi = nomi.map((n) => `${cartella}${n}`);
  if (!(await togliDalBucket(porte, percorsi))) throw new ErroreBulk("scrittura_fallita");
  for (const prefisso of [prefissoFile(lotto), prefissoRighe(lotto), prefissoReclami(lotto)])
    if (await porte.archivio.eliminaPerPrefisso(prefisso))
      throw new ErroreBulk("scrittura_fallita");
  //  ⚠️ Testata ed emittente NON hanno il «:» finale: si cancellano per chiave esatta, mai per prefisso
  //   (il lotto `abcd` pescherebbe `abcdef`).
  if (await porte.archivio.elimina(chiaveEmittente(lotto)))
    throw new ErroreBulk("scrittura_fallita");
  if (await porte.archivio.elimina(chiaveTestata(lotto))) throw new ErroreBulk("scrittura_fallita");
  return percorsi.length;
}

/** Il lotto è concluso quando ha almeno un cliente, ogni cliente è emesso o scartato e nessun file
 *  aspetta ancora di essere caricato, letto o riletto. */
function lottoConcluso(file: Map<number, FileLotto>, righe: Map<string, DecisioniRiga>): boolean {
  if (file.size === 0) return false;
  if (
    [...file.values()].some(
      (f) => f.stato === "caricando" || f.stato === "salvato" || f.stato === "errore",
    )
  )
    return false;
  const clienti = ricomponi(comeTipi(file.values()));
  if (clienti.length === 0) return false;
  return clienti.every((c) => {
    const s = righe.get(c.idRiga)?.stato;
    return s === "emessa" || s === "scartata";
  });
}

/** D11c: quando ogni riga è emessa o scartata il lotto sparisce da solo (resta solo la fattura).
 *  La chiamano `salva-riga` (scarto), `emetti-riga` (T12) e `pulisci`. Torna true se l'ha chiuso.
 *  Un guasto qui NON fa fallire chi chiama: la riga resta chiusa e `pulisci` riprova. */
export async function chiudiLottoSeConcluso(porte: PorteBulk, lotto: string): Promise<boolean> {
  try {
    const [file, righe] = [await fileDelLotto(porte, lotto), await righeDelLotto(porte, lotto)];
    if (!lottoConcluso(file, righe)) return false;
    await cancellaLotto(porte, lotto);
    return true;
  } catch {
    porte.log("chiusura_lotto_fallita");
    return false;
  }
}

/** Aggiorna la riga `r` con un confronto sul valore letto (compare-and-swap): riga assente → inserimento che
 *  fallisce se esiste; presente → `sostituisciSe` sul testo letto. Se nel frattempo è cambiata (un'altra scheda,
 *  o il ciclo di emissione della stessa scheda) si rilegge e si riprova; dopo 3 giri → `conflitto`. `cambia`
 *  decide sul valore VISTO e può rifiutare (`conflitto`): così una transizione di stato, aperta → emessa o
 *  scartata, non viene mai riportata indietro da una correzione partita dalla lettura vecchia. */
async function aggiornaRiga(
  porte: PorteBulk,
  lotto: string,
  idRiga: string,
  cambia: (attuale: DecisioniRiga) => DecisioniRiga,
): Promise<DecisioniRiga> {
  const chiave = chiaveRiga(lotto, idRiga);
  for (let giro = 0; giro < 3; giro++) {
    const grezzo = await porte.archivio.leggi(chiave);
    const attuale = leggiJson<DecisioniRiga>(grezzo) ?? { idRiga, stato: "aperta" as const };
    const nuova = cambia(attuale);
    const testo = JSON.stringify(nuova);
    if (grezzo !== null && testo === grezzo) return nuova;
    if (grezzo === null) {
      const esito = await porte.archivio.creaSeAssente(chiave, testo);
      if (esito.stato === "creata") return nuova;
      if (esito.stato === "errore") throw new ErroreBulk("scrittura_fallita");
    } else if (await porte.lucchetto.sostituisciSe(chiave, grezzo, testo)) return nuova;
  }
  throw new ErroreBulk("conflitto");
}

/** D11a/d: una riga emessa o scartata. PRIMA si scrive la verità (riga chiusa, file ridotti a
 *  `{indice, stato, impronta, tipo}`: senza lettura e senza percorso), POI si tolgono i file dal bucket.
 *  Se la cancellazione fallisce la riga resta chiusa e quei file diventano orfani: `pulisci` li toglie
 *  (la cartella si elenca, non ci si fida delle chiavi). Lo usano lo scarto (qui) e `emetti-riga` (T12). */
export async function chiudiRiga(
  porte: PorteBulk,
  lotto: string,
  idRiga: string,
  stato: "emessa" | "scartata",
  emessa?: { id: string; numero: number; data: string },
): Promise<DecisioniRiga> {
  const indici = idRiga.split("-").map(Number);
  const attuali = (await porte.archivio.leggiMolte(indici.map((i) => chiaveFile(lotto, i))))
    .map((r) => leggiJson<FileLotto>(r.value))
    .filter((f): f is FileLotto => !!f);
  //  ⚠️ Solo da «aperta» (o dallo stesso stato, se si riprova): una riga già emessa non diventa scartata né viceversa.
  const riga = await aggiornaRiga(porte, lotto, idRiga, (a) => {
    if (a.stato === stato) return a;
    if (a.stato !== "aperta") throw new ErroreBulk("conflitto");
    return { idRiga, stato, ...(emessa ? { emessa } : {}) };
  });
  const percorsi: string[] = [];
  for (const f of attuali) {
    const ok = percorsoDelLotto(porte.utente, lotto, f.percorso);
    if (ok) percorsi.push(ok);
    const residuo: FileLotto = { indice: f.indice, stato, impronta: f.impronta, tipo: f.tipo };
    if (typeof f.copiaDi === "number") residuo.copiaDi = f.copiaDi;
    await scrivi(porte, chiaveFile(lotto, f.indice), residuo, true);
  }
  if (percorsi.length && !(await togliDalBucket(porte, percorsi)))
    porte.log("rimozione_file_fallita");
  return riga;
}

/** I file nel bucket che nessun file del lotto richiama (e quelli di righe chiuse): la cartella si ELENCA
 *  PRIMA e si leggono le chiavi DOPO — un file caricato nel mezzo ha già la sua chiave (creata prima
 *  dell'upload) e non sembra orfano. Torna quanti ne ha tolti. */
export async function spazzaOrfani(porte: PorteBulk, lotto: string): Promise<number> {
  const cartella = cartellaBucket(porte.utente, lotto);
  const nomi = await porte.bucket.elenca(cartella);
  if (nomi === null) throw new ErroreBulk("rete");
  const file = await fileDelLotto(porte, lotto);
  const richiamati = new Set<string>();
  for (const f of file.values())
    if (f.stato !== "emessa" && f.stato !== "scartata" && typeof f.percorso === "string")
      richiamati.add(f.percorso);
  const orfani = nomi.map((n) => `${cartella}${n}`).filter((p) => !richiamati.has(p));
  if (orfani.length && !(await togliDalBucket(porte, orfani)))
    throw new ErroreBulk("scrittura_fallita");
  return orfani.length;
}

const scaduto = (t: TestataLotto, adesso: number) =>
  adesso - Date.parse(t.creatoIl) >= GIORNI_LOTTO_APERTO * 86_400_000;

/** `pulisci {lotto}`: quel lotto, se è vecchio di 30 giorni sparisce intero; altrimenti si tolgono gli
 *  orfani (ritentativo delle cancellazioni) e, se è concluso, si chiude.
 *  `pulisci {}`: UN solo lavoro, nell'ordine: un lotto scaduto; una cartella del bucket senza lotto. */
async function pulisci(porte: PorteBulk, lotto: string | undefined): Promise<number> {
  const adesso = porte.adesso();
  if (lotto !== undefined) {
    const t = await testataDi(porte, lotto);
    if (!t) return 0;
    if (scaduto(t, adesso)) return cancellaLotto(porte, lotto);
    const tolti = await spazzaOrfani(porte, lotto);
    await chiudiLottoSeConcluso(porte, lotto);
    return tolti;
  }
  //  ⚠️ L'ORDINE conta: prima le cartelle del bucket, poi le testate. Un lotto nasce con la testata e solo dopo
  //   ha una cartella: se la cartella è nell'elenco, la sua testata c'era già quando si leggono le testate. Al
  //   contrario, un lotto nato nel mezzo sembrerebbe senza testata e verrebbe cancellato mentre carica.
  const radice = `${porte.utente}/bulk/`;
  const cartelle = await porte.bucket.elenca(radice);
  if (cartelle === null) throw new ErroreBulk("rete");
  const testate = (await porte.archivio.leggiPrefissoPerChiave(PREFISSO_TESTATA))
    .map((r) => leggiJson<TestataLotto>(r.value))
    .filter((t): t is TestataLotto => !!t && lottoValido(String(t.lotto)));
  const vecchio = testate.find((t) => scaduto(t, adesso));
  if (vecchio) return cancellaLotto(porte, vecchio.lotto);
  const conTestata = new Set(testate.map((t) => t.lotto));
  const senza = cartelle.find((n) => lottoValido(n) && !conTestata.has(n));
  if (!senza) return 0;
  const cartella = `${radice}${senza}/`;
  const nomi = await porte.bucket.elenca(cartella);
  if (nomi === null) throw new ErroreBulk("rete");
  const percorsi = nomi.map((n) => `${cartella}${n}`);
  if (!(await togliDalBucket(porte, percorsi))) throw new ErroreBulk("scrittura_fallita");
  return percorsi.length;
}

/* ══ 7. CARICARE UN FILE ═══════════════════════════════════════════════════ */

/** Quanto vale un `caricando`: se il Worker muore fra la chiave e l'upload, dopo questo tempo il file si ritenta. */
const SCADENZA_CARICANDO_MS = 90_000;

async function caricaFile(
  porte: PorteBulk,
  r: Extract<RichiestaBulk, { azione: "file" }>,
): Promise<RispostaBulk> {
  await testataOppureErrore(porte, r.lotto);
  const chiave = chiaveFile(r.lotto, r.indice);
  const tutti = await fileDelLotto(porte, r.lotto);
  const adesso = porte.adesso();

  //  Già presente. Un `caricando` ancora vivo è un altro caricamento in corso: «occupato» (riprova), non «gia»,
  //  perché se quello fallisce la chiave sparisce e il file non c'è. Scaduto = il Worker è morto: si riprende.
  let scadutoVecchio: { grezzo: string; file: FileLotto } | null = null;
  const esistente = tutti.get(r.indice);
  if (esistente) {
    //  Lo stesso indice con un altro screenshot: la persona ha scelto un altro elenco. «gia» lascerebbe la
    //  tessera di uno sotto la posizione di un altro; si rifiuta, e si riparte con un lotto nuovo.
    if (esistente.impronta !== r.impronta) throw new ErroreBulk("conflitto");
    if (esistente.stato !== "caricando") return { ok: true, azione: "file", esito: "gia" };
    if (Date.parse(String(esistente.scadeIl)) > adesso) throw new ErroreBulk("occupato");
    scadutoVecchio = { grezzo: (await porte.archivio.leggi(chiave)) ?? "", file: esistente };
  } else {
    //  Gli stessi screenshot già LETTI in questo lotto non si rileggono né si riportano nel bucket (D4):
    //  la copia tiene tipo e lettura dell'originale e ne usa il file per la miniatura.
    const originale = [...tutti.values()]
      .filter(
        (o) =>
          o.impronta === r.impronta &&
          o.stato === "letto" &&
          o.lettura &&
          typeof o.percorso === "string",
      )
      .sort((a, b) => a.indice - b.indice)[0];
    if (originale) {
      const copia: FileLotto = {
        indice: r.indice,
        stato: "letto",
        impronta: r.impronta,
        tipo: originale.tipo,
        copiaDi: originale.indice,
        lettura: structuredClone(originale.lettura),
      };
      const esito = await porte.archivio.creaSeAssente(chiave, JSON.stringify(copia));
      if (esito.stato === "errore") throw new ErroreBulk("scrittura_fallita");
      if (esito.stato === "esiste") return { ok: true, azione: "file", esito: "gia" };
      return { ok: true, azione: "file", esito: "copia", copiaDi: originale.indice };
    }
  }

  const percorso = `${cartellaBucket(porte.utente, r.lotto)}${porte.id()}.jpg`;
  const segnaposto: FileLotto = {
    indice: r.indice,
    stato: "caricando",
    impronta: r.impronta,
    tipo: "",
    percorso,
    scadeIl: iso(adesso + SCADENZA_CARICANDO_MS),
  };
  const grezzoSegnaposto = JSON.stringify(segnaposto);
  if (scadutoVecchio) {
    //  Ripresa di un `caricando` scaduto: confronto sul valore letto, fra due che ci provano insieme ne vince uno.
    if (!(await porte.lucchetto.sostituisciSe(chiave, scadutoVecchio.grezzo, grezzoSegnaposto)))
      throw new ErroreBulk("occupato");
    const vecchio = percorsoDelLotto(porte.utente, r.lotto, scadutoVecchio.file.percorso);
    if (vecchio) await porte.bucket.rimuovi([vecchio]);
  } else {
    const esito = await porte.archivio.creaSeAssente(chiave, grezzoSegnaposto);
    if (esito.stato === "errore") throw new ErroreBulk("scrittura_fallita");
    //  Un'altra richiesta l'ha creata un istante prima: è lei che carica.
    if (esito.stato === "esiste") throw new ErroreBulk("occupato");
  }

  const errore = await porte.bucket.carica(percorso, r.dataUrl);
  if (errore) {
    //  Upload fallito → si toglie il segnaposto (solo se è ancora il nostro).
    await porte.lucchetto
      .eliminaSe(chiave, grezzoSegnaposto)
      .catch(() => porte.log("segnaposto_non_tolto"));
    throw new ErroreBulk("scrittura_fallita");
  }
  const { scadeIl: _scadeIl, ...salvato } = segnaposto;
  const fatto = await porte.lucchetto.sostituisciSe(
    chiave,
    grezzoSegnaposto,
    JSON.stringify({ ...salvato, stato: "salvato" }),
  );
  if (!fatto) {
    //  Troppo lenti: la chiave è passata a un altro, che ha il suo file. Il nostro non serve.
    await porte.bucket.rimuovi([percorso]);
    throw new ErroreBulk("occupato");
  }
  return { ok: true, azione: "file", esito: "salvato" };
}

/* ══ 8. LEGGERE UN GRUPPO ══════════════════════════════════════════════════ */

/** Scarica i file, UNA chiamata all'AI, normalizza. Non scrive niente. Torna le letture nell'ordine dei file. */
async function chiediAllAi(
  porte: PorteBulk,
  lotto: string,
  files: FileLotto[],
): Promise<
  { ok: true; letture: LetturaFile[] } | { ok: false; codice: "troncata" | "illeggibile" }
> {
  const immagini: string[] = [];
  for (const f of files) {
    const percorso = percorsoDelLotto(porte.utente, lotto, f.percorso);
    if (!percorso) throw new ErroreBulk("file_non_valido");
    const img = await porte.bucket.scarica(percorso);
    if (!img) throw new ErroreBulk("rete");
    immagini.push(img);
  }
  const r = await porte.ai(immagini, TIMEOUT_AI_MS);
  if ("errore" in r) throw new ErroreBulk(r.errore, r.messaggio);
  return leggiRispostaGruppo(r.testo, immagini.length, r.fine);
}

const daLeggere = (f: FileLotto) =>
  f.stato === "salvato" && !f.lettura && typeof f.percorso === "string";

async function leggiGruppo(porte: PorteBulk, lotto: string, gruppo: number): Promise<FileLotto[]> {
  const indici = [3 * gruppo, 3 * gruppo + 1, 3 * gruppo + 2].filter((i) => i < MAX_FILE);
  const tutti = await fileDelLotto(porte, lotto);
  const adesso = porte.adesso();
  const presenti = indici.map((i) => tutti.get(i)).filter((f): f is FileLotto => !!f);
  if (presenti.length === 0) throw new ErroreBulk("non_trovato");
  for (const f of presenti)
    if (f.stato === "caricando")
      throw new ErroreBulk(Date.parse(String(f.scadeIl)) > adesso ? "occupato" : "file_non_valido");
  if (!presenti.some(daLeggere)) return presenti.map(perIlBrowser);

  return conReclami(porte, lotto, [gruppo], async () => {
    //  ⚠️ Rilettura DOPO il reclamo: chi ha finito un istante fa ha già scritto, e non si paga due volte.
    const attuali = (
      await porte.archivio.leggiMolte(presenti.map((f) => chiaveFile(lotto, f.indice)))
    )
      .map((r) => leggiJson<FileLotto>(r.value))
      .filter((f): f is FileLotto => !!f)
      .sort((a, b) => a.indice - b.indice);
    const mancanti = attuali.filter(daLeggere);
    if (mancanti.length === 0) return attuali.map(perIlBrowser);

    //  Stessi screenshot già letti in questo lotto: non si rileggono (D4).
    const scritti = new Map<number, FileLotto>();
    const daAi: FileLotto[] = [];
    for (const f of mancanti) {
      const originale = [...tutti.values()]
        .filter(
          (o) =>
            o.indice !== f.indice && o.impronta === f.impronta && o.stato === "letto" && o.lettura,
        )
        .sort((a, b) => a.indice - b.indice)[0];
      if (originale) {
        const copia: FileLotto = {
          ...f,
          stato: "letto",
          tipo: originale.tipo,
          copiaDi: originale.copiaDi ?? originale.indice,
          lettura: structuredClone(originale.lettura),
        };
        scritti.set(f.indice, copia);
      } else daAi.push(f);
    }

    if (daAi.length) {
      const esito = await chiediAllAi(porte, lotto, daAi);
      if (!esito.ok) {
        //  `troncata` e `illeggibile` si ripagherebbero identiche: si ricordano, e si rileggono solo con «Rileggi».
        for (const f of daAi)
          await scrivi(porte, chiaveFile(lotto, f.indice), {
            ...f,
            stato: "errore",
            errore: esito.codice,
          });
        throw new ErroreBulk(esito.codice);
      }
      daAi.forEach((f, i) => {
        const lettura = esito.letture[i];
        scritti.set(f.indice, { ...f, stato: "letto", tipo: lettura.tipo, lettura });
      });
    }
    for (const f of scritti.values()) await scrivi(porte, chiaveFile(lotto, f.indice), f, true);
    return attuali.map((f) => perIlBrowser(scritti.get(f.indice) ?? f));
  });
}

/** Una rilettura cambia ciò che la persona ha confermato (CF, importo, data): le righe che contengono quei file,
 *  prima o dopo la rilettura (un tipo diverso può spostare i raggruppamenti), tornano «da confermare». Le conferme
 *  di un `idRiga` che non esiste più sono innocue: nessuna riga lo richiama. */
async function togliLeConferme(
  porte: PorteBulk,
  lotto: string,
  prima: Map<number, FileLotto>,
  nuovi: FileLotto[],
): Promise<void> {
  const dopo = new Map(prima);
  for (const f of nuovi) dopo.set(f.indice, f);
  const toccati = new Set(nuovi.map((f) => f.indice));
  const ids = new Set(
    [...ricomponi(comeTipi(prima.values())), ...ricomponi(comeTipi(dopo.values()))]
      .filter((g) => g.indici.some((i) => toccati.has(i)))
      .map((g) => g.idRiga),
  );
  if (ids.size === 0) return;
  const esistenti = (await porte.archivio.leggiMolte([...ids].map((id) => chiaveRiga(lotto, id))))
    .map((r) => leggiJson<DecisioniRiga>(r.value))
    .filter(
      (d): d is DecisioniRiga =>
        !!d && d.stato === "aperta" && (!!d.confermata || !!d.confermeAvvisi?.length),
    );
  for (const d of esistenti)
    await aggiornaRiga(porte, lotto, d.idRiga, (a) =>
      a.stato === "aperta" ? { ...a, confermata: false, confermeAvvisi: [] } : a,
    );
}

/** `rileggi`: gesto esplicito, si paga. Se la nuova lettura fallisce la vecchia resta com'era (il TIPO di un file
 *  decide come si raggruppano i clienti: perderlo spostherebbe le righe). */
async function rileggi(porte: PorteBulk, lotto: string, indici: number[]): Promise<FileLotto[]> {
  const tutti = await fileDelLotto(porte, lotto);
  const files = indici.map((i) => tutti.get(i));
  if (files.some((f) => !f)) throw new ErroreBulk("non_trovato");
  const scelti = files as FileLotto[];
  if (
    scelti.some(
      (f) => !["salvato", "letto", "errore"].includes(f.stato) || typeof f.percorso !== "string",
    )
  )
    throw new ErroreBulk("file_non_valido");
  const gruppi = [...new Set(scelti.map((f) => Math.floor(f.indice / 3)))].sort((a, b) => a - b);
  return conReclami(porte, lotto, gruppi, async () => {
    const esito = await chiediAllAi(porte, lotto, scelti);
    if (!esito.ok) throw new ErroreBulk(esito.codice);
    const nuovi = scelti.map((f, i) => {
      const lettura = esito.letture[i];
      const { errore: _errore, copiaDi: _copiaDi, ...base } = f;
      return { ...base, stato: "letto" as const, tipo: lettura.tipo, lettura };
    });
    for (const f of nuovi) await scrivi(porte, chiaveFile(lotto, f.indice), f, true);
    await togliLeConferme(porte, lotto, tutti, nuovi);
    return nuovi.map(perIlBrowser);
  });
}

/* ══ 9. LE RIGHE ═══════════════════════════════════════════════════════════ */

async function salvaRiga(
  porte: PorteBulk,
  r: Extract<RichiestaBulk, { azione: "salva-riga" }>,
): Promise<RispostaBulk> {
  await testataOppureErrore(porte, r.lotto);
  const file = await fileDelLotto(porte, r.lotto);
  if (!ricomponi(comeTipi(file.values())).some((c) => c.idRiga === r.idRiga))
    throw new ErroreBulk("non_trovato");
  if (r.scarta) {
    const riga = await chiudiRiga(porte, r.lotto, r.idRiga, "scartata");
    return {
      ok: true,
      azione: "salva-riga",
      riga,
      lottoChiuso: await chiudiLottoSeConcluso(porte, r.lotto),
    };
  }
  const riga = await aggiornaRiga(porte, r.lotto, r.idRiga, (attuale) => {
    if (attuale.stato !== "aperta") throw new ErroreBulk("conflitto");
    const nuova: DecisioniRiga = { ...attuale };
    //  ⚠️ Quello che si è confermato vale per i dati che la persona aveva davanti: una modifica o un cambio di
    //   scheda (a chi va la fattura) toglie la conferma della riga e degli avvisi. La stessa scheda riscritta no.
    let azzera = false;
    if (r.modifiche && Object.keys(r.modifiche).length) {
      nuova.modifiche = { ...attuale.modifiche, ...r.modifiche };
      azzera = true;
    }
    if (r.scheda !== undefined) {
      if (r.scheda !== attuale.scheda) azzera = true;
      nuova.scheda = r.scheda;
    }
    if (azzera) {
      nuova.confermata = false;
      nuova.confermeAvvisi = [];
    }
    if (r.confermaRiga !== undefined) nuova.confermata = r.confermaRiga;
    if (r.confermaAvvisi !== undefined) nuova.confermeAvvisi = [...new Set(r.confermaAvvisi)];
    return nuova;
  });
  return { ok: true, azione: "salva-riga", riga, lottoChiuso: false };
}

/* ══ 10. LE AZIONI POST ════════════════════════════════════════════════════ */

/** Smista le azioni POST (tranne `emetti-riga`). Tutte rilanciano `ErroreBulk` per gli errori attesi. */
export async function eseguiAzione(
  porte: PorteBulk,
  richiesta: RichiestaBulk,
): Promise<RispostaBulk> {
  switch (richiesta.azione) {
    case "crea": {
      const azienda = await leggiAziendaSu(porte.archivio);
      const motivi = controllaLotto(azienda);
      if (motivi.length)
        throw new ErroreBulk("richiesta_non_valida", motivi.map((m) => m.testo).join(" "));
      const lotto = porte.id();
      const testata: TestataLotto = {
        lotto,
        creatoIl: iso(porte.adesso()),
        descrizione: richiesta.descrizione,
        dataSeManca: richiesta.dataSeManca ?? "",
        firmaImpostazioni: firmaImpostazioni(azienda),
      };
      const esito = await porte.archivio.creaSeAssente(
        chiaveTestata(lotto),
        JSON.stringify(testata),
      );
      if (esito.stato !== "creata") throw new ErroreBulk("scrittura_fallita");
      return { ok: true, azione: "crea", lotto };
    }
    case "file":
      return caricaFile(porte, richiesta);
    case "leggi-gruppo": {
      await testataOppureErrore(porte, richiesta.lotto);
      return {
        ok: true,
        azione: "leggi-gruppo",
        file: await leggiGruppo(porte, richiesta.lotto, richiesta.gruppo),
      };
    }
    case "rileggi": {
      await testataOppureErrore(porte, richiesta.lotto);
      return {
        ok: true,
        azione: "rileggi",
        file: await rileggi(porte, richiesta.lotto, richiesta.indici),
      };
    }
    case "salva-riga":
      return salvaRiga(porte, richiesta);
    case "prendi-controllo": {
      await testataOppureErrore(porte, richiesta.lotto);
      const preso = await prendiIlControllo(
        porte.lucchetto,
        chiaveEmittente(richiesta.lotto),
        richiesta.emittente,
        SCADENZA_EMITTENTE_MS,
        porte.adesso(),
      );
      if (!preso) throw new ErroreBulk("conflitto");
      return { ok: true, azione: "prendi-controllo" };
    }
    case "annulla": {
      await testataOppureErrore(porte, richiesta.lotto);
      return { ok: true, azione: "annulla", rimossi: await cancellaLotto(porte, richiesta.lotto) };
    }
    case "pulisci":
      return { ok: true, azione: "pulisci", rimossi: await pulisci(porte, richiesta.lotto) };
    default:
      //  `emetti-riga` non passa di qui, e un'azione sconosciuta non è una richiesta valida.
      throw new ErroreBulk("richiesta_non_valida");
  }
}

/* ══ 11. CONTROLLARE CIÒ CHE ARRIVA DAL BROWSER ════════════════════════════ */

/** Tetto del corpo di una richiesta (caratteri). */
const MAX_CORPO = 12_000_000;
const NON_VALIDA = () => new ErroreBulk("richiesta_non_valida");
// eslint-disable-next-line no-control-regex
const COMANDI = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;
const ID_RIGA = /^\d{4}(-\d{4}){0,2}$/;
const ID_EMITTENTE = /^[A-Za-z0-9-]{8,64}$/;
const CAMPI_TESTO = [
  "nome",
  "cognome",
  "codiceFiscale",
  "indirizzo",
  "cap",
  "comune",
  "provincia",
  "riferimento",
] as const;
const MODI = ["contanti", "bonifico", "carta", "pos"];
const CAMPI_AMMESSI = new Set<string>([...CAMPI_TESTO, "importo", "data", "modo"]);

const oggetto = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw NON_VALIDA();
  return v as Record<string, unknown>;
};
const testo = (v: unknown, max: number): string => {
  if (typeof v !== "string" || v.length > max || COMANDI.test(v)) throw NON_VALIDA();
  return v.trim();
};
const intero = (v: unknown, da: number, a: number): number => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < da || v > a) throw NON_VALIDA();
  return v;
};
const giornoIso = (v: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
function lottoDi(v: unknown): string {
  if (typeof v !== "string" || !lottoValido(v)) throw NON_VALIDA();
  return v;
}
function idRigaDi(v: unknown): string {
  if (typeof v !== "string" || !ID_RIGA.test(v)) throw NON_VALIDA();
  //  Solo la forma canonica: indici crescenti, senza ripetizioni.
  if (idRigaDa(v.split("-").map(Number)) !== v) throw NON_VALIDA();
  return v;
}
function emittenteDi(v: unknown): string {
  if (typeof v !== "string" || !ID_EMITTENTE.test(v)) throw NON_VALIDA();
  return v;
}

function modificheDi(v: unknown): Partial<CampiRiga> {
  const o = oggetto(v);
  const out: Record<string, string | number | null> = {};
  for (const [k, val] of Object.entries(o)) {
    if (!CAMPI_AMMESSI.has(k)) throw NON_VALIDA();
    if (k === "importo") {
      if (
        val !== null &&
        (typeof val !== "number" || !Number.isFinite(val) || val < 0 || val > 1_000_000)
      )
        throw NON_VALIDA();
      out[k] = val as number | null;
    } else if (k === "data") {
      const d = testo(val, 10);
      if (d !== "" && !giornoIso(d)) throw NON_VALIDA();
      out[k] = d;
    } else if (k === "modo") {
      const m = testo(val, 20);
      if (m !== "" && !MODI.includes(m)) throw NON_VALIDA();
      out[k] = m;
    } else out[k] = testo(val, 120);
  }
  return out as Partial<CampiRiga>;
}

/** Il corpo JSON del browser → una richiesta valida, o `ErroreBulk`. Niente di quel che arriva si usa prima di qui. */
export function leggiRichiesta(
  corpo: unknown,
): RichiestaBulk | { azione: "emetti-riga"; lotto: string; idRiga: string; emittente: string } {
  const b = oggetto(corpo);
  switch (b.azione) {
    case "crea": {
      //  Ogni pagamento è una fattura «unica» (D3): un `tipo` diverso non si accetta nemmeno.
      if (b.tipo !== undefined && b.tipo !== "unica") throw NON_VALIDA();
      const descrizione = testo(b.descrizione ?? "", 100);
      const dataSeManca = b.dataSeManca === undefined ? "" : testo(b.dataSeManca, 10);
      if (dataSeManca !== "" && !giornoIso(dataSeManca)) throw NON_VALIDA();
      return { azione: "crea", descrizione, dataSeManca };
    }
    case "file": {
      const lotto = lottoDi(b.lotto);
      if (
        typeof b.indice !== "number" ||
        !Number.isInteger(b.indice) ||
        b.indice < 0 ||
        b.indice > 9999
      )
        throw NON_VALIDA();
      if (b.indice >= MAX_FILE) throw new ErroreBulk("troppi_file");
      if (typeof b.impronta !== "string" || !/^[0-9a-f]{64}$/.test(b.impronta)) throw NON_VALIDA();
      //  Solo JPEG (lo produce la riduzione del browser) e dentro i limiti di sempre (2 KB - 8 MB).
      if (
        typeof b.dataUrl !== "string" ||
        !b.dataUrl.startsWith("data:image/jpeg;base64,") ||
        !documentoAccettabile(b.dataUrl).ok
      )
        throw new ErroreBulk("file_non_valido");
      return { azione: "file", lotto, indice: b.indice, impronta: b.impronta, dataUrl: b.dataUrl };
    }
    case "leggi-gruppo":
      return {
        azione: "leggi-gruppo",
        lotto: lottoDi(b.lotto),
        gruppo: intero(b.gruppo, 0, Math.ceil(MAX_FILE / 3) - 1),
      };
    case "rileggi": {
      if (!Array.isArray(b.indici) || b.indici.length < 1 || b.indici.length > 3)
        throw NON_VALIDA();
      const indici = b.indici.map((i) => intero(i, 0, MAX_FILE - 1));
      if (new Set(indici).size !== indici.length) throw NON_VALIDA();
      return { azione: "rileggi", lotto: lottoDi(b.lotto), indici };
    }
    case "salva-riga": {
      const lotto = lottoDi(b.lotto);
      const idRiga = idRigaDi(b.idRiga);
      const r: Extract<RichiestaBulk, { azione: "salva-riga" }> = {
        azione: "salva-riga",
        lotto,
        idRiga,
      };
      if (b.modifiche !== undefined) r.modifiche = modificheDi(b.modifiche);
      if (b.scheda !== undefined) r.scheda = b.scheda === null ? null : testo(b.scheda, 80);
      if (b.confermaRiga !== undefined) {
        if (typeof b.confermaRiga !== "boolean") throw NON_VALIDA();
        r.confermaRiga = b.confermaRiga;
      }
      if (b.confermaAvvisi !== undefined) {
        if (!Array.isArray(b.confermaAvvisi) || b.confermaAvvisi.length > 30) throw NON_VALIDA();
        r.confermaAvvisi = b.confermaAvvisi.map((c) => {
          if (typeof c !== "string" || !/^[a-z0-9_]{1,40}$/.test(c)) throw NON_VALIDA();
          return c;
        });
      }
      if (b.scarta !== undefined) {
        if (typeof b.scarta !== "boolean") throw NON_VALIDA();
        r.scarta = b.scarta;
      }
      //  Una modifica e una conferma nella stessa richiesta: la persona non ha visto il risultato della modifica.
      if (
        ((r.modifiche && Object.keys(r.modifiche).length) || r.scheda !== undefined) &&
        (r.confermaRiga !== undefined || r.confermaAvvisi !== undefined || r.scarta)
      )
        throw NON_VALIDA();
      return r;
    }
    case "emetti-riga":
      return {
        azione: "emetti-riga",
        lotto: lottoDi(b.lotto),
        idRiga: idRigaDi(b.idRiga),
        emittente: emittenteDi(b.emittente),
      };
    case "prendi-controllo":
      return {
        azione: "prendi-controllo",
        lotto: lottoDi(b.lotto),
        emittente: emittenteDi(b.emittente),
      };
    case "annulla":
      return { azione: "annulla", lotto: lottoDi(b.lotto) };
    case "pulisci":
      return b.lotto === undefined
        ? { azione: "pulisci" }
        : { azione: "pulisci", lotto: lottoDi(b.lotto) };
    default:
      throw NON_VALIDA();
  }
}

/* ══ 12. LA ROTTA: GUARDIA + SMISTAMENTO ═══════════════════════════════════ */

/** Quello che la rotta passa: la guardia (`guardiaCRM` col permesso «pagamenti»), le porte vere per
 *  quell'utente e l'emissione (T12). Così `gestisciGET`/`gestisciPOST` si provano con finti. */
export interface DipendenzeRotta {
  guardia: (
    request: Request,
  ) => Promise<{ ok: true; utente: string } | { ok: false; risposta: Response }>;
  porte: (utente: string) => PorteBulk;
  emettiRiga: (
    porte: PorteBulk,
    richiesta: { lotto: string; idRiga: string; emittente: string },
  ) => Promise<RispostaEmettiRiga>;
}

export async function gestisciGET(request: Request, d: DipendenzeRotta): Promise<Response> {
  const g = await d.guardia(request);
  if (!g.ok) return g.risposta;
  const porte = d.porte(g.utente);
  try {
    const q = new URL(request.url).searchParams;
    const lotto = q.get("lotto");
    //  GET: solo lettura. ⚠️ Qui dentro non si cancella niente: la pulizia è `pulisci`, un POST.
    if (lotto === null) return json(await elencoLotti(porte));
    if (!lottoValido(lotto)) throw NON_VALIDA();
    const url = q.get("url");
    if (url !== null) {
      const pezzi = url.split(",");
      if (!pezzi.every((p) => /^\d{1,4}$/.test(p))) throw NON_VALIDA();
      return json(await urlMiniature(porte, lotto, pezzi.map(Number)));
    }
    const dettaglio = await dettaglioLotto(porte, lotto);
    if (!dettaglio) throw new ErroreBulk("non_trovato");
    return json(dettaglio);
  } catch (e) {
    return rispostaDaErrore(e, porte, "GET");
  }
}

export async function gestisciPOST(request: Request, d: DipendenzeRotta): Promise<Response> {
  const g = await d.guardia(request);
  if (!g.ok) return g.risposta;
  const porte = d.porte(g.utente);
  let azione = "POST";
  try {
    //  Un file ridotto pesa meno di 8 MB (circa 10,7 M caratteri in base64): oltre il tetto non si legge nemmeno.
    let corpo: unknown;
    try {
      const lungo = Number(request.headers.get("content-length") ?? 0);
      if (lungo > MAX_CORPO) throw NON_VALIDA();
      const grezzo = await request.text();
      if (grezzo.length > MAX_CORPO) throw NON_VALIDA();
      corpo = JSON.parse(grezzo);
    } catch {
      throw NON_VALIDA();
    }
    const richiesta = leggiRichiesta(corpo);
    azione = richiesta.azione;
    if (richiesta.azione === "emetti-riga") {
      let esito: RispostaEmettiRiga;
      try {
        esito = await d.emettiRiga(porte, {
          lotto: richiesta.lotto,
          idRiga: richiesta.idRiga,
          emittente: richiesta.emittente,
        });
      } catch (e) {
        //  Un errore dell'emissione è un errore di sistema: la risposta dice «ferma», non «saltata».
        porte.log(`emetti-riga ${e instanceof ErroreBulk ? e.codice : "interno"}`);
        esito = {
          ok: true,
          esito: "ferma",
          codice: e instanceof ErroreBulk ? e.codice : "interno",
          messaggio: e instanceof ErroreBulk ? e.messaggio : MESSAGGI.interno,
        };
      }
      return json({ azione: "emetti-riga", ...esito });
    }
    return json(await eseguiAzione(porte, richiesta));
  } catch (e) {
    return rispostaDaErrore(e, porte, azione);
  }
}

/** Il limite di sottorichieste per azione (D13), riesportato perché le prove lo confrontano con le porte contate. */
export const LIMITE_SOTTORICHIESTE = MAX_SOTTORICHIESTE;
