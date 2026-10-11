import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron hook chiamato ogni minuto da pg_cron.
 * Trova tutti i meet che inizieranno tra 9 e 11 minuti, per i quali non è ancora
 * stato inviato un reminder, e segna `reminder_sent_at` (i client realtime mostreranno
 * la notifica al consulente assegnato tramite il subscribe su public_leads).
 */
export const Route = createFileRoute("/hooks/meet-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!auth) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, auth, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const now = new Date();
        // Finestra: meet che iniziano tra 9 e 11 minuti
        const min = new Date(now.getTime() + 9 * 60 * 1000);
        const max = new Date(now.getTime() + 11 * 60 * 1000);

        const isoDate = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        // Query semplice: prendiamo tutti i lead con accepted_by_consultant_id e senza reminder
        // e filtriamo in JS per evitare query SQL complesse su data+ora_slot string.
        const { data, error } = await supabase
          .from("public_leads")
          .select("id, data_slot, ora_slot, accepted_by_consultant_id, reminder_sent_at, nome, cognome")
          .not("accepted_by_consultant_id", "is", null)
          .is("reminder_sent_at", null)
          .in("data_slot", [isoDate(now), isoDate(max)]);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const toRemind: string[] = [];
        for (const row of data ?? []) {
          if (!row.data_slot || !row.ora_slot) continue;
          const [h, m] = row.ora_slot.split(":").map(Number);
          if (Number.isNaN(h) || Number.isNaN(m)) continue;
          const meetTime = new Date(row.data_slot + "T00:00:00");
          meetTime.setHours(h, m, 0, 0);
          if (meetTime >= min && meetTime <= max) toRemind.push(row.id);
        }

        if (toRemind.length > 0) {
          await supabase
            .from("public_leads")
            .update({ reminder_sent_at: new Date().toISOString() })
            .in("id", toRemind);
        }

        return new Response(
          JSON.stringify({ ok: true, reminded: toRemind.length }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
