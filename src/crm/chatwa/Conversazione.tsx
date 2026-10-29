import { Fragment, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  Clock,
  MessageCircle,
  MoreVertical,
  Phone,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { BarraRispostaAi } from "./BarraRispostaAi";
import { useRispostaAi } from "./useRispostaAi";
import { initials, numeroLeggibile } from "./formati";
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
  //  ── RISPOSTA AI (29/10/2026) ───────────────────────────────────────────
  //  Si scelgono 1-4 messaggi, il Mac scrive la risposta e la mette nella
  //  casella. La bozza si legge quando arriva (ref): nel frattempo si può
  //  aver scritto altro, e quello resta, con la risposta sotto.
  const bozzaRef = useRef(api.bozza);
  bozzaRef.current = api.bozza;
  const ai = useRispostaAi({
    telefono: attiva?.phone ?? null,
    messaggi,
    onRisposta: (t) => {
      const prima = bozzaRef.current.trim();
      api.setBozza(prima ? `${bozzaRef.current.trimEnd()}\n\n${t}` : t);
    },
  });
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
          {/* Barra della chat: ← (solo telefono), nome e stato, scheda, menu */}
          <div className="px-2 md:px-4 py-1.5 bg-card border-b border-border flex items-center gap-1 md:gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={onIndietro}
              className="md:hidden h-11 w-11 shrink-0"
              aria-label="Torna all'elenco delle chat"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {/*  Sotto i 640 px niente avatar: con «Chiama» in più il nome e lo
                stato tornavano «Fran…» e «A…» (revisione del 28/10). */}
            <Avatar className="hidden sm:flex h-10 w-10 shrink-0">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                {attiva.lead ? initials(attiva.lead.data.nome, attiva.lead.data.cognome) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] md:text-[13px] font-semibold text-foreground truncate leading-tight">
                {attiva.lead
                  ? `${attiva.lead.data.nome} ${attiva.lead.data.cognome}`.trim()
                  : attiva.contact?.display_name || numeroLeggibile(attiva.phone)}
              </div>
              {/*  Il numero sotto il nome, anche per gli sconosciuti (senza nome è già il titolo). */}
              {(attiva.lead || attiva.contact?.display_name) && (
                <div className="truncate text-[12px] tabular-nums leading-tight text-muted-foreground">
                  {numeroLeggibile(attiva.phone)}
                </div>
              )}
              <div className="flex items-center gap-2 min-w-0 mt-0.5">
                {/* ── LO STATO SI CAMBIA DALLA PASTIGLIA ──────────────────
                    È la stessa finestra a griglia di tutto il CRM. Prima era
                    una tendina che elencava `SELECTABLE_LEAD_STATUSES`, cioè
                    la lista FISSA: a un lead importato ancora da chiamare
                    proponeva gli stati della trattativa, che è esattamente il
                    guasto che `statiPer` esiste per impedire. */}
                {attiva.lead ? (
                  <PastigliaStato
                    dati={attiva.lead.data}
                    contesto={
                      `${attiva.lead.data.nome ?? ""} ${attiva.lead.data.cognome ?? ""}`.trim() ||
                      undefined
                    }
                    onScegli={(s) => void cambiaStato(s)}
                    className="max-w-[11rem] shrink min-w-0 min-h-11 md:min-h-0"
                  />
                ) : (
                  <span className="text-[12px] text-muted-foreground truncate">
                    {attiva.schedaAmbigua ? "Più schede con questo numero" : "Numero senza scheda"}
                  </span>
                )}
                {/*  Com'è messo (28/10/2026): pallino e parola, come in Oggi. */}
                {attiva.lead && mostraTemperatura(attiva.lead.data.stato) && (
                  <>
                    {/*  Sul telefono solo il pallino: la parola (e il resto) nel
                        tasto Info. Con la parola lo stato restava «A…». */}
                    <TemperaturaRiga
                      dati={attiva.lead.data}
                      soloPallino
                      className="shrink-0 sm:hidden"
                    />
                    <TemperaturaRiga
                      dati={attiva.lead.data}
                      max={0}
                      className="hidden shrink-0 text-[12px] sm:inline-flex"
                    />
                  </>
                )}
                {/*  Di ritorno (28/10/2026): sul telefono la sola parola (lo stato di
                    prima e la data sono nel tasto Info), da 640 px lo stato di prima. */}
                {ritorno && (
                  <span
                    className="min-w-0 shrink truncate whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-none text-amber-700"
                    title={ritorno.titolo}
                  >
                    <span className="sm:hidden">↩</span>
                    <span className="hidden sm:inline">{ritorno.completa}</span>
                  </span>
                )}
              </div>
            </div>
            {/*  ── CHIAMA (28/10/2026) ─────────────────────────────────────
                Richiesta del titolare: il tasto per telefonare sopra la chat.
                Sul telefono apre il compositore con il numero; sul Mac lo
                passa all'iPhone (Continuità) o all'app che gestisce «tel:». */}
            {numeroDaComporre(attiva.phone) && (
              <Button
                asChild
                variant="outline"
                className="h-11 w-11 sm:w-auto px-0 sm:px-3 shrink-0 md:h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <a
                  href={`tel:${numeroDaComporre(attiva.phone)}`}
                  aria-label={`Chiama ${attiva.phone}`}
                  title={`Chiama ${attiva.phone}`}
                >
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">Chiama</span>
                </a>
              </Button>
            )}
            {attiva.lead && (
              <InfoModulo
                dati={attiva.lead.data}
                nome={`${attiva.lead.data.nome ?? ""} ${attiva.lead.data.cognome ?? ""}`.trim()}
                telefono={attiva.phone}
              />
            )}
            <Button
              variant="outline"
              onClick={onApriLead}
              className="h-11 w-11 sm:w-auto px-0 sm:px-3 shrink-0 md:h-9"
              aria-label={
                attiva.lead ? "Apri la scheda del lead" : "Crea la scheda da questo numero"
              }
              title={attiva.lead ? "Modifica dati lead" : "Crea lead da questo numero"}
            >
              {attiva.lead ? <UserRound className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              <span className="hidden sm:inline">{attiva.lead ? "Scheda" : "Crea scheda"}</span>
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
          <div className="relative flex min-h-0 flex-1 flex-col">
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
                        {ai.attivo && m.body?.trim() ? (
                          //  In scelta: tutta la riga si tocca; il segno a sinistra
                          //  dice se è scelto (come «Seleziona» di WhatsApp).
                          <div
                            role="checkbox"
                            aria-checked={ai.scelti.includes(m.id)}
                            aria-label="Scegli questo messaggio per la risposta AI"
                            tabIndex={0}
                            onClick={() => ai.fase === "scelta" && ai.cambia(m.id)}
                            onKeyDown={(e) => {
                              if ((e.key === " " || e.key === "Enter") && ai.fase === "scelta") {
                                e.preventDefault();
                                ai.cambia(m.id);
                              }
                            }}
                            className={cn(
                              "-mx-2.5 flex cursor-pointer items-center gap-2 px-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 md:-mx-3 md:px-3",
                              ai.scelti.includes(m.id) && "bg-violet-500/15",
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                                ai.scelti.includes(m.id)
                                  ? "border-violet-600 bg-violet-600 text-white"
                                  : "border-[#8696a0] bg-white",
                              )}
                              aria-hidden
                            >
                              {ai.scelti.includes(m.id) && <Check className="h-3 w-3" />}
                            </span>
                            <div className="pointer-events-none min-w-0 flex-1 flex flex-col">
                              <BollaMessaggio
                                messaggio={m}
                                lead={attiva.lead}
                                attaccata={
                                  !nuovoGiorno &&
                                  attaccataAllaPrecedente(m, messaggi[i - 1] ?? null)
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <BollaMessaggio
                            messaggio={m}
                            lead={attiva.lead}
                            attaccata={
                              !nuovoGiorno && attaccataAllaPrecedente(m, messaggi[i - 1] ?? null)
                            }
                          />
                        )}
                      </Fragment>
                    );
                  })
                )}
              </div>
            </div>

            {/*  Il tasto della risposta AI: in basso a destra sopra i messaggi,
              per non togliere spazio alla barra in alto sul telefono. */}
            {!ai.attivo && messaggi.some((m) => m.body?.trim()) && (
              <Button
                onClick={ai.apri}
                className="absolute bottom-3 right-3 z-20 h-11 rounded-full bg-violet-600 px-4 text-white shadow-lg hover:bg-violet-700 md:h-9"
                aria-label="Rispondi con l'AI: scegli i messaggi"
                title="Scegli i messaggi e il Mac scrive la risposta"
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-[13px]">Rispondi con AI</span>
              </Button>
            )}
          </div>

          {ai.attivo ? <BarraRispostaAi ai={ai} /> : <Casella api={api} />}
        </>
      )}
    </section>
  );
}
