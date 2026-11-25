/** ── IL NEGOZIO DAL BROWSER: LETTURA E AZIONI SULLE ROTTE (client.ts) ────────
 *  Commessa 2026-11-20-shop-completo (T13). Parla con `/api/crm/negozio` e `/api/crm/negozio-media` (contratto §3.3) e
 *  decide TUTTO quello che si può decidere senza React: gli indirizzi, cosa significa ogni risposta, la frase per ogni
 *  errore, quando rileggere. Stessa struttura di `crm/ecommerce/client.ts` (da cui prende il lettore e le porte del tempo).
 *
 *  Il modulo non importa niente del browser né del CRM: riceve `fetch` (nella pagina è `fetchCRM`, che attacca il
 *  gettone e lo rinnova) e le «porte» del tempo. Per questo si prova con risposte finte e un orologio a mano.
 *
 *  ── ⚠️ COSA SI MOSTRA E COSA SI TIENE ────────────────────────────────────────
 *  · Una lettura che fallisce NON svuota l'elenco: restano i prodotti dell'ultima lettura buona, con l'ora di quella
 *    lettura e l'errore accanto. MA con 401/403 (sessione scaduta, niente permesso) l'elenco si svuota: non si mostra
 *    niente a chi non può vederlo.
 *  · Una lettura partita PRIMA di un'azione e arrivata DOPO viene scartata (porterebbe la scheda indietro) e si rilegge.
 *  · Un'azione la cui risposta non arriva (rete caduta) può essere stata scritta: lo si dice, non si finge un errore pulito.
 *  · Le frasi degli errori le scrive il SERVER (non contengono dati dei clienti); per 401 e 403 valgono le nostre.
 *  ⚠️ Nessun log da qui, mai. Niente chiavi: il gettone lo mette `fetchCRM`, e il caricamento dei file usa il permesso
 *   firmato dal server (nessun gettone del CRM verso lo Storage). */
import { creaLettore, oraHHmm, type PorteTempo } from "../ecommerce/client";
import type { Voce } from "../../shop/cms/pubblicazione";

const ROTTA = "/api/crm/negozio";
const ROTTA_MEDIA = "/api/crm/negozio-media";
/** Ogni quanto si rilegge l'elenco mentre la scheda si guarda. */
export const RILEGGI_PRODOTTI_MS = 30_000;
const MAX_MESSAGGIO = 300;
const MAX_RICERCA = 100;
/** Oltre questo una richiesta senza risposta (rete caduta a metà) è «rete». */
const TETTO_RICHIESTA_MS = 20_000;
/** Il caricamento di un video può durare di più. */
const TETTO_CARICAMENTO_MS = 120_000;

/* ══ GLI INDIRIZZI ══════════════════════════════════════════════════════════ */

export const SEGMENTI = ["tutti", "pubblicati", "bozze", "da_sistemare", "vecchio_catalogo"] as const;
export type Segmento = (typeof SEGMENTI)[number];
export interface FiltriElenco {
  segmento?: Segmento;
  /** L'id della categoria. */
  categoria?: string;
  q?: string;
}
/** Come l'id valido per il server (`prodotti.server.ts`): lettere, numeri e trattini. */
const eId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{1,64}$/.test(v);

/** `null` se un filtro non è valido: l'indirizzo sbagliato non parte nemmeno. «tutti» e la ricerca vuota non si scrivono. */
export function urlProdotti(filtri: FiltriElenco = {}): string | null {
  const { segmento, categoria, q } = filtri;
  if (segmento !== undefined && !(SEGMENTI as readonly string[]).includes(segmento)) return null;
  if (categoria !== undefined && !eId(categoria)) return null;
  const parti = ["prodotti"];
  if (segmento && segmento !== "tutti") parti.push(`segmento=${segmento}`);
  if (categoria) parti.push(`categoria=${categoria}`);
  const ricerca = typeof q === "string" ? q.trim().slice(0, MAX_RICERCA) : "";
  if (ricerca) parti.push(`q=${encodeURIComponent(ricerca)}`);
  return `${ROTTA}?${parti.join("&")}`;
}
export const urlProdotto = (id: string): string | null => (eId(id) ? `${ROTTA}?prodotto=${id}` : null);
export const urlCategorie = (): string => `${ROTTA}?categorie`;
export const urlInterruttori = (): string => `${ROTTA}?interruttori`;

