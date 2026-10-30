/** ── LA CHAT WHATSAPP · LE REGOLE IN FUNZIONI PURE ─────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM). «Da rispondere», finestra di 24
 *  ore, stato della casella, abbinamento della scheda, validazione di `?chat=`.
 *  Tutto PURO, con `adesso` passato da fuori: niente React, niente Supabase,
 *  niente `@/integrations` (voce `chatwa/stato` di `prove/prove.mjs`). Prove in
 *  `prove/manychat/chat-stato.mjs`.
 *
 *  Compito T3: i corpi di D5/R10, D12, D15/R9, D17, D18, D21, D25. Le firme e le
 *  uscite sono quelle concordate nel PIANO; i tipi di ingresso sono precisati
 *  (campi in più, tutti facoltativi) senza togliere niente a quelli del T0.
 *  ───────────────────────────────────────────────────────────────────────── */
import { CANALE_PONTE } from "../ponte/tipi";
import { eSoloSegnaposto } from "./media";

/** Un istante: testo ISO, millisecondi o `Date`. */
export type Istante = string | number | Date;

/** I campi della riga `whatsapp_contacts` che servono qui (le colonne nuove possono mancare). */
export interface ContattoStato {
  ultimo_in_entrata_il?: string | null;
  ultimo_in_entrata_anteprima?: string | null;
  risposto_il?: string | null;
  /** Gli altri campi della riga (stop, nome, …) passano senza disturbare. */
  [altro: string]: unknown;
}

/** Un messaggio già caricato in pagina (per il ripiego a colonne vuote). */
export interface MessaggioStato {
  direction: string;
  body: string | null;
  created_at: string;
  /** `baileys` = riga del ponte WhatsApp: solo da vedere, nessuna regola la legge (I3). */
  canale?: string | null;
}

/** ── PONTE WHATSAPP (commessa 2026-10-29): LE RIGHE DELLO STORICO SONO SOLO DA VEDERE ──
 *  Una riga `canale='baileys'` si mostra nella chat e nell'anteprima, ma non
 *  decide niente: né «Da rispondere», né la finestra di 24 ore, né «Da chiamare». */
export const eRigaPonte = (m: { canale?: string | null }): boolean => m.canale === CANALE_PONTE;

export interface IngressoStato {
  contatto: ContattoStato | null;
  messaggi: MessaggioStato[];
  adesso: Istante;
}

export interface DaRispondere {
  attesa: boolean;
  /** Ripiego sui messaggi: ultimo del cliente senza risposta ma oltre 7 giorni (D5, R10). */
  vecchia: boolean;
  dal: string | null;
  anteprima: string | null;
  fonte: "colonne" | "messaggi" | null;
}

export interface Finestra24 {
  aperta: boolean;
  scadeIl: string | null;
  frase: string;
}

export type StatoCasella = "libera" | "solo_modelli" | "stop" | "configura";

export type EsitoScheda<L> = { tipo: "una"; lead: L } | { tipo: "nessuna" } | { tipo: "piu" };

const ORA = 3_600_000;
const MINUTO = 60_000;
const GIORNO = 24 * ORA;
/** Oltre questa età il ripiego sui messaggi non mette più la chat in attesa (D5). */
const SETTE_GIORNI = 7 * GIORNO;

const FRASE_CHIUSA = "Finestra di 24 ore chiusa: puoi mandare solo un modello approvato";

/** Millisecondi di un istante, `null` se vuoto o illeggibile. */
function ms(x: Istante | null | undefined): number | null {
  if (x === null || x === undefined || x === "") return null;
  const t = x instanceof Date ? x.getTime() : typeof x === "number" ? x : Date.parse(x);
  return Number.isFinite(t) ? t : null;
}

