/** ── LA SCHEDA «ORDINI»: LE REGOLE, SENZA SCHERMO (ordini-ui.ts) ───────────────
 *  Commessa 2026-11-17-crm-ecommerce, T12 (SPEC §3.2-3.3). Modulo PURO: niente React, niente rete, niente orologio
 *  (l'«adesso» si passa). Decide quello che `ElencoOrdini.tsx` e `DettaglioOrdine.tsx` devono fare uguale in ogni caso:
 *   · quali ordini si vedono (periodo, stato, pagato, ricerca) e in che ordine;
 *   · quando un'azione chiede conferma, e che cosa dice la conferma;
 *   · che frase si mostra dopo ogni azione (riuscita, storico mancato, conflitto, errore);
 *   · come si legge lo storico degli eventi.
 *  Le regole di validazione NON sono qui: `controllaPagamento` chiede a `costruisciAzione` (T8), la stessa funzione che
 *  userà la rotta, così la pagina e il server non possono dire due cose diverse.
 *
 *  ⚠️ Gli ordini si trovano per `id`, mai per numero ordine (`order_ref` non è univoco).
 *  ⚠️ Il periodo è `nelPeriodo` di conti.ts: una cifra della Panoramica e le righe qui sotto contano gli stessi ordini. */
import { costruisciAzione } from "./azioni";
import type { Azione } from "./azioni";
import { importoFuoriNorma, nelPeriodo } from "./conti";
import type { Periodo } from "./conti";
import type { EventoStorico, RisultatoAzione } from "./client";
import {
  ETICHETTA_METODO,
  ETICHETTA_STATO,
  STATI_ORDINE,
  chiaveTelefono,
  eAnnullato,
  eIncassato,
  importoIncassato,
  nomeCliente,
  totaleCoerente,
} from "./ordine";
import type { Ordine, StatoOrdine } from "./ordine";
import { AVVISO_MIGRAZIONE, euro } from "./pagina";

/** Quante righe si disegnano per volta: con migliaia di ordini nel periodo la pagina non deve disegnarli tutti. */
export const PAGINA_RIGHE = 100;
const RICERCA_MAX = 100;

export type FiltroPagato = "si" | "no";

export interface Filtri {
  periodo: Periodo;
  stato?: StatoOrdine;
  /** Assente = tutti. «Sì» include gli annullati pagati: è la stessa regola di «Incassato». */
  pagato?: FiltroPagato;
  ricerca?: string;
}

/** I toni del CRM (`Chip`) per ogni stato: serve a distinguerli a colpo d'occhio, il nome è sempre scritto. */
export const TONO_STATO_ORDINE = {
  nuovo: "da_lavorare",
  in_preparazione: "in_sospeso",
  spedito: "in_corso",
  consegnato: "vinta",
  annullato: "persa",
} as const satisfies Record<StatoOrdine, string>;

// ── ricerca ────────────────────────────────────────────────────────────────

/** Minuscolo e senza accenti: «nicolo» trova «Nicolò». */
const norma = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const cifre = (s: string): string => s.replace(/\D/g, "");
/** Solo cifre e segni da telefono: si cerca come numero, scritto in qualunque modo. */
const COME_NUMERO = /^[\d\s+().-]+$/;

function combacia(o: Ordine, q: string): boolean {
  const ref = o.ref.toLowerCase();
  if (COME_NUMERO.test(q)) {
    //  `+39 300…`, `0039 300…` e `300…` sono lo stesso numero (ultime nove cifre, come in tutto il CRM); le sole ultime cifre bastano.
    const qd = cifre(q);
    const telefono = cifre(o.telefono);
    const k = chiaveTelefono(q);
    return (
      (qd.length >= 3 && telefono.includes(qd)) ||
      (k !== "" && k === chiaveTelefono(o.telefono)) ||
      ref.includes(q)
    );
  }
  const fieno = `${norma(o.nome)} ${norma(o.cognome)} ${norma(o.email)} ${norma(ref)}`;
  return q.split(/\s+/).every((parola) => fieno.includes(parola));
}

// ── l'elenco ───────────────────────────────────────────────────────────────

const quando = (o: Ordine): number => {
  const t = Date.parse(o.creatoIl);
  return Number.isFinite(t) ? t : 0;
};

function passa(o: Ordine, f: Omit<Filtri, "stato">, q: string): boolean {
  if (!nelPeriodo(o, f.periodo)) return false;
  if (f.pagato === "si" && !eIncassato(o)) return false;
  if (f.pagato === "no" && eIncassato(o)) return false;
  return !q || combacia(o, q);
}
const domanda = (r?: string): string =>
  norma(String(r ?? ""))
    .trim()
    .slice(0, RICERCA_MAX);

/** Gli ordini che si vedono, dal più recente. Non muta l'elenco in ingresso. */
export function filtraOrdini(ordini: Ordine[], f: Filtri): Ordine[] {
  const q = domanda(f.ricerca);
  return ordini
    .filter((o) => (!f.stato || o.stato === f.stato) && passa(o, f, q))
    .sort((a, b) => quando(b) - quando(a) || (a.id < b.id ? -1 : 1));
}

