// Dati SINTETICI della dimensione vera (nessun dato di clienti). PRNG con seme: stessi dati a ogni giro.
import type { Lead } from "../../src/crm/types";
import type { WaContactRow, WaMessageRow } from "../../src/crm/chatwa/tipi";

export function prng(seme: number) {
  let s = seme >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const STATI = ["da_contattare","non_risponde","segreteria","richiamo","ci_ricontatta_lui","appuntamento_fissato","attesa_whatsapp","annullato","da_chiamare","per_ora_no","contattato","venduto"];
export const ADESSO = Date.now();

export function genera(o: { contatti: number; leads: number; messaggi: number; seme?: number }) {
  const r = prng(o.seme ?? 7);
  const utente = "00000000-0000-4000-8000-000000000001";
  const numeri: string[] = [];
  for (let i = 0; i < o.contatti; i++) numeri.push("+39320" + String(1000000 + Math.floor(r() * 8999999)).padStart(7, "0"));
  const leads: Lead[] = [];
  for (let i = 0; i < o.leads; i++) {
    // la maggior parte dei lead ha un numero fra i contatti, scritto in modi diversi
    const n = numeri[Math.floor(r() * numeri.length)];
    const modo = r();
    const tel = i % 3 === 0 ? n.slice(3) : i % 3 === 1 ? n : `${n.slice(0,3)} ${n.slice(3,6)} ${n.slice(6)}`;
    const stato = STATI[Math.floor(r() * STATI.length)] as never;
    leads.push({
      id: `lead-${i}`, user_id: utente, created_at: new Date(ADESSO - r() * 3e10).toISOString(), updated_at: new Date(ADESSO - r() * 1e9).toISOString(),
      data: { nome: "Nome" + i, cognome: "Cognome" + (i % 97), telefono: modo < 0.97 ? tel : "", stato,
        statoDal: new Date(ADESSO - r() * 5e9).toISOString(), consulenteId: i % 4 === 0 ? "c1" : i % 4 === 1 ? "c2" : null } as never,
    });
  }
  const contatti: WaContactRow[] = numeri.map((n, i) => {
    //  I primi 150 sono le chat «calde» (ultime 17 ore, finestra di 24 ore aperta); gli altri storico fino a ~13 mesi.
    const calda = i < 150;
    const ultimo = calda ? ADESSO - i * 7 * 60_000 : ADESSO - Math.pow(r(), 3) * 3.3e10;
    const inEntrata = calda ? i % 2 === 0 : r() < 0.5;
    return {
      id: `ct-${i}`, user_id: utente, phone_e164: n, lead_id: null, display_name: r() < 0.6 ? "Contatto " + i : null,
      last_message_at: new Date(ultimo).toISOString(), unread_count: r() < 0.05 ? 1 : 0, created_at: new Date(ultimo - 1e9).toISOString(),
      updated_at: new Date(ultimo).toISOString(),
      ultimo_in_entrata_il: inEntrata ? new Date(ultimo).toISOString() : new Date(ultimo - 3.6e6).toISOString(),
      ultimo_in_entrata_anteprima: "ciao sono interessata",
      risposto_il: inEntrata ? null : new Date(ultimo).toISOString(),
      ultimo_messaggio_il: new Date(ultimo).toISOString(), ultimo_messaggio_anteprima: "anteprima del messaggio",
      ultimo_messaggio_direzione: inEntrata ? "inbound" : "outbound",
    } as WaContactRow;
  });
  const messaggi: WaMessageRow[] = [];
  for (let i = 0; i < o.messaggi; i++) {
    const c = contatti[Math.floor(Math.pow(r(), 1.6) * contatti.length)];
    const dentro = r() < 0.5;
    const t = ADESSO - Math.pow(r(), 1.3) * 3.3e10; // ~35 messaggi/ora oggi, 14% negli ultimi 30 giorni
    messaggi.push({
      id: `m-${i}`, user_id: utente, lead_id: null, direction: dentro ? "inbound" : "outbound",
      from_number: dentro ? c.phone_e164 : "123456789", to_number: dentro ? "123456789" : c.phone_e164,
      body: "Messaggio di prova numero " + i, status: "delivered", wa_message_id: "w" + i, error_message: null,
      created_at: new Date(t).toISOString(), delivered_at: null, read_at: null, canale: r() < 0.6 ? "baileys" : "manychat", duplicato_di: null,
      cambiato_il: new Date(t).toISOString(),
    });
  }
  messaggi.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { utente, numeri, leads, contatti, messaggi };
}
