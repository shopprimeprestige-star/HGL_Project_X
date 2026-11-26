/** ── RIQUADRO «VARIANTI» (scheda/RiquadroVarianti.tsx) ────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E7. Il contenitore dell'editor delle varianti, che lo costruisce e lo passa il guscio come `children`
 *  (le sue scritture restano là). Il «Prezzo di base» (quello che valgono le righe senza un prezzo scritto) sta dentro l'editor (E8).
 *  Su un prodotto pubblicato le varianti cambiano il sito subito: il riquadro lo dice.
 *  ⚠️ Solo presentazione: nessuna rete, nessuna scrittura. */
import type { ReactNode } from "react";
import { RiquadroPolaris } from "./polaris";
import type { SegnoRiquadroProps } from "./RiquadroCampi";

export function RiquadroVarianti({
  pubblicato,
  segno,
  children,
}: {
  pubblicato: boolean;
  segno?: SegnoRiquadroProps;
  children: ReactNode;
}) {
  return (
    <RiquadroPolaris id="varianti" titolo="Varianti" segno={segno} subito={pubblicato}>
      {children}
    </RiquadroPolaris>
  );
}
