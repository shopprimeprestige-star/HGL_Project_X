/**
 * WhatsAppLeadsPanel — versione light, coerente col CRM.
 *
 * - lista lead minimal con avatar + nome + stato
 * - filtri: search, stato, consulente, range date (createdAt)
 * - cliccando un lead → invia template WA mappato sullo stato (override possibile dal dropdown)
 * - cambio consulente al volo
 * - pulsante chiudi pannello
 */
import { useEffect, useMemo, useState } from "react";
import { useCRM } from "./CRMContext";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Send,
  ChevronDown,
  Users,
  Loader2,
  X,
  CalendarRange,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ALL_LEAD_STATUSES, LEAD_STATUS_COLOR, LEAD_STATUS_LABEL, type Lead } from "./types";
import {
  DEFAULT_STATUS_TEMPLATE_MAP,
  resolveStatusTemplate,
  type StatusTemplate,
} from "./wa-status-templates";
//  Chi fa le consulenze si chiede lì, e solo lì: vedi la testata di quel file.
import { TESTO_SOLO_CONSULENTI, consulentiPerConsulenza } from "./chi-fa-la-consulenza";
import { findMetaTemplate } from "./wa-meta-templates";
import { buildWhatsAppLink, getWhatsAppMessageForStatus } from "./whatsapp";

/** ── LE DATE DEL CRM SONO STRINGHE, NON TIMESTAMP ─────────────────────────
 *  Nel lead la data sta come "2026-08-14" e l'ora come "15:30", separate.
 *  Passarle a `new Date()` le interpreta in UTC e, a seconda del fuso, fa
 *  scrivere al cliente il giorno prima. Qui si riscrive la stringa e basta:
 *  nessun fuso orario di mezzo, nessuna data sbagliata in un messaggio. */
