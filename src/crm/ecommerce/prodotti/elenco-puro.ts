/** ── L'ELENCO DEI PRODOTTI: LE REGOLE SENZA SCHERMO (elenco-puro.ts) ───────────
 *  Commessa 2026-11-20-shop-completo, T14 (Design §4.10.1). Niente React e niente rete: ricerca, ordine delle colonne, chip
 *  di stato con la PRIMA ragione scritta, SKU e indirizzo proposti per una copia e le frasi di riepilogo delle azioni di gruppo.
 *  Si prova in `prove/negozio/pagina-negozio.mjs` (compilato con esbuild: per questo nessun import di codice, solo tipi). */
import type { RigaElenco, Segmento } from "@/crm/negozio/client";

/** Quanti prodotti si possono cambiare in una volta (lo stesso tetto di `gruppo_stato` sul server). */
export const MAX_GRUPPO = 20;

export const ETICHETTE_SEGMENTO: Record<Segmento, string> = {
  tutti: "Tutti",
  pubblicati: "Pubblicati",
  bozze: "Bozze",
  da_sistemare: "Da sistemare",
  vecchio_catalogo: "Vecchio catalogo",
};

/* ══ RICERCA E ORDINE ═══════════════════════════════════════════════════════ */

/** Per nome o per SKU, senza badare alle maiuscole. Ricerca vuota = tutte. */
export function cercaRighe(righe: readonly RigaElenco[], testo: string): RigaElenco[] {
  const t = testo.trim().toLowerCase();
  return t ? righe.filter((r) => `${r.nome} ${r.sku}`.toLowerCase().includes(t)) : [...righe];
}

export type Colonna = "nome" | "sku" | "prezzo" | "stato";
export type Direzione = "su" | "giu";

const confronto = new Intl.Collator("it", { sensitivity: "base", numeric: true });
const ORDINE_STATO: Record<string, number> = { pubblicato: 0, bozza: 1, archiviato: 2 };

