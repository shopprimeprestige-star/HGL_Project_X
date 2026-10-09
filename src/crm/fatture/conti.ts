/** ── I CONTI DI UNA FATTURA ────────────────────────────────────────────────
 *  Scorporo, imponibile, imposta, totale. In un posto solo perché li fanno la
 *  finestra (per mostrarli prima), l'archivio (per congelarli) e il documento —
 *  e tre versioni dello stesso arrotondamento producono tre totali diversi da
 *  un centesimo, che su una fattura è un file scartato.
 *
 *  ⚠️ SI PARTE DALL'IMPORTO INCASSATO, cioè dal LORDO. È la cifra che esiste
 *   davvero: il bonifico che è arrivato. L'imponibile si ricava da lì
 *   dividendo, e non il contrario — chiedere l'imponibile vorrebbe dire far
 *   fare a mano una divisione per 1,22 a chi ha in mano l'estratto conto.
 *  ───────────────────────────────────────────────────────────────────────── */

const cent = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface ContoFattura {
  /** quello che il cliente ha pagato */
  totale: number;
  imponibile: number;
  imposta: number;
  aliquota: number;
}

/** Dal lordo incassato al conto della fattura.
 *  Ad aliquota 0 (forfettario, operazioni non soggette) imponibile e totale
 *  coincidono e l'imposta è zero: il caso si regge da sé senza un ramo a parte. */
export function contoDaLordo(lordo: number, aliquota: number): ContoFattura {
  const totale = cent(Math.max(0, lordo));
  const a = Math.max(0, Number(aliquota) || 0);
  const imponibile = cent(totale / (1 + a / 100));
  //  ⚠️ L'imposta è la DIFFERENZA, non un secondo arrotondamento: calcolandola
  //   come imponibile × aliquota, su certe cifre imponibile + imposta fa un
  //   centesimo in meno del totale — e lo SDI ricontrolla proprio quella somma.
  return { totale, imponibile, imposta: cent(totale - imponibile), aliquota: a };
}

/** ── ACCONTO, SALDO O FATTURA INTERA: COSA PROPORRE ────────────────────────
 *
 *  ⚠️ DIFETTO SEGNALATO DAL COMMITTENTE: a clienti che avevano versato SOLO
 *   l'acconto la finestra proponeva «saldo». La vecchia regola guardava una
 *   cosa sola — quanto resta da incassare — e su una pratica senza prezzo
 *   scritto quel numero è zero: niente da incassare, quindi «saldo». Ma zero
 *   da incassare perché il prezzo non c'è non è «pagato tutto», è «non lo
 *   sappiamo», e proporre saldo lì vuol dire mandare al cliente una fattura
 *   che dice di chiudere un conto mai aperto.
 *
 *  La regola vera è un'altra, e passa da quello che è GIÀ STATO FATTURATO:
 *   · «saldo» ha senso solo DOPO una fattura di acconto — è il documento che
 *     scomputa quello che è già stato fatturato. Senza quella prima fattura, un
 *     saldo non salda niente;
 *   · «fattura intera» quando il prezzo si sa ed è stato incassato tutto: un
 *     documento solo per tutta l'operazione;
 *   · «acconto» in tutti gli altri casi, ed è il caso normale — i soldi entrati
 *     sono una parte, o il prezzo non è ancora scritto da nessuna parte.
 *
 *  ⚠️ È una PROPOSTA, non un vincolo: chi fattura può sempre cambiarla. Ma una
 *   proposta sbagliata si accetta senza guardarla, ed è per questo che vale la
 *   pena farla giusta.
 */
export function tipoProposto(d: {
  /** quanto è già entrato in cassa su questa pratica */
  versato: number;
  /** il prezzo pieno della pratica, zero se non è scritto */
  prezzo: number;
  /** a questo cliente è già stata emessa una fattura di acconto */
  accontoGiaFatturato?: boolean;
}): "acconto" | "saldo" | "unica" {
  const versato = Number(d.versato) || 0;
  const prezzo = Number(d.prezzo) || 0;
  if (d.accontoGiaFatturato) return "saldo";
  //  Un centesimo di tolleranza: gli arrotondamenti non devono far sembrare
  //  «non ancora pagato tutto» una pratica saldata.
  if (prezzo > 0 && versato >= prezzo - 0.01) return "unica";
  return "acconto";
}
