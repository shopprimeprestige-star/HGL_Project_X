/** ── L'ANTEPRIMA DELL'IMPORT: DAL FILE AL CONFRONTO COL CATALOGO (importa-analisi.ts) ──
 *  Commessa 2026-11-25-editor-prodotti, E10 (SPEC §2.3, §6.4). Legge il file (limiti prima, poi i byte), chiede al server SOLO la verifica
 *  (indirizzi e SKU, sola lettura: nessuna scrittura) e costruisce l'anteprima: nuovi, già presenti, dal Cestino (E15: archiviati, tornano in bozza), errori riga per riga, tabella, riepilogo.
 *  Puro: la rete arriva da fuori come funzione `esegui` (quella di `negozio`). Lo usa `importa-flusso.ts` (che lo ri-esporta). Nessun log, mai. */
import { controllaFile, leggiCsv } from "@/crm/negozio/csv-lettore";
import { leggiProdottiCsv, type LetturaProdotti } from "@/crm/negozio/csv-prodotti";
import {
  type AvvisoRiga,
  type ErroreRiga,
  type ProdottoImport,
  type RispostaVerifica,
} from "@/crm/negozio/import-contratto";
import { confrontaConCatalogo, descriviErrore } from "@/crm/negozio/import-regole";

export const AZIONE_VERIFICA = "prodotti_importa_verifica";
/** Quando il database non ha ancora la funzione dell'import: il tasto resta spento e si dice perché. */
export const FRASE_NON_DISPONIBILE = "Per importare serve un aggiornamento del database.";
export const FRASE_RISPOSTA =
  "Il server ha risposto in modo che non capisco: riprova tra un momento.";
/** Gli SKU per richiesta di verifica (il server li spezza ancora in query da 100). */
const SKU_PER_VERIFICA = 400;

/** Come risponde `negozio.esegui`: tutto ciò che il server dice oltre a `ok`, oppure l'errore con la sua frase. */
export type EsitoEsegui =
  | { ok: true; dati: Record<string, unknown> }
  | { ok: false; errore: { tipo: string; messaggio: string } };
export type Esegui = (azione: string, dati?: Record<string, unknown>) => Promise<EsitoEsegui>;

export const eOggetto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
export const eTesto = (x: unknown): x is string => typeof x === "string";
const plurale = (n: number, uno: string, molti: string): string => `${n} ${n === 1 ? uno : molti}`;

/* ══ L'ANTEPRIMA DAL FILE ═══════════════════════════════════════════════════ */

