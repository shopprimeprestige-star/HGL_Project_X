/** ── LE NOTE DEL LEAD, LETTE DA FUORI ──────────────────────────────────────
 *
 *  Richiesta del committente: «le note che mette il setter — o chiunque —
 *  dentro al lead devono mostrarsi anche fuori, sulla scheda “Oggi”, con un
 *  design moderno però con disclaimer».
 *
 *  ── PERCHÉ SERVE ─────────────────────────────────────────────────────────
 *  Nella scheda «Oggi» ci sono i richiami promessi: nomi, orari, un conto alla
 *  rovescia. Ma la cosa che fa fare una buona telefonata non è l'orario, è
 *  quello che il collega ha scritto — «lavora fino alle 18», «chiede di
 *  parlare con la moglie», «ha già un preventivo da un altro». Finora per
 *  leggerlo bisognava aprire la scheda, una per una, uscendo dall'elenco che
 *  si sta smaltendo.
 *
 *  ── PERCHÉ UN PEZZO E NON TUTTA ──────────────────────────────────────────
 *  Una nota può essere lunga mezza pagina: venti righe così in un elenco lo
 *  rendono illeggibile proprio mentre si lavora in fretta. Qui si taglia il
 *  primo pezzo — quello che si legge di sfuggita — e si dice che c'è dell'altro.
 *
 *  ⚠️ NON SI TAGLIA A METÀ PAROLA: «ha già un preven…» sembra un guasto. Si
 *   torna indietro all'ultimo spazio, e se non ce n'è (una parola lunghissima)
 *   si taglia dove capita, che è l'unica cosa sensata.
 *  ⚠️ GLI A CAPO DIVENTANO SPAZI: nell'elenco la nota sta su una riga sola, e
 *   un a capo lasciato lì manderebbe fuori quadro la riga sotto.
 *  ⚠️ QUI NON SI SCRIVE NIENTE E NON SI MODIFICA NIENTE: la nota si cambia
 *   solo dentro la scheda, che è l'unico posto dove si vede tutta. Fuori si
 *   LEGGE — ed è anche il senso del cartello che la accompagna.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Quanti caratteri si leggono di sfuggita su una riga d'elenco. */
export const CARATTERI_IN_BREVE = 140;

export interface NotaInBreve {
  /** Il pezzo da mostrare. Vuoto = non c'è niente da mostrare. */
  breve: string;
  /** La nota intera, ripulita degli a capo: è quella che si apre col tocco. */
  intera: string;
  /** C'è dell'altro oltre al pezzo mostrato. */
  tagliata: boolean;
}

export function notaInBreve(testo?: string | null, massimo = CARATTERI_IN_BREVE): NotaInBreve {
  //  Gli a capo e gli spazi doppi diventano uno spazio: in un elenco la nota
  //  vive su una riga.
  const intera = String(testo ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!intera) return { breve: "", intera: "", tagliata: false };
  if (intera.length <= massimo) return { breve: intera, intera, tagliata: false };
  const tagliato = intera.slice(0, massimo);
  const spazio = tagliato.lastIndexOf(" ");
  //  ⚠️ L'ultimo spazio solo se non taglia via quasi tutto: con una parola
  //   lunghissima in testa si resterebbe con tre lettere.
  const breve = spazio > massimo * 0.6 ? tagliato.slice(0, spazio) : tagliato;
  return { breve: `${breve.trimEnd()}…`, intera, tagliata: true };
}
