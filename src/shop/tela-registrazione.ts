/** ── IL MOTORE CHE DISEGNA LA REGISTRAZIONE: UNA CATENA SOLA ───────────────
 *
 *  Segnalazione del committente: «va troppo lento lato presentatore, Chrome
 *  dice continuamente non risponde, attendi» — ovunque, e sempre peggio.
 *
 *  La causa, trovata leggendo il disegno della registrazione:
 *
 *      const frame = () => {
 *        recRaf = requestAnimationFrame(() => { frame(); … });   // ne accoda un altro
 *        … disegna …
 *      };
 *      recBattito = setInterval(disegnaEConsegna, 250);          // che chiama frame()
 *
 *  Ogni giro dell'orologio faceva partire una catena NUOVA, e ogni catena si
 *  rialimentava da sola: quattro catene in più al secondo, per sempre. Dopo un
 *  minuto di consulenza sono 240 catene che disegnano una tela 1280×720 a
 *  sessanta fotogrammi; dopo dieci minuti sono migliaia. Nessuna si fermava,
 *  perché la variabile conservava solo l'ULTIMA: anche chiudendo la
 *  registrazione ne restavano in giro tutte tranne una.
 *  Da lì tutto il resto: il thread principale occupato senza sosta, i clic che
 *  non rispondono, e alla fine la finestra di Chrome.
 *
 *  ── LE DUE COSE CHE DEVONO CONVIVERE ────────────────────────────────────
 *  1. `requestAnimationFrame` è fluido ma il browser lo SOSPENDE quando la
 *     scheda non è davanti — e il consulente passa al CRM di continuo. Senza
 *     rete di sicurezza la registrazione si ferma (è il guasto che il motore a
 *     due tempi voleva risolvere, e la ragione per cui l'orologio resta).
 *  2. L'orologio non deve MAI accodare catene: disegna e basta.
 *
 *  Qui le due cose stanno separate in modo che non possano ricascarci: chi
 *  disegna non sa niente di quando lo si richiama, e ad accodare è UNA sola
 *  riga, che prima annulla quello che c'era.
 *  ───────────────────────────────────────────────────────────────────────── */

export type Orologeria = {
  rAF: (cb: () => void) => number;
  annullaRAF: (id: number) => void;
  ogni: (cb: () => void, ms: number) => number;
  fermaOgni: (id: number) => void;
};

export type MotoreDiDisegno = {
  /** Catene di disegno vive: deve restare 1 finché gira, 0 da fermo. */
  catene: () => number;
  /** Disegni fatti finora (serve solo a misurare). */
  disegni: () => number;
  ferma: () => void;
};

/** Avvia il disegno ripetuto. `disegna` viene chiamata a ogni fotogramma —
 *  sia dal browser (fluido) sia dall'orologio (rete di sicurezza). */
export function avviaTela(
  disegna: () => void,
  o: Orologeria,
  msRete = 250,
): MotoreDiDisegno {
  let vivo = true;
  let raf = 0;
  let fatti = 0;
  let inCatena = 0;

  const unGiro = () => {
    if (!vivo) return;
    fatti++;
    disegna();
  };

  const passo = () => {
    raf = 0;
    if (!vivo) { inCatena = 0; return; }
    unGiro();
    accoda();
  };

  /*  ⚠️ L'UNICA RIGA CHE ACCODA, E PRIMA ANNULLA. Chiamarla due volte non
      raddoppia niente: è il contrario esatto di quello che faceva il codice
      di prima. */
  const accoda = () => {
    if (!vivo) return;
    if (raf) o.annullaRAF(raf);
    raf = o.rAF(passo);
    inCatena = 1;
  };

  //  ⚠️ L'orologio DISEGNA soltanto. Non accoda: se lo facesse, saremmo di
  //   nuovo al punto di partenza.
  const battito = o.ogni(unGiro, msRete);

  unGiro();
  accoda();

  return {
    catene: () => (vivo ? inCatena : 0),
    disegni: () => fatti,
    ferma: () => {
      vivo = false;
      if (raf) o.annullaRAF(raf);
      raf = 0;
      inCatena = 0;
      o.fermaOgni(battito);
    },
  };
}
