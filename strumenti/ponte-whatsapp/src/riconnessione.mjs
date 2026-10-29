/** ── PONTE WHATSAPP · QUANDO E COME RICOLLEGARSI ───────────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T5 (PIANO §a3).
 *  PURO: la tabella «motivo di chiusura → azione e attesa». La usa T6 in
 *  `collega.mjs` a ogni `connection.update` con `connection: 'close'`; alla
 *  `connection: 'open'` la storia torna `STORIA_VUOTA`.
 *
 *  ⚠️ Mai un ciclo stretto di riconnessioni: un numero che si ricollega a
 *   raffica è la via più corta al blocco. Ricreano subito solo il 515 (una
 *   volta, dopo l'abbinamento) e il 401 (con una sessione nuova, cioè un QR).
 *  ───────────────────────────────────────────────────────────────────────── */

/** Le attese, in ms. `rete` vale per ogni chiusura non elencata. */
export const ATTESE = {
  rete: [5000, 15_000, 45_000, 120_000, 300_000],
  sostituita: [600_000, 3_600_000],
  bloccata: 1_800_000,
  /** ±20 % a caso sulle attese della rete */
  variazione: 0.2,
  /** dal terzo tentativo fallito lo stato è `rete_assente` */
  tentativiPerAssente: 3,
};

/** Codici di `DisconnectReason` di Baileys 7 che hanno un'azione propria. */
export const CHIUSURE = { loggedOut: 401, forbidden: 403, connectionReplaced: 440, badSession: 500, restartRequired: 515 };

/** Quante volte è successo, da quando la connessione era aperta. */
export const STORIA_VUOTA = Object.freeze({ rete: 0, sostituita: 0, riavvio: 0 });

/** Il codice di chiusura da `lastDisconnect` (un Boom: `error.output.statusCode`). */
export function codiceChiusura(lastDisconnect) {
  const c = lastDisconnect?.error?.output?.statusCode;
  return Number.isInteger(c) ? c : null;
}

/** Decide che cosa fare dopo una chiusura.
 *  Uscita: `{ scollega, attesaMs, stato, notifica, storia }`:
 *   - `scollega`: spostare `auth/` da parte e ripartire senza credenziali (QR);
 *   - `attesaMs`: quanto aspettare prima di ricreare il socket;
 *   - `stato`: parola di `STATI_PONTE` per il battito e `stato.json`;
 *   - `notifica`: avvisare il titolare con una notifica macOS;
 *   - `storia`: da ripassare alla prossima chiusura. */
export function decidi(codice, storia = STORIA_VUOTA, casuale = Math.random) {
  const s = { ...STORIA_VUOTA, ...storia };
  const esito = (attesaMs, stato, altro = {}) => ({ scollega: false, attesaMs, stato, notifica: false, storia: s, ...altro });

  if (codice === CHIUSURE.restartRequired && s.riavvio === 0) {
    return esito(0, "in_collegamento", { storia: { ...s, riavvio: 1 } });
  }
  if (codice === CHIUSURE.loggedOut) {
    return esito(0, "sessione_scaduta", { scollega: true, notifica: true, storia: { ...STORIA_VUOTA } });
  }
  if (codice === CHIUSURE.connectionReplaced) {
    const attesa = ATTESE.sostituita[Math.min(s.sostituita, ATTESE.sostituita.length - 1)];
    return esito(attesa, "sostituita", { notifica: s.sostituita === 0, storia: { ...s, sostituita: s.sostituita + 1 } });
  }
  if (codice === CHIUSURE.forbidden || codice === CHIUSURE.badSession) {
    return esito(ATTESE.bloccata, "errore", { notifica: true });
  }
  // rete, 408, 428, 503, un 515 ripetuto e ogni altro codice
  const base = ATTESE.rete[Math.min(s.rete, ATTESE.rete.length - 1)];
  const attesa = Math.round(base * (1 + (casuale() * 2 - 1) * ATTESE.variazione));
  const tentativo = s.rete + 1;
  return esito(attesa, tentativo >= ATTESE.tentativiPerAssente ? "rete_assente" : "in_collegamento", { storia: { ...s, rete: tentativo } });
}
