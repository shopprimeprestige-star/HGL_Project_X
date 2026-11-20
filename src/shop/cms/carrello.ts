/** ── IL CARRELLO CON IL CATALOGO CMS ────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T12, PIANO §3.2). Modulo PURO: niente React, niente rete.
 *
 *  Con il catalogo `codice` il carrello è quello di sempre (righe senza `sku`). Con il catalogo `cms` una riga ha
 *  `productId = SKU della variante`, `sku` e `snap` (nome, indirizzo, prezzo in centesimi, foto: ciò che serve a
 *  disegnarla senza chiedere niente). Il prezzo vero lo ridà il server a ogni caricamento (`righeCarrello`):
 *  `ripulisciRighe` aggiorna le righe buone e toglie le altre, con garbo (la pagina dice «alcuni prodotti non sono
 *  più disponibili», mai un errore).
 *  ⚠️ I soldi si sommano in CENTESIMI e si dividono per cento una volta sola. */
import type { RigaCarrelloServer } from "./catalogo.server";
import type { SrcFoto } from "./modello";

export interface SnapRiga {
  nome: string;
  slug: string;
  prezzoCent: number;
  foto: SrcFoto | null;
  varianteNome: string | null;
}
export interface RigaCarrello {
  productId: string;
  qty: number;
  variant?: Record<string, string>;
  key: string;
  /** Solo con il catalogo CMS. Le righe vecchie non l'hanno. */
  sku?: string;
  snap?: SnapRiga;
}

const conSku = (l: RigaCarrello): l is RigaCarrello & { sku: string } => typeof l?.sku === "string" && l.sku.length > 0;
const qtaValida = (q: unknown): q is number => typeof q === "number" && Number.isInteger(q) && q > 0;

/**
 * Le righe del carrello, dopo aver chiesto al server come stanno adesso i loro SKU.
 * Si TOLGONO (e si contano in `rimosse`): le righe vecchie senza `sku` (il catalogo di prima non c'è più), quelle il cui SKU
 * il server non conosce più («non più disponibile»: bozza, archiviato, variante spenta) e quelle esaurite. Le altre restano
 * nello stesso ordine e con la stessa quantità, con nome, prezzo e foto di adesso. Non cambia l'elenco ricevuto.
 */
export function ripulisciRighe<T extends RigaCarrello>(righe: readonly T[], righeServer: readonly RigaCarrelloServer[]): { righe: T[]; rimosse: number } {
  const server = new Map((Array.isArray(righeServer) ? righeServer : []).flatMap((r) => (r && typeof r.sku === "string" ? [[r.sku, r] as const] : [])));
  const buone: T[] = [];
  let rimosse = 0;
  for (const l of Array.isArray(righe) ? righe : []) {
    const s = conSku(l) && qtaValida(l.qty) ? server.get(l.sku) : undefined;
    if (!s || "nonPiuDisponibile" in s || !s.disponibile) {
      rimosse++;
      continue;
    }
    buone.push({ ...l, snap: { nome: s.nome, slug: s.slug, prezzoCent: s.prezzoCent, foto: s.foto, varianteNome: s.varianteNome } });
  }
  return { righe: buone, rimosse };
}

/** Il totale in euro delle sole righe CMS, dai centesimi dello `snap`. Una riga senza `snap` non vale niente (mai un prezzo inventato). */
export function totaleDaRighe(righe: readonly RigaCarrello[]): number {
  const cent = (Array.isArray(righe) ? righe : []).reduce((s, l) => {
    const p = conSku(l) && qtaValida(l.qty) ? l.snap?.prezzoCent : undefined;
    return s + (typeof p === "number" && Number.isSafeInteger(p) && p >= 0 ? p * l.qty : 0);
  }, 0);
  return cent / 100;
}

/**
 * Il subtotale del carrello: le righe vecchie si sommano come sempre (`prezzoCodice(productId)` in euro × quantità, una
 * riga che il catalogo del codice non conosce vale 0), quelle CMS dai centesimi. Con sole righe vecchie il risultato è
 * IDENTICO a quello di prima (si aggiunge uno zero).
 */
export function subtotaleRighe(righe: readonly RigaCarrello[], prezzoCodice: (productId: string) => number | undefined): number {
  const vecchie = righe.reduce((s, l) => {
    if (conSku(l)) return s;
    const prezzo = prezzoCodice(l.productId);
    return s + (prezzo !== undefined ? prezzo * l.qty : 0);
  }, 0);
  return vecchie + totaleDaRighe(righe);
}
