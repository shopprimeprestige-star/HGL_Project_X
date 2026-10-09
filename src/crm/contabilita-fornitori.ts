/** ── LE FATTURE DEI FORNITORI ──────────────────────────────────────────────
 *
 *  Si caricano i file che i fornitori mandano, si leggono, e da quel momento
 *  quei costi entrano in contabilità con dentro i numeri VERI: imponibile,
 *  imposta, data, fornitore. Il file originale resta, e si riscarica com'era.
 *
 *  ── ⚠️ SI LEGGE L'XML, NON IL PDF ─────────────────────────────────────────
 *  E non è una scorciatoia: l'XML della fattura elettronica È il documento —
 *  il PDF che arriva per posta è una copia di cortesia, esattamente come lo è
 *  quello che questo CRM stampa. Dall'XML l'imponibile e l'imposta si LEGGONO;
 *  da un PDF andrebbero riconosciuti da un'immagine, cioè indovinati, e un
 *  numero indovinato dentro una liquidazione IVA è peggio di un numero
 *  assente. Chi ha solo la carta scrive la voce a mano: è l'altra strada, ed è
 *  onesta perché si vede che è stata scritta a mano.
 *
 *  ⚠️ I FILE .p7m NON SI APRONO QUI. Sono XML dentro una busta firmata
 *   (CAdES, dati binari): leggerli vuol dire verificare una firma digitale, e
 *   una verifica fatta a metà è peggio che non farla. Il file si estrae dal
 *   portale del proprio gestionale o dal cassetto fiscale, che restituisce
 *   l'XML in chiaro. Lo diciamo, invece di accettarlo e leggere spazzatura.
 *
 *  ── DOVE VIVONO ───────────────────────────────────────────────────────────
 *  In `app_config`, chiave `fattura_forn:<id>`, come tutto il resto di questa
 *  cartella. Dentro c'è il documento letto E il testo originale: un archivio
 *  che tiene i numeri ma butta il file costringe, il giorno della verifica, a
 *  ricercare i file da un'altra parte.
 *  ⚠️ CON UN TETTO. Una fattura elettronica sta in pochi kilobyte, ma niente
 *   impedisce a qualcuno di caricare un file da dieci megabyte: sopra il tetto
 *   si tiene il documento letto e si lascia perdere l'originale, dicendolo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { archivio } from "./fatture/archivio";

/** Oltre questa misura l'originale non si conserva. Duecentomila caratteri
 *  sono una fattura con qualche centinaio di righe: nessuna fattura vera ci
 *  arriva vicino. */
const TETTO_ORIGINALE = 200_000;

export const PREFISSO_FORNITORE = "fattura_forn:";
/** Il file allegato sta in una chiave SUA, non dentro il documento: così
 *  l'elenco si legge senza trascinarsi dietro dei megabyte di PDF a ogni
 *  apertura della pagina. Si va a prenderlo solo quando qualcuno lo scarica. */
export const PREFISSO_ALLEGATO = "fattura_forn_file:";

/** ── ⚠️ COME ARRIVA LA MERCE, E QUINDI COME SI TRATTA L'IVA ───────────────
 *  La tabella è uscita da qui: sta in `crm/contabilita-regimi`, dove ogni
 *  regime porta scritto anche COSA VA FATTO — il tipo documento da trasmettere
 *  allo SDI, l'INTRASTAT, la dogana. Qui c'erano quattro voci e «reverse» ne
 *  teneva insieme tre che in dichiarazione sono cose diverse; il perché per
 *  esteso sta là.
 *  Da qui si importa e basta: due idee di «come si tratta un acquisto estero»
 *  nello stesso programma sono due contabilità. */
export { REGIMI, regimeDi, adempimento, zonaDelPaese, stonatura } from "./contabilita-regimi";
export type { RegimeIva, Regime } from "./contabilita-regimi";
import { PAESI_UE, regimeDi, type RegimeIva } from "./contabilita-regimi";
import { bloccoDiLegge, type MetodoPagamento } from "./contabilita-tracciabilita";
export type { MetodoPagamento } from "./contabilita-tracciabilita";

export interface RigaFornitore {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  aliquota: number;
  totale: number;
}

export interface FatturaFornitore {
  id: string;
  /** Chi l'ha emessa: è anche il TITOLO con cui il costo entra in contabilità,
   *  quindi è su questo nome che si mette la spunta «si scarica». */
  fornitore: string;
  partitaIva: string;
  /** ISO YYYY-MM-DD: da qui esce il mese, e dal mese la regola che valeva. */
  data: string;
  numero: string;
  imponibile: number;
  imposta: number;
  totale: number;
  righe: RigaFornitore[];
  /** Il file com'era. Vuoto = era troppo grande, o è stata scritta a mano. */
  originale: string;
  /** Il nome con cui è stato caricato, per riscaricarla com'era arrivata. */
  nomeFile: string;
  /** true = nessun file XML, l'ha scritta una persona. Va detto: un numero
   *  letto da un documento e un numero digitato non hanno lo stesso peso. */
  aMano: boolean;
  caricataIl: string;

  /** ── ⚠️ È UNA PROFORMA: NON È UNA FATTURA ─────────────────────────────
   *  Il fornitore la manda per farsi pagare, e assomiglia a una fattura in
   *  tutto tranne che nel valore: in Italia una proforma NON è un documento
   *  fiscale. Non si registra, non fa detrarre niente, non fa nascere nessun
   *  obbligo.
   *
   *  ⚠️ E IL DANNO NON È DIMENTICARLA, È REGISTRARLA. Una proforma finita nei
   *   registri IVA è un documento inesistente dentro numeri che devono
   *   quadrare con quelli dell'Agenzia; e quando arriva la fattura vera, lo
   *   stesso acquisto ci sta due volte. Per questo `righeAcquisti`
   *   (crm/contabilita-registri) la salta, e la liquidazione non la conta.
   *  Qui però resta, ed è voluto: i soldi sono usciti davvero e il costo va
   *  seguito. Si vede nell'elenco con scritto che aspetta la definitiva. */
  proforma?: boolean;

