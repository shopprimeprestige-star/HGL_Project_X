/** ── GLI ORDINI DAL BROWSER: LETTURA E AZIONI SULLA ROTTA (client.ts) ────────
 *  Commessa 2026-11-17-crm-ecommerce, T10. Parla con `/api/crm/ordini` (T9) e decide TUTTO quello che si può
 *  decidere senza React: gli indirizzi, cosa significa ogni risposta, la frase da mostrare per ogni errore,
 *  quando rileggere. I due hook (`useOrdini`, `useOrdiniNuovi`) sono solo la colla.
 *
 *  Il modulo non importa niente del browser né del CRM: riceve `fetch` (nella pagina è `fetchCRM`, che
 *  attacca il gettone e lo rinnova) e le «porte» del tempo (scheda visibile, orologio, timer, segnali).
 *  Per questo si prova con risposte finte e un orologio a mano (prove/ecommerce/client.mjs).
 *
 *  ── ⚠️ COSA SI MOSTRA E COSA SI TIENE ────────────────────────────────────────
 *  Una lettura che fallisce NON svuota l'elenco: restano gli ordini dell'ultima lettura buona, con l'ora di
 *  quella lettura e l'errore accanto. Lo stesso per il numeretto del menu: tiene l'ultimo valore buono.
 *  ⚠️ `nessun_cambio` (200 con `ok:false`) non è un errore: l'ordine era già così, non c'è niente da fare.
 *  ⚠️ Una lettura partita PRIMA di un'azione e arrivata DOPO viene scartata: porterebbe l'ordine indietro.
 *  ⚠️ Nessun log da qui, mai: gli ordini contengono nome, telefono e indirizzo dei clienti. */
import { eUuid, type Azione, type ChiaveEmailOrdine } from "./azioni";
import type { Ordine, StatoOrdine } from "./ordine";

const ROTTA = "/api/crm/ordini";
/** Ogni quanto si rilegge l'elenco mentre la scheda si guarda. */
export const RILEGGI_ORDINI_MS = 30_000;
/** Ogni quanto si rilegge il numeretto del menu mentre la scheda si guarda. */
export const RILEGGI_NUOVI_MS = 60_000;
/** Tornare sulla scheda e ritrovare la rete arrivano spesso insieme: due letture più vicine di così sono la stessa. */
const MINIMO_FRA_LETTURE_MS = 5_000;
const MAX_SCHEDE = 20; // come la rotta
/** Un numeretto oltre questo non è credibile. shortcut: tetto fisso, da alzare se il negozio supera il milione di ordini nuovi. */
const NUOVI_MAX = 1_000_000;
const MAX_MESSAGGIO = 300;
/** Oltre questo una richiesta senza risposta (rete caduta a metà) è «rete»: senza tetto il giro delle letture resterebbe appeso. */
const TETTO_RICHIESTA_MS = 20_000;

/* ══ GLI INDIRIZZI ══════════════════════════════════════════════════════════ */

export const urlElenco = (): string => ROTTA;
export const urlConta = (): string => `${ROTTA}?conta=1`;
/** `null` se l'id non è un UUID: l'indirizzo sbagliato non parte nemmeno. */
export const urlStorico = (id: string): string | null =>
  eUuid(id) ? `${ROTTA}?storico=${id}` : null;
/** Gli ordini di 1-20 schede (per il riquadro nella scheda lead). `null` se anche uno solo non è un UUID. */
export const urlLead = (ids: string[]): string | null =>
  ids.length >= 1 && ids.length <= MAX_SCHEDE && ids.every(eUuid)
    ? `${ROTTA}?lead=${ids.join(",")}`
    : null;

/* ══ GLI ERRORI ═════════════════════════════════════════════════════════════ */

export type TipoErrore =
  | "sessione" //   401: non so chi sei → rientra
  | "permesso" //   403: so chi sei, e non puoi → chiedi a un amministratore
  | "conflitto" //  409: l'ordine è cambiato nel frattempo
  | "migrazione" // 409: mancano le colonne di M1
  | "valore" //     400: la richiesta non è valida
  | "non_trovato" // 404
  | "server" //     500, o una risposta che non si capisce
  | "rete"; //      la richiesta non è arrivata
export interface ErroreOrdini {
  tipo: TipoErrore;
  messaggio: string;
}

const FRASI: Record<TipoErrore, string> = {
  sessione: "La sessione è scaduta: rientra nel CRM.",
  permesso: "Il tuo utente non può gestire gli ordini e-commerce: chiedi a un amministratore.",
  conflitto: "L'ordine è stato modificato da qualcun altro: aggiorna e riprova.",
  migrazione:
    "Mancano gli aggiornamenti del database: chiedi a chi gestisce il database di applicare l'aggiornamento degli ordini.",
  valore: "La richiesta non è valida: controlla i dati e riprova.",
  non_trovato: "Ordine non trovato.",
  server: "Qualcosa non ha funzionato: riprova tra un momento.",
  rete: "Non riesco a collegarmi al server: controlla la connessione e riprova.",
};
/** Le frasi che la rotta scrive da sé (senza dati dei clienti) si mostrano; per 401 e 403 e per il resto valgono le nostre. */
const CON_FRASE_DELLA_ROTTA: readonly TipoErrore[] = [
  "valore",
  "conflitto",
  "migrazione",
  "non_trovato",
  "server",
];
const DA_CODICE: Record<string, TipoErrore> = {
  migrazione: "migrazione",
  conflitto: "conflitto",
  valore: "valore",
  azione_sconosciuta: "valore",
  non_trovato: "non_trovato",
};

const eOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const errore = (tipo: TipoErrore, messaggio = FRASI[tipo]): ErroreOrdini => ({ tipo, messaggio });

function erroreDaRisposta(stato: number, corpo: Record<string, unknown> | null): ErroreOrdini {
  if (stato === 401) return errore("sessione");
  if (stato === 403) return errore("permesso");
  const tipo = DA_CODICE[String(corpo?.error)] ?? (stato === 404 ? "non_trovato" : "server");
  const frase = corpo?.messaggio;
  if (CON_FRASE_DELLA_ROTTA.includes(tipo) && typeof frase === "string" && frase.trim())
    return errore(tipo, frase.trim().slice(0, MAX_MESSAGGIO));
  return errore(tipo);
}

/* ══ LA CHIAMATA ════════════════════════════════════════════════════════════ */

/** La `fetch` della pagina (`fetchCRM`): stessa firma di `fetch`. */
export type FetchRotta = (url: string, init?: RequestInit) => Promise<Response>;
type Grezza = { corpo: Record<string, unknown> } | { errore: ErroreOrdini };

/** Una richiesta: o il corpo di una risposta buona, o l'errore già tradotto. Non lancia mai. */
async function chiama(f: FetchRotta, url: string, init?: RequestInit): Promise<Grezza> {
  let r: Response;
  try {
    //  `fetchCRM` riusa lo stesso `init` nel secondo tentativo dopo un 401: il tetto vale per tutta la chiamata
    const tetto =
      typeof AbortSignal.timeout === "function"
        ? { signal: AbortSignal.timeout(TETTO_RICHIESTA_MS) }
        : {};
    r = await f(url, { ...init, ...tetto });
  } catch {
    return { errore: errore("rete") }; // mai il testo del browser: può nominare l'indirizzo o il numero
  }
  let corpo: unknown = null;
  try {
    corpo = await r.json();
  } catch {
    // una pagina d'errore dell'hosting, un corpo vuoto: resta solo lo stato HTTP
  }
  const o = eOggetto(corpo) ? corpo : null;
  if (r.ok && o && (o.ok === true || o.error === "nessun_cambio")) return { corpo: o };
  return { errore: erroreDaRisposta(r.ok ? 500 : r.status, o) };
}

export type RisultatoElenco =
  | {
      ok: true;
      ordini: Ordine[];
      scartati: number;
      troncato: boolean;
      migrazionePronta: boolean;
      adesso: string;
    }
  | { ok: false; errore: ErroreOrdini };

/** L'elenco degli ordini (o, con `url` di `urlLead`, di alcune schede). */
export async function leggiElenco(
  f: FetchRotta,
  url: string = urlElenco(),
): Promise<RisultatoElenco> {
  const g = await chiama(f, url);
  if ("errore" in g) return { ok: false, errore: g.errore };
  const { corpo } = g;
  if (!Array.isArray(corpo.ordini)) return { ok: false, errore: errore("server") };
  return {
    ok: true,
    ordini: corpo.ordini as Ordine[], // già normalizzati dalla rotta (ordine.ts)
    scartati: typeof corpo.scartati === "number" ? corpo.scartati : 0,
    troncato: corpo.troncato === true,
    migrazionePronta: eOggetto(corpo.migrazione) && corpo.migrazione.pronta === true,
    adesso: typeof corpo.adesso === "string" ? corpo.adesso : "",
  };
}

export type RisultatoConta = { ok: true; nuovi: number } | { ok: false; errore: ErroreOrdini };

export async function leggiConta(f: FetchRotta): Promise<RisultatoConta> {
  const g = await chiama(f, urlConta());
  if ("errore" in g) return { ok: false, errore: g.errore };
  const n = g.corpo.nuovi;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > NUOVI_MAX)
    return { ok: false, errore: errore("server") };
  return { ok: true, nuovi: n };
}

export interface EventoStorico {
  id: string;
  creatoIl: string;
  tipo: string;
  chi: string;
  prima: Record<string, unknown>;
  dopo: Record<string, unknown>;
}
export type RisultatoStorico =
  | { ok: true; eventi: EventoStorico[]; migrazionePronta: boolean }
  | { ok: false; errore: ErroreOrdini };

export async function leggiStorico(f: FetchRotta, ordineId: string): Promise<RisultatoStorico> {
  const url = urlStorico(ordineId);
  if (!url) return { ok: false, errore: errore("valore") };
  const g = await chiama(f, url);
  if ("errore" in g) return { ok: false, errore: g.errore };
  return {
    ok: true,
    eventi: Array.isArray(g.corpo.eventi) ? (g.corpo.eventi as EventoStorico[]) : [],
    migrazionePronta: eOggetto(g.corpo.migrazione) && g.corpo.migrazione.pronta === true,
  };
}

