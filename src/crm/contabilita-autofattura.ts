/** ── LE AUTOFATTURE E LE INTEGRAZIONI: TD17, TD18, TD19 ────────────────────
 *
 *  È l'unico documento ufficiale che questo programma può produrre davvero, e
 *  serve ogni mese: per ogni fattura estera ricevuta bisogna rimandare allo
 *  SDI un file che dice «su questo acquisto l'IVA la metto io». Senza, la
 *  sanzione arriva anche avendo pagato tutto il dovuto.
 *
 *  Non è un formato nuovo: è la STESSA fattura elettronica che questo CRM già
 *  costruisce e valida per le vendite, con il tracciato girato al contrario.
 *
 *  ── ⚠️ CHI STA DA CHE PARTE, CHE È TUTTO ──────────────────────────────────
 *  In una nostra fattura di vendita il `CedentePrestatore` siamo noi. Qui NO:
 *   · `CedentePrestatore`     = il FORNITORE ESTERO, quello che ci ha venduto;
 *   · `CessionarioCommittente` = NOI, che compriamo e che l'imposta la mettiamo.
 *  Scambiarli produce un file formalmente valido che dichiara una VENDITA
 *  all'estero mai avvenuta. È l'errore che questo file esiste per non fare, e
 *  il motivo per cui i due blocchi qui sotto sono commentati uno per uno.
 *
 *  ── ⚠️ IL FILE SI MANDA A NOI STESSI ──────────────────────────────────────
 *  Il destinatario è il cessionario, e il cessionario siamo noi: il
 *  `CodiceDestinatario` è il nostro, non quello del fornitore. Senza un canale
 *  proprio si usano i sette zeri con la nostra PEC, e il documento si trova nel
 *  nostro cassetto fiscale — che è esattamente dove deve stare.
 *
 *  ── ⚠️ QUELLO CHE NON SI INVENTA ──────────────────────────────────────────
 *  Il tracciato PRETENDE la partita IVA del fornitore e un indirizzo. La
 *  partita IVA non si inventa: senza, il file non si costruisce e si dice cosa
 *  manca (vedi `problemiAutofattura`). L'indirizzo sì, ed è una scelta
 *  dichiarata: di un fornitore estero quasi nessuno ha la via, il tracciato
 *  non ammette di ometterla, e i gestionali mettono il paese con dei valori
 *  generici. Si fa lo stesso, e lo si scrive nella pagina — così chi vuole
 *  l'indirizzo vero sa che va messo a mano.
 *  ───────────────────────────────────────────────────────────────────────── */
import { comeNelFile, n2, partitaIvaValida, sede, t } from "./fatture/xml";
import type { DatiAzienda } from "./fatture/tipi";
import { nomeDelPaese, regimeDi } from "./contabilita-regimi";
import type { FatturaFornitore } from "./contabilita-fornitori";

/** L'imponibile su cui si autoliquida: quello che il fornitore ha chiesto. */
const imponibileDi = (f: FatturaFornitore): number =>
  Math.round((f.imponibile > 0 ? f.imponibile : f.totale) * 100) / 100;

const aliquotaDi = (f: FatturaFornitore): number => Number(f.aliquotaReverse) || 22;

/** L'imposta che ci si autoliquida, arrotondata una volta sola: è il numero
 *  che finisce sia nel riepilogo sia — dopo — nella liquidazione. */
export const impostaDi = (f: FatturaFornitore): number =>
  Math.round(((imponibileDi(f) * aliquotaDi(f)) / 100) * 100) / 100;

/** ── ⚠️ IL NUMERO DELL'AUTOFATTURA È NOSTRO, NON DEL FORNITORE ────────────
 *  Va in un sezionale a parte: mescolarlo alla numerazione delle vendite
 *  creerebbe due documenti diversi con lo stesso numero, e la numerazione
 *  delle fatture emesse deve restare continua e senza buchi.
 *  Si costruisce dal documento del fornitore, così è STABILE: ritrasmettere lo
 *  stesso acquisto non produce un numero nuovo, e due acquisti diversi non
 *  finiscono mai sullo stesso.
 *  ⚠️ Il commercialista può volerlo in un suo sezionale: è scritto nella
 *   pagina, perché lo cambi prima di trasmettere e non dopo. */
export function numeroAutofattura(f: FatturaFornitore): string {
  const anno = String(f.data ?? "").slice(0, 4) || "0000";
  const suo = String(f.numero ?? "").replace(/[^A-Za-z0-9]/g, "");
  const coda = (suo || String(f.id).replace(/[^A-Za-z0-9]/g, "")).slice(-11);
  return `AF${anno}-${coda}`.slice(0, 20);
}

