/** ── IL FILE MODELLO DEI PRODOTTI (EDITOR PRODOTTI · E2b) ───────────────────
 *  SPEC §6.7. Si scarica dal passo 1 dell'importazione: intestazione completa (le stesse colonne di `csv-colonne.ts`, una sola fonte)
 *  e due prodotti d'esempio INVENTATI: uno semplice e uno con 2 opzioni e 4 varianti. Nessun dato di clienti o fornitori.
 *  La prova controlla che il modello passi l'anteprima così com'è: «2 prodotti · 5 varianti · 0 errori». */
import { COLONNE, type ChiaveColonna } from "./csv-colonne";
import { scriviCsv } from "./csv-errori";

export const NOME_FILE_MODELLO = "modello-prodotti.csv";

const IN_MODELLO = COLONNE.filter((c) => c.nelModello);

/** Una riga del modello: le colonne che non nomino restano vuote. */
const riga = (v: Partial<Record<ChiaveColonna, string>>): string[] => IN_MODELLO.map((c) => v[c.chiave] ?? "");

/** Il testo del file: separatore virgola, UTF-8 con il segno iniziale di Excel. */
export function costruisciModello(): string {
  const semplice = riga({
    handle: "shampoo-delicato-esempio",
    titolo: "Shampoo delicato (esempio)",
    corpo: "<p>Uno shampoo di esempio per il file modello.</p><p>Cancella queste righe e scrivi i tuoi prodotti.</p>",
    breve: "Shampoo di esempio, da sostituire con un tuo prodotto.",
    marca: "Marca Esempio",
    tipo: "cura",
    seoTitolo: "Shampoo delicato",
    sku: "ESEMPIO-SHAMPOO",
    prezzo: "14,90",
    giacenza: "10",
    grammi: "250",
    barcode: "8000000000017",
    costo: "6,50",
  });
  const conOpzioni = (valore1: string, valore2: string, sku: string, prezzo: string, giacenza: string, primo = false) =>
    riga({
      handle: "parrucca-esempio",
      ...(primo ? { titolo: "Parrucca di esempio", corpo: "<p>Un prodotto con due opzioni: colore e lunghezza.</p>", breve: "Parrucca di esempio, da sostituire.", marca: "Marca Esempio", tipo: "patch", opt1Nome: "Colore", opt2Nome: "Lunghezza" } : {}),
      opt1Valore: valore1,
      opt2Valore: valore2,
      sku,
      prezzo,
      giacenza,
      grammi: "120",
    });
  return scriviCsv(
    [
      IN_MODELLO.map((c) => c.intestazione),
      semplice,
      conOpzioni("Nero", "20 cm", "ESEMPIO-PA-NE-20", "199,00", "3", true),
      conOpzioni("Nero", "30 cm", "ESEMPIO-PA-NE-30", "229,00", "2"),
      conOpzioni("Castano", "20 cm", "ESEMPIO-PA-CA-20", "199,00", "0"),
      conOpzioni("Castano", "30 cm", "ESEMPIO-PA-CA-30", "229,00", "1"),
    ],
    ",",
    false,
  );
}
