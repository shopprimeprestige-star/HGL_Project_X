import { Lightbulb } from "lucide-react";

type Tier = "basso" | "medio" | "ottimo";

interface VideoMetrics {
  thumbstop: number; // %
  hold: number; // %
  view50: number; // %
  view75: number; // %
  view100: number; // %
  realAttention: number; // ratio (thru/reach)
}

function tier(value: number, low: number, mid: number): Tier {
  if (value < low) return "basso";
  if (value < mid) return "medio";
  return "ottimo";
}

interface Verdict {
  headline: string;
  insight: string;
  tone: "good" | "warn" | "bad" | "neutral";
}

export function diagnoseVideo(m: VideoMetrics): Verdict {
  // Soglie allineate ai benchmark Meta (denominatore = video_plays)
  const thumb = tier(m.thumbstop, 40, 60); // Thumbstop = 3sec/views (engaged)
  const hold = tier(m.hold, 30, 50);       // Hold = thruplays/plays
  const view50 = tier(m.view50, 20, 35);
  const completion = tier(m.view100, 10, 20);

  // Caso "no data"
  if (m.thumbstop === 0 && m.hold === 0) {
    return {
      headline: "Nessun dato video nel periodo",
      insight: "Non ci sono abbastanza impressions video per valutare la creativa.",
      tone: "neutral",
    };
  }

  // Casi diagnostici principali
  if (thumb === "ottimo" && hold === "ottimo") {
    return {
      headline: "🔥 Creativa eccellente — Hook + Hold ottimi",
      insight: "L'hook ferma lo scroll e il messaggio regge fino alla fine. Scala il budget con fiducia.",
      tone: "good",
    };
  }
  if (thumb === "ottimo" && hold === "basso") {
    return {
      headline: "🎣 Buon thumb-stopper, ma il messaggio non regge",
      insight: "L'hook attira (thumbstop alto) ma le persone abbandonano subito (hold basso). Riscrivi i primi 3-10s del copy/voiceover o accorcia il video.",
      tone: "warn",
    };
  }
  if (thumb === "ottimo" && hold === "medio") {
    return {
      headline: "🎣 Hook forte, hold migliorabile",
      insight: "Lo scroll si ferma ma molti escono a metà. Prova a spostare il payoff/promessa più in alto nel video.",
      tone: "warn",
    };
  }
  if (thumb === "basso" && hold === "ottimo") {
    return {
      headline: "💎 Chi guarda completa, ma pochi si fermano",
      insight: "La creativa funziona per chi la vede, ma il primo frame/audio non cattura. Cambia thumbnail, primo frame o aggiungi text overlay nei primi 0.5s.",
      tone: "warn",
    };
  }
  if (thumb === "basso" && hold === "basso") {
    return {
      headline: "❌ Creativa debole — Hook E Hold bassi",
      insight: "Né hook né messaggio funzionano. Probabile fatigue o creativa fuori target. Considera di metterla in pausa e testare nuove varianti.",
      tone: "bad",
    };
  }
  if (thumb === "medio" && hold === "ottimo") {
    return {
      headline: "✅ Hold ottimo, hook nella media",
      insight: "Il messaggio funziona molto bene. Migliorando l'hook (primi 2s) puoi aumentare significativamente l'efficienza.",
      tone: "good",
    };
  }
  if (completion === "ottimo" && view50 === "ottimo") {
    return {
      headline: "🎬 Storytelling efficace",
      insight: "Le persone arrivano fino in fondo: la struttura del video tiene attenzione. Ottimo per costruire awareness/brand.",
      tone: "good",
    };
  }
  if (m.realAttention > 1.5) {
    return {
      headline: "⚠️ Saturazione attenzione — possibile fatigue",
      insight: `Real Attention Freq = ${m.realAttention.toFixed(2)}: gli stessi utenti hanno completato il video più volte. Refresh creatività o cambia audience.`,
      tone: "warn",
    };
  }

  // Default neutro
  return {
    headline: "📊 Performance video nella media",
    insight: `Hook ${thumb}, Hold ${hold}. Nessun pattern critico, ma c'è margine di ottimizzazione.`,
    tone: "neutral",
  };
}

export function VideoDiagnosis({ verdict }: { verdict: Verdict }) {
  const toneCls =
    verdict.tone === "good"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
      : verdict.tone === "warn"
      ? "border-amber-200 bg-amber-50/70 text-amber-900"
      : verdict.tone === "bad"
      ? "border-rose-200 bg-rose-50/70 text-rose-900"
      : "border-border bg-secondary/40 text-foreground";
  const iconCls =
    verdict.tone === "good"
      ? "text-emerald-600"
      : verdict.tone === "warn"
      ? "text-amber-600"
      : verdict.tone === "bad"
      ? "text-rose-600"
      : "text-muted-foreground";
  return (
    <div className={`rounded-lg border ${toneCls} px-3 py-2.5 mb-2 flex items-start gap-2`}>
      <Lightbulb className={`h-4 w-4 shrink-0 mt-0.5 ${iconCls}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold leading-tight">{verdict.headline}</div>
        <div className="text-[11px] opacity-90 mt-0.5 leading-snug">{verdict.insight}</div>
      </div>
    </div>
  );
}
