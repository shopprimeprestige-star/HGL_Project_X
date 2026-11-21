/** ── LA SPEDIZIONE: COSTO, TEMPI, LINK DEL CORRIERE ────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T45 (PIANO-R2 D51, D54, D62). Modulo PURO: nessun accesso al
 *  database. Il server (T50 `tariffe.server.ts`) legge la riga e la passa qui; carrello, cassa e scheda leggono
 *  `SpedizionePubblica`. Soldi in centesimi, interi.
 *  Regola di D62: finché il titolare non ha confermato la tariffa, corriere, tempi e frase NON escono (il costo sì:
 *  serve per pagare). La vetrina non può promettere quello che nessuno ha confermato, nemmeno per errore. */

/** La riga di `shop_spedizioni_tariffe` (S5). I campi sono quelli del database; qui si leggono con prudenza. */
export type TariffaRiga = {
  paese?: unknown;
  corriere?: unknown;
  costo_cent?: unknown;
  gratis_da_cent?: unknown;
  giorni_min?: unknown;
  giorni_max?: unknown;
  attiva?: unknown;
  provvisoria?: unknown;
  confermata_il?: unknown;
};

/** Un corriere dell'elenco in `shop_impostazioni.corrieri`: il nome e il modello di link con `{numero}` (vuoto = nessun link). */
export type CorriereVoce = { nome?: unknown; modello?: unknown };

/** Il contratto per la vetrina (D62). Mai `provvisoria`, id, date. */
export type SpedizionePubblica =
  | { stato: "ok"; costoCent: number; confermata: boolean; corriere: string | null; tempi: { min: number; max: number } | null; frase: string | null }
  | { stato: "assente" };

const intero = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
const oggetto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const testo = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
/** Limite dei giorni lavorativi scritti dal titolare (stesso di T50: 0..60). */
const GIORNI_MAX = 60;

/** La prima tariffa attiva del paese, nell'ordine dell'elenco: due attive non devono esistere (indice unico), ma se capita se ne usa una sola. */
export function tariffaAttiva(tariffe: unknown, paese: unknown): TariffaRiga | null {
  const p = testo(paese).toUpperCase();
  if (!Array.isArray(tariffe) || !p) return null;
  for (const t of tariffe) if (oggetto(t) && t.attiva === true && testo(t.paese).toUpperCase() === p) return t;
  return null;
}

/** Cosa paga il cliente per la spedizione, in centesimi; `null` = non c'è una tariffa valida (la cassa non si apre).
 *  Soglia vuota (o zero) = ignorata, mai gratis; il subtotale storto non regala mai la spedizione. */
export function costoSpedizione(tariffa: TariffaRiga | null | undefined, subtotaleCent: unknown): number | null {
  if (!oggetto(tariffa) || !intero(tariffa.costo_cent) || tariffa.costo_cent < 0) return null;
  const soglia = tariffa.gratis_da_cent;
  if (intero(soglia) && soglia > 0 && intero(subtotaleCent) && subtotaleCent >= soglia) return 0;
  return tariffa.costo_cent;
}

/** I due limiti dei giorni, se **entrambi** scritti e sensati; altrimenti `null`. */
function giorni(t: TariffaRiga | null | undefined): { min: number; max: number } | null {
  if (!oggetto(t)) return null;
  const { giorni_min: min, giorni_max: max } = t;
  if (!intero(min) || !intero(max) || min < 0 || max < 1 || max > GIORNI_MAX || min > max) return null;
  return { min, max };
}

/** «Consegna in 2-4 giorni lavorativi dopo la preparazione», solo se i limiti sono **tutti e due** scritti. */
export function tempiStimati(tariffa: TariffaRiga | null | undefined): string | null {
  const g = giorni(tariffa);
  if (!g) return null;
  if (g.min === g.max) return `Consegna in ${g.max} ${g.max === 1 ? "giorno lavorativo" : "giorni lavorativi"} dopo la preparazione`;
  return `Consegna in ${g.min}-${g.max} giorni lavorativi dopo la preparazione`;
}

/** L'indirizzo di tracciamento: il modello del corriere con il numero codificato. `null` se il corriere non c'è,
 *  se il modello non è un `https://` con `{numero}` (e fuori dal nome dell'host), o se il numero non è usabile. */
export function corriereLink(corrieri: unknown, nome: unknown, numero: unknown): string | null {
  const cerca = testo(nome).toLowerCase();
  const n = testo(numero);
  if (!Array.isArray(corrieri) || !cerca || !n || n.length > 120) return null;
  const voce = corrieri.find((v) => oggetto(v) && testo(v.nome).toLowerCase() === cerca);
  const modello = oggetto(voce) ? testo(voce.modello) : "";
  if (!/^https:\/\/\S+$/i.test(modello) || !modello.includes("{numero}")) return null;
  // Il segnaposto non può stare nell'host: con `https://{numero}.sito` chi scrive il numero sceglierebbe dove si va.
  if (/[{}@]/.test(modello.slice(8).split(/[/?#]/)[0])) return null;
  const link = modello.split("{numero}").join(encodeURIComponent(n));
  try {
    return new URL(link).protocol === "https:" ? link : null;
  } catch {
    return null;
  }
}

/** La riga della tariffa attiva → il contratto per la vetrina (D62). `adesso`: ora in millisecondi o `Date` (per le prove).
 *  «Confermata» = `confermata_il` è una data già passata e la tariffa non è ancora `provvisoria`. */
export function leggiSpedizione(riga: unknown, adesso: number | Date = Date.now()): SpedizionePubblica {
  if (!oggetto(riga) || riga.attiva === false) return { stato: "assente" };
  const costo = costoSpedizione(riga, 0);
  if (costo === null) return { stato: "assente" };
  const quando = typeof riga.confermata_il === "string" ? Date.parse(riga.confermata_il) : NaN;
  const confermata = riga.provvisoria !== true && Number.isFinite(quando) && quando <= Number(adesso);
  const corriere = testo(riga.corriere) || null;
  return {
    stato: "ok",
    costoCent: costo,
    confermata,
    corriere: confermata ? corriere : null,
    tempi: confermata ? giorni(riga) : null,
    frase: confermata ? tempiStimati(riga) : null,
  };
}
