/** ── UN CODICE PER LA CONSULENZA IN CORSO ──────────────────────────────────
 *
 *  POST { live } → restituisce il codice della prova capelli da usare in
 *  questa videoconsulenza, creandolo la prima volta.
 *
 *  ── ⚠️ PERCHÉ NON SI APRE UNA PORTA SENZA CODICE ─────────────────────────
 *  Durante una consulenza il cliente non ha un codice, e chiedergli di
 *  scriverne uno mentre siete in videochiamata è ridicolo. La tentazione è
 *  fare una scorciatoia — «se c'è il parametro `meetly` lascia passare» — ma
 *  quel parametro lo può scrivere chiunque nella barra degli indirizzi, e da
 *  quel momento la prova capelli è gratis per tutta internet, a dieci
 *  centesimi a immagine PAGATI DA NOI.
 *  Qui invece il codice è un codice vero, creato da chi sta conducendo
 *  (autenticato), e la sua spesa si vede accanto agli altri.
 *
 *  ── ⚠️ E UNO SOLO PER CONSULENZA ─────────────────────────────────────────
 *  Premendo due volte il pulsante non si creano due codici: si ritrova quello
 *  di prima, con le prove che restano. Altrimenti ogni ripensamento del
 *  relatore regalerebbe tre prove nuove, e il conto non tornerebbe mai.
 */
import { createFileRoute } from "@tanstack/react-router";
import { creaCodice, tuttiICodici } from "@/prova/archivio.server";
import { leggibile, normalizza, nuovoCodice } from "@/prova/codici";
import { INTESTAZIONI_CONSENTITE, guardiaP } from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/presenter/prova-codice")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        //  Lo stesso permesso con cui si conduce: chi è in videochiamata col
        //  cliente può mostrargli i capelli.
        const no = await guardiaP(request, cors, "agenda");
        if (no) return no;

        let b: { live?: string; consulente?: string; nome?: string; telefono?: string; leadId?: string };
        try { b = (await request.json()) as typeof b; } catch { b = {}; }

        /** ── ⚠️ UNO PER CONSULENTE, NON PER CONSULENZA ─────────────────────
         *  Uno per consulenza voleva dire un codice nuovo ogni volta che si
         *  apre l'anteprima con un cliente: centinaia di righe nel gestionale
         *  in un mese, tutte con tre prove che nessuno userà. E soprattutto
         *  chiedeva a chi conduce di pensarci.
         *  Uno per consulente invece è il SUO strumento di lavoro: illimitato,
         *  senza filigrana e senza nessuna réclame — come un codice admin,
         *  perché è esattamente quello che è. Si conia da solo la prima volta
         *  che preme il pulsante, e da lì in poi è sempre lo stesso. */
        const chi = String(b.consulente || "").trim() || "studio";
        const nota = `meetly ${chi}`;
        const gia = (await tuttiICodici()).find((c) => c.nota === nota);
        if (gia) return json({ ok: true, codice: leggibile(gia.codice), nuovo: false });

        const presi = new Set((await tuttiICodici()).map((c) => normalizza(c.codice)));
        let codice = nuovoCodice();
        for (let i = 0; i < 50 && presi.has(normalizza(codice)); i += 1) codice = nuovoCodice();

        const fatto = await creaCodice({
          codice,
          nota,
          //  ⚠️ I vantaggi dell'admin: prove illimitate, niente filigrana,
          //   niente popup. Chi conduce sta mostrando lo strumento a un
          //   cliente, e un contatore che scende o un listino che si apre in
          //   quel momento sono due figure diverse ma tutte e due brutte.
          admin: true,
          ...(b.leadId ? { leadId: b.leadId } : {}),
          ...(b.nome ? { nome: b.nome } : {}),
          ...(b.telefono ? { telefono: b.telefono } : {}),
        });
        return json({ ok: true, codice: leggibile(fatto.codice), nuovo: true });
      },
    },
  },
});
