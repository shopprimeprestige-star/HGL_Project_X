/** ── LA FOTO DEL PONTE NELLA CHAT ───────────────────────────────────────────
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T7 (piano c.3, punto 4).
 *  Il ponte salva la foto in un bucket privato e scrive una riga in
 *  `ponte_wa_media`; la chat la mostra così:
 *    1. la riga si legge dal database (RLS: chi vede le chat vede le foto), tutte
 *       le righe della chat in UNA lettura sola (`leggiRiga` raggruppa i messaggi
 *       che la chiedono nello stesso istante);
 *    2. al tocco si chiede l'indirizzo firmato (5 minuti) a `GET /api/crm/ponte-media`;
 *    3. la foto si scarica in memoria e si mostra da un indirizzo `blob:` locale.
 *  Senza riga (foto vecchia, ponte spento, lettura fallita) la bolla resta il
 *  testo «📷 Foto» di sempre.
 *
 *  ⚠️ L'indirizzo firmato vive solo dentro `caricaFoto`: non va mai in uno stato
 *   React, in un `src`, in un `href` né nel DOM (è una chiave d'accesso per 5
 *   minuti). Per questo la foto passa da `fetch` + `blob:` invece che da un
 *   `<img src=firmato>`. La `blob:` si libera quando la bolla sparisce.
 *  ⚠️ Nessun log: questo file non scrive niente.
 *  ⚠️ Funzioni pure (`fotoDelPonte`, `caricaFoto`) senza React né database: le
 *   prove (`prove/ponte/immagini-chat-ui.mjs`) le chiamano con una rete finta. */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCRM } from "@/crm/AuthContext";

// ── Quale messaggio è una foto del ponte ──────────────────────────────────

/** `bw:<cifre>:<id WhatsApp>` (src/crm/ponte/tipi.ts). Cifre e id restano corti: finiscono in un indirizzo. */
const CHIAVE = /^bw:\d{5,20}:[A-Za-z0-9_.-]{1,128}$/;
/** Il segnaposto che scrive il ponte (`SEGNAPOSTO.foto`), con la didascalia dopo i due punti se c'è. */
const SEGNAPOSTO_FOTO = /^📷️?\s*Foto(?::\s*([\s\S]*))?$/u;

/** Se il messaggio è la foto di una riga del ponte: la chiave e la didascalia (o `""`). Altrimenti `null`.
 *  Vale in entrata e in uscita (la foto mandata dal telefono). */
export function fotoDelPonte(m: {
  canale?: string | null;
  wa_message_id?: string | null;
  body?: string | null;
}): { chiave: string; didascalia: string } | null {
  if (m.canale !== "baileys") return null;
  const chiave = m.wa_message_id ?? "";
  if (!CHIAVE.test(chiave)) return null;
  const s = SEGNAPOSTO_FOTO.exec((m.body ?? "").trim());
  return s ? { chiave, didascalia: (s[1] ?? "").trim() } : null;
}

// ── Chiedere e scaricare la foto ──────────────────────────────────────────

/** Il peso massimo accettato (il bucket è a 8 MiB; il margine copre l'involucro). */
const PESO_MAX = 9 * 1024 * 1024;
const TIPI_FOTO = ["image/jpeg", "image/png", "image/webp"];

export const FRASE_NON_PIU = "La foto non è più disponibile.";
export const FRASE_RIPROVA = "Non riesco a caricare la foto.";

export type EsitoFoto = { ok: true; blob: Blob } | { ok: false; frase: string; riprova: boolean };

/** Le due richieste, passate da fuori (le prove ci mettono quelle finte). */
export interface RetiFoto {
  /** Come `fetchCRM`: aggiunge la sessione e, se scaduta, la rinnova una volta. */
  chiedi: (percorso: string, init: RequestInit) => Promise<Response>;
  /** Come `fetch`, per scaricare dall'indirizzo firmato. */
  scarica: (url: string, init: RequestInit) => Promise<Response>;
  segnale?: AbortSignal;
}

