/** ── IL CATALOGO DEGLI AVVISI ──────────────────────────────────────────────
 *
 *  Un posto solo dove è scritto COSA si può notificare, come si chiama in
 *  italiano, quanto è grave, che suono fa e dove porta il clic.
 *
 *  PERCHÉ UN CATALOGO E NON DIECI `if` SPARSI
 *  Le stesse informazioni servono in quattro punti diversi: il motore che
 *  decide se notificare, la pagina delle preferenze che disegna gli
 *  interruttori, lo storico che mostra l'etichetta, e il clic sulla notifica
 *  che deve aprire la pagina giusta. Tenerle in un elenco solo significa che
 *  aggiungere un avviso nuovo è una riga qui, non una caccia al tesoro.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { LivelloSuono } from "@/crm/suoni-crm";
import type { NotificationSeverity } from "./types";

/** L'ordine di questo elenco è l'ordine in cui gli interruttori compaiono a
 *  schermo: prima la giornata (appuntamenti), poi le trattative, poi il lavoro
 *  già venduto (installazioni e incassi). */
export const TIPI_EVENTO = [
  "appuntamento_15min",
  "appuntamento_ora",
  "appuntamento_senza_esito",
  "lead_nuovo",
  "cambio_stato",
  "installazione_domani",
  "installazione_oggi",
  "richiamo_scaduto",
  "whatsapp_senza_risposta",
  "saldo_oggi",
  "saldo_arretrato",
  "scadenza_fiscale",
] as const;

export type TipoEvento = (typeof TIPI_EVENTO)[number];

export type GruppoEvento =
  | "Appuntamenti"
  | "Trattative"
  | "Installazioni"
  | "Incassi"
  //  ⚠️ Le scadenze fiscali non nascono dai lead ma dal CALENDARIO, ed è tutto
  //   il motivo per cui servono: nessuno se le ricorda guardando le trattative,
  //   e una liquidazione IVA saltata costa il 30% di sanzione.
  | "Contabilità";

export interface MetaEvento {
  /** Come si chiama nell'interruttore delle preferenze. */
  etichetta: string;
  /** Una riga che spiega QUANDO scatta: senza questa, l'utente spegne a caso. */
  spiegazione: string;
  gravita: NotificationSeverity;
  suono: LivelloSuono;
  gruppo: GruppoEvento;
  /** Dove porta il clic quando la notifica raggruppa più eventi insieme. */
  destinazione: string;
  /** Titolo per la notifica raggruppata: riceve il numero di eventi. */
  titoloGruppo: (n: number) => string;
}

