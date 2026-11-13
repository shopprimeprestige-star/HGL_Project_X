import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { AlertCircle, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LeadDialog } from "@/crm/LeadDialog";
import { QuickStatusDialog, type SceltaOrario } from "@/crm/QuickStatusDialog";
import { useChiusura } from "@/crm/ChiusuraDialog";
import type { Lead, LeadData, LeadStatus } from "@/crm/types";
import { Conversazione } from "./Conversazione";
import { ElencoChatBaileys } from "./ElencoChatBaileys";
import type { ChatItem, ChatWaApi } from "./tipi";
import { AbbinaScheda } from "./AbbinaScheda";
import { StatoPonte } from "./StatoPonte";
import { useChatWa } from "./useChatWa";
import { leggiRicercaChat } from "./stato";
import { usaAltezzaVisibile } from "./usaAltezzaVisibile";

/** ── «WHATSAPP BAILEYS»: LA PAGINA (commessa 2026-11-13-chat-baileys, T10) ──
 *
 *  Stessa impalcatura di `PaginaChat.tsx`, riusata come MODELLO (non come
 *  componente): apertura chat per `?chat=<id>`, creazione/abbinamento scheda,
 *  stato rapido, il trucco della tastiera sul telefono. Duplicata qui perché
 *  `PaginaChat.tsx` non ha prove automatiche che la proteggano da una
 *  regressione (PIANO.md, «Decido io»): un file nuovo isola il rischio.
 *  Sola lettura (risposta del titolare, 13/11/2026): niente vista «modelli»,
 *  niente pannello Oggi, niente costi/archiviazione — non richiesti dalla
 *  SPEC per questa sezione. `Conversazione` monta con `modoPonte`: niente AI,
 *  niente casella, solo la fascia fissa che dice dove scrivere davvero. ────── */

/** «10:42»: l'ora dell'ultima lettura riuscita, come la legge il titolare. */
const oraBreve = (ms: number) =>
  new Date(ms).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

const PERCORSO = "/CRM/whatsapp-baileys" as const;

/** La pagina /CRM/whatsapp-baileys: intestazione, l'elenco a sola lettura, la
 *  conversazione in `modoPonte`, i dialoghi di scheda. */
