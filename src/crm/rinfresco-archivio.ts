/** ── L'ELENCO SI AGGIORNA ANCHE SUL TELEFONO ───────────────────────────────
 *
 *  Segnalazione del committente: «quando fisso un meet, alla setter sul PC i
 *  lead si tolgono, ma sul telefono non si aggiorna; forse non si salvano».
 *
 *  ⚠️ SI SALVANO. Misurato sul database: gli appuntamenti fissati dalle setter
 *   ci sono, con l'ora giusta. È l'ELENCO dell'altro dispositivo che resta
 *   quello di quando è stato aperto.
 *
 *  PERCHÉ. L'archivio si scarica all'apertura (crm/copia-archivio) e poi si
 *  rilegge SOLO quando arriva il segnale «una scheda è cambiata» del tempo
 *  reale di Supabase (crm/notifications/motore). Sul dispositivo che fa la
 *  modifica non serve: la scheda si aggiorna da sé. Su tutti gli altri è
 *  l'unica strada, e si interrompe in due casi:
 *   · il TELEFONO: a schermo spento o passando a WhatsApp il browser sospende
 *     la pagina e chiude il collegamento in tempo reale; tornando, quello che
 *     è cambiato nel frattempo non arriva più. Nessuno rileggeva;
 *   · il DATABASE: la tabella dei lead non era nella pubblicazione del tempo
 *     reale (nessuna migrazione ce la metteva: sul database vecchio era stata
 *     accesa a mano), quindi il segnale non partiva per nessuno. Vedi la
 *     migrazione 20261012140000_lead_in_tempo_reale.
 *
 *  Qui c'è la regola che decide quando rileggere senza aspettare il segnale:
 *  tornando sulla pagina, tornando in rete, e comunque ogni minuto mentre la
 *  pagina si guarda. La rilettura chiede solo «cos'è cambiato dopo» più un
 *  conteggio (crm/copia-archivio): due domande piccole, e vanno a Supabase,
 *  non al sito — non toccano il tetto di richieste di Cloudflare.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Ogni quanto si rilegge mentre la pagina è davanti, senza segnali. */
export const OGNI_MS = 60_000;
/** Due riletture più vicine di così sono la stessa: tornare sulla scheda e
 *  ritrovare la rete arrivano spesso insieme. */
export const MINIMO_FRA_RILETTURE_MS = 5_000;

export type Motivo = "ritorno" | "rete" | "orologio";

/** Si rilegge adesso? */
export function daRileggere(p: {
  motivo: Motivo;
  /** la pagina si vede (document.visibilityState === "visible") */
  visibile: boolean;
  /** quando si è riletto l'ultima volta (ms); 0 = mai */
  ultima: number;
  adesso: number;
}): boolean {
  //  Una pagina che non si guarda non chiede niente: rileggerà tornando.
  if (!p.visibile) return false;
  const passati = p.ultima ? p.adesso - p.ultima : Infinity;
  if (passati < MINIMO_FRA_RILETTURE_MS) return false;
  //  L'orologio rilegge solo se nel frattempo non l'ha già fatto altro.
  if (p.motivo === "orologio") return passati >= OGNI_MS - 1_000;
  return true;
}
