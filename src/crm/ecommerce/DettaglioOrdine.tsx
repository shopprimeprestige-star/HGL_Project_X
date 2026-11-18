/** ── IL DETTAGLIO DELL'ORDINE (DettaglioOrdine.tsx) · SEGNAPOSTO DI T11 ─────────
 *  Commessa 2026-11-17-crm-ecommerce. Il pannello laterale (`Sheet`) con dati del cliente, righe, stato, pagamento, tracking,
 *  note e storico è T12 (SPEC §3.3): sostituisce questo file. Qui c'è solo il nome e la forma, perché `ElencoOrdini` sappia
 *  da subito come chiamarlo. Non cancella niente e non ha nessun «Elimina»: un ordine sbagliato si segna «Annullato». */
import type { Ordine } from "./ordine";

export interface PropsDettaglioOrdine {
  /** `null` = pannello chiuso. */
  ordine: Ordine | null;
  onChiudi: () => void;
}

export function DettaglioOrdine(_props: PropsDettaglioOrdine): null {
  return null;
}
