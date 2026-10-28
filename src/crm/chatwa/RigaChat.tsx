import { useState } from "react";
import { CheckCheck, ChevronDown, Phone, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_COLOR, LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "@/crm/types";
import { FinestraStati, statiSelezionabili } from "@/crm/SelettoreStatoDialog";
import { numeroDaComporre } from "@/crm/importa/chiamare";
import { STATI_CAMBIO_RAPIDO } from "./daChiamare";
import { useCRM } from "@/crm/CRMContext";
import { corpoLeggibile } from "@/crm/testo-modello";
import { TemperaturaRiga } from "@/crm/Temperatura";
import { mostraTemperatura } from "@/crm/temperatura-lead";
import { anteprimaIn } from "./media";
import { attesaInChiaro } from "./stato";
import { ritornoInChat } from "./ritorno";
import { formatTimeIT, initials, numeroLeggibile } from "./formati";
import type { ChatItem } from "./tipi";

/** Come si disegna una riga: normale, in attesa di risposta, o attenuata (oltre 7 giorni, R10). */
export type ModoRiga = "normale" | "attesa" | "vecchia" | "chiamare";

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
  return scheda || c.contact?.display_name || numeroLeggibile(c.phone);
}

interface RigaChatProps {
  chat: ChatItem;
  modo: ModoRiga;
  attiva: boolean;
  adesso: number;
  onApri: () => void;
  onCreaScheda: () => void;
  onAbbina: () => void;
  /** Le stelle di priorità (0-3) e il tocco che le cambia (vedi useStelle). */
  stelle?: number;
  onStelle?: () => void;
  /** Cambia lo stato del lead dalla riga (salvataggio condiviso: useChatWa.cambiaStatoLead). */
  onCambiaStato?: (lead: Lead, stato: LeadStatus) => void;
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
  stelle = 0,
  onStelle,
  onCambiaStato,
}: RigaChatProps) {
  const [cambiaStato, setCambiaStato] = useState(false);
  const nome = nomeChat(c);
  //  Il numero sotto il nome, anche per gli sconosciuti; se il nome È già il numero non si ripete.
  const numero = numeroLeggibile(c.phone);
  const numeroSotto = nome !== numero;
  const telefono = numeroDaComporre(c.phone);
  //  Gli stati di chiamata che la regola del CRM (`statiPer`) ammette per QUESTO lead.
  const ammessi = new Set(c.lead ? statiSelezionabili(c.lead.data) : []);
  const opzioniStato = STATI_CAMBIO_RAPIDO.filter((s) => ammessi.has(s));
  const last = c.lastMessage;
  const inAttesa = modo === "attesa" || modo === "vecchia";
  const daChiamare = modo === "chiamare";
  const ambigua = c.schedaAmbigua === true;
  const senzaScheda = !c.lead && (c.senzaScheda ?? true);

  // `dal` c'è sempre se la chat è in attesa; se mancasse, meglio l'ora dell'ultimo messaggio che un «da meno di 1 min» falso.
  const dal = inAttesa
    ? (c.daRispondere?.dal ?? null)
    : daChiamare
      ? (c.daChiamare?.dal ?? null)
      : null;
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
  const anteprima = daChiamare
    ? "In attesa su WhatsApp da oltre 10 ore: da chiamare"
    : anteprimaRiga(inAttesa ? (c.daRispondere?.anteprima ?? ultimo) : ultimo);
  const ritorno = c.lead ? ritornoInChat(c.lead.data) : null;

  return (
    <li className={cn("relative border-b border-border", attiva ? "bg-emerald-50/60" : "")}>
      <button
        type="button"
        onClick={onApri}
        aria-current={attiva ? "true" : undefined}
        className={cn(
          "flex w-full min-h-[72px] items-start gap-3 py-3 pl-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          //  Con la cornetta a destra (44 px) il testo si ferma prima.
          c.lead && telefono ? "pr-14" : "pr-3",
        )}
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
                modo === "attesa"
                  ? "font-semibold text-amber-700"
                  : daChiamare
                    ? "font-semibold text-sky-700"
                    : "text-muted-foreground",
              )}
            >
              {tempo}
            </span>
          </span>
          {numeroSotto && (
            <span className="block truncate text-[12px] tabular-nums text-muted-foreground md:text-[11px]">
              {numero}
            </span>
          )}
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
        </span>
      </button>

      {/*  ── CORNETTA (28/10/2026) ───────────────────────────────────────────
          Su ogni riga con la scheda: apre il compositore con il numero (sul Mac lo
          passa all'iPhone). Fuori dal bottone della riga e con stopPropagation, così
          non apre la chat; 44 px di tocco sul telefono. */}
      {c.lead && telefono && (
        <Button
          asChild
          variant="ghost"
          className="absolute right-1 top-2 h-11 w-11 p-0 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 md:h-9 md:w-9"
        >
          <a
            href={`tel:${telefono}`}
            aria-label={`Chiama ${nome}`}
            title={`Chiama ${nome}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Phone aria-hidden="true" className="h-5 w-5 md:h-4 md:w-4" />
          </a>
        </Button>
      )}

      {/*  ── STATO, RITORNO, TEMPERATURA E STELLE ────────────────────────────
          Sotto il bottone della riga e non dentro: lo stato si cambia da qui (un
          bottone dentro un bottone non è valido e sul telefono prende il tocco
          sbagliato). Il tasto dello stato apre la STESSA finestra del resto del CRM
          (FinestraStati) con gli stati di chiamata; il salvataggio è `onCambiaStato`. */}
      {(c.lead || onStelle) && (
        <div className="flex items-center gap-2 pb-1 pl-[68px] pr-2">
          {c.lead && (
            <button
              type="button"
              onClick={() => setCambiaStato(true)}
              aria-haspopup="dialog"
              aria-label={`Stato: ${LEAD_STATUS_LABEL[c.lead.data.stato]}. Cambialo`}
              title={`${LEAD_STATUS_LABEL[c.lead.data.stato]} · cambia stato`}
              className="inline-flex h-11 min-w-0 shrink items-center focus-visible:outline-none md:h-7"
            >
              <span
                className={cn(
                  "inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium leading-none",
                  LEAD_STATUS_COLOR[c.lead.data.stato],
                )}
              >
                <span className="truncate">{LEAD_STATUS_LABEL[c.lead.data.stato]}</span>
                <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
              </span>
            </button>
          )}
          {/*  Di ritorno (28/10/2026): nella riga solo «↩ Ritorno», lo stato di
              prima nell'intestazione della chat e nel tooltip. */}
          {ritorno && (
            <span
              className="shrink-0 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-none text-amber-700"
              title={ritorno.titolo}
            >
              <span className="sm:hidden" aria-label={ritorno.corta}>
                ↩
              </span>
              <span className="hidden sm:inline">{ritorno.corta}</span>
            </span>
          )}
          {/*  Com'è messo il cliente (28/10/2026): pallino e parola, niente risposte
              brevi (la riga è stretta; le risposte sono nel tasto info della chat). */}
          {c.lead && mostraTemperatura(c.lead.data.stato) && (
            <TemperaturaRiga dati={c.lead.data} max={0} className="shrink-0 text-[11px]" />
          )}
          <span className="flex-1" />
          {/*  ── LE STELLE, DALLA LISTA (28/10/2026) ───────────────────────────
              Un tocco ne aggiunge una (0 → 1 → 2 → 3 → 0). */}
          {onStelle && (
            <button
              type="button"
              onClick={onStelle}
              className="inline-flex h-11 shrink-0 items-center gap-0.5 rounded-md px-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-7"
              aria-label={`Priorità di ${nome}: ${stelle} su 3. Tocca per cambiare`}
              title={
                stelle
                  ? `In osservazione: ${stelle} su 3 · tocca per cambiare`
                  : "Metti in osservazione"
              }
            >
              {[1, 2, 3].map((i) => (
                <Star
                  key={i}
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4",
                    i <= stelle ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40",
                  )}
                />
              ))}
            </button>
          )}
        </div>
      )}
      {c.lead && (
        <FinestraStati
          aperta={cambiaStato}
          onChiudi={() => setCambiaStato(false)}
          stato={c.lead.data.stato}
          opzioni={opzioniStato}
          contesto={`${nome} · adesso: ${LEAD_STATUS_LABEL[c.lead.data.stato]}`}
          onScegli={(s) => {
            setCambiaStato(false);
            if (c.lead) onCambiaStato?.(c.lead, s);
          }}
        />
      )}

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
