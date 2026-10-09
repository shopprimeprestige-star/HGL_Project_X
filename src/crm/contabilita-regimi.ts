/** ── COME SI TRATTA UN ACQUISTO, SECONDO DA DOVE ARRIVA ────────────────────
 *
 *  Questa è la tabella che un commercialista ha in testa e che qui dentro
 *  deve stare scritta UNA volta sola: da dove viene il fornitore, se ha
 *  venduto beni o servizi, e da lì tutto il resto — chi paga l'IVA, quale
 *  documento va mandato allo SDI, quando, e se serve anche l'INTRASTAT.
 *
 *  ── ⚠️ PERCHÉ NON BASTAVANO QUATTRO REGIMI ────────────────────────────────
 *  Prima c'erano `italiana / reverse / importazione / senza`, e «reverse»
 *  teneva insieme tre operazioni che in dichiarazione sono TRE COSE DIVERSE:
 *   · i servizi comprati da un fornitore UE (Meta Ireland, Google Ireland),
 *   · i beni comprati da un fornitore UE (acquisto intracomunitario),
 *   · i servizi comprati fuori dall'Unione (fornitori americani, cinesi).
 *  L'IVA si autoliquida in tutti e tre — il conto tornava — ma il documento da
 *  trasmettere allo SDI è TD17 nel primo e nel terzo caso e TD18 nel secondo,
 *  e l'INTRASTAT riguarda solo i primi due. Chi teneva tutto sotto «reverse»
 *  aveva i numeri giusti e gli ADEMPIMENTI indistinguibili: al commercialista
 *  arrivava un elenco in cui le tre cose non si potevano separare, e separarle
 *  a mano a fine trimestre è esattamente il lavoro che questa pagina esiste
 *  per non far fare.
 *
 *  ── ⚠️ IL PROGRAMMA NON INDOVINA IL REGIME ────────────────────────────────
 *  Dallo stesso paese arrivano beni e servizi, e «Amazon» può essere la
 *  società lussemburghese, quella italiana o quella americana. Il paese
 *  RESTRINGE le scelte sensate e le mette in cima; la scelta resta di chi
 *  carica, perché sbagliarla sposta soldi veri.
 *
 *  ── LE NORME, PER CHI VERRÀ DOPO ──────────────────────────────────────────
 *   · art. 7-ter DPR 633/72 — i servizi B2B si tassano dove sta il cliente:
 *     quindi in Italia, e l'imposta la mette chi compra;
 *   · art. 17 c. 2 DPR 633/72 — quando il fornitore non è stabilito in Italia
 *     gli obblighi passano al cessionario italiano;
 *   · artt. 46-47 DL 331/1993 — l'acquisto intracomunitario di beni si
 *     INTEGRA: si scrive l'IVA sul documento del fornitore;
 *   · art. 1 c. 3-bis DLgs 127/2015 — dal 1° luglio 2022 l'esterometro non
 *     esiste più: i dati passano dallo SDI, ed entro il QUINDICI del mese
 *     dopo quello in cui si è ricevuto il documento;
 *   · art. 201 e ss. del codice doganale — sui beni extra-UE l'IVA si paga in
 *     dogana e diventa detraibile con il documento doganale, non con la
 *     fattura del fornitore.
 *  ───────────────────────────────────────────────────────────────────────── */

/** ⚠️ `reverse` NON SI TOGLIE, e non è pigrizia: in archivio ci sono già le
 *  fatture salvate con quella parola, e togliere la chiave le farebbe cadere
 *  nel ripiego «regime sconosciuto» — cioè, di colpo, senza detrazione e senza
 *  autoliquidazione. Resta, si comporta come prima, e la pagina chiede di
 *  precisarlo. Vedi `daPrecisare`. */
export type RegimeIva =
  | "italiana"
  | "ue_servizi"
  | "ue_beni"
  | "estero_servizi"
  | "estero_beni_italia"
  | "importazione"
  | "reverse_interno"
  | "senza"
  | "reverse";

/** Quello che si sa fare di un regime. Un posto solo: `effettiContabili` legge
 *  da qui invece di ripetere la catena di `if`, e il foglio per il
 *  commercialista scrive accanto a ogni riga la stessa cosa. */
