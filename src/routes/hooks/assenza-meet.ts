/** ── IL GIRO DELL'ASSENZA ALLA CONSULENZA (commessa 2026-10-30, p5) ─────────
 *
 *  Ogni 5 minuti (pg_cron, migrazione `20261030120000_p5-consulenze`): le
 *  consulenze iniziate da 15 minuti senza nessuno nella stanza Meetly passano a
 *  «Da riprogrammare». La regola è in crm/manychat/consulenze (`decidiAssenza`,
 *  provata); il messaggio lo manda il giro di ManyChat col modello dello stato
 *  (`hgl_da_riprogrammare`), se il suo interruttore è acceso.
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/assenza-meet con Authorization che porta la chiave pubblicabile,
 *  come gli altri hook: chi ce l'ha può solo anticipare un giro che il cron
 *  farebbe comunque. La risposta ha solo conteggi.
 *  ⚠️ L'interruttore è il cron stesso: senza la migrazione nessuno chiama
 *   questa rotta, e niente si sposta da solo.
 *  ⚠️ Si scrive SOLO se la scheda non è cambiata dalla lettura (`updated_at`
 *   uguale): un consulente che intanto ha segnato l'esito vince sempre.
 *  ⚠️ Nei log solo conteggi e codici, mai nomi, numeri o codici di stanza.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STATI_APPUNTAMENTO, type LeadData } from "@/crm/types";
import { aRoma } from "@/crm/promemoria/formati";
import { codiceStanzaDi } from "@/crm/whatsapp";
import { decidiAssenza, type BussataSala } from "@/crm/manychat/consulenze";
import { chiaveSessione } from "@/shop/chiave-sessione";
import { BASE_SALA, leggiSala } from "@/shop/sala-attesa";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

type Riga = { id: string; data: Partial<LeadData>; updated_at: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as { from: (t: string) => any };

const giornoPiu = (g: string, n: number) => {
  const [a, m, d] = g.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Gli appuntamenti ancora in piedi di ieri e di oggi (una consulenza delle
 *  23:30 si guarda fino all'una). Pochi per costruzione: una pagina basta. */
async function appuntamentiVicini(adesso: Date): Promise<Riga[]> {
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
  return (data ?? []) as Riga[];
}

/** Chi ha bussato alla stanza: `null` se la consulenza non ha una stanza Meetly. */
async function salaDi(d: Partial<LeadData>): Promise<BussataSala[] | null> {
  const codice = codiceStanzaDi(d);
  if (!codice) return null;
  const { data, error } = await db()
    .from("app_config")
    .select("value")
    .eq("key", chiaveSessione(BASE_SALA, codice))
    .maybeSingle();
  if (error) throw error;
  return leggiSala((data as { value?: string | null } | null)?.value ?? null);
}

export async function giroAssenzaMeet(adesso = new Date()) {
  const schede = await appuntamentiVicini(adesso);
  let spostati = 0;
  let lasciati = 0;
  let cambiati = 0;
  for (const r of schede) {
    //  Prima la regola senza sala (finestra di tempo, stato): la sala si legge
    //  solo per chi sarebbe davvero da spostare.
    if (decidiAssenza(r.data, adesso, [])?.tipo !== "sposta") continue;
    const esito = decidiAssenza(r.data, adesso, await salaDi(r.data));
    if (esito?.tipo !== "sposta") {
      lasciati++;
      continue;
    }
    const { data: scritte, error } = await db()
      .from("crm_leads")
      .update({ data: { ...r.data, ...esito.patch }, updated_at: adesso.toISOString() })
      .eq("id", r.id)
      .eq("updated_at", r.updated_at)
      .select("id");
    if (error) throw error;
    if (scritte?.length) spostati++;
    else cambiati++;
  }
  return { appuntamenti: schede.length, spostati, lasciati, cambiatiNelFrattempo: cambiati };
}

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
