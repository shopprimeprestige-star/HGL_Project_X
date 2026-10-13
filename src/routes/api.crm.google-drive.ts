/** ── COLLEGARE GOOGLE DRIVE (Impostazioni → Meetly) ─────────────────────────
 *
 *  GET                              → { ok, chiavi, collegato, email, ritorno }
 *  POST { clientId, clientSecret }  → salva le chiavi (un campo vuoto = «non
 *                                     l'ho toccato») e restituisce { url }: la
 *                                     pagina di Google dove si dà il permesso
 *  DELETE                           → scollega (le chiavi restano)
 *
 *  Il resto del giro sta in api.google-drive.callback: Google rimanda lì con
 *  il codice, e lì si prende il permesso lungo e si crea la cartella.
 *
 *  ⚠️ IL SEGRETO NON TORNA MAI INDIETRO: il pannello sa solo se c'è.
 *  ⚠️ UN «STATO» A USO SINGOLO: il ritorno da Google è accettato solo se porta
 *   il numero generato qui, entro dieci minuti. Senza, chiunque potrebbe
 *   collegare il SUO Drive alle registrazioni dello studio.
 */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import {
  AMBITO,
  CHIAVE_SEGRETO,
  CHIAVE_STATO,
  CHIAVE_TOKEN,
  indirizzoRitorno,
  leggiCollegamento,
  leggiSegreto,
  scrivi,
  togli,
} from "@/shop/google-drive.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CRM-Sessione, X-Consulente",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/crm/google-drive")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        const s = await leggiSegreto();
        const c = await leggiCollegamento();
        return json({
          ok: true,
          clientId: s?.clientId ?? "",
          chiavi: !!s,
          collegato: !!c,
          email: c?.email ?? "",
          ritorno: indirizzoRitorno(new URL(request.url).origin),
        });
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        let b: { clientId?: unknown; clientSecret?: unknown } = {};
        try {
          const grezzo = await request.json();
          if (grezzo && typeof grezzo === "object") b = grezzo as typeof b;
        } catch { /* corpo vuoto: si usano le chiavi già salvate */ }
        const prima = await leggiSegreto();
        const clientId = String(b.clientId ?? "").trim() || prima?.clientId || "";
        const clientSecret = String(b.clientSecret ?? "").trim() || prima?.clientSecret || "";
        if (!clientId || !clientSecret) return json({ ok: false, reason: "Servono ID client e Client secret" }, 400);
        await scrivi(CHIAVE_SEGRETO, { clientId, clientSecret });

        const stato = crypto.randomUUID();
        await scrivi(CHIAVE_STATO, { stato, scade: Date.now() + 10 * 60_000 });
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", indirizzoRitorno(new URL(request.url).origin));
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", `${AMBITO} openid email`);
        url.searchParams.set("access_type", "offline");
        //  `consent` ogni volta: è l'unico modo per avere di nuovo il permesso
        //  lungo se lo si era già dato una volta.
        url.searchParams.set("prompt", "consent");
        url.searchParams.set("state", stato);
        return json({ ok: true, url: url.toString() });
      },

      DELETE: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        await togli(CHIAVE_TOKEN);
        return json({ ok: true });
      },
    },
  },
});
