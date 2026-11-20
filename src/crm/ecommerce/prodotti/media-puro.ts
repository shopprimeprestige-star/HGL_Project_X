/** ── FOTO E VIDEO DI UN PRODOTTO: LE REGOLE SENZA SCHERMO (media-puro.ts) ─────
 *  Commessa 2026-11-20-shop-completo, T16 (Design §4.10.3). Niente React, niente browser: si prova con porte finte
 *  (`prove/negozio/media-puro.mjs`). Lo usa `EditorMedia.tsx`.
 *
 *  · Gli SLOT sono fissi: foto principale (obbligatoria), foto 2-5 (col ruolo), foto di scala, video breve, foto della confezione.
 *  · La descrizione per chi non vede è obbligatoria, al massimo 125 segni (come il server).
 *  · Il CARICAMENTO è una sequenza di passi che ricorda a che punto è (`Lavoro`): permesso → invio per ogni file, poi il registro
 *    (`media_registra`), poi (se serve) `media_flag`. Se un passo fallisce, il tentativo dopo riparte da lì e NON rifà ciò che è già
 *    andato. Al massimo 3 tentativi per lavoro: poi si sceglie di nuovo il file. Mai ritentativi da soli.
 *  · Il percorso dei file lo decide il server (`media.server.ts`): qui non compare mai il nome del file di chi carica. */
import { MAX_VIDEO_SECONDI } from "@/crm/negozio/ridimensiona";
import { TETTI, type Media, type Slot, type SottoRuolo } from "@/shop/cms/modello";

export const MAX_ALT = TETTI.alt;
export const MAX_TENTATIVI = 3;
export { MAX_VIDEO_SECONDI };

export type SlotEditor = Extract<
  Slot,
  "principale" | "foto2" | "foto3" | "foto4" | "foto5" | "scala" | "video" | "confezione"
>;
export interface DefSlot {
  slot: SlotEditor;
  etichetta: string;
  obbligatorio: boolean;
  tipo: "foto" | "video";
  /** Una riga che dice a cosa serve (sotto il nome dello slot). */
  aiuto: string;
  /** Si sceglie il ruolo della foto (retro della base, attaccatura…). */
  conRuolo: boolean;
}
export const SLOT_EDITOR: readonly DefSlot[] = [
  {
    slot: "principale",
    etichetta: "Foto principale",
    obbligatorio: true,
    tipo: "foto",
    aiuto: "La prima che si vede sul sito.",
    conRuolo: false,
  },
  {
    slot: "foto2",
    etichetta: "Foto 2",
    obbligatorio: false,
    tipo: "foto",
    aiuto: "",
    conRuolo: true,
  },
  {
    slot: "foto3",
    etichetta: "Foto 3",
    obbligatorio: false,
    tipo: "foto",
    aiuto: "",
    conRuolo: true,
  },
  {
    slot: "foto4",
    etichetta: "Foto 4",
    obbligatorio: false,
    tipo: "foto",
    aiuto: "",
    conRuolo: true,
  },
  {
    slot: "foto5",
    etichetta: "Foto 5",
    obbligatorio: false,
    tipo: "foto",
    aiuto: "",
    conRuolo: true,
  },
  {
    slot: "scala",
    etichetta: "Foto di scala",
    obbligatorio: false,
    tipo: "foto",
    aiuto: "Fa capire la grandezza vera del prodotto.",
    conRuolo: false,
  },
  {
    slot: "video",
    etichetta: "Video breve",
    obbligatorio: false,
    tipo: "video",
    aiuto: `Al massimo ${MAX_VIDEO_SECONDI} secondi, MP4 o MOV.`,
    conRuolo: false,
  },
  {
    slot: "confezione",
    etichetta: "Foto della confezione",
    obbligatorio: false,
    tipo: "foto",
    aiuto: "Facoltativa.",
    conRuolo: false,
  },
];
export const GALLERIA: readonly SlotEditor[] = ["foto2", "foto3", "foto4", "foto5"];

export const RUOLI: readonly { valore: SottoRuolo; etichetta: string; alt: string }[] = [
  { valore: "retro_base", etichetta: "Retro della base", alt: "retro della base" },
  { valore: "macro_attaccatura", etichetta: "Attaccatura da vicino", alt: "attaccatura da vicino" },
  { valore: "colore_luce", etichetta: "Colore alla luce", alt: "colore alla luce" },
  { valore: "altro", etichetta: "Altro", alt: "altra foto" },
];

/* ── la descrizione per chi non vede ─────────────────────────────────── */

export const contaAlt = (alt: string): string => `${alt.length}/${MAX_ALT}`;

