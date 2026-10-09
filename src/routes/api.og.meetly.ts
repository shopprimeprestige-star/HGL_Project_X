/** IMMAGINE DELL'ANTEPRIMA per il link Meetly.
 *  I programmi di messaggistica leggono un indirizzo FISSO: qui si rimanda al
 *  logo configurato nelle impostazioni (così l'anteprima segue il tuo marchio
 *  senza dover ripubblicare nulla) e, se non c'è, all'immagine predefinita.
 *
 *  Lo stesso identico servizio risponde anche sul vecchio /api/og/videochiamata
 *  (vedi api.og.videochiamata.ts): le anteprime già in cache nei server di
 *  WhatsApp e soci puntano ancora lì, e un'immagine che sparisce fa sembrare
 *  rotto un link che invece funziona.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FALLBACK =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/073e92a2-8a3f-4be9-9805-351b4751525f/id-preview-0687c2ec--c583be61-dd9d-42c3-b531-84e516151c25.lovable.app-1776445156753.png";

/** Riusata anche dalla rotta storica: una sola immagine, un solo punto di verità. */
export async function immagineAnteprimaMeetly(): Promise<Response> {
  let url = FALLBACK;
  try {
    const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "brand_logo_url").maybeSingle();
    const v = (data as { value?: string | null } | null)?.value;
    if (v && /^https?:\/\//i.test(v)) url = v;
  } catch { /* si usa l'immagine predefinita */ }
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "public, max-age=600" },
  });
}

export const Route = createFileRoute("/api/og/meetly")({
  server: {
    handlers: {
      GET: async () => immagineAnteprimaMeetly(),
    },
  },
});
