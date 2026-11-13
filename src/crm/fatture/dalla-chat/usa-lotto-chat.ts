/** ── FATTURE DALLA CHAT · L'ORCHESTRAZIONE NEL BROWSER (usa-lotto-chat.ts) ──
 *  Commessa 2026-11-13-fatture-dalla-chat, T7 (PIANO §2, §4). Parallelo a
 *  `bulk/usa-lotto.ts`: mette in fila aggiunta dei clienti → ricerca nella
 *  chat (coda, avanzamento) → caricamento+lettura del bonifico → azioni di
 *  riga → conferme in blocco → emissione una riga alla volta.
 *
 *  ── PERCHÉ NON SI RIUSA `ricomponi`/`valutaIlLotto` DELLA BULK ────────────
 *  Qui non ci sono file da ricomporre in gruppi: ogni `RigaChat` arriva dal
 *  server GIÀ completa (scheda nota dal passo 1, PIANO §0.1). Lo stato tiene
 *  direttamente `RigaChat[]`; la valutazione la dà SOLO `valutaLottoChat`
 *  (T3), mai ricalcolata qui dentro — stessa disciplina della bulk («il
 *  reducer non ricalcola mai niente»).
 *
 *  ── ⚠️ DUE INSIEMI DI SCHEDE, PER DUE SCOPI DIVERSI (decisione di T7) ─────
 *  `opzioni.contesto.schede` (`SchedaPerAbbinamento[]`) serve a `bulk/valuta.ts`
 *  (non toccato) per il confronto «CF diverso dalla scheda» — esattamente come
 *  nella bulk, costruito da chi monta l'hook (T8) con `schedaDaLead`, import,
 *  non copiato. `opzioni.schedeChat` (`Record<idRiga, SchedaChat>`) serve a
 *  `valutaLottoChat`/`rigaSinteticaDa` (T3) per forzare nome/cognome dalla
 *  scheda e confrontare l'importo del bonifico con quello già in scheda
 *  (`SchedaChat.importoScheda`, un fatto che SOLO questa modalità conosce,
 *  T3 §0.1 punto 3). Tenerle separate evita di legare questo hook al tipo
 *  `Lead`/`PaymentInfo` (lascia a T8 decidere come e quando calcolarla,
 *  stesso principio con cui T4 ha lasciato la cablatura vera a T5): se
 *  l'architetto preferisce un'unica mappa costruita qui da `leads`, è un
 *  cambio isolato a questo file (dubbio da lavagna).
 *
 *  ── ⚠️ `leggiRisposta`/`conRete` DI `bulk/usa-lotto.ts` NON SONO `export` ──
 *  Solo `ErroreRotta`/`fraseDi` lo sono (generici su `CodiceErrore`, riusati
 *  per import qui sotto); `chiamaRotta`/`leggiRotta` della bulk sono cablati
 *  sulla LORO rotta (`ROTTA` è usato dentro il corpo, non passato come
 *  parametro) e non si possono riusare per un endpoint diverso. Per questo
 *  qui c'è una copia minima, stessa logica, della sola lettura della risposta
 *  HTTP (non è plumbing fiscale, è lo stesso genere di duplicazione che T5 ha
 *  già scelto per `chat.server.ts` rispetto a `bulk.server.ts`, con lo stesso
 *  motivo: chiavi/contratto diversi, duplicarlo è la scelta giusta).
 *
 *  ── «OCCUPATO» ────────────────────────────────────────────────────────────
 *  Non si inventa nessuna logica qui: `eseguiCoda` (bulk/coda.ts, import, non
 *  toccata) già tratta `occupato` come «riprova fra poco» (non consuma i
 *  tentativi, non conta nel freno) — vale per `cerca-chat` (coda) e, avvolto
 *  in `unaVolta` (coda di un solo elemento, stesso schema di `rileggi` nella
 *  bulk), anche per `carica-pagamento`/`leggi-pagamento`/`rileggi-chat`.
 *
 *  ── RIPRESA DOPO UN RICARICAMENTO ─────────────────────────────────────────
 *  `apri(lotto)` rilegge dal server (`GET ?lotto=ID`): la verità sulle righe
 *  sta lì. `cercaNelleChat` salta da sola le righe già lette (`chat.letta`,
 *  `clientiDaCercare`, pura, provata) e quelle fallite in modo definitivo in
 *  QUESTA sessione (`troncata`/`illeggibile`, come `NON_SI_RIPAGANO` nella
 *  bulk): non si ripaga l'AI due volte per lo stesso cliente. */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { ErroreRotta, fraseDi, type RiepilogoEmissione } from "../bulk/usa-lotto";
import { eseguiCoda, ErroreCoda, codiceDaStato } from "../bulk/coda";
import { controllaFile, riduciImmagine, type ImmagineRidotta } from "../bulk/immagini";
import { ordineEmissione } from "../bulk/emissione-bulk";
import { valutaLottoChat, type SchedaChat } from "./valuta-chat";
import type {
  CampiRiga,
  CodiceErrore,
  ContestoValutazione,
  RigaValutata,
  RispostaErrore,
} from "../bulk/tipi";
import type {
  AzioneChat,
  DettaglioLottoChat,
  RichiestaChat,
  RigaChat,
  RispostaChat,
  SintesiLottoChat,
  TestataLottoChat,
} from "./tipi";

