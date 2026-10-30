/** ── LA CHAT WHATSAPP · TIPI E CONTRATTI DEI COMPONENTI ────────────────────
 *
 *  Commessa 2026-10-28, compito T6. Qui stanno i tipi delle righe e i contratti
 *  di props che legano `useChatWa` ai componenti: T7-T11 lavorano in parallelo
 *  su file diversi proprio perché questo file è già completo. Dopo T6 NON si
 *  modifica: se manca un campo si scrive sulla lavagna all'architetto.
 *
 *  ⚠️ Le colonne nuove di `whatsapp_contacts` non sono nei tipi generati di
 *   Supabase: chi le legge o le scrive usa il cast `as unknown as {…}`, mai un
 *   cambio a `integrations/supabase/types.ts`.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Lead, LeadStatus } from "@/crm/types";
import type { StatoCanale } from "@/crm/prova-modelli";
import type { StatoCasella } from "./stato";
import type { FiltroPerStato } from "./perStato";
import type { FiltriChat } from "./filtri";
import type { ApiPonteInvio, BollaCoda } from "@/crm/ponte/invio-tipi";

/** Il vocabolario di `passaFiltro` (cercaChat.ts). Dal 30/10/2026 non è più lo stato della chat:
 *  `FiltriChat` (filtri.ts) tiene un valore per gruppo e li compone in E. */
export type FiltroChat =
  | "all"
  | "unread"
  | "with-lead"
  | "unknown"
  | "da-chiamare"
  | "chiuso-24h"
  | "aperto-24h"
  | "attesa-whatsapp"
  | "per-ora-no"
  | "acconto"
  //  Un filtro per ogni stato del lead (30/10/2026): vedi perStato.ts.
  | FiltroPerStato;

export interface WaMessageRow {
  id: string;
  user_id: string;
  lead_id: string | null;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  body: string | null;
  status: string;
  wa_message_id: string | null;
  error_message: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  /** Ponte WhatsApp: `baileys` = riga solo da vedere. Prima della migrazione manca. */
  canale?: string | null;
  /** Ponte WhatsApp: id del messaggio del CRM di cui questa riga è doppione (nascosta). */
  duplicato_di?: string | null;
  /** p1-chat-veloce: ora dell'ultima scrittura (insert o update), dal database. Vuota sulle righe vecchie. */
  cambiato_il?: string | null;
}

export interface WaContactRow {
  id: string;
  user_id: string;
  phone_e164: string;
  lead_id: string | null;
  display_name: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  /** Colonne nuove (migrazione della commessa): prima di applicarla mancano. */
  ultimo_in_entrata_il?: string | null;
  ultimo_in_entrata_anteprima?: string | null;
  risposto_il?: string | null;
  subscriber_id?: string | null;
  /** STOP del cliente: colonna già in produzione (20261022140000_promemoria_whatsapp.sql), non nei tipi generati */
  non_scrivere_dal?: string | null;
  /** C'è da sempre (trigger), non era nei tipi: la lettura a pezzi la usa come cursore. */
  updated_at?: string;
  /** p1-chat-veloce: l'ultimo messaggio della chat (entrata o uscita), scritto da un trigger. */
  ultimo_messaggio_il?: string | null;
  ultimo_messaggio_anteprima?: string | null;
  ultimo_messaggio_direzione?: string | null;
}

export interface ChatItem {
  phone: string;
  leadId: string | null;
  lead: Lead | null;
  contact: WaContactRow | null;
  lastMessage: WaMessageRow | null;
  unread: number;
  /** I campi che seguono li riempie T7; finché non c'è, mancano. */
  daRispondere?: {
    attesa: boolean;
    dal: string | null;
    anteprima: string | null;
    /** Ripiego sui messaggi: senza risposta da più di 7 giorni (non è in elenco). */
    vecchia?: boolean;
  } | null;
  /** `scadeIl`: quando chiude la finestra aperta (ISO), per il bollino «chiude tra…» (30/10/2026). */
  finestra?: { aperta: boolean; frase: string; scadeIl?: string | null };
  senzaScheda?: boolean;
  schedaAmbigua?: boolean;
  stop?: boolean;
}

