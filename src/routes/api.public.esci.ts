/** ── «ESCI» DALLA CONSULENZA, LATO CLIENTE ─────────────────────────────────
 *
 *  Segnalazione del committente (13/10/2026): chi esce deve sparire subito
 *  dalla lista, dalle camere e dalla sala d'attesa, e il suo vecchio link non
 *  deve più valere.
 *
 *  POST { sess, pid, dev, segreto, chi?, k?, ultima } -> { ok, chiuso }
 *
 *  ⚠️ SENZA IL SEGRETO DELLA RIGA NON SI ESCE: `pid`, `dev` e il gettone
 *   viaggiano in `hello` a tutta la stanza, quindi non provano chi sei. Riga
 *   non trovata o di un altro: 403, e niente scritto.
 *  ⚠️ `ultima:false` NON TOCCA NIENTE: la persona ha un'altra scheda viva nello
 *   stesso browser, e farla uscire dalla sala le toglierebbe l'«ammesso».
 *  ⚠️ Il link lo chiude solo il titolare. Le regole stanno in shop/uscita,
 *   dov'è provata; qui c'è solo il filo con l'archivio. */
import { createFileRoute } from "@tanstack/react-router";
import { INTESTAZIONI_SALA, trattaEsci } from "@/shop/uscita";
import { archivioSala } from "./api.public.sala-attesa";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_SALA,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/esci")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let b: Record<string, unknown> = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo illeggibile */ }
        const r = await trattaEsci(archivioSala, {
          sess: String(b.sess ?? ""),
          pid: String(b.pid ?? ""),
          dev: String(b.dev ?? ""),
          segreto: String(b.segreto ?? ""),
          chi: String(b.chi ?? ""),
          k: String(b.k ?? ""),
          ultima: b.ultima === true,
        });
        return json(r.body, r.status);
      },
    },
  },
});
