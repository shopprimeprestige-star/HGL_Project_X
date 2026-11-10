/** ── «COM'È ANDATA?»: L'ESITO DEL RICONTATTO (31/10/2026) ───────────────────────────────────────
 *  Si apre dalla pastiglia dell'esito sulla riga, in «Ricontatti». Sul telefono è un foglio dal
 *  basso con tasti alti 44 px. Gli esiti e i loro nomi stanno in ricontatti.ts.
 *  Dal 10/11/2026 (richiesta del titolare) c'è anche «Quando vuole essere ricontattato»: la data
 *  di ricontatto, facoltativa, con tre scorciatoie. Le scelte sono due, quindi si salva con «Salva»
 *  (si riparte sempre da quello che c'è sulla scheda). */
import { useEffect, useState } from "react";
import { CalendarClock, Check, MessageCircleQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Finestra } from "@/crm/ui/Finestra";
import { giornoParlato } from "@/crm/promemoria/formati";
import { cn } from "@/lib/utils";
import { ESITI_RICONTATTO, giornoTra, type EsitoRicontatto } from "./ricontatti";

const SCORCIATOIE = [
  { nome: "Domani", giorni: 1 },
  { nome: "Tra 1 settimana", giorni: 7 },
  { nome: "Tra 1 mese", giorni: 30 },
] as const;

export function FinestraEsito({
  aperta,
  onChiudi,
  esito,
  data,
  contesto,
  onSalva,
}: {
  aperta: boolean;
  onChiudi: () => void;
  /** L'esito di adesso, o `null`. */
  esito: EsitoRicontatto | null;
  /** Il giorno di ricontatto di adesso «AAAA-MM-GG», o `""`. */
  data: string;
  /** Una riga: di chi si parla. */
  contesto?: string;
  /** Esito (`null` = «Nessun esito») e giorno (`""` = senza data). */
  onSalva: (e: EsitoRicontatto | null, giorno: string) => void;
}) {
  const [scelto, setScelto] = useState<EsitoRicontatto | null>(esito);
  const [giorno, setGiorno] = useState(data);
  //  Ogni apertura riparte dalla scheda: un Annulla di prima non resta appeso.
  useEffect(() => {
    if (aperta) {
      setScelto(esito);
      setGiorno(data);
    }
  }, [aperta, esito, data]);

  const voce = (acceso: boolean) =>
    cn(
      "t-corpo flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left font-medium transition-colors",
      acceso
        ? "border-primary bg-primary/10 text-foreground"
        : "border-slate-200 bg-white text-slate-900 hover:bg-slate-100",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    );
  const pillola = (acceso: boolean) =>
    cn(
      "min-h-11 rounded-full border px-3 text-[13px] font-medium transition-colors lg:pointer-fine:min-h-8",
      acceso
        ? "border-primary bg-primary/10 text-foreground"
        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    );
  const parlato = giornoParlato(giorno);

  return (
    <Finestra
      aperta={aperta}
      onCambio={(v) => !v && onChiudi()}
      titolo="Com'è andata?"
      icona={MessageCircleQuestion}
      contesto={contesto}
      larghezza="sm"
      azioni={
        <>
          <Button variant="outline" onClick={onChiudi} className="min-h-11 lg:pointer-fine:min-h-9">
            Annulla
          </Button>
          <Button onClick={() => onSalva(scelto, giorno)} className="min-h-11 lg:pointer-fine:min-h-9">
            Salva
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2">
        {ESITI_RICONTATTO.map((e) => (
          <li key={e.v}>
            <button
              type="button"
              aria-pressed={scelto === e.v}
              onClick={() => setScelto(e.v)}
              className={voce(scelto === e.v)}
            >
              <span className="min-w-0 flex-1">{e.titolo}</span>
              {scelto === e.v && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            aria-pressed={scelto === null}
            onClick={() => setScelto(null)}
            className={voce(scelto === null)}
          >
            <span className="min-w-0 flex-1">Nessun esito</span>
            {scelto === null && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
          </button>
        </li>
      </ul>

      {/*  ── QUANDO VUOLE ESSERE RICONTATTATO (10/11/2026) ── facoltativa: è `dataRicontatto`. */}
      <fieldset className="mt-4 border-t border-slate-200 pt-4">
        <legend className="t-corpo flex items-center gap-1.5 font-semibold text-slate-900">
          <CalendarClock aria-hidden="true" className="h-4 w-4 text-slate-600" />
          Quando vuole essere ricontattato
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCORCIATOIE.map((s) => {
            const g = giornoTra(s.giorni);
            return (
              <button
                key={s.giorni}
                type="button"
                aria-pressed={giorno === g}
                onClick={() => setGiorno(g)}
                className={pillola(giorno === g)}
              >
                {s.nome}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="sr-only" htmlFor="esito-data-ricontatto">
            Data del ricontatto
          </label>
          <input
            id="esito-data-ricontatto"
            type="date"
            value={giorno}
            min={giornoTra(0)}
            onChange={(e) => setGiorno(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 lg:pointer-fine:text-[15px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:pointer-fine:min-h-9"
          />
          {giorno && (
            <button
              type="button"
              onClick={() => setGiorno("")}
              aria-label="Togli la data"
              title="Togli la data"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[12px] text-slate-600">
          {parlato ? `Da risentire ${parlato}` : "Facoltativa: senza data resta «Senza data»"}
        </p>
      </fieldset>
    </Finestra>
  );
}
