/** ── FATTURE DALLA CHAT · T14 · L'ORCHESTRATORE DELLA VIA 2 (hook) ───────────
 *  Commessa 2026-11-13-fatture-dalla-chat, PIANO §2bis/§3bis/§4 (T14), SPEC §9.3
 *  passi 4-6, §9.6, §9.7 criteri 1-2.
 *
 *  Mette in fila i passi 4-6 della Via 2 («Usa per fattura», dalla chat):
 *  abbinamento per numero (T12, `schedePerNumero`) → crea/trova la riga (azione
 *  `aggiungi-da-chat`) → legge le sole bolle scelte (azione `leggi-bolle`) →
 *  torna `{lotto, idRiga}` perché T15 ci navighi sopra (`/CRM/fatture?...`).
 *  Tiene anche lo stato locale delle bolle scelte (T13: `selezionabileFattura`/
 *  `commutaFattura`, import) e lo azzera da solo quando il NUMERO della chat
 *  aperta cambia (SPEC §9.6: la selezione vive dentro una sola conversazione).
 *
 *  ── ⚠️ `fatturaAttiva` ────────────────────────────────────────────────────
 *  Vero appena c'è almeno una bolla scelta: è lo stato che PIANO §0bis.1/T15
 *  userà per spegnere «Rispiega con AI» mentre una selezione-fattura è in
 *  corso (mutua esclusione nei due sensi). Questo file lo calcola e basta: non
 *  importa né tocca mai `risposte-ai/rispiega.ts`/`useRispostaAi.ts`.
 *
 *  ── ⚠️ `aggiungi-da-chat`/`leggi-bolle` NON SONO ANCORA NEL TIPO CONDIVISO ──
 *  Sono due delle 3 azioni nuove della STESSA rotta `/api/crm/fatture-chat`
 *  (PIANO §3bis), assegnate a T11 (in corso, non committato quando questo file
 *  è stato scritto): `dalla-chat/tipi.ts` non le ha ancora in `RichiestaChat`/
 *  `RispostaChat`. Sono quindi definite qui sotto in forma minima (§2 ), con
 *  gli stessi nomi di campo del contratto scritto in PIANO: si allineano da
 *  sole quando T11 le aggiunge al tipo condiviso (stessi nomi, stessa forma).
 *  Per lo stesso motivo (§0bis.3, già scelto da T5/T7 per `chat.server.ts` vs
 *  `bulk.server.ts`, e da T7 per `usa-lotto-chat.ts` vs `bulk/usa-lotto.ts`)
 *  questo file scrive una TERZA copia minima della sola lettura della risposta
 *  HTTP (`leggiRispostaHttp`/`conRete`): `chiamaRottaChat` di `usa-lotto-chat.ts`
 *  è cablata sul tipo `RichiestaChat`/`AzioneChat` di oggi e non accetta queste
 *  due azioni nuove. Si riusa invece, per IMPORT, tutto quello che è generico:
 *  `ROTTA` (stessa rotta, nessuna duplicazione del percorso), `ErroreRotta`/
 *  `fraseDi` (bulk/usa-lotto.ts, generici su `CodiceErrore`), `ErroreCoda`/
 *  `codiceDaStato` (bulk/coda.ts).
 *
 *  ── ⚠️ PERCHÉ L'ORCHESTRATORE È SEPARATO DALLA REACT ─────────────────────
 *  Stesso schema di `creaOrchestratoreChat`/`useLottoChat` in `usa-lotto-chat.ts`
 *  (T7): `creaOrchestratoreFattura` è una funzione pura che riceve «porte»
 *  (`fetchRotta`, `dispatch`, `stato`) e non sa niente di React — le prove la
 *  chiamano con porte finte, senza bisogno di una rete vera né di un renderer
 *  React. `useSelezioneFattura` è solo il filo che la lega a `useReducer`. */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { ErroreRotta, fraseDi } from "../bulk/usa-lotto";
