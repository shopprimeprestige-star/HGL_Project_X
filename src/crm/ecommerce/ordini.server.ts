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
 *  GET ?dettaglio=<UUID> → (R2, T53) `{ ok, ordine, riservati: { fattura, consensi } | null, rimborsi | null, email, storico | null, avvisi, migrazione: { pronta, pagamenti } }`
 *  POST { azione, … }   → le azioni di `azioni.ts`: `{ ok: true, ordine, storico }` oppure `{ ok: false, error, messaggio }`;
 *                         per le azioni nuove (R2) anche `effetti: [{ tipo, esito, frase }]`, `email: { chiave, stato, frase }` e, per `riconcilia`, `avvisi`
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
 *  · Nessuna cancellazione, da nessuna parte.
 *
 *  ── RILASCIO 2 (T53; PIANO-R2 §3.4, D55) ────────────────────────────────────────────────────────────────
 *  · LE LETTURE E LE AZIONI DI PRIMA NON CAMBIANO: stesse risposte, stesse chiamate (la prova di oggi, `prove/ecommerce/server.mjs`, è la stessa).
 *  · `?conta=1` conta come `contaComeLavoro` (i «nuovo» che si lavorano e non sono di prova: in attesa, scaduto, fallito, rimborsato e prova ne restano fuori) con UNA richiesta;
 *    se S4 manca (`stato_pagamento` non esiste) ripiega sul conteggio di oggi.
 *  · `?dettaglio=` è l'UNICO punto che legge `shop_ordini_riservati` (fattura, consensi): la lista non li porta mai. Un guasto in una sezione la rende `null` e non nasconde il resto.
 *  · Le otto azioni nuove (`spedisci`, `annulla`, `rimborso`, `riconcilia`, `fattura_emessa`, `email_invia`, `giacenza_verificata`, `correggi_stato`) passano SEMPRE da `costruisciAzione`
 *    con un `contesto` che è sempre un oggetto: `rimborsi` = quelli del database, o `undefined` se la lettura fallisce (mai `[]`: significherebbe «nessun rimborso»), `corrieri`,
 *    `effettiGestiti` = SOLO gli effetti che questa rotta sa eseguire con le porte che ha (senza `stripe` niente rimborsi; senza `email` niente email).
 *  · Gli effetti (rimborso, magazzino, sessione, «Controlla con Stripe», email) li esegue `rimborsi.server.ts` DOPO la scrittura dell'ordine (che ha la sua condizione sul valore visto: se
 *    un collega l'ha cambiato, 409 e nessun effetto). Un effetto che non riesce non annulla l'ordine già scritto: la risposta lo dice, voce per voce.
 *  · Con S4 assente (`stato_pagamento` non c'è nella riga) le azioni nuove rispondono 409 «migrazione» col nome del file.
 *  · La riattivazione `annullato → nuovo` passa da `shop_ordine_riattiva` (S4, T53b): il controllo dei rimborsi e la scrittura stanno nella stessa transazione, sotto blocco, e lo storico lo
 *    scrive la funzione (la rotta non lo scrive una seconda volta). Il controllo puro di `azioni.ts` resta come prima cintura. Esiti: `riattivato` → 200, `cambiato` e `rimborso_attivo` → 409;
 *    una funzione che non risponde o risponde in un modo che non conosciamo → errore, e l'ordine resta annullato (si fallisce chiuso). */
import { costruisciAzione, eUuid, type ContestoAzione, type Effetto, type EsitoAzione, type MotivoErrore } from "./azioni";
import { MAX_ORDINI_LETTI, normalizzaOrdine, normalizzaTutti, type Ordine } from "./ordine";
import { statoPagamentoDi } from "./pagamento";
import { avvisiOrdine } from "./ordini-ui";
import { eseguiEffetto, inviaAutomatica, leggiRimborsi, type EsitoEffetto, type PortaStripe, type PorteEffetti } from "./rimborsi.server";
import type { PorteEmail } from "../../shop/email/tipi";

/* ══ LE PORTE ═══════════════════════════════════════════════════════════════ */

export interface EsitoDb {
  data: unknown;
  /** `message` esiste per i nomi degli errori delle funzioni SQL (`RAISE EXCEPTION 'rimborso_oltre_pagato'`): si confronta con un elenco chiuso, MAI si scrive nel log né si ripete. */
  error: { code?: unknown; message?: unknown } | null;
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
  /** Le funzioni SQL di S4 (R2): rimborso, riconciliazione, giacenza, pagato. */
  rpc(nome: string, argomenti?: Record<string, unknown>): PromiseLike<EsitoDb>;
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
  /** R2 (T53): il client di Stripe (`creaClientStripe`, letto dalla rotta al momento della richiesta). Senza, rimborsi, sessione da far scadere e «Controlla con Stripe» non sono eseguibili. */
  stripe?: PortaStripe;
  /** R2 (T53): l'invio delle email dello shop (T54). Senza, nessuna email parte e `email_invia` non è eseguibile. */
  email?: PorteEmail;
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
/** Le otto azioni nuove del R2 (D55): per loro serve S4, e `costruisciAzione` riceve il contesto (rimborsi, corrieri, effetti gestiti). */
const AZIONI_R2: readonly string[] = ["spedisci", "annulla", "rimborso", "riconcilia", "fattura_emessa", "email_invia", "giacenza_verificata", "correggi_stato"];
/** Quelle che decidono con i rimborsi già fatti sotto gli occhi. */
const CON_RIMBORSI: readonly string[] = ["annulla", "rimborso", "correggi_stato"];
/** Quelle che non scrivono sull'ordine: fanno solo effetti (la funzione SQL o la rotta scrivono lo storico). */
const SOLO_EFFETTI: readonly string[] = ["rimborso", "riconcilia", "email_invia"];
const FILE_S4 = "20261122120000_shop_pagamenti.sql";
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
const SENZA_S4 = () =>
  rifiuta(
    "migrazione",
    409,
    `Mancano gli aggiornamenti del database per i pagamenti: chiedi a chi gestisce il database di applicare ${FILE_S4}.`,
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

/** Una sezione del dettaglio: il suo valore, o `null` se la lettura non riesce (si logga il solo codice). Un guasto qui non nasconde il resto. */
async function sezione<T>(d: DipendenzeOrdini, dove: string, leggi: () => PromiseLike<EsitoDb>, forma: (dati: unknown) => T): Promise<T | null> {
  try {
    const r = await leggi();
    if (r.error) {
      d.log(`${dove} ${codiceDi(r.error)}`);
      return null;
    }
    return forma(r.data);
  } catch (e) {
    d.log(`${dove} eccezione ${nomeDi(e)}`);
    return null;
  }
}

/** `?dettaglio=<uuid>` (R2): l'ordine, i dati riservati (fattura e consensi: mai attribuzione, IP o browser), i rimborsi, le email, lo storico, gli avvisi. Senza S4 solo ordine, storico e avvisi. */
async function dettaglioOrdine(d: DipendenzeOrdini, id: string) {
  const pronta = await migrazionePronta(d);
  const riga = await leggiRiga(d, id);
  const ordine = riga && normalizzaOrdine(riga);
  if (!riga || !ordine) throw NON_TROVATO();
  const conPagamenti = "stato_pagamento" in riga; // S4 c'è se la colonna c'è: la riga che torna da `select *` ha le colonne che esistono
  const storico = pronta
    ? await sezione(
        d,
        "storico",
        () => d.db.from("shop_order_eventi").select("id,created_at,tipo,chi,prima,dopo").eq("order_id", id).order("created_at", { ascending: false }).limit(MAX_EVENTI),
        (dati) => (Array.isArray(dati) ? dati : []).map(eventoPerLaPagina),
      )
    : [];
  const riservati = conPagamenti
    ? await sezione(
        d,
        "riservati",
        () => d.db.from("shop_ordini_riservati").select("fattura,consensi").eq("ordine_id", id).limit(1),
        (dati) => {
          const r = Array.isArray(dati) && eOggetto(dati[0]) ? dati[0] : {};
          return { fattura: r.fattura ?? null, consensi: r.consensi ?? null };
        },
      )
    : null;
  const rimborsi = conPagamenti
    ? ((await leggiRimborsi({ db: d.db, log: d.log }, id))?.map((x) => ({
        id: x.id,
        importoCent: x.importoCent,
        stato: x.stato,
        motivo: x.motivo,
        origine: x.origine,
        chi: x.chi,
        creatoIl: x.creatoIl,
        aggiornatoIl: x.aggiornatoIl,
        stripeRimborsoId: x.stripeRimborsoId,
      })) ?? null)
    : null;
  return {
    ok: true,
    ordine,
    riservati,
    rimborsi,
    email: Object.entries(ordine.emailInviate).map(([chiave, e]) => ({ chiave, stato: e.stato, il: e.il, codice: e.codice })),
    storico,
    avvisi: avvisiOrdine(ordine),
    migrazione: { pronta, pagamenti: conPagamenti },
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

    const dettaglio = q.get("dettaglio");
    if (dettaglio !== null) {
      if (!eUuid(dettaglio)) throw rifiuta("valore", 400, "L'ordine indicato non è valido.");
      return json(await dettaglioOrdine(d, dettaglio));
    }

    if (q.get("conta") === "1") {
      // R2: come `contaComeLavoro` (pagamento.ts), con UNA richiesta che conta: i «nuovo» il cui stato di pagamento si lavora (vuoto = ordine di prima, pagato,
      // rimborsato in parte, da incassare) e che non sono di prova. Gli in attesa, scaduti, falliti, rimborsati e le prove non entrano nel numeretto.
      let r = await d.db
        .from("shop_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "nuovo")
        .or("stato_pagamento.is.null,stato_pagamento.eq.,stato_pagamento.eq.pagato,stato_pagamento.eq.rimborsato_in_parte,stato_pagamento.eq.da_incassare")
        .or("prova.is.null,prova.eq.false");
      // senza S4 (le colonne non ci sono) si conta come oggi: solo `status`, e funziona anche prima di M1 (il numeretto della voce di menu)
      if (r.error && mancante(r.error))
        r = await d.db
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

/** Gli effetti che QUESTA rotta esegue davvero con le porte che ha. `costruisciAzione` rifiuta ogni azione che ne chiede uno non dichiarato. */
function effettiGestiti(d: DipendenzeOrdini): Effetto["tipo"][] {
  const e: Effetto["tipo"][] = ["giacenza_rimetti"]; // solo una funzione SQL
  if (d.stripe) e.push("rimborso", "scadi_sessione", "riconcilia");
  if (d.email) e.push("email");
  return e;
}

/** L'elenco dei corrieri `[{nome, modello}]` di `shop_impostazioni`; `undefined` se non si legge (valgono i nomi di partenza e nessun link). */
async function leggiCorrieri(d: DipendenzeOrdini): Promise<unknown> {
  const r = await sezione(d, "corrieri", () => d.db.from("shop_impostazioni").select("valore").eq("chiave", "corrieri").limit(1), (dati) => (Array.isArray(dati) && eOggetto(dati[0]) ? dati[0].valore : undefined));
  return r ?? undefined;
}

/** `annullato → nuovo` con `shop_ordine_riattiva`. Qualunque cosa non sia `riattivato` è un rifiuto e l'ordine resta annullato (si fallisce chiuso). */
async function riattivaOrdine(d: DipendenzeOrdini, ordineId: string, motivo: string, chi: string): Promise<void> {
  const r = await d.db.rpc("shop_ordine_riattiva", { p_ordine: ordineId, p_motivo: motivo, p_chi: chi });
  const FRASE_RIMBORSO = "L'ordine ha un rimborso richiesto o riuscito: non si può riattivare.";
  if (r.error) {
    d.log(`riattiva ${codiceDi(r.error)}`); // mai il messaggio: lo si confronta soltanto col nome dell'errore che conosciamo
    if (r.error.message === "rimborso_attivo") throw rifiuta("conflitto", 409, FRASE_RIMBORSO);
    throw rifiuta("interno", 502, "Non sono riuscito a riattivare l'ordine: è rimasto annullato. Riprova tra un momento.");
  }
  const esito = eOggetto(r.data) ? r.data.esito : null;
  if (esito === "riattivato") return;
  if (esito === "cambiato") throw CONFLITTO();
  if (esito === "rimborso_attivo") throw rifiuta("conflitto", 409, FRASE_RIMBORSO);
  d.log("riattiva esito");
  throw rifiuta("interno", 502, "Non sono riuscito a riattivare l'ordine: è rimasto annullato. Riprova tra un momento.");
}

/** Il pagamento dell'ordine è stato incassato (anche se poi rimborsato): da qui l'annullo avvisa il cliente. */
const incassato = (o: Ordine): boolean => ["pagato", "rimborsato_in_parte", "rimborsato"].includes(statoPagamentoDi(o));

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
    const chi = (typeof g.nome === "string" ? g.nome.trim().slice(0, MAX_CHI) : "") || "Titolare";

    // R2: le azioni nuove vogliono S4 (la colonna `stato_pagamento` c'è nella riga); le vecchie no.
    const nuova = typeof corpo.azione === "string" && AZIONI_R2.includes(corpo.azione);
    if (nuova && !("stato_pagamento" in riga)) throw SENZA_S4();
    const porte: PorteEffetti = { db: d.db, stripe: d.stripe, email: d.email, adesso: d.adesso, log: d.log };
    // Il contesto è SEMPRE un oggetto. `rimborsi` solo dove serve; se la lettura fallisce resta `undefined` (mai `[]`: sarebbe «nessun rimborso»).
    const rimborsiLetti = nuova && ordine.statoPagamento !== null && CON_RIMBORSI.includes(String(corpo.azione)) ? await leggiRimborsi(porte, ordine.id) : undefined;
    const contesto: ContestoAzione = { effettiGestiti: effettiGestiti(d), rimborsi: rimborsiLetti };
    if (corpo.azione === "spedisci") contesto.corrieri = await leggiCorrieri(d);

    // Una richiesta di rimborso con una chiave GIÀ nota (doppio clic, ripetizione dopo un timeout) è la stessa richiesta: non si rivaluta il massimo, si riprende la riga.
    const ripetuta = corpo.azione === "rimborso" && d.stripe ? rimborsiLetti?.find((x) => x.chiaveRichiesta !== null && x.chiaveRichiesta === corpo.chiaveRichiesta) : undefined;
    let esito: Extract<EsitoAzione, { ok: true }>;
    if (ripetuta) {
      esito = {
        ok: true,
        patch: {},
        condizioni: {},
        evento: { order_id: ordine.id, order_ref: ordine.ref, tipo: "rimborso_richiesto", prima: {}, dopo: {} },
        effetti: [{ tipo: "rimborso", importoCent: Number(ripetuta.importoCent), motivo: ripetuta.motivo, chiaveRichiesta: String(corpo.chiaveRichiesta) }],
      };
    } else {
      const e = costruisciAzione(corpo, ordine, adesso, contesto);
      if (!e.ok) throw rifiutoDa(e);
      esito = e;
    }

    let rigaOra = riga;
    const scrive = Object.keys(esito.patch).length > 0; // rimborso, riconcilia, email_invia non scrivono l'ordine: lo fanno le funzioni SQL
    // `annullato → nuovo`: la scrittura, il controllo dei rimborsi e lo storico li fa `shop_ordine_riattiva` in una transazione (nessun `update` diretto, nessun ripristino)
    const riattiva = corpo.azione === "correggi_stato" && ordine.stato === "annullato";
    if (riattiva) await riattivaOrdine(d, ordine.id, String(esito.evento.dopo.motivo ?? ""), chi);
    else if (scrive && (await aggiorna(d, ordine.id, esito.patch, esito.condizioni)) === 0) {
      // 0 righe: o l'ha cambiato un altro, o il testo in tabella ha spazi ai bordi e la condizione tagliata non combacia.
      // Si rilegge UNA volta: se è davvero cambiato → 409; se è lo stesso, si riprova UNA volta col testo scritto com'è.
      const letta = await leggiRiga(d, ordine.id);
      const ordine2 = letta && normalizzaOrdine(letta);
      if (!letta || !ordine2) throw NON_TROVATO();
      const nuovo = costruisciAzione(corpo, ordine2, adesso, contesto);
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

    // Lo storico lo scrive il server; se non riesce l'ordine resta com'è e lo si dice. Per `rimborso` lo scrive già `shop_rimborso_prenota` (una riga sola).
    // Per `riconcilia` e `email_invia` si scrive DOPO gli effetti, con l'esito.
    let registrato = corpo.azione === "rimborso" || riattiva;
    const scriviEvento = async (dopo: Record<string, unknown> = {}) => {
      try {
        const ev = await d.db.from("shop_order_eventi").insert({ ...esito.evento, dopo: { ...esito.evento.dopo, ...dopo }, chi });
        if (ev.error) d.log(`evento ${codiceDi(ev.error)}`);
        else registrato = true;
      } catch (e) {
        d.log(`evento eccezione ${nomeDi(e)}`);
      }
    };
    if (!SOLO_EFFETTI.includes(String(corpo.azione)) && !riattiva) await scriviEvento();

    // Gli effetti, nell'ordine in cui `costruisciAzione` li ha chiesti. Nessuno lancia: un guasto è `non_riuscito` con la sua frase.
    const effetti: EsitoEffetto[] = [];
    for (const e of esito.effetti ?? []) effetti.push(await eseguiEffetto(porte, e, ordine, chi));
    if (SOLO_EFFETTI.includes(String(corpo.azione)) && corpo.azione !== "rimborso") await scriviEvento({ esito: effetti[0]?.esito ?? null });
    // Le email che partono da sole: «spedito» e «annullato» (solo se aveva pagato), solo per la cassa nuova e solo se la rotta ha la porta.
    let email: Awaited<ReturnType<typeof inviaAutomatica>> | undefined;
    if (scrive && d.email && ordine.statoPagamento !== null) {
      if (corpo.azione === "spedisci") email = await inviaAutomatica(porte, "spedito", ordine.id);
      else if (corpo.azione === "annulla" && incassato(ordine)) email = await inviaAutomatica(porte, "annullato", ordine.id);
    }

    // Un'azione che fa SOLO effetti e non ne riesce nessuno è un errore da mostrare (la frase dice perché); le altre hanno già scritto l'ordine e dicono voce per voce.
    if (SOLO_EFFETTI.includes(String(corpo.azione)) && effetti.length && effetti.every((e) => e.esito === "non_riuscito"))
      throw rifiuta("valore", effetti[0].http ?? 409, effetti[0].frase);

    // Con gli effetti l'ordine può essere cambiato altrove (rimborsato, pagato, giacenza): si rilegge. Se non riesce, vale la riga letta + la patch.
    let dopo: Ordine = normalizzaOrdine({ ...rigaOra, ...esito.patch }) ?? ordine;
    if (effetti.length || riattiva) {
      try {
        const fresca = await leggiRiga(d, ordine.id);
        dopo = (fresca && normalizzaOrdine(fresca)) || dopo;
      } catch {
        /* già nel log; la risposta usa la riga + la patch */
      }
    }
    // shortcut: senza effetti l'ordine della risposta è la riga letta + la patch, non riletto dal database; la pagina rilegge comunque l'elenco (30 s).
    return json({
      ok: true,
      ordine: dopo,
      storico: registrato,
      ...(effetti.length ? { effetti: effetti.map(({ tipo, esito: e, frase }) => ({ tipo, esito: e, frase })) } : {}),
      ...(email ? { email } : {}),
      ...(corpo.azione === "riconcilia" ? { avvisi: avvisiOrdine(dopo) } : {}),
    });
  } catch (e) {
    return rispostaDaErrore(e, d);
  }
}
