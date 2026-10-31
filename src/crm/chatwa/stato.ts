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
import { entrataPerFinestra, eEntrataVera } from "./entrata-vera";
import { eAnteprimaIlleggibile, eSoloSegnaposto } from "./media";

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

/** ── PONTE WHATSAPP (commessa 2026-10-29): LE RIGHE DEL PONTE SONO SOLO DA VEDERE ──
 *  Una riga `canale='baileys'` si mostra nella chat e nell'anteprima, ma non
 *  decide niente: né «Da rispondere», né la finestra di 24 ore, né «Da chiamare».
 *  Commessa 2026-10-30 (tutte le chat): vale ancora per il ripiego sui messaggi. Un'entrata
 *  VIVA del ponte che ManyChat non porta la promuove il SERVER (dopo ~2 minuti, `ponte_wa_promuovi`)
 *  scrivendo le colonne del CONTATTO (`unread_count`, `ultimo_in_entrata_*`): quelle sì le
 *  leggono `daRispondere()`, `contaDaRispondere` e «Non letti». Lo storico non le tocca mai. */
export const eRigaPonte = (m: { canale?: string | null }): boolean => m.canale === CANALE_PONTE;

export interface IngressoStato {
  contatto: ContattoStato | null;
  messaggi: MessaggioStato[];
  adesso: Istante;
  /** L'ultimo messaggio letto in pagina (con `status`): serve a non chiudere la chat con un nostro
   *  messaggio NON partito. Se manca vale quello salvato sul contatto (`ultimo_messaggio_*`). */
  ultimo?: { direction: string; created_at: string; status?: string | null } | null;
}

