/** IL LINK DELL'INVITO — IL LATO CHE LO CREA ─────────────────────────────────
 *  POST { leadId, token? } -> { ok, codice, link }
 *
 *  Genera (o restituisce) la pagina pubblica dell'appuntamento: quella che il
 *  consulente manda al cliente dopo aver fissato, e che risponde a quattro
 *  domande in dieci secondi — quando, quanto dura, come funziona, chi incontro.
 *
 *  ── PERCHÉ IL CODICE È QUELLO DELLE RACCOLTE MEDIA E NON QUELLO DELLA STANZA ─
 *  In casa esistono già due codici sorteggiati, e riusarne uno era la richiesta:
 *   · la stanza della consulenza (api.crm.meeting-session) — `kfr-mbqd-tzp`;
 *   · le raccolte media (src/media/galleria.ts) — dodici segni.
 *  Qui si riusa il SECONDO, per tre motivi che sono di forma e non di gusto:
 *   1. il codice della stanza è indicizzato per lead (`meet:<leadId>`): da un
 *      indirizzo non si risale alla riga senza scandire la tabella, che è
 *      esattamente ciò che una pagina pubblica non può fare a ogni apertura.
 *      Il codice delle raccolte È la chiave della riga (`invito:<codice>`), che
 *      è la forma di cui questa pagina ha bisogno;
 *   2. la stanza si RIGENERA (`rigenera: true`) quando l'appuntamento passa a
 *      un'altra persona o il link va invalidato. Se l'invito ne condividesse il
 *      codice, ogni rigenerazione spegnerebbe in silenzio anche i link già
 *      mandati ai clienti;
 *   3. sono due chiavi con due poteri diversi: quella della stanza fa ENTRARE
 *      in una videochiamata, questa fa LEGGERE una pagina. Tenerle distinte
 *      significa che chi inoltra l'invito a un amico non gli sta consegnando
 *      anche una porta aperta sulla consulenza altrui.
 *  L'alfabeto di `generaCodice` esclude le coppie che si confondono (O/0, I/1)
 *  e dodici segni valgono più di 10^16 combinazioni: il codice è la chiave,
 *  quindi non può essere indovinabile — la pagina mostra il nome di una persona.
 *
 *  ── CHI PUÒ ───────────────────────────────────────────────────────────────
 *  Serve il permesso «agenda», lo stesso di chi fissa gli appuntamenti: creare
 *  un invito è creare un indirizzo pubblico che dice il nome di un cliente e
 *  quando lo si incontra.
 *  Il lead deve inoltre appartenere allo studio di chi chiama: senza questo
 *  filtro un identificativo indovinato basterebbe a far nascere una pagina
 *  pubblica sui contatti di un'altra installazione.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { leggiConfig, scriviConfig } from "@/media/config.server";
import { codicePulito, formattaCodice, generaCodice } from "@/media/galleria";
import { chiaveInvito, chiaveInvitoDiLead, type RigaInvito } from "@/crm/invito";
import { urlPubblico } from "@/lib/sito";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";

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

/** Il link come lo riceve il cliente: sul dominio pubblico (lib/sito) e con il
 *  codice a gruppi di quattro, come le raccolte media. I trattini servono a chi
 *  lo detta al telefono, e `codicePulito` li toglie di nuovo in lettura. */
export const linkInvito = (codice: string) => urlPubblico(`invito/${formattaCodice(codice)}`);

export const Route = createFileRoute("/api/crm/invito")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let b: { leadId?: string; token?: string } = {};
        try {
          b = (await request.json()) as typeof b;
        } catch {
          /* corpo illeggibile: si risponde comunque con il motivo giusto */
        }

        const chi = await chiamanteCRM(request, b.token);
        if (!chi) return nonAutenticatoCRM(cors);
        if (!chi.accesso.puo("agenda")) return vietatoCRM(cors, "agenda");
        if (!chi.adminUserId) return json({ ok: false, reason: "studio non riconosciuto" }, 400);

        const leadId = String(b.leadId || "").trim();
        if (!leadId) return json({ ok: false, reason: "leadId mancante" }, 400);

        //  Il lead esiste ed è di questo studio? Si controlla PRIMA di creare
        //  qualsiasi riga: un invito su un lead che non c'è è un link che porta
        //  a una schermata gentile, cioè un consulente che manda al cliente un
        //  indirizzo morto senza accorgersene.
        const { data: righe } = await supabaseAdmin
          .from("crm_leads")
          .select("id")
          .eq("id", leadId)
          .eq("user_id", chi.adminUserId)
          .limit(1);
        if (!righe?.length) return json({ ok: false, reason: "lead non trovato" }, 404);

        //  ── UN APPUNTAMENTO, UN LINK ──────────────────────────────────────
        //  Premuto due volte, il tasto deve restituire lo STESSO indirizzo:
        //  altrimenti nella chat del cliente finiscono due link della stessa
        //  consulenza e il consulente non sa più quale ha mandato.
        const esistente = codicePulito(await leggiConfig(chiaveInvitoDiLead(leadId)));
        if (esistente && (await leggiConfig(chiaveInvito(esistente)))) {
          return json({ ok: true, codice: esistente, link: linkInvito(esistente) });
        }

        //  Collisione: con 23^12 combinazioni non succede, ma "non succede" e
        //  "non può succedere" sono due cose diverse — e qui la conseguenza
        //  sarebbe mostrare a un cliente l'appuntamento di un altro.
        let codice = "";
        for (let i = 0; i < 5 && !codice; i++) {
          const c = generaCodice();
          if (!(await leggiConfig(chiaveInvito(c)))) codice = c;
        }
        if (!codice) return json({ ok: false, reason: "riprova" }, 503);

        const riga: RigaInvito = {
          codice,
          leadId,
          userId: chi.adminUserId,
          creatoIl: new Date().toISOString(),
        };
        //  Prima la riga che la pagina legge, poi l'indice per lead: se la
        //  seconda scrittura non riuscisse, il peggio che succede è che il
        //  prossimo clic generi un codice nuovo — mentre nell'ordine inverso
        //  resterebbe un indice che punta a una riga inesistente, cioè un link
        //  che il CRM continua a offrire e che al cliente non apre niente.
        await scriviConfig(chiaveInvito(codice), JSON.stringify(riga));
        await scriviConfig(chiaveInvitoDiLead(leadId), codice);

        return json({ ok: true, codice, link: linkInvito(codice) });
      },
    },
  },
});
