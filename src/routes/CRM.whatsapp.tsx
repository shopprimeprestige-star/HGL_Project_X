import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCRM } from "@/crm/CRMContext";
import { useAuth } from "@/crm/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Send,
  Filter,
  CheckCheck,
  Check,
  MessageCircle,
  AlertCircle,
  Loader2,
  Trash2,
  FileText,
  RotateCcw,
  Save,
  TriangleAlert,
  Eye,
} from "lucide-react";
import { WhatsAppLeadsPanel } from "@/crm/WhatsAppLeadsPanel";
import { LeadDialog } from "@/crm/LeadDialog";
import { QuickStatusDialog, requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { useChiusura } from "@/crm/ChiusuraDialog";
//  Il selettore di stato è uno solo in tutto il CRM (crm/SelettoreStatoDialog):
//  qui c'era una tendina che ignorava `statiPer`.
import { PastigliaStato } from "@/crm/SelettoreStatoDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ALL_LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_COLOR,
  type Lead,
  type LeadStatus,
  type LeadData,
} from "@/crm/types";
import { Segmento, Vuoto, classiStato } from "@/crm/ui";
//  ⚠️ L'editor dei testi sta in un file suo perché lo mostra anche la scheda
//   «Messaggi» delle Impostazioni: due schermate gemelle per la stessa
//   configurazione si scostano al primo ritocco.
import { EditorMessaggi, caricaModelliSalvati } from "@/crm/EditorMessaggi";
import {
  CHIAVE_CONFIG_MODELLI,
  ETICHETTA_MODELLO_EXTRA,
  SEGNAPOSTI,
  componiMessaggio,
  controllaModello,
  getWhatsAppMessageForStatus,
  impostaModelliPersonalizzati,
  leadDiEsempio,
  modelliCorrenti,
  modelloModificato,
  segnapostiResidui,
  valoriDaLead,
  MODELLI_ORIGINALI,
  type ChiaveModello,
  type Problema,
} from "@/crm/whatsapp";

export const Route = createFileRoute("/CRM/whatsapp")({
  component: WhatsAppPage,
});

/** Le due viste della pagina: le conversazioni vere e i testi che le popolano. */
type Vista = "chat" | "modelli";

type WhatsAppFilter = "all" | "unread" | "with-lead" | "unknown";

