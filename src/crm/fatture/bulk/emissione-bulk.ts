/** ── FATTURE BULK · EMISSIONE SICURA (emissione-bulk.ts) ───────────────────
 *  La parte che dà i NUMERI alle fatture del bulk. Porte iniettate (l'archivio), così si prova con
 *  un archivio finto in memoria; `archivioProtettoSu` è quello vero, sopra un client Supabase.
 *
 *  ⚠️ NIENTE QUI SOSTITUISCE `emettiSu`: lo riusa. La numerazione (`prossimoNumeroSu`), la scrittura
 *   che non sovrascrive e la ripetizione col numero successivo stanno in archivio.ts (T6), una volta
 *   sola. Questo file aggiunge: la lettura paginata per chiave, il divieto di toccare le bozze, la
 *   rilettura dopo la scrittura, il controllo «precedente + 1» e le regole sull'ordine delle date. */
import { archivioSu, chiaveEmessa, emettiSu, type ArchivioDb, type EsitoCrea } from "../archivio";
import type { DatiAzienda, Fattura } from "../tipi";
import { GIORNI_TERMINE_SDI, RIMUOVI_A_GRUPPI } from "./chiavi";
import { ultimoGiornoUtile } from "./da-importo-a-fattura";
import type { FattiSulleDate, Gravita, Motivo } from "./tipi";

/** ⚠️ UNA SOLA COSTANTE per la gravità della data anteriore all'ultima emessa (D1): se il
 *  commercialista la vuole bloccante, si cambia questa riga e basta. */
export const GRAVITA_DATA_ANTERIORE: Gravita = "conferma";

/* ═══════════════════════════════════════════════════════════════════════════
   1. L'ARCHIVIO PROTETTO
   ═════════════════════════════════════════════════════════════════════════ */

/** `archivioSu` più: inserimento che non sovrascrive (obbligatorio, qui), lettura per chiave
 *  paginata (`gt key`, `limit 1000`), `leggiMolte(keys)`, `eliminaPerPrefisso` in una chiamata sola
 *  (con la stessa protezione di «_» di `leggiPrefisso`). */
export interface ArchivioProtetto extends ArchivioDb {
  creaSeAssente: (key: string, value: string) => Promise<EsitoCrea>;
  /** Tutte le righe col prefisso, a pagine di 1000 per CHIAVE (mai per offset). Rilancia se una pagina fallisce. */
  leggiPrefissoPerChiave: (prefisso: string) => Promise<{ key: string; value: string }[]>;
  leggiMolte: (chiavi: string[]) => Promise<{ key: string; value: string }[]>;
  /** Una sola cancellazione per tutto il prefisso. Torna il messaggio d'errore, o null. */
  eliminaPerPrefisso: (prefisso: string) => Promise<string | null>;
}

/** Pagina di PostgREST (tetto di righe per risposta). ⚠️ Si suppone che sia 1000 come in tutto il
 *  repo: la prova sul database vero (T15) lo verifica leggendo 1.200 righe. */
const PAGINA = 1000;
/** `eliminaPerPrefisso` tocca solo le chiavi del bulk: mai `fattura:*`, mai un prefisso vuoto. */
const PREFISSO_BULK = "bulk_fatture_";

