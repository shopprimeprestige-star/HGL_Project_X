/** ── GLI EVENTI DELLA CONSULENZA, CON I NOMI FISSI ─────────────────────────
 *  Solo conteggi: pagina, fonte e dispositivo li aggiunge il tracciamento.
 *  Mai nome, telefono o testo libero nel dettaglio.
 *
 *  ⚠️ `trackEvent` scarta in silenzio ogni evento finché non sa se chi visita
 *  è un amministratore (non lo vuole contare). Un evento sparato al montaggio
 *  della pagina, come «scheda vista», andrebbe perso: qui si aspetta l'esito.
 *  ───────────────────────────────────────────────────────────────────────── */
import { initAdminCheck, trackEvent } from "@/landing/booking/tracking";

export type NomeEvento =
  | "consulenza_barra_vista"
  | "consulenza_barra_click"
  | "consulenza_barra_chiusa"
  | "consulenza_pannello_aperto"
  | "consulenza_problema_scelto"
  | "consulenza_popup_mostrato"
  | "consulenza_popup_click"
  | "stock_box_visto"
  | "stock_vista_scheda";

export function traccia(
  nome: NomeEvento,
  dettaglio: Record<string, string | number | boolean> = {},
  opzioni: { dedupKey?: string } = {},
): void {
  void initAdminCheck().then(() => trackEvent(nome, null, dettaglio, opzioni));
}