/** Quanti ordini per stato con gli ALTRI filtri applicati (lo stato scelto no: serve a poter cambiare filtro). */
export function conteggiPerStato(
  ordini: Ordine[],
  f: Filtri,
): Record<StatoOrdine, number> & { tutti: number } {
  const q = domanda(f.ricerca);
  const n = { tutti: 0 } as Record<StatoOrdine, number> & { tutti: number };
  for (const s of STATI_ORDINE) n[s] = 0;
  for (const o of ordini) {
    if (!passa(o, f, q)) continue;
    n[o.stato]++;
    n.tutti++;
  }
  return n;
}

/** L'ordine con quell'identificativo (UUID), o `null`. Mai per numero ordine. */
export const ordineDaId = (ordini: Ordine[], id: string | undefined): Ordine | null =>
  (id && ordini.find((o) => o.id === id)) || null;

// ── il pagamento ───────────────────────────────────────────────────────────

/** L'importo di partenza del campo: il totale, con la virgola. Vuoto se il totale è fuori norma (si scrive a mano). */
export function importoDiPartenza(o: Pick<Ordine, "totale">): string {
  const t = o.totale;
  return Number.isFinite(t) && t >= 0 && t <= 100_000 ? t.toFixed(2).replace(".", ",") : "";
}

export interface FormPagamento {
  metodo: unknown;
  importo: unknown;
  data: unknown;
}

/** Il modulo «Segna come pagato» → l'azione per la rotta, oppure la frase da mostrare. Lo decide `costruisciAzione`. */
export function controllaPagamento(
  o: Ordine,
  f: FormPagamento | undefined,
  adesso: Date,
): { ok: true; azione: Azione } | { ok: false; errore: string } {
  const metodo = f?.metodo;
  const azione = {
    azione: "pagato",
    ordineId: o.id,
    metodo,
    importo: f?.importo,
    data: f?.data,
  } as Azione;
  const r = costruisciAzione(azione, o, adesso);
  return r.ok ? { ok: true, azione } : { ok: false, errore: r.errore };
}

// ── conferme ───────────────────────────────────────────────────────────────

/** «Annullato» come stato e «Annulla pagamento» chiedono sempre conferma; il resto no. */
export const serveConferma = (a: Azione): boolean =>
  (a?.azione === "stato" && a.a === "annullato") || a?.azione === "pagamento_annullato";

export interface TestoConferma {
  titolo: string;
  testo: string;
  /** Il tasto che conferma. */
  si: string;
}

export function testoConferma(a: Azione, o: Ordine): TestoConferma | null {
  if (a?.azione === "stato" && a.a === "annullato")
    return {
      titolo: `Annullare l'ordine ${o.ref}?`,
      testo:
        `L'ordine di ${nomeCliente(o)} resta nell'elenco e nello storico, ma non conta più fra gli ordini e da incassare. Lo puoi rimettere in un altro stato. Il cliente non riceve nessun messaggio.` +
        (eIncassato(o)
          ? " Risulta già pagato: il pagamento resta registrato e continua a contare come incassato (i rimborsi non si gestiscono qui)."
          : ""),
      si: "Sì, annulla l'ordine",
    };
  if (a?.azione === "pagamento_annullato")
    return {
      titolo: `Annullare il pagamento di ${euro(importoIncassato(o))}?`,
      testo: `L'ordine ${o.ref} torna «da incassare». Il pagamento (importo, metodo e data) resta scritto nello storico.`,
      si: "Sì, annulla il pagamento",
    };
  return null;
}

/** I comandi si accendono solo con la migrazione pronta; «non so ancora» e «mancante» li spengono. */
export const comandiAttivi = (migrazionePronta: boolean | null): boolean =>
  migrazionePronta === true;
export { AVVISO_MIGRAZIONE };

// ── le frasi dopo un'azione ────────────────────────────────────────────────

export interface Esito {
  tono: "ok" | "avviso" | "errore";
  testo: string;
}

const FRASE_OK: Record<Azione["azione"], string> = {
  stato: "Stato aggiornato.",
  pagato: "Pagamento registrato.",
  pagamento_annullato: "Pagamento annullato: resta nello storico.",
  tracking: "Tracking salvato.",
  nota_interna: "Nota salvata.",
};

/** Cosa dire dopo un'azione. Ogni risposta della rotta ha una frase: nessuna resta muta. */
export function esitoAzione(r: RisultatoAzione, a: Azione): Esito {
  if (!r.ok) {
    const { tipo, messaggio } = r.errore;
    if (tipo === "conflitto")
      return {
        tono: "errore",
        testo:
          "Un collega l'ha appena modificato: ho ricaricato l'ordine. Controlla com'è adesso e riprova.",
      };
    if (tipo === "non_trovato")
      return { tono: "errore", testo: "Non trovo più questo ordine: ho ricaricato l'elenco." };
    return { tono: "errore", testo: messaggio };
  }
  if (r.nessunCambio) return { tono: "ok", testo: "Era già così: non ho cambiato niente." };
  if (!r.storico)
    return {
      tono: "avviso",
      testo:
        "Modifica salvata, ma la riga nello storico non si è scritta: l'ordine è a posto, lo storico no.",
    };
  if (a.azione === "tracking" && !a.valore.trim()) return { tono: "ok", testo: "Tracking tolto." };
  return { tono: "ok", testo: FRASE_OK[a.azione] ?? "Fatto." };
}

