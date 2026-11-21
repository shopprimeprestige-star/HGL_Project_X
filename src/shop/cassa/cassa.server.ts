/** ── LA CASSA: IL SERVER (cassa.server.ts) ────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T51 (PIANO-R2 §3.1, D47, D49, D50, D66; SPEC 7.4 n. 1, 2, 4, 6, 7, 8, 10).
 *  Importabile senza ambiente: database, Stripe, orologio, log, chiave di servizio, `sito`, indirizzo, interruttore e tariffa sono PORTE
 *  (la rotta di T57 le collega; le prove usano il finto database e il finto Stripe). Nessun `process.env`, nessun `Host`/`Origin`.
 *
 *  · `gestisciPermesso(porte)`          GET  /api/public/shop-cassa-permesso → `{ok, permesso}`
 *  · `gestisciCassa(richiesta, porte)`  POST /api/public/shop-cassa → `{ok:true, url}` | `{ok:false, motivo, frase, …}`;
 *                                       con `azione:"riprova"` passa a `riprovaPagamento`
 *  · `riprovaPagamento({ref, t, permesso}, porte)`  «Riprova il pagamento» (D66)
 *  Ognuna risponde `{stato, corpo}` (la rotta lo trasforma in `Response`), non lancia mai e ha un `try/catch` di primo livello.
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · CASSA CHIUSA = NESSUNA CHIAMATA: `cassaAperta()` (cassa effettiva `stripe`, chiavi presenti, cookie di collaudo: lo decide la rotta)
 *    si legge per prima; chiusa → 503 `cassa_chiusa` senza toccare né il database né Stripe. Lo stesso senza chiave di servizio o con
 *    un `sito` che non è un `https://…` senza barra finale. S4 non applicata (funzioni o colonne assenti) → `cassa_chiusa`, mai un'eccezione.
 *  · Tetto del corpo 32 KB PRIMA del parsing (413): si guarda `Content-Length` e, senza, si conta mentre si legge.
 *  · NESSUN PREZZO DAL CLIENT: del carrello si leggono `sku` e `qty` (`validaRichiesta`); nome, prezzo, giacenza e spedizione vengono da
 *    `rpc("shop_cassa_righe")` e dalla tariffa (`calcolaOrdine`, che rifiuta bozze, esauriti, oltre giacenza, prezzi ≤ 0 e il prodotto
 *    che non si vende in cassa). `totaleAttesoCent` serve solo a rifiutare se il cliente ha visto un'altra cifra (`prezzi_cambiati`).
 *  · L'ORDINE NASCE SOLO da `shop_ordine_crea` (ordine + riservati in una transazione); questo file non scrive nessuna tabella.
 *    L'id dell'ordine è il `tentativo` del client: un doppio clic ritrova lo stesso ordine; la firma (HMAC dei dati) distingue «lo stesso
 *    tentativo» da «lo stesso tentativo con dati diversi».
 *  · SESSIONE (D47): `expires_at` = `scade_il` che ha deciso il database (mai ricalcolato: due richieste sovrapposte hanno parametri
 *    IDENTICI e la stessa `Idempotency-Key`); con meno di 35 minuti non si chiama Stripe col vecchio valore: se `scade_il` è già passato si chiude e si riapre (contratto W3 n. 1, `r<n>`), altrimenti `non_riproponibile`. Si ricostruisce
 *    SEMPRE dall'ordine salvato, così la prima richiesta e le ripetizioni mandano gli stessi byte.
 *  · Un rifiuto vero di Stripe (400, 402) lascia l'avviso rosso `stripe_errore` e la risposta `guasto`; idempotenza, timeout, rete, 5xx, 401 e il resto sono guasti
 *    passeggeri o nostri: `guasto` ritentabile. In ogni caso l'ordine resta `in_attesa` (si legge `scaduto` a `scade_il`, D52): `shop_ordine_chiudi` senza sessione
 *    chiude solo a scadenza passata (T53b), quindi la cassa non chiude da sola un ordine appena creato.
 *  · Nessuna risposta ripete dati del cliente. Nei log SOLO codici (`error.code`, mai `message`/`details`/`hint`). */
import { hmacHex } from "@/lib/tracciamento/permesso";
import { codiceDi, tabellaAssente } from "../cms/cassa-sito";
import type { ClientStripe } from "../stripe/client";
import { chiaveSessione, corpoSessione, type RigaSessione } from "../stripe/sessione";
import type { SessioneStripe } from "../stripe/tipi";
import {
  LIMITI,
  chiaveLimite,
  improntaIndirizzo,
  saleLimiti,
  trappolaPiena,
  type UsoLimite,
} from "./anti-spam";
import { calcolaOrdine, confrontaTotale, type EsitoCalcolo } from "./calcolo";
import { chiaveOrdine, impronta, nuovoRef, refValido, verificaChiave } from "./chiave-ordine";
import { emettiPermessoCassa, verificaPermessoCassa } from "./permesso-cassa";
import type { SpedizionePubblica } from "./spedizione";
import { validaRichiesta, type RichiestaValida } from "./validazione";

