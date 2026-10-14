/** ── LA LETTURA DELLA PAGINA «TRE SOLUZIONI» · SOLO SERVER ──────────────────
 *  Il `loader` della rotta chiama `leggiSoluzioni`, che legge `landing_content`
 *  e restituisce la `VistaSoluzioni` GIÀ FILTRATA: il browser non vede mai il
 *  contenuto grezzo (testi vecchi, file nascosti, URL ostili).
 *
 *  ── Perché il cancello sta anche qui ──────────────────────────────────────
 *  Una `createServerFn` è un indirizzo pubblico: chiunque può chiamarla. Col
 *  cancello chiuso e senza un codice d'anteprima valido risponde `VISTA_VUOTA`
 *  (+ cosa manca): nemmeno il ritratto esce prima della pubblicazione.
 *
 *  ── Perché Supabase lenta o giù = cancello chiuso ─────────────────────────
 *  Tetto di 1,5 s sulla lettura (`AbortSignal` + una corsa col tempo, nel caso
 *  il client non rispetti l'abort). Errore o tetto → `VISTA_VUOTA` → la rotta
 *  manda alla home (302): senza la conferma del video la pagina non si mostra.
 *  Mai un 500. Prezzo accettato: in quei secondi le ads vanno alla home.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_TEXTS, LANDING_SCHEMA, mergeLandingContent, type LandingContent } from "@/landing/landing-content";
import { codiceValido, CHIAVE_ANTEPRIMA } from "./anteprima";
import { mancantiSoluzioni } from "./cancello";
import { destinazioneCancello, ripiegoMacroDaVerificare, VISTA_VUOTA, vistaSoluzioni, type VistaSoluzioni } from "./regole";

export const TETTO_MS = 1500;
/** La `HEAD` del ripiego della clip ha un tetto suo, dentro quello generale. */
const TETTO_HEAD_MS = 500;
/** La scrittura della visita fermata non fa aspettare il 302 più di così. */
export const TETTO_CANCELLO_MS = 300;
const PESO_MASSIMO_CLIP = 1.5 * 1024 * 1024;

/* ── Il poco che serve del client Supabase (il finto delle prove ne ha la stessa forma) ── */
interface Risposta {
  data: unknown;
  error: { message?: string } | null;
}
export interface ClienteContenuti {
  from(tabella: string): {
    select(colonne: string): {
      eq(chiave: string, valore: string): {
        abortSignal(segnale: AbortSignal): { maybeSingle(): PromiseLike<Risposta> };
      };
    };
  };
}
export interface ClienteScrittura {
  from(tabella: string): { insert(riga: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }> };
}

export interface DipendenzeSoluzioni {
  client: ClienteContenuti;
  /** L'origine di `SUPABASE_URL`; vuota = nessun file passa = cancello chiuso. */
  origineStorage: string;
  fotoPatchRipiego: string | null;
  /** `HEAD` del ripiego della clip: true solo se è un video e pesa al più 1,5 MB. */
  verificaClip: (url: string, segnale: AbortSignal) => Promise<boolean>;
  adesso: () => Date;
}

