/** ── LA ROTTA DEGLI ORDINI: IL MAGAZZINO (ordini.server.ts) ─────────────────
 *  Commessa 2026-11-17-crm-ecommerce (T9). Tutto ciò che fa `/api/crm/ordini` TRANNE il collegamento a
 *  `guardiaCRM` e al client Supabase del server: quelli stanno in `src/routes/api.crm.ordini.ts`. Qui si
 *  ricevono PORTE (guardia, database, orologio, log), così si prova con finti, senza rete e senza chiavi.
 *  ⚠️ Deve restare importabile senza ambiente: niente `process.env`, niente client creato a livello di modulo.
 *
 *  GET                  → elenco `{ ok, ordini, scartati, troncato, migrazione: { pronta }, adesso }`
 *  GET ?conta=1         → `{ ok, nuovi }`
 *  GET ?lead=id1,id2    → come l'elenco, solo gli ordini di quelle schede (max 20, ogni id UUID)
 *  GET ?storico=<UUID>  → `{ ok, eventi, migrazione }`
 *  POST { azione, … }   → le azioni di `azioni.ts`: `{ ok: true, ordine, storico }` oppure `{ ok: false, error, messaggio }`
 *
 *  ── LE REGOLE CHE TIENE ─────────────────────────────────────────────────────
 *  · Ogni gestore apre con la guardia («pagamenti»): niente si legge e niente si scrive prima.
 *  · Ogni id (`ordineId`, `?lead=`, `?storico=`) è un UUID PRIMA di arrivare al database.
 *  · Se la migrazione M1 non c'è (`pronta: false`) nessun POST scrive: 409 «migrazione».
 *  · Le scritture seguono gli obblighi di `azioni.ts`: condizioni passate tali e quali, `null` → `.is` / `.or`,
 *    `.select("id")` e 0 righe = 409, una rilettura prima del 409 per i testi con spazi ai bordi.
 *  · Prima l'ordine, poi l'evento in `shop_order_eventi` (lo scrive il server, mai il browser): se l'evento
 *    fallisce l'ordine resta scritto e la risposta porta `storico: false`.
 *  · Nei log SOLO codici (`error.code`, il nome del tipo di un'eccezione): mai l'oggetto errore, mai `details`
 *    (porta la riga intera: nome, telefono, indirizzo), mai id o testi del cliente. Le risposte non li ripetono.
 *  · Nessuna cancellazione, da nessuna parte. */
import { costruisciAzione, eUuid, type EsitoAzione, type MotivoErrore } from "./azioni";
import { MAX_ORDINI_LETTI, normalizzaOrdine, normalizzaTutti, type Ordine } from "./ordine";

/* ══ LE PORTE ═══════════════════════════════════════════════════════════════ */

interface EsitoDb {
  data: unknown;
  error: { code?: unknown } | null;
  count?: number | null;
}
/** Il pezzo di costruttore di query di Supabase che serve qui: il finto delle prove ne ha lo stesso aspetto. */
export interface Costruttore extends PromiseLike<EsitoDb> {
  select(colonne?: string, opzioni?: { count?: "exact"; head?: boolean }): Costruttore;
  update(patch: Record<string, unknown>): Costruttore;
  insert(riga: Record<string, unknown>): Costruttore;
  eq(colonna: string, valore: unknown): Costruttore;
  is(colonna: string, valore: null): Costruttore;
  in(colonna: string, valori: string[]): Costruttore;
  or(filtri: string): Costruttore;
  order(colonna: string, opzioni?: { ascending?: boolean }): Costruttore;
  range(da: number, a: number): Costruttore;
  limit(n: number): Costruttore;
}
export interface ClienteDb {
  from(tabella: string): Costruttore;
}

export interface DipendenzeOrdini {
  /** La guardia del CRM («pagamenti»): `ok` col nome di chi chiama, oppure la risposta 401/403 da restituire così com'è. */
  guardia: (
    request: Request,
  ) => Promise<{ ok: true; nome: string } | { ok: false; risposta: Response }>;
  db: ClienteDb;
  adesso: () => Date;
  /** Solo CODICI (mai testi del cliente). */
  log: (codice: string) => void;
}

