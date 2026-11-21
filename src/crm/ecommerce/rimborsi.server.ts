/** ── RIMBORSI, ANNULLO E «CONTROLLA CON STRIPE» (rimborsi.server.ts) ─────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, Rilascio 2 (T53; PIANO-R2 D46, D55, SPEC 7.4 n. 5, 8A n. 6). Gli EFFETTI che `costruisciAzione` (T47) chiede e che la rotta
 *  `ordini.server.ts` esegue: nessuno scrive il database a mano, tutto passa dalle funzioni SQL di S4 (`rpc`) e da Stripe (il client di T44, `creaClientStripe`).
 *  Come `ordini.server.ts` riceve PORTE (database, Stripe, email, orologio, log) e non importa il client del server: si prova con finti.
 *
 *  ── LE REGOLE CHE TIENE ─────────────────────────────────────────────────────
 *  · Rimborso: prima si PRENOTA la riga (`shop_rimborso_prenota`: sotto blocco, massimo = pagato − richiesti − riusciti, `chiave_richiesta` unica), poi UNA chiamata a Stripe con
 *    `Idempotency-Key` = id della riga e `metadata[riga_id]`. La riga resta `richiesto`: lo stato finale (`riuscito`, ordine «rimborsato») lo scrive solo
 *    `shop_rimborso_riconcilia`, chiamata dal webhook o da «Controlla con Stripe». Questo file non scrive mai `rimborsato`.
 *  · Stessa chiave due volte (doppio clic): niente seconda chiamata. Una riga `richiesto` giovane (< 60 s) è «in corso»; una più vecchia si confronta con l'ELENCO di Stripe
 *    prima di ripetere (l'`Idempotency-Key` vale 24 ore: oltre, la stessa chiave creerebbe un secondo rimborso).
 *  · Stripe rifiuta (4xx) → riga `fallito` e importo di nuovo disponibile; Stripe non risponde (timeout, rete, 5xx, idempotenza) → la riga RESTA `richiesto` (potrebbe essere partito).
 *  · Nei log SOLO codici (`error.code`, il nome del tipo di un'eccezione): mai il messaggio di Stripe o del database (porta dati del cliente), mai id o testi del cliente.
 *  · Verso Stripe nulla del cliente: solo pagamento, importo, id della riga e dell'ordine.
 *  · Nessuna cancellazione, da nessuna parte. */
import type { ClientStripe } from "../../shop/stripe/client";
import type { EsitoInvio, PorteEmail } from "../../shop/email/tipi";
import type { Effetto } from "./azioni";
import type { Ordine } from "./ordine";
import type { ClienteDb } from "./ordini.server";
import { statoPagamentoDi } from "./pagamento";
import { euro } from "./pagina";
import { fraseErroreOrdine } from "./ordini-ui";

/* ══ LE PORTE ═══════════════════════════════════════════════════════════════ */

/** Le sole chiamate a Stripe che questo file fa (il client di T44 le ha tutte). */
export type PortaStripe = Pick<ClientStripe, "creaRimborso" | "elencaRimborsi" | "leggiSessione" | "scadiSessione" | "leggiPagamento">;

export interface PorteEffetti {
  db: ClienteDb;
  /** Senza, i rimborsi, la sessione da far scadere e «Controlla con Stripe» non sono eseguibili (la rotta non li dichiara in `effettiGestiti`). */
  stripe?: PortaStripe;
  /** Senza, nessuna email parte (e `email_invia` non è eseguibile). */
  email?: PorteEmail;
  adesso: () => Date;
  /** Solo CODICI (mai testi del cliente). */
  log: (codice: string) => void;
}

/** Com'è andato un effetto. `fatto`: eseguito; `in_corso`: partito ma non concluso (non ripetere); `non_riuscito`: non eseguito, la `frase` dice perché (`http` per la risposta d'errore diretta). */
export interface EsitoEffetto {
  tipo: Effetto["tipo"];
  esito: "fatto" | "in_corso" | "non_riuscito";
  frase: string;
  http?: number;
}

