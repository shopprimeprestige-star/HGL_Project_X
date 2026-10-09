/** DISPONIBILITÀ DEL CONSULENTE, TUTTA INTERNA ──────────────────────────────
 *  Gli slot liberi si calcolano da due cose che abbiamo già in casa:
 *   · gli orari di lavoro del consulente (giorni, fasce, pause);
 *   · gli appuntamenti già fissati sulle sue schede lead.
 *
 *  PERCHÉ NON SI PASSA PIÙ DA GOOGLE. Dipendere dal calendario di qualcun altro
 *  significava che senza autorizzazione — o con un token scaduto — la
 *  disponibilità semplicemente non c'era, e l'appuntamento si fissava alla
 *  cieca. Qui la fonte è la nostra: risponde sempre, non scade, e non chiede
 *  permessi a nessuno.
 *
 *  GET ?consultantId=...&giorno=YYYY-MM-DD&durata=45
 *      -> { ok, slot: [{ ora, libero, presi, capienza }], occupati: [{ora, fine, chi}] }
 *
 *  ⚠️ `presi` e `capienza` sono il contatore «2/3». Richiesta del committente:
 *   «fai che posso aggiungere fino a 3 persone nella stessa ora di consulenza
 *   per singolo consulente, e poi quello slot non è più disponibile». Una
 *   consulenza dentro la fascia non la chiude più: la riempie di un terzo.
 *
 *  ⚠️ `occupati` porta anche la FINE, non solo l'inizio. Richiesta del
 *   committente: uno slot preso si deve vedere in rosso per TUTTA la durata
 *   della prenotazione — una consulenza dalle 15:00 alle 16:30 tinge di rosso
 *   anche le 15:30 e le 16:00, e solo dalle 16:30 si torna liberi. Il calcolo
 *   di `libero` lo faceva già così; quello che mancava era il modo di DIRLO a
 *   chi guarda: senza la fine, la schermata può scrivere «occupato» ma non
 *   «fino alle 16:30», che è l'unica informazione che serve per decidere.
 */
import { createFileRoute } from "@tanstack/react-router";
//  «Questo orario è ancora occupato?» si decide in un posto solo: due risposte
//  diverse vorrebbero dire un'agenda che mostra pieno quello che l'altra
//  schermata mostra libero.
//  E la capienza di una fascia è UN numero solo, dichiarato di là: se qui ce ne
//  fosse un altro, il setter vedrebbe pieno quello che il CRM mostra aperto.
import { CHIAVE_CAPIENZA, leggiCapienzaDaJson, tieneLoSlot } from "@/crm/booking-utils";
import {
  BASE_FASCIA,
  chiaveFascia,
  leggiModoFascia,
  postiDellaFascia,
  slotScegliibile,
  statoDellaFascia,
  type ModoFascia,
  type StatoSlot,
} from "@/crm/fascia-consulenza";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const min = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

interface Fascia { inizio: string; fine: string }