export interface Regime {
  chiave: RegimeIva;
  titolo: string;
  spiega: string;
  /** L'imposta si mette a debito e a credito da soli (inversione contabile). */
  autoliquida: boolean;
  /** L'imposta scritta NEL documento si porta in detrazione. Vale solo per le
   *  fatture con IVA italiana esposta e per il documento doganale. */
  detrae: boolean;
  /** Il tipo documento da trasmettere allo SDI. Vuoto = niente da trasmettere
   *  (una fattura italiana ci è già passata da sola). */
  tipoDocumento: "" | "TD16" | "TD17" | "TD18" | "TD19";
  /** Se questa operazione entra negli elenchi INTRASTAT, e in quale. */
  intrastat: "" | "beni" | "servizi";
  /** L'IVA di questo acquisto si paga in dogana: la fattura del fornitore non
   *  ne fa detrarre nessuna, ci vuole il documento doganale. */
  inDogana: boolean;
  /** Va chiesto se sono beni o servizi perché la parola «reverse» da sola non
   *  basta più a compilare gli adempimenti. */
  daPrecisare?: boolean;
  /** Quali paesi hanno senso per questo regime: serve a mettere in cima le
   *  scelte plausibili, mai a escludere le altre. */
  dove: "IT" | "UE" | "EXTRA" | "OVUNQUE";
  /** ── ⚠️ PER CHI DI FISCO NON SA NIENTE ──────────────────────────────────
   *  Richiesta del committente, ed è la parte che decide se questa schermata
   *  serve o no. «Inversione contabile» e «art. 17 c. 2» sono parole giuste e
   *  inutili per chi deve scegliere: dicono COME si chiama la regola, non A
   *  CHI si applica. Queste due righe rispondono alle sole due domande che chi
   *  ha la fattura in mano si sta facendo — «di che paese è chi me l'ha
   *  mandata?» e «ho comprato una cosa o un servizio?» — e portano degli
   *  esempi con dei nomi veri, perché un esempio si riconosce e una
   *  definizione no. */
  chi: string;
  esempi: string;
}