/** Un rimborso come lo leggono la rotta e la pagina (importi in centesimi). `importoCent` e `stato` restano com'è scritto in tabella: li giudica `rimborsiLeggibili`. */
export interface RimborsoLetto {
  id: string;
  importoCent: unknown;
  stato: unknown;
  motivo: string;
  origine: string;
  chi: string;
  creatoIl: string;
  aggiornatoIl: string;
  stripeRimborsoId: string | null;
  chiaveRichiesta: string | null;
}

/* ══ PICCOLI AIUTI ══════════════════════════════════════════════════════════ */

/** Una riga `richiesto` più giovane di così è «in corso» (il primo clic sta ancora parlando con Stripe): niente seconda chiamata. */
const ETA_RIPETIZIONE_MS = 60_000;

const eOggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const testo = (v: unknown): string => (typeof v === "string" ? v : "");
const pulito = (v: unknown, max: number): string =>
  String(v ?? "?")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, max) || "?";
/** Il solo pezzo di un errore del database che si può scrivere nel log: il codice, ripulito. */
const codiceDb = (e: { code?: unknown } | null | undefined): string => pulito(e?.code, 12);
const nomeEccezione = (e: unknown): string => pulito((e as { name?: unknown } | null)?.name, 30);
const ok = (tipo: Effetto["tipo"], frase: string): EsitoEffetto => ({ tipo, esito: "fatto", frase });
const inCorso = (tipo: Effetto["tipo"], frase: string): EsitoEffetto => ({ tipo, esito: "in_corso", frase });
const no = (tipo: Effetto["tipo"], frase: string, http = 409): EsitoEffetto => ({ tipo, esito: "non_riuscito", frase, http });
const FRASE_GUASTO_DB = "Il database non ha risposto: riprova tra un momento.";
const FRASE_STRIPE_GUASTO = "Non riesco a parlare con Stripe adesso: riprova tra un momento.";

/** La frase di un errore delle funzioni SQL: il NOME dell'errore sta nel `message` (`RAISE EXCEPTION 'rimborso_oltre_pagato'`); un nome che non conosciamo dà la frase generica, mai il testo del database. */
function fraseDaErroreSql(e: { message?: unknown } | null): string {
  return fraseErroreOrdine(typeof e?.message === "string" ? e.message : "");
}

/* ══ LE LETTURE ═════════════════════════════════════════════════════════════ */

/** I rimborsi di un ordine. `undefined` se la lettura fallisce: MAI `[]` (un elenco vuoto significa «nessun rimborso», e chi decide sui soldi fallisce chiuso). */
export async function leggiRimborsi(p: Pick<PorteEffetti, "db" | "log">, ordineId: string): Promise<RimborsoLetto[] | undefined> {
  try {
    const r = await p.db
      .from("shop_rimborsi")
      .select("id,importo_cent,stato,motivo,origine,chi,creato_il,aggiornato_il,stripe_rimborso_id,chiave_richiesta")
      .eq("ordine_id", ordineId)
      .order("creato_il", { ascending: true })
      .limit(500);
    if (r.error) {
      p.log(`rimborsi ${codiceDb(r.error)}`);
      return undefined;
    }
    if (!Array.isArray(r.data)) return undefined;
    return r.data.map((x) => {
      const riga = eOggetto(x) ? x : {};
      return {
        id: testo(riga.id),
        importoCent: riga.importo_cent,
        stato: riga.stato,
        motivo: testo(riga.motivo),
        origine: testo(riga.origine),
        chi: testo(riga.chi),
        creatoIl: testo(riga.creato_il),
        aggiornatoIl: testo(riga.aggiornato_il),
        stripeRimborsoId: testo(riga.stripe_rimborso_id) || null,
        chiaveRichiesta: testo(riga.chiave_richiesta) || null,
      };
    });
  } catch (e) {
    p.log(`rimborsi eccezione ${nomeEccezione(e)}`);
    return undefined;
  }
}

