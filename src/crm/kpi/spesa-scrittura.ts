// ── SCRIVERE LA SPESA ───────────────────────────────────────────────────────
//  Le tre scritture del registro (registra, correggi, elimina) passano da
//  Supabase DIRETTAMENTE e non da `CRMContext`, e non è una scorciatoia.
//
//  ⚠️ `createAdSpending` e `deleteAdSpending` di CRMContext scrivono l'errore in
//  console e tornano senza dire niente a chi le ha chiamate: la pagina
//  annunciava «Registrati € 120,00» anche con la sessione scaduta, e la spesa di
//  quella sera spariva senza che nessuno se ne accorgesse — per ritrovarsela
//  settimane dopo sotto forma di un ritorno sulla spesa troppo bello. La
//  modifica, poi, CRMContext non la espone affatto.
//  Finché quei due metodi non restituiscono l'errore (è una richiesta verso chi
//  possiede CRMContext.tsx) si scrive da qui, per l'unico motivo di poter dire
//  «non è stata salvata».
//
//  Qui non c'è nessun toast e nessuno stato: questo file sa scrivere una riga e
//  dire se ci è riuscito. Cosa mostrare lo decide chi disegna.

import { supabase } from "@/integrations/supabase/client";
import type { AdSpending } from "@/crm/types";

export interface EsitoScrittura {
  ok: boolean;
  /** Il messaggio da mostrare quando `ok` è falso. Mai vuoto in quel caso: un
   *  errore senza motivo fa premere il pulsante una seconda volta. */
  errore?: string;
}

/** Registra una nuova spesa. Torna `ok: true` solo a riga scritta davvero: è
 *  quello che dice al modulo se può svuotare i campi. */
export async function registraSpesa(
  userId: string,
  dati: AdSpending["data"],
): Promise<EsitoScrittura> {
  const { error } = await supabase
    .from("crm_ad_spending")
    .insert({ user_id: userId, data: dati as never });
  return error ? { ok: false, errore: error.message } : { ok: true };
}

/** Correggere un importo sbagliato non può costare «cancella e riscrivi»: si
 *  aggiorna la riga, così la registrazione mantiene la sua identità. */
export async function correggiSpesa(id: string, dati: AdSpending["data"]): Promise<EsitoScrittura> {
  const { error } = await supabase
    .from("crm_ad_spending")
    .update({ data: dati as never })
    .eq("id", id);
  return error ? { ok: false, errore: error.message } : { ok: true };
}

export async function eliminaSpesa(id: string): Promise<EsitoScrittura> {
  const { error } = await supabase.from("crm_ad_spending").delete().eq("id", id);
  return error ? { ok: false, errore: error.message } : { ok: true };
}

/** Legge un importo scritto da tastiera. Si accetta la virgola perché è quello
 *  che si digita su un tastierino italiano: pretendere il punto significa una
 *  spesa sbagliata di cento volte, prima o poi. */
export function leggiImporto(testo: string): number {
  const n = Number(String(testo).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