export const REGIMI: Regime[] = [
  {
    chiave: "italiana",
    titolo: "IVA italiana in fattura",
    spiega:
      "Fornitore italiano, o documento doganale. L'imposta scritta nel documento si porta in detrazione, e allo SDI non va trasmesso niente: c'è già passata.",
    autoliquida: false,
    detrae: true,
    tipoDocumento: "",
    intrastat: "",
    inDogana: false,
    chi: "Chi te la manda ha la partita IVA ITALIANA e ti ha scritto l'IVA in fattura (di solito 22%).",
    esempi:
      "Enel, TIM, il commercialista, il corriere, il fornitore di materiale italiano. E anche il documento della dogana.",
    dove: "IT",
  },
  {
    chiave: "ue_servizi",
    titolo: "Servizi da un fornitore UE",
    spiega:
      "Meta Ireland, Google Ireland, un'agenzia tedesca. Il fornitore fattura senza IVA con la tua partita IVA scritta sopra: l'imposta la metti tu, a debito e a credito. Va integrata e trasmessa allo SDI come TD17 entro il 15 del mese dopo, ed entra negli elenchi INTRASTAT servizi se si superano le soglie.",
    autoliquida: true,
    detrae: false,
    tipoDocumento: "TD17",
    intrastat: "servizi",
    inDogana: false,
    chi: "Chi te la manda è una società di un altro paese dell'UNIONE EUROPEA e ti ha venduto un SERVIZIO, non un oggetto. In fattura non c'è IVA e c'è scritta la tua partita IVA.",
    esempi:
      "Meta (Irlanda), Google (Irlanda), un'agenzia tedesca, un abbonamento a un programma francese.",
    dove: "UE",
  },
  {
    chiave: "ue_beni",
    titolo: "Beni da un fornitore UE",
    spiega:
      "Merce che arriva da un altro paese dell'Unione: è un acquisto intracomunitario. Il fornitore non addebita IVA, la si integra sul suo documento e si trasmette come TD18 entro il 15 del mese dopo. INTRASTAT beni sopra le soglie.",
    autoliquida: true,
    detrae: false,
    tipoDocumento: "TD18",
    intrastat: "beni",
    inDogana: false,
    chi: "Chi te la manda è una società di un altro paese dell'UNIONE EUROPEA e ti ha spedito della MERCE, cioè roba che è arrivata in scatola. In fattura non c'è IVA.",
    esempi:
      "Un fornitore tedesco o spagnolo di materiale, un grossista olandese, Amazon quando ti vende merce con società lussemburghese.",
    dove: "UE",
  },
  {
    chiave: "estero_servizi",
    titolo: "Servizi da fuori dall'Unione",
    spiega:
      "Un fornitore americano, cinese, inglese: pubblicità, software, consulenze. L'IVA si autoliquida esattamente come per l'Europa, ma il documento è un'AUTOFATTURA — TD17, entro il 15 del mese dopo. Nessun INTRASTAT: quello riguarda solo l'Unione.",
    autoliquida: true,
    detrae: false,
    tipoDocumento: "TD17",
    intrastat: "",
    inDogana: false,
    chi: "Chi te la manda è una società FUORI dall'Unione Europea e ti ha venduto un SERVIZIO. Niente scatole: pubblicità, programmi, consulenze.",
    esempi:
      "Fornitori americani, inglesi (dal 2021 sono fuori), un servizio comprato online da una società cinese.",
    dove: "EXTRA",
  },
  {
    chiave: "importazione",
    titolo: "Importazione di beni extra-UE",
    spiega:
      "Merce che arriva dalla Cina, da Alibaba, dagli Stati Uniti e passa la dogana. Questa fattura NON porta IVA detraibile: l'imposta si paga in dogana e si detrae con il documento doganale, che si carica a parte come «IVA italiana in fattura». Il costo deducibile è invece questo, dazi e spese comprese.",
    autoliquida: false,
    detrae: false,
    tipoDocumento: "",
    intrastat: "",
    inDogana: true,
    chi: "Chi te la manda è FUORI dall'Unione Europea e ti ha spedito della MERCE che ha passato la DOGANA. Se hai pagato dazi o sdoganamento, è questo.",
    esempi:
      "Alibaba, AliExpress, un fornitore cinese di capelli, un fornitore americano di attrezzatura spedita in Italia.",
    dove: "EXTRA",
  },
  {
    chiave: "estero_beni_italia",
    titolo: "Beni da un fornitore estero, già in Italia",
    spiega:
      "Il caso raro e il più sbagliato di tutti: merce che si compra da una società estera ma che si trova GIÀ in Italia — nessuna dogana da passare, nessun trasporto dall'estero. Non è un'importazione e non è un acquisto intracomunitario: è l'articolo 17 comma 2, autofattura TD19.",
    autoliquida: true,
    detrae: false,
    tipoDocumento: "TD19",
    intrastat: "",
    inDogana: false,
    chi: "Chi te la manda è una società ESTERA ma la merce era GIÀ in Italia: nessuna dogana, nessun trasporto dall'estero. Capita di rado.",
    esempi: "Una società estera con un magazzino in Italia che ti consegna da lì.",
    dove: "EXTRA",
  },
  {
    chiave: "reverse_interno",
    titolo: "Inversione contabile interna",
    spiega:
      "Fornitore ITALIANO che però non addebita l'IVA perché la legge la fa mettere a chi compra: subappalti edili, pulizie su edifici, telefonini e computer all'ingrosso. In fattura c'è scritto «inversione contabile». Si integra e si trasmette come TD16.",
    autoliquida: true,
    detrae: false,
    tipoDocumento: "TD16",
    intrastat: "",
    inDogana: false,
    chi: "Chi te la manda ha la partita IVA ITALIANA ma NON ti ha messo l'IVA, e in fattura c'è scritto «inversione contabile» o «art. 17».",
    esempi:
      "Un'impresa edile in subappalto, una ditta di pulizie su un edificio, un grossista di telefoni o computer.",
    dove: "IT",
  },
  {
    chiave: "senza",
    titolo: "Senza IVA",
    spiega:
      "Operazione fuori campo, non imponibile o esente: un'assicurazione, un'imposta di bollo, un fornitore in regime forfettario. Nessuna imposta da nessuna parte, il costo resta intero.",
    autoliquida: false,
    detrae: false,
    tipoDocumento: "",
    intrastat: "",
    inDogana: false,
    chi: "Sulla fattura non c'è IVA e non c'è nemmeno scritto «inversione contabile»: c'è scritto «esente», «non imponibile», «fuori campo» o «regime forfettario».",
    esempi:
      "Un'assicurazione, una marca da bollo, un professionista in regime forfettario, un medico.",
    dove: "OVUNQUE",
  },
  {
    chiave: "reverse",
    titolo: "Inversione contabile (da precisare)",
    spiega:
      "Come veniva registrata prima che si distinguessero beni e servizi. I numeri restano giusti — l'imposta si autoliquida — ma per sapere se va un TD17 o un TD18, e se serve l'INTRASTAT, bisogna dire cos'era. Riaprila e scegli la voce esatta.",
    autoliquida: true,
    detrae: false,
    //  ⚠️ Vuoto di proposito: TD17 sarebbe il caso più frequente, e proprio per
    //   questo è la scelta pericolosa — un TD17 su un acquisto di BENI
    //   intracomunitari è un errore che nel foglio non si vedrebbe più.
    tipoDocumento: "",
    intrastat: "",
    inDogana: false,
    daPrecisare: true,
    chi: "Non si sa: è come venivano registrate prima che si distinguesse fra merce e servizi, Europa e resto del mondo.",
    esempi:
      "Riapri la fattura, guarda chi te l'ha mandata e cosa hai comprato, e scegli la voce giusta qui sopra.",
    dove: "OVUNQUE",
  },
];

