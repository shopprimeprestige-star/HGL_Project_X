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

  /* ── prova incrociata: l'Offline Conversion del CRM ── */
  const crm = readFileSync(join(radice, "src/crm/CRMContext.tsx"), "utf8");
  const corpoPurchase = (crm.match(/const dispatchPurchaseToAds = useCallback\([\s\S]*?\n {2}\);\n/) ?? [""])[0];
  const nomePurchase = (corpoPurchase.match(/event_name:\s*"(\w+)"/) ?? [])[1];
  c("il CRM manda l'Offline Conversion con event_name «Purchase» (lettura di dispatchPurchaseToAds)", "Purchase", nomePurchase);
  c("quel corpo con JWT di un membro del CRM (T34) → decidi ammette; con la sola apikey di oggi → NO (per questo il Worker va PRIMA, poi capi)", [true, false], [
    decidi({ nome: nomePurchase, autenticato: true, membroCrm: true }).ok,
    decidi({ nome: nomePurchase, autenticato: false, membroCrm: false }).ok,
  ]);
  const corpoLead = (crm.match(/const dispatchLeadToAds = useCallback\([\s\S]*?\n {2}\);\n/) ?? [""])[0];
  c("il Lead del CRM passa anche senza JWT (è nell'elenco): nessuna regressione se la scheda è rimasta aperta", [true, true], [
    (corpoLead.match(/event_name:\s*"(\w+)"/) ?? [])[1] === "Lead",
    anonimo("Lead"),
  ]);
  const lead = join(radice, "src/crm/lead-ads.ts");
  if (existsSync(lead)) {
    const L = await caricaTs(lead);
    const corpo = L.corpoPurchase?.({ id: "l1", data: { tracking: { consenso_marketing: true }, email: "a@example.com" } }, 100, "u1", "https://example.invalid");
    c("lead-ads.ts (T34): corpoPurchase costruisce un Purchase che decidi ammette con JWT di un membro", true, !corpo || decidi({ nome: corpo.event_name, autenticato: true, membroCrm: true }).ok);
  }

  /* ── copertura: ogni nome che il sito manda a capi o al mittente è ammesso ── */
  const nomi = await caricaTs(join(radice, "src/lib/tracciamento/nomi.ts"));
  c("l'elenco di filtro.ts coincide con NOMI_CAPI_ANONIMI di src/lib/tracciamento/nomi.ts (stesso ordine)", [...nomi.NOMI_CAPI_ANONIMI], [...NOMI_AMMESSI]);
  c("nessun nome d'acquisto (NOMI_VIETATI di nomi.ts) è nell'elenco degli ammessi", [], nomi.NOMI_VIETATI.filter((n) => NOMI_AMMESSI.includes(n)));
  const file = sorgenti(join(radice, "src"));
  const letterali = (re) => file.flatMap((p) => [...readFileSync(p, "utf8").matchAll(re)].map((m) => ({ nome: m[1], p: p.slice(radice.length + 1) })));
  const viaCapi = letterali(/\bfireCapi\(\s*["'`]([^"'`]+)["'`]/g);
  c("la scansione trova le chiamate vere a fireCapi (almeno PageView, ViewContent, AddToCart, Lead, HighQualityVisit)", [], ["PageView", "ViewContent", "AddToCart", "Lead", "HighQualityVisit"].filter((n) => !viaCapi.some((x) => x.nome === n)));
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
  c("l'utente si verifica con auth.getUser(token) e l'appartenenza si legge SOLO in tracciamento_proprietario (D35)", [true, true, true, false], [
    /supabase\.auth\.getUser\(/.test(index),
    /\.from\("tracciamento_proprietario"\)\s*\.select\("user_id"\)\s*\.eq\("user_id"/.test(index),
    /membroCrm = !erroreProprietario && /.test(index),
    /\.from\("tracking_config"\)\s*\.select\("user_id"\)/.test(index),
  ]);
  /* il blocco vero, eseguito con un finto database: i casi che D35 chiede */
  const blocco = (index.match(/\/\/ ── T29 · INIZIO[^\n]*\n([\s\S]*?)\/\/ ── T29 · FINE/) ?? [, ""])[1];
  const AsyncFn = Object.getPrototypeOf(async () => {}).constructor;
  const eseguiBlocco = new AsyncFn("req", "payload", "supabase", "corsHeaders", "decidi", "normalizzaNome", `${blocco}\nreturn null;`);
  /** Finto client: sessioni per token, righe per tabella (una tabella può mancare o dare errore). */
  const finto = ({ sessioni = {}, proprietari = [], tracking = [], proprietariMancante = false }) => ({
    auth: { getUser: async (t) => (sessioni[t] ? { data: { user: { id: sessioni[t] } }, error: null } : { data: { user: null }, error: { message: "jwt" } }) },
    from: (tab) => {
      const stato = { tab, uid: null };
      const q = {
        select: () => q,
        eq: (_c, v) => ((stato.uid = v), q),
        limit: async () =>
          tab === "tracciamento_proprietario" && proprietariMancante
            ? { data: null, error: { message: 'relation "tracciamento_proprietario" does not exist' } }
            : { data: (tab === "tracciamento_proprietario" ? proprietari : tracking).filter((u) => u === stato.uid).map((user_id) => ({ user_id })), error: null },
      };
      return q;
    },
  });
  const chiama = async (nome, bearer, db, adminDichiarato) => {
    const payload = { event_name: nome, event_id: "e1", admin_user_id: adminDichiarato };
    const req = { headers: { get: (k) => (k === "authorization" && bearer ? `Bearer ${bearer}` : null) } };
    const r = await eseguiBlocco(req, payload, finto(db), {}, decidi, normalizzaNome);
    return { status: r ? r.status : 200, corpo: r ? await r.json() : null, payload };
  };
  const PROPRIETARIO = "u-titolare", ESTRANEO = "u-registrato";
  const mondo = { sessioni: { tp: PROPRIETARIO, te: ESTRANEO }, proprietari: [PROPRIETARIO], tracking: [PROPRIETARIO, ESTRANEO] };
  const A1 = await chiama("Purchase", "te", mondo, ESTRANEO);
  c("D35: utente ESTRANEO con una SUA riga in tracking_config manda Purchase → 403 event_not_allowed", [403, "event_not_allowed"], [A1.status, A1.corpo?.error]);
  const A2 = await chiama("Purchase", "tp", mondo, "altro");
  c("D35: il PROPRIETARIO manda Purchase → passa, e admin_user_id è il suo id verificato (non quello dichiarato)", [200, "Purchase", PROPRIETARIO], [A2.status, A2.payload.event_name, A2.payload.admin_user_id]);
  const A3 = await chiama("Purchase", null, mondo, PROPRIETARIO);
  c("senza Authorization (solo apikey, come il CRM di oggi) Purchase → 403", 403, A3.status);
  const A4 = await chiama("Purchase", "token-sbagliato", mondo, PROPRIETARIO);
  c("token non valido (anche il JWT anonimo) → come anonimo: Purchase 403", 403, A4.status);
  const A5 = await chiama("Lead", "te", mondo, ESTRANEO);
  c("l'estraneo manda Lead → passa (è nell'elenco) e admin_user_id resta quello dichiarato (non è il proprietario)", [200, ESTRANEO], [A5.status, A5.payload.admin_user_id]);
  const A6 = await chiama("Purchase", "tp", { ...mondo, proprietari: [] }, "x");
  c("tabella tracciamento_proprietario VUOTA: anche il titolare non manda Purchase (403)", 403, A6.status);
  const A7 = await chiama("Purchase", "tp", { ...mondo, proprietariMancante: true }, "x");
  c("tabella MANCANTE (S3 non applicata): nessun errore, Purchase 403", 403, A7.status);
  const A8 = await chiama("Lead", "tp", { ...mondo, proprietariMancante: true }, "x");
  c("tabella mancante: i nomi dell'elenco passano lo stesso (il sito non si rompe)", 200, A8.status);
  const A9 = await chiama(" Lead ", null, mondo, undefined);
  c("anonimo: « Lead » passa col nome ripulito", [200, "Lead"], [A9.status, A9.payload.event_name]);
  c("per un membro verificato admin_user_id è l'id verificato, mai quello dichiarato", true, /if \(autenticato && membroCrm\) payload\.admin_user_id = /.test(index));
  c("niente chiavi o indirizzi nuovi: il solo import nuovo è ./filtro.ts", [], [...index.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]).filter((m) => !["https://esm.sh/@supabase/supabase-js@2.45.0", "./filtro.ts"].includes(m)));
  /* il resto del file è identico a quello del ramo base (tolti l'import e il blocco fra i due marcatori) */
  let base = "";
  try {
    base = execFileSync("git", ["show", `${BASE}:supabase/functions/capi/index.ts`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    base = "";
  }
  const senzaBlocco = index
    .replace(/^import \{ decidi, normalizzaNome \} from "\.\/filtro\.ts";\n/m, "")
    .replace(/[ \t]*\/\/ ── T29 · INIZIO[\s\S]*?\/\/ ── T29 · FINE[^\n]*\n\n/, "");
  c(`index.ts, tolti l'import e il blocco T29, è IDENTICO a quello del ramo base (${BASE})`, true, base !== "" && senzaBlocco === base);
  c("i due marcatori del blocco ci sono, una volta sola", [1, 1], [(index.match(/\/\/ ── T29 · INIZIO/g) ?? []).length, (index.match(/\/\/ ── T29 · FINE/g) ?? []).length]);
  c("filtro.ts è puro: nessun Deno, nessun import, nessun fetch, nessun accesso all'ambiente", false, /\bDeno\b|^import |\bfetch\(|process\.env|\bimport\(/m.test(readFileSync(pFiltro, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")));
}
