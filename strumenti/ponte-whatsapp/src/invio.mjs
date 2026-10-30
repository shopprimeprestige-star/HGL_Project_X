/** ── PONTE WHATSAPP · L'INVIO A MANO (la coda del CRM, i limiti, l'esito) ───
 *
 *  Commessa 2026-10-30-ponte-invio-manuale, compito T3 (PIANO §5).
 *  Il CRM mette in coda i testi scritti a mano; il battito dice quanti ne
 *  aspettano (`invii_in_attesa`); qui si chiede UN messaggio alla volta
 *  (`prendi`), si manda col collegamento (`inviaTesto` di `collega.mjs`) e si
 *  riporta l'esito (`esito`). Non c'è nessun polling fisso: il ciclo parte dal
 *  battito e si ferma da solo quando la coda è vuota.
 *
 *  Questo file NON parla con WhatsApp: riceve `inviaTesto` e `collegato` dal
 *  chiamante. L'unico punto del servizio che scrive a un cliente è
 *  `collega.mjs` (lo controllano le guardie delle prove).
 *
 *  ⚠️ DOPPIA GUARDIA. I numeri qui sotto sono la copia di `LIMITI_INVIO` di
 *   `src/crm/ponte/invio-tipi.ts` (una prova li confronta): il server li
 *   applica al prelievo, il Mac li ricontrolla prima di chiedere.
 *  ⚠️ MAI RIMANDARE. Un invio è partito o forse è partito: se manca l'esito, si
 *   ritenta SOLO l'esito. Un riavvio a metà (`in-corso/<id>.json` senza esito)
 *   riporta `esito_incerto`: riprovare è una scelta di una persona, nel CRM.
 *  ⚠️ Su disco (`invii/`) solo id, esito e orari: mai il testo né il numero.
 *   Nel registro solo codici e numeri.
 *
 *    invii/storico.json         orari dei tentativi delle ultime 24 ore (600)
 *    invii/in-corso/<id>.json   scritto prima di inviare, tolto a esito scritto
 *    invii/esiti/<id>.json      l'esito da consegnare; si cancella a consegna
 *  ───────────────────────────────────────────────────────────────────────── */
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spedisci } from "./lotti.mjs";

/** Copia dei numeri di `LIMITI_INVIO` (caratteri, intervallo, al giorno, ore). */
export const LIMITI_PONTE = { caratteri: 2000, intervalloS: 20, alGiorno: 20, giornoOre: 24 };

/** Ritardo casuale (0-5 s) che si somma ai 20 s fra due invii. */
export const RITARDO_MASSIMO_MS = 5000;
/** Mai due richieste `prendi` più vicine di così. */
export const MINIMO_FRA_RICHIESTE_MS = 3000;
/** 429, 5xx, rete: come i lotti (5 s, 15 s, 60 s, 5 min, poi resta). */
export const ATTESE_RITENTATIVO = [5000, 15_000, 60_000, 300_000];
/** 400, 404, 503, 401: il server non è pronto o non ci riconosce. */
export const PAUSA_LUNGA_MS = 300_000;

const GIORNO_MS = LIMITI_PONTE.giornoOre * 3_600_000;
/** gli id sono uuid: sono anche i nomi dei file, mai altro */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_UUID = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/i;
const NUMERO = /^\d{8,15}$/;
/** risposte dell'esito dopo le quali non si ritenta più: consegnato, o il server non lo vuole */
const ESITO_DEFINITIVO = new Set([200, 400, 404, 409]);

const oggetto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** Può partire un invio adesso? `presi` = orari (ms) dei tentativi. 20 s più
 *  `jitterMs` dall'ultimo; al più 20 nelle ultime 24 ore. Un orario nel
 *  futuro (orologio tornato indietro) conta ancora: è la scelta prudente. */
export function puoPartire({ adesso, presi, jitterMs = 0 }) {
  const recenti = presi.filter((t) => Number.isFinite(t) && adesso - t < GIORNO_MS).sort((a, b) => a - b);
  if (recenti.length >= LIMITI_PONTE.alGiorno) {
    const esce = recenti[recenti.length - LIMITI_PONTE.alGiorno];
    return { ok: false, aspettaMs: esce + GIORNO_MS - adesso, perche: "giorno" };
  }
  if (recenti.length) {
    const pausa = LIMITI_PONTE.intervalloS * 1000 + jitterMs;
    const manca = Math.min(pausa - (adesso - recenti[recenti.length - 1]), pausa);
    if (manca > 0) return { ok: false, aspettaMs: manca, perche: "intervallo" };
  }
  return { ok: true };
}

/** Scrittura atomica con permessi 600. */
function scrivi(percorso, dati) {
  const temporaneo = `${percorso}.tmp-${process.pid}`;
  writeFileSync(temporaneo, JSON.stringify(dati), { mode: 0o600 });
  renameSync(temporaneo, percorso);
}

