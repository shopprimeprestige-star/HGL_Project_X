/** ── SHOP R1 · T29 · `capi` DECIDE IN BASE A CHI CHIAMA (D17, nota A del revisore) ──
 *  `supabase/functions/capi/filtro.ts` è puro (nessuna API di Deno): qui lo si compila con esbuild e lo si
 *  prova davvero. `index.ts` si prova sul testo (vive in Deno, non si esegue): il filtro è chiamato PRIMA
 *  di ogni invio a Meta/TikTok e di ogni scrittura, e il resto del file è identico a quello del ramo base.
 *  Dati: nomi di eventi, nessun dato personale. */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

/** Il commit del ramo base (R2, prima di questa commessa): `index.ts` di allora è il riferimento. */
const BASE = "aac63b5";
const caricaTs = (percorso) =>
  import(`data:text/javascript;base64,${Buffer.from(transformSync(readFileSync(percorso, "utf8"), { loader: "ts", format: "esm" }).code).toString("base64")}`);
const AMMESSI = ["PageView", "ViewContent", "AddToCart", "Lead", "HighQualityVisit", "BookingDatePick", "BookingTimePick"];

/** Tutti i file .ts/.tsx sotto src/ (senza node_modules). */
function sorgenti(cartella, acc = []) {
  for (const f of readdirSync(cartella)) {
    const p = join(cartella, f);
    if (statSync(p).isDirectory()) sorgenti(p, acc);
    else if (/\.(ts|tsx)$/.test(f) && !f.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T29 · capi DECIDE IN BASE A CHI CHIAMA (20/11/2026, con D35)");
  const dirCapi = join(radice, "supabase/functions/capi");
  const pFiltro = join(dirCapi, "filtro.ts");
  const pIndex = join(dirCapi, "index.ts");
  c("filtro.ts esiste accanto a index.ts", true, existsSync(pFiltro));
  if (!existsSync(pFiltro)) return;
  const F = await caricaTs(pFiltro);
  const { decidi, normalizzaNome, NOMI_AMMESSI } = F;
  const anonimo = (nome) => decidi({ nome, autenticato: false, membroCrm: false }).ok;
  const utente = (nome) => decidi({ nome, autenticato: true, membroCrm: false }).ok;
  const membro = (nome) => decidi({ nome, autenticato: true, membroCrm: true }).ok;

  /* ── chi non ha un utente verificato: solo l'elenco, esatto ── */
  c("l'elenco degli ammessi è quello di D17 (sette nomi)", AMMESSI, [...NOMI_AMMESSI]);
  c("anonimo: Lead, PageView, ViewContent, HighQualityVisit, BookingDatePick, BookingTimePick, AddToCart → ok", AMMESSI.map(() => true), AMMESSI.map(anonimo));
  c("anonimo: Purchase, purchase, PURCHASE, « Purchase», «Purchase » → NO", [false, false, false, false, false],
    ["Purchase", "purchase", "PURCHASE", " Purchase", "Purchase "].map(anonimo));
  c("anonimo: PlaceAnOrder, CompletePayment, Refund, OrderPlaced, PaymentFailed, Subscribe → NO", [false, false, false, false, false, false],
    ["PlaceAnOrder", "CompletePayment", "Refund", "OrderPlaced", "PaymentFailed", "Subscribe"].map(anonimo));
  c("anonimo: nome con carattere invisibile (Purchase\\u200b, Lead\\u200b, PageView con U+00A0 in mezzo) → NO", [false, false, false],
    ["Purchase​", "Lead​", "Page View"].map(anonimo));
  c("anonimo: maiuscole e minuscole contano (lead, PAGEVIEW) → NO", [false, false], ["lead", "PAGEVIEW"].map(anonimo));
  c("anonimo: Purchase a larghezza piena (Ｐurchase) o con segni (Pürchase) → NO", [false, false], ["Ｐurchase", "Pürchase"].map(anonimo));
  c("anonimo: nomi vuoti o non testo (\"\", null, 42, oggetto, lista) → NO", [false, false, false, false, false],
    ["", null, 42, { toString: () => "Lead" }, ["Lead"]].map(anonimo));
  c("anonimo: «Lead » con spazio in coda vale come Lead (trim) e il nome da mandare è quello pulito", [true, "Lead"],
    [anonimo("Lead "), decidi({ nome: "Lead ", autenticato: false, membroCrm: false }).nome]);
  c("normalizzaNome: NFKC + trim (Ｌead → Lead, spazi tolti, non-testo → vuoto)", ["Lead", "Lead", ""], [normalizzaNome("Ｌead"), normalizzaNome("  Lead\n"), normalizzaNome(null)]);
  c("il rifiuto dice il motivo (event_not_allowed) e non ha il campo nome", [false, "event_not_allowed", false],
    ((e) => [e.ok, e.motivo, "nome" in e])(decidi({ nome: "Purchase", autenticato: false, membroCrm: false })));
  /* seconda rete: se per errore un nome d'acquisto entrasse nell'elenco, il filtro lo ferma lo stesso */
  const sbagliato = ["Purchase", "CompletePayment", "PlaceAnOrder", "Refund", "OrderPlaced", "PaymentFailed", " purchase", "Purchase", "Ｐurchase"];
  c("seconda rete: anche se Purchase & C. fossero nell'elenco, un anonimo NON passa (nome ridotto a minuscole senza segni)", sbagliato.map(() => false),
    sbagliato.map((nome) => decidi({ nome, autenticato: false, membroCrm: false }, [...AMMESSI, ...sbagliato]).ok));
  c("seconda rete: Pu-r_chase, p u r c h a s e, PURCHÁSE (anche se in elenco) → NO", [false, false, false],
    ["Pu-r_chase", "p u r c h a s e", "PURCHÁSE"].map((nome) => decidi({ nome, autenticato: false, membroCrm: false }, [nome]).ok));

  /* ── nota A + D35: un utente con sessione ma ESTRANEO (non è il proprietario) vale come anonimo ── */
  c("utente registrato ma ESTRANEO (non è il proprietario): Purchase → NO (403)", [false, false, false],
    ["Purchase", "CompletePayment", "PlaceAnOrder"].map(utente));
  c("utente estraneo: i nomi dell'elenco passano (come chiunque), il resto no", [true, true, false], [utente("Lead"), utente("PageView"), utente("Refund")]);
  c("membroCrm senza sessione valida non conta (autenticato:false) → NO", false, decidi({ nome: "Purchase", autenticato: false, membroCrm: true }).ok);

  /* ── il proprietario (utente verificato E in tracciamento_proprietario): qualunque nome ben formato ── */
  c("proprietario: Purchase → ok (l'Offline Conversion continua)", true, membro("Purchase"));
  c("membro: nomi ben formati (Refund, Qualcosa_di_nuovo, A1, ViewContent) → ok", [true, true, true, true], ["Refund", "Qualcosa_di_nuovo", "A1", "ViewContent"].map(membro));
  c("membro: spazi interni, 41 caratteri, vuoto, cifra iniziale, simboli, invisibile → NO", [false, false, false, false, false, false],
    ["Due Parole", "A".repeat(41), "", "1Lead", "Lead!", "Purchase​"].map(membro));
  c("membro: 40 caratteri esatti → ok; 1 solo carattere → NO (forma ^[A-Za-z][A-Za-z0-9_]{1,39}$)", [true, false], ["A".repeat(40), "A"].map(membro));
  c("membro: « Purchase» (spazio davanti) passa come «Purchase» e il nome da mandare è quello pulito", ["Purchase", true], [decidi({ nome: " Purchase", autenticato: true, membroCrm: true }).nome, membro(" Purchase")]);
  /* ── prova incrociata: l'Offline Conversion del CRM ──
     Da T34 il corpo si costruisce in src/crm/lead-ads.ts (corpoLead/corpoPurchase), non più dentro CRMContext.tsx:
     si legge il nome dal corpo vero, con una scheda che ha il consenso. */
  const ADS = await caricaTs(join(radice, "src/crm/lead-ads.ts"));
  const scheda = { id: "l1", data: { email: "a@example.invalid", tracking: { consenso_marketing: true } } };
  const nomePurchase = ADS.corpoPurchase(scheda, 100, "u1", "https://example.invalid")?.event_name;
  c("il CRM manda l'Offline Conversion con event_name «Purchase» (corpoPurchase di lead-ads.ts)", "Purchase", nomePurchase);
  c("quel corpo con JWT di un membro del CRM (T34) → decidi ammette; con la sola apikey di oggi → NO (per questo il Worker va PRIMA, poi capi)", [true, false], [
    decidi({ nome: nomePurchase, autenticato: true, membroCrm: true }).ok,
    decidi({ nome: nomePurchase, autenticato: false, membroCrm: false }).ok,
  ]);
  c("il Lead del CRM passa anche senza JWT (è nell'elenco): nessuna regressione se la scheda è rimasta aperta", [true, true], [
    ADS.corpoLead(scheda, "u1", "https://example.invalid")?.event_name === "Lead",
    anonimo("Lead"),
  ]);
  /* ── copertura: ogni nome che il sito manda a capi o al mittente è ammesso ── */
  const nomi = await caricaTs(join(radice, "src/lib/tracciamento/nomi.ts"));
  c("l'elenco di filtro.ts coincide con NOMI_CAPI_ANONIMI di src/lib/tracciamento/nomi.ts (stesso ordine)", [...nomi.NOMI_CAPI_ANONIMI], [...NOMI_AMMESSI]);
  c("nessun nome d'acquisto (NOMI_VIETATI di nomi.ts) è nell'elenco degli ammessi", [], nomi.NOMI_VIETATI.filter((n) => NOMI_AMMESSI.includes(n)));
  const file = sorgenti(join(radice, "src"));
  const letterali = (re) => file.flatMap((p) => [...readFileSync(p, "utf8").matchAll(re)].map((m) => ({ nome: m[1], p: p.slice(radice.length + 1) })));
  const viaCapi = letterali(/\bfireCapi\(\s*["'`]([^"'`]+)["'`]/g);
  c("la scansione trova le chiamate vere a fireCapi (almeno ViewContent, Lead, HighQualityVisit; PageView e AddToCart restano fra gli ammessi)", [], ["ViewContent", "Lead", "HighQualityVisit"].filter((n) => !viaCapi.some((x) => x.nome === n)));
  c("ogni nome passato a fireCapi(\"…\") sotto src/ è fra gli ammessi di capi", [], viaCapi.filter((x) => !NOMI_AMMESSI.includes(x.nome)));
  const viaMittente = letterali(/\bemettiEvento\(\s*["'`]([^"'`]+)["'`]/g);
  c("ogni nome passato a emettiEvento(\"…\") è un nome del sito (NOMI_EVENTO di nomi.ts): non passa da capi ma dal mittente del server", [], viaMittente.filter((x) => !nomi.NOMI_EVENTO.includes(x.nome)));
  const viaCrm = letterali(/event_name:\s*["'`](\w+)["'`]/g).filter((x) => x.p.startsWith("src/crm/") || x.p.startsWith("src/landing/"));
  c("ogni event_name scritto a mano in src/crm e src/landing è «Lead» (elenco) o «Purchase» (solo con JWT del CRM)", [], viaCrm.filter((x) => !["Lead", "Purchase"].includes(x.nome) && !NOMI_AMMESSI.includes(x.nome)));

  /* ── index.ts: il filtro è chiamato prima di ogni invio e di ogni scrittura, il resto non cambia ── */
  c("index.ts esiste e importa decidi da ./filtro.ts", [true, true], [existsSync(pIndex), existsSync(pIndex) && /import \{[^}]*\bdecidi\b[^}]*\} from "\.\/filtro\.ts"/.test(readFileSync(pIndex, "utf8"))]);
  if (!existsSync(pIndex)) return;
  const index = readFileSync(pIndex, "utf8");
  const chiamate = (nome) => [...index.matchAll(new RegExp(`(?<!function )\\b${nome}\\(`, "g"))].map((m) => m.index);
  const iDecidi = chiamate("decidi")[0];
  c("decidi( è chiamato PRIMA di sendMeta( e sendTikTok( (le chiamate, non le definizioni)", [true, true, true], [
    iDecidi > 0, iDecidi < chiamate("sendMeta")[0], iDecidi < chiamate("sendTikTok")[0],
  ]);
  const iScrittura = index.indexOf(".update(");
  const iConfig = index.indexOf('.from("tracking_config").select(\n    "user_id,meta_pixel_id');
  c("decidi( viene prima della lettura delle configurazioni e prima dell'unica scrittura (capi_sent)", [true, true], [iDecidi < iConfig || iConfig < 0, iDecidi < iScrittura]);
  c("risponde 403 con {\"error\":\"event_not_allowed\"} quando decidi dice no", true, /status:\s*403/.test(index) && /event_not_allowed/.test(index));
  c("l'utente si verifica con auth.getUser(token); i proprietari si leggono SOLO da tracciamento_proprietario; tracking_config non serve a dire chi è il proprietario", [true, true, true], [
    /supabase\.auth\.getUser\(/.test(index),
    /\.from\("tracciamento_proprietario"\)\.select\("user_id"\)/.test(index),
    /membroCrm = idProprietari\.includes\(/.test(index),
  ]);
  c("la query delle configurazioni è SEMPRE filtrata con q.in(\"user_id\", idProprietari) e admin_user_id del chiamante non compare più", [true, false, false], [
    /q = q\.in\("user_id", idProprietari\)/.test(index), /payload\.admin_user_id/.test(index), /\.eq\("user_id", payload/.test(index),
  ]);
  c("tabella vuota o illeggibile: risposta 200 {ok:true,sent:0,skipped:\"no_owner\"}, prima di ogni lettura delle configurazioni", true,
    /skipped: "no_owner"/.test(index) && index.indexOf("no_owner") < index.indexOf("let configs"));

  /* ── il codice vero, eseguito con un finto database: da INIZIO del primo blocco fino al giro degli invii ── */
  const iniz = index.indexOf("  // ── T29 · INIZIO");
  const fine = index.indexOf("  // Se è un evento Lead inviato");
  const regione = index.slice(iniz, fine);
  // la regione è TypeScript: la si trasforma con esbuild dentro una funzione e la si esegue
  const jsRegione = transformSync(
    `async function f(req, payload, supabase, corsHeaders, decidi, normalizzaNome, buildMetaPayload, buildTikTokPayload, sendMeta, sendTikTok) {\n${regione}\nreturn { results };\n}`,
    { loader: "ts", format: "esm" },
  ).code;
  const eseguiRegione = new Function(`${jsRegione}\nreturn f;`)();
  /** Finto client: sessioni per token; righe di tracciamento_proprietario e di tracking_config (con i pixel). */
  const finto = ({ sessioni = {}, proprietari = [], config = [], proprietariMancante = false }) => ({
    auth: { getUser: async (t) => (sessioni[t] ? { data: { user: { id: sessioni[t] } }, error: null } : { data: { user: null }, error: { message: "jwt" } }) },
    from: (tab) => {
      const q = { ids: null };
      q.select = () => q;
      q.eq = () => { throw new Error("eq non previsto: il chiamante non sceglie la configurazione"); };
      q.in = (_c, ids) => ((q.ids = ids), q);
      q.then = (ok, ko) => {
        let r;
        if (tab === "tracciamento_proprietario") r = proprietariMancante ? { data: null, error: { message: "relation does not exist" } } : { data: proprietari.map((user_id) => ({ user_id })), error: null };
        else r = { data: config.filter((x) => !q.ids || q.ids.includes(x.user_id)), error: null };
        return Promise.resolve(r).then(ok, ko);
      };
      return q;
    },
  });
  const chiama = async (nome, bearer, db, adminDichiarato) => {
    const payload = { event_name: nome, event_id: "e1", admin_user_id: adminDichiarato, source: undefined };
    const req = { headers: { get: (k) => (k === "authorization" && bearer ? `Bearer ${bearer}` : null) } };
    const inviati = [];
    const sendMeta = async (pixel) => (inviati.push(`meta:${pixel}`), { ok: true, status: 200, text: "" });
    const sendTikTok = async (pixel) => (inviati.push(`tiktok:${pixel}`), { ok: true, status: 200, text: "" });
    const r = await eseguiRegione(req, payload, finto(db), {}, decidi, normalizzaNome, async () => ({}), async () => ({}), sendMeta, sendTikTok);
    const risposta = r instanceof Response ? r : null;
    return { status: risposta ? risposta.status : 200, corpo: risposta ? await risposta.json() : null, inviati, payload };
  };
  const PROP = "u-titolare", ESTR = "u-estraneo";
  const riga = (user_id, pixel) => ({ user_id, meta_pixel_id: pixel, meta_access_token: "t", meta_test_event_code: null, tiktok_pixel_id: null, tiktok_access_token: null });
  const mondo = { sessioni: { tp: PROP, te: ESTR }, proprietari: [PROP], config: [riga(PROP, "PIXEL-TITOLARE"), riga(ESTR, "PIXEL-ESTRANEO")] };

  const A1 = await chiama("Purchase", "te", mondo, ESTR);
  c("D35: utente ESTRANEO con una SUA riga in tracking_config manda Purchase → 403 event_not_allowed, nessun invio", [403, "event_not_allowed", []], [A1.status, A1.corpo?.error, A1.inviati]);
  const A2 = await chiama("Purchase", "tp", mondo, "altro");
  c("il PROPRIETARIO manda Purchase → parte, e SOLO sul suo pixel (admin_user_id dichiarato ignorato)", [200, ["meta:PIXEL-TITOLARE"]], [A2.status, A2.inviati]);
  const B1 = await chiama("Lead", null, mondo, undefined);
  c("Lead anonimo senza admin_user_id: va SOLO al pixel del proprietario, mai a quello dell'estraneo", ["meta:PIXEL-TITOLARE"], B1.inviati);
  const B2 = await chiama("Lead", null, mondo, ESTR);
  c("Lead anonimo con admin_user_id dell'ESTRANEO: nessun invio al suo pixel (solo al proprietario)", ["meta:PIXEL-TITOLARE"], B2.inviati);
  const B3 = await chiama("Lead", null, mondo, PROP);
  c("Lead anonimo con admin_user_id del proprietario: solo al pixel del proprietario (una sola volta)", ["meta:PIXEL-TITOLARE"], B3.inviati);
  const B4 = await chiama("Lead", "te", mondo, ESTR);
  c("Lead di un utente estraneo con sessione e il proprio admin_user_id: solo al pixel del proprietario", ["meta:PIXEL-TITOLARE"], B4.inviati);
  const vuota = await chiama("Lead", null, { ...mondo, proprietari: [] }, undefined);
  c("tabella VUOTA: 200 {ok:true,sent:0,skipped:\"no_owner\"} e nessun invio", [200, { ok: true, sent: 0, skipped: "no_owner" }, []], [vuota.status, vuota.corpo, vuota.inviati]);
  const manca = await chiama("Lead", null, { ...mondo, proprietariMancante: true }, ESTR);
  c("tabella MANCANTE (S3 non applicata): 200 sent:0 no_owner, nessun invio, nessun errore", [200, { ok: true, sent: 0, skipped: "no_owner" }, []], [manca.status, manca.corpo, manca.inviati]);
  const mancaPurchase = await chiama("Purchase", "tp", { ...mondo, proprietariMancante: true }, PROP);
  c("tabella mancante: Purchase 403 (il filtro viene prima), nessun invio", [403, []], [mancaPurchase.status, mancaPurchase.inviati]);
  const A3 = await chiama("Purchase", null, mondo, PROP);
  c("senza Authorization (solo apikey, come il CRM di oggi) Purchase → 403", 403, A3.status);
  const A4 = await chiama("Purchase", "token-sbagliato", mondo, PROP);
  c("token non valido (anche il JWT anonimo) → come anonimo: Purchase 403", 403, A4.status);
  const A9 = await chiama(" Lead ", null, mondo, undefined);
  c("anonimo: « Lead » passa col nome ripulito", [200, "Lead"], [A9.status, A9.payload.event_name]);
  const due = await chiama("Lead", null, { ...mondo, proprietari: [PROP, "u-secondo"], config: [...mondo.config, riga("u-secondo", "PIXEL-SECONDO")] }, undefined);
  c("due proprietari: l'evento va a entrambi i pixel (e a nessun estraneo)", ["meta:PIXEL-TITOLARE", "meta:PIXEL-SECONDO"], due.inviati);
  c("niente chiavi o indirizzi nuovi: il solo import nuovo è ./filtro.ts", [], [...index.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]).filter((m) => !["https://esm.sh/@supabase/supabase-js@2.45.0", "./filtro.ts"].includes(m)));
  /* il resto del file è identico a quello del ramo base (tolti l'import e il blocco fra i due marcatori) */
  let base = "";
  try {
    base = execFileSync("git", ["show", `${BASE}:supabase/functions/capi/index.ts`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    base = "";
  }
  const RIGA_CHIAMANTE = '  if (payload.admin_user_id) q = q.eq("user_id", payload.admin_user_id);\n';
  const senzaBlocco = index
    .replace(/^import \{ decidi, normalizzaNome \} from "\.\/filtro\.ts";\n/m, "")
    .replace(/[ \t]*\/\/ ── T29 · INIZIO[\s\S]*?\/\/ ── T29 · FINE[^\n]*\n\n/, "")
    .replace(/[ \t]*\/\/ ── T29 · INIZIO[\s\S]*?\/\/ ── T29 · FINE[^\n]*\n/, "");
  c(`index.ts, tolti l'import e i due blocchi T29, è IDENTICO a quello del ramo base (${BASE}) meno la sola riga con cui il chiamante sceglieva la configurazione`, true,
    base !== "" && base.includes(RIGA_CHIAMANTE) && senzaBlocco === base.replace(RIGA_CHIAMANTE, ""));
  c("i marcatori: due coppie (il filtro; la query delle configurazioni)", [2, 2], [(index.match(/\/\/ ── T29 · INIZIO/g) ?? []).length, (index.match(/\/\/ ── T29 · FINE/g) ?? []).length]);
  c("filtro.ts è puro: nessun Deno, nessun import, nessun fetch, nessun accesso all'ambiente", false, /\bDeno\b|^import |\bfetch\(|process\.env|\bimport\(/m.test(readFileSync(pFiltro, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")));
}
