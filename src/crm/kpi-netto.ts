// ── IL CONTO DEL NETTO ──────────────────────────────────────────────────────
//  Questo file contiene SOLO calcolo: nessun componente, nessuno stato. Sta
//  accanto a `kpi-calcoli.ts` e non dentro, per una ragione precisa: quel file è
//  la trascrizione fedele del CRM aziendale, incoerenze comprese, e non si
//  tocca. Qui non si cambia nessuna di quelle formule — si SCOMPONE il risultato
//  che producono già.
//
//  ── PERCHÉ SCOMPORRE ──────────────────────────────────────────────────────
//  «Netto € 14.200» è un numero che si può solo accettare per fede. Chi guarda
//  i numeri di un mese vuole poter seguire la sottrazione: è entrato tanto, è
//  uscito tanto per il prodotto, tanto per chi installa, tanto per il taglio,
//  tanto per i viaggi delle pose a domicilio, tanto di pubblicità, tanto di
//  IVA — resta questo. Un margine che non si può
//  ricostruire è un margine di cui, alla prima cifra strana, si smette di
//  fidarsi.
//
//  ── L'IDENTITÀ CHE VA RISPETTATA ──────────────────────────────────────────
//  `netto` di questo file DEVE dare lo stesso numero di
//  `calcolaMetricheGenerali(...).fatturatoNetto` di kpi-calcoli, perché le due
//  cose compaiono nella stessa pagina. Da lì discendono due vincoli che
//  sembrano pignoli e non lo sono:
//   · stessa selezione delle schede (stesso periodo, stessa data di
//     attribuzione, stesso `eConversione`) — per questo si importa, non si
//     riscrive;
//   · stessa conversione dei numeri, cioè `Number(...)` secco. Una lettura più
//     tollerante (che so, "1.500,00" interpretato all'italiana) qui darebbe
//     1500 e là 0, e la stessa pagina mostrerebbe due netti diversi.
//
//  ── I DATI VERI NON RISPETTANO I TIPI ─────────────────────────────────────
//  Le schede arrivano da un archivio importato: `data` può mancare del tutto,
//  `payment.costi` può non essere un oggetto, un importo può essere una stringa
//  o `null`. Ogni lettura qui dentro parte da quel presupposto, perché questo
//  calcolo gira in un `useMemo` al montaggio della pagina: un accesso dato per
//  scontato non produce un numero sbagliato, spegne la schermata.

import type { AdSpending, Lead } from "@/crm/types";
import { eConversione, ricavoLordo, type FiltroPeriodo } from "@/crm/kpi-calcoli";
import { totaleAltriCosti, totaleCostiPratica } from "@/crm/costi-pratica";

// ── PERCHÉ NON C'È PIÙ UN INTERRUTTORE LORDO/NETTO ──────────────────────────
//  Qui vivevano `Modalita` e `SPIEGA_MODALITA`, il tipo e la spiegazione di un
//  interruttore che riscriveva TUTTI i numeri in euro della pagina. Sono spariti
//  con lui, e per una ragione precisa: il ritorno sulla spesa «in modalità
//  netto» divideva per la spesa un numeratore da cui la spesa era GIÀ stata
//  sottratta. Quel rapporto non misura niente e scende senza che sia successo
//  nulla — ma sembra un KPI, e qualcuno lo leggeva.
//  Adesso fatturato, risultato netto e margine stanno affiancati, sempre e tutti
//  e tre: la distanza fra i tre È l'informazione, e non c'è più nessuno stato da
//  ricordare mentre si scorre.

// ── LETTURE PRUDENTI DALLA SCHEDA ───────────────────────────────────────────

/** `Number()` secco come in kpi-calcoli (vedi nota in testa), ma con lo scarto
 *  di NaN e infiniti: un costo scritto "circa 200" non deve diventare NaN e
 *  propagarsi fino a rendere illeggibile il totale. */
function numero(valore: unknown): number {
  const n = Number(valore);
  return Number.isFinite(n) ? n : 0;
}

