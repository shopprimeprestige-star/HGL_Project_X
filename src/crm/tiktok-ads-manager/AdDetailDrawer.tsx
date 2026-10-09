import { useEffect, useMemo, useState } from "react";
import {
  CampoFinestra,
  Foglio,
  SezioneFinestra,
  VuotoFinestra,
} from "@/crm/ui/Finestra";
import { BarChart3, ExternalLink, Pause, Play, RefreshCw, Loader2, Pencil, Copy, Sparkles, Check, X } from "lucide-react";

/** Le azioni del pannello: stessa forma per tutte, il colore non le distingue —
 *  le distingue l'icona. Prima erano sei tinte diverse (bianco, ambra, verde,
 *  viola, nero) e nessuna di loro era "quella giusta" a colpo d'occhio. */
const AZIONE =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import { LeadDialog } from "@/crm/LeadDialog";
import { useCRM } from "@/crm/CRMContext";
import { toast } from "sonner";
import type { Lead } from "@/crm/types";
import { MetricHeaderTooltip } from "@/crm/ads-manager/MetricHeaderTooltip";

interface AdInfo {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  spend: number;
  leads: number;
  cplReal: number;
  roas: number;
  fatturato: number;
  hookRate?: number;
  holdRate?: number;
  view100Rate?: number;
  frequency?: number;
  ctr?: number;
  impressions?: number;
  clicks?: number;
  vendite?: number;
  trend: { date: string; spend: number; clicks: number; conv: number }[];
}

interface AttributedLeadRow {
  source: "public" | "crm";
  id: string;
  name: string;
  status: string;
  createdAt: string;
  revenue: number;
  ad_id: string | null;
  ttclid: string;
}

const fmtEUR = (v: number) => Number.isFinite(v) ? `€${v.toLocaleString("it-IT", { maximumFractionDigits: 0 })}` : "—";
const fmtX = (v: number) => Number.isFinite(v) ? `${v.toFixed(2)}x` : "—";
const fmtINT = (v: number) => Number.isFinite(v) ? Math.round(v).toLocaleString("it-IT") : "—";
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });

interface AiInsight {
  verdict?: string;
  verdict_reason?: string;
  recommendations?: Array<{ priority: string; action: string; reason: string }>;
}

