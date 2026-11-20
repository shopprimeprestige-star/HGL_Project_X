/** ── IL NEGOZIO NELLA PAGINA (useNegozio.ts) ──────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T13). Colla sottile: lo stato dell'elenco, la rilettura ogni 30 s a scheda
 *  visibile e le azioni stanno in `client.ts` (provato in prove/negozio/client.mjs).
 *
 *  Uso (T14-T17):
 *    const { prodotti, inCaricamento, errore, ultimoAggiornamento, aggiorna, impostaFiltri, esegui, scheda } = useNegozio();
 *  Si chiama UNA volta, nel guscio della pagina, e si passano i risultati alle schede. ⚠️ `esegui` restituisce l'esito:
 *  `conflitto`, `non_pubblicabile` (con i bloccanti), `migrazione`, l'`avviso` di un ritiro li legge la pagina. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { fetchCRM } from "@/crm/AuthContext";
import { porteBrowser } from "../ecommerce/client";
import { creaArchivioNegozio, type FiltriElenco } from "./client";

export function useNegozio(filtri?: FiltriElenco) {
  const [archivio] = useState(() => creaArchivioNegozio({ fetch: fetchCRM, porte: porteBrowser(), filtri }));
  useEffect(() => archivio.avvia(), [archivio]);
  //  Sul server la pagina si disegna con lo stato iniziale («in caricamento»).
  const stato = useSyncExternalStore(archivio.iscrivi, archivio.stato, archivio.stato);
  return {
    ...stato,
    aggiorna: archivio.aggiorna,
    impostaFiltri: archivio.impostaFiltri,
    esegui: archivio.esegui,
    scheda: archivio.scheda,
    categorie: archivio.categorie,
    interruttori: archivio.interruttori,
  };
}
