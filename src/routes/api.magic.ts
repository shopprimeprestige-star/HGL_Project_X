// Magic-link login: un URL segreto unico che sostituisce le credenziali.
// Uso: /api/magic?k=<CRM_MAGIC_TOKEN>
// Verifica il token segreto, genera un magic-link Supabase per l'utente admin
// (CRM_ADMIN_EMAIL) e reindirizza a /CRM con il token_hash, dove il client
// lo scambia per una vera sessione (così l'RLS continua a funzionare).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/magic")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const provided = url.searchParams.get("k") || "";
        const secret = process.env.CRM_MAGIC_TOKEN;
        const adminEmail = process.env.CRM_ADMIN_EMAIL;

        if (!secret || !adminEmail) {
          return new Response("Magic-link non configurato (CRM_MAGIC_TOKEN / CRM_ADMIN_EMAIL).", {
            status: 500,
          });
        }
        // confronto a lunghezza costante per evitare timing attack
        if (!safeEqual(provided, secret)) {
          return new Response("Link non valido.", { status: 401 });
        }

        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: adminEmail,
        });
        if (error || !data?.properties?.hashed_token) {
          return new Response(`Errore generazione link: ${error?.message ?? "sconosciuto"}`, {
            status: 500,
          });
        }

        const tokenHash = data.properties.hashed_token;
        const redirect = `${url.origin}/CRM?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
        return new Response(null, { status: 302, headers: { Location: redirect } });
      },
    },
  },
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