interface WaMessageRow {
  id: string;
  user_id: string;
  lead_id: string | null;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  body: string | null;
  status: string;
  wa_message_id: string | null;
  error_message: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

interface WaContactRow {
  id: string;
  user_id: string;
  phone_e164: string;
  lead_id: string | null;
  display_name: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

interface ChatItem {
  phone: string;
  leadId: string | null;
  lead: Lead | null;
  contact: WaContactRow | null;
  lastMessage: WaMessageRow | null;
  unread: number;
}

function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function phonesMatch(a: string, b: string): boolean {
  const x = digitsOnly(a);
  const y = digitsOnly(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // tolleranza prefisso internazionale: matcha sugli ultimi 9 cifre
  return x.slice(-9) === y.slice(-9);
}

function initials(nome: string, cognome: string): string {
  const a = (nome || "").trim()[0] || "?";
  const b = (cognome || "").trim()[0] || "";
  return (a + b).toUpperCase();
}

function formatDateIT(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTimeIT(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return "Ieri";
  }
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

function previewText(body: string | null): string {
  if (!body) return "";
  return body.length > 60 ? body.slice(0, 60) + "…" : body;
}

function WhatsAppPage() {
  const { user } = useAuth();
  const { leads, updateLead, consultants } = useCRM();
  const [vista, setVista] = useState<Vista>("chat");
  const [filter, setFilter] = useState<WhatsAppFilter>("all");
  const [search, setSearch] = useState("");
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<WaMessageRow[]>([]);
  const [contacts, setContacts] = useState<WaContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /** ── I TESTI MODIFICATI VANNO CARICATI QUI, NON NELL'EDITOR ───────────────
   *  Gli stessi modelli li compongono otto pagine (agenda, trattative, scheda
   *  cliente, area consulenti…) leggendo la copia in memoria di whatsapp.ts.
   *  Se li caricasse solo l'editor, chi non apre mai la scheda "Messaggi"
   *  scriverebbe ai clienti con i testi originali senza accorgersene. */
  useEffect(() => {
    void caricaModelliSalvati();
  }, []);

  // Carico config WhatsApp per mostrare banner se mancano credenziali
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (
                k: string,
                v: string,
              ) => {
                maybeSingle: () => Promise<{
                  data: { phone_number_id?: string | null; access_token?: string | null } | null;
                }>;
              };
            };
          };
        }
      )
        .from("whatsapp_settings")
        .select("phone_number_id,access_token")
        .eq("user_id", user.id)
        .maybeSingle();
      setHasConfig(Boolean(data?.phone_number_id && data?.access_token));
    })();
  }, [user]);

  // Caricamento messaggi + contatti
  const reload = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: msgs }, { data: cts }] = await Promise.all([
      (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (
                k: string,
                v: string,
              ) => {
                order: (
                  c: string,
                  o: { ascending: boolean },
                ) => {
                  limit: (n: number) => Promise<{ data: WaMessageRow[] | null }>;
                };
              };
            };
          };
        }
      )
        .from("whatsapp_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(2000),
      (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (k: string, v: string) => Promise<{ data: WaContactRow[] | null }>;
            };
          };
        }
      )
        .from("whatsapp_contacts")
        .select("*")
        .eq("user_id", user.id),
    ]);
    setMessages(msgs ?? []);
    setContacts(cts ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime: ricarica al volo su INSERT/UPDATE
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`wa-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void reload();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_contacts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void reload();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Costruisco l'elenco chat: una per phone unico (interlocutore = "altro" rispetto a noi)
  const chats = useMemo<ChatItem[]>(() => {
    const map = new Map<string, ChatItem>();

    // partenza: contatti
    for (const c of contacts) {
      const lead = c.lead_id ? (leads.find((l) => l.id === c.lead_id) ?? null) : null;
      const linkedLead =
        lead ?? leads.find((l) => phonesMatch(l.data.telefono || "", c.phone_e164)) ?? null;
      map.set(c.phone_e164, {
        phone: c.phone_e164,
        leadId: linkedLead?.id ?? c.lead_id ?? null,
        lead: linkedLead,
        contact: c,
        lastMessage: null,
        unread: c.unread_count || 0,
      });
    }

    // aggiungo dai messaggi (per phone "interlocutore")
    for (const m of messages) {
      const peer = m.direction === "inbound" ? m.from_number : m.to_number;
      // se peer è un phone_number_id (nessun +), lo skip
      if (!peer || !peer.startsWith("+")) {
        // outbound persistito con peer = numero destinatario (ok). inbound: m.from_number è già normalizzato +...
        // se non parte con + skippiamo (è solo phone_number_id meta)
        if (m.direction === "outbound") {
          // peer = m.to_number normalizzato
        } else {
          continue;
        }
      }
      const key = peer.startsWith("+") ? peer : `+${peer}`;
      let item = map.get(key);
      if (!item) {
        const linkedLead = leads.find((l) => phonesMatch(l.data.telefono || "", key)) ?? null;
        item = {
          phone: key,
          leadId: m.lead_id ?? linkedLead?.id ?? null,
          lead: linkedLead,
          contact: null,
          lastMessage: null,
          unread: 0,
        };
        map.set(key, item);
      }
      if (!item.lastMessage || new Date(m.created_at) > new Date(item.lastMessage.created_at)) {
        item.lastMessage = m;
      }
    }

    // ordina per ultimo messaggio
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.lastMessage
        ? new Date(a.lastMessage.created_at).getTime()
        : a.contact?.last_message_at
          ? new Date(a.contact.last_message_at).getTime()
          : 0;
      const tb = b.lastMessage
        ? new Date(b.lastMessage.created_at).getTime()
        : b.contact?.last_message_at
          ? new Date(b.contact.last_message_at).getTime()
          : 0;
      return tb - ta;
    });
  }, [messages, contacts, leads]);

  const visibleChats = useMemo(() => {
    return chats.filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if (filter === "with-lead" && !c.lead) return false;
      if (filter === "unknown" && c.lead) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = `${c.lead?.data.nome ?? ""} ${c.lead?.data.cognome ?? ""}`.toLowerCase();
        if (!name.includes(q) && !c.phone.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [chats, filter, search]);

  const activeChat = useMemo<ChatItem | null>(() => {
    if (!activePhone) return null;
    return chats.find((c) => c.phone === activePhone) ?? null;
  }, [activePhone, chats]);

  const activeMessages = useMemo<WaMessageRow[]>(() => {
    if (!activePhone) return [];
    return messages.filter((m) => {
      const peer = m.direction === "inbound" ? m.from_number : m.to_number;
      const key = peer?.startsWith("+") ? peer : `+${peer}`;
      return key === activePhone;
    });
  }, [messages, activePhone]);

  // Auto-scroll bottom su nuovi messaggi
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages.length, activePhone]);

  // Mark contact as read quando apro la chat
  useEffect(() => {
    if (!user || !activeChat?.contact || activeChat.contact.unread_count === 0) return;
    void (
      supabase as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => {
            eq: (
              k: string,
              v: string,
            ) => {
              eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        };
      }
    )
      .from("whatsapp_contacts")
      .update({ unread_count: 0 })
      .eq("user_id", user.id)
      .eq("phone_e164", activeChat.contact.phone_e164);
  }, [user, activeChat]);

  /** ── I SEGNAPOSTO RIMASTI NELLA BOZZA ────────────────────────────────────
   *  Il testo qui dentro parte così com'è: se è stato incollato da un modello,
   *  un `{nome}` non sostituito arriva scritto alla lettera sul telefono del
   *  cliente. Si vede prima di premere invio, e all'invio si chiede conferma. */
  const residuiBozza = useMemo(() => segnapostiResidui(draft), [draft]);

  const sendDraft = async () => {
    if (!user || !draft.trim() || !activeChat) return;
    if (!hasConfig) {
      toast.error("Configura prima le credenziali WhatsApp in Impostazioni → WhatsApp");
      return;
    }
    if (
      residuiBozza.length > 0 &&
      !confirm(
        `Nel messaggio ci sono segnaposto non sostituiti: ${residuiBozza.join("  ")}\n\n` +
          "Arriverebbero scritti così al cliente. Inviare lo stesso?",
      )
    )
      return;
    setSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessione scaduta");
      const res = await fetch("/api/whatsapp-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: activeChat.phone,
          body: draft.trim(),
          leadId: activeChat.leadId,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !json.ok) {
        toast.error(`Invio fallito: ${json.message || json.error || `HTTP ${res.status}`}`);
        return;
      }
      setDraft("");
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore invio");
    } finally {
      setSending(false);
    }
  };

  /** Cambio stato del lead — stesso comportamento della pagina Leads:
   *  se lo stato richiede campi extra apre QuickStatusDialog,
   *  altrimenti applica direttamente e precompila il template WA nel composer. */
  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!activeChat?.lead) return;
    if (newStatus === activeChat.lead.data.stato) return;
    //  Le tre chiusure vinte hanno la loro finestra, che scrive stato, importi
    //  e modo di consegna in un salvataggio solo. ⚠️ Il ramo va PRIMA di
    //  `requiresAnyDialog` e non scrive niente da sé: vedi ChiusuraDialog.
    if (chiusura.intercetta(activeChat.lead, newStatus)) return;
    if (requiresAnyDialog(newStatus)) {
      setQuickLead(activeChat.lead);
      setQuickStatus(newStatus);
      setQuickOpen(true);
      return;
    }
    try {
      await updateLead(activeChat.lead.id, { stato: newStatus });
      const refreshed = { ...activeChat.lead, data: { ...activeChat.lead.data, stato: newStatus } };
      //  Il nome del consulente serve alla firma: senza, la riga sparisce e il
      //  messaggio si chiude con "A presto," e basta.
      const consulente = consultants.find((c) => c.id === refreshed.data.consulenteId)?.data.nome;
      const template = getWhatsAppMessageForStatus(refreshed, consulente);
      setDraft(template);
      toast.success(`Stato → "${LEAD_STATUS_LABEL[newStatus]}". Template precompilato.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore cambio stato");
    }
  };

  /** Elimina TUTTI i messaggi WA della chat corrente lato CRM (non tocca WhatsApp del destinatario). */
  const deleteChat = async () => {
    if (!user || !activeChat) return;
    if (
      !confirm(
        `Eliminare tutti i messaggi della chat con ${activeChat.phone}?\n\nQuesta azione non può essere annullata. Verrà cancellato solo lato CRM, il destinatario manterrà la sua copia su WhatsApp.`,
      )
    )
      return;
    try {
      // Cancello dai messaggi le righe in cui peer = activePhone (sia inbound che outbound).
      const peerDigits = activeChat.phone.replace(/^\+/, "");
      const { error } = await (
        supabase as unknown as {
          from: (t: string) => {
            delete: () => {
              eq: (
                k: string,
                v: string,
              ) => {
                or: (cond: string) => Promise<{ error: { message: string } | null }>;
              };
            };
          };
        }
      )
        .from("whatsapp_messages")
        .delete()
        .eq("user_id", user.id)
        .or(
          `from_number.eq.${activeChat.phone},to_number.eq.${activeChat.phone},from_number.eq.${peerDigits},to_number.eq.${peerDigits}`,
        );
      if (error) throw new Error(error.message);
      // Reset unread count del contatto, se esiste
      if (activeChat.contact) {
        await (
          supabase as unknown as {
            from: (t: string) => {
              update: (v: Record<string, unknown>) => {
                eq: (
                  k: string,
                  v: string,
                ) => {
                  eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
                };
              };
            };
          }
        )
          .from("whatsapp_contacts")
          .update({ unread_count: 0, last_message_at: null })
          .eq("user_id", user.id)
          .eq("phone_e164", activeChat.phone);
      }
      toast.success("Chat eliminata");
      setActivePhone(null);
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore eliminazione");
    }
  };

  const [leadsPanelOpen, setLeadsPanelOpen] = useState(true);

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

  const openHeaderEdit = () => {
    if (!activeChat) return;
    if (activeChat.lead) {
      setLeadDialogLead(activeChat.lead);
      setLeadDialogPrefill(undefined);
      setLeadDialogOpen(true);
    } else {
      // Sconosciuto → apri dialog nuovo lead con telefono prefillato (utente sceglierà consulente, fascia oraria, ecc.)
      setLeadDialogLead(null);
      setLeadDialogPrefill({
        telefono: activeChat.phone,
        nome: activeChat.contact?.display_name || "",
      });
      setLeadDialogOpen(true);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-background">
      {/* Header sezione — coerente col resto del CRM */}
      <div className="border-b border-border bg-card px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-emerald-50 grid place-items-center text-emerald-600 border border-emerald-100">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight text-foreground">
              WhatsApp Business
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {hasConfig === false
                ? "Credenziali non configurate"
                : vista === "chat"
                  ? "Conversazioni in tempo reale"
                  : "I testi che partono da tutto il CRM"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/*  Due viste, non due pagine: i messaggi si correggono mentre si
              scrive, non andando a cercare un pannello di impostazioni. */}
          <div className="flex items-center gap-1.5">
            <Segmento attivo={vista === "chat"} onClick={() => setVista("chat")}>
              Conversazioni
            </Segmento>
            <Segmento
              attivo={vista === "modelli"}
              onClick={() => setVista("modelli")}
              titolo="I messaggi preimpostati per ogni stato"
            >
              Messaggi preimpostati
            </Segmento>
          </div>
          {hasConfig === false && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 gap-1 font-medium"
            >
              <AlertCircle className="h-3 w-3" /> Configura in Impostazioni
            </Badge>
          )}
          {vista === "chat" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLeadsPanelOpen((v) => !v)}
              className="h-8 text-xs"
              title={leadsPanelOpen ? "Nascondi pannello lead" : "Mostra pannello lead"}
            >
              {leadsPanelOpen ? "Nascondi lead" : "Mostra lead"}
            </Button>
          )}
        </div>
      </div>

      {vista === "modelli" && <EditorMessaggi />}

      {/*  La chat resta montata mentre si guardano i modelli: tornando indietro
          si ritrova la conversazione aperta e lo scorrimento dov'era. */}
      <div className={vista === "chat" ? "flex flex-1 min-h-0" : "hidden"}>
        {/* Sidebar chat list — light */}
        <aside className="w-[340px] border-r border-border flex flex-col bg-card">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Chat</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                  <Filter className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Filtra</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilter("all")}>Tutte</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("unread")}>Non letti</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("with-lead")}>
                  Con lead CRM
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("unknown")}>
                  Sconosciuti
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca nome o numero…"
                className="pl-8 h-8 text-[13px] bg-background"
              />
            </div>
          </div>

          <div className="px-2 py-2 border-b border-border flex gap-1.5 overflow-x-auto">
            {[
              { v: "all" as const, l: "Tutte" },
              { v: "unread" as const, l: "Non letti" },
              { v: "with-lead" as const, l: "Con lead" },
              { v: "unknown" as const, l: "Sconosciuti" },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                className={cn(
                  "text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border",
                  filter === f.v
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-background text-muted-foreground border-border hover:bg-muted",
                )}
              >
                {f.l}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="px-4 py-10 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Caricamento chat…
              </div>
            ) : visibleChats.length === 0 ? (
              <div className="px-4 py-10 text-center text-muted-foreground text-xs">
                Nessuna chat in questa vista
              </div>
            ) : (
              visibleChats.map((c) => {
                const isActive = activePhone === c.phone;
                const last = c.lastMessage;
                const fullName = c.lead
                  ? `${c.lead.data.nome} ${c.lead.data.cognome}`.trim()
                  : c.contact?.display_name || "Sconosciuto";
                return (
                  <button
                    key={c.phone}
                    onClick={() => setActivePhone(c.phone)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b border-border transition-colors",
                      isActive ? "bg-emerald-50/60" : "hover:bg-muted/50",
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        {c.lead ? initials(c.lead.data.nome, c.lead.data.cognome) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {c.lead && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] py-0 h-4 font-medium border shrink-0",
                                LEAD_STATUS_COLOR[c.lead.data.stato],
                              )}
                            >
                              {LEAD_STATUS_LABEL[c.lead.data.stato]}
                            </Badge>
                          )}
                          <span className="text-[13px] font-semibold text-foreground truncate">
                            {fullName}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTimeIT(last?.created_at ?? c.contact?.last_message_at ?? null)}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate font-mono">
                        {c.phone}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-[12px] text-muted-foreground truncate flex-1">
                          {last?.direction === "outbound" && (
                            <CheckCheck
                              className={cn(
                                "inline h-3 w-3 mr-1",
                                last?.status === "read" ? "text-sky-500" : "text-muted-foreground",
                              )}
                            />
                          )}
                          {previewText(last?.body ?? "")}
                        </p>
                        {c.unread > 0 && (
                          <span className="h-4.5 min-w-[18px] px-1.5 rounded-full bg-emerald-500 text-[10px] font-bold text-white grid place-items-center">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </aside>

        {/* Conversation pane */}
        <section className="flex-1 flex flex-col min-w-0 bg-muted/30">
          {!activeChat ? (
            <div className="flex-1 grid place-items-center text-center px-6">
              <div className="max-w-md">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 grid place-items-center mb-3 border border-emerald-100">
                  <MessageCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-foreground text-base font-semibold">Seleziona una chat</h2>
                <p className="mt-1.5 text-muted-foreground text-[13px] leading-relaxed">
                  Le conversazioni arrivano in tempo reale dal webhook Meta e si collegano ai lead
                  del CRM tramite numero di telefono.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-2 bg-card border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={openHeaderEdit}
                  className="flex items-center gap-2.5 min-w-0 text-left rounded-md hover:bg-muted/60 transition-colors px-1.5 py-1 -mx-1.5"
                  title={
                    activeChat.lead
                      ? "Modifica dati lead"
                      : "Schedula meet / crea lead da questo numero"
                  }
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {activeChat.lead
                        ? initials(activeChat.lead.data.nome, activeChat.lead.data.cognome)
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate leading-tight">
                      {activeChat.lead
                        ? `${activeChat.lead.data.nome} ${activeChat.lead.data.cognome}`
                        : activeChat.contact?.display_name || "Sconosciuto"}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate leading-tight mt-0.5">
                      {activeChat.phone}
                      <span className="ml-2 text-emerald-600 font-sans not-italic">
                        {activeChat.lead ? "· modifica" : "· crea lead"}
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
                  {activeChat.lead && (
                    <PastigliaStato
                      dati={activeChat.lead.data}
                      contesto={
                        `${activeChat.lead.data.nome ?? ""} ${activeChat.lead.data.cognome ?? ""}`.trim() ||
                        undefined
                      }
                      onScegli={(s) => void handleStatusChange(s)}
                    />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void deleteChat()}
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
                  {activeMessages.length === 0 ? (
                    <div className="self-center bg-card border border-border text-muted-foreground text-[11px] px-3 py-1 rounded-md mt-4">
                      Nessun messaggio ancora · scrivi il primo
                    </div>
                  ) : (
                    activeMessages.map((m) => {
                      const fromMe = m.direction === "outbound";
                      return (
                        <div
                          key={m.id}
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
                              fromMe
                                ? "justify-end text-white/80"
                                : "justify-end text-muted-foreground",
                            )}
                          >
                            <span>{formatTimeIT(m.created_at)}</span>
                            {fromMe && m.status === "read" && (
                              <CheckCheck className="h-3 w-3 text-sky-200" />
                            )}
                            {fromMe && m.status === "delivered" && (
                              <CheckCheck className="h-3 w-3" />
                            )}
                            {fromMe && (m.status === "sent" || m.status === "queued") && (
                              <Check className="h-3 w-3" />
                            )}
                            {fromMe && m.status === "failed" && (
                              <AlertCircle
                                className="h-3 w-3 text-rose-200"
                                aria-label={m.error_message ?? "errore"}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Composer */}
              {residuiBozza.length > 0 && (
                <div className="px-3 pt-2 bg-card border-t border-border">
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
                    <span>
                      <span className="font-semibold">{residuiBozza.join("  ")}</span> non verrà
                      sostituito: arriverebbe scritto così al cliente. Scrivi il dato al posto del
                      segnaposto.
                    </span>
                  </div>
                </div>
              )}
              <div
                className={cn(
                  "px-3 py-2.5 bg-card flex items-end gap-2",
                  residuiBozza.length === 0 && "border-t border-border",
                )}
              >
                <div className="flex-1">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendDraft();
                      }
                    }}
                    placeholder={
                      hasConfig
                        ? "Scrivi un messaggio…"
                        : "Configura WhatsApp in Impostazioni per inviare"
                    }
                    rows={Math.min(6, Math.max(1, draft.split("\n").length))}
                    className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none text-[13px] leading-relaxed rounded-md px-3 py-2"
                  />
                </div>
                <Button
                  onClick={() => void sendDraft()}
                  size="icon"
                  disabled={!draft.trim() || sending || !hasConfig}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-9 w-9 disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </section>

        {/* Pannello lead a destra — collassabile */}
        {leadsPanelOpen && <WhatsAppLeadsPanel onClose={() => setLeadsPanelOpen(false)} />}
      </div>

      {/* Dialog: modifica lead esistente o crea nuovo da numero sconosciuto */}
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

/* ═══════════════════════════════════════════════════════════════════════════
   L'EDITOR DEI MESSAGGI PREIMPOSTATI

   Chi scrive ai clienti tutti i giorni sa meglio di chiunque altro come va
   detta una frase, e finora per cambiare una virgola serviva un rilascio. Qui
   i testi si vedono, si correggono e si provano: l'anteprima è composta con un
   cliente d'esempio e con la data di DOMANI, così si legge davvero «domani
   alle 15:30» e non una data qualsiasi che non dice niente.

   La cosa che questa schermata deve impedire è una sola: un `{nome}` che
   arriva scritto così sul telefono di una persona. Per questo l'avviso non sta
   in fondo ma sopra l'anteprima, ed è rosso quando blocca.
   ═════════════════════════════════════════════════════════════════════════ */

/** L'ordine in cui si scorrono i testi: prima quelli che valgono per tutti
 *  (correggere la firma una volta li sistema tutti), poi uno per stato
 *  nell'ordine in cui gli stati capitano davvero. */
