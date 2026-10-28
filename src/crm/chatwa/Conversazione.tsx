import { useEffect, useRef } from "react";
import { AlertCircle, Check, CheckCheck, MessageCircle, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
//  Il selettore di stato è uno solo in tutto il CRM (crm/SelettoreStatoDialog):
//  qui c'era una tendina che ignorava `statiPer`.
import { PastigliaStato } from "@/crm/SelettoreStatoDialog";
import { Casella } from "./Casella";
import { formatTimeIT, initials } from "./formati";
import type { BollaProps, ConversazioneProps } from "./tipi";

/** Una bolla di messaggio. */
function Bolla({ messaggio: m }: BollaProps) {
  const fromMe = m.direction === "outbound";
  return (
    <div
      className={cn(
        "max-w-[78%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed shadow-sm border",
        fromMe
          ? "self-end bg-emerald-500 text-white border-emerald-500 rounded-br-sm"
          : "self-start bg-card text-foreground border-border rounded-bl-sm",
      )}
    >
      <p className="whitespace-pre-wrap">{m.body}</p>
      <div
        className={cn(
          "flex items-center gap-1 mt-1 text-[10px]",
          fromMe ? "justify-end text-white/80" : "justify-end text-muted-foreground",
        )}
      >
        <span>{formatTimeIT(m.created_at)}</span>
        {fromMe && m.status === "read" && <CheckCheck className="h-3 w-3 text-sky-200" />}
        {fromMe && m.status === "delivered" && <CheckCheck className="h-3 w-3" />}
        {fromMe && (m.status === "sent" || m.status === "queued") && <Check className="h-3 w-3" />}
        {fromMe && m.status === "failed" && (
          <AlertCircle className="h-3 w-3 text-rose-200" aria-label={m.error_message ?? "errore"} />
        )}
      </div>
    </div>
  );
}

/** La chat aperta: testata, messaggi e casella. Riempie il contenitore che le dà
 *  `PaginaChat` (R12). */
export function Conversazione({ api, onApriLead }: ConversazioneProps) {
  const { attiva, messaggi, cambiaStato, elimina } = api;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll bottom su nuovi messaggi
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messaggi.length, attiva?.phone]);

  return (
    <section className="w-full h-full flex flex-col min-w-0 bg-muted/30">
      {!attiva ? (
        <div className="flex-1 grid place-items-center text-center px-6">
          <div className="max-w-md">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 grid place-items-center mb-3 border border-emerald-100">
              <MessageCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-foreground text-base font-semibold">Seleziona una chat</h2>
            <p className="mt-1.5 text-muted-foreground text-[13px] leading-relaxed">
              Le conversazioni arrivano in tempo reale dal webhook Meta e si collegano ai lead del
              CRM tramite numero di telefono.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Chat header */}
          <div className="px-4 py-2 bg-card border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={onApriLead}
              className="flex items-center gap-2.5 min-w-0 text-left rounded-md hover:bg-muted/60 transition-colors px-1.5 py-1 -mx-1.5"
              title={
                attiva.lead ? "Modifica dati lead" : "Schedula meet / crea lead da questo numero"
              }
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                  {attiva.lead ? initials(attiva.lead.data.nome, attiva.lead.data.cognome) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-foreground truncate leading-tight">
                  {attiva.lead
                    ? `${attiva.lead.data.nome} ${attiva.lead.data.cognome}`
                    : attiva.contact?.display_name || "Sconosciuto"}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate leading-tight mt-0.5">
                  {attiva.phone}
                  <span className="ml-2 text-emerald-600 font-sans not-italic">
                    {attiva.lead ? "· modifica" : "· crea lead"}
                  </span>
                </div>
              </div>
            </button>
            <div className="flex items-center gap-1.5">
              {/* ── LO STATO SI CAMBIA DALLA PASTIGLIA ──────────────────
                  È la stessa finestra a griglia di tutto il CRM. Prima era
                  una tendina che elencava `SELECTABLE_LEAD_STATUSES`, cioè
                  la lista FISSA: a un lead importato ancora da chiamare
                  proponeva gli stati della trattativa, che è esattamente il
                  guasto che `statiPer` esiste per impedire. */}
              {attiva.lead && (
                <PastigliaStato
                  dati={attiva.lead.data}
                  contesto={
                    `${attiva.lead.data.nome ?? ""} ${attiva.lead.data.cognome ?? ""}`.trim() ||
                    undefined
                  }
                  onScegli={(s) => void cambiaStato(s)}
                />
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => void elimina()}
                className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                title="Elimina chat (solo lato CRM)"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
            <div className="mx-auto max-w-2xl flex flex-col gap-1.5">
              {messaggi.length === 0 ? (
                <div className="self-center bg-card border border-border text-muted-foreground text-[11px] px-3 py-1 rounded-md mt-4">
                  Nessun messaggio ancora · scrivi il primo
                </div>
              ) : (
                messaggi.map((m) => <Bolla key={m.id} messaggio={m} />)
              )}
            </div>
          </div>

          <Casella api={api} />
        </>
      )}
    </section>
  );
}
