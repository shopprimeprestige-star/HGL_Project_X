/** ── LA CONTABILITÀ DELLA S.R.L.S. ─────────────────────────────────────────
 *
 *  Cosa è entrato, cosa è uscito, cosa va allo Stato, cosa resta davvero.
 *
 *  ── ⚠️ CHE COSA È QUESTO CONTO, E CHE COSA NON È ──────────────────────────
 *  È un conto GESTIONALE: prende i numeri veri di questo CRM — le fatture
 *  emesse, i costi delle pratiche, le spese fisse del mese — e ci applica le
 *  aliquote che il titolare imposta, per rispondere alla domanda «di quello che
 *  ho fatturato, quanto mi resta in mano».
 *  NON è una dichiarazione dei redditi e non la sostituisce. Il conto vero lo
 *  fa il commercialista, e lo fa su cose che questo CRM non sa: acconti già
 *  versati, perdite riportate, ammortamenti, deducibilità parziali, l'IRAP che
 *  ha una base imponibile sua. Questa pagina lo dice a voce alta, e non si
 *  toglie quella scritta per far sembrare il numero più autorevole.
 *
 *  ── ⚠️ PERCHÉ «SCARICABILE» È UNA SCELTA E NON UNA REGOLA ─────────────────
 *  Richiesta del committente, e nasce da un problema vero: certi costi si
 *  pagano davvero ma non abbassano le tasse — un compenso senza documento, un
 *  rimborso non fatturato. Metterli fra i costi deducibili farebbe uscire un
 *  utile imponibile più basso del vero, cioè imposte stimate più basse del
 *  vero: il tipo di errore che si scopre quando arriva la cartella.
 *  Quindi ogni voce ha una spunta, e quello che è segnato NON scaricabile:
 *   1. non entra nel calcolo dell'utile imponibile — le tasse si pagano come se
 *      quel costo non ci fosse;
 *   2. viene sottratto ALLA FINE, per intero, dall'utile dopo le imposte.
 *  Il risultato è l'UTILE REALE: i soldi che restano davvero in cassa.
 *
 *  ── ⚠️ LA DIREZIONE DEGLI ERRORI ──────────────────────────────────────────
 *  Dove il CRM non sa, questo conto sbaglia SEMPRE dalla parte prudente: l'IVA
 *  sugli acquisti non si detrae se non è stata dichiarata voce per voce, e un
 *  costo di cui non si sa niente si considera scaricabile solo perché è la
 *  scelta che il titolare può correggere guardando l'elenco. Un conto che
 *  sbaglia per eccesso di ottimismo fa spendere soldi che non ci sono.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  chiaveVoce,
  esisteRegola,
  momentoDelCosto,
  regolaNelMese,
  type RegoleContabili,
} from "./contabilita-regole";
import type { Fattura } from "./fatture/tipi";
import type { RigaIncasso, VoceCosto } from "./types";

/** ── LE ALIQUOTE ───────────────────────────────────────────────────────────
 *  Si impostano, non si scrivono qui: cambiano per legge, e un numero murato
 *  nel codice diventa sbagliato senza che nessuno se ne accorga.
 *  I valori di partenza sono quelli ordinari per una S.r.l.s. nel 2026. */
export interface Aliquote {
  /** IRES, imposta sul reddito delle società. Ordinaria: 24%. */
  ires: number;
  /** IRAP, aliquota ordinaria: 3,9%. ⚠️ La sua base imponibile vera NON è
   *  l'utile — certi costi del personale non si deducono — quindi qui è una
   *  stima, e la pagina lo dice. */
  irap: number;
  /** L'IVA con cui si scorpora e si detrae. */
  iva: number;
}

export const ALIQUOTE_PREDEFINITE: Aliquote = { ires: 24, irap: 3.9, iva: 22 };

/** ── ⚠️ LE REGOLE SONO USCITE DA QUI, E HANNO PRESO IL TEMPO ──────────────
 *  Qui c'era `RegolaVoce`: una spunta sola per voce. Aveva un guasto che non
 *  si vedeva — cambiandola a settembre si riscriveva anche il conto di marzo —
 *  e adesso vive in `crm/contabilita-regole`, dove ogni voce ha una STORIA di
 *  regole con il mese da cui valgono. Il perché per esteso sta là.
 *  Da qui si importa e basta: due idee di «cosa si scarica» nello stesso
 *  programma sono due contabilità. */
