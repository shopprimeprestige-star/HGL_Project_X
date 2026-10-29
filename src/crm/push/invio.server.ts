/** ── SPEDIRE LE NOTIFICHE A TUTTI I TELEFONI ISCRITTI ───────────────────────
 *  Lo chiamano i tre ingressi dei messaggi WhatsApp (webhook di Meta, risposte
 *  di ManyChat, ponte del Mac per i soli messaggi vivi) quando arriva un
 *  messaggio NUOVO. Dal 30/10/2026 va al consulente del lead e al titolare,
 *  non più a tutti i telefoni dello studio (`destinatari` in avviso.ts).
 *  ⚠️ NON LANCIA MAI e non fa aspettare: un guasto qui non deve far perdere il
 *   messaggio in arrivo. Ogni invio ha un tetto di 4 secondi.
 *  ⚠️ Un'iscrizione che il servizio dice morta (404/410: notifiche disattivate,
 *   app tolta dalla Home) si cancella, così non si riprova all'infinito.
 *  Nei log solo codici, mai nomi o numeri. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  FINESTRA_AVVISO_S,
  avvisaRisposta,
  chiaviDaAmbiente,
  type AvvisoPush,
  type PorteAvviso,
} from "./avviso";
import { richiestaPush } from "./webpush";

type Iscrizione = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  consulente_id?: string | null;
};

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => Promise<{ data: Iscrizione[] | null; error: unknown }>;
      };
      delete: () => { in: (k: string, v: string[]) => Promise<{ error: unknown }> };
      update: (p: Record<string, unknown>) => {
        in: (k: string, v: string[]) => Promise<{ error: unknown }>;
      };
    };
  };

/** Manda un avviso a tutte le iscrizioni di un'installazione (o a quelle date). */
export async function inviaATutti(
  userId: string,
  avviso: AvvisoPush,
  solo?: Iscrizione[],
): Promise<{ inviate: number; tolte: number }> {
  try {
    const chiavi = chiaviDaAmbiente(process.env as Record<string, string | undefined>);
    if (!chiavi || !userId) return { inviate: 0, tolte: 0 };
    const lista =
      solo ??
      (
        await db()
          .from("push_iscrizioni")
          .select("id, endpoint, p256dh, auth, consulente_id")
          .eq("user_id", userId)
      ).data ??
      [];
    //  ⚠️ UN CONSULENTE TOLTO NON RICEVE PIÙ NIENTE (revisione del 28/10): le
    //   sue iscrizioni si saltano e si cancellano. Stessi controlli dell'accesso
    //   (api.crm.accesso): PIN attivo e scheda non spenta.
    const fuori = await consulentiNonAttivi(lista);
    const via = (i: Iscrizione) => !!i.consulente_id && fuori.has(i.consulente_id);
    const daTogliere = lista.filter(via).map((i) => i.id);
    if (daTogliere.length) await db().from("push_iscrizioni").delete().in("id", daTogliere);
    const attive = lista.filter((i) => !via(i));
    if (attive.length === 0) return { inviate: 0, tolte: daTogliere.length };
    const testo = JSON.stringify(avviso);
    const esiti = await Promise.all(
      attive.map(async (i) => {
        try {
          const r = await richiestaPush(i, testo, chiavi);
          //  `redirect: "manual"`: il controllo sugli indirizzi vale anche dopo un rinvio.
          const risposta = await fetch(r.url, {
            ...r.init,
            redirect: "manual",
            signal: AbortSignal.timeout(4000),
          });
          if (risposta.status === 404 || risposta.status === 410)
            return { id: i.id, esito: "morta" as const };
          return {
            id: i.id,
            esito: risposta.ok ? ("ok" as const) : ("errore" as const),
            status: risposta.status,
          };
        } catch {
          return { id: i.id, esito: "errore" as const };
        }
      }),
    );
    const morte = esiti.filter((e) => e.esito === "morta").map((e) => e.id);
    const ok = esiti.filter((e) => e.esito === "ok").map((e) => e.id);
    if (morte.length) await db().from("push_iscrizioni").delete().in("id", morte);
    if (ok.length)
      await db()
        .from("push_iscrizioni")
        .update({ ultimo_invio: new Date().toISOString() })
        .in("id", ok);
    const errori = esiti.filter((e) => e.esito === "errore");
    if (errori.length)
      console.warn(
        "[push] invii non riusciti:",
        errori.map((e) => ("status" in e ? e.status : "rete")).join(","),
      );
    return { inviate: ok.length, tolte: morte.length + daTogliere.length };
  } catch (e) {
    console.warn("[push] errore", (e as { code?: string } | null)?.code ?? "sconosciuto");
    return { inviate: 0, tolte: 0 };
  }
}

/** I consulenti delle iscrizioni che non hanno più accesso: PIN non attivo o
 *  scheda con `attivo: false`. Un errore di lettura non toglie nessuno. */
