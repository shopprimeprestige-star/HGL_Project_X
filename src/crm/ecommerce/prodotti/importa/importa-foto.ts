/** ── LE FOTO DELL'IMPORT, CARICATE DAL BROWSER (importa-foto.ts) ───────────────
 *  Commessa 2026-11-25-editor-prodotti, E13. Dopo i prodotti, le foto del CSV di Shopify (lette da `csv-prodotti.ts`, mai mandate al server
 *  con i prodotti) salgono dal browser con la STESSA pipeline della scheda: scarico → `controllaFile` → preparo (le tre misure di EditorMedia)
 *  → `nuovoLavoro` → `eseguiLavoro` con le stesse porte di caricamento. Le porte arrivano da fuori (`foto-browser.ts`): qui niente React.
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · Vale per i prodotti creati e per i «già presenti» che NON hanno foto (principale e foto2..foto5): uno che ne ha già si salta tutto,
 *    così niente viene sostituito. Se non riesco a leggerne la scheda non carico niente su di lui (si riprova).
 *  · Posizione 1 → principale, 2..5 → foto2..foto5. Alt del file se valido, altrimenti `altProposto`. Nessuna persona ritratta.
 *  · Due prodotti alla volta, le foto di un prodotto una dopo l'altra (il server dà l'ordine in arrivo). Una foto fallita non ferma le altre.
 *  · «Riprova» rifà solo le non riuscite (e le ferme dopo «Interrompi»): un lavoro a metà riparte da dove era; dopo 3 tentativi si riscarica.
 *  · Si scarica SOLO da `HOST_FOTO` (https, cdn.shopify.com), senza credenziali: è l'unico `fetch(` di `prodotti/`. Nessun log, mai. */
import { controllaFile } from "@/crm/negozio/ridimensiona";
import { urlFotoAmmesso, type FotoImport } from "@/crm/negozio/csv-prodotti";
import type { Media } from "@/shop/cms/modello";
import {
  GALLERIA,
  altProposto,
  controllaAlt,
  eseguiLavoro,
  mediaPerSlot,
  nuovoLavoro,
  type FileDaCaricare,
  type Lavoro,
  type PorteCarico,
  type SlotEditor,
} from "../media-puro";
import type { Analisi } from "./importa-analisi";
import type { StatoImporta } from "./importa-flusso";

/** Prodotti lavorati insieme (le foto di uno stesso prodotto vanno sempre una alla volta). */
export const IN_PARALLELO = 2;
const SLOT_FOTO: readonly SlotEditor[] = ["principale", ...GALLERIA];
const CENTO = 100;

const FRASE_HOST = "Foto saltata: l'indirizzo non è di Shopify.";
const FRASE_SCARICA = "Non riesco a scaricare la foto da Shopify: riprova.";
const FRASE_SCHEDA = "Non riesco a sapere se il prodotto ha già delle foto: riprova.";
const FRASE_HA_FOTO = "Il prodotto ha già delle foto: non le tocco.";
const FRASE_PREPARA = "Non sono riuscito a preparare la foto.";

export interface PorteFoto {
  /** Lo scaricamento (vero: `scaricaFoto`). */
  scarica(url: string): Promise<Blob>;
  /** Le tre misure pronte da caricare (vero: `fotoDaCaricare` di EditorMedia). */
  prepara(blob: Blob): Promise<FileDaCaricare[]>;
  /** Le porte di caricamento di EditorMedia (`porte(esegui)`). */
  carico: PorteCarico;
  /** I media della scheda; `null` se non riesco a leggerla. */
  media(prodottoId: string): Promise<readonly Media[] | null>;
}

export interface VoceFoto {
  posizione: number;
  slot: SlotEditor;
  url: string;
  alt: string;
  stato: "da_fare" | "fatta" | "fallita" | "saltata";
  frase: string | null;
  /** Il caricamento a passi: ricorda cosa è già salito. */
  lavoro: Lavoro | null;
}
export interface ProdottoFoto {
  prodottoId: string;
  handle: string;
  nome: string;
  giaPresente: boolean;
  /** Già presente: so che non aveva foto (non si rilegge la scheda a ogni «Riprova»). */
  controllato: boolean;
  foto: VoceFoto[];
}
export interface StatoFoto {
  prodotti: ProdottoFoto[];
}

type PerAnteprima = Pick<Analisi, "nuovi" | "giaPresenti" | "dalCestino"> & {
  lettura: {
    prodotti: readonly { handle: string; titolo: string }[];
    foto: Map<string, FotoImport[]>;
  };
};