export function controllaAlt(
  alt: unknown,
): { ok: true; alt: string } | { ok: false; frase: string } {
  const t = typeof alt === "string" ? alt.trim() : "";
  if (!t) return { ok: false, frase: "Scrivi cosa si vede nella foto, per chi non può vederla." };
  if (t.length > MAX_ALT)
    return { ok: false, frase: `La descrizione è troppo lunga: ${t.length} segni su ${MAX_ALT}.` };
  return { ok: true, alt: t };
}

/** Una descrizione di partenza dal nome del prodotto e dal ruolo: il titolare la corregge. Mai oltre 125 segni. */
export function altProposto(nome: string, slot: string, ruolo: SottoRuolo | string | null): string {
  const coda =
    slot === "principale"
      ? ""
      : slot === "scala"
        ? ", foto di scala"
        : slot === "video"
          ? ", video breve"
          : slot === "confezione"
            ? ", la confezione"
            : `, ${RUOLI.find((r) => r.valore === ruolo)?.alt ?? "altra foto"}`;
  const base = nome.trim() || "Prodotto";
  return `${base.slice(0, MAX_ALT - coda.length).trimEnd()}${coda}`;
}

/* ── quale media sta in quale slot ───────────────────────────────────── */

const perOrdine = (a: Media, b: Media): number =>
  a.ordine - b.ordine || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const vivi = (media: readonly Media[]): Media[] =>
  media.filter((m) => !m.rimossoIl).sort(perOrdine);

/** Un media per slot; se ce ne fossero due vince sempre lo stesso (ordine, poi id), come sul sito. */
export function mediaPerSlot(media: readonly Media[]): Map<string, Media> {
  const fuori = new Map<string, Media>();
  for (const m of vivi(media))
    if (m.slot !== "campione" && !fuori.has(m.slot)) fuori.set(m.slot, m);
  return fuori;
}

/** Gli slot delle foto (non il video) ancora vuoti, nell'ordine della griglia. */
export function slotLiberiFoto(media: readonly Media[]): SlotEditor[] {
  const occupati = mediaPerSlot(media);
  return SLOT_EDITOR.filter((s) => s.tipo === "foto" && !occupati.has(s.slot)).map((s) => s.slot);
}

/** Più file insieme: ognuno va nel primo slot libero; quelli che non ci stanno restano fuori. */
export function assegnaSlot<T extends string>(
  quanti: number,
  liberi: readonly T[],
): { slot: T[]; inEccesso: number } {
  const n = Math.max(0, quanti);
  return { slot: liberi.slice(0, n), inEccesso: Math.max(0, n - liberi.length) };
}
export const fraseInEccesso = (posti: number, fuori: number): string =>
  `C'è posto solo per ${posti} foto: ${fuori === 1 ? "l'ultima non è stata presa" : `le ultime ${fuori} non sono state prese`}.`;

/* ── il riordino: solo le foto 2-5, scambiandosi il posto ────────────── */

export const galleria = (media: readonly Media[]): Media[] =>
  vivi(media).filter((m) => (GALLERIA as readonly string[]).includes(m.slot));

/** L'elenco di TUTTI gli id (per `media_ordina`) dopo aver rimesso le foto della galleria nell'ordine `nuova`, nelle stesse posizioni. */
function rimettiGalleria(media: readonly Media[], nuova: readonly Media[]): string[] {
  const tutti = vivi(media);
  const coda = [...nuova];
  return tutti.map(
    (m) => ((GALLERIA as readonly string[]).includes(m.slot) ? (coda.shift() as Media) : m).id,
  );
}

/** `verso` −1 = prima, +1 = dopo. `null` se non si può (non è della galleria, è già in fondo). */
export function ordineSposta(media: readonly Media[], id: string, verso: -1 | 1): string[] | null {
  const g = galleria(media);
  const i = g.findIndex((m) => m.id === id);
  const j = i + verso;
  if (i < 0 || j < 0 || j >= g.length) return null;
  const nuova = [...g];
  [nuova[i], nuova[j]] = [nuova[j], nuova[i]];
  return rimettiGalleria(media, nuova);
}

/** Trascinare `da` su `su`: `da` prende il posto di `su` e gli altri scalano. */
export function ordineTrascina(media: readonly Media[], da: string, su: string): string[] | null {
  const g = galleria(media);
  const i = g.findIndex((m) => m.id === da);
  const j = g.findIndex((m) => m.id === su);
  if (i < 0 || j < 0 || i === j) return null;
  const nuova = g.filter((m) => m.id !== da);
  nuova.splice(j, 0, g[i]);
  return rimettiGalleria(media, nuova);
}

/* ── l'anteprima dei file già caricati ───────────────────────────────── */

