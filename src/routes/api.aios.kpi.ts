/** ── LA PORTA DEI NUMERI PER AIOS: SOLO LETTURA, SOLO AGGREGATI ─────────────
 *
 *  AIOS (il sistema dei contenuti sul Mac del titolare) chiede qui come vanno
 *  le campagne e i lead, per decidere cosa girare. Riceve conteggi, somme e
 *  mediane: mai un nome, un telefono, un'email, una nota, l'id di un lead.
 *  Il calcolo sta in `crm/kpi/aios-feed` (puro, provato); qui si legge il
 *  database e si controlla la chiave. Il formato è il contratto versione 1.
 *
 *  ⚠️ UN SEGRETO SOLO PER QUESTO. `AIOS_KPI_TOKEN` vive nei segreti del worker
 *   e nel file .env di Reel Studio, da nessun'altra parte. Non è quello del
 *   blog (BLOG_AIOS_TOKEN): chi scrive bozze non deve poter leggere i numeri,
 *   e viceversa. Se manca, la porta è chiusa (503).
 *
 *  ⚠️ `supabaseAdmin` SALTA LA SICUREZZA PER RIGA (RLS): ogni lettura è quindi
 *   filtrata a mano sul proprietario del CRM. Il proprietario è
 *   `AIOS_OWNER_USER_ID` se c'è, altrimenti l'unica riga di `tracking_config`:
 *   se ce n'è più d'una non si indovina, si risponde 500.
 *
 *  ⚠️ NIENTE NEL LOG: né dati dei lead né la chiave. Un errore di lettura
 *   scrive solo il nome della tabella e il messaggio del database. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AdSpending, Lead } from "@/crm/types";
import {
  costruisciFeedKpi,
  giornoRoma,
  primoGiornoNecessario,
  sommaGiorni,
  type AnnuncioPubblico,
  type RigaSpesaMeta,
  type RigaSpesaTiktok,
} from "@/crm/kpi/aios-feed";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Confronto a tempo costante: la risposta non deve dire quanti caratteri del segreto erano giusti. */
function stessoSegreto(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** PostgREST risponde al massimo 1000 righe per volta: si legge a pagine fino
 *  alla fine, altrimenti i lead oltre il millesimo sparirebbero dai conti senza
 *  nessun errore. */
const PAGINA = 1000;

type Esito<T> = { data: T[] | null; error: { message: string } | null };
type Interrogazione = {
  select: (c: string) => Interrogazione;
  eq: (k: string, v: string) => Interrogazione;
  gte: (k: string, v: string) => Interrogazione;
  in: (k: string, v: string[]) => Interrogazione;
  order: (k: string) => Interrogazione;
  range: (da: number, a: number) => PromiseLike<Esito<unknown>>;
};
const tabella = (nome: string) =>
  (supabaseAdmin as unknown as { from: (t: string) => Interrogazione }).from(nome);

class ErroreLettura extends Error {}

async function leggiTutto<T>(nome: string, costruisci: (q: Interrogazione) => Interrogazione): Promise<T[]> {
  const out: T[] = [];
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await costruisci(tabella(nome)).range(da, da + PAGINA - 1);
    if (error) {
      console.error(`[aios-kpi] lettura di ${nome} non riuscita: ${error.message}`);
      throw new ErroreLettura(nome);
    }
    const righe = (data ?? []) as T[];
    out.push(...righe);
    if (righe.length < PAGINA) return out;
  }
}

