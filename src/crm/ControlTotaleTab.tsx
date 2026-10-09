// Tab "Controllo Totale" per /CRM/campagne-meta
// Mostra qualità tracciamento full-stack (CAPI vs Pixel, qualità landing, sorgente Meta lead)
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Eye, Users,
  Target, Activity,
} from "lucide-react";

interface Campaign { id: string; name: string }
interface Adset { id: string; name: string; campaign_id: string }
interface AdNode { id: string; name: string; adset_id: string; campaign_id: string }

interface PerfItem {
  ad_id: string;
  ad_name: string;
  spend: number;
  lead: number;
}

interface LpEventRow {
  ad_id: string | null;
  event_name: string;
  session_id: string;
  capi_sent: boolean;
  time_on_page: number | null;
  max_scroll: number | null;
  utm_id: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

interface PublicLeadRow {
  id: string;
  nome: string;
  cognome: string;
  citta: string;
  created_at: string;
  status: string;
  capi_sent: boolean;
  ad_id: string | null;
  ad_name: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  fbclid: string | null;
}

interface AdControlMetrics {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  spend: number;
  pageViews: number;
  highQualityVisits: number;
  qualityRate: number; // HQV / PV
  readers40s: number;  // sessioni con time_on_page > 40
  cpmReader: number;   // spend / readers40s * 1000
  leadTotal: number;
  leadCapiSent: number;
  capiMatchRate: number; // capi_sent / total
  capiHealthy: boolean;
}

export function ControlTotaleTab({
  since,
  until,
  perf,
  ads,
  campaigns,
  adsets,
}: {
  since: Date;
  until: Date;
  perf: PerfItem[];
  ads: AdNode[];
  campaigns: Campaign[];
  adsets: Adset[];
}) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LpEventRow[]>([]);
  const [leads, setLeads] = useState<PublicLeadRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const sinceIso = since.toISOString();
        const untilIso = until.toISOString();

        const [evRes, leadRes] = await Promise.all([
          supabase
            .from("lp_events")
            .select("ad_id,event_name,session_id,capi_sent,time_on_page,max_scroll,utm_id,utm_content,utm_term")
            .gte("created_at", sinceIso)
            .lte("created_at", untilIso)
            .eq("is_bot", false)
            .limit(50000),
          supabase
            .from("public_leads")
            .select("id,nome,cognome,citta,created_at,status,capi_sent,ad_id,ad_name,campaign_id,adset_id,utm_source,utm_campaign,utm_medium,fbclid")
            .gte("created_at", sinceIso)
            .lte("created_at", untilIso)
            .order("created_at", { ascending: false })
            .limit(2000),
        ]);

        if (!alive) return;
        if (evRes.error) throw new Error(evRes.error.message);
        if (leadRes.error) throw new Error(leadRes.error.message);

        setEvents((evRes.data ?? []) as LpEventRow[]);
        setLeads((leadRes.data ?? []) as PublicLeadRow[]);
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Errore caricamento");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [since, until]);

  // Indicizza ads per nome campagna
  const campaignNameByAdId = useMemo(() => {
    const adsetsById = new Map(adsets.map((a) => [a.id, a]));
    const campsById = new Map(campaigns.map((c) => [c.id, c]));
    const m = new Map<string, string>();
    for (const ad of ads) {
      const adset = adsetsById.get(ad.adset_id);
      const camp = adset ? campsById.get(adset.campaign_id) : null;
      m.set(ad.id, camp?.name ?? "—");
    }
    return m;
  }, [ads, adsets, campaigns]);

  // Aggrega metriche per ad_id
  const metrics: AdControlMetrics[] = useMemo(() => {
    // Indicizza eventi per ad_id
    const byAd = new Map<string, LpEventRow[]>();
    for (const ev of events) {
      const key = ev.ad_id || ev.utm_content || "(no_ad)";
      if (!byAd.has(key)) byAd.set(key, []);
      byAd.get(key)!.push(ev);
    }

    // Indicizza lead per ad_id
    const leadsByAd = new Map<string, PublicLeadRow[]>();
    for (const ld of leads) {
      const key = ld.ad_id || "(no_ad)";
      if (!leadsByAd.has(key)) leadsByAd.set(key, []);
      leadsByAd.get(key)!.push(ld);
    }

    const perfByAd = new Map(perf.map((p) => [p.ad_id, p]));
    const allAdIds = new Set<string>([
      ...perf.map((p) => p.ad_id),
      ...Array.from(byAd.keys()),
      ...Array.from(leadsByAd.keys()),
    ]);

    const out: AdControlMetrics[] = [];
    for (const adId of allAdIds) {
      if (!adId || adId === "(no_ad)") continue;
      const evs = byAd.get(adId) ?? [];
      const adLeads = leadsByAd.get(adId) ?? [];
      const perfItem = perfByAd.get(adId);

      // PageViews uniche per session (un PageView per sessione)
      const pvSessions = new Set(
        evs.filter((e) => e.event_name === "PageView").map((e) => e.session_id),
      );
      // HighQualityVisit
      const hqvSessions = new Set(
        evs.filter((e) => e.event_name === "HighQualityVisit").map((e) => e.session_id),
      );
      // Sessioni con tempo > 40s (lettori veri)
      const readerSessions = new Set(
        evs.filter((e) => (e.time_on_page ?? 0) > 40).map((e) => e.session_id),
      );

      const pageViews = pvSessions.size;
      const highQualityVisits = hqvSessions.size;
      const readers40s = readerSessions.size;
      const spend = perfItem?.spend ?? 0;
      const leadTotal = adLeads.length || perfItem?.lead || 0;
      const leadCapiSent = adLeads.filter((l) => l.capi_sent).length;

      out.push({
        ad_id: adId,
        ad_name: perfItem?.ad_name || ads.find((a) => a.id === adId)?.name || `Ad ${adId.slice(0, 8)}`,
        campaign_name: campaignNameByAdId.get(adId) ?? "—",
        spend,
        pageViews,
        highQualityVisits,
        qualityRate: pageViews ? (highQualityVisits / pageViews) * 100 : 0,
        readers40s,
        cpmReader: readers40s ? (spend / readers40s) * 1000 : 0,
        leadTotal,
        leadCapiSent,
        capiMatchRate: leadTotal ? (leadCapiSent / leadTotal) * 100 : 0,
        capiHealthy: leadTotal === 0 || (leadCapiSent / leadTotal) >= 0.8,
      });
    }
    return out.sort((a, b) => b.spend - a.spend);
  }, [events, leads, perf, ads, campaignNameByAdId]);