/** Le azioni di POST: quelle di T08 (prodotti, varianti, media) e di T09 (giacenza, categorie, interruttori). Una che non c'è non parte. */
export const AZIONI_NEGOZIO = [
  "prodotto_crea", "prodotto_salva", "prodotto_pubblica_modifiche", "prodotto_scarta_modifiche", "prodotto_stato", "prodotto_duplica",
  "prodotto_adotta", "gruppo_stato", "anteprima_chiave", "variante_salva", "varianti_genera", "variante_attiva", "media_registra",
  "media_ordina", "media_alt", "media_flag", "media_rimuovi",
  "giacenza_muovi", "giacenza_imposta", "prodotto_categorie", "categoria_salva", "categoria_ordina", "categoria_visibile", "categoria_foto", "interruttore_imposta",
  "prodotti_importa_verifica", "prodotti_importa", // editor prodotti: import da CSV (modulo `import.server`, E3)
] as const;
export type AzioneNegozio = (typeof AZIONI_NEGOZIO)[number];

/** Le azioni che modificano ciò che la scheda ha già visto vogliono la `versione` (l'`aggiornato_il` letto): senza, il server non può dire 409.
 *  Il client non le fa partire nemmeno. (`categoria_salva` la vuole solo se la categoria esiste già, cioè se c'è l'`id`.) */
function mancaVersione(azione: string, dati: Record<string, unknown>): boolean {
  const richiesta = ["prodotto_salva", "categoria_visibile", "categoria_foto", "prodotto_categorie"].includes(azione) || (azione === "categoria_salva" && dati.id != null);
  return richiesta && !(typeof dati.versione === "string" && dati.versione !== "");
}

/** D36: la foto di una categoria arriva in tre misure (`path480`, `path960`, `path1600`) con l'`alt` e la `categoriaId`: se ne manca una il server
 *  la rifiuterebbe di sicuro, quindi non parte nemmeno. (Che i percorsi siano veri lo controlla il server.) */
function fotoCategoriaIncompleta(azione: string, dati: Record<string, unknown>): boolean {
  if (azione !== "categoria_foto") return false;
  const pieno = (v: unknown) => typeof v === "string" && v.trim() !== "";
  return !(eId(dati.categoriaId) && pieno(dati.path480) && pieno(dati.path960) && pieno(dati.path1600) && pieno(dati.alt));
}

/* ══ GLI ERRORI ═════════════════════════════════════════════════════════════ */

export type TipoErrore =
  | "sessione" //          401: non so chi sei → rientra
  | "permesso" //          403: so chi sei, e non puoi → chiedi a un amministratore
  | "conflitto" //         409: un'altra persona ha modificato nel frattempo
  | "duplicato" //         409: SKU o indirizzo già usato
  | "migrazione" //        409: mancano le tabelle del catalogo
  | "non_pubblicabile" //  422: manca qualcosa per stare sul sito (porta i bloccanti)
  | "valore" //            400: la richiesta non è valida
  | "non_trovato" //       404
  | "chiave" //            503: manca la chiave di servizio (anteprima)
  | "cancello" //          409: lo shop non si può aprire (porta le condizioni, riga per riga)
  | "slug_bloccato" //     409: l'indirizzo di una categoria già pubblicata non si cambia
  | "giacenza_negativa" // 409: il movimento porterebbe le scorte sotto zero
  | "variante_inesistente" // 404: la variante non c'è più
  | "categoria_inesistente" // 404: una delle categorie scelte non c'è più
  | "categoria_mancante" // 409: un prodotto pubblicato deve avere almeno una categoria
  | "server" //            500, o una risposta che non si capisce
  | "rete"; //             la richiesta non è arrivata
export interface ErroreNegozio {
  tipo: TipoErrore;
  messaggio: string;
  /** Solo per «cancello»: ciò che il server risponde in più (le righe delle condizioni di uscita, D26). */
  condizioni?: unknown;
  /** Solo per «non_pubblicabile»: cosa manca, campo per campo (il pannello «Prima di pubblicare» li usa). */
  bloccanti?: Voce[];
  /** Solo per «conflitto» su un interruttore: il valore che c'è ora sul server (la schermata lo mostra senza rileggere). */
  valore?: unknown;
}

