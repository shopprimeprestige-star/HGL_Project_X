/** ─────────────────────────────────────────────────────────────────────────
 *  I CONTATTI ARRIVATI — la prima schermata della mattina
 *
 *  A COSA RISPONDE, IN QUEST'ORDINE
 *   1. quanti ne sono arrivati (e quanti stanotte, mentre non c'era nessuno);
 *   2. DA DOVE arrivano — Meta, TikTok o organico: è il numero che dice dove
 *      stanno andando i soldi, e va letto prima di aprire le campagne;
 *   3. chi lo prende in carico, in UN tocco.
 *
 *  IL TOCCO SOLO
 *  Prima l'unico modo di assegnare era aprire una tendina e cercare il nome:
 *  due gesti e una decisione, per ottanta contatti la mattina. Il consulente a
 *  cui tocca lo sa già il CRM (meno chiamate fatte oggi, poi priorità), quindi
 *  il pulsante lo propone e la tendina resta lì per i casi veri.
 *
 *  I NUMERI IN ALTO SONO FILTRI
 *  Un conteggio che non si può aprire costringe a rileggere l'elenco a occhio:
 *  qui ogni riquadro accende il filtro corrispondente e si spegne premendolo di
 *  nuovo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { detectPublicLeadSource, type PublicLead, type LeadData } from "@/crm/types";
import { formatDate } from "@/lib/date-format";
import {
  AlertTriangle,
  Phone,
  MessageCircle,
  Trash2,
  RefreshCw,
  CalendarCog,
  PauseCircle,
  Unlock,
  ChevronDown,
  ChevronRight,
  X,
  Inbox,
  Clock,
  MapPin,
  Mail,
  Sparkles,
  Flame,
} from "lucide-react";
import { buildWhatsAppLink, componiMessaggio, modelloDi } from "@/crm/whatsapp";
import { PublicLeadDetailSheet } from "@/crm/PublicLeadDetailSheet";
import { DisagioBar } from "@/crm/DisagioBar";
import { Segmento, Vuoto } from "@/crm/ui";
//  Chi fa le consulenze si chiede lì, e solo lì: vedi la testata di quel file.
import { NotaSoloConsulenti, consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";

export const Route = createFileRoute("/CRM/nuovi-contatti")({
  component: NuoviLeadPage,
});

const URGENZA_LABEL: Record<string, string> = {
  subito: "Subito",
  "1mese": "Entro 1 mese",
  convince: "Se convince → subito",
  "2_3mesi": "2–3 mesi",
  valuto: "Sto valutando",
  si: "Pronto 30gg",
  valutando: "Valutando",
};

const SOURCE_META = {
  meta: { label: "Meta", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  tiktok: { label: "TikTok", cls: "bg-pink-500/10 text-pink-700 border-pink-500/30" },
  organic: { label: "Organico", cls: "bg-slate-500/10 text-slate-700 border-slate-500/30" },
} as const;

function isPriorityLead(p: PublicLead): boolean {
  return (
    (p.disagio_score || 0) > 8 &&
    (p.urgenza === "subito" || p.urgenza === "convince" || p.urgenza === "si")
  );
}

/** I filtri sono esclusivi: due filtri accesi insieme fanno vedere un elenco
 *  vuoto e non si capisce quale dei due lo ha svuotato. */
type Filtro = "tutti" | "oggi" | "priorita" | "meta" | "tiktok" | "organic";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ora";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return `${d}g fa`;
}