/* ══ LE COSTANTI ════════════════════════════════════════════════════════════ */

const PAGINA = 1000;
/** Oltre questo numero di ordini si legge solo fin qui e si dichiara `troncato`. */
const MAX_ORDINI = MAX_ORDINI_LETTI; // il numero sta in ordine.ts: lo legge anche l'avviso della pagina
const MAX_ID_LEAD = 20;
const MAX_EVENTI = 200;
const MAX_CORPO = 20_000; // la nota più lunga è 2000 caratteri
const MAX_CHI = 100;
/** Codici di PostgREST/Postgres che dicono «colonna o tabella inesistente» = la migrazione M1 non c'è ancora. */
const MANCANTI = ["42703", "42P01", "PGRST204", "PGRST205"];
/** Le colonne che M1 aggiunge: la sonda le chiede tutte. */
const COLONNE_M1 =
  "lead_id,senza_lead,pagato_il,pagato_importo,metodo_pagamento,tracking,note_interne,aggiornato_il";
/** Colonne di testo: lì «vuoto» è NULL oppure '' (una riga scritta a mano può avere l'uno o l'altro). */
const COLONNE_TESTO = ["status", "tracking", "note_interne"];
const STATO_HTTP: Record<MotivoErrore, number> = {
  valore: 400,
  azione_sconosciuta: 400,
  conflitto: 409,
  nessun_cambio: 200,
};

/* ══ PICCOLI AIUTI ══════════════════════════════════════════════════════════ */

const json = (o: unknown, stato = 200): Response =>
  new Response(JSON.stringify(o), {
    status: stato,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
const eOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Una risposta d'errore decisa dentro il codice: si lancia e il gestore la trasforma in JSON. */
class Rifiuto extends Error {
  constructor(
    readonly codice: string,
    readonly stato: number,
    readonly testo: string,
  ) {
    super(codice);
  }
}
const rifiuta = (codice: string, stato: number, testo: string) => new Rifiuto(codice, stato, testo);
const SENZA_MIGRAZIONE = () =>
  rifiuta(
    "migrazione",
    409,
    "Mancano gli aggiornamenti del database: chiedi a chi gestisce il database di applicare l'aggiornamento degli ordini.",
  );
const CONFLITTO = () =>
  rifiuta(
    "conflitto",
    409,
    "L'ordine è stato modificato da qualcun altro nel frattempo: ricarica e riprova.",
  );
const NON_TROVATO = () => rifiuta("non_trovato", 404, "Ordine non trovato.");

/** Il solo pezzo di un errore del database che si può scrivere nel log: il codice, ripulito. */
const codiceDi = (errore: { code?: unknown } | null | undefined): string =>
  String(errore?.code ?? "?")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 12) || "?";
const nomeDi = (e: unknown): string =>
  String((e as { name?: unknown } | null)?.name ?? "?")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 30) || "?";
const mancante = (errore: { code?: unknown } | null): boolean =>
  MANCANTI.includes(codiceDi(errore));

/** Un errore del database che non è «manca la colonna»: si logga il codice e si risponde 500 generico. */
function guasto(d: DipendenzeOrdini, dove: string, errore: { code?: unknown } | null): Rifiuto {
  d.log(`${dove} ${codiceDi(errore)}`);
  return rifiuta("interno", 500, "Il database non ha risposto: riprova tra un momento.");
}

function rispostaDaErrore(e: unknown, d: DipendenzeOrdini): Response {
  if (e instanceof Rifiuto)
    return json({ ok: false, error: e.codice, messaggio: e.testo }, e.stato);
  d.log(`eccezione ${nomeDi(e)}`); // mai il messaggio: può contenere dati del cliente
  return json(
    {
      ok: false,
      error: "interno",
      messaggio: "Qualcosa non ha funzionato: riprova tra un momento.",
    },
    500,
  );
}

/* ══ LE LETTURE ═════════════════════════════════════════════════════════════ */