/** Gli orari validi delle ultime 24 ore da `storico.json` (rotto = vuoto). */
function leggiStorico(percorso, adesso) {
  try {
    const l = JSON.parse(readFileSync(percorso, "utf8"));
    return Array.isArray(l) ? l.filter((t) => Number.isFinite(t) && adesso - t < GIORNO_MS) : [];
  } catch {
    return [];
  }
}

/** L'esito che il server accetta, da un file nostro (altro = null). */
function esitoValido(id, d) {
  if (!oggetto(d) || d.id !== id) return null;
  if (d.esito === "inviato") {
    if (typeof d.wa_id !== "string" || !d.wa_id) return null;
    return { id, esito: "inviato", wa_id: d.wa_id, ...(Number.isInteger(d.ts) ? { ts: d.ts } : {}) };
  }
  if (d.esito === "errore" && typeof d.motivo === "string") return { id, esito: "errore", motivo: d.motivo };
  return null;
}

/** Il servizio d'invio.
 *
 *  `opzioni`: `url`, `token` (come i lotti); `cartella` (`invii/`); `attivo`
 *  (`INVII_ATTIVI=1`); `collegato()`; `inviaTesto(numero, testo)` →
 *  `{ ok:true, id, ts }` o `{ ok:false, motivo }` (non lancia); `registro`;
 *  `orologio`, `fetch`, `casuale`, `pianifica` (le prove li sostituiscono).
 *
 *  Uscita: `{ avvia, sveglia, dopoBattito, ferma, presi, contatori }`.
 *  `sveglia()` e `avvia()` restituiscono la promessa del ciclo (uno solo alla
 *  volta: massimo un invio in volo). */
