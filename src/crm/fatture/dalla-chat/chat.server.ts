/** ── FATTURE DALLA CHAT · IL MAGAZZINO DELLA ROTTA (chat.server.ts) ─────────
 *  Commessa 2026-11-13-fatture-dalla-chat, T5 (PIANO §3, §4). Le azioni della
 *  rotta (§3 del piano) con le PORTE iniettate (archivio, lucchetto, bucket,
 *  AI, raccolta dalla chat, schede), così si provano con finti; il client
 *  Supabase vero si crea solo nella rotta (`api.crm.fatture-chat.ts`), come
 *  `bulk.server.ts`/`api.crm.fatture-bulk.ts`.
 *  ⚠️ Deve restare importabile senza ambiente: niente `process.env`, niente
 *   client creato a livello di modulo, o si rompe il bundle di tutte le prove.
 *
 *  ── LE REGOLE CHE TIENE QUESTO FILE ────────────────────────────────────────
 *  · Niente dati personali nei log: `porte.log` riceve solo CODICI.
 *  · Un GET non cancella mai. Le cancellazioni (annulla, pulisci, scarto, chiusura
 *    del lotto) sono POST; il ritentativo di una cancellazione fallita è `pulisci`.
 *  · `lotto`, `idRiga` e `schedaId` si validano in formato (UUID per idRiga/schedaId,
 *    forma di `lottoValido` per lotto) PRIMA di costruire o fare `LIKE` su qualunque
 *    chiave `chat_fatture_*` — stessa disciplina di `sicuro(lotto)` nella bulk
 *    (PIANO §0.1 punto 4).
 *  · `aggiungi-cliente` (e, in difesa, `cerca-chat` se la riga non c'è ancora)
 *    scrivono la riga con `scheda: schedaId` NELLA STESSA SCRITTURA che la crea:
 *    mai un `insert` seguito da un `update`, perché altrimenti per un istante la
 *    riga esisterebbe senza `scheda` e la primissima valutazione (sul client)
 *    cadrebbe nel ramo `abbinaScheda()` di `bulk/valuta.ts`, che la SPEC esclude
 *    apposta per questa modalità (PIANO §0.1 punto 2, revisione del revisore punto 2).
 *  · Una sola emissione per volta in tutto il CRM: il lucchetto globale è
 *    `CHIAVE_LUCCHETTO` di `bulk/chiavi.ts` (import, non un secondo lucchetto).
 *
 *  ── ⚠️ QUESTO FILE NON CHIAMA `valuta-chat.ts` ────────────────────────────
 *  `valutaRigaChat`/`valutaLottoChat` (T3) producono una `RigaValutata`
 *  EFFIMERA (campi + stato + motivi), calcolata da chi mostra l'anteprima
 *  (client) o da chi emette (T6) — mai salvata in `app_config`, esattamente
 *  come la bulk non salva mai una `RigaValutata` ma solo `FileLotto`+
 *  `DecisioniRiga` grezzi (`bulk.server.ts` non chiama `valutaRiga` da nessuna
 *  parte: lo fa solo `emissione.server.ts`, subito prima di emettere). Qui
 *  `chat_fatture_r`/`chat_fatture_p` portano la stessa cosa per questa
 *  modalità: la LETTURA (tessera/indirizzo trovati o «niente», il pagamento
 *  letto) e le DECISIONI del titolare (modifiche, conferme, scarto) — mai il
 *  verdetto calcolato. `cerca-chat` usa `lettura-chat.ts` (T2) per scegliere
 *  cosa scrivere in `LetturaChat`, non `valuta-chat.ts`.
 *
 *  ── ⚠️ NESSUN WRAPPER «SOLO CHAT» SULL'ARCHIVIO (a differenza della bulk) ──
 *  `bulk.server.ts` avvolge l'archivio con `archivioSoloBulk` perché lo STESSO
 *  archivio serve anche a `emettiRiga` (via `archivioEmissione`, protetto a
 *  parte per `fattura:*`). Qui ogni scrittura passa SEMPRE da un costruttore di
 *  chiave di `./chiavi.ts` (`chiaveRiga`, `chiavePagamento`, `chiaveReclamo`,
 *  `chiaveTestata`, `chiaveEmittente`), che valida `lotto`/`idRiga` e
 *  antepone SEMPRE `chat_fatture_*`: non esiste un percorso di codice che
 *  scriva una chiave libera. Un secondo wrapper qui sarebbe una protezione
 *  ridondante su una cosa già garantita per costruzione — lo stesso principio
 *  per cui `dalla-chat/chiavi.ts` non ha bisogno di un `archivioSoloChat`. La
 *  sola lettura FUORI da quel prefisso è `leadGiaEmessi` (prefisso `fattura:`,
 *  candidati del passo 1): mai una scrittura.
 *
 *  ── ⚠️ LA MINIATURA DI TESSERA/INDIRIZZO NON È ANCORA DISPONIBILE ─────────
 *  PIANO §3 chiede, per `miniatura=tessera|indirizzo`, di rimandare al
 *  percorso Storage del `ponte_wa_media` corrispondente (come fa già
 *  `/api/crm/ponte-media` per le bolle immagine). Per farlo serve sapere DA
 *  QUALE messaggio/media è arrivata quella lettura (il suo `wa_message_id`),
 *  ma `LetturaChat`/`RigaChat` (T0, congelati) non portano quel riferimento:
 *  `raccogliChat` (T4) restituisce le immagini già come data URL, senza
 *  tenere il legame con la riga di `ponte_wa_media` di provenienza. Aggiungere
 *  quel riferimento è una modifica ai TIPI di T0, quindi la decide
 *  l'architetto (lavagna), non questo compito: finché non c'è, questa
 *  miniatura risponde `richiesta_non_valida` con un messaggio onesto. La
 *  miniatura del bonifico (`miniatura=pagamento`) funziona già, stesso schema
 *  della bulk (bucket `dati-fattura`, URL firmato a 60 s).
 *
 *  ── ⚠️ `emetti-riga` NON È QUI ─────────────────────────────────────────────
 *  Come nella bulk, l'emissione (T6, `emissione-chat.server.ts`) non esiste
 *  ancora in questo commit: `eseguiAzioneChat` non la smista (arriva alla
 *  rotta, che la passa a `DipendenzeRottaChat.emettiRiga`, iniettata — per ora
 *  un segnaposto onesto nella rotta vera, finché T6 non lo sostituisce). */
import { classificaTesto } from "../../chatwa/media";
import { combaciaRicerca } from "../../chatwa/cercaChat";
import type { Lead, PaymentInfo } from "../../types";
import { leggiAziendaSu } from "../archivio";
import { improntaSha256 } from "../bulk/immagini";
import {
  CHIAVE_LUCCHETTO,
  GIORNI_LOTTO_APERTO,
  lottoValido,
  RIMUOVI_A_GRUPPI,
  SCADENZA_EMITTENTE_MS,
  SCADENZA_RECLAMO_MS,
  TIMEOUT_AI_MS,
  URL_FIRMATI_SECONDI,
} from "../bulk/chiavi";
import { MESSAGGIO_POLITICA_DATI, type EsitoAI } from "../bulk/bulk.server";
import type { ArchivioProtetto } from "../bulk/emissione-bulk";
import { corpoRichiesta, leggiCorpoRisposta, leggiRispostaGruppo } from "../bulk/lettura-bulk";
import { prendi, prendiIlControllo, rilascia, type PortaLucchetto } from "../bulk/lucchetto.server";
import { controllaLotto, firmaImpostazioni } from "../bulk/regole-lotto";
import type {
  CampiRiga,
  CodiceErrore,
  Motivo,
  RispostaEmettiRiga,
  RispostaErrore,
} from "../bulk/tipi";
import { documentoAccettabile } from "../lettura-documento";
import { mimeDaUrl, PESO_MASSIMO_FILE } from "../dati-fattura";
import {
  cartellaBucket,
  chiaveEmittente,
  chiavePagamento,
  chiaveReclamo,
  chiaveRiga,
  chiaveTestata,
  idRigaValido,
  MAX_CLIENTI,
  prefissoPagamento,
  prefissoReclami,
  prefissoRighe,
  PREFISSO_TESTATA,
  schedaIdValido,
} from "./chiavi";
import { cercabileDaLead, haPagamentoSenzaFattura } from "./candidati";
import {
  corpoRichiestaChat,
  leggiRispostaChat,
  normalizzaIndirizzo,
  normalizzaTessera,
  sceglici,
  sceglindirizzo,
} from "./lettura-chat";
import {
  raccogliChat,
  type MediaPonteGrezzo,
  type MessaggioChatGrezzo,
  type PorteRaccoltaChat,
} from "./raccolta-chat.server";
import type {
  CandidatoChat,
  DettaglioLottoChat,
  LetturaChat,
  PagamentoChat,
  RichiestaChat,
  RigaChat,
  RispostaChat,
  SintesiLottoChat,
  TestataLottoChat,
} from "./tipi";