/** Quante foto potrei caricare (passo 2): quelle dei nuovi, dei già presenti e di chi torna dal Cestino; chi ha già foto si saprà dopo. */
export const fotoPreviste = (a: PerAnteprima): number =>
  [
    ...a.nuovi.map((p) => p.handle),
    ...a.giaPresenti.map((g) => g.handle),
    ...a.dalCestino.map((g) => g.handle),
  ].reduce((n, h) => n + (a.lettura.foto.get(h)?.length ?? 0), 0);

/** Chi riceve le foto: i creati e i già presenti detti dal server, quelli tornati in bozza dal Cestino (solo i pezzi andati), poi i già presenti
 *  dell'anteprima. Mai due volte lo stesso. */
export function avviaFoto(
  a: PerAnteprima,
  s: Pick<StatoImporta, "gruppi" | "ripristino">,
): StatoFoto {
  const titolo = new Map(a.lettura.prodotti.map((p) => [p.handle, p.titolo]));
  const chi: { handle: string; prodottoId: string; giaPresente: boolean }[] = [];
  for (const g of s.gruppi)
    for (const r of g.risultati)
      if (r.esito !== "errore" && r.prodottoId)
        chi.push({
          handle: r.handle,
          prodottoId: r.prodottoId,
          giaPresente: r.esito === "gia_presente",
        });
  for (const p of s.ripristino)
    if (p.stato === "fatto")
      for (const x of p.prodotti)
        if (!p.restano.some((y) => y.handle === x.handle)) chi.push({ ...x, giaPresente: true });
  for (const g of a.giaPresenti) chi.push({ ...g, giaPresente: true });
  const visti = new Set<string>();
  const prodotti: ProdottoFoto[] = [];
  for (const c of chi) {
    const elenco = a.lettura.foto.get(c.handle) ?? [];
    if (visti.has(c.prodottoId) || elenco.length === 0) continue;
    visti.add(c.prodottoId);
    prodotti.push({
      ...c,
      nome: titolo.get(c.handle) ?? c.handle,
      controllato: false,
      foto: elenco.slice(0, SLOT_FOTO.length).map((f, i) => ({
        posizione: i + 1,
        slot: SLOT_FOTO[i],
        url: f.url,
        alt: f.alt,
        stato: "da_fare",
        frase: null,
        lavoro: null,
      })),
    });
  }
  return { prodotti };
}

/** Ha già una foto principale o della galleria (i posti che l'import scriverebbe)? */
const haGiaFoto = (media: readonly Media[]): boolean => {
  const occupati = mediaPerSlot(media);
  return SLOT_FOTO.some((s) => occupati.has(s));
};

