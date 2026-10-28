/** Estratto da `src/routes/CRM.importa.tsx` (commessa 2026-10-28-lead-importati-semplice,
 *  compito T3): la domanda prima di eliminare un lead.
 *  Solo uno spostamento: nessuna riga di logica è cambiata. */
import { nomeDi } from "@/crm/importa/nome-lead";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Lead } from "@/crm/types";
import { Finestra } from "@/crm/ui/Finestra";

/*  ── LA DOMANDA PRIMA DI ELIMINARE ─────────────────────────
     Col nome dentro e su un tasto diverso da quello premuto: non
     c'è un cestino, e un doppio tocco non deve bastare. */
export function FinestraElimina({
  daEliminare,
  eliminoDaEliminare,
  setDaEliminare,
  setEliminoDaEliminare,
  eliminaUno,
}: {
  daEliminare: Lead;
  eliminoDaEliminare: boolean;
  setDaEliminare: (l: Lead | null) => void;
  setEliminoDaEliminare: (v: boolean) => void;
  eliminaUno: (l: Lead) => Promise<boolean>;
}) {
  return (
    <Finestra
      aperta
      onCambio={(v) => !v && !eliminoDaEliminare && setDaEliminare(null)}
      icona={Trash2}
      titolo="Eliminare questo lead?"
      contesto={<span className="text-red-700">{nomeDi(daEliminare)}</span>}
      larghezza="sm"
      bloccante
      azioni={
        <>
          <Button
            variant="outline"
            onClick={() => setDaEliminare(null)}
            disabled={eliminoDaEliminare}
          >
            No, lo tengo
          </Button>
          <Button
            onClick={async () => {
              setEliminoDaEliminare(true);
              const fatto = await eliminaUno(daEliminare);
              setEliminoDaEliminare(false);
              if (fatto) setDaEliminare(null);
            }}
            disabled={eliminoDaEliminare}
            className="bg-red-600 text-white hover:bg-red-700 sm:min-w-32"
          >
            {eliminoDaEliminare ? "Elimino…" : "Sì, elimina"}
          </Button>
        </>
      }
    >
      <div className="space-y-2 p-4 text-[12.5px] leading-relaxed text-muted-foreground">
        <p>
          Se ne vanno con lui{" "}
          <b className="text-foreground">
            le note, i tentativi di chiamata e le risposte del modulo
          </b>
          . Non c'è un cestino da cui ripescarlo.
        </p>
        <p>
          Se non ti interessa più ma vuoi tenerne traccia, chiudi e segna lo stato «Non
          interessato»: resta in archivio ed esce dalla coda.
        </p>
      </div>
    </Finestra>
  );
}