/** La migrazione M1 c'è? Vera se le colonne e la tabella degli eventi rispondono; falsa se mancano; ogni altro errore è un guasto. */
async function migrazionePronta(d: DipendenzeOrdini): Promise<boolean> {
  const colonne = await d.db.from("shop_orders").select(COLONNE_M1).limit(1);
  if (colonne.error) {
    if (mancante(colonne.error)) return false;
    throw guasto(d, "sonda", colonne.error);
  }
  const eventi = await d.db.from("shop_order_eventi").select("id").limit(1);
  if (eventi.error) {
    if (mancante(eventi.error)) return false;
    throw guasto(d, "sonda", eventi.error);
  }
  return true;
}

/** Gli ordini a pagine da 1000, dal più recente, fino a `MAX_ORDINI`. Una riga letta due volte (un ordine nuovo sposta le pagine) conta una volta. */
async function leggiOrdini(
  d: DipendenzeOrdini,
  filtra: (q: Costruttore) => Costruttore = (q) => q,
) {
  const righe: unknown[] = [];
  const visti = new Set<string>();
  let troncato = false;
  const base = (colonne: string) =>
    filtra(d.db.from("shop_orders").select(colonne))
      .order("created_at", { ascending: false })
      .order("id");
  for (let da = 0; ; da += PAGINA) {
    if (da >= MAX_ORDINI) {
      const oltre = await base("id").range(da, da); // c'è ancora almeno una riga oltre il tetto?
      if (oltre.error) throw guasto(d, "lettura", oltre.error);
      troncato = Array.isArray(oltre.data) && oltre.data.length > 0;
      break;
    }
    const r = await base("*").range(da, da + PAGINA - 1);
    if (r.error) throw guasto(d, "lettura", r.error);
    const blocco = Array.isArray(r.data) ? r.data : [];
    for (const x of blocco) {
      const id = eOggetto(x) ? x.id : undefined;
      if (typeof id === "string") {
        if (visti.has(id)) continue;
        visti.add(id);
      }
      righe.push(x);
    }
    if (blocco.length < PAGINA) break;
  }
  const { ordini, scartati } = normalizzaTutti(righe);
  return { ordini, scartati, troncato };
}

async function leggiRiga(d: DipendenzeOrdini, id: string): Promise<Record<string, unknown> | null> {
  const r = await d.db.from("shop_orders").select("*").eq("id", id).limit(1);
  if (r.error) throw guasto(d, "ordine", r.error);
  const riga = Array.isArray(r.data) ? r.data[0] : null;
  return eOggetto(riga) ? riga : null;
}

/** `?lead=id1,id2`: da 1 a 20 UUID, senza doppioni. Qualunque altra cosa è un rifiuto, prima del database. */
function idDelleSchede(grezzo: string): string[] {
  const ids = [...new Set(grezzo.split(",").map((s) => s.trim()))];
  if (!ids.length || ids.length > MAX_ID_LEAD || !ids.every(eUuid))
    throw rifiuta("valore", 400, "Le schede indicate non sono valide.");
  return ids;
}

function eventoPerLaPagina(x: unknown) {
  const r = eOggetto(x) ? x : {};
  return {
    id: String(r.id ?? ""),
    creatoIl: typeof r.created_at === "string" ? r.created_at : "",
    tipo: String(r.tipo ?? ""),
    chi: typeof r.chi === "string" ? r.chi : "",
    prima: eOggetto(r.prima) ? r.prima : {},
    dopo: eOggetto(r.dopo) ? r.dopo : {},
  };
}

