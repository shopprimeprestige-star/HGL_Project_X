/** ── LO SPECCHIO DELLA PROVA CAPELLI, LATO SERVER ──────────────────────────
 *
 *  GET  ?meet=<consulenza>            → { stato }
 *  POST { meet, stato }               → lo registra
 *
 *  Le due schermate — il telefono del cliente e lo schermo del consulente —
 *  scrivono qui quello che stanno mostrando e leggono quello che mostra
 *  l'altro. È lo stesso mestiere di `curpage`, che fa seguire la PAGINA: qui
 *  si segue quello che succede DENTRO la pagina.
 *
 *  ── ⚠️ PERCHÉ NON PASSA DAL CANALE DELLA VIDEOCHIAMATA ───────────────────
 *  Il canale in tempo reale esiste solo mentre la chiamata è viva, e la prova
 *  capelli si fa anche prima che il cliente entri in video — o dopo, con il
 *  link in mano. Una riga sul server, chiesta ogni secondo come già si fa per
 *  la pagina corrente, funziona in tutti e tre i casi e non ha niente da
 *  riconnettere quando la rete del telefono salta per due secondi.
 *
 *  ── ⚠️ UNA RIGA PER CONSULENZA, NON UN DOCUMENTO CON DENTRO TUTTE ────────
 *  Con un documento solo, le due parti che scrivono insieme se lo rileggono e
 *  se lo riscrivono a vicenda: la scrittura dell'una cancella quella
 *  dell'altra, e non per la propria consulenza — per tutte. Una riga per
 *  codice si scrive da sola, e nessuno tocca quella di nessun altro.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** ⚠️ Il codice della consulenza e nient'altro: questa chiave finisce in una
 *  query, e un `meet` scritto a mano con dentro un carattere strano non deve
 *  poter diventare la chiave di un'altra riga della configurazione. */
const chiave = (meet: string) => {
  const pulito = String(meet || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return pulito && pulito.length <= 40 ? `prova_specchio_${pulito}` : "";
};

export const Route = createFileRoute("/api/presenter/prova-specchio")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const k = chiave(new URL(request.url).searchParams.get("meet") || "");
        if (!k) return json({ ok: true, stato: null });
        const { data } = await supabaseAdmin
          .from("app_config").select("value").eq("key", k).maybeSingle();
        const grezzo = (data as { value?: string | null } | null)?.value || "";
        try {
          return json({ ok: true, stato: grezzo ? JSON.parse(grezzo) : null });
        } catch {
          return json({ ok: true, stato: null });
        }
      },

      POST: async ({ request }) => {
        let b: { meet?: string; stato?: Record<string, unknown> } = {};
        try { b = (await request.json()) as typeof b; } catch { /* si risponde no */ }
        const k = chiave(String(b.meet || ""));
        if (!k || !b.stato) return json({ ok: false, errore: "richiesta incompleta" }, 400);

        //  ⚠️ Si scrive solo quello che serve, non quello che arriva: la
        //   pagina è pubblica, e senza questo filtro chiunque potrebbe
        //   parcheggiare qualunque cosa dentro la configurazione.
        const s = b.stato as Record<string, unknown>;
        const stato = {
          passo: String(s.passo || ""),
          taglio: String(s.taglio || ""),
          colore: String(s.colore || ""),
          barba: !!s.barba,
          //  Il risultato è un indirizzo su Storage, non un'immagine dentro il
          //  messaggio: la riga resta piccola e si scrive in un lampo.
          esito: String(s.esito || "").slice(0, 600),
          carico: !!s.carico,
          genera: Number(s.genera || 0) || 0,
          da: s.da === "guida" ? "guida" : "ospite",
          v: Date.now(),
        };
        await supabaseAdmin.from("app_config").upsert(
          { key: k, value: JSON.stringify(stato), updated_at: new Date().toISOString() } as never,
          { onConflict: "key" },
        );
        return json({ ok: true, v: stato.v });
      },
    },
  },
});