export type { RegolaNelTempo, RegoleContabili } from "./contabilita-regole";

/** Una riga di costo entrata nel conto, con la sua provenienza: serve a
 *  mostrare l'elenco senza dover richiedere di nuovo i dati. */
/** Un costo che entra in contabilità. ⚠️ PORTA LA SUA DATA, ed è la cosa che
 *  rende possibile tutto il resto: senza data non si può sapere quale regola
 *  valeva quando quel costo è stato sostenuto, e la deducibilità tornerebbe a
 *  essere una spunta buona per tutta la storia. */
export interface CostoDatato extends VoceCosto {
  /** ISO YYYY-MM-DD. Vuota = si applica la regola più vecchia (vedi momentoDelCosto). */
  data?: string;
  origine: "pratica" | "mese" | "fornitore" | "pubblicita";
  /** ── CHI O COSA, DENTRO UNA VOCE ────────────────────────────────────────
   *  Aprendo «Impianto 2.010 €» si trovano sette righe che si chiamano tutte
   *  «Impianto»: senza questa, un elenco di righe identiche non risponde alla
   *  domanda per cui lo si è aperto — «di chi sono?».
   *  È il cliente per i costi di una pratica, il mese per le spese fisse, il
   *  numero della fattura per i fornitori. */
  dettaglio?: string;
  /** La scheda da cui viene questo costo, quando ne viene da una. Serve a una
   *  cosa sola: poterci arrivare. Ricavarla dall'id della riga — che è
   *  `<idScheda>:<campo>` — funzionerebbe finché qualcuno non cambia come si
   *  compone quell'id, e allora il collegamento porterebbe altrove senza
   *  smettere di funzionare. */
  leadId?: string;
  /** Per le fatture dei fornitori l'IVA non si stima: si legge dal documento. */
  ivaDelDocumento?: number;
  /** L'imposta da autoliquidare su questo costo (inversione contabile): la
   *  calcola `effettiContabili` in crm/contabilita-fornitori, che è l'unico
   *  posto in cui si decide cosa porta in contabilità un regime. */
  daAutoliquidare?: number;
  /** ── ⚠️ C'È UN DOCUMENTO DIETRO QUESTO COSTO ─────────────────────────
   *  true solo per le fatture dei fornitori CARICATE: di quelle abbiamo il
   *  file, con dentro partita IVA, numero, data e imposta.
   *  Cambia il RIPIEGO, non la regola: una voce di cui nessuno ha detto niente
   *  vale «si scarica, IVA non detratta» — prudente, perché detrarre l'IVA di
   *  un costo senza fattura valida abbassa l'IVA da versare ed è l'errore che
   *  costa. Ma su una fattura che sta in archivio quella prudenza non protegge
   *  da niente: protegge dall'assenza di un documento che invece c'è. Lasciata
   *  così, caricare gli XML non avrebbe dato NESSUN credito IVA finché non si
   *  andava a spuntare fornitore per fornitore — cioè la funzione non serviva.
   *  ⚠️ Una regola scritta a mano vince sempre su questo ripiego: chi sa che
   *   su quel fornitore l'IVA non è detraibile (auto, rappresentanza) la
   *   spegne, e resta spenta. */
  conDocumento?: boolean;
  /** ── ⚠️ LA LEGGE LO VIETA, E NON C'È SPUNTA CHE TENGA ──────────────────
   *  La frase per cui questo costo non si deduce comunque: carburante pagato
   *  in contanti, trasferta in contanti dal 2025. Vedi
   *  `crm/contabilita-tracciabilita`.
   *  ⚠️ VINCE SULLA REGOLA SCRITTA A MANO, ed è l'unica cosa in tutta questa
   *   pagina che lo fa. Le spunte di «cosa si scarica» servono a dire quello
   *   che il programma non può sapere — se un compenso ha una fattura dietro,
   *   se una spesa è inerente. Questo invece si sa: l'articolo 164 comma 1-bis
   *   non ammette che qualcuno la pensi diversamente, e un conto che lasciasse
   *   dedurre quel costo perché la casella era spuntata mostrerebbe imposte più
   *   basse del vero — l'errore che si scopre con la cartella.
   *   Non sparisce però dai costi: si sposta fra i NON deducibili, dove è
   *   visibile e dove abbassa comunque l'utile reale. Perché è uscito davvero. */
  bloccoDiLegge?: string;
  /** ── ⚠️ QUESTA RIGA TOGLIE INVECE DI AGGIUNGERE ────────────────────────
   *  Una nota di credito ricevuta: il fornitore ti ridà dei soldi. Importo,
   *  IVA e imposta autoliquidata arrivano già NEGATIVI da `effettiContabili`,
   *  che è l'unico posto in cui si gira il segno.
   *  Serve qui per una ragione sola e importante: le tre reti di sicurezza di
   *  questo file — i tre `Math.max(0, …)` qui sotto — sono nate per non far
   *  entrare numeri storti da record vecchi o corretti a mano, e senza questa
   *  bandiera azzererebbero in silenzio ogni nota di credito. Il costo
   *  resterebbe intero, l'IVA a credito pure, e le imposte risulterebbero più
   *  basse del dovuto: l'errore che non si scopre da soli, perché il conto
   *  sembra più bello. */
  notaDiCredito?: boolean;
  /** ── ⚠️ QUANTA PARTE DI QUESTO COSTO SI DEDUCE DAVVERO ────────────────
   *  Assente = 100, che è il caso normale e lascia il conto identico a prima.
   *  Ma la legge italiana su certe categorie non dice sì o no, dice UNA
   *  PERCENTUALE, e trattarle come un sì è un errore SEMPRE A PROPRIO
   *  FAVORE — cioè quello che nessuno va a cercare:
   *   · ristoranti, bar e alberghi: 75%  (art. 109 c. 5 TUIR)
   *   · auto non strumentale: 20%        (art. 164 c. 1 lett. b TUIR)
   *   · auto data in uso promiscuo a un dipendente: 70%
   *   · telefonia mobile: 80%            (art. 102 c. 9 TUIR)
   *  Un pranzo da 100 € dedotto per intero abbassa l'imponibile di 25 € più
   *  del dovuto: su cinquanta pranzi l'anno sono milleduecento euro di
   *  imponibile che il commercialista rimette dentro, con le sanzioni.
   *
   *  ⚠️ LA PARTE NON DEDOTTA NON SPARISCE: finisce fra i costi non
   *   scaricabili, quindi le imposte non si abbassano ma i soldi usciti si
   *   vedono lo stesso nell'utile reale. È la stessa regola dei costi senza
   *   documento, applicata a un quarto di costo invece che a tutto.
   *
   *  ⚠️ NON RIGUARDA L'IVA, che ha percentuali sue e diverse (sull'auto la
   *   detrazione è 40% mentre la deduzione è 20%): quella si governa con
   *   `ivaDetraibile` della regola. */
  percentualeDeducibile?: number;
  /** ── ⚠️ E L'IVA HA PERCENTUALI SUE, DIVERSE DA QUELLE DEL COSTO ────────
   *  Assente = 100. Sono due norme diverse e non vanno mai insieme:
   *   · auto non strumentale: il costo si deduce al 20% (art. 164 TUIR) ma
   *     l'IVA si detrae al 40% (art. 19-bis1 lett. c DPR 633/72);
   *   · telefono cellulare: costo all'80%, IVA in base all'uso aziendale —
   *     nella pratica il 50%;
   *   · rappresentanza: il costo si deduce entro un tetto, l'IVA NON si
   *     detrae affatto (art. 19-bis1 lett. h), salvo gli omaggi sotto i 50 €.
   *  Usare una sola percentuale per tutte e due sembra una semplificazione e
   *  invece sbaglia due conti diversi con lo stesso numero.
   *
   *  ⚠️ L'IVA CHE NON SI DETRAE DIVENTA COSTO, e succede da sé: il costo
   *   deducibile si calcola come lordo meno l'IVA ripresa, quindi se se ne
   *   riprende meno ne resta di più dentro al costo. È giusto così — l'IVA
   *   indetraibile segue la sorte della spesa a cui appartiene — e non va
   *   aggiunto nessun conto a parte. */
  percentualeIva?: number;
}

