/* eslint-disable @typescript-eslint/no-explicit-any -- il database è un client Supabase (vero sul server, finto nelle prove) */
/*  ── IL MITTENTE DEGLI EVENTI LATO SERVER (Meta e TikTok) ───────────────────────
    Shop R1 · T25 · PIANO D13, D14, D16, 6A n. 3, 5, 6. Riceve un evento di NAVIGAZIONE dal browser (con il permesso
    a breve scadenza di `permesso.ts`) e lo manda a Meta e TikTok con lo stesso `event_id` di quello del browser.

    ⚠️ NON È `capi`. Qui passano solo nomi di navigazione (`NOMI_MITTENTE`); `Purchase` e simili → 403, sempre.
    ⚠️ L'INDIRIZZO LO COSTRUISCE IL SERVER col suo dominio (`sito` + percorso ammesso + sole chiavi di query ammesse):
       quello che il client dichiara, a parte `percorso` e `query`, si ignora. `consenso: true` è un'ATTESTAZIONE del browser:
       il server non può verificarla (la difesa vera è che il browser non la manda senza consenso).
    ⚠️ Dati personali: nessuno. Nel corpo per le piattaforme c'è solo l'evento e, del dispositivo, IP e user agent
       DALLE INTESTAZIONI della richiesta (servono alla corrispondenza). Mai email, telefono, nome, né dal corpo né da altrove.
    ⚠️ I token (Meta, TikTok) non escono mai: né nelle risposte (che dicono solo `{ok}`), né nel registro (solo codici
       brevi), né in un indirizzo (Meta: nel corpo; TikTok: in intestazione).
    ⚠️ Il limite di frequenza è IN MEMORIA dell'isolato: su Cloudflare Workers ogni isolato ha la sua memoria, quindi è
       quasi inefficace. È un attrito. La difesa vera è una regola di limite nel pannello Cloudflare su `/api/public/evento*`
       (60 richieste al minuto per indirizzo): da consigliare al titolare.
    ⚠️ Senza chiave di servizio risponde 503 e non invia (fail closed). Senza un PROPRIETARIO della configurazione
       (`tracciamento_proprietario`, D35) non invia niente: i pixel e i token sono quelli della sua riga di `tracking_config`,
       non quelli di chiunque abbia una sessione. */
import { percorsoAmmesso, urlPulito } from "./ammesse";
import { costruisciEvento } from "./eventi";
import { nomeAmmesso } from "./nomi";
import { idPulito, leggiRigaProprietario, type DbLettura } from "./config-pubblica";
import { derivaChiave, emettiPermesso, verificaPermesso } from "./permesso";

export type StatoMittente = { finestre: Map<string, number[]>; ultimaPulizia: number };
export type DepsMittente = {
  db: DbLettura;
  adesso: () => number;
  fetch: (url: string, init: any) => Promise<{ ok: boolean; status: number }>;
  /** La chiave di servizio (da cui si deriva quella dei permessi). Mancante → 503. */
  chiave: unknown;
  /** Riceve solo codici brevi (`meta_http_400`), mai dati. */
  log: (codice: string) => void;
  /** Il dominio pubblico del sito (`SITO`). */
  sito: string;
  /** Lo stato del limite e della pulizia; in produzione quello del modulo, nelle prove uno nuovo. */
  stato?: StatoMittente;
};
export type RichiestaEvento = { corpo: unknown; ip: string; userAgent: string };
export type Risposta<T = Record<never, never>> = { stato: number; corpo: { ok: boolean } & Partial<T> };

