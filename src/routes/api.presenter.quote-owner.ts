/** DI CHI È QUESTO PREVENTIVO ────────────────────────────────────────────────
 *  Un preventivo non è dello studio: è di chi l'ha fatto. Senza questo dato non
 *  si può dire quanti ne ha prodotti un consulente, né filtrare l'elenco per
 *  vedere solo i propri — e con tre persone che lavorano lo stesso archivio
 *  diventa impossibile capire chi ha seguito cosa.
 *
 *  Sta in app_config invece che in una colonna della tabella preventivi perché
 *  non richiede una migrazione del database: il preventivo resta quello che è,
 *  e questa è un'informazione che gli si affianca.
 *
 *  POST { ref, presenterId, presenterName } -> registra
 *  GET                                      -> { owners: { REF: {id, nome} } }
 *
 *  ── SOLO A CHI HA L'ACCESSO, MA DA DUE PORTE ──────────────────────────────
 *  L'elenco completo è la RUBRICA dei numeri di preventivo, e il numero è la
 *  chiave con cui si apre un preventivo: darlo a chiunque significava
 *  consegnare l'indice dell'archivio clienti, più il nome del consulente che
 *  ha seguito ognuno. Serve quindi una sessione — ma non UNA sola, perché
 *  questi nomi si scrivono in un posto e si leggono in un altro:
 *
 *   · il PRESENTATORE li scrive, dal dispositivo su cui ha appena chiuso il
 *     preventivo, e li rilegge nel suo pannello;
 *   · il CRM li legge, nella pagina Preventivi, dove la sessione è quella del
 *     CRM (PIN del consulente o accesso titolare) e di presentatore non ce n'è
 *     nessuna.
 *
 *  Chiedere solo la seconda credenziale voleva dire rifiutare sempre la prima
 *  pagina — che è esattamente quella per cui questo dato esiste. Stesso schema
 *  già usato da api.anteprima: prima la guardia del CRM, poi il ripiego su
 *  quella del presentatore.
 *
 *  ── ⚠️ E QUANDO SI DICE DI NO, SI DICE DI NO ──────────────────────────────
 *  Questa rotta rispondeva al rifiuto con `{ owners: {} }`, per «tenere la
 *  forma che il client si aspetta». Un elenco vuoto però non è una forma: è un
 *  DATO, e dice una cosa falsa — «nessuno di questi preventivi ha un autore».
 *  Nel CRM si leggeva così, e ogni riga diceva «consulente non registrato»
 *  mentre in archivio i proprietari c'erano tutti: nessun errore da nessuna
 *  parte, quindi nessuno se ne è accorto per settimane.
 *  Adesso il no esce come no — 401 se non so chi sei, 403 se lo so e non puoi —
 *  e senza `owners`: chi chiama può finalmente distinguere «nessun
 *  proprietario» da «non ti è permesso saperlo», e dirlo a chi guarda.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  INTESTAZIONI_CONSENTITE,
  guardia as guardiaPresentatore,
} from "./api.presenter.consultant";
import { guardiaCRM } from "./api.crm.accesso";

//  Due porte, due credenziali: quelle del CRM (`Authorization` per l'accesso
//  titolare, `x-crm-token` per chi è entrato col PIN) vanno dichiarate qui, o il
//  browser non le lascia nemmeno partire quando la chiamata arriva da un'altra
//  origine.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": `${INTESTAZIONI_CONSENTITE}, Authorization, x-crm-token`,
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const KEY = "quote_owners";
type Mappa = Record<string, { id: string; nome: string }>;

async function leggi(): Promise<Mappa> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", KEY).maybeSingle();
  try { return JSON.parse((data as { value?: string } | null)?.value || "{}") as Mappa; } catch { return {}; }
}

/** Chi bussa dal CRM porta almeno una di queste due. Serve a scegliere QUALE
 *  rifiuto restituire quando non si apre nessuna delle due porte: rispondere
 *  «serve l'accesso da presentatore» a chi sta nel CRM lo manda a cercare una
 *  porta che nella sua schermata non esiste. */
const bussaDalCRM = (request: Request): boolean =>
  !!request.headers.get("x-crm-token") || !!request.headers.get("authorization");

/** LE DUE PORTE, IN UNA RIGA SOLA.
 *
 *      const no = await porta(request); if (no) return no;
 *
 *  `null` = si passa. Altrimenti il rifiuto già pronto, con dentro il motivo e
 *  NIENTE `owners`: vedi in cima perché quella riga in più è costata un giro.
 *  Il permesso richiesto al CRM è `preventivi`, lo stesso che serve per aprire
 *  la pagina /CRM/preventivi: chi non può vedere i preventivi non deve poterne
 *  leggere la rubrica da un'altra strada. */
async function porta(request: Request): Promise<Response | null> {
  //  Prima il CRM: quando la richiesta non porta nessuna credenziale CRM questo
  //  controllo non tocca il database (né token né `Authorization` da leggere),
  //  quindi non pesa sul caso del presentatore, che è il più frequente.
  const g = await guardiaCRM(request, cors, "preventivi");
  if (g.ok) return null;
  const no = await guardiaPresentatore(request, cors);
  if (!no) return null;
  return bussaDalCRM(request) ? g.risposta : no;
}

export const Route = createFileRoute("/api/presenter/quote-owner")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const no = await porta(request);
        if (no) return no;
        return json({ ok: true, owners: await leggi() });
      },
      POST: async ({ request }) => {
        //  Lo scrive il dispositivo del presentatore subito dopo aver creato il
        //  preventivo: lì la sessione c'è (il cookie hg_psess parte da solo) e
        //  la porta che si apre è la seconda. Senza controllo, chiunque poteva
        //  riscrivere l'attribuzione di qualsiasi preventivo.
        const no = await porta(request);
        if (no) return no;
        let b: { ref?: string; presenterId?: string; presenterName?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* */ }
        const ref = String(b.ref || "").trim().toUpperCase();
        if (!ref) return json({ ok: false, reason: "ref mancante" }, 400);
        const m = await leggi();
        m[ref] = { id: String(b.presenterId || ""), nome: String(b.presenterName || "") };
        const { error } = await supabaseAdmin.from("app_config").upsert(
          { key: KEY, value: JSON.stringify(m), updated_at: new Date().toISOString() } as never,
          { onConflict: "key" },
        );
        //  ⚠️ supabase non lancia: restituisce { error }. Ingoiarlo qui
        //  significava perdere l'autore del preventivo senza che nessuno lo
        //  sapesse — di nuovo un «consulente non registrato» inspiegabile.
        if (error) return json({ ok: false, reason: error.message }, 500);
        return json({ ok: true });
      },
    },
  },
});
