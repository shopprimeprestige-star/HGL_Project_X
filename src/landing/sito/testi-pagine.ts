/** ── TESTI DELLE PAGINE NUOVE (home, Protocol, catalogo) · PROVVISORIO ──────
 *  Sono i testi e gli interruttori che il contratto del giro 2 mette in
 *  `src/landing/testi-sito.ts` (compito B8) con gli stessi nomi. B8 non è
 *  ancora arrivato quando D scrive le pagine, quindi vivono qui, uguali.
 *
 *  ⚠️ QUANDO B8 È DENTRO: questo file si cancella e le pagine importano da
 *  `@/landing/testi-sito` (cambia solo il percorso dell'import, i nomi sono
 *  gli stessi). Nel frattempo il nome del prodotto resta UNO: si legge sempre
 *  da `testi-sito.ts`, qui non si riscrive.
 *
 *  Testi: n. 1 di Copywriter e Marketing, già approvati. Niente prezzi,
 *  niente conto alla rovescia, niente «ultimi posti», niente Trustpilot.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  INTERRUTTORI as INTERRUTTORI_GIRO_1,
  NOME_PRODOTTO,
  NOME_PRODOTTO_ESTESO,
  PROBLEMI,
  TESTI_CONSULENZA,
  TESTI_STRADE,
} from "@/landing/testi-sito";

export { NOME_PRODOTTO, NOME_PRODOTTO_ESTESO, PROBLEMI, TESTI_CONSULENZA, TESTI_STRADE };

/** Tutti spenti di base. Accendere = cambiare una parola e pubblicare. */
export const INTERRUTTORI = {
  ...INTERRUTTORI_GIRO_1,
  fotoConConsenso: false,
  testBottone: false,
  linkShopDiProva: false,
} as const;

export const LINK_CATALOGO = "/catalogo";
export const LINK_CONSULENZA = "/protocol#modulo";
export const LINK_SHOP_DI_PROVA = "/shop";

/** Mai foto d'archivio al posto di queste: finché è vuoto la sezione non c'è. */
export const FOTO_CON_CONSENSO: readonly { src: string; alt: string }[] = [];

/** Dato di Operativo. `null` = la riga della durata non si mostra. */
export const DURATA_CONSULENZA: string | null = null;

/** Testo del bottone nella variante B del test (spento di base). */
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
