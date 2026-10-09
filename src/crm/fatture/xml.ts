/** ── L'XML CHE IL COMMERCIALISTA IMPORTA ───────────────────────────────────
 *
 *  Formato FatturaPA 1.2.2, tipo trasmissione `FPR12` (fatture fra privati).
 *  È questo il file che vale: il PDF è una copia di cortesia per il cliente,
 *  la fattura per il fisco è l'XML che passa dallo SDI.
 *
 *  ⚠️ QUESTA CARTELLA NON TRASMETTE ALLO SDI. Il file si scarica e si consegna
 *   al commercialista (o si carica nel gestionale/portale che già si usa), che
 *   lo trasmette dal suo canale accreditato. Un XML corretto su un disco non è
 *   una fattura emessa.
 *
 *  ── COME È SCRITTO ────────────────────────────────────────────────────────
 *  A mano, con delle stringhe. Nessuna libreria: il tracciato è fisso, il
 *  documento è piccolo, e una dipendenza in più su un file che deve restare
 *  identico per anni è un rischio, non una comodità.
 *  ⚠️ L'ORDINE DEGLI ELEMENTI NON È NEGOZIABILE. L'XSD dell'Agenzia è a
 *   sequenza: gli stessi campi nell'ordine sbagliato fanno scartare il file
 *   con un codice di errore che non dice quale campo. Le funzioni qui sotto
 *   seguono il tracciato dall'alto al basso, ed è per questo che sono scritte
 *   in modo così lineare invece che con oggetti e cicli.
 *
 *  ⚠️ I NUMERI VANNO CON IL PUNTO E DUE DECIMALI. `toFixed(2)` e mai
 *   `toLocaleString`: in italiano quest'ultimo scrive «1.234,56», che nell'XML
 *   è un numero diverso — o non è un numero affatto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { codiceMetodo } from "./tipi";
//  Quali modi di incasso vogliono l'IBAN nel file: la regola sta lì.
import { vuoleIban } from "./modi-di-incasso";
import type { ClienteFattura, DatiAzienda, Fattura, RigaFattura } from "./tipi";

/** ── SOLO LETTERE CHE IL TRACCIATO ACCETTA ────────────────────────────────
 *  ⚠️ QUESTA FUNZIONE ESISTE PER UN FILE SCARTATO. L'XSD dell'Agenzia limita il
 *   testo a `[\p{IsBasicLatin}\p{IsLatin-1Supplement}]`, cioè ASCII più i
 *   caratteri accentati europei — e basta. Tutto il resto fa fallire la
 *   validazione con un errore che parla di «pattern» e non dice quale carattere.
 *
 *   Il colpevole tipico è invisibile: il trattino lungo. Le causali di questo
 *   CRM lo usano ovunque («Conferma d'ordine — impianto su misura»), lo mettono
 *   le tastiere Mac da sole, e lo inserisce la correzione automatica al posto di
 *   due trattini. Stessa storia per le virgolette curve e i puntini di
 *   sospensione. Un documento che a schermo è perfetto viene rifiutato dallo
 *   SDI, e chi lo ha emesso non ha modo di capire perché.
 *
 *   Quindi: i segni tipografici si traducono nel loro equivalente diritto — il
 *   testo resta leggibile — e quello che resta fuori dall'alfabeto ammesso si
 *   toglie. ⚠️ Meglio un carattere in meno che un file rifiutato: una fattura
 *   scartata non è un difetto grafico, è una fattura che non esiste. */
const latino = (v: string): string =>
  v
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[\u2022\u00B7]/g, "-")
    .replace(/\u20AC/g, "EUR")
    //  Tutto ciò che resta fuori da Basic Latin + Latin-1 Supplement se ne va.
    .replace(/[^\u0020-\u00FF\n]/g, "");

