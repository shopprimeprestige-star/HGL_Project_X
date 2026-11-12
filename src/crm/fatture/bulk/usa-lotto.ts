/** ── FATTURE BULK · L'ORCHESTRAZIONE NEL BROWSER (usa-lotto.ts) ────────────
 *  Commessa 2026-11-12-fatture-bulk, T11 (PIANO §5). Mette in fila: riduzione →
 *  impronta → upload dei file, lettura dei gruppi con la coda e il freno,
 *  azioni di riga, conferme in blocco, emissione una riga alla volta.
 *
 *  ── COME È FATTO, PERCHÉ SI PROVA ────────────────────────────────────────
 *  Tutto quello che decide sta FUORI da React e riceve le sue porte (fetch,
 *  attese, riduzione delle immagini, id della scheda): `reducerLotto`,
 *  `chiamaRotta`, `creaOrchestratore`, le funzioni pure. `useLotto` è solo la
 *  colla (useReducer, useMemo, beforeunload). Le prove sono in
 *  prove/fatture-bulk/carico.mjs, con una rotta finta che parla il contratto di
 *  bulk/tipi.ts (la rotta vera è T9).
 *
 *  ── ⚠️ IL REDUCER NON RICALCOLA MAI NIENTE ───────────────────────────────
 *  Conserva file e decisioni come arrivano dal server. Stato, motivi ed
 *  `emettibile` di una riga li dà SOLO `valutaLotto` (T10), chiamata da
 *  `valutaIlLotto` fuori dal reducer: mai due regole diverse in due posti.
 *
 *  ── ⚠️ GLI `indice` NON SI RINUMERANO ────────────────────────────────────
 *  L'indice di un file è la sua posizione nell'elenco scelto (0-based) e non
 *  cambia più: l'id di una riga e i gruppi di lettura (indice ÷ 3) ne dipendono.
 *  Per questo un file non valido ferma il caricamento PRIMA di partire (non si
 *  lascia un buco), e alla ripresa si rimandano gli stessi file nello stesso
 *  ordine: quelli già salvati si saltano senza nemmeno riaprirli.
 *
 *  ── ⚠️ GUASTI DI RETE ────────────────────────────────────────────────────
 *  `fetch` che non arriva lancia un TypeError: `chiamaRotta` lo trasforma in
 *  `ErroreCoda("rete")` (coda.ts non distingue un guasto da un nostro bug). */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { eseguiCoda, ErroreCoda, codiceDaStato } from "./coda";
import { IN_PARALLELO, MAX_FILE } from "./chiavi";
import { controllaFile, riduciImmagine, type ImmagineRidotta } from "./immagini";
import { ordineEmissione } from "./emissione-bulk";
import { ricomponi, tipiPerRicomporre } from "./raggruppa";
import { valutaLotto } from "./valuta";
import type {
  AzioneBulk,
  CampiRiga,
  CodiceErrore,
  ContestoValutazione,
  DecisioniRiga,
  DettaglioLotto,
  FileLotto,
  IngressoRiga,
  Motivo,
  RichiestaBulk,
  RigaValutata,
  RispostaBulk,
  RispostaErrore,
  SintesiLotto,
  TestataLotto,
  ValutaLotto,
} from "./tipi";

export const ROTTA = "/api/crm/fatture-bulk";

/** Gli avvisi che «Conferma questo avviso per tutte» può dare (D1b): mai un `blocca`, mai altro. */
/** Gruppi che hanno già consumato l'AI e non migliorano da soli: «Riprendi» non li richiede, solo «Rileggi».
 *  Credito (402), sessione (401), permesso (403), rete, limite, timeout non hanno prodotto niente: si riprovano. */
const NON_SI_RIPAGANO: ReadonlySet<CodiceErrore> = new Set<CodiceErrore>([
  "troncata",
  "illeggibile",
]);

export const AVVISI_PER_TUTTE: readonly string[] = [
  "data_anteriore",
  "oltre_12_giorni",
  // Chi carica sempre pagamento/tessera/indirizzo avrebbe una conferma per riga: dopo aver visto le righe, un tasto (capo progetto).
  "ordine_diverso",
];

/* ══ 1. LA CHIAMATA ALLA ROTTA ═════════════════════════════════════════════ */