/** Il pagamento Stripe dell'ordine: quello salvato dal «pagato»; se manca, quello della sessione. `null` se non si trova. */
async function pagamentoDi(p: PorteEffetti, ordine: Ordine): Promise<string | null> {
  if (ordine.stripePagamentoId) return ordine.stripePagamentoId;
  if (!ordine.stripeSessioneId || !p.stripe) return null;
  const s = await p.stripe.leggiSessione(ordine.stripeSessioneId);
  if (!s.ok) {
    p.log(`stripe sessione ${pulito(s.errore.codice, 64)}`);
    return null;
  }
  return s.dati.payment_intent;
}

/* ══ IL RIMBORSO ════════════════════════════════════════════════════════════ */

/** Un rimborso nato da un rimborso di Stripe: la forma che `shop_rimborso_riconcilia` si aspetta (`id`, `amount`, `status`, `metadata`). */
const perLaFunzione = (r: { id: string; amount: number; status: string; metadata: Record<string, string> }) => ({ id: r.id, amount: r.amount, status: r.status, metadata: r.metadata });

/** Fa leggere alla funzione SQL un elenco di rimborsi di Stripe; `chiudiOrfane` solo con l'elenco COMPLETO. */
async function riconciliaRimborsi(p: PorteEffetti, ordineId: string, rimborsi: unknown[], chiudiOrfane: boolean) {
  return p.db.rpc("shop_rimborso_riconcilia", { p_ordine: ordineId, p_rimborsi: rimborsi, p_chiudi_orfane: chiudiOrfane });
}

/**
 * Il rimborso di un ordine: prenota la riga, chiama Stripe UNA volta. Mai una cifra scritta come «riuscita» da qui.
 * `r.chiaveRichiesta` è quella che la pagina ha generato per questo clic: la stessa chiave due volte è la stessa richiesta.
 */
