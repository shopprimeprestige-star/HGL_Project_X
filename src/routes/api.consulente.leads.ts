/** I LEAD DEL CONSULENTE ─────────────────────────────────────────────────────
 *  GET ?token=...  ->  { ok, leads: [{ id, data }] }
 *
 *  Perché una rotta e non una query dal browser: il consulente entra con un PIN,
 *  non con un'utenza Supabase, quindi in pagina la chiave è quella anonima e
 *  `auth.uid()` è vuoto. Le regole di riga su crm_leads concedono la lettura solo
 *  a `auth.uid() = user_id`: una select fatta dal browser non darebbe errore,
 *  tornerebbe semplicemente zero righe, e l'area consulente sembrerebbe vuota
 *  invece che bloccata. La lettura passa quindi dal server, dove la service role
 *  key supera le regole di riga e il filtro lo imponiamo noi.
 *
 *  Il filtro è duplice ed è voluto: `user_id` isola lo studio, `consulenteId`
 *  isola la persona. Mancando il primo un consulente vedrebbe gli omonimi di
 *  altri clienti, mancando il secondo vedrebbe l'archivio dei colleghi.
 *
 *  La verifica del token è riscritta qui e non importata dalle altre due rotte
 *  consulente per lo stesso motivo spiegato in api.consulente.azione.ts: usa la
 *  service role key e non può finire in un modulo raggiungibile dal client.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const PREFISSO = "csess:";
const DURATA_MS = 12 * 60 * 60 * 1000;

interface Sessione { consultantId: string; adminUserId: string; at: string }

const tokenPulito = (v: unknown): string => {
  const t = String(v ?? "").trim().toLowerCase();
  return /^[a-f0-9]{32,128}$/.test(t) ? t : "";
};

async function leggiSessione(raw: unknown): Promise<Sessione | null> {
  const token = tokenPulito(raw);
  if (!token) return null;
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", PREFISSO + token).limit(1);
  const value = (data as { value?: string | null }[] | null)?.[0]?.value;
  if (!value) return null;
  let s: Partial<Sessione>;
  try { s = JSON.parse(value) as Partial<Sessione>; } catch { return null; }
  if (!s.consultantId || !s.at) return null;
  const nata = Date.parse(s.at);
  if (!Number.isFinite(nata) || Date.now() - nata > DURATA_MS) {
    await supabaseAdmin.from("app_config").delete().eq("key", PREFISSO + token);
    return null;
  }
  return { consultantId: s.consultantId, adminUserId: s.adminUserId ?? "", at: s.at };
}

/** Il PIN viene ricontrollato a ogni caricamento: disattivarlo dall'admin deve
 *  chiudere l'accesso subito, non alla scadenza del token. */
async function studioDi(s: Sessione): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("consultant_pins")
    .select("admin_user_id")
    .eq("consultant_id", s.consultantId)
    .eq("active", true)
    .limit(1);
  const pin = data?.[0];
  if (!pin) return null;
  return s.adminUserId || pin.admin_user_id;
}

export const Route = createFileRoute("/api/consulente/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const sessione = await leggiSessione(new URL(request.url).searchParams.get("token"));
        if (!sessione) return json({ ok: false, reason: "sessione scaduta" });
        const adminUserId = await studioDi(sessione);
        if (!adminUserId) return json({ ok: false, reason: "accesso revocato" });

        // created_at e updated_at servono davvero: le date delle KPI ricadono su
        // di loro quando il lead non porta createdAt/convertedAt dentro il jsonb,
        // ed è il caso di tutto l'archivio importato. Senza, "Lead assegnati" e
        // "Venduti" conterebbero solo i contatti creati dal CRM.
        // user_id resta fuori: è l'identificativo dello studio, al consulente non
        // serve e non ha ragione di uscire.
        const { data, error } = await supabaseAdmin
          .from("crm_leads")
          .select("id, data, created_at, updated_at")
          .eq("user_id", adminUserId)
          .eq("data->>consulenteId", sessione.consultantId)
          .order("created_at", { ascending: false });
        if (error) return json({ ok: false, reason: "lettura non riuscita" });

        // Secondo passaggio sullo stesso criterio: il filtro su `data->>consulenteId`
        // confronta testo, e un consulenteId salvato come numero o con spazi
        // farebbe passare righe che non sono di questa persona. Costa un giro di
        // array e chiude il caso.
        const righe = (data ?? []).filter(
          (r) => String((r.data as { consulenteId?: string } | null)?.consulenteId ?? "").trim() === sessione.consultantId,
        );

        return json({
          ok: true,
          leads: righe.map((r) => ({ id: r.id, data: r.data, created_at: r.created_at, updated_at: r.updated_at })),
        });
      },
    },
  },
});