/** ⚠️ IL RIPIEGO VA DALLA PARTE CHE NON SI PUÒ CONTESTARE. Un regime che non
 *  conosciamo — arrivato da una versione futura o da un record corretto a mano
 *  — porta il costo e nessuna detrazione: detrarre un'imposta che forse non
 *  c'è è l'errore che costa, non detrarne una che c'è. */
export const REGIME_SCONOSCIUTO: Regime = {
  chiave: "senza",
  titolo: "Regime non riconosciuto",
  spiega:
    "Questa riga porta un regime che questa versione non conosce: il costo entra intero e non si detrae nessuna imposta, finché qualcuno non la riapre e sceglie.",
  autoliquida: false,
  detrae: false,
  tipoDocumento: "",
  intrastat: "",
  inDogana: false,
  chi: "Questa versione del programma non conosce questo regime.",
  esempi: "Riapri la fattura e scegli una delle voci qui sopra.",
  dove: "OVUNQUE",
};

/** ── LA SPIEGAZIONE CHE COMPARE PASSANDOCI SOPRA IL MOUSE ─────────────────
 *  Tre righe, in quest'ordine: chi te l'ha mandata, esempi veri, cosa comporta.
 *  ⚠️ PRIMA «CHI», POI LA NORMA. Chi sceglie ha una fattura in mano e cerca la
 *   riga che somiglia alla sua: la regola fiscale gli serve dopo aver scelto,
 *   non prima. L'ordine inverso — norma, poi esempi — è quello che rende
 *   illeggibili tutti i moduli fiscali che esistono. */
export function spiegaPerEsteso(r: Regime): string {
  return [r.chi, `Per esempio: ${r.esempi}`, r.daPrecisare ? "" : `Cosa comporta: ${r.spiega}`]
    .filter(Boolean)
    .join("\n\n");
}

export const regimeDi = (chiave?: string | null): Regime =>
  REGIMI.find((r) => r.chiave === chiave) ?? (chiave ? REGIME_SCONOSCIUTO : REGIMI[0]);

/** I paesi dell'Unione, per sigla ISO. Serve a UNA cosa: mettere davanti i
 *  regimi plausibili quando si scrive la sigla del paese, e ad accorgersi di
 *  «CN» scelto insieme a un regime intracomunitario.
 *  ⚠️ Niente Regno Unito: dal 2021 è extra-UE, ed è l'errore che si fa più
 *   spesso perché per anni è stato dentro.
 *  ⚠️ Monaco vale come Francia e San Marino NO: San Marino ha una procedura
 *   sua, con fatture elettroniche che passano dallo SDI. Chi compra da lì
 *   guardi il documento, che lo dice. */
export const PAESI_UE = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

export type Zona = "IT" | "UE" | "EXTRA" | "";

export function zonaDelPaese(paese?: string | null): Zona {
  const p = String(paese ?? "")
    .trim()
    .toUpperCase();
  if (!p) return "";
  if (p === "IT") return "IT";
  return PAESI_UE.has(p) ? "UE" : "EXTRA";
}

/** ── ⚠️ IL PAESE E IL REGIME SI CONTRADDICONO? ────────────────────────────
 *  Avvisa, non blocca — come `intestataANoi`. Una fattura di un fornitore
 *  irlandese registrata come importazione extra-UE non dà nessun errore: dà
 *  un'IVA che nessuno autoliquida e un adempimento che nessuno trasmette, e ci
 *  si accorge quando lo SDI non trova il TD17. Meglio una riga scritta sotto
 *  il campo, subito. */
