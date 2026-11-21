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
 *  ── RILASCIO 2 (T47; PIANO-R2 D55) ─────────────────────────────────────────────────────────────────
 *  Otto azioni nuove, sempre pure: `spedisci`, `annulla`, `rimborso`, `riconcilia`, `fattura_emessa`, `email_invia`, `giacenza_verificata`,
 *  `correggi_stato`. Le cinque vecchie non cambiano di una riga di comportamento, con UN vincolo: per un ordine con `stato_pagamento` valorizzato
 *  (la cassa Stripe) `pagato`, `pagamento_annullato`, `tracking` e `stato → spedito|annullato` sono rifiutati («usa Controlla con Stripe / Spedisci /
 *  Annulla»); per gli ordini di prima (colonna vuota, `statoPagamento === null`) TUTTO resta com'è, e motivo e corriere non si impongono (SPEC 8A n. 7).
 *  Il terzo argomento facoltativo, `contesto`, porta ciò che l'ordine da solo non sa: i rimborsi (`shop_rimborsi`) e l'elenco dei corrieri.
 *  Alcune azioni non scrivono colonne ma chiedono al server di fare qualcosa (`effetti`: rimborso, giacenza, sessione di Stripe, email, riconciliazione):
 *  la rotta li esegue con le funzioni SQL e mai con una scrittura diretta; `patch` può essere vuoto (la rotta, allora, non fa l'`update`).
 *  Per quelle azioni lo storico lo scrivono già le funzioni SQL: la rotta decide se aggiungere anche `evento`.
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
import { ETICHETTA_METODO, ETICHETTA_STATO, STATI_ORDINE, importoIncassato, type MetodoPagamento, type Ordine, type StatoOrdine } from "./ordine";
import { PASSAGGI_EVASIONE, puoLavorare, statoPagamentoDi } from "./pagamento";
import { controllaRimborso, haRimborsoAttivo, massimoRimborsabileCent, rimborsiLeggibili } from "./rimborso";
import { CORRIERI_DI_PARTENZA, costruisciLink, numeroValido } from "./tracking";

export type Azione =
  | { azione: "stato"; ordineId: string; a: StatoOrdine; da: StatoOrdine }
  | { azione: "pagato"; ordineId: string; metodo: MetodoPagamento; importo?: number | string; data?: string }
  | { azione: "pagamento_annullato"; ordineId: string }
  | { azione: "tracking"; ordineId: string; valore: string }
  | { azione: "nota_interna"; ordineId: string; valore: string }
  // ── Rilascio 2 (D55): le scelte che il server impone sono facoltative nel tipo perché per gli ordini di prima non si chiedono ──
  | { azione: "spedisci"; ordineId: string; corriere?: string; numero?: string; senzaTracking?: boolean }
  | { azione: "annulla"; ordineId: string; motivo?: string; rimborso?: "ora" | "nessuno"; rimettiInMagazzino?: boolean; chiaveRichiesta?: string }
  | { azione: "rimborso"; ordineId: string; importoCent?: number; motivo?: string; chiaveRichiesta?: string; conferma?: boolean }
  | { azione: "riconcilia"; ordineId: string }
  | { azione: "fattura_emessa"; ordineId: string; nota?: string }
  | { azione: "email_invia"; ordineId: string; chiave: ChiaveEmailOrdine }
  | { azione: "giacenza_verificata"; ordineId: string }
  | { azione: "correggi_stato"; ordineId: string; da: StatoOrdine; a: StatoOrdine; motivo: string };

/** I cinque messaggi dello shop (D53); la lista vera dei modelli sta nel database. */
export type ChiaveEmailOrdine = "conferma_ordine" | "spedito" | "pagamento_non_riuscito" | "rimborso" | "annullato";
const CHIAVI_EMAIL: readonly string[] = ["conferma_ordine", "spedito", "pagamento_non_riuscito", "rimborso", "annullato"];

/** Ciò che l'ordine da solo non sa. `rimborsi` = le righe di `shop_rimborsi` come `{importoCent, stato}`; `corrieri` = `[{nome, modello}]` di `shop_impostazioni`. */
export interface ContestoAzione {
  rimborsi?: unknown;
  corrieri?: unknown;
  /** I tipi di `effetti` che la rotta ESEGUE davvero. Senza, nessuno: un'azione che chiede un effetto non gestito è rifiutata (fallisce chiuso),
   *  così non si applica la sola patch di stato lasciando indietro rimborso, giacenza o sessione. T53/T57 dichiarano qui ciò che implementano. */
  effettiGestiti?: readonly Effetto["tipo"][];
}

/** Una cosa che la rotta deve far fare al server, già validata. Mai una scrittura diretta: sono le funzioni SQL e Stripe. */
export type Effetto =
  | { tipo: "rimborso"; importoCent: number; motivo: string; chiaveRichiesta: string }
  | { tipo: "giacenza_rimetti" }
  | { tipo: "scadi_sessione" }
  | { tipo: "riconcilia" }
  | { tipo: "email"; chiave: string; manuale: true };

/** Perché un'azione non parte. `nessun_cambio` non è un guasto: la pagina può solo ignorarlo. */
export type MotivoErrore = "valore" | "conflitto" | "nessun_cambio" | "azione_sconosciuta";

/** La riga per `shop_order_eventi` (nomi delle colonne); la rotta aggiunge `chi`. */
export interface EventoOrdine {
  order_id: string;
  order_ref: string;
  tipo:
    | "stato" | "pagato" | "pagamento_annullato" | "tracking" | "nota_interna"
    | "spedito" | "annullato" | "rimborso_richiesto" | "riconciliato" | "fattura_emessa" | "email_inviata" | "giacenza_verificata" | "stato_corretto";
  prima: Record<string, unknown>;
  dopo: Record<string, unknown>;
}

export type EsitoAzione =
  | { ok: true; patch: Record<string, unknown>; condizioni: Record<string, unknown>; evento: EventoOrdine; effetti?: Effetto[] }
  | { ok: false; errore: string; motivo: MotivoErrore };

/** Le sole colonne che una azione può scrivere: mai dati del cliente, righe o totali. */
export const CHIAVI_PATCH: readonly string[] = [
  "status", "pagato_il", "pagato_importo", "metodo_pagamento", "tracking", "note_interne", "lead_id", "senza_lead", "aggiornato_il",
  // Rilascio 2 (S4): spedizione, annullo, fattura, giacenza. Mai i soldi (`pagato_*`, `rimborsato_cent`, `stato_pagamento`): li scrivono solo le funzioni SQL.
  "spedito_il", "corriere", "tracking_url", "senza_tracking", "annullo_motivo", "annullato_il", "fattura_emessa_il", "fattura_nota", "giacenza_da_verificare",
];

export const LIMITI = { tracking: 120, nota: 2000, importoMax: 100000, anticipoDataMs: 60_000, motivo: 500, fatturaNota: 500 } as const;
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

/** Le azioni che si conoscono (le cinque di prima e le otto del Rilascio 2). Nessuna cancella niente (D11). */
const NOMI_AZIONE: readonly string[] = [
  "stato", "pagato", "pagamento_annullato", "tracking", "nota_interna",
  "spedisci", "annulla", "rimborso", "riconcilia", "fattura_emessa", "email_invia", "giacenza_verificata", "correggi_stato",
];

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

/** L'ordine passa dalla cassa Stripe: ha `stato_pagamento` valorizzato (anche `da_incassare`). Vuoto = ordine di prima, che resta com'è. */
const conStripe = (o: Ordine): boolean => o.statoPagamento !== null;
const FRASE_USA_STRIPE = "Il pagamento di questo ordine lo gestisce Stripe: usa «Controlla con Stripe».";
const FRASE_RIMBORSI_ILLEGGIBILI = "Non riesco a leggere i rimborsi già fatti su questo ordine: ricarica la pagina e riprova.";
const FRASE_NON_ATTIVA = "Questa azione non è ancora attiva: il server non sa ancora eseguirne tutti i passi.";
/** L'ordine ha incassato (anche se poi rimborsato): da qui contano rimborso e magazzino. */
const conPagamentoRicevuto = (o: Ordine): boolean => ["pagato", "rimborsato_in_parte", "rimborsato"].includes(statoPagamentoDi(o));
const FRASE_USA_SPEDISCI = "Questo ordine si segna spedito con «Spedisci»: serve il corriere e il numero di tracking, oppure «senza tracking».";
const FRASE_USA_ANNULLA = "Questo ordine si annulla con «Annulla»: serve il motivo, e se è pagato il rimborso.";

function stato(a: Record<string, unknown>, o: Ordine, adesso: Date): EsitoAzione {
  const da = a.da, nuovo = a.a;
  const noto = (s: unknown): s is StatoOrdine => typeof s === "string" && (STATI_ORDINE as readonly string[]).includes(s);
  if (!noto(da) || !noto(nuovo)) return errore("valore", "Stato non valido: scegli uno degli stati dell'elenco.");
  if (conStripe(o)) {
    if (nuovo === "spedito") return errore("valore", FRASE_USA_SPEDISCI);
    if (nuovo === "annullato") return errore("valore", FRASE_USA_ANNULLA);
  }
  if (da !== o.stato) return errore("conflitto", "Lo stato dell'ordine è cambiato nel frattempo: ricarica e riprova.");
  if (nuovo === o.stato) return errore("nessun_cambio", "L'ordine è già in questo stato.");
  if (conStripe(o)) {
    // la tabella dei passaggi (pagamento.ts) vale solo per la cassa Stripe: un passo alla volta, in avanti; indietro serve il motivo
    if (!puoLavorare(o)) return errore("valore", "Senza un pagamento confermato l'ordine non si prepara: se è in attesa, aspetta Stripe o usa «Controlla con Stripe».");
    const passo = PASSAGGI_EVASIONE[da].find((p) => p.a === nuovo);
    if (!passo) return errore("valore", "Questo cambio di stato non è possibile.");
    if (passo.motivo) return errore("valore", "Per tornare indietro usa «Correggi lo stato»: serve il motivo.");
  }
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
  if (conStripe(o)) return errore("valore", FRASE_USA_STRIPE);
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
  if (conStripe(o)) return errore("valore", FRASE_USA_STRIPE);
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
  if (tracking && conStripe(o)) return errore("valore", "Il tracking si scrive spedendo: usa «Spedisci».");
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

// ── RILASCIO 2 · le azioni nuove (D55) ─────────────────────────────────────

const ok = (patch: Record<string, unknown>, condizioni: Record<string, unknown>, evento: EventoOrdine, effetti: Effetto[] = []): EsitoAzione => ({ ok: true, patch, condizioni, evento, effetti });
const eventoDi = (o: Ordine, tipo: EventoOrdine["tipo"], prima: Record<string, unknown>, dopo: Record<string, unknown>): EventoOrdine => ({ order_id: o.id, order_ref: o.ref, tipo, prima, dopo });
const testoPulito = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
/** Un testo libero con tetto: `""` se vuoto, `null` se non è testo ammesso (troppo lungo o con caratteri di controllo). */
const nota = (v: unknown, max: number): string | null => {
  const t = testoPulito(v);
  return t.length > max || CONTROLLO_NOTA.test(t) ? null : t;
};

/** Il corriere scritto → il nome com'è nell'elenco (maiuscole comprese), o `null` se nell'elenco non c'è. L'elenco vero lo passa il server; senza, quello di partenza. */
function corriereDellElenco(scritto: string, corrieri: unknown): string | null {
  const nomi = Array.isArray(corrieri) ? corrieri.map((v) => (eOggetto(v) ? testoPulito(v.nome) : "")) : [...CORRIERI_DI_PARTENZA];
  return nomi.find((n) => n && n.toLowerCase() === scritto.toLowerCase()) ?? null;
}

function spedisci(a: Record<string, unknown>, o: Ordine, adesso: Date, ctx: ContestoAzione): EsitoAzione {
  const nuovoSistema = conStripe(o);
  if (o.stato === "spedito") return errore("nessun_cambio", "L'ordine è già spedito.");
  if (nuovoSistema) {
    const s = statoPagamentoDi(o);
    if (s !== "pagato" && s !== "rimborsato_in_parte") return errore("valore", "Si spedisce solo un ordine con il pagamento confermato: questo non lo è.");
    if (!PASSAGGI_EVASIONE[o.stato].some((p) => p.a === "spedito")) return errore("valore", `Un ordine «${ETICHETTA_STATO[o.stato]}» non si può spedire.`);
  }
  // il tracking: corriere + numero, oppure «senza tracking». Per gli ordini di prima non è obbligatorio (se lo scrivi, però, deve essere giusto)
  const senza = a.senzaTracking === true;
  const corriereScritto = testoPulito(a.corriere);
  const numeroScritto = testoPulito(a.numero);
  let dati: Record<string, unknown> = {};
  let nomeCorriere: string | null = null;
  if (senza) dati = { tracking: null, corriere: null, tracking_url: null, senza_tracking: true };
  else if (corriereScritto || numeroScritto || nuovoSistema) {
    if (!corriereScritto) return errore("valore", "Scegli il corriere dell'elenco, oppure segna «senza tracking».");
    nomeCorriere = corriereDellElenco(corriereScritto, ctx.corrieri);
    if (!nomeCorriere) return errore("valore", "Il corriere non è nell'elenco: scegline uno dell'elenco.");
    if (!numeroScritto) return errore("valore", "Scrivi il numero di tracking, oppure segna «senza tracking».");
    if (!numeroValido(numeroScritto)) return errore("valore", "Il numero di tracking non è valido: servono lettere e cifre, da 5 a 40 caratteri.");
    dati = { corriere: nomeCorriere, tracking: numeroScritto, tracking_url: costruisciLink(ctx.corrieri, nomeCorriere, numeroScritto), senza_tracking: false };
  }
  return ok(
    { status: "spedito", spedito_il: adesso.toISOString(), ...dati, aggiornato_il: adesso.toISOString() },
    nuovoSistema ? { status: o.statoGrezzo || null, stato_pagamento: o.statoPagamento } : { status: o.statoGrezzo || null },
    eventoDi(o, "spedito", { stato: o.stato }, { stato: "spedito", corriere: dati.corriere ?? null, tracking: dati.tracking ?? null, senza_tracking: senza }),
  );
}

function annulla(a: Record<string, unknown>, o: Ordine, adesso: Date, ctx: ContestoAzione): EsitoAzione {
  if (o.stato === "annullato") return errore("nessun_cambio", "L'ordine è già annullato.");
  const nuovoSistema = conStripe(o);
  const motivo = nota(a.motivo, LIMITI.motivo);
  if (nuovoSistema && conPagamentoRicevuto(o) && !rimborsiLeggibili(ctx.rimborsi)) return errore("valore", FRASE_RIMBORSI_ILLEGGIBILI);
  if (motivo === null) return errore("valore", `Il motivo è troppo lungo o contiene caratteri non ammessi: al massimo ${LIMITI.motivo} caratteri.`);
  if (nuovoSistema && !motivo) return errore("valore", "Scrivi il motivo dell'annullo: serve per lo storico.");
  const effetti: Effetto[] = [];
  let rimborso: string | null = null;
  let rimetti: boolean | null = null;
  if (nuovoSistema) {
    if (!PASSAGGI_EVASIONE[o.stato].some((p) => p.a === "annullato")) return errore("valore", `Un ordine «${ETICHETTA_STATO[o.stato]}» non si può annullare.`);
    const s = statoPagamentoDi(o);
    if (s === "in_attesa") effetti.push({ tipo: "scadi_sessione" });
    if (conPagamentoRicevuto(o)) {
      const massimo = massimoRimborsabileCent(o, ctx.rimborsi);
      if (massimo > 0) {
        if (a.rimborso !== "ora" && a.rimborso !== "nessuno") return errore("valore", "L'ordine è pagato: scegli «Rimborsa ora» oppure «Nessun rimborso dovuto».");
        rimborso = a.rimborso;
        if (rimborso === "ora") {
          if (!eUuid(a.chiaveRichiesta)) return errore("valore", "Manca la chiave della richiesta di rimborso: ricarica la pagina e riprova.");
          effetti.push({ tipo: "rimborso", importoCent: massimo, motivo, chiaveRichiesta: a.chiaveRichiesta });
        }
      }
      if (typeof a.rimettiInMagazzino !== "boolean") return errore("valore", "L'ordine è pagato: scegli se rimettere i pezzi in magazzino, sì o no.");
      rimetti = a.rimettiInMagazzino;
      if (rimetti) effetti.push({ tipo: "giacenza_rimetti" });
    }
  }
  return ok(
    { status: "annullato", ...(motivo ? { annullo_motivo: motivo } : {}), annullato_il: adesso.toISOString(), aggiornato_il: adesso.toISOString() },
    nuovoSistema ? { status: o.statoGrezzo || null, stato_pagamento: o.statoPagamento } : { status: o.statoGrezzo || null },
    eventoDi(o, "annullato", { stato: o.stato }, { stato: "annullato", motivo: motivo || null, rimborso, rimetti_in_magazzino: rimetti }),
    effetti,
  );
}

function rimborso(a: Record<string, unknown>, o: Ordine, ctx: ContestoAzione): EsitoAzione {
  const r = controllaRimborso(a, o, ctx.rimborsi); // la stessa funzione della schermata: le due non possono dire cose diverse
  if (!r.ok) return errore("valore", r.errore);
  return ok(
    {},
    { stato_pagamento: o.statoPagamento, rimborsato_cent: o.rimborsatoCent },
    eventoDi(o, "rimborso_richiesto", { rimborsato_cent: o.rimborsatoCent }, { importo_cent: r.importoCent, motivo: r.motivo }),
    [{ tipo: "rimborso", importoCent: r.importoCent, motivo: r.motivo, chiaveRichiesta: r.chiaveRichiesta }],
  );
}

function riconcilia(o: Ordine): EsitoAzione {
  if (!conStripe(o)) return errore("valore", "Questo ordine non passa da Stripe: non c'è niente da controllare.");
  return ok({}, { stato_pagamento: o.statoPagamento }, eventoDi(o, "riconciliato", { stato_pagamento: o.statoPagamento }, {}), [{ tipo: "riconcilia" }]);
}

function fatturaEmessa(a: Record<string, unknown>, o: Ordine, adesso: Date): EsitoAzione {
  if (!o.fatturaRichiesta) return errore("valore", "Per questo ordine il cliente non ha chiesto la fattura.");
  if (o.fatturaEmessaIl !== null) return errore("nessun_cambio", "La fattura risulta già segnata come emessa.");
  const testo = nota(a.nota, LIMITI.fatturaNota);
  if (testo === null) return errore("valore", `La nota è troppo lunga o contiene caratteri non ammessi: al massimo ${LIMITI.fatturaNota} caratteri.`);
  return ok(
    { fattura_emessa_il: adesso.toISOString(), fattura_nota: testo || null, aggiornato_il: adesso.toISOString() },
    { fattura_emessa_il: null },
    eventoDi(o, "fattura_emessa", { fattura_emessa_il: null }, { fattura_emessa_il: adesso.toISOString(), nota: testo || null }),
  );
}

function emailInvia(a: Record<string, unknown>, o: Ordine): EsitoAzione {
  if (!conStripe(o)) return errore("valore", "Le email dello shop partono solo per gli ordini della cassa nuova.");
  if (typeof a.chiave !== "string" || !CHIAVI_EMAIL.includes(a.chiave)) return errore("valore", "Scegli quale email mandare.");
  if (!o.email.includes("@")) return errore("valore", "L'ordine non ha un indirizzo email: non c'è a chi mandarla.");
  return ok({}, { stato_pagamento: o.statoPagamento }, eventoDi(o, "email_inviata", {}, { chiave: a.chiave, manuale: true }), [{ tipo: "email", chiave: a.chiave, manuale: true }]);
}

function giacenzaVerificata(o: Ordine, adesso: Date): EsitoAzione {
  if (!o.giacenzaDaVerificare) return errore("nessun_cambio", "La giacenza di questo ordine non era da verificare.");
  return ok(
    { giacenza_da_verificare: false, aggiornato_il: adesso.toISOString() },
    { giacenza_da_verificare: true },
    eventoDi(o, "giacenza_verificata", { giacenza_da_verificare: true }, { giacenza_da_verificare: false }),
  );
}

/** I tre passi all'indietro della tabella di evasione (`pagamento.ts`): gli unici che questa azione fa. */
const CORREZIONI: readonly string[] = ["in_preparazione>nuovo", "spedito>in_preparazione", "annullato>nuovo"];

function correggiStato(a: Record<string, unknown>, o: Ordine, adesso: Date, ctx: ContestoAzione): EsitoAzione {
  if (!conStripe(o)) return errore("valore", "Per questo ordine il cambio di stato è libero: usa «Cambia stato».");
  const noto = (s: unknown): s is StatoOrdine => typeof s === "string" && (STATI_ORDINE as readonly string[]).includes(s);
  const { da, a: verso } = a;
  if (!noto(da) || !noto(verso)) return errore("valore", "Stato non valido: scegli uno degli stati dell'elenco.");
  if (da !== o.stato) return errore("conflitto", "Lo stato dell'ordine è cambiato nel frattempo: ricarica e riprova.");
  if (!CORREZIONI.includes(`${da}>${verso}`)) return errore("valore", "Questa non è una correzione: si torna indietro di un passo, o si riattiva un ordine annullato.");
  const motivo = nota(a.motivo, LIMITI.motivo);
  if (!motivo) return errore("valore", `Scrivi il motivo della correzione (al massimo ${LIMITI.motivo} caratteri): serve per lo storico.`);
  if (da === "annullato") {
    if (!rimborsiLeggibili(ctx.rimborsi)) return errore("valore", FRASE_RIMBORSI_ILLEGGIBILI); // contesto mancante o sporco: non si sa se c'è un rimborso → no
    if (haRimborsoAttivo(ctx.rimborsi)) return errore("valore", "L'ordine ha un rimborso richiesto o riuscito: non si può riattivare.");
  }
  const patch: Record<string, unknown> = { status: verso, aggiornato_il: adesso.toISOString() };
  if (da === "spedito") patch.spedito_il = null; // non è più spedito (la email «spedito», se è partita, resta un fatto)
  if (da === "annullato") {
    patch.annullo_motivo = null;
    patch.annullato_il = null; // l'annullo resta nello storico
    if (o.giacenzaRimessaIl !== null) patch.giacenza_da_verificare = true; // i pezzi erano tornati in magazzino: da ricontare prima di spedire
  }
  return ok(patch, { status: o.statoGrezzo || null }, eventoDi(o, "stato_corretto", { stato: da }, { stato: verso, motivo }));
}

/** Valida la richiesta della pagina contro l'ordine com'è e costruisce ciò che la rotta deve scrivere. Non lancia, non muta `attuale`.
 *  `contesto` (facoltativo): i rimborsi e l'elenco dei corrieri, che l'ordine da solo non sa. */
export function costruisciAzione(richiesta: unknown, attuale: Ordine, adesso: Date, contesto: ContestoAzione = {}): EsitoAzione {
  const r = costruisci(richiesta, attuale, adesso, contesto);
  // Fallisce chiuso: un'azione che chiede effetti (rimborso, giacenza, sessione, email, riconciliazione) che la rotta non dichiara di eseguire non parte,
  // altrimenti si applicherebbe la sola patch di stato (es. «annullato» senza il rimborso scelto).
  if (r.ok && r.effetti?.some((e) => !contesto.effettiGestiti?.includes(e.tipo))) return errore("valore", FRASE_NON_ATTIVA);
  return r;
}

function costruisci(richiesta: unknown, attuale: Ordine, adesso: Date, contesto: ContestoAzione): EsitoAzione {
  if (!eOggetto(richiesta)) return errore("valore", "Richiesta non valida.");
  const nome = richiesta.azione;
  if (typeof nome !== "string" || !NOMI_AZIONE.includes(nome)) return errore("azione_sconosciuta", "Azione non prevista.");
  if (!eUuid(richiesta.ordineId) || richiesta.ordineId !== attuale.id) return errore("valore", "Ordine non valido.");

  switch (nome) {
    case "stato": return stato(richiesta, attuale, adesso);
    case "pagato": return pagato(richiesta, attuale, adesso);
    case "pagamento_annullato": return pagamentoAnnullato(attuale, adesso);
    case "spedisci": return spedisci(richiesta, attuale, adesso, contesto);
    case "annulla": return annulla(richiesta, attuale, adesso, contesto);
    case "rimborso": return rimborso(richiesta, attuale, contesto);
    case "riconcilia": return riconcilia(attuale);
    case "fattura_emessa": return fatturaEmessa(richiesta, attuale, adesso);
    case "email_invia": return emailInvia(richiesta, attuale);
    case "giacenza_verificata": return giacenzaVerificata(attuale, adesso);
    case "correggi_stato": return correggiStato(richiesta, attuale, adesso, contesto);
    default: return testoLibero(richiesta, attuale, adesso, nome as "tracking" | "nota_interna");
  }
}
