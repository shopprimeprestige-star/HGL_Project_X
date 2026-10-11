import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Verdict } from "./verdict";

/** Badge compatto del verdetto (per tabella). Hover → tooltip con motivo + azione. */
export function VerdictBadge({ verdict, size = "md" }: { verdict: Verdict; size?: "sm" | "md" | "lg" }) {
  const sizeCls = size === "sm"
    ? "text-[10px] px-1.5 py-0.5 gap-0.5"
    : size === "lg"
    ? "text-xs px-2.5 py-1 gap-1.5"
    : "text-[11px] px-2 py-0.5 gap-1";
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap cursor-help ${sizeCls} ${verdict.badgeClass}`}
          >
            <span aria-hidden>{verdict.emoji}</span>
            <span>{verdict.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] p-2.5 space-y-1.5">
          <div className="text-xs font-semibold flex items-center gap-1">
            <span>{verdict.emoji}</span>
            <span>{verdict.label}</span>
          </div>
          <div className="text-[11px] text-muted-foreground leading-snug">
            <span className="font-medium text-foreground">Perché:</span> {verdict.reason}
          </div>
          <div className="text-[11px] leading-snug">
            <span className="font-medium">→ Azione:</span> {verdict.action}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Banner verdetto esteso (motivo + azione visibili) per card gallery. */
export function VerdictPanel({ verdict }: { verdict: Verdict }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${verdict.badgeClass}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold">
        <span>{verdict.emoji}</span>
        <span>{verdict.label.toUpperCase()}</span>
      </div>
      <div className="text-[10.5px] mt-1 opacity-90 leading-snug">{verdict.reason}</div>
      <div className="text-[10.5px] mt-0.5 font-medium leading-snug">→ {verdict.action}</div>
    </div>
  );
}
