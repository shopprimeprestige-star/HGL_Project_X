/** ── PONTE WHATSAPP: LA LOGICA DELL'INGRESSO ─────────────────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T3 (PIANO §b, §c1.8,
 *  D7, D8). La rotta `POST /api/public/ponte-whatsapp` (T4) è sottile: passa
 *  la richiesta, il segreto `PONTE_WA_TOKEN` e l'ora a `gestisciRichiesta`,
 *  che fa tutto il resto con le `PortePonte` (T4 le implementa). Prove in
 *  `prove/ponte/ingresso.mjs`, con porte finte.
 *
 *  Il giro di un lotto: chiave → corpo (256 KB, a flusso) → `leggiLotto`
 *  (ripulitura e scarti) → utente dal server → `candidati` → `abbinaPari` →
 *  `scrivi` → per i `vivo`, il controllo tardivo dei pari e la promozione.
 *
 *  ⚠️ L'utente non arriva MAI dal corpo: è `porte.utente()`.
 *  ⚠️ Il corpo si legge solo dopo la chiave giusta; un segreto più corto di
 *   `LIMITI.tokenMinimo` vale come assente (503).
 *  ⚠️ D7 TOLTA (30/10, «tutte le chat»): ogni numero entra, storico e vivi,
 *   in entrata e in uscita; un numero nuovo nasce come contatto del ponte
 *   senza scheda. `non_noti` è sempre vuoto e `fuori_rubrica` 0. La richiesta
 *   `noti` risponde con tutti i numeri chiesti, senza database.
 *  ⚠️ D9 CAMBIATA: dopo ogni lotto `vivo` e a ogni battito, dopo i pari,
 *   `promuovi` trasforma in entrate vere (+1 non letti) quelle che nessun pari
 *   ha raggiunto entro `PROMOZIONE_ATTESA_S`. Un guasto qui non fa fallire il
 *   lotto né il battito (migrazione non applicata = si importa come prima).
 *  ⚠️ Nei log solo `porte.avviso(codice, contatori)`: mai numeri, nomi, testi,
 *   id. Niente `console` in questo file.
 *
 *  Invio a mano (commessa 2026-10-30-ponte-invio-manuale, T5). Se la richiesta
 *  porta `invii` (le `PorteInvio`):
 *   · `tipo` `prendi` ed `esito` vanno a `gestisciPonte` (`invio-giro.ts`);
 *   · il battito risponde anche `invii_in_attesa` (solo se > 0: a coda vuota
 *     la risposta è IDENTICA a quella di prima);
 *   · un lotto non riscrive né abbina i messaggi che sono già nostri invii.
 *  ⚠️ Le porte `inviatiDalCrm` e `inAttesa` NON LANCIANO MAI: con la migrazione
 *   non applicata il ponte già online importa e batte come prima. Senza
 *   `invii` questo file si comporta esattamente come prima.
 *
 *  Le immagini (commessa 2026-10-30-ponte-storico-completo, T5). Se la richiesta
 *  porta `media` (le `PorteMedia`), `tipo` `media_permesso` e `media_fatto` vanno
 *  a `gestisciMedia` (`media.ts`): il Worker dà un permesso e un indirizzo di
 *  carico, i byte non passano di qui. Senza `media` quei due `tipo` sono corpo non
 *  valido, come prima.
 *  ───────────────────────────────────────────────────────────────────────── */
import { leggiCorpoLimitato, stessaChiave } from "../manychat/ritorno";
import { gestisciPonte } from "./invio-giro";
import type { PorteInvio } from "./invio-tipi";
import { gestisciMedia } from "./media";
import type { PorteMedia } from "./media-tipi";
import { abbinaPari } from "./pari";
import {
  EFFETTO_MAX_GIORNI,
  ERRORI_HTTP,
  LIMITI,
  PROMOZIONE_ATTESA_S,
  RICONCILIA_MINUTI,
  STATI_INVIO,
  STATI_PONTE,
  TIPI_CONTENUTO,
  TS_MINIMO,
  VERSIONE_CORPO,
  chiaveMessaggio,
  type BattitoPulito,
  type CodiceErrore,
  type MessaggioPonte,
  type NomiScrittura,
  type Origine,
  type PortePonte,
  type RigaDaAbbinare,
  type RigaScrittura,
  type RispostaLotto,
  type RispostaNoti,
  type StatoInvio,
  type StatoPonteWa,
  type TipoContenuto,
} from "./tipi";

