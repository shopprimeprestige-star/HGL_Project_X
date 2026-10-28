import { CheckCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_COLOR, LEAD_STATUS_LABEL } from "@/crm/types";
import { useCRM } from "@/crm/CRMContext";
import { corpoLeggibile } from "@/crm/testo-modello";
import { anteprimaIn } from "./media";
import { attesaInChiaro } from "./stato";
import { formatTimeIT, initials } from "./formati";
import type { ChatItem } from "./tipi";

/** Come si disegna una riga: normale, in attesa di risposta, o attenuata (oltre 7 giorni, R10). */
export type ModoRiga = "normale" | "attesa" | "vecchia";

/** Il testo di una riga dell'elenco: anteprima come nella bolla (🎤 Vocale, «Messaggio non
 *  leggibile») su UNA riga sola. Nota 3 del revisore su T2: `anteprimaIn` lascia a capo e tab. */
function anteprimaRiga(testo: string | null | undefined): string {
  return anteprimaIn(testo ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nome da mostrare: scheda, poi nome salvato, poi il numero. */
function nomeChat(c: ChatItem): string {
  const scheda = c.lead ? `${c.lead.data.nome} ${c.lead.data.cognome}`.trim() : "";
  return scheda || c.contact?.display_name || c.phone;
}

interface RigaChatProps {
  chat: ChatItem;
  modo: ModoRiga;
  attiva: boolean;
  adesso: number;
  onApri: () => void;
  onCreaScheda: () => void;
  onAbbina: () => void;
}

/** Una chat nell'elenco. La riga è un solo bottone; «Crea scheda» e «Abbina» stanno
 *  sotto, fuori dal bottone (un bottone dentro un bottone non è valido e sul telefono
 *  prende il tocco sbagliato). Il nome ha sempre la riga tutta per sé: pastiglia di
 *  stato e numero vanno sotto, così non lo schiacciano. */
export function RigaChat({
  chat: c,
  modo,
  attiva,
  adesso,
  onApri,
  onCreaScheda,
  onAbbina,
}: RigaChatProps) {
  const nome = nomeChat(c);
  const last = c.lastMessage;
  const inAttesa = modo !== "normale";
  const ambigua = c.schedaAmbigua === true;
  const senzaScheda = !c.lead && (c.senzaScheda ?? true);

  // `dal` c'è sempre se la chat è in attesa; se mancasse, meglio l'ora dell'ultimo messaggio che un «da meno di 1 min» falso.
  const dal = inAttesa ? (c.daRispondere?.dal ?? null) : null;
  const tempo = dal
    ? attesaInChiaro(dal, adesso)
    : formatTimeIT(last?.created_at ?? c.contact?.last_message_at ?? null);
  const { consultants } = useCRM();
  //  Un nostro modello («[template:nome]») si legge col suo testo, come nella bolla.
  const ultimo =
    last?.direction === "outbound"
      ? corpoLeggibile(
          last.body,
          c.lead?.data,
          consultants.find((x) => x.id === c.lead?.data?.consulenteId)?.data.nome ?? null,
          c.lead?.id,
        ).testo
      : last?.body;
  const anteprima = anteprimaRiga(inAttesa ? (c.daRispondere?.anteprima ?? ultimo) : ultimo);

  return (
    <li className={cn("border-b border-border", attiva ? "bg-emerald-50/60" : "")}>
      <button
        type="button"
        onClick={onApri}
        aria-current={attiva ? "true" : undefined}
        className="flex w-full min-h-[72px] items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Avatar className="h-11 w-11 shrink-0">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
            {c.lead ? initials(c.lead.data.nome, c.lead.data.cognome) : "?"}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[15px] font-semibold md:text-[13px]",
                modo === "vecchia" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {nome}
            </span>
            <span
              className={cn(
                "shrink-0 whitespace-nowrap text-[12px] tabular-nums md:text-[11px]",
                modo === "attesa" ? "font-semibold text-amber-700" : "text-muted-foreground",
              )}
            >
              {tempo}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground md:text-[12px]">
              {!inAttesa && last?.direction === "outbound" && (
                <CheckCheck
                  aria-hidden="true"
                  className={cn(
                    "mr-1 inline h-3.5 w-3.5 align-[-2px]",
                    last.status === "read" ? "text-sky-600" : "text-muted-foreground",
                  )}
                />
              )}
              {anteprima}
            </span>
            {c.unread > 0 && (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold leading-none text-white">
                {c.unread > 99 ? "99+" : c.unread}
                <span className="sr-only"> non letti</span>
              </span>
            )}
          </span>
          {(c.lead || nome !== c.phone) && (
            <span className="mt-1 flex items-center gap-2">
              {c.lead && (
                <span
                  className={cn(
                    "inline-flex min-w-0 items-center truncate rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
                    LEAD_STATUS_COLOR[c.lead.data.stato],
                  )}
                >
                  <span className="truncate">{LEAD_STATUS_LABEL[c.lead.data.stato]}</span>
                </span>
              )}
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {c.phone}
              </span>
            </span>
          )}
        </span>
      </button>

      {(senzaScheda || ambigua) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-3 pl-[68px] pr-3">
          <span className="text-[12px] text-muted-foreground">
            {ambigua ? "Più schede con questo numero" : "Numero senza scheda"}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {!ambigua && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onCreaScheda}
                className="h-11 px-3 text-[13px] md:h-8 md:text-xs"
              >
                Crea scheda
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAbbina}
              className="h-11 px-3 text-[13px] md:h-8 md:text-xs"
            >
              Abbina a una scheda
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