/** ── ⚠️ IL TESTO COME LO VEDRÀ IL FILE, PRIMA DI GIUDICARLO ───────────────
 *  `latino` toglie tutto quello che non sta nell'alfabeto ammesso, e fra
 *  quelle cose ci sono dei caratteri INVISIBILI: U+202D e U+202C, i segni di
 *  direzione del testo, che si incollano da soli copiando un numero da un PDF.
 *  Una visura, per dire.
 *
 *  Il problema non è il file — quei segni il file li perde per strada — è il
 *  CONTROLLO: la partita IVA del centro, copiata dalla visura, arriva scritta
 *  «\u202D18486531009\u202C», e un `/^\d{11}$/` su quella stringa dice di no.
 *  Risultato: lo scarico si bloccava dicendo che il codice fiscale non era
 *  valido, mentre a schermo il campo era perfetto e il file che sarebbe uscito
 *  pure. Un controllo che ferma un documento buono si impara a scavalcare, e
 *  da quel momento non ferma più nemmeno quelli sbagliati.
 *  Quindi si giudica la stringa RIPULITA, cioè quella che finirà nel file. */
export const comeNelFile = (v: unknown): string => latino(String(v ?? "")).trim();

/** Testo dentro XML. I nomi dei clienti arrivano da campi scritti a mano, e una
 *  «&» in una ragione sociale rende il file illeggibile allo SDI. */