export function creaInvii({ url, token, cartella, attivo = false, collegato = () => false, inviaTesto, registro = () => {}, orologio = Date.now, fetch = globalThis.fetch, casuale = Math.random, pianifica = setTimeout }) {
  const dir = { inCorso: join(cartella, "in-corso"), esiti: join(cartella, "esiti"), storico: join(cartella, "storico.json") };
  for (const d of [cartella, dir.inCorso, dir.esiti]) mkdirSync(d, { recursive: true, mode: 0o700 });

  let presi = leggiStorico(dir.storico, orologio());
  let jitterMs = 0;
  let fermato = false;
  let corso = null;
  let rilascia = null;
  let ultimoPrendi = -Infinity;
  const conti = { ok: 0, ko: 0 };

  const pausa = (ms) =>
    new Promise((ok) => {
      rilascia = ok;
      pianifica(() => {
        rilascia = null;
        ok();
      }, Math.max(0, ms));
    });

  const fileInCorso = (id) => join(dir.inCorso, `${id}.json`);
  const fileEsito = (id) => join(dir.esiti, `${id}.json`);

  /** Consegna un esito: si ritenta finché il server non risponde in modo
   *  definitivo. L'invio non si ripete mai. */
  async function consegna(dati) {
    for (let i = 0; !fermato; i++) {
      const r = await spedisci({ url, token, corpo: { v: 1, tipo: "esito", ...dati }, fetch });
      if (ESITO_DEFINITIVO.has(r.stato)) {
        if (r.stato !== 200) registro("invio_esito_scartato", { http: r.stato });
        rmSync(fileEsito(dati.id), { force: true });
        return;
      }
      registro("invio_esito_riprova", { http: r.stato ?? 0, tentativo: i + 1 });
      await pausa(ATTESE_RITENTATIVO[Math.min(i, ATTESE_RITENTATIVO.length - 1)]);
    }
  }

  /** Dopo un riavvio: gli invii a metà diventano `esito_incerto` (mai
   *  rimandati), poi si consegna ogni esito rimasto su disco. */
  async function recupera() {
    for (const nome of readdirSync(dir.inCorso)) {
      const id = FILE_UUID.exec(nome)?.[1];
      if (!id) continue;
      rmSync(join(dir.inCorso, nome), { force: true });
      try {
        readFileSync(fileEsito(id));
      } catch {
        scrivi(fileEsito(id), { id, esito: "errore", motivo: "esito_incerto" });
        registro("invio_esito_incerto");
      }
    }
    for (const nome of readdirSync(dir.esiti)) {
      const id = FILE_UUID.exec(nome)?.[1];
      let dati = null;
      try {
        dati = id ? esitoValido(id, JSON.parse(readFileSync(join(dir.esiti, nome), "utf8"))) : null;
      } catch {
        dati = null;
      }
      if (!dati) {
        rmSync(join(dir.esiti, nome), { force: true });
        continue;
      }
      await consegna(dati);
    }
  }

  /** Un messaggio preso dal CRM: controlla, scrive l'in-corso, conta il
   *  tentativo, manda, scrive l'esito, lo consegna. */
  async function esegui(invio) {
    const id = invio?.id;
    if (typeof id !== "string" || !UUID.test(id)) {
      conti.ko++;
      registro("invio_errore", { id_non_valido: 1 });
      return;
    }
    const { numero, testo } = invio;
    registro("invio_preso");
    let esito;
    if (typeof numero !== "string" || !NUMERO.test(numero)) esito = { id, esito: "errore", motivo: "numero_non_valido" };
    else if (typeof testo !== "string" || testo.trim() === "" || [...testo].length > LIMITI_PONTE.caratteri) esito = { id, esito: "errore", motivo: "testo_non_valido" };
    else if (!collegato()) esito = { id, esito: "errore", motivo: "non_collegato" };
    else {
      // prima di mandare: l'in-corso (se cade tutto, al riavvio si sa che era in volo) e il conto
      try {
        scrivi(fileInCorso(id), { id, preso_il: orologio() });
        presi = [...presi.filter((t) => orologio() - t < GIORNO_MS), orologio()];
        scrivi(dir.storico, presi);
        jitterMs = Math.floor(casuale() * RITARDO_MASSIMO_MS);
      } catch {
        rmSync(fileInCorso(id), { force: true });
        esito = { id, esito: "errore", motivo: "errore_invio" };
      }
      if (!esito) {
        let r;
        try {
          r = await inviaTesto(numero, testo);
        } catch {
          r = { ok: false, motivo: "esito_incerto" };
        }
        if (r?.ok) esito = { id, esito: "inviato", wa_id: r.id, ...(Number.isInteger(r.ts) ? { ts: r.ts } : {}) };
        else esito = { id, esito: "errore", motivo: r?.motivo === "non_collegato" ? "non_collegato" : "esito_incerto" };
      }
    }
    if (esito.esito === "inviato") conti.ok++;
    else conti.ko++;
    registro(esito.esito === "inviato" ? "invio_inviato" : "invio_errore");
    try {
      scrivi(fileEsito(id), esito);
    } catch {
      registro("invio_esito_non_scritto");
    }
    rmSync(fileInCorso(id), { force: true });
    await consegna(esito);
  }

  /** Il ciclo: chiede, manda, ricomincia; esce a coda vuota, a limite
   *  raggiunto, spento, scollegato o fermato. */
  async function ciclo() {
    await recupera();
    let guasti = 0;
    while (!fermato && attivo && collegato()) {
      const p = puoPartire({ adesso: orologio(), presi, jitterMs });
      if (!p.ok) {
        if (p.perche === "giorno") {
          registro("invio_limite", { giorno: 1 });
          return;
        }
        await pausa(p.aspettaMs);
        continue;
      }
      const manca = ultimoPrendi + MINIMO_FRA_RICHIESTE_MS - orologio();
      if (manca > 0) {
        await pausa(manca);
        continue;
      }
      ultimoPrendi = orologio();
      const r = await spedisci({ url, token, corpo: { v: 1, tipo: "prendi" }, fetch });
      const c = r.corpo;
      if (r.stato === 200 && c?.ok === true && (c.invio === null || oggetto(c.invio))) {
        guasti = 0;
        if (c.invio) {
          await esegui(c.invio);
          continue;
        }
        if (c.limite === true) {
          registro("invio_limite", { server: 1 });
          return;
        }
        const attendi = Number(c.attendi_s);
        if (Number.isFinite(attendi) && attendi > 0) {
          await pausa(Math.max(MINIMO_FRA_RICHIESTE_MS, attendi * 1000));
          continue;
        }
        return; // coda vuota: si riparte dal battito dopo
      }
      if ([400, 401, 404, 503].includes(r.stato)) {
        // CRM non aggiornato, chiave cambiata, migrazione o segreto mancanti: non si martella
        registro("invio_server_non_pronto", { http: r.stato });
        if (r.stato === 401) registro("invio_non_autorizzato");
        await pausa(PAUSA_LUNGA_MS);
        continue;
      }
      // 429, 5xx, rete, risposta storta: le attese dei lotti
      registro("invio_server_occupato", { http: r.stato ?? 0 });
      await pausa(ATTESE_RITENTATIVO[Math.min(guasti++, ATTESE_RITENTATIVO.length - 1)]);
    }
  }

  function sveglia() {
    if (fermato) return Promise.resolve();
    if (corso) return corso;
    corso = ciclo()
      .catch(() => registro("invio_ciclo_fallito"))
      .finally(() => {
        corso = null;
      });
    return corso;
  }

  return {
    /** All'avvio del ponte: consegna gli esiti rimasti e chiude gli invii a metà. */
    avvia: () => sveglia(),
    sveglia,
    /** La risposta al battito: `invii_in_attesa` > 0 (intero) fa partire il ciclo. */
    dopoBattito(corpo) {
      const n = corpo?.invii_in_attesa;
      if (!attivo || !collegato() || !Number.isInteger(n) || n <= 0) return false;
      void sveglia();
      return true;
    },
    /** SIGTERM: il ciclo esce appena può; ritorna quando ha finito. */
    ferma() {
      fermato = true;
      rilascia?.();
      return corso ?? Promise.resolve();
    },
    presi: () => [...presi],
    contatori: () => ({ invii_attivi: attivo ? 1 : 0, invii_ok: conti.ok, invii_ko: conti.ko }),
  };
}