/** Il blocco pagamento della scheda, solo se è davvero un oggetto. */
function pagamentoDi(lead: Lead): Record<string, unknown> | null {
  const dati = (lead as { data?: unknown }).data;
  if (!dati || typeof dati !== "object") return null;
  const p = (dati as { payment?: unknown }).payment;
  return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
}

/** Il blocco costi, solo se è davvero un oggetto. */
function costiGrezzi(lead: Lead): Record<string, unknown> | null {
  const p = pagamentoDi(lead);
  if (!p) return null;
  const c = p.costi;
  return c && typeof c === "object" ? (c as Record<string, unknown>) : null;
}

/** Aliquota usata quando la scheda dice "con IVA" senza dire quanta: è quella
 *  ordinaria italiana, la stessa costante ÷1,22 che kpi-calcoli applica da
 *  sempre. Scritta come percentuale perché è così che la si dice a voce. */
export const ALIQUOTA_IVA_PREDEFINITA = 22;

export interface IvaDellIncasso {
  /** L'incasso comprendeva l'IVA: va scorporata prima di sottrarre i costi. */
  conIva: boolean;
  /** Percentuale applicata. */
  aliquota: number;
}

/** ── L'UNICO PUNTO CHE LEGGE L'IVA ─────────────────────────────────────────
 *  Oggi il dato sta in `payment.costi.ivaInclusa`, la spunta che si sceglie
 *  quando si registra il saldo dell'installazione ("Con IVA" / "Senza IVA").
 *  Tutto il calcolo passa da qui e da nessun'altra parte: se quel dato cambia
 *  casa — per esempio diventa un campo esplicito sulla scheda
 *  dell'installazione — si aggiorna questa funzione e basta, senza rincorrere
 *  la sottrazione in tre punti diversi.
 *
 *  RIPIEGO PRUDENTE: scheda muta = incasso SENZA IVA, quindi nessuno scorporo.
 *  Non è la lettura più cauta sul piano contabile (assumere l'IVA farebbe un
 *  netto più basso e più difendibile), ma è quella che tiene questo conto
 *  identico al netto che kpi-calcoli mostra nella stessa pagina — e due netti
 *  diversi nella stessa schermata sono peggio di un netto ottimista. Quante
 *  schede si trovano in questa condizione è contato in `schedeSenzaIva`, così
 *  il ripiego è visibile invece che silenzioso.
 *
 *  L'ALIQUOTA NON SI LEGGE DALLA SCHEDA, ed è voluto: kpi-calcoli scorpora con
 *  un ÷1,22 fisso, e leggere qui un'aliquota diversa scheda per scheda farebbe
 *  comparire nella STESSA pagina due netti che non tornano fra loro. Se un
 *  giorno l'aliquota diventa un dato della scheda, i due punti vanno cambiati
 *  insieme. */
export function ivaDellIncasso(lead: Lead): IvaDellIncasso {
  const grezzo = costiGrezzi(lead)?.ivaInclusa;
  //  Gli archivi importati portano anche "true"/"si"/1 al posto del booleano:
  //  un `=== true` secco li leggerebbe tutti come "senza IVA".
  const conIva =
    grezzo === true ||
    grezzo === 1 ||
    (typeof grezzo === "string" && ["true", "si", "sì", "1"].includes(grezzo.trim().toLowerCase()));
  return { conIva, aliquota: ALIQUOTA_IVA_PREDEFINITA };
}

/** Quanta IVA c'è dentro un incasso: zero se l'incasso era senza IVA.
 *  Scorporo, non addizione: 1.220 con IVA al 22% contengono 220 di imposta,
 *  non 268. */
export function ivaScorporata(lead: Lead): number {
  const { conIva, aliquota } = ivaDellIncasso(lead);
  if (!conIva) return 0;
  const incassato = ricavoLordo(lead);
  return incassato - incassato / (1 + aliquota / 100);
}

export interface CostiDellaScheda {
  prodotto: number;
  installatore: number;
  taglio: number;
  /** Benzina, pedaggi e ore di strada delle pose a domicilio. */
  trasferta: number;
  /** Tutto quello che è stato scritto a mano su questa pratica. */
  altri: number;
  totale: number;
  /** Nessuno dei costi è stato scritto: la scheda non ha un margine vero. */
  vuota: boolean;
}

