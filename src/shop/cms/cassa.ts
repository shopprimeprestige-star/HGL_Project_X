/** ── CARRELLO E CASSA VECCHIA SUI DATI CMS: LE DECISIONI SENZA REACT ────────
 *  Commessa 2026-11-20-shop-completo (T21, PIANO §3.2). Modulo PURO: carrello e cassa lo collegano, così si prova
 *  senza browser. Quattro cose:
 *   · `rivalida`: all'apertura del carrello e prima di ordinare, chiede al SERVER come stanno le righe. Con il catalogo
 *     CMS ripulisce (`ripulisciRighe` di T12); con `codice` toglie con garbo le righe CMS rimaste nella memoria del cliente.
 *   · un guasto del database NON svuota il carrello. Con `cms`: se il server risponde «non più disponibile» a TUTTO, una
 *     sonda dice se è un guasto. Con `codice`: le righe CMS si tolgono solo se il server conferma, sano ed esplicito, che
 *     il catalogo è `codice` (`modalitaCerta`); un solo guasto momentaneo non basta. In dubbio: `non_verificabile`
 *     (le righe restano, l'avviso c'è, la cassa aspetta).
 *   · `SPEDIZIONE_CMS_CENT`: la tariffa fissa del catalogo CMS (D37), una sola.
 *   · `itemsOrdine`: le righe dell'ordine (§3.2) si costruiscono dalle risposte del SERVER. Il prezzo che il browser
 *     ricorda nella riga serve solo a mostrare: qui non entra mai.
 *  ⚠️ I soldi si sommano in CENTESIMI e si dividono per cento una volta sola. */
import { ripulisciRighe, type RigaCarrello } from "./carrello";
import type { ModalitaCerta } from "./modalita-certa";
import type { RigaCarrelloServer } from "./catalogo.server";
import type { DatiEvento } from "../../lib/tracciamento/eventi";
import { skuDaCodice } from "./adattatore";
import { senzaPrezzo } from "./scheda";

export const MSG_RIMOSSE = "Alcuni prodotti non sono più disponibili: li abbiamo tolti dal carrello.";
export const MSG_PREZZI = "Alcuni prezzi sono cambiati: controlla il riepilogo e conferma di nuovo.";
export const MSG_NON_VERIFICABILE = "Non riusciamo a controllare il carrello in questo momento. Il carrello è ancora qui: riprova tra un momento.";

/** Spedizione con il catalogo CMS (D37, 20/11/2026): solo Italia, tariffa fissa, nessuna soglia di gratuità. In centesimi, UNA volta sola:
 *  carrello e cassa la leggono da qui. shortcut: 4,90 € è il valore provvisorio in attesa della cifra del titolare; si cambia qui e basta. */
export const SPEDIZIONE_CMS_CENT = 490;

const MAX_SKU = 50;
const conSku = (l: RigaCarrello): boolean => typeof l?.sku === "string" && l.sku.length > 0;

export interface PorteRivalida {
  /** Il catalogo del sito adesso (`modalitaCatalogo()`). */
  modo: "codice" | "cms";
  /** `righeCarrello(skus)` del server. Può lanciare (rete). */
  chiediRighe: (skus: string[]) => Promise<RigaCarrelloServer[]>;
  /** Il database risponde? (`schedaProdotto` di uno slug: «guasto» → false). Può lanciare. Serve solo con `cms`. */
  sonda: (slug: string) => Promise<boolean>;
  /** La modalità letta dal server con l'esito «incerto» (`modalitaCertaDelServer`). Serve solo con `codice`. Può lanciare. */
  modalitaCerta: () => Promise<ModalitaCerta>;
}
export type EsitoRivalida<T extends RigaCarrello> =
  | { stato: "ok"; righe: T[]; server: RigaCarrelloServer[]; rimosse: number; prezziCambiati: boolean }
  | { stato: "non_verificabile" };

