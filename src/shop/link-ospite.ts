/** ── QUESTA PAGINA È APERTA DA UN CLIENTE? ─────────────────────────────────
 *  Una domanda sola, e serve in due posti che NON possono importarsi a vicenda:
 *  il motore della consulenza (shop/call) e la radice dell'applicazione
 *  (routes/__root), che il motore ormai lo carica a parte.
 *
 *  ⚠️ PERCHÉ IL MOTORE SI CARICA A PARTE. Misurato: il pezzo d'avvio
 *   dell'applicazione pesa 849 kB, e 400 sono il motore della consulenza —
 *   caricato su OGNI pagina, CRM compreso, dove non disegna niente. La
 *   dashboard del CRM pagava mezzo megabyte di codice che non le serviva.
 *   Da qui la regola qui sotto: sui link del cliente il motore serve SUBITO
 *   (è lui che disegna la sala d'attesa e il cancello del nome), altrove può
 *   arrivare dopo che la pagina si è disegnata.
 *  ───────────────────────────────────────────────────────────────────────── */

/** La forma dell'indirizzo di una stanza: /meetly/abc-defg-hij (e il vecchio
 *  /videochiamata/…, che continua a girare nei link già mandati). */
export const STANZA_RE = /^\/(?:meetly|videochiamata)\/([a-z0-9-]{6,})\/?$/i;

/** true se questa pagina è aperta con un link da CLIENTE.
 *  ⚠️ Dentro l'anteprima dispositivo (`embed=1`, o una cornice qualsiasi) NO:
 *   lì la pagina gira dentro lo schermo del consulente, e trattarla da cliente
 *   vorrebbe dire disegnarci sopra la sala d'attesa. */
export function linkDaCliente(p: { percorso?: string; ricerca?: string; inCornice?: boolean }): boolean {
  const cerca = new URLSearchParams(String(p.ricerca || ""));
  if (cerca.get("embed") === "1" || p.inCornice) return false;
  if (cerca.get("watch")) return true;
  return STANZA_RE.test(String(p.percorso || ""));
}

/** true se il motore della consulenza va caricato SUBITO, prima di disegnare.
 *  ⚠️ Vale anche per il CONSULENTE che ha una consulenza aperta: è il motore
 *   che riceve le bussate, e farlo aspettare vorrebbe dire una porta che non
 *   suona. Fuori da questi due casi il motore arriva dopo il primo disegno. */
export function motoreSubito(p: {
  percorso?: string;
  ricerca?: string;
  inCornice?: boolean;
  /** Questa postazione ha una consulenza aperta (hg_live_session). */
  consulenzaAperta?: boolean;
}): boolean {
  return linkDaCliente(p) || !!p.consulenzaAperta;
}
