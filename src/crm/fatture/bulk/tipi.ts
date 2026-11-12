/** ── FATTURE BULK · I TIPI E IL CONTRATTO DELLA ROTTA ──────────────────────
 *  Commessa 2026-11-12-fatture-bulk (PIANO §3). Solo tipi, nessun codice: lo
 *  leggono tutti gli altri file di questa cartella, browser e server, ed è per
 *  questo che sta qui e non altrove. Fino a T0 chiuso lo cambia solo T0; dopo,
 *  chi ha bisogno di un campo in più lo scrive sulla lavagna e lo decide
 *  l'architetto (due sviluppatori che ritoccano lo stesso tipo in parallelo si
 *  pestano senza accorgersene).
 *
 *  Il flusso, in una riga: file → (AI) → `LetturaFile` → `ricomponi` →
 *  `GruppoRicomposto` → `valutaRiga` (con le `DecisioniRiga` del titolare) →
 *  `RigaValutata` → `emetti-riga` → `Fattura` con `origineBulk`.
 *
 *  ⚠️ Cosa NON deve mai comparire in nessuno di questi tipi: data di nascita,
 *   numero della tessera, testo grezzo dell'AI, nome completo del pagante
 *   (solo il cognome), telefono intero (solo le ultime 9 cifre), percorsi
 *   dentro le fatture. Sono dati che non servono a fatturare e che finirebbero
 *   in `app_config`, leggibile da ogni utente del CRM. */
import type { MetodoPagamento } from "../modi-di-incasso";
import type { DatiAzienda, Fattura } from "../tipi";

/* ══ 1. I FILE E LA LORO LETTURA ═══════════════════════════════════════════ */

/** Che cos'è uno screenshot. `altro` = illeggibile o di un'altra cosa. */
export type TipoFile = "indirizzo" | "tessera" | "pagamento" | "altro";

/** Come ha pagato, secondo lo screenshot. Quello che non è nell'elenco del CRM
 *  (PayPal, Satispay…) resta com'è e la riga è bloccata: mai un bonifico di ripiego. */
export type ModoLetto = MetodoPagamento | "paypal" | "satispay" | "altro" | "";

/** Ogni lettura porta `incerti`: i NOMI dei campi di cui l'AI non è sicura
 *  (`"cap"`, `"codiceFiscale"`…). Per un campo obbligatorio incerto la riga è
 *  «da confermare» (PIANO D7). */
export interface LetturaIndirizzo {
  tipo: "indirizzo";
  /** Via e civico COME SCRITTI, senza dedurre niente: per decisione del titolare è la residenza. */
  indirizzo: string;
  /** 5 cifre, altrimenti vuoto (un CAP di 4 cifre viene scartato). */
  cap: string;
  comune: string;
  /** Sigla maiuscola di 2 lettere, o vuoto. */
  provincia: string;
  /** Solo le ultime 9 cifre (basta ad abbinare la scheda). */
  telefono: string;
  nome: string;
  cognome: string;
  /** Vero SOLO se lo screenshot si dichiara di spedizione (D15.7). */
  indirizzoDiSpedizione: boolean;
  incerti: string[];
}

export interface LetturaTessera {
  tipo: "tessera";
  nome: string;
  cognome: string;
  /** Il codice fiscale, SOLO se supera il controllo del carattere finale; altrimenti vuoto. */
  codiceFiscale: string;
  /** Quello che l'AI ha letto, valido o no: serve a correggere guardando lo screenshot (R8). */
  cfLetto: string;
  incerti: string[];
}

export interface LetturaPagamento {
  tipo: "pagamento";
  /** Euro, quello PAGATO dal cliente, prima delle commissioni; null = non letto. */
  importo: number | null;
  /** Un secondo importo visibile (commissioni, totale al netto…): serve solo a dubitare. */
  importoAltro: number | null;
  /** «EUR» o quello che c'è scritto; vuoto = non letta. */
  valuta: string;
  esito: "completato" | "non_completato" | "";
  /** AAAA-MM-GG, SOLO se anno visibile e formato non ambiguo; altrimenti vuoto. */
  data: string;
  /** Se l'anno non si vede ma giorno e mese sì: «MM-GG» (la riga propone l'anno, R19). Altrimenti vuoto. */
  meseGiorno: string;
  /** La data com'è scritta nello screenshot, per mostrarla accanto al campo. */
  dataTesto: string;
  annoVisibile: boolean;
  /** Vero se «03/04/2026» potrebbe essere gg/mm o mm/gg. */
  formatoAmbiguo: boolean;
  modo: ModoLetto;
  /** Vero se POS e carta (o altro) non si distinguono. */
  modoIncerto: boolean;
  /** CRO, codice operazione… */
  riferimento: string;
  /** SOLO il cognome di chi ha pagato (D11e). */
  paganteCognome: string;
  incerti: string[];
}

