/** Le sole frasi che le scansioni delle parole vietate lasciano passare su `/soluzioni`
 *  (SPEC landing v3, Decido io 8). Sono ESATTE: una variante («Non cura la caduta…», «la cura…») resta vietata.
 *  Le usano `prove/prove.mjs` (sul sorgente di `testi-sito.ts`) e `prove/sito/testi.mjs` (sulle stringhe). */
export const FRASI_AMMESSE = [
  //  La negazione che toglie una promessa: il limite vero, detto prima del bottone.
  "E non cura la caduta: la copre.",
  //  L'etichetta della scheda 03.
  "Solo da noi",
  //  Riga 5 della spiegazione.
  "Invisible Derm lo installiamo in esclusiva, qui a Roma.",
];

/** Toglie dal testo le frasi ammesse; sul resto le scansioni lavorano come prima. */
export function togliFrasiAmmesse(testo) {
  return FRASI_AMMESSE.reduce((t, f) => t.split(f).join(""), testo);
}
