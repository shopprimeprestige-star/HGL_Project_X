import { Fragment, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  Clock,
  MessageCircle,
  MoreVertical,
  Phone,
  Trash2,
  UserPlus,
  UserRound,
  Undo2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
//  Il selettore di stato è uno solo in tutto il CRM (crm/SelettoreStatoDialog):
//  qui c'era una tendina che ignorava `statiPer`.
import { PastigliaStato } from "@/crm/SelettoreStatoDialog";
import { numeroDaComporre } from "@/crm/importa/chiamare";
import { TemperaturaRiga } from "@/crm/Temperatura";
import { mostraTemperatura } from "@/crm/temperatura-lead";
import { BollaMessaggio } from "./BollaMessaggio";
import { InfoModulo } from "./InfoModulo";
import { Casella } from "./Casella";
import { initials } from "./formati";
import { attesaInChiaro } from "./stato";
import { ritornoInChat } from "./ritorno";
import { attaccataAllaPrecedente } from "./stile";
import type { ConversazioneProps } from "./tipi";

/** Il giorno di calendario a Roma («2026-10-28»): il CRM si legge con l'ora italiana da qualunque fuso. */
const giornoRoma = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

/** «Oggi», «Ieri», «lunedì 26 ottobre» (con l'anno se non è quello in corso). */
function etichettaGiorno(d: Date, adesso: Date): string {
  const giorno = (x: Date) => Date.parse(giornoRoma(x));
  const diff = Math.round((giorno(adesso) - giorno(d)) / 86_400_000);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Ieri";
  return d.toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(giornoRoma(d).slice(0, 4) !== giornoRoma(adesso).slice(0, 4) && { year: "numeric" }),
  });
}

/** La chat aperta: barra in alto, messaggi e casella. Riempie il contenitore che le dà
 *  `PaginaChat` (R12). Sul telefono è a tutto schermo e la freccia ← torna all'elenco. */
