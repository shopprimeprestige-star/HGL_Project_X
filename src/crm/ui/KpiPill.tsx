/** KpiPill — pillola KPI compatta riusabile in tutto il CRM.
 *  Usata in Ads Manager (header sticky), Pipeline, Agenda, Installazioni
 *  per garantire palette + dimensioni coerenti.
 *
 *  Tone:
 *   - good   = verde (KPI positivo: ROAS alto, lead acquisiti, ecc.)
 *   - bad    = rosso (KPI critico: perdita, no show, lead persi)
 *   - warn   = ambra (KPI attenzione: borderline)
 *   - info   = blu  (KPI informativo: lead, prenotazioni)
 *   - neutral= bianco (default)
 */

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type KpiTone = "good" | "bad" | "warn" | "info" | "neutral";

interface Props {
  label: string;
  value: ReactNode;
  tone?: KpiTone;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

const toneClass: Record<KpiTone, string> = {
  good: "bg-emerald-50 border-emerald-200 text-emerald-900",
  bad: "bg-rose-50 border-rose-200 text-rose-900",
  warn: "bg-amber-50 border-amber-200 text-amber-900",
  info: "bg-blue-50 border-blue-200 text-blue-900",
  neutral: "bg-white border-border text-foreground",
};

export function KpiPill({ label, value, tone = "neutral", hint, onClick, active, className }: Props) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      title={hint}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border transition-colors",
        toneClass[tone],
        onClick && "hover:brightness-95 cursor-pointer",
        active && "ring-2 ring-offset-1 ring-foreground/20",
        className,
      )}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-70 font-medium">{label}</span>
      <span className="text-[12px] font-bold tabular-nums">{value}</span>
    </Comp>
  );
}

/** Strip orizzontale di KpiPill, con scroll su mobile e gap consistente. */
export function KpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap rounded-xl border border-border/60 bg-gradient-to-b from-white to-[oklch(0.985_0.003_250)] p-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