/** Carica le foto «da fare». Non lancia mai. `interrompi` si guarda prima di ogni foto. */
export async function eseguiFoto(
  inizio: StatoFoto,
  porte: PorteFoto,
  opz: { interrompi?: () => boolean; aggiorna?: (s: StatoFoto) => void } = {},
): Promise<StatoFoto> {
  // Una copia: lo stato di prima non cambia (i `Lavoro` sì, di proposito: ricordano cosa è già salito).
  const s: StatoFoto = {
    prodotti: inizio.prodotti.map((p) => ({ ...p, foto: p.foto.map((v) => ({ ...v })) })),
  };
  const avvisa = () => opz.aggiorna?.({ prodotti: [...s.prodotti] });
  const fermo = () => opz.interrompi?.() === true;
  const chiudi = (p: ProdottoFoto, stato: VoceFoto["stato"], frase: string) => {
    for (const v of p.foto) if (v.stato === "da_fare") Object.assign(v, { stato, frase });
    avvisa();
  };

  async function una(p: ProdottoFoto, v: VoceFoto): Promise<void> {
    try {
      if (!v.lavoro) {
        if (!urlFotoAmmesso(v.url))
          return void Object.assign(v, { stato: "fallita", frase: FRASE_HOST });
        const blob = await porte.scarica(v.url);
        const idoneo = controllaFile({ tipo: "foto", mime: blob.type, byte: blob.size });
        if (!idoneo.ok) return void Object.assign(v, { stato: "fallita", frase: idoneo.frase });
        const alt = controllaAlt(v.alt);
        v.lavoro = nuovoLavoro({
          prodottoId: p.prodottoId,
          slot: v.slot,
          sottoRuolo: null,
          alt: alt.ok ? alt.alt : altProposto(p.nome, v.slot, null),
          tipo: "foto",
          file: await porte.prepara(blob),
          durataS: null,
          muto: false,
          testoParlato: null,
          ritraePersone: false,
          liberatoriaOk: false,
          sottotitoliOk: false,
        });
      }
      const esito = await eseguiLavoro(v.lavoro, porte.carico);
      Object.assign(
        v,
        //  Fatta: le tre misure (decine di MB su 155 foto) si lasciano andare subito.
        esito.ok
          ? { stato: "fatta", frase: null, lavoro: null }
          : { stato: "fallita", frase: esito.frase },
      );
    } catch (e) {
      Object.assign(v, {
        stato: "fallita",
        frase: e instanceof Error && e.message ? e.message : FRASE_PREPARA,
      });
    }
  }

  async function prodotto(p: ProdottoFoto): Promise<void> {
    if (!p.foto.some((v) => v.stato === "da_fare")) return;
    if (p.giaPresente && !p.controllato) {
      if (fermo()) return;
      let media: readonly Media[] | null = null;
      try {
        media = await porte.media(p.prodottoId);
      } catch {
        media = null;
      }
      if (!media) return chiudi(p, "fallita", FRASE_SCHEDA);
      p.controllato = true;
      if (haGiaFoto(media)) return chiudi(p, "saltata", FRASE_HA_FOTO);
    }
    for (const v of p.foto) {
      if (v.stato !== "da_fare") continue;
      if (fermo()) return;
      await una(p, v);
      avvisa();
    }
  }

  let prossimo = 0;
  const operaio = async () => {
    while (prossimo < s.prodotti.length && !fermo()) await prodotto(s.prodotti[prossimo++]);
  };
  await Promise.all(Array.from({ length: IN_PARALLELO }, operaio));
  return s;
}

/** «Riprova»: le non riuscite tornano da fare; un lavoro che ha finito i 3 tentativi riparte dallo scaricamento. */
export const riprovaFoto = (s: StatoFoto): StatoFoto => ({
  prodotti: s.prodotti.map((p) => ({
    ...p,
    foto: p.foto.map((v) =>
      v.stato === "fallita"
        ? {
            ...v,
            stato: "da_fare" as const,
            frase: null,
            lavoro: v.lavoro?.finale ? null : v.lavoro,
          }
        : v,
    ),
  })),
});

export function avanzamentoFoto(s: StatoFoto): {
  fatte: number;
  totale: number;
  caricate: number;
  nonRiuscite: number;
  saltate: number;
  daFare: number;
  percento: number;
} {
  const voci = s.prodotti.flatMap((p) => p.foto);
  const conta = (x: VoceFoto["stato"]) => voci.filter((v) => v.stato === x).length;
  const daFare = conta("da_fare");
  const totale = voci.length;
  return {
    fatte: totale - daFare,
    totale,
    caricate: conta("fatta"),
    nonRiuscite: conta("fallita"),
    saltate: conta("saltata"),
    daFare,
    percento: totale === 0 ? CENTO : Math.floor(((totale - daFare) * CENTO) / totale),
  };
}

/** Le foto non riuscite, per l'elenco: prodotto, posizione (1 = principale) e la frase. */
export const nonRiuscite = (s: StatoFoto): { nome: string; posizione: number; frase: string }[] =>
  s.prodotti.flatMap((p) =>
    p.foto
      .filter((v) => v.stato === "fallita")
      .map((v) => ({ nome: p.nome, posizione: v.posizione, frase: v.frase ?? FRASE_PREPARA })),
  );

/** «Foto caricate N · non riuscite M» */
export const fraseFoto = (a: { caricate: number; nonRiuscite: number }): string =>
  `Foto caricate ${a.caricate} · non riuscite ${a.nonRiuscite}`;

/** Lo scaricamento vero: solo da `HOST_FOTO`, senza credenziali; anche l'indirizzo d'arrivo (dopo un rimbalzo) deve essere ammesso. */
export async function scaricaFoto(url: string): Promise<Blob> {
  if (!urlFotoAmmesso(url)) throw new Error(FRASE_HOST);
  let r: Response;
  try {
    r = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new Error(FRASE_SCARICA);
  }
  if (!r.ok || (r.url && !urlFotoAmmesso(r.url))) throw new Error(FRASE_SCARICA);
  try {
    return await r.blob();
  } catch {
    throw new Error(FRASE_SCARICA);
  }
}
