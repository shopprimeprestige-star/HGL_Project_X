/** ── FATTURE DALLA CHAT · I TIPI E IL CONTRATTO DELLA ROTTA ─────────────────
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §2-§3, T0). Solo tipi, nessun
 *  codice: lo leggono tutti gli altri file di questa cartella, browser e server
 *  — stesso ruolo di `bulk/tipi.ts`, per questa modalità.
 *
 *  Non è un secondo motore fatture (SPEC §1, PIANO §0.1): questa cartella
 *  produce le stesse `CampiRiga` della bulk partendo da scheda + chat + 1
 *  screenshot del bonifico, e le passa, senza toccarle, a `valutaRiga`/
 *  `valutaRigaNelLotto`/`righePerDoppioni` di `bulk/valuta.ts`. Per questo i
 *  tipi della bulk (`CampiRiga`, `Motivo`, `StatoVisibile`, `TestataLotto`,
 *  `LetturaTessera`/`LetturaIndirizzo`/`LetturaPagamento`, `RispostaErrore`,
 *  `RispostaEmettiRiga`…) si IMPORTANO, non si copiano.
 *
 *  Fino a T0 chiuso lo cambia solo T0; dopo, chi ha bisogno di un campo in più
 *  lo scrive sulla lavagna e lo decide l'architetto (stessa regola di
 *  `bulk/tipi.ts`: due sviluppatori che ritoccano lo stesso tipo in parallelo
 *  si pestano senza accorgersene).
 *
 *  ⚠️ Stessi divieti della bulk su cosa NON deve mai comparire in questi tipi:
 *   data di nascita, numero della tessera, testo grezzo dell'AI, nome completo
 *   del pagante (solo il cognome), telefono intero (solo le ultime 9 cifre),
 *   percorsi dentro le fatture. */
import type {
  CampiRiga,
  LetturaIndirizzo,
  LetturaPagamento,
  LetturaTessera,
  Motivo,
  RispostaEmettiRiga,
  RispostaErrore,
  StatoFile,
  TestataLotto,
} from "../bulk/tipi";

/* ══ 1. LA LISTA DI PARTENZA (passo 1, SPEC §3) ════════════════════════════ */

/** Un cliente proposto (pagamento senza fattura) o trovato con la ricerca
 *  manuale. Solo quello che la lista deve mostrare (SPEC §3 passo 1): nome,
 *  telefono, importo pagato e data. `schedaId` è l'UUID di `crm_leads`. */
export interface CandidatoChat {
  schedaId: string;
  nome: string;
  cognome: string;
  /** Ultime 9 cifre, mai il numero intero (stesso divieto della bulk). */
  telefono: string;
  /** Euro, il pagamento già in scheda (acconto o saldo); null = nessuno (ricerca manuale). */
  importoPagato: number | null;
  /** AAAA-MM-GG; vuoto = non registrata (ricerca manuale). */
  dataPagamento: string;
}

/* ══ 2. LA TESTATA DEL LOTTO ════════════════════════════════════════════════
 *  Stesso tipo della bulk (PIANO §2): nessun campo in più serve qui (niente
 *  `dataSeManca`, la data viene sempre dal bonifico, letto dopo — la si lascia
 *  vuota alla creazione). */
export type TestataLottoChat = TestataLotto;

/* ══ 3. LA RIGA (chiave `chat_fatture_r`) ═══════════════════════════════════ */

/** La provenienza di UNA immagine mandata all'AI (PIANO §0bis.1, T11.1): la chiave del ponte
 *  (`wa_message_id`, per ritrovare poi il percorso Storage e firmare la miniatura) o l'URL
 *  ManyChat — mai il file stesso: si legge e si scarta (SPEC §4/§5), solo la provenienza resta
 *  finché la riga non si chiude. Tipo PROPRIO di questa cartella, mai dentro `LetturaTessera`/
 *  `LetturaIndirizzo` (tipi della bulk, mai toccati). */
export interface FonteChat {
  tipo: "ponte" | "manychat";
  /** Ponte: `wa_message_id`. ManyChat: l'URL originale dell'immagine. */
  chiave: string;
}

