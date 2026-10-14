/** ── TESTI, NOME E INTERRUTTORI DEL SITO PUBBLICO ──────────────────────────
 *  Un posto solo. Il nome del prodotto si cambia qui, in una riga, e tutte le
 *  pagine lo leggono da qui. I testi sono quelli approvati (Copywriter e
 *  Marketing, n. 1 di ogni classifica): non si riscrivono nei componenti.
 *
 *  ⚠️ Nessun valore salvato nel database e nessun modello WhatsApp approvato da
 *  Meta si rinomina: il vecchio nome resta solo dove deve restare identico a
 *  quello già approvato o salvato.
 *  Niente prezzi e niente promesse di risultato: sono regole di prodotto.
 *  ───────────────────────────────────────────────────────────────────────── */

export const NOME_PRODOTTO = "Invisible Derm";
export const NOME_PRODOTTO_ESTESO = "Invisible Derm Protocol®";

/** Tutti spenti di base. Accendere = cambiare una parola qui e pubblicare:
 *  - `popupUscita`: dopo 14 giorni di numeri della barra;
 *  - `fotoConConsenso`: solo quando ci sono foto con consenso scritto (e `FOTO_CON_CONSENSO` non è vuoto);
 *  - `testBottone`: dopo 500 visitatori (metà vede il testo A, metà il B);
 *  - `linkShopDiProva`: mostra nel catalogo il link allo shop di prova. */
export const INTERRUTTORI = {
  popupUscita: false,
  fotoConConsenso: false,
  testBottone: false,
  linkShopDiProva: false,
} as const;

/** ⚠️ Finché home e catalogo non sono ridisegnati e approvati (14/10/2026) il bottone «Scegli dal catalogo»
 *  della home online porta allo shop di oggi, non alla pagina provvisoria `/catalogo` (nascosta).
 *  Quando il redesign è approvato: "/catalogo" (una riga). */
export const LINK_CATALOGO = "/shop";
/** ⚠️ Finché la home e la pagina Protocol non sono ridisegnate e approvate (cambio di piano del titolare,
 *  14/10/2026) la consulenza resta sul calendario della home di oggi (`id="prenota"` in `routes/index.tsx`).
 *  Quando /protocol va online: "/protocol#modulo" (una riga). */
export const LINK_CONSULENZA = "/#prenota";
export const LINK_SHOP_DI_PROVA = "/shop";

/** Mai foto d'archivio al posto di queste: finché è vuoto la sezione non c'è. */
export const FOTO_CON_CONSENSO: readonly { src: string; alt: string }[] = [];

/** Dato di Operativo. `null` = la riga della durata non si mostra. Niente numeri inventati. */
export const DURATA_CONSULENZA: string | null = null;

/** Cambia se cambia il testo della casella del consenso (`TESTI_MODULO_CORTO.consenso`):
 *  il testo esatto è la prova di cosa ha accettato la persona. Copre i promemoria della
 *  consulenza (i due modelli di oggi: promemoria_meet, promemoria_ricontatto); messaggi di
 *  altro tipo (commerciali) NON sono coperti: servirebbe un testo nuovo con una versione nuova. */
export const VERSIONE_CONSENSO_WA = "wa-sito-2026-10-14";

export type Fascia = "mattina" | "pomeriggio" | "sera";

export const FASCE: readonly { id: Fascia; etichetta: string }[] = [
  { id: "mattina", etichetta: "Mattina" },
  { id: "pomeriggio", etichetta: "Pomeriggio" },
  { id: "sera", etichetta: "Sera" },
];

export type IdProblema =
  | "attaccatura"
  | "densita"
  | "tenuta"
  | "manutenzione"
  | "annoda"
  | "scolorisce"
  | "svuota"
  | "altro";

/** Etichette identiche a quelle del Copywriter: sono anche quelle salvate nel lead. */
export const PROBLEMI: readonly { id: IdProblema; etichetta: string }[] = [
  { id: "attaccatura", etichetta: "Attaccatura: non sembra la tua" },
  { id: "densita", etichetta: "Densità: non è giusta per la tua età" },
  { id: "tenuta", etichetta: "Tenuta: si stacca presto" },
  { id: "manutenzione", etichetta: "Manutenzione: troppo frequente" },
  { id: "annoda", etichetta: "Si annoda: in doccia o al mare" },
  { id: "scolorisce", etichetta: "Si scolorisce: il colore cambia" },
  { id: "svuota", etichetta: "Si svuota: dopo pochi mesi" },
  { id: "altro", etichetta: "Altro: scrivilo tu" },
];

