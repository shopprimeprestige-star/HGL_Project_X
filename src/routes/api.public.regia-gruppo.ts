/** ── LA REGIA DI UNA CONSULENZA DI GRUPPO ──────────────────────────────────
 *
 *  Una riga per consulenza: il preventivo comune è acceso o spento, e in quale
 *  stanza la penna ce l'ha il consulente. Le regole stanno in
 *  shop/preventivi-di-gruppo; qui c'è solo chi può cambiare cosa.
 *
 *  GET  ?sess=CODICE                       -> { ok, regia }
 *  POST { sess, comune? , aperto?, penna? } -> { ok, regia }
 *
 *  ── ⚠️ CHI PUÒ CAMBIARE COSA ─────────────────────────────────────────────
 *  Quasi tutto è del consulente, e vuole la sua sessione: accendere il
 *  preventivo comune, aprire il preventivo di una persona, PRENDERE la penna.
 *  Una cosa sola è pubblica, ed è voluta: **ridare la penna al cliente**.
 *  È la regola del committente — «quando prendi la penna, può riprendersela» —
 *  e chi se la riprende è il cliente, che non ha nessuna credenziale: ha solo
 *  il codice della sua stanza, che qui fa da chiave come in tutto il resto
 *  della sua pagina.
 *  ⚠️ Restituire la penna non toglie niente a nessuno: al massimo il
 *   consulente smette di scrivere nel preventivo di un cliente. Il contrario —
 *   prenderla — resta dietro alla sessione, perché vuol dire mettere le mani
 *   nel preventivo di un altro.
 *  ⚠️ E si tocca solo chi è atteso in QUESTA stanza: un gettone inventato non
 *   crea una voce in archivio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveSessione } from "@/shop/chiave-sessione";
import { autorizzaPresentatore } from "./api.presenter.consultant";
import { attesiDellaStanza } from "./api.public.attesi";
import { consulenzaDiGruppo, gettoneDi } from "@/crm/fascia-consulenza";
import {
  BASE_REGIA,
  conAperto,
  conComune,
  conIndividuale,
  conLaPenna,
  leggiRegia,
  scriviRegia,
  type RegiaGruppo,
} from "@/shop/preventivi-di-gruppo";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Presenter-Code",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const chiaveRegia = (code: unknown) => chiaveSessione(BASE_REGIA, code);

export async function leggiRigaRegia(code: string): Promise<RegiaGruppo> {
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", chiaveRegia(code))
    .maybeSingle();
  return leggiRegia((data as { value?: string | null } | null)?.value ?? null);
}

async function scriviRigaRegia(code: string, r: RegiaGruppo) {
  const { error } = await supabaseAdmin.from("app_config").upsert(
    { key: chiaveRegia(code), value: scriviRegia(r), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  return error?.message ?? "";
}

export const Route = createFileRoute("/api/public/regia-gruppo")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const sess = String(new URL(request.url).searchParams.get("sess") || "").trim();
        if (!sess) return json({ ok: false, reason: "manca la stanza" }, 400);
        /*  ⚠️ `gruppo` viaggia con la regia, e non è un di più: la pagina del
            cliente deve sapere se è in una consulenza con altre persone —
            perché è solo lì che il preventivo comune nasce nascosto. Da sola,
            una persona non deve vedere veli che prima non c'erano
            (`cosaVede`). Viaggia qui dentro per non far chiedere due cose ogni
            tre secondi a ogni cliente collegato. */
        const [regia, attesi] = await Promise.all([leggiRigaRegia(sess), attesiDellaStanza(sess)]);
        return json({ ok: true, regia, gruppo: consulenzaDiGruppo(attesi) });
      },

      POST: async ({ request }) => {
        let b: {
          sess?: string;
          comune?: boolean;
          aperto?: string;
          penna?: { chi?: string; a?: string };
          individuale?: { chi?: string; acceso?: boolean };
          /** «Si ricomincia»: nessuno vede più il proprio preventivo. */
          azzera?: boolean;
          code?: string;
        } = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo illeggibile */ }
        const sess = String(b.sess || "").trim();
        if (!sess) return json({ ok: false, reason: "manca la stanza" }, 400);

        //  La sola mossa che può fare anche il cliente: ridare la penna.
        const ridaLaPenna = b.penna?.a === "cliente" && typeof b.comune !== "boolean"
          && b.aperto === undefined && !b.individuale;
        const chi = ridaLaPenna ? null : await autorizzaPresentatore(request, b.code);
        if (!ridaLaPenna && !chi) return json({ ok: false, reason: "non autorizzato" }, 401);

        let r = await leggiRigaRegia(sess);
        /*  ── ⚠️ UNA CONSULENZA CHE COMINCIA NON MOSTRA NIENTE ─────────────
            Segnalazione del committente: «parte già da attivo». Giusto: la
            regia vive nella STANZA, e la stanza di un appuntamento è la
            stessa per tutta la giornata — quindi gli interruttori accesi
            l'altra volta erano ancora lì all'avvio successivo.
            Avviare una consulenza li rimette a zero: nessuno vede il proprio
            preventivo finché non lo accendi tu.
            ⚠️ NON SI CANCELLA NIENTE: si spegne solo la vista. Quello che le
             persone avevano compilato resta nella loro stanza e riappare
             intatto appena riaccendi l'interruttore. */
        //  ⚠️ E anche il COMUNE: una consulenza che comincia non deve avere
        //   a schermo il preventivo di quella di prima. Quello che c'era
        //   resta scritto nella sua stanza, si riaccende con un tocco.
        if (b.azzera) r = { ...r, individuali: [], aperto: "", comune: false, at: Date.now() };
        if (typeof b.comune === "boolean") r = conComune(r, b.comune);
        if (typeof b.aperto === "string") r = conAperto(r, b.aperto);
        if (b.individuale?.chi) {
          const attesi = await attesiDellaStanza(sess);
          const suo = attesi.some((p) => gettoneDi(p) === String(b.individuale?.chi || "").trim().toLowerCase());
          if (suo) r = conIndividuale(r, b.individuale.chi, b.individuale.acceso !== false);
        }
        if (b.penna?.chi) {
          //  ⚠️ Solo chi è atteso qui: un gettone inventato non deve
          //   depositare una voce in una riga di configurazione.
          const attesi = await attesiDellaStanza(sess);
          const suo = attesi.some((p) => gettoneDi(p) === String(b.penna?.chi || "").trim().toLowerCase());
          //  ⚠️ «insieme» e «consulente» le può dare solo il consulente (siamo
          //   già passati da `autorizzaPresentatore`); «cliente» è l'unica che
          //   può arrivare dal cliente, ed è quella che restituisce la penna.
          const a = b.penna.a === "consulente" || b.penna.a === "insieme" ? b.penna.a : "cliente";
          if (suo) r = conLaPenna(r, b.penna.chi, a);
        }
        const errore = await scriviRigaRegia(sess, r);
        if (errore) return json({ ok: false, reason: errore }, 500);
        return json({ ok: true, regia: r });
      },
    },
  },
});
