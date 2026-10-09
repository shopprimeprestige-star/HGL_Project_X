/** ── CHE COSA ENTRA IN UNA COPIA, E CHE COSA NON NE ESCE MAI ───────────────
 *
 *  Questo file è UN ELENCO, non una procedura: le tabelle che compongono una
 *  copia completa, le colonne che non devono uscire, e le chiavi di
 *  configurazione che restano nel database.
 *
 *  ⚠️ STA DA SOLO PERCHÉ LO LEGGONO IN DUE. Lo usa la rotta che fa la copia
 *   dal gestionale (api.crm.backup) e lo usa lo strumento che esporta tutto da
 *   riga di comando (strumenti/esporta-tutto.mjs). Due elenchi scritti a mano
 *   in due posti sono due copie che un giorno contengono cose diverse — e la
 *   differenza si scopre il giorno in cui si rimette dentro un archivio.
 *  ⚠️ QUI NON C'È NIENTE DEL DATABASE: nessuna connessione, nessuna chiave.
 *   Solo nomi e regole, così si può provare senza niente acceso.
 *  ───────────────────────────────────────────────────────────────────────── */

export interface Sezione {
  /** Nome del campo nel file. */
  campo: string;
  tabella: string;
  etichetta: string;
  /** Colonna su cui si riconosce una riga già presente (e su cui si ordina). */
  chiave: string;
  /** "crm" = riga {id,user_id,data}; "riga" = la riga intera così com'è. */
  forma: "crm" | "riga";
  /** Se true, "sostituisci" prima svuota. Le configurazioni non si svuotano MAI:
   *  cancellare una riga di impostazioni per riscriverla identica è solo rischio. */
  svuotabile: boolean;
  /** Colonne che non escono e che l'importazione non scrive (credenziali). */
  colonneRiservate?: string[];
  nota?: string;
}

export const SEZIONI: Sezione[] = [
  //  L'ordine conta: prima i consulenti, perché i lead li citano.
  {
    campo: "consulenti",
    tabella: "crm_consultants",
    etichetta: "Consulenti",
    chiave: "id",
    forma: "crm",
    svuotabile: true,
  },
  {
    campo: "leads",
    tabella: "crm_leads",
    etichetta: "Lead",
    chiave: "id",
    forma: "crm",
    svuotabile: true,
  },
  {
    campo: "spese",
    tabella: "crm_ad_spending",
    etichetta: "Spesa pubblicitaria inserita a mano",
    chiave: "id",
    forma: "crm",
    svuotabile: true,
  },
  {
    campo: "preventivi",
    tabella: "quote_requests",
    etichetta: "Preventivi",
    chiave: "id",
    forma: "riga",
    svuotabile: true,
  },
  {
    campo: "sconti",
    tabella: "discount_codes",
    etichetta: "Codici sconto",
    chiave: "id",
    forma: "riga",
    svuotabile: true,
  },
  {
    campo: "leadPubblici",
    tabella: "public_leads",
    etichetta: "Richieste dal sito",
    chiave: "id",
    forma: "riga",
    svuotabile: true,
  },
  {
    campo: "candidature",
    tabella: "consultant_applications",
    etichetta: "Candidature consulenti",
    chiave: "id",
    forma: "riga",
    svuotabile: true,
  },
  {
    campo: "disponibilita",
    tabella: "funnel_settings",
    etichetta: "Orari e disponibilità",
    chiave: "id",
    forma: "riga",
    svuotabile: false,
  },
  {
    campo: "landing",
    tabella: "landing_content",
    etichetta: "Contenuti della landing",
    chiave: "id",
    forma: "riga",
    svuotabile: false,
  },
  {
    campo: "utenti",
    tabella: "user_settings",
    etichetta: "Utenti e permessi",
    chiave: "user_id",
    forma: "riga",
    svuotabile: false,
  },
  {
    campo: "notifiche",
    tabella: "notification_prefs",
    etichetta: "Preferenze notifiche",
    chiave: "user_id",
    forma: "riga",
    svuotabile: false,
  },
  {
    campo: "whatsapp",
    tabella: "whatsapp_settings",
    etichetta: "WhatsApp: template, valori e stati disattivati",
    chiave: "user_id",
    forma: "riga",
    svuotabile: false,
    colonneRiservate: ["access_token", "app_secret", "webhook_verify_token"],
    nota: "token e chiavi restano nel database",
  },
  {
    campo: "tracking",
    tabella: "tracking_config",
    etichetta: "Tracking, costi e margini",
    chiave: "user_id",
    forma: "riga",
    svuotabile: false,
    colonneRiservate: ["meta_access_token", "tiktok_access_token"],
    nota: "token e chiavi restano nel database",
  },
];

/** ── COSA NON C'È DENTRO, E PERCHÉ ─────────────────────────────────────────
 *  Si dice a schermo. Promettere una copia "di tutto" e consegnarne una senza
 *  i video è peggio che dire subito cosa manca: chi si fida di una promessa
 *  sbagliata se ne accorge il giorno in cui gli serve. */
export const FUORI = [
  {
    cosa: "I file video delle registrazioni",
    perche: "restano nell'archivio online; nel file ci sono data, durata, nome e collegamento",
  },
  {
    cosa: "PIN, token, chiavi e password",
    perche: "un file che gira per email non deve contenerli",
  },
  {
    cosa: "Sessioni aperte e stanze in corso",
    perche: "durano minuti: rimetterle dentro non avrebbe senso",
  },
  {
    cosa: "Spesa scaricata da Meta e TikTok",
    perche: "si riscarica dalle rispettive schede in un clic",
  },
  {
    cosa: "Messaggi WhatsApp, eventi della landing e notifiche già lette",
    perche: "sono lo storico del traffico, non dati inseriti da qualcuno",
  },
];

/** Le chiavi di `app_config` che NON escono mai: contengono credenziali,
 *  sessioni o stati che durano pochi minuti. */
export const RISERVATE = [
  /^presenters$/, //  l'elenco dei presentatori contiene i PIN
  /^csess:/, //  sessioni consulente
  /^accpin:/, //  tentativi di PIN sbagliati
  /^quote_session/, //  sessioni di preventivo (una per riferimento)
  /^quote_edit/, //  permessi e password di modifica di un preventivo
  /^session_live$/, //  la stanza aperta adesso
  /^turn_config$/, //  credenziali del server video
  /*  ── ⚠️ L'INDIRIZZO DEI LAVORI PERIODICI NON VIAGGIA ────────────────────
      `cron_sito` e `cron_chiave` dicono dov'è QUESTA installazione. Non sono
      segreti (la chiave è quella pubblica), ma portarseli dietro in una copia
      vuol dire che il sistema nuovo, appena importa i dati, programma i suoi
      lavori periodici contro il SITO VECCHIO — ed è esattamente il guasto che
      si è appena tolto dalle migrazioni. Chi installa altrove scrive le sue
      due righe (vedi docs/CLONARE.md). */
  /^cron_/,
  /^consultant_key$/,
  /token/i,
  /secret/i,
  /password/i,
  /(^|[_:])pin([_:]|$)/i,
  /credential/i,
  /key$/i,
];
export const esportabile = (k: string) => !RISERVATE.some((r) => r.test(k));
