/** ── LA PAGINA ORDINE, PER LE PAGINE ────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T55 (PIANO-R2 §3.3, D48). Solo l'involucro `createServerFn` di `ordine-pubblico.server.ts`
 *  (provato con un finto database): collega `supabaseAdmin`, la chiave di servizio e l'indirizzo di chi chiede.
 *  POST, così la chiave `t` non finisce in un indirizzo, in un log o in un referrer. Intestazioni su OGNI risposta, rifiuto compreso:
 *  `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`.
 *  Mai un errore verso il pubblico: ogni guasto è il rifiuto `{ok:false}` di sempre.
 *  I testi confermati: la fonte (l'editor dei testi) è di V1(b); finché non c'è, la porta risponde `{}` e la pagina nasconde le righe. */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import {
  ordinePubblico as leggiOrdine,
  type DbOrdinePubblico,
  type RispostaOrdinePubblica,
} from "./ordine-pubblico.server";

/** L'indirizzo di chi chiede (Cloudflare lo mette in `cf-connecting-ip`). Serve solo al limite, che lo trasforma subito in HMAC. */
function indirizzo(): string | null {
  try {
    return (
      getRequestHeader("cf-connecting-ip") ||
      (getRequestHeader("x-forwarded-for") ?? "").split(",")[0].trim() ||
      null
    );
  } catch {
    return null;
  }
}

export const ordinePubblico = createServerFn({ method: "POST" })
  // i tetti: un riferimento vero ha 9 segni e una chiave 43; più lunghi non sono mai validi, e si tagliano prima di arrivare al server
  .inputValidator((d: { ref?: unknown; t?: unknown }) => ({
    ref: typeof d?.ref === "string" ? d.ref.slice(0, 40) : "",
    t: typeof d?.t === "string" ? d.t.slice(0, 200) : "",
  }))
  .handler(async ({ data }): Promise<RispostaOrdinePubblica> => {
    try {
      setResponseHeader("Cache-Control", "private, no-store");
      setResponseHeader("Referrer-Policy", "no-referrer");
      setResponseHeader("X-Robots-Tag", "noindex");
    } catch {
      /* fuori da una richiesta (prove, prerender): niente intestazioni */
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      return await leggiOrdine(
        {
          db: supabaseAdmin as unknown as DbOrdinePubblico,
          chiaveServizio: process.env.SUPABASE_SERVICE_ROLE_KEY,
          adesso: () => Date.now(),
          ip: indirizzo(),
          log: (codice) => console.warn("shop-ordine", codice),
          testiConfermati: async () => ({}),
        },
        data,
      );
    } catch {
      return { ok: false };
    }
  });
