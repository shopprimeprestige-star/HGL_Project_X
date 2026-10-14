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

/** Spento di base. Acceso = `true` e pubblicare (dopo 14 giorni di numeri della barra). */
export const INTERRUTTORI = { popupUscita: false } as const;

/** Prossimo giro: "/catalogo". */
export const LINK_CATALOGO = "/shop";
/** Prossimo giro: "/protocol#modulo". */
export const LINK_CONSULENZA = "/#prenota";

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