/** `nessunCambio`: l'ordine era già così (200 con `ok:false`), non c'è stato niente da scrivere e niente da dire. `storico:false`: l'ordine è scritto ma la riga dello storico no → la pagina avvisa. */
export type RisultatoAzione =
  | { ok: true; nessunCambio: false; ordine: Ordine; storico: boolean }
  | { ok: true; nessunCambio: true }
  | { ok: false; errore: ErroreOrdini };

export async function eseguiAzione(f: FetchRotta, azione: Azione): Promise<RisultatoAzione> {
  const g = await chiama(f, ROTTA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(azione),
  });
  if ("errore" in g) {
    //  Se la richiesta non è arrivata non si sa se la modifica sia stata scritta: lo si dice.
    return g.errore.tipo === "rete"
      ? {
          ok: false,
          errore: errore(
            "rete",
            "Non so se la modifica sia stata salvata: controlla la connessione, aggiorna l'elenco e ricontrolla l'ordine.",
          ),
        }
      : { ok: false, errore: g.errore };
  }
  if (g.corpo.ok !== true) return { ok: true, nessunCambio: true };
  const o = g.corpo.ordine;
  if (!eOggetto(o) || typeof o.id !== "string") return { ok: false, errore: errore("server") };
  return {
    ok: true,
    nessunCambio: false,
    ordine: o as unknown as Ordine,
    storico: g.corpo.storico !== false,
  };
}

/* ══ PICCOLI AIUTI ══════════════════════════════════════════════════════════ */

/** L'elenco con quell'ordine sostituito (stessa posizione). Se l'ordine non c'è si restituisce lo stesso elenco: la prossima lettura lo porterà. */
export function applicaOrdine(elenco: Ordine[], nuovo: Ordine): Ordine[] {
  const i = elenco.findIndex((o) => o.id === nuovo.id);
  if (i < 0) return elenco;
  const copia = elenco.slice();
  copia[i] = nuovo;
  return copia;
}

/** «ultimo aggiornamento hh:mm», in ora del browser. */
export function oraHHmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ══ IL LETTORE: QUANDO RILEGGERE ═══════════════════════════════════════════ */

/** Tutto ciò che il lettore chiede al browser, così si prova con un orologio a mano. */
export interface PorteTempo {
  /** la scheda si vede */
  visibile(): boolean;
  /** millisecondi */
  adesso(): number;
  imposta(fn: () => void, ms: number): unknown;
  annulla(h: unknown): void;
  /** segnali «forse conviene rileggere» (scheda di nuovo visibile, pagina ripresa, rete tornata); restituisce il modo di smettere */
  ascolta(fn: () => void): () => void;
}

export function porteBrowser(doc?: Document, win?: Window): PorteTempo {
  //  Le pagine si disegnano anche sul server: `document` e `window` si toccano solo quando serve.
  const D = () => doc ?? document;
  const W = () => win ?? window;
  return {
    visibile: () => D().visibilityState === "visible",
    adesso: () => Date.now(),
    imposta: (fn, ms) => setTimeout(fn, ms),
    annulla: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    ascolta: (fn) => {
      D().addEventListener("visibilitychange", fn);
      W().addEventListener("pageshow", fn);
      W().addEventListener("online", fn);
      return () => {
        D().removeEventListener("visibilitychange", fn);
        W().removeEventListener("pageshow", fn);
        W().removeEventListener("online", fn);
      };
    },
  };
}

/** ── LA REGOLA ────────────────────────────────────────────────────────────────
 *  - Si legge subito all'avvio e poi `ogniMs` DOPO la fine di ogni lettura: una catena di timer, uno alla volta,
 *    quindi due letture non si sovrappongono mai (nemmeno con la rete lenta).
 *  - Scheda nascosta: il timer scatta, non chiede niente e NON si riarma. Nessuna richiesta, nessun timer acceso.
 *  - Scheda di nuovo visibile / pagina ripresa / rete tornata: si rilegge subito, se l'ultima lettura è di più di 5 s fa.
 *  - Accesso negato (403, o 401 dopo il tentativo già fatto da `fetchCRM`): `leggi` restituisce `false`, il timer non si
 *    riarma; si riparte con «Aggiorna» o tornando sulla scheda (dopo più di 5 s).
 *  - `aggiorna()` (il tasto «Aggiorna») legge sempre, anche se la scheda risulta nascosta; con una lettura già in
 *    corso restituisce quella. */
