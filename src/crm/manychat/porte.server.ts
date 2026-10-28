/** ── LE PORTE VERE DI MANYCHAT: «RISPOSTA» (U2) E «GIRO» (compito 3) ────────
 *
 *  Commessa 2026-10-23. Il collegamento fra la logica pura (`risposta.ts`,
 *  `giro.ts`) e Supabase: nessuna regola qui, solo letture e scritture.
 *  `porteRisposta()` serve la rotta delle risposte, `porteGiro()` il giro.
 *
 *  ⚠️ Tutto con la chiave di servizio, sempre con `user_id` nel filtro: la RLS
 *   qui non vale, quindi la scheda o il contatto di un'altra installazione non
 *   si devono poter toccare.
 *  ⚠️ Chi legge o scrive LANCIA con `{ code }` se il database dice di no: la
 *   logica registra solo il codice. Mai il messaggio d'errore (può contenere
 *   dati del cliente).
 *  ⚠️ Mai una chiamata fuori dal database.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STATI_CON_MESSAGGIO } from "../promemoria/risposta";
import { STATI_APPUNTAMENTO, type Consultant, type ContattoWa } from "../types";
import { portePortaVere, chiaveManychatPresente } from "./porta.server";
import type { CambioContatto } from "./contatto";
import type { AmbitoSchede, ConfigGiro, PorteGiro, RigaGiroDb, StatoGiroSalvato } from "./giro";
import { configDaRiga, fraseModuloDa, type RigaConfig } from "./pannello";
import { TABELLA_STATI } from "./stati";
import { MEMORIA_SALTI_MIN, STATI_LEAD_NUOVO } from "./sequenze";
import { STATI_RICONTATTO_AUTOMATICO, type InvioPerFreno } from "./regole";
import type { SchedaQuando } from "./quando";
import type { PorteRisposta as PorteConferma } from "../promemoria/in-entrata";
import type { InvioAbbinabile } from "./ritorno";
import type { PorteRispostaManychat } from "./risposta";

type ErroreDb = { code?: string | null; message?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  in(c: string, v: string[]): Filtro<T>;
  gte(c: string, v: string): Filtro<T>;
  lte(c: string, v: string): Filtro<T>;
  is(c: string, v: null): Filtro<T>;
  not(c: string, op: string, v: null): Filtro<T>;
  or(filtri: string): Filtro<T>;
  order(c: string, o: { ascending: boolean }): Filtro<T>;
  limit(n: number): Filtro<T>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}
/** I tipi generati non conoscono le tabelle nuove né le colonne nuove. */
const db = () =>
  supabaseAdmin as unknown as {
    from(t: string): {
      select<T = Record<string, unknown>[]>(c: string): Filtro<T>;
      insert(v: Record<string, unknown>): Esito<unknown>;
      upsert(v: Record<string, unknown>, o: { onConflict: string }): Esito<unknown>;
      update(v: Record<string, unknown>): Filtro<unknown>;
    };
    rpc(fn: string, a: Record<string, unknown>): Esito<unknown>;
  };

/** Le letture di `schede()` per gli importati e i ritorni: pagine di 1000, al massimo cinque. */
const RIGHE_PER_PAGINA = 1000;
const PAGINE_MAX = 5;

/** Il database dice di no: si lancia SOLO il codice. */
const lancia = (e: NonNullable<ErroreDb>): never => {
  throw { code: e.code ?? "?" };
};
/** La tabella (o la cache dello schema) non ha ancora la migrazione M1. */
const tabellaMancante = (e: NonNullable<ErroreDb>) =>
  ["42P01", "PGRST205", "42703", "PGRST204"].includes(String(e.code ?? ""));

/** Lo stesso numero come l'ha scritto qualcuno: col «+» (le righe nuove) e senza
 *  (le righe vecchie). */
const formati = (telefono: string) => [`+${telefono}`, telefono];

interface RigaInvio {
  id: string;
  lead_id: string | null;
  telefono: string;
  subscriber_id: string | null;
  prenotato_il: string;
  stato: string;
}

