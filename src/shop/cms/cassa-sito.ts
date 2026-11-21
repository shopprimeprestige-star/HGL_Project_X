/** ── LA CASSA DEL SITO: `vecchia` O `stripe` (LETTURA) ──────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T50 (PIANO-R2 D56, D51). Modulo PURO: nessun accesso all'ambiente; il
 *  collegamento al database e a `SHOP_CASSA_FORZA` sta in `cassa-sito.functions.ts`, qui si ricevono le porte
 *  (così si prova con un finto database). Si scrive altrove (T56, `interruttore_imposta`): qui si LEGGE soltanto.
 *
 *  ⚠️ La cassa vecchia è l'impostazione predefinita: solo la parola esatta «stripe» apre la cassa nuova. Una riga
 *   assente, un valore strano, un errore, la tabella non ancora creata (S4 non applicata): `vecchia`. Mai un'eccezione.
 *  ⚠️ `cassaEffettiva`: `stripe` solo con il catalogo `cms` (le righe del catalogo `codice` non hanno SKU né giacenza).
 *  ⚠️ Memoria di 15 secondi; un guasto si ricorda 5 (si rilegge appena il database torna). La memoria è legata al
 *   collegamento (un isolato, un database), come quella del catalogo. Nel log solo CODICI, mai testi. */

export type Cassa = "vecchia" | "stripe";

/** Il valore di `shop_impostazioni.cassa_sito` → la cassa. Solo «stripe» (esatto) apre la nuova. */
export const cassaDa = (valore: unknown): Cassa => (valore === "stripe" ? "stripe" : "vecchia");

/** La cassa che il sito usa davvero: la nuova solo se anche il catalogo è `cms`. */
export const cassaEffettiva = (catalogo: unknown, cassa: unknown): Cassa =>
  catalogo === "cms" && cassa === "stripe" ? "stripe" : "vecchia";

/** Codici di Postgres/PostgREST che dicono «tabella o colonna assente»: la migrazione non è ancora applicata. */
const TABELLA_ASSENTE = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);
export const tabellaAssente = (errore: unknown): boolean => TABELLA_ASSENTE.has(codiceDi(errore));
/** Il solo pezzo di un errore che si può scrivere nel log: il codice (o il nome del tipo), ripulito. */
export const codiceDi = (errore: unknown): string => {
  const e = errore as { code?: unknown; name?: unknown } | null | undefined;
  const grezzo = e?.code ?? e?.name ?? "?";
  return (
    String(typeof grezzo === "string" || typeof grezzo === "number" ? grezzo : "?")
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, 12) || "?"
  );
};

/** Il pezzo di costruttore di query di Supabase che serve qui (il finto delle prove ne ha lo stesso aspetto). */
export interface DbCassa {
  from(tabella: string): {
    select(colonne?: string): {
      eq(
        colonna: string,
        valore: unknown,
      ): { maybeSingle(): PromiseLike<{ data: unknown; error: { code?: unknown } | null }> };
    };
  };
}
export interface PorteCassa {
  db: DbCassa;
  /** Millisecondi; le prove usano un orologio finto. */
  adesso?: () => number;
  /** `SHOP_CASSA_FORZA` (solo in locale, deciso da chi chiama): «stripe» o «vecchia»; ogni altro valore si ignora. */
  forza?: string | null;
  /** Solo CODICI di errore. */
  log?: (codice: string) => void;
}

const MEMORIA_MS = 15_000;
const MEMORIA_GUASTO_MS = 5_000;
type Voce = { t: number; guasto: boolean; p: Promise<Cassa> };
const memorie = new WeakMap<object, Voce>();

/** La cassa scelta dal titolare, com'è nel database (memoria 15 s). Ogni errore → `vecchia`. Non lancia mai. */
export function leggiCassa(porte: PorteCassa): Promise<Cassa> {
  const { db, forza } = porte;
  if (forza === "stripe" || forza === "vecchia") return Promise.resolve(forza);
  if (typeof db !== "object" || db === null) return Promise.resolve("vecchia");
  const adesso = porte.adesso ?? Date.now;
  const n = adesso();
  const m = memorie.get(db);
  if (m && n >= m.t && n - m.t < (m.guasto ? MEMORIA_GUASTO_MS : MEMORIA_MS)) return m.p;
  const voce: Voce = { t: n, guasto: false, p: Promise.resolve("vecchia") };
  voce.p = (async (): Promise<Cassa> => {
    try {
      const r = await db
        .from("shop_impostazioni")
        .select("valore")
        .eq("chiave", "cassa_sito")
        .maybeSingle();
      if (r.error) throw r.error;
      return cassaDa((r.data as { valore?: unknown } | null)?.valore);
    } catch (e) {
      porte.log?.(`cassa ${codiceDi(e)}`);
      voce.guasto = true;
      voce.t = adesso();
      return "vecchia";
    }
  })();
  memorie.set(db, voce);
  return voce.p;
}
