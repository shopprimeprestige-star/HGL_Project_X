/** ── LA PASTIGLIA CHE DICE ANCHE QUANDO ────────────────────────────────────
 *
 *  Richiesta del committente: passando sopra lo stato di un lead che ha una
 *  data fissata — un ricontatto, una consulenza, un appuntamento in sede —
 *  deve uscire il giorno, e quanti giorni mancano o di quanti è in ritardo.
 *
 *  ── ⚠️ PERCHÉ NON BASTAVA IL `title` DEL BROWSER ─────────────────────────
 *  Il fumetto di sistema arriva dopo un secondo e mezzo, non si può toccare,
 *  e sul telefono non esiste. Ma soprattutto non ci si può mettere dentro un
 *  pulsante — e le due cose che si vogliono fare dopo aver letto «in ritardo
 *  di 12 giorni» sono sempre le stesse due: dichiararlo risolto, o segnarlo
 *  da tenere d'occhio.
 *
 *  ── ⚠️ LE DUE AZIONI NON SONO NUOVE, E NON DEVONO ESSERLO ────────────────
 *  «Contattato e risolto» è il COMPIMENTO dello stato (crm/QuickStatusDialog,
 *  `compimentoDi`): la stessa cosa che fa la spunta accanto alla pastiglia, e
 *  che porta il lead al passo dichiarato per quello stato.
 *  «Da tenere d'occhio» è `highlighted`, cioè la stella che il CRM ha da
 *  sempre e che tutte le altre schermate già mostrano.
 *  Inventare qui un terzo concetto — un campo «risolto» suo — avrebbe voluto
 *  dire due verità sulla stessa riga: la spunta accesa e il fumetto che dice
 *  di no, o il contrario. Si riusa quello che c'è, e si scrive con parole più
 *  chiare di un'icona.
 *
 *  ⚠️ SI APRE ANCHE AL TOCCO. `Popover` di Radix apre al clic, che sul
 *   telefono è il tocco: la stessa porta funziona con e senza mouse, e non
 *   servono due comportamenti da tenere d'accordo.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";
import { CalendarClock, Check, Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "./types";
import { giorniDaOggi, prossimaAzione, TONO_AZIONE } from "./ui";
import { compimentoDi } from "./QuickStatusDialog";

/** Il giorno per esteso: «giovedì 20 agosto». */
const GIORNO_LUNGO = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Quanti giorni mancano, o di quanti è in ritardo, detto come lo direbbe una
 *  persona. ⚠️ Si conta con `giorniDaOggi`, lo stesso di tutto il resto del
 *  CRM: un secondo modo di contare i giorni vorrebbe dire una riga che dice
 *  «fra 3» e una colonna accanto che dice «fra 2». */
function quantoManca(iso: string): string {
  const g = giorniDaOggi(iso);
  if (Number.isNaN(g)) return "";
  if (g === 0) return "è oggi";
  if (g === 1) return "è domani";
  if (g === -1) return "era ieri";
  if (g < 0) return `in ritardo di ${-g} giorni`;
  return `fra ${g} giorni`;
}

export function FumettoStato({
  lead,
  onCompimento,
  onEvidenzia,
  children,
  className,
}: {
  lead: Lead;
  /** Dichiara fatto il passo di questo stato. Assente = il pulsante non c'è. */
  onCompimento?: (l: Lead) => void;
  /** Accende o spegne la stella. Assente = il pulsante non c'è. */
  onEvidenzia?: (l: Lead) => void;
  /** La pastiglia da avvolgere. */
  children: ReactNode;
  className?: string;
}) {
  const az = prossimaAzione(lead);
  const stato = lead.data?.stato as LeadStatus | undefined;
  const passo = compimentoDi(stato);
  const evidenziato = lead.data?.highlighted === true;

  /*  ⚠️ SENZA UNA DATA NON SI AVVOLGE NIENTE. Un fumetto che si apre per dire
      «nessuna data» è una porta che si impara ad aprire e poi a non aprire
      più — e intanto ruba il clic alla pastiglia, che serve a cambiare stato.
      Su quelle righe la pastiglia resta esattamente com'era. */
  if (!az.quando) return <>{children}</>;

  const manca = quantoManca(az.giorno);
  const d = new Date(`${az.giorno}T12:00:00`);
  const giornoLungo = Number.isNaN(d.getTime()) ? az.quando : GIORNO_LUNGO.format(d);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className={cn("inline-flex min-w-0 cursor-pointer", className)}>{children}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[19rem] p-0">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {LEAD_STATUS_LABEL[stato as LeadStatus] ?? stato}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[13.5px] font-medium">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {az.cosa}
          </p>
          {/*  ⚠️ LA DATA VERA E IL CONTO DEI GIORNI, non due volte la stessa
              cosa. La prima versione scriveva «in ritardo di 12 g · 11:00 · è
              in ritardo di 12 giorni»: il relativo detto due volte e il giorno
              mai. «Fra 3 giorni» non dice che giorno segnare in agenda, «gio
              12 set» costringe a fare il conto col calendario. Servono tutte e
              due, ed è il motivo per cui questo fumetto esiste. */}
          <p className="mt-0.5 text-[13px] font-medium">
            {giornoLungo}
            {az.ora ? ` · ${az.ora}` : ""}
          </p>
          {manca && <p className={cn("mt-0.5 text-[12.5px]", TONO_AZIONE[az.tono])}>{manca}</p>}
        </div>

        {(onCompimento || onEvidenzia) && (
          <div className="flex flex-col p-1.5">
            {onCompimento && passo && (
              <button
                type="button"
                onClick={() => onCompimento(lead)}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-muted"
              >
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium">Contattato e risolto</span>
                  {/*  Si dice DOVE va a finire: «risolto» da solo non basta —
                      chi lo preme deve sapere in che stato si ritrova la
                      scheda un secondo dopo. */}
                  <span className="block text-[11.5px] leading-snug text-muted-foreground">
                    {passo.spiega} → {LEAD_STATUS_LABEL[passo.stato] ?? passo.stato}
                  </span>
                </span>
              </button>
            )}
            {onEvidenzia && (
              <button
                type="button"
                onClick={() => onEvidenzia(lead)}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-muted"
              >
                <Star
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    evidenziato ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium">
                    {evidenziato ? "Non tenerlo più d'occhio" : "Da tenere d'occhio"}
                  </span>
                  <span className="block text-[11.5px] leading-snug text-muted-foreground">
                    {evidenziato
                      ? "Torna una riga come le altre"
                      : "Resta in cima e con la stella, finché non lo togli"}
                  </span>
                </span>
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
