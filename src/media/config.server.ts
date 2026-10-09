// ── LE QUATTRO OPERAZIONI SU app_config ─────────────────────────────────────
//  Le impostazioni del prodotto stanno tutte in app_config (chiave → valore di
//  testo). La tabella però non compare nei tipi generati di Supabase: ogni
//  rotta che la usa lo fa con `from("app_config")` e si porta dietro tre errori
//  del compilatore, spenti a mano o semplicemente tollerati.
//
//  Qui il passaggio "so io cos'è questa tabella" si fa UNA volta, con la forma
//  minima davvero usata, e le rotte nuove restano pulite. Se un giorno i tipi
//  verranno rigenerati, si cancella questo file e si torna a `supabaseAdmin`
//  diretto: nessuna delle rotte cambia forma.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Solo le colonne che tocchiamo: le altre esistono, ma non ci riguardano. */
type Riga = { key?: string | null; value?: string | null };
type Esito<T> = PromiseLike<{ data: T | null; error: unknown }>;

interface Filtrabile {
  eq(colonna: string, valore: string): { limit(n: number): Esito<Riga[]> };
  like(colonna: string, schema: string): { limit(n: number): Esito<Riga[]> };
}
interface Tabella {
  select(colonne: string): Filtrabile;
  upsert(
    riga: { key: string; value: string; updated_at: string },
    opzioni: { onConflict: string },
  ): Esito<unknown>;
  delete(): { eq(colonna: string, valore: string): Esito<unknown> };
}

const tabella = (): Tabella =>
  (supabaseAdmin as unknown as { from(t: string): Tabella }).from("app_config");

/** Il valore di una chiave, o null se non c'è.
 *  `limit(1)` e non `maybeSingle()`: quest'ultimo risponde con un errore
 *  quando le righe sono più di una, e un errore qui diventa un "link non
 *  valido" mostrato a un cliente per un dato che invece esiste. */
export async function leggiConfig(key: string): Promise<string | null> {
  const { data } = await tabella().select("value").eq("key", key).limit(1);
  return data?.[0]?.value ?? null;
}

export async function scriviConfig(key: string, value: string): Promise<void> {
  await tabella().upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

export async function cancellaConfig(key: string): Promise<void> {
  await tabella().delete().eq("key", key);
}

/** Tutte le chiavi che iniziano per `prefisso`. Il tetto è obbligatorio: senza,
 *  una tabella cresciuta negli anni si porterebbe dietro tutto a ogni lettura. */
export async function elencaConfig(
  prefisso: string,
  tetto = 200,
): Promise<{ key: string; value: string }[]> {
  const { data } = await tabella().select("key,value").like("key", `${prefisso}%`).limit(tetto);
  return (data ?? []).filter(
    (r): r is { key: string; value: string } =>
      typeof r?.key === "string" && typeof r?.value === "string",
  );
}