// ── La ripulitura del testo ───────────────────────────────────────────────

/** Una metà di coppia surrogata senza l'altra metà. */
const SURROGATA_SOLA = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Senza `\u0000` e con le surrogate isolate cambiate in `\uFFFD` (Postgres
 *  rifiuta entrambi nel testo e nel jsonb: il lotto non passerebbe mai),
 *  tagliato a `max` senza spezzare una coppia a metà. */
function pulisci(v: string, max: number): string {
  const s = v.split("\u0000").join("").replace(SURROGATA_SOLA, "\uFFFD");
  if (s.length <= max) return s;
  const ultimo = s.charCodeAt(max - 1);
  return s.slice(0, ultimo >= 0xd800 && ultimo <= 0xdbff ? max - 1 : max);
}

const oggetto = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

// ── Il lotto (§b2) ────────────────────────────────────────────────────────

const ID = /^[A-Za-z0-9_.-]{1,128}$/;
const NUMERO = /^\d{8,15}$/;

/** Il lotto dopo la ripulitura. `ricevuti` = messaggi nel corpo, `scartati` =
 *  righe non valide (o ripetute nello stesso lotto). */
export interface LottoLetto {
  origine: Origine;
  messaggi: MessaggioPonte[];
  nomi: NomiScrittura;
  ricevuti: number;
  scartati: number;
}

/** Un messaggio valido e ripulito, o null (scartato). */
function leggiMessaggio(v: unknown, tsMassimo: number): MessaggioPonte | null {
  if (!oggetto(v)) return null;
  const { id, numero, dir, ts, testo, tipo, stato } = v;
  if (typeof id !== "string" || !ID.test(id)) return null;
  //  Solo cifre 8-15: un `@lid` o un gruppo (18 cifre e più) non passa.
  if (typeof numero !== "string" || !NUMERO.test(numero)) return null;
  if (dir !== "in" && dir !== "out") return null;
  if (typeof ts !== "number" || !Number.isInteger(ts) || ts < TS_MINIMO || ts > tsMassimo)
    return null;
  if (typeof tipo !== "string" || !(TIPI_CONTENUTO as readonly string[]).includes(tipo))
    return null;
  if (typeof testo !== "string") return null;
  const pulito = pulisci(testo, LIMITI.testo);
  if (!pulito.trim()) return null;
  const m: MessaggioPonte = { id, numero, dir, ts, testo: pulito, tipo: tipo as TipoContenuto };
  //  Lo stato è cosmetico: uno sconosciuto vale `sent`, non fa perdere il messaggio.
  if (dir === "out")
    m.stato =
      typeof stato === "string" && (STATI_INVIO as readonly string[]).includes(stato)
        ? (stato as StatoInvio)
        : "sent";
  return m;
}

/** Legge e ripulisce un lotto (§b2). `null` = corpo non valido (400): `v`,
 *  `tipo`, `origine` sbagliati, `messaggi` vuoto o oltre il limite (200,
 *  50 per lo `storico`). Una riga non valida si scarta e si conta. */
export function leggiLotto(json: unknown, adesso: Date): LottoLetto | null {
  if (!oggetto(json) || json.v !== VERSIONE_CORPO || json.tipo !== "lotto") return null;
  const origine = json.origine;
  if (origine !== "storico" && origine !== "vivo") return null;
  const grezzi = json.messaggi;
  const massimo = origine === "storico" ? LIMITI.messaggiStorico : LIMITI.messaggi;
  if (!Array.isArray(grezzi) || grezzi.length < 1 || grezzi.length > massimo) return null;

  const tsMassimo = Math.floor(adesso.getTime() / 1000) + LIMITI.tsOltreMinuti * 60;
  const visti = new Set<string>();
  const messaggi: MessaggioPonte[] = [];
  for (const g of grezzi) {
    const m = leggiMessaggio(g, tsMassimo);
    const k = m && chiaveMessaggio(m.numero, m.id);
    if (!m || !k || visti.has(k)) continue;
    visti.add(k);
    messaggi.push(m);
  }

  const nomi: NomiScrittura = {};
  if (oggetto(json.nomi)) {
    for (const [n, v] of Object.entries(json.nomi).slice(0, LIMITI.nomi)) {
      if (!NUMERO.test(n) || typeof v !== "string") continue;
      const nome = pulisci(v.trim(), LIMITI.nome).trim();
      if (nome) nomi[n] = nome;
    }
  }
  return {
    origine,
    messaggi,
    nomi,
    ricevuti: grezzi.length,
    scartati: grezzi.length - messaggi.length,
  };
}

