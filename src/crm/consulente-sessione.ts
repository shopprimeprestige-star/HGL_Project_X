/** SESSIONE DEL CONSULENTE, LATO CLIENTE ────────────────────────────────────
 *  Tiene il token rilasciato da /api/consulente/login e lo rende disponibile
 *  alle pagine dell'area consulente.
 *
 *  Nel localStorage finisce il token, MAI il PIN: il PIN è la credenziale che
 *  l'admin consegna a voce e resta valida finché non la cambia, il token invece
 *  dura dodici ore e si può revocare. Salvare il primo al posto del secondo
 *  significherebbe lasciare la credenziale permanente scritta su un computer
 *  che spesso è condiviso.
 *
 *  entra(email, pin) · esci() · sessione() · useConsulente()
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ConsultantPermissions } from "@/crm/types";

const CHIAVE = "hg_consulente";

export interface SessioneConsulente {
  token: string;
  id: string;
  nome: string;
  permessi?: ConsultantPermissions;
}

export type EsitoAccesso =
  | { ok: true; sessione: SessioneConsulente }
  | { ok: false; motivo: string };

/** Quello che la rotta restituisce: tutto opzionale, perché il corpo arriva
 *  dalla rete e non c'è nessuna garanzia che sia quello atteso. */
interface RispostaLogin {
  ok?: boolean;
  reason?: string;
  consultantId?: string;
  nome?: string;
  token?: string;
  permessi?: ConsultantPermissions;
}

/** I motivi tecnici della rotta diventano frasi da mostrare in pagina: il
 *  consulente deve capire se ha sbagliato PIN o se l'admin gli ha chiuso
 *  l'accesso, senza vedere stringhe pensate per i log. */
const MOTIVI: Record<string, string> = {
  "PIN mancante": "Inserire il PIN.",
  "credenziali non valide": "PIN non valido.",
  "accesso non attivo": "Accesso disattivato dall'amministratore.",
  "accesso revocato": "Accesso revocato dall'amministratore.",
  "sessione scaduta": "Sessione scaduta, effettuare di nuovo l'accesso.",
};
const leggibile = (r?: string) => (r && MOTIVI[r]) || "Accesso non riuscito.";

function daArchivio(): SessioneConsulente | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHIAVE);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SessioneConsulente>;
    if (!s.token || !s.id) return null;
    return { token: s.token, id: s.id, nome: s.nome ?? "", permessi: s.permessi };
  } catch {
    return null;
  }
}

let corrente: SessioneConsulente | null = daArchivio();
const iscritti = new Set<() => void>();

function avvisa() {
  iscritti.forEach((f) => f());
}

function imposta(s: SessioneConsulente | null) {
  corrente = s;
  if (typeof window !== "undefined") {
    try {
      if (s) window.localStorage.setItem(CHIAVE, JSON.stringify(s));
      else window.localStorage.removeItem(CHIAVE);
    } catch {
      // Archiviazione negata (navigazione privata, quota piena): la sessione
      // resta comunque valida in memoria fino alla chiusura della scheda.
    }
  }
  avvisa();
}

function iscrivi(f: () => void): () => void {
  iscritti.add(f);
  // Uscire da una scheda deve valere per tutte quelle aperte: senza questo,
  // una scheda dimenticata continuerebbe a mostrare i lead di chi è appena
  // uscito, ed è il caso tipico del computer condiviso in sede.
  const daAltraScheda = (e: StorageEvent) => {
    if (e.key !== null && e.key !== CHIAVE) return;
    corrente = daArchivio();
    avvisa();
  };
  window.addEventListener("storage", daAltraScheda);
  return () => {
    iscritti.delete(f);
    window.removeEventListener("storage", daAltraScheda);
  };
}

/** La sessione salvata, senza chiedere niente al server. */
export function sessione(): SessioneConsulente | null {
  return corrente;
}