/** Un `ErroreCoda` che porta anche la frase della rotta (o nostra) da mostrare. */
export class ErroreRotta extends ErroreCoda {
  constructor(
    codice: CodiceErrore,
    readonly messaggio: string,
  ) {
    super(codice);
  }
}

type FetchRotta = (url: string, init?: RequestInit) => Promise<Response>;
type RispostaOk = Exclude<RispostaBulk, RispostaErrore>;
type Ok<A extends AzioneBulk> = RispostaOk & { azione: A };

const FRASI: Partial<Record<CodiceErrore, string>> = {
  rete: "La connessione è caduta: riprova fra poco.",
  timeout: "Il server ci ha messo troppo: riprova fra poco.",
  limite: "Troppe richieste in poco tempo: aspetta un attimo e riprendi.",
  credito: "Il credito dell'intelligenza artificiale è finito: ricaricalo e poi riprendi.",
  politica_dati:
    "Nessun fornitore dell'intelligenza artificiale accetta la regola «non conservare i dati»: le letture sono ferme, avvisa l'assistenza.",
  non_autorizzato: "La sessione è scaduta: rientra nel CRM e riprendi.",
  non_permesso: "Il tuo utente non può usare questa funzione.",
  troncata: "La lettura è venuta troncata: usa «Rileggi» su quel cliente.",
  illeggibile: "Lo screenshot non si legge: usa «Rileggi» o rifallo.",
  occupato: "Un'altra scheda sta leggendo questo cliente.",
};
export const fraseDi = (codice: CodiceErrore, messaggio?: string): string =>
  messaggio || FRASI[codice] || "Qualcosa non ha funzionato: riprova.";

/** Legge la risposta della rotta. Ogni uscita storta diventa un `ErroreRotta` col suo codice. */
async function leggiRisposta(r: Response): Promise<unknown> {
  let corpo: unknown;
  try {
    corpo = await r.json();
  } catch {
    // Pagina di errore di Cloudflare, corpo vuoto: ci resta solo lo stato HTTP.
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
    // «Annulla» non è un guasto: l'AbortError passa com'è, la coda lo riconosce dal segnale.
    if (e instanceof ErroreCoda || segnale?.aborted) throw e;
    throw new ErroreRotta("rete", fraseDi("rete"));
  }
}

export function chiamaRotta<A extends AzioneBulk>(
  fetchRotta: FetchRotta,
  richiesta: Extract<RichiestaBulk, { azione: A }>,
  segnale?: AbortSignal,
): Promise<Ok<A>> {
  return conRete(segnale, async () => {
    const r = await fetchRotta(ROTTA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(richiesta),
      signal: segnale,
    });
    return (await leggiRisposta(r)) as Ok<A>;
  });
}

/** GET della rotta (`?lotto=ID` o senza parametri). */
export function leggiRotta<T>(
  fetchRotta: FetchRotta,
  parametri: string,
  segnale?: AbortSignal,
): Promise<T> {
  return conRete(
    segnale,
    async () =>
      (await leggiRisposta(await fetchRotta(`${ROTTA}${parametri}`, { signal: segnale }))) as T,
  );
}

/* ══ 2. LE FUNZIONI PURE ═══════════════════════════════════════════════════ */

/** Dei file scelti, quali caricare e quali sono già nel lotto (ripresa a metà caricamento).
 *  Ordinati, senza doppioni. */
export function pianoDiCarico(
  salvati: number[],
  daCaricare: number[],
): { carica: number[]; giaSalvati: number[] } {
  const dentro = new Set(salvati);
  const unici = [...new Set(daCaricare)].sort((a, b) => a - b);
  return {
    carica: unici.filter((i) => !dentro.has(i)),
    giaSalvati: unici.filter((i) => dentro.has(i)),
  };
}

/** Gli indici già nel lotto: tutto tranne `caricando` (ha una scadenza, se il Worker muore si ritenta). */
export const indiciSalvati = (file: FileLotto[]): number[] =>
  file.filter((f) => f.stato !== "caricando").map((f) => f.indice);

/** Il gruppo di lettura è la posizione di una terna di file: indice ÷ 3 (stessa regola di `chiaveReclamo`). */
export const gruppoDi = (indice: number): number => Math.floor(indice / 3);

