/** ── LE TRE RIGHE DI «RICONTATTI»: STATO, ESITO, DATA (31/10/2026) ─────────────────────────────
 *  Richiesta del titolare: «Attesa acconto + non ha risposto», un lead che era in Attesa acconto e poi
 *  ha detto «sentiamoci più avanti»; con data icona calendario, senza data icona X.
 *  Compaiono SOLO con «Ricontatti» acceso, sotto la riga dei filtri rapidi. A differenza di quelli, qui
 *  le righe si COMBINANO: ognuna ha una pastiglia sola accesa, e passa chi le rispetta tutte.
 *  Per toglierle: si tocca di nuovo la pastiglia, o la ✕ della sua etichetta nel riepilogo (un solo
 *  «Azzera» in pagina). Telefono: ogni riga scorre di lato, pastiglie da 44 px, il numero è quello che vedresti toccando.
 *  Le regole sono in ricontatti.ts (provate in prove/idee/risentire.mjs). */
import { CalendarClock, CalendarX } from "lucide-react";
import type { ComponentType } from "react";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/crm/types";
import { cn } from "@/lib/utils";
import { BORDO_TASTO, Contatore, FUOCO } from "./PannelloFiltri";
import {
  commutaRisentire,
  contaRisentire,
  ESITI_RICONTATTO,
  ESITO_NESSUNO,
  statiRisentire,
  type CampoRisentire,
  type ChatRicontatto,
  type FiltroRisentire,
} from "./ricontatti";

const RIGA_SCORREVOLE =
  "flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

interface Voce {
  v: string;
  nome: string;
  icona?: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
}

interface Props {
  /** I MIEI ricontatti (già filtrati da chi li guarda), senza ricerca: sono i numeri sulle pastiglie. */
  chats: readonly ChatRicontatto[];
  valore: FiltroRisentire;
  onCambia: (r: FiltroRisentire) => void;
}

export function RigheRisentire({ chats, valore, onCambia }: Props) {
  const stati: Voce[] = statiRisentire(chats, valore).map((s) => ({
    v: s,
    nome: LEAD_STATUS_LABEL[s as LeadStatus] ?? s,
  }));
  const esiti: Voce[] = [
    ...ESITI_RICONTATTO.map((e) => ({ v: e.v as string, nome: e.nome })),
    { v: ESITO_NESSUNO, nome: "Senza esito" },
  ];
  const date: Voce[] = [
    { v: "con", nome: "Con data", icona: CalendarClock },
    { v: "senza", nome: "Senza data", icona: CalendarX },
  ];

  const riga = (titolo: string, campo: CampoRisentire, voci: Voce[]) => (
    <div className="flex items-center gap-2">
      <span className="t-nota w-11 shrink-0 font-medium text-muted-foreground">{titolo}</span>
      <div
        role="group"
        aria-label={`${titolo}: scegli una voce, si sommano alle altre righe`}
        className={RIGA_SCORREVOLE}
      >
        {voci.map((x) => {
          const acceso = valore[campo] === x.v;
          const Icona = x.icona;
          return (
            <button
              key={x.v}
              type="button"
              aria-pressed={acceso}
              onClick={() => onCambia(commutaRisentire(valore, campo, x.v))}
              className={cn(
                "t-corpo flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 font-medium transition-colors lg:pointer-fine:h-8",
                acceso
                  ? "border-primary bg-primary text-primary-foreground"
                  : `${BORDO_TASTO} bg-background text-foreground hover:bg-muted`,
                FUOCO,
              )}
            >
              {Icona && <Icona aria-hidden="true" className="h-4 w-4 shrink-0" />}
              <span className="whitespace-nowrap">{x.nome}</span>
              <Contatore n={contaRisentire(chats, valore, campo, x.v)} acceso={acceso} />
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      role="region"
      aria-label="Filtri dei ricontatti: stato, esito e data"
      className="flex flex-col gap-1.5 border-t border-border bg-muted/30 px-3 py-2 md:px-2"
    >
      {riga("Stato", "stato", stati)}
      {riga("Esito", "esito", esiti)}
      {riga("Data", "data", date)}
    </div>
  );
}
