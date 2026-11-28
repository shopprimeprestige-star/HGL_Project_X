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
import { leggiOrdine, scriviOrdine, type OrdineFiltri } from "./ordineFiltri";

const chiaveSessione = (utente: string) => `hgl_chat_filtri_v1:${utente}`;
const chiaveConsulente = (utente: string) => `hgl_chat_consulente_v1:${utente}`;
const chiaveOrdine = (utente: string) => `hgl_chat_ordine_v1:${utente}`;

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

/** Il verso di «Ricontatti» e «Attesa acconto» (28/11/2026), uno per filtro. Come il consulente: sul
 *  dispositivo (`localStorage`), perché è una preferenza e non una coda di ieri. Senza spazio nel browser
 *  funziona lo stesso e si perde alla chiusura. Regole e valori: ordineFiltri.ts. */
export function useOrdineFiltri(utente: string | null | undefined): {
  ordine: OrdineFiltri;
  setOrdine: (o: OrdineFiltri) => void;
} {
  const [ordine, setOrdineLocale] = useState<OrdineFiltri>(() => leggiOrdine(null));

  useEffect(() => {
    if (!utente) return;
    setOrdineLocale(leggiOrdine(leggi(() => window.localStorage, chiaveOrdine(utente))));
  }, [utente]);

  const setOrdine = useCallback(
    (o: OrdineFiltri) => {
      setOrdineLocale(o);
      if (utente) scrivi(() => window.localStorage, chiaveOrdine(utente), scriviOrdine(o));
    },
    [utente],
  );

  return { ordine, setOrdine };
}
