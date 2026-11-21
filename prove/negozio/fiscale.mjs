/** ── NEGOZIO · T45 · I DATI FISCALI E DI SPEDIZIONE (PURI) ──────────────────
 *  `src/shop/cassa/fiscale.ts`: `validaCodiceFiscale`, `validaPartitaIva`, `validaSdi`, `validaPec`,
 *  `validaProvincia`, `PROVINCE_IT`, `validaCap`, `validaTelefono`, con la frase in italiano.
 *  I vettori sono INVENTATI qui, con gli algoritmi ufficiali scritti per conto loro (non copiati dal codice):
 *  nessun codice fiscale o partita IVA di una persona o di un'azienda vera. */

// ── Il codice fiscale: l'algoritmo ufficiale (DM 23/12/1976), scritto qui per generare i vettori ──
const DISPARI = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 };
const lettera = (n) => String.fromCharCode(65 + n);
const valorePari = (ch) => (/\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65);
function controlloCf(quindici) {
  let somma = 0;
  [...quindici].forEach((ch, i) => { somma += i % 2 === 0 ? DISPARI[ch] : valorePari(ch); });
  return lettera(somma % 26);
}
const cfCompleto = (quindici) => quindici + controlloCf(quindici);
/** Omocodia: le cifre di posizione 6,7,9,10,12,13,14 (0-based) diventano lettere «LMNPQRSTUV». */
const OMO = "LMNPQRSTUV";
const conOmocodia = (quindici, posizioni) => [...quindici].map((ch, i) => (posizioni.includes(i) ? OMO[Number(ch)] : ch)).join("");

// ── La partita IVA: la formula di Luhn sul numero intero, scritta al contrario (da destra) ──
function luhnValido(cifre) {
  let somma = 0;
  [...cifre].reverse().forEach((ch, i) => { let d = Number(ch); if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } somma += d; });
  return somma % 10 === 0;
}
const pivaCompleta = (dieci) => { for (let d = 0; d < 10; d++) if (luhnValido(dieci + d)) return dieci + d; throw new Error("impossibile"); };