export async function gestisciGET(request: Request, d: DipendenzeOrdini): Promise<Response> {
  try {
    const g = await d.guardia(request); // dentro il `try`: se la guardia lancia esce un JSON «interno», non l'errore grezzo
    if (!g.ok) return g.risposta;
    const q = new URL(request.url).searchParams;
    const adesso = d.adesso().toISOString();

    const storico = q.get("storico");
    if (storico !== null) {
      if (!eUuid(storico)) throw rifiuta("valore", 400, "L'ordine indicato non è valido.");
      if (!(await migrazionePronta(d)))
        return json({ ok: true, eventi: [], migrazione: { pronta: false } });
      const r = await d.db
        .from("shop_order_eventi")
        .select("id,created_at,tipo,chi,prima,dopo")
        .eq("order_id", storico)
        .order("created_at", { ascending: false })
        .limit(MAX_EVENTI);
      if (r.error) throw guasto(d, "storico", r.error);
      return json({
        ok: true,
        eventi: (Array.isArray(r.data) ? r.data : []).map(eventoPerLaPagina),
        migrazione: { pronta: true },
      });
    }

    if (q.get("conta") === "1") {
      // solo `status`: funziona anche prima di M1 (il numeretto della voce di menu)
      const r = await d.db
        .from("shop_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "nuovo");
      if (r.error || typeof r.count !== "number")
        throw guasto(d, "conta", r.error ?? { code: "senza_numero" });
      return json({ ok: true, nuovi: r.count });
    }

    const lead = q.get("lead");
    const ids = lead === null ? null : idDelleSchede(lead);
    const pronta = await migrazionePronta(d);
    // prima di M1 `lead_id` non esiste: nessun ordine collegato, e non si chiede una colonna che manca
    if (ids && !pronta)
      return json({
        ok: true,
        ordini: [],
        scartati: 0,
        troncato: false,
        migrazione: { pronta },
        adesso,
      });
    const letti = await leggiOrdini(d, ids ? (c) => c.in("lead_id", ids) : undefined);
    return json({ ok: true, ...letti, migrazione: { pronta }, adesso });
  } catch (e) {
    return rispostaDaErrore(e, d);
  }
}

/* ══ LE AZIONI ══════════════════════════════════════════════════════════════ */

/** Le condizioni di `azioni.ts` sul comando di aggiornamento. `grezzi` = per i testi, il valore ESATTO letto dalla riga (spazi compresi). */
function conCondizioni(
  q: Costruttore,
  condizioni: Record<string, unknown>,
  grezzi: Record<string, string> = {},
): Costruttore {
  for (const [colonna, valore] of Object.entries(condizioni)) {
    if (valore === null && grezzi[colonna] === undefined)
      q = COLONNE_TESTO.includes(colonna)
        ? q.or(`${colonna}.is.null,${colonna}.eq.`)
        : q.is(colonna, null);
    else q = q.eq(colonna, grezzi[colonna] ?? valore); // il valore passa tale e quale: mai da `Date` (perde i microsecondi)
  }
  return q;
}

/** Quante righe ha toccato l'aggiornamento (0 = le condizioni non combaciano più). */
async function aggiorna(
  d: DipendenzeOrdini,
  id: string,
  patch: Record<string, unknown>,
  condizioni: Record<string, unknown>,
  grezzi?: Record<string, string>,
): Promise<number> {
  const r = await conCondizioni(
    d.db.from("shop_orders").update(patch).eq("id", id),
    condizioni,
    grezzi,
  ).select("id");
  if (r.error) {
    if (mancante(r.error)) throw SENZA_MIGRAZIONE();
    throw guasto(d, "update", r.error);
  }
  return Array.isArray(r.data) ? r.data.length : 0;
}

/** L'errore di `azioni.ts` com'è: stato HTTP, codice e testo leggibile. `nessun_cambio` non è un guasto (200, `ok: false`). */
const rifiutoDa = (esito: Extract<EsitoAzione, { ok: false }>) =>
  rifiuta(esito.motivo, STATO_HTTP[esito.motivo], esito.errore);

/** Per ogni colonna di testo: se nella riga è scritto diverso da quello visto (spazi ai bordi o soli spazi, scritti a mano), il valore vero. */
function testiVeri(
  riga: Record<string, unknown>,
  condizioni: Record<string, unknown>,
): Record<string, string> {
  const veri: Record<string, string> = {};
  for (const colonna of COLONNE_TESTO) {
    const visto = condizioni[colonna];
    const scritto = riga[colonna];
    // visto `null` = «vuoto» per T8, ma in tabella può esserci un testo di soli spazi: non combacia con `.or(is.null, eq.)`
    if (typeof scritto === "string" && scritto !== "" && scritto !== (visto ?? ""))
      veri[colonna] = scritto;
  }
  return veri;
}

export async function gestisciPOST(request: Request, d: DipendenzeOrdini): Promise<Response> {
  try {
    const g = await d.guardia(request);
    if (!g.ok) return g.risposta;
    // il tetto si controlla prima di leggere il corpo (se l'intestazione c'è); quello sul testo resta per chi non la manda
    const lunghezza = Number(request.headers.get("content-length"));
    if (lunghezza > MAX_CORPO) throw rifiuta("valore", 413, "La richiesta è troppo grande.");
    const testo = await request.text();
    if (testo.length > MAX_CORPO) throw rifiuta("valore", 400, "La richiesta è troppo grande.");
    let corpo: unknown;
    try {
      corpo = JSON.parse(testo);
    } catch {
      throw rifiuta("valore", 400, "La richiesta non è valida.");
    }
    if (!eOggetto(corpo)) throw rifiuta("valore", 400, "La richiesta non è valida.");
    const ordineId = corpo.ordineId;
    if (!eUuid(ordineId)) throw rifiuta("valore", 400, "L'ordine indicato non è valido.");

    // senza M1 non si scrive niente (e non si legge nemmeno: le colonne potrebbero non esserci)
    if (!(await migrazionePronta(d))) throw SENZA_MIGRAZIONE();

    const adesso = d.adesso();
    const riga = await leggiRiga(d, ordineId);
    const ordine = riga && normalizzaOrdine(riga);
    if (!riga || !ordine) throw NON_TROVATO(); // una riga che non si legge (senza data) non si aggiorna
    const esito = costruisciAzione(corpo, ordine, adesso);
    if (!esito.ok) throw rifiutoDa(esito);

    let rigaOra = riga;
    if ((await aggiorna(d, ordine.id, esito.patch, esito.condizioni)) === 0) {
      // 0 righe: o l'ha cambiato un altro, o il testo in tabella ha spazi ai bordi e la condizione tagliata non combacia.
      // Si rilegge UNA volta: se è davvero cambiato → 409; se è lo stesso, si riprova UNA volta col testo scritto com'è.
      const letta = await leggiRiga(d, ordine.id);
      const ordine2 = letta && normalizzaOrdine(letta);
      if (!letta || !ordine2) throw NON_TROVATO();
      const nuovo = costruisciAzione(corpo, ordine2, adesso);
      if (!nuovo.ok) throw rifiutoDa(nuovo);
      const veri = testiVeri(letta, nuovo.condizioni);
      if (
        JSON.stringify(nuovo.condizioni) !== JSON.stringify(esito.condizioni) ||
        !Object.keys(veri).length
      )
        throw CONFLITTO();
      if ((await aggiorna(d, ordine.id, esito.patch, esito.condizioni, veri)) === 0)
        throw CONFLITTO();
      rigaOra = letta;
    }

    // L'ordine è scritto. Lo storico lo scrive il server; se non riesce l'ordine resta com'è e lo si dice.
    const chi = (typeof g.nome === "string" ? g.nome.trim().slice(0, MAX_CHI) : "") || "Titolare";
    let registrato = false;
    try {
      const ev = await d.db.from("shop_order_eventi").insert({ ...esito.evento, chi });
      if (ev.error) d.log(`evento ${codiceDi(ev.error)}`);
      else registrato = true;
    } catch (e) {
      d.log(`evento eccezione ${nomeDi(e)}`);
    }
    // shortcut: l'ordine della risposta è la riga letta + la patch, non riletto dal database; la pagina rilegge comunque l'elenco (30 s).
    const dopo: Ordine = normalizzaOrdine({ ...rigaOra, ...esito.patch }) ?? ordine;
    return json({ ok: true, ordine: dopo, storico: registrato });
  } catch (e) {
    return rispostaDaErrore(e, d);
  }
}
