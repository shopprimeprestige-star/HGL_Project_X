/** ── LA TARGHETTA E LA RIGA «POI» ──────────────────────────────────────────
 *
 *  La lista «Da chiamare» è ordinata bene, ma l'ordine da solo chiede fiducia:
 *  la setter si chiede perché quel nome è davanti all'altro. La targhetta lo
 *  scrive: PROMESSA, DI RITORNO, NUOVO, È LA SUA ORA, PRIMA CHIAMATA, RITENTO,
 *  con accanto il motivo in poche parole («richiamo alle 15:00, scaduto da
 *  1 h»). I testi sono di `chi-chiamare.ts` e sono provati: qui si disegnano.
 *
 *  ⚠️ I COLORI SONO QUELLI CHE LA PAGINA USA GIÀ e significano la stessa cosa:
 *   rosso = una promessa che scade, ambra = c'è una decisione in sospeso (il
 *   ritorno), cielo = novità, verde = è il momento giusto, grigio = lavoro di
 *   routine. Il nome del motivo è sempre scritto: il colore aiuta, non basta
 *   (chi non distingue i colori legge la parola).
 *  ⚠️ «CALDO» È UNA PAROLA, NON UN'EMOJI NÉ UN COLORE IN PIÙ: si vede a colpo
 *   d'occhio ma non fa concorrenza alla targhetta, che è la risposta alla
 *   domanda «perché lui adesso?».
 *  ───────────────────────────────────────────────────────────────────────── */
import { ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASSE_BADGE_STATO } from "@/crm/ui";
import type { Lead, LeadData, MotivoChiamata } from "@/crm/types";
import { NOME_MOTIVO, type MotivoDiChiamata } from "./chi-chiamare";

const CLASSE_MOTIVO: Record<MotivoChiamata, string> = {
  promessa: "border-rose-300 bg-rose-50 text-rose-700",
  ritorno: "border-amber-300 bg-amber-50 text-amber-800",
  nuovo: "border-sky-300 bg-sky-50 text-sky-800",
  suaOra: "border-emerald-300 bg-emerald-50 text-emerald-800",
  prima: "border-slate-300 bg-slate-100 text-slate-700",
  ritento: "border-border bg-muted text-muted-foreground",
};

/** Il motivo, scritto: la parola in targhetta, il perché accanto, «caldo» se lo è. */
export function Targhetta({ motivo, className }: { motivo: MotivoDiChiamata; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5", className)}>
      <span
        className={cn(CLASSE_BADGE_STATO, "shrink-0 font-semibold", CLASSE_MOTIVO[motivo.motivo])}
      >
        {NOME_MOTIVO[motivo.motivo]}
      </span>
      <span className="min-w-0 text-[12px] text-muted-foreground">{motivo.testo}</span>
      {motivo.caldo && (
        <span
          className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-orange-700"
          title="Vuole risolvere subito o ha già provato qualcosa"
        >
          caldo
        </span>
      )}
    </span>
  );
}

/** Una riga dell'elenco «Poi»: chi è, perché è lì, cosa ha risposto nel modulo. */
export function RigaChiamata({
  lead,
  motivo,
  riassunto,
  annuncio,
  posizione,
  giaProvato,
  diRitorno,
  onScegli,
}: {
  lead: Lead;
  motivo: MotivoDiChiamata;
  /** `riassuntoModulo(...)`: Problema e Fastidio. Vuoto se non c'è. */
  riassunto: string;
  /** «Annuncio · Gruppo», già scritto. Vuoto se non c'è. */
  annuncio: string;
  /** Il posto nella lista: 2, 3, 4… (il numero 1 è la scheda grande). */
  posizione: number;
  /** Toccato in questo giro: è sceso in fondo. */
  giaProvato: boolean;
  /** Riportato a galla dal file appena letto in questa schermata. */
  diRitorno: boolean;
  onScegli: () => void;
}) {
  const d = lead.data ?? ({} as LeadData);
  const nome = `${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome";
  return (
    <li>
      <button
        type="button"
        onClick={onScegli}
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-accent/60"
      >
        <span
          className="mt-0.5 w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted-foreground"
          aria-hidden="true"
        >
          {posizione}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-[13px] font-medium">
              {nome}
              {diRitorno && (
                <RotateCcw
                  className="ml-1.5 inline h-3 w-3 -translate-y-px text-amber-600"
                  aria-label="Riportato a galla dal file appena caricato"
                />
              )}
            </span>
            <Targhetta motivo={motivo} />
          </span>
          {/*  Sul telefono la riga va a capo (due righe): una sola tagliava Fastidio e
              Annuncio, che sono il motivo per cui si sceglie quel nome. */}
          <span className="mt-0.5 block line-clamp-2 text-[11.5px] text-muted-foreground sm:line-clamp-1">
            {[
              d.telefono || "senza telefono",
              riassunto || null,
              annuncio || null,
              giaProvato ? "già provato" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {/*  ⚠️ Qui c'era anche l'etichetta dello stato («Richiamo concordato»,
             «Da contattare»): diceva quasi la stessa cosa della targhetta del
             motivo, due etichette per riga. Tolta su richiesta del titolare
             (14/10); lo stato resta nella scheda grande e nella scheda del lead. */}
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}
