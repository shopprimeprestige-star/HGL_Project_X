/** ── IL DETTAGLIO DELL'ORDINE NELLA PAGINA (useDettaglioOrdine.ts) ─────────────
 *  Rilascio 2, T61. Colla sottile: lo stato, le letture e le azioni stanno in `client.ts` (`creaArchivioDettaglio`, provato in
 *  prove/negozio/client-r2.mjs).
 *
 *  Uso (T64): `const d = useDettaglioOrdine(ordineAperto?.id ?? null, puoGestireOrdini);`
 *  · Il dettaglio si legge SOLO se c'è un ordine aperto (`ordineId` non nullo) e il permesso (`attivo`): con il pannello chiuso non parte
 *    nessuna richiesta e niente resta in memoria (il dettaglio ha fattura e consensi).
 *  · Al cambio di ordine o alla chiusura l'archivio si richiude: la risposta in ritardo di un ordine precedente non arriva mai a schermo.
 *  · Ogni dialogo (rimborso, annullo) chiama `apriDialogo()` UNA volta, quando si apre, e usa solo quello per inviare: la chiave della
 *    richiesta resta la stessa per tutti gli invii del dialogo. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fetchCRM } from "@/crm/AuthContext";
import { creaArchivioDettaglio } from "./client";

export function useDettaglioOrdine(ordineId: string | null, attivo: boolean) {
  //  Il permesso si legge dal riferimento a ogni chiamata: l'archivio si crea una volta sola.
  const permessoRef = useRef(attivo);
  permessoRef.current = attivo;
  const [archivio] = useState(() =>
    creaArchivioDettaglio({ fetch: fetchCRM, permesso: () => permessoRef.current }),
  );
  useEffect(() => {
    if (ordineId && attivo) void archivio.apri(ordineId);
    else archivio.chiudi();
    return () => archivio.chiudi();
  }, [archivio, ordineId, attivo]);
  //  Sul server il pannello si disegna chiuso (stato iniziale).
  const stato = useSyncExternalStore(archivio.iscrivi, archivio.stato, archivio.stato);
  return {
    ...stato,
    ricarica: archivio.ricarica,
    spedisci: archivio.spedisci,
    riconcilia: archivio.riconcilia,
    fatturaEmessa: archivio.fatturaEmessa,
    emailInvia: archivio.emailInvia,
    giacenzaVerificata: archivio.giacenzaVerificata,
    correggiStato: archivio.correggiStato,
    apriDialogo: archivio.apriDialogo,
  };
}
