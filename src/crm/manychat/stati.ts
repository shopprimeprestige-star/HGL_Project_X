/** ── I MESSAGGI PER STATO ──────────────────────────────────────────────────
 *
 *  SCHELETRO del compito 0 (commessa 2026-10-25): solo tipi e firme; la tabella
 *  è vuota. Tabella e corpi li scrive il compito T (piano §5g, §8), con le prove
 *  in `prove/manychat/stati.mjs`.
 *
 *  `TABELLA_STATI`: stato → modello, variabili, regola del quando, chi, tag.
 *  `decidiPerStato`: i messaggi a evento (`ricontatto`, chiave
 *  `s|<codice>|tel9|<statoDal>`) e i due promemoria a orario
 *  (`promemoria_chiamata`, `promemoria_sede`). I ricontatti a data restano in
 *  `codaRicontatti` (`quando.ts`), che sceglie il modello da questa tabella.
 *  Modulo PURO. */
import type { LeadStatus } from "../types";
import type { DecisioneQuando, ContestoQuando, SchedaQuando } from "./quando";

/** Quando parte il messaggio di uno stato (piano §5g, «tre regole del quando»). */
export type QuandoStato = "a_data" | "a_evento" | "a_orario";

/** Una riga della tabella del §5g. Le attese e le finestre esatte le fissa T. */
export interface RigaStato {
  /** il nome del modello ManyChat, es. `hgl_ricontatto_consulenza` */
  modello: string;
  /** l'etichetta del tag ManyChat, es. `crm-ricontatto` */
  tag: string;
  quando: QuandoStato;
  /** a evento: i minuti di attesa dopo `statoDal` */
  attesaMin?: number;
  /** chi riceve: i lead del consulente, o tutti (anche i lead importati) */
  chi: "consulente" | "tutti";
}

export const TABELLA_STATI: Partial<Record<LeadStatus, RigaStato>> = {};

/** Cosa serve in più ai messaggi per stato. */
export interface ContestoStati extends ContestoQuando {
  fraseModuloDal: string | null;
  /** `manychat_config.stati`: stato → ISO dell'accensione (assente = spento) */
  statiAccesi: Record<string, string>;
  /** `manychat_config.indirizzo_sede`: vuoto → `promemoria_sede` non parte */
  indirizzoSede: string | null;
}

export type ExtraStato = {
  tipo: "ricontatto" | "promemoria_chiamata" | "promemoria_sede";
  stato: LeadStatus;
};

export function decidiPerStato(
  _schede: SchedaQuando[],
  _adesso: Date,
  _contesto: ContestoStati,
): DecisioneQuando<ExtraStato>[] {
  throw new Error("decidiPerStato: da scrivere (compito T)");
}