export interface CostoContabile extends CostoDatato {
  scaricabile: boolean;
  /** L'imposta da autoliquidare su questa riga (inversione contabile). */
  ivaAutoliquidata: number;
  /** Se la regola dice che l'IVA di questa voce si detrae. Serve per decidere
   *  se l'autoliquidata va anche a credito o solo a debito. */
  ivaDetraibileVoce: boolean;
  /** IVA contenuta in questo costo, se in quel mese era detraibile. */
  ivaDetraibile: number;
  /** La regola applicata, per poterla mostrare accanto alla riga. */
  daQuandoVale: string;
  /** Perché la legge non lo fa dedurre, quando è il caso. Vuota di norma. */
  bloccoDiLegge?: string;
  /** ── ⚠️ QUESTA RIGA TOGLIE INVECE DI AGGIUNGERE ────────────────────────
   *  Una nota di credito ricevuta: il fornitore ti ridà dei soldi. Importo,
   *  IVA e imposta autoliquidata arrivano già NEGATIVI da `effettiContabili`,
   *  che è l'unico posto in cui si gira il segno.
   *  Serve qui per una ragione sola e importante: le tre reti di sicurezza di
   *  questo file — i tre `Math.max(0, …)` qui sotto — sono nate per non far
   *  entrare numeri storti da record vecchi o corretti a mano, e senza questa
   *  bandiera azzererebbero in silenzio ogni nota di credito. Il costo
   *  resterebbe intero, l'IVA a credito pure, e le imposte risulterebbero più
   *  basse del dovuto: l'errore che non si scopre da soli, perché il conto
   *  sembra più bello. */
  notaDiCredito?: boolean;
}

