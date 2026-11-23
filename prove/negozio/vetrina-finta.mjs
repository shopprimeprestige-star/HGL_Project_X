/** ── VETRINA V1 · T75 · IL FINTO SUPABASE LOCALE E IL LANCIATORE SICURO (D91) ───────────────────────────
 *  `strumenti/vetrina-finta/{dati,server,avvia}.mjs`. Due cose da provare:
 *   (a) il finto fa quello che serve (select, filtri, insert accettati e scartati, foto di prova, scenari) e i suoi dati sono letti
 *       dai veri `costruisciPubblico`/`costruisciCategorie` come righe delle viste;
 *   (b) il lanciatore NON può far parlare l'app con il database vero. La prova TENTA di violare ogni salvaguardia:
 *       finta `.env` e `.dev.vars`, URL remoti, chiave «vera», variabili ereditate dalla shell, un costruttore d'ambiente che perde.
 *       Ogni salvaguardia ha almeno una verifica che diventa rossa se la si toglie.
 *  Nessuna rete verso l'esterno, nessuna chiave vera: i «segreti» qui sotto sono inventati. Le cartelle sono `mkdtemp`. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RADICE = join(fileURLToPath(import.meta.url), "..", "..", "..");
const CARTELLA = join(RADICE, "strumenti", "vetrina-finta");

/** I «segreti» inventati che una shell potrebbe avere (uno per variabile che il codice legge, più qualche altra chiave). */
const SEGRETI = {
  SUPABASE_URL: "https://progetto-di-prova.supabase.co",
  VITE_SUPABASE_URL: "https://progetto-di-prova.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoicHJvdmEifQ.firma-di-prova-1",
  SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoicHJvdmEifQ.firma-di-prova-2",
  VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoicHJvdmEifQ.firma-di-prova-3",
  STRIPE_SECRET_KEY: "chiave-stripe-di-prova-non-vera",
  OPENROUTER_API_KEY: "chiave-openrouter-di-prova-non-vera",
  CLOUDFLARE_API_TOKEN: "gettone-cloudflare-di-prova-non-vero",
};

