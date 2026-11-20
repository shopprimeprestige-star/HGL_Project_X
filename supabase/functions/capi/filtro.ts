/*  ── `capi` DECIDE IN BASE A CHI CHIAMA (modulo puro) ──────────────────────────
    Shop R1 · T29 · PIANO D17 e nota A del revisore. Nessuna API di Deno e nessun import: lo si prova
    con esbuild (prove/negozio/capi-filtro.mjs). `index.ts` raccoglie i fatti (la sessione, la riga in
    `tracking_config`) e li passa qui; questo file decide soltanto.

    · Chi NON ha un utente verificato (il sito pubblico: solo apikey o il JWT anonimo, e anche un utente
      registrato ma ESTRANEO al CRM, cioè senza riga in `tracking_config`) passa solo se il nome, dopo
      NFKC + trim, è ESATTAMENTE uno dell'elenco. Nessuna lista nera: un `Purchase`, ` Purchase`,
      `PURCHASE` o `PlaceAnOrder` non è nell'elenco e quindi non passa.
    · Seconda rete: anche se un nome d'acquisto entrasse nell'elenco per errore, un nome che ridotto a
      minuscole senza segni è `purchase`, `completepayment`… resta rifiutato.
    · Chi ha un utente verificato E una riga in `tracking_config` (un membro del CRM) può mandare
      qualunque nome di forma ammessa: è la sua Offline Conversion `Purchase`.
    ⚠️ Chiunque può registrarsi: «utente verificato» da solo NON basta (nota A). */

/** I nomi che un chiamante senza utente del CRM può mandare (D17). Una prova li confronta con
 *  `NOMI_CAPI_ANONIMI` di `src/lib/tracciamento/nomi.ts`. `AddToCart` c'è per le schede già aperte nei browser. */
export const NOMI_AMMESSI = ["PageView", "ViewContent", "AddToCart", "Lead", "HighQualityVisit", "BookingDatePick", "BookingTimePick"] as const;

/** Seconda rete: i nomi d'acquisto, ridotti a minuscole senza segni. Non passano mai da un anonimo. */
export const NOMI_SEMPRE_VIETATI_ANONIMI = ["purchase", "completepayment", "placeanorder", "refund", "orderplaced", "paymentfailed"] as const;

/** La forma ammessa per un membro del CRM. */
export const FORMA_MEMBRO = /^[A-Za-z][A-Za-z0-9_]{1,39}$/;

export type Chiamante = {
  nome: unknown;
  /** `auth.getUser(token)` ha riconosciuto un utente. */
  autenticato: boolean;
  /** Quell'utente ha una riga in `tracking_config` (nota A). Senza `autenticato` non conta. */
  membroCrm: boolean;
};
export type Esito = { ok: true; nome: string } | { ok: false; motivo: "event_not_allowed" };

/** `NFKC` + `trim`; un valore che non è testo diventa vuoto. */
export function normalizzaNome(nome: unknown): string {
  return typeof nome === "string" ? nome.normalize("NFKC").trim() : "";
}

/** Minuscole, senza accenti né segni: «Pu-r_chase» e «PURCHÁSE» diventano `purchase`. */
function ridotto(nome: string): string {
  return nome.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Il nome può partire? In caso di sì `nome` è quello ripulito: è quello da mandare alle piattaforme.
 *  `ammessi` serve solo alle prove (per provare la seconda rete). */
export function decidi(chiamante: Chiamante, ammessi: readonly string[] = NOMI_AMMESSI): Esito {
  const no: Esito = { ok: false, motivo: "event_not_allowed" };
  const nome = normalizzaNome(chiamante.nome);
  if (!nome) return no;
  if (chiamante.autenticato && chiamante.membroCrm) return FORMA_MEMBRO.test(nome) ? { ok: true, nome } : no;
  if (!ammessi.includes(nome)) return no;
  if ((NOMI_SEMPRE_VIETATI_ANONIMI as readonly string[]).includes(ridotto(nome))) return no;
  return { ok: true, nome };
}
