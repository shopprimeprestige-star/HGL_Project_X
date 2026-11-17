/** ── LE AZIONI SULL'ORDINE ──────────────────────────────────────────────────
 *  Commessa 2026-11-17-crm-ecommerce (T8). Modulo PURO: niente React, niente database.
 *
 *  Riceve l'ordine com'è adesso (già letto da `normalizzaOrdine`) e la richiesta della pagina,
 *  e restituisce TUTTO ciò che la rotta deve scrivere, senza scrivere niente:
 *   - `patch`       le colonne di `shop_orders` da aggiornare (solo la lista bianca `CHIAVI_PATCH`);
 *   - `condizioni`  ciò che deve essere ANCORA vero al momento della scrittura (D10): colonna → valore
 *                   visto, `null` = «è ancora vuota». Se non combacia la rotta risponde 409;
 *   - `evento`      la riga per `shop_order_eventi` (la rotta aggiunge solo `chi`).
 *  Oppure un errore leggibile con il suo `motivo`.
 *
 *  Si identifica per `id` UUID, mai per `order_ref` (non è univoco). Nessuna azione cancella niente
 *  (D11): una richiesta «elimina», «cancella», «delete»… è `azione_sconosciuta`.
 *  Le azioni di collegamento al lead (`collega`, `scollega`, `senza_lead`) sono di R3 (T8b).
 *
 *  ── OBBLIGHI PER CHI SCRIVE LA ROTTA (T9), dal parere del revisore ────────────────────────────────
 *  1. I valori di `condizioni` si passano al database TALE E QUALE: mai attraverso `new Date()` (perde i
 *     microsecondi di `pagato_il` e il confronto non combacia mai).
 *  2. `null` in `condizioni` = «vuota»: per le colonne data (`pagato_il`) è `.is(col, null)`, MAI `.eq(col, null)`;
 *     per le colonne di testo (`status`, `tracking`, `note_interne`) è «NULL oppure ''»
 *     (`.or("col.is.null,col.eq.")`), perché una riga scritta a mano può avere il testo vuoto invece di NULL.
 *  3. L'`update` deve chiedere indietro le righe (`.select("id")`) e 0 righe = 409 `conflitto`: PostgREST risponde
 *     200 anche se nessuna riga combacia, e senza questo controllo la concorrenza (D10) non funziona.
 *  4. Se 0 righe, e il valore normalizzato di testo era uguale al visto (riga con spazi ai bordi scritta a mano:
 *     la condizione tagliata non combacia), rileggere la riga UNA volta prima di rispondere 409.
 *  5. Una prova su dato vero con un `pagato_il` a microsecondi (es. `2026-11-17T15:00:00.123456+00:00`). */
import { ETICHETTA_METODO, STATI_ORDINE, importoIncassato, type MetodoPagamento, type Ordine, type StatoOrdine } from "./ordine";

export type Azione =
  | { azione: "stato"; ordineId: string; a: StatoOrdine; da: StatoOrdine }
  | { azione: "pagato"; ordineId: string; metodo: MetodoPagamento; importo?: number | string; data?: string }
  | { azione: "pagamento_annullato"; ordineId: string }
  | { azione: "tracking"; ordineId: string; valore: string }
  | { azione: "nota_interna"; ordineId: string; valore: string };

/** Perché un'azione non parte. `nessun_cambio` non è un guasto: la pagina può solo ignorarlo. */
export type MotivoErrore = "valore" | "conflitto" | "nessun_cambio" | "azione_sconosciuta";

/** La riga per `shop_order_eventi` (nomi delle colonne); la rotta aggiunge `chi`. */
export interface EventoOrdine {
  order_id: string;
  order_ref: string;
  tipo: "stato" | "pagato" | "pagamento_annullato" | "tracking" | "nota_interna";
  prima: Record<string, unknown>;
  dopo: Record<string, unknown>;
}

export type EsitoAzione =
  | { ok: true; patch: Record<string, unknown>; condizioni: Record<string, unknown>; evento: EventoOrdine }
  | { ok: false; errore: string; motivo: MotivoErrore };

/** Le sole colonne che una azione può scrivere: mai dati del cliente, righe o totali. */
export const CHIAVI_PATCH: readonly string[] = ["status", "pagato_il", "pagato_importo", "metodo_pagamento", "tracking", "note_interne", "lead_id", "senza_lead", "aggiornato_il"];

