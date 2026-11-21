/** ── LA CASSA: IL CALCOLO DELL'ORDINE (PURO) ────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T48 (PIANO-R2 D50, §3.1 punti 4-6; SPEC 7.4 n. 2). Nessun database, nessuna rete.
 *  `calcolaOrdine(righeServer, righeRichieste, tariffa)`: le righe del SERVER (`shop_cassa_righe`) decidono nome, prezzo e
 *  disponibilità; dal cliente si leggono SOLO `sku` e `qty`. Prezzo, spedizione e totale che il browser dovesse mandare non
 *  hanno dove entrare: il codice non li guarda. Soldi in CENTESIMI interi, mai euro con la virgola.
 *  Rifiuti per riga (`non_disponibile`, sempre la stessa frase generica: nessuna cifra, nessun «bozza», nessun nome di prodotto):
 *  SKU sconosciuto, prodotto non pubblicato, variante spenta, esaurita, quantità oltre la giacenza, riga senza slug o nome,
 *  Invisible Derm (`eInvisibleDerm(nome, slug)` di pubblico.ts: mai in cassa), qualunque prezzo non intero o ≤ 0.
 *  Rifiuti generali (`valore`): righe non valide o più di 30, quantità fuori da 1..20, totale sotto 50 centesimi (minimo di
 *  Stripe in euro) o oltre il massimo di Stripe. Senza tariffa valida la cassa non si apre (`cassa_chiusa`, D51). */
import { eInvisibleDerm } from "@/shop/cms/pubblico";
import { costoSpedizione, type TariffaRiga } from "./spedizione";

export const MAX_RIGHE = 30;
export const QTY_MIN = 1;
export const QTY_MAX = 20;
/** Il minimo di Stripe per un pagamento in euro. */
export const TOTALE_MINIMO_CENT = 50;
/** Il massimo di Stripe per un pagamento in euro (999.999,99 €). */
export const TOTALE_MASSIMO_CENT = 99_999_999;

/** Una riga di `shop_cassa_righe` (snake_case, come la restituisce il database). Si legge con prudenza: qualunque campo può mancare. */
export type RigaServer = {
  sku?: unknown;
  slug?: unknown;
  nome?: unknown;
  nome_variante?: unknown;
  prezzo_cent?: unknown;
  attiva?: unknown;
  pubblicato?: unknown;
  giacenza?: unknown;
};
export type RigaRichiesta = { sku?: unknown; qty?: unknown };

/** Come `RigaOrdineCms` del carrello: stesse chiavi dell'ordine di oggi (`items` di `shop_orders`), prezzo in euro dai centesimi. */
export type RigaOrdine = {
  product_id: string;
  name: string;
  slug: string;
  qty: number;
  unit_price: number;
  variant: string | null;
};
/** La riga come serve alla sessione di Stripe (`RigaSessione` di stripe/sessione.ts): prezzo in centesimi. */
export type RigaPerStripe = {
  nome: string;
  variante: string | null;
  qty: number;
  prezzoCent: number;
};

export type Rifiuto = { sku: string; frase: string };
export type EsitoCalcolo =
  | {
      ok: true;
      items: RigaOrdine[];
      righe: RigaPerStripe[];
      subtotaleCent: number;
      spedizioneCent: number;
      totaleCent: number;
    }
  | { ok: false; motivo: "non_disponibile"; frase: string; righe: Rifiuto[] }
  | { ok: false; motivo: "valore"; frase: string; righe: Rifiuto[] }
  | { ok: false; motivo: "cassa_chiusa"; frase: string; righe: Rifiuto[] };

/** Una frase sola per ogni riga che non si può vendere: non dice perché (bozza, prezzo, Invisible Derm) e non ha cifre. */
const FRASE_NON_DISPONIBILE =
  "Questo prodotto non è disponibile: toglilo dal carrello per continuare.";
const FRASE_QUANTITA = "Per ogni prodotto puoi ordinare da 1 a 20 pezzi.";
const FRASE_OLTRE_GIACENZA = "Non ne abbiamo abbastanza: prova con meno pezzi.";

const intero = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
const testo = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
const oggetto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const errore = (motivo: "valore" | "cassa_chiusa", frase: string): EsitoCalcolo => ({
  ok: false,
  motivo,
  frase,
  righe: [],
});

