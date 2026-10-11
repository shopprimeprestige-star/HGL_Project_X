/** ── L'INDIRIZZO SUGGERITO MENTRE SI SCRIVE ────────────────────────────────
 *
 *  Si scrive «via berling» e compaiono gli indirizzi veri; se ne sceglie uno e
 *  via, civico, CAP, comune e provincia si riempiono da soli. Serve in due
 *  posti — la fattura e il preventivo — e su una fattura elettronica un CAP
 *  sbagliato la fa scartare dallo SDI.
 *
 *  ── ⚠️ NON È GOOGLE, E VA DETTO ───────────────────────────────────────────
 *  Il committente ha chiesto «l'autocompletamento di Google». Le API di Google
 *  Places vogliono una chiave a pagamento legata a un progetto Cloud e a una
 *  carta: in questo progetto non c'è, e non è una cosa che un programma possa
 *  procurarsi da solo. Metterci una chiave finta darebbe una casella che non
 *  suggerisce niente e nessuna spiegazione del perché.
 *  Si usa quindi Photon (photon.komoot.io), che è gratuito, non vuole chiavi,
 *  è costruito apposta per il suggerimento mentre si digita e sta sui dati di
 *  OpenStreetMap — in Italia, sugli indirizzi urbani, sono buoni.
 *
 *  ⚠️ IL GIORNO IN CUI ARRIVA UNA CHIAVE GOOGLE si cambia SOLO `cerca` qui
 *   sotto: tutto il resto — il ritardo, l'annullamento, la forma del
 *   risultato, il campo che lo mostra — resta com'è. È il motivo per cui la
 *   ricerca è una funzione sola e separata dal disegno.
 *
 *  ── ⚠️ SI ASPETTA CHE SMETTA DI SCRIVERE ──────────────────────────────────
 *  Una richiesta per tasto premuto vuol dire quaranta richieste per un
 *  indirizzo, e un servizio gratuito che ci mette alla porta. Si aspettano
 *  350 millesimi di silenzio, e la richiesta precedente si ANNULLA — senza,
 *  la risposta lenta di «via ber» arriva dopo quella di «via berlinguer» e
 *  sovrascrive i suggerimenti giusti con quelli vecchi.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Un indirizzo già spezzato nei campi che servono a una fattura. */
export interface IndirizzoScelto {
  /** La sola via, senza il numero: il tracciato li vuole separati. */
  indirizzo: string;
  civico: string;
  cap: string;
  comune: string;
  /** La sigla di due lettere. Vuota se non si è riusciti a ricavarla. */
  provincia: string;
  /** ISO due lettere: «IT». */
  nazione: string;
  /** Come si legge tutto insieme, per mostrarlo nell'elenco. */
  esteso: string;
}

/** ── LE SIGLE DELLE PROVINCE ──────────────────────────────────────────────
 *  ⚠️ Servono perché il tracciato della fattura elettronica vuole due lettere,
 *   e i servizi di indirizzi restituiscono il NOME della provincia. Senza
 *   questa tabella il campo resterebbe vuoto e andrebbe scritto a mano ogni
 *   volta — cioè la cosa che questo file esiste per evitare.
 *  ⚠️ Le province cambiano: quelle sciolte (Carbonia-Iglesias, Olbia-Tempio,
 *   Medio Campidano, Ogliastra) non ci sono più dal 2016 e non sono qui. Se
 *   una manca, il campo resta vuoto: meglio vuoto che sbagliato. */
