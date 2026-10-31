/** ── MEETLY · LA ROTTA PER I MEDIA DALL'SFU DI CLOUDFLARE ────────────────────
 *
 *  Commessa 2026-10-31-meetly-connessione, Parte B (PIANO.md §1.5).
 *  POST { azione, codice, … } -> { ok, … } | { ok:false, error:"<codice-breve>" }
 *        azioni: dichiara · pubblica · abbonati · rinegozia · rinnova · esci ·
 *                espelli · config
 *  GET  ?stato=1               -> { trasporto, pronto }   (pubblico, nient'altro)
 *
 *  ── ⚠️ SOTTILE DI PROPOSITO ─────────────────────────────────────────────
 *  Qui si decide solo CHI sta chiamando (consulente o ospite) e si traduce il
 *  verdetto in una `Response`. Le regole (chi può fare cosa, i limiti, le righe)
 *  stanno in `shop/meetly-sfu-stanza`, dove sono provate in Node. Nessuna
 *  variabile di prova, nessuna scorciatoia: senza i segreti Meetly la rotta
 *  risponde `non-configurato` e il client va in mesh.
 *
 *  ── ⚠️ PERCHÉ È PUBBLICA ────────────────────────────────────────────────
 *  L'ospite non ha credenziali proprie: il codice stanza È la credenziale, più
 *  i controlli di `pubblica` (stanza viva, dichiarato, ammesso dalla sala
 *  d'attesa) e la `chiave` che riceve. Il consulente si riconosce dalla sessione
 *  da presentatore (cookie) o dal CRM col permesso «agenda»; `config` chiede
 *  invece «consulenti», come `/api/public/turn`.
 *  ⚠️ NIENTE `Access-Control-Allow-Credentials`: i cookie non viaggiano fra
 *  origini diverse, e l'ospite non ne ha. */
import { createFileRoute } from "@tanstack/react-router";
import { MAX_CORPO_BYTE } from "@/shop/meetly-sfu-regole";
import { statoPubblico, trattaSfu } from "@/shop/meetly-sfu-stanza";
import { padroneDellaStanza, stanzaDiProduzione } from "@/shop/meetly-sfu.server";
import { chiamanteCRM } from "./api.crm.accesso";
import { sessioneDaRichiesta } from "./api.presenter.consultant";
import { eConsulenteDellaStanza } from "@/shop/meetly-sfu-padrone";
import { idAmbito } from "@/shop/ambito-listino";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-crm-token, x-presenter-token",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/meetly-sfu")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        if (new URL(request.url).searchParams.get("stato") !== "1") return json({ ok: false, error: "richiesta" }, 400);
        const r = await statoPubblico(stanzaDiProduzione());
        return json(r.body, r.status);
      },

      POST: async ({ request }) => {
        //  Il corpo enorme si rifiuta prima di leggerlo; il nucleo ricontrolla sul testo vero.
        if (Number(request.headers.get("content-length") ?? 0) > MAX_CORPO_BYTE) {
          return json({ ok: false, error: "troppo-grande" }, 413);
        }
        const corpo = await request.text();
        //  Chi è: sessione da presentatore, oppure CRM. Gli ospiti non hanno né l'una né l'altro
        //  (nessun accesso al database per loro: senza credenziali le due letture tornano subito).
        const sessione = await sessioneDaRichiesta(request);
        const crm = sessione ? null : await chiamanteCRM(request);
        //  Consulente solo nella PROPRIA stanza (o il proprietario): vedi shop/meetly-sfu-padrone.
        let codice = "";
        try {
          codice = String((JSON.parse(corpo) as { codice?: unknown })?.codice ?? "");
        } catch {
          /* corpo non JSON: lo rifiuta il nucleo */
        }
        const forse = !!sessione || !!crm?.accesso.puo("agenda");
        const consulente =
          forse &&
          eConsulenteDellaStanza({
            padrone: codice ? await padroneDellaStanza(codice) : "",
            sessioneId: idAmbito(sessione?.id),
            crm: crm ? { tipo: crm.tipo, consultantId: idAmbito(crm.consultantId), agenda: crm.accesso.puo("agenda") } : null,
          });
        const r = await trattaSfu(stanzaDiProduzione(), {
          ruolo: consulente ? "consulente" : "ospite",
          puoConfigurare: !!sessione || !!crm?.accesso.puo("consulenti"),
          contentType: request.headers.get("content-type"),
          corpo,
        });
        return json(r.body, r.status);
      },
    },
  },
});
