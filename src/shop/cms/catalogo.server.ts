/** ── LE LETTURE PUBBLICHE DEL CATALOGO, CON MEMORIA BREVE ───────────────────
 *  Commessa 2026-11-20-shop-completo (T11). Tutto ciò che il sito pubblico legge del catalogo, TRANNE il collegamento
 *  a Supabase e alle variabili d'ambiente (stanno in `catalogo.functions.ts`): qui si ricevono PORTE, così si prova
 *  con un finto database, senza rete e senza chiavi. Importabile senza ambiente.
 *
 *  ⚠️ D1: fuori dall'anteprima si leggono SOLO le quattro viste `shop_v_*` (e `shop_impostazioni`, l'interruttore:
 *   una riga sola, nessun dato privato). Le tabelle del catalogo si leggono in un punto solo, `leggiPerAnteprima`,
 *   raggiungibile solo dopo `verificaChiaveAnteprima`. Una prova sul sorgente lo controlla (i segnaposto «TABELLE»).
 *  ⚠️ Un guasto del database NON rompe mai una pagina pubblica: ogni funzione risponde `codice` / vuoto / `null` / «non più
 *   disponibile», mai un'eccezione. Nel log solo CODICI (mai righe o testi). Un guasto non si ricorda per 30 secondi.
 *  ⚠️ Memoria: il catalogo pubblico si legge una volta ogni 30 s (tutte le funzioni la condividono), la modalità ogni 15 s.
 *   Con il CDN (altri 30 s, vedi `catalogo.functions.ts`) una modifica si vede entro 60 s. La scheda con la chiave
 *   d'anteprima NON passa dalla memoria, né ci scrive.
 *  ⚠️ La ricerca si fa in memoria: il testo scritto da chi visita non entra mai in una query. */
import { verificaChiaveAnteprima } from "./anteprima";
import { slugValido, type CategoriaPubblica, type ProdottoPubblico, type SrcFoto } from "./modello";
import { costruisciCategorie, costruisciPubblico } from "./pubblico";
import { righeDi, testo } from "./righe";
import { vociSitemapShop, type VoceShop } from "./sitemap";

/* ══ LE PORTE ═══════════════════════════════════════════════════════════════ */

interface EsitoDb {
  data: unknown;
  error: { code?: unknown } | null;
}
/** Il pezzo di costruttore di query di Supabase che serve qui: il finto delle prove ne ha lo stesso aspetto. */
export interface Interrogazione extends PromiseLike<EsitoDb> {
  eq(colonna: string, valore: unknown): Interrogazione;
  maybeSingle(): Interrogazione;
}
export interface ClienteDb {
  from(tabella: string): { select(colonne?: string): Interrogazione };
}
export interface PorteCatalogo {
  db: ClienteDb;
  /** Millisecondi (`Date.now()`); le prove usano un orologio finto. */
  adesso: () => number;
  /** Dove stanno le foto: `<SUPABASE_URL>/storage/v1/object/public/shop-media`. */
  baseMedia: string;
  /** La chiave di servizio, SOLO per verificare le chiavi d'anteprima (mai letta da altre parti). Senza, l'anteprima non apre. */
  chiaveServizio?: string | null;
  /** `SHOP_CATALOGO_FORZA`: «cms» o «codice» forza la modalità e nient'altro; ogni altro valore si ignora. */
  forza?: string | null;
  /** Solo CODICI di errore. */
  log?: (codice: string) => void;
}

export type Modalita = "codice" | "cms";
/** Una riga del carrello com'è oggi sul server: il prezzo è quello di adesso, non quello di quando è stata aggiunta. */
export type RigaCarrelloServer =
  | { sku: string; nome: string; varianteNome: string | null; prezzoCent: number; disponibile: boolean; foto: SrcFoto | null; slug: string }
  | { sku: string; nonPiuDisponibile: true };
export interface FiltriElenco {
  categoria?: string;
  q?: string;
}

const MEMORIA_CATALOGO_MS = 30_000;
const MEMORIA_MODALITA_MS = 15_000;
const MAX_SKU_CARRELLO = 50;
const MAX_TESTO_RICERCA = 80;

interface Caricato {
  prodotti: ProdottoPubblico[];
  categorie: CategoriaPubblica[];
  /** Le righe delle viste, per la sitemap. */
  righe: { prodotti: unknown[]; categorie: unknown[] };
}

