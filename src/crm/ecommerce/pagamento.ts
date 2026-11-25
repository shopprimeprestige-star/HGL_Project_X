/** ── LO STATO DI PAGAMENTO DELL'ORDINE, COME LO LEGGE IL CRM ────────────────
 *  Commessa 2026-11-20-shop-completo, Rilascio 2 (T46; PIANO-R2 D41, D52, D55, D58, D66). Modulo PURO: niente React, niente database.
 *
 *  `status` (l'evasione: nuovo → … → consegnato) NON cambia. Accanto c'è `stato_pagamento`, scritto solo dalle funzioni SQL di S4.
 *  Colonna vuota o sconosciuta = ordine R1/R2: lo stato si DEDUCE (`pagato_il` presente → pagato, altrimenti da_incassare) qui, in un
 *  punto solo (`statoPagamentoDi`), così «Incassato» non ha quattro modi diversi di dire «pagato».
 *
 *  Questo file decide e non scrive: i passaggi ammessi, chi si lavora, chi si conta, quando si può riprovare, che fase vede il cliente.
 *  Le rotte e le funzioni SQL fanno rispettare le stesse regole; la prova le tiene d'accordo. */
import type { Ordine, StatoOrdine } from "./ordine";

export type StatoPagamento =
  | "in_attesa"
  | "pagato"
  | "fallito"
  | "scaduto"
  | "rimborsato_in_parte"
  | "rimborsato"
  | "da_incassare";
export const STATI_PAGAMENTO: readonly StatoPagamento[] = [
  "in_attesa",
  "pagato",
  "fallito",
  "scaduto",
  "rimborsato_in_parte",
  "rimborsato",
  "da_incassare",
];
export const ETICHETTA_PAGAMENTO: Record<StatoPagamento, string> = {
  in_attesa: "In attesa di pagamento",
  pagato: "Pagato",
  fallito: "Pagamento non riuscito",
  scaduto: "Pagamento scaduto",
  rimborsato_in_parte: "Rimborsato in parte",
  rimborsato: "Rimborsato",
  da_incassare: "Da incassare",
};

export const eStatoPagamento = (v: unknown): v is StatoPagamento =>
  typeof v === "string" && (STATI_PAGAMENTO as readonly string[]).includes(v);

// ── da dove nasce lo stato ─────────────────────────────────────────────────

/** Le sole parti dell'ordine che servono a dire lo stato di pagamento. */
type ConStato = Pick<Ordine, "statoPagamento" | "pagatoIl">;

/** Lo stato di pagamento: la colonna se è uno dei sette, altrimenti la deduzione dalla data (D41). */
export const statoPagamentoDi = (o: ConStato): StatoPagamento =>
  o.statoPagamento ?? (o.pagatoIl !== null ? "pagato" : "da_incassare");

/** Lo stato com'è LETTO adesso (D52): un ordine in attesa la cui `scade_il` è passata si legge «scaduto», senza lavori programmati.
 *  Lo stato vero lo scrive il webhook; questo evita che un ordine finto resti «in attesa» per ore se il webhook ritarda. */
export function statoEffettivo(
  o: ConStato & Pick<Ordine, "scadeIl">,
  adesso: Date,
): StatoPagamento {
  const stato = statoPagamentoDi(o);
  if (stato !== "in_attesa" || o.scadeIl === null) return stato;
  const scade = Date.parse(o.scadeIl);
  return Number.isFinite(scade) && Number.isFinite(adesso.getTime()) && scade <= adesso.getTime()
    ? "scaduto"
    : stato;
}

// ── i passaggi di pagamento ────────────────────────────────────────────────

/** Da → a ammessi. «Riaprire» (fallito|scaduto → in_attesa) NON è qui: si fa solo con `riapri` (D66). */
export const PASSAGGI_PAGAMENTO: Record<StatoPagamento, readonly StatoPagamento[]> = {
  in_attesa: ["pagato", "fallito", "scaduto"],
  pagato: ["rimborsato_in_parte", "rimborsato"],
  fallito: ["pagato"],
  scaduto: ["pagato"], // il pagamento può arrivare dopo la scadenza della sessione: ammesso, ma con un avviso
  rimborsato_in_parte: ["rimborsato"],
  rimborsato: [],
  da_incassare: ["pagato"],
};
/** Da quali stati si può riaprire un ordine (D66). Mai da `pagato` o `rimborsato`. */
export const RIAPRI_DA: readonly StatoPagamento[] = ["fallito", "scaduto"];

export type EsitoPassaggio = { ok: true; avviso: string | null } | { ok: false; errore: string };

/** Si può passare da `da` a `a`? `riapri` = è la riapertura di D66 (fallito|scaduto → in_attesa). Non lancia mai. */
export function passaggioPagamento(da: unknown, a: unknown, riapri = false): EsitoPassaggio {
  if (!eStatoPagamento(da) || !eStatoPagamento(a))
    return { ok: false, errore: "Stato di pagamento sconosciuto." };
  if (riapri && a === "in_attesa") {
    return RIAPRI_DA.includes(da)
      ? { ok: true, avviso: null }
      : { ok: false, errore: "Si può riprovare solo un pagamento non riuscito o scaduto." };
  }
  if (!PASSAGGI_PAGAMENTO[da].includes(a))
    return {
      ok: false,
      errore: `Da «${ETICHETTA_PAGAMENTO[da]}» a «${ETICHETTA_PAGAMENTO[a]}» non è un passaggio possibile.`,
    };
  return {
    ok: true,
    avviso:
      da === "scaduto" && a === "pagato"
        ? "Pagato dopo la scadenza della sessione: controlla la giacenza."
        : null,
  };
}

