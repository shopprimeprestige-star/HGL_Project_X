/** PERMESSO DI CARICAMENTO DIRETTO ──────────────────────────────────────────
 *  Restituisce al browser un permesso a termine per scrivere UN file nella
 *  Storage, senza passare da qui.
 *
 *  PERCHÉ ESISTE. Le registrazioni salivano attraverso questo Worker: il file
 *  veniva ricevuto intero, tenuto in memoria e poi rimandato alla Storage. Per
 *  una foto va benissimo; per una videoconsulenza di mezz'ora — decine, spesso
 *  centinaia di megabyte — il Worker supera il proprio limite di memoria e la
 *  richiesta muore a metà. Il risultato era quello osservato: la registrazione
 *  veniva fatta, ma non compariva in archivio, e nessuno diceva perché.
 *
 *  Con il permesso a termine il file va dal browser alla Storage in linea
 *  diretta: nessun limite del Worker, nessuna copia in memoria, e la velocità
 *  è quella della connessione.
 *
 *  POST { filename } -> { ok, path, token, url }
 *
 *  ── SOLO A CHI HA L'ACCESSO ───────────────────────────────────────────────
 *  Questo consegna un permesso di SCRITTURA sulla Storage: senza controllo,
 *  chiunque poteva chiederne uno e riempire lo spazio dello studio. Adesso
 *  serve una sessione da presentatore.
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
/** 5 GB: una videoconsulenza di un'ora ci sta comodamente dentro. */
const LIMITE_FILE = 5 * 1024 * 1024 * 1024;
const mb = (n: number) => Math.round(n / (1024 * 1024));

export const Route = createFileRoute("/api/presenter/upload-url")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const no = await guardia(request, cors);
        if (no) return no;
        let b: { filename?: string; size?: number } = {};
        //  Il corpo arriva dalla rete: potrebbe essere `null`, un numero, una
        //  stringa. Se non è un oggetto si riparte dai valori di riserva.
        try {
          const grezzo = await request.json();
          if (grezzo && typeof grezzo === "object") b = grezzo as typeof b;
        } catch { /* nome facoltativo */ }
        const safe = (b.filename || "registrazione.webm").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const path = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${safe}`;

        // ── IL TETTO PER FILE ─────────────────────────────────────────────
        //  Il limite si fissa ALLA CREAZIONE del bucket: quello di partenza di
        //  un progetto (spesso 50 MB) taglia fuori qualsiasi consulenza lunga,
        //  e il rifiuto arriverebbe a caricamento FINITO, con un messaggio che
        //  non dice cosa fare. Qui il bucket nasce largo, e se il file eccede
        //  comunque lo si dice PRIMA, dicendo anche dove si alza il limite.
        let tetto = 0;
        try {
          const { data: info } = await supabaseAdmin.storage.getBucket(BUCKET);
          if (info) tetto = Number(info.file_size_limit) || 0;
          else {
            // non esiste ancora: lo creo largo, e se il progetto non consente un
            // tetto così alto ripiego su quello di default (meglio del nulla).
            const { error: e1 } = await supabaseAdmin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: LIMITE_FILE });
            if (e1) await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
            const { data: dopo } = await supabaseAdmin.storage.getBucket(BUCKET);
            tetto = Number(dopo?.file_size_limit) || 0;
          }
        } catch { /* se non riesco a leggerlo, lascio decidere alla Storage */ }

        const size = Number(b.size) || 0;
        if (size > 0 && tetto > 0 && size > tetto) {
          return json({
            ok: false,
            reason: `la registrazione pesa ${mb(size)} MB e il limite dell'archivio è ${mb(tetto)} MB: alzalo in Supabase → Storage → ${BUCKET} → Settings`,
          }, 413);
        }

        const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error || !data?.token) return json({ ok: false, reason: error?.message || "no_token" }, 500);

        const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
        return json({ ok: true, bucket: BUCKET, path, token: data.token, url: pub.publicUrl });
      },
    },
  },
});
