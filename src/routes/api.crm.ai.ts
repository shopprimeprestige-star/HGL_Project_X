/** ── LA CHIAVE DELL'INTELLIGENZA ARTIFICIALE ───────────────────────────────
 *
 *  GET  → com'è messa: c'è una chiave? quali sono le ultime quattro cifre? che
 *         modello verrebbe usato? funziona davvero?
 *  POST → la salva, o la cancella.
 *
 *  ── ⚠️ LA CHIAVE NON TORNA MAI INDIETRO ──────────────────────────────────
 *  Il server restituisce solo le ultime quattro cifre, mai la chiave intera.
 *  Chi ha quella stringa può spendere sul conto di chi l'ha messa: rimandarla
 *  al browser a ogni apertura della pagina vuol dire lasciarla in giro nella
 *  memoria del browser, nella cronologia della rete e nelle estensioni, per
 *  niente — perché nessuno la deve rileggere, la deve solo sostituire.
 *  Per lo stesso motivo il campo parte sempre vuoto: vuoto vuol dire «non l'ho
 *  toccata», e solo scrivendoci dentro la si cambia.
 *
 *  ── ⚠️ E SI PROVA SUL SERIO ──────────────────────────────────────────────
 *  «Salvato» non vuol dire «funziona»: una chiave scaduta si salva benissimo.
 *  Il tasto «Prova adesso» chiede davvero a OpenRouter chi è, e riporta quello
 *  che risponde — compreso il credito residuo, che è la prima cosa che manca
 *  quando le immagini smettono di uscire.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";

/** ⚠️ Il permesso è «impostazioni», lo stesso delle altre chiavi del
 *  gestionale: questa è una chiave di SPESA — ogni immagine costa — e non ha
 *  niente a che vedere con il mestiere di chi lavora i lead. */
const PERMESSO = "impostazioni" as const;

async function guardia(request: Request): Promise<Response | null> {
  const chi = await chiamanteCRM(request);
  if (!chi) return nonAutenticatoCRM({});
  if (!chi.accesso.puo(PERMESSO)) return vietatoCRM({}, PERMESSO);
  return null;
}

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const CHIAVE_CONFIG = "ai_config";

export interface ConfigAI {
  /** la chiave di OpenRouter */
  apiKey: string;
  /** un modello imposto a mano; vuoto = lo sceglie il server fra quelli
   *  disponibili, che è quello che si vuole quasi sempre */
  modello: string;
}

/** ⚠️ Legge PRIMA le impostazioni e POI la variabile d'ambiente. L'ordine
 *  conta: chi cambia la chiave dalle impostazioni si aspetta che valga da
 *  subito, e una variabile d'ambiente vecchia che vincesse sopra renderebbe
 *  quella pagina una bugia — si salva, non cambia niente, e non c'è modo di
 *  capire perché. */
export async function leggiConfigAI(): Promise<ConfigAI & { pronto: boolean }> {
  let salvata: Partial<ConfigAI> = {};
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", CHIAVE_CONFIG).maybeSingle();
    salvata = JSON.parse((data as { value?: string } | null)?.value ?? "{}") || {};
  } catch { /* nessuna configurazione: si ripiega sull'ambiente */ }

  const apiKey = String(salvata.apiKey || "").trim() || String(process.env.OPENROUTER_API_KEY || "").trim();
  return {
    apiKey,
    modello: String(salvata.modello || "").trim(),
    //  ⚠️ «Pronto» vuol dire PIENA, non «esiste». Il segreto era stato caricato
    //   vuoto una volta: il nome c'era, il valore no, e tutto rispondeva di sì
    //   mentre ogni generazione sarebbe fallita.
    pronto: apiKey.length > 10,
  };
}

async function scrivi(c: Partial<ConfigAI>): Promise<void> {
  const attuale = await leggiConfigAI();
  const nuova: ConfigAI = {
    //  La chiave si sovrascrive solo se ne arriva una nuova: il campo vuoto
    //  vuol dire «non l'ho toccata».
    apiKey: c.apiKey !== undefined ? String(c.apiKey) : attuale.apiKey,
    modello: c.modello !== undefined ? String(c.modello).trim().slice(0, 80) : attuale.modello,
  };
  await supabaseAdmin.from("app_config").upsert(
    { key: CHIAVE_CONFIG, value: JSON.stringify(nuova) } as never,
    { onConflict: "key" },
  );
}

