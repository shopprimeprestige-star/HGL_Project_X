/** ── SELEZIONE DELLE CHAT E AZIONI IN BLOCCO (30/10/2026) ───────────────────
 *
 *  Richiesta del titolare: «tenendo premuto sopra le chat, la chat si preselezioni
 *  come accade su WhatsApp, e poi esca anche il seleziona tutto […] segnare come da
 *  leggere, segnare come letto, eccetera». Qui le regole, pure e provate (prove in
 *  prove/idee/selezione-chat.mjs): niente React, niente Supabase. Le scritture le
 *  fa `useChatWa` (`inBlocco`), il disegno è di `ElencoChat`/`RigaChat`/`BarraSelezione`.
 *
 *  ⚠️ «LETTO» NEL CRM = `whatsapp_contacts.unread_count`. È la STESSA scrittura che fa
 *   l'apertura della chat: `whatsapp_messages.read_at` non c'entra (lo scrive il webhook
 *   quando il CLIENTE legge un NOSTRO messaggio). Nessuna conferma di lettura parte
 *   verso il cliente: nel codice non esiste una strada per farlo.
 *  ⚠️ L'azione vale solo per le chat che l'elenco MOSTRA in quel momento (`soloVisibili`):
 *   cambiare filtro o ricerca con la selezione accesa non deve far agire su chat nascoste.
 *  ───────────────────────────────────────────────────────────────────────── */

export type AzioneBlocco = "letto" | "da-leggere" | "fatto" | "osservazione";

/** Quanto si tiene premuto (come WhatsApp) e quanto può muoversi il dito prima che sia uno scorrimento. */
export const PRESSIONE_LUNGA_MS = 450;
const SPOSTAMENTO_MAX_PX = 10;

/** Il dito (o il mouse) si è spostato abbastanza da essere uno scorrimento, non una pressione ferma? */
export function eSpostamento(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > SPOSTAMENTO_MAX_PX;
}

/** Ciò che serve sapere di una chat per decidere cosa fare. */
export interface ChatPerPiano {
  phone: string;
  /** I non letti del contatto (il badge). */
  unread: number;
  /** C'è la riga in `whatsapp_contacts`? Senza, non c'è dove scrivere. */
  haContatto: boolean;
  /** È in «Da rispondere». */
  inAttesa: boolean;
  /** Le stelle di «In osservazione» (0-3). */
  stelle: number;
}

/** Un tocco: aggiunge la chat o la toglie. Restituisce un insieme NUOVO. */
export function commuta(scelte: ReadonlySet<string>, phone: string): Set<string> {
  const nuove = new Set(scelte);
  if (!nuove.delete(phone)) nuove.add(phone);
  return nuove;
}

/** «Seleziona tutto»: le chat che si vedono. */
export function selezionaTutte(visibili: readonly { phone: string }[]): Set<string> {
  return new Set(visibili.map((c) => c.phone));
}

/** Tutte le visibili sono scelte? (Un elenco vuoto non è «tutte»: il tasto non ha niente da fare.) */
export function sonoTutte(scelte: ReadonlySet<string>, visibili: readonly { phone: string }[]) {
  return visibili.length > 0 && visibili.every((c) => scelte.has(c.phone));
}

/** Fra le scelte, solo quelle che l'elenco mostra ancora. */
export function soloVisibili<T extends { phone: string }>(
  scelte: ReadonlySet<string>,
  visibili: readonly T[],
): T[] {
  return senzaDoppioni(visibili.filter((c) => scelte.has(c.phone)));
}

/** Una chat una volta sola (lo stesso numero non deve contare due volte). */
export function senzaDoppioni<T extends { phone: string }>(chat: readonly T[]): T[] {
  const viste = new Set<string>();
  return chat.filter((c) => !viste.has(c.phone) && viste.add(c.phone));
}

export type MotivoSalto = "aperta" | "senza-contatto";