  /** ── LE FATTURE ESTERE ──────────────────────────────────────────────── */
  /** Sigla del paese del fornitore: IT, DE, CN, US… Serve a spiegare il
   *  regime, non a deciderlo. */
  paese?: string;
  /** Come si tratta l'IVA di questo acquisto. Assente = «italiana», che è il
   *  caso di tutte le fatture XML lette dallo SDI: quelle l'IVA ce l'hanno
   *  scritta dentro. */
  regime?: RegimeIva;
  /** L'aliquota con cui autoliquidare, quando il regime è l'inversione
   *  contabile: il fornitore estero non la scrive, la mette chi registra. */
  aliquotaReverse?: number;
  /** La valuta del documento originale e il suo importo: una fattura cinese
   *  arriva in dollari, e in contabilità va in euro.
   *  ⚠️ LA CONVERSIONE NON LA FA IL PROGRAMMA. Il cambio da applicare è quello
   *   del giorno dell'operazione, e inventarne uno vorrebbe dire scrivere in
   *   contabilità un numero che non corrisponde a nessun documento. Si scrive
   *   l'importo in euro — quello che è uscito davvero dal conto, o quello che
   *   il commercialista indica — e la valuta originale resta scritta accanto
   *   perché il controllo sia possibile. */
  valuta?: string;
  importoValuta?: number;
  /** Note libere: il numero d'ordine Alibaba, il cambio applicato, la bolletta
   *  doganale a cui si riferisce. */
  note?: string;
  /** true = c'è un file allegato (il PDF), sotto la sua chiave. */
  conAllegato?: boolean;
  /** ── LA PROVA CHE QUEI SOLDI SONO USCITI ──────────────────────────────
   *  La ricevuta PayPal, la contabile del bonifico, l'estratto conto. Sta in
   *  una chiave sua accanto al documento — vedi `chiaveAllegato`.
   *  ⚠️ NON SOSTITUISCE LA FATTURA e non la rimpiazza mai: dice che hai
   *   pagato, non che cosa hai comprato. Ma su un fornitore estero è la carta
   *   che regge la deduzione, ed è l'unico posto dove sta scritto quanti EURO
   *   sono usciti davvero quando il documento è in un'altra valuta. */
  conProvaPagamento?: boolean;
  /** ── ⚠️ LA BOLLETTA DOGANALE, E NON È UN TERZO ALLEGATO QUALUNQUE ──────
   *  Le altre due carte dimostrano; questa PORTA DEI SOLDI. Su un acquisto
   *  extra-UE l'IVA non sta nella fattura del fornitore — sta qui, ed è qui
   *  che diventa detraibile (art. 201 e ss. del codice doganale).
   *
   *  ⚠️ ALLEGARLA NON LA DETRAE. Il file attaccato a questa riga è una prova,
   *   non una registrazione: perché quell'imposta torni indietro la bolletta
   *   va registrata come DOCUMENTO A SÉ, con l'IVA esposta («IVA italiana in
   *   fattura»). Chi si ferma all'allegato ha in mano la carta giusta e non
   *   detrae niente, e non se ne accorge perché la riga sembra completa.
   *   La finestra lo scrive, con la cifra in gioco.
   *
   *  ⚠️ E VA GUARDATO A CHI È INTESTATA: sui pacchi piccoli il corriere
   *   sdogana spesso a nome proprio e poi rifattura. Se l'importatore non sei
   *   tu, quell'IVA non è tua e il documento buono è la fattura del corriere. */
  conBollettaDoganale?: boolean;
  /** ── ⚠️ QUESTO DOCUMENTO PORTA SOLO L'IMPOSTA, NON UN COSTO ────────────
   *  Vale per la BOLLETTA DOGANALE registrata a sé, ed è la riga che evita
   *  l'errore più costoso di tutto il giro dell'importazione.
   *
   *  Il costo della merce è GIÀ registrato: sta sulla fattura del fornitore
   *  estero, dove è entrato per intero. La bolletta viene dopo e serve a una
   *  cosa sola — portare in detrazione l'IVA che la dogana ha incassato.
   *  Registrarla come una fattura normale vorrebbe dire contare il valore
   *  della merce DUE VOLTE fra i costi: una volta dal fornitore e una dalla
   *  dogana. Il risultato è un utile più basso del vero, cioè una
   *  dichiarazione sbagliata a proprio favore — che è il modo peggiore di
   *  sbagliarla.
   *
   *  Quindi: `costo` = 0, `ivaDetraibile` = l'imposta. L'imponibile resta
   *  scritto perché nel REGISTRO degli acquisti ci va (è il valore doganale,
   *  che comprende il trasporto fino al confine e non coincide con quello
   *  della fattura) — ma in contabilità non pesa.
   *
   *  ⚠️ I DAZI, se ci sono, sono un costo vero e vanno su una riga loro:
   *   quasi sempre arrivano già sulla fattura del corriere. */
  soloImposta?: boolean;
  /** ── QUANTA PARTE SE NE DEDUCE, PER LEGGE ─────────────────────────────
   *  Ristoranti 75, auto 20, cellulare 80, spesa personale 0. Assente = 100.
   *  La sceglie la CATEGORIA al momento del caricamento
   *  (crm/contabilita-categorie), e resta correggibile: un furgone davvero
   *  strumentale si deduce al 100%, e chi lo sa lo dice.
   *  ⚠️ Le percentuali e il perche' stanno in un posto solo, con l'articolo
   *   accanto: una percentuale senza la sua norma e' un numero inventato. */
  percentualeDeducibile?: number;
  /** Quanta parte dell'IVA si detrae. Assente = tutta. ⚠️ E' un numero DIVERSO
   *  da `percentualeDeducibile`: sull'auto il costo si deduce al 20% e l'IVA si
   *  detrae al 40%. Il perche' per esteso sta su `percentualeIva` in
   *  crm/contabilita. */
  percentualeIva?: number;
  /** ── ⚠️ L'AUTOFATTURA È STATA TRASMESSA ────────────────────────────────
   *  ISO del giorno in cui QUALCUNO HA CONFERMATO di averla mandata allo SdI.
   *  Non lo scrive il programma da sé, e non è una svista: il CRM prepara il
   *  file ma non ha nessun canale telematico — la trasmissione la fa una
   *  persona, dal cassetto fiscale o dal gestionale dello studio. Segnare
   *  «trasmessa» perché il file è stato costruito vorrebbe dire dichiarare
   *  fatta una cosa che nessuno ha fatto, e su questo adempimento la multa
   *  arriva per OGNI documento non mandato.
   *  Assente = ancora da trasmettere, ed è così che la contano le scadenze. */
  autofatturaTrasmessaIl?: string;
  /** ── ⚠️ È UNA NOTA DI CREDITO ───────────────────────────────────────────
   *  Cioè un rimborso: il fornitore ti RIDÀ dei soldi, o annulla una fattura
   *  che ti aveva mandato. Meta ne emette per gli accrediti pubblicitari,
   *  Amazon per i resi, i fornitori italiani per gli sconti a posteriori.
   *
   *  ⚠️ GLI IMPORTI RESTANO POSITIVI, il segno lo mette la contabilità. Nel
   *   tracciato della fattura elettronica una nota di credito (TD04) porta
   *   numeri POSITIVI: è il tipo documento a dire che vanno sottratti.
   *   L'archivio conserva quello che c'è scritto nel file — altrimenti i
   *   numeri in archivio non corrisponderebbero più al documento accanto — e
   *   `effettiContabili` gira il segno una volta sola, dove si decide cosa
   *   porta in contabilità un documento.
   *
   *  ⚠️ SBAGLIARLA COSTA IN UN VERSO SOLO, ed è il verso peggiore: una nota di
   *   credito contata come un costo GONFIA i costi e GONFIA l'IVA a credito,
   *   cioè fa risultare meno imposte di quelle dovute. È l'errore che non si
   *   scopre da soli, perché il conto sembra più bello. */
  notaDiCredito?: boolean;
  /** ── ⚠️ LA RITENUTA D'ACCONTO TRATTENUTA SU QUESTA FATTURA ──────────────
   *  L'importo in euro, non la percentuale: certe parcelle hanno la ritenuta
   *  su una parte sola dell'imponibile (le spese anticipate non ci vanno), e
   *  ricalcolarla dal 20% darebbe una cifra diversa da quella scritta sul
   *  documento — che è quella che si versa.
   *  ⚠️ NON TOCCA IL COSTO NÉ L'IVA: il perché sta in `crm/contabilita-ritenute`.
   *   Cambia solo quanto esce dal conto verso il professionista, e crea un
   *   debito verso lo Stato da versare entro il 16 del mese dopo. */
  ritenuta?: number;
  /** ── COME È STATA PAGATA ────────────────────────────────────────────────
   *  Assente quasi sempre, ed è giusto così: il metodo si chiede SOLO dove la
   *  legge lo guarda — carburante, trasferte, rappresentanza. Vedi
   *  `crm/contabilita-tracciabilita`, dove sta il perché e la sola regola. */
  metodoPagamento?: MetodoPagamento;
  /** ── A CHI ERA INTESTATA ────────────────────────────────────────────────
   *  Partita IVA e codice fiscale di chi RICEVE, letti dal documento. Servono
   *  a una cosa sola e importante: accorgersi di aver caricato la fattura
   *  sbagliata. Vedi `intestataANoi`. */
  destinatarioPiva?: string;
  destinatarioCf?: string;
}