/** La funzione SQL della chat (o una colonna nuova) non c'è ancora: migrazione
 *  `chat_whatsapp_crm` non applicata. */
const migrazioneChatMancante = (e: NonNullable<ErroreDb>) =>
  ["42883", "PGRST202", "42703", "PGRST204"].includes(String(e.code ?? ""));

/** Un solo avviso (il codice, mai dati) per processo: il ripiego scatta a ogni
 *  messaggio e un avviso per messaggio riempirebbe il registro. */
let ripiegoAvvisato = false;
function avvisaRipiegoUnaVolta(e: NonNullable<ErroreDb>) {
  if (ripiegoAvvisato) return;
  ripiegoAvvisato = true;
  console.warn(
    `[manychat-risposta] whatsapp_registra_entrata non c'è (${String(e.code ?? "?")}): contatore non atomico finché non si applica la migrazione chat_whatsapp_crm`,
  );
}

/** Il vecchio percorso, per prima della migrazione: legge e riscrive. Il +1 NON
 *  è atomico (due messaggi insieme possono contarne uno): meglio del fisso a 1
 *  di prima, e vale solo finché la migrazione non c'è. */
async function aggiornaContattoSenzaMigrazione(
  userId: string,
  { telefono, leadId, adesso }: { telefono: string; leadId: string | null; adesso: Date },
): Promise<void> {
  const { data, error } = await db()
    .from("whatsapp_contacts")
    .select<
      { id: string; lead_id: string | null; unread_count: number | null }[]
    >("id, lead_id, unread_count")
    .eq("user_id", userId)
    .in("phone_e164", formati(telefono))
    .limit(1);
  if (error) return lancia(error);
  const ora = adesso.toISOString();
  const esiste = data?.[0];
  if (esiste) {
    const { error: e2 } = await db()
      .from("whatsapp_contacts")
      .update({
        last_message_at: ora,
        unread_count: (esiste.unread_count ?? 0) + 1,
        ...(leadId && !esiste.lead_id ? { lead_id: leadId } : {}),
      })
      .eq("id", esiste.id)
      .eq("user_id", userId);
    if (e2) lancia(e2);
    return;
  }
  const { error: e3 } = await db()
    .from("whatsapp_contacts")
    .upsert(
      {
        user_id: userId,
        phone_e164: `+${telefono}`,
        ...(leadId ? { lead_id: leadId } : {}),
        last_message_at: ora,
        unread_count: 1,
      },
      { onConflict: "user_id,phone_e164" },
    );
  if (e3) lancia(e3);
}

