/** ── «SOLO BLOCCO ORARIO»: UN MEET CHE OCCUPA LO SLOT MA NON È UNA CONSULENZA ──
 *  Richiesta del titolare (17/11/2026): il consulente, fissando un meet, può
 *  spuntare «Solo blocco orario — non conta nelle statistiche». Il lead resta
 *  nell'agenda a quell'ora (lo slot è occupato, il promemoria e il «prossimo
 *  meet» lo vedono) ma non deve muovere nessun numero: il titolare lo usa per
 *  bloccare l'orario di un impegno, non per una persona che comprerà.
 *
 *  ── UNA FUNZIONE SOLA ────────────────────────────────────────────────────
 *  `contaNeiKpi(lead)` è l'UNICA domanda che i calcoli dei KPI fanno. Niente
 *  `if (l.data.soloBlocco)` sparsi: se un calcolo la salta, una pagina conta
 *  il blocco e un'altra no, e i numeri tornano a contraddirsi. Tutti i calcoli
 *  passano da `soloNeiKpi(elenco)` all'ingresso, prima di qualunque conteggio.
 *  Un blocco esce INTERO dai numeri — lead, appuntamenti, consulenze, clienti,
 *  show-rate, classifiche — né al numeratore né al denominatore.
 *
 *  ── COSA NON FA ──────────────────────────────────────────────────────────
 *  Non tocca l'agenda: `booking-utils`, `doppione-orario`, `prossimo-meet` non
 *  importano questo file, e questa è la garanzia che lo slot resta occupato.
 *  Non tocca i dati: il campo vive in `lead.data` (JSON), niente migrazioni, e
 *  i lead di prima non lo hanno, quindi continuano a contare come oggi. */

/** Qualunque cosa abbia un `data` come i lead; ammette anche `null`/mancante
 *  perché l'archivio importato a volte porta righe senza `data`. */
export interface ConSoloBlocco {
  data?: { soloBlocco?: unknown } | null;
}

/** Vero se il lead è un semplice blocco dell'orario. Solo `true` vale: una
 *  stringa o un numero capitati per un import non spengono un lead vero. */
export function eSoloBlocco(lead: ConSoloBlocco | null | undefined): boolean {
  return lead?.data?.soloBlocco === true;
}

/** LA domanda dei KPI: questo lead entra nei numeri? */
export function contaNeiKpi(lead: ConSoloBlocco | null | undefined): boolean {
  return !eSoloBlocco(lead);
}

/** L'elenco da dare ai calcoli: senza i blocchi. Se non ce ne sono restituisce
 *  la STESSA lista (nessuna copia: il filtro costa un giro e basta, e un
 *  `useMemo` a monte non vede cambiare l'identità per niente). */
export function soloNeiKpi<T extends ConSoloBlocco>(elenco: readonly T[] | null | undefined): T[] {
  if (!Array.isArray(elenco)) return [];
  return elenco.some((l) => !contaNeiKpi(l)) ? elenco.filter(contaNeiKpi) : (elenco as T[]);
}

/** Cosa scrivere sulla scheda quando si accende o si spegne la spunta.
 *  Spenta = le chiavi spariscono (valore `undefined`: il salvataggio le
 *  toglie), così la scheda torna identica a una mai spuntata. */
export function patchSoloBlocco(
  acceso: boolean,
  chi?: string | null,
  adesso: Date = new Date(),
  /** La spunta era già accesa sulla scheda: spostare il blocco non cambia
   *  quando né da chi è stato messo, quindi non si riscrive niente. */
  giaAcceso = false,
): { soloBlocco?: true; soloBloccoIl?: string; soloBloccoDa?: string } {
  if (acceso && giaAcceso) return {};
  if (!acceso) return { soloBlocco: undefined, soloBloccoIl: undefined, soloBloccoDa: undefined };
  const nome = String(chi ?? "").trim();
  return {
    soloBlocco: true,
    soloBloccoIl: adesso.toISOString(),
    soloBloccoDa: nome || undefined,
  };
}

/** Il testo della spunta e dell'etichetta: uno solo, usato da tutte le schermate. */
export const TESTO_SOLO_BLOCCO = "Solo blocco orario — non conta nelle statistiche";
export const ETICHETTA_BLOCCO = "Blocco";