/** ── ⚠️ IL PROGRESSIVO D'INVIO DEVE ESSERE UNICO ──────────────────────────
 *  Cinque caratteri che identificano LA TRASMISSIONE, non il documento: lo SDI
 *  rifiuta un secondo file con lo stesso progressivo dello stesso trasmittente.
 *
 *  Qui c'era «le ultime cinque cifre del numero», e sembrava innocuo. Non lo
 *  era: la fattura Meta n. 250918473921, una n. INV-9873921 e una n. 73921
 *  finiscono TUTTE su «73921». La prima passa, le altre due tornano indietro
 *  come duplicate — e a scoprirlo si è il 15 del mese.
 *  Adesso si ricava da tutta l'identità del documento (partita IVA del
 *  fornitore, data, numero) con una firma in base 36. Resta STABILE — lo
 *  stesso acquisto dà sempre lo stesso progressivo, quindi ritrasmettere dopo
 *  uno scarto non ne genera uno nuovo — e due acquisti diversi non ci
 *  finiscono sopra se non per una coincidenza su sessanta milioni. */
export function progressivoAutofattura(f: FatturaFornitore): string {
  const identita = [
    comeNelFile(f.partitaIva).replace(/\W/g, "").toUpperCase(),
    String(f.data ?? ""),
    String(f.numero ?? ""),
    String(f.id ?? ""),
  ].join("|");
  //  FNV-1a: poche righe, nessuna dipendenza, e sparpaglia abbastanza da non
  //  far combaciare due documenti che si somigliano.
  let h = 0x811c9dc5;
  for (let i = 0; i < identita.length; i++) {
    h ^= identita.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).toUpperCase().slice(-5).padStart(5, "0");
}

/** Il nome del file, come lo vuole lo SDI: paese + identificativo + progressivo. */
export function nomeFileAutofattura(f: FatturaFornitore, a: DatiAzienda): string {
  const noi = comeNelFile(a.partitaIva).replace(/\W/g, "");
  return `IT${noi}_${progressivoAutofattura(f)}.xml`;
}

/** ── COSA IMPEDISCE DI COSTRUIRLA ─────────────────────────────────────────
 *  Come `problemiXml` per le fatture emesse: si guarda PRIMA, e ci si ferma
 *  con davanti il nome di quello che manca. Un file scartato dallo SDI torna
 *  indietro con un codice e nessuna spiegazione. */
export function problemiAutofattura(f: FatturaFornitore, a: DatiAzienda): string[] {
  const p: string[] = [];
  const r = regimeDi(f.regime ?? "italiana");
  if (!r.tipoDocumento) {
    p.push(
      r.daPrecisare
        ? "il regime è quello generico: scegli se sono beni o servizi, UE o extra-UE"
        : "questo acquisto non richiede nessun documento da trasmettere",
    );
  }
  if (!comeNelFile(f.partitaIva).replace(/\W/g, "")) {
    p.push("manca la partita IVA del fornitore, e il tracciato la pretende");
  }
  if (!f.paese?.trim()) p.push("manca il paese del fornitore");
  if (!f.fornitore.trim()) p.push("manca il nome del fornitore");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data || "")) p.push("manca la data del documento");
  if (imponibileDi(f) <= 0) p.push("l'imponibile è zero");
  if (!partitaIvaValida(comeNelFile(a.partitaIva)))
    p.push("la partita IVA del centro non è valida (Dati per la fattura)");
  if (!a.denominazione.trim()) p.push("manca la ragione sociale del centro");
  return p;
}

/** ── ⚠️ LA PARTITA IVA DEL FORNITORE, COME LA VUOLE IL TRACCIATO ──────────
 *  `IdPaese` e `IdCodice` sono due campi separati: una partita IVA europea
 *  scritta per intero — «IE9692928F» — porta il paese incorporato, e lasciarlo
 *  dentro il codice produce «IEIE9692928F». Si toglie se combacia col paese. */
function idFiscale(paese: string, piva: string): { paese: string; codice: string } {
  const pa = paese.trim().toUpperCase().slice(0, 2);
  let codice = comeNelFile(piva)
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (pa && codice.startsWith(pa)) codice = codice.slice(pa.length);
  return { paese: pa, codice };
}

