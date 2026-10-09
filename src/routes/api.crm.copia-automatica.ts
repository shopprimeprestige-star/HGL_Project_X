/** ── LA COPIA DI SICUREZZA CHE SI FA DA SOLA ───────────────────────────────
 *
 *  La copia completa del CRM e di Meetly esisteva già ed è fatta bene
 *  (api.crm.backup): esporta lead, preventivi, fatture, impostazioni, e sa
 *  rimetterli dentro. Ma era **soltanto un pulsante**: nessun lavoro
 *  automatico la chiamava, e in archivio ci sono più di mille schede cliente e
 *  tutte le trattative. Su Supabase non c'è il ripristino a un istante
 *  preciso: una cancellazione sbagliata, oggi, è definitiva.
 *
 *  ── PERCHÉ NON UN «CRON» ─────────────────────────────────────────────────
 *  Perché aggiungerne uno vorrebbe dire mettere le mani nell'ingresso del
 *  Worker (`dist/server/server.js` lo genera la costruzione) e legare la
 *  pubblicazione a un pezzo scritto a mano: il giorno in cui il generatore
 *  cambia forma, non si pubblica più. Un lavoro programmato altrove
 *  (GitHub Actions) vorrebbe dire far uscire i dati dei clienti verso un
 *  altro servizio, e metterli in un repository non si fa.
 *
 *  Si fa invece dove il lavoro c'è già: **quando qualcuno apre il CRM**. La
 *  prima apertura della giornata deposita la copia; le altre non fanno niente.
 *  Nei giorni in cui non lavora nessuno non cambia neanche niente da salvare.
 *
 *  ⚠️ LA COPIA NON DEVE POTER RALLENTARE IL CRM: chi chiama non aspetta la
 *   risposta, e se qualcosa va storto si risponde comunque «ok, non ora».
 *  ⚠️ NON ESCE NIENTE DI SEGRETO: il file è quello di `costruisciCopia`, che
 *   lascia fuori PIN, token e chiavi (vedi le tre regole in api.crm.backup).
 *  ⚠️ IL CONTENITORE È PRIVATO. Dentro ci sono nomi, telefoni ed email di
 *   clienti veri: un contenitore pubblico sarebbe una fuga di dati servita su
 *   un indirizzo indovinabile. Si crea privato, e si legge solo da qui.
 *  ⚠️ E NON CRESCE PER SEMPRE: restano le ultime `QUANTE_NE_TENGO`. Una copia
 *   di tre mesi fa non serve a nessuno e occupa lo spazio del piano.
 *
 *  GET  → { ultima, quante } per dirlo in Impostazioni
 *  POST → la fa, se è ora. { fatta, ultima, motivo }
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";
import { costruisciCopia } from "./api.crm.backup";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-crm-token, x-crm-pin",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const CONTENITORE = "copie-di-sicurezza";
/** Ogni quanto ha senso rifarla. Venti ore e non ventiquattro: chi apre il CRM
 *  alle 8:30 di lunedì non deve trovarsi la copia saltata perché venerdì
 *  l'aveva aperto alle 8:45. */
const ORE_MINIME = 20;
/** Quante se ne tengono. Due settimane di lavoro: abbastanza per accorgersi di
 *  un danno fatto qualche giorno prima, non tanto da riempire il piano. */
const QUANTE_NE_TENGO = 14;
/** Dove si segna l'ultima, per non doverle elencare tutte a ogni apertura. */
const CHIAVE_ULTIMA = "copia_automatica_ultima";

async function ultimaCopia(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", CHIAVE_ULTIMA)
    .maybeSingle();
  return String(data?.value ?? "");
}

export const Route = createFileRoute("/api/crm/copia-automatica")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "archivio");
        if (!g.ok) return g.risposta;
        const { data } = await supabaseAdmin.storage.from(CONTENITORE).list("", { limit: 100 });
        return json({ ultima: await ultimaCopia(), quante: (data ?? []).length });
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "archivio");
        if (!g.ok) return g.risposta;

        const ultima = await ultimaCopia();
        const passate = ultima ? (Date.now() - Date.parse(ultima)) / 3_600_000 : Infinity;
        if (Number.isFinite(passate) && passate < ORE_MINIME)
          return json({ fatta: false, ultima, motivo: "già fatta di recente" });

        try {
          //  Il contenitore si crea la prima volta e poi la chiamata fallisce
          //  in silenzio, che è quello che deve fare: PRIVATO, sempre.
          await supabaseAdmin.storage.createBucket(CONTENITORE, { public: false }).catch(() => {});

          const copia = await costruisciCopia();
          const adesso = new Date().toISOString();
          const nome = `crm-${adesso.slice(0, 19).replace(/[:T]/g, "-")}.json`;
          const { error } = await supabaseAdmin.storage
            .from(CONTENITORE)
            .upload(nome, new TextEncoder().encode(JSON.stringify(copia)), {
              contentType: "application/json",
              upsert: true,
            });
          if (error) return json({ fatta: false, ultima, motivo: error.message });

          await supabaseAdmin
            .from("app_config")
            .upsert({ key: CHIAVE_ULTIMA, value: adesso, updated_at: adesso }, { onConflict: "key" });

          //  ── SI TENGONO LE ULTIME, NON TUTTE ───────────────────────────
          //   I nomi cominciano con la data in forma ordinabile, quindi
          //   l'ordine alfabetico È l'ordine del tempo: le più vecchie stanno
          //   in testa e sono le prime a uscire.
          const { data: tutte } = await supabaseAdmin.storage.from(CONTENITORE).list("", { limit: 200 });
          const vecchie = (tutte ?? [])
            .map((f) => f.name)
            .filter((n) => n.endsWith(".json"))
            .sort()
            .slice(0, Math.max(0, (tutte ?? []).length - QUANTE_NE_TENGO));
          if (vecchie.length) await supabaseAdmin.storage.from(CONTENITORE).remove(vecchie);

          const righe = Number((copia as { conteggi?: Record<string, number> }).conteggi?.lead ?? 0);
          console.log(`[COPIA] fatta ${nome} (${righe} lead) · tolte ${vecchie.length} vecchie`);
          return json({ fatta: true, ultima: adesso, nome, tolte: vecchie.length });
        } catch (e) {
          //  Una copia che non riesce non deve rompere l'apertura del CRM: si
          //  dice, si scrive nei log, e si riproverà alla prossima apertura.
          const motivo = e instanceof Error ? e.message : String(e);
          console.error("[COPIA] non riuscita:", motivo);
          return json({ fatta: false, ultima, motivo });
        }
      },
    },
  },
});