/** Cosa si è letto nella chat per una riga: tessera e/o indirizzo trovati (o
 *  nessuno, con il perché nei `motivi`), e se ci sono foto non ancora scaricate
 *  dal ponte (segnaposto, SPEC §5) che potrebbero contenere il documento che
 *  manca. `letta` distingue «non ancora cercato» da «cercato, trovato niente»:
 *  serve a non ripagare l'AI alla ripresa (PIANO §2, chiave `chat_fatture_r`). */
export interface LetturaChat {
  letta: boolean;
  tessera?: LetturaTessera;
  indirizzo?: LetturaIndirizzo;
  /** Indice 1-based (nello stesso ordine di `fonti`) dell'immagine da cui si è letta la tessera/
   *  l'indirizzo: assente se il campo è stato letto da testo, scritto a mano, o non trovato (SPEC
   *  §3 passo 4, PIANO §0bis.1) — serve SOLO a risolvere la miniatura, mai alla valutazione. */
  tesseraImmagine?: number;
  indirizzoImmagine?: number;
  /** Le immagini mandate all'AI per questa lettura (fino a 8, stesso ordine di `raccogliChat`/
   *  `raccogliBolle`): `tesseraImmagine`/`indirizzoImmagine` vi puntano. Nessuna copia del file,
   *  solo la provenienza (PIANO §0bis.1). */
  fonti?: FonteChat[];
  /** «più CF diversi», «più indirizzi diversi», «nessuna chat trovata»… (SPEC §5). */
  motivi: Motivo[];
  /** Vero se, dopo la lettura, resta un segnaposto («Foto · Tocca per vedere») che
   *  avrebbe potuto contenere tessera o indirizzo: la riga lo dice al titolare
   *  (SPEC §5, «apri la chat, tocca "Mostra", poi "Rileggi"»). */
  segnaposto: boolean;
}

/** Il file del bonifico di una riga (chiave `chat_fatture_p`), un solo file,
 *  mai tre: stessa forma di un `FileLotto` della bulk ma senza `indice`/`tipo`
 *  (qui il ruolo è sempre «pagamento», non va ricomposto). */
export interface PagamentoChat {
  stato: StatoFile;
  /** SHA-256 esadecimale del file ORIGINALE. */
  impronta?: string;
  /** `<utente>/chat/<lotto>/<uuid>.jpg`; assente dopo la pulizia. */
  percorso?: string;
  /** Scadenza dello stato `caricando` (ISO). */
  scadeIl?: string;
  lettura?: LetturaPagamento;
  errore?: string;
}

/** Una riga del caricamento «dalla chat» (chiave `chat_fatture_r`). A differenza
 *  della bulk, `scheda` non è mai assente: ogni riga nasce già con la scheda
 *  scelta al passo 1 (PIANO §0.1 punto 2, revisione del revisore punto 2) — qui
 *  non è opzionale apposta, per non lasciare nemmeno un istante in cui una riga
 *  esisterebbe senza. */
export interface RigaChat {
  /** = `scheda` (l'UUID della scheda): qui ogni cliente è noto da subito. */
  idRiga: string;
  scheda: string;
  stato: "aperta" | "emessa" | "scartata";
  chat?: LetturaChat;
  pagamento?: PagamentoChat;
  /** Campi corretti a mano: vincono sulla lettura. Ogni modifica toglie la conferma. */
  modifiche?: Partial<CampiRiga>;
  /** «Confermo così». */
  confermata?: boolean;
  /** Codici dei motivi `conferma` accettati (per CODICE, come la bulk). */
  confermeAvvisi?: string[];
  /** La fattura nata da questa riga. */
  emessa?: { id: string; numero: number; data: string };
}

/* ══ 4. IL CONTRATTO DELLA ROTTA `/api/crm/fatture-chat` ════════════════════
 *  Una sola rotta, stessa origine, senza CORS. Ogni risposta d'errore ha la
 *  stessa forma della bulk: `{ ok: false, codice, messaggio }` (messaggio in
 *  italiano, mai con dati personali). Nei log solo i codici. */

/** Lotto aperto, in sintesi (GET senza parametri, come la bulk). */
export interface SintesiLottoChat {
  lotto: string;
  creatoIl: string;
  clienti: number;
  letti: number;
  righeAperte: number;
  righeEmesse: number;
}

