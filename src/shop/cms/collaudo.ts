/** ── IL COLLAUDO CON CHIAVE (modulo PURO) ──────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T67 (PIANO-R2 D57, approvato dal capo progetto il 21/11). Serve a provare dal telefono lo
 *  shop nuovo e la cassa Stripe in prova sul sito vero SENZA aprirli al pubblico.
 *
 *  Il giro: il CRM (`collaudo_chiave`, permesso «pagamenti») dà un link `…/shop/collaudo#k=<chiave>`. La chiave sta nel FRAMMENTO:
 *  il browser non lo manda mai al server, quindi non finisce nei log di Cloudflare né nel referrer. La pagina `/shop/collaudo` la
 *  legge e la manda con un POST a `/api/public/shop-collaudo`, che la verifica e mette il cookie `__Host-hgl_collaudo`. Con il
 *  cookie valido, SOLO per quel browser: catalogo `cms`, cassa `stripe`, `Cache-Control: private, no-store`. Senza: niente cambia.
 *
 *  ⚠️ Nessun segreto nuovo: la firma usa la chiave di servizio con le etichette `hgl-collaudo-v1` (chiave) e `hgl-collaudo-v1` +
 *   prefisso del messaggio (cookie), come `hgl-eventi-v1` e `hgl-cassa-v1`. La chiave e il cookie hanno messaggi diversi: l'una
 *   non vale come l'altro.
 *  ⚠️ Puro: il segreto, l'orologio e il log arrivano dalle porte. Nei log solo codici; mai la chiave, il cookie o il segreto.
 *  shortcut: la chiave non è monouso (vale 2 ore per chiunque abbia il link), quando serve un solo uso si registra l'uso nel database. */
import { leggiTesto } from "@/crm/negozio/comune";
import { hmacHex } from "@/lib/tracciamento/permesso";
import { ugualiATempoCostante } from "@/shop/cassa/chiave-ordine";

export const NOME_COOKIE = "__Host-hgl_collaudo";
export const ETICHETTA_COLLAUDO = "hgl-collaudo-v1";
/** La chiave del link vale 2 ore; il cookie 4 (anche `Max-Age`). */
export const VALIDITA_CHIAVE_MS = 2 * 3_600_000;
export const VALIDITA_COOKIE_S = 4 * 3600;
/** Tolleranza per un orologio indietro di qualche secondo (non oltre un minuto). */
const TOLLERANZA_MS = 60_000;
/** L'intestazione di tutto ciò che il collaudo cambia: mai in una cache condivisa. */
export const CACHE_COLLAUDO = "private, no-store";
const MAX_CORPO = 2000;

const pieno = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const FORMA = /^(\d{1,16})\.([0-9a-f]{64})$/;
const FORMA_FRAMMENTO = /^[0-9a-f.]{1,100}$/;

type Tipo = "chiave" | "cookie";
/** La firma di un istante, con il messaggio legato al tipo («chiave.<istante>» o «cookie.<istante>»). */
async function firma(segreto: string, tipo: Tipo, emesso: string): Promise<string> {
  return hmacHex(await hmacHex(segreto, ETICHETTA_COLLAUDO), `${tipo}.${emesso}`);
}
async function emetti(segreto: unknown, tipo: Tipo, adesso: unknown): Promise<string> {
  if (!pieno(segreto)) throw new Error("segreto mancante");
  if (typeof adesso !== "number" || !Number.isFinite(adesso) || adesso < 0)
    throw new Error("istante non valido");
  const emesso = String(Math.floor(adesso));
  return `${emesso}.${await firma(segreto, tipo, emesso)}`;
}
/** Firmato da noi con questo segreto, non dal futuro e non più vecchio di `massimoMs`? Mai un'eccezione: qualunque cosa strana è «no». */
async function verifica(
  valore: unknown,
  tipo: Tipo,
  segreto: unknown,
  adesso: unknown,
  massimoMs: number,
): Promise<boolean> {
  try {
    if (
      typeof valore !== "string" ||
      !pieno(segreto) ||
      typeof adesso !== "number" ||
      !Number.isFinite(adesso)
    )
      return false;
    const m = FORMA.exec(valore);
    if (!m) return false;
    if (!ugualiATempoCostante(await firma(segreto, tipo, m[1]), m[2])) return false;
    const eta = adesso - Number(m[1]);
    return eta >= -TOLLERANZA_MS && eta <= massimoMs;
  } catch {
    return false;
  }
}