export const LIMITI = { tracking: 120, nota: 2000, importoMax: 100000, anticipoDataMs: 60_000 } as const;
// shortcut: 1 minuto di tolleranza sulla data di pagamento (orologio del browser un po' avanti); stringere se serve la data esatta
const GIORNO_MS = 86_400_000;
/** Il giorno di calendario di un istante, a Roma (AAAA-MM-GG). shortcut: fuso fisso, il negozio è italiano; da parametrizzare se serve un altro fuso. */
const giornoRoma = (d: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
const SOLO_GIORNO = /^\d{4}-\d{2}-\d{2}$/;
/** ISO con fuso: AAAA-MM-GGThh:mm[:ss[.frazione]]Z oppure ±hh:mm (anche con lo spazio al posto di T, come lo rende Postgres). */
const ISTANTE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;
/** Importo scritto a mano: cifre, con virgola o punto e al massimo due decimali («12,5», «12.50»). Niente «1e3», «0x10», «.5», migliaia. */
const IMPORTO_TESTO = /^\d+([.,]\d{1,2})?$/;

const METODI: readonly string[] = Object.keys(ETICHETTA_METODO);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Carattere nullo e simili: Postgres rifiuta il nullo nei testi, il resto non ha senso in un tracking. */
const CONTROLLO_TRACKING = /[\u0000-\u001f\u007f]/;
const CONTROLLO_NOTA = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/; // a capo e tab ammessi

export const eUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const errore = (motivo: MotivoErrore, testo: string): EsitoAzione => ({ ok: false, errore: testo, motivo });
const eOggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const euro = (n: number): number => Math.round(n * 100) / 100;

/** Importo come numero finito da testo o numero; «» / null / undefined = non dato (`undefined`); altro illeggibile = NaN. */
function leggiImporto(v: unknown): number | undefined {
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) return undefined;
  if (typeof v === "number") return v;
  const t = typeof v === "string" ? v.trim() : "";
  return IMPORTO_TESTO.test(t) ? Number(t.replace(",", ".")) : NaN;
}

function stato(a: Record<string, unknown>, o: Ordine, adesso: Date): EsitoAzione {
  const da = a.da, nuovo = a.a;
  const noto = (s: unknown): s is StatoOrdine => typeof s === "string" && (STATI_ORDINE as readonly string[]).includes(s);
  if (!noto(da) || !noto(nuovo)) return errore("valore", "Stato non valido: scegli uno degli stati dell'elenco.");
  if (da !== o.stato) return errore("conflitto", "Lo stato dell'ordine è cambiato nel frattempo: ricarica e riprova.");
  if (nuovo === o.stato) return errore("nessun_cambio", "L'ordine è già in questo stato.");
  return {
    ok: true,
    // condizione = lo stato com'è scritto in tabella (se è uno sconosciuto, letto come «nuovo», si confronta il testo vero)
    patch: { status: nuovo, aggiornato_il: adesso.toISOString() },
    condizioni: { status: o.statoGrezzo || null }, // status vuoto o NULL in tabella → «vuoto» (vedi obbligo 2)
    evento: { order_id: o.id, order_ref: o.ref, tipo: "stato", prima: { stato: da }, dopo: { stato: nuovo } },
  };
}

/** La data del pagamento: un istante ISO con fuso, oppure un solo giorno (campo data della pagina). Una `Date`, o il testo dell'errore. */
function dataPagamento(v: unknown, o: Ordine, adesso: Date): Date | string {
  const t = typeof v === "string" ? v.trim() : "";
  const giorno = SOLO_GIORNO.test(t);
  if (!giorno && !ISTANTE.test(t)) return "La data del pagamento non si legge: serve il formato AAAA-MM-GG.";
  const istante = Date.parse(giorno ? `${t}T00:00:00Z` : t);
  // 2026-02-31 viene letto da qualcuno come 3 marzo: si rifiuta se il giorno scritto non è quello che ne esce
  if (Number.isNaN(istante) || (giorno && new Date(istante).toISOString().slice(0, 10) !== t)) return "La data del pagamento non si legge.";
  const minimo = new Date(Date.parse(o.creatoIl) - GIORNO_MS); // non prima del giorno prima dell'ordine
  if (giorno ? t < giornoRoma(minimo) : istante < minimo.getTime()) return "La data del pagamento non può essere precedente all'ordine.";
  // «solo giorno»: si confronta il giorno con quello di oggi a Roma (scegliere «oggi» dopo mezzanotte non è «futuro»)
  if (giorno ? t > giornoRoma(adesso) : istante > adesso.getTime() + LIMITI.anticipoDataMs) return "La data del pagamento non può essere nel futuro.";
  return new Date(Math.min(istante, adesso.getTime())); // un giorno di oggi (mezzanotte UTC) non finisce mai nel futuro
}