// ── Il battito (§b3) ──────────────────────────────────────────────────────

const CHIAVE = /^[a-z_]{1,40}$/;

/** Solo numeri finiti (un booleano vale 1 o 0), chiavi di lettere minuscole e
 *  `_`, al più `LIMITI.chiaviContatori`. */
function soloNumeri(v: unknown, dentro: Record<string, number> = {}): Record<string, number> {
  if (!oggetto(v)) return dentro;
  for (const [k, x] of Object.entries(v)) {
    if (Object.keys(dentro).length >= LIMITI.chiaviContatori) break;
    if (!CHIAVE.test(k) || k in dentro) continue;
    if (typeof x === "boolean") dentro[k] = x ? 1 : 0;
    else if (typeof x === "number" && Number.isFinite(x)) dentro[k] = x;
  }
  return dentro;
}

function data(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 40) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Legge e ripulisce un battito. `null` = corpo non valido (400). Lo `stato`
 *  fuori lista diventa `errore`; `in_coda` e `scartati` vanno dentro
 *  `contatori` (prima degli altri, così il taglio a `LIMITI.chiaviContatori` non li perde). */
export function leggiBattito(json: unknown): BattitoPulito | null {
  if (!oggetto(json) || json.v !== VERSIONE_CORPO || json.tipo !== "battito") return null;
  const stato = (STATI_PONTE as readonly unknown[]).includes(json.stato)
    ? (json.stato as StatoPonteWa)
    : "errore";
  const versione =
    typeof json.versione === "string" ? pulisci(json.versione.trim(), 40) || null : null;
  return {
    stato,
    collegato_dal: data(json.collegato_dal),
    ultimo_messaggio_il: data(json.ultimo_messaggio_il),
    storico: soloNumeri(json.storico),
    contatori: soloNumeri(
      json.contatori,
      soloNumeri({ in_coda: json.in_coda, scartati: json.scartati }),
    ),
    versione,
  };
}

// ── La domanda «noti» della cache del ponte (p3, 30/10) ───────────────────

/** I numeri di una `RichiestaNoti`, ripuliti: solo cifre 8-15, senza
 *  ripetizioni (le altre righe si saltano). `null` = corpo non valido (400):
 *  `v`, `tipo` sbagliati, `numeri` vuoto o oltre `LIMITI.numeri`. */
export function leggiNoti(json: unknown): string[] | null {
  if (!oggetto(json) || json.v !== VERSIONE_CORPO || json.tipo !== "noti") return null;
  const grezzi = json.numeri;
  if (!Array.isArray(grezzi) || grezzi.length < 1 || grezzi.length > LIMITI.numeri) return null;
  return [...new Set(grezzi.filter((n): n is string => typeof n === "string" && NUMERO.test(n)))];
}

// ── Il giro ───────────────────────────────────────────────────────────────

const RISPOSTA = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function risposta(stato: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status: stato, headers: RISPOSTA });
}

function errore(codice: CodiceErrore): Response {
  return risposta(ERRORI_HTTP[codice], { ok: false, errore: codice });
}

/** Funzione SQL mancante (migrazione non applicata): PostgREST o Postgres. */
function funzioniAssenti(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return code === "PGRST202" || code === "42883";
}

/** Il controllo tardivo (§c1.8): le righe del ponte dell'ultima ora ancora
 *  senza pari, i candidati di adesso, e si scrivono solo i pari. Restituisce
 *  quanti ne ha scritti. */
