/** ── RIQUADRO «GIACENZA» (scheda/RiquadroGiacenza.tsx) ────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.3, riquadro 4). SKU, barcode (GTIN), quantità disponibile con il motivo (Carico /
 *  Rettifica / Reso) e, in sola lettura, la soglia di scorta bassa. Solo il prodotto senza opzioni (la variante è l'«Unica»).
 *  La quantità non si scrive nel database «a mano»: la differenza diventa un movimento registrato (`cambioQuantita`), lo fa il guscio. */
import type { ReactNode } from "react";
import { riquadriVisibili } from "../riquadri-puro";
import {
  MOTIVI_GIACENZA,
  cambioQuantita,
  type Modalita,
  type MotivoGiacenza,
} from "../semplice-puro";
import { fuocoEsceDalGruppo } from "./giacenza-puro";
import { CLASSI_CAMPO, CampoP, RiquadroPolaris } from "./polaris";
import { CampoTesto, type ProprietaRiquadro } from "./RiquadroCampi";

export function RiquadroGiacenza({
  modalita,
  invisibleDerm,
  nuovo,
  skuBloccato,
  giacenzaAttuale,
  quantita,
  cambiaQuantita,
  motivo,
  cambiaMotivo,
  soglia,
  linkSoglia,
  confermaQuantita,
  ...p
}: ProprietaRiquadro & {
  modalita: Modalita;
  invisibleDerm: boolean;
  /** Prodotto non ancora salvato: la quantità è «iniziale» e il motivo è sempre «Carico». */
  nuovo: boolean;
  /** Già pubblicato: lo SKU non si cambia più. */
  skuBloccato: boolean;
  /** I pezzi in magazzino ora (0 per un prodotto nuovo). */
  giacenzaAttuale: number;
  quantita: string;
  cambiaQuantita: (testo: string) => void;
  motivo: MotivoGiacenza;
  cambiaMotivo: (m: MotivoGiacenza) => void;
  /** La soglia di scorta bassa letta dalle impostazioni; `null` se non si è riusciti a leggerla (la riga non si mostra). */
  soglia: number | null;
  /** Il link alle impostazioni, costruito dal chiamante (il router non è affare dei riquadri). */
  linkSoglia?: ReactNode;
  /** Il fuoco esce dal gruppo quantità + motivo (o Invio nella quantità): è il momento in cui il guscio scrive il movimento (mai a ogni tasto, mai passando al motivo). */
  confermaQuantita?: () => void;
}) {
  if (!riquadriVisibili({ modalita, invisibleDerm }).includes("giacenza")) return null;
  const esito = cambioQuantita(giacenzaAttuale, quantita);
  const errore = quantita.trim() && !esito.ok ? esito.frase : undefined;
  const variazione =
    esito.ok && esito.differenza !== 0 && !nuovo
      ? `Salvando, la giacenza ${esito.differenza > 0 ? "sale" : "scende"} di ${Math.abs(esito.differenza)} (${MOTIVI_GIACENZA.find((m) => m.valore === motivo)?.etichetta.toLowerCase()}).`
      : null;
  return (
    <RiquadroPolaris id="giacenza" titolo="Giacenza" segno={p.segno}>
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTesto
          k="sku"
          p={p}
          etichetta="SKU"
          disabilitato={skuBloccato}
          trasforma={(v) => v.toUpperCase()}
          aiuto={
            skuBloccato
              ? "Già pubblicato: lo SKU non si cambia più."
              : "Maiuscolo, senza spazi (per esempio HG-T01)."
          }
        />
        <CampoTesto
          k="gtin"
          p={p}
          etichetta="Barcode (GTIN)"
          max={20}
          facoltativo
          inputMode="numeric"
        />
      </div>
      <div
        onBlur={(e) =>
          fuocoEsceDalGruppo(e.currentTarget, e.relatedTarget as Node | null) &&
          confermaQuantita?.()
        }
      >
        <div className={nuovo ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
          <CampoP
            id="f-giacenza"
            etichetta={nuovo ? "Quantità iniziale" : "Quantità disponibile"}
            errore={errore}
            aiuto={nuovo ? undefined : `In magazzino ora: ${giacenzaAttuale}.`}
          >
            {(a) => (
              <input
                {...a}
                inputMode="numeric"
                value={quantita}
                onChange={(e) => cambiaQuantita(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className={CLASSI_CAMPO}
              />
            )}
          </CampoP>
          {!nuovo && (
            <CampoP id="f-motivo" etichetta="Motivo del cambio">
              {(a) => (
                <select
                  {...a}
                  value={motivo}
                  onChange={(e) => cambiaMotivo(e.target.value as MotivoGiacenza)}
                  className={CLASSI_CAMPO}
                >
                  {MOTIVI_GIACENZA.map((m) => (
                    <option key={m.valore} value={m.valore}>
                      {m.etichetta}
                    </option>
                  ))}
                </select>
              )}
            </CampoP>
          )}
        </div>
        {/* Sempre nella pagina, anche vuota: cambia solo il testo (così lo schermo lo annuncia). */}
        <p aria-live="polite" className={variazione ? "mt-3 text-[13px] font-medium" : "mt-0"}>
          {variazione}
        </p>
      </div>
      {soglia !== null && (
        <p className="border-t border-border pt-3 text-[13px] text-muted-foreground">
          Scorta bassa sotto {soglia} {soglia === 1 ? "pezzo" : "pezzi"} (si cambia nelle
          impostazioni). {linkSoglia}
        </p>
      )}
    </RiquadroPolaris>
  );
}
