import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CapiHealth {
  loading: boolean;
  triggered: boolean;
  badDays: { day: string; rate: number; total: number; capi: number }[];
  globalRate: number;
}

/**
 * Monitora il match CAPI vs Pixel sui lead degli ultimi `windowDays` giorni.
 * Triggera l'alert quando in 2+ giorni recenti il match è < 80% (e ci sono almeno 3 lead/giorno).
 */
export function useCapiHealth(windowDays = 7): CapiHealth {
  const [state, setState] = useState<CapiHealth>({
    loading: true,
    triggered: false,
    badDays: [],
    globalRate: 0,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("public_leads")
        .select("created_at, capi_sent")
        .gte("created_at", since);
      if (!alive) return;
      if (error || !data) {
        setState({ loading: false, triggered: false, badDays: [], globalRate: 0 });
        return;
      }
      const buckets = new Map<string, { total: number; capi: number }>();
      for (const r of data) {
        const day = (r.created_at as string).slice(0, 10);
        const b = buckets.get(day) ?? { total: 0, capi: 0 };
        b.total++;
        if (r.capi_sent) b.capi++;
        buckets.set(day, b);
      }
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
      const recent = Array.from(buckets.entries()).filter(
        ([d, v]) => new Date(d) >= twoDaysAgo && v.total >= 3,
      );
      const bad = recent
        .filter(([, v]) => v.capi / v.total < 0.8)
        .map(([d, v]) => ({ day: d, rate: (v.capi / v.total) * 100, total: v.total, capi: v.capi }));
      const totals = data.reduce(
        (a, r) => ({ t: a.t + 1, c: a.c + (r.capi_sent ? 1 : 0) }),
        { t: 0, c: 0 },
      );
      setState({
        loading: false,
        triggered: bad.length >= 2,
        badDays: bad.sort((a, b) => a.day.localeCompare(b.day)),
        globalRate: totals.t ? (totals.c / totals.t) * 100 : 0,
      });
    })();
    return () => {
      alive = false;
    };
  }, [windowDays]);

  return state;
}
