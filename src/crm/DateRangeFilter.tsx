// Filtro date riusabile: preset (Oggi/Ieri/L'altro ieri/7g/30g/90g) + range custom.
// Se l'utente sceglie SOLO la data "Da" senza la data "A", viene trattata come singolo giorno.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Pannello, Pillola } from "@/crm/ui/Finestra";
import { CalendarIcon, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkline } from "@/crm/ads-manager/Sparkline";
import { cn } from "@/lib/utils";

/** Soglia volume minimo lead per considerare un delta statisticamente significativo. */
export const LOW_VOLUME_THRESHOLD = 10;

export interface DateRange {
  from: string | null; // "YYYY-MM-DD"
  to: string | null;
}

const ISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const todayISO = () => ISO(new Date());
const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return ISO(d);
};
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ISO(d);
};

const PRESETS: { key: string; label: string; build: () => DateRange }[] = [
  { key: "today", label: "Oggi", build: () => ({ from: todayISO(), to: todayISO() }) },
  { key: "yesterday", label: "Ieri", build: () => ({ from: yesterdayISO(), to: yesterdayISO() }) },
  // Confronti rapidi: setta il periodo "corrente" — il pannello di confronto (TodayKpiPanel/WoWPanel) calcola il delta vs periodo precedente equivalente.
  { key: "today_vs_yesterday", label: "Oggi vs Ieri", build: () => ({ from: todayISO(), to: todayISO() }) },
  { key: "3", label: "3g", build: () => ({ from: daysAgoISO(2), to: todayISO() }) },
  { key: "7", label: "7g", build: () => ({ from: daysAgoISO(6), to: todayISO() }) },
  { key: "7v7", label: "7gg vs 7gg prec.", build: () => ({ from: daysAgoISO(6), to: todayISO() }) },
  { key: "15", label: "15g", build: () => ({ from: daysAgoISO(14), to: todayISO() }) },
  { key: "30", label: "30g", build: () => ({ from: daysAgoISO(29), to: todayISO() }) },
  { key: "90", label: "90g", build: () => ({ from: daysAgoISO(89), to: todayISO() }) },
  { key: "180", label: "180g", build: () => ({ from: daysAgoISO(179), to: todayISO() }) },
  // Lifetime: ~24 mesi indietro (Meta limita ~37 mesi, ma 730g è già più che lifetime per la maggior parte degli account)
  { key: "lifetime", label: "Lifetime", build: () => ({ from: daysAgoISO(730), to: todayISO() }) },
];

function fmtDisplay(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

interface SinglePickerProps {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  side: "from" | "to";
}

function SingleDatePicker({ value, onChange, placeholder, side }: SinglePickerProps) {
  const [open, setOpen] = useState(false);
  const dateValue = value ? new Date(value + "T00:00:00") : undefined;

  const setQuick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start text-left font-normal min-w-[110px]",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-3 w-3 mr-1" />
          {value ? fmtDisplay(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <Pannello
        align="start"
        className="pointer-events-auto w-auto"
        titolo={side === "from" ? "Scegli la data di inizio" : "Scegli la data di fine"}
        azioni={
          value ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <X className="h-3 w-3" /> Rimuovi
            </Button>
          ) : undefined
        }
        senzaPadding
      >
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 px-3 py-2">
          <Pillola onClick={() => setQuick(todayISO())}>Oggi</Pillola>
          <Pillola onClick={() => setQuick(yesterdayISO())}>Ieri</Pillola>
          <Pillola onClick={() => setQuick(daysAgoISO(2))}>L&apos;altro ieri</Pillola>
        </div>
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(d) => {
            if (d) {
              setQuick(ISO(d));
            }
          }}
          initialFocus
          className={cn("pointer-events-auto p-3")}
          defaultMonth={dateValue}
          // Disabilita date future per "from" non ha senso → permetti tutto, è un filtro
          disabled={side === "to" && value === null ? undefined : undefined}
        />
      </Pannello>
    </Popover>
  );
}

/** Aggregati assoluti (per tooltip), opzionali. */
export interface PresetDeltaAbs {
  current?: { spend?: number; lead?: number; cpl?: number; roas?: number; cvr?: number; revenue?: number; sessions?: number; conversions?: number };
  previous?: { spend?: number; lead?: number; cpl?: number; roas?: number; cvr?: number; revenue?: number; sessions?: number; conversions?: number };
  /** Etichetta opzionale per descrivere il periodo precedente (es. "7gg precedenti"). */
  prevLabel?: string;
  /** Trend giornaliero per metrica del periodo corrente (per sparkline). */
  trends?: { spend?: number[]; lead?: number[]; cpl?: number[]; roas?: number[]; cvr?: number[] };
  /** Volume lead del periodo corrente — se < LOW_VOLUME_THRESHOLD, i delta sono mostrati come "rumore". */
  volume?: number;
}

