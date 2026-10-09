/** ACCESSO DEL PRESENTATORE — E DA QUI IN POI ANCHE IL SUO CONTROLLO ─────────
 *  Questo file è due cose insieme: l'endpoint che sblocca il browser del
 *  consulente e il MODULO che tutte le altre rotte /api/presenter/* usano per
 *  sapere CHI sta chiamando. Sta qui e non in un file nuovo perché la rotta
 *  esiste già: nessuna voce da aggiungere all'albero delle rotte.
 *
 *  ── PERCHÉ ────────────────────────────────────────────────────────────────
 *  Fino a ieri /api/presenter/quotes rispondeva a chiunque: nome, cognome,
 *  telefono ed email di clienti veri di un centro medico-estetico uscivano con
 *  una richiesta senza credenziali. E il codice consulente era scritto dentro
 *  file che finiscono nel pacchetto inviato al browser: bastava aprire il
 *  sorgente della pagina per leggerlo.
 *  Da qui in poi:
 *   · il codice consulente NON è più una costante del codice. Sta nella
 *     variabile d'ambiente PRESENTER_CONSULTANT_CODE oppure in app_config
 *     ('consultant_code', con ripiego sul vecchio 'consultant_key'). Se non è
 *     configurato da nessuna parte, il server ne genera uno casuale e lo scrive
 *     nel registro: meglio un accesso da riconfigurare che una password uguale
 *     per tutte le installazioni;
 *   · chi supera il controllo riceve un COOKIE di sessione (HttpOnly): il
 *     browser lo rimanda da solo a ogni chiamata, quindi le pagine che oggi non
 *     mandano nulla continuano a funzionare senza toccarne il codice, e il PIN
 *     non viaggia più a ogni richiesta.
 *
 *  ── COME SI ENTRA ─────────────────────────────────────────────────────────
 *  GET    ?k=<codice>     link magico: sblocca il browser e apre la sessione
 *  GET                    -> { ok, presenter, code, link } se autenticato,
 *                            { ok: false } altrimenti. `code` e `link` escono
 *                            SOLO a chi ha già una sessione: è così che le
 *                            Impostazioni e la barra mostrano "copia il tuo
 *                            link" senza tenersi il codice scritto dentro.
 *  POST   { pin }         il PIN che il consulente già usa ogni giorno
 *  POST   { code }        il codice consulente generale
 *         entrambi rispondono { ok, presenter, code, link }: `code` e `link`
 *         servono all'hub Impostazioni per mostrare il link del presentatore
 *         SENZA tenerselo scritto dentro (falla 2).
 *  DELETE                 esce e cancella la sessione
 *
 *  ── SE NESSUNO RIESCE PIÙ A ENTRARE ───────────────────────────────────────
 *  Un qualsiasi PIN valido di consulente apre la sessione e restituisce il
 *  codice/link aggiornato: è la via di recupero, e non richiede di conoscere il
 *  codice generale.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MOTIVO_PERMESSO,
  accessoPieno,
  risolviAccesso,
  type Accesso,
  type Permesso,
} from "@/crm/permessi";

/** Le rotte protette accettano la credenziale anche in un'intestazione, per i
 *  client che non possono contare sul cookie: va dichiarata al CORS. */
export const INTESTAZIONI_CONSENTITE = "Content-Type, x-presenter-token, x-presenter-code";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  // NIENTE Access-Control-Allow-Credentials: senza, il browser rifiuta di far
  // leggere a un altro sito una risposta ottenuta col nostro cookie.
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, ...extra, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// ── SESSIONE ────────────────────────────────────────────────────────────────
//  Stessa impostazione dell'accesso consulente al CRM (api.consulente.login):
//  una riga in app_config con chiave 'psess:<token>'. app_config non scade da
//  sola, quindi la durata si controlla a ogni lettura e la riga vecchia si
//  cancella lì.
const COOKIE = "hg_psess";
const PREFISSO = "psess:";
/** Quanto può restare FERMA una sessione prima di scadere. È scorrevole: chi
 *  lavora tutti i giorni non deve mai rientrare, chi sparisce per una settimana
 *  sì. Un tempo corto (12 ore, come il CRM) qui costringerebbe il consulente a
 *  ripassare dal link magico a metà giornata, e la prima cosa che farebbe è
 *  incollarselo dove capita. */
