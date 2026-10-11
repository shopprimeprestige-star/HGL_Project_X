// Vista dedicata "Retargeting & Attribution" — sostituisce le tab.
// Combina filtri (range/journey/touch-channel) + KPI strip + Assist Matrix
// + Top Paths + Channel Assist Score + Breakdown per piattaforma di conversione.
import { useMemo, useState } from "react";
import type { Lead, AdSpending } from "@/crm/types";
import { leadIsConverted, leadRevenue, leadAttributionDate } from "@/crm/lead-analytics";
import { detectChannel } from "@/crm/kpi/cvr-generale-utils";
import { DateRangeFilter, rangeBoundsAsDates, type DateRange } from "@/crm/DateRangeFilter";
import { JourneyKpiStrip } from "./journey/JourneyKpiStrip";
import { AssistMatrix } from "./journey/AssistMatrix";
import { TopPathsTable } from "./journey/TopPathsTable";
import { ChannelAssistScore } from "./journey/ChannelAssistScore";
import { TimeToConvertChart } from "./journey/TimeToConvertChart";
import { SegmentByChannelTable } from "./journey/SegmentByChannelTable";
import { AttributionModelSwitcher } from "./bi/AttributionModelSwitcher";
import {
  extractTouches,
  classifyJourney,
  computeTimeToConvert,
  CHANNELS,
  CHANNEL_LABEL,
  type JourneyLead,
  type Channel,
  type JourneyType,
} from "./journey/journey-utils";

interface Props {
  allLeads: Lead[];
  adSpending: AdSpending[];
  metaSpend: number;
  tiktokSpend: number;
}

type JourneyFilter = "all" | "retarget" | "cold";

function leadToJourney(l: Lead): JourneyLead {
  const data = l.data as unknown as Record<string, unknown> & { tracking?: Record<string, unknown> };
  const touchesRaw = (data.tracking?.touch_history as unknown) || (data as Record<string, unknown>).touch_history;
  let touches = extractTouches(touchesRaw);
  if (touches.length === 0) {
    const t = data.tracking;
    if (t) {
      const ts = l.data.createdAt ? new Date(l.data.createdAt).getTime() : Date.now();
      const detected = detectChannel({
        utm_source: (t.utm_source as string) ?? null,
        fbclid: (t.fbclid as string) ?? null,
        ttclid: (t.ttclid as string) ?? null,
      });
      const ch: Channel = detected === "meta" || detected === "tiktok" ? detected : detected === "organic" ? "organic" : "direct";
      touches = [{ ch, ts, utm_source: t.utm_source as string | undefined, utm_campaign: t.utm_campaign as string | undefined }];
    }
  }
  const sorted = [...touches].sort((a, b) => a.ts - b.ts);
  const firstChannel = sorted[0]?.ch || null;
  const lastChannel = sorted[sorted.length - 1]?.ch || null;
  const journeyType = classifyJourney(sorted);
  const converted = leadIsConverted(l);
  const revenue = leadRevenue(l);
  const createdAt = l.data.createdAt ? new Date(l.data.createdAt) : new Date();
  const convertedRaw = leadAttributionDate(l);
  const convertedAt = converted ? convertedRaw || createdAt : null;
  const ttc = convertedAt ? computeTimeToConvert(sorted, convertedAt.getTime()) : { days: 0, hours: 0 };
  const qualifica = (l.data.qualifica || {}) as { disagio?: number; urgenza?: string };
  return {
    id: l.id,
    touches: sorted,
    firstChannel,
    lastChannel,
    journeyType,
    daysToConvert: convertedAt ? ttc.days : null,
    hoursToConvert: convertedAt ? ttc.hours : null,
    converted,
    revenue,
    createdAt,
    convertedAt,
    disagioScore: typeof qualifica.disagio === "number" ? qualifica.disagio : null,
    urgenza: qualifica.urgenza ?? null,
    portatore: null, // non presente su Lead.data; popolato solo in PublicLead
  };
}

const RETARGET_TYPES: JourneyType[] = ["retarget_same", "retarget_cross", "retarget_multi"];

