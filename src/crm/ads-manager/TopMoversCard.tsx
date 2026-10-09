import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { getTopMovers } from "@/crm/ads-financials.functions";
import { Sparkline } from "@/crm/ads-manager/Sparkline";

interface Mover {
  adId: string;
  adName: string;
  campaignName: string;
  first: number;
  last: number;
  delta: number;
  deltaPct: number;
  points: number;
  sparkline: number[];
}

export function TopMoversCard({
  accessToken,
  onOpen,
}: {
  accessToken: string;
  onOpen: (adId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [period, setPeriod] = useState<number>(14);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getTopMovers({ data: { accessToken, limit: 5, lookbackDays: 14 } })
      .then((r) => {
        if (!alive || !r.ok) return;
        setGainers(r.gainers as Mover[]);
        setLosers(r.losers as Mover[]);
        setPeriod(r.periodDays);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accessToken]);

  if (loading) {
    return (
      <div className="bg-white border border-border rounded-xl p-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carico Top Movers Composite Score…
      </div>
    );
  }

  if (gainers.length === 0 && losers.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="text-[12.5px] font-semibold mb-1">📈 Top Movers · Composite Score (ultime 2 settimane)</div>
        <div className="text-[11px] text-muted-foreground">
          Storico in costruzione. Servono almeno 2 snapshot giornalieri per ad. Lo storico viene popolato automaticamente ogni notte e ogni volta che apri il Deep Analysis di un'inserzione.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12.5px] font-semibold">📈 Top Movers · Composite Score</div>
        <span className="text-[10.5px] text-muted-foreground">ultimi {period} giorni</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MoverList title="In crescita" tone="emerald" Icon={TrendingUp} items={gainers} onOpen={onOpen} />
        <MoverList title="In calo" tone="rose" Icon={TrendingDown} items={losers} onOpen={onOpen} />
      </div>
    </div>
  );
}

function MoverList({
  title, tone, Icon, items, onOpen,
}: {
  title: string;
  tone: "emerald" | "rose";
  Icon: typeof TrendingUp;
  items: Mover[];
  onOpen: (adId: string) => void;
}) {
  const headerCls = tone === "emerald" ? "text-emerald-700" : "text-rose-700";
  const sparkColor = tone === "emerald" ? "#10b981" : "#ef4444";
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-2">
      <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 inline-flex items-center gap-1 ${headerCls}`}>
        <Icon className="h-3 w-3" /> {title}
      </div>
      {items.length === 0 ? (
        <div className="text-[10.5px] text-muted-foreground italic px-1 py-2">Nessuna ad significativa.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => {
            const deltaCls = m.delta > 0 ? "text-emerald-700" : m.delta < 0 ? "text-rose-700" : "text-muted-foreground";
            return (
              <li key={m.adId}>
                <button
                  type="button"
                  onClick={() => onOpen(m.adId)}
                  className="w-full text-left grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1.5 rounded hover:bg-white border border-transparent hover:border-border transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-medium truncate" title={m.adName}>{m.adName}</div>
                    <div className="text-[9.5px] text-muted-foreground truncate">{m.campaignName}</div>
                  </div>
                  <Sparkline values={m.sparkline} color={sparkColor} width={50} height={16} />
                  <div className="text-right">
                    <div className="text-[11.5px] font-semibold tabular-nums">{Math.round(m.last)}</div>
                    <div className={`text-[9.5px] font-semibold tabular-nums ${deltaCls}`}>
                      {m.delta > 0 ? "+" : ""}{m.delta.toFixed(1)} pt
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
