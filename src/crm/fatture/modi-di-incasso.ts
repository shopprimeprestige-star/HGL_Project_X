/** ── COME HA PAGATO, E CHE COSA SCRIVERE DI CONSEGUENZA ────────────────────
 *
 *  Segnalazione del committente: «se il cliente paga con il POS SumUp e devo
 *  emettere fattura, ora mi dice di mettere la causale: cosa devo mettere lì
 *  al posto della causale? Metti l'opzione POS, bonifico, contanti ecc., e in
 *  base a quella i dati corretti da inserire, con una guida: un'icona che
 *  mettendoci sopra il mouse dice dove trovarli».
 *
 *  ── IL PUNTO ─────────────────────────────────────────────────────────────
 *  «Causale» è la parola del BONIFICO: è la frase che il cliente scrive nel
 *  suo pagamento perché la banca ce lo faccia riconoscere. Su un incasso al
 *  POS quella frase non esiste — non c'è nessun bonifico, non c'è nessuna
 *  frase da copiare — e chi compila si ferma davanti a un campo che chiede una
 *  cosa che non c'è. Il campo però serve lo stesso: sulla fattura ci va
 *  scritto COME è stato pagato e con quale riferimento, che per il POS è il
 *  codice dell'operazione.
 *
 *  Qui c'è, per ogni modo di incassare: come si chiama, con che codice viaggia
 *  nel tracciato dell'Agenzia, QUALE dato chiedere, DOVE lo si trova (è la
 *  guida che il committente ha chiesto) e che cosa scrivere sul documento.
 *
 *  ⚠️ L'ELENCO È CHIUSO, e non è un capriccio: da qui esce il codice
 *   `ModalitaPagamento` del file XML, e una parola scritta a mano non ha un
 *   codice. MP01 contanti, MP05 bonifico, MP08 carta (il POS è una carta:
 *   per l'Agenzia delle Entrate POS e carta sono la stessa modalità, quello
 *   che cambia è dove si va a prendere il riferimento).
 *  ⚠️ IL DATO NON È MAI OBBLIGATORIO. Una fattura senza il codice
 *   dell'operazione è valida; una fattura che non si riesce a emettere perché
 *   manca un numero che il consulente non trova è un cliente che aspetta. Si
 *   chiede, si spiega dove si trova, e si va avanti comunque.
 *  ⚠️ «ASSENTE» RESTA BONIFICO: è quello che il programma scriveva prima che
 *   questo campo esistesse, e le fatture già emesse non devono cambiare
 *   significato.
 *  ───────────────────────────────────────────────────────────────────────── */

/** I modi in cui un cliente paga qui. */
export type MetodoPagamento = "contanti" | "bonifico" | "carta" | "pos";

export interface DatoDaChiedere {
  /** Come si chiama il campo a schermo. */
  etichetta: string;
  /** Un esempio dentro il campo, per far capire che forma ha. */
  esempio: string;
  /** ⚠️ LA GUIDA: dove si trova quel dato, detto passo per passo. È quello che
   *  compare mettendo il mouse sopra l'icona. */
  dove: string;
}

export interface ModoIncasso {
  chiave: MetodoPagamento;
  /** Come si chiama a schermo. */
  titolo: string;
  /** Il codice del tracciato dell'Agenzia delle Entrate. */
  codice: string;
  /** Che cosa chiedere, quando c'è qualcosa da chiedere. */
  dato?: DatoDaChiedere;
  /** Come si chiama il campo della causale QUANDO si paga così. */
  etichettaCausale: string;
  /** ── COME SI CHIAMA QUEL NUMERO SUL DOCUMENTO ─────────────────────────
   *  «operazione» per il POS e la carta, «CRO» per il bonifico, «ricevuta»
   *  per i contanti. Chiamarlo sempre «operazione» faceva scrivere sulla
   *  fattura di un pagamento in contanti una parola che in cassa non esiste. */
  parolaRiferimento: string;
  /** ── ⚠️ L'IBAN SI SCRIVE SOLO SE SI ASPETTA UN BONIFICO ───────────────
   *  Vale sul foglio e vale nel file XML: su un incasso al POS o in contanti
   *  l'IBAN del centro è una riga che contraddice il resto del documento, e i
   *  gestionali la usano per riconciliare gli estratti conto — un contante
   *  cercato in banca non si trova mai. */
  conIban: boolean;
}

