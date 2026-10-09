import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Activity,
  Bot,
  Eye,
  Clock,
  ArrowDown,
  Target,
  MousePointerClick,
  TrendingDown,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
  Filter,
} from "lucide-react";
import { buildLpDashboardStats, type LpEventRecord } from "@/crm/lp-performance";
import { DateRangeFilter, rangeBoundsAsDates, type DateRange } from "@/crm/DateRangeFilter";
import { computeAllPresetDeltas, type RangeDeltaPoint } from "@/crm/range-delta";
import { subscribeLiveVisitorsCount } from "@/landing/booking/tracking";
import { formatDateTime } from "@/lib/date-format";
import { LandingContentEditor } from "@/crm/LandingContentEditor";
import { Segmento } from "@/crm/ui";

export const Route = createFileRoute("/CRM/landing-page")({
  component: PerformancePage,
});

interface LpEvent {
  id: string;
  created_at: string;
  event_name: string;
  session_id: string;
  step: number | null;
  payload: Record<string, unknown>;
  utm_source: string | null;
  device: string | null;
  is_bot: boolean;
}

function defaultRange(): DateRange {
  const today = new Date();
  const since = new Date(today);
  since.setDate(today.getDate() - 29);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(since), to: iso(today) };
}

/** ── DUE DOMANDE, UNA PAGINA ───────────────────────────────────────────────
 *  «Cosa c'è scritto sulla landing» e «come sta andando» sono la stessa cosa
 *  vista da due lati: si cambia un titolo perché il funnel perde a quello step.
 *  Tenerle in due punti diversi del CRM costringeva a ricordarsi il numero
 *  mentre si andava a cercare l'editor. */
type VistaLanding = "contenuti" | "rendimento";