export function stonatura(paese: string | undefined, regime: RegimeIva): string {
  const zona = zonaDelPaese(paese);
  if (!zona) return "";
  const r = regimeDi(regime);
  if (r.dove === "OVUNQUE") return "";
  if (zona === "UE" && r.dove === "EXTRA")
    return `${String(paese).toUpperCase()} è nell'Unione: questo regime è per i fornitori di fuori.`;
  if (zona === "EXTRA" && r.dove === "UE")
    return `${String(paese).toUpperCase()} è fuori dall'Unione: questo regime vale solo per i paesi UE.`;
  if (zona === "IT" && (r.dove === "UE" || r.dove === "EXTRA"))
    return "Il paese dice Italia: per un fornitore italiano il regime è l'IVA in fattura, o l'inversione contabile interna.";
  if (zona !== "IT" && r.dove === "IT" && regime === "italiana")
    return `Un fornitore di ${String(paese).toUpperCase()} non addebita IVA italiana: controlla che questo non sia invece un documento doganale.`;
  return "";
}

/** ── LE SOGLIE INTRASTAT ───────────────────────────────────────────────────
 *  Sugli ACQUISTI l'elenco è solo statistico e scatta soltanto sopra queste
 *  soglie, misurate su un trimestre: sotto, non si presenta niente. È il
 *  motivo per cui questa pagina dice «potrebbe servire» e non «serve».
 *  ⚠️ La soglia si guarda sui quattro trimestri precedenti, non su quello in
 *   corso: chi la supera diventa mensile dal mese dopo. Il conto vero lo fa il
 *   commercialista; qui si accende una spia. */
export const SOGLIA_INTRASTAT_BENI = 350_000;
export const SOGLIA_INTRASTAT_SERVIZI = 100_000;

/** Cosa c'è da FARE per questa fattura, in una riga sola, per il foglio del
 *  commercialista e per la scheda della fattura. */