export const ROTTA = "/api/crm/fatture-chat";

/** Più basso che nella bulk (3): ogni cliente costa più sottorichieste di un
 *  gruppo-di-3-file (PIANO §4, T7). */
const IN_PARALLELO_CERCA = 2;

/** Stessi due codici della bulk: una lettura troncata o illeggibile non
 *  migliora da sola, si ripaga solo con un gesto esplicito («Rileggi»). */
const NON_SI_RIPAGANO: ReadonlySet<CodiceErrore> = new Set<CodiceErrore>([
  "troncata",
  "illeggibile",
]);

/** Stessi due codici generici della bulk (prodotti da `esaminaRiga`, non
 *  toccata): «ordine_diverso» non esiste qui (`gruppo.ordineDiverso` è sempre
 *  `false`, T3), quindi non è nell'elenco. */
export const AVVISI_PER_TUTTE: readonly string[] = ["data_anteriore", "oltre_12_giorni"];

/* ══ 1. LA CHIAMATA ALLA ROTTA ═════════════════════════════════════════════ */

type FetchRotta = (url: string, init?: RequestInit) => Promise<Response>;
type RispostaOkChat = Exclude<RispostaChat, RispostaErrore>;
type OkChat<A extends AzioneChat> = RispostaOkChat & { azione: A };

/** Stessa lettura della bulk (`leggiRisposta`, non esportata): ogni uscita
 *  storta diventa un `ErroreRotta` col suo codice. */
async function leggiRispostaHttp(r: Response): Promise<unknown> {
  let corpo: unknown;
  try {
    corpo = await r.json();
  } catch {
    const codice = r.ok ? "interno" : codiceDaStato(r.status);
    throw new ErroreRotta(codice, fraseDi(codice));
  }
  if (!r.ok || (corpo as RispostaErrore | null)?.ok === false) {
    const e = corpo as Partial<RispostaErrore> | null;
    const codice = e?.codice ?? codiceDaStato(r.status);
    throw new ErroreRotta(codice, fraseDi(codice, e?.messaggio));
  }
  return corpo;
}

async function conRete<T>(segnale: AbortSignal | undefined, f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (e instanceof ErroreCoda || segnale?.aborted) throw e;
    throw new ErroreRotta("rete", fraseDi("rete"));
  }
}

export function chiamaRottaChat<A extends AzioneChat>(
  fetchRotta: FetchRotta,
  richiesta: Extract<RichiestaChat, { azione: A }>,
  segnale?: AbortSignal,
): Promise<OkChat<A>> {
  return conRete(segnale, async () => {
    const r = await fetchRotta(ROTTA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(richiesta),
      signal: segnale,
    });
    return (await leggiRispostaHttp(r)) as OkChat<A>;
  });
}

export function leggiRottaChat<T>(
  fetchRotta: FetchRotta,
  parametri: string,
  segnale?: AbortSignal,
): Promise<T> {
  return conRete(
    segnale,
    async () =>
      (await leggiRispostaHttp(await fetchRotta(`${ROTTA}${parametri}`, { signal: segnale }))) as T,
  );
}

/* ══ 2. LE FUNZIONI PURE ═══════════════════════════════════════════════════ */

/** `SchedaChat` di riserva quando un `idRiga` non ha (ancora) una scheda nella
 *  mappa di chi chiama: nome/cognome vuoti, nessun importo noto — mai un
 *  lancio, la riga resta visibile con gli asterischi che le competono. */
export function schedaVuota(id: string): SchedaChat {
  return { id, nome: "", cognome: "", codiceFiscale: "", telefono: "", importoScheda: null };
}

/** Via 2 (T17, SPEC §9.3 passo 7): il CANCELLO di `scrivi-pagamento` — i 3 campi obbligatori
 *  (importo, data, modo) completi? Il riferimento resta l'unico facoltativo. `null` se uno dei
 *  3 manca: non vale la richiesta (disabilita il tasto). Il controllo di CONTENUTO vero
 *  (centesimi, giorno che esiste, modo ammesso) resta tutto a `pagamentoManualeValido`, lato
 *  server — un input che supera questo cancello ma non quello può ancora tornare
 *  `richiesta_non_valida`, mostrato onestamente dall'avviso già esistente (`stato.errore`).
 *  ⚠️ Accetta QUALUNQUE `{importo,data,modo,riferimento}`, non solo `CampiRiga`: dal correzione
 *  del revisore su T17 (`CampiRiga` si aggiorna solo DOPO il giro di rete dell'`onBlur`, mai
 *  come fonte per questo tasto — vedi `corpoPagamentoDaBozze` sotto, che è la fonte vera usata
 *  dal pannello). */
