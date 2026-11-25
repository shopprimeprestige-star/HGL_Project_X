/** ── IL FUOCO TORNA A CHI HA APERTO IL PANNELLO (T109a · T103a-6, T103c-4) ───────────────────────────────────────
 *  Il pannello è un `Dialog` di Radix SENZA `Dialog.Trigger` (lo aprono la barra, l'header, il piè di pagina, un box): Radix, alla chiusura,
 *  ferma il suo comportamento e rimette il fuoco sul `Trigger`, che qui non c'è. Risultato: dopo Esc il fuoco finisce sul `body`.
 *  Qui si ricorda chi l'aveva e glielo si restituisce. Funzioni pure (documento e bottoni finti nelle prove). */

/** Chi ha il fuoco ORA (da chiamare mentre il pannello si apre, prima che la pagina dietro diventi `inert`); `null` se è il `body` o niente. */
export function chiHaAperto<T>(doc: { activeElement: T | null; body: unknown }): T | null {
  const a = doc.activeElement;
  return a && a !== doc.body ? a : null;
}

/** Alla chiusura: se chi aveva aperto è ancora nella pagina gli rende il fuoco e ferma il comportamento di Radix (che lo darebbe a nessuno). Se non c'è
 *  più (menu chiuso, pagina cambiata) non tocca niente. `true` = fuoco restituito. */
export function restituisciFuoco(evento: { preventDefault(): void }, da: { isConnected: boolean; focus(): void } | null): boolean {
  if (!da?.isConnected) return false;
  evento.preventDefault();
  da.focus();
  return true;
}
