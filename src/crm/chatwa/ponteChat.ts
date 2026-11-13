/** ── «HA UN MESSAGGIO DEL PONTE?»: LA REGOLA CONDIVISA ─────────────────────
 *  Commessa 2026-11-13 (sezione «WhatsApp Baileys» e terza scelta sul lead).
 *  Una chat ha un messaggio del ponte quando il suo contatto ha
 *  `ha_messaggio_ponte = true` (la colonna di `whatsapp_contacts`, scritta
 *  dalle funzioni SQL che scrivono `canale='baileys'`: vedi la migrazione
 *  `20261113120000_ponte_chat_flag.sql`).
 *  Funzione condivisa fra l'elenco «WhatsApp Baileys» (`ElencoChatBaileys.tsx`)
 *  e la terza opzione sul lead (`scelta-whatsapp.ts`): un'unica regola, per
 *  non avere due risposte che si disallineano (SPEC).
 *  ───────────────────────────────────────────────────────────────────────── */

export interface ContattoConPonte {
  ha_messaggio_ponte?: boolean | null;
}

export function haMessaggioPonte(c: ContattoConPonte | null | undefined): boolean {
  return c?.ha_messaggio_ponte === true;
}
