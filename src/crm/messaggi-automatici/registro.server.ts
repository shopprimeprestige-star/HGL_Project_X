/** ── IL REGISTRO DEI MESSAGGI AUTOMATICI (solo server) ─────────────────────
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T2. Qui c'è l'I/O con Supabase
 *  (chiave di servizio) per la tabella `messaggi_automatici` e il suo log:
 *   · `messaggioAcceso(chiave)`: UNA lettura, nessuna scrittura. Falso se la chiave non è
 *     nel catalogo, se la riga manca, se la voce è bloccata dal codice, se il database sbaglia;
 *   · `leggiRegistro()` / `registroTutto()`: le righe (e le ultime modifiche) per l'adattatore,
 *     per il giro e per il pannello. `null` = illeggibile (chi legge spegne tutto);
 *   · `rispostaMessaggi()`: quello che vede il pannello (GET della rotta);
 *   · `imposta(comando, chi)`: l'UNICO scrittore. Ordine: voce nel catalogo e non bloccata →
 *     regole prima di accendere (data della frase del modulo, indirizzo della sede) →
 *     `messaggio_automatico_imposta` (compare-and-set + riga di log nella STESSA transazione:
 *     perso = 409) → per conferma e fattura, da spento ad acceso, `avvio: "da_fare"` nel loro
 *     JSON (se questo passo fallisce, il registro si rimette com'era). Mai uno stato a metà.
 *
 *  ⚠️ NON importa `pannello.server`, `porte.server` né `porta.server`: sono loro (compito T4,
 *   T3) a importare questo file, un giro di import lo romperebbe. La riga di `manychat_config`
 *   si legge qui da sé (pochi righe).
 *  ⚠️ Chi legge o scrive lancia `{ code }` se il database dice di no; nei log il solo codice,
 *   mai il messaggio d'errore (può contenere dati del cliente), mai un numero.
 *  ⚠️ Il nome di chi clicca lo dà il server (`g.chi.nome`), mai il browser. Il log
 *   (`messaggi_automatici_registro`) è l'unica memoria di chi e quando.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { controllaComando, type RigaConfig } from "../manychat/pannello";
import { CATALOGO, FAMIGLIA_LEAD_NUOVO, eChiaveMessaggio, type ChiaveMessaggio } from "./catalogo";
import type {
  ComandoImposta,
  FasciaMessaggi,
  ModificaRegistro,
  RigaRegistro,
  RispostaMessaggi,
  VoceMessaggio,
} from "./tipi";

type ErroreDb = { code?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  order(c: string, o: { ascending: boolean }): Filtro<T>;
  limit(n: number): Filtro<T>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}
/** I tipi generati non conoscono le tabelle e la funzione nuove. */
const db = () =>
  supabaseAdmin as unknown as {
    from(t: string): {
      select<T = Record<string, unknown>[]>(c: string): Filtro<T>;
      upsert(v: Record<string, unknown>, o: { onConflict: string }): Esito<unknown>;
    };
    rpc(fn: string, a: Record<string, unknown>): Esito<unknown>;
  };

const lancia = (e: NonNullable<ErroreDb>): never => {
  throw { code: e.code ?? "?" };
};
/** La tabella (o la cache dello schema) non ha ancora la migrazione. */
const tabellaMancante = (e: NonNullable<ErroreDb>) =>
  ["42P01", "PGRST205"].includes(String(e.code ?? ""));
/** La funzione SQL non c'è ancora. */
const funzioneMancante = (e: NonNullable<ErroreDb>) =>
  ["42883", "PGRST202"].includes(String(e.code ?? ""));
/** L'errore lanciato da `cambiaRegistro` dice che manca la funzione o la tabella (migrazione non applicata)? */
const funzioneOTabellaMancante = (e: unknown) => {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" && (funzioneMancante({ code }) || tabellaMancante({ code }));
};
/** Nei log solo il codice. */
const avvisa = (dove: string, e: unknown) => {
  const code = (e as { code?: unknown } | null)?.code;
  console.warn("[messaggi-automatici]", dove, typeof code === "string" ? code : "errore");
};

const T_REGISTRO = "messaggi_automatici";
const T_LOG = "messaggi_automatici_registro";
/** shortcut: si leggono le ultime 500 righe del log per dire «Spento da Filippo, 31/10 14:02» a ogni voce;
 *  finché si tocca poco bastano. Se una chiave non compare, risulta «mai toccata». Alzare, o chiedere per
 *  chiave, se il log cresce molto. */
const RIGHE_DI_LOG = 500;
const ULTIME_MODIFICHE = 20;