export function costruisciAutofattura(f: FatturaFornitore, a: DatiAzienda): string {
  const r = regimeDi(f.regime ?? "italiana");
  const noi = comeNelFile(a.partitaIva).replace(/\W/g, "");
  const suo = idFiscale(f.paese ?? "", f.partitaIva);
  const imponibile = imponibileDi(f);
  const aliquota = aliquotaDi(f);
  const imposta = impostaDi(f);

  //  Il destinatario siamo NOI: senza un canale proprio, i sette zeri e la
  //  nostra PEC. Vedi la nota in testa al file.
  const pec = comeNelFile(a.pec);

  const descrizione =
    f.righe
      .map((x) => x.descrizione)
      .filter(Boolean)
      .join(" · ") ||
    `Acquisto da ${f.fornitore}${f.numero ? ` n. ${f.numero}` : ""} del ${f.data}`;

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<p:FatturaElettronica versione="FPR12" ' +
    'xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    "<FatturaElettronicaHeader>" +
    "<DatiTrasmissione>" +
    //  Chi trasmette siamo sempre noi, anche quando la fattura è di un altro.
    `<IdTrasmittente><IdPaese>IT</IdPaese>${t("IdCodice", noi)}</IdTrasmittente>` +
    t("ProgressivoInvio", progressivoAutofattura(f)) +
    "<FormatoTrasmissione>FPR12</FormatoTrasmissione>" +
    "<CodiceDestinatario>0000000</CodiceDestinatario>" +
    (pec ? t("PECDestinatario", pec) : "") +
    "</DatiTrasmissione>" +
    /*  ── ⚠️ QUI CI VA IL FORNITORE, NON NOI ─────────────────────────────
        È il punto in cui il tracciato si gira: chi ha ceduto è lui. */
    "<CedentePrestatore>" +
    "<DatiAnagrafici>" +
    `<IdFiscaleIVA>${t("IdPaese", suo.paese)}${t("IdCodice", suo.codice)}</IdFiscaleIVA>` +
    `<Anagrafica>${t("Denominazione", f.fornitore)}</Anagrafica>` +
    /*  ── ⚠️ IL REGIME FISCALE DEL CEDENTE È OBBLIGATORIO ────────────────
        Anche quando il cedente è una società irlandese che di regimi fiscali
        italiani non ne ha nessuno: il tracciato lo pretende (minOccurs=1), e
        senza il file non passa la validazione contro lo schema. Si usa `RF18`
        — «altro» — che è la voce onesta per un soggetto che sotto la nostra
        classificazione non ricade. Metterci `RF01` (ordinario) vorrebbe dire
        attribuire a un estero un regime italiano che non ha.
        ⚠️ QUESTA RIGA L'HA TROVATA LO SCHEMA, non una rilettura: il file era
         ben formato, si apriva, e sarebbe stato scartato dallo SDI. È il
         motivo per cui la validazione contro l'XSD sta nelle prove. */
    "<RegimeFiscale>RF18</RegimeFiscale>" +
    "</DatiAnagrafici>" +
    /*  ⚠️ L'indirizzo generico è una scelta dichiarata: di un fornitore estero
        quasi nessuno ha la via, il tracciato non ammette di ometterla, e i
        gestionali mettono il paese con valori generici. Vedi la testa del file. */
    sede({
      indirizzo: "N.D.",
      civico: "",
      cap: "00000",
      comune: nomeDelPaese(f.paese) || "N.D.",
      provincia: "",
      nazione: suo.paese || "IT",
    }) +
    "</CedentePrestatore>" +
    /*  ── ⚠️ E QUI CI ANDIAMO NOI, CHE COMPRIAMO ────────────────────────── */
    "<CessionarioCommittente>" +
    "<DatiAnagrafici>" +
    `<IdFiscaleIVA><IdPaese>IT</IdPaese>${t("IdCodice", noi)}</IdFiscaleIVA>` +
    t("CodiceFiscale", comeNelFile(a.codiceFiscale).replace(/\W/g, "")) +
    `<Anagrafica>${t("Denominazione", a.denominazione)}</Anagrafica>` +
    "</DatiAnagrafici>" +
    sede({
      indirizzo: a.indirizzo,
      civico: a.civico,
      cap: a.cap,
      comune: a.comune,
      provincia: a.provincia,
      nazione: a.nazione || "IT",
    }) +
    "</CessionarioCommittente>" +
    "</FatturaElettronicaHeader>" +
    "<FatturaElettronicaBody>" +
    "<DatiGenerali><DatiGeneraliDocumento>" +
    `<TipoDocumento>${r.tipoDocumento}</TipoDocumento>` +
    "<Divisa>EUR</Divisa>" +
    t("Data", f.data) +
    t("Numero", numeroAutofattura(f)) +
    `<ImportoTotaleDocumento>${n2(imponibile + imposta)}</ImportoTotaleDocumento>` +
    "</DatiGeneraliDocumento></DatiGenerali>" +
    "<DatiBeniServizi>" +
    "<DettaglioLinee>" +
    "<NumeroLinea>1</NumeroLinea>" +
    t("Descrizione", descrizione) +
    `<PrezzoUnitario>${n2(imponibile)}</PrezzoUnitario>` +
    `<PrezzoTotale>${n2(imponibile)}</PrezzoTotale>` +
    `<AliquotaIVA>${n2(aliquota)}</AliquotaIVA>` +
    "</DettaglioLinee>" +
    "<DatiRiepilogo>" +
    `<AliquotaIVA>${n2(aliquota)}</AliquotaIVA>` +
    `<ImponibileImporto>${n2(imponibile)}</ImponibileImporto>` +
    `<Imposta>${n2(imposta)}</Imposta>` +
    "</DatiRiepilogo>" +
    "</DatiBeniServizi>" +
    "</FatturaElettronicaBody>" +
    "</p:FatturaElettronica>"
  );
}