export async function prove(mod, { c, gruppo }) {
  const { CHIAVE_FINTA, SCENARI, datiScenario, svgProva } = await import(pathToFileURL(join(CARTELLA, "dati.mjs")).href);
  const { avviaFinto } = await import(pathToFileURL(join(CARTELLA, "server.mjs")).href);
  const A = await import(pathToFileURL(join(CARTELLA, "avvia.mjs")).href);
  const P = mod["shop/cms/pubblico"];
  const sandbox = mkdtempSync(join(tmpdir(), "vetrina-finta-"));
  const nuova = (nome) => { const d = join(sandbox, nome); mkdirSync(d); return d; };

  try {
    /* ══ 1 · I DATI SONO RIGHE DELLE VISTE ══════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T75 · I DATI DEL FINTO (D91)");
    c("gli scenari sono i sei del piano", ["completo", "vuoto", "pochi", "guasto", "vecchio", "stress"], SCENARI);
    let scenarioSconosciuto = "";
    try { datiScenario("nonesiste"); } catch (e) { scenarioSconosciuto = String(e.message); }
    c("uno scenario sconosciuto lancia", true, /sconosciuto/.test(scenarioSconosciuto));

    const BASE = "http://127.0.0.1:1/storage/v1/object/public/shop-media";
    const catalogo = (nome) => {
      const t = datiScenario(nome).tabelle;
      const r = (x) => t[x].righe;
      return {
        prodotti: P.costruisciPubblico({ prodotti: r("shop_v_prodotti"), varianti: r("shop_v_varianti"), media: r("shop_v_media") }, { baseMedia: BASE }),
        categorie: P.costruisciCategorie({ categorie: r("shop_v_categorie"), media: r("shop_v_media") }, { baseMedia: BASE }),
        t,
      };
    };
    const completo = catalogo("completo");
    c("completo: 9 prodotti letti dal codice vero (nessuno scartato)", 9, completo.prodotti.length);
    c("completo: 2 categorie (quella senza prodotti non c'è, come nella vista)", ["patch-prova", "cura-prova"], completo.categorie.map((x) => x.slug));
    c("completo: tutte le categorie hanno la foto", true, completo.categorie.every((x) => x.foto && x.fotoAlt));
    const derm = completo.prodotti.find((p) => p.slug === "invisible-derm-prova");
    c("completo: Invisible Derm esce senza prezzo e non si compra", [null, false], [derm?.prezzoDaCent, derm?.acquistabile]);
    c("completo: gli altri 8 hanno un prezzo", 8, completo.prodotti.filter((p) => p.prezzoDaCent > 0).length);
    const uno = completo.prodotti.find((p) => p.slug === "patch-prova-uno");
    c("completo: la patch uno ha 6 foto (5 + scala), 6 varianti e i campioni dei colori", [6, 6, 3], [uno.media.length, uno.varianti.length, uno.opzioni.find((o) => o.nome === "Colore").valori.filter((v) => v.campione).length]);
    c("completo: ogni foto è un .svg sotto la base dello storage", true, completo.prodotti.flatMap((p) => p.media).every((m) => m.src.w480.startsWith(`${BASE}/prodotti/`) && m.src.w1600.endsWith("-1600.svg")));
    c("completo: c'è un prodotto senza foto, uno esaurito e un kit con il correlato", [true, true, "Shampoo PROVA"], [
      completo.prodotti.some((p) => p.media.length === 0),
      completo.prodotti.some((p) => p.varianti.every((v) => !v.disponibile)),
      completo.prodotti.find((p) => p.tipo === "kit").correlato?.nome,
    ]);
    c("completo: il nome lungo c'è davvero", true, completo.prodotti.some((p) => p.nome.length > 80));
    const vuoto = catalogo("vuoto");
    c("vuoto: nessun prodotto, nessuna categoria, nessuna tariffa, nessuna landing", [0, 0, 0, 0], [vuoto.prodotti.length, vuoto.categorie.length, vuoto.t.shop_spedizioni_tariffe.righe.length, vuoto.t.landing_content.righe.length]);
    const pochi = catalogo("pochi");
    c("pochi: 2 prodotti, 2 categorie, uno senza foto, tariffa provvisoria", [2, 2, true, true], [pochi.prodotti.length, pochi.categorie.length, pochi.prodotti.some((p) => p.media.length === 0), pochi.t.shop_spedizioni_tariffe.righe[0].provvisoria]);
    const stress = catalogo("stress");
    c("stress: 50 prodotti e uno con 50 varianti", [50, 50], [stress.prodotti.length, Math.max(...stress.prodotti.map((p) => p.varianti.length))]);
    c("le impostazioni mettono il sito in «cms» e la cassa «vecchia»", [{ chiave: "catalogo_sito", valore: "cms" }, { chiave: "cassa_sito", valore: "vecchia" }], completo.t.shop_impostazioni.righe);
    const testiDati = JSON.stringify(Object.values(completo.t).map((x) => x.righe));
    c("i dati non hanno indirizzi esterni né chiavi", false, /https?:\/\/|supabase|eyJ/i.test(testiDati));

    const svg = svgProva("prodotti/PR-PATCH-1/principale-960.svg");
    c("la foto di prova è un quadrato con la scritta PROVA", [true, true, true], [/width="960" height="960"/.test(svg), />PROVA</.test(svg), /viewBox="0 0 100 100"/.test(svg)]);
    c("un percorso storto non genera foto", [null, null, null], [svgProva("../x-480.svg"), svgProva("a/b.png"), svgProva("a/b-9999.svg")]);

    /* ══ 2 · IL FINTO SERVER ═════════════════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T75 · IL FINTO SERVER (D91)");
    const finto = await avviaFinto({ scenario: "completo" });
    const chiedi = async (percorso, { metodo = "GET", chiave = CHIAVE_FINTA, intestazioni = {}, corpo } = {}) => {
      const r = await fetch(finto.url + percorso, { method: metodo, headers: { ...(chiave ? { apikey: chiave } : {}), ...intestazioni }, body: corpo });
      const testo = await r.text();
      let json = null;
      try { json = JSON.parse(testo); } catch { /* non è JSON */ }
      return { stato: r.status, json, testo, intestazioni: r.headers };
    };
    try {
      c("il finto ascolta solo su 127.0.0.1", "127.0.0.1", finto.server.address().address);
      c("l'indirizzo del finto è http://127.0.0.1:<porta>", `http://127.0.0.1:${finto.porta}`, finto.url);

      const prodotti = await chiedi("/rest/v1/shop_v_prodotti?select=*");
      c("select=* di una vista: 200 e 9 righe", [200, 9], [prodotti.stato, prodotti.json?.length]);
      c("l'intestazione Content-Range dice il totale", "0-8/9", prodotti.intestazioni.get("content-range"));
      const uno1 = await chiedi("/rest/v1/shop_v_prodotti?select=slug,sku&slug=eq.patch-prova-uno");
      c("select di due colonne con eq", [{ slug: "patch-prova-uno", sku: "PR-PATCH-1" }], uno1.json);
      const unico = await chiedi("/rest/v1/shop_impostazioni?select=valore&chiave=eq.catalogo_sito", { intestazioni: { accept: "application/vnd.pgrst.object+json" } });
      c("single/maybeSingle con una riga: l'oggetto", [200, { valore: "cms" }], [unico.stato, unico.json]);
      const nessuna = await chiedi("/rest/v1/shop_impostazioni?select=valore&chiave=eq.non-c-e", { intestazioni: { accept: "application/vnd.pgrst.object+json" } });
      c("single senza righe: 406 PGRST116", [406, "PGRST116"], [nessuna.stato, nessuna.json?.code]);
      const ordinati = await chiedi("/rest/v1/shop_v_prodotti?select=sku&order=prezzo_cent.desc&limit=2");
      c("order e limit", ["PR-ID-1", "PR-PATCH-4"], ordinati.json?.map((x) => x.sku));
      const inElenco = await chiedi("/rest/v1/shop_v_prodotti?select=sku&sku=in.(PR-KIT-1,PR-CURA-1)&order=sku.asc");
      c("in (...)", ["PR-CURA-1", "PR-KIT-1"], inElenco.json?.map((x) => x.sku));
      const senzaVideo = await chiedi("/rest/v1/shop_v_media?select=id&path_video=is.null");
      const conVideo = await chiedi("/rest/v1/shop_v_media?select=id&path_video=not.is.null");
      c("is.null e not.is.null", [true, []], [senzaVideo.json?.length > 30, conVideo.json]);
      const tariffa = await chiedi("/rest/v1/shop_spedizioni_tariffe?select=paese,nome,corriere,costo_cent,giorni_min,giorni_max,attiva,provvisoria,confermata_il&paese=eq.IT&attiva=eq.true&limit=2");
      c("la tariffa attiva dell'Italia (come la chiede il codice)", [1, 590], [tariffa.json?.length, tariffa.json?.[0]?.costo_cent]);
      const landing = await chiedi("/rest/v1/landing_content?select=data&id=eq.default");
      c("landing_content: la riga di prova", "Testo di PROVA per la landing", landing.json?.[0]?.data?.texts?.["hero.eyebrow1"]);
      const slot = await chiedi("/rest/v1/public_leads?select=data_slot,ora_slot&slot_released=eq.false&slot_pending=eq.false&data_slot=not.is.null&ora_slot=not.is.null");
      c("public_leads e funnel_settings si leggono (vuoti)", [200, []], [slot.stato, slot.json]);

      // gli insert si accettano e si scartano
      const ins = await chiedi("/rest/v1/lp_events", { metodo: "POST", intestazioni: { "content-type": "application/json", prefer: "return=minimal" }, corpo: JSON.stringify({ event: "prova" }) });
      c("POST (insert): 201", 201, ins.stato);
      const ins2 = await chiedi("/rest/v1/public_leads", { metodo: "POST", intestazioni: { "content-type": "application/json" }, corpo: JSON.stringify([{ nome: "Prova" }]) });
      c("POST su un'altra tabella: 201", 201, ins2.stato);
      const dopo = await chiedi("/rest/v1/public_leads?select=data_slot");
      const stato = await chiedi("/__vetrina/stato");
      c("scartati: dopo l'insert la tabella è ancora vuota e il conteggio è 2", [[], 2], [dopo.json, stato.json?.scartati]);
      c("lp_events non diventa una tabella leggibile", 404, (await chiedi("/rest/v1/lp_events?select=*")).stato);

      // le chiavi: solo la finta
      c("senza chiave: 401", 401, (await chiedi("/rest/v1/shop_v_prodotti?select=*", { chiave: null })).stato);
      c("con una chiave «vera»: 401 (anche la scrittura)", [401, 401], [
        (await chiedi("/rest/v1/shop_v_prodotti?select=*", { chiave: SEGRETI.SUPABASE_SERVICE_ROLE_KEY })).stato,
        (await chiedi("/rest/v1/lp_events", { metodo: "POST", chiave: SEGRETI.SUPABASE_SERVICE_ROLE_KEY, corpo: "{}" })).stato,
      ]);
      // quello che il finto non conosce lo dice
      c("PATCH e DELETE: 405", [405, 405], [(await chiedi("/rest/v1/shop_v_prodotti?sku=eq.X", { metodo: "PATCH", corpo: "{}" })).stato, (await chiedi("/rest/v1/shop_v_prodotti?sku=eq.X", { metodo: "DELETE" })).stato]);
      c("una funzione SQL (rpc): 404 PGRST202", [404, "PGRST202"], [(await chiedi("/rest/v1/rpc/shop_giacenza_muovi", { metodo: "POST", corpo: "{}" })).stato, (await chiedi("/rest/v1/rpc/x", { metodo: "POST", corpo: "{}" })).json?.code]);
      c("filtri non supportati (or, relazioni) e colonne inesistenti: 400", [400, 400, 400], [
        (await chiedi("/rest/v1/shop_v_prodotti?or=(sku.eq.a,sku.eq.b)")).stato,
        (await chiedi("/rest/v1/shop_v_prodotti?select=sku,shop_v_media(*)")).stato,
        (await chiedi("/rest/v1/shop_v_prodotti?select=colonna_inventata")).stato,
      ]);
      c("tabella sconosciuta: 404 PGRST205", [404, "PGRST205"], [(await chiedi("/rest/v1/tabella_inventata?select=*")).stato, (await chiedi("/rest/v1/tabella_inventata?select=*")).json?.code]);
      c("indirizzo sconosciuto: 404", 404, (await chiedi("/auth/v1/user", { chiave: null })).stato);

      // CORS: solo pagine locali
      const locale = await chiedi("/rest/v1/shop_v_prodotti", { metodo: "OPTIONS", chiave: null, intestazioni: { origin: "http://localhost:5199", "access-control-request-headers": "apikey,authorization" } });
      const remota = await chiedi("/rest/v1/shop_v_prodotti", { metodo: "OPTIONS", chiave: null, intestazioni: { origin: "https://sito-qualsiasi.example" } });
      c("CORS: concesso a localhost, negato a un sito qualunque", ["http://localhost:5199", null], [locale.intestazioni.get("access-control-allow-origin"), remota.intestazioni.get("access-control-allow-origin")]);

      // le foto
      const foto = await chiedi("/storage/v1/object/public/shop-media/prodotti/PR-PATCH-1/principale-480.svg", { chiave: null });
      c("la foto di prova: 200, image/svg+xml, quadrata e con la scritta", [200, true, true, true], [foto.stato, /image\/svg\+xml/.test(foto.intestazioni.get("content-type")), /width="480" height="480"/.test(foto.testo), />PROVA</.test(foto.testo)]);
      c("una foto che non ha la forma attesa: 404", 404, (await chiedi("/storage/v1/object/public/shop-media/..%2Fx.svg", { chiave: null })).stato);
      c("il finto non ha mandato niente fuori: il registro ha solo richieste sue", true, finto.registro.every((r) => r.percorso.startsWith("/rest/v1/") || r.percorso.startsWith("/storage/v1/") || r.percorso.startsWith("/auth/")));
    } finally {
      await finto.chiudi();
    }

    for (const [nome, atteso] of [["guasto", 503], ["vecchio", 404]]) {
      const f = await avviaFinto({ scenario: nome });
      try {
        const req = (p, o = {}) => fetch(f.url + p, { headers: { apikey: CHIAVE_FINTA }, ...o });
        const r = await req("/rest/v1/shop_v_prodotti?select=*");
        const j = await r.json();
        c(`${nome}: le viste rispondono ${atteso}`, [atteso, nome === "guasto" ? "PGRST000" : "PGRST205"], [r.status, j.code]);
        const l = await req("/rest/v1/landing_content?select=data");
        c(`${nome}: landing_content ${nome === "guasto" ? "è giù anche lei" : "risponde"}`, nome === "guasto" ? 503 : 200, l.status);
        const w = await req("/rest/v1/lp_events", { method: "POST", body: "{}" });
        c(`${nome}: la scrittura ${nome === "guasto" ? "dà 503" : "si accetta e si scarta (201)"}`, nome === "guasto" ? 503 : 201, w.status);
        const s = await fetch(f.url + "/storage/v1/object/public/shop-media/prodotti/X/principale-480.svg");
        c(`${nome}: le foto si servono lo stesso`, 200, s.status);
      } finally {
        await f.chiudi();
      }
    }
    const fv = await avviaFinto({ scenario: "vuoto" });
    try {
      const l = await (await fetch(fv.url + "/rest/v1/landing_content?select=data&id=eq.default", { headers: { apikey: CHIAVE_FINTA } })).json();
      const p = await (await fetch(fv.url + "/rest/v1/shop_v_prodotti?select=*", { headers: { apikey: CHIAVE_FINTA } })).json();
      c("vuoto: viste vuote e nessuna riga di landing", [[], []], [p, l]);
    } finally {
      await fv.chiudi();
    }
    const sorgenteServer = readFileSync(join(CARTELLA, "server.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    c("server.mjs non apre connessioni verso l'esterno (niente fetch, request, connect)", false, /\bfetch\(|\.request\(|\.connect\(|node:https|node:net\b|node:dns/.test(sorgenteServer));

    /* ══ 3 · IL LANCIATORE: I FILE CHE PORTANO SEGRETI ════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T75 · IL LANCIATORE RIFIUTA .env E .dev.vars (D91)");
    const NOMI_SEGRETI = [".env", ".env.local", ".env.production", ".env.development.local", ".dev.vars", ".dev.vars.staging", ".envrc"];
    const NOMI_LIBERI = [".env.example", ".gitignore", "env.txt", "dev.vars"];
    c("riconosce come segreti i nomi di vite e wrangler", NOMI_SEGRETI.map(() => true), NOMI_SEGRETI.map((n) => A.eFileSegreto(n)));
    c("lascia stare .env.example e gli altri", NOMI_LIBERI.map(() => false), NOMI_LIBERI.map((n) => A.eFileSegreto(n)));

    // il figlio di prova: scrive il suo ambiente in un file e basta (stesso ambiente chiuso che avrebbe l'app)
    const stub = join(sandbox, "figlio.mjs");
    writeFileSync(stub, 'import { writeFileSync } from "node:fs";\nwriteFileSync(process.argv[2], JSON.stringify({ env: process.env, cwd: process.cwd() }));\n');
    const lancia = async (radice, opzioni = {}) => {
      const uscita = join(radice, "uscita.json");
      const r = await A.avvia({ scenario: "completo", radice, comando: [process.execPath, stub, uscita], stdio: "ignore", ...opzioni });
      await new Promise((ok) => r.figlio.once("exit", ok));
      await r.chiudi();
      return { ...r, uscita: existsSync(uscita) ? JSON.parse(readFileSync(uscita, "utf8")) : null };
    };
    // un lancio che DOVREBBE riuscire: se il lanciatore lo rifiuta, il controllo diventa rosso invece di far crollare la prova
    const lanciaSicura = async (radice, opzioni) => { try { return await lancia(radice, opzioni); } catch (e) { return { uscita: null, finto: {}, errore: e }; } };
    const rifiutata = async (radice, opzioni) => {
      try { await lancia(radice, opzioni); return null; } catch (e) { return e; }
    };

    const pulita = nuova("pulita");
    writeFileSync(join(pulita, ".env.example"), "SUPABASE_URL=\n");
    const buona = await lanciaSicura(pulita);
    c("una cartella pulita (con solo .env.example) parte e l'app ci gira dentro", [true, true], [buona.uscita !== null, !!buona.uscita && realpathSync(buona.uscita.cwd) === realpathSync(pulita)]);

    for (const nome of NOMI_SEGRETI) {
      const dir = nuova(`con${nome.replace(/\W/g, "_")}`);
      writeFileSync(join(dir, nome), "SUPABASE_URL=https://progetto-di-prova.supabase.co\n");
      const e = await rifiutata(dir);
      c(`${nome} nella cartella dell'app: il lanciatore si ferma`, [true, false], [e instanceof A.ErroreSalvaguardia && e.message.includes(nome), existsSync(join(dir, "uscita.json"))]);
      c(`${nome}: il messaggio non riporta il contenuto del file`, false, e ? /supabase/i.test(e.message) : null);
    }
    const dirStrumento = nuova("strumento");
    writeFileSync(join(dirStrumento, ".dev.vars"), "X=1\n");
    c("trovaFileSegreti guarda tutte le cartelle che gli si danno (anche quella dello strumento)", [join(dirStrumento, ".dev.vars")], A.trovaFileSegreti([pulita, dirStrumento]));
    c("la cartella dello strumento di oggi è pulita", [], A.trovaFileSegreti([CARTELLA]));
    c("uno scenario sconosciuto non parte", true, (await rifiutata(nuova("scenario"), { scenario: "nonesiste" })) instanceof A.ErroreSalvaguardia);

    /* ══ 4 · L'AMBIENTE A ELENCO CHIUSO ═══════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T75 · L'AMBIENTE DELL'APP È A ELENCO CHIUSO (D91)");
    const shell = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_PROVA: "uno", ...SEGRETI, SHOP_CASSA_FORZA: "stripe", SHOP_CATALOGO_FORZA: "codice", PIPPO: "pluto", EDITOR: "vim" };
    const chiusa = await lanciaSicura(nuova("chiusa"), { ereditato: shell });
    const env = chiusa.uscita?.env ?? {};
    const dump = JSON.stringify(env);
    const NOMI_AMMESSI = ["PATH", "HOME", "NODE_PROVA", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "SHOP_CATALOGO_FORZA", "SHOP_CASSA_FORZA"];
    c("il processo dell'app ha SOLO le variabili dell'elenco chiuso", [], Object.keys(env).filter((k) => !NOMI_AMMESSI.includes(k) && !k.startsWith("NODE_") && k !== "__CF_USER_TEXT_ENCODING")); // quest'ultima la aggiunge macOS a ogni processo, non il lanciatore
    c("PATH, HOME e NODE_* passano", [true, true, "uno"], [env.PATH === shell.PATH, env.HOME === shell.HOME, env.NODE_PROVA]);
    c("nessun segreto della shell arriva all'app (nemmeno come parte di un valore)", [], Object.entries(SEGRETI).filter(([, v]) => dump.includes(v)).map(([k]) => k));
    c("le variabili sconosciute della shell spariscono", [undefined, undefined, undefined, undefined], [env.STRIPE_SECRET_KEY, env.OPENROUTER_API_KEY, env.CLOUDFLARE_API_TOKEN, env.PIPPO]);
    const url = `http://127.0.0.1:${chiusa.finto.porta}`;
    c("i due indirizzi sono quelli del finto", [url, url], [env.SUPABASE_URL, env.VITE_SUPABASE_URL]);
    c("le tre chiavi sono la chiave finta", [CHIAVE_FINTA, CHIAVE_FINTA, CHIAVE_FINTA], [env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_PUBLISHABLE_KEY, env.VITE_SUPABASE_PUBLISHABLE_KEY]);
    c("le due forzature sono quelle del collaudo, anche se la shell diceva altro", ["cms", "vecchia"], [env.SHOP_CATALOGO_FORZA, env.SHOP_CASSA_FORZA]);

    // l'eredità VERA: una variabile messa nell'ambiente di questo processo non arriva al figlio
    const chiave = "PROVA_VETRINA_SEGRETO";
    process.env[chiave] = "valore-ereditato-di-prova";
    process.env.SUPABASE_URL_PROVA_HOST = "https://altro.supabase.co";
    let ereditata;
    try { ereditata = await lanciaSicura(nuova("ereditata")); } finally { delete process.env[chiave]; delete process.env.SUPABASE_URL_PROVA_HOST; }
    c("una variabile ereditata davvero dalla shell non arriva al processo figlio", [undefined, undefined], [ereditata.uscita?.env?.[chiave], ereditata.uscita?.env?.SUPABASE_URL_PROVA_HOST]);

    // un costruttore che PERDE (copia tutta la shell): la verifica ferma il lancio, il figlio non gira
    const perde = (ered, urlFinto) => ({ ...ered, ...A.costruisciAmbiente(ered, urlFinto) });
    const dirPerde = nuova("perde");
    const ePerde = await rifiutata(dirPerde, { ereditato: shell, costruisci: perde });
    c("un costruttore d'ambiente che lascia passare la shell: il lancio si ferma e l'app non parte", [true, false], [ePerde instanceof A.ErroreSalvaguardia, existsSync(join(dirPerde, "uscita.json"))]);
    c("il messaggio dice il NOME della variabile, mai il valore", [true, []], [/STRIPE_SECRET_KEY|OPENROUTER_API_KEY|CLOUDFLARE_API_TOKEN|PIPPO|EDITOR/.test(ePerde?.message ?? ""), Object.values(SEGRETI).filter((v) => ePerde?.message.includes(v))]);
    const dirRemoto = nuova("remoto");
    const eRemoto = await rifiutata(dirRemoto, { costruisci: (e, u) => ({ ...A.costruisciAmbiente(e, u), SUPABASE_URL: SEGRETI.SUPABASE_URL }) });
    c("un costruttore che mette l'URL vero: il lancio si ferma", [true, false], [eRemoto instanceof A.ErroreSalvaguardia, existsSync(join(dirRemoto, "uscita.json"))]);

    /* ══ 5 · LA VERIFICA TENTATA IN TUTTI I MODI ═════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T75 · LA VERIFICA DELL'AMBIENTE (D91)");
    const buono = A.costruisciAmbiente({ PATH: "/usr/bin", HOME: "/Users/prova", NODE_ENV: "development" }, "http://127.0.0.1:4010");
    const prova = (modifica, porta = 4010) => {
      const e = { ...buono };
      modifica(e);
      try { A.verificaAmbiente(e, { porta }); return null; } catch (x) { return x; }
    };
    c("l'ambiente costruito dal lanciatore passa la verifica", null, (() => { try { A.verificaAmbiente(buono, { porta: 4010 }); return null; } catch (x) { return x.message; } })());
    const rifiuti = [
      ["URL remoto https (SUPABASE_URL)", (e) => { e.SUPABASE_URL = SEGRETI.SUPABASE_URL; }],
      ["URL remoto (VITE_SUPABASE_URL)", (e) => { e.VITE_SUPABASE_URL = "http://example.com"; }],
      ["URL con l'indirizzo locale come prefisso di un sito vero", (e) => { e.SUPABASE_URL = "http://127.0.0.1.sito-vero.example:4010"; }],
      ["URL con 127.0.0.1 nel nome utente", (e) => { e.SUPABASE_URL = "http://127.0.0.1@sito-vero.example:4010"; }],
      ["URL con accesso (utente:password) anche se locale", (e) => { e.SUPABASE_URL = "http://utente:segreto@127.0.0.1:4010"; }],
      ["URL locale ma https", (e) => { e.SUPABASE_URL = "https://127.0.0.1:4010"; }],
      ["URL IPv6 locale (non nell'elenco)", (e) => { e.SUPABASE_URL = "http://[::1]:4010"; }],
      ["URL di un'altra porta locale", (e) => { e.VITE_SUPABASE_URL = "http://127.0.0.1:5432"; }],
      ["URL che non è un indirizzo", (e) => { e.SUPABASE_URL = "non-un-indirizzo"; }],
      ["URL mancante", (e) => { delete e.SUPABASE_URL; }],
      ["chiave «vera» (service role)", (e) => { e.SUPABASE_SERVICE_ROLE_KEY = SEGRETI.SUPABASE_SERVICE_ROLE_KEY; }],
      ["chiave «vera» (publishable)", (e) => { e.SUPABASE_PUBLISHABLE_KEY = SEGRETI.SUPABASE_PUBLISHABLE_KEY; }],
      ["chiave «vera» (VITE_ publishable)", (e) => { e.VITE_SUPABASE_PUBLISHABLE_KEY = SEGRETI.VITE_SUPABASE_PUBLISHABLE_KEY; }],
      ["chiave mancante", (e) => { delete e.SUPABASE_PUBLISHABLE_KEY; }],
      ["una variabile fuori elenco (Stripe)", (e) => { e.STRIPE_SECRET_KEY = SEGRETI.STRIPE_SECRET_KEY; }],
      ["una variabile fuori elenco, anche se innocua", (e) => { e.PIPPO = "1"; }],
      ["un NODE_* che porta un indirizzo di Supabase", (e) => { e.NODE_EXTRA = SEGRETI.SUPABASE_URL; }],
      ["un NODE_* che porta una chiave tipo JWT", (e) => { e.NODE_EXTRA = SEGRETI.SUPABASE_SERVICE_ROLE_KEY; }],
      ["una chiave nuova (sb_secret_) in un NODE_*", (e) => { e.NODE_EXTRA = "sb_secret_inventata"; }],
      ["SHOP_CATALOGO_FORZA diverso da cms", (e) => { e.SHOP_CATALOGO_FORZA = "codice"; }],
      ["SHOP_CASSA_FORZA diversa da vecchia", (e) => { e.SHOP_CASSA_FORZA = "stripe"; }],
      ["un valore che non è un testo", (e) => { e.NODE_X = 1; }],
    ];
    for (const [nome, modifica] of rifiuti) {
      const e = prova(modifica);
      const valori = Object.values(SEGRETI);
      c(`rifiuta: ${nome}`, [true, []], [e instanceof A.ErroreSalvaguardia, valori.filter((v) => e?.message.includes(v))]);
    }
    c("il numero della porta si controlla solo se glielo si dà (e allora conta)", [null, true], [(() => { try { A.verificaAmbiente(buono); return null; } catch (x) { return x.message; } })(), prova(() => {}, 4011) instanceof A.ErroreSalvaguardia]);
    const ok = (modifica) => prova(modifica) === null;
    c("accetta localhost come indirizzo locale e i NODE_* innocui", [true, true], [ok((e) => { e.SUPABASE_URL = "http://localhost:4010"; }), ok((e) => { e.NODE_OPTIONS = "--max-old-space-size=2048"; })]);

    /* ══ 6 · IL COMANDO CHE LANCIA L'APP ═════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T75 · IL COMANDO DELL'APP (D91)");
    const cV = A.comandoApp(RADICE, buono, { wrangler: false, portaApp: 5199 });
    c("vite dev su 127.0.0.1, senza passare da npx", [true, true, "127.0.0.1", false], [cV.includes("dev"), cV[1].endsWith(join("vite", "bin", "vite.js")), cV[cV.indexOf("--host") + 1], cV.some((x) => /npx|npm/.test(x))]);
    const cW = A.comandoApp(RADICE, buono, { wrangler: true, portaApp: 5199 });
    const vars = cW.flatMap((x, i) => (cW[i - 1] === "--var" ? [x] : []));
    c("wrangler dev solo --local su 127.0.0.1", [true, "127.0.0.1"], [cW.includes("--local"), cW[cW.indexOf("--ip") + 1]]);
    c("wrangler riceve con --var le sole variabili finte (nessun PATH, nessun NODE_*)", [7, true], [vars.length, vars.every((v) => /^(SUPABASE_|VITE_SUPABASE_|SHOP_)/.test(v) && !/supabase\.co/.test(v))]);

    /* ══ 7 · DALLA RIGA DI COMANDO ═══════════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T75 · LA RIGA DI COMANDO (D91)");
    const cli = (...argomenti) => spawnSync(process.execPath, [join(CARTELLA, "avvia.mjs"), ...argomenti], { encoding: "utf8", env: { PATH: process.env.PATH }, timeout: 20_000 });
    const senza = cli();
    const strano = cli("nonesiste");
    c("senza scenario: esce con 2 e spiega come si usa", [2, true], [senza.status, /Uso:/.test(senza.stderr)]);
    c("scenario sconosciuto: esce con 1 e dice RIFIUTATO", [1, true], [strano.status, /RIFIUTATO/.test(strano.stderr)]);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}