/** Aspetta `p`, ma non oltre `ms`: se il tempo finisce prima, rifiuta. */
function conTetto<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((ok, no) => {
    const t = setTimeout(() => no(new Error(`nessuna risposta in ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        ok(v);
      },
      (e) => {
        clearTimeout(t);
        no(e);
      },
    );
  });
}

/** Una descrizione cancellata nel CRM non lascia un'immagine senza alt: torna quella di fabbrica. */
function conDescrizioni(c: LandingContent): LandingContent {
  const texts = { ...c.texts };
  for (const f of LANDING_SCHEMA.at(-1)?.fields ?? []) {
    if (f.type === "text" && !texts[f.key]?.trim()) texts[f.key] = DEFAULT_TEXTS[f.key] ?? "";
  }
  return { ...c, texts };
}

/** La logica vera, con tutto ciò che tocca il mondo passato dal di fuori (così si prova con un client finto). */
export async function leggiVista(d: DipendenzeSoluzioni, anteprima: string): Promise<VistaSoluzioni> {
  const segnale = AbortSignal.timeout(TETTO_MS);
  try {
    return await conTetto(
      (async () => {
        const leggi = (tabella: string, colonna: string, chiave: string, valore: string) =>
          d.client.from(tabella).select(colonna).eq(chiave, valore).abortSignal(segnale).maybeSingle();
        const [landing, config] = await Promise.all([
          leggi("landing_content", "data", "id", "default"),
          //  Il codice si legge solo se qualcuno ne ha portato uno.
          anteprima ? leggi("app_config", "value", "key", CHIAVE_ANTEPRIMA) : null,
        ]);
        if (landing.error) throw new Error(landing.error.message || "lettura di landing_content non riuscita");
        if (!landing.data) throw new Error("landing_content: nessuna riga");
        const contenuto = conDescrizioni(mergeLandingContent((landing.data as { data?: unknown }).data));
        //  Un errore nel leggere il codice vale «nessun codice»: la pagina pronta si vede lo stesso, quella chiusa no.
        const salvato = config && !config.error ? (config.data as { value?: unknown } | null)?.value : null;
        const inAnteprima = !!anteprima && codiceValido(salvato, anteprima, d.adesso());

        //  La HEAD costa tempo: solo se la pagina si mostrerà e la clip di ripiego serve davvero.
        let macroRipiegoOk = false;
        const daControllare = mancantiSoluzioni(contenuto, d.origineStorage).length === 0 || inAnteprima ? ripiegoMacroDaVerificare(contenuto, d.origineStorage) : null;
        if (daControllare) {
          macroRipiegoOk = await conTetto(d.verificaClip(daControllare, AbortSignal.timeout(TETTO_HEAD_MS)), TETTO_HEAD_MS).catch(() => false);
        }
        return vistaSoluzioni(contenuto, { origineStorage: d.origineStorage, fotoPatchRipiego: d.fotoPatchRipiego, macroRipiegoOk, anteprima: inAnteprima });
      })(),
      TETTO_MS,
    );
  } catch (e) {
    //  Una riga, senza segreti: se Supabase resta giù, le ads vanno alla home e qualcuno deve poterlo capire.
    console.warn("[soluzioni] contenuti non letti, cancello chiuso:", e instanceof Error ? e.message.slice(0, 120) : "errore");
    return VISTA_VUOTA;
  }
}

/** La `HEAD` vera: un video, di peso noto e non oltre 1,5 MB. Peso ignoto = no (prudente). `leggiFile` si cambia solo nelle prove. */
export async function headClip(url: string, segnale: AbortSignal, leggiFile: typeof fetch = fetch): Promise<boolean> {
  try {
    const r = await leggiFile(url, { method: "HEAD", signal: segnale });
    if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("video/")) return false;
    const peso = Number(r.headers.get("content-length"));
    return Number.isFinite(peso) && peso > 0 && peso <= PESO_MASSIMO_CLIP;
  } catch {
    return false;
  }
}

/** La foto del primo articolo in stock del negozio: un valore del codice (non passa da `urlMedia`). */
export function fotoPatchRipiegoDa(prodotti: { stock: number; image?: string }[]): string | null {
  return prodotti.find((p) => p.stock > 0 && p.image?.trim())?.image?.trim() ?? null;
}

/* ── Ingressi delle funzioni del server: testo, e basta ────────────────── */
export const codiceDaInput = (d: unknown): string => {
  const v = (d as { anteprima?: unknown } | undefined)?.anteprima;
  return typeof v === "string" ? v.slice(0, 64) : "";
};
export const ricercaDaInput = (d: unknown): string => {
  const v = (d as { search?: unknown } | undefined)?.search;
  return typeof v === "string" ? v.slice(0, 1000) : "";
};

/** `{ data: { anteprima? } }` → la vista. Mai un'eccezione: se qualcosa va storto, `VISTA_VUOTA`. */
export const leggiSoluzioni = createServerFn({ method: "GET" })
  .inputValidator((d: { anteprima?: string } | undefined) => ({ anteprima: codiceDaInput(d) }))
  .handler(async ({ data }): Promise<VistaSoluzioni> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { PRODUCTS } = await import("@/shop/catalog");
      let origineStorage = "";
      try {
        origineStorage = new URL(process.env.SUPABASE_URL ?? "").origin;
      } catch {
        // SUPABASE_URL assente o storta: nessun file passa, il cancello resta chiuso
      }
      //  shortcut: nessuna intestazione no-store sulla risposta: TanStack non memorizza le GET senza validatori e Cloudflare non
      //  memorizza questi percorsi; aggiungerla (setResponseHeader) se un CDN davanti la tenesse, quando il cancello si apre di colpo.
      return await leggiVista(
        {
          client: supabaseAdmin as unknown as ClienteContenuti,
          origineStorage,
          fotoPatchRipiego: fotoPatchRipiegoDa(PRODUCTS),
          verificaClip: (url, segnale) => headClip(url, segnale),
          adesso: () => new Date(),
        },
        data.anteprima,
      );
    } catch (e) {
      console.warn("[soluzioni] lettura non riuscita, cancello chiuso:", e instanceof Error ? e.message.slice(0, 120) : "errore");
      return VISTA_VUOTA;
    }
  });

/* ── Le visite fermate dal cancello (decisione 15) ─────────────────────── */

/** Una riga di `lp_events` con le stesse colonne di `trackEvent`: solo la fonte dell'annuncio, niente IP, niente user agent. */
export function rigaCancello(search: string, sessione: string): Record<string, unknown> {
  const fonte = new URLSearchParams(destinazioneCancello(search).slice(2));
  const prendi = (k: string) => fonte.get(k) ?? null;
  return {
    event_name: "soluzioni_cancello",
    session_id: sessione,
    step: null,
    payload: { voce: "cancello", pagina: "/soluzioni" },
    utm_source: prendi("utm_source"),
    utm_medium: prendi("utm_medium"),
    utm_campaign: prendi("utm_campaign"),
    utm_id: prendi("utm_id"),
    utm_content: prendi("utm_content"),
    utm_term: prendi("utm_term"),
    fbc: null,
    fbp: null,
    fbclid: prendi("fbclid"),
    device: null,
    is_bot: false,
    ad_id: prendi("ad_id"),
    adset_id: prendi("adset_id"),
    campaign_id: prendi("campaign_id"),
    ad_name: null,
    creative_name: null,
    external_id: null,
    user_agent: null,
  };
}

/** Scrive la riga e aspetta al più 300 ms: il 302 non dipende da questa scrittura. Non lancia mai. */
export async function scriviCancello(client: ClienteScrittura, search: string, sessione: string): Promise<void> {
  try {
    const { error } = await conTetto(client.from("lp_events").insert(rigaCancello(search, sessione)), TETTO_CANCELLO_MS);
    if (error) console.warn("[soluzioni] visita fermata non registrata:", (error.message ?? "errore").slice(0, 120));
  } catch (e) {
    console.warn("[soluzioni] visita fermata non registrata:", e instanceof Error ? e.message.slice(0, 120) : "errore");
  }
}

/** `{ data: { search } }`: la rotta lo chiama quando manda un visitatore alla home. È una funzione del server perché
 *  il `loader` può girare anche nel browser (passando da un'altra pagina) e lì la scrittura non è permessa. */
export const registraCancello = createServerFn({ method: "POST" })
  .inputValidator((d: { search?: string } | undefined) => ({ search: ricercaDaInput(d) }))
  .handler(async ({ data }): Promise<void> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await scriviCancello(supabaseAdmin as unknown as ClienteScrittura, data.search, crypto.randomUUID());
    } catch (e) {
      console.warn("[soluzioni] visita fermata non registrata:", e instanceof Error ? e.message.slice(0, 120) : "errore");
    }
  });
