/** ── IL GIRO DELL'ASSENZA ALLA CONSULENZA (commessa 2026-10-30, p5) ─────────
 *
 *  Ogni 5 minuti (pg_cron, migrazione `20261030120000_p5-consulenze`): le
 *  consulenze iniziate da 15 minuti senza nessuno nella stanza Meetly passano a
 *  «Da riprogrammare» (interruttore `assenza_auto` acceso) o vengono solo
 *  segnalate in «Da fare» (spento, di serie). La regola è in crm/manychat/consulenze (`decidiAssenza`,
 *  provata); il messaggio lo manda il giro di ManyChat col modello dello stato
 *  (`hgl_da_riprogrammare`), se il suo interruttore è acceso.
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/assenza-meet con Authorization che porta la chiave pubblicabile,
 *  come gli altri hook: chi ce l'ha può solo anticipare un giro che il cron
 *  farebbe comunque. La risposta ha solo conteggi.
 *  ⚠️ Senza la migrazione nessuno chiama questa rotta; con la migrazione e
 *   l'interruttore spento si segnala soltanto.
 *  ⚠️ Si scrive SOLO se la scheda non è cambiata dalla lettura (`updated_at`
 *   uguale): un consulente che intanto ha segnato l'esito vince sempre.
 *  ⚠️ Nei log solo conteggi e codici, mai nomi, numeri o codici di stanza.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STATI_APPUNTAMENTO, type LeadData } from "@/crm/types";
import { aRoma } from "@/crm/promemoria/formati";
import { codiceStanzaDi } from "@/crm/whatsapp";
import {
  BASE_PRESENZA,
  CHIAVE_ASSENZA_AUTO,
  giroAssenza,
  leggiAssenzaAuto,
  leggiPresenza,
  type BussataSala,
  type PorteAssenza,
  type RigaScheda,
} from "@/crm/manychat/consulenze";
import { chiaveSessione } from "@/shop/chiave-sessione";
import { BASE_SALA, leggiSala } from "@/shop/sala-attesa";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as { from: (t: string) => any };

const giornoPiu = (g: string, n: number) => {
  const [a, m, d] = g.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Gli appuntamenti ancora in piedi di ieri e di oggi (una consulenza delle
 *  23:30 si guarda fino all'una). Pochi per costruzione: una pagina basta. */
async function appuntamentiVicini(adesso: Date): Promise<RigaScheda[]> {
  const oggi = aRoma(adesso).giorno;
  const { data, error } = await db()
    .from("crm_leads")
    .select("id, data, updated_at")
    .in("data->>stato", STATI_APPUNTAMENTO)
    .gte("data->>dataMeeting", giornoPiu(oggi, -1))
    .lt("data->>dataMeeting", giornoPiu(oggi, 1))
    .order("id", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as RigaScheda[];
}

/** Chi ha bussato alla stanza (la sala, potata dopo 30') più l'ultima bussata
 *  che non si pota (`presenza_meet:<codice>`): `null` se non c'è una stanza Meetly. */
async function presenzeDi(d: Partial<LeadData>): Promise<BussataSala[] | null> {
  const codice = codiceStanzaDi(d);
  if (!codice) return null;
  const chiaveSala = chiaveSessione(BASE_SALA, codice);
  const chiaveVisto = chiaveSessione(BASE_PRESENZA, codice);
  const { data, error } = await db()
    .from("app_config")
    .select("key, value")
    .in("key", [chiaveSala, chiaveVisto]);
  if (error) throw error;
  const righe = (data ?? []) as { key: string; value: string | null }[];
  const valore = (k: string) => righe.find((x) => x.key === k)?.value ?? null;
  const visto = leggiPresenza(valore(chiaveVisto));
  return [...leggiSala(valore(chiaveSala)), ...(visto ? [{ at: visto }] : [])];
}

const porteVere: PorteAssenza = {
  acceso: async () => {
    const { data, error } = await db()
      .from("app_config")
      .select("value")
      .eq("key", CHIAVE_ASSENZA_AUTO)
      .maybeSingle();
    if (error) throw error;
    return leggiAssenzaAuto((data as { value?: string | null } | null)?.value);
  },
  appuntamenti: appuntamentiVicini,
  presenze: presenzeDi,
  scrivi: async (r, data, adesso) => {
    const { data: scritte, error } = await db()
      .from("crm_leads")
      .update({ data, updated_at: adesso.toISOString() })
      .eq("id", r.id)
      .eq("updated_at", r.updated_at)
      .select("id");
    if (error) throw error;
    return !!scritte?.length;
  },
};

export const giroAssenzaMeet = (adesso = new Date()) => giroAssenza(porteVere, adesso);

export const Route = createFileRoute("/hooks/assenza-meet")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__"))
          return json({ error: "unauthorized" }, 401);
        try {
          return json(await giroAssenzaMeet());
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.error("[assenza-meet]", typeof code === "string" ? code : "errore");
          return json({ error: "giro interrotto" }, 500);
        }
      },
    },
  },
});