export const TESTI_CONSULENZA = {
  barra: {
    telefono: "Il tuo caso è particolare?",
    schermoLargo: "Si stacca presto? Si annoda? Si scolorisce? C'è una soluzione su misura.",
    bottone: "Consulenza gratuita",
    chiudi: "Chiudi",
  },
  pannello: {
    titolo: "Qual è il problema?",
    sottotitolo: "Un tocco e lo vediamo insieme, gratis.",
    bottone: "Parlane con noi, è gratuito",
  },
  box: {
    titolo: "Non è il prodotto giusto per te?",
    testo:
      "La patch classica va bene per molti, e per molti basta. Ma anche l'auto è andata avanti: se hai un problema, c'è un sistema di ultima generazione, su misura. Scegli il tuo problema e ne parliamo, gratis.",
    bottone: "Parlane con noi, è gratuito",
  },
  popup: {
    titolo: "Cosa non ti convince?",
    testo: "Scegli il problema che hai con la patch. Ti rispondiamo in consulenza gratuita, senza impegno.",
    chiudi: "No, grazie",
  },
  campo: {
    etichetta: "Qual è il problema principale?",
    altro: "Scrivilo in due parole",
    errore: "Scegli il problema principale.",
  },
} as const;

export const TESTI_STRADE = {
  sopratitolo: "Dal classico all'evoluzione: scegli il tuo livello",
  titolo: "Esiste da sempre. Ora è evoluto.",
  sottotitolo:
    "L'auto esiste dal 1900: benzina, diesel, elettrico. Stesso mondo, evoluzione. Con la protesi capillare è uguale: la patch classica va bene per molti, il nostro sistema è di ultima generazione, su misura.",
  /** Due carte di pari peso, nessun prezzo. */
  carte: [
    {
      id: "stock",
      titolo: "Stock",
      frase: "So già cosa voglio.",
      testo: "La patch classica, pronta. Per chi ha un caso semplice.",
      bottone: "Scegli dal catalogo",
      href: LINK_CATALOGO,
    },
    {
      id: "protocol",
      titolo: NOME_PRODOTTO_ESTESO,
      frase: "Voglio capire cosa fa per me.",
      testo: "L'evoluzione di ultima generazione, su misura. Per chi ha un problema con la sua patch.",
      bottone: "Prenota la consulenza gratuita",
      href: LINK_CONSULENZA,
    },
  ],
} as const;

/** Testo del bottone della consulenza nella variante B del test (spento di base). */
export const BOTTONE_VARIANTE_B = "Fatti richiamare nell'orario che scegli";

const BOTTONE_CONSULENZA = "Prenota la consulenza gratuita";

export const TESTI_HOME = {
  meta: {
    titolo: `${NOME_PRODOTTO} · Hair Genius Labs`,
    descrizione: "Un sistema di capelli su misura, sottile e naturale. Scegli dal catalogo o prenota la consulenza gratuita.",
  },
  titolo: TESTI_STRADE.titolo,
  riga: `${NOME_PRODOTTO} è un sistema di capelli su misura, sottile e naturale.`,
  bottoneCatalogo: "Scegli dal catalogo",
  bottoneConsulenza: BOTTONE_CONSULENZA,
  percorsi: {
    titolo: "Da dove vuoi partire?",
    frase: TESTI_STRADE.sopratitolo,
    sottotitolo: TESTI_STRADE.sottotitolo,
    carte: TESTI_STRADE.carte,
  },
  prove: {
    titolo: "Fatti, non parole.",
    tenuta: { titolo: "Tenuta", testo: "Mare, doccia, palestra, phon. Vita normale." },
    manutenzione: {
      titolo: "Manutenzione",
      testo: "Circa 10 minuti. Ogni tanto serve un controllo: te lo diciamo subito.",
    },
    foto: { titolo: "Foto vere", testo: "Persone vere, con il loro consenso scritto." },
  },
  comeFunziona: {
    titolo: "Tre passi, niente giri.",
    passi: ["Parli con noi.", "Lo facciamo su misura per te.", "Torni alla vita di prima."],
  },
  faqTitolo: "Domande frequenti",
  faq: [
    {
      q: "Si nota?",
      a: "Il sistema è sottile e su misura: lo progettiamo su viso, colore e densità. Lo vedi dal vivo in consulenza.",
    },
    {
      q: "Posso andare al mare e fare sport?",
      a: "Sì: mare, doccia, palestra, phon fanno parte della prova.",
    },
    { q: "Devo fare manutenzione?", a: "Sì, periodica. Circa 10 minuti, ti spieghiamo come." },
    {
      q: "E se non fa per me?",
      a: `Te lo diciamo. Oltre a ${NOME_PRODOTTO} guardiamo anche altre soluzioni e ti consigliamo quella giusta.`,
    },
    { q: "Devo decidere subito?", a: "No. La consulenza è gratuita e senza impegno." },
  ],
  chiusura: { titolo: "Scegli come iniziare." },
} as const;

