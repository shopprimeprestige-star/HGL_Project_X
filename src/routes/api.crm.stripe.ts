/** ── LO STATO DI STRIPE PER IL CRM (api.crm.stripe.ts) ────────────────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T57 (PIANO-R2 §3.5, D59). Permesso «pagamenti».
 *
 *  GET                              → { ok, collegato, modalita: "prova"|"reale"|null, ultimoWebhook: { tipo, ricevutoIl }|null }
 *                                     (NON chiama Stripe: presenza e prefisso della chiave; l'ultimo webhook viene dal database)
 *  POST { azione: "prova_adesso" }  → «Prova adesso»: UNA lettura innocua (`GET /v1/checkout/sessions?limit=1`) →
 *                                     { ok, frase, … } oppure { ok:false, motivo, frase } (409 senza chiave)
 *
 *  ⚠️ MAI la chiave né il segreto del webhook: `modalita` si ricava dal prefisso (`collega.server.ts`), le variabili si leggono dentro il
 *   gestore. La guardia è il primo `await` di ogni gestore (prima di leggere il corpo, l'ambiente o Stripe). Nessuna intestazione CORS.
 *  ⚠️ `ultimoWebhook` vede solo gli eventi che il webhook ha registrato (quelli di un'altra cosa o non nostri non si registrano). */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { provaStripe, statoStripe } from "@/shop/cassa/collega.server";
import { guardiaCRM } from "./api.crm.accesso";

const json = (o: unknown, stato: number) =>
  new Response(JSON.stringify(o), {
    status: stato,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

//  `extra`: la forma che il client si aspetta anche quando la risposta è un «no».
const guardia = (request: Request) =>
  guardiaCRM(request, {}, "pagamenti", { extra: { collegato: false, modalita: null } });
const MAX_CORPO = 2000;

export const Route = createFileRoute("/api/crm/stripe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const g = await guardia(request);
          if (!g.ok) return g.risposta;
          const stato = await statoStripe({
            db: supabaseAdmin as unknown as Parameters<typeof statoStripe>[0]["db"],
            log: (codice) => console.warn(`[stripe] ${codice}`),
          });
          return json({ ok: true, ...stato }, 200);
        } catch {
          console.warn("[stripe] eccezione");
          return json(
            {
              ok: false,
              motivo: "interno",
              frase: "Qualcosa non ha funzionato: riprova tra un momento.",
            },
            500,
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const g = await guardia(request);
          if (!g.ok) return g.risposta;
          if (Number(request.headers.get("content-length") ?? 0) > MAX_CORPO)
            return json(
              { ok: false, motivo: "troppo_grande", frase: "La richiesta è troppo grande." },
              413,
            );
          const testo = await request.text();
          let azione: unknown;
          try {
            azione = (JSON.parse(testo) as { azione?: unknown } | null)?.azione;
          } catch {
            /* corpo rotto: azione sconosciuta */
          }
          if (testo.length > MAX_CORPO || azione !== "prova_adesso")
            return json(
              { ok: false, motivo: "azione_sconosciuta", frase: "Questa azione non è prevista." },
              400,
            );
          const r = await provaStripe({ log: (codice) => console.warn(`[stripe] ${codice}`) });
          return json(r.corpo, r.stato);
        } catch {
          console.warn("[stripe] eccezione");
          return json(
            {
              ok: false,
              motivo: "interno",
              frase: "Qualcosa non ha funzionato: riprova tra un momento.",
            },
            500,
          );
        }
      },
    },
  },
});