export function corpoPagamentoManuale(c: {
  importo: number | null;
  data: string;
  modo: string;
  riferimento: string;
}): { importo: number; data: string; modo: string; riferimento: string } | null {
  if (c.importo === null || !(c.importo > 0)) return null;
  if (!c.data) return null;
  if (!c.modo) return null;
  return { importo: c.importo, data: c.data, modo: c.modo, riferimento: c.riferimento };
}

/** Via 2 (T17, correzione dopo il DA RIFARE del revisore): la stessa cosa di sopra, ma a
 *  partire dalle BOZZE locali dei 4 campi — il testo scritto ad OGNI tasto nei campi
 *  (`onBozza`, `PannelloRigaChat.tsx`), non `CampiRiga` (`riga.campi`), che si aggiorna solo
 *  dopo che il giro di rete del salvataggio-per-campo (`onBlur`) è tornato. Il revisore aveva
 *  trovato una gara vera: scrivere il CRO e cliccare subito «Salva pagamento» spediva ancora il
 *  valore VECCHIO, perché il tasto leggeva `riga.campi` (non ancora aggiornato dalla fetch in
 *  corso). Leggendo le bozze invece di `CampiRiga`, il tasto vede sempre e SOLO quello che è
 *  scritto davvero nei campi in quel momento: la gara non può più esistere, per costruzione (non
 *  per tempismo). `leggiImporto` è `leggiImportoScritto` (bulk/PannelloRigaBulk.tsx), passata
 *  come parametro per non importare un file `.tsx` in questo modulo di sola orchestrazione. */
export function corpoPagamentoDaBozze(
  b: { importoTesto: string; data: string; modo: string; riferimento: string },
  leggiImporto: (
    s: string,
  ) => { ok: true; valore: number | null } | { ok: false; messaggio: string },
): { importo: number; data: string; modo: string; riferimento: string } | null {
  const letto = leggiImporto(b.importoTesto);
  return corpoPagamentoManuale({
    importo: letto.ok ? letto.valore : null,
    data: b.data,
    modo: b.modo,
    riferimento: b.riferimento,
  });
}

/** Quali clienti scelti (`schedaId`, = `idRiga`) vanno cercati: non quelli con
 *  una riga già chiusa, non quelli con la chat già letta (ripresa dopo un
 *  ricaricamento: non si ripaga l'AI due volte), non quelli falliti in modo
 *  definitivo in questa sessione (`daSaltare`, come `NON_SI_RIPAGANO`). Pura,
 *  provata a parte. */
export function clientiDaCercare(
  righe: readonly RigaChat[],
  schedaIds: readonly string[],
  daSaltare: ReadonlySet<string> = new Set(),
): string[] {
  const mappa = new Map(righe.map((r) => [r.idRiga, r]));
  return [...new Set(schedaIds)].filter((id) => {
    const r = mappa.get(id);
    return (!r || r.stato === "aperta") && !r?.chat?.letta && !daSaltare.has(id);
  });
}

/* ══ 3. LO STATO E IL REDUCER ══════════════════════════════════════════════ */

export type LavoroChat = "apertura" | "ricerca" | "pagamento" | "conferme" | "emissione";

export interface StatoLottoChat {
  lotto: string | null;
  testata: TestataLottoChat | null;
  righe: RigaChat[];
  lavoro: { cosa: LavoroChat; fatti: number; totale: number } | null;
  /** Clienti la cui ricerca in chat è fallita in questa sessione, col motivo. */
  erroriRiga: Record<string, CodiceErrore>;
  fermata: { per: "freno" | "annullata"; codice?: CodiceErrore } | null;
  lottoChiuso: boolean;
  riepilogo: RiepilogoEmissione | null;
  errore: { codice: CodiceErrore; messaggio: string } | null;
}

export const STATO_INIZIALE: StatoLottoChat = {
  lotto: null,
  testata: null,
  righe: [],
  lavoro: null,
  erroriRiga: {},
  fermata: null,
  lottoChiuso: false,
  riepilogo: null,
  errore: null,
};

export type Azione =
  | { tipo: "lavoro"; cosa: LavoroChat; totale: number; fatti?: number }
  | { tipo: "avanza" }
  | { tipo: "libero" }
  | { tipo: "lotto"; lotto: string; testata?: TestataLottoChat; righe: RigaChat[] }
  | { tipo: "riga"; riga: Partial<RigaChat> & { idRiga: string }; lottoChiuso?: boolean }
  | { tipo: "riga_fallita"; idRiga: string; codice: CodiceErrore }
  | { tipo: "righe_ripartite"; idRighe: string[] }
  | { tipo: "fermata"; fermata: StatoLottoChat["fermata"] }
  | { tipo: "riepilogo"; riepilogo: RiepilogoEmissione | null; lottoChiuso?: boolean }
  | { tipo: "errore"; errore: StatoLottoChat["errore"] }
  | { tipo: "azzera" };

/** Solo riporta i dati nello stato. Nessuna regola, nessuno stato di riga calcolato
 *  (quello lo dà solo `valutaLottoChat`, fuori da qui). */
