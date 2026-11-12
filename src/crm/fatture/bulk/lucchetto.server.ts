/** ── FATTURE BULK · LUCCHETTI CON SCADENZA (lucchetto.server.ts) ───────────
 *  Tre usi dello stesso schema, con chiave e durata diverse (PIANO D14):
 *    · il lucchetto di emissione globale (`bulk_fatture_lock`, 60 s);
 *    · il reclamo di lettura di un gruppo (`bulk_fatture_c:<lotto>:<gruppo>`, 90 s);
 *    · l'emittente del lotto (`bulk_fatture_e:<lotto>`, 2 minuti, rinnovato a ogni riga).
 *
 *  Lo schema è quello di `lucchettoDatiFattura` (dati-fattura.server.ts), che non si tocca:
 *   · chiave assente → inserimento che FALLISCE se esiste (chi arriva secondo perde);
 *   · chiave scaduta (o illeggibile) → compare-and-swap: si sostituisce solo se il valore è
 *     ancora quello letto, quindi fra due che la riprendono insieme ne vince uno;
 *   · chiave viva di un altro → occupato, con i millisecondi che mancano alla scadenza.
 *  Si rilascia con lo stesso confronto: se nel frattempo l'ha presa un altro, non si toglie niente.
 *
 *  ⚠️ Le operazioni sul database sono una PORTA iniettata: così si prova con un finto in memoria
 *   e il resto non sa niente di Supabase. `portaLucchettoSu` è la porta vera.
 *  ⚠️ `adesso` è sempre passato da chi chiama (millisecondi): niente `Date.now()` qui dentro. */

/** Le sole operazioni che servono, iniettate: si prova con un finto in memoria. */
export interface PortaLucchetto {
  /** Scrive solo se la chiave non esiste. true = scritta. */
  creaSeAssente: (key: string, value: string) => Promise<boolean>;
  leggi: (key: string) => Promise<string | null>;
  /** Compare-and-swap: sostituisce solo se il valore è ancora `atteso`. true = sostituita. */
  sostituisciSe: (key: string, atteso: string, nuovo: string) => Promise<boolean>;
  /** Cancella solo se il valore è ancora `atteso`. */
  eliminaSe: (key: string, atteso: string) => Promise<boolean>;
}

export type EsitoPresa = { ok: true } | { ok: false; scadeFraMs: number };

/** Cosa c'è scritto nella chiave. `ultimo` serve solo all'emittente: l'ultimo numero emesso da
 *  QUESTA esecuzione, per «anno/serie» (D14): è il «precedente» del controllo precedente + 1. */
interface Contenuto {
  id: string;
  fino: number;
  ultimo?: Record<string, number>;
}

function leggiContenuto(grezzo: string | null): Contenuto | null {
  if (grezzo === null) return null;
  try {
    const v = JSON.parse(grezzo) as { id?: unknown; fino?: unknown; ultimo?: unknown };
    const fino = Date.parse(String(v.fino ?? ""));
    if (typeof v.id !== "string" || !Number.isFinite(fino)) return null;
    const ultimo =
      v.ultimo && typeof v.ultimo === "object" ? (v.ultimo as Record<string, number>) : undefined;
    return { id: v.id, fino, ultimo };
  } catch {
    //  Illeggibile = come scaduto: meglio riprendere un lucchetto rotto che restare fermi per sempre.
    return null;
  }
}

const scrivi = (id: string, adesso: number, durataMs: number, ultimo?: Record<string, number>) =>
  JSON.stringify({
    id,
    fino: new Date(adesso + durataMs).toISOString(),
    ...(ultimo ? { ultimo } : {}),
  });

/** Quanto manca alla scadenza di quello che c'è adesso (0 se non c'è più o è scaduto). */
async function residuo(porta: PortaLucchetto, chiave: string, adesso: number): Promise<number> {
  const c = leggiContenuto(await porta.leggi(chiave));
  return c ? Math.max(0, c.fino - adesso) : 0;
}

export async function prendi(
  porta: PortaLucchetto,
  chiave: string,
  proprietario: string,
  durataMs: number,
  adesso: number,
): Promise<EsitoPresa> {
  const letto = await porta.leggi(chiave);
  if (letto === null) {
    if (await porta.creaSeAssente(chiave, scrivi(proprietario, adesso, durataMs)))
      return { ok: true };
    return { ok: false, scadeFraMs: await residuo(porta, chiave, adesso) };
  }
  const c = leggiContenuto(letto);
  if (c && c.fino > adesso) {
    //  Vivo e mio = lo stesso emittente che torna: si rinnova (e il «precedente» resta).
    if (c.id === proprietario) return rinnova(porta, chiave, proprietario, durataMs, adesso);
    return { ok: false, scadeFraMs: c.fino - adesso };
  }
  //  Scaduto o illeggibile: si riprende col confronto sul valore letto. Il «precedente» NON si porta dietro.
  if (await porta.sostituisciSe(chiave, letto, scrivi(proprietario, adesso, durataMs)))
    return { ok: true };
  return { ok: false, scadeFraMs: await residuo(porta, chiave, adesso) };
}

