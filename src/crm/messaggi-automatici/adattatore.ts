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
import { configDaRiga, type RigaConfig } from "../manychat/pannello";
import { FAMIGLIA_GIORNO_MEET, FAMIGLIA_LEAD_NUOVO, type ChiaveMessaggio } from "./catalogo";
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

/** ⚠️ TEMPORANEO (T4): versione minima, solo perché il giro compili e si provi prima della consegna
 *  di T2. T2 la RIEMPIE con la sua: chi integra tiene il file di T2 e scarta questo commit. */
export const configDalRegistro: FunzioneConfigDalRegistro = (riga, registro) => {
  const base = configDaRiga(riga);
  const spenti = [...FAMIGLIA_LEAD_NUOVO, ...FAMIGLIA_GIORNO_MEET] as ChiaveMessaggio[];
  if (registro === null)
    return {
      ...base,
      promemoria: false,
      ricontatti: false,
      leadNuovo: false,
      giornoMeet: false,
      stati: {},
      leadNuovoDal: null,
      messaggiSpenti: spenti,
      avviso: "registro dei messaggi non letto: tutto spento",
    };
  const riga_ = (k: string) => registro.find((x) => x.chiave === k);
  const acceso = (k: string) => riga_(k)?.acceso === true;
  const dal = (k: string) => {
    const il = riga_(k)?.acceso_dal;
    return il && Number.isFinite(Date.parse(il)) ? il : null;
  };
  const piuRecente = (a: (string | null)[]) =>
    a.filter((x): x is string => !!x).sort((x, y) => Date.parse(y) - Date.parse(x))[0] ?? null;
  const lead = FAMIGLIA_LEAD_NUOVO.filter(acceso);
  const stati: Record<string, string> = {};
  for (const r of registro) {
    const m = /^stato:(.+)$/.exec(r.chiave);
    const il = dal(r.chiave);
    if (!m || !r.acceso || !il) continue;
    stati[m[1]] = il;
    if (m[1] === "no_show") stati.non_fatto = il;
  }
  return {
    ...base,
    promemoria: acceso("promemoria_meet"),
    ricontatti: acceso("ricontatto_fissato"),
    leadNuovo: lead.length > 0,
    giornoMeet: FAMIGLIA_GIORNO_MEET.some(acceso),
    leadNuovoDal: piuRecente(lead.map(dal)),
    stati,
    ultimaAccensione: piuRecente([
      base.ultimaAccensione,
      acceso("ricontatto_fissato") ? dal("ricontatto_fissato") : null,
    ]),
    messaggiSpenti: spenti.filter((k) => !acceso(k)),
    avviso: null,
  };
};
