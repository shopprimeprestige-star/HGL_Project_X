import { X, Check } from "lucide-react";

const ROWS = [
  { label: "Frontale", std: "Netto e percepibile", bio: "Effetto cute viva" },
  { label: "Resistenza", std: "Fragile 0.03mm", bio: "Tensione HD Reticolata" },
  { label: "Riflesso", std: "Lucido sintetico", bio: "Assorbimento pelle reale" },
  { label: "Tecnologia", std: "Lace/TPU con nodi", bio: "Membrana continua No-Lace" },
];

const STD_LABEL = "Patch cutanea";

export function ComparisonTable() {
  return (
    <>
      {/* Desktop only (lg+) — classic 3-column table */}
      <div className="hidden lg:block relative border border-white/15 rounded-md overflow-hidden bg-navy/40 shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--brand)_40%,transparent)]">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
        <div className="grid grid-cols-3 text-[0.65rem] tracking-widest uppercase">
          <div className="px-4 py-3 border-b border-white/15" />
          <div className="px-4 py-3 border-b border-l border-white/15 bg-destructive/15 text-destructive font-bold">
            ✕ {STD_LABEL}
          </div>
          <div className="shine shine-soft px-4 py-3 border-b border-l border-white/15 text-brand-foreground font-bold bg-brand">
            ✓ Bio-mimetic
          </div>
        </div>
        {ROWS.map(({ label, std, bio }, idx) => (
          <div
            key={label}
            className="grid grid-cols-3 text-sm border-t border-white/15 first:border-t-0 transition-colors hover:bg-white/[0.015]"
          >
            <div className="px-4 py-4 font-bold tracking-wider text-xs uppercase text-white/85 bg-white/[0.02] flex items-center gap-2">
              <span className="text-brand/70 text-[0.6rem] tracking-[0.25em]">{String(idx + 1).padStart(2, "0")}</span>
              <span className="h-3 w-px bg-brand/40" />
              <span>{label}</span>
            </div>
            <div className="px-4 py-4 border-l border-white/15 text-white/65 flex items-start gap-2 bg-destructive/5">
              <X className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" strokeWidth={2.5} />
              <span>{std}</span>
            </div>
            <div
              className="shine shine-soft px-4 py-4 border-l border-white/15 text-white font-semibold flex items-start gap-2 bg-brand/15 border-l-2 border-l-brand"
            >
              <Check className="h-3.5 w-3.5 mt-0.5 text-brand shrink-0" strokeWidth={2.5} />
              <span>{bio}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile + Tablet stacked layout — labels are visually dominant */}
      <div className="lg:hidden border border-white/15 rounded-sm overflow-hidden bg-navy/40">
        {ROWS.map(({ label, std, bio }, i) => (
          <div
            key={label}
            className={`${i > 0 ? "border-t border-white/15" : ""}`}
          >
            {/* Prominent label header bar */}
            <div className="bg-brand/15 border-l-4 border-brand px-4 py-3.5 flex items-center gap-2">
              <span className="text-brand text-[0.6rem] tracking-[0.25em] uppercase font-bold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="h-3 w-px bg-brand/50" />
              <span className="text-white text-base font-extrabold tracking-wide uppercase">
                {label}
              </span>
            </div>
            <div className="grid grid-cols-2">
              <div className="px-4 py-4 bg-destructive/10 border-l-4 border-destructive">
                <div className="flex items-center gap-2 text-[0.65rem] tracking-widest uppercase text-destructive font-bold">
                  <X className="h-3 w-3" strokeWidth={2.5} />
                  <span>{STD_LABEL}</span>
                </div>
                <div className="mt-2 text-sm text-white/65">{std}</div>
              </div>
              <div
                className="shine shine-soft px-4 py-4 border-l border-white/15 bg-brand/20 border-l-4 border-l-brand"
              >
                <div className="flex items-center gap-2 text-[0.65rem] tracking-widest uppercase text-brand font-bold">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                  <span>Bio-mimetic</span>
                </div>
                <div className="mt-2 text-sm text-white font-semibold">
                  {bio}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
