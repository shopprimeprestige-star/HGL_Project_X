/** ── TUTTI I PREVENTIVI DEL GRUPPO, IN PARALLELO ───────────────────────────
 *
 *  Richiesta del committente: «se assegno che devono compilare il preventivo
 *  voglio vederli tutti in contemporanea, in parallelo, e poter intervenire».
 *
 *  Fin qui il consulente vedeva UNA stanza alla volta («Guarda da me»): per
 *  sapere che cosa stava scegliendo il secondo doveva lasciare il primo. Qui
 *  ci sono le regole della vista a schede: una scheda per ogni persona che ha
 *  il preventivo acceso, con quello che sta scegliendo, aggiornata nell'istante
 *  in cui lo tocca (lo stato arriva dal canale della sua stanza).
 *
 *  ⚠️ IL TOTALE DICE DA DOVE VIENE. Il conto esatto della pagina dipende anche
 *   dagli sconti per quantità e dai codici automatici, che qui non ci sono:
 *   rifarlo a metà vorrebbe dire due numeri diversi per lo stesso preventivo.
 *   Quindi: se il preventivo è già stato creato vale il SUO totale; finché lo
 *   si sta componendo è una STIMA, e lo si scrive.
 *  ⚠️ NIENTE DATI PERSONALI: le schede leggono solo le scelte del
 *   configuratore, mai il profilo del cliente.
 *  ───────────────────────────────────────────────────────────────────────── */
import { sectionsFor, TRANSPLANT_ID, type QuoteMenu } from "./quote-menu";
import { haIlSuo, type RegiaGruppo } from "./preventivi-di-gruppo";

/** Le parti dello stato del configuratore che servono a una scheda. */
export type StatoVivo = {
  baseId?: unknown;
  selected?: unknown;
  simOn?: unknown;
  installOn?: unknown;
  fitting?: unknown;
  qty?: unknown;
  manual?: unknown;
  result?: unknown;
};

export type Scheda = {
  /** non ha ancora scelto niente */
  vuoto: boolean;
  soluzione: string;
  voci: string[];
  quantita: number;
  applicazione: string;
  totale: number;
  /** true = totale del preventivo creato; false = stima mentre si compone */
  esatto: boolean;
  codice: string;
};

const testo = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const numero = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** La scheda di una persona, dal suo stato e dal listino in uso. */
export function schedaDelPreventivo(s: StatoVivo | null | undefined, menu: QuoteMenu): Scheda {
  const baseId = testo(s?.baseId);
  const selezionate = new Set(Array.isArray(s?.selected) ? (s?.selected as unknown[]).map(testo) : []);
  const base = menu.base.find((b) => b.id === baseId);
  const trapianto = baseId === TRANSPLANT_ID;
  const voci = sectionsFor(menu.sections, baseId)
    .flatMap((sez) => sez.items)
    .filter((u) => selezionate.has(u.id));
  const quantita = Math.max(1, Math.round(numero(s?.qty)) || 1);
  const fit = menu.fitting.find((f) => f.id === testo(s?.fitting));
  const perUnita =
    (base?.price ?? 0) +
    voci.reduce((t, u) => t + u.price, 0) +
    (s?.simOn === true && menu.simulation ? menu.simulation.price : 0) +
    (s?.installOn === true && menu.installation && !trapianto ? menu.installation.price : 0);
  const lordo = perUnita * quantita + (trapianto ? 0 : (fit?.price ?? 0));
  const manuale = s?.manual as { code?: unknown; discount_eur?: unknown } | null | undefined;
  const scontoManuale = Math.max(0, numero(manuale?.discount_eur));
  const creato = numero((s?.result as { total?: unknown } | null | undefined)?.total);
  const esatto = creato > 0;
  return {
    vuoto: !base && voci.length === 0,
    soluzione: base?.name ?? "",
    voci: voci.map((u) => u.name),
    quantita,
    applicazione: trapianto ? "" : (fit?.name ?? ""),
    totale: esatto ? creato : Math.max(0, lordo - scontoManuale),
    esatto,
    codice: testo(manuale?.code),
  };
}

/** Chi ha il preventivo acceso, nell'ordine in cui è atteso: sono loro le
 *  schede. Chi non ha un gettone non ha una stanza sua, quindi non ha scheda. */
export function chiCompila<P extends { gettone: string }>(p: {
  regia?: RegiaGruppo | null;
  attesi: P[];
}): P[] {
  return p.attesi.filter((a) => !!a.gettone && haIlSuo(p.regia, a.gettone));
}

/** Sotto questo silenzio la persona «sta compilando». */
export const SOGLIA_VIVO_MS = 20_000;

/** Che cosa sta facendo, detto in una riga. `ultimo` = l'ultimo tocco (ms). */
export function attivita(ultimo: number, adesso: number): { vivo: boolean; testo: string } {
  if (!ultimo) return { vivo: false, testo: "non ha ancora toccato niente" };
  const fa = Math.max(0, adesso - ultimo);
  if (fa < SOGLIA_VIVO_MS) return { vivo: true, testo: "sta compilando" };
  const min = Math.floor(fa / 60_000);
  return { vivo: false, testo: min < 1 ? "fermo da poco" : `fermo da ${min} min` };
}
