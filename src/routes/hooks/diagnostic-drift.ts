/** Cron giornaliero: esegue la diagnostica metriche per ogni utente con tracking_config
 *  configurato. Se trova drift > 10% su almeno una metrica, crea una notifica nel
 *  centro alert (tabella `notifications`) con dedupe_key giornaliero. */

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const META_API = "https://graph.facebook.com/v21.0";
const DRIFT_THRESHOLD = 10; // %

interface VideoAction { action_type: string; value: string }
interface MetaInsight {
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
}

/** Invio email di alert critico via Resend (se RESEND_API_KEY è configurato).
 *  Graceful no-op se la chiave manca: la notifica in-app è già stata creata. */
async function sendDriftEmail(opts: {
  to: string;
  drifts: string[];
  threshold: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_resend_key" };
  try {
    const subject = `🚨 CRM Alert: drift metriche > ${opts.threshold}% rilevato`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px">
        <h2 style="margin:0 0 8px;color:#9a3412">⚠️ Diagnostica metriche · drift critico</h2>
        <p style="margin:0 0 12px;color:#7c2d12">
          La diagnostica giornaliera ha rilevato un disallineamento <strong>&gt; ${opts.threshold}%</strong>
          fra i dati Meta live e quelli aggregati nel tuo CRM.
        </p>
        <ul style="margin:0 0 16px;padding-left:20px;color:#1f2937">
          ${opts.drifts.map((d) => `<li><code style="background:#fef3c7;padding:2px 6px;border-radius:4px">${d}</code></li>`).join("")}
        </ul>
        <p style="margin:0 0 8px;color:#374151;font-size:13px">
          Apri <strong>Impostazioni → Diagnostica metriche</strong> per investigare e
          ri-sincronizzare lo storico se necessario.
        </p>
      </div>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "CRM Alerts <onboarding@resend.dev>",
        to: [opts.to],
        subject,
        html,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, reason: `resend_${r.status}:${t.slice(0, 80)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

async function diagnoseUser(
  admin: ReturnType<typeof createClient<Database>>,
  userId: string,
): Promise<{ drifts: string[] } | null> {
  const { data: cfg } = await admin
    .from("tracking_config")
    .select("meta_access_token, meta_ad_account_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!cfg?.meta_access_token || !cfg?.meta_ad_account_id) return null;

  const rawAcct = cfg.meta_ad_account_id.trim();
  const acct = rawAcct.startsWith("act_") ? rawAcct : `act_${rawAcct.replace(/^act_?/, "")}`;
  const u = new URL(`${META_API}/${acct}/insights`);
  u.searchParams.set("access_token", cfg.meta_access_token);
  u.searchParams.set("fields", "spend,impressions,clicks,inline_link_clicks");
  u.searchParams.set("level", "account");
  u.searchParams.set("date_preset", "last_30d");
  const r = await fetch(u.toString());
  const j = await r.json();
  if (!r.ok || j.error) return null;
  const ins: MetaInsight = (j.data?.[0] as MetaInsight) || {};
  const liveSpend = Number(ins.spend || 0);
  const liveImpr = Number(ins.impressions || 0);
  const liveClicks = Number(ins.inline_link_clicks || ins.clicks || 0);

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data: rows } = await admin
    .from("meta_ad_spend")
    .select("spend, impressions, clicks, link_clicks")
    .eq("user_id", userId)
    .gte("spend_date", sinceStr);
  const agg = (rows || []).reduce(
    (a, x) => ({
      spend: a.spend + Number(x.spend || 0),
      impr: a.impr + Number(x.impressions || 0),
      clicks: a.clicks + Number(x.link_clicks || x.clicks || 0),
    }),
    { spend: 0, impr: 0, clicks: 0 },
  );

  const drifts: string[] = [];
  const check = (label: string, live: number, local: number) => {
    if (live === 0 || local === 0) return;
    const pct = Math.abs(((local - live) / live) * 100);
    if (pct > DRIFT_THRESHOLD) drifts.push(`${label} ${pct.toFixed(1)}%`);
  };
  check("Spesa", liveSpend, agg.spend);
  check("Impressions", liveImpr, agg.impr);
  check("Clicks", liveClicks, agg.clicks);
  return { drifts };
}

export const Route = createFileRoute("/hooks/diagnostic-drift")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.replace("Bearer ", "");
        if (!token) {
          return new Response(JSON.stringify({ error: "Missing authorization" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server not configured" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        const admin = createClient<Database>(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        try {
          // Tutti gli utenti con tracking config Meta
          const { data: users } = await admin
            .from("tracking_config")
            .select("user_id")
            .not("meta_access_token", "is", null)
            .not("meta_ad_account_id", "is", null);

          const today = new Date().toISOString().slice(0, 10);
          let alertsCreated = 0;
          let emailsSent = 0;
          for (const u of users || []) {
            const res = await diagnoseUser(admin, u.user_id);
            if (!res || res.drifts.length === 0) continue;
            const dedupe_key = `diagnostic-drift:${u.user_id}:${today}`;
            const { error } = await admin.from("notifications").insert({
              user_id: u.user_id,
              kind: "metrics_drift",
              severity: "warning",
              title: `Diagnostica metriche: drift > ${DRIFT_THRESHOLD}% rilevato`,
              body: `Disallineamento Meta vs locale: ${res.drifts.join(" · ")}. Apri Impostazioni → Diagnostica metriche per investigare.`,
              link: "/CRM/impostazioni",
              dedupe_key,
            });
            if (!error) alertsCreated++;

            // Email critical alert (se l'utente ha attivato email_critical_enabled)
            const { data: prefs } = await admin
              .from("notification_prefs")
              .select("email_target, email_critical_enabled")
              .eq("user_id", u.user_id)
              .maybeSingle();
            if (prefs?.email_critical_enabled && prefs.email_target) {
              const sent = await sendDriftEmail({
                to: prefs.email_target,
                drifts: res.drifts,
                threshold: DRIFT_THRESHOLD,
              });
              if (sent.ok) emailsSent++;
              else console.warn(`[diagnostic-drift] email skip ${u.user_id}: ${sent.reason}`);
            }
          }
          return new Response(JSON.stringify({ ok: true, users: users?.length || 0, alertsCreated, emailsSent }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("[diagnostic-drift] failed:", e);
          return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