const guasto = (riprova = true): EsitoFoto => ({ ok: false, frase: FRASE_RIPROVA, riprova });

/** Chiede l'indirizzo firmato, scarica la foto e la restituisce come `Blob`.
 *  Non lancia mai: ogni guasto è un `{ ok:false, frase, riprova }` da mostrare. */
export async function caricaFoto(chiave: string, reti: RetiFoto): Promise<EsitoFoto> {
  try {
    const r = await reti.chiedi(`/api/crm/ponte-media?chiave=${encodeURIComponent(chiave)}`, {
      method: "GET",
      cache: "no-store",
      signal: reti.segnale,
    });
    //  404: la riga non c'è (più) o non è di questo utente: ritentare non serve.
    if (r.status === 404) return { ok: false, frase: FRASE_NON_PIU, riprova: false };
    if (!r.ok) return guasto();
    const corpo: unknown = await r.json().catch(() => null);
    const url = (corpo as { ok?: unknown; url?: unknown } | null)?.url;
    if (typeof url !== "string") return guasto();
    //  Solo https: la rotta è nostra, ma il browser non deve mai scaricare da altro.
    if (new URL(url).protocol !== "https:") return guasto();
    const f = await reti.scarica(url, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: reti.segnale,
    });
    if (!f.ok) return guasto();
    const blob = await f.blob();
    //  Solo i tre tipi che il ponte accetta (mai SVG o HTML), e un peso sensato.
    if (!TIPI_FOTO.includes(blob.type) || blob.size === 0 || blob.size > PESO_MAX)
      return guasto(false);
    return { ok: true, blob };
  } catch {
    return guasto(); // rete assente, indirizzo illeggibile, richiesta annullata
  }
}

// ── La riga in `ponte_wa_media`, letta a gruppi ───────────────────────────

export type StatoRiga = "pronta" | "in_arrivo" | "nessuna";

/** La catena di Supabase ridotta ai metodi usati: i tipi generati non conoscono la tabella nuova. */
interface Catena {
  select: (s: string) => Catena;
  in: (
    k: string,
    v: string[],
  ) => Promise<{
    data: { chiave: string; stato: string }[] | null;
    error: unknown;
  }>;
}

/** Quanto vale una risposta «non ancora pronta» prima di rileggerla. */
const VALIDA_MS = 30_000;
/** Righe per lettura: gli indirizzi restano corti anche con molte foto in chat. */
const PER_LETTURA = 100;

interface Voce {
  p: Promise<StatoRiga>;
  quando: number;
  pronta: boolean;
}
const cache = new Map<string, Voce>();
let lotto: { chiavi: Set<string>; esito: Promise<Map<string, StatoRiga>> } | null = null;

async function leggiLotto(chiavi: string[]): Promise<Map<string, StatoRiga>> {
  const trovate = new Map<string, StatoRiga>();
  for (let i = 0; i < chiavi.length; i += PER_LETTURA) {
    const { data, error } = await (supabase as unknown as { from: (t: string) => Catena })
      .from("ponte_wa_media")
      .select("chiave,stato")
      .in("chiave", chiavi.slice(i, i + PER_LETTURA));
    if (error) throw new Error("lettura");
    for (const r of data ?? [])
      trovate.set(r.chiave, r.stato === "pronta" ? "pronta" : "in_arrivo");
  }
  return trovate;
}

/** Lo stato della riga di una foto. Chi lo chiede nello stesso istante (le bolle
 *  di una chat che si apre) condivide UNA lettura. `pronta` resta in memoria; il
 *  resto vale 30 s, e `fresco` lo rilegge subito. Rifiuta se la lettura fallisce. */
export function leggiRiga(chiave: string, fresco = false): Promise<StatoRiga> {
  const v = cache.get(chiave);
  if (v && !fresco && (v.pronta || Date.now() - v.quando < VALIDA_MS)) return v.p;
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
    p: lotto.esito.then((m) => m.get(chiave) ?? "nessuna"),
    quando: Date.now(),
    pronta: false,
  };
  voce.p.then(
    (s) => {
      voce.pronta = s === "pronta";
    },
    () => {
      if (cache.get(chiave) === voce) cache.delete(chiave); // un guasto non si ricorda
    },
  );
  cache.set(chiave, voce);
  return voce.p;
}