const x = (v: unknown): string =>
  latino(String(v ?? ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Due decimali, punto come separatore. Il formato che l'XSD si aspetta. */
/** ⚠️ Esportato: lo usa anche il costruttore delle autofatture
 *  (crm/contabilita-autofattura). Due modi di scrivere un numero dentro lo
 *  stesso tracciato sarebbero due file diversi. */
export const n2 = (v: number): string => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);

/** ── LE LUNGHEZZE MASSIME DEL TRACCIATO ───────────────────────────────────
 *  ⚠️ NON SONO CONSIGLI: un carattere in più e l'XSD scarta il file. Una
 *   ragione sociale lunga, un indirizzo con la frazione, una descrizione
 *   scritta con cura — sono tutti casi normali che sforano. Si taglia qui, una
 *   volta sola, invece di sperare che nessuno scriva troppo. */
const MAX: Record<string, number> = {
  Denominazione: 80,
  Nome: 60,
  Cognome: 60,
  Indirizzo: 60,
  NumeroCivico: 8,
  Comune: 60,
  Descrizione: 1000,
  Causale: 200,
  RiferimentoNormativo: 100,
  Email: 256,
};

/** Un tag, ma solo se ha un contenuto: gli elementi facoltativi vuoti fanno
 *  scartare il file tanto quanto quelli obbligatori mancanti. */
/** ⚠️ Esportato per la stessa ragione di `n2`: il taglio alle lunghezze del
 *  tracciato e la transliterazione in latino-1 sono regole del FORMATO, non di
 *  questo file, e valgono uguali per le autofatture. */
export const t = (nome: string, valore: unknown): string => {
  const limite = MAX[nome];
  const v = String(valore ?? "").trim();
  const tagliato = limite ? v.slice(0, limite) : v;
  return tagliato ? `<${nome}>${x(tagliato)}</${nome}>` : "";
};

/** ── IL PROGRESSIVO DI INVIO ───────────────────────────────────────────────
 *  Cinque caratteri alfanumerici che identificano QUESTA trasmissione. Non è il
 *  numero della fattura e non deve esserlo: serve allo SDI per non accettare
 *  due volte lo stesso invio.
 *  Si ricava da anno e numero in base 36, che a parità di fattura dà sempre lo
 *  stesso codice — così ritrasmettere lo stesso file dopo uno scarto non genera
 *  un progressivo nuovo. */
export function progressivoInvio(f: Fattura): string {
  const seme = f.anno * 100000 + f.numero;
  return seme.toString(36).toUpperCase().padStart(5, "0").slice(-5);
}

/** ── IL NOME DEL FILE ──────────────────────────────────────────────────────
 *  Convenzione dell'Agenzia: identificativo del trasmittente (paese + codice)
 *  seguito da un progressivo univoco. È il nome con cui il commercialista se lo
 *  ritrova, quindi vale la pena che sia quello giusto. */
export function nomeFileXml(f: Fattura, a: DatiAzienda): string {
  const id = `${(a.nazione || "IT").toUpperCase()}${(a.partitaIva || "").replace(/\D/g, "")}`;
  return `${id}_${progressivoInvio(f)}.xml`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   I PEZZI
   ═════════════════════════════════════════════════════════════════════════ */

function anagraficaCliente(c: ClienteFattura): string {
  //  ⚠️ Persona o azienda, mai tutti e due: vedi la nota su `ClienteFattura`.
  //   «Mario Rossi» dentro <Denominazione> passa il controllo e produce una
  //   fattura intestata a una società che non esiste.
  return c.azienda
    ? `<Anagrafica>${t("Denominazione", c.denominazione)}</Anagrafica>`
    : `<Anagrafica>${t("Nome", c.nome)}${t("Cognome", c.cognome)}</Anagrafica>`;
}

export function sede(s: {
  indirizzo: string;
  civico: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
}): string {
  //  ⚠️ L'ORDINE È QUELLO: Indirizzo, NumeroCivico, CAP, Comune, Provincia,
  //   Nazione. NumeroCivico e Provincia sono facoltativi, gli altri no.
  return (
    "<Sede>" +
    t("Indirizzo", s.indirizzo) +
    t("NumeroCivico", s.civico) +
    t("CAP", (s.cap || "").replace(/\D/g, "")) +
    t("Comune", s.comune) +
    t("Provincia", (s.provincia || "").toUpperCase().slice(0, 2)) +
    t("Nazione", (s.nazione || "IT").toUpperCase()) +
    "</Sede>"
  );
}

/** ── ⚠️ QUANTO VALE UNA RIGA: SI DECIDE UNA VOLTA SOLA ─────────────────────
 *  Il totale di riga si SCRIVE nel file con due decimali, e da quel momento
 *  quello è il numero: lo SDI somma i `PrezzoTotale` che legge e li confronta
 *  con l'imponibile del riepilogo.
 *
 *  ⚠️ QUI C'ERA UN FILE SCARTATO CHE ASPETTAVA DI SUCCEDERE. Le righe
 *   venivano scritte arrotondate e il riepilogo sommava i valori PIENI: con
 *   tre righe da 33,333 il file diceva 33,33 + 33,33 + 33,33 nelle righe e
 *   100,00 nel riepilogo. Un centesimo di differenza, e lo SDI scarta con
 *   «imponibile non coerente» senza dire dove. Non è un caso di laboratorio:
 *   basta un prezzo diviso per tre, o un'offerta scalata a mano.
 *   Adesso si arrotonda PRIMA e si somma DOPO — le due cose che il file dice
 *   non possono più discostarsi, perché sono lo stesso numero. */
function totaliDiRiga(righe: RigaFattura[]): { riga: RigaFattura; totale: number }[] {
  return righe.map((r) => ({
    riga: r,
    totale: Math.round((Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0) * 100) / 100,
  }));
}

interface Riepilogo {
  aliquota: number;
  imponibile: number;
  imposta: number;
}

function riepiloghiDi(righe: RigaFattura[]): Riepilogo[] {
  const perAliquota = new Map<number, number>();
  for (const { riga, totale } of totaliDiRiga(righe)) {
    perAliquota.set(
      riga.aliquota,
      Math.round(((perAliquota.get(riga.aliquota) ?? 0) + totale) * 100) / 100,
    );
  }
  return [...perAliquota.entries()].map(([aliquota, imponibile]) => ({
    aliquota,
    imponibile,
    imposta: Math.round(imponibile * aliquota) / 100,
  }));
}

/** Il totale del documento: imponibili più imposte, come li scrive il file.
 *  ⚠️ NON si legge `f.totale`. Quel campo è il totale dell'archivio, e sui
 *   documenti vecchi o corretti a mano può non corrispondere più alle righe:
 *   scritto nell'XML produrrebbe un documento che contraddice sé stesso. */
function totaleDocumento(righe: RigaFattura[]): number {
  return (
    Math.round(riepiloghiDi(righe).reduce((s, r) => s + r.imponibile + r.imposta, 0) * 100) / 100
  );
}

function riepilogoPerAliquota(righe: RigaFattura[]): string {
  //  Un blocco per ogni aliquota presente, ed è la parte che lo SDI ricontrolla
  //  da sé: se la somma delle righe non torna con l'imponibile dichiarato qui,
  //  il file viene scartato.
  return riepiloghiDi(righe)
    .map(({ aliquota, imponibile, imposta }) => {
      return (
        "<DatiRiepilogo>" +
        `<AliquotaIVA>${n2(aliquota)}</AliquotaIVA>` +
        //  ⚠️ Ad aliquota zero la NATURA è obbligatoria: senza, lo SDI non sa
        //   PERCHÉ non c'è IVA e scarta. N2.2 è «non soggette — altri casi»,
        //   che è quello del regime forfettario.
        (aliquota === 0 ? "<Natura>N2.2</Natura>" : "") +
        `<ImponibileImporto>${n2(imponibile)}</ImponibileImporto>` +
        `<Imposta>${n2(imposta)}</Imposta>` +
        (aliquota === 0
          ? "<RiferimentoNormativo>Operazione non soggetta a IVA</RiferimentoNormativo>"
          : "<EsigibilitaIVA>I</EsigibilitaIVA>") +
        "</DatiRiepilogo>"
      );
    })
    .join("");
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL DOCUMENTO
   ═════════════════════════════════════════════════════════════════════════ */

export function costruisciXml(f: Fattura, a: DatiAzienda): string {
  const c = f.cliente;
  const idTrasmittente = (a.partitaIva || "").replace(/\s/g, "");
  //  Con un canale telematico si scrive quello; senza, `0000000` e la fattura
  //  resta nel cassetto fiscale del cliente. Sette caratteri sempre.
  //  ⚠️ UN CODICE SBAGLIATO NON SI RADDRIZZA CON DEGLI ZERI. Prima un codice
  //   scritto male — «ABC», sette caratteri scarsi — veniva riempito fino a
  //   «ABC0000»: un codice formalmente valido e di nessuno, con cui il file
  //   parte, viene accettato e non arriva a nessuno. Se il codice non è
  //   esattamente sette caratteri buoni si usa il cassetto fiscale, che è il
  //   recapito giusto quando un canale non c'è: il cliente la sua fattura la
  //   trova comunque.
  const scritto = (c.codiceDestinatario || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const destinatario = scritto.length === 7 ? scritto : "0000000";

  const righe = totaliDiRiga(f.righe)
    .map(({ riga: r, totale: totaleRiga }, i) => {
      return (
        "<DettaglioLinee>" +
        `<NumeroLinea>${i + 1}</NumeroLinea>` +
        t("Descrizione", r.descrizione) +
        `<Quantita>${n2(r.quantita)}</Quantita>` +
        `<PrezzoUnitario>${n2(r.prezzoUnitario)}</PrezzoUnitario>` +
        `<PrezzoTotale>${n2(totaleRiga)}</PrezzoTotale>` +
        `<AliquotaIVA>${n2(r.aliquota)}</AliquotaIVA>` +
        (r.aliquota === 0 ? "<Natura>N2.2</Natura>" : "") +
        "</DettaglioLinee>"
      );
    })
    .join("");

  //  L'iscrizione al registro imprese: o intera o niente (vedi `mancanzeAzienda`).
  //  ⚠️ SENZA CAPITALE SOCIALE E SENZA SOCIO UNICO, per scelta del committente.
  //   Il tracciato li dà per facoltativi (`minOccurs="0"` sull'XSD), quindi il
  //   blocco resta valido con i tre elementi che restano — e i tre casi sono
  //   stati rivalidati contro lo schema ufficiale dopo averli tolti.
  //  ⚠️ Se un giorno tornassero, vanno rimessi in QUESTO ordine: Ufficio,
  //   NumeroREA, CapitaleSociale, SocioUnico, StatoLiquidazione. L'XSD è a
  //   sequenza, e un elemento fuori posto fa scartare il file senza dire quale.
  const rea =
    a.reaUfficio.trim() && a.reaNumero.trim()
      ? "<IscrizioneREA>" +
        t("Ufficio", a.reaUfficio.toUpperCase().slice(0, 2)) +
        t("NumeroREA", a.reaNumero) +
        "<StatoLiquidazione>LN</StatoLiquidazione>" +
        "</IscrizioneREA>"
      : "";

  //  ── I CONTATTI DELL'EMITTENTE ────────────────────────────────────────────
  //   La PEC del centro. ⚠️ VA DOPO `IscrizioneREA` e non prima: dentro
  //   `CedentePrestatore` la sequenza è DatiAnagrafici, Sede,
  //   StabileOrganizzazione, IscrizioneREA, Contatti. Scambiati, il file viene
  //   scartato.
  //  ⚠️ E NON È LA PEC DEL CLIENTE: quella sta in `PECDestinatario`, in cima, ed
  //   è dove lo SDI recapita il documento. Questa è il recapito con cui si
  //   risponde a NOI, e le due non vanno confuse.
  const contatti = a.pec.trim() ? `<Contatti>${t("Email", a.pec)}</Contatti>` : "";

  const pagamento =
    "<DatiPagamento>" +
    //  TP02 = pagamento completo in una soluzione. È il caso di un acconto
    //  incassato o di un saldo: una rata sola, quella lì.
    "<CondizioniPagamento>TP02</CondizioniPagamento>" +
    "<DettaglioPagamento>" +
    //  ⚠️ IL MODO CON CUI HA PAGATO DAVVERO, non più MP05 fisso. Prima ogni
    //   fattura dichiarava «bonifico»: su un incasso in contanti è una
    //   dichiarazione falsa dentro un documento fiscale, e i gestionali la
    //   usano per riconciliare gli estratti conto — un contante cercato in
    //   banca non si trova mai. MP01 contanti, MP05 bonifico, MP08 carta.
    //   Senza il campo resta MP05, che è quello che il file diceva prima: le
    //   fatture già emesse non cambiano significato.
    `<ModalitaPagamento>${codiceMetodo(f.metodoPagamento)}</ModalitaPagamento>` +
    //  ⚠️ Lo stesso totale del documento, non `f.totale`: due cifre diverse
    //   nello stesso file sono la prima cosa che un gestionale segnala.
    `<ImportoPagamento>${n2(totaleDocumento(f.righe))}</ImportoPagamento>` +
    /*  ── ⚠️ L'IBAN SOLO SE SI ASPETTA UN BONIFICO ────────────────────────
        Segnalazione del committente: «se seleziono POS non deve uscire
        pagamento tramite bonifico sulla fattura». Sul foglio era già
        sistemato; qui dentro no — e questo è il documento che va
        all'Agenzia e al commercialista. `DettaglioPagamento` portava l'IBAN
        del centro su OGNI fattura, contanti compresi: è il campo con cui i
        gestionali riconciliano gli estratti conto, e un contante con l'IBAN
        accanto lo si va a cercare in banca, dove non c'è.
        La regola (quali modi vogliono l'IBAN) sta in fatture/modi-di-incasso,
        dove si prova. */
    t("IBAN", vuoleIban(f.metodoPagamento) ? (a.iban || "").replace(/\s/g, "") : "") +
    /*  ⚠️ IL RIFERIMENTO DELL'INCASSO HA UN CAMPO SUO, e non va nella causale:
        `CodicePagamento` è il posto che il tracciato prevede per «il codice a
        cui chi emette riconduce il pagamento» — il codice dell'operazione del
        POS, il CRO del bonifico. Scritto lì, i gestionali lo usano per
        riconciliare l'incasso; scritto dentro una frase, no. */
    t("CodicePagamento", (f.riferimentoPagamento || "").trim().slice(0, 60)) +
    "</DettaglioPagamento>" +
    "</DatiPagamento>";

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<p:FatturaElettronica versione="FPR12"' +
    ' xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"' +
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
    ' xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2' +
    ' http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_v1.2.2.xsd">' +
    "<FatturaElettronicaHeader>" +
    "<DatiTrasmissione>" +
    `<IdTrasmittente><IdPaese>${x((a.nazione || "IT").toUpperCase())}</IdPaese><IdCodice>${x(idTrasmittente)}</IdCodice></IdTrasmittente>` +
    `<ProgressivoInvio>${x(progressivoInvio(f))}</ProgressivoInvio>` +
    "<FormatoTrasmissione>FPR12</FormatoTrasmissione>" +
    `<CodiceDestinatario>${x(destinatario)}</CodiceDestinatario>` +
    //  La PEC si scrive SOLO con destinatario a zeri: con un codice vero lo SDI
    //  recapita là, e i due insieme sono un errore di tracciato.
    (destinatario === "0000000" ? t("PECDestinatario", c.pec) : "") +
    "</DatiTrasmissione>" +
    "<CedentePrestatore>" +
    "<DatiAnagrafici>" +
    `<IdFiscaleIVA><IdPaese>${x((a.nazione || "IT").toUpperCase())}</IdPaese><IdCodice>${x(idTrasmittente)}</IdCodice></IdFiscaleIVA>` +
    t("CodiceFiscale", a.codiceFiscale) +
    `<Anagrafica>${t("Denominazione", a.denominazione)}</Anagrafica>` +
    t("RegimeFiscale", a.regimeFiscale || "RF01") +
    "</DatiAnagrafici>" +
    sede(a) +
    rea +
    contatti +
    "</CedentePrestatore>" +
    "<CessionarioCommittente>" +
    "<DatiAnagrafici>" +
    //  Un privato ha solo il codice fiscale; un'azienda ha la partita IVA e,
    //  quasi sempre, anche il codice fiscale. Si scrive quello che c'è.
    (c.partitaIva.trim()
      ? `<IdFiscaleIVA><IdPaese>${x((c.nazione || "IT").toUpperCase())}</IdPaese><IdCodice>${x(c.partitaIva.replace(/\s/g, ""))}</IdCodice></IdFiscaleIVA>`
      : "") +
    t("CodiceFiscale", (c.codiceFiscale || "").toUpperCase().replace(/\s/g, "")) +
    anagraficaCliente(c) +
    "</DatiAnagrafici>" +
    sede(c) +
    "</CessionarioCommittente>" +
    "</FatturaElettronicaHeader>" +
    "<FatturaElettronicaBody>" +
    "<DatiGenerali>" +
    "<DatiGeneraliDocumento>" +
    //  TD01 è la fattura. ⚠️ NON si usa TD02 («acconto/anticipo su fattura»)
    //   nemmeno per gli acconti: TD02 esiste per casi particolari e i
    //   gestionali lo trattano in modo disomogeneo, mentre una fattura di
    //   acconto ordinaria è a tutti gli effetti una TD01 il cui imponibile è
    //   l'acconto. Che sia un acconto lo dice la causale, e lo sa l'archivio
    //   (vedi `tipo` in tipi.ts) per non fatturarlo due volte al saldo.
    "<TipoDocumento>TD01</TipoDocumento>" +
    "<Divisa>EUR</Divisa>" +
    `<Data>${x(f.data)}</Data>` +
    `<Numero>${x(f.serie ? `${f.serie}/${f.numero}` : String(f.numero))}</Numero>` +
    //  ⚠️ IL TOTALE C'È, E VIENE DALLE RIGHE. È facoltativo per il tracciato,
    //   e prima non veniva scritto: valido, ma diversi gestionali lo cercano
    //   per riconciliare il documento e senza si limitano a dire che la
    //   fattura «non quadra». Calcolato da `totaleDocumento`, cioè dagli
    //   stessi numeri che il file scrive, non può contraddire il riepilogo.
    //   ⚠️ VA QUI, dopo Numero e PRIMA di Causale: la sequenza dell'XSD è
    //    TipoDocumento, Divisa, Data, Numero, [...], ImportoTotaleDocumento,
    //    Arrotondamento, Causale. Spostato di un posto, il file viene scartato.
    `<ImportoTotaleDocumento>${n2(totaleDocumento(f.righe))}</ImportoTotaleDocumento>` +
    //  La causale può andare a capo: si spezza in pezzi da 200 caratteri, che è
    //  il massimo di ogni elemento.
    (f.causale || "")
      .trim()
      .split(/(.{1,200})(?:\s|$)/)
      .filter((p) => p.trim())
      .map((p) => t("Causale", p.trim()))
      .join("") +
    "</DatiGeneraliDocumento>" +
    "</DatiGenerali>" +
    "<DatiBeniServizi>" +
    righe +
    riepilogoPerAliquota(f.righe) +
    "</DatiBeniServizi>" +
    pagamento +
    "</FatturaElettronicaBody>" +
    "</p:FatturaElettronica>"
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL CONTROLLO PRIMA DELLA CONSEGNA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ PERCHÉ ESISTE QUESTA FUNZIONE ──────────────────────────────────────
 *  Il tracciato ha due strati di controlli, e il secondo non si vede.
 *
 *  Il primo è l'XSD: un CAP con dentro una lettera, un codice fiscale scritto
 *  a metà, una data vuota fanno fallire la validazione. Il secondo sono i
 *  controlli dello SDI, che leggono un file formalmente perfetto e lo scartano
 *  lo stesso: un cliente senza né partita IVA né codice fiscale (errore 00417),
 *  una partita IVA con la cifra di controllo sbagliata (00305), una fattura
 *  datata domani (00403).
 *
 *  Il punto è QUANDO lo si scopre. Senza questo controllo il file esce, si
 *  manda al commercialista, lui lo carica, e lo scarto torna indietro giorni
 *  dopo con un codice numerico che non dice quale campo — e nel frattempo la
 *  fattura risulta emessa e non è mai arrivata a nessuno. Con questo controllo
 *  lo si scopre PRIMA, con davanti il nome del campo da riempire.
 *
 *  ⚠️ NON CORREGGE NIENTE. Un codice fiscale sbagliato non si indovina e un
 *   nome mancante non si inventa: si dice cosa manca e ci si ferma. Riempire
 *   da soli un campo obbligatorio è il modo di emettere una fattura giusta
 *   per il tracciato e sbagliata per il fisco.
 *
 *  ⚠️ E NON SOSTITUISCE `mancanzeAzienda` (archivio.ts), che sorveglia i dati
 *   del centro perché non si emetta niente senza. Questa guarda il singolo
 *   documento, cliente compreso, nel momento in cui sta per uscire. */

/** Partita IVA italiana: undici cifre e la cifra di controllo. Lo SDI la
 *  ricalcola, quindi un numero copiato male viene scartato — ed è un errore
 *  facilissimo da fare leggendo una visura. */
export function partitaIvaValida(v: string): boolean {
  const n = comeNelFile(v).replace(/\D/g, "");
  if (!/^\d{11}$/.test(n)) return false;
  let somma = 0;
  for (let i = 0; i < 11; i++) {
    let cifra = Number(n[i]);
    //  Le posizioni pari (la seconda, la quarta…) si raddoppiano, e sopra il 9
    //  si sottrae 9: è l'algoritmo dell'Agenzia, lo stesso di una carta di
    //  credito.
    if (i % 2 === 1) {
      cifra *= 2;
      if (cifra > 9) cifra -= 9;
    }
    somma += cifra;
  }
  return somma % 10 === 0;
}

/** Codice fiscale: sedici caratteri per una persona, undici cifre per chi ha
 *  solo la partita IVA. L'XSD accetta `[A-Z0-9]{11,16}`, lo SDI è più severo. */
const codiceFiscaleValido = (v: string): boolean =>
  /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(v) || /^\d{11}$/.test(v);

const OGGI = () => new Date().toISOString().slice(0, 10);

/** ⚠️ DUE ELENCHI E NON UNO, perché sono due cose diverse: i `bloccanti` sono
 *  i motivi per cui il file verrebbe RIFIUTATO — con quelli non si scarica
 *  niente — gli `avvisi` sono cose che è giusto sapere ma che non impediscono
 *  la consegna. Messi insieme, il primo avviso avrebbe fermato una fattura
 *  perfettamente valida, e chi la deve emettere avrebbe imparato in fretta a
 *  ignorare l'elenco intero. */
export interface EsameXml {
  bloccanti: string[];
  avvisi: string[];
}

/** I motivi per cui questo file verrebbe rifiutato. Ogni voce è scritta per
 *  essere letta da chi deve rimediare, non da chi ha scritto il codice: dice
 *  il campo e dove si corregge. */
export function problemiXml(f: Fattura, a: DatiAzienda): EsameXml {
  const p: string[] = [];
  const avvisi: string[] = [];
  const c = f.cliente;
  //  ⚠️ Si giudica quello che finirà nel file, non quello che sta in archivio:
  //   vedi `comeNelFile`. I caratteri invisibili incollati da un PDF facevano
  //   fallire un controllo su un dato che il file avrebbe scritto benissimo.
  const cfAzienda = comeNelFile(a.codiceFiscale);
  const capAzienda = comeNelFile(a.cap);

  // ── CHI EMETTE ──────────────────────────────────────────────────────────
  if (!a.denominazione.trim()) p.push("Manca la ragione sociale del centro (Dati per la fattura)");
  if (!partitaIvaValida(a.partitaIva))
    p.push(
      `La partita IVA del centro non è valida: «${a.partitaIva || "vuota"}» (Dati per la fattura)`,
    );
  if (cfAzienda && !codiceFiscaleValido(cfAzienda.toUpperCase()))
    p.push(`Il codice fiscale del centro non è valido: «${cfAzienda}»`);
  if (!/^\d{5}$/.test(capAzienda))
    p.push(`Il CAP del centro deve essere di 5 cifre: «${capAzienda || "vuoto"}»`);
  if (!a.indirizzo.trim()) p.push("Manca l'indirizzo del centro");
  if (!a.comune.trim()) p.push("Manca il comune del centro");
  //  L'iscrizione al registro è o intera o assente: metà blocco fa scartare.
  if (!!a.reaUfficio.trim() !== !!a.reaNumero.trim())
    p.push("L'iscrizione REA va scritta per intero (ufficio e numero) oppure lasciata vuota");

  // ── CHI RICEVE ──────────────────────────────────────────────────────────
  const cf = comeNelFile(c.codiceFiscale).toUpperCase();
  const piva = comeNelFile(c.partitaIva);
  if (!cf && !piva)
    p.push(
      `Il cliente non ha né codice fiscale né partita IVA: senza uno dei due lo SDI scarta la fattura (errore 00417)`,
    );
  if (cf && !codiceFiscaleValido(cf)) p.push(`Il codice fiscale del cliente non è valido: «${cf}»`);
  if (piva && !partitaIvaValida(piva)) p.push(`La partita IVA del cliente non è valida: «${piva}»`);
  if (c.azienda && !c.denominazione.trim()) p.push("Manca la ragione sociale del cliente");
  if (!c.azienda && !`${c.nome} ${c.cognome}`.trim()) p.push("Mancano nome e cognome del cliente");
  if (!c.indirizzo.trim()) p.push("Manca l'indirizzo del cliente");
  if (!c.comune.trim()) p.push("Manca il comune del cliente");
  if (!/^\d{5}$/.test(comeNelFile(c.cap)))
    p.push(`Il CAP del cliente deve essere di 5 cifre: «${comeNelFile(c.cap) || "vuoto"}»`);
  //  Un codice destinatario scritto male non blocca — si ripiega sul cassetto
  //  fiscale (vedi `costruisciXml`) — ma è giusto dirlo: chi l'ha scritto
  //  credeva di recapitare la fattura da un'altra parte.
  const dest = comeNelFile(c.codiceDestinatario);
  if (dest && !/^[A-Za-z0-9]{7}$/.test(dest))
    avvisi.push(
      `Il codice destinatario «${dest}» non è di 7 caratteri: la fattura verrà recapitata nel cassetto fiscale del cliente`,
    );

  // ── IL DOCUMENTO ────────────────────────────────────────────────────────
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data || "")) p.push("La fattura non ha una data");
  else if (f.data > OGGI())
    p.push(`La data della fattura è nel futuro (${f.data}): lo SDI la rifiuta`);
  if (!(f.numero > 0)) p.push("La fattura non ha un numero");
  if (f.righe.length === 0) p.push("La fattura non ha righe");
  f.righe.forEach((r, i) => {
    if (!String(r.descrizione ?? "").trim()) p.push(`La riga ${i + 1} non ha una descrizione`);
    if (!(Number(r.quantita) > 0)) p.push(`La riga ${i + 1} ha una quantità a zero`);
    if (!(Number(r.aliquota) >= 0)) p.push(`La riga ${i + 1} ha un'aliquota IVA non valida`);
  });
  if (totaleDocumento(f.righe) <= 0) p.push("Il totale della fattura è zero");

  //  Il totale scritto in archivio e quello che il file dichiara devono
  //  coincidere: se non coincidono il documento è comunque valido — il file
  //  parla da sé — ma qualcuno ha corretto delle righe senza rifare il totale,
  //  e chi lo legge in elenco vede una cifra e nel PDF ne trova un'altra.
  if (f.righe.length > 0 && Math.abs(totaleDocumento(f.righe) - (Number(f.totale) || 0)) > 0.01) {
    avvisi.push(
      `Il totale in archivio (${(Number(f.totale) || 0).toFixed(2)}) non corrisponde alla somma delle righe (${totaleDocumento(f.righe).toFixed(2)}): nel file vale la somma delle righe`,
    );
  }

  return { bloccanti: p, avvisi };
}