/** I costi segnati DENTRO il lead. Sono i campi di `PaymentInfo.costi`:
 *  costoProdotto, costoInstallatore, costoTaglio, costoTrasferta.
 *
 *  ── PERCHÉ IL VIAGGIO STA QUI E NON A PARTE ───────────────────────────────
 *  Il costo della trasferta lo scrive `salvaCostoViaggio()` (crm/spedizione.ts)
 *  sulle pose a domicilio, e finisce nello stesso `payment.costi` degli altri
 *  tre proprio perché è un'uscita della pratica, non un incasso. Finché non
 *  veniva sommato qui, la benzina la pagavamo davvero e il margine faceva finta
 *  di no. Si legge con la stessa `numero()` degli altri: una lettura più
 *  tollerante darebbe un numero qui e zero in kpi-calcoli, cioè due margini
 *  diversi nella stessa pagina. */
export function costiDellaScheda(lead: Lead): CostiDellaScheda {
  const c = costiGrezzi(lead);
  const prodotto = numero(c?.costoProdotto);
  const installatore = numero(c?.costoInstallatore);
  const taglio = numero(c?.costoTaglio);
  const trasferta = numero(c?.costoTrasferta);
  //  ⚠️ Le voci scritte a mano si contano come le altre. Una voce scritta e
  //   non contata è peggio di una non scritta: fa credere che il conto la
  //   comprenda. La somma la fa `totaleCostiPratica`, la stessa che usa
  //   kpi-calcoli — vedi la nota in testa a crm/costi-pratica.
  const altri = totaleAltriCosti(lead.data);
  return {
    prodotto,
    installatore,
    taglio,
    trasferta,
    altri,
    totale: totaleCostiPratica(lead.data),
    vuota: prodotto === 0 && installatore === 0 && taglio === 0 && trasferta === 0 && altri === 0,
  };
}

// ── IL CONTO DEL PERIODO ────────────────────────────────────────────────────

export interface ContoNetto {
  /** Schede che contano come cliente nel periodo. */
  clienti: number;
  /** Quanto è ENTRATO: somma dei prezzi finali di vendita. È il lordo. */
  incassato: number;
  /** IVA compresa negli incassi che erano con IVA. */
  iva: number;
  costoProdotto: number;
  costoInstallatore: number;
  costoTaglio: number;
  /** I viaggi delle pose a domicilio. */
  costoTrasferta: number;
  /** Le voci scritte a mano sulle singole pratiche. */
  costoAltri: number;
  /** I costi delle schede sommati: quanto è uscito per servire quei clienti. */
  costiSchede: number;
  /** Spesa pubblicitaria registrata nel periodo. */
  spesaPubblicitaria: number;
  /** Quanto RESTA. Stesso numero di `fatturatoNetto` in kpi-calcoli. */
  netto: number;
  /** Quanto resta ogni 100 € incassati. 0 se non è entrato niente. */
  marginePercentuale: number;
  /** Schede vendute senza nessun costo scritto: il netto le conta a costo zero
   *  e quindi le fa sembrare tutte margine. Va detto. */
  schedeSenzaCosti: number;
  /** Schede il cui incasso era dichiarato con IVA. */
  schedeConIva: number;
  /** Schede su cui l'IVA non è stata dichiarata: valgono "senza IVA". */
  schedeSenzaIva: number;
  /** Registrazioni di spesa pubblicitaria nel periodo. */
  registrazioniSpesa: number;
  /** ── LA CASSA, NON IL FISCO ─────────────────────────────────────────────
   *  Quanto di quello che è entrato è passato da banca/POS e quanto in
   *  contanti, SOLO dove qualcuno l'ha registrato. Non entrano nel netto: da
   *  dove arrivano i soldi non cambia quanto se ne è guadagnato. Servono a far
   *  quadrare il cassetto a fine mese. */
  incassatoTracciato: number;
  incassatoContanti: number;
  /** Schede su cui il canale non è stato registrato: senza questo numero i due
   *  di sopra sembrerebbero il totale, e non lo sono. */
  schedeSenzaCanale: number;
}

