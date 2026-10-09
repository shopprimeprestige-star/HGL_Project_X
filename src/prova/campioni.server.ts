/** ── I CAMPIONI FOTOGRAFICI DEI COLORI ─────────────────────────────────────
 *
 *  Il campione a tinta piena dice qual è il colore; una fotografia di capelli
 *  veri dice come SARÀ. Sono due cose diverse: nella tinta piatta non c'è la
 *  luce che corre sulla ciocca, e senza quella un biondo cenere e un biondo
 *  freddo sembrano lo stesso colore — mentre in mano, sull'anello, non lo sono
 *  affatto.
 *
 *  ── ⚠️ PERCHÉ NON SONO FILE NEL PROGETTO ─────────────────────────────────
 *  Perché si rifanno. Un campione che non convince si rigenera dal gestionale
 *  e cambia per tutti in un minuto; un file dentro il codice vorrebbe dire una
 *  pubblicazione per ogni ritocco di una tinta. Vivono su Storage, e qui c'è
 *  solo l'elenco di dove stanno.
 *
 *  ── ⚠️ E LA TINTA PIENA RESTA ────────────────────────────────────────────
 *  Il campione fotografico si AGGIUNGE, non sostituisce: finché una tinta non
 *  ha la sua fotografia si vede il colore pieno, e la griglia non ha buchi. È
 *  anche il motivo per cui si può cominciare da un colore solo e vedere com'è
 *  prima di generarli tutti.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CHIAVE_CAMPIONI = "prova_capelli_campioni";

/** codice dell'anello → indirizzo della fotografia */
export type Campioni = Record<string, string>;

export async function campioni(): Promise<Campioni> {
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", CHIAVE_CAMPIONI).maybeSingle();
    const v = JSON.parse((data as { value?: string } | null)?.value ?? "{}");
    return v && typeof v === "object" ? (v as Campioni) : {};
  } catch {
    return {};
  }
}

export async function salvaCampione(codice: string, url: string): Promise<Campioni> {
  const tutti = await campioni();
  const dopo = { ...tutti, [codice]: url };
  await supabaseAdmin.from("app_config").upsert(
    { key: CHIAVE_CAMPIONI, value: JSON.stringify(dopo), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
  return dopo;
}

export async function togliCampione(codice: string): Promise<Campioni> {
  const tutti = await campioni();
  delete tutti[codice];
  await supabaseAdmin.from("app_config").upsert(
    { key: CHIAVE_CAMPIONI, value: JSON.stringify(tutti), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
  return tutti;
}
