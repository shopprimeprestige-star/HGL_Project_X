/** ── VETRINA V1 · T79 · GLI EVENTI DELLE PAGINE NUOVE: QUALE EVENTO E CON QUALI DATI ──────────────────────
 *  Funzioni pure: dicono COSA emettere, non lo emettono. La pagina fa `if (e) emettiEvento(e.nome, e.dati)`: il consenso, il
 *  banner e l'invio restano di `emettiEvento` (V1-T10: prima della scelta nessuna richiesta; con «Rifiuta» solo conteggi interni).
 *  Su `elenco.ts`, `scheda.ts` e `cassa.ts` esistenti: LI RIUSA, non li duplica (stessi SKU, stessi centesimi di oggi).
 *  ⚠️ `content_ids` = SKU della VARIANTE (scheda, carrello) o del prodotto (liste `product_group`); il valore è in CENTESIMI interi
 *   (`costruisciEvento` lo porta in euro).
 *  ⚠️ NESSUN DATO PERSONALE: solo SKU, nome del prodotto (dal catalogo), categoria, numeri e il testo cercato SE non somiglia a
 *   un'email o a un telefono (`testoDaCercare`). Le righe del carrello non portano nomi né altri campi: solo SKU, quantità e valore.
 *  ⚠️ Il valore di una riga del carrello esce SOLO se il server l'ha controllato (`stato === "ok"`): la memoria del browser può
 *   essere stata alterata. Altrimenti l'evento parte senza cifra (meglio nessuna cifra che una sbagliata).
 *  ⚠️ Invisible Derm non ha prezzo né vendita: nessun evento di scheda, di aggiunta o di carrello. */
import type { DatiEvento } from "../../lib/tracciamento/eventi";
import type { NomeEvento } from "../../lib/tracciamento/nomi";
import type { StatoCarrello } from "../useRivalidaCarrello";
import { datiListaVisualizzata, testoDaCercare, type VoceElenco } from "./elenco";
import { datiEventoRighe } from "./cassa";
import type { ProdottoPubblico } from "./modello";
import { skuValido } from "./modello";
import { datiEventoScheda } from "./scheda";
import { righeMostrabili } from "./vetrina-carrello";

/** Un evento da emettere: il nome e i dati. */
export interface EventoDaEmettere {
  nome: NomeEvento;
  dati: DatiEvento;
}

/** Il nome del conteggio interno della scelta di una variante (resta anche con «Rifiuta»: non va a nessuna piattaforma). */
export const CONTATORE_VARIANTE = "shop_variante_scelta";

/* ── scheda ─────────────────────────────────────────────────────────────── */

/** ViewContent della scheda: lo SKU della variante e il suo prezzo. `null` senza variante valida o senza prezzo (Invisible Derm). */
export function eventoVista(p: ProdottoPubblico, skuVariante: string | null | undefined): EventoDaEmettere | null {
  const dati = datiEventoScheda(p, skuVariante ?? null);
  return dati ? { nome: "ViewContent", dati } : null;
}

/** AddToCart: stessa variante, per `quantita` pezzi (valore e pezzi per quanti). `null` se la variante non c'è, non si compra o la quantità non è un intero ≥ 1. */
export function eventoAggiungi(p: ProdottoPubblico, skuVariante: string | null | undefined, quantita = 1): EventoDaEmettere | null {
  if (!p.varianti.find((x) => x.sku === skuVariante)?.disponibile) return null;
  const dati = datiEventoScheda(p, skuVariante ?? null, quantita);
  return dati ? { nome: "AddToCart", dati } : null;
}

/* ── liste e ricerca ────────────────────────────────────────────────────── */

/** ViewContent di una lista (home, categoria): gli SKU dei prodotti mostrati e la categoria. `null` se la lista è vuota. */
export function eventoListaCategoria(voci: readonly VoceElenco[] | null | undefined, categoria?: string): EventoDaEmettere | null {
  const dati = datiListaVisualizzata(Array.isArray(voci) ? voci : [], categoria);
  return dati ? { nome: "ViewContent", dati } : null;
}

/** Search: il testo ripulito. `null` se è vuoto, di una lettera, o se somiglia a un'email o a un telefono (chiocciola, sei cifre o più). */
export function eventoCerca(testo: unknown): EventoDaEmettere | null {
  const t = testoDaCercare(testo);
  return t ? { nome: "Search", dati: { searchString: t } } : null;
}

/* ── carrello ───────────────────────────────────────────────────────────── */

/** Il valore resta solo se il server ha controllato le righe e ogni prezzo è un intero valido e la somma è sicura. */
function conValoreDelServer(dati: DatiEvento, righe: readonly { snap?: { prezzoCent?: unknown } }[], stato: StatoCarrello | undefined): DatiEvento {
  const sicuro = stato === "ok" && righe.every((l) => Number.isSafeInteger(l.snap?.prezzoCent) && (l.snap?.prezzoCent as number) >= 0) && Number.isSafeInteger(dati.valueCent);
  if (sicuro) return dati;
  const senza = { ...dati };
  delete senza.valueCent;
  return senza;
}

/** RemoveFromCart («Togli»): lo SKU della riga, i pezzi e (solo con `ok`) il valore. `null` per una riga che non si mostra (catalogo vecchio, Invisible Derm, rovinata). */
export function eventoRimuovi(riga: unknown, stato?: StatoCarrello): EventoDaEmettere | null {
  const righe = righeMostrabili([riga]);
  const dati = righe.length ? datiEventoRighe(righe, () => undefined) : null;
  return dati ? { nome: "RemoveFromCart", dati: conValoreDelServer(dati, righe, stato) } : null;
}

/** ViewCart: le righe che si vedono, a controllo finito. Con `controllo` o `non_verificabile` niente: il valore non è ancora quello del server. */
export function eventoCarrello(lines: readonly unknown[] | null | undefined, stato: StatoCarrello): EventoDaEmettere | null {
  if (stato !== "ok") return null;
  const righe = righeMostrabili(lines ?? []);
  const dati = righe.length ? datiEventoRighe(righe, () => undefined) : null;
  return dati ? { nome: "ViewCart", dati: conValoreDelServer(dati, righe, stato) } : null;
}

/* ── conteggio interno ──────────────────────────────────────────────────── */

/** Il conteggio interno «variante scelta»: il solo SKU (maiuscolo, senza spazi: mai un testo libero). `null` se non è uno SKU. Va a `emettiSoloContatore`, mai alle piattaforme. */
export function contaVariante(sku: unknown): { contatore: typeof CONTATORE_VARIANTE; payload: { sku: string } } | null {
  return typeof sku === "string" && skuValido(sku) ? { contatore: CONTATORE_VARIANTE, payload: { sku } } : null;
}