const CONTO_VUOTO: ContoNetto = {
  clienti: 0,
  incassato: 0,
  incassatoTracciato: 0,
  incassatoContanti: 0,
  schedeSenzaCanale: 0,
  iva: 0,
  costoProdotto: 0,
  costoInstallatore: 0,
  costoTaglio: 0,
  costoTrasferta: 0,
  costoAltri: 0,
  costiSchede: 0,
  spesaPubblicitaria: 0,
  netto: 0,
  marginePercentuale: 0,
  schedeSenzaCosti: 0,
  schedeConIva: 0,
  schedeSenzaIva: 0,
  registrazioniSpesa: 0,
};

/** ── QUANDO SI È CHIUSA DAVVERO ───────────────────────────────────────────
 *
 *  ⚠️ CAMBIO CHIESTO DAL COMMITTENTE, E CAMBIA IL SIGNIFICATO DELLA SCHEDA.
 *  Prima questo conto prendeva i lead ARRIVATI nella finestra e seguiva loro:
 *  è la misura corretta del ritorno sulla pubblicità (la spesa di agosto va
 *  confrontata con quello che ha portato). Ma non è la domanda che si fa chi
 *  guarda: «quanto è entrato in questi 30 giorni» vuol dire i soldi presi in
 *  questi 30 giorni, e una scheda che risponde a un'altra domanda con lo
 *  stesso titolo si legge come un errore di conto.
 *  Adesso si attribuisce alla data della CHIUSURA. Chi vuole il ritorno per
 *  coorte lo trova nella scheda «Fonti», che quella logica ce l'ha già.
 *
 *  ── ⚠️ LA CATENA DEI RIPIEGHI, IN ORDINE ─────────────────────────────────
 *   1. `convertedAt` — la data vera, scritta alla prima chiusura;
 *   2. `payment.dataPagamento` — il giorno in cui i soldi sono entrati;
 *   3. `installazione.completataIl` — la posa è stata fatta, quindi la vendita
 *      c'era: vale per le pratiche di cui non si sa altro;
 *   4. `createdAt` — ultimo ripiego, e va detto: su una scheda vecchia
 *      attribuisce la vendita al giorno in cui è arrivato il numero di
 *      telefono, cioè al mese sbagliato. È il male minore: l'alternativa è
 *      farla sparire da tutti i periodi, e una vendita che non c'è in nessun
 *      mese è peggio di una nel mese sbagliato — la prima non si scopre.
 *
 *  ── ⚠️ LA DATA DELLA POSA VIENE DOPO QUELLA DEL PAGAMENTO, ED È UN ERRORE
 *     CHE HO GIÀ FATTO ────────────────────────────────────────────────────
 *  Nella prima versione `completataIl` stava al secondo posto, e il
 *  committente se n'è accorto in mezz'ora: tre pose fatte lo stesso giorno
 *  hanno portato 1.980 € dentro «oggi», mentre quei soldi erano entrati fra
 *  il 30 luglio e il 7 agosto.
 *  Il motivo è che la data della posa è una data di CONSEGNA, non di cassa.
 *  Un impianto pagato a luglio e montato a settembre è un incasso di luglio:
 *  attribuirlo alla consegna gonfia il mese in cui si lavora e svuota quello
 *  in cui si è venduto, e su un'attività dove fra l'acconto e la posa passano
 *  settimane non c'è un solo mese che torni. */
export function dataChiusura(l: Lead): string {
  const d = l?.data;
  return (
    String(d?.convertedAt ?? "").slice(0, 10) ||
    String(d?.payment?.dataPagamento ?? "").slice(0, 10) ||
    String(d?.installazione?.completataIl ?? "").slice(0, 10) ||
    String(d?.createdAt ?? "").slice(0, 10)
  );
}

/** ── DA QUANTO È ENTRATO A QUANTO RESTA ────────────────────────────────────
 *  Le schede CHIUSE nel periodo (vedi `dataChiusura`) che risultano clienti
 *  secondo `eConversione`, più la spesa pubblicitaria registrata nel periodo.
 *  ⚠️ Attribuzione per data di CHIUSURA e non di ingresso: il perché — e cosa
 *   ci si perde — sta scritto su `dataChiusura` qui sopra.
 *
 *  Il netto NON viene fermato a zero: una vendita con costi maggiori
 *  dell'incasso ha davvero perso denaro, e un periodo che si chiude sotto zero
 *  deve poterlo dire. È anche la scelta di kpi-calcoli. */
