/** ── «MI MANDI I DATI PER LA FATTURA?» ──────────────────────────────────────
 *
 *  Il messaggio che si manda al cliente quando per fatturare manca qualcosa.
 *  Modulo puro, senza React: il testo che parte a un cliente vero è la cosa
 *  che vale la pena poter provare senza aprire il programma.
 *
 *  ── COME È SCRITTO, E PERCHÉ COSÌ ────────────────────────────────────────
 *  Si dà del tu e si chiama la persona per nome. Non è confidenza a caso: chi
 *  riceve il messaggio ha già parlato con noi al telefono e in videochiamata,
 *  ha già versato dei soldi. Un «Gentile Sig. Rossi, si richiede cortesemente»
 *  dopo quel percorso suona come una lettera dell'ufficio recupero crediti, e
 *  la reazione a una lettera così non è mandare il codice fiscale: è
 *  chiedersi se c'è un problema.
 *
 *  ⚠️ SI CHIEDE SOLO QUELLO CHE MANCA DAVVERO. Un elenco di sei voci di cui
 *   quattro le abbiamo già è il modo più sicuro di non ricevere risposta: chi
 *   legge pensa «devo mettermi lì con calma» e rimanda. Due righe si mandano
 *   dal divano.
 *
 *  ⚠️ E SI DICE PERCHÉ. «Mi servono per la fattura» trasforma una richiesta di
 *   dati personali — che via chat mette a disagio chiunque — in un atto
 *   burocratico ovvio, di cui il cliente capisce da solo il senso.
 */

/** I dati del cliente, per come li conosce la fattura. Volutamente permissivo:
 *  questo modulo non deve importare i tipi delle fatture per poter restare
 *  provabile da solo. */
export interface DatiPerFattura {
  azienda?: boolean;
  denominazione?: string;
  nome?: string;
  cognome?: string;
  codiceFiscale?: string;
  partitaIva?: string;
  indirizzo?: string;
  cap?: string;
  comune?: string;
  provincia?: string;
  pec?: string;
  codiceDestinatario?: string;
}

/** ── DI CHE FATTURA STIAMO PARLANDO ────────────────────────────────────────
 *  ⚠️ NON È UN DETTAGLIO DI STILE. «Sto preparando la tua fattura» scritto a
 *   chi ha versato un acconto di 750 su 2.500 fa una promessa che il documento
 *   non mantiene: quando la fattura arriva, l'importo non è quello della
 *   pratica e il cliente chiama per chiedere se c'è un errore. Dirlo prima —
 *   «la fattura dell'acconto che hai versato» — costa tre parole e toglie
 *   quella telefonata.
 */
export interface ContestoFattura {
  /** Quello che ha scelto chi sta fatturando, quando l'ha scelto. */
  tipo?: "acconto" | "saldo" | "unica";
  /** L'importo che finisce in fattura, IVA compresa. */
  importo?: number;
  /** Il prezzo pieno della pratica, IVA compresa. */
  prezzo?: number;
}

/** ⚠️ IL TIPO SI DEDUCE DAI NUMERI, non si aspetta che qualcuno lo dichiari.
 *  Chi scrive il messaggio sta guardando i dati del cliente, non la riga
 *  «acconto / saldo / importo intero» che sta in un'altra parte della
 *  finestra: se il testo dipendesse solo da quella scelta, basterebbe non
 *  toccarla per mandare al cliente la frase sbagliata.
 *  La regola è quella dell'IVA, ed è la stessa che rende diverse le due
 *  fatture: se l'imponibile di questo documento è TUTTO il prezzo della
 *  pratica, è la fattura di tutto; se ne copre solo una parte — il resto
 *  arriverà in un secondo documento — è un acconto.
 *  ⚠️ Un importo a zero (nessun incasso ancora registrato) NON è «tutto»: è
 *   una fattura che si sta preparando su un acconto che deve ancora arrivare,
 *   ed è il caso in cui dirlo serve di più.
 */
