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
import { eUuid, type Azione } from "./azioni";
import type { Ordine } from "./ordine";

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
