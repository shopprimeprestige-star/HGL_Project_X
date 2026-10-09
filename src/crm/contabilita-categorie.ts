/** ── CHE COSA HAI IN MANO ──────────────────────────────────────────────────
 *
 *  La prima domanda del caricamento, e quella che decide tutto il resto: una
 *  fattura di Meta, una bolletta doganale e lo scontrino di un pranzo si
 *  registrano in tre modi diversi, e nessuno dei tre si indovina dal file.
 *
 *  ── ⚠️ PERCHÉ SI CHIEDE PRIMA, E NON DOPO ────────────────────────────────
 *  Prima il caricamento era: scegli il file, poi correggi i campi. Funziona
 *  su una fattura italiana, dove non c'è quasi niente da decidere. Su tutto
 *  il resto no: chi carica un pranzo non sa che la legge ne fa dedurre tre
 *  quarti, e non lo va a cercare — vede un modulo pieno e preme salva.
 *  Chiedendolo prima, il modulo si apre già impostato e la spiegazione arriva
 *  quando serve a qualcosa, cioè prima della firma.
 *
 *  ── ⚠️ LE PERCENTUALI SONO LEGGE, NON PREFERENZE ─────────────────────────
 *  Ristoranti al 75%, auto al 20%, cellulare all'80%: sono articoli del TUIR,
 *  citati uno per uno qui sotto. Il CRM prima li scaricava tutti al 100%, che
 *  è un errore SEMPRE dalla stessa parte — la propria — e quindi quello che
 *  in una verifica si paga con le sanzioni.
 *  ⚠️ Restano CORREGGIBILI: la percentuale finisce in un campo che si vede e
 *   si cambia. Un'auto davvero strumentale (il furgone che porta gli impianti)
 *   si deduce al 100%, e chi lo sa lo dice — ma parte dal caso normale, non
 *   dall'eccezione.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { RegimeIva } from "./contabilita-regimi";

export interface CategoriaSpesa {
  chiave: string;
  titolo: string;
  /** Una riga: che cos'è, con degli esempi. Si legge nella scelta. */
  esempi: string;
  /** Il regime IVA da cui partire. Assente = lo decide il documento. */
  regime?: RegimeIva;
  /** Quanto se ne deduce, per legge. Assente = tutto. */
  percentuale?: number;
  /** Quanta IVA si detrae. Assente = tutta.
   *  ⚠️ E' un numero DIVERSO dal precedente, e non e' una svista: sull'auto la
   *   legge fa dedurre il 20% del costo e detrarre il 40% dell'IVA. Sono due
   *   articoli diversi — 164 TUIR e 19-bis1 DPR 633/72 — scritti in due anni
   *   diversi per due ragioni diverse. Metterne uno solo sbaglierebbe sempre
   *   uno dei due conti. */
  percentualeIva?: number;
  /** L'articolo, perché una percentuale senza la sua norma è un numero
   *  inventato — e perché il commercialista lo chiede. */
  norma?: string;
  /** true = la legge chiede che sia pagato con mezzi tracciabili. */
  tracciabile?: boolean;
  /** Quello che chi carica deve sapere PRIMA di salvare. */
  avviso?: string;
}