export const TESTI_PROTOCOL = {
  meta: {
    titolo: `${NOME_PRODOTTO_ESTESO} · consulenza gratuita`,
    descrizione: "Un sistema su misura, sottile e naturale. Ti spieghiamo tutto in una consulenza gratuita.",
  },
  titolo: "Basta nasconderti. Fatti vedere come sei.",
  sottotitolo: "Un sistema su misura, sottile e naturale. Ti spieghiamo tutto in una consulenza gratuita.",
  bottone: BOTTONE_CONSULENZA,
  /** Il «non fa per te» usa solo il limite vero che abbiamo (la manutenzione): SPEC «Decido io» 12. */
  perChi: {
    titolo: "Fa per te? Non fa per te?",
    fa: "Fa per te se vuoi un risultato naturale, senza chirurgia, e non ti pesa un controllo periodico.",
    nonFa: "Non fa per te se non vuoi alcuna manutenzione, o se cerchi qualcosa di diverso da un sistema su misura.",
  },
  cosE: {
    titolo: "Naturale e su misura.",
    testo:
      "Una membrana sottilissima con capelli veri, progettata su viso, colore e densità. Non è uno standard per tutti. Si adatta a te.",
  },
  tenuta: {
    titolo: "Regge. Ti spieghiamo come.",
    tenuta: { titolo: "Tenuta", testo: "Mare, doccia, palestra, phon." },
    manutenzione: {
      titolo: "Manutenzione",
      testo: "Circa 10 minuti. Ogni tanto serve un controllo periodico: fa parte del gioco.",
    },
  },
  foto: { titolo: "Persone vere. Con il loro consenso." },
  consulenza: {
    titolo: "Cosa succede dopo la richiesta",
    passi: [
      "Lasci nome, telefono e quando preferisci.",
      "Ti richiamiamo noi.",
      "Guardiamo la tua situazione e ti diciamo con onestà cosa fa per te.",
    ],
  },
  faqTitolo: "Domande frequenti",
  faq: [
    {
      q: "È davvero invisibile?",
      a: "Lo progettiamo su misura per essere naturale. Il giudizio finale lo dai tu, dal vivo, in consulenza.",
    },
    { q: "Si tiene sotto la doccia e al mare?", a: "Sì. Mare, doccia, palestra e phon sono usi normali." },
    {
      q: "Quanta manutenzione serve?",
      a: "Circa 10 minuti, più un controllo periodico. È il limite vero: meglio saperlo prima.",
    },
    { q: "La consulenza costa qualcosa?", a: "No, è gratuita e senza impegno." },
    {
      q: "E se per me non è la soluzione giusta?",
      a: "Te lo diciamo. Valutiamo anche altre strade e ti consigliamo la più adatta.",
    },
  ],
  modulo: { titolo: "Lascia due dati, al resto pensiamo noi." },
} as const;

export const TESTI_CATALOGO = {
  meta: {
    titolo: "Catalogo · Hair Genius Labs",
    descrizione: "Il catalogo è in preparazione. Intanto possiamo guardare insieme il tuo caso, gratis.",
  },
  titolo: "Catalogo",
  testo: "Il catalogo è in preparazione.",
  seguito: "Intanto possiamo guardare insieme il tuo caso, gratis.",
  bottone: BOTTONE_CONSULENZA,
  linkShop: "Guarda lo shop di prova",
} as const;

export const TESTI_MODULO_CORTO = {
  titoloProtocol: TESTI_PROTOCOL.modulo.titolo,
  titoloShop: "Consulenza gratuita",
  nome: "Come ti chiami?",
  telefono: "Il tuo numero di telefono",
  fascia: "Quando preferisci essere richiamato?",
  facoltativo: "(facoltativo)",
  bottoneA: BOTTONE_CONSULENZA,
  bottoneB: BOTTONE_VARIANTE_B,
  sotto: "Ti richiamiamo noi nell'orario che scegli.",
  privacy: {
    testo: "I tuoi dati sono al sicuro · Trattati secondo il GDPR",
    link: "/privacy-policy",
    etichettaLink: "Privacy",
  },
  errori: {
    nome: "Scrivi il tuo nome.",
    telefono: "Controlla il numero: servono solo cifre.",
    fascia: "Scegli una fascia.",
    problema: TESTI_CONSULENZA.campo.errore,
    invio: "Non siamo riusciti a inviare. Riprova tra un momento.",
  },
  conferma: {
    titolo: "Fatto. Ti richiamiamo noi.",
    testo: "Ti richiamiamo nell'orario che hai scelto e guardiamo il tuo caso insieme.",
  },
  calendario: {
    domanda: "Preferisci fissare subito la videoconsulenza?",
    bottone: "Scegli giorno e ora",
    /** Dentro il calendario (`BookingFunnel` in modo «solo-calendario»): niente durata né programma di chiamata, finché non li conferma Operativo. */
    titolo: "Scegli il giorno e l'ora",
    sotto: "Videoconsulenza online, gratuita.",
    scelto: "Orario scelto",
    occupato: "Quell'orario è appena stato preso: scegline un altro.",
    nonValido: "Non siamo riusciti a fissarla da qui: ti richiamiamo noi per scegliere l'orario insieme.",
    fissata: (quando: string) => `Videoconsulenza fissata ${quando}. Il link te lo mandiamo noi.`,
  },
  /** Facoltativa e MAI spuntata di partenza: registra il consenso, non fa partire nessun messaggio. */
  consenso: "Ok a ricevere promemoria su WhatsApp",
} as const;
