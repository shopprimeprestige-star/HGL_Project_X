/** Stato AUTOREVOLE del preventivo mostrato dal presentatore (mirror ospite).
 *
 *  Perché esiste: la pagina /preventivo può girare in PIÙ contesti JS sullo stesso
 *  dispositivo del presentatore (finestra esterna + iframe dell'anteprima, schede
 *  rimaste aperte, il breve istante in cui DeviceFrame monta i children e poi
 *  l'iframe). Se due contesti trasmettono sul canale realtime, l'ospite riceve
 *  due stati DIVERSI a raffica e lampeggia fra "preventivo creato" e
 *  "creazione preventivo" ~1 volta al secondo. Arbitrare fra trasmettitori sul
 *  canale non ha funzionato: qui il SERVER tiene UN SOLO valore e fa da giudice,
 *  esattamente come /api/presenter/curpage fa per la navigazione.
 *
 *  GET  -> { state: <snapshot|null>, ts: number }
 *  POST <snapshot con ts> -> salva SOLO se ts >= ts memorizzato (uno stato vecchio
 *                            di un contesto stantio non può sovrascrivere il nuovo)
 *  app_config.key = 'quote_state'
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, autorizzaPresentatore } from "./api.presenter.consultant";
import { chiaveSessione } from "@/shop/chiave-sessione";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const KEY = "quote_state";

/*  ── ⚠️ UNA RIGA PER CONSULENZA ──────────────────────────────────────────
    Qui il server fa da giudice fra i contesti dello STESSO presentatore, e per
    quello bastava una riga sola. Ma la riga era una per TUTTI: due consulenti
    in diretta nello stesso momento si rispecchiavano il preventivo a vicenda —
    e quel preventivo si porta dietro la scheda del cliente. Adesso la riga
    porta il codice della consulenza; senza codice resta quella storica, per
    chi sta lavorando nel momento della pubblicazione. */
const chiaveDi = (sess: unknown) => chiaveSessione(KEY, sess);

type Snap = Record<string, unknown> & { ts?: number; sess?: string };

// ── I DATI DEL CLIENTE NON ESCONO SENZA CREDENZIALE ─────────────────────────
//  Questo stato serve a rispecchiare il preventivo sullo schermo dell'ospite,
//  e per farlo si porta dietro la scheda del cliente: nome, cognome, telefono,
//  email, età e le note — che in questo mestiere contengono informazioni
//  sanitarie ("chemio", "dermatiti"). Finora usciva a chiunque conoscesse
//  l'indirizzo, senza chiedere nulla.
//
//  Chi ha diritto di vederla, e perché:
//   · il PRESENTATORE, riconosciuto dalla sua sessione;
//   · l'OSPITE della stanza, riconosciuto dal codice della consulenza — che ha
//     in mano perché sta nell'indirizzo della sua stanza, e che nessun altro
//     conosce (tre gruppi di lettere sorteggiate).
//  A tutti gli altri lo stato esce SENZA la scheda: il preventivo si rispecchia
//  lo stesso, i dati personali no.
//  `sess` sta in questo elenco per un motivo che è facile mancare: è la
//  credenziale stessa. Lasciarlo nella risposta ridotta avrebbe consegnato a
//  chiunque la chiave per richiedere la versione completa.
const RISERVATI = ["profile", "cliente", "lead", "sess"];

function senzaDatiPersonali(s: Snap | null): Snap | null {
  if (!s) return null;
  const copia: Snap = { ...s };
  for (const k of RISERVATI) delete copia[k];
  return copia;
}

function leggiSnap(raw: unknown): Snap | null {
  if (!raw || typeof raw !== "string") return null;
  try { const p = JSON.parse(raw) as Snap; return p && typeof p === "object" ? p : null; } catch { return null; }
}

async function read(sess?: unknown): Promise<Snap | null> {
  const chiave = chiaveDi(sess);
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", chiave).maybeSingle();
  const suo = leggiSnap((data as { value?: string | null } | null)?.value);
  if (suo || chiave === KEY) return suo;
  //  Ripiego sulla riga storica, ma solo se parla DI QUESTA consulenza: è
  //  condivisa, e restituirla comunque vorrebbe dire consegnare il preventivo
  //  di un altro cliente.
  const { data: vecchia } = await supabaseAdmin.from("app_config").select("value").eq("key", KEY).maybeSingle();
  const v = leggiSnap((vecchia as { value?: string | null } | null)?.value);
  const stesso = String(v?.sess || "").trim().toLowerCase() === String(sess || "").trim().toLowerCase();
  return v && stesso ? v : null;
}

export const Route = createFileRoute("/api/presenter/quotestate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const chiesto = new URL(request.url).searchParams.get("sess")?.trim().toLowerCase() || "";
        const state = await read(chiesto);
        const ts = Number(state?.ts) || 0;
        if (!state) return json({ state: null, ts: 0 });

        //  Il codice della stanza arriva come ?sess=; il confronto è con quello
        //  registrato dal presentatore insieme allo stato, quindi un codice di
        //  un'altra consulenza non apre questa.
        const suo = String(state.sess || "").trim().toLowerCase();
        const ospiteDellaStanza = Boolean(suo) && chiesto === suo;
        const presentatore = ospiteDellaStanza ? null : await autorizzaPresentatore(request);

        if (ospiteDellaStanza || presentatore) return json({ state, ts });
        return json({ state: senzaDatiPersonali(state), ts, ridotto: true });
      },
      POST: async ({ request }) => {
        let body: Snap | null = null;
        try { body = (await request.json()) as Snap; } catch { /* ignore */ }
        if (!body || typeof body !== "object") return json({ ok: false, reason: "bad_body" });
        const ts = Number(body.ts) || 0;
        if (!ts) return json({ ok: false, reason: "no_ts" });
        const cur = await read(body.sess);
        const curTs = Number(cur?.ts) || 0;
        // scrittura più VECCHIA di quella memorizzata → ignorata (contesto stantio)
        if (ts < curTs) return json({ ok: true, ignored: true, ts: curTs });
        await supabaseAdmin
          .from("app_config")
          .upsert({ key: chiaveDi(body.sess), value: JSON.stringify(body), updated_at: new Date().toISOString() } as never, { onConflict: "key" });
        return json({ ok: true, ts });
      },
    },
  },
});
