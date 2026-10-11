/** ── LA PORTA DI AIOS: SOLO BOZZE ───────────────────────────────────────────
 *
 *  AIOS (il sistema dei contenuti sul Mac del titolare) scrive gli articoli e
 *  li manda qui. Diventano BOZZE nel CRM, e basta: pubblicare è un clic di
 *  una persona nella pagina Blog del CRM (api/crm/blog).
 *
 *  ⚠️ UN SEGRETO SOLO PER QUESTO. `BLOG_AIOS_TOKEN` vive nei segreti del
 *   worker e nel file .env di Reel Studio, da nessun'altra parte. Non apre il
 *   CRM e non legge niente: se finisse in mani sbagliate permetterebbe solo di
 *   aggiungere bozze, che nessuno pubblica senza leggerle. Se manca, la porta
 *   è chiusa.
 *
 *  ⚠️ UN ARTICOLO GIÀ ONLINE NON SI SOVRASCRIVE DA QUI: si corregge dal CRM,
 *   dove chi lo cambia lo vede. Una bozza con lo stesso indirizzo invece si
 *   aggiorna, così AIOS può rimandare la versione corretta. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { articoloDaRiga, controllaArticolo, type Faq, type RigaArticolo } from "@/seo/regole";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Confronto a tempo costante: la risposta non deve dire quanti caratteri del segreto erano giusti. */
function stessoSegreto(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const testo = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

type Q = {
  select: (c: string) => Q;
  insert: (v: Record<string, unknown>) => Q;
  update: (v: Record<string, unknown>) => Q;
  eq: (k: string, v: string) => Q;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
};
const tabella = () => (supabaseAdmin as unknown as { from: (t: string) => Q }).from("blog_articoli");

export const Route = createFileRoute("/api/blog/bozza")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segreto = process.env.BLOG_AIOS_TOKEN || "";
        if (!segreto) return json({ ok: false, reason: "Porta chiusa: BLOG_AIOS_TOKEN non è impostato sul server." }, 503);
        const dato = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (!stessoSegreto(dato, segreto)) return json({ ok: false, reason: "Non autorizzato." }, 401);

        let b: Record<string, unknown> = {};
        try {
          const grezzo = await request.json();
          if (grezzo && typeof grezzo === "object") b = grezzo as Record<string, unknown>;
        } catch {
          return json({ ok: false, reason: "JSON illeggibile." }, 400);
        }

        const faq: Faq[] = Array.isArray(b.faq)
          ? (b.faq as unknown[]).slice(0, 12).map((f) => {
              const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
              return { domanda: testo(o.domanda, 300), risposta: testo(o.risposta, 2000) };
            })
          : [];
        const campi = {
          slug: testo(b.slug, 80),
          titolo: testo(b.titolo, 200),
          descrizione: testo(b.descrizione, 400),
          corpo: testo(b.corpo, 60000),
          parola_chiave: testo(b.parolaChiave ?? b.parola_chiave, 120),
          autore: testo(b.autore, 120) || "Hair Genius Labs",
          faq,
          immagine: testo(b.immagine, 500) || null,
          note: testo(b.note, 5000) || null,
        };
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(campi.slug)) return json({ ok: false, reason: "slug non valido: solo minuscole, numeri e trattini." }, 400);
        if (!campi.titolo.trim()) return json({ ok: false, reason: "Manca il titolo." }, 400);

        const { data: esistente, error: errLettura } = await tabella().select("id, stato").eq("slug", campi.slug).maybeSingle();
        if (errLettura) return json({ ok: false, reason: errLettura.message }, 500);
        const prima = esistente as { id: string; stato: string } | null;
        if (prima && prima.stato !== "bozza") {
          return json({ ok: false, reason: `C'è già un articolo «${prima.stato}» con questo indirizzo: si corregge dal CRM.` }, 409);
        }

        const adesso = new Date().toISOString();
        const esito = prima
          ? await tabella().update({ ...campi, aggiornato_il: adesso }).eq("id", prima.id).select("id").single()
          : await tabella().insert({ ...campi, stato: "bozza", fonte: "aios", aggiornato_il: adesso }).select("id").single();
        if (esito.error) return json({ ok: false, reason: esito.error.message }, 500);

        const problemi = controllaArticolo(articoloDaRiga({ ...campi, stato: "bozza" } as unknown as RigaArticolo));
        return json({ ok: true, id: (esito.data as { id: string }).id, aggiornata: !!prima, problemi });
      },
    },
  },
});