const statoDelModulo: StatoMittente = { finestre: new Map(), ultimaPulizia: 0 };
const FINESTRA_MS = 60_000;
const MAX_PER_FINESTRA = 60;
const PULIZIA_OGNI_MS = 60 * 60 * 1000;
const CONSERVA_MS = 30 * 24 * 60 * 60 * 1000;
/** Nomi d'acquisto ridotti a minuscole senza segni (come la seconda rete di `capi`): mai ammessi, nemmeno scritti strani. */
const VIETATI_RIDOTTI = new Set(["purchase", "completepayment", "placeanorder", "refund", "orderplaced", "paymentfailed"]);
const ridotto = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
const KO = (stato: number): Risposta => ({ stato, corpo: { ok: false } });
const chiaveValida = (k: unknown): k is string => typeof k === "string" && k.length > 0;

/** Finestra scorrevole in memoria: 60 richieste al minuto per chiave. */
function entraNelLimite(stato: StatoMittente, chi: string, ora: number): boolean {
  // shortcut: la mappa si svuota se cresce oltre 5000 indirizzi (memoria dell'isolato), si cambia se serve un limite vero (è il compito della regola Cloudflare).
  if (stato.finestre.size > 5000) stato.finestre.clear();
  const recenti = (stato.finestre.get(chi) ?? []).filter((t) => ora - t < FINESTRA_MS);
  if (recenti.length >= MAX_PER_FINESTRA) {
    stato.finestre.set(chi, recenti);
    return false;
  }
  recenti.push(ora);
  stato.finestre.set(chi, recenti);
  return true;
}

/** Le impostazioni per inviare: la riga del PROPRIETARIO (D35), mai quella di un altro utente. Senza proprietario, niente. */
async function leggiConfigInvio(db: DbLettura): Promise<Record<string, unknown> | null> {
  const { riga } = await leggiRigaProprietario(db, ["meta_pixel_id", "meta_access_token", "meta_test_event_code", "tiktok_pixel_id", "tiktok_access_token", "tiktok_test_event_code"]);
  return riga;
}

/** Una chiamata a una piattaforma: restituisce solo un CODICE («ok», «http_400», «errore_rete»). */
async function invia(deps: DepsMittente, url: string, init: any): Promise<string> {
  try {
    const r = await deps.fetch(url, init);
    return r.ok ? "ok" : `http_${r.status}`;
  } catch {
    return "errore_rete";
  }
}