/** La chiave del link. Lancia se manca il segreto (il Worker non emette). */
export const emettiChiaveCollaudo = (segreto: unknown, adesso: number): Promise<string> =>
  emetti(segreto, "chiave", adesso);
export const verificaChiaveCollaudo = (
  chiave: unknown,
  segreto: unknown,
  adesso: unknown,
): Promise<boolean> => verifica(chiave, "chiave", segreto, adesso, VALIDITA_CHIAVE_MS);
/** Il valore del cookie (stessa forma, messaggio diverso). */
export const emettiCookieCollaudo = (segreto: unknown, adesso: number): Promise<string> =>
  emetti(segreto, "cookie", adesso);
export const verificaCookieCollaudo = (
  valore: unknown,
  segreto: unknown,
  adesso: unknown,
): Promise<boolean> => verifica(valore, "cookie", segreto, adesso, VALIDITA_COOKIE_S * 1000);

/** Il valore del nostro cookie in un'intestazione `Cookie` (il primo se ce ne sono due), o `null`. Il nome deve combaciare intero. */
export function leggiCookie(intestazione: unknown, nome: string = NOME_COOKIE): string | null {
  if (typeof intestazione !== "string") return null;
  for (const parte of intestazione.split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim();
  }
  return null;
}

/** `Set-Cookie`: `__Host-` (quindi `Secure`, `Path=/`, nessun `Domain`), `HttpOnly`, `SameSite=Lax`, 4 ore. */
export const intestazioneSetCookie = (valore: string): string =>
  `${NOME_COOKIE}=${valore}; Max-Age=${VALIDITA_COOKIE_S}; Path=/; Secure; HttpOnly; SameSite=Lax`;

/** L'intestazione `Cookie` porta un cookie del collaudo valido? Senza segreto o con qualunque stranezza: no. */
export async function collaudoValido(
  intestazioneCookie: unknown,
  segreto: unknown,
  adesso: number,
): Promise<boolean> {
  const valore = leggiCookie(intestazioneCookie);
  return valore !== null && (await verificaCookieCollaudo(valore, segreto, adesso));
}

/** Il link per il telefono. La chiave sta nel frammento (mai in `?`): non arriva al server. */
export const linkCollaudo = (sito: string, chiave: string): string =>
  `${sito.replace(/\/+$/, "")}/shop/collaudo#k=${chiave}`;

/** La chiave dal frammento dell'indirizzo («#k=…», anche con altre coppie), o `null` se manca o ha segni strani. */
export function chiaveDaFrammento(frammento: unknown): string | null {
  if (typeof frammento !== "string") return null;
  const k = new URLSearchParams(frammento.replace(/^#/, "")).get("k");
  return k && FORMA_FRAMMENTO.test(k) ? k : null;
}

/* ══ I DUE GESTORI ══════════════════════════════════════════════════════════ */

/** I primi byte di una COPIA del corpo come testo, oppure «» se superano `max`. Non si aspetta la chiusura della copia: su un corpo diviso in due
 *  (`clone`) la chiusura di un ramo resta in attesa finché non si chiude anche l'altro, e quello originale lo legge lo smistamento. */
async function primiByte(copia: Request, max: number): Promise<string> {
  const lettore = copia.body?.getReader();
  if (!lettore) return "";
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > max) {
      void lettore.cancel().catch(() => undefined);
      return "";
    }
    pezzi.push(value);
  }
  const intero = new Uint8Array(totale);
  let da = 0;
  for (const p of pezzi) {
    intero.set(p, da);
    da += p.byteLength;
  }
  return new TextDecoder().decode(intero);
}

