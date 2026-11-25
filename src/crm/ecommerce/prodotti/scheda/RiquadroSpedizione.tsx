/** ── RIQUADRO «SPEDIZIONE» (scheda/RiquadroSpedizione.tsx) ────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.3, riquadro 5). Peso in grammi (intero) e classe di spedizione (testo, max 40).
 *  Solo il prodotto senza opzioni: con le opzioni il peso sta in ogni riga della tabella delle varianti. */
import { riquadriVisibili } from "../riquadri-puro";
import type { Modalita } from "../semplice-puro";
import { RiquadroPolaris } from "./polaris";
import { CampoTesto, type ProprietaRiquadro } from "./RiquadroCampi";

export function RiquadroSpedizione({
  modalita,
  invisibleDerm,
  ...p
}: ProprietaRiquadro & { modalita: Modalita; invisibleDerm: boolean }) {
  if (!riquadriVisibili({ modalita, invisibleDerm }).includes("spedizione")) return null;
  return (
    <RiquadroPolaris id="spedizione" titolo="Spedizione" segno={p.segno}>
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTesto
          k="pesoG"
          p={p}
          etichetta="Peso (grammi)"
          inputMode="numeric"
          facoltativo
          aiuto="Un numero intero, per esempio 250."
        />
        <CampoTesto
          k="classeSpedizione"
          p={p}
          etichetta="Classe di spedizione"
          max={40}
          facoltativo
        />
      </div>
    </RiquadroPolaris>
  );
}
