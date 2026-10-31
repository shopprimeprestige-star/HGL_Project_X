import { memo, useEffect, useRef, useState, type PointerEvent } from "react";
import { BadgeChiamate, useSegnaChiamata } from "@/crm/ContaChiamate";
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Hourglass,
  Lock,
  LockOpen,
  Phone,
  Star,
  Undo2,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { chiamabile } from "@/crm/chiamabile";
import { ChiamaEstero } from "@/crm/ChiamaEstero";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_COLOR, LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "@/crm/types";
import { FinestraStati, statiSelezionabili } from "@/crm/SelettoreStatoDialog";
import { numeroDaComporre } from "@/crm/importa/chiamare";
import { statiMenuRiga, pastigliaFinestra } from "./daChiamare";
import { useCRM } from "@/crm/CRMContext";
import { usePuo } from "@/crm/AuthContext";
import { corpoLeggibile } from "@/crm/testo-modello";
import { TemperaturaRiga } from "@/crm/Temperatura";
import { mostraTemperatura } from "@/crm/temperatura-lead";
import { anteprimaRiga, type Spunte } from "./anteprima-riga";
import { IconaMedia } from "./IconaMedia";
import { attesaInChiaro, ultimoDellaChat } from "./stato";
import { ritornoInChat } from "./ritorno";
import { PrimaDelRitorno } from "@/crm/importa/PrimaDelRitorno";
import { linkApriWhatsapp } from "./apriWhatsapp";
import { scadenzaFinestra, segnoConferma } from "./segniRiga";
import { eSpostamento, PRESSIONE_LUNGA_MS } from "./selezione";
import { testoPerWhatsapp } from "./testoWhatsapp";
import { IconaWhatsApp } from "./IconaWhatsApp";
import { etichettaRichiamo, stileRichiamo } from "./richiamo";
import { oggiIso } from "@/crm/ui";
import { formatOraWhatsapp, formatTimeIT, initials, numeroLeggibile } from "./formati";
import { quandoUltimo } from "./ordineWhatsapp";
import { puoAnticipare } from "./accontiInCima";
import { badgeAttesaPosa, type LivelloAttesa } from "./attesaPosa";
import { TastoPriorita } from "@/crm/PrioritaPosa";
import { inPriorita } from "@/crm/priorita";
import type { ChatItem } from "./tipi";

/** Come si disegna una riga: normale, o in attesa di risposta («Da rispondere»). */
export type ModoRiga = "normale" | "attesa";

/** Le spunte del mio ultimo messaggio, come nella bolla: lette in azzurro, il resto in grigio. */
function SpunteRiga({ stato }: { stato: Spunte }) {
  const classe = "h-3.5 w-3.5 shrink-0";
  return (
    <>
      {stato === "lette" && (
        <CheckCheck aria-hidden="true" className={cn(classe, "text-sky-600")} />
      )}
      {stato === "consegnato" && <CheckCheck aria-hidden="true" className={classe} />}
      {stato === "inviato" && <Check aria-hidden="true" className={classe} />}
      {stato === "errore" && (
        <AlertCircle aria-hidden="true" className={cn(classe, "text-red-600")} />
      )}
      <span className="sr-only">
        {
          { lette: "Letto", consegnato: "Consegnato", inviato: "Inviato", errore: "Non inviato" }[
            stato
          ]
        }
        {". "}
      </span>
    </>
  );
}

/** I tre colori del badge «da quanto non gli scriviamo» (soglie in attesaPosa.ts): neutro, ambra, rosso. */
const STILE_ATTESA_POSA: Record<LivelloAttesa, string> = {
  neutro: "border-slate-200 bg-slate-50 text-slate-600",
  ambra: "border-amber-300 bg-amber-50 text-amber-800",
  rosso: "border-red-300 bg-red-50 text-red-700",
};

