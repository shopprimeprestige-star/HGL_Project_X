/** ── VETRINA V1 · T79 · GLI EVENTI DELLE PAGINE NUOVE: QUALE EVENTO E CON QUALI DATI ──────────────────────
 *  Funzioni pure: dicono COSA emettere, non lo emettono. La pagina fa `if (e) emettiEvento(e.nome, e.dati)`: il consenso, il
 *  banner e l'invio restano di `emettiEvento` (V1-T10: prima della scelta nessuna richiesta; con «Rifiuta» solo conteggi interni).
 *  Su `elenco.ts`, `scheda.ts` e `cassa.ts` esistenti: LI RIUSA, non li duplica (stessi SKU, stessi centesimi di oggi).
 *  ⚠️ `content_ids` = SKU della VARIANTE (scheda, carrello) o del prodotto (liste `product_group`); il valore è in CENTESIMI interi
 *   (`costruisciEvento` lo porta in euro).
 *  ⚠️ NESSUN DATO PERSONALE: solo SKU, nome del prodotto (dal catalogo), categoria, numeri e il testo cercato SOLO se è il nome di un
 *   prodotto o di una categoria del catalogo pubblico (un testo libero può essere un nome, una malattia, un indirizzo: non esce). Le righe del carrello non portano nomi né altri campi: solo SKU, quantità e valore.
 *  ⚠️ Il valore di una riga del carrello esce SOLO se il server l'ha controllato (`stato === "ok"`): la memoria del browser può
 *   essere stata alterata. Altrimenti l'evento parte senza cifra (meglio nessuna cifra che una sbagliata).
 *  ⚠️ Invisible Derm non ha prezzo né vendita: nessun evento di scheda, di aggiunta o di carrello. */
import type { DatiEvento } from "../../lib/tracciamento/eventi";
import type { NomeEvento } from "../../lib/tracciamento/nomi";
import type { StatoCarrello } from "../useRivalidaCarrello";
import { datiListaVisualizzata, eInvisibleDerm, testoDaCercare, type VoceElenco } from "./elenco";
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

/** ViewContent di una lista (home, categoria): gli SKU dei prodotti mostrati e la categoria. Invisible Derm (senza prezzo, non si vende) non c'è
 *  fra gli SKU. `null` se non resta niente da dire. */
export function eventoListaCategoria(voci: readonly VoceElenco[] | null | undefined, categoria?: string): EventoDaEmettere | null {
  const vendibili = (Array.isArray(voci) ? voci : []).filter((v) => !(eInvisibleDerm(v.product?.name, v.product?.slug) || eInvisibleDerm(v.pubblico?.nome, v.pubblico?.slug)));
  const dati = datiListaVisualizzata(vendibili, categoria);
  return dati ? { nome: "ViewContent", dati } : null;
}

/** I nomi che una ricerca può mandare alle piattaforme: quelli dei prodotti e delle categorie del catalogo pubblico già scaricato. */
export function vocabolarioRicerca(prodotti: readonly { nome?: unknown }[] | null | undefined, categorie: readonly { nome?: unknown }[] | null | undefined): string[] {
  const nomi = [...(Array.isArray(prodotti) ? prodotti : []), ...(Array.isArray(categorie) ? categorie : [])].flatMap((x) => (typeof x?.nome === "string" && x.nome.trim() ? x.nome.trim() : []));
  return [...new Set(nomi)];
}

/** Per confrontare: minuscolo, senza accenti, spazi ridotti a uno. */
const normalizza = (t: string): string => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Search. L'evento (la ricerca è avvenuta) parte per ogni testo di almeno due caratteri, ma `searchString` c'è SOLO se il testo, normalizzato,
 *  coincide con il nome di un prodotto o di una categoria del `vocabolario`; esce il nome com'è nel catalogo, mai quello scritto da chi cerca.
 *  Senza vocabolario (non ancora scaricato) l'evento parte senza testo. `null` se non è una ricerca (vuoto, una lettera, non testo). */
export function eventoCerca(testo: unknown, vocabolario?: readonly string[] | null): EventoDaEmettere | null {
  if (typeof testo !== "string" || normalizza(testo).length < 2) return null;
  const chiave = normalizza(testo);
  const nome = (Array.isArray(vocabolario) ? vocabolario : []).find((n) => typeof n === "string" && normalizza(n) === chiave);
  const t = nome === undefined ? null : testoDaCercare(nome);
  return { nome: "Search", dati: t ? { searchString: t } : {} };
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