/** Una copia ordinata. A parità decidono il nome e poi l'id: l'ordine di due righe uguali non cambia mai da una lettura all'altra. */
export function ordinaRighe(
  righe: readonly RigaElenco[],
  colonna: Colonna,
  direzione: Direzione,
): RigaElenco[] {
  const primario: Record<Colonna, (a: RigaElenco, b: RigaElenco) => number> = {
    nome: (a, b) => confronto.compare(a.nome, b.nome),
    sku: (a, b) => confronto.compare(a.sku, b.sku),
    prezzo: (a, b) => a.prezzoCent - b.prezzoCent,
    stato: (a, b) => (ORDINE_STATO[a.stato] ?? 9) - (ORDINE_STATO[b.stato] ?? 9),
  };
  const f = Object.hasOwn(primario, colonna) ? primario[colonna] : null;
  if (!f) return [...righe];
  const segno = direzione === "giu" ? -1 : 1;
  return [...righe].sort(
    (a, b) =>
      segno * f(a, b) ||
      confronto.compare(a.nome, b.nome) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/* ══ IL CHIP DI STATO ═══════════════════════════════════════════════════════ */

export interface ChipProdotto {
  etichetta: string;
  /** `ok` verde, `attenzione` ambra, `neutro` grigio, `spento` grigio chiaro (non si vende e non c'è da fare niente). */
  tono: "ok" | "attenzione" | "neutro" | "spento";
  /** La prima cosa da sistemare, già scritta in italiano dal server; `null` se non c'è niente da dire. */
  ragione: string | null;
  /** Ha modifiche scritte ma non ancora pubblicate. */
  modifiche: boolean;
}

export function chipProdotto(r: RigaElenco): ChipProdotto {
  const modifiche = r.haModifiche === true;
  if (r.origine === "codice")
    return { etichetta: "Vecchio catalogo", tono: "neutro", ragione: null, modifiche };
  if (r.stato === "archiviato")
    return { etichetta: "Archiviato", tono: "spento", ragione: null, modifiche };
  if (r.stato === "pubblicato")
    return {
      etichetta: "Pubblicato",
      tono: r.motivo ? "attenzione" : "ok",
      ragione: r.motivo,
      modifiche,
    };
  return { etichetta: "Bozza", tono: "neutro", ragione: r.motivo, modifiche };
}

/** I canali accesi, in italiano («Sito, Meta»). Nessuno acceso, o un valore illeggibile: «Nessun canale». */
export function etichettaCanali(canali: RigaElenco["canali"] | null | undefined): string {
  const nomi = [["sito", "Sito"], ["meta", "Meta"], ["google", "Google"], ["tiktok", "TikTok"]] as const;
  const accesi = nomi.filter(([k]) => canali?.[k] === true).map(([, n]) => n);
  return accesi.length ? accesi.join(", ") : "Nessun canale";
}

/** La giacenza della riga: il numero, «Esaurito» a zero, «—» se non si legge. */
export function etichettaGiacenza(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n <= 0 ? "Esaurito" : String(n);
}

/* ══ LA COPIA ═══════════════════════════════════════════════════════════════ */

const MAX_SKU = 40;
const MAX_SLUG = 80;

/**
 * SKU e indirizzo della copia, con lo stesso numero: «-COPIA» e «-copia», poi «-COPIA2» e «-copia2»… Si ferma al primo numero
 * in cui sono liberi tutti e due. `shop_prodotti.slug` è UNIQUE: senza un indirizzo nuovo la seconda copia dello stesso prodotto
 * darebbe «duplicato». Resta dentro i tetti di modello.ts (SKU 40, indirizzo 80, senza «--» né trattino finale).
 */
export function proponiCopia(
  sku: string,
  slug: string,
  skuUsati: Iterable<string>,
  slugUsati: Iterable<string>,
): { sku: string; slug: string } {
  const skuOccupati = new Set(skuUsati).add(sku);
  const slugOccupati = new Set(slugUsati).add(slug);
  for (let n = 1; ; n++) {
    const numero = n === 1 ? "" : String(n);
    const codaSku = `-COPIA${numero}`;
    const codaSlug = `-copia${numero}`;
    const candidatoSku = sku.slice(0, MAX_SKU - codaSku.length) + codaSku;
    const candidatoSlug = slug.slice(0, MAX_SLUG - codaSlug.length).replace(/-+$/, "") + codaSlug;
    if (!skuOccupati.has(candidatoSku) && !slugOccupati.has(candidatoSlug))
      return { sku: candidatoSku, slug: candidatoSlug };
  }
}

/* ══ I RIEPILOGHI DELLE AZIONI DI GRUPPO ════════════════════════════════════ */

export interface Fuori {
  id: string;
  nome: string;
  motivo: string;
}
export interface Riepilogo {
  riga: string;
  cambiati: number;
  fuori: Fuori[];
}

const nomeDi = (nomi: Record<string, string>, id: string): string =>
  Object.hasOwn(nomi, id) && nomi[id] ? nomi[id] : "Un prodotto che non è più nell'elenco";
const unaVoltaOMolte = (n: number, uno: string, molti: string): string =>
  `${n} ${n === 1 ? uno : molti}`;
const eOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Dice quanti sono cambiati, quanti c'erano già così e chi è rimasto fuori, con il perché (la frase la scrive il server). */
export function riepilogoGruppo(
  azione: "pubblicato" | "bozza",
  ids: readonly string[],
  dati: unknown,
  nomi: Record<string, string>,
): Riepilogo {
  const d = eOggetto(dati) ? dati : {};
  const n = d[azione === "pubblicato" ? "pubblicati" : "bozze"];
  const cambiati = typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : 0;
  const fuori: Fuori[] = (Array.isArray(d.restano) ? d.restano : []).flatMap((x: unknown) =>
    eOggetto(x) && typeof x.id === "string"
      ? [
          {
            id: x.id,
            nome: nomeDi(nomi, x.id),
            motivo: typeof x.motivo === "string" && x.motivo ? x.motivo : "Non è stato possibile.",
          },
        ]
      : [],
  );
  const parti = [
    cambiati === 0
      ? azione === "pubblicato"
        ? "Nessun prodotto pubblicato."
        : "Nessun prodotto messo in bozza."
      : unaVoltaOMolte(
          cambiati,
          azione === "pubblicato" ? "prodotto pubblicato" : "prodotto messo in bozza",
          azione === "pubblicato" ? "prodotti pubblicati" : "prodotti messi in bozza",
        ) + ".",
  ];
  const gia = Math.max(0, new Set(ids).size - cambiati - fuori.length);
  if (gia > 0) parti.push(`${gia} ${gia === 1 ? "era già così" : "erano già così"}.`);
  if (fuori.length)
    parti.push(`${fuori.length} ${fuori.length === 1 ? "è rimasto fuori" : "sono rimasti fuori"}:`);
  return { riga: parti.join(" "), cambiati, fuori };
}

/** Come sopra, per «Duplica» (una richiesta per ogni prodotto: l'esito di ognuno). */
export function riepilogoDuplica(
  esiti: readonly { id: string; ok: boolean; frase?: string }[],
  nomi: Record<string, string>,
): Riepilogo {
  const cambiati = esiti.filter((e) => e.ok).length;
  const fuori = esiti.flatMap((e) =>
    e.ok
      ? []
      : [{ id: e.id, nome: nomeDi(nomi, e.id), motivo: e.frase || "Non è stato possibile." }],
  );
  const parti = [
    cambiati === 0
      ? "Nessun prodotto duplicato."
      : `${unaVoltaOMolte(cambiati, "prodotto duplicato", "prodotti duplicati")}.`,
  ];
  if (fuori.length)
    parti.push(`${fuori.length} ${fuori.length === 1 ? "è rimasto fuori" : "sono rimasti fuori"}:`);
  return { riga: parti.join(" "), cambiati, fuori };
}

/* ══ IL PREZZO ══════════════════════════════════════════════════════════════ */

/** «€ 12,90» da centesimi. Un numero storto vale zero (mai «NaN» a schermo). */
export function prezzoDaCent(cent: number): string {
  const euro = Number.isFinite(cent) ? cent / 100 : 0;
  return `€ ${euro.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
