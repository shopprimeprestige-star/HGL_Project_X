import { useId } from "react";
import { cn } from "@/lib/utils";
import type { ModoInvito } from "./invito-meet";

/** ── «USA MEETLY»: LA SPUNTA DEL CONSULENTE (31/10/2026) ───────────────────
 *  Sta nella scheda del consulente (Anagrafica). Una spunta sola: attiva = il consulente usa Meetly e
 *  i messaggi col link partono col link (come sempre); spenta = usa un'altra piattaforma, e il link di
 *  Meetly non viene mai mandato: né dal tasto «Invia invito» della barra, né dai promemoria automatici
 *  (in quel caso partono i modelli gemelli senza link). Il link lo manda poi a mano il consulente.
 *  Si salva col «Salva modifiche» della scheda, come il resto. Il dato è sempre `invitoMeet`
 *  ("meetly" | "senza"); le regole (e dove sta il dato) sono in invito-meet.ts. */
export function SceltaInvitoMeet({
  valore,
  onCambio,
}: {
  valore: ModoInvito;
  onCambio: (v: ModoInvito) => void;
}) {
  const id = useId();
  const usaMeetly = valore === "meetly";
  return (
    <label
      htmlFor={`${id}-usa-meetly`}
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-white px-3 py-2.5",
        "transition-colors hover:bg-slate-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-400",
        usaMeetly ? "border-slate-500 bg-slate-50" : "border-slate-200",
      )}
    >
      <input
        id={`${id}-usa-meetly`}
        type="checkbox"
        checked={usaMeetly}
        onChange={(e) => onCambio(e.target.checked ? "meetly" : "senza")}
        className="mt-0.5 h-5 w-5 shrink-0 accent-slate-800"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-slate-900">
          Usa Meetly (manda il link nei messaggi)
        </span>
        <span className="mt-1 block text-[12px] leading-snug text-slate-500">
          {usaMeetly
            ? "I messaggi al cliente contengono il link per entrare."
            : "Non usa Meetly: nei messaggi non c'è mai il link, lo manda a mano il consulente in un secondo messaggio."}
        </span>
      </span>
    </label>
  );
}
