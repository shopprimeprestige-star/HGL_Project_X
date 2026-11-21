/** ── LA PAGINA ORDINE: IL SERVER (`ordinePubblico`) ─────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T55 (PIANO-R2 §3.3, D48, D49, D52, D63, D66; SPEC 8A n. 5, 12.4.3). Importabile senza ambiente:
 *  si ricevono PORTE (database, chiave di servizio, orologio, indirizzo, log, testi), così si prova con un finto database.
 *  L'involucro `createServerFn` sta in `ordine-pubblico.functions.ts`.
 *
 *  Chi arriva a `/shop/ordine/<ref>?t=<chiave>` è un cliente qualunque con un link: nessun account. Quindi:
 *  ⚠️ UNA SOLA RISPOSTA DI RIFIUTO, `{ok:false}`, per ogni caso: chiave sbagliata o assente, chiave di un altro ordine, ref inesistente o
 *   storto, ordine del sito vecchio (senza impronta), limite superato, guasto, migrazione S4 assente. Identica byte per byte: dalla risposta
 *   non si capisce se l'ordine esiste. La chiave si confronta con l'impronta salvata (`verificaChiave` di T48, tempo costante), e con
 *   l'ordine assente si fa lo stesso lavoro contro un'impronta fittizia.
 *  ⚠️ Il limite (60 letture/ora per indirizzo, D49) si consuma PRIMA di guardare la chiave: chi prova chiavi a caso si ferma. L'indirizzo
 *   vive solo come HMAC (`improntaIndirizzo`). Se il limite non risponde si rifiuta (si chiude).
 *  ⚠️ Si leggono solo le colonne che servono alla pagina: mai nome, cognome, email, telefono, indirizzo, note, id di Stripe, lead. Nella
 *   risposta solo CAP e città; mai l'id dell'ordine (il `ref` è quello chiesto, già validato).
 *  ⚠️ Solo letture, tranne il contatore del limite (funzione SQL). Nel log solo CODICI (mai ref, chiave, id, nomi, testi di errore).
 *  Le fasi, `riprovabile` e le date vengono da `pagamento.ts` (T46) e dalle colonne/eventi dell'ordine: nessuna data inventata.
 *  I testi di servizio (reso, assistenza, …) non sono scritti qui: arrivano dalla porta `testiConfermati()` e passano per `filtraConfermati`. */
import { normalizzaOrdine, type Ordine, type RigaOrdine } from "@/crm/ecommerce/ordine";
import {
  fasePubblica,
  puoRiprovare,
  statoPagamentoDi,
  type FasePubblica,
} from "@/crm/ecommerce/pagamento";
import { codiceDi } from "../cms/cassa-sito";
import { filtraConfermati, type TestiConfermati } from "../cms/testi-confermati";
import { chiaveLimite, improntaIndirizzo, LIMITI, saleLimiti } from "./anti-spam";
import { refValido, verificaChiave } from "./chiave-ordine";

/** Il pezzo di costruttore di query di Supabase che serve qui (il finto delle prove ne ha lo stesso aspetto). */
interface Interrogazione extends PromiseLike<{ data: unknown; error: { code?: unknown } | null }> {
  eq(colonna: string, valore: unknown): Interrogazione;
  in(colonna: string, valori: unknown[]): Interrogazione;
  order(colonna: string, opzioni?: { ascending?: boolean }): Interrogazione;
  limit(n: number): Interrogazione;
}
export interface DbOrdinePubblico {
  from(tabella: string): { select(colonne: string): Interrogazione };
  rpc(
    nome: string,
    argomenti: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: unknown } | null }>;
}
export interface PorteOrdinePubblico {
  db: DbOrdinePubblico;
  /** La chiave di servizio: da lei derivano la chiave dell'ordine e il sale del limite. Assente = rifiuto. */
  chiaveServizio: string | null | undefined;
  /** Millisecondi (`Date.now()`); le prove usano un orologio finto. */
  adesso: () => number;
  /** L'indirizzo di chi chiede (`cf-connecting-ip`): serve SOLO al limite, e solo come HMAC. */
  ip: string | null | undefined;
  /** Solo CODICI. */
  log?: (codice: string) => void;
  /** I testi di servizio confermati dal titolare (D63). Di partenza `{}` = tutto nascosto; la fonte è di V1(b). */
  testiConfermati?: () => Promise<unknown> | unknown;
}

export interface TappeOrdine {
  ricevuto: string;
  pagato: string | null;
  inPreparazione: string | null;
  spedito: string | null;
  consegnato: string | null;
}
export interface OrdinePubblico {
  /** `null` finché la fase è `verifica` (D66): il numero non si dà prima del pagamento confermato. */
  ref: string | null;
  creatoIl: string;
  fase: FasePubblica;
  frase: string;
  tempo: TappeOrdine;
  righe: { nome: string; variante: string | null; qty: number; totaleCent: number; foto: null }[];
  subtotaleCent: number;
  spedizioneCent: number;
  totaleCent: number;
  rimborsatoCent: number;
  cap: string;
  citta: string;
  tracking: { corriere: string | null; numero: string | null; url: string | null } | null;
  riprovabile: boolean;
}
export type RispostaOrdinePubblica =
  | { ok: true; ordine: OrdinePubblico; testi: TestiConfermati }
  | { ok: false };

