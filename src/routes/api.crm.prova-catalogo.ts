/** ── IL CATALOGO, DAL GESTIONALE ───────────────────────────────────────────
 *
 *  POST { azione: "aggiungi", foto }  → legge la foto, dà un nome al taglio,
 *        lo riproduce sul nostro modello e lo mette in vetrina.
 *  POST { azione: "togli", chiave }   → lo toglie dalla vetrina.
 *
 *  ── ⚠️ PERCHÉ ESISTE ANCHE QUI E NON SOLO SULLA PAGINA ───────────────────
 *  Chi cura la vetrina è già dentro il gestionale. Mandarlo sulla pagina
 *  pubblica, fargli scrivere un codice admin e caricare la foto da lì è un
 *  giro inutile — e un giro inutile è una cosa che si smette di fare, e la
 *  vetrina non si aggiorna più.
 *
 *  ── ⚠️ E SI TOGLIE SOLO QUELLO CHE È STATO AGGIUNTO ──────────────────────
 *  I tagli scritti nel codice non si possono togliere da qui: le loro
 *  fotografie stanno dentro il sito e non si rimetterebbero senza un rilascio.
 *  Un cestino che cancella una cosa irrecuperabile è un cestino che prima o
 *  poi qualcuno preme.
 */
import { createFileRoute } from "@tanstack/react-router";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";
import { creaTaglioDaFoto } from "@/prova/crea-taglio.server";
import { catalogoIntero, confermaTaglio, nascondi, togliTaglio } from "@/prova/catalogo.server";

const PERMESSO = "impostazioni" as const;
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/crm/prova-catalogo")({
  server: {
    handlers: {
      //  L'elenco COMPLETO, compresi i nuovi da confermare e i nascosti: è la
      //  vista di chi amministra, e non passa mai dalla porta pubblica.
      GET: async ({ request }) => {
        const chi = await chiamanteCRM(request);
        if (!chi) return nonAutenticatoCRM({});
        if (!chi.accesso.puo(PERMESSO)) return vietatoCRM({}, PERMESSO);
        return json({ ok: true, tagli: await catalogoIntero(true) });
      },

      POST: async ({ request }) => {
        const chi = await chiamanteCRM(request);
        if (!chi) return nonAutenticatoCRM({});
        if (!chi.accesso.puo(PERMESSO)) return vietatoCRM({}, PERMESSO);

        let b: { azione?: string; foto?: string; chiave?: string; spento?: boolean };
        try { b = (await request.json()) as typeof b; } catch { return json({ error: "richiesta illeggibile" }, 400); }

        if (b.azione === "conferma") {
          const fatto = await confermaTaglio(String(b.chiave || ""));
          return json({ ok: !!fatto, taglio: fatto });
        }

        if (b.azione === "nascondi") {
          await nascondi(String(b.chiave || ""), b.spento !== false);
          return json({ ok: true });
        }

        if (b.azione === "togli") {
          await togliTaglio(String(b.chiave || ""));
          return json({ ok: true });
        }

        if (b.azione === "aggiungi") {
          try {
            const taglio = await creaTaglioDaFoto({
              foto: String(b.foto || ""),
              origine: new URL(request.url).origin,
              daChi: "gestionale",
            });
            return json({ ok: true, taglio });
          } catch (e) {
            return json({ ok: false, errore: String((e as Error).message || e) }, 502);
          }
        }

        return json({ error: "azione sconosciuta" }, 400);
      },
    },
  },
});