export const MODI_INCASSO: ModoIncasso[] = [
  {
    chiave: "bonifico",
    titolo: "Bonifico",
    codice: "MP05",
    etichettaCausale: "Causale del bonifico",
    parolaRiferimento: "CRO",
    conIban: true,
    dato: {
      etichetta: "CRO / TRN del bonifico",
      esempio: "es. 1234567890123456789012345678",
      dove: "È il numero che identifica il bonifico. Lo trovi nell'estratto conto o nella notifica di accredito della tua banca, accanto all'importo: cercalo come «CRO», «TRN» o «Riferimento operazione». Puoi lasciarlo vuoto.",
    },
  },
  {
    chiave: "pos",
    titolo: "POS (SumUp)",
    codice: "MP08",
    //  Al POS non si copia nessuna frase: il filo con l'incasso è il codice
    //  dell'operazione, e la «causale» torna a essere quello che è davvero —
    //  la descrizione dell'operazione.
    etichettaCausale: "Causale (descrizione dell'operazione)",
    parolaRiferimento: "operazione",
    conIban: false,
    dato: {
      etichetta: "Codice operazione SumUp",
      esempio: "es. TEUB4XR2M9",
      dove: "Aprí l'app SumUp sul telefono → «Attività» (o «Transazioni») → tocca l'incasso di quel giorno: il codice è scritto come «ID transazione» o «Codice operazione». Sulla ricevuta stampata dal lettore è il codice in fondo, sotto l'importo. Puoi lasciarlo vuoto.",
    },
  },
  {
    chiave: "contanti",
    titolo: "Contanti",
    codice: "MP01",
    etichettaCausale: "Causale (descrizione dell'operazione)",
    parolaRiferimento: "ricevuta",
    conIban: false,
    dato: {
      etichetta: "Numero della ricevuta",
      esempio: "es. 42",
      dove: "Solo se usi un blocchetto di ricevute: è il progressivo della ricevuta che hai consegnato al cliente. Se non lo usi, lascia vuoto: per i contanti non serve nessun altro riferimento.",
    },
  },
  {
    chiave: "carta",
    titolo: "Carta (a distanza)",
    codice: "MP08",
    etichettaCausale: "Causale (descrizione dell'operazione)",
    parolaRiferimento: "autorizzazione",
    conIban: false,
    dato: {
      etichetta: "Codice autorizzazione",
      esempio: "es. ch_3Qa1bZ2Lk",
      dove: "È il pagamento con carta fatto a distanza (link di pagamento o e-commerce), non al POS. Il codice sta nell'email di conferma del pagamento, oppure nel pannello del servizio che l'ha incassato (SumUp, Stripe) sotto «ID pagamento» o «Codice autorizzazione». Puoi lasciarlo vuoto.",
    },
  },
];

/** Il modo scelto. ⚠️ Assente = bonifico: vedi il cartello in testa. */
export function modoDi(m?: MetodoPagamento | null): ModoIncasso {
  return MODI_INCASSO.find((x) => x.chiave === m) ?? MODI_INCASSO[0];
}

/** Il codice del tracciato, per l'XML. */
export const codiceDelModo = (m?: MetodoPagamento | null): string => modoDi(m).codice;

/** ── L'IBAN VA NEL FILE DELL'AGENZIA? ─────────────────────────────────────
 *  Segnalazione del committente: «se seleziono POS non deve uscire pagamento
 *  tramite bonifico sulla fattura».
 *  Sul foglio stampato era già sistemato, nel FILE no: `DettaglioPagamento`
 *  portava l'IBAN del centro su ogni fattura, anche su un incasso in contanti.
 *  È il campo con cui i gestionali riconciliano gli estratti conto: un
 *  contante con l'IBAN accanto si va a cercare in banca, e in banca non c'è.
 *  ⚠️ «ASSENTE» RESTA BONIFICO, come il resto del modulo: le fatture emesse
 *   prima che questo campo esistesse non devono cambiare significato. */
export const vuoleIban = (m?: MetodoPagamento | null): boolean => modoDi(m).conIban;

/** ── CHE COSA SCRIVERE SUL DOCUMENTO ──────────────────────────────────────
 *  La riga che il cliente legge sulla fattura, e che dice davvero come ha
 *  pagato. Prima il piede diceva SEMPRE «Pagamento con bonifico bancario ·
 *  IBAN …», anche su un incasso al POS: una riga falsa su un documento
 *  fiscale, e per il cliente un invito a fare un bonifico che ha già pagato. */
export function pagamentoInChiaro(p: {
  metodo?: MetodoPagamento | null;
  riferimento?: string | null;
  /** L'IBAN del centro: si scrive SOLO quando si aspetta un bonifico. */
  iban?: string | null;
}): string {
  const modo = modoDi(p.metodo);
  const rif = String(p.riferimento || "").trim();
  if (modo.chiave === "bonifico") {
    const iban = String(p.iban || "").trim();
    return [
      `Pagamento con bonifico bancario${iban ? ` · IBAN ${iban}` : ""}`,
      rif ? `${modo.parolaRiferimento} ${rif}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const nome = modo.chiave === "pos" ? "POS" : modo.chiave === "contanti" ? "contanti" : "carta";
  return [
    `Pagamento ${modo.chiave === "contanti" ? "in" : "con"} ${nome}`,
    rif ? `${modo.parolaRiferimento} ${rif}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** ── LA CAUSALE, QUANDO NON È UN BONIFICO ─────────────────────────────────
 *  Al POS e in contanti non c'è nessuna frase che il cliente abbia scritto da
 *  qualche parte: la causale torna a essere la descrizione dell'operazione, e
 *  quella si sa già — è l'ordine a cui la fattura si riferisce. Si propone
 *  quella, e resta scrivibile sopra.
 *  ⚠️ SUL BONIFICO NON SI TOCCA NIENTE: lì la causale è quella che il cliente
 *   ha copiato nel pagamento, e cambiarla romperebbe il filo fra l'accredito
 *   in banca e il documento. */
export function causaleSuggerita(p: {
  metodo?: MetodoPagamento | null;
  /** La causale che il programma propone oggi (quella del bonifico). */
  base: string;
  riferimento?: string | null;
}): string {
  const base = String(p.base || "").trim();
  const modo = modoDi(p.metodo);
  if (modo.chiave === "bonifico") return base;
  const rif = String(p.riferimento || "").trim();
  const come =
    modo.chiave === "pos" ? "al POS" : modo.chiave === "contanti" ? "in contanti" : "con carta";
  //  Si parte dalla stessa frase commerciale («Conferma d'ordine n. …»), che è
  //  quello che il documento deve dire, e si aggiunge come è stato incassato.
  return [base, `pagato ${come}`, rif ? `operazione ${rif}` : ""].filter(Boolean).join(" · ");
}
