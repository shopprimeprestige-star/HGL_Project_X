/** ── DATI PER LA FATTURA DOPO L'ACCONTO: INTERRUTTORE E DOCUMENTI ───────────
 *
 *  GET                → { config, testoModello }   (permesso «impostazioni»)
 *  POST { acceso?, modelloApprovato? } → accende/spegne (permesso «impostazioni»);
 *       accendere da spento = `avvio: "da_fare"`: le schede che hanno GIÀ un acconto
 *       non ricevono niente (diventano «preesistenti» al primo giro).
 *  GET ?lead=<id>     → { file: [{ url }] }  indirizzi FIRMATI (60 s) delle foto ricevute
 *       per quella scheda (permesso «pagamenti», lo stesso delle fatture). Il bucket è
 *       privato: nessun indirizzo pubblico, e si firmano solo i file elencati sulla scheda.
 *  ⚠️ Nei log niente: né id né percorsi.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";
import {
  BUCKET_DATI_FATTURA,
  leggiConfigDatiFattura,
  scriviConfigDatiFattura,
} from "@/crm/fatture/dati-fattura.server";
import { findMetaTemplate } from "@/crm/wa-meta-templates";
import { NOME_MODELLO_DATI_FATTURA } from "@/crm/fatture/dati-fattura";

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

export const Route = createFileRoute("/api/crm/dati-fattura")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const lead = new URL(request.url).searchParams.get("lead");
        if (lead) {
          const g = await guardiaCRM(request, cors, "pagamenti");
          if (!g.ok) return g.risposta;
          if (!g.chi.adminUserId) return json({ ok: false, error: "titolare" }, 403);
          const { data } = await (supabaseAdmin as never as { from: (t: string) => any }) // eslint-disable-line @typescript-eslint/no-explicit-any
            .from("crm_leads")
            .select("data")
            .eq("id", lead)
            .eq("user_id", g.chi.adminUserId)
            .maybeSingle();
          const elenco: string[] = data?.data?.datiFattura?.file ?? [];
          const file: { url: string }[] = [];
          for (const percorso of elenco.slice(0, 6)) {
            const { data: f } = await supabaseAdmin.storage
              .from(BUCKET_DATI_FATTURA)
              .createSignedUrl(percorso, 60);
            if (f?.signedUrl) file.push({ url: f.signedUrl });
          }
          return json({ ok: true, file });
        }
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        return json({
          ok: true,
          config: await leggiConfigDatiFattura(),
          modello: {
            nome: NOME_MODELLO_DATI_FATTURA,
            categoria: findMetaTemplate(NOME_MODELLO_DATI_FATTURA)?.category,
            testo: findMetaTemplate(NOME_MODELLO_DATI_FATTURA)?.body,
          },
        });
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        let b: { acceso?: unknown; modelloApprovato?: unknown } = {};
        try {
          b = (await request.json()) as typeof b;
        } catch {
          return json({ ok: false, error: "corpo" }, 400);
        }
        const prima = await leggiConfigDatiFattura();
        const dopo = { ...prima };
        if (typeof b.modelloApprovato === "boolean") dopo.modelloApprovato = b.modelloApprovato;
        if (typeof b.acceso === "boolean") {
          dopo.acceso = b.acceso;
          //  Da spento ad acceso: chi ha già un acconto non riceve niente.
          if (b.acceso && !prima.acceso) dopo.avvio = "da_fare";
        }
        await scriviConfigDatiFattura(dopo);
        return json({ ok: true, config: dopo });
      },
    },
  },
});
