// ── DA DOVE ARRIVA UN LEAD ──────────────────────────────────────────────────
//  Una funzione sola per una domanda sola. La pagina KPI ne aveva DUE diverse —
//  una per i riquadri, una per il filtro — e i due conteggi non tornavano fra
//  loro: lo stesso lead risultava Meta in un blocco e organico in quello
//  accanto. Sta in un file suo perché la usano la scheda «Ritorno» (per
//  l'elenco dietro ai numeri) e la scheda «Fonti» (per la tabella e il filtro).

import type { Lead } from "@/crm/types";
import { detectChannel } from "@/crm/kpi/cvr-generale-utils";

/** I canali di provenienza di un lead. Sono gli stessi tre della spesa
 *  (`CanaleSpesa` in ./spesa): l'organico esiste come provenienza ma non ha
 *  spesa, ed è il senso della parola. */
export type CanaleLead = "meta" | "tiktok" | "organic";

export const NOME_CANALE: Record<CanaleLead, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  organic: "Organico",
};

/** L'ordine in cui si leggono i canali nella tabella: non per grandezza, che
 *  cambia a ogni periodo e renderebbe impossibile confrontare due settimane. */
export const CANALI: CanaleLead[] = ["meta", "tiktok", "organic"];

/** ── L'ORDINE DELLE FONTI DELLA RISPOSTA ───────────────────────────────────
 *  Prima la scelta fatta a mano sulla scheda: se qualcuno ha corretto la
 *  piattaforma è perché sapeva qualcosa che il tracciamento non sapeva.
 *  Poi la fonte registrata dal modulo, e solo per ultimo il riconoscimento dai
 *  parametri dell'annuncio (fbclid / ttclid / utm_source). */
export function canaleDi(l: Lead): CanaleLead {
  const scelto = l.data?.piattaformaAds;
  if (scelto === "meta") return "meta";
  if (scelto === "tiktok") return "tiktok";
  if (scelto === "none") return "organic";
  const t = l.data?.tracking;
  //  ⚠️ `source` è dichiarato come uno dei tre canali, ma arriva da un campo
  //  JSON scritto dalla landing e dall'archivio importato: nei dati veri può
  //  contenere «google», «wa» o una stringa vuota. Senza questo controllo quel
  //  lead uscirebbe con un canale che non esiste, sparirebbe da tutte e tre le
  //  righe della tabella «Per canale» e in «Ritorno» il suo nome comparirebbe
  //  senza provenienza (NOME_CANALE non lo conosce).
  if (t?.source && CANALI.includes(t.source)) return t.source;
  const rilevato = detectChannel({
    utm_source: t?.utm_source ?? null,
    fbclid: t?.fbclid ?? null,
    ttclid: t?.ttclid ?? null,
  });
  return rilevato === "meta" || rilevato === "tiktok" ? rilevato : "organic";
}
