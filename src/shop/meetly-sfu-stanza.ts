/** ── MEETLY · L'SFU DI CLOUDFLARE: IL NUCLEO LATO SERVER ────────────────────
 *
 *  Commessa 2026-10-31-meetly-connessione, Parte B (PIANO.md §1.5; note N2 e N4;
 *  obiezioni 2, 6 e 7 del revisore). Qui stanno TUTTE le decisioni della rotta
 *  `/api/public/meetly-sfu`: chi può fare cosa, i limiti, le righe in
 *  `app_config`. La rotta (`routes/api.public.meetly-sfu.ts`) e il collante
 *  (`meetly-sfu.server.ts`) sono sottili: risolvono il ruolo, passano il corpo,
 *  traducono in `Response`. Tutto ciò che sta fuori (archivio, Cloudflare, la
 *  sala d'attesa, l'orologio) arriva INIETTATO, quindi questo file gira in Node
 *  senza database né rete (prove/idee/meetly-sfu-server.mjs) e nel banco di
 *  collaudo (PIANO.md §5.3).
 *
 *  ── ⚠️ CHI È IL «RUOLO» ──────────────────────────────────────────────────
 *  Lo decide la rotta, non il corpo: `consulente` = sessione presentatore o CRM
 *  con «agenda»; tutti gli altri sono `ospite`. L'ospite non ha credenziali
 *  proprie: il codice stanza È la credenziale, più tre controlli in `pubblica`
 *  (stanza viva, consulente ha dichiarato, sala d'attesa lo dà per «ammesso»).
 *
 *  ── ⚠️ LA CHIAVE, E PERCHÉ BASTA DOPO `pubblica` (N2) ────────────────────
 *  L'ammissione si controlla UNA volta, in `pubblica`. Da lì in poi la `chiave`
 *  (24 byte casuali, data solo a chi è passato) prova che si è proprio chi ha
 *  pubblicato: `abbonati`, `rinegozia`, `rinnova`, `esci` non rileggono la sala.
 *  Chi conosce il codice, il pid e il sessionId (li legge dall'`hello` sul
 *  canale, che ascolta anche la sala d'attesa) NON ha la chiave.
 *
 *  ── ⚠️ UNA RIGA PER PARTECIPANTE, UNA SOLA SCRITTRICE ─────────────────────
 *  `meetly_sfu:<codice>:<pid>`: due ospiti che entrano insieme non si pestano.
 *  I tetti si calcolano dalle righe, non da una lista condivisa. «Viva» = ultima
 *  azione negli ultimi 3 minuti; le righe morte non contano nel tetto di 8 (ogni
 *  ricarica crea un pid nuovo e il `bye` può perdersi).
 *
 *  ── ⚠️ LIMITI DICHIARATI (non nascosti) ──────────────────────────────────
 *   · Senza `tracks/close` (tagliato dal piano) `espelli` toglie la riga e la
 *     chiave dell'espulso, ma l'abbonamento GIÀ negoziato con Cloudflare non lo
 *     chiude questo codice: vedi la lavagna.
 *   · Un pid con riga morta (> 3 min) si riprende senza chiave solo con lo
 *     stesso segreto della scheda (`sh`): è il modo per cui chi scrive il
 *     proprio pid non resta chiuso fuori, e chi conosce solo il pid non lo prende.
 *  Nessun nome, telefono, email, SDP o indirizzo IP passa di qui: la rotta non
 *  vede dati dei clienti, e SDP e IP non si salvano né si registrano. */
import { codiceChiave } from "@/shop/chiave-sessione";
import {
  FINESTRA_PUBBLICA_CODICE_MS,
  FINESTRA_PUBBLICA_PID_MS,
  MAX_ABBONATI_MINUTO,
  MAX_CORPO_BYTE,
  MAX_PUBBLICA_CODICE,
  MAX_PUBBLICA_PID,
  MAX_RIGHE_VIVE,
  RIGA_VIVA_MS,
  nomiTracce,
  pidValido,
  puoAbbonarsi,
  trasportoDaConfig,
  type RigaStanza,
  type Trasporto,
} from "@/shop/meetly-sfu-regole";
import type { Cloudflare } from "@/shop/meetly-sfu-cloudflare";

/* ── CIÒ CHE ARRIVA DA FUORI ──────────────────────────────────────────── */

