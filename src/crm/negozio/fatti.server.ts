/** ── I FATTI CHE IL DATABASE E L'AMBIENTE DICONO AL CANCELLO (fatti.server.ts) ─
 *  Commessa 2026-11-20-shop-completo, R2 · T56 (PIANO-R2 D56, D65). Solo LETTURE: nessuna scrittura, nessuna funzione SQL.
 *  La rotta (`api.crm.negozio.ts`, T57) passa il risultato come `fattiEsterni` dell'interruttore.
 *
 *  `fattiDelDatabase(db, ambiente)` → i tre fatti del cancello + le quattro precondizioni della cassa:
 *   · `pagamentoIncassa`  esiste un ordine REALE (non di prova), pagato e rimborsato per intero (lo stato `rimborsato`);
 *   · `spedizioneResi`    la tariffa attiva è CONFERMATA (come la vede il pubblico) e il titolare ha messo `resi_confermati`;
 *   · `emailConferma`     esiste un ordine con `email_inviate.conferma_ordine.stato = "inviata"` (anche di prova);
 *   · `chiavePresente`, `segretoPresente`  le due variabili di Stripe ci sono (SOLO presente/assente: il valore non esce da qui);
 *   · `tariffaAttiva`     c'è una tariffa attiva per l'Italia con un costo valido;
 *   · `s4Presente`        le colonne dei pagamenti di `shop_orders` rispondono (migrazione S4 applicata).
 *  `migrazioneOrdini` NON si passa: la M2 la applica il titolare a mano e l'app non sa se «le iscrizioni libere sono chiuse».
 *
 *  ⚠️ Mai un'eccezione. Un fatto che non si riesce a leggere è `null` («non valutabile» = vale no); le precondizioni della cassa
 *   che non si riescono a leggere sono `false`. Nel log SOLO codici. Importabile senza ambiente: le variabili arrivano dalla porta
 *   `ambiente` (la rotta le legge dentro il gestore e passa `process.env`), qui non si legge niente da sé.
 *
 *  `leggiVetrinaCassa({db, cassa})` → cosa mostra la vetrina (D65): `sicuro` e i `metodi` spuntati. Con la cassa effettiva
 *  `vecchia` risponde sempre `{sicuro:false, metodi:[]}` senza nemmeno leggere. Memoria 15 s (un guasto 5 s, legata al collegamento). */
import { leggiSpedizione, tariffaAttiva as sceglieTariffa } from "../../shop/cassa/spedizione";
import { codiceDi, eOggetto, righe, type ClienteDb, type EsitoDb } from "./comune";
import type { FattiCassa } from "./cancello";

/** I metodi di pagamento ammessi (D65). Un solo elenco: lo usa anche l'interruttore. */
export const METODI_PAGAMENTO = ["carta", "apple_pay", "google_pay", "paypal", "klarna"] as const;
export type MetodoPagamento = (typeof METODI_PAGAMENTO)[number];
export const eMetodo = (x: unknown): x is MetodoPagamento =>
  typeof x === "string" && (METODI_PAGAMENTO as readonly string[]).includes(x);

/** Le sole due variabili che interessano; il resto dell'ambiente non si guarda. */
export type AmbienteCassa = Record<string, unknown> | null | undefined;

export interface FattiDelDatabase extends FattiCassa {
  pagamentoIncassa: boolean | null;
  spedizioneResi: boolean | null;
  emailConferma: boolean | null;
  chiavePresente: boolean;
  segretoPresente: boolean;
  tariffaAttiva: boolean;
  s4Presente: boolean;
}
export interface OpzioniFatti {
  adesso?: () => Date;
  /** Solo CODICI. */
  log?: (codice: string) => void;
}

/** C'è un testo non vuoto? (il valore non lo si tiene: solo il sì/no). */
const presente = (ambiente: AmbienteCassa, nome: string): boolean => {
  const v = eOggetto(ambiente) ? ambiente[nome] : undefined;
  return typeof v === "string" && v.trim() !== "";
};

const TETTO_ORDINI = 1000;

/** Una lettura che non lancia: i dati, oppure `null` (e il codice nel log). */
async function leggi(
  log: (c: string) => void,
  dove: string,
  lavoro: () => PromiseLike<EsitoDb>,
): Promise<Record<string, unknown>[] | null> {
  try {
    const r = await lavoro();
    if (r.error) {
      log(`${dove} ${codiceDi(r.error)}`);
      return null;
    }
    return righe(r.data);
  } catch (e) {
    log(
      `${dove} eccezione ${
        String((e as { name?: unknown } | null)?.name ?? "?")
          .replace(/[^A-Za-z0-9_]/g, "")
          .slice(0, 30) || "?"
      }`,
    );
    return null;
  }
}

