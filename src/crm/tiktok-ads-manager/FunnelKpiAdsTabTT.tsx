/** Funnel KPI Ads — variante TikTok.
 *  Clone visuale di FunnelKpiAdsTab Meta, ma:
 *   - sorgente spesa: tiktok_ad_spend (passata in `perf` dal parent)
 *   - attribuzione lead: ttclid invece di fbclid
 *   - filtra public_leads dove ttclid IS NOT NULL e (opz.) ad_id presente
 *   - join con lp_events (ttclid) per LP sessions
 *
 *  Riusa funnel-kpi-utils originale (cross-channel safe).
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Star, Trash2 } from "lucide-react";
import {
  buildFunnelKpiBlocks,
  type CreativeRef,
  type FunnelLeadLite,
  type QuestionKey,
} from "@/crm/ads-manager/funnel-kpi-utils";
import { DateRangeFilter, rangeBoundsAsDates, type DateRange } from "@/crm/DateRangeFilter";
import { toast } from "sonner";

interface PerfItemLite {
  ad_id: string;
  ad_name: string;
  spend: number;
  lead: number;
  clicks: number;
  lpSessions?: number;
  aov: number;
  showRate: number;
  closeRate: number;
  creative_name?: string | null;
}

interface Props {
  perf: PerfItemLite[];
  since: Date;
  until: Date;
  parentRange: DateRange;
  onOpenAd?: (adId: string) => void;
}

const QUESTIONS: Array<{ key: QuestionKey; label: string }> = [
  { key: "urgenza", label: "Urgenza" },
  { key: "portatore", label: "Portatore impianto" },
  { key: "pain_score", label: "Lead Pain Score" },
  { key: "pain_points", label: "Pain points" },
];
const MIN_LEAD_OPTIONS = [1, 2, 3, 5, 10];

interface SavedPreset {
  id: string;
  name: string;
  question: QuestionKey;
  minLeads: number;
  sortBy: "score" | "leads";
}
const PRESETS_KEY = "tt-ads-mgr-funnel-kpi-presets";
const FACTORY_PRESETS: SavedPreset[] = [
  { id: "hot-leads", name: "🔥 Hot leads", question: "urgenza", minLeads: 3, sortBy: "score" },
  { id: "pain-alto", name: "💢 Pain alto", question: "pain_score", minLeads: 2, sortBy: "leads" },
  { id: "portatori", name: "👤 Già portatori", question: "portatore", minLeads: 2, sortBy: "score" },
];

function loadPresets(): SavedPreset[] {
  if (typeof window === "undefined") return FACTORY_PRESETS;
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    if (!raw) return FACTORY_PRESETS;
    const arr = JSON.parse(raw) as SavedPreset[];
    return Array.isArray(arr) && arr.length > 0 ? arr : FACTORY_PRESETS;
  } catch {
    return FACTORY_PRESETS;
  }
}
function savePresets(arr: SavedPreset[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(PRESETS_KEY, JSON.stringify(arr));
}

const fmtPct = (v: number) => (!isFinite(v) || v === 0 ? "—" : `${(v * 100).toFixed(1)}%`);
const fmtEur = (v: number) => (!isFinite(v) || v === 0 ? "—" : `€${v.toFixed(2)}`);
const fmtX = (v: number) => (!isFinite(v) || v === 0 ? "—" : `${v.toFixed(2)}×`);
function scoreColor(s: number) {
  if (s === 0) return "bg-muted text-muted-foreground border border-border";
  if (s >= 7) return "bg-emerald-100 text-emerald-800 border border-emerald-300";
  if (s >= 4) return "bg-amber-100 text-amber-900 border border-amber-300";
  return "bg-rose-100 text-rose-800 border border-rose-300";
}
function heatBg(value: number, max: number) {
  if (max <= 0 || value === 0) return "bg-secondary/30 text-muted-foreground";
  const ratio = value / max;
  if (ratio >= 0.8) return "bg-pink-600 text-white";
  if (ratio >= 0.6) return "bg-pink-500 text-white";
  if (ratio >= 0.4) return "bg-pink-400 text-pink-950";
  if (ratio >= 0.2) return "bg-pink-200 text-pink-900";
  return "bg-pink-100 text-pink-900";
}

export function FunnelKpiAdsTabTT({ perf, since: parentSince, until: parentUntil, parentRange, onOpenAd }: Props) {
  const [question, setQuestion] = useState<QuestionKey>("urgenza");
  const [minLeads, setMinLeads] = useState<number>(3);
  const [sortBy, setSortBy] = useState<"score" | "leads">("score");
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [heatmapMinTotal, setHeatmapMinTotal] = useState<number>(0);
  const [localRange, setLocalRange] = useState<DateRange | null>(null);
  const useParent = localRange === null;
  const effectiveRange = useParent ? parentRange : localRange!;
  const { since, until } = useMemo(() => {
    if (useParent) return { since: parentSince, until: parentUntil };
    const b = rangeBoundsAsDates(effectiveRange);
    if (b) return b;
    return { since: parentSince, until: parentUntil };
  }, [useParent, parentSince, parentUntil, effectiveRange]);

  const [presets, setPresets] = useState<SavedPreset[]>(() => loadPresets());
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const [leads, setLeads] = useState<FunnelLeadLite[]>([]);
  const [lpSessionsByAd, setLpSessionsByAd] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch lead TT (ttclid not null) + lp_events sessioni TikTok
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const sinceISO = since.toISOString();
    const untilISO = until.toISOString();

    Promise.all([
      supabase.from("public_leads")
        .select("id, ad_id, ad_name, creative_name, campaign_id, urgenza, portatore, disagio_score, pain_points, ttclid")
        .not("ttclid", "is", null)
        .gte("created_at", sinceISO).lt("created_at", untilISO).limit(5000),
      // LP sessioni TikTok: utm_source ilike '%tiktok%' OR ttclid not null in payload
      supabase.from("lp_events")
        .select("ad_id, session_id, utm_source, payload")
        .gte("created_at", sinceISO).lt("created_at", untilISO)
        .eq("event_name", "PageView")
        .or("utm_source.ilike.%tiktok%,utm_source.ilike.%tt%")
        .eq("is_bot", false)
        .limit(20000),
    ]).then(([leadRes, lpRes]) => {
      if (!alive) return;
      const mappedLeads: FunnelLeadLite[] = ((leadRes.data ?? []) as Array<{
        id: string; ad_id: string | null; ad_name: string | null; creative_name: string | null;
        campaign_id: string | null; urgenza: string | null; portatore: boolean | null;
        disagio_score: number | null; pain_points: string[] | null;
      }>).map(r => ({
        id: r.id, ad_id: r.ad_id, ad_name: r.ad_name, creative_name: r.creative_name,
        campaign_id: r.campaign_id, urgenza: r.urgenza, portatore: r.portatore,
        disagio_score: r.disagio_score, pain_points: r.pain_points || [],
      }));
      setLeads(mappedLeads);

      // LP sessioni distinte per ad_id (sessione = session_id unico)
      const byAd = new Map<string, Set<string>>();
      for (const ev of (lpRes.data as Array<{ ad_id: string | null; session_id: string }> | null) || []) {
        if (!ev.ad_id || !ev.session_id) continue;
        let s = byAd.get(ev.ad_id);
        if (!s) { s = new Set(); byAd.set(ev.ad_id, s); }
        s.add(ev.session_id);
      }
      const counts = new Map<string, number>();
      byAd.forEach((set, adId) => counts.set(adId, set.size));
      setLpSessionsByAd(counts);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [since, until]);

  // Mappa creative ref con lpSessions reali (da lp_events) come fallback ai clicks
  const creatives = useMemo(() => {
    const m = new Map<string, CreativeRef>();
    let aovSum = 0, srSum = 0, crSum = 0, n = 0;
    for (const p of perf) {
      const key = p.ad_id || p.ad_name || p.creative_name || "(senza creativa)";
      const lpReal = lpSessionsByAd.get(p.ad_id) ?? 0;
      m.set(key, {
        ad_id: p.ad_id,
        ad_name: p.ad_name || "—",
        spend: p.spend,
        lpSessions: lpReal > 0 ? lpReal : (p.lpSessions ?? p.clicks ?? 0),
        lead: p.lead,
      });
      if (p.ad_name && !m.has(p.ad_name)) m.set(p.ad_name, m.get(key)!);
      if (p.aov > 0) { aovSum += p.aov; n++; }
      if (p.showRate > 0) srSum += p.showRate;
      if (p.closeRate > 0) crSum += p.closeRate;
    }
    return {
      map: m,
      aov: n > 0 ? aovSum / n : 0,
      showRate: n > 0 ? srSum / n : 0.5,
      closeRate: n > 0 ? crSum / n : 0.3,
    };
  }, [perf, lpSessionsByAd]);

  const blocks = useMemo(() => buildFunnelKpiBlocks({
    leads, creatives: creatives.map, question, minLeads,
    aov: creatives.aov, showRate: creatives.showRate, closeRate: creatives.closeRate,
  }), [leads, creatives, question, minLeads]);

  const sortedBlocks = useMemo(() => {
    const sorted = blocks.map(b => ({
      ...b,
      rows: [...b.rows].sort((a, b) => sortBy === "score" ? (b.score - a.score || b.leadCount - a.leadCount) : (b.leadCount - a.leadCount)),
    }));
    return sorted;
  }, [blocks, sortBy]);

  // Heatmap top 10 creative
  const heatmap = useMemo(() => {
    if (blocks.length === 0) return null;
    const answers = blocks.map(b => ({ key: b.answer, label: b.answerLabel }));
    type Cell = { leads: number; cvr: number; cpl: number; score: number };
    const tot = new Map<string, { name: string; adId: string | null; total: number; perAnswer: Map<string, Cell> }>();
    for (const b of blocks) for (const r of b.rows) {
      let e = tot.get(r.creativeKey);
      if (!e) { e = { name: r.adName, adId: r.adId, total: 0, perAnswer: new Map() }; tot.set(r.creativeKey, e); }
      e.total += r.leadCount;
      e.perAnswer.set(b.answer, { leads: r.leadCount, cvr: r.cvr, cpl: r.cpl, score: r.score });
    }
    const top = [...tot.entries()].filter(([, v]) => v.total >= heatmapMinTotal).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    return {
      answers,
      rows: top.map(([key, v]) => ({
        key, ...v,
        maxRow: Math.max(0, ...[...v.perAnswer.values()].map(c => c.leads)),
      })),
    };
  }, [blocks, heatmapMinTotal]);

  const toggleBlock = (k: string) => {
    setCollapsedKeys(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };
  const expandAll = () => setCollapsedKeys(new Set());
  const collapseAll = () => setCollapsedKeys(new Set(blocks.map(b => b.answer)));

  const applyPreset = (p: SavedPreset) => { setQuestion(p.question); setMinLeads(p.minLeads); setSortBy(p.sortBy); setActivePresetId(p.id); };
  const saveAsPreset = () => {
    const name = window.prompt("Nome del preset:");
    if (!name?.trim()) return;
    const np: SavedPreset = { id: `user-${Date.now()}`, name: name.trim(), question, minLeads, sortBy };
    const next = [...presets, np]; setPresets(next); savePresets(next); setActivePresetId(np.id);
    toast.success(`Preset "${np.name}" salvato`);
  };
  const deletePreset = (id: string) => {
    if (!window.confirm("Eliminare?")) return;
    const next = presets.filter(p => p.id !== id); setPresets(next); savePresets(next);
    if (activePresetId === id) setActivePresetId(null);
  };

  const onQuestionChange = (q: QuestionKey) => { setQuestion(q); setActivePresetId(null); };
  const onMinLeadsChange = (n: number) => { setMinLeads(n); setActivePresetId(null); };
  const onSortChange = (s: "score" | "leads") => { setSortBy(s); setActivePresetId(null); };

  return (
    <div className="px-5 pt-4 pb-6 space-y-4">
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🎯</div>
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold">Funnel KPI Ads — TikTok</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Incrocia <strong>risposte funnel LP</strong> × <strong>creative TikTok</strong> (attribuzione via <code className="text-[10px] bg-secondary px-1 rounded">ttclid</code>).
              Score 1-10 su CVR (50%), CPL (30%), ROAS stimato (20%) normalizzati su mediana del set.
            </p>
          </div>
        </div>
      </div>

      {/* Date range */}
      <div className="bg-white border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-muted-foreground">Periodo</span>
        <DateRangeFilter value={effectiveRange} onChange={(r) => setLocalRange(r)} />
        {!useParent && (
          <button onClick={() => setLocalRange(null)} className="h-7 px-2 text-[11px] font-medium border border-border rounded-md hover:bg-secondary text-muted-foreground">
            ↺ Usa periodo TT Ads Manager
          </button>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">{leads.length} lead TT nel periodo</span>
      </div>

      {/* Preset bar */}
      <div className="bg-white border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3" /> Preset</span>
        {presets.map(p => {
          const active = activePresetId === p.id;
          const isFactory = !p.id.startsWith("user-");
          return (
            <div key={p.id} className="inline-flex items-center">
              <button onClick={() => applyPreset(p)} className={`h-7 px-2.5 text-[11.5px] font-medium border rounded-l-md transition-colors ${active ? "bg-pink-600 text-white border-pink-600" : "bg-white border-border hover:bg-secondary"}`}>{p.name}</button>
              {!isFactory && (
                <button onClick={() => deletePreset(p.id)} className={`h-7 px-1.5 border border-l-0 rounded-r-md ${active ? "bg-pink-600 text-white border-pink-600" : "bg-white border-border hover:bg-rose-50 text-muted-foreground hover:text-rose-600"}`}><Trash2 className="h-3 w-3" /></button>
              )}
            </div>
          );
        })}
        <button onClick={saveAsPreset} className="h-7 px-2.5 text-[11.5px] font-medium border border-dashed border-border rounded-md hover:bg-secondary text-muted-foreground inline-flex items-center gap-1"><Save className="h-3 w-3" /> Salva attuale</button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold uppercase text-muted-foreground">Domanda</label>
          <select value={question} onChange={e => onQuestionChange(e.target.value as QuestionKey)} className="h-8 px-2 text-[12.5px] border border-border rounded-md bg-white">
            {QUESTIONS.map(q => <option key={q.key} value={q.key}>{q.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold uppercase text-muted-foreground">Min lead</label>
          <select value={minLeads} onChange={e => onMinLeadsChange(Number(e.target.value))} className="h-8 px-2 text-[12.5px] border border-border rounded-md bg-white">
            {MIN_LEAD_OPTIONS.map(n => <option key={n} value={n}>≥ {n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold uppercase text-muted-foreground">Ordina</label>
          <select value={sortBy} onChange={e => onSortChange(e.target.value as "score" | "leads")} className="h-8 px-2 text-[12.5px] border border-border rounded-md bg-white">
            <option value="score">Score</option><option value="leads">Lead</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={expandAll} className="h-8 px-3 text-[12px] font-medium border border-border rounded-md hover:bg-secondary">Espandi tutto</button>
          <button onClick={collapseAll} className="h-8 px-3 text-[12px] font-medium border border-border rounded-md hover:bg-secondary">Riduci tutto</button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Caricamento lead TT…</div>
      )}

      {!loading && leads.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-muted-foreground text-[13px]">
          Nessun lead con ttclid nel periodo. Verifica che la landing TikTok stia salvando il parametro <code>ttclid</code>.
        </div>
      )}

      {!loading && leads.length > 0 && heatmap && (
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold">Heatmap creative × {QUESTIONS.find(q => q.key === question)?.label}</div>
              <div className="text-[11px] text-muted-foreground">Top 10 creative per lead totale · intensità = lead nel segmento</div>
            </div>
            <select value={heatmapMinTotal} onChange={e => setHeatmapMinTotal(Number(e.target.value))} className="h-7 px-2 text-[11.5px] border border-border rounded-md bg-white">
              <option value={0}>Tutte</option><option value={3}>≥ 3 lead</option><option value={5}>≥ 5 lead</option><option value={10}>≥ 10 lead</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11.5px]">
              <thead className="bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Creative</th>
                  {heatmap.answers.map(a => <th key={a.key} className="px-2 py-2 text-center">{a.label}</th>)}
                  <th className="px-3 py-2 text-right">Tot</th>
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map(r => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="px-3 py-2">
                      <button onClick={() => r.adId && onOpenAd?.(r.adId)} className="text-left hover:underline truncate max-w-[260px] block" title={r.name}>{r.name}</button>
                    </td>
                    {heatmap.answers.map(a => {
                      const cell = r.perAnswer.get(a.key);
                      return (
                        <td key={a.key} className={`px-2 py-1.5 text-center tabular-nums ${cell ? heatBg(cell.leads, r.maxRow) : "bg-secondary/20 text-muted-foreground"}`}>
                          {cell ? cell.leads : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && sortedBlocks.map(block => {
        const collapsed = collapsedKeys.has(block.answer);
        return (
          <div key={block.answer} className="rounded-xl border border-border bg-white overflow-hidden">
            <button onClick={() => toggleBlock(block.answer)} className="w-full px-4 py-3 flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-[13.5px] font-semibold">{block.answerLabel}</span>
                <span className="text-[11px] text-muted-foreground">{block.totalLeads} lead · {block.rows.length} creative</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{collapsed ? "▶" : "▼"}</span>
            </button>
            {!collapsed && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-[12px]">
                  <thead className="bg-secondary/30 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Creative</th>
                      <th className="px-3 py-2 text-right">Lead</th>
                      <th className="px-3 py-2 text-right">CVR</th>
                      <th className="px-3 py-2 text-right">CPL</th>
                      <th className="px-3 py-2 text-right">ROAS</th>
                      <th className="px-3 py-2 text-center">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map(r => (
                      <tr key={r.creativeKey} className="border-t border-border hover:bg-secondary/30">
                        <td className="px-3 py-2">
                          <button onClick={() => r.adId && onOpenAd?.(r.adId)} className="text-left hover:underline truncate max-w-[260px] block" title={r.adName}>{r.adName}</button>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.leadCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtPct(r.cvr)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtEur(r.cpl)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtX(r.roas)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-9 h-6 rounded-md text-[11.5px] font-bold tabular-nums ${scoreColor(r.score)}`}>
                            {r.score === 0 ? "—" : r.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