import { ErroreCoda, codiceDaStato } from "../bulk/coda";
import { ROTTA } from "./usa-lotto-chat";
import { schedePerNumero } from "./abbinamento-numero";
import {
  commutaFattura,
  selezionabileFattura,
  type MessaggioBollaFattura,
} from "./selezione-fattura";
import { mediaDelPonte } from "../../chatwa/usaMediaPonte";
import type { CodiceErrore, RispostaErrore } from "../bulk/tipi";
import type { Lead } from "../../types";
import type { RigaChat } from "./tipi";

/* ══ 1. IL CONTRATTO MINIMO DI `aggiungi-da-chat`/`leggi-bolle` (PIANO §3bis) ═ */

export interface BollaFattura {
  tipo: "testo" | "immagine";
  id: string;
}

type RichiestaFattura =
  | { azione: "aggiungi-da-chat"; schedaId: string }
  | { azione: "leggi-bolle"; lotto: string; idRiga: string; bolle: BollaFattura[] };

type RispostaFattura =
  | { ok: true; azione: "aggiungi-da-chat"; lotto: string; riga: RigaChat }
  | { ok: true; azione: "leggi-bolle"; riga: RigaChat }
  | RispostaErrore;

type OkFattura<A extends RichiestaFattura["azione"]> = Extract<
  RispostaFattura,
  { azione: A; ok: true }
>;

/* ══ 2. LA CHIAMATA (terza copia minima, §0bis.3) ══════════════════════════ */

type FetchRotta = (url: string, init?: RequestInit) => Promise<Response>;

/** Stessa lettura della bulk/di T7 (non esportate di là): ogni uscita storta
 *  diventa un `ErroreRotta` col suo codice. */
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

async function conRete<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    // `ErroreRotta` ESTENDE `ErroreCoda`: un errore già strutturato passa intatto, solo un
    // guasto grezzo (`fetch` che lancia per la rete davvero caduta) diventa «rete».
    if (e instanceof ErroreCoda) throw e;
    throw new ErroreRotta("rete", fraseDi("rete"));
  }
}

function chiamaFattura<A extends RichiestaFattura["azione"]>(
  fetchRotta: FetchRotta,
  richiesta: Extract<RichiestaFattura, { azione: A }>,
): Promise<OkFattura<A>> {
  return conRete(async () => {
    const r = await fetchRotta(ROTTA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(richiesta),
    });
    return (await leggiRispostaHttp(r)) as OkFattura<A>;
  });
}

function messaggioErrore(e: unknown): string {
  if (e instanceof ErroreRotta) return e.messaggio;
  const codice: CodiceErrore = e instanceof ErroreCoda ? e.codice : "interno";
  return fraseDi(codice);
}

/* ══ 3. LO STATO E IL REDUCER (senza rete, senza React) ═══════════════════ */

/** Cosa mostrare dopo «Usa per fattura» (SPEC §9.3 passi 4-6). `zero-schede`/
 *  `scegli-scheda` sono i due dialoghi del passo 4 (T15 li apre riusando
 *  `onCreaScheda`/`AbbinaScheda`, già in `ConversazioneProps`); `pronta` porta
 *  `{lotto, idRiga}` per la navigazione (T16). */
export type FaseFattura =
  | { tipo: "inattiva" }
  | { tipo: "lavoro" }
  | { tipo: "zero-schede" }
  | { tipo: "scegli-scheda"; schede: Lead[] }
  | { tipo: "pronta"; lotto: string; idRiga: string }
  | { tipo: "errore"; messaggio: string };

export interface StatoFattura {
  /** Il numero della chat a cui appartiene la selezione corrente; `null` = nessuna chat aperta. */
  telefono: string | null;
  /** Gli id delle bolle scelte, nell'ordine di scelta (SPEC §9.6, tetto 10 via `commutaFattura`). */
  scelti: string[];
  /** Il tipo di ciascuna bolla scelta (testo/immagine), per costruire `bolle` di `leggi-bolle`. */
  tipi: Record<string, "testo" | "immagine">;
  fase: FaseFattura;
}

export const STATO_INIZIALE_FATTURA: StatoFattura = {
  telefono: null,
  scelti: [],
  tipi: {},
  fase: { tipo: "inattiva" },
};