/** ── ⚠️ QUESTA FATTURA È INTESTATA A NOI? ─────────────────────────────────
 *  Caricando una cartella di XML — che è come si fa, a fine trimestre — è
 *  facilissimo prendere dentro il file sbagliato: una fattura di un'altra
 *  società, una emessa da noi invece che ricevuta, quella del commercialista
 *  di un amico. Nessuna di quelle darebbe errore: entrerebbe come un costo, si
 *  porterebbe dietro la sua IVA in detrazione, e il conto sarebbe sbagliato
 *  senza che niente lo dica.
 *
 *  ⚠️ AVVISA, NON BLOCCA. Le partite IVA in archivio si scrivono in modi
 *   diversi — con gli spazi, con «IT» davanti, con dentro i caratteri
 *   invisibili incollati da un PDF — e un blocco su un confronto fra stringhe
 *   rifiuterebbe fatture giuste. Il confronto si fa sulle sole cifre; se non
 *   combaciano si carica lo stesso e si dice a chi ha caricato di guardarla.
 *  ⚠️ E se il documento non dice a chi è intestata, non si sospetta niente:
 *   l'assenza di un dato non è una prova. */
export function intestataANoi(f: FatturaFornitore, nostraPiva: string, nostroCf: string): boolean {
  const cifre = (v?: string) => String(v ?? "").replace(/\D/g, "");
  const nostri = [cifre(nostraPiva), cifre(nostroCf)].filter((x) => x.length >= 8);
  const suoi = [cifre(f.destinatarioPiva), cifre(f.destinatarioCf)].filter((x) => x.length >= 8);
  if (nostri.length === 0 || suoi.length === 0) return true;
  return suoi.some((x) => nostri.includes(x));
}