/** Un file come lo dà il browser (`File`): serve solo il nome, la dimensione e i byte. */
export interface FileScelto {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface RigaTabella {
  /** La prima riga del prodotto nel file (come la vede Excel). */
  riga: number;
  handle: string;
  titolo: string;
  tipo?: string;
  prezzoCent?: number;
  varianti?: number;
  giacenza?: number;
  esito: "nuovo" | "presente" | "cestino" | "errore";
  /** Solo per «presente» e «cestino»: per aprire il prodotto che c'è già. */
  prodottoId?: string;
}

export interface Analisi {
  nomeFile: string;
  separatore: "," | ";";
  /** Le righe del file: servono a «Scarica le righe da correggere». Restano in memoria, mai su disco. */
  record: string[][];
  lettura: LetturaProdotti;
  nuovi: ProdottoImport[];
  /** Già presenti e NON nel Cestino: si saltano. */
  giaPresenti: { handle: string; prodottoId: string; nome: string }[];
  /** Con l'indirizzo di un prodotto archiviato (E15): all'import tornano in bozza, senza toccare i loro dati. */
  dalCestino: { handle: string; prodottoId: string; nome: string }[];
  /** Ogni errore, riga per riga: quelli del file e quelli dello SKU già usato da un altro prodotto. */
  errori: ErroreRiga[];
  nProdottiConErrori: number;
  /** Gli avvisi del file (codifica, colonne ignorate…) e dei prodotti: non bloccano. */
  avvisi: AvvisoRiga[];
  righe: RigaTabella[];
  importaDisponibile: boolean;
}

/** Controlla la forma della verifica (il server è affidabile, la rete no): se non torna, niente anteprima. */
function leggiVerifica(d: Record<string, unknown>): RispostaVerifica | null {
  const { presenti, skuUsati, categorie } = d;
  if (
    !Array.isArray(presenti) ||
    !Array.isArray(skuUsati) ||
    !Array.isArray(categorie) ||
    typeof d.importaDisponibile !== "boolean"
  )
    return null;
  const bene =
    presenti.every(
      (x) => eOggetto(x) && eTesto(x.id) && eTesto(x.slug) && eTesto(x.nome) && eTesto(x.stato),
    ) &&
    skuUsati.every(
      (x) =>
        eOggetto(x) &&
        eTesto(x.sku) &&
        eTesto(x.prodottoId) &&
        eTesto(x.prodottoNome) &&
        typeof x.comeVariante === "boolean",
    ) &&
    categorie.every((x) => eOggetto(x) && eTesto(x.id) && eTesto(x.slug) && eTesto(x.nome));
  return bene ? (d as unknown as RispostaVerifica) : null;
}

/** Chiede al server (sola lettura) chi esiste già. A pezzi da 400 SKU; gli indirizzi (al massimo 300) viaggiano nel primo. */
async function verifica(
  prodotti: readonly ProdottoImport[],
  esegui: Esegui,
): Promise<{ ok: true; v: RispostaVerifica } | { ok: false; frase: string }> {
  const slugs = prodotti.map((p) => p.handle);
  const skus = [...new Set(prodotti.flatMap((p) => p.varianti.map((v) => v.sku)))];
  const unita: RispostaVerifica = {
    presenti: [],
    skuUsati: [],
    categorie: [],
    costoDisponibile: true,
    importaDisponibile: true,
  };
  for (let da = 0; da === 0 || da < skus.length; da += SKU_PER_VERIFICA) {
    const r = await esegui(AZIONE_VERIFICA, {
      slugs: da === 0 ? slugs : [],
      skus: skus.slice(da, da + SKU_PER_VERIFICA),
    });
    if (!r.ok) return { ok: false, frase: r.errore.messaggio };
    const v = leggiVerifica(r.dati);
    if (!v) return { ok: false, frase: FRASE_RISPOSTA };
    unita.presenti.push(...v.presenti);
    unita.skuUsati.push(...v.skuUsati);
    if (da === 0) unita.categorie = v.categorie;
    unita.costoDisponibile = unita.costoDisponibile && v.costoDisponibile !== false;
    unita.importaDisponibile = unita.importaDisponibile && v.importaDisponibile;
    if (!unita.importaDisponibile) break; // senza la funzione del database non serve chiedere il resto
  }
  return { ok: true, v: unita };
}

/** Dal file all'anteprima. I limiti (2 MB, Excel, 5000 righe, 300 prodotti) si guardano PRIMA di chiamare il server. */
export async function analizzaFile(
  file: FileScelto,
  esegui: Esegui,
): Promise<{ ok: true; analisi: Analisi } | { ok: false; frase: string }> {
  const ammesso = controllaFile(file);
  if (!ammesso.ok) return ammesso;
  let byte: Uint8Array;
  try {
    byte = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, frase: "Non riesco a leggere il file: riprova o scegline un altro." };
  }
  const csv = leggiCsv(byte);
  if (!csv.ok) return csv;