export const CATALOGO: Record<TipoEvento, MetaEvento> = {
  appuntamento_15min: {
    etichetta: "Appuntamento fra 15 minuti",
    spiegazione: "Un quarto d'ora prima di ogni consulenza o visita in sede.",
    gravita: "warning",
    suono: "discreto",
    gruppo: "Appuntamenti",
    destinazione: "/CRM/agenda",
    titoloGruppo: (n) => `${n} appuntamenti fra poco`,
  },
  appuntamento_ora: {
    etichetta: "Appuntamento che inizia adesso",
    spiegazione: "All'ora esatta di inizio. È l'unico avviso che non va perso.",
    gravita: "critical",
    suono: "urgente",
    gruppo: "Appuntamenti",
    destinazione: "/CRM/agenda",
    titoloGruppo: (n) => `${n} appuntamenti iniziano adesso`,
  },
  appuntamento_senza_esito: {
    etichetta: "Appuntamento passato senza esito",
    spiegazione: "Trenta minuti dopo l'orario, se non è stato segnato com'è andato.",
    gravita: "warning",
    suono: "discreto",
    gruppo: "Appuntamenti",
    destinazione: "/CRM/agenda",
    titoloGruppo: (n) => `${n} appuntamenti senza esito`,
  },
  lead_nuovo: {
    etichetta: "Nuovo lead assegnato",
    spiegazione: "Appena una trattativa nuova viene affidata a un consulente.",
    gravita: "info",
    suono: "discreto",
    gruppo: "Trattative",
    destinazione: "/CRM/nuovi-contatti",
    titoloGruppo: (n) => `${n} nuovi lead assegnati`,
  },
  cambio_stato: {
    etichetta: "Cambio di stato importante",
    spiegazione: "Acconto incassato, venduto, cliente assente.",
    gravita: "info",
    suono: "discreto",
    gruppo: "Trattative",
    destinazione: "/CRM/trattative",
    titoloGruppo: (n) => `${n} trattative hanno cambiato stato`,
  },
  installazione_domani: {
    etichetta: "Installazione di domani",
    spiegazione: "Il giorno prima, per preparare kit e spostamenti.",
    gravita: "info",
    suono: "discreto",
    gruppo: "Installazioni",
    destinazione: "/CRM/installazioni",
    titoloGruppo: (n) => `${n} installazioni domani`,
  },
  installazione_oggi: {
    etichetta: "Installazione di oggi",
    spiegazione: "La mattina stessa, con orario e installatore.",
    gravita: "warning",
    suono: "discreto",
    gruppo: "Installazioni",
    destinazione: "/CRM/installazioni/oggi",
    titoloGruppo: (n) => `${n} installazioni oggi`,
  },
  scadenza_fiscale: {
    etichetta: "Scadenza fiscale",
    spiegazione:
      "Liquidazione IVA, ritenute, dichiarazioni: dal preavviso fino al giorno stesso, e poi finché resta scoperta.",
    /*  ⚠️ «warning» e non «info»: una scadenza fiscale saltata non è un
        promemoria mancato, è una sanzione — sul versamento tardivo il 30%.
        Il grado di gravità decide se la notifica suona e se resta in cima:
        metterla fra le informazioni vorrebbe dire farla scorrere via insieme
        agli avvisi che non costano niente. */
    gravita: "warning",
    suono: "discreto",
    gruppo: "Contabilità",
    destinazione: "/CRM/contabilita",
    titoloGruppo: (n) => `${n} scadenze fiscali`,
  },
  richiamo_scaduto: {
    etichetta: "Richiamo scaduto",
    spiegazione: "Quando l'ora concordata per ricontattare è passata.",
    gravita: "warning",
    suono: "discreto",
    gruppo: "Trattative",
    destinazione: "/CRM/trattative",
    titoloGruppo: (n) => `${n} richiami scaduti`,
  },
  /*  ── ⚠️ IL DEBITO CHE NESSUNO SORVEGLIAVA ──────────────────────────────
      Misurato in archivio il 7/10/2026: sedici contatti di ritorno scritti su
      WhatsApp il 28 settembre, in cinquanta minuti, dallo stesso collega.
      Nove giorni dopo: nessuno chiuso, nessuno richiamato, quattordici su
      sedici mai nemmeno confermati. Il reparto «Scritti su WhatsApp» mostrava
      il debito a chi apriva quella pagina — e in nove giorni non l'ha aperta
      nessuno.
      Undici tipi di avviso guardavano appuntamenti, installazioni e incassi, e
      nessuno guardava le persone a cui abbiamo scritto. Adesso uno c'è.
      ⚠️ `warning` e non `critical`: è un lavoro da riprendere, non un soldo
       che non arriva. E una volta al giorno, come il richiamo scaduto. */
  whatsapp_senza_risposta: {
    etichetta: "Scritto su WhatsApp, nessuna risposta",
    spiegazione:
      "Un contatto di ritorno a cui hai scritto e che non risponde da giorni. Una volta al giorno.",
    gravita: "warning",
    suono: "discreto",
    gruppo: "Trattative",
    destinazione: "/CRM/importa",
    titoloGruppo: (n) => `${n} senza risposta su WhatsApp`,
  },
  saldo_oggi: {
    etichetta: "Saldo da incassare oggi",
    spiegazione: "Rata in scadenza oggi o saldo da ritirare alla consegna.",
    gravita: "warning",
    suono: "discreto",
    gruppo: "Incassi",
    destinazione: "/CRM/installazioni/oggi",
    titoloGruppo: (n) => `${n} saldi da incassare oggi`,
  },
  //  Il caso che costa davvero: il lavoro è stato consegnato e i soldi no. Non
  //  lo copriva "saldo oggi", che guarda solo la giornata: il giorno dopo la
  //  posa il residuo spariva da ogni avviso e restava scoperto per settimane.
  saldo_arretrato: {
    etichetta: "Saldo aperto dopo l'installazione",
    spiegazione: "Installazione già fatta e residuo ancora da incassare. Una volta al giorno.",
    gravita: "critical",
    suono: "urgente",
    gruppo: "Incassi",
    destinazione: "/CRM/installazioni",
    titoloGruppo: (n) => `${n} saldi aperti dopo l'installazione`,
  },
};

/** Etichetta leggibile per qualunque `kind`, compresi i quattro tipi storici
 *  che arrivano dalla tabella `notifications`. */
const ETICHETTE_STORICHE: Record<string, string> = {
  //  Le cose scritte a mano nella pagina «Da fare oggi» finiscono nella stessa
  //  tabella `notifications` della campanella, ma il loro tipo non sta nel
  //  CATALOGO (quello elenca gli eventi che il motore sa CALCOLARE dai lead, e
  //  una cosa scritta a mano non si calcola). Senza questa riga la campanella
  //  mostrava la chiave grezza — «task_manuale» — accanto a un titolo e a un
  //  corpo scritti in italiano.
  task_manuale: "Cosa da fare",
  cpl_over_budget: "Spesa fuori budget",
  no_lead_24h: "Nessun lead",
  lps_below_threshold: "Qualità lead bassa",
  creative_degraded: "Creative in degrado",
};

export function etichettaTipo(kind: string): string {
  if (kind in CATALOGO) return CATALOGO[kind as TipoEvento].etichetta;
  return ETICHETTE_STORICHE[kind] ?? kind;
}

export const GRUPPI: GruppoEvento[] = ["Appuntamenti", "Trattative", "Installazioni", "Incassi"];

export function tipiDelGruppo(g: GruppoEvento): TipoEvento[] {
  return TIPI_EVENTO.filter((t) => CATALOGO[t].gruppo === g);
}
