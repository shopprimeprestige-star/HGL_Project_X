/** ── VETRINA V1 · T92 · LO STRUMENTO DI MISURA (D92, D105) ───────────────────────────────────────────────
 *  `strumenti/misura-vetrina.mjs`. Lo strumento pilota un browser (Playwright) che sta FUORI dal repository; questa prova NON apre
 *  nessun browser e NON scarica niente: prova le parti pure (argomenti, rifiuto degli indirizzi non locali, soglie, contrasti,
 *  lettura dei risultati, messaggi) con dati finti. Il browser vero è provato a mano (vedi la lavagna).
 *  Ogni «controlla…» si prova col caso buono e con uno cattivo per ogni regola: una soglia che non fa mai rosso non serve.
 *  Le cartelle temporanee sono `mkdtemp`, tolte in un `finally`. Nessuna chiave, nessun `.env`, nessuna rete. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RADICE = join(fileURLToPath(import.meta.url), "..", "..", "..");
const FILE = join(RADICE, "strumenti", "misura-vetrina.mjs");

/** Una prova che lancia un errore di Node farebbe cadere tutta `prove.mjs` senza riepilogo: qui diventa un rosso pulito e le altre prove continuano. */
export async function prove(mod, ctx) {
  try { await provePure(mod, ctx); }
  catch (e) { ctx.c("la prova di misura-vetrina non deve crollare con un errore", null, String(e?.message ?? e).split("\n")[0]); }
}