  // Prima lettura senza categorie: serve solo a sapere quali indirizzi e SKU chiedere. La seconda, con le categorie vere, è quella che conta.
  const prima = leggiProdottiCsv(csv.record, { categorie: [] });
  if (prima.conteggi.prodotti === 0)
    return {
      ok: false,
      frase: prima.errori[0] ? descriviErrore(prima.errori[0]) : "Il file non contiene prodotti.",
    };
  let lettura = prima;
  let catalogo: Pick<RispostaVerifica, "presenti" | "skuUsati"> = { presenti: [], skuUsati: [] };
  let importaDisponibile = true;
  if (prima.prodotti.length > 0) {
    const v = await verifica(prima.prodotti, esegui);
    if (!v.ok) return v;
    catalogo = v.v;
    importaDisponibile = v.v.importaDisponibile;
    lettura = leggiProdottiCsv(csv.record, { categorie: v.v.categorie });
  }
  const confronto = confrontaConCatalogo(lettura.prodotti, catalogo);
  const errori = [...lettura.errori, ...confronto.errori].sort((a, b) => a.riga - b.riga);
  const conErrore = new Set(confronto.errori.map((e) => e.handle));
  // Un indirizzo già nel catalogo ma archiviato non è «già presente»: è nel Cestino e torna in bozza (lo slug è unico, non si può ricrearlo).
  const archiviati = new Set(
    catalogo.presenti.filter((x) => x.stato === "archiviato").map((x) => x.slug),
  );
  const dalCestino = confronto.giaPresenti.filter((g) => archiviati.has(g.handle));
  const giaPresenti = confronto.giaPresenti.filter((g) => !archiviati.has(g.handle));
  const presenti = new Map(confronto.giaPresenti.map((g) => [g.handle, g]));
  const righe: RigaTabella[] = [
    ...lettura.prodotti.map(
      (p): RigaTabella => ({
        riga: p.varianti[0]?.riga ?? 0,
        handle: p.handle,
        titolo: p.titolo,
        tipo: p.tipo,
        prezzoCent: p.prezzoCent,
        varianti: p.varianti.length,
        giacenza: p.varianti.reduce((somma, v) => somma + v.giacenza, 0),
        esito: archiviati.has(p.handle)
          ? "cestino"
          : presenti.has(p.handle)
            ? "presente"
            : conErrore.has(p.handle)
              ? "errore"
              : "nuovo",
        prodottoId: presenti.get(p.handle)?.prodottoId,
      }),
    ),
    ...lettura.respinti.map(
      (r): RigaTabella => ({ riga: r.riga, handle: r.handle, titolo: r.titolo, esito: "errore" }),
    ),
  ].sort((a, b) => a.riga - b.riga);
  return {
    ok: true,
    analisi: {
      nomeFile: file.name,
      separatore: csv.separatore,
      record: csv.record,
      lettura,
      nuovi: confronto.nuovi,
      giaPresenti,
      dalCestino,
      errori,
      nProdottiConErrori: lettura.respinti.length + conErrore.size,
      avvisi: [...csv.avvisi.map((frase): AvvisoRiga => ({ riga: 0, frase })), ...lettura.avvisi],
      righe,
      importaDisponibile,
    },
  };
}

export const soloErrori = (righe: readonly RigaTabella[]): RigaTabella[] =>
  righe.filter((r) => r.esito === "errore");

/** «12 prodotti · 41 varianti · 9 nuovi · 3 dal Cestino (tornano in bozza) · 2 già presenti (saltati) · 1 con errori · 5 avvisi»
 *  (le parti a zero non si scrivono, tranne gli errori). */
export function fraseRiepilogo(
  a: Pick<Analisi, "lettura" | "nuovi" | "giaPresenti" | "nProdottiConErrori" | "avvisi"> &
    Partial<Pick<Analisi, "dalCestino">>,
): string {
  const nuovi = a.nuovi.length;
  const cestino = a.dalCestino?.length ?? 0;
  const parti = [
    plurale(a.lettura.conteggi.prodotti, "prodotto", "prodotti"),
    plurale(a.lettura.conteggi.varianti, "variante", "varianti"),
    nuovi > 0 ? plurale(nuovi, "nuovo", "nuovi") : "nessun nuovo",
  ];
  if (cestino > 0)
    parti.push(
      cestino === 1
        ? "1 dal Cestino (torna in bozza)"
        : `${cestino} dal Cestino (tornano in bozza)`,
    );
  if (a.giaPresenti.length > 0)
    parti.push(plurale(a.giaPresenti.length, "già presente (saltato)", "già presenti (saltati)"));
  parti.push(a.nProdottiConErrori > 0 ? `${a.nProdottiConErrori} con errori` : "0 errori");
  if (a.avvisi.length > 0) parti.push(plurale(a.avvisi.length, "avviso", "avvisi"));
  return parti.join(" · ");
}

/** Una riga di errore o di avviso come la legge una persona: «Riga 7 (handle `x`): …» oppure la frase sola se riguarda tutto il file. */
export const frasePerPersona = (e: { riga: number; handle?: string; frase: string }): string =>
  e.riga > 0 ? descriviErrore(e) : e.frase;
