/** SESSIONE DEL LINK "SOLO PREVENTIVO" ──────────────────────────────────────
 *  Il link del preventivo porta con sé un codice di sessione, che serve a due
 *  cose: far seguire al cliente quello che il consulente sta facendo, e poter
 *  invalidare in blocco tutti i link mandati fino a un certo momento.
 *
 *  Perché NON si usa la sessione di Meetly: quella nasce e muore con la
 *  chiamata, e alla chiusura il suo codice viene azzerato. Un link del
 *  preventivo agganciato a quel codice risultava "non più attivo" appena la
 *  chiamata finiva — cioè quasi sempre, visto che il preventivo si manda dopo.
 *  Questa invece resta valida finché il consulente non preme "Ricomincia".
 *
 *  GET ?ref&sess  -> { code: string|null, morto?: true }
 *  POST { code, ref? }              -> registra il codice di QUEL link
 *  POST { code, ref?, precedente }  -> "Ricomincia": spegne i link mandati con
 *                                      il codice `precedente` (solo i propri)
 *  app_config.key = 'quote_session:<REF>' e 'quote_session:morto:<codice>'
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { codiceChiave } from "@/shop/chiave-sessione";
//  Di chi è questa consulenza: serve al cliente per sapere quale listino
//  leggere, e va segnato QUI perché qui il codice nasce (crm/listino-di-chi).
import { ricordaConsulenteDellaSessione } from "@/crm/listino-di-chi.server";
import { sessioneDaRichiesta } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const KEY = "quote_session";
/** ── UNA SESSIONE PER PREVENTIVO ───────────────────────────────────────────
 *  Oltre al codice corrente ne teniamo uno per ogni preventivo: è quello con
 *  cui il suo link è stato mandato. Serve a non far morire i link vecchi.
 *  Col solo codice corrente, preparare il preventivo di un altro cliente
 *  bastava a rendere "non più attivo" il link mandato il giorno prima. */
const keyOf = (ref: string) => `${KEY}:${ref.trim().toUpperCase().slice(0, 32)}`;
/*  ── ⚠️ «NON PIÙ ATTIVO» VALE PER UN CODICE, NON PER TUTTI ────────────────
    Segnalazione del committente: due consulenti in diretta nello stesso
    momento facevano conflitto. Anche qui. C'era UNA casella `quote_session`
    con dentro "il codice corrente", scritta da chiunque: il cliente di un
    collega, che apriva un link senza numero di preventivo, ci finiva contro e
    leggeva che il suo link non era più attivo — mentre il consulente, davanti,
    lo vedeva aperto. E "Ricomincia" cancellava le righe di TUTTI i preventivi,
    spegnendo i link mandati dai colleghi il giorno prima.
    Adesso: chi ricomincia mette una lapide sul PROPRIO codice di prima, e
    spegne solo i link mandati con quello. Gli altri non se ne accorgono. */
const keyMorto = (code: string) => `${KEY}:morto:${codiceChiave(code)}`;

async function leggi(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", key).maybeSingle();
  return ((data as { value?: string | null } | null)?.value || "").trim() || null;
}
async function scrivi(key: string, value: string) {
  await supabaseAdmin.from("app_config").upsert(
    { key, value, updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

/** Spegne i link mandati con UN codice: la lapide per quelli senza numero di
 *  preventivo, e le righe dei preventivi che portavano quel codice. */
async function spegni(precedente: string) {
  await scrivi(keyMorto(precedente), "1");
  //  ⚠️ `eq("value", …)` è ciò che tiene fuori i preventivi dei colleghi: si
  //   tolgono solo le righe che portano QUESTO codice.
  await supabaseAdmin.from("app_config").delete().like("key", `${KEY}:%`).eq("value", precedente);
}

export const Route = createFileRoute("/api/presenter/quote-session")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        // `?ref=` = "com'è messo IL MIO link", non la consulenza in generale.
        const p = new URL(request.url).searchParams;
        const ref = (p.get("ref") || "").trim();
        const sess = (p.get("sess") || "").trim();
        //  La lapide risponde per i link SENZA numero di preventivo: sono gli
        //  unici che prima ricadevano sulla casella condivisa.
        if (sess && (await leggi(keyMorto(sess)))) return json({ code: null, morto: true });
        const suo = ref ? await leggi(keyOf(ref)) : null;
        //  ⚠️ Niente ripiego sulla casella condivisa: era di chiunque avesse
        //   scritto per ultimo, cioè spesso di un altro consulente.
        return json({ code: suo });
      },
      POST: async ({ request }) => {
        let b: { code?: string; ref?: string; reset?: boolean; wipe?: boolean; precedente?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* ignore */ }
        const precedente = String(b.precedente || "").trim().slice(0, 64);
        // azzeramento: si spengono i link mandati col codice di prima.
        // ⚠️ Senza `precedente` non si tocca niente: non si sa DI CHI sarebbero
        //  i link da spegnere, e prima si spegnevano quelli di tutti.
        if (b.reset === true) {
          if (precedente) await spegni(precedente);
          return json({ ok: true, code: null, spenti: !!precedente });
        }
        const code = String(b.code || "").trim().slice(0, 64);
        if (!code) return json({ ok: false, reason: "codice mancante" });
        const ref = String(b.ref || "").trim();
        // "Ricomincia": il codice nuovo da solo non basterebbe a chiudere i link
        // già mandati, perché ognuno ha il suo. Si spengono quelli partiti col
        // codice di prima — è quello che l'avviso promette, e solo quelli.
        if (b.wipe === true && precedente) await spegni(precedente);
        if (ref) await scrivi(keyOf(ref), code);
        /*  ── ⚠️ E DI CHI È QUESTO CODICE ──────────────────────────────────
            Segnalazione del committente: «a me mostra il prezzo nuovo che ho
            impostato e al cliente ne mostra un altro».
            Il listino che il cliente legge si decide dal codice che ha nel
            link, tradotto in «chi è il suo consulente». Quella traduzione
            esisteva solo per le consulenze VIVE — ma questo è proprio il link
            che si manda SENZA videochiamata («non serve la videochiamata», lo
            dice il pulsante). Senza traduzione il cliente leggeva il listino
            di casa mentre il consulente, sul suo schermo, leggeva il proprio.
            Il consulente lo riconosce il server dal suo accesso a Meetly (il
            cookie viaggia da solo): il browser non manda nessun id, e non
            potrebbe — un id scritto dal cliente sceglierebbe il listino di chi
            gli pare. */
        const chi = await sessioneDaRichiesta(request);
        //  Solo chi è entrato col PIN ha un listino suo: chi usa le chiavi di
        //  casa vende col listino di casa, ed è quello che il cliente legge di
        //  suo. La regola è la stessa di `chiSta` in api.presenter.pricing.
        if (chi && chi.via === "pin") await ricordaConsulenteDellaSessione(code, chi.id);
        return json({ ok: true, code, ref: ref || null });
      },
    },
  },
});
