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

export type FiltroChat = "all" | "unread" | "with-lead" | "unknown";

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
}

export interface ChatItem {
  phone: string;
  leadId: string | null;
  lead: Lead | null;
  contact: WaContactRow | null;
  lastMessage: WaMessageRow | null;
  unread: number;
  /** I campi che seguono li riempie T7; finché non c'è, mancano. */
  daRispondere?: { attesa: boolean; dal: string | null; anteprima: string | null } | null;
  finestra?: { aperta: boolean; frase: string };
  senzaScheda?: boolean;
  schedaAmbigua?: boolean;
  stop?: boolean;
}

/** Ritorno di `useChatWa`: l'unica cosa che i componenti conoscono dei dati. */
export interface ChatWaApi {
  chats: ChatItem[];
  /** Le chat in «Da rispondere», già ordinate (la più vecchia sopra). */
  daRispondere: ChatItem[];
  visibili: ChatItem[];
  filtro: FiltroChat;
  setFiltro: (f: FiltroChat) => void;
  ricerca: string;
  setRicerca: (q: string) => void;
  /** La chat aperta, o `null`. */
  attiva: ChatItem | null;
  /** Apre una chat (per telefono E.164 oggi; T11 la trasforma in navigazione per id). */
  apri: (chatIdOPhone: string) => void;
  /** I messaggi della chat aperta, dal più vecchio. */
  messaggi: WaMessageRow[];
  caricamento: boolean;
  canale: StatoCanale | null;
  stato: StatoCasella;
  bozza: string;
  setBozza: (t: string) => void;
  /** Segnaposto non sostituiti nella bozza (`{nome}`…): la casella li avvisa. */
  residuiBozza: string[];
  invia: () => Promise<void>;
  inviaModello: (m: { nome: string; lingua: string; parametri: string[] }) => Promise<void>;
  inviando: boolean;
  segnaFatto: () => Promise<void>;
  abbina: (leadId: string) => Promise<void>;
  elimina: () => Promise<void>;
  /** Chat (per telefono) a cui il server ha detto «solo modelli». */
  forzaModelli: Record<string, boolean>;
  cambiaStato: (s: LeadStatus) => Promise<void>;
  /** Chiavi Meta lette: `null` finché non si sa. Serve all'intestazione della pagina; T7 la sostituisce con `canale`/`stato`. */
  hasConfig: boolean | null;
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
}

export interface BollaProps {
  messaggio: WaMessageRow;
}