/** Nome da mostrare: scheda, poi nome salvato, poi il numero. */
export function nomeChat(c: ChatItem): string {
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
  /** Le stelle di priorità (0-3) e il tocco che le cambia (vedi useStelle). */
  stelle?: number;
  onStelle?: () => void;
  /** Cambia lo stato del lead dalla riga (salvataggio condiviso: useChatWa.cambiaStatoLead). */
  onCambiaStato?: (lead: Lead, stato: LeadStatus) => void;
  /** Senza scheda (30/10/2026): la scelta dello stato crea la scheda col numero e le dà quello stato. */
  onCreaSchedaConStato?: (stato: LeadStatus) => void;
  /** Solo in «Da chiamare»: pastiglia verde se si può scrivere (finestra di 24 ore
   *  aperta), rossa se è chiusa e serve un modello approvato. */
  mostraFinestra?: boolean;
  /** Selezione tenendo premuto (30/10/2026). Senza, la riga è quella di sempre.
   *  `attiva`: la modalità è accesa (il tocco aggiunge/toglie); `scelta`: questa riga è scelta. */
  selezione?: {
    attiva: boolean;
    scelta: boolean;
    /** Pressione lunga con la modalità spenta: la accende con questa riga scelta. */
    onInizia: () => void;
    /** Tocco con la modalità accesa: aggiunge o toglie la riga. */
    onTocca: () => void;
  };
  /** È la chat del prossimo meet di oggi (vedi prossimo-meet.ts): la barra in cima la ripete, qui
   *  resta lo sfondo e il bordo viola, così la si riconosce anche scorrendo. */
  prossimoMeet?: boolean;
  /** Vista «Tutte» (30/10/2026): a destra sempre l'ora dell'ultimo messaggio come WhatsApp
   *  («18:03», «Ieri», «lunedì», «21/10/2026»), mai «da 5 min» né «Senza risposta». */
  comeWhatsapp?: boolean;
}

/** Una chat nell'elenco. La riga è un solo bottone; «Crea scheda» sta
 *  sotto, fuori dal bottone (un bottone dentro un bottone non è valido e sul telefono
 *  prende il tocco sbagliato). Il nome ha sempre la riga tutta per sé: pastiglia di
 *  stato e numero vanno sotto, così non lo schiacciano. */