export interface Archivio {
  leggi(chiave: string): Promise<string | null>;
  /** Torna il messaggio d'errore, o "" se è andata. */
  scrivi(chiave: string, valore: string): Promise<string>;
  cancella(chiave: string): Promise<void>;
  /** Le righe la cui chiave comincia per `prefisso`. */
  elenca(prefisso: string): Promise<{ chiave: string; valore: string }[]>;
  /** Cancella le righe col prefisso ferme (ultima scrittura) da prima di `primaDi` (ms). */
  ripulisci(prefisso: string, primaDi: number): Promise<void>;
}
export interface Fuori {
  /** `session_live:<codice>` con `live` e battito fresco (70 s). */
  stanzaViva(codice: string): Promise<boolean>;
  /** La sala d'attesa lo dà per «ammesso» (stessa prova di `shop/uscita`). */
  ammesso(codice: string, pid: string, dev: string, segreto: string): Promise<boolean>;
  adesso(): number;
}
export interface DipendenzeStanza {
  archivio: Archivio;
  /** `null` = mancano i segreti Meetly: tutto ciò che serve Cloudflare risponde `non-configurato`. */
  cloudflare: Cloudflare | null;
  fuori: Fuori;
  /** Una riga già ripulita; il collante la manda al log del servizio. */
  log?: (riga: string) => void;
}
export type Ruolo = "consulente" | "ospite";
export interface Richiesta {
  /** Lo decide la rotta. Qualunque valore diverso da «consulente» vale ospite. */
  ruolo: Ruolo | string;
  /** Solo per `config`: sessione presentatore o CRM con «consulenti». */
  puoConfigurare?: boolean;
  contentType: string | null;
  /** Il corpo come testo, non ancora letto. */
  corpo: string;
}
export interface Risposta {
  status: number;
  body: Record<string, unknown>;
}

/* ── CHIAVI E RIGHE ───────────────────────────────────────────────────── */

const PREFISSO = "meetly_sfu:";
const CHIAVE_INTERRUTTORE = "meetly_trasporto";
const chiaveStanza = (codice: string) => `${PREFISSO}${codice}:`;
const chiaveRiga = (codice: string, pid: string) => `${chiaveStanza(codice)}${pid}`;
const chiaveStato = (codice: string) => `${chiaveStanza(codice)}_stato`;
const chiaveEsclusi = (codice: string) => `${chiaveStanza(codice)}_esclusi`;

/** Le righe ferme da più di un giorno non servono a nessuno. */
const PULIZIA_MS = 24 * 3_600_000;
/** Quante esclusioni si ricordano per stanza (un abuso non deve far crescere la riga senza fine). */
const MAX_ESCLUSI = 50;
const FINESTRA_ABBONATI_MS = 60_000;

interface Riga {
  pid: string;
  dev: string;
  ruolo: Ruolo;
  /** Impronta del segreto della scheda: distingue «la stessa scheda» da «uno che conosce solo pid o dev». */
  sh: string;
  chiave: string;
  at: number;
  pub: { sessionId: string; audio: string; video: string };
  sub: { sessionId: string } | null;
  pubblicazioni: number[];
  /** Le pubblicazioni di una riga sostituita (stesso dispositivo): contano per il tetto della stanza. */
  ereditate: number[];
  abbonamenti: number[];
}

const viva = (r: { at: number }, adesso: number) => adesso - Number(r.at) <= RIGA_VIVA_MS;
const recenti = (istanti: unknown, adesso: number, finestra: number): number[] =>
  (Array.isArray(istanti) ? istanti : []).map(Number).filter((t) => Number.isFinite(t) && adesso - t < finestra);

