/** ── STATO VUOTO (V1 · T83, documento §4.7) ───────────────────────────────────
 *  Icona in tondo, un titolo, una o due righe, e fino a tre ingressi (un pieno, un contorno, un link). Centrato, `max-w-md`,
 *  mai un'illustrazione, mai un riquadro grigio. Non scrive nessuna parola: i testi li dà chi lo usa (da `testi-shop`).
 *  Lo usano il carrello vuoto, la ricerca senza risultati, i filtri senza risultati; `StatoErrore` e le pagine 404/500 lo estendono. */
import { Link } from "@tanstack/react-router";
import { Inbox, type LucideIcon } from "lucide-react";

export type AspettoAzione = "pieno" | "contorno" | "link";

/** Un ingresso: un indirizzo (link) OPPURE una funzione (bottone). Mai né l'uno né l'altra: un bottone che non fa niente è peggio di nessun bottone. */
export type AzioneStato = { testo: string; aspetto?: AspettoAzione } & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);

//  Notte `#0A1430` (bianco sopra: 18,2:1), un solo pieno per schermo; il link usa il blu scuro del marchio (5:1 su bianco).
const BASE = "inline-flex items-center justify-center text-sm transition-colors shop-anello";
const ASPETTI: Record<AspettoAzione, string> = {
  pieno: `${BASE} min-h-12 w-full rounded-md bg-[#0A1430] font-semibold px-6 text-white hover:bg-[#1B2A4E] sm:w-auto sm:min-w-48`,
  contorno: `${BASE} min-h-12 w-full rounded-md border-2 font-semibold border-[#0A1430] px-6 text-[#0A1430] hover:bg-ink/5 sm:w-auto sm:min-w-48`,
  link: `${BASE} min-h-11 px-2 font-medium text-brand-scuro underline underline-offset-4 hover:text-ink`,
};

function Ingresso({ azione }: { azione: AzioneStato }) {
  const aspetto = azione.aspetto ?? "contorno";
  if (azione.href !== undefined)
    return (
      <Link to={azione.href} data-aspetto={aspetto} className={ASPETTI[aspetto]}>
        {azione.testo}
      </Link>
    );
  return (
    <button type="button" onClick={azione.onClick} data-aspetto={aspetto} className={ASPETTI[aspetto]}>
      {azione.testo}
    </button>
  );
}

export interface StatoVuotoProps {
  titolo: string;
  /** Una riga (o più): un testo `null` o vuoto non si disegna. */
  testo?: string | null | readonly (string | null)[];
  azioni?: readonly AzioneStato[];
  icona?: LucideIcon;
  /** `h2` di norma; `h1` quando lo stato è tutta la pagina (404, 500). */
  livello?: "h1" | "h2";
}

export function StatoVuoto({ titolo, testo, azioni = [], icona: Icona = Inbox, livello = "h2" }: StatoVuotoProps) {
  const Titolo = livello;
  const righe = ([] as (string | null | undefined)[]).concat(testo as never).filter((r): r is string => typeof r === "string" && r.trim() !== "");
  return (
    <div data-stato="vuoto" className="mx-auto flex w-full max-w-md flex-col items-center text-center">
      <span aria-hidden="true" className="grid size-[52px] place-items-center rounded-full bg-[#0A1430] text-white">
        <Icona aria-hidden="true" className="size-6" />
      </span>
      <Titolo className="mt-5 text-balance text-2xl font-semibold tracking-tight text-ink">{titolo}</Titolo>
      {righe.map((riga) => (
        <p key={riga} className="mt-2 text-base leading-relaxed text-ink-muted">
          {riga}
        </p>
      ))}
      {azioni.length > 0 && (
        <div className="mt-6 flex w-full flex-col items-center gap-3 sm:w-auto">
          {azioni.map((a) => (
            <Ingresso key={a.testo} azione={a} />
          ))}
        </div>
      )}
    </div>
  );
}