export async function rimborsa(
  p: PorteEffetti,
  ordine: Ordine,
  r: { importoCent: number; motivo: string; chiaveRichiesta: string },
  chi: string,
): Promise<EsitoEffetto> {
  const stripe = p.stripe;
  if (!stripe) return no("rimborso", "Il collegamento con Stripe non è attivo: il rimborso non è possibile da qui.");
  // 1. il pagamento da rimborsare: se non si trova, non si prenota niente (nessuna riga che blocchi il massimo)
  const pi = await pagamentoDi(p, ordine);
  if (!pi) return no("rimborso", "Non trovo il pagamento di questo ordine su Stripe: controlla l'ordine su Stripe.", 502);

  // 2. la riga, sotto blocco (massimo, chiave unica)
  const pren = await p.db.rpc("shop_rimborso_prenota", { p_ordine: ordine.id, p_importo_cent: r.importoCent, p_motivo: r.motivo, p_chiave: r.chiaveRichiesta, p_chi: chi });
  if (pren.error) {
    p.log(`rimborso prenota ${codiceDb(pren.error)}`);
    return no("rimborso", fraseDaErroreSql(pren.error));
  }
  const dati = eOggetto(pren.data) ? pren.data : {};
  const idRiga = testo(dati.id);
  if (!idRiga) return no("rimborso", FRASE_GUASTO_DB, 500);
  let importo = r.importoCent;

  // 3. la chiave era già nota (doppio clic, o ripetizione dopo un timeout)
  if (dati.esito === "esistente") {
    const letta = await p.db.from("shop_rimborsi").select("stato,importo_cent,creato_il").eq("id", idRiga).limit(1);
    const riga = !letta.error && Array.isArray(letta.data) && eOggetto(letta.data[0]) ? letta.data[0] : null;
    if (!riga) {
      p.log(`rimborso riga ${letta.error ? codiceDb(letta.error) : "assente"}`);
      return no("rimborso", FRASE_GUASTO_DB, 500);
    }
    if (riga.stato === "riuscito") return ok("rimborso", "Questo rimborso è già stato eseguito.");
    if (riga.stato === "fallito") return no("rimborso", "Questa richiesta di rimborso era fallita: ricarica la pagina e riprova con una richiesta nuova.");
    if (typeof riga.importo_cent === "number") importo = riga.importo_cent; // la riga che c'è, non quella che si ripete adesso: Stripe confronta il corpo con la prima richiesta
    const eta = p.adesso().getTime() - Date.parse(testo(riga.creato_il));
    if (!(eta >= ETA_RIPETIZIONE_MS)) // anche con una data illeggibile (NaN): nel dubbio, «in corso»
      return inCorso("rimborso", "C'è già una richiesta di rimborso in corso per questo importo: aspetta qualche secondo e ricarica. Non ripetere il clic.");
    // vecchia: prima si legge l'elenco di Stripe (l'Idempotency-Key vale 24 ore); se c'è già, non se ne crea un secondo
    const elenco = await stripe.elencaRimborsi(pi);
    if (!elenco.ok) {
      p.log(`stripe elenco ${pulito(elenco.errore.codice, 64)}`);
      return inCorso("rimborso", "Non riesco a controllare su Stripe se il rimborso è già partito: usa «Controlla con Stripe» tra qualche minuto, non ripetere.");
    }
    const trovato = elenco.dati.rimborsi.find((x) => x.metadata.riga_id === idRiga);
    if (trovato) {
      const agg = await riconciliaRimborsi(p, ordine.id, [perLaFunzione(trovato)], false);
      if (agg.error) p.log(`rimborso riconcilia ${codiceDb(agg.error)}`);
      return ok("rimborso", "Il rimborso risultava già inviato a Stripe: ho aggiornato lo stato.");
    }
    if (elenco.dati.troncato) return inCorso("rimborso", "I rimborsi su Stripe sono troppi per controllarli da qui: usa «Controlla con Stripe» e non ripetere.");
  }

  // 4. UNA chiamata a Stripe: `Idempotency-Key` = id della riga, `metadata[riga_id]` per riconoscerla nell'elenco
  const s = await stripe.creaRimborso({ payment_intent: pi, amount: importo, metadata: { riga_id: idRiga, ordine_id: ordine.id } }, idRiga);
  if (s.ok) return ok("rimborso", "Rimborso richiesto a Stripe: lo stato definitivo lo conferma Stripe, di solito in pochi secondi.");
  p.log(`rimborso stripe ${pulito(s.errore.codice, 64)}`);
  if (s.errore.ritentabile)
    // timeout, rete, 5xx, 429, idempotenza: il rimborso POTREBBE essere partito. La riga resta `richiesto` (blocca il massimo) e non si ripete a occhio.
    return inCorso("rimborso", "Stripe non ha risposto: il rimborso resta «richiesto». Non ripeterlo: usa «Controlla con Stripe» tra qualche minuto.");
  // rifiuto vero: non è nato nessun rimborso. La riga si chiude `fallito` (libera la cifra).
  // shortcut: S4 non ha una funzione per chiudere una riga a mano; si passa da `shop_rimborso_riconcilia` con un rimborso «fallito» a id nostro (`non_creato_…`, unico per riga). Una funzione dedicata è meglio: chiederla all'architetto.
  const chiusa = await riconciliaRimborsi(p, ordine.id, [perLaFunzione({ id: `non_creato_${idRiga}`, amount: importo, status: "failed", metadata: { riga_id: idRiga } })], false);
  if (chiusa.error) {
    p.log(`rimborso chiusura ${codiceDb(chiusa.error)}`);
    return no("rimborso", "Stripe ha rifiutato il rimborso, ma la richiesta resta aperta nel registro: usa «Controlla con Stripe» tra una decina di minuti per liberare la cifra.", 502);
  }
  return no("rimborso", "Stripe ha rifiutato il rimborso: non è stato fatto niente. Controlla l'ordine su Stripe.", 502);
}

