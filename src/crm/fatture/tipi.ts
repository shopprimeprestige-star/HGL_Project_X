/** ── LA FATTURA: IL MODELLO ────────────────────────────────────────────────
 *
 *  Qui c'è la forma di una fattura e di chi la emette, e nient'altro: niente
 *  scritture, niente XML, niente schermate. Lo leggono tutti gli altri file di
 *  questa cartella, e sono l'unico posto in cui questi nomi esistono.
 *
 *  ── ⚠️ COSA QUESTA CARTELLA FA E COSA NON FA ──────────────────────────────
 *  FA: comporre il documento, numerarlo, produrre l'XML nel formato FatturaPA
 *  che il commercialista importa nel suo gestionale, e un foglio leggibile da
 *  dare al cliente.
 *  NON FA: trasmettere allo SDI. In Italia una fattura diventa valida quando
 *  passa dal Sistema di Interscambio, e quel passaggio richiede un canale
 *  accreditato (il gestionale del commercialista, un provider, il portale
 *  Fatture e Corrispettivi). Un file XML perfetto lasciato su un disco non è
 *  una fattura emessa, ed è la cosa più importante da sapere di tutta questa
 *  cartella.
 *
 *  ── ⚠️ IL NUMERO NASCE CON L'INCASSO, NON CON IL PREVENTIVO ───────────────
 *  Una bozza si prepara quando si vuole — al preventivo, giorni prima — e
 *  porta già dentro tutto: cliente, importo, causale. Ma `numero` resta 0 e
 *  `data` resta vuota finché i soldi non arrivano.
 *  Il motivo non è prudenza: numero e data su una fattura sono un fatto
 *  fiscale (fanno scattare l'IVA a debito e finiscono nel registro). Numerare
 *  al preventivo vuol dire che ogni cliente che non firma lascia in contabilità
 *  una fattura da stornare con una nota di credito, e al commercialista arrivano
 *  documenti per operazioni mai avvenute.
 *  Quello che serve davvero — «la fattura già pronta da mandare» — lo dà la
 *  bozza: all'incasso un tocco le assegna numero e data, e l'XML è fatto.
 *  ───────────────────────────────────────────────────────────────────────── */

/** ── CHI EMETTE ────────────────────────────────────────────────────────────
 *  I dati del centro, gli stessi su ogni fattura. Si scrivono una volta nelle
 *  impostazioni della pagina «Fatture» e vivono in `app_config`.
 *  ⚠️ Niente di tutto questo ha un valore inventato di partenza: una P.IVA o un
 *   regime fiscale sbagliati non fanno sbagliare una schermata, fanno scartare
 *   il file dallo SDI — o peggio, lo fanno passare con dentro un dato falso. Il
 *   modulo non lascia emettere finché i campi obbligatori non ci sono. */
export interface DatiAzienda {
  denominazione: string;
  partitaIva: string;
  /** Per le società coincide quasi sempre con la partita IVA. Si tiene a parte
   *  perché nell'XML sono due campi distinti e per le ditte individuali NON
   *  coincidono. */
  codiceFiscale: string;
  /** Codice del regime fiscale nell'XML: RF01 è l'ordinario, cioè quello di
   *  una S.r.l.s. Sta nelle impostazioni e non fisso qui perché è l'unico dato
   *  che cambia da solo — un cambio di regime non deve richiedere un rilascio. */
  regimeFiscale: string;
  indirizzo: string;
  civico: string;
  cap: string;
  comune: string;
  /** Sigla di due lettere. Obbligatoria per l'Italia. */
  provincia: string;
  nazione: string;
  /** Iscrizione al registro imprese: facoltativa nell'XML, ma se c'è va scritta
   *  intera — l'ufficio da solo fa scartare il file. */
  reaUfficio: string;
  reaNumero: string;
  /** ── ⚠️ CAPITALE SOCIALE E COMPAGINE NON CI SONO PIÙ ────────────────────
   *  Erano due campi facoltativi del tracciato (`CapitaleSociale`,
   *  `SocioUnico`) e li ho tolti su richiesta del committente. Il tracciato li
   *  ammette assenti — `minOccurs="0"` sull'XSD — e senza di loro l'iscrizione
   *  al registro resta valida: restano ufficio, numero e stato di liquidazione,
   *  che sono gli unici obbligatori. Verificato rivalidando i tre casi contro
   *  lo schema ufficiale.
   *  ⚠️ Chi volesse rimetterli: vanno DENTRO `IscrizioneREA` e in quell'ordine
   *   — Ufficio, NumeroREA, CapitaleSociale, SocioUnico, StatoLiquidazione. Uno
   *   fuori posto fa scartare il file. */
  /** La PEC del centro. Finisce nei contatti dell'emittente e sul foglio
   *  leggibile: è il recapito con cui un cliente o un fornitore risponde a una
   *  fattura, ed è l'unico indirizzo che fa fede. */
  pec: string;
  iban: string;
  /** L'aliquota che si applica di norma. Resta modificabile riga per riga. */
  aliquotaPredefinita: number;
  /** ── DA CHE NUMERO SI PARTE ──────────────────────────────────────────────
   *  ⚠️ ESISTE PER NON SCAVALLARE IL COMMERCIALISTA. Se lui ha già emesso 36
   *   fatture quest'anno e questo archivio ricomincia da 1, in contabilità
   *   arrivano due fatture con lo stesso numero — che è un problema vero, non
   *   un fastidio. Qui si scrive il primo numero libero; da lì in poi
   *   l'archivio va avanti da solo (vedi `prossimoNumero` in archivio.ts, che
   *   prende comunque il massimo fra questo e l'ultimo emesso). */
  primoNumero: number;
  /** L'anno a cui si riferisce `primoNumero`: cambiando anno la numerazione
   *  riparte, come vuole la prassi. */
  annoNumerazione: number;
  /** Sezionale, es. "A". Vuoto = numerazione unica. */
  serie: string;
}