function RigaChatBase({
  chat: c,
  modo,
  attiva,
  adesso,
  onApri,
  onCreaScheda,
  stelle = 0,
  onStelle,
  onCambiaStato,
  onCreaSchedaConStato,
  mostraFinestra = false,
  selezione,
  prossimoMeet = false,
  comeWhatsapp = false,
}: RigaChatProps) {
  //  Con la finestra CHIUSA il bollino con l'icona di WhatsApp c'è in ogni
  //  elenco (richiesta del 29/10/2026: «ogni volta che la finestra è chiusa»);
  //  quello verde «aperta» solo dove serve (`mostraFinestra`).
  const finestra =
    mostraFinestra || c.finestra?.aperta === false ? pastigliaFinestra(c.finestra) : null;
  const [cambiaStato, setCambiaStato] = useState(false);
  //  Ogni tocco sulla cornetta si conta sulla scheda (31/10/2026).
  const segnaChiamata = useSegnaChiamata();
  //  «Anticipa» solo a chi gestisce le installazioni (revisione di sicurezza, 31/10/2026).
  const puoInstallazioni = usePuo()("installazioni");
  /*  ── PRESSIONE LUNGA (30/10/2026) ──────────────────────────────────────────
      Touch e mouse con gli eventi del puntatore. Si annulla se il dito scorre
      (`eSpostamento`), se lo si alza prima o se il browser prende il gesto (scorrimento:
      `pointercancel`). Quando scatta, il rilascio che segue NON deve aprire la chat: lo
      dice `lungo`. Sul telefono il menu di sistema (tieni premuto) si blocca solo dopo
      un tocco vero, così col mouse il tasto destro resta quello del browser. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partenza = useRef<{ x: number; y: number } | null>(null);
  const lungo = useRef(false);
  const tocco = useRef(false);
  const annullaPressione = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    partenza.current = null;
  };
  useEffect(() => annullaPressione, []);
  const iniziaPressione = (e: PointerEvent) => {
    //  Si azzera PRIMA di ogni uscita: su Android, dopo una pressione lunga, il click
    //  può non arrivare mai e il flag resterebbe acceso, mangiando il tocco dopo.
    lungo.current = false;
    tocco.current = e.pointerType === "touch";
    if (!selezione || selezione.attiva || (e.pointerType === "mouse" && e.button !== 0)) return;
    partenza.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      timer.current = null;
      lungo.current = true;
      if (typeof navigator !== "undefined") navigator.vibrate?.(15);
      selezione.onInizia();
    }, PRESSIONE_LUNGA_MS);
  };
  const muoviPressione = (e: PointerEvent) => {
    const p = partenza.current;
    if (p && eSpostamento(e.clientX - p.x, e.clientY - p.y)) annullaPressione();
  };
  const nome = nomeChat(c);
  //  Il numero sotto il nome, anche per gli sconosciuti; se il nome È già il numero non si ripete.
  const numero = numeroLeggibile(c.phone);
  const numeroSotto = nome.replace(/\D/g, "") !== numero.replace(/\D/g, "");
  const telefono = numeroDaComporre(c.phone);
  //  Gli stati di chiamata che la regola del CRM (`statiPer`) ammette per QUESTO lead.
  const ammessi = new Set(c.lead ? statiSelezionabili(c.lead.data) : []);
  //  Senza scheda: nascerà «Da contattare», quindi tutti e sette gli stati di chiamata.
  const opzioniStato = statiMenuRiga(c.lead ? c.lead.data.stato : "da_contattare", ammessi);
  //  p1-chat-veloce: l'ultimo messaggio anche delle chat vecchie (fuori dai letti),
  //  salvato sul contatto — entrata o uscita. Il più recente dei due.
  const last = ultimoDellaChat(c.lastMessage, c.contact);
  const inAttesa = modo === "attesa";
  const ambigua = c.schedaAmbigua === true;
  const senzaScheda = !c.lead && (c.senzaScheda ?? true);
  //  Lo stato si cambia dalla riga se c'è la scheda; se NON c'è, la scelta la crea (30/10/2026).
  //  Con più schede su quel numero no: non si sa a quale darlo, e se ne farebbe una terza.
  const puoiCambiareStato = !!c.lead || (senzaScheda && !ambigua);

  // `dal` c'è sempre se la chat è in attesa; se mancasse, meglio l'ora dell'ultimo messaggio che un «da meno di 1 min» falso.
  const dal = inAttesa ? (c.daRispondere?.dal ?? null) : null;
  const ultimaOra = quandoUltimo(c);
  const tempo = comeWhatsapp
    ? formatOraWhatsapp(ultimaOra > 0 ? new Date(ultimaOra) : null, adesso)
    : dal
      ? attesaInChiaro(dal, adesso)
      : formatTimeIT(last?.created_at ?? c.contact?.last_message_at ?? null);
  const { consultants } = useCRM();
  const nomeConsulente =
    consultants.find((x) => x.id === c.lead?.data?.consulenteId)?.data.nome ?? null;
  //  Con la finestra chiusa il link porta già il promemoria giusto nella casella (30/10/2026),
  //  se la scheda ha tutto per scriverlo; altrimenti solo il numero (vedi testoWhatsapp.ts).
  const apriWa =
    finestra && !finestra.aperta
      ? linkApriWhatsapp(
          c.phone,
          typeof navigator === "undefined" ? "" : navigator.userAgent,
          testoPerWhatsapp(c, nomeConsulente, new Date(adesso)),
        )
      : "";
  //  Finestra chiusa e link valido: in alto a destra, accanto alla cornetta, l'icona WhatsApp
  //  (31/10/2026). Le prime due righe del testo lasciano il posto al secondo tasto.
  const conWa = Boolean(finestra && !finestra.aperta && apriWa);
  //  Chi aspetta la posa (acconto versato): da quanto non gli scriviamo (31/10/2026).
  const attesaPosa = badgeAttesaPosa(c, adesso);
  //  Conferma e finestra in scadenza (30/10/2026): vedi segniRiga.ts.
  const conferma = segnoConferma(c.lead?.data, new Date(adesso));
  const scadenza = scadenzaFinestra(c, adesso);
  //  L'anteprima è SEMPRE l'ultimo messaggio della chat, di chiunque sia (30/10/2026):
  //  anche in «Da rispondere», dove prima si vedeva l'ultimo del cliente. Un nostro
  //  modello («[template:nome]») si legge col suo testo, come nella bolla. Un media si
  //  legge con la sua icona outline, anche se l'anteprima salvata ha l'emoji di prima del 28/10.
  const a = anteprimaRiga({
    ultimo: last,
    contatto: c.contact,
    attesa: c.daRispondere,
    inAttesa,
    adesso,
    testoUscita: (corpo) => corpoLeggibile(corpo, c.lead?.data, nomeConsulente, c.lead?.id).testo,
  });
  const ritorno = c.lead ? ritornoInChat(c.lead.data) : null;
  const richiamo = c.lead ? etichettaRichiamo(c.lead.data, oggiIso(new Date(adesso))) : null;

  //  Nessun messaggio in archivio: si dice. Se invece la chat ha messaggi ma
  //  l'ultimo non è fra quelli letti (si leggono gli ultimi 500), la riga
  //  dell'anteprima non si disegna: niente buco vuoto in mezzo alla riga.
  //  `temperatura` dice solo se c'è la riga del numero; il pallino lo decide TemperaturaRiga.
  const temperatura = !!c.lead && mostraTemperatura(c.lead.data.stato);
  const nessunMessaggio = a.nessunMessaggio;
  const rigaAnteprima = a.testo !== "" || nessunMessaggio;

  return (
    <li
      className={cn(
        "relative border-b border-border",
        attiva
          ? "bg-emerald-50/60"
          : prossimoMeet && "bg-violet-50/70 ring-1 ring-inset ring-violet-300",
        selezione?.scelta && "bg-emerald-100/60",
      )}
    >
      {/*  ── LA RIGA, STILE WHATSAPP (29/10/2026) ──────────────────────────────
          Richiesta del titolare: compatta, senza vuoti. Nome e ora sulla prima
          riga, sotto il numero, sotto ancora la finestra di 24 ore (piccola), poi
          l'anteprima. Le pastiglie stanno sotto, vanno a capo e non escono mai. */}
      <button
        type="button"
        onClick={() => {
          //  Il rilascio dopo una pressione lunga ha già acceso la selezione: non apre la chat.
          if (lungo.current) {
            lungo.current = false;
            return;
          }
          if (selezione?.attiva) selezione.onTocca();
          else onApri();
        }}
        onPointerDown={iniziaPressione}
        onPointerMove={muoviPressione}
        onPointerUp={annullaPressione}
        onPointerLeave={annullaPressione}
        onPointerCancel={annullaPressione}
        onContextMenu={(e) => {
          if (selezione && (tocco.current || lungo.current)) e.preventDefault();
        }}
        aria-current={attiva ? "true" : undefined}
        aria-pressed={selezione?.attiva ? selezione.scelta : undefined}
        className={cn(
          selezione && "select-none [-webkit-touch-callout:none]",
          "flex w-full items-start gap-3 pb-1.5 pl-3 pt-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          //  Con la cornetta a destra (44 px + 4 di margine) il testo si ferma prima.
          telefono ? "pr-12 md:pr-10" : "pr-3",
        )}
      >
        <span className="relative shrink-0">
          <Avatar className="h-11 w-11 md:h-10 md:w-10">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
              {c.lead ? initials(c.lead.data.nome, c.lead.data.cognome) : "?"}
            </AvatarFallback>
          </Avatar>
          {/*  In selezione: spunta verde se scelta, cerchio vuoto se no (come WhatsApp). */}
          {selezione?.attiva && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2",
                selezione.scelta
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-muted-foreground/50 bg-background",
              )}
            >
              {selezione.scelta && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("flex items-baseline gap-2", conWa && "pr-11 md:pr-9")}>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-5 text-foreground md:text-[13px] md:leading-[18px]">
              {nome}
            </span>
            {/*  A destra della prima riga ci sta SEMPRE di chi è la palla (30/10/2026):
                «da 18 h» in ambra = tocca a noi; «Senza risposta da 2 g» in ardesia con la
                clessidra = tocca a lui. Ardesia e non azzurro: l'azzurro è già nello stato.
                Niente riga in più nell'elenco. Sul tablet (colonna stretta) restano
                clessidra e durata, la frase c'è per chi legge con lo schermo. */}
            {a.senzaRisposta && !comeWhatsapp ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2 text-[11px] font-medium leading-5 tabular-nums text-slate-700 md:leading-[18px]"
                title={`Hai scritto tu per ultimo e il cliente non ha ancora risposto (${a.senzaRisposta.da})`}
              >
                <Hourglass aria-hidden="true" className="h-3 w-3 shrink-0" />
                <span>
                  <span className={conWa ? "max-lg:sr-only" : "md:max-lg:sr-only"}>
                    Senza risposta
                  </span>
                  {a.senzaRisposta.daOre && ` ${a.senzaRisposta.breve}`}
                </span>
              </span>
            ) : (
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap text-[12px] tabular-nums md:text-[11px]",
                  modo === "attesa" && !comeWhatsapp
                    ? "font-semibold text-amber-700"
                    : "text-muted-foreground",
                )}
              >
                {tempo}
              </span>
            )}
          </span>
          {/*  Il numero, e a destra sotto l'ora com'è messo il cliente (28/10/2026):
              pallino e parola, niente risposte brevi (le risposte sono nel tasto
              info della chat). Sulla riga del numero c'è posto, e la riga delle
              pastiglie resta a stato, richiamo e stelle. */}
          {(numeroSotto || temperatura) && (
            <span
              className={cn(
                "flex items-baseline justify-end gap-2 text-[12px] leading-4 md:text-[11px]",
                conWa && "pr-11 md:pr-9",
              )}
            >
              {numeroSotto && (
                <span className="min-w-0 flex-1 truncate tabular-nums text-muted-foreground">
                  {numero}
                </span>
              )}
              {c.lead && mostraTemperatura(c.lead.data.stato) && (
                <TemperaturaRiga dati={c.lead.data} max={0} className="shrink-0 text-[11px]" />
              )}
            </span>
          )}
          {/*  Finestra di 24 ore (29/10/2026, solo in «Da chiamare»), sotto il
              numero come chiesto dal titolare: verde = si può scrivere, rossa =
              finestra chiusa, serve un modello. Testo piccolo, non pastiglia. */}
          {finestra && (
            <span
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium leading-4",
                finestra.aperta ? "text-emerald-700" : "text-red-700",
              )}
              title={finestra.titolo}
            >
              {finestra.aperta ? (
                <LockOpen aria-hidden="true" className="h-3 w-3 shrink-0" />
              ) : (
                <Lock aria-hidden="true" className="h-3 w-3 shrink-0" />
              )}
              {finestra.testo}
            </span>
          )}
          {rigaAnteprima && (
            <span className="mt-0.5 flex items-center gap-2">
              {/*  Chi ha scritto l'ultimo (30/10/2026): se sono io, davanti ci sono le
                  spunte e «Tu:» e NON si tagliano (shrink-0); si taglia solo il testo, con
                  i puntini, su una riga. Se è del cliente, niente prefisso; da leggere =
                  grassetto scuro. */}
              <span className="flex min-w-0 flex-1 items-center gap-1 text-[13px] leading-[18px] text-muted-foreground md:text-[12px] md:leading-4">
                {a.mio && (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    {a.spunte && <SpunteRiga stato={a.spunte} />}
                    <span className="font-medium">Tu:</span>
                  </span>
                )}
                {a.media && <IconaMedia tipo={a.media} className="shrink-0" />}
                <span
                  className={cn("min-w-0 truncate", a.nonLetto && "font-semibold text-foreground")}
                >
                  {nessunMessaggio ? "Nessun messaggio" : a.testo}
                </span>
              </span>
            </span>
          )}
        </span>
      </button>

      {/*  ── CORNETTA (28/10/2026) ───────────────────────────────────────────
          Su ogni riga con un numero, con o senza scheda (30/10/2026): apre il compositore con il numero (sul Mac lo
          passa all'iPhone). Fuori dal bottone della riga e con stopPropagation, così
          non apre la chat; 44 px di tocco sul telefono. */}
      {telefono && (
        <>
          {/*  Numero estero (30/10/2026): stesso posto, rosso e bloccato. Il WhatsApp è
              nella chat aperta, dove il tasto nativo c'è sempre. */}
          {!chiamabile(telefono) && (
            <ChiamaEstero
              telefono={telefono}
              senzaWhatsapp
              inerte={selezione?.attiva}
              className="absolute right-1 top-0 h-11 w-11 p-0 md:top-0.5 md:h-9 md:w-9"
            />
          )}
          {chiamabile(telefono) && (
            <Button
              asChild
              inert={selezione?.attiva}
              variant="ghost"
              className="absolute right-1 top-0 h-11 w-11 p-0 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 md:top-0.5 md:h-9 md:w-9"
            >
              <a
                href={`tel:${telefono}`}
                aria-label={`Chiama ${nome}`}
                title={`Chiama ${nome}`}
                onClick={(e) => {
                  e.stopPropagation();
                  segnaChiamata(c.lead);
                }}
              >
                <Phone aria-hidden="true" className="h-5 w-5 md:h-4 md:w-4" />
                <BadgeChiamate lead={c.lead} className="right-0.5 top-0.5" />
              </a>
            </Button>
          )}
        </>
      )}

      {/*  ── FINESTRA CHIUSA: ICONA WHATSAPP ACCANTO ALLA CORNETTA (31/10/2026) ──
          Richiesta del titolare: a finestra chiusa il CRM può mandare solo modelli, quindi accanto
          alla cornetta c'è il tasto che apre l'app WhatsApp sul numero (Business prima, su Android):
          lì si scrive a mano. Stesso link di «Apri in WhatsApp» nella Casella (con il promemoria nella
          casella se la scheda ha tutto). Prende il posto della piccola icona accanto a «Finestra
          chiusa», tolta per non avere due icone uguali. Vale anche per i numeri esteri: la regola
          «chiama solo Italia» riguarda la cornetta, non WhatsApp, anzi per loro è l'unica via.
          Fuori dal bottone della riga e con stopPropagation, così non apre la chat; 44 px sul telefono. */}
      {conWa && (
        <Button
          asChild
          inert={selezione?.attiva}
          variant="ghost"
          className={cn(
            "absolute top-0 h-11 w-11 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 md:top-0.5 md:h-9 md:w-9",
            //  A sinistra della cornetta (44 px + 4 di margine; 36 + 4 dal tablet); da sola, al suo posto.
            telefono ? "right-[52px] md:right-[44px]" : "right-1",
          )}
        >
          <a
            href={apriWa}
            //  wa.me in una scheda nuova (il CRM resta aperto); il link Android si apre e basta.
            target={apriWa.startsWith("https:") ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-label={`Apri ${nome} su WhatsApp`}
            title={`Finestra chiusa: apri ${nome} nell'app WhatsApp`}
            onClick={(e) => e.stopPropagation()}
          >
            <IconaWhatsApp className="h-5 w-5 md:h-4 md:w-4" />
          </a>
        </Button>
      )}

      {/*  ── STATO, RICHIAMO, RITORNO E STELLE ─────────────────────────────────
          Sotto il bottone della riga e non dentro: lo stato si cambia da qui (un
          bottone dentro un bottone non è valido e sul telefono prende il tocco
          sbagliato). Il tasto dello stato apre la STESSA finestra del resto del CRM
          (FinestraStati) con gli stati di chiamata; il salvataggio è `onCambiaStato`.
          Le pastiglie vanno a capo (`flex-wrap`) e quelle lunghe si accorciano
          (`max-w-full` + `truncate`): nessuna esce dallo schermo a 375 px.
          ⚠️ I TOCCHI RESTANO DA 44 PX SENZA ALZARE LA RIGA: stato e stelle sono
           alti ~22 px a vista, e sul telefono un `after:` trasparente allarga
           l'area del tocco sopra e sotto (dal computer non serve). */}
      {(puoiCambiareStato || onStelle) && (
        <div
          inert={selezione?.attiva}
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 pb-2.5 pl-[68px] pr-3 md:pl-16"
        >
          {c.lead && (
            <button
              type="button"
              onClick={() => setCambiaStato(true)}
              aria-haspopup="dialog"
              aria-label={`Stato: ${LEAD_STATUS_LABEL[c.lead.data.stato]}. Cambialo`}
              title={`${LEAD_STATUS_LABEL[c.lead.data.stato]} · cambia stato`}
              className="relative inline-flex min-w-0 max-w-full items-center rounded-full after:absolute after:inset-x-0 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:after:hidden"
            >
              <span
                className={cn(
                  "inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
                  LEAD_STATUS_COLOR[c.lead.data.stato],
                )}
              >
                <span className="truncate">{LEAD_STATUS_LABEL[c.lead.data.stato]}</span>
                <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
              </span>
            </button>
          )}
          {/*  Senza scheda: stessa pastiglia, neutra e tratteggiata. Scegliere uno stato crea la scheda. */}
          {!c.lead && puoiCambiareStato && (
            <button
              type="button"
              onClick={() => setCambiaStato(true)}
              aria-haspopup="dialog"
              aria-label={`Imposta lo stato di ${nome}: crea la scheda`}
              title="Imposta lo stato · crea la scheda"
              className="relative inline-flex min-w-0 max-w-full items-center rounded-full after:absolute after:inset-x-0 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:after:hidden"
            >
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-dashed border-muted-foreground/50 px-2 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
                <span className="truncate">Imposta stato</span>
                <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
              </span>
            </button>
          )}
          {/*  ── DA QUANTO NON GLI SCRIVIAMO (31/10/2026) ───────────────────────
              Solo per chi ha lasciato l'acconto e aspetta la posa. Pillola corta con la
              clessidra: «10 g», «3 h». Neutra sotto i 3 giorni, ambra da 3 a 7, rossa oltre
              (vedi attesaPosa.ts). Sta nella riga delle pastiglie, in ogni elenco. */}
          {attesaPosa && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 tabular-nums",
                STILE_ATTESA_POSA[attesaPosa.livello],
              )}
              title={attesaPosa.titolo}
            >
              <Hourglass aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="sr-only">{attesaPosa.titolo}: </span>
              <span aria-hidden="true">{attesaPosa.testo}</span>
            </span>
          )}
          {/*  ── CONFERMA E FINESTRA IN SCADENZA (30/10/2026) ───────────────────
              Solo per gli appuntamenti fissati. «Confermato» verde con la spunta,
              «Da confermare» arancione col pallino: testo semplice, senza bordo, per
              non sembrare un altro stato. «chiude tra…» ambra con l'orologio: scrivi
              ora, gratis, prima che serva un modello. Stanno nella riga delle
              pastiglie (che va a capo): nessun allargamento a 375 px. */}
          {conferma && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-4",
                conferma.tipo === "confermato" ? "text-emerald-700" : "text-orange-700",
              )}
              title={conferma.titolo}
            >
              {conferma.tipo === "confermato" ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
              ) : (
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />
              )}
              {conferma.testo}
            </span>
          )}
          {scadenza && (
            <span
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-4 tabular-nums text-amber-800"
              title={scadenza.titolo}
            >
              <Clock aria-hidden="true" className="h-3 w-3 shrink-0" />
              {scadenza.testo}
            </span>
          )}
          {/*  Quando richiamarlo (29/10/2026): la data messa nella finestra dello
              stato, rossa se è passata. A vista senza «Richiamo» (lo dice
              l'icona del calendario, e lo stato accanto spesso è già «Richiamo
              concordato»): così stato e data stanno sulla stessa riga. */}
          {richiamo && (
            <span
              className={cn(
                "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 tabular-nums",
                stileRichiamo(richiamo),
              )}
              title={richiamo.titolo}
            >
              <CalendarClock aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="truncate">
                <span className="sr-only">Richiamo </span>
                {richiamo.testo.replace(/^Richiamo /, "")}
              </span>
            </span>
          )}
          {/*  Di ritorno (28/10/2026): nella riga solo «Ritorno» con l'icona, lo stato di
              prima nell'intestazione della chat e nel tooltip. */}
          {ritorno && (
            <span
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-4 text-amber-700"
              title={ritorno.titolo}
            >
              {/*  Icona outline al posto della freccia (28/10/2026). */}
              <Undo2 aria-hidden="true" className="h-3 w-3 sm:mr-1" />
              <span className="sr-only sm:not-sr-only">{ritorno.corta}</span>
            </span>
          )}
          {/*  «prima: …» (30/10/2026): sotto la fila delle pastiglie, a filo dello
              stato. `order-last basis-full` la manda a capo da sola senza toccare
              stelle e pastiglie; l'icona ↩ c'è già nella pastiglia del ritorno. */}
          {c.lead && (
            <PrimaDelRitorno
              dati={c.lead.data}
              icona={false}
              className="order-last -mt-1 basis-full pl-2"
            />
          )}
          {/*  ── ACCONTO E «ANTICIPA» (30/10/2026) ──────────────────────────────
              «Anticipa» è la priorità della SCHEDA, la stessa della pagina Installazioni:
              viola con la parola «In cima» quando è accesa, solo la freccia quando è spenta (così la riga non
              cresce); il tocco apre la sua finestrella (giorno chiesto,
              togli). Le stelle sotto sono un'altra cosa: «in osservazione». Il tocco è da 44 px sul
              telefono con `after:`, come le stelle. */}
          {puoInstallazioni && c.lead && puoAnticipare(c.lead) && (
            <TastoPriorita
              lead={c.lead}
              esteso={inPriorita(c.lead)}
              className="relative after:absolute after:inset-x-0 after:-inset-y-2 md:after:hidden"
            />
          )}
          {/*  ── LE STELLE, DALLA LISTA (28/10/2026) ───────────────────────────
              Un tocco ne aggiunge una (0 → 1 → 2 → 3 → 0). Sempre in fondo a
              destra, sotto la cornetta; se non c'è posto vanno a capo, a destra. */}
          {onStelle && (
            <button
              type="button"
              onClick={onStelle}
              className="relative ml-auto inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md px-1 after:absolute after:inset-x-0 after:-inset-y-2.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:after:hidden"
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
      {puoiCambiareStato && (
        <FinestraStati
          aperta={cambiaStato}
          onChiudi={() => setCambiaStato(false)}
          stato={c.lead?.data.stato}
          opzioni={opzioniStato}
          contesto={
            c.lead
              ? `${nome} · adesso: ${LEAD_STATUS_LABEL[c.lead.data.stato]}`
              : `${nome} · senza scheda: si crea con lo stato che scegli`
          }
          onScegli={(s) => {
            setCambiaStato(false);
            if (c.lead) onCambiaStato?.(c.lead, s);
            else onCreaSchedaConStato?.(s);
          }}
        />
      )}

      {(senzaScheda || ambigua) && (
        <div
          inert={selezione?.attiva}
          className="flex flex-wrap items-center gap-x-3 pb-1 pl-[68px] pr-3"
        >
          <span className="text-[12px] text-muted-foreground">
            {ambigua ? "Più schede con questo numero" : "Numero senza scheda"}
          </span>
          {/*  Un solo tasto, leggero (30/10/2026): senza bordo, icona + testo corto. L'abbinamento a una
              scheda che c'è già resta nel menu ⋮ della conversazione aperta. */}
          {!ambigua && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCreaScheda}
              className="-ml-2 h-11 gap-1 px-2 text-[13px] text-primary hover:text-primary md:h-8 md:text-xs"
            >
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              Crea scheda
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/** ── LA RIGA SI RIDISEGNA SOLO SE CAMBIA QUELLO CHE MOSTRA (p1-chat-veloce, 30/10/2026) ──
 *  Le funzioni (`onApri`…) non contano: `ElencoChat` le passa con identità fissa che chiamano
 *  sempre la versione di adesso. Della `selezione` contano `attiva` e `scelta`. */
const stesseProps = (a: RigaChatProps, b: RigaChatProps): boolean => {
  for (const k of Object.keys(b) as (keyof RigaChatProps)[]) {
    if (typeof b[k] === "function") continue;
    if (k === "selezione") {
      if (
        a.selezione?.attiva !== b.selezione?.attiva ||
        a.selezione?.scelta !== b.selezione?.scelta
      )
        return false;
      if (Boolean(a.selezione) !== Boolean(b.selezione)) return false;
    } else if (a[k] !== b[k]) return false;
  }
  return Object.keys(a).length === Object.keys(b).length;
};
export const RigaChat = memo(RigaChatBase, stesseProps);
