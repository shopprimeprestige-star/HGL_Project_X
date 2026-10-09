import { Lightbulb } from "lucide-react";

type Tier = "basso" | "medio" | "ottimo";

interface TrafficMetrics {
  ctrOutbound: number;        // %
  ctr: number;                // % (UTM CTR)
  ctrMeta: number;            // % (Meta-declared CTR)
  lpIntentRate: number;       // % (lpv / outbound)
  lpViewRate: number;         // % (lpv / link clicks - Meta)
  lpvRateUtm: number;         // % (sessions / link clicks - UTM real)
  bounceRate: number;         // %
  cvr: number;                // % (lead / sessions)
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

export function diagnoseTraffic(m: TrafficMetrics): Verdict {
  const ctrOut = tier(m.ctrOutbound, 1, 2);
  const lpIntent = tier(m.lpIntentRate, 60, 80);
  const bounce = tier(m.bounceRate, 30, 50); // basso=ottimo, ottimo=brutto
  const cvr = tier(m.cvr, 1, 3);

  // No data
  if (m.ctrOutbound === 0 && m.lpViewRate === 0) {
    return {
      headline: "Nessun dato traffico nel periodo",
      insight: "Non ci sono abbastanza click/impressions per valutare la qualità del traffico.",
      tone: "neutral",
    };
  }

  // CTR alto ma LP View Rate basso → click invalidi/bot
  // delta UTM vs Meta: se UTM molto inferiore a Meta, Meta sta contando click che non arrivano davvero in LP
  const utmMetaDelta = m.ctrMeta > 0 ? ((m.lpvRateUtm - m.lpViewRate) / m.lpViewRate) * 100 : 0;
  if (m.ctr > 1.5 && utmMetaDelta < -40 && m.lpvRateUtm < 50) {
    return {
      headline: "🤖 CTR alto ma pochi arrivano in LP — click invalidi/bot sospetti",
      insight: `CTR Meta ${m.ctr.toFixed(1)}% ma solo il ${m.lpvRateUtm.toFixed(0)}% dei click arriva davvero sulla landing (Meta dichiara ${m.lpViewRate.toFixed(0)}%). Probabili click invalidi, bot o utenti che escono prima del caricamento. Controlla audience/posizionamenti.`,
      tone: "bad",
    };
  }

  // CTR Outbound alto + LP Intent basso → click su elementi sbagliati
  if (ctrOut === "ottimo" && lpIntent === "basso") {
    return {
      headline: "⚠️ Click in uscita alti ma pochi arrivano davvero in LP",
      insight: `CTR Outbound ${m.ctrOutbound.toFixed(1)}% (ottimo) ma Landing Intent solo ${m.lpIntentRate.toFixed(0)}%. Molti utenti cliccano ma non caricano la pagina (LP lenta, dominio bloccato, mobile drop). Verifica velocità LP e redirect.`,
      tone: "warn",
    };
  }

  // CTR basso ma LP performante → audience sbagliata
  if (ctrOut === "basso" && bounce === "ottimo" && cvr !== "basso") {
    return {
      headline: "💎 LP eccellente, ma pochi cliccano",
      insight: `Chi arriva converte (bounce ${m.bounceRate.toFixed(0)}%, CVR ${m.cvr.toFixed(1)}%), ma il CTR è basso (${m.ctrOutbound.toFixed(1)}%). La creativa non attira la giusta audience. Testa nuovi hook o audience più affini.`,
      tone: "warn",
    };
  }

  // Bounce alto + CVR basso → LP rotta o off-target
  if (bounce === "basso" /* basso = bounce è basso = ottimo */ ) {
    // bounce LOW means bounce is low which is GOOD - actually we mean tier("basso") = bounce <30 = good
  }
  if (m.bounceRate > 60 && m.cvr < 1) {
    return {
      headline: "❌ Landing page non funziona — bounce altissimo, CVR basso",
      insight: `Bounce ${m.bounceRate.toFixed(0)}% e CVR solo ${m.cvr.toFixed(1)}%. Gli utenti arrivano ma non si fermano. Riscrivi headline, accelera LP, rivedi promessa creativa vs LP (mismatch?).`,
      tone: "bad",
    };
  }

  // Tutto ottimo
  if (ctrOut === "ottimo" && lpIntent === "ottimo" && cvr === "ottimo") {
    return {
      headline: "🔥 Traffico di qualità — tutto in linea",
      insight: `CTR Outbound ${m.ctrOutbound.toFixed(1)}%, Landing Intent ${m.lpIntentRate.toFixed(0)}%, CVR ${m.cvr.toFixed(1)}%. Funnel sano: scala il budget.`,
      tone: "good",
    };
  }

  // CVR ottimo ma traffico medio
  if (cvr === "ottimo" && (ctrOut === "medio" || lpIntent === "medio")) {
    return {
      headline: "✅ CVR ottimo, c'è margine sul traffico",
      insight: `Chi arriva converte bene (${m.cvr.toFixed(1)}%). Migliorando CTR/LP Intent puoi scalare significativamente.`,
      tone: "good",
    };
  }

  // Default
  return {
    headline: "📊 Traffico nella media",
    insight: `CTR Outbound ${ctrOut}, Intent ${lpIntent}, Bounce ${m.bounceRate.toFixed(0)}%. Nessun pattern critico, ma c'è margine.`,
    tone: "neutral",
  };
}

export function TrafficDiagnosis({ verdict }: { verdict: Verdict }) {
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