/** Le ultime quattro cifre, per farsi riconoscere senza farsi copiare. */
const coda = (k: string) => (k.length > 8 ? `…${k.slice(-4)}` : k ? "…" : "");

export const Route = createFileRoute("/api/crm/ai")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const no = await guardia(request);
        if (no) return no;

        const c = await leggiConfigAI();
        const url = new URL(request.url);

        //  ── LA PROVA VERA ───────────────────────────────────────────────
        if (url.searchParams.get("azione") === "prova") {
          if (!c.pronto) return json({ ok: false, errore: "Non c'è nessuna chiave da provare." });
          try {
            const r = await fetch("https://openrouter.ai/api/v1/key", {
              headers: { Authorization: `Bearer ${c.apiKey}` },
            });
            if (!r.ok) {
              return json({
                ok: false,
                errore: r.status === 401
                  ? "OpenRouter non riconosce questa chiave: è sbagliata o è stata revocata."
                  : `OpenRouter ha risposto ${r.status}.`,
              });
            }
            const d = (await r.json()) as {
              data?: { label?: string; limit?: number | null; usage?: number };
            };
            const limite = d.data?.limit;
            const speso = Number(d.data?.usage || 0);
            return json({
              ok: true,
              etichetta: String(d.data?.label || ""),
              speso,
              //  Un limite assente vuol dire «nessun tetto», non «zero»: sono
              //  due cose opposte, e confonderle fa credere di essere a secco.
              residuo: typeof limite === "number" ? Math.max(0, limite - speso) : null,
            });
          } catch (e) {
            return json({ ok: false, errore: String((e as Error).message || e) });
          }
        }

        //  ── QUALI MODELLI CI SONO ───────────────────────────────────────
        //   Solo quelli che sanno restituire un'IMMAGINE: sono gli unici che
        //   servono alla prova capelli, e un elenco da quattrocento voci dove
        //   trecentonovanta non funzionano non è una scelta, è una trappola.
        if (url.searchParams.get("azione") === "modelli") {
          try {
            const r = await fetch("https://openrouter.ai/api/v1/models");
            if (!r.ok) return json({ ok: false, errore: `Elenco modelli ${r.status}` });
            const corpo = (await r.json()) as {
              data?: { id?: string; name?: string; architecture?: { output_modalities?: string[] } }[];
            };
            const modelli = (corpo.data || [])
              .filter((m) => (m.architecture?.output_modalities || []).includes("image"))
              .filter((m) => m.id && !m.id.startsWith("openrouter/auto"))
              .map((m) => ({ id: String(m.id), nome: String(m.name || m.id) }));
            return json({ ok: true, modelli });
          } catch (e) {
            return json({ ok: false, errore: String((e as Error).message || e) });
          }
        }

        return json({ ok: true, pronto: c.pronto, coda: coda(c.apiKey), modello: c.modello });
      },

      POST: async ({ request }) => {
        const no = await guardia(request);
        if (no) return no;

        let b: { apiKey?: string; modello?: string; cancella?: boolean };
        try {
          b = (await request.json()) as typeof b;
        } catch {
          return json({ error: "Richiesta illeggibile" }, 400);
        }

        if (b.cancella) {
          await scrivi({ apiKey: "", modello: "" });
          return json({ ok: true, pronto: false, coda: "", modello: "" });
        }

        const nuova = String(b.apiKey || "").trim();
        //  Una chiave di tre caratteri è un incollaggio andato male: si dice
        //  adesso, non alla prima immagine che non esce.
        if (nuova && nuova.length < 20) {
          return json({ error: "Questa chiave sembra incompleta: ricontrolla di averla incollata tutta." }, 400);
        }
        await scrivi({
          ...(nuova ? { apiKey: nuova } : {}),
          ...(b.modello !== undefined ? { modello: String(b.modello) } : {}),
        });
        const c = await leggiConfigAI();
        return json({ ok: true, pronto: c.pronto, coda: coda(c.apiKey), modello: c.modello });
      },
    },
  },
});
