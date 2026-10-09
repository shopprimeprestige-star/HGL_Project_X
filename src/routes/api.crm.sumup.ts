/** ── LE CHIAVI DI SUMUP ────────────────────────────────────────────────────
 *
 *  GET  → c'è una chiave? quali sono le ultime quattro cifre? funziona?
 *  POST → la salva, o la cancella.
 *
 *  ⚠️ La chiave non torna MAI indietro: solo le ultime quattro cifre. Chi ha
 *   quella stringa incassa sul conto di chi l'ha messa. Stessa regola della
 *   chiave OpenRouter, per lo stesso motivo, e il campo parte sempre vuoto —
 *   vuoto vuol dire «non l'ho toccata».
 */
import { createFileRoute } from "@tanstack/react-router";
import { dimenticaConfigSumUp, leggiConfigSumUp, salvaConfigSumUp } from "@/prova/sumup.server";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";

const PERMESSO = "impostazioni" as const;
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function guardia(request: Request): Promise<Response | null> {
  const chi = await chiamanteCRM(request);
  if (!chi) return nonAutenticatoCRM({});
  if (!chi.accesso.puo(PERMESSO)) return vietatoCRM({}, PERMESSO);
  return null;
}

export const Route = createFileRoute("/api/crm/sumup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const no = await guardia(request);
        if (no) return no;
        const c = await leggiConfigSumUp();
        const url = new URL(request.url);

        //  ── LA PROVA VERA ───────────────────────────────────────────────
        //  «Salvato» non vuol dire «funziona»: una chiave scaduta si salva
        //  benissimo, e ce ne si accorge quando un cliente non riesce a
        //  pagare. Qui si chiede davvero a SumUp chi siamo.
        if (url.searchParams.get("azione") === "prova") {
          if (!c.pronto) return json({ ok: false, errore: "Manca la chiave o il codice esercente." });
          try {
            const r = await fetch("https://api.sumup.com/v0.1/me", {
              headers: { Authorization: `Bearer ${c.apiKey}` },
            });
            const b = (await r.json()) as { account?: { username?: string }; merchant_profile?: { merchant_code?: string; company_name?: string } };
            if (!r.ok) return json({ ok: false, errore: `SumUp ha risposto ${r.status}` });
            const codiceVero = String(b.merchant_profile?.merchant_code || "");
            //  ⚠️ Si controlla che il codice esercente sia QUELLO GIUSTO: con
            //   un codice di un altro conto SumUp accetta la chiave e rifiuta
            //   ogni pagamento, e l'errore si vede solo alla cassa.
            if (codiceVero && codiceVero !== c.merchantCode) {
              return json({
                ok: false,
                errore: `Il codice esercente non combacia: su SumUp questo conto è ${codiceVero}.`,
              });
            }
            return json({
              ok: true,
              chi: b.merchant_profile?.company_name || b.account?.username || "conto SumUp",
            });
          } catch (e) {
            return json({ ok: false, errore: String((e as Error).message || e) });
          }
        }

        return json({
          ok: true,
          pronto: c.pronto,
          ultime: c.apiKey ? c.apiKey.slice(-4) : "",
          merchantCode: c.merchantCode,
        });
      },

      POST: async ({ request }) => {
        const no = await guardia(request);
        if (no) return no;
        let b: { apiKey?: string; merchantCode?: string; dimentica?: boolean };
        try { b = (await request.json()) as typeof b; } catch { return json({ error: "richiesta illeggibile" }, 400); }
        if (b.dimentica) {
          await dimenticaConfigSumUp();
          return json({ ok: true, pronto: false });
        }
        await salvaConfigSumUp({ apiKey: b.apiKey, merchantCode: b.merchantCode });
        const c = await leggiConfigSumUp();
        return json({ ok: true, pronto: c.pronto, ultime: c.apiKey.slice(-4), merchantCode: c.merchantCode });
      },
    },
  },
});
