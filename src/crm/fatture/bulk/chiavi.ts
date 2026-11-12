/** ── FATTURE BULK · LE CHIAVI E LE COSTANTI ────────────────────────────────
 *  Commessa 2026-11-12-fatture-bulk (PIANO §1). Qui sta, in un posto solo, DOVE
 *  il caricamento da screenshot scrive in `app_config` e i numeri che ne
 *  regolano i tempi. Niente rete, niente Supabase: solo stringhe e costanti.
 *
 *  ── ⚠️ NESSUNA CHIAVE INIZIA CON «fattura» ───────────────────────────────
 *  La numerazione delle fatture legge `fattura:` e le bozze `fattura_bozza:`
 *  (archivio.ts, `leggiPrefisso`). Una chiave nostra che vi rientrasse finirebbe
 *  nell'elenco delle emesse e sfalserebbe il prossimo numero: due fatture con lo
 *  stesso numero, scoperte dal commercialista mesi dopo. Per questo tutte le
 *  famiglie iniziano per `bulk_fatture_` — e la prova (prove/fatture-bulk/
 *  fondamenta.mjs) lo verifica, con e senza la protezione di «_» nel LIKE.
 *
 *    bulk_fatture_t:<lotto>                testata: opzioni, creato il, firma impostazioni
 *    bulk_fatture_f:<lotto>:<0000>         un file: percorso bucket, impronta, tipo, lettura, stato
 *    bulk_fatture_r:<lotto>:<idRiga>       decisioni sulla riga: modifiche, conferme, scarto, emessa
 *    bulk_fatture_c:<lotto>:<gruppo>       reclamo di lettura di un gruppo (scade)
 *    bulk_fatture_e:<lotto>                emittente del lotto (scade)
 *    bulk_fatture_lock                     lucchetto di emissione globale (scade)
 *
 *  Una chiave per voce: tre gruppi in parallelo scrivono i loro file e chi
 *  corregge righe diverse non si pesta; e famiglie separate perché si cancellano
 *  per prefisso in una chiamata sola e perché PostgREST legge al massimo 1000
 *  righe per volta (un lotto = al più 600 + 200 + 1: una famiglia alla volta).
 *  ───────────────────────────────────────────────────────────────────────── */

export const PREFISSO_TESTATA = "bulk_fatture_t:";
const PREFISSO_FILE = "bulk_fatture_f:";
const PREFISSO_RIGHE = "bulk_fatture_r:";
const PREFISSO_RECLAMI = "bulk_fatture_c:";
const PREFISSO_EMITTENTE = "bulk_fatture_e:";
export const CHIAVE_LUCCHETTO = "bulk_fatture_lock";

/** ── LE COSTANTI DEL PIANO ────────────────────────────────────────────── */
/** File per caricamento (200 clienti): oltre, si spezza in più caricamenti. */
export const MAX_FILE = 600;
/** Un lotto mai chiuso tiene le foto fino a qui, poi `pulisci` lo toglie (D11f). */
export const GIORNI_LOTTO_APERTO = 30;
/** Fallimenti di fila dopo i quali la lettura si ferma da sola (freno). */
export const ERRORI_DI_FILA = 5;
/** Gruppi letti insieme dal browser. */
export const IN_PARALLELO = 3;
/** Tempo massimo di UN tentativo all'AI nella rotta: sotto i ~100 s che Cloudflare concede (D12). */
export const TIMEOUT_AI_MS = 55_000;
/** Il reclamo di lettura deve durare PIÙ della richiesta più lunga, o due schede leggerebbero insieme (D14). */
export const SCADENZA_RECLAMO_MS = 90_000;
/** Scadenza dell'emittente, rinnovata a ogni riga (D14). */
export const SCADENZA_EMITTENTE_MS = 120_000;
/** Scadenza del lucchetto di emissione globale. */
export const SCADENZA_LUCCHETTO_MS = 60_000;
/** `storage.remove` a gruppi di tanti percorsi (D13). */
export const RIMUOVI_A_GRUPPI = 100;
/** Sottorichieste massime per azione della rotta (limite Free: 50; D13). */
export const MAX_SOTTORICHIESTE = 40;
/** Giorni di calendario fra operazione e invio allo SDI per la fattura immediata (stima, D1/D15). */
export const GIORNI_TERMINE_SDI = 12;
/** Durata degli URL firmati delle miniature, e quanti per chiamata. */
export const URL_FIRMATI_SECONDI = 60;
export const MAX_URL_PER_CHIAMATA = 6;
/** Tentativi totali per gruppo (il primo + 2 ripetizioni, a 2 s e 5 s), solo nel browser (D12). */
export const TENTATIVI_PER_GRUPPO = 3;
export const RITARDI_RIPETIZIONE_MS = [2_000, 5_000];

