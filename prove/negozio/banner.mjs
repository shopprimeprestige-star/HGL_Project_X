/** ── SHOP R1 · T27 · IL BANNER DEI COOKIE, «GESTISCI COOKIE» E IL PROVIDER ─────────────
 *  `src/components/tracciamento/*`, `src/routes/__root.tsx`, `CookieBanner.tsx`, `FooterId.tsx`.
 *  Tre livelli di prova, tutti senza browser vero:
 *   1. il SORGENTE (cosa c'è e cosa non c'è: nessuna X, nessun script esterno, una sola riga nella radice…);
 *   2. il MARCHIO del banner, disegnato con `react-dom/server` (tre bottoni con la stessa classe, nessuna casella
 *      spuntata di partenza, il dialogo non modale, tutti i testi dal file dei testi);
 *   3. il COMPORTAMENTO: `mostraBanner`, `serveRevoca` e il controllo del provider (`creaControllo`) con il
 *      caricatore VERO (T26) in un mondo finto: documento, finestra, cookie, archivio. Nessuna rete, nessun ID vero.
 *  Cosa deve valere: nessuno script prima del sì; mai sulle pagine non ammesse; un amministratore non si
 *  traccia e non vede il banner; togliere un consenso fa `revoca()`; una pagina privata non parla con nessuno. */
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";

const requireQui = createRequire(import.meta.url);

const CONFIG = {
  meta: { pixelId: "123456789012345" },
  tiktok: { pixelId: "C1ABCDEF2GHIJKL3MNOP" },
  google: { ga4Id: "G-TEST1234", adsId: "AW-12345678", adsLabelAcquisto: "abcDEF123" },
};
const NIENTE = { scelto: false, statistiche: false, marketing: false, ts: 0 };
const VECCHIO_ACCETTA = { scelto: false, statistiche: false, marketing: false, ts: 0, legacy: true };
const NECESSARI = { scelto: true, statistiche: false, marketing: false, ts: 1 };
const STATISTICHE = { scelto: true, statistiche: true, marketing: false, ts: 1 };
const MARKETING = { scelto: true, statistiche: true, marketing: true, ts: 1 };
const SOLO_MARKETING = { scelto: true, statistiche: false, marketing: true, ts: 1 };