/* ══ 1. LE PORTE ═══════════════════════════════════════════════════════════ */

/** La scheda come serve a questo file: candidati (passo 1), `raccogliChat`
 *  (telefono per intero, non solo le ultime 9 cifre), e `sceglici` (nome/
 *  cognome, criterio interno per scegliere fra più tessere nella stessa chat —
 *  mai il valore che finisce in fattura, quello lo decide sempre il client con
 *  `valuta-chat.ts`, §0.1). */
export interface SchedaChatRiga {
  id: string;
  nome: string;
  cognome: string;
  /** Come scritto in scheda: `raccogliChat` ne ricava le ultime 9 cifre da sé. */
  telefono: string;
  payment: Pick<PaymentInfo, "accontoPagato" | "statoPagamento" | "dataPagamento"> | null;
}

export interface PorteChat {
  archivio: ArchivioProtetto;
  lucchetto: PortaLucchetto;
  bucket: {
    /** Carica con `upsert: false`. Torna il messaggio d'errore, o null. */
    carica: (percorso: string, dataUrl: string) => Promise<string | null>;
    scarica: (percorso: string) => Promise<string | null>;
    /** I nomi direttamente dentro la cartella; null = errore (non somiglia a «vuota»). */
    elenca: (cartella: string) => Promise<string[] | null>;
    rimuovi: (percorsi: string[]) => Promise<string | null>;
    firma: (percorso: string, secondi: number) => Promise<string | null>;
  };
  /** La raccolta dalla chat (T4): nessuna chiamata AI dentro, solo testo+immagini pronti. */
  raccolta: PorteRaccoltaChat;
  /** UN tentativo, con scadenza; il corpo lo costruisce chi chiama (`corpoRichiestaChat`
   *  per la chat, `corpoRichiesta([1 immagine])` della bulk per il pagamento). */
  ai: (corpo: unknown, timeoutMs: number) => Promise<EsitoAI>;
  adesso: () => number;
  id: () => string;
  /** Solo CODICI: mai id, nomi, percorsi o testi. */
  log: (codice: string) => void;
  utente: string;
  /** Tutte le schede (paginate), per i candidati del passo 1 e la ricerca manuale. */
  schede: () => Promise<SchedaChatRiga[]>;
  /** Una sola scheda (1 sottorichiesta, non tutte): `aggiungi-cliente`/`cerca-chat`. */
  scheda: (id: string) => Promise<SchedaChatRiga | null>;
}

/* ══ 2. ERRORI E RISPOSTE ══════════════════════════════════════════════════
 *  ⚠️ `MESSAGGI_CHAT`/`STATO_HTTP_CHAT` sono di questo file: quelli della bulk
 *  (`bulk.server.ts`) non sono esportati, e sono comunque `Record<CodiceErrore,…>`
 *  ESAUSTIVI — aggiungere un codice nuovo all'unione condivisa (`bulk/tipi.ts`)
 *  obbligherebbe a toccare anche quelle mappe nella bulk, fuori dal compito di
 *  questa commessa. Per questo il tetto `MAX_CLIENTI` (passo 1) riusa
 *  `richiesta_non_valida` con un messaggio proprio, invece di un codice nuovo. */
const MESSAGGI_CHAT: Partial<Record<CodiceErrore, string>> = {
  richiesta_non_valida: "Richiesta non valida.",
  non_trovato: "Non trovo il caricamento: forse è stato annullato o concluso.",
  conflitto: "Il dato è cambiato nel frattempo: riprova.",
  occupato: "Un'altra scheda sta già lavorando su questo: riprova fra poco.",
  scrittura_fallita: "Non sono riuscito a salvare: riprova.",
  file_non_valido: "Il file non è valido: carica uno screenshot (JPG) più leggero di 8 MB.",
  troncata: "La risposta dell'intelligenza artificiale è stata tagliata: riprova con «Rileggi».",
  illeggibile: "Non sono riuscito a leggere niente di sicuro: riprova con «Rileggi».",
  timeout: "La lettura ha impiegato troppo: riprova fra poco.",
  limite: "Troppe richieste all'intelligenza artificiale: si riprova fra poco.",
  credito: "Il credito dell'intelligenza artificiale è finito.",
  rete: "Collegamento interrotto: riprova fra poco.",
  politica_dati: MESSAGGIO_POLITICA_DATI,
  emittente_occupato: "Un'altra scheda sta emettendo le fatture di questo caricamento.",
  lucchetto_occupato: "Un'altra emissione è in corso: riprova fra poco.",
  non_autorizzato: "Serve l'accesso al CRM: rientra col tuo PIN.",
  non_permesso: "Non hai il permesso per le fatture.",
  interno: "Errore interno: riprova; se si ripete avvisa l'assistenza.",
};
const MESSAGGIO_DEFAULT = MESSAGGI_CHAT.interno!;

const STATO_HTTP_CHAT: Partial<Record<CodiceErrore, number>> = {
  richiesta_non_valida: 400,
  non_trovato: 404,
  conflitto: 409,
  occupato: 409,
  scrittura_fallita: 500,
  file_non_valido: 400,
  troncata: 502,
  illeggibile: 502,
  timeout: 504,
  limite: 429,
  credito: 402,
  rete: 502,
  politica_dati: 502,
  emittente_occupato: 409,
  lucchetto_occupato: 409,
  non_autorizzato: 401,
  non_permesso: 403,
  interno: 500,
};

export class ErroreChat extends Error {
  constructor(
    readonly codice: CodiceErrore,
    readonly messaggio: string = MESSAGGI_CHAT[codice] ?? MESSAGGIO_DEFAULT,
  ) {
    super(codice);
    this.name = "ErroreChat";
  }
}

const INTESTAZIONI = { "Content-Type": "application/json", "Cache-Control": "no-store" };
/** ⚠️ Nessuna intestazione CORS, di proposito: la rotta è solo della stessa origine (PIANO §3). */
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: INTESTAZIONI });

const rispostaErrore = (codice: CodiceErrore, messaggio?: string): RispostaErrore => ({
  ok: false,
  codice,
  messaggio: messaggio ?? MESSAGGI_CHAT[codice] ?? MESSAGGIO_DEFAULT,
});

