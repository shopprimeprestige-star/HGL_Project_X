/** ── STATO DI ERRORE (V1 · T83, documento §4.7) ───────────────────────────────
 *  La stessa forma dello stato vuoto, con l'icona di avviso e, se c'è modo di riprovare, il bottone «Riprova» che RIPETE la richiesta
 *  senza ricaricare la pagina (lo fa chi lo usa, con `riprova`). Niente rosso: il tono è calmo, l'icona sta su un tondo notte. */
import { TriangleAlert } from "lucide-react";
import { TESTI_PROVVISORI } from "@/landing/testi-shop";
import { StatoVuoto, type AzioneStato, type StatoVuotoProps } from "./StatoVuoto";

export interface StatoErroreProps extends Omit<StatoVuotoProps, "icona"> {
  /** Ripete la richiesta. Senza, il bottone «Riprova» non c'è. È l'unico pieno: gli altri ingressi diventano contorno o link se lo dicono. */
  riprova?: () => void;
}

export function StatoErrore({ riprova, azioni = [], ...resto }: StatoErroreProps) {
  const tutte: AzioneStato[] = riprova ? [{ testo: TESTI_PROVVISORI.errore.riprova, onClick: riprova, aspetto: "pieno" }, ...azioni] : [...azioni];
  return <StatoVuoto {...resto} icona={TriangleAlert} azioni={tutte} />;
}
