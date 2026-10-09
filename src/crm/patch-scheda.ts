/** ─────────────────────────────────────────────────────────────────────────
 *  LA MODIFICA SI COMPONE SU QUELLO CHE C'È ADESSO
 *
 *  DA DOVE NASCE
 *  `updateLead` rilegge la riga dall'archivio prima di fondere (vedi il
 *  commento in crm/CRMContext): la scheda intera non riporta più indietro il
 *  lavoro di un collega. Ma resta una variante stretta dello stesso guasto, e
 *  non la copre nessuna rilettura:
 *
 *      updateLead(l.id, { installazione: { ...l.data.installazione, priorita: true } })
 *
 *  Qui il pezzo da scrivere è GIÀ COMPOSTO quando arriva, e composto sulla
 *  copia che il browser aveva in memoria. La rilettura trova la riga fresca e
 *  ci mette sopra un `installazione` costruito su dati vecchi: il tecnico o la
 *  data che un collega ha scritto dentro quell'oggetto un minuto prima
 *  spariscono. Nessun errore, nessuna riga in console — il solito «non si
 *  salva» che torna da mesi.
 *
 *  LA CORREZIONE
 *  `updateLead` accetta anche una FUNZIONE, risolta DOPO la rilettura e con
 *  davanti la scheda vera:
 *
 *      updateLead(l.id, (attuale) => ({
 *        installazione: { ...attuale.installazione, priorita: true },
 *      }))
 *
 *  Non è una comodità: è l'unico modo di fondere dentro un sotto-oggetto
 *  senza cancellarne i fratelli. Qui dentro c'è solo la regola, senza React e
 *  senza database, perché la parte che si può sbagliare è questa e si prova.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Una modifica: l'oggetto da sovrapporre, oppure il modo di costruirlo
 *  quando si ha davanti la scheda vera. */
export type Modifica<T> = Partial<T> | ((attuale: T) => Partial<T>);

/** Il pezzo da scrivere, composto su `attuale`.
 *  ⚠️ `attuale` è la scheda APPENA RILETTA dall'archivio, non quella a
 *   schermo: se qui arrivasse la copia in memoria, la funzione non
 *   servirebbe a niente e il guasto resterebbe identico a prima. */
export function risolviModifica<T>(modifica: Modifica<T>, attuale: T): Partial<T> {
  return typeof modifica === "function" ? (modifica as (a: T) => Partial<T>)(attuale) : modifica;
}

/** ── FONDERE DENTRO UN SOTTO-OGGETTO, SENZA PERDERE I FRATELLI ────────────
 *  Il gesto che si ripete in tutte le schermate dell'installazione: prendere
 *  `installazione` (o `payment`) com'è ADESSO e cambiarci dentro due campi.
 *  Scritto una volta sola perché scriverlo undici volte vuol dire che l'undicesima
 *  è fatta sull'oggetto sbagliato — ed è esattamente com'è andata.
 *
 *  ⚠️ NON è una fusione profonda: `{...attuale[chiave], ...pezzo}` è
 *   superficiale di proposito. Andando più a fondo, togliere un campo
 *   diventerebbe impossibile (una chiave assente non cancella niente) e le
 *   schermate che svuotano un campo — «togli la data desiderata» — non
 *   funzionerebbero più. Chi deve togliere passa il campo esplicitamente. */
export function fondiSotto<T, K extends keyof T>(
  chiave: K,
  pezzo: Partial<T[K]>,
): (attuale: T) => Partial<T> {
  return (attuale: T) =>
    ({ [chiave]: { ...(attuale[chiave] as object), ...(pezzo as object) } } as unknown as Partial<T>);
}

/** Lo stesso, quando il pezzo dipende da com'è adesso il sotto-oggetto: una
 *  spunta in un elenco, una riga aggiunta a una lista. */
export function cambiaSotto<T, K extends keyof T>(
  chiave: K,
  come: (attuale: T[K]) => Partial<T[K]>,
): (attuale: T) => Partial<T> {
  return (attuale: T) =>
    ({
      [chiave]: { ...(attuale[chiave] as object), ...(come(attuale[chiave]) as object) },
    } as unknown as Partial<T>);
}