// ── chi si lavora, chi si conta ────────────────────────────────────────────

/** C'è qualcosa da preparare? Sì se è pagato (anche rimborsato in parte) o da incassare; NO se è in attesa, scaduto, fallito o rimborsato del tutto. */
export const puoLavorare = (o: ConStato): boolean => {
  const s = statoPagamentoDi(o);
  return s === "pagato" || s === "rimborsato_in_parte" || s === "da_incassare";
};
/** Entra nel numeretto, nei fermi, negli «Ordini», nei più venduti: si lavora e non è di prova (D58). */
export const contaComeLavoro = (o: ConStato & Pick<Ordine, "prova">): boolean =>
  puoLavorare(o) && !o.prova;
/** Entra nelle cifre dei soldi: tutto ciò che non è di prova (D58). Lo stato di pagamento lo decide poi chi somma. */
export const contaNelleCifre = (o: Pick<Ordine, "prova">): boolean => !o.prova;

/** «Riprova il pagamento» (D66): serve lo stato IN TABELLA fallito|scaduto. Se la tabella dice ancora «in attesa» non basta che `statoEffettivo`
 *  dica «scaduto»: prima si rilegge Stripe (la sessione potrebbe essere stata pagata). Un ordine ANNULLATO non si riapre mai
 *  (decisione del capo progetto, 21/11: `ordine_non_riapribile` anche in SQL). */
export const puoRiprovare = (o: ConStato & Pick<Ordine, "stato">): boolean =>
  o.stato !== "annullato" && RIAPRI_DA.includes(statoPagamentoDi(o));

// ── la pagina ordine del cliente ───────────────────────────────────────────

export type FasePubblica =
  | "verifica"
  | "pagato"
  | "in_preparazione"
  | "spedito"
  | "consegnato"
  | "annullato"
  | "non_riuscito"
  | "scaduto"
  | "rimborsato";

/** La fase che il cliente vede (PIANO-R2 §3.3). Mai «pagato» da solo: senza un pagamento confermato si resta in «verifica».
 *  Annullato vince su tutto; poi contano il pagamento fallito/scaduto/rimborsato; per gli altri segue l'evasione. */
export function fasePubblica(
  o: ConStato & Pick<Ordine, "scadeIl" | "stato">,
  adesso: Date,
): FasePubblica {
  if (o.stato === "annullato") return "annullato";
  switch (statoEffettivo(o, adesso)) {
    case "fallito":
      return "non_riuscito";
    case "scaduto":
      return "scaduto";
    case "rimborsato":
      return "rimborsato";
    case "in_attesa":
    case "da_incassare":
      return "verifica";
    default:
      return o.stato === "nuovo" ? "pagato" : o.stato; // pagato e rimborsato_in_parte
  }
}

// ── i passaggi di evasione degli ordini con stato di pagamento (D55) ───────

/** Da → a ammessi per gli ordini con `stato_pagamento`; `motivo: true` = il motivo è obbligatorio (correzioni all'indietro e annullo).
 *  In avanti un passo alla volta (salvo `nuovo → spedito`). Consegnato e annullato sono finali, salvo `annullato → nuovo` (annullo fatto per errore). */
export const PASSAGGI_EVASIONE: Record<
  StatoOrdine,
  readonly { a: StatoOrdine; motivo: boolean }[]
> = {
  nuovo: [
    { a: "in_preparazione", motivo: false },
    { a: "spedito", motivo: false }, // lo studio può spedire senza passare da «in preparazione» (decisione del capo progetto, 21/11)
    { a: "annullato", motivo: true },
  ],
  in_preparazione: [
    { a: "spedito", motivo: false },
    { a: "nuovo", motivo: true },
    { a: "annullato", motivo: true },
  ],
  spedito: [
    { a: "consegnato", motivo: false },
    { a: "in_preparazione", motivo: true },
    { a: "annullato", motivo: true },
  ],
  consegnato: [],
  annullato: [{ a: "nuovo", motivo: true }],
};

export type EsitoEvasione = { ok: true; serveMotivo: boolean } | { ok: false; errore: string };

/** Si può passare da `da` a `a`? `motivo` = quello scritto dall'operatore; `rimborsoAttivo` = c'è un rimborso richiesto o riuscito (blocca `annullato → nuovo`). */
export function passaggioEvasione(
  da: unknown,
  a: unknown,
  opzioni: { motivo?: unknown; rimborsoAttivo?: boolean } = {},
): EsitoEvasione {
  const chiave = String(da);
  const tabella = Object.prototype.hasOwnProperty.call(PASSAGGI_EVASIONE, chiave)
    ? PASSAGGI_EVASIONE[chiave as StatoOrdine]
    : [];
  const passo = tabella.find((p) => p.a === a);
  if (!passo) return { ok: false, errore: "Questo cambio di stato non è possibile." };
  if (passo.motivo && !(typeof opzioni.motivo === "string" && opzioni.motivo.trim()))
    return { ok: false, errore: "Scrivi il motivo: serve per tornare indietro o annullare." };
  if (da === "annullato" && opzioni.rimborsoAttivo)
    return {
      ok: false,
      errore: "L'ordine ha un rimborso richiesto o riuscito: non si può riattivare.",
    };
  return { ok: true, serveMotivo: passo.motivo };
}
