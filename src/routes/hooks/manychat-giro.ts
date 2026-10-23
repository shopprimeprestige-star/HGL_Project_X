/** ── IL GIRO DI MANYCHAT: PROMEMORIA 25' E RICONTATTI ──────────────────────
 *
 *  POST /hooks/manychat-giro. Lo chiama pg_cron ogni minuto (migrazione
 *  `20261023120200_manychat_cron.sql`, con `programma_hook_cron_attesa`: pg_net
 *  aspetta 45 s). Le regole sono in `crm/manychat/giro.ts` e sono provate; qui
 *  c'è solo il collegamento (`porteGiro` in `porte.server.ts`).
 *
 *  ⚠️ LA CHIAVE NON PROTEGGE NIENTE, e lo diciamo: è `Bearer <chiave
 *   pubblicabile>` o `Bearer <chiave anon>` (esattamente una delle due, con gli
 *   spazi tolti), cioè una chiave pubblica. La protezione vera è altrove:
 *   - il giro non accetta MAI `prova` da una richiesta (qui è sempre `false`);
 *   - la prenotazione di ogni invio è atomica (`manychat_prenota_giro`: tetti,
 *     ritmo, pausa per contatto, STOP, chiave unica) e il lucchetto lascia
 *     girare uno solo;
 *   - chi la chiama può solo anticipare un giro che il cron farebbe comunque.
 *  La risposta ha solo conteggi: niente id, nomi, numeri.
 *  ⚠️ Nei log solo codici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { chiaveGiroValida, giroManychat } from "@/crm/manychat/giro";
import { porteGiro } from "@/crm/manychat/porte.server";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/hooks/manychat-giro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !chiaveGiroValida(
            request.headers.get("authorization"),
            process.env.SUPABASE_PUBLISHABLE_KEY,
            process.env.SUPABASE_ANON_KEY,
          )
        )
          return json({ error: "unauthorized" }, 401);
        try {
          //  Solo i conteggi: `righe` (prova a secco) qui non esce, e `prova` è sempre falso.
          const e = await giroManychat(porteGiro(), { prova: false });
          console.info(`[manychat-giro] ${e.fermo ?? "ok"}`);
          return json({
            ok: true,
            fermo: e.fermo ?? null,
            promemoriInviati: e.promemoriInviati,
            ricontattiInviati: e.ricontattiInviati,
            saltati: e.saltati,
            incerti: e.incerti,
            scadute: e.scadute,
            spento: e.spento ?? false,
          });
        } catch {
          console.error("[manychat-giro] giro interrotto");
          return json({ ok: false, fermo: "errore" });
        }
      },
    },
  },
});