/** Accesso con PIN. `email` accetta anche il nome del consulente: la rotta
 *  confronta il valore con entrambi i campi della sua scheda. */
export async function entra(email: string, pin: string): Promise<EsitoAccesso> {
  const chi = String(email ?? "").trim();
  const codice = String(pin ?? "").trim();
  if (!codice) return { ok: false, motivo: MOTIVI["PIN mancante"] };

  let risposta: RispostaLogin | null = null;
  try {
    const r = await fetch("/api/consulente/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: chi || undefined, pin: codice }),
    });
    risposta = (await r.json()) as RispostaLogin;
  } catch {
    return { ok: false, motivo: "Connessione non riuscita, riprovare." };
  }

  if (!risposta?.ok || !risposta.token || !risposta.consultantId) {
    return { ok: false, motivo: leggibile(risposta?.reason) };
  }

  const nuova: SessioneConsulente = {
    token: risposta.token,
    id: risposta.consultantId,
    nome: risposta.nome ?? "",
    permessi: risposta.permessi,
  };
  imposta(nuova);
  // Appena rilasciato, il token è certamente valido: inutile richiederne
  // conferma al server nel momento stesso in cui la pagina si apre.
  ultimaVerifica = Date.now();
  return { ok: true, sessione: nuova };
}

export function esci(): void {
  const token = corrente?.token;
  imposta(null);
  // La riga di sessione sul server viene chiusa senza aspettare la risposta:
  // uscire dall'interfaccia non deve dipendere dalla rete. Se la chiamata non
  // arriva, il token scade comunque da solo dopo dodici ore.
  if (token) {
    void fetch(`/api/consulente/login?token=${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => {});
  }
}

const uguali = (a: SessioneConsulente | null, b: SessioneConsulente) =>
  !!a && a.id === b.id && a.nome === b.nome && JSON.stringify(a.permessi ?? null) === JSON.stringify(b.permessi ?? null);

let verificaInCorso: Promise<SessioneConsulente | null> | null = null;
let ultimaVerifica = 0;
/** Ogni componente che usa l'hook chiederebbe conferma al server appena
 *  compare: in una pagina con lista, intestazione e scheda del lead sarebbero
 *  tre chiamate identiche a ogni navigazione. Entro questa finestra vale la
 *  risposta appena ottenuta. */
const PAUSA_VERIFICA_MS = 30_000;

/** Chiede al server se il token vale ancora, e ne aggiorna nome e permessi.
 *  Serve perché la scadenza e la revoca avvengono sul server: il localStorage
 *  da solo direbbe "collegato" anche a PIN disattivato.
 *  Con `forza` la pausa viene ignorata. */
export function verifica(forza = false): Promise<SessioneConsulente | null> {
  if (!corrente) return Promise.resolve(null);
  if (verificaInCorso) return verificaInCorso;
  if (!forza && Date.now() - ultimaVerifica < PAUSA_VERIFICA_MS) return Promise.resolve(corrente);
  const token = corrente.token;
  verificaInCorso = (async () => {
    try {
      const r = await fetch(`/api/consulente/login?token=${encodeURIComponent(token)}`);
      const b = (await r.json()) as { ok?: boolean; consultantId?: string; nome?: string; permessi?: ConsultantPermissions } | null;
      if (!b?.ok || !b.consultantId) {
        imposta(null);
        return null;
      }
      const fresca: SessioneConsulente = { token, id: b.consultantId, nome: b.nome ?? "", permessi: b.permessi };
      // Si riscrive solo se qualcosa è davvero cambiato: un oggetto nuovo a
      // ogni verifica farebbe ridisegnare l'intera area consulente per niente.
      if (!uguali(corrente, fresca)) imposta(fresca);
      ultimaVerifica = Date.now();
      return corrente;
    } catch {
      // Rete assente: si tiene la sessione locale. Buttare fuori il consulente
      // per un momento di connessione mancante gli farebbe perdere il lavoro
      // aperto sulla scheda del lead.
      return corrente;
    } finally {
      verificaInCorso = null;
    }
  })();
  return verificaInCorso;
}

/** Il consulente collegato, o null. Alla prima comparsa in pagina la sessione
 *  viene rivalidata contro il server. */
export function useConsulente(): { id: string; nome: string } | null {
  const s = useSyncExternalStore(
    iscrivi,
    () => corrente,
    () => null,
  );
  useEffect(() => {
    void verifica();
  }, []);
  return useMemo(() => (s ? { id: s.id, nome: s.nome } : null), [s]);
}

/** Il lead come esce dalla rotta: `data` resta grezzo perché arriva dalla rete,
 *  mentre created_at/updated_at viaggiano a parte perché sono colonne e non
 *  campi del jsonb — le KPI ci ricadono sopra quando il lead è stato importato e
 *  non porta le sue date interne. */
export interface LeadDaRotta {
  id: string;
  data: unknown;
  created_at: string;
  updated_at: string;
}

/** L'elenco dei suoi lead, già filtrato dal server.
 *
 *  Le pagine non interrogano Supabase direttamente: con il PIN non esiste una
 *  sessione Supabase, la chiave in pagina è quella anonima e le regole di riga su
 *  crm_leads rispondono a zero righe senza segnalare nulla. Passando da
 *  /api/consulente/leads il filtro su studio e consulente lo applica il server,
 *  che è anche l'unico posto dove non può essere aggirato. */
export async function mieiLead(): Promise<{ ok: boolean; motivo?: string; leads: LeadDaRotta[] }> {
  if (!corrente) return { ok: false, motivo: MOTIVI["sessione scaduta"], leads: [] };
  try {
    const r = await fetch(`/api/consulente/leads?token=${encodeURIComponent(corrente.token)}`);
    const b = (await r.json()) as { ok?: boolean; reason?: string; leads?: LeadDaRotta[] } | null;
    if (b?.ok) return { ok: true, leads: b.leads ?? [] };
    if (b?.reason === "sessione scaduta" || b?.reason === "accesso revocato") imposta(null);
    return { ok: false, motivo: b?.reason ? (MOTIVI[b.reason] ?? b.reason) : "Caricamento non riuscito.", leads: [] };
  } catch {
    return { ok: false, motivo: "Connessione non riuscita, riprovare.", leads: [] };
  }
}

export type AzioneConsulente = "stato" | "note" | "richiamo";

export interface ValoriAzione {
  stato?: string;
  note?: string;
  notePostCall?: string;
  dataRicontatto?: string;
  oraRicontatto?: string;
}

/** Invia un'azione su un lead allegando il token corrente. Passa da qui, e non
 *  da una fetch scritta nella pagina, perché una sessione caduta deve riportare
 *  subito alla schermata di accesso invece di far fallire in silenzio i salvataggi. */
export async function azioneLead(
  leadId: string,
  azione: AzioneConsulente,
  valori?: ValoriAzione,
): Promise<{ ok: boolean; motivo?: string; lead?: { id: string; data: unknown } }> {
  if (!corrente) return { ok: false, motivo: MOTIVI["sessione scaduta"] };
  try {
    const r = await fetch("/api/consulente/azione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: corrente.token, leadId, azione, valori: valori ?? {} }),
    });
    const b = (await r.json()) as { ok?: boolean; reason?: string; lead?: { id: string; data: unknown } } | null;
    if (b?.ok) return { ok: true, lead: b.lead };
    if (b?.reason === "sessione scaduta" || b?.reason === "accesso revocato") imposta(null);
    return { ok: false, motivo: b?.reason ? (MOTIVI[b.reason] ?? b.reason) : "Salvataggio non riuscito." };
  } catch {
    return { ok: false, motivo: "Connessione non riuscita, riprovare." };
  }
}
