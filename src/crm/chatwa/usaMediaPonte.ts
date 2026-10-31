/** ── I MEDIA DEL PONTE NELLA CHAT ───────────────────────────────────────────
 *
 *  Commessa 2026-10-30-ponte-storico-completo (foto) e 2026-10-31-media-e-archiviazione
 *  (T8: vocali, video, documenti, timer, «Mostra»). Il ponte salva il file in un bucket
 *  privato e scrive una riga in `ponte_wa_media`; la chat lo mostra così:
 *    1. la riga si legge dal database (RLS: chi vede le chat vede i media), tutte le righe
 *       delle bolle IN VISTA in UNA lettura sola (`leggiRiga` raggruppa le richieste dello
 *       stesso istante, in lotti da 100), insieme alle richieste «Mostra» in corso;
 *    2. l'indirizzo firmato si chiede a `GET /api/crm/ponte-media?id=<uuid>.<ext>&uso=…`
 *       con il solo nome del file (mai il numero del cliente né la chiave del messaggio);
 *    3. foto e vocali si scaricano in memoria (3 alla volta, cache LRU) e si mostrano da
 *       `blob:`; il video usa l'indirizzo firmato diretto (D10); il documento si apre in
 *       una nuova scheda dal gesto.
 *  Senza riga (o liberato) la bolla resta il testo «📷 Foto» di sempre.
 *
 *  ⚠️ L'indirizzo firmato non va mai in uno stato React, in un `href` né nel DOM, tranne
 *   il `video.src` (proprietà, vedi MediaPonte). Vive solo dentro queste funzioni.
 *  ⚠️ Nessun log: questo file non scrive niente.
 *  ⚠️ Funzioni pure (`mediaDelPonte`, `caricaBlob`, `faseDaRiga`, `azioneMedia`…) senza
 *   React né database: le prove (`prove/ponte/media-chat-ui.mjs`) le chiamano con reti finte. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCRM } from "@/crm/AuthContext";

// ── Quale messaggio è un media del ponte ──────────────────────────────────

export type Categoria = "foto" | "audio" | "video" | "documento";

/** `bw:<cifre>:<id WhatsApp>` (src/crm/ponte/tipi.ts). Cifre e id restano corti: finiscono in un indirizzo. */
const CHIAVE = /^bw:\d{5,20}:[A-Za-z0-9_.-]{1,128}$/;
/** I segnaposto che scrive il ponte (`SEGNAPOSTO` in estrai.mjs), con la didascalia dopo i due punti se c'è.
 *  Regole ancorate, un solo quantificatore per volta: nessun backtracking sul testo del cliente. */
const SEGNAPOSTI: Record<Categoria, RegExp> = {
  foto: /^📷️?\s*Foto(?::\s*([\s\S]*))?$/u,
  audio: /^🎤️?\s*Vocale(?: \d{1,3}:[0-5]\d)?$/u,
  video: /^🎥️?\s*Video(?::\s*([\s\S]*))?$/u,
  documento: /^📎️?\s*Documento(?::\s*([\s\S]*))?$/u,
};
const CATEGORIE = Object.keys(SEGNAPOSTI) as Categoria[];

export interface MediaDelPonte {
  chiave: string;
  categoria: Categoria;
  /** Foto e video: la didascalia del cliente (nodo di testo). Vocale e documento: `""` (il nome viene dalla riga). */
  didascalia: string;
}

/** Se il messaggio è un media di una riga del ponte (in entrata o mandato dal telefono). Altrimenti `null`. */
export function mediaDelPonte(m: {
  canale?: string | null;
  wa_message_id?: string | null;
  body?: string | null;
}): MediaDelPonte | null {
  if (m.canale !== "baileys") return null;
  const chiave = m.wa_message_id ?? "";
  if (!CHIAVE.test(chiave)) return null;
  const testo = (m.body ?? "").trim();
  for (const categoria of CATEGORIE) {
    const s = SEGNAPOSTI[categoria].exec(testo);
    if (s) {
      const d = categoria === "foto" || categoria === "video" ? (s[1] ?? "").trim() : "";
      return { chiave, categoria, didascalia: d };
    }
  }
  return null;
}

/** Com'era prima di T8 (le prove di oggi): solo le foto. */
export function fotoDelPonte(m: Parameters<typeof mediaDelPonte>[0]) {
  const x = mediaDelPonte(m);
  return x?.categoria === "foto" ? { chiave: x.chiave, didascalia: x.didascalia } : null;
}

// ── Indirizzo firmato e scarico ───────────────────────────────────────────

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** L'identificativo di un file in Storage: `<uuid>.<estensione>` (minuscolo; estensione qualunque `[a-z0-9]{2,5}`:
 *  la decide il server dal tipo vero del file, la chat non ne conosce l'elenco). */
