/** ── PONTE WHATSAPP: LA LOGICA DELL'INGRESSO ─────────────────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T3 (PIANO §b, §c1.8,
 *  D7, D8). La rotta `POST /api/public/ponte-whatsapp` (T4) è sottile: passa
 *  la richiesta, il segreto `PONTE_WA_TOKEN` e l'ora a `gestisciRichiesta`,
 *  che fa tutto il resto con le `PortePonte` (T4 le implementa). Prove in
 *  `prove/ponte/ingresso.mjs`, con porte finte.
 *
 *  Il giro di un lotto: chiave → corpo (256 KB, a flusso) → `leggiLotto`
 *  (ripulitura e scarti) → utente dal server → `noti` (sempre, storico e vivi,
 *  in entrata e in uscita) → `candidati` → `abbinaPari` → `scrivi` → per i
 *  `vivo`, il controllo tardivo dei pari.
 *
 *  ⚠️ L'utente non arriva MAI dal corpo: è `porte.utente()`.
 *  ⚠️ Il corpo si legge solo dopo la chiave giusta; un segreto più corto di
 *   `LIMITI.tokenMinimo` vale come assente (503).
 *  ⚠️ Un numero non noto non entra mai (D7): né riga né contatto. Per i `vivo`
 *   torna in `non_noti` (il ponte ritenta per 10 minuti), per lo `storico` si
 *   conta in `fuori_rubrica`.
 *  ⚠️ Nei log solo `porte.avviso(codice, contatori)`: mai numeri, nomi, testi,
 *   id. Niente `console` in questo file.
 *  ───────────────────────────────────────────────────────────────────────── */
