/** ── IL RIQUADRO «SENZA SCHEDA» IN CIMA (30/10/2026) ─────────────────────────
 *
 *  Richiesta del titolare: «quelli sono clienti, semplicemente non sono salvati nel CRM». Le chat
 *  di un numero che non ha nessuna scheda, e che hanno dei messaggi (anche vecchi), stanno in un
 *  riquadro tutto loro sopra l'elenco, per dare a tutte una scheda. Appena la chat ha una scheda
 *  non è più qui e torna fra le altre.
 *
 *  Non ci sono: i numeri con PIÙ schede (`schedaAmbigua`, serve sceglierne una, non crearne
 *  un'altra) e le chat senza nemmeno un messaggio (un contatto vuoto non è un cliente che scrive).
 *  Pura: niente React né Supabase. Provata in prove/idee/chat-ritocchi.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import { quandoUltimo, type ChatConOra } from "./ordineWhatsapp";

type ChatSenzaScheda = ChatConOra & {
  lead?: unknown;
  senzaScheda?: boolean;
  schedaAmbigua?: boolean;
};

/** Nessuna scheda, nessuna ambiguità e almeno un messaggio. `senzaScheda` assente vale «sì» come in riga. */
export function eSenzaSchedaConMessaggi(c: ChatSenzaScheda): boolean {
  return !c.lead && (c.senzaScheda ?? true) && !c.schedaAmbigua && quandoUltimo(c) > 0;
}

/** Le chat del riquadro, la più recente per prima. Non muta l'ingresso. */
export function chatSenzaScheda<T extends ChatSenzaScheda>(chats: readonly T[]): T[] {
  return chats.filter(eSenzaSchedaConMessaggi).sort((a, b) => quandoUltimo(b) - quandoUltimo(a));
}
