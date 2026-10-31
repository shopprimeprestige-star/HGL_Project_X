/** ── IL GIRO «ATTESA WHATSAPP» → «DA CHIAMARE» (28/10/2026) ─────────────────
 *
 *  Ogni 15 minuti (pg_cron, migrazione `attesa_da_chiamare_cron`): le schede in
 *  «Attesa WhatsApp» il cui ultimo messaggio è NOSTRO e la finestra delle 24 ore si è chiusa
 *  (31/10/2026; prima 10 ore, «la palla è al cliente»), senza risposta del cliente, passano a «Da chiamare».
 *  La regola è in crm/chatwa/daChiamare e crm/importa/attesa-da-chiamare (provate).
 *
 *  Nello stesso giro c'è anche il RITORNO (30/10/2026): chi è in «Da contattare»,
 *  «Non risponde», «Segreteria» o «Da chiamare» e ha scritto su WhatsApp (finestra
 *  delle 24 ore riaperta) torna in «Attesa WhatsApp», con una riga nelle note.
 *  Solo questi quattro stati: gli altri non si toccano mai.
 *
 *  E chi era già TORNATO (ricomparso da modulo, foglio o file) prima della
 *  regola del 30/10/2026 ed è rimasto nello stato di allora va in «Attesa
 *  WhatsApp» (`patchRitornoRimastoIndietro`, crm/importa/ritorno-attesa). Dopo
 *  il primo giro non trova più nessuno: i ritorni nuovi li sposta già
 *  `patchRicarico` quando arrivano.
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/attesa-da-chiamare con Authorization che porta la chiave
 *  pubblicabile, come gli altri hook: chi ce l'ha può solo anticipare un giro
 *  che il cron farebbe comunque. La risposta ha solo conteggi.
 *  ⚠️ Si scrive SOLO se la scheda non è cambiata dalla lettura (`updated_at`
 *   uguale): una setter che intanto ha segnato un esito vince sempre.
 *  ⚠️ Nei log solo conteggi e codici, mai nomi o numeri.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  nove,
  patchDaChiamare,
  patchRitornoAttesa,
  STATI_CHE_TORNANO_IN_ATTESA,
  unisciEntrate,
  type ContattoWa,
  type RigaContatto,
  type RigaMessaggio,
} from "@/crm/importa/attesa-da-chiamare";
import { inAttesaDal, telefonoE164, type MessaggioAttesa } from "@/crm/chatwa/daChiamare";
import { patchRitornoRimastoIndietro } from "@/crm/importa/ritorno-attesa";
import type { LeadData } from "@/crm/types";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

type Riga = { id: string; user_id: string; data: Partial<LeadData>; updated_at: string };
type Contatto = {
  user_id: string;
  phone_e164: string;
  ultimo_in_entrata_il: string | null;
  non_scrivere_dal: string | null;
  ultimo_messaggio_il?: string | null;
  ultimo_messaggio_direzione?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as { from: (t: string) => any };

/** Le schede in «Attesa WhatsApp», tutte: PostgREST ne dà al massimo 1000 per
 *  volta, quindi si legge a pagine, in ordine fisso (revisione del 28/10). */
async function schedeInAttesa(stato = "attesa_whatsapp"): Promise<Riga[]> {
  const out: Riga[] = [];
  const PAGINA = 1000;
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db()
      .from("crm_leads")
      .select("id, user_id, data, updated_at")
      .eq("data->>stato", stato)
      .order("id", { ascending: true })
      .range(da, da + PAGINA - 1);
    if (error) throw error;
    const righe = (data ?? []) as Riga[];
    out.push(...righe);
    if (righe.length < PAGINA) return out;
  }
}

/** I contatti WhatsApp dei SOLI numeri candidati, a blocchi: leggere tutta la
 *  rubrica si fermava a 1000 righe, e chi restava fuori sembrava «senza
 *  risposta e senza STOP» (revisione del 28/10). */
