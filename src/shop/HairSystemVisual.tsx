import type { BaseStyle, Product, WaveStyle } from "./catalog";

/**
 * Illustrazione SVG accurata di una protesi (hair system) vista frontale:
 * mostra la costruzione reale della base (lace / skin / mono / silk / ibrida)
 * e i capelli (liscio / mosso / riccio, colore, % grigio).
 * Deterministica (seed dall'id prodotto) per non rompere l'idratazione SSR.
 */

function seededRng(seedStr: string): () => number {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) >>> 0;
  s = (s || 1) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mix(hex1: string, hex2: string, t: number): string {
  const a = hex1.replace("#", "");
  const b = hex2.replace("#", "");
  const ai = [0, 2, 4].map((i) => parseInt(a.slice(i, i + 2), 16));
  const bi = [0, 2, 4].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = ai.map((v, i) => Math.round(v + (bi[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const GRAY = "#b7b7bd";

// Costruisce il path di una singola ciocca dalla hairline verso il basso.
function strandPath(x0: number, topY: number, botY: number, wave: WaveStyle, drift: number, amp: number): string {
  const h = botY - topY;
  if (wave === "curly") {
    // serie di piccole curve alternate (riccio)
    let d = `M ${x0} ${topY}`;
    const steps = 6;
    const step = h / steps;
    let x = x0;
    for (let i = 0; i < steps; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const y1 = topY + step * (i + 0.5);
      const y2 = topY + step * (i + 1);
      const cx = x + dir * amp * 1.1;
      const nx = x0 + drift * (i + 1) * 0.18;
      d += ` Q ${cx} ${y1} ${nx} ${y2}`;
      x = nx;
    }
    return d;
  }
  if (wave === "wavy") {
    const midY = topY + h * 0.5;
    const endX = x0 + drift;
    return `M ${x0} ${topY} C ${x0 + amp} ${topY + h * 0.28} ${x0 - amp} ${midY} ${x0 + drift * 0.5} ${midY + h * 0.15} S ${endX + amp} ${botY - h * 0.15} ${endX} ${botY}`;
  }
  // straight: leggera curva naturale
  const endX = x0 + drift;
  return `M ${x0} ${topY} Q ${x0 + drift * 0.3 + amp * 0.3} ${topY + h * 0.5} ${endX} ${botY}`;
}

const BASE_LABEL: Record<BaseStyle, string> = {
  lace: "Base Lace",
  skin: "Base Skin / PU",
  mono: "Base Mono + PU",
  silk: "Silk Top",
  hybrid: "Lace front + PU",
};

export function HairSystemVisual({
  product,
  className = "",
  compact = false,
}: {
  product: Product;
  className?: string;
  compact?: boolean;
}) {
  const rng = seededRng(product.id + product.slug);
  const wave: WaveStyle = product.wave ?? "straight";
  const baseHair = product.hairColorHex ?? "#1b140f";
  const grayPct = product.grayPct ?? 0;
  const baseStyle: BaseStyle = product.baseStyle ?? "lace";

  const W = 400, H = 300;
  const cx = 200, cyBase = 128, rx = 132, ry = 104; // ellisse base
  const uid = product.id;

  // hairline: arco superiore dell'ellisse
  const N = compact ? 46 : 120;
  const strands: { d: string; color: string; w: number }[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    // x lungo la larghezza della hairline (leggermente dentro i bordi)
    const x0 = cx - rx * 0.86 + t * rx * 1.72;
    // top della hairline segue la curva dell'ellisse
    const norm = (x0 - cx) / rx;
    const topY = cyBase - ry * Math.sqrt(Math.max(0, 1 - norm * norm)) * 0.9 + 10;
    const len = ry * (1.5 + rng() * 0.5); // lunghezza capelli oltre la base
    const botY = topY + len;
    const drift = (norm) * 46 + (rng() - 0.5) * 26; // fan-out laterale
    const amp = (wave === "curly" ? 9 : wave === "wavy" ? 13 : 6) * (0.7 + rng() * 0.6);
    // colore: variazione di luce + eventuale grigio
    let color = mix(baseHair, "#ffffff", rng() * 0.14);
    if (grayPct > 0 && rng() * 100 < grayPct) color = mix(GRAY, baseHair, rng() * 0.3);
    else if (grayPct === 0 && rng() < 0.06) color = mix(baseHair, "#ffffff", 0.28); // ciocca luce
    strands.push({ d: strandPath(x0, topY, botY, wave, drift, amp), color, w: 1.1 + rng() * 1.3 });
  }

  const skinTone = "#e7c7ad";

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Illustrazione ${product.name}`}>
        <defs>
          {/* fondale studio */}
          <radialGradient id={`bg-${uid}`} cx="50%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#12294f" />
            <stop offset="60%" stopColor="#0b1b3a" />
            <stop offset="100%" stopColor="#081430" />
          </radialGradient>
          {/* rete lace */}
          <pattern id={`lace-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 0 L6 0 M0 0 L0 6" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
          </pattern>
          {/* rete mono (più larga) */}
          <pattern id={`mono-${uid}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 0 L10 0 M0 0 L0 10" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
          </pattern>
          <clipPath id={`clip-${uid}`}>
            <ellipse cx={cx} cy={cyBase} rx={rx} ry={ry} />
          </clipPath>
          <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill={`url(#bg-${uid})`} />
        {/* piano d'appoggio */}
        <ellipse cx={cx} cy={cyBase + ry - 6} rx={rx * 0.95} ry={20} fill="rgba(0,0,0,0.35)" />

        {/* ── BASE ── */}
        <g clipPath={`url(#clip-${uid})`}>
          {/* corpo base (tono pelle translucido) */}
          <rect x={cx - rx} y={cyBase - ry} width={rx * 2} height={ry * 2} fill={skinTone} opacity={baseStyle === "skin" ? 0.9 : 0.7} />
          {/* texture per tipo */}
          {(baseStyle === "lace" || baseStyle === "hybrid" || baseStyle === "silk") && (
            <rect x={cx - rx} y={cyBase - ry} width={rx * 2} height={ry * 2} fill={`url(#lace-${uid})`} />
          )}
          {baseStyle === "mono" && (
            <>
              <rect x={cx - rx} y={cyBase - ry} width={rx * 2} height={ry * 2} fill={`url(#mono-${uid})`} />
              {/* perimetro poly più scuro */}
              <ellipse cx={cx} cy={cyBase} rx={rx} ry={ry} fill="none" stroke="rgba(120,90,60,0.5)" strokeWidth="14" />
            </>
          )}
          {baseStyle === "skin" && <rect x={cx - rx} y={cyBase - ry} width={rx * 2} height={ry * 2} fill={`url(#sheen-${uid})`} opacity="0.5" />}
          {baseStyle === "silk" && (
            <ellipse cx={cx} cy={cyBase - 6} rx={rx * 0.5} ry={ry * 0.42} fill={skinTone} opacity="0.95" />
          )}
          {baseStyle === "hybrid" && (
            /* striscia skin nel corpo + lace davanti già reso */
            <rect x={cx - rx} y={cyBase - ry * 0.1} width={rx * 2} height={ry * 1.1} fill={skinTone} opacity="0.55" />
          )}
        </g>
        {/* bordo base */}
        <ellipse cx={cx} cy={cyBase} rx={rx} ry={ry} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />

        {/* ── CAPELLI ── */}
        <g clipPath="none" fill="none" strokeLinecap="round" opacity="0.96">
          {strands.map((s, i) => (
            <path key={i} d={s.d} stroke={s.color} strokeWidth={s.w} />
          ))}
        </g>
        {/* ombra alla radice per profondità */}
        <ellipse cx={cx} cy={cyBase - ry * 0.55} rx={rx * 0.9} ry={ry * 0.3} fill="rgba(0,0,0,0.18)" clipPath={`url(#clip-${uid})`} />

        {/* etichetta tipo base */}
        {!compact && (
          <g>
            <rect x={cx - 62} y={H - 34} width={124} height={22} rx={11} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.15)" />
            <text x={cx} y={H - 19} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.85)" fontFamily="Inter, sans-serif">
              {BASE_LABEL[baseStyle]}
            </text>
          </g>
        )}
        {/* brackets */}
        <path d="M14 14 h16 M14 14 v16" stroke="rgba(90,150,255,0.8)" strokeWidth="2" fill="none" />
        <path d={`M${W - 14} 14 h-16 M${W - 14} 14 v16`} stroke="rgba(90,150,255,0.8)" strokeWidth="2" fill="none" />
        <path d={`M14 ${H - 14} h16 M14 ${H - 14} v-16`} stroke="rgba(90,150,255,0.8)" strokeWidth="2" fill="none" />
        <path d={`M${W - 14} ${H - 14} h-16 M${W - 14} ${H - 14} v-16`} stroke="rgba(90,150,255,0.8)" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
}