/** Le chiavi dei JSON di `app_config` che leggono il giro della conferma e quello della fattura. */
export const CHIAVE_JSON_CONFERMA = "promemoria_whatsapp";
export const CHIAVE_JSON_FATTURA = "dati_fattura_config";

const FRASE_PERSO = "Nel frattempo è cambiato: ricarica";
const FRASE_BLOCCATA = "Spento nel codice";
const FRASE_MIGRAZIONE = "Manca l'aggiornamento del database: i messaggi non si possono salvare.";
const FRASE_GUASTO = "Non salvato: il database non ha risposto.";
const FRASE_SENZA_SEDE = "Scrivi prima l'indirizzo della sede (Impostazioni → WhatsApp).";

const VOCI = new Map(CATALOGO.map((v) => [v.chiave as string, v]));

/* ═══════════════════════════════════════════════════════════════════════════
   LETTURE
   ═════════════════════════════════════════════════════════════════════════ */

/** Il messaggio parte? Una lettura sola, nessuna scrittura. Falso per ogni dubbio. */
export async function messaggioAcceso(chiave: unknown): Promise<boolean> {
  if (!eChiaveMessaggio(chiave) || VOCI.get(chiave)?.bloccataDalCodice) return false;
  try {
    const { data, error } = await db()
      .from(T_REGISTRO)
      .select<{ acceso?: unknown }[]>("acceso")
      .eq("chiave", chiave)
      .maybeSingle();
    if (error) {
      avvisa("lettura", error);
      return false;
    }
    return (data as { acceso?: unknown } | null)?.acceso === true;
  } catch (e) {
    avvisa("lettura", e);
    return false;
  }
}

/** Le righe del registro, o `null` se non si leggono (chi chiama spegne tutto); `manca` = la tabella non
 *  c'è ancora; `codice` = il codice dell'errore, per chi vuole lanciarlo. */
async function leggiRegistroDettaglio(): Promise<{
  righe: RigaRegistro[] | null;
  manca: boolean;
  codice: string;
}> {
  try {
    const { data, error } = await db()
      .from(T_REGISTRO)
      .select<RigaRegistro[]>("chiave, acceso, acceso_dal");
    if (error) {
      avvisa("registro", error);
      return { righe: null, manca: tabellaMancante(error), codice: String(error.code ?? "?") };
    }
    return { righe: data ?? [], manca: false, codice: "" };
  } catch (e) {
    avvisa("registro", e);
    return { righe: null, manca: false, codice: "rete" };
  }
}

/** Le righe del registro per l'adattatore: `null` = illeggibile (fail-closed). */
export async function leggiRegistro(): Promise<RigaRegistro[] | null> {
  return (await leggiRegistroDettaglio()).righe;
}

/** Il registro intero con il suo log: per il giro, l'adattatore e il pannello. */
export async function registroTutto(): Promise<{
  righe: RigaRegistro[] | null;
  /** le ultime 20 righe del log, dalla più recente */
  ultime: ModificaRegistro[];
  mancaMigrazione: boolean;
}> {
  const { righe, manca } = await leggiRegistroDettaglio();
  if (!righe) return { righe: null, ultime: [], mancaMigrazione: manca };
  const { ultime } = await leggiLog();
  return { righe, ultime: ultime.slice(0, ULTIME_MODIFICHE), mancaMigrazione: false };
}

async function leggiLog(): Promise<{ ultime: ModificaRegistro[] }> {
  const { data, error } = await db()
    .from(T_LOG)
    .select<ModificaRegistro[]>("chiave, prima, dopo, da, il")
    .order("il", { ascending: false })
    .limit(RIGHE_DI_LOG);
  if (error) {
    // Un log che non si legge non ferma il pannello: le voci restano senza «da chi».
    avvisa("log", error);
    return { ultime: [] };
  }
  return { ultime: data ?? [] };
}