async function contattiDi(candidati: Riga[]): Promise<Map<string, ContattoWa>> {
  const perNumero = new Map<string, ContattoWa>();
  const perUtente = new Map<string, Set<string>>();
  for (const r of candidati) {
    const tel = telefonoE164(r.data?.telefono);
    if (!tel) continue;
    const insieme = perUtente.get(r.user_id) ?? new Set<string>();
    insieme.add(tel);
    perUtente.set(r.user_id, insieme);
  }
  for (const [userId, numeri] of perUtente) {
    const elenco = [...numeri];
    for (let i = 0; i < elenco.length; i += 100) {
      //  Le colonne dell'ultimo messaggio (p1-chat-veloce): se la migrazione non c'è, si legge come prima.
      const leggi = (colonne: string) =>
        db()
          .from("whatsapp_contacts")
          .select(colonne)
          .eq("user_id", userId)
          .in("phone_e164", elenco.slice(i, i + 100));
      let { data, error } = await leggi(
        "user_id, phone_e164, ultimo_in_entrata_il, non_scrivere_dal, ultimo_messaggio_il, ultimo_messaggio_direzione",
      );
      if (error && ["42703", "PGRST204"].includes(String(error.code ?? "")))
        ({ data, error } = await leggi("user_id, phone_e164, ultimo_in_entrata_il, non_scrivere_dal"));
      if (error) throw error;
      for (const c of (data ?? []) as Contatto[])
        perNumero.set(`${c.user_id}|${nove(c.phone_e164)}`, {
          ultimoInEntrataIl: c.ultimo_in_entrata_il,
          stop: !!c.non_scrivere_dal,
          ultimoMessaggioIl: c.ultimo_messaggio_il ?? null,
          ultimoMessaggioDirezione: c.ultimo_messaggio_direzione ?? null,
        });
    }
  }
  return perNumero;
}

/** I messaggi degli ultimi 7 giorni dei SOLI candidati, per `user_id` e numero
 *  (nove cifre): servono a sapere chi ha scritto per ultimo e a riconoscere le
 *  eco. A blocchi di numeri, a pagine. `body` serve solo al confronto in
 *  memoria: mai nei log. Il numero del cliente è il lato che non è il canale. */
const GIORNI_DI_MESSAGGI = 7;
async function messaggiDi(
  candidati: Riga[],
  adesso: Date,
): Promise<Map<string, MessaggioAttesa[]>> {
  const dal = new Date(adesso.getTime() - GIORNI_DI_MESSAGGI * 24 * 3600_000).toISOString();
  const perNumero = new Map<string, MessaggioAttesa[]>();
  const perUtente = new Map<string, Set<string>>();
  for (const r of candidati) {
    const tel = telefonoE164(r.data?.telefono);
    if (!tel) continue;
    const insieme = perUtente.get(r.user_id) ?? new Set<string>();
    insieme.add(tel);
    perUtente.set(r.user_id, insieme);
  }
  const PAGINA = 1000;
  for (const [userId, numeri] of perUtente) {
    const elenco = [...numeri];
    for (let i = 0; i < elenco.length; i += 30) {
      //  Il numero con il «+» e senza, come lo scrivono i vari canali.
      const forme = elenco.slice(i, i + 30).flatMap((n) => [n, n.replace(/\D/g, "")]);
      const lista = `(${forme.join(",")})`;
      for (let da = 0; ; da += PAGINA) {
        //  I messaggi nostri eliminati dal telefono (revoche del ponte, 31/10/2026) non sono la nostra
        //  ultima uscita: fuori già dalla lettura. Senza la migrazione la colonna non c'è (42703): si
        //  rilegge come prima, senza il filtro.
        const leggi = (conFiltro: boolean) => {
          const q = db()
            .from("whatsapp_messages")
            .select(
              conFiltro
                ? "direction, created_at, canale, duplicato_di, eliminato_il, from_number, to_number, body, status"
                : "direction, created_at, canale, duplicato_di, from_number, to_number, body, status",
            )
            .eq("user_id", userId)
            .is("duplicato_di", null);
          return (conFiltro ? q.is("eliminato_il", null) : q)
            .or(`from_number.in.${lista},to_number.in.${lista}`)
            .gte("created_at", dal)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(da, da + PAGINA - 1);
        };
        let { data, error } = await leggi(true);
        if (error && String((error as { code?: string }).code) === "42703")
          ({ data, error } = await leggi(false));
        if (error) throw error;
        const righe = (data ?? []) as MessaggioAttesa[];
        for (const m of righe) {
          const k = `${userId}|${nove(m.direction === "inbound" ? m.from_number : m.to_number)}`;
          const suoi = perNumero.get(k);
          if (suoi) suoi.push(m);
          else perNumero.set(k, [m]);
        }
        if (righe.length < PAGINA) break;
      }
    }
  }
  return perNumero;
}

