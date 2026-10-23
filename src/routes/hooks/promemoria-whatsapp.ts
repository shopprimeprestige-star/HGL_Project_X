/** ─────────────────────────────────────────────────────────────────────────
 *  CONFERMA AUTOMATICA DELLA CONSULENZA SU WHATSAPP («Rispondi SÌ»)
 *
 *  A COSA SERVE
 *  Ogni 2 minuti guarda le schede con un appuntamento e, a chi ha appena
 *  prenotato, manda UN messaggio con giorno, ora, link e «risponda SÌ per
 *  confermare» (modello Meta `consulenza_conferma_presenza`). Le regole sono
 *  in `crm/promemoria/` e sono provate; qui c'è solo il collegamento a
 *  Supabase e alla Graph API (le «porte» di `giroPromemoria`).
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/promemoria-whatsapp con Authorization che porta la chiave
 *  pubblicabile, come gli altri hook (pg_cron, vedi la migrazione
 *  `promemoria_whatsapp_cron`). Chi ha la chiave pubblica può solo anticipare
 *  un giro che farebbe comunque il cron; due giri a meno di 60 secondi: il
 *  secondo esce subito. La risposta ha solo conteggi: niente id, nomi o numeri.
 *  ⚠️ La prova a secco («Controlla ora») e l'interruttore NON stanno qui:
 *   stanno in `/api/crm/promemoria-whatsapp`, dietro `guardiaCRM` col permesso
 *   «impostazioni». La sessione Supabase non basta a dire chi bussa: con
 *   l'accesso col PIN è quella del proprietario per tutti (api.crm.accesso).
 *
 *  COSA SERVE (e senza cosa non parte niente, e lo dice)
 *   la migrazione 20261022140000_promemoria_whatsapp.sql; l'interruttore
 *   acceso; le chiavi WhatsApp con il numero live (non sandbox); l'App Secret;
 *   il modello approvato da Meta.
 *
 *  CANALE (commessa 2026-10-23): ogni installazione ha il suo canale,
 *  `cloud` (la Graph API diretta, come sempre) o `manychat`. L'invio passa
 *  dalla porta unica (`crm/manychat/porta`), che con `cloud` manda lo stesso
 *  corpo di prima. Senza la migrazione M1 il canale è `cloud`.
 *
 *  ⚠️ I TOKEN RESTANO QUI DENTRO: non escono nelle risposte né nei log, e il
 *   giro non li vede (riceve le impostazioni senza segreti).
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Lead, PromemoriaWhatsapp } from "@/crm/types";
import { STATI_APPUNTAMENTO } from "@/crm/types";
import { valoriDaLead } from "@/crm/whatsapp";
import { NOME_MODELLO } from "@/crm/promemoria/invio";
import { classificaErroreMeta, mancaMigrazione, FRASI_BLOCCO } from "@/crm/promemoria/pronto";
import type { CodiceBlocco } from "@/crm/promemoria/pronto";
import { inviaWhatsapp, rispostaPerConferma } from "@/crm/manychat/porta";
import type { PortePorta } from "@/crm/manychat/porta";
import { chiaveManychatPresente, leggiCanale, portePortaVere } from "@/crm/manychat/porta.server";
import {
  giroPromemoria,
  type ConfigPromemoria,
  type Impostazione,
  type Porte,
  type StatoGiro,
} from "@/crm/promemoria/giro";

const META_API = "https://graph.facebook.com/v21.0";
const CHIAVE_CONFIG = "promemoria_whatsapp";
const CHIAVE_STATO = "promemoria_whatsapp_stato";
/** Un id che non esiste: serve a chiedere «la funzione c'è?» senza toccare niente. */
const ID_NESSUNO = "00000000-0000-0000-0000-000000000000";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

type ErroreDb = { code?: string; message?: string } | null;
type Risultato<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Risultato<T> {
  eq(c: string, v: string): Filtro<T>;
  in(c: string, v: string[]): Filtro<T>;
  gte(c: string, v: string): Filtro<T>;
  not(c: string, op: string, v: null): Filtro<T>;
  limit(n: number): Filtro<T>;
  maybeSingle(): Risultato<T>;
}
/** I tipi generati non conoscono le colonne nuove né le funzioni nuove. */
const db = supabaseAdmin as unknown as {
  from(t: string): {
    select<T = Record<string, unknown>[]>(c: string): Filtro<T>;
    upsert(v: Record<string, unknown>, o: { onConflict: string }): Risultato<unknown>;
    insert(v: Record<string, unknown>): Risultato<unknown>;
  };
  rpc(fn: string, args: Record<string, unknown>): Risultato<boolean>;
};

interface Segreti {
  phoneNumberId: string;
  token: string;
  waba: string;
}