/** ── ⚠️ QUESTO XML L'ABBIAMO EMESSO NOI? ──────────────────────────────────
 *  Il gemello di `emessaDaNoi` per i PDF, e serve almeno quanto quello: nella
 *  stessa pagina c'è il pulsante «Scarica gli XML» delle nostre fatture, e
 *  fra quei file e quelli ricevuti dallo SDI non c'è nessuna differenza a
 *  guardarli. Caricarne uno qui farebbe di un ricavo un costo, e dell'IVA a
 *  debito un'IVA a credito.
 *
 *  ⚠️ QUI SI BLOCCA, non si avvisa — al contrario di `intestataANoi`. La
 *   differenza è che quello confronta il DESTINATARIO, dove le partite IVA si
 *   scrivono in mille modi e un blocco rifiuterebbe fatture giuste; questo
 *   confronta chi EMETTE con noi stessi, e se combacia non c'è nessuna lettura
 *   possibile in cui quel documento sia un acquisto. */
export function emessaDaNoi(f: FatturaFornitore, nostraPiva: string, nostroCf: string): boolean {
  const cifre = (v?: string) => String(v ?? "").replace(/\D/g, "");
  const nostri = [cifre(nostraPiva), cifre(nostroCf)].filter((x) => x.length >= 8);
  const sua = cifre(f.partitaIva);
  return sua.length >= 8 && nostri.includes(sua);
}

const n = (v: unknown): number => {
  const x = Number(String(v ?? "").trim());
  return Number.isFinite(x) ? x : 0;
};

/** ── LEGGERE UN XML DI FATTURA ────────────────────────────────────────────
 *  ⚠️ CON `DOMParser` E NON CON DELLE ESPRESSIONI REGOLARI. Costruire un XML a
 *   mano va benissimo — il tracciato è fisso e lo scriviamo noi (fatture/xml) —
 *   ma LEGGERLO no: il file arriva da gestionali diversi, con prefissi di
 *   spazio dei nomi diversi (`p:FatturaElettronica`, `ns2:...`, nessuno), a
 *   capo dove capita, e attributi in ordine libero. Una regex ci prende finché
 *   non arriva il fornitore che usa un prefisso diverso, e allora legge zero
 *   euro senza dirlo.
 *  ⚠️ Si cercano i tag per NOME LOCALE, ignorando il prefisso: è esattamente
 *   il punto per cui serviva un parser vero.
 *
 *  Torna il documento, oppure il motivo per cui non si è potuto leggere: chi
 *  carica un file deve sapere perché non è entrato, non vedere una riga in
 *  meno. */
