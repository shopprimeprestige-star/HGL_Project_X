import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCRM } from "./CRMContext";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { leadIsConverted, leadConversionDate, leadRevenue } from "./lead-analytics";

type Tone = "green" | "amber" | "rose" | "zinc";

interface KpiCard {
  label: string;
  value: string;
  sub?: string;
  tone: Tone;
  delta?: number | null; // %
  deltaInverse?: boolean; // se true: delta negativo = bene
  to: string;
  hint: string;
}

const TONE: Record<Tone, { bg: string; border: string; text: string; dot: string }> = {
  green: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    dot: "bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
  rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900", dot: "bg-rose-500" },
  zinc: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    dot: "bg-slate-400",
  },
};

const fmtEUR = (v: number) => `€${v.toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v.toFixed(0)}%`;

function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

export function HealthGlobalSection() {
  const { leads } = useCRM();
  const { user } = useAuth();

  // Async metrics: meta_ad_spend (CPL/ROAS) + public_leads (CAPI/LPS/non accettati)
  const [adsCurr, setAdsCurr] = useState<{ spend: number; days: number } | null>(null);
  const [adsPrev, setAdsPrev] = useState<{ spend: number; days: number } | null>(null);
  const [adsSpend30, setAdsSpend30] = useState<number>(0);
  const [budget, setBudget] = useState<number>(0);
  const [capi, setCapi] = useState<{ rate: number; total: number; capi: number } | null>(null);
  const [lps, setLps] = useState<{ avg: number; n: number; cov: number } | null>(null);
  const [pendingPublic, setPendingPublic] = useState<{ count: number; oldestMin: number } | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      // Budget tracking
      const { data: cfg } = await supabase
        .from("tracking_config")
        .select("daily_spend_meta")
        .eq("user_id", user.id)
        .maybeSingle();
      if (alive && cfg) setBudget(Number(cfg.daily_spend_meta) || 0);

      // Ads spend last 7gg + prev 7gg + last 30gg
      const since14 = daysAgoIso(14).slice(0, 10);
      const { data: ads } = await supabase
        .from("meta_ad_spend")
        .select("spend, spend_date")
        .eq("user_id", user.id)
        .gte("spend_date", since14);
      if (alive && ads) {
        const today = new Date();
        const day7 = new Date(Date.now() - 7 * 86400000);
        let curr = 0,
          prev = 0;
        const daysCurr = new Set<string>();
        const daysPrev = new Set<string>();
        for (const r of ads) {
          const d = new Date(r.spend_date);
          if (d >= day7 && d < today) {
            curr += Number(r.spend) || 0;
            daysCurr.add(r.spend_date);
          } else if (d < day7) {
            prev += Number(r.spend) || 0;
            daysPrev.add(r.spend_date);
          }
        }
        setAdsCurr({ spend: curr, days: Math.max(1, daysCurr.size) });
        setAdsPrev({ spend: prev, days: Math.max(1, daysPrev.size) });
      }

      // 30gg per ROAS
      const since30 = daysAgoIso(30).slice(0, 10);
      const { data: ads30 } = await supabase
        .from("meta_ad_spend")
        .select("spend")
        .eq("user_id", user.id)
        .gte("spend_date", since30);
      if (alive && ads30) {
        setAdsSpend30(ads30.reduce((s, r) => s + (Number(r.spend) || 0), 0));
      }

      // CAPI 7gg + LPS 7gg + lead pubblici pendenti
      const since7Iso = daysAgoIso(7);
      const { data: pl } = await supabase
        .from("public_leads")
        .select("created_at, capi_sent, disagio_score, accepted_at, status")
        .gte("created_at", since7Iso);
      if (alive && pl) {
        const total = pl.length;
        const capiN = pl.filter((r) => r.capi_sent).length;
        setCapi({ rate: total ? (capiN / total) * 100 : 100, total, capi: capiN });

        const withScore = pl.filter((r) => r.disagio_score != null);
        const avg = withScore.length
          ? withScore.reduce((s, r) => s + (r.disagio_score || 0), 0) / withScore.length
          : 0;
        setLps({ avg, n: withScore.length, cov: total ? (withScore.length / total) * 100 : 0 });

        // Pending: non accettati e status nuovo, > 15 min
        const now = Date.now();
        const pending = pl.filter(
          (r) => !r.accepted_at && (r.status === "nuovo" || r.status === "pending"),
        );
        const overdue = pending.filter(
          (r) => (now - new Date(r.created_at).getTime()) / 60000 > 15,
        );
        const oldest = overdue.length
          ? Math.max(...overdue.map((r) => (now - new Date(r.created_at).getTime()) / 60000))
          : 0;
        setPendingPublic({ count: overdue.length, oldestMin: Math.round(oldest) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  // Conversioni & netto da CRM leads
  const { conv7, fatturato30Net, conv7Prev, fatt30NetPrev } = useMemo(() => {
    const now = Date.now();
    const d7 = now - 7 * 86400000;
    const d14 = now - 14 * 86400000;
    const d30 = now - 30 * 86400000;
    const d60 = now - 60 * 86400000;

    let c7 = 0,
      c7p = 0,
      f30 = 0,
      f30p = 0;
    for (const l of leads) {
      if (!leadIsConverted(l)) continue;
      const cd = leadConversionDate(l);
      if (!cd) continue;
      const t = cd.getTime();
      if (t >= d7 && t <= now) c7++;
      else if (t >= d14 && t < d7) c7p++;

      const rev = leadRevenue(l);
      if (t >= d30 && t <= now) f30 += rev;
      else if (t >= d60 && t < d30) f30p += rev;
    }
    // Stima netto: ricavo - margine di costo prodotto già escluso? Usa rev * 0.6 come proxy netto
    // (spend ads + costi non hanno qui dato unificato a 30gg).
    // Mostriamo "Fatturato 30gg" come ricavo lordo per chiarezza, sottraendo solo IVA stimata.
    // Per coerenza con la richiesta "Fatturato netto 30gg" sottraiamo IVA 22% come netto.
    return {
      conv7: c7,
      conv7Prev: c7p,
      fatturato30Net: f30 / 1.22,
      fatt30NetPrev: f30p / 1.22,
    };
  }, [leads]);

  // Costruisco le 8 KPI
  const cards: KpiCard[] = useMemo(() => {
    const arr: KpiCard[] = [];

    // 1. CPL 7gg vs budget — calcolato come spend/lead acquisiti negli ultimi 7gg
    // Lead acquisiti 7gg: leads CRM con createdAt negli ultimi 7gg che hanno tracking ads
    const now = Date.now();
    const d7 = now - 7 * 86400000;
    const d14 = now - 14 * 86400000;
    const leadsAds7 = leads.filter((l) => {
      const t = new Date(l.data.createdAt || l.created_at).getTime();
      if (!(t >= d7 && t <= now)) return false;
      return Boolean(l.data.tracking?.source || l.data.tracking?.ad_id || l.data.fonte === "ADV");
    }).length;
    const leadsAds7Prev = leads.filter((l) => {
      const t = new Date(l.data.createdAt || l.created_at).getTime();
      if (!(t >= d14 && t < d7)) return false;
      return Boolean(l.data.tracking?.source || l.data.tracking?.ad_id || l.data.fonte === "ADV");
    }).length;
    const cpl7 = adsCurr && leadsAds7 > 0 ? adsCurr.spend / leadsAds7 : null;
    const cplPrev = adsPrev && leadsAds7Prev > 0 ? adsPrev.spend / leadsAds7Prev : null;
    const cplBudget = budget > 0 ? budget : null;
    let cplTone: Tone = "zinc";
    if (cpl7 != null && cplBudget != null) {
      cplTone = cpl7 <= cplBudget ? "green" : cpl7 <= cplBudget * 1.25 ? "amber" : "rose";
    } else if (cpl7 != null) {
      cplTone = "zinc";
    }
    arr.push({
      label: "CPL 7gg",
      value: cpl7 != null ? fmtEUR(cpl7) : "—",
      sub: cplBudget ? `Budget ${fmtEUR(cplBudget)}` : "Budget non impostato",
      tone: cplTone,
      delta: cpl7 != null && cplPrev != null ? pctDelta(cpl7, cplPrev) : null,
      deltaInverse: true,
      to: "/CRM/campagne-meta",
      hint: "Costo per lead ultimi 7 giorni vs budget configurato in Impostazioni",
    });

    // 2. ROAS 30gg — fatturato netto / spend
    const roas30 = adsSpend30 > 0 ? fatturato30Net / adsSpend30 : null;
    let roasTone: Tone = "zinc";
    if (roas30 != null) {
      roasTone = roas30 >= 2.5 ? "green" : roas30 >= 1.5 ? "amber" : "rose";
    }
    arr.push({
      label: "ROAS 30gg",
      value: roas30 != null ? `${roas30.toFixed(2)}x` : "—",
      sub: adsSpend30 > 0 ? `Spesa ${fmtEUR(adsSpend30)}` : "Nessuna spesa",
      tone: roasTone,
      delta: null,
      to: "/CRM/landing-page",
      hint: "Fatturato netto 30gg / Spesa ads 30gg",
    });

    // 3. Lead non accettati > SLA
    const overdueCount = pendingPublic?.count ?? 0;
    const oldest = pendingPublic?.oldestMin ?? 0;
    let pendTone: Tone = "green";
    if (overdueCount > 0) pendTone = oldest > 60 ? "rose" : "amber";
    arr.push({
      label: "Lead non accettati",
      value: String(overdueCount),
      sub: overdueCount > 0 ? `Più vecchio: ${oldest}min` : "Tutti accettati",
      tone: pendTone,
      to: "/CRM/nuovi-contatti",
      hint: "Lead pubblici non accettati da più di 15 minuti",
    });

    // 4. Ad in degrado — lo metto come placeholder dipendente da snapshot, ma per ora 0 con link
    // Rinvio: lasciamo il bucket "—" se non disponibile a basso costo. Calcolare degrado richiederebbe
    // chiamata pesante; mostriamo lo stato come zinc con CTA verso le campagne.
    arr.push({
      label: "Ad in degrado",
      value: "→",
      sub: "Apri Campagne Meta",
      tone: "zinc",
      to: "/CRM/campagne-meta",
      hint: "Vai in Campagne Meta per vedere quali creative stanno calando",
    });

    // 5. LPS 7gg
    const lpsAvg = lps?.avg ?? null;
    const lpsCov = lps?.cov ?? 0;
    let lpsTone: Tone = "zinc";
    if (lpsAvg != null && (lps?.n ?? 0) >= 3) {
      lpsTone = lpsAvg >= 6 ? "green" : lpsAvg >= 4 ? "amber" : "rose";
    }
    arr.push({
      label: "LPS 7gg",
      value: lpsAvg != null && (lps?.n ?? 0) >= 3 ? `${lpsAvg.toFixed(1)}/10` : "—",
      sub: lps ? `Cov ${fmtPct(lpsCov)} · ${lps.n} lead` : "Nessun dato",
      tone: lpsTone,
      to: "/CRM/trattative",
      hint: "Lead Pain Score medio ultimi 7gg con copertura dichiarazione",
    });

    // 6. CAPI match 7gg
    const capiRate = capi?.rate ?? null;
    let capiTone: Tone = "zinc";
    if (capiRate != null && (capi?.total ?? 0) >= 3) {
      capiTone = capiRate >= 90 ? "green" : capiRate >= 80 ? "amber" : "rose";
    }
    arr.push({
      label: "CAPI match 7gg",
      value: capiRate != null && (capi?.total ?? 0) >= 3 ? fmtPct(capiRate) : "—",
      sub: capi ? `${capi.capi}/${capi.total} eventi` : "Nessun lead",
      tone: capiTone,
      to: "/CRM/campagne-meta",
      hint: "% lead pubblici con evento server-side ricevuto da Meta",
    });

    // 7. Conversioni 7gg
    let convTone: Tone = "zinc";
    if (conv7 > 0) convTone = "green";
    else if (conv7Prev > 0) convTone = "rose";
    arr.push({
      label: "Conversioni 7gg",
      value: String(conv7),
      sub: `Prec. ${conv7Prev}`,
      tone: convTone,
      delta: pctDelta(conv7, conv7Prev),
      to: "/CRM/trattative",
      hint: "Lead chiusi (acconto/venduto/concluso) negli ultimi 7gg",
    });

    // 8. Fatturato netto 30gg
    let fattTone: Tone = "zinc";
    if (fatturato30Net > 0) {
      const d = pctDelta(fatturato30Net, fatt30NetPrev);
      fattTone = d == null || d >= 0 ? "green" : d > -15 ? "amber" : "rose";
    }
    arr.push({
      label: "Fatturato netto 30gg",
      value: fmtEUR(fatturato30Net),
      sub: `Prec. ${fmtEUR(fatt30NetPrev)}`,
      tone: fattTone,
      delta: pctDelta(fatturato30Net, fatt30NetPrev),
      to: "/CRM/landing-page",
      hint: "Ricavi convertiti 30gg al netto IVA stimata 22%",
    });

    return arr;
  }, [
    leads,
    adsCurr,
    adsPrev,
    adsSpend30,
    budget,
    capi,
    lps,
    pendingPublic,
    conv7,
    conv7Prev,
    fatturato30Net,
    fatt30NetPrev,
  ]);

  // Stato globale: peggior tono presente
  const worst: Tone = cards.some((c) => c.tone === "rose")
    ? "rose"
    : cards.some((c) => c.tone === "amber")
      ? "amber"
      : cards.every((c) => c.tone === "zinc")
        ? "zinc"
        : "green";

  const headerLabel: Record<Tone, string> = {
    green: "Tutto sotto controllo",
    amber: "Alcuni segnali da sorvegliare",
    rose: "Attenzione: segnali critici",
    zinc: "Dati insufficienti",
  };

  return (
    <Card className={`${TONE[worst].border} border-2 ${TONE[worst].bg}`}>
      <div className="p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${TONE[worst].dot}`} />
            <h2 className={`text-lg font-bold ${TONE[worst].text}`}>Health globale</h2>
            <span className="text-[12px] text-muted-foreground">· {headerLabel[worst]}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">aggiornato live</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map((c) => (
            <KpiTile key={c.label} card={c} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function KpiTile({ card }: { card: KpiCard }) {
  const t = TONE[card.tone];
  const dArrow =
    card.delta == null ? null : Math.abs(card.delta) < 1 ? (
      <Minus className="h-3 w-3" />
    ) : card.delta > 0 ? (
      <TrendingUp className="h-3 w-3" />
    ) : (
      <TrendingDown className="h-3 w-3" />
    );
  // Color del delta: se deltaInverse (es. CPL), positivo = male
  const goodDelta = card.delta == null ? null : card.deltaInverse ? card.delta < 0 : card.delta > 0;
  const deltaColor =
    card.delta == null ? "text-muted-foreground" : goodDelta ? "text-emerald-700" : "text-rose-700";

  return (
    <Link
      to={card.to}
      title={card.hint}
      className={`group block rounded-lg border ${t.border} bg-white p-3 hover:shadow-md transition-all`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          {card.label}
        </div>
        <span className={`h-2 w-2 rounded-full ${t.dot} mt-1`} />
      </div>
      <div className={`text-2xl font-bold ${t.text} mt-1 tabular-nums`}>{card.value}</div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-[11px] text-muted-foreground truncate">{card.sub}</div>
        {card.delta != null && (
          <div className={`flex items-center gap-0.5 text-[11px] font-medium ${deltaColor}`}>
            {dArrow}
            {Math.abs(card.delta).toFixed(0)}%
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground/70 group-hover:text-foreground">
        Apri <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
