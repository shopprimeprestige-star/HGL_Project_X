/** ── IL TELEPROMPTER CHE SEGUE CHI PARLA ────────────────────────────────────
 *
 *  La regola con cui il copione avanza mentre si legge ad alta voce. È la
 *  stessa di Meetly — copiata dalla sua, non reinventata — e sta in un modulo
 *  puro perché è fatta di casi limite che si rompono in silenzio: il copione
 *  che salta a metà pagina, o che resta fermo mentre parli.
 *
 *  ── PERCHÉ NON BASTA «CERCA LA PAROLA DETTA» ──────────────────────────────
 *  Un copione è pieno di parole che tornano dieci volte («che», «per», «il»,
 *  «capelli»). Cercandole in tutto il testo, la prima «che» detta manda il
 *  segno all'ultima riga e da lì non torna più indietro.
 *  Per questo:
 *   · si guardano solo le parole di ALMENO TRE LETTERE — le altre stanno
 *     ovunque e non dicono niente su dove sei;
 *   · si cerca solo in una FINESTRA DI CINQUE parole in avanti: si può saltare
 *     una parola saltata o storpiata, non mezza pagina;
 *   · si accetta anche un aggancio APPROSSIMATO fra parole lunghe (una comincia
 *     come l'altra), perché il riconoscimento vocale tronca e italianizza —
 *     «impianto» esce «impiant», «protocollo» esce «protocol».
 */

/** Testo confrontabile: minuscolo, senza accenti, senza punteggiatura.
 *  ⚠️ Deve restare IDENTICA a quella di Meetly (`norm` in `shop/call.tsx`): due
 *   normalizzazioni diverse vorrebbero dire lo stesso copione che avanza in un
 *   posto e si pianta nell'altro. */
export function parole(s: string): string[] {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Quanto avanti si cerca. Cinque parole: abbastanza per perdonare una parola
 *  saltata o storpiata, poco per non finire dall'altra parte del copione. */
export const FINESTRA = 5;
/** Sotto le tre lettere una parola sta ovunque. */
export const MINIMO = 3;

/** Dove sta il segno dopo aver sentito `detto`.
 *  `da` è la posizione attuale, `testo` sono le parole del copione già
 *  normalizzate. Torna sempre una posizione VALIDA e mai indietro: il
 *  teleprompter che torna su da solo è peggio di uno fermo. */
export function avanza(da: number, testo: string[], detto: string): number {
  const dette = parole(detto).filter((w) => w.length >= MINIMO);
  let p = Math.max(0, Math.min(da, testo.length));
  for (const d of dette) {
    for (let k = p; k < Math.min(p + FINESTRA, testo.length); k++) {
      const t = testo[k];
      if (!t || t.length < MINIMO) continue;
      const uguale = t === d;
      //  Approssimato solo fra parole lunghe: su parole corte «per»/«perché»
      //  aggancerebbe di continuo la cosa sbagliata.
      const simile = d.length >= 4 && t.length >= 4 && (t.startsWith(d) || d.startsWith(t));
      if (uguale || simile) { p = k + 1; break; }
    }
  }
  return Math.min(p, testo.length);
}