export function creaCatalogo(porte: PorteCatalogo) {
  const { db, adesso, baseMedia } = porte;
  const segnala = (e: unknown) => {
    const codice = (e as { code?: unknown } | null)?.code;
    const nome = e instanceof Error ? e.name : "errore";
    const t = String(typeof codice === "string" || typeof codice === "number" ? codice : nome);
    porte.log?.(/^[A-Za-z0-9_.:-]{1,40}$/.test(t) ? t : "errore");
  };
  const leggi = async (tabella: string): Promise<Record<string, unknown>[]> => {
    const r = await db.from(tabella).select("*");
    if (r.error) throw r.error;
    return righeDi(r.data);
  };

  /* ── la modalità: codice o cms ── */
  let memModalita: { t: number; p: Promise<Modalita> } | null = null;
  async function leggiModalita(): Promise<Modalita> {
    if (porte.forza === "cms" || porte.forza === "codice") return porte.forza;
    try {
      const r = await db.from("shop_impostazioni").select("valore").eq("chiave", "catalogo_sito").maybeSingle();
      if (r.error) throw r.error;
      return (r.data as { valore?: unknown } | null)?.valore === "cms" ? "cms" : "codice";
    } catch (e) {
      segnala(e);
      return "codice";
    }
  }
  const modalita = (): Promise<Modalita> => {
    const n = adesso();
    if (!memModalita || n - memModalita.t >= MEMORIA_MODALITA_MS || n < memModalita.t) memModalita = { t: n, p: leggiModalita() };
    return memModalita.p;
  };

  /* ── il catalogo pubblico: dalle quattro viste, una volta ogni 30 s ── */
  async function carica(): Promise<Caricato> {
    const [prodotti, varianti, media, categorie] = await Promise.all(["shop_v_prodotti", "shop_v_varianti", "shop_v_media", "shop_v_categorie"].map(leggi));
    return {
      prodotti: costruisciPubblico({ prodotti, varianti, media }, { baseMedia }),
      categorie: costruisciCategorie({ categorie, media }, { baseMedia }),
      righe: { prodotti, categorie },
    };
  }
  let mem: { t: number; p: Promise<Caricato> } | null = null;
  const dati = (): Promise<Caricato> => {
    const n = adesso();
    if (!mem || n - mem.t >= MEMORIA_CATALOGO_MS || n < mem.t) {
      const voce = { t: n, p: carica() };
      mem = voce;
      // un guasto non si ricorda: la lettura dopo riprova
      voce.p.catch((e) => {
        segnala(e);
        if (mem === voce) mem = null;
      });
    }
    return mem.p;
  };

  // «TABELLE-INIZIO» ── l'UNICO punto che legge le tabelle del catalogo: l'anteprima, dopo la chiave ───────────────────
  // shortcut: legge le tabelle intere e ne tira fuori una scheda (il catalogo è di decine di prodotti, e succede solo con la chiave in mano); si cambia quando i prodotti sono migliaia.
  async function leggiPerAnteprima(slug: string): Promise<ProdottoPubblico | null> {
    const [prodotti, varianti, media, categorie, prodottiCategorie] = await Promise.all(
      ["shop_prodotti", "shop_varianti", "shop_media", "shop_categorie", "shop_prodotti_categorie"].map(leggi),
    );
    return costruisciPubblico({ prodotti, varianti, media, categorie, prodottiCategorie }, { baseMedia, anteprima: { slug } }).find((p) => p.slug === slug) ?? null;
  }
  // «TABELLE-FINE» ────────────────────────────────────────────────────────────────────────────────────────────────────

  /* ── le funzioni pubbliche ── */
  async function elenco(filtri?: FiltriElenco): Promise<ProdottoPubblico[]> {
    try {
      const { prodotti } = await dati();
      const categoria = testo(filtri?.categoria);
      const q = testo(filtri?.q)?.slice(0, MAX_TESTO_RICERCA).toLowerCase();
      return prodotti.filter((p) => (!categoria || p.categorie.some((c) => c.slug === categoria)) && (!q || p.nome.toLowerCase().includes(q)));
    } catch {
      return [];
    }
  }

  async function scheda(slug: unknown, chiaveAnteprima?: unknown): Promise<ProdottoPubblico | null> {
    try {
      if (typeof slug !== "string" || !slugValido(slug)) return null;
      if (typeof chiaveAnteprima === "string" && chiaveAnteprima && (await verificaChiaveAnteprima(porte.chiaveServizio, slug, chiaveAnteprima, adesso()))) {
        return await leggiPerAnteprima(slug);
      }
      return (await dati()).prodotti.find((p) => p.slug === slug) ?? null;
    } catch (e) {
      segnala(e);
      return null;
    }
  }

  async function categorie(): Promise<CategoriaPubblica[]> {
    try {
      return (await dati()).categorie;
    } catch {
      return [];
    }
  }

  async function vociSitemap(): Promise<VoceShop[]> {
    try {
      // con il catalogo «codice» il sito non serve queste pagine: non si promettono ai motori di ricerca
      if ((await modalita()) !== "cms") return [];
      return vociSitemapShop((await dati()).righe);
    } catch {
      return [];
    }
  }

  async function righeCarrello(skus: unknown): Promise<RigaCarrelloServer[]> {
    const chiesti = Array.isArray(skus) ? [...new Set(skus.flatMap((s) => testo(s) ?? []))].slice(0, MAX_SKU_CARRELLO) : [];
    let prodotti: ProdottoPubblico[] = [];
    try {
      prodotti = (await dati()).prodotti;
    } catch {
      /* tutto «non più disponibile» */
    }
    return chiesti.map((sku): RigaCarrelloServer => {
      for (const p of prodotti) {
        const v = p.varianti.find((x) => x.sku === sku);
        if (v) return { sku, nome: p.nome, varianteNome: v.nome === v.sku ? null : v.nome, prezzoCent: v.prezzoCent, disponibile: v.disponibile, foto: p.media.find((m) => m.slot === "principale")?.src ?? null, slug: p.slug };
      }
      return { sku, nonPiuDisponibile: true };
    });
  }

  return { modalita, elenco, scheda, categorie, vociSitemap, righeCarrello };
}
export type Catalogo = ReturnType<typeof creaCatalogo>;