interface Pagina {
  data: { key: string; value?: string }[] | null;
  error: { message: string } | null;
}
interface QueryPaginata extends PromiseLike<Pagina> {
  gt: (k: string, v: string) => QueryPaginata;
  order: (k: string, o: { ascending: boolean }) => QueryPaginata;
  limit: (n: number) => QueryPaginata;
}
interface ClienteConfig {
  from: (t: string) => {
    select: (s: string) => {
      like: (k: string, v: string) => QueryPaginata;
      in: (k: string, v: string[]) => PromiseLike<Pagina>;
    };
    delete: () => {
      like: (k: string, v: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

const proteggiLike = (p: string) => p.replace(/[\\%_]/g, (ch) => `\\${ch}`);

export function archivioProtettoSu(client: unknown): ArchivioProtetto {
  const c = client as ClienteConfig;
  const base = archivioSu(client);
  const comeRighe = (d: Pagina["data"]) =>
    (d ?? []).map((r) => ({ key: r.key, value: String(r.value ?? "") }));

  const leggiPerChiave = async (prefisso: string) => {
    const come = `${proteggiLike(prefisso)}%`;
    const tutte: { key: string; value: string }[] = [];
    let ultima = "";
    for (;;) {
      let q = c.from("app_config").select("key,value").like("key", come);
      if (ultima) q = q.gt("key", ultima);
      const { data, error } = await q.order("key", { ascending: true }).limit(PAGINA);
      //  ⚠️ Una pagina persa NON deve somigliare a «non c'è altro»: chi numera ne ricaverebbe un
      //   numero già usato. Si rilancia, e `prossimoNumeroSu` si ferma.
      if (error) throw new Error(error.message);
      const righe = comeRighe(data);
      tutte.push(...righe);
      if (righe.length < PAGINA) return tutte;
      ultima = righe[righe.length - 1].key;
    }
  };

  return {
    ...base,
    //  ⚠️ `creaSeAssente` viene da archivioSu (T6) ed è sempre presente.
    creaSeAssente: base.creaSeAssente!,
    //  ⚠️ Anche `leggiPrefisso` qui è paginato: chi riceve un archivio protetto e legge un prefisso
    //   con il nome di sempre non deve ritrovarsi con la lettura troncata a 1000 righe.
    leggiPrefisso: leggiPerChiave,
    leggiPrefissoPerChiave: leggiPerChiave,
    leggiMolte: async (chiavi) => {
      const out: { key: string; value: string }[] = [];
      for (let i = 0; i < chiavi.length; i += RIMUOVI_A_GRUPPI) {
        const { data, error } = await c
          .from("app_config")
          .select("key,value")
          .in("key", chiavi.slice(i, i + RIMUOVI_A_GRUPPI));
        if (error) throw new Error(error.message);
        out.push(...comeRighe(data));
      }
      return out;
    },
    eliminaPerPrefisso: async (prefisso) => {
      //  ⚠️ Questa cancella molte righe con una riga di codice: deve poter toccare SOLO il bulk.
      if (!prefisso.startsWith(PREFISSO_BULK) || prefisso.length <= PREFISSO_BULK.length)
        return "prefisso non ammesso: si cancellano solo le chiavi del bulk";
      const { error } = await c
        .from("app_config")
        .delete()
        .like("key", `${proteggiLike(prefisso)}%`);
      return error?.message ?? null;
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. EMETTERE UNA RIGA
   ═════════════════════════════════════════════════════════════════════════ */

export type EsitoEmissioneProtetta =
  | {
      ok: true;
      fattura: Fattura;
      /** Numeri saltati rispetto al «precedente» di questa esecuzione: li hanno presi altri. Mai uno stop (D14). */
      salto: { da: number; a: number } | null;
    }
  | {
      ok: false;
      codice: "conflitto" | "lettura_fallita" | "scrittura_fallita" | "altra_origine";
      errore: string;
    };

/** Numera con `prossimoNumeroSu` (lettura paginata), scrive senza sovrascrivere, NON elimina bozze,
 *  una ripetizione su conflitto (tutto questo è `emettiSu`, T6), poi rilegge la chiave e verifica
 *  `origineBulk` (D10). `precedente` = ultimo numero emesso da questa esecuzione per quell'anno/serie:
 *  se il nuovo numero non è il suo successivo, il salto si riporta ma NON ferma niente (D14). */
export async function emettiProtettoSu(
  archivio: ArchivioProtetto,
  fattura: Fattura,
  azienda: DatiAzienda,
  data: string,
  precedente?: number | null,
): Promise<EsitoEmissioneProtetta> {
  const origine = fattura.origineBulk;
  if (!origine)
    return {
      ok: false,
      codice: "scrittura_fallita",
      errore: "la fattura non porta l'origine del lotto: non si emette senza poterla rileggere",
    };

  //  Cosa è successo per ultimo: serve a dare un nome all'errore di `emettiSu`, che ne ha uno solo.
  const visto: { ultimo: "conflitto" | "lettura" | "scrittura" | null } = { ultimo: null };
  const osservato: ArchivioDb = {
    ...archivio,
    //  La numerazione legge TUTTE le emesse: pagine per chiave, non l'unica lettura (troncata a 1000).
    leggiPrefisso: async (p) => {
      try {
        return await archivio.leggiPrefissoPerChiave(p);
      } catch (e) {
        visto.ultimo = "lettura";
        throw e;
      }
    },
    //  ⚠️ D6: il bulk non cancella mai bozze. `emettiSu` toglie quella del cliente: qui non può.
    elimina: async () => null,
    creaSeAssente: async (k, v) => {
      const r = await archivio.creaSeAssente(k, v);
      visto.ultimo = r.stato === "esiste" ? "conflitto" : r.stato === "errore" ? "scrittura" : null;
      return r;
    },
  };

  const r = await emettiSu(osservato, fattura, azienda, data);
  if (!r.ok || !r.fattura)
    return {
      ok: false,
      codice:
        visto.ultimo === "conflitto"
          ? "conflitto"
          : visto.ultimo === "lettura"
            ? "lettura_fallita"
            : "scrittura_fallita",
      errore: r.errore || "emissione non riuscita",
    };

  //  Rilettura: la chiave deve contenere LA NOSTRA fattura. Se è sparita, o è di un'altra origine,
  //  qualcuno ha scritto sotto di noi (un emettitore vecchio con l'upsert, una modifica a mano): si
  //  ferma tutto e si guarda, non si prosegue a numerare sopra un archivio che non torna.
  const chiave = chiaveEmessa(r.fattura);
  let riletta: Fattura | null = null;
  try {
    const grezzo = await archivio.leggi(chiave);
    riletta = grezzo ? (JSON.parse(grezzo) as Fattura) : null;
  } catch {
    riletta = null;
  }
  if (
    !riletta ||
    riletta.id !== r.fattura.id ||
    riletta.origineBulk?.lotto !== origine.lotto ||
    riletta.origineBulk?.riga !== origine.riga
  )
    return {
      ok: false,
      codice: "altra_origine",
      errore: `la fattura ${r.fattura.id} appena scritta non si rilegge come l'ho scritta: controlla l'archivio prima di continuare`,
    };

  const salto =
    precedente != null && r.fattura.numero > precedente + 1
      ? { da: precedente + 1, a: r.fattura.numero - 1 }
      : null;
  return { ok: true, fattura: r.fattura, salto };
}

/** La fattura già emessa per quella riga di quel lotto, se c'è (ripresa dopo risposta persa). */
export function cercaPerOrigine(emesse: Fattura[], lotto: string, idRiga: string): Fattura | null {
  return (
    emesse
      .filter((f) => f.origineBulk?.lotto === lotto && f.origineBulk?.riga === idRiga)
      .sort((a, b) => a.anno - b.anno || a.numero - b.numero)[0] ?? null
  );
}

/** Dopo un esito: proseguire, saltare la riga o fermare il lotto (D2, D14). Un salto di numero NON
 *  ferma (è già dentro l'esito `ok`): ferma solo un errore di sistema. */
export function decidiDopoEsito(
  esito: EsitoEmissioneProtetta | { ok: false; codice: "non_emettibile" },
): "prosegui" | "salta" | "ferma" {
  if (esito.ok) return "prosegui";
  return esito.codice === "non_emettibile" ? "salta" : "ferma";
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. L'ORDINE DELLE DATE
   ═════════════════════════════════════════════════════════════════════════ */

/** Per data di pagamento crescente, parità = ordine di caricamento (D2). Non muta l'input.
 *  `numero` è la posizione di caricamento. Una data vuota va in fondo (una riga così non si emette). */
export function ordineEmissione<T extends { numero: number; data: string }>(righe: T[]): T[] {
  const chiave = (r: T) => r.data || "9999-99-99";
  return [...righe].sort((a, b) => chiave(a).localeCompare(chiave(b)) || a.numero - b.numero);
}

/** Fra le emesse dello stesso anno (e serie, se data) quella con la data PIÙ RECENTE; a parità, quella
 *  col numero più alto. In un archivio in ordine è anche l'ultima emessa. */
function piuRecente(emesse: Fattura[], anno: number, serie?: string): Fattura | null {
  let r: Fattura | null = null;
  for (const f of emesse) {
    if (f.stato !== "emessa" || f.anno !== anno || (serie !== undefined && f.serie !== serie))
      continue;
    if (!r || f.data > r.data || (f.data === r.data && f.numero > r.numero)) r = f;
  }
  return r;
}

const comeItaliana = (iso: string) => iso.split("-").reverse().join("/");

/** UNICO punto che decide cosa succede se la data è anteriore all'ultima emessa (D1): la gravità è
 *  `GRAVITA_DATA_ANTERIORE`. `serie` = quella dell'azienda (senza, si guardano tutte le serie dell'anno).
 *  La numerazione riparte ogni anno, quindi si guarda solo l'anno della data. */
export function esitoOrdineDate(data: string, emesse: Fattura[], serie?: string): Motivo | null {
  const anno = Number(data.slice(0, 4));
  if (!anno) return null;
  const ultima = piuRecente(emesse, anno, serie);
  if (!ultima || data >= ultima.data) return null;
  const utile = ultimoGiornoUtile(data);
  return {
    codice: "data_anteriore",
    gravita: GRAVITA_DATA_ANTERIORE,
    campo: "data",
    testo:
      `La fattura n. ${ultima.numero} ha data ${comeItaliana(ultima.data)}, più recente di questa (${comeItaliana(data)}): ` +
      `questa avrà un numero più alto ma una data più vecchia. ` +
      `Entro ${GIORNI_TERMINE_SDI} giorni dall'operazione è ammesso (Circolare 14/E/2019, par. 3.2); oltre, il commercialista non ha ancora risposto. ` +
      (utile ? `Ultimo giorno utile per l'invio allo SdI: ${comeItaliana(utile)} (stima). ` : "") +
      `Controlla la data o conferma questo avviso.`,
  };
}

/** I fatti da mostrare PRIMA di emettere (D1b): ultima fattura emessa, date estreme del lotto, quante
 *  righe hanno data anteriore, quante sono oltre il termine (stima, a `oggi`, data locale italiana). */
export function fattiSulleDate(
  righe: { idRiga: string; data: string }[],
  emesse: Fattura[],
  azienda: DatiAzienda,
  oggi: string,
): FattiSulleDate {
  const serie = azienda.serie || "";
  const dateOk = righe.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.data));
  const ordinate = dateOk.map((r) => r.data).sort();
  const annoUltimo = emesse
    .filter((f) => f.stato === "emessa" && f.serie === serie)
    .reduce((m, f) => Math.max(m, f.anno), 0);
  const ultima = annoUltimo ? piuRecente(emesse, annoUltimo, serie) : null;
  return {
    ultimaEmessa: ultima ? { id: ultima.id, numero: ultima.numero, data: ultima.data } : null,
    dataMinima: ordinate[0] ?? "",
    dataMassima: ordinate[ordinate.length - 1] ?? "",
    righeDataAnteriore: dateOk
      .filter((r) => esitoOrdineDate(r.data, emesse, serie))
      .map((r) => r.idRiga),
    righeOltreTermine: dateOk
      .filter((r) => {
        const utile = ultimoGiornoUtile(r.data);
        return !!utile && utile < oggi;
      })
      .map((r) => r.idRiga),
  };
}