export function AdDetailDrawer({
  ad,
  open,
  onClose,
  sinceISO,
  untilISO,
  advertiserId,
  onSync,
  onPauseAd,
  onResumeAd,
}: {
  ad: AdInfo | null;
  open: boolean;
  onClose: () => void;
  sinceISO: string;
  untilISO: string;
  advertiserId: string | null;
  onSync: () => Promise<void>;
  onPauseAd?: (adId: string) => Promise<void>;
  onResumeAd?: (adId: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const { leads: crmLeads } = useCRM();
  const [attributedLeads, setAttributedLeads] = useState<AttributedLeadRow[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [openLead, setOpenLead] = useState<Lead | null>(null);

  // Live status from TikTok
  const [liveStatus, setLiveStatus] = useState<"ENABLE" | "DISABLE" | "unknown" | "loading">("loading");

  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);

  // AI insight state
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchStatus = async (adId: string) => {
    if (!user) return;
    setLiveStatus("loading");
    try {
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch("/hooks/tiktok-ad-pause", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
        body: JSON.stringify({ userId: user.id, adIds: [adId], action: "status" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "status fetch failed");
      const s = json.status?.[adId] as "ENABLE" | "DISABLE" | "unknown" | undefined;
      setLiveStatus(s || "unknown");
    } catch {
      setLiveStatus("unknown");
    }
  };

  useEffect(() => {
    if (!ad || !open || !user) return;
    let alive = true;
    setLoadingLeads(true);
    setAiInsight(null);
    setRenaming(false);
    setNewName(ad.ad_name);
    fetchStatus(ad.ad_id);
    Promise.all([
      supabase
        .from("public_leads")
        .select("id, nome, cognome, email, status, created_at, ad_id, ttclid")
        .not("ttclid", "is", null)
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lte("created_at", `${untilISO}T23:59:59Z`)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("crm_leads")
        .select("id, data, created_at")
        .eq("user_id", user.id)
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lte("created_at", `${untilISO}T23:59:59Z`)
        .order("created_at", { ascending: false })
        .limit(500),
    ]).then(([pubRes, crmRes]) => {
      if (!alive) return;
      const out: AttributedLeadRow[] = [];
      for (const p of (pubRes.data as Array<{ id: string; nome: string; cognome: string; email: string; status: string; created_at: string; ad_id: string | null; ttclid: string | null }> | null) || []) {
        if (!p.ttclid) continue;
        if (p.ad_id !== ad.ad_id) continue;
        out.push({ source: "public", id: p.id, name: `${p.nome || ""} ${p.cognome || ""}`.trim() || p.email, status: p.status, createdAt: p.created_at, revenue: 0, ad_id: p.ad_id, ttclid: p.ttclid });
      }
      for (const c of (crmRes.data as Array<{ id: string; data: Record<string, unknown>; created_at: string }> | null) || []) {
        const d = c.data || {};
        const tracking = (d as { tracking?: Record<string, unknown> }).tracking || {};
        const ttclid = (d as { ttclid?: string }).ttclid || (tracking as { ttclid?: string }).ttclid;
        if (!ttclid) continue;
        const adId = (d as { ad_id?: string }).ad_id || (tracking as { ad_id?: string }).ad_id || null;
        if (adId !== ad.ad_id) continue;
        const payment = (d as { payment?: { prezzoFinaleVendita?: number; prezzoTotale?: number } }).payment || {};
        const anag = (d as { anagrafica?: { nome?: string; cognome?: string; email?: string } }).anagrafica || {};
        out.push({ source: "crm", id: c.id, name: `${anag.nome || ""} ${anag.cognome || ""}`.trim() || anag.email || "—", status: String((d as { status?: string }).status || "—"), createdAt: c.created_at, revenue: Number(payment.prezzoFinaleVendita || payment.prezzoTotale || 0), ad_id: adId, ttclid: String(ttclid) });
      }
      setAttributedLeads(out.slice(0, 50));
      setLoadingLeads(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad, open, user, sinceISO, untilISO]);

  const chartData = useMemo(() => {
    if (!ad) return [];
    const leadByDay = new Map<string, { count: number; revenue: number }>();
    for (const l of attributedLeads) {
      const day = l.createdAt.slice(0, 10);
      const cur = leadByDay.get(day) || { count: 0, revenue: 0 };
      cur.count += 1; cur.revenue += l.revenue;
      leadByDay.set(day, cur);
    }
    return ad.trend.map((t) => {
      const ld = leadByDay.get(t.date) || { count: 0, revenue: 0 };
      return { date: t.date.slice(5), spend: Number(t.spend.toFixed(2)), leads: ld.count, roas: t.spend > 0 ? Number((ld.revenue / t.spend).toFixed(2)) : 0 };
    });
  }, [ad, attributedLeads]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try { await onSync(); toast.success("Sync completata"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Sync fallita"); }
    finally { setSyncing(false); }
  };

  const [acting, setActing] = useState<null | "pause" | "resume">(null);
  const handlePause = async () => {
    if (!ad || !onPauseAd) return;
    setActing("pause");
    try { await onPauseAd(ad.ad_id); await fetchStatus(ad.ad_id); } finally { setActing(null); }
  };
  const handleResume = async () => {
    if (!ad || !onResumeAd) return;
    setActing("resume");
    try { await onResumeAd(ad.ad_id); await fetchStatus(ad.ad_id); } finally { setActing(null); }
  };

  const handleRename = async () => {
    if (!ad || !user) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === ad.ad_name) { setRenaming(false); return; }
    setRenameSubmitting(true);
    try {
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch("/hooks/tiktok-ad-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
        body: JSON.stringify({ userId: user.id, adId: ad.ad_id, adName: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Rinomina fallita");
      toast.success("Ad rinominata");
      setRenaming(false);
      // Trigger sync to refresh local data
      await onSync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rinomina fallita");
    } finally {
      setRenameSubmitting(false);
    }
  };

  const handleDuplicate = () => {
    if (!ad || !advertiserId) return;
    toast.info("Duplica TikTok richiede creative re-upload — apri TikTok Ads Manager", {
      action: {
        label: "Apri",
        onClick: () => window.open(`https://ads.tiktok.com/i18n/perf/ad?aadvid=${advertiserId}&ad_id=${ad.ad_id}`, "_blank"),
      },
    });
  };

  const handleGenerateAi = async () => {
    if (!ad) return;
    setAiLoading(true);
    setAiInsight(null);
    try {
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch("/hooks/tiktok-ad-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
        body: JSON.stringify({
          ad: {
            ad_name: ad.ad_name, ad_id: ad.ad_id,
            spend: ad.spend, lead: ad.leads, cpl: ad.cplReal, roas: ad.roas,
            hookRate: ad.hookRate ?? 0, holdRate: ad.holdRate ?? 0, view100Rate: ad.view100Rate ?? 0,
            frequency: ad.frequency ?? 0, ctr: ad.ctr ?? 0,
            impressions: ad.impressions ?? 0, clicks: ad.clicks ?? 0,
            vendite: ad.vendite ?? 0, fatturato: ad.fatturato,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "AI insight fallita");
      setAiInsight(json as AiInsight);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI insight fallita");
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenLead = (row: AttributedLeadRow) => {
    if (row.source !== "crm") return;
    const found = crmLeads.find((l) => l.id === row.id);
    if (found) setOpenLead(found);
  };

  const ttUrl = ad && advertiserId
    ? `https://ads.tiktok.com/i18n/perf/ad?aadvid=${advertiserId}&ad_id=${ad.ad_id}`
    : null;

  const showPauseBtn = liveStatus === "ENABLE" || liveStatus === "unknown" || liveStatus === "loading";
  const showResumeBtn = liveStatus === "DISABLE" || liveStatus === "unknown" || liveStatus === "loading";

  return (
    <>
      <Foglio
        aperto={open}
        onCambio={(o) => !o && onClose()}
        titolo="Analizza l'inserzione"
        contesto={ad ? `${ad.ad_name} · ${ad.campaign_name}` : undefined}
        icona={BarChart3}
        larghezza="lg"
        classeCorpo="space-y-3"
      >
        {ad && (
          <>
            {/* Identità + numeri chiave */}
            <SezioneFinestra
              titolo="Sintesi"
              azioni={<StatusPill status={liveStatus} />}
              classeCorpo="p-4 space-y-3"
            >
              <CampoFinestra
                etichetta="Nome inserzione"
                azioni={
                  !renaming ? (
                    <button
                      onClick={() => { setNewName(ad.ad_name); setRenaming(true); }}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      title="Rinomina"
                    >
                      <Pencil className="h-3 w-3" /> Rinomina
                    </button>
                  ) : undefined
                }
              >
                {renaming ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
                      maxLength={512}
                    />
                    <button
                      onClick={handleRename}
                      disabled={renameSubmitting}
                      title="Salva"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {renameSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setRenaming(false)}
                      disabled={renameSubmitting}
                      title="Annulla"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="truncate text-[13px] font-medium text-slate-900">{ad.ad_name}</div>
                )}
              </CampoFinestra>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <KpiBox label="Spesa" value={fmtEUR(ad.spend)} formulaKey="spend" />
                <KpiBox label="Lead" value={fmtINT(ad.leads)} accent formulaKey="lead" />
                <KpiBox label="CPL" value={fmtEUR(ad.cplReal)} accent formulaKey="cpl" />
                <KpiBox label="ROAS" value={fmtX(ad.roas)} tone={ad.roas >= 2 ? "good" : ad.roas > 0 ? "warn" : undefined} formulaKey="roas" />
              </div>
            </SezioneFinestra>

            {/* Cosa posso fare */}
            <SezioneFinestra titolo="Azioni" classeCorpo="p-4">
              <div className="flex flex-wrap gap-2">
                {ttUrl && (
                  <a href={ttUrl} target="_blank" rel="noopener noreferrer" className={AZIONE}>
                    <ExternalLink className="h-3 w-3" /> TikTok Ads Manager
                  </a>
                )}
                {showPauseBtn && (
                  <button onClick={handlePause} disabled={acting !== null || !onPauseAd} className={AZIONE}>
                    {acting === "pause" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
                    Pausa
                  </button>
                )}
                {showResumeBtn && (
                  <button onClick={handleResume} disabled={acting !== null || !onResumeAd} className={AZIONE}>
                    {acting === "resume" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Riattiva
                  </button>
                )}
                <button onClick={handleDuplicate} className={AZIONE}>
                  <Copy className="h-3 w-3" /> Duplica
                </button>
                <button onClick={handleGenerateAi} disabled={aiLoading} className={AZIONE}>
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Genera insight AI
                </button>
                <button onClick={handleSyncNow} disabled={syncing} className={AZIONE}>
                  {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Sincronizza ora
                </button>
              </div>
            </SezioneFinestra>

            {/* AI Insight */}
            {aiInsight && (
              <SezioneFinestra
                titolo="Insight AI"
                icona={Sparkles}
                nota={aiInsight.verdict || undefined}
                classeCorpo="p-4 space-y-2"
              >
                {aiInsight.verdict_reason && (
                  <p className="text-[12px] leading-snug text-slate-600">{aiInsight.verdict_reason}</p>
                )}
                {(aiInsight.recommendations ?? []).length > 0 && (
                  <ul className="space-y-1.5">
                    {(aiInsight.recommendations ?? []).map((r, i) => (
                      <li key={i} className="flex gap-2 text-[12px]">
                        <span
                          className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                            r.priority === "high"
                              ? "bg-rose-500"
                              : r.priority === "medium"
                                ? "bg-amber-500"
                                : "bg-slate-300"
                          }`}
                          title={r.priority}
                        />
                        <span className="min-w-0">
                          <b className="text-slate-900">{r.action}</b>{" "}
                          <span className="text-slate-500">— {r.reason}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SezioneFinestra>
            )}

            {/* Trend */}
            <SezioneFinestra titolo="Trend giornaliero" classeCorpo="p-4">
              {chartData.length < 2 ? (
                <VuotoFinestra testo="Servono almeno due giorni di dati per disegnare il grafico." />
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#ec4899" name="Spesa €" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="leads" stroke="#06b6d4" name="Lead" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="roas" stroke="#10b981" name="ROAS" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SezioneFinestra>

            {/* Lead attribuiti */}
            <SezioneFinestra
              titolo="Lead attribuiti"
              nota={`${attributedLeads.length} nel periodo`}
              azioni={loadingLeads ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : undefined}
              classeCorpo="p-4"
            >
              {attributedLeads.length === 0 ? (
                <VuotoFinestra testo="Nessun lead direttamente attribuito a questa ad. Quelli senza ad_id vengono distribuiti in proporzione alla spesa." />
              ) : (
                <div className="space-y-1.5">
                  {attributedLeads.map((l) => (
                    <button
                      key={`${l.source}-${l.id}`}
                      onClick={() => handleOpenLead(l)}
                      disabled={l.source !== "crm"}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium text-slate-900">{l.name}</div>
                        <div className="truncate text-[10.5px] text-slate-500">{fmtDate(l.createdAt)} · {l.status}</div>
                      </div>
                      {l.revenue > 0 && (
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-emerald-700">
                          {fmtEUR(l.revenue)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </SezioneFinestra>
          </>
        )}
      </Foglio>
      {openLead && <LeadDialog open={!!openLead} onOpenChange={(o) => !o && setOpenLead(null)} lead={openLead} />}
    </>
  );
}

function StatusPill({ status }: { status: "ENABLE" | "DISABLE" | "unknown" | "loading" }) {
  if (status === "loading") return <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="h-2.5 w-2.5 animate-spin" /> stato…</span>;
  const meta = status === "ENABLE"
    ? { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: "Attiva" }
    : status === "DISABLE"
    ? { cls: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400", label: "In pausa" }
    : { cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500", label: "Sconosciuto" };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${meta.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function KpiBox({ label, value, accent, tone, formulaKey }: { label: string; value: string; accent?: boolean; tone?: "good" | "warn"; formulaKey?: string }) {
  const cls = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : accent ? "text-slate-900" : "text-slate-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        <MetricHeaderTooltip formulaKey={formulaKey}>{label}</MetricHeaderTooltip>
      </div>
      <div className={`mt-0.5 text-[15px] font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