async function provePure(_mod, { c, gruppo }) {
  const M = await import(pathToFileURL(FILE).href);
  const sandbox = mkdtempSync(join(tmpdir(), "misura-vetrina-"));
  const lancia = (...a) => { try { return { ok: true, v: M.verificaIndirizzoLocale(...a) }; } catch (e) { return { ok: false, m: String(e.message) }; } };
  const ok = (r) => r.ok;

  try {
    /* ══ 1 · MAI IL SITO VERO: SOLO INDIRIZZI LOCALI ═════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · SOLO INDIRIZZI LOCALI");
    c("accetta 127.0.0.1, localhost e [::1] in http", [true, true, true, true], [
      ok(lancia("http://127.0.0.1:5199")), ok(lancia("http://localhost:5199/shop")), ok(lancia("http://[::1]:5199")), ok(lancia("http://127.0.0.1")),
    ]);
    const rifiutati = [
      "https://127.0.0.1:5199", "http://hairgenius.it", "https://www.example.com", "http://127.0.0.1.sito.example:80", "http://127.0.0.1@sito.example",
      "http://localhost.sito.example", "http://sito.example/127.0.0.1", "http://0.0.0.0:5199", "http://127.0.0.2:5199", "http://192.168.1.10:5199",
      "http://utente:segreto@127.0.0.1:5199", "ftp://127.0.0.1", "file:///etc/hosts", "127.0.0.1:5199", "", "   ", "http://",
    ];
    for (const u of rifiutati) c(`rifiuta «${u}»`, false, ok(lancia(u)));
    c("il rifiuto dice cosa si può usare e non ripete una password", [true, false], [
      /127\.0\.0\.1|localhost/.test(lancia("http://sito.example").m), lancia("http://utente:segreto@127.0.0.1:5199").m?.includes("segreto"),
    ]);
    const base = "http://127.0.0.1:5199";
    const percorso = (p) => { try { return M.verificaPercorso(p, base); } catch (e) { return null; } };
    c("un percorso resta sulla stessa origine", ["http://127.0.0.1:5199/shop", "http://127.0.0.1:5199/shop/cerca?q=a"], [percorso("/shop"), percorso("/shop/cerca?q=a")]);
    c("rifiuta indirizzi completi, doppi trattini e senza barra", [null, null, null, null, null], [
      percorso("https://sito.example/shop"), percorso("//sito.example/shop"), percorso("shop"), percorso("/\\sito.example"), percorso(""),
    ]);
    c("rifiuta le quattro rotte con un indirizzo vero scritto nel codice", [null, null, null, null], [
      percorso("/api/og/anteprima"), percorso("/media/abc"), percorso("/prova-anteprima-a"), percorso("/prova-anteprima/caso"),
    ]);
    c("le quattro rotte si rifiutano anche con le maiuscole e codificate", [null, null, null, null, null], [
      percorso("/MEDIA/abc"), percorso("/Api/OG/Anteprima?x=1"), percorso("/Prova-Anteprima-a"), percorso("/%6Dedia/abc"), percorso("/media"),
    ]);
    c("rottaVietata dice lo stesso su un percorso", [true, true, false, false], [M.rottaVietata("/media/x"), M.rottaVietata("/MEDIA/X"), M.rottaVietata("/shop"), M.rottaVietata("/mediateca")]);

    /* ══ 2 · GLI ARGOMENTI ═══════════════════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · ARGOMENTI E AMBIENTE");
    const L = (argv, env = {}) => M.leggiArgomenti(argv, env);
    const vuoto = L([]);
    c("senza argomenti: indirizzo di partenza locale, pagine di partenza, nessun errore", [[], "http://127.0.0.1:5199", true], [
      vuoto.errori, vuoto.opzioni.base, vuoto.opzioni.pagine.length > 0,
    ]);
    c("--aiuto e -h chiedono l'aiuto", [true, true, false], [L(["--aiuto"]).aiuto, L(["-h"]).aiuto, vuoto.aiuto]);
    const pieno = L(["--base", "http://localhost:4000", "--playwright", "/x/pw", "--pagine", "/shop,/shop/cerca", "--scheda", "/shop/prodotto/p", "--sku", "PR-1,PR-2", "--scenario", "stress", "--solo", "T3,T11", "--canale", "chrome", "--finestra", "button.menu"]);
    c("legge tutte le opzioni", { errori: [], base: "http://localhost:4000", playwright: "/x/pw", pagine: ["/shop", "/shop/cerca"], scheda: "/shop/prodotto/p", sku: ["PR-1", "PR-2"], scenario: "stress", solo: ["T3", "T11"], canale: "chrome", finestra: "button.menu" }, {
      errori: pieno.errori, base: pieno.opzioni.base, playwright: pieno.opzioni.playwright, pagine: pieno.opzioni.pagine, scheda: pieno.opzioni.scheda, sku: pieno.opzioni.sku, scenario: pieno.opzioni.scenario, solo: pieno.opzioni.solo, canale: pieno.opzioni.canale, finestra: pieno.opzioni.finestra,
    });
    c("le variabili d'ambiente valgono se manca l'argomento, l'argomento vince", ["/da/ambiente", "/da/riga"], [
      L([], { MISURA_PLAYWRIGHT: "/da/ambiente" }).opzioni.playwright, L(["--playwright", "/da/riga"], { MISURA_PLAYWRIGHT: "/da/ambiente" }).opzioni.playwright,
    ]);
    c("un indirizzo non locale è un errore (da riga e da ambiente)", [true, true], [
      L(["--base", "https://sito.example"]).errori.some((e) => /locale|127\.0\.0\.1/.test(e)), L([], { MISURA_BASE: "https://sito.example" }).errori.length > 0,
    ]);
    c("opzione sconosciuta, valore mancante e scenario sbagliato sono errori", [true, true, true, true], [
      L(["--boh"]).errori.length > 0, L(["--base"]).errori.length > 0, L(["--scenario", "nonesiste"]).errori.length > 0, L(["--solo", "T99"]).errori.length > 0,
    ]);
    c("una pagina con indirizzo completo è un errore", true, L(["--pagine", "/shop,https://sito.example/x"]).errori.length > 0);
    c("la scheda e lo SKU servono insieme agli scenari: se manca uno, avvisa", true, L(["--scheda", "/shop/prodotto/p"]).errori.some((e) => /sku/i.test(e)));
    // lo strumento non legge le variabili delle chiavi: passarle non cambia niente
    c("ignora le chiavi presenti nell'ambiente", JSON.stringify(vuoto.opzioni), JSON.stringify(L([], { STRIPE_SECRET_KEY: "x", SUPABASE_SERVICE_ROLE_KEY: "y" }).opzioni));

    /* ══ 3 · SENZA PLAYWRIGHT: MESSAGGIO CHIARO, NIENTE ERRORI OSCURI ═══════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · PLAYWRIGHT DA FUORI");
    const senza = await M.caricaPlaywright(undefined);
    c("senza cartella: non carica, dice cosa manca e come prepararlo fuori dal repository", [false, true, true, true], [
      !!senza.pw, /Playwright/.test(senza.errore), /mktemp -d/.test(senza.errore), /--playwright/.test(senza.errore),
    ]);
    const vuotaDir = join(sandbox, "vuota");
    mkdirSync(vuotaDir);
    const vuota = await M.caricaPlaywright(vuotaDir);
    c("cartella senza Playwright: dice quale cartella ha guardato", [false, true], [!!vuota.pw, vuota.errore.includes(vuotaDir)]);
    const inesistente = await M.caricaPlaywright(join(sandbox, "non-c-e"));
    c("cartella che non esiste: messaggio, non un'eccezione", [false, true], [!!inesistente.pw, /non esiste|non trovat/i.test(inesistente.errore)]);
    const finta = join(sandbox, "con-playwright");
    mkdirSync(join(finta, "node_modules", "playwright"), { recursive: true });
    writeFileSync(join(finta, "package.json"), '{"name":"finta","private":true}');
    writeFileSync(join(finta, "node_modules", "playwright", "package.json"), '{"name":"playwright","version":"0.0.0","main":"index.js"}');
    writeFileSync(join(finta, "node_modules", "playwright", "index.js"), "module.exports = { chromium: { nome: 'finto' } };");
    const trovata = await M.caricaPlaywright(finta);
    c("la cartella con Playwright (qui finto) lo carica", [true, "finto", undefined], [!!trovata.pw, trovata.pw?.chromium?.nome, trovata.errore]);
    const soloCore = join(sandbox, "solo-core");
    mkdirSync(join(soloCore, "node_modules", "playwright-core"), { recursive: true });
    writeFileSync(join(soloCore, "package.json"), '{"name":"finta","private":true}');
    writeFileSync(join(soloCore, "node_modules", "playwright-core", "package.json"), '{"name":"playwright-core","version":"0.0.0","main":"index.js"}');
    writeFileSync(join(soloCore, "node_modules", "playwright-core", "index.js"), "module.exports = { chromium: { nome: 'core' } };");
    c("va bene anche playwright-core", "core", (await M.caricaPlaywright(soloCore)).pw?.chromium?.nome);
    const rotto = join(sandbox, "rotto");
    mkdirSync(join(rotto, "node_modules", "playwright"), { recursive: true });
    writeFileSync(join(rotto, "package.json"), '{"name":"finta","private":true}');
    writeFileSync(join(rotto, "node_modules", "playwright", "package.json"), '{"name":"playwright","main":"index.js"}');
    writeFileSync(join(rotto, "node_modules", "playwright", "index.js"), "throw new Error('guasto-interno');");
    const guasto = await M.caricaPlaywright(rotto);
    c("un Playwright che lancia: messaggio chiaro, nessuna eccezione", [false, true], [!!guasto.pw, /non si carica|non parte/i.test(guasto.errore)]);
    c("il messaggio per il browser mancante dice come rimediare e non parla di errori interni", [true, true, true], [
      /playwright install/.test(M.messaggioBrowserMancante("chrome")), /--canale/.test(M.messaggioBrowserMancante(undefined)), !/at .*\.js:\d+/.test(M.messaggioBrowserMancante("chrome")),
    ]);

    /* ══ 4 · DALLA RIGA DI COMANDO ═══════════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · RIGA DI COMANDO (senza browser)");
    const cli = (argv, env = {}) => spawnSync(process.execPath, [FILE, ...argv], { encoding: "utf8", env: { PATH: process.env.PATH, ...env }, timeout: 20_000, cwd: sandbox });
    const aiuto = cli(["--aiuto"]);
    c("--aiuto esce con 0 e spiega l'uso", [0, true, true], [aiuto.status, /Uso:/.test(aiuto.stdout), /--playwright/.test(aiuto.stdout)]);
    const nonLocale = cli(["--base", "https://sito.example", "--playwright", finta]);
    c("indirizzo non locale: esce con 2, dice RIFIUTATO, non apre niente", [2, true], [nonLocale.status, /RIFIUTATO/.test(nonLocale.stderr)]);
    const senzaPw = cli([]);
    c("senza Playwright: esce con 2, dice cosa manca, nessuna traccia di stack", [2, true, true, false], [senzaPw.status, /Playwright/.test(senzaPw.stderr), /mktemp -d/.test(senzaPw.stderr), /\n\s+at /.test(senzaPw.stderr)]);
    const dirVuota = cli(["--playwright", vuotaDir]);
    c("cartella senza Playwright: esce con 2 e nomina la cartella", [2, true], [dirVuota.status, dirVuota.stderr.includes(vuotaDir)]);
    c("la riga di comando non ha scritto niente nella cartella di lavoro", [], readdirSync(sandbox).filter((f) => !["vuota", "con-playwright", "solo-core", "rotto"].includes(f)));

    /* ══ 5 · CONTRASTI (SPEC §4.2.2) ═════════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · CONTRASTI");
    c("il rapporto: nero su bianco 21, bianco su bianco 1", [21, 1], [M.rapportoContrasto("#000000", "#FFFFFF"), M.rapportoContrasto("#fff", "#ffffff")]);
    c("legge i colori di Chrome (rgb, rgba, color srgb) e rifiuta il resto", [[255, 0, 0, 1], [0, 0, 0, 0.5], [255, 255, 255, 0.45], null, null], [
      M.leggiColore("rgb(255, 0, 0)"), M.leggiColore("rgba(0, 0, 0, 0.5)"), M.leggiColore("color(srgb 1 1 1 / 0.45)"), M.leggiColore("transparent-ma-no"), M.leggiColore("oklch(0.5 0.1 200)"),
    ].map((x) => (x ? [x.r, x.g, x.b, x.a] : null)));
    c("«transparent» è trasparente", 0, M.leggiColore("rgba(0, 0, 0, 0)").a);
    const tab = M.controllaTabellaContrasti();
    c("la tabella §4.2.2 torna col calcolo (scarto ≤ 0,15): tutte le coppie note", [true, []], [tab.ok, tab.scarti]);
    c("la tabella ha almeno le coppie del documento (testo, blu, bottoni, errore, successo, fuoco)", true, M.COPPIE_CONTRASTO.length >= 20);
    const voce = (o) => ({ sel: "p.x", testo: "Ciao", fg: "rgb(12, 18, 26)", sfondi: ["rgba(0, 0, 0, 0)", "rgb(255, 255, 255)"], px: 16, peso: 400, conImmagineSfondo: false, ...o });
    const k = (voci) => M.controllaContrasti(voci);
    c("testo principale su bianco: ok", true, k([voce()]).ok);
    c("grigio chiaro su bianco: rosso", false, k([voce({ fg: "rgb(170, 170, 170)" })]).ok);
    c("white/45 su blu notte (4,4): rosso; white/60: ok", [false, true], [
      k([voce({ fg: "rgba(255, 255, 255, 0.45)", sfondi: ["rgb(10, 26, 58)"] })]).ok, k([voce({ fg: "rgba(255, 255, 255, 0.6)", sfondi: ["rgb(10, 26, 58)"] })]).ok,
    ]);
    c("bianco su blu del marchio #0F90FE (3,3): rosso, anche se il testo è grande", [false, false], [
      k([voce({ fg: "rgb(255, 255, 255)", sfondi: ["rgb(15, 144, 254)"] })]).ok, k([voce({ fg: "rgb(255, 255, 255)", sfondi: ["rgb(15, 144, 254)"], px: 30 })]).ok,
    ]);
    c("testo grande (24 px) tollera 3:1; piccolo no", [true, false], [
      k([voce({ fg: "rgb(124, 134, 149)", px: 24 })]).ok, k([voce({ fg: "rgb(124, 134, 149)", px: 16 })]).ok,
    ]);
    c("19 px grassetto conta come grande", [true, false], [k([voce({ fg: "rgb(124, 134, 149)", px: 19, peso: 700 })]).ok, k([voce({ fg: "rgb(124, 134, 149)", px: 19, peso: 400 })]).ok]);
    c("gli sfondi si compongono dal più vicino alla radice (un velo sul blu notte)", true, k([voce({ fg: "rgb(255, 255, 255)", sfondi: ["rgba(0, 0, 0, 0)", "rgba(10, 20, 48, 0.9)", "rgb(255, 255, 255)"] })]).ok);
    const conFoto = k([voce({ conImmagineSfondo: true, fg: "rgb(170, 170, 170)" })]);
    c("sotto una foto o un gradiente non si misura: lo conta a parte; se non c'è altro non è verde", [false, 0, 1], [conFoto.ok, conFoto.controllati, conFoto.nonMisurati]);
    const oklch = k([voce({ fg: "oklch(0.55 0.16 252)" })]);
    c("oklch non ancora portato a sRGB: non si misura, non è verde (mai verde a vuoto)", [false, 0, 1], [oklch.ok, oklch.controllati, oklch.illeggibili]);
    const mista = k([voce(), voce({ fg: "oklch(0.55 0.16 252)", sel: "p.brand" })]);
    c("un testo misurato e uno illeggibile: né verde né rosso (null), nominando l'illeggibile", [null, 1, 1, true], [mista.ok, mista.controllati, mista.illeggibili, /p\.brand/.test(mista.dettaglio)]);
    c("uno sfondo illeggibile conta come illeggibile", 1, k([voce(), voce({ sfondi: ["oklch(0.2 0.1 200)"] })]).illeggibili);
    c("una violazione vince sull'illeggibile (rosso)", false, k([voce({ fg: "rgb(170, 170, 170)" }), voce({ fg: "oklch(0.55 0.16 252)" })]).ok);
    c("senza voci non c'è niente da dire: non è verde", false, k([]).ok);
    c("le violazioni nominano elemento, testo e rapporto", true, (() => { const r = k([voce({ fg: "rgb(170, 170, 170)", testo: "Prezzo" })]); return r.violazioni[0].sel === "p.x" && r.violazioni[0].testo === "Prezzo" && r.violazioni[0].rapporto < 4.5 && /Prezzo/.test(r.dettaglio); })());

    /* ══ 6 · BERSAGLI, CAMPI, BARRE, PIENI ═══════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · TELEFONO E BOTTONI");
    const b = (sel, x, y, w = 48, h = 48, o = {}) => ({ sel, testo: sel, x, y, w, h, inLinea: false, ...o });
    c("due bottoni 48 × 48 a 8 px: ok", true, M.controllaBersagli([b("a", 0, 0), b("b", 56, 0)]).ok);
    c("43 px di lato (larghezza o altezza): rosso", [false, false], [M.controllaBersagli([b("a", 0, 0, 43, 48)]).ok, M.controllaBersagli([b("a", 0, 0, 48, 43)]).ok]);
    c("distanza 7 px: rosso; in diagonale conta la distanza vera", [false, true], [M.controllaBersagli([b("a", 0, 0), b("b", 55, 0)]).ok, M.controllaBersagli([b("a", 0, 0), b("b", 54, 54)]).ok]);
    c("elementi che si toccano o si sovrappongono: rosso", [false, false], [M.controllaBersagli([b("a", 0, 0), b("b", 48, 0)]).ok, M.controllaBersagli([b("a", 0, 0), b("b", 20, 20)]).ok]);
    c("un bottone dentro una scheda cliccabile (contenuto) non conta come vicino", true, M.controllaBersagli([b("scheda", 0, 0, 300, 300), b("bottone", 20, 240, 100, 48)]).ok);
    c("un link dentro un paragrafo di testo (in linea) non è un bersaglio", true, M.controllaBersagli([b("a", 0, 0, 60, 18, { inLinea: true })]).ok);
    c("la violazione dice quale e di quanto", true, (() => { const r = M.controllaBersagli([b("menu", 0, 0, 30, 30)]); return /menu/.test(r.dettaglio) && r.violazioni.length === 1; })());
    c("senza elementi non è verde", false, M.controllaBersagli([]).ok);
    c("campi di testo: 16 px ok, 15 px rosso", [true, false], [M.controllaCampi([{ sel: "input.cerca", fontPx: 16 }]).ok, M.controllaCampi([{ sel: "input.cerca", fontPx: 15 }]).ok]);
    c("campi: nessun campo nella pagina = nulla da dire, ok", true, M.controllaCampi([]).ok);
    c("barre a 320 px: pagina larga come la finestra ok; 1 px di più tollerato, 2 rosso", [true, true, false], [
      M.controllaBarre({ larghezzaPagina: 320, larghezzaFinestra: 320, eccedenti: [] }).ok, M.controllaBarre({ larghezzaPagina: 321, larghezzaFinestra: 320, eccedenti: [] }).ok,
      M.controllaBarre({ larghezzaPagina: 322, larghezzaFinestra: 320, eccedenti: ["div.largo"] }).ok,
    ]);
    c("la barra orizzontale nomina chi esce", true, /div\.largo/.test(M.controllaBarre({ larghezzaPagina: 400, larghezzaFinestra: 320, eccedenti: ["div.largo"] }).dettaglio));
    const p = (sfondo, testo = "Aggiungi al carrello") => ({ sel: "button", testo, sfondo, w: 200, h: 48 });
    c("un solo pieno «notte»: ok; due: rosso", [true, false], [M.controllaPieni([p("rgb(10, 20, 48)")]).ok, M.controllaPieni([p("rgb(10, 20, 48)"), p("rgb(10, 20, 48)", "Vai alla cassa")]).ok]);
    c("nessun pieno su una schermata: ok (sono permessi zero o uno)", true, M.controllaPieni([]).ok);
    c("il pieno «chiaro» (bianco) conta come un pieno", false, M.controllaPieni([p("rgb(10, 20, 48)"), p("rgb(255, 255, 255)", "Altro")]).ok);
    c("blu pieno: ok solo se è la consulenza; si somma ai pieni? no, è a parte", [true, false, true], [
      M.controllaPieni([p("rgb(12, 114, 203)", "Consulenza gratuita")]).ok, M.controllaPieni([p("rgb(12, 114, 203)", "Aggiungi")]).ok,
      M.controllaPieni([p("rgb(12, 114, 203)", "Consulenza gratuita"), p("rgb(10, 20, 48)")]).ok,
    ]);
    c("il rosso del brand #FF3B3B non compare mai come pieno", false, M.controllaPieni([p("rgb(255, 59, 59)", "Elimina")]).ok);
    c("il blu del marchio #0F90FE pieno senza consulenza: rosso", false, M.controllaPieni([p("rgb(15, 144, 254)", "Accetta")]).ok);
    c("classificaPieno riconosce la tavolozza", ["notte", "bianco", "blu", "blu", "rosso", "altro"], ["rgb(10, 20, 48)", "rgb(255, 255, 255)", "rgb(12, 114, 203)", "rgb(15, 144, 254)", "rgb(255, 59, 59)", "rgb(120, 200, 40)"].map(M.classificaPieno));

    /* ══ 7 · IMMAGINI, VIDEO, RICHIESTE ══════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · IMMAGINI, VIDEO, TERZE PARTI");
    const im = (o) => ({ sel: "img.f", src: "http://127.0.0.1:5199/storage/v1/object/public/shop-media/prodotti/P/principale-960.svg", naturalW: 960, w: 480, loading: "eager", dentroFascia: false, ...o });
    c("larghezza servita: il suffisso solo per gli SVG di prova, per le foto vere la larghezza naturale", [960, 1600, 4000, 700], [M.larghezzaServita(im()), M.larghezzaServita(im({ src: "http://x/a-1600.svg" })), M.larghezzaServita(im({ src: "http://x/a-960.jpg", naturalW: 4000 })), M.larghezzaServita(im({ src: "http://x/a.jpg", naturalW: 700 }))]);
    c("960 in un riquadro da 480: ok; 961: rosso", [true, false], [M.controllaImmagini([im()]).ok, M.controllaImmagini([im({ naturalW: 961, src: "http://x/a.jpg" })]).ok]);
    c("1600 in un riquadro da 390: rosso", false, M.controllaImmagini([im({ src: "http://x/a.jpg", naturalW: 1600, w: 390 })]).ok);
    c("eccezione D99: il ritratto (riquadro ≤ 72, file ≤ 240) passa e si conta", [true, 1], (() => { const r = M.controllaImmagini([im({ src: "http://x/r.jpg", naturalW: 240, w: 56 })]); return [r.ok, r.eccezioni]; })());
    c("l'eccezione non copre un ritratto da 480", false, M.controllaImmagini([im({ src: "http://x/r.jpg", naturalW: 480, w: 56 })]).ok);
    c("eccezione miniature (carrello, tendina): 480 su 96 passa, 480 su 120 e 960 su 96 no", [true, false, false], [
      M.controllaImmagini([im({ src: "http://x/m.jpg", naturalW: 480, w: 96 })]).ok, M.controllaImmagini([im({ src: "http://x/m.jpg", naturalW: 480, w: 120 })]).ok, M.controllaImmagini([im({ src: "http://x/m.jpg", naturalW: 960, w: 96 })]).ok,
    ]);
    c("eccezione card: 960 su 300 passa, 960 su 330 e 1600 su 300 no", [true, true, false], [
      M.controllaImmagini([im({ src: "http://x/c.jpg", naturalW: 960, w: 300 })]).ok, M.controllaImmagini([im({ src: "http://x/c.jpg", naturalW: 960, w: 480 })]).ok, M.controllaImmagini([im({ src: "http://x/c.jpg", naturalW: 1600, w: 300 })]).ok,
    ]);
    c("le eccezioni si scrivono nel dettaglio, per tipo", true, /ritratto/.test(M.controllaImmagini([im({ src: "http://x/r.jpg", naturalW: 240, w: 56 })]).dettaglio) && /miniatur/.test(M.controllaImmagini([im({ src: "http://x/m.jpg", naturalW: 480, w: 96 })]).dettaglio) && /card/.test(M.controllaImmagini([im({ src: "http://x/c.jpg", naturalW: 960, w: 300 })]).dettaglio));
    c("immagini non ancora caricate (larghezza 0) o senza riquadro si saltano", true, M.controllaImmagini([im({ naturalW: 0, src: "" }), im({ w: 0 })]).ok);
    c("solo la prima foto è eager (fuori da testata e piè): una ok, due rosso, le lazy non contano", [true, false, true], [
      M.controllaEager([im(), im({ loading: "lazy" })]).ok, M.controllaEager([im(), im()]).ok, M.controllaEager([im({ loading: "lazy" })]).ok,
    ]);
    c("le immagini della testata e del piè non contano per le eager", true, M.controllaEager([im(), im({ dentroFascia: true }), im({ dentroFascia: true })]).ok);
    const classi = ["https://connect.facebook.net/en_US/fbevents.js", "https://www.facebook.com/tr?id=1", "https://analytics.tiktok.com/i18n/pixel/events.js", "https://www.googletagmanager.com/gtag/js?id=G-1", "https://www.google-analytics.com/g/collect", "https://stats.g.doubleclick.net/x", "https://js.stripe.com/v3", "https://m.stripe.network/inner.html", "http://127.0.0.1:5199/shop", "https://fonts.googleapis.com/css2", "https://cdn.example/x.js"];
    c("classificaHost: Meta, TikTok, Google, Stripe, locale, altro", ["meta", "meta", "tiktok", "google", "google", "google", "stripe", "stripe", "locale", "google", "altro"], classi.map(M.classificaHost));
    c("host travestiti: facebook.com.sito.example non è Meta; localhost.x non è locale", ["altro", "altro", "altro"], ["https://facebook.com.sito.example/x", "https://notfacebook.com/x", "http://localhost.sito.example/"].map(M.classificaHost));
    const rLocali = [{ url: "http://127.0.0.1:5199/shop", tipo: "document" }, { url: "http://127.0.0.1:5199/assets/a.js", tipo: "script" }];
    c("prima della scelta: solo richieste locali = ok", true, M.controllaTerzeParti(rLocali, M.TUTTE).ok);
    c("prima della scelta: una richiesta a Meta (anche sola) = rosso e la nomina", [false, true], (() => { const r = M.controllaTerzeParti([...rLocali, { url: "https://connect.facebook.net/x.js", tipo: "script" }], M.TUTTE); return [r.ok, /meta/i.test(r.dettaglio)]; })());
    for (const [nome, url] of [["TikTok", "https://analytics.tiktok.com/a"], ["Google", "https://www.googletagmanager.com/gtag/js"], ["Stripe", "https://js.stripe.com/v3"]]) c(`prima della scelta: ${nome} = rosso`, false, M.controllaTerzeParti([{ url, tipo: "script" }], M.TUTTE).ok);
    c("dopo la scelta Stripe resta vietato, Meta no", [false, true], [M.controllaTerzeParti([{ url: "https://js.stripe.com/v3" }], ["stripe"]).ok, M.controllaTerzeParti([{ url: "https://connect.facebook.net/x.js" }], ["stripe"]).ok]);
    c("video: nessun file prima del tocco = ok; un .mp4 o una richiesta «media» = rosso", [true, false, false, false], [
      M.controllaVideo(rLocali).ok, M.controllaVideo([{ url: "http://127.0.0.1:5199/v/a.mp4", tipo: "other" }]).ok, M.controllaVideo([{ url: "http://127.0.0.1:5199/v/a", tipo: "media" }]).ok, M.controllaVideo([{ url: "http://127.0.0.1:5199/v/a.webm?x=1", tipo: "other" }]).ok,
    ]);

    /* ══ 8 · SCENARI «ACCETTA» E «RIFIUTA» ═══════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · SCENARI ACCETTA E RIFIUTA (V1-T10)");
    const grezzi = {
      fbq: [["set", "autoConfig", false, "1"], ["init", "1"], ["track", "PageView", {}, { eventID: "e1" }], ["track", "ViewContent", { content_ids: ["PR-1"], content_type: "product" }, { eventID: "e2" }], ["track", "AddToCart", { content_ids: ["PR-1"] }, { eventID: "e3" }]],
      ttq: [["track", "ViewContent", { contents: [{ content_id: "PR-1", content_type: "product" }] }], ["track", "AddToCart", { contents: [{ content_id: "PR-1" }] }], ["page"]],
      dataLayer: [["consent", "default", {}], ["event", "view_item", { items: [{ item_id: "PR-1" }] }], ["event", "add_to_cart", { items: [{ item_id: "PR-1" }] }]],
    };
    const ev = M.normalizzaEventi(grezzi);
    c("normalizza gli eventi delle tre piattaforme (solo i veri eventi, con gli id)", [
      { piattaforma: "meta", nome: "PageView", ids: [] }, { piattaforma: "meta", nome: "ViewContent", ids: ["PR-1"] }, { piattaforma: "meta", nome: "AddToCart", ids: ["PR-1"] },
      { piattaforma: "tiktok", nome: "ViewContent", ids: ["PR-1"] }, { piattaforma: "tiktok", nome: "AddToCart", ids: ["PR-1"] },
      { piattaforma: "google", nome: "view_item", ids: ["PR-1"] }, { piattaforma: "google", nome: "add_to_cart", ids: ["PR-1"] },
    ], ev);
    c("normalizza con niente o con dati storti non lancia", [[], []], [M.normalizzaEventi({}), M.normalizzaEventi({ fbq: "x", ttq: [null, 3, []], dataLayer: [["event"]] })]);
    const attesi = [{ nome: "ViewContent" }, { nome: "AddToCart" }];
    c("Accetta: gli eventi attesi con lo SKU giusto = ok", true, M.controllaAccetta(ev, ["PR-1"], attesi).ok);
    c("Accetta: manca AddToCart su una piattaforma = rosso e dice quale", [false, true], (() => { const r = M.controllaAccetta(ev.filter((e) => !(e.piattaforma === "tiktok" && e.nome === "AddToCart")), ["PR-1"], attesi); return [r.ok, /tiktok/i.test(r.dettaglio)]; })());
    c("Accetta: content_ids sbagliato (un altro SKU) = rosso", false, M.controllaAccetta(ev.map((e) => (e.piattaforma === "meta" ? { ...e, ids: ["PR-9"] } : e)), ["PR-1"], attesi).ok);
    c("Accetta: nessun evento (pixel non configurati nella vetrina finta) = rosso, con la spiegazione", [false, true], (() => { const r = M.controllaAccetta([], ["PR-1"], attesi); return [r.ok, /nessun evento/i.test(r.dettaglio)]; })());
    c("Accetta: una sola piattaforma con eventi (le altre senza pixel) = ok se i suoi sono completi", true, M.controllaAccetta(ev.filter((e) => e.piattaforma === "meta"), ["PR-1"], attesi).ok);
    c("Accetta: vale uno qualunque degli SKU passati (kit o più prodotti)", true, M.controllaAccetta(ev, ["PR-7", "PR-1"], attesi).ok);
    c("Accetta: ViewCart non c'è per TikTok (D16): non è un difetto", true, M.controllaAccetta(M.normalizzaEventi({ ttq: [["track", "AddToCart", { contents: [{ content_id: "PR-1" }] }]] }), ["PR-1"], [{ nome: "AddToCart" }, { nome: "ViewCart" }]).ok);
    const interna = { url: "http://127.0.0.1:5199/api/public/evento", tipo: "fetch" };
    c("Rifiuta: nessuna richiesta alle piattaforme e nessun evento (solo conteggi interni) = ok", [true, 1], (() => { const r = M.controllaRifiuta([...rLocali, interna], []); return [r.ok, r.interne]; })());
    c("Rifiuta: una richiesta a Meta = rosso", false, M.controllaRifiuta([{ url: "https://www.facebook.com/tr?id=1" }], []).ok);
    c("Rifiuta: un evento in coda a una piattaforma = rosso", false, M.controllaRifiuta(rLocali, ev).ok);
    c("Rifiuta: Stripe = rosso", false, M.controllaRifiuta([{ url: "https://js.stripe.com/v3" }], []).ok);

    /* ══ 9 · SIMULAZIONI ═════════════════════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · SIMULAZIONI (offline, banner, finestre, attese)");
    const barra = { sel: "div.barra", x: 0, y: 760, w: 390, h: 84 };
    const banner = { x: 0, y: 600, w: 390, h: 156 };
    const imp = (o) => M.controllaImpilamento({ banner, posizioni: [[barra]], paginaScorribile: true, barraAttesa: false, ...o });
    c("banner e barra: il banner sopra la barra, una sola barra, pagina scorrevole = ok", true, imp().ok);
    c("banner che copre la barra, in una qualunque posizione di scorrimento = rosso", [false, false], [imp({ banner: { x: 0, y: 700, w: 390, h: 144 } }).ok, imp({ posizioni: [[], [barra]], banner: { x: 0, y: 700, w: 390, h: 144 } }).ok]);
    c("due barre nella stessa posizione = rosso; una per posizione (consulenza a metà, acquisto in fondo) = ok", [false, true], [
      imp({ posizioni: [[barra, { ...barra, sel: "div.altra" }]] }).ok, imp({ posizioni: [[barra], [{ ...barra, sel: "div.altra" }]] }).ok,
    ]);
    c("banner assente = rosso (la prova non è valida); pagina bloccata = rosso", [false, false], [imp({ banner: null }).ok, imp({ paginaScorribile: false }).ok]);
    c("nessuna barra in nessuna posizione: non è verde, è null (misura non valida)", [null, true], (() => { const r = imp({ posizioni: [[], [], []] }); return [r.ok, /non valida|nessuna barra/i.test(r.dettaglio)]; })());
    c("nessuna barra dove la barra è attesa (scheda, carrello) = rosso", false, imp({ posizioni: [[], []], barraAttesa: true }).ok);
    c("la barra visibile in una sola delle posizioni basta", true, imp({ posizioni: [[], [barra], []], barraAttesa: true }).ok);
    c("finestra modale: si apre, il fuoco resta dentro con Tab, Esc chiude, il fuoco torna a chi l'ha aperta", true, M.controllaFinestra({ aperta: true, modale: true, fuocoDentro: [true, true, true], chiusaConEsc: true, fuocoRestituito: true }).ok);
    c("finestra: fuoco che esce con Tab (se modale) = rosso; Esc che non chiude = rosso; fuoco perso = rosso; mai aperta = rosso", [false, false, false, false], [
      M.controllaFinestra({ aperta: true, modale: true, fuocoDentro: [true, false], chiusaConEsc: true, fuocoRestituito: true }).ok,
      M.controllaFinestra({ aperta: true, modale: true, fuocoDentro: [true], chiusaConEsc: false, fuocoRestituito: true }).ok,
      M.controllaFinestra({ aperta: true, modale: true, fuocoDentro: [true], chiusaConEsc: true, fuocoRestituito: false }).ok,
      M.controllaFinestra({ aperta: false, modale: true, fuocoDentro: [], chiusaConEsc: false, fuocoRestituito: false }).ok,
    ]);
    c("modale: ogni finestra aperta lo è, salvo aria-modal=\"false\" (Radix non scrive aria-modal)", [true, true, false, true], [M.eFinestraModale(null), M.eFinestraModale("true"), M.eFinestraModale("false"), M.eFinestraModale("")]);
    c("una finestra senza aria-modal che lascia uscire il fuoco con Tab = rosso", false, M.controllaFinestra({ aperta: true, modale: M.eFinestraModale(null), fuocoDentro: [true, false], chiusaConEsc: true, fuocoRestituito: true }).ok);
    c("finestra non modale: il fuoco può uscire con Tab", true, M.controllaFinestra({ aperta: true, modale: false, fuocoDentro: [true, false], chiusaConEsc: true, fuocoRestituito: true }).ok);
    c("«Aggiunto» dura 2 s: 2000 ms ok, 1500 e 3500 rosso, mai visto rosso", [true, false, false, false], [
      M.controllaAggiunto({ visto: true, durataMs: 2000 }).ok, M.controllaAggiunto({ visto: true, durataMs: 1500 }).ok, M.controllaAggiunto({ visto: true, durataMs: 3500 }).ok, M.controllaAggiunto({ visto: false, durataMs: 0 }).ok,
    ]);
    c("scheletri: niente prima dei 300 ms e presenti dopo = ok", true, M.controllaScheletri([{ ms: 100, presente: false }, { ms: 250, presente: false }, { ms: 400, presente: true }, { ms: 600, presente: true }]).ok);
    c("scheletri: già a 100 ms = rosso (lampeggia); mai = rosso", [false, false], [
      M.controllaScheletri([{ ms: 100, presente: true }, { ms: 400, presente: true }]).ok, M.controllaScheletri([{ ms: 100, presente: false }, { ms: 600, presente: false }]).ok,
    ]);
    c("scheletri: campioni troppo pochi per dire = rosso", false, M.controllaScheletri([{ ms: 100, presente: false }]).ok);
    c("offline: avviso visibile, sparisce al ritorno, carrello com'era = ok; ognuno che manca = rosso", [true, false, false, false], [
      M.controllaOffline({ avvisoVisibile: true, avvisoSparito: true, carrelloIntatto: true }).ok, M.controllaOffline({ avvisoVisibile: false, avvisoSparito: true, carrelloIntatto: true }).ok,
      M.controllaOffline({ avvisoVisibile: true, avvisoSparito: false, carrelloIntatto: true }).ok, M.controllaOffline({ avvisoVisibile: true, avvisoSparito: true, carrelloIntatto: false }).ok,
    ]);
    c("peso della ricerca: 60 KB ok, 60 KB + 1 rosso (D105); lo dice con i KB", [true, false, true], [
      M.controllaPeso(60 * 1024).ok, M.controllaPeso(60 * 1024 + 1).ok, /\d+ KB/.test(M.controllaPeso(80_000).dettaglio),
    ]);
    c("peso della ricerca: l'HTML della pagina si dice a parte e non conta", [true, true], (() => { const r = M.controllaPeso(10_000, undefined, 500_000); return [r.ok, /HTML.*488 KB|488 KB.*HTML/.test(r.dettaglio)]; })());
    c("un solo h1: 1 ok, 0 e 2 rosso", [true, false, false], [M.controllaH1(1).ok, M.controllaH1(0).ok, M.controllaH1(2).ok]);

    /* ══ 10 · L'USCITA IN JSON ═══════════════════════════════════════════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · USCITA JSON");
    const punti = [
      { id: "T3-pieni", criteri: ["V1-T3"], ok: true, dettaglio: "uno" },
      { id: "T11-bersagli", criteri: ["V1-T11"], ok: false, dettaglio: "menu 30 px" },
      { id: "T15-offline", criteri: ["V1-T15"], ok: null, dettaglio: "saltato: nessuna scheda" },
    ];
    const r = M.riassumi(punti);
    c("più misure insieme: un no vince, poi un null, vuoto non è verde", [true, null, false, false, false], [M.unisciEsiti([true, true]), M.unisciEsiti([true, null]), M.unisciEsiti([null, false, true]), M.unisciEsiti([]), M.unisciEsiti([false])]);
    c("riassunto: un rosso = non ok; conta ok, no e saltati", [false, { ok: 1, no: 1, saltati: 1 }], [r.ok, r.totali]);
    c("riassunto: tutti ok o saltati = ok; nessun punto = non ok", [true, false], [M.riassumi(punti.filter((x) => x.ok !== false)).ok, M.riassumi([]).ok]);
    c("il JSON ha per punto id, criteri, ok (true/false/null) e dettaglio", true, r.punti.every((x) => typeof x.id === "string" && Array.isArray(x.criteri) && [true, false, null].includes(x.ok) && typeof x.dettaglio === "string"));
    c("il JSON è serializzabile senza perdere niente", JSON.stringify(r), JSON.stringify(JSON.parse(JSON.stringify(r))));
    c("codice di uscita: 0 se tutto ok, 1 se c'è un rosso", [0, 1], [M.codiceUscita(M.riassumi([punti[0]])), M.codiceUscita(r)]);
    c("un controllo che lancia diventa un punto rosso col messaggio, non uno stack", [false, true, false], (() => {
      const q = M.puntoDaErrore("T3-pieni", ["V1-T3"], new Error("la pagina è sparita\n    at x.js:1:1"));
      return [q.ok, /la pagina è sparita/.test(q.dettaglio), /at x\.js/.test(q.dettaglio)];
    })());

    /* ══ 11 · IL BROWSER: FILATO CON UN FINTO (nessun browser vero) ═════════════════════════════════════ */
    gruppo("VETRINA V1 · T92 · IL BROWSER È SEMPRE CHIUSO E LE RICHIESTE ESTERNE FERMATE");
    const eventi = [];
    const finto = {
      chiuso: false,
      contesti: 0,
      async newContext(o) {
        finto.contesti++;
        const ctx = {
          route: async (g, fn) => { ctx.instradamento = fn; eventi.push(`route ${g}`); },
          on: () => {}, setDefaultTimeout: () => {}, setOffline: async () => {}, close: async () => { eventi.push("ctx.close"); },
          newPage: async () => { throw new Error("pagina non disponibile nel finto"); },
          opzioni: o,
        };
        finto.ultimo = ctx;
        return ctx;
      },
      async close() { finto.chiuso = true; },
    };
    const pwFinto = { chromium: { launch: async (o) => { eventi.push(`launch ${JSON.stringify(o)}`); return finto; } } };
    const opz = M.leggiArgomenti(["--solo", "T11", "--canale", "chrome"], {}).opzioni;
    const esito = await M.misura(pwFinto, opz);
    c("anche se ogni controllo lancia, il browser si chiude e i punti sono rossi con un messaggio", [true, true, true], [finto.chiuso, esito.punti.length > 0 && esito.punti.every((x) => x.ok === false || x.ok === null), esito.punti.every((x) => !/\n\s+at /.test(x.dettaglio))]);
    const lancio = eventi.find((e) => e.startsWith("launch")) ?? "";
    c("il browser parte con la regola del resolver: tutto NOTFOUND tranne il loopback (copre redirect, WebSocket e preconnect)", [true, true, true, true], [
      lancio.includes("--host-resolver-rules=MAP * ~NOTFOUND"), lancio.includes("EXCLUDE localhost"), lancio.includes("EXCLUDE 127.0.0.1"), lancio.includes("EXCLUDE [::1]"),
    ]);
    c("il browser parte in sola lettura sul canale chiesto, senza chiavi", [true, true], [eventi.some((e) => e.startsWith("launch") && e.includes('"channel":"chrome"') && e.includes('"headless":true')), !eventi.join("").match(/key|token|secret/i)]);
    c("ogni contesto riceve il filtro che ferma le richieste non locali", true, eventi.some((e) => e.startsWith("route")));
    const instrada = async (url) => { const r = { ab: false, cont: false }; await finto.ultimo.instradamento({ request: () => ({ url: () => url }), abort: async () => { r.ab = true; }, continue: async () => { r.cont = true; } }); return r; };
    c("il filtro: locale passa, Meta/Stripe/qualunque altro host viene abortito", [true, true, true, true], [
      (await instrada("http://127.0.0.1:5199/shop")).cont, (await instrada("https://connect.facebook.net/x.js")).ab, (await instrada("https://js.stripe.com/v3")).ab, (await instrada("https://abcd.supabase.co/rest/v1/x")).ab,
    ]);
    c("il filtro porta l'origine di --base: lo stesso indirizzo passa, un'altra porta di loopback e localhost no", [true, true, true], [
      (await instrada("http://127.0.0.1:5199/assets/a.js")).cont, (await instrada("http://127.0.0.1:3000/shop")).ab, (await instrada("http://localhost:5199/shop")).ab,
    ]);
    c("il filtro abortisce le quattro rotte vietate anche da sottorisorsa e con le maiuscole", [true, true, true, true, true], [
      (await instrada("http://127.0.0.1:5199/media/abc")).ab, (await instrada("http://127.0.0.1:5199/MEDIA/abc")).ab, (await instrada("http://127.0.0.1:5199/api/og/anteprima?x=1")).ab,
      (await instrada("http://127.0.0.1:5199/prova-anteprima-a")).ab, (await instrada("http://127.0.0.1:5199/prova-anteprima/x")).ab,
    ]);
    c("un indirizzo storto o con utente nel filtro viene abortito", [true, true], [(await instrada("not a url")).ab, (await instrada("http://utente@127.0.0.1:5199/")).ab]);
    c("la cartella del repository non ha file nuovi dopo la prova", true, !existsSync(join(RADICE, "misura-vetrina.json")) && !readFileSync(FILE, "utf8").includes("writeFileSync"));
    c("lo strumento non nomina né legge .env, .dev.vars, process.env a tappeto", [false, false], [/\.env|dev\.vars/.test(readFileSync(FILE, "utf8").replace(/process\.env/g, "")), /Object\.(keys|entries|assign)\(process\.env\)|\.\.\.process\.env/.test(readFileSync(FILE, "utf8"))]);
    c("Playwright, axe e Lighthouse non sono in package.json", [false, false, false], (() => { const pj = readFileSync(join(RADICE, "package.json"), "utf8"); return [/"playwright/.test(pj), /axe-core|@axe-core/.test(pj), /lighthouse/.test(pj)]; })());
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}
