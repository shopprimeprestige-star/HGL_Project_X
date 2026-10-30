/** ── PASSARE ALL'APP WHATSAPP, A FINESTRA CHIUSA ─────────────────────────────
 *  Richiesta del titolare (29/10/2026): quando la finestra di 24 ore è chiusa
 *  il CRM può mandare solo modelli approvati; dalla pastiglia «Finestra
 *  chiusa» si passa all'app WhatsApp del telefono, sulla chat di quel numero,
 *  e lì si scrive a mano. Meglio WhatsApp Business, se c'è.
 *  ⚠️ BUSINESS PRIMA SOLO SU ANDROID: lì un link «intent://» può nominare
 *   l'app (pacchetto com.whatsapp.w4b) e, se Business non c'è, Chrome apre
 *   wa.me da solo (browser_fallback_url) → WhatsApp normale.
 *   Su iPhone e sul computer non esiste un modo per sceglierla: wa.me apre
 *   l'app che il sistema associa al link (con una sola installata, quella).
 *  Puro, provato in prove/prove.mjs (proveDellApriWhatsapp).
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il link wa.me del numero (solo cifre, col prefisso internazionale). Vuoto
 *  se il numero non ha abbastanza cifre per essere vero. Con `testo` (30/10/2026)
 *  il messaggio arriva già scritto nella casella: `?text=` codificato. */
export function linkWaMe(telefono?: string | null, testo?: string | null): string {
  const cifre = String(telefono ?? "").replace(/\D/g, "");
  if (cifre.length < 8) return "";
  const t = String(testo ?? "").trim();
  return `https://wa.me/${cifre}${t ? `?text=${encodeURIComponent(t)}` : ""}`;
}

/** Il link da aprire: su Android WhatsApp Business (ripiego wa.me), altrove wa.me.
 *  Il `testo` (facoltativo) è il messaggio già scritto: `text=` anche nell'intent
 *  (lo schema `whatsapp://send` lo accetta), e il ripiego wa.me lo porta uguale. */
export function linkApriWhatsapp(
  telefono: string | null | undefined,
  userAgent: string,
  testo?: string | null,
): string {
  const waMe = linkWaMe(telefono, testo);
  if (!waMe || !/Android/i.test(userAgent)) return waMe;
  const cifre = waMe.slice("https://wa.me/".length).split("?")[0];
  const t = String(testo ?? "").trim();
  return (
    `intent://send/?phone=${cifre}${t ? `&text=${encodeURIComponent(t)}` : ""}` +
    `#Intent;scheme=whatsapp;package=com.whatsapp.w4b;` +
    `S.browser_fallback_url=${encodeURIComponent(waMe)};end`
  );
}