export interface LetturaAltro {
  tipo: "altro";
  incerti: string[];
}

export type LetturaFile = LetturaIndirizzo | LetturaTessera | LetturaPagamento | LetturaAltro;

/** I motivi per cui una chiamata all'AI o un'azione della rotta non va a buon fine.
 *  `troncata` e `credito` non si ripetono mai da soli (si pagherebbe due volte);
 *  `occupato` = un'altra scheda sta già leggendo il gruppo: «riprova fra poco»,
 *  e non conta come fallimento del freno (T8/T9). */
export type CodiceErrore =
  | "timeout"
  | "limite"
  | "credito"
  | "politica_dati"
  | "rete"
  | "troncata"
  | "illeggibile"
  | "occupato"
  | "non_autorizzato"
  | "non_permesso"
  | "richiesta_non_valida"
  | "non_trovato"
  | "troppi_file"
  | "file_non_valido"
  | "impostazioni_cambiate"
  | "emittente_occupato"
  | "lucchetto_occupato"
  | "scrittura_fallita"
  | "conflitto"
  | "altra_origine"
  | "interno";

/** Stato di un file nel lotto (chiave `bulk_fatture_f`).
 *  `caricando` ha una scadenza: se il Worker muore fra la chiave e l'upload, il
 *  file si ritenta invece di restare «già presente» per sempre. */
export type StatoFile = "caricando" | "salvato" | "letto" | "errore" | "emessa" | "scartata";

export interface FileLotto {
  /** Posizione nell'ordine di caricamento (0-based). */
  indice: number;
  stato: StatoFile;
  /** SHA-256 esadecimale del file ORIGINALE (non ridotto). */
  impronta: string;
  /** Il tipo riconosciuto; "" finché non letto. SOPRAVVIVE alla pulizia (D11b): la ricomposizione resta identica. */
  tipo: TipoFile | "";
  /** `<utente>/bulk/<lotto>/<uuid>.jpg`; assente dopo la pulizia. */
  percorso?: string;
  /** Stesso screenshot di un altro file già letto (stessa impronta): non si rilegge. */
  copiaDi?: number;
  /** Scadenza dello stato `caricando` (ISO). */
  scadeIl?: string;
  /** La lettura normalizzata; SVUOTATA (assente) dopo emissione o scarto (D11a). */
  lettura?: LetturaFile;
  errore?: CodiceErrore;
}

/* ══ 2. IL LOTTO E LE DECISIONI DEL TITOLARE ═══════════════════════════════ */

/** Testata del lotto (chiave `bulk_fatture_t`). */
export interface TestataLotto {
  lotto: string;
  creatoIl: string;
  descrizione: string;
  /** Vuoto = nessuna data di riserva. Se c'è, la riga che la usa è sempre «da confermare» (D16). */
  dataSeManca: string;
  /** `firmaImpostazioni(azienda)` al momento della creazione: se cambia, l'emissione si ferma (R1). */
  firmaImpostazioni: string;
}

/** I campi della riga che il titolare vede e può correggere: quelli EFFETTIVI
 *  (lettura + modifiche). È l'ingresso delle regole di riga e di `fatturaDaRiga`. */
export interface CampiRiga {
  nome: string;
  cognome: string;
  codiceFiscale: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  /** Euro, lordo (IVA compresa); null = mancante. */
  importo: number | null;
  /** AAAA-MM-GG; vuoto = mancante. */
  data: string;
  /** Vuoto = da scegliere. Mai predefinito a bonifico. */
  modo: MetodoPagamento | "";
  riferimento: string;
}

/** Cosa ha deciso la persona su una riga (chiave `bulk_fatture_r`). Dopo emissione
 *  o scarto restano solo `stato` ed `emessa` (D11a): modifiche e conferme si svuotano. */
export interface DecisioniRiga {
  idRiga: string;
  stato: "aperta" | "emessa" | "scartata";
  /** Campi corretti a mano: vincono sulla lettura. Ogni modifica toglie la conferma. */
  modifiche?: Partial<CampiRiga>;
  /** Scheda scelta a mano: id della scheda, `null` = «nessuna»; assente = abbinamento automatico. */
  scheda?: string | null;
  /** «Confermo così». */
  confermata?: boolean;
  /** Codici dei motivi `conferma` accettati (per CODICE, così valgono anche se i numeri cambiano). */
  confermeAvvisi?: string[];
  /** La fattura nata da questa riga. */
  emessa?: { id: string; numero: number; data: string };
}

/* ══ 3. RICOMPOSIZIONE E VALUTAZIONE ═══════════════════════════════════════ */

