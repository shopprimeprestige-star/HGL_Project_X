import { useMemo } from "react";
import { channelAssistScore, CHANNEL_LABEL, type JourneyLead, type Channel } from "./journey-utils";

export function ChannelAssistScore({
  leads,
  spendByChannel,
}: {
  leads: JourneyLead[];
  spendByChannel: Record<Channel, number>;
}) {
  const scores = useMemo(() => channelAssistScore(leads, spendByChannel), [leads, spendByChannel]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Channel Assist Score</h3>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Canale</th>
              <th className="text-right px-3 py-2 font-medium" title="Conversioni dove canale = last touch">Direct</th>
              <th className="text-right px-3 py-2 font-medium" title="Apparizioni come touch intermedio in journey convertiti">Assisted</th>
              <th className="text-right px-3 py-2 font-medium">Assist Ratio</th>
              <th className="text-right px-3 py-2 font-medium">Spend</th>
              <th className="text-right px-3 py-2 font-medium" title="Revenue dove canale è first OR last (split 50/50)">True ROAS</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => {
              const role = s.assistRatio >= 0.6 ? "Apre" : s.assistRatio <= 0.3 ? "Chiude" : "Misto";
              return (
                <tr key={s.channel} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-3 py-2 font-medium">
                    {CHANNEL_LABEL[s.channel]}
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">{role}</span>
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums">{s.direct}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{s.assisted}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{(s.assistRatio * 100).toFixed(0)}%</td>
                  <td className="text-right px-3 py-2 tabular-nums">€{s.spend.toFixed(0)}</td>
                  <td className={`text-right px-3 py-2 tabular-nums font-semibold ${s.trueRoas >= 3 ? "text-emerald-700" : s.trueRoas >= 1 ? "text-amber-700" : "text-rose-700"}`}>
                    {s.trueRoas > 0 ? `${s.trueRoas.toFixed(2)}x` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        "Apre" = canale che inizia il journey (assist ratio &gt;60%). "Chiude" = canale che converte (assist ratio &lt;30%).
      </p>
    </div>
  );
}