export async function fattiDelDatabase(
  db: ClienteDb,
  ambiente: AmbienteCassa,
  opz: OpzioniFatti = {},
): Promise<FattiDelDatabase> {
  const adesso = opz.adesso ?? (() => new Date());
  const log = opz.log ?? (() => undefined);
  const chiavePresente = presente(ambiente, "STRIPE_SECRET_KEY");
  const segretoPresente = presente(ambiente, "STRIPE_WEBHOOK_SECRET");

  // Le letture partono insieme: nessuna dipende da un'altra.
  const [rimborsati, conferme, sonda, tariffe, resi] = await Promise.all([
    // ordini reali rimborsati per intero (la colonna `prova` esiste da S4)
    leggi(log, "ordini", () =>
      db
        .from("shop_orders")
        .select("id, pagato_il")
        .eq("stato_pagamento", "rimborsato")
        .eq("prova", false)
        .limit(50),
    ),
    // shortcut: si guardano gli ultimi 1000 ordini del sito e si filtra qui, perché il filtro su un campo dentro il JSON non si fa con il finto delle prove; quando gli ordini passano il migliaio, filtrare nel database (`email_inviate->conferma_ordine->>stato`).
    leggi(log, "email", () =>
      db
        .from("shop_orders")
        .select("email_inviate")
        .eq("canale", "sito")
        .order("created_at", { ascending: false })
        .limit(TETTO_ORDINI),
    ),
    leggi(log, "s4", () => db.from("shop_orders").select("stato_pagamento").limit(1)),
    leggi(log, "tariffa", () =>
      db
        .from("shop_spedizioni_tariffe")
        .select("paese, costo_cent, giorni_min, giorni_max, attiva, provvisoria, confermata_il")
        .eq("paese", "IT")
        .eq("attiva", true)
        .limit(2),
    ),
    leggi(log, "resi", () =>
      db.from("shop_impostazioni").select("valore").eq("chiave", "resi_confermati").limit(1),
    ),
  ]);

  const tariffa = tariffe ? sceglieTariffa(tariffe, "IT") : null;
  const spedizione = tariffa ? leggiSpedizione(tariffa, adesso()) : null;
  return {
    pagamentoIncassa: rimborsati === null ? null : rimborsati.some((o) => o.pagato_il != null),
    // senza la tariffa o senza la riga dei resi non si può dire «sì»; se la tabella non risponde, «non valutabile»
    spedizioneResi:
      tariffe === null || resi === null
        ? null
        : spedizione?.stato === "ok" && spedizione.confermata && resi[0]?.valore === true,
    emailConferma:
      conferme === null
        ? null
        : conferme.some(
            (o) =>
              (o.email_inviate as { conferma_ordine?: { stato?: unknown } } | null)?.conferma_ordine
                ?.stato === "inviata",
          ),
    chiavePresente,
    segretoPresente,
    tariffaAttiva: spedizione?.stato === "ok",
    s4Presente: sonda !== null,
  };
}

/* ══ LA VETRINA DELLA CASSA (D65) ═══════════════════════════════════════════ */

export interface VetrinaCassa {
  sicuro: boolean;
  metodi: MetodoPagamento[];
  /** La lettura è andata male (la funzione del server risponde `no-store`). */
  guasto: boolean;
}
export interface PorteVetrina {
  db: ClienteDb;
  /** La cassa EFFETTIVA (`stripe` solo con il catalogo `cms`): con `vecchia` non si legge niente. */
  cassa: "vecchia" | "stripe";
  adesso?: () => number;
  log?: (codice: string) => void;
}

const vuota = (guasto = false): VetrinaCassa => ({ sicuro: false, metodi: [], guasto });
const MEMORIA_MS = 15_000;
const MEMORIA_GUASTO_MS = 5_000;
type Voce = { t: number; guasto: boolean; p: Promise<VetrinaCassa> };
const memorie = new WeakMap<object, Voce>();

async function leggiVetrina(db: ClienteDb, log: (c: string) => void): Promise<VetrinaCassa> {
  const r = await leggi(log, "vetrina", () =>
    db
      .from("shop_impostazioni")
      .select("chiave, valore")
      .in("chiave", ["pagamento_sicuro", "metodi_pagamento"]),
  );
  if (r === null) return vuota(true);
  const valore = (chiave: string) => r.find((x) => x.chiave === chiave)?.valore;
  const grezzi = valore("metodi_pagamento");
  // solo i metodi conosciuti, una volta ciascuno; un valore che non è un elenco = nessun logo
  const metodi = Array.isArray(grezzi) ? METODI_PAGAMENTO.filter((m) => grezzi.includes(m)) : [];
  return { sicuro: valore("pagamento_sicuro") === true, metodi, guasto: false };
}

/** Cosa mostra la vetrina: «pagamento sicuro» e i loghi dei metodi spuntati. Mai un'eccezione. */
export function leggiVetrinaCassa(porte: PorteVetrina): Promise<VetrinaCassa> {
  const { db } = porte;
  if (porte.cassa !== "stripe" || typeof db !== "object" || db === null)
    return Promise.resolve(vuota());
  const log = porte.log ?? (() => undefined);
  const adesso = porte.adesso ?? Date.now;
  const n = adesso();
  const m = memorie.get(db);
  if (m && n >= m.t && n - m.t < (m.guasto ? MEMORIA_GUASTO_MS : MEMORIA_MS)) return m.p;
  const voce: Voce = { t: n, guasto: false, p: Promise.resolve(vuota()) };
  voce.p = leggiVetrina(db, log).then((v) => {
    voce.guasto = v.guasto;
    voce.t = adesso();
    return v;
  });
  memorie.set(db, voce);
  return voce.p;
}