function pagato(a: Record<string, unknown>, o: Ordine, adesso: Date): EsitoAzione {
  const metodo = a.metodo;
  if (typeof metodo !== "string" || !METODI.includes(metodo)) return errore("valore", "Metodo di pagamento non valido: scegli bonifico, contanti, carta o altro.");
  const importo = leggiImporto(a.importo) ?? o.totale; // di partenza, il totale dell'ordine
  if (!Number.isFinite(importo) || importo < 0 || importo > LIMITI.importoMax)
    return errore("valore", `L'importo deve essere un numero tra 0 e ${LIMITI.importoMax}: scrivi quanto è stato incassato.`);

  let quando = adesso;
  if (a.data !== undefined && a.data !== null && a.data !== "") {
    const q = dataPagamento(a.data, o, adesso);
    if (typeof q === "string") return errore("valore", q);
    quando = q;
  }
  if (o.pagatoIl !== null) return errore("conflitto", "L'ordine risulta già pagato: ricarica la pagina.");

  const dopo = { pagato_il: quando.toISOString(), pagato_importo: euro(importo), metodo_pagamento: metodo };
  return {
    ok: true,
    patch: { ...dopo, aggiornato_il: adesso.toISOString() },
    condizioni: { pagato_il: null },
    evento: { order_id: o.id, order_ref: o.ref, tipo: "pagato", prima: { pagato_il: null, pagato_importo: null, metodo_pagamento: null }, dopo },
  };
}

function pagamentoAnnullato(o: Ordine, adesso: Date): EsitoAzione {
  if (o.pagatoIl === null) return errore("conflitto", "L'ordine non risulta pagato: non c'è un pagamento da annullare.");
  return {
    ok: true,
    patch: { pagato_il: null, pagato_importo: null, metodo_pagamento: null, aggiornato_il: adesso.toISOString() },
    condizioni: { pagato_il: o.pagatoIl },
    // lo storico conserva ciò che c'era (e quanto contava come incassato), così il pagamento annullato non si perde
    evento: {
      order_id: o.id, order_ref: o.ref, tipo: "pagamento_annullato",
      prima: { pagato_il: o.pagatoIl, pagato_importo: importoIncassato(o), metodo_pagamento: o.metodoPagamento },
      dopo: { pagato_il: null, pagato_importo: null, metodo_pagamento: null },
    },
  };
}

/** Tracking e nota interna: stesso schema, cambiano colonna, tetto e caratteri ammessi. */
function testoLibero(a: Record<string, unknown>, o: Ordine, adesso: Date, tipo: "tracking" | "nota_interna"): EsitoAzione {
  const tracking = tipo === "tracking";
  const nome = tracking ? "Il numero di tracking" : "La nota";
  const max = tracking ? LIMITI.tracking : LIMITI.nota;
  if (typeof a.valore !== "string") return errore("valore", `${nome} deve essere un testo.`);
  const v = a.valore.trim();
  if (v.length > max) return errore("valore", `${nome} è troppo lungo: al massimo ${max} caratteri.`);
  if ((tracking ? CONTROLLO_TRACKING : CONTROLLO_NOTA).test(v)) return errore("valore", `${nome} contiene caratteri non ammessi.`);

  const colonna = tracking ? "tracking" : "note_interne";
  const prima = tracking ? o.tracking : o.noteInterne;
  const dopo = v || null; // vuoto = si toglie
  if (dopo === prima) return errore("nessun_cambio", `${nome} è già quello.`);
  return {
    ok: true,
    patch: { [colonna]: dopo, aggiornato_il: adesso.toISOString() },
    condizioni: { [colonna]: prima },
    evento: { order_id: o.id, order_ref: o.ref, tipo, prima: { [colonna]: prima }, dopo: { [colonna]: dopo } },
  };
}

/** Valida la richiesta della pagina contro l'ordine com'è e costruisce ciò che la rotta deve scrivere. Non lancia, non muta `attuale`. */
export function costruisciAzione(richiesta: unknown, attuale: Ordine, adesso: Date): EsitoAzione {
  if (!eOggetto(richiesta)) return errore("valore", "Richiesta non valida.");
  const nome = richiesta.azione;
  if (nome !== "stato" && nome !== "pagato" && nome !== "pagamento_annullato" && nome !== "tracking" && nome !== "nota_interna")
    return errore("azione_sconosciuta", "Azione non prevista.");
  if (!eUuid(richiesta.ordineId) || richiesta.ordineId !== attuale.id) return errore("valore", "Ordine non valido.");

  switch (nome) {
    case "stato": return stato(richiesta, attuale, adesso);
    case "pagato": return pagato(richiesta, attuale, adesso);
    case "pagamento_annullato": return pagamentoAnnullato(attuale, adesso);
    default: return testoLibero(richiesta, attuale, adesso, nome);
  }
}
