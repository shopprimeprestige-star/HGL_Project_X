// Dati del configuratore di preventivo "Custom Hair System".

export interface BaseSolution {
  id: string;
  name: string;
  price: number;
  desc: string;
  badge?: string;
  /** Prezzo di listino barrato: se presente e price = 0, la base è una promo "GRATIS". */
  wasPrice?: number;
  /** Percorso completamente diverso (trapianto): non condivide alcun accessorio
   *  con gli impianti, e nel preventivo mostra il proprio itinerario. */
  standalone?: boolean;
}

/** id della soluzione TRAPIANTO: usato per separarne accessori e percorso. */
export const TRANSPLANT_ID = "trapianto";

// Prezzo base impianto: parte da 389 €.
export const BASE_SOLUTIONS: BaseSolution[] = [
  {
    id: TRANSPLANT_ID,
    name: "Trapianto — i tuoi capelli, per sempre",
    price: 2350,
    badge: "Definitivo",
    standalone: true,
    desc: "Capelli tuoi che ricrescono davvero: nessuna manutenzione, per sempre. Cinque giorni a Istanbul nella nostra clinica affiliata, hotel incluso per due persone. Ricrescita completa in 8-12 mesi.",
  },
  {
    id: "patch-standard",
    name: "Patch Cutanea",
    price: 389,
    badge: "Il più economico",
    desc: "Il sistema classico, sul mercato dagli anni Novanta. Si fa in qualsiasi materiale — lace o poliuretano — ma sempre con prodotti standard: base e attaccatura di serie, la personalizzazione si ferma a colore e taglio. Costa meno ed è più rapido da produrre.",
  },
  {
    id: "invisible-derm",
    name: "Invisible Derm Protocol",
    price: 589,
    badge: "TOP DI GAMMA",
    desc: "Brevettato, introdotto nel {DATA_BREVETTO}. L'attaccatura è fusa alla pelle: nessun bordo percepibile nemmeno passando la mano. Ogni pezzo è costruito sul tuo caso, e regge lo sguardo ravvicinato.",
  },
];

export interface UpsellItem {
  id: string;
  name: string;
  price: number;
  /** Prezzo di listino barrato: se presente e price = 0, la voce è una promo "GRATIS". */
  wasPrice?: number;
  desc: string;
  /** ── SOTTO-SCELTA DELLA LAVORAZIONE ───────────────────────────────────
   *  Compare SOTTO la voce, e solo quando è selezionata. Non cambia il prezzo:
   *  dice COME va fatta. "Mosso" e "Riccio" non sono una cosa sola — fra
   *  un'onda appena accennata e un riccio stretto c'è tutta la differenza fra
   *  un impianto che si integra e uno che si nota — e finora quella scelta si
   *  faceva a voce, senza finire da nessuna parte. */
  variants?: {
    title: string;
    /** l'opzione scelta quando la voce viene selezionata */
    defaultId: string;
    options: { id: string; name: string; desc: string }[];
  };
}
export interface UpsellSection {
  num: string;
  title: string;
  items: UpsellItem[];
  /** true = selezione singola (radio): scegliendone un'altra si deseleziona la precedente. */
  single?: boolean;
  /** Mostra la sezione solo se almeno uno di questi id è selezionato (sotto-sezione condizionale). */
  requiresAnyOf?: string[];
  /** Sezione valida SOLO per queste soluzioni base. Assente = tutte tranne quelle
   *  marcate `standalone` (il trapianto, che ha accessori tutti suoi). */
  onlyFor?: string[];
  /** Chiarimento mostrato sotto il titolo: serve quando le opzioni si somigliano
   *  e va spiegato in una riga che cosa cambia davvero fra loro. */
  note?: string;
}

/** ── SCADENZA DELLE PROMOZIONI ─────────────────────────────────────────────
 *  La durata si imposta dal pannello del presentatore (Impostazioni → Sconti
 *  quantità): di norma 48 ore, cioè 2 giorni. Sono giorni UTILI: il sabato e la domenica non si contano, perché il
 *  cliente non può disporre un bonifico nel fine settimana e una scadenza che
 *  cade lì è una scadenza finta. Se il quinto giorno utile cade di sabato o
 *  domenica, si sposta al lunedì. */
export const PROMO_DAYS_DEFAULT = 2;      // 48 ore

/** Durata effettiva, sovrascrivibile dalle impostazioni del presentatore. */
let promoDays = PROMO_DAYS_DEFAULT;
export function setPromoDays(n: number) {
  if (Number.isFinite(n) && n >= 1 && n <= 120) promoDays = Math.round(n);
}
export function getPromoDays(): number { return promoDays; }

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Scadenza promo: 5 giorni LAVORATIVI dopo la data indicata (default: oggi). */
export function promoDeadline(from?: string | Date): Date {
  const d = from ? new Date(from) : new Date();
  let restanti = promoDays;
  while (restanti > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) restanti--;      // sabato e domenica non consumano giorni
  }
  while (isWeekend(d)) d.setDate(d.getDate() + 1);   // mai una scadenza nel weekend
  return d;
}