const ID_MEDIA = new RegExp(`^${UUID}\\.[a-z0-9]{2,5}$`);
/** Il percorso di una riga: `<uuid dell'utente>/<nome del file>`; il gruppo è il nome. */
const PERCORSO_MEDIA = new RegExp(`^${UUID}/(${UUID}\\.[a-z0-9]{2,5})$`);

/** Come lo chiede la rotta GET: `vedi` foto e vocali, `video`, `apri` documenti. */
export type UsoMedia = "vedi" | "video" | "apri";

/** Tipi e pesi ammessi per ciò che passa da `blob:` (il video e i documenti no). */
const BLOB_AMMESSI: Partial<Record<Categoria, { tipi: string[]; pesoMax: number }>> = {
  foto: { tipi: ["image/jpeg", "image/png", "image/webp"], pesoMax: 9 * 1024 * 1024 },
  audio: {
    tipi: ["audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/amr"],
    pesoMax: 17 * 1024 * 1024,
  },
};

export const FRASE_NON_PIU = "La foto non è più disponibile.";
export const FRASE_RIPROVA = "Non riesco a caricare la foto.";
const NOMI: Record<Categoria, [string, string]> = {
  foto: [FRASE_NON_PIU, FRASE_RIPROVA],
  audio: ["Il vocale non è più disponibile.", "Non riesco a caricare il vocale."],
  video: ["Il video non è più disponibile.", "Non riesco a caricare il video."],
  documento: ["Il documento non è più disponibile.", "Non riesco ad aprire il documento."],
};
export const fraseNonPiu = (c: Categoria) => NOMI[c][0];
export const fraseRiprova = (c: Categoria) => NOMI[c][1];

export type EsitoUrl =
  | { ok: true; url: string }
  | { ok: false; frase: string; riprova: boolean; perso?: boolean };
export type EsitoBlob =
  | { ok: true; blob: Blob }
  | { ok: false; frase: string; riprova: boolean; perso?: boolean; annullato?: boolean };

/** Le richieste, passate da fuori (le prove ci mettono quelle finte). */
export interface RetiMedia {
  /** Come `fetchCRM`: aggiunge la sessione e, se scaduta, la rinnova una volta. */
  chiedi: (percorso: string, init: RequestInit) => Promise<Response>;
  /** Come `fetch`, per scaricare dall'indirizzo firmato. */
  scarica: (url: string, init: RequestInit) => Promise<Response>;
  segnale?: AbortSignal;
}

const guasto = (c: Categoria, riprova = true): { ok: false; frase: string; riprova: boolean } => ({
  ok: false,
  frase: fraseRiprova(c),
  riprova,
});

/** Chiede l'indirizzo firmato di un file. `id` = il nome del file: un indirizzo col numero del
 *  cliente resterebbe nei log di accesso. Non lancia mai: ogni guasto è un `{ ok:false, frase, riprova }`. */
export async function chiediUrl(
  id: string,
  uso: UsoMedia,
  categoria: Categoria,
  reti: Pick<RetiMedia, "chiedi" | "segnale">,
): Promise<EsitoUrl> {
  if (!ID_MEDIA.test(id)) return guasto(categoria, false); // mai niente di diverso dal nome di un file in un indirizzo
  try {
    const r = await reti.chiedi(`/api/crm/ponte-media?id=${id}&uso=${uso}`, {
      method: "GET",
      cache: "no-store",
      signal: reti.segnale,
    });
    //  404: la riga o l'oggetto non ci sono (più): ritentare non serve. Ogni altro errore
    //  (anche il 503 di un guasto passeggero di Storage) lascia il tasto Riprova.
    if (r.status === 404)
      return { ok: false, frase: fraseNonPiu(categoria), riprova: false, perso: true };
    if (!r.ok) return guasto(categoria);
    const corpo: unknown = await r.json().catch(() => null);
    const url = (corpo as { url?: unknown } | null)?.url;
    if (typeof url !== "string") return guasto(categoria);
    //  Solo https: la rotta è nostra, ma il browser non deve mai scaricare da altro.
    if (new URL(url).protocol !== "https:") return guasto(categoria);
    return { ok: true, url };
  } catch {
    return guasto(categoria); // rete assente, indirizzo illeggibile, richiesta annullata
  }
}

/** Foto o vocale: indirizzo firmato → scarico → `Blob`. Il tipo e il peso si controllano qui. */
export async function caricaBlob(
  id: string,
  categoria: Categoria,
  reti: RetiMedia,
): Promise<EsitoBlob> {
  const ammessi = BLOB_AMMESSI[categoria];
  if (!ammessi) return guasto(categoria, false);
  const u = await chiediUrl(id, "vedi", categoria, reti);
  if (!u.ok) return u;
  try {
    const f = await reti.scarica(u.url, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: reti.segnale,
    });
    if (!f.ok) return guasto(categoria);
    const blob = await f.blob();
    //  Solo i tipi dell'elenco (mai SVG o HTML), e un peso sensato.
    const tipo = blob.type.split(";")[0].trim().toLowerCase();
    if (!ammessi.tipi.includes(tipo) || blob.size === 0 || blob.size > ammessi.pesoMax)
      return guasto(categoria, false);
    return { ok: true, blob };
  } catch {
    return guasto(categoria);
  }
}