const DURATA_MS = 7 * 24 * 60 * 60 * 1000;
/** Il cookie vive più a lungo della sessione: è solo il portatore del token,
 *  chi decide se vale ancora è il server. */
const COOKIE_SEC = 30 * 24 * 60 * 60;
/** Si riscrive la data solo ogni tanto: una scrittura a ogni richiesta
 *  significherebbe un giro sul database per ogni battuta di ricerca. */
const RINFRESCO_MS = 6 * 60 * 60 * 1000;

export interface SessionePresentatore {
  id: string;
  nome: string;
  /** "pin" = è entrato col proprio PIN; "codice" = col codice consulente generale */
  via: "pin" | "codice";
}

async function cfg(key: string): Promise<string> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", key).maybeSingle();
  return ((data as { value?: string | null } | null)?.value ?? "").trim();
}
async function setCfg(key: string, value: string) {
  await supabaseAdmin.from("app_config").upsert(
    { key, value, updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

/** Il token finisce dentro la chiave di app_config: accettarlo come arriva
 *  significherebbe farsi scrivere chiavi arbitrarie da fuori. Solo esadecimale. */
const tokenPulito = (v: unknown): string => {
  const t = String(v ?? "").trim().toLowerCase();
  return /^[a-f0-9]{32,128}$/.test(t) ? t : "";
};

const casuale = (n: number) => {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};

/** Confronto a tempo costante: due chiavi diverse devono costare uguale, o la
 *  durata della risposta racconta quante lettere iniziali erano giuste.
 *  Esportato come `chiaviUguali` per le altre rotte che confrontano un PIN. */
export function uguali(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ── FRENO AI TENTATIVI ──────────────────────────────────────────────────────
//  Un PIN di quattro cifre sono diecimila combinazioni: senza un freno un
//  programma le prova tutte in pochi minuti, e qui dietro ci sono i dati dei
//  clienti. Stessa regola dell'accesso al CRM (api.crm.accesso): cinque errori,
//  poi si aspetta, e ogni blocco successivo dura il doppio del precedente.
//  Si conta per INDIRIZZO: qui non si sceglie un nome da un elenco, quindi non
//  c'è un secondo bersaglio su cui contare.
const SOGLIA = 5;
const FINESTRA_MS = 15 * 60_000;
const BLOCCO_BASE_MS = 5 * 60_000;
const BLOCCO_MAX_MS = 30 * 60_000;
const PREFISSO_TENTATIVI = "ptent:";

interface Tentativi { n: number; liv: number; fino?: string; at: string }

const ipDi = (request: Request): string =>
  (request.headers.get("cf-connecting-ip") || (request.headers.get("x-forwarded-for") ?? "").split(",")[0] || "")
    .trim().toLowerCase().replace(/[^a-z0-9.:]/g, "").slice(0, 45);

/** Quanti secondi mancano alla fine del blocco (0 = non è bloccato). */
const attesaDi = (t?: Tentativi | null): number => {
  if (!t?.fino) return 0;
  const ms = Date.parse(t.fino) - Date.now();
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 1000) : 0;
};

async function leggiTentativi(chiave: string): Promise<Tentativi | null> {
  const raw = await cfg(chiave);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<Tentativi>;
    return { n: Number(t.n) || 0, liv: Number(t.liv) || 0, fino: t.fino, at: String(t.at ?? "") };
  } catch { return null; }
}

/** Registra un errore e fa scattare il blocco alla soglia. */
async function registraErrore(chiave: string, prec: Tentativi | null): Promise<void> {
  const ora = Date.now();
  // Gli errori sparsi in una giornata non si sommano: conta solo la raffica.
  const recente = !!prec?.at && ora - Date.parse(prec.at) < FINESTRA_MS;
  let n = (recente ? prec!.n : 0) + 1;
  let liv = recente ? prec!.liv : 0;
  let fino: string | undefined;
  if (n >= SOGLIA) {
    liv = Math.min(liv + 1, 6);
    fino = new Date(ora + Math.min(BLOCCO_BASE_MS * 2 ** (liv - 1), BLOCCO_MAX_MS)).toISOString();
    // passata l'attesa si riparte da cinque tentativi buoni, ma `liv` non torna
    // indietro: il blocco dopo sarà più lungo
    n = 0;
  }
  await setCfg(chiave, JSON.stringify({ n, liv, fino, at: new Date(ora).toISOString() } as Tentativi));
}

const minuti = (sec: number) => (sec >= 60 ? `${Math.ceil(sec / 60)} minuti` : `${sec} secondi`);

const chiaveFreno = (request: Request) => PREFISSO_TENTATIVI + (ipDi(request) || "ignoto");

/** ── IL FRENO, PER CHIUNQUE CONTROLLI UNA CREDENZIALE ──────────────────────
 *  Anche /api/presenter/presenters fa entrare con un PIN: senza freno lì, il
 *  freno qui non servirebbe a niente — si proverebbero le diecimila
 *  combinazioni dall'altra porta. Si usa così:
 *
 *      const att = await frenoAttesa(request);
 *      if (att) return json({ ok:false, reason:`... ${attesaLeggibile(att)}` }, 429);
 *      ... se la credenziale è sbagliata: await frenoSbagliato(request);
 *      ... se è giusta:                    await frenoOk(request);
 */
export async function frenoAttesa(request: Request): Promise<number> {
  return attesaDi(await leggiTentativi(chiaveFreno(request)));
}
export async function frenoSbagliato(request: Request): Promise<void> {
  const k = chiaveFreno(request);
  await registraErrore(k, await leggiTentativi(k));
}
export async function frenoOk(request: Request): Promise<void> {
  await supabaseAdmin.from("app_config").delete().eq("key", chiaveFreno(request));
}
export const attesaLeggibile = minuti;
export { uguali as chiaviUguali };

function leggiCookie(request: Request, nome: string): string {
  const raw = request.headers.get("cookie") || "";
  for (const pezzo of raw.split(";")) {
    const i = pezzo.indexOf("=");
    if (i < 0) continue;
    if (pezzo.slice(0, i).trim() !== nome) continue;
    try { return decodeURIComponent(pezzo.slice(i + 1).trim()); } catch { return pezzo.slice(i + 1).trim(); }
  }
  return "";
}

/** Il cookie è HttpOnly: nessuno script della pagina può leggerlo, quindi non
 *  finisce nei log del browser né in un'estensione curiosa. SameSite=Lax lo
 *  esclude dalle richieste partite da altri siti. */
export function intestazioneSessione(request: Request, token: string, durataSec = COOKIE_SEC): string {
  const https = new URL(request.url).protocol === "https:";
  return `${COOKIE}=${token}; Path=/; Max-Age=${durataSec}; HttpOnly; SameSite=Lax${https ? "; Secure" : ""}`;
}
export const intestazioneUscita = (request: Request) => intestazioneSessione(request, "", 0);

export async function creaSessione(p: SessionePresentatore): Promise<string> {
  const token = casuale(24);
  await setCfg(PREFISSO + token, JSON.stringify({ ...p, at: new Date().toISOString() }));
  return token;
}

/** Chi sta chiamando, se ha una sessione valida. Null = nessuno. */
export async function sessioneDaRichiesta(request: Request): Promise<SessionePresentatore | null> {
  const token = tokenPulito(leggiCookie(request, COOKIE) || request.headers.get("x-presenter-token"));
  if (!token) return null;
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", PREFISSO + token).limit(1);
  const value = (data as { value?: string | null }[] | null)?.[0]?.value;
  if (!value) return null;
  let s: Partial<SessionePresentatore & { at: string }>;
  try { s = JSON.parse(value) as typeof s; } catch { return null; }
  const nata = Date.parse(s.at ?? "");
  if (!Number.isFinite(nata) || Date.now() - nata > DURATA_MS) {
    await supabaseAdmin.from("app_config").delete().eq("key", PREFISSO + token);
    return null;
  }
  if (!s.nome) return null;
  const sess: SessionePresentatore = { id: s.id ?? "", nome: s.nome, via: s.via === "codice" ? "codice" : "pin" };
  // sessione scorrevole: chi la usa la tiene viva
  if (Date.now() - nata > RINFRESCO_MS) {
    await setCfg(PREFISSO + token, JSON.stringify({ ...sess, at: new Date().toISOString() }));
  }
  return sess;
}

// ── IL CODICE CONSULENTE ────────────────────────────────────────────────────
/** Mai una costante nel codice: variabile d'ambiente, poi database. Se manca
 *  ovunque se ne genera uno e lo si annota nel registro del server — così una
 *  installazione nuova non nasce con la stessa password di tutte le altre. */
export async function codiceConsulente(): Promise<string> {
  const daEnv = String(process.env.PRESENTER_CONSULTANT_CODE ?? "").trim();
  if (daEnv) return daEnv;
  const salvato = (await cfg("consultant_code")) || (await cfg("consultant_key"));
  if (salvato) return salvato;
  const nuovo = `HG-${casuale(6).toUpperCase()}`;
  await setCfg("consultant_code", nuovo);
  console.warn(
    `[PRESENTER] nessun codice consulente configurato: ne è stato generato uno nuovo (${nuovo}). ` +
    "Cambialo dalle Impostazioni o imposta PRESENTER_CONSULTANT_CODE.",
  );
  return nuovo;
}

/** Il PIN del consulente. Prima la tabella vera (consultant_pins), che è
 *  l'unica dove un accesso si può revocare; poi l'elenco dei presentatori
 *  creati a mano dall'hub, che nel CRM non esistono. */
export async function presentatoreDaPin(pin: string): Promise<{ id: string; nome: string } | null> {
  const p = String(pin ?? "").trim();
  if (!/^\d{4,8}$/.test(p)) return null;

  const { data: pins } = await supabaseAdmin
    .from("consultant_pins").select("consultant_id, admin_user_id").eq("pin", p).eq("active", true).limit(1);
  const riga = (pins as { consultant_id: string; admin_user_id: string }[] | null)?.[0];
  if (riga) {
    const { data } = await supabaseAdmin.from("crm_consultants").select("data").eq("id", riga.consultant_id).limit(1);
    const d = (data as { data?: { nome?: string; attivo?: boolean } }[] | null)?.[0]?.data ?? null;
    // un consulente disattivato non entra: la revoca deve valere subito
    if (d && d.attivo !== false) return { id: riga.consultant_id, nome: String(d.nome ?? "").trim() || "Consulente" };
  }

  const raw = await cfg("presenters");
  let lista: { id: string; name: string; pin: string }[] = [];
  try { lista = (JSON.parse(raw || "[]") as typeof lista) || []; } catch { /* nessuno configurato */ }
  const m = lista.find((x) => uguali(String(x?.pin ?? ""), p));
  return m ? { id: m.id, nome: m.name } : null;
}

/** IL CONTROLLO CHE USANO LE ALTRE ROTTE.
 *  Vale la sessione (cookie o intestazione x-presenter-token); in mancanza si
 *  accetta una credenziale in linea — il PIN o il codice consulente — che le
 *  pagine già mandano nel corpo di certe azioni. Sempre verificata QUI, contro
 *  il database: il browser non decide mai da solo di essere autorizzato. */
export async function autorizzaPresentatore(
  request: Request,
  codiceInLinea?: string | null,
): Promise<SessionePresentatore | null> {
  const s = await sessioneDaRichiesta(request);
  if (s) return s;
  const chiave = String(codiceInLinea ?? request.headers.get("x-presenter-code") ?? "").trim();
  if (!chiave) return null;
  if (uguali(chiave, await codiceConsulente())) return { id: "", nome: "codice consulente", via: "codice" };
  const p = await presentatoreDaPin(chiave);
  return p ? { id: p.id, nome: p.nome, via: "pin" } : null;
}

/** Risposta unica per "non sei autorizzato": 401 e nessun dato.
 *  `extra` serve a tenere la forma che il client si aspetta (list: [], edits: {}),
 *  così una pagina non autenticata resta vuota invece di rompersi. */
export function nonAutorizzato(
  intestazioni: Record<string, string>,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({ ok: false, error: "auth", reason: "Accesso presentatore richiesto", ...extra }),
    { status: 401, headers: { ...intestazioni, "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}

/** LA GUARDIA, IN UNA RIGA SOLA.
 *  Le altre rotte /api/presenter/* la usano così:
 *
 *      const no = await guardia(request, cors); if (no) return no;
 *
 *  Restituisce la risposta 401 già pronta se chi chiama non ha diritto di
 *  stare qui, altrimenti `null` e si prosegue. Tenerla in un posto solo
 *  significa che il giorno in cui il controllo cambia, cambia ovunque. */
export async function guardia(
  request: Request,
  intestazioni: Record<string, string>,
  extra: Record<string, unknown> = {},
  codiceInLinea?: string | null,
): Promise<Response | null> {
  const chi = await autorizzaPresentatore(request, codiceInLinea);
  return chi ? null : nonAutorizzato(intestazioni, extra);
}

/* ═══════════════════════════════════════════════════════════════════════════
   E ADESSO ANCHE: NON BASTA ESSERE ENTRATI

   Fin qui la domanda era una sola — "sei dentro?" — e la risposta valeva per
   tutto: chi entrava col PIN per fare una consulenza poteva anche riscrivere il
   listino, creare presentatori e leggere le registrazioni dei colleghi. Un
   consulente standard non ha bisogno di niente di tutto questo.

   Il permesso è lo STESSO del CRM, perché il PIN è lo stesso: si assegna una
   volta sola, nella scheda del consulente, e vale in tutte e due i posti. Qui
   non si aggiunge una seconda tabella di permessi — ce ne sarebbero due da
   tenere allineate, e non lo resterebbero.
   ═════════════════════════════════════════════════════════════════════════ */

/** Che cosa può la persona di questa sessione. Riletto a ogni richiesta e mai
 *  salvato nel cookie: una revoca fatta adesso deve valere adesso. */
export async function accessoPresentatore(s: SessionePresentatore): Promise<Accesso> {
  //  Il codice consulente generale è la chiave di servizio del proprietario: chi
  //  lo possiede ha già in mano tutto, e fingere il contrario sarebbe teatro.
  if (s.via === "codice") return accessoPieno();
  if (!s.id) return risolviAccesso({});

  const { data } = await supabaseAdmin
    .from("consultant_pins")
    .select("permissions")
    .eq("consultant_id", s.id)
    .eq("active", true)
    .limit(1);
  const riga = (data as { permissions?: unknown }[] | null)?.[0];
  //  ── ⚠️ QUI NON SI LEGGONO I MESTIERI, ED È UNA SCELTA ───────────────────
  //   Da quando il permesso è l'unione di ciò che serve a ogni mestiere acceso
  //   (crm/permessi.ts), chi risolve un accesso passa anche la riga del
  //   consulente. Qui no, e senza conseguenze: le rotte del presentatore
  //   chiedono `listino`, `impostazioni`, `consulenti` e `registrazioni.tutte`,
  //   cioè le quattro cose che NESSUN mestiere concede — arrivano solo dalle
  //   chiavi di casa o da una deroga, e quelle si leggono già da qui.
  //   Il giorno in cui una rotta del presentatore chiedesse `preventivi`,
  //   `agenda`, `pagamenti` o `installazioni`, questa funzione comincerebbe a
  //   dire di no a chi ha il diritto di sì: allora — e solo allora — va letta
  //   anche `crm_consultants.data` e passata come secondo argomento.
  //
  //  Nessuna riga = presentatore creato a mano dall'hub, che nel CRM non
  //  esiste: vale il livello più basso (SETTER). È il ripiego giusto — un
  //  permesso concesso per mancanza di dati è il modo peggiore di sbagliare — e
  //  qui non toglie niente a nessuno: le rotte del presentatore chiedono
  //  `listino`, `impostazioni`, `consulenti`, `registrazioni.tutte`, cioè cose
  //  che un presentatore creato a mano non ha mai dovuto fare. Presentare e
  //  fare un preventivo non passano da un permesso.
  return risolviAccesso(riga?.permissions ?? {});
}

/** 403 con il motivo scritto in italiano: chi lo riceve deve capire che non è
 *  un guasto e che non serve riprovare, ma chiedere a un admin. */
export function vietatoP(
  intestazioni: Record<string, string>,
  permesso: Permesso,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({ ok: false, error: "permesso", permesso, reason: MOTIVO_PERMESSO[permesso], ...extra }),
    { status: 403, headers: { ...intestazioni, "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}

/** LA GUARDIA COL PERMESSO. Si usa come l'altra, con una parola in più:
 *
 *      const no = await guardiaP(request, cors, "listino"); if (no) return no;
 */
export async function guardiaP(
  request: Request,
  intestazioni: Record<string, string>,
  permesso: Permesso,
  extra: Record<string, unknown> = {},
  codiceInLinea?: string | null,
): Promise<Response | null> {
  const chi = await autorizzaPresentatore(request, codiceInLinea);
  if (!chi) return nonAutorizzato(intestazioni, extra);
  const accesso = await accessoPresentatore(chi);
  return accesso.puo(permesso) ? null : vietatoP(intestazioni, permesso, extra);
}

const linkPresentatore = (request: Request, code: string) =>
  `${new URL(request.url).origin}/preventivo?unlock=${encodeURIComponent(code)}`;

export const Route = createFileRoute("/api/presenter/consultant")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const k = (new URL(request.url).searchParams.get("k") || "").trim();

        // senza chiave la domanda è un'altra: questo browser è già autenticato?
        if (!k) {
          const s = await sessioneDaRichiesta(request);
          if (!s) return json({ ok: false, presenter: null });
          //  ── IL LINK DEL PRESENTATORE, CHIESTO AL SERVER ──────────────────
          //  Serve alle Impostazioni e alla barra per mostrare "copia il tuo
          //  link". Prima quel link era COSTRUITO NEL BROWSER incollandoci
          //  dentro il codice consulente scritto nel sorgente: chiunque aprisse
          //  la pagina lo leggeva. Adesso il codice non esiste nel pacchetto
          //  inviato al browser — lo consegna il server, e solo a chi ha già
          //  una sessione valida, cioè a chi quel link ce l'ha comunque.
          const code = await codiceConsulente();
          const accesso = await accessoPresentatore(s);
          return json({
            ok: true,
            presenter: { id: s.id, name: s.nome },
            code,
            link: linkPresentatore(request, code),
            //  Serve solo a NASCONDERE le schede che non gli servono: il
            //  rifiuto vero lo dà `guardiaP` su ogni rotta.
            ruolo: accesso.ruolo,
            concessi: accesso.elenco,
          });
        }

        // Anche il link magico passa dal freno: è pur sempre una chiave che si
        // può provare a indovinare, e qui dietro ci sono i dati dei clienti.
        const attesa = await frenoAttesa(request);
        if (attesa) return json({ ok: false, reason: `troppi tentativi: riprova fra ${minuti(attesa)}` }, 429);

        if (!uguali(k, await codiceConsulente())) {
          await frenoSbagliato(request);
          return json({ ok: false });
        }
        await frenoOk(request);
        // Link magico corretto: da qui in poi il browser ha una sessione vera e
        // le rotte con i dati dei clienti gli rispondono. È anche la via con cui
        // un consulente già sbloccato si riprende l'accesso: riapre il suo link.
        const token = await creaSessione({ id: "", nome: "codice consulente", via: "codice" });
        return json({ ok: true }, 200, { "Set-Cookie": intestazioneSessione(request, token) });
      },

      POST: async ({ request }) => {
        let b: { pin?: string; code?: string } = {};
        try { b = (await request.json()) as typeof b; } catch { /* corpo illeggibile = credenziali mancanti */ }

        const chiave = String(b.pin ?? b.code ?? "").trim();
        if (!chiave) return json({ ok: false, reason: "credenziali mancanti" }, 400);

        // ── IL FRENO ───────────────────────────────────────────────────────
        //  Quattro cifre sono diecimila combinazioni: senza questo, provarle
        //  tutte è questione di minuti.
        const attesa = await frenoAttesa(request);
        if (attesa) return json({ ok: false, reason: `troppi tentativi: riprova fra ${minuti(attesa)}` }, 429);

        let sess: SessionePresentatore | null = null;
        if (uguali(chiave, await codiceConsulente())) {
          sess = { id: "", nome: "codice consulente", via: "codice" };
        } else {
          const p = await presentatoreDaPin(chiave);
          if (p) sess = { id: p.id, nome: p.nome, via: "pin" };
        }
        // motivo volutamente generico: distinguere "PIN inesistente" da "PIN
        // giusto ma disattivato" trasformerebbe la risposta in uno strumento
        // per indovinare i PIN.
        if (!sess) {
          await frenoSbagliato(request);
          return json({ ok: false, reason: "credenziali non valide" }, 401);
        }
        // entrato: il conteggio degli errori si azzera
        await frenoOk(request);

        const token = await creaSessione(sess);
        const code = await codiceConsulente();
        const accesso = await accessoPresentatore(sess);
        return json(
          {
            ok: true,
            presenter: { id: sess.id, name: sess.nome },
            code,
            link: linkPresentatore(request, code),
            ruolo: accesso.ruolo,
            concessi: accesso.elenco,
          },
          200,
          { "Set-Cookie": intestazioneSessione(request, token) },
        );
      },

      DELETE: async ({ request }) => {
        const token = tokenPulito(leggiCookie(request, COOKIE) || request.headers.get("x-presenter-token"));
        if (token) await supabaseAdmin.from("app_config").delete().eq("key", PREFISSO + token);
        return json({ ok: true }, 200, { "Set-Cookie": intestazioneUscita(request) });
      },
    },
  },
});