/* ══ GLI ALTRI EFFETTI ══════════════════════════════════════════════════════ */

/** Rimette in magazzino ciò che i MOVIMENTI dell'ordine dicono scalato (mai tutte le righe), una volta sola (la funzione è idempotente). */
async function rimettiGiacenza(p: PorteEffetti, ordine: Ordine, chi: string): Promise<EsitoEffetto> {
  const r = await p.db.rpc("shop_ordine_giacenza_rimetti", { p_ordine: ordine.id, p_chi: chi });
  if (r.error) {
    p.log(`giacenza rimetti ${codiceDb(r.error)}`);
    return no("giacenza_rimetti", "Non sono riuscito a rimettere i pezzi in magazzino: l'ordine è a posto, ma contali a mano.", 500);
  }
  const d = eOggetto(r.data) ? r.data : {};
  if (d.esito === "gia_rimessa") return ok("giacenza_rimetti", "I pezzi erano già stati rimessi in magazzino.");
  const pezzi = typeof d.pezzi === "number" ? d.pezzi : 0;
  return ok("giacenza_rimetti", pezzi > 0 ? `Rimessi in magazzino ${pezzi} ${pezzi === 1 ? "pezzo" : "pezzi"}.` : "Nessun pezzo da rimettere: l'ordine non aveva scalato niente.");
}

/** Fa scadere la sessione di pagamento di un ordine che non è stato pagato (se il cliente paga lo stesso, il webhook lo segna con un avviso). */
async function scadiSessione(p: PorteEffetti, ordine: Ordine): Promise<EsitoEffetto> {
  if (!ordine.stripeSessioneId) return ok("scadi_sessione", "Nessuna sessione di pagamento da chiudere.");
  const r = await p.stripe?.scadiSessione(ordine.stripeSessioneId);
  if (r?.ok) return ok("scadi_sessione", "La sessione di pagamento su Stripe è stata chiusa.");
  p.log(`stripe scadi ${pulito(r?.errore.codice, 64)}`);
  return no("scadi_sessione", "L'ordine è annullato, ma non sono riuscito a chiudere la sessione di pagamento su Stripe (forse è già chiusa o pagata): se il cliente paga lo stesso lo vedrai come avviso e potrai rimborsarlo.", 502);
}