function fmtDate(data?: string | null): string {
  if (!data) return "";
  const p = String(data).slice(0, 10).split("-");
  if (p.length !== 3) return String(data);
  return `${p[2]}/${p[1]}/${p[0]}`;
}
function fmtTime(ora?: string | null): string {
  if (!ora) return "";
  //  "15:30" resta "15:30"; se per qualche import è arrivato un ISO completo
  //  si prende comunque solo l'ora e i minuti.
  const s = String(ora);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

interface Props {
  onClose?: () => void;
}

function leadInitials(nome: string, cognome: string): string {
  const a = (nome || "").trim()[0] || "?";
  const b = (cognome || "").trim()[0] || "";
  return (a + b).toUpperCase();
}

export function WhatsAppLeadsPanel({ onClose }: Props) {
  const { user } = useAuth();
  const { leads, consultants } = useCRM();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [consultantFilter, setConsultantFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [overrideMap, setOverrideMap] = useState<Record<string, StatusTemplate>>({});
  const [disabledStatuses, setDisabledStatuses] = useState<string[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

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
                  data: {
                    status_template_map?: Record<string, StatusTemplate>;
                    disabled_template_statuses?: string[];
                  } | null;
                }>;
              };
            };
          };
        }
      )
        .from("whatsapp_settings")
        .select("status_template_map, disabled_template_statuses")
        .eq("user_id", user.id)
        .maybeSingle();
      setOverrideMap(data?.status_template_map ?? {});
      setDisabledStatuses(data?.disabled_template_statuses ?? []);
    })();
  }, [user]);

  /** ── LA TENDINA «CONSULENTE» MOSTRA SOLO I CONSULENTI ───────────────────
   *  Filtra `consulenteId` dei lead, che è chi FA la consulenza: un installatore
   *  o un driver qui dentro è una voce che non può che dare zero conversazioni,
   *  e a schermo «zero» si legge come «non ha scritto a nessuno» invece che come
   *  «non è il suo mestiere».
   *  ⚠️ Si passa `leads` perché chi ha già dei lead assegnati deve restare
   *  selezionabile anche senza spunta, o quelle conversazioni non si potrebbero
   *  più isolare. Regola e ripiego in crm/chi-fa-la-consulenza. */
  const { elenco: consulentiFiltro, ripiego: ripiegoConsulenti } = useMemo(
    () =>
      consulentiPerConsulenza(consultants, {
        leads,
        anche: [consultantFilter === "all" ? null : consultantFilter],
      }),
    [consultants, leads, consultantFilter],
  );

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : null;
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.data.stato !== statusFilter) return false;
      if (consultantFilter !== "all" && l.data.consulenteId !== consultantFilter) return false;
      if (fromTs || toTs) {
        const created = l.data.createdAt ? new Date(l.data.createdAt).getTime() : 0;
        if (fromTs && created < fromTs) return false;
        if (toTs && created >= toTs) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${l.data.nome} ${l.data.cognome} ${l.data.telefono || ""} ${
          l.data.email || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, statusFilter, consultantFilter, dateFrom, dateTo, search]);

  /** ── I VALORI CHE FINISCONO NEI {{1}} {{2}} DI META ────────────────────
   *  Ogni chiave del template corrisponde a un campo preciso del lead. Prima
   *  si leggevano campi che nel CRM non esistono (`appuntamentoData`,
   *  `meetLink`, `installazione.dataInstallazione`): il risultato era un
   *  parametro vuoto, e Meta rifiuta un template con un parametro vuoto —
   *  quindi l'invio falliva con un errore che non diceva perché. */
  const valoriTemplate = (lead: Lead): Record<string, string> => {
    const d = lead.data;
    const consultant = consultants.find((c) => c.id === d.consulenteId);
    return {
      lead_name: d.nome || "",
      consultant_name: consultant?.data.nome || "",
      appointment_date: fmtDate(d.dataMeeting),
      appointment_time: fmtTime(d.oraMeeting),
      visit_date: fmtDate(d.dataVieneInSede),
      visit_time: fmtTime(d.oraVieneInSede),
      recontact_date: fmtDate(d.dataRicontatto),
      recontact_time: fmtTime(d.oraRicontatto),
      meet_link: d.linkMeeting || "",
    };
  };

  /** Tutti i template mandabili a mano: i predefiniti più quelli sostituiti
   *  dall'utente, senza doppioni. */
  const templateDisponibili = useMemo<StatusTemplate[]>(() => {
    const m = new Map<string, StatusTemplate>();
    Object.values(DEFAULT_STATUS_TEMPLATE_MAP).forEach((t) => {
      if (t?.name) m.set(`${t.name}-${t.lang}`, t);
    });
    Object.values(overrideMap).forEach((t) => {
      if (t?.name) m.set(`${t.name}-${t.lang}`, t);
    });
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [overrideMap]);

  const buildTemplateParams = (lead: Lead, templateName: string): string[] => {
    const meta = findMetaTemplate(templateName);
    if (!meta || meta.params.length === 0) return [];
    const source = valoriTemplate(lead);
    return meta.params.map((p) => source[p.key] ?? "");
  };

  /** Cosa manca per poter mandare questo template a questa persona: si dice
   *  PRIMA, col nome del dato in italiano, invece di far scoprire l'errore
   *  dalla risposta di Meta. */
  const datiMancanti = (lead: Lead, templateName: string): string[] => {
    const meta = findMetaTemplate(templateName);
    if (!meta) return [];
    const source = valoriTemplate(lead);
    return meta.params.filter((p) => !(source[p.key] ?? "").trim()).map((p) => p.description);
  };

  const sendTemplate = async (lead: Lead, tpl: StatusTemplate) => {
    if (!lead.data.telefono) {
      toast.error("Lead senza telefono.");
      return;
    }
    const mancanti = datiMancanti(lead, tpl.name);
    if (mancanti.length > 0) {
      //  Un template a cui manca un dato viene rifiutato da Meta: si ferma qui
      //  e si dice quale dato manca, che è l'unica cosa da fare per rimediare.
      toast.error(
        `Non posso mandare "${tpl.name}": manca ${mancanti.join(", ").toLowerCase()}. Completa la scheda del lead.`,
      );
      return;
    }
    setSendingId(lead.id);
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
          to: lead.data.telefono,
          templateName: tpl.name,
          templateLang: tpl.lang,
          leadId: lead.id,
          templateParams: buildTemplateParams(lead, tpl.name),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !json.ok) {
        toast.error(`Invio fallito: ${json.message || json.error}`);
        return;
      }
      toast.success(`Template "${tpl.name}" inviato a ${lead.data.nome}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore invio");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <aside className="w-[340px] border-l border-border flex flex-col bg-card">
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
        <Users className="h-4 w-4 text-emerald-600" />
        <span className="text-foreground text-[13px] font-semibold">Lead CRM</span>
        <Badge
          variant="outline"
          className="ml-auto bg-muted text-muted-foreground border-border font-medium"
        >
          {filtered.length}
        </Badge>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Nascondi pannello"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="p-2 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca lead…"
            className="pl-8 h-8 text-[13px] bg-background"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-[11px] bg-background">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              {ALL_LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LEAD_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={consultantFilter} onValueChange={setConsultantFilter}>
            <SelectTrigger className="h-8 text-[11px] bg-background">
              <SelectValue placeholder="Consulente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {consulentiFiltro.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.data.nome}
                </SelectItem>
              ))}
              {/*  Il ripiego si dice dentro la tendina: è l'unico posto che si
                  guarda mentre si sceglie un nome. */}
              {ripiegoConsulenti && (
                <p className="px-2 py-1.5 text-[11px] leading-snug text-amber-800">
                  {TESTO_SOLO_CONSULENTI}
                </p>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-7 text-[11px] bg-background px-2"
            title="Da"
          />
          <span className="text-muted-foreground text-[11px]">→</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-7 text-[11px] bg-background px-2"
            title="A"
          />
          {(dateFrom || dateTo) && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="h-6 w-6 text-muted-foreground"
              title="Pulisci"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-xs">Nessun lead</div>
        ) : (
          filtered.map((l) => {
            const tpl = resolveStatusTemplate(l.data.stato, overrideMap, disabledStatuses);
            const sending = sendingId === l.id;
            /** ── QUANDO IL TEMPLATE APPROVATO NON C'È ────────────────────
             *  Otto dei venti stati non hanno un template Meta (non è stato
             *  creato: Meta li approva uno per uno). Prima il pulsante restava
             *  spento e la riga era inutile. Adesso si apre WhatsApp col
             *  messaggio già scritto — quello modificabile da /CRM/whatsapp —
             *  e lo si manda a mano: è più lento, ma si può fare. */
            const messaggioLibero = getWhatsAppMessageForStatus(
              l,
              consultants.find((c) => c.id === l.data.consulenteId)?.data.nome,
            );
            const mancanti = tpl ? datiMancanti(l, tpl.name) : [];
            return (
              <div
                key={l.id}
                className="px-3 py-2.5 border-b border-border hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                      {leadInitials(l.data.nome, l.data.cognome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="text-[13px] font-semibold text-foreground truncate flex-1 min-w-0">
                        {l.data.nome} {l.data.cognome}
                      </div>
                      {tpl ? (
                        <Button
                          size="sm"
                          onClick={() => void sendTemplate(l, tpl)}
                          disabled={!l.data.telefono || sending}
                          className="h-6 w-6 p-0 bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                          title={
                            mancanti.length > 0
                              ? `Manca ${mancanti.join(", ").toLowerCase()}: il template verrebbe rifiutato`
                              : `Invia il template "${tpl.name}"`
                          }
                        >
                          {sending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                        </Button>
                      ) : (
                        <a
                          href={
                            l.data.telefono
                              ? buildWhatsAppLink(l.data.telefono, messaggioLibero)
                              : undefined
                          }
                          target="_blank"
                          rel="noreferrer"
                          aria-disabled={!l.data.telefono}
                          className={cn(
                            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 text-emerald-700",
                            l.data.telefono
                              ? "hover:bg-emerald-500/10"
                              : "pointer-events-none opacity-40",
                          )}
                          title="Nessun template approvato per questo stato: apre WhatsApp col messaggio già scritto"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                            title="Cambia template"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white">
                          <DropdownMenuLabel>Manda un altro template</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {/*  L'elenco tiene conto delle sostituzioni salvate in
                              whatsapp_settings: mostrare solo i nomi di default
                              faceva mandare un template diverso da quello che
                              parte davvero dal pulsante verde. */}
                          {templateDisponibili.map((t) => (
                            <DropdownMenuItem
                              key={`${t.name}-${t.lang}`}
                              onClick={() => void sendTemplate(l, t)}
                            >
                              {t.name}
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                {t.lang}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {l.data.telefono || "—"}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] py-0 h-4 mt-1 font-medium",
                        LEAD_STATUS_COLOR[l.data.stato],
                      )}
                    >
                      {LEAD_STATUS_LABEL[l.data.stato]}
                    </Badge>
                  </div>
                </div>
                {tpl ? (
                  <div className="text-[10px] mt-1 truncate">
                    <span className="text-muted-foreground">template: </span>
                    <span className="font-mono text-muted-foreground">{tpl.name}</span>
                    {mancanti.length > 0 && (
                      <span className="text-amber-700"> · manca {mancanti[0].toLowerCase()}</span>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground mt-1 truncate">
                    nessun template approvato · si manda a mano
                  </div>
                )}
              </div>
            );
          })
        )}
      </ScrollArea>
    </aside>
  );
}
