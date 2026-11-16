/** ── I FILTRI DI «RICONTATTI»: ESITO IN UNA BARRA (31/10/2026, rifatto il 16/11/2026) ────────────
 *  Richiesta del titolare (seconda versione): niente filtro per Stato, solo Esito; la barra sticky in
 *  cima all'elenco, richiudibile e SEMPRE chiusa quando si entra.
 *  · BarraEsitoRicontatti: da chiusa una riga sottile («Filtri ricontatti · Non ha risposto»), da aperta
 *    le pastiglie dell'esito. Si monta solo con «Ricontatti» acceso: ogni ingresso riparte chiusa. Sceglierne
 *    una la richiude (il filtro acceso si legge nella riga e nel riepilogo).
 *  ⚠️ 16/11/2026: tolta `RigaDataRicontatti` (Tutti/Con data/Senza data, D4 dell'analisi): chiedeva la
 *  stessa cosa della fila generica dei giorni (`RigaGiorno`, sotto questa barra), con un secondo
 *  interruttore indipendente che poteva contraddirla (scegliere «Senza data» qui e «Oggi» là dava
 *  sempre zero, senza dirlo). La fila generica ha già «Senza data»; «Con data» non serve più: con
 *  Scaduti/Ieri/Oggi/Domani/Prossimi giorni/Senza data, scegliere «Tutti» e togliere «Senza data» a
 *  mente è già «con data».
 *  Gli altri filtri della chat restano uno alla volta; l'Esito si combina col giorno. Per togliere
 *  l'Esito: si tocca di nuovo la pastiglia, o la ✕ della sua etichetta nel riepilogo (un solo «Azzera»
 *  in pagina). Telefono: tocchi da 44 px (l'area è più grande di ciò che si vede). Le regole sono in
 *  ricontatti.ts. */
import { ChevronDown, ListFilter } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BORDO_TASTO, Contatore, FUOCO } from "./PannelloFiltri";
import {
  commutaRisentire,
  contaRisentire,
  ESITI_RICONTATTO,
  ESITO_NESSUNO,
  type ChatRicontatto,
  type FiltroRisentire,
} from "./ricontatti";

interface Props {
  /** I MIEI ricontatti non nascosti, senza ricerca: sono i numeri sulle pastiglie. */
  chats: readonly ChatRicontatto[];
  valore: FiltroRisentire;
  onCambia: (r: FiltroRisentire) => void;
}

const ESITI = [
  ...ESITI_RICONTATTO.map((e) => ({ v: e.v as string, nome: e.nome })),
  { v: ESITO_NESSUNO, nome: "Senza esito" },
];

export function BarraEsitoRicontatti({ chats, valore, onCambia }: Props) {
  const [aperta, setAperta] = useState(false);
  const scelto = ESITI.find((e) => e.v === valore.esito)?.nome ?? null;
  return (
    <div className="border-b border-border bg-card">
      {/*  Una riga sottile (36 px a vista, 44 di tocco col dito). Il nome dell'esito acceso resta leggibile. */}
      <button
        type="button"
        aria-expanded={aperta}
        aria-controls="esiti-ricontatti"
        onClick={() => setAperta(!aperta)}
        className={cn(
          "t-nota relative flex h-9 w-full items-center gap-2 px-3 text-left after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-muted/50 md:px-2 lg:pointer-fine:h-8 lg:pointer-fine:after:hidden",
          FUOCO,
        )}
      >
        <ListFilter aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-medium text-foreground">Filtri ricontatti</span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            scelto ? "font-medium text-primary" : "text-muted-foreground",
          )}
        >
          {`· Esito: ${scelto ?? "tutti"}`}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            aperta && "rotate-180",
          )}
        />
      </button>
      {aperta && (
        <div
          id="esiti-ricontatti"
          role="group"
          aria-label="Esito del ricontatto"
          className="flex flex-wrap gap-2 px-3 pb-2.5 pt-0.5 md:px-2"
        >
          {ESITI.map((x) => {
            const acceso = valore.esito === x.v;
            return (
              <button
                key={x.v}
                type="button"
                aria-pressed={acceso}
                onClick={() => {
                  onCambia(commutaRisentire(valore, "esito", x.v));
                  setAperta(false);
                }}
                className={cn(
                  "t-nota relative flex h-9 items-center gap-1.5 rounded-lg border pl-3 pr-2 font-medium transition-colors after:absolute after:inset-x-0 after:-inset-y-1 lg:pointer-fine:h-8 lg:pointer-fine:after:hidden",
                  acceso
                    ? "border-primary bg-primary text-primary-foreground"
                    : `${BORDO_TASTO} bg-background text-foreground hover:bg-muted`,
                  FUOCO,
                )}
              >
                <span className="whitespace-nowrap">{x.nome}</span>
                <Contatore n={contaRisentire(chats, valore, "esito", x.v)} acceso={acceso} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