/** Gruppi ancora da leggere: almeno un file `salvato` (mai letto), nessun file in `errore` (quello è un
 *  «Rileggi» esplicito, a pagamento), nessun file `caricando`, e TUTTI i file della terna presenti
 *  (solo l'ultima terna può essere più corta): leggere un gruppo con un buco darebbe un cliente sbagliato.
 *  `daSaltare` = gruppi falliti in modo che non si ripete da solo. */
export function gruppiDaLeggere(
  file: FileLotto[],
  daSaltare: ReadonlySet<number> = new Set(),
  totale = 0,
): number[] {
  const n = Math.max(totale, ...file.map((f) => f.indice + 1), 0);
  const perGruppo = new Map<number, FileLotto[]>();
  for (const f of file)
    perGruppo.set(gruppoDi(f.indice), [...(perGruppo.get(gruppoDi(f.indice)) ?? []), f]);
  return [...perGruppo]
    .filter(([g, fs]) => {
      const attesi = Math.min(3, n - g * 3);
      return (
        !daSaltare.has(g) &&
        fs.length === attesi &&
        fs.every((f) => f.stato !== "caricando" && f.stato !== "errore") &&
        fs.some((f) => f.stato === "salvato")
      );
    })
    .map(([g]) => g)
    .sort((a, b) => a - b);
}

/** Mette i file nuovi al posto dei vecchi con lo stesso indice; non rinumera niente. */
export function unisciFile(vecchi: FileLotto[], nuovi: FileLotto[]): FileLotto[] {
  const per = new Map(vecchi.map((f) => [f.indice, f]));
  for (const f of nuovi) per.set(f.indice, f);
  return [...per.values()].sort((a, b) => a.indice - b.indice);
}

/** Le righe valutate: ricompone i clienti dai tipi e passa tutto a `valutaLotto` (T10). Né qui né nel
 *  reducer si decide uno stato. Prima della lettura i tipi sono vuoti: nessun cliente, nessuna riga; un gruppo la cui lettura è fallita invece c'è (riga «Errore», si rilegge). */
export function valutaIlLotto(
  stato: Pick<StatoLotto, "file" | "decisioni">,
  ctx: ContestoValutazione,
  valuta: ValutaLotto = valutaLotto,
): ReturnType<ValutaLotto> {
  const gruppi = ricomponi(tipiPerRicomporre(stato.file));
  const righe: IngressoRiga[] = gruppi.map((gruppo) => ({
    gruppo,
    file: stato.file,
    decisioni: stato.decisioni[gruppo.idRiga],
  }));
  return valuta(righe, ctx);
}

/* ══ 3. LO STATO E IL REDUCER ══════════════════════════════════════════════ */

export type Lavoro = "apertura" | "carico" | "lettura" | "rilettura" | "conferme" | "emissione";

export interface RiepilogoEmissione {
  emesse: { idRiga: string; id: string; numero: number; data: string }[];
  saltate: { idRiga: string; motivi: Motivo[] }[];
  /** Numeri emessi da altri fra una riga e l'altra (D14): registrati, non fermano. */
  saltiDiNumeri: { da: number; a: number }[];
  fermata?: { codice: CodiceErrore; messaggio: string };
}

export interface StatoLotto {
  lotto: string | null;
  testata: TestataLotto | null;
  file: FileLotto[];
  /** Per `idRiga`. */
  decisioni: Record<string, DecisioniRiga>;
  /** File scelti in tutto nel caricamento in corso (per riconoscere i buchi). */
  totaleFile: number;
  lavoro: { cosa: Lavoro; fatti: number; totale: number } | null;
  /** Gruppi la cui lettura è fallita in questa sessione, col motivo. */
  erroriGruppo: Record<number, CodiceErrore>;
  /** File rifiutati PRIMA di caricare (nessun upload è partito). */
  fileNonValidi: { indice: number; motivo: string }[];
  /** File che non sono arrivati al server. */
  erroriCarico: { indice: number; codice: CodiceErrore; messaggio?: string }[];
  /** Perché la coda si è fermata prima della fine. */
  fermata: { per: "freno" | "annullata"; codice?: CodiceErrore } | null;
  /** Tutte le righe chiuse: il server ha eliminato il lotto. */
  lottoChiuso: boolean;
  /** Il riepilogo di fine lavoro vive solo qui: dopo un ricaricamento le emesse mostrano il numero e basta. */
  riepilogo: RiepilogoEmissione | null;
  errore: { codice: CodiceErrore; messaggio: string } | null;
}