const json = (o: unknown, stato: number, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(o), {
    status: stato,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
const codice = (e: unknown): string =>
  String((e as { name?: unknown } | null)?.name ?? "errore")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 30)
    .toLowerCase() || "errore";

export interface PorteCollaudo {
  /** Il segreto, letto adesso dall'ambiente (la chiave di servizio). */
  segreto: () => string | undefined;
  adesso: () => number;
  /** Solo CODICI. */
  log: (codice: string) => void;
}
const RIFIUTO = (): Response => json({ ok: false }, 403);

/** `POST /api/public/shop-collaudo` · `{k}` → cookie. Ogni rifiuto è UGUALE (stessa risposta): chi sbaglia non impara niente. */
export async function gestisciCollaudo(request: Request, porte: PorteCollaudo): Promise<Response> {
  try {
    const testo = await leggiTesto(request, MAX_CORPO).catch(() => "");
    let k: unknown;
    try {
      k = (JSON.parse(testo) as { k?: unknown } | null)?.k;
    } catch {
      return RIFIUTO();
    }
    const segreto = porte.segreto();
    if (!pieno(segreto)) {
      porte.log("collaudo_senza_segreto");
      return RIFIUTO();
    }
    const adesso = porte.adesso();
    if (!(await verificaChiaveCollaudo(k, segreto, adesso))) return RIFIUTO();
    const cookie = await emettiCookieCollaudo(segreto, adesso);
    return json({ ok: true }, 200, { "Set-Cookie": intestazioneSetCookie(cookie) });
  } catch (e) {
    porte.log(`collaudo_${codice(e)}`);
    return RIFIUTO();
  }
}

export interface PorteCollaudoCrm extends PorteCollaudo {
  /** La guardia del CRM («pagamenti»): `{ok:true,…}` oppure `{ok:false, risposta}`. */
  guardia: (
    richiesta: Request,
  ) =>
    | Promise<{ ok: true } | { ok: false; risposta: Response }>
    | { ok: true }
    | { ok: false; risposta: Response };
  /** `SITO`: mai `Host` o `Origin`. */
  sito: string;
}

/** La guardia PRIMA di tutto (anche prima di leggere il corpo); poi, se l'azione è `collaudo_chiave`, il link; altrimenti si passa allo
 *  smistamento, che riceve la guardia già fatta. Il corpo si guarda su una copia e solo se è piccolo: la richiesta resta intera. */
export async function collaudoOSmista<G extends { ok: true }>(
  request: Request,
  porte: Omit<PorteCollaudoCrm, "guardia"> & {
    guardia: (richiesta: Request) => Promise<G | { ok: false; risposta: Response }>;
  },
  smista: (guardia: G) => Promise<Response>,
): Promise<Response> {
  let g: G;
  let collaudo = false;
  try {
    const esito = await porte.guardia(request);
    if (!esito.ok) return esito.risposta;
    g = esito;
    if (Number(request.headers.get("content-length")) <= MAX_CORPO) {
      const testo = await primiByte(request.clone(), MAX_CORPO).catch(() => "");
      try {
        collaudo = (JSON.parse(testo) as { azione?: unknown } | null)?.azione === "collaudo_chiave";
      } catch {
        /* corpo rotto o vuoto: lo rifiuta lo smistamento con la sua frase */
      }
    }
  } catch (e) {
    porte.log(`collaudo_${codice(e)}`);
    return json(
      {
        ok: false,
        motivo: "interno",
        frase: "Qualcosa non ha funzionato: riprova tra un momento.",
      },
      500,
    );
  }
  if (!collaudo) return smista(g);
  try {
    const segreto = porte.segreto();
    if (!pieno(segreto)) {
      porte.log("collaudo_senza_segreto");
      return json(
        {
          ok: false,
          motivo: "non_configurato",
          frase: "Il sito non ha la chiave per firmare il link: chiedi a chi lo gestisce.",
        },
        503,
      );
    }
    const adesso = porte.adesso();
    const chiave = await emettiChiaveCollaudo(segreto, adesso);
    return json(
      {
        ok: true,
        link: linkCollaudo(porte.sito, chiave),
        scadeIl: new Date(adesso + VALIDITA_CHIAVE_MS).toISOString(),
      },
      200,
    );
  } catch (e) {
    porte.log(`collaudo_${codice(e)}`);
    return json(
      {
        ok: false,
        motivo: "interno",
        frase: "Qualcosa non ha funzionato: riprova tra un momento.",
      },
      500,
    );
  }
}
