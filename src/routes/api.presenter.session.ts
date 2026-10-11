/** Stato "sessione avviata" (videoconsulenza) — ora legata a UNA specifica chiamata.
 *  GET  -> { live: boolean, code: string|null, presenterId, presenterName, startedAt }
 *  POST { live, code?, presenterId?, presenterName? } -> imposta
 *  app_config.key = 'session_live'  → il guest vede l'attesa finché live è false
 *  oppure finché il suo codice (?watch=) non coincide con quello della sessione.
 *  Retrocompatibile: il vecchio valore "1"/"0" viene ancora letto correttamente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
//  Di chi è questa consulenza, in una riga che non muore con la chiamata: è
//  quella che dice al cliente quale listino leggere (crm/listino-di-chi).
import { ricordaConsulenteDellaSessione } from "@/crm/listino-di-chi.server";
import { chiaveSessione } from "@/shop/chiave-sessione";
//  Quando una consulenza rimasta aperta va considerata finita: la regola sta
//  in shop/consulenza-aperta, provata senza database.
import { consulenzaDaChiudere } from "@/shop/consulenza-aperta";
//  La chiave del rinvio la scrive lo spostamento di un appuntamento: vedi
//  crm/spostamento-meet.ts e routes/api.crm.meeting-session.ts.
import { chiaveRinvio } from "@/crm/spostamento-meet";
//  ⚠️ CHI STA AVVIANDO QUESTA CONSULENZA LO SA IL SERVER, NON IL BROWSER.
//   Vedi il perché per esteso dentro il POST: da questa riga dipende il prezzo
//   che legge il cliente.
import { sessioneDaRichiesta } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

interface Sess {
  live: boolean; code: string | null; presenterId: string; presenterName: string;
  startedAt: string | null; hb: string | null;
  /** ⚠️ «C'È QUALCUNO» e «LA VIDEOCHIAMATA È ATTIVA» sono due cose diverse.
   *  Il battito dice la prima: la postazione del consulente è viva su questa
   *  consulenza, anche mentre condivide contenuti senza aver ancora avviato la
   *  chiamata. Tenendole insieme, in quei minuti il server dichiarava morta la
   *  sessione e il cliente veniva rimandato in attesa — «entra ed esci». */
  inChiamata?: boolean;
}

/*  "Battito" della consulenza: la postazione del consulente lo aggiorna ogni
    otto secondi finché la sessione è aperta. Se manca da oltre HB_MAX_MS la
    sessione è solo "riprendibile" → l'ospite torna alla schermata d'attesa.

    ── ⚠️ PERCHÉ LA FINESTRA È LARGA ────────────────────────────────────────
    Segnalazione del committente: «a un certo punto al cliente si chiude la
    scheda del preventivo e gli dice che si sta per connettere, ma continua a
    sentirmi».
    Il battito è un timer del browser, e in una scheda lasciata IN SECONDO
    PIANO i browser lo rallentano fino a uno al minuto — succede tutte le volte
    che il consulente passa al CRM o a WhatsApp mentre parla. Con 25 secondi il
    server dichiarava morta una consulenza che era vivissima, e il cliente si
    ritrovava la schermata d'attesa addosso mentre lo stava ascoltando.
    Settanta secondi coprono il battito rallentato di una scheda nascosta (uno
    al minuto) senza coprire una postazione davvero sparita.
    ⚠️ E non si perde la prontezza: quando il consulente CHIUDE, il server
     riceve `live: false` — una volontà dichiarata, non un battito mancante — e
     l'ospite torna in attesa subito (vedi la chiusura esplicita nel polling
     dell'ospite, shop/call). Questa soglia riguarda solo il caso in cui la
     postazione smette di parlare senza dire niente.
    ⚠️ E il cliente ha un secondo giudice, più forte: finché sente e vede il
     consulente non torna in attesa comunque (`guestBackToWaiting`). */
const HB_MAX_MS = 70_000;
const hbFresh = (hb: string | null): boolean => {
  if (!hb) return false;
  const t = Date.parse(hb);
  return Number.isFinite(t) && Date.now() - t < HB_MAX_MS;
};

