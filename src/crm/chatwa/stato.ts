/** ── LA CHAT WHATSAPP · LE REGOLE IN FUNZIONI PURE ─────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM). «Da rispondere», finestra di 24
 *  ore, stato della casella, abbinamento della scheda, validazione di `?chat=`.
 *  Tutto PURO, con `adesso` passato da fuori: niente React, niente Supabase,
 *  niente `@/integrations` (voce `chatwa/stato` di `prove/prove.mjs`). Prove in
 *  `prove/manychat/chat-stato.mjs`.
 *
 *  ⚠️ SCHELETRO DEL COMPITO 0: le firme sono quelle concordate nel PIANO, i corpi
 *   no. Il compito T3 li riempie (D5, D12, D15, D17, D18, D21) e può precisare i
 *   tipi di ingresso qui sotto, non i nomi né le uscite.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Un istante: testo ISO, millisecondi o `Date`. */
export type Istante = string | number | Date;

/** I campi della riga `whatsapp_contacts` che servono qui (le colonne nuove possono mancare). */
export interface ContattoStato {
  ultimo_in_entrata_il?: string | null;
  ultimo_in_entrata_anteprima?: string | null;
  risposto_il?: string | null;
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

/** È in «Da rispondere»? Colonne se ci sono, altrimenti i messaggi caricati (D5, D17). */
export function daRispondere(i: IngressoStato): DaRispondere {
  // shortcut: scheletro T0, mai in attesa finché T3 non scrive D5/D17, torna al T3.
  void i;
  return { attesa: false, vecchia: false, dal: null, anteprima: null, fonte: null };
}

/** Quante chat hanno `vecchia` (D5, R10): la riga «N chat senza risposta da più di 7 giorni». */
export function contaVecchie(righe: DaRispondere[]): number {
  // shortcut: scheletro T0, zero finché T3 non scrive R10, torna al T3.
  void righe;
  return 0;
}

/** Chi aspetta da più tempo sta sopra; parità stabile; non muta l'ingresso (D17). */
export function ordinaDaRispondere<T extends { dal: string | null }>(righe: T[]): T[] {
  // shortcut: scheletro T0, stesso ordine finché T3 non scrive D17, torna al T3.
  return [...righe];
}

/** «da 25 min», «da 3 h», «da 2 giorni». */
export function attesaInChiaro(dal: Istante | null, adesso: Istante): string {
  // shortcut: scheletro T0, frase fissa finché T3 non scrive la scala, torna al T3.
  void dal;
  void adesso;
  return "da meno di 1 min";
}

/** La finestra di 24 ore dall'ultimo messaggio in entrata (D15). */
export function finestra24(i: IngressoStato): Finestra24 {
  // shortcut: scheletro T0, sempre chiusa finché T3 non scrive D15, torna al T3.
  void i;
  return { aperta: false, scadeIl: null, frase: "" };
}

/** Cosa mostra la casella (D12). `null` in `canale` = canale non leggibile. */
export function statoCasella(i: {
  stop: boolean;
  finestraAperta: boolean;
  forzaModelli?: boolean;
  canale: "manychat" | "cloud" | null;
  chiaviMeta: boolean;
}): StatoCasella {
  // shortcut: scheletro T0, sempre libera finché T3 non scrive D12, torna al T3.
  void i;
  return "libera";
}

/** Collega una scheda al numero solo se ne combacia UNA (ultime 9 cifre, D18). */
export function schedaUnica<L extends { phone?: string | null }>(leads: L[], telefono: string): EsitoScheda<L> {
  // shortcut: scheletro T0, mai nessuna scheda finché T3 non scrive D18, torna al T3.
  void leads;
  void telefono;
  return { tipo: "nessuna" };
}

/** Legge `?chat=` dall'indirizzo: solo un uuid, altro = ignorato (D21). */
export function leggiRicercaChat(raw: Record<string, unknown>): { chat?: string } {
  // shortcut: scheletro T0, mai una chat finché T3 non scrive D21, torna al T3.
  void raw;
  return {};
}

/** Quante chat sono in attesa: il numeretto del menu (D25). */
export function contaDaRispondere(contatti: ContattoStato[], adesso: Istante): number {
  // shortcut: scheletro T0, zero finché T3 non scrive D25, torna al T3.
  void contatti;
  void adesso;
  return 0;
}
