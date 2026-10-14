/** ── TESTI DEL MODULO CORTO · PROVVISORIO ───────────────────────────────────
 *  Sono la parte del contratto del giro 2 che vive in `src/landing/testi-sito.ts`
 *  (compito B8): `Fascia`, `FASCE`, `VERSIONE_CONSENSO_WA`, `TESTI_MODULO_CORTO`.
 *  B8 non è ancora arrivato quando C scrive il modulo, quindi stanno qui, con
 *  gli stessi nomi e gli stessi testi.
 *
 *  ⚠️ QUANDO B8 È DENTRO: questo file si cancella e `richiesta.ts`,
 *  `lead-comune.ts`, `ModuloCorto.tsx` e le prove importano da
 *  `@/landing/testi-sito` (cambia solo il percorso dell'import, i nomi sono
 *  gli stessi). Come già per `testi-pagine.ts` di D.
 *
 *  Testi: n. 1 del Copywriter (microtesti dell'architetto, approvati dal
 *  revisore). Niente prezzi, niente promesse, niente numeri.
 *  ───────────────────────────────────────────────────────────────────────── */
import { TESTI_CONSULENZA } from "@/landing/testi-sito";

export type Fascia = "mattina" | "pomeriggio" | "sera";

export const FASCE: readonly { id: Fascia; etichetta: string }[] = [
  { id: "mattina", etichetta: "Mattina" },
  { id: "pomeriggio", etichetta: "Pomeriggio" },
  { id: "sera", etichetta: "Sera" },
];

/** Il testo esatto della casella del consenso (sotto, in `TESTI_MODULO_CORTO.consenso`)
 *  è la prova di cosa ha accettato la persona. */
export const VERSIONE_CONSENSO_WA = "wa-sito-2026-10-14";
/*  Testo della casella per la versione «wa-sito-2026-10-14» (PROVVISORIO, lo
 *  conferma il titolare; se cambia una parola, cambia anche la versione):
 *    «Ok a ricevere promemoria su WhatsApp»
 *  Copre i promemoria della consulenza (i due modelli di oggi: promemoria_meet,
 *  promemoria_ricontatto). Messaggi di altro tipo (commerciali) NON sono coperti:
 *  servirebbe un testo nuovo con una versione nuova. */

export const TESTI_MODULO_CORTO = {
  titoloProtocol: "Lascia due dati, al resto pensiamo noi.",
  titoloShop: "Consulenza gratuita",
  nome: "Come ti chiami?",
  telefono: "Il tuo numero di telefono",
  fascia: "Quando preferisci essere richiamato?",
  facoltativo: "(facoltativo)",
  bottoneA: "Prenota la consulenza gratuita",
  bottoneB: "Fatti richiamare nell'orario che scegli",
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
    occupato: "Quell'orario è appena stato preso: scegline un altro.",
    nonValido: "Non siamo riusciti a fissarla da qui: ti richiamiamo noi per scegliere l'orario insieme.",
    fissata: (quando: string) => `Videoconsulenza fissata ${quando}. Il link te lo mandiamo noi.`,
  },
  /** Facoltativa e MAI spuntata di partenza: registra il consenso, non fa partire nessun messaggio. */
  consenso: "Ok a ricevere promemoria su WhatsApp",
} as const;
