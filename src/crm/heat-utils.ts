// Helper per indicatori di "calore" (Disagio + Urgenza) sulle card lead.
// Migrato a token semantici: cold=info, warm=warning, hot=destructive.

export type Heat = "cold" | "warm" | "hot" | "neutral";

export function disagioHeat(score?: number | null): Heat {
  if (score == null) return "neutral";
  if (score <= 3) return "cold";
  if (score <= 6) return "warm";
  return "hot";
}

export function urgenzaHeat(urgenza?: string | null): Heat {
  if (!urgenza) return "neutral";
  const u = urgenza.toLowerCase();
  if (u === "subito" || u === "convince" || u === "si") return "hot";
  if (u === "1mese") return "warm";
  // valuto, valutando, 2_3mesi
  return "cold";
}

const CLASSES: Record<Heat, string> = {
  cold: "bg-info/15 text-info border-info/40",
  warm: "bg-warning/15 text-warning-foreground border-warning/50",
  hot: "bg-destructive/15 text-destructive border-destructive/40",
  neutral: "bg-muted text-muted-foreground border-border",
};

const DOTS: Record<Heat, string> = {
  cold: "bg-info",
  warm: "bg-warning",
  hot: "bg-destructive",
  neutral: "bg-muted-foreground/40",
};

export function heatClasses(h: Heat): string {
  return CLASSES[h];
}

export function heatDotClass(h: Heat): string {
  return DOTS[h];
}

export const HEAT_LABEL: Record<Heat, string> = {
  cold: "Freddo",
  warm: "Tiepido",
  hot: "Caldo",
  neutral: "—",
};
