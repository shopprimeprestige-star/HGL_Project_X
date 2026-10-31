/** ── IL PANNELLO «ARCHIVIAZIONE» · LO STATO ─────────────────────────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T9 (piano d). Un piccolo
 *  «negozio» di stato SENZA React (`creaArchivio`), così si prova in Node con
 *  server finti: elenco delle chat, chat aperta con i suoi media (50 per pagina,
 *  cursore keyset), selezione, conferma, lavoro a passi e ripresa. `usaArchivio`
 *  è solo il filo che lo collega ai componenti.
 *
 *  Il browser LEGGE con le funzioni SQL `ponte_wa_archivio_*` (filtro per utente
 *  nel database) e CANCELLA solo dalla rotta del Worker (`liberaAPassi`).
 *
 *  ── Contratto con la chat (T8) ──────────────────────────────────────────────
 *  Quando un lavoro ha liberato dei file, a lavoro finito (anche se si è fermato
 *  o è caduto a metà) il pannello fa partire `window` → `ponte-media-liberati`:
 *  una chat aperta lo ascolta e mostra il segnaposto. Nessun import incrociato.
 *
 *  ⚠️ `conferma()` NON ha nessun `await` prima della prima richiesta: chi chiude il
 *   pannello subito dopo (`distruggi`) la trova già partita e la ferma al passo dopo. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCRM } from "@/crm/AuthContext";
import {
  CHAT_MAX,
  PAGINA,
  leggiChat,
  leggiMedia,
  leggiRiassunto,
  leggiTetto,
  liberaAPassi,
  type Chiedi,
  type ChatArchivio,
  type CorpoLibera,
  type MotivoErrore,
  type Riassunto,
  type VoceMedia,
} from "./archivio";

// ── Le reti, passate da fuori (le prove ci mettono quelle finte) ──────────

export interface RetiArchivio {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string | null } | null }>;
  /** Il valore di `app_config.ponte_immagini` (testo JSON) o `null`. */
  tetto: () => PromiseLike<unknown>;
  chiedi: Chiedi;
}

/** Le tre letture del browser. Le funzioni non sono nei tipi generati: si chiamano per nome. */
const FN_RIASSUNTO = "ponte_wa_archivio_riassunto";
const FN_CHAT = "ponte_wa_archivio_chat";
const FN_MEDIA = "ponte_wa_archivio_media";

const db = supabase as unknown as {
  rpc: RetiArchivio["rpc"];
  from: (t: string) => {
    select: (s: string) => {
      eq: (
        k: string,
        v: string,
      ) => { maybeSingle: () => PromiseLike<{ data: { value?: unknown } | null }> };
    };
  };
};

export const reteReale: RetiArchivio = {
  rpc: (fn, args) => db.rpc(fn, args),
  tetto: async () => {
    const { data } = await db
      .from("app_config")
      .select("value")
      .eq("key", "ponte_immagini")
      .maybeSingle();
    return data?.value ?? null;
  },
  chiedi: fetchCRM,
};

// ── Lo stato ──────────────────────────────────────────────────────────────

export type Lettura =
  | { fase: "carico" }
  | { fase: "errore"; frase: string }
  | {
      fase: "ok";
      riassunto: Riassunto;
      chat: ChatArchivio[];
      /** Le chat sono arrivate in numero pari al massimo: ce ne possono essere di più. */
      piuDi2000: boolean;
      tettoByte: number | null;
    };

export interface ElencoMedia {
  fase: "carico" | "errore" | "ok";
  voci: VoceMedia[];
  /** Non ci sono altre pagine. */
  fine: boolean;
  /** Sta leggendo la pagina dopo. */
  altre: boolean;
}

export type Conferma = { tipo: "chat"; numero: string } | { tipo: "selezione" } | { tipo: "tutto" };

export interface Lavoro {
  fase: "in_corso" | "finito" | "fermato" | "errore";
  previsti: number;
  liberati: number;
  byte: number;
  restano: number | null;
  nonRiusciti: number;
  motivo?: MotivoErrore;
}

export interface StatoArchivio {
  lettura: Lettura;
  /** La chat aperta nel dettaglio; `null` = l'elenco. */
  numero: string | null;
  media: ElencoMedia;
  scelte: string[];
  conferma: Conferma | null;
  lavoro: Lavoro | null;
}

const MEDIA_VUOTI: ElencoMedia = { fase: "ok", voci: [], fine: true, altre: false };
const INIZIALE: StatoArchivio = {
  lettura: { fase: "carico" },
  numero: null,
  media: MEDIA_VUOTI,
  scelte: [],
  conferma: null,
  lavoro: null,
};

export const FRASE_LETTURA = "Non riesco a leggere l'archivio: controlla la connessione e riprova.";
export const FRASE_MANCA =
  "L'archivio non è ancora attivo sul database: manca un aggiornamento da applicare.";
