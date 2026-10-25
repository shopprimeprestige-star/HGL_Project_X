/** ── LE CHIAMATE DEL BROWSER A `/api/crm/manychat` E `/api/crm/contatto-wa` ──
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 5 (Dev D).
 *
 *  ⚠️ QUESTO FILE È IL CONTRATTO CON IL COMPITO 4 (Dev B), CHE SCRIVE LE ROTTE
 *   DOPO. I componenti (PastigliaContatto, ManychatPannello, …) si appoggiano
 *   solo ai tipi e alle funzioni di qui: se le rotte rispondono in un altro
 *   modo, si cambia QUESTO file (o la rotta), non i componenti.
 *
 *  ── /api/crm/manychat (dietro `guardiaCRM("impostazioni")`) ───────────────
 *   GET   → 200 `StatoManychat` (corpo diretto, niente involucro).
 *   POST  → il corpo è UNO fra questi (il server ne accetta uno per volta):
 *     { interruttori: { acceso?, promemoria?, ricontatti?, leadNuovo?, giornoMeet? } }
 *     { tetti: { ricontatti?, leadNuovi?, totale? } }   solo al ribasso: il
 *                                            server li riporta comunque alle costanti
 *     { stati: { [stato]: boolean } }       un interruttore per stato con un
 *                                            messaggio; accendere scrive l'ora
 *     { fraseModulo: { giorno: "AAAA-MM-GG" } }  il giorno in cui la frase del
 *                                            consenso è entrata nel modulo Meta
 *                                            → 200 `{ fraseModulo: FraseModulo }`
 *     { indirizzoSede: string }              vuoto = lo toglie
 *     { flussi: { [modello]: ns } }         ns vuoto = toglie il flusso
 *     { canale: "cloud" | "manychat" }
 *       → 200 `{ config: ConfigManychat }`
 *     { azione: "prova_a_secco" }                     → 200 `ProvaASecco`
 *     { azione: "prova_collegamento" }                → 200 `CollegamentoManychat`
 *     { azione: "prova_creazione_contatto", telefono } → 200 `ProvaCreazione`
 *   Errori: `{ error: string }` col codice HTTP (401 senza accesso, 403 senza
 *   «impostazioni», 400 corpo non valido, 422 comando rifiutato: «Lead nuovo»
 *   senza la data della frase, data nel futuro; 503 manca l'aggiornamento del
 *   database, 5xx guasto). La «prova a secco» non
 *   chiama ManyChat; la «prova di collegamento» chiede solo «chi sei?» e
 *   legge flussi e campi; la «prova di creazione» crea il contatto del
 *   titolare dentro ManyChat e non salva il numero nel CRM. Nessuna manda
 *   un messaggio.
 *
 *  ── /api/crm/contatto-wa (dietro `guardiaCRM(null)`) ──────────────────────
 *   POST { leadId, stato } → 200 `{ contattoWa, avviso? }` (il secondo stato
 *   com'è dopo il cambio, storia compresa; `avviso` = frase da mostrare quando
 *   il cambio è riuscito ma qualcosa è rimasto a metà, per esempio il numero
 *   ancora bloccato per gli invii dopo aver tolto STOP). Chi cambia è quello della sessione: il
 *   nome NON lo manda il browser. 403 `{ error }` se la scheda è di un'altra
 *   installazione o se si toglie STOP senza «impostazioni»
 *   (`solo_titolare_toglie_stop`); 404 se la scheda non c'è; 409 se la scheda
 *   è cambiata mentre si salvava.
 *
 *  Le frasi d'errore in chiaro (`fraseErrore`) sono in vista-pannello.ts, e
 *  sono provate in prove/manychat/pannello.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import { fetchCRM } from "@/crm/AuthContext";
import type { ContattoWa, StatoContattoWa, TipoInvio } from "../types";
import type { CanaleWhatsapp } from "./porta";
import { FRASE_RETE, fraseErrore } from "./vista-pannello";

export const ROTTA_MANYCHAT = "/api/crm/manychat";
export const ROTTA_CONTATTO_WA = "/api/crm/contatto-wa";

/** Esito di ogni chiamata: mai un'eccezione verso i componenti. `errore` è già
 *  una frase da mostrare. `stato` 0 = il server non ha risposto. */
export type RispostaCrm<T> = { ok: true; dati: T } | { ok: false; stato: number; errore: string };

/** Il canale con cui parlano le rotte e il riquadro. */
export type CanaleManychat = CanaleWhatsapp;