export async function giroAttesaDaChiamare(adesso = new Date()) {
  const schede = await schedeInAttesa();
  if (schede.length === 0) return { inAttesa: 0, spostati: 0, cambiatiNelFrattempo: 0 };
  //  Candidati: tutte le schede in attesa con una data d'ingresso. Non si può più scartare
  //  prima a tempo (31/10/2026): la finestra delle 24 ore si chiude dall'ultimo messaggio
  //  del cliente, che si sa solo dalla rubrica e dai messaggi letti qui sotto.
  const candidati = schede.filter((r) => r.data?.stato === "attesa_whatsapp" && inAttesaDal(r.data));
  const perNumero = await contattiDi(candidati);
  const messaggi = await messaggiDi(candidati, adesso);

  let spostati = 0;
  let cambiati = 0;
  for (const r of candidati) {
    //  Un numero che non si sa scrivere nel formato delle chat non si può
    //  controllare in rubrica: meglio lasciarlo in attesa che spostarlo alla cieca.
    if (!telefonoE164(r.data?.telefono)) continue;
    const chiave = `${r.user_id}|${nove(r.data?.telefono)}`;
    const patch = patchDaChiamare(r.data, perNumero.get(chiave), adesso, messaggi.get(chiave));
    if (!patch) continue;
    const { data: scritte, error: e3 } = await db()
      .from("crm_leads")
      .update({ data: { ...r.data, ...patch }, updated_at: adesso.toISOString() })
      .eq("id", r.id)
      .eq("updated_at", r.updated_at)
      .select("id");
    if (e3) throw e3;
    if (scritte?.length) spostati++;
    else cambiati++;
  }
  return { inAttesa: schede.length, spostati, cambiatiNelFrattempo: cambiati };
}

/** Chi ha scritto nelle ultime 24 ore, per numero (`unisciEntrate`): la rubrica
 *  (ManyChat, e gli STOP anche vecchi) PIÙ le righe in entrata di
 *  `whatsapp_messages` da ogni canale (Cloud API, ponte col QR code). A pagine,
 *  in ordine fisso. */
async function contattiCheHannoScritto(adesso: Date): Promise<Map<string, ContattoWa>> {
  const dal = new Date(adesso.getTime() - 24 * 3600_000).toISOString();
  const PAGINA = 1000;
  const contatti: RigaContatto[] = [];
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db()
      .from("whatsapp_contacts")
      .select("user_id, phone_e164, ultimo_in_entrata_il, non_scrivere_dal")
      .or(`ultimo_in_entrata_il.gte.${dal},non_scrivere_dal.not.is.null`)
      .order("id", { ascending: true })
      .range(da, da + PAGINA - 1);
    if (error) throw error;
    const righe = (data ?? []) as RigaContatto[];
    contatti.push(...righe);
    if (righe.length < PAGINA) break;
  }
  const messaggi: RigaMessaggio[] = [];
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db()
      .from("whatsapp_messages")
      .select("user_id, from_number, direction, created_at, duplicato_di, canale")
      .eq("direction", "inbound")
      .is("duplicato_di", null)
      .gte("created_at", dal)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(da, da + PAGINA - 1);
    if (error) throw error;
    const righe = (data ?? []) as RigaMessaggio[];
    messaggi.push(...righe);
    if (righe.length < PAGINA) break;
  }
  //  Chi ha l'App Secret: solo i suoi messaggi Cloud API sono firmati (`rigaConta`).
  const { data: imp, error: eImp } = await db()
    .from("whatsapp_settings")
    .select("user_id, app_secret")
    .not("app_secret", "is", null);
  if (eImp) throw eImp;
  const conFirma = new Set(
    ((imp ?? []) as { user_id: string; app_secret: string | null }[])
      .filter((r) => String(r.app_secret ?? "").trim() !== "")
      .map((r) => r.user_id),
  );
  return unisciEntrate(contatti, messaggi, conFirma);
}