/** La riga di `manychat_config` (generale, canale, fermo, indirizzo, data della frase). */
async function leggiRigaConfig(): Promise<RigaConfig | null> {
  const { data, error } = await db()
    .from("manychat_config")
    .select<RigaConfig[]>("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (tabellaMancante(error)) return null;
    return lancia(error);
  }
  return (data as RigaConfig | null) ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LE REGOLE PRIMA DI ACCENDERE
   ═════════════════════════════════════════════════════════════════════════ */

/** Perché ADESSO questo messaggio non si può accendere, o `null`. Le stesse regole che c'erano nel
 *  riquadro vecchio: la data della frase del modulo per i quattro «lead nuovo»; in più l'indirizzo
 *  della sede per «Appuntamento in sede». */
function impedimentoDi(
  chiave: ChiaveMessaggio,
  riga: RigaConfig | null,
  adesso: Date,
): { stato: number; errore: string } | null {
  if (VOCI.get(chiave)?.bloccataDalCodice)
    return {
      stato: 409,
      errore: `${FRASE_BLOCCATA}: non si accende da qui.`,
    };
  if ((FAMIGLIA_LEAD_NUOVO as readonly string[]).includes(chiave)) {
    // Si passa una riga con il solo `controlli`: `lead_nuovo` del vecchio interruttore (congelato)
    // non deve far credere che sia «già acceso». `controllaComando` decide, non scrive.
    const rifiuto = controllaComando(
      { controlli: riga?.controlli },
      { tipo: "interruttori", valori: { leadNuovo: true } },
      adesso,
      true,
    );
    if (rifiuto) return rifiuto;
  }
  if (chiave === "stato:viene_in_sede" && !riga?.indirizzo_sede?.trim())
    return { stato: 422, errore: FRASE_SENZA_SEDE };
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA RISPOSTA DEL PANNELLO (GET)
   ═════════════════════════════════════════════════════════════════════════ */

/** Lo stato dei 25 messaggi, la fascia e le ultime modifiche. Lancia `{ code }` se il database
 *  sbaglia per un guasto vero (la rotta risponde 500); la migrazione mancante NON è un guasto:
 *  `mancaMigrazione` e tutto spento. */
export async function rispostaMessaggi(adesso = new Date()): Promise<RispostaMessaggi> {
  const riga = await leggiRigaConfig();
  const { righe, manca, codice } = await leggiRegistroDettaglio();
  if (!righe && !manca) throw { code: codice };

  const fascia: FasciaMessaggi = {
    generale: riga?.acceso === true,
    canale: riga?.canale === "manychat" ? "manychat" : "cloud",
    fermatoMotivo: riga?.fermato_motivo ?? null,
  };

  if (!righe)
    return {
      voci: CATALOGO.map((v) => ({
        chiave: v.chiave,
        acceso: false,
        accesoDal: null,
        ultima: null,
        impedimento: FRASE_MIGRAZIONE,
      })),
      fascia,
      ultime: [],
      mancaMigrazione: true,
    };

  const { ultime } = await leggiLog();
  const perChiave = new Map(righe.map((r) => [r.chiave, r]));
  // Il log è dalla più recente: la prima riga di ogni chiave è l'ultima modifica.
  const ultimaDi = new Map<string, ModificaRegistro>();
  for (const m of ultime) if (!ultimaDi.has(m.chiave)) ultimaDi.set(m.chiave, m);

  const voci: VoceMessaggio[] = CATALOGO.map((v) => {
    const r = perChiave.get(v.chiave);
    const acceso = r?.acceso === true && !v.bloccataDalCodice;
    const u = ultimaDi.get(v.chiave);
    return {
      chiave: v.chiave,
      acceso,
      accesoDal: r?.acceso_dal ?? null,
      ultima: u ? { da: u.da, il: u.il, dopo: u.dopo } : null,
      // Chi è acceso non ha impedimenti: l'impedimento riguarda solo l'accensione.
      impedimento: acceso ? null : (impedimentoDi(v.chiave, riga, adesso)?.errore ?? null),
    };
  });
  return { voci, fascia, ultime: ultime.slice(0, ULTIME_MODIFICHE) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   LO SCRITTORE UNICO
   ═════════════════════════════════════════════════════════════════════════ */

export type LettoComandoImposta =
  | { ok: true; comando: ComandoImposta }
  | { ok: false; errore: string };

/** Il corpo del POST: solo `chiave`, `acceso`, `prima`. Il resto (un «da», un nome) si butta. */
export function leggiComandoImposta(corpo: unknown): LettoComandoImposta {
  const b = (corpo && typeof corpo === "object" && !Array.isArray(corpo) ? corpo : null) as Record<
    string,
    unknown
  > | null;
  if (!b) return { ok: false, errore: "Richiesta non valida." };
  if (!eChiaveMessaggio(b.chiave)) return { ok: false, errore: "Messaggio sconosciuto." };
  if (typeof b.acceso !== "boolean" || typeof b.prima !== "boolean")
    return { ok: false, errore: "Servono «acceso» e «prima», veri o falsi." };
  if (b.acceso === b.prima) return { ok: false, errore: "Non c'è niente da cambiare." };
  return { ok: true, comando: { chiave: b.chiave, acceso: b.acceso, prima: b.prima } };
}

export type EsitoImposta =
  | { ok: true; risposta: RispostaMessaggi }
  | { ok: false; stato: number; errore: string };

const no = (stato: number, errore: string): EsitoImposta => ({ ok: false, stato, errore });

/** La funzione SQL: `true` = fatto e registrato; `false` = nel frattempo è cambiato. */
async function cambiaRegistro(
  chiave: string,
  prima: boolean,
  dopo: boolean,
  chi: string,
): Promise<boolean> {
  const { data, error } = await db().rpc("messaggio_automatico_imposta", {
    p_chiave: chiave,
    p_prima: prima,
    p_dopo: dopo,
    p_da: chi.slice(0, 80),
  });
  if (error) return lancia(error);
  return data === true;
}

/** Da spento ad acceso, la conferma e la fattura segnano `avvio: "da_fare"` nel loro JSON: chi ha
 *  già un appuntamento o un acconto non riceve niente (come faceva il vecchio riquadro).
 *  shortcut: c'è una finestra di millisecondi fra il registro acceso e questo JSON in cui un giro
 *  potrebbe vedere il vecchio `avvio`; il giro è ogni 2-5 minuti. Scrivere il JSON PRIMA la
 *  chiuderebbe, ma lascerebbe `da_fare` anche quando il compare-and-set perde. */
async function segnaAvvio(chiave: ChiaveMessaggio, adesso: Date): Promise<void> {
  const conferma = chiave === "conferma_consulenza";
  const k = conferma ? CHIAVE_JSON_CONFERMA : CHIAVE_JSON_FATTURA;
  const letto = await db()
    .from("app_config")
    .select<{ value?: string | null }[]>("value")
    .eq("key", k)
    .maybeSingle();
  if (letto.error) lancia(letto.error);
  let prima: Record<string, unknown> = {};
  try {
    const j: unknown = JSON.parse(String((letto.data as { value?: string } | null)?.value ?? "{}"));
    if (j && typeof j === "object" && !Array.isArray(j)) prima = j as Record<string, unknown>;
  } catch {
    // un JSON storto vale come assente
  }
  const dopo = {
    ...prima,
    acceso: true,
    // La conferma ricorda da quando è accesa; per la fattura la data la scrive il giro, come prima.
    ...(conferma ? { attivoDal: adesso.toISOString() } : {}),
    avvio: "da_fare",
  };
  const { error } = await db()
    .from("app_config")
    .upsert(
      { key: k, value: JSON.stringify(dopo), updated_at: adesso.toISOString() },
      { onConflict: "key" },
    );
  if (error) lancia(error);
}

/** Accende o spegne UN messaggio. Mai lancia: ogni guasto è una risposta con la sua frase. */
export async function imposta(
  comando: ComandoImposta,
  chi: string,
  adesso = new Date(),
): Promise<EsitoImposta> {
  const { chiave, acceso, prima } = comando;
  if (!eChiaveMessaggio(chiave)) return no(400, "Messaggio sconosciuto.");
  if (VOCI.get(chiave)?.bloccataDalCodice) return no(409, FRASE_BLOCCATA);

  if (acceso) {
    let riga: RigaConfig | null;
    try {
      riga = await leggiRigaConfig();
    } catch (e) {
      avvisa("config", e);
      return no(500, FRASE_GUASTO);
    }
    const impedito = impedimentoDi(chiave, riga, adesso);
    if (impedito) return no(impedito.stato, impedito.errore);
  }

  try {
    if (!(await cambiaRegistro(chiave, prima, acceso, chi))) return no(409, FRASE_PERSO);
  } catch (e) {
    avvisa("imposta", e);
    return funzioneOTabellaMancante(e) ? no(503, FRASE_MIGRAZIONE) : no(500, FRASE_GUASTO);
  }

  if (acceso && (chiave === "conferma_consulenza" || chiave === "dati_fattura")) {
    try {
      await segnaAvvio(chiave, adesso);
    } catch (e) {
      avvisa("avvio", e);
      // Mai uno stato a metà: si rimette il registro com'era (un secondo compare-and-set, con il suo log).
      try {
        await cambiaRegistro(chiave, true, false, chi);
      } catch (e2) {
        avvisa("compensa", e2);
      }
      return no(500, FRASE_GUASTO);
    }
  }

  try {
    return { ok: true, risposta: await rispostaMessaggi(adesso) };
  } catch (e) {
    // Scritto, ma la rilettura è fallita: chi clicca ricarica.
    avvisa("rilettura", e);
    return no(500, "Salvato, ma non si riesce a rileggere: ricarica la pagina.");
  }
}
