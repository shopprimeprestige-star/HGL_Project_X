/** ── T100a · IL CARRELLO DI OGGI (`codice`): LE CIFRE CHE IL CLIENTE VEDE ─────────────────────────────────────────────────────
 *  `CartPage` di `src/routes/shop.carrello.tsx` è il carrello del sito di oggi. Ha perso il ramo `cms` morto (T100a); la regola 9 di `vetrina-regole` ne fissa il testo
 *  (impronta), questa prova ne fissa il COMPORTAMENTO sulle cifre, che l'oro non vede (il suo carrello vale 337 €: spedizione sempre 0):
 *   · sotto i 59 €: spedizione 4,90 € e totale = subtotale + 4,90 €; la nota «Aggiungi … per la spedizione gratuita» dice quanto manca;
 *   · a 59 € esatti e oltre: spedizione «Gratuita», totale = subtotale, nessuna nota;
 *   · appena sotto (58,90): ancora 4,90 €.
 *  `rendi` disegna la rotta vera con i finti del router, del carrello e della rivalida. Una prova non lancia MAI: un'eccezione è un rosso con il suo nome. */
import { rendi } from "./_rende.mjs";

const FILE = "src/routes/shop.carrello.tsx";
const RIVALIDA = { stato: "ok", avviso: null, controlla: async () => ({ stato: "non_verificabile" }) };
const carrello = (subtotal) => ({ lines: [{ productId: "t01", qty: 1, key: "t01" }], subtotal, count: 1, setQty() {}, remove() {}, clear() {}, replaceLines() {}, add() {} });
const sp = (t) => t?.replace(/\s/g, " ");
const cifre = (h) => ({
  spedizione: sp(/Spedizione<\/span><span[^>]*>([^<]*)</.exec(h)?.[1]),
  totale: sp(/<span>Totale<\/span><span>([^<]*)</.exec(h)?.[1]),
  nota: /per la spedizione gratuita/.test(h),
});
const vedi = async (radice, subtotale) => {
  try {
    const r = await rendi(radice, FILE, { server: {}, loaderData: { modo: "codice" }, carrello: carrello(subtotale), rivalida: RIVALIDA });
    return cifre(r.html);
  } catch (e) {
    return { errore: String(e?.message ?? e) };
  }
};

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("T100a · IL CARRELLO DI OGGI (`codice`): SPEDIZIONE E TOTALE MOSTRATI");
  const DATI = [
    ["sotto i 59 € (30)", 30, "4,90 €", "34,90 €", true],
    ["appena sotto (58,90)", 58.9, "4,90 €", "63,80 €", true],
    ["59 € esatti", 59, "Gratuita", "59,00 €", false],
    ["sopra i 59 € (86,70)", 86.7, "Gratuita", "86,70 €", false],
    ["molto sopra (337)", 337, "Gratuita", "337,00 €", false],
  ];
  for (const [nome, sub, spedizione, totale, nota] of DATI) {
    const v = await vedi(radice, sub);
    c(`carrello di oggi, ${nome}: spedizione, TOTALE (subtotale + spedizione) e nota «per la spedizione gratuita»`, { spedizione, totale, nota }, v);
  }
  void mod;
}
