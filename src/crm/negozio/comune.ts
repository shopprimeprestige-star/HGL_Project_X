/** ── LE PARTI COMUNI DEI SERVER DEL CMS (comune.ts) ─────────────────────────
 *  Commessa 2026-11-20-shop-completo (T09). Le porte (guardia, database, orologio, log), la forma delle risposte
 *  e la sequenza «guardia → corpo → lavoro → risposta», uguali per giacenza, categorie, interruttori e permessi di
 *  caricamento. Stesso schema di `crm/ecommerce/ordini.server.ts`.
 *  ⚠️ Importabile senza ambiente: niente `process.env`, niente client creato a livello di modulo.
 *  ⚠️ Nei log SOLO codici (`error.code`, il nome del tipo di un'eccezione): mai l'oggetto errore, mai `details`, mai testi.
 *
 *  Risposte: `{ ok: true, … }` oppure `{ ok: false, motivo, frase, … }`; la frase in italiano la scrive il server.
 *  401/403 sono quelli di `guardiaCRM`. Nessuna cancellazione, tranne le righe del legame prodotto-categoria (categorie.server.ts). */
import { eUuid } from "../ecommerce/azioni";

export { eUuid };

/* ══ LE PORTE ═══════════════════════════════════════════════════════════════ */

export interface EsitoDb {
  data: unknown;
  error: { code?: unknown; message?: unknown } | null;
  count?: number | null;
}
/** Il pezzo di costruttore di query di Supabase che serve ai server del CMS (il finto delle prove ne ha lo stesso aspetto). */
export interface Costruttore extends PromiseLike<EsitoDb> {
  select(colonne?: string): Costruttore;
  insert(riga: Record<string, unknown> | Record<string, unknown>[]): Costruttore;
  update(patch: Record<string, unknown>): Costruttore;
  /** ⚠️ Solo per il legame `shop_prodotti_categorie` (D5: tutto il resto si archivia); una prova lo controlla nel sorgente. */
  delete(): Costruttore;
  eq(colonna: string, valore: unknown): Costruttore;
  in(colonna: string, valori: string[]): Costruttore;
  is(colonna: string, valore: null): Costruttore;
  order(colonna: string, opzioni?: { ascending?: boolean }): Costruttore;
  limit(n: number): Costruttore;
}
export interface ClienteDb {
  from(tabella: string): Costruttore;
  rpc(nome: string, args: Record<string, unknown>): PromiseLike<EsitoDb>;
}
export interface Porte {
  /** La guardia del CRM («pagamenti»): `ok` col nome di chi chiama, oppure la risposta 401/403 da restituire così com'è. */
  guardia: (request: Request) => Promise<{ ok: true; nome: string } | { ok: false; risposta: Response }>;
  adesso: () => Date;
  /** Solo CODICI (mai testi, id o nomi). */
  log: (codice: string) => void;
}
export interface PorteDb extends Porte {
  db: ClienteDb;
}

/* ══ I RIFIUTI ══════════════════════════════════════════════════════════════ */

/** Una risposta d'errore decisa dentro il codice: si lancia e `gestisci` la trasforma in JSON. `extra` si aggiunge alla risposta. */
export class Rifiuto extends Error {
  constructor(
    readonly motivo: string,
    readonly stato: number,
    readonly frase: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(motivo);
  }
}
export const rifiuta = (motivo: string, stato: number, frase: string, extra?: Record<string, unknown>) =>
  new Rifiuto(motivo, stato, frase, extra);

export const senzaMigrazione = () =>
  rifiuta(
    "migrazione",
    409,
    "Mancano gli aggiornamenti del database del negozio: chiedi a chi gestisce il database di applicare l'aggiornamento del catalogo.",
  );
export const conflitto = (frase: string, extra?: Record<string, unknown>) => rifiuta("conflitto", 409, frase, extra);

/** Codici di PostgREST/Postgres che dicono «tabella, colonna o funzione inesistente» = la migrazione S1 non c'è ancora. */
const MANCANTI = ["42703", "42P01", "42883", "PGRST202", "PGRST204", "PGRST205"];

/** Il solo pezzo di un errore del database che si può scrivere nel log: il codice, ripulito. */
export const codiceDi = (errore: { code?: unknown } | null | undefined): string =>
  String(errore?.code ?? "?").replace(/[^A-Za-z0-9_]/g, "").slice(0, 12) || "?";
const nomeDi = (e: unknown): string =>
  String((e as { name?: unknown } | null)?.name ?? "?").replace(/[^A-Za-z0-9_]/g, "").slice(0, 30) || "?";
export const eMancante = (errore: { code?: unknown } | null): boolean => MANCANTI.includes(codiceDi(errore));

/** Un errore del database che non è «manca la migrazione»: si logga il codice e si risponde 500 generico. */
export function guasto(d: Porte, dove: string, errore: { code?: unknown } | null): Rifiuto {
  d.log(`${dove} ${codiceDi(errore)}`);
  return rifiuta("interno", 500, "Il database non ha risposto: riprova tra un momento.");
}

