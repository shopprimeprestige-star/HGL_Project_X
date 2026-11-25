/** ── LE VARIANTI IN TABELLA: LE REGOLE SENZA SCHERMO (scheda/varianti-puro.ts) ─────────────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E8 (PIANO §1.2 e E8). Niente React e niente rete: i testi di una riga come li scrive il titolare,
 *  gli errori a parole, cosa mandare al server quando una riga cambia (`variante_salva`, e la giacenza solo con un movimento).
 *  Si prova in `prove/negozio/varianti-editor.mjs`.
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · I soldi sono centesimi interi: prezzo e costo si leggono con `centDaEuro` (mai `parseFloat`).
 *  · Prezzo vuoto = vale il prezzo di base del prodotto (`null`); il costo vuoto = nessun costo (`null`).
 *  · La giacenza non si scrive sulla riga: cambia solo con un movimento registrato (`giacenza_imposta`), col motivo proposto da `cambioQuantita`. */
import { centDaEuro, type Variante } from "@/shop/cms/modello";
import { prezzoInTesto, prezzoVarianteDaTesto } from "../scheda-pura";
import { cambioQuantita, euroInTesto, trovaUnica, type MotivoGiacenza } from "../semplice-puro";

/** I campi di una riga, tutti come testo (è quello che c'è nelle caselle). */
export interface RigaTesto {
  nome: string;
  prezzo: string;
  giacenza: string;
  sku: string;
  gtin: string;
  peso: string;
  costo: string;
}
export type CampoRiga = keyof RigaTesto;
export type ErroriRiga = Partial<Record<CampoRiga, string>>;

const MAX_PESO = 1_000_000;
const MAX_GTIN = 20;
const MAX_NOME = 120;

/** I testi di una riga così come sono salvati. `costo` è `undefined` quando la scheda non lo conosce (nessuna colonna nuova da mostrare). */
export function rigaDa(v: Variante, costoCent: number | null | undefined): RigaTesto {
  return {
    nome: v.nome,
    prezzo: prezzoInTesto(v.prezzoCent ?? 0),
    giacenza: String(v.giacenza),
    sku: v.sku,
    gtin: v.gtin ?? "",
    peso: v.pesoG === null ? "" : String(v.pesoG),
    costo: costoCent === null || costoCent === undefined ? "" : euroInTesto(costoCent),
  };
}

/** Il nome proposto dalle opzioni («Nero / S», come lo scrive il generatore); vuoto se la variante non ha opzioni. */
export const nomeDalleOpzioni = (opzioni: Record<string, string> | null | undefined): string =>
  Object.values(opzioni ?? {}).join(" / ");

/** I testi in uso: quelli salvati, con sopra ciò che il titolare ha già cambiato. */
export const testiInUso = (
  base: RigaTesto,
  cambiati: Partial<RigaTesto> | undefined,
): RigaTesto => ({ ...base, ...cambiati });

/** Quali campi sono diversi da quelli salvati (per i bordi, il conteggio «N righe cambiate» e il tasto Salva). */
export const campiCambiati = (base: RigaTesto, ora: RigaTesto): CampoRiga[] =>
  (Object.keys(base) as CampoRiga[]).filter((k) => base[k].trim() !== ora[k].trim());

/** Gli errori di forma di una riga, uno per campo, scritti a parole. `{}` = tutto a posto. */
export function erroriRiga(t: RigaTesto, costoDisponibile: boolean, nomeProposto = ""): ErroriRiga {
  const e: ErroriRiga = {};
  // nome vuoto: se ci sono le opzioni si propone quello (non è un errore), altrimenti va scritto
  if (!t.nome.trim() && !nomeProposto) e.nome = "Scrivi il nome della variante.";
  if (t.nome.trim().length > MAX_NOME) e.nome = `Il nome ha al massimo ${MAX_NOME} segni.`;
  if (!prezzoVarianteDaTesto(t.prezzo).ok)
    e.prezzo = "Scrivi il prezzo in euro, per esempio 19,90, oppure lascialo vuoto.";
  if (!cambioQuantita(0, t.giacenza).ok)
    e.giacenza = "I pezzi sono un numero intero da 0 a 1.000.000.";
  if (!t.sku.trim()) e.sku = "Lo SKU non può restare vuoto.";
  if (t.gtin.trim().length > MAX_GTIN) e.gtin = `Il barcode ha al massimo ${MAX_GTIN} cifre.`;
  const peso = t.peso.trim();
  if (peso !== "" && !(/^\d{1,7}$/.test(peso) && Number(peso) <= MAX_PESO))
    e.peso = "Il peso è un numero intero di grammi.";
  if (costoDisponibile && t.costo.trim() !== "" && centDaEuro(t.costo) === null)
    e.costo = "Scrivi il costo in euro, per esempio 10,40, oppure lascialo vuoto.";
  return e;
}

