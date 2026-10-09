/** Upload di un media (video o foto) nella Storage di Supabase (bucket pubblico 'presenter-videos').
 *  POST multipart/form-data con campo "file" -> { ok, url }
 *  Usa il service role; crea il bucket se non esiste.
 *  Nota: passa dal Worker → tieni i file ragionevolmente piccoli.
 *
 *  ── SOLO A CHI HA L'ACCESSO ───────────────────────────────────────────────
 *  Era una porta aperta per scrivere file nello spazio pubblico dello studio:
 *  chiunque poteva caricarci qualsiasi cosa e ottenerne un indirizzo pubblico
 *  servito dal dominio del centro. Adesso serve una sessione da presentatore.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardia } from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const BUCKET = "presenter-videos";

export const Route = createFileRoute("/api/presenter/upload")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const no = await guardia(request, cors);
        if (no) return no;
        let file: File | null = null;
        try {
          const form = await request.formData();
          file = form.get("file") as File | null;
        } catch { return json({ ok: false, reason: "bad_form" }, 400); }
        if (!file) return json({ ok: false, reason: "no_file" }, 400);

        // crea il bucket pubblico se manca (idempotente)
        await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

        const safe = (file.name || "media").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
          contentType: file.type || "application/octet-stream", upsert: false,
        });
        if (error) return json({ ok: false, reason: error.message }, 500);
        const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
        return json({ ok: true, url: data.publicUrl });
      },
    },
  },
});