type RigaLeggera = {
  id: string;
  user_id: string;
  updated_at: string;
  stato: string | null;
  telefono: string | null;
  statoDal: string | null;
  statoPrecedenteIl: string | null;
};

/** Le schede dei 4 stati, in versione LEGGERA (le «Da contattare» importate sono
 *  migliaia: la scheda intera si rilegge solo per chi deve davvero tornare). */
async function schedeLeggere(): Promise<RigaLeggera[]> {
  const out: RigaLeggera[] = [];
  const PAGINA = 1000;
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db()
      .from("crm_leads")
      .select(
        "id, user_id, updated_at, stato:data->>stato, telefono:data->>telefono, statoDal:data->>statoDal, statoPrecedenteIl:data->>statoPrecedenteIl",
      )
      .in("data->>stato", [...STATI_CHE_TORNANO_IN_ATTESA])
      .order("id", { ascending: true })
      .range(da, da + PAGINA - 1);
    if (error) throw error;
    const righe = (data ?? []) as RigaLeggera[];
    out.push(...righe);
    if (righe.length < PAGINA) return out;
  }
}

/** Il ritorno: chi è in uno dei 4 stati (`STATI_CHE_TORNANO_IN_ATTESA`) e ha
 *  scritto → «Attesa WhatsApp» (regola `patchRitornoAttesa`). Stessa scrittura
 *  protetta da `updated_at`. */
export async function giroRitornoAttesa(adesso = new Date()) {
  const perNumero = await contattiCheHannoScritto(adesso);
  if (perNumero.size === 0) return { hannoScritto: 0, tornati: 0, cambiatiNelFrattempo: 0 };
  //  Prima il giudizio sulla versione leggera, poi la scheda intera dei soli candidati.
  const candidati = (await schedeLeggere()).filter((r) => {
    if (!telefonoE164(r.telefono)) return false;
    const contatto = perNumero.get(`${r.user_id}|${nove(r.telefono)}`);
    const leggera = {
      stato: r.stato,
      statoDal: r.statoDal,
      statoPrecedenteIl: r.statoPrecedenteIl,
    };
    return !!patchRitornoAttesa(leggera as Partial<LeadData>, contatto, adesso, r.updated_at);
  });
  let tornati = 0;
  let cambiati = 0;
  for (let i = 0; i < candidati.length; i += 100) {
    const { data, error } = await db()
      .from("crm_leads")
      .select("id, user_id, data, updated_at")
      .in(
        "id",
        candidati.slice(i, i + 100).map((r) => r.id),
      );
    if (error) throw error;
    for (const r of (data ?? []) as Riga[]) {
      const contatto = perNumero.get(`${r.user_id}|${nove(r.data?.telefono)}`);
      const patch = patchRitornoAttesa(r.data, contatto, adesso, r.updated_at);
      if (!patch) continue;
      const { data: scritte, error: e2 } = await db()
        .from("crm_leads")
        .update({ data: { ...r.data, ...patch }, updated_at: adesso.toISOString() })
        .eq("id", r.id)
        .eq("updated_at", r.updated_at)
        .select("id");
      if (e2) throw e2;
      if (scritte?.length) tornati++;
      else cambiati++;
    }
  }
  return { hannoScritto: perNumero.size, tornati, cambiatiNelFrattempo: cambiati };
}

