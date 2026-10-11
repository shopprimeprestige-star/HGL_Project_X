/** ── IL BLOG DAL CRM: LEGGERE, CORREGGERE, PUBBLICARE, RITIRARE ─────────────
 *
 *  È l'unico posto da cui un articolo diventa pubblico. AIOS carica bozze
 *  (api/blog/bozza); qui una persona del CRM le legge, le corregge e preme
 *  «Pubblica».
 *
 *  ⚠️ IL CONTROLLO SI RIFÀ SUL SERVER. Il CRM mostra già i problemi, ma la
 *   pubblicazione passa solo se `controllaArticolo` qui risponde «niente»:
 *   niente prezzi, niente segnaposto, titolo e descrizione nelle misure giuste.
 *   Un browser vecchio o una chiamata a mano non possono saltarlo.
 *
 *  La guardia è «marketing», lo stesso permesso delle landing page: chi decide
 *  cosa dice il sito al pubblico. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";
import { articoloDaRiga, controllaArticolo, type RigaArticolo } from "@/seo/regole";

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

/** La tabella non è ancora nei tipi generati di Supabase: si passa da qui. */
type Q = {
  select: (c: string) => Q;
  update: (v: Record<string, unknown>) => Q;
  delete: () => Q;
  eq: (k: string, v: string) => Q;
  in: (k: string, v: string[]) => Q;
  order: (k: string, o: { ascending: boolean }) => Q;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  then: Promise<{ data: unknown; error: { message: string } | null }>["then"];
};
const tabella = () => (supabaseAdmin as unknown as { from: (t: string) => Q }).from("blog_articoli");

const CAMPI_MODIFICABILI = ["titolo", "descrizione", "corpo", "parola_chiave", "autore", "faq", "immagine", "note", "slug"] as const;

export const Route = createFileRoute("/api/crm/blog")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "marketing");
        if (!g.ok) return g.risposta;
        const { data, error } = await tabella().select("*").order("aggiornato_il", { ascending: false });
        if (error) return json({ ok: false, reason: `Tabella del blog non raggiungibile: ${error.message}` }, 500);
        const articoli = ((data ?? []) as RigaArticolo[]).map((r) => ({ ...r, problemi: controllaArticolo(articoloDaRiga(r)) }));
        return json({ ok: true, articoli });
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "marketing");
        if (!g.ok) return g.risposta;

        let b: { azione?: unknown; id?: unknown; campi?: unknown } = {};
        try {
          const grezzo = await request.json();
          if (grezzo && typeof grezzo === "object") b = grezzo as typeof b;
        } catch {
          return json({ ok: false, reason: "Richiesta illeggibile: riprova." }, 400);
        }
        const id = typeof b.id === "string" ? b.id : "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, reason: "Articolo non indicato." }, 400);

        const { data: prima, error: errLettura } = await tabella().select("*").eq("id", id).maybeSingle();
        if (errLettura) return json({ ok: false, reason: errLettura.message }, 500);
        const riga = prima as RigaArticolo | null;
        if (!riga) return json({ ok: false, reason: "Articolo non trovato: forse è stato cancellato." }, 404);
        const adesso = new Date().toISOString();

        switch (b.azione) {
          case "salva": {
            const campi = (b.campi && typeof b.campi === "object" ? b.campi : {}) as Record<string, unknown>;
            const modifica: Record<string, unknown> = {};
            for (const k of CAMPI_MODIFICABILI) if (k in campi) modifica[k] = campi[k];
            //  ⚠️ L'indirizzo di un articolo pubblicato non cambia: Google e
            //   chi l'ha condiviso hanno quello. Si ritira e se ne fa un altro.
            if ("slug" in modifica && riga.stato === "pubblicato" && modifica.slug !== riga.slug) {
              return json({ ok: false, reason: "L'indirizzo di un articolo già pubblicato non si cambia." }, 409);
            }
            const prova = articoloDaRiga({ ...riga, ...modifica } as RigaArticolo);
            //  Un articolo online resta pubblicabile anche dopo la correzione.
            if (riga.stato === "pubblicato") {
              const problemi = controllaArticolo(prova);
              if (problemi.length) return json({ ok: false, reason: "La correzione va online subito: prima sistema questi punti.", problemi }, 422);
            }
            const { error } = await tabella().update({ ...modifica, aggiornato_il: adesso }).eq("id", id);
            if (error) return json({ ok: false, reason: error.message }, 500);
            return json({ ok: true, problemi: controllaArticolo(prova) });
          }

          case "pubblica": {
            const problemi = controllaArticolo(articoloDaRiga(riga));
            if (problemi.length) return json({ ok: false, reason: "Non ancora pubblicabile.", problemi }, 422);
            const { error } = await tabella()
              .update({ stato: "pubblicato", pubblicato_il: riga.pubblicato_il || adesso, aggiornato_il: adesso })
              .eq("id", id);
            if (error) return json({ ok: false, reason: error.message }, 500);
            return json({ ok: true });
          }

          case "ritira": {
            const { error } = await tabella().update({ stato: "ritirato", aggiornato_il: adesso }).eq("id", id);
            if (error) return json({ ok: false, reason: error.message }, 500);
            return json({ ok: true });
          }

          case "elimina": {
            //  Si cancella solo ciò che non è online: un articolo pubblicato
            //  prima si ritira, così nessuno lo toglie con un clic solo.
            if (riga.stato === "pubblicato") return json({ ok: false, reason: "Prima ritiralo, poi si può cancellare." }, 409);
            const { error } = await tabella().delete().eq("id", id);
            if (error) return json({ ok: false, reason: error.message }, 500);
            return json({ ok: true });
          }

          default:
            return json({ ok: false, reason: "Azione sconosciuta." }, 400);
        }
      },
    },
  },
});