function PerformancePage() {
  const [vista, setVista] = useState<VistaLanding>("rendimento");
  const [events, setEvents] = useState<LpEvent[]>([]);
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [activeUsers, setActiveUsers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const deltaPoints = useMemo<RangeDeltaPoint[]>(() => {
    const bySession = new Map<string, { date: string; isLead: boolean }>();
    for (const ev of events) {
      const date = (ev.created_at || "").slice(0, 10);
      if (!date) continue;
      const cur = bySession.get(ev.session_id) || { date, isLead: false };
      if (ev.event_name === "Lead") cur.isLead = true;
      bySession.set(ev.session_id, cur);
    }
    const pts: RangeDeltaPoint[] = [];
    for (const s of bySession.values()) {
      pts.push({
        date: s.date,
        sessions: 1,
        conversions: s.isLead ? 1 : 0,
        lead: s.isLead ? 1 : 0,
      });
    }
    return pts;
  }, [events]);
  const presetDeltas = useMemo(() => computeAllPresetDeltas(deltaPoints), [deltaPoints]);

  const bounds = useMemo(() => {
    const b = rangeBoundsAsDates(range);
    if (b) return b;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const since = new Date(now);
    since.setDate(since.getDate() - 30);
    const until = new Date(now);
    until.setDate(until.getDate() + 1);
    return { since, until };
  }, [range]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lp_events")
      .select("*")
      .gte("created_at", bounds.since.toISOString())
      .lt("created_at", bounds.until.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    setEvents((data || []) as unknown as LpEvent[]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  // Live visitor count via Supabase Realtime presence channel.
  // Robust: reflects actual WebSocket connections, no DB polling required.
  useEffect(() => {
    const cleanup = subscribeLiveVisitorsCount(setActiveUsers);
    return cleanup;
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`lp_events_live_${bounds.since.getTime()}_${bounds.until.getTime()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lp_events" }, () => {
        void load();
      })
      .subscribe();
    const t = setInterval(load, 10000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.since.getTime(), bounds.until.getTime()]);

  const reset = async () => {
    if (!confirm("Eliminare TUTTI gli eventi LP?")) return;
    await supabase.from("lp_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    load();
  };

  const real = useMemo(() => events.filter((e) => !e.is_bot), [events]);
  const bots = useMemo(() => events.filter((e) => e.is_bot), [events]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="sticky top-12 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-background/95 backdrop-blur border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" /> Landing page
          </h1>
          <p className="text-sm text-muted-foreground">
            {vista === "contenuti"
              ? "I contenuti pubblici: quello che salvi va online subito"
              : "Come sta andando, in tempo reale"}
            {vista === "rendimento" && lastRefresh && (
              <span className="ml-2 text-xs">
                · Aggiornato alle {String(lastRefresh.getHours()).padStart(2, "0")}:
                {String(lastRefresh.getMinutes()).padStart(2, "0")}:
                {String(lastRefresh.getSeconds()).padStart(2, "0")}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Segmento attivo={vista === "contenuti"} onClick={() => setVista("contenuti")}>
            Contenuti
          </Segmento>
          <Segmento attivo={vista === "rendimento"} onClick={() => setVista("rendimento")}>
            Rendimento
          </Segmento>
          {vista === "rendimento" && (
            <>
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
              <DateRangeFilter value={range} onChange={setRange} />
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                Aggiorna
              </Button>
              <Button size="sm" variant="destructive" onClick={reset}>
                Reset
              </Button>
            </>
          )}
        </div>
      </div>

      {vista === "contenuti" && <LandingContentEditor />}

      {/* Live visitors */}
      <Card className={vista === "contenuti" ? "hidden" : undefined}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-sm font-medium">Visitatori in tempo reale</span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{activeUsers}</div>
            <div className="text-xs text-muted-foreground">persone attive</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="real" className={vista === "contenuti" ? "hidden" : undefined}>
        <TabsList>
          <TabsTrigger value="real">
            👤 Utenti reali ({new Set(real.map((e) => e.session_id)).size})
          </TabsTrigger>
          <TabsTrigger value="bots">
            <Bot className="h-3 w-3 mr-1" />
            Tracking BOT ({new Set(bots.map((e) => e.session_id)).size})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="real" className="space-y-4 pt-4">
          <SectionDashboard events={real} />
        </TabsContent>

        <TabsContent value="bots" className="space-y-4 pt-4">
          <SectionDashboard events={bots} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionDashboard({ events }: { events: LpEvent[] }) {
  const stats = useMemo(
    () => buildLpDashboardStats(events as unknown as LpEventRecord[]),
    [events],
  );

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}m ${sec}s`;
  };

  // Recent sessions
  const recentSessions = useMemo(
    () =>
      [...stats.sessions]
        .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
        .slice(0, 50),
    [stats.sessions],
  );

  if (stats.totalSessions === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Nessun dato in questo intervallo.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          icon={<Eye className="h-4 w-4" />}
          label="Visite totali"
          v={stats.totalSessions}
          color="bg-blue-500/10"
        />
        <KPI
          icon={<Clock className="h-4 w-4" />}
          label="Tempo medio"
          v={fmtDur(stats.avgDuration)}
          color="bg-violet-500/10"
        />
        <KPI
          icon={<ArrowDown className="h-4 w-4" />}
          label="Scroll medio"
          v={`${stats.avgScroll.toFixed(0)}%`}
          color="bg-amber-500/10"
        />
        <KPI
          icon={<Target className="h-4 w-4" />}
          label="Conversion rate"
          v={`${stats.cvr.toFixed(1)}%`}
          sub={`${stats.leads} prenot.`}
          color="bg-emerald-500/10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPI
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Click su date (AddToCart)"
          v={stats.dateClicks}
          sub={`${stats.totalSessions ? ((stats.dateClicks / stats.totalSessions) * 100).toFixed(1) : 0}% delle visite`}
          color="bg-orange-500/10"
        />
        <KPI
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Click su orari"
          v={stats.timeClicks}
          color="bg-orange-500/10"
        />
        <KPI
          icon={<TrendingDown className="h-4 w-4" />}
          label="Bounce rate"
          v={`${stats.bounceRate.toFixed(1)}%`}
          sub="<10s e <25% scroll"
          color="bg-rose-500/10"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Funnel · drop-off step by step
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.funnel.map((step, idx) => (
            <div key={step.key}>
              <div className="flex justify-between text-xs mb-1 gap-2">
                <span className="flex items-center gap-2 flex-wrap">
                  <span>
                    <strong>{idx + 1}.</strong> {step.label}
                  </span>
                  <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    {step.customEvent}
                  </code>
                </span>
                <span className="font-bold whitespace-nowrap">
                  {step.count} ({step.pctOfTotal.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${step.pctOfTotal}%` }} />
              </div>
              {idx > 0 && step.dropFromPrev > 0 && (
                <div className="text-[11px] text-rose-600 mt-1">
                  ↓ Persi {step.dropFromPrev} utenti dallo step precedente (
                  {step.dropPctFromPrev.toFixed(1)}%)
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Lo step con la perdita più alta è quello da ottimizzare per primo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Profondità di scroll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[25, 50, 75, 100].map((th) => {
            const count = stats.scrollDepths[th as 25];
            const pct = stats.totalSessions ? (count / stats.totalSessions) * 100 : 0;
            return (
              <div key={th}>
                <div className="flex justify-between text-xs mb-1">
                  <span>Hanno scrollato ≥ {th}%</span>
                  <span className="font-bold">
                    {count} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dispositivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {Object.entries(stats.devices)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => {
                const pct = stats.totalSessions ? (v / stats.totalSessions) * 100 : 0;
                const Icon =
                  k === "ios" || k === "android" ? Smartphone : k === "desktop" ? Monitor : Tablet;
                return (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 capitalize">
                      <Icon className="h-3 w-3" /> {k}
                    </span>
                    <span>
                      <strong>{v}</strong>
                      <span className="text-xs text-muted-foreground ml-2">{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sorgenti traffico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {Object.entries(stats.sources)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="truncate">{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Ultime sessioni</span>
            <span className="text-xs text-muted-foreground font-normal">
              {recentSessions.length} sessioni
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-2">Data / ora</th>
                <th className="pr-2">Durata</th>
                <th className="pr-2">Scroll</th>
                <th className="pr-2">Device</th>
                <th className="pr-2">Sorgente</th>
                <th>Conv.</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {formatDateTime(s.when, undefined, { short: true })}{" "}
                    {String(new Date(s.when).getHours()).padStart(2, "0")}:
                    {String(new Date(s.when).getMinutes()).padStart(2, "0")}
                  </td>
                  <td className="pr-2">{Math.round(s.dur)}s</td>
                  <td className="pr-2">{s.scroll}%</td>
                  <td className="pr-2 capitalize">{s.device}</td>
                  <td className="pr-2 truncate max-w-[180px]">{s.source}</td>
                  <td>
                    {s.converted ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                        ✓ Sì
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">×</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function KPI({
  icon,
  label,
  v,
  sub,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  v: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon && <span className={`p-1.5 rounded-md ${color || "bg-muted"}`}>{icon}</span>}
          <span>{label}</span>
        </div>
        <div className="text-2xl font-bold mt-2">{v}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