/** L'id di un lotto finisce dentro una chiave e dentro un LIKE: solo minuscole,
 *  cifre e «-» (un UUID va bene). Niente «:», «%», «_», spazi o «..». Si controlla
 *  PRIMA di costruire qualsiasi chiave o percorso, perché arriva dal browser. */
export const lottoValido = (lotto: string): boolean => /^[a-z0-9][a-z0-9-]{3,39}$/.test(lotto);

function sicuro(lotto: string): string {
  if (!lottoValido(lotto)) throw new Error("id del lotto non valido");
  return lotto;
}

const indiceScritto = (n: number): string => {
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new Error("indice di file non valido");
  return String(n).padStart(4, "0");
};

export const chiaveTestata = (lotto: string) => `${PREFISSO_TESTATA}${sicuro(lotto)}`;
export const chiaveFile = (lotto: string, indice: number) => `${prefissoFile(lotto)}${indiceScritto(indice)}`;
export const chiaveRiga = (lotto: string, idRiga: string) => `${prefissoRighe(lotto)}${idRiga}`;
/** Il gruppo è la posizione (0, 1, 2…) di una terna di file; si scrive com'è, senza zeri. */
export function chiaveReclamo(lotto: string, gruppo: number): string {
  if (!Number.isInteger(gruppo) || gruppo < 0) throw new Error("numero di gruppo non valido");
  return `${prefissoReclami(lotto)}${gruppo}`;
}
export const chiaveEmittente = (lotto: string) => `${PREFISSO_EMITTENTE}${sicuro(lotto)}`;

/** I prefissi con i «:» finali (un lotto non pesca quelli di un altro che inizia uguale).
 *  Per cancellare o leggere una famiglia intera: il LIKE va protetto come in `leggiPrefisso`. */
export const prefissoFile = (lotto: string) => `${PREFISSO_FILE}${sicuro(lotto)}:`;
export const prefissoRighe = (lotto: string) => `${PREFISSO_RIGHE}${sicuro(lotto)}:`;
export const prefissoReclami = (lotto: string) => `${PREFISSO_RECLAMI}${sicuro(lotto)}:`;

/** ── L'ID DI UNA RIGA ────────────────────────────────────────────────────
 *  Gli indici dei file della riga, ordinati e uniti da «-»: `[8,6,7]` →
 *  `0006-0007-0008`. Non cambia se i dati letti vengono svuotati (D11): dipende
 *  solo da quali file compongono il cliente. */
export function idRigaDa(indici: number[]): string {
  if (indici.length === 0) throw new Error("una riga ha almeno un file");
  return [...new Set(indici)].sort((a, b) => a - b).map(indiceScritto).join("-");
}

/** La cartella del bucket `dati-fattura` per i file di un lotto: `<utente>/bulk/<lotto>/`
 *  (nessun nome di persona nel percorso). La pulizia elenca questa cartella per trovare gli orfani. */
export const cartellaBucket = (userId: string, lotto: string) => `${userId}/bulk/${sicuro(lotto)}/`;