const SIGLE: Record<string, string> = {
  agrigento: "AG",
  alessandria: "AL",
  ancona: "AN",
  aosta: "AO",
  arezzo: "AR",
  "ascoli piceno": "AP",
  asti: "AT",
  avellino: "AV",
  bari: "BA",
  "barletta-andria-trani": "BT",
  belluno: "BL",
  benevento: "BN",
  bergamo: "BG",
  biella: "BI",
  bologna: "BO",
  bolzano: "BZ",
  brescia: "BS",
  brindisi: "BR",
  cagliari: "CA",
  caltanissetta: "CL",
  campobasso: "CB",
  caserta: "CE",
  catania: "CT",
  catanzaro: "CZ",
  chieti: "CH",
  como: "CO",
  cosenza: "CS",
  cremona: "CR",
  crotone: "KR",
  cuneo: "CN",
  enna: "EN",
  fermo: "FM",
  ferrara: "FE",
  firenze: "FI",
  foggia: "FG",
  "forlì-cesena": "FC",
  "forli-cesena": "FC",
  frosinone: "FR",
  genova: "GE",
  gorizia: "GO",
  grosseto: "GR",
  imperia: "IM",
  isernia: "IS",
  "l'aquila": "AQ",
  laquila: "AQ",
  spezia: "SP",
  "la spezia": "SP",
  latina: "LT",
  lecce: "LE",
  lecco: "LC",
  livorno: "LI",
  lodi: "LO",
  lucca: "LU",
  macerata: "MC",
  mantova: "MN",
  "massa-carrara": "MS",
  "massa e carrara": "MS",
  matera: "MT",
  messina: "ME",
  milano: "MI",
  modena: "MO",
  "monza e della brianza": "MB",
  "monza e brianza": "MB",
  napoli: "NA",
  novara: "NO",
  nuoro: "NU",
  oristano: "OR",
  padova: "PD",
  palermo: "PA",
  parma: "PR",
  pavia: "PV",
  perugia: "PG",
  "pesaro e urbino": "PU",
  pescara: "PE",
  piacenza: "PC",
  pisa: "PI",
  pistoia: "PT",
  pordenone: "PN",
  potenza: "PZ",
  prato: "PO",
  ragusa: "RG",
  ravenna: "RA",
  "reggio calabria": "RC",
  "reggio nell'emilia": "RE",
  "reggio emilia": "RE",
  rieti: "RI",
  rimini: "RN",
  roma: "RM",
  rovigo: "RO",
  salerno: "SA",
  sassari: "SS",
  savona: "SV",
  siena: "SI",
  siracusa: "SR",
  sondrio: "SO",
  "sud sardegna": "SU",
  taranto: "TA",
  teramo: "TE",
  terni: "TR",
  torino: "TO",
  trapani: "TP",
  trento: "TN",
  treviso: "TV",
  trieste: "TS",
  udine: "UD",
  varese: "VA",
  venezia: "VE",
  "verbano-cusio-ossola": "VB",
  vercelli: "VC",
  verona: "VR",
  "vibo valentia": "VV",
  vicenza: "VI",
  viterbo: "VT",
};

/** ⚠️ Esportata perché la usa anche la rotta del servitore: Google non sempre
 *  dà la sigla di due lettere, e quando dà il nome per esteso deve passare
 *  dalla stessa tabella di Photon. Due tabelle vorrebbero dire due province
 *  diverse per lo stesso comune. */
export const siglaProvincia = (nome: string): string => {
  const n = String(nome ?? "")
    .toLowerCase()
    /*  ⚠️ I nomi arrivano come li scrive OpenStreetMap: «Roma Capitale»,
        «Città metropolitana di Milano», «Libero consorzio comunale di Ragusa».
        Si toglie il contorno e resta il nome della provincia. */
    .replace(
      /^(provincia|città metropolitana|citta metropolitana|libero consorzio comunale)\s+(di\s+)?/,
      "",
    )
    .replace(/\s+capitale$/, "")
    .trim();
  return SIGLE[n] ?? "";
};
const sigla = siglaProvincia;

interface RispostaPhoton {
  features?: {
    properties?: Record<string, string | undefined>;
  }[];
}

