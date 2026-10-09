import { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildCreativeFunnels } from "@/crm/lp-creative-funnel";
import type { LpEventRecord } from "@/crm/lp-performance";

interface AugmentedEvent extends LpEventRecord {
  ad_id?: string | null;
  ad_name?: string | null;
  creative_name?: string | null;
}

/** Mini funnel viz: mostra il funnel step-by-step della singola creativa
 *  basato sui FunnelStep eventi raccolti in lp_events per quell'ad_id.
 *  Riusa buildCreativeFunnels per coerenza con la pagina LP Performance. */
export function LpFunnelMini({
  adId, sinceISO, untilISO,
}: {
  adId: string;
  sinceISO: string;
  untilISO: string;
}) {
  const [events, setEvents] = useState<AugmentedEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setErr(null);
    supabase
      .from("lp_events")
      .select("id, created_at, event_name, session_id, step, payload, utm_source, device, is_bot, ad_id, ad_name, creative_name")
      .eq("ad_id", adId)
      .eq("is_bot", false)
      .gte("created_at", sinceISO)
      .lte("created_at", untilISO)
      .limit(20000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setErr(error.message); return; }
        setEvents((data ?? []) as unknown as AugmentedEvent[]);
      });
    return () => { cancelled = true; };
  }, [adId, sinceISO, untilISO]);

  const row = useMemo(() => {
    if (!events) return null;
    const rows = buildCreativeFunnels(events);
    return rows[0] ?? null;
  }, [events]);

  if (err) {
    return <div className="text-[11px] text-rose-600">Errore caricamento funnel: {err}</div>;
  }
  if (!events) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Caricamento funnel…
      </div>
    );
  }
  if (!row || row.totalSessions === 0) {
    return <div className="text-[11px] text-muted-foreground">Nessun dato funnel per questa inserzione nel periodo.</div>;
  }

  const max = row.funnel[0]?.count || 1;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-[11.5px]">
        <span className="font-semibold">Funnel LP — {row.totalSessions} sessioni</span>
        <span className="text-muted-foreground">CVR {row.cvr.toFixed(1)}% · Bounce {row.bounceRate.toFixed(0)}%</span>
      </div>
      <div className="space-y-1">
        {row.funnel.map((s) => {
          const pct = max > 0 ? (s.count / max) * 100 : 0;
          // Color: success se completion alta, warning medio, destructive basso
          const tone =
            s.pctOfTotal >= 60 ? "bg-success/70" :
            s.pctOfTotal >= 30 ? "bg-warning/70" :
            "bg-destructive/60";
          return (
            <div key={s.key} className="text-[10.5px]">
              <div className="flex items-center justify-between mb-0.5">
                <span className="truncate">{s.label}</span>
                <span className="tabular-nums text-muted-foreground ml-2">
                  {s.count} <span className="opacity-60">({s.pctOfTotal.toFixed(0)}%)</span>
                  {s.dropPctFromPrev > 0 && (
                    <span className="ml-1 text-rose-600">↓{s.dropPctFromPrev.toFixed(0)}%</span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full ${tone} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
