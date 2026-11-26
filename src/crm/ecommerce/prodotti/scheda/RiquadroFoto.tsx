/** ── RIQUADRO «FOTO E VIDEO» (scheda/RiquadroFoto.tsx) ────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.3, riquadro 2). Il contenitore dell'editor foto di oggi: l'editor (`EditorMedia`) lo
 *  costruisce e lo passa il guscio come `children`, così le sue scritture restano là. Un prodotto non ancora salvato non ha dove tenere le
 *  foto (si salvano sotto un prodotto che esiste): al suo posto c'è la frase che dice cosa fare. */
import type { ReactNode } from "react";
import { Banner, RiquadroPolaris } from "./polaris";
import type { SegnoRiquadroProps } from "./RiquadroCampi";

export function RiquadroFoto({
  nuovo,
  segno,
  subito,
  children,
}: {
  nuovo: boolean;
  segno?: SegnoRiquadroProps;
  /** Un prodotto pubblicato: le foto cambiano il sito subito. */
  subito?: boolean;
  children?: ReactNode;
}) {
  return (
    <RiquadroPolaris id="foto" titolo="Foto e video" segno={segno} subito={subito}>
      {nuovo ? <Banner tono="info">Premi Salva bozza per aggiungere le foto.</Banner> : children}
    </RiquadroPolaris>
  );
}