/* ══ LE PORTE ═══════════════════════════════════════════════════════════════ */

export type Risposta = { stato: number; corpo: Record<string, unknown> };
interface EsitoDb {
  data: unknown;
  error: { code?: unknown } | null;
}
/** Il pezzo di costruttore di query di Supabase che serve qui (solo lettura di `shop_orders`; il finto delle prove ne ha lo stesso aspetto). */
interface Lettura extends PromiseLike<EsitoDb> {
  eq(colonna: string, valore: unknown): Lettura;
  maybeSingle(): PromiseLike<EsitoDb>;
}
export interface DbCassaServer {
  from(tabella: string): { select(colonne: string): Lettura };
  rpc(nome: string, args: Record<string, unknown>): PromiseLike<EsitoDb>;
}
export interface PorteCassaServer {
  db: DbCassaServer;
  /** Il client di T44 (`creaClientStripe`), con la chiave letta dalla rotta al momento della richiesta. */
  stripe: ClientStripe;
  /** Millisecondi. */
  adesso: () => number;
  /** Solo CODICI. */
  log: (codice: string) => void;
  chiaveServizio: string | null | undefined;
  /** La costante `SITO` di `lib/sito` (https, senza barra finale), passata dalla rotta: mai da `Host` o `Origin`. */
  sito: string;
  ip: string | null | undefined;
  userAgent: string | null | undefined;
  /** La cassa effettiva è `stripe` (o c'è il cookie di collaudo, D57) e le chiavi ci sono? `aperta:false` = nessuna chiamata. */
  cassaAperta: () =>
    | Promise<{ aperta: boolean; motivo?: string }>
    | { aperta: boolean; motivo?: string };
  /** `tariffaSpedizione()` di T50: la stessa cifra del carrello. */
  tariffa: () => Promise<SpedizionePubblica>;
  /** La chiave di Stripe è di prova (D58): l'ordine nasce con `prova = true`. */
  prova: boolean;
  /** Byte casuali per il riferimento dell'ordine (solo le prove lo cambiano). */
  random?: (n: number) => Uint8Array;
}

/* ══ COSTANTI ═══════════════════════════════════════════════════════════════ */

/** Il tetto del corpo della richiesta: oltre, 413 prima di leggere o di interpretare. */
const TETTO_CORPO = 32 * 1024;
/** Sotto questa distanza da `scade_il` non si chiama Stripe col vecchio valore: 30 minuti sono il minimo di Stripe, 5 di margine per orologi e rete. */
const MARGINE_SCADENZA_MS = 35 * 60_000;
/** La quinta etichetta di derivazione (le altre: `hgl-eventi-v1`, `hgl-ordine-v1`, `hgl-cassa-v1`, `hgl-limite-v1`): firma dei dati di un tentativo. */
const ETICHETTA_TENTATIVO = "hgl-tentativo-v1";
const INDIRIZZO_STRIPE = "https://checkout.stripe.com/";
const SDI_NESSUNO = "0000000";
const COLONNE_ORDINE =
  "id, order_ref, email, items, shipping, scade_il, riprova_n, firma_tentativo, stato_pagamento, status, canale, stripe_sessione_id, chiave_pubblica_hash, totale_cent";

const FRASI = {
  cassa_chiusa: "Il negozio sta per aprire: riprova tra poco.",
  valore: "Controlla i campi segnati e riprova.",
  non_disponibile: "Questo prodotto non è disponibile: toglilo dal carrello per continuare.",
  prezzi_cambiati: "I prezzi sono cambiati: controlla il nuovo totale e conferma di nuovo.",
  tentativo_diverso:
    "Questa richiesta è già stata usata con altri dati: ricarica la pagina e riprova.",
  non_riproponibile: "Questo pagamento non si può riprendere: ricomincia dal carrello.",
  riprova_in_corso: "Stiamo preparando un nuovo pagamento: attendi un istante.",
  gia_pagato: "Il pagamento risulta già ricevuto: stiamo verificando l'ordine.",
  troppe_richieste: "Troppi tentativi in poco tempo: riprova più tardi.",
  permesso: "Ricarica la pagina e riprova.",
  guasto: "Non siamo riusciti ad aprire il pagamento: riprova tra poco.",
  troppo_grande: "La richiesta è troppo grande.",
} as const;
type Motivo = keyof typeof FRASI;

