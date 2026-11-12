/** ── FATTURE BULK · LA CODA DELLA LETTURA (coda.ts) ───────────────────────
 *  Commessa 2026-11-12-fatture-bulk, T8 (PIANO §5, D12). Pura: i tempi e le
 *  attese sono iniettati (`attendi`), nessun timer qui dentro, così si
 *  prova senza aspettare.
 *
 *  ── ⚠️ UN SOLO LIVELLO DI RIPETIZIONI, E STA QUI ─────────────────────────
 *  La rotta fa UN tentativo all'AI (55 s) e risponde con un codice; le
 *  ripetizioni le fa SOLO questa coda, nel browser: al massimo 3 tentativi per
 *  gruppo (il primo e due ripetizioni, dopo 2 s e dopo 5 s) e solo per i guasti
 *  che passano da soli (`rete`, `limite` = 429, `timeout`). Ripetizioni anche
 *  nella rotta farebbero 9 chiamate per gruppo, oltre i ~100 s che Cloudflare
 *  concede a una risposta: il browser vedrebbe un errore mentre OpenRouter
 *  continua (e si paga).
 *  MAI ripetuti, perché si pagherebbe due volte lo stesso risultato:
 *  `troncata` (la risposta è stata tagliata dal tetto), `credito` (402),
 *  `illeggibile` e ogni errore 4xx.
 *
 *  ── «OCCUPATO» ───────────────────────────────────────────────────────────
 *  Un'altra scheda sta già leggendo quel gruppo (reclamo, D14): la rotta non ha
 *  chiamato l'AI e risponde `occupato`. Qui significa «riprova fra poco» (5 s):
 *  non consuma i 3 tentativi, non costa niente e NON conta nel freno. Non si
 *  aspetta per sempre: dopo `MAX_ATTESE_OCCUPATO` attese (più del reclamo, 90 s)
 *  l'elemento finisce in errore `occupato`, sempre fuori dal freno.
 *
 *  ── IL FRENO ─────────────────────────────────────────────────────────────
 *  Cinque elementi di fila falliti per davvero (dopo i loro tentativi) = si
 *  ferma tutto: con un guasto vero non ha senso fare altre 195 chiamate. Un
 *  successo azzera il conto. Quelli già partiti finiscono e si registrano;
 *  quelli non partiti restano `undefined` e si riprendono dal primo. */
import { ERRORI_DI_FILA, IN_PARALLELO, RITARDI_RIPETIZIONE_MS, SCADENZA_RECLAMO_MS, TENTATIVI_PER_GRUPPO } from "./chiavi";
import type { CodiceErrore } from "./tipi";

/** Un fallimento con il suo codice. `esegui` lancia questo; qualunque altra eccezione è un nostro difetto
 *  (`interno`) e non si ripete. ⚠️ Chi chiama la rotta (T11) deve trasformare in `ErroreCoda("rete")` i
 *  guasti di rete di `fetch` (che lanciano un `TypeError`): da qui in poi non si distinguono da un bug. */
export class ErroreCoda extends Error {
  constructor(readonly codice: CodiceErrore) {
    super(codice);
    this.name = "ErroreCoda";
  }
}

/** I soli guasti che passano da soli. */
export const CODICI_RIPETIBILI: ReadonlySet<CodiceErrore> = new Set<CodiceErrore>(["rete", "limite", "timeout"]);

/** Quanto si aspetta fra due richieste a un gruppo occupato, e quante volte al massimo. */
export const ATTESA_OCCUPATO_MS = 5_000;
export const MAX_ATTESE_OCCUPATO = Math.ceil(SCADENZA_RECLAMO_MS / ATTESA_OCCUPATO_MS) + 2;

/** Lo stato HTTP di una risposta senza corpo che si capisce (es. un errore di Cloudflare) → il suo codice.
 *  Le risposte della rotta portano già il loro codice nel corpo (`RispostaErrore`): questo è il ripiego. */
