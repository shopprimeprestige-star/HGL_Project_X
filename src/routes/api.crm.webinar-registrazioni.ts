/** ── LE REGISTRAZIONI DEI WEBINAR ───────────────────────────────────────────
 *
 *  ── PERCHÉ UN ARCHIVIO PRIVATO E NON QUELLO DELLE CONSULENZE ──────────────
 *  Le registrazioni delle videoconsulenze stanno in un bucket PUBBLICO: chi ha
 *  il collegamento guarda. Per un webinar non va bene, e la differenza non è di
 *  grado ma di natura: in una consulenza c'è una persona che ha scelto di
 *  parlare con noi, in un webinar ci sono decine di persone che hanno alzato la
 *  mano, detto il proprio nome e raccontato in diretta un problema che riguarda
 *  il loro corpo. Un collegamento che gira è tutta quella gente lì.
 *  Quindi bucket privato, e per rivedere il file si chiede ogni volta un
 *  collegamento a termine.
 *
 *  ── IL FILE NON PASSA DA QUI ──────────────────────────────────────────────
 *  Un'ora di webinar sono centinaia di megabyte, molto oltre quello che un
 *  Worker accetta in una richiesta. Si dà un permesso di scrittura a termine e
 *  il browser spedisce dritto alla Storage; qui torna solo il nome del file.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const BUCKET = "webinar-registrazioni";
/** 5 GB, come per le consulenze: un webinar di due ore ci sta. */
const LIMITE_FILE = 5 * 1024 * 1024 * 1024;
/** Quanto vive un collegamento per rivedere: un'ora basta a guardarselo, e non
 *  abbastanza perché resti in giro utile in una chat dimenticata. */
const DURATA_LINK_S = 3600;
const mb = (n: number) => Math.round(n / (1024 * 1024));

interface Registrata {
  id: string;
  codice: string;
  titolo: string;
  percorso: string;
  secondi: number;
  peso: number;
  quando: string;
}

async function elenco(): Promise<Registrata[]> {
  const { data } = await supabaseAdmin
    .from("app_config").select("value").eq("key", "webinar-registrazioni").maybeSingle();
  try { return JSON.parse((data as { value?: string } | null)?.value ?? "[]") as Registrata[]; } catch { return []; }
}

async function scrivi(v: Registrata[]): Promise<void> {
  await supabaseAdmin.from("app_config").upsert(
    { key: "webinar-registrazioni", value: JSON.stringify(v.slice(0, 500)), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

async function guardia(request: Request, token?: unknown): Promise<Response | null> {
  const chi = await chiamanteCRM(request, token);
  if (!chi) return nonAutenticatoCRM(cors);
  if (!chi.accesso.puo("agenda")) return vietatoCRM(cors, "agenda");
  return null;
}

export const Route = createFileRoute("/api/crm/webinar-registrazioni")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stop = await guardia(request, url.searchParams.get("token") || undefined);
        if (stop) return stop;
        const codice = url.searchParams.get("codice") || "";
        const tutte = await elenco();
        const mie = codice ? tutte.filter((r) => r.codice === codice) : tutte;

        //  ⚠️ IL COLLEGAMENTO SI CONIA ADESSO e scade fra un'ora: se lo si
        //   salvasse insieme al resto diventerebbe un indirizzo permanente a
        //   un file privato, cioè un bucket pubblico con un passaggio in più.
        const con = await Promise.all(mie.map(async (r) => {
          const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(r.percorso, DURATA_LINK_S);
          return { ...r, url: data?.signedUrl ?? null };
        }));
        return json({ ok: true, registrazioni: con });
      },

      POST: async ({ request }) => {
        let b: Record<string, unknown> = {};
        try { b = (await request.json()) as Record<string, unknown>; } catch { /* corpo vuoto */ }
        const stop = await guardia(request, b.token);
        if (stop) return stop;
        const azione = String(b.azione || "");

        // ── IL PERMESSO DI SCRITTURA ─────────────────────────────────────
        if (azione === "permesso") {
          const pulito = String(b.nome || "webinar.webm").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
          const percorso = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${pulito}`;

          //  Il tetto per file si fissa alla CREAZIONE del bucket: quello di
          //  partenza di un progetto (spesso 50 MB) taglierebbe fuori
          //  qualunque webinar, e il rifiuto arriverebbe a caricamento finito.
          let tetto = 0;
          try {
            const { data: info } = await supabaseAdmin.storage.getBucket(BUCKET);
            if (info) tetto = Number(info.file_size_limit) || 0;
            else {
              //  ⚠️ `public: false`. È la riga che tiene le facce e le voci di
              //   chi ha parlato fuori dalla portata di chiunque abbia un
              //   indirizzo.
              const { error: e1 } = await supabaseAdmin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: LIMITE_FILE });
              if (e1) await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
              const { data: dopo } = await supabaseAdmin.storage.getBucket(BUCKET);
              tetto = Number(dopo?.file_size_limit) || 0;
            }
          } catch { /* se non riesco a leggerlo, decide la Storage */ }

          const peso = Number(b.peso) || 0;
          if (peso > 0 && tetto > 0 && peso > tetto) {
            return json({
              ok: false,
              motivo: `la registrazione pesa ${mb(peso)} MB e il limite dell'archivio è ${mb(tetto)} MB: alzalo in Supabase → Storage → ${BUCKET} → Settings`,
            }, 413);
          }

          const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(percorso);
          if (error || !data?.token) return json({ ok: false, motivo: error?.message || "permesso negato dalla Storage" }, 500);
          return json({ ok: true, bucket: BUCKET, percorso, token: data.token });
        }

        // ── È ARRIVATA ───────────────────────────────────────────────────
        if (azione === "salva") {
          const r: Registrata = {
            id: crypto.randomUUID(),
            codice: String(b.codice || ""),
            titolo: String(b.titolo || "Webinar").slice(0, 120),
            percorso: String(b.percorso || ""),
            secondi: Number(b.secondi) || 0,
            peso: Number(b.peso) || 0,
            quando: new Date().toISOString(),
          };
          if (!r.percorso) return json({ ok: false, motivo: "percorso mancante" }, 400);
          await scrivi([r, ...(await elenco())]);
          return json({ ok: true });
        }

        if (azione === "elimina") {
          const id = String(b.id || "");
          const tutte = await elenco();
          const via = tutte.find((r) => r.id === id);
          if (via) {
            //  Prima il file, poi la riga: al contrario, un errore lascerebbe
            //  un file che nessuno sa più di avere e che continua a occupare
            //  spazio per sempre.
            await supabaseAdmin.storage.from(BUCKET).remove([via.percorso]).catch(() => { /* forse già sparito */ });
            await scrivi(tutte.filter((r) => r.id !== id));
          }
          return json({ ok: true });
        }

        return json({ ok: false, motivo: "azione sconosciuta" }, 400);
      },
    },
  },
});