const ok = (corpo: Record<string, unknown> = {}): Risposta => ({
  stato: 200,
  corpo: { ok: true, ...corpo },
});
const no = (stato: number, motivo: Motivo, extra: Record<string, unknown> = {}): Risposta => ({
  stato,
  corpo: { ok: false, motivo, frase: FRASI[motivo], ...extra },
});
/** Il rifiuto della riprova per chiave sbagliata, ordine inesistente o non del sito nuovo: UGUALE in ogni caso (come la pagina ordine). */
const rifiuto = (): Risposta => ({ stato: 404, corpo: { ok: false } });

/* ══ PICCOLI AIUTI ══════════════════════════════════════════════════════════ */

const oggetto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const intero = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
const testo = (x: unknown): string => (typeof x === "string" ? x : "");
/** Un codice da scrivere nel log: minuscolo, solo lettere, cifre e trattino basso. Mai un testo. */
const pulito = (x: unknown): string =>
  String(x ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 28);
const codiceErrore = (e: unknown): string => pulito(codiceDi(e)) || "ignoto";
const codiciS4Assente = new Set(["PGRST202", "42883"]);
/** S4 non applicata: tabella o colonna assente, funzione che non c'è. */
const s4Assente = (e: unknown): boolean => tabellaAssente(e) || codiciS4Assente.has(codiceDi(e));

function erroreDb(p: PorteCassaServer, contesto: string, e: unknown): Risposta {
  p.log(`${contesto} ${codiceErrore(e)}`);
  return s4Assente(e) ? no(503, "cassa_chiusa") : no(500, "guasto");
}
function erroreStripe(p: PorteCassaServer, e: { codice: string }): Risposta {
  p.log(`stripe ${pulito(e.codice) || "ignoto"}`);
  return no(500, "guasto");
}
function eccezione(p: PorteCassaServer, e: unknown): Risposta {
  try {
    p.log(`eccezione ${codiceErrore(e)}`);
  } catch {
    /* il log non deve mai far lanciare la risposta */
  }
  return no(500, "guasto");
}

/** JSON con le chiavi in ordine: la stessa richiesta dà sempre gli stessi byte. */
const canonico = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    oggetto(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );

/** La firma di un tentativo (32 esadecimali): HMAC dei dati del cliente. Va nell'`Idempotency-Key`, quindi mai un hash nudo dei dati. */
async function firmaDi(r: RichiestaValida, chiaveServizio: string): Promise<string> {
  const resto: Record<string, unknown> = { ...r };
  delete resto.permesso;
  delete resto.tentativo;
  const k = await hmacHex(chiaveServizio, ETICHETTA_TENTATIVO);
  return (await hmacHex(k, canonico(resto))).slice(0, 32);
}

/* ══ I CONTROLLI DI PARTENZA ════════════════════════════════════════════════ */

/** Cassa aperta, chiave di servizio e `sito` a posto? Altrimenti 503 `cassa_chiusa` e NIENTE altro (nessuna chiamata). */
async function controlloIniziale(p: PorteCassaServer): Promise<Risposta | null> {
  if (!/^https:\/\/[^\s/]+$/.test(testo(p.sito))) {
    p.log("sito non valido");
    return no(503, "cassa_chiusa");
  }
  if (testo(p.chiaveServizio) === "") {
    p.log("chiave assente");
    return no(503, "cassa_chiusa");
  }
  let stato: { aperta: boolean } | null = null;
  try {
    stato = await p.cassaAperta();
  } catch {
    stato = null; // un interruttore che non si legge vale «chiusa»
  }
  return stato?.aperta === true ? null : no(503, "cassa_chiusa");
}

/** Il corpo come testo, con il tetto: oltre 32 KB → `null`, senza leggere (lunghezza dichiarata) o smettendo di leggere (conteggio). */
async function leggiCorpo(richiesta: Request): Promise<string | null> {
  const dichiarata = Number(richiesta.headers.get("content-length"));
  if (Number.isFinite(dichiarata) && dichiarata > TETTO_CORPO) return null;
  const lettore = richiesta.body?.getReader();
  if (!lettore) return "";
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > TETTO_CORPO) {
      await lettore.cancel().catch(() => undefined);
      return null;
    }
    pezzi.push(value);
  }
  const tutto = new Uint8Array(totale);
  let dove = 0;
  for (const pezzo of pezzi) {
    tutto.set(pezzo, dove);
    dove += pezzo.byteLength;
  }
  return new TextDecoder().decode(tutto);
}

