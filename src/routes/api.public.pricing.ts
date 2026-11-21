/** Prezzi del configuratore (override impostati dal CRM).
 *  GET -> { prices: {id:number}, was: {id:number} }  (vuoto se non configurati)
 *  Usa il service role: app_config non è leggibile dall'anon.
 */
import { createFileRoute } from "@tanstack/react-router";
/*  ── ⚠️ IL CLIENTE VEDE IL LISTINO DI CHI LO STA SEGUENDO ─────────────────
    Richiesta del committente: «ogni consulente ha le sue modifiche».
    Il cliente non sa chi è il suo consulente: sa il codice della sua stanza,
    che ha nell'indirizzo (?sess=). La traduzione da codice a consulente la fa
    il server — l'id del consulente al cliente non si manda.
    Senza codice, o con una consulenza non ancora avviata, vale il listino di
    casa: è come ha sempre funzionato, e la pagina richiede i prezzi quando il
    consulente entra (vedi il ricarico in routes/preventivo). Un cliente che
    legge 389 mentre il consulente dice 589 è il guasto peggiore di tutta
    questa faccenda. */
import { consulenteDellaSessione, grezzoListino } from "@/crm/listino-di-chi.server";
/*  ── ⚠️ E IL CONSULENTE VEDE IL PROPRIO, ANCHE SENZA UNA STANZA ───────────
    Segnalazione del committente: «quando cambio il prezzo della garanzia non
    si cambia».
    Un preventivo si costruisce anche SENZA avviare una consulenza — si apre la
    pagina e si compila — e in quel caso nell'indirizzo non c'è nessun codice:
    il server non sapeva chi stesse chiedendo e rispondeva col listino di casa.
    Il consulente ritoccava il suo listino e continuava a vedere le cifre di
    tutti, convinto che il salvataggio non funzionasse.
    Chi sta chiedendo, però, il server lo sa lo stesso: la sessione del
    presentatore viaggia in un cookie, la stessa che protegge il pannello dove
    quel prezzo è stato appena scritto.
    ⚠️ VALE SOLO PER IL SUO BROWSER: il cookie ce l'ha chi è entrato da
     presentatore, non il cliente — che infatti continua a essere servito dal
     codice della sua stanza. Nessun cliente può ricevere il listino di un
     consulente per questa strada.
    ⚠️ E IL CODICE DELLA STANZA VINCE: se la consulenza c'è, comanda lei. Un
     consulente che apre il link di un collega deve vedere quello che vede il
     cliente di quel collega, non il proprio. */
import { sessioneDaRichiesta } from "./api.presenter.consultant";
import { idAmbito } from "@/shop/ambito-listino";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown) =>
  new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/pricing")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const codice = new URL(request.url).searchParams.get("sess");
        let chi = await consulenteDellaSessione(codice);
        if (!chi) {
          const sessione = await sessioneDaRichiesta(request);
          //  Solo un accesso con PIN identifica UNA persona: le chiavi di casa
          //  (codice generale, accesso del proprietario) sono di tutti, e il
          //  loro listino è già quello di casa.
          if (sessione && sessione.via === "pin") chi = idAmbito(sessione.id);
        }
        //  ⚠️ Il ripiego vale per la RIGA INTERA, non campo per campo: o è il
        //   listino del consulente, o è quello di casa. Mescolarli vorrebbe
        //   dire un prezzo preso da una parte e una spunta dall'altra.
        const { valore } = await grezzoListino(chi);
        let prices = {}, was = {}, disabled = {}, spente = {}, preselezionate = {}, preselezionatePerBase = {}, manutenzione = {};
        //  L'acconto del preventivo. `undefined` = quello di casa: si manda
        //  solo se il listino lo dice, così la pagina non riceve uno zero che
        //  vorrebbe dire «nessun acconto».
        let acconto: number | undefined;
        //  Il modello della causale del bonifico (vedi shop/causale-bonifico).
        let causale = "";
        //  ⚠️ Acceso finché non si dice il contrario: le configurazioni salvate
        //   prima di questo interruttore non hanno il campo, e devono
        //   continuare a mostrare i prezzi barrati come hanno sempre fatto.
        let upsellSconti = true;
        try {
          const parsed = JSON.parse(valore ?? "{}");
          prices = parsed.prices ?? {};
          was = parsed.was ?? {};
          disabled = parsed.disabled ?? {};
          //  Cosa il cliente NON deve vedere: sezioni intere e parti fisse
          //  della pagina. Vedi `spente` in shop/quote-menu.
          spente = parsed.spente ?? {};
          //  Cosa è già spuntato quando il preventivo si apre. Vedi
          //  `preselezionate` in shop/quote-menu: assente = combinazione di
          //  serie, e i listini salvati prima di oggi non hanno il campo.
          preselezionate = parsed.preselezionate ?? {};
          //  Le spunte decise soluzione per soluzione (Patch, Invisible Derm,
          //  trapianto): vedi `preselezionatePerBase` in shop/quote-menu.
          preselezionatePerBase = parsed.preselezionatePerBase ?? {};
          //  Quanto paga dopo, e per quanti mesi: vedi `manutenzione` in
          //  shop/quote-menu. Assente = i valori di casa.
          manutenzione = parsed.manutenzione ?? {};
          //  Quanto si lascia oggi: vedi `acconto` in shop/quote-menu.
          if (typeof parsed.acconto === "number" && Number.isFinite(parsed.acconto) && parsed.acconto >= 0)
            acconto = parsed.acconto;
          if (typeof parsed.causale === "string") causale = parsed.causale;
          if (parsed.upsellSconti === false) upsellSconti = false;
        } catch { /* default vuoto */ }
        return json({ prices, was, disabled, upsellSconti, spente, preselezionate, preselezionatePerBase, manutenzione, causale, ...(acconto === undefined ? {} : { acconto }) });
      },
    },
  },
});
