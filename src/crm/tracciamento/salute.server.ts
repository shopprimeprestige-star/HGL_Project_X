/** ── «TRACCIAMENTO» NELLE IMPOSTAZIONI: LA SALUTE E IL PROPRIETARIO (salute.server.ts) ──
 *  Shop R1 · T30 · PIANO §6.1, D35. Tutto ciò che fa `GET /api/crm/tracciamento` TRANNE il collegamento a `guardiaCRM`
 *  e al client del server (stanno nella rotta): qui si ricevono PORTE, così si prova con finti.
 *
 *  Risponde, in sola lettura:
 *   · se S3 c'è (`attivo`); se non c'è: `{ ok:true, attivo:false, motivo:"non_ancora_attivo" }`, nessun errore;
 *   · il proprietario del tracciamento (`tracciamento_proprietario`): «nessuno», «tu» (questo account) o «altro»;
 *   · di chi è proprietario, quali ID ci sono (solo sì/no) e se è accesa la «modalità prova» (sì/no, mai il codice);
 *   · per Meta e TikTok l'ultimo invio dal server, quanti nelle ultime 24 ore e quanti sono andati male;
 *   · gli ultimi errori, SOLO come codici.
 *
 *  ⚠️ Mai un token, un segreto, un codice di prova, un id utente, un IP o uno user agent nella risposta: si
 *     chiedono solo le colonne che servono e ogni valore esce passando da un filtro di forma.
 *  ⚠️ Il permesso «impostazioni» è il primo passo: se manca non si legge niente.
 *  ⚠️ Nei registri solo codici. Nessuna scrittura, da nessuna parte. */
import type { ClienteDb } from "../ecommerce/ordini.server";

export interface DipendenzeSalute {
  /** La guardia del CRM («impostazioni»): `ok` con l'id dell'account di chi chiama, oppure la risposta 401/403 da restituire così com'è. */
  guardia: (request: Request) => Promise<{ ok: true; utenteId: string } | { ok: false; risposta: Response }>;
  db: ClienteDb;
  adesso: () => Date;
  /** Solo CODICI. */
  log: (codice: string) => void;
}

const PIATTAFORME = ["meta", "tiktok"] as const;
const MAX_ESITI_LETTI = 200;
const MAX_ERRORI = 10;
const VENTIQUATTRO_ORE_MS = 24 * 60 * 60 * 1000;

const json = (o: unknown, stato = 200): Response =>
  new Response(JSON.stringify(o), { status: stato, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const pieno = (v: unknown): boolean => typeof v === "string" && v.trim() !== "";
const codice = (v: unknown): string => (typeof v === "string" && /^[a-z0-9_]{1,40}$/.test(v) ? v : "altro");
const nomeEvento = (v: unknown): string => (typeof v === "string" && /^[A-Za-z0-9_]{1,40}$/.test(v) ? v : "altro");
const quando = (v: unknown): string | null => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

interface Esito {
  piattaforma: string;
  evento: string;
  esito: string;
  quando: string;
  t: number;
}

export async function gestisciGET(request: Request, d: DipendenzeSalute): Promise<Response> {
  try {
    const g = await d.guardia(request);
    if (!g.ok) return g.risposta;
    const adesso = d.adesso();

    // 1. il proprietario: se la tabella non c'è, S3 non è applicata e non si legge altro
    const p = await d.db.from("tracciamento_proprietario").select("user_id").order("creato_il", { ascending: true }).limit(1);
    if (p.error || !Array.isArray(p.data)) return json({ ok: true, attivo: false, motivo: "non_ancora_attivo", adesso: adesso.toISOString() });
    const proprietarioId = (p.data[0] as { user_id?: unknown } | undefined)?.user_id;
    const haProprietario = typeof proprietarioId === "string" && proprietarioId !== "";

    // 2. gli ID e la modalità prova di LUI (solo sì/no): sono quelli che il sito usa davvero
    let pixel: { meta: boolean; tiktok: boolean; ga4: boolean; ads: boolean } | null = null;
    let prova: { meta: boolean; tiktok: boolean } | null = null;
    if (haProprietario) {
      const r = await d.db
        .from("tracking_config")
        .select("meta_pixel_id,tiktok_pixel_id,google_ga4_id,google_ads_id,meta_test_event_code,tiktok_test_event_code")
        .eq("user_id", proprietarioId)
        .limit(1);
      const riga = (!r.error && Array.isArray(r.data) ? (r.data[0] as Record<string, unknown> | undefined) : undefined) ?? {};
      pixel = { meta: pieno(riga.meta_pixel_id), tiktok: pieno(riga.tiktok_pixel_id), ga4: pieno(riga.google_ga4_id), ads: pieno(riga.google_ads_id) };
      prova = { meta: pieno(riga.meta_test_event_code), tiktok: pieno(riga.tiktok_test_event_code) };
    }

    // 3. gli ultimi invii dal server: solo codici
    let piattaforme: unknown = null;
    let errori: unknown = null;
    const e = await d.db
      .from("tracciamento_esiti")
      .select("piattaforma,evento,esito,creato_il")
      .order("creato_il", { ascending: false })
      .limit(MAX_ESITI_LETTI);
    if (!e.error && Array.isArray(e.data)) {
      const righe: Esito[] = [];
      for (const x of e.data as Record<string, unknown>[]) {
        const q = quando(x.creato_il);
        if (!q) continue;
        righe.push({
          piattaforma: PIATTAFORME.includes(x.piattaforma as never) ? (x.piattaforma as string) : "altro",
          evento: nomeEvento(x.evento),
          esito: codice(x.esito),
          quando: q,
          t: Date.parse(q),
        });
      }
      righe.sort((a, b) => b.t - a.t);
      piattaforme = PIATTAFORME.map((nome) => {
        const sue = righe.filter((r) => r.piattaforma === nome);
        const recenti = sue.filter((r) => adesso.getTime() - r.t <= VENTIQUATTRO_ORE_MS);
        const ultimo = sue[0];
        return {
          piattaforma: nome,
          ultimo: ultimo ? { evento: ultimo.evento, esito: ultimo.esito, quando: ultimo.quando } : null,
          invii24h: recenti.length,
          errori24h: recenti.filter((r) => r.esito !== "ok").length,
        };
      });
      errori = righe
        .filter((r) => r.esito !== "ok" && PIATTAFORME.includes(r.piattaforma as never))
        .slice(0, MAX_ERRORI)
        .map((r) => ({ piattaforma: r.piattaforma, evento: r.evento, esito: r.esito, quando: r.quando }));
    }

    return json({
      ok: true,
      attivo: true,
      proprietario: !haProprietario ? "nessuno" : proprietarioId === g.utenteId ? "tu" : "altro",
      pixel,
      prova,
      piattaforme,
      errori,
      adesso: adesso.toISOString(),
    });
  } catch (err) {
    // solo il nome del tipo dell'eccezione: mai il messaggio (potrebbe portare un valore), mai la risposta della piattaforma
    d.log(err instanceof Error ? err.name.toLowerCase().replace(/[^a-z0-9_]/g, "") || "errore" : "errore");
    return json({ ok: false }, 500);
  }
}
