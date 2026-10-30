/** ── L'ELENCO NON SI RIDISEGNA A OGNI TASTO DELLA CASELLA (p1-chat-veloce, 30/10/2026) ──
 *  La bozza vive in `useChatWa`: a ogni lettera la pagina si ridisegna e l'`api` è un oggetto nuovo.
 *  `useApiElenco` dà all'elenco un `api` con identità fissa finché non cambia qualcosa che l'elenco
 *  mostra (chat, filtri, ricerca, caricamento, chat aperta). Le funzioni hanno identità fissa e
 *  chiamano sempre la versione di ADESSO (`ultima`): un elenco in memoria non resta con una copia vecchia.
 *  ⚠️ L'elenco legge SOLO questi campi: gli altri di `api` (bozza, invio…) nel suo `api` possono essere vecchi. */
import { useCallback, useMemo, useRef } from "react";
import type { ChatWaApi } from "./tipi";

/** Una funzione con identità fissa che chiama sempre la versione di adesso. */
export function useStabile<A extends unknown[], R>(f: (...a: A) => R): (...a: A) => R {
  const ref = useRef(f);
  ref.current = f;
  return useCallback((...a: A) => ref.current(...a), []);
}

export function useApiElenco(api: ChatWaApi): ChatWaApi {
  const ultima = useRef(api);
  ultima.current = api;
  const conBlocco = Boolean(api.inBlocco);
  return useMemo<ChatWaApi>(
    () => ({
      ...api,
      apri: (k) => ultima.current.apri(k),
      setFiltri: (f) => ultima.current.setFiltri(f),
      setRicerca: (q) => ultima.current.setRicerca(q),
      cambiaStatoLead: (l, s) => ultima.current.cambiaStatoLead(l, s),
      creaSchedaConStato: (c, s) => ultima.current.creaSchedaConStato(c, s),
      inBlocco: conBlocco
        ? {
            segnaLetto: (t) => ultima.current.inBlocco!.segnaLetto(t),
            segnaDaLeggere: (t) => ultima.current.inBlocco!.segnaDaLeggere(t),
            segnaFatto: (t) => ultima.current.inBlocco!.segnaFatto(t),
          }
        : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo quello che l'elenco mostra (vedi sopra)
    [api.chats, api.filtri, api.ricerca, api.caricamento, api.attiva, conBlocco],
  );
}
