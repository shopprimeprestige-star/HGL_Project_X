/** ── IL CAMPO DELL'INDIRIZZO, CON I SUGGERIMENTI ───────────────────────────
 *  Si scrive, compaiono gli indirizzi veri, se ne sceglie uno e tutti i campi
 *  attorno si riempiono. La ricerca sta in `crm/indirizzo-suggerito` — lì c'è
 *  anche il perché non è Google e cosa cambiare il giorno che arriva una
 *  chiave.
 *
 *  ⚠️ RESTA UN CAMPO NORMALE. Chi ha un indirizzo che il servizio non conosce
 *   — una frazione, una via nuova, un cliente estero — scrive e basta: i
 *   suggerimenti non bloccano niente e non correggono niente di nascosto. Un
 *   campo che accetta solo quello che una lista conosce è un campo che un
 *   giorno rifiuta l'indirizzo giusto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useIndirizziSuggeriti, type IndirizzoScelto } from "./indirizzo-suggerito";

export function CampoIndirizzo({
  valore,
  onTesto,
  onScelto,
  /** Serve a cercare meglio: «via roma» da solo è in duemila comuni. */
  comune,
  placeholder,
  disabled,
  className,
}: {
  valore: string;
  onTesto: (v: string) => void;
  onScelto: (i: IndirizzoScelto) => void;
  comune?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  /*  ⚠️ L'attesa, l'annullamento e il «non ricercare quello che hai appena
      scelto» stanno nel gancio, in crm/indirizzo-suggerito: qui c'è solo il
      disegno. Lo stesso gancio lo usa il campo del preventivo, che è scuro e
      su una pagina pubblica — due vestiti, un comportamento solo. */
  const { suggerimenti, aperto, cercando, riapri, chiudi, scritto, scelto } = useIndirizziSuggeriti(
    valore,
    comune,
  );

  return (
    <div className="relative">
      <Input
        value={valore}
        onChange={(e) => {
          scritto();
          onTesto(e.target.value);
        }}
        onFocus={riapri}
        //  ⚠️ Con un ritardo: il clic su un suggerimento toglie il fuoco al
        //   campo, e chiudendo subito la tendina il clic cadrebbe nel vuoto.
        onBlur={() => window.setTimeout(chiudi, 150)}
        placeholder={placeholder ?? "Via, numero civico…"}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      {cercando && !aperto && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] text-muted-foreground">
          cerco…
        </span>
      )}
      {aperto && suggerimenti.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggerimenti.map((s, i) => (
            <li key={`${s.esteso}-${i}`}>
              <button
                type="button"
                //  `onMouseDown` e non `onClick`: il clic arriva dopo il blur,
                //  e a quel punto la tendina non c'è più.
                onMouseDown={(e) => {
                  e.preventDefault();
                  scelto(s);
                  onScelto(s);
                }}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left text-[12.5px] transition",
                  "hover:bg-slate-50",
                )}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0">
                  <span className="block font-medium">
                    {[s.indirizzo, s.civico].filter(Boolean).join(" ")}
                  </span>
                  <span className="block text-[11.5px] text-muted-foreground">
                    {[s.cap, s.comune, s.provincia && `(${s.provincia})`].filter(Boolean).join(" ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