export function creaLettore(opz: {
  ogniMs: number;
  /** `false` = non riarmare il timer (accesso negato: insistere è inutile); ogni altro esito = si continua */
  leggi: () => Promise<boolean | void>;
  porte: PorteTempo;
}) {
  const { ogniMs, leggi, porte } = opz;
  let fermato = true;
  let inCorso: Promise<void> | null = null;
  let timer: unknown = null;
  let ultima = -Infinity;
  let sospeso = false; // l'ultima lettura ha detto «non riarmare»: si riparte con `aggiorna` o tornando sulla scheda
  let smetti: () => void = () => {};

  const pianifica = () => {
    if (fermato) return;
    if (timer !== null) porte.annulla(timer);
    timer = porte.imposta(alTimer, ogniMs);
  };
  const leggiOra = (): Promise<void> => {
    if (inCorso) return inCorso;
    ultima = porte.adesso();
    sospeso = false;
    inCorso = (async () => {
      try {
        sospeso = (await leggi()) === false;
      } catch {
        // il giro non si ferma per una lettura andata male; niente log (dati dei clienti)
      } finally {
        inCorso = null;
        if (!sospeso) pianifica();
      }
    })();
    return inCorso;
  };
  function alTimer() {
    timer = null;
    if (porte.visibile()) void leggiOra();
  }
  const alSegnale = () => {
    if (fermato || !porte.visibile()) return;
    if (porte.adesso() - ultima >= MINIMO_FRA_LETTURE_MS) void leggiOra();
    else if (timer === null && !inCorso && !sospeso) pianifica();
  };

  return {
    avvia() {
      if (!fermato) return;
      fermato = false;
      smetti = porte.ascolta(alSegnale);
      if (porte.visibile()) void leggiOra();
    },
    ferma() {
      fermato = true;
      if (timer !== null) porte.annulla(timer);
      timer = null;
      smetti();
    },
    aggiorna: leggiOra,
  };
}

/** 403, o 401 che arriva dopo il tentativo già fatto da `fetchCRM`: riprovare ogni 30 s non serve a niente. */
const eAccessoNegato = (e: ErroreOrdini): boolean => e.tipo === "permesso" || e.tipo === "sessione";

/* ══ L'ARCHIVIO DEGLI ORDINI (quello che la pagina legge) ═══════════════════ */

export interface StatoOrdini {
  ordini: Ordine[];
  /** c'è stata almeno una lettura buona */
  caricato: boolean;
  /** non c'è ancora niente da mostrare (prima lettura in corso) */
  inCaricamento: boolean;
  /** una lettura è in corso (anche quelle automatiche) */
  inAggiornamento: boolean;
  /** l'errore dell'ULTIMA lettura; gli ordini sono quelli dell'ultima lettura buona */
  errore: ErroreOrdini | null;
  /** righe della tabella non leggibili (da dichiarare in pagina) */
  scartati: number;
  troncato: boolean;
  /** `null` finché non si è letto */
  migrazionePronta: boolean | null;
  /** quando (ms) è finita l'ultima lettura buona; `oraHHmm` lo scrive */
  ultimoAggiornamento: number | null;
}

const STATO_INIZIALE: StatoOrdini = {
  ordini: [],
  caricato: false,
  inCaricamento: true,
  inAggiornamento: false,
  errore: null,
  scartati: 0,
  troncato: false,
  migrazionePronta: null,
  ultimoAggiornamento: null,
};

/** Un piccolo «negozio» di stato fuori da React: `useOrdini` lo legge con `useSyncExternalStore`. */
export function creaArchivioOrdini(opz: { fetch: FetchRotta; porte: PorteTempo }) {
  const { fetch: f, porte } = opz;
  let stato = STATO_INIZIALE;
  let versione = 0; // sale a ogni azione riuscita
  let ascoltatori: Array<() => void> = [];
  const imposta = (p: Partial<StatoOrdini>) => {
    stato = { ...stato, ...p };
    ascoltatori.forEach((fn) => fn());
  };

  const leggi = async () => {
    imposta({ inAggiornamento: true });
    let r: RisultatoElenco;
    //  Una lettura partita prima di un'azione e arrivata dopo porterebbe l'ordine indietro: si scarta e si rilegge
    //  subito. Si ripete solo se nel frattempo è riuscita un'altra azione (ogni azione sale di una versione).
    for (;;) {
      const v = versione;
      r = await leggiElenco(f);
      if (v === versione) break;
    }
    if (!r.ok) {
      //  Senza permesso (o senza sessione) gli ordini già letti non devono restare a schermo.
      const negato = eAccessoNegato(r.errore);
      imposta({
        errore: r.errore,
        inCaricamento: false,
        inAggiornamento: false,
        ...(negato && {
          ordini: [],
          caricato: false,
          ultimoAggiornamento: null,
          scartati: 0,
          troncato: false,
        }),
      });
      return !negato;
    }
    imposta({
      ordini: r.ordini,
      caricato: true,
      inCaricamento: false,
      inAggiornamento: false,
      errore: null,
      scartati: r.scartati,
      troncato: r.troncato,
      migrazionePronta: r.migrazionePronta,
      ultimoAggiornamento: porte.adesso(),
    });
  };
  const lettore = creaLettore({ ogniMs: RILEGGI_ORDINI_MS, leggi, porte });

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
    /** Esegue un'azione; se riesce l'ordine cambia nell'elenco senza rileggerlo tutto. Il risultato va letto dalla pagina (`storico:false`, errori). */
    async esegui(azione: Azione): Promise<RisultatoAzione> {
      const r = await eseguiAzione(f, azione);
      if (r.ok && !r.nessunCambio) {
        versione++;
        imposta({ ordini: applicaOrdine(stato.ordini, r.ordine) });
      } else if (!r.ok && ["conflitto", "non_trovato", "migrazione", "permesso", "sessione"].includes(r.errore.tipo)) {
        //  L'elenco non è più quello che la pagina credeva: si rilegge da soli. La versione sale perché una lettura già
        //  in volo può essere partita PRIMA della modifica dell'altro: si scarta e se ne fa una nuova.
        versione++;
        void lettore.aggiorna();
      }
      return r;
    },
    storico: (ordineId: string) => leggiStorico(f, ordineId),
  };
}