/** Un cliente ricomposto dai tipi dei file (T2). `idRiga` = `idRigaDa(indici)`. */
export interface GruppoRicomposto {
  idRiga: string;
  /** Indici dei file, in ordine di caricamento. */
  indici: number[];
  /** Posizione 1-based nell'elenco, per «n. caricamento». */
  numero: number;
  /** I tipi presenti, nell'ordine dei file. */
  tipi: TipoFile[];
  /** Tessera e indirizzo e pagamento in un ordine diverso dal solito: letto lo stesso, avviso. */
  ordineDiverso: boolean;
  /** Messo insieme dai tipi dopo uno scorrimento: sempre da confermare. */
  ricomposta: boolean;
  /** Manca almeno un tipo fra indirizzo, tessera, pagamento: errore strutturale. */
  incompleta: boolean;
  mancano: TipoFile[];
}

export type Gravita = "blocca" | "conferma" | "avviso";

/** Un motivo per cui una riga non è «pronta» (T3/T4/T5/T7). */
export interface Motivo {
  /** Stabile: la conferma si dà per codice (`"data_anteriore"`, `"importo_alto"`…). */
  codice: string;
  gravita: Gravita;
  /** Una frase italiana che dice COSA non va e DOVE si corregge. */
  testo: string;
  /** Il campo da correggere, se è uno. */
  campo?: keyof CampiRiga;
  /** Strutturale = la riga non si può correggere a mano (gruppo incompleto, lettura fallita): stato «errore». */
  strutturale?: boolean;
}

export type StatoRiga = "pronto" | "da_controllare" | "errore";

/** Quello che si vede in elenco. Le ultime tre vengono dalle `DecisioniRiga`. */
export type StatoVisibile = StatoRiga | "confermata" | "emessa" | "scartata";

export interface EsitoStato {
  stato: StatoRiga;
  /** Nessun `blocca` + ogni `conferma` confermato (per codice) + riga confermata. */
  emettibile: boolean;
}

/** Il contesto con cui si valutano le regole di una riga (T3). */
export interface ContestoRiga {
  /** Oggi, data locale ITALIANA (AAAA-MM-GG) — non UTC (D9). */
  oggi: string;
  gruppo: Pick<GruppoRicomposto, "ricomposta" | "ordineDiverso" | "incompleta" | "mancano">;
  indirizzo?: LetturaIndirizzo;
  tessera?: LetturaTessera;
  pagamento?: LetturaPagamento;
  /** La data della riga viene dal campo di riserva (D16): sempre «da confermare». */
  dataDaRiserva: boolean;
}

/** Scheda del CRM, per l'abbinamento (T4). Si mappa dalla scheda vera: qui solo quel che serve. */
export interface SchedaPerAbbinamento {
  id: string;
  nome: string;
  cognome: string;
  codiceFiscale: string;
  /** Ultime 9 cifre. */
  telefono: string;
}

/** I fatti sulle date, mostrati PRIMA di emettere (D1b). Li calcola `fattiSulleDate` (T7) dal vivo. */
export interface FattiSulleDate {
  ultimaEmessa: { id: string; numero: number; data: string } | null;
  dataMinima: string;
  dataMassima: string;
  /** Righe con data anteriore all'ultima emessa. */
  righeDataAnteriore: string[];
  /** Righe oltre i 12 giorni dall'operazione (stima, a oggi). */
  righeOltreTermine: string[];
}

/** Il risultato di `valutaRiga`: tutto quello che serve per mostrarla e per emetterla. Lo calcola
 *  UNA funzione, identica in browser e server (T10). */
export interface RigaValutata {
  idRiga: string;
  numero: number;
  stato: StatoVisibile;
  emettibile: boolean;
  campi: CampiRiga;
  motivi: Motivo[];
  /** Id della scheda abbinata (o scelta a mano), `null` = senza scheda. */
  scheda: string | null;
  /** La fattura simulata (numero provvisorio): da qui si calcolano XML e totali. Assente se la riga è in errore strutturale. */
  fattura?: Fattura;
  /** Totale che finirebbe nell'XML (R10), se diverso dal pagato c'è un avviso. */
  totaleNelFile?: number;
  /** L'ultimo giorno utile per l'invio allo SDI (stima, D15.2). */
  ultimoGiornoUtile?: string;
}

/** Ingresso e contesto di `valutaRiga` / `valutaLotto` (T10). Il contesto lo
 *  costruisce chi chiama (browser: dalle sue letture; server: dall'archivio). */
export interface IngressoRiga {
  gruppo: GruppoRicomposto;
  file: FileLotto[];
  decisioni?: DecisioniRiga;
}

export interface ContestoValutazione {
  lotto: TestataLotto;
  azienda: DatiAzienda;
  oggi: string;
  emesse: Fattura[];
  bozze: Fattura[];
  schede: SchedaPerAbbinamento[];
  /** Impronte dei pagamenti già viste in altri lotti aperti. */
  impronteAltriLotti: string[];
}