/** Come prima di T8 (le prove di oggi). */
export const caricaFoto = (id: string, reti: RetiMedia) => caricaBlob(id, "foto", reti);

// ── Tre scarichi alla volta e cache LRU ───────────────────────────────────

/** Quanti scarichi insieme: una chat con 40 foto non deve aprire 40 connessioni. */
export const MAX_DOWNLOAD = 3;
/** Quanto pesa al massimo la cache dei blob (foto e vocali già scaricati). */
export const LRU_BYTE = 32 * 1024 * 1024;

let attivi = 0;
const inAttesa: (() => void)[] = [];
function conLimite<T>(lavoro: () => Promise<T>): Promise<T> {
  return new Promise<T>((ok, ko) => {
    const via = () => {
      attivi++;
      lavoro()
        .then(ok, ko)
        .finally(() => {
          attivi--;
          inAttesa.shift()?.();
        });
    };
    if (attivi < MAX_DOWNLOAD) via();
    else inAttesa.push(via);
  });
}

const lru = new Map<string, Blob>(); // l'ordine di inserimento è la recenza
let pesoLru = 0;
/** Il blob già scaricato (e lo rende «recente»), o `null`. */
export function blobInCache(id: string): Blob | null {
  const b = lru.get(id);
  if (!b) return null;
  lru.delete(id);
  lru.set(id, b);
  return b;
}
export function dimenticaBlob(id: string): void {
  const b = lru.get(id);
  if (b) pesoLru -= b.size;
  lru.delete(id);
}
export function svuotaBlob(): void {
  lru.clear();
  pesoLru = 0;
}
export const pesoCache = () => pesoLru;
function ricorda(id: string, blob: Blob) {
  dimenticaBlob(id);
  lru.set(id, blob);
  pesoLru += blob.size;
  //  Esce la meno recente; l'ultima voce resta anche se da sola supera il tetto.
  while (pesoLru > LRU_BYTE && lru.size > 1) {
    const [vecchia, b] = lru.entries().next().value as [string, Blob];
    lru.delete(vecchia);
    pesoLru -= b.size;
  }
}

/** `caricaBlob` con cache e al più `MAX_DOWNLOAD` scarichi insieme. Un lavoro in coda la cui bolla
 *  è sparita nel frattempo (`segnale` annullato) non parte nemmeno. */
export async function scaricaMedia(
  id: string,
  categoria: Categoria,
  reti: RetiMedia,
): Promise<EsitoBlob> {
  const dalla = blobInCache(id);
  if (dalla) return { ok: true, blob: dalla };
  const e = await conLimite(async (): Promise<EsitoBlob> => {
    if (reti.segnale?.aborted) return { ...guasto(categoria), annullato: true };
    return caricaBlob(id, categoria, reti);
  });
  if (e.ok) ricorda(id, e.blob);
  return e;
}

// ── Azioni verso il server (Mostra, timer, elimina) ───────────────────────

/** Le scelte del foglio: «tieni sempre» o i secondi (i 5 valori del PIANO D6). */
export type ScelteTimer = "tieni" | 300 | 3600 | 86400 | 604800 | 2592000;
export const ETICHETTE_TIMER: readonly { valore: ScelteTimer; etichetta: string }[] = [
  { valore: "tieni", etichetta: "Tieni sempre" },
  { valore: 300, etichetta: "5 minuti" },
  { valore: 3600, etichetta: "1 ora" },
  { valore: 86400, etichetta: "24 ore" },
  { valore: 604800, etichetta: "7 giorni" },
  { valore: 2592000, etichetta: "30 giorni" },
];
const TIMER_AMMESSI: readonly unknown[] = ETICHETTE_TIMER.map((t) => t.valore);

export type CorpoAzione =
  | { azione: "richiedi"; chiave: string; timer?: ScelteTimer }
  | { azione: "timer"; chiave: string; timer: ScelteTimer }
  | { azione: "libera"; chiave: string };

export type EsitoAzione = { ok: true } | { ok: false; motivo: string };

/** `POST /api/crm/ponte-media-azione`. Solo la chiave singola: `chiavi`, `numero` e `tutto` sono del pannello
 *  (permesso `impostazioni`). Non lancia mai. */