export const FRASE_MEDIA = "Non riesco a leggere i file di questa chat.";

/** La funzione SQL non c'è (migrazione B non applicata): non è un guasto di rete. */
const mancaFunzione = (e: { code?: string | null } | null | undefined) =>
  e?.code === "42883" || e?.code === "PGRST202";

export interface Archivio {
  leggi: () => StatoArchivio;
  iscriviti: (f: () => void) => () => void;
  carica: () => Promise<void>;
  apriChat: (numero: string) => Promise<void>;
  tornaElenco: () => void;
  altre: () => Promise<void>;
  scegli: (chiave: string) => void;
  scegliTutte: () => void;
  svuota: () => void;
  chiedi: (c: Conferma) => void;
  annulla: () => void;
  conferma: () => Promise<void>;
  ferma: () => void;
  riprendi: () => Promise<void>;
  chiudiEsito: () => void;
  distruggi: () => void;
}

const eventoLiberati = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ponte-media-liberati"));
};

export function creaArchivio(reti: RetiArchivio, opz: { notifica?: () => void } = {}): Archivio {
  const notifica = opz.notifica ?? eventoLiberati;
  let stato = INIZIALE;
  const ascolto = new Set<() => void>();
  let vivo = true;
  let fermo = false;
  /** Le letture lente di prima non devono sovrascrivere quelle di dopo. */
  let giroLettura = 0;
  let giroMedia = 0;
  let ultimo: { corpo: CorpoLibera; previsti: number } | null = null;

  const metti = (p: Partial<StatoArchivio>) => {
    stato = { ...stato, ...p };
    ascolto.forEach((f) => f());
  };

  async function carica() {
    const g = ++giroLettura;
    //  La prima volta (o dopo un errore) si vedono gli scheletri; una rilettura tiene i dati finché non arrivano i nuovi.
    if (stato.lettura.fase !== "ok") metti({ lettura: { fase: "carico" } });
    try {
      const [r, ch, tetto] = await Promise.all([
        reti.rpc(FN_RIASSUNTO),
        reti.rpc(FN_CHAT),
        Promise.resolve(reti.tetto()).catch(() => null),
      ]);
      if (g !== giroLettura || !vivo) return;
      const riassunto = r.error ? null : leggiRiassunto(r.data);
      if (!riassunto || ch.error) {
        metti({
          lettura: {
            fase: "errore",
            frase: mancaFunzione(r.error) || mancaFunzione(ch.error) ? FRASE_MANCA : FRASE_LETTURA,
          },
        });
        return;
      }
      metti({
        lettura: {
          fase: "ok",
          riassunto,
          chat: leggiChat(ch.data),
          piuDi2000: Array.isArray(ch.data) && ch.data.length >= CHAT_MAX,
          tettoByte: leggiTetto(tetto),
        },
      });
    } catch {
      if (g === giroLettura && vivo) metti({ lettura: { fase: "errore", frase: FRASE_LETTURA } });
    }
  }

  /** Una pagina di media della chat aperta: la prima (`daCapo`) o la successiva (cursore = ultima riga letta). */
  async function leggiPagina(numero: string, daCapo: boolean) {
    const g = ++giroMedia;
    const ultima = daCapo ? undefined : stato.media.voci.at(-1);
    try {
      const r = await reti.rpc(FN_MEDIA, {
        p_numero: numero,
        p_limite: PAGINA,
        p_prima_il: ultima?.creatoIl ?? null,
        p_prima_chiave: ultima?.chiave ?? null,
      });
      if (g !== giroMedia || !vivo || stato.numero !== numero) return;
      if (r.error || !Array.isArray(r.data)) {
        metti({ media: { ...stato.media, fase: "errore", altre: false } });
        return;
      }
      const nuove = leggiMedia(r.data);
      const gia = new Set((daCapo ? [] : stato.media.voci).map((v) => v.chiave));
      metti({
        media: {
          fase: "ok",
          voci: [...(daCapo ? [] : stato.media.voci), ...nuove.filter((v) => !gia.has(v.chiave))],
          fine: r.data.length < PAGINA,
          altre: false,
        },
      });
    } catch {
      if (g === giroMedia && vivo)
        metti({ media: { ...stato.media, fase: "errore", altre: false } });
    }
  }

  async function apriChat(numero: string) {
    metti({
      numero,
      media: { fase: "carico", voci: [], fine: false, altre: false },
      scelte: [],
      conferma: null,
    });
    await leggiPagina(numero, true);
  }

  async function altre() {
    const m = stato.media;
    if (!stato.numero || m.fase !== "ok" || m.fine || m.altre) return;
    metti({ media: { ...m, altre: true } });
    await leggiPagina(stato.numero, false);
  }

  function tornaElenco() {
    giroMedia++;
    metti({ numero: null, media: MEDIA_VUOTI, scelte: [], conferma: null });
  }

  function scegli(chiave: string) {
    if (!stato.media.voci.some((v) => v.chiave === chiave)) return;
    const gia = stato.scelte.includes(chiave);
    metti({ scelte: gia ? stato.scelte.filter((k) => k !== chiave) : [...stato.scelte, chiave] });
  }

  function scegliTutte() {
    const tutte = stato.media.voci.map((v) => v.chiave);
    metti({ scelte: tutte.length > 0 && stato.scelte.length === tutte.length ? [] : tutte });
  }

  const inCorso = () => stato.lavoro?.fase === "in_corso";

  function chiedi(c: Conferma) {
    if (inCorso() || stato.lettura.fase !== "ok") return;
    const L = stato.lettura;
    if (c.tipo === "tutto" && L.riassunto.file === 0) return;
    if (c.tipo === "chat" && !L.chat.some((x) => x.numero === c.numero)) return;
    if (c.tipo === "selezione" && stato.scelte.length === 0) return;
    metti({ conferma: c });
  }

  function annulla() {
    metti({ conferma: null });
  }

  /** Il lavoro: parte da `prima` (quanto era già stato liberato, se si riprende) e rilegge tutto alla fine. */
  async function lavora(corpo: CorpoLibera, previsti: number, prima: Lavoro | null) {
    ultimo = { corpo, previsti };
    fermo = false;
    const base = { liberati: prima?.liberati ?? 0, byte: prima?.byte ?? 0 };
    metti({
      conferma: null,
      lavoro: {
        fase: "in_corso",
        previsti,
        ...base,
        restano: prima?.restano ?? null,
        nonRiusciti: 0,
      },
    });
    const e = await liberaAPassi(corpo, reti.chiedi, {
      fermato: () => fermo,
      onPasso: (a) =>
        metti({
          lavoro: {
            fase: "in_corso",
            previsti,
            liberati: base.liberati + a.liberati,
            byte: base.byte + a.byte,
            restano: a.restano,
            nonRiusciti: a.nonRiusciti,
          },
        }),
    });
    const liberati = base.liberati + e.liberati;
    metti({
      lavoro: {
        fase: e.esito,
        previsti,
        liberati,
        byte: base.byte + e.byte,
        restano: e.restano ?? prima?.restano ?? null,
        nonRiusciti: e.nonRiusciti,
        motivo: e.motivo,
      },
    });
    if (e.liberati === 0) return; // niente è cambiato: niente evento, niente riletture
    notifica();
    if (!vivo) return;
    metti({ scelte: [] });
    const numero = stato.numero;
    await Promise.all([carica(), numero ? leggiPagina(numero, true) : undefined]);
  }

  async function conferma() {
    const c = stato.conferma;
    const L = stato.lettura;
    if (!c || inCorso() || L.fase !== "ok") return;
    if (c.tipo === "tutto")
      return lavora({ azione: "libera", tutto: true }, L.riassunto.file, null);
    if (c.tipo === "selezione")
      return lavora({ azione: "libera", chiavi: stato.scelte }, stato.scelte.length, null);
    const x = L.chat.find((k) => k.numero === c.numero);
    const quanti = x ? x.foto + x.audio + x.video + x.documento : 0;
    return lavora({ azione: "libera", numero: c.numero }, quanti, null);
  }

  async function riprendi() {
    const l = stato.lavoro;
    if (!ultimo || !l || l.fase === "in_corso" || l.fase === "finito") return;
    return lavora(ultimo.corpo, ultimo.previsti, l);
  }

  return {
    leggi: () => stato,
    iscriviti: (f) => {
      ascolto.add(f);
      return () => void ascolto.delete(f);
    },
    carica,
    apriChat,
    tornaElenco,
    altre,
    scegli,
    scegliTutte,
    svuota: () => metti({ scelte: [], conferma: null }),
    chiedi,
    annulla,
    conferma,
    ferma: () => {
      fermo = true;
    },
    riprendi,
    chiudiEsito: () => metti({ lavoro: null }),
    distruggi: () => {
      vivo = false;
      fermo = true;
      ascolto.clear();
    },
  };
}

// ── Il filo con React ─────────────────────────────────────────────────────

/** Il negozio del pannello. Nasce in un effetto (non nel render) così `StrictMode`, che monta due volte,
 *  non lascia in uso un negozio già distrutto. Prima dell'effetto è `null`. */
export function useNegozioArchivio(): Archivio | null {
  const [archivio, setArchivio] = useState<Archivio | null>(null);
  useEffect(() => {
    const a = creaArchivio(reteReale);
    setArchivio(a);
    return () => a.distruggi();
  }, []);
  return archivio;
}

export function useStatoArchivio(a: Archivio): StatoArchivio {
  return useSyncExternalStore(a.iscriviti, a.leggi, a.leggi);
}