/** È in «Da rispondere»? Colonne se ci sono, altrimenti i messaggi caricati (D5, D17). */
export function daRispondere(i: IngressoStato): DaRispondere {
  const adesso = ms(i.adesso);
  const risposto = ms(i.contatto?.risposto_il);
  const entrata = ms(i.contatto?.ultimo_in_entrata_il);

  // Con la colonna d'entrata vale lei, e l'attesa non ha limite di età (D17).
  if (entrata !== null) {
    const attesa = risposto === null || entrata > risposto;
    return {
      attesa,
      vecchia: false,
      dal: attesa ? (i.contatto?.ultimo_in_entrata_il as string) : null,
      anteprima: attesa ? (i.contatto?.ultimo_in_entrata_anteprima ?? null) : null,
      fonte: "colonne",
    };
  }

  // Ripiego: l'ultimo messaggio vero del cliente e l'ultima uscita (o «Fatto»).
  let ultimo: MessaggioStato | null = null;
  let tIn = -Infinity;
  let tOut = risposto ?? -Infinity;
  for (const m of i.messaggi) {
    if (eRigaPonte(m)) continue;
    const t = ms(m.created_at);
    if (t === null) continue;
    if (m.direction === "inbound") {
      if (!(m.body && eSoloSegnaposto(m.body)) && t > tIn) {
        tIn = t;
        ultimo = m;
      }
    } else if (t > tOut) tOut = t;
  }
  if (!ultimo || tOut >= tIn)
    return { attesa: false, vecchia: false, dal: null, anteprima: null, fonte: null };

  const oltre = adesso !== null && adesso - tIn > SETTE_GIORNI;
  return {
    attesa: !oltre,
    vecchia: oltre,
    dal: ultimo.created_at,
    anteprima: ultimo.body ?? null,
    fonte: "messaggi",
  };
}

/** Quante chat hanno `vecchia` (D5, R10): la riga «N chat senza risposta da più di 7 giorni». */
export function contaVecchie(righe: DaRispondere[]): number {
  return righe.filter((r) => r.vecchia).length;
}

/** Chi aspetta da più tempo sta sopra; parità stabile; non muta l'ingresso (D17). */
export function ordinaDaRispondere<T extends { dal: string | null }>(righe: T[]): T[] {
  // Senza data (o illeggibile) in fondo; `sort` è stabile, la parità resta com'è.
  const chiave = (r: T) => ms(r.dal) ?? Infinity;
  return [...righe].sort((a, b) => {
    const x = chiave(a);
    const y = chiave(b);
    return x === y ? 0 : x < y ? -1 : 1;
  });
}

/** «da 25 min», «da 3 h», «da 2 giorni». */
export function attesaInChiaro(dal: Istante | null, adesso: Istante): string {
  const a = ms(dal);
  const b = ms(adesso);
  const passato = a === null || b === null ? 0 : b - a;
  if (passato < MINUTO) return "da meno di 1 min"; // anche orologio sfasato (data nel futuro)
  if (passato < ORA) return `da ${Math.floor(passato / MINUTO)} min`;
  if (passato < GIORNO) return `da ${Math.floor(passato / ORA)} h`;
  const giorni = Math.floor(passato / GIORNO);
  return giorni === 1 ? "da 1 giorno" : `da ${giorni} giorni`;
}

/** La finestra di 24 ore dall'ultimo messaggio in entrata (D15). */
export function finestra24(i: IngressoStato): Finestra24 {
  // La colonna se c'è; altrimenti il più recente inbound caricato (anche un segnaposto: il cliente ha scritto).
  let ultimo = ms(i.contatto?.ultimo_in_entrata_il);
  if (ultimo === null) {
    for (const m of i.messaggi) {
      if (eRigaPonte(m)) continue;
      const t = ms(m.created_at);
      if (m.direction === "inbound" && t !== null && (ultimo === null || t > ultimo)) ultimo = t;
    }
  }
  const adesso = ms(i.adesso);
  const resta = ultimo === null || adesso === null ? 0 : ultimo + GIORNO - adesso;
  if (resta <= 0) return { aperta: false, scadeIl: null, frase: FRASE_CHIUSA };

  // Orologio sfasato (entrata nel futuro): mai promettere più di 24 ore.
  const r = Math.min(resta, GIORNO);
  const ore = Math.floor(r / ORA);
  const quanto =
    ore >= 2
      ? `${ore} ore`
      : ore === 1
        ? "1 ora"
        : `${Math.max(1, Math.floor(r / MINUTO))} ${r < 2 * MINUTO ? "minuto" : "minuti"}`;
  return {
    aperta: true,
    scadeIl: new Date((ultimo as number) + GIORNO).toISOString(),
    frase: `Puoi scrivere libero ancora per ${quanto}`,
  };
}