export async function azioneMedia(
  corpo: CorpoAzione,
  chiedi: (percorso: string, init: RequestInit) => Promise<Response>,
): Promise<EsitoAzione> {
  if (!CHIAVE.test(corpo.chiave)) return { ok: false, motivo: "non_valido" };
  if ("timer" in corpo && corpo.timer !== undefined && !TIMER_AMMESSI.includes(corpo.timer))
    return { ok: false, motivo: "non_valido" };
  try {
    const r = await chiedi("/api/crm/ponte-media-azione", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j: unknown = await r.json().catch(() => null);
    const o = (j ?? {}) as { ok?: unknown; motivo?: unknown };
    if (r.ok && o.ok !== false) return { ok: true };
    return { ok: false, motivo: typeof o.motivo === "string" ? o.motivo : "errore" };
  } catch {
    return { ok: false, motivo: "errore" };
  }
}

/** Apre un file in una nuova scheda (documenti; vocali che il browser non sa suonare): `window.open` DENTRO
 *  il gesto, prima di qualunque attesa (altrimenti il blocco dei popup lo ferma), poi l'indirizzo firmato
 *  solo sulla scheda, con `opener` spento. */
export async function apriFuori(
  id: string,
  categoria: Categoria,
): Promise<{ ok: true } | { ok: false; frase: string }> {
  const w = window.open("", "_blank");
  const u = await chiediUrl(id, "apri", categoria, { chiedi: fetchCRM });
  if (!u.ok) {
    w?.close();
    return { ok: false, frase: u.frase };
  }
  if (!w) return { ok: false, frase: "Il browser ha bloccato l'apertura." };
  w.opener = null;
  w.location.href = u.url;
  return { ok: true };
}

// ── Pressione lunga: il click che segue ───────────────────────────────────

/** I bersagli dove la pressione lunga NON parte: link, lettori, cursori e i tasti che non portano
 *  `data-media-pl` (Riprova, Apri, Mostra, velocità). I tasti del media (play, scheda documento) sì. */
export const ESCLUDI_PRESSIONE = "a,button:not([data-media-pl]),audio,video,input,[role='slider']";

/** Dopo il rilascio di una pressione lunga il browser può generare un click sul media (play, scheda
 *  documento) e iOS spesso non lo genera: un flag acceso inghiottirebbe il tocco VERO successivo.
 *  Quindi il click si ignora solo mentre il dito è giù e per `FINESTRA_CLICK_MS` dal rilascio. */
export const FINESTRA_CLICK_MS = 400;
const TENUTO_MAX_MS = 10_000;

export function nuovoSoppressoreClick(adesso: () => number = () => performance.now()) {
  let scattataAlle: number | null = null;
  let tenuto = false;
  let fino = 0;
  return {
    /** Un nuovo tocco comincia: ogni stato di prima si azzera. */
    inizia() {
      scattataAlle = null;
      tenuto = false;
      fino = 0;
    },
    /** La pressione lunga è scattata (il dito è ancora giù). */
    scatta() {
      scattataAlle = adesso();
      tenuto = true;
    },
    /** Il dito si alza (o il gesto è annullato): comincia la finestra. */
    rilascia() {
      if (scattataAlle === null) return;
      tenuto = false;
      fino = adesso() + FINESTRA_CLICK_MS;
    },
    blocca() {
      const t = adesso();
      return (tenuto && scattataAlle !== null && t - scattataAlle < TENUTO_MAX_MS) || t < fino;
    },
  };
}

// ── La riga in `ponte_wa_media` e le richieste, lette a gruppi ────────────

export interface RichiestaMedia {
  stato: "in_attesa" | "in_corso" | "non_disponibile";
  motivo: string | null;
  timer_s: number | null;
}

export interface RigaMedia {
  stato: "pronta" | "in_caricamento" | "liberato" | "nessuna";
  /** Il nome del file in Storage, per le sole righe pronte con un percorso valido. */
  id: string | null;
  categoria: Categoria | null;
  nome: string | null;
  byte: number | null;
  durata_s: number | null;
  larghezza: number | null;
  altezza: number | null;
  /** `jpegThumbnail` di WhatsApp: solo se passa di nuovo il controllo dei caratteri (finisce in un `data:`). */
  miniatura: string | null;
  scade_il: string | null;
  richiesta: RichiestaMedia | null;
}

const NESSUNA: RigaMedia = {
  stato: "nessuna",
  id: null,
  categoria: null,
  nome: null,
  byte: null,
  durata_s: null,
  larghezza: null,
  altezza: null,
  miniatura: null,
  scade_il: null,
  richiesta: null,
};

type Dati = Record<string, unknown>;
/** La catena di Supabase ridotta ai metodi usati: i tipi generati non conoscono le tabelle nuove. */
interface Catena {
  select: (s: string) => Catena;
  in: (k: string, v: string[]) => Promise<{ data: Dati[] | null; error: unknown }>;
}
const tabella = (t: string) => (supabase as unknown as { from: (t: string) => Catena }).from(t);

const COLONNE =
  "chiave,stato,path,categoria,nome,byte,durata_s,larghezza,altezza,miniatura,scade_il";
//  Prima della migrazione A le colonne nuove non ci sono: la foto di sempre deve vedersi lo stesso.
const COLONNE_VECCHIE = "chiave,stato,path";
const COLONNE_RICHIESTE = "chiave,stato,motivo,timer_s";
let soloVecchie = false;

const MINIATURA = /^\/9j\/[A-Za-z0-9+/]*={0,2}$/;
const num = (x: unknown): number | null => {
  const n = typeof x === "string" && x.trim() !== "" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const testo = (x: unknown): string | null => (typeof x === "string" && x !== "" ? x : null);

function daDati(d: Dati, richiesta: RichiestaMedia | null): RigaMedia {
  const stato =
    d.stato === "pronta" ? "pronta" : d.stato === "liberato" ? "liberato" : "in_caricamento";
  const id = stato === "pronta" ? (PERCORSO_MEDIA.exec(testo(d.path) ?? "")?.[1] ?? null) : null;
  const mini = testo(d.miniatura);
  const categoria = CATEGORIE.find((c) => c === d.categoria) ?? null;
  return {
    stato,
    id,
    categoria,
    nome: testo(d.nome),
    byte: num(d.byte),
    durata_s: num(d.durata_s),
    larghezza: num(d.larghezza),
    altezza: num(d.altezza),
    miniatura: mini && mini.length <= 12_000 && MINIATURA.test(mini) ? mini : null,
    scade_il: testo(d.scade_il),
    richiesta,
  };
}

/** Quanto vale una risposta «non ancora pronta» prima di rileggerla. */
const VALIDA_MS = 30_000;
/** Righe per lettura: gli indirizzi restano corti anche con molti media in chat. */
const PER_LETTURA = 100;

interface Voce {
  p: Promise<RigaMedia>;
  quando: number;
  /** pronta: resta in memoria (finché non arriva «ponte-media-liberati» o un 404) */
  fissa: boolean;
  /** con una richiesta in corso la riga cambia: si rilegge ogni volta */
  rilegge: boolean;
}
const cache = new Map<string, Voce>();
/** chiave del messaggio → identificativo del file, per le sole righe pronte. */
const ids = new Map<string, string>();

/** L'identificativo (nome del file) di una riga pronta già letta, o `null`. */
export const idFoto = (chiave: string): string | null => ids.get(chiave) ?? null;
/** Dimentica la riga di una chiave, o tutte (evento «ponte-media-liberati»): la prossima lettura è vera. */
export function dimenticaRiga(chiave?: string): void {
  if (chiave === undefined) {
    cache.clear();
    ids.clear();
  } else {
    cache.delete(chiave);
    ids.delete(chiave);
  }
}

let lotto: { chiavi: Set<string>; esito: Promise<Map<string, RigaMedia>> } | null = null;

async function leggiMedia(chiavi: string[]): Promise<Dati[]> {
  const cerca = async (colonne: string) =>
    tabella("ponte_wa_media").select(colonne).in("chiave", chiavi);
  if (!soloVecchie) {
    const r = await cerca(COLONNE);
    if (!r.error) return r.data ?? [];
    //  Se anche la lettura di prima riesce, la migrazione A non c'è ancora: si resta su quella.
    const v = await cerca(COLONNE_VECCHIE);
    if (v.error) throw new Error("lettura");
    soloVecchie = true;
    return v.data ?? [];
  }
  const v = await cerca(COLONNE_VECCHIE);
  if (v.error) throw new Error("lettura");
  return v.data ?? [];
}

async function leggiLotto(chiavi: string[]): Promise<Map<string, RigaMedia>> {
  const trovate = new Map<string, RigaMedia>();
  for (let i = 0; i < chiavi.length; i += PER_LETTURA) {
    const parte = chiavi.slice(i, i + PER_LETTURA);
    const [righe, richieste] = await Promise.all([
      leggiMedia(parte),
      //  La tabella delle richieste può mancare (migrazione A): senza, nessuna richiesta.
      tabella("ponte_wa_media_richieste")
        .select(COLONNE_RICHIESTE)
        .in("chiave", parte)
        .then(
          (r) => (r.error ? [] : (r.data ?? [])),
          () => [] as Dati[],
        ),
    ]);
    const perChiave = new Map<string, RichiestaMedia>();
    for (const q of richieste) {
      if (typeof q.chiave !== "string") continue;
      const stato = q.stato;
      if (stato !== "in_attesa" && stato !== "in_corso" && stato !== "non_disponibile") continue;
      perChiave.set(q.chiave, { stato, motivo: testo(q.motivo), timer_s: num(q.timer_s) });
    }
    for (const d of righe) {
      if (typeof d.chiave !== "string") continue;
      const riga = daDati(d, perChiave.get(d.chiave) ?? null);
      trovate.set(d.chiave, riga);
      if (riga.id) ids.set(d.chiave, riga.id);
      else ids.delete(d.chiave);
    }
    //  Una richiesta senza riga (la riga la crea `richiedi`, ma meglio non perderla): vale lo stesso.
    for (const [chiave, richiesta] of perChiave)
      if (!trovate.has(chiave)) trovate.set(chiave, { ...NESSUNA, richiesta });
  }
  return trovate;
}

/** La riga di un media. Chi lo chiede nello stesso istante (le bolle in vista) condivide UNA lettura.
 *  `pronta` resta in memoria; il resto vale 30 s; `fresco` rilegge subito. Rifiuta se la lettura fallisce. */
export function leggiRiga(chiave: string, fresco = false): Promise<RigaMedia> {
  const v = cache.get(chiave);
  if (v && !fresco && (v.fissa || (!v.rilegge && Date.now() - v.quando < VALIDA_MS))) return v.p;
  if (!lotto) {
    const chiavi = new Set<string>();
    lotto = {
      chiavi,
      esito: Promise.resolve().then(() => {
        lotto = null;
        return leggiLotto([...chiavi]);
      }),
    };
  }
  lotto.chiavi.add(chiave);
  const voce: Voce = {
    p: lotto.esito.then((m) => m.get(chiave) ?? NESSUNA),
    quando: Date.now(),
    fissa: false,
    rilegge: false,
  };
  voce.p.then(
    (r) => {
      voce.fissa = r.stato === "pronta";
      voce.rilegge = r.richiesta !== null && r.richiesta.stato !== "non_disponibile";
    },
    () => {
      if (cache.get(chiave) === voce) cache.delete(chiave); // un guasto non si ricorda
    },
  );
  cache.set(chiave, voce);
  return voce.p;
}

// ── Le fasi della bolla ───────────────────────────────────────────────────

/** Quanto si aspetta il Mac dopo «Mostra» prima di dire che non ha risposto. */
export const ATTESA_RICHIESTA_MS = 90_000;
/** Ogni quanto si controlla la richiesta in corso. */
export const CONTROLLO_RICHIESTA_MS = 3_000;

export type FaseRiga =
  | {
      fase: "verifica" | "nessuna" | "in_arrivo" | "richiesto" | "senza_risposta" | "pronta";
    }
  | { fase: "non_disponibile"; frase: string; riprova: boolean };

//  Le frasi per il titolare: mai parole tecniche (le blocca la prova).
const MOTIVI: Record<string, [string, boolean]> = {
  scaduta: ["Non più disponibile su WhatsApp: aprilo dal telefono", false],
  non_catalogato: ["Non recuperabile da qui: aprilo dal telefono", false],
  tetto: ["Spazio pieno: libera qualcosa da Archiviazione", true],
  spenta: ["Il salvataggio dei file è spento", false],
  troppo_grande: ["File troppo grande per essere salvato", false],
  tipo: ["Tipo di file non ammesso", false],
  errore: ["Non sono riuscito a recuperarlo dal telefono", true],
};
export function fraseMotivo(motivo: string | null): { frase: string; riprova: boolean } {
  const [frase, riprova] = MOTIVI[motivo ?? ""] ?? MOTIVI.errore;
  return { frase, riprova };
}

/** Dalla riga (e dall'ora di adesso) alla fase da disegnare. Pura. */
export function faseDaRiga(
  riga: RigaMedia,
  ctx: { adesso: number; richiestoAlle: number | null },
): FaseRiga {
  if (riga.stato === "pronta") return { fase: "pronta" };
  const q = riga.richiesta;
  if (q && q.stato !== "non_disponibile") {
    const scaduta =
      ctx.richiestoAlle !== null && ctx.adesso - ctx.richiestoAlle > ATTESA_RICHIESTA_MS;
    return { fase: scaduta ? "senza_risposta" : "richiesto" };
  }
  if (riga.stato === "in_caricamento") return { fase: "in_arrivo" };
  if (q) return { fase: "non_disponibile", ...fraseMotivo(q.motivo) };
  return { fase: "nessuna" };
}

// ── Ganci React ───────────────────────────────────────────────────────────

/** Fino a quando un messaggio è «appena arrivato»: la sua riga potrebbe comparire fra poco. */
const RECENTE_MS = 15 * 60_000;
const OGNI_MS = 15_000;
/** L'evento che il pannello Archiviazione manda dopo aver liberato dei file (contratto T8↔T9). */
export const EVENTO_LIBERATI = "ponte-media-liberati";

export interface GanciMedia {
  fase: FaseRiga;
  riga: RigaMedia | null;
  /** «Mostra» (e Riprova): chiede il file al telefono. `timer` di serie: tieni sempre. */
  richiedi: (timer?: ScelteTimer) => Promise<void>;
  impostaTimer: (timer: ScelteTimer) => Promise<boolean>;
  /** «Elimina ora» (libera il file, resta il segnaposto). */
  elimina: () => Promise<boolean>;
  ricontrolla: () => void;
  /** Il file non c'è più (404): la bolla torna segnaposto. */
  segnaPerso: () => void;
}

/** Le fasi di un media di una bolla. `media` nullo = non è un media del ponte (nessuna lettura).
 *  `visibile`: finché la bolla non è stata in vista non si legge niente (caricamento pigro).
 *  `creatoIl`: per un messaggio appena arrivato la riga si rilegge ogni 15 s finché non è pronta
 *  (shortcut: niente tempo reale per `ponte_wa_media`; sui vecchi si legge una volta sola). */
export function useMediaPonte(
  media: { chiave: string; categoria: Categoria } | null,
  creatoIl: string,
  visibile: boolean,
): GanciMedia {
  const chiave = media?.chiave ?? null;
  const [rigaLetta, setRiga] = useState<RigaMedia | null>(null);
  //  Il file che Storage ha detto «non c'è più» (404) mentre la riga dice ancora «pronta» (il cron
  //  la segna entro il minuto): la bolla torna segnaposto subito.
  const [perso, setPerso] = useState<string | null>(null);
  const riga = useMemo(
    () =>
      rigaLetta && perso !== null && rigaLetta.id === perso
        ? { ...rigaLetta, stato: "liberato" as const, id: null }
        : rigaLetta,
    [rigaLetta, perso],
  );
  const [richiestoAlle, setRichiestoAlle] = useState<number | null>(null);
  const [ottimista, setOttimista] = useState(false);
  const [adesso, setAdesso] = useState(() => Date.now());
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const leggi = useCallback(
    (fresco: boolean) => {
      if (!chiave) return;
      leggiRiga(chiave, fresco).then(
        (r) => vivo.current && setRiga(r),
        () => vivo.current && setRiga((x) => x ?? NESSUNA), // rete o permessi: resta il testo di sempre
      );
    },
    [chiave],
  );

  useEffect(() => {
    if (visibile) leggi(false);
  }, [visibile, leggi]);

  //  Una liberazione dal pannello: le righe pronte in memoria non valgono più.
  useEffect(() => {
    if (!visibile || !chiave) return;
    const gestore = () => {
      dimenticaRiga();
      leggi(true);
    };
    window.addEventListener(EVENTO_LIBERATI, gestore);
    return () => window.removeEventListener(EVENTO_LIBERATI, gestore);
  }, [visibile, chiave, leggi]);

  const pronta = riga?.stato === "pronta";
  const inAttesa = riga?.richiesta != null && riga.richiesta.stato !== "non_disponibile";

  //  Messaggio appena arrivato: la riga potrebbe comparire fra poco.
  useEffect(() => {
    if (!visibile || !chiave || pronta || !(Date.now() - Date.parse(creatoIl) < RECENTE_MS)) return;
    const giro = setInterval(() => {
      if (document.visibilityState !== "hidden") leggi(true);
    }, OGNI_MS);
    return () => clearInterval(giro);
  }, [visibile, chiave, creatoIl, pronta, leggi]);

  //  Richiesta «Mostra» in corso: si controlla ogni 3 s, per 90 s.
  useEffect(() => {
    if (inAttesa && richiestoAlle === null) setRichiestoAlle(Date.now());
    if (!inAttesa && !ottimista) return;
    const scaduta = richiestoAlle !== null && adesso - richiestoAlle > ATTESA_RICHIESTA_MS;
    if (scaduta) return;
    const giro = setInterval(() => {
      setAdesso(Date.now());
      if (document.visibilityState !== "hidden") leggi(true);
    }, CONTROLLO_RICHIESTA_MS);
    return () => clearInterval(giro);
  }, [inAttesa, ottimista, richiestoAlle, adesso, leggi]);

  //  Finita la richiesta (pronta, o chiusa con un motivo): niente più stato provvisorio.
  useEffect(() => {
    if (!riga) return;
    if (riga.stato === "pronta" || (riga.richiesta && riga.richiesta.stato === "non_disponibile")) {
      setRichiestoAlle(null);
      setOttimista(false);
    }
  }, [riga]);

  const richiedi = useCallback(
    async (timer: ScelteTimer = "tieni") => {
      if (!chiave) return;
      setRichiestoAlle(Date.now());
      setAdesso(Date.now());
      setOttimista(true);
      const e = await azioneMedia({ azione: "richiedi", chiave, timer }, fetchCRM);
      if (!vivo.current) return;
      if (!e.ok) {
        //  Il server ha detto di no (tetto, spento…): lo si legge come una richiesta chiusa.
        setOttimista(false);
        setRichiestoAlle(null);
        const m = e.motivo === "tetto" || e.motivo === "spenta" ? e.motivo : "errore";
        setRiga((x) => ({
          ...(x ?? NESSUNA),
          richiesta: { stato: "non_disponibile", motivo: m, timer_s: null },
        }));
        return;
      }
      leggi(true);
    },
    [chiave, leggi],
  );

  const impostaTimer = useCallback(
    async (timer: ScelteTimer) => {
      if (!chiave) return false;
      const e = await azioneMedia({ azione: "timer", chiave, timer }, fetchCRM);
      if (e.ok) leggi(true);
      return e.ok;
    },
    [chiave, leggi],
  );

  const elimina = useCallback(async () => {
    if (!chiave) return false;
    const e = await azioneMedia({ azione: "libera", chiave }, fetchCRM);
    if (!e.ok) return false;
    const id = idFoto(chiave);
    if (id) dimenticaBlob(id);
    dimenticaRiga(chiave);
    leggi(true);
    return true;
  }, [chiave, leggi]);

  const segnaPerso = useCallback(() => {
    if (!chiave) return;
    const id = idFoto(chiave);
    if (id) {
      dimenticaBlob(id);
      setPerso(id);
    }
    dimenticaRiga(chiave);
    leggi(true);
  }, [chiave, leggi]);

  let fase: FaseRiga =
    !visibile || !riga ? { fase: "verifica" } : faseDaRiga(riga, { adesso, richiestoAlle });
  //  Subito dopo il tocco su «Mostra», prima della prima rilettura: già «in arrivo dal telefono».
  if (
    ottimista &&
    (fase.fase === "nessuna" || fase.fase === "in_arrivo" || fase.fase === "non_disponibile")
  )
    fase = {
      fase:
        richiestoAlle !== null && adesso - richiestoAlle > ATTESA_RICHIESTA_MS
          ? "senza_risposta"
          : "richiesto",
    };
  return {
    fase,
    riga,
    richiedi,
    impostaTimer,
    elimina,
    ricontrolla: () => leggi(true),
    segnaPerso,
  };
}

/** Lo stato dello scarico di una foto o di un vocale: `src` è una `blob:` LOCALE (mai l'indirizzo firmato). */
export type StatoBlob =
  | { fase: "idle" }
  | { fase: "carico" }
  | { fase: "vista"; src: string }
  | { fase: "errore"; frase: string; riprova: boolean };

/** Scarica (3 alla volta, con cache) un file e lo rende come `blob:`; la `blob:` si libera quando la bolla sparisce.
 *  `automatico`: parte da solo (la foto); altrimenti solo con `carica()` (il vocale, al primo play). */
export function useBlobMedia(
  id: string | null,
  categoria: "foto" | "audio",
  automatico: boolean,
  inPerso?: () => void,
): { stato: StatoBlob; carica: () => Promise<string | null>; nonSiApre: () => void } {
  const [stato, setStato] = useState<StatoBlob>({ fase: "idle" });
  const vivo = useRef(true);
  const url = useRef<string | null>(null);
  const annulla = useRef<AbortController | null>(null);
  const incorso = useRef<Promise<string | null> | null>(null);
  const perso = useRef(inPerso);
  perso.current = inPerso;

  const libera = useCallback(() => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  }, []);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      annulla.current?.abort();
      libera();
    };
  }, [libera]);

  const carica = useCallback((): Promise<string | null> => {
    if (!id) return Promise.resolve(null);
    if (url.current) return Promise.resolve(url.current);
    if (incorso.current) return incorso.current;
    const ctrl = new AbortController();
    annulla.current = ctrl;
    setStato({ fase: "carico" });
    const p = scaricaMedia(id, categoria, {
      chiedi: fetchCRM,
      scarica: fetch,
      segnale: ctrl.signal,
    }).then((e) => {
      incorso.current = null;
      if (!vivo.current) return null;
      if (!e.ok) {
        if (e.annullato) return null;
        setStato({ fase: "errore", frase: e.frase, riprova: e.riprova });
        if (e.perso) perso.current?.(); // 404: il file è stato liberato → segnaposto
        return null;
      }
      const src = URL.createObjectURL(e.blob);
      url.current = src;
      setStato({ fase: "vista", src });
      return src;
    });
    incorso.current = p;
    return p;
  }, [id, categoria]);

  useEffect(() => {
    if (automatico && id) void carica();
  }, [automatico, id, carica]);

  const nonSiApre = useCallback(() => {
    libera();
    if (id) dimenticaBlob(id);
    setStato({ fase: "errore", frase: fraseRiprova(categoria), riprova: true });
  }, [libera, id, categoria]);

  return { stato, carica, nonSiApre };
}

// ── Piccole parole per la bolla ───────────────────────────────────────────

/** «1,2 MB», «340 KB». */
export function formatoPeso(byte: number | null): string {
  if (byte === null || byte <= 0) return "";
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / (1024 * 1024)).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`;
}

/** «Si elimina tra 1 h», o `null` se non c'è un timer (o è già passato). */
export function scadenzaInParole(scadeIl: string | null, adesso: number): string | null {
  const t = scadeIl ? Date.parse(scadeIl) : NaN;
  if (!Number.isFinite(t)) return null;
  const s = Math.round((t - adesso) / 1000);
  if (s <= 0) return null;
  if (s < 60) return "Si elimina tra meno di 1 min";
  //  Arrotondato al più vicino: subito dopo «1 ora» si legge «1 h», non «60 min».
  const minuti = Math.round(s / 60);
  if (minuti < 60) return `Si elimina tra ${minuti} min`;
  const ore = Math.round(s / 3600);
  if (ore < 24) return `Si elimina tra ${ore} h`;
  return `Si elimina tra ${Math.round(s / 86400)} g`;
}