export async function gestisciEvento(richiesta: RichiestaEvento, deps: DepsMittente): Promise<Risposta> {
  const ora = deps.adesso();
  const stato = deps.stato ?? statoDelModulo;
  if (!chiaveValida(deps.chiave)) {
    deps.log("chiave_mancante");
    return KO(503);
  }
  if (!entraNelLimite(stato, `e:${richiesta.ip || "ignoto"}`, ora)) {
    deps.log("limite_superato");
    return KO(429);
  }
  const b = richiesta.corpo as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || Array.isArray(b)) return KO(400);

  if (!(await verificaPermesso(b.permesso, await derivaChiave(deps.chiave), ora))) {
    deps.log("permesso_non_valido");
    return KO(401);
  }
  if (b.consenso !== true) return KO(400);
  const nome = b.nome;
  if (typeof nome === "string" && VIETATI_RIDOTTI.has(ridotto(nome))) {
    deps.log("nome_vietato");
    return KO(403);
  }
  if (!nomeAmmesso(nome)) return KO(400);
  const eventId = b.eventId;
  if (typeof eventId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(eventId)) return KO(400);
  const query = typeof b.query === "string" ? b.query.slice(0, 500) : "";
  if (!percorsoAmmesso(b.percorso, query, false)) return KO(400);
  const ev = costruisciEvento(nome, b.dati && typeof b.dati === "object" ? (b.dati as never) : undefined, { eventId });
  if (!ev) return KO(400);

  // l'indirizzo lo costruisce il server: il suo dominio, il percorso ammesso, le sole chiavi di query ammesse
  const url = urlPulito(deps.sito, b.percorso, query);
  const ip = richiesta.ip ? String(richiesta.ip).slice(0, 64) : "";
  const ua = richiesta.userAgent ? String(richiesta.userAgent).slice(0, 500) : "";
  const tempo = Math.floor(ora / 1000);
  const cfg = await leggiConfigInvio(deps.db);
  const esiti: { piattaforma: string; esito: string }[] = [];

  const idMeta = idPulito(cfg?.meta_pixel_id);
  const tokMeta = idPulito(cfg?.meta_access_token);
  const idTikTok = idPulito(cfg?.tiktok_pixel_id);
  const tokTikTok = idPulito(cfg?.tiktok_access_token);

  const invii: Promise<void>[] = [];
  const meta = ev.meta;
  if (idMeta && tokMeta && meta) {
    const corpo: Record<string, unknown> = {
      data: [
        {
          event_name: meta.nome,
          event_time: tempo,
          event_id: eventId,
          action_source: "website",
          event_source_url: url,
          user_data: { ...(ip && { client_ip_address: ip }), ...(ua && { client_user_agent: ua }) },
          custom_data: meta.parametri,
        },
      ],
      access_token: tokMeta,
    };
    const prova = idPulito(cfg?.meta_test_event_code);
    if (prova) corpo.test_event_code = prova;
    invii.push(invia(deps, `https://graph.facebook.com/v19.0/${idMeta}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).then((e) => void esiti.push({ piattaforma: "meta", esito: e })));
  }
  const tiktok = ev.tiktok;
  if (idTikTok && tokTikTok && tiktok) {
    const corpo: Record<string, unknown> = {
      pixel_code: idTikTok,
      event_source: "web",
      data: [
        {
          event: tiktok.nome,
          event_id: eventId,
          event_time: tempo,
          user: { ...(ip && { ip }), ...(ua && { user_agent: ua }) },
          properties: tiktok.parametri,
          page: { url },
        },
      ],
    };
    const prova = idPulito(cfg?.tiktok_test_event_code);
    if (prova) corpo.test_event_code = prova;
    invii.push(invia(deps, "https://business-api.tiktok.com/open_api/v1.3/event/track/", { method: "POST", headers: { "Content-Type": "application/json", "Access-Token": tokTikTok }, body: JSON.stringify(corpo) }).then((e) => void esiti.push({ piattaforma: "tiktok", esito: e })));
  }
  await Promise.all(invii);
  esiti.sort((x, y) => (x.piattaforma < y.piattaforma ? -1 : 1)); // meta prima di tiktok, sempre
  for (const e of esiti) {
    if (e.esito !== "ok") deps.log(`${e.piattaforma}_${e.esito}`);
    // il registro è un di più: se la tabella manca (S3 non applicata) l'evento è già partito
    try {
      await deps.db.from("tracciamento_esiti").insert({ piattaforma: e.piattaforma, evento: nome, event_id: eventId, esito: e.esito });
    } catch {
      /* niente registro, nessun danno */
    }
  }
  if (esiti.length && ora - stato.ultimaPulizia >= PULIZIA_OGNI_MS) {
    stato.ultimaPulizia = ora;
    try {
      await deps.db.from("tracciamento_esiti").delete().lt("creato_il", new Date(ora - CONSERVA_MS).toISOString());
    } catch {
      /* la pulizia riprova fra un'ora */
    }
  }
  return { stato: 200, corpo: { ok: true } };
}

/** `GET /api/public/evento-permesso`: un permesso di 10 minuti. È un attrito, non un'autenticazione (D16). */
export async function gestisciPermesso(richiesta: { ip: string }, deps: DepsMittente): Promise<Risposta<{ permesso: string }>> {
  const ora = deps.adesso();
  if (!chiaveValida(deps.chiave)) {
    deps.log("chiave_mancante");
    return { stato: 503, corpo: { ok: false } };
  }
  if (!entraNelLimite(deps.stato ?? statoDelModulo, `p:${richiesta.ip || "ignoto"}`, ora)) {
    deps.log("limite_superato");
    return { stato: 429, corpo: { ok: false } };
  }
  return { stato: 200, corpo: { ok: true, permesso: await emettiPermesso(await derivaChiave(deps.chiave), ora) } };
}