export interface Piano {
  /** Su queste si scrive. */
  fare: string[];
  /** Già come si vuole: niente da scrivere, non è un errore. */
  gia: string[];
  /** Non si possono fare, e si dice perché. */
  saltate: { phone: string; motivo: MotivoSalto }[];
}

/** Cosa fare, chat per chat. `aperta` = la chat aperta a destra: se la si rimettesse
 *  «da leggere» l'effetto di apertura la rifarebbe letta subito. */
export function pianoAzione(
  azione: AzioneBlocco,
  chat: readonly ChatPerPiano[],
  aperta: string | null,
): Piano {
  const p: Piano = { fare: [], gia: [], saltate: [] };
  for (const c of chat) {
    if (azione === "letto") {
      if (c.unread <= 0) p.gia.push(c.phone);
      else if (!c.haContatto) p.saltate.push({ phone: c.phone, motivo: "senza-contatto" });
      else p.fare.push(c.phone);
    } else if (azione === "da-leggere") {
      if (c.unread > 0) p.gia.push(c.phone);
      else if (!c.haContatto) p.saltate.push({ phone: c.phone, motivo: "senza-contatto" });
      else if (c.phone === aperta) p.saltate.push({ phone: c.phone, motivo: "aperta" });
      else p.fare.push(c.phone);
    } else if (azione === "fatto") {
      if (!c.inAttesa) p.gia.push(c.phone);
      else if (!c.haContatto) p.saltate.push({ phone: c.phone, motivo: "senza-contatto" });
      else p.fare.push(c.phone);
    } else if (c.stelle > 0) p.gia.push(c.phone);
    else p.fare.push(c.phone);
  }
  return p;
}

/** Spezza un elenco in blocchi di al massimo `n` (una query `in(...)` per blocco). */
export function aBlocchi<T>(elenco: readonly T[], n: number): T[][] {
  const dim = n >= 1 ? Math.floor(n) : elenco.length || 1;
  const fuori: T[][] = [];
  for (let i = 0; i < elenco.length; i += dim) fuori.push(elenco.slice(i, i + dim));
  return fuori;
}

export interface Conti {
  fatte: number;
  gia: number;
  saltate: number;
  fallite: number;
  /** Il motivo del primo salto (shortcut: un motivo solo nella frase; se ne servono due, elencarli). */
  motivoSaltate?: MotivoSalto;
}
export interface Esito {
  tipo: "ok" | "parziale" | "errore" | "niente";
  testo: string;
}

const chatN = (n: number) => `${n} chat`;

/** La frase del toast: sincera su quante sono riuscite, già a posto, saltate o fallite. */
export function fraseEsito(_azione: AzioneBlocco, k: Conti): Esito {
  const salto =
    k.saltate > 0
      ? ` · ${k.saltate} ${k.saltate === 1 ? "saltata" : "saltate"}: ` +
        (k.motivoSaltate === "aperta"
          ? "la chat aperta resta letta (chiudila e riprova)"
          : k.saltate === 1
            ? "non ha ancora un contatto"
            : "non hanno ancora un contatto")
      : "";
  if (k.fatte === 0 && k.fallite > 0)
    return {
      tipo: "errore",
      testo: `Non è riuscito su ${k.fallite === 1 ? "la chat" : `nessuna delle ${k.fallite} chat`}: riprova`,
    };
  if (k.fallite > 0)
    return {
      tipo: "parziale",
      testo: `Riuscito su ${chatN(k.fatte)}, non su ${k.fallite}: riprova${salto}`,
    };
  if (k.fatte === 0 && k.saltate === 0) return { tipo: "niente", testo: "Era già tutto a posto" };
  if (k.fatte === 0) return { tipo: "niente", testo: `Nessuna chat cambiata${salto}` };
  const gia = k.gia > 0 ? ` · ${k.gia} ${k.gia === 1 ? "era già a posto" : "erano già a posto"}` : "";
  return { tipo: k.saltate > 0 ? "parziale" : "ok", testo: `Fatto su ${chatN(k.fatte)}${gia}${salto}` };
}
