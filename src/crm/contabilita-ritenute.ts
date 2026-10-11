/** ── LA RITENUTA D'ACCONTO ─────────────────────────────────────────────────
 *
 *  Quando un professionista o un collaboratore occasionale emette fattura, il
 *  20% non glielo paghi: lo trattieni e lo versi tu allo Stato per conto suo.
 *  Da quel momento la società è **sostituto d'imposta**, e non è una formalità:
 *
 *   1. il 20% va versato con l'F24 entro il **16 del mese successivo** a quello
 *      del pagamento — codice tributo **1040** (redditi di lavoro autonomo);
 *   2. entro il **16 marzo** dell'anno dopo va consegnata la **Certificazione
 *      Unica** a ognuno di loro, e trasmessa all'Agenzia;
 *   3. entro il **31 ottobre** va presentato il **modello 770**.
 *  La sanzione per il versamento tardivo è del 30%, e quella per la CU non
 *  trasmessa è di 100 € per certificazione.
 *
 *  ── ⚠️ LA RITENUTA NON È UN COSTO, ED È QUI CHE CI SI SBAGLIA ─────────────
 *  Il costo è l'imponibile INTERO della fattura: il professionista quel denaro
 *  lo ha guadagnato tutto, e il fatto che una parte l'abbiamo versata noi allo
 *  Stato al posto suo non lo rende meno costo. Quello che cambia è quanto esce
 *  dal conto corrente verso di LUI. Sottrarre la ritenuta dai costi
 *  deducibili farebbe pagare più imposte del dovuto; sommarla come costo a sé
 *  ne farebbe pagare di meno. Non si tocca il costo: si tiene un debito verso
 *  lo Stato, separato.
 *
 *  ── ⚠️ E NON C'ENTRA CON L'IVA ────────────────────────────────────────────
 *  L'IVA della fattura si detrae per intero, ritenuta o non ritenuta. Sono due
 *  imposte diverse su due binari diversi, e mescolarle è l'errore che fa
 *  quadrare male tutte e due le liquidazioni.
 *
 *  ── ⚠️ SUI FORNITORI ESTERI NON SI APPLICA, quasi mai ─────────────────────
 *  Un professionista non residente non è soggetto a ritenuta italiana se il
 *  lavoro è svolto all'estero, e per le royalties esistono le convenzioni
 *  contro le doppie imposizioni. Il campo si chiede solo sulle fatture
 *  italiane: chiederlo su Meta insegnerebbe a rispondere a caso.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { FatturaFornitore } from "./contabilita-fornitori";
import { primoGiornoUtile } from "./contabilita-scadenze";

/** L'aliquota ordinaria della ritenuta sui redditi di lavoro autonomo. */
export const ALIQUOTA_RITENUTA = 20;
/** Il codice tributo dell'F24. ⚠️ 1040 è il lavoro autonomo; per le
 *  provvigioni degli agenti è il 1038, e per il lavoro dipendente il 1001.
 *  Qui si tratta il caso di gran lunga più frequente per una società come
 *  questa — il professionista che emette parcella — e il prospetto lo dice. */
export const CODICE_RITENUTA = "1040";

const c2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const due = (n: number) => String(n).padStart(2, "0");

export interface VersamentoRitenuta {
  /** Il mese in cui è stato pagato il fornitore: «2026-07». */
  mese: string;
  importo: number;
  /** Entro quando va versato: il 16 del mese dopo, già slittato. */
  entro: string;
  /** Da quali fatture viene: serve a ritrovarle. */
  quante: number;
  chi: string[];
}

/** ── ⚠️ IL MESE È QUELLO DEL PAGAMENTO, NON DELLA FATTURA ─────────────────
 *  La ritenuta si versa in base a quando il professionista è stato PAGATO —
 *  è una trattenuta su un pagamento, e se la parcella è di giugno ma la si
 *  salda a settembre, si versa entro il 16 ottobre.
 *  ⚠️ Il CRM la data di pagamento delle fatture ricevute non ce l'ha, e non se
 *   la inventa: usa la data del documento e lo SCRIVE nel prospetto. Chi paga
 *   a distanza di mesi lo sa, e sposta. Meglio una data dichiarata e
 *   correggibile che una sbagliata presentata come certa. */
export function versamentiRitenuta(fornitori: FatturaFornitore[]): VersamentoRitenuta[] {
  const perMese = new Map<string, { importo: number; chi: string[] }>();
  for (const f of fornitori) {
    const r = c2(f.ritenuta ?? 0);
    if (r <= 0) continue;
    const mese = String(f.data ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mese)) continue;
    const v = perMese.get(mese) ?? { importo: 0, chi: [] };
    v.importo = c2(v.importo + r);
    if (!v.chi.includes(f.fornitore)) v.chi.push(f.fornitore);
    perMese.set(mese, v);
  }
  return [...perMese.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mese, v]) => {
      const a = Number(mese.slice(0, 4));
      const m = Number(mese.slice(5, 7));
      const dopo = m === 12 ? { a: a + 1, m: 1 } : { a, m: m + 1 };
      return {
        mese,
        importo: v.importo,
        entro: primoGiornoUtile(`${dopo.a}-${due(dopo.m)}-16`),
        quante: v.chi.length,
        chi: v.chi,
      };
    });
}

/** Quanto si è trattenuto in tutto nel periodo. */
export const totaleRitenute = (v: VersamentoRitenuta[]): number =>
  c2(v.reduce((s, x) => s + x.importo, 0));

/** ── I DUE ADEMPIMENTI DELL'ANNO ──────────────────────────────────────────
 *  Chi ha trattenuto anche una sola volta in un anno deve fare la
 *  Certificazione Unica e il 770 di quell'anno. Sono le due cose che si
 *  scoprono di dover fare quando è tardi, perché nessuno le collega alla
 *  parcella pagata dieci mesi prima. */
export function adempimentiAnnuali(
  anno: number,
): { cosa: string; entro: string; perche: string }[] {
  return [
    {
      cosa: `Certificazione Unica ${anno + 1} (redditi ${anno})`,
      entro: primoGiornoUtile(`${anno + 1}-03-16`),
      perche:
        "Va consegnata a ogni professionista a cui hai trattenuto qualcosa, e trasmessa all'Agenzia. Sanzione: 100 € per ogni certificazione non trasmessa.",
    },
    {
      cosa: `Modello 770 ${anno + 1} (redditi ${anno})`,
      entro: primoGiornoUtile(`${anno + 1}-10-31`),
      perche:
        "Il riepilogo di tutte le ritenute operate e versate nell'anno. Lo presenta il commercialista, ma solo se sa che ci sono state ritenute.",
    },
  ];
}
