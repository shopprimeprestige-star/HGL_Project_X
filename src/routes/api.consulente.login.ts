/** ACCESSO CONSULENTE CON PIN ───────────────────────────────────────────────
 *  Il consulente non ha un account Supabase: entra con un PIN che l'admin gli
 *  assegna dalla pagina consulenti. Il PIN però non può viaggiare a ogni
 *  richiesta — resterebbe scritto in chiaro nel localStorage e in ogni riga di
 *  log — quindi vale una volta sola, all'ingresso, e in cambio si riceve un
 *  token di sessione usa-e-getta.
 *
 *  POST { email? | nome?, pin }  -> { ok, consultantId, nome, token, permessi }
 *  GET  ?token=...               -> { ok, consultantId, nome, permessi }
 *  DELETE ?token=...             -> chiude la sessione (usato da esci())
 *
 *  Il token è una stringa casuale salvata in app_config alla chiave
 *  'csess:<token>'. app_config non ha scadenze automatiche, quindi la vita
 *  della sessione (12 ore) si controlla a ogni verifica e la riga scaduta
 *  viene cancellata lì.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type ConsultantPermissions } from "@/crm/types";
//  Gli stessi permessi del CRM, risolti dallo stesso posto (livello + deroghe):
//  l'area mobile e il CRM sono due schermate della stessa persona, e devono
//  rispondere allo stesso modo a «può cancellare?».
import { risolviAccesso } from "@/crm/permessi";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const PREFISSO = "csess:";
const DURATA_MS = 12 * 60 * 60 * 1000;

/** Oltre a consultantId serviva anche l'admin proprietario dei dati: senza,
 *  ogni azione successiva dovrebbe cercare il lead in tutto il database invece
 *  che fra quelli del suo studio. Resta sul server, non esce mai in risposta. */
interface Sessione {
  consultantId: string;
  adminUserId: string;
  at: string;
}

/** Il token finisce dentro la chiave di app_config: accettarlo come arriva
 *  significherebbe farsi scrivere chiavi arbitrarie (o pattern `like`) da fuori.
 *  Qui è esadecimale e basta — tutto il resto è rifiutato prima di toccare il DB. */
const tokenPulito = (v: unknown): string => {
  const t = String(v ?? "").trim().toLowerCase();
  return /^[a-f0-9]{32,128}$/.test(t) ? t : "";
};

function nuovoToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

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

/** Il PIN viene ricontrollato ANCHE a sessione già aperta: se l'admin lo
 *  disattiva, l'accesso deve cadere entro pochi secondi e non fra dodici ore. */
async function consulenteDiSessione(s: Sessione): Promise<{ nome: string; permessi: ConsultantPermissions } | null> {
  const { data: pins } = await supabaseAdmin
    .from("consultant_pins")
    .select("permissions, admin_user_id")
    .eq("consultant_id", s.consultantId)
    .eq("active", true)
    .limit(1);
  const pin = pins?.[0];
  if (!pin) return null;

  const { data: righe } = await supabaseAdmin
    .from("crm_consultants")
    .select("data")
    .eq("id", s.consultantId)
    .eq("user_id", s.adminUserId || pin.admin_user_id)
    .limit(1);
  const d = (righe?.[0]?.data ?? null) as { nome?: string; attivo?: boolean } | null;
  if (!d || d.attivo === false) return null;

  return {
    nome: String(d.nome ?? "").trim(),
    //  ⚠️ Coi dati del consulente, non solo con la riga del PIN: i MESTIERI
    //  stanno lì dentro e da oggi decidono metà dei permessi (crm/permessi.ts).
    //  Senza, chi fa il consulente si ritroverebbe in quest'area senza il
    //  pagamento — cioè con meno di quello che vede nel CRM, e senza che niente
    //  lo spieghi.
    permessi: risolviAccesso(pin.permissions, d).legacy,
  };
}

export const Route = createFileRoute("/api/consulente/login")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const s = await leggiSessione(new URL(request.url).searchParams.get("token"));
        if (!s) return json({ ok: false, reason: "sessione scaduta" });
        const c = await consulenteDiSessione(s);
        if (!c) return json({ ok: false, reason: "accesso revocato" });
        return json({ ok: true, consultantId: s.consultantId, nome: c.nome, permessi: c.permessi });
      },

      POST: async ({ request }) => {
        let b: { email?: string; nome?: string; pin?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo illeggibile = credenziali mancanti */ }

        const pin = String(b.pin ?? "").trim();
        if (!pin) return json({ ok: false, reason: "PIN mancante" });

        // La tabella consultant_pins conserva il PIN in chiaro (colonna `pin`,
        // nessun hash): il confronto è quindi diretto, ma il valore non compare
        // mai nella risposta — fuori esce solo il token.
        const { data: pins } = await supabaseAdmin
          .from("consultant_pins")
          .select("consultant_id, admin_user_id, permissions")
          .eq("pin", pin)
          .eq("active", true)
          .limit(1);
        const riga = pins?.[0];
        // Motivo volutamente generico: dire "PIN giusto ma consulente sbagliato"
        // trasformerebbe la risposta in uno strumento per indovinare i PIN.
        if (!riga) return json({ ok: false, reason: "credenziali non valide" });

        const { data: righe } = await supabaseAdmin
          .from("crm_consultants")
          .select("id, data")
          .eq("id", riga.consultant_id)
          .eq("user_id", riga.admin_user_id)
          .limit(1);
        const consulente = righe?.[0];
        if (!consulente) return json({ ok: false, reason: "credenziali non valide" });

        const d = (consulente.data ?? {}) as { nome?: string; email?: string; attivo?: boolean };
        if (d.attivo === false) return json({ ok: false, reason: "accesso non attivo" });

        // Email/nome sono una conferma, non la credenziale: se chi entra li
        // indica devono essere i suoi, così un PIN digitato per sbaglio nella
        // schermata di un collega non apre la sessione sbagliata.
        const dichiarato = String(b.email ?? b.nome ?? "").trim().toLowerCase();
        if (dichiarato) {
          const suoi = [d.email, d.nome].map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean);
          if (!suoi.includes(dichiarato)) return json({ ok: false, reason: "credenziali non valide" });
        }

        const token = nuovoToken();
        const sessione: Sessione = { consultantId: consulente.id, adminUserId: riga.admin_user_id, at: new Date().toISOString() };
        await supabaseAdmin.from("app_config").upsert(
          { key: PREFISSO + token, value: JSON.stringify(sessione), updated_at: new Date().toISOString() } as never,
          { onConflict: "key" },
        );

        return json({
          ok: true,
          consultantId: consulente.id,
          nome: String(d.nome ?? "").trim(),
          token,
          //  Con i dati del consulente, come nel controllo a sessione aperta
          //  qui sopra: i mestieri sono metà del permesso.
          permessi: risolviAccesso(riga.permissions, consulente.data).legacy,
        });
      },

      DELETE: async ({ request }) => {
        const token = tokenPulito(new URL(request.url).searchParams.get("token"));
        if (token) await supabaseAdmin.from("app_config").delete().eq("key", PREFISSO + token);
        return json({ ok: true });
      },
    },
  },
});
