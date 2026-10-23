/** ── IL GIRO A ORARIO ──────────────────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). SCHELETRO del compito 1: ci
 *  sono solo i tipi e la firma. Lo scrive il compito 3 (Dev C), con M2 e M3 e
 *  le prove in `prove/manychat/giro.mjs` (database e ManyChat finti).
 *
 *  pg_cron chiama `/hooks/manychat-giro` ogni minuto. Il giro (PIANO §4.3):
 *   1. prende il lucchetto da 120 s; se non lo prende, esce;
 *   2. controlla migrazione, configurazione, chiave, `user_id`, fermo in corso;
 *   3. registra «Non ha risposto» sulle schede scadute (`dopoScadenza`);
 *   4. AL MASSIMO 2 invii per giro: prima i promemoria nella finestra, poi al
 *      massimo UN ricontatto; dopo 20 s dall'inizio non ne apre un altro;
 *   5. per ogni invio: `manychat_prenota_giro` (tetti, ritmo, pausa, chiave sul
 *      telefono, STOP) → rilegge la scheda e rifà la decisione → contatto →
 *      campi → tag → `sendFlow` → esito → `contattoWa` → `whatsapp_messages`;
 *   6. errore incerto o tempo scaduto: la riga resta `prenotato`, dopo 10'
 *      diventa `incerto`, e non si rimanda mai;
 *   7. 2 falliti di fila, o un `blocco` → `acceso = false` col motivo;
 *   8. scrive `ultimo_giro_il` e lo stato, e lascia il lucchetto.
 *
 *  `prova: true` = prova a secco: nessuna scrittura e nessuna chiamata a
 *  ManyChat. Il giro non accetta mai `prova` da una richiesta pubblica.
 *  ⚠️ Nei log solo codici: mai numero, nome o chiavi.
 *  ───────────────────────────────────────────────────────────────────────── */

/** I conteggi che il giro lascia al riquadro (mai nomi né numeri). */
export interface EsitoGiroManychat {
  /** perché il giro non ha fatto niente, se è così: `lucchetto`, `spento`,
   *  `senza_migrazione`, `senza_chiave`… */
  fermo?: string;
  promemoriInviati: number;
  ricontattiInviati: number;
  saltati: number;
  incerti: number;
  /** schede passate a «Non ha risposto» in questo giro */
  scadute: number;
  /** vero se un blocco ha spento l'interruttore generale */
  spento?: boolean;
}

/** Le porte del giro (database, porta degli invii, orologio, numero a caso). Le
 *  dettaglia il compito 3. */
export interface PorteGiro {
  adesso(): Date;
}

export async function giroManychat(
  _porte: PorteGiro,
  _o: { prova: boolean },
): Promise<EsitoGiroManychat> {
  throw new Error("manychat/giro: giroManychat non è ancora scritta (compito 3)");
}
