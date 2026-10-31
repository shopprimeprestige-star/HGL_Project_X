/** ── LE PORTE VERE DEL GIRO «DATI PER LA FATTURA» (solo server) ─────────────
 *
 *  Le regole sono in `dati-fattura.ts` e `dati-fattura-giro.ts` (provate); qui c'è
 *  solo il collegamento a Supabase, a ManyChat, allo Storage e all'AI già in uso
 *  (OpenRouter, stessa chiave e stesso modello della lettura documenti).
 *
 *  ⚠️ PRIVACY: niente di ciò che si legge o si scarica va nei log (solo codici).
 *   Le foto vanno nel bucket PRIVATO `dati-fattura` (nessuna policy: solo chiave di
 *   servizio); il CRM le mostra con indirizzi firmati a scadenza breve, dietro
 *   `guardiaCRM` col permesso «pagamenti». Nessun invio ad altri servizi oltre all'AI.
 *  ⚠️ Il link ManyChat (`manybot-files`) si apre con un GET senza credenziali (lo apre
 *   anche il browser nella chat): lo si scarica subito, senza seguire reindirizzamenti,
 *   e SOLO se passa ancora `classificaTesto` (https, host e percorso esatti).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { leggiConfigAI } from "@/routes/api.crm.ai";
import { classificaTesto } from "@/crm/chatwa/media";
import { telefonoE164 } from "@/crm/chatwa/daChiamare";
import { inviaWhatsapp, type RichiestaInvio } from "@/crm/manychat/porta";
import type { ChiaveMessaggio } from "@/crm/messaggi-automatici/catalogo";
import { configConAcceso } from "@/crm/promemoria/pronto";
import { leggiCanale, portePortaVere } from "@/crm/manychat/porta.server";
import { entrateVereDi } from "@/crm/manychat/entrate-vere.server";
import { archivioSu, leggiAziendaSu } from "./archivio";
import { documentoAccettabile, PROMPT_DOCUMENTO } from "./lettura-documento";
import {
  mimeDaUrl,
  NOME_MODELLO_DATI_FATTURA,
  percorsoFile,
  PESO_MASSIMO_FILE,
  PROMPT_TESTO_DATI,
  type ConfigDatiFattura,
} from "./dati-fattura";
import {
  esitoRichiestaDaPorta,
  type EsitoInvioRichiesta,
  type MessaggioIn,
  type PorteDatiFattura,
  type SchedaGiro,
} from "./dati-fattura-giro";
import type { Fattura } from "./tipi";
import { scriviSchedaCondizionata, type ClienteSchede } from "./dati-fattura-scheda";

export const BUCKET_DATI_FATTURA = "dati-fattura";
export const CHIAVE_CONFIG_DATI_FATTURA = "dati_fattura_config";
const MODELLO_AI = "google/gemini-2.5-flash";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as { from: (t: string) => any; storage: any };

/** L'«acceso» del messaggio nel registro. Riga mancante, tabella assente o errore = spento
 *  (fail-closed): non parte niente finché non si sa. */
async function accesoDalRegistro(chiave: ChiaveMessaggio): Promise<boolean> {
  try {
    //  shortcut: lettura diretta della riga; quando c'è `messaggioAcceso` del registro
    //  (compito T2) si sostituisce con quello, che fa la stessa cosa.
    const { data, error } = await db()
      .from("messaggi_automatici")
      .select("acceso")
      .eq("chiave", chiave)
      .maybeSingle();
    return !error && data?.acceso === true;
  } catch {
    return false;
  }
}

/** L'«acceso» è quello del REGISTRO; del vecchio JSON restano `modelloApprovato`, `avvio` e
 *  `attivoDal`. L'`acceso` rimasto nel JSON non si rilegge mai. */
export async function leggiConfigDatiFattura(): Promise<ConfigDatiFattura> {
  const acceso = await accesoDalRegistro("dati_fattura");
  const { data } = await db()
    .from("app_config")
    .select("value")
    .eq("key", CHIAVE_CONFIG_DATI_FATTURA)
    .maybeSingle();
  try {
    const c = JSON.parse(String(data?.value ?? "{}")) as Partial<ConfigDatiFattura>;
    return configConAcceso(
      { modelloApprovato: c.modelloApprovato === true, avvio: c.avvio, attivoDal: c.attivoDal },
      acceso,
    );
  } catch {
    return configConAcceso({}, acceso);
  }
}