/** Consuma un posto del limite per indirizzo (D49, `shop_limite_consuma`). `null` = passa; altrimenti la risposta da dare. */
async function consuma(p: PorteCassaServer, uso: UsoLimite): Promise<Risposta | null> {
  const sale = await saleLimiti(p.chiaveServizio);
  const chiave = chiaveLimite(uso, await improntaIndirizzo(p.ip, sale));
  const r = await p.db.rpc("shop_limite_consuma", {
    p_chiave: chiave,
    p_finestra_s: LIMITI[uso].finestraS,
    p_max: LIMITI[uso].max,
  });
  if (r.error) return erroreDb(p, "limite", r.error);
  if (r.data === true) return null;
  if (r.data === false) return no(429, "troppe_richieste");
  p.log("limite risposta");
  return no(500, "guasto");
}

/** La tariffa come la vuole `calcolaOrdine`; senza tariffa valida `null` (la cassa non si apre). */
async function leggiTariffa(p: PorteCassaServer): Promise<{ costo_cent: number } | null> {
  try {
    const t = await p.tariffa();
    return t.stato === "ok" ? { costo_cent: t.costoCent } : null;
  } catch {
    p.log("tariffa guasto");
    return null;
  }
}

/** Il rifiuto di `calcolaOrdine` come risposta della cassa. */
function daCalcolo(e: Exclude<EsitoCalcolo, { ok: true }>): Risposta {
  if (e.motivo === "non_disponibile") return no(409, "non_disponibile", { righe: e.righe });
  if (e.motivo === "cassa_chiusa") return no(503, "cassa_chiusa");
  return no(400, "valore", { frase: e.frase, campi: {} });
}

/* ══ L'ORDINE LETTO DAL DATABASE ════════════════════════════════════════════ */

type OrdineLetto = {
  id: string;
  order_ref: string;
  email: string | null;
  items: unknown;
  shipping: unknown;
  scade_il: string | null;
  riprova_n: number | null;
  firma_tentativo: string | null;
  stato_pagamento: string | null;
  status: string | null;
  canale: string | null;
  stripe_sessione_id: string | null;
  chiave_pubblica_hash: string | null;
  totale_cent: number | null;
};
type Letto = { ok: true; ordine: OrdineLetto | null } | { ok: false; risposta: Risposta };

async function leggiOrdine(
  p: PorteCassaServer,
  colonna: "id" | "order_ref",
  valore: string,
): Promise<Letto> {
  let q = p.db.from("shop_orders").select(COLONNE_ORDINE).eq(colonna, valore);
  if (colonna === "order_ref") q = q.eq("canale", "sito"); // gli ordini di prima non hanno `canale`: non sono del sito nuovo
  const r = await q.maybeSingle();
  if (r.error) return { ok: false, risposta: erroreDb(p, "ordine", r.error) };
  return { ok: true, ordine: oggetto(r.data) ? (r.data as OrdineLetto) : null };
}

/** Le righe come le vuole la sessione, ricostruite da `items` dell'ordine (nome, variante, quantità, prezzo in centesimi). */
function righeDaItems(items: unknown): RigaSessione[] | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const fuori: RigaSessione[] = [];
  for (const it of items) {
    if (!oggetto(it) || testo(it.name) === "" || !intero(it.qty)) return null;
    const prezzoCent = Math.round(Number(it.unit_price) * 100);
    if (!intero(prezzoCent)) return null;
    fuori.push({
      nome: testo(it.name),
      variante: testo(it.variant) || null,
      qty: it.qty,
      prezzoCent,
    });
  }
  return fuori;
}
/** SKU e quantità di un ordine già salvato (per ricalcolare i prezzi alla riprova). */
function richiesteDaItems(items: unknown): { sku: string; qty: number }[] | null {
  if (!Array.isArray(items)) return null;
  const fuori: { sku: string; qty: number }[] = [];
  for (const it of items) {
    if (!oggetto(it) || testo(it.product_id) === "" || !intero(it.qty)) return null;
    fuori.push({ sku: testo(it.product_id), qty: it.qty });
  }
  return fuori;
}

const urlDi = (p: PorteCassaServer, s: SessioneStripe): Risposta => {
  if (typeof s.url === "string" && s.url.startsWith(INDIRIZZO_STRIPE)) return ok({ url: s.url });
  p.log("url non valido");
  return no(500, "guasto");
};

/* ══ LA SESSIONE DI STRIPE ══════════════════════════════════════════════════ */

type Chiusura = { ok: true; chiuso: boolean } | { ok: false; errore: unknown };
/** `shop_ordine_chiudi(…, 'scaduto')`. Senza sessione la funzione chiude SOLO se `scade_il` è già passato (T53b): `chiuso:false` = qualcun altro l'ha già chiuso o
 *  riaperto (un secondo clic non richiude ciò che il primo ha appena riaperto). Con la sessione corrente chiude subito. */