export const STATO_INIZIALE: StatoLotto = {
  lotto: null,
  testata: null,
  file: [],
  decisioni: {},
  totaleFile: 0,
  lavoro: null,
  erroriGruppo: {},
  fileNonValidi: [],
  erroriCarico: [],
  fermata: null,
  lottoChiuso: false,
  riepilogo: null,
  errore: null,
};

export type Azione =
  | { tipo: "lavoro"; cosa: Lavoro; totale: number; fatti?: number; totaleFile?: number }
  | { tipo: "avanza" }
  | { tipo: "libero" }
  | {
      tipo: "lotto";
      lotto: string;
      testata?: TestataLotto;
      file: FileLotto[];
      righe?: DecisioniRiga[];
    }
  | { tipo: "file"; file: FileLotto[] }
  | { tipo: "riga"; riga: DecisioniRiga; lottoChiuso?: boolean }
  | { tipo: "gruppo_fallito"; gruppo: number; codice: CodiceErrore }
  | { tipo: "gruppi_ripartiti"; gruppi: number[] }
  | {
      tipo: "esito_carico";
      fileNonValidi?: StatoLotto["fileNonValidi"];
      erroriCarico?: StatoLotto["erroriCarico"];
    }
  | { tipo: "fermata"; fermata: StatoLotto["fermata"] }
  | { tipo: "riepilogo"; riepilogo: RiepilogoEmissione | null; lottoChiuso?: boolean }
  | { tipo: "errore"; errore: StatoLotto["errore"] }
  | { tipo: "azzera" };

/** D11a: dopo emissione o scarto di una riga (o a lotto chiuso) nello stato non resta la lettura (nome, CF,
 *  indirizzo, importo): restano impronta, stato e tipo, come sul server. `idRiga` = gli indici dei suoi file. */
function senzaLettura(file: FileLotto[], idRiga?: string): FileLotto[] {
  const suoi = idRiga ? new Set(idRiga.split("-").map(Number)) : null;
  return file.map((f) => {
    if (!("lettura" in f) || (suoi && !suoi.has(f.indice))) return f;
    const { lettura: _lettura, ...resto } = f;
    return resto;
  });
}

/** Solo riporta i dati nello stato. Nessuna regola, nessuno stato di riga calcolato. */
export function reducerLotto(s: StatoLotto, a: Azione): StatoLotto {
  switch (a.tipo) {
    case "lavoro":
      return {
        ...s,
        lavoro: { cosa: a.cosa, fatti: a.fatti ?? 0, totale: a.totale },
        totaleFile: a.totaleFile ?? s.totaleFile,
        errore: null,
        fermata: null,
      };
    case "avanza":
      return s.lavoro ? { ...s, lavoro: { ...s.lavoro, fatti: s.lavoro.fatti + 1 } } : s;
    case "libero":
      return { ...s, lavoro: null };
    case "lotto": {
      // Un altro lotto riparte da zero; lo stesso riletto tiene gli errori di sessione e il riepilogo.
      const base =
        a.lotto === s.lotto ? s : { ...STATO_INIZIALE, lavoro: s.lavoro, totaleFile: s.totaleFile };
      return {
        ...base,
        lotto: a.lotto,
        testata: a.testata ?? base.testata,
        file: unisciFile([], a.file),
        decisioni: a.righe ? Object.fromEntries(a.righe.map((r) => [r.idRiga, r])) : base.decisioni,
      };
    }
    case "file":
      return { ...s, file: unisciFile(s.file, a.file) };
    case "riga": {
      const chiusa = a.riga.stato !== "aperta";
      const lottoChiuso = s.lottoChiuso || !!a.lottoChiuso;
      return {
        ...s,
        decisioni: { ...s.decisioni, [a.riga.idRiga]: a.riga },
        file: lottoChiuso
          ? senzaLettura(s.file)
          : chiusa
            ? senzaLettura(s.file, a.riga.idRiga)
            : s.file,
        lottoChiuso,
      };
    }
    case "gruppo_fallito":
      return { ...s, erroriGruppo: { ...s.erroriGruppo, [a.gruppo]: a.codice } };
    case "gruppi_ripartiti": {
      const e = { ...s.erroriGruppo };
      for (const g of a.gruppi) delete e[g];
      return { ...s, erroriGruppo: e };
    }
    case "esito_carico":
      return { ...s, fileNonValidi: a.fileNonValidi ?? [], erroriCarico: a.erroriCarico ?? [] };
    case "fermata":
      return { ...s, fermata: a.fermata };
    case "riepilogo": {
      const lottoChiuso = s.lottoChiuso || !!a.lottoChiuso;
      return {
        ...s,
        riepilogo: a.riepilogo,
        file: lottoChiuso ? senzaLettura(s.file) : s.file,
        lottoChiuso,
      };
    }
    case "errore":
      return { ...s, errore: a.errore };
    case "azzera":
      return STATO_INIZIALE;
  }
}