export type ValutaRiga = (riga: IngressoRiga, ctx: ContestoValutazione) => RigaValutata;
export type ValutaLotto = (
  righe: IngressoRiga[],
  ctx: ContestoValutazione,
) => { righe: RigaValutata[]; fatti: FattiSulleDate; motiviLotto: Motivo[] };

/* ══ 4. IL CONTRATTO DELLA ROTTA `/api/crm/fatture-bulk` ═══════════════════ */
/*  Una sola rotta, stessa origine, senza CORS. Ogni risposta d'errore ha la
 *  stessa forma: `{ ok: false, codice, messaggio }` (messaggio in italiano,
 *  mai con dati personali). Nei log solo i codici. */

export interface RispostaErrore {
  ok: false;
  codice: CodiceErrore;
  messaggio: string;
}

/** Lotto aperto, in sintesi (GET senza parametri). */
export interface SintesiLotto {
  lotto: string;
  creatoIl: string;
  file: number;
  letti: number;
  righeAperte: number;
  righeEmesse: number;
}

/** GET senza parametri: il corpo è l'ARRAY dei lotti aperti, dal più recente (al massimo 15), senza `ok` attorno.
 *  GET `?lotto=ID&url=0004,0005`: il corpo è la mappa «indice a 4 cifre → indirizzo firmato 60 s» (al massimo 6),
 *  solo per i file ancora nel bucket. Gli errori sono sempre una `RispostaErrore`. */
export type RispostaElenco = SintesiLotto[];
export type RispostaMiniature = Record<string, string>;

/** GET `?lotto=ID`: tutto il lotto, una lettura per famiglia (il corpo è questo oggetto, senza `ok`;
 *  i file non portano percorsi del bucket né scadenze). */
export interface DettaglioLotto {
  testata: TestataLotto;
  file: FileLotto[];
  righe: DecisioniRiga[];
}

export type RichiestaBulk =
  /** Nuovo lotto. Nessun `tipo`: ogni pagamento è una fattura «unica» (D3). */
  | { azione: "crea"; descrizione: string; dataSeManca?: string }
  /** Un file ridotto (data URL) con la sua impronta e la posizione. */
  | { azione: "file"; lotto: string; indice: number; impronta: string; dataUrl: string }
  /** Legge i tre file di una posizione (un solo tentativo all'AI, ≤ 55 s). */
  | { azione: "leggi-gruppo"; lotto: string; gruppo: number }
  /** Svuota la lettura dei file indicati e li rilegge (gesto esplicito: si paga). */
  | { azione: "rileggi"; lotto: string; indici: number[] }
  | {
      azione: "salva-riga";
      lotto: string;
      idRiga: string;
      modifiche?: Partial<CampiRiga>;
      scheda?: string | null;
      confermaRiga?: boolean;
      confermaAvvisi?: string[];
      scarta?: boolean;
    }
  /** `emittente` = id casuale della scheda del browser (in memoria). */
  | { azione: "emetti-riga"; lotto: string; idRiga: string; emittente: string }
  | { azione: "prendi-controllo"; lotto: string; emittente: string }
  | { azione: "annulla"; lotto: string }
  /** Cancella un lotto vecchio o concluso e i suoi file, orfani compresi. Un lotto per chiamata. */
  | { azione: "pulisci"; lotto?: string };

export type AzioneBulk = RichiestaBulk["azione"];

/** Come finisce `emetti-riga`: `emessa`, `saltata` (la riga non è emettibile per un motivo SUO: le altre
 *  proseguono) o `ferma` (errore di sistema: si ferma tutto il lotto). */
export type RispostaEmettiRiga =
  | {
      ok: true;
      esito: "emessa";
      fattura: { id: string; numero: number; data: string };
      /** Numeri emessi da altri fra l'ultima riga e questa (D14): registrati, non fermano il lotto. */
      saltoDiNumeri?: { da: number; a: number };
      lottoChiuso: boolean;
    }
  | { ok: true; esito: "saltata"; motivi: Motivo[] }
  | { ok: true; esito: "ferma"; codice: CodiceErrore; messaggio: string };

export type RispostaBulk =
  | { ok: true; azione: "crea"; lotto: string }
  /** `gia` = chiave già presente, nessun upload (due richieste insieme). */
  | { ok: true; azione: "file"; esito: "salvato" | "gia" | "copia"; copiaDi?: number }
  | { ok: true; azione: "leggi-gruppo" | "rileggi"; file: FileLotto[] }
  | { ok: true; azione: "salva-riga"; riga: DecisioniRiga; lottoChiuso: boolean }
  | ({ azione: "emetti-riga" } & RispostaEmettiRiga)
  | { ok: true; azione: "prendi-controllo" | "annulla" | "pulisci"; rimossi?: number }
  | RispostaErrore;
