/** ── LA SCATOLA NERA DEI COLLEGAMENTI MEETLY, LATO SERVER (31/10/2026) ──────
 *
 *  POST { sess, rapporto } -> { ok }   (pubblica: la chiamano i browser dei clienti)
 *  GET                      -> { ok, righe, mancaTabella? }   (solo gestionale)
 *
 *  Il perché sta in shop/scatola-nera.ts. Qui c'è solo il filo con l'archivio.
 *
 *  ⚠️ RISPONDE SEMPRE «ok» AL POST, ANCHE QUANDO NON SALVA. Il browser che
 *   manda il rapporto sta tentando di collegare una consulenza: l'ultima cosa
 *   che serve è che un errore della scatola nera lo disturbi. Le uniche
 *   risposte diverse sono quelle che dicono «non è roba mia» (corpo troppo
 *   grosso, rapporto illeggibile, troppi invii).
 *  ⚠️ NON SI FIDA DI CIÒ CHE ARRIVA: il rapporto passa di nuovo da
 *   `pulisciRapporto` (elenco di campi ammessi, indirizzi tolti) prima di
 *   toccare l'archivio.
 *  ⚠️ IL CODICE DELLA STANZA NON SI SALVA: ne resta un'impronta.
 *  ⚠️ SENZA LA MIGRAZIONE (tabella assente) non si rompe niente: l'insert
 *   fallisce in silenzio e il GET dice `mancaTabella`. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  FINESTRA_MIN,
  GIORNI_CONSERVAZIONE,
  LIMITE_BYTE,
  LIMITE_GLOBALE,
  LIMITE_PER_STANZA,
  codiceStanzaValido,
  pulisciRapporto,
} from "@/shop/scatola-nera";
import { chiamanteCRM } from "./api.crm.accesso";

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

// shortcut: la tabella non è nei tipi generati finché la migrazione non è applicata, quindi
//  si passa da un client non tipizzato; da togliere quando types.ts verrà rigenerato.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any;

/** Impronta del codice stanza: 12 caratteri esadecimali di uno SHA-256. */
async function improntaStanza(sess: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`meetly-diagnosi:${sess}`));
  return Array.from(new Uint8Array(h).slice(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
}

//  Solo i due codici di «tabella inesistente» (Postgres e PostgREST): un «permission denied» o un
//  altro errore non deve passare per una migrazione mancante.
const TABELLA_ASSENTE = (e: { code?: string } | null | undefined) => e?.code === "42P01" || e?.code === "PGRST205";

export const Route = createFileRoute("/api/public/meetly-diagnosi")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        // ── 1. dimensione: si guarda l'intestazione PRIMA di leggere, e di nuovo dopo ──
        //  Senza `content-length` valido non si legge niente: un corpo enorme costa più del rapporto.
        const lunghezza = Number(request.headers.get("content-length"));
        if (!Number.isFinite(lunghezza) || lunghezza <= 0 || lunghezza > LIMITE_BYTE)
          return json({ ok: false, motivo: "dimensione" }, 413);
        const testo = await request.text().catch(() => "");
        if (!testo || testo.length > LIMITE_BYTE) return json({ ok: false, motivo: "dimensione" }, 413);
        let corpo: { sess?: unknown; rapporto?: unknown } = {};
        try {
          corpo = JSON.parse(testo);
        } catch {
          return json({ ok: false, motivo: "illeggibile" }, 400);
        }
        const rapporto = pulisciRapporto(corpo.rapporto);
        if (!rapporto || !codiceStanzaValido(corpo.sess)) return json({ ok: false, motivo: "non valido" }, 400);

        try {
          const stanza = await improntaStanza(corpo.sess as string);
          // ── 2. frequenza per stanza ──────────────────────────────────────
          // shortcut: il conteggio e l'inserimento non sono atomici, quindi due invii nello stesso
          //  istante possono superare il tetto di uno: basta a fermare un ciclo, non serve di più.
          const da = new Date(Date.now() - FINESTRA_MIN * 60_000).toISOString();
          const { count } = await db()
            .from("meetly_diagnosi")
            .select("id", { count: "exact", head: true })
            .eq("stanza", stanza)
            .gte("creato_il", da);
          if ((count ?? 0) >= LIMITE_PER_STANZA) return json({ ok: false, motivo: "troppi" }, 429);
          // ── 2b. tetto globale: il codice stanza lo sceglie chi chiama, ruotarlo non deve bastare ──
          const { count: tutti } = await db()
            .from("meetly_diagnosi")
            .select("id", { count: "exact", head: true })
            .gte("creato_il", da);
          if ((tutti ?? 0) >= LIMITE_GLOBALE) return json({ ok: false, motivo: "troppi" }, 429);

          // ── 3. si salva; un doppione (stesso rid+tipo) viene scartato dall'indice unico ──
          const rete = [rapporto.rete.tipo, rapporto.rete.effettiva].filter(Boolean).join(" ");
          await db().from("meetly_diagnosi").insert({
            stanza,
            rid: rapporto.rid,
            tipo: rapporto.tipo,
            ruolo: rapporto.ruolo,
            browser: rapporto.browser,
            sistema: rapporto.sistema,
            rete,
            dati: rapporto,
          });

          // ── 4. pulizia: ogni tanto, senza cron ───────────────────────────
          if (Math.random() < 0.02) {
            const scadute = new Date(Date.now() - GIORNI_CONSERVAZIONE * 86_400_000).toISOString();
            await db().from("meetly_diagnosi").delete().lt("creato_il", scadute);
          }
        } catch {
          /* la scatola nera non deve mai disturbare la consulenza */
        }
        return json({ ok: true });
      },

      GET: async ({ request }) => {
        // Lettura riservata: stesso permesso che serve per salvare il server TURN.
        const chi = await chiamanteCRM(request);
        if (!chi?.accesso.puo("consulenti")) return json({ error: "non autorizzato" }, 401);
        const { data, error } = await db()
          .from("meetly_diagnosi")
          .select("id, creato_il, stanza, rid, tipo, ruolo, browser, sistema, rete, dati")
          .order("creato_il", { ascending: false })
          .limit(50);
        if (error) {
          if (TABELLA_ASSENTE(error)) return json({ ok: true, righe: [], mancaTabella: true });
          return json({ ok: false, error: "lettura non riuscita" }, 500);
        }
        return json({ ok: true, righe: data ?? [] });
      },
    },
  },
});
