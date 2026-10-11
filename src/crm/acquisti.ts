/** ── QUANTO HA SPESO QUESTO CLIENTE, IN TUTTO ──────────────────────────────
 *
 *  ── PERCHÉ SERVE ──────────────────────────────────────────────────────────
 *  Un impianto non è una vendita sola: chi lo prende torna per le manutenzioni,
 *  compra un secondo pezzo, cambia il modello dopo un anno. Il CRM sapeva
 *  rispondere solo a «quanto deve ancora darci per QUESTA pratica»
 *  (`payment`), che è la domanda della consegna. Mancava quella del cliente —
 *  «quanto ci ha lasciato finora» — ed è il numero che dice se vale la pena
 *  richiamarlo, quanto trattare, e chi va tenuto stretto.
 *
 *  ── LE TRE VOCI, E PERCHÉ NON SI SOMMANO ALTROVE ──────────────────────────
 *  Il totale si compone qui, in un punto solo, di tre pezzi che vivono in tre
 *  posti diversi della scheda:
 *   1. LA VENDITA — `payment.prezzoFinaleVendita`. Il prezzo concordato, non
 *      l'incassato: il saldo alla consegna è un soldo che quel cliente ha
 *      speso, anche se materialmente entra domani. Contare l'incassato
 *      direbbe che chi paga tutto alla consegna ha speso 100 € invece di 1000.
 *   2. GLI ACQUISTI — `acquisti`, l'elenco scritto a mano dalla riga.
 *   3. LE MANUTENZIONI FATTE — l'importo sui ritorni già eseguiti.
 *  ⚠️ Sommarle dentro `payment` sarebbe stato più comodo e avrebbe rotto la
 *   consegna: `resta` è `totale - versato`, e un acquisto di ieri sarebbe
 *   diventato un debito sulla posa di oggi. Restano separate, e si incontrano
 *   solo qui.
 *
 *  ── IL RITORNO IN PROGRAMMA NON È SPESO ───────────────────────────────────
 *  Un appuntamento futuro con un prezzo scritto sopra è un incasso PREVISTO.
 *  Metterlo nel totale direbbe che il cliente ha già lasciato dei soldi che
 *  potrebbe non lasciare mai — e su un numero che si guarda per decidere quanto
 *  trattare, è l'errore che costa. Entra quando il ritorno risulta fatto.
 *  Il previsto però esiste e serve: si chiede a parte (`totaleManutenzioniAttese`),
 *  così chi vuole mostrarlo lo mostra come previsione e non come storia. */
import { righeAcquistoDaArchivio, type Lead, type RigaAcquisto } from "./types";

/** ── L'ELENCO DEGLI ACQUISTI È QUELLO CHE C'ERA GIÀ ───────────────────────
 *  ⚠️ Qui stava per nascere un secondo elenco di acquisti, con un tipo suo e un
 *   campo suo. Sarebbe stato il difetto peggiore di tutto questo lavoro: il
 *   dettaglio esiste da sempre in `acquistiDettaglio` (lo scrive la scheda del
 *   cliente, StoricoAcquisti), e due elenchi paralleli avrebbero significato
 *   una spesa registrata dalla scheda invisibile dalla riga e viceversa —
 *   scoperto mesi dopo, con i totali già sbagliati.
 *  Si legge quindi `acquistiDettaglio`, con il ripiego sugli archivi importati
 *  che `righeAcquistoDaArchivio` sa tradurre: la stessa regola della scheda. */
export function acquistiDi(l?: Lead | null): RigaAcquisto[] {
  const d = l?.data;
  if (Array.isArray(d?.acquistiDettaglio) && d.acquistiDettaglio.length > 0) {
    return d.acquistiDettaglio.map((a) => ({ ...a, importo: Number(a.importo) || 0 }));
  }
  return righeAcquistoDaArchivio(d?.acquisti).map((a) => ({
    ...a,
    importo: Number(a.importo) || 0,
  }));
}

export function totaleAcquisti(l?: Lead | null): number {
  return acquistiDi(l).reduce((s, a) => s + (Number(a.importo) || 0), 0);
}

/** Il prezzo della vendita, letto dove lo legge tutto il resto del CRM.
 *  ⚠️ Non si importa `prezzoVendita` da InstallationScheduleDialog: quel file
 *   è un componente React grosso, e tirarselo dentro da qui — che serve anche
 *   a chi calcola e basta — porterebbe in giro mezza interfaccia. La regola è
 *   di due righe e sta scritta identica là. */
export function prezzoDellaVendita(l?: Lead | null): number {
  const p = l?.data?.payment;
  return Number(p?.prezzoFinaleVendita) || Number(p?.prezzoTotale) || 0;
}