export function adempimento(regime: RegimeIva): string {
  const r = regimeDi(regime);
  if (r.daPrecisare) return "Da precisare: beni o servizi, UE o extra-UE";
  const pezzi: string[] = [];
  if (r.tipoDocumento) pezzi.push(`${r.tipoDocumento} allo SDI entro il 15 del mese dopo`);
  if (r.intrastat) pezzi.push(`INTRASTAT ${r.intrastat} sopra le soglie`);
  if (r.inDogana) pezzi.push("l'IVA si detrae con il documento doganale, da caricare a parte");
  return pezzi.join(" · ") || "Niente da trasmettere";
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL VERDETTO — cosa hai in mano, e cosa ci puoi fare
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ LA RISPOSTA ALLE TRE DOMANDE, PRIMA DI SALVARE ────────────────────
 *  Richiesta del committente, e nasce da una cosa vera: chi carica una fattura
 *  estera non si sta chiedendo quale sia il regime — si sta chiedendo «questa
 *  la posso scaricare o no, e adesso cosa devo fare». Il regime è il mezzo per
 *  rispondere, non la risposta.
 *  Questo verdetto compare appena il documento è stato letto, PRIMA del
 *  pulsante che salva: sapere dopo aver salvato non serve a niente. */
export interface Verdetto {
  titolo: string;
  /** Il paese scritto per esteso: «Irlanda» dice più di «IE». */
  provenienza: string;
  costo: string;
  iva: string;
  /** I passi, nell'ordine in cui vanno fatti. */
  passi: string[];
  /** Un blocco: qualcosa non va, e va detto prima di tutto il resto. */
  allarme?: string;
}

const NOMI_PAESE: Record<string, string> = {
  IT: "Italia",
  IE: "Irlanda",
  DE: "Germania",
  FR: "Francia",
  ES: "Spagna",
  NL: "Paesi Bassi",
  BE: "Belgio",
  LU: "Lussemburgo",
  AT: "Austria",
  PT: "Portogallo",
  PL: "Polonia",
  SE: "Svezia",
  DK: "Danimarca",
  FI: "Finlandia",
  GR: "Grecia",
  RO: "Romania",
  CZ: "Cechia",
  SK: "Slovacchia",
  HU: "Ungheria",
  HR: "Croazia",
  SI: "Slovenia",
  BG: "Bulgaria",
  EE: "Estonia",
  LV: "Lettonia",
  LT: "Lituania",
  CY: "Cipro",
  MT: "Malta",
  CN: "Cina",
  US: "Stati Uniti",
  GB: "Regno Unito",
  CH: "Svizzera",
  JP: "Giappone",
  IN: "India",
  TR: "Turchia",
  CA: "Canada",
  AU: "Australia",
  HK: "Hong Kong",
  SG: "Singapore",
  AE: "Emirati Arabi",
  KR: "Corea del Sud",
  TW: "Taiwan",
};

export const nomeDelPaese = (sigla?: string | null): string => {
  const p = String(sigla ?? "")
    .trim()
    .toUpperCase();
  return NOMI_PAESE[p] ?? p;
};

export function verdetto(opzioni: {
  regime: RegimeIva;
  paese?: string;
  notaDiCredito?: boolean;
  emessaDaNoi?: boolean;
  /** L'imposta scritta in fattura, per dire una cifra invece di una regola. */
  imposta?: number;
  /** Quella che si autoliquiderà. */
  autoliquidata?: number;
}): Verdetto {
  const r = regimeDi(opzioni.regime);
  const zona = zonaDelPaese(opzioni.paese);
  const paese = nomeDelPaese(opzioni.paese);
  const euro = (n?: number) =>
    n && n > 0
      ? `${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      : "";

  //  ⚠️ IL BLOCCO VIENE PRIMA DI TUTTO, e non è un avviso fra gli altri:
  //   caricare una propria fattura fra i costi è un errore a quattro cifre.
  if (opzioni.emessaDaNoi) {
    return {
      titolo: "Questa fattura l'hai emessa TU",
      provenienza: "la tua società",
      costo: "NO — è un tuo ricavo, non un costo",
      iva: "è IVA che DEVI allo Stato, non IVA da detrarre",
      allarme:
        "Sul documento la partita IVA della tua società sta dalla parte di chi manda la fattura, non di chi la riceve. Caricandola qui un tuo ricavo diventerebbe un costo e l'IVA a debito diventerebbe IVA a credito: un errore che nessuna somma torna a smentire. Le tue fatture stanno in «Fatture», non qui.",
      passi: [],
    };
  }

  const che = opzioni.notaDiCredito ? "Nota di credito" : "Fattura";
  const cosa =
    r.chiave === "ue_beni" || r.chiave === "importazione"
      ? "di merce"
      : r.chiave === "ue_servizi" || r.chiave === "estero_servizi"
        ? "di servizi"
        : "";
  const titolo = [
    che,
    cosa,
    zona === "IT" ? "da un fornitore italiano" : paese ? `da ${paese}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const costo = opzioni.notaDiCredito
    ? "TOGLIE costo: è un rimborso, in contabilità si sottrae"
    : "SÌ, per intero — salvo le regole che hai messo su questa voce";

  const iva = r.detrae
    ? `La detrai: ${euro(opzioni.imposta) || "quella scritta in fattura"} tornano indietro`
    : r.autoliquida
      ? `La metti tu: ${euro(opzioni.autoliquidata) || "l'imposta calcolata"} a debito E a credito insieme. Se è detraibile il saldo è zero — non paghi niente in più`
      : r.inDogana
        ? "NON da questo documento: l'IVA della merce extra-UE si paga in dogana e si detrae con il documento doganale"
        : "Non ce n'è: su questo documento l'IVA non c'è e non se ne detrae";

  const passi: string[] = [];
  if (r.daPrecisare) {
    passi.push(
      "PRIMA scegli la riga giusta qui sotto: beni o servizi, Europa o fuori. Senza, non si sa quale documento vada trasmesso.",
    );
  }
  passi.push(
    "Salvala: il costo entra nel conto del periodo e nel pacchetto per il commercialista.",
  );
  if (r.tipoDocumento) {
    passi.push(
      `Va trasmesso allo SDI un ${r.tipoDocumento} entro il 15 del mese DOPO quello in cui hai ricevuto il documento. Lo fa il commercialista, ma deve saperlo: è nel foglio «da trasmettere allo SDI» dello zip.`,
    );
  }
  if (r.intrastat) {
    passi.push(
      `Se in un trimestre superi ${r.intrastat === "beni" ? "350.000 €" : "100.000 €"} di acquisti di questo tipo, serve anche l'elenco INTRASTAT ${r.intrastat}. Sotto quella soglia, niente.`,
    );
  }
  if (r.inDogana) {
    passi.push(
      "Quando arriva il documento doganale, caricalo a parte scegliendo «IVA italiana in fattura»: è QUELLO a farti detrarre l'imposta. Trasporto e dazi pagati sono costo: sommali all'importo.",
    );
  }
  if (!r.tipoDocumento && !r.inDogana && !r.daPrecisare) {
    passi.push("Non c'è nient'altro da trasmettere: questo documento è già passato dallo SDI.");
  }

  return { titolo, provenienza: paese || "non indicata", costo, iva, passi };
}