type RigaRitorno = {
  id: string;
  user_id: string;
  updated_at: string;
  stato: string | null;
  statoDal: string | null;
  statoPrecedenteIl: string | null;
  ricarico: LeadData["ricarico"] | null;
  saltatoIl: string | null;
  contattoWa: LeadData["contattoWa"] | null;
  okWhatsapp: LeadData["okWhatsapp"] | null;
};

/** I ritorni rimasti nello stato di prima: si giudica sulla versione leggera
 *  (stato, date e `ricarico`, a pagine), si rilegge la scheda intera dei soli
 *  candidati e si scrive solo se `updated_at` è ancora quello letto. */
export async function giroRitorniRimastiIndietro(adesso = new Date()) {
  const candidati: string[] = [];
  const PAGINA = 1000;
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db()
      .from("crm_leads")
      .select(
        "id, user_id, updated_at, stato:data->>stato, statoDal:data->>statoDal, statoPrecedenteIl:data->>statoPrecedenteIl, ricarico:data->ricarico, saltatoIl:data->>saltatoIl, contattoWa:data->contattoWa, okWhatsapp:data->okWhatsapp",
      )
      .not("data->ricarico->>ultimo", "is", null)
      .is("data->ricarico->>inAttesaIl", null)
      .order("id", { ascending: true })
      .range(da, da + PAGINA - 1);
    if (error) throw error;
    const righe = (data ?? []) as RigaRitorno[];
    for (const r of righe) {
      const leggera = {
        stato: r.stato,
        statoDal: r.statoDal,
        statoPrecedenteIl: r.statoPrecedenteIl,
        ricarico: r.ricarico,
        saltatoIl: r.saltatoIl,
        contattoWa: r.contattoWa,
        okWhatsapp: r.okWhatsapp,
      } as Partial<LeadData>;
      if (patchRitornoRimastoIndietro(leggera, adesso)) candidati.push(r.id);
    }
    if (righe.length < PAGINA) break;
  }
  let spostati = 0;
  let cambiati = 0;
  for (let i = 0; i < candidati.length; i += 100) {
    const { data, error } = await db()
      .from("crm_leads")
      .select("id, user_id, data, updated_at")
      .in("id", candidati.slice(i, i + 100));
    if (error) throw error;
    for (const r of (data ?? []) as Riga[]) {
      const patch = patchRitornoRimastoIndietro(r.data, adesso);
      if (!patch) continue;
      const { data: scritte, error: e2 } = await db()
        .from("crm_leads")
        .update({ data: { ...r.data, ...patch }, updated_at: adesso.toISOString() })
        .eq("id", r.id)
        .eq("updated_at", r.updated_at)
        .select("id");
      if (e2) throw e2;
      if (scritte?.length) spostati++;
      else cambiati++;
    }
  }
  return { candidati: candidati.length, spostati, cambiatiNelFrattempo: cambiati };
}

export const Route = createFileRoute("/hooks/attesa-da-chiamare")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__"))
          return json({ error: "unauthorized" }, 401);
        try {
          const adesso = new Date();
          //  Prima il ritorno (chi ha scritto), poi l'andata: chi torna adesso
          //  ha `statoDal` nuovo e non riparte subito per «Da chiamare».
          //  Prima ancora, chi era già tornato ed è rimasto nello stato di allora.
          const rimasti = await giroRitorniRimastiIndietro(adesso);
          const ritorno = await giroRitornoAttesa(adesso);
          return json({ ...(await giroAttesaDaChiamare(adesso)), ritorno, rimasti });
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.error("[attesa-da-chiamare]", typeof code === "string" ? code : "errore");
          return json({ error: "giro interrotto" }, 500);
        }
      },
    },
  },
});
