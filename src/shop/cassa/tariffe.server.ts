/** ── LA TARIFFA DI SPEDIZIONE PER IL PUBBLICO: `tariffaSpedizione()` ─────────
 *  Commessa 2026-11-20-shop-completo, R2 · T50 (PIANO-R2 D51, D62, §3.7). Importabile senza ambiente: si ricevono PORTE
 *  (database, orologio, la cassa effettiva), così si prova con un finto database. Carrello, scheda e cassa leggono TUTTI
 *  questa funzione: la cifra non può divergere.
 *
 *  ⚠️ Legge soltanto: la tariffa attiva dell'Italia (`shop_spedizioni_tariffe`, S5). Non scrive mai (si scrive dal CRM,
 *   `crm/negozio/spedizioni.server.ts`, con la funzione SQL).
 *  ⚠️ La risposta è `SpedizionePubblica` di T45 (`leggiSpedizione`): `{stato:"ok", costoCent, confermata, corriere, tempi, frase}`
 *   o `{stato:"assente"}`. Finché il titolare non ha premuto «Conferma» corriere, tempi e frase sono `null`.
 *   Mai `provvisoria`, `confermata_il`, `id`. «Assente» = la cassa Stripe non si apre.
 *  ⚠️ MAI un'eccezione: ogni errore del database è `assente`. Memoria di 30 s; un guasto si ricorda 5 s (poi si rilegge).
 *  ⚠️ IL RIPIEGO (D51): se la tabella S5 NON c'è e la cassa effettiva è `vecchia`, la risposta è la cifra di R1 (4,90 €,
 *   non confermata): il sito resta quello di oggi finché S5 non è applicata. Con la cassa `stripe` e la tabella assente
 *   è `assente`. Il ripiego sta QUI e in nessun altro posto della cassa nuova: carrello e cassa non hanno due rami.
 *  Nel log solo CODICI. */
import { leggiSpedizione, tariffaAttiva, type SpedizionePubblica } from "./spedizione";
import { codiceDi, tabellaAssente, type Cassa } from "../cms/cassa-sito";

/** La cifra di R1 (stesso valore di `SPEDIZIONE_CMS_CENT` della cassa vecchia: una prova li tiene uguali). shortcut: sparisce
 *  insieme alla cassa vecchia / quando S5 sarà applicata ovunque e la cassa vecchia non esisterà più. */
const RIPIEGO_CENT = 490;

/** Il pezzo di costruttore di query di Supabase che serve qui (il finto delle prove ne ha lo stesso aspetto). */
interface Interrogazione extends PromiseLike<{ data: unknown; error: { code?: unknown } | null }> {
  eq(colonna: string, valore: unknown): Interrogazione;
  limit(n: number): Interrogazione;
}
export interface DbTariffe {
  from(tabella: string): { select(colonne?: string): Interrogazione };
}
export interface PorteTariffe {
  db: DbTariffe;
  /** Millisecondi (`Date.now()`); le prove usano un orologio finto. */
  adesso: () => number;
  /** La cassa effettiva adesso (`cassaEffettiva(catalogo, leggiCassa())`). Serve SOLO al ripiego: se lancia vale `vecchia`. */
  cassa: () => Promise<Cassa> | Cassa;
  /** Solo CODICI di errore. */
  log?: (codice: string) => void;
}

const MEMORIA_MS = 30_000;
const MEMORIA_GUASTO_MS = 5_000;
/** Cosa ha detto il database: la riga, nessuna riga, tabella non ancora creata, guasto. */
type Lettura =
  | { tipo: "riga"; riga: unknown }
  | { tipo: "nessuna" }
  | { tipo: "migrazione" }
  | { tipo: "guasto" };
type Voce = { t: number; breve: boolean; p: Promise<Lettura> };
const memorie = new WeakMap<object, Voce>();

async function leggi(porte: PorteTariffe): Promise<Lettura> {
  try {
    const r = await porte.db
      .from("shop_spedizioni_tariffe")
      .select(
        "paese, nome, corriere, costo_cent, giorni_min, giorni_max, attiva, provvisoria, confermata_il",
      )
      .eq("paese", "IT")
      .eq("attiva", true)
      .limit(2);
    if (r.error) throw r.error;
    const riga = tariffaAttiva(r.data, "IT");
    return riga ? { tipo: "riga", riga } : { tipo: "nessuna" };
  } catch (e) {
    porte.log?.(`tariffa ${codiceDi(e)}`);
    return { tipo: tabellaAssente(e) ? "migrazione" : "guasto" };
  }
}

/** La lettura del database, in memoria (30 s; 5 s se non ha risposto). Chiamate insieme condividono la stessa lettura. */
function lettura(porte: PorteTariffe): Promise<Lettura> {
  const { db } = porte;
  if (typeof db !== "object" || db === null) return Promise.resolve({ tipo: "guasto" });
  const n = porte.adesso();
  const m = memorie.get(db);
  if (m && n >= m.t && n - m.t < (m.breve ? MEMORIA_GUASTO_MS : MEMORIA_MS)) return m.p;
  const voce: Voce = { t: n, breve: false, p: Promise.resolve<Lettura>({ tipo: "guasto" }) };
  voce.p = leggi(porte).then((l) => {
    voce.breve = l.tipo === "guasto" || l.tipo === "migrazione";
    voce.t = porte.adesso();
    return l;
  });
  memorie.set(db, voce);
  return voce.p;
}

async function cassaVecchia(porte: PorteTariffe): Promise<boolean> {
  try {
    return (await porte.cassa()) !== "stripe";
  } catch {
    return true; // D56: ogni errore → vecchia
  }
}

/** Cosa vede il cliente della spedizione. Non lancia mai. */
export async function tariffaSpedizione(porte: PorteTariffe): Promise<SpedizionePubblica> {
  try {
    const l = await lettura(porte);
    if (l.tipo === "riga") return leggiSpedizione(l.riga, porte.adesso());
    if (l.tipo === "migrazione" && (await cassaVecchia(porte)))
      return {
        stato: "ok",
        costoCent: RIPIEGO_CENT,
        confermata: false,
        corriere: null,
        tempi: null,
        frase: null,
      };
  } catch {
    /* assente */
  }
  return { stato: "assente" };
}