export async function prove(mod, { c, gruppo }) {
  gruppo("NEGOZIO · DATI FISCALI E DI SPEDIZIONE (21/11/2026, T45)");
  const F = mod["shop/cassa/fiscale"];
  if (!F) return c("il modulo src/shop/cassa/fiscale.ts esiste", true, false);
  const ok = (r) => r.ok === true;
  const frase = (r) => (r.ok ? null : r.frase);
  const italiana = (f) => typeof f === "string" && f.length >= 12 && /[a-zàèéìòù]{3}/.test(f) && !/[{}]|undefined|\[object/.test(f);

  // ── codice fiscale ──
  const BASI = ["XYZABC85C12Z404", "QWRTPS70A41Z110", "BCDFGH01E25Z330", "LMNPQR99T71Z999", "ZZZZZZ55M31Z404"];
  c("i vettori della prova sono lunghi 15 prima del controllo", [15, 15, 15, 15, 15], BASI.map((b) => b.length));
  const validi = BASI.map(cfCompleto);
  c("CF inventato con il controllo giusto → accettato (5 vettori)", Array(5).fill(true), validi.map((cf) => ok(F.validaCodiceFiscale(cf))));
  c("…e il valore restituito è maiuscolo, senza spazi", validi, validi.map((cf) => F.validaCodiceFiscale(cf).valore));
  c("minuscolo, con spazi ai bordi e in mezzo → accettato e normalizzato", validi[0], F.validaCodiceFiscale(`  ${validi[0].toLowerCase().slice(0, 6)} ${validi[0].toLowerCase().slice(6)} `).valore);
  const sbagliati = [];
  for (const cf of validi) for (let n = 0; n < 26; n++) if (lettera(n) !== cf[15]) sbagliati.push(cf.slice(0, 15) + lettera(n));
  c("formato giusto ma controllo sbagliato → rifiutato, qualunque altra lettera (125 casi)", [], sbagliati.filter((cf) => ok(F.validaCodiceFiscale(cf))));
  c("…con la frase in italiano", true, italiana(frase(F.validaCodiceFiscale(sbagliati[0]))));
  const omo = conOmocodia(BASI[0], [14]) + "?";
  const omoValidi = [[14], [12, 14], [6, 7, 9, 10, 12, 13, 14]].map((p) => cfCompleto(conOmocodia(BASI[0], p)));
  c("omocodia (cifre sostituite da lettere, controllo ricalcolato) → accettata", Array(3).fill(true), omoValidi.map((cf) => ok(F.validaCodiceFiscale(cf))));
  c("omocodia con controllo sbagliato → rifiutata", false, ok(F.validaCodiceFiscale(omoValidi[1].slice(0, 15) + (omoValidi[1][15] === "A" ? "B" : "A"))));
  const storti = ["", "   ", "XYZABC85C12Z404", validi[0] + "X", validi[0].slice(1), "12345678901234 6", "XYZABC85C12Z40$" + validi[0][15], "XYZABC85X12Z404" + controlloCf("XYZABC85X12Z404"), "XYZABC85C00Z404" + controlloCf("XYZABC85C00Z404"), "XYZABC85C32Z404" + controlloCf("XYZABC85C32Z404"), "XYZABC85C72Z404" + controlloCf("XYZABC85C72Z404"), "1YZABC85C12Z404" + controlloCf("1YZABC85C12Z404"), null, undefined, 12, {}];
  c("formato sbagliato (vuoto, 15 o 17 caratteri, simboli, mese o giorno impossibili, cifra al posto di una lettera, non testo) → rifiutato", [], storti.filter((x) => ok(F.validaCodiceFiscale(x))));
  c("giorno 41 e 71 (le donne) → accettati", [true, true], [BASI[1], BASI[3]].map((b) => ok(F.validaCodiceFiscale(cfCompleto(b)))));
  c("il CF numerico di 11 cifre di un'azienda (con controllo giusto) → accettato", true, ok(F.validaCodiceFiscale(pivaCompleta("1234567890"))));
  c("…con il controllo sbagliato → rifiutato", false, ok(F.validaCodiceFiscale(pivaCompleta("1234567890").slice(0, 10) + "0".replace("0", String((Number(pivaCompleta("1234567890")[10]) + 1) % 10)))));
  c("le frasi non fanno uscire il valore scritto dal cliente", false, (frase(F.validaCodiceFiscale("SEGRETO-1234567X")) || "").includes("SEGRETO"));

  // ── partita IVA ──
  const PIVE = ["1234567890", "9876543210", "0123456789", "5555555555", "2468013579"].map(pivaCompleta);
  c("le partite IVA della prova hanno 11 cifre e passano la formula di Luhn", Array(5).fill(true), PIVE.map((p) => p.length === 11 && luhnValido(p)));
  c("P.IVA inventata con il controllo giusto → accettata", Array(5).fill(true), PIVE.map((p) => ok(F.validaPartitaIva(p))));
  c("…e il valore restituito sono le 11 cifre", PIVE, PIVE.map((p) => F.validaPartitaIva(p).valore));
  c("con prefisso «IT», spazi e minuscole → accettata, tornano le sole 11 cifre", PIVE[0], F.validaPartitaIva(` it ${PIVE[0].slice(0, 4)} ${PIVE[0].slice(4)} `).valore);
  const pivaSbagliate = [];
  for (const p of PIVE) for (let d = 0; d < 10; d++) if (String(d) !== p[10]) pivaSbagliate.push(p.slice(0, 10) + d);
  c("controllo sbagliato → rifiutata, qualunque altra cifra (45 casi)", [], pivaSbagliate.filter((p) => ok(F.validaPartitaIva(p))));
  c("…con la frase in italiano", true, italiana(frase(F.validaPartitaIva(pivaSbagliate[0]))));
  c("10 o 12 cifre, lettere, vuoto, non testo, 7 zeri iniziali → rifiutata", [], ["123456789", PIVE[0] + "1", "1234567890A", "", "   ", null, undefined, 12345678901, pivaCompleta("0000000000").replace(/^0{7}/, "0000000")].filter((x) => ok(F.validaPartitaIva(x))));

  // ── SDI ──
  c("codice destinatario di 7 caratteri → accettato, in maiuscolo", ["M5UXCR1", "0000000", "ABC1234"], ["m5uxcr1", "0000000", " ABC1234 "].map((s) => F.validaSdi(s).valore));
  c("di 6 o 8 caratteri, con simboli, vuoto, non testo → rifiutato", [], ["ABC123", "ABC12345", "ABC-123", "ABC 123", "", null, 1234567].filter((s) => ok(F.validaSdi(s))));
  c("…con la frase in italiano", true, italiana(frase(F.validaSdi("ABC123"))));

  // ── PEC ──
  c("PEC giusta → accettata, in minuscolo e senza spazi ai bordi", "azienda.prova@pec.esempio.test", F.validaPec("  Azienda.Prova@PEC.Esempio.test ").valore);
  c("senza @, senza dominio, con spazi dentro, due @, vuota, non testo → rifiutata", [], ["azienda.pec.esempio.test", "azienda@", "@pec.test", "azienda@pec", "azie nda@pec.test", "a@b@pec.test", "", null, 5].filter((s) => ok(F.validaPec(s))));
  c("oltre 254 caratteri → rifiutata", false, ok(F.validaPec("a".repeat(250) + "@pec.test")));
  c("…con la frase in italiano", true, italiana(frase(F.validaPec("senza chiocciola"))));

  // ── provincia ──
  c("RM sì, rm → RM, « mi » → MI", ["RM", "RM", "MI"], ["RM", "rm", " mi "].map((p) => F.validaProvincia(p).valore));
  c("XX no, vuota, di 1 o 3 lettere, con cifre, non testo → rifiutata", [], ["XX", "", "R", "ROM", "R1", null, 5].filter((p) => ok(F.validaProvincia(p))));
  c("…con la frase in italiano", true, italiana(frase(F.validaProvincia("XX"))));
  c("PROVINCE_IT: tutte di due lettere maiuscole, senza doppioni, ci sono RM MI NA TO BZ AO", [true, true], [[...F.PROVINCE_IT].every((p) => /^[A-Z]{2}$/.test(p)) && new Set(F.PROVINCE_IT).size === F.PROVINCE_IT.length, ["RM", "MI", "NA", "TO", "BZ", "AO"].every((p) => F.PROVINCE_IT.includes(p))]);
  c("PROVINCE_IT: da 100 a 115 sigle (107 + le sarde storiche)", true, F.PROVINCE_IT.length >= 100 && F.PROVINCE_IT.length <= 115);

  // ── CAP ──
  c("00100 e 20121 → sì (restano come scritti)", ["00100", "20121"], ["00100", " 20121 "].map((x) => F.validaCap(x).valore));
  c("0123, 001000, 0010A, vuoto, con spazio dentro, non testo → no", [], ["0123", "001000", "0010A", "", "00 100", null, 100].filter((x) => ok(F.validaCap(x))));
  c("…con la frase in italiano", true, italiana(frase(F.validaCap("0123"))));

  // ── telefono ──
  c("339 123 4567 → sì, normalizzato senza spazi", "3391234567", F.validaTelefono("339 123 4567").valore);
  c("+39 339 123 4567 → sì, con il +", "+393391234567", F.validaTelefono("+39 339 123 4567").valore);
  c("0039 339…, con trattini, punti o parentesi → sì", ["+393391234567", "3391234567", "0612345678"], ["0039 339 1234567", "339-123.4567", "(06) 1234 5678"].map((x) => F.validaTelefono(x).valore));
  c("12, vuoto, lettere, + nel mezzo, 16 cifre, non testo → no", [], ["12", "", "   ", "abc defg hij", "339+1234567", "+3933912345678901", null, 3391234567].filter((x) => ok(F.validaTelefono(x))));
  c("…con la frase in italiano", true, italiana(frase(F.validaTelefono("12"))));

  // ── le frasi: tutte diverse fra campi, nessuna con il dato dentro ──
  const f = [F.validaCodiceFiscale("x"), F.validaPartitaIva("x"), F.validaSdi("x"), F.validaPec("x"), F.validaProvincia("x"), F.validaCap("x"), F.validaTelefono("x")].map(frase);
  c("sette campi, sette frasi diverse e in italiano", [7, true], [new Set(f).size, f.every(italiana)]);
  c("un esito riuscito non ha la chiave «frase», uno fallito non ha «valore»", [true, true], [!("frase" in F.validaCap("00100")), !("valore" in F.validaCap("1"))]);
}