export interface ContoFiscale {
  /** Quanto è stato FATTURATO nel periodo, al netto dell'IVA. */
  imponibileFatturato: number;
  /** L'IVA delle fatture emesse: è denaro dello Stato che ci è passato dalle
   *  mani, non ricavo. */
  ivaADebito: number;
  /** L'IVA sugli acquisti dichiarati con IVA detraibile. */
  ivaACredito: number;
  /** ── L'IVA AUTOLIQUIDATA (inversione contabile) ───────────────────────
   *  Gli acquisti da fornitori UE e i servizi dall'estero arrivano senza IVA:
   *  l'imposta la si calcola da sé e la si mette a debito E a credito. Se è
   *  interamente detraibile il saldo è zero, ma le due poste ESISTONO e vanno
   *  viste — sono quelle che il commercialista deve riportare nella
   *  liquidazione, e una liquidazione a cui mancano fa saltare i controlli
   *  incrociati con l'esterometro.
   *  ⚠️ Questo numero è già dentro `ivaADebito` e `ivaACredito`: non si somma
   *   una terza volta. Sta qui per poterlo DIRE. */
  ivaAutoliquidata: number;
  /** Quanto va versato di IVA: a debito meno a credito, mai sotto zero — un
   *  credito si porta avanti, non si incassa qui. */
  ivaDaVersare: number;
  /** ── ⚠️ IL CREDITO CHE ARRIVAVA DAL PERIODO PRIMA, E CHE SI PERDEVA ───
   *  Ogni periodo si calcolava da solo, come se prima non fosse successo
   *  niente. Ma un credito IVA non svanisce: si porta al periodo dopo e SI
   *  SOTTRAE da quello che si versa. Un trimestre chiuso con 880 € di credito
   *  e il successivo con 4.224 € da versare fanno 3.344 €, non 4.224 —
   *  e la differenza si versava allo Stato per niente, ogni trimestre.
   *  ⚠️ Il numero lo mette una persona: viene dalla liquidazione precedente
   *   COME È STATA FATTA, che è quella del commercialista e può non
   *   coincidere con la stima di questo programma. Vedi il campo in pagina. */
  creditoPrecedente: number;
  /** ── ⚠️ IL CREDITO IVA CHE AVANZA, E CHE NESSUNO DICEVA ───────────────
   *  Quando l'IVA sugli acquisti supera quella sulle vendite non si versa
   *  niente — e fin qui il conto era giusto. Ma quell'eccedenza NON sparisce:
   *  è un credito che si porta al periodo dopo, e in certi casi si chiede a
   *  rimborso. Mostrando solo «IVA da versare: 0» si lasciava credere che non
   *  ci fosse niente, e un credito dimenticato è denaro dell'azienda che resta
   *  allo Stato. Succede in ogni trimestre in cui si compra molto e si
   *  fattura poco: l'acquisto di magazzino prima della stagione. */
  creditoIvaDaRiportare: number;
  /** I costi che abbassano l'utile imponibile, al netto dell'IVA detratta. */
  costiDeducibili: number;
  /** Quelli che NON lo abbassano: si pagano lo stesso e si sottraggono dopo. */
  costiNonDeducibili: number;
  /** Fatturato netto meno costi deducibili. È la base delle imposte. */
  utileImponibile: number;
  ires: number;
  irap: number;
  /** IRES + IRAP. */
  imposte: number;
  /** Utile imponibile meno le imposte. */
  utileDopoLeImposte: number;
  /** ── GLI INCASSI REGISTRATI SENZA IVA ────────────────────────────────
   *  Richiesta del committente, ed è il gemello dei costi non deducibili.
   *  Sono soldi entrati davvero ma che non passano dal fatturato: non
   *  gonfiano l'imponibile e quindi non fanno pagare imposte, e si ritrovano
   *  alla fine, per intero, dentro l'utile reale.
   *  ⚠️ NON ENTRANO NEMMENO NELL'IVA A DEBITO: senza IVA non c'è imposta da
   *   versare su quell'incasso, ed è tutto il senso di come è stato
   *   registrato. */
  incassiSenzaIva: number;
  /** ⚠️ IL NUMERO CHE CONTA: utile dopo le imposte, meno i costi che non si
   *  scaricano, più gli incassi registrati senza IVA. È quello che resta
   *  davvero in cassa. */
  utileReale: number;
  /** Quanto va allo Stato in tutto: IVA da versare più imposte. */
  alloStato: number;
  righe: CostoContabile[];
}

