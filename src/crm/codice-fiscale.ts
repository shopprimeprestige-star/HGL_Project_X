/** ── COSA DICE DAVVERO UN CODICE FISCALE ───────────────────────────────────
 *
 *  ⚠️ PRIMA DI TUTTO, QUELLO CHE NON PUÒ DIRE: il nome e il cognome non si
 *   ricavano. Il codice ne porta solo le consonanti spremute in tre lettere —
 *   «RSS» sta per Rossi, ma anche per Russo, Rossi, Rasso, Ruoss — e da tre
 *   consonanti non si torna indietro a una parola. Un programma che
 *   «ricostruisce» il nome da un codice fiscale sta tirando a indovinare, e su
 *   una fattura tirare a indovinare vuol dire intestarla alla persona
 *   sbagliata.
 *   Quello che si può fare — e che si fa qui — è il CONTROLLO: dati nome e
 *   cognome, il codice si ricalcola e si confronta. Se non combacia, uno dei
 *   due è sbagliato, e vale la pena dirlo prima di emettere.
 *
 *  ── QUELLO CHE INVECE C'È DENTRO PER INTERO ──────────────────────────────
 *  Data di nascita, sesso e comune di nascita (in codice catastale). Sono dati
 *  esatti, non stime: da lì l'età si conta, e l'età serve davvero — il
 *  preventivo la usa per attaccatura e densità, e chi telefona vuole sapere
 *  con chi sta parlando.
 *
 *  ── ⚠️ L'OMOCODIA ────────────────────────────────────────────────────────
 *  Quando due persone finirebbero con lo stesso codice, l'Agenzia sostituisce
 *  le cifre con delle lettere, dall'ultima verso la prima. Un lettore che non
 *  lo sa legge «V» dove c'è un 9 e sbaglia l'anno di nascita di novant'anni —
 *  in silenzio. Qui le lettere si ritraducono prima di leggere la data.
 */

const MESI = "ABCDEHLMPRST"; // A=gennaio … T=dicembre
const OMOCODIA: Record<string, string> = {
  L: "0", M: "1", N: "2", P: "3", Q: "4", R: "5", S: "6", T: "7", U: "8", V: "9",
};
const PARI: Record<string, number> = {};
const DISPARI: Record<string, number> = {};
{
  const alfabeto = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const valoriDispari = [
    1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8,
    12, 14, 16, 10, 22, 25, 24, 23,
  ];
  alfabeto.split("").forEach((c, i) => {
    PARI[c] = i < 10 ? i : i - 10;
    DISPARI[c] = valoriDispari[i];
  });
}

export const normalizzaCF = (cf: string): string =>
  String(cf ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Vero se il carattere di controllo torna. ⚠️ È l'unica difesa contro una
 *  lettura sbagliata di un carattere solo — «0» e «O», «1» e «I» — che a
 *  occhio non si vede e che fa scartare la fattura dallo SDI giorni dopo. */
export function cfValido(cf: string): boolean {
  const s = normalizzaCF(cf);
  if (!/^[A-Z0-9]{16}$/.test(s)) return false;
  let somma = 0;
  for (let i = 0; i < 15; i += 1) somma += (i % 2 === 0 ? DISPARI : PARI)[s[i]] ?? 0;
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[somma % 26] === s[15];
}

/** Una cifra che potrebbe essere stata sostituita per omocodia. */
const cifra = (c: string): string => (/\d/.test(c) ? c : (OMOCODIA[c] ?? ""));

export interface DatiCF {
  valido: boolean;
  /** "1980-01-01" */
  dataNascita?: string;
  /** compiuti, al giorno indicato */
  eta?: number;
  sesso?: "M" | "F";
  /** il codice catastale del comune di nascita: «H501» è Roma. ⚠️ Il NOME del
   *  comune non si scrive qui: sarebbero ottomila righe di tabella da tenere
   *  aggiornate (i comuni si fondono e cambiano nome), e un elenco vecchio
   *  direbbe una cosa falsa con l'aria di saperla. Il codice invece è esatto e
   *  si cerca in un istante. */
  comuneNascita?: string;
}

/** Gli anni compiuti fra due date. ⚠️ Non si divide per 365: chi è nato il 29
 *  febbraio, o chi compie gli anni domani, verrebbe invecchiato di un anno. */
export function anniCompiuti(nascitaIso: string, oggi: Date = new Date()): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(nascitaIso ?? ""));
  if (!m) return undefined;
  const [a, me, g] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let anni = oggi.getFullYear() - a;
  const primaDelCompleanno =
    oggi.getMonth() + 1 < me || (oggi.getMonth() + 1 === me && oggi.getDate() < g);
  if (primaDelCompleanno) anni -= 1;
  return anni >= 0 && anni < 130 ? anni : undefined;
}

