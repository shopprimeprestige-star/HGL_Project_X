/** ── RIQUADRO «PREZZO» (scheda/RiquadroPrezzo.tsx) ────────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.3, riquadro 3; PIANO §1.2). Prezzo in euro, costo per articolo e, sotto, il margine
 *  («Margine 48 %, utile 9,60 €») che si aggiorna mentre si scrive. Solo il prodotto senza opzioni: con le opzioni il prezzo sta nella
 *  tabella delle varianti, per Invisible Derm il riquadro non c'è (si decide con `riquadriVisibili`, la stessa regola della scheda).
 *  Il costo sta sulla variante «Unica»: lo legge e lo scrive il guscio; senza la migrazione (`costoDisponibile` falso) il campo è spento e
 *  lo dice a parole. Su un prodotto pubblicato il prezzo cambia il sito subito, col suo tasto «Applica»: il tasto lo costruisce il guscio. */
import type { ReactNode } from "react";
import { riquadriVisibili } from "../riquadri-puro";
import { fraseMargine, type Modalita } from "../semplice-puro";
import { CLASSI_CAMPO, CampoP, RiquadroPolaris } from "./polaris";
import { CampoTesto, type ProprietaRiquadro } from "./RiquadroCampi";

export const FRASE_COSTO_SPENTO = "Per il costo serve un aggiornamento del database.";

export function RiquadroPrezzo({
  modalita,
  invisibleDerm,
  pubblicato,
  prezzoVivo,
  costo,
  cambiaCosto,
  costoErrore,
  costoDisponibile,
  azionePrezzo,
  ...p
}: ProprietaRiquadro & {
  modalita: Modalita;
  invisibleDerm: boolean;
  pubblicato: boolean;
  /** Il prezzo che si vede oggi sul sito, già scritto («19,90»); solo per un prodotto pubblicato. */
  prezzoVivo?: string;
  /** Il costo come lo scrive il titolare («10,40»). */
  costo: string;
  cambiaCosto: (testo: string) => void;
  costoErrore?: string;
  costoDisponibile: boolean;
  /** Il tasto «Applica il nuovo prezzo», costruito dal guscio (solo per un prodotto pubblicato). */
  azionePrezzo?: ReactNode;
}) {
  if (!riquadriVisibili({ modalita, invisibleDerm }).includes("prezzo")) return null;
  const margine = costoDisponibile ? fraseMargine(p.modulo.prezzo, costo) : null;
  return (
    <RiquadroPolaris id="prezzo" titolo="Prezzo" segno={p.segno} subito={pubblicato}>
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTesto
          k="prezzo"
          p={p}
          etichetta="Prezzo (euro)"
          inputMode="decimal"
          placeholder="19,90"
          aiuto="Un solo prezzo, IVA inclusa."
        />
        <CampoP
          id="f-costo"
          etichetta="Costo per articolo (euro)"
          facoltativo
          aiuto={
            costoDisponibile
              ? "Lo vedi solo tu: serve per il margine, non compare mai sul sito."
              : FRASE_COSTO_SPENTO
          }
          errore={costoErrore}
        >
          {(a) => (
            <input
              {...a}
              inputMode="decimal"
              placeholder="10,40"
              value={costo}
              disabled={!costoDisponibile}
              onChange={(e) => cambiaCosto(e.target.value)}
              className={CLASSI_CAMPO}
            />
          )}
        </CampoP>
      </div>
      <p
        aria-live="polite"
        className={
          margine?.tono === "perdita"
            ? "text-[13px] font-medium text-rose-800 empty:hidden"
            : "text-[13px] font-medium text-foreground empty:hidden"
        }
      >
        {margine?.testo}
      </p>
      {pubblicato && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <p className="text-[13px] text-muted-foreground">
            Sul sito ora: <strong className="text-foreground">€ {prezzoVivo || "0,00"}</strong>
          </p>
          {azionePrezzo}
        </div>
      )}
    </RiquadroPolaris>
  );
}
