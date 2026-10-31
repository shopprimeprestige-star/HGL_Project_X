// Scena PICCOLA per guardare la riga: badge «da quanto non gli scriviamo» e icona WhatsApp a finestra chiusa.
// Uso: http://localhost:5199/?scena=riga   Dati INVENTATI (nomi e numeri finti), niente clienti.
import type { Lead } from "../../src/crm/types";
import type { WaContactRow, WaMessageRow } from "../../src/crm/chatwa/tipi";

const ADESSO = Date.now();
const UTENTE = "00000000-0000-4000-8000-000000000001";
const H = 3_600_000;
const iso = (oreFa: number) => new Date(ADESSO - oreFa * H).toISOString();

interface Caso {
  nome: string;
  cognome: string;
  tel: string;
  stato: string;
  /** euro di acconto (se manca: nessun acconto) */
  acconto?: number;
  /** ore fa dell'ultimo messaggio del cliente / nostro (assente = mai) */
  suo?: number;
  nostro?: number;
  /** nome del contatto, se diverso dalla scheda */
  display?: string | null;
  posa?: string;
}
const CASI: Caso[] = [
  { nome: "Giulia", cognome: "Verdi", tel: "+393200000001", stato: "posa_in_sede", acconto: 200, suo: 60, nostro: 240 },
  { nome: "Marco", cognome: "Bianchi", tel: "+393200000002", stato: "acconto", acconto: 150, suo: 120, nostro: 100 },
  { nome: "Sara", cognome: "Neri", tel: "+393200000003", stato: "acconto", acconto: 150, suo: 5, nostro: 3 },
  { nome: "Elena", cognome: "Gialli", tel: "+393200000004", stato: "posa_in_sede", acconto: 100, suo: 30 },
  { nome: "Charlotte", cognome: "Prova", tel: "+447700900123", stato: "acconto", acconto: 100, suo: 150, nostro: 216 },
  { nome: "Alessandra Maria", cognome: "Rossi Montefiore", tel: "+393200000006", stato: "posa_in_sede", acconto: 300, suo: 400, nostro: 410, posa: "2026-11-20" },
  { nome: "Paola", cognome: "Azzurri", tel: "+393200000007", stato: "da_contattare", suo: 50, nostro: 70 },
  { nome: "Luca", cognome: "Viola", tel: "+393200000008", stato: "acconto", acconto: 120, suo: 2, nostro: 1 },
  { nome: "Anna", cognome: "Grigi", tel: "+393200000009", stato: "acconto", acconto: 120, suo: 100, nostro: 0.4 },
];

export function scenaRiga() {
  const leads: Lead[] = [];
  const contatti: WaContactRow[] = [];
  const messaggi: WaMessageRow[] = [];
  CASI.forEach((k, i) => {
    const data: Record<string, unknown> = { nome: k.nome, cognome: k.cognome, telefono: k.tel, stato: k.stato, statoDal: iso(500) };
    if (k.acconto) data.payment = { accontoPagato: k.acconto, incassi: [{ id: `i${i}`, data: iso(300).slice(0, 10), importo: k.acconto }] };
    if (k.posa) data.installazione = { dataInstallazione: k.posa };
    leads.push({ id: `lead-${i}`, user_id: UTENTE, created_at: iso(900), updated_at: iso(1), data } as never);
    const ult = Math.min(k.suo ?? Infinity, k.nostro ?? Infinity);
    const ultimaDir = (k.suo ?? Infinity) <= (k.nostro ?? Infinity) ? "inbound" : "outbound";
    contatti.push({
      id: `ct-${i}`, user_id: UTENTE, phone_e164: k.tel, lead_id: null, display_name: `${k.nome} ${k.cognome}`,
      last_message_at: iso(ult), unread_count: 0, created_at: iso(900), updated_at: iso(ult),
      ultimo_in_entrata_il: k.suo !== undefined ? iso(k.suo) : null, ultimo_in_entrata_anteprima: "Va bene, grazie",
      risposto_il: null, ultimo_messaggio_il: iso(ult),
      ultimo_messaggio_anteprima: ultimaDir === "inbound" ? "Va bene, grazie" : "Ti aspettiamo, a presto",
      ultimo_messaggio_direzione: ultimaDir,
    } as WaContactRow);
    const m = (id: string, dentro: boolean, ore: number): WaMessageRow => ({
      id, user_id: UTENTE, lead_id: null, direction: dentro ? "inbound" : "outbound",
      from_number: dentro ? k.tel : "123456789", to_number: dentro ? "123456789" : k.tel,
      body: dentro ? "Va bene, grazie" : "Ti aspettiamo, a presto", status: "delivered", wa_message_id: id, error_message: null,
      created_at: iso(ore), delivered_at: null, read_at: null, canale: "manychat", duplicato_di: null, cambiato_il: iso(ore),
    });
    if (k.suo !== undefined) messaggi.push(m(`m-s-${i}`, true, k.suo));
    if (k.nostro !== undefined) messaggi.push(m(`m-n-${i}`, false, k.nostro));
  });
  messaggi.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { utente: UTENTE, numeri: CASI.map((k) => k.tel), leads, contatti, messaggi };
}
