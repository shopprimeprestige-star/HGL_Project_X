/** ── PERMESSO DI CARICAMENTO SU GOOGLE DRIVE ───────────────────────────────
 *  Il gemello di api.presenter.upload-url per le registrazioni che non stanno
 *  nel tetto di Supabase (vedi shop/drive-registrazioni).
 *
 *  POST { filename, size, type } → { ok, sessione }
 *
 *  `sessione` è l'indirizzo di Google su cui il browser manda il file a
 *  blocchi (PUT con Content-Range). Il file non passa da qui.
 *  ⚠️ Solo a chi ha una sessione da presentatore, come il gemello: è un
 *   permesso di SCRITTURA nel Drive dello studio.
 */
import { createFileRoute } from "@tanstack/react-router";
import { INTESTAZIONI_CONSENTITE, guardia } from "./api.presenter.consultant";
import { apriCaricamento } from "@/shop/google-drive.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/presenter/drive-upload-url")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const no = await guardia(request, cors);
        if (no) return no;
        let b: { filename?: unknown; size?: unknown; type?: unknown } = {};
        try {
          const grezzo = await request.json();
          if (grezzo && typeof grezzo === "object") b = grezzo as typeof b;
        } catch { /* valori di riserva */ }
        const peso = Math.floor(Number(b.size) || 0);
        if (peso <= 0) return json({ ok: false, reason: "peso mancante" }, 400);
        const nome = String(b.filename || "registrazione.webm").replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 120);
        const tipo = /^video\/[a-z0-9.+-]+$/i.test(String(b.type || "")) ? String(b.type) : "video/webm";
        const r = await apriCaricamento({ nome, peso, tipo, origine: new URL(request.url).origin });
        if (!r.ok) return json({ ok: false, reason: r.errore }, 502);
        return json({ ok: true, sessione: r.sessione });
      },
    },
  },
});