function parse(value: string | null | undefined): Sess {
  const empty: Sess = { live: false, code: null, presenterId: "", presenterName: "", startedAt: null, hb: null, inChiamata: false };
  if (value == null) return empty;
  if (value === "1") return { ...empty, live: true };   // formato vecchio
  if (value === "0") return empty;                       // formato vecchio
  try {
    const o = JSON.parse(value) as Partial<Sess>;
    return {
      live: !!o.live, code: o.code ?? null,
      presenterId: o.presenterId ?? "", presenterName: o.presenterName ?? "",
      startedAt: o.startedAt ?? null, hb: o.hb ?? null, inChiamata: !!o.inChiamata,
    };
  } catch { return empty; }
}

/** Il codice che ha preso il posto di questo, se c'è. Stringa vuota quando
 *  questo link è ancora quello buono — che è il caso di quasi sempre, quindi
 *  la lettura deve costare poco: una riga letta per chiave, come tutte le
 *  altre di questa rotta.
 *  ⚠️ Un rinvio verso sé stessi non si restituisce: manderebbe la pagina del
 *   cliente a ricaricarsi all'infinito sullo stesso indirizzo. */
async function leggiRinvio(codice: string | null): Promise<string> {
  const c = String(codice || "").trim();
  if (!c) return "";
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", chiaveRinvio(c)).maybeSingle();
    const v = (data as { value?: string | null } | null)?.value;
    if (!v) return "";
    const nuovo = String((JSON.parse(v) as { code?: string })?.code || "").trim();
    return nuovo && nuovo !== c ? nuovo : "";
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/api/presenter/session")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        /*  ── ⚠️ UNA SESSIONE PER CONSULENZA, NON UNA PER SERVER ────────────
            Qui c'era UNA riga per tutti. Due consulenti che avviavano Meetly
            nello stesso momento si sovrascrivevano il codice a vicenda: il
            cliente del primo vedeva la sua consulenza «sostituita da una
            nuova» e tornava sulla schermata d'attesa a chiamata avviata.
            Adesso ogni consulenza ha la sua riga, col suo codice.
            ⚠️ Senza codice si legge quella storica: serve a chi sta lavorando
             nel momento della pubblicazione, e al presentatore che chiede «c'è
             una consulenza da riprendere?» prima di sapere quale. */
        const q = new URL(request.url).searchParams.get("sess");
        const chiave = chiaveSessione("session_live", q);
        const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", chiave).maybeSingle();
        let grezzo = (data as { value?: string | null } | null)?.value ?? null;
        if (!grezzo && chiave !== "session_live") {
          const { data: vecchia } = await supabaseAdmin.from("app_config").select("value").eq("key", "session_live").maybeSingle();
          const v = parse((vecchia as { value?: string | null } | null)?.value);
          //  ⚠️ La riga storica vale solo se parla DI QUESTA consulenza: è
          //   condivisa, e prenderla comunque vorrebbe dire rispondere con la
          //   sessione di un altro — cioè il guasto che si sta togliendo.
          grezzo = v.code && v.code === q ? JSON.stringify(v) : null;
        }
        /*  ── ⚠️ QUESTO LINK È STATO SOSTITUITO DA UN ALTRO ────────────────
            Quando una consulenza viene spostata di giorno si conia un codice
            nuovo, perché l'anteprima di un link WhatsApp non la rilegge mai
            (vedi crm/spostamento-meet.ts). Il cliente però ha in mano il link
            di prima, e senza questa riga lo aprirebbe per restare in attesa di
            un consulente che sta trasmettendo altrove.
            Si risponde QUI e non con una richiesta a parte perché questa è
            l'unica che l'ospite fa già mentre aspetta, ogni due secondi: il
            rinvio arriva senza aggiungere niente all'ingresso — che è la cosa
            che in questa pagina non si può rallentare.
            ⚠️ Si legge SEMPRE, anche a sessione viva: il consulente può
             spostare l'appuntamento mentre il cliente ha la pagina aperta. */
        const rinvio = await leggiRinvio(q);
        let sess = parse(grezzo);
        /*  ── ⚠️ LE CONSULENZE CHE NESSUNO HA CHIUSO ─────────────────────
            Misurato in archivio: 13 righe dichiarate «vive», ferme da 4 a 102
            ore. Si chiude la scheda e il programma non lo sa — e la barra poi
            propone «Rientra» su una stanza di quattro giorni fa, il cui link
            non ce l'ha più nessuno.
            Chi legge la chiude: nessun lavoro periodico, nessun momento in cui
            qualcuno deve ricordarsi di pulire. La soglia (un quarto d'ora di
            silenzio) è dodici volte la finestra che tiene dentro il cliente:
            una ricarica non ci cade dentro, una scheda chiusa sì. */
        if (consulenzaDaChiudere(sess)) {
          const chiusa: Sess = { live: false, code: null, presenterId: "", presenterName: "", startedAt: null, hb: null };
          await supabaseAdmin.from("app_config").upsert(
            { key: chiave, value: JSON.stringify(chiusa), updated_at: new Date().toISOString() } as never,
            { onConflict: "key" },
          );
          //  ⚠️ E il segnaposto condiviso, se parlava proprio di questa: è
          //   quello da cui una postazione nuova «adotta» una consulenza, ed è
          //   la strada per cui una stanza morta torna a sembrare viva.
          if (chiave !== "session_live") {
            const { data: seg } = await supabaseAdmin.from("app_config").select("value").eq("key", "session_live").maybeSingle();
            const corrente = parse((seg as { value?: string | null } | null)?.value);
            if (corrente.live && corrente.code && corrente.code === sess.code) {
              await supabaseAdmin.from("app_config").upsert(
                { key: "session_live", value: JSON.stringify(chiusa), updated_at: new Date().toISOString() } as never,
                { onConflict: "key" },
              );
            }
          }
          console.log(`[SESSION] chiusa da sola dopo il silenzio: ${sess.code || chiave}`);
          sess = chiusa;
        }
        // `callActive` = sessione aperta E presentatore realmente in chiamata (battito fresco)
        const vivo = sess.live && hbFresh(sess.hb);
        //  `callActive` = la postazione del consulente è viva su questa
        //  consulenza (è ciò che tiene dentro il cliente).
        //  `inChiamata` = la videochiamata è davvero avviata (è ciò che fa
        //  riprendere una chiamata al consulente che ricarica la pagina).
        return json({ ...sess, callActive: vivo, inChiamata: vivo && !!sess.inChiamata, rinvio });
      },
      POST: async ({ request }) => {
        let body: Partial<Sess> & { hbOnly?: boolean } = {};
        try { body = (await request.json()) as Partial<Sess> & { hbOnly?: boolean }; } catch { /* ignore */ }
        // battito: aggiorna SOLO `hb`, senza toccare il resto della sessione
        const chiave = chiaveSessione("session_live", body.code);
        if (body.hbOnly) {
          const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", chiave).maybeSingle();
          const cur = parse((data as { value?: string | null } | null)?.value);
          if (!cur.live) return json({ ok: true, ...cur, callActive: false });
          const next: Sess = { ...cur, hb: new Date().toISOString(), inChiamata: !!body.inChiamata };
          await supabaseAdmin.from("app_config").upsert(
            { key: chiave, value: JSON.stringify(next), updated_at: new Date().toISOString() } as never,
            { onConflict: "key" },
          );
          return json({ ok: true, ...next, callActive: true });
        }
        const live = !!body.live;
        /*  ── ⚠️ CHI CONDUCE LO DICE IL SERVER, NON IL BROWSER ──────────────
            Segnalazione del committente: «quando apro il preventivo io vedo il
            prezzo che ho impostato e il cliente ne vede uno diverso».
            Era qui. Da quando ogni consulente ha il suo listino, il prezzo che
            legge il CLIENTE si decide da questa riga: la sua pagina manda il
            codice della stanza, il server traduce codice → consulente leggendo
            `presenterId` di questa sessione, e gli serve QUEL listino
            (crm/listino-di-chi.server). Ma `presenterId` arrivava dal
            `localStorage` del browser (`hg_presenter`), che nella pratica è
            spesso vuoto: in archivio TUTTE le sessioni vive avevano
            `presenterId: ""`. Senza id vale il listino di casa — quindi il
            consulente leggeva i suoi prezzi e il cliente quelli di tutti, sullo
            stesso schermo, a due metri di distanza.
            Chi sta avviando la consulenza il server lo sa già: la sessione del
            presentatore viaggia in un cookie, ed è la stessa che protegge tutte
            le altre rotte. Il corpo resta un ripiego per i casi in cui quel
            cookie non c'è (link del collega, vecchie versioni della pagina
            ancora aperte), ma non è più l'unica fonte.
            ⚠️ Il nome segue lo stesso ordine: è quello che il cliente vede
             scritto in videochiamata, e un nome giusto con l'id sbagliato
             sarebbe peggio di entrambi sbagliati — sembrerebbe tutto a posto. */
        const chiSta = live ? await sessioneDaRichiesta(request) : null;
        // chiusura → codice invalidato (il link ospite smette di funzionare)
        const sess: Sess = live
          ? {
              live: true,
              code: body.code ?? null,
              presenterId: chiSta?.id || body.presenterId || "",
              presenterName: chiSta?.nome || body.presenterName || "",
              startedAt: body.startedAt ?? new Date().toISOString(),
              hb: new Date().toISOString(),
              inChiamata: body.inChiamata ?? true,
            }
          : { live: false, code: null, presenterId: "", presenterName: "", startedAt: null, hb: null };
        await supabaseAdmin.from("app_config").upsert(
          { key: chiave, value: JSON.stringify(sess), updated_at: new Date().toISOString() } as never,
          { onConflict: "key" },
        );
        /*  ── ⚠️ DI CHI È QUESTO CODICE, ANCHE DOPO ────────────────────────
            Segnalazione del committente: «a me mostra il prezzo nuovo e al
            cliente ne mostra un altro».
            La riga qui sopra viene AZZERATA alla chiusura (`presenterId: ""`),
            e il listino che il cliente legge si decide proprio da lì: appena
            il consulente chiudeva, la pagina del cliente — che ricontrolla i
            prezzi ogni venti secondi — ricadeva sul listino di casa e le cifre
            gli cambiavano sotto gli occhi.
            Questa traduzione codice → consulente invece non muore con la
            chiamata (vedi `ricordaConsulenteDellaSessione`). Si scrive solo
            all'apertura: chiudendo non si cancella, perché il link del
            preventivo vive più a lungo della videochiamata. */
        //  ⚠️ L'id è quello RISOLTO dal server (`chiSta`), non quello del
        //   corpo: nel corpo arriva il `localStorage` del browser, che è
        //   proprio il campo che in archivio risultava vuoto su TUTTE le
        //   sessioni vive — cioè la causa del guasto. Prendendolo da lì questa
        //   riga avrebbe scritto «di nessuno» e il cliente sarebbe rimasto sul
        //   listino di casa.
        if (live) await ricordaConsulenteDellaSessione(body.code, chiSta?.id || body.presenterId);
        /*  ── LA RIGA STORICA RESTA, MA SOLO COME SEGNAPOSTO ────────────────
            Serve a una cosa sola: al presentatore che riapre il programma su
            un altro computer e chiede «c'è una consulenza da riprendere?»
            senza sapere ancora quale codice cercare. Scriverla non fa più
            conflitto perché nessun CLIENTE la legge: il cliente chiede sempre
            la riga del SUO codice (vedi il GET qui sopra).
            ⚠️ E non la si tocca chiudendo una consulenza che non è quella
             segnata: chiudendo la propria non si deve cancellare il
             segnaposto di un collega che sta ancora trasmettendo. */
        if (chiave !== "session_live") {
          const { data: seg } = await supabaseAdmin.from("app_config").select("value").eq("key", "session_live").maybeSingle();
          const corrente = parse((seg as { value?: string | null } | null)?.value);
          if (live || !corrente.code || corrente.code === body.code) {
            await supabaseAdmin.from("app_config").upsert(
              { key: "session_live", value: JSON.stringify(sess), updated_at: new Date().toISOString() } as never,
              { onConflict: "key" },
            );
          }
        }
        return json({ ok: true, ...sess });
      },
    },
  },
});
