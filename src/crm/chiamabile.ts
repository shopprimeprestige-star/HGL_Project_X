/** ── CHIAMARE SOLO L'ITALIA (30/10/2026) ───────────────────────────────────
 *  Richiesta del titolare: se il prefisso di un numero non è +39, il tasto per
 *  chiamare è rosso, bloccato e non fa niente; con quel contatto si parla solo
 *  su WhatsApp. Puro: nessun React, provato in prove/prove.mjs.
 *
 *  ── COME IL CRM SALVA I NUMERI ────────────────────────────────────────────
 *  Come arrivano, senza normalizzarli: «+39 333 123 4567», «0039 333…»,
 *  «333 1234567» (il modo in cui lo scrive chiunque in un modulo), «06 1234567»
 *  per i fissi, e dalla chat WhatsApp solo cifre col prefisso, senza «+»
 *  («393331234567»). Quindi la regola guarda le CIFRE e quattro cose sole:
 *   · «+» o «00» davanti → il prefisso c'è e si legge: italiano solo se è 39 e
 *     il resto è un numero italiano (inizia per 0, 3 o 8, oppure è un 199);
 *   · niente prefisso, 9-10 cifre che iniziano per 3 → cellulare italiano;
 *   · niente prefisso, iniziano per 0 → fisso italiano (06, 02, 081…). ⚠️ Un
 *     fisso ESTERO scritto con lo 0 e senza «+» («020 7946 0000», Londra senza
 *     prefisso) è indistinguibile da un fisso italiano: passa per chiamabile.
 *     Il «+»/«00» davanti è l'unico segno affidabile;
 *   · niente prefisso, numeri verdi e speciali: 800, 803, 199, 84x, 89x;
 *   · cifre che iniziano per 39 e sono 11-13 → italiano scritto senza «+»
 *     (la forma della chat). Il cellulare nudo di 10 cifre che inizia per 39
 *     («392 1234567») resta un cellulare: lo decide la lunghezza.
 *  Tutto il resto — compreso ciò che non si riconosce — NON è chiamabile: un
 *  tasto bloccato di troppo costa un clic su WhatsApp, un numero estero
 *  composto per sbaglio costa una telefonata internazionale.
 *  Un cellulare belga nudo (32x…, 10 cifre) si legge come italiano: senza «+»
 *  non c'è modo di distinguerlo.
 *  ───────────────────────────────────────────────────────────────────────── */
export function chiamabile(numero: string | number | null | undefined): boolean {
  const grezzo = String(numero ?? "")
    //  Caratteri invisibili di direzione del testo, incollati dai gestionali.
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim();
  const cifre = grezzo.replace(/\D/g, "");
  if (!cifre) return false;

  if (grezzo.startsWith("+")) return italianoConPrefisso(cifre);
  if (cifre.startsWith("00")) return italianoConPrefisso(cifre.slice(2));
  if (/^3\d{8,9}$/.test(cifre)) return true; // cellulare nudo
  if (/^0\d{5,10}$/.test(cifre)) return true; // fisso nudo
  if (/^(?:80[03]|199|84\d|89\d)\d{3,7}$/.test(cifre)) return true; // verdi e speciali nudi
  return /^39\d{9,11}$/.test(cifre) && italianoConPrefisso(cifre); // forma della chat
}

/** Cifre dopo «+»/«00»: il 39 e poi un numero italiano: 6-11 cifre che iniziano
 *  per 0 (fissi, con lo 0 che resta: +39 06…), 3 (cellulari) o 8 (800, 803, 84x,
 *  89x), oppure un 199. */
function italianoConPrefisso(cifre: string): boolean {
  if (!cifre.startsWith("39")) return false;
  const resto = cifre.slice(2);
  return /^[038]\d{5,10}$/.test(resto) || /^199\d{3,8}$/.test(resto);
}

/** C'è un numero ma non si può chiamare: è quello che accende il rosso. Un
 *  campo vuoto non è «estero»: lì resta quello che c'era (nessun tasto). */
export function numeroEstero(numero: string | number | null | undefined): boolean {
  return /\d/.test(String(numero ?? "")) && !chiamabile(numero);
}

/** Il testo che il tasto rosso dice a chi lo tocca o lo legge. */
export const TESTO_NUMERO_ESTERO = "Numero estero: contattalo su WhatsApp";

/** Il nome accessibile del tasto rosso: dice che è la cornetta («Chiama»), così
 *  chi legge lo schermo lo trova dove cerca «Chiama», e dice perché è spento. */
export const ETICHETTA_NUMERO_ESTERO = "Chiama: numero estero, contattalo su WhatsApp";
