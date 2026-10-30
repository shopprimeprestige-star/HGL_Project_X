import { CheckCheck, CheckCircle2, Loader2, Mail, Star, X } from "lucide-react";
import type { AzioneBlocco } from "./selezione";

/** Le azioni in blocco, nell'ordine in cui si leggono: prima le due «letto», poi le altre. */
const AZIONI: { v: AzioneBlocco; etichetta: string; Icona: typeof Mail }[] = [
  { v: "letto", etichetta: "Segna come letto", Icona: CheckCheck },
  { v: "da-leggere", etichetta: "Segna come da leggere", Icona: Mail },
  { v: "fatto", etichetta: "Fatto", Icona: CheckCircle2 },
  { v: "osservazione", etichetta: "In osservazione", Icona: Star },
];

interface TestataProps {
  /** Le chat scelte che l'elenco mostra ancora. */
  quante: number;
  /** Tutte le visibili sono scelte? Il tasto allora toglie la selezione. */
  tutte: boolean;
  /** Un'azione è in corso: i tasti si fermano (niente doppio tocco). */
  occupata: boolean;
  onTutte: () => void;
  onAnnulla: () => void;
}

/** ── LA SELEZIONE, IN DUE PEZZI (30/10/2026) ───────────────────────────────
 *  In CIMA, al posto del titolo «Chat» e della stessa altezza: quante sono scelte,
 *  «Seleziona tutto» (le chat che si vedono) e «Annulla». Le righe sotto non si spostano
 *  quando si accende la selezione: sotto il dito della pressione lunga non scatta niente.
 *  IN FONDO, sotto l'elenco, le azioni: col pollice si raggiungono, e sul telefono
 *  non coprono i nomi. Tocchi da 44 px sul telefono, più stretti dal computer.
 *  Niente colori nuovi: il verde è quello delle spunte. */
export function TestataSelezione({ quante, tutte, occupata, onTutte, onAnnulla }: TestataProps) {
  return (
    <div className="flex items-center gap-1 bg-emerald-50/70 px-3 pb-1 pt-3 md:px-2 md:py-2.5">
      <p
        role="status"
        className="min-w-0 flex-1 truncate text-[17px] font-semibold text-foreground md:text-[13px]"
      >
        {quante === 0 ? "Nessuna selezionata" : `${quante} selezionat${quante === 1 ? "a" : "e"}`}
      </p>
      <button
        type="button"
        onClick={onTutte}
        disabled={occupata}
        className="-my-2 inline-flex h-11 shrink-0 items-center rounded-md px-3 text-[14px] font-medium text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:my-0 md:h-7 md:px-2 md:text-[12px]"
      >
        {tutte ? "Deseleziona tutto" : "Seleziona tutto"}
      </button>
      <button
        type="button"
        onClick={onAnnulla}
        disabled={occupata}
        className="-my-2 inline-flex h-11 shrink-0 items-center gap-1 rounded-md px-3 text-[14px] font-medium text-foreground hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:my-0 md:h-7 md:px-2 md:text-[12px]"
      >
        <X aria-hidden="true" className="h-4 w-4" />
        Annulla
      </button>
    </div>
  );
}

interface AzioniProps {
  quante: number;
  inCorso: AzioneBlocco | null;
  onAzione: (a: AzioneBlocco) => void;
}

/** Le azioni sulle chat scelte: una fila che scorre di lato (bordo destro sfumato) come le pastiglie dei filtri. */
export function AzioniSelezione({ quante, inCorso, onAzione }: AzioniProps) {
  const occupata = inCorso !== null;
  return (
    <div
      role="group"
      aria-label="Cosa fare con le chat scelte"
      className="flex shrink-0 gap-2 overflow-x-auto overscroll-x-contain border-t border-border bg-emerald-50/70 px-3 py-2 [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] md:gap-1.5 md:px-2 md:py-1.5 [&::-webkit-scrollbar]:hidden"
    >
      {AZIONI.map(({ v, etichetta, Icona }) => (
        <button
          key={v}
          type="button"
          onClick={() => onAzione(v)}
          disabled={occupata || quante === 0}
          aria-busy={inCorso === v}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-background px-4 text-[14px] font-medium text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-8 md:px-3 md:text-[12px]"
        >
          {inCorso === v ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Icona aria-hidden="true" className="h-4 w-4" />
          )}
          {etichetta}
        </button>
      ))}
      <span aria-hidden="true" className="w-6 shrink-0" />
    </div>
  );
}