function rispostaDaErrore(e: unknown, porte: PorteChat, azione: string): Response {
  const codice: CodiceErrore = e instanceof ErroreChat ? e.codice : "interno";
  porte.log(`${azione} ${codice}`);
  const messaggio = e instanceof ErroreChat ? e.messaggio : undefined;
  return json(rispostaErrore(codice, messaggio), STATO_HTTP_CHAT[codice] ?? 500);
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

/** Il percorso di un file DI QUESTO lotto, o null: i valori di `app_config` li può scrivere
 *  ogni utente del CRM, quindi un percorso letto da lì non si firma né si scarica se non sta
 *  nella cartella giusta (stessa guardia di `percorsoDelLotto` nella bulk). */
function percorsoDelLotto(utente: string, lotto: string, percorso: unknown): string | null {
  if (typeof percorso !== "string") return null;
  const cartella = cartellaBucket(utente, lotto);
  if (!percorso.startsWith(cartella)) return null;
  return /^[0-9a-f-]{8,40}\.jpg$/.test(percorso.slice(cartella.length)) ? percorso : null;
}

/** Dal data URL ai byte (per calcolare l'impronta: qui, a differenza della bulk, l'impronta
 *  non arriva dal client — `carica-pagamento` non la porta nel contratto, T0 — si calcola qui). */
function inByte(dataUrl: string): Uint8Array {
  const grezzo = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const byte = new Uint8Array(grezzo.length);
  for (let i = 0; i < grezzo.length; i++) byte[i] = grezzo.charCodeAt(i);
  return byte;
}

/** Una scrittura che, se fallisce, si ripete una volta: dopo una lettura a pagamento perderla
 *  vorrebbe dire pagarla due volte (stessa `scrivi` della bulk). */
async function scrivi(
  porte: PorteChat,
  chiave: string,
  valore: unknown,
  ripetizione = false,
): Promise<void> {
  const testo = JSON.stringify(valore);
  let errore = await porte.archivio.scrivi(chiave, testo);
  if (errore && ripetizione) errore = await porte.archivio.scrivi(chiave, testo);
  if (errore) throw new ErroreChat("scrittura_fallita");
}

async function togliDalBucket(porte: PorteChat, percorsi: string[]): Promise<boolean> {
  let bene = true;
  for (let i = 0; i < percorsi.length; i += RIMUOVI_A_GRUPPI) {
    if (await porte.bucket.rimuovi(percorsi.slice(i, i + RIMUOVI_A_GRUPPI))) bene = false;
  }
  return bene;
}

/* ══ 4. LE RIGHE: LETTURA GREZZA, CAS, UNIONE CON IL PAGAMENTO ═══════════════
 *  `chat_fatture_r` porta tutto di `RigaChat` TRANNE il pagamento (che vive da
 *  solo in `chat_fatture_p`, PIANO §2): questo file li unisce solo quando deve
 *  rispondere al client. */
type RigaSalvata = Omit<RigaChat, "pagamento">;

const conPagamento = (riga: RigaSalvata, pagamento?: PagamentoChat): RigaChat =>
  pagamento ? { ...riga, pagamento } : { ...riga };

async function testataDi(porte: PorteChat, lotto: string): Promise<TestataLottoChat | null> {
  return leggiJson<TestataLottoChat>(await porte.archivio.leggi(chiaveTestata(lotto)));
}
async function testataOppureErrore(porte: PorteChat, lotto: string): Promise<TestataLottoChat> {
  const t = await testataDi(porte, lotto);
  if (!t) throw new ErroreChat("non_trovato");
  return t;
}

async function rigaSalvataDi(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
): Promise<RigaSalvata | null> {
  return leggiJson<RigaSalvata>(await porte.archivio.leggi(chiaveRiga(lotto, idRiga)));
}
async function pagamentoDi(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
): Promise<PagamentoChat | null> {
  return leggiJson<PagamentoChat>(await porte.archivio.leggi(chiavePagamento(lotto, idRiga)));
}

/** Tutte le righe del lotto, per idRiga. UNA lettura. */
async function righeSalvateDelLotto(
  porte: PorteChat,
  lotto: string,
): Promise<Map<string, RigaSalvata>> {
  const righe = await porte.archivio.leggiPrefissoPerChiave(prefissoRighe(lotto));
  const m = new Map<string, RigaSalvata>();
  for (const r of righe) {
    const d = leggiJson<RigaSalvata>(r.value);
    if (d && typeof d.idRiga === "string") m.set(d.idRiga, d);
  }
  return m;
}
/** Tutti i pagamenti del lotto, per idRiga (ricavato dalla chiave: `PagamentoChat` non lo porta). */
async function pagamentiDelLotto(
  porte: PorteChat,
  lotto: string,
): Promise<Map<string, PagamentoChat>> {
  const righe = await porte.archivio.leggiPrefissoPerChiave(prefissoPagamento(lotto));
  const prefisso = prefissoPagamento(lotto);
  const m = new Map<string, PagamentoChat>();
  for (const r of righe) {
    const p = leggiJson<PagamentoChat>(r.value);
    if (p) m.set(r.key.slice(prefisso.length), p);
  }
  return m;
}

/** Aggiorna (o crea) la riga `idRiga` con un confronto sul valore letto (compare-and-swap),
 *  esattamente come `aggiornaRiga` nella bulk: riga assente → inserimento che fallisce se
 *  esiste; presente → `sostituisciSe` sul testo letto; 3 giri, poi `conflitto`.
 *  `schedaFallback` è la `scheda` da scrivere SE la riga non esiste ancora (mai `undefined`:
 *  §0.1 punto 2 — qui non può nascere una riga senza scheda, nemmeno nel ramo di difesa). */
async function aggiornaRiga(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
  schedaFallback: string,
  cambia: (attuale: RigaSalvata) => RigaSalvata,
): Promise<RigaSalvata> {
  const chiave = chiaveRiga(lotto, idRiga);
  for (let giro = 0; giro < 3; giro++) {
    const grezzo = await porte.archivio.leggi(chiave);
    const attuale: RigaSalvata = leggiJson<RigaSalvata>(grezzo) ?? {
      idRiga,
      scheda: schedaFallback,
      stato: "aperta" as const,
    };
    const nuova = cambia(attuale);
    const testo = JSON.stringify(nuova);
    if (grezzo !== null && testo === grezzo) return nuova;
    if (grezzo === null) {
      const esito = await porte.archivio.creaSeAssente(chiave, testo);
      if (esito.stato === "creata") return nuova;
      if (esito.stato === "errore") throw new ErroreChat("scrittura_fallita");
      // "esiste": un'altra richiesta l'ha creata un istante prima. Si rilegge al giro dopo.
    } else if (await porte.lucchetto.sostituisciSe(chiave, grezzo, testo)) return nuova;
  }
  throw new ErroreChat("conflitto");
}

/** Il reclamo di lettura (`chat_fatture_c`) di UNA riga, preso prima del lavoro e SEMPRE
 *  rilasciato dopo (stesso schema di `conReclami` nella bulk, ma una riga alla volta: qui non
 *  esistono gruppi di file). Se è di un altro e non è scaduto → `occupato`. */
async function conReclamo<T>(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
  lavoro: () => Promise<T>,
): Promise<T> {
  const io = porte.id();
  const chiave = chiaveReclamo(lotto, idRiga);
  const preso = await prendi(porte.lucchetto, chiave, io, SCADENZA_RECLAMO_MS, porte.adesso());
  if (!preso.ok) throw new ErroreChat("occupato");
  try {
    return await lavoro();
  } finally {
    await rilascia(porte.lucchetto, chiave, io).catch(() => porte.log("reclamo_non_rilasciato"));
  }
}

/** D11a/d della bulk, qui per una riga sola: PRIMA la verità (riga chiusa, pagamento ridotto a
 *  `{stato, impronta}`, senza percorso né lettura), POI il file tolto dal bucket. `chat` (la
 *  lettura della chat: CF, indirizzo…) si svuota come `lettura` nella bulk — stessa disciplina
 *  di minimizzazione: niente dati di persona restano su una riga chiusa. */
async function chiudiRigaChat(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
  stato: "emessa" | "scartata",
  emessa?: { id: string; numero: number; data: string },
): Promise<RigaChat> {
  const riga = await aggiornaRiga(porte, lotto, idRiga, idRiga, (attuale) => {
    if (attuale.stato === stato) return attuale;
    if (attuale.stato !== "aperta") throw new ErroreChat("conflitto");
    return { idRiga, scheda: attuale.scheda, stato, ...(emessa ? { emessa } : {}) };
  });
  const pagamento = await pagamentoDi(porte, lotto, idRiga);
  if (!pagamento) return conPagamento(riga, undefined);
  const residuo: PagamentoChat = {
    stato,
    ...(pagamento.impronta ? { impronta: pagamento.impronta } : {}),
  };
  await scrivi(porte, chiavePagamento(lotto, idRiga), residuo, true);
  const percorso = percorsoDelLotto(porte.utente, lotto, pagamento.percorso);
  if (percorso && (await porte.bucket.rimuovi([percorso]))) porte.log("rimozione_file_fallita");
  return conPagamento(riga, residuo);
}

/* ══ 5. IL LOTTO: CREAZIONE, CHIUSURA, PULIZIA ════════════════════════════ */

function lottoConcluso(righe: Map<string, RigaSalvata>): boolean {
  if (righe.size === 0) return false;
  return [...righe.values()].every((r) => r.stato === "emessa" || r.stato === "scartata");
}

/** Cancella UN lotto per intero: file nel bucket (dalla cartella, orfani compresi), poi le
 *  chiavi per prefisso (righe, pagamenti, reclami), poi emittente e testata — la testata per
 *  ULTIMA, come nella bulk: se qualcosa si ferma a metà il lotto resta visibile e si riprova. */
async function cancellaLotto(porte: PorteChat, lotto: string): Promise<number> {
  const cartella = cartellaBucket(porte.utente, lotto);
  const nomi = await porte.bucket.elenca(cartella);
  if (nomi === null) throw new ErroreChat("scrittura_fallita");
  const percorsi = nomi.map((n) => `${cartella}${n}`);
  if (!(await togliDalBucket(porte, percorsi))) throw new ErroreChat("scrittura_fallita");
  for (const prefisso of [prefissoRighe(lotto), prefissoPagamento(lotto), prefissoReclami(lotto)])
    if (await porte.archivio.eliminaPerPrefisso(prefisso))
      throw new ErroreChat("scrittura_fallita");
  if (await porte.archivio.elimina(chiaveEmittente(lotto)))
    throw new ErroreChat("scrittura_fallita");
  if (await porte.archivio.elimina(chiaveTestata(lotto))) throw new ErroreChat("scrittura_fallita");
  return percorsi.length;
}

/** Quando ogni riga è emessa o scartata il lotto sparisce da solo (resta solo la fattura).
 *  Un guasto qui NON fa fallire chi chiama: la riga resta chiusa e `pulisci` riprova. */
export async function chiudiLottoSeConcluso(porte: PorteChat, lotto: string): Promise<boolean> {
  try {
    const righe = await righeSalvateDelLotto(porte, lotto);
    if (!lottoConcluso(righe)) return false;
    await cancellaLotto(porte, lotto);
    return true;
  } catch {
    porte.log("chiusura_lotto_fallita");
    return false;
  }
}

/** I file nel bucket che nessun pagamento del lotto richiama (e quelli di righe chiuse). */
async function spazzaOrfani(porte: PorteChat, lotto: string): Promise<number> {
  const cartella = cartellaBucket(porte.utente, lotto);
  const nomi = await porte.bucket.elenca(cartella);
  if (nomi === null) throw new ErroreChat("rete");
  const pagamenti = await pagamentiDelLotto(porte, lotto);
  const richiamati = new Set<string>();
  for (const p of pagamenti.values())
    if (p.stato !== "emessa" && p.stato !== "scartata" && typeof p.percorso === "string")
      richiamati.add(p.percorso);
  const orfani = nomi.map((n) => `${cartella}${n}`).filter((p) => !richiamati.has(p));
  if (orfani.length && !(await togliDalBucket(porte, orfani)))
    throw new ErroreChat("scrittura_fallita");
  return orfani.length;
}

const scaduto = (t: TestataLottoChat, adesso: number) =>
  adesso - Date.parse(t.creatoIl) >= GIORNI_LOTTO_APERTO * 86_400_000;

/** `pulisci {lotto}`: quel lotto, se vecchio di 30 giorni sparisce intero; altrimenti si tolgono
 *  gli orfani e, se è concluso, si chiude. `pulisci {}`: un solo lavoro (un lotto scaduto, o una
 *  cartella del bucket senza lotto) — stessa logica della bulk, chiavi diverse. */
async function pulisciAzione(porte: PorteChat, lotto: string | undefined): Promise<number> {
  const adesso = porte.adesso();
  if (lotto !== undefined) {
    const t = await testataDi(porte, lotto);
    if (!t) return 0;
    if (scaduto(t, adesso)) return cancellaLotto(porte, lotto);
    const tolti = await spazzaOrfani(porte, lotto);
    await chiudiLottoSeConcluso(porte, lotto);
    return tolti;
  }
  const radice = `${porte.utente}/chat/`;
  const cartelle = await porte.bucket.elenca(radice);
  if (cartelle === null) throw new ErroreChat("rete");
  const testate = (await porte.archivio.leggiPrefissoPerChiave(PREFISSO_TESTATA))
    .map((r) => leggiJson<TestataLottoChat>(r.value))
    .filter((t): t is TestataLottoChat => !!t && lottoValido(String(t.lotto)));
  const vecchio = testate.find((t) => scaduto(t, adesso));
  if (vecchio) return cancellaLotto(porte, vecchio.lotto);
  const conTestata = new Set(testate.map((t) => t.lotto));
  const senza = cartelle.find((n) => lottoValido(n) && !conTestata.has(n));
  if (!senza) return 0;
  const cartella = `${radice}${senza}/`;
  const nomi = await porte.bucket.elenca(cartella);
  if (nomi === null) throw new ErroreChat("rete");
  const percorsi = nomi.map((n) => `${cartella}${n}`);
  if (!(await togliDalBucket(porte, percorsi))) throw new ErroreChat("scrittura_fallita");
  return percorsi.length;
}

/* ══ 6. LEGGERE I LOTTI (GET) ══════════════════════════════════════════════ */

const MAX_LOTTI_ELENCO = 15;

async function elencoLotti(porte: PorteChat): Promise<SintesiLottoChat[]> {
  const testate = (await porte.archivio.leggiPrefissoPerChiave(PREFISSO_TESTATA))
    .map((r) => leggiJson<TestataLottoChat>(r.value))
    .filter((t): t is TestataLottoChat => !!t && lottoValido(String(t.lotto)))
    .sort((a, b) => String(b.creatoIl).localeCompare(String(a.creatoIl)))
    .slice(0, MAX_LOTTI_ELENCO);
  const out: SintesiLottoChat[] = [];
  for (const t of testate) {
    const valori = [...(await righeSalvateDelLotto(porte, t.lotto)).values()];
    out.push({
      lotto: t.lotto,
      creatoIl: t.creatoIl,
      clienti: valori.length,
      letti: valori.filter((r) => r.chat?.letta).length,
      righeAperte: valori.filter((r) => r.stato === "aperta").length,
      righeEmesse: valori.filter((r) => r.stato === "emessa").length,
    });
  }
  return out;
}

async function dettaglioLotto(porte: PorteChat, lotto: string): Promise<DettaglioLottoChat | null> {
  if (!lottoValido(lotto)) throw new ErroreChat("richiesta_non_valida");
  const testata = await testataDi(porte, lotto);
  if (!testata) return null;
  const [righe, pagamenti] = [
    await righeSalvateDelLotto(porte, lotto),
    await pagamentiDelLotto(porte, lotto),
  ];
  return {
    testata,
    righe: [...righe.values()].map((r) => conPagamento(r, pagamenti.get(r.idRiga))),
  };
}

/** Gli id delle schede che hanno già una fattura emessa: letti dal prefisso `fattura:`, la stessa
 *  famiglia che la bulk legge in `emissione.server.ts` (`leggiFatture`) — qui solo in lettura,
 *  mai una chiave `chat_fatture_*` qui dentro. */
async function leadGiaEmessi(porte: PorteChat): Promise<Set<string>> {
  const righe = await porte.archivio.leggiPrefissoPerChiave("fattura:");
  const out = new Set<string>();
  for (const r of righe) {
    try {
      const f = JSON.parse(r.value) as { leadId?: unknown };
      if (typeof f.leadId === "string" && f.leadId) out.add(f.leadId);
    } catch {
      /* una riga illeggibile non abbatte l'elenco, come in archivio.ts */
    }
  }
  return out;
}

const ultime9 = (t: string) => {
  const cifre = String(t ?? "").replace(/\D/g, "");
  return cifre.length >= 9 ? cifre.slice(-9) : "";
};

/** Adatta `SchedaChatRiga` a `Lead` per `cercabileDaLead`/`combaciaRicerca` (T1, import non
 *  copia): qui serve solo nome/cognome/telefono, il resto di `Lead` non esiste davvero — stesso
 *  «solito inganno sui tipi» già in uso altrove nel CRM per adattatori strutturali. */
const comeLead = (s: SchedaChatRiga): Lead =>
  ({ data: { nome: s.nome, cognome: s.cognome, telefono: s.telefono } }) as unknown as Lead;

/** SPEC §3 passo 1, §6.1: senza ricerca, solo pagamento-senza-fattura; CON ricerca, qualunque
 *  scheda la trovi (anche senza pagamento) — ma mai una già fatturata, in nessuno dei due casi:
 *  riproporla in un secondo caricamento rischierebbe una doppia fattura (decisione di questo
 *  file, non scritta a parole nel piano: lo segnalo in lavagna). */
async function candidatiElenco(porte: PorteChat, ricerca: string): Promise<CandidatoChat[]> {
  const [tutte, emessi] = [await porte.schede(), await leadGiaEmessi(porte)];
  const disponibili = tutte.filter((s) => !emessi.has(s.id));
  const q = ricerca.trim();
  const scelti = q
    ? disponibili.filter((s) => combaciaRicerca(cercabileDaLead(comeLead(s)), q))
    : disponibili.filter((s) => haPagamentoSenzaFattura(s.payment));
  return scelti.slice(0, MAX_CLIENTI).map((s) => ({
    schedaId: s.id,
    nome: s.nome,
    cognome: s.cognome,
    telefono: ultime9(s.telefono),
    importoPagato: typeof s.payment?.accontoPagato === "number" ? s.payment.accontoPagato : null,
    dataPagamento: s.payment?.dataPagamento ?? "",
  }));
}

/** Indirizzo FIRMATO (60 s) per una miniatura. Solo `pagamento` è disponibile oggi: vedi
 *  l'intestazione del file sul perché `tessera`/`indirizzo` non lo sono ancora. */
async function urlMiniatura(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
  tipo: string,
): Promise<Record<string, string>> {
  if (!lottoValido(lotto) || !idRigaValido(idRiga)) throw new ErroreChat("richiesta_non_valida");
  if (tipo !== "pagamento")
    throw new ErroreChat(
      "richiesta_non_valida",
      "Questa miniatura non è ancora disponibile da questa rotta.",
    );
  const pagamento = await pagamentoDi(porte, lotto, idRiga);
  const percorso = pagamento ? percorsoDelLotto(porte.utente, lotto, pagamento.percorso) : null;
  if (!percorso || pagamento?.stato === "emessa" || pagamento?.stato === "scartata") return {};
  const url = await porte.bucket.firma(percorso, URL_FIRMATI_SECONDI);
  return url ? { [idRiga]: url } : {};
}

/* ══ 7. LA LETTURA DELLA CHAT (`cerca-chat`/`rileggi-chat`) ═══════════════════
 *  Una riga per chiamata (come `leggi-gruppo` nella bulk). `lettura-chat.ts`
 *  (T2) sceglie cosa entra in `LetturaChat`; questo file non chiama
 *  `valuta-chat.ts` (vedi l'intestazione del file). */
async function letturaChatDi(porte: PorteChat, scheda: SchedaChatRiga): Promise<LetturaChat> {
  const raccolta = await raccogliChat(porte.raccolta, porte.utente, scheda.telefono);
  const corpo = corpoRichiestaChat(raccolta.testo, raccolta.immagini);
  const esito = await porte.ai(corpo, TIMEOUT_AI_MS);
  if ("errore" in esito) throw new ErroreChat(esito.errore, esito.messaggio);
  const risposta = leggiRispostaChat(esito.testo, esito.fine);
  if (!risposta.ok) throw new ErroreChat(risposta.codice);
  const sTessera = sceglici(risposta.tessere.map(normalizzaTessera), {
    nome: scheda.nome,
    cognome: scheda.cognome,
  });
  const sIndirizzo = sceglindirizzo(risposta.indirizzi.map(normalizzaIndirizzo));
  const motivi = [sTessera.avviso, sIndirizzo.avviso].filter((m): m is Motivo => !!m);
  // SPEC §5: il segnaposto si dice solo se resta CF o indirizzo vuoto (altrimenti è solo rumore).
  const segnaposto = raccolta.segnaposto && (!sTessera.campo || !sIndirizzo.campo);
  return {
    letta: true,
    ...(sTessera.campo ? { tessera: sTessera.campo } : {}),
    ...(sIndirizzo.campo ? { indirizzo: sIndirizzo.campo } : {}),
    motivi,
    segnaposto,
  };
}

async function cercaChatAzione(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
  rileggi: boolean,
): Promise<RispostaChat> {
  await testataOppureErrore(porte, lotto);
  let salvata = await rigaSalvataDi(porte, lotto, idRiga);
  if (!salvata) {
    // Difesa (non dovrebbe succedere, PIANO §3): la riga nasce comunque già con la scheda.
    salvata = { idRiga, scheda: idRiga, stato: "aperta" };
    const esito = await porte.archivio.creaSeAssente(
      chiaveRiga(lotto, idRiga),
      JSON.stringify(salvata),
    );
    if (esito.stato === "errore") throw new ErroreChat("scrittura_fallita");
  }
  if (!rileggi && salvata.chat?.letta) {
    const pagamento = (await pagamentoDi(porte, lotto, idRiga)) ?? undefined;
    return { ok: true, azione: "cerca-chat", riga: conPagamento(salvata, pagamento) };
  }
  const scheda = await porte.scheda(salvata.scheda);
  if (!scheda)
    throw new ErroreChat("non_trovato", "La scheda collegata a questa riga non esiste più.");
  const schedaFallback = salvata.scheda;
  const rigaLetta = await conReclamo(porte, lotto, idRiga, async () => {
    // Rilettura DOPO il reclamo: chi ha finito un istante fa ha già scritto, e non si paga due volte.
    const fresca = (await rigaSalvataDi(porte, lotto, idRiga)) ?? salvata!;
    if (!rileggi && fresca.chat?.letta) return fresca;
    const chat = await letturaChatDi(porte, scheda);
    return aggiornaRiga(porte, lotto, idRiga, schedaFallback, (attuale) => ({ ...attuale, chat }));
  });
  const pagamento = (await pagamentoDi(porte, lotto, idRiga)) ?? undefined;
  return {
    ok: true,
    azione: rileggi ? "rileggi-chat" : "cerca-chat",
    riga: conPagamento(rigaLetta, pagamento),
  };
}

/* ══ 8. IL PAGAMENTO (`carica-pagamento`/`leggi-pagamento`) ═══════════════ */

/** Quanto vale un `caricando`: se il Worker muore fra la chiave e l'upload, dopo questo tempo il
 *  caricamento si ritenta (stessa costante, non esportata, di `caricaFile` nella bulk). */
const SCADENZA_CARICANDO_MS = 90_000;

/** ⚠️ CAS, come `caricaFile` nella bulk (`bulk.server.ts`): PRIMA si riserva la chiave con un
 *  segnaposto `{stato:"caricando", scadeIl}` (`creaSeAssente` se non c'era niente, `sostituisciSe`
 *  sul valore letto se c'era già un pagamento — un confronto-e-scambio, non un upsert), POI si
 *  carica nel bucket, POI si chiude il segnaposto con un altro `sostituisciSe`. Senza questo, due
 *  richieste insieme sulla stessa riga caricherebbero due file e l'ultima scrittura vincerebbe in
 *  silenzio: chi ha «perso» crederebbe salvato il proprio screenshot mentre la riga punta a quello
 *  dell'altro (osservazione del revisore). Con il CAS, la seconda trova `occupato`. */
async function caricaPagamentoAzione(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
  dataUrl: string,
): Promise<RispostaChat> {
  await testataOppureErrore(porte, lotto);
  const salvata = await rigaSalvataDi(porte, lotto, idRiga);
  if (!salvata) throw new ErroreChat("non_trovato");
  const impronta = await improntaSha256(inByte(dataUrl).buffer as ArrayBuffer);
  const chiave = chiavePagamento(lotto, idRiga);
  const adesso = porte.adesso();

  const grezzoEsistente = await porte.archivio.leggi(chiave);
  const esistente = leggiJson<PagamentoChat>(grezzoEsistente);

  // Stesso file già caricato (doppio invio): nessun secondo upload, nessuna nuova conferma persa.
  if (esistente?.impronta === impronta && esistente.percorso && esistente.stato !== "caricando")
    return { ok: true, azione: "carica-pagamento", riga: conPagamento(salvata, esistente) };
  // Un caricamento (di questo o di un altro screenshot) è già in corso e non è scaduto: si aspetta.
  if (
    esistente?.stato === "caricando" &&
    esistente.scadeIl &&
    Date.parse(esistente.scadeIl) > adesso
  )
    throw new ErroreChat("occupato");

  const percorso = `${cartellaBucket(porte.utente, lotto)}${porte.id()}.jpg`;
  const segnaposto: PagamentoChat = {
    stato: "caricando",
    impronta,
    percorso,
    scadeIl: iso(adesso + SCADENZA_CARICANDO_MS),
  };
  const testoSegnaposto = JSON.stringify(segnaposto);
  if (grezzoEsistente === null) {
    const esito = await porte.archivio.creaSeAssente(chiave, testoSegnaposto);
    if (esito.stato === "errore") throw new ErroreChat("scrittura_fallita");
    // Un'altra richiesta l'ha creata un istante prima: è lei che carica.
    if (esito.stato === "esiste") throw new ErroreChat("occupato");
  } else if (!(await porte.lucchetto.sostituisciSe(chiave, grezzoEsistente, testoSegnaposto))) {
    // Confronto-e-scambio sul valore letto: nel frattempo è cambiato (un altro caricamento, una
    // lettura, uno scarto) e chi arriva secondo trova «occupato» invece di scrivere sopra in silenzio.
    throw new ErroreChat("occupato");
  }

  const errore = await porte.bucket.carica(percorso, dataUrl);
  if (errore) {
    // Upload fallito: si toglie il segnaposto, solo se è ancora il nostro.
    await porte.lucchetto
      .eliminaSe(chiave, testoSegnaposto)
      .catch(() => porte.log("segnaposto_non_tolto"));
    throw new ErroreChat("scrittura_fallita");
  }
  const nuovo: PagamentoChat = { stato: "salvato", impronta, percorso };
  const fatto = await porte.lucchetto.sostituisciSe(chiave, testoSegnaposto, JSON.stringify(nuovo));
  if (!fatto) {
    // Troppo lenti: la chiave è passata a un altro nel frattempo. Il nostro file non serve.
    await porte.bucket.rimuovi([percorso]);
    throw new ErroreChat("occupato");
  }
  // Il vecchio file (se diverso) si toglie SOLO dopo aver chiuso il nostro al posto giusto.
  const vecchioPercorso = esistente
    ? percorsoDelLotto(porte.utente, lotto, esistente.percorso)
    : null;
  if (vecchioPercorso) await porte.bucket.rimuovi([vecchioPercorso]);
  // Un bonifico nuovo (o cambiato) cambia i campi che ne derivano: le conferme di prima non valgono più.
  const senzaConferme = await aggiornaRiga(porte, lotto, idRiga, salvata.scheda, (attuale) =>
    attuale.confermata || attuale.confermeAvvisi?.length
      ? { ...attuale, confermata: false, confermeAvvisi: [] }
      : attuale,
  );
  return { ok: true, azione: "carica-pagamento", riga: conPagamento(senzaConferme, nuovo) };
}

async function leggiPagamentoAzione(
  porte: PorteChat,
  lotto: string,
  idRiga: string,
): Promise<RispostaChat> {
  await testataOppureErrore(porte, lotto);
  const salvata = await rigaSalvataDi(porte, lotto, idRiga);
  if (!salvata) throw new ErroreChat("non_trovato");
  const pagamento = await pagamentoDi(porte, lotto, idRiga);
  if (!pagamento?.percorso)
    throw new ErroreChat("non_trovato", "Carica prima lo screenshot del bonifico.");
  if (pagamento.lettura)
    return { ok: true, azione: "leggi-pagamento", riga: conPagamento(salvata, pagamento) };
  const pagamentoLetto = await conReclamo(porte, lotto, idRiga, async () => {
    const fresco = (await pagamentoDi(porte, lotto, idRiga)) ?? pagamento;
    if (fresco.lettura) return fresco;
    const percorso = percorsoDelLotto(porte.utente, lotto, fresco.percorso);
    if (!percorso) throw new ErroreChat("file_non_valido");
    const immagine = await porte.bucket.scarica(percorso);
    if (!immagine) throw new ErroreChat("rete");
    const esito = await porte.ai(corpoRichiesta([immagine]), TIMEOUT_AI_MS);
    if ("errore" in esito) throw new ErroreChat(esito.errore, esito.messaggio);
    const risultato = leggiRispostaGruppo(esito.testo, 1, esito.fine);
    if (!risultato.ok) throw new ErroreChat(risultato.codice);
    const letta = risultato.letture[0];
    if (letta.tipo !== "pagamento")
      throw new ErroreChat(
        "illeggibile",
        "Questa immagine non sembra la prova di un bonifico: controlla e riprova.",
      );
    const nuovo: PagamentoChat = { ...fresco, stato: "letto", lettura: letta };
    await scrivi(porte, chiavePagamento(lotto, idRiga), nuovo, true);
    return nuovo;
  });
  const senzaConferme = await aggiornaRiga(porte, lotto, idRiga, salvata.scheda, (attuale) =>
    attuale.confermata || attuale.confermeAvvisi?.length
      ? { ...attuale, confermata: false, confermeAvvisi: [] }
      : attuale,
  );
  return { ok: true, azione: "leggi-pagamento", riga: conPagamento(senzaConferme, pagamentoLetto) };
}

/* ══ 9. `salva-riga` ═══════════════════════════════════════════════════════ */

async function salvaRigaAzione(
  porte: PorteChat,
  r: {
    lotto: string;
    idRiga: string;
    modifiche?: Partial<CampiRiga>;
    confermaRiga?: boolean;
    confermaAvvisi?: string[];
    scarta?: boolean;
  },
): Promise<RispostaChat> {
  await testataOppureErrore(porte, r.lotto);
  const esistente = await rigaSalvataDi(porte, r.lotto, r.idRiga);
  if (!esistente) throw new ErroreChat("non_trovato");
  if (r.scarta) {
    const riga = await chiudiRigaChat(porte, r.lotto, r.idRiga, "scartata");
    return {
      ok: true,
      azione: "salva-riga",
      riga,
      lottoChiuso: await chiudiLottoSeConcluso(porte, r.lotto),
    };
  }
  const riga = await aggiornaRiga(porte, r.lotto, r.idRiga, esistente.scheda, (attuale) => {
    if (attuale.stato !== "aperta") throw new ErroreChat("conflitto");
    const nuova: RigaSalvata = { ...attuale };
    let azzera = false;
    if (r.modifiche && Object.keys(r.modifiche).length) {
      nuova.modifiche = { ...attuale.modifiche, ...r.modifiche };
      azzera = true;
    }
    if (azzera) {
      nuova.confermata = false;
      nuova.confermeAvvisi = [];
    }
    if (r.confermaRiga !== undefined) nuova.confermata = r.confermaRiga;
    if (r.confermaAvvisi !== undefined) nuova.confermeAvvisi = [...new Set(r.confermaAvvisi)];
    return nuova;
  });
  const pagamento = (await pagamentoDi(porte, r.lotto, r.idRiga)) ?? undefined;
  return {
    ok: true,
    azione: "salva-riga",
    riga: conPagamento(riga, pagamento),
    lottoChiuso: false,
  };
}

/* ══ 10. `aggiungi-cliente` ═══════════════════════════════════════════════ */

async function aggiungiClienteAzione(
  porte: PorteChat,
  lotto: string,
  schedaId: string,
): Promise<RispostaChat> {
  await testataOppureErrore(porte, lotto);
  const scheda = await porte.scheda(schedaId);
  if (!scheda) throw new ErroreChat("richiesta_non_valida", "Questa scheda non esiste più.");
  const chiave = chiaveRiga(lotto, schedaId);
  const esistente = await rigaSalvataDi(porte, lotto, schedaId);
  let salvata: RigaSalvata;
  if (esistente) {
    salvata = esistente;
  } else {
    const attuali = await righeSalvateDelLotto(porte, lotto);
    if (attuali.size >= MAX_CLIENTI)
      throw new ErroreChat(
        "richiesta_non_valida",
        `Troppi clienti: al massimo ${MAX_CLIENTI} per caricamento.`,
      );
    // ⚠️ UNA SOLA SCRITTURA: la riga nasce GIÀ con `scheda: schedaId` (PIANO §0.1 punto 2).
    const nuova: RigaSalvata = { idRiga: schedaId, scheda: schedaId, stato: "aperta" };
    const esito = await porte.archivio.creaSeAssente(chiave, JSON.stringify(nuova));
    if (esito.stato === "errore") throw new ErroreChat("scrittura_fallita");
    salvata = nuova;
  }
  const pagamento = (await pagamentoDi(porte, lotto, schedaId)) ?? undefined;
  return { ok: true, azione: "aggiungi-cliente", riga: conPagamento(salvata, pagamento) };
}

/* ══ 11. LE AZIONI POST (tranne `emetti-riga`, vedi intestazione) ══════════ */

export async function eseguiAzioneChat(
  porte: PorteChat,
  richiesta: RichiestaChat,
): Promise<RispostaChat> {
  switch (richiesta.azione) {
    case "crea": {
      const azienda = await leggiAziendaSu(porte.archivio);
      const motivi = controllaLotto(azienda);
      if (motivi.length)
        throw new ErroreChat("richiesta_non_valida", motivi.map((m) => m.testo).join(" "));
      const lotto = porte.id();
      const testata: TestataLottoChat = {
        lotto,
        creatoIl: iso(porte.adesso()),
        // Niente `dataSeManca` qui (PIANO §2): la data viene sempre dal bonifico, letto dopo.
        descrizione: richiesta.descrizione,
        dataSeManca: "",
        firmaImpostazioni: firmaImpostazioni(azienda),
      };
      const esito = await porte.archivio.creaSeAssente(
        chiaveTestata(lotto),
        JSON.stringify(testata),
      );
      if (esito.stato !== "creata") throw new ErroreChat("scrittura_fallita");
      return { ok: true, azione: "crea", lotto };
    }
    case "aggiungi-cliente":
      return aggiungiClienteAzione(porte, richiesta.lotto, richiesta.schedaId);
    case "cerca-chat":
      return cercaChatAzione(porte, richiesta.lotto, richiesta.idRiga, false);
    case "rileggi-chat":
      return cercaChatAzione(porte, richiesta.lotto, richiesta.idRiga, true);
    case "carica-pagamento":
      return caricaPagamentoAzione(porte, richiesta.lotto, richiesta.idRiga, richiesta.dataUrl);
    case "leggi-pagamento":
      return leggiPagamentoAzione(porte, richiesta.lotto, richiesta.idRiga);
    case "salva-riga":
      return salvaRigaAzione(porte, richiesta);
    case "prendi-controllo": {
      await testataOppureErrore(porte, richiesta.lotto);
      const preso = await prendiIlControllo(
        porte.lucchetto,
        chiaveEmittente(richiesta.lotto),
        richiesta.emittente,
        SCADENZA_EMITTENTE_MS,
        porte.adesso(),
      );
      if (!preso) throw new ErroreChat("conflitto");
      return { ok: true, azione: "prendi-controllo" };
    }
    case "annulla": {
      await testataOppureErrore(porte, richiesta.lotto);
      return { ok: true, azione: "annulla", rimossi: await cancellaLotto(porte, richiesta.lotto) };
    }
    case "pulisci":
      return { ok: true, azione: "pulisci", rimossi: await pulisciAzione(porte, richiesta.lotto) };
    default:
      // `emetti-riga` non passa di qui (vedi intestazione): un'azione sconosciuta non è valida.
      throw new ErroreChat("richiesta_non_valida");
  }
}

/* ══ 12. CONTROLLARE CIÒ CHE ARRIVA DAL BROWSER ═══════════════════════════ */

const MAX_CORPO = 12_000_000;
const NON_VALIDA = () => new ErroreChat("richiesta_non_valida");
// eslint-disable-next-line no-control-regex
const COMANDI = /[\u0000-\u001f\u007f‪-‮⁦-⁩]/;
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
  if (typeof v !== "string" || !idRigaValido(v)) throw NON_VALIDA();
  return v;
}
function schedaIdDi(v: unknown): string {
  if (typeof v !== "string" || !schedaIdValido(v)) throw NON_VALIDA();
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

/** Il corpo JSON del browser → una richiesta valida, o `ErroreChat`. Niente di quel che arriva
 *  si usa prima di qui (stesso principio di `leggiRichiesta` nella bulk). */
export function leggiRichiestaChat(corpo: unknown): RichiestaChat {
  const b = oggetto(corpo);
  switch (b.azione) {
    case "crea":
      return { azione: "crea", descrizione: testo(b.descrizione ?? "", 100) };
    case "aggiungi-cliente":
      return {
        azione: "aggiungi-cliente",
        lotto: lottoDi(b.lotto),
        schedaId: schedaIdDi(b.schedaId),
      };
    case "cerca-chat":
      return { azione: "cerca-chat", lotto: lottoDi(b.lotto), idRiga: idRigaDi(b.idRiga) };
    case "rileggi-chat":
      return { azione: "rileggi-chat", lotto: lottoDi(b.lotto), idRiga: idRigaDi(b.idRiga) };
    case "carica-pagamento": {
      // Solo JPEG (lo produce la riduzione del browser), stessi limiti di sempre (2 KB-8 MB).
      if (
        typeof b.dataUrl !== "string" ||
        !b.dataUrl.startsWith("data:image/jpeg;base64,") ||
        !documentoAccettabile(b.dataUrl).ok
      )
        throw new ErroreChat("file_non_valido");
      return {
        azione: "carica-pagamento",
        lotto: lottoDi(b.lotto),
        idRiga: idRigaDi(b.idRiga),
        dataUrl: b.dataUrl,
      };
    }
    case "leggi-pagamento":
      return { azione: "leggi-pagamento", lotto: lottoDi(b.lotto), idRiga: idRigaDi(b.idRiga) };
    case "salva-riga": {
      const lotto = lottoDi(b.lotto);
      const idRiga = idRigaDi(b.idRiga);
      const r: Extract<RichiestaChat, { azione: "salva-riga" }> = {
        azione: "salva-riga",
        lotto,
        idRiga,
      };
      if (b.modifiche !== undefined) r.modifiche = modificheDi(b.modifiche);
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
        !!r.modifiche &&
        Object.keys(r.modifiche).length > 0 &&
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

/* ══ 13. LA ROTTA: GUARDIA + SMISTAMENTO ═══════════════════════════════════ */

/** Quello che la rotta passa: la guardia (`guardiaCRM` col permesso «pagamenti»), le porte vere
 *  per quell'utente e l'emissione (T6, non ancora scritta: la rotta vera passa per ora un
 *  segnaposto onesto, vedi l'intestazione del file). Così `gestisciGETChat`/`gestisciPOSTChat`
 *  si provano con finti, come `DipendenzeRotta` nella bulk. */
export interface DipendenzeRottaChat {
  guardia: (
    request: Request,
  ) => Promise<{ ok: true; utente: string } | { ok: false; risposta: Response }>;
  porte: (utente: string) => PorteChat;
  emettiRiga: (
    porte: PorteChat,
    richiesta: { lotto: string; idRiga: string; emittente: string },
  ) => Promise<RispostaEmettiRiga>;
}

export async function gestisciGETChat(request: Request, d: DipendenzeRottaChat): Promise<Response> {
  const g = await d.guardia(request);
  if (!g.ok) return g.risposta;
  const porte = d.porte(g.utente);
  try {
    const q = new URL(request.url).searchParams;
    //  GET: solo lettura. ⚠️ Qui dentro non si cancella niente: la pulizia è `pulisci`, un POST.
    if (q.get("candidati") === "1") return json(await candidatiElenco(porte, q.get("q") ?? ""));
    const lotto = q.get("lotto");
    if (lotto === null) return json(await elencoLotti(porte));
    if (!lottoValido(lotto)) throw NON_VALIDA();
    const miniatura = q.get("miniatura");
    if (miniatura !== null) {
      const idRiga = q.get("idRiga");
      if (!idRiga) throw NON_VALIDA();
      return json(await urlMiniatura(porte, lotto, idRiga, miniatura));
    }
    const dettaglio = await dettaglioLotto(porte, lotto);
    if (!dettaglio) throw new ErroreChat("non_trovato");
    return json(dettaglio);
  } catch (e) {
    return rispostaDaErrore(e, porte, "GET");
  }
}

export async function gestisciPOSTChat(
  request: Request,
  d: DipendenzeRottaChat,
): Promise<Response> {
  const g = await d.guardia(request);
  if (!g.ok) return g.risposta;
  const porte = d.porte(g.utente);
  let azione = "POST";
  try {
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
    const richiesta = leggiRichiestaChat(corpo);
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
        porte.log(`emetti-riga ${e instanceof ErroreChat ? e.codice : "interno"}`);
        esito = {
          ok: true,
          esito: "ferma",
          codice: e instanceof ErroreChat ? e.codice : "interno",
          messaggio: e instanceof ErroreChat ? e.messaggio : MESSAGGIO_DEFAULT,
        };
      }
      return json({ azione: "emetti-riga", ...esito });
    }
    return json(await eseguiAzioneChat(porte, richiesta));
  } catch (e) {
    return rispostaDaErrore(e, porte, azione);
  }
}

/* ══ 14. LA CHIAMATA ALL'AI (UN TENTATIVO, CORPO GENERICO) ═════════════════
 *  ⚠️ Non si riusa `chiamaOpenRouter` della bulk: quella costruisce il corpo da
 *  sé (`corpoRichiesta(immagini)`, cablato sui 3 file della bulk). Qui il corpo
 *  arriva già pronto da chi chiama (`corpoRichiestaChat` per la chat,
 *  `corpoRichiesta([1 immagine])` della bulk per il pagamento): stessa HTTP,
 *  stessa lettura degli errori, generica sul corpo. */
function codiceDaStatoAI(stato: number): CodiceErrore {
  if (stato === 402) return "credito";
  if (stato === 429) return "limite";
  if (stato === 408 || stato === 504) return "timeout";
  if (stato >= 500) return "rete";
  return "interno";
}

export async function chiamaOpenRouterChat(o: {
  fetch: typeof fetch;
  chiave: string;
  corpo: unknown;
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
        "X-Title": "Fatture dalla chat",
      },
      body: JSON.stringify(o.corpo),
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
    const errore = (corpo as { error?: { code?: unknown } } | null)?.error;
    if (errore) return { errore: codiceDaStatoAI(Number(errore.code) || 500) };
    return leggiCorpoRisposta(corpo);
  } catch (e) {
    return { errore: (e as { name?: string })?.name === "AbortError" ? "timeout" : "rete" };
  } finally {
    clearTimeout(timer);
  }
}

/* ══ 15. LA CABLATURA VERA DI `raccogliChat` (T4 l'aveva lasciata a T5) ═════
 *  `PorteRaccoltaChat` (T4) prende SOLO `client: unknown`/una funzione di firma
 *  e una di scarico: nessun import di Supabase qui, esattamente come
 *  `archivioProtettoSu`/`portaLucchettoSu` nella bulk — per questo si prova
 *  con un finto che registra le chiamate, senza una rete vera.
 *
 *  ── ⚠️ OSSERVAZIONE DEL REVISORE SU T4, CHIUSA QUI ────────────────────────
 *  `raccogliChat` (T4) si fida delle righe che le porte gli danno, senza
 *  ricontrollare numero o utente (è la porta, non lei, che deve scegliere
 *  giusto — commento di T4 nel file: «il filtro qui sotto resta comunque, a
 *  difesa»). Le query vere qui sotto filtrano SEMPRE per `user_id` (mai le
 *  chat di un altro utente del CRM) e per le ultime 9 cifre del numero, su
 *  `from_number` O `to_number` di `whatsapp_messages` (qualunque sia la
 *  direzione: lo stesso principio di `ponte_wa_candidati`, che guarda
 *  `from_number` per l'entrata e `to_number` per l'uscita) e sulla colonna
 *  `numero` di `ponte_wa_media` (che la porta già nelle cifre, senza prefisso
 *  fisso): senza questi due filtri, `raccogliChat` leggerebbe — e userebbe,
 *  fidandosi — i messaggi di un cliente qualunque pur di chiamarsi `userId`.
 *  Prova dedicata in `prove/fatture-dalla-chat/server.mjs` che verifica che le
 *  ultime 9 cifre compaiano nel filtro costruito, su entrambe le tabelle. */
interface RigaMessaggioDb {
  wa_message_id: unknown;
  direction: unknown;
  body: unknown;
  media_type: unknown;
  duplicato_di: unknown;
  created_at: unknown;
}
interface RigaMediaDb {
  chiave: unknown;
  path: unknown;
  stato: unknown;
  categoria: unknown;
}
interface FiltroChat<T> extends PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}> {
  eq: (c: string, v: string) => FiltroChat<T>;
  or: (s: string) => FiltroChat<T>;
  like: (c: string, v: string) => FiltroChat<T>;
  order: (c: string, o: { ascending: boolean }) => FiltroChat<T>;
  limit: (n: number) => FiltroChat<T>;
}
interface ClienteMessaggi {
  from: (t: string) => { select: <T>(c: string) => FiltroChat<T> };
}