/* ══ IL NUMERETTO DEL MENU ══════════════════════════════════════════════════ */

/** `?conta=1` all'apertura e ogni 60 s a scheda visibile; `alCambio` riceve solo valori buoni (un guasto non azzera). Con `attivo` falso non fa niente. Restituisce il modo di fermarsi. */
export function avviaConta(opz: {
  attivo: boolean;
  fetch: FetchRotta;
  porte: PorteTempo;
  alCambio: (nuovi: number) => void;
}): () => void {
  if (!opz.attivo) return () => {};
  const lettore = creaLettore({
    ogniMs: RILEGGI_NUOVI_MS,
    porte: opz.porte,
    leggi: async () => {
      const r = await leggiConta(opz.fetch);
      if (r.ok) opz.alCambio(r.nuovi);
      else return !eAccessoNegato(r.errore);
    },
  });
  lettore.avvia();
  return lettore.ferma;
}

/* ══ RILASCIO 2 (T61): IL DETTAGLIO E LE OTTO AZIONI NUOVE ═══════════════════
 *  Tutto ciò che sta sotto è nuovo: le funzioni di sopra non cambiano. Parla con `?dettaglio=` e con le azioni di D55
 *  (`spedisci`, `annulla`, `rimborso`, `riconcilia`, `fattura_emessa`, `email_invia`, `giacenza_verificata`, `correggi_stato`).
 *  ⚠️ Il dettaglio porta i dati riservati (fattura, consensi): si legge SOLO a pannello aperto e si toglie dalla memoria alla chiusura.
 *  ⚠️ Una POST parte una volta sola: un 409, una rete caduta, un guasto NON la rimandano. Si rilegge il dettaglio (una GET) e decide la persona.
 *  ⚠️ `chiaveRichiesta` nasce quando si apre il dialogo e non cambia fino alla chiusura: premere due volte è la STESSA richiesta (il server la riconosce).
 *  Nessuna chiamata senza il permesso: la «porta» `permesso` si chiede a ogni chiamata, non una volta sola. Il rifiuto vero lo dà comunque la rotta. */

export type EsitoEffettoRisposta = "fatto" | "in_corso" | "non_riuscito";
/** Voce per voce com'è andato ciò che l'azione ha chiesto al server (rimborso, magazzino, Stripe, email). `in_corso`: non ripetere. */
export interface EffettoRisposta {
  tipo: string;
  esito: EsitoEffettoRisposta;
  frase: string;
}
export interface EmailRisposta {
  chiave: string;
  stato: string;
  frase: string;
}
export type RisultatoAzioneR2 =
  | { ok: true; nessunCambio: true }
  | {
      ok: true;
      nessunCambio: false;
      ordine: Ordine;
      /** `false`: l'ordine è scritto ma la riga di storico no → la pagina avvisa */
      storico: boolean;
      effetti: EffettoRisposta[];
      email: EmailRisposta | null;
      avvisi: string[];
    }
  | { ok: false; errore: ErroreOrdini };

export interface RimborsoDettaglio {
  id: string;
  importoCent: number;
  stato: string;
  motivo: string;
  origine: string;
  chi: string;
  creatoIl: string;
  aggiornatoIl: string;
  stripeRimborsoId: string | null;
}
export interface EmailDettaglio {
  chiave: string;
  stato: string;
  il: string | null;
  codice: string | null;
}
export interface DettaglioOrdine {
  ordine: Ordine;
  /** I dati fiscali e i consensi: solo qui, mai nella lista. `null` = il server non ha potuto leggerli. */
  riservati: { fattura: unknown; consensi: unknown } | null;
  /** `null` = non si sono potuti leggere (diverso da «nessun rimborso», che è `[]`) */
  rimborsi: RimborsoDettaglio[] | null;
  email: EmailDettaglio[];
  storico: EventoStorico[] | null;
  avvisi: string[];
  migrazione: { pronta: boolean; pagamenti: boolean };
}
export type RisultatoDettaglio =
  | { ok: true; dettaglio: DettaglioOrdine }
  | { ok: false; errore: ErroreOrdini };