function NuoviLeadPage() {
  const { user } = useAuth();
  const { consultants, createLead, prossimoConsulente } = useCRM();
  const [items, setItems] = useState<PublicLead[]>([]);
  const [pending, setPending] = useState<PublicLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<PublicLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("tutti");

  /** ── A CHI SI PUÒ DARE UN CONTATTO NUOVO ────────────────────────────────
   *  Prendere in carico un contatto vuol dire diventare il consulente di quella
   *  scheda: nella tendina ci vanno solo i consulenti, come nel pulsante «Prendi
   *  in carico» accanto (il turno lo calcola già `prossimoConsulente`, filtrato
   *  alla stessa maniera in crm/CRMContext).
   *  ⚠️ Qui non c'è nessun «già assegnato» da tenere dentro: questi contatti
   *  sono per definizione ancora di nessuno — è tutta la ragione della pagina.
   *  Finché in anagrafica nessuno è segnato consulente si vedono tutti, e la
   *  riga sotto la tendina dice quale spunta manca. */
  const { elenco: consulentiScelta, ripiego: ripiegoConsulenti } = useMemo(
    () => consulentiPerConsulenza(consultants),
    [consultants],
  );

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("public_leads")
      .select("*")
      .is("assigned_to_user_id", null)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const all = (data || []) as unknown as PublicLead[];
    setItems(all.filter((p) => !p.slot_pending));
    setPending(all.filter((p) => p.slot_pending));
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("public_leads_nuovi")
      .on("postgres_changes", { event: "*", schema: "public", table: "public_leads" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const priorityCount = useMemo(() => items.filter(isPriorityLead).length, [items]);
  const oggiIso = new Date().toISOString().slice(0, 10);
  const todayCount = useMemo(
    () => items.filter((p) => p.created_at.slice(0, 10) === oggiIso).length,
    [items, oggiIso],
  );

  /** ── DA DOVE ARRIVANO ───────────────────────────────────────────────────
   *  Il conteggio per piattaforma è la lettura che si fa prima del caffè: se
   *  stanotte da TikTok non è arrivato niente, si sa prima di aprire le
   *  campagne — non due giorni dopo dal riepilogo di spesa. */
  const perFonte = useMemo(() => {
    const c = { meta: 0, tiktok: 0, organic: 0 };
    items.forEach((p) => {
      c[detectPublicLeadSource(p)]++;
    });
    return c;
  }, [items]);

  /** Arrivati mentre non c'era nessuno: sono i primi da richiamare, perché
   *  hanno già aspettato tutta la notte. */
  const notturni = useMemo(
    () =>
      items.filter((p) => {
        const h = new Date(p.created_at).getHours();
        return p.created_at.slice(0, 10) === oggiIso && h < 9;
      }).length,
    [items, oggiIso],
  );

  const visibili = useMemo(() => {
    switch (filtro) {
      case "oggi":
        return items.filter((p) => p.created_at.slice(0, 10) === oggiIso);
      case "priorita":
        return items.filter(isPriorityLead);
      case "meta":
      case "tiktok":
      case "organic":
        return items.filter((p) => detectPublicLeadSource(p) === filtro);
      default:
        return items;
    }
  }, [items, filtro, oggiIso]);

  /** Accende il filtro, oppure lo spegne se era già quello: premere due volte
   *  lo stesso riquadro è il gesto con cui si torna a vedere tutto. */
  const commuta = (f: Filtro) => setFiltro((cur) => (cur === f ? "tutti" : f));

  /** Mutation helper: aggiorna tabella public_leads e ricarica con feedback. */
  const mutate = async (
    id: string,
    patch: Partial<PublicLead>,
    successMsg: string,
  ): Promise<boolean> => {
    const { error } = await supabase.from("public_leads").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(successMsg);
    load();
    return true;
  };

  const liberaSubito = (p: PublicLead) => {
    if (!confirm("Liberare lo slot? L'orario tornerà disponibile sul calendario.")) return;
    mutate(p.id, { slot_released: true, data_slot: null, ora_slot: null }, "Slot liberato");
  };
  const metInSospeso = (p: PublicLead) =>
    mutate(p.id, { slot_pending: true }, "Spostato in 'In Sospeso'");
  const ripristinaSospeso = (p: PublicLead) =>
    mutate(p.id, { slot_pending: false }, "Lead ripristinato");

  const eliminaSospeso = async (p: PublicLead) => {
    if (!confirm("Eliminare definitivamente questa prenotazione? Lo slot tornerà libero.")) return;
    const { error } = await supabase.from("public_leads").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato — slot disponibile");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questa richiesta?")) return;
    const { error } = await supabase.from("public_leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Richiesta eliminata");
    load();
  };

  const assign = async (p: PublicLead, consultantId: string) => {
    if (!user || !consultantId) return;
    const source = detectPublicLeadSource(p);
    const leadData: LeadData = {
      nome: p.nome,
      cognome: p.cognome,
      telefono: p.telefono,
      email: p.email,
      citta: p.citta,
      fonte: source === "organic" ? "Organico" : "ADV",
      piattaformaAds: source === "meta" ? "meta" : source === "tiktok" ? "tiktok" : "none",
      consulenteId: consultantId,
      //  ── LO STATO DEVE DIRE LA VERITÀ ──────────────────────────────────
      //  Prima ogni contatto preso in carico diventava "Appuntamento
      //  fissato", anche quando dal funnel non era arrivato nessuno slot:
      //  finiva in agenda senza data, e il messaggio WhatsApp gli confermava
      //  un appuntamento che non esisteva. Senza slot è semplicemente uno da
      //  chiamare.
      stato: p.data_slot && p.ora_slot ? "appuntamento_fissato" : "da_contattare",
      createdAt: p.created_at,
      dataMeeting: p.data_slot || undefined,
      oraMeeting: p.ora_slot || undefined,
      qualifica: {
        disagio: p.disagio_score ?? undefined,
        painPoints: p.pain_points,
        urgenza: p.urgenza ?? undefined,
      },
      tracking: {
        utm_source: p.utm_source ?? undefined,
        utm_medium: p.utm_medium ?? undefined,
        utm_campaign: p.utm_campaign ?? undefined,
        source,
        fbp: p.fbp ?? undefined,
        fbc: p.fbc ?? undefined,
        ttclid: p.ttclid ?? undefined,
        event_id: p.event_id ?? undefined,
      },
      publicLeadId: p.id,
    };
    const created = await createLead(leadData);
    if (!created) return toast.error("Errore creazione lead nel CRM");
    const nome = consultants.find((c) => c.id === consultantId)?.data.nome || "consulente";
    await mutate(
      p.id,
      {
        assigned_to_user_id: user.id,
        assigned_consultant_id: consultantId,
        status: "assegnato",
      },
      p.data_slot && p.ora_slot
        ? `Preso in carico da ${nome} — genera il Meet dalla scheda`
        : `Preso in carico da ${nome} — da chiamare, non c'è ancora un orario`,
    );
  };

  return (
    <div className="min-h-full bg-[oklch(0.985_0.003_250)]">
      {/* ───── Header sticky ───── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[oklch(0.55_0.18_252)] to-[oklch(0.62_0.2_280)] grid place-items-center text-white shadow-sm shrink-0">
              <Inbox className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight truncate">Nuovi contatti</h1>
              <p className="text-[11px] text-muted-foreground truncate">
                {items.length === 0
                  ? "Nessuno da prendere in carico · arrivano qui in tempo reale"
                  : `${items.length} da prendere in carico · arrivano qui in tempo reale`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link to="/CRM/orari-disponibili">
                <CalendarCog className="h-3.5 w-3.5 mr-1.5" />
                Disponibilità
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── Quanti, e da dove. Ogni numero apre il suo elenco. ── */}
        <div className="px-4 md:px-6 pb-2.5 flex flex-wrap items-center gap-1.5">
          <KpiPill
            label="Da gestire"
            value={items.length}
            tone="ora"
            attivo={filtro === "tutti"}
            onClick={() => setFiltro("tutti")}
          />
          <KpiPill
            label="Oggi"
            value={todayCount}
            tone="neutro"
            nota={notturni > 0 ? `${notturni} di notte` : undefined}
            attivo={filtro === "oggi"}
            onClick={() => commuta("oggi")}
          />
          {priorityCount > 0 && (
            <KpiPill
              label="Priorità"
              value={priorityCount}
              tone="manca"
              attivo={filtro === "priorita"}
              onClick={() => commuta("priorita")}
            />
          )}
          <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
          {[
            { k: "meta" as const, l: "Meta" },
            { k: "tiktok" as const, l: "TikTok" },
            { k: "organic" as const, l: "Organico" },
          ].map(({ k, l }) => (
            <Segmento
              key={k}
              attivo={filtro === k}
              onClick={() => commuta(k)}
              conteggio={perFonte[k]}
              titolo={`Solo i contatti arrivati da ${l}`}
            >
              {l}
            </Segmento>
          ))}
          {pending.length > 0 && (
            <button
              type="button"
              onClick={() => setPendingOpen(true)}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 text-amber-700 transition-colors hover:bg-amber-500/15"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">In sospeso</span>
              <span className="text-sm font-bold tabular-nums leading-none">{pending.length}</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6 py-4 space-y-4 max-w-[1200px] mx-auto">
        {/* Empty state */}
        {items.length === 0 && pending.length === 0 && !loading && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted grid place-items-center mb-3">
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold">Nessun nuovo lead</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Le richieste dal funnel appariranno qui in tempo reale.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {loading && items.length === 0 && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-4 w-1/3 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 w-1/2 bg-muted/70 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Un filtro che non trova niente deve dirlo, altrimenti sembra che i
            contatti siano finiti. */}
        {items.length > 0 && visibili.length === 0 && (
          <Vuoto
            titolo="Nessun contatto in questo filtro"
            testo="Gli altri contatti ci sono ancora: togli il filtro per rivederli tutti."
            icona={Inbox}
            azione={
              <Button size="sm" variant="outline" onClick={() => setFiltro("tutti")}>
                Mostra tutti ({items.length})
              </Button>
            }
          />
        )}

        {/* Lista lead */}
        <div className="space-y-2.5">
          {visibili.map((p) => (
            <LeadCard
              key={p.id}
              p={p}
              consultants={consulentiScelta}
              ripiegoConsulenti={ripiegoConsulenti}
              suggerito={prossimoConsulente()}
              onOpenDetail={() => {
                setDetailLead(p);
                setDetailOpen(true);
              }}
              onAssign={(cId) => assign(p, cId)}
              onLibera={() => liberaSubito(p)}
              onSospeso={() => metInSospeso(p)}
              onRemove={() => remove(p.id)}
            />
          ))}
        </div>

        {/* Sezione In Sospeso collassabile */}
        {pending.length > 0 && (
          <Collapsible open={pendingOpen} onOpenChange={setPendingOpen}>
            <Card className="border-amber-500/30">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full p-3 flex items-center justify-between hover:bg-amber-500/5 transition-colors rounded-t-md"
                >
                  <div className="flex items-center gap-2">
                    <PauseCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-700">In Sospeso</span>
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-700 border-amber-500/30"
                    >
                      {pending.length}
                    </Badge>
                  </div>
                  {pendingOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-1.5 border-t border-amber-500/20 pt-3">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Slot parcheggiati. Clicca per eliminare e liberare lo slot, oppure ripristina.
                  </p>
                  {pending.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 p-2 bg-background rounded-md border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {p.nome} {p.cognome}{" "}
                          <span className="text-muted-foreground font-normal">· {p.telefono}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => eliminaSospeso(p)}
                        className="inline-flex items-center gap-1 bg-amber-500/10 hover:bg-destructive/15 hover:text-destructive text-amber-700 border border-amber-500/30 rounded px-2 py-1 text-[11px] font-semibold transition-colors"
                      >
                        <X className="h-3 w-3" />
                        {p.data_slot ? formatDate(p.data_slot, { short: true }) : "?"} ·{" "}
                        {p.ora_slot || "?"}
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => ripristinaSospeso(p)}
                      >
                        Ripristina
                      </Button>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        <PublicLeadDetailSheet
          lead={detailLead}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onSaved={load}
        />
      </div>
    </div>
  );
}

/* ─────────── Sotto-componenti ─────────── */

/** Il numero e la sua etichetta, cliccabili: il colore è un segnale, non una
 *  decorazione — celeste = da fare adesso, ambra = manca un passaggio. */
function KpiPill({
  label,
  value,
  tone,
  nota,
  attivo,
  onClick,
}: {
  label: string;
  value: number;
  tone: "ora" | "neutro" | "manca";
  nota?: string;
  attivo?: boolean;
  onClick?: () => void;
}) {
  const cls =
    tone === "ora"
      ? "bg-sky-500/10 text-sky-700 border-sky-500/25"
      : tone === "manca"
        ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
        : "bg-secondary text-secondary-foreground border-border";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attivo}
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border transition-colors ${cls} ${
        attivo ? "ring-2 ring-foreground/15" : "hover:brightness-[0.97]"
      }`}
    >
      <span className="text-[10px] uppercase tracking-wider font-medium opacity-80">{label}</span>
      <span className="text-sm font-bold tabular-nums leading-none">{value}</span>
      {nota && <span className="text-[10px] font-medium opacity-70">· {nota}</span>}
    </button>
  );
}

function LeadCard({
  p,
  consultants,
  ripiegoConsulenti,
  suggerito,
  onOpenDetail,
  onAssign,
  onLibera,
  onSospeso,
  onRemove,
}: {
  p: PublicLead;
  /** ⚠️ Arriva GIÀ filtrato a chi fa le consulenze (vedi la pagina): qui dentro
   *  non si rifiltra, o diventerebbero due regole da tenere d'accordo. */
  consultants: ReturnType<typeof useCRM>["consultants"];
  /** true = nessuno è segnato consulente, quindi l'elenco qui sopra sono tutti
   *  e va detto sotto la tendina invece di lasciarlo credere. */
  ripiegoConsulenti: boolean;
  /** Il consulente a cui tocca: è ciò che rende la presa in carico un tocco solo. */
  suggerito: ReturnType<typeof useCRM>["consultants"][number] | null;
  onOpenDetail: () => void;
  onAssign: (cId: string) => void;
  onLibera: () => void;
  onSospeso: () => void;
  onRemove: () => void;
}) {
  const isPriority = isPriorityLead(p);
  const source = detectPublicLeadSource(p);
  const sm = SOURCE_META[source];
  const disagio = p.disagio_score ?? 0;
  const hasSlot = !!(p.data_slot && p.ora_slot);
  const urgLabel = p.urgenza ? URGENZA_LABEL[p.urgenza] || p.urgenza : null;

  return (
    <Card
      className={`group transition-all hover:shadow-md ${
        isPriority ? "border-destructive/40 bg-destructive/[0.02]" : ""
      }`}
    >
      <CardContent className="p-0">
        {/* Riga superiore — anagrafica + meta */}
        <button
          type="button"
          onClick={onOpenDetail}
          className="w-full text-left p-4 hover:bg-secondary/30 transition-colors rounded-t-md"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Avatar iniziali */}
              <div
                className={`h-10 w-10 rounded-full grid place-items-center text-sm font-bold shrink-0 ${
                  isPriority
                    ? "bg-destructive/15 text-destructive ring-2 ring-destructive/30"
                    : "bg-[oklch(0.55_0.18_252)]/10 text-[oklch(0.55_0.18_252)]"
                }`}
              >
                {(p.nome?.[0] || "?").toUpperCase()}
                {(p.cognome?.[0] || "").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-[15px] truncate">
                    {p.nome} {p.cognome}
                  </span>
                  {isPriority && (
                    <Badge variant="destructive" className="h-5 gap-0.5 text-[10px]">
                      <Flame className="h-2.5 w-2.5" /> Priorità
                    </Badge>
                  )}
                  <Badge variant="outline" className={`h-5 text-[10px] ${sm.cls}`}>
                    {sm.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[11.5px] text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {p.citta}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {p.telefono}
                  </span>
                  <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                    <Mail className="h-3 w-3" /> {p.email}
                  </span>
                  <span className="inline-flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" /> {timeAgo(p.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Metriche compatte */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {/* Slot */}
            <div className="rounded-md border border-border bg-background px-2.5 py-2">
              <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Slot
              </div>
              <div
                className={`text-xs font-semibold mt-0.5 ${hasSlot ? "text-foreground" : "text-muted-foreground"}`}
              >
                {hasSlot
                  ? `${formatDate(p.data_slot!, { short: true })} · ${p.ora_slot}`
                  : "Nessuno slot"}
              </div>
            </div>
            {/* Disagio */}
            <div
              className={`rounded-md border px-2.5 py-2 ${
                disagio > 8
                  ? "border-destructive/30 bg-destructive/5"
                  : disagio > 6
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-border bg-background"
              }`}
            >
              <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Disagio
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold tabular-nums">
                  {p.disagio_score ?? "—"}
                  <span className="text-[10px] font-normal text-muted-foreground">/10</span>
                </span>
                <div className="flex-1">
                  <DisagioBar score={p.disagio_score} height={4} />
                </div>
              </div>
            </div>
            {/* Urgenza */}
            <div
              className={`rounded-md border px-2.5 py-2 ${
                p.urgenza === "subito" || p.urgenza === "convince" || p.urgenza === "si"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-background"
              }`}
            >
              <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Urgenza
              </div>
              <div className="text-xs font-semibold mt-0.5 truncate">{urgLabel || "—"}</div>
            </div>
          </div>

          {/* Pain points */}
          {p.pain_points.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {p.pain_points.map((pp) => (
                <Badge key={pp} variant="secondary" className="text-[10px] h-5 font-normal">
                  {pp}
                </Badge>
              ))}
            </div>
          )}
        </button>

        {/* Footer azioni */}
        <div className="px-4 py-2.5 border-t border-border bg-secondary/20 flex items-center gap-2 flex-wrap">
          {/* ── LA PRESA IN CARICO ────────────────────────────────────────
              Il pulsante fa il gesto normale (assegna a chi tocca); la tendina
              accanto resta per l'eccezione. Prima c'era solo la tendina, e
              l'eccezione costava quanto la regola. */}
          {suggerito && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAssign(suggerito.id);
              }}
              title="Assegna al consulente a cui tocca: meno chiamate fatte oggi, poi priorità"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Prendi in carico · {suggerito.data.nome}
            </Button>
          )}
          {/* Assegnazione a qualcun altro */}
          <select
            className="h-8 px-2 text-xs border border-border rounded-md bg-background flex-1 min-w-[150px] font-medium"
            defaultValue=""
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (e.target.value) onAssign(e.target.value);
            }}
          >
            <option value="">{suggerito ? "Assegna a un altro…" : "Assegna consulente…"}</option>
            {consultants.map((c) => (
              <option key={c.id} value={c.id}>
                {c.data.nome}
              </option>
            ))}
          </select>
          {/*  ⚠️ FUORI dal <select>: dentro una tendina di sistema ci stanno
              solo <option>, e un avviso travestito da voce si sceglierebbe per
              sbaglio al posto di una persona. Occupa una riga intera perché è
              una frase, non un'etichetta. */}
          <NotaSoloConsulenti ripiego={ripiegoConsulenti} className="basis-full" />

          {/* Azioni slot */}
          {hasSlot && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onLibera();
                }}
                className="h-8 text-xs"
                title="Libera lo slot sul calendario"
              >
                <Unlock className="h-3 w-3 mr-1" /> Libera
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onSospeso();
                }}
                className="h-8 text-xs"
                title="Parcheggia in sospeso"
              >
                <PauseCircle className="h-3 w-3 mr-1" /> Sospendi
              </Button>
            </>
          )}

          {/* Quick contacts */}
          <div className="flex items-center gap-0.5 ml-auto">
            <Button
              asChild
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <a href={`tel:${p.telefono}`} title="Chiama">
                <Phone className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button
              asChild
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-emerald-700 hover:bg-emerald-500/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/*  Il primo messaggio è quello modificabile da /CRM/whatsapp:
                   qui c'era una frase scritta a mano, e chi correggeva i testi
                   non capiva perché da questa pagina ne partisse un'altra. */}
              <a
                href={buildWhatsAppLink(
                  p.telefono,
                  componiMessaggio(modelloDi("da_contattare"), {
                    nome: p.nome,
                    cognome: p.cognome,
                  }),
                )}
                target="_blank"
                rel="noreferrer"
                title="WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="Elimina richiesta"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {consultants.length === 0 && (
          <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/30 text-[11px] text-amber-700 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Crea prima un consulente nella sezione Collaboratori per poter assegnare i lead.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
