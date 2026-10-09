/** Scheda "Funnel KPI Ads" — incrocia risposte funnel × creative
 *  per identificare quale ad attira quale tipo di lead e con che efficienza. */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, HelpCircle, Loader2, Save, Trash2, Star } from "lucide-react";
import {
  buildFunnelKpiBlocks,
  type CreativeRef,
  type FunnelLeadLite,
  type QuestionKey,
} from "./funnel-kpi-utils";
import { DateRangeFilter, rangeBoundsAsDates, type DateRange } from "@/crm/DateRangeFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  /** Date range ereditato dall'Ads Manager (default). L'utente può override locale. */
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

const PRESETS_KEY = "ads-mgr-funnel-kpi-presets";
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
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(arr));
  }
}

function fmtPct(v: number): string {
  if (!isFinite(v) || v === 0) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
function fmtEur(v: number): string {
  if (!isFinite(v) || v === 0) return "—";
  return `€${v.toFixed(2)}`;
}
function fmtX(v: number): string {
  if (!isFinite(v) || v === 0) return "—";
  return `${v.toFixed(2)}×`;
}
/** Palette score allineata al verdetto operativo (emerald/amber/rose):
 *  ≥7 = vincente · 4-6.9 = da ottimizzare · <4 = da spegnere · 0 = N/D. */
function scoreColor(s: number): string {
  if (s === 0) return "bg-muted text-muted-foreground border border-border";
  if (s >= 7) return "bg-emerald-100 text-emerald-800 border border-emerald-300";
  if (s >= 4) return "bg-amber-100 text-amber-900 border border-amber-300";
  return "bg-rose-100 text-rose-800 border border-rose-300";
}
function medalFor(idx: number): string {
  return ["🥇", "🥈", "🥉"][idx] || "";
}

/** Heat color per cella heatmap: intensità proporzionale al rapporto cell/maxRow. */
function heatBg(value: number, max: number): string {
  if (max <= 0 || value === 0) return "bg-secondary/30 text-muted-foreground";
  const ratio = value / max;
  if (ratio >= 0.8) return "bg-emerald-600 text-white";
  if (ratio >= 0.6) return "bg-emerald-500 text-white";
  if (ratio >= 0.4) return "bg-emerald-400 text-emerald-950";
  if (ratio >= 0.2) return "bg-emerald-200 text-emerald-900";
  return "bg-emerald-100 text-emerald-900";
}

export function FunnelKpiAdsTab({ perf, since: parentSince, until: parentUntil, parentRange, onOpenAd }: Props) {
  const [question, setQuestion] = useState<QuestionKey>("urgenza");
  const [minLeads, setMinLeads] = useState<number>(3);
  const [sortBy, setSortBy] = useState<"score" | "leads">("score");
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  // Soglia min lead totali per essere mostrato nella heatmap (0 = mostra tutto)
  const [heatmapMinTotal, setHeatmapMinTotal] = useState<number>(0);

  // Override locale del date range (null = usa quello dell'Ads Manager)
  const [localRange, setLocalRange] = useState<DateRange | null>(null);
  const useParent = localRange === null;
  const effectiveRange = useParent ? parentRange : localRange!;
  const { since, until } = useMemo(() => {
    if (useParent) return { since: parentSince, until: parentUntil };
    const b = rangeBoundsAsDates(effectiveRange);
    if (b) return b;
    return { since: parentSince, until: parentUntil };
  }, [useParent, parentSince, parentUntil, effectiveRange]);

  // Preset salvati
  const [presets, setPresets] = useState<SavedPreset[]>(() => loadPresets());
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const [leads, setLeads] = useState<FunnelLeadLite[]>([]);
  const [prevLeads, setPrevLeads] = useState<FunnelLeadLite[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch public_leads filtrati per periodo (effettivo) + periodo precedente equivalente
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const sinceISO = since.toISOString();
    const untilISO = until.toISOString();
    const periodMs = until.getTime() - since.getTime();
    const prevSinceISO = new Date(since.getTime() - periodMs).toISOString();
    const prevUntilISO = sinceISO;
    const mapRow = (r: {
      id: string; ad_id: string | null; ad_name: string | null; creative_name: string | null;
      campaign_id: string | null; urgenza: string | null; portatore: boolean | null;
      disagio_score: number | null; pain_points: string[] | null;
    }): FunnelLeadLite => ({
      id: r.id, ad_id: r.ad_id, ad_name: r.ad_name, creative_name: r.creative_name,
      campaign_id: r.campaign_id, urgenza: r.urgenza, portatore: r.portatore,
      disagio_score: r.disagio_score, pain_points: r.pain_points || [],
    });
    Promise.all([
      supabase.from("public_leads")
        .select("id, ad_id, ad_name, creative_name, campaign_id, urgenza, portatore, disagio_score, pain_points")
        .gte("created_at", sinceISO).lt("created_at", untilISO).limit(5000),
      supabase.from("public_leads")
        .select("id, ad_id, ad_name, creative_name, campaign_id, urgenza, portatore, disagio_score, pain_points")
        .gte("created_at", prevSinceISO).lt("created_at", prevUntilISO).limit(5000),
    ]).then(([cur, prev]) => {
      if (!alive) return;
      setLeads((cur.data ?? []).map(mapRow));
      setPrevLeads((prev.data ?? []).map(mapRow));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [since, until]);

  // Mappa creative ref derivata da perf
  const creatives = useMemo(() => {
    const m = new Map<string, CreativeRef>();
    let aovSum = 0, srSum = 0, crSum = 0, n = 0;
    for (const p of perf) {
      const key = p.ad_id || p.ad_name || p.creative_name || "(senza creativa)";
      m.set(key, {
        ad_id: p.ad_id,
        ad_name: p.ad_name || "—",
        spend: p.spend,
        lpSessions: p.lpSessions ?? p.clicks ?? 0,
        lead: p.lead,
      });
      if (p.ad_name && !m.has(p.ad_name)) {
        m.set(p.ad_name, m.get(key)!);
      }
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
  }, [perf]);

  const blocks = useMemo(() => {
    return buildFunnelKpiBlocks({
      leads,
      creatives: creatives.map,
      question,
      minLeads,
      aov: creatives.aov,
      showRate: creatives.showRate,
      closeRate: creatives.closeRate,
    });
  }, [leads, creatives, question, minLeads]);

  // Stessi blocchi sul periodo precedente — solo per ricavare lead count per cella WoW
  const prevBlocks = useMemo(() => {
    return buildFunnelKpiBlocks({
      leads: prevLeads,
      creatives: creatives.map,
      question,
      minLeads: 1, // niente filtro: serve solo il count
      aov: creatives.aov,
      showRate: creatives.showRate,
      closeRate: creatives.closeRate,
    });
  }, [prevLeads, creatives, question]);

  // Heatmap data: top 10 creative per lead totale × tutte le risposte
  const heatmap = useMemo(() => {
    if (blocks.length === 0) return null;
    const answers = blocks.map((b) => ({ key: b.answer, label: b.answerLabel }));

    // Mappa periodo precedente: creativeKey|answer → leadCount
    const prevMap = new Map<string, number>();
    for (const block of prevBlocks) {
      for (const row of block.rows) {
        prevMap.set(`${row.creativeKey}|${block.answer}`, row.leadCount);
      }
    }

    // Aggrega lead + metriche per creative across all answers
    type Cell = { leads: number; cvr: number; cpl: number; score: number; prev: number };
    const creativeTotals = new Map<string, {
      name: string; adId: string | null; total: number;
      perAnswer: Map<string, Cell>;
    }>();
    for (const block of blocks) {
      for (const row of block.rows) {
        let entry = creativeTotals.get(row.creativeKey);
        if (!entry) {
          entry = { name: row.adName, adId: row.adId, total: 0, perAnswer: new Map() };
          creativeTotals.set(row.creativeKey, entry);
        }
        entry.total += row.leadCount;
        entry.perAnswer.set(block.answer, {
          leads: row.leadCount,
          cvr: row.cvr,
          cpl: row.cpl,
          score: row.score,
          prev: prevMap.get(`${row.creativeKey}|${block.answer}`) || 0,
        });
      }
    }
    const top = [...creativeTotals.entries()]
      .filter(([, v]) => v.total >= heatmapMinTotal)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([key, v]) => ({ key, ...v }));
    return {
      answers,
      rows: top.map((r) => ({
        ...r,
        maxRow: Math.max(0, ...[...r.perAnswer.values()].map((c) => c.leads)),
      })),
    };
  }, [blocks, prevBlocks, heatmapMinTotal]);

  const toggleBlock = (key: string) => {
    setCollapsedKeys((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };
  const expandAll = () => setCollapsedKeys(new Set());
  const collapseAll = () => setCollapsedKeys(new Set(blocks.map((b) => b.answer)));

  // Preset handlers
  const applyPreset = (p: SavedPreset) => {
    setQuestion(p.question);
    setMinLeads(p.minLeads);
    setSortBy(p.sortBy);
    setActivePresetId(p.id);
  };
  const saveAsPreset = () => {
    const name = window.prompt("Nome del preset (es. 'Hot leads urgenti'):");
    if (!name || !name.trim()) return;
    const np: SavedPreset = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      question,
      minLeads,
      sortBy,
    };
    const next = [...presets, np];
    setPresets(next);
    savePresets(next);
    setActivePresetId(np.id);
    toast.success(`Preset "${np.name}" salvato`);
  };
  const deletePreset = (id: string) => {
    if (!window.confirm("Eliminare questo preset?")) return;
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
    if (activePresetId === id) setActivePresetId(null);
  };

  // Quando l'utente modifica i campi manualmente, deseleziona il preset attivo
  const onQuestionChange = (q: QuestionKey) => { setQuestion(q); setActivePresetId(null); };
  const onMinLeadsChange = (n: number) => { setMinLeads(n); setActivePresetId(null); };
  const onSortChange = (s: "score" | "leads") => { setSortBy(s); setActivePresetId(null); };

  return (
    <div className="px-5 pt-4 pb-6 space-y-4">
      {/* Header esplicativo */}
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🎯</div>
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold">Funnel KPI Ads</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Incrocia <strong>risposte funnel LP</strong> × <strong>creative</strong> per capire quale ad attira quale tipo di lead, e con che efficienza commerciale.
              Lo <strong>Score 1-10</strong> combina CVR (50%), CPL (30%) e ROAS stimato (20%) normalizzati sulla mediana del set.
            </p>
          </div>
        </div>
      </div>

      {/* Date range override */}
      <div className="bg-white border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-muted-foreground">Periodo</span>
        <DateRangeFilter
          value={effectiveRange}
          onChange={(r) => setLocalRange(r)}
        />
        {!useParent && (
          <button
            onClick={() => setLocalRange(null)}
            className="h-7 px-2 text-[11px] font-medium border border-border rounded-md hover:bg-secondary text-muted-foreground"
            title="Torna al periodo dell'Ads Manager"
          >
            ↺ Usa periodo Ads Manager
          </button>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">
          {leads.length} lead nel periodo
        </span>
      </div>

      {/* Preset bar */}
      <div className="bg-white border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <Star className="h-3 w-3" /> Preset
        </span>
        {presets.map((p) => {
          const active = activePresetId === p.id;
          const isFactory = !p.id.startsWith("user-");
          return (
            <div key={p.id} className="inline-flex items-center">
              <button
                onClick={() => applyPreset(p)}
                className={`h-7 px-2.5 text-[11.5px] font-medium border rounded-l-md transition-colors ${
                  active
                    ? "bg-[oklch(0.55_0.18_252)] text-white border-[oklch(0.55_0.18_252)]"
                    : "bg-white border-border hover:bg-secondary"
                }`}
              >
                {p.name}
              </button>
              {!isFactory && (
                <button
                  onClick={() => deletePreset(p.id)}
                  className={`h-7 px-1.5 border border-l-0 rounded-r-md transition-colors ${
                    active ? "bg-[oklch(0.55_0.18_252)] text-white border-[oklch(0.55_0.18_252)]" : "bg-white border-border hover:bg-rose-50 text-muted-foreground hover:text-rose-600"
                  }`}
                  title="Elimina preset"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={saveAsPreset}
          className="h-7 px-2.5 text-[11.5px] font-medium border border-dashed border-border rounded-md hover:bg-secondary text-muted-foreground inline-flex items-center gap-1"
          title="Salva combinazione corrente come nuovo preset"
        >
          <Save className="h-3 w-3" /> Salva attuale
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold uppercase text-muted-foreground">Domanda</label>
          <select
            value={question}
            onChange={(e) => onQuestionChange(e.target.value as QuestionKey)}
            className="h-8 px-2 text-[12.5px] border border-border rounded-md bg-white"
          >
            {QUESTIONS.map((q) => (
              <option key={q.key} value={q.key}>{q.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold uppercase text-muted-foreground">Min lead</label>
          <select
            value={minLeads}
            onChange={(e) => onMinLeadsChange(Number(e.target.value))}
            className="h-8 px-2 text-[12.5px] border border-border rounded-md bg-white"
            title="Combinazioni con meno lead vengono mostrate ma senza score (volume insufficiente)"
          >
            {MIN_LEAD_OPTIONS.map((n) => (
              <option key={n} value={n}>≥ {n}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold uppercase text-muted-foreground">Ordina per</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as "score" | "leads")}
            className="h-8 px-2 text-[12.5px] border border-border rounded-md bg-white"
          >
            <option value="score">Score</option>
            <option value="leads">Lead</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={expandAll} className="h-8 px-3 text-[12px] font-medium border border-border rounded-md hover:bg-secondary">Espandi tutto</button>
          <button onClick={collapseAll} className="h-8 px-3 text-[12px] font-medium border border-border rounded-md hover:bg-secondary">Comprimi tutto</button>
        </div>
      </div>

      {/* Heatmap noise filter */}
      <div className="bg-white border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-muted-foreground">Heatmap · nascondi creative con</span>
        <select
          value={heatmapMinTotal}
          onChange={(e) => setHeatmapMinTotal(Number(e.target.value))}
          className="h-7 px-2 text-[11.5px] border border-border rounded-md bg-white"
          title="Le creative con meno lead totali nel periodo verranno escluse dalla heatmap"
        >
          {[0, 1, 2, 3, 5, 10, 20].map((n) => (
            <option key={n} value={n}>{n === 0 ? "Mostra tutte" : `< ${n} lead`}</option>
          ))}
        </select>
        <span className="text-[10.5px] text-muted-foreground">
          (filtra il rumore delle creative con volume troppo basso per essere significative)
        </span>
      </div>

      {/* Heatmap top 10 creative × risposte */}
      {!loading && heatmap && heatmap.rows.length > 0 && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold">🔥 Heatmap concentrazione lead</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Top 10 creative × risposte. Intensità del verde = quota di lead di quella creative concentrata su quella risposta.
              </p>
            </div>
            <div className="text-[10.5px] text-muted-foreground flex items-center gap-2">
              <span>Bassa</span>
              <span className="inline-flex h-3 rounded overflow-hidden border border-border">
                <span className="w-4 bg-emerald-100" />
                <span className="w-4 bg-emerald-200" />
                <span className="w-4 bg-emerald-400" />
                <span className="w-4 bg-emerald-500" />
                <span className="w-4 bg-emerald-600" />
              </span>
              <span>Alta</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-secondary/20 z-10 min-w-[200px]">Creative</th>
                  <th className="text-right px-2 py-2 font-semibold">Tot</th>
                  {heatmap.answers.map((a) => (
                    <th key={a.key} className="text-center px-2 py-2 font-semibold whitespace-nowrap">
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map((row, idx) => (
                  <tr
                    key={row.key}
                    className={`border-b border-border/40 ${row.adId && onOpenAd ? "cursor-pointer hover:bg-secondary/30" : ""}`}
                    onClick={() => row.adId && onOpenAd?.(row.adId)}
                  >
                    <td className="px-3 py-1.5 font-medium sticky left-0 bg-white truncate max-w-[240px]">
                      <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                      {medalFor(idx) && <span className="mr-1">{medalFor(idx)}</span>}
                      {row.name}
                    </td>
                    <td className="text-right px-2 py-1.5 tabular-nums font-semibold">{row.total}</td>
                    {heatmap.answers.map((a) => {
                      const cell = row.perAnswer.get(a.key);
                      const val = cell?.leads || 0;
                      const prev = cell?.prev || 0;
                      let deltaLabel = "";
                      let deltaClass = "text-muted-foreground";
                      if (val > 0 || prev > 0) {
                        if (prev === 0 && val > 0) {
                          deltaLabel = "nuovo";
                          deltaClass = "text-emerald-600 font-semibold";
                        } else if (val === 0 && prev > 0) {
                          deltaLabel = "−100%";
                          deltaClass = "text-rose-600 font-semibold";
                        } else {
                          const d = ((val - prev) / prev) * 100;
                          const sign = d >= 0 ? "▲+" : "▼";
                          deltaLabel = `${sign}${Math.abs(d).toFixed(0)}%`;
                          deltaClass = d >= 0 ? "text-emerald-600" : "text-rose-600";
                        }
                      }
                      return (
                        <td key={a.key} className="text-center px-1 py-1">
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`inline-flex flex-col items-center justify-center min-w-[40px] h-9 px-1.5 rounded text-[11px] font-semibold tabular-nums cursor-help ${heatBg(val, row.maxRow)}`}
                                >
                                  <span className="leading-none">{val || ""}</span>
                                  {deltaLabel && (
                                    <span className={`text-[9px] leading-tight ${val === 0 && prev > 0 ? deltaClass : (val >= prev ? "opacity-80" : "opacity-90")}`}>
                                      {deltaLabel}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[11px] max-w-[260px]">
                                <div className="font-semibold mb-1 truncate">{row.name}</div>
                                <div className="text-muted-foreground mb-1.5 truncate">→ {a.label}</div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
                                  <span className="text-muted-foreground">Lead</span>
                                  <span className="text-right font-semibold">{val}</span>
                                  <span className="text-muted-foreground">Periodo prec.</span>
                                  <span className="text-right">{prev}</span>
                                  <span className="text-muted-foreground">Var. WoW</span>
                                  <span className={`text-right ${deltaClass}`}>{deltaLabel || "—"}</span>
                                  <span className="text-muted-foreground">CVR</span>
                                  <span className="text-right">{cell ? fmtPct(cell.cvr) : "—"}</span>
                                  <span className="text-muted-foreground">CPL seg.</span>
                                  <span className="text-right">{cell ? fmtEur(cell.cpl) : "—"}</span>
                                  <span className="text-muted-foreground">Score</span>
                                  <span className="text-right font-semibold">{cell && cell.score > 0 ? `${cell.score}/10` : "—"}</span>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blocchi */}
      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento lead nel periodo…
        </div>
      ) : blocks.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-muted-foreground">
          Nessun lead nel periodo selezionato per questa domanda.
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => {
            const collapsed = collapsedKeys.has(block.answer);
            const sortedRows = [...block.rows].sort((a, b) => {
              if (sortBy === "leads") return b.leadCount - a.leadCount;
              if (a.score === 0 && b.score !== 0) return 1;
              if (b.score === 0 && a.score !== 0) return -1;
              return b.score - a.score || b.leadCount - a.leadCount;
            });
            // Aggregati periodo corrente per segmento
            const curLeads = block.totalLeads;
            const curSpend = block.rows.reduce((a, r) => a + r.cpl * r.leadCount, 0);
            const curSessions = block.rows.reduce((a, r) => a + (r.cvr > 0 ? r.leadCount / r.cvr : 0), 0);
            const curCpl = curLeads > 0 ? curSpend / curLeads : 0;
            const curCvr = curSessions > 0 ? curLeads / curSessions : 0;
            // Periodo precedente (stesso segmento, da prevBlocks)
            const prevBlock = prevBlocks.find((b) => b.answer === block.answer);
            const prevLeadsCount = prevBlock?.totalLeads ?? 0;
            const prevSpend = (prevBlock?.rows ?? []).reduce((a, r) => a + r.cpl * r.leadCount, 0);
            const prevSessions = (prevBlock?.rows ?? []).reduce((a, r) => a + (r.cvr > 0 ? r.leadCount / r.cvr : 0), 0);
            const prevCpl = prevLeadsCount > 0 ? prevSpend / prevLeadsCount : 0;
            const prevCvr = prevSessions > 0 ? prevLeadsCount / prevSessions : 0;
            const pctSafe = (c: number, p: number): number | null => (p === 0 ? (c === 0 ? 0 : null) : ((c - p) / p) * 100);
            const dLead = pctSafe(curLeads, prevLeadsCount);
            const dCpl = pctSafe(curCpl, prevCpl);
            const dCvr = pctSafe(curCvr, prevCvr);
            const lowVolume = curLeads < 10;
            const renderDelta = (label: string, value: number | null, lowerIsBetter: boolean, curAbs: string, prevAbs: string) => {
              const isMissing = value == null || !isFinite(value);
              const positive = !isMissing && (lowerIsBetter ? (value as number) < 0 : (value as number) > 0);
              const negative = !isMissing && (lowerIsBetter ? (value as number) > 0 : (value as number) < 0);
              const cls = lowVolume
                ? "bg-muted/60 text-muted-foreground border-border"
                : isMissing ? "bg-muted/40 text-muted-foreground border-border"
                : positive ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : negative ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-muted text-muted-foreground border-border";
              const sign = !isMissing && (value as number) > 0 ? "+" : "";
              return (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10.5px] font-medium tabular-nums cursor-help ${cls}`}>
                      <span className="opacity-70">{label}</span>
                      <span>{isMissing ? "—" : `${sign}${(value as number).toFixed(0)}%`}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11px] p-2">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span className="text-muted-foreground">Corrente</span>
                      <span className="text-right tabular-nums font-medium">{curAbs}</span>
                      <span className="text-muted-foreground">Periodo prec.</span>
                      <span className="text-right tabular-nums font-medium">{prevAbs}</span>
                    </div>
                    {lowVolume && (
                      <div className="mt-1.5 pt-1.5 border-t border-border text-amber-700 leading-tight">
                        ⚠ Volume basso ({curLeads} lead): variazione poco significativa.
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            };
            return (
              <div key={block.answer} className="bg-white border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleBlock(block.answer)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/40 transition-colors text-left flex-wrap"
                >
                  {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-semibold text-[13.5px]">{block.answerLabel}</span>
                  <span className="text-[11.5px] text-muted-foreground">
                    ({block.totalLeads} lead totali · {block.rows.length} creative)
                  </span>
                  <TooltipProvider delayDuration={150}>
                    <span className="inline-flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-0.5">vs prec.</span>
                      {renderDelta("lead", dLead, false, String(curLeads), String(prevLeadsCount))}
                      {renderDelta("CVR", dCvr, false, fmtPct(curCvr), fmtPct(prevCvr))}
                      {renderDelta("CPL", dCpl, true, fmtEur(curCpl), fmtEur(prevCpl))}
                    </span>
                  </TooltipProvider>
                </button>
                {!collapsed && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="w-full text-[12.5px]">
                      <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold">Creative</th>
                          <th className="text-right px-3 py-2 font-semibold">Lead</th>
                          <th className="text-right px-3 py-2 font-semibold">CVR</th>
                          <th className="text-right px-3 py-2 font-semibold" title="Spesa creative attribuita proporzionalmente al peso del segmento, divisa per i lead del segmento">CPL seg.</th>
                          <th className="text-right px-3 py-2 font-semibold" title="ROAS stimato: lead × AOV × showRate × closeRate / spesa attribuita">ROAS stim.</th>
                          <th className="text-right px-3 py-2 font-semibold">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRows.map((row, idx) => (
                          <tr
                            key={row.creativeKey}
                            className={`border-t border-border/60 hover:bg-secondary/30 ${row.adId && onOpenAd ? "cursor-pointer" : ""}`}
                            onClick={() => row.adId && onOpenAd?.(row.adId)}
                          >
                            <td className="px-4 py-2 truncate max-w-[280px]">
                              <span className="mr-1">{medalFor(idx)}</span>
                              <span className="font-medium">{row.adName}</span>
                            </td>
                            <td className="text-right px-3 py-2 tabular-nums font-semibold">{row.leadCount}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{fmtPct(row.cvr)}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{fmtEur(row.cpl)}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{fmtX(row.roas)}</td>
                            <td className="text-right px-3 py-2">
                              <span className={`inline-flex items-center justify-center min-w-[36px] h-6 px-2 rounded-full text-[11.5px] font-bold ${scoreColor(row.score)}`}>
                                {row.score === 0 ? "—" : `${row.score}/10`}
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
      )}

      {/* Footer note metodologica */}
      <div className="text-[11px] text-muted-foreground bg-secondary/30 rounded-md p-3 flex gap-2">
        <HelpCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Note:</strong> il <strong>CPL segmento</strong> attribuisce la spesa creative in proporzione al peso del segmento sui lead totali della creative. Il <strong>ROAS stimato</strong> usa AOV/showRate/closeRate medi globali (non vendita-per-lead). Lo <strong>Score</strong> è normalizzato sulla mediana del set: 5/10 = mediano, 10/10 = top performer di questo segmento.
          Score <strong>"—"</strong> = volume insufficiente (lead {`<`} {minLeads}).
        </div>
      </div>
    </div>
  );
}