export const Route = createFileRoute("/api/crm/disponibilita")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const id = (q.get("consultantId") || "").trim();
        const giorno = (q.get("giorno") || "").trim();
        const durata = Math.max(15, Math.min(180, Number(q.get("durata")) || 45));
        if (!id || !giorno) return json({ ok: false, reason: "consultantId e giorno sono obbligatori" }, 400);

        const { data: c } = await supabaseAdmin.from("crm_consultants").select("id,user_id,data").eq("id", id).maybeSingle();
        const cons = c as { user_id: string; data: Record<string, unknown> } | null;
        if (!cons) return json({ ok: false, reason: "consulente non trovato" }, 404);

        const d = cons.data as {
          giorniLavorativi?: number[]; fasceOrarie?: Fascia[];
          pause?: Record<string, Fascia[]> | Fascia[]; attivo?: boolean;
        };
        const dow = new Date(`${giorno}T12:00:00`).getDay();
        const lavora = (d.giorniLavorativi ?? [1, 2, 3, 4, 5]).includes(dow);
        if (!lavora || d.attivo === false) return json({ ok: true, giorno, slot: [], occupati: [], motivo: "giorno non lavorativo" });

        // gli appuntamenti già presi, letti dalle schede: è la verità del CRM
        const { data: rows } = await supabaseAdmin
          .from("crm_leads").select("id,data").eq("user_id", cons.user_id);
        const occupati = ((rows as { data: Record<string, unknown> }[] | null) ?? [])
          .map((r) => r.data as { consulenteId?: string; dataMeeting?: string; oraMeeting?: string; durataMeeting?: number; nome?: string; cognome?: string; stato?: string })
          //  ⚠️ QUI C'ERA UN SOLO STATO ESCLUSO, «annullato», e la stessa
          //   domanda aveva due risposte diverse nel CRM e qui: una consulenza
          //   «da riprogrammare» restava occupata da questa parte e libera
          //   dall'altra. La regola è una sola e sta in crm/booking-utils —
          //   `tieneLoSlot` — perché è la stessa agenda vista da due porte.
          .filter((l) => l.consulenteId === id && l.dataMeeting === giorno && l.oraMeeting && tieneLoSlot(l.stato))
          .map((l) => ({ da: min(l.oraMeeting!), a: min(l.oraMeeting!) + (Number(l.durataMeeting) || 45), chi: `${l.nome || ""} ${l.cognome || ""}`.trim() }));

        /*  ── ⚠️ LA CAPIENZA SI LEGGE, NON SI DÀ PER SCONTATA ──────────────
            Richiesta del committente: «fai che posso cambiare il numero dalle
            impostazioni». Il numero sta in `app_config`; qui si legge a ogni
            richiesta perché questa rotta gira sul server, dove non c'è nessun
            registro in memoria da riempire all'avvio — e una riga illeggibile
            torna al predefinito invece di chiudere l'agenda. */
        //  `app_config` è nata dopo l'ultima generazione dei tipi Supabase:
        //  senza questo appiglio un banale `.eq("key", …)` non compila. Stessa
        //  scelta già fatta in api.presenter.pricing.
        const elencoDb = supabaseAdmin as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              like: (k: string, v: string) => Promise<{ data: { key: string; value?: string | null }[] | null }>;
            };
          };
        };
        const configDb = supabaseAdmin as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              eq: (k: string, v: string) => {
                maybeSingle: () => Promise<{ data: { value?: string | null } | null }>;
              };
            };
          };
        };
        const { data: rigaCap } = await configDb
          .from("app_config").select("value").eq("key", CHIAVE_CAPIENZA).maybeSingle();
        const capienza = leggiCapienzaDaJson(rigaCap?.value);

        /*  ── ⚠️ LE FASCE TENUTE PER UNO SOLO ──────────────────────────────
            Richiesta del committente: «quando fisso un appuntamento posso
            selezionare se bloccare la fascia per solo quella persona, oppure
            se rimane aperta».
            Il modo sta sulla riga della fascia (`fascia:<consulente>:<minuto>`),
            e si leggono in una volta sola quelle del giorno: una richiesta,
            non una per orario.
            ⚠️ LA CHIAVE SI CALCOLA QUI, SUL SERVER, e non arriva dal browser:
             `minutoDi` passa da `toISOString()`, quindi il risultato dipende
             dal fuso di chi la calcola. Le chiavi scritte dalle altre rotte
             nascono tutte da questa parte (api.crm.meeting-session), e una
             calcolata in Italia non le troverebbe mai. */
        const { data: righeFasce } = await elencoDb
          .from("app_config").select("key,value").like("key", `${BASE_FASCIA}:${id.toLowerCase().replace(/[^a-z0-9-]/g, "")}:%`);
        const modoDi = new Map<string, ModoFascia>();
        for (const r of (righeFasce as { key: string; value?: string | null }[] | null) ?? [])
          modoDi.set(r.key, leggiModoFascia(r.value));

        // le pause possono essere per giorno oppure uguali per tutti
        const pause: Fascia[] = Array.isArray(d.pause) ? d.pause : (d.pause?.[String(dow)] ?? []);

        const slot: {
          ora: string;
          libero: boolean;
          stato: StatoSlot;
          presi: number;
          capienza: number;
          modo: ModoFascia;
          chi?: string;
          fino?: string;
          copertoDa?: string;
        }[] = [];
        for (const f of d.fasceOrarie ?? [{ inizio: "09:00", fine: "19:00" }]) {
          for (let t = min(f.inizio); t + durata <= min(f.fine); t += 30) {
            const inPausa = pause.some((p) => t < min(p.fine) && t + durata > min(p.inizio));
            //  Il modo di QUESTA mezz'ora: «solo» = un posto, e basta.
            const modo = modoDi.get(chiaveFascia(id, `${giorno}T${hhmm(t)}`)) ?? "aperta";
            /*  ── ⚠️ «INSIEME» NON VUOL DIRE «NELLO STESSO MOMENTO» ────────
                Qui si contava chiunque si SOVRAPPONESSE. Ma due persone
                finiscono nella stessa consulenza solo se hanno lo stesso
                minuto di inizio — è così che nasce la stanza condivisa — e
                così le 10:00 che si accavallano a una consulenza delle 9:45
                risultavano «1/3, c'è ancora posto». Prenotandole non si
                aggiungeva nessuno a quella consulenza: se ne creava una
                SECONDA, sovrapposta, con un altro link.
                La regola adesso è una sola, provata, e la usa anche il browser
                (crm/fascia-consulenza → `statoDellaFascia`). */
            const e = statoDellaFascia({
              inizio: t,
              durata,
              occupati: occupati.map((o) => ({ ...o, consulenza: true })),
              modo,
              capienza,
              inPausa,
            });
            const presi = e.presi;
            slot.push({
              ora: hhmm(t),
              libero: slotScegliibile(e),
              stato: e.stato,
              ...(e.copertoDa != null ? { copertoDa: hhmm(e.copertoDa) } : {}),
              ...(e.fino != null ? { fino: hhmm(e.fino) } : {}),
              ...(e.chi ? { chi: e.chi } : {}),
              presi,
              //  ⚠️ Si manda la capienza EFFETTIVA di questa fascia, non quella
              //   generale: è il numero che il contatore scrive («1/1» su una
              //   fascia tenuta per uno solo), e se qui uscisse sempre 3 chi
              //   guarda leggerebbe «1/3» su un'ora che non accetta nessun
              //   altro.
              capienza: postiDellaFascia({ modo, capienza }),
              modo,
            });
          }
        }
        return json({
          ok: true, giorno, durata, capienza, slot,
          occupati: occupati.map((o) => ({ ora: hhmm(o.da), fine: hhmm(o.a), chi: o.chi })),
        });
      },
    },
  },
});
