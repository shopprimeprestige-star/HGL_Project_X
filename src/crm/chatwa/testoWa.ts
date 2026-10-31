/** ── LA FORMA DEI TESTI PRECOMPILATI PER WHATSAPP (31/10/2026) ──────────────
 *  Richiesta del titolare: aprendo wa.me il testo arrivava come un blocco unico,
 *  con il link in mezzo alla frase. La forma giusta è quella dei promemoria
 *  automatici:
 *    Ciao Giulia!                     ← saluto col nome
 *    (riga vuota)
 *    La tua consulenza è alle 10:30.  ← l'informazione
 *    (riga vuota)
 *    Per collegarti:                  ← il link DA SOLO sulla sua riga:
 *    https://…                          WhatsApp lo rende cliccabile e non lo spezza
 *    (riga vuota)
 *    A presto!                        ← chiusura breve
 *  Qui sta solo la forma: le parole, i dati e il link li decide chi chiama.
 *  Il link nel `?text=` conserva gli a capo: `encodeURIComponent` li scrive `%0A`.
 *  Puro, provato in prove/idee/testi-wame.mjs. */

/** «Ciao Giulia!», o «Ciao!» se il nome non c'è (mai «Ciao !»). */
export const salutoWa = (nome?: string | null): string => {
  const n = String(nome ?? "").trim();
  return n ? `Ciao ${n}!` : "Ciao!";
};

/** Introduzione e link su due righe: il link resta solo, senza punteggiatura attaccata. */
export const bloccoLinkWa = (introduzione: string, link: string): string => `${introduzione}\n${link}`;

/** I blocchi separati da una riga vuota; quelli vuoti (assenti) si saltano. */
export const testoWa = (blocchi: (string | null | undefined | false)[]): string =>
  blocchi
    .map((b) => (b ? b.trim() : ""))
    .filter(Boolean)
    .join("\n\n");

/** Il preventivo da mandare, col link da solo. Con `nome` (anche vuoto: «Ciao!») è il messaggio
 *  personale al cliente, con saluto e chiusura; senza `nome` è il testo da condividere, che si apre
 *  dicendo di che preventivo si tratta (col `totale`, se c'è). */
export const testoPreventivoWa = (i: {
  nome?: string | null;
  riferimento: string;
  totale?: string;
  link: string;
}): string => {
  const personale = i.nome !== undefined;
  return testoWa([
    personale && salutoWa(i.nome),
    personale
      ? `Ecco il tuo preventivo ${i.riferimento}.`
      : `Preventivo Hair Genius Labs ${i.riferimento}${i.totale ? ` — ${i.totale}` : ""}.`,
    bloccoLinkWa("Per aprirlo:", i.link),
    personale && "Se hai domande, scrivimi qui.",
  ]);
};