export function reducerLottoChat(s: StatoLottoChat, a: Azione): StatoLottoChat {
  switch (a.tipo) {
    case "lavoro":
      return {
        ...s,
        lavoro: { cosa: a.cosa, fatti: a.fatti ?? 0, totale: a.totale },
        errore: null,
        fermata: null,
      };
    case "avanza":
      return s.lavoro ? { ...s, lavoro: { ...s.lavoro, fatti: s.lavoro.fatti + 1 } } : s;
    case "libero":
      return { ...s, lavoro: null };
    case "lotto": {
      // Un altro lotto riparte da zero; lo stesso riletto tiene gli errori di sessione e il riepilogo.
      const base = a.lotto === s.lotto ? s : { ...STATO_INIZIALE, lavoro: s.lavoro };
      return { ...base, lotto: a.lotto, testata: a.testata ?? base.testata, righe: a.righe };
    }
    case "riga": {
      const i = s.righe.findIndex((r) => r.idRiga === a.riga.idRiga);
      // Una riga nuova arriva sempre COMPLETA (risposta del server): la fusione con `{}` la lascia intatta.
      const unita = { ...(i >= 0 ? s.righe[i] : {}), ...a.riga } as RigaChat;
      const righe = i >= 0 ? s.righe.map((r, j) => (j === i ? unita : r)) : [...s.righe, unita];
      return { ...s, righe, lottoChiuso: s.lottoChiuso || !!a.lottoChiuso };
    }
    case "riga_fallita":
      return { ...s, erroriRiga: { ...s.erroriRiga, [a.idRiga]: a.codice } };
    case "righe_ripartite": {
      const e = { ...s.erroriRiga };
      for (const id of a.idRighe) delete e[id];
      return { ...s, erroriRiga: e };
    }
    case "fermata":
      return { ...s, fermata: a.fermata };
    case "riepilogo":
      return { ...s, riepilogo: a.riepilogo, lottoChiuso: s.lottoChiuso || !!a.lottoChiuso };
    case "errore":
      return { ...s, errore: a.errore };
    case "azzera":
      return STATO_INIZIALE;
  }
}

/** Per `beforeunload`: chiudere la scheda a metà ricerca o emissione lascia il lavoro a metà. */
export const lavoroInCorso = (s: StatoLottoChat): boolean => s.lavoro !== null;

/* ══ 4. L'ORCHESTRATORE ════════════════════════════════════════════════════ */

export interface PorteChatBrowser {
  fetchRotta: FetchRotta;
  attendi: (ms: number) => Promise<void>;
  riduci: (file: File) => Promise<ImmagineRidotta>;
  /** Id casuale della scheda, in memoria: l'emittente del lotto. */
  emittente: string;
  dispatch: (a: Azione) => void;
  stato: () => StatoLottoChat;
  /** Le righe valutate di adesso (da `valutaLottoChat`, T3). */
  righe: () => RigaValutata[];
}

const messaggioDi = (e: unknown): { codice: CodiceErrore; messaggio: string } => {
  if (e instanceof ErroreRotta) return { codice: e.codice, messaggio: e.messaggio };
  const codice = e instanceof ErroreCoda ? e.codice : "interno";
  return { codice, messaggio: fraseDi(codice) };
};