/** Le manutenzioni GIÀ FATTE, con il loro prezzo. */
export function totaleManutenzioni(l?: Lead | null): number {
  const voci = l?.data?.manutenzione?.appuntamenti;
  if (!Array.isArray(voci)) return 0;
  return voci
    .filter((a) => a && a.stato === "fatta")
    .reduce((s, a) => s + (Number(a.importo) || 0), 0);
}

/** I ritorni ancora da fare che hanno già un prezzo: è una PREVISIONE, e chi la
 *  mostra deve dirlo. Tenuta separata dal totale per la ragione scritta in
 *  testa al file.
 *  ⚠️ FUORI ANCHE LE SALTATE, non solo le fatte. Prima il filtro diceva
 *   «tutto quello che non è fatto», e ci finiva dentro anche il ritorno che il
 *   cliente ha saltato: un appuntamento saltato non è un incasso che deve
 *   ancora arrivare, è un incasso che non arriverà. Sommarlo gonfiava la
 *   previsione proprio sui clienti che tornano meno — cioè faceva sembrare più
 *   promettente chi lo è di meno. */
export function totaleManutenzioniAttese(l?: Lead | null): number {
  const voci = l?.data?.manutenzione?.appuntamenti;
  if (!Array.isArray(voci)) return 0;
  return voci
    .filter((a) => a && a.stato !== "fatta" && a.stato !== "saltata")
    .reduce((s, a) => s + (Number(a.importo) || 0), 0);
}

export interface SpesaCliente {
  vendita: number;
  acquisti: number;
  manutenzioni: number;
  /** La somma delle tre: è il numero che si mostra fuori. */
  totale: number;
  /** Quante righe compongono le due voci scritte a mano: serve a dire «3 voci»
   *  accanto al totale, cioè a far capire che il numero si può aprire. */
  quante: number;
  /** Ritorni già fissati con un prezzo, non ancora fatti. Previsione. */
  attese: number;
}

/** Tutto insieme, in un passaggio solo: chi disegna la riga chiede questo e non
 *  quattro funzioni di fila, o su trecento righe si attraversa quattro volte lo
 *  stesso elenco di appuntamenti. */
export function spesaDelCliente(l?: Lead | null): SpesaCliente {
  const vendita = prezzoDellaVendita(l);
  const acquisti = totaleAcquisti(l);
  const manutenzioni = totaleManutenzioni(l);
  const voci = l?.data?.manutenzione?.appuntamenti;
  const fatte = Array.isArray(voci)
    ? voci.filter((a) => a && a.stato === "fatta" && (Number(a.importo) || 0) > 0).length
    : 0;
  return {
    vendita,
    acquisti,
    manutenzioni,
    totale: vendita + acquisti + manutenzioni,
    quante: acquistiDi(l).length + fatte,
    attese: totaleManutenzioniAttese(l),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCRIVERE — le due sole modifiche possibili, in forma di dato
   ═════════════════════════════════════════════════════════════════════════ */

/** Un id che non si scontra con nessun altro. `crypto.randomUUID` non c'è
 *  ovunque (questa pagina si costruisce anche sul server), quindi il ripiego
 *  esiste ed è buono abbastanza: due voci aggiunte nello stesso millisecondo
 *  dalla stessa persona sono un caso che non capita. */
function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `acq-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** L'elenco con dentro una voce nuova. Torna il campo da salvare, non salva:
 *  chi scrive è la pagina, che ha `updateLead` e sa leggere la risposta. */
export function conAcquisto(
  l: Lead,
  voce: { titolo: string; importo: number; data?: string },
): RigaAcquisto[] {
  const titolo = voce.titolo.trim();
  return [
    ...acquistiDi(l),
    {
      id: nuovoId(),
      //  Un titolo vuoto non si rifiuta con un errore: si dà un nome che si
      //  legge. Il pulsante che chiama questa funzione già non si accende
      //  senza un importo, e su un elenco di spese «Acquisto» è più utile di
      //  una riga senza niente scritto.
      prodotto: titolo || "Acquisto",
      importo: Number(voce.importo) || 0,
      data: voce.data || new Date().toISOString().slice(0, 10),
    },
  ];
}

/** L'elenco senza una voce. Se l'id non c'è torna lo stesso elenco: chi chiama
 *  confronta le lunghezze per sapere se c'era qualcosa da togliere. */
export function senzaAcquisto(l: Lead, id: string): RigaAcquisto[] {
  return acquistiDi(l).filter((a) => a.id !== id);
}