/** Il mondo finto: documento, finestra, archivio di sessione, e il registro di quel che succede. */
function mondo({ host = "www.sito.test", path = "/shop", search = "", cornice = false, consenso = NIENTE, eAdmin = false, config = CONFIG, pageViewSenzaScript = false } = {}) {
  const m = { scripts: [], cookieScritti: [], reloads: 0, navigazioni: [], sess: {}, consenso, eAdmin, cornice, config, pv: [], adminChiamate: 0, configChiamate: 0, ascoltatori: [], sblocca: null, bloccaAdmin: false, meta: null };
  m.documento = {
    referrer: "",
    get cookie() { return ""; },
    set cookie(v) { m.cookieScritti.push(String(v)); },
    createElement: (tag) => (tag === "meta" ? { tag, remove() { m.meta = null; } } : { tag }),
    querySelector: (sel) => (sel === "#hgl-referrer" ? m.meta : null),
    head: { appendChild: (n) => (n.tag === "meta" ? void (m.meta = n) : m.scripts.push(n.src)) },
  };
  m.finestra = {
    location: { hostname: host, pathname: path, search, origin: `https://${host}`, reload: () => { m.reloads++; }, assign: (u) => m.navigazioni.push(u) },
    addEventListener: (tipo, f, cattura) => m.ascoltatori.push({ tipo, f, cattura }),
    history: { pushState() {}, replaceState() {} },
    localStorage: { removeItem() {} },
  };
  return m;
}

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T27 · IL BANNER DEI COOKIE, «GESTISCI COOKIE» E IL PROVIDER (20/11/2026)");
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const DIR = "src/components/tracciamento";
  const F = {
    banner: `${DIR}/BannerCookie.tsx`,
    gestisci: `${DIR}/GestisciCookie.tsx`,
    provider: `${DIR}/ProviderTracciamento.tsx`,
    testi: `${DIR}/testi-cookie.ts`,
    controllo: `${DIR}/controllo.ts`,
  };
  const src = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, leggi(f)]));
  const radiceSrc = leggi("src/routes/__root.tsx");
  const vecchio = leggi("src/components/landing/CookieBanner.tsx");
  const footerId = leggi("src/components/landing/invisible-derm/FooterId.tsx");
  const funnel = leggi("src/landing/booking/BookingFunnel.tsx");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  /* ───────────────── 1 · IL SORGENTE ───────────────── */
  c("i cinque file nuovi ci sono", [true, true, true, true, true], Object.values(F).map((f) => existsSync(join(radice, f))));
  const tuttiSrc = Object.values(src).map(senzaCommenti).join("\n");
  c("niente script esterni: nessun indirizzo https, nessun `createElement(\"script\")`, nessun import dei pixel (il provider usa il caricatore unico)", [false, false, false], [/https?:\/\//.test(tuttiSrc), /createElement\(\s*["']script/.test(tuttiSrc), /connect\.facebook|tiktok\.com|googletagmanager/.test(tuttiSrc)]);
  c("il provider usa il caricatore unico `daiCaricatore` e `initAdminCheck`", [true, true], [/daiCaricatore/.test(src.provider), /initAdminCheck/.test(src.provider)]);
  c("il provider non scrive un caricatore proprio (`creaCaricatore`)", false, /creaCaricatore/.test(tuttiSrc));
  c("il banner passa da `bannerAmmesso` (la stessa funzione dei pixel)", true, /bannerAmmesso/.test(src.controllo));
  c("la radice ha UNA sola occorrenza di `<ProviderTracciamento`, prima di `<Outlet` e fuori dal blocco `gated`", [1, true, false],
    (() => {
      const dentro = radiceSrc.slice(radiceSrc.indexOf("function RootComponent"));
      const i = dentro.indexOf("<ProviderTracciamento");
      const iOutlet = dentro.indexOf("<Outlet />");
      const iGated = dentro.indexOf("{!gated");
      return [(radiceSrc.match(/<ProviderTracciamento/g) ?? []).length, i > 0 && i < iOutlet && i < iGated, /\{!gated[\s\S]*<ProviderTracciamento/.test(dentro)];
    })());
  c("la radice importa il provider da `@/components/tracciamento/ProviderTracciamento`", true, /from "@\/components\/tracciamento\/ProviderTracciamento"/.test(radiceSrc));
  c("il vecchio `CookieBanner` non disegna niente: nessun archivio, nessun testo di bottone, nessun «Accetta»", [false, false, false], [/localStorage|hgl_cookie_consent/.test(senzaCommenti(vecchio)), /Accetta|Rifiuta/.test(senzaCommenti(vecchio)), /<div|<button/.test(senzaCommenti(vecchio))]);
  c("`FooterId` ha il link `GestisciCookie` (una riga) e conserva Privacy, Cookie (la pagina), Termini", [true, true, true, true], [/<GestisciCookie/.test(footerId), /privacy-policy/.test(footerId), /cookie-policy/.test(footerId), /termini-e-condizioni/.test(footerId)]);
  c("`BookingFunnel.tsx` persiste il modulo (`loadPersisted`, `clearPersisted`): la ricarica per la revoca non lo perde", [true, true], [/loadPersisted/.test(funnel), /clearPersisted/.test(funnel)]);
  c("nel banner: niente testo da 0,7 rem, niente `bg-brand` (bianco su brand fa 3,3:1), niente `X`, niente «Chiudi»", [false, false, false, false],
    [/text-\[0\.7rem\]/.test(senzaCommenti(src.banner)), /bg-brand\b/.test(senzaCommenti(src.banner)), /lucide-react/.test(src.banner), /\bChiudi\b/i.test(senzaCommenti(src.banner + src.testi))]);
  c("il banner non ruba il fuoco da solo: nessun `autoFocus`", false, /autoFocus|autofocus/.test(src.banner));
  c("il banner usa il file dei testi (nessun testo di bottone scritto nel componente)", [true, false], [/testi-cookie/.test(src.banner), /["'>]\s*Accetta\s*["'<]/.test(senzaCommenti(src.banner))]);

  /* il fuoco non si perde (nota 3 del revisore): dopo la scelta va sulla riga di stato, alla chiusura torna al link che aveva aperto il banner (o al primo «Gestisci cookie») */
  c("fuoco: il banner porta il fuoco sulla riga di conferma (`tabIndex={-1}`) quando la scelta è salvata", [true, true], [/statoRef/.test(src.banner) && /\.focus\(/.test(src.banner), /role="status"[\s\S]{0,200}tabIndex=\{-1\}|tabIndex=\{-1\}[\s\S]{0,200}role="status"/.test(src.banner)]);
  c("fuoco: il provider ricorda l'elemento che aveva il fuoco quando si apre da «Gestisci cookie» e lo ridà alla chiusura (altrimenti il primo link «Gestisci cookie»)", [true, true, true], [/document\.activeElement/.test(src.provider), /isConnected/.test(src.provider), /data-gestisci-cookie/.test(src.provider) && /data-gestisci-cookie/.test(src.gestisci)]);
  c("fuoco: non lo toglie a chi l'ha già spostato altrove (controlla `document.body` prima di ridarlo)", true, /document\.body/.test(src.provider));

  /* ───────────────── 2 · IL MARCHIO DEL BANNER ───────────────── */
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "banner-"));
  const impacchetta = async (contenuto, nome) => {
    const r = await esbuild.build({
      stdin: { contents: contenuto, resolveDir: radice, loader: "tsx" },
      bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent", jsx: "automatic",
      alias: { "@": join(radice, "src") },
    });
    const file = join(dir, nome);
    writeFileSync(file, r.outputFiles[0].text);
    return requireQui(file);
  };
  let B = null;
  let Vecchio = null;
  try {
    B = await impacchetta(
      `import { renderToStaticMarkup } from "react-dom/server";
       import { createElement } from "react";
       export { BannerCookie } from "@/components/tracciamento/BannerCookie";
       export { TESTI } from "@/components/tracciamento/testi-cookie";
       export const disegna = (C, props) => renderToStaticMarkup(createElement(C, props));`,
      "banner.cjs",
    );
  } catch {
    B = null;
  }
  try {
    Vecchio = await impacchetta(`export { CookieBanner } from "@/components/landing/CookieBanner";`, "vecchio.cjs");
  } catch {
    Vecchio = null;
  }
  c("il vecchio `CookieBanner` restituisce `null` quando lo si chiama (le tre landing lo importano ancora)", true, (() => { try { return Vecchio?.CookieBanner ? Vecchio.CookieBanner() === null : false; } catch { return false; } })());
  c("il banner si impacchetta e disegna", true, !!B?.BannerCookie && typeof B?.TESTI === "object");
  if (B?.BannerCookie) {
    const T = B.TESTI;
    const props = { attuale: null, onScelta: () => true, onChiudi: () => {} };
    const html = (p = {}) => B.disegna(B.BannerCookie, { ...props, ...p });
    const bottoni = (h) => [...h.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attr: m[1], testo: m[2].replace(/<[^>]+>/g, "").trim(), classe: (/class="([^"]*)"/.exec(m[1]) ?? [])[1] }));
    const campi = (h) => [...h.matchAll(/<input\b([^>]*)>/g)].map((m) => m[1]);
    const testo = (h) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

    /* la domanda */
    const h1 = html();
    const b1 = bottoni(h1);
    c("la domanda: tre bottoni, in ordine Accetta · Rifiuta · Scegli", ["Accetta", "Rifiuta", "Scegli"], b1.map((b) => b.testo));
    c("la domanda: i tre bottoni hanno la STESSA stringa di classe (stesso peso grafico)", 1, new Set(b1.map((b) => b.classe)).size);
    c("la domanda: i bottoni sono alti 44 px e di tipo `button` (non inviano niente)", [true, true], [b1.every((b) => /min-h-11|h-11/.test(b.classe)), b1.every((b) => /type="button"/.test(b.attr))]);
    c("la domanda: il bottone «Accetta» non è blu pieno né ha il testo bianco su `bg-brand`", false, /bg-brand/.test(b1[0].classe));
    c("la domanda: dialogo NON modale, con nome e descrizione", [true, true, true], [/role="dialog"/.test(h1), /aria-modal="false"/.test(h1), /aria-labelledby="[^"]+"/.test(h1) && /aria-describedby="[^"]+"/.test(h1)]);
    c("la domanda: nessuna casella, nessuna X, nessun «Chiudi», nessun autofocus", [0, false, false], [campi(h1).length, /Chiudi|aria-label="Chiudi/i.test(h1), /autofocus/i.test(h1)]);
    c("la domanda: il titolo e il testo sono quelli del Copywriter (§3.2)", [true, true], [testo(h1).includes("Cookie, in breve"), testo(h1).includes("Usiamo cookie tecnici perché lo shop funzioni. Con il tuo permesso usiamo anche quelli di Meta, TikTok e Google per capire cosa funziona e mostrarti i nostri annunci. Puoi rifiutarli: lo shop funziona uguale.")]);
    c("la domanda: il link «Cookie policy» porta a /cookie-policy", true, /<a\b[^>]*href="\/cookie-policy"[^>]*>\s*Cookie policy\s*<\/a>/.test(h1));
    c("la domanda: nessuna riga di conferma e nessun errore", [false, false], [/role="status"/.test(h1), /role="alert"/.test(h1)]);

    /* le scelte */
    const h2 = html({ vistaIniziale: "scelte" });
    const b2 = bottoni(h2);
    const i2 = campi(h2);
    c("le scelte: tre caselle — Necessari, Statistiche, Marketing", 3, i2.length);
    c("le scelte: Necessari è spuntata e BLOCCATA; Statistiche e Marketing NON sono spuntate di partenza", [true, true, false, false],
      [/\bchecked\b/.test(i2[0]) && /\bdisabled\b/.test(i2[0]), true, /\bchecked\b/.test(i2[1] ?? ""), /\bchecked\b/.test(i2[2] ?? "")]);
    c("le scelte: Statistiche e Marketing sono caselle vere, non bloccate", [false, false], [/\bdisabled\b/.test(i2[1] ?? ""), /\bdisabled\b/.test(i2[2] ?? "")]);
    c("le scelte: ogni casella ha la sua etichetta (testi dal file)", [true, true, true, true], [testo(h2).includes(T.necessari.nome), testo(h2).includes(T.statistiche.nome), testo(h2).includes(T.marketing.nome), T.marketing.nome.includes("Meta, TikTok e Google")]);
    c("le scelte: un solo «Salva la scelta», con la stessa classe degli altri due; Accetta e Rifiuta restano raggiungibili", [["Accetta", "Rifiuta", "Salva la scelta"], 1], [b2.map((b) => b.testo), new Set(b2.map((b) => b.classe)).size]);
    const h2b = html({ vistaIniziale: "scelte", attuale: { statistiche: true, marketing: false } });
    const i2b = campi(h2b);
    c("riaperto con una scelta già fatta: le caselle mostrano quella scelta (Statistiche sì, Marketing no)", [true, false], [/\bchecked\b/.test(i2b[1] ?? ""), /\bchecked\b/.test(i2b[2] ?? "")]);

    /* dopo la scelta */
    const h3 = html({ esito: "ok" });
    c("dopo la scelta: una riga di conferma con `role=\"status\"` e il testo del Copywriter, senza bottoni", [true, true, 0], [/role="status"/.test(h3), testo(h3).includes(T.salvata), bottoni(h3).length]);
    c("la conferma dice dove si cambia (il nome del link nel piè di pagina)", true, testo(T.salvata).includes(T.gestisci));
    const h4 = html({ esito: "errore" });
    c("se il browser non lascia salvare: avviso con `role=\"alert\"` e i tre bottoni restano", [true, 3, false], [/role="alert"/.test(h4), bottoni(h4).length, testo(h4).includes(T.salvata)]);
    c("il banner riaperto dal piè di pagina si può chiudere con Esc senza scegliere (gestito nel componente)", true, /Escape/.test(src.banner));
    c("l'Esc non accetta niente: il gestore di Esc chiama solo `onChiudi`", true, (() => {
      const k = src.banner.indexOf("Escape");
      return k > 0 && !/onScelta/.test(src.banner.slice(k, k + 200).split("}")[0]);
    })());
  }

  /* ───────────────── 3 · IL COMPORTAMENTO ───────────────── */
  let K = null;
  try {
    K = await impacchetta(`export * from "@/components/tracciamento/controllo";`, "controllo.cjs");
  } catch {
    K = null;
  }
  c("il controllo del provider si impacchetta e dà `mostraBanner`, `serveRevoca`, `creaControllo`", [true, true, true], [typeof K?.mostraBanner === "function", typeof K?.serveRevoca === "function", typeof K?.creaControllo === "function"]);
  const CAR = mod["lib/tracciamento/carica"];
  if (!K?.mostraBanner || !K?.creaControllo || !CAR?.creaCaricatore) return;

  /* ── dove il banner si vede ── */
  const vede = (percorso, ricerca, { inCornice = false, admin = false, consenso = NIENTE, riaperto = false } = {}) => K.mostraBanner({ percorso, ricerca, inCornice, admin, consenso, riaperto });
  const PAGINE_SI = [["/", ""], ["/shop", ""], ["/shop/c/patch", ""], ["/shop/prodotto/patch-1", "?utm_source=ig&fbclid=1"], ["/shop/carrello", ""], ["/shop/checkout", ""], ["/invisible-derm", ""], ["/invisible-derm-v1", ""], ["/nuova", ""], ["/blog", ""], ["/blog/un-articolo", ""], ["/cookie-policy", ""], ["/privacy-policy", ""], ["/termini-e-condizioni", ""]];
  c("il banner compare su tutte le pagine ammesse (shop, home, landing, blog, pagine legali), senza scelta e con l'amministratore escluso", PAGINE_SI.map(() => true), PAGINE_SI.map(([p, q]) => vede(p, q)));
  const PAGINE_NO = [
    ["/shop/ordine/ab12", "?t=1"], ["/shop/ordine/ab12", ""], ["/shop", "?watch=abc"], ["/invisible-derm", "?watch=abc"], ["/preventivo/x", ""], ["/preventivo", "?t=abc"],
    ["/meetly/abc-defg-hij", ""], ["/videochiamata/abc-defg-hij", ""], ["/CRM", ""], ["/CRM/ecommerce", ""], ["/CRM/impostazioni", "?tab=x"],
    ["/shop", "?anteprima=1"], ["/shop", "?modifica"], ["/shop", "?embed=1"], ["/shop", "?t=1"], ["/shop/prodotto/x", "?anteprima=abc"], ["/invito/x", ""], ["/media/x", ""], ["/api/public/evento", ""], ["/non-esiste", ""],
  ];
  c("il banner NON compare su `?watch=`, preventivo, videochiamata, /CRM*, anteprima, modifica, ordine, link con codici e pagine non elencate", PAGINE_NO.map(() => false), PAGINE_NO.map(([p, q]) => vede(p, q)));
  c("dentro un iframe (anteprima 390/1440 del CMS) il banner non compare, nemmeno su una pagina ammessa", [false, false], [vede("/shop", "", { inCornice: true }), vede("/", "", { inCornice: true })]);
  c("un amministratore riconosciuto non vede il banner; finché non si sa chi è (null) nemmeno", [false, false], [vede("/shop", "", { admin: true }), vede("/shop", "", { admin: null })]);
  c("prima di aver letto la scelta (null) il banner non compare: niente lampo per chi ha già scelto", false, vede("/shop", "", { consenso: null }));
  c("scelta fatta (necessari, statistiche, marketing, rifiuto vecchio): il banner non si ripresenta", [false, false, false], [vede("/shop", "", { consenso: NECESSARI }), vede("/shop", "", { consenso: STATISTICHE }), vede("/shop", "", { consenso: MARKETING })]);
  c("chi aveva premuto il vecchio «Accetta» (v1) lo rivede una volta (D10)", true, vede("/shop", "", { consenso: VECCHIO_ACCETTA }));
  c("«Gestisci cookie» lo riapre anche a chi ha già scelto; ma non sulle pagine non ammesse né a un amministratore", [true, false, false, false], [vede("/shop", "", { consenso: MARKETING, riaperto: true }), vede("/CRM/x", "", { consenso: MARKETING, riaperto: true }), vede("/shop", "?watch=x", { consenso: MARKETING, riaperto: true }), vede("/shop", "", { consenso: MARKETING, riaperto: true, admin: true })]);

  /* ── quando togliere il consenso fa `revoca()` ── */
  const rev = (a, b) => K.serveRevoca(a, b);
  c("revoca: marketing → necessari, marketing → solo statistiche, statistiche → necessari, marketing → rifiuto", [true, true, true, true], [rev(MARKETING, NECESSARI), rev(MARKETING, STATISTICHE), rev(STATISTICHE, NECESSARI), rev(SOLO_MARKETING, NECESSARI)]);
  c("revoca: anche se una categoria si toglie e l'altra si dà (statistiche → solo marketing)", true, rev(STATISTICHE, SOLO_MARKETING));
  c("nessuna revoca: prima scelta (anche «solo necessari»), si aggiunge, si resta uguali", [false, false, false, false, false, false], [rev(NIENTE, NECESSARI), rev(NIENTE, MARKETING), rev(NECESSARI, STATISTICHE), rev(STATISTICHE, MARKETING), rev(MARKETING, MARKETING), rev(VECCHIO_ACCETTA, NECESSARI)]);
  c("nessuna revoca nemmeno dal vecchio rifiuto (v1) a un «solo necessari»", false, rev({ scelto: true, statistiche: false, marketing: false, ts: 0, legacy: true }, NECESSARI));

  /* ── il controllo con il caricatore vero ── */
  /** Il controllo e il suo mondo: il caricatore è quello vero (T26), l'amministratore si sa come nel browser (`lp_admin_skip` ≠ «0» = sì). */
  function nuovo(opz = {}) {
    const m = mondo(opz);
    m.car = CAR.creaCaricatore({ documento: m.documento, finestra: m.finestra, admin: () => m.sess.lp_admin_skip !== "0", inCornice: () => m.cornice, tiktokNelBrowser: false });
    m.ctl = K.creaControllo({
      caricatore: m.car,
      leggi: () => m.consenso,
      pagina: () => ({ percorso: m.finestra.location.pathname, ricerca: m.finestra.location.search, inCornice: m.cornice }),
      admin: async () => {
        m.adminChiamate++;
        if (m.bloccaAdmin) await new Promise((r) => { m.sblocca = r; });
        m.sess.lp_admin_skip = m.eAdmin ? "1" : "0"; // come `initAdminCheck` vero
        return m.eAdmin;
      },
      config: async () => { m.configChiamate++; return typeof m.config === "function" ? m.config() : m.config; },
      pageView: () => { const ok = m.car.puoAgire() && Object.values(m.car.caricati()).some(Boolean); if (ok) m.pv.push(m.finestra.location.pathname); return ok ? "id" : null; },
    });
    m.vai = (path, search = "") => { m.finestra.location.pathname = path; m.finestra.location.search = search; };
    return m;
  }
  const stato = (m) => [m.scripts.length, m.configChiamate, m.pv.length];

  // nessuno script prima del sì
  const a = nuovo({ consenso: NIENTE });
  await a.ctl.valuta();
  c("senza scelta: 0 script, la configurazione dei pixel non si chiede nemmeno, nessun PageView", [0, 0, 0], stato(a));
  const a2 = nuovo({ consenso: NECESSARI });
  await a2.ctl.valuta();
  c("solo necessari: 0 script, nessuna richiesta di configurazione, nessun PageView, nessun cookie toccato", [0, 0, 0, 0, 0], [...stato(a2), a2.cookieScritti.length, a2.reloads]);
  const a3 = nuovo({ consenso: VECCHIO_ACCETTA });
  await a3.ctl.valuta();
  c("il vecchio «Accetta» (v1) non carica niente: si ripropone il banner", [0, 0, 0], stato(a3));

  // con il sì, dopo la risposta sull'amministratore
  const b = nuovo({ consenso: MARKETING });
  b.bloccaAdmin = true;
  const corsa = b.ctl.valuta();
  await Promise.resolve();
  c("con il marketing ma PRIMA che si sappia se è un amministratore: 0 script e nessuna configurazione richiesta", [0, 0, 0, 1], [...stato(b), b.adminChiamate]);
  b.sblocca();
  await corsa;
  c("dopo la risposta «non è un amministratore»: arrivano Meta e Google (non TikTok nel browser), con UN PageView", [2, 1, 1], stato(b));
  c("gli script sono quelli giusti, con gli ID della configurazione", ["https://connect.facebook.net/en_US/fbevents.js", "https://www.googletagmanager.com/gtag/js?id=G-TEST1234"], [...b.scripts].sort());
  await b.ctl.valuta();
  c("valutare di nuovo la stessa pagina: niente script doppi, niente PageView doppio, configurazione chiesta una volta", [2, 1, 1], stato(b));

  // amministratore
  const d = nuovo({ consenso: MARKETING, eAdmin: true });
  await d.ctl.valuta();
  c("amministratore: 0 script, nessuna configurazione richiesta, nessun PageView", [0, 0, 0], stato(d));
  c("amministratore: `verificaAdmin` dice sì (il banner non compare)", true, await d.ctl.verificaAdmin());
  const d2 = nuovo({ consenso: NIENTE });
  c("`verificaAdmin` chiede l'amministratore una volta sola, anche chiamata tre volte", [false, 1], [await d2.ctl.verificaAdmin(), (await d2.ctl.verificaAdmin(), await d2.ctl.verificaAdmin(), d2.adminChiamate)]);
  const d3 = nuovo({ consenso: MARKETING });
  d3.ctl = K.creaControllo({ ...{}, caricatore: d3.car, leggi: () => d3.consenso, pagina: () => ({ percorso: "/shop", ricerca: "", inCornice: false }), admin: async () => { throw new Error("rete"); }, config: async () => CONFIG, pageView: () => "id" });
  c("se il controllo dell'amministratore fallisce vale «amministratore»: nessuno script, il banner non disturba", [true, 0], [await d3.ctl.verificaAdmin(), (await d3.ctl.valuta(), d3.scripts.length)]);

  // pagine non ammesse: non si parla con nessuno
  const NON_AMMESSE = [["/shop/ordine/ab12", "?t=1"], ["/shop", "?watch=abc"], ["/preventivo/x", ""], ["/meetly/abc-defg-hij", ""], ["/CRM/ecommerce", ""], ["/shop", "?anteprima=1"], ["/shop", "?modifica"], ["/shop", "?embed=1"]];
  const riga = [];
  for (const [p, q] of NON_AMMESSE) {
    const x = nuovo({ consenso: MARKETING, path: p, search: q });
    await x.ctl.valuta();
    riga.push([x.scripts.length, x.configChiamate, x.adminChiamate, x.pv.length].join("/"));
  }
  c("pagine non ammesse con il marketing concesso: 0 script, 0 richieste di configurazione, 0 controlli dell'amministratore, 0 PageView", NON_AMMESSE.map(() => "0/0/0/0"), riga);
  const conMeta = [];
  for (const [p, q] of NON_AMMESSE) {
    const x = nuovo({ consenso: NIENTE, path: p, search: q });
    await x.ctl.valuta();
    conMeta.push(!!x.meta?.content);
  }
  c("pagine non ammesse: `applicaConsenso` gira lo stesso (anche senza scelta e senza configurazione) e mette il `<meta name=referrer>` (il valore è di T26)", NON_AMMESSE.map(() => true), conMeta);
  const ra = nuovo({ consenso: NIENTE, path: "/shop" });
  await ra.ctl.valuta();
  c("pagina ammessa: nessun meta del referrer", null, ra.meta);
  const rb = nuovo({ consenso: NIENTE, path: "/shop/ordine/ab12", search: "?t=1" });
  await rb.ctl.valuta();
  rb.vai("/shop");
  await rb.ctl.valuta();
  c("dalla pagina non ammessa a una ammessa (navigazione interna) il meta si toglie; e si rimette tornando indietro", [null, true], [rb.meta, (rb.vai("/CRM/leads"), await rb.ctl.valuta(), !!rb.meta?.content)]);
  const cornice = nuovo({ consenso: MARKETING, cornice: true });
  await cornice.ctl.valuta();
  c("dentro un iframe (anteprima): 0 script, 0 richieste, 0 controlli, 0 PageView", "0/0/0/0", [cornice.scripts.length, cornice.configChiamate, cornice.adminChiamate, cornice.pv.length].join("/"));

  // navigazione dentro l'app
  const n = nuovo({ consenso: MARKETING });
  await n.ctl.valuta();
  n.vai("/shop/prodotto/patch-1");
  await n.ctl.valuta();
  c("nuova pagina ammessa: un PageView in più (indirizzo diverso), nessuno script in più, configurazione sempre una volta", [2, 2, 1], [n.pv.length, n.scripts.length, n.configChiamate]);
  await n.ctl.valuta();
  c("la stessa pagina rivalutata: nessun PageView in più", 2, n.pv.length);
  n.vai("/shop");
  await n.ctl.valuta();
  c("si torna a una pagina già vista (A → B → A): il PageView si rifà", 3, n.pv.length);
  n.vai("/shop/ordine/ab12", "?t=chiave-privata");
  await n.ctl.valuta();
  c("si entra in una pagina non ammessa con gli script già dentro: sospesi e pagina ricaricata, nessun PageView", [true, 1, 3], [n.car.sospeso(), n.reloads, n.pv.length]);

  // configurazione che non arriva
  const e = nuovo({ consenso: MARKETING, config: null });
  await e.ctl.valuta();
  c("configurazione non disponibile: 0 script e nessun PageView, ma non crolla", [0, 1, 0], stato(e));
  e.config = CONFIG;
  await e.ctl.valuta();
  c("al giro dopo la configurazione si richiede, e se arriva si parte; poi non si richiede più", [2, 2, 1], stato(e));
  await e.ctl.valuta();
  c("…una volta arrivata non si chiede più", 2, e.configChiamate);
  const e2 = nuovo({ consenso: MARKETING, config: () => { throw new Error("rete"); } });
  await e2.ctl.valuta();
  c("la richiesta di configurazione che lancia: nessuno script, nessun errore fuori", [0, 1], [e2.scripts.length, e2.configChiamate]);

  // la scelta cambia
  const g = nuovo({ consenso: NIENTE });
  await g.ctl.valuta();
  g.consenso = MARKETING;
  await g.ctl.consensoCambiato(MARKETING);
  c("da «nessuna scelta» ad «Accetta»: gli script arrivano subito, UN PageView per la pagina, nessuna ricarica, nessun cookie toccato", [2, 1, 0, 0], [g.scripts.length, g.pv.length, g.reloads, g.cookieScritti.length]);
  const g1 = nuovo({ consenso: NIENTE });
  await g1.ctl.valuta();
  g1.consenso = NECESSARI;
  await g1.ctl.consensoCambiato(NECESSARI);
  c("da «nessuna scelta» a «Rifiuta»: nessuno script, nessuna ricarica, nessun cookie toccato", [0, 0, 0], [g1.scripts.length, g1.reloads, g1.cookieScritti.length]);
  const g2 = nuovo({ consenso: STATISTICHE });
  await g2.ctl.valuta();
  c("solo statistiche: arriva solo Google", ["https://www.googletagmanager.com/gtag/js?id=G-TEST1234"], g2.scripts);
  g2.consenso = MARKETING;
  await g2.ctl.consensoCambiato(MARKETING);
  c("da statistiche a marketing: arriva anche Meta, nessuna revoca, nessuna ricarica", [2, 0, 0], [g2.scripts.length, g2.reloads, g2.cookieScritti.length]);
  g2.consenso = STATISTICHE;
  await g2.ctl.consensoCambiato(STATISTICHE);
  c("da marketing a statistiche: REVOCA (cookie delle piattaforme cancellati, pagina ricaricata senza script)", [true, true, true], [g2.reloads === 1, g2.cookieScritti.some((x) => /^_fbp=;/.test(x)), g2.car.sospeso()]);
  const g3 = nuovo({ consenso: STATISTICHE });
  await g3.ctl.valuta();
  g3.consenso = NECESSARI;
  await g3.ctl.consensoCambiato(NECESSARI);
  c("da statistiche a «solo necessari»: REVOCA (cookie di Google cancellati, ricarica)", [true, true], [g3.reloads === 1, g3.cookieScritti.some((x) => /^_ga=;/.test(x))]);
  const g4 = nuovo({ consenso: MARKETING, path: "/shop" });
  await g4.ctl.valuta();
  g4.consenso = NECESSARI;
  await g4.ctl.consensoCambiato(NECESSARI);
  c("dopo la revoca nessun altro script entra e nessun PageView parte", [2, 1], [g4.scripts.length, g4.pv.length]);
  await g4.ctl.valuta();
  c("…nemmeno a un'altra valutazione (il caricatore è sospeso e il consenso è «necessari»)", [2, 1], [g4.scripts.length, g4.pv.length]);

  // l'intestazione `Referrer-Policy` dal server (stessa regola dei pixel e del meta)
  const RP = K.politicaReferrer;
  c("`politicaReferrer` esiste", "function", typeof RP);
  if (typeof RP === "function") {
    const NO = (p, q = "") => RP(p, q);
    c("Referrer-Policy: strict-origin (NON no-referrer: YouTube risponde «errore 153» agli incorporamenti senza Referer) su ordine, CRM, preventivo, videochiamata, media, `?watch`, anteprima e pagine non elencate", NON_AMMESSE.concat([["/CRM", ""], ["/media/x", ""], ["/meetly/x", ""], ["/preventivo", ""], ["/non-esiste", ""]]).map(() => "strict-origin"),
      NON_AMMESSE.concat([["/CRM", ""], ["/media/x", ""], ["/meetly/x", ""], ["/preventivo", ""], ["/non-esiste", ""]]).map(([p, q]) => NO(p, q)?.["Referrer-Policy"]));
    c("nessuna intestazione sulle pagine ammesse (la landing e lo shop tengono il referrer di sempre)", PAGINE_SI.map(() => undefined), PAGINE_SI.map(([p, q]) => RP(p, q)?.["Referrer-Policy"]));
    c("la ricerca può arrivare come testo o come oggetto della rotta (`{watch: \"x\"}`): stessa risposta", ["strict-origin", "strict-origin", undefined], [RP("/shop", { watch: "x" })?.["Referrer-Policy"], RP("/shop", "?t=1")?.["Referrer-Policy"], RP("/shop", { utm_source: "ig" })?.["Referrer-Policy"]]);
  }
  c("né la radice né `controllo.ts` usano `no-referrer` (rompe i lettori YouTube di /web, /webinar, /slide, /presenta)", [false, false], [/["']no-referrer["']/.test(senzaCommenti(radiceSrc)), /["']no-referrer["']/.test(senzaCommenti(src.controllo))]);
  c("`__root.tsx` mette l'intestazione dalle `headers` della radice, senza perdere `Cache-Control`", [true, true], [/politicaReferrer/.test(radiceSrc), /no-cache, must-revalidate/.test(radiceSrc)]);

  // un amministratore che cambia scelta: niente, e nessuna revoca che ricarica a vuoto
  const h = nuovo({ consenso: NIENTE, eAdmin: true });
  await h.ctl.valuta();
  h.consenso = MARKETING;
  await h.ctl.consensoCambiato(MARKETING);
  c("un amministratore che dà il consenso: nessuno script lo stesso", 0, h.scripts.length);
}
