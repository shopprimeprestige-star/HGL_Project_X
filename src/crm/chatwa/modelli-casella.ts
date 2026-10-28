/** ── LA CASELLA · I MODELLI FUORI FINESTRA (regole pure) ───────────────────
 *
 *  Commessa 2026-10-28, compito T10 (D16). Fuori dalle 24 ore si può mandare
 *  solo un modello approvato. Qui: quali modelli stanno in evidenza (non
 *  chiedono dati), con che valori partono, e quando l'invio è permesso. Niente
 *  React: prove in `prove/manychat/chat-casella.mjs`.
 *
 *  ⚠️ I valori di partenza NON sono gli esempi di Meta («Mario», «18:00»): un
 *   esempio dimenticato in un campo partirebbe al cliente. I campi che non si
 *   conoscono restano vuoti e l'invio li pretende.
 *  ───────────────────────────────────────────────────────────────────────── */
import { MAX_PARAMETRI } from "@/crm/manychat/porta";
import type { MetaTemplate } from "@/crm/wa-meta-templates";

/** Le due variabili che la chat conosce da sola. */
const NOTE = ["lead_name", "consultant_name"];

/** Il modello non chiede altro che il nome del lead e del consulente (D16). */
export function senzaDati(t: MetaTemplate): boolean {
  return t.params.every((p) => NOTE.includes(p.key));
}

/** In evidenza quelli senza dati, sotto gli altri; l'ordine dato resta (D16). */
export function dividiModelli(modelli: MetaTemplate[]): {
  inEvidenza: MetaTemplate[];
  altri: MetaTemplate[];
} {
  return {
    inEvidenza: modelli.filter(senzaDati),
    altri: modelli.filter((t) => !senzaDati(t)),
  };
}

/** I valori di partenza, nell'ordine {{1}}, {{2}}…: nome e consulente se si sanno, il resto vuoto. */
export function valoriIniziali(
  t: MetaTemplate,
  dati: { nomeLead: string; nomeConsulente: string },
): string[] {
  return t.params.map((p) =>
    p.key === "lead_name"
      ? dati.nomeLead.trim()
      : p.key === "consultant_name"
        ? dati.nomeConsulente.trim()
        : "",
  );
}

/** L'invio è permesso? Stesse regole di «Prova i modelli» (`controllaProva`), senza il numero. */
export function controllaModello(
  t: MetaTemplate,
  valori: string[],
  canale: "manychat" | "cloud" | null,
): { ok: true; valori: string[] } | { ok: false; motivo: string } {
  const puliti = t.params.map((_, k) => (valori[k] ?? "").trim());
  for (const [k, p] of t.params.entries()) {
    const v = puliti[k];
    if (!v) return { ok: false, motivo: `Manca un valore: ${p.description}.` };
    //  Meta rifiuta (132018) a capo, tabulazioni e 4 spazi di fila in una variabile.
    if (/[\n\r\t]| {4}/.test(v))
      return {
        ok: false,
        motivo: `Il valore «${p.description}» non può avere a capo, tabulazioni o quattro spazi di fila.`,
      };
  }
  if (canale === "manychat" && t.params.length > MAX_PARAMETRI)
    return {
      ok: false,
      motivo: `Il modello ha ${t.params.length} variabili: ManyChat ne accetta al massimo ${MAX_PARAMETRI}.`,
    };
  return { ok: true, valori: puliti };
}