export async function scriviConfigDatiFattura(c: ConfigDatiFattura): Promise<void> {
  const { error } = await db()
    .from("app_config")
    .upsert(
      {
        key: CHIAVE_CONFIG_DATI_FATTURA,
        value: JSON.stringify(c),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  if (error) throw new Error(`config: ${error.code ?? ""}`);
}

async function leggiConTetto(r: Response, tetto: number): Promise<Uint8Array | null> {
  if (!r.body) return null;
  const lettore = r.body.getReader();
  const pezzi: Uint8Array[] = [];
  let tot = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    tot += value.length;
    if (tot > tetto) {
      await lettore.cancel().catch(() => undefined);
      return null;
    }
    pezzi.push(value);
  }
  const out = new Uint8Array(tot);
  let o = 0;
  for (const p of pezzi) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function inBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const CHIAVE_LUCCHETTO = "dati_fattura_lock";
/** Un giro dura pochi secondi: se muore, dopo 4 minuti il lucchetto è libero. */
const SCADENZA_LUCCHETTO_MS = 4 * 60_000;

/** ── IL LUCCHETTO: UNA RIGA IN `app_config`, PRESA CON SCRITTURA CONDIZIONATA ──
 *  · riga assente → `insert` (la chiave è primaria: il secondo che prova fallisce);
 *  · riga scaduta → `update … where value = <quello letto>` (compare-and-swap: se un altro
 *    l'ha già presa, il valore è cambiato e non si aggiorna niente);
 *  · riga viva → occupato. Si rilascia con lo stesso confronto sul proprio valore. */
export function lucchettoDatiFattura(adesso: () => Date = () => new Date()) {
  const mio = crypto.randomUUID();
  let valoreMio: string | null = null;
  return {
    async prendi(): Promise<boolean> {
      const ora = adesso();
      const nuovo = JSON.stringify({
        id: mio,
        fino: new Date(ora.getTime() + SCADENZA_LUCCHETTO_MS).toISOString(),
      });
      const { data } = await db()
        .from("app_config")
        .select("value")
        .eq("key", CHIAVE_LUCCHETTO)
        .maybeSingle();
      if (!data) {
        const { error } = await db()
          .from("app_config")
          .insert({ key: CHIAVE_LUCCHETTO, value: nuovo });
        if (error) return false;
      } else {
        let fino = 0;
        try {
          fino = Date.parse((JSON.parse(String(data.value)) as { fino?: string }).fino ?? "");
        } catch {
          fino = 0;
        }
        if (Number.isFinite(fino) && fino > ora.getTime()) return false;
        const { data: scritte, error } = await db()
          .from("app_config")
          .update({ value: nuovo })
          .eq("key", CHIAVE_LUCCHETTO)
          .eq("value", String(data.value))
          .select("key");
        if (error || !scritte?.length) return false;
      }
      valoreMio = nuovo;
      return true;
    },
    async rilascia(): Promise<void> {
      if (!valoreMio) return;
      await db()
        .from("app_config")
        .update({ value: JSON.stringify({ id: mio, fino: "1970-01-01T00:00:00.000Z" }) })
        .eq("key", CHIAVE_LUCCHETTO)
        .eq("value", valoreMio);
      valoreMio = null;
    },
  };
}

async function chiediAllAi(i: { file: string[] } | { testo: string }): Promise<string | null> {
  try {
    const cfg = await leggiConfigAI();
    if (!cfg.pronto) return null;
    const parti =
      "file" in i
        ? [
            { type: "text", text: PROMPT_DOCUMENTO },
            ...i.file.map((u, n) =>
              u.startsWith("data:application/pdf")
                ? { type: "file", file: { filename: `documento-${n + 1}.pdf`, file_data: u } }
                : { type: "image_url", image_url: { url: u } },
            ),
          ]
        : [{ type: "text", text: PROMPT_TESTO_DATI + i.testo.slice(0, 1500) }];
    const haPdf = "file" in i && i.file.some((u) => u.startsWith("data:application/pdf"));
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        "HTTP-Referer": "https://hair-genius-hub.hair",
        "X-Title": "Dati fattura",
      },
      body: JSON.stringify({
        model: MODELLO_AI,
        max_tokens: 700,
        ...(haPdf ? { plugins: [{ id: "file-parser", pdf: { engine: "native" } }] } : {}),
        messages: [{ role: "user", content: parti }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) {
      console.error("[dati-fattura] ai", r.status);
      return null;
    }
    const corpo = (await r.json()) as { choices?: { message?: { content?: unknown } }[] };
    const c = corpo.choices?.[0]?.message?.content;
    return typeof c === "string"
      ? c
      : Array.isArray(c)
        ? c.map((p) => (p as { text?: string })?.text || "").join(" ")
        : "";
  } catch {
    console.error("[dati-fattura] ai rete");
    return null;
  }
}

export function porteDatiFatturaVere(): PorteDatiFattura {
  const canali = new Map<string, Awaited<ReturnType<typeof leggiCanale>>>();
  const canaleDi = async (userId: string) => {
    let c = canali.get(userId);
    if (!c) {
      c = await leggiCanale(userId);
      canali.set(userId, c);
    }
    return c;
  };
  const archivio = archivioSu(supabaseAdmin);

  return {
    adesso: () => new Date(),
    lucchetto: lucchettoDatiFattura(),
    leggiConfig: leggiConfigDatiFattura,
    salvaConfig: scriviConfigDatiFattura,

    schedeConAcconto: async () => {
      const out: SchedaGiro[] = [];
      for (let da = 0; ; da += 1000) {
        const { data, error } = await db()
          .from("crm_leads")
          .select("id, user_id, data, updated_at")
          .not("data->payment->>accontoPagato", "is", null)
          .neq("data->payment->>accontoPagato", "0")
          .order("id", { ascending: true })
          .range(da, da + 999);
        if (error) throw error;
        for (const r of (data ?? []) as {
          id: string;
          user_id: string;
          data: SchedaGiro["data"];
          updated_at: string;
        }[])
          if (Number(r.data?.payment?.accontoPagato) > 0)
            out.push({ id: r.id, userId: r.user_id, data: r.data, updatedAt: r.updated_at });
        if ((data ?? []).length < 1000) return out;
      }
    },

    contatto: async (userId, telefono) => {
      const e164 = telefonoE164(telefono);
      if (!e164) return { ultimaEntrata: null, stop: false };
      const { data } = await db()
        .from("whatsapp_contacts")
        .select("phone_e164, ultimo_in_entrata_il, ultimo_in_entrata_anteprima, non_scrivere_dal")
        .eq("user_id", userId)
        .in("phone_e164", [e164, e164.slice(1)]);
      const righe = (data ?? []) as {
        phone_e164: string | null;
        ultimo_in_entrata_il: string | null;
        ultimo_in_entrata_anteprima: string | null;
        non_scrivere_dal: string | null;
      }[];
      //  Una reazione non riapre la finestra: l'entrata torna all'ultimo messaggio vero.
      const ultime = (await entrateVereDi(userId, righe))
        .map((r) => r.ultimo_in_entrata_il)
        .filter(Boolean)
        .sort() as string[];
      return {
        ultimaEntrata: ultime.at(-1) ?? null,
        stop: righe.some((r) => !!r.non_scrivere_dal),
      };
    },

    modelloPronto: async (userId, config) => {
      const c = await canaleDi(userId);
      return c.canale === "manychat"
        ? !!c.flussi[NOME_MODELLO_DATI_FATTURA]
        : config.modelloApprovato === true;
    },

    invia: async (i): Promise<EsitoInvioRichiesta> => {
      const c = await canaleDi(i.userId);
      //  Solo ManyChat: col canale Cloud API questo giro non ha le chiavi, e non indovina.
      if (c.canale !== "manychat") return "errore";
      //  Il messaggio dichiara la sua chiave (registro dei messaggi automatici). Il tipo con
      //  `messaggio` esplicito vale anche prima che `RichiestaInvio` lo conosca (compito T3).
      const richiesta: RichiestaInvio & { messaggio: ChiaveMessaggio } = {
        canale: "manychat",
        a: telefonoE164(i.telefono) || i.telefono,
        modello: NOME_MODELLO_DATI_FATTURA,
        lingua: "it",
        parametri: [i.nomePerModello],
        nome: i.nome,
        leadId: i.leadId,
        //  «chat»: l'unico tipo del registro che non è una conferma o una sequenza (niente nuovo CHECK).
        tipo: "chat",
        messaggio: "dati_fattura",
        chiave: i.chiave,
        //  Senza il flusso del modello, MAI come modello: o testo nelle 24 ore o niente.
        soloTesto: i.come === "testo" && !c.flussi[NOME_MODELLO_DATI_FATTURA],
      };
      const r = await inviaWhatsapp(portePortaVere(i.userId, { flussi: c.flussi }), richiesta);
      return esitoRichiestaDaPorta(r.esito);
    },

    scriviScheda: (s, d) => scriviSchedaCondizionata(db() as unknown as ClienteSchede, s, d),

    messaggiIn: async (userId, leadId, dal): Promise<MessaggioIn[]> => {
      const { data, error } = await db()
        .from("whatsapp_messages")
        .select("wa_message_id, body, canale, created_at")
        .eq("user_id", userId)
        .eq("lead_id", leadId)
        .eq("direction", "inbound")
        .is("duplicato_di", null)
        .gte("created_at", dal)
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (
        (data ?? []) as {
          wa_message_id: string | null;
          body: string | null;
          canale: string | null;
          created_at: string;
        }[]
      )
        .filter((m) => m.wa_message_id)
        .map((m) => ({
          id: String(m.wa_message_id),
          body: String(m.body ?? ""),
          canale: m.canale,
          creatoIl: m.created_at,
        }));
    },

    scaricaESalva: async (userId, leadId, url) => {
      try {
        //  Solo i link che la chat riconosce come media ManyChat (nessun altro indirizzo).
        const k = classificaTesto(url);
        if (!k.url || k.url !== url || (k.tipo !== "immagine" && k.tipo !== "documento"))
          return null;
        const mime = mimeDaUrl(url);
        if (!mime) return null;
        const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
        if (!r.ok) return null;
        const dichiarato = Number(r.headers.get("content-length") ?? 0);
        if (dichiarato > PESO_MASSIMO_FILE) return null;
        //  La dimensione si controlla MENTRE si scarica: oltre il tetto si smette di leggere.
        const bytes = await leggiConTetto(r, PESO_MASSIMO_FILE);
        if (!bytes || bytes.length < 2048) return null;
        const dataUrl = `data:${mime};base64,${inBase64(bytes)}`;
        if (!documentoAccettabile(dataUrl).ok) return null;
        const casuale = crypto.randomUUID().replace(/-/g, "");
        const percorso = percorsoFile(userId, leadId, casuale, mime);
        const { error } = await db()
          .storage.from(BUCKET_DATI_FATTURA)
          .upload(percorso, bytes, { contentType: mime, upsert: false });
        if (error) return null;
        return { percorso, dataUrl };
      } catch {
        return null;
      }
    },

    leggi: chiediAllAi,

    giaEmessa: async (leadId) => {
      const emesse = await archivio.leggiPrefisso("fattura:");
      return emesse.some((e) => {
        try {
          return (JSON.parse(e.value) as Fattura).leadId === leadId;
        } catch {
          return false;
        }
      });
    },

    aliquota: async () => (await leggiAziendaSu(archivio)).aliquotaPredefinita,

    leggiBozza: async (leadId) => {
      const v = await archivio.leggi(`fattura_bozza:${leadId}`);
      if (!v) return null;
      try {
        const f = JSON.parse(v) as Fattura;
        return f?.stato === "bozza" ? f : null;
      } catch {
        return null;
      }
    },
    scriviBozza: (f) => archivio.scrivi(`fattura_bozza:${f.leadId}`, JSON.stringify(f)),
  };
}
