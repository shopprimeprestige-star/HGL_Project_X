/** IL LEAD E IL PREVENTIVO SONO LA STESSA PERSONA ───────────────────────────
 *  Quando in consulenza si correggono i dati del cliente — il cognome scritto
 *  male, il telefono nuovo, l'età — quella correzione deve tornare sul CRM.
 *  Altrimenti restano due verità: quella del preventivo, aggiornata, e quella
 *  della scheda, vecchia. E la seconda è quella che si guarda per richiamarlo.
 *
 *  GET  ?leadId=...  -> { ok, lead: { nome, cognome, telefono, email, eta, note } }
 *  POST { leadId, profilo?, note?, quoteRef? } -> aggiorna la scheda
 *
 *  Le note NON si sovrascrivono: si accodano con la data. Una nota presa in
 *  consulenza non deve cancellare quella presa al telefono la settimana prima.
 *
 *  ── ⚠️ DA QUI USCIVA L'ANAGRAFICA DI CHIUNQUE ────────────────────────────
 *  Bastava un identificativo di lead per leggere nome, cognome, telefono, email
 *  ed età di una persona vera, e per riscriverli. Nessuna credenziale. Adesso
 *  serve essere entrati: o nel CRM (PIN o account), o in Meetly come
 *  presentatore — la consulenza corregge i dati del cliente mentre parla con
 *  lui, quindi entrambe le porte sono legittime, ma nessuna delle due è aperta.
 *  E non basta essere entrati: senza il permesso «vedere i lead di tutti» si
 *  toccano solo le proprie schede (vedi `puoToccare`), altrimenti bastava
 *  cambiare l'identificativo per leggere l'anagrafica dei clienti dei colleghi.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";
import { accessoPresentatore, sessioneDaRichiesta } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token, x-presenter-token" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Le due porte legittime, in una domanda sola: la sessione di Meetly (si sta
 *  facendo la consulenza) oppure quella del CRM (PIN o account). Chi fa la
 *  consulenza deve poter correggere il numero di telefono sbagliato, è il suo
 *  lavoro — quello che non deve poter fare è arrivarci senza essere nessuno,
 *  e leggere la scheda di un cliente che non è suo. */
interface Chiamante {
  /** Vuoto per chi entra con email e password, o col codice consulente. */
  consultantId: string;
  /** Se vede i lead di tutti, questa rotta non gli chiede altro. */
  tutti: boolean;
}

async function chiDentro(request: Request, token?: unknown): Promise<Chiamante | null> {
  const p = await sessioneDaRichiesta(request);
  if (p) {
    const a = await accessoPresentatore(p);
    return { consultantId: p.id, tutti: a.puo("lead.tutti") };
  }
  const c = await chiamanteCRM(request, token);
  if (!c) return null;
  return { consultantId: c.consultantId, tutti: c.accesso.puo("lead.tutti") };
}

type Dati = Record<string, unknown>;

/** ── IL LEAD DI UN ALTRO NON SI LEGGE E NON SI RISCRIVE ────────────────────
 *  Qui uscivano — e si potevano riscrivere — nome, cognome, telefono ed email
 *  di QUALUNQUE scheda, per chiunque fosse entrato: bastava cambiare
 *  l'identificativo nell'indirizzo. Chi non ha «vedere i lead di tutti» tocca
 *  solo le proprie. Un lead ancora senza consulente resta accessibile: è quello
 *  che si sta assegnando, e rifiutarlo bloccherebbe la consulenza appena
 *  iniziata su un contatto arrivato adesso. */
function puoToccare(chi: Chiamante, d: Dati): boolean {
  if (chi.tutti) return true;
  const proprietario = String(d.consulenteId ?? "").trim();
  if (!proprietario) return true;
  return !!chi.consultantId && proprietario === chi.consultantId;
}

export const Route = createFileRoute("/api/crm/lead-sync")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const chi = await chiDentro(request);
        if (!chi) return nonAutenticatoCRM(cors, { lead: null });
        const id = (new URL(request.url).searchParams.get("leadId") || "").trim();
        if (!id) return json({ ok: false, reason: "leadId mancante" }, 400);
        const { data } = await supabaseAdmin.from("crm_leads").select("id,data").eq("id", id).maybeSingle();
        const r = data as { id: string; data: Dati } | null;
        if (!r) return json({ ok: false, reason: "lead non trovato" }, 404);
        const d = r.data;
        if (!puoToccare(chi, d)) return vietatoCRM(cors, "lead.tutti", { lead: null });
        return json({
          ok: true,
          lead: {
            id: r.id,
            nome: d.nome ?? "", cognome: d.cognome ?? "",
            telefono: d.telefono ?? "", email: d.email ?? "",
            eta: d.eta ?? "", problemi: d.note ?? "",
            consulenteId: d.consulenteId ?? null,
          },
        });
      },

      POST: async ({ request }) => {
        let b: { leadId?: string; profilo?: Dati; note?: string; quoteRef?: string; token?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* */ }
        const chi = await chiDentro(request, b.token);
        if (!chi) return nonAutenticatoCRM(cors);
        const id = String(b.leadId || "").trim();
        if (!id) return json({ ok: false, reason: "leadId mancante" }, 400);

        const { data } = await supabaseAdmin.from("crm_leads").select("id,data").eq("id", id).maybeSingle();
        const r = data as { id: string; data: Dati } | null;
        if (!r) return json({ ok: false, reason: "lead non trovato" }, 404);
        if (!puoToccare(chi, r.data)) return vietatoCRM(cors, "lead.tutti");

        const d: Dati = { ...r.data };
        const p = b.profilo || {};
        //  Si scrive solo ciò che è stato COMPILATO: un campo lasciato vuoto in
        //  preventivo non deve cancellare un dato che sulla scheda c'era già.
        for (const k of ["nome", "cognome", "telefono", "email"] as const) {
          const v = String((p as Dati)[k] ?? "").trim();
          if (v) d[k] = v;
        }
        const eta = Number((p as Dati).eta);
        if (Number.isFinite(eta) && eta > 0) d.eta = eta;

        if (b.quoteRef) d.quoteRef = b.quoteRef;   // la scheda sa qual è il suo preventivo

        const nuova = String(b.note ?? "").trim();
        if (nuova) {
          const quando = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
          const riga = `[${quando}] ${nuova}`;
          const prima = String(d.notePostCall ?? "").trim();
          //  Accodata, non sostituita: la storia di una trattativa è fatta di
          //  quello che è stato detto ogni volta, non solo dell'ultima volta.
          if (!prima.includes(nuova)) d.notePostCall = prima ? `${prima}\n${riga}` : riga;
        }

        const { error } = await supabaseAdmin.from("crm_leads").update({ data: d as never }).eq("id", id);
        if (error) return json({ ok: false, reason: error.message }, 500);
        return json({ ok: true });
      },
    },
  },
});