const FRASI: Record<TipoErrore, string> = {
  sessione: "La sessione è scaduta: rientra nel CRM.",
  permesso: "Il tuo utente non può gestire il negozio: chiedi a un amministratore.",
  conflitto: "Un'altra persona ha modificato questo prodotto: aggiorna e riprova.",
  duplicato: "Questo SKU o questo indirizzo è già usato da un altro prodotto.",
  migrazione: "Mancano gli aggiornamenti del database del catalogo: chiedi a chi gestisce il database di applicarli.",
  non_pubblicabile: "Il prodotto non si può pubblicare: manca qualcosa.",
  valore: "La richiesta non è valida: controlla i dati e riprova.",
  non_trovato: "Prodotto non trovato.",
  chiave: "L'anteprima non è disponibile in questo momento.",
  cancello: "Lo shop non si può ancora aprire: mancano delle condizioni.",
  slug_bloccato: "L'indirizzo di una categoria già pubblicata non si cambia: i link già condivisi smetterebbero di funzionare.",
  giacenza_negativa: "Non ci sono abbastanza pezzi in magazzino per questo movimento: controlla la quantità.",
  variante_inesistente: "Questa variante non esiste più: aggiorna la pagina.",
  categoria_inesistente: "Una delle categorie scelte non esiste più: aggiorna la pagina e scegli di nuovo.",
  categoria_mancante: "Un prodotto pubblicato deve avere almeno una categoria: scegline una oppure mettilo in bozza.",
  server: "Qualcosa non ha funzionato: riprova tra un momento.",
  rete: "Non riesco a collegarmi al server: controlla la connessione e riprova.",
};
/** Il `motivo` che scrive il server → il nostro tipo. */
const DA_MOTIVO: Record<string, TipoErrore> = {
  conflitto: "conflitto",
  duplicato: "duplicato",
  slug_occupato: "duplicato", // T09: l'indirizzo di una categoria già usato (per il prodotto T08 dice «duplicato»)
  slug_bloccato: "slug_bloccato",
  giacenza_negativa: "giacenza_negativa",
  variante_inesistente: "variante_inesistente",
  categoria_inesistente: "categoria_inesistente",
  categoria_mancante: "categoria_mancante",
  migrazione: "migrazione",
  non_pubblicabile: "non_pubblicabile",
  valore: "valore",
  non_trovato: "non_trovato",
  chiave: "chiave",
  cancello: "cancello",
};

const eOggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const errore = (tipo: TipoErrore, messaggio = FRASI[tipo]): ErroreNegozio => ({ tipo, messaggio });

function erroreDaRisposta(stato: number, corpo: Record<string, unknown> | null): ErroreNegozio {
  if (stato === 401) return errore("sessione");
  if (stato === 403) return errore("permesso");
  const tipo = DA_MOTIVO[String(corpo?.motivo)] ?? (stato === 404 ? "non_trovato" : "server");
  const frase = corpo?.frase;
  const e = errore(tipo, typeof frase === "string" && frase.trim() ? frase.trim().slice(0, MAX_MESSAGGIO) : FRASI[tipo]);
  if (tipo === "non_pubblicabile" && Array.isArray(corpo?.bloccanti))
    e.bloccanti = (corpo.bloccanti as unknown[]).flatMap((b) => (eOggetto(b) && typeof b.campo === "string" && typeof b.frase === "string" ? [{ campo: b.campo, frase: b.frase }] : []));
  if (tipo === "cancello" && corpo?.condizioni !== undefined) e.condizioni = corpo.condizioni;
  if (tipo === "conflitto" && corpo && "valore" in corpo) e.valore = corpo.valore;
  return e;
}

/* ══ LA CHIAMATA ════════════════════════════════════════════════════════════ */

/** La `fetch` della pagina (`fetchCRM`): stessa firma di `fetch`. */
export type FetchRotta = (url: string, init?: RequestInit) => Promise<Response>;
type Grezza = { corpo: Record<string, unknown> } | { errore: ErroreNegozio; incerto: boolean };

/** Una richiesta: o il corpo di una risposta buona (`ok: true`), o l'errore già tradotto. Non lancia mai. */
async function chiama(f: FetchRotta, url: string, init?: RequestInit): Promise<Grezza> {
  let r: Response;
  try {
    const tetto = typeof AbortSignal.timeout === "function" ? { signal: AbortSignal.timeout(TETTO_RICHIESTA_MS) } : {};
    r = await f(url, { ...init, ...tetto });
  } catch {
    return { errore: errore("rete"), incerto: true }; // mai il testo del browser: può nominare l'indirizzo
  }
  let corpo: unknown = null;
  try {
    corpo = await r.json();
  } catch {
    // una pagina d'errore dell'hosting, un corpo vuoto: resta solo lo stato HTTP
  }
  const o = eOggetto(corpo) ? corpo : null;
  if (r.ok && o && o.ok === true) return { corpo: o };
  //  Un 502/503/504 senza `motivo` (timeout dell'hosting) può arrivare DOPO che il server ha scritto: com'è per la rete caduta.
  const incerto = !r.ok && [502, 503, 504].includes(r.status) && typeof o?.motivo !== "string";
  return { errore: erroreDaRisposta(r.ok ? 500 : r.status, o), incerto };
}
const senzaOk = (corpo: Record<string, unknown>): Record<string, unknown> => {
  const { ok: _ok, ...resto } = corpo;
  return resto;
};

