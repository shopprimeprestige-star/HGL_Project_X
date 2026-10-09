/** ANTEPRIMA DEI LINK ─────────────────────────────────────────────────────
 *  Un'immagine SVG generata al volo, diversa per ogni cosa che si condivide:
 *  il preventivo, la videoconsulenza, la presentazione. Logo, titolo e una
 *  riga di spiegazione, sul fondo del marchio.
 *
 *  ⚠️ LIMITE ONESTO: WhatsApp, iMessage e diversi altri programmi NON leggono
 *  le anteprime in SVG — mostrano solo titolo e descrizione, che restano
 *  corretti e personalizzati per ogni link. Dove l'anteprima grafica viene
 *  letta (Telegram, Slack, molte anteprime nei browser e nelle email) si vede
 *  questa. Per coprire anche WhatsApp servono tre immagini PNG caricate una
 *  volta nelle impostazioni: l'indirizzo è già pronto (?tipo=…&png=1).
 *
 *  GET ?tipo=preventivo|videochiamata|presentazione
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Tipo = "preventivo" | "videochiamata" | "presentazione";

const TESTI: Record<Tipo, { occhiello: string; titolo: string; sotto: string; icona: string }> = {
  preventivo: {
    occhiello: "HAIR GENIUS LABS",
    titolo: "Il tuo preventivo,\ncostruito insieme",
    sotto: "Scegli tu ogni dettaglio: il prezzo si aggiorna mentre decidi.",
    // foglio con riga: si legge come "documento" a qualsiasi dimensione
    icona: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5",
  },
  videochiamata: {
    occhiello: "HAIR GENIUS LABS",
    titolo: "La tua\nvideoconsulenza",
    sotto: "Un consulente ti guida dal vivo. Non serve installare nulla.",
    icona: "M23 7l-7 5 7 5V7z M1 5h15v14H1z",
  },
  presentazione: {
    occhiello: "HAIR GENIUS LABS",
    titolo: "Come funziona,\nspiegato bene",
    sotto: "Tre strade per rimettere i capelli. Le vediamo insieme.",
    icona: "M2 3h20v14H2z M8 21h8 M12 17v4",
  },
};

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const Route = createFileRoute("/api/og/card")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sp = new URL(request.url).searchParams;
        const tipo = (sp.get("tipo") || "preventivo") as Tipo;
        const t = TESTI[tipo] ?? TESTI.preventivo;

        // immagine caricata dal presentatore per QUESTO tipo: se c'è, vince —
        // è l'unica strada per avere l'anteprima anche su WhatsApp.
        try {
          const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", `og_${tipo}`).maybeSingle();
          const v = (data as { value?: string | null } | null)?.value;
          if (v && /^https?:\/\//i.test(v)) {
            return new Response(null, { status: 302, headers: { Location: v, "Cache-Control": "public, max-age=600" } });
          }
        } catch { /* si genera quella disegnata qui sotto */ }

        const righe = t.titolo.split("\n");
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#081634"/><stop offset="1" stop-color="#050f24"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.22" cy="0.18" r="0.7">
      <stop offset="0" stop-color="#3b82f6" stop-opacity="0.34"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <g stroke="#ffffff" stroke-opacity="0.05">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="630"/>`).join("")}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="1200" y2="${i * 100}"/>`).join("")}
  </g>
  <rect x="0" y="0" width="1200" height="4" fill="#3b82f6"/>
  <g transform="translate(88,96)">
    <rect x="0" y="0" width="96" height="96" rx="26" fill="#3b82f6"/>
    <g transform="translate(24,24) scale(2)" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="${t.icona}"/>
    </g>
  </g>
  <text x="208" y="140" font-family="Helvetica,Arial,sans-serif" font-size="26" letter-spacing="7" fill="#7fb2ff">${esc(t.occhiello)}</text>
  <text x="208" y="184" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="#ffffff" fill-opacity="0.45">Consulenza personalizzata</text>
  ${righe.map((r, i) => `<text x="88" y="${330 + i * 82}" font-family="Helvetica,Arial,sans-serif" font-size="72" font-weight="bold" fill="#ffffff">${esc(r)}</text>`).join("\n  ")}
  <text x="88" y="${330 + righe.length * 82 + 24}" font-family="Helvetica,Arial,sans-serif" font-size="30" fill="#ffffff" fill-opacity="0.62">${esc(t.sotto)}</text>
  <rect x="88" y="556" width="120" height="6" rx="3" fill="#3b82f6"/>
</svg>`;

        return new Response(svg, {
          headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
        });
      },
    },
  },
});
