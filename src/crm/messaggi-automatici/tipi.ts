/** ── I TIPI DEI MESSAGGI AUTOMATICI (rotta, registro, pannello) ─────────────
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T1. Solo tipi: nessun
 *  codice (il compito T2 scrive il registro e la rotta, il T7 il pannello). Sono il
 *  contratto fra i tre: il browser e il server si parlano in queste forme.
 *
 *  Rotta `/api/crm/messaggi-automatici` (permesso «impostazioni» su entrambi):
 *   GET  → 200 `RispostaMessaggi`
 *   POST `ComandoImposta` → 200 `RispostaMessaggi` (già riletta), oppure
 *          409 «Nel frattempo è cambiato: ricarica» (`prima` non è più vero),
 *          409 «Spento nel codice» (voce `bloccataDalCodice`), 400 chiave o corpo storti,
 *          403 senza permesso. Il NOME di chi clicca lo prende il server, mai il browser.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { ChiaveMessaggio } from "./catalogo";

/** Una riga di `messaggi_automatici` come arriva dal database. */
export interface RigaRegistro {
  chiave: string;
  acceso: boolean;
  /** l'istante dell'ultima accensione (messo dal database a ogni passaggio spento → acceso); `null` = mai, o dato non usato */
  acceso_dal: string | null;
}

/** Una riga di `messaggi_automatici_registro` (il log: solo aggiunte). */
export interface ModificaRegistro {
  chiave: string;
  prima: boolean;
  dopo: boolean;
  /** il nome di chi ha cliccato, preso dal server */
  da: string;
  /** ISO */
  il: string;
}

/** Cosa vede il pannello di un messaggio: lo stato, e l'ultima modifica del log. */
export interface VoceMessaggio {
  chiave: ChiaveMessaggio;
  acceso: boolean;
  /** ISO dell'ultima accensione */
  accesoDal: string | null;
  /** l'ultima riga del log per questa chiave («Spento da Filippo, 31/10 14:02»); `null` = mai toccata dal pannello */
  ultima: Pick<ModificaRegistro, "da" | "il" | "dopo"> | null;
  /** perché ora NON si può accendere (aggiornamento del database, data della frase del modulo, indirizzo sede, modello senza flusso); `null` = si può */
  impedimento: string | null;
}

/** La fascia in sola lettura sopra l'elenco. */
export interface FasciaMessaggi {
  /** l'interruttore generale di ManyChat: spento = il giro non scrive a nessuno */
  generale: boolean;
  canale: "cloud" | "manychat";
  /** perché il sistema ha fermato il giro da solo; `null` = nessun fermo */
  fermatoMotivo: string | null;
}

export interface RispostaMessaggi {
  /** una per chiave del catalogo, nello stesso ordine */
  voci: VoceMessaggio[];
  fascia: FasciaMessaggi;
  /** le ultime 20 righe del log, dalla più recente */
  ultime: ModificaRegistro[];
  /** `true` = manca l'aggiornamento del database (le tabelle non ci sono): è tutto spento */
  mancaMigrazione?: boolean;
}

/** Il corpo del POST. `prima` è quello che il browser ha visto: se nel frattempo è cambiato, 409. */
export interface ComandoImposta {
  chiave: ChiaveMessaggio;
  acceso: boolean;
  prima: boolean;
}
