/** Estratto da `src/routes/CRM.importa.tsx` (commessa 2026-10-28-lead-importati-semplice,
 *  compito T3): l'elenco degli appuntamenti del giorno appena fissato.
 *  Solo uno spostamento: nessuna riga di logica è cambiata. */
import { nomeDi } from "@/crm/importa/nome-lead";
import { CalendarClock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsulenteCollegato } from "@/crm/AuthContext";
import { type Lead, type LeadData } from "@/crm/types";
import { Scheda, dataBreve } from "@/crm/ui";

/* ── ⚠️ COM'È MESSO QUEL GIORNO ─────────────────────────────────────
    Richiesta del committente: «se metto appuntamento fissato mi deve
    mostrare la lista di tutti i fissati del giorno».
    Chi fissa appuntamenti tutto il giorno deve vedere com'è messo quel
    giorno subito dopo averlo riempito di uno: è così che ci si accorge
    che giovedì ne ha già sette e mercoledì due, e alla telefonata dopo
    si propone mercoledì. Prima bisognava aprire l'agenda — cambiare
    pagina e perdere la coda.
    ⚠️ CI SONO TUTTI, NON SOLO I PROPRI: un giorno è pieno anche degli
     appuntamenti degli altri, e proporne un ottavo guardando solo i
     propri due vuol dire accorgersene col cliente in linea.
    ⚠️ Si chiude a mano e si spegne da sé al prossimo esito: è la
     risposta a un gesto appena fatto, non un pannello fisso. */
export function SchedaGiorno({
  giornoFissato,
  delGiorno,
  consulenteCollegato,
  setGiornoFissato,
  setScheda,
}: {
  giornoFissato: string;
  delGiorno: Lead[];
  consulenteCollegato: ReturnType<typeof useConsulenteCollegato>;
  setGiornoFissato: (g: string | null) => void;
  setScheda: (l: Lead) => void;
}) {
  return (
    <Scheda
      titolo={`Appuntamenti di ${dataBreve(giornoFissato)}`}
      nota={
        delGiorno.length === 1
          ? "Per ora ce n'è uno solo su quel giorno"
          : `${delGiorno.length} su quel giorno, in ordine di orario`
      }
      icona={CalendarClock}
      azioni={
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[12px]"
          onClick={() => setGiornoFissato(null)}
        >
          Chiudi
        </Button>
      }
      senzaPadding
    >
      <ul className="max-h-[40vh] divide-y divide-border overflow-y-auto">
        {delGiorno.map((l) => {
          const d = l.data ?? ({} as LeadData);
          const mio = !!consulenteCollegato?.id && d.statoDa === consulenteCollegato.id;
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setScheda(l)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-muted/40"
              >
                <span className="w-12 shrink-0 text-[12.5px] font-semibold tabular-nums">
                  {d.oraMeeting || "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {nomeDi(l, "Senza nome")}
                  {/*  ⚠️ Si dice quali sono i tuoi: in mezzo a quelli di
                      tutti, riconoscere i propri a colpo d'occhio è il
                      motivo per cui si guarda questo elenco. */}
                  {mio && (
                    <span className="ml-1.5 text-[11px] text-muted-foreground">· tuo</span>
                  )}
                </span>
                {d.durataMeeting ? (
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">
                    {d.durataMeeting} min
                  </span>
                ) : null}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
    </Scheda>
  );
}
