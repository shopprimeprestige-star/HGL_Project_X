/** L'ANTEPRIMA DI /soluzioni DAL CRM — un codice breve, non il token di sessione
 *  ═══════════════════════════════════════════════════════════════════════════
 *
 *  POST  (sessione del CRM)  ->  { ok: true, codice, scade } | { ok: false, reason }
 *
 *  Il CRM apre `/soluzioni?anteprima=<codice>`: la pagina si vede anche col cancello chiuso (manca il video),
 *  con al posto del video una riga a contorno tratteggiato. Mai sul sito, mai per chi non ha il codice.
 *
 *  ── PERCHÉ UN CODICE E NON LA SESSIONE ────────────────────────────────────
 *  La sessione del CRM viaggia in un'intestazione (`X-CRM-Sessione`), non in un cookie: un indirizzo che si apre da
 *  un link non può portarla. E scriverla nell'indirizzo la lascerebbe in cronologia, nei log e nel Referer.
 *  Il codice è breve (32 caratteri casuali, `crypto.getRandomValues`), vale 30 minuti ed è l'unica cosa che esce.
 *
 *  ── UN CODICE SOLO, CHIAVE UNICA ──────────────────────────────────────────
 *  Sta in `app_config` sotto `anteprima-soluzioni`. Se ce n'è uno ancora valido si riusa: titolare e collaboratore
 *  che guardano insieme non si annullano a vicenda. `app_config` non è leggibile dal pubblico: solo il server.
 *
 *  ⚠️ Nessun GET: il codice non si legge con un indirizzo. Risposta sempre `no-store`.
 *  shortcut: due richieste nello stesso istante possono scriversi sopra (vince l'ultima, la prima ha un codice che non vale
 *  più); serve una scrittura condizionale solo se capita davvero. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CHIAVE_ANTEPRIMA, codiceDaRiusare, nuovoCodice } from "@/landing/sito/soluzioni/anteprima";
import { guardiaCRM } from "./api.crm.accesso";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CRM-Sessione",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/crm/anteprima-soluzioni")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      //  Stesso permesso della pagina «Landing page» del CRM (marketing): chi la modifica può guardarla.
      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "marketing");
        if (!g.ok) return g.risposta;
        try {
          const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", CHIAVE_ANTEPRIMA).maybeSingle();
          const buono = codiceDaRiusare((data as { value?: string | null } | null)?.value, new Date());
          if (buono) return json({ ok: true, ...buono });

          const nuovo = nuovoCodice();
          const { error } = await supabaseAdmin
            .from("app_config")
            .upsert({ key: CHIAVE_ANTEPRIMA, value: JSON.stringify(nuovo), updated_at: new Date().toISOString() } as never, { onConflict: "key" });
          if (error) return json({ ok: false, reason: "scrittura" }, 500);
          return json({ ok: true, ...nuovo });
        } catch {
          return json({ ok: false, reason: "errore" }, 500);
        }
      },
    },
  },
});
