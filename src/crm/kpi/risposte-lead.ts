/** ─────────────────────────────────────────────────────────────────────────
 *  QUALE RISPOSTA COMPRA — il conto, senza schermo
 *
 *  DA DOVE ARRIVA
 *  Richiesta del committente: «voglio che sulla scheda lead ci siano tutte le
 *  risposte che danno nel questionario, in modo che dopo aggiungi su KPI il
 *  tasso di CVR in base alle risposte».
 *
 *  ── PERCHÉ UN FILE A PARTE, E PERCHÉ NON DENTRO A QUELLO CHE C'ERA GIÀ ────
 *  Nella pagina KPI esiste da tempo «Come rispondono al form»
 *  (crm/kpi/RisposteFormScheda): stessa domanda, ma su una popolazione
 *  DIVERSA — le risposte lasciate sul modulo della landing (`public_leads`),
 *  raggruppate su tre domande fisse che quel modulo ha sempre.
 *  Qui si contano le SCHEDE DEL CRM e le risposte che la persona ha dato al
 *  questionario dell'inserzione. Sono due insiemi che si sovrappongono solo in
 *  parte: chi arriva da un'inserzione e non compila mai la landing esiste solo
 *  qui. Mischiarli in una tabella sola darebbe un numero che non vuol dire
 *  niente e che nessun altro riquadro della pagina confermerebbe — il modo più
 *  rapido per far smettere di credere a tutta la pagina.
 *  Quindi: due schede accanto, stesse convenzioni (stessa soglia, stesso modo
 *  di dire «pochi dati», stessa definizione di cliente), e ognuna dichiara su
 *  cosa sta contando.
 *
 *  ── ⚠️ LE DOMANDE NON SONO SCRITTE QUI ───────────────────────────────────
 *  Si scoprono dai dati: ogni modulo di ogni campagna ha le sue, e cambiano
 *  senza avvisare. Un elenco scritto nel codice vorrebbe dire una campagna
 *  nuova che non compare nei conti finché qualcuno non pubblica una versione.
 *
 *  ── ⚠️ E UNA PERCENTUALE SU TRE LEAD NON È UNA PERCENTUALE ───────────────
 *  Le righe sotto la soglia restano visibili — sparire farebbe pensare a un
 *  errore — ma la loro percentuale non si mostra: con quattro lead una
 *  risposta sola sposta il tasso di venticinque punti, e su quel numero
 *  qualcuno deciderebbe dove mettere i soldi.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { Lead } from "@/crm/types";
import { domandaCorta } from "@/crm/modulo-lead";

export interface RigaRisposta {
  /** La risposta, come si legge. È anche la chiave: sono testo, non codici. */
  risposta: string;
  lead: number;
  clienti: number;
  /** Percentuale 0–100. Vale solo sopra la soglia: chi disegna lo sa. */
  cvrPct: number;
}

export interface DomandaConteggiata {
  /** La domanda per intero: è la chiave con cui si raggruppa. */
  domanda: string;
  /** La stessa, accorciata per stare in una linguetta. */
  titolo: string;
  /** Quante schede hanno risposto a questa domanda. */
  lead: number;
  clienti: number;
  righe: RigaRisposta[];
}

/** Il conto. `convertito` arriva da fuori ed è SEMPRE quello del resto del CRM
 *  (crm/lead-analytics → leadIsConverted): una seconda definizione di «ha
 *  comprato» dentro questo file vorrebbe dire due pagine che si smentiscono. */
export function domandeDeiLead(
  leads: Pick<Lead, "data">[],
  convertito: (l: Pick<Lead, "data">) => boolean,
): DomandaConteggiata[] {
  /** domanda → risposta → conti */
  const mappa = new Map<string, Map<string, { lead: number; clienti: number }>>();

  for (const l of leads) {
    const risposte = l.data?.modulo?.risposte ?? [];
    if (!risposte.length) continue;
    const vinto = convertito(l);
    //  ⚠️ Una scheda conta UNA volta per domanda. Se un file storto avesse
    //   portato due risposte alla stessa domanda, contarle entrambe gonfierebbe
    //   il totale di quella domanda sopra il numero di schede che esistono — e
    //   una percentuale con il denominatore sbagliato non si vede, si crede.
    const viste = new Set<string>();
    for (const r of risposte) {
      const domanda = String(r?.domanda ?? "").trim();
      const risposta = String(r?.risposta ?? "").trim();
      if (!domanda || !risposta || viste.has(domanda)) continue;
      viste.add(domanda);
      let perDomanda = mappa.get(domanda);
      if (!perDomanda) {
        perDomanda = new Map();
        mappa.set(domanda, perDomanda);
      }
      const conti = perDomanda.get(risposta) ?? { lead: 0, clienti: 0 };
      conti.lead++;
      if (vinto) conti.clienti++;
      perDomanda.set(risposta, conti);
    }
  }

  const out: DomandaConteggiata[] = [];
  for (const [domanda, perDomanda] of mappa) {
    const righe: RigaRisposta[] = [...perDomanda.entries()]
      .map(([risposta, c]) => ({
        risposta,
        lead: c.lead,
        clienti: c.clienti,
        cvrPct: c.lead > 0 ? (c.clienti / c.lead) * 100 : 0,
      }))
      //  Prima le risposte più date: è l'ordine in cui si guarda una tabella
      //  quando la domanda è «dove sta il grosso».
      .sort((a, b) => b.lead - a.lead || a.risposta.localeCompare(b.risposta, "it"));
    out.push({
      domanda,
      titolo: domandaCorta(domanda),
      lead: righe.reduce((s, r) => s + r.lead, 0),
      clienti: righe.reduce((s, r) => s + r.clienti, 0),
      righe,
    });
  }
  return out.sort((a, b) => b.lead - a.lead || a.domanda.localeCompare(b.domanda, "it"));
}

/** La riga che converte di più, fra quelle che hanno abbastanza dati.
 *  Con una sola riga misurabile non esiste un «migliore»: esiste l'unica
 *  misurata, e segnarla in grassetto direbbe una cosa che non è stata
 *  confrontata con niente. */
export function rispostaMigliore(d: DomandaConteggiata | undefined, soglia: number): string | null {
  const misurabili = (d?.righe ?? []).filter((r) => r.lead >= soglia);
  if (misurabili.length < 2) return null;
  const top = misurabili.reduce((m, r) => (r.cvrPct > m.cvrPct ? r : m));
  //  Tutte uguali: non c'è niente da indicare.
  return misurabili.every((r) => r.cvrPct === top.cvrPct) ? null : top.risposta;
}