export interface LavoroRiga {
  /** I campi di `variante_salva` (senza `id`); `null` se nessun campo della variante è cambiato. */
  campi: Record<string, unknown> | null;
  /** Il movimento di giacenza da registrare; `null` se i pezzi non sono cambiati. */
  giacenza: { valore: number; motivo: MotivoGiacenza } | null;
}

/**
 * Cosa mandare al server per una riga: solo i campi cambiati. Una riga con errori di forma non manda niente (`null`: lo dice la schermata).
 * `senzaPrezzo` (Invisible Derm) non scrive mai il prezzo; con `costoDisponibile` falso il costo non si manda.
 */
export function lavoroRiga(
  v: Variante,
  base: RigaTesto,
  ora: RigaTesto,
  opzioni: { senzaPrezzo: boolean; costoDisponibile: boolean; motivo?: MotivoGiacenza },
): LavoroRiga | null {
  const proposto = nomeDalleOpzioni(v.opzioni);
  if (Object.keys(erroriRiga(ora, opzioni.costoDisponibile, proposto)).length) return null;
  const cambiati = campiCambiati(base, ora);
  const campi: Record<string, unknown> = {};
  for (const k of cambiati) {
    if (k === "nome") {
      const nome = ora.nome.trim() || proposto;
      if (nome !== v.nome) campi.nome = nome;
    } else if (k === "sku") campi.sku = ora.sku.trim();
    else if (k === "prezzo" && !opzioni.senzaPrezzo) {
      const p = prezzoVarianteDaTesto(ora.prezzo);
      campi.prezzoCent = p.ok ? p.cent : null;
    } else if (k === "gtin") campi.gtin = ora.gtin.trim() === "" ? null : ora.gtin.trim();
    else if (k === "peso") campi.pesoG = ora.peso.trim() === "" ? null : Number(ora.peso.trim());
    else if (k === "costo" && opzioni.costoDisponibile)
      campi.costoCent = ora.costo.trim() === "" ? null : centDaEuro(ora.costo);
  }
  let giacenza: LavoroRiga["giacenza"] = null;
  if (cambiati.includes("giacenza")) {
    const q = cambioQuantita(v.giacenza, ora.giacenza);
    if (q.ok && q.motivo)
      giacenza = { valore: v.giacenza + q.differenza, motivo: opzioni.motivo ?? q.motivo };
  }
  return { campi: Object.keys(campi).length ? campi : null, giacenza };
}

/** Il prezzo che vale davvero per una riga: il suo, o quello di base del prodotto se è vuoto. */
export const prezzoEffettivo = (v: Pick<Variante, "prezzoCent">, prezzoBaseCent: number): number =>
  v.prezzoCent ?? prezzoBaseCent;

/** La variante «Unica» spenta (resta nel database, non si vende): sta in una riga chiusa e non nella tabella. */
export const eUnicaSpenta = (
  v: Variante,
  tutte: readonly Variante[],
  skuProdotto: string,
): boolean => !v.attiva && trovaUnica(tutte, skuProdotto)?.id === v.id;

/**
 * Le righe della tabella e, a parte, l'Unica spenta da mostrare in una riga chiusa (solo se ci sono le opzioni). Senza opzioni: la sola
 * variante (l'Unica) è il «prodotto semplice» e non ha tabella; con più varianti, anche senza opzioni, si vedono tutte (modificabili e disattivabili).
 */
export function dividiRighe(
  varianti: readonly Variante[],
  skuProdotto: string,
): { righe: Variante[]; unicaSpenta: Variante | null } {
  const conOpzioni = varianti.some((v) => Object.keys(v.opzioni ?? {}).length > 0);
  if (!conOpzioni) return { righe: varianti.length > 1 ? [...varianti] : [], unicaSpenta: null };
  const unicaSpenta = varianti.find((v) => eUnicaSpenta(v, varianti, skuProdotto)) ?? null;
  return { righe: varianti.filter((v) => v !== unicaSpenta), unicaSpenta };
}

/* ══ LE OPZIONI SCRITTE ═════════════════════════════════════════════════════ */

export interface OpzioneScritta {
  nome: string;
  valori: string[];
  /** Il valore che si sta scrivendo e non è ancora stato confermato con Invio. */
  bozza: string;
}

/** I valori di un testo scritto o incollato: «Nero, Biondo» (virgola o a capo) → elenco, senza vuoti. */
export const valoriDa = (t: string): string[] =>
  t
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** I valori dell'opzione con quello ancora in scrittura (se non c'è già, senza badare alle maiuscole): il conto delle combinazioni e il tasto lo vedono subito. */
export function valoriCompleti(o: OpzioneScritta): string[] {
  const visti = new Set(o.valori.map((x) => x.toLowerCase()));
  const nuovi = valoriDa(o.bozza).filter((x) => {
    const gia = visti.has(x.toLowerCase());
    visti.add(x.toLowerCase());
    return !gia;
  });
  return [...o.valori, ...nuovi];
}
