/** ── FATTURATO CONTRO INCASSATO, SU UNA SCHEDA ─────────────────────────────
 *
 *  Due numeri che vengono da due mondi: quello che il cliente ha pagato (la
 *  cassa) e quello che gli è stato fatturato (i documenti). Su una pratica
 *  possono coincidere, e spesso coincidono; quando non coincidono la
 *  differenza è un lavoro da fare — un acconto incassato e mai fatturato, un
 *  saldo arrivato dopo l'ultima fattura — e finora non la vedeva nessuno
 *  finché non la chiedeva il commercialista.
 *
 *  ⚠️ QUI NON SI DECIDE NIENTE, SI CONFRONTA. Questo modulo non dice quanto
 *   andava fatturato né cosa fare della differenza: mette due cifre una
 *   accanto all'altra e dice di quanto distano. Chi fattura decide.
 */
import type { Fattura } from "./tipi";

export interface FatturatoDelLead {
  /** somma dei totali delle fatture EMESSE per questa scheda */
  totale: number;
  quante: number;
}

/** ⚠️ Solo le EMESSE, mai le bozze: una bozza è un foglio che si sta
 *  preparando, non un documento — contarla farebbe risultare fatturato quello
 *  che nessuno ha ancora mandato allo SDI. */
export function fatturatoDelLead(emesse: Fattura[], leadId: string): FatturatoDelLead {
  const id = String(leadId ?? "").trim();
  if (!id) return { totale: 0, quante: 0 };
  let totale = 0;
  let quante = 0;
  for (const f of emesse) {
    if (String(f?.leadId ?? "") !== id) continue;
    totale += Number(f.totale) || 0;
    quante += 1;
  }
  return { totale: Math.round(totale * 100) / 100, quante };
}

export type StatoDivario = "pari" | "da_fatturare" | "oltre" | "niente";

export interface Divario {
  stato: StatoDivario;
  /** quanto distano le due cifre, sempre positivo */
  differenza: number;
}

/** Come stanno messe le due cifre.
 *  ⚠️ Un euro di tolleranza: fra l'arrotondamento dell'IVA e i centesimi di un
 *   bonifico, due cifre che «sono la stessa cosa» differiscono di pochi
 *   centesimi — e un avviso che compare per due centesimi si smette di
 *   guardare in una settimana.
 *  ⚠️ «Oltre» NON è un errore: si fattura anche prima di incassare (una
 *   fattura a saldo emessa il giorno prima del bonifico), e chiamarlo guaio
 *   farebbe suonare un allarme su una cosa normale. Si dice e basta. */
export function divarioFattura(incassato: number, fatturato: number): Divario {
  const i = Math.max(0, Number(incassato) || 0);
  const f = Math.max(0, Number(fatturato) || 0);
  if (i <= 0 && f <= 0) return { stato: "niente", differenza: 0 };
  const d = Math.round(Math.abs(i - f) * 100) / 100;
  if (d <= 1) return { stato: "pari", differenza: 0 };
  return { stato: i > f ? "da_fatturare" : "oltre", differenza: d };
}
