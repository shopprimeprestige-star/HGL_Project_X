/** ── QUESTA MEZZ'ORA LA TENGO PER LUI, OPPURE LA LASCIO APERTA ─────────────
 *
 *  Richiesta del committente: «quando fisso un appuntamento, se seleziono una
 *  data posso selezionare se bloccarla per solo quella persona, oppure se
 *  rimane aperta. Quando già assegno una persona aperta a un orario, poi
 *  quell'orario per tutti gli altri che aggiungo di default è aperto, fino a 3».
 *
 *  ⚠️ LA REGOLA DEVE VIVERE QUI, SUL SERVER, e non solo nel CRM. Se stesse
 *   soltanto nella schermata, il cliente che si prenota da solo dal link
 *   pubblico riempirebbe proprio l'ora che volevi tenere libera: la funzione
 *   fallirebbe esattamente nel caso per cui è stata chiesta. Chi disegna le
 *   disponibilità legge lo stesso valore (api.crm.disponibilita).
 *
 *  ⚠️ E IL CONTROLLO STA DOVE SI SCRIVE, non solo dove si guarda. Chiudere una
 *   fascia dove c'è già più di una persona vorrebbe dire buttarne fuori una che
 *   ha già il link in mano: qui si conta prima di scrivere, perché fra il
 *   momento in cui la schermata ha disegnato i posti e il momento in cui si
 *   preme possono passare minuti — e nel frattempo un collega ha prenotato.
 *
 *  POST { quando: "2026-09-30T15:00", consultantId?, modo: "solo"|"aperta" }
 *     -> { ok, modo, presi }
 *
 *  Le regole (che cosa vuol dire un modo, quanti posti restano, quando si può
 *  chiudere) stanno in crm/fascia-consulenza, provate senza database.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BASE_FASCIA,
  chiaveFascia,
  leggiModoFascia,
  scriviModoFascia,
  siPuoChiudere,
  type ModoFascia,
} from "@/crm/fascia-consulenza";
import { tieneLoSlot } from "@/crm/booking-utils";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";
import { sessioneDaRichiesta } from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token, x-presenter-token",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** `app_config` è nata dopo l'ultima generazione dei tipi Supabase: senza
 *  questo appiglio un `.eq("key", …)` non compila. Stessa scelta già fatta in
 *  api.crm.disponibilita. */
const elencoDb = supabaseAdmin as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      like: (
        k: string,
        v: string,
      ) => Promise<{ data: { key: string; value?: string | null }[] | null }>;
    };
  };
};

const configDb = supabaseAdmin as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => { maybeSingle: () => Promise<{ data: { value?: string | null } | null }> };
    };
    upsert: (
      r: Record<string, unknown>,
      o: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  };
};