export interface DaRispondere {
  attesa: boolean;
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
/** Un «non leggibile» di ManyChat arrivato entro questo tempo dalla nostra risposta è l'eco di quella risposta. */
const ECO_SEGNAPOSTO = 2 * MINUTO;
/** Un'«entrata» che arriva entro questo tempo DOPO un nostro messaggio (partito), con l'ultimo messaggio
 *  del contatto ancora nostro, è l'eco di quel messaggio (vedi `daRispondere`). Viste: da 2 a 21 secondi. */
const ECO_ENTRATA = MINUTO;

const FRASE_CHIUSA = "Finestra di 24 ore chiusa: puoi mandare solo un modello approvato";

/** Millisecondi di un istante, `null` se vuoto o illeggibile. */
function ms(x: Istante | null | undefined): number | null {
  if (x === null || x === undefined || x === "") return null;
  const t = x instanceof Date ? x.getTime() : typeof x === "number" ? x : Date.parse(x);
  return Number.isFinite(t) ? t : null;
}

/** ── LA REGOLA UNICA «DA RISPONDERE» (30/10/2026) ───────────────────────────
 *  Una chat aspetta se e solo se l'ULTIMO messaggio è del cliente. Niente finestra di 24 ore,
 *  niente limite di età: una chat ferma da mesi con l'ultima parola del cliente è in attesa.
 *  Una nostra uscita dopo l'ultimo del cliente, DA QUALUNQUE CANALE (CRM, app WhatsApp nativa col
 *  ponte, inbox di ManyChat, modello automatico o giro), lo chiude, senza «Fatto» (regola del
 *  titolare, 30/10/2026: prima i messaggi automatici non lo chiudevano e la riga diceva «Tu: …»
 *  mentre la chat restava in lista). Lo dice l'ultimo messaggio salvato sul contatto
 *  (`ultimo_messaggio_*`) o letto in pagina, se è partito (`status` non `failed`). Le entrate del ponte
 *  restano solo da vedere (I3): per quelle contano le colonne d'entrata del contatto.
 *  Il contrario NON accade mai: se l'ultimo è del cliente la chat resta qui, anche dopo giorni e con
 *  la finestra di 24 ore chiusa (nessun limite di età, nessuna finestra, nessuna regola di «Da chiamare»).
 *  Colonne se ci sono, altrimenti i messaggi caricati (D5, D17). */
export function daRispondere(i: IngressoStato): DaRispondere {
  const risposto = ms(i.contatto?.risposto_il);
  const entrata = ms(i.contatto?.ultimo_in_entrata_il);
  //  ── L'ULTIMA PAROLA È NOSTRA (30/10/2026) ──────────────────────────────────
  //  `risposto_il` lo scrivono SOLO la risposta dal CRM, l'uscita viva del ponte (entro 7 giorni)
  //  e «Fatto»: un modello automatico di ManyChat, il giro, una risposta dall'inbox o dal telefono
  //  oltre i 7 giorni NON lo muovono, e la chat restava «Da rispondere» con «Tu: …» sulla riga.
  //  Il database però salva su ogni contatto l'ultimo messaggio con la sua direzione
  //  (`ultimo_messaggio_*`, trigger): è la stessa fonte dell'anteprima. Se l'ultimo è nostro,
  //  partito e successivo all'ultima entrata, il cliente non aspetta più noi.
  const letto = i.ultimo ?? null;
  const dalContatto = {
    direction: i.contatto?.ultimo_messaggio_direzione === "outbound" ? "outbound" : "inbound",
    created_at: i.contatto?.ultimo_messaggio_il as string | null | undefined,
    status: null as string | null,
  };
  //  Il più recente fra quello letto in pagina e quello del contatto; a pari ora vince il letto.
  const ultimo =
    letto && (ms(dalContatto.created_at) ?? -Infinity) <= (ms(letto.created_at) ?? -Infinity)
      ? letto
      : dalContatto;
  const chiusoDaNoi = (dopo: number): boolean => {
    if (ultimo.direction !== "outbound" || ultimo.status === "failed") return false;
    const t = ms(ultimo.created_at);
    return t !== null && t > dopo;
  };

  // Con la colonna d'entrata vale lei, senza limite di età (D17).
  if (entrata !== null) {
    //  Un «non leggibile» di ManyChat subito dopo una nostra risposta è l'eco di quella risposta
    //  (il Default Reply riparte a ogni messaggio mandato dall'app, con un testo che non sa leggere):
    //  non è il cliente che riscrive. Una sticker vera nei 2 minuti dopo la risposta non riapre
    //  la chat: costa poco, e «Da rispondere» non resta pieno di chat già risposte.
    const eco =
      risposto !== null &&
      entrata > risposto &&
      entrata - risposto <= ECO_SEGNAPOSTO &&
      eAnteprimaIlleggibile(i.contatto?.ultimo_in_entrata_anteprima);
    //  ── L'ECO DI UN MESSAGGIO NOSTRO (30/10/2026) ─────────────────────────────
    //  Ogni messaggio mandato dal telefono torna da ManyChat dopo pochi secondi come «entrata» col
    //  testo vecchio del cliente. La rotta scrive `ultimo_in_entrata_il` PRIMA che l'eco venga
    //  riconosciuta e nascosta (`duplicato_di`), e nessuno lo riporta indietro: l'«entrata» risulta
    //  DOPO il nostro messaggio e la chat restava in «Da rispondere» con «Tu: …» sulla riga.
    //  Un vero messaggio del cliente («Sera», «Ok»…), invece, diventa lui l'ultimo messaggio (trigger
    //  sul contatto, o messaggio letto in pagina): l'ultimo NON è più nostro e la regola non scatta,
    //  anche se arriva dopo 5 secondi. Quindi: ultimo nostro e partito, entrata entro 1 minuto dopo
    //  → eco, il cliente non aspetta. Più tardi di così la colonna vale ancora (nel dubbio la chat
    //  resta in attesa, mai un cliente perso).
    //  ⚠️ Il testo NON si confronta con il nostro: l'eco porta il VECCHIO testo del cliente
    //  (`{{Last Text Input}}`, vedi manychat/risposta `ecoDi`), non quello che abbiamo mandato.
    const tUltimo = ms(ultimo.created_at);
    const ecoDelNostro =
      ultimo.direction === "outbound" &&
      ultimo.status !== "failed" &&
      tUltimo !== null &&
      entrata > tUltimo &&
      entrata - tUltimo <= ECO_ENTRATA;
    const attesa =
      (risposto === null || entrata > risposto) && !eco && !ecoDelNostro && !chiusoDaNoi(entrata);
    return {
      attesa,
      dal: attesa ? (i.contatto?.ultimo_in_entrata_il as string) : null,
      anteprima: attesa ? (i.contatto?.ultimo_in_entrata_anteprima ?? null) : null,
      fonte: "colonne",
    };
  }

  // Ripiego: l'ultimo messaggio vero del cliente e l'ultima uscita (o «Fatto»). Le righe del ponte
  // in `messaggi` restano solo da vedere (I3); la nostra uscita dal telefono la dice `ultimo` (sopra).
  let ultimoIn: MessaggioStato | null = null;
  let tIn = -Infinity;
  let tOut = risposto ?? -Infinity;
  for (const m of i.messaggi) {
    const t = ms(m.created_at);
    if (t === null) continue;
    if (eRigaPonte(m)) continue;
    if (m.direction === "inbound") {
      if (!(m.body && eSoloSegnaposto(m.body)) && t > tIn) {
        tIn = t;
        ultimoIn = m;
      }
    } else if (t > tOut) tOut = t;
  }
  if (!ultimoIn || tOut >= tIn || chiusoDaNoi(tIn)) return { attesa: false, dal: null, anteprima: null, fonte: null };

  return {
    attesa: true,
    dal: ultimoIn.created_at,
    anteprima: ultimoIn.body ?? null,
    fonte: "messaggi",
  };
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
  //  ⚠️ Una reazione («[messaggio senza testo]») non riapre la finestra (30/10/2026, vedi
  //   `entrata-vera`): se l'ultima entrata era senza testo vale l'ultimo messaggio vero fra quelli
  //   caricati. shortcut: se è più vecchio dei messaggi caricati la finestra risulta chiusa (modello),
  //   mai aperta per errore; cambiarla se la chat caricasse meno di 24 ore di messaggi.
  let ultimo = ms(entrataPerFinestra(i.contatto, i.messaggi));
  if (ultimo === null && ms(i.contatto?.ultimo_in_entrata_il) === null) {
    for (const m of i.messaggi) {
      if (eRigaPonte(m) || !eEntrataVera(m.body)) continue;
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

/** Come `schedaUnica`, per MOLTI numeri: le schede si indicizzano una volta sola per ultime 9 cifre
 *  (il confronto di `schedaUnica` — numero uguale o stesse ultime 9 cifre — è proprio l'uguaglianza
 *  delle ultime 9 cifre), e ogni numero costa una ricerca, non un giro su tutte le schede.
 *  Stesso risultato di `schedaUnica` (prova: prove/idee/chat-veloce.mjs). */
export function indiceSchede<
  L extends { phone?: string | null; data?: { telefono?: string | null } | null },
>(leads: readonly L[]): (telefono: string) => EsitoScheda<L> {
  const per9 = new Map<string, L[]>();
  for (const l of leads) {
    const y = cifre(l.phone ?? l.data?.telefono);
    if (!y) continue;
    const k = y.slice(-9);
    const g = per9.get(k);
    if (g) g.push(l);
    else per9.set(k, [l]);
  }
  return (telefono) => {
    const x = cifre(telefono);
    if (x.length < 8) return { tipo: "nessuna" };
    const trovate = per9.get(x.slice(-9)) ?? [];
    if (trovate.length === 1) return { tipo: "una", lead: trovate[0] };
    return trovate.length === 0 ? { tipo: "nessuna" } : { tipo: "piu" };
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Il limite di un messaggio WhatsApp (come `LIMITE_WHATSAPP` in whatsapp.ts). */
const LIMITE_TESTO = 4096;

/** Legge `?chat=` dall'indirizzo: solo un uuid, altro = ignorato (D21).
 *  `&testo=` (30/10/2026, scelta «WhatsApp del CRM»): il messaggio da mettere
 *  nella casella; vale solo insieme a una chat valida. */
export function leggiRicercaChat(raw: Record<string, unknown>): { chat?: string; testo?: string } {
  if (!raw || typeof raw !== "object" || !Object.prototype.hasOwnProperty.call(raw, "chat"))
    return {};
  const v = raw.chat;
  if (typeof v !== "string" || !UUID.test(v)) return {};
  const t = typeof raw.testo === "string" ? raw.testo.trim().slice(0, LIMITE_TESTO) : "";
  return t ? { chat: v.toLowerCase(), testo: t } : { chat: v.toLowerCase() };
}

/** Il messaggio arrivato con l'indirizzo entra nella casella solo se è vuota:
 *  una bozza già scritta non si sovrascrive. `null` = non toccare. */
export function bozzaDaIndirizzo(bozza: string, testo?: string | null): string | null {
  if (!testo || bozza.trim()) return null;
  return testo;
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

/** Le righe che si mostrano: non sono doppioni di un messaggio del CRM (`duplicato_di` vuoto) e non
 *  sono messaggi nostri eliminati dal telefono (`eliminato_il` vuoto, revoche del ponte 31/10/2026). */
export function senzaDoppioni<
  T extends { duplicato_di?: string | null; eliminato_il?: string | null },
>(righe: T[]): T[] {
  return righe.filter((r) => !r.duplicato_di && !r.eliminato_il);
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
    data: senzaDoppioni(
      (senza.data as { duplicato_di?: string | null; eliminato_il?: string | null }[] | null) ?? [],
    ),
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
 *   · `INSERT` di un contatto del ponte «silenzioso» (30/10, tutte le chat): `origine='baileys'`, senza non
 *     letti, `ultimo_in_entrata_il`, `lead_id`, `non_scrivere_dal` né `risposto_il`. L'import dello storico
 *     ne crea centinaia, e uno sconosciuto nuovo non ha ancora niente da mostrare di diverso. Con `risposto_il`
 *     (nato da un'uscita viva dal telefono) o con un non letto è invece un evento vero.
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
  if (e.eventType === "INSERT") {
    const n = e.new;
    return (
      n.origine === CANALE_PONTE &&
      !((n.unread_count as number | null | undefined) ?? 0) &&
      !n.ultimo_in_entrata_il &&
      !n.lead_id &&
      !n.non_scrivere_dal &&
      !n.risposto_il
    );
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

/** Da dove riprendere: il più recente fra le righe, meno il margine. Di ogni riga conta UNA
 *  colonna sola: la prima di `colonne` che ha un'ora (per i messaggi `cambiato_il`, e
 *  `created_at` solo se manca). ⚠️ Il cursore deve stare sullo STESSO orologio su cui la
 *  richiesta filtra (`cambiato_il`, quello del database): `created_at` di un messaggio del
 *  ponte è l'ora scritta da WhatsApp (anche di un telefono con l'orologio avanti, fino a
 *  10 minuti nel futuro), e un cursore in avanti faceva ignorare in silenzio ogni riga
 *  nuova finché l'orologio non lo raggiungeva. `null` = nessuna riga con un'ora = si legge tutto. */
export function cursore(
  righe: readonly Record<string, unknown>[],
  colonne: readonly string[],
  margine = MARGINE_LETTURA,
): string | null {
  let max: number | null = null;
  for (const r of righe) {
    let t: number | null = null;
    for (const k of colonne) {
      t = ms(r[k] as Istante | null | undefined);
      if (t !== null) break;
    }
    if (t !== null && (max === null || t > max)) max = t;
  }
  return max === null ? null : new Date(max - margine).toISOString();
}

const tempo = (x: string | null | undefined) => ms(x) ?? 0;

/** I messaggi già in pagina più quelli appena letti: per `id` vince il nuovo, i
 *  doppioni del ponte e i messaggi eliminati dal telefono (anche marcati dopo) escono, dal più vecchio. Non muta l'ingresso. */
export function unisciMessaggi<
  T extends {
    id: string;
    created_at: string;
    duplicato_di?: string | null;
    eliminato_il?: string | null;
  },
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
