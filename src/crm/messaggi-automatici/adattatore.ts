/** ── L'ADATTATORE DI LETTURA (registro → configurazione del giro) ───────────
 *
 *  Commessa 2026-10-31-interruttori-automatici. Il compito T1 ha scritto il contratto, il
 *  T2 la funzione `configDalRegistro`; la innesta il T4 nei due soli punti di lettura
 *  (`leggiRigaConfig` in `pannello.server.ts` e la porta `config` in `porte.server.ts`).
 *
 *  Contratto: `configDalRegistro(riga, registro)`
 *   · `riga`: la riga di `manychat_config` (canale, generale, tetti, flussi, sede…: restano
 *     lette da lì); `registro`: le righe di `messaggi_automatici`, o `null` se la lettura è fallita;
 *   · ritorna la STESSA forma che il giro legge oggi (`ConfigManychat`: `promemoria`,
 *     `ricontatti`, `leadNuovo`, `giornoMeet`, `stati`, `leadNuovoDal`, `ultimaAccensione`…)
 *     più `messaggiSpenti` (le chiavi di famiglia spente) e `avviso`;
 *   · registro `null` (errore o tabella mancante) = tutto spento + `avviso` (fail-closed);
 *     chiave sconosciuta = spenta.
 *
 *  ⚠️ Le vecchie colonne di `manychat_config` per i messaggi (`promemoria`, `ricontatti`,
 *   `lead_nuovo`, `giorno_meet`, `lead_nuovo_dal`, `stati`) NON si leggono più: dopo la
 *   migrazione sono valori congelati, serve solo `ripristina` per il rollback.
 *  ⚠️ Puro: nessuna rete, nessun orologio.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { ConfigManychat } from "../manychat/client-crm";
import { configDaRiga, type RigaConfig } from "../manychat/pannello";
import { STATI_ACCENDIBILI } from "../manychat/vista-pannello";
import {
  CATALOGO,
  FAMIGLIA_GIORNO_MEET,
  FAMIGLIA_LEAD_NUOVO,
  type ChiaveMessaggio,
} from "./catalogo";
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

const FRASE_ILLEGGIBILE =
  "Non si è riusciti a leggere l'elenco dei messaggi automatici: per sicurezza non parte niente.";
const FRASE_STATO_SENZA_DATA =
  "Un messaggio per stato risulta acceso ma senza la data di accensione: resta spento finché non lo si riaccende.";

/** Le chiavi che il giro toglie dentro la scelta quando sono spente. */
const DI_FAMIGLIA: readonly ChiaveMessaggio[] = [...FAMIGLIA_LEAD_NUOVO, ...FAMIGLIA_GIORNO_MEET];

/** Una data ISO che si legge, o `null`. */
const isoLetto = (v: string | null | undefined): string | null =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;

/** La più recente fra più date ISO (le illeggibili non contano). */
function piuRecente(date: (string | null | undefined)[]): string | null {
  let migliore: string | null = null;
  for (const d of date) {
    const letta = isoLetto(d);
    if (letta && (!migliore || Date.parse(letta) > Date.parse(migliore))) migliore = letta;
  }
  return migliore;
}

export const configDalRegistro: FunzioneConfigDalRegistro = (riga, registro) => {
  const base = configDaRiga(riga);
  // Il generale, il canale, i tetti, i flussi, la sede, le date del generale: da `manychat_config`.
  const {
    acceso: generale,
    canale,
    indirizzoSede,
    tetti,
    flussi,
    primaAccensione,
    fermatoMotivo,
  } = base;

  if (registro === null)
    return {
      ...base,
      promemoria: false,
      ricontatti: false,
      leadNuovo: false,
      giornoMeet: false,
      leadNuovoDal: null,
      stati: {},
      sequenze: false,
      messaggiSpenti: [...DI_FAMIGLIA],
      avviso: FRASE_ILLEGGIBILE,
    };

  // Solo le righe con `acceso === true` esatto sono accese. Le due voci bloccate dal codice non producono
  // niente: il messaggio all'ora non ha un campo, e l'acconto non è fra `STATI_ACCENDIBILI`.
  const accese = new Map<string, RigaRegistro>();
  for (const r of registro) if (r && r.acceso === true) accese.set(r.chiave, r);
  const acceso = (k: ChiaveMessaggio) => accese.has(k);

  const stati: Record<string, string> = {};
  let avviso: string | null = null;
  // Nell'ordine del catalogo: l'ordine delle chiavi di `stati` non dipende da quello del database.
  for (const v of CATALOGO) {
    if (!v.chiave.startsWith("stato:") || !accese.has(v.chiave)) continue;
    const dal = isoLetto(accese.get(v.chiave)?.acceso_dal);
    if (!dal) {
      avviso = FRASE_STATO_SENZA_DATA;
      continue;
    }
    const nome = v.chiave.slice("stato:".length);
    // «Cliente assente» vale anche per il vecchio stato `non_fatto`.
    for (const stato of nome === "no_show" ? ["no_show", "non_fatto"] : [nome])
      if ((STATI_ACCENDIBILI as string[]).includes(stato)) stati[stato] = dal;
  }

  const lead = FAMIGLIA_LEAD_NUOVO.filter(acceso);
  const ricontattoFissato = accese.get("ricontatto_fissato");
  return {
    ...base,
    canale,
    acceso: generale,
    promemoria: acceso("promemoria_meet"),
    ricontatti: !!ricontattoFissato,
    leadNuovo: lead.length > 0,
    giornoMeet: FAMIGLIA_GIORNO_MEET.some(acceso),
    // Riaccendere uno solo sposta la data per tutta la famiglia: nessuna ondata di lead vecchi.
    leadNuovoDal: piuRecente(lead.map((k) => accese.get(k)?.acceso_dal)),
    stati,
    indirizzoSede,
    // Il registro è l'aggiornamento del database che le sequenze chiedevano.
    sequenze: true,
    tetti,
    flussi,
    primaAccensione,
    ultimaAccensione: piuRecente([base.ultimaAccensione, ricontattoFissato?.acceso_dal]),
    fermatoMotivo,
    messaggiSpenti: DI_FAMIGLIA.filter((k) => !acceso(k)),
    avviso,
  };
};