/** Come si legge un indirizzo in una riga sola. */
const perEsteso = (i: Omit<IndirizzoScelto, "esteso">): string =>
  [
    [i.indirizzo, i.civico].filter(Boolean).join(" "),
    [i.cap, i.comune].filter(Boolean).join(" "),
    i.provincia,
  ]
    .filter(Boolean)
    .join(", ");

/** ── LA RICERCA ───────────────────────────────────────────────────────────
 *  ⚠️ È l'UNICA funzione da cambiare per passare a Google: prende del testo,
 *   torna degli indirizzi già spezzati. Tutto il resto non sa da dove vengono.
 *  ⚠️ `segnale` serve ad annullare la richiesta di prima: vedi la nota in
 *   testa al file. */
export async function cerca(testo: string, segnale?: AbortSignal): Promise<IndirizzoScelto[]> {
  const q = String(testo ?? "").trim();
  if (q.length < 4) return [];
  /*  ── ⚠️ ADESSO SI CHIEDE A CASA NOSTRA ────────────────────────────────
      La rotta `/api/indirizzi` decide da sola se usare Google (quando in
      impostazioni c'è una chiave) o Photon, e restituisce la stessa identica
      forma. Il campo non lo sa e non deve saperlo: era la promessa scritta
      qui sopra il giorno che si è scelto Photon, e questa è la riga che la
      mantiene.
      ⚠️ La chiave di Google NON passa mai dal browser: il perché sta in
       routes/api.indirizzi. */
  try {
    const r = await fetch(`/api/indirizzi?q=${encodeURIComponent(q)}`, { signal: segnale });
    if (r.ok) return (await r.json()) as IndirizzoScelto[];
  } catch (e) {
    //  ⚠️ Un annullamento NON è un guasto: se si ripiegasse su Photon si
    //   rifarebbe la richiesta appena annullata, e la risposta vecchia
    //   arriverebbe dopo quella nuova sovrascrivendo i suggerimenti giusti.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
  }
  //  Il servitore non risponde (rilascio in corso, rete che cade): si chiede
  //  direttamente a Photon, come si faceva prima che la rotta esistesse.
  return cercaConPhoton(q, segnale);
}

/** La ricerca su Photon, nuda. ⚠️ Esportata perché la usa anche la rotta del
 *  servitore come ripiego quando Google non risponde: due copie di questa
 *  funzione vorrebbero dire due modi di leggere lo stesso indirizzo. */