/** Cosa mostra la casella (D12). `null` in `canale` = canale non leggibile. */
export function statoCasella(i: {
  stop: boolean;
  finestraAperta: boolean;
  forzaModelli?: boolean;
  canale: "manychat" | "cloud" | null;
  chiaviMeta: boolean;
}): StatoCasella {
  if (i.stop) return "stop";
  // Blocca SOLO se il canale è letto, è `cloud` e mancano le chiavi: con ManyChat o canale non leggibile decide il server.
  if (i.canale === "cloud" && !i.chiaviMeta) return "configura";
  if (!i.finestraAperta || i.forzaModelli) return "solo_modelli";
  return "libera";
}

/** Solo le cifre di un numero. */
function cifre(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Collega una scheda al numero solo se ne combacia UNA (ultime 9 cifre, D18). */
export function schedaUnica<
  L extends { phone?: string | null; data?: { telefono?: string | null } | null },
>(leads: L[], telefono: string): EsitoScheda<L> {
  const x = cifre(telefono);
  // Sotto 8 cifre non si confronta: un numero corto combacerebbe con troppe schede.
  // (Non serve il controllo gemello sulla scheda: una più corta di `x` non può combaciare.)
  if (x.length < 8) return { tipo: "nessuna" };
  const trovate = leads.filter((l) => {
    const y = cifre(l.phone ?? l.data?.telefono);
    return y === x || y.slice(-9) === x.slice(-9);
  });
  if (trovate.length === 1) return { tipo: "una", lead: trovate[0] };
  return trovate.length === 0 ? { tipo: "nessuna" } : { tipo: "piu" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Legge `?chat=` dall'indirizzo: solo un uuid, altro = ignorato (D21). */
export function leggiRicercaChat(raw: Record<string, unknown>): { chat?: string } {
  if (!raw || typeof raw !== "object" || !Object.prototype.hasOwnProperty.call(raw, "chat"))
    return {};
  const v = raw.chat;
  return typeof v === "string" && UUID.test(v) ? { chat: v.toLowerCase() } : {};
}

/** Quante chat sono in attesa: il numeretto del menu (D25). */
export function contaDaRispondere(contatti: ContattoStato[], adesso: Istante): number {
  return contatti.filter((contatto) => daRispondere({ contatto, messaggi: [], adesso }).attesa)
    .length;
}

/* ── LA LETTURA DAL DATABASE (commessa ponte WhatsApp, T7) ───────────────────
 *  Funzioni pure: la richiesta vera (Supabase) la passa `useChatWa` come
 *  funzione, così si provano senza rete con un database finto. */

/** Il risultato di una chiamata al database, come lo dà Supabase. */
export interface EsitoDb {
  data: unknown;
  error: { code?: string; message: string } | null;
}

/** Colonna non ancora creata (migrazione non applicata). */
export const colonnaMancante = (e: EsitoDb["error"]): boolean =>
  ["42703", "PGRST204"].includes(String(e?.code ?? ""));

/** Righe per pagina: il tetto di una richiesta di Supabase. */
export const PAGINA_CONTATTI = 1000;
/** shortcut: al massimo 5000 contatti, oltre si ferma e lo dice in pagina; quando succede, leggere i soli contatti con attività recente o passare a un conteggio sul server. */
export const MAX_PAGINE_CONTATTI = 5;

/** Tutti i contatti, a pagine di 1000 (la richiesta sola ne darebbe 1000 in silenzio).
 *  `troncato`: la quinta pagina era piena, potrebbero essercene altri. */
export async function leggiContattiAPagine(
  leggi: (da: number, a: number) => PromiseLike<EsitoDb>,
): Promise<EsitoDb & { troncato: boolean }> {
  const righe: { id?: string }[] = [];
  const visti = new Set<string>();
  for (let p = 0; p < MAX_PAGINE_CONTATTI; p++) {
    const r = await leggi(p * PAGINA_CONTATTI, (p + 1) * PAGINA_CONTATTI - 1);
    if (r.error) return { data: null, error: r.error, troncato: false };
    const pagina = (r.data as { id?: string }[] | null) ?? [];
    // Se fra una pagina e l'altra un contatto nuovo sposta le righe, la stessa non si conta due volte.
    for (const x of pagina) {
      if (x.id && visti.has(x.id)) continue;
      if (x.id) visti.add(x.id);
      righe.push(x);
    }
    if (pagina.length < PAGINA_CONTATTI) return { data: righe, error: null, troncato: false };
  }
  return { data: righe, error: null, troncato: true };
}

/** Le righe che non sono doppioni di un messaggio del CRM (`duplicato_di` vuoto). */
export function senzaDoppioni<T extends { duplicato_di?: string | null }>(righe: T[]): T[] {
  return righe.filter((r) => !r.duplicato_di);
}

/** Legge i messaggi senza i doppioni del ponte. `leggi(true)` chiede al database
 *  `duplicato_di` vuoto, così i doppioni non occupano posti del limite; se la
 *  colonna non c'è ancora (migrazione non applicata) `leggi(false)` rilegge senza
 *  filtro e i doppioni, se ci fossero, si scartano qui. */
export async function leggiSenzaDoppioni(
  leggi: (filtra: boolean) => PromiseLike<EsitoDb>,
): Promise<EsitoDb> {
  const r = await leggi(true);
  if (!r.error || !colonnaMancante(r.error)) return r;
  const senza = await leggi(false);
  if (senza.error) return senza;
  return {
    data: senzaDoppioni((senza.data as { duplicato_di?: string | null }[] | null) ?? []),
    error: null,
  };
}

/** Un evento di `postgres_changes`, nella parte che serve. */
export interface EventoDb {
  eventType?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
}

/** Oltre questa età, una riga del ponte appena scritta è storico, non un messaggio vivo. */
const ETA_STORICO = 10 * MINUTO;
/** Le colonne dei contatti che il ponte aggiorna durante lo storico, senza cambiare altro. */
const COLONNE_DEL_PONTE = [
  "last_message_at",
  "display_name",
  "updated_at",
  //  p1-chat-veloce: l'ultimo messaggio sul contatto lo muove un trigger, anche per lo storico.
  "ultimo_messaggio_il",
  "ultimo_messaggio_anteprima",
  "ultimo_messaggio_direzione",
];

/** La chat NON si rilegge per questo evento (carico dello storico, obiezione 11):
 *   · `INSERT` di un messaggio del ponte con `created_at` più vecchio di 10 minuti;
 *   · `UPDATE` di un contatto in cui cambiano solo `last_message_at`, `display_name`, `updated_at`
 *     e l'ultimo messaggio salvato sul contatto (`ultimo_messaggio_*`).
 *  Ogni altra cosa (messaggio vivo, ManyChat, `unread_count`, `risposto_il`…) rilegge.
 *  Evento illeggibile = si rilegge. Il controllo ogni 15 s resta la rete di sicurezza
 *  (guarda `updated_at` del contatto: anche un messaggio vivo arrivato in ritardo lo muove). */
export function eventoDaIgnorare(
  tabella: "whatsapp_messages" | "whatsapp_contacts",
  e: EventoDb | null | undefined,
  adesso: Istante,
): boolean {
  if (!e || !e.new) return false;
  if (tabella === "whatsapp_messages") {
    if (e.eventType !== "INSERT" || e.new.canale !== CANALE_PONTE) return false;
    const t = ms(e.new.created_at as string | null);
    const ora = ms(adesso);
    return t !== null && ora !== null && ora - t > ETA_STORICO;
  }
  if (e.eventType !== "UPDATE" || !e.old || Object.keys(e.old).length === 0) return false;
  const nuovo = e.new;
  const vecchio = e.old;
  const chiavi = new Set([...Object.keys(nuovo), ...Object.keys(vecchio)]);
  for (const k of chiavi) {
    if (COLONNE_DEL_PONTE.includes(k)) continue;
    if (JSON.stringify(nuovo[k] ?? null) !== JSON.stringify(vecchio[k] ?? null)) return false;
  }
  return true;
}

/* ── LE LETTURE A PEZZI (commessa 2026-10-30, p1-chat-veloce) ────────────────
 *  La chat rileggeva 2000 messaggi e tutti i contatti a ogni evento. Ora dopo la
 *  prima lettura si chiedono solo le righe scritte da poco: i contatti per
 *  `updated_at`, i messaggi per `cambiato_il` (lo scrive il database a ogni
 *  insert o update; sulle righe di prima della migrazione è vuoto e vale
 *  `created_at`). Il cursore è l'ora più recente già vista, presa dalle righe
 *  stesse (orologio del database, non del telefono), meno un margine: una riga
 *  scritta da una transazione lenta porta l'ora d'inizio, non quella di commit.
 *  Rileggere due volte la stessa riga non fa danni: si unisce per `id`. */

/** Il margine all'indietro di ogni lettura a pezzi. */
export const MARGINE_LETTURA = 2 * MINUTO;

/** Da dove riprendere: il più recente fra le colonne date di tutte le righe, meno
 *  il margine. `null` = nessuna riga con un'ora = si legge tutto. */
export function cursore(
  righe: readonly Record<string, unknown>[],
  colonne: readonly string[],
  margine = MARGINE_LETTURA,
): string | null {
  let max: number | null = null;
  for (const r of righe)
    for (const k of colonne) {
      const t = ms(r[k] as Istante | null | undefined);
      if (t !== null && (max === null || t > max)) max = t;
    }
  return max === null ? null : new Date(max - margine).toISOString();
}

const tempo = (x: string | null | undefined) => ms(x) ?? 0;

/** I messaggi già in pagina più quelli appena letti: per `id` vince il nuovo, i
 *  doppioni del ponte (anche marcati dopo) escono, dal più vecchio. Non muta l'ingresso. */
export function unisciMessaggi<
  T extends { id: string; created_at: string; duplicato_di?: string | null },
>(prima: T[], nuove: readonly T[]): T[] {
  if (nuove.length === 0) return prima;
  const perId = new Map(prima.map((r) => [r.id, r]));
  for (const r of nuove) perId.set(r.id, r);
  return senzaDoppioni([...perId.values()]).sort(
    (a, b) => tempo(a.created_at) - tempo(b.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** I contatti già in pagina più quelli appena letti: per `id` vince il nuovo, i nuovi in fondo. */
export function unisciContatti<T extends { id: string }>(prima: T[], nuove: readonly T[]): T[] {
  if (nuove.length === 0) return prima;
  const perId = new Map(prima.map((r) => [r.id, r]));
  for (const r of nuove) perId.set(r.id, r);
  return [...perId.values()];
}

/** Una riga cancellata (evento DELETE): la lettura a pezzi non la vedrebbe mai. */
export function togliPerId<T extends { id: string }>(righe: T[], id: string): T[] {
  return righe.some((r) => r.id === id) ? righe.filter((r) => r.id !== id) : righe;
}

/** L'ultimo messaggio di una chat, per l'anteprima dell'elenco: il più recente fra
 *  quello letto in pagina e quello salvato sul contatto (entrata o uscita). A pari
 *  ora vince quello letto. Senza le colonne (migrazione non applicata) resta il letto. */
export function ultimoDellaChat<
  M extends { direction: string; body: string | null; created_at: string },
>(
  letto: M | null,
  contatto: {
    ultimo_messaggio_il?: string | null;
    ultimo_messaggio_anteprima?: string | null;
    ultimo_messaggio_direzione?: string | null;
  } | null,
): M | { direction: string; body: string | null; created_at: string; status?: undefined } | null {
  const il = contatto?.ultimo_messaggio_il ?? null;
  const t = ms(il);
  if (t === null || (letto && (ms(letto.created_at) ?? -Infinity) >= t)) return letto;
  return {
    direction: contatto?.ultimo_messaggio_direzione === "outbound" ? "outbound" : "inbound",
    body: contatto?.ultimo_messaggio_anteprima ?? null,
    created_at: il as string,
  };
}