export function creaOrchestratoreChat(p: PorteChatBrowser) {
  /** «Interrompi»: ferma la coda e l'emissione fra un elemento e l'altro. */
  let freno: AbortController | null = null;
  const nuovoFreno = () => (freno = new AbortController());
  const chiama = <A extends AzioneChat>(
    r: Extract<RichiestaChat, { azione: A }>,
    segnale?: AbortSignal,
  ) => chiamaRottaChat(p.fetchRotta, r, segnale);
  const sbaglia = (e: unknown) => p.dispatch({ tipo: "errore", errore: messaggioDi(e) });
  const lottoAttuale = (): string => {
    const l = p.stato().lotto;
    if (!l) throw new ErroreRotta("non_trovato", "Nessun lotto aperto.");
    return l;
  };

  /** Rilegge dal server il lotto (testata, righe): la verità è lì. Lancia se non riesce. */
  async function caricaDettaglio(lotto: string): Promise<void> {
    const d = await leggiRottaChat<DettaglioLottoChat>(
      p.fetchRotta,
      `?lotto=${encodeURIComponent(lotto)}`,
    );
    p.dispatch({ tipo: "lotto", lotto, testata: d.testata, righe: d.righe });
  }

  /** Apre un lotto (anche per riprenderlo dopo una chiusura, o un ricaricamento della pagina). */
  async function apri(lotto: string): Promise<void> {
    if (p.stato().lavoro) return;
    p.dispatch({ tipo: "lavoro", cosa: "apertura", totale: 1 });
    try {
      await caricaDettaglio(lotto);
    } catch (e) {
      sbaglia(e);
      return;
    } finally {
      p.dispatch({ tipo: "libero" });
    }
    await pulisci();
  }

  /** Un lotto vuoto, pronto per `aggiungiCliente`/`cercaNelleChat`. */
  async function crea(descrizione: string): Promise<string | null> {
    if (p.stato().lavoro) return null;
    p.dispatch({ tipo: "lavoro", cosa: "apertura", totale: 1 });
    try {
      const { lotto } = await chiama({ azione: "crea", descrizione });
      await caricaDettaglio(lotto);
      return lotto;
    } catch (e) {
      sbaglia(e);
      return null;
    } finally {
      p.dispatch({ tipo: "libero" });
    }
  }

  /** Pulizia dei lotti vecchi/scaduti, un lotto per chiamata: si ripete finché c'è
   *  qualcosa da togliere, al massimo 10 volte. Un errore qui non disturba. */
  async function pulisci(): Promise<void> {
    for (let i = 0; i < 10; i++) {
      try {
        const r = await chiama({ azione: "pulisci" });
        if (!r.rimossi) return;
      } catch {
        return;
      }
    }
  }

  async function lottiAperti(): Promise<SintesiLottoChat[]> {
    await pulisci();
    return leggiRottaChat<SintesiLottoChat[]>(p.fetchRotta, "");
  }

  /** Un cliente alla volta, fuori dalla coda: spuntare un candidato al passo 1 chiama
   *  questo PRIMA di «Cerca nelle chat» (PIANO §3). La riga nasce già con la scheda scritta
   *  (lato server, T5): qui si riporta solo la risposta. */
  async function aggiungiCliente(schedaId: string): Promise<boolean> {
    try {
      const lotto = lottoAttuale();
      const r = await chiama({ azione: "aggiungi-cliente", lotto, schedaId });
      p.dispatch({ tipo: "riga", riga: r.riga });
      return true;
    } catch (e) {
      sbaglia(e);
      return false;
    }
  }

  /** «Cerca nelle chat»: `schedaIds` = i clienti scelti al passo 1 (`idRiga` = `schedaId`).
   *  Per ciascuno, se la riga non c'è ancora (rete di sicurezza: di norma l'ha già creata
   *  `aggiungiCliente` a ogni spunta) la crea, poi cerca la sua chat — UN cliente a chiamata,
   *  come `leggi-gruppo` nella bulk, con l'avanzamento «Letti N di M clienti». */
  async function cercaNelleChat(schedaIds: string[]): Promise<void> {
    const s = p.stato();
    if (!s.lotto || s.lavoro) return;
    const lotto = s.lotto;
    const daSaltare = new Set(
      Object.entries(s.erroriRiga)
        .filter(([, c]) => NON_SI_RIPAGANO.has(c))
        .map(([id]) => id),
    );
    const daFare = clientiDaCercare(s.righe, schedaIds, daSaltare);
    p.dispatch({ tipo: "righe_ripartite", idRighe: daFare });
    p.dispatch({ tipo: "lavoro", cosa: "ricerca", totale: daFare.length });
    try {
      const segnale = nuovoFreno().signal;
      const giàPresenti = new Set(s.righe.map((r) => r.idRiga));
      const r = await eseguiCoda({
        elementi: daFare,
        inParallelo: IN_PARALLELO_CERCA,
        attendi: p.attendi,
        segnale,
        esegui: async (schedaId) => {
          if (!giàPresenti.has(schedaId)) {
            const ra = await chiama({ azione: "aggiungi-cliente", lotto, schedaId }, segnale);
            p.dispatch({ tipo: "riga", riga: ra.riga });
            giàPresenti.add(schedaId);
          }
          const rc = await chiama({ azione: "cerca-chat", lotto, idRiga: schedaId }, segnale);
          p.dispatch({ tipo: "riga", riga: rc.riga });
        },
        perOgnuno: (i, e) =>
          p.dispatch(
            e.ok
              ? { tipo: "avanza" }
              : { tipo: "riga_fallita", idRiga: daFare[i], codice: e.codice },
          ),
      });
      if (r.fermataPer)
        p.dispatch({ tipo: "fermata", fermata: { per: r.fermataPer, codice: r.codiceFreno } });
      // Come nella bulk: la verità è sul server (dopo «Interrompi» un cliente può essere già stato letto).
      await caricaDettaglio(lotto);
    } catch (e) {
      sbaglia(e);
    } finally {
      p.dispatch({ tipo: "libero" });
    }
  }

  /** Una sola operazione attraverso la coda (elemento singolo): eredita gratis i ritentativi e
   *  la gestione di «occupato» di `eseguiCoda`, stesso schema di `rileggi` nella bulk. */
  async function unaVolta(
    cosa: LavoroChat,
    azione: (segnale: AbortSignal) => Promise<void>,
  ): Promise<boolean> {
    if (p.stato().lavoro) return false;
    p.dispatch({ tipo: "lavoro", cosa, totale: 1 });
    try {
      const segnale = nuovoFreno().signal;
      const r = await eseguiCoda({
        elementi: [0],
        attendi: p.attendi,
        inParallelo: 1,
        segnale,
        esegui: () => azione(segnale),
      });
      const esito = r.esiti[0];
      if (!esito) return false; // annullato
      if (!esito.ok) {
        p.dispatch({
          tipo: "errore",
          errore: { codice: esito.codice, messaggio: fraseDi(esito.codice) },
        });
        return false;
      }
      p.dispatch({ tipo: "avanza" });
      return true;
    } catch (e) {
      sbaglia(e);
      return false;
    } finally {
      p.dispatch({ tipo: "libero" });
    }
  }

  /** Riduzione+impronta del bonifico (un file solo, mai tre) poi caricamento e lettura:
   *  stesso motore di lettura della bulk, 1 immagine invece di 3 (PIANO §4, T6/T7). */
  function caricaPagamento(idRiga: string, file: File): Promise<boolean> {
    const c = controllaFile(file);
    if (!c.ok) {
      p.dispatch({ tipo: "errore", errore: { codice: "file_non_valido", messaggio: c.motivo } });
      return Promise.resolve(false);
    }
    return unaVolta("pagamento", async (segnale) => {
      const lotto = lottoAttuale();
      let img: ImmagineRidotta;
      try {
        img = await p.riduci(file);
      } catch (e) {
        throw new ErroreRotta(
          "file_non_valido",
          e instanceof Error ? e.message : fraseDi("file_non_valido"),
        );
      }
      const r1 = await chiama(
        { azione: "carica-pagamento", lotto, idRiga, dataUrl: img.dataUrl },
        segnale,
      );
      p.dispatch({ tipo: "riga", riga: r1.riga });
      const r2 = await chiama({ azione: "leggi-pagamento", lotto, idRiga }, segnale);
      p.dispatch({ tipo: "riga", riga: r2.riga });
    });
  }

  /** Rilettura esplicita del bonifico (es. dopo un `troncata`/`illeggibile`): gesto a parte,
   *  separato dal caricamento, come nel contratto (`leggi-pagamento`). */
  const leggiPagamento = (idRiga: string): Promise<boolean> =>
    unaVolta("pagamento", async (segnale) => {
      const lotto = lottoAttuale();
      const r = await chiama({ azione: "leggi-pagamento", lotto, idRiga }, segnale);
      p.dispatch({ tipo: "riga", riga: r.riga });
    });

  /** Via 2 (T17, SPEC §9.3 passo 7/§9.7 criterio 3): i 4 campi scritti a mano, senza nessuno
   *  screenshot. Stesso schema di `caricaPagamento`/`leggiPagamento` (`unaVolta("pagamento", …)`:
   *  un solo tentativo in corsa, «occupato» riprovato da sola, nessun doppio invio). Il corpo
   *  arriva già pronto da `corpoPagamentoManuale` (vedi sotto): qui non si convalida di nuovo
   *  niente, il contenuto resta deciso una volta sola da `pagamento-manuale.ts`, lato server. */
  const scriviPagamento = (
    idRiga: string,
    corpo: { importo: number; data: string; modo: string; riferimento: string },
  ): Promise<boolean> =>
    unaVolta("pagamento", async (segnale) => {
      const lotto = lottoAttuale();
      const r = await chiama({ azione: "scrivi-pagamento", lotto, idRiga, ...corpo }, segnale);
      p.dispatch({ tipo: "riga", riga: r.riga });
    });

  /** «Rileggi» la chat di UNA riga (a pagamento, gesto esplicito): a differenza di
   *  `cercaNelleChat` non salta mai, nemmeno se già fallita in modo definitivo. */
  async function rileggiChat(idRiga: string): Promise<boolean> {
    if (p.stato().lavoro) return false;
    p.dispatch({ tipo: "lavoro", cosa: "ricerca", totale: 1 });
    try {
      const lotto = lottoAttuale();
      const segnale = nuovoFreno().signal;
      const r = await eseguiCoda({
        elementi: [idRiga],
        attendi: p.attendi,
        inParallelo: 1,
        segnale,
        esegui: async (id) => {
          const risp = await chiama({ azione: "rileggi-chat", lotto, idRiga: id }, segnale);
          p.dispatch({ tipo: "riga", riga: risp.riga });
        },
      });
      const esito = r.esiti[0];
      if (esito && !esito.ok) {
        p.dispatch({ tipo: "riga_fallita", idRiga, codice: esito.codice });
        return false;
      }
      if (esito) p.dispatch({ tipo: "righe_ripartite", idRighe: [idRiga] });
      return !!esito?.ok;
    } catch (e) {
      sbaglia(e);
      return false;
    } finally {
      p.dispatch({ tipo: "libero" });
    }
  }

  /** Salva una decisione sulla riga. Niente `scheda` qui (a differenza della bulk): in questa
   *  modalità si fissa una sola volta con `aggiungiCliente`, mai riassegnata (contratto, PIANO §3).
   *  Alla rotta va sempre il risultato COMPLETO di modifiche e avvisi già dati più i nuovi: il
   *  server sostituisce `confermeAvvisi` (non unisce), quindi qui si unisce PRIMA di mandare. */
  async function salva(
    idRiga: string,
    cambi: {
      modifiche?: Partial<CampiRiga>;
      confermaRiga?: boolean;
      confermaAvvisi?: string[];
      scarta?: boolean;
    },
  ): Promise<boolean> {
    try {
      const lotto = lottoAttuale();
      const prima = p.stato().righe.find((r) => r.idRiga === idRiga);
      const r = await chiama({
        azione: "salva-riga",
        lotto,
        idRiga,
        ...cambi,
        ...(cambi.modifiche ? { modifiche: { ...prima?.modifiche, ...cambi.modifiche } } : {}),
        ...(cambi.confermaAvvisi
          ? {
              confermaAvvisi: [
                ...new Set([...(prima?.confermeAvvisi ?? []), ...cambi.confermaAvvisi]),
              ],
            }
          : {}),
      });
      p.dispatch({ tipo: "riga", riga: r.riga, lottoChiuso: r.lottoChiuso });
      return true;
    } catch (e) {
      sbaglia(e);
      return false;
    }
  }

  /** Un salvataggio alla volta PER RIGA (righe diverse vanno in parallelo), stesso schema della bulk. */
  const salvataggi = new Map<string, Promise<boolean>>();
  const salvaRiga = (idRiga: string, cambi: Parameters<typeof salva>[1]): Promise<boolean> => {
    const questo = (salvataggi.get(idRiga) ?? Promise.resolve(true)).then(() =>
      salva(idRiga, cambi),
    );
    salvataggi.set(idRiga, questo);
    void questo.then(() => salvataggi.get(idRiga) === questo && salvataggi.delete(idRiga));
    return questo;
  };

  /** Righe in coda a `salvaRiga`, stesso schema della bulk (`inBlocco`). */
  async function inBlocco(
    righe: { idRiga: string; cambi: Parameters<typeof salvaRiga>[1] }[],
  ): Promise<number> {
    if (p.stato().lavoro) return 0;
    p.dispatch({ tipo: "lavoro", cosa: "conferme", totale: righe.length });
    try {
      let fatte = 0;
      await eseguiCoda({
        elementi: righe,
        attendi: p.attendi,
        inParallelo: IN_PARALLELO_CERCA,
        esegui: async ({ idRiga, cambi }) => {
          if (!(await salvaRiga(idRiga, cambi))) throw new ErroreCoda("scrittura_fallita");
          fatte++;
        },
        perOgnuno: () => p.dispatch({ tipo: "avanza" }),
      });
      return fatte;
    } finally {
      p.dispatch({ tipo: "libero" });
    }
  }

  const aperta = (r: RigaValutata) => r.stato !== "emessa" && r.stato !== "scartata";

  /** «Conferma tutte le pronte»: solo quelle che le regole danno `pronto` (T3), mai le altre. */
  const confermaTutteLePronte = () =>
    inBlocco(
      p
        .righe()
        .filter((r) => r.stato === "pronto")
        .map((r) => ({ idRiga: r.idRiga, cambi: { confermaRiga: true } })),
    );

  /** «Conferma questo avviso per tutte»: solo gli avvisi di `AVVISI_PER_TUTTE`, solo dove è un
   *  `conferma` e non è già dato. */
  function confermaAvvisoPerTutte(codice: string): Promise<number> {
    if (!AVVISI_PER_TUTTE.includes(codice)) return Promise.resolve(0);
    const righe = p.righe().filter(
      (r) =>
        aperta(r) &&
        r.motivi.some((m) => m.codice === codice && m.gravita === "conferma") &&
        !p
          .stato()
          .righe.find((x) => x.idRiga === r.idRiga)
          ?.confermeAvvisi?.includes(codice),
    );
    return inBlocco(righe.map((r) => ({ idRiga: r.idRiga, cambi: { confermaAvvisi: [codice] } })));
  }

  /** Emette le righe emettibili, UNA ALLA VOLTA, per data di pagamento (stesso ordine della bulk,
   *  `ordineEmissione`, import): due emissioni insieme romperebbero l'ordine. */
  async function emettiConfermate(): Promise<RiepilogoEmissione | null> {
    if (p.stato().lavoro) return null;
    const lotto = lottoAttuale();
    const da = ordineEmissione(
      p
        .righe()
        .filter((r) => r.emettibile && aperta(r))
        .map((r) => ({ idRiga: r.idRiga, numero: r.numero, data: r.campi.data })),
    );
    const riepilogo: RiepilogoEmissione = { emesse: [], saltate: [], saltiDiNumeri: [] };
    let chiuso = false;
    p.dispatch({ tipo: "lavoro", cosa: "emissione", totale: da.length });
    const segnale = nuovoFreno().signal;
    try {
      for (const { idRiga } of da) {
        if (segnale.aborted) {
          p.dispatch({ tipo: "fermata", fermata: { per: "annullata" } });
          break;
        }
        try {
          const r = await chiama({ azione: "emetti-riga", lotto, idRiga, emittente: p.emittente });
          if (r.esito === "emessa") {
            riepilogo.emesse.push({ idRiga, ...r.fattura });
            if (r.saltoDiNumeri) riepilogo.saltiDiNumeri.push(r.saltoDiNumeri);
            p.dispatch({ tipo: "riga", riga: { idRiga, stato: "emessa", emessa: r.fattura } });
            chiuso ||= r.lottoChiuso;
          } else if (r.esito === "saltata") {
            riepilogo.saltate.push({ idRiga, motivi: r.motivi });
          } else {
            riepilogo.fermata = { codice: r.codice, messaggio: r.messaggio };
            break;
          }
        } catch (e) {
          riepilogo.fermata = messaggioDi(e);
          break;
        }
        p.dispatch({ tipo: "avanza" });
      }
    } finally {
      p.dispatch({ tipo: "riepilogo", riepilogo, lottoChiuso: chiuso });
      p.dispatch({ tipo: "libero" });
    }
    if (!chiuso) await caricaDettaglio(lotto).catch(sbaglia);
    return riepilogo;
  }

  /** «Prendi il controllo»: l'altra scheda smette di emettere. */
  async function prendiIlControllo(): Promise<boolean> {
    try {
      await chiama({ azione: "prendi-controllo", lotto: lottoAttuale(), emittente: p.emittente });
      p.dispatch({ tipo: "errore", errore: null });
      return true;
    } catch (e) {
      sbaglia(e);
      return false;
    }
  }

  /** Abbandona il lotto: il server toglie righe e bonifico. */
  async function annullaLotto(): Promise<boolean> {
    try {
      await chiama({ azione: "annulla", lotto: lottoAttuale() });
      p.dispatch({ tipo: "azzera" });
      return true;
    } catch (e) {
      sbaglia(e);
      return false;
    }
  }

  return {
    apri,
    crea,
    lottiAperti,
    pulisci,
    aggiungiCliente,
    cercaNelleChat,
    caricaPagamento,
    leggiPagamento,
    scriviPagamento,
    rileggiChat,
    salvaRiga,
    confermaTutteLePronte,
    confermaAvvisoPerTutte,
    emettiConfermate,
    prendiIlControllo,
    annullaLotto,
    interrompi: () => freno?.abort(),
  };
}

