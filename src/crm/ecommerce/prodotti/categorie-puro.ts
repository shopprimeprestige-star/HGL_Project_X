/** ── LE CATEGORIE: LE REGOLE SENZA SCHERMO (categorie-puro.ts) ────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T17 (Design §4.10.5, D36). Legge l'elenco che `?categorie` risponde, sposta una riga,
 *  dice perché una categoria è «Nascosta dal sito», e costruisce il corpo di `categoria_salva` e `categoria_foto`.
 *  Si prova da solo (prove/negozio/categorie-sorgente.mjs). Niente rete, niente React. */
import { slugValido, TETTI } from "@/shop/cms/modello";

export const ETICHETTA_NASCOSTA = "Nascosta dal sito";
export const MAX_NOME = 60;
export const MAX_FRASE = 200;

export interface CategoriaVista {
  id: string;
  slug: string;
  nome: string;
  tipo: string;
  frase: string | null;
  /** Il puntatore alla foto (la misura da 960). */
  fotoPath: string | null;
  ordine: number;
  visibile: boolean;
  /** Da rimandare al server quando si modifica (`aggiornato_il`). */
  versione: string | null;
  /** Prodotti PUBBLICATI della categoria. */
  quanti: number;
  /** L'indirizzo non si cambia più: la categoria è già uscita sul sito. */
  slugBloccato: boolean;
}

const eOggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const testoOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** L'elenco nell'ordine del server. `null` se la risposta non è un elenco (non si finge «nessuna categoria»). */
export function leggiCategorie(dati: unknown): CategoriaVista[] | null {
  if (!eOggetto(dati) || !Array.isArray(dati.categorie)) return null;
  return dati.categorie.flatMap((r): CategoriaVista[] => {
    if (!eOggetto(r) || typeof r.id !== "string" || !r.id || typeof r.nome !== "string" || typeof r.slug !== "string") return [];
    return [
      {
        id: r.id,
        slug: r.slug,
        nome: r.nome,
        tipo: typeof r.tipo === "string" ? r.tipo : "categoria",
        frase: testoOrNull(r.frase),
        fotoPath: testoOrNull(r.fotoPath),
        ordine: typeof r.ordine === "number" ? r.ordine : 0,
        visibile: r.visibile === true,
        versione: testoOrNull(r.versione),
        quanti: typeof r.quanti === "number" && Number.isSafeInteger(r.quanti) && r.quanti > 0 ? r.quanti : 0,
        //  Se la bandiera manca ma c'è la data di pubblicazione, l'indirizzo è bloccato: nel dubbio si blocca.
        slugBloccato: r.slugBloccato === true || (r.slugBloccato === undefined && testoOrNull(r.pubblicataIl) !== null),
      },
    ];
  });
}

/** L'elenco degli id dopo aver spostato la riga `da` di una posizione (−1 su, +1 giù). `null` se non si può (bordo, indice storto). */
export function spostaId(ids: readonly string[], da: number, verso: -1 | 1): string[] | null {
  const a = da + verso;
  if (!Number.isInteger(da) || da < 0 || da >= ids.length || a < 0 || a >= ids.length) return null;
  const nuovo = [...ids];
  [nuovo[da], nuovo[a]] = [nuovo[a], nuovo[da]];
  return nuovo;
}

/** Perché il sito non mostra la categoria; `null` se la mostra. */
export function motivoNascosta(c: Pick<CategoriaVista, "visibile" | "quanti">): string | null {
  if (!c.visibile) return "È spenta: accendila per farla comparire sul sito.";
  if (c.quanti === 0) return "Non ha ancora prodotti pubblicati.";
  return null;
}

export const fraseProdotti = (n: number): string => `${n} ${n === 1 ? "prodotto pubblicato" : "prodotti pubblicati"}`;

/** L'indirizzo della miniatura: base dello Storage + percorso. Senza base o con un percorso che esce dalla cartella, niente foto. */
export function urlFoto(base: string | undefined, path: string | null): string | null {
  if (!base || !path || /^\/|\.\.|\\|:/.test(path)) return null;
  return `${base.replace(/\/+$/, "")}/${path}`;
}

/* ── la foto in tre misure (D36) ─────────────────────────────────────── */

export interface PercorsiFoto {
  path480: string;
  path960: string;
  path1600: string;
}
/** I file prodotti da `disegnaMisure` (uno per misura, `per` = i nomi che serve) e i loro percorsi, nello stesso ordine → i tre nomi. */
export function assegnaPercorsi(misure: ReadonlyArray<{ per: readonly number[] }>, percorsi: readonly string[]): PercorsiFoto | null {
  if (misure.length !== percorsi.length) return null;
  const per: Record<number, string> = {};
  misure.forEach((m, i) => m.per.forEach((n) => (per[n] = percorsi[i])));
  return per[480] && per[960] && per[1600] ? { path480: per[480], path960: per[960], path1600: per[1600] } : null;
}

/** Il corpo di `categoria_foto`; `null` se manca la versione o l'alt (obbligatorio, al massimo 125 segni). */
export function corpoFoto(c: Pick<CategoriaVista, "id" | "versione">, percorsi: PercorsiFoto, alt: string): Record<string, unknown> | null {
  const testo = alt.trim();
  if (!c.versione || !testo || testo.length > TETTI.alt) return null;
  return { categoriaId: c.id, ...percorsi, alt: testo, versione: c.versione };
}

/* ── il salvataggio di nome, indirizzo e frase ───────────────────────── */

/** `categoria_salva`. Nuova (`c` nullo): nome, indirizzo, frase. Esistente: `id` e `versione`, e lo `slug` solo se non è bloccato. */
export function corpoSalva(
  c: Pick<CategoriaVista, "id" | "versione" | "slugBloccato"> | null,
  campi: { nome: string; slug: string; frase: string },
): Record<string, unknown> | { errore: string } {
  const nome = campi.nome.trim();
  const slug = campi.slug.trim();
  const frase = campi.frase.trim();
  if (!nome) return { errore: "Scrivi il nome della categoria." };
  if (nome.length > MAX_NOME) return { errore: `Il nome può avere al massimo ${MAX_NOME} caratteri.` };
  if (frase.length > MAX_FRASE) return { errore: `La frase può avere al massimo ${MAX_FRASE} caratteri.` };
  const mandaSlug = !c || !c.slugBloccato;
  if (mandaSlug && !slugValido(slug)) return { errore: "L'indirizzo non è valido: solo lettere minuscole, numeri e trattini." };
  if (!c) return { nome, slug, ...(frase && { frase }) };
  if (!c.versione) return { errore: "Manca la versione della categoria: aggiorna l'elenco e riprova." };
  return { id: c.id, versione: c.versione, nome, ...(mandaSlug && { slug }), frase: frase || null };
}