export function RetargetingAttributionView({ allLeads, adSpending, metaSpend, tiktokSpend }: Props) {
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  const [journeyFilter, setJourneyFilter] = useState<JourneyFilter>("all");
  const [touchChannel, setTouchChannel] = useState<Channel | "all">("all");

  // Filtra per range + filtri specifici
  const filteredLeads = useMemo(() => {
    const b = rangeBoundsAsDates(range);
    return allLeads.filter((l) => {
      if (b) {
        const d = leadAttributionDate(l);
        if (!d || d < b.since || d >= b.until) return false;
      }
      return true;
    });
  }, [allLeads, range]);

  const journeyLeads = useMemo(() => filteredLeads.map(leadToJourney), [filteredLeads]);

  const journeyFiltered = useMemo(() => {
    return journeyLeads.filter((jl) => {
      if (journeyFilter === "retarget" && (!jl.journeyType || !RETARGET_TYPES.includes(jl.journeyType))) return false;
      if (journeyFilter === "cold" && jl.journeyType && RETARGET_TYPES.includes(jl.journeyType)) return false;
      if (touchChannel !== "all" && !jl.touches.some((t) => t.ch === touchChannel)) return false;
      return true;
    });
  }, [journeyLeads, journeyFilter, touchChannel]);

  // Spend per canale stimato (Meta+TikTok live; altri canali = 0 o ad_spending generico)
  const spendByChannel = useMemo<Record<Channel, number>>(() => {
    const adSum = adSpending.reduce((s, a) => s + (a.data.importoSpeso || 0), 0);
    return {
      meta: metaSpend,
      tiktok: tiktokSpend,
      google: 0,
      email: 0,
      direct: 0,
      organic: adSum,
    };
  }, [adSpending, metaSpend, tiktokSpend]);

  // Breakdown per piattaforma di CONVERSIONE (last_channel) — il cuore della richiesta utente
  const conversionByPlatform = useMemo(() => {
    const out: Record<Channel, { leads: number; conv: number; revenue: number; retargetConv: number; coldConv: number; avgTouches: number; avgDays: number }> = {} as Record<Channel, { leads: number; conv: number; revenue: number; retargetConv: number; coldConv: number; avgTouches: number; avgDays: number }>;
    CHANNELS.forEach((c) => {
      out[c] = { leads: 0, conv: 0, revenue: 0, retargetConv: 0, coldConv: 0, avgTouches: 0, avgDays: 0 };
    });
    const tally: Record<Channel, { touchSum: number; daysSum: number; nConv: number }> = {} as Record<Channel, { touchSum: number; daysSum: number; nConv: number }>;
    CHANNELS.forEach((c) => (tally[c] = { touchSum: 0, daysSum: 0, nConv: 0 }));

    journeyFiltered.forEach((jl) => {
      const last = jl.lastChannel || "direct";
      out[last].leads++;
      if (jl.converted) {
        out[last].conv++;
        out[last].revenue += jl.revenue;
        const isRetarget = jl.journeyType ? RETARGET_TYPES.includes(jl.journeyType) : false;
        if (isRetarget) out[last].retargetConv++;
        else out[last].coldConv++;
        tally[last].touchSum += jl.touches.length;
        tally[last].daysSum += jl.daysToConvert ?? 0;
        tally[last].nConv++;
      }
    });
    CHANNELS.forEach((c) => {
      out[c].avgTouches = tally[c].nConv > 0 ? tally[c].touchSum / tally[c].nConv : 0;
      out[c].avgDays = tally[c].nConv > 0 ? tally[c].daysSum / tally[c].nConv : 0;
    });
    return out;
  }, [journeyFiltered]);

  return (
    <div className="space-y-4">
      {/* Riga filtri */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <DateRangeFilter value={range} onChange={setRange} />

        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Tipo:</span>
          {(["all", "retarget", "cold"] as JourneyFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setJourneyFilter(f)}
              className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
                journeyFilter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              {f === "all" ? "Tutti" : f === "retarget" ? "Solo retargeting" : "Solo cold"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Touch su:</span>
          <select
            value={touchChannel}
            onChange={(e) => setTouchChannel(e.target.value as Channel | "all")}
            className="text-[12px] px-2 py-1 rounded border border-border bg-background"
          >
            <option value="all">Tutti i canali</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-[11px] text-muted-foreground">
          {journeyFiltered.length} lead nel filtro
        </div>
      </div>

      {/* KPI Strip */}
      <JourneyKpiStrip leads={journeyFiltered} />

      {/* Breakdown per piattaforma di CONVERSIONE */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Breakdown per Piattaforma di Conversione (last touch)</h3>
        <p className="text-[11px] text-muted-foreground">
          Mostra dove ogni canale chiude le vendite e quante sono retargeting vs cold.
          Risponde a: "Su Meta, quante vendite arrivano da retargeting puro?"
        </p>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Piattaforma chiusura</th>
                <th className="text-right px-3 py-2 font-medium">Lead</th>
                <th className="text-right px-3 py-2 font-medium">Vendite</th>
                <th className="text-right px-3 py-2 font-medium">Da Retargeting</th>
                <th className="text-right px-3 py-2 font-medium">Da Cold</th>
                <th className="text-right px-3 py-2 font-medium">Revenue</th>
                <th className="text-right px-3 py-2 font-medium">Avg Touch</th>
                <th className="text-right px-3 py-2 font-medium">Avg Days</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.filter((c) => conversionByPlatform[c].leads > 0).map((c) => {
                const r = conversionByPlatform[c];
                const retargetPct = r.conv > 0 ? (r.retargetConv / r.conv) * 100 : 0;
                return (
                  <tr key={c} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{CHANNEL_LABEL[c]}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{r.leads}</td>
                    <td className="text-right px-3 py-2 tabular-nums font-semibold">{r.conv}</td>
                    <td className="text-right px-3 py-2 tabular-nums">
                      <span className="text-emerald-700 font-semibold">{r.retargetConv}</span>
                      <span className="text-muted-foreground ml-1">({retargetPct.toFixed(0)}%)</span>
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-muted-foreground">{r.coldConv}</td>
                    <td className="text-right px-3 py-2 tabular-nums">€{r.revenue.toFixed(0)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{r.avgTouches.toFixed(1)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{r.avgDays.toFixed(1)}gg</td>
                  </tr>
                );
              })}
              {CHANNELS.every((c) => conversionByPlatform[c].leads === 0) && (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted-foreground">
                    Nessun dato per i filtri correnti.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assist Matrix */}
      <AssistMatrix leads={journeyFiltered} />

      {/* Top Paths */}
      <TopPathsTable leads={journeyFiltered} spendByChannel={spendByChannel} />

      {/* Channel Assist Score */}
      <ChannelAssistScore leads={journeyFiltered} spendByChannel={spendByChannel} />

      {/* Time to Convert */}
      <TimeToConvertChart leads={journeyFiltered} totalSpend={metaSpend + tiktokSpend} />

      {/* === Segmenti qualifica con attribution corretta (last_channel reale) === */}
      <SegmentByChannelTable
        title="Lead Pain Score per fascia × Piattaforma di chiusura"
        subtitle="A che livello di dolore convertono di più — split per piattaforma di conversione (last touch reale, non utm ingenuo)."
        leads={journeyFiltered}
        channels={CHANNELS.filter((c) => journeyFiltered.some((l) => l.lastChannel === c))}
        spendByChannel={spendByChannel}
        buckets={[
          { key: "alto", label: "Dolore alto (7-10)", predicate: (l) => (l.disagioScore ?? -1) >= 7 },
          { key: "medio", label: "Dolore medio (4-6)", predicate: (l) => (l.disagioScore ?? -1) >= 4 && (l.disagioScore ?? -1) < 7 },
          { key: "basso", label: "Dolore basso (0-3)", predicate: (l) => (l.disagioScore ?? -1) >= 0 && (l.disagioScore ?? -1) < 4 },
          { key: "ignoto", label: "Non dichiarato", predicate: (l) => l.disagioScore == null },
        ]}
      />

      <SegmentByChannelTable
        title="Urgenza × Piattaforma di chiusura"
        subtitle="Le risposte 'subito'/'entro 1 mese' tipicamente convertono meglio. Vediamo se questo regge per ogni canale."
        leads={journeyFiltered}
        channels={CHANNELS.filter((c) => journeyFiltered.some((l) => l.lastChannel === c))}
        spendByChannel={spendByChannel}
        buckets={[
          { key: "subito", label: "Subito, voglio risolvere", predicate: (l) => l.urgenza === "subito" || l.urgenza === "si" },
          { key: "1mese", label: "Entro 1 mese", predicate: (l) => l.urgenza === "1mese" },
          { key: "2_3mesi", label: "Entro 2-3 mesi", predicate: (l) => l.urgenza === "2_3mesi" },
          { key: "valuto", label: "Sto valutando", predicate: (l) => l.urgenza === "valuto" || l.urgenza === "valutando" },
          { key: "convince", label: "Se mi convince", predicate: (l) => l.urgenza === "convince" },
          { key: "missing", label: "Non risposto", predicate: (l) => !l.urgenza },
        ]}
      />

      <SegmentByChannelTable
        title="Portatore vs Non portatore × Piattaforma di chiusura"
        subtitle="Stato portatore di impianto. Nota: il dato è popolato solo per lead che arrivano dal funnel pubblico più recente; lead manuali sono in 'Non dichiarato'."
        leads={journeyFiltered}
        channels={CHANNELS.filter((c) => journeyFiltered.some((l) => l.lastChannel === c))}
        spendByChannel={spendByChannel}
        buckets={[
          { key: "yes", label: "Già portatore", predicate: (l) => l.portatore === true },
          { key: "no", label: "Non portatore", predicate: (l) => l.portatore === false },
          { key: "null", label: "Non dichiarato", predicate: (l) => l.portatore == null },
        ]}
      />

      {/* Attribution Model Switcher */}
      <AttributionModelSwitcher leads={journeyFiltered} />
    </div>
  );
}