/** ── DA DOVE SONO ENTRATI I SOLDI ─────────────────────────────────────────
 *  Bonifico, carta e POS da una parte; contanti dall'altra. È informazione di
 *  CASSA, non di fisco: dice quanto è passato dalla banca e quanto dal
 *  cassetto, che è la domanda di chi a fine mese deve far quadrare i due.
 *
 *  ⚠️ NON SI DEDUCE NIENTE. Se su una scheda nessuno ha registrato il canale,
 *   quella scheda finisce fra le «non registrate» e non viene contata né di
 *   qua né di là: leggerla come «tutto tracciato» — o come «tutto contanti» —
 *   vorrebbe dire inventare un dato che nessuno ha scritto, e un numero
 *   inventato in un riepilogo di cassa è peggio di un numero mancante.
 *  ⚠️ E NON TOCCA IL NETTO: il margine si fa sull'incassato e sui costi, e da
 *   dove sono arrivati quei soldi non cambia quanto se ne è guadagnato.
 */
export interface CanaleIncasso {
  tracciato: number;
  contanti: number;
  /** vero solo se qualcuno ha davvero scritto come è stato pagato */
  registrato: boolean;
}

export function canaleIncasso(lead: Lead): CanaleIncasso {
  const p = lead?.data?.payment;
  const tracciato = numero(p?.incassoTracciato);
  const contanti = numero(p?.incassoContanti);
  const registrato =
    p?.incassoTracciato !== undefined || p?.incassoContanti !== undefined;
  return { tracciato, contanti, registrato };
}

export function calcolaContoNetto(
  leads: Lead[],
  adSpending: AdSpending[],
  dentro: FiltroPeriodo,
): ContoNetto {
  if (!Array.isArray(leads) || !Array.isArray(adSpending)) return CONTO_VUOTO;

  //  Le schede senza `data` si scartano PRIMA di `eConversione`, che legge
  //  `lead.data.stato` senza rete: nell'archivio importato quella proprietà a
  //  volte non c'è, e qui basterebbe una scheda così per spegnere la pagina.
  const clienti = leads.filter(
    (l) =>
      !!l &&
      typeof l === "object" &&
      !!l.data &&
      typeof l.data === "object" &&
      //  ⚠️ La data della CHIUSURA, non quella d'ingresso: vedi `dataChiusura`.
      dentro(dataChiusura(l)) &&
      eConversione(l),
  );

  const conto: ContoNetto = { ...CONTO_VUOTO, clienti: clienti.length };

  for (const l of clienti) {
    conto.incassato += ricavoLordo(l);
    conto.iva += ivaScorporata(l);
    const c = costiDellaScheda(l);
    conto.costoProdotto += c.prodotto;
    conto.costoInstallatore += c.installatore;
    conto.costoTaglio += c.taglio;
    conto.costoTrasferta += c.trasferta;
    conto.costoAltri += c.altri;
    if (c.vuota) conto.schedeSenzaCosti++;
    if (ivaDellIncasso(l).conIva) conto.schedeConIva++;
    else conto.schedeSenzaIva++;
    const canale = canaleIncasso(l);
    if (canale.registrato) {
      conto.incassatoTracciato += canale.tracciato;
      conto.incassatoContanti += canale.contanti;
    } else conto.schedeSenzaCanale++;
  }

  const speseNelPeriodo = adSpending.filter(
    (s) =>
      s && typeof s === "object" && s.data && typeof s.data === "object" && dentro(s.data.data),
  );
  conto.registrazioniSpesa = speseNelPeriodo.length;
  conto.spesaPubblicitaria = speseNelPeriodo.reduce(
    (somma, s) => somma + numero(s.data.importoSpeso),
    0,
  );

  conto.costiSchede =
    conto.costoProdotto +
    conto.costoInstallatore +
    conto.costoTaglio +
    conto.costoTrasferta +
    conto.costoAltri;
  conto.netto = conto.incassato - conto.iva - conto.costiSchede - conto.spesaPubblicitaria;
  conto.marginePercentuale = conto.incassato > 0 ? (conto.netto / conto.incassato) * 100 : 0;

  return conto;
}