export interface ConfigManychat {
  canale: CanaleManychat;
  /** interruttore generale */
  acceso: boolean;
  promemoria: boolean;
  ricontatti: boolean;
  /** «Lead nuovo»: primo messaggio e richiamo dopo 24 ore (spento di serie) */
  leadNuovo: boolean;
  /** «Giorno del meet»: messaggio del mattino e all'ora col link (spento di serie) */
  giornoMeet: boolean;
  /** ISO dell'ultima accensione di «Lead nuovo»: i lead arrivati prima non ricevono niente */
  leadNuovoDal: string | null;
  /** stato → ISO dell'accensione; assente = spento (mai «da_ricontattare»:
   *  quello è `ricontatti`) */
  stati: Record<string, string>;
  /** l'indirizzo della sede per il promemoria «in sede»; `null` = non scritto */
  indirizzoSede: string | null;
  /** false = manca l'aggiornamento del database per le sequenze: gli interruttori
   *  nuovi sono chiusi */
  sequenze: boolean;
  /** i tetti scelti nel riquadro (mai sopra le costanti: il server li riporta giù) */
  tetti: { ricontatti?: number; leadNuovi?: number; totale?: number };
  /** modello → `ns` del flusso ManyChat */
  flussi: Record<string, string>;
  /** ISO: la prima volta che si è acceso (per la prima settimana a 10) */
  primaAccensione: string | null;
  /** ISO: l'ultima accensione */
  ultimaAccensione: string | null;
  /** perché il sistema ha spento l'interruttore da solo; `null` = nessun fermo */
  fermatoMotivo: string | null;
}

export interface ProblemaGiro {
  /** ISO */
  il: string;
  /** nome abbreviato («Mario R.»), MAI il telefono */
  nome: string;
  tipo: Exclude<TipoInvio, "chat" | "webinar" | "prova">;
  motivo: string;
}

export interface GiroManychat {
  /** ISO dell'ultimo giro finito; `null` = non è mai partito */
  ultimoGiroIl: string | null;
  /** ISO dell'ultima risposta arrivata da ManyChat */
  ultimaRispostaIl: string | null;
  /** ISO dell'ultimo messaggio automatico partito */
  ultimoInvioIl: string | null;
  /** ISO: dopo quest'ora può partire il prossimo ricontatto */
  prossimoRicontattoDopo: string | null;
  /** conteggi del giorno di oggi (Roma). `leadNuovi` = primo contatto + richiamo;
   *  `totale` = tutti i messaggi che contano nel tetto (non la conferma) */
  oggi: {
    promemoria: number;
    ricontatti: number;
    leadNuovi: number;
    totale: number;
    risposte: number;
  };
  /** gli ultimi problemi (il server ne manda al massimo 20) */
  problemi: ProblemaGiro[];
}

/** Una riga del «Collegamento ok»: la frase la scrive il server, la riga la
 *  disegna il riquadro.
 *
 *  ⚠️ GLI `id` OBBLIGATORI. `prova_collegamento` deve mandare UNA riga per
 *   ognuno di questi `id` (elenco in `ID_COLLEGAMENTO`, vista-pannello.ts):
 *     chiave               la chiave è accettata («chi sei?»)
 *     is_pro               l'account è Pro
 *     flusso:<modello>     il flusso esiste in ManyChat, uno per ogni modello
 *                          di MODELLI_FLUSSO: flusso:consulenza_conferma_presenza,
 *                          flusso:hgl_promemoria_meet, flusso:hgl_ricontatto_consulenza
 *     campi_crm            i campi crm_* ci sono
 *     segreto_ritorno      (la riga la scrive il BROWSER da `segretoRitornoPresente`)
 *     ultima_risposta      (la riga la scrive il BROWSER da `giro.ultimaRispostaIl`)
 *     creazione_contatti   ok / negata (errore) / da_verificare
 *   Il riquadro NON mostra «Collegamento ok» in verde se manca il segreto del
 *   ritorno o se manca una riga obbligatoria: quella mancante vale «da
 *   verificare». Ogni altra riga (id diverso) si mostra in coda. */
export interface RigaCollegamento {
  id: string;
  /** `non_serve` = il flusso è di un interruttore spento: grigio, né problema né dubbio */
  esito: "ok" | "errore" | "da_verificare" | "non_serve";
  testo: string;
}

export interface CollegamentoManychat {
  /** ISO */
  controllatoIl: string;
  righe: RigaCollegamento[];
}