/** I dati di una risposta del database, oppure il rifiuto giusto (migrazione mancante o guasto). */
export function dati(d: Porte, dove: string, r: EsitoDb): unknown {
  if (r.error) throw eMancante(r.error) ? senzaMigrazione() : guasto(d, dove, r.error);
  return r.data;
}

/* ══ PICCOLI AIUTI ══════════════════════════════════════════════════════════ */

export const json = (o: unknown, stato = 200): Response =>
  new Response(JSON.stringify(o), { status: stato, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
export const eOggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export const righe = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x.filter(eOggetto) : []);

const MAX_CORPO = 20_000;

/** Il corpo di una richiesta come testo, letto a pezzi: si smette appena si supera `max` (413), senza leggere il resto.
 *  Se `Content-Length` dice già che è troppo, non si legge niente. Chi non lo dichiara (flusso a pezzi) si ferma lo stesso. */
export async function leggiTesto(request: Request, max: number): Promise<string> {
  const troppo = () => rifiuta("valore", 413, "La richiesta è troppo grande.");
  if (Number(request.headers.get("content-length")) > max) throw troppo();
  const lettore = request.body?.getReader();
  if (!lettore) return "";
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > max) {
      await lettore.cancel().catch(() => undefined);
      throw troppo();
    }
    pezzi.push(value);
  }
  const intero = new Uint8Array(totale);
  let da = 0;
  for (const p of pezzi) {
    intero.set(p, da);
    da += p.byteLength;
  }
  return new TextDecoder().decode(intero);
}

/** Il corpo di un POST: JSON, un oggetto, non oltre `MAX_CORPO`. Altrimenti un rifiuto, prima di qualunque lavoro. */
export async function leggiCorpo(request: Request): Promise<Record<string, unknown>> {
  const testo = await leggiTesto(request, MAX_CORPO);
  let corpo: unknown;
  try {
    corpo = JSON.parse(testo);
  } catch {
    throw rifiuta("valore", 400, "La richiesta non è valida.");
  }
  if (!eOggetto(corpo)) throw rifiuta("valore", 400, "La richiesta non è valida.");
  return corpo;
}

/** La guardia viene PRIMA di tutto; poi il lavoro (che lancia `Rifiuto` per ogni «no»); nessun errore esce grezzo. */
export async function gestisci(
  request: Request,
  d: Porte,
  lavoro: (chi: string) => Promise<Record<string, unknown>>,
): Promise<Response> {
  try {
    const g = await d.guardia(request); // dentro il `try`: se la guardia lancia esce un JSON «interno»
    if (!g.ok) return g.risposta;
    const chi = (typeof g.nome === "string" ? g.nome.trim().slice(0, 80) : "") || "Titolare";
    return json({ ok: true, ...(await lavoro(chi)) });
  } catch (e) {
    if (e instanceof Rifiuto) return json({ ...e.extra, ok: false, motivo: e.motivo, frase: e.frase }, e.stato);
    d.log(`eccezione ${nomeDi(e)}`); // mai il messaggio: può contenere dati
    return json({ ok: false, motivo: "interno", frase: "Qualcosa non ha funzionato: riprova tra un momento." }, 500);
  }
}

/** La `azione` del corpo, se è una di quelle del modulo. */
export function azioneDi(corpo: Record<string, unknown>, ammesse: readonly string[]): string {
  const a = corpo.azione;
  if (typeof a !== "string" || !ammesse.includes(a)) throw rifiuta("azione_sconosciuta", 400, "Questa azione non è prevista.");
  return a;
}

/** Una nota facoltativa: testo, al massimo `max` segni, senza caratteri di controllo; vuota = nessuna. */
export function notaDi(x: unknown, max = 200): string | null {
  if (x === undefined || x === null) return null;
  if (typeof x !== "string" || x.length > max * 2 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x))
    throw rifiuta("valore", 400, "La nota non è valida.");
  const t = x.trim();
  if (t.length > max) throw rifiuta("valore", 400, `La nota può avere al massimo ${max} caratteri.`);
  return t || null;
}

/* ══ LE VERSIONI (`aggiornato_il`) ══════════════════════════════════════════ */

/** Due versioni sono la stessa se sono lo stesso ISTANTE (al millisecondo), comunque siano scritte (`Z` o `+00:00`, con o
 *  senza decimali): il confronto fra testi respingerebbe una versione giusta scritta in un'altra forma. */
export const stessoIstante = (a: unknown, b: unknown): boolean => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Date.parse(a), y = Date.parse(b);
  return !Number.isNaN(x) && x === y;
};

/** La versione com'è ORA nel database (mai quella calcolata qui), da restituire dopo una scrittura. `null` se non si riesce a leggere:
 *  la scrittura è già fatta, quindi non si fallisce; il pannello rilegge. */
export async function versioneAttuale(d: PorteDb, tabella: string, id: string): Promise<string | null> {
  try {
    const r = await d.db.from(tabella).select("aggiornato_il").eq("id", id).limit(1);
    if (r.error) {
      d.log(`versione ${codiceDi(r.error)}`);
      return null;
    }
    const v = righe(r.data)[0]?.aggiornato_il;
    return typeof v === "string" ? v : null;
  } catch {
    d.log("versione eccezione");
    return null;
  }
}
