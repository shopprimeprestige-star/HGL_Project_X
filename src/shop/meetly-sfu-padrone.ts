/** ── CHI FA DA CONSULENTE IN UNA STANZA SFU (31/10/2026) ────────────────────
 *  Revisione di sicurezza: prima bastava un accesso al CRM con «agenda» (o una sessione
 *  presentatore qualsiasi) per valere come consulente in QUALUNQUE stanza, e quindi poter
 *  dichiarare, espellere o pubblicare da padrone di casa in una consulenza non propria.
 *  Ora vale come consulente solo:
 *   · il proprietario dell'account (email e password: è il titolare, conduce ovunque);
 *   · chi è il consulente di QUELLA stanza (`consulenteDellaSessione`, lo stesso legame
 *     codice → consulente che decide il listino), riconosciuto dalla sessione presentatore
 *     col suo PIN o dal token CRM del suo PIN.
 *  Chi non si può dimostrare padrone (codice consulente generale, stanza senza padrone noto)
 *  viene trattato da ospite: nel peggiore dei casi l'SFU non parte e la stanza resta sul
 *  collegamento diretto di sempre. Pura: provata in prove/idee/meetly-sfu-server.mjs. */
export function eConsulenteDellaStanza(x: {
  /** il consulente legato al codice stanza ("" = non si sa) */
  padrone: string;
  /** id della sessione presentatore ("" = nessuna o entrata col codice generale) */
  sessioneId: string;
  /** chi chiama dal CRM, se chiama dal CRM */
  crm: { tipo: "proprietario" | "consulente"; consultantId: string; agenda: boolean } | null;
}): boolean {
  if (x.crm?.tipo === "proprietario" && x.crm.agenda) return true;
  const padrone = String(x.padrone || "").trim();
  if (!padrone) return false;
  if (x.sessioneId && x.sessioneId === padrone) return true;
  return !!x.crm && x.crm.tipo === "consulente" && x.crm.agenda && !!x.crm.consultantId && x.crm.consultantId === padrone;
}