/** Il giorno da cui la frase del consenso c'è nel modulo Meta. Valgono solo i
 *  moduli compilati da `il` in poi. */
export interface FraseModulo {
  /** ISO: l'inizio di quel giorno a Roma */
  il: string;
  /** chi l'ha segnata (nome, mai il numero) */
  da: string;
  /** ISO: quando è stata segnata */
  segnatoIl?: string;
}

/** La riga «Foglio Google»: mai nomi, numeri o id, solo conti e un'ora. */
export interface FoglioManychat {
  /** false = manca l'aggiornamento del database del foglio */
  migrazione: boolean;
  /** il segreto del foglio (SHEETS_INGRESSO_TOKEN) c'è nel sito */
  segretoPresente: boolean;
  /** l'ultima riga ricevuta: l'ora e l'esito (`nuovo`, `ritorno`, …) */
  ultimo: { il: string; esito: string } | null;
  /** righe ricevute oggi (giorno di Roma) */
  righeOggi: number;
  /** quante ne ammette il giorno */
  tetto: number;
}

/** Tutto quello che il riquadro legge in una volta. */
export interface StatoManychat {
  /** ISO: l'ora del SERVER. Il riquadro misura «nessun giro da 5 minuti» su questa. */
  adesso: string;
  /** false = manca l'aggiornamento del database (la migrazione) */
  migrazione: boolean;
  chiavePresente: boolean;
  segretoRitornoPresente: boolean;
  config: ConfigManychat;
  giro: GiroManychat;
  /** l'ultimo controllo di collegamento; `null` = mai fatto */
  collegamento: CollegamentoManychat | null;
  /** la data della frase del consenso nel modulo; `null` = non segnata */
  fraseModulo: FraseModulo | null;
  foglio: FoglioManychat;
}

export interface RigaProva {
  /** nome abbreviato */
  nome: string;
  tipo: "promemoria" | "ricontatto";
  esito: "scriverebbe" | "aspetta" | "salta";
  motivo: string;
}

export interface ProvaASecco {
  /** ISO */
  adesso: string;
  righe: RigaProva[];
}

export interface ProvaCreazione {
  esito: "ok" | "negata" | "errore";
  messaggio: string;
}

export type ComandoManychat =
  | {
      interruttori: Partial<
        Pick<ConfigManychat, "acceso" | "promemoria" | "ricontatti" | "leadNuovo" | "giornoMeet">
      >;
    }
  | { tetti: Partial<ConfigManychat["tetti"]> }
  | { flussi: Record<string, string> }
  | { canale: CanaleManychat }
  | { stati: Record<string, boolean> }
  | { indirizzoSede: string };

async function chiama<T>(url: string, corpo?: unknown): Promise<RispostaCrm<T>> {
  try {
    const res = await fetchCRM(
      url,
      corpo === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo),
          },
    );
    const json = (await res.json().catch(() => null)) as (T & { error?: unknown }) | null;
    if (res.ok && json) return { ok: true, dati: json };
    const e = json && typeof json.error === "string" ? json.error : undefined;
    return { ok: false, stato: res.status, errore: fraseErrore(res.status, e) };
  } catch {
    return { ok: false, stato: 0, errore: FRASE_RETE };
  }
}

export const leggiManychat = () => chiama<StatoManychat>(ROTTA_MANYCHAT);

export const salvaManychat = (comando: ComandoManychat) =>
  chiama<{ config: ConfigManychat }>(ROTTA_MANYCHAT, comando);

/** Segna il giorno in cui la frase del consenso è entrata nel modulo Meta. */
export const salvaFraseModulo = (giorno: string) =>
  chiama<{ fraseModulo: FraseModulo }>(ROTTA_MANYCHAT, { fraseModulo: { giorno } });

export const provaASecco = () => chiama<ProvaASecco>(ROTTA_MANYCHAT, { azione: "prova_a_secco" });

export const provaCollegamento = () =>
  chiama<CollegamentoManychat>(ROTTA_MANYCHAT, { azione: "prova_collegamento" });

export const provaCreazioneContatto = (telefono: string) =>
  chiama<ProvaCreazione>(ROTTA_MANYCHAT, { azione: "prova_creazione_contatto", telefono });

/** Cambio a mano del secondo stato. Il nome di chi lo fa lo sa il server. */
export const cambiaContattoWa = (leadId: string, stato: StatoContattoWa) =>
  chiama<{ contattoWa: ContattoWa; avviso?: string }>(ROTTA_CONTATTO_WA, { leadId, stato });
