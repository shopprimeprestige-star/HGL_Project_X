/** ── PRENOTA LA CONSULENZA IN CHAT: I CONTRATTI ────────────────────────────
 *
 *  Commessa 2026-10-27 (PIANO.md §2.1). I nomi e le firme di questo file sono
 *  DEFINITIVI: tutti gli altri moduli `prenota-*` si appoggiano qui. Se un
 *  compito ha bisogno di cambiarlo lo scrive in lavagna a chi ha fatto il T0,
 *  che lo cambia UNA volta e avvisa gli altri.
 *
 *  Puro: nessun import dal database, nessun `fetch`. Le uniche funzioni con
 *  corpo sono la lettura e la scrittura (`rigaConAcceso`) della configurazione,
 *  le chiavi di `app_config` e l'impronta del numero; il resto sono tipi.
 *
 *  ⚠️ Nei log e nelle risposte a ManyChat solo codici (`CodiceLog`): mai
 *   numero, nome, testo del cliente, `subscriber_id` o uuid.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { BloccoDisponibilita } from "../blocchi";
import type { Consultant, ContattoWa, Lead, LeadData } from "../types";
import type { CambioContatto } from "./contatto";
import type { EsitoUtente } from "./risposta";

// ── Esiti e log ───────────────────────────────────────────────────────────

/** Cosa fa ManyChat con la risposta. ⚠️ Mai stringa vuota (D2): ManyChat, se
 *  mappa un valore vuoto, può lasciare quello di prima e rimandare un
 *  messaggio vecchio. `proposteN` = N pulsanti «Opzione» da mostrare. */
export type EsitoPrenota = "proposte3" | "proposte2" | "proposte1" | "testo" | "nessuno";

/** Lista chiusa dei codici per i log (`occupato` = lucchetto del lead preso da
 *  un altro giro). Il `codice` non va mai in risposta a ManyChat. */
export const CODICI_LOG = [
  "spenta",
  "non_autorizzato",
  "segreto_assente",
  "troppo_grande",
  "illeggibile",
  "senza_configurazione",
  "senza_scheda",
  "non_prenotabile",
  "stop",
  "non_capito",
  "proposte",
  "altri",
  "altri_finiti",
  "nessun_orario",
  "prenotato",
  "preso",
  "gia_fissato",
  "occupato",
  "vecchia",
  "limite",
  "errore",
  "tempo",
] as const;
export type CodiceLog = (typeof CODICI_LOG)[number];

export interface RispostaPrenota {
  esito: EsitoPrenota;
  testo: string;
  codice: CodiceLog;
}

// ── Configurazione (riga `prenota_chat` di app_config) ────────────────────

export interface ConfigPrenota {
  acceso: boolean;
  /** id del consulente da preferire; vuoto = chi si chiama «Filippo» */
  consulenteId: string;
  preavvisoOre: number;
  giorniAvanti: number;
  durataMin: number;
}

export const CHIAVE_CONFIG = "prenota_chat";

/** Gli altri campi della riga, validati: i numeri fuori scala o non interi
 *  tornano al predefinito (3 ore, 14 giorni, 60 minuti). */