async function chiudiOrdine(p: PorteCassaServer, id: string, sessione = ""): Promise<Chiusura> {
  const r = await p.db.rpc("shop_ordine_chiudi", {
    p_ordine: id,
    p_sessione: sessione,
    p_stato: "scaduto",
  });
  if (r.error) return { ok: false, errore: r.error };
  return { ok: true, chiuso: oggetto(r.data) && r.data.esito === "chiuso" };
}
async function avviso(p: PorteCassaServer, id: string, codice: string, rif: string): Promise<void> {
  const r = await p.db.rpc("shop_s4_avviso", {
    p_ordine: id,
    p_codice: codice,
    p_gravita: "rosso",
    p_rif: rif,
  });
  if (r.error) p.log(`avviso ${codiceErrore(r.error)}`); // l'avviso è un di più: l'ordine è già chiuso
}

type Riaperto = { ok: true; n: number; scadeIl: string } | { ok: false; risposta: Risposta };
/** `shop_ordine_riapri({p_ordine})` (un solo argomento): la scadenza la decide il database. */
async function riapri(p: PorteCassaServer, id: string): Promise<Riaperto> {
  const r = await p.db.rpc("shop_ordine_riapri", { p_ordine: id });
  if (r.error) {
    const non = codiceDi(r.error) === "55000"; // ordine_non_riapribile
    return {
      ok: false,
      risposta: non ? no(409, "non_riproponibile") : erroreDb(p, "riapri", r.error),
    };
  }
  const d = oggetto(r.data) ? r.data : {};
  if (d.esito === "riprova_in_corso") return { ok: false, risposta: no(409, "riprova_in_corso") };
  if (d.esito === "riaperto" && intero(d.n) && typeof d.scade_il === "string")
    return { ok: true, n: d.n, scadeIl: d.scade_il };
  p.log("riapri risposta");
  return { ok: false, risposta: no(500, "guasto") };
}

/** Un rifiuto vero di Stripe (400, 402) lascia l'avviso rosso `stripe_errore` sull'ordine (il CRM lo vede); l'ordine non si chiude da qui — `shop_ordine_chiudi`
 *  senza sessione chiude solo a scadenza passata — e si legge `scaduto` da solo (D52). Il resto (idempotenza, timeout, rete, 5xx, 401…) è un guasto ritentabile. */
async function dopoErroreStripe(
  p: PorteCassaServer,
  o: OrdineLetto,
  n: number,
  e: { codice: string; stato?: number; ritentabile: boolean },
): Promise<Risposta> {
  const risposta = erroreStripe(p, e);
  if (!e.ritentabile && (e.stato === 400 || e.stato === 402)) {
    await avviso(p, o.id, "stripe_errore", `r${n}`);
  }
  return risposta;
}

/** Crea la sessione dell'ordine e la registra. `n` = `riprova_n` (nella chiave idempotente), `scadeIl` quello del database, `chiave` la `t` della pagina ordine. */
async function creaSessioneOrdine(
  p: PorteCassaServer,
  o: OrdineLetto,
  n: number,
  scadeIl: string,
  chiave: string,
): Promise<Risposta> {
  const righe = righeDaItems(o.items);
  const spedizioneCent = Math.round(Number(o.shipping) * 100);
  if (!righe || !intero(spedizioneCent) || spedizioneCent < 0 || testo(o.firma_tentativo) === "") {
    p.log("ordine non valido");
    return no(500, "guasto");
  }
  const campi = corpoSessione(
    { id: o.id, email: o.email, scadeIl },
    righe,
    { costoCent: spedizioneCent },
    {
      successo: `${p.sito}/shop/ordine/${o.order_ref}?t=${chiave}`,
      annullo: `${p.sito}/shop/checkout?annullato=1`,
    },
  );
  const s = await p.stripe.creaSessione(campi, chiaveSessione(o.id, testo(o.firma_tentativo), n));
  if (!s.ok) return dopoErroreStripe(p, o, n, s.errore);
  if (typeof s.dati.url !== "string" || !s.dati.url.startsWith(INDIRIZZO_STRIPE)) {
    p.log("url non valido");
    return no(500, "guasto");
  }
  const reg = await p.db.rpc("shop_ordine_sessione_registra", {
    p_ordine: o.id,
    p_sessione: s.dati.id,
  });
  if (reg.error) return erroreDb(p, "registra", reg.error);
  return ok({ url: s.dati.url });
}

/** La sessione di un ordine `in_attesa` che non ne ha ancora una: col valore di `scade_il` dell'ordine; se mancano meno di 35 minuti (30 di Stripe + 5)
 *  non si chiama Stripe col vecchio valore. Se `scade_il` è già PASSATO si chiude e si riapre (D66): scadenza nuova e chiave idempotente nuova (`r<n>`); se
 *  nel frattempo l'ha già fatto un altro clic, `riprova_in_corso`. Se è ancora nel futuro (0-35 minuti) nessuno può chiuderlo (T53b): `non_riproponibile`,
 *  il cliente riparte dal carrello con un tentativo nuovo. */
