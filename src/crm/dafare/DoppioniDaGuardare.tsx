/** ── I DOPPIONI SEGNALATI IN «DA FARE OGGI» ─────────────────────────────────
 *
 *  Commessa 2026-10-30 (idea 14): la stessa persona con due schede (modulo,
 *  foglio, chat) si trovava solo in Lead importati › Altro › Doppioni, cioè
 *  dove non la cercava nessuno. Qui una riga sola, nella pagina che si apre
 *  la mattina; il tasto apre la stessa scheda «Doppioni» di sempre, con gli
 *  stessi due gesti (crm/doppioni-unione).
 *  ⚠️ L'UNIONE LA DECIDE UNA PERSONA, coppia per coppia: qui non c'è nessun
 *   «unisci tutti».
 *  ⚠️ NON SI CANCELLA NIENTE: la scheda doppia resta in archivio, collegata
 *   (`unitoIn`) e messa da parte.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Finestra } from "@/crm/ui/Finestra";
import type { Lead } from "@/crm/types";
import type { GruppoDoppio } from "@/crm/doppioni";
import { useUnioneSchede } from "@/crm/doppioni-unione";
import { SchedaDoppioni } from "@/crm/importa/SchedaDoppioni";

export function DoppioniDaGuardare({
  gruppi,
  chi,
  onApri,
}: {
  gruppi: GruppoDoppio[];
  /** Il nome di chi preme «Unisci»: si scrive sulla scheda messa da parte. */
  chi?: string | null;
  onApri: (l: Lead) => void;
}) {
  const [aperta, setAperta] = useState(false);
  const { unisciSchede, segnaDiverse } = useUnioneSchede(chi);
  if (gruppi.length === 0) return null;
  const quante = gruppi.length === 1 ? "1 persona ha" : `${gruppi.length} persone hanno`;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
        <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          {quante} due schede con lo stesso numero. Guardale e decidi tu se unirle: non si cancella
          niente.
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 bg-white"
          onClick={() => setAperta(true)}
        >
          Guarda i doppioni
        </Button>
      </div>
      {aperta && (
        <Finestra
          aperta
          onCambio={setAperta}
          titolo="Unisci i doppioni"
          icona={Copy}
          larghezza="lg"
          senzaPadding
        >
          <SchedaDoppioni
            gruppi={gruppi}
            onApri={(l) => {
              setAperta(false);
              onApri(l);
            }}
            onUnisci={(principale, assorbita) => void unisciSchede(principale, assorbita)}
            onDiverse={(a, b) => void segnaDiverse(a, b)}
          />
        </Finestra>
      )}
    </>
  );
}