function campiConfig(r: Record<string, unknown>): Omit<ConfigPrenota, "acceso"> {
  const n = (v: unknown, min: number, max: number, predefinito: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : predefinito;
  return {
    consulenteId: typeof r.consulenteId === "string" ? r.consulenteId.trim() : "",
    preavvisoOre: n(r.preavvisoOre, 1, 48, 3),
    giorniAvanti: n(r.giorniAvanti, 1, 30, 14),
    durataMin: n(r.durataMin, 15, 180, 60),
  };
}

function oggettoDellaRiga(testo: string | null | undefined): Record<string, unknown> | null {
  try {
    const j: unknown = JSON.parse(String(testo ?? ""));
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Legge la riga. `null` = SPENTA: senza riga, illeggibile o senza
 *  `acceso: true` esatto non si prenota mai. */
export function leggiConfigPrenota(testo: string | null | undefined): ConfigPrenota | null {
  const r = oggettoDellaRiga(testo);
  if (!r || r.acceso !== true) return null;
  return { acceso: true, ...campiConfig(r) };
}

/** La riga nuova per l'interruttore del CRM: `acceso` come chiesto, il resto
 *  (consulente, preavviso, giorni, durata, e ogni altro campo) com'è nella riga
 *  vecchia, o i predefiniti se manca o non si legge. Spegnere NON toglie la
 *  riga: scrive `acceso: false`. */
export function rigaConAcceso(vecchia: string | null | undefined, acceso: boolean): string {
  const r = oggettoDellaRiga(vecchia) ?? {};
  return JSON.stringify({ ...r, v: 1, acceso, ...campiConfig(r) });
}

// ── Fasce e orari proposti ────────────────────────────────────────────────

export type Fascia = "mattina" | "pomeriggio" | "sera";

/** Si guarda l'ORA DI INIZIO (ora di Roma), in minuti dalla mezzanotte, estremi
 *  compresi: mattina 08:00-12:59, pomeriggio 13:00-16:59, sera 17:00-23:59. */
export const FASCE: Record<Fascia, { da: number; a: number }> = {
  mattina: { da: 480, a: 779 },
  pomeriggio: { da: 780, a: 1019 },
  sera: { da: 1020, a: 1439 },
};

/** Un orario proposto: giorno `AAAA-MM-GG` e ora `HH:MM`, entrambi di Roma. */
export interface OraProposta {
  g: string;
  o: string;
}

/** La proposta ricordata per un numero (riga `prenota_chat:<impronta>`): una per
 *  numero, sovrascritta a ogni nuova proposta. Niente numero, niente nome.
 *  `fascia` è quella EFFETTIVA (dopo il ripiego), `mostrati` serve a «ALTRI». */
export interface RigaProposta {
  v: 1;
  il: string;
  fascia: Fascia;
  fasciaChiesta: Fascia;
  pagina: 1 | 2 | 3;
  proposte: OraProposta[];
  mostrati: OraProposta[];
}

/** Il tetto di 30 chiamate l'ora per numero: una riga SUA (`<chiave proposta>:n`),
 *  separata dalla proposta, così scrivere il contatore non può rimettere sopra
 *  una proposta nuova una vecchia letta un attimo prima. `ora` = `AAAA-MM-GGTHH`
 *  di Roma. */
export interface Contatore {
  ora: string;
  n: number;
}

// ── Scheda ────────────────────────────────────────────────────────────────

/** `fissatoDa` quando fissa il cliente dalla chat, SOLO se la scheda non ne ha
 *  già uno (D8). ⚠️ Non riconosce una prenotazione della chat: lo fa
 *  `prenotatoChat`. */
export const FISSATO_DA_CHAT = "cliente-chat";

/** Il marcatore sulla scheda (campo libero di `LeadData`, che non si tocca):
 *  quando e quale orario. «Preso dalla chat» = presente E `g`/`o` uguali a
 *  `dataMeeting`/`oraMeeting` attuali. */
export interface PrenotatoChat {
  il: string;
  g: string;
  o: string;
}

/** I motivi del secondo stato «Da ricontattare» (D12). */
export const MOTIVI_CONTATTO = [
  "prenota_nessun_orario",
  "prenota_altri_finiti",
  "prenota_errore",
] as const;
export type MotivoContatto = (typeof MOTIVI_CONTATTO)[number];

/** `puoPrenotare`: perché no. `futuro` = ha già un appuntamento. */
export type EsitoPrenotabile =
  | { ok: true }
  | { ok: false; motivo: "futuro" | "cliente" | "chiuso" | "stato" };

/** Quello che `daPrenotare` scrive sulla scheda. */
export interface DatiPrenotazione {
  consulenteId: string;
  giorno: string;
  ora: string;
  durata: number;
  link: string;
  adesso: Date;
  nomeConsulente: string;
}

// ── Le parole del lead ────────────────────────────────────────────────────

export type Capito =
  | { tipo: "fascia"; fascia: Fascia }
  | { tipo: "scelta"; n: 1 | 2 | 3 }
  | { tipo: "altri" }
  | { tipo: "niente" };

// ── Gli orari ─────────────────────────────────────────────────────────────

/** Quello che serve a ogni domanda sull'agenda. `schede` = le schede con un
 *  impegno nei giorni vicini (`schedeAgenda`). ⚠️ Mai `modi`: con «uno per
 *  ora» non cambiano la risposta (rev. 3). */
export interface DatiAgenda {
  schede: Lead[];
  blocchi: BloccoDisponibilita[];
  adesso: Date;
  preavvisoOre: number;
  durata: number;
}

export interface InputSlot extends DatiAgenda {
  consulente: Consultant;
  /** `AAAA-MM-GG` */
  giorno: string;
  /** il giorno di Roma di `adesso`; se manca lo ricava da `adesso` */
  oggiRoma?: string;
  /** il lead che sta prenotando: la sua scheda non occupa lo slot (verifica dopo la scrittura) */
  escludiLeadId?: string;
}

export interface InputProponi extends DatiAgenda {
  consulenti: Consultant[];
  fascia: Fascia;
  giorniAvanti: number;
  /** gli orari già mostrati (al massimo 9), da non ripetere */
  mostrati: OraProposta[];
}

export interface Proposta {
  proposte: OraProposta[];
  fasciaEffettiva: Fascia;
  /** vero se la fascia chiesta non aveva niente e si è ripiegato su un'altra */
  ripiego: boolean;
  /** nessun candidato nuovo */
  finiti: boolean;
}

export interface InputScegli extends DatiAgenda {
  consulenti: Consultant[];
  giorno: string;
  ora: string;
  /** `config.consulenteId`; vuoto = l'unico consulente che si chiama «Filippo» (D6) */
  preferito: string;
  escludiLeadId?: string;
}

/** `ancoraLibero`: la stessa domanda per UN consulente e UN'ora. */
export interface InputAncoraLibero extends InputSlot {
  ora: string;
}

// ── I testi ───────────────────────────────────────────────────────────────

export interface DatiNome {
  /** il nome grezzo della scheda: il testo prende solo il nome di battesimo, se c'è */
  nome?: string | null;
}

export interface DatiProposte extends DatiNome {
  proposte: OraProposta[];
  /** solo per `testoProposte`: la fascia chiesta e se si è ripiegato */
  fasciaChiesta?: Fascia;
  ripiego?: boolean;
}

/** Un appuntamento descritto a parole (`testoConferma`, `testoGiaFissato`). */
export interface DatiAppuntamento extends DatiNome {
  giorno: string;
  ora: string;
  /** il nome del consulente; solo il nome di battesimo finisce nel testo */
  consulente?: string | null;
  /** il link della stanza: sempre nella conferma (D13) */
  link?: string;
}

// ── La stanza e il link ───────────────────────────────────────────────────

export interface PorteStanza {
  leggi(chiave: string): Promise<string | null>;
  scrivi(chiave: string, valore: string): Promise<void>;
  elimina(chiave: string): Promise<void>;
}

export interface InputStanza {
  leadId: string;
  nome?: string;
  cognome?: string;
  consulenteId: string;
  giorno: string;
  ora: string;
  durata: number;
  adesso: Date;
}

export interface EsitoStanza {
  code: string;
  link: string;
  nuova: boolean;
  /** rimette ogni riga scritta com'era (o la toglie): per disfare e per gli errori */
  annulla(): Promise<void>;
}

// ── Le chiavi di app_config ───────────────────────────────────────────────

export const prefissoProposta = "prenota_chat:";
export const prefissoLucchetto = "prenota_chat_lock:";
export const chiaveLucchettoLead = (leadId: string) => `${prefissoLucchetto}lead:${leadId}`;
export const chiaveLucchettoConsulente = (consulenteId: string, giorno: string) =>
  `${prefissoLucchetto}${consulenteId}:${giorno}`;

/** L'impronta del numero (solo cifre) per la chiave della proposta: HMAC-SHA256
 *  col segreto di `MANYCHAT_RITORNO_TOKEN`, 16 byte in esadecimale. ⚠️ Non un
 *  SHA-256 semplice: un cellulare si inverte con una tabella di 10^9 valori.
 *  Con un segreto vuoto lancia (WebCrypto non accetta chiavi vuote): la rotta
 *  risponde 503 prima di arrivarci. */
export async function improntaNumero(telefonoCifre: string, segreto: string): Promise<string> {
  const testo = new TextEncoder();
  const chiave = await globalThis.crypto.subtle.importKey(
    "raw",
    testo.encode(segreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = new Uint8Array(
    await globalThis.crypto.subtle.sign("HMAC", chiave, testo.encode(telefonoCifre)),
  );
  let esa = "";
  for (const b of firma.slice(0, 16)) esa += b.toString(16).padStart(2, "0");
  return esa;
}

// ── La richiesta e le porte ───────────────────────────────────────────────

/** Il corpo che ManyChat manda (`leggiCorpoPrenota`, compito T7). ⚠️
 *  `subscriber_id` NON si legge (rev. 8): ManyChat può mandarlo, la rotta lo
 *  ignora. `scelta` 0 = non c'è. */
export interface CorpoPrenota {
  azione: "testo" | "scelta";
  crmLeadId: string;
  telefono: string;
  testo: string;
  scelta: number;
}

export interface RichiestaPrenota {
  chiaveOk: boolean;
  segretoPresente: boolean;
  /** il segreto (`MANYCHAT_RITORNO_TOKEN`), per l'impronta del numero */
  segreto: string;
  /** `null` = illeggibile */
  corpo: CorpoPrenota | null;
  troppoGrande?: boolean;
  adesso: Date;
}

/** ⚠️ Tutte le porte lanciano `{code}` in caso di errore; la logica registra
 *  solo il codice. ⚠️ `app_config` NON ha `user_id` e la sua RLS è
 *  «authenticated vede tutto»: per le righe `prenota_chat*`, `meet:*`,
 *  `fascia:*`, `attesi:*` la regola «sempre `user_id`» (SPEC 7.7) non si
 *  applica; le chiavi portano l'impronta HMAC del numero o l'id del lead,
 *  mai il numero. */
export interface PortePrenota {
  adesso(): Date;
  avviso(codice: string): void;
  config(): Promise<ConfigPrenota | null>;
  utente(): Promise<EsitoUtente>;
  consulenti(userId: string): Promise<Consultant[]>;
  /** schede con meeting, visita in sede, posa o manutenzione fissata fra `dal` e
   *  `al` (`AAAA-MM-GG`); oltre il tetto di pagine lancia: meglio l'errore di
   *  un'agenda finta */
  schedeAgenda(userId: string, dal: string, al: string): Promise<Lead[]>;
  blocchi(): Promise<BloccoDisponibilita[]>;
  /** le schede candidate con quel numero; il telefono deve combaciare */
  schedeDelNumero(userId: string, telefonoCifre: string, crmLeadId: string): Promise<Lead[]>;
  scheda(userId: string, leadId: string): Promise<Lead | null>;
  /** UPDATE con `.eq("updated_at", vistoIl)`; zero righe = `cambiata` */
  scriviScheda(
    userId: string,
    leadId: string,
    vistoIl: string | null,
    data: LeadData,
  ): Promise<"ok" | "cambiata">;
  proposta(chiave: string): Promise<RigaProposta | null>;
  scriviProposta(chiave: string, riga: RigaProposta): Promise<void>;
  /** il contatore delle chiamate (riga sua); `null` se manca o non si legge */
  contatore(chiave: string): Promise<Contatore | null>;
  scriviContatore(chiave: string, contatore: Contatore): Promise<void>;
  /** `di` = randomUUID; il lucchetto scade da solo dopo `scadeMs` (D3) */
  lucchetto: {
    prendi(chiave: string, di: string, scadeMs: number): Promise<boolean>;
    lascia(chiave: string, di: string): Promise<void>;
  };
  stanza: PorteStanza;
  /** il secondo stato della scheda com'è adesso; `null` se non c'è */
  statoSecondo(
    userId: string,
    leadId: string,
  ): Promise<{ contattoWa: ContattoWa | undefined } | null>;
  /** `contatto_wa_aggiorna`; vero se ha scritto */
  scriviContatto(userId: string, leadId: string, cambio: CambioContatto): Promise<boolean>;
  /** `whatsapp_contacts.non_scrivere_dal` valorizzato */
  nonScrivere(userId: string, telefonoCifre: string): Promise<boolean>;
  /** pausa fra i tentativi del lucchetto; nelle prove è istantanea */
  attesa(ms: number): Promise<void>;
}
