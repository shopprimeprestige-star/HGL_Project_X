// ── IL PREVENTIVO CORRENTE DELLA CONSULENZA ─────────────────────────────────
//  Un solo numero, quello del preventivo su cui si sta lavorando adesso. Lo
//  leggono in tre: il link da mandare al cliente, la barra del presentatore e
//  la registrazione della videochiamata.
//
//  PERCHÉ ESISTE QUESTO FILE. Il numero stava in un valore salvato nel browser,
//  letto da ciascuno per conto suo. Ma leggerlo non basta: bisogna anche sapere
//  QUANDO cambia. La barra lo leggeva mentre si disegnava, e dopo quel momento
//  non si ridisegnava più — così, appena creato un preventivo, il link copiato
//  era ancora quello di prima (o senza numero del tutto). Il preventivo era lì,
//  sullo schermo, e il link non lo conteneva.
//
//  Ora il numero si cambia da un posto solo, e chi lo usa viene avvisato:
//   · nella stessa pagina, con un evento;
//   · nell'anteprima dispositivo, che è un documento separato con una copia
//     tutta sua di questo modulo, tramite il valore salvato (l'unica cosa che i
//     due documenti hanno davvero in comune).
import { useEffect, useState } from "react";

export const REF_KEY = "hg_last_quote_ref";
const EVENT = "hg:quote-ref";

export function getQuoteRef(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(REF_KEY) || ""; } catch { return ""; }
}

/** Cambia il preventivo corrente (null = nessuno) e avvisa tutti. */
export function setQuoteRef(ref: string | null) {
  if (typeof window === "undefined") return;
  const v = (ref || "").trim();
  try {
    if (v) localStorage.setItem(REF_KEY, v);
    else localStorage.removeItem(REF_KEY);
    // marcatore per l'anteprima dispositivo: l'evento `storage` arriva solo agli
    // ALTRI documenti, ed è l'unico modo che ha la cornice interna per saperlo.
    localStorage.setItem(`${REF_KEY}_at`, String(Date.now()));
  } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: v })); } catch { /* */ }
}

/** Il preventivo corrente, sempre aggiornato. */
export function useQuoteRef(): string {
  const [ref, setRef] = useState<string>(getQuoteRef);
  useEffect(() => {
    const leggi = () => setRef(getQuoteRef());
    const onEvt = (e: Event) => setRef(((e as CustomEvent<string>).detail ?? "") || "");
    const onStore = (e: StorageEvent) => { if (e.key === REF_KEY || e.key === `${REF_KEY}_at`) leggi(); };
    window.addEventListener(EVENT, onEvt);
    window.addEventListener("storage", onStore);
    // ultima rete di sicurezza: tornando sulla scheda si rilegge comunque.
    window.addEventListener("focus", leggi);
    return () => {
      window.removeEventListener(EVENT, onEvt);
      window.removeEventListener("storage", onStore);
      window.removeEventListener("focus", leggi);
    };
  }, []);
  return ref;
}