/** «Controlla con Stripe» (D55): rilegge le sessioni e i rimborsi da Stripe e applica le STESSE funzioni SQL del webhook. È l'unica strada del CRM al «pagato», e solo se Stripe dice `paid`. */
async function riconcilia(p: PorteEffetti, ordine: Ordine): Promise<EsitoEffetto> {
  const stripe = p.stripe;
  if (!stripe) return no("riconcilia", "Il collegamento con Stripe non è attivo.");
  const frasi: string[] = [];
  let guasto = false;
  let fatto = false;
  let stato = statoPagamentoDi(ordine);
  let pi = ordine.stripePagamentoId;

  // 1. il pagamento: solo se Stripe dice `paid` (le sessioni dell'ordine, la corrente per prima)
  if (stato === "in_attesa" || stato === "scaduto" || stato === "fallito") {
    const ids = new Set<string>(ordine.stripeSessioneId ? [ordine.stripeSessioneId] : []);
    const tabella = await p.db.from("shop_stripe_sessioni").select("sessione_id").eq("ordine_id", ordine.id).limit(10);
    if (tabella.error) p.log(`sessioni ${codiceDb(tabella.error)}`);
    else for (const x of Array.isArray(tabella.data) ? tabella.data : []) if (eOggetto(x) && testo(x.sessione_id)) ids.add(testo(x.sessione_id));
    let letta = false;
    let pagataOra = false;
    for (const id of [...ids].slice(0, 5)) {
      const s = await stripe.leggiSessione(id);
      if (!s.ok) {
        p.log(`stripe sessione ${pulito(s.errore.codice, 64)}`);
        guasto = true;
        continue;
      }
      letta = true;
      if (s.dati.payment_status !== "paid") continue;
      const pid = s.dati.payment_intent;
      let metodo: string | null = null;
      if (pid) {
        const pg = await stripe.leggiPagamento(pid); // il metodo è un di più: se non si legge, si paga lo stesso
        if (pg.ok) metodo = pg.dati.metodo;
        else p.log(`stripe pagamento ${pulito(pg.errore.codice, 64)}`);
      }
      const r = await p.db.rpc("shop_ordine_pagato", { p_ordine: ordine.id, p_sessione: id, p_importo_cent: s.dati.amount_total, p_valuta: s.dati.currency, p_metodo: metodo, p_pagamento_id: pid });
      if (r.error) {
        p.log(`pagato ${codiceDb(r.error)}`);
        return no("riconcilia", fraseDaErroreSql(r.error), 500);
      }
      const esito = eOggetto(r.data) ? r.data.esito : null;
      if (esito === "pagato_ora") {
        pagataOra = true;
        fatto = true;
        stato = "pagato";
        pi = pid ?? pi;
        frasi.push(eOggetto(r.data) && r.data.giacenza_da_verificare === true ? "Stripe conferma il pagamento: l'ordine ora è pagato. Controlla la giacenza." : "Stripe conferma il pagamento: l'ordine ora è pagato.");
      } else if (esito === "importo_diverso") {
        fatto = true;
        frasi.push("Stripe ha incassato un importo diverso dal totale dell'ordine: l'ordine NON è stato segnato come pagato (guarda l'avviso).");
      } else if (esito === "doppio_pagamento" || esito === "sessione_sconosciuta") {
        fatto = true;
        frasi.push("Stripe ha un pagamento che non combacia con l'ordine: guarda l'avviso.");
      }
    }
    if (pagataOra && p.email) await inviaAutomatica(p, "conferma_ordine", ordine.id); // la guardia contro i doppi invii è del database (`shop_email_prenota`)
    if (!fatto && letta && !guasto) frasi.push("Per Stripe questo ordine non è ancora pagato: non ho cambiato niente.");
  }

  // 2. i rimborsi: l'elenco di Stripe è la fonte (anche quelli fatti dal pannello di Stripe)
  if (stato === "pagato" || stato === "rimborsato_in_parte" || stato === "rimborsato") {
    pi = pi ?? (await pagamentoDi(p, ordine));
    if (pi) {
      const elenco = await stripe.elencaRimborsi(pi);
      if (!elenco.ok) {
        p.log(`stripe elenco ${pulito(elenco.errore.codice, 64)}`);
        guasto = true;
      } else {
        const r = await riconciliaRimborsi(p, ordine.id, elenco.dati.rimborsi.map(perLaFunzione), !elenco.dati.troncato);
        if (r.error) {
          p.log(`rimborsi riconcilia ${codiceDb(r.error)}`);
          return no("riconcilia", fraseDaErroreSql(r.error), 500);
        }
        fatto = true;
        const cent = eOggetto(r.data) && typeof r.data.rimborsato_cent === "number" ? r.data.rimborsato_cent : 0;
        frasi.push(cent > 0 ? `Rimborsi controllati su Stripe: ${euro(cent / 100)} rimborsati.` : "Rimborsi controllati su Stripe: nessun rimborso fatto.");
      }
    }
  }

  if (guasto && !fatto) return no("riconcilia", FRASE_STRIPE_GUASTO, 502);
  return ok("riconcilia", [...frasi, ...(guasto ? ["Una parte della lettura da Stripe non è riuscita: riprova."] : [])].join(" ") || "Niente da controllare su questo ordine.");
}

