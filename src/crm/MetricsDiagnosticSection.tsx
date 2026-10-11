/** Sezione 'Diagnostica metriche' per la pagina Impostazioni.
 *  Esegue una chiamata LIVE all'API Meta Insights (account-level, last 30d)
 *  e confronta valori chiave (spend, impressions, clicks, CPM, CTR, Hook, Hold)
 *  con quelli aggregati localmente da `meta_ad_spend`.
 *  Drift > 5% = potenziale problema di sync o di formula. */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, AlertOctagon, Minus } from "lucide-react";
import { runMetricsDiagnostic, runTopAdsDiagnostic, type DiagnosticRow, type AdDiagnosticRow } from "@/crm/metrics-diagnostic.functions";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

function fmtVal(v: number | null, unit: "€" | "%" | "n"): string {
  if (v == null) return "—";
  if (unit === "€") return `€${v.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
  if (unit === "%") return `${v.toFixed(2)}%`;
  return Math.round(v).toLocaleString("it-IT");
}

function StatusBadge({ status, drift }: { status: DiagnosticRow["status"]; drift: number | null }) {
  if (status === "missing") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" /> Dati assenti
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Allineato
        {drift != null && <span className="opacity-60">({drift >= 0 ? "+" : ""}{drift.toFixed(1)}%)</span>}
      </span>
    );
  }
  if (status === "warn") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
        <AlertTriangle className="h-3 w-3" /> Drift lieve
        {drift != null && <span className="opacity-80">({drift >= 0 ? "+" : ""}{drift.toFixed(1)}%)</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-semibold">
      <AlertOctagon className="h-3 w-3" /> Drift &gt;5%
      {drift != null && <span>({drift >= 0 ? "+" : ""}{drift.toFixed(1)}%)</span>}
    </span>
  );
}

export function MetricsDiagnosticSection() {
  const [loading, setLoading] = useState(false);
  const [adsLoading, setAdsLoading] = useState(false);
  const [rows, setRows] = useState<DiagnosticRow[] | null>(null);
  const [adRows, setAdRows] = useState<AdDiagnosticRow[] | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string>("");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      toast.error("Sessione non valida");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await runMetricsDiagnostic({ data: { accessToken: token } });
      setRows(res.rows);
      setPeriodLabel(res.periodLabel);
      setFetchedAt(res.fetchedAt);
      const drifts = res.rows.filter((r) => r.status === "drift").length;
      if (drifts > 0) toast.warning(`Trovati ${drifts} drift > 5%`);
      else toast.success("Tutte le metriche allineate");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore sconosciuto";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const runAds = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) { toast.error("Sessione non valida"); return; }
    setAdsLoading(true);
    try {
      const res = await runTopAdsDiagnostic({ data: { accessToken: token } });
      setAdRows(res.ads);
      const drifts = res.ads.filter((a) => a.status === "drift").length;
      if (drifts > 0) toast.warning(`Trovati ${drifts} ad con drift > 5%`);
      else if (res.ads.length === 0) toast.info("Nessun ad con dati negli ultimi 30gg");
      else toast.success("Tutti gli ad allineati");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setAdsLoading(false);
    }
  };

  const driftCount = rows?.filter((r) => r.status === "drift").length ?? 0;
  const warnCount = rows?.filter((r) => r.status === "warn").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Diagnostica metriche
          {rows && driftCount > 0 && <Badge variant="destructive">{driftCount} drift</Badge>}
          {rows && driftCount === 0 && warnCount === 0 && <Badge className="bg-emerald-600">OK</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Confronta i valori live dell'API Meta con gli aggregati locali (ultimi 30 giorni).
          Drift &gt; 5% indica un problema di sync o di formula.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={run} disabled={loading} size="sm" variant="outline">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Confronto in corso…" : rows ? "Riesegui diagnosi" : "Esegui diagnosi account"}
          </Button>
          <Button onClick={runAds} disabled={adsLoading} size="sm" variant="outline">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${adsLoading ? "animate-spin" : ""}`} />
            {adsLoading ? "Confronto top ads…" : adRows ? "Riesegui top 10 ads" : "Diagnosi top 10 ads"}
          </Button>
          {fetchedAt && (
            <span className="text-[11px] text-muted-foreground">
              {periodLabel} · aggiornato {formatDistanceToNow(new Date(fetchedAt), { addSuffix: true, locale: it })}
            </span>
          )}
        </div>

        {error && (
          <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        {rows && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-[12px]">
              <thead className="bg-secondary/50 text-muted-foreground text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Metrica</th>
                  <th className="text-right px-3 py-2 font-medium">Live (Meta)</th>
                  <th className="text-right px-3 py-2 font-medium">Locale (DB)</th>
                  <th className="text-left px-3 py-2 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.metric} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtVal(r.live, r.unit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtVal(r.local, r.unit)}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} drift={r.driftPct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows && driftCount > 0 && (
          <div className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            <strong>Cosa significa drift &gt; 5%?</strong> I dati locali non sono aggiornati o le formule
            divergono. Prova a ri-sincronizzare lo storico ads (Reset KPI &amp; resync) o verifica
            che il cron <code>meta-spend-sync</code> stia girando.
          </div>
        )}

        {adRows && adRows.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <div className="px-3 py-2 bg-secondary/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Top 10 ad per spesa · drift singolo
            </div>
            <table className="w-full text-[12px]">
              <thead className="bg-secondary/30 text-muted-foreground text-[10.5px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Ad</th>
                  <th className="text-right px-3 py-2 font-medium">Spesa Live</th>
                  <th className="text-right px-3 py-2 font-medium">Spesa Locale</th>
                  <th className="text-right px-3 py-2 font-medium">Δ Spesa</th>
                  <th className="text-right px-3 py-2 font-medium">Δ Impr.</th>
                  <th className="text-left px-3 py-2 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {adRows.map((a) => (
                  <tr key={a.ad_id} className="border-t border-border">
                    <td className="px-3 py-2 max-w-[260px]">
                      <div className="font-medium truncate" title={a.ad_name || a.ad_id}>{a.ad_name || a.ad_id}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{a.ad_id}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtVal(a.liveSpend, "€")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtVal(a.localSpend, "€")}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${a.spendDriftPct != null && Math.abs(a.spendDriftPct) > 5 ? "text-rose-700" : "text-muted-foreground"}`}>
                      {a.spendDriftPct == null ? "—" : `${a.spendDriftPct >= 0 ? "+" : ""}${a.spendDriftPct.toFixed(1)}%`}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${a.imprDriftPct != null && Math.abs(a.imprDriftPct) > 5 ? "text-rose-700" : "text-muted-foreground"}`}>
                      {a.imprDriftPct == null ? "—" : `${a.imprDriftPct >= 0 ? "+" : ""}${a.imprDriftPct.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={a.status} drift={a.worstDriftPct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