export type AzioneFattura =
  /** La chat aperta è cambiata: SPEC §9.6, la selezione resta dentro una sola conversazione. */
  | { tipo: "telefono"; telefono: string | null }
  | { tipo: "commuta"; id: string; tipoBolla: "testo" | "immagine" }
  | { tipo: "azzera" }
  | { tipo: "fase"; fase: FaseFattura };

/** Pura: nessuna regola fiscale qui, solo lo stato della selezione e della fase. */
export function reducerFattura(s: StatoFattura, a: AzioneFattura): StatoFattura {
  switch (a.tipo) {
    case "telefono": {
      if (a.telefono === s.telefono) return s;
      // Cambiare chat annulla la selezione in corso (SPEC §9.4, ultimo punto).
      return { ...STATO_INIZIALE_FATTURA, telefono: a.telefono };
    }
    case "commuta": {
      const dopo = commutaFattura(s.scelti, a.id);
      const tipi = { ...s.tipi };
      if (dopo.includes(a.id)) tipi[a.id] = a.tipoBolla;
      else delete tipi[a.id];
      return { ...s, scelti: dopo, tipi };
    }
    case "azzera":
      return { ...STATO_INIZIALE_FATTURA, telefono: s.telefono };
    case "fase":
      return { ...s, fase: a.fase };
  }
}

/** Per `beforeunload`: chiudere la scheda mentre si sta creando la riga/leggendo le bolle
 *  lascerebbe il lavoro a metà. */
export const lavoroFatturaInCorso = (s: StatoFattura): boolean => s.fase.tipo === "lavoro";

/* ══ 4. L'ORCHESTRATORE (porte finte nelle prove, nessun React) ═══════════ */

export interface PorteFatturaBrowser {
  fetchRotta: FetchRotta;
  dispatch: (a: AzioneFattura) => void;
  stato: () => StatoFattura;
}

