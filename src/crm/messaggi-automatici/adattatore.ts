/** ── L'ADATTATORE DI LETTURA (registro → configurazione del giro) ───────────
 *
 *  Commessa 2026-10-31-interruttori-automatici. Il compito T1 scrive qui SOLO il
 *  contratto (i tipi); la funzione `configDalRegistro` la scrive il compito T2 e la
 *  innesta il T4 nei due soli punti di lettura (`leggiRigaConfig` in
 *  `pannello.server.ts` e la porta `config` in `porte.server.ts`).
 *
 *  Contratto: `configDalRegistro(riga, registro)`
 *   · `riga`: la riga di `manychat_config` (canale, generale, tetti, flussi, sede…: restano
 *     lette da lì); `registro`: le righe di `messaggi_automatici`, o `null` se la lettura è fallita;
 *   · ritorna la STESSA forma che il giro legge oggi (`ConfigManychat`: `promemoria`,
 *     `ricontatti`, `leadNuovo`, `giornoMeet`, `stati`, `leadNuovoDal`, `ultimaAccensione`…)
 *     più `messaggiSpenti` (le chiavi di famiglia spente) e `avviso`;
 *   · registro `null` (errore o tabella mancante) = tutto spento + `avviso` (fail-closed);
 *     chiave sconosciuta = spenta.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { ConfigManychat } from "../manychat/client-crm";
import type { RigaConfig } from "../manychat/pannello";
import type { ChiaveMessaggio } from "./catalogo";
import type { RigaRegistro } from "./tipi";

export interface ConfigDalRegistro extends ConfigManychat {
  /** le chiavi spente che il giro deve togliere DENTRO la scelta (primo contatto, richiamo, ritorno, casi reali, mattina del meet, giorno prima) */
  messaggiSpenti: ChiaveMessaggio[];
  /** una frase se il registro non si è potuto leggere; `null` = tutto regolare */
  avviso: string | null;
}

export type FunzioneConfigDalRegistro = (
  riga: RigaConfig | null | undefined,
  registro: RigaRegistro[] | null,
) => ConfigDalRegistro;

export {};