/** GET `?lotto=ID`: tutto il lotto, una lettura per famiglia (il corpo è questo
 *  oggetto, senza `ok`; le righe non portano percorsi del bucket né scadenze). */
export interface DettaglioLottoChat {
  testata: TestataLottoChat;
  righe: RigaChat[];
}

export type RispostaElencoChat = SintesiLottoChat[];
export type RispostaCandidatiChat = CandidatoChat[];
/** Stessa forma della bulk: mappa «chiave della miniatura → indirizzo firmato 60 s». */
export type RispostaMiniatureChat = Record<string, string>;

export type RichiestaChat =
  /** Nuovo lotto. Nessun `dataSeManca`: la data viene sempre dal bonifico, letto dopo (PIANO §2). */
  | { azione: "crea"; descrizione: string }
  /** Spunta un candidato o un cliente trovato con la ricerca: la riga nasce
   *  SUBITO con `scheda: schedaId` scritto (PIANO §0.1 punto 2). */
  | { azione: "aggiungi-cliente"; lotto: string; schedaId: string }
  /** Una riga per chiamata (come `leggi-gruppo` nella bulk): raccoglie la chat
   *  del numero della scheda e chiama l'AI una volta. */
  | { azione: "cerca-chat"; lotto: string; idRiga: string }
  /** Il bonifico ricevuto (data URL), una riga alla volta. */
  | { azione: "carica-pagamento"; lotto: string; idRiga: string; dataUrl: string }
  | { azione: "leggi-pagamento"; lotto: string; idRiga: string }
  /** Via 2 (SPEC §9.3 passo 7, T11.2): i 4 campi del pagamento scritti a mano, screenshot
   *  facoltativo — qui, a differenza della Via 1/bulk, bastano da soli a sbloccare la riga. */
  | {
      azione: "scrivi-pagamento";
      lotto: string;
      idRiga: string;
      importo: number;
      data: string;
      modo: string;
      riferimento: string;
    }
  /** Gesto esplicito, si paga (come «Rileggi» nella bulk): la lettura della chat si rifà. */
  | { azione: "rileggi-chat"; lotto: string; idRiga: string }
  /** Via 2 (SPEC §9.3 passo 5, §9.6, T11.3): legge SOLO le bolle scelte in chat (1-10), non tutta
   *  la cronologia — l'opposto di `cerca-chat`. */
  | {
      azione: "leggi-bolle";
      lotto: string;
      idRiga: string;
      bolle: { tipo: "testo" | "immagine"; id: string }[];
    }
  /** Niente `scheda` qui (a differenza della bulk): in questa modalità la scheda
   *  si fissa una sola volta, con `aggiungi-cliente`, mai riassegnata (PIANO §0.1 punto 2). */
  | {
      azione: "salva-riga";
      lotto: string;
      idRiga: string;
      modifiche?: Partial<CampiRiga>;
      confermaRiga?: boolean;
      confermaAvvisi?: string[];
      scarta?: boolean;
    }
  | { azione: "emetti-riga"; lotto: string; idRiga: string; emittente: string }
  | { azione: "prendi-controllo"; lotto: string; emittente: string }
  | { azione: "annulla"; lotto: string }
  /** Cancella un lotto vecchio o concluso e il suo bonifico, orfani compresi. */
  | { azione: "pulisci"; lotto?: string };

export type AzioneChat = RichiestaChat["azione"];

export type RispostaChat =
  | { ok: true; azione: "crea"; lotto: string }
  | { ok: true; azione: "aggiungi-cliente"; riga: RigaChat }
  | { ok: true; azione: "cerca-chat" | "rileggi-chat" | "leggi-bolle"; riga: RigaChat }
  | {
      ok: true;
      azione: "carica-pagamento" | "leggi-pagamento" | "scrivi-pagamento";
      riga: RigaChat;
    }
  | { ok: true; azione: "salva-riga"; riga: RigaChat; lottoChiuso: boolean }
  | ({ azione: "emetti-riga" } & RispostaEmettiRiga)
  | { ok: true; azione: "prendi-controllo" | "annulla" | "pulisci"; rimossi?: number }
  | RispostaErrore;