export const CATEGORIE: CategoriaSpesa[] = [
  {
    chiave: "merce",
    titolo: "Merce e materiali",
    esempi: "Capelli, basi, materiale di consumo, lavorazioni esterne",
    regime: "italiana",
  },
  {
    chiave: "pubblicita",
    titolo: "Pubblicità online",
    esempi: "Meta, Google, TikTok",
    /*  ⚠️ Il regime NON è fissato qui: Meta e Google fatturano dall'Irlanda
        (UE, TD17 + INTRASTAT), TikTok dal Regno Unito (extra-UE, TD17 senza
        INTRASTAT). Lo decide il nome che c'è sul documento — l'elenco dei
        fornitori noti in contabilita-pdf — e sovrascriverlo qui vorrebbe dire
        rompere proprio la distinzione che quell'elenco esiste per fare. */
    avviso:
      "Si autoliquida: l'IVA la versi e la detrai nello stesso momento, quindi non costa niente — ma va dichiarata. Il documento (TD17) lo prepara il CRM.",
  },
  {
    chiave: "estero",
    titolo: "Fornitore estero, merce",
    esempi: "Cina, Stati Uniti, Alibaba: roba che passa la dogana",
    regime: "importazione",
    avviso:
      "L'IVA non si detrae da questa fattura: si paga in dogana e si detrae dalla BOLLETTA, che va allegata e poi registrata a parte.",
  },
  {
    chiave: "servizi_esteri",
    titolo: "Fornitore estero, servizi",
    esempi: "Software, hosting, consulenze da fuori Italia",
    regime: "estero_servizi",
    avviso: "Si autoliquida (TD17): l'IVA si versa e si detrae insieme.",
  },
  {
    chiave: "corriere",
    titolo: "Corriere e spedizioni",
    esempi: "FedEx, DHL, GLS, Poste",
    avviso:
      "Guarda le righe: il trasporto internazionale è non imponibile (art. 9) e l'IVA doganale che ti hanno anticipato è fuori campo (art. 15) — quella si detrae dalla bolletta, non da qui.",
  },
  {
    chiave: "ristorante",
    titolo: "Ristoranti, bar e alberghi",
    esempi: "Pranzi di lavoro, cene, hotel in trasferta",
    regime: "italiana",
    percentuale: 75,
    norma: "art. 109 c. 5 TUIR",
    tracciabile: true,
    avviso:
      "Se ne deduce il 75%, non tutto. E dal 2025 vitto e alloggio si deducono SOLO se pagati con carta, bonifico o app: in contanti non si scarica niente.",
  },
  {
    chiave: "carburante",
    titolo: "Carburante e auto",
    esempi: "Benzina, gasolio, pedaggi, manutenzione dell'auto",
    regime: "italiana",
    percentuale: 20,
    percentualeIva: 40,
    norma: "art. 164 c. 1 lett. b TUIR · art. 19-bis1 lett. c DPR 633/72",
    tracciabile: true,
    avviso:
      "Auto non strumentale: si deduce il 20% e l'IVA si detrae al 40%. In contanti non si scarica niente (art. 19-bis1). Se è un veicolo STRUMENTALE — il furgone che porta gli impianti e non fa altro — porta la percentuale a 100 e dillo nelle note.",
  },
  {
    chiave: "telefono",
    titolo: "Telefono cellulare",
    esempi: "SIM aziendali, ricariche, abbonamenti mobili",
    regime: "italiana",
    percentuale: 80,
    /*  ⚠️ L'IVA sul cellulare la legge non la fissa: si detrae «in base
        all'uso aziendale» (art. 19 c. 4). Il 50% è la misura che l'Agenzia
        accetta senza contestare quando l'apparecchio serve a tutte e due le
        cose, ed è il caso normale di una società piccola. Chi ha una SIM che
        fa SOLO lavoro porta il campo a 100 e lo scrive nelle note. */
    percentualeIva: 50,
    norma: "art. 102 c. 9 TUIR · art. 19 c. 4 DPR 633/72",
    avviso:
      "Telefonia mobile: se ne deduce l'80% e l'IVA si detrae per la quota di uso aziendale — di norma il 50%. Il telefono fisso invece è intero.",
  },
  {
    chiave: "rappresentanza",
    titolo: "Regali e rappresentanza",
    esempi: "Omaggi ai clienti, eventi, cene di rappresentanza",
    regime: "italiana",
    percentualeIva: 0,
    norma: "art. 108 c. 2 TUIR · art. 19-bis1 lett. h DPR 633/72",
    tracciabile: true,
    avviso:
      "L'IVA NON si detrae, salvo gli omaggi sotto i 50 €. E la deduzione ha un tetto sui ricavi (1,5% fino a 10 milioni): se in un anno ne fai tante, falle vedere al commercialista.",
  },
  {
    chiave: "studio",
    titolo: "Consulenze e servizi",
    esempi: "Commercialista, avvocato, software, banca, assicurazioni",
    regime: "italiana",
  },
  {
    chiave: "locale",
    titolo: "Locale e utenze",
    esempi: "Affitto, luce, gas, acqua, internet",
    regime: "italiana",
  },
  {
    chiave: "personale",
    titolo: "Spesa personale",
    esempi: "Supermercato, spese di famiglia, multe",
    regime: "italiana",
    percentuale: 0,
    percentualeIva: 0,
    avviso:
      "Non si scarica niente: non è inerente all'attività. Si registra lo stesso — i soldi sono usciti e si vedono nell'utile reale — ma non abbassa le imposte. Le multe non si deducono mai, nemmeno quelle prese lavorando.",
  },
  {
    chiave: "altro",
    titolo: "Altro",
    esempi: "Non lo so, decido dopo",
  },
];

export const categoriaDi = (chiave: string): CategoriaSpesa | undefined =>
  CATEGORIE.find((c) => c.chiave === chiave);
