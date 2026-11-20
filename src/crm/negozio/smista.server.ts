/** ── LO SMISTAMENTO DEL CMS: UNA ROTTA, QUATTRO MODULI (smista.server.ts) ────
 *  Commessa 2026-11-20-shop-completo (T10). `/api/crm/negozio` è un solo indirizzo, ma le azioni sono di quattro moduli:
 *  prodotti (T08), giacenza, categorie e interruttori (T09). Qui si decide a chi tocca; il lavoro è tutto dei moduli.
 *  ⚠️ Importabile senza ambiente: niente `process.env`, niente client del server. La rotta (`src/routes/api.crm.negozio.ts`)
 *   collega le porte; i moduli si provano con un finto database (`prove/negozio/rotte.mjs`).
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · La guardia («pagamenti») viene PRIMA di ogni cosa, anche prima di leggere il corpo; la si chiama UNA volta e il suo
 *    esito passa ai moduli (che la «richiamano» e ricevono lo stesso esito: nessuna seconda verifica).
 *  · L'azione si cerca con `Object.hasOwn` su una tabella costruita dagli elenchi dei moduli: `constructor`, `toString`,
 *    `__proto__` non esistono. Un'azione fuori elenco va al modulo dei prodotti, che risponde 400 senza toccare il database.
 *  · Il corpo si legge UNA volta qui, a pezzi e fermandosi al tetto (anche senza Content-Length); ai moduli arriva una richiesta nuova con lo stesso corpo (il corpo si legge una volta sola). */
import {
  AZIONI_PRODOTTI,
  gestisciGET as leggiProdotti,
  gestisciPOST as scriviProdotti,
  type ClienteDb as ClienteDbProdotti,
  type DipendenzeProdotti,
} from "./prodotti.server";
import { Rifiuto, leggiTesto, type ClienteDb as ClienteDbCms } from "./comune";
import { AZIONI_GIACENZA, gestisciPOST as scriviGiacenza } from "./giacenza.server";
import { AZIONI_CATEGORIE, gestisciGET as leggiCategorie, gestisciPOST as scriviCategorie } from "./categorie.server";
import { AZIONI_INTERRUTTORI, gestisciGET as leggiInterruttori, gestisciPOST as scriviInterruttori, type FattiEsterni } from "./interruttori.server";

/** Il client di servizio deve avere tutto ciò che servono i moduli (da `supabaseAdmin as unknown as ClienteDbNegozio`). */
export type ClienteDbNegozio = ClienteDbProdotti & ClienteDbCms;

export interface DipendenzeNegozio extends Omit<DipendenzeProdotti, "db"> {
  db: ClienteDbNegozio;
  /** Ciò che il database non sa e che il cancello d'apertura chiede (banner e, dal R2, pagamento, spedizioni, email, M2). */
  fattiEsterni: () => FattiEsterni | Promise<FattiEsterni>;
}

type Modulo = "prodotti" | "giacenza" | "categorie" | "interruttori";
const PER_AZIONE: Record<string, Modulo> = Object.fromEntries([
  ...AZIONI_PRODOTTI.map((a) => [a, "prodotti"]),
  ...AZIONI_GIACENZA.map((a) => [a, "giacenza"]),
  ...AZIONI_CATEGORIE.map((a) => [a, "categorie"]),
  ...AZIONI_INTERRUTTORI.map((a) => [a, "interruttori"]),
]);
/** Tutte le azioni che la rotta conosce. */
export const AZIONI_NEGOZIO: readonly string[] = Object.keys(PER_AZIONE);

const SCRIVI: Record<Modulo, (r: Request, d: DipendenzeNegozio) => Promise<Response>> = {
  prodotti: scriviProdotti,
  giacenza: scriviGiacenza,
  categorie: scriviCategorie,
  interruttori: scriviInterruttori,
};
/** Le letture (`?prodotti`, `?prodotto=`, `?categorie`, `?interruttori`) e chi le fa. Il resto va ai prodotti, che dice «non so cosa leggere». */
const LEGGI: Record<string, (r: Request, d: DipendenzeNegozio) => Promise<Response>> = {
  prodotti: leggiProdotti,
  prodotto: leggiProdotti,
  categorie: leggiCategorie,
  interruttori: leggiInterruttori,
};
const MAX_CORPO = 100_000; // il tetto più alto dei moduli (prodotti); gli altri hanno il loro, più stretto

const json = (o: unknown, stato: number): Response =>
  new Response(JSON.stringify(o), { status: stato, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const nomeDi = (e: unknown): string => String((e as { name?: unknown } | null)?.name ?? "?").replace(/[^A-Za-z0-9_]/g, "").slice(0, 30) || "?";

/** La guardia una volta sola: se passa, ai moduli si dà una guardia che risponde subito con lo stesso esito. */
async function conGuardia(
  request: Request,
  d: DipendenzeNegozio,
  lavoro: (dd: DipendenzeNegozio) => Promise<Response>,
): Promise<Response> {
  try {
    const g = await d.guardia(request);
    if (!g.ok) return g.risposta;
    return await lavoro({ ...d, guardia: async () => g });
  } catch (e) {
    if (e instanceof Rifiuto) return json({ ok: false, motivo: e.motivo, frase: e.frase }, e.stato);
    d.log(`eccezione ${nomeDi(e)}`); // mai il messaggio
    return json({ ok: false, motivo: "interno", frase: "Qualcosa non ha funzionato: riprova tra un momento." }, 500);
  }
}

export const gestisciGET = (request: Request, d: DipendenzeNegozio): Promise<Response> =>
  conGuardia(request, d, (dd) => {
    const p = new URL(request.url).searchParams;
    const chiave = Object.keys(LEGGI).find((k) => p.has(k));
    return (chiave !== undefined ? LEGGI[chiave] : leggiProdotti)(request, dd);
  });

export const gestisciPOST = (request: Request, d: DipendenzeNegozio): Promise<Response> =>
  conGuardia(request, d, async (dd) => {
    const testo = await leggiTesto(request, MAX_CORPO); // a pezzi: oltre il tetto si smette di leggere (413)
    let azione: unknown;
    try {
      azione = (JSON.parse(testo) as { azione?: unknown } | null)?.azione;
    } catch {
      /* corpo rotto: lo rifiuta il modulo dei prodotti con la sua frase */
    }
    const modulo: Modulo = typeof azione === "string" && Object.hasOwn(PER_AZIONE, azione) ? PER_AZIONE[azione] : "prodotti";
    // corpo già letto: ai moduli arriva una richiesta nuova con lo stesso testo (senza content-length: lo ricalcola)
    const intestazioni = new Headers([...request.headers].filter(([nome]) => nome.toLowerCase() !== "content-length"));
    return SCRIVI[modulo](new Request(request.url, { method: "POST", headers: intestazioni, body: testo }), dd);
  });
