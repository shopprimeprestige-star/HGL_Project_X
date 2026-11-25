/** ── IL PRODOTTO SEMPLICE: LE REGOLE SENZA SCHERMO (semplice-puro.ts) ─────────
 *  Commessa 2026-11-25-editor-prodotti, E5 (PIANO §1.2). Niente React e niente rete: il margine e l'utile mentre si scrive il prezzo e
 *  il costo, quando la scheda è «semplice» o «con opzioni», qual è la variante «Unica» (quella senza opzioni: SKU, giacenza e costo di
 *  un prodotto senza opzioni stanno su di lei), quanto cambia la quantità e con quale motivo.
 *  Si prova in `prove/negozio/semplice-puro.mjs`.
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · I soldi sono SEMPRE centesimi interi: i testi si leggono con `centDaEuro` (mai `parseFloat`), margine e utile si calcolano
 *    sugli interi e si scrivono con `euroInTesto`.
 *  · Una scheda è «con opzioni» appena una variante ha un'opzione (colore, misura…). L'Unica non si cancella (il progetto non cancella):
 *    passando alle opzioni la scheda la disattiva. */
import { centDaEuro, type Variante } from "@/shop/cms/modello";
import { quantitaDaTesto } from "./scheda-pura";

/** Per le percentuali: la sola costante, scritta una volta (la scheda non moltiplica mai a mano). */
const CENTO = 100;

/* ══ MARGINE E UTILE ════════════════════════════════════════════════════════ */

/** Centesimi → «9,60» (virgola, due cifre). Negativo: «-2,50». Senza separatore delle migliaia, come il campo prezzo («1234,50»). */
export function euroInTesto(cent: number): string {
  const segno = cent < 0 ? "-" : "";
  const n = Math.abs(Math.round(cent));
  return `${segno}${Math.floor(n / CENTO)},${String(n % CENTO).padStart(2, "0")}`;
}

export interface Margine {
  utileCent: number;
  /** Intero: 48 = 48 %. Negativo se il costo supera il prezzo. */
  percento: number;
}

/** Utile (prezzo − costo) e margine (utile sul prezzo). Senza prezzo (zero) o senza costo non c'è niente da dire. */
export function margine(prezzoCent: number, costoCent: number | null): Margine | null {
  if (!Number.isSafeInteger(prezzoCent) || prezzoCent <= 0) return null;
  if (costoCent === null || !Number.isSafeInteger(costoCent) || costoCent < 0) return null;
  const utileCent = prezzoCent - costoCent;
  return { utileCent, percento: Math.round((utileCent * CENTO) / prezzoCent) };
}

/** La frase sotto il campo costo: «Margine 48 %, utile 9,60 €». `null` se manca il prezzo o il costo o non sono cifre (l'errore lo dice il campo). */
export function fraseMargine(
  prezzo: string,
  costo: string,
): { testo: string; tono: "ok" | "perdita" } | null {
  if (!prezzo.trim() || !costo.trim()) return null;
  const p = centDaEuro(prezzo);
  const k = centDaEuro(costo);
  if (p === null || k === null) return null;
  const m = margine(p, k);
  if (!m) return null;
  const base = `Margine ${m.percento} %, utile ${euroInTesto(m.utileCent)} €`;
  return m.utileCent < 0
    ? { testo: `${base} (il costo è più alto del prezzo)`, tono: "perdita" }
    : { testo: base, tono: "ok" };
}

/* ══ SEMPLICE O CON OPZIONI, E LA VARIANTE «UNICA» ══════════════════════════ */

export type Modalita = "semplice" | "opzioni";
type VarianteBreve = Pick<Variante, "sku" | "opzioni" | "attiva" | "giacenza">;

const senzaOpzioni = (v: Pick<Variante, "opzioni">) => Object.keys(v.opzioni ?? {}).length === 0;

/** «Con opzioni» se almeno una variante (anche spenta) ha un'opzione; altrimenti «semplice» (nessuna variante, o la sola Unica). */
export const modalitaDi = (varianti: readonly Pick<Variante, "opzioni">[]): Modalita =>
  varianti.some((v) => !senzaOpzioni(v)) ? "opzioni" : "semplice";

/** L'Unica: la variante senza opzioni; tra più d'una, quella con lo SKU del prodotto. */
export function trovaUnica<V extends Pick<Variante, "sku" | "opzioni">>(
  varianti: readonly V[],
  skuProdotto: string,
): V | null {
  const senza = varianti.filter(senzaOpzioni);
  return senza.find((v) => v.sku === skuProdotto) ?? senza[0] ?? null;
}

/** Cosa fa la scheda con l'Unica: `assente` = la crea al primo salvataggio, `disattivata` = la riaccende, `non_serve` = ci sono le opzioni. */
export function statoUnica(
  varianti: readonly VarianteBreve[],
  skuProdotto: string,
): "assente" | "attiva" | "disattivata" | "non_serve" {
  if (modalitaDi(varianti) === "opzioni") return "non_serve";
  const u = trovaUnica(varianti, skuProdotto);
  return !u ? "assente" : u.attiva ? "attiva" : "disattivata";
}

/** La frase prima di passare alle opzioni: l'Unica si spegne e i suoi pezzi non si spostano da soli. `null` se non c'è niente da dire. */
export function avvisoPassaggioAOpzioni(unica: Pick<Variante, "giacenza"> | null): string | null {
  if (!unica || !(unica.giacenza > 0)) return null;
  const pezzi = unica.giacenza === 1 ? "1 pezzo" : `${unica.giacenza} pezzi`;
  return `Il prodotto senza opzioni ha ${pezzi} in magazzino: passando alle opzioni quella voce si spegne. Scrivi la quantità su ogni nuova riga.`;
}

/* ══ LA QUANTITÀ ════════════════════════════════════════════════════════════ */

/** I tre motivi del server (`giacenza.server.ts`): «ordine» e «annullo ordine» sono dell'ordine vero e qui non ci sono. */
export const MOTIVI_GIACENZA = [
  { valore: "carico", etichetta: "Carico" },
  { valore: "rettifica", etichetta: "Rettifica" },
  { valore: "reso", etichetta: "Reso" },
] as const;
export type MotivoGiacenza = (typeof MOTIVI_GIACENZA)[number]["valore"];

/**
 * Quanto cambia la giacenza scrivendo una nuova quantità: la differenza e il motivo da proporre (più pezzi = carico, meno = rettifica;
 * il titolare lo può cambiare in «Reso»). Un testo che non è un intero da 0 a un milione è un errore a parole.
 */
export function cambioQuantita(
  attuale: number,
  testo: string,
): { ok: true; differenza: number; motivo: MotivoGiacenza | null } | { ok: false; frase: string } {
  const q = quantitaDaTesto(testo);
  if (!q.ok)
    return {
      ok: false,
      frase: "La quantità è un numero intero da 0 a 1.000.000 (per esempio 12).",
    };
  const differenza = q.n - attuale;
  return {
    ok: true,
    differenza,
    motivo: differenza === 0 ? null : differenza > 0 ? "carico" : "rettifica",
  };
}
