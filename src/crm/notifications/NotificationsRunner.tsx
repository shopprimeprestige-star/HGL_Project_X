/** ── IL MOTORE ACCESO ──────────────────────────────────────────────────────
 *
 *  PERCHÉ QUESTO FILE ESISTE (ed è dove stava il guasto)
 *  Il calcolo degli eventi, i suoni, il registro e le preferenze erano tutti
 *  scritti — ma nessuno montava `useMotoreNotifiche`: qui girava soltanto il
 *  controllo delle campagne, che scrive righe a database e non mostra nulla
 *  sulla scrivania. Risultato: le notifiche "non funzionavano" perché non
 *  esisteva un punto dell'albero React in cui il motore fosse vivo.
 *
 *  Il componente non disegna niente e sta nel guscio del CRM (routes/CRM.tsx),
 *  dentro CRMProvider e ProviderRicerca: gli servono le trattative e la
 *  possibilità di aprire una scheda al clic sulla notifica.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useMotoreNotifiche } from "./motore";
import { useNotificationTriggers } from "./useNotificationTriggers";

export function NotificationsRunner() {
  // Gli avvisi operativi: appuntamenti, lead, installazioni, incassi.
  // Vive nel browser, suona, e scrive nella campanella.
  useMotoreNotifiche();
  // Gli alert sulle campagne: girano ogni dieci minuti e scrivono a database.
  useNotificationTriggers();
  return null;
}
