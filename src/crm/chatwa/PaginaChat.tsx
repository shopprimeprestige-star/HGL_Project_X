import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { AlertCircle, MessageCircle } from "lucide-react";
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
import { useChatWa } from "./useChatWa";
import { usaAltezzaVisibile } from "./usaAltezzaVisibile";

/** Le due viste della pagina: le conversazioni vere e i testi che le popolano. */
type Vista = "chat" | "modelli";

/** La pagina /CRM/whatsapp: compone intestazione, le due viste, i dialoghi.
 *  ⚠️ Larghezza e visibilità delle colonne le decide SOLO questo file (R12): i
 *  figli (`ElencoChat`, `Conversazione`) riempiono il loro contenitore. */
export function PaginaChat() {
  const [vista, setVista] = useState<Vista>("chat");
  const [leadsPanelOpen, setLeadsPanelOpen] = useState(true);
  //  Sotto 1280 px la colonna «Lead CRM» è un foglio che si apre a richiesta.
  const [foglioLead, setFoglioLead] = useState(false);
  const altezzaVisibile = usaAltezzaVisibile();

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
  const { chat: chatUrl } = useSearch({ from: "/CRM/whatsapp" });
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
      void navigate({ to: "/CRM/whatsapp", search: {}, replace: true });
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
      void navigate({ to: "/CRM/whatsapp", search: {}, replace: true });
    }
  }, [chatUrl, chatDaUrl, api.caricamento, navigate]);

  // L'elenco chiama `apri` con il telefono: qui diventa navigazione per id.
  const apriChat = (chiave: string) => {
    const c = api.chats.find((x) => x.phone === chiave || x.contact?.id === chiave);
    if (!c) return;
    if (!c.contact) {
      setTelefonoLocale(c.phone);
      if (chatUrl) void navigate({ to: "/CRM/whatsapp", search: {}, replace: true });
      return;
    }
    setTelefonoLocale(null);
    if (chatUrl === c.contact.id.toLowerCase()) return;
    if (!chatUrl) aperturaPush.current = true;
    void navigate({
      to: "/CRM/whatsapp",
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

  return (
    <div
      className="flex flex-col h-[calc(100dvh-3rem)] overflow-hidden bg-background"
      // La tastiera iOS accorcia `visualViewport` ma non `dvh`: se lo sappiamo, ci si dimensiona su quello.
      style={altezzaVisibile ? { height: `calc(${altezzaVisibile}px - 3rem)` } : undefined}
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
              {api.hasConfig === false
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
          {api.hasConfig === false && (
            <Badge
              variant="outline"
              className="hidden bg-amber-50 text-amber-700 border-amber-200 gap-1 font-medium md:inline-flex"
            >
              <AlertCircle className="h-3 w-3" /> Configura in Impostazioni
            </Badge>
          )}
          {vista === "chat" && (
            <>
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