/** La frase di stato, una per fase: fatti brevi, senza promesse. shortcut: frasi neutre del codice (i titoli di SPEC 12.4.3 per A, B, C);
 *  quando V2 ha i testi del documento §3.8 li mette lei nella pagina e questa riga resta come ripiego. */
const FRASI: Record<FasePubblica, string> = {
  verifica: "Stiamo verificando il pagamento.",
  pagato: "Pagamento ricevuto.",
  in_preparazione: "Stiamo preparando il tuo ordine.",
  spedito: "Il tuo ordine è stato spedito.",
  consegnato: "Il tuo ordine è stato consegnato.",
  annullato: "L'ordine è stato annullato.",
  non_riuscito: "Il pagamento non è andato a buon fine.",
  scaduto: "Il pagamento non è andato a buon fine.",
  rimborsato: "L'ordine è stato rimborsato.",
};

/** Le sole colonne lette: niente nome, cognome, email, telefono, indirizzo, note, lead, id di Stripe, provincia. */
const COLONNE =
  "id, order_ref, created_at, items, subtotal, shipping, total, totale_cent, rimborsato_cent, cap, citta, status, stato_pagamento, pagato_il, scade_il, spedito_il, corriere, tracking, tracking_url, senza_tracking, canale, chiave_pubblica_hash";
/** Quanti eventi dell'ordine si guardano al massimo (servono solo le date delle tappe). */
const MAX_EVENTI = 50;
const MAX_URL = 500;
const MAX_NUMERO = 80;
const MAX_CORRIERE = 60;

