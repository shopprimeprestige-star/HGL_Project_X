/** L'INVITO — IL LATO CHE LEGGE (chiunque abbia il codice) ───────────────────
 *  GET ?codice=ACDE-F3HJ-KMN7  ->  { ok, invito: { nome, data, ora, durata,
 *                                                  consulente, link } }
 *
 *  Nessun accesso, nessun cookie, nessuna sessione: la apre un cliente dal
 *  telefono, ed è il senso stesso del link. Il codice È la chiave — per questo
 *  viene sorteggiato (vedi api.crm.invito).
 *
 *  ⚠️ QUESTA ROTTA SA FARE UNA COSA SOLA. Senza codice non risponde, con un
 *  codice sbagliato risponde "non trovato", e non esiste nessun parametro che
 *  la faccia elencare gli inviti o dire quanti ce ne sono. Il lato che li crea
 *  vive in un altro file, dietro la guardia del CRM: sono due rotte diverse
 *  proprio perché nessuna modifica futura all'una possa aprire l'altra.
 *
 *  ⚠️ E SOPRATTUTTO: ESCE SOLO L'ELENCO SCRITTO QUI SOTTO. Il lead viene letto
 *  intero — è una riga di database — ma di quella riga escono cinque campi,
 *  scelti a mano. Telefono, email, città, note, stato della trattativa, importi
 *  e cognome NON compaiono in nessuna risposta: chi apre il link ha in mano un
 *  indirizzo, non un accesso alla scheda di una persona. Chiunque aggiunga un
 *  campo qui dentro lo sta pubblicando su internet.
 *
 *  Si risponde 200 anche quando l'invito non c'è più: per il cliente non è un
 *  errore, è un link scaduto, e la pagina ha già la sua schermata gentile.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { leggiConfig } from "@/media/config.server";
import { codicePulito } from "@/media/galleria";
import { chiaveInvito, dataPulita, durataPulita, nomeDiBattesimo, oraPulita } from "@/crm/invito";
import { linkStanzaDi } from "@/crm/whatsapp";
//  Il gettone della persona e il link che se lo porta dentro: un link per
//  ciascuno, nella stessa stanza.
import { gettoneDi } from "@/crm/fascia-consulenza";
import { linkPerPersona } from "@/shop/chi-dal-link";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown) =>
  new Response(JSON.stringify(o), {
    status: 200,
    //  Niente cache condivisa: l'indirizzo contiene la chiave, e dietro c'è il
    //  nome di una persona. Un appuntamento spostato deve leggersi subito.
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Il nome del consulente, o stringa vuota. Non è un errore non averlo: un
 *  appuntamento senza consulente assegnato esiste, e la pagina in quel caso
 *  semplicemente non dice "con chi" invece di scrivere "con undefined". */
async function nomeConsulente(id: unknown): Promise<string> {
  const consulenteId = String(id ?? "").trim();
  if (!consulenteId) return "";
  try {
    const { data } = await supabaseAdmin
      .from("crm_consultants")
      .select("data")
      .eq("id", consulenteId)
      .limit(1);
    const d = ((data ?? []) as { data?: { nome?: string } | null }[])[0]?.data;
    return String(d?.nome ?? "")
      .trim()
      .slice(0, 40);
  } catch {
    //  Il nome del consulente è un dettaglio: se la lettura non riesce, la
    //  pagina deve comunque dire quando e come si svolge la consulenza.
    return "";
  }
}