/** `null` se l'id non è un UUID: l'indirizzo sbagliato non parte nemmeno. */
export const urlDettaglio = (id: string): string | null =>
  eUuid(id) ? `${ROTTA}?dettaglio=${id}` : null;

const comeTesto = (v: unknown): string | null => (typeof v === "string" ? v : null);
const elencoDi = <T>(v: unknown, vale: (x: Record<string, unknown>) => boolean): T[] | null =>
  Array.isArray(v) ? (v.filter((x) => eOggetto(x) && vale(x)) as T[]) : null;

export async function leggiDettaglio(f: FetchRotta, ordineId: string): Promise<RisultatoDettaglio> {
  const url = urlDettaglio(ordineId);
  if (!url) return { ok: false, errore: errore("valore") };
  const g = await chiama(f, url);
  if ("errore" in g) return { ok: false, errore: g.errore };
  const { corpo } = g;
  //  Un ordine diverso da quello chiesto non si mostra: sarebbe il dettaglio di un altro cliente.
  if (!eOggetto(corpo.ordine) || corpo.ordine.id !== ordineId)
    return { ok: false, errore: errore("server") };
  const rim = eOggetto(corpo.riservati) ? corpo.riservati : null;
  const mig = eOggetto(corpo.migrazione) ? corpo.migrazione : {};
  return {
    ok: true,
    dettaglio: {
      ordine: corpo.ordine as unknown as Ordine,
      riservati: rim && { fattura: rim.fattura ?? null, consensi: rim.consensi ?? null },
      rimborsi: elencoDi<RimborsoDettaglio>(corpo.rimborsi, (x) => typeof x.id === "string"),
      email: elencoDi<EmailDettaglio>(corpo.email, (x) => typeof x.chiave === "string") ?? [],
      storico: elencoDi<EventoStorico>(corpo.storico, (x) => typeof x.id === "string"),
      avvisi: Array.isArray(corpo.avvisi)
        ? corpo.avvisi.filter((a): a is string => typeof a === "string")
        : [],
      migrazione: { pronta: mig.pronta === true, pagamenti: mig.pagamenti === true },
    },
  };
}

/* ── le azioni: una funzione ciascuna ────────────────────────────────────── */

const ESITI_EFFETTO: readonly string[] = ["fatto", "in_corso", "non_riuscito"];
function effettiDi(v: unknown): EffettoRisposta[] {
  return (
    elencoDi<EffettoRisposta>(
      v,
      (x) =>
        typeof x.tipo === "string" &&
        typeof x.frase === "string" &&
        ESITI_EFFETTO.includes(String(x.esito)),
    ) ?? []
  ).map(({ tipo, esito, frase }) => ({ tipo, esito, frase }));
}
const FRASE_RETE_AZIONE =
  "Non so se la modifica sia stata salvata: controlla la connessione, aggiorna l'elenco e ricontrolla l'ordine.";