export function codiceDaStato(stato: number): CodiceErrore {
  if (stato === 429) return "limite";
  if (stato === 402) return "credito";
  if (stato === 408 || stato === 504) return "timeout";
  if (stato === 401) return "non_autorizzato";
  if (stato === 403) return "non_permesso";
  if (stato === 404) return "non_trovato";
  if (stato >= 500) return "rete";
  if (stato >= 400) return "richiesta_non_valida";
  return "rete";
}

export interface OpzioniCoda<T, R> {
  elementi: T[];
  /** Lavora un elemento; lancia un `ErroreCoda` per i fallimenti. `tentativo` è il numero (da 1) del
   *  tentativo PAGATO per quell'elemento: le attese per «occupato» non lo fanno salire. */
  esegui: (elemento: T, tentativo: number) => Promise<R>;
  attendi: (ms: number) => Promise<void>;
  inParallelo?: number;
  segnale?: AbortSignal;
  /** Notifica ogni elemento finito (bene o male), nell'ordine in cui finiscono. */
  perOgnuno?: (indice: number, esito: { ok: true; valore: R } | { ok: false; codice: CodiceErrore }) => void;
}

export interface RisultatoCoda<R> {
  /** Nell'ordine degli elementi, indipendente da chi finisce prima. `undefined` = non fatto. */
  esiti: ({ ok: true; valore: R } | { ok: false; codice: CodiceErrore } | undefined)[];
  /** Fermata dal freno o dall'annullamento. */
  fermataPer?: "freno" | "annullata";
  codiceFreno?: CodiceErrore;
}

type Esito<R> = { ok: true; valore: R } | { ok: false; codice: CodiceErrore };

export async function eseguiCoda<T, R>(opzioni: OpzioniCoda<T, R>): Promise<RisultatoCoda<R>> {
  const { elementi, esegui, attendi, segnale, perOgnuno } = opzioni;
  const esiti: RisultatoCoda<R>["esiti"] = elementi.map(() => undefined);
  let prossimo = 0;
  let diFila = 0;
  let fermataPer: RisultatoCoda<R>["fermataPer"];
  let codiceFreno: CodiceErrore | undefined;

  /** Un elemento fino alla fine; `undefined` se l'annullamento arriva prima che sia concluso. */
  async function lavora(elemento: T): Promise<Esito<R> | undefined> {
    let tentativo = 1;
    let attese = 0;
    for (;;) {
      if (segnale?.aborted) return undefined;
      try {
        return { ok: true, valore: await esegui(elemento, tentativo) };
      } catch (e) {
        const codice = e instanceof ErroreCoda ? e.codice : "interno";
        if (codice === "occupato" && attese < MAX_ATTESE_OCCUPATO) {
          attese++;
          await attendi(ATTESA_OCCUPATO_MS);
        } else if (CODICI_RIPETIBILI.has(codice) && tentativo < TENTATIVI_PER_GRUPPO) {
          await attendi(RITARDI_RIPETIZIONE_MS[tentativo - 1]);
          tentativo++;
        } else {
          return { ok: false, codice };
        }
      }
    }
  }

  async function operaio(): Promise<void> {
    while (!fermataPer && !segnale?.aborted && prossimo < elementi.length) {
      const i = prossimo++;
      const esito = await lavora(elementi[i]);
      if (!esito) continue;
      esiti[i] = esito;
      perOgnuno?.(i, esito);
      if (esito.ok) diFila = 0;
      // `occupato` non è un fallimento: non conta e non azzera.
      else if (esito.codice !== "occupato" && ++diFila >= ERRORI_DI_FILA && !fermataPer) {
        fermataPer = "freno";
        codiceFreno = esito.codice;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(opzioni.inParallelo ?? IN_PARALLELO, elementi.length) }, operaio));
  if (!fermataPer && segnale?.aborted && esiti.includes(undefined)) fermataPer = "annullata";
  return { esiti, ...(fermataPer ? { fermataPer } : {}), ...(codiceFreno ? { codiceFreno } : {}) };
}
