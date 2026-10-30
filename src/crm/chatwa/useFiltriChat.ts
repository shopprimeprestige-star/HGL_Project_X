/** ── I FILTRI DELLA CHAT E COSA SI RICORDA (30/10/2026) ─────────────────────
 *  Il consulente si ricorda sul dispositivo (`localStorage`, una chiave per utente, anche dopo
 *  aver chiuso l'app). Gli altri filtri finché la scheda del browser resta aperta
 *  (`sessionStorage`: passando fra elenco e conversazione e ricaricando; alla riapertura si
 *  riparte da zero, perché una coda di ieri non deve sembrare l'elenco di oggi). La ricerca mai.
 *  Cosa si legge e non si riconosce si ignora: vedi `leggiFiltri` (filtri.ts).
 *  Solo comodità: se lo spazio del browser non è disponibile (navigazione privata), i filtri
 *  funzionano lo stesso e si perdono alla chiusura. */
import { useCallback, useEffect, useState } from "react";
import { FILTRI_VUOTI, leggiFiltri, scriviFiltriSessione, type FiltriChat } from "./filtri";

const chiaveSessione = (utente: string) => `hgl_chat_filtri_v1:${utente}`;
const chiaveConsulente = (utente: string) => `hgl_chat_consulente_v1:${utente}`;

function leggi(store: () => Storage, chiave: string): string | null {
  try {
    return store().getItem(chiave);
  } catch {
    return null;
  }
}
function scrivi(store: () => Storage, chiave: string, valore: string | null) {
  try {
    if (valore === null) store().removeItem(chiave);
    else store().setItem(chiave, valore);
  } catch {
    /* niente: resta valido finché la pagina è aperta */
  }
}

export function useFiltriChat(utente: string | null | undefined): {
  filtri: FiltriChat;
  setFiltri: (f: FiltriChat) => void;
} {
  const [filtri, setFiltriLocale] = useState<FiltriChat>(FILTRI_VUOTI);

  //  Appena si sa chi è l'utente si rileggono i suoi filtri (prima: tutto spento).
  useEffect(() => {
    if (!utente) return;
    setFiltriLocale(
      leggiFiltri(
        leggi(() => window.sessionStorage, chiaveSessione(utente)),
        leggi(() => window.localStorage, chiaveConsulente(utente)),
      ),
    );
  }, [utente]);

  const setFiltri = useCallback(
    (f: FiltriChat) => {
      setFiltriLocale(f);
      if (!utente) return;
      scrivi(() => window.sessionStorage, chiaveSessione(utente), scriviFiltriSessione(f));
      scrivi(() => window.localStorage, chiaveConsulente(utente), f.consulente || null);
    },
    [utente],
  );

  return { filtri, setFiltri };
}