async function riconcilia(
  porte: PortePonte,
  userId: string,
  adesso: Date,
  invii?: PorteInvio,
): Promise<number> {
  const tutte = await porte.recentiDelPonte(
    userId,
    new Date(adesso.getTime() - RICONCILIA_MINUTI * 60e3),
  );
  //  I nostri invii non si abbinano mai a una riga di ManyChat (D7).
  const nostre = await chiaviNostre(
    invii,
    userId,
    tutte.filter((r) => r.d === "out").map((r) => r.k),
  );
  const righe = nostre.size ? tutte.filter((r) => !nostre.has(r.k)) : tutte;
  if (righe.length === 0) return 0;
  const candidati = await porte.candidati(
    userId,
    righe.map(({ k, n, d, t }) => ({ k, n, d, t })),
  );
  const pari = abbinaPari(righe, candidati);
  if (pari.length === 0) return 0;
  const esito = await porte.scrivi(userId, { righe: [], pari, nomi: {} });
  if (esito.pari_persi > 0) porte.avviso("pari_persi", { n: esito.pari_persi });
  if (esito.doppioni > 0) porte.avviso("riconciliati", { n: esito.doppioni });
  return esito.doppioni;
}

/** Il controllo tardivo dopo una scrittura già fatta: se fallisce lo dice nel
 *  log e basta (il lotto è scritto, ritentarlo non serve; lo rifà il battito).
 *  Poi, in un `try` suo e SEMPRE (anche se non c'era niente da riconciliare), la
 *  promozione delle entrate solo del ponte (D9): dopo i pari, così una riga che
 *  ha trovato il suo pari non si promuove. Restituisce i pari trovati. */
async function riconciliaSenzaErrori(
  porte: PortePonte,
  userId: string,
  adesso: Date,
  invii?: PorteInvio,
): Promise<number> {
  let trovati = 0;
  try {
    trovati = await riconcilia(porte, userId, adesso, invii);
  } catch (e) {
    porte.avviso(funzioniAssenti(e) ? "funzioni_assenti" : "database");
  }
  try {
    const { promosse } = await porte.promuovi(userId, PROMOZIONE_ATTESA_S);
    if (promosse > 0) porte.avviso("promosse", { n: promosse });
  } catch (e) {
    porte.avviso(funzioniAssenti(e) ? "funzioni_assenti" : "database");
  }
  return trovati;
}

/** Delle `chiavi` (`bw:<numero>:<id>`), quelle che sono invii fatti dal CRM.
 *  La porta non lancia mai; per sicurezza un'eccezione vale «nessuna». */
async function chiaviNostre(
  invii: PorteInvio | undefined,
  userId: string,
  chiavi: string[],
): Promise<Set<string>> {
  if (!invii || chiavi.length === 0) return new Set();
  try {
    return new Set(await invii.inviatiDalCrm(userId, chiavi));
  } catch {
    return new Set();
  }
}

// ── La notifica sul telefono (commessa 2026-10-30, p2-push-risposte) ─────

/** Un numero che ha scritto, da avvisare: cifre e nome del profilo WhatsApp. */
export interface EntrataDaAvvisare {
  numero: string;
  nome: string | null;
}

/** Chi spedisce le notifiche (la rotta passa `avvisaEntratePonte`). */
export type AvvisaEntrate = (userId: string, entrate: EntrataDaAvvisare[]) => Promise<void>;

/** Numeri avvisati al più per lotto: ogni avviso costa qualche richiesta al
 *  database e ai servizi push, e il Worker ne ha un tetto.
 *  shortcut: tetto fisso, basta finché un lotto vivo porta pochi numeri (il
 *  ponte li manda ogni 30 s); se il Mac recupera ore di messaggi dopo il
 *  sonno, quelli oltre il decimo numero non suonano (sono comunque in chat). */
export const AVVISI_PER_LOTTO = 10;

/** I numeri da avvisare dopo la scrittura: solo un lotto `vivo` (mai lo
 *  storico), solo entrate, solo senza pari (il pari è lo stesso messaggio già
 *  arrivato da ManyChat o Meta, che ha già avvisato), e solo se qualcosa è
 *  stato scritto adesso (un lotto rimandato dà `nuovi: 0`).
 *  shortcut: `ponte_wa_scrivi` dà solo i conteggi, non quali righe sono nuove;
 *  in un lotto in parte nuovo e in parte già presente si avvisa per tutte le
 *  entrate senza pari (la porta dei 180 s toglie le ripetizioni vicine). Se
 *  servisse esatto, far restituire all'SQL le chiavi inserite. */
