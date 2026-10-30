/** ── IL CONTROLLO DELLA NOTTE DEL GIRO WHATSAPP (30/10/2026) ────────────────
 *
 *  Commessa 2026-10-30-ottimizzazioni, pacchetto p8, punti (20) e (9). Ogni
 *  mattina (pg_cron, migrazione `p8_controllo_notte`): pulisce eco e doppioni
 *  recenti (`wa_segna_eco_doppioni`, segna `duplicato_di`, non cancella mai),
 *  legge come è andato il giro e lascia al titolare UNA notifica nel CRM; se
 *  c'è qualcosa da guardare, anche una push ai SOLI telefoni del titolare. Il
 *  lunedì guarda la settimana. Le regole sono in crm/controllo-notte/regole.
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/controllo-notte con Authorization che porta la chiave
 *  pubblicabile, come gli altri hook. Chi ce l'ha può solo anticipare il giro:
 *  la notifica ha la chiave del giorno, quindi un secondo giro non ne scrive
 *  un'altra e non manda un'altra push. La risposta ha solo conteggi.
 *  ⚠️ Una lettura che non riesce non ferma il giro: finisce nel rapporto come
 *   «non sono riuscito a controllare …».
 *  ⚠️ Nei log solo codici, mai nomi, numeri o testi.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { inviaATutti } from "@/crm/push/invio.server";
import type { RigaStatoPonte } from "@/crm/chatwa/avvisoPonte";
import { CANALE_PONTE } from "@/crm/ponte/tipi";
import {
  avvisoPushControllo,
  chiaveNotifica,
  contaInvii,
  finestra24h,
  giroDi,
  inizioLetturaContatti,
  inizioPeriodo,
  inizioPulizia,
  rapportoControllo,
  type ContattoFinestra,
  type DatiControllo,
  type EsitoPulizia,
  type Lettura,
} from "@/crm/controllo-notte/regole";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as { from: (t: string) => any; rpc: any };

const PAGINA = 1000;

/** Tutte le righe di una lettura, a pagine (PostGREST ne dà al massimo 1000). */
async function aPagine<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: () => any,
): Promise<T[]> {
  const out: T[] = [];
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await query().range(da, da + PAGINA - 1);
    if (error) throw error;
    const righe = (data ?? []) as T[];
    out.push(...righe);
    if (righe.length < PAGINA) return out;
  }
}

