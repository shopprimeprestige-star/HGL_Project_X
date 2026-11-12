/** ── DATI INVENTATI PER LE PROVE DEL BULK ──────────────────────────────────
 *  ⚠️ Nomi di fantasia, numeri e codici finti. Il codice fiscale di prova ha il
 *   carattere di controllo giusto, calcolato qui (copia di `cfConControllo` in
 *   prove/dati-fattura.mjs): è un dato che passa i controlli senza essere di
 *   nessuno. Mai nomi, CF o indirizzi veri, in nessuna prova di questa cartella. */
const ALF = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DISP = [1,0,5,7,9,13,15,17,19,21,1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23];

/** I primi 15 caratteri più il carattere di controllo giusto. */
export function cfConControllo(quindici) {
  let s = 0;
  for (let i = 0; i < 15; i++) {
    const k = ALF.indexOf(quindici[i]);
    s += i % 2 === 0 ? DISP[k] : k < 10 ? k : k - 10;
  }
  return quindici + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[s % 26];
}

/** Un CF di fantasia valido (stesso di prove/dati-fattura.mjs). */
export const CF_PROVA = cfConControllo("RSSMRA80A01H501");

/** Un CF con il carattere di controllo SBAGLIATO (cambia l'ultima lettera). */
export const CF_STORTO = CF_PROVA.slice(0, 15) + (CF_PROVA[15] === "A" ? "B" : "A");

/** Un lotto di prova (la forma è quella di `lottoValido`). */
export const LOTTO_PROVA = "lotto-0123abcd";