const c2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** ── IL CONTO ──────────────────────────────────────────────────────────────
 *  `fatture` sono quelle EMESSE nel periodo: è il fatturato, che per una
 *  società è la base su cui si pagano le imposte — non l'incassato. Una
 *  fattura emessa e non ancora pagata le tasse le fa pagare lo stesso, ed è
 *  proprio la cosa che conviene vedere prima che succeda. */
export function calcolaContoFiscale(opzioni: {
  fatture: Fattura[];
  /** Tutti i costi del periodo, ognuno con la sua data e la sua provenienza. */
  costi: CostoDatato[];
  /** Gli incassi registrati «senza IVA»: fuori dal fatturato, dentro l'utile
   *  reale. Vedi `incassiSenzaIva` in ContoFiscale. */
  incassiSenzaIva?: number;
  /** Il credito IVA che arriva dal periodo prima: si sottrae da quello che si
   *  versa. Vedi `creditoPrecedente` in ContoFiscale. */
  creditoPrecedente?: number;
  regole: RegoleContabili;
  aliquote: Aliquote;
}): ContoFiscale {
  const { fatture, costi, regole, aliquote } = opzioni;
  const creditoPrecedente = Math.max(0, Number(opzioni.creditoPrecedente) || 0);
  const incassiSenzaIva = Math.max(0, Number(opzioni.incassiSenzaIva) || 0);

  let imponibileFatturato = 0;
  let ivaADebito = 0;
  for (const f of fatture) {
    imponibileFatturato += Number(f.imponibile) || 0;
    ivaADebito += Number(f.imposta) || 0;
  }

  const righe: CostoContabile[] = costi.map((v) => {
    //  ⚠️ LA REGOLA SI CHIEDE PER LA DATA DEL COSTO, non per oggi: è tutto il
    //   punto di `contabilita-regole`. Un costo di marzo va giudicato con la
    //   regola che valeva a marzo, anche se da settembre è cambiata.
    //  ⚠️ IL GIORNO, NON IL MESE. Qui c'era `meseDi`, e andava bene finché le
    //   regole erano solo mensili. Con una regola che parte a metà mese quel
    //   troncamento la rende INERTE per tutto il mese in cui è stata scritta:
    //   un costo del 25 settembre, ridotto a «2026-09», risulta PRIMA di una
    //   regola che parte il 17, quindi non la vede. Nessun errore, nessun
    //   avviso — solo una regola che non fa niente.
    //   ⚠️ E questa riga non passa da `regolaDi` (che il giorno lo usa già)
    //    perché qui serve distinguere «regola scritta» da «ripiego», per via
    //    del documento: chi tocca questo punto deve ricordarsi di tutti e due.
    const mese = momentoDelCosto(v.data);
    const storia = regole[chiaveVoce(v.titolo)];
    //  Nessuna regola scritta e un documento in mano: l'IVA si detrae. Vedi
    //  `conDocumento` per il perché.
    const r = esisteRegola(storia, mese)
      ? regolaNelMese(storia, mese)
      : v.conDocumento
        ? { da: "0000-00", scaricabile: true, ivaDetraibile: true }
        : regolaNelMese(storia, mese);
    //  ⚠️ La rete che tiene fuori i numeri storti si apre SOLO per le note di
    //   credito, che sono l'unico caso in cui un importo negativo vuol dire
    //   qualcosa. Vedi `notaDiCredito`.
    const grezzo = Number(v.importo) || 0;
    const lordo = v.notaDiCredito ? c2(grezzo) : Math.max(0, grezzo);
    //  ⚠️ L'IVA si SCORPORA dal costo, non si aggiunge: quello che si scrive è
    //   quanto è uscito dal conto corrente, cioè il lordo. Sommarci il 22%
    //   farebbe un costo che nessuno ha pagato.
    //   Sulle fatture dei fornitori invece non si scorpora niente: l'imposta è
    //   scritta nel documento, e un numero letto batte sempre un numero
    //   ricavato — soprattutto quando in fattura le aliquote sono più di una.
    //  ⚠️ Il divieto di legge viene PRIMA della regola scritta: vedi
    //   `bloccoDiLegge` in CostoDatato. Toglie la deduzione e la detrazione
    //   insieme, perché le due norme che lo impongono sono due.
    const vietato = String(v.bloccoDiLegge ?? "").trim();
    /*  ⚠️ La percentuale si applica DOPO aver ricavato l'imposta del
        documento, e non alle aliquote: sono due cose diverse. L'aliquota dice
        quanta imposta c'è dentro il prezzo; questa dice quanta di
        quell'imposta la legge lascia riprendere. Con la percentuale assente
        vale 1, e il conto è identico a prima. */
    const quotaIva = Math.min(100, Math.max(0, v.percentualeIva ?? 100)) / 100;
    const ivaPiena =
      vietato || !r.ivaDetraibile
        ? 0
        : v.ivaDelDocumento != null
          ? c2(v.notaDiCredito ? v.ivaDelDocumento : Math.max(0, v.ivaDelDocumento))
          : c2(lordo - lordo / (1 + aliquote.iva / 100));
    const iva = c2(ivaPiena * quotaIva);
    return {
      ...v,
      importo: lordo,
      scaricabile: vietato ? false : r.scaricabile,
      ivaDetraibile: iva,
      ivaAutoliquidata: c2(
        v.notaDiCredito
          ? Number(v.daAutoliquidare) || 0
          : Math.max(0, Number(v.daAutoliquidare) || 0),
      ),
      ivaDetraibileVoce: vietato ? false : r.ivaDetraibile,
      daQuandoVale: r.da,
      ...(vietato ? { bloccoDiLegge: vietato } : {}),
    };
  });

  let ivaACredito = 0;
  let ivaAutoliquidata = 0;
  let costiDeducibili = 0;
  let costiNonDeducibili = 0;
  for (const r of righe) {
    ivaACredito += r.ivaDetraibile;
    //  ⚠️ L'inversione contabile si conta DUE VOLTE, di proposito: una a
    //   debito e una a credito. Non è un errore ed è tutto il meccanismo —
    //   il fornitore non ha addebitato l'imposta, quindi la si versa e la si
    //   detrae nello stesso momento. Contarla da un lato solo farebbe uscire
    //   un'IVA da versare più alta (o più bassa) del vero di tutta l'imposta.
    //   ⚠️ E si detrae solo se quella voce è detraibile: su un acquisto in
    //    reverse charge non detraibile l'imposta si versa e basta, che è
    //    proprio il caso in cui sbagliare costa.
    //  ⚠️ `if (r.ivaAutoliquidata)` e non `> 0`: su una nota di credito è
    //   negativa, e deve entrare lo stesso — da tutti e due i lati, come
    //   l'originale che sta annullando.
    if (r.ivaAutoliquidata) {
      ivaAutoliquidata += r.ivaAutoliquidata;
      if (r.ivaDetraibileVoce) ivaACredito += r.ivaAutoliquidata;
    }
    //  Il costo che abbassa l'utile è quello AL NETTO dell'IVA che ci siamo
    //  già ripresi: contarla due volte — una in detrazione e una in deduzione —
    //  è l'errore classico, e abbassa le imposte due volte.
    if (r.scaricabile) {
      /*  ⚠️ CON `percentualeDeducibile` ASSENTE LA QUOTA È 1, e queste tre
          righe fanno esattamente quello che faceva l'unica riga di prima:
          era la condizione per aggiungere le percentuali senza spostare di un
          centesimo nessun conto già chiuso. */
      const quota = Math.min(100, Math.max(0, r.percentualeDeducibile ?? 100)) / 100;
      const netto = r.importo - r.ivaDetraibile;
      costiDeducibili += netto * quota;
      //  La parte che la legge non fa dedurre è comunque uscita dal conto:
      //  non abbassa le imposte, ma si vede nell'utile reale.
      costiNonDeducibili += netto * (1 - quota);
    } else costiNonDeducibili += r.importo;
  }

  const utileImponibile = c2(imponibileFatturato - costiDeducibili);
  //  Su una perdita non si pagano IRES e IRAP: portarle a zero è più giusto e
  //  soprattutto non produce un'imposta negativa, che a schermo si legge come
  //  un rimborso che nessuno ha promesso.
  const base = Math.max(0, utileImponibile);
  const ires = c2((base * aliquote.ires) / 100);
  const irap = c2((base * aliquote.irap) / 100);
  const imposte = c2(ires + irap);
  const utileDopoLeImposte = c2(utileImponibile - imposte);
  //  L'autoliquidata entra fra i debiti: è imposta che si dichiara di dovere.
  const debitoTotale = c2(ivaADebito + ivaAutoliquidata);
  //  ⚠️ Il credito che arriva da prima entra qui, insieme a quello del
  //   periodo: per lo Stato sono la stessa cosa — imposta già in mano nostra.
  const saldoIva = c2(debitoTotale - ivaACredito - creditoPrecedente);
  const ivaDaVersare = Math.max(0, saldoIva);
  const creditoIvaDaRiportare = Math.max(0, -saldoIva);

  return {
    imponibileFatturato: c2(imponibileFatturato),
    ivaADebito: debitoTotale,
    ivaACredito: c2(ivaACredito),
    ivaAutoliquidata: c2(ivaAutoliquidata),
    ivaDaVersare,
    creditoPrecedente: c2(creditoPrecedente),
    creditoIvaDaRiportare,
    costiDeducibili: c2(costiDeducibili),
    costiNonDeducibili: c2(costiNonDeducibili),
    utileImponibile,
    ires,
    irap,
    imposte,
    utileDopoLeImposte,
    incassiSenzaIva: c2(incassiSenzaIva),
    utileReale: c2(utileDopoLeImposte - costiNonDeducibili + incassiSenzaIva),
    alloStato: c2(ivaDaVersare + imposte),
    righe,
  };
}

