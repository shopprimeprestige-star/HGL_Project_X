/** ── GENERARE IL CAMPIONE FOTOGRAFICO DI UN COLORE ─────────────────────────
 *
 *  GET                  → { campioni }
 *  POST { codice }      → genera la fotografia di quella tinta e la deposita
 *  POST { codice, via } → toglie il campione e torna alla tinta piena
 *
 *  ── ⚠️ UNA TINTA PER VOLTA, DI PROPOSITO ─────────────────────────────────
 *  Sessantatré generazioni in un colpo sono sessantatré immagini pagate prima
 *  di aver visto se la prima è quella giusta. Si fa un colore, si guarda, e
 *  solo dopo si decide se farli tutti.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";
import { salvaImmagine } from "@/prova/catalogo.server";
import { campioni, salvaCampione, togliCampione } from "@/prova/campioni.server";
import { COLORI } from "@/prova/tagli";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CRM-Sessione, X-Consulente",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function chiaveAI(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "ai_config").maybeSingle();
    const v = JSON.parse((data as { value?: string } | null)?.value ?? "{}");
    return String(v.apiKey || "") || String(process.env.OPENROUTER_API_KEY || "");
  } catch {
    return String(process.env.OPENROUTER_API_KEY || "");
  }
}

/** ── IL TESTO CHE DESCRIVE UNA CIOCCA ──────────────────────────────────────
 *  ⚠️ Si dà il colore in DUE modi: il codice esadecimale e le parole. Il
 *   numero da solo non basta — un modello di immagini non «legge» un
 *   esadecimale come una tinta, lo interpreta — e le parole da sole nemmeno,
 *   perché «biondo cenere chiarissimo» copre mezza tabella. Insieme si
 *   restringono a vicenda.
 *  ⚠️ E si chiede una fotografia di STUDIO, non una ciocca artistica: sfondo
 *   neutro uniforme, luce morbida di taglio, capelli lisci e paralleli. Ogni
 *   riflesso di scena, ogni sfondo colorato, ogni mano che regge la ciocca
 *   falserebbero il colore — che è l'unica cosa che questa immagine deve dire.
 */
export function testoCampione(nome: string, hex: string, inglese: string, grigi: number): string {
  return [
    "Photorealistic studio macro photograph of a swatch of real human hair, filling the entire frame.",
    "The hair is perfectly straight, combed flat, strands parallel and running vertically from top to bottom, with visible individual strands and natural shine.",
    `The colour must be EXACTLY ${inglese}, hex ${hex}. Reproduce that exact tone, lightness and warmth: not lighter, not darker, not warmer, not cooler.`,
    grigi > 0
      ? `About ${grigi}% of the strands are grey/white, mixed strand by strand among the coloured ones — never as a patch or a streak.`
      : "All strands are the same colour, with natural strand-to-strand variation only. No grey, no white strands.",
    "Even, soft, neutral studio lighting across the whole frame. Plain neutral background, no props, no hands, no clips, no ring, no text, no watermark, no person, no face.",
    "Square 1:1 framing, sharp focus, colour-accurate, as in a professional hair colour chart photograph.",
    `This swatch represents hair colour «${nome}».`,
  ].join(" ");
}

export const Route = createFileRoute("/api/crm/prova-colore")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "agenda");
        if (!g.ok) return g.risposta;
        return json({ ok: true, campioni: await campioni() });
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "agenda");
        if (!g.ok) return g.risposta;

        let b: { codice?: string; via?: boolean } = {};
        try { b = (await request.json()) as typeof b; } catch { /* si risponde no */ }
        const codice = String(b.codice || "").trim();

        /** ── ⚠️ TOGLIERE FUNZIONA ANCHE PER UNA TINTA CHE NON C'È PIÙ ─────
         *  Ed è proprio allora che serve: quando l'elenco dei colori cambia, i
         *  campioni delle tinte sparite restano depositati e nessuno può più
         *  toccarli — un archivio che cresce di roba che nessuno mostra.
         *  Prima si cercava la tinta anche per cancellarla, e la richiesta
         *  veniva rifiutata proprio nel caso in cui era giusta. */
        if (b.via) {
          if (!codice) return json({ ok: false, errore: "Serve il codice." }, 400);
          return json({ ok: true, campioni: await togliCampione(codice) });
        }

        const colore = COLORI.find((c) => String(c.codice || "").toLowerCase() === codice.toLowerCase());
        if (!colore?.codice) return json({ ok: false, errore: "Questo colore non esiste." }, 400);

        const chiave = await chiaveAI();
        if (!chiave) return json({ ok: false, errore: "Manca la chiave per generare le immagini." }, 400);

        /** ── ⚠️ SI RIPROVA: IL MODELLO A VOLTE RISPONDE SENZA IMMAGINE ────
         *  Misurato su questa stessa tinta: due tentativi su quattro sono
         *  tornati a mani vuote, senza errore e senza nemmeno una parola di
         *  spiegazione. Non è un guasto nostro ed è passeggero — ma per chi
         *  preme il tasto è indistinguibile da una funzione rotta, e la
         *  reazione naturale è premere ancora, cioè pagare due volte.
         *  Tre tentativi qui dentro, e quello che arriva in pagina è l'esito
         *  vero. */
        let ultimo = "";
        for (let tentativo = 0; tentativo < 3; tentativo += 1) {
          try {
            const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${chiave}` },
              body: JSON.stringify({
                model: "google/gemini-3.1-flash-image",
                modalities: ["image", "text"],
                //  ⚠️ Il tetto c'è sempre: senza, il credito viene impegnato per
                //   l'intera risposta possibile del modello e la chiamata viene
                //   rifiutata per fondi insufficienti pur avendone.
                max_tokens: 8000,
                messages: [{
                  role: "user",
                  content: [{
                    type: "text",
                    text: testoCampione(colore.nome, colore.campione, colore.inglese, colore.grigi ?? 0),
                  }],
                }],
              }),
            });
            const j = (await r.json()) as {
              choices?: { message?: { content?: unknown; images?: { image_url?: { url?: string } }[] } }[];
              error?: { message?: string };
            };
            if (!r.ok) {
              ultimo = String(j.error?.message || `il modello ha risposto ${r.status}`);
              //  ⚠️ Un rifiuto del servizio non si riprova: se manca il credito
              //   o la chiave è sbagliata, riprovare tre volte non cambia
              //   niente e fa solo aspettare.
              if (r.status === 401 || r.status === 402 || r.status === 403) break;
              continue;
            }
            const dataUrl = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (!dataUrl) {
              const c = j.choices?.[0]?.message?.content;
              const detto = (typeof c === "string"
                ? c
                : Array.isArray(c) ? c.map((p) => (p as { text?: string })?.text || "").join(" ") : "").trim();
              ultimo = detto
                ? `il modello ha risposto a parole invece che con un'immagine: ${detto.slice(0, 300)}`
                : "il modello non ha restituito nessuna immagine";
              continue;
            }
            const url = await salvaImmagine(`colore-${colore.codice.toLowerCase()}`, dataUrl);
            return json({ ok: true, url, campioni: await salvaCampione(colore.codice, url) });
          } catch (e) {
            ultimo = String((e as Error).message || e);
          }
        }
        return json({ ok: false, errore: ultimo || "non sono riuscito a generare il campione" }, 502);
      },
    },
  },
});
