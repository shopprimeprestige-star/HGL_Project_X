import { useMemo } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { Lead } from "@/crm/types";

export function UtmHygieneScore({ leads }: { leads: Lead[] }) {
  const audit = useMemo(() => {
    const total = leads.length || 1;
    let missingSource = 0;
    let genericCampaign = 0;
    let missingClid = 0;
    let missingAdId = 0;
    leads.forEach((l) => {
      const t = l.data.tracking;
      if (!t?.utm_source) missingSource++;
      const camp = (t?.utm_campaign || "").toLowerCase();
      if (!camp || camp === "untitled" || camp === "untitled-campaign" || camp === "(not set)") genericCampaign++;
      if (!t?.fbclid && !t?.ttclid) missingClid++;
      if (!t?.ad_id) missingAdId++;
    });
    const issues = [
      { label: "UTM source mancante", n: missingSource, pct: (missingSource / total) * 100, weight: 30 },
      { label: "Campaign generica/non settata", n: genericCampaign, pct: (genericCampaign / total) * 100, weight: 25 },
      { label: "Click ID mancante (fbclid/ttclid)", n: missingClid, pct: (missingClid / total) * 100, weight: 25 },
      { label: "Ad ID mancante", n: missingAdId, pct: (missingAdId / total) * 100, weight: 20 },
    ];
    const score = Math.max(0, 100 - issues.reduce((s, i) => s + (i.pct / 100) * i.weight, 0));
    return { issues, score: Math.round(score), total: leads.length };
  }, [leads]);

  const scoreColor = audit.score >= 80 ? "text-emerald-700" : audit.score >= 60 ? "text-amber-700" : "text-rose-700";

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">UTM Hygiene Score</h3>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</div>
            <div className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{audit.score}/100</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">{audit.total} lead analizzati</div>
        </div>
        <ul className="space-y-1.5">
          {audit.issues.map((i) => (
            <li key={i.label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                {i.pct < 10 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className={`h-3.5 w-3.5 ${i.pct > 50 ? "text-rose-600" : "text-amber-600"}`} />
                )}
                {i.label}
              </span>
              <span className={`tabular-nums ${i.pct > 50 ? "text-rose-700 font-semibold" : i.pct > 20 ? "text-amber-700" : "text-muted-foreground"}`}>
                {i.n} ({i.pct.toFixed(1)}%)
              </span>
            </li>
          ))}
        </ul>
        {audit.score < 80 && (
          <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
            <strong>Suggerimenti:</strong> imposta UTM su tutte le ad (utm_source, utm_campaign, utm_content), evita campagne "untitled", verifica che fbclid/ttclid arrivino in URL.
          </div>
        )}
      </div>
    </div>
  );
}