export async function rivalida<T extends RigaCarrello>(porte: PorteRivalida, righe: readonly T[]): Promise<EsitoRivalida<T>> {
  const tutte = Array.isArray(righe) ? righe : [];
  try {
    const cms = tutte.filter(conSku);
    if (porte.modo === "codice") {
      if (!cms.length) return { stato: "ok", righe: [...tutte], server: [], rimosse: 0, prezziCambiati: false };
      // `codice` può essere un guasto che ha nascosto la modalità vera (anche UNO solo, con il catalogo in memoria sano): le righe
      // si tolgono solo se il server conferma, sano ed esplicito, che è `codice`. Nel dubbio restano.
      if ((await porte.modalitaCerta()) !== "codice") return { stato: "non_verificabile" };
      return { stato: "ok", righe: tutte.filter((l) => !conSku(l)), server: [], rimosse: cms.length, prezziCambiati: false };
    }
    const skus = [...new Set(cms.map((l) => l.sku as string))].slice(0, MAX_SKU);
    const letto = skus.length ? await porte.chiediRighe(skus) : [];
    // Invisible Derm non ha un prezzo nello shop: se mai finisse nel carrello, si toglie
    const server = letto.map((r): RigaCarrelloServer => ("nonPiuDisponibile" in r || !(senzaPrezzo(r.nome) || senzaPrezzo(r.slug)) ? r : { sku: r.sku, nonPiuDisponibile: true }));
    // «non più disponibile» per tutti: vero, o è il database che non risponde? (la risposta è la stessa)
    if (skus.length && server.every((r) => "nonPiuDisponibile" in r)) {
      const slug = cms.find((l) => l.snap?.slug)?.snap?.slug;
      if (slug && !(await porte.sonda(slug))) return { stato: "non_verificabile" };
    }
    const { righe: buone, rimosse } = ripulisciRighe(tutte, server);
    const prima = new Map(tutte.map((l) => [l.key, l.snap?.prezzoCent]));
    const prezziCambiati = buone.some((l) => prima.get(l.key) !== l.snap?.prezzoCent);
    return { stato: "ok", righe: buone, server, rimosse, prezziCambiati };
  } catch {
    return { stato: "non_verificabile" };
  }
}

export interface RigaOrdineCms {
  product_id: string;
  name: string;
  slug: string;
  qty: number;
  /** Euro, dai centesimi del server. */
  unit_price: number;
  /** Il nome della variante (§3.2). */
  variant: string | null;
}

/** Le righe dell'ordine e il subtotale (centesimi). Solo dalle risposte del server: una riga che il server non conosce (o non ha in vendita) non si ordina. */
export function itemsOrdine(righe: readonly RigaCarrello[], server: readonly RigaCarrelloServer[]): { items: RigaOrdineCms[]; subtotaleCent: number } {
  const perSku = new Map(server.flatMap((r) => ("nonPiuDisponibile" in r ? [] : ([[r.sku, r]] as const))));
  let subtotaleCent = 0;
  const items = righe.map((l): RigaOrdineCms => {
    const r = typeof l.sku === "string" ? perSku.get(l.sku) : undefined;
    if (!r || !r.disponibile || !Number.isInteger(l.qty) || l.qty < 1 || !Number.isSafeInteger(r.prezzoCent) || r.prezzoCent < 0) throw new Error("riga non ordinabile");
    subtotaleCent += r.prezzoCent * l.qty;
    return { product_id: r.sku, name: r.nome, slug: r.slug, qty: l.qty, unit_price: r.prezzoCent / 100, variant: r.varianteNome };
  });
  return { items, subtotaleCent };
}

/** I dati di `ViewCart`, `InitiateCheckout` e `RemoveFromCart`: gli SKU (quelli del CMS; per le righe vecchie lo SKU che avranno dopo S2), il valore in centesimi, i pezzi.
 *  Solo per le piattaforme: non sono i prezzi dell'ordine. `null` senza righe valide. */
export function datiEventoRighe(righe: readonly RigaCarrello[], prezzoCodice: (productId: string) => number | undefined): DatiEvento | null {
  const buone = (Array.isArray(righe) ? righe : []).filter((l) => Number.isInteger(l?.qty) && l.qty > 0);
  if (!buone.length) return null;
  let valueCent = 0;
  for (const l of buone) {
    const euro = conSku(l) ? (l.snap?.prezzoCent ?? 0) / 100 : (prezzoCodice(l.productId) ?? 0);
    valueCent += Math.round(euro * 100) * l.qty;
  }
  return { contentIds: buone.map((l) => (conSku(l) ? (l.sku as string) : skuDaCodice(l.productId))), contentType: "product", valueCent, numItems: buone.reduce((s, l) => s + l.qty, 0) };
}