/* ══ LE LETTURE ═════════════════════════════════════════════════════════════ */

/** Una riga dell'elenco (la forma la decide `prodotti.server.ts`). */
export interface RigaElenco {
  id: string;
  sku: string;
  slug: string;
  nome: string;
  tipo: string;
  stato: string;
  origine: string | null;
  prezzoCent: number;
  /** Da rimandare al server quando si salva (confronto di versione, 409). */
  versione: string;
  haModifiche: boolean;
  /** Il primo motivo per cui non è pubblicabile (frase), o `null`. */
  motivo: string | null;
  /** Dove il prodotto è acceso (T32): solo le quattro chiavi note. */
  canali: { sito: boolean; meta: boolean; google: boolean; tiktok: boolean };
  /** La somma della giacenza delle varianti attive (T32). */
  giacenza: number;
}
export interface SchedaProdotto {
  prodotto: Record<string, unknown>;
  versione: string;
  varianti: unknown[];
  media: unknown[];
  principaleId: string | null;
  categorie: string[];
  storico: unknown[];
  controllo: { bloccanti: Voce[]; informativi: Voce[] };
  /** Il costo di ogni variante in centesimi (`null` = non scritto). Solo in lettura nel CRM: non esce mai sul sito. Assente = server vecchio. */
  costi?: Record<string, number | null>;
  /** `false` se la colonna del costo non c'è ancora nel database (migrazione non applicata): il campo si spegne con la frase. */
  costoDisponibile?: boolean;
}

/** `troncato`: l'elenco ha superato il tetto del server e non è completo (la pagina lo deve dire). */
export type RisultatoElenco = { ok: true; prodotti: RigaElenco[]; troncato: boolean } | { ok: false; errore: ErroreNegozio };
export async function leggiElenco(f: FetchRotta, filtri?: FiltriElenco): Promise<RisultatoElenco> {
  const url = urlProdotti(filtri);
  if (!url) return { ok: false, errore: errore("valore") };
  const g = await chiama(f, url);
  if ("errore" in g) return { ok: false, errore: g.errore };
  if (!Array.isArray(g.corpo.prodotti)) return { ok: false, errore: errore("server") };
  return { ok: true, prodotti: g.corpo.prodotti as RigaElenco[], troncato: g.corpo.troncato === true };
}

export type RisultatoScheda = { ok: true; scheda: SchedaProdotto } | { ok: false; errore: ErroreNegozio };
export async function leggiScheda(f: FetchRotta, id: string): Promise<RisultatoScheda> {
  const url = urlProdotto(id);
  if (!url) return { ok: false, errore: errore("valore") };
  const g = await chiama(f, url);
  if ("errore" in g) return { ok: false, errore: g.errore };
  if (!eOggetto(g.corpo.prodotto) || typeof g.corpo.versione !== "string") return { ok: false, errore: errore("server") };
  return { ok: true, scheda: senzaOk(g.corpo) as unknown as SchedaProdotto };
}

/** shortcut: categorie e interruttori passano come arrivano (senza `ok`): la forma è di T09 e la leggono le sue schermate. */
export type RisultatoDati = { ok: true; dati: Record<string, unknown> } | { ok: false; errore: ErroreNegozio };
async function leggiDati(f: FetchRotta, url: string): Promise<RisultatoDati> {
  const g = await chiama(f, url);
  return "errore" in g ? { ok: false, errore: g.errore } : { ok: true, dati: senzaOk(g.corpo) };
}
export const leggiCategorie = (f: FetchRotta): Promise<RisultatoDati> => leggiDati(f, urlCategorie());
export const leggiInterruttori = (f: FetchRotta): Promise<RisultatoDati> => leggiDati(f, urlInterruttori());

/* ══ LE AZIONI ══════════════════════════════════════════════════════════════ */

