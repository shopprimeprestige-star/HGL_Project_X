/** Codici sconto per il configuratore di preventivo.
 *  GET                 -> elenco codici automatici attivi (applicati da soli, sommabili al manuale)
 *  POST { code }       -> valida un codice manuale
 *  Usa il service role (bypassa RLS); non espone l'elenco completo dei codici manuali.
 */
import { createFileRoute } from "@tanstack/react-router";
import { BASE_GARANZIE, BASE_PROMO, BASE_PROPRIETARI, BASE_QUANTITA, codiciVisibili } from "@/shop/ambito-listino";
import { consulenteDellaSessione, grezzoAmbito } from "@/crm/listino-di-chi.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
//  La garanzia decisa codice per codice: vive in `app_config` e viaggia
//  insieme ai codici, perché è il configuratore a doverla disegnare.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown) =>
  new Response(JSON.stringify(o), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const FIELDS =
  "code,label,discount_eur,stock_total,stock_left,active,auto_apply,apply_message,scarcity_title,scarcity_text";

interface Row {
  code: string;
  label: string | null;
  discount_eur: number;
  stock_total: number | null;
  stock_left: number | null;
  active: boolean;
  auto_apply: boolean;
  apply_message: string | null;
  scarcity_title: string | null;
  scarcity_text: string | null;
}

const shape = (r: Row) => ({
  code: r.code,
  label: r.label,
  discount_eur: Number(r.discount_eur) || 0,
  stock_total: r.stock_total,
  stock_left: r.stock_left,
  apply_message: r.apply_message,
  scarcity_title: r.scarcity_title,
  scarcity_text: r.scarcity_text,
});

/*  ── ⚠️ GLI SCONTI SONO QUELLI DI CHI CONDUCE LA CONSULENZA ───────────────
    Richiesta del committente: «gli altri consulenti hanno le loro modifiche —
    codici sconto, listino, eccetera».
    Il cliente non sa chi è il suo consulente: sa il codice della sua stanza,
    che è nell'indirizzo (?sess=). La traduzione da codice a consulente la fa
    il server. Senza codice — o con una consulenza non ancora avviata — valgono
    gli sconti di casa, che è come ha sempre funzionato.
    ⚠️ Un codice di un ALTRO consulente non si applica: battuto a mano
     risponde «non valido», esattamente come un codice inventato. Se si
     applicasse, un cliente potrebbe portarsi a casa lo sconto che un collega
     ha creato per un'altra trattativa. */
const consulenteDi = async (request: Request) =>
  consulenteDellaSessione(new URL(request.url).searchParams.get("sess"));

/** Di chi è ogni codice: la riga condivisa `coupons_owner`. Un codice che non
 *  compare è di casa, e resta di tutti — che è quello che sono oggi tutti i
 *  codici già creati. */
async function proprietariCodici(): Promise<Record<string, string>> {
  try {
    return (JSON.parse((await grezzoAmbito(BASE_PROPRIETARI, "")).valore ?? "{}") as Record<string, string>) || {};
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/api/public/validate-discount")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      // codici automatici (si applicano da soli) + sconti per quantità
      GET: async ({ request }) => {
        const chi = await consulenteDi(request);
        const { data } = await supabaseAdmin
          .from("discount_codes")
          .select(FIELDS)
          .eq("active", true)
          .eq("auto_apply", true);
        const proprietari = await proprietariCodici();
        const rows = codiciVisibili(
          ((data as Row[] | null) ?? []).filter((r) => r.stock_left === null || r.stock_left > 0),
          proprietari,
          chi,
        );
        let qtyDiscounts: Record<string, number> = {};
        try {
          qtyDiscounts = JSON.parse((await grezzoAmbito(BASE_QUANTITA, chi)).valore ?? "{}") || {};
        } catch {
          /* vuoto */
        }
        // durata delle promozioni, in giorni utili: impostata dal presentatore
        const promoDays = Number((await grezzoAmbito(BASE_PROMO, chi)).valore) || 0;
        //  ⚠️ LA MAPPA VIAGGIA INTERA, non solo la parte dei codici automatici:
        //   il configuratore applica anche codici battuti a mano, e chiederne la
        //   garanzia una per una vorrebbe dire una richiesta per ogni codice
        //   mentre il cliente guarda lo schermo. È un oggetto di poche righe.
        //  ⚠️ Il cast è il solito di questo repo: i tipi generati non conoscono
        //   `app_config`. Confinato qui invece di lasciare due errori di
        //   compilazione a chi legge il file.
        const garanzie = (await grezzoAmbito(BASE_GARANZIE, chi)).valore ?? "";
        return json({ codes: rows.map(shape), qtyDiscounts, promoDays, garanzie });
      },

      POST: async ({ request }) => {
        const chi = await consulenteDi(request);
        let code = "";
        try {
          code = ((await request.json()) as { code?: string }).code?.trim() ?? "";
        } catch {
          /* ignore */
        }
        if (!code) return json({ valid: false, reason: "empty" });

        const { data } = await supabaseAdmin
          .from("discount_codes")
          .select(FIELDS)
          .ilike("code", code)
          .maybeSingle();
        const row = data as Row | null;
        if (!row || !row.active) return json({ valid: false, reason: "not_found" });
        //  ⚠️ Il codice di un altro consulente non esiste, per questo cliente.
        //   La risposta è la stessa di un codice inventato: dire «è di un
        //   altro» racconterebbe a chi prova codici a caso che quel codice c'è.
        if (!codiciVisibili([row], await proprietariCodici(), chi).length)
          return json({ valid: false, reason: "not_found" });
        if (row.stock_left !== null && row.stock_left <= 0)
          return json({ valid: false, reason: "sold_out", label: row.label });
        return json({ valid: true, ...shape(row) });
      },
    },
  },
});
