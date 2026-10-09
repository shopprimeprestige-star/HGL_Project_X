/** ── LA PORTA D'INGRESSO, LATO CLIENTE ─────────────────────────────────────
 *
 *  Segnalazione del committente: «quando una persona entra rimane in attesa e
 *  non entra mai».
 *
 *  Fino a ieri la bussata e il via libera passavano SOLO dal canale in tempo
 *  reale: se quel filo non c'è — rete mobile, wifi che chiude i websocket,
 *  telefono che mette in pausa la scheda, scheda del consulente ricaricata —
 *  il cliente resta davanti a «sei in sala d'attesa» per sempre. Qui c'è la
 *  seconda strada: chi aspetta si SCRIVE nella riga della consulenza e rilegge
 *  la decisione presa per lui.
 *
 *  POST { sess, pid, nome?, dev? } -> { ok, stato }   busso (e richiedo lo stato)
 *  GET  ?sess=&pid=&dev=           -> { ok, stato }   com'è andata?
 *
 *  `stato`: "attesa" | "ammesso" | "rifiutato" | "sconosciuto"
 *
 *  ── ⚠️ PERCHÉ È UNA ROTTA PUBBLICA ───────────────────────────────────────
 *  Perché chi bussa è un cliente: non ha nessuna credenziale, ha solo il link
 *  della sua stanza. Il codice della stanza È la credenziale, come già per
 *  tutto il resto della pagina del cliente (i prezzi, il preventivo, lo stato
 *  della sessione). Chi non ce l'ha non può né bussare né sapere niente.
 *  ⚠️ E NON SI RESTITUISCE MAI LA LISTA: da qui esce soltanto lo stato di CHI
 *   sta chiedendo. Il nome degli altri clienti in attesa è roba del
 *   consulente, e sta dietro alla sua sessione (api.presenter.sala-attesa).
 *  ⚠️ NIENTE SCRITTURE FUORI DALLA PROPRIA RIGA: un `pid` non può decidere per
 *   un altro. Il via libera lo dà solo la rotta del presentatore.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveSessione } from "@/shop/chiave-sessione";
import { BASE_SALA, bussa, leggiSala, scriviSala, statoDi } from "@/shop/sala-attesa";

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

/** La porta su `app_config`. ⚠️ QUI C'ERA UN CAST — «la tabella è nata dopo
 *  l'ultima generazione dei tipi» — e non serve più: i tipi sono stati
 *  rigenerati dallo schema vero, quindi `app_config` è tipizzata e i nomi
 *  delle colonne tornano a essere controllati (era il buco che nascondeva una
 *  query sulla tabella `quotes`, che non esiste). */
export const configSala = () => supabaseAdmin.from("app_config");

export const chiaveSala = (code: unknown): string => chiaveSessione(BASE_SALA, code);

export async function leggiRigaSala(code: string) {
  const { data } = await configSala().select("value").eq("key", chiaveSala(code)).maybeSingle();
  return leggiSala(data?.value ?? null);
}
export async function scriviRigaSala(code: string, persone: Parameters<typeof scriviSala>[0]) {
  const { error } = await configSala().upsert(
    { key: chiaveSala(code), value: scriviSala(persone), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  return error?.message ?? "";
}

export const Route = createFileRoute("/api/public/sala-attesa")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const u = new URL(request.url);
        const sess = String(u.searchParams.get("sess") || "").trim();
        const pid = String(u.searchParams.get("pid") || "").trim();
        if (!sess || !pid) return json({ ok: false, reason: "manca la stanza" }, 400);
        const persone = await leggiRigaSala(sess);
        return json({ ok: true, stato: statoDi(persone, { pid, dev: String(u.searchParams.get("dev") || "") }) });
      },

      POST: async ({ request }) => {
        let b: { sess?: string; pid?: string; nome?: string; dev?: string; persona?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo illeggibile */ }
        const sess = String(b.sess || "").trim();
        const pid = String(b.pid || "").trim();
        if (!sess || !pid) return json({ ok: false, reason: "manca la stanza" }, 400);
        const prima = await leggiRigaSala(sess);
        /*  ── ⚠️ SE LA DECISIONE C'È GIÀ, NON SI SCRIVE NIENTE ────────────
            Chi è appena stato fatto entrare continua a bussare per qualche
            secondo (il via libera e la sua bussata si incrociano): riscrivere
            la riga a ogni bussata vorrebbe dire una scrittura al secondo per
            ogni persona dentro, e soprattutto una corsa con la decisione del
            consulente. Se lo stato è già deciso si risponde e basta. */
        const stato = statoDi(prima, { pid, dev: String(b.dev || "") });
        if (stato === "ammesso" || stato === "rifiutato") return json({ ok: true, stato });
        /*  ⚠️ LETTURA-MODIFICA-SCRITTURA, senza transazione: due clienti che
            bussano nello stesso istante possono sovrascriversi. Va bene così —
            chi aspetta ribussa ogni quattro secondi, quindi una scrittura persa
            si rimette da sé al giro dopo — e l'alternativa (una tabella con un
            lock) vorrebbe dire una migrazione su un archivio di produzione. */
        const dopo = bussa(prima, { pid, nome: String(b.nome || ""), dev: String(b.dev || ""), persona: String(b.persona || "") });
        const errore = await scriviRigaSala(sess, dopo);
        if (errore) return json({ ok: false, reason: errore }, 500);
        return json({ ok: true, stato: statoDi(dopo, { pid, dev: String(b.dev || "") }) });
      },
    },
  },
});
