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
}

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
      anteprima: attesa ? i.contatto?.ultimo_in_entrata_anteprima ?? null : null,
      fonte: "colonne",
    };
  }

  // Ripiego: l'ultimo messaggio vero del cliente e l'ultima uscita (o «Fatto»).
  let ultimo: MessaggioStato | null = null;
  let tIn = -Infinity;
  let tOut = risposto ?? -Infinity;
  for (const m of i.messaggi) {
    const t = ms(m.created_at);
    if (t === null) continue;
    if (m.direction === "inbound") {
      if (!(m.body && eSoloSegnaposto(m.body)) && t > tIn) {
        tIn = t;
        ultimo = m;
      }
    } else if (t > tOut) tOut = t;
  }
  if (!ultimo || tOut >= tIn) return { attesa: false, vecchia: false, dal: null, anteprima: null, fonte: null };

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
export function schedaUnica<L extends { phone?: string | null; data?: { telefono?: string | null } | null }>(
  leads: L[],
  telefono: string,
): EsitoScheda<L> {
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
  if (!raw || typeof raw !== "object" || !Object.prototype.hasOwnProperty.call(raw, "chat")) return {};
  const v = raw.chat;
  return typeof v === "string" && UUID.test(v) ? { chat: v.toLowerCase() } : {};
}

/** Quante chat sono in attesa: il numeretto del menu (D25). */
export function contaDaRispondere(contatti: ContattoStato[], adesso: Istante): number {
  return contatti.filter((contatto) => daRispondere({ contatto, messaggi: [], adesso }).attesa).length;
}
