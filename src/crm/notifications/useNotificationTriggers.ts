import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../AuthContext";
import { useCRM } from "../CRMContext";
import type { Lead } from "../types";
import { fetchPrefs, type NotificationPrefs } from "./usePrefs";

/**
 * Calcola e inserisce notifiche per i 4 trigger critici.
 * - Filtra in base alle preferenze utente (muted_kinds, soglie personalizzate).
 * - Usa dedupe_key per impedire duplicati ricorrenti dello stesso alert.
 * - Gira ogni 10 minuti + al mount, throttle 5 min.
 */
export function useNotificationTriggers() {
  const { user } = useAuth();
  const { leads } = useCRM();
  const lastRunRef = useRef<number>(0);
  // I lead cambiano a ogni salvataggio e a ogni ricarica dell'elenco. Con
  // `leads` fra le dipendenze l'effetto si smontava e rimontava di continuo, e
  // l'intervallo da dieci minuti non arrivava MAI a scattare: il controllo
  // girava solo di rimbalzo, quando qualcosa cambiava. Qui i dati stanno in un
  // riferimento e il timer resta uno solo per tutta la sessione.
  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      // Al mount le trattative non sono ancora arrivate: contarle adesso
      // significherebbe scrivere "nessun lead nelle ultime 24h" ogni volta che
      // si apre il CRM.
      if (leadsRef.current.length === 0) return;
      if (Date.now() - lastRunRef.current < 5 * 60 * 1000) return;
      lastRunRef.current = Date.now();
      try {
        const prefs = await fetchPrefs(user.id);
        await checkAll(user.id, leadsRef.current, prefs);
      } catch (e) {
        console.warn("[notif-triggers] failed", e);
      }
    };
    void run();
    const id = setInterval(() => void run(), 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);
}

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

async function insertNotif(
  userId: string,
  payload: {
    kind: string;
    severity: "info" | "warning" | "critical";
    title: string;
    body?: string;
    link?: string;
    dedupe_key: string;
  },
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    kind: payload.kind,
    severity: payload.severity,
    title: payload.title,
    body: payload.body ?? null,
    link: payload.link ?? null,
    dedupe_key: payload.dedupe_key,
  });
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    console.warn("[notif] insert error", error.message);
  }
}

async function checkAll(userId: string, leads: Lead[], prefs: NotificationPrefs) {
  const muted = (k: string) => prefs.muted_kinds.includes(k);
  const today = dayKey();
  const yest = dayKey(new Date(Date.now() - 86400000));

  // Spesa di ieri (serve a 1 e 2)
  const { data: cfg } = await supabase
    .from("tracking_config")
    .select("daily_spend_meta")
    .eq("user_id", userId)
    .maybeSingle();
  const budget = Number(cfg?.daily_spend_meta) || 0;

  const { data: spendY } = await supabase
    .from("meta_ad_spend")
    .select("spend")
    .eq("user_id", userId)
    .eq("spend_date", yest);
  const spendYesterday = (spendY || []).reduce((s, r) => s + (Number(r.spend) || 0), 0);

  // ── 1. CPL fuori budget (giornaliero)
  if (!muted("cpl_over_budget")) {
    const overFactor = 1 + prefs.cpl_over_budget_pct / 100;
    if (budget > 0 && spendYesterday > budget * overFactor) {
      await insertNotif(userId, {
        kind: "cpl_over_budget",
        severity: "warning",
        title: `Spesa Meta sopra budget`,
        body: `Ieri €${spendYesterday.toFixed(0)} vs budget €${budget.toFixed(0)} (+${(((spendYesterday - budget) / budget) * 100).toFixed(0)}%)`,
        link: "/CRM/campagne-meta",
        dedupe_key: `cpl_over_budget:${yest}`,
      });
    }
  }

  // ── 2. No lead nelle ultime N ore con spesa attiva
  if (!muted("no_lead_24h") && spendYesterday > 5) {
    const hours = prefs.no_lead_hours;
    const sinceIso = new Date(Date.now() - hours * 3600000).toISOString();
    const { count: pubCount } = await supabase
      .from("public_leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso);
    const crmInWindow = leads.filter((l) => {
      const t = new Date(l.data?.createdAt || l.created_at).getTime();
      return t > Date.now() - hours * 3600000;
    }).length;
    const totalLeads = (pubCount || 0) + crmInWindow;
    if (totalLeads === 0) {
      await insertNotif(userId, {
        kind: "no_lead_24h",
        severity: "critical",
        title: `Nessun lead nelle ultime ${hours}h`,
        body: `Spesa attiva ieri €${spendYesterday.toFixed(0)} ma 0 lead acquisiti. Verifica creative e tracking.`,
        link: "/CRM/campagne-meta",
        dedupe_key: `no_lead_24h:${today}`,
      });
    }
  }

  // ── 3. LPS 7gg sotto soglia
  if (!muted("lps_below_threshold")) {
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: pl7 } = await supabase
      .from("public_leads")
      .select("disagio_score")
      .gte("created_at", since7);
    const withScore = (pl7 || []).filter((r) => r.disagio_score != null);
    if (withScore.length >= 5) {
      const avg = withScore.reduce((s, r) => s + (r.disagio_score || 0), 0) / withScore.length;
      if (avg < prefs.lps_min_threshold) {
        await insertNotif(userId, {
          kind: "lps_below_threshold",
          severity: "warning",
          title: `LPS 7gg basso: ${avg.toFixed(1)}/10`,
          body: `Media LPS sotto soglia (${prefs.lps_min_threshold}) su ${withScore.length} lead. Rivedi targeting/creative.`,
          link: "/CRM/trattative",
          dedupe_key: `lps_below:${today}`,
        });
      }
    }
  }

  // ── 4. Creative degradata
  if (!muted("creative_degraded")) {
    const since14d = dayKey(new Date(Date.now() - 14 * 86400000));
    const since7d = dayKey(new Date(Date.now() - 7 * 86400000));
    const { data: scoreHist } = await supabase
      .from("ad_score_history")
      .select("ad_id, score, snapshot_date")
      .eq("user_id", userId)
      .gte("snapshot_date", since14d);
    if (scoreHist && scoreHist.length > 0) {
      const byAd: Record<string, { recent: number[]; prev: number[] }> = {};
      for (const r of scoreHist) {
        const b = byAd[r.ad_id] || (byAd[r.ad_id] = { recent: [], prev: [] });
        if (r.snapshot_date >= since7d) b.recent.push(Number(r.score) || 0);
        else b.prev.push(Number(r.score) || 0);
      }
      for (const [adId, { recent, prev }] of Object.entries(byAd)) {
        if (recent.length < 2 || prev.length < 2) continue;
        const a = avgOf(recent);
        const p = avgOf(prev);
        if (p >= 70 && a < 50) {
          await insertNotif(userId, {
            kind: "creative_degraded",
            severity: "critical",
            title: `Creative in degrado`,
            body: `Score sceso da ${p.toFixed(0)} a ${a.toFixed(0)} negli ultimi 7gg. Ad ID: ${adId}`,
            link: `/CRM/campagne-meta?ad=${adId}`,
            dedupe_key: `creative_degraded:${adId}:${today}`,
          });
        }
      }
    }
  }
}

function avgOf(arr: number[]) {
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}