  // KPI globali
  const totals = useMemo(() => {
    const totalLeads = leads.length;
    const totalCapi = leads.filter((l) => l.capi_sent).length;
    const totalPV = new Set(events.filter((e) => e.event_name === "PageView").map((e) => e.session_id)).size;
    const totalHQV = new Set(events.filter((e) => e.event_name === "HighQualityVisit").map((e) => e.session_id)).size;
    const totalReaders = new Set(events.filter((e) => (e.time_on_page ?? 0) > 40).map((e) => e.session_id)).size;
    const totalSpend = perf.reduce((s, p) => s + p.spend, 0);
    return {
      totalLeads,
      totalCapi,
      capiMatchRate: totalLeads ? (totalCapi / totalLeads) * 100 : 0,
      totalPV,
      totalHQV,
      qualityRate: totalPV ? (totalHQV / totalPV) * 100 : 0,
      totalReaders,
      cpmReader: totalReaders ? (totalSpend / totalReaders) * 1000 : 0,
      totalSpend,
    };
  }, [leads, events, perf]);

  // Alert: degradazione CAPI ultimi 2 giorni
  const capiAlert = useMemo(() => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
    const buckets = new Map<string, { total: number; capi: number }>();
    for (const ld of leads) {
      const day = ld.created_at.slice(0, 10);
      const b = buckets.get(day) ?? { total: 0, capi: 0 };
      b.total++;
      if (ld.capi_sent) b.capi++;
      buckets.set(day, b);
    }
    const recentDays = Array.from(buckets.entries())
      .filter(([d]) => new Date(d) >= twoDaysAgo)
      .filter(([, v]) => v.total >= 3); // ignora giorni con < 3 lead (poco significativi)
    const badDays = recentDays.filter(([, v]) => v.capi / v.total < 0.8);
    return {
      triggered: badDays.length >= 2,
      badDays: badDays.map(([d, v]) => ({ day: d, rate: (v.capi / v.total) * 100 })),
    };
  }, [leads]);

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-[oklch(0.55_0.18_252)]" />
        Carico dati tracciamento full-stack…
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
          ⚠️ {err}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* Alert degradazione CAPI */}
      {capiAlert.triggered && (
        <div className="rounded-xl border border-rose-300 bg-gradient-to-br from-rose-50 to-orange-50 p-4 flex gap-3">
          <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-rose-900 text-[14px]">
              ⚠️ Degradazione tracciamento CAPI rilevata
            </div>
            <div className="text-[12.5px] text-rose-800 mt-1">
              Il match Pixel ↔ CAPI è sceso sotto l'80% per <strong>{capiAlert.badDays.length} giorni recenti</strong>.
              Meta non sta ricevendo correttamente gli eventi server-side e il targeting si sta degradando.
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {capiAlert.badDays.map((d) => (
                <span key={d.day} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-rose-200 text-rose-700">
                  {d.day}: {d.rate.toFixed(0)}%
                </span>
              ))}
            </div>
            <div className="text-[11.5px] text-rose-700 mt-2">
              <strong>Azione:</strong> verifica che la edge function `capi` risponda 200 (Impostazioni → Test CAPI),
              che `meta_access_token` sia valido e che `external_id` venga passato in ogni Lead.
            </div>
          </div>
        </div>
      )}

      {/* KPI globali */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="Match CAPI vs Pixel"
          value={`${totals.capiMatchRate.toFixed(1)}%`}
          sub={`${totals.totalCapi} / ${totals.totalLeads} lead inviati a Meta`}
          tone={totals.capiMatchRate >= 80 ? "good" : totals.capiMatchRate >= 50 ? "warn" : "bad"}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Qualità Landing"
          value={`${totals.qualityRate.toFixed(1)}%`}
          sub={`${totals.totalHQV} HQV / ${totals.totalPV} PageView`}
          tone={totals.qualityRate >= 30 ? "good" : totals.qualityRate >= 15 ? "warn" : "bad"}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Lettori veri (>40s)"
          value={totals.totalReaders.toLocaleString("it-IT")}
          sub={`su ${totals.totalPV} sessioni totali`}
          tone="neutral"
        />
        <KpiCard
          icon={<Eye className="h-4 w-4" />}
          label="CPM Lettore"
          value={totals.cpmReader > 0 ? `€${totals.cpmReader.toFixed(2)}` : "—"}
          sub={`spesa €${totals.totalSpend.toFixed(0)} / lettori`}
          tone="neutral"
        />
      </div>

      {/* Tabella metriche per ad */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/40">
          <div className="text-[13px] font-semibold">Qualità tracciamento per inserzione</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            Confronta come ogni ad performa lato landing (qualità lettori) e lato server (CAPI healthy)
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-[oklch(0.985_0.003_250)] border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Inserzione</th>
                <th className="text-right px-3 py-2">Spesa</th>
                <th className="text-right px-3 py-2">PageView</th>
                <th className="text-right px-3 py-2">HQV</th>
                <th className="text-right px-3 py-2">Qualità %</th>
                <th className="text-right px-3 py-2">Lettori &gt;40s</th>
                <th className="text-right px-3 py-2">CPM Lettore</th>
                <th className="text-right px-3 py-2">Lead</th>
                <th className="text-right px-3 py-2">CAPI Match %</th>
              </tr>
            </thead>
            <tbody>
              {metrics.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground text-[13px]">
                    Nessun dato di tracciamento per il periodo selezionato.
                  </td>
                </tr>
              )}
              {metrics.map((m) => (
                <tr key={m.ad_id} className="border-b border-border hover:bg-secondary/30">
                  <td className="px-3 py-2.5">
                    <div className="font-medium truncate max-w-[260px]">{m.ad_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">{m.campaign_name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">€{m.spend.toFixed(0)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.pageViews}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.highQualityVisits}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <QualityChip pct={m.qualityRate} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.readers40s}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.cpmReader > 0 ? `€${m.cpmReader.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.leadTotal}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <CapiChip healthy={m.capiHealthy} pct={m.capiMatchRate} hasLeads={m.leadTotal > 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sorgente Meta completa per ogni lead */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/40">
          <div className="text-[13px] font-semibold">Sorgente Meta completa per lead</div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            Ultimi {Math.min(leads.length, 100)} lead con tracciamento attribution completo
          </div>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-[12px]">
            <thead className="bg-[oklch(0.985_0.003_250)] border-b border-border text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Lead</th>
                <th className="text-left px-3 py-2">Quando</th>
                <th className="text-left px-3 py-2">Campagna</th>
                <th className="text-left px-3 py-2">Inserzione</th>
                <th className="text-left px-3 py-2">UTM Source</th>
                <th className="text-center px-3 py-2">fbclid</th>
                <th className="text-center px-3 py-2">CAPI</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-[13px]">
                    Nessun lead nel periodo selezionato.
                  </td>
                </tr>
              )}
              {leads.slice(0, 100).map((l) => (
                <tr key={l.id} className="border-b border-border hover:bg-secondary/30">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.nome} {l.cognome}</div>
                    <div className="text-[10.5px] text-muted-foreground">{l.citta}</div>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground tabular-nums">
                    {new Date(l.created_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2 text-[11.5px] truncate max-w-[180px]">{l.utm_campaign || "—"}</td>
                  <td className="px-3 py-2 text-[11.5px] truncate max-w-[200px]">{l.ad_name || (l.ad_id ? `${l.ad_id.slice(0, 10)}…` : "—")}</td>
                  <td className="px-3 py-2 text-[11.5px]">{l.utm_source || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    {l.fbclid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 inline" /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {l.capi_sent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="h-3 w-3" /> NO
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
    tone === "warn" ? "text-amber-700 bg-amber-50 border-amber-200" :
    tone === "bad"  ? "text-rose-700 bg-rose-50 border-rose-200" :
    "text-foreground bg-white border-border";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-[22px] font-bold tabular-nums">{value}</div>
      <div className="text-[11px] mt-0.5 opacity-75">{sub}</div>
    </div>
  );
}

function QualityChip({ pct }: { pct: number }) {
  const tone =
    pct >= 30 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    pct >= 15 ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-rose-50 text-rose-700 border-rose-200";
  const Icon = pct >= 30 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tone}`}>
      <Icon className="h-3 w-3" />
      {pct.toFixed(1)}%
    </span>
  );
}

function CapiChip({ healthy, pct, hasLeads }: { healthy: boolean; pct: number; hasLeads: boolean }) {
  if (!hasLeads) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
      healthy ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
    }`}>
      {healthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {pct.toFixed(0)}%
    </span>
  );
}
