/** ── IL TELEFONO DEL MODULO DI PRENOTAZIONE ────────────────────────────────
 *
 *  Il campo ha il +39 fisso, quindi chi scrive «393 1234567» sta scrivendo il
 *  cellulare 393 1234567, non il «39» del paese seguito da «3 1234567».
 *
 *  ⚠️ Prima si toglieva «39» da qualunque numero più lungo di 10 caratteri
 *   (spazi compresi): 391, 392, 393 e 397 con uno spazio finivano «+39 3
 *   1234567», e il lead non era più richiamabile.
 *
 *  Il prefisso si toglie solo quando è davvero un prefisso:
 *   · scritto per esteso: «+39…» o «0039…» (e allora è sempre prefisso);
 *   · «39» senza più, solo se dopo restano i numeri di un cellulare completo
 *     (3 + 9 cifre = 12 cifre in tutto) o di un fisso (0… e almeno 11 cifre in
 *     tutto). Un cellulare nazionale ha 10 cifre al massimo, un fisso che
 *     comincia per 39 non esiste: sopra quelle soglie non può essere altro. */
export function numeroNazionale(raw: string): string {
  const s = raw.replace(/[^\d\s+]/g, "").trim();
  const esteso = /^(\+\s*39|00\s*39)/.exec(s);
  if (esteso) return s.slice(esteso[0].length).replace(/[^\d\s]/g, "").trim();
  const nudo = s.replace(/[^\d\s]/g, "").trim();
  const cifre = nudo.replace(/\s/g, "");
  if (cifre.startsWith("39")) {
    const resto = cifre.slice(2);
    const cellulare = resto.startsWith("3") && resto.length === 10;
    const fisso = resto.startsWith("0") && cifre.length >= 11;
    if (cellulare || fisso) return nudo.replace(/^3\s*9\s*/, "").trim();
  }
  return nudo;
}

/** Cosa si salva nel lead: `+39 ` e il numero, oppure vuoto. */
export function telefonoDaCampo(raw: string): string {
  const n = numeroNazionale(raw);
  return n ? `+39 ${n}` : "";
}
