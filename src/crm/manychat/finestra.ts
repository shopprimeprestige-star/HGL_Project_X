/** ── DENTRO LE 24 ORE: TESTO NORMALE, NON IL MODELLO ──────────────────────────
 *
 *  Richiesta del titolare (29/10/2026): «tutti i lead che rispondono, da quel
 *  momento tutti i messaggi che invia il CRM usano messaggi standard senza
 *  template». Finché la finestra di 24 ore è aperta (il cliente ha scritto da
 *  poco) un modello costa e sembra automatico: lo stesso testo, mandato come
 *  messaggio normale, no.
 *
 *  Qui le due regole pure (provate in prove/prove.mjs e prove/manychat/porta.mjs); le usa
 *  la porta (`porta.ts`, solo canale ManyChat):
 *   · `finestraPerTesto`: l'ultimo messaggio del cliente è più recente di
 *     23 ore (un'ora di margine: un testo che arriva a ManyChat dopo la
 *     chiusura viene rifiutato);
 *   · `testoDelModello`: il testo del modello con i suoi valori, dalla copia
 *     dei modelli nel CRM. Se un valore manca o il modello non è nella copia:
 *     `null`, e parte il modello come sempre.
 *  ⚠️ Se ManyChat rifiuta comunque il testo (finestra chiusa per lui), la
 *   porta ripiega SUBITO sul modello, nello stesso invio: niente va perso.
 *  ───────────────────────────────────────────────────────────────────────── */
import { findMetaTemplate } from "@/crm/wa-meta-templates";

/** Margine prima della chiusura vera (24 h): oltre 23 h si usa il modello. */
export const ORE_TESTO_LIBERO = 23;

/** La finestra è aperta abbastanza per un testo normale? */
export function finestraPerTesto(ultimaEntrata: string | null | undefined, adesso: Date): boolean {
  const t = Date.parse(String(ultimaEntrata ?? ""));
  if (!Number.isFinite(t)) return false;
  const passato = adesso.getTime() - t;
  //  Un'ora nel futuro (orologi sfasati) va bene; più in là no.
  return passato > -3_600_000 && passato < ORE_TESTO_LIBERO * 3_600_000;
}

/** I modelli che non sono solo testo (immagine, pulsanti): partono sempre
 *  come modello. `hgl_casi_reali` ha l'immagine in testa e un pulsante link. */
export const SOLO_COME_MODELLO: readonly string[] = ["hgl_casi_reali"];

/** Il testo del modello coi valori `{{1}}`, `{{2}}`…, o `null` se non si può. */
export function testoDelModello(nome: string, parametri: string[]): string | null {
  if (SOLO_COME_MODELLO.includes(nome.replace(/_v\d+$/, ""))) return null;
  const t = findMetaTemplate(nome) ?? findMetaTemplate(nome.replace(/_v\d+$/, ""));
  if (!t) return null;
  let mancante = false;
  const testo = t.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const v = String(parametri[Number(n) - 1] ?? "").trim();
    if (!v) mancante = true;
    return v;
  });
  if (mancante || /\{\{|\}\}/.test(testo) || !testo.trim()) return null;
  return testo.trim();
}
