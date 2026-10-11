// Mini-sparkline SVG inline (no deps). Mostra trend ultimi N giorni di una metrica.
// Usa colore semantico dal benchmark dell'ultimo valore (rosso/giallo/verde).

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Se true, traccia anche un mini area fill sotto la linea */
  area?: boolean;
}

export function Sparkline({
  values,
  width = 56,
  height = 18,
  color = "currentColor",
  area = true,
}: SparklineProps) {
  const cleaned = values.filter((v) => Number.isFinite(v));
  if (cleaned.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeDasharray="2 2" strokeWidth={1} />
      </svg>
    );
  }
  const min = Math.min(...cleaned);
  const max = Math.max(...cleaned);
  const range = max - min || 1;
  const stepX = width / (cleaned.length - 1);
  const points = cleaned
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `M0,${height} L${points
    .split(" ")
    .map((p) => p)
    .join(" L")} L${width},${height} Z`;
  return (
    <svg width={width} height={height} className="shrink-0" style={{ color }}>
      {area && <path d={areaPath} fill={color} opacity={0.15} />}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* dot finale */}
      <circle
        cx={(cleaned.length - 1) * stepX}
        cy={height - ((cleaned[cleaned.length - 1] - min) / range) * (height - 2) - 1}
        r={1.8}
        fill={color}
      />
    </svg>
  );
}