export function creaOrchestratoreFattura(p: PorteFatturaBrowser) {
  const chiama = <A extends RichiestaFattura["azione"]>(
    r: Extract<RichiestaFattura, { azione: A }>,
  ) => chiamaFattura(p.fetchRotta, r);

  /** Tocco lungo su una bolla (testo o immagine): accende/spegne la sua scelta. Non tocca niente
   *  mentre si sta già lavorando (si eviterebbe di mandare un pacchetto diverso da quello appena
   *  partito). `selezionabileFattura` (T13) decide se è una bolla vera; il tipo (testo/immagine) si
   *  deduce con `mediaDelPonte` (T13, import), stessa regola di `selezionabileFattura`. */
  function commuta(m: MessaggioBollaFattura): void {
    if (p.stato().fase.tipo === "lavoro") return;
    if (!selezionabileFattura(m)) return;
    const tipoBolla: "testo" | "immagine" = mediaDelPonte(m) !== null ? "immagine" : "testo";
    p.dispatch({ tipo: "commuta", id: m.id, tipoBolla });
  }

  /** Svuota la selezione senza procedere (es. «Annulla» nella pillola). */
  function azzera(): void {
    p.dispatch({ tipo: "azzera" });
  }

  const bolleDaInviare = (): BollaFattura[] =>
    p.stato().scelti.map((id) => ({ id, tipo: p.stato().tipi[id] ?? "testo" }));

  /** Passo 4b-6: la scheda è nota (una sola, o appena creata/scelta dal titolare). Crea/trova la riga
   *  (`aggiungi-da-chat`, idempotente lato server per la stessa scheda), poi legge le SOLE bolle
   *  scelte (`leggi-bolle`). Un errore qui non lascia uno stato a metà: fase `errore`, bolle intatte. */
  async function procedi(schedaId: string): Promise<{ lotto: string; idRiga: string } | null> {
    try {
      const ra = await chiama({ azione: "aggiungi-da-chat", schedaId });
      const rl = await chiama({
        azione: "leggi-bolle",
        lotto: ra.lotto,
        idRiga: ra.riga.idRiga,
        bolle: bolleDaInviare(),
      });
      const risultato = { lotto: ra.lotto, idRiga: rl.riga.idRiga };
      p.dispatch({ tipo: "fase", fase: { tipo: "pronta", ...risultato } });
      return risultato;
    } catch (e) {
      p.dispatch({ tipo: "fase", fase: { tipo: "errore", messaggio: messaggioErrore(e) } });
      return null;
    }
  }

  /** «Usa per fattura» (SPEC §9.3 passo 4): abbina il NUMERO della chat aperta a una scheda (T12).
   *  0 schede → `fase:"zero-schede"` (chi chiama invoca `onCreaScheda`, poi richiama `continua`);
   *  N schede → `fase:"scegli-scheda"` (chi chiama apre `AbbinaScheda`, poi richiama `continua`);
   *  1 sola → procede da sola, nessun'altra domanda. Ignorato se già in corso o già fatto (doppio
   *  tocco): la riga non si duplica, non si rilegge due volte la stessa chat. */
  async function usaPerFattura(
    leads: readonly Lead[],
  ): Promise<{ lotto: string; idRiga: string } | null> {
    const s = p.stato();
    if (s.fase.tipo === "lavoro" || s.fase.tipo === "pronta") return null;
    if (!s.telefono || s.scelti.length === 0) return null;
    p.dispatch({ tipo: "fase", fase: { tipo: "lavoro" } });
    const schede = schedePerNumero(leads, s.telefono);
    if (schede.length === 0) {
      p.dispatch({ tipo: "fase", fase: { tipo: "zero-schede" } });
      return null;
    }
    if (schede.length > 1) {
      p.dispatch({ tipo: "fase", fase: { tipo: "scegli-scheda", schede } });
      return null;
    }
    return procedi(schede[0].id);
  }

  /** Dopo che il titolare ha creato la scheda (0 schede) o scelto quale usare (N schede): riprende
   *  da qui con lo `schedaId` ormai noto. */
  function continua(schedaId: string): Promise<{ lotto: string; idRiga: string } | null> {
    const fase = p.stato().fase;
    if (fase.tipo === "lavoro" || fase.tipo === "pronta") return Promise.resolve(null);
    p.dispatch({ tipo: "fase", fase: { tipo: "lavoro" } });
    return procedi(schedaId);
  }

  return { commuta, azzera, usaPerFattura, continua };
}

/* ══ 5. L'HOOK ══════════════════════════════════════════════════════════════ */

/** Il token del consulente sta in `fetchCRM`. Si carica al primo uso: importarlo in cima
 *  trascinerebbe la sessione (Supabase) anche dove serve solo la logica, come nelle prove
 *  (stesso schema di `usa-lotto-chat.ts`). */
const fetchDelConsulente: FetchRotta = async (url, init) =>
  (await import("@/crm/AuthContext")).fetchCRM(url, init);

/** `telefono`: il numero della chat aperta (o `null`, nessuna chat). Cambiando, la selezione si
 *  azzera da sola (SPEC §9.6). `fatturaAttiva` è vero appena c'è almeno una bolla scelta: lo stato
 *  che PIANO §0bis.1/T15 userà per spegnere «Rispiega con AI» mentre questa selezione è in corso. */
export function useSelezioneFattura(telefono: string | null) {
  const [stato, dispatchReact] = useReducer(reducerFattura, {
    ...STATO_INIZIALE_FATTURA,
    telefono,
  });
  const specchio = useRef(stato);
  const dispatch = useCallback((a: AzioneFattura) => {
    specchio.current = reducerFattura(specchio.current, a);
    dispatchReact(a);
  }, []);

  useEffect(() => {
    dispatch({ tipo: "telefono", telefono });
  }, [telefono, dispatch]);

  const azioni = useMemo(
    () =>
      creaOrchestratoreFattura({
        fetchRotta: fetchDelConsulente,
        dispatch,
        stato: () => specchio.current,
      }),
    [dispatch],
  );

  const inCorso = lavoroFatturaInCorso(stato);
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
    scelti: stato.scelti,
    fase: stato.fase,
    fatturaAttiva: stato.scelti.length > 0,
    ...azioni,
  };
}
