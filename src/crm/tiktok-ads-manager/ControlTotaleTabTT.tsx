/** Control Totale — TikTok.
 *  Vista budget account TikTok:
 *   - Spesa giornaliera vs daily_spend_tiktok configurato
 *   - Alert overspend (rosso se >120%, giallo se >100%, verde se ok)
 *   - Breakdown per campagna (top 10)
 *   - Trend ultimi 30 giorni con linea target
 *   - Status: media giornaliera, run-rate mensile, days over budget
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import { Loader2, AlertTriangle, CheckCircle2, TrendingUp, Target, DollarSign, Calendar } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";

interface Props {
  since: Date;
  until: Date;
}

interface SpendRow {
  spend_date: string;
  spend: number;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_id: string;
}

const fmtEUR = (v: number) => `€${v.toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;
const fmtEUR2 = (v: number) => `€${v.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;

export function ControlTotaleTabTT({ since, until }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<SpendRow[]>([]);
  const [dailyBudget, setDailyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    const sinceISO = since.toISOString().slice(0, 10);
    const untilISO = until.toISOString().slice(0, 10);
    Promise.all([
      supabase.from("tiktok_ad_spend")
        .select("spend_date, spend, campaign_id, campaign_name, ad_id")
        .eq("user_id", user.id)
        .gte("spend_date", sinceISO).lte("spend_date", untilISO)
        .order("spend_date", { ascending: true }),
      supabase.from("tracking_config")
        .select("daily_spend_tiktok")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(([spendRes, cfgRes]) => {
      if (!alive) return;
      setRows((spendRes.data as SpendRow[]) || []);
      setDailyBudget(Number((cfgRes.data as { daily_spend_tiktok?: number } | null)?.daily_spend_tiktok || 0));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user, since, until]);

  // Aggregati
  const { dailyTrend, totalSpend, daysActive, avgDaily, runRate30, overBudgetDays, ratio, byCampaign } = useMemo(() => {
    const byDay = new Map<string, number>();
    const byCamp = new Map<string, { name: string; spend: number; ads: Set<string> }>();
    for (const r of rows) {
      byDay.set(r.spend_date, (byDay.get(r.spend_date) || 0) + Number(r.spend || 0));
      const ck = r.campaign_id || "__none";
      let c = byCamp.get(ck);
      if (!c) { c = { name: r.campaign_name || "(senza campagna)", spend: 0, ads: new Set() }; byCamp.set(ck, c); }
      c.spend += Number(r.spend || 0);
      c.ads.add(r.ad_id);
    }
    const trend = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, spend]) => ({
        date: date.slice(5),
        fullDate: date,
        spend: Number(spend.toFixed(2)),
        target: dailyBudget,
        overshoot: dailyBudget > 0 && spend > dailyBudget * 1.2,
        underBudget: dailyBudget > 0 && spend < dailyBudget * 0.8,
      }));
    const total = trend.reduce((s, d) => s + d.spend, 0);
    const days = trend.length || 1;
    const avg = total / days;
    const overDays = trend.filter(d => dailyBudget > 0 && d.spend > dailyBudget).length;
    const ratio = dailyBudget > 0 ? avg / dailyBudget : 0;

    const camps = Array.from(byCamp.entries())
      .map(([id, v]) => ({ id, name: v.name, spend: v.spend, adsCount: v.ads.size }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    return {
      dailyTrend: trend,
      totalSpend: total,
      daysActive: days,
      avgDaily: avg,
      runRate30: avg * 30,
      overBudgetDays: overDays,
      ratio,
      byCampaign: camps,
    };
  }, [rows, dailyBudget]);

  // Alert level
  const alertLevel: "ok" | "warn" | "critical" = useMemo(() => {
    if (dailyBudget === 0) return "ok";
    if (ratio > 1.2) return "critical";
    if (ratio > 1) return "warn";
    return "ok";
  }, [ratio, dailyBudget]);

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Caricamento spesa TikTok…</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="m-4 rounded-xl border border-dashed border-border bg-white p-8 text-center text-muted-foreground text-[13px]">
        Nessuna spesa TikTok nel periodo. Esegui Sync per popolare i dati.
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-6 space-y-4">
      {/* Alert principale */}
      {dailyBudget === 0 ? (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-[13px] font-semibold text-amber-900">Budget giornaliero TikTok non configurato</div>
            <div className="text-[12px] text-amber-800 mt-1">Vai su Impostazioni → Budget e imposta <code className="bg-white/60 px-1 rounded">daily_spend_tiktok</code> per attivare alert overspend e tracking del run-rate.</div>
          </div>
        </div>
      ) : alertLevel === "critical" ? (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-[13px] font-semibold text-rose-900">Overspend TikTok critico</div>
            <div className="text-[12px] text-rose-800 mt-1">Spesa media giornaliera <strong>{fmtEUR2(avgDaily)}</strong> contro budget <strong>{fmtEUR(dailyBudget)}</strong> ({(ratio * 100).toFixed(0)}%). {overBudgetDays} giorni sopra budget. Riduci spesa o aumenta budget.</div>
          </div>
        </div>
      ) : alertLevel === "warn" ? (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-[13px] font-semibold text-amber-900">Spesa TikTok sopra budget</div>
            <div className="text-[12px] text-amber-800 mt-1">Spesa media <strong>{fmtEUR2(avgDaily)}</strong> vs target <strong>{fmtEUR(dailyBudget)}</strong> ({(ratio * 100).toFixed(0)}%). Monitora attentamente.</div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-[13px] font-semibold text-emerald-900">Spesa TikTok in linea con budget</div>
            <div className="text-[12px] text-emerald-800 mt-1">Spesa media <strong>{fmtEUR2(avgDaily)}</strong>/giorno entro target {fmtEUR(dailyBudget)} ({(ratio * 100).toFixed(0)}%).</div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<DollarSign className="h-3.5 w-3.5" />} label="Spesa totale periodo" value={fmtEUR(totalSpend)} sub={`${daysActive} giorni attivi`} />
        <KpiCard icon={<Target className="h-3.5 w-3.5" />} label="Media giornaliera" value={fmtEUR2(avgDaily)} sub={dailyBudget > 0 ? `target ${fmtEUR(dailyBudget)}` : "no budget set"} tone={alertLevel === "critical" ? "bad" : alertLevel === "warn" ? "warn" : "good"} />
        <KpiCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Run rate 30gg" value={fmtEUR(runRate30)} sub={dailyBudget > 0 ? `vs target ${fmtEUR(dailyBudget * 30)}` : "—"} />
        <KpiCard icon={<Calendar className="h-3.5 w-3.5" />} label="Giorni over budget" value={`${overBudgetDays}/${daysActive}`} sub={`${daysActive > 0 ? Math.round(overBudgetDays / daysActive * 100) : 0}% del periodo`} tone={overBudgetDays / Math.max(daysActive, 1) > 0.3 ? "bad" : overBudgetDays > 0 ? "warn" : "good"} />
      </div>

      {/* Trend giornaliero con target */}
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="text-[13px] font-semibold mb-2">Spesa giornaliera vs target</div>
        <div className="text-[11px] text-muted-foreground mb-3">Linea tratteggiata = budget giornaliero configurato. Barre rosse = overspend &gt;120% target.</div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `€${v}`} />
              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => fmtEUR2(v)} />
              <Bar dataKey="spend" name="Spesa" radius={[4, 4, 0, 0]}>
                {dailyTrend.map((d, i) => (
                  <Cell key={i} fill={d.overshoot ? "#f43f5e" : d.underBudget ? "#10b981" : "#ec4899"} />
                ))}
              </Bar>
              {dailyBudget > 0 && (
                <ReferenceLine y={dailyBudget} stroke="#3b82f6" strokeDasharray="6 4" label={{ value: `Target €${dailyBudget}`, position: "right", fontSize: 10, fill: "#3b82f6" }} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown per campagna */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[13px] font-semibold">Top 10 campagne per spesa</div>
          <div className="text-[11px] text-muted-foreground">Distribuzione del budget tra le campagne TikTok del periodo.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Campagna</th>
                <th className="px-3 py-2 text-right">Ads</th>
                <th className="px-3 py-2 text-right">Spesa</th>
                <th className="px-3 py-2 text-right">% del totale</th>
                <th className="px-3 py-2 text-left">Quota</th>
              </tr>
            </thead>
            <tbody>
              {byCampaign.map(c => {
                const pct = totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0;
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-3 py-2 truncate max-w-[320px]" title={c.name}>{c.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.adsCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtEUR2(c.spend)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct.toFixed(1)}%</td>
                    <td className="px-3 py-2">
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-pink-500 to-cyan-400" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone?: "good" | "warn" | "bad" }) {
  const cls = tone === "bad" ? "border-rose-200 bg-rose-50/40" : tone === "warn" ? "border-amber-200 bg-amber-50/40" : tone === "good" ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-white";
  const valueCls = tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "text-foreground";
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className={`text-[20px] font-semibold tabular-nums mt-1 ${valueCls}`}>{value}</div>
      <div className="text-[10.5px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
