/** ── ATTACCARE UN'ANTEPRIMA ALLA SCHEDA DEL CLIENTE ────────────────────────
 *
 *  Vive da solo perché lo chiamano in due: la generazione (che lo fa da sola,
 *  in silenzio) e il tasto «salva sulla scheda» della pagina.
 *
 *  ── ⚠️ PERCHÉ SI FA DA SOLI E NON SI CHIEDE ──────────────────────────────
 *  Il tasto c'era, e chiedeva a una persona di fare un gesto per NOI: a lei le
 *  foto non servono sulla scheda — ce le ha nel telefono — mentre a chi la
 *  richiamerà fra un mese servono moltissimo. Un lavoro che serve a noi non si
 *  chiede al cliente: si fa.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface VoceAnteprima {
  immagine: string;
  taglio: string;
  colore: string;
  quando: string;
  codice: string;
}

/** Quante se ne tengono per persona. ⚠️ Venti: oltre, la scheda del lead
 *  diventa un album e il resto — telefono, stato, note — finisce sotto la
 *  piega. Le più vecchie escono per prime. */
export const TETTO_ANTEPRIME = 20;

export async function attaccaAlLead(leadId: string, voce: VoceAnteprima): Promise<number> {
  const db = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (a: string, b: string) => { limit: (n: number) => Promise<{ data?: { id: string; data?: Record<string, unknown> }[] }> } };
      update: (v: unknown) => { eq: (a: string, b: string) => Promise<unknown> };
    };
  };
  const r = await db.from("crm_leads").select("id, data").eq("id", leadId).limit(1);
  const lead = r.data?.[0];
  if (!lead) return 0;

  const prima = (lead.data ?? {}) as Record<string, unknown>;
  const dentro = (prima.provaCapelli as { anteprime?: unknown[] } | undefined)?.anteprime ?? [];
  const elenco = Array.isArray(dentro) ? (dentro as VoceAnteprima[]) : [];
  //  ⚠️ Niente doppioni: la stessa immagine può arrivare due volte — una dalla
  //   generazione automatica e una dal tasto — e due copie identiche sulla
  //   scheda si leggono come due prove diverse.
  if (elenco.some((x) => x.immagine === voce.immagine)) return elenco.length;

  const dopo = [voce, ...elenco].slice(0, TETTO_ANTEPRIME);
  await db.from("crm_leads").update({
    data: {
      ...prima,
      provaCapelli: { ...((prima.provaCapelli as Record<string, unknown>) ?? {}), anteprime: dopo },
    },
    updated_at: new Date().toISOString(),
  }).eq("id", lead.id);
  return dopo.length;
}
