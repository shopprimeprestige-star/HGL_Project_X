/** ── PONTE WHATSAPP · LE REVOCHE: AVVISARE IL CRM ───────────────────────────
 *
 *  Commessa 2026-10-31, ponte-revoche. Un messaggio nostro «eliminato per tutti» dal telefono
 *  (`estrai.mjs`: `revocaDa`, `revocaDaAggiornamento`) deve sparire anche dalla chat del CRM. Qui
 *  la coda delle chiavi `bw:<cifre>:<id>` da comunicare alla rotta del CRM
 *  (`{ v: 1, tipo: "revoca", chiave }`, stesso indirizzo e stessa chiave dei lotti).
 *
 *  Il Mac non sa se il messaggio è già nel CRM: l'originale può essere ancora in fila (i vivi
 *  aspettano 30 s per il pari di ManyChat) e il pari può arrivare dopo la prima richiesta. Perciò
 *  ogni chiave fa QUATTRO passaggi (subito, +5 minuti, +30 minuti, +2 ore) anche se il primo ha già
 *  trovato la riga: il CRM è idempotente (marca una riga una volta sola) e ripassare costa una
 *  richiesta. Un guasto (rete, 5xx, 429, 401/503) non fa avanzare il passaggio: si riprova dopo 30 s,
 *  2 minuti, 10 minuti, 30 minuti (poi ogni 30), per al più 24 ore. Un 400 (chiave rifiutata) si scarta.
 *
 *  Solo in memoria: la rete non è mai usata da qui (arriva `spedisci` di `lotti.mjs`), niente disco,
 *  niente socket. shortcut: se il ponte si riavvia le revoche in attesa si perdono (il messaggio
 *  resta visibile nel CRM finché non lo si elimina anche da lì); da cambiare in una coda su disco
 *  (come `immagini.mjs`) se succede nella pratica.
 *
 *  ⚠️ Nel registro solo codici fissi e numeri: mai la chiave, il numero del cliente o l'id del messaggio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { spedisci as spedisciVero } from "./lotti.mjs";

const MIN = 60_000;
const ORA = 60 * MIN;

/** I tempi e i tetti (le prove li leggono). */
export const REVOCHE = {
  /** attesa prima di ogni passaggio, contata dalla fine del precedente */
  passi: [0, 5 * MIN, 30 * MIN, 2 * ORA],
  /** attesa dopo un guasto, per tentativi consecutivi; poi resta sull'ultima */
  attesaGuasto: [30_000, 2 * MIN, 10 * MIN, 30 * MIN],
  /** oltre, la voce si scarta */
  scadenza: 24 * ORA,
  /** voci in attesa insieme */
  massimo: 200,
};

/** `bw:<8-15 cifre>:<id WhatsApp>`, come `chiaveMessaggio` di `src/crm/ponte/tipi.ts`. */
const CHIAVE_VALIDA = /^bw:\d{8,15}:[A-Za-z0-9_.-]{1,128}$/;

/** Un conteggio dalla risposta del CRM: intero ≥ 0, altrimenti 0 (mai testo nel registro). */
const conteggio = (x) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);

/** La coda.
 *
 *  `url`, `token`: la rotta del CRM e la chiave del ponte. `registro(codice, conteggi)`. Per le prove:
 *  `spedisci` (di serie quella di `lotti.mjs`), `orologio`, `pianifica`, `annulla`.
 *  Uscita: `{ accoda, ferma, contatori }`. `accoda(chiave)` non lancia mai e risponde `{ ok: true }`
 *  oppure `{ ok: false, motivo }` (`chiave_non_valida`, `coda_piena`, `fermo`). */
