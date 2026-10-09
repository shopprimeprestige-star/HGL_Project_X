/** AI Insights per singola TikTok ad — usa OpenRouter (gemini-2.5-flash).
 *  Riceve metriche aggregate Hook/Hold/Completion/CPL/ROAS e produce 3-5 raccomandazioni
 *  operative in italiano, con tono diretto e contestualizzato a TikTok (non Meta).
 *
 *  Body: { ad: { ad_name, ad_id, spend, lead, cpl, roas, hookRate, holdRate,
 *                view100Rate, frequency, ctr, impressions, clicks, vendite, fatturato,
 *                trend7d?: [{date,spend,lead,cpl,hookRate,holdRate,view100Rate}] } }
 *
 *  Auth: Authorization deve includere SUPABASE_PUBLISHABLE_KEY (anon).
 */
import { createFileRoute } from "@tanstack/react-router";

interface AdSnapshot {
  ad_name: string;
  ad_id: string;
  spend: number;
  lead: number;
  cpl: number;
  roas: number;
  hookRate: number;
  holdRate: number;
  view100Rate: number;
  frequency: number;
  ctr: number;
  impressions: number;
  clicks: number;
  vendite?: number;
  fatturato?: number;
  trend7d?: Array<{ date: string; spend: number; lead: number; cpl: number; hookRate: number; holdRate: number; view100Rate: number }>;
}

const SYSTEM_PROMPT = `Sei un analista TikTok Ads esperto. Analizzi performance di singole inserzioni TikTok e fornisci raccomandazioni operative concrete.

REGOLE:
- Massimo 5 raccomandazioni, ordine di priorità decrescente.
- Italiano informale ma professionale (dai del tu).
- Ogni raccomandazione: 1 frase azione + 1 frase motivo.
- Usa solo metriche TikTok-native: Hook Rate (2s/impr), Hold Rate (6s/impr), Completion (p100/views), CPL, ROAS, Frequency, CTR.
- NON menzionare Meta, Facebook, ThruPlay, Pixel.
- Benchmark TikTok di riferimento:
  * Hook Rate sano: >15%, ottimo >25%
  * Hold Rate sano: >5%, ottimo >10%
  * Completion sano: >15%, ottimo >25%
  * Frequency healthy: <3, fatigue >4
  * CTR sano: >1%, ottimo >2%
- Se ROAS positivo + CPL basso → suggerisci scaling.
- Se Hook basso (<10%) → prima 2s del video da rifare.
- Se Hold basso ma Hook ok → mid-roll debole, taglia o rinforza.
- Se Completion basso ma Hold ok → finale piatto, aggiungi CTA.
- Se Frequency >3.5 → audience saturata, allarga targeting o pausa.
- Se CPL alto e ROAS basso → kill candidato.

Output: JSON valido con questo schema:
{
  "verdict": "scale" | "optimize" | "monitor" | "kill",
  "verdict_reason": "string breve (1 frase)",
  "recommendations": [
    { "priority": "high"|"medium"|"low", "action": "string", "reason": "string" }
  ],
  "diagnostic": {
    "creative_quality": "ottima"|"buona"|"media"|"debole",
    "audience_fatigue": "low"|"medium"|"high",
    "funnel_bottleneck": "hook"|"hold"|"completion"|"ctr"|"conversion"|"none"
  }
}`;

export const Route = createFileRoute("/hooks/tiktok-ad-insights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(expected || "__missing__")) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "no_api_key" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { ad: AdSnapshot };
        try {
          body = (await request.json()) as { ad: AdSnapshot };
        } catch {
          return new Response(JSON.stringify({ error: "invalid_body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (!body.ad || !body.ad.ad_id) {
          return new Response(JSON.stringify({ error: "missing_ad" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const ad = body.ad;
        const userPrompt = `Analizza questa inserzione TikTok e dammi raccomandazioni operative.

INSERZIONE: "${ad.ad_name}" (ID: ${ad.ad_id})

PERFORMANCE PERIODO:
- Spesa: €${ad.spend.toFixed(2)}
- Impressioni: ${ad.impressions.toLocaleString("it-IT")}
- Click: ${ad.clicks.toLocaleString("it-IT")}
- CTR: ${ad.ctr.toFixed(2)}%
- Frequency: ${ad.frequency.toFixed(2)}×

VIDEO QUALITY:
- Hook Rate (2s/impr): ${ad.hookRate.toFixed(2)}%
- Hold Rate (6s/impr): ${ad.holdRate.toFixed(2)}%
- Completion (p100/views): ${ad.view100Rate.toFixed(2)}%

RISULTATI BUSINESS:
- Lead: ${ad.lead}
- CPL: €${ad.cpl.toFixed(2)}
- Vendite: ${ad.vendite ?? 0}
- Fatturato: €${(ad.fatturato ?? 0).toFixed(2)}
- ROAS: ${ad.roas.toFixed(2)}×

${ad.trend7d && ad.trend7d.length > 0 ? `TREND ULTIMI ${ad.trend7d.length} GIORNI:
${ad.trend7d.map(t => `  ${t.date}: spesa €${t.spend.toFixed(0)}, lead ${t.lead}, CPL €${t.cpl.toFixed(2)}, Hook ${t.hookRate.toFixed(1)}%, Hold ${t.holdRate.toFixed(1)}%, Compl ${t.view100Rate.toFixed(1)}%`).join("\n")}` : ""}

Rispondi SOLO con il JSON richiesto.`;

        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!aiRes.ok) {
          if (aiRes.status === 429) {
            return new Response(JSON.stringify({ error: "rate_limited", message: "Troppe richieste. Riprova tra qualche istante." }), {
              status: 429,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (aiRes.status === 402) {
            return new Response(JSON.stringify({ error: "credits_exhausted", message: "Crediti AI esauriti. Aggiungi fondi su OpenRouter." }), {
              status: 402,
              headers: { "Content-Type": "application/json" },
            });
          }
          const text = await aiRes.text();
          return new Response(JSON.stringify({ error: "ai_error", message: text }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        const aiJson = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = aiJson.choices?.[0]?.message?.content;
        if (!content) {
          return new Response(JSON.stringify({ error: "no_content" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          return new Response(JSON.stringify({ error: "parse_error", raw: content }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ ok: true, insights: parsed }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
