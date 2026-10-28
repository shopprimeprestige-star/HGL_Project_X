/** ── SPEDIRE LE NOTIFICHE A TUTTI I TELEFONI ISCRITTI ───────────────────────
 *  Lo chiamano i due ingressi dei messaggi WhatsApp (webhook di Meta e risposte
 *  di ManyChat) quando arriva un messaggio NUOVO.
 *  ⚠️ NON LANCIA MAI e non fa aspettare: un guasto qui non deve far perdere il
 *   messaggio in arrivo. Ogni invio ha un tetto di 4 secondi.
 *  ⚠️ Un'iscrizione che il servizio dice morta (404/410: notifiche disattivate,
 *   app tolta dalla Home) si cancella, così non si riprova all'infinito.
 *  Nei log solo codici, mai nomi o numeri. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { avvisoWhatsapp, chiaviDaAmbiente, type AvvisoPush } from "./avviso";
import { richiestaPush } from "./webpush";

type Iscrizione = { id: string; endpoint: string; p256dh: string; auth: string };

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
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", userId)
      ).data ??
      [];
    if (lista.length === 0) return { inviate: 0, tolte: 0 };
    const testo = JSON.stringify(avviso);
    const esiti = await Promise.all(
      lista.map(async (i) => {
        try {
          const r = await richiestaPush(i, testo, chiavi);
          const risposta = await fetch(r.url, { ...r.init, signal: AbortSignal.timeout(4000) });
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
    return { inviate: ok.length, tolte: morte.length };
  } catch (e) {
    console.warn("[push] errore", (e as { code?: string } | null)?.code ?? "sconosciuto");
    return { inviate: 0, tolte: 0 };
  }
}

/** Il nome della scheda (nome e cognome), letto dal server. */
async function nomeScheda(leadId: string | null | undefined): Promise<string | null> {
  if (!leadId) return null;
  try {
    const { data } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              k: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{
                data: { data?: { nome?: string; cognome?: string } } | null;
              }>;
            };
          };
        };
      }
    )
      .from("crm_leads")
      .select("data")
      .eq("id", leadId)
      .maybeSingle();
    const d = data?.data;
    return d ? `${d.nome ?? ""} ${d.cognome ?? ""}`.trim() || null : null;
  } catch {
    return null;
  }
}

/** Un messaggio WhatsApp nuovo: avvisa tutti i telefoni iscritti dello studio. */
export async function avvisaMessaggioWhatsapp(p: {
  userId: string;
  telefono: string;
  leadId?: string | null;
  nomeProfilo?: string | null;
}): Promise<void> {
  const nome = await nomeScheda(p.leadId);
  await inviaATutti(
    p.userId,
    avvisoWhatsapp({ telefono: p.telefono, nomeScheda: nome, nomeProfilo: p.nomeProfilo }),
  );
}