export const AZIENDA_VUOTA: DatiAzienda = {
  denominazione: "",
  partitaIva: "",
  codiceFiscale: "",
  //  L'ordinario: è il regime di una S.r.l.s., che è la forma di questo centro.
  //  Resta cambiabile — è una casella, non una costante.
  regimeFiscale: "RF01",
  indirizzo: "",
  civico: "",
  cap: "",
  comune: "",
  provincia: "",
  nazione: "IT",
  reaUfficio: "",
  reaNumero: "",
  pec: "",
  iban: "",
  aliquotaPredefinita: 22,
  primoNumero: 1,
  annoNumerazione: new Date().getFullYear(),
  serie: "",
};

/** I regimi che si incontrano davvero. L'elenco completo dell'Agenzia ne ha una
 *  ventina, quasi tutti per casi che questo centro non vedrà mai: offrirli
 *  tutti in una tendina vuol dire farne scegliere uno a caso. */
export const REGIMI: { codice: string; nome: string }[] = [
  { codice: "RF01", nome: "Ordinario" },
  { codice: "RF19", nome: "Forfettario" },
  { codice: "RF02", nome: "Contribuenti minimi" },
];

/** ── A CHI SI EMETTE ───────────────────────────────────────────────────────
 *  ⚠️ UN PRIVATO E UN'AZIENDA NON HANNO GLI STESSI CAMPI, e non è una
 *   comodità: nell'XML l'anagrafica di una persona sono `Nome` e `Cognome`,
 *   quella di una società è `Denominazione`, e mettere «Mario Rossi» dentro
 *   Denominazione fa passare il file ma produce una fattura intestata a
 *   un'azienda che non esiste. */
export interface ClienteFattura {
  /** true = azienda o professionista con partita IVA */
  azienda: boolean;
  /** solo per le aziende */
  denominazione: string;
  nome: string;
  cognome: string;
  codiceFiscale: string;
  partitaIva: string;
  indirizzo: string;
  civico: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
  /** ── DOVE LO SDI RECAPITA ───────────────────────────────────────────────
   *  Sette caratteri. `0000000` è il valore giusto per un privato senza canale
   *  telematico: la fattura resta nel suo cassetto fiscale, e a lui si consegna
   *  la copia di cortesia — il foglio leggibile che questa cartella stampa.
   *  ⚠️ Con `0000000` la PEC del cliente, se c'è, va scritta lo stesso: è
   *   l'unico recapito che lo SDI può usare. */
  codiceDestinatario: string;
  pec: string;
}

export const CLIENTE_VUOTO: ClienteFattura = {
  azienda: false,
  denominazione: "",
  nome: "",
  cognome: "",
  codiceFiscale: "",
  partitaIva: "",
  indirizzo: "",
  civico: "",
  cap: "",
  comune: "",
  provincia: "",
  nazione: "IT",
  codiceDestinatario: "0000000",
  pec: "",
};