async function apriSessione(
  p: PorteCassaServer,
  o: OrdineLetto,
  chiave: string,
): Promise<Risposta> {
  let n = Number(o.riprova_n ?? 0);
  let scadeIl = testo(o.scade_il);
  if (scadeIl === "" || Date.parse(scadeIl) - p.adesso() < MARGINE_SCADENZA_MS) {
    if (scadeIl === "" || Date.parse(scadeIl) >= p.adesso()) return no(409, "non_riproponibile");
    const chiuso = await chiudiOrdine(p, o.id);
    if (!chiuso.ok) return erroreDb(p, "chiudi", chiuso.errore);
    if (!chiuso.chiuso) return no(409, "riprova_in_corso");
    const a = await riapri(p, o.id);
    if (!a.ok) return a.risposta;
    n = a.n;
    scadeIl = a.scadeIl;
  }
  return creaSessioneOrdine(p, o, n, scadeIl, chiave);
}

/* ══ LA RICHIESTA ONESTA E IL DOPPIO CLIC ═══════════════════════════════════ */

/** L'ordine di questo tentativo esiste già (doppio clic, o la prima richiesta è caduta a metà). */
async function riprendi(p: PorteCassaServer, o: OrdineLetto, firma: string): Promise<Risposta> {
  if (o.canale !== "sito" || o.firma_tentativo !== firma) return no(409, "tentativo_diverso");
  if (o.stato_pagamento !== "in_attesa") return no(409, "non_riproponibile"); // scaduto, fallito, pagato…: si passa dalla riprova o da un tentativo nuovo
  if (o.stripe_sessione_id) {
    const s = await p.stripe.leggiSessione(o.stripe_sessione_id);
    if (!s.ok) return erroreStripe(p, s.errore);
    return s.dati.status === "open" ? urlDi(p, s.dati) : no(409, "non_riproponibile");
  }
  return apriSessione(p, o, await chiaveOrdine(testo(p.chiaveServizio), o.id));
}

async function ordinaria(corpo: Record<string, unknown>, p: PorteCassaServer): Promise<Risposta> {
  const chiaveServizio = testo(p.chiaveServizio);
  const permesso = await verificaPermessoCassa(corpo.permesso, chiaveServizio, p.adesso());
  if (!permesso.ok) return no(403, "permesso");
  const v = validaRichiesta(corpo);
  if (!v.ok) return no(400, "valore", { frase: v.frase, campi: v.campi });
  const r = v.valore;

  const limite = await consuma(p, "ordine"); // solo le richieste valide consumano il limite
  if (limite) return limite;
  const firma = await firmaDi(r, chiaveServizio);

  const gia = await leggiOrdine(p, "id", r.tentativo);
  if (!gia.ok) return gia.risposta;
  if (gia.ordine) return riprendi(p, gia.ordine, firma);

  // ── dall'inizio: prezzi, spedizione e disponibilità sono SOLO del server ──
  const righeServer = await p.db.rpc("shop_cassa_righe", {
    p_skus: [...new Set(r.righe.map((x) => x.sku))],
  });
  if (righeServer.error) return erroreDb(p, "righe", righeServer.error);
  const calcolo = calcolaOrdine(righeServer.data, r.righe, await leggiTariffa(p));
  if (!calcolo.ok) return daCalcolo(calcolo);
  const confronto = confrontaTotale(r.totaleAttesoCent, calcolo.totaleCent);
  if (!confronto.ok)
    return no(409, "prezzi_cambiati", {
      totaleCent: confronto.totaleCent,
      spedizioneCent: calcolo.spedizioneCent,
    });

  const chiave = await chiaveOrdine(chiaveServizio, r.tentativo);
  const marketing = r.consensoMarketing;
  const riservati = {
    fattura: r.fattura ? { ...r.fattura, sdi: r.fattura.sdi ?? SDI_NESSUNO } : null,
    attribuzione: Object.keys(r.attribuzione).length > 0 ? r.attribuzione : null,
    consensi: { ...r.consensi, marketing, il: new Date(p.adesso()).toISOString() },
    // L'indirizzo e lo user agent servono solo agli eventi alle piattaforme, e solo con il consenso (D14, D42).
    ip: marketing ? testo(p.ip).trim().slice(0, 100) || null : null,
    user_agent: marketing ? testo(p.userAgent).trim().slice(0, 300) || null : null,
  };
  const ordine = {
    id: r.tentativo,
    nome: r.contatti.nome,
    cognome: r.contatti.cognome,
    email: r.contatti.email,
    telefono: r.contatti.telefono,
    indirizzo: r.spedizione.indirizzo,
    citta: r.spedizione.citta,
    cap: r.spedizione.cap,
    provincia: r.spedizione.provincia,
    nazione: r.spedizione.nazione,
    note: r.note,
    items: calcolo.items,
    subtotal: calcolo.subtotaleCent / 100,
    shipping: calcolo.spedizioneCent / 100,
    total: calcolo.totaleCent / 100,
    totale_cent: calcolo.totaleCent,
    chiave_pubblica_hash: await impronta(chiave),
    firma_tentativo: firma,
    prova: p.prova,
    fattura_richiesta: r.fattura !== null,
  };

  // Un riferimento già preso (23505 sul riferimento) si ritenta con un altro; 23505 con un ordine che c'è = l'altro clic ha vinto.
  for (let prova = 0; prova < 3; prova++) {
    const crea = await p.db.rpc("shop_ordine_crea", {
      p_ordine: { ...ordine, order_ref: nuovoRef(p.random) },
      p_riservati: riservati,
    });
    if (!crea.error) break;
    if (codiceDi(crea.error) !== "23505") return erroreDb(p, "crea", crea.error);
    p.log("crea 23505");
    const altro = await leggiOrdine(p, "id", r.tentativo);
    if (!altro.ok) return altro.risposta;
    if (altro.ordine) return riprendi(p, altro.ordine, firma);
    if (prova === 2) return no(500, "guasto");
  }

  // Si riparte dall'ordine com'è nel database: la prima richiesta e le ripetizioni mandano a Stripe gli stessi byte.
  const salvato = await leggiOrdine(p, "id", r.tentativo);
  if (!salvato.ok) return salvato.risposta;
  if (!salvato.ordine) {
    p.log("ordine non trovato");
    return no(500, "guasto");
  }
  return riprendi(p, salvato.ordine, firma);
}

