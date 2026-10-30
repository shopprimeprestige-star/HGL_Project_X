/** ── LA SCRITTURA CONDIZIONATA DELLA SCHEDA (dati per la fattura) ─────────────
 *  `update … where id = ? and updated_at = <quello letto>`: se la scheda è cambiata nel frattempo
 *  non si scrive niente (è il lucchetto "ottimistico" del giro).
 *  ⚠️ IL DATABASE RISCRIVE `updated_at`: il trigger `trg_crm_leads_updated` lo porta a `now()`,
 *   qualunque valore gli si mandi. Quindi dopo l'update NON si tiene l'orologio del programma ma
 *   il valore RESTITUITO dal database (`select updated_at`): con quello sbagliato, ogni scrittura
 *   successiva sulla stessa scheda fallirebbe in silenzio.
 *  Senza dipendenze: il client è passato da fuori, così si prova con un database finto. */
import type { DatiFatturaScheda } from "./dati-fattura";

interface Costruttore {
  update(v: Record<string, unknown>): Costruttore;
  eq(c: string, v: string): Costruttore;
  select(c: string): PromiseLike<{ data: { updated_at?: string }[] | null; error: unknown }>;
}
export interface ClienteSchede {
  from(t: string): Costruttore;
}

export async function scriviSchedaCondizionata(
  client: ClienteSchede,
  s: { id: string; data: object; updatedAt: string },
  d: DatiFatturaScheda,
): Promise<boolean> {
  const nuova = { ...s.data, datiFattura: d };
  const { data, error } = await client
    .from("crm_leads")
    .update({ data: nuova, updated_at: new Date().toISOString() })
    .eq("id", s.id)
    .eq("updated_at", s.updatedAt)
    .select("updated_at");
  if (error) throw error;
  const nuovo = data?.[0]?.updated_at;
  if (!nuovo) return false; // la scheda è cambiata nel frattempo: si riprova al prossimo giro
  (s as { data: object }).data = nuova;
  s.updatedAt = nuovo;
  return true;
}