export function porteRisposta(): PorteRispostaManychat {
  return {
    avviso: (m) => console.warn("[manychat-risposta]", m),

    utente: async () => {
      const { data, error } = await db()
        .from("manychat_config")
        .select<{ user_id: string | null }[]>("user_id")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        if (tabellaMancante(error)) return { userId: null, motivo: "manca_migrazione" };
        return lancia(error);
      }
      const id = data?.user_id;
      return id ? { userId: id } : { userId: null, motivo: "non_configurato" };
    },

    invii: async ({ userId, crmInvioId, subscriberId, telefono, dal }) => {
      //  ⚠️ I tre valori sono già ripuliti (uuid, cifre): niente di libero nel filtro.
      const o: string[] = [];
      if (crmInvioId) o.push(`id.eq.${crmInvioId}`);
      if (subscriberId) o.push(`subscriber_id.eq.${subscriberId}`);
      if (telefono) o.push(`telefono.eq.${telefono}`);
      if (o.length === 0) return [];
      const { data, error } = await db()
        .from("manychat_invii")
        .select<RigaInvio[]>("id, lead_id, telefono, subscriber_id, prenotato_il, stato")
        .eq("user_id", userId)
        .gte("prenotato_il", dal.toISOString())
        .or(o.join(","))
        .order("prenotato_il", { ascending: false })
        .limit(50);
      if (error) return lancia(error);
      return (data ?? []).map(
        (r): InvioAbbinabile => ({
          id: r.id,
          leadId: r.lead_id,
          telefono: r.telefono,
          subscriberId: r.subscriber_id,
          prenotatoIl: r.prenotato_il,
          stato: r.stato,
        }),
      );
    },

    contattoNoto: async (userId, telefono) => {
      const { data, error } = await db()
        .from("whatsapp_contacts")
        .select<{ lead_id: string | null }[]>("lead_id")
        .eq("user_id", userId)
        .in("phone_e164", formati(telefono))
        .limit(1);
      if (error) return lancia(error);
      return data && data.length > 0 ? { leadId: data[0].lead_id } : null;
    },

    registraMessaggio: async (userId, m) => {
      const { error } = await db()
        .from("whatsapp_messages")
        .insert({
          user_id: userId,
          lead_id: m.leadId,
          direction: "inbound",
          from_number: `+${m.telefono}`,
          to_number: "manychat",
          body: m.testo,
          wa_message_id: m.waId,
          status: "delivered",
          canale: "manychat",
          raw_payload: {},
        });
      //  23505 = `wa_message_id` già c'è: la stessa risposta è arrivata due volte.
      if (error) return error.code === "23505" ? "doppione" : lancia(error);
      return "nuovo";
    },

    aggiornaContatto: async (userId, x) => {
      //  La funzione SQL fa tutto in un colpo (+1 atomico, orologio del database).
      const { error } = await db().rpc("whatsapp_registra_entrata", {
        p_user_id: userId,
        p_phone: `+${x.telefono}`,
        p_lead_id: x.leadId,
        p_il: x.adesso.toISOString(),
        p_anteprima: x.anteprima,
        p_subscriber_id: x.subscriberId,
        p_nome: x.nome,
      });
      if (!error) return;
      //  Prima della migrazione la funzione (o le colonne) non c'è: si ripiega.
      if (!migrazioneChatMancante(error)) return lancia(error);
      avvisaRipiegoUnaVolta(error);
      await aggiornaContattoSenzaMigrazione(userId, x);
    },

    conferma: (userId, telefono, adesso): PorteConferma => ({
      schedeConMessaggio: async () => {
        const { data, error } = await db()
          .from("crm_leads")
          .select<{ id: string; data: Record<string, unknown> }[]>("id, data")
          .eq("user_id", userId)
          .in("data->promemoria->>stato", [...STATI_CON_MESSAGGIO]);
        //  Un errore NON è «nessuna scheda»: altrimenti il SÌ si perderebbe in silenzio.
        if (error) return lancia(error);
        return data ?? [];
      },
      //  Solo la funzione SQL, che tocca `data.promemoria` e basta: il browser
      //  potrebbe star scrivendo la stessa scheda.
      aggiorna: async (id, pezzo, seChiave) => {
        const { error } = await db().rpc("promemoria_aggiorna", {
          p_id: id,
          p_patch: pezzo,
          p_se_chiave: seChiave,
        });
        return { error };
      },
      segnaStop: async () => {
        const { error } = await db()
          .from("whatsapp_contacts")
          .update({ non_scrivere_dal: adesso.toISOString() })
          .eq("user_id", userId)
          .in("phone_e164", formati(telefono))
          //  Solo chi non è già in STOP: la data «dal» resta quella del primo STOP.
          .is("non_scrivere_dal", null);
        return { error };
      },
      avviso: (m) => console.warn("[manychat-risposta] conferma:", m),
    }),

    //  ── Il secondo stato (compito 3) ──
    rispostaArrivata: async (userId, invioId, adesso) => {
      const { error } = await db().rpc("manychat_risposta_arrivata", {
        p_user_id: userId,
        p_id: invioId,
        p_il: adesso.toISOString(),
      });
      if (error) lancia(error);
    },
    contattoDi: async (userId, leadId) => {
      const { data, error } = await db()
        .from("crm_leads")
        .select<{ data: { contattoWa?: ContattoWa } | null }>("data")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return lancia(error);
      return data ? { contattoWa: data.data?.contattoWa } : null;
    },
    scriviContatto: (userId, leadId, cambio) => scriviContattoWa(userId, leadId, cambio),
  };
}