async function lavoroCassa(richiesta: Request, p: PorteCassaServer): Promise<Risposta> {
  const chiusa = await controlloIniziale(p);
  if (chiusa) return chiusa;
  const grezzo = await leggiCorpo(richiesta);
  if (grezzo === null) return no(413, "troppo_grande");
  let corpo: unknown;
  try {
    corpo = JSON.parse(grezzo);
  } catch {
    return no(400, "valore", { campi: {} });
  }
  if (!oggetto(corpo)) return no(400, "valore", { campi: {} });
  // La trappola: chi la riempie è un programma. Risposta di successo, ma vuota (mai un errore che la spieghi), e non si scrive niente.
  if (trappolaPiena(corpo)) return ok();
  if (corpo.azione === "riprova") return riprovaDa(corpo, p);
  return ordinaria(corpo, p);
}

export async function gestisciCassa(richiesta: Request, p: PorteCassaServer): Promise<Risposta> {
  try {
    return await lavoroCassa(richiesta, p);
  } catch (e) {
    return eccezione(p, e);
  }
}

/* ══ IL PERMESSO ════════════════════════════════════════════════════════════ */

export async function gestisciPermesso(p: PorteCassaServer): Promise<Risposta> {
  try {
    const chiusa = await controlloIniziale(p);
    if (chiusa) return chiusa;
    const limite = await consuma(p, "permesso");
    if (limite) return limite;
    return ok({ permesso: await emettiPermessoCassa(p.chiaveServizio, p.adesso()) });
  } catch (e) {
    return eccezione(p, e);
  }
}

/* ══ «RIPROVA IL PAGAMENTO» (D66, contratto W3 n. 1) ════════════════════════ */

type RichiestaRiprova = { ref?: unknown; t?: unknown; permesso?: unknown };

/** Stripe dice `paid` ma la tabella no: si riconcilia con la stessa funzione del webhook (D44) e NON si apre niente. */
async function riconcilia(
  p: PorteCassaServer,
  o: OrdineLetto,
  s: SessioneStripe,
): Promise<Risposta> {
  let metodo: string | null = null;
  if (s.payment_intent) {
    const pagamento = await p.stripe.leggiPagamento(s.payment_intent);
    if (pagamento.ok) metodo = pagamento.dati.metodo; // il metodo è un di più: un errore qui non ferma il «pagato»
  }
  const r = await p.db.rpc("shop_ordine_pagato", {
    p_ordine: o.id,
    p_sessione: s.id,
    p_importo_cent: s.amount_total,
    p_valuta: s.currency,
    p_metodo: metodo,
    p_pagamento_id: s.payment_intent,
  });
  if (r.error) return erroreDb(p, "pagato", r.error);
  return no(409, "gia_pagato");
}

