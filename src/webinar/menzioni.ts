/** ── RISPONDERE A QUALCUNO, IN CHAT ────────────────────────────────────────
 *
 *  In una sala da duecento persone i messaggi scorrono: «sì, esatto» due righe
 *  sotto la domanda di un altro non si capisce a chi risponda, e chi aveva
 *  chiesto non sa nemmeno di aver ricevuto una risposta. Serve dire A CHI.
 *
 *  ⚠️ PERCHÉ L'AGGANCIO STA DENTRO IL TESTO E NON IN UNA COLONNA SUA.
 *   La colonna sarebbe più pulita, e vuole una migrazione da incollare a mano
 *   nell'editor SQL prima che la cosa funzioni: fino a quel momento la chat
 *   sarebbe rotta per tutti. Qui invece il messaggio è una riga di testo come
 *   tutte le altre, e nel caso peggiore — un lettore che non conosce questa
 *   codifica — si legge comunque, perché il marcatore è fatto per essere
 *   leggibile: `↩[id|Nome] ciao`.
 *  ⚠️ IL NOME VIAGGIA INSIEME ALL'IDENTIFICATIVO, e non si va a cercarlo
 *   dopo: chi è stato citato può uscire dalla sala, e il suo nome deve
 *   restare nel messaggio — altrimenti una conversazione riletta dieci minuti
 *   dopo perde metà dei suoi riferimenti.
 */

const MARCA = "↩[";

/** Quello che sta scritto in un messaggio, una volta sciolto l'aggancio. */
export interface Sciolto {
  /** a chi risponde: identificativo dello spettatore. Vuoto = a nessuno. */
  aId: string;
  /** come si chiamava quando gli si è risposto */
  aNome: string;
  /** il messaggio vero, senza il marcatore */
  testo: string;
}

/** ⚠️ Si tolgono i caratteri che ROMPEREBBERO la lettura: una barra verticale
 *  o una quadra chiusa dentro il nome spezzerebbero il marcatore a metà, e da
 *  lì in poi il messaggio si leggerebbe storto. Non è una questione di
 *  sicurezza — è che i nomi veri contengono di tutto. */
const pulisci = (s: string) => String(s ?? "").replace(/[[\]|\n\r]/g, " ").trim().slice(0, 60);

/** Compone il testo da spedire. Senza destinatario torna il testo così com'è:
 *  la stragrande maggioranza dei messaggi non risponde a nessuno, e non devono
 *  portarsi dietro niente. */
export function conRisposta(testo: string, a?: { id: string; nome: string } | null): string {
  const corpo = String(testo ?? "").trim();
  if (!a?.id || !corpo) return corpo;
  return `${MARCA}${pulisci(a.id)}|${pulisci(a.nome) || "Ospite"}] ${corpo}`;
}

/** Scioglie un messaggio ricevuto.
 *  ⚠️ Non fallisce MAI: un marcatore malformato torna come testo normale. Un
 *   messaggio che non si riesce a leggere è peggio di un messaggio senza
 *   aggancio, e in chat non si può mostrare un errore al posto di una frase. */
export function sciogli(testo: string): Sciolto {
  const s = String(testo ?? "");
  if (!s.startsWith(MARCA)) return { aId: "", aNome: "", testo: s };
  const fine = s.indexOf("] ");
  if (fine < 0) return { aId: "", aNome: "", testo: s };
  const dentro = s.slice(MARCA.length, fine);
  const barra = dentro.indexOf("|");
  if (barra < 0) return { aId: "", aNome: "", testo: s };
  const aId = dentro.slice(0, barra).trim();
  const aNome = dentro.slice(barra + 1).trim();
  //  Un aggancio senza uno dei due pezzi non è un aggancio: meglio mostrare
  //  la riga intera che una risposta «a nessuno».
  if (!aId || !aNome) return { aId: "", aNome: "", testo: s };
  return { aId, aNome, testo: s.slice(fine + 2) };
}

/** ── DI CHE COLORE VA LETTO ────────────────────────────────────────────────
 *  Tre casi, e vanno distinti a colpo d'occhio perché rispondono a tre domande
 *  diverse di chi legge:
 *   · `a-me`      — «stanno parlando CON ME»: è l'unico che deve fermare
 *                    l'occhio, e succede una volta ogni cento messaggi;
 *   · `mio`       — «questa è una risposta che ho scritto io»;
 *   · `ad-altri`  — «questa è una risposta, ma non mi riguarda»: si deve
 *                    capire che è un botta e risposta, senza rubare
 *                    attenzione.
 *  ⚠️ «a me» VINCE SU «mio»: rispondendo a sé stessi conta di più il fatto che
 *   quel messaggio è indirizzato a te. */
export type Tono = "a-me" | "mio" | "ad-altri" | "nessuno";

export function tono(m: { aId: string; autoreId?: string }, io: string): Tono {
  if (!m.aId) return "nessuno";
  if (io && m.aId === io) return "a-me";
  if (io && m.autoreId && m.autoreId === io) return "mio";
  return "ad-altri";
}
