import { useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Calendar grid replicating the PDF (April-style layout, 17 selected as "today")
// Available days: 14, 15, 16, 17, 19, 26, weekend slots etc.
const AVAILABLE = new Set<number>([14, 15, 16, 17, 19, 26]);
const VISIBLE = new Set<number>([
  // shown weeks
  // first row: prev month grayed
  // we encode all numerically; rendering uses the matrix below
]);

// Week matrix (rows of 7) — numbers, with `null` for hidden cells
type Cell = { n: number; current: boolean } | null;
const MATRIX: Cell[][] = [
  [
    { n: 29, current: false },
    { n: 30, current: false },
    { n: 31, current: false },
    { n: 1, current: true },
    { n: 2, current: true },
    { n: 3, current: true },
    { n: 4, current: true },
  ],
  [
    { n: 5, current: true },
    { n: 6, current: true },
    { n: 7, current: true },
    { n: 8, current: true },
    { n: 9, current: true },
    { n: 10, current: true },
    { n: 11, current: true },
  ],
  [
    { n: 12, current: true },
    { n: 13, current: true },
    { n: 14, current: true },
    { n: 15, current: true },
    { n: 16, current: true },
    { n: 17, current: true },
    null,
  ],
  [null, null, { n: 19, current: true }, null, null, null, null],
  [
    { n: 26, current: true },
    null,
    null,
    null,
    null,
    { n: 1, current: false },
    { n: 2, current: false },
  ],
];

interface Props {
  variant?: "light" | "dark";
}

export function BookingCalendar({ variant = "light" }: Props) {
  const [selected, setSelected] = useState<number | null>(17);

  const isLight = variant === "light";
  const wrapper = isLight
    ? "bg-white text-ink"
    : "bg-navy-light/40 text-foreground border border-white/10";
  const labelEyebrow = isLight ? "text-brand" : "text-brand";
  const stepText = isLight ? "text-brand" : "text-brand";
  const headerWeek = isLight ? "text-ink-muted" : "text-white/60";
  const dayMuted = isLight ? "text-ink-muted/50" : "text-white/30";
  const dayCurrent = isLight ? "text-ink/80" : "text-white/85";

  return (
    <div className={`rounded-sm shadow-sm w-full ${wrapper}`}>
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-current/10">
        <span
          className={`text-[0.7rem] tracking-[0.22em] uppercase font-semibold ${labelEyebrow}`}
        >
          Scegli una data
        </span>
        <span
          className={`text-[0.7rem] tracking-[0.22em] uppercase font-semibold ${stepText}`}
        >
          Step 1 / 3
        </span>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-7 gap-y-2 mb-2">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className={`text-center text-xs font-medium ${headerWeek}`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-2">
          {MATRIX.flat().map((cell, i) => {
            if (!cell) return <div key={i} />;
            const available = cell.current && AVAILABLE.has(cell.n);
            const isSelected = selected === cell.n && available;
            const base =
              "mx-auto flex items-center justify-center w-9 h-9 text-sm rounded-sm transition-colors";
            if (isSelected) {
              return (
                <button
                  key={i}
                  className={`${base} bg-brand text-brand-foreground font-semibold`}
                  onClick={() => setSelected(cell.n)}
                >
                  {cell.n}
                </button>
              );
            }
            if (available) {
              return (
                <button
                  key={i}
                  onClick={() => setSelected(cell.n)}
                  className={`${base} hover:bg-brand/10 ${dayCurrent} font-medium`}
                >
                  {cell.n}
                </button>
              );
            }
            return (
              <div
                key={i}
                className={`${base} ${
                  cell.current ? dayCurrent + " opacity-60" : dayMuted
                }`}
              >
                {cell.n}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-5 px-6 pt-3 pb-5 border-t border-current/10">
        <span className="flex items-center gap-2 text-[0.65rem] tracking-widest uppercase">
          <span className="w-3 h-3 bg-brand inline-block rounded-[2px]" />
          <span className={isLight ? "text-ink-muted" : "text-white/60"}>
            Disponibile
          </span>
        </span>
        <span className="flex items-center gap-2 text-[0.65rem] tracking-widest uppercase">
          <span
            className={`w-3 h-3 inline-block rounded-[2px] ${
              isLight ? "bg-ink/15" : "bg-white/15"
            }`}
          />
          <span className={isLight ? "text-ink-muted" : "text-white/60"}>
            Non disponibile
          </span>
        </span>
      </div>
    </div>
  );
}