/** Ritorno di `useChatWa`: l'unica cosa che i componenti conoscono dei dati. */
export interface ChatWaApi {
  chats: ChatItem[];
  /** Le chat in «Da rispondere», già ordinate come su WhatsApp (l'ultima che si è mossa sopra). */
  daRispondere: ChatItem[];
  /** Le chat che passano ricerca e filtri a gruppi (senza le stelle: le somma `ElencoChat`). */
  visibili: ChatItem[];
  /** I filtri a gruppi (30/10/2026): chi li accende, e come si ricordano, sta in `useFiltriChat`. */
  filtri: FiltriChat;
  setFiltri: (f: FiltriChat) => void;
  ricerca: string;
  setRicerca: (q: string) => void;
  /** La chat aperta, o `null`. */
  attiva: ChatItem | null;
  /** Apre una chat (per telefono E.164 oggi; T11 la trasforma in navigazione per id). */
  apri: (chatIdOPhone: string) => void;
  /** I messaggi della chat aperta, dal più vecchio. */
  messaggi: WaMessageRow[];
  caricamento: boolean;
  /** Ora (ms) dell'ultima lettura riuscita delle chat; `null` prima della prima. */
  aggiornatoIl: number | null;
  /** Frase da mostrare se l'ultima lettura è fallita (dati vecchi in vista). */
  erroreLettura: string | null;
  aggiornando: boolean;
  /** Rinnova la sessione, riapre il tempo reale e rilegge tutto. */
  aggiorna: () => Promise<void>;
  canale: StatoCanale | null;
  stato: StatoCasella;
  bozza: string;
  setBozza: (t: string) => void;
  /** Segnaposto non sostituiti nella bozza (`{nome}`…): la casella li avvisa. */
  residuiBozza: string[];
  invia: () => Promise<void>;
  /** Se l'invio non parte mostra l'errore e LANCIA: la casella resta sull'anteprima del modello. */
  inviaModello: (m: { nome: string; lingua: string; parametri: string[] }) => Promise<void>;
  inviando: boolean;
  segnaFatto: () => Promise<void>;
  /** `phone`: il numero della chat mostrata nella finestra; se non coincide con la chat aperta non scrive. */
  abbina: (leadId: string, phone?: string) => Promise<void>;
  elimina: () => Promise<void>;
  /** Chat (per telefono) a cui il server ha detto «solo modelli». */
  forzaModelli: Record<string, boolean>;
  cambiaStato: (s: LeadStatus) => Promise<void>;
  /** Come `cambiaStato`, ma per un lead qualunque (dalla riga dell'elenco, senza aprire la chat). */
  cambiaStatoLead: (lead: Lead, s: LeadStatus) => Promise<void>;
  /** Chiavi Meta lette: `null` finché non si sa. Serve all'intestazione della pagina; T7 la sostituisce con `canale`/`stato`. */
  hasConfig: boolean | null;
  /** Invio a mano dal ponte dopo le 24 ore (commessa 2026-10-30-ponte-invio-manuale). Facoltativo: senza, la chat è quella di prima. */
  ponte?: ApiPonteInvio;
}

export interface ElencoChatProps {
  api: ChatWaApi;
  onCreaScheda: (chat: ChatItem) => void;
  onAbbina: (chat: ChatItem) => void;
}

export interface ConversazioneProps {
  api: ChatWaApi;
  onIndietro: () => void;
  onApriLead: () => void;
  onCreaScheda: (chat: ChatItem) => void;
  onAbbina: (chat: ChatItem) => void;
}

export interface CasellaProps {
  api: ChatWaApi;
  /** Il link per aprire la chat nell'app WhatsApp: a casella bloccata (solo modelli) è un tasto in barra. */
  linkWa?: string;
}

export interface BollaProps {
  /** la scheda della chat: serve a ricostruire il testo dei modelli inviati */
  lead?: Lead | null;
  messaggio: WaMessageRow;
  /** Una riga della coda del ponte (invio a mano): si disegna come bolla in uscita con il suo stato. */
  coda?: BollaCoda & { onRiprova: () => void };
}
