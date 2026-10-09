import { Image as ImageIcon, Film, Sparkles } from "lucide-react";

interface Props {
  label?: string;
  caption?: string;
  variant?: "image" | "video";
  light?: boolean;
  showCheck?: boolean;
  className?: string;
  index?: string;
  /**
   * Mostra il badge "Bio-Mimetic™" in basso a destra (default true).
   * Stesso identico styling della pill che era nell'hero.
   */
  showBioBadge?: boolean;
}

export function PlaceholderBox({
  label = "PLACEHOLDER",
  caption,
  variant = "image",
  light = true,
  showCheck: _showCheck = false,
  className = "",
  index = "4/5",
  showBioBadge = true,
}: Props) {
  void _showCheck;
  const Icon = variant === "video" ? Film : ImageIcon;
  const isVideo = variant === "video";
  return (
    <div
      className={`brackets relative overflow-hidden holo-stripe ${isVideo ? "scanlines" : ""} ${
        light ? "bg-light-grid" : "bg-blueprint-fine"
      } rounded-sm p-10 min-h-[360px] flex flex-col items-center justify-center ${className}`}
    >
      <span className="br-tr" />
      <span className="br-bl" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="ring-holo border border-brand rounded-md p-2 bg-white/5">
          <Icon className="h-5 w-5 text-brand" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <div className="eyebrow text-[0.65rem]">
            {label} · {index}
          </div>
          {caption && (
            <p className="mt-2 text-xs text-ink-muted max-w-xs">{caption}</p>
          )}
        </div>
      </div>

      {showBioBadge && label !== "PRIMA" && !caption?.toLowerCase().includes("patch cutanea") && (
        <span
          className="ring-holo shine z-20 inline-flex items-center gap-2 border border-brand/40 bg-navy/70 text-brand text-[0.7rem] tracking-[0.22em] uppercase font-semibold px-3 py-1.5 rounded-sm backdrop-blur-md"
          style={{ position: "absolute", bottom: "0.75rem", right: "0.75rem", left: "auto", top: "auto" }}
        >
          <Sparkles className="h-3 w-3" /> Bio-Mimetic™
        </span>
      )}
    </div>
  );
}