async function leggiJson<T>(chiave: string): Promise<T | null> {
  const { data } = await db
    .from("app_config")
    .select<{ value?: string | null }>("value")
    .eq("key", chiave)
    .maybeSingle();
  try {
    return data?.value ? (JSON.parse(data.value) as T) : null;
  } catch {
    return null;
  }
}

async function scriviJson(chiave: string, valore: unknown) {
  const { error } = await db
    .from("app_config")
    .upsert(
      { key: chiave, value: JSON.stringify(valore), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(`scrittura ${chiave}: ${error.code ?? ""}`);
}

/** Le porte vere del giro. `soloUtente` = solo l'installazione di chi chiede
 *  (la prova a secco del riquadro); null = tutte (il cron). */
export function porteVere(soloUtente: string | null): Porte {
  const segreti = new Map<string, Segreti>();
  /** il flusso di ogni modello, per le installazioni su ManyChat */
  const flussi = new Map<string, Record<string, string>>();
  /** le porte della porta, una per installazione: il client tiene l'id del campo */
  const porte = new Map<string, PortePorta>();
  const portaDi = (userId: string) => {
    let p = porte.get(userId);
    if (!p) {
      const s = segreti.get(userId);
      p = portePortaVere(userId, {
        flussi: flussi.get(userId),
        cloud: s ? { phoneNumberId: s.phoneNumberId, token: s.token } : undefined,
      });
      porte.set(userId, p);
    }
    return p;
  };
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.code ?? ""} ${error.message ?? ""}`);
    return data === true;
  };
  return {
    adesso: () => new Date(),
    leggiConfig: () => leggiJson<ConfigPromemoria>(CHIAVE_CONFIG),
    scriviConfig: (c) => scriviJson(CHIAVE_CONFIG, c),
    leggiStato: () => leggiJson<StatoGiro>(CHIAVE_STATO),
    scriviStato: (s) => scriviJson(CHIAVE_STATO, s),
    //  ⚠️ Il codice si pubblica prima della migrazione: qui si chiede se c'è,
    //   con una chiamata che non tocca niente (id inesistente).
    provaMigrazione: async () => {
      const f = await db.rpc("promemoria_aggiorna", {
        p_id: ID_NESSUNO,
        p_patch: {},
        p_se_chiave: null,
      });
      if (mancaMigrazione(f.error)) return false;
      const c = await db.from("whatsapp_contacts").select("non_scrivere_dal").limit(1);
      if (mancaMigrazione(c.error)) return false;
      if (f.error) throw new Error(`controllo migrazione: ${f.error.code ?? ""}`);
      return true;
    },
    impostazioni: async () => {
      let q = db.from("whatsapp_settings").select<
        {
          user_id: string;
          phone_number_id?: string | null;
          access_token?: string | null;
          business_account_id?: string | null;
          app_secret?: string | null;
          mode?: string | null;
        }[]
      >("user_id, phone_number_id, access_token, business_account_id, app_secret, mode");
      //  `null` = tutte (il cron). Una stringa, anche vuota, filtra sempre: una
      //  stringa vuota non deve mai diventare «tutte le installazioni».
      if (soloUtente !== null) q = q.eq("user_id", soloUtente);
      const { data } = await q;
      const righe = data ?? [];
      //  Il canale di ogni installazione. Un guasto lancia: il giro lo dice
      //  («controllo non riuscito») invece di scegliere il numero a caso.
      const canali = await Promise.all(righe.map((r) => leggiCanale(r.user_id)));
      return righe.map((r, i): Impostazione => {
        segreti.set(r.user_id, {
          phoneNumberId: r.phone_number_id ?? "",
          token: r.access_token ?? "",
          waba: r.business_account_id ?? "",
        });
        flussi.set(r.user_id, canali[i].flussi);
        return {
          userId: r.user_id,
          haChiavi: !!r.phone_number_id && !!r.access_token,
          haWaba: !!r.business_account_id,
          haAppSecret: !!r.app_secret,
          mode: r.mode === "sandbox" ? "sandbox" : "live",
          canale: canali[i].canale,
          haChiaveManychat: chiaveManychatPresente(),
        };
      });
    },
    schede: async (imp, oggi) => {
      const { data, error } = await db
        .from("crm_leads")
        .select<{ id: string; data: Lead["data"]; updated_at: string | null }[]>(
          "id, data, updated_at",
        )
        .eq("user_id", imp.userId)
        .in("data->>stato", STATI_APPUNTAMENTO as string[])
        .gte("data->>dataMeeting", oggi);
      if (error) throw new Error(`lettura schede: ${error.code ?? ""}`);
      return (data ?? []).map((r) => ({
        id: r.id,
        data: r.data,
        updated_at: r.updated_at,
        //  Lo stesso link per-persona del resto del CRM, mai `linkMeeting` grezzo.
        link: valoriDaLead({ id: r.id, data: r.data } as Lead, "promemoria").link ?? "",
      }));
    },
    numeriStop: async (imp) => {
      const { data } = await db
        .from("whatsapp_contacts")
        .select<{ phone_e164: string }[]>("phone_e164")
        .eq("user_id", imp.userId)
        .not("non_scrivere_dal", "is", null);
      return (data ?? []).map((r) => r.phone_e164);
    },
    aggancia: (id, chiave, pezzo) =>
      rpc("promemoria_aggancia", { p_id: id, p_chiave: chiave, p_patch: pezzo }),
    aggiorna: (id, pezzo: Partial<PromemoriaWhatsapp>, seChiave) =>
      rpc("promemoria_aggiorna", { p_id: id, p_patch: pezzo, p_se_chiave: seChiave }),
    controllaModello: async (imp) => {
      //  ManyChat: il «modello» è il flusso collegato in `manychat_config.flussi`.
      if (imp.canale === "manychat")
        return { trovato: !!flussi.get(imp.userId)?.[NOME_MODELLO], stato: "APPROVED" };
      const s = segreti.get(imp.userId);
      if (!s) return { errore: "mancano_chiavi" };
      try {
        const res = await fetch(
          `${META_API}/${s.waba}/message_templates?name=${NOME_MODELLO}&fields=name,status,category,language&limit=50`,
          { headers: { Authorization: `Bearer ${s.token}` }, signal: AbortSignal.timeout(15_000) },
        );
        const corpo = (await res.json()) as {
          data?: { name: string; status: string; language: string }[];
          error?: { code?: number };
        };
        if (corpo.error) {
          const { codice } = classificaErroreMeta(corpo.error.code);
          return {
            errore: (codice in FRASI_BLOCCO ? codice : "controllo_fallito") as CodiceBlocco,
          };
        }
        const m = (corpo.data ?? []).find((t) => t.name === NOME_MODELLO && t.language === "it");
        return m ? { trovato: true, stato: m.status } : { trovato: false };
      } catch {
        return { errore: "controllo_fallito" };
      }
    },
    //  Dalla porta unica: con `cloud` lo stesso corpo Graph di prima, con
    //  `manychat` la prenotazione, i campi e il flusso (vedi `manychat/porta.ts`).
    invia: async (imp, numero, parametri, contesto) =>
      rispostaPerConferma(
        await inviaWhatsapp(portaDi(imp.userId), {
          canale: imp.canale ?? "cloud",
          a: numero,
          modello: NOME_MODELLO,
          lingua: "it",
          parametri,
          nome: parametri[0],
          leadId: contesto?.leadId ?? null,
          tipo: "conferma",
          chiave: contesto ? `c|${contesto.chiave}|${contesto.giro}` : undefined,
        }),
      ),
    //  Ogni messaggio finisce anche nella pagina WhatsApp, con la sua scheda.
    registraInvio: async (imp, id, numero, esito) => {
      //  Col canale ManyChat la riga la scrive già la porta.
      if (imp.canale === "manychat") return;
      const s = segreti.get(imp.userId);
      const a = `+${numero}`;
      await db.from("whatsapp_messages").insert({
        user_id: imp.userId,
        lead_id: id,
        direction: "outbound",
        from_number: s?.phoneNumberId ?? null,
        to_number: a,
        body: `[template:${NOME_MODELLO}]`,
        status: esito.tipo === "ok" ? "sent" : "failed",
        wa_message_id: esito.tipo === "ok" ? esito.waId : null,
        error_message: esito.tipo === "rifiuto" ? esito.errore.codice : null,
      });
      if (esito.tipo === "ok")
        await db.from("whatsapp_contacts").upsert(
          {
            user_id: imp.userId,
            phone_e164: a,
            lead_id: id,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: "user_id,phone_e164" },
        );
    },
  };
}

export const Route = createFileRoute("/hooks/promemoria-whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__"))
          return json({ error: "unauthorized" }, 401);
        const porte = porteVere(null);
        try {
          return json(await giroPromemoria(porte, { prova: false }));
        } catch (e) {
          //  Solo il codice dell'errore nei log: mai token, mai dati del cliente.
          console.error(
            "[promemoria-whatsapp] giro interrotto:",
            e instanceof Error ? e.message.slice(0, 120) : "?",
          );
          const frase = FRASI_BLOCCO.controllo_fallito;
          await porte
            .leggiStato()
            .then((s) =>
              porte.scriviStato({
                ...(s ?? { inviatiOggi: 0, confermatiOggi: 0, senzaRisposta: 0, inAttesa: 0 }),
                giroIl: new Date().toISOString(),
                pronto: false,
                blocco: "controllo_fallito",
                frase,
              }),
            )
            .catch(() => undefined);
          return json({
            ok: false,
            prova: false,
            pronto: false,
            blocco: "controllo_fallito",
            frase,
          });
        }
      },
    },
  },
});