async function consulentiNonAttivi(lista: Iscrizione[]): Promise<Set<string>> {
  const ids = [...new Set(lista.map((i) => i.consulente_id).filter((x): x is string => !!x))];
  if (ids.length === 0) return new Set();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any };
    const pin: { data: { consultant_id: string }[] | null; error: unknown } = await sb
      .from("consultant_pins")
      .select("consultant_id")
      .in("consultant_id", ids)
      .eq("active", true);
    const schede: { data: { id: string; data?: { attivo?: boolean } }[] | null; error: unknown } =
      await sb.from("crm_consultants").select("id, data").in("id", ids);
    if (pin.error || schede.error) return new Set();
    const conPin = new Set((pin.data ?? []).map((r) => r.consultant_id));
    const spente = new Set(
      (schede.data ?? []).filter((r) => r.data?.attivo === false).map((r) => r.id),
    );
    return new Set(ids.filter((id) => !conPin.has(id) || spente.has(id)));
  } catch {
    return new Set();
  }
}

//  I tipi generati non conoscono la funzione e la tabella nuove.
/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (f: string, a: Record<string, unknown>) => any;
  };
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Nome e consulente della scheda, letti dal server: dal lead se c'è,
 *  altrimenti dal numero nella rubrica WhatsApp (il ponte non ha il lead).
 *  Sempre con `user_id` nel filtro: la chiave di servizio salta la RLS. */
async function schedaDi(
  userId: string,
  leadId: string | null,
  telefono: string,
): Promise<{ nome: string | null; consulenteId: string | null } | null> {
  let id = leadId;
  if (!id) {
    const cifre = telefono.replace(/\D/g, "");
    if (!cifre) return null;
    const { data, error } = await sb()
      .from("whatsapp_contacts")
      .select("lead_id")
      .eq("user_id", userId)
      .in("phone_e164", [`+${cifre}`, cifre])
      .not("lead_id", "is", null)
      .limit(1);
    if (error) throw { code: error.code };
    id = (data as { lead_id: string | null }[] | null)?.[0]?.lead_id ?? null;
  }
  if (!id) return null;
  const { data, error } = await sb()
    .from("crm_leads")
    .select("data")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw { code: error.code };
  const d = (
    data as { data?: { nome?: string; cognome?: string; consulenteId?: string | null } } | null
  )?.data;
  if (!d) return null;
  return {
    nome: `${d.nome ?? ""} ${d.cognome ?? ""}`.trim() || null,
    consulenteId: typeof d.consulenteId === "string" && d.consulenteId ? d.consulenteId : null,
  };
}

/** Le porte vere di `avvisaRisposta`. */
const porteAvviso: PorteAvviso<Iscrizione> = {
  acceso: () => !!chiaviDaAmbiente(process.env as Record<string, string | undefined>),
  porta: async (userId, chiave) => {
    const { data, error } = await sb().rpc("push_avviso_porta", {
      p_user_id: userId,
      p_chiave: chiave,
      p_finestra_s: FINESTRA_AVVISO_S,
    });
    //  Senza la migrazione la porta non c'è: `avvisaRisposta` avvisa comunque.
    if (error) throw { code: error.code };
    return data === true;
  },
  scheda: schedaDi,
  iscrizioni: async (userId) => {
    const { data, error } = await db()
      .from("push_iscrizioni")
      .select("id, endpoint, p256dh, auth, consulente_id")
      .eq("user_id", userId);
    if (error) throw { code: (error as { code?: string }).code };
    return data ?? [];
  },
  invia: (userId, avviso, lista) => inviaATutti(userId, avviso, lista),
};

/** Un messaggio WhatsApp in entrata vero (ManyChat, webhook di Meta, ponte
 *  vivo): avvisa il consulente del lead e il titolare, una volta per numero
 *  ogni `FINESTRA_AVVISO_S` (lo stesso messaggio arriva da più strade). Non
 *  lancia mai. Eco, doppioni e storico non arrivano qui: li scartano prima
 *  `manychat/risposta.ts` e `ponte/ingresso.ts`. */
export async function avvisaMessaggioWhatsapp(p: {
  userId: string;
  telefono: string;
  leadId?: string | null;
  nomeProfilo?: string | null;
}): Promise<void> {
  const esito = await avvisaRisposta(porteAvviso, p);
  if (esito === "errore") console.warn("[push] avviso non riuscito");
}

/** I numeri del ponte vivo che hanno scritto (`ponte/ingresso.ts`). */
export async function avvisaEntratePonte(
  userId: string,
  entrate: { numero: string; nome: string | null }[],
): Promise<void> {
  await Promise.all(
    entrate.map((e) =>
      avvisaMessaggioWhatsapp({ userId, telefono: `+${e.numero}`, nomeProfilo: e.nome }),
    ),
  );
}