/** `contatto_wa_aggiorna`: tocca solo `data.contattoWa`, con le guardie dentro
 *  l'UPDATE (STOP appiccicoso per gli automatismi, `invioId`). Vero se ha
 *  scritto. */
async function scriviContattoWa(
  userId: string,
  leadId: string,
  cambio: CambioContatto,
  seInvio?: string,
): Promise<boolean> {
  const { data, error } = await db().rpc("contatto_wa_aggiorna", {
    p_user_id: userId,
    p_id: leadId,
    p_patch: cambio.patch,
    p_voce: cambio.voce,
    p_se_invio: seInvio ?? null,
  });
  if (error) return lancia(error);
  return data === true;
}

/** `lead_attesa_whatsapp`: «da contattare» → «attesa_whatsapp», tocca solo `stato`, `statoDal`
 *  e il «da dove veniva». Vero se ha scritto (falso: la scheda non c'è, o non è più «da
 *  contattare»). Se la funzione non c'è (migrazione non applicata) il giro continua come
 *  prima e si avvisa una volta sola. */
let attesaAvvisata = false;
async function scriviAttesaWhatsapp(userId: string, leadId: string, il: Date): Promise<boolean> {
  const { data, error } = await db().rpc("lead_attesa_whatsapp", {
    p_user_id: userId,
    p_id: leadId,
    p_il: il.toISOString(),
  });
  if (error) {
    if (!funzioneMancante(error)) return lancia(error);
    if (!attesaAvvisata) {
      attesaAvvisata = true;
      console.warn(
        `[manychat-giro] lead_attesa_whatsapp non c'è (${String(error.code ?? "?")}): lo stato non cambia dopo il primo messaggio finché non si applica la migrazione manychat_attesa_whatsapp`,
      );
    }
    return false;
  }
  return data === true;
}

//  ═══════════════════════════════════════════════════════════════════════════
//   LA PARTE DEL GIRO (compito 3)
//  ═══════════════════════════════════════════════════════════════════════════

/** La funzione (o la tabella) di M2 non c'è ancora. */
const funzioneMancante = (e: NonNullable<ErroreDb>) =>
  tabellaMancante(e) || ["42883", "PGRST202"].includes(String(e.code ?? ""));

const GIORNO_MS = 86_400_000;

/** Le porte vere del giro a orario. L'installazione è quella di
 *  `manychat_config` (riga unica): le funzioni SQL portano comunque `user_id`
 *  in ogni WHERE. Non lancia mai un messaggio d'errore del database: solo il
 *  codice. */