/** ── QUALE SECOLO ──────────────────────────────────────────────────────────
 *  Il codice porta due cifre d'anno: «80» è il 1980 o il 2080. Si sceglie il
 *  passato, ma non a caso — un anno che darebbe una data futura è del secolo
 *  prima. ⚠️ Con la sola regola «se è maggiore di oggi togli cento» un bambino
 *   nato nel 2019 verrebbe letto 1919: si confronta la data INTERA, non l'anno.
 */
function annoIntero(due: number, mese: number, giorno: number, oggi: Date): number {
  const candidato = 2000 + due;
  const data = new Date(Date.UTC(candidato, mese - 1, giorno));
  return data.getTime() > oggi.getTime() ? 1900 + due : candidato;
}

export function datiDaCodiceFiscale(cf: string, oggi: Date = new Date()): DatiCF {
  const s = normalizzaCF(cf);
  if (!cfValido(s)) return { valido: false };

  const aa = `${cifra(s[6])}${cifra(s[7])}`;
  const mese = MESI.indexOf(s[8]) + 1;
  const gg = Number(`${cifra(s[9])}${cifra(s[10])}`);
  if (aa.length !== 2 || mese < 1 || !Number.isFinite(gg)) return { valido: true };

  //  ⚠️ Nelle donne al giorno si sommano 40: è così che il codice porta il
  //   sesso, e leggerlo male sposta la data di un mese e mezzo.
  const donna = gg > 40;
  const giorno = donna ? gg - 40 : gg;
  if (giorno < 1 || giorno > 31) return { valido: true };

  const anno = annoIntero(Number(aa), mese, giorno, oggi);
  const p = (n: number) => String(n).padStart(2, "0");
  const dataNascita = `${anno}-${p(mese)}-${p(giorno)}`;
  //  Una data che non esiste (31 febbraio) non si scrive: meglio niente che
  //  una data che poi il calendario rifiuta.
  const prova = new Date(`${dataNascita}T12:00:00`);
  const esiste =
    prova.getFullYear() === anno && prova.getMonth() + 1 === mese && prova.getDate() === giorno;

  return {
    valido: true,
    ...(esiste ? { dataNascita, eta: anniCompiuti(dataNascita, oggi) } : {}),
    sesso: donna ? "F" : "M",
    comuneNascita: `${s[11]}${cifra(s[12])}${cifra(s[13])}${cifra(s[14])}`.replace(
      /^(.)(\d{3})$/,
      "$1$2",
    ),
  };
}

/* ── IL CONTROLLO SU NOME E COGNOME ───────────────────────────────────────── */

const soloLettere = (s: string): string =>
  String(s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z]/g, "");

const consonanti = (s: string): string => s.replace(/[AEIOU]/g, "");
const vocali = (s: string): string => s.replace(/[^AEIOU]/g, "");

/** Le tre lettere del cognome. */
export function codiceCognome(cognome: string): string {
  const s = soloLettere(cognome);
  if (!s) return "";
  return `${consonanti(s)}${vocali(s)}XXX`.slice(0, 3);
}

/** Le tre lettere del nome. ⚠️ Con quattro o più consonanti si prendono la
 *  prima, la TERZA e la quarta — non le prime tre: «Francesco» fa FNC e non
 *  FRN, e chi non lo sa dichiara sbagliato un codice giusto. */
export function codiceNome(nome: string): string {
  const s = soloLettere(nome);
  if (!s) return "";
  const c = consonanti(s);
  if (c.length >= 4) return `${c[0]}${c[2]}${c[3]}`;
  return `${c}${vocali(s)}XXX`.slice(0, 3);
}

/** Se il codice fiscale corrisponde a questo nome e cognome.
 *  ⚠️ Tre risposte e non due: senza nome o senza cognome la domanda non ha
 *   risposta, e dire «non combacia» a chi non ha ancora scritto il cognome è
 *   un allarme per una cosa che non è successa. */
export function combaciaConNome(
  cf: string,
  nome: string,
  cognome: string,
): "si" | "no" | "non_verificabile" {
  const s = normalizzaCF(cf);
  if (!cfValido(s)) return "non_verificabile";
  const n = codiceNome(nome);
  const c = codiceCognome(cognome);
  if (!n || !c || soloLettere(nome).length < 2 || soloLettere(cognome).length < 2) {
    return "non_verificabile";
  }
  return s.slice(0, 3) === c && s.slice(3, 6) === n ? "si" : "no";
}
