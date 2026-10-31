/** ─────────────────────────────────────────────────────────────────────────
 *  I MESSAGGI AUTOMATICI: LEGGERE E ACCENDERE / SPEGNERE
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T2. Il pannello «Messaggi
 *  automatici» (Impostazioni → WhatsApp) parla solo con questa rotta. Contratto in
 *  `src/crm/messaggi-automatici/tipi.ts`:
 *   · GET  → 200 `RispostaMessaggi` (voci, fascia, ultime modifiche);
 *   · POST { chiave, acceso, prima } → 200 `RispostaMessaggi` già riletta, oppure
 *     409 «Nel frattempo è cambiato: ricarica» (`prima` non è più vero) o «Spento nel
 *     codice», 422 (regola prima di accendere), 400, 503 (manca la migrazione).
 *
 *  ⚠️ TUTTO DIETRO `guardiaCRM` COL PERMESSO «impostazioni», anche la lettura. Decidono se
 *   un messaggio parte a un cliente: li scrive solo il server (tabella chiusa), mai il
 *   browser. Il NOME di chi clicca lo prende il server dalla sessione (`g.chi.nome`):
 *   un «da» nel corpo si butta.
 *  ⚠️ Nessuna di queste azioni manda un messaggio. Nei log solo codici, mai un numero.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import {
  imposta,
  leggiComandoImposta,
  rispostaMessaggi,
} from "@/crm/messaggi-automatici/registro.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Un guasto del database: nei log solo il codice. */
function guasto(e: unknown) {
  const code = (e as { code?: unknown } | null)?.code;
  console.warn("[messaggi-automatici]", typeof code === "string" ? code : "errore");
  return json({ error: "Il server ha avuto un problema: riprova fra poco." }, 500);
}

export const Route = createFileRoute("/api/crm/messaggi-automatici")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        try {
          return json(await rispostaMessaggi());
        } catch (e) {
          return guasto(e);
        }
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;

        let corpo: unknown;
        try {
          corpo = await request.json();
        } catch {
          return json({ error: "Richiesta non valida." }, 400);
        }
        const letto = leggiComandoImposta(corpo);
        if (!letto.ok) return json({ error: letto.errore }, 400);

        try {
          const esito = await imposta(letto.comando, g.chi.nome);
          return esito.ok ? json(esito.risposta) : json({ error: esito.errore }, esito.stato);
        } catch (e) {
          return guasto(e);
        }
      },
    },
  },
});
