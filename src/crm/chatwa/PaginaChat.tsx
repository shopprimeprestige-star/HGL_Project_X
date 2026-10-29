import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { AlertCircle, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { WhatsAppLeadsPanel } from "@/crm/WhatsAppLeadsPanel";
import { LeadDialog } from "@/crm/LeadDialog";
import { QuickStatusDialog } from "@/crm/QuickStatusDialog";
import { useChiusura } from "@/crm/ChiusuraDialog";
import { Segmento } from "@/crm/ui";
import type { Lead, LeadData, LeadStatus } from "@/crm/types";
//  ⚠️ L'editor dei testi sta in un file suo perché lo mostra anche la scheda
//   «Messaggi» delle Impostazioni: due schermate gemelle per la stessa
//   configurazione si scostano al primo ritocco.
import { EditorMessaggi } from "@/crm/EditorMessaggi";
import { Conversazione } from "./Conversazione";
import { ElencoChat } from "./ElencoChat";
import type { ChatItem, ChatWaApi } from "./tipi";
import { AbbinaScheda } from "./AbbinaScheda";
import { StatoPonte } from "./StatoPonte";
import { useChatWa } from "./useChatWa";
import { usaAltezzaVisibile } from "./usaAltezzaVisibile";

/** Le due viste della pagina: le conversazioni vere e i testi che le popolano. */
type Vista = "chat" | "modelli";

/** Dove vive la pagina: dentro il CRM, oppure da sola a schermo intero (/chat). */
export type PercorsoChat = "/CRM/whatsapp" | "/chat";

/** «10:42»: l'ora dell'ultima lettura riuscita, come la legge il titolare. */
const oraBreve = (ms: number) =>
  new Date(ms).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

/** La pagina /CRM/whatsapp: compone intestazione, le due viste, i dialoghi.
 *  ⚠️ Larghezza e visibilità delle colonne le decide SOLO questo file (R12): i
 *  figli (`ElencoChat`, `Conversazione`) riempiono il loro contenitore.
 *  ── LA STESSA PAGINA, DA SOLA (28/10/2026) ─────────────────────────────────
 *  Richiesta del titolare: un link con SOLO la chat, a schermo intero (/chat).
 *  È questa stessa pagina, non una copia: cambia l'indirizzo su cui si naviga
 *  (`percorso`) e, a schermo intero, l'altezza non toglie i 3rem della testata
 *  del CRM, che lì non c'è. */
export function PaginaChat({
  percorso = "/CRM/whatsapp",
}: {
  percorso?: PercorsoChat;
} = {}) {
  const schermoIntero = percorso === "/chat";
  const [vista, setVista] = useState<Vista>("chat");
  const [leadsPanelOpen, setLeadsPanelOpen] = useState(true);
  //  Sotto 1280 px la colonna «Lead CRM» è un foglio che si apre a richiesta.
  const [foglioLead, setFoglioLead] = useState(false);
  const visibile = usaAltezzaVisibile();

  // LeadDialog (modifica lead esistente o creazione nuovo lead da numero sconosciuto)
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadDialogLead, setLeadDialogLead] = useState<Lead | null>(null);
  const [leadDialogPrefill, setLeadDialogPrefill] = useState<Partial<LeadData> | undefined>(
    undefined,
  );

  // Quick status popup (stessi popup della pagina Lead)
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [quickStatus, setQuickStatus] = useState<LeadStatus | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  //  La finestra delle tre chiusure vinte: si porta dietro i suoi stati.
  const chiusura = useChiusura();

  const api = useChatWa({
    intercettaChiusura: (lead, stato) => chiusura.intercetta(lead, stato),
    apriStatoRapido: (lead, stato) => {
      setQuickLead(lead);
      setQuickStatus(stato);
      setQuickOpen(true);
    },
  });

  // ── LA CHAT APERTA STA NELL'INDIRIZZO (D21) ──────────────────────────────
  //  `?chat=<id del contatto>`, mai il numero. Aprire una chat da un elenco
  //  senza chat è una voce di cronologia nuova (il tasto indietro del telefono
  //  torna all'elenco); passare da una chat all'altra è `replace`.
  //  Una chat senza riga contatto (rarissima: solo storico) non ha un id da
  //  mettere nell'indirizzo: resta in `telefonoLocale`, e lì il gesto indietro
  //  del telefono esce dalla pagina (accettato, R13); la freccia ← funziona.
  const navigate = useNavigate();
  const router = useRouter();
  //  `strict: false`: la pagina vive su due rotte, entrambe con `leggiRicercaChat`.
  const { chat: chatUrl } = useSearch({ strict: false }) as { chat?: string };
  const [telefonoLocale, setTelefonoLocale] = useState<string | null>(null);
  /** Vero se la chat si è aperta con un `navigate` in questa visita: ← può fare `history.back()`. */
  const aperturaPush = useRef(false);

  const chatDaUrl = useMemo(
    () =>
      chatUrl ? (api.chats.find((c) => c.contact?.id.toLowerCase() === chatUrl) ?? null) : null,
    [api.chats, chatUrl],
  );
  const telefonoScelto = chatDaUrl?.phone ?? telefonoLocale;
  /** Sul telefono: mostra la conversazione a tutto schermo invece dell'elenco. */
  const conversazioneAperta = Boolean(chatUrl || telefonoLocale);

  useEffect(() => {
    if (!chatUrl) aperturaPush.current = false;
  }, [chatUrl]);

  const tornaElenco = () => {
    if (telefonoLocale) {
      setTelefonoLocale(null);
    } else if (aperturaPush.current) {
      aperturaPush.current = false;
      router.history.back();
    } else {
      // Aperta da un indirizzo diretto: un «indietro» uscirebbe dal CRM.
      void navigate({ to: percorso, search: {}, replace: true });
    }
  };

  // L'hook apre la chat per telefono: lo allineo a ciò che dice l'indirizzo.
  const apriNellHook = useRef(api.apri);
  apriNellHook.current = api.apri;
  useEffect(() => {
    apriNellHook.current(telefonoScelto ?? "");
  }, [telefonoScelto]);

  // Una chat chiusa dall'hook (elimina) mentre l'indirizzo la dà ancora aperta: si torna all'elenco.
  const hookLaVede = useRef(false);
  useEffect(() => {
    if (!telefonoScelto) {
      hookLaVede.current = false;
      return;
    }
    if (api.attiva?.phone === telefonoScelto) hookLaVede.current = true;
    else if (hookLaVede.current && !api.attiva) {
      hookLaVede.current = false;
      tornaElenco();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.attiva?.phone, telefonoScelto]);

  // `?chat=` con un id che non c'è (chat sparita, link vecchio): si ripulisce, resta l'elenco.
  useEffect(() => {
    if (chatUrl && !chatDaUrl && !api.caricamento) {
      void navigate({ to: percorso, search: {}, replace: true });
    }
  }, [chatUrl, chatDaUrl, api.caricamento, navigate, percorso]);

  // L'elenco chiama `apri` con il telefono: qui diventa navigazione per id.
  const apriChat = (chiave: string) => {
    const c = api.chats.find((x) => x.phone === chiave || x.contact?.id === chiave);
    if (!c) return;
    if (!c.contact) {
      setTelefonoLocale(c.phone);
      if (chatUrl) void navigate({ to: percorso, search: {}, replace: true });
      return;
    }
    setTelefonoLocale(null);
    if (chatUrl === c.contact.id.toLowerCase()) return;
    if (!chatUrl) aperturaPush.current = true;
    void navigate({
      to: percorso,
      search: { chat: c.contact.id },
      replace: Boolean(chatUrl),
    });
  };

  // I figli ricevono l'`apri` che naviga; il resto dell'api è quello dell'hook.
  const apiPagina: ChatWaApi = { ...api, apri: apriChat };

  /** Numero sconosciuto → dialog nuovo lead con telefono prefillato (l'utente sceglie consulente, fascia oraria, ecc.). */
  const creaScheda = (chat: ChatItem) => {
    setLeadDialogLead(null);
    setLeadDialogPrefill({
      telefono: chat.phone,
      nome: chat.contact?.display_name || "",
    });
    setLeadDialogOpen(true);
  };

  //  «Abbina a una scheda»: `api.abbina` lavora sulla chat aperta, quindi prima
  //  si apre quella chat; la finestra passa anche il numero, e l'hook rifiuta se
  //  la chat aperta nel frattempo è un'altra.
  const [daAbbinare, setDaAbbinare] = useState<ChatItem | null>(null);
  const abbinaChat = (c: ChatItem) => {
    apiPagina.apri(c.phone);
    setDaAbbinare(c);
  };

  const openHeaderEdit = () => {
    const chat = api.attiva;
    if (!chat) return;
    if (chat.lead) {
      setLeadDialogLead(chat.lead);
      setLeadDialogPrefill(undefined);
      setLeadDialogOpen(true);
    } else {
      creaScheda(chat);
    }
  };

  /*  ── SUL TELEFONO, CON UNA CHAT APERTA, LA CHAT È LO SCHERMO ─────────────
      Guasto del 28/10/2026 (iPhone, browser dentro un'app): toccando la casella
      la pagina diventava bianca. La chat stava DENTRO la pagina del CRM, che è
      alta quanto lo schermo grande (`min-h-screen`), e si accorciava sulla
      tastiera restando in cima; iOS intanto spostava la vista in giù per
      mostrare il campo, cioè sul fondo vuoto della pagina.
      Ora sotto 768 px la conversazione aperta è fissata sopra tutto e segue
      l'area visibile: in alto dove la vista è scesa (`--vista-alto`), alta
      quanto lei (`--vista-h`). La casella resta appena sopra la tastiera come
      nell'app WhatsApp; la ← torna all'elenco, dove c'è la barra del CRM.
      Dal tablet in su resta nella pagina, alta quanto la vista meno la barra. */
  const chatSchermo = vista === "chat" && conversazioneAperta;
  const misure = visibile
    ? ({
        "--chat-h": schermoIntero ? `${visibile.altezza}px` : `calc(${visibile.altezza}px - 3rem)`,
        "--vista-h": `${visibile.altezza}px`,
        "--vista-alto": `${visibile.alto}px`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={cn(
        "group/chat flex flex-col overflow-hidden bg-background",
        schermoIntero ? "h-[var(--chat-h,100dvh)]" : "h-[var(--chat-h,calc(100dvh-3rem))]",
        chatSchermo &&
          "max-md:fixed max-md:inset-x-0 max-md:z-40 max-md:top-[var(--vista-alto,0px)] max-md:h-[var(--vista-h,100dvh)]",
      )}
      data-tastiera={visibile?.tastiera ? "si" : undefined}
      style={misure}
    >
      {/* Header sezione — coerente col resto del CRM. Sul telefono, con una chat aperta,
          sparisce: la conversazione ha la sua barra e prende tutto lo schermo. */}
      <div
        className={cn(
          "border-b border-border bg-card px-3 py-2 md:px-4 md:py-2.5 flex-wrap items-center gap-x-3 gap-y-2",
          vista === "chat" && conversazioneAperta ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-md bg-emerald-50 grid place-items-center text-emerald-600 border border-emerald-100">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-foreground">
              WhatsApp Business
            </h1>
            <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
              {api.stato === "configura"
                ? "Credenziali non configurate"
                : vista === "chat"
                  ? "Conversazioni in tempo reale"
                  : "I testi che partono da tutto il CRM"}
            </p>
          </div>
        </div>
        {/*  Due viste, non due pagine: i messaggi si correggono mentre si
            scrive, non andando a cercare un pannello di impostazioni.
            Sul telefono vanno in una riga loro, a scorrimento se non ci stanno. */}
        <div className="order-last flex w-full items-center gap-1.5 overflow-x-auto md:order-none md:w-auto">
          <Segmento
            attivo={vista === "chat"}
            onClick={() => setVista("chat")}
            className="min-h-11 md:min-h-0"
          >
            Conversazioni
          </Segmento>
          <Segmento
            attivo={vista === "modelli"}
            onClick={() => setVista("modelli")}
            titolo="I messaggi preimpostati per ogni stato"
            className="min-h-11 whitespace-nowrap md:min-h-0"
          >
            Messaggi preimpostati
          </Segmento>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {api.stato === "configura" && (
            <Badge
              variant="outline"
              className="hidden bg-amber-50 text-amber-700 border-amber-200 gap-1 font-medium md:inline-flex"
            >
              <AlertCircle className="h-3 w-3" /> Configura in Impostazioni
            </Badge>
          )}
          {vista === "chat" && (
            <>
              {/*  «Aggiorna» (29/10/2026): rilegge tutto a mano. L'ora dell'ultima lettura
                  sta SCRITTA nel tasto: sul telefono un `title` non si vede, e «Aggiornato
                  10:42» dice subito se la pagina è ferma. */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void api.aggiorna()}
                disabled={api.aggiornando}
                className="h-11 gap-1.5 text-xs tabular-nums md:h-8"
                title="Aggiorna le chat"
              >
                {api.aggiornando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {api.aggiornatoIl ? `Aggiornato ${oraBreve(api.aggiornatoIl)}` : "Aggiorna"}
              </Button>
              {/* Sotto 1280 px «Lead CRM» è un foglio; da 1280 in su una colonna che si nasconde. */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFoglioLead(true)}
                className="h-11 text-xs md:h-8 xl:hidden"
                title="Apri l'elenco dei lead"
              >
                Lead
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLeadsPanelOpen((v) => !v)}
                className="hidden h-8 text-xs xl:inline-flex"
                title={leadsPanelOpen ? "Nascondi pannello lead" : "Mostra pannello lead"}
              >
                {leadsPanelOpen ? "Nascondi lead" : "Mostra lead"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/*  Il ponte del Mac fermo o scollegato (T8): compare solo se qualcosa non va. */}
      <StatoPonte />

      {api.erroreLettura && (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{api.erroreLettura}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void api.aggiorna()}
            disabled={api.aggiornando}
            className="h-9 shrink-0 text-xs"
          >
            Aggiorna
          </Button>
        </div>
      )}
      {vista === "modelli" && <EditorMessaggi />}

      {/*  La chat resta montata mentre si guardano i modelli: tornando indietro
          si ritrova la conversazione aperta e lo scorrimento dov'era.
          Telefono: o l'elenco o la conversazione, a tutto schermo (D20). Da 768 px
          in su le due colonne; «Lead CRM» inline solo da 1280 px. */}
      <div className={vista === "chat" ? "flex flex-1 min-h-0" : "hidden"}>
        {/* Colonna elenco: larghezza e visibilità qui, non nel figlio (R12) */}
        <div
          className={cn(
            "w-full flex-col md:flex md:w-[340px] md:shrink-0",
            conversazioneAperta ? "hidden" : "flex",
          )}
        >
          <ElencoChat api={apiPagina} onCreaScheda={creaScheda} onAbbina={abbinaChat} />
        </div>

        {/* Colonna conversazione */}
        <div className={cn("min-w-0 flex-1 md:block", conversazioneAperta ? "block" : "hidden")}>
          <Conversazione
            api={apiPagina}
            onIndietro={tornaElenco}
            onApriLead={openHeaderEdit}
            onCreaScheda={creaScheda}
            onAbbina={abbinaChat}
          />
        </div>

        {/* Pannello lead a destra — collassabile, solo da 1280 px */}
        {leadsPanelOpen && (
          <div className="hidden xl:flex">
            <WhatsAppLeadsPanel onClose={() => setLeadsPanelOpen(false)} />
          </div>
        )}
      </div>

      {/* Foglio «Lead CRM» sotto 1280 px: a tutta larghezza sul telefono.
          La larghezza fissa del pannello (340 px) la annulla il contenitore. */}
      <Sheet open={foglioLead} onOpenChange={setFoglioLead}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[400px]">
          <SheetTitle className="sr-only">Lead CRM</SheetTitle>
          <SheetDescription className="sr-only">
            Elenco dei lead del CRM, per mandare un messaggio.
          </SheetDescription>
          <div className="flex h-full min-h-0 flex-col [&>aside]:min-h-0 [&>aside]:w-full [&>aside]:flex-1 [&>aside]:border-l-0 [&>aside>div:first-child]:pr-11">
            {foglioLead && <WhatsAppLeadsPanel />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog: modifica lead esistente o crea nuovo da numero sconosciuto */}
      <AbbinaScheda chat={daAbbinare} api={apiPagina} onChiudi={() => setDaAbbinare(null)} />
      <LeadDialog
        open={leadDialogOpen}
        onOpenChange={(v) => {
          setLeadDialogOpen(v);
          if (!v) {
            setLeadDialogLead(null);
            setLeadDialogPrefill(undefined);
          }
        }}
        lead={leadDialogLead}
        prefill={leadDialogPrefill}
      />

      {/* Quick status popup — stessi popup della pagina Leads, sfondo bianco coerente CRM */}
      <QuickStatusDialog
        open={quickOpen}
        onOpenChange={(v) => {
          setQuickOpen(v);
          if (!v) {
            setQuickLead(null);
            setQuickStatus(null);
          }
        }}
        lead={quickLead}
        newStatus={quickStatus}
      />
      {chiusura.finestra}
    </div>
  );
}
