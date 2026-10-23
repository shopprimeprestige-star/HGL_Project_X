/** ── LA PORTA UNICA DEGLI INVII WHATSAPP ───────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). SCHELETRO del compito 1: ci
 *  sono solo i tipi e le firme. Il compito U1 (Dev B) scrive i corpi, le porte
 *  vere (`porta.server.ts`) e le prove in `prove/manychat/porta.mjs`.
 *
 *  Chi manda un messaggio WhatsApp dal CRM (la conferma «risponda SÌ», la chat,
 *  il pannello lead, il webinar, il giro dei ricontatti) passa da QUI. La porta
 *  guarda il canale:
 *   - `cloud`: lo stesso corpo Graph di oggi, identico (prova a confronto);
 *   - `manychat`: prenotazione (registro + pausa per contatto + STOP), il
 *     contatto, SOLO i parametri del modello nei campi `crm_v1…crm_v4`, poi
 *     `sendFlow` col flusso mappato; un modello senza flusso → rifiuto senza
 *     nessuna chiamata; un testo libero → `sendContent`.
 *
 *  Le PORTE (database, rete, orologio, chiave) sono iniettate: il modulo non
 *  conosce `supabaseAdmin` né `process.env`.
 *
 *  ── GLI ESITI E COME LI LEGGE LA CONFERMA DEL 22/10 (PIANO §1e c) ─────────
 *   ok                → inviato
 *   riprova_fra_poco, gia_preso → riprova (segno tolto, nessun blocco)
 *   stop              → rifiuto del cliente («disiscritto»)
 *   da_collegare, rifiuto_contatto → rifiuto del cliente
 *   flusso_mancante, blocco → blocco tecnico
 *   incerto           → rete (solo rete giù, timeout e 5xx)
 *  La traduzione la fa `promemoria/pronto.ts` (`esitoInvio`), che legge
 *  `manychat?: EsitoPorta` PRIMA di `status`/`corpo`/`rete`.
 *  ───────────────────────────────────────────────────────────────────────── */

export type CanaleWhatsapp = "cloud" | "manychat";

/** Chi chiede l'invio (finisce in `manychat_invii.tipo`). */
export type TipoInvioPorta =
  | "promemoria"
  | "ricontatto"
  | "conferma"
  | "chat"
  | "webinar"
  | "prova";

/** L'esito della porta. È il campo `manychat` di `RispostaInvio`. */
export type EsitoPorta =
  | "ok"
  /** un invio allo stesso telefono negli ultimi 120 s (pausa per contatto) */
  | "riprova_fra_poco"
  /** la chiave unica dell'invio c'è già: lo ha preso un altro giro */
  | "gia_preso"
  /** il numero ha chiesto di non ricevere messaggi (`non_scrivere_dal`) */
  | "stop"
  /** il contatto ManyChat non si trova né si crea */
  | "da_collegare"
  /** il numero non è su WhatsApp */
  | "rifiuto_contatto"
  /** il modello non ha un flusso mappato in `manychat_config.flussi` */
  | "flusso_mancante"
  /** chiave rifiutata, canale scollegato, modello in pausa, limite */
  | "blocco"
  /** rete giù, timeout, 5xx: non si sa se è partito; non si rimanda */
  | "incerto";

export interface RichiestaInvio {
  canale: CanaleWhatsapp;
  /** il telefono, in qualunque formato (la porta lo porta a cifre) */
  a: string;
  /** testo libero (chat entro 24 h) */
  testo?: string;
  /** nome del modello approvato */
  modello?: string;
  lingua?: string;
  /** parametri posizionali {{1}}, {{2}}… del modello */
  parametri?: string[];
  leadId?: string | null;
  tipo: TipoInvioPorta;
  /** chiave unica dell'invio (`p|tel9|…`, `r|tel9|…`); assente per la chat a mano */
  chiave?: string;
}

export interface RisultatoPorta {
  esito: EsitoPorta;
  /** id nel registro `manychat_invii`, se c'è stata una prenotazione */
  invioId?: string;
  /** lo stato e il corpo della chiamata Graph, solo col canale `cloud` */
  status?: number;
  corpo?: unknown;
  /** un codice breve per i log: mai numero, testo o chiavi */
  codice?: string;
}

/** Le porte della porta (database, rete, orologio, chiavi). U1 le dettaglia. */
export interface PortePorta {
  adesso(): Date;
}

/** Manda un messaggio WhatsApp dal canale scelto. Non lancia: ogni guasto è un
 *  esito. */
export async function inviaWhatsapp(
  _porte: PortePorta,
  _richiesta: RichiestaInvio,
): Promise<RisultatoPorta> {
  throw new Error("manychat/porta: inviaWhatsapp non è ancora scritta (compito U1)");
}
