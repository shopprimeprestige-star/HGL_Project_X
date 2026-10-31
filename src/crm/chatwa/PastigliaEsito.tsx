/** ── LA PASTIGLIA DELL'ESITO, UNA SOLA (31/10/2026) ─────────────────────────────────────────────
 *  Si usa in tre posti: la riga di «Ricontatti», l'intestazione della chat aperta e la scheda del
 *  cliente nel CRM. Qui sta tutto: la pastiglia, il foglio «Com'è andata?» (FinestraEsito) e la
 *  scrittura sulla scheda (`updateLead` con `patchEsito`). Chi la usa decide solo dove metterla e
 *  quanto è alta (`className`). Resta quando lo stato cambia. */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "@/crm/CRMContext";
import { cn } from "@/lib/utils";
import { FinestraEsito } from "./FinestraEsito";
import { ESITI_RICONTATTO, patchEsito, type EsitoRicontatto } from "./ricontatti";

export function PastigliaEsito({
  leadId,
  esito,
  contesto,
  className,
  onSalvato,
}: {
  leadId: string;
  /** L'esito di adesso (`esitoDi`), o `null`. */
  esito: EsitoRicontatto | null;
  /** Una riga nel foglio: di chi si parla. */
  contesto?: string;
  /** Si somma alla pastiglia: per l'altezza del tocco dove serve più dei 44 px della riga. */
  className?: string;
  /** Dopo il salvataggio riuscito, con quello che è stato scritto (la scheda aperta si aggiorna). */
  onSalvato?: (patch: ReturnType<typeof patchEsito>) => void;
}) {
  const { updateLead } = useCRM();
  const [aperta, setAperta] = useState(false);
  const nomeEsito = ESITI_RICONTATTO.find((e) => e.v === esito)?.nome ?? null;

  const salva = async (nuovo: EsitoRicontatto | null) => {
    setAperta(false);
    if (nuovo === esito) return;
    const patch = patchEsito(nuovo);
    if (await updateLead(leadId, patch)) onSalvato?.(patch);
    else toast.error("Esito NON salvato", { description: "La scheda è rimasta com'era. Riprova." });
  };

  return (
    <>
      {/*  Stessa forma della pastiglia dello stato, grigio-azzurra; tratteggiata «Esito» quando
          manca. Il tocco è da 44 px sul telefono (`after:`), apre «Com'è andata?». */}
      <button
        type="button"
        onClick={() => setAperta(true)}
        aria-haspopup="dialog"
        aria-label={`Esito: ${nomeEsito ?? "nessuno"}. Cambialo`}
        title={`${nomeEsito ?? "Nessun esito"} · cambia esito`}
        className={cn(
          "relative inline-flex min-w-0 max-w-full items-center rounded-full after:absolute after:inset-x-0 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:after:hidden",
          className,
        )}
      >
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
            nomeEsito
              ? "border-slate-300 bg-slate-100 text-slate-800"
              : "border-dashed border-muted-foreground/50 text-muted-foreground",
          )}
        >
          <span className="truncate">{nomeEsito ?? "Esito"}</span>
          <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
        </span>
      </button>
      <FinestraEsito
        aperta={aperta}
        onChiudi={() => setAperta(false)}
        esito={esito}
        contesto={contesto}
        onScegli={(e) => void salva(e)}
      />
    </>
  );
}
