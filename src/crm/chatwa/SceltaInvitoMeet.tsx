import { useId } from "react";
import { cn } from "@/lib/utils";
import type { ModoInvito } from "./invito-meet";

/** ── «INVITO AL MEET»: LA SCELTA DEL CONSULENTE (31/10/2026) ───────────────
 *  Sta nella scheda del consulente (Anagrafica) e decide cosa fa il tasto «Invia invito» della barra
 *  del prossimo meet: messaggio col link di Meetly (di serie) o senza link, che il consulente manda
 *  poi a mano. Due opzioni radio con la descrizione scritta: la parola «senza link» da sola non
 *  dice cosa riceverà il cliente. Si salva col «Salva modifiche» della scheda, come il resto.
 *  Le regole (e dove sta il dato) sono in invito-meet.ts. */
const SCELTE: { valore: ModoInvito; titolo: string; testo: string }[] = [
  {
    valore: "meetly",
    titolo: "Col link di Meetly",
    testo: "Il messaggio contiene il link per entrare. È come funziona oggi.",
  },
  {
    valore: "senza",
    titolo: "Senza link",
    testo:
      "Il messaggio dice che il link arriva tra poco: il link lo manda a mano il consulente, in un secondo messaggio.",
  },
];

export function SceltaInvitoMeet({
  valore,
  onCambio,
}: {
  valore: ModoInvito;
  onCambio: (v: ModoInvito) => void;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Invito al meet</legend>
      {SCELTE.map((s) => (
        <label
          key={s.valore}
          className={cn(
            "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-white px-3 py-2.5",
            "transition-colors hover:bg-slate-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-400",
            valore === s.valore ? "border-slate-500 bg-slate-50" : "border-slate-200",
          )}
        >
          <input
            type="radio"
            name={`${id}-invito-meet`}
            value={s.valore}
            checked={valore === s.valore}
            onChange={() => onCambio(s.valore)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-slate-800"
          />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-slate-900">{s.titolo}</span>
            <span className="mt-1 block text-[12px] leading-snug text-slate-500">{s.testo}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
