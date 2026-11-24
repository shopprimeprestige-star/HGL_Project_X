/** ── VETRINA V1 · T98 · LA PAGINA DEL CARRELLO ─────────────────────────────────────────────────────────────
 *  `PaginaCarrello` (con `cms`, dentro `src/routes/shop.carrello.tsx`) disegnata con dati inventati, senza browser né rete (`rendi`, `_rende.mjs`).
 *  Quello che si guarda: V1-K1…K5 (righe, riepilogo, vuoto con due ingressi e consulenza, con righe nessun invito), V1-T9/D89 (la cifra solo con «ok»,
 *  mai quella ricordata dal browser, lo stesso stato per righe e riepilogo), V1-T8 (consulenza solo nel vuoto), eventi (`RemoveFromCart` prima di togliere,
 *  `ViewCart` nel sorgente) e il sorgente (chiave delle righe, barra nello slot, nessun testo scritto a mano, nessun `localStorage`).
 *  Gli effetti non girano in `react-dom/server`: la barra nello slot, `ViewCart`, la ricerca del «Ti serve anche» e gli avvisi per riga tolta
 *  si provano nel sorgente e con le funzioni pure di T79; il resto è di T103c (browser). Con `codice` la pagina di oggi non cambia (lo prova l'oro). */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { CARRELLO_MISTO, CARRELLO_NUOVO, CARRELLO_VECCHIO, TARIFFA_CARRELLO_OK, carrelloFinto, rivalidaFinta, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { gestore, rendi, rendiComponente } from "./_rende.mjs";

const FILE = "src/routes/shop.carrello.tsx";
const PAGINA = "src/components/shop/pagine/PaginaCarrello.tsx";
const requireQui = createRequire(import.meta.url);
const conta = (html, re) => (html.match(re) ?? []).length;
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
/** `prove.mjs` non impacchetta `src/landing/*`: i testi si caricano da soli (come `shop-barre.mjs`), senza moduli aggiunti a mano nella suite. */
async function carica(radice, file) {
  const esbuild = requireQui(join(radice, "node_modules/esbuild"));
  const dir = mkdtempSync(join(tmpdir(), "prova-carrello-v1-"));
  try {
    const r = await esbuild.build({ entryPoints: [join(radice, file)], bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent" });
    const uscita = join(dir, "modulo.cjs");
    writeFileSync(uscita, r.outputFiles[0].text);
    return requireQui(uscita);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const nudo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CONSULENZA = /consulenza|non sai cosa scegliere/i;

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T98 · PAGINA DEL CARRELLO (23/11/2026)");
  const V = mod["shop/cms/vetrina-carrello"];
  const TS = await carica(radice, "src/landing/testi-shop.ts");
  if (!V) return c("il modulo `vetrina-carrello` esiste", true, false);
  const T = TS.TESTI_SHOP.carrello;
  const pagina = (lines, extra = {}) =>
    rendi(radice, FILE, { loaderData: { modo: "cms" }, carrello: carrelloFinto(lines, extra.carrello), rivalida: rivalidaFinta(extra.rivalida), tariffa: extra.tariffa ?? TARIFFA_CARRELLO_OK, pathname: "/shop/carrello" });
  const [alfa, beta] = CARRELLO_NUOVO;
  //  `euroRaw` = come sta nell'HTML (spazio fisso prima di «€»); `euro` = come si legge dopo `chiaro` (spazio normale)
  const euroRaw = (cent) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cent / 100);
  const euro = (cent) => euroRaw(cent).replace(/\s/g, " ");
  const chiaro = (h) => leggibile(h).replace(/ /g, " ");

  // ── il carrello con righe: K1, K4, K5 ──
  const con = await pagina(CARRELLO_NUOVO);
  const hc = con.html;
  const tc = chiaro(hc);
  c("con righe: un solo H1 «Il tuo carrello», il sottotitolo del documento, due righe in una lista (`<ul role=list>`, un `<li>` per riga)", [1, true, true, 1, 2], [conta(hc, /<h1\b/g), tc.includes(T.titolo), tc.includes(T.sottotitolo), conta(hc, /<ul role="list"/g), conta(hc, /<li\b/g)]);
  const sub = alfa.snap.prezzoCent * alfa.qty + beta.snap.prezzoCent * beta.qty;
  c("con righe: prezzo di riga (pezzo × quantità) dal server, «Prodotti», «Spedizione» (tariffa 4,90 €) e «Totale (IVA inclusa)» = prodotti + spedizione", [true, true, true, true, true, true], [
    tc.includes(euro(beta.snap.prezzoCent * beta.qty)), hc.includes(`<dt>${T.prodotti}</dt><dd class="ml-auto tabular-nums text-[#0A1430]">${euroRaw(sub)}`), hc.includes(`<dt>${T.spedizione}</dt><dd class="ml-auto tabular-nums text-[#0A1430]">${euroRaw(490)}`),
    tc.includes(`${T.totale} (${T.ivaInclusa}) ${euro(sub + 490)}`), tc.indexOf(T.prodotti) < tc.indexOf(T.spedizione), tc.indexOf(T.spedizione) < tc.indexOf(`${T.totale} (`)]);
  c("con righe: [Vai alla cassa] è UN link verso `/shop/checkout` (la cassa di oggi), con l'attributo che nasconde la barra; mai «Procedi al checkout»", [1, 1, true, false], [
    conta(hc, /<a [^>]*href="\/shop\/checkout"/g), conta(hc, /<a data-barra-nascondi="vista" href="\/shop\/checkout"/g), tc.includes(T.vaiAllaCassa), /Procedi al checkout/.test(hc)]);
  c("con righe: il riepilogo è `sticky` sul computer e sta DOPO le righe nel disegno (colonna di destra), «Continua a guardare» porta a `/shop`", [true, true, true], [/<div class="lg:sticky lg:top-24">/.test(hc), hc.indexOf("<ul role=\"list\"") < hc.indexOf("lg:sticky"), new RegExp(`<a href="/shop"[^>]*>${T.continua}</a>`).test(hc)]);
  c("V1-K5 con righe: NESSUN invito alla consulenza (né il link, né la parola, né il bottone del vuoto), nessun ingresso «Patch pronte»", [false, false, 0], [CONSULENZA.test(hc), new RegExp(`${T.vuotoBottone1}|${T.vuotoBottone2}`).test(hc), conta(hc, /data-stato="vuoto"/g)]);
  c("V1-K4: nessuna barra di spedizione gratuita, nessuna soglia, mai «da calcolare»", [false, false, false], [/gratuit/i.test(hc), /per la spedizione|ti manca/i.test(hc), /da calcolare/i.test(hc)]);
  c("nessuna stella, recensione, barrato; nessuna parola vietata né segnaposto; nessun «da confermare»", [[], false, false], [trovaParoleVietate(hc), /lucide-star|recension|line-through/i.test(hc), /\{\{|da confermare/i.test(hc)]);
  c("la regione degli avvisi c'è sempre (anche vuota): una regione che nasce già piena non viene letta", [true, true], [/<div role="status"><\/div>/.test(hc), conta(hc, /role="status"/g) >= 3]);
  c("senza avvisi nessun riquadro ambra (filetto `border-l-[#8A5A00]`, T102 A18) e nessun `role=alert`", [false, false], [/border-l-\[#8A5A00\]/.test(hc), /role="alert"/.test(hc)]);

  // ── il vuoto: K5 ──
  const vuoto = await pagina([]);
  const hv = vuoto.html;
  const ing = V.ingressiCarrelloVuoto();
  c("vuoto: un solo H1 «Il carrello è vuoto.» (non quello del carrello con righe), il testo del documento, due ingressi e il link alla consulenza", [1, true, true, false], [conta(hv, /<h1\b/g), chiaro(hv).includes(T.vuotoTitolo), chiaro(hv).includes(T.vuotoTesto), chiaro(hv).includes(T.titolo)]);
  c("vuoto: [Patch pronte] PIENO e (Cura e manutenzione) CONTORNO, con i due indirizzi di T79; il link «Non sai cosa scegliere? Consulenza gratuita» è un bottone (apre il flusso, non una pagina)", [
    true, true, true], [
    new RegExp(`<a data-aspetto="pieno" href="${ing.ingressi[0].href}"[^>]*>${T.vuotoBottone1}</a>`).test(hv), new RegExp(`<a data-aspetto="contorno" href="${ing.ingressi[1].href}"[^>]*>${T.vuotoBottone2}</a>`).test(hv), /<button type="button" data-aspetto="link"[^>]*>/.test(hv) && hv.includes(`>${T.vuotoLink}</button>`)]);
  c("vuoto: niente riepilogo, niente «Vai alla cassa», niente lista di righe", [false, false, false], [/Vai alla cassa/.test(hv), /<dl\b/.test(hv), /<ul role="list"/.test(hv)]);
  c("vuoto: la regione degli avvisi c'è (come con le righe)", true, /<div role="status"><\/div>/.test(hv));
  const clic = gestore(vuoto.pagina, "button", T.vuotoLink);
  let lancia = null;
  try { clic(); } catch (e) { lancia = String(e?.message ?? e); }
  c("il clic sulla consulenza conta `ClickConsulenza` (solo contatore interno, mai le piattaforme) e non manda nessun evento Meta/TikTok", [[["ClickConsulenza", { punto: "carrello" }]], 0], [vuoto.pagina.contatori, vuoto.pagina.eventi.length]);
  c("…e il clic non lancia nessun errore", null, lancia);

  // ── prezzi dal server (D89, V1-T9) ──
  const manomesso = CARRELLO_NUOVO.map((l, i) => ({ ...l, snap: { ...l.snap, prezzoCent: i === 0 ? 777700 : 888800 } }));
  const inControllo = (await pagina(manomesso, { rivalida: { stato: "controllo" } })).html;
  c("V1-T9 «controllo» con prezzi manomessi nel browser: nessuna cifra del browser (né 7.777,00 né 8.888,00 né un totale), prezzi di riga, «Prodotti» e totale «…»; [Vai alla cassa] resta acceso", [false, [euroRaw(490)], 4, true], [
    /7\.777|8\.888|7777|8888/.test(inControllo), inControllo.match(/\d+,\d\d\s€/g), conta(inControllo, />…</g), /<a data-barra-nascondi="vista" href="\/shop\/checkout"/.test(inControllo)]);
  const inOk = (await pagina(manomesso, { rivalida: { stato: "ok" } })).html;
  c("con «ok» le righe mostrano il prezzo che le `lines` hanno DOPO la rivalida (il server le riscrive): qui il 7.777,00 delle `lines`", true, chiaro(inOk).includes(euro(777700)));
  const guasto = (await pagina(manomesso, { rivalida: { stato: "non_verificabile" } })).html;
  c("«non_verificabile»: prezzi, prodotti e totale «—», nessuna cifra del browser, nessuna cifra inventata; l'avviso `role=alert` di R2; le righe restano e [Vai alla cassa] anche", [false, true, true, true], [
    /7\.777|8\.888/.test(guasto), conta(guasto, />—</g) >= 4, /role="alert"[^>]*>(?:<svg[^]*?<\/svg>)?Non riusciamo a controllare il carrello/.test(guasto), conta(guasto, /<li\b/g) === 2 && /href="\/shop\/checkout"/.test(guasto)]);
  c("la spedizione è quella del server: tariffa a 12,00 → «Spedizione» 12,00 €; tariffa assente → «—» e totale «—» (mai un totale senza spedizione)", [true, true, true], [
    chiaro((await pagina(CARRELLO_NUOVO, { tariffa: { stato: "ok", costoCent: 1200, chiusa: false } })).html).includes(`${T.totale} (${T.ivaInclusa}) ${euro(sub + 1200)}`), hc.includes(`<dd class="ml-auto tabular-nums text-[#0A1430]">${euroRaw(490)}`),
    /<dt[^>]*>Totale <span[^>]*>\(IVA inclusa\)<\/span><\/dt><dd[^>]*>—</.test((await pagina(CARRELLO_NUOVO, { tariffa: { stato: "assente", costoCent: null, chiusa: false } })).html)]);

  // ── righe del catalogo vecchio e di Invisible Derm (V1-K3) ──
  const misto = await pagina(CARRELLO_MISTO);
  c("V1-K3: righe vecchie e Invisible Derm non si disegnano (una sola riga), e la frase «alcuni prodotti non sono più disponibili» si legge nel riquadro ambra", [1, true, true], [
    conta(misto.html, /<li\b/g), /role="status"[^>]*><p[^>]*>(?:<svg[^]*?<\/svg>)?Alcuni prodotti non sono più disponibili/.test(misto.html), /border-l-\[#8A5A00\]/.test(misto.html)]);
  const soloVecchio = await pagina(CARRELLO_VECCHIO);
  c("V1-K3: con SOLE righe vecchie (e il controllo fatto) il carrello è vuoto — si decide sulle righe che si vedono, non sul conteggio — e la frase c'è", [1, true, 0, true], [
    conta(soloVecchio.html, /data-stato="vuoto"/g), /Alcuni prodotti non sono più disponibili/.test(soloVecchio.html), conta(soloVecchio.html, /Vai alla cassa/g), CONSULENZA.test(soloVecchio.html)]);
  const vecchioGuasto = await pagina(CARRELLO_VECCHIO, { rivalida: { stato: "non_verificabile" } });
  c("con sole righe vecchie e il server che non risponde: vuoto, senza dire «le abbiamo tolte» (sono ancora lì) e senza barra", [false, 0], [/non sono più disponibili/i.test(vecchioGuasto.html), conta(vecchioGuasto.html, /Vai alla cassa/g)]);
  const avvisoGancio = await pagina(CARRELLO_NUOVO, { rivalida: { stato: "ok", avviso: "I prezzi sono stati aggiornati." } });
  c("l'avviso del gancio (R2) resta a schermo anche dopo la ripulitura (le righe vecchie non ci sono più, `vista.frase` è sparita)", true, /role="status"[^>]*><p[^>]*>(?:<svg[^]*?<\/svg>)?I prezzi sono stati aggiornati\./.test(avvisoGancio.html));

  // ── gesti: quantità e «Togli» ──
  const reg = { chiamate: [], eventiAlTogli: null };
  const car = carrelloFinto(CARRELLO_NUOVO, { setQty: (k, n) => reg.chiamate.push(["setQty", k, n]), remove: (k) => (reg.eventiAlTogli = pagina_ ? pagina_.eventi.map((e) => e[0]) : null, reg.chiamate.push(["remove", k])) });
  let pagina_ = null;
  const p1 = await rendi(radice, FILE, { loaderData: { modo: "cms" }, carrello: car, rivalida: rivalidaFinta(), tariffa: TARIFFA_CARRELLO_OK });
  pagina_ = p1.pagina;
  gestore(p1.pagina, "button", `${TS.TESTI_PROVVISORI.carrello.aumenta} ${beta.snap.nome}`)();
  c("la quantità va SUBITO al carrello (`setQty` con la chiave della riga e la quantità + 1), non dopo il server", [["setQty", beta.key, beta.qty + 1]], reg.chiamate);
  gestore(p1.pagina, "button", `${T.togli} ${alfa.snap.nome}`)();
  c("«Togli»: `RemoveFromCart` parte PRIMA di `remove` (la riga si cerca per chiave) e `remove` riceve la chiave della riga", [["RemoveFromCart"], ["remove", alfa.key]], [reg.eventiAlTogli, reg.chiamate.at(-1)]);
  const ev = p1.pagina.eventi.find((e) => e[0] === "RemoveFromCart")?.[1];
  c("…l'evento ha lo SKU della VARIANTE, i pezzi della riga e il valore in centesimi dal server (stato «ok»); solo le chiavi di `DatiEvento`, nessun dato di clienti", [[alfa.sku], alfa.qty, alfa.snap.prezzoCent * alfa.qty, true], [
    ev?.contentIds, ev?.numItems, ev?.valueCent, Object.keys(ev ?? {}).every((k) => ["contentIds", "contentName", "contentType", "valueCent", "numItems", "searchString", "categoria"].includes(k))]);
  const pc = await rendi(radice, FILE, { loaderData: { modo: "cms" }, carrello: carrelloFinto(CARRELLO_NUOVO, { remove() {} }), rivalida: rivalidaFinta({ stato: "controllo" }), tariffa: TARIFFA_CARRELLO_OK });
  gestore(pc.pagina, "button", `${T.togli} ${alfa.snap.nome}`)();
  const evC = pc.pagina.eventi.find((e) => e[0] === "RemoveFromCart")?.[1];
  c("«Togli» durante il controllo: l'evento parte SENZA cifra (il valore ricordato dal browser non va alle piattaforme)", [true, undefined], [!!evC, evC?.valueCent]);

  // ── «Ti serve anche»: una sola card, letta da `correlato` (T85/T88b) ──
  const corr = { slug: "balsamo-prova", nome: "Balsamo di prova", prezzoDaCent: 1690, foto: null, sku: "BALS-1", prezziDiversi: false, aggiungibile: true };
  const carte = (props) => rendiComponente(radice, "src/components/shop/TiServeAnche.tsx", "TiServeAnche", { titolo: TS.riempi(T.tiServeAnche, { nome: "Balsamo di prova" }), ...props }, { carrello: carrelloFinto([]) });
  const hCard = (await carte({ correlato: corr })).html;
  c("«Ti serve anche: {nome}»: UNA card, con «Aggiungi» (il `correlato` porta SKU e «un clic»: `TiServeAnche` lo legge da sé), titolo del carrello", [1, 1, true, true], [conta(hCard, /<h2\b/g), conta(hCard, /<button\b[^>]*>Aggiungi</g), chiaro(hCard).startsWith("Ti serve anche: Balsamo di prova"), chiaro(hCard).includes(euro(1690))]);
  c("…con un `correlato` senza le chiavi nuove (server di prima) o senza SKU: «Scegli», mai «Aggiungi»", [true, false], [/>Scegli</.test((await carte({ correlato: { slug: "b", nome: "B", prezzoDaCent: 1690, foto: null } })).html), /Aggiungi/.test((await carte({ correlato: { ...corr, sku: null } })).html)]);

  // ── il sorgente ──
  const src = readFileSync(join(radice, PAGINA), "utf8");
  const sn = nudo(src);
  const rotta = nudo(readFileSync(join(radice, FILE), "utf8"));
  c("sorgente: righe con `key={riga.key}` (non l'indice), `RemoveFromCart` PRIMA di `remove(chiave)` cercando la riga per chiave, la quantità va a `setQty` senza passare dal server", [true, true, true, true], [
    /<RigaCarrelloShop key=\{riga\.key\}/.test(sn), /lines\.find\(\(l\) => l\.key === chiave\)/.test(sn), sn.indexOf("eventoRimuovi(") < sn.indexOf("remove(chiave)"), /onQuantita=\{setQty\}/.test(sn)]);
  c("sorgente: righe e riepilogo leggono lo STESSO stato di rivalida (`righeVista(lines, stato)` poi `riepilogo(vista, tariffa)`), motore di oggi (`useCart`, `useRivalidaCarrello(\"cms\")`, `useTariffa(true)`)", [true, true, true, true, true], [
    /righeVista\(lines, stato\)/.test(sn), /riepilogo\(vista, tariffa\)/.test(sn), /useRivalidaCarrello\("cms"\)/.test(sn), /useTariffa\(true\)/.test(sn), /const conRighe = vista\.righe\.length > 0/.test(sn)]);
  c("sorgente: `RiepilogoOrdine` e la barra solo con righe (nel ramo `conRighe`); `AvvisoCarrello` UNA volta, fuori dai rami, così non si smonta", [1, 1, true, true], [
    conta(sn, /<RiepilogoOrdine\b/g), conta(sn, /<AvvisoCarrello\b/g), sn.indexOf("<AvvisoCarrello") < sn.indexOf("{conRighe ? ("), sn.indexOf("<RiepilogoOrdine") > sn.indexOf("{conRighe ? (")]);
  c("sorgente: la barra «Totale · Vai alla cassa» (`BarraCarrello`) va nello slot in fondo al guscio con `createPortal` (`[data-slot-barra-fissa]`), senza slot niente barra e nessun errore", [true, true, true, true], [
    /import \{ createPortal \} from "react-dom"/.test(sn), /SLOT_BARRA_FISSA = "\[data-slot-barra-fissa\]"/.test(sn), /createPortal\(barra, slot\)/.test(sn), /\{slot \? createPortal\(barra, slot\) : null\}/.test(sn)]);
  c("sorgente: `ViewCart` solo da `eventoCarrello(…, stato)` (una volta, controllo finito), nessun pixel a mano, nessun `Search`, nessuna memoria del browser per i prezzi", [true, false, false, false], [
    /eventoCarrello\(viste\.current, stato\)/.test(sn) && /emessa\.current/.test(sn), /fbq|ttq|gtag|fireCapi|firePixel/.test(sn), /"Search"/.test(sn), /localStorage|sessionStorage/.test(sn)]);
  c("sorgente: la consulenza solo nel vuoto (il pannello si apre dal bottone, `ClickConsulenza` come l'header); mai la barra della consulenza, il pop-up o il box della scheda", [true, false], [
    /emettiSoloContatore\("ClickConsulenza"/.test(sn), /BarraConsulenza|PopupUscita|BoxProdottoGiusto/.test(sn)]);
  c("sorgente: il «Ti serve anche» è una sola card (`TiServeAnche` con `correlato`, senza una card fatta a mano) e una riga aggiunta fa ripartire la rivalida", [1, false, true], [
    conta(sn, /<TiServeAnche\b/g), /cardDelCorrelato|cardDaCorrelato|CardProdotto/.test(sn), /lines\.length > nRighe\.current[^;]*controlla\(\)/.test(sn)]);
  c("sorgente: `cardDelCorrelato` non c'è più in `SezioniScheda2` (la card la fa `TiServeAnche`)", false, /cardDelCorrelato/.test(readFileSync(join(radice, "src/components/shop/scheda/SezioniScheda2.tsx"), "utf8")));
  c("sorgente: lo smistatore di `shop.carrello.tsx` (`cms` → `PaginaCarrello` con le voci di fiducia, altrimenti il carrello di oggi) e il `loader` con `codice` resta quello di oggi (`modalitaCatalogo`, `{ modo }`, `codice` se non risponde; T114: le fonti in più solo con `cms`)", [true, true, true], [
    /return modo === "cms" \? <PaginaCarrello voci=\{voci\} \/> : <CartPage \/>/.test(rotta), /const modo = await modalitaCatalogo\(\)\.catch\(\(\) => "codice" as const\);\s*if \(modo !== "cms"\) return \{ modo \};/.test(rotta), /tariffaSpedizione\(\)[^]*contenutoShop\(\)[^]*cassaPubblica\(\)/.test(rotta.slice(rotta.indexOf('if (modo !== "cms")')))]);
  c("con `codice` il carrello è quello di oggi e `PaginaCarrello` non si disegna (nessuna regione ambra, nessun `<dl>`)", [true, false, false], [
    (await rendi(radice, FILE, { loaderData: { modo: "codice" }, carrello: carrelloFinto([]), rivalida: rivalidaFinta() })).html.includes("Il carrello è vuoto"), /<dl\b/.test((await rendi(radice, FILE, { loaderData: { modo: "codice" }, carrello: carrelloFinto([]), rivalida: rivalidaFinta() })).html), /data-barra-nascondi/.test((await rendi(radice, FILE, { loaderData: { modo: "codice" }, carrello: carrelloFinto([]), rivalida: rivalidaFinta() })).html)]);

  // nessun testo scritto a mano nel componente (solo `testi-shop.ts`, o le frasi di R2 già esistenti): né testo in JSX né aria-label/title/alt
  const ts_ = requireQui("typescript");
  const sf = ts_.createSourceFile("PaginaCarrello.tsx", src, ts_.ScriptTarget.Latest, true, ts_.ScriptKind.TSX);
  const scritti = [];
  const visita = (n) => {
    if (n.kind === ts_.SyntaxKind.JsxText && /[A-Za-zÀ-ÿ]{2,}/.test(n.getText())) scritti.push(`testo «${n.getText().trim()}»`);
    if (n.kind === ts_.SyntaxKind.JsxAttribute && ["aria-label", "alt", "title", "placeholder"].includes(n.name.getText()) && n.initializer?.kind === ts_.SyntaxKind.StringLiteral && /[A-Za-zÀ-ÿ]{2,}/.test(n.initializer.text)) scritti.push(`${n.name.getText()}="${n.initializer.text}"`);
    ts_.forEachChild(n, visita);
  };
  visita(sf);
  c("sorgente: le righe di prima si dimenticano quando il carrello si svuota (se si toglie l'unica riga durante il controllo, nessun «non è più disponibile» falso)", true, /useEffect\(\(\) => \{\s*if \(lines\.length === 0\) \{\s*prima\.current = \[\];\s*return;\s*\}[^]*?avvisiRiga\(prima\.current, lines\)/.test(sn));
  c("sorgente: nessuna parola scritta a mano nel componente (né testo in JSX né aria-label/alt/title): tutto da `testi-shop.ts` e dalle frasi di R2", [], scritti);
  c("sorgente: nessun segnaposto né «da confermare» né `font-family` nel componente", [false, false], [/\{\{|da confermare/i.test(src), /font-family|Anton|Instrument/.test(src)]);
}