/** `dati`: tutto ciò che il server risponde oltre a `ok` (versione nuova, avviso, `tornatoInBozza`, `storico:false`…). */
export type RisultatoAzione = RisultatoDati;

export async function eseguiAzione(f: FetchRotta, azione: string, dati: Record<string, unknown> = {}): Promise<RisultatoAzione> {
  if (!(AZIONI_NEGOZIO as readonly string[]).includes(azione)) return { ok: false, errore: errore("valore") };
  if (mancaVersione(azione, dati)) return { ok: false, errore: errore("valore", "Manca la versione di ciò che stai modificando: ricarica la pagina e riprova.") };
  if (fotoCategoriaIncompleta(azione, dati)) return { ok: false, errore: errore("valore", "La foto della categoria è incompleta: scegli di nuovo la foto e descrivila.") };
  const g = await chiama(f, ROTTA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ azione }, dati, { azione })), // i dati non possono cambiare l'azione
  });
  if ("errore" in g) {
    //  Se la richiesta non è arrivata, o la risposta no, non si sa se la modifica sia stata scritta: lo si dice.
    return g.incerto
      ? { ok: false, errore: errore("rete", "Non so se la modifica sia stata salvata: controlla la connessione, ricarica la scheda e ricontrolla.") }
      : { ok: false, errore: g.errore };
  }
  return { ok: true, dati: senzaOk(g.corpo) };
}

/* ══ IL CARICAMENTO DEI FILE ════════════════════════════════════════════════ */

/** Il permesso firmato dal server per caricare UN file nello Storage (percorso sorteggiato dal server, mai il nome del file). */
export interface PermessoCaricamento {
  bucket: string;
  path: string;
  token: string;
  url: string;
}
export type RisultatoPermesso = { ok: true; permesso: PermessoCaricamento } | { ok: false; errore: ErroreNegozio };

/** L'indirizzo firmato dello Storage deve essere `https:`. shortcut: in locale (Supabase su http) il caricamento non parte; da allargare solo per lo sviluppo. */
const eHttps = (u: unknown): boolean => {
  try {
    return typeof u === "string" && new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};

export async function chiediPermesso(f: FetchRotta, file: { tipo: "foto" | "video" | "copertina"; mime: string; peso: number }): Promise<RisultatoPermesso> {
  if (!["foto", "video", "copertina"].includes(file.tipo) || typeof file.mime !== "string" || !Number.isInteger(file.peso) || file.peso <= 0)
    return { ok: false, errore: errore("valore") };
  const g = await chiama(f, ROTTA_MEDIA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: file.tipo, mime: file.mime, peso: file.peso }),
  });
  if ("errore" in g) return { ok: false, errore: g.errore };
  const { bucket, path, token, url } = g.corpo;
  if (![bucket, path, token, url].every((x) => typeof x === "string" && x) || !eHttps(url)) return { ok: false, errore: errore("server") };
  return { ok: true, permesso: { bucket, path, token, url } as PermessoCaricamento };
}

/** Il file va allo Storage col permesso firmato (stessa forma di `uploadToSignedUrl` di Supabase). `fetchNudo` è la `fetch` del browser, SENZA il gettone del CRM. */
export async function caricaConPermesso(fetchNudo: FetchRotta, permesso: PermessoCaricamento, file: Blob): Promise<{ ok: true } | { ok: false; errore: ErroreNegozio }> {
  if (!eHttps(permesso.url)) return { ok: false, errore: errore("server", "Il file non è stato caricato: riprova.") };
  const corpo = new FormData();
  corpo.append("cacheControl", "3600");
  corpo.append("", file);
  try {
    const tetto = typeof AbortSignal.timeout === "function" ? { signal: AbortSignal.timeout(TETTO_CARICAMENTO_MS) } : {};
    const r = await fetchNudo(permesso.url, { method: "PUT", headers: { "x-upsert": "false" }, body: corpo, ...tetto });
    return r.ok ? { ok: true } : { ok: false, errore: errore("server", "Il file non è stato caricato: riprova.") };
  } catch {
    return { ok: false, errore: errore("rete", "Non sono riuscito a caricare il file: controlla la connessione e riprova.") };
  }
}

/* ══ L'ARCHIVIO DELL'ELENCO (quello che la pagina legge) ════════════════════ */

