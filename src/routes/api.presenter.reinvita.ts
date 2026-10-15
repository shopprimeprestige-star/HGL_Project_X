/** ── «INVITA DI NUOVO», LATO CONSULENTE ────────────────────────────────────
 *
 *  POST { sess, chi, code? } -> { ok, giro, link }
 *
 *  Chiude il link che la persona aveva e ne dà uno nuovo (giro casuale). Il
 *  vecchio si MARCA chiuso nel registro, non si cancella.
 *  ⚠️ DIETRO LA SESSIONE DEL PRESENTATORE: chiudere un link è una mossa del
 *   consulente. Senza sessione, 401 e nessun dato. */
import { createFileRoute } from "@tanstack/react-router";
import { INTESTAZIONI_CONSENTITE, autorizzaPresentatore, nonAutorizzato } from "./api.presenter.consultant";
import { archivioSala } from "./api.public.sala-attesa";
import { linkPerPersona } from "@/shop/chi-dal-link";
import { trattaReinvito } from "@/shop/uscita";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/presenter/reinvita")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let b: { sess?: string; chi?: string; code?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo illeggibile */ }
        const chi = await autorizzaPresentatore(request, b.code);
        if (!chi) return nonAutorizzato(cors);
        const sess = String(b.sess || "").trim();
        const r = await trattaReinvito(archivioSala, { sess, chi: String(b.chi || "") });
        if (r.status !== 200) return json(r.body, r.status);
        //  Il link è quello della stanza, sullo stesso indirizzo da cui il
        //  consulente sta lavorando.
        const stanza = `${new URL(request.url).origin}/meetly/${encodeURIComponent(sess)}`;
        console.log(`[REINVITO] link nuovo per ${String(b.chi || "").slice(0, 8)} in ${sess} da ${chi.nome}`);
        return json({ ...r.body, link: linkPerPersona(stanza, String(b.chi || ""), String(r.body.giro)) });
      },
    },
  },
});