export const Route = createFileRoute("/api/aios/kpi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const segreto = process.env.AIOS_KPI_TOKEN || "";
        if (!segreto) return json({ ok: false, reason: "Porta chiusa: AIOS_KPI_TOKEN non è impostato sul server." }, 503);
        const dato = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (!stessoSegreto(dato, segreto)) return json({ ok: false, reason: "Non autorizzato." }, 401);

        // `?oggi=AAAA-MM-GG` serve alle prove: fa girare il calcolo come se fosse quel giorno.
        const richiesto = new URL(request.url).searchParams.get("oggi");
        let adesso = new Date();
        if (richiesto) {
          const valido = /^\d{4}-\d{2}-\d{2}$/.test(richiesto) && giornoRoma(`${richiesto}T12:00:00Z`) === richiesto;
          if (!valido) return json({ ok: false, reason: "oggi: serve AAAA-MM-GG." }, 400);
          adesso = new Date(`${richiesto}T12:00:00Z`);
        }
        const oggi = richiesto || giornoRoma(adesso.toISOString());

        try {
          // ── 1. DI CHI È IL CRM
          const config = await leggiTutto<{ user_id: string; daily_spend_tiktok: number | null }>("tracking_config", (q) => {
            const base = q.select("user_id, daily_spend_tiktok").order("user_id");
            return process.env.AIOS_OWNER_USER_ID ? base.eq("user_id", process.env.AIOS_OWNER_USER_ID) : base;
          });
          if (config.length > 1) return json({ ok: false, reason: "Proprietario ambiguo: imposta AIOS_OWNER_USER_ID." }, 500);
          const proprietario = process.env.AIOS_OWNER_USER_ID || config[0]?.user_id;
          if (!proprietario) return json({ ok: false, reason: "Proprietario non trovato." }, 500);

          // ── 2. LE TABELLE, SEMPRE FILTRATE SUL PROPRIETARIO
          const dal = primoGiornoNecessario(oggi);
          const [leads, aMano, spesaMeta, spesaTiktok] = await Promise.all([
            leggiTutto<Lead>("crm_leads", (q) => q.select("id, user_id, data, created_at, updated_at").eq("user_id", proprietario).order("id")),
            leggiTutto<AdSpending>("crm_ad_spending", (q) => q.select("id, user_id, data, created_at, updated_at").eq("user_id", proprietario).order("id")),
            leggiTutto<RigaSpesaMeta>("meta_ad_spend", (q) =>
              q
                .select("spend_date, ad_id, ad_name, campaign_name, spend, impressions, video_3_sec_watched, video_thruplays, fetched_at")
                .eq("user_id", proprietario)
                .gte("spend_date", dal)
                .order("id"),
            ),
            leggiTutto<RigaSpesaTiktok>("tiktok_ad_spend", (q) =>
              q
                .select("spend_date, ad_id, ad_name, campaign_name, spend, impressions, video_watched_2s, video_views_p75, fetched_at")
                .eq("user_id", proprietario)
                .gte("spend_date", dal)
                .order("id"),
            ),
          ]);

          // ── 3. L'ANNUNCIO DELLE RIGHE PUBBLICHE
          //  Solo per i lead degli ultimi 30 giorni che non hanno l'annuncio
          //  sulla scheda (quelli accettati prima che lo si copiasse). Si
          //  chiedono per id, a gruppi: l'indirizzo della richiesta ha un limite.
          const da30 = sommaGiorni(oggi, -29);
          const daCercare = [
            ...new Set(
              leads
                .filter((l) => l.data?.publicLeadId && !l.data.tracking?.ad_id && giornoRoma(l.data.createdAt) >= da30)
                .map((l) => l.data.publicLeadId as string),
            ),
          ];
          const pubblici: Record<string, AnnuncioPubblico & { id: string }> = {};
          const GRUPPO = 150;
          for (let i = 0; i < daCercare.length; i += GRUPPO * 4) {
            const gruppi = [0, 1, 2, 3]
              .map((k) => daCercare.slice(i + k * GRUPPO, i + (k + 1) * GRUPPO))
              .filter((g) => g.length);
            const righe = await Promise.all(
              gruppi.map((ids) =>
                leggiTutto<AnnuncioPubblico & { id: string }>("public_leads", (q) =>
                  q.select("id, ad_id, ad_name, creative_name").in("id", ids).order("id"),
                ),
              ),
            );
            for (const r of righe.flat()) pubblici[r.id] = { id: r.id, ad_id: r.ad_id, ad_name: r.ad_name, creative_name: r.creative_name };
          }

          const feed = costruisciFeedKpi({
            adesso,
            oggi,
            leads,
            pubblici,
            spesaMeta,
            spesaTiktok,
            aMano,
            tiktokAlGiorno: Number(config[0]?.daily_spend_tiktok) || 0,
          });
          return json(feed);
        } catch (e) {
          if (e instanceof ErroreLettura) return json({ ok: false, reason: `Lettura non riuscita: ${e.message}.` }, 500);
          console.error("[aios-kpi] errore nel calcolo");
          return json({ ok: false, reason: "Errore nel calcolo." }, 500);
        }
      },
    },
  },
});
