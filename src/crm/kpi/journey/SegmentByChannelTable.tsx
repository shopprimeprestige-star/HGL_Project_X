// Tabella generica: per ogni segmento (riga), CVR e CPL split per piattaforma di
// CONVERSIONE (last_channel del journey reale). Attribuzione corretta — non usa
// utm_source ingenuo, ma il last touch del journey multi-touch ricostruito.
// Toggle interno: confronta cold vs retargeting per ogni segmento.
import { useMemo, useState } from "react";
import type { JourneyLead, Channel, JourneyType } from "./journey-utils";
import { CHANNEL_LABEL } from "./journey-utils";

interface Bucket {
  key: string;
  label: string;
  predicate: (jl: JourneyLead) => boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  leads: JourneyLead[];
  buckets: Bucket[];
  channels: Channel[];
  spendByChannel: Record<Channel, number>;
}

type TrafficFilter = "all" | "cold" | "retarget";

const RETARGET_TYPES: JourneyType[] = ["retarget_same", "retarget_cross", "retarget_multi"];

function filterByTraffic(leads: JourneyLead[], f: TrafficFilter): JourneyLead[] {
  if (f === "all") return leads;
  if (f === "retarget") return leads.filter((l) => l.journeyType && RETARGET_TYPES.includes(l.journeyType));
  return leads.filter((l) => !l.journeyType || !RETARGET_TYPES.includes(l.journeyType));
}

export function SegmentByChannelTable({ title, subtitle, leads, buckets, channels, spendByChannel }: Props) {
  const [traffic, setTraffic] = useState<TrafficFilter>("all");

  const filteredLeads = useMemo(() => filterByTraffic(leads, traffic), [leads, traffic]);

  // Per ogni canale conta TOTAL leads (denominatore CPL): leads il cui last_channel = c
  const totalLeadsByChannel: Record<Channel, number> = useMemo(() => {
    const m = {} as Record<Channel, number>;
    channels.forEach((c) => (m[c] = 0));
    filteredLeads.forEach((jl) => {
      const ch = (jl.lastChannel || "direct") as Channel;
      if (channels.includes(ch)) m[ch]++;
    });
    return m;
  }, [filteredLeads, channels]);

  // Spend ridistribuito proporzionalmente alla quota di traffico filtrato sul totale
  const adjustedSpend: Record<Channel, number> = useMemo(() => {
    const totalAll = {} as Record<Channel, number>;
    channels.forEach((c) => (totalAll[c] = 0));
    leads.forEach((jl) => {
      const ch = (jl.lastChannel || "direct") as Channel;
      if (channels.includes(ch)) totalAll[ch]++;
    });
    const out = {} as Record<Channel, number>;
    channels.forEach((c) => {
      const share = totalAll[c] > 0 ? totalLeadsByChannel[c] / totalAll[c] : 0;
      out[c] = (spendByChannel[c] || 0) * share;
    });
    return out;
  }, [leads, filteredLeads, channels, spendByChannel, totalLeadsByChannel]);

  const TRAFFIC_OPTIONS: { v: TrafficFilter; label: string; tone: string }[] = [
    { v: "all", label: "Tutti", tone: "border-border" },
    { v: "retarget", label: "Solo retargeting", tone: "border-emerald-300" },
    { v: "cold", label: "Solo cold", tone: "border-amber-300" },
  ];

  // Delta CVR globale: confronto cold vs retarget sul dataset corrente (tutti i lead)
  const deltaCvr = useMemo(() => {
    const cold = filterByTraffic(leads, "cold");
    const ret = filterByTraffic(leads, "retarget");
    const coldCvr = cold.length > 0 ? (cold.filter((l) => l.converted).length / cold.length) * 100 : 0;
    const retCvr = ret.length > 0 ? (ret.filter((l) => l.converted).length / ret.length) * 100 : 0;
    return {
      coldCvr,
      retCvr,
      diff: retCvr - coldCvr,
      hasBoth: cold.length > 0 && ret.length > 0,
    };
  }, [leads]);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {deltaCvr.hasBoth && (
            <span
              title={`Cold CVR ${deltaCvr.coldCvr.toFixed(1)}% · Retarget CVR ${deltaCvr.retCvr.toFixed(1)}%`}
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                deltaCvr.diff >= 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              retarget {deltaCvr.diff >= 0 ? "+" : ""}
              {deltaCvr.diff.toFixed(1)}pp vs cold
            </span>
          )}
          <div className="flex items-center gap-1">
            {TRAFFIC_OPTIONS.map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setTraffic(o.v)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  traffic === o.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : `${o.tone} bg-card hover:bg-secondary text-foreground`
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-secondary/50">Risposta</th>
              <th className="text-right px-3 py-2 font-medium">Lead tot</th>
              <th className="text-right px-3 py-2 font-medium">Conv tot</th>
              <th className="text-right px-3 py-2 font-medium">CVR %</th>
              {channels.map((c) => (
                <th key={c} className="text-right px-3 py-2 font-medium border-l border-border">
                  {CHANNEL_LABEL[c]}<br />
                  <span className="text-[9px] uppercase tracking-wider opacity-70">L · CVR · CPL</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => {
              const segLeads = filteredLeads.filter(b.predicate);
              const total = segLeads.length;
              const totalConv = segLeads.filter((l) => l.converted).length;
              const cvr = total > 0 ? (totalConv / total) * 100 : 0;
              return (
                <tr key={b.key} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-3 py-2 font-medium sticky left-0 bg-card">{b.label}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{total}</td>
                  <td className="text-right px-3 py-2 tabular-nums font-semibold">{totalConv}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{total > 0 ? `${cvr.toFixed(1)}%` : "—"}</td>
                  {channels.map((c) => {
                    const segByCh = segLeads.filter((l) => (l.lastChannel || "direct") === c);
                    const l = segByCh.length;
                    const conv = segByCh.filter((x) => x.converted).length;
                    const segCvr = l > 0 ? (conv / l) * 100 : 0;
                    const cplDenom = totalLeadsByChannel[c];
                    const cpl = cplDenom > 0 && l > 0 ? (adjustedSpend[c] / cplDenom) : 0;
                    return (
                      <td key={c} className="text-right px-3 py-2 tabular-nums border-l border-border">
                        {l === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span>
                            {l} · <span className={segCvr >= 5 ? "text-emerald-700" : segCvr > 0 ? "text-amber-700" : "text-muted-foreground"}>{segCvr.toFixed(0)}%</span> · €{cpl.toFixed(0)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}