export function Conversazione({
  api,
  onIndietro,
  onApriLead,
  onCreaScheda,
  onAbbina,
}: ConversazioneProps) {
  const { attiva, messaggi, cambiaStato, elimina, segnaFatto } = api;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /** Si sta guardando la fine della chat (vedi l'effetto qui sotto). */
  const inFondo = useRef(true);

  // Auto-scroll bottom su nuovi messaggi
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    inFondo.current = true;
  }, [messaggi.length, attiva?.phone]);

  //  Come nell'app WhatsApp: se si stava guardando la fine della chat e l'area
  //  si accorcia (tastiera che si apre, risposte rapide sopra la casella), gli
  //  ultimi messaggi restano in vista. Se si stava leggendo più su, non si tocca.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const segna = () => {
      inFondo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    const osserva = new ResizeObserver(() => {
      if (inFondo.current) el.scrollTop = el.scrollHeight;
    });
    el.addEventListener("scroll", segna, { passive: true });
    osserva.observe(el);
    return () => {
      el.removeEventListener("scroll", segna);
      osserva.disconnect();
    };
  }, [attiva?.phone]);

  const adesso = new Date();
  const inAttesa = attiva?.daRispondere?.attesa === true;
  const ritorno = attiva?.lead ? ritornoInChat(attiva.lead.data) : null;

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
              Scegli una conversazione dall&apos;elenco per leggerla e rispondere dal CRM.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── LA BARRA DELLA CHAT, SU DUE RIGHE (28/10/2026) ──────────────────
              Richiesta del titolare: il numero di telefono sempre in vista, e un
              disegno pensato per telefono e tablet. In una riga sola nome, numero,
              stato, temperatura e cinque tasti non ci stavano: lo stato restava
              «A…» e il numero spariva sotto i 640 px.
              Riga 1: ← · avatar · nome e NUMERO · tasti (solo icona fino a 1024 px).
              Riga 2: stato, temperatura per esteso, «di ritorno» — scorre di lato
              se non ci sta, non va mai a capo. */}
          <div className="min-w-0 bg-card border-b border-border">
            <div className="px-2 md:px-4 pt-1.5 pb-1 flex items-center gap-1 md:gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={onIndietro}
                className="md:hidden h-11 w-11 shrink-0"
                aria-label="Torna all'elenco delle chat"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="hidden sm:flex h-10 w-10 shrink-0">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                  {attiva.lead ? initials(attiva.lead.data.nome, attiva.lead.data.cognome) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 pl-1 sm:pl-0">
                <div className="text-[16px] md:text-[14px] font-semibold text-foreground truncate leading-tight">
                  {attiva.lead
                    ? `${attiva.lead.data.nome} ${attiva.lead.data.cognome}`.trim()
                    : attiva.contact?.display_name || attiva.phone}
                </div>
                {/*  Il numero c'è sempre (anche sul telefono): è la prima cosa che si
                  guarda prima di chiamare o di dire «ti scrivo dal numero…». */}
                {(attiva.lead || attiva.contact?.display_name) && (
                  <div className="mt-0.5 truncate font-mono text-[12px] leading-tight text-muted-foreground tabular-nums">
                    {attiva.phone}
                  </div>
                )}
              </div>
              {/*  ── CHIAMA (28/10/2026) ─────────────────────────────────────
                Richiesta del titolare: il tasto per telefonare sopra la chat.
                Sul telefono apre il compositore con il numero; sul Mac lo
                passa all'iPhone (Continuità) o all'app che gestisce «tel:». */}
              {numeroDaComporre(attiva.phone) && (
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-11 lg:w-auto px-0 lg:px-3 shrink-0 md:h-9 md:w-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <a
                    href={`tel:${numeroDaComporre(attiva.phone)}`}
                    aria-label={`Chiama ${attiva.phone}`}
                    title={`Chiama ${attiva.phone}`}
                  >
                    <Phone className="h-4 w-4" />
                    <span className="hidden lg:inline">Chiama</span>
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onApriLead}
                className="h-11 w-11 lg:w-auto px-0 lg:px-3 shrink-0 md:h-9 md:w-9"
                aria-label={
                  attiva.lead ? "Apri la scheda del lead" : "Crea la scheda da questo numero"
                }
                title={attiva.lead ? "Modifica dati lead" : "Crea lead da questo numero"}
              >
                {attiva.lead ? <UserRound className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                <span className="hidden lg:inline">{attiva.lead ? "Scheda" : "Crea scheda"}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 md:h-9 md:w-9 shrink-0"
                    aria-label="Altre azioni sulla chat"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  {!attiva.lead && (
                    <>
                      <DropdownMenuItem
                        className="min-h-11 md:min-h-0"
                        onSelect={() => onCreaScheda(attiva)}
                      >
                        <UserPlus /> Crea scheda
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="min-h-11 md:min-h-0"
                        onSelect={() => onAbbina(attiva)}
                      >
                        <UserRound /> Abbina a una scheda
                      </DropdownMenuItem>
                    </>
                  )}
                  {!attiva.lead && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="min-h-11 md:min-h-0 text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                    onSelect={() => void elimina()}
                  >
                    <Trash2 /> Elimina chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto px-3 pb-2 pt-0.5 [scrollbar-width:none] md:px-4 [&::-webkit-scrollbar]:hidden">
              {/* ── LO STATO SI CAMBIA DALLA PASTIGLIA ──────────────────
                È la stessa finestra a griglia di tutto il CRM (rispetta `statiPer`). */}
              {attiva.lead ? (
                <PastigliaStato
                  dati={attiva.lead.data}
                  contesto={
                    `${attiva.lead.data.nome ?? ""} ${attiva.lead.data.cognome ?? ""}`.trim() ||
                    undefined
                  }
                  onScegli={(s) => void cambiaStato(s)}
                  className="max-w-[14rem] shrink-0 min-h-9 md:min-h-0"
                />
              ) : (
                <span className="whitespace-nowrap text-[12px] text-muted-foreground">
                  {attiva.schedaAmbigua ? "Più schede con questo numero" : "Numero senza scheda"}
                </span>
              )}
              {/*  Com'è messo, per esteso: nella riga sua c'è posto per la parola. */}
              {attiva.lead && mostraTemperatura(attiva.lead.data.stato) && (
                <TemperaturaRiga
                  dati={attiva.lead.data}
                  max={0}
                  className="shrink-0 whitespace-nowrap text-[12px]"
                />
              )}
              {/*  Il tasto ⓘ sta qui, accanto a quello che spiega (temperatura e
                ritorno): nella prima riga col nome era il quarto tasto e il nome
                restava «Mario Esemp…» sul telefono. */}
              {attiva.lead && (
                <InfoModulo
                  dati={attiva.lead.data}
                  nome={`${attiva.lead.data.nome ?? ""} ${attiva.lead.data.cognome ?? ""}`.trim()}
                  telefono={attiva.phone}
                  compatto
                />
              )}
              {ritorno && (
                <span
                  className="shrink-0 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-none text-amber-700"
                  title={ritorno.titolo}
                >
                  <Undo2 aria-hidden="true" className="mr-1 inline h-3 w-3 align-[-1px]" />
                  {ritorno.completa}
                </span>
              )}
            </div>
          </div>

          {/* In «Da rispondere»: da quanto aspetta, e il pulsante per chiudere senza scrivere */}
          {inAttesa && (
            <div className="px-3 md:px-4 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-amber-900">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 min-w-0 text-[13px] leading-tight">
                Aspetta una risposta {attesaInChiaro(attiva.daRispondere?.dal ?? null, adesso)}
              </span>
              <Button
                size="sm"
                onClick={() => void segnaFatto()}
                className="h-11 md:h-8 shrink-0 bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <Check /> Risposto / Fatto
              </Button>
            </div>
          )}
          {attiva.stop && (
            <div className="px-3 md:px-4 py-1.5 bg-muted border-b border-border flex items-center gap-2 text-[13px] text-foreground">
              <Ban className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
              Questo numero ha chiesto di non ricevere messaggi
            </div>
          )}

          {/* Messaggi */}
          <div
            ref={scrollRef}
            role="log"
            aria-label="Messaggi della chat"
            //  Sfondo tenue di WhatsApp (#efeae2): le bolle bianche ci si staccano senza bordi.
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#efeae2] px-2.5 py-2 md:px-[6%] md:py-3"
          >
            <div className="mx-auto flex max-w-3xl flex-col">
              {messaggi.length === 0 ? (
                <div className="mt-4 self-center rounded-lg bg-white px-3 py-1 text-[12.5px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                  Nessun messaggio ancora · scrivi il primo
                </div>
              ) : (
                messaggi.map((m, i) => {
                  const d = new Date(m.created_at);
                  const prima = i > 0 ? new Date(messaggi[i - 1].created_at) : null;
                  const nuovoGiorno =
                    !Number.isNaN(d.getTime()) && (!prima || giornoRoma(prima) !== giornoRoma(d));
                  return (
                    <Fragment key={m.id}>
                      {nuovoGiorno && (
                        <div className="sticky top-1 z-10 mb-1 mt-3 self-center rounded-lg bg-white px-3 py-1 text-[12.5px] font-medium text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] first:mt-0 first-letter:uppercase">
                          {etichettaGiorno(d, adesso)}
                        </div>
                      )}
                      <BollaMessaggio
                        messaggio={m}
                        lead={attiva.lead}
                        attaccata={
                          !nuovoGiorno && attaccataAllaPrecedente(m, messaggi[i - 1] ?? null)
                        }
                      />
                    </Fragment>
                  );
                })
              )}
            </div>
          </div>

          <Casella api={api} />
        </>
      )}
    </section>
  );
}