export function PaginaChatBaileys() {
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
  const [quickScelta, setQuickScelta] = useState<SceltaOrario | null>(null);
  //  La finestra delle tre chiusure vinte: si porta dietro i suoi stati.
  const chiusura = useChiusura();

  const api = useChatWa({
    intercettaChiusura: (lead, stato) => chiusura.intercetta(lead, stato),
    apriStatoRapido: (lead, stato, scelta) => {
      setQuickLead(lead);
      setQuickStatus(stato);
      setQuickScelta(scelta ?? null);
      setQuickOpen(true);
    },
  });

  // ── LA CHAT APERTA STA NELL'INDIRIZZO (D21, come /CRM/whatsapp) ──────────
  const navigate = useNavigate();
  const router = useRouter();
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
      void navigate({ to: PERCORSO, search: {}, replace: true });
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
      void navigate({ to: PERCORSO, search: {}, replace: true });
    }
  }, [chatUrl, chatDaUrl, api.caricamento, navigate]);

  // L'elenco chiama `apri` con il telefono: qui diventa navigazione per id.
  const apriChat = (chiave: string) => {
    const c = api.chats.find((x) => x.phone === chiave || x.contact?.id === chiave);
    if (!c) return;
    if (!c.contact) {
      setTelefonoLocale(c.phone);
      if (chatUrl) void navigate({ to: PERCORSO, search: {}, replace: true });
      return;
    }
    setTelefonoLocale(null);
    if (chatUrl === c.contact.id.toLowerCase()) return;
    if (!chatUrl) aperturaPush.current = true;
    void navigate({
      to: PERCORSO,
      search: { chat: c.contact.id },
      replace: Boolean(chatUrl),
    });
  };

  // I figli ricevono l'`apri` che naviga; il resto dell'api è quello dell'hook.
  const apiPagina: ChatWaApi = { ...api, apri: apriChat };

  /** Numero sconosciuto → dialog nuovo lead con telefono prefillato. */
  const creaScheda = (chat: ChatItem) => {
    setLeadDialogLead(null);
    setLeadDialogPrefill({
      telefono: chat.phone,
      nome: chat.contact?.display_name || "",
    });
    setLeadDialogOpen(true);
  };

  //  «Abbina a una scheda»: `api.abbina` lavora sulla chat aperta, quindi prima
  //  si apre quella chat; la finestra passa anche il numero.
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

  //  ── SUL TELEFONO, CON UNA CHAT APERTA, LA CHAT È LO SCHERMO ──────────────
  //  Stesso trucco di PaginaChat.tsx (guasto del 28/10/2026): sotto 768 px la
  //  conversazione aperta è fissata sopra tutto e segue l'area visibile.
  const misure = visibile
    ? ({
        "--chat-h": `calc(${visibile.altezza}px - 3rem)`,
        "--vista-h": `${visibile.altezza}px`,
        "--vista-alto": `${visibile.alto}px`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={cn(
        "group/chat flex flex-col overflow-hidden bg-background",
        "h-[var(--chat-h,calc(100dvh-3rem))]",
        conversazioneAperta &&
          "max-md:fixed max-md:inset-x-0 max-md:z-40 max-md:top-[var(--vista-alto,0px)] max-md:h-[var(--vista-h,100dvh)]",
      )}
      data-tastiera={visibile?.tastiera ? "si" : undefined}
      style={misure}
    >
      <div
        className={cn(
          "shrink-0 border-b border-border bg-card px-3 py-2 md:px-4 md:py-2",
          conversazioneAperta ? "hidden md:block" : "block",
        )}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-600">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold leading-tight text-foreground">
                WhatsApp Baileys
              </h1>
              <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                Le chat del tuo telefono, portate dal ponte
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void api.aggiorna()}
              disabled={api.aggiornando}
              className="h-11 w-11 flex-col gap-0 px-0 text-[10px] leading-none tabular-nums md:h-8 md:w-auto md:flex-row md:gap-1.5 md:px-3 md:text-xs"
              title="Aggiorna le chat"
              aria-label={
                api.aggiornatoIl
                  ? `Aggiorna le chat, ultimo aggiornamento ${oraBreve(api.aggiornatoIl)}`
                  : "Aggiorna le chat"
              }
            >
              {api.aggiornando ? (
                <Loader2 className="h-4 w-4 animate-spin md:h-3.5 md:w-3.5" />
              ) : (
                <RefreshCw className="h-4 w-4 md:h-3.5 md:w-3.5" />
              )}
              {api.aggiornatoIl && (
                <span className="mt-0.5 md:mt-0">
                  <span className="hidden md:inline">Aggiornato </span>
                  {oraBreve(api.aggiornatoIl)}
                </span>
              )}
              {!api.aggiornatoIl && <span className="hidden md:inline">Aggiorna</span>}
            </Button>
          </div>
        </div>
      </div>

      {/*  Il ponte del Mac fermo o scollegato: compare solo se qualcosa non va. */}
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

      <div className="flex flex-1 min-h-0">
        {/* Colonna elenco: larghezza e visibilità qui, non nel figlio (R12, come PaginaChat) */}
        <div
          className={cn(
            "w-full flex-col md:flex md:w-[300px] md:shrink-0 lg:w-[340px]",
            conversazioneAperta ? "hidden" : "flex",
          )}
        >
          <ElencoChatBaileys
            chats={api.chats}
            attivo={api.attiva?.phone ?? null}
            onApri={apriChat}
            onCreaScheda={creaScheda}
          />
        </div>

        {/* Colonna conversazione */}
        <div className={cn("min-w-0 flex-1 md:block", conversazioneAperta ? "block" : "hidden")}>
          <Conversazione
            api={apiPagina}
            modoPonte
            onIndietro={tornaElenco}
            onApriLead={openHeaderEdit}
            onCreaScheda={creaScheda}
            onAbbina={abbinaChat}
          />
        </div>
      </div>

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
            setQuickScelta(null);
          }
        }}
        lead={quickLead}
        newStatus={quickStatus}
        scelta={quickScelta}
      />
      {chiusura.finestra}
    </div>
  );
}