export interface RigaFattura {
  descrizione: string;
  quantita: number;
  /** al netto dell'IVA, come vuole l'XML */
  prezzoUnitario: number;
  aliquota: number;
}

/** ── LO STATO DI UNA FATTURA ───────────────────────────────────────────────
 *  Due soli, e la differenza è tutta lì: una bozza si cambia e si cancella,
 *  una emessa no — ha un numero, e un numero in mezzo a una serie non si
 *  toglie senza lasciare un buco che il commercialista dovrà spiegare. */
export type StatoFattura = "bozza" | "emessa";

/** ── I MODI IN CUI UN CLIENTE PAGA QUI ─────────────────────────────────────
 *  ⚠️ L'ELENCO VIVE IN UN POSTO SOLO (fatture/modi-di-incasso): lì, accanto a
 *   ogni modo, c'è anche QUALE dato chiedere e DOVE si trova — la guida che
 *   serve a chi compila. Due elenchi paralleli vorrebbero dire, al primo
 *   ritocco, una fattura che dichiara un modo e una schermata che ne offre un
 *   altro. Qui si ri-espone quello che il resto del programma usava già. */
export type { MetodoPagamento } from "./modi-di-incasso";
import { MODI_INCASSO, codiceDelModo, type MetodoPagamento } from "./modi-di-incasso";

/** Come si chiama a schermo, e con che codice viaggia nell'XML. */
export const METODI_PAGAMENTO: {
  chiave: MetodoPagamento;
  titolo: string;
  codice: string;
}[] = MODI_INCASSO.map((m) => ({ chiave: m.chiave, titolo: m.titolo, codice: m.codice }));

export const codiceMetodo = (m?: MetodoPagamento): string => codiceDelModo(m);

export interface Fattura {
  /** "2026-0001" da emessa, "bozza:<idLead>" da bozza. È anche la chiave in
   *  archivio: vedi archivio.ts. */
  id: string;
  stato: StatoFattura;
  /** 0 finché è una bozza */
  numero: number;
  anno: number;
  serie: string;
  /** ── LA DATA DEL DOCUMENTO ──────────────────────────────────────────────
   *  AAAA-MM-GG, "" finché è una bozza.
   *  ⚠️ NON È «OGGI»: è il giorno in cui il pagamento è arrivato. Per una
   *   fattura immediata la data del documento è quella dell'operazione, e per
   *   un acconto l'operazione è l'incasso — non il momento in cui ci si siede a
   *   compilarla. Chi incassa il 28 ed emette il 30 mette 28, e ha dodici giorni
   *   per trasmettere allo SDI.
   *   Per questo `emetti` non guarda l'orologio: gli si passa la data che il
   *   consulente ha dichiarato (vedi `dataPagamento`). */
  data: string;
  /** ── QUANDO SONO ARRIVATI I SOLDI ───────────────────────────────────────
   *  Lo si chiede al momento di emettere, e coincide con `data`: sono lo stesso
   *  giorno visto da due parti. Si tiene un campo suo perché è quello che va
   *  SCRITTO sul foglio («Pagamento ricevuto il 28 agosto 2026») — una fattura
   *  di acconto senza quella riga fa richiamare il cliente per chiedere se il
   *  bonifico è stato visto. */
  dataPagamento: string;
  /** ── ACCONTO O SALDO ────────────────────────────────────────────────────
   *  ⚠️ La distinzione NON è cosmetica e non si può nascondere: una fattura di
   *   acconto e la successiva a saldo si incastrano (il saldo scomputa
   *   l'acconto già fatturato), e se la prima non dice di essere un acconto la
   *   seconda fattura due volte lo stesso imponibile. La causale può essere
   *   commerciale quanto si vuole — «Conferma d'ordine» va benissimo, ed è
   *   quella che il committente ha chiesto — ma l'importo è quello ricevuto e
   *   il tipo resta scritto qui, dove serve ai conti. */
  tipo: "acconto" | "saldo" | "unica";
  leadId: string;
  /** Il nome com'era al momento della bozza: serve all'elenco anche se poi la
   *  scheda del cliente cambia o sparisce. */
  leadNome: string;
  preventivoRef: string;
  cliente: ClienteFattura;
  righe: RigaFattura[];
  causale: string;
  /** Conti congelati al momento del salvataggio: una fattura emessa non deve
   *  cambiare importo perché è cambiata un'aliquota nelle impostazioni. */
  imponibile: number;
  imposta: number;
  totale: number;
  creataIl: string;
  emessaIl: string;
  /** ── L'EMAIL CON CUI LA BOZZA È NATA ────────────────────────────────────
   *  Serve a RITROVARLA. Una bozza preparata dal configuratore del preventivo
   *  non ha ancora una scheda cliente a cui agganciarsi: l'unica cosa stabile è
   *  la persona, e di lei si ha l'email. Riaprendo poi la stessa pratica dal
   *  CRM, la finestra la ritrova da qui invece di far ribattere codice fiscale
   *  e residenza — e soprattutto invece di creare una seconda bozza per lo
   *  stesso cliente. Vedi `leggiBozzaDi` in archivio.ts.
   *  ⚠️ Non finisce su nessun documento: e-mail e PEC sono due cose diverse, e
   *   quella che va nell'XML è `cliente.pec`. */
  emailOrigine?: string;
  /** ── COME È STATA PAGATA ────────────────────────────────────────────────
   *  «contanti» | «bonifico» | «carta». Finisce nell'XML come
   *  `ModalitaPagamento` (MP01, MP05, MP08) e sul foglio leggibile.
   *  Assente = bonifico, che è il modo con cui questo centro incassa quasi
   *  sempre ed è quello che il file scriveva prima che questo campo esistesse:
   *  le fatture già emesse continuano a valere esattamente quello che
   *  valevano. */
  metodoPagamento?: MetodoPagamento;
  /** ── IL RIFERIMENTO DELL'INCASSO ────────────────────────────────────────
   *  Il codice dell'operazione al POS, il CRO del bonifico, il numero della
   *  ricevuta dei contanti: cambia nome a seconda di come ha pagato, e dove
   *  trovarlo lo dice la guida accanto al campo (fatture/modi-di-incasso).
   *  ⚠️ NON È MAI OBBLIGATORIO: una fattura senza questo numero è valida, e
   *   una fattura che non si riesce a emettere perché manca un codice che il
   *   consulente non trova è un cliente che aspetta.
   *  Finisce nell'XML come `CodicePagamento` e sul foglio leggibile. */
  riferimentoPagamento?: string;
}