/** ── GLI INCASSI SENZA IVA DI UNA SCHEDA ───────────────────────────────────
 *  Si leggono dal registro di cassa (`payment.incassi`), che è l'unico posto
 *  in cui il modo dell'IVA resta scritto movimento per movimento.
 *
 *  ⚠️ LE SCHEDE VECCHIE NON HANNO IL REGISTRO, e per quelle il conto vale
 *   zero. È il ripiego prudente: un incasso che non si sa com'era registrato
 *   NON si aggiunge all'utile reale — meglio un utile reale più basso del vero
 *   che uno più alto, perché il secondo fa spendere soldi che non ci sono.
 *   Il registro nasce con l'incasso diviso (vedi RigaIncasso in types.ts):
 *   da lì in avanti ogni movimento nuovo è scritto per intero.
 *
 *  ⚠️ `dentro` è lo stesso filtro di periodo del resto della pagina: un altro
 *   filtro qui vorrebbe dire, nella stessa schermata, due idee di «questo
 *   mese». */
export function incassiSenzaIvaDi(
  incassi: RigaIncasso[] | undefined,
  dentro: (data?: string | null) => boolean,
): number {
  if (!Array.isArray(incassi)) return 0;
  return incassi
    .filter((r) => r && r.modoIva === "senza" && dentro(r.data))
    .reduce((s, r) => s + (Number(r.importo) || 0), 0);
}