// ── avvisi sull'ordine ─────────────────────────────────────────────────────

/** Cose che chi guarda l'ordine deve sapere prima di fidarsi dei numeri. */
export function avvisiOrdine(o: Ordine): string[] {
  const v: string[] = [];
  if (importoFuoriNorma(o))
    v.push(
      "Un importo di questo ordine è fuori norma (negativo o troppo grande): nelle cifre della Panoramica vale 0.",
    );
  if (!totaleCoerente(o))
    v.push(
      "Il totale non torna con le righe e la spedizione: controlla gli importi prima di segnare il pagamento.",
    );
  if (o.righeTroncate) v.push("L'ordine ha moltissime righe: se ne vedono solo le prime.");
  if (o.statoGrezzo && !(STATI_ORDINE as readonly string[]).includes(o.statoGrezzo.toLowerCase()))
    v.push(
      `In tabella lo stato è scritto «${o.statoGrezzo.slice(0, 40)}», che non conosciamo: qui è letto come «Nuovo».`,
    );
  if (eAnnullato(o) && eIncassato(o))
    v.push(
      "L'ordine è annullato ma risulta pagato: i soldi contano come incassati. I rimborsi non si gestiscono qui.",
    );
  return v;
}

// ── lo storico ─────────────────────────────────────────────────────────────

const eOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const testoDi = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** «18 nov, 14:32» (con l'anno se non è questo). `—` se la data non si legge. */
export function dataOra(iso: string | null | undefined): string {
  const t = typeof iso === "string" ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "—";
  const d = new Date(t);
  const giorno = d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "2-digit" }),
  });
  return `${giorno}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const nomeStato = (v: unknown): string =>
  (STATI_ORDINE as readonly string[]).includes(String(v))
    ? ETICHETTA_STATO[v as StatoOrdine]
    : testoDi(v, 40) || "—";
const nomeMetodo = (v: unknown): string =>
  typeof v === "string" && v in ETICHETTA_METODO
    ? ETICHETTA_METODO[v as keyof typeof ETICHETTA_METODO]
    : testoDi(v, 40);
const giornoDi = (v: unknown): string => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })
    : "";
};
const importoDi = (v: unknown): string =>
  typeof v === "number" && Number.isFinite(v) ? euro(v) : "";
const unisci = (...p: string[]): string => p.filter(Boolean).join(" · ");

export interface RigaStorico {
  titolo: string;
  dettaglio: string;
  chi: string;
  quando: string;
}

/** Un evento di `shop_order_eventi` in due righe di italiano. Dati rotti o tipi nuovi non lanciano: diventano una riga generica. */
export function descriviEvento(e: EventoStorico): RigaStorico {
  const prima = eOggetto(e?.prima) ? e.prima : {};
  const dopo = eOggetto(e?.dopo) ? e.dopo : {};
  let titolo = "Modifica all'ordine";
  let dettaglio = "";
  switch (e?.tipo) {
    case "stato":
      titolo = "Stato cambiato";
      dettaglio = `${nomeStato(prima.stato)} → ${nomeStato(dopo.stato)}`;
      break;
    case "pagato":
      titolo = "Segnato come pagato";
      dettaglio = unisci(
        importoDi(dopo.pagato_importo),
        nomeMetodo(dopo.metodo_pagamento),
        giornoDi(dopo.pagato_il),
      );
      break;
    case "pagamento_annullato":
      titolo = "Pagamento annullato";
      dettaglio = `Era: ${unisci(importoDi(prima.pagato_importo), nomeMetodo(prima.metodo_pagamento), giornoDi(prima.pagato_il))}`;
      break;
    case "tracking": {
      const nuovo = testoDi(dopo.tracking);
      titolo = nuovo ? "Tracking aggiornato" : "Tracking tolto";
      dettaglio = nuovo;
      break;
    }
    case "nota_interna": {
      const nuova = testoDi(dopo.note_interne, 140);
      titolo = nuova ? "Nota interna aggiornata" : "Nota interna tolta";
      dettaglio = nuova;
      break;
    }
  }
  return { titolo, dettaglio, chi: testoDi(e?.chi, 100) || "—", quando: dataOra(e?.creatoIl) };
}

/** Dal più recente; le date che non si leggono in fondo. Non muta l'elenco. */
export function ordinaEventi(eventi: EventoStorico[]): EventoStorico[] {
  const t = (e: EventoStorico): number => {
    const x = Date.parse(e.creatoIl);
    return Number.isFinite(x) ? x : -Infinity;
  };
  return eventi.slice().sort((a, b) => (t(a) === t(b) ? 0 : t(b) > t(a) ? 1 : -1));
}
