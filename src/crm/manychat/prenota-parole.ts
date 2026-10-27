/** ── PRENOTA IN CHAT: LE PAROLE DEL LEAD ───────────────────────────────────
 *
 *  Commessa 2026-10-27 (SPEC 3.1 e 3.7). Dal testo di un lead dice se è una
 *  fascia («sera»), una scelta fra le opzioni mostrate («2»), la richiesta di
 *  altri orari («altri») oppure `niente`.
 *
 *  ⚠️ Il principio: una risposta sbagliata costa più del silenzio. `niente`
 *  vuol dire «non rispondo io»: la risposta resta alla setter come oggi. Per
 *  questo nel dubbio si tace: una domanda, un giorno o un'ora scritti, due
 *  fasce, una negazione, più di 8 parole. Pura: nessun database, nessun orologio.
 *
 *  STOP non è affar suo: lo ferma `eStop` a monte.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Capito, Fascia } from "./prenota-tipi";

const NIENTE: Capito = { tipo: "niente" };

/** Minuscole, senza accenti, solo lettere e cifre separate da uno spazio.
 *  Emoji, punteggiatura e apostrofi diventano spazi («l'opzione» → «l opzione»). */
function parole(testo: string): string[] {
  return String(testo ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

const MASSIMO_PAROLE = 8;

/** Un giorno o un'ora scritti: li legge la setter (3.7), anche con «sera» dentro. */
const GIORNI = new Set(
  (
    "lunedi martedi mercoledi giovedi venerdi sabato domenica oggi domani dopodomani " +
    "settimana weekend gennaio febbraio marzo aprile maggio giugno luglio agosto " +
    "settembre ottobre novembre dicembre alle dalle all ore mezzogiorno mezzanotte"
  ).split(" "),
);
/** «dopo le», «prima delle», «verso le»…: un'ora scritta a parole («dopo le diciotto»). */
const ORA_A_PAROLE = /\b(dopo|prima|verso|entro|intorno) (le|alle|delle|all)\b/;

/** Le domande senza punto interrogativo («la sera quanto costa»). */
const DOMANDE = new Set(
  "quanto quanti quanta quante quando come cosa perche dove chi quale quali costa costo prezzo".split(
    " ",
  ),
);
/** «non di sera», «mai di mattina»: il contrario di quel che dice la fascia. */
const NEGAZIONI = new Set("non no mai senza tranne eccetto escluso".split(" "));

const FASCE_PAROLE: [Fascia, string[]][] = [
  ["mattina", ["mattina", "mattino", "stamattina"]],
  ["pomeriggio", ["pomeriggio"]],
  ["sera", ["sera", "serata", "stasera"]],
];

/** Le parole che possono stare attorno a un numero o a «altri» senza cambiarne
 *  il senso («scelgo l'opzione 2», «vorrei altri orari, per favore»). Se c'è
 *  qualcos'altro («ho 2 figli», «secondo me») non è una scelta. */
const CONTORNO = new Set(
  (
    "si no ok grazie prego per favore piacere vorrei voglio preferisco scelgo prendo prendiamo " +
    "direi allora mi ci la il lo l le un una di da a e va vanno bene quella quello questa questo " +
    "questi queste quelli quelle opzione opzioni numero n scelta scriva scrivo mandi manda " +
    "orario orari data date giorno giorni proposta proposte possibilita"
  ).split(" "),
);
/** ⚠️ Una Map, non un oggetto: con `x in oggetto` «constructor» o «toString»
 *  risulterebbero numeri (chiavi del prototipo). */
const NUMERI = new Map<string, 1 | 2 | 3>(
  Object.entries({
    "1": 1,
    uno: 1,
    primo: 1,
    prima: 1,
    "2": 2,
    due: 2,
    secondo: 2,
    seconda: 2,
    "3": 3,
    tre: 3,
    terzo: 3,
    terza: 3,
  }),
);
const ALTRI = new Set("altri altre altro altra nessuno nessuna nessun".split(" "));

/** Prima di restituire una scelta si ricontrolla che sia 1, 2 o 3. */
function sceltaDi(parola: string): Capito {
  const n = NUMERI.get(parola);
  return n === 1 || n === 2 || n === 3 ? { tipo: "scelta", n } : NIENTE;
}

/** `propostaAperta`: il lead ha davanti degli orari con i pulsanti. Solo allora
 *  un numero o «altri» hanno un senso; senza, sono `niente`. */
export function capisciRisposta(testo: string, c: { propostaAperta: boolean }): Capito {
  if (/[?？]/.test(String(testo ?? ""))) return NIENTE;
  const p = parole(testo);
  if (p.length === 0 || p.length > MASSIMO_PAROLE) return NIENTE;
  const frase = p.join(" ");
  if (p.some((x) => GIORNI.has(x) || DOMANDE.has(x)) || ORA_A_PAROLE.test(frase)) return NIENTE;

  if (c.propostaAperta && p.every((x) => CONTORNO.has(x) || NUMERI.has(x) || ALTRI.has(x))) {
    const numeri = p.filter((x) => NUMERI.has(x));
    if (numeri.length === 1 && !p.some((x) => ALTRI.has(x))) return sceltaDi(numeri[0]);
    if (numeri.length === 0 && p.some((x) => ALTRI.has(x))) return { tipo: "altri" };
    return NIENTE;
  }

  //  Una cifra rimasta è un'ora, una data o un numero qualunque: non è una fascia.
  if (p.some((x) => /\d/.test(x))) return NIENTE;
  if (p.some((x) => NEGAZIONI.has(x))) return NIENTE;

  //  «Buonasera» scritto staccato è un saluto, non la fascia.
  const senzaSaluti = frase
    .replace(/\bbuon[ao]? (sera|pomeriggio|mattina)\b/g, " ")
    .replace(/\bdopo cena\b/g, "sera")
    .split(" ");
  const trovate = FASCE_PAROLE.filter(([, lista]) => lista.some((x) => senzaSaluti.includes(x)));
  return trovate.length === 1 ? { tipo: "fascia", fascia: trovate[0][0] } : NIENTE;
}
