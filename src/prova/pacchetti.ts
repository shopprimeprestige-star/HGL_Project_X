/** ── I PACCHETTI DI PROVE ──────────────────────────────────────────────────
 *
 *  Finite le tre comprese, se ne comprano altre. Tre pacchetti, non sette: una
 *  scelta fra tre si fa in due secondi, una fra sette la si rimanda.
 *
 *  ── ⚠️ IL PREZZO PER PROVA CALA, E SI VEDE ───────────────────────────────
 *  59, 40 e 30 centesimi a prova. Non è una gentilezza: è l'unica ragione per
 *  cui qualcuno prende il pacchetto grande invece del piccolo, e va SCRITTA
 *  accanto al prezzo — «30 centesimi a prova» convince, «14,90 €» spaventa.
 *  Il risparmio in percentuale sta accanto ai due più grandi perché è vero e
 *  perché è la seconda cosa che si guarda.
 *
 *  ── ⚠️ E IL MEZZO SI DICHIARA IN CENTESIMI ───────────────────────────────
 *  Gli importi qui dentro sono INTERI in centesimi, mai `5.90`. Un prezzo in
 *  virgola mobile prima o poi diventa 5.899999999 e finisce in una ricevuta:
 *  è successo a chiunque abbia scritto un carrello in fretta.
 */

export interface Pacchetto {
  chiave: string;
  /** quante generazioni aggiunge al codice */
  prove: number;
  /** in centesimi: 590 = 5,90 € */
  centesimi: number;
  nome: string;
  /** la riga che convince, scritta per chi sta decidendo adesso */
  gancio: string;
  /** il più venduto: uno solo, e si vede */
  consigliato?: boolean;
}

export const PACCHETTI: Pacchetto[] = [
  {
    chiave: "p10",
    prove: 10,
    centesimi: 590,
    nome: "10 prove",
    gancio: "Per decidere con calma fra due o tre tagli.",
  },
  {
    chiave: "p25",
    prove: 25,
    centesimi: 990,
    //  ⚠️ Il consigliato è quello di mezzo, ed è il più venduto in qualunque
    //   listino a tre: chi non sa scegliere prende quello in mezzo. Metterlo
    //   sul piccolo vuol dire regalare margine, sul grande vuol dire non
    //   essere creduti.
    consigliato: true,
    nome: "25 prove",
    gancio: "Il più scelto: provi tutti i tagli che ti interessano davvero.",
  },
  {
    chiave: "p50",
    prove: 50,
    centesimi: 1490,
    nome: "50 prove",
    gancio: "Per provare tutto, anche i colori, senza contare.",
  },
];

export const pacchettoDa = (c: string): Pacchetto | undefined =>
  PACCHETTI.find((p) => p.chiave === c);

/** «5,90 €» — con la virgola, come si scrive in italiano. */
export function inEuro(centesimi: number): string {
  const n = Math.max(0, Math.round(Number(centesimi) || 0));
  return `${Math.floor(n / 100)},${String(n % 100).padStart(2, "0")} €`;
}

/** Quanto viene una prova sola: è la riga che fa scegliere il pacchetto
 *  grande. Arrotondata al centesimo, e sempre per difetto per non promettere
 *  un prezzo più basso di quello vero. */
export function alPezzo(p: Pacchetto): string {
  const c = Math.floor(p.centesimi / p.prove);
  return `${c} centesimi a prova`;
}

/** Quanto si risparmia rispetto al pacchetto più piccolo, in percentuale
 *  intera. Zero sul più piccolo: lì non c'è niente da vantare, e scrivere
 *  «risparmi 0%» è peggio che non scrivere niente. */
export function risparmio(p: Pacchetto): number {
  const base = PACCHETTI[0];
  if (p.chiave === base.chiave) return 0;
  const pieno = (base.centesimi / base.prove) * p.prove;
  return Math.max(0, Math.round(((pieno - p.centesimi) / pieno) * 100));
}
