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

/* ── IL PADRONE SI SCRIVE SOLO DAL SERVER (revisione di sicurezza, 31/10/2026) ──────────
 *  `consulenteDellaSessione` (il legame che decide il listino) può nascere da un id che arriva
 *  dal browser: va bene per i prezzi, non per decidere chi comanda una stanza. Qui c'è una riga
 *  sua, `meetly_padrone:<codice>`, scritta SOLO con l'id di chi si è dimostrato al server (token
 *  CRM del PIN all'«Avvia», sessione presentatore col PIN all'apertura della diretta) e mai
 *  sovrascritta da un altro: chi conosce il codice di una stanza altrui non se
 *  la prende. Un collega che riprende davvero la stanza resta, per 24 ore, sul collegamento
 *  diretto di sempre (l'SFU non parte): un fastidio, non un buco. */
export const PREFISSO_PADRONE = "meetly_padrone:";
export const PADRONE_VALE_MS = 24 * 3600_000;

export function chiavePadrone(codice: unknown): string {
  const c = String(codice ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  return c ? PREFISSO_PADRONE + c : "";
}

/** Chi risulta padrone dalla riga salvata ("" = nessuno o scaduto). */
export function padroneDa(grezzo: string | null, adesso: number): string {
  try {
    const o = JSON.parse(grezzo ?? "null") as { id?: unknown; il?: unknown } | null;
    const id = typeof o?.id === "string" ? o.id : "";
    const il = Date.parse(String(o?.il ?? ""));
    return id && Number.isFinite(il) && adesso - il <= PADRONE_VALE_MS ? id : "";
  } catch {
    return "";
  }
}

/** La riga da scrivere, o `null` se non si scrive. Il padrone è il PRIMO che la stanza ha avuto e
 *  non cambia mai: si scrive se la stanza non ne ha nessuno, e si rinnova solo per la stessa persona.
 *  Una stanza col padrone scaduto resta senza SFU (collegamento diretto), non torna in palio. */
export function nuovoPadrone(grezzo: string | null, id: string, adesso: number): string | null {
  const chi = String(id || "").trim();
  if (!chi) return null;
  if (grezzo === null) return JSON.stringify({ id: chi, il: new Date(adesso).toISOString() });
  let prima = "";
  try {
    const o = JSON.parse(grezzo) as { id?: unknown } | null;
    prima = typeof o?.id === "string" ? o.id : "";
  } catch {
    return null;
  }
  return prima === chi ? JSON.stringify({ id: chi, il: new Date(adesso).toISOString() }) : null;
}
