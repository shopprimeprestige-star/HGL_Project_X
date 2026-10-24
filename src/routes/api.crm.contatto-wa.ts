/** ─────────────────────────────────────────────────────────────────────────
 *  IL CAMBIO A MANO DELLO «STATO DEL CONTATTO» (il secondo stato del lead)
 *
 *  Commessa 2026-10-23, compito 4. POST { leadId, stato } → { contattoWa }.
 *  Il contratto è in testa a `src/crm/manychat/client-crm.ts`.
 *
 *  ⚠️ `contattoWa` lo scrive solo il server (funzione SQL che tocca solo
 *   `data.contattoWa`): così non cancella quello che il browser sta salvando.
 *  ⚠️ Con `supabaseAdmin` la RLS non vale. Quindi la rotta verifica che la
 *   scheda sia dell'installazione della sessione (`g.chi.adminUserId`) PRIMA di
 *   scrivere, e la funzione SQL ha `p_user_id` nel WHERE.
 *  ⚠️ STOP a mano scrive anche `whatsapp_contacts.non_scrivere_dal` (il cliente
 *   che l'ha detto al telefono non deve ricevere né conferma né promemoria).
 *   Toglierlo è riservato al permesso «impostazioni», e lo azzera.
 *  ⚠️ Chi cambia (il nome nella storia) e l'installazione li decide la
 *   SESSIONE: il corpo porta solo scheda e stato. Nei log solo codici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { cambioContatto, leggiCambioContatto } from "@/crm/manychat/pannello";
import { porteContatto } from "@/crm/manychat/pannello.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/crm/contatto-wa")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        //  Basta essere dentro: il permesso fine (togliere STOP) lo decide
        //  `cambioAMano` con «impostazioni».
        const g = await guardiaCRM(request, cors, null);
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId)
          return json(
            { error: "Non si sa di quale installazione si parla: rientra nel CRM." },
            403,
          );

        let corpo: unknown;
        try {
          corpo = await request.json();
        } catch {
          return json({ error: "Richiesta non valida." }, 400);
        }
        const letto = leggiCambioContatto(corpo);
        if (!letto.ok) return json({ error: letto.errore }, 400);

        try {
          const r = await cambioContatto(porteContatto(), {
            userId: g.chi.adminUserId,
            leadId: letto.leadId,
            stato: letto.stato,
            chi: g.chi.nome,
            puoTogliereStop: g.chi.accesso.puo("impostazioni"),
            adesso: new Date(),
          });
          return json(r.corpo, r.stato);
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.warn("[manychat-contatto-wa]", typeof code === "string" ? code : "errore");
          return json({ error: "Il server ha avuto un problema: riprova fra poco." }, 500);
        }
      },
    },
  },
});