export function tipoDellaFattura(c?: ContestoFattura): "acconto" | "saldo" | "unica" {
  if (c?.tipo === "saldo") return "saldo";
  if (c?.tipo === "acconto") return "acconto";
  const importo = Number(c?.importo ?? 0);
  const prezzo = Number(c?.prezzo ?? 0);
  if (c?.tipo === "unica") return "unica";
  //  Senza il prezzo della pratica non si può dire niente: «la tua fattura» è
  //  la frase che non sbaglia mai, e inventare un acconto che non c'è sarebbe
  //  peggio del generico.
  if (!prezzo) return "unica";
  if (importo <= 0) return "acconto";
  //  Un centesimo di tolleranza: gli arrotondamenti dell'IVA non devono
  //  trasformare una fattura intera in un acconto.
  return importo < prezzo - 0.01 ? "acconto" : "unica";
}

const vuoto = (s?: string) => !String(s ?? "").trim();

/** Che cosa manca, in italiano, pronto sia per l'elenco a schermo sia per il
 *  messaggio. Le voci sono raggruppate come le penserebbe una persona: non
 *  «indirizzo», «CAP», «comune» in tre righe, ma «l'indirizzo di residenza,
 *  con CAP e comune» in una — perché è un'informazione sola. */
export function cosaManca(c: DatiPerFattura): string[] {
  const mancano: string[] = [];

  if (c.azienda) {
    if (vuoto(c.denominazione)) mancano.push("la ragione sociale esatta");
    if (vuoto(c.partitaIva)) mancano.push("la partita IVA");
    //  Per un'azienda lo SDI vuole un recapito telematico: senza, la fattura
    //  parte ma non le arriva, e se ne accorge il commercialista fra un mese.
    if (vuoto(c.codiceDestinatario) && vuoto(c.pec)) {
      mancano.push("il codice destinatario (7 caratteri) oppure la PEC");
    }
  } else {
    //  ⚠️ QUI SI DICE SOLO QUELLO CHE MANCA DAVVERO. La conferma del nome —
    //   che si chiede anche quando il nome ce l'abbiamo — NON sta in questo
    //   elenco: da qui leggono anche i cartellini «dati incompleti», e una
    //   scheda piena resterebbe per sempre segnata come da completare. Sta in
    //   `datiDaChiedere`, che è quello che finisce nel messaggio.
    if (vuoto(c.nome) && vuoto(c.cognome)) mancano.push("nome e cognome come sui documenti");
    else if (vuoto(c.cognome)) mancano.push("il cognome, come sui documenti");
    else if (vuoto(c.nome)) mancano.push("il nome, come sui documenti");
    if (vuoto(c.codiceFiscale)) mancano.push("il codice fiscale");
  }

  //  L'indirizzo è una cosa sola anche se nel programma sono quattro campi.
  const pezziIndirizzo = [
    vuoto(c.indirizzo) ? "via e numero civico" : "",
    vuoto(c.cap) ? "CAP" : "",
    vuoto(c.comune) ? "comune" : "",
  ].filter(Boolean);
  if (pezziIndirizzo.length === 3) mancano.push("l'indirizzo di residenza completo, con CAP e comune");
  else if (pezziIndirizzo.length) mancano.push(`dell'indirizzo: ${elenca(pezziIndirizzo)}`);

  return mancano;
}

/** ── CHE COSA SI CHIEDE NEL MESSAGGIO ──────────────────────────────────────
 *  Quello che manca, più UNA cosa che non manca: nome e cognome.
 *
 *  ⚠️ RICHIESTA DEL COMMITTENTE — «aggiungi anche nome e cognome al messaggio
 *   dove chiedo i dati per la fattura» — e ha una ragione che si paga cara
 *   quando manca. Il nome che abbiamo in scheda è quello battuto su un modulo
 *   o sentito al telefono; in fattura serve quello dei DOCUMENTI. «Anna» che
 *   in anagrafe è «Annamaria», un cognome con l'accento mangiato, un doppio
 *   cognome tagliato a metà: lo SDI scarta il documento settimane dopo, e a
 *   quel punto quella persona ha già smesso di rispondere al telefono.
 *
 *  ⚠️ SI CHIEDE IN DUE MODI DIVERSI, e non è cortesia: «Ciao Anna, mandami
 *   nome e cognome» fa pensare che dall'altra parte non ci sia nessuno che la
 *   conosce. Se il nome non ce l'abbiamo si CHIEDE; se ce l'abbiamo si fa
 *   CONFERMARE, dicendo anche perché. */
