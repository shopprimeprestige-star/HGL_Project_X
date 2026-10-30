/** ── LA VISTA «TUTTE»: L'ORDINE DI WHATSAPP (30/10/2026) ──────────────────────
 *
 *  Richiesta del titolare: «nella disposizione delle chat ci deve essere un filtro "Tutti" che è
 *  la stessa disposizione identica, spiccicata, di WhatsApp nativo». WhatsApp ha UN elenco, senza
 *  sezioni, dalla chat con l'ultimo messaggio più recente: in entrata o in uscita, da qualunque
 *  canale. Niente «da rispondere» in cima, niente stelle, niente non letti: solo l'ora.
 *
 *  L'ora è quella che la riga mostra a destra (`ultimoDellaChat`, stato.ts): il più recente fra
 *  l'ultimo messaggio letto in pagina e quello che il trigger salva sul contatto
 *  (`ultimo_messaggio_il`), e nessuno dei due conta i doppioni del ponte (`duplicato_di`).
 *  NON si usa `last_message_at` finché c'è di meglio: il ponte lo spinge in avanti anche con un
 *  doppione nascosto, e la chat salirebbe per un messaggio che nessuno vede.
 *  Pura: niente React, niente Supabase. Provata in prove/idee/ordine-whatsapp.mjs. */

/** Il minimo che serve di una chat per sapere quando si è mossa. */
export interface ChatConOra {
  lastMessage?: { created_at: string } | null;
  contact?: {
    ultimo_messaggio_il?: string | null;
    last_message_at?: string | null;
    ultimo_in_entrata_il?: string | null;
  } | null;
}

const ms = (v: string | null | undefined): number => {
  const n = v ? Date.parse(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

/** Quando (ms) è arrivato o partito l'ultimo messaggio della chat; 0 se non si sa (va in fondo). */
export function quandoUltimo(c: ChatConOra): number {
  const vero = Math.max(ms(c.lastMessage?.created_at), ms(c.contact?.ultimo_messaggio_il));
  if (vero > 0) return vero;
  //  ⚠️ Con la migrazione dell'ultimo messaggio applicata (la colonna c'è, anche vuota) NIENTE ripiego:
  //  `last_message_at` e `ultimo_in_entrata_il` li scrive anche l'eco di ManyChat (poi nascosta come
  //  doppione), e una chat senza messaggi veri saliva all'ora di un messaggio che nessuno vede.
  //  Il ripiego resta solo se la colonna non esiste (chat vecchie, prima della migrazione).
  if (c.contact?.ultimo_messaggio_il !== undefined) return 0;
  return ms(c.contact?.last_message_at) || ms(c.contact?.ultimo_in_entrata_il);
}

/** Dal più recente al più vecchio. A pari ora resta l'ordine di prima (`sort` è stabile). Non muta. */
export function ordinaComeWhatsapp<T extends ChatConOra>(righe: readonly T[]): T[] {
  return [...righe].sort((a, b) => quandoUltimo(b) - quandoUltimo(a));
}
