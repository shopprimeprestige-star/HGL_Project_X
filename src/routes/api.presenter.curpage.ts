/** Pagina attualmente mostrata dal presentatore (per far seguire il cliente).
 *  GET  -> { path }
 *  POST { path } -> imposta (solo quando il presentatore sceglie dal menu)
 *  app_config.key = 'presenter_page'
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveSessione } from "@/shop/chiave-sessione";
import { BASE_REGIA, leggiRegia, paginaDiQuestoCliente } from "@/shop/preventivi-di-gruppo";
import { chiaveAttesi, gettoneDi, leggiAttesi } from "@/crm/fascia-consulenza";
/*  ── ⚠️ CHI PUÒ DIRE AL CLIENTE CHE PAGINA GUARDARE ───────────────────────
    Questa riga decide la schermata che il cliente SEGUE: la sua pagina la
    chiede ogni secondo e ci va. Scriverla non richiedeva niente — bastava
    conoscere il codice della stanza, che ce l'ha in mano anche il cliente e
    chiunque si sia fatto inoltrare il link — e da fuori si poteva spostare lo
    schermo di una consulenza altrui mentre è in corso.
    A scriverla è SEMPRE il presentatore (shop/live, quando cambia schermata):
    il cliente questa rotta la legge soltanto. Quindi la POST vuole la sessione
    del presentatore, e la GET resta aperta com'era. */
import { INTESTAZIONI_CONSENTITE, autorizzaPresentatore, nonAutorizzato } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/presenter/curpage")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        /*  ── ⚠️ LA PAGINA È DI UNA CONSULENZA, NON DEL SERVER ──────────────
            Qui c'era UNA riga per tutti: due consulenti in diretta nello
            stesso momento se la scrivevano a vicenda, e il cliente di uno
            seguiva la pagina aperta dall'altro. Adesso la riga porta il
            codice della consulenza — che il cliente ha nell'indirizzo della
            sua stanza e il consulente nel suo.
            ⚠️ Senza codice si legge la riga storica: chi è in consulenza nel
             momento della pubblicazione non ne ha uno scritto da nessuna
             parte, e non deve accorgersi di niente. */
        const q = new URL(request.url).searchParams;
        const sess = q.get("sess");
        const chiave = chiaveSessione("presenter_page", sess);
        /*  ── ⚠️ TRE RIGHE IN UNA LETTURA ───────────────────────────────────
            La pagina del consulente, la regia del gruppo e chi è atteso: le
            altre due servono per la precedenza qui sotto, e prese con una
            `in` non costano un viaggio in più. Questa rotta la interrogano
            tutti i clienti collegati ogni secondo e mezzo. */
        const chiaveDellaRegia = sess ? chiaveSessione(BASE_REGIA, sess) : "";
        const chiaveDegliAttesi = sess ? chiaveAttesi(sess) : "";
        const cercate = [chiave, ...(chiaveDellaRegia ? [chiaveDellaRegia] : []), ...(chiaveDegliAttesi ? [chiaveDegliAttesi] : [])];
        const { data: righe } = await supabaseAdmin.from("app_config").select("key,value").in("key", cercate);
        const riga = (k: string) => (righe as { key: string; value?: string | null }[] | null)?.find((r) => r.key === k)?.value || "";
        const path = riga(chiave);
        /*  ── ⚠️ NIENTE PAGINA DI RIPIEGO ──────────────────────────────────
            Segnalazione del committente: «apro Meetly con la videochiamata e
            va in automatico sul preventivo».
            Qui, quando nessuno aveva ancora registrato una schermata, si
            rispondeva `/preventivo`. Non era un valore prudente: era un
            ORDINE. Il cliente lo riceveva entro un secondo e veniva portato
            sul preventivo — anche se il consulente stava sui media, anche se
            aveva appena aperto la videochiamata e non aveva scelto niente.
            Adesso «non lo so» si dice con una stringa vuota, e chi la riceve
            resta dov'è. Vedi `useLiveNav`.

            ⚠️ E nemmeno si ripiega più sulla riga storica, che è condivisa da
             tutti: mandava il cliente di uno sulla pagina aperta da un altro. */
        /*  ── ⚠️ IL SUO PREVENTIVO VIENE PRIMA DELLA PAGINA DEL CONSULENTE ──
            Vedi il cartello di `paginaDiQuestoCliente`: la decisione sta qui,
            sul server, perché sul dispositivo del cliente può mancare tutto —
            il nome, la versione nuova, la memoria della scheda. Il consulente
            continua a leggere la pagina vera: `persona` la manda solo chi
            segue (shop/live, `useLiveNav`), e la precedenza scatta solo se in
            quella stanza c'è davvero un preventivo acceso per quella persona. */
        if (!sess) return json({ path });
        const attesi = leggiAttesi(riga(chiaveDegliAttesi)).map((x) => ({ gettone: gettoneDi(x) }));
        const suoPath = paginaDiQuestoCliente({
          pagina: path,
          regia: leggiRegia(riga(chiaveDellaRegia)),
          io: q.get("persona") || "",
          attesi,
        });
        /*  ── ⚠️ UNA RISPOSTA SOLA, PERCHÉ LE RICHIESTE SI PAGANO ───────────
            Misurato il 27/09/2026, con il sito fermo per «Error 1027 — hai
            raggiunto i limiti del piano»: UNA sola scheda cliente faceva
            7.200 richieste l'ora, e le due voci grosse erano questo giro e
            quello della regia, chiesti separatamente ogni 1-2 secondi. Le tre
            righe qui le leggevamo GIÀ tutte insieme: restituirle costa zero e
            toglie un giro intero al cliente (vedi shop/call, `statoStanza`). */
        return json({
          path: suoPath,
          ...(suoPath !== path ? { suo: true } : {}),
          regia: leggiRegia(riga(chiaveDellaRegia)),
          gruppo: attesi.length >= 2,
        });
      },
      POST: async ({ request }) => {
        if (!(await autorizzaPresentatore(request))) return nonAutorizzato(cors);
        let body: { path?: string; sess?: string } = {};
        try { body = (await request.json()) as typeof body; } catch { /* ignore */ }
        let path = (body.path || "").trim();
        if (!path.startsWith("/")) path = "/preventivo";
        const chiave = chiaveSessione("presenter_page", body.sess);
        await supabaseAdmin.from("app_config").upsert({ key: chiave, value: path, updated_at: new Date().toISOString() } as never, { onConflict: "key" });
        return json({ ok: true, path });
      },
    },
  },
});
