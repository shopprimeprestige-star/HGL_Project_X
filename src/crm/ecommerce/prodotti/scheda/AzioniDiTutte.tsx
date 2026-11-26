/** ── «IMPOSTA IL PREZZO DI TUTTE» E «IMPOSTA LO STOCK DI TUTTE» (scheda/AzioniDiTutte.tsx) ───────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E8 (SPEC §3.3 riquadro 6). Due piccoli moduli sopra la tabella: agiscono sulle righe spuntate, o su tutte se
 *  non ne è spuntata nessuna. Il prezzo si scrive su OGNI riga (azione esplicita: dopo aver creato le varianti il prezzo resta vuoto e vale quello
 *  di base). Solo presentazione: le scritture sono di `EditorVarianti` (`varianti-azioni.ts`), qui arriva solo il testo scritto. */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOTIVI_GIACENZA, type MotivoGiacenza } from "../semplice-puro";
import { CLASSI_CAMPO, CLASSI_TASTO } from "./polaris";

export function AzioniDiTutte({
  quante,
  scelte,
  senzaPrezzo,
  occupato,
  impostaPrezzo,
  impostaStock,
}: {
  /** Quante righe ha la tabella. */
  quante: number;
  /** Quante ne sono spuntate (0 = le azioni valgono per tutte). */
  scelte: number;
  senzaPrezzo: boolean;
  occupato: boolean;
  impostaPrezzo: (testo: string) => void;
  impostaStock: (testo: string, motivo: MotivoGiacenza) => void;
}) {
  const [prezzo, setPrezzo] = useState("");
  const [stock, setStock] = useState("");
  const [motivo, setMotivo] = useState<MotivoGiacenza>("rettifica");
  const ambito =
    scelte > 0
      ? scelte === 1
        ? "1 riga scelta"
        : `${scelte} righe scelte`
      : quante === 1
        ? "la sua riga"
        : `tutte le ${quante} righe`;
  const quali =
    scelte > 0 ? (scelte === 1 ? "della scelta" : `delle ${scelte} scelte`) : "di tutte";
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-[13px] text-muted-foreground">
        Le azioni qui sotto valgono per {ambito}. Spunta le righe nella tabella per sceglierle.
      </p>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        {!senzaPrezzo && (
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tutte-prezzo" className="text-[13px] font-medium">
                Prezzo in euro
              </label>
              <input
                id="tutte-prezzo"
                inputMode="decimal"
                value={prezzo}
                onChange={(e) => setPrezzo(e.target.value)}
                placeholder="19,90"
                className={cn(CLASSI_CAMPO, "md:w-28")}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className={CLASSI_TASTO}
              disabled={occupato || prezzo.trim() === ""}
              onClick={() => impostaPrezzo(prezzo)}
            >
              {`Imposta il prezzo ${quali}`}
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-1.5 md:flex-row md:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tutte-stock" className="text-[13px] font-medium">
              Pezzi
            </label>
            <input
              id="tutte-stock"
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="Pezzi"
              className={cn(CLASSI_CAMPO, "md:w-24")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tutte-motivo" className="text-[13px] font-medium">
              Motivo
            </label>
            <select
              id="tutte-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoGiacenza)}
              className={cn(CLASSI_CAMPO, "md:w-40")}
            >
              {MOTIVI_GIACENZA.map((m) => (
                <option key={m.valore} value={m.valore}>
                  {m.etichetta}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            className={CLASSI_TASTO}
            disabled={occupato || stock.trim() === ""}
            onClick={() => impostaStock(stock, motivo)}
          >
            {`Imposta lo stock ${quali}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
