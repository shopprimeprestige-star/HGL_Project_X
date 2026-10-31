/** ─────────────────────────────────────────────────────────────────────────
 *  AZIONI SUI MEDIA DEL PONTE WHATSAPP: «MOSTRA», TIMER, «LIBERA»
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T3 (PIANO c.3, c2, d.3).
 *  POST con
 *    { azione: "richiedi", chiave, timer? }          → { ok:true, esito: "in_attesa" | "gia_pronta" }
 *    { azione: "timer", chiave, timer }               → { ok:true, stato: "pronta", scade_il } | { ok:true, stato: "richiesta" }
 *    { azione: "libera", chiave }                     → { ok:true, liberati, byte, restano, non_riusciti }
 *    { azione: "libera", chiavi | numero | tutto:true } (stessa risposta; il pannello ripete finché restano = 0)
 *  con `timer` = "tieni" | 300 | 3600 | 86400 | 604800 | 2592000, oppure
 *  { ok:false, motivo } con lo stato HTTP del motivo (400, 403, 404, 409, 413, 500, 503).
 *  La logica sta in `crm/ponte/media-azioni.ts` (provata con porte finte); i file li
 *  carica il Mac, qui si chiede e si cancella soltanto.
 *
 *  ⚠️ Con `supabaseAdmin` la RLS non vale: la rotta verifica la sessione
 *   (`guardiaCRM`) e che l'installazione della sessione sia quella del database
 *   (`gestisciAzione`, 403 altrimenti).
 *  ⚠️ Chi può: `richiedi`, `timer` e `libera` di UNA chiave = chiunque sia entrato nel CRM
 *   (`guardiaCRM(request, cors, null)`, come la chat). `libera` con `chiavi`, `numero` o
 *   `tutto` chiede il permesso «impostazioni» (403 `permesso`): cancellare di massa è distruttivo.
 *  ⚠️ Il percorso da togliere da Storage viene solo dal database, mai dal browser.
 *  ⚠️ `Cache-Control: no-store` sempre. Nei log solo codici e contatori.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { leggiCorpoLimitato } from "@/crm/manychat/ritorno";
import { gestisciAzione } from "@/crm/ponte/media-azioni";
import { CORPO_AZIONE_MAX_BYTE } from "@/crm/ponte/media-azioni-tipi";
import { porteMediaAzioni } from "@/crm/ponte/media-azioni.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/crm/ponte-media-azione")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, null);
        if (!g.ok) return g.risposta;

        const letto = await leggiCorpoLimitato(request.body, CORPO_AZIONE_MAX_BYTE);
        if (letto.troppoGrande) return json({ ok: false, motivo: "corpo_troppo_grande" }, 413);
        let corpo: unknown;
        try {
          corpo = JSON.parse(letto.testo);
        } catch {
          corpo = null;
        }

        const r = await gestisciAzione(porteMediaAzioni(), {
          adminUserId: g.chi.adminUserId,
          corpo,
          //  Lo stesso controllo di `guardiaCRM(…, "impostazioni")`, ma solo per le liberazioni di massa.
          puoImpostazioni: g.chi.accesso.puo("impostazioni"),
        });
        return json(r.corpo, r.stato);
      },
    },
  },
});
