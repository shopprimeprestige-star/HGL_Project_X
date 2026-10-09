/** ── GLI IMPORTI SCRITTI A MANO ────────────────────────────────────────────
 *  Due funzioni sole, e un file tutto loro. Stavano dentro
 *  InstallationScheduleDialog, che è dove servivano per primo, e sono uscite
 *  quando la finestra dei costi ha avuto bisogno di leggere gli importi ALLO
 *  STESSO MODO: quel file importa la finestra, la finestra avrebbe importato
 *  quel file, e due moduli che si importano a vicenda non danno un errore di
 *  compilazione — danno un componente `undefined` al montaggio, cioè una
 *  schermata bianca.
 *  ⚠️ Chi ha bisogno di leggere un importo scritto a mano importa DA QUI. Una
 *   seconda lettura scritta altrove è il modo di avere «1.200» che vale
 *   milleduecento in una schermata e uno virgola due in quella accanto.
 *  ───────────────────────────────────────────────────────────────────────── */

/** ── I SOLDI SI SCRIVONO COME SI DICONO ───────────────────────────────────
 *  Un campo `type="number"` sembra la scelta ovvia e in italiano è sbagliata:
 *  rifiuta la virgola (450,73 non si può nemmeno digitare), sul telefono apre
 *  una tastiera senza virgola e con la rotellina del mouse cambia il valore
 *  mentre si scorre la pagina. Qui il campo è di testo e la lettura la fa
 *  questa funzione, che accetta tutti i modi in cui una cifra viene scritta
 *  davvero: "1.200,50", "1200,5", "€ 450", "450.73".
 *  Una cifra illeggibile vale 0, mai NaN: NaN scritto in cassa è un buco. */
export function leggiEuro(testo: string): number {
  const pulito = String(testo ?? "").replace(/[^\d,.-]/g, "");
  if (!pulito) return 0;
  let normale: string;
  if (pulito.includes(",")) {
    //  Con la virgola il punto può essere solo il separatore delle migliaia.
    normale = pulito.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(pulito)) {
    //  "1.200" senza decimali è milleduecento, non uno virgola due: senza
    //  questo controllo Number() lo leggerebbe come 1.2 e in cassa finirebbe
    //  un euro invece di milleduecento.
    normale = pulito.replace(/\./g, "");
  } else {
    normale = pulito;
  }
  const n = Number(normale);
  return Number.isFinite(n) ? n : 0;
}

/** La cifra come va messa DENTRO il campo: niente simbolo, virgola decimale
 *  solo se serve davvero. */
export function scriviEuro(n: number): string {
  return (Number(n) || 0).toLocaleString("it-IT", { maximumFractionDigits: 2 });
}