import { leggiCorpoLimitato, stessaChiave } from "../manychat/ritorno";
import { abbinaPari } from "./pari";
import {
  EFFETTO_MAX_GIORNI,
  ERRORI_HTTP,
  LIMITI,
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
  if (typeof ts !== "number" || !Number.isInteger(ts) || ts < TS_MINIMO || ts > tsMassimo) return null;
  if (typeof tipo !== "string" || !(TIPI_CONTENUTO as readonly string[]).includes(tipo)) return null;
  if (typeof testo !== "string") return null;
  const pulito = pulisci(testo, LIMITI.testo);
  if (!pulito.trim()) return null;
  const m: MessaggioPonte = { id, numero, dir, ts, testo: pulito, tipo: tipo as TipoContenuto };
  //  Lo stato è cosmetico: uno sconosciuto vale `sent`, non fa perdere il messaggio.
  if (dir === "out")
    m.stato = typeof stato === "string" && (STATI_INVIO as readonly string[]).includes(stato) ? (stato as StatoInvio) : "sent";
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
  return { origine, messaggi, nomi, ricevuti: grezzi.length, scartati: grezzi.length - messaggi.length };
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
 *  `contatori` (prima degli altri, così il taglio a 20 non li perde). */
export function leggiBattito(json: unknown): BattitoPulito | null {
  if (!oggetto(json) || json.v !== VERSIONE_CORPO || json.tipo !== "battito") return null;
  const stato = (STATI_PONTE as readonly unknown[]).includes(json.stato) ? (json.stato as StatoPonteWa) : "errore";
  const versione = typeof json.versione === "string" ? pulisci(json.versione.trim(), 40) || null : null;
  return {
    stato,
    collegato_dal: data(json.collegato_dal),
    ultimo_messaggio_il: data(json.ultimo_messaggio_il),
    storico: soloNumeri(json.storico),
    contatori: soloNumeri(json.contatori, soloNumeri({ in_coda: json.in_coda, scartati: json.scartati })),
    versione,
  };
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
async function riconcilia(porte: PortePonte, userId: string, adesso: Date): Promise<number> {
  const righe = await porte.recentiDelPonte(userId, new Date(adesso.getTime() - RICONCILIA_MINUTI * 60e3));
  if (righe.length === 0) return 0;
  const candidati = await porte.candidati(userId, righe.map(({ k, n, d, t }) => ({ k, n, d, t })));
  const pari = abbinaPari(righe, candidati);
  if (pari.length === 0) return 0;
  const esito = await porte.scrivi(userId, { righe: [], pari, nomi: {} });
  if (esito.pari_persi > 0) porte.avviso("pari_persi", { n: esito.pari_persi });
  if (esito.doppioni > 0) porte.avviso("riconciliati", { n: esito.doppioni });
  return esito.doppioni;
}

/** Il controllo tardivo dopo una scrittura già fatta: se fallisce lo dice nel
 *  log e basta (il lotto è scritto, ritentarlo non serve; lo rifà il battito). */
async function riconciliaSenzaErrori(porte: PortePonte, userId: string, adesso: Date): Promise<number> {
  try {
    return await riconcilia(porte, userId, adesso);
  } catch (e) {
    porte.avviso(funzioniAssenti(e) ? "funzioni_assenti" : "database");
    return 0;
  }
}

async function giroLotto(porte: PortePonte, userId: string, l: LottoLetto, adesso: Date): Promise<RispostaLotto> {
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
  if (l.messaggi.length === 0) return esito;

  //  D7: sempre, storico e vivi, in entrata e in uscita.
  const numeri = [...new Set(l.messaggi.map((m) => m.numero))];
  const noti = new Set(await porte.noti(userId, numeri));
  const dentro = l.messaggi.filter((m) => noti.has(m.numero));
  const fuori = l.messaggi.filter((m) => !noti.has(m.numero));
  if (l.origine === "vivo") esito.non_noti = fuori.map((m) => m.id);
  else esito.fuori_rubrica = fuori.length;
  if (dentro.length === 0) return esito;

  const daAbbinare: RigaDaAbbinare[] = dentro.map((m) => ({
    k: chiaveMessaggio(m.numero, m.id),
    n: m.numero,
    d: m.dir,
    t: m.ts,
    x: m.testo,
    m: m.tipo === "testo" ? null : m.tipo,
  }));
  const candidati = await porte.candidati(userId, daAbbinare.map(({ k, n, d, t }) => ({ k, n, d, t })));
  const pari = abbinaPari(daAbbinare, candidati);
  const conPari = new Set(pari.map((p) => p.k));

  //  D8: un messaggio uscito dal telefono, vivo, senza pari, degli ultimi 7 giorni.
  const dal = adesso.getTime() / 1000 - EFFETTO_MAX_GIORNI * 86400;
  const righe: RigaScrittura[] = daAbbinare.map((r, i) => ({
    ...r,
    e: l.origine === "vivo" && r.d === "out" && !conPari.has(r.k) && r.t >= dal,
    s: r.d === "in" ? "delivered" : (dentro[i].stato ?? "sent"),
  }));
  const nomi: NomiScrittura = {};
  for (const n of numeri) if (noti.has(n) && l.nomi[n]) nomi[n] = l.nomi[n];

  const scritto = await porte.scrivi(userId, { righe, pari, nomi });
  esito.nuovi = scritto.nuovi;
  esito.gia_presenti = scritto.gia_presenti;
  esito.doppioni = scritto.doppioni;
  if (scritto.pari_persi > 0) porte.avviso("pari_persi", { n: scritto.pari_persi });
  if (l.origine === "vivo") await riconciliaSenzaErrori(porte, userId, adesso);
  return esito;
}

/** La rotta intera (§b1): 503 senza segreto (o più corto di 32), 401 con la
 *  chiave sbagliata (il corpo non si legge), 413 oltre 256 KB, 400 corpo non
 *  valido, 503 senza `manychat_config`, 500 se il database fallisce (il ponte
 *  ritenta: è sicuro, per l'idempotenza), 200 con i conteggi. */
export async function gestisciRichiesta(
  porte: PortePonte,
  i: { request: Request; segreto: string | undefined; adesso: Date },
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
  if (!lotto && !battito) {
    porte.avviso("corpo_non_valido");
    return errore("corpo_non_valido");
  }

  try {
    const userId = await porte.utente();
    if (!userId) {
      porte.avviso("non_configurato");
      return errore("non_configurato");
    }
    if (lotto) {
      const esito = await giroLotto(porte, userId, lotto, i.adesso);
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
    const riconciliati = await riconciliaSenzaErrori(porte, userId, i.adesso);
    porte.avviso("battito", { riconciliati });
    return risposta(200, { ok: true, riconciliati });
  } catch (e) {
    porte.avviso(funzioniAssenti(e) ? "funzioni_assenti" : "database");
    return errore("database");
  }
}