export function creaRevoche({ url, token, registro = () => {}, spedisci = spedisciVero, orologio = Date.now, pianifica = setTimeout, annulla = clearTimeout }) {
  /** chiave → { passo, guasti, prossimo_il, creata_il, trovata } */
  const coda = new Map();
  const conti = { fatte: 0, senza_riga: 0, scartate: 0, scadute: 0, coda_piena: 0 };
  let sveglia = null;
  let inVolo = null;
  let fermo = false;

  /** Mette in moto il timer sul prossimo passaggio. */
  function programma() {
    if (sveglia !== null) {
      annulla(sveglia);
      sveglia = null;
    }
    if (fermo || inVolo || coda.size === 0) return;
    const quando = Math.min(...[...coda.values()].map((v) => v.prossimo_il));
    sveglia = pianifica(() => {
      sveglia = null;
      return giro();
    }, Math.max(0, quando - orologio()));
  }

  /** La voce più vecchia il cui momento è arrivato, o null. */
  function dovuta() {
    const adesso = orologio();
    let scelta = null;
    for (const [chiave, v] of coda) if (v.prossimo_il <= adesso && (scelta === null || v.prossimo_il < coda.get(scelta).prossimo_il)) scelta = chiave;
    return scelta;
  }

  /** Un passaggio: una richiesta al CRM e quello che ne segue. Non lancia mai. */
  async function passaggio(chiave) {
    const v = coda.get(chiave);
    let r;
    try {
      r = await spedisci({ url, token, corpo: { v: 1, tipo: "revoca", chiave } });
    } catch {
      r = { stato: null, corpo: null };
    }
    const http = Number.isFinite(r?.stato) ? r.stato : 0;
    const adesso = orologio();
    if (http === 200) {
      const trovate = conteggio(r.corpo?.trovate);
      v.guasti = 0;
      v.trovata ||= trovate > 0;
      registro("revoca_inviata", { http, trovate, marcate: conteggio(r.corpo?.marcate), passo: v.passo + 1 });
      v.passo++;
      if (v.passo >= REVOCHE.passi.length) {
        coda.delete(chiave);
        if (v.trovata) conti.fatte++;
        else {
          conti.senza_riga++;
          registro("revoca_senza_riga");
        }
      } else v.prossimo_il = adesso + REVOCHE.passi[v.passo];
    } else if (http === 400) {
      coda.delete(chiave);
      conti.scartate++;
      registro("revoca_rifiutata", { http });
    } else if (adesso - v.creata_il > REVOCHE.scadenza) {
      coda.delete(chiave);
      conti.scadute++;
      registro("revoca_scaduta", { http });
    } else {
      v.prossimo_il = adesso + REVOCHE.attesaGuasto[Math.min(v.guasti, REVOCHE.attesaGuasto.length - 1)];
      v.guasti++;
      registro("revoca_non_arrivata", { http, tentativo: v.guasti });
    }
  }

  /** Una richiesta alla volta, finché ce ne sono di dovute. */
  async function giro() {
    if (fermo || inVolo) return;
    inVolo = (async () => {
      let chiave;
      while (!fermo && (chiave = dovuta()) !== null) await passaggio(chiave);
    })();
    try {
      await inVolo;
    } catch {
      registro("revoche_giro_fallito");
    } finally {
      inVolo = null;
      programma();
    }
  }

  function accoda(chiave) {
    if (fermo) return { ok: false, motivo: "fermo" };
    if (typeof chiave !== "string" || !CHIAVE_VALIDA.test(chiave)) return { ok: false, motivo: "chiave_non_valida" };
    if (coda.has(chiave)) return { ok: true };
    if (coda.size >= REVOCHE.massimo) {
      conti.coda_piena++;
      return { ok: false, motivo: "coda_piena" };
    }
    const adesso = orologio();
    coda.set(chiave, { passo: 0, guasti: 0, prossimo_il: adesso, creata_il: adesso, trovata: false });
    if (inVolo === null) programma();
    return { ok: true };
  }

  async function ferma() {
    fermo = true;
    if (sveglia !== null) {
      annulla(sveglia);
      sveglia = null;
    }
    try {
      await inVolo;
    } catch {
      /* già registrato dal giro */
    }
  }

  const contatori = () => ({ in_coda: coda.size, ...conti });

  return { accoda, ferma, contatori };
}
