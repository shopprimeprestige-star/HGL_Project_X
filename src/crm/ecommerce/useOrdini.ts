/** ── GLI ORDINI NELLA PAGINA (useOrdini.ts) ────────────────────────────────────
 *  Commessa 2026-11-17-crm-ecommerce, T10. Colla sottile: lo stato, la rilettura ogni 30 s a scheda visibile
 *  e le azioni stanno in `client.ts` (provato in prove/ecommerce/client.mjs).
 *
 *  Uso (T11, T12):
 *    const { ordini, inCaricamento, errore, ultimoAggiornamento, aggiorna, esegui, storico } = useOrdini();
 *  Ogni pagina che lo chiama ha il suo archivio e la sua rilettura: lo si chiama UNA volta, nel guscio della
 *  pagina, e si passano i risultati alle schede. ⚠️ `esegui` restituisce l'esito: `storico:false`, `conflitto`,
 *  `migrazione`, `nessunCambio` li legge la pagina. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { fetchCRM } from "@/crm/AuthContext";
import { creaArchivioOrdini, porteBrowser } from "./client";

export function useOrdini() {
  const [archivio] = useState(() => creaArchivioOrdini({ fetch: fetchCRM, porte: porteBrowser() }));
  useEffect(() => archivio.avvia(), [archivio]);
  //  Sul server la pagina si disegna con lo stato iniziale («in caricamento»).
  const stato = useSyncExternalStore(archivio.iscrivi, archivio.stato, archivio.stato);
  return {
    ...stato,
    aggiorna: archivio.aggiorna,
    esegui: archivio.esegui,
    storico: archivio.storico,
  };
}