/** Delta % rispetto al periodo precedente equivalente, da mostrare sotto un preset attivo. */
export interface PresetDelta extends PresetDeltaAbs {
  spend?: number | null;
  lead?: number | null;
  cpl?: number | null;
  roas?: number | null;
  cvr?: number | null;
}

export interface DateRangeFilterProps {
  value: DateRange;
  onChange: (v: DateRange) => void;
  showPresets?: boolean;
  fromLabel?: string;
  toLabel?: string;
  /** Mappa preset_key → delta % vs periodo precedente. Se presente, viene mostrato un mini-badge sotto il preset attivo.
   *  Esempi di key: "today_vs_yesterday", "7v7". */
  presetDeltas?: Partial<Record<string, PresetDelta>>;
}

function fmtAbsByMetric(metric: string, v: number | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (metric === "spend" || metric === "cpl") return `€${v.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
  if (metric === "roas") return `${v.toFixed(2)}×`;
  if (metric === "cvr") return `${v.toFixed(1)}%`;
  return v.toLocaleString("it-IT", { maximumFractionDigits: 0 });
}

/** Mini badge inline: mostra delta % colorato per metrica. lowerIsBetter inverte il colore (CPL).
 *  - Se lowVolume=true (lead < soglia), mostra in grigio "rumore" indipendentemente dal segno.
 *  - Se trend è fornito, accoda una mini-sparkline. */
function DeltaChip({
  label,
  metric,
  value,
  lowerIsBetter,
  current,
  previous,
  prevLabel,
  trend,
  lowVolume,
}: {
  label: string;
  metric: string;
  value: number | null | undefined;
  lowerIsBetter?: boolean;
  current?: number;
  previous?: number;
  prevLabel?: string;
  trend?: number[];
  lowVolume?: boolean;
}) {
  const hasAbs = current != null || previous != null;
  const isMissing = value == null || !isFinite(value);
  const positive = !isMissing && (lowerIsBetter ? (value as number) < 0 : (value as number) > 0);
  const negative = !isMissing && (lowerIsBetter ? (value as number) > 0 : (value as number) < 0);
  const cls = lowVolume
    ? "bg-muted/60 text-muted-foreground border-border"
    : isMissing
      ? "bg-muted/50 text-muted-foreground border-border"
      : positive
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : negative
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-muted text-muted-foreground border-border";
  const sign = !isMissing && (value as number) > 0 ? "+" : "";
  const sparkColor = lowVolume
    ? "oklch(0.65 0.01 250)"
    : positive ? "oklch(0.62 0.16 145)" : negative ? "oklch(0.6 0.2 22)" : "oklch(0.6 0.01 250)";
  const chip = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10.5px] font-medium tabular-nums",
        cls,
        (hasAbs || lowVolume) && "cursor-help",
      )}
    >
      <span className="opacity-70">{label}</span>
      <span>{isMissing ? "—" : `${sign}${(value as number).toFixed(0)}%`}</span>
      {trend && trend.length >= 2 && (
        <span className="ml-0.5 -my-0.5"><Sparkline values={trend} width={32} height={12} color={sparkColor} area /></span>
      )}
    </span>
  );
  if (!hasAbs && !lowVolume) return chip;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px] p-2 max-w-[240px]">
          <div className="font-semibold mb-1 capitalize">{label}</div>
          {hasAbs && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-muted-foreground">Periodo corrente</span>
              <span className="text-right tabular-nums font-medium">{fmtAbsByMetric(metric, current)}</span>
              <span className="text-muted-foreground">{prevLabel || "Periodo prec."}</span>
              <span className="text-right tabular-nums font-medium">{fmtAbsByMetric(metric, previous)}</span>
            </div>
          )}
          {lowVolume && (
            <div className="mt-1.5 pt-1.5 border-t border-border text-amber-700 leading-tight">
              ⚠ Volume basso ({"<"} {LOW_VOLUME_THRESHOLD} lead): variazione poco significativa, leggi come rumore.
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DateRangeFilter({
  value,
  onChange,
  showPresets = true,
  fromLabel = "Da",
  toLabel = "A",
  presetDeltas,
}: DateRangeFilterProps) {
  // Memorizza l'ultimo preset cliccato per disambiguare quando due preset producono lo stesso range
  // (es. "Oggi" e "Oggi vs Ieri" → entrambi today→today).
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);
  const activePresetKey = (() => {
    if (lastClickedKey) {
      const p = PRESETS.find((x) => x.key === lastClickedKey);
      if (p) {
        const r = p.build();
        if (r.from === value.from && r.to === value.to) return lastClickedKey;
      }
    }
    for (const p of PRESETS) {
      const r = p.build();
      if (r.from === value.from && r.to === value.to) return p.key;
    }
    return null;
  })();

  const activeDelta = activePresetKey ? presetDeltas?.[activePresetKey] : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {showPresets &&
          PRESETS.map((p) => {
            const active = activePresetKey === p.key;
            return (
              <Button
                key={p.key}
                size="sm"
                variant="outline"
                onClick={() => {
                  setLastClickedKey(p.key);
                  onChange(p.build());
                }}
                className={cn(
                  "h-7 px-2.5 text-[11.5px] font-medium border",
                  active
                    ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
                    : "bg-card text-foreground border-border hover:bg-muted hover:text-foreground",
                )}
              >
                {p.label}
              </Button>
            );
          })}
        <SingleDatePicker
          value={value.from}
          onChange={(v) => onChange({ from: v, to: value.to })}
          placeholder={fromLabel}
          side="from"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <SingleDatePicker
          value={value.to}
          onChange={(v) => onChange({ from: value.from, to: v })}
          placeholder={toLabel}
          side="to"
        />
        {(value.from || value.to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ from: null, to: null })}
            aria-label="Pulisci"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {activeDelta && (() => {
        const lowVolume = (activeDelta.volume ?? activeDelta.current?.lead ?? Infinity) < LOW_VOLUME_THRESHOLD;
        const t = activeDelta.trends;
        return (
          <div className="flex flex-wrap items-center gap-1.5 pl-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              vs periodo prec.
            </span>
            <DeltaChip label="spesa" metric="spend" value={activeDelta.spend} current={activeDelta.current?.spend} previous={activeDelta.previous?.spend} prevLabel={activeDelta.prevLabel} trend={t?.spend} lowVolume={lowVolume} />
            <DeltaChip label="lead" metric="lead" value={activeDelta.lead} current={activeDelta.current?.lead} previous={activeDelta.previous?.lead} prevLabel={activeDelta.prevLabel} trend={t?.lead} lowVolume={lowVolume} />
            <DeltaChip label="CPL" metric="cpl" value={activeDelta.cpl} lowerIsBetter current={activeDelta.current?.cpl} previous={activeDelta.previous?.cpl} prevLabel={activeDelta.prevLabel} trend={t?.cpl} lowVolume={lowVolume} />
            <DeltaChip label="ROAS" metric="roas" value={activeDelta.roas} current={activeDelta.current?.roas} previous={activeDelta.previous?.roas} prevLabel={activeDelta.prevLabel} trend={t?.roas} lowVolume={lowVolume} />
            {activeDelta.cvr != null && <DeltaChip label="CVR" metric="cvr" value={activeDelta.cvr} current={activeDelta.current?.cvr} previous={activeDelta.previous?.cvr} prevLabel={activeDelta.prevLabel} trend={t?.cvr} lowVolume={lowVolume} />}
          </div>
        );
      })()}
    </div>
  );
}

// Helpers per filtrare per il range — gestiscono il caso "solo Da" come singolo giorno
export function rangeMatch(dateISO: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!dateISO) return false;
  const d = dateISO.slice(0, 10);
  // Solo "from" senza "to" → singolo giorno = from
  if (range.from && !range.to) return d === range.from;
  // Solo "to" senza "from" → tutto fino a quel giorno
  if (!range.from && range.to) return d <= range.to;
  // Entrambi
  return d >= (range.from as string) && d <= (range.to as string);
}

export function rangeBoundsAsDates(range: DateRange): { since: Date; until: Date } | null {
  if (!range.from && !range.to) return null;
  const fromISO = range.from || range.to!;
  const toISO = range.to || range.from!;
  const since = new Date(fromISO + "T00:00:00");
  const until = new Date(toISO + "T00:00:00");
  until.setDate(until.getDate() + 1); // esclusivo
  return { since, until };
}
