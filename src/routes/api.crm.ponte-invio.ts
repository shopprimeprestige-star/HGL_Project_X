/** ─────────────────────────────────────────────────────────────────────────
 *  METTERE IN CODA UN MESSAGGIO DA MANDARE DAL TELEFONO (PONTE WHATSAPP)
 *
 *  Commessa 2026-10-30-ponte-invio-manuale, compito T5. POST con
 *    { azione: "accoda", numero, testo, chiave }   → { ok:true, id, stato }
 *    { azione: "riprova", id, confermaIncerto? }   → { ok:true, id, stato }
 *  oppure { ok:false, motivo, frase } con lo stato HTTP del motivo. La logica
 *  sta in `crm/ponte/invio-giro.ts` (provata con porte finte); la coda si LEGGE
 *  dal browser direttamente da `ponte_wa_invii` (RLS), qui si scrive soltanto.
 *
 *  ⚠️ Con `supabaseAdmin` la RLS non vale: la rotta verifica la sessione
 *   (`guardiaCRM`) e che l'installazione della sessione sia quella del database
 *   (`gestisciBrowser`, 403 altrimenti). Chi scrive lo decide la SESSIONE.
 *  ⚠️ Chi può usarlo: chiunque sia entrato nel CRM, come l'invio di oggi
 *   (`/api/whatsapp-send`): `guardiaCRM(request, cors, null)`. Un permesso fine
 *   si aggiunge dopo con una riga (decisione D12 del piano).
 *  ⚠️ Il server ricontrolla tutto (ponte collegato, «ha già una chat», STOP,
 *   limiti): il CRM nel browser non basta. Il corpo è al più 16 KB (2000
 *   caratteri sono fino a 8000 byte in UTF-8, più le virgolette del JSON).
 *  ⚠️ Nei log solo codici e contatori: mai testo, numeri, nomi, id.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { gestisciBrowser } from "@/crm/ponte/invio-giro";
import { porteInvio } from "@/crm/ponte/invio.server";
import { leggiCorpoLimitato } from "@/crm/manychat/ritorno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};

/** Byte massimi del corpo (vedi sopra). */
const CORPO_MAX_BYTE = 16_384;

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/crm/ponte-invio")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, null);
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId)
          return json(
            {
              ok: false,
              motivo: "non_autorizzato",
              frase: "Non si sa di quale installazione si parla: rientra nel CRM.",
            },
            403,
          );

        const letto = await leggiCorpoLimitato(request.body, CORPO_MAX_BYTE);
        if (letto.troppoGrande)
          return json(
            { ok: false, motivo: "corpo_troppo_grande", frase: "Il messaggio è troppo lungo." },
            413,
          );
        let corpo: unknown;
        try {
          corpo = JSON.parse(letto.testo);
        } catch {
          corpo = null;
        }

        const r = await gestisciBrowser(porteInvio(), {
          chi: { adminUserId: g.chi.adminUserId, nome: g.chi.nome },
          corpo,
          adesso: new Date(),
        });
        return json(r.corpo, r.stato);
      },
    },
  },
});