/** Una POST, una volta sola. Non lancia mai e non ritenta mai. */
async function inviaAzione(
  f: FetchRotta,
  ordineId: string,
  corpo: Record<string, unknown>,
): Promise<RisultatoAzioneR2> {
  if (!eUuid(ordineId))
    return { ok: false, errore: errore("valore", "L'ordine indicato non è valido.") };
  const g = await chiama(f, ROTTA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if ("errore" in g)
    return {
      ok: false,
      errore: g.errore.tipo === "rete" ? errore("rete", FRASE_RETE_AZIONE) : g.errore,
    };
  if (g.corpo.ok !== true) return { ok: true, nessunCambio: true };
  const o = g.corpo.ordine;
  if (!eOggetto(o) || typeof o.id !== "string") return { ok: false, errore: errore("server") };
  const em = eOggetto(g.corpo.email) ? g.corpo.email : null;
  return {
    ok: true,
    nessunCambio: false,
    ordine: o as unknown as Ordine,
    storico: g.corpo.storico !== false,
    effetti: effettiDi(g.corpo.effetti),
    email:
      em &&
      typeof em.chiave === "string" &&
      typeof em.stato === "string" &&
      typeof em.frase === "string"
        ? { chiave: em.chiave, stato: em.stato, frase: em.frase }
        : null,
    avvisi: Array.isArray(g.corpo.avvisi)
      ? g.corpo.avvisi.filter((a): a is string => typeof a === "string")
      : [],
  };
}

export interface DatiSpedisci {
  ordineId: string;
  corriere?: string;
  numero?: string;
  senzaTracking?: boolean;
}
export const spedisci = (f: FetchRotta, d: DatiSpedisci) =>
  inviaAzione(f, d.ordineId, {
    azione: "spedisci",
    ordineId: d.ordineId,
    corriere: d.corriere,
    numero: d.numero,
    senzaTracking: d.senzaTracking,
  });

export interface DatiAnnulla {
  ordineId: string;
  motivo: string;
  rimborso?: "ora" | "nessuno";
  rimettiInMagazzino?: boolean;
  /** serve con `rimborso: "ora"`: quella del dialogo (`apriDialogo`) */
  chiaveRichiesta?: string;
}
export const annulla = (f: FetchRotta, d: DatiAnnulla) =>
  inviaAzione(f, d.ordineId, {
    azione: "annulla",
    ordineId: d.ordineId,
    motivo: d.motivo,
    rimborso: d.rimborso,
    rimettiInMagazzino: d.rimettiInMagazzino,
    chiaveRichiesta: d.chiaveRichiesta,
  });

export interface DatiRimborso {
  ordineId: string;
  importoCent: number;
  motivo: string;
  chiaveRichiesta: string;
  /** Il clic esplicito sul dialogo: senza `true` non parte niente. */
  conferma: true;
}
export const rimborso = (f: FetchRotta, d: DatiRimborso) =>
  d.conferma !== true
    ? Promise.resolve<RisultatoAzioneR2>({
        ok: false,
        errore: errore("valore", "Conferma il rimborso per procedere."),
      })
    : inviaAzione(f, d.ordineId, {
        azione: "rimborso",
        ordineId: d.ordineId,
        importoCent: d.importoCent,
        motivo: d.motivo,
        chiaveRichiesta: d.chiaveRichiesta,
        conferma: true,
      });

export const riconcilia = (f: FetchRotta, d: { ordineId: string }) =>
  inviaAzione(f, d.ordineId, { azione: "riconcilia", ordineId: d.ordineId });

export const fatturaEmessa = (f: FetchRotta, d: { ordineId: string; nota?: string }) =>
  inviaAzione(f, d.ordineId, { azione: "fattura_emessa", ordineId: d.ordineId, nota: d.nota });

export const emailInvia = (f: FetchRotta, d: { ordineId: string; chiave: ChiaveEmailOrdine }) =>
  inviaAzione(f, d.ordineId, { azione: "email_invia", ordineId: d.ordineId, chiave: d.chiave });

export const giacenzaVerificata = (f: FetchRotta, d: { ordineId: string }) =>
  inviaAzione(f, d.ordineId, { azione: "giacenza_verificata", ordineId: d.ordineId });

export const correggiStato = (
  f: FetchRotta,
  d: { ordineId: string; da: StatoOrdine; a: StatoOrdine; motivo: string },
) =>
  inviaAzione(f, d.ordineId, {
    azione: "correggi_stato",
    ordineId: d.ordineId,
    da: d.da,
    a: d.a,
    motivo: d.motivo,
  });

/** Un UUID v4 nuovo. shortcut: senza `crypto.randomUUID` (pagine non sicure) si costruisce da `getRandomValues`; da togliere se il CRM sarà sempre https. */
export function nuovaChiaveRichiesta(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ══ L'ARCHIVIO DEL DETTAGLIO (quello che il pannello legge) ════════════════ */

export interface StatoDettaglio {
  /** l'ordine del pannello aperto; `null` = pannello chiuso (e niente in memoria) */
  ordineId: string | null;
  dettaglio: DettaglioOrdine | null;
  /** prima lettura in corso (nessun dettaglio ancora da mostrare) */
  inCaricamento: boolean;
  /** l'errore dell'ULTIMA lettura o azione; il dettaglio è quello dell'ultima lettura buona */
  errore: ErroreOrdini | null;
  /** un'azione è partita e non è ancora finita: il bottone si disabilita */
  inInvio: boolean;
}
const STATO_DETTAGLIO_INIZIALE: StatoDettaglio = {
  ordineId: null,
  dettaglio: null,
  inCaricamento: false,
  errore: null,
  inInvio: false,
};

export function creaArchivioDettaglio(opz: {
  fetch: FetchRotta;
  /** Si chiede a ogni chiamata. Falso = nessuna richiesta, errore «permesso». */
  permesso: () => boolean;
  /** Per le prove. */
  generaChiave?: () => string;
}) {
  const { fetch: f, permesso } = opz;
  const genera = opz.generaChiave ?? nuovaChiaveRichiesta;
  let stato = STATO_DETTAGLIO_INIZIALE;
  let ascoltatori: Array<() => void> = [];
  let lettura = 0; // sale a ogni apri/chiudi: una risposta arrivata dopo non vale più
  let inInvio = false;
  const imposta = (p: Partial<StatoDettaglio>) => {
    stato = { ...stato, ...p };
    ascoltatori.forEach((fn) => fn());
  };
  const negato = (): ErroreOrdini => errore("permesso");

  /** Legge l'ordine aperto. Una risposta di un'apertura vecchia (o dopo `chiudi`) si butta. */
  async function carica(): Promise<void> {
    const id = stato.ordineId;
    if (!id) return;
    const mia = lettura;
    const r = await leggiDettaglio(f, id);
    if (mia !== lettura) return;
    if (r.ok) return imposta({ dettaglio: r.dettaglio, inCaricamento: false, errore: null });
    //  Senza permesso (o sessione) i dati riservati già letti non devono restare in memoria.
    imposta({
      errore: r.errore,
      inCaricamento: false,
      ...(eAccessoNegato(r.errore) || r.errore.tipo === "non_trovato" ? { dettaglio: null } : {}),
    });
  }

  const apri = async (ordineId: string): Promise<void> => {
    const mia = ++lettura;
    if (!permesso())
      return imposta({ ordineId: null, dettaglio: null, inCaricamento: false, errore: negato() });
    if (!eUuid(ordineId))
      return imposta({
        ordineId: null,
        dettaglio: null,
        inCaricamento: false,
        errore: errore("valore"),
      });
    imposta({
      ordineId,
      dettaglio: ordineId === stato.ordineId ? stato.dettaglio : null,
      inCaricamento: true,
      errore: null,
    });
    if (mia === lettura) await carica();
  };
  const ricarica = async (): Promise<void> => {
    if (!stato.ordineId) return;
    if (!permesso()) return imposta({ dettaglio: null, inCaricamento: false, errore: negato() });
    await carica();
  };
  const chiudi = () => {
    lettura++;
    imposta({ ...STATO_DETTAGLIO_INIZIALE, inInvio });
  };

  /** Lancia UN'azione sull'ordine aperto: una alla volta, mai due insieme. Dopo, rilegge il dettaglio (una GET): mai una seconda POST. */
  async function lancia(
    fa: (ordineId: string) => Promise<RisultatoAzioneR2>,
    //  `per`: l'ordine che c'era quando si è aperto il dialogo (solo per le azioni dei dialoghi).
    //  `rileggiSuValore`: il server risponde «valore» anche dopo aver scritto una riga (rimborso rifiutato da Stripe, riconciliazione fallita): si rilegge.
    opz: { per?: string | null; rileggiSuValore?: boolean } = {},
  ): Promise<RisultatoAzioneR2> {
    if (!permesso()) return { ok: false, errore: negato() };
    const id = stato.ordineId;
    if (!id) return { ok: false, errore: errore("valore", "Nessun ordine aperto.") };
    //  Un dialogo scritto per l'ordine A non parte sull'ordine B (nemmeno se il pannello è passato da A a B con il dialogo ancora montato).
    if ("per" in opz && opz.per !== id)
      return {
        ok: false,
        errore: errore("valore", "Il dialogo era di un altro ordine: chiudilo e riaprilo."),
      };
    if (inInvio)
      return {
        ok: false,
        errore: errore("valore", "Un'altra operazione è ancora in corso: attendi che finisca."),
      };
    inInvio = true;
    imposta({ inInvio: true });
    let r: RisultatoAzioneR2;
    try {
      r = await fa(id);
    } finally {
      inInvio = false;
      imposta({ inInvio: false });
    }
    if (r.ok && !r.nessunCambio && stato.ordineId === id && stato.dettaglio)
      imposta({ dettaglio: { ...stato.dettaglio, ordine: r.ordine } });
    if (!r.ok && eAccessoNegato(r.errore)) imposta({ dettaglio: null, errore: r.errore });
    else if (r.ok || r.errore.tipo !== "valore" || opz.rileggiSuValore) void ricarica();
    return r;
  }

  return {
    stato: () => stato,
    iscrivi(fn: () => void) {
      ascoltatori = [...ascoltatori, fn];
      return () => {
        ascoltatori = ascoltatori.filter((x) => x !== fn);
      };
    },
    apri,
    ricarica,
    chiudi,
    spedisci: (d: Omit<DatiSpedisci, "ordineId">) =>
      lancia((ordineId) => spedisci(f, { ordineId, ...d })),
    riconcilia: () => lancia((ordineId) => riconcilia(f, { ordineId }), { rileggiSuValore: true }),
    fatturaEmessa: (d: { nota?: string }) =>
      lancia((ordineId) => fatturaEmessa(f, { ordineId, ...d })),
    emailInvia: (d: { chiave: ChiaveEmailOrdine }) =>
      lancia((ordineId) => emailInvia(f, { ordineId, ...d }), { rileggiSuValore: true }),
    giacenzaVerificata: () => lancia((ordineId) => giacenzaVerificata(f, { ordineId })),
    correggiStato: (d: { da: StatoOrdine; a: StatoOrdine; motivo: string }) =>
      lancia((ordineId) => correggiStato(f, { ordineId, ...d })),
    /** Si chiama UNA volta quando il dialogo si apre. La chiave nasce qui e resta la stessa per tutti gli invii di quel dialogo. */
    apriDialogo() {
      const chiaveRichiesta = genera();
      const per = stato.ordineId; // l'ordine di questo dialogo: se al momento dell'invio è un altro, non parte
      return {
        chiaveRichiesta,
        rimborso: (d: { importoCent: number; motivo: string; conferma: true }) =>
          lancia((ordineId) => rimborso(f, { ordineId, chiaveRichiesta, ...d }), {
            per,
            rileggiSuValore: true,
          }),
        annulla: (d: {
          motivo: string;
          rimborso: "ora" | "nessuno";
          rimettiInMagazzino: boolean;
        }) =>
          lancia((ordineId) => annulla(f, { ordineId, chiaveRichiesta, ...d }), {
            per,
            rileggiSuValore: true,
          }),
      };
    },
  };
}