export const Route = createFileRoute("/api/public/invito")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const codice = codicePulito(new URL(request.url).searchParams.get("codice"));
        //  Codice mal scritto: stessa risposta di "non esiste". Distinguere i
        //  due casi direbbe a chi prova a indovinare quando ha imbroccato la
        //  forma giusta.
        if (!codice) return json({ ok: false, reason: "not_found" });

        //  Il tipo è dichiarato a parte e non con `typeof riga`: dentro il
        //  `try` la variabile è ancora ferma a `null`, quindi quella scorciatoia
        //  avrebbe convertito la lettura in `never` e fatto sparire i due campi.
        type Puntatore = { leadId?: unknown; userId?: unknown };
        let riga: Puntatore | null = null;
        try {
          const raw = await leggiConfig(chiaveInvito(codice));
          riga = raw ? (JSON.parse(raw) as Puntatore) : null;
        } catch {
          //  Riga illeggibile (JSON rotto a mano dal pannello): per il cliente
          //  è un link non più valido, non una schermata tecnica.
          riga = null;
        }
        const leadId = String(riga?.leadId ?? "").trim();
        const userId = String(riga?.userId ?? "").trim();
        if (!leadId || !userId) return json({ ok: false, reason: "not_found" });

        //  ── SI LEGGE ADESSO, NON SI RILEGGE UNA FOTOGRAFIA ────────────────
        //  L'appuntamento si sposta: un invito che ripetesse i dati salvati il
        //  giorno della generazione manderebbe il cliente all'ora vecchia.
        //  Il filtro su `user_id` è l'isolamento dello studio, ripetuto qui e
        //  non dato per buono dalla riga: due controlli sulla stessa cosa
        //  costano niente, e questa risposta è pubblica.
        const { data, error } = await supabaseAdmin
          .from("crm_leads")
          .select("data")
          .eq("id", leadId)
          .eq("user_id", userId)
          .limit(1);
        if (error) return json({ ok: false, reason: "not_found" });

        const d = ((data ?? []) as { data?: Record<string, unknown> | null }[])[0]?.data;
        //  Lead cancellato dopo che il link è partito: per chi apre è un link
        //  scaduto, e la pagina glielo dice con garbo.
        if (!d) return json({ ok: false, reason: "not_found" });

        //  Solo il nome di battesimo. Il cognome insieme alla data e all'ora
        //  farebbe di questa pagina un documento su una persona, leggibile da
        //  chiunque riceva il link inoltrato.
        //  ⚠️ NON basta leggere `d.nome`: nell'archivio importato quel campo
        //  contiene spesso "Mario Rossi" per intero, con `cognome` vuoto. Il
        //  taglio si decide guardando tutti e due i campi — e si fa QUI, sul
        //  server, così il cognome non esce nemmeno dalla risposta.
        const nome = nomeDiBattesimo(d.nome, d.cognome);

        return json({
          ok: true,
          invito: {
            nome,
            data: dataPulita(d.dataMeeting),
            ora: oraPulita(d.oraMeeting),
            durata: durataPulita(d.durataMeeting),
            consulente: await nomeConsulente(d.consulenteId),
            //  Il link della stanza si RICOSTRUISCE dal codice sul dominio
            //  pubblico e vale stringa vuota se la stanza non è nostra (nei
            //  lead importati c'è ancora qualche link Google Meet, cioè una
            //  porta chiusa). Vedi linkStanzaDi in crm/whatsapp.
            /*  ── ⚠️ E PORTA DENTRO CHI LO APRE ─────────────────────────
                Segnalazione del committente: «continua a non generare un link
                univoco per ogni persona». Il biglietto è già di una persona
                sola (ogni lead ha il suo codice d'invito), ma il tasto
                «Entra» rimandava alla stanza NUDA: tre persone della stessa
                consulenza ci arrivavano senza nome, cioè il guasto rientrava
                dalla finestra proprio nel percorso più usato.
                Qui il gettone c'è già — `leadId` è la riga del biglietto — e
                si cuce al link (vedi shop/chi-dal-link). */
            link: linkPerPersona(
              linkStanzaDi({
                linkMeeting: typeof d.linkMeeting === "string" ? d.linkMeeting : undefined,
              }),
              gettoneDi({ leadId, nome: String(d.nome ?? "") }),
            ),
          },
        });
      },
    },
  },
});