export function calcolaOrdine(
  righeServer: unknown,
  righeRichieste: unknown,
  tariffa: unknown,
): EsitoCalcolo {
  if (
    !Array.isArray(righeRichieste) ||
    righeRichieste.length < 1 ||
    righeRichieste.length > MAX_RIGHE
  )
    return errore("valore", `Il carrello deve avere da 1 a ${MAX_RIGHE} prodotti.`);

  // Si somma lo stesso SKU scritto due volte, nell'ordine della prima comparsa. Del cliente si tengono `sku` e `qty`, nient'altro.
  const richieste = new Map<string, number>();
  for (const r of righeRichieste) {
    if (!oggetto(r) || typeof r.sku !== "string" || r.sku === "" || !intero(r.qty))
      return errore("valore", "Il carrello non è valido: controlla i prodotti e le quantità.");
    richieste.set(r.sku, (richieste.get(r.sku) ?? 0) + r.qty); // somma di interi sicuri: oltre il limite si rifiuta sotto
  }

  const dalServer = new Map<string, RigaServer>();
  for (const s of Array.isArray(righeServer) ? righeServer : [])
    if (oggetto(s) && typeof s.sku === "string" && !dalServer.has(s.sku)) dalServer.set(s.sku, s);

  const rifiuti: Rifiuto[] = [];
  const items: RigaOrdine[] = [];
  const righe: RigaPerStripe[] = [];
  let subtotaleCent = 0;
  for (const [sku, qty] of richieste) {
    const s = dalServer.get(sku);
    const nome = testo(s?.nome);
    const slug = testo(s?.slug);
    const prezzo = s?.prezzo_cent;
    const vendibile =
      !!s &&
      s.pubblicato === true &&
      s.attiva === true &&
      nome !== "" &&
      slug !== "" &&
      !eInvisibleDerm(nome, slug) &&
      intero(prezzo) &&
      prezzo > 0;
    if (!vendibile) {
      rifiuti.push({ sku, frase: FRASE_NON_DISPONIBILE });
      continue;
    }
    const giacenza = s.giacenza;
    if (!intero(giacenza) || giacenza < 1) {
      rifiuti.push({ sku, frase: FRASE_NON_DISPONIBILE });
      continue;
    }
    if (qty < QTY_MIN || qty > QTY_MAX) {
      rifiuti.push({ sku, frase: FRASE_QUANTITA });
      continue;
    }
    if (qty > giacenza) {
      rifiuti.push({ sku, frase: FRASE_OLTRE_GIACENZA });
      continue;
    }
    const variante = testo(s.nome_variante) || null;
    subtotaleCent += prezzo * qty;
    items.push({
      product_id: sku,
      name: nome,
      slug,
      qty,
      unit_price: prezzo / 100,
      variant: variante,
    });
    righe.push({ nome, variante, qty, prezzoCent: prezzo });
  }
  if (rifiuti.length > 0)
    return { ok: false, motivo: "non_disponibile", frase: FRASE_NON_DISPONIBILE, righe: rifiuti };

  const spedizioneCent = costoSpedizione(
    oggetto(tariffa) ? (tariffa as TariffaRiga) : null,
    subtotaleCent,
  );
  if (spedizioneCent === null)
    return errore("cassa_chiusa", "Il negozio sta per aprire: riprova tra poco.");

  const totaleCent = subtotaleCent + spedizioneCent;
  if (!Number.isSafeInteger(totaleCent) || totaleCent > TOTALE_MASSIMO_CENT)
    return errore("valore", "L'importo dell'ordine è troppo alto: dividilo in più ordini.");
  if (totaleCent < TOTALE_MINIMO_CENT)
    return errore("valore", "L'importo dell'ordine è troppo basso per essere pagato online.");
  return { ok: true, items, righe, subtotaleCent, spedizioneCent, totaleCent };
}

/** Il cliente ha visto `attesoCent`: se il server ha ricalcolato un'altra cifra non si paga, e gli si restituisce quella nuova (D50). */
export function confrontaTotale(
  attesoCent: unknown,
  totaleCent: number,
): { ok: true } | { ok: false; motivo: "prezzi_cambiati"; totaleCent: number } {
  return intero(attesoCent) && attesoCent === totaleCent
    ? { ok: true }
    : { ok: false, motivo: "prezzi_cambiati", totaleCent };
}