/* ══ 5. L'HOOK ═════════════════════════════════════════════════════════════ */

/** Id casuale di QUESTA scheda del browser, uguale finché la pagina resta aperta (stesso principio
 *  della bulk: due schede dello stesso utente sono proprio il caso). */
let idScheda: string | undefined;
const emittenteDellaScheda = (): string => (idScheda ??= crypto.randomUUID());

/** Il token del consulente sta in `fetchCRM`. Si carica al primo uso: importarlo in cima trascinerebbe
 *  la sessione (Supabase) anche dove serve solo la logica, come nelle prove. */
const fetchDelConsulente: FetchRotta = async (url, init) =>
  (await import("@/crm/AuthContext")).fetchCRM(url, init);

/** `contesto` = tutto quello che serve a `valutaLottoChat` tranne il lotto (lo mette l'hook, dalla
 *  testata) e tranne `SchedaChat` per riga, che è `schedeChat` (vedi intestazione del file: due mappe,
 *  due scopi). Passare `null` finché azienda/emesse/bozze/schede non sono caricate: nessuna riga si
 *  valuta a metà. */
export function useLottoChat(opzioni: {
  contesto: Omit<ContestoValutazione, "lotto"> | null;
  schedeChat: Record<string, SchedaChat>;
}) {
  const [stato, dispatchReact] = useReducer(reducerLottoChat, STATO_INIZIALE);
  const specchio = useRef(STATO_INIZIALE);
  const dispatch = useCallback((a: Azione) => {
    specchio.current = reducerLottoChat(specchio.current, a);
    dispatchReact(a);
  }, []);

  const { testata, righe } = stato;
  const { contesto, schedeChat } = opzioni;
  const valutazione = useMemo(
    () =>
      contesto && testata
        ? valutaLottoChat(
            righe.map((r) => ({ riga: r, scheda: schedeChat[r.scheda] ?? schedaVuota(r.scheda) })),
            { ...contesto, lotto: testata },
          )
        : null,
    [contesto, testata, righe, schedeChat],
  );
  const righeRef = useRef<RigaValutata[]>([]);
  righeRef.current = valutazione?.righe ?? [];

  const azioni = useMemo(
    () =>
      creaOrchestratoreChat({
        fetchRotta: fetchDelConsulente,
        attendi: (ms) => new Promise((r) => setTimeout(r, ms)),
        riduci: riduciImmagine,
        emittente: emittenteDellaScheda(),
        dispatch,
        stato: () => specchio.current,
        righe: () => righeRef.current,
      }),
    [dispatch],
  );

  const inCorso = lavoroInCorso(stato);
  useEffect(() => {
    if (!inCorso) return;
    const avvisa = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [inCorso]);

  return {
    stato,
    nuovoLotto: () => dispatch({ tipo: "azzera" }),
    righe: valutazione?.righe ?? [],
    ...azioni,
  };
}