/** Rinnova la scadenza solo se il proprietario è lo stesso. Se si passa `ultimo`, registra anche
 *  l'ultimo numero emesso per quell'anno/serie (si rinnova a ogni riga, quindi si scrive una volta sola). */
export async function rinnova(
  porta: PortaLucchetto,
  chiave: string,
  proprietario: string,
  durataMs: number,
  adesso: number,
  ultimo?: { anno: number; serie: string; numero: number },
): Promise<EsitoPresa> {
  const letto = await porta.leggi(chiave);
  const c = leggiContenuto(letto);
  if (letto === null || !c || c.id !== proprietario)
    return { ok: false, scadeFraMs: c ? Math.max(0, c.fino - adesso) : 0 };
  const nuovoUltimo = ultimo
    ? { ...c.ultimo, [`${ultimo.anno}/${ultimo.serie}`]: ultimo.numero }
    : c.ultimo;
  if (await porta.sostituisciSe(chiave, letto, scrivi(proprietario, adesso, durataMs, nuovoUltimo)))
    return { ok: true };
  return { ok: false, scadeFraMs: await residuo(porta, chiave, adesso) };
}

/** Rilascia solo il proprio: se nel frattempo l'ha preso un altro, non toglie niente. */
export async function rilascia(
  porta: PortaLucchetto,
  chiave: string,
  proprietario: string,
): Promise<void> {
  const letto = await porta.leggi(chiave);
  if (letto !== null && leggiContenuto(letto)?.id === proprietario)
    await porta.eliminaSe(chiave, letto);
}

/** Il «precedente» dell'emittente: l'ultimo numero che QUESTA esecuzione ha emesso per anno/serie,
 *  oppure null (non c'è, o la chiave è di un altro: dopo «Prendi il controllo» si riparte da zero). */
export async function leggiPrecedente(
  porta: PortaLucchetto,
  chiave: string,
  proprietario: string,
  anno: number,
  serie: string,
): Promise<number | null> {
  const c = leggiContenuto(await porta.leggi(chiave));
  if (!c || c.id !== proprietario) return null;
  const n = c.ultimo?.[`${anno}/${serie}`];
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** «Prendi il controllo»: si prende anche se è vivo di un altro e azzera il «precedente» (D14).
 *  Torna false se non ci riesce (qualcuno l'ha cambiato nel frattempo, anche dopo 3 giri). */
export async function prendiIlControllo(
  porta: PortaLucchetto,
  chiave: string,
  proprietario: string,
  durataMs: number,
  adesso: number,
): Promise<boolean> {
  const nuovo = scrivi(proprietario, adesso, durataMs);
  for (let giro = 0; giro < 3; giro++) {
    const letto = await porta.leggi(chiave);
    if (
      letto === null
        ? await porta.creaSeAssente(chiave, nuovo)
        : await porta.sostituisciSe(chiave, letto, nuovo)
    )
      return true;
  }
  return false;
}

/** ── LA PORTA VERA, SOPRA UN CLIENT SUPABASE ───────────────────────────────
 *  Il cast è il solito (i tipi generati non conoscono `app_config`), confinato qui.
 *  Un errore diverso da «chiave già presente» si rilancia: non deve passare per «occupato». */
type Esito = { error: { message: string; code?: string } | null };
interface ClienteLucchetto {
  from: (t: string) => {
    select: (s: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { value?: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
    insert: (v: { key: string; value: string }) => Promise<Esito>;
    update: (v: { value: string }) => {
      eq: (
        k: string,
        v: string,
      ) => {
        eq: (
          k: string,
          v: string,
        ) => { select: (s: string) => Promise<Esito & { data: unknown[] | null }> };
      };
    };
    delete: () => {
      eq: (
        k: string,
        v: string,
      ) => {
        eq: (
          k: string,
          v: string,
        ) => { select: (s: string) => Promise<Esito & { data: unknown[] | null }> };
      };
    };
  };
}

export function portaLucchettoSu(client: unknown): PortaLucchetto {
  const c = client as ClienteLucchetto;
  const t = () => c.from("app_config");
  return {
    leggi: async (key) => {
      const { data, error } = await t().select("value").eq("key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.value ?? null;
    },
    creaSeAssente: async (key, value) => {
      const { error } = await t().insert({ key, value });
      if (!error) return true;
      if (error.code === "23505" || /duplicate key/i.test(error.message)) return false;
      throw new Error(error.message);
    },
    sostituisciSe: async (key, atteso, nuovo) => {
      const { data, error } = await t()
        .update({ value: nuovo })
        .eq("key", key)
        .eq("value", atteso)
        .select("key");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    eliminaSe: async (key, atteso) => {
      const { data, error } = await t().delete().eq("key", key).eq("value", atteso).select("key");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
  };
}
