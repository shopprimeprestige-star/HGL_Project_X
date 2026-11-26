/** ── LE PORTE VERE DELLE FOTO DELL'IMPORT (foto-browser.ts) ──────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E13. Collega `importa-foto.ts` al browser riusando ESATTAMENTE la pipeline della scheda:
 *  `fotoDaCaricare` (leggiImmagine → pianoFoto → disegnaMisure, ritaglio al centro) e `porte(esegui)` di EditorMedia. Lo scaricamento è
 *  `scaricaFoto` (solo cdn.shopify.com). La scheda di un già presente si legge con `negozio.scheda` (sola lettura). Nessun log, mai. */
import { fotoDaCaricare, porte } from "../EditorMedia";
import type { Media } from "@/shop/cms/modello";
import type { Negozio } from "../tipi";
import { scaricaFoto, type PorteFoto } from "./importa-foto";

export const porteFotoBrowser = (negozio: Pick<Negozio, "esegui" | "scheda">): PorteFoto => ({
  scarica: scaricaFoto,
  prepara: (blob) => fotoDaCaricare(blob, { x: 0.5, y: 0.5 }),
  carico: porte(negozio.esegui),
  media: async (id) => {
    const r = await negozio.scheda(id);
    // la stessa lettura della scheda (`SchedaProdotto`); una risposta senza elenco vale «non so»: non si carica niente
    return r.ok && Array.isArray(r.scheda.media) ? (r.scheda.media as Media[]) : null;
  },
});