export interface StatoNegozio {
  prodotti: RigaElenco[];
  /** c'è stata almeno una lettura buona */
  caricato: boolean;
  /** non c'è ancora niente da mostrare (prima lettura in corso) */
  inCaricamento: boolean;
  /** una lettura è in corso (anche quelle automatiche) */
  inAggiornamento: boolean;
  /** l'errore dell'ULTIMA lettura; i prodotti sono quelli dell'ultima lettura buona */
  errore: ErroreNegozio | null;
  /** l'elenco è incompleto (oltre il tetto del server) */
  troncato: boolean;
  /** quando (ms) è finita l'ultima lettura buona; `oraHHmm` lo scrive */
  ultimoAggiornamento: number | null;
  filtri: FiltriElenco;
}

/** 403, o 401 dopo il tentativo già fatto da `fetchCRM`: riprovare ogni 30 s non serve a niente. */
const eAccessoNegato = (e: ErroreNegozio): boolean => e.tipo === "permesso" || e.tipo === "sessione";
/** Errori dopo i quali l'elenco non è più quello che la pagina credeva: si rilegge da soli. */
const DA_RILEGGERE: readonly TipoErrore[] = [
  "conflitto", "non_trovato", "migrazione", "permesso", "sessione", "duplicato", "cancello",
  "variante_inesistente", "categoria_inesistente", "giacenza_negativa", "slug_bloccato",
];

export function creaArchivioNegozio(opz: { fetch: FetchRotta; porte: PorteTempo; filtri?: FiltriElenco }) {
  const { fetch: f, porte } = opz;
  let stato: StatoNegozio = {
    prodotti: [], caricato: false, inCaricamento: true, inAggiornamento: false, errore: null, troncato: false, ultimoAggiornamento: null, filtri: opz.filtri ?? {},
  };
  let versione = 0; // sale a ogni azione riuscita (e a ogni cambio di filtri)
  let ascoltatori: Array<() => void> = [];
  const imposta = (p: Partial<StatoNegozio>) => {
    stato = { ...stato, ...p };
    ascoltatori.forEach((fn) => fn());
  };

  const leggi = async () => {
    imposta({ inAggiornamento: true });
    let r: RisultatoElenco;
    //  Una lettura partita prima di un'azione e arrivata dopo porterebbe la pagina indietro: si scarta e si rilegge subito.
    for (;;) {
      const v = versione;
      r = await leggiElenco(f, stato.filtri);
      if (v === versione) break;
    }
    if (!r.ok) {
      //  Senza permesso (o senza sessione) i prodotti già letti non devono restare a schermo.
      const negato = eAccessoNegato(r.errore);
      imposta({ errore: r.errore, inCaricamento: false, inAggiornamento: false, ...(negato && { prodotti: [], caricato: false, ultimoAggiornamento: null, troncato: false }) });
      return !negato;
    }
    imposta({ prodotti: r.prodotti, troncato: r.troncato, caricato: true, inCaricamento: false, inAggiornamento: false, errore: null, ultimoAggiornamento: porte.adesso() });
  };
  const lettore = creaLettore({ ogniMs: RILEGGI_PRODOTTI_MS, leggi, porte });

  return {
    stato: () => stato,
    iscrivi(fn: () => void) {
      ascoltatori = [...ascoltatori, fn];
      return () => {
        ascoltatori = ascoltatori.filter((x) => x !== fn);
      };
    },
    /** Parte la rilettura periodica; restituisce il modo di fermarla. */
    avvia() {
      lettore.avvia();
      return lettore.ferma;
    },
    /** Il tasto «Aggiorna». */
    aggiorna: lettore.aggiorna,
    /** Cambia i filtri e rilegge subito (anche se una lettura coi filtri vecchi è già in volo: si scarta). */
    impostaFiltri(filtri: FiltriElenco) {
      versione++;
      imposta({ filtri });
      return lettore.aggiorna();
    },
    /** Esegue un'azione; se riesce l'elenco si rilegge (stato e motivo possono essere cambiati). L'esito va letto dalla pagina. */
    async esegui(azione: string, dati?: Record<string, unknown>): Promise<RisultatoAzione> {
      const r = await eseguiAzione(f, azione, dati);
      if (r.ok || DA_RILEGGERE.includes(r.errore.tipo)) {
        //  La versione sale perché una lettura già in volo può essere partita PRIMA della modifica: si scarta e se ne fa una nuova.
        versione++;
        void lettore.aggiorna();
      }
      return r;
    },
    scheda: (id: string) => leggiScheda(f, id),
    categorie: () => leggiCategorie(f),
    interruttori: () => leggiInterruttori(f),
  };
}

export { oraHHmm };