/** La risposta di rifiuto: UNA, per tutto. */
const rifiuto = (): RispostaOrdinePubblica => ({ ok: false });
/** Il codice di un errore, in minuscolo (il log accetta solo `[a-z0-9_ ]`). */
const codice = (e: unknown): string => codiceDi(e).toLowerCase();
const eOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const iso = (v: string | null): string | null => {
  const t = v === null ? NaN : Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const cent = (euro: number): number => (Number.isFinite(euro) ? Math.round(euro * 100) : 0);

/** Il link di tracciamento, solo se è un indirizzo `https://` senza credenziali né spazi; altrimenti `null` (il numero resta).
 *  shortcut: solo ASCII stampabile (un indirizzo con lettere fuori dall'ASCII si rifiuta); allargare se un corriere ne userà uno. */
function soloHttps(v: string | null): string | null {
  if (!v || v.length > MAX_URL || !/^[!-~]+$/.test(v)) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}

/** Dove sta l'ordine nell'evasione: serve a non mostrare tappe «future» dopo una correzione all'indietro. `annullato` = fuori dalla linea. */
const RANGO: Partial<Record<Ordine["stato"], number>> = {
  nuovo: 0,
  in_preparazione: 1,
  spedito: 2,
  consegnato: 3,
};

/** La data dell'evento più recente che ha portato l'ordine in `stato`; `null` se non c'è (nessuna data inventata). */
function dataEvento(eventi: unknown[], stato: string): string | null {
  let migliore: number | null = null;
  for (const e of eventi) {
    if (!eOggetto(e) || !eOggetto(e.dopo) || e.dopo.stato !== stato) continue;
    const t = Date.parse(String(e.created_at));
    if (Number.isFinite(t) && (migliore === null || t > migliore)) migliore = t;
  }
  return migliore === null ? null : new Date(migliore).toISOString();
}

function tracking(o: Ordine, rango: number): OrdinePubblico["tracking"] {
  if (rango < 2) return null; // prima della spedizione (e per gli annullati) niente
  const numero = o.tracking ? o.tracking.slice(0, MAX_NUMERO) : null;
  const corriere = o.corriere ? o.corriere.slice(0, MAX_CORRIERE) : null;
  const url = soloHttps(o.trackingUrl);
  return numero || corriere || url ? { corriere, numero, url } : null;
}

async function leggi(
  porte: PorteOrdinePubblico | undefined,
  richiesta: { ref?: unknown; t?: unknown } | undefined,
): Promise<RispostaOrdinePubblica> {
  if (!porte || typeof porte.db !== "object" || porte.db === null) return rifiuto();
  const { db, chiaveServizio } = porte;
  const log = (c: string) => {
    try {
      porte.log?.(c);
    } catch {
      /* il log non deve mai rompere la risposta */
    }
  };
  if (typeof chiaveServizio !== "string" || chiaveServizio === "") {
    log("ordine_pubblico chiave_mancante");
    return rifiuto();
  }

  // 1 · il limite, PRIMA di guardare la chiave (anche i tentativi sbagliati lo consumano)
  const impronta = await improntaIndirizzo(porte.ip, await saleLimiti(chiaveServizio));
  const consumo = await db.rpc("shop_limite_consuma", {
    p_chiave: chiaveLimite("lettura", impronta),
    p_finestra_s: LIMITI.lettura.finestraS,
    p_max: LIMITI.lettura.max,
  });
  if (consumo.error) {
    log(`ordine_pubblico limite ${codice(consumo.error)}`);
    return rifiuto();
  }
  if (consumo.data !== true) return rifiuto();

  // 2 · l'ordine del sito nuovo con quel riferimento (un ref storto non cerca niente, ma la chiave si confronta lo stesso)
  const ref = richiesta?.ref;
  let riga: Record<string, unknown> | null = null;
  if (refValido(ref)) {
    const r = await db
      .from("shop_orders")
      .select(COLONNE)
      .eq("order_ref", ref)
      .eq("canale", "sito")
      .limit(2);
    if (r.error) {
      log(`ordine_pubblico lettura ${codice(r.error)}`);
      return rifiuto();
    }
    const trovate = Array.isArray(r.data) ? r.data : [];
    // due righe con lo stesso ref non devono esistere (indice unico): nel dubbio, niente
    riga = trovate.length === 1 && eOggetto(trovate[0]) ? trovate[0] : null;
  }

  // 3 · la chiave, a tempo costante, sempre (con l'ordine assente contro un'impronta fittizia)
  const valida = await verificaChiave(richiesta?.t, riga ? riga.chiave_pubblica_hash : null);
  if (!riga || !valida || !refValido(ref) || riga.order_ref !== ref) return rifiuto();
  const o = normalizzaOrdine(riga);
  if (!o) return rifiuto();

  // 4 · le tappe: le date vengono dalle colonne e dagli eventi dell'ordine, mai inventate
  const adesso = new Date(porte.adesso());
  const fase = fasePubblica(o, adesso);
  const rango = RANGO[o.stato] ?? -1;
  let eventi: unknown[] = [];
  if (rango >= 1) {
    const e = await db
      .from("shop_order_eventi")
      .select("tipo, created_at, dopo")
      .eq("order_id", o.id)
      .in("tipo", ["stato", "stato_corretto", "spedito"])
      .order("created_at", { ascending: false })
      .limit(MAX_EVENTI);
    if (e.error) log(`ordine_pubblico eventi ${codice(e.error)}`);
    else if (Array.isArray(e.data)) eventi = e.data;
  }
  const pagatoVero = ["pagato", "rimborsato_in_parte", "rimborsato"].includes(statoPagamentoDi(o));
  const tempo: TappeOrdine = {
    ricevuto: iso(o.creatoIl) ?? o.creatoIl,
    pagato: pagatoVero ? iso(o.pagatoIl) : null,
    inPreparazione: rango >= 1 ? dataEvento(eventi, "in_preparazione") : null,
    spedito: rango >= 2 ? (iso(o.speditoIl) ?? dataEvento(eventi, "spedito")) : null,
    consegnato: rango >= 3 ? dataEvento(eventi, "consegnato") : null,
  };

  // 5 · i testi confermati (la porta; chi non risponde = tutto nascosto)
  let testi = filtraConfermati({});
  if (typeof porte.testiConfermati === "function") {
    try {
      testi = filtraConfermati(await porte.testiConfermati());
    } catch (e) {
      log(`ordine_pubblico testi ${codice(e)}`);
    }
  }

  const righe = o.righe.map((r: RigaOrdine) => ({
    nome: r.nome,
    variante: r.variante,
    qty: r.qty,
    totaleCent: cent(r.qty * r.prezzo),
    foto: null,
  }));
  return {
    ok: true,
    testi,
    ordine: {
      ref: fase === "verifica" ? null : ref,
      creatoIl: tempo.ricevuto,
      fase,
      frase: FRASI[fase],
      tempo,
      righe,
      subtotaleCent: cent(o.subtotale),
      spedizioneCent: cent(o.spedizione),
      totaleCent: o.totaleCent ?? cent(o.totale),
      rimborsatoCent: o.rimborsatoCent,
      cap: o.cap,
      citta: o.citta,
      tracking: tracking(o, rango),
      // D66: fase non riuscita o scaduta, mai un ordine annullato. In attesa oltre `scade_il` si LEGGE scaduto (D52) e offre «Riprova»:
      // `riprovaPagamento` (T51) rilegge Stripe prima di aprire qualunque cosa, quindi non c'è rischio di un secondo pagamento.
      // L'annullato non è mai riprovabile: lo escludono `puoRiprovare` (T46/T47) e la fase (`annullato` vince su `scaduto`).
      riprovabile: puoRiprovare(o) || (fase === "scaduto" && statoPagamentoDi(o) === "in_attesa"),
    },
  };
}

/** `ordinePubblico({ref, t})` (§3.3). Non lancia mai: ogni guasto è il rifiuto di sempre. */
export async function ordinePubblico(
  porte: PorteOrdinePubblico | undefined,
  richiesta: { ref?: unknown; t?: unknown } | undefined,
): Promise<RispostaOrdinePubblica> {
  try {
    return await leggi(porte, richiesta);
  } catch (e) {
    try {
      porte?.log?.(`ordine_pubblico eccezione ${codice(e)}`);
    } catch {
      /* niente */
    }
    return rifiuto();
  }
}
