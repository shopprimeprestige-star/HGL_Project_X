/** I tipi delle notifiche "di sistema" (quelle calcolate sui dati Ads e
 *  scritte a tabella dal runner) restano quelli di sempre. */
export type NotificationKind =
  | "creative_degraded"
  | "cpl_over_budget"
  | "no_lead_24h"
  | "lps_below_threshold";

export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationRow {
  id: string;
  user_id: string;
  /** `kind` è TEXT a database: oltre ai quattro tipi storici qui passano anche
   *  i tipi operativi del CRM (appuntamenti, installazioni, incassi) definiti
   *  in `catalogo.ts`. Per questo il tipo resta aperto alla stringa. */
  kind: NotificationKind | string;
  severity: NotificationSeverity | string;
  title: string;
  body: string | null;
  link: string | null;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
}