export async function giroControlloNotte(adesso = new Date()) {
  const { data: config, error: eConfig } = await db()
    .from("manychat_config")
    .select("user_id, acceso, aggiornato_da")
    .eq("id", 1)
    .maybeSingle();
  if (eConfig) throw eConfig;
  const userId: string | null = config?.user_id ?? null;
  if (!userId) return { saltato: "non_configurato" };

  const giro = giroDi(adesso);
  const dal = inizioPeriodo(adesso, giro.periodo);
  const nonLetti: Lettura[] = [];
  /** Una lettura: se non riesce, si annota e si va avanti. */
  const leggi = async <T>(lettura: Lettura, f: () => Promise<T>, ripiego: T): Promise<T> => {
    try {
      return await f();
    } catch (e) {
      const code = (e as { code?: unknown } | null)?.code;
      console.warn(
        "[controllo-notte] lettura",
        lettura,
        typeof code === "string" ? code : "errore",
      );
      nonLetti.push(lettura);
      return ripiego;
    }
  };

  //  Prima la pulizia, così il conto delle eco è quello di stanotte.
  const pulizia = await leggi<EsitoPulizia | null>(
    "pulizia",
    async () => {
      const { data, error } = await db().rpc("wa_segna_eco_doppioni", {
        p_user_id: userId,
        p_dal: inizioPulizia(adesso, giro.periodo).toISOString(),
      });
      if (error) throw error;
      return data as EsitoPulizia;
    },
    null,
  );

  const invii = await leggi(
    "invii",
    async () =>
      contaInvii(
        await aPagine<{ stato: string; motivo: string | null }>(() =>
          db()
            .from("manychat_invii")
            .select("id, stato, motivo")
            .eq("user_id", userId)
            .in("stato", ["fallito", "incerto"])
            .gte("prenotato_il", dal.toISOString())
            .order("id", { ascending: true }),
        ),
      ),
    contaInvii([]),
  );

  const messaggiFalliti = await leggi(
    "messaggi",
    async () => {
      const { count, error } = await db()
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("direction", "outbound")
        .eq("status", "failed")
        .gte("created_at", dal.toISOString())
        //  Solo gli invii del CRM: le righe del ponte non le legge nessuna regola (I1).
        .or(`canale.is.null,canale.neq.${CANALE_PONTE}`);
      if (error) throw error;
      return count ?? 0;
    },
    0,
  );

  const ponte = await leggi<RigaStatoPonte | null>(
    "ponte",
    async () => {
      const { data, error } = await db()
        .from("ponte_wa_stato")
        .select("stato, aggiornato_il, storico")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as RigaStatoPonte | null;
    },
    null,
  );

  const manychat = await leggi(
    "manychat",
    async () => {
      const { data, error } = await db()
        .from("manychat_giro")
        .select("falliti_di_fila")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return {
        acceso: !!config?.acceso,
        //  Spento dal giro dopo troppi errori, non a mano dal titolare.
        fermatoDalGiro: !config?.acceso && config?.aggiornato_da === "giro",
        fallitiDiFila: Number(data?.falliti_di_fila ?? 0) || 0,
      };
    },
    null,
  );

  const finestra = await leggi(
    "finestra",
    async () =>
      finestra24h(
        await aPagine<ContattoFinestra>(() =>
          db()
            .from("whatsapp_contacts")
            .select(
              "id, ultimo_in_entrata_il, ultimo_in_entrata_anteprima, risposto_il, non_scrivere_dal",
            )
            .eq("user_id", userId)
            .is("non_scrivere_dal", null)
            .gte("ultimo_in_entrata_il", inizioLetturaContatti(dal).toISOString())
            .order("id", { ascending: true }),
        ),
        adesso,
        dal,
      ),
    { aperte: 0, scadute: 0 },
  );

  const dati: DatiControllo = {
    giro,
    adesso,
    nonLetti,
    invii,
    messaggiFalliti,
    pulizia,
    ponte,
    manychat,
    finestra,
  };
  const rapporto = rapportoControllo(dati);

  const { error: eNotifica } = await db()
    .from("notifications")
    .insert({
      user_id: userId,
      kind: "controllo_whatsapp",
      severity: rapporto.severity,
      title: rapporto.titolo,
      body: rapporto.corpo,
      link: "/CRM/whatsapp",
      dedupe_key: chiaveNotifica(giro),
    });
  //  23505 = la notifica di oggi c'è già: niente seconda push.
  const nuova = !eNotifica;
  if (eNotifica && eNotifica.code !== "23505") throw eNotifica;

  let push = 0;
  if (nuova && rapporto.push) {
    const { data: telefoni, error: eTel } = await db()
      .from("push_iscrizioni")
      .select("id, endpoint, p256dh, auth, consulente_id")
      .eq("user_id", userId)
      .is("consulente_id", null);
    if (!eTel && telefoni?.length)
      push = (await inviaATutti(userId, avvisoPushControllo(rapporto), telefoni)).inviate;
  }

  return {
    periodo: giro.periodo,
    severita: rapporto.severity,
    daGuardare: rapporto.daGuardare,
    pulizia,
    nonLetti,
    notificaNuova: nuova,
    push,
  };
}

export const Route = createFileRoute("/hooks/controllo-notte")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__"))
          return json({ error: "unauthorized" }, 401);
        try {
          return json(await giroControlloNotte());
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.error("[controllo-notte]", typeof code === "string" ? code : "errore");
          return json({ error: "giro interrotto" }, 500);
        }
      },
    },
  },
});
