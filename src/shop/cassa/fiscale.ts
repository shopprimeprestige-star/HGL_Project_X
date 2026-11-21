/** ── DATI FISCALI E DI SPEDIZIONE: CONTROLLI DI FORMATO ────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T45 (SPEC §7.4 n. 6). Modulo PURO, usato dalla cassa (T48) e dal server.
 *  Controllano solo la FORMA e le cifre di controllo (algoritmi ufficiali): non dicono se la persona o l'azienda
 *  esistono. Ogni funzione restituisce il valore normalizzato oppure la frase da mostrare accanto al campo.
 *  La frase non ripete mai quanto scritto dal cliente (un codice fiscale non va a finire in un messaggio o in un log). */

export type Esito = { ok: true; valore: string } | { ok: false; frase: string };

const si = (valore: string): Esito => ({ ok: true, valore });
const no = (frase: string): Esito => ({ ok: false, frase });
const pulito = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
const senzaSpazi = (x: unknown): string => pulito(x).replace(/\s+/g, "");

/** Partita IVA: 11 cifre, ultima di controllo (formula di Luhn: da destra, raddoppia una cifra su due). I primi sette zeri non esistono. */
function cifreIvaOk(s: string): boolean {
  if (!/^\d{11}$/.test(s) || /^0{7}/.test(s)) return false;
  let somma = 0;
  for (let i = 0; i < 11; i++) {
    let d = Number(s[10 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    somma += d;
  }
  return somma % 10 === 0;
}

/** Codice fiscale: tabelle di conversione del DM 23/12/1976 per le posizioni dispari (1ª, 3ª…) e pari. */
const DISPARI: Record<string, number> = {
  "0": 1,
  "1": 0,
  "2": 5,
  "3": 7,
  "4": 9,
  "5": 13,
  "6": 15,
  "7": 17,
  "8": 19,
  "9": 21,
  A: 1,
  B: 0,
  C: 5,
  D: 7,
  E: 9,
  F: 13,
  G: 15,
  H: 17,
  I: 19,
  J: 21,
  K: 2,
  L: 4,
  M: 18,
  N: 20,
  O: 11,
  P: 3,
  Q: 6,
  R: 8,
  S: 12,
  T: 14,
  U: 16,
  V: 10,
  W: 22,
  X: 25,
  Y: 24,
  Z: 23,
};
const valorePari = (ch: string): number =>
  ch >= "0" && ch <= "9" ? Number(ch) : ch.charCodeAt(0) - 65;
/** Le cifre di anno, giorno e comune possono essere lettere (omocodia): `L M N P Q R S T U V` = `0…9`. */
const DA_OMOCODIA = "LMNPQRSTUV";
const cifraDi = (ch: string): number =>
  ch >= "0" && ch <= "9" ? Number(ch) : DA_OMOCODIA.indexOf(ch);

function cfPersonaOk(s: string): boolean {
  if (
    !/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(
      s,
    )
  )
    return false;
  const giorno = cifraDi(s[9]) * 10 + cifraDi(s[10]);
  if (!((giorno >= 1 && giorno <= 31) || (giorno >= 41 && giorno <= 71))) return false; // +40 per le donne
  let somma = 0;
  for (let i = 0; i < 15; i++) somma += i % 2 === 0 ? DISPARI[s[i]] : valorePari(s[i]);
  return String.fromCharCode(65 + (somma % 26)) === s[15];
}

/** Codice fiscale: 16 caratteri di persona (anche con omocodia) oppure 11 cifre di azienda. Restituisce maiuscolo, senza spazi. */
export function validaCodiceFiscale(x: unknown): Esito {
  const s = senzaSpazi(x).toUpperCase();
  return cfPersonaOk(s) || cifreIvaOk(s)
    ? si(s)
    : no(
        "Il codice fiscale non sembra giusto: sono 16 tra lettere e numeri (11 numeri per un'azienda). Controllalo.",
      );
}

/** Partita IVA: 11 cifre con la cifra di controllo giusta; il prefisso «IT» si accetta e si toglie. */
export function validaPartitaIva(x: unknown): Esito {
  const s = senzaSpazi(x).toUpperCase().replace(/^IT/, "");
  return cifreIvaOk(s)
    ? si(s)
    : no("La partita IVA non sembra giusta: sono 11 numeri. Controllala.");
}

/** Codice destinatario SDI: 7 lettere o numeri («0000000» per chi riceve la fattura sulla PEC). */
export function validaSdi(x: unknown): Esito {
  const s = senzaSpazi(x).toUpperCase();
  return /^[A-Z0-9]{7}$/.test(s)
    ? si(s)
    : no(
        "Il codice destinatario è di 7 lettere o numeri. Controllalo, oppure lascia il campo vuoto e scrivi la PEC.",
      );
}

/** PEC: una casella di posta scritta bene (`nome@dominio.it`). Non si controlla che sia davvero certificata. */
export function validaPec(x: unknown): Esito {
  const s = pulito(x).toLowerCase();
  return s.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(s)
    ? si(s)
    : no("La PEC non sembra un indirizzo giusto: manca qualcosa prima o dopo la @.");
}

/** Le sigle delle province italiane (107) più le quattro sarde soppresse nel 2016 che molti indirizzi usano ancora.
 *  shortcut: elenco fisso scritto a mano, da rivedere se l'ISTAT cambia le province (Sardegna 2025). */
export const PROVINCE_IT: readonly string[] = [
  "AG",
  "AL",
  "AN",
  "AO",
  "AP",
  "AQ",
  "AR",
  "AT",
  "AV",
  "BA",
  "BG",
  "BI",
  "BL",
  "BN",
  "BO",
  "BR",
  "BS",
  "BT",
  "BZ",
  "CA",
  "CB",
  "CE",
  "CH",
  "CL",
  "CN",
  "CO",
  "CR",
  "CS",
  "CT",
  "CZ",
  "EN",
  "FC",
  "FE",
  "FG",
  "FI",
  "FM",
  "FR",
  "GE",
  "GO",
  "GR",
  "IM",
  "IS",
  "KR",
  "LC",
  "LE",
  "LI",
  "LO",
  "LT",
  "LU",
  "MB",
  "MC",
  "ME",
  "MI",
  "MN",
  "MO",
  "MS",
  "MT",
  "NA",
  "NO",
  "NU",
  "OR",
  "PA",
  "PC",
  "PD",
  "PE",
  "PG",
  "PI",
  "PN",
  "PO",
  "PR",
  "PT",
  "PU",
  "PV",
  "PZ",
  "RA",
  "RC",
  "RE",
  "RG",
  "RI",
  "RM",
  "RN",
  "RO",
  "SA",
  "SI",
  "SO",
  "SP",
  "SR",
  "SS",
  "SU",
  "TA",
  "TE",
  "TN",
  "TO",
  "TP",
  "TR",
  "TS",
  "TV",
  "UD",
  "VA",
  "VB",
  "VC",
  "VE",
  "VI",
  "VR",
  "VT",
  "VV",
  // sarde storiche (soppresse nel 2016)
  "CI",
  "OG",
  "OT",
  "VS",
];

/** Provincia: la sigla di due lettere, in maiuscolo. */
export function validaProvincia(x: unknown): Esito {
  const s = pulito(x).toUpperCase();
  return PROVINCE_IT.includes(s)
    ? si(s)
    : no("Scrivi la sigla della provincia, di due lettere (per esempio RM).");
}

/** CAP: cinque cifre. */
export function validaCap(x: unknown): Esito {
  const s = pulito(x);
  return /^\d{5}$/.test(s) ? si(s) : no("Il CAP è di 5 numeri (per esempio 00100).");
}

/** Telefono: da 8 a 15 cifre, con un «+» o «00» iniziale per l'estero; spazi, punti, trattini e parentesi si tolgono.
 *  Restituisce solo cifre (e il «+» iniziale). */
export function validaTelefono(x: unknown): Esito {
  const grezzo = pulito(x);
  if (!/^\+?[\d\s.\-()]+$/.test(grezzo) || grezzo.lastIndexOf("+") > 0)
    return no(
      "Scrivi il numero di telefono con soli numeri, anche con il prefisso (per esempio +39 339 123 4567).",
    );
  const s = grezzo.replace(/[\s.\-()]/g, "").replace(/^00/, "+");
  return /^\+?\d{8,15}$/.test(s)
    ? si(s)
    : no(
        "Il numero di telefono non sembra completo: scrivilo con soli numeri, anche con il prefisso (per esempio +39 339 123 4567).",
      );
}