/** ── DA FATTURA EMESSA A BOZZA ─────────────────────────────────────────────
 *  Toglie a un documento tutto quello che lo rende EMESSO — numero, serie,
 *  data, id, il momento dell'emissione — e lascia intatto tutto il resto:
 *  cliente, righe, causale, importi, metodo di pagamento, e il tipo (acconto o
 *  saldo). Serve a due gesti che sembrano diversi e sono lo stesso: eliminare
 *  una fattura ritrovandosela fra le bozze già compilata, e farne una seconda
 *  per lo stesso cliente.
 *
 *  ⚠️ IL NUMERO NON SI PORTA DIETRO. Lasciarlo scritto su una bozza vorrebbe
 *   dire mostrare «2026/0007» accanto a un documento che in contabilità non
 *   esiste più — e quello stesso numero intanto lo sta per prendere la
 *   prossima fattura, perché la numerazione si ricava dall'archivio e non da
 *   un contatore (vedi `prossimoNumeroSu`). Due documenti con lo stesso numero
 *   sotto gli occhi è il pasticcio che la numerazione esiste per evitare.
 *  ⚠️ `creataIl` TORNA A ORA, e non è un dettaglio: le bozze si ordinano per
 *   quella data. Tenendo la vecchia, una fattura di marzo rimessa in bozza a
 *   ottobre rinascerebbe in fondo all'elenco, cioè dove non la cerca nessuno —
 *   e chi l'ha appena eliminata penserebbe che non sia tornata.
 *  ⚠️ `anno` NON è un dato da conservare: l'anno della numerazione lo decide la
 *   data dell'incasso nel momento in cui si riemette (vedi `emettiSu`). Qui si
 *   mette quello corrente solo perché il campo è un numero e non ammette il
 *   vuoto. */
export function comeBozza(f: Fattura): Fattura {
  return {
    ...f,
    id: `bozza:${f.leadId}`,
    stato: "bozza",
    numero: 0,
    serie: "",
    anno: new Date().getFullYear(),
    data: "",
    dataPagamento: "",
    emessaIl: "",
    creataIl: new Date().toISOString(),
  };
}
