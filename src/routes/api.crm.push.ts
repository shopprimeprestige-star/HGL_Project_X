/** ─────────────────────────────────────────────────────────────────────────
 *  LE NOTIFICHE PUSH: ISCRIVERE E TOGLIERE UN TELEFONO (28/10/2026)
 *
 *  GET  → { chiave } la chiave pubblica VAPID (null se le notifiche dal server
 *         non sono configurate: mancano VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
 *  POST { azione: "iscrivi", iscrizione } → salva questo dispositivo.
 *  POST { azione: "togli", endpoint }     → lo toglie.
 *  POST { azione: "prova", endpoint }     → manda una notifica di prova a lui solo.
 *
 *  ⚠️ L'installazione e il nome li decide la SESSIONE (guardiaCRM), mai il corpo.
 *  ⚠️ Solo indirizzi dei servizi push veri (`iscrizioneValida`).
 *  ⚠️ La tabella non ha politiche RLS: scrive solo questa rotta, col server.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaviDaAmbiente, iscrizioneValida } from "@/crm/push/avviso";
import { inviaATutti } from "@/crm/push/invio.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

//  `push_iscrizioni` non è ancora nei tipi generati di Supabase (tabella nuova):
//  si passa dal client senza tipi, come per le altre tabelle recenti.
const tabella = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabaseAdmin as unknown as { from: (t: string) => any }).from("push_iscrizioni");

export const Route = createFileRoute("/api/crm/push")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, null);
        if (!g.ok) return g.risposta;
        const chiavi = chiaviDaAmbiente(process.env as Record<string, string | undefined>);
        return json({ chiave: chiavi?.pubblica ?? null });
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, null);
        if (!g.ok) return g.risposta;
        const userId = g.chi.adminUserId;
        if (!userId) return json({ error: "Rientra nel CRM e riprova." }, 403);
        let corpo: { azione?: unknown; iscrizione?: unknown; endpoint?: unknown };
        try {
          corpo = (await request.json()) as typeof corpo;
        } catch {
          return json({ error: "Richiesta non valida." }, 400);
        }
        try {
          if (corpo.azione === "iscrivi") {
            const i = iscrizioneValida(corpo.iscrizione);
            if (!i) return json({ error: "Iscrizione non valida." }, 400);
            //  ⚠️ Un indirizzo già di un'altra installazione non si sovrascrive
            //   (controllo automatico di sicurezza, 28/10).
            const gia = await tabella().select("user_id").eq("endpoint", i.endpoint).maybeSingle();
            if (gia.error) throw gia.error;
            if (gia.data && gia.data.user_id !== userId)
              return json({ error: "Questo dispositivo è iscritto a un altro account." }, 409);
            const { error } = await tabella().upsert(
              {
                user_id: userId,
                consulente_id: g.chi.consultantId || null,
                chi: g.chi.nome || null,
                endpoint: i.endpoint,
                p256dh: i.p256dh,
                auth: i.auth,
              },
              { onConflict: "endpoint" },
            );
            if (error) throw error;
            return json({ ok: true });
          }
          const endpoint = typeof corpo.endpoint === "string" ? corpo.endpoint : "";
          if (!endpoint) return json({ error: "Manca il dispositivo." }, 400);
          if (corpo.azione === "togli") {
            const { error } = await tabella()
              .delete()
              .eq("endpoint", endpoint)
              .eq("user_id", userId);
            if (error) throw error;
            return json({ ok: true });
          }
          if (corpo.azione === "prova") {
            const { data, error } = await tabella()
              .select("id, endpoint, p256dh, auth")
              .eq("endpoint", endpoint)
              .eq("user_id", userId);
            if (error) throw error;
            if (!data?.length) return json({ error: "Questo dispositivo non è iscritto." }, 404);
            const r = await inviaATutti(
              userId,
              {
                titolo: "Hair Genius CRM",
                corpo: "Prova riuscita: qui arriveranno i messaggi WhatsApp.",
                chiave: "prova",
                destinazione: "/CRM/notifiche",
              },
              data,
            );
            return json({ ok: r.inviate > 0 }, r.inviate > 0 ? 200 : 502);
          }
          return json({ error: "Azione sconosciuta." }, 400);
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.warn("[push]", typeof code === "string" ? code : "errore");
          return json({ error: "Il server ha avuto un problema: riprova fra poco." }, 500);
        }
      },
    },
  },
});