function entrateDaAvvisare(
  l: LottoLetto,
  righe: RigaScrittura[],
  conPari: Set<string>,
  nuovi: number,
): EntrataDaAvvisare[] {
  if (l.origine !== "vivo" || nuovi <= 0) return [];
  const numeri = new Set(righe.filter((r) => r.d === "in" && !conPari.has(r.k)).map((r) => r.n));
  return [...numeri]
    .slice(0, AVVISI_PER_LOTTO)
    .map((numero) => ({ numero, nome: l.nomi[numero] ?? null }));
}

async function giroLotto(
  porte: PortePonte,
  userId: string,
  letto: LottoLetto,
  adesso: Date,
  invii?: PorteInvio,
  avvisa?: AvvisaEntrate,
): Promise<RispostaLotto> {
  //  Le uscite che il CRM ha già scritto con l'esito (stessa chiave): non si
  //  riscrivono e non si abbinano a un modello vicino (D7). Contano come già presenti.
  const nostre = await chiaviNostre(
    invii,
    userId,
    letto.messaggi.filter((m) => m.dir === "out").map((m) => chiaveMessaggio(m.numero, m.id)),
  );
  const l: LottoLetto = nostre.size
    ? {
        ...letto,
        messaggi: letto.messaggi.filter((m) => !nostre.has(chiaveMessaggio(m.numero, m.id))),
      }
    : letto;
  const esito: RispostaLotto = {
    ok: true,
    ricevuti: l.ricevuti,
    nuovi: 0,
    gia_presenti: 0,
    doppioni: 0,
    scartati: l.scartati,
    fuori_rubrica: 0,
    non_noti: [],
  };
  esito.gia_presenti = nostre.size;
  if (l.messaggi.length === 0) return esito;

  //  D7 tolta: tutti i messaggi validi vanno avanti, anche di numeri sconosciuti.
  const numeri = [...new Set(l.messaggi.map((m) => m.numero))];
  const daAbbinare: RigaDaAbbinare[] = l.messaggi.map((m) => ({
    k: chiaveMessaggio(m.numero, m.id),
    n: m.numero,
    d: m.dir,
    t: m.ts,
    x: m.testo,
    m: m.tipo === "testo" ? null : m.tipo,
  }));
  const candidati = await porte.candidati(
    userId,
    daAbbinare.map(({ k, n, d, t }) => ({ k, n, d, t })),
  );
  const pari = abbinaPari(daAbbinare, candidati);
  const conPari = new Set(pari.map((p) => p.k));

  //  D8 (uscite) e D9 (entrate): un messaggio vivo, senza pari, degli ultimi 7 giorni.
  const dal = adesso.getTime() / 1000 - EFFETTO_MAX_GIORNI * 86400;
  //  I campi nell'ordine del contratto (`RigaScrittura`).
  const righe: RigaScrittura[] = daAbbinare.map(({ k, n, d, t, x, m }, i) => ({
    k,
    n,
    d,
    t,
    x,
    e: l.origine === "vivo" && !conPari.has(k) && t >= dal,
    m,
    s: d === "in" ? "delivered" : (l.messaggi[i].stato ?? "sent"),
  }));
  //  I nomi passano per intero: se salvarli lo decide l'SQL (non per gli sconosciuti).
  const nomi: NomiScrittura = {};
  for (const n of numeri) if (l.nomi[n]) nomi[n] = l.nomi[n];

  const scritto = await porte.scrivi(userId, { righe, pari, nomi });
  esito.nuovi = scritto.nuovi;
  esito.gia_presenti += scritto.gia_presenti;
  esito.doppioni = scritto.doppioni;
  if (scritto.pari_persi > 0) porte.avviso("pari_persi", { n: scritto.pari_persi });
  if (l.origine === "vivo") await riconciliaSenzaErrori(porte, userId, adesso, invii);
  //  Per ultima: il lotto è già scritto, una notifica guasta non lo fa
  //  ritentare (la risposta al Mac resta 200).
  const entrate = entrateDaAvvisare(l, righe, conPari, scritto.nuovi);
  if (avvisa && entrate.length) {
    try {
      await avvisa(userId, entrate);
    } catch {
      /* la notifica è un di più: il messaggio è in chat */
    }
  }
  return esito;
}