/* ══ LE EMAIL ═══════════════════════════════════════════════════════════════ */

const FRASE_EMAIL: Record<string, string> = {
  inviata: "Email inviata.",
  in_corso: "L'email è già in invio: aspetta qualche minuto.",
  spenta: "Email non inviata: interruttore spento.",
  non_approvata: "Email non inviata: il testo non è ancora approvato.",
  segnaposto: "Email non inviata: il testo ha ancora parti «da confermare».",
  vuota: "Email non inviata: il testo è vuoto.",
  variabile_sconosciuta: "Email non inviata: il testo contiene un segnaposto che non conosco.",
  non_configurata: "Email non inviata: manca il mittente o la chiave del servizio di posta.",
  senza_email: "Email non inviata: l'ordine non ha un indirizzo email.",
  migrazione: "Email non inviata: manca l'aggiornamento del database delle email.",
  errore: "Email non riuscita: riprova con «Invia ora».",
};
const frasePerEmail = (stato: string): string => (Object.prototype.hasOwnProperty.call(FRASE_EMAIL, stato) ? FRASE_EMAIL[stato] : "Email non inviata.");

/** Una email che parte da sola dopo un'azione (spedito, annullato): mai un'eccezione, mai un dato nel log. La guardia contro i doppi invii è di `shop_email_prenota` (T54). */
export async function inviaAutomatica(p: Pick<PorteEffetti, "email" | "log">, chiave: "conferma_ordine" | "spedito" | "annullato", ordineId: string): Promise<{ chiave: string; stato: string; frase: string }> {
  try {
    const e: EsitoInvio | undefined = await p.email?.invia(chiave, ordineId, { manuale: false });
    const stato = typeof e?.stato === "string" ? e.stato : "errore";
    return { chiave, stato, frase: frasePerEmail(stato) };
  } catch (err) {
    p.log(`email eccezione ${nomeEccezione(err)}`);
    return { chiave, stato: "errore", frase: frasePerEmail("errore") };
  }
}

/** «Invia ora»: l'operatore chiede un messaggio (anche con l'interruttore spento: la regola «inviabile» la applica comunque chi invia, T54). */
async function emailManuale(p: PorteEffetti, ordine: Ordine, chiave: string): Promise<EsitoEffetto> {
  try {
    const e = await p.email?.invia(chiave as "conferma_ordine", ordine.id, { manuale: true });
    const stato = typeof e?.stato === "string" ? e.stato : "errore";
    if (stato === "inviata") return ok("email", frasePerEmail(stato));
    return stato === "in_corso" ? inCorso("email", frasePerEmail(stato)) : no("email", frasePerEmail(stato));
  } catch (err) {
    p.log(`email eccezione ${nomeEccezione(err)}`);
    return no("email", frasePerEmail("errore"), 500);
  }
}

/* ══ L'ESECUZIONE ═══════════════════════════════════════════════════════════ */

/** Esegue un effetto chiesto da `costruisciAzione`. Non lancia mai: un guasto diventa `non_riuscito` con la sua frase (l'ordine, se è già stato scritto, resta com'è). */
export async function eseguiEffetto(p: PorteEffetti, e: Effetto, ordine: Ordine, chi: string): Promise<EsitoEffetto> {
  try {
    switch (e.tipo) {
      case "rimborso":
        return await rimborsa(p, ordine, e, chi);
      case "giacenza_rimetti":
        return await rimettiGiacenza(p, ordine, chi);
      case "scadi_sessione":
        return await scadiSessione(p, ordine);
      case "riconcilia":
        return await riconcilia(p, ordine);
      case "email":
        return await emailManuale(p, ordine, e.chiave);
    }
  } catch (err) {
    p.log(`effetto ${e.tipo} eccezione ${nomeEccezione(err)}`);
    return no(e.tipo, "Qualcosa non ha funzionato: riprova tra un momento.", 500);
  }
}