function leggiJson(grezzo: string | null | undefined): Record<string, any> | null {
  if (!grezzo) return null;
  try {
    const v = JSON.parse(grezzo);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Le righe dei partecipanti di una stanza (non `_stato` né `_esclusi`). */
async function righeDellaStanza(d: DipendenzeStanza, codice: string): Promise<Riga[]> {
  const prefisso = chiaveStanza(codice);
  const fuori: Riga[] = [];
  for (const { chiave, valore } of await d.archivio.elenca(prefisso)) {
    const pid = chiave.slice(prefisso.length);
    const j = leggiJson(valore);
    if (!pidValido(pid) || !j || j.pid !== pid) continue;
    fuori.push({
      pid,
      dev: String(j.dev ?? ""),
      ruolo: j.ruolo === "consulente" ? "consulente" : "ospite",
      sh: String(j.sh ?? ""),
      chiave: String(j.chiave ?? ""),
      at: Number(j.at) || 0,
      pub: { sessionId: String(j.pub?.sessionId ?? ""), audio: String(j.pub?.audio ?? ""), video: String(j.pub?.video ?? "") },
      sub: j.sub?.sessionId ? { sessionId: String(j.sub.sessionId) } : null,
      pubblicazioni: Array.isArray(j.pubblicazioni) ? j.pubblicazioni.map(Number) : [],
      ereditate: Array.isArray(j.ereditate) ? j.ereditate.map(Number) : [],
      abbonamenti: Array.isArray(j.abbonamenti) ? j.abbonamenti.map(Number) : [],
    });
  }
  return fuori;
}

/** ⚠️ Confronto a tempo costante (copia di `uguali` in api.presenter.consultant,
 *  che qui non si può importare: porta con sé il database). Due chiavi diverse
 *  devono costare uguale, o la durata racconta quante lettere iniziali erano giuste. */
function uguali(a: unknown, b: unknown): boolean {
  const x = String(a ?? "");
  const y = String(b ?? "");
  if (!x || !y || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/** 24 byte casuali del sistema, in esadecimale. ⚠️ `crypto.getRandomValues`, mai `Math.random`:
 *  la chiave è la sola prova di essere chi ha pubblicato. */
function nuovaChiave(): string {
  const byte = new Uint8Array(24);
  crypto.getRandomValues(byte);
  return Array.from(byte, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 del segreto della scheda; vuoto se non c'è. Nella riga resta l'impronta, mai il segreto. */
async function impronta(segreto: string): Promise<string> {
  if (!segreto) return "";
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(segreto));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

const testoCorto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const MID_RE = /^[A-Za-z0-9_-]{1,16}$/;

/* ── RISPOSTE ─────────────────────────────────────────────────────────── */

/** Il client riceve SOLO questi codici brevi, mai il testo di Cloudflare. */
const no = (status: number, error: string): Risposta => ({ status, body: { ok: false, error } });
const si = (extra: Record<string, unknown> = {}): Risposta => ({ status: 200, body: { ok: true, ...extra } });

/** Il testo di un errore di Cloudflare, ripulito per il log: niente righe SDP
 *  (`a=`, `c=`, `o=`…), niente intestazioni, niente indirizzi, al massimo 120 caratteri. */
export function testoPerLog(grezzo: unknown): string {
  return String(grezzo ?? "")
    .split(/\r?\n/)
    .filter((l) => !/^\s*[a-z]=/i.test(l) && !/authorization|bearer/i.test(l))
    .join(" ")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "x.x.x.x")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** ⚠️ Un errore di Cloudflare si conta, non si racconta: una riga di log alla 1ª, 2ª, 4ª, 8ª…
 *  volta, con il numero. Una riga per richiesta riempirebbe il registro proprio nel momento
 *  in cui l'SFU è giù e tutti ritentano. */
let erroriCloudflare = 0;
function erroreCf(d: DipendenzeStanza, e: unknown): Risposta {
  erroriCloudflare++;
  const n = erroriCloudflare;
  if ((n & (n - 1)) === 0) {
    const stato = Number((e as { stato?: number })?.stato ?? 0);
    d.log?.(`[MEETLY-SFU] cloudflare in errore n=${n} stato=${stato} ${testoPerLog((e as { testo?: string })?.testo)}`);
  }
  return no(502, "cloudflare");
}

/* ── LA STANZA È VIVA? ────────────────────────────────────────────────── */

/** Il battito della postazione del consulente vale 70 secondi (scheda in secondo piano: uno al minuto).
 *  ⚠️ Copia di `HB_MAX_MS`/`hbFresh` di api.presenter.session, che è una rotta e porta con sé il database. */
const HB_MAX_MS = 70_000;
function vivaDa(grezzo: string | null): { live: boolean; code: string | null; fresco: (adesso: number) => boolean } {
  const j = leggiJson(grezzo);
  const hb = Date.parse(String(j?.hb ?? ""));
  return {
    live: !!j?.live,
    code: j?.code ? String(j.code) : null,
    fresco: (adesso) => Number.isFinite(hb) && adesso - hb < HB_MAX_MS,
  };
}
/** `specifica` = riga `session_live:<codice>`; `storica` = riga condivisa di prima, che vale solo se parla DI QUESTA stanza. */
export function sessioneViva(specifica: string | null, storica: string | null, codice: string, adesso: number): boolean {
  const s = specifica ? vivaDa(specifica) : null;
  const h = storica ? vivaDa(storica) : null;
  const scelta = s ?? (h && h.code === codice ? h : null);
  return !!scelta && scelta.live && scelta.fresco(adesso);
}

/* ── IL CONTESTO DI UNA CHIAMATA ──────────────────────────────────────── */

interface Ctx {
  d: DipendenzeStanza;
  ruolo: Ruolo;
  codice: string;
  adesso: number;
  b: Record<string, any>;
}

async function escluso(x: Ctx, pid: string, dev: string): Promise<boolean> {
  const e = leggiJson(await x.d.archivio.leggi(chiaveEsclusi(x.codice)));
  const pids: unknown[] = Array.isArray(e?.pid) ? e!.pid : [];
  const devs: unknown[] = Array.isArray(e?.dev) ? e!.dev : [];
  return pids.includes(pid) || (!!dev && devs.includes(dev));
}

/** La riga di chi chiama, se la chiave è la sua. Esclusione e chiave: i due motivi per cui NON si prosegue. */
async function laMia(x: Ctx, pid: string): Promise<{ righe: Riga[]; mia: Riga } | Risposta> {
  if (await escluso(x, pid, "")) return no(403, "escluso");
  const righe = await righeDellaStanza(x.d, x.codice);
  const mia = righe.find((r) => r.pid === pid);
  if (!mia || !uguali(x.b.chiave, mia.chiave)) return no(403, "chiave");
  if (await escluso(x, pid, mia.dev)) return no(403, "escluso");
  return { righe, mia };
}
const èRisposta = (v: unknown): v is Risposta => !!v && typeof (v as Risposta).status === "number";

async function scrivi(x: Ctx, r: Riga): Promise<Risposta | null> {
  const errore = await x.d.archivio.scrivi(chiaveRiga(x.codice, r.pid), JSON.stringify(r));
  //  ⚠️ Il messaggio dell'archivio non esce: al client un codice breve.
  return errore ? no(500, "archivio") : null;
}

/** Una riga che torna in vita (era morta) deve trovare posto. */
const postoPer = (righe: Riga[], pid: string, adesso: number) =>
  righe.filter((r) => r.pid !== pid && viva(r, adesso)).length < MAX_RIGHE_VIVE;

/* ── LE AZIONI ────────────────────────────────────────────────────────── */

async function dichiara(x: Ctx): Promise<Risposta> {
  if (x.ruolo !== "consulente") return no(403, "non-ammesso");
  if (!x.d.cloudflare) return no(503, "non-configurato");
  const interruttore = trasportoDaConfig(await x.d.archivio.leggi(CHIAVE_INTERRUTTORE));
  if (interruttore !== "sfu" && x.b.forzato !== true) return no(409, "non-abilitato");
  const errore = await x.d.archivio.scrivi(chiaveStato(x.codice), JSON.stringify({ trasporto: "sfu", dichiaratoIl: x.adesso }));
  return errore ? no(500, "archivio") : si();
}

async function pubblica(x: Ctx): Promise<Risposta> {
  const { d, b, codice, adesso } = x;
  if (!d.cloudflare) return no(503, "non-configurato");
  if (!pidValido(b.pid)) return no(400, "pid");
  const pid: string = b.pid;
  const dev = testoCorto(b.dev, 80);
  const segreto = testoCorto(b.segreto, 128);
  const offerSdp = typeof b.offerSdp === "string" ? b.offerSdp : "";
  if (!offerSdp) return no(400, "sdp");
  const midAudio = b.midAudio == null ? "" : String(b.midAudio);
  const midVideo = b.midVideo == null ? "" : String(b.midVideo);
  if ((!midAudio && !midVideo) || (midAudio && !MID_RE.test(midAudio)) || (midVideo && !MID_RE.test(midVideo))) {
    return no(400, "tracce");
  }
  if (await escluso(x, pid, dev)) return no(403, "escluso");

  //  ── L'OSPITE: tre controlli, in quest'ordine (obiez. 2; l'ordine conta) ──
  if (x.ruolo === "ospite") {
    //  Stanza non viva o non dichiarata = «non ancora», non un guasto: l'ospite può essere più
    //  veloce del consulente (obiez. 1) e ritenta. Un solo codice per tutti e due.
    if (!(await d.fuori.stanzaViva(codice))) return no(409, "non-dichiarato");
    if (leggiJson(await d.archivio.leggi(chiaveStato(codice)))?.trasporto !== "sfu") return no(409, "non-dichiarato");
    //  Poi la sala d'attesa: chi ascolta il canale dalla sala legge il sessionId dall'`hello`, ma qui no.
    if (!(await d.fuori.ammesso(codice, pid, dev, segreto))) return no(403, "non-ammesso");
  }

  const sh = await impronta(segreto);
  const righe = await righeDellaStanza(d, codice);
  const mia = righe.find((r) => r.pid === pid);
  const miaChiave = !!mia && uguali(b.chiave, mia.chiave);
  //  ⚠️ Su un pid che ha già una riga serve la SUA chiave (chi legge il pid dall'`hello` non ne prende il
  //   posto). Unica eccezione: riga morta e stessa scheda (stesso segreto), che ha perso la chiave.
  if (mia && !miaChiave && (viva(mia, adesso) || mia.sh !== sh)) return no(403, "chiave");

  //  Ricarica dello stesso dispositivo (stessa scheda): la riga vecchia, con un altro pid, si sostituisce.
  const sostituite = dev ? righe.filter((r) => r.pid !== pid && r.dev === dev && r.sh === sh) : [];
  if (righe.filter((r) => r.pid !== pid && !sostituite.includes(r) && viva(r, adesso)).length >= MAX_RIGHE_VIVE) {
    return no(409, "stanza-piena");
  }

  //  Limiti, calcolati dalle righe per-pid (nessuna lista condivisa).
  const proprie = recenti(mia?.pubblicazioni, adesso, FINESTRA_PUBBLICA_PID_MS);
  if (proprie.length >= MAX_PUBBLICA_PID) return no(429, "limite");
  const nelCodice = righe.reduce(
    (n, r) => n + recenti([...r.pubblicazioni, ...r.ereditate], adesso, FINESTRA_PUBBLICA_CODICE_MS).length,
    0,
  );
  if (nelCodice >= MAX_PUBBLICA_CODICE) return no(429, "limite");

  //  Cloudflare: sessione nuova, tracce <pid>-a / <pid>-v.
  const nomi = nomiTracce(pid);
  const tracce = [
    ...(midAudio ? [{ mid: midAudio, trackName: nomi.audio }] : []),
    ...(midVideo ? [{ mid: midVideo, trackName: nomi.video }] : []),
  ];
  let sessionId = "";
  let answerSdp = "";
  try {
    sessionId = await d.cloudflare.nuovaSessione();
    answerSdp = (await d.cloudflare.tracceLocali(sessionId, offerSdp, tracce)).answerSdp;
  } catch (e) {
    return erroreCf(d, e);
  }

  const chiave = miaChiave ? mia!.chiave : nuovaChiave();
  const ereditate = recenti(
    [...(mia?.ereditate ?? []), ...sostituite.flatMap((r) => [...r.pubblicazioni, ...r.ereditate])],
    adesso,
    FINESTRA_PUBBLICA_CODICE_MS,
  );
  const riga: Riga = {
    pid,
    dev,
    ruolo: x.ruolo,
    sh,
    chiave,
    at: adesso,
    pub: { sessionId, audio: midAudio ? nomi.audio : "", video: midVideo ? nomi.video : "" },
    //  La ricostruzione del pub non tocca il sub (§1.2).
    sub: mia?.sub ?? null,
    pubblicazioni: [...proprie, adesso],
    ereditate,
    abbonamenti: recenti(mia?.abbonamenti, adesso, FINESTRA_ABBONATI_MS),
  };
  const errore = await scrivi(x, riga);
  if (errore) return errore;
  for (const r of sostituite) await d.archivio.cancella(chiaveRiga(codice, r.pid));
  //  Pulizia: una query sola, e un errore qui non ferma mai la pubblicazione.
  try {
    await d.archivio.ripulisci(PREFISSO, adesso - PULIZIA_MS);
  } catch {
    /* si ripulisce alla prossima */
  }
  return si({ sessionId, chiave, answerSdp, audio: riga.pub.audio, video: riga.pub.video });
}

async function abbonati(x: Ctx): Promise<Risposta> {
  const { d, b, codice, adesso } = x;
  if (!d.cloudflare) return no(503, "non-configurato");
  if (!pidValido(b.pid)) return no(400, "pid");
  const pid: string = b.pid;
  const mio = await laMia(x, pid);
  if (èRisposta(mio)) return mio;
  const { righe, mia } = mio;
  //  Una riga scaduta ma con la chiave giusta (scheda in secondo piano) torna in vita, se c'è posto.
  if (!viva(mia, adesso) && !postoPer(righe, pid, adesso)) return no(409, "stanza-piena");
  const abbonamenti = recenti(mia.abbonamenti, adesso, FINESTRA_ABBONATI_MS);
  if (abbonamenti.length >= MAX_ABBONATI_MINUTO) return no(429, "limite");

  const richieste = Array.isArray(b.tracce)
    ? b.tracce.map((t: any) => ({ sessionId: String(t?.sessionId ?? ""), trackName: String(t?.trackName ?? "") }))
    : b.tracce;
  const altre: RigaStanza[] = righe.map((r) => ({
    pid: r.pid,
    at: r.at,
    pubSessionId: r.pub.sessionId,
    audio: r.pub.audio,
    video: r.pub.video,
  }));
  const verdetto = puoAbbonarsi({ adesso, pid, righe: altre, tracce: richieste });
  if (!verdetto.ok) {
    return verdetto.motivo === "nessuna" || verdetto.motivo === "troppe" || verdetto.motivo === "nome"
      ? no(400, "tracce")
      : no(403, "traccia");
  }

  //  La sessione sub: se il client ne indica una deve essere quella registrata su questa riga.
  let sub = mia.sub?.sessionId ?? "";
  if (b.subSessionId != null && String(b.subSessionId) !== sub) return no(403, "sessione");
  let r: Awaited<ReturnType<Cloudflare["tracceRemote"]>>;
  try {
    if (!b.subSessionId) sub = await d.cloudflare.nuovaSessione();
    r = await d.cloudflare.tracceRemote(sub, richieste);
  } catch (e) {
    return erroreCf(d, e);
  }
  const errore = await scrivi(x, { ...mia, at: adesso, sub: { sessionId: sub }, abbonamenti: [...abbonamenti, adesso] });
  return errore ?? si({ subSessionId: sub, offerSdp: r.offerSdp, serve: r.serve, tracce: r.tracce });
}

async function rinegozia(x: Ctx): Promise<Risposta> {
  const { d, b } = x;
  if (!d.cloudflare) return no(503, "non-configurato");
  if (!pidValido(b.pid)) return no(400, "pid");
  const mio = await laMia(x, b.pid);
  if (èRisposta(mio)) return mio;
  //  Solo sul sub registrato su QUESTA riga: la sessione di un altro non si rinegozia.
  if (!mio.mia.sub || String(b.subSessionId ?? "") !== mio.mia.sub.sessionId) return no(403, "sessione");
  if (typeof b.answerSdp !== "string" || !b.answerSdp) return no(400, "sdp");
  try {
    await d.cloudflare.rinegozia(mio.mia.sub.sessionId, b.answerSdp);
    return si();
  } catch (e) {
    return erroreCf(d, e);
  }
}

async function rinnova(x: Ctx): Promise<Risposta> {
  const { d, b, codice, adesso } = x;
  if (!pidValido(b.pid)) return no(400, "pid");
  const pid: string = b.pid;
  if (await escluso(x, pid, "")) return no(403, "escluso");
  const righe = await righeDellaStanza(d, codice);
  const mia = righe.find((r) => r.pid === pid);
  //  N4: una riga mancante non è un guasto. ⚠️ Ma NON si ricrea da qui: senza la riga il server non può
  //  verificare la chiave, e ricrearla sulla fiducia darebbe il posto a chiunque dica un pid. Il client
  //  risponde con una nuova `pubblica` (che ripassa dalla sala d'attesa): vedi la lavagna.
  if (!mia) return no(409, "riga-mancante");
  if (!uguali(b.chiave, mia.chiave)) return no(403, "chiave");
  if (await escluso(x, pid, mia.dev)) return no(403, "escluso");
  if (!viva(mia, adesso) && !postoPer(righe, pid, adesso)) return no(409, "stanza-piena");
  const errore = await scrivi(x, { ...mia, at: adesso });
  return errore ?? si();
}

async function esci(x: Ctx): Promise<Risposta> {
  const { d, b, codice } = x;
  if (!pidValido(b.pid)) return no(400, "pid");
  const mia = (await righeDellaStanza(d, codice)).find((r) => r.pid === b.pid);
  if (!mia) return si(); // già uscito: niente da cancellare, niente da rivelare
  if (!uguali(b.chiave, mia.chiave)) return no(403, "chiave");
  await d.archivio.cancella(chiaveRiga(codice, mia.pid));
  return si();
}

async function espelli(x: Ctx): Promise<Risposta> {
  const { d, b, codice } = x;
  if (x.ruolo !== "consulente") return no(403, "non-ammesso");
  if (!pidValido(b.pid)) return no(400, "pid");
  const pid: string = b.pid;
  const riga = (await righeDellaStanza(d, codice)).find((r) => r.pid === pid);
  const dev = testoCorto(b.dev, 80) || riga?.dev || "";
  const prima = leggiJson(await d.archivio.leggi(chiaveEsclusi(codice)));
  const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  const pids = [...new Set([...lista(prima?.pid), pid])].slice(-MAX_ESCLUSI);
  const devs = [...new Set([...lista(prima?.dev), ...(dev ? [dev] : [])])].slice(-MAX_ESCLUSI);
  //  Prima l'esclusione, poi la riga: in mezzo a un errore resta bloccato, mai libero.
  const errore = await d.archivio.scrivi(chiaveEsclusi(codice), JSON.stringify({ pid: pids, dev: devs }));
  if (errore) return no(500, "archivio");
  if (riga) await d.archivio.cancella(chiaveRiga(codice, pid));
  return si();
}

async function config(d: DipendenzeStanza, r: Richiesta, b: Record<string, any>): Promise<Risposta> {
  //  La guardia è quella di `/api/public/turn` (sessione presentatore o CRM «consulenti»): la decide la rotta.
  if (!r.puoConfigurare) return no(401, "non-autorizzato");
  const t = String(b.trasporto ?? "");
  if (t !== "mesh" && t !== "sfu") return no(400, "richiesta");
  //  Senza i segreti «sfu» non si accende: l'interruttore acceso senza SFU manderebbe tutti in ripiego.
  if (t === "sfu" && !d.cloudflare) return no(409, "non-configurato");
  const errore = await d.archivio.scrivi(CHIAVE_INTERRUTTORE, JSON.stringify({ trasporto: t }));
  return errore ? no(500, "archivio") : si({ trasporto: t });
}

/** `GET ?stato=1` (pubblico): nient'altro che questi due campi. */
export async function statoPubblico(d: DipendenzeStanza): Promise<Risposta> {
  const trasporto: Trasporto = trasportoDaConfig(await d.archivio.leggi(CHIAVE_INTERRUTTORE));
  return { status: 200, body: { trasporto, pronto: !!d.cloudflare } };
}

/* ── L'INGRESSO ───────────────────────────────────────────────────────── */

export async function trattaSfu(d: DipendenzeStanza, r: Richiesta): Promise<Risposta> {
  if (!/^application\/json\b/i.test(r.contentType ?? "")) return no(415, "tipo");
  //  La lunghezza in caratteri è il minimo dei byte: sopra il tetto non serve nemmeno contare.
  if (r.corpo.length > MAX_CORPO_BYTE || new TextEncoder().encode(r.corpo).length > MAX_CORPO_BYTE) {
    return no(413, "troppo-grande");
  }
  let b: Record<string, any>;
  try {
    b = JSON.parse(r.corpo);
  } catch {
    return no(400, "richiesta");
  }
  if (!b || typeof b !== "object" || Array.isArray(b)) return no(400, "richiesta");

  const ruolo: Ruolo = r.ruolo === "consulente" ? "consulente" : "ospite";
  const azione = String(b.azione ?? "");
  if (azione === "config") return config(d, r, b);

  const codice = codiceChiave(b.codice);
  //  ⚠️ Un codice che si riduce a nulla non va mai a finire in `meetly_sfu::<pid>`.
  if (!codice) return no(400, "codice");
  const x: Ctx = { d, ruolo, codice, adesso: d.fuori.adesso(), b };

  switch (azione) {
    case "dichiara":
      return dichiara(x);
    case "pubblica":
      return pubblica(x);
    case "abbonati":
      return abbonati(x);
    case "rinegozia":
      return rinegozia(x);
    case "rinnova":
      return rinnova(x);
    case "esci":
      return esci(x);
    case "espelli":
      return espelli(x);
    default:
      return no(400, "azione");
  }
}