/** La rotta intera (§b1): 503 senza segreto (o più corto di 32), 401 con la
 *  chiave sbagliata (il corpo non si legge), 413 oltre 256 KB, 400 corpo non
 *  valido, 503 senza `manychat_config`, 500 se il database fallisce (il ponte
 *  ritenta: è sicuro, per l'idempotenza), 200 con i conteggi. Tre corpi:
 *  `lotto`, `battito` e `noti` (la domanda della cache del ponte, p3). */
export async function gestisciRichiesta(
  porte: PortePonte,
  i: {
    request: Request;
    segreto: string | undefined;
    adesso: Date;
    invii?: PorteInvio;
    avvisa?: AvvisaEntrate;
    media?: PorteMedia;
  },
): Promise<Response> {
  if (!i.segreto) {
    porte.avviso("non_configurato");
    return errore("non_configurato");
  }
  if (i.segreto.length < LIMITI.tokenMinimo) {
    porte.avviso("segreto_corto");
    return errore("non_configurato");
  }
  if (!stessaChiave(i.request.headers.get("x-hgl-token"), i.segreto)) {
    porte.avviso("non_autorizzato");
    return errore("non_autorizzato");
  }
  const letto = await leggiCorpoLimitato(i.request.body, LIMITI.corpoByte);
  if (letto.troppoGrande) {
    porte.avviso("troppo_grande");
    return errore("troppo_grande");
  }
  let json: unknown;
  try {
    json = JSON.parse(letto.testo);
  } catch {
    json = null;
  }
  const tipo = oggetto(json) ? json.tipo : null;
  const lotto = tipo === "lotto" ? leggiLotto(json, i.adesso) : null;
  const battito = tipo === "battito" ? leggiBattito(json) : null;
  //  Senza `invii` prendi ed esito non esistono: corpo non valido, come prima.
  const invio = !!i.invii && (tipo === "prendi" || tipo === "esito");
  //  Lo stesso per i media: senza la porta `media` non esistono.
  const immagine = !!i.media && (tipo === "media_permesso" || tipo === "media_fatto");
  const numeri = tipo === "noti" ? leggiNoti(json) : null;
  if (!lotto && !battito && !invio && !immagine && !numeri) {
    porte.avviso("corpo_non_valido");
    return errore("corpo_non_valido");
  }

  if (numeri) {
    //  D7 tolta: il CRM «conosce» ogni numero. Nessun database (nemmeno l'utente),
    //  nessuna scrittura: la cache del Mac si svuota rimettendo tutto in fila.
    porte.avviso("noti", { chiesti: numeri.length, noti: numeri.length });
    const corpo: RispostaNoti = { ok: true, noti: numeri };
    return risposta(200, corpo);
  }

  try {
    const userId = await porte.utente();
    if (!userId) {
      porte.avviso("non_configurato");
      return errore("non_configurato");
    }
    if (invio) return await gestisciPonte(i.invii!, userId, json, i.adesso);
    if (immagine) return await gestisciMedia(i.media!, userId, json);
    if (lotto) {
      const esito = await giroLotto(porte, userId, lotto, i.adesso, i.invii, i.avvisa);
      porte.avviso("lotto", {
        ricevuti: esito.ricevuti,
        nuovi: esito.nuovi,
        gia_presenti: esito.gia_presenti,
        doppioni: esito.doppioni,
        scartati: esito.scartati,
        fuori_rubrica: esito.fuori_rubrica,
        non_noti: esito.non_noti.length,
      });
      return risposta(200, esito);
    }
    await porte.battito(userId, battito!);
    const riconciliati = await riconciliaSenzaErrori(porte, userId, i.adesso, i.invii);
    porte.avviso("battito", { riconciliati });
    //  Quante righe aspettano: il Mac chiede la coda solo se > 0. Con la coda
    //  vuota (o la tabella assente) la risposta resta quella di sempre.
    const inAttesa = i.invii ? await i.invii.inAttesa(userId).catch(() => 0) : 0;
    return risposta(
      200,
      inAttesa > 0
        ? { ok: true, riconciliati, invii_in_attesa: inAttesa }
        : { ok: true, riconciliati },
    );
  } catch (e) {
    porte.avviso(funzioniAssenti(e) ? "funzioni_assenti" : "database");
    return errore("database");
  }
}
