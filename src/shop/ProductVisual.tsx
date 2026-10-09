import * as Lucide from "lucide-react";
import { TONE_GRADIENT, type Product } from "./catalog";

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

function iconByName(name: string): IconType {
  const map = Lucide as unknown as Record<string, IconType>;
  return map[name] ?? Lucide.Package;
}

export function ProductVisual({
  product,
  className = "",
  compact = false,
}: {
  product: Product;
  className?: string;
  compact?: boolean;
}) {
  const Icon = iconByName(product.icon);
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${TONE_GRADIENT[product.tone]} ${className}`}
    >
      {/* trama a griglia */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* glow */}
      <div className="absolute -top-1/3 left-1/2 h-2/3 w-2/3 -translate-x-1/2 rounded-full bg-white/20 blur-3xl" />
      {/* brackets */}
      <span className="absolute left-2 top-2 h-3 w-3 border-l-2 border-t-2 border-white/70" />
      <span className="absolute right-2 top-2 h-3 w-3 border-r-2 border-t-2 border-white/70" />
      <span className="absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-white/70" />
      <span className="absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-white/70" />
      <div className="relative flex h-full w-full items-center justify-center py-8">
        <Icon className={compact ? "h-10 w-10 text-white/90" : "h-16 w-16 text-white/90"} strokeWidth={1.4} />
      </div>
      {!compact && (
        <div className="absolute bottom-3 left-0 right-0 px-4 text-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">
            Hair Genius
          </span>
        </div>
      )}
    </div>
  );
}
