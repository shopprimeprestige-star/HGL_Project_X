/** ── IL RITORNO DA GOOGLE ───────────────────────────────────────────────────
 *  Google rimanda qui il titolare dopo che ha dato il permesso, con un codice
 *  a uso singolo. Lo si scambia col permesso lungo, si crea la cartella
 *  «Registrazioni Meetly» e si torna alle impostazioni del CRM.
 *
 *  ⚠️ Lo `state` deve essere quello generato da api.crm.google-drive (che è
 *   protetto dal login del CRM), ancora valido: lo si consuma subito, così un
 *   link ritornato due volte non vale.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CHIAVE_STATO,
  CHIAVE_TOKEN,
  creaCartella,
  indirizzoRitorno,
  leggiCollegamento,
  leggiSegreto,
  scrivi,
  togli,
} from "@/shop/google-drive.server";

const torna = (origine: string, esito: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: `${origine}/CRM/impostazioni?tab=meetly&drive=${encodeURIComponent(esito)}`, "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/google-drive/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const origine = u.origin;
        if (u.searchParams.get("error")) return torna(origine, "annullato");
        const codice = u.searchParams.get("code") || "";
        const stato = u.searchParams.get("state") || "";

        const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", CHIAVE_STATO).maybeSingle();
        let atteso: { stato?: string; scade?: number } = {};
        try { atteso = JSON.parse((data as { value?: string } | null)?.value ?? "{}"); } catch { /* niente */ }
        await togli(CHIAVE_STATO);
        if (!codice || !stato || stato !== atteso.stato || Date.now() > Number(atteso.scade || 0)) {
          return torna(origine, "scaduto");
        }

        const s = await leggiSegreto();
        if (!s) return torna(origine, "chiavi");
        const r = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: codice,
            client_id: s.clientId,
            client_secret: s.clientSecret,
            redirect_uri: indirizzoRitorno(origine),
            grant_type: "authorization_code",
          }),
        });
        const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; id_token?: string };
        const prima = await leggiCollegamento();
        const refresh = j.refresh_token || prima?.refresh_token || "";
        if (!r.ok || !j.access_token || !refresh) return torna(origine, "rifiutato");

        //  L'indirizzo dell'account, per mostrarlo nel pannello: è dentro il
        //  «biglietto» firmato da Google appena ricevuto (non serve verificarlo,
        //  arriva direttamente da Google su questo canale).
        let email = "";
        try {
          const corpo = (j.id_token || "").split(".")[1] || "";
          const testo = atob(corpo.replace(/-/g, "+").replace(/_/g, "/"));
          email = String((JSON.parse(testo) as { email?: string }).email || "");
        } catch { /* facoltativo */ }

        const folderId = (prima?.folderId) || (await creaCartella(j.access_token));
        await scrivi(CHIAVE_TOKEN, { refresh_token: refresh, folderId, email });
        return torna(origine, "collegato");
      },
    },
  },
});