export function formatDeadline(d: Date): string {
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

export const UPSELL_SECTIONS: UpsellSection[] = [
  {
    // Sezione riservata al trapianto: non compare per gli impianti, e le sezioni
    // degli impianti non compaiono per il trapianto (prodotti diversi).
    num: "tx",
    title: "Il viaggio e i mesi dopo",
    onlyFor: [TRANSPLANT_ID],
    items: [
      { id: "tx-hotel", name: "Hotel 5 giorni per due persone", price: 0, desc: "Incluso: soggiorno di 5 giorni per te e un accompagnatore, con trasferimenti da e per la clinica. Il volo resta a carico tuo." },
      { id: "tx-kit", name: "Kit post-trapianto 6 mesi", price: 550, desc: "Il protocollo completo per i 6 mesi successivi: lozioni, integratori e prodotti per la fase di ricrescita, con controlli programmati a distanza." },
    ],
  },
  {
    num: "tech",
    title: "Quanto deve durare",
    note: "Stessa base per tutte e tre — 0,03 micron, stessa resa al tatto e alla vista — e tutte e tre di nostra tecnologia. Cambia solo quanto regge. Puoi fare tutto: phon, sudore, mare, immersioni prolungate.",
    single: true,
    items: [
      { id: "base-hyper", name: "Innesto rinforzato — la più duratura", price: 164.67, wasPrice: 390, desc: "Doppio ancoraggio, sviluppato da noi: la resistenza dell'annodato con la naturalezza dell'iniettato. Non cede dove le altre cedono e dura di norma il doppio." },
      { id: "base-medium", name: "Innesto bilanciato — il giusto mezzo", price: 249.90, desc: "Ancoraggio singolo, di nostra progettazione: un punto di presa per capello invece di due. Meno materiale sulla base, durata a metà strada fra la standard e la rinforzata." },
      { id: "base-light", name: "Innesto standard — inclusa", price: 0, desc: "Tecnologia nostra, inclusa nel prezzo. I capelli cadono e si muovono come se crescessero dalla tua testa. Con l'uso quotidiano dura meno delle altre due e va sostituita prima." },
    ],
  },
  {
    // ⚠️ SUPPLEMENTI DA CONFERMARE: i valori sotto sono un'ipotesi di partenza,
    //    modificabili dal CRM (Impostazioni → Prezzi). Vanno allineati al
    //    listino vero prima di mostrarli a un cliente.
    num: "len",
    title: "Lunghezza del capello",
    note: "Quindici centimetri sono la lunghezza standard, inclusa. Oltre, serve più materia prima.",
    single: true,
    onlyFor: ["invisible-derm"],
    items: [
      { id: "len-15", name: "15 cm — inclusa", price: 0, desc: "La lunghezza standard: copre la maggior parte dei tagli maschili, dal corto al medio." },
      { id: "len-20", name: "20 cm", price: 60, desc: "Per chi porta il capello più lungo sopra o vuole poterlo pettinare all'indietro." },
      { id: "len-25", name: "25 cm", price: 120, desc: "Lunghezza media: consente ciuffo e movimento importante." },
      { id: "len-30", name: "30 cm", price: 180, desc: "Capello lungo: serve una quantità di materia prima molto maggiore." },
    ],
  },
  {
    num: "zona",
    title: "Che estensione deve avere",
    note: "Si copre solo dove serve. Le zone si chiamano con i loro nomi: sono le stesse che usa un tricologo.",
    single: true,
    onlyFor: ["invisible-derm"],
    items: [
      { id: "zona-completa", name: "Completa", price: 215.59, desc: "Regione frontale, medio-parietale e vertice: tutta la calotta interessata dal diradamento." },
      { id: "zona-frontale", name: "Solo regione frontale", price: 47.20, desc: "L'attaccatura e la fascia subito dietro: la zona che si guarda per prima." },
      { id: "zona-vertice", name: "Solo vertice", price: 78.53, desc: "La chierica, dove il diradamento parte dal punto di rotazione dei capelli." },
      { id: "zona-parziale", name: "Parziale, su misura", price: 124.80, desc: "Definita sul tuo caso: si copre l'area diradata e si lascia scoperto il resto." },
    ],
  },
  {
    num: "hair",
    title: "Consistenza del capello",
    note: "Scegli lo spessore uguale al tuo. Non esiste il migliore, esiste il tuo.",
    single: true,
    items: [
      { id: "hair-european", name: "Europeo — sottile e leggero", price: 200, desc: "Fibra fine, cade morbida. Giusta se i tuoi capelli sono sottili: una fibra più grossa si sente passando la mano." },
      { id: "hair-indian", name: "Indiano — più corposo, incluso", price: 0, desc: "Fibra più spessa: volume pieno e ottima tenuta. Giusta se i tuoi capelli sono già corposi. Inclusa." },
    ],
  },
  {
    num: "quality",
    title: "Tenuta del colore nel tempo",
    note: "Il vergine tiene il colore più a lungo. Il trattato ti dà qualsiasi tonalità, ma schiarisce.",
    single: true,
    requiresAnyOf: ["hair-european", "hair-indian"],
    items: [
      { id: "hair-virgin", name: "Capello Vergine — mai trattato", price: 119.90, desc: "Capello mai trattato chimicamente: la fibra resta più forte e il colore non tende a schiarirsi nel tempo. Se invece cerchi una tonalità particolare, serve il capello trattato." },
      { id: "hair-treated", name: "Trattato — qualsiasi tonalità, incluso", price: 0, desc: "Il capello viene colorato fino alla tonalità che serve: sul colore hai libertà di scelta. In cambio, con il tempo tende a schiarirsi, quindi la corrispondenza con i tuoi capelli dura meno. Incluso, senza sovrapprezzo." },
    ],
  },
  {
    num: "01",
    title: "Cosa lo rende credibile",
    note: "Dove comincia, quanti capelli ha, come diradano verso la fronte e in che verso vanno. Se sbagliano insieme, si nota.",
    items: [
      {
        id: "signature-hairline",
        name: "L'attaccatura disegnata sul tuo viso",
        price: 107.83,
        wasPrice: 275,
        desc: "È la prima cosa che gli altri guardano. La disegniamo sul tuo viso, irregolare come una linea vera: mai un bordo dritto. Senza, resta quella standard — uguale per tutti.",
      },
      {
        id: "age-matched-density",
        name: "La densità giusta per la tua età",
        price: 157.77,
        desc: "Troppi capelli a 50 anni si notano più di pochi. Calibriamo la quantità su quella che avresti oggi: è ciò che ti rende credibile agli occhi di chi ti conosce.",
      },
      {
        id: "natural-growth-mapping",
        name: "La direzione di crescita dei tuoi capelli",
        price: 123.56,
        desc: "I capelli veri partono da un vortice e cambiano verso zona per zona. Ricreiamo quella mappa: si pettina come i tuoi e regge vento e pioggia allo stesso modo.",
      },
    ],
  },
  {
    num: "02",
    title: "Il colore giusto, non uno simile",
    note: "Il colore giusto fa sparire il confine. Il quasi-giusto lo mette in evidenza.",
    single: true,
    items: [
      // Le tre voci sono TRE COSE DIVERSE, e i nomi lo devono dire prima della
      // descrizione: qui si sceglie il tuo colore in tinta unita, oppure lo si
      // arricchisce con i bianchi o con le schiariture.
      { id: "signature-colour-match", name: "Tinta unita, il tuo colore", price: 0, desc: "Un colore solo, misurato sul tuo. Incluso." },
      { id: "grey-hair-integration", name: "Con i tuoi bianchi", price: 50, desc: "La tua percentuale di bianchi, dove li hai davvero." },
      { id: "colour-meshato", name: "Con schiariture (meshato)", price: 150, desc: "Riflessi chiari ciocca per ciocca: movimento alla luce." },
    ],
  },
  {
    num: "forma",
    title: "Liscio, mosso o riccio come i tuoi",
    note: "Uguale ai tuoi. Nessuna costa di più.",
    single: true,
    items: [
      { id: "shape-liscio", name: "Liscio", price: 0, desc: "Caduta dritta, effetto pettinato anche senza prodotto. La più semplice da gestire." },
      {
        id: "shape-mosso", name: "Mosso", price: 0,
        desc: "Onda morbida: volume e movimento senza sembrare costruito. È la forma che si integra più facilmente.",
        variants: {
          title: "Intensità dell'onda",
          defaultId: "onda-media",
          options: [
            { id: "onda-leggera", name: "Onda leggera", desc: "Appena accennata: liscio con movimento." },
            { id: "onda-media", name: "Onda media", desc: "L'onda si vede, resta naturale." },
            { id: "onda-marcata", name: "Onda marcata", desc: "Volume pieno, onda ben disegnata." },
          ],
        },
      },
      {
        id: "shape-riccio", name: "Riccio", price: 0,
        desc: "Riccio definito, con corpo. Da scegliere se i tuoi lo sono già: è la coerenza a renderlo invisibile.",
        variants: {
          title: "Ampiezza del riccio",
          defaultId: "riccio-medio",
          options: [
            { id: "riccio-largo", name: "Largo", desc: "Anello ampio, movimento morbido." },
            { id: "riccio-medio", name: "Medio", desc: "Riccio definito, il più comune." },
            { id: "riccio-stretto", name: "Stretto", desc: "Riccio chiuso, molta struttura." },
          ],
        },
      },
    ],
  },
  {
    num: "03",
    title: "Il taglio che porti di solito",
    note: "Arriva con 15 cm uguali per tutti. È il taglio a renderlo tuo.",
    items: [
      { id: "custom-cut-blend", name: "Il taglio fatto sulla tua testa", price: 0, wasPrice: 30, desc: "Arriva con i capelli tutti uguali: senza taglio resta una massa uniforme. Lo accorciamo sulla tua testa e lo sfumiamo con i tuoi, così il confine sparisce." },
    ],
  },
];

// Costo di installazione: obbligatorio su ogni soluzione.
export const INSTALLATION: UpsellItem = {
  id: "installation",
  name: "Calibrazione e applicazione da noi",
  price: 70,
  desc: "Il giorno dell'installazione prendiamo il calco della zona da coprire — la forma reale del tuo capo, non una misura approssimata — e lo trasferiamo sull'impianto prima di applicarlo. È questo passaggio a decidere come aderisce, come cade e quanto tiene. Tutto in un appuntamento, sotto le 2 ore.",
};

/** ── DOVE SI FA L'INSTALLAZIONE ────────────────────────────────────────────
 *  Due modi, allo stesso prezzo, e nessuno dei due è obbligatorio: si può
 *  scegliere l'uno, l'altro o nessuno. A domicilio il costo del servizio non
 *  cambia — cambiano le spese di viaggio dell'installatore, che vanno dette
 *  prima e non nascoste in fondo. */
export const INSTALL_PLACE: UpsellSection = {
  num: "install",
  title: "Dove facciamo l'installazione",
  note: "Non è obbligatoria: puoi installarlo da solo seguendo le istruzioni. Se la scegli, il costo è lo stesso nei due casi.",
  single: true,
  items: [
    { id: "installation", name: "Nel nostro centro", price: 70, desc: "Prendiamo il calco della tua testa e lo trasferiamo sull'impianto prima di applicarlo. Un appuntamento, meno di due ore." },
    { id: "installation-home", name: "A domicilio, da te", price: 70, desc: "Lo stesso lavoro, a casa tua. Alle spese di viaggio dell'installatore si provvede a parte: te le comunichiamo prima, in base alla distanza." },
  ],
};

// Modalità di analisi e progettazione (colore + morfologia).
export interface FittingOption {
  id: "remoto" | "sede"; name: string; price: number; desc: string; badge?: string;
  /** Punti brevi: si leggono a colpo d'occhio, il paragrafo no. */
  bullets?: string[];
  /** Una riga che dice a CHI conviene: è la domanda vera del cliente. */
  bestFor?: string;
  /** Richiede l'acconto per essere prenotato (appuntamento in sede). */
  requiresDeposit?: boolean;
}
export const FITTING_OPTIONS: FittingOption[] = [
  {
    id: "remoto",
    name: "Da casa, con foto e video",
    price: 0,
    badge: "GRATIS",
    desc: "Ci mandi qualche foto e un breve video.",
    // Punti riscritti corti e diretti: quattro righe che si leggono in un colpo
    // d'occhio, ognuna con UNA cosa dentro. Prima erano frasi che spiegavano il
    // procedimento; queste dicono cosa ottieni.
    bullets: [
      "Colore misurato dal software: tonalità, bianchi, struttura",
      "Attaccatura disegnata sui tuoi tratti e sulla tua età",
      "Diradata quanto serve: a 45 anni una piena si riconosce",
      "Non ti sposti, e si parte prima",
    ],
    bestFor: "Bastano due foto alla luce del giorno.",
  },
  {
    id: "sede",
    name: "Nel nostro centro, colore provato dal vivo",
    price: 95,
    desc: "Vieni nel nostro centro: i campioni li appoggiamo sui tuoi capelli.",
    bullets: [
      "Campioni appoggiati sui tuoi capelli, alla luce vera",
      "Il tecnico controlla di persona forma e densità",
      "Verifica diretta prima di mandare in produzione",
    ],
    bestFor: "Se preferisci decidere il colore di persona invece che da una foto.",
    requiresDeposit: true,
  },
];

// Simulazione: inclusa a titolo promozionale.
export const SIMULATION: UpsellItem = {
  id: "simulation",
  name: "Vedi il risultato prima della produzione",
  price: 0,
  wasPrice: 18,
  desc: "Vedi attaccatura, densità e colore su una foto tua, prima che l'impianto entri in produzione. Nessuna sorpresa il giorno dell'installazione.",
};

/* ─────────── Prezzi modificabili dal CRM ───────────
 * Override salvati come JSON in app_config (key "quote_pricing").
 * `prices[id]` sovrascrive il prezzo, `was[id]` il prezzo di listino barrato (0 = nessuno). */
/** ── GLI SCONTI SULLE PERSONALIZZAZIONI SI POSSONO SPEGNERE ────────────────
 *
 *  `upsellSconti: false` = «nascondi gli sconti del listino»: si vende a
 *  PREZZO PIENO. Dove c'è un listino barrato, quello diventa il prezzo; dove
 *  non c'è, il prezzo resta quello che è. Niente più barrato accanto alle
 *  voci, e niente riga «Sconti sulle personalizzazioni» nel riepilogo.
 *
 *  ⚠️ PRIMA TOGLIEVA SOLO IL BARRATO, E TENEVA LO SCONTO. Segnalazione del
 *   committente: «metto nascondi e in automatico deve mettere i prezzi del
 *   prezzo intero, ignorando quelli scontati». Aveva ragione, ed era il
 *   difetto peggiore possibile per un interruttore così: chi lo spegneva
 *   credeva di aver tolto lo sconto e continuava a regalarlo — senza più
 *   nemmeno la riga che glielo ricordava. Adesso spegnere gli sconti li
 *   toglie DAVVERO, dal prezzo prima che dalla grafica.
 *
 *  ⚠️ Assente = acceso. I preventivi e le configurazioni già in giro non hanno
 *   questo campo, e devono continuare a comportarsi come prima. */
export interface PricingOverrides {
  prices?: Record<string, number>;
  was?: Record<string, number>;
  disabled?: Record<string, boolean>;
  upsellSconti?: boolean;
  /** ── ⚠️ COSA DEL PREVENTIVO NON SI MOSTRA ─────────────────────────────
   *  Richiesta del committente: «fai che posso disattivare le opzioni del
   *  preventivo dalle impostazioni presentazione».
   *  Le singole VOCI si nascondevano già una per una (`disabled`). Quello che
   *  non si poteva togliere era tutto il resto: una SEZIONE intera — per
   *  spegnerla bisognava nascondere le sue voci una alla volta, e riaccenderla
   *  significava ricordarsi quali — e le parti fisse della pagina (la
   *  quantità, il codice promozionale, dove si fa l'installazione, «Il tuo
   *  percorso»), che c'erano e basta.
   *  Qui stanno insieme perché sono la stessa domanda — «questa cosa il
   *  cliente la vede?» — e tenerle in due posti vorrebbe dire due pannelli
   *  che si contraddicono. Le chiavi sono `sez:<num>` per le sezioni e
   *  `parte:<id>` per le parti fisse (vedi PARTI_PREVENTIVO).
   *  ⚠️ Assente = acceso: i listini salvati prima non hanno questo campo e
   *   devono continuare a mostrare tutto. */
  spente?: Record<string, boolean>;
  /** ── ⚠️ COSA È GIÀ SPUNTATO QUANDO IL PREVENTIVO SI APRE ──────────────
   *  Richiesta del committente: «fai che dalle impostazioni listino posso
   *  selezionare anche quali opzioni sono già preselezionate».
   *  Prima la combinazione di partenza era scritta nel codice
   *  (`DEFAULT_SELECTED`) e per cambiarla serviva una pubblicazione.
   *  Qui si scrive SOLO ciò che si è deciso a mano: `true` = spuntata,
   *  `false` = non spuntata anche se lo era di serie. Un id assente vale
   *  quanto dice `DEFAULT_SELECTED`, così i listini salvati prima di oggi
   *  aprono il preventivo esattamente come hanno sempre fatto.
   *  ⚠️ NON è un elenco completo delle spunte: leggerlo così vorrebbe dire
   *   un preventivo che si apre vuoto per tutti quelli salvati prima. Si
   *   legge sempre con `preselezione()`. */
  preselezionate?: Record<string, boolean>;
  /** ── ⚠️ E LE SPUNTE CAMBIANO DA UNA SOLUZIONE ALL'ALTRA ───────────────
   *  Richiesta del committente: «fai che posso preselezionare gli upsell sui
   *  prodotti: seleziono il prodotto — Invisible Derm, Patch — e decido cosa è
   *  preselezionato e cosa no».
   *  Ed è giusto così: le tre strade si vendono in modo diverso, e una spunta
   *  che ha senso sul top di gamma non ce l'ha sul più economico. Qui la
   *  chiave esterna è la soluzione base (`patch-standard`, `invisible-derm`,
   *  `trapianto`), dentro c'è la stessa mappa di `preselezionate`.
   *  Ordine di lettura, dal più specifico: questa mappa → `preselezionate`
   *  (che vale per tutte) → `DEFAULT_SELECTED`. Così un listino salvato prima
   *  di oggi continua a comportarsi come si è sempre comportato, e una scelta
   *  fatta per un prodotto non tocca gli altri due. */
  preselezionatePerBase?: Record<string, Record<string, boolean>>;
  /** ── ⚠️ QUANTO PAGA DOPO, E PER QUANTO TEMPO ──────────────────────────
   *  Richiesta del committente: «fai che posso modificare anche quanto paga
   *  dopo 12 mesi, da listino».
   *  Era l'unica cifra del preventivo scritta nel codice: 450 € ogni 15 mesi
   *  (`MAINTENANCE`). Per cambiarla serviva una pubblicazione, e intanto il
   *  consulente la diceva a voce diversa da come stava scritta sotto i suoi
   *  occhi — cioè la promessa che il cliente si porta a casa.
   *  ⚠️ I MESI NON SONO UN DETTAGLIO: l'importo comprende UN intervento
   *   dentro quella finestra, e la riga che lo spiega si scrive da questi due
   *   numeri. Cambiarne uno senza l'altro vorrebbe dire una frase che promette
   *   una cosa e un prezzo che ne vale un'altra.
   *  Assente = i valori di `MAINTENANCE`: i listini salvati prima non hanno
   *  questo campo e devono continuare a dire quello che dicevano ieri. */
  //  ⚠️ `sconto` è sparito: non esiste più nessuna promozione automatica sulla
  //   garanzia (richiesta del committente). Il prezzo dal secondo impianto lo
  //   porta un CODICE, e la regola sta in shop/promo-garanzia.
  manutenzione?: { prezzo?: number; mesi?: number };
  /** ── ⚠️ QUANTO SI LASCIA OGGI PER APRIRE LA PRATICA ───────────────────
   *  Richiesta del committente: «fai che posso cambiare anche l'importo
   *  dell'acconto che uscirà sul preventivo».
   *  Erano 100 € scritti nel codice, in quattro punti diversi della pagina —
   *  il riepilogo del bonifico, la riga sotto l'appuntamento in sede, e i due
   *  documenti che si salvano. Cambiarlo voleva dire pubblicare, e intanto il
   *  consulente ne diceva uno diverso da quello stampato.
   *  ⚠️ NON È UN PREZZO: non entra nel totale, è una PARTE del totale che si
   *   paga subito. Per questo non sta fra `prices` ma qui, e per questo il
   *   preventivo ne mostra sempre al massimo il totale (chiedere 100 € di
   *   acconto su un preventivo da 80 € non vuol dire niente).
   *  Assente = `ACCONTO_DI_CASA`. */
  acconto?: number;
  /** L'acconto di una singola soluzione: `{ "patch-standard": 50 }`. Assente
   *  per una base = vale `acconto`. Vedi `accontoDi`. */
  accontoPerBase?: Record<string, number>;
  /** ── ⚠️ CHE COSA SCRIVE IL CLIENTE NEL BONIFICO ───────────────────────
   *  Richiesta del committente: «fai che posso cambiare la causale del
   *  preventivo».
   *  È un MODELLO con dentro `{numero}`, non una frase fissa: la frase senza
   *  il numero del preventivo è un bonifico che arriva in banca e non si sa
   *  di chi è. Le regole (segnaposto, ripieghi, il numero aggiunto in coda se
   *  manca) stanno in shop/causale-bonifico.
   *  Assente = «Conferma ordine - {numero}», come si è sempre letto. */
  causale?: string;
}

/** Le parti fisse della pagina del preventivo che si possono spegnere.
 *  Non sono voci di listino — non hanno un prezzo — ma sono comandi che il
 *  cliente vede, e ci sono consulenze in cui non si vogliono davanti. */
export const PARTI_PREVENTIVO = [
  { id: "quantita", nome: "Quantità impianti", nota: "Il più e il meno accanto al numero di impianti." },
  { id: "codice", nome: "Codice promozionale", nota: "Il campo in cui il cliente scrive un codice sconto." },
  { id: "dove", nome: "Dove si fa l'installazione", nota: "La scelta fra il centro e il domicilio, sotto la calibrazione." },
  { id: "percorso", nome: "«Il tuo percorso»", nota: "La vista a schermo intero con le tappe del lavoro." },
  /*  ── ⚠️ ANCHE L'ASSISTENZA SI PUÒ TOGLIERE ─────────────────────────────
      Richiesta del committente: «fai che posso disattivare questa garanzia
      dal preventivo».
      Il riquadro verde promette una cifra e una copertura, e ci sono
      consulenze in cui quella promessa non si vuole fare: un trapianto la
      esclude già da sé, ma anche su un impianto può non essere in vendita.
      Spento, il riquadro non compare — e non compare NIENTE al suo posto: è
      una parte della pagina che non c'è, non una voce «esclusa» da spiegare.
      ⚠️ Spegnerlo non cambia un euro del totale: l'assistenza non è mai
       entrata nel conto, è quello che si pagherà DOPO. */
  { id: "garanzia", nome: "Assistenza dopo la consegna", nota: "Il riquadro verde «Il tuo impianto resta seguito da noi», con l'importo della rigenerazione." },
] as const;

export type PartePreventivo = (typeof PARTI_PREVENTIVO)[number]["id"];

/** La sezione o la parte è accesa? Assente = accesa. */
export const parteAccesa = (o: PricingOverrides | undefined, id: string): boolean =>
  !(o?.spente ?? {})[id];
/** ⚠️ Una sola forma per le chiavi delle sezioni, scritta qui: scriverla a
 *  mano nel pannello e nel preventivo è il modo in cui due elenchi che devono
 *  combaciare smettono di combaciare. */
export const chiaveSezione = (num: string) => `sez:${num}`;
export const chiaveParte = (id: string) => `parte:${id}`;

const numOr = (v: number | undefined, base: number) => (typeof v === "number" && !Number.isNaN(v) ? v : base);
const wasOr = (v: number | undefined, base?: number) => (typeof v === "number" ? (v > 0 ? v : undefined) : base);

/** Applica gli override CRM alle strutture di default e restituisce il menu effettivo. */
/** Sezioni valide per la soluzione base scelta.
 *  Il trapianto è un prodotto DIVERSO: vede solo i propri accessori, e gli
 *  impianti non vedono i suoi. */
/** ── LE SOLUZIONI CHE SI PERSONALIZZANO ───────────────────────────────────
 *  Segnalazione del committente: «la patch cutanea nel riepilogo mostra le
 *  opzioni dell'Invisible Derm Protocol: non deve mostrarle».
 *  ⚠️ IL GUASTO NASCEVA DA DUE RISPOSTE ALLA STESSA DOMANDA. La pagina sapeva
 *   che la patch non si personalizza (`canPersonalize`) e NON le disegnava le
 *   sezioni; ma il conto delle voci scelte passava di qui, e di qui la patch
 *   vedeva tutte le sezioni generiche. Risultato: opzioni invisibili sullo
 *   schermo ma VIVE nel riepilogo e nel prezzo — le preselezioni del pannello
 *   comparivano sul preventivo di un prodotto che non le ha.
 *   La domanda adesso ha una risposta sola, e sta qui. */
export const BASI_PERSONALIZZABILI = ["invisible-derm", TRANSPLANT_ID];

/** Questa soluzione ha opzioni da scegliere? */
export const siPersonalizza = (baseId: string): boolean =>
  BASI_PERSONALIZZABILI.includes(String(baseId || ""));

/** Sezioni valide per la soluzione base scelta.
 *  Il trapianto è un prodotto DIVERSO: vede solo i propri accessori, e gli
 *  impianti non vedono i suoi. La patch non vede niente: è il sistema
 *  standard, e non si configura. */
export function sectionsFor<S extends { onlyFor?: string[] }>(sections: S[], baseId: string): S[] {
  const isTx = baseId === TRANSPLANT_ID;
  if (!siPersonalizza(baseId)) return sections.filter((s) => s.onlyFor?.includes(baseId) ?? false);
  return sections.filter((s) => (s.onlyFor ? s.onlyFor.includes(baseId) : !isTx));
}

/** ── SCELTE PRESELEZIONATE ─────────────────────────────────────────────────
 *  La configurazione parte già su una combinazione sensata e completa, così il
 *  cliente vede subito un preventivo credibile invece di una pagina vuota da
 *  riempire. Sono tutte opzioni SENZA sovrapprezzo: nulla viene aggiunto a sua
 *  insaputa. */
//  "shape-liscio" è di partenza: la forma va sempre dichiarata, e il liscio è
//  quella che si adatta al maggior numero di casi. Prima non era selezionata
//  nessuna forma, e un preventivo poteva uscire senza dire come sono i capelli.
export const DEFAULT_SELECTED = ["base-light", "hair-indian", "hair-treated", "signature-colour-match", "shape-liscio"];

/** ── LE SPUNTE DI PARTENZA, DECISE DALLE IMPOSTAZIONI ──────────────────────
 *  `DEFAULT_SELECTED` resta la combinazione di serie; questa funzione è
 *  l'unico posto da cui si legge quella VERA, perché il pannello Listino può
 *  spuntarne altre e togliere quelle di serie.
 *
 *  Tre cose si sistemano qui, e qui sola volta:
 *   · una voce nascosta dal listino (`disabled`) non può restare spuntata —
 *     sarebbe un prezzo dentro al totale senza una riga che lo spieghi;
 *   · una SEZIONE spenta non lascia spunte in giro, per lo stesso motivo;
 *   · nelle sezioni a scelta unica ne sopravvive UNA. Se non fosse così, il
 *     pannello potrebbe spuntare «Innesto rinforzato» mentre «Innesto
 *     standard» è di serie, e il preventivo si aprirebbe con due pallini
 *     accesi nello stesso gruppo e due prezzi nel totale. Vince quella
 *     scelta a mano: è la più recente delle due volontà.
 *  Le sotto-sezioni condizionate (la tenuta del colore, che esiste solo se un
 *  tipo di capello è scelto) seguono la condizione: senza il capello, la loro
 *  spunta non si porta dietro nessun prezzo. */
export function preselezione(o: PricingOverrides = {}, baseId?: string): string[] {
  const generali = o.preselezionate ?? {};
  //  Le scelte di QUESTA soluzione. Senza soluzione (chi chiede "in generale")
  //  restano solo quelle valide per tutte.
  const sue = (baseId && o.preselezionatePerBase?.[baseId]) || {};
  const spento = o.disabled ?? {};
  /** La più specifica vince: prima la soluzione, poi la regola generale, poi
   *  la combinazione di serie. */
  const scelto = (id: string): boolean | undefined =>
    typeof sue[id] === "boolean" ? sue[id] : typeof generali[id] === "boolean" ? generali[id] : undefined;
  const vuole = (id: string) => scelto(id) ?? DEFAULT_SELECTED.includes(id);
  const out: string[] = [];
  const dentro = new Set<string>();
  //  ⚠️ Con una soluzione in mano si guardano solo le sue sezioni: il
  //   trapianto non deve portarsi dietro le spunte degli impianti (e viceversa)
  //   nemmeno come id in un elenco — sarebbero spunte che nessuna schermata
  //   può mostrare e che nessuno potrebbe togliere.
  for (const s of (baseId ? sectionsFor(UPSELL_SECTIONS, baseId) : UPSELL_SECTIONS)) {
    if (!parteAccesa(o, chiaveSezione(s.num))) continue;
    if (s.requiresAnyOf && !s.requiresAnyOf.some((id) => dentro.has(id))) continue;
    const presi = s.items.filter((i) => !spento[i.id] && vuole(i.id)).map((i) => i.id);
    if (!presi.length) continue;
    const tenuti = s.single ? [presi.find((id) => scelto(id) === true) ?? presi[0]] : presi;
    for (const id of tenuti) {
      out.push(id);
      dentro.add(id);
    }
  }
  return out;
}

/** ── QUANTO COSTA QUESTA STRADA, GIÀ ADESSO ────────────────────────────────
 *  Richiesta del committente: «fai che il prezzo di ogni servizio all'inizio
 *  del preventivo scriva il prezzo totale fino a quel momento, in base ai
 *  prodotti aggiuntivi già preselezionati».
 *  Sulla scheda della soluzione base c'era il prezzo della base sola — 389 € —
 *  e il cliente lo leggeva come «costa 389 €», mentre nel totale in fondo
 *  entravano anche le voci già spuntate. Qui si somma quello che è DAVVERO
 *  dentro quella strada in questo momento.
 *
 *  ⚠️ Non è il totale del preventivo: manca tutto ciò che si sceglie dopo —
 *   calibrazione, simulazione, analisi del volto, quantità e sconti. È «fino a
 *   qui», e la scheda lo dice a parole.
 *  ⚠️ Il conto si fa con le voci del MENU (`buildMenu`), non con il catalogo:
 *   così rispetta i prezzi del listino, gli sconti spenti e le voci nascoste. */
export function vociPreselezionate<I extends { id: string }>(
  sezioni: { items: I[]; single?: boolean; requiresAnyOf?: string[]; onlyFor?: string[] }[],
  baseId: string,
  selezionati: Iterable<string>,
): I[] {
  const voluti = new Set(selezionati);
  const presi: I[] = [];
  const dentro = new Set<string>();
  for (const s of sectionsFor(sezioni, baseId)) {
    if (s.requiresAnyOf && !s.requiresAnyOf.some((id) => dentro.has(id))) continue;
    let una = false;
    for (const i of s.items) {
      if (!voluti.has(i.id)) continue;
      if (s.single && una) continue;   // una sola per gruppo a scelta unica
      una = true;
      presi.push(i);
      dentro.add(i.id);
    }
  }
  return presi;
}

export interface PrezzoDiPartenza {
  /** Quanto costa oggi questa strada con le voci già spuntate. */
  totale: number;
  /** Lo stesso conto ai prezzi pieni: c'è solo se supera il totale (il barrato). */
  listino?: number;
  /** Quanto pesano le voci spuntate: `totale` meno il prezzo della base. */
  extra: number;
  /** Le voci spuntate che ci sono dentro, nell'ordine del preventivo. */
  voci: { id: string; name: string; price: number }[];
}

export function prezzoDiPartenza(
  menu: QuoteMenu,
  baseId: string,
  selezionati: Iterable<string>,
): PrezzoDiPartenza {
  const b = menu.base.find((x) => x.id === baseId);
  const partenza = b?.price ?? 0;
  const voci = vociPreselezionate(menu.sections, baseId, selezionati);
  const totale = partenza + voci.reduce((s, i) => s + i.price, 0);
  //  Il prezzo pieno di una voce senza barrato è il suo prezzo: sommare
  //  `wasPrice ?? 0` cancellerebbe dal barrato tutte le voci non scontate, e
  //  il "prima" uscirebbe più basso del "dopo".
  const pieno = (v: { price: number; wasPrice?: number }) =>
    v.wasPrice && v.wasPrice > v.price ? v.wasPrice : v.price;
  const listino = (b ? pieno(b) : 0) + voci.reduce((s, i) => s + pieno(i), 0);
  return { totale, listino: listino > totale ? listino : undefined, extra: totale - partenza, voci };
}

/** ── DATA DEL BREVETTO, SEMPRE AGGIORNATA ──────────────────────────────────
 *  Il protocollo va presentato come recente. Invece di scrivere una data fissa
 *  che invecchia da sola, si calcola: sempre 8 mesi prima del mese corrente.
 *  Il testo del catalogo contiene il segnaposto {DATA_BREVETTO}, sostituito
 *  quando il menu viene costruito. */
export const PATENT_MONTHS_AGO = 8;
export function patentDateLabel(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - PATENT_MONTHS_AGO, 1);
  return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

/** Lunghezza standard dei capelli forniti (cm). */
export const HAIR_LENGTH_CM = 15;

/** Manutenzione e garanzia a vita — testo unico usato nel preventivo. */
/** ── L'IMPIANTO È SEGUITO NEL TEMPO ────────────────────────────────────────
 *  Il rischio di questa sezione è ROVESCIARE il valore del prodotto: se la
 *  cifra dell'assistenza compare tre volte e in grande, il cliente smette di
 *  guardare l'impianto e comincia a pensare che valga quella cifra.
 *  Quindi qui si parla di COSA RICEVE — impianto rigenerato, o uno nuovo
 *  costruito da capo sul suo caso — e il contributo si nomina UNA volta sola,
 *  alla fine, in piccolo, presentato per ciò che è davvero: l'unica spesa
 *  prevedibile dopo oggi. Detta così la stessa cifra alza il prodotto invece
 *  di abbassarlo, perché è ciò che si paga per riavere un impianto nuovo. */
export const MAINTENANCE = {
  price: 450,
  /** Quanto dura la copertura. ⚠️ NON è «ogni quanto si paga»: dentro questi
   *  mesi un intervento è compreso nell'importo, e se se ne chiede un altro si
   *  ripaga la stessa cifra. Il nome è rimasto `everyMonths` perché lo leggono
   *  altre schermate; quello che vuol dire è scritto qui. */
  everyMonths: 15,
  title: "Il tuo impianto resta seguito da noi",
  lead: "Non finisce alla consegna. Da lì in avanti l'impianto è un nostro compito, e quanto ti costerà è già stabilito da oggi.",
  /*  ⚠️ QUI C'ERANO QUATTRO VOCI, E DUE DICEVANO UNA COSA NON VERA: «Due
      interventi in 12 mesi — compresi nell'importo, il secondo non si paga a
      parte». Non è così: l'importo ne comprende UNO, e il secondo si ripaga.
      Una promessa più generosa dell'accordo è la peggiore da lasciare scritta —
      la si scopre il giorno in cui il cliente chiede il secondo intervento e gli
      si deve dire di no, con il preventivo in mano che gli dà ragione.
      Restano le DUE cose che il cliente riceve davvero, e sono un'alternativa
      fra loro: si rigenera, oppure — se non è recuperabile — si rifà. Quanto
      dura e cosa succede dopo non è una terza voce: è la riga sotto la cifra,
      dove si legge insieme al prezzo invece che in mezzo a un elenco. */
  items: [
    { t: "Rigenerazione completa", d: "Lo riportiamo alle condizioni del primo giorno: base, densità e colore rifatti a regola." },
    { t: "Oppure la sostituzione", d: "Se è compromesso e non si può recuperare, ne ricevi uno nuovo, ricostruito sul tuo caso." },
  ],
  foot: "450 € per una rigenerazione — o la sostituzione, se è compromesso — nell'arco di 15 mesi. Per altri interventi nello stesso periodo si ripaga l'importo.",
};


/** ── LA MANUTENZIONE COM'È OGGI ───────────────────────────────────────────
 *  `MAINTENANCE` resta il valore di casa; questa funzione è l'unico posto da
 *  cui si legge quello VERO, perché il pannello Listino può cambiarlo.
 *  ⚠️ La riga in fondo («450 € per una rigenerazione … nell'arco di 15 mesi»)
 *   NON si scrive più a mano: si costruisce dai due numeri. Scritta a mano
 *   restava indietro al primo ritocco, e una frase che promette una cifra
 *   diversa da quella stampata sopra è peggio di nessuna frase. */
export function manutenzioneDi(o: PricingOverrides = {}): typeof MAINTENANCE {
  const m = o.manutenzione ?? {};
  const prezzo =
    typeof m.prezzo === "number" && Number.isFinite(m.prezzo) && m.prezzo >= 0
      ? m.prezzo
      : MAINTENANCE.price;
  const mesi =
    typeof m.mesi === "number" && Number.isFinite(m.mesi) && m.mesi > 0
      ? Math.round(m.mesi)
      : MAINTENANCE.everyMonths;
  const euro = prezzo.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return {
    ...MAINTENANCE,
    price: prezzo,
    everyMonths: mesi,
    foot:
      prezzo > 0
        ? `${euro} € per una rigenerazione — o la sostituzione, se è compromesso — nell'arco di ${mesi} mesi. Per altri interventi nello stesso periodo si ripaga l'importo.`
        : `Rigenerazione — o sostituzione, se è compromesso — compresa nell'arco di ${mesi} mesi.`,
  };
}

/** ── L'ACCONTO DI CASA ─────────────────────────────────────────────────────
 *  Cento euro: è quello che questa pagina ha sempre chiesto per aprire la
 *  pratica, e resta il valore quando il listino non dice altro. */
export const ACCONTO_DI_CASA = 100;

/** L'acconto di oggi: quello del listino, se c'è, altrimenti quello di casa.
 *  ⚠️ Zero è un valore LEGITTIMO — «non si chiede acconto» — e va distinto da
 *   «non l'ho impostato», che è l'assenza del campo. Per questo il controllo è
 *   sul tipo, non sulla verità del numero. */
export function accontoDi(o: PricingOverrides = {}, baseId?: string): number {
  /*  ── ⚠️ E UNA SOLUZIONE PUÒ AVERNE UNO SUO ──────────────────────────────
      Richiesta del committente: «per l'opzione patch cutanea l'acconto sia
      diverso rispetto a Invisible Derm Protocol».
      Ha senso: la patch costa un quarto del top di gamma, e lo stesso acconto
      su due prezzi lontani vuol dire due cose diverse — su quello piccolo è
      quasi il totale, e un acconto che pareggia il prezzo smette di essere un
      acconto.
      ⚠️ Assente = vale quello generale. Non zero: zero è una decisione
       («questo prodotto non chiede acconto») e deve restare dicibile. */
  const suo = o.accontoPerBase?.[String(baseId || "")];
  if (typeof suo === "number" && Number.isFinite(suo) && suo >= 0) return suo;
  const a = o.acconto;
  return typeof a === "number" && Number.isFinite(a) && a >= 0 ? a : ACCONTO_DI_CASA;
}

export function buildMenu(o: PricingOverrides = {}) {
  const p = o.prices ?? {}, w = o.was ?? {}, d = o.disabled ?? {};
  //  Spegnere gli sconti si fa QUI, in un punto solo: togliendo il `wasPrice`
  //  alla fonte, non c'è nessun posto a valle che possa dimenticarsene — il
  //  configuratore, il riepilogo, la riga salvata a database e il preventivo
  //  riaperto leggono tutti da qui.
  const sconti = o.upsellSconti !== false;
  /*  ── ⚠️ SPEGNERE GLI SCONTI CAMBIA IL PREZZO, NON SOLO LA GRAFICA ──────
      A sconti spenti si vende al LISTINO: dove esiste un prezzo barrato più
      alto, quello diventa il prezzo e il barrato sparisce (barrare un numero
      uguale a sé stesso non vuol dire niente). Dove il listino non c'è, o è
      più basso del prezzo, non si tocca niente.
      Le due funzioni vanno sempre in coppia: `prezzoDi` e `was` leggono lo
      stesso listino, e separarle vorrebbe dire un prezzo pieno con accanto il
      barrato dello sconto appena tolto. */
  const listinoDi = (id: string, base?: number) => wasOr(w[id], base);
  const prezzoDi = (id: string, prezzo: number, listinoBase?: number) => {
    const corrente = numOr(p[id], prezzo);
    if (sconti) return corrente;
    const pieno = listinoDi(id, listinoBase);
    return typeof pieno === "number" && pieno > corrente ? pieno : corrente;
  };
  const was = (id: string, base?: number) => (sconti ? listinoDi(id, base) : undefined);
  return {
    //  ⚠️ Anche le soluzioni di partenza: hanno un listino barrato come le
    //   altre voci, e lasciarle fuori voleva dire una pagina che toglie gli
    //   sconti dappertutto tranne che dal prezzo più grande.
    base: BASE_SOLUTIONS.filter((b) => !d[b.id]).map((b) => ({
      ...b,
      price: prezzoDi(b.id, b.price, b.wasPrice),
      wasPrice: was(b.id, b.wasPrice),
      desc: b.desc.replace("{DATA_BREVETTO}", patentDateLabel()),
    })),
    //  ⚠️ Le sezioni spente non arrivano nemmeno al preventivo: filtrarle qui
    //   vuol dire che nessun punto a valle — riepilogo, totale, riga salvata —
    //   può dimenticarsene.
    sections: UPSELL_SECTIONS.filter((s) => parteAccesa(o, chiaveSezione(s.num))).map((s) => ({
      ...s,
      items: s.items.filter((i) => !d[i.id]).map((i) => ({ ...i, price: prezzoDi(i.id, i.price, i.wasPrice), wasPrice: was(i.id, i.wasPrice) })),
    })).filter((s) => s.items.length > 0),
    installation: d[INSTALLATION.id] ? null : { ...INSTALLATION, price: numOr(p[INSTALLATION.id], INSTALLATION.price) },
    fitting: FITTING_OPTIONS.filter((f) => !d[f.id]).map((f) => ({ ...f, price: numOr(p[f.id], f.price) })),
    simulation: d[SIMULATION.id] ? null : { ...SIMULATION, price: prezzoDi(SIMULATION.id, SIMULATION.price, SIMULATION.wasPrice), wasPrice: was(SIMULATION.id, SIMULATION.wasPrice) },
    //  ⚠️ Anche la manutenzione viaggia dentro il menu: chi disegna il
    //   preventivo ha già in mano il listino giusto, e andarsela a prendere da
    //   un'altra parte è il modo in cui due schermate cominciano a dire due
    //   cifre diverse.
    manutenzione: manutenzioneDi(o),
    //  ⚠️ E l'acconto con lei, per la stessa ragione: chi disegna il
    //   preventivo ha già in mano il listino giusto.
    acconto: accontoDi(o),
    /*  ⚠️ E la funzione, non solo il numero: l'acconto ADESSO dipende dalla
        soluzione scelta, che il menu non sa — la sceglie la pagina, e cambia
        mentre il cliente guarda. Un numero solo qui vorrebbe dire ricalcolare
        il menu a ogni clic sulla base, o — peggio — dimenticarsene. */
    accontoPer: (baseId?: string) => accontoDi(o, baseId),
    //  Il modello della causale: viaggia col listino, quindi si congela con la
    //  fotografia del preventivo come tutto il resto.
    causale: typeof o.causale === "string" ? o.causale : "",
  };
}

export type QuoteMenu = ReturnType<typeof buildMenu>;

/** ── RITROVARE UNA VOCE DEL PREVENTIVO NEL LISTINO DI OGGI ─────────────────
 *  Un preventivo salva le voci con il NOME, non con il codice: «Mosso — onda
 *  leggera» è la voce «Mosso» più la sotto-scelta, che entra nel nome perché è
 *  così che arriva in produzione. Per ritrovare la voce a listino si prova
 *  prima il nome intero, poi lo si accorcia di un pezzo alla volta togliendo
 *  l'ultima sotto-scelta.
 *  ⚠️ Non si taglia al primo trattino: parecchie voci il trattino ce l'hanno
 *   nel nome vero («Innesto rinforzato — la più duratura»), e tagliare lì
 *   vorrebbe dire non trovarle mai. */
export function voceDiListino(nome: string, menu: QuoteMenu) {
  const tutte = [
    ...menu.sections.flatMap((s) => s.items),
    ...(menu.installation ? [menu.installation] : []),
    ...(menu.simulation ? [menu.simulation] : []),
  ] as { id: string; name: string; price: number; wasPrice?: number }[];
  const chiave = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  let n = String(nome || "");
  for (let i = 0; i < 4 && n; i++) {
    const t = tutte.find((v) => chiave(v.name) === chiave(n));
    if (t) return t;
    const k = n.lastIndexOf(" — ");
    if (k < 0) return null;
    n = n.slice(0, k);
  }
  return null;
}

/** Le stesse voci, ai prezzi di oggi. Il NOME non si tocca: è quello che il
 *  cliente ha letto e che va in produzione, sotto-scelta compresa.
 *  Una voce che dal listino è sparita resta com'era — riprezzarla a zero
 *  vorrebbe dire regalarla, e toglierla vorrebbe dire cambiare il prodotto. */
export function vociAiPrezziDiOggi<T extends { name: string; price: number; wasPrice?: number }>(
  voci: T[],
  menu: QuoteMenu,
): T[] {
  return voci.map((v) => {
    const oggi = voceDiListino(v.name, menu);
    if (!oggi) return v;
    return { ...v, price: Number(oggi.price) || 0, wasPrice: oggi.wasPrice };
  });
}

/** Elenco piatto di tutte le voci con prezzo, per l'editor del CRM. */
export interface PricingRow { id: string; label: string; group: string; price: number; wasPrice?: number; hasWas: boolean; }
export function pricingRows(): PricingRow[] {
  const rows: PricingRow[] = [];
  BASE_SOLUTIONS.forEach((b) => rows.push({ id: b.id, label: b.name, group: "Soluzione base", price: b.price, hasWas: false }));
  UPSELL_SECTIONS.forEach((s) => s.items.forEach((i) => rows.push({ id: i.id, label: i.name, group: s.title, price: i.price, wasPrice: i.wasPrice, hasWas: true })));
  rows.push({ id: INSTALLATION.id, label: INSTALLATION.name, group: "Installazione", price: INSTALLATION.price, hasWas: false });
  FITTING_OPTIONS.forEach((f) => rows.push({ id: f.id, label: f.name, group: "Colore e analisi morfologica", price: f.price, hasWas: false }));
  rows.push({ id: SIMULATION.id, label: SIMULATION.name, group: "Simulazione", price: SIMULATION.price, wasPrice: SIMULATION.wasPrice, hasWas: true });
  return rows;
}