// ── LA SOTTRAZIONE, RIGA PER RIGA ───────────────────────────────────────────

export type TipoVoce = "entrata" | "uscita" | "risultato";

export interface VoceConto {
  chiave: string;
  etichetta: string;
  /** Da dove viene quel numero, in poche parole: senza, ogni riga è un'ipotesi. */
  nota: string;
  importo: number;
  tipo: TipoVoce;
}

/** Le righe del conto nell'ordine in cui si legge una sottrazione: prima quanto
 *  è entrato, poi ogni uscita con il suo perché, infine quanto resta.
 *  Le voci a zero restano in elenco: una riga «Costo installatore € 0» dice che
 *  nessuno l'ha scritto, mentre una riga assente non dice niente e si scambia
 *  per una dimenticanza del programma. */
export function vociDelConto(conto: ContoNetto): VoceConto[] {
  const schede = (n: number) => `${n} ${n === 1 ? "scheda" : "schede"}`;
  return [
    {
      chiave: "incassato",
      etichetta: "Incassato",
      nota: `Prezzo finale di vendita di ${schede(conto.clienti)}`,
      importo: conto.incassato,
      tipo: "entrata",
    },
    {
      chiave: "iva",
      etichetta: "IVA",
      nota:
        conto.schedeConIva > 0
          ? `Scorporata al ${ALIQUOTA_IVA_PREDEFINITA}% da ${schede(conto.schedeConIva)} incassate con IVA`
          : "Nessun incasso è stato segnato con IVA",
      importo: conto.iva,
      tipo: "uscita",
    },
    {
      chiave: "prodotto",
      etichetta: "Costo prodotto",
      nota: "Somma del costo prodotto scritto sulle schede",
      importo: conto.costoProdotto,
      tipo: "uscita",
    },
    {
      chiave: "installatore",
      etichetta: "Costo installatore",
      nota: "Somma del costo installatore scritto sulle schede",
      importo: conto.costoInstallatore,
      tipo: "uscita",
    },
    {
      chiave: "taglio",
      etichetta: "Costo taglio",
      nota: "Somma del costo taglio scritto sulle schede",
      importo: conto.costoTaglio,
      tipo: "uscita",
    },
    {
      //  Sta fra i costi della scheda e non accanto alla pubblicità: è un costo
      //  della singola pratica, e chi controlla la riga la cerca insieme agli
      //  altri tre.
      chiave: "trasferta",
      etichetta: "Costo viaggio",
      nota: "Somma dei viaggi delle pose a domicilio",
      importo: conto.costoTrasferta,
      tipo: "uscita",
    },
    {
      //  Tutto quello che è stato scritto a mano sulle singole pratiche:
      //  corriere, rimborsi, ritocchi. Una riga sola, perché i titoli sono
      //  liberi e un elenco che cambia lunghezza a ogni periodo non si legge —
      //  il dettaglio sta sulla scheda del cliente, che è dove è stato scritto.
      chiave: "altri",
      etichetta: "Altri costi delle pratiche",
      nota: "Le voci scritte a mano sulle singole schede",
      importo: conto.costoAltri,
      tipo: "uscita",
    },
    {
      chiave: "pubblicita",
      etichetta: "Spesa pubblicitaria",
      nota:
        conto.registrazioniSpesa > 0
          ? `${conto.registrazioniSpesa} ${conto.registrazioniSpesa === 1 ? "registrazione" : "registrazioni"} nel periodo`
          : "Nessuna spesa registrata nel periodo",
      importo: conto.spesaPubblicitaria,
      tipo: "uscita",
    },
    {
      chiave: "netto",
      etichetta: "Resta",
      nota:
        conto.incassato > 0
          ? `${conto.marginePercentuale.toFixed(1)}% di quanto è entrato`
          : "Niente è entrato in questo periodo",
      importo: conto.netto,
      tipo: "risultato",
    },
  ];
}