export async function cercaConPhoton(
  testo: string,
  segnale?: AbortSignal,
): Promise<IndirizzoScelto[]> {
  const q = String(testo ?? "").trim();
  if (q.length < 4) return [];
  //  ⚠️ NIENTE `lang=it`: Photon accetta solo default, de, en e fr, e con una
  //   lingua che non conosce risponde 400 — cioè nessun suggerimento, mai.
  //   L'ho scoperto provandolo: i nomi italiani tornano comunque in italiano,
  //   perché sono quelli scritti nei dati.
  const url = "https://photon.komoot.io/api/?limit=6&q=" + encodeURIComponent(q);
  const r = await fetch(url, { signal: segnale });
  if (!r.ok) throw new Error(`il servizio degli indirizzi ha risposto ${r.status}`);
  const dati = (await r.json()) as RispostaPhoton;
  const fuori: IndirizzoScelto[] = [];
  for (const f of dati.features ?? []) {
    const p = f.properties ?? {};
    //  ⚠️ Senza una via non è un indirizzo: è una città, un monumento, un
    //   quartiere. In un campo «indirizzo del cliente» quelle sono rumore.
    const via = p.street || p.name || "";
    if (!via) continue;
    const comune = p.city || p.town || p.village || p.district || p.county || "";
    const base = {
      indirizzo: via,
      civico: p.housenumber ?? "",
      cap: p.postcode ?? "",
      comune,
      provincia: sigla(p.county ?? "") || sigla(p.state ?? ""),
      nazione: (p.countrycode ?? "IT").toUpperCase(),
    };
    const i = { ...base, esteso: perEsteso(base) };
    //  Due suggerimenti identici a leggersi sono un suggerimento solo.
    if (!fuori.some((x) => x.esteso === i.esteso)) fuori.push(i);
  }
  return fuori;
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL COMPORTAMENTO DEL CAMPO, SENZA IL SUO VESTITO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ PERCHÉ UN GANCIO E NON DUE CAMPI ──────────────────────────────────
 *  Questo campo serve in due pagine che non si somigliano: la fattura nel CRM
 *  (fondo chiaro, componenti del CRM) e il preventivo (pagina pubblica, fondo
 *  scuro, campi suoi). Copiare il campo avrebbe voluto dire copiare l'attesa,
 *  l'annullamento, la chiusura al tocco fuori e il ripiego quando il servizio
 *  non risponde — cioè sei comportamenti sottili, in due copie, che divergono
 *  al primo ritocco. Quello che è uguale sta qui; quello che è diverso è solo
 *  il disegno, e resta nelle due pagine.
 *  ⚠️ Il gancio NON tocca il valore del campo: chi lo usa resta padrone del
 *   proprio stato. Un gancio che scrive nel campo di qualcun altro è un gancio
 *   che, il giorno che due pagine lo usano diversamente, ne rompe una. */
import { useEffect, useRef, useState } from "react";

export function useIndirizziSuggeriti(valore: string, comune?: string) {
  const [suggerimenti, setSuggerimenti] = useState<IndirizzoScelto[]>([]);
  const [aperto, setAperto] = useState(false);
  const [cercando, setCercando] = useState(false);
  /** Quello che è stato appena scelto: non si richiede al servizio quello che
   *  il servizio ha appena risposto. Senza, scegliendo un suggerimento il campo
   *  si riempie, la ricerca riparte su quel testo e la tendina si riapre da
   *  sola sotto le dita. */
  const appenaScelto = useRef("");

  useEffect(() => {
    const q = String(valore ?? "").trim();
    if (!q || q === appenaScelto.current || q.length < 4) {
      setSuggerimenti([]);
      return;
    }
    //  ⚠️ Si aspetta il silenzio e si annulla la richiesta di prima: il perché
    //   sta in testa a questo file.
    const taglia = new AbortController();
    const quando = window.setTimeout(() => {
      setCercando(true);
      void cerca(comune ? `${q} ${comune}` : q, taglia.signal)
        .then((r) => {
          setSuggerimenti(r);
          setAperto(r.length > 0);
        })
        .catch(() => {
          //  Servizio giù, o richiesta annullata: si tace e il campo resta un
          //  campo. Un errore rosso su un aiuto facoltativo spaventa e basta.
          setSuggerimenti([]);
        })
        .finally(() => setCercando(false));
    }, 350);
    return () => {
      window.clearTimeout(quando);
      taglia.abort();
    };
  }, [valore, comune]);

  return {
    suggerimenti,
    aperto,
    cercando,
    /** Da chiamare quando il campo riceve il fuoco. */
    riapri: () => setAperto(suggerimenti.length > 0),
    /** Da chiamare quando il campo perde il fuoco, o si preme fuori.
     *  ⚠️ CON UN RITARDO da chi lo usa: il clic su un suggerimento toglie il
     *   fuoco al campo, e chiudendo subito la tendina il clic cade nel vuoto. */
    chiudi: () => setAperto(false),
    /** Da chiamare quando l'utente scrive: annulla la memoria della scelta. */
    scritto: () => {
      appenaScelto.current = "";
    },
    /** Da chiamare quando ne sceglie uno: chiude e non lo ricerca. */
    scelto: (i: IndirizzoScelto) => {
      appenaScelto.current = [i.indirizzo, i.civico].filter(Boolean).join(" ");
      setAperto(false);
      setSuggerimenti([]);
    },
  };
}