/** La sequenza di D66, nell'ordine del contratto: (1) rileggere Stripe, (4) ricalcolare i prezzi, (1b) far scadere la sessione vecchia,
 *  (2) riaprire PRIMA di creare, (3) creare e registrare. Ogni passo che cambia qualcosa viene dopo ogni passo che può rifiutare. */
async function riprovaDa(r: RichiestaRiprova, p: PorteCassaServer): Promise<Risposta> {
  const permesso = await verificaPermessoCassa(r.permesso, p.chiaveServizio, p.adesso());
  if (!permesso.ok) return no(403, "permesso");
  const limite = await consuma(p, "riprova"); // prima di guardare l'ordine: indovinare le chiavi costa un posto
  if (limite) return limite;

  let ordine: OrdineLetto | null = null;
  if (refValido(r.ref)) {
    const letto = await leggiOrdine(p, "order_ref", r.ref);
    if (!letto.ok) return letto.risposta;
    ordine = letto.ordine;
  }
  // Il confronto della chiave si fa SEMPRE (anche con l'ordine che non c'è): stesso lavoro, stessa risposta.
  const chiaveGiusta = await verificaChiave(r.t, ordine?.chiave_pubblica_hash);
  if (!ordine || !chiaveGiusta) return rifiuto();
  const t = testo(r.t);

  const stato = ordine.stato_pagamento;
  if (
    ordine.status === "annullato" ||
    (stato !== "in_attesa" && stato !== "fallito" && stato !== "scaduto")
  )
    return no(409, "non_riproponibile");

  // (1) la sessione corrente, riletta da Stripe
  let sessione: SessioneStripe | null = null;
  if (ordine.stripe_sessione_id) {
    const s = await p.stripe.leggiSessione(ordine.stripe_sessione_id);
    if (!s.ok) return erroreStripe(p, s.errore);
    sessione = s.dati;
  }
  if (sessione?.payment_status === "paid") return riconcilia(p, ordine, sessione);
  if (stato === "in_attesa") {
    if (sessione?.status === "open") return urlDi(p, sessione); // quella aperta è la sessione: non se ne fa un'altra
    if (sessione?.status === "complete") return no(409, "non_riproponibile"); // pagamento ritardato in corso: può ancora riuscire
    // Scaduta (o mai creata) ma la tabella dice ancora «in attesa»: se `scade_il` è nel futuro qualcuno ha appena riaperto l'ordine.
    if (Date.parse(testo(ordine.scade_il)) > p.adesso()) return no(409, "riprova_in_corso");
    const chiuso = await chiudiOrdine(p, ordine.id, sessione?.id ?? "");
    if (!chiuso.ok) return erroreDb(p, "chiudi", chiuso.errore);
    if (!chiuso.chiuso) return no(409, "riprova_in_corso"); // l'ha già chiuso o riaperto un altro clic
  }

  // (4) i prezzi di oggi: se sono cambiati o non c'è più qualcosa, si torna alla cassa PRIMA di toccare Stripe o l'ordine
  const richieste = richiesteDaItems(ordine.items);
  if (!richieste) {
    p.log("ordine non valido");
    return no(500, "guasto");
  }
  const righeServer = await p.db.rpc("shop_cassa_righe", {
    p_skus: [...new Set(richieste.map((x) => x.sku))],
  });
  if (righeServer.error) return erroreDb(p, "righe", righeServer.error);
  const calcolo = calcolaOrdine(righeServer.data, richieste, await leggiTariffa(p));
  if (!calcolo.ok) return daCalcolo(calcolo);
  const confronto = confrontaTotale(ordine.totale_cent, calcolo.totaleCent);
  if (!confronto.ok)
    return no(409, "prezzi_cambiati", {
      totaleCent: confronto.totaleCent,
      spedizioneCent: calcolo.spedizioneCent,
    });

  // (1b) la sessione vecchia ancora aperta si fa scadere prima di aprire la nuova (così non si può pagare due volte)
  if (sessione?.status === "open") {
    const scaduta = await p.stripe.scadiSessione(sessione.id);
    if (!scaduta.ok) return erroreStripe(p, scaduta.errore);
  }
  // (2) riaprire PRIMA: sotto blocco, un secondo clic insieme riceve `riprova_in_corso`
  const aperto = await riapri(p, ordine.id);
  if (!aperto.ok) return aperto.risposta;
  // (3) la sessione nuova, con `r<n>` nella chiave idempotente
  return creaSessioneOrdine(p, ordine, aperto.n, aperto.scadeIl, t);
}

export async function riprovaPagamento(
  r: RichiestaRiprova,
  p: PorteCassaServer,
): Promise<Risposta> {
  try {
    const chiusa = await controlloIniziale(p);
    if (chiusa) return chiusa;
    return await riprovaDa(r, p);
  } catch (e) {
    return eccezione(p, e);
  }
}
