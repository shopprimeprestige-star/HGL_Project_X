/** ── IL PAGAMENTO, CON SUMUP ───────────────────────────────────────────────
 *
 *  Tre pacchetti di prove, pagati con carta sulla pagina di SumUp. Qui dentro
 *  c'è la chiave, la creazione del pagamento e la verifica.
 *
 *  ── ⚠️ LE PROVE SI ACCREDITANO SOLO DOPO AVER CHIESTO A SUMUP ────────────
 *  Non quando il cliente torna sul sito: chiunque può aprire l'indirizzo di
 *  ritorno e prendersi cinquanta prove. Si accredita quando SumUp, interrogata
 *  da noi, dice che quel pagamento è PAID — e nient'altro conta.
 *
 *  ── ⚠️ E SI ACCREDITA UNA VOLTA SOLA ─────────────────────────────────────
 *  La pagina di ritorno la si ricarica, si torna indietro col tasto del
 *  browser, si riapre il link dalla cronologia. Ogni volta il controllo
 *  ripasserebbe di qui: se accreditasse ogni volta, un pagamento da 5,90
 *  regalerebbe prove all'infinito. L'ordine passa a «pagato» e da lì non si
 *  muove più — è quella riga a fare da lucchetto.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CHIAVE_CONFIG = "sumup_config";

export interface ConfigSumUp {
  /** la chiave segreta di SumUp, `sup_sk_...` */
  apiKey: string;
  /** il codice esercente, si legge nel profilo SumUp */
  merchantCode: string;
  pronto: boolean;
}

export async function leggiConfigSumUp(): Promise<ConfigSumUp> {
  let s: Partial<ConfigSumUp> = {};
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", CHIAVE_CONFIG).maybeSingle();
    s = JSON.parse((data as { value?: string } | null)?.value ?? "{}") || {};
  } catch { /* nessuna configurazione */ }
  const apiKey = String(s.apiKey || "").trim() || String(process.env.SUMUP_API_KEY || "").trim();
  const merchantCode = String(s.merchantCode || "").trim() || String(process.env.SUMUP_MERCHANT_CODE || "").trim();
  //  ⚠️ «Pronto» vuol dire tutte e due: con la chiave ma senza esercente SumUp
  //   risponde 403 e il cliente vede una pagina bianca dopo aver deciso di
  //   pagare — il momento peggiore in cui rompersi.
  return { apiKey, merchantCode, pronto: !!apiKey && !!merchantCode };
}

export async function salvaConfigSumUp(dati: { apiKey?: string; merchantCode?: string }): Promise<void> {
  const prima = await leggiConfigSumUp();
  //  Chiave vuota = «non toccarla»: il campo parte sempre vuoto e solo
  //  scrivendoci dentro la si cambia. Vedi la stessa scelta per OpenRouter.
  const apiKey = String(dati.apiKey ?? "").trim() || prima.apiKey;
  const merchantCode = String(dati.merchantCode ?? "").trim() || prima.merchantCode;
  await supabaseAdmin.from("app_config").upsert(
    {
      key: CHIAVE_CONFIG,
      value: JSON.stringify({ apiKey, merchantCode }),
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "key" },
  );
}

export async function dimenticaConfigSumUp(): Promise<void> {
  await supabaseAdmin.from("app_config").upsert(
    { key: CHIAVE_CONFIG, value: JSON.stringify({ apiKey: "", merchantCode: "" }), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

const BASE = "https://api.sumup.com/v0.1";

export interface Checkout {
  id: string;
  /** dove mandare la persona a pagare */
  dove: string;
}

/** Apre un pagamento su SumUp e restituisce dove mandare la persona.
 *  ⚠️ `checkout_reference` è il NOSTRO numero d'ordine: è l'unico filo che
 *   lega quello che succede da SumUp a quello che sta scritto da noi, e senza
 *   di lui un pagamento arrivato non si sa a chi accreditarlo. */
export async function creaCheckout(o: {
  riferimento: string;
  centesimi: number;
  descrizione: string;
  email?: string;
  ritorno: string;
}): Promise<Checkout> {
  const cfg = await leggiConfigSumUp();
  if (!cfg.pronto) throw new Error("SumUp non è configurato");
  const r = await fetch(`${BASE}/checkouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      checkout_reference: o.riferimento,
      //  ⚠️ SumUp vuole l'importo in EURO, non in centesimi: 5.9 e non 590.
      //   Da noi gira in centesimi interi apposta, e la divisione si fa qui,
      //   in un punto solo, con due decimali fissi.
      amount: Number((o.centesimi / 100).toFixed(2)),
      currency: "EUR",
      merchant_code: cfg.merchantCode,
      description: o.descrizione,
      ...(o.email ? { customer_email: o.email } : {}),
      return_url: o.ritorno,
      redirect_url: o.ritorno,
    }),
  });
  const b = (await r.json()) as { id?: string; message?: string; error_message?: string };
  if (!r.ok || !b.id) {
    throw new Error(String(b.error_message || b.message || `SumUp ha risposto ${r.status}`));
  }
  return { id: b.id, dove: `https://checkout.sumup.com/pay/${b.id}` };
}

/** Com'è andata davvero, chiesto a SumUp. */
export async function statoCheckout(id: string): Promise<{ pagato: boolean; stato: string }> {
  const cfg = await leggiConfigSumUp();
  if (!cfg.pronto) return { pagato: false, stato: "non-configurato" };
  const r = await fetch(`${BASE}/checkouts/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!r.ok) return { pagato: false, stato: `errore-${r.status}` };
  const b = (await r.json()) as { status?: string };
  const stato = String(b.status || "").toUpperCase();
  return { pagato: stato === "PAID", stato: stato.toLowerCase() || "sconosciuto" };
}
