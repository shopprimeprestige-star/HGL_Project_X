/** ── QUESTO LINK VALE ANCORA? ──────────────────────────────────────────────
 *
 *  GET ?sess=&chi=&k= -> { ok, valido }
 *
 *  Dopo «Esci» il vecchio link non è più valido: la pagina del cliente lo
 *  chiede PRIMA di bussare e, se la risposta è no, mostra un messaggio neutro.
 *  ⚠️ Risponde solo sì o no: niente nomi, niente stato della stanza. Il codice
 *   della stanza è già la credenziale di tutte le rotte pubbliche. */
import { createFileRoute } from "@tanstack/react-router";
import { trattaLink } from "@/shop/uscita";
import { archivioSala } from "./api.public.sala-attesa";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/link-ospite")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const u = new URL(request.url);
        const r = await trattaLink(archivioSala, {
          sess: u.searchParams.get("sess") ?? "",
          chi: u.searchParams.get("chi") ?? "",
          k: u.searchParams.get("k") ?? "",
        });
        return json(r.body, r.status);
      },
    },
  },
});