/** Righe lette per chiamata, prima dei filtri di `raccogliChat` (ordinate, le più recenti prima):
 *  un tetto di sicurezza, non il tetto di 300/8 della SPEC (quello lo applica `raccogliChat`). */
const MAX_MESSAGGI_DB = 1000;
const MAX_MEDIA_DB = 500;

function inBase64(byte: Uint8Array): string {
  let s = "";
  for (let i = 0; i < byte.length; i += 0x8000)
    s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(s);
}

export function porteRaccoltaChatVere(
  client: unknown,
  opz: {
    /** Indirizzo firmato di lettura di un file del bucket `ponte-media`. */
    firmaPonte: (percorso: string) => Promise<string | null>;
    fetch: typeof fetch;
  },
): PorteRaccoltaChat {
  const c = client as ClienteMessaggi;
  return {
    messaggi: async (userId, ultime9Cifre) => {
      const come = `%${ultime9Cifre}`;
      const { data, error } = await c
        .from("whatsapp_messages")
        .select<RigaMessaggioDb>("wa_message_id,direction,body,media_type,duplicato_di,created_at")
        .eq("user_id", userId)
        // ⚠️ IL FILTRO PER NUMERO: senza questo, la query leggerebbe TUTTI i messaggi dell'utente.
        .or(`from_number.like.${come},to_number.like.${come}`)
        .order("created_at", { ascending: false })
        .limit(MAX_MESSAGGI_DB);
      if (error) throw new Error(error.message);
      return (data ?? []).map(
        (r): MessaggioChatGrezzo => ({
          id: String(r.wa_message_id ?? ""),
          direction: r.direction === "outbound" ? "outbound" : "inbound",
          body: String(r.body ?? ""),
          mediaType: typeof r.media_type === "string" ? r.media_type : null,
          duplicatoDi: typeof r.duplicato_di === "string" ? r.duplicato_di : null,
          creatoIl: String(r.created_at ?? ""),
        }),
      );
    },
    mediaPonte: async (userId, ultime9Cifre) => {
      const { data, error } = await c
        .from("ponte_wa_media")
        .select<RigaMediaDb>("chiave,path,stato,categoria")
        .eq("user_id", userId)
        // ⚠️ IL FILTRO PER NUMERO: `numero` è già le sole cifre (nessun prefisso fisso da togliere).
        .like("numero", `%${ultime9Cifre}`)
        .limit(MAX_MEDIA_DB);
      if (error) throw new Error(error.message);
      return (data ?? []).map(
        (r): MediaPonteGrezzo => ({
          chiave: String(r.chiave ?? ""),
          percorso: String(r.path ?? ""),
          stato: String(r.stato ?? ""),
          categoria: typeof r.categoria === "string" ? r.categoria : null,
        }),
      );
    },
    firmaPonte: (percorso) => opz.firmaPonte(percorso),
    scaricaPonte: async (url) => {
      try {
        const r = await opz.fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
        if (!r.ok) return null;
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length < 1 || buf.length > PESO_MASSIMO_FILE) return null;
        const mime = (r.headers.get("content-type") ?? "").split(";")[0].trim() || "image/jpeg";
        return `data:${mime};base64,${inBase64(buf)}`;
      } catch {
        return null;
      }
    },
    scaricaManyChat: async (url) => {
      try {
        //  Solo i link che la chat riconosce come immagine ManyChat (nessun altro indirizzo: niente SSRF).
        const k = classificaTesto(url);
        if (!k.url || k.url !== url || k.tipo !== "immagine") return null;
        const mime = mimeDaUrl(url);
        if (!mime) return null;
        const r = await opz.fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
        if (!r.ok) return null;
        const dichiarato = Number(r.headers.get("content-length") ?? 0);
        if (dichiarato > PESO_MASSIMO_FILE) return null;
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length < 2048 || buf.length > PESO_MASSIMO_FILE) return null;
        const dataUrl = `data:${mime};base64,${inBase64(buf)}`;
        if (!documentoAccettabile(dataUrl).ok) return null;
        return dataUrl;
      } catch {
        return null;
      }
    },
  };
}