export function leggiXmlFornitore(
  testo: string,
  nomeFile: string,
): { ok: true; fattura: FatturaFornitore } | { ok: false; motivo: string } {
  const grezzo = String(testo ?? "");
  if (!grezzo.trim()) return { ok: false, motivo: "il file è vuoto" };
  if (!grezzo.trimStart().startsWith("<")) {
    //  ⚠️ DUE MOTIVI DIVERSI PER DUE CASI DIVERSI, e la differenza non è
    //   pedanteria: «estrai l'XML dal gestionale» detto a chi ha trascinato un
    //   file di testo sbagliato lo manda a cercare una cosa che non esiste, e
    //   ci perde mezz'ora. La busta firmata si riconosce dai byte di controllo
    //   che un testo non ha mai.
    /*  ⚠️ I caratteri di controllo sono ESATTAMENTE quello che si sta
        cercando: sono il segno che il file è binario — una busta firmata — e
        non testo. La regola che li vieta esiste per chi se li ritrova dentro
        un'espressione per sbaglio; qui sono il soggetto della domanda. */
    // eslint-disable-next-line no-control-regex
    const pareBinario = /[\u0000-\u0008\u000E-\u001F]/.test(grezzo.slice(0, 400));
    return {
      ok: false,
      motivo: pareBinario
        ? "sembra un file firmato (.p7m): estrai l'XML dal tuo gestionale o dal cassetto fiscale e ricaricalo"
        : "non è un file XML: carica il file della fattura elettronica, non il PDF o la ricevuta",
    };
  }
  if (typeof DOMParser === "undefined") {
    return { ok: false, motivo: "questo browser non sa leggere i file XML" };
  }
  const doc = new DOMParser().parseFromString(grezzo, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return { ok: false, motivo: "il file non è un XML leggibile" };
  }

  /** Tutti gli elementi con quel nome locale, qualunque prefisso abbiano. */
  const tutti = (radice: Element | Document, nome: string): Element[] =>
    Array.from(radice.getElementsByTagName("*")).filter((e) => e.localName === nome);
  const uno = (radice: Element | Document, nome: string): string =>
    tutti(radice, nome)[0]?.textContent?.trim() ?? "";

  const cedente = tutti(doc, "CedentePrestatore")[0];
  if (!cedente) {
    return {
      ok: false,
      motivo: "non è una fattura elettronica: manca il blocco di chi la emette",
    };
  }
  const anagrafica = tutti(cedente, "Anagrafica")[0];
  const fornitore =
    (anagrafica && uno(anagrafica, "Denominazione")) ||
    [anagrafica && uno(anagrafica, "Nome"), anagrafica && uno(anagrafica, "Cognome")]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Fornitore senza nome";
  const idFiscale = tutti(cedente, "IdFiscaleIVA")[0];
  const partitaIva = idFiscale ? uno(idFiscale, "IdCodice") : "";

  //  A chi è intestata: serve a `intestataANoi`, cioè ad accorgersi del file
  //  sbagliato caricato per sbaglio insieme agli altri.
  const cessionario = tutti(doc, "CessionarioCommittente")[0];
  const idDest = cessionario ? tutti(cessionario, "IdFiscaleIVA")[0] : undefined;
  const destinatarioPiva = idDest ? uno(idDest, "IdCodice") : "";
  const destinatarioCf = cessionario ? uno(cessionario, "CodiceFiscale") : "";

  const generali = tutti(doc, "DatiGeneraliDocumento")[0];
  const data = generali ? uno(generali, "Data") : "";
  const numero = generali ? uno(generali, "Numero") : "";

  /** ── ⚠️ ANCHE L'XML DICE IL SUO REGIME, E CONVIENE ASCOLTARLO ──────────
   *  Finora ogni XML entrava come «italiana», che è giusto per il novanta per
   *  cento dei file dello SDI e SBAGLIATO proprio per quelli che contano: le
   *  autofatture e le integrazioni degli acquisti esteri — TD17, TD18, TD19 —
   *  passano dallo SDI come XML esattamente come le altre. Registrarle come
   *  italiane vuol dire portarsi in detrazione un'imposta che nessuno ha
   *  addebitato, e perdere l'autoliquidazione dall'altro lato.
   *  Il tracciato lo dice in due campi, e si leggono tutti e due:
   *   · `TipoDocumento` — TD17/TD18/TD19 sono per definizione acquisti esteri;
   *   · `IdPaese` di chi emette — se non è IT, quella fattura non porta IVA
   *     italiana, qualunque cosa dica il resto.
   *  ⚠️ RESTA UNA PROPOSTA, come per i PDF: si può riaprire e cambiare. Il
   *   ripiego per un XML senza indizi resta «italiana», che è quello che è. */
  const tipoDocumento = generali ? uno(generali, "TipoDocumento").toUpperCase() : "";
  const paeseCedente = cedente ? uno(tutti(cedente, "IdFiscaleIVA")[0] ?? cedente, "IdPaese") : "";
  //  ⚠️ TD04 è la NOTA DI CREDITO: gli importi sono positivi nel file e vanno
  //   sottratti in contabilità. Vedi `notaDiCredito`. TD05 è la nota di debito
  //   e invece somma, quindi non c'è niente da fare.
  const notaDiCredito = tipoDocumento === "TD04";
  const DAL_TIPO: Record<string, RegimeIva> = {
    TD16: "reverse_interno",
    TD17: "estero_servizi",
    TD18: "ue_beni",
    TD19: "estero_beni_italia",
  };
  const regimeLetto: RegimeIva | undefined =
    DAL_TIPO[tipoDocumento] ??
    (paeseCedente && paeseCedente.toUpperCase() !== "IT"
      ? PAESI_UE.has(paeseCedente.toUpperCase())
        ? "ue_servizi"
        : "estero_servizi"
      : undefined);

  //  ⚠️ IMPONIBILE E IMPOSTA VENGONO DAI RIEPILOGHI, non dalle righe: è il
  //   riepilogo che lo SDI ricontrolla, ed è quello che il commercialista
  //   registra. Le righe servono a raccontare cosa si è comprato.
  let imponibile = 0;
  let imposta = 0;
  for (const r of tutti(doc, "DatiRiepilogo")) {
    imponibile += n(uno(r, "ImponibileImporto"));
    imposta += n(uno(r, "Imposta"));
  }
  const dichiarato = n(uno(doc, "ImportoTotaleDocumento"));
  const c2 = (x: number) => Math.round(x * 100) / 100;
  //  Il totale dichiarato quando c'è — è quello che il fornitore afferma — e
  //  altrimenti la somma dei riepiloghi. Non si sceglie il più alto né il più
  //  basso: si prende quello che il documento dice.
  const totale = dichiarato > 0 ? c2(dichiarato) : c2(imponibile + imposta);

  const righe: RigaFornitore[] = tutti(doc, "DettaglioLinee").map((l) => ({
    descrizione: uno(l, "Descrizione"),
    quantita: n(uno(l, "Quantita")) || 1,
    prezzoUnitario: n(uno(l, "PrezzoUnitario")),
    aliquota: n(uno(l, "AliquotaIVA")),
    totale: n(uno(l, "PrezzoTotale")),
  }));

  if (!data || totale <= 0) {
    return {
      ok: false,
      motivo: "il file non porta una data o un importo leggibile: controlla che sia la fattura",
    };
  }

  return {
    ok: true,
    fattura: {
      //  L'id contiene partita IVA, numero e data: due caricamenti dello stesso
      //  file finiscono sulla stessa chiave e il secondo sostituisce il primo,
      //  invece di sdoppiare il costo. È la stessa protezione della numerazione
      //  delle nostre fatture: la chiave primaria fa da guardia.
      id: idDelDocumento(partitaIva, "", data, numero) || nuovoIdAMano(),
      fornitore,
      partitaIva,
      data,
      numero,
      imponibile: c2(imponibile),
      imposta: c2(imposta),
      totale,
      righe,
      originale: grezzo.length <= TETTO_ORIGINALE ? grezzo : "",
      nomeFile: String(nomeFile ?? "").slice(0, 120),
      aMano: false,
      caricataIl: new Date().toISOString(),
      ...(notaDiCredito ? { notaDiCredito: true } : {}),
      ...(regimeLetto ? { regime: regimeLetto } : {}),
      ...(paeseCedente ? { paese: paeseCedente.toUpperCase() } : {}),
      ...(destinatarioPiva ? { destinatarioPiva } : {}),
      ...(destinatarioCf ? { destinatarioCf } : {}),
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   L'ARCHIVIO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ QUELLO CHE ESCE DALL'ARCHIVIO NON RISPETTA I TIPI ─────────────────
 *  `JSON.parse(...) as FatturaFornitore` è una promessa, non un controllo: in
 *  archivio c'è del TESTO, e basta un record scritto da una versione più
 *  vecchia, corretto a mano o interrotto a metà perché un campo non ci sia.
 *  E qui il campo che manca non produce un numero sbagliato: `f.righe.length`
 *  su un `undefined` fa esplodere il disegno, cioè spegne la pagina della
 *  contabilità — e chi la riapre trova il bianco, senza sapere quale delle
 *  cento fatture l'ha rotta.
 *  Si normalizza QUI, una volta, all'ingresso: da qui in poi chi legge una
 *  fattura può fidarsi della sua forma. È la stessa disciplina delle letture
 *  prudenti di kpi-netto, e per la stessa ragione. */
function normalizza(g: unknown): FatturaFornitore | null {
  if (!g || typeof g !== "object") return null;
  const r = g as Record<string, unknown>;
  const id = String(r.id ?? "");
  if (!id) return null;
  const num = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const righe = Array.isArray(r.righe)
    ? (r.righe as Record<string, unknown>[])
        .filter((x) => !!x && typeof x === "object")
        .map((x) => ({
          descrizione: String(x.descrizione ?? ""),
          quantita: num(x.quantita) || 1,
          prezzoUnitario: num(x.prezzoUnitario),
          aliquota: num(x.aliquota),
          totale: num(x.totale),
        }))
    : [];
  return {
    id,
    fornitore: String(r.fornitore ?? "").trim() || "Fornitore senza nome",
    partitaIva: String(r.partitaIva ?? ""),
    data: String(r.data ?? "").slice(0, 10),
    numero: String(r.numero ?? ""),
    imponibile: num(r.imponibile),
    imposta: num(r.imposta),
    totale: num(r.totale),
    righe,
    originale: typeof r.originale === "string" ? r.originale : "",
    nomeFile: String(r.nomeFile ?? ""),
    aMano: r.aMano === true,
    caricataIl: String(r.caricataIl ?? ""),
    ...(r.paese ? { paese: String(r.paese) } : {}),
    //  ⚠️ Un regime sconosciuto NON diventa «italiana» in silenzio: quello
    //   farebbe detrarre l'IVA di un documento che magari non ne ha. Resta
    //   fuori dai quattro noti, e `effettiContabili` ci ripiega sopra in modo
    //   dichiarato.
    ...(typeof r.regime === "string" ? { regime: r.regime as RegimeIva } : {}),
    ...(r.aliquotaReverse != null ? { aliquotaReverse: num(r.aliquotaReverse) } : {}),
    ...(r.valuta ? { valuta: String(r.valuta) } : {}),
    ...(r.importoValuta != null ? { importoValuta: num(r.importoValuta) } : {}),
    ...(r.note ? { note: String(r.note) } : {}),
    conAllegato: r.conAllegato === true,
    notaDiCredito: r.notaDiCredito === true,
    ...(Number(r.ritenuta) > 0 ? { ritenuta: Number(r.ritenuta) } : {}),
    ...(typeof r.metodoPagamento === "string"
      ? { metodoPagamento: r.metodoPagamento as MetodoPagamento }
      : {}),
    ...(r.destinatarioPiva ? { destinatarioPiva: String(r.destinatarioPiva) } : {}),
    ...(r.destinatarioCf ? { destinatarioCf: String(r.destinatarioCf) } : {}),
  };
}

export async function leggiFornitori(): Promise<{
  ok: boolean;
  lista: FatturaFornitore[];
  errore?: string;
}> {
  try {
    const righe = await archivio.leggiPrefisso(PREFISSO_FORNITORE);
    const lista = righe
      .map((r) => {
        try {
          return normalizza(JSON.parse(r.value));
        } catch {
          return null;
        }
      })
      .filter((f): f is FatturaFornitore => !!f)
      //  Dalla più recente: è l'ordine in cui si guardano le fatture ricevute.
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
    return { ok: true, lista };
  } catch (e) {
    //  ⚠️ Una lettura fallita NON deve somigliare a «non ce ne sono»: chi fa i
    //   conti sottrarrebbe dei costi che ci sono e pagherebbe più imposte del
    //   dovuto, senza sapere perché.
    return {
      ok: false,
      lista: [],
      errore: e instanceof Error ? e.message : "archivio illeggibile",
    };
  }
}

export const salvaFornitore = (f: FatturaFornitore): Promise<string | null> =>
  archivio.scrivi(`${PREFISSO_FORNITORE}${f.id}`, JSON.stringify(f));

export const eliminaFornitore = (f: FatturaFornitore): Promise<string | null> =>
  archivio.elimina(`${PREFISSO_FORNITORE}${f.id}`);

/** ── ⚠️ LA CHIAVE CHE IMPEDISCE DI CONTARE DUE VOLTE LO STESSO COSTO ──────
 *  Partita IVA (o nome), data e numero: due caricamenti dello stesso
 *  documento finiscono sulla STESSA chiave, e il secondo sostituisce il primo
 *  invece di sdoppiare il costo. È la stessa protezione della numerazione
 *  delle nostre fatture: la chiave primaria fa da guardia.
 *
 *  ⚠️ VALE ANCHE PER I PDF, ADESSO. Finché i PDF si scrivevano a mano ogni
 *   salvataggio prendeva un id casuale, e caricare due volte la stessa fattura
 *   faceva due costi. Andava quasi bene, perché scrivere a mano dodici campi
 *   due volte non capita. Da quando il PDF si legge da solo capita eccome: si
 *   ricarica la cartella del mese, e il secondo giro raddoppia il trimestre.
 *
 *  ⚠️ SENZA NUMERO NON SI FA NESSUNA CHIAVE, e torna stringa vuota. Due
 *   fatture dello stesso fornitore nello stesso giorno senza numero
 *   finirebbero sulla stessa chiave, e la seconda cancellerebbe la prima: un
 *   costo sparito in silenzio è peggio di un costo contato due volte, perché
 *   il secondo si vede. */
export function idDelDocumento(
  partitaIva: string,
  fornitore: string,
  data: string,
  numero: string,
): string {
  const num = String(numero ?? "").replace(/\W/g, "");
  if (!num || !data) return "";
  const chi =
    String(partitaIva ?? "").replace(/\W/g, "") ||
    String(fornitore ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 24);
  if (!chi) return "";
  return `${chi}-${data}-${num}`;
}

/** Un id per una fattura di cui non si può costruire una chiave stabile. */
export const nuovoIdAMano = (): string =>
  `mano-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ═══════════════════════════════════════════════════════════════════════════
   L'ALLEGATO — il PDF, per le fatture che un XML non ce l'hanno
   ═════════════════════════════════════════════════════════════════════════ */

/** Due megabyte: una fattura in PDF sta in poche decine di kilobyte, e un file
 *  più grosso di così è una scansione a piena risoluzione — che si può ridurre
 *  prima di caricarla. Il tetto è sul file, non sul base64 che lo rappresenta. */
export const TETTO_ALLEGATO = 2 * 1024 * 1024;

/** ── ⚠️ PERCHÉ IL FILE STA IN `app_config` E NON NELLO STORAGE ────────────
 *  Perché i bucket che questo progetto ha sono PUBBLICI — servono a foto e
 *  video che devono essere raggiungibili da un link, e vanno benissimo per
 *  quello. Una fattura d'acquisto no: dentro c'è chi sono i fornitori, quanto
 *  si compra e a che prezzo, cioè la cosa che un concorrente pagherebbe per
 *  sapere. Metterla in un bucket pubblico vuol dire che chiunque indovini
 *  l'indirizzo la legge, e non c'è nessun avviso quando succede.
 *  `app_config` è la tabella dove stanno già le fatture emesse: è protetta
 *  dalle stesse regole, e ci si arriva solo da dentro il CRM.
 *
 *  ⚠️ IN UNA CHIAVE SUA, e non dentro il documento: l'elenco delle fatture si
 *   legge a ogni apertura della pagina, e trascinarsi dietro i PDF vorrebbe
 *   dire scaricare dei megabyte per mostrare delle righe di testo. Il file si
 *   va a prendere solo quando qualcuno lo scarica.
 *
 *  Un giorno, con un bucket privato e delle rotte firmate, questo sarà il
 *  posto sbagliato. Quel giorno si sposta: la forma del dato è già giusta. */
export interface Allegato {
  /** Il file in base64, senza il prefisso `data:`. */
  contenuto: string;
  nome: string;
  tipo: string;
}

/** ── DUE ALLEGATI, NON UNO ────────────────────────────────────────────────
 *  · «documento» è la fattura, la ricevuta, il foglio del fornitore;
 *  · «pagamento» è la PROVA che quei soldi sono usciti: la ricevuta PayPal,
 *    la contabile del bonifico, l'estratto conto.
 *
 *  ⚠️ SONO DUE COSE DIVERSE E SERVONO TUTTE E DUE. Il documento dice CHE COSA
 *   hai comprato, la prova di pagamento dice CHE L'HAI PAGATO — e in una
 *   verifica è la seconda a reggere la deduzione di un costo pagato a un
 *   fornitore estero, che nessun'altra carta dimostra. Su un pagamento in
 *   valuta è anche l'unico posto dove sta scritto quanti EURO sono usciti
 *   davvero dal conto, cambio e commissioni comprese.
 *
 *  ⚠️ IL DOCUMENTO TIENE LA CHIAVE DI PRIMA, senza suffisso: gli allegati già
 *   caricati stanno lì, e cambiargliela vorrebbe dire farli sparire tutti in
 *   silenzio il giorno del rilascio. */
export type QualeAllegato = "documento" | "pagamento" | "dogana";

const chiaveAllegato = (id: string, quale: QualeAllegato = "documento") =>
  `${PREFISSO_ALLEGATO}${id}${quale === "documento" ? "" : `:${quale}`}`;

export const leggiAllegato = async (
  id: string,
  quale: QualeAllegato = "documento",
): Promise<Allegato | null> => {
  const grezzo = await archivio.leggi(chiaveAllegato(id, quale));
  if (!grezzo) return null;
  try {
    return JSON.parse(grezzo) as Allegato;
  } catch {
    return null;
  }
};

export const salvaAllegato = (
  id: string,
  a: Allegato,
  quale: QualeAllegato = "documento",
): Promise<string | null> => archivio.scrivi(chiaveAllegato(id, quale), JSON.stringify(a));

export const eliminaAllegato = (
  id: string,
  quale: QualeAllegato = "documento",
): Promise<string | null> => archivio.elimina(chiaveAllegato(id, quale));

/** ── COSA PORTA IN CONTABILITÀ UNA FATTURA, SECONDO IL SUO REGIME ─────────
 *  Un posto solo per questa regola, perché la sbaglia chi la scrive due volte.
 *
 *  · `costo`            quanto è uscito davvero, ed è il costo deducibile;
 *  · `ivaDetraibile`    l'imposta che si porta in detrazione da QUESTO
 *                       documento;
 *  · `ivaAutoliquidata` l'imposta da mettere a debito E a credito insieme
 *                       (inversione contabile). Non è denaro uscito: è una
 *                       partita di giro che deve comparire in tutti e due i
 *                       lati della liquidazione, o l'IVA da versare esce
 *                       sbagliata da una parte sola.
 *
 *  ⚠️ SULL'IMPORTAZIONE L'IVA DETRAIBILE È ZERO, e non è una dimenticanza: la
 *   fattura di un fornitore cinese non contiene IVA italiana. Quella si paga in
 *   dogana ed è la BOLLETTA doganale a renderla detraibile. Detrarla qui
 *   vorrebbe dire portarsi in detrazione un'imposta che nessuno ha ancora
 *   versato — ed è la contestazione più facile che ci sia. */
export function effettiContabili(f: FatturaFornitore): {
  costo: number;
  ivaDetraibile: number;
  ivaAutoliquidata: number;
  /** La frase per cui questo costo non si deduce, quando la legge lo vieta a
   *  prescindere dalle spunte: vedi `crm/contabilita-tracciabilita`. Vuota nel
   *  caso normale, che è quasi sempre. */
  bloccato: string;
} {
  const r = regimeDi(f.regime ?? "italiana");
  /*  ── ⚠️ IL SEGNO, IN UN POSTO SOLO ────────────────────────────────────
      Una nota di credito toglie invece di aggiungere: toglie costo, toglie
      IVA detraibile e — se era in inversione contabile — toglie anche
      l'imposta autoliquidata da tutti e due i lati. Girare il segno qui, dove
      si decide cosa porta in contabilità un documento, vuol dire che nessun
      altro punto del programma deve ricordarselo. */
  const segno = f.notaDiCredito ? -1 : 1;
  const bloccato = bloccoDiLegge(
    f.metodoPagamento,
    f.fornitore,
    f.note,
    f.righe.map((x) => x.descrizione).join(" "),
  );
  const c2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

  /*  ── ⚠️ UNA PROFORMA NON MUOVE L'IVA, IN NESSUNA DIREZIONE ─────────────
      Non fa detrarre — non è una fattura — e soprattutto NON si autoliquida:
      su una proforma di un fornitore estero in inversione contabile, senza
      questa riga il programma calcolerebbe un'imposta a debito su un
      documento che per il fisco non esiste, e la liquidazione del trimestre
      uscirebbe più alta del dovuto. Poi arriva la fattura vera e la stessa
      imposta viene contata una seconda volta.
      Il COSTO invece resta: i soldi sono usciti dal conto, e in contabilità
      quel movimento c'è. È la differenza fra «non è ancora registrabile» e
      «non è ancora successo». */
  if (f.proforma) {
    return { costo: c2(f.totale * segno), ivaDetraibile: 0, ivaAutoliquidata: 0, bloccato };
  }

  /*  ── ⚠️ LA BOLLETTA DOGANALE PORTA L'IMPOSTA E BASTA ───────────────────
      Il costo della merce sta già sulla fattura del fornitore: contarlo
      anche qui vorrebbe dire due volte lo stesso acquisto fra i costi. Vedi
      `soloImposta` qui sopra. */
  if (f.soloImposta) {
    return {
      costo: 0,
      ivaDetraibile: bloccato ? 0 : c2(f.imposta * segno),
      ivaAutoliquidata: 0,
      bloccato,
    };
  }

  if (r.autoliquida) {
    //  L'imponibile è quello che il fornitore ha chiesto; l'imposta la si
    //  calcola con l'aliquota indicata da chi registra.
    //  ⚠️ Su una fattura estera il fornitore non addebita IVA, quindi
    //   `imposta` è zero e `totale` coincide con l'imponibile: si prende il
    //   primo che c'è, e non la somma dei due, o su un record vecchio scritto
    //   con l'imposta compilata per sbaglio si autoliquiderebbe due volte.
    const imponibile = c2(f.imponibile > 0 ? f.imponibile : f.totale);
    const aliquota = Number(f.aliquotaReverse) || 22;
    return {
      costo: c2(imponibile * segno),
      ivaDetraibile: 0,
      ivaAutoliquidata: c2(((imponibile * aliquota) / 100) * segno),
      bloccato,
    };
  }
  //  ⚠️ SOLO CHI ESPONE L'IVA FA DETRARRE. Importazione, «senza», e un regime
  //   sconosciuto arrivato da una versione futura portano il costo e nessuna
  //   detrazione. Il ripiego va sempre dalla parte che non si può contestare:
  //   detrarre un'imposta che forse non c'è è l'errore che costa, non
  //   detrarne una che c'è.
  //  ⚠️ SULL'IMPORTAZIONE L'IVA DETRAIBILE È ZERO, e non è una dimenticanza:
  //   la fattura di un fornitore cinese non contiene IVA italiana. Quella si
  //   paga in dogana ed è il documento doganale a renderla detraibile.
  if (!r.detrae)
    return { costo: c2(f.totale * segno), ivaDetraibile: 0, ivaAutoliquidata: 0, bloccato };
  //  ⚠️ Il blocco toglie anche la DETRAZIONE, non solo la deduzione: sul
  //   carburante pagato in contanti l'articolo 19-bis1 vieta l'una e
  //   l'articolo 164 l'altra. Lasciarne in piedi una sola sarebbe metà regola.
  return {
    costo: c2(f.totale * segno),
    ivaDetraibile: bloccato ? 0 : c2(f.imposta * segno),
    ivaAutoliquidata: 0,
    bloccato,
  };
}
