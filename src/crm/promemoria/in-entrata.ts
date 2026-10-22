/** ── LA RISPOSTA DEL CLIENTE, DAL WEBHOOK ALLA SCHEDA ───────────────────────
 *
 *  Commessa 2026-10-22. Il webhook di WhatsApp salva ogni messaggio in chat
 *  come ha sempre fatto; poi, per la conferma della consulenza, chiama questa
 *  funzione. Database e opt-out arrivano dalle `porte` (le collega il webhook).
 *
 *  ⚠️ SOLO CON LA FIRMA VERIFICATA (correzione 1 del revisore). Senza App
 *   Secret il webhook accetta qualunque POST: un falso «SÌ» farebbe saltare
 *   la telefonata a chi non ha confermato, un falso STOP zittirebbe un numero
 *   qualsiasi. Senza firma non si tocca niente.
 *  ⚠️ NON FA MAI FALLIRE IL WEBHOOK: Meta deve ricevere il suo 200. Senza la
 *   migrazione (codice pubblicato prima) scrive un avviso e basta. Nei log
 *   mai il testo del cliente.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData, PromemoriaWhatsapp } from "../types";
import { effettoRisposta, leggiRisposta, schedaDellaRisposta } from "./risposta";
import { mancaMigrazione } from "./pronto";

type ErroreDb = { code?: string | null; message?: string | null } | null;

export interface PorteRisposta {
  /** le schede di questo utente con un messaggio partito (inviato/incerto) */
  schedeConMessaggio(): Promise<{ id: string; data: Partial<LeadData> }[]>;
  aggiorna(
    id: string,
    pezzo: Partial<PromemoriaWhatsapp>,
    seChiave: string,
  ): Promise<{ error: ErroreDb }>;
  /** `whatsapp_contacts.non_scrivere_dal` per questo numero */
  segnaStop(): Promise<{ error: ErroreDb }>;
  avviso(messaggio: string): void;
}

export type EsitoRisposta =
  | "ignorato"
  | "niente"
  | "confermato"
  | "stop"
  | "risposta"
  | "senza_migrazione"
  | "errore";

export async function rispostaAlPromemoria(
  porte: PorteRisposta,
  i: { firmaVerificata: boolean; testo: string | null; numero: string; adesso: Date },
): Promise<EsitoRisposta> {
  if (!i.firmaVerificata) return "ignorato";
  const problema = (e: ErroreDb, cosa: string): EsitoRisposta => {
    if (mancaMigrazione(e)) {
      porte.avviso(`${cosa}: manca la migrazione promemoria_whatsapp, non registrato`);
      return "senza_migrazione";
    }
    porte.avviso(`${cosa}: non registrato (${e?.code ?? "?"})`);
    return "errore";
  };
  try {
    const r = leggiRisposta(i.testo);
    //  Lo STOP vale per il NUMERO, anche senza un messaggio in corso.
    if (r === "stop") {
      const { error } = await porte.segnaStop();
      if (error) problema(error, "stop");
    }
    const s = schedaDellaRisposta(await porte.schedeConMessaggio(), i.numero, i.adesso);
    const p = s?.data.promemoria;
    if (!s || !p?.chiave) return r === "stop" ? "stop" : "niente";
    const pezzo = effettoRisposta(r, i.testo, p, i.adesso.toISOString());
    if (!pezzo) return "niente";
    const { error } = await porte.aggiorna(s.id, pezzo, p.chiave);
    if (error) return problema(error, "risposta");
    return r === "si" ? "confermato" : r === "stop" ? "stop" : "risposta";
  } catch (e) {
    porte.avviso(`errore: ${e instanceof Error ? e.message.slice(0, 80) : "?"}`);
    return "errore";
  }
}