export function datiDaChiedere(c: DatiPerFattura): string[] {
  const mancano = cosaManca(c);
  //  Alle aziende non si chiede un nome: si chiede la ragione sociale, ed è
  //  già nell'elenco qui sopra quando manca.
  if (c.azienda) return mancano;
  //  Nome o cognome mancanti: la riga c'è già, chiederli due volte sarebbe un
  //  elenco che si ripete.
  if (vuoto(c.nome) || vuoto(c.cognome)) return mancano;
  return [
    "nome e cognome esatti come sui documenti (li so già, ma in fattura devono combaciare)",
    ...mancano,
  ];
}

/** «a, b e c» — la congiunzione all'italiana. Con la virgola prima dell'ultimo
 *  elemento il messaggio sembra scritto da un modulo, non da una persona. */
function elenca(v: string[]): string {
  if (v.length <= 1) return v[0] ?? "";
  return `${v.slice(0, -1).join(", ")} e ${v[v.length - 1]}`;
}

/** Il primo nome, per il saluto. Se non c'è si saluta e basta: «Ciao ,» con la
 *  virgola sospesa è peggio di nessun nome. */
function nomeDaSalutare(c: DatiPerFattura): string {
  const n = String(c.nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (n) return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  //  ⚠️ NON SI SALUTA UNA RAGIONE SOCIALE. «Ciao Rossi Srl» non lo scriverebbe
  //   nessuno: dall'altra parte c'è una persona, e se non ne sappiamo il nome
  //   si saluta e basta — che è meno caloroso ma non è ridicolo.
  return "";
}

/** Il messaggio pronto da mandare. `firma` è come si presenta lo studio. */
export function messaggioDatiFattura(
  c: DatiPerFattura,
  firma = "Hair Genius Labs",
  contesto?: ContestoFattura,
): string {
  const mancano = datiDaChiedere(c);
  const nome = nomeDaSalutare(c);
  const saluto = nome ? `Ciao ${nome},` : "Ciao,";
  //  Come si chiama questa fattura parlando con il cliente. «Unica» non ha un
  //  nome: è «la tua fattura», e aggiungere qualcosa la farebbe suonare come
  //  una delle tante.
  const quale = tipoDellaFattura(contesto);
  const laFattura =
    quale === "acconto"
      ? "la fattura dell'acconto che hai versato"
      : quale === "saldo"
        ? "la fattura a saldo"
        : "la tua fattura";

  //  Non manca niente: non è un caso da gestire con un messaggio storto, è un
  //  caso in cui il pulsante non deve nemmeno comparire. Si restituisce
  //  comunque qualcosa di sensato, per non lasciare una stringa vuota in mano
  //  a chi la usa.
  //  ⚠️ «Non manca niente» adesso capita solo alle aziende: a un privato la
  //   conferma di nome e cognome si chiede sempre (vedi `datiDaChiedere`), e
  //   questo ramo resta per loro — e per non lasciare mai una stringa vuota in
  //   mano a chi chiama questa funzione.
  if (mancano.length === 0) {
    return `${saluto}\nho tutto quello che mi serve per ${laFattura}. Te la mando appena è pronta.\n\n${firma}`;
  }

  const righe: string[] = [saluto];
  righe.push(
    mancano.length === 1
      ? `sto preparando ${laFattura} e mi manca un dato. Me lo mandi qui quando hai un minuto?`
      : `sto preparando ${laFattura} e mi mancano un paio di dati. Me li mandi qui quando hai un minuto?`,
  );
  righe.push("");
  //  Un trattino e non un pallino: WhatsApp non fa gli elenchi puntati, e il
  //  «•» su certi telefoni esce come un quadratino.
  mancano.forEach((m) => righe.push(`- ${m.charAt(0).toUpperCase()}${m.slice(1)}`));

  //  ⚠️ LA SCORCIATOIA VALE PIÙ DI TUTTO IL RESTO. Copiare un codice fiscale a
  //   mano dal telefono è noioso e ci si sbaglia; fotografare la tessera
  //   sanitaria sono due secondi e non si sbaglia nessuno. Si offre solo
  //   quando serve davvero il codice fiscale, o è una riga in più per niente.
  if (!c.azienda && vuoto(c.codiceFiscale)) {
    righe.push("");
    righe.push("Se è più comodo, mandami pure una foto della tessera sanitaria: il codice fiscale lo prendo da lì.");
  }

  righe.push("");
  righe.push(`Grazie!\n${firma}`);
  return righe.join("\n");
}