// ── Il gancio della bolla ─────────────────────────────────────────────────

/** Fino a quando un messaggio è «appena arrivato»: la sua riga potrebbe comparire fra poco. */
const RECENTE_MS = 15 * 60_000;
const OGNI_MS = 15_000;

/** Dopo il tocco: carico, foto da mostrare (`src` è una `blob:` locale), o errore. */
type AzioneFoto =
  | { fase: "carico" }
  | { fase: "vista"; src: string }
  | { fase: "errore"; frase: string; riprova: boolean };

export type FaseFoto = { fase: "verifica" | "nessuna" | "in_arrivo" | "pronta" } | AzioneFoto;

/** Le fasi della foto di una bolla. `chiave` nulla = non è una foto del ponte (nessuna lettura).
 *  `creatoIl`: per un messaggio appena arrivato la riga si rilegge ogni 15 s finché non è pronta
 *  (shortcut: niente tempo reale per `ponte_wa_media`, basta questo per i messaggi vivi; sui vecchi
 *  si legge una volta sola, e riaprire la chat rilegge). */
export function useMediaPonte(
  chiave: string | null,
  creatoIl: string,
): {
  stato: FaseFoto;
  mostra: () => void;
  ricontrolla: () => void;
  /** Il file è arrivato ma il browser non lo disegna. */
  nonSiApre: () => void;
} {
  const [riga, setRiga] = useState<StatoRiga | null>(null);
  const [azione, setAzione] = useState<AzioneFoto | null>(null);
  const vivo = useRef(true);
  const inCorso = useRef(false);
  const annulla = useRef<AbortController | null>(null);
  const blobUrl = useRef<string | null>(null);

  const libera = useCallback(() => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = null;
  }, []);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      annulla.current?.abort();
      libera();
    };
  }, [libera]);

  const leggi = useCallback(
    (fresco: boolean) => {
      if (!chiave) return;
      leggiRiga(chiave, fresco).then(
        (s) => vivo.current && setRiga(s),
        () => vivo.current && setRiga((r) => r ?? "nessuna"), // rete o permessi: resta «Foto»
      );
    },
    [chiave],
  );

  useEffect(() => {
    leggi(false);
  }, [leggi]);

  const finita = riga === "pronta";
  useEffect(() => {
    if (!chiave || finita || !(Date.now() - Date.parse(creatoIl) < RECENTE_MS)) return;
    const giro = setInterval(() => {
      if (document.visibilityState !== "hidden") leggi(true);
    }, OGNI_MS);
    return () => clearInterval(giro);
  }, [chiave, creatoIl, finita, leggi]);

  const mostra = useCallback(() => {
    if (!chiave || inCorso.current) return;
    inCorso.current = true;
    libera();
    const ctrl = new AbortController();
    annulla.current = ctrl;
    setAzione({ fase: "carico" });
    void caricaFoto(chiave, { chiedi: fetchCRM, scarica: fetch, segnale: ctrl.signal }).then(
      (e) => {
        inCorso.current = false;
        if (!vivo.current) return;
        if (!e.ok) return setAzione({ fase: "errore", frase: e.frase, riprova: e.riprova });
        const src = URL.createObjectURL(e.blob);
        blobUrl.current = src;
        setAzione({ fase: "vista", src });
      },
    );
  }, [chiave, libera]);

  const nonSiApre = useCallback(() => {
    libera();
    setAzione({ fase: "errore", frase: FRASE_RIPROVA, riprova: true });
  }, [libera]);

  const stato: FaseFoto = azione ?? { fase: riga ?? "verifica" };
  return { stato, mostra, ricontrolla: () => leggi(true), nonSiApre };
}