/** `base` = `…/storage/v1/object/public/shop-media`. Solo https; senza base non si inventa niente. */
export function urlMedia(base: string | undefined | null, percorso: string | null): string | null {
  if (!base || !percorso || !/^https:\/\//i.test(base)) return null;
  return `${base.replace(/\/+$/, "")}/${percorso.replace(/^\/+/, "")}`;
}

/* ── il caricamento, un passo alla volta ─────────────────────────────── */

export interface FileDaCaricare {
  /** Come si chiama in questo lavoro (`480`, `960`, `video`, `copertina`…): non è un nome di file di chi carica. */
  chiave: string;
  tipo: "foto" | "video" | "copertina";
  blob: Blob;
  mime: string;
  /** Per le foto: i nomi di misura (480, 960, 1600) che questo file serve. */
  per?: number[];
}
export interface DatiLavoro {
  prodottoId: string;
  slot: SlotEditor;
  sottoRuolo: SottoRuolo | null;
  alt: string;
  tipo: "foto" | "video";
  file: FileDaCaricare[];
  durataS: number | null;
  muto: boolean;
  testoParlato: string | null;
  ritraePersone: boolean;
  liberatoriaOk: boolean;
  sottotitoliOk: boolean;
}
export interface Lavoro extends DatiLavoro {
  /** I percorsi che ha deciso il server, per chiave: ciò che è già salito non si rimanda. */
  caricati: Record<string, string>;
  mediaId: string | null;
  flagFatti: boolean;
  tentativi: number;
  finito: boolean;
  /** Il fallimento definitivo (3 tentativi): si ricorda, così rilanciare il lavoro non ritira o ricarica niente una seconda volta. */
  finale: EsitoLavoro | null;
}
export const nuovoLavoro = (dati: DatiLavoro): Lavoro => ({
  ...dati,
  caricati: {},
  mediaId: null,
  flagFatti: false,
  tentativi: 0,
  finito: false,
  finale: null,
});

type Esito<T> = ({ ok: true } & T) | { ok: false; errore: { messaggio: string } };
export interface PorteCarico {
  permesso(f: {
    tipo: "foto" | "video" | "copertina";
    mime: string;
    peso: number;
  }): Promise<Esito<{ permesso: unknown }>>;
  carica(
    permesso: unknown,
    blob: Blob,
  ): Promise<{ ok: true } | { ok: false; errore: { messaggio: string } }>;
  esegui(
    azione: string,
    dati: Record<string, unknown>,
  ): Promise<Esito<{ dati: Record<string, unknown> }>>;
}
export type EsitoLavoro =
  | { ok: true; avviso?: string }
  | {
      ok: false;
      frase: string;
      definitivo: boolean;
      /** Sul server qualcosa è cambiato (la foto è già registrata): chi chiama deve rileggere la scheda, anche se il lavoro è fallito. */
      cambiato: boolean;
      /** Il media è stato ritirato dal sito (la foto non è pubblicata). */
      ritirata?: boolean;
      avviso?: string;
    };

const FRASE_DEFINITIVA = `Ho riprovato ${MAX_TENTATIVI} volte senza riuscirci: scegli di nuovo la foto.`;
const FRASE_IMPREVISTA = "Qualcosa è andato storto durante il caricamento: riprova.";

function flagDa(l: Lavoro): Record<string, boolean> | null {
  const f: Record<string, boolean> = {};
  if (l.ritraePersone) {
    f.ritraePersone = true;
    f.liberatoriaOk = l.liberatoriaOk;
  }
  if (l.sottotitoliOk) f.sottotitoliOk = true;
  return Object.keys(f).length ? f : null;
}
const pathDi = (l: Lavoro, n: number): string | null => {
  const f = l.file.find((x) => x.per?.includes(n));
  return f ? (l.caricati[f.chiave] ?? null) : null;
};

/** Ciò che resta da dire quando i tentativi sono finiti DOPO che il file è già registrato (manca solo `media_flag`).
 *  Una foto con una persona NON può restare in linea senza il segno «ritrae persone»: si ritira (`media_rimuovi` con
 *  `liberatoriaRevocata`, che se serve riporta il prodotto in bozza e lo dice). Se nemmeno il ritiro riesce, lo si dice. */
async function esitoDopoRegistro(l: Lavoro, porte: PorteCarico): Promise<EsitoLavoro> {
  const cosa =
    l.tipo === "video"
      ? { il: "Il video", lo: "lo", la: "aprilo", ctrl: "controllalo" }
      : { il: "La foto", lo: "la", la: "aprila", ctrl: "controllala" };
  if (!l.ritraePersone)
    return {
      ok: false,
      definitivo: true,
      cambiato: true,
      frase: `${cosa.il} è salv${l.tipo === "video" ? "ato" : "ata"}, ma una sua impostazione non è stata registrata: ${cosa.la} con Modifica e ${cosa.ctrl}.`,
    };
  try {
    const r = await porte.esegui("media_rimuovi", {
      prodottoId: l.prodottoId,
      mediaId: l.mediaId,
      liberatoriaRevocata: true,
    });
    if (r.ok) {
      const avviso = typeof r.dati.avviso === "string" ? r.dati.avviso : undefined;
      return {
        ok: false,
        definitivo: true,
        cambiato: true,
        ritirata: true,
        frase:
          l.tipo === "video"
            ? "Il video non è stato pubblicato: riprova a caricarlo."
            : "La foto non è stata pubblicata: riprova a caricarla.",
        ...(avviso ? { avviso } : {}),
      };
    }
  } catch {
    //  si dice sotto: la foto è ancora in linea
  }
  return {
    ok: false,
    definitivo: true,
    cambiato: true,
    frase:
      l.tipo === "video"
        ? "Il video è salvato, ma non sono riuscito a registrare che ritrae una persona né a toglierlo: aprilo con Modifica e correggilo subito."
        : "La foto è salvata, ma non sono riuscito a registrare che ritrae una persona né a toglierla: aprila con Modifica e correggila subito.",
  };
}

/** Fa i passi che mancano. Non lancia mai: un guasto diventa `{ ok: false, frase }` con una frase nostra (mai il testo dell'eccezione, che può contenere il token). */
export async function eseguiLavoro(
  l: Lavoro,
  porte: PorteCarico,
  avanza?: (fatti: number, totale: number) => void,
): Promise<EsitoLavoro> {
  if (l.finito) return { ok: true };
  if (l.finale) return l.finale;
  if (l.tentativi >= MAX_TENTATIVI)
    return { ok: false, frase: FRASE_DEFINITIVA, definitivo: true, cambiato: !!l.mediaId };
  l.tentativi++;
  const manca = async (frase: string): Promise<EsitoLavoro> => {
    if (l.tentativi < MAX_TENTATIVI)
      return { ok: false, frase, definitivo: false, cambiato: !!l.mediaId };
    l.finale = l.mediaId
      ? await esitoDopoRegistro(l, porte)
      : { ok: false, frase: FRASE_DEFINITIVA, definitivo: true, cambiato: false };
    return l.finale;
  };
  const flag = flagDa(l);
  const totale = l.file.length + 1 + (flag ? 1 : 0);
  const fatti = () => Object.keys(l.caricati).length + (l.mediaId ? 1 : 0) + (l.flagFatti ? 1 : 0);
  avanza?.(fatti(), totale);
  try {
    for (const f of l.file) {
      if (l.caricati[f.chiave]) continue;
      const p = await porte.permesso({ tipo: f.tipo, mime: f.mime, peso: f.blob.size });
      if (!p.ok) return manca(p.errore.messaggio);
      const s = await porte.carica(p.permesso, f.blob);
      if (!s.ok) return manca(s.errore.messaggio);
      l.caricati[f.chiave] = (p.permesso as { path: string }).path;
      avanza?.(fatti(), totale);
    }
    if (!l.mediaId) {
      const dati: Record<string, unknown> =
        l.tipo === "video"
          ? {
              prodottoId: l.prodottoId,
              slot: l.slot,
              alt: l.alt,
              pathVideo: l.caricati.video ?? null,
              pathCopertina: l.caricati.copertina ?? null,
              durataS: Math.ceil(l.durataS ?? 0),
              muto: l.muto,
              testoParlato: l.testoParlato?.trim() || null,
            }
          : {
              prodottoId: l.prodottoId,
              slot: l.slot,
              alt: l.alt,
              sottoRuolo: l.sottoRuolo,
              path480: pathDi(l, 480),
              path960: pathDi(l, 960),
              path1600: pathDi(l, 1600),
            };
      const r = await porte.esegui("media_registra", dati);
      if (!r.ok) return manca(r.errore.messaggio);
      const id = (r.dati.media as { id?: unknown } | undefined)?.id;
      if (typeof id !== "string" || !id) return manca("Il file non è stato salvato: riprova.");
      l.mediaId = id;
      avanza?.(fatti(), totale);
    }
    let avviso: string | undefined;
    if (flag && !l.flagFatti) {
      const r = await porte.esegui("media_flag", { mediaId: l.mediaId, flag });
      if (!r.ok) return manca(r.errore.messaggio);
      l.flagFatti = true;
      if (typeof r.dati.avviso === "string") avviso = r.dati.avviso;
      avanza?.(fatti(), totale);
    }
    l.finito = true;
    return avviso ? { ok: true, avviso } : { ok: true };
  } catch {
    return manca(FRASE_IMPREVISTA);
  }
}
