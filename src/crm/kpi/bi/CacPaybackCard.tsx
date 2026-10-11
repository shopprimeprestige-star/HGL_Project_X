import { useMemo } from "react";
import { CHANNEL_LABEL, CHANNELS, type JourneyLead, type Channel } from "../journey/journey-utils";

export function CacPaybackCard({
  leads,
  spendByChannel,
  marginePct,
}: {
  leads: JourneyLead[];
  spendByChannel: Record<Channel, number>;
  marginePct: number;
}) {
  const rows = useMemo(() => {
    return CHANNELS.map((c) => {
      const channelLeads = leads.filter((l) => l.lastChannel === c && l.converted);
      const conv = channelLeads.length;
      const revenue = channelLeads.reduce((s, l) => s + l.revenue, 0);
      const spend = spendByChannel[c] || 0;
      const cac = conv > 0 ? spend / conv : 0;
      const avgRevenue = conv > 0 ? revenue / conv : 0;
      const margin = (marginePct / 100) * avgRevenue;
      const paybackMonths = margin > 0 ? cac / margin : 0;
      return { channel: c, conv, revenue, spend, cac, avgRevenue, paybackMonths };
    }).filter((r) => r.spend > 0 || r.conv > 0);
  }, [leads, spendByChannel, marginePct]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">CAC Payback per Canale</h3>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Canale</th>
              <th className="text-right px-3 py-2 font-medium">Vendite</th>
              <th className="text-right px-3 py-2 font-medium">Spend</th>
              <th className="text-right px-3 py-2 font-medium">CAC</th>
              <th className="text-right px-3 py-2 font-medium">Avg Rev</th>
              <th className="text-right px-3 py-2 font-medium">Payback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.channel} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{CHANNEL_LABEL[r.channel]}</td>
                <td className="text-right px-3 py-2 tabular-nums">{r.conv}</td>
                <td className="text-right px-3 py-2 tabular-nums">€{r.spend.toFixed(0)}</td>
                <td className="text-right px-3 py-2 tabular-nums">€{r.cac.toFixed(0)}</td>
                <td className="text-right px-3 py-2 tabular-nums">€{r.avgRevenue.toFixed(0)}</td>
                <td className={`text-right px-3 py-2 tabular-nums font-semibold ${r.paybackMonths > 3 ? "text-rose-700" : r.paybackMonths > 1.5 ? "text-amber-700" : "text-emerald-700"}`}>
                  {r.paybackMonths > 0 ? `${r.paybackMonths.toFixed(1)} mesi` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">Margine usato: {marginePct}% · Payback &gt;3 mesi = rosso (canale lento)</p>
    </div>
  );
}