export function porteGiro(): PorteGiro {
  const di = crypto.randomUUID();
  const comeSchede = (righe: { id: string; data: Record<string, unknown> | null }[] | null) =>
    (righe ?? []).map(
      (r): SchedaQuando => ({ id: r.id, data: (r.data ?? {}) as SchedaQuando["data"] }),
    );
  return {
    adesso: () => new Date(),
    caso: () => Math.random(),
    avviso: (codice) => console.warn("[manychat-giro]", codice),

    prendiLucchetto: async (secondi) => {
      const { data, error } = await db().rpc("manychat_prendi_giro", {
        p_di: di,
        p_secondi: secondi,
      });
      if (error) {
        if (funzioneMancante(error)) return "senza_migrazione";
        return lancia(error);
      }
      return data === true ? "preso" : "occupato";
    },
    lasciaLucchetto: async () => {
      const { error } = await db().rpc("manychat_lascia_giro", { p_di: di });
      if (error) lancia(error);
    },

    leggiConfig: async () => {
      //  `select *`: le colonne di S2 e `controlli` ci sono solo se le migrazioni
      //  sono state applicate; se mancano valgono spente (il giro di prima resta
      //  identico). Il riquadro legge la riga con le stesse funzioni.
      const { data, error } = await db()
        .from("manychat_config")
        .select<RigaConfig>("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        if (tabellaMancante(error)) return { fermo: "senza_migrazione" as const };
        return lancia(error);
      }
      if (!data?.user_id) return { fermo: "senza_configurazione" as const };
      const c = configDaRiga(data);
      return {
        userId: data.user_id,
        canale: c.canale,
        acceso: c.acceso,
        promemoria: c.promemoria,
        ricontatti: c.ricontatti,
        leadNuovo: c.leadNuovo,
        giornoMeet: c.giornoMeet,
        leadNuovoDal: c.leadNuovoDal,
        stati: c.stati,
        indirizzoSede: c.indirizzoSede,
        fraseModuloDal: fraseModuloDa(data.controlli)?.il ?? null,
        tetti: c.tetti,
        flussi: c.flussi,
        primaAccensione: c.primaAccensione,
        ultimaAccensione: c.ultimaAccensione,
      };
    },
    leggiGiro: async (): Promise<RigaGiroDb> => {
      const { data, error } = await db()
        .from("manychat_giro")
        .select<{
          prossimo_ricontatto_dopo: string | null;
          falliti_di_fila: number | null;
          stato: Partial<StatoGiroSalvato> | null;
        }>("prossimo_ricontatto_dopo, falliti_di_fila, stato")
        .eq("id", 1)
        .maybeSingle();
      if (error) return lancia(error);
      return {
        prossimoRicontattoDopo: data?.prossimo_ricontatto_dopo ?? null,
        falliti: data?.falliti_di_fila ?? 0,
        stato: data?.stato ?? {},
      };
    },
    chiaveManychat: chiaveManychatPresente,

    consulenti: async (userId) => {
      const { data, error } = await db()
        .from("crm_consultants")
        .select<Pick<Consultant, "id" | "data">[]>("id, data")
        .eq("user_id", userId);
      if (error) return lancia(error);
      return data ?? [];
    },
    //  ⚠️ PostgREST dà al massimo 1000 righe per richiesta, in ordine qualunque, e
    //  taglia in silenzio: ogni lettura qui dentro ha quindi un LIMITE DI DATA (o un
    //  insieme piccolo per natura) che la tiene lontana da mille. Una lettura nuova
    //  senza un limite di data non va aggiunta.
    schede: async (userId, oggi, ambito) => {
      const giorno = (n: number) =>
        new Date(Date.parse(`${oggi}T00:00:00Z`) + n * GIORNO_MS).toISOString().slice(0, 10);
      type Righe = { id: string; data: Record<string, unknown> | null }[];
      const leggi = (q: Esito<Righe>) =>
        Promise.resolve(q).then(({ data, error }) => {
          if (error) return lancia(error);
          return data ?? [];
        });
      const schede = () => db().from("crm_leads").select<Righe>("id, data").eq("user_id", userId);
      /** Tutte le righe di una lettura, a pagine di 1000 per `id` (PostgREST taglia lì). */
      const tutte = async (costruisci: () => Filtro<Righe>): Promise<Righe> => {
        const viste = new Map<string, Righe[number]>();
        let da = "";
        for (let pagina = 0; pagina < PAGINE_MAX; pagina++) {
          let q = costruisci().order("id", { ascending: true }).limit(RIGHE_PER_PAGINA);
          if (da) q = q.gte("id", da);
          const righe = await leggi(q);
          const prima = viste.size;
          for (const r of righe) viste.set(r.id, r);
          if (righe.length < RIGHE_PER_PAGINA || viste.size === prima) return [...viste.values()];
          da = righe[righe.length - 1].id;
        }
        console.warn("[manychat-giro]", "schede_troncate");
        return [...viste.values()];
      };
      const lavori: Promise<Righe>[] = [
        //  gli appuntamenti di oggi e di domani (promemoria, mattina, ora esatta)
        leggi(
          schede()
            .in("data->>stato", STATI_APPUNTAMENTO as string[])
            .gte("data->>dataMeeting", oggi)
            .lte("data->>dataMeeting", giorno(1)),
        ),
        //  i ricontatti a data (sei stati): il giorno di oggi e il recupero di ieri
        //  (con la domenica in mezzo, quattro giorni coprono tutto)…
        leggi(
          schede()
            .in("data->>stato", STATI_RICONTATTO_AUTOMATICO)
            .gte("data->>dataRicontatto", giorno(-4))
            .lte("data->>dataRicontatto", oggi)
            .limit(2000),
        ),
        //  …e il vecchio `callbackAt` (nessuno lo scrive più, ma la regola lo legge)
        leggi(
          schede()
            .in("data->>stato", STATI_RICONTATTO_AUTOMATICO)
            .not("data->>callbackAt", "is", null)
            .limit(2000),
        ),
      ];
      //  I lead del modulo Meta, entrati dall'accensione in poi. Una sequenza dura al
      //  massimo 72 h + 24 h + 48 h: oltre sette giorni nessuno ne ha più bisogno.
      //  Due strade per la data d'ingresso (foglio / file): due letture, semplici.
      if (ambito.leadNuoviDal) {
        const dal = new Date(
          Math.max(Date.parse(ambito.leadNuoviDal), Date.parse(oggi) - 7 * GIORNO_MS),
        ).toISOString();
        const moduli = () =>
          schede()
            .eq("data->consensoModulo->>via", "modulo_meta")
            .in("data->>stato", STATI_LEAD_NUOVO);
        lavori.push(leggi(moduli().gte("data->origineIngresso->>il", dal)));
        lavori.push(leggi(moduli().gte("data->listaOrigine->>il", dal)));
      }
      //  Commessa 2026-10-28: i lead «da contattare» (importati o no) non ancora scritti e i contatti di
      //  ritorno (`ricarico.ultimo`). Niente finestra di data, ma ogni lettura è limitata da
      //  stato (o dal ricarico) e va a pagine di 1000 in ordine di `id`, fino a
      //  cinque pagine: oltre si tace e si dice (`schede_troncate`), mai un taglio nascosto.
      //  Gli importati già scritti (secondo stato presente) restano fuori dalla lettura, salvo
      //  «non raggiungibile» (un ritentativo). Il resto lo decide `decidiLeadNuovi`.
      //  shortcut: la lettura dei ritorni rilegge ogni giro tutte le schede con un ricarico;
      //  da cambiare (colonna o indice dedicati) se diventano migliaia.
      if (ambito.importatiERitorni) {
        //  Dal 28/10 (richiesta del titolare) TUTTI i «da contattare», importati o no.
        const importati = () => schede().eq("data->>stato", "da_contattare");
        lavori.push(tutte(() => importati().is("data->>contattoWa", null)));
        lavori.push(tutte(() => importati().eq("data->contattoWa->>stato", "non_raggiungibile")));
        lavori.push(tutte(() => schede().not("data->ricarico->>ultimo", "is", null)));
      }
      //  I messaggi per stato accesi. A evento: serve `statoDal` dall'accensione in poi.
      const accesi = Object.keys(ambito.stati).filter((s) => s in TABELLA_STATI);
      const aEvento = accesi.filter(
        (s) =>
          TABELLA_STATI[s as keyof typeof TABELLA_STATI]?.quando === "a_evento" ||
          s === "da_spostare",
      );
      if (aEvento.length > 0) {
        //  Un evento non parte oltre 72 h (più la memoria dei «salta») dopo `statoDal`:
        //  prima di allora le schede non servono, e sono quelle che si accumulano.
        //  `oggi` è la mezzanotte UTC del giorno di Roma, cioè non dopo «adesso»: il
        //  limite è un po' largo, mai stretto.
        const scade = Date.parse(oggi) - (72 * 60 + MEMORIA_SALTI_MIN) * 60_000;
        const primo = aEvento
          .map((s) => Date.parse(ambito.stati[s]))
          .filter(Number.isFinite)
          .reduce((a, b) => Math.min(a, b), Infinity);
        if (Number.isFinite(primo))
          lavori.push(
            leggi(
              schede()
                .in("data->>stato", aEvento)
                .gte("data->>statoDal", new Date(Math.max(primo, scade)).toISOString())
                .limit(2000),
            ),
          );
      }
      //  A orario: la chiamata di oggi; la sede il giorno dopo (di sabato anche domenica e lunedì).
      if (accesi.includes("richiamo"))
        lavori.push(
          leggi(schede().eq("data->>stato", "richiamo").eq("data->>dataRicontatto", oggi)),
        );
      if (accesi.includes("viene_in_sede"))
        lavori.push(
          leggi(
            schede()
              .eq("data->>stato", "viene_in_sede")
              .gte("data->>dataVieneInSede", oggi)
              .lte("data->>dataVieneInSede", giorno(2)),
          ),
        );
      const perId = new Map<string, SchedaQuando>();
      for (const righe of await Promise.all(lavori))
        for (const s of comeSchede(righe)) perId.set(s.id, s);
      return [...perId.values()];
    },
    schedeInAttesa: async (userId) => {
      const { data, error } = await db()
        .from("crm_leads")
        .select<{ id: string; data: Record<string, unknown> | null }[]>("id, data")
        .eq("user_id", userId)
        .eq("data->contattoWa->>stato", "in_attesa");
      if (error) return lancia(error);
      return comeSchede(data);
    },
    scheda: async (userId, id) => {
      const { data, error } = await db()
        .from("crm_leads")
        .select<{ id: string; data: Record<string, unknown> | null }>("id, data")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return lancia(error);
      return data ? comeSchede([data])[0] : null;
    },
    //  shortcut: stesso tetto di mille righe; il registro di otto giorni ne ha
    //  qualche centinaio. Da cambiare se le conferme diventano migliaia.
    invii: async (userId, dal) => {
      const { data, error } = await db()
        .from("manychat_invii")
        .select<
          {
            telefono: string;
            tipo: InvioPerFreno["tipo"];
            stato: InvioPerFreno["stato"];
            prenotato_il: string;
            risposta_il: string | null;
            sbloccato_il: string | null;
            chiave: string | null;
          }[]
        >("telefono, tipo, stato, prenotato_il, risposta_il, sbloccato_il, chiave")
        .eq("user_id", userId)
        .gte("prenotato_il", dal.toISOString());
      if (error) return lancia(error);
      return (data ?? []).map(
        (r): InvioPerFreno => ({
          telefono: r.telefono,
          tipo: r.tipo,
          stato: r.stato,
          prenotatoIl: r.prenotato_il,
          rispostaIl: r.risposta_il,
          sbloccatoIl: r.sbloccato_il,
          chiave: r.chiave,
        }),
      );
    },

    prenota: async (userId, p, tetti, intervalloMin) => {
      const { data, error } = await db().rpc("manychat_prenota_giro", {
        p_user_id: userId,
        p: {
          tipo: p.tipo,
          telefono: p.telefono,
          lead_id: p.leadId,
          chiave: p.chiave,
          flow_ns: p.flowNs,
          previsto_il: p.previstoIl,
        },
        p_tetti: tetti,
        p_intervallo_min: intervalloMin,
      });
      if (error) return lancia(error);
      const r = data as Record<string, unknown> | null;
      if (typeof r?.id === "string") return { id: r.id };
      if (typeof r?.motivo === "string") return { motivo: r.motivo };
      throw { code: "risposta" };
    },
    annulla: async (userId, invioId, motivo) => {
      const { error } = await db().rpc("manychat_giro_annulla", {
        p_user_id: userId,
        p_id: invioId,
        p_motivo: motivo,
      });
      if (error) lancia(error);
    },
    aggiornaContatto: (userId, leadId, cambio, seInvio) =>
      scriviContattoWa(userId, leadId, cambio, seInvio),
    attesaWhatsapp: scriviAttesaWhatsapp,

    porta: (userId, config) => portePortaVere(userId, { flussi: config.flussi }),

    spegni: async (motivo) => {
      const { error } = await db()
        .from("manychat_config")
        .update({
          acceso: false,
          fermato_motivo: motivo.slice(0, 200),
          aggiornato_da: "giro",
          aggiornato_il: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) lancia(error);
    },
    scriviGiro: async ({ ultimoGiroIl, falliti, stato }) => {
      const { error } = await db()
        .from("manychat_giro")
        .update({
          ultimo_giro_il: ultimoGiroIl.toISOString(),
          falliti_di_fila: falliti,
          stato,
        })
        .eq("id", 1);
      if (error) lancia(error);
    },
  };
}
