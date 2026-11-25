/** ── RIQUADRO «TITOLO E DESCRIZIONE» (scheda/RiquadroTitolo.tsx) ──────────────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.3, riquadro 1). Titolo (120), descrizione breve (300, serve per pubblicare), descrizione
 *  (5000, testo semplice a paragrafi) e, sotto, «Altri testi» (riga di presentazione 90, «Per chi è» 200).
 *  «Altri testi» si apre da solo se c'è già qualcosa o un errore: così «Vai» non porta mai a un campo nascosto.
 *  L'avviso su Invisible Derm lo scrive il guscio e lo passa come `avviso` (resta dov'è, con le sue prove). */
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { TETTI } from "@/shop/cms/modello";
import { RiquadroPolaris } from "./polaris";
import { CampoTesto, type ProprietaRiquadro } from "./RiquadroCampi";

export function RiquadroTitolo({
  avviso,
  ...p
}: ProprietaRiquadro & {
  /** Un banner già costruito dal guscio (Invisible Derm: «Non scrivere prezzi nelle descrizioni»). */
  avviso?: ReactNode;
}) {
  const { modulo, errori } = p;
  const altriAperti =
    !!modulo.rigaPresentazione || !!modulo.perChi || !!errori.rigaPresentazione || !!errori.perChi;
  return (
    <RiquadroPolaris id="titolo" titolo="Titolo e descrizione" segno={p.segno}>
      {avviso}
      <CampoTesto k="nome" p={p} etichetta="Titolo" max={120} />
      <CampoTesto
        k="descrizioneBreve"
        p={p}
        etichetta="Descrizione breve"
        max={TETTI.breve}
        area
        righe={3}
        aiuto="Obbligatoria per pubblicare. Si legge nell'elenco e in cima alla scheda."
      />
      <CampoTesto
        k="descrizioneLunga"
        p={p}
        etichetta="Descrizione"
        max={5000}
        area
        righe={6}
        facoltativo
        aiuto="Testo semplice: lascia una riga vuota tra un paragrafo e l'altro."
      />
      <details open={altriAperti} className="group flex flex-col gap-4 border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 [&::-webkit-details-marker]:hidden">
          Altri testi
          <ChevronDown
            className="h-4 w-4 transition-transform motion-reduce:transition-none group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="flex flex-col gap-4">
          <CampoTesto
            k="rigaPresentazione"
            p={p}
            etichetta="Riga di presentazione"
            max={TETTI.riga}
            facoltativo
            aiuto="Una frase sotto il titolo."
          />
          <CampoTesto k="perChi" p={p} etichetta="Per chi è" max={200} facoltativo />
        </div>
      </details>
    </RiquadroPolaris>
  );
}