const min = (hhmm: string) => {
  const [h, m] = String(hhmm || "")
    .split(":")
    .map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Quante persone ci sono davvero in questa fascia, adesso. Si contano le
 *  schede, che sono la verità del CRM — come fa la rotta delle disponibilità. */
async function quantiDentro(consultantId: string, quando: string, durata: number): Promise<number> {
  const [giorno, ora] = String(quando || "").split("T");
  if (!giorno || !ora) return 0;
  const { data: c } = await supabaseAdmin
    .from("crm_consultants")
    .select("user_id")
    .eq("id", consultantId)
    .maybeSingle();
  const uid = (c as { user_id?: string } | null)?.user_id;
  if (!uid) return 0;
  const { data: rows } = await supabaseAdmin.from("crm_leads").select("data").eq("user_id", uid);
  const t = min(ora.slice(0, 5));
  return ((rows as { data: Record<string, unknown> }[] | null) ?? [])
    .map(
      (r) =>
        r.data as {
          consulenteId?: string;
          dataMeeting?: string;
          oraMeeting?: string;
          durataMeeting?: number;
          stato?: string;
        },
    )
    .filter(
      (l) =>
        l.consulenteId === consultantId &&
        l.dataMeeting === giorno &&
        l.oraMeeting &&
        tieneLoSlot(l.stato),
    )
    .filter((l) => {
      const da = min(l.oraMeeting!);
      const a = da + (Number(l.durataMeeting) || durata);
      return t < a && t + durata > da;
    }).length;
}

export const Route = createFileRoute("/api/crm/fascia-modo")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let b: {
          quando?: string;
          consultantId?: string;
          modo?: string;
          durata?: number;
          token?: string;
        } = {};
        try {
          b = (await request.json()) as typeof b;
        } catch {
          /* corpo illeggibile */
        }

        //  Chi chiede: il presentatore è già dentro Meetly, il CRM manda il suo
        //  token e deve avere il permesso dell'agenda.
        const pres = await sessioneDaRichiesta(request);
        if (!pres) {
          const chi = await chiamanteCRM(request, b.token);
          if (!chi) return nonAutenticatoCRM(cors);
          if (!chi.accesso.puo("agenda")) return vietatoCRM(cors, "agenda");
        }

        const consultantId = String(b.consultantId || "").trim();
        const quando = String(b.quando || "").trim();
        const modo: ModoFascia = b.modo === "solo" ? "solo" : "aperta";
        const chiave = chiaveFascia(consultantId, quando);
        if (!chiave) return json({ ok: false, reason: "servono il consulente e l'orario" }, 400);

        const durata = Math.max(15, Math.min(180, Number(b.durata) || 45));
        const presi = await quantiDentro(consultantId, quando, durata);
        //  ⚠️ Il controllo che conta: non si chiude una fascia dove c'è già più
        //   di una persona. Aprire invece si può sempre.
        if (modo === "solo" && !siPuoChiudere(presi))
          return json(
            { ok: false, reason: "in questa fascia ci sono già più persone", presi },
            409,
          );

        const { data: prima } = await configDb
          .from("app_config")
          .select("value")
          .eq("key", chiave)
          .maybeSingle();
        //  Si conserva quello che c'era (il codice della stanza): è il link che
        //  i clienti di questa fascia hanno già in mano.
        const { error } = await configDb.from("app_config").upsert(
          {
            key: chiave,
            value: scriviModoFascia(prima?.value, modo),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
        if (error) return json({ ok: false, reason: error.message }, 500);
        console.log(`[FASCIA] ${chiave} → ${modo} (dentro: ${presi})`);
        return json({ ok: true, modo, presi });
      },

      /** Com'è adesso questa fascia — o tutte quelle di un giorno.
       *
       *  ⚠️ TUTTE IN UNA VOLTA, e non una richiesta per orario: la schermata
       *   che fissa l'appuntamento disegna venti pillole, e venti richieste
       *   ogni volta che si cambia giorno sono venti richieste che si pagano
       *   (il 27/09/2026 questo sito si è fermato per il tetto giornaliero del
       *   piano, e da allora ogni giro nuovo si conta prima di scriverlo).
       *
       *  ⚠️ E LE CHIAVI SI CALCOLANO QUI: `chiaveFascia` passa da
       *   `toISOString()`, quindi una chiave calcolata nel browser italiano non
       *   troverebbe mai quella scritta dal server. */
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const consultantId = String(q.get("consultantId") || "").trim();
        const giorno = String(q.get("giorno") || "").trim();

        /*  ── TUTTE LE ORE TENUTE, DI TUTTI, IN UN COLPO ──────────────────
            Segnalazione del committente: «clicco la spunta che vuole stare
            solo, ma l'orario continua a essere disponibile per 3».
            La finestra che fissa gli appuntamenti mostra QUATTORDICI giorni di
            tutta la squadra: chiedere un giorno alla volta per ogni
            consulente vorrebbe dire quaranta richieste a ogni apertura (e il
            27/09/2026 questo sito si è fermato per il tetto giornaliero del
            piano). Le ore tenute per una persona sola sono poche decine in
            tutto: si consegnano insieme, e chi disegna se le ritaglia.
            ⚠️ ESCONO SOLO LE «SOLO»: le aperte sono la normalità e non vanno
             nemmeno scritte in archivio. */
        if (q.get("tutte")) {
          /*  ── ⚠️ QUESTA SÌ CHE VUOLE LE CREDENZIALI ────────────────────
              La lettura di un singolo giorno è sempre stata aperta (serve a
              disegnare gli orari di un consulente, e dice solo quali ore sono
              tenute). Questa invece consegna l'AGENDA DI TUTTI in un colpo:
              identificativi dei consulenti e orari, cioè come lavora il
              centro. Senza guardia sarebbe un elenco pubblico — l'ho lasciata
              aperta per un rilascio e l'ho vista rispondere 200 a chiunque. */
          const chi = await chiamanteCRM(request);
          if (!chi) return nonAutenticatoCRM(cors);
          if (!chi.accesso.puo("agenda")) return vietatoCRM(cors, "agenda");
          const { data: righe } = await elencoDb
            .from("app_config")
            .select("key,value")
            .like("key", `${BASE_FASCIA}:%`);
          const solo: Record<string, string[]> = {};
          for (const r of (righe as { key: string; value?: string | null }[] | null) ?? []) {
            if (leggiModoFascia(r.value) !== "solo") continue;
            /*  La chiave è `fascia:<consulente>:<AAAA-MM-GGTHH:MM>` in UTC.
                ⚠️ NON SI SPEZZA SUI DUE PUNTI: l'ora ne contiene uno, e uno
                 `split(":")` taglia «15:00» in «15». Si toglie il prefisso e si
                 spezza al PRIMO due punti rimasto. */
            const resto = r.key.slice(BASE_FASCIA.length + 1);
            const taglio = resto.indexOf(":");
            if (taglio <= 0) continue;
            const cid = resto.slice(0, taglio);
            const quando = resto.slice(taglio + 1);
            if (!cid || !quando) continue;
            (solo[cid] ||= []).push(quando);
          }
          return json({ ok: true, solo });
        }
        if (giorno) {
          if (!consultantId) return json({ ok: false, reason: "serve il consulente" }, 400);
          const { data: righe } = await elencoDb
            .from("app_config")
            .select("key,value")
            .like(
              "key",
              `${BASE_FASCIA}:${consultantId.toLowerCase().replace(/[^a-z0-9-]/g, "")}:%`,
            );
          //  Dalla chiave non si torna indietro all'ora locale (è UTC): si
          //  ricostruiscono le chiavi delle ore del giorno e si confrontano.
          const per: Record<string, ModoFascia> = {};
          const mappa = new Map(
            ((righe as { key: string; value?: string | null }[] | null) ?? []).map((r) => [
              r.key,
              leggiModoFascia(r.value),
            ]),
          );
          for (let t = 0; t < 24 * 60; t += 15) {
            const ora = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
            const m = mappa.get(chiaveFascia(consultantId, `${giorno}T${ora}`));
            if (m === "solo") per[ora] = m;
          }
          return json({ ok: true, giorno, modi: per });
        }
        const chiave = chiaveFascia(consultantId, q.get("quando"));
        if (!chiave) return json({ ok: false, reason: "servono il consulente e l'orario" }, 400);
        const { data } = await configDb
          .from("app_config")
          .select("value")
          .eq("key", chiave)
          .maybeSingle();
        return json({ ok: true, modo: leggiModoFascia(data?.value) });
      },
    },
  },
});