/** Per `beforeunload`: chiudere la scheda a metà lettura o emissione lascia il lavoro a metà. */
export const lavoroInCorso = (s: StatoLotto): boolean => s.lavoro !== null;

/* ══ 4. L'ORCHESTRATORE ════════════════════════════════════════════════════ */

export interface Porte {
  fetchRotta: FetchRotta;
  attendi: (ms: number) => Promise<void>;
  riduci: (file: File) => Promise<ImmagineRidotta>;
  /** Id casuale della scheda, in memoria: l'emittente del lotto (D14). */
  emittente: string;
  dispatch: (a: Azione) => void;
  /** Lo stato di adesso (nel hook è lo specchio del reducer, aggiornato subito). */
  stato: () => StatoLotto;
  /** Le righe valutate di adesso (da `valutaLotto`). */
  righe: () => RigaValutata[];
}

const messaggioDi = (e: unknown): { codice: CodiceErrore; messaggio: string } => {
  if (e instanceof ErroreRotta) return { codice: e.codice, messaggio: e.messaggio };
  const codice = e instanceof ErroreCoda ? e.codice : "interno";
  return { codice, messaggio: fraseDi(codice) };
};

export function creaOrchestratore(p: Porte) {
  /** «Interrompi»: ferma la coda e l'emissione fra un elemento e l'altro. */
  let freno: AbortController | null = null;
  const nuovoFreno = () => (freno = new AbortController());
  const chiama = <A extends AzioneBulk>(
    r: Extract<RichiestaBulk, { azione: A }>,
    segnale?: AbortSignal,
  ) => chiamaRotta(p.fetchRotta, r, segnale);
  const sbaglia = (e: unknown) => p.dispatch({ tipo: "errore", errore: messaggioDi(e) });
  const lottoAttuale = (): string => {
    const l = p.stato().lotto;
    if (!l) throw new ErroreRotta("non_trovato", "Nessun lotto aperto.");
    return l;
  };

  /** Rilegge dal server il lotto (testata, file, righe): la verità è lì. Lancia se non riesce. */
  async function caricaDettaglio(lotto: string): Promise<void> {
    const d = await leggiRotta<DettaglioLotto>(p.fetchRotta, `?lotto=${encodeURIComponent(lotto)}`);
    p.dispatch({ tipo: "lotto", lotto, testata: d.testata, file: d.file, righe: d.righe });
  }

  /** Apre un lotto (anche per riprenderlo dopo una chiusura). */
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

  /** La pulizia dei lotti vecchi è un POST a parte, dopo l'apertura (il GET non cancella mai). Un lotto per
   *  chiamata: si ripete finché c'è qualcosa da togliere, al massimo 10 volte. Un errore qui non disturba. */
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

  /** I lotti aperti, dal più recente (per riprendere dopo una chiusura): è l'apertura della pagina, quindi
   *  PRIMA si fa la pulizia dei lotti scaduti (SPEC §5) e poi si elenca: un lotto appena mostrato non sparisce. */
  async function lottiAperti(): Promise<SintesiLotto[]> {
    await pulisci();
    return leggiRotta<SintesiLotto[]>(p.fetchRotta, "");
  }

  /** `files` = TUTTI i file scelti, nell'ordine di caricamento. In ripresa si rimandano gli stessi nello stesso
   *  ordine: i già salvati si saltano. Solo carica; la lettura è un gesto a parte (si paga). */
  async function carica(
    files: File[],
    opzioni: { descrizione?: string; dataSeManca?: string } = {},
  ): Promise<void> {
    if (p.stato().lavoro) return;
    const nonValidi = files.flatMap((f, indice) => {
      const c = controllaFile(f);
      return c.ok ? [] : [{ indice, motivo: c.motivo }];
    });
    if (nonValidi.length) return p.dispatch({ tipo: "esito_carico", fileNonValidi: nonValidi });
    if (files.length === 0 || files.length > MAX_FILE) {
      return p.dispatch({
        tipo: "errore",
        errore: {
          codice: "troppi_file",
          messaggio: files.length
            ? `Al massimo ${MAX_FILE} file per volta (200 clienti): dividi in più caricamenti.`
            : "Scegli almeno uno screenshot.",
        },
      });
    }
    p.dispatch({ tipo: "esito_carico" });
    p.dispatch({ tipo: "lavoro", cosa: "carico", totale: files.length, totaleFile: files.length });
    try {
      let lotto = p.stato().lotto;
      if (!lotto) {
        lotto = (
          await chiama({
            azione: "crea",
            descrizione: opzioni.descrizione ?? "",
            dataSeManca: opzioni.dataSeManca,
          })
        ).lotto;
        await caricaDettaglio(lotto);
      }
      const { carica: daFare, giaSalvati } = pianoDiCarico(
        indiciSalvati(p.stato().file),
        files.map((_, i) => i),
      );
      p.dispatch({
        tipo: "lavoro",
        cosa: "carico",
        totale: files.length,
        fatti: giaSalvati.length,
      });
      const messaggi = new Map<number, string>();
      const segnale = nuovoFreno().signal;
      const r = await eseguiCoda({
        elementi: daFare,
        inParallelo: IN_PARALLELO,
        attendi: p.attendi,
        segnale,
        esegui: async (indice) => {
          // Un file alla volta in memoria per operaio: riduzione, impronta, upload, poi si butta il data URL.
          let img: ImmagineRidotta;
          try {
            img = await p.riduci(files[indice]);
          } catch (e) {
            const messaggio = e instanceof Error ? e.message : fraseDi("file_non_valido");
            messaggi.set(indice, messaggio);
            throw new ErroreRotta("file_non_valido", messaggio);
          }
          await chiama(
            { azione: "file", lotto: lotto!, indice, impronta: img.impronta, dataUrl: img.dataUrl },
            segnale,
          );
        },
        perOgnuno: (_, e) => e.ok && p.dispatch({ tipo: "avanza" }),
      });
      const erroriCarico = r.esiti.flatMap((e, i) =>
        e && !e.ok
          ? [
              {
                indice: daFare[i],
                codice: e.codice,
                ...(messaggi.has(daFare[i]) ? { messaggio: messaggi.get(daFare[i]) } : {}),
              },
            ]
          : [],
      );
      p.dispatch({ tipo: "esito_carico", erroriCarico });
      if (r.fermataPer)
        p.dispatch({ tipo: "fermata", fermata: { per: r.fermataPer, codice: r.codiceFreno } });
      // La verità è sul server (copie, file già presenti): si rilegge, non si indovina.
      await caricaDettaglio(lotto);
    } catch (e) {
      sbaglia(e);
    } finally {
      p.dispatch({ tipo: "libero" });
    }
  }

  /** Legge i gruppi non ancora letti (anche alla ripresa: i letti non si richiedono, non si ripaga).
   *  I gruppi falliti per `troncata`/`illeggibile` non si ripetono da soli: li riprende «Rileggi». */
  async function leggi(): Promise<void> {
    const s = p.stato();
    if (!s.lotto || s.lavoro) return;
    const lotto = s.lotto;
    const daSaltare = new Set(
      Object.entries(s.erroriGruppo)
        .filter(([, c]) => NON_SI_RIPAGANO.has(c))
        .map(([g]) => Number(g)),
    );
    const gruppi = gruppiDaLeggere(s.file, daSaltare, s.totaleFile);
    p.dispatch({ tipo: "gruppi_ripartiti", gruppi });
    p.dispatch({ tipo: "lavoro", cosa: "lettura", totale: gruppi.length });
    try {
      const segnale = nuovoFreno().signal;
      const r = await eseguiCoda({
        elementi: gruppi,
        attendi: p.attendi,
        segnale,
        esegui: async (gruppo) => {
          const risp = await chiama({ azione: "leggi-gruppo", lotto, gruppo }, segnale);
          p.dispatch({ tipo: "file", file: risp.file });
        },
        perOgnuno: (i, e) =>
          p.dispatch(
            e.ok
              ? { tipo: "avanza" }
              : { tipo: "gruppo_fallito", gruppo: gruppi[i], codice: e.codice },
          ),
      });
      if (r.fermataPer)
        p.dispatch({ tipo: "fermata", fermata: { per: r.fermataPer, codice: r.codiceFreno } });
      // Come in `carica`: la verità è sul server (dopo «Interrompi» un gruppo può essere già stato letto).
      await caricaDettaglio(lotto);
    } catch (e) {
      sbaglia(e);
    } finally {
      p.dispatch({ tipo: "libero" });
    }
  }

  /** «Rileggi» (a pagamento, gesto esplicito) per i file indicati. */
  async function rileggi(indici: number[]): Promise<void> {
    if (p.stato().lavoro) return;
    const gruppi = [...new Set(indici.map(gruppoDi))];
    p.dispatch({ tipo: "lavoro", cosa: "rilettura", totale: 1 });
    try {
      const lotto = lottoAttuale();
      const r = await eseguiCoda({
        elementi: [indici],
        attendi: p.attendi,
        inParallelo: 1,
        esegui: async (i) =>
          p.dispatch({
            tipo: "file",
            file: (await chiama({ azione: "rileggi", lotto, indici: i })).file,
          }),
      });
      const esito = r.esiti[0];
      if (esito && !esito.ok)
        gruppi.forEach((gruppo) =>
          p.dispatch({ tipo: "gruppo_fallito", gruppo, codice: esito.codice }),
        );
      else p.dispatch({ tipo: "gruppi_ripartiti", gruppi });
    } catch (e) {
      sbaglia(e);
    } finally {
      p.dispatch({ tipo: "libero" });
    }
  }

  /** Salva una decisione sulla riga. Alla rotta va sempre il risultato COMPLETO (modifiche e avvisi già dati
   *  più i nuovi), così vale sia se la rotta unisce sia se sostituisce. Il server restituisce la riga intera. */
  async function salva(
    idRiga: string,
    cambi: {
      modifiche?: Partial<CampiRiga>;
      scheda?: string | null;
      confermaRiga?: boolean;
      confermaAvvisi?: string[];
      scarta?: boolean;
    },
  ): Promise<boolean> {
    try {
      const lotto = lottoAttuale();
      const prima = p.stato().decisioni[idRiga];
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

  /** Un salvataggio alla volta PER RIGA: la seconda correzione parte quando la prima ha avuto risposta, e porta
   *  anche quella (se la rotta sostituisce, altrimenti si perderebbe). Righe diverse vanno in parallelo. */
  const salvataggi = new Map<string, Promise<boolean>>();
  const salvaRiga = (idRiga: string, cambi: Parameters<typeof salva>[1]): Promise<boolean> => {
    const questo = (salvataggi.get(idRiga) ?? Promise.resolve(true)).then(() =>
      salva(idRiga, cambi),
    );
    salvataggi.set(idRiga, questo);
    void questo.then(() => salvataggi.get(idRiga) === questo && salvataggi.delete(idRiga));
    return questo;
  };

  /** Righe in coda a `salvaRiga`, 3 per volta: una chiamata ciascuna. Ritorna quante sono andate. */
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
        inParallelo: IN_PARALLELO,
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

  /** «Conferma tutte le pronte»: solo quelle che le regole danno `pronto` (T10), mai le altre. */
  const confermaTutteLePronte = () =>
    inBlocco(
      p
        .righe()
        .filter((r) => r.stato === "pronto")
        .map((r) => ({ idRiga: r.idRiga, cambi: { confermaRiga: true } })),
    );

  /** «Conferma questo avviso per tutte» (D1b): solo `data_anteriore` e `oltre_12_giorni`, solo dove l'avviso è
   *  un `conferma` e non è già dato. Un altro codice (e mai un `blocca`) non si conferma in blocco. */
  function confermaAvvisoPerTutte(codice: string): Promise<number> {
    if (!AVVISI_PER_TUTTE.includes(codice)) return Promise.resolve(0);
    const righe = p
      .righe()
      .filter(
        (r) =>
          aperta(r) &&
          r.motivi.some((m) => m.codice === codice && m.gravita === "conferma") &&
          !p.stato().decisioni[r.idRiga]?.confermeAvvisi?.includes(codice),
      );
    return inBlocco(righe.map((r) => ({ idRiga: r.idRiga, cambi: { confermaAvvisi: [codice] } })));
  }

  /** Emette le righe emettibili, UNA ALLA VOLTA, per data di pagamento (D2): il numero cresce con la data e
   *  due emissioni insieme romperebbero l'ordine. `saltata` = una riga non è emettibile per un motivo suo: le
   *  altre proseguono. `ferma`, o un errore (anche di rete): si ferma tutto. Dopo un errore si rilegge il lotto:
   *  la rotta riconosce una riga già emessa (`cercaPerOrigine`), quindi riprovare non emette due volte. */
  async function emettiConfermate(): Promise<RiepilogoEmissione | null> {
    // Il doppio clic su «Emetti» è il gesto a rischio: un solo giro alla volta.
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
            // Dopo l'emissione restano solo stato e numero (D11a): il resto è già svuotato sul server.
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
    // Lotto chiuso = il server lo ha eliminato: niente da rileggere.
    if (!chiuso) await caricaDettaglio(lotto).catch(sbaglia);
    return riepilogo;
  }

  /** «Prendi il controllo»: l'altra scheda smette di emettere (D14). Il pulsante avvisa PRIMA, la UI è di T13. */
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

  /** Abbandona il lotto: il server toglie righe e foto. */
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
    lottiAperti,
    pulisci,
    carica,
    leggi,
    riprendi: leggi,
    rileggi,
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

/** Id casuale di QUESTA scheda del browser, uguale finché la pagina resta aperta (D14: non l'utente, perché
 *  due schede dello stesso utente sono proprio il caso). */
let idScheda: string | undefined;
const emittenteDellaScheda = (): string => (idScheda ??= crypto.randomUUID());

/** Il token del consulente sta in `fetchCRM`. Si carica al primo uso: importarlo in cima trascinerebbe
 *  la sessione (Supabase) anche dove serve solo la logica, come nelle prove. */
const fetchDelConsulente: FetchRotta = async (url, init) =>
  (await import("@/crm/AuthContext")).fetchCRM(url, init);

/** `contesto` = tutto quello che serve a `valutaLotto` tranne il lotto (lo mette l'hook, dalla testata).
 *  Passarlo `null` finché emesse, bozze e schede non sono caricate: nessuna riga viene valutata a metà. */
export function useLotto(opzioni: { contesto: Omit<ContestoValutazione, "lotto"> | null }) {
  const [stato, dispatchReact] = useReducer(reducerLotto, STATO_INIZIALE);
  // Lo specchio del reducer (puro, quindi identico) serve all'orchestratore, che legge lo stato appena dopo un dispatch.
  const specchio = useRef(STATO_INIZIALE);
  const dispatch = useCallback((a: Azione) => {
    specchio.current = reducerLotto(specchio.current, a);
    dispatchReact(a);
  }, []);

  // Si rivaluta solo se cambiano file, decisioni, testata o contesto: non a ogni tick dell'avanzamento.
  const { testata, file, decisioni } = stato;
  const contesto = opzioni.contesto;
  const valutazione = useMemo(
    () =>
      contesto && testata
        ? valutaIlLotto({ file, decisioni }, { ...contesto, lotto: testata })
        : null,
    [contesto, testata, file, decisioni],
  );
  const righeRef = useRef<RigaValutata[]>([]);
  // Aggiornato a ogni render: le azioni leggono le righe di adesso, non quelle di quando sono state create.
  righeRef.current = valutazione?.righe ?? [];

  const azioni = useMemo(
    () =>
      creaOrchestratore({
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
    fatti: valutazione?.fatti ?? null,
    motiviLotto: valutazione?.motiviLotto ?? [],
    ...azioni,
  };
}
