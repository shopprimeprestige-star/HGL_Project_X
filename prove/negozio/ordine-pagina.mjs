/** ── NEGOZIO · R2 · T60 · LA PAGINA ORDINE (impianto minimo) ──────────────────────────────────────────────
 *  `src/routes/shop.ordine.$ref.tsx` + `src/shop/cassa/PaginaOrdine.tsx` (PIANO-R2 §3.3, D14, D48, D63, D64, D66; SPEC 7.4 n. 1, 3; 8A n. 5).
 *  Non c'è un DOM: il disegno si prova con `react-dom/server` sui componenti veri (impacchettati con esbuild, con dei finti al posto del router,
 *  del carrello, dei tracciamenti e della funzione del server); le regole che vivono nel tempo (ricontrollo ogni 5 s per al massimo 2 minuti,
 *  «Aggiorna» che legge una volta sola, «Riprova il pagamento») sono funzioni esportate dalla pagina e si provano con un orologio finto.
 *  Cosa deve valere:
 *   · la pagina non è fra le ammesse ai pixel e al banner; la rotta mette `no-store`, `no-referrer`, `noindex` sul documento HTML e `robots` noindex;
 *   · la chiave `t` non finisce in un log, in `localStorage`, nel titolo né nel disegno; nessun `console.*`; nessun `emettiEvento`, nessun `Purchase`;
 *   · `OrderPageView` solo come contatore, senza payload; nessuna casella (D64); nessun testo di assistenza scritto nel file (D63);
 *   · ricontrollo a 5000 ms, fermo a 120000 ms; «Aggiorna» = una lettura; mai «pagato» da solo; in `verifica` niente numero d'ordine;
 *   · «non trovato» uguale per ogni rifiuto, anche senza chiave; «Riprova il pagamento» come da D66.
 *  Dati inventati: nessuna chiave vera, nessun cliente vero. */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requireQui = createRequire(import.meta.url);
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const piatto = (h) => h.replace(/<[^>]+>/g, " ").replace(/\u00a0/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

const CHIAVE = "chiave-di-prova-0123456789-ABCDEFGHIJKLMNOP";
const REF = "HG-7K3M9Q";

/** I finti: solo ciò che la pagina importa dal resto del sito. */
const FINTI = {
  "@tanstack/react-router": `import React from "react"; export const Link = ({ to, children, className }) => React.createElement("a", { href: String(to), className }, children);`,
  "@/shop/CartContext": `export const useCart = () => ({ clear: () => {} });`,
  "@/lib/tracciamento/api": `export const emettiSoloContatore = () => {};`,
  "@/shop/cassa/ordine-pubblico.functions": `export const ordinePubblico = async () => ({ ok: false });`,
};

/** Impacchetta la pagina vera e restituisce le sue esportazioni più `React` e `rendi(elemento)`. */
async function caricaPagina(radice) {
  const esbuild = requireQui(join(radice, "node_modules/esbuild"));
  const dir = mkdtempSync(join(tmpdir(), "prova-ordine-"));
  const entrata = join(dir, "entrata.tsx");
  writeFileSync(
    entrata,
    `import React from "react";
     import { renderToStaticMarkup } from "react-dom/server";
     export * from ${JSON.stringify(join(radice, "src/shop/cassa/PaginaOrdine.tsx"))};
     export { React };
     export const rendi = (el) => renderToStaticMarkup(el);`,
  );
  const r = await esbuild.build({
    entryPoints: [entrata],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    loader: { ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl" },
    alias: { "@": join(radice, "src") },
    absWorkingDir: radice,
    nodePaths: [join(radice, "node_modules")],
    logLevel: "silent",
    plugins: [
      {
        name: "finti",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (FINTI[a.path] ? { path: a.path, namespace: "finto" } : null));
          b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI[a.path], loader: "tsx", resolveDir: radice }));
        },
      },
    ],
  });
  const file = join(dir, "pagina.cjs");
  writeFileSync(file, r.outputFiles[0].text);
  return requireQui(file);
}

/** Un ordine come lo restituisce `ordinePubblico` (T55). */
const ordine = (extra = {}) => ({
  ref: REF,
  creatoIl: "2026-11-20T10:00:00.000Z",
  fase: "pagato",
  frase: "Pagamento ricevuto.",
  tempo: { ricevuto: "2026-11-20T10:00:00.000Z", pagato: "2026-11-20T10:02:00.000Z", inPreparazione: null, spedito: null, consegnato: null },
  righe: [
    { nome: "Patch di prova", variante: "Colore 1B", qty: 2, totaleCent: 5780, foto: null },
    { nome: "Shampoo di prova", variante: null, qty: 1, totaleCent: 1590, foto: null },
  ],
  subtotaleCent: 7370,
  spedizioneCent: 490,
  totaleCent: 7860,
  rimborsatoCent: 0,
  cap: "00100",
  citta: "Roma",
  tracking: null,
  riprovabile: false,
  ...extra,
});
const TESTI_VUOTI = { reso: null, assistenza: null, assistenza_whatsapp: null, pronta_consegna: null, garanzia: null, firmatario: null };
const ASSISTENZA = "TESTO-ASSISTENZA-DI-PROVA scrivici e ti rispondiamo";
const statoOrdine = (o, extra = {}, testi = TESTI_VUOTI) => ({ tipo: "ordine", ordine: o, testi, finestraFinita: false, ...extra });
const FERMO = { tipo: "fermo" };

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · R2 · T60 · LA PAGINA ORDINE (21/11/2026)");
  const fRotta = join(radice, "src/routes/shop.ordine.$ref.tsx");
  const fPagina = join(radice, "src/shop/cassa/PaginaOrdine.tsx");
  c("la rotta shop.ordine.$ref.tsx esiste", true, existsSync(fRotta));
  c("PaginaOrdine.tsx esiste", true, existsSync(fPagina));
  if (!existsSync(fRotta) || !existsSync(fPagina)) return;
  const rotta = senzaCommenti(readFileSync(fRotta, "utf8"));
  const pagina = senzaCommenti(readFileSync(fPagina, "utf8"));
  const tutto = rotta + "\n" + pagina;

  // ── la rotta: intestazioni sul documento HTML e niente nel titolo ──
  c("rotta: il percorso è /shop/ordine/$ref", true, /createFileRoute\(\s*["']\/shop\/ordine\/\$ref["']\s*\)/.test(rotta));
  c("rotta: `headers` mette Cache-Control no-store, Referrer-Policy no-referrer e X-Robots-Tag noindex sull'HTML", [true, true, true, true], [
    /headers\s*:/.test(rotta),
    /["']Cache-Control["']\s*:\s*["'][^"']*no-store/.test(rotta),
    /["']Referrer-Policy["']\s*:\s*["']no-referrer["']/.test(rotta),
    /["']X-Robots-Tag["']\s*:\s*["'][^"']*noindex/.test(rotta),
  ]);
  c("rotta: `head` ha `robots` noindex", true, /name\s*:\s*["']robots["']\s*,\s*content\s*:\s*["'][^"']*noindex/.test(rotta));
  const head = rotta.slice(rotta.search(/head\s*:/));
  const titolo = head.match(/title\s*:\s*([^,}]+)/)?.[1] ?? "";
  c("rotta: il titolo è un testo fisso (niente chiave, niente numero d'ordine, niente parametri)", true, /^\s*["'`][^"'`$]*["'`]\s*$/.test(titolo));
  c("rotta: nessun `validateSearch` che fa passare la chiave dal router (si legge dall'indirizzo nel browser)", false, /validateSearch/.test(rotta));

  // ── la pagina non è fra le ammesse (prova di T27, ripetuta) ──
  const A = mod["lib/tracciamento/ammesse"];
  c("percorsoAmmesso('/shop/ordine/x', '?t=1') è falso e il banner non compare", [false, false, false], [
    A.percorsoAmmesso("/shop/ordine/x", "?t=1", false),
    A.percorsoAmmesso("/shop/ordine/x", "", false),
    A.bannerAmmesso("/shop/ordine/x", "?t=1", false, false),
  ]);

  // ── il sorgente della pagina ──
  c("nessun `console.*` (né nella pagina né nella rotta)", false, /\bconsole\s*\./.test(tutto));
  c("nessun `emettiEvento` (l'acquisto dal browser è del R3)", false, /emettiEvento/.test(tutto));
  c("nessun `Purchase`", false, /Purchase/.test(tutto));
  c("`emettiSoloContatore` è chiamato una volta sola, con `OrderPageView` e SENZA secondo argomento", [1, true], [
    (pagina.match(/emettiSoloContatore\s*\(/g) ?? []).length,
    /emettiSoloContatore\(\s*["']OrderPageView["']\s*\)/.test(pagina),
  ]);
  c("la chiave non va in `localStorage`, `sessionStorage`, `document.title`, cookie, `history`", false, /localStorage|sessionStorage|document\.title|document\.cookie|history\.(replace|push)State/.test(tutto));
  c("nessuna casella (`checkbox`) né `novità` (D64: la casella «novità e consigli» è fuori dal R2)", false, /checkbox|novit/i.test(tutto));
  c("il ricontrollo è a 5000 ms e si ferma a 120000 ms", [true, true], [/\b5000\b|\b5_000\b/.test(pagina), /\b120000\b|\b120_000\b/.test(pagina)]);
  c("nessun `setInterval`: il ricontrollo è un giro dopo l'altro", false, /setInterval/.test(pagina));
  c("nessun testo di assistenza scritto nel file: niente WhatsApp, telefono, email, orari; «Serve aiuto?» una volta sola, legato a `testi.assistenza`", [false, 1, true], [
    /whatsapp|[a-z0-9]@[a-z0-9]|\+39|\btel\b|\borari\b|lun(?:edì)?\s*-\s*ven/i.test(pagina),
    (pagina.match(/Serve aiuto\?/g) ?? []).length,
    /testi\??\.assistenza/.test(pagina),
  ]);
  c("la chiave non si legge dal router ma dall'indirizzo del browser (`location.search`), e non finisce in un `Link`", [true, false], [/location\.search/.test(pagina), /<Link[^>]*[?&]t=/.test(pagina)]);
  c("la riprova passa da `/api/public/shop-cassa` con `azione: \"riprova\"` e dal permesso (`shop-cassa-permesso`)", [true, true, true], [
    /\/api\/public\/shop-cassa["'`]/.test(pagina),
    /azione\s*:\s*["']riprova["']/.test(pagina),
    /\/api\/public\/shop-cassa-permesso/.test(pagina),
  ]);

  // ── il codice vero, impacchettato ──
  let P;
  try {
    P = await caricaPagina(radice);
  } catch (e) {
    c("PaginaOrdine.tsx si impacchetta", "ok", String(e.message).slice(0, 200));
    return;
  }
  const f = (n) => typeof P[n] === "function";
  c("PaginaOrdine.tsx esporta ciò che la rotta e le prove usano", true, ["PaginaOrdine", "VistaOrdine", "creaControllo", "leggiChiave", "svuotaCarrello", "riprovaOrdine"].every(f));
  c("le costanti del ricontrollo", [5000, 120000], [P.RITMO_MS, P.FINESTRA_MS]);
  if (!["VistaOrdine", "creaControllo", "leggiChiave", "svuotaCarrello", "riprovaOrdine"].every(f)) return;

  // ── la chiave si prende dall'indirizzo ──
  c("leggiChiave: `?t=abc` → abc; senza `t`, vuota o assente → null", ["abc", null, null, null, null], [P.leggiChiave("?t=abc"), P.leggiChiave(""), P.leggiChiave("?t="), P.leggiChiave("?x=1"), P.leggiChiave(undefined)]);
  c("leggiChiave: il valore resta TESTO (una chiave di sole cifre non diventa un numero) e si tiene com'è", ["0012345678", "a+b c"], [P.leggiChiave("?t=0012345678"), P.leggiChiave("?t=a%2Bb+c")]);

  // ── quando si svuota il carrello ──
  const svuota = Object.fromEntries(["verifica", "pagato", "in_preparazione", "spedito", "consegnato", "rimborsato", "annullato", "non_riuscito", "scaduto"].map((x) => [x, P.svuotaCarrello(x)]));
  c("il carrello si svuota solo dopo un pagamento arrivato (pagato…consegnato, rimborsato); mai in verifica, annullato, non riuscito, scaduto", { verifica: false, pagato: true, in_preparazione: true, spedito: true, consegnato: true, rimborsato: true, annullato: false, non_riuscito: false, scaduto: false }, svuota);

  // ═══ IL CONTROLLO NEL TEMPO ═════════════════════════════════════════════════════════════════════════
  /** Orologio finto: i giri si programmano con `programma`, e `avanza(ms)` fa scattare quelli dovuti, aspettando che ogni giro finisca. */
  const macchina = (risposte, { visibile = () => true } = {}) => {
    let ora = 1_000_000;
    let coda = [];
    let numero = 0;
    const m = { letture: [], stati: [], programmati: 0 };
    const prossima = () => {
      const r = Array.isArray(risposte) ? risposte[Math.min(m.letture.length - 1, risposte.length - 1)] : risposte;
      return typeof r === "function" ? r() : r;
    };
    const controllo = P.creaControllo({
      leggi: async () => {
        m.letture.push(ora - 1_000_000);
        const r = prossima();
        if (r instanceof Error) throw r;
        return r;
      },
      adesso: () => ora,
      programma: (fn, ms) => {
        m.programmati++;
        const id = ++numero;
        coda.push({ id, a: ora + ms, fn });
        return id;
      },
      annulla: (id) => {
        coda = coda.filter((x) => x.id !== id);
      },
      visibile,
      cambio: (s) => m.stati.push(s),
    });
    const libera = () => new Promise((r) => setImmediate(r));
    m.controllo = controllo;
    m.ultimo = () => m.stati[m.stati.length - 1];
    m.pendenti = () => coda.length;
    m.avanza = async (ms) => {
      const fine = ora + ms;
      for (;;) {
        coda.sort((a, b) => a.a - b.a);
        const prossimo = coda[0];
        if (!prossimo || prossimo.a > fine) break;
        coda.shift();
        ora = Math.max(ora, prossimo.a);
        prossimo.fn();
        await libera();
      }
      ora = fine;
      await libera();
    };
    m.libera = libera;
    return m;
  };
  const verifica = { ok: true, ordine: ordine({ ref: null, fase: "verifica", frase: "Stiamo verificando il pagamento.", tempo: { ricevuto: "2026-11-20T10:00:00.000Z", pagato: null, inPreparazione: null, spedito: null, consegnato: null } }), testi: TESTI_VUOTI };
  const pagato = { ok: true, ordine: ordine(), testi: TESTI_VUOTI };

  // in verifica: una lettura all'apertura, poi una ogni 5 s, al massimo 24; poi basta
  {
    const m = macchina(verifica);
    await m.controllo.avvia();
    c("apertura: UNA lettura subito, e il disegno passa da «carico» a «ordine in verifica»", [1, "ordine", "verifica"], [m.letture.length, m.ultimo()?.tipo, m.ultimo()?.ordine?.fase]);
    await m.avanza(4_999);
    c("a 4,999 s non c'è ancora un secondo giro", 1, m.letture.length);
    await m.avanza(1);
    c("a 5 s il secondo", 2, m.letture.length);
    await m.avanza(115_000);
    c("a 120 s le letture sono 25 (1 + 24 ricontrolli), mai più in fretta di 5 s l'una dall'altra", [25, true], [m.letture.length, m.letture.every((t, i) => i === 0 || t - m.letture[i - 1] >= 5000)]);
    c("a 120 s la finestra è finita: lo stato lo dice, e non c'è più nessun giro in programma", [true, 0], [m.ultimo()?.finestraFinita, m.pendenti()]);
    await m.avanza(600_000);
    c("dopo 120 s non si legge più (nemmeno dopo 10 minuti)", 25, m.letture.length);
  }
  {
    const m = macchina(verifica);
    await m.controllo.avvia();
    await m.avanza(119_999);
    c("a 119,999 s la finestra non è ancora finita", false, m.ultimo()?.finestraFinita);
    m.controllo.ferma();
  }
  // la prima risposta è già «pagato»: nessun ricontrollo
  {
    const m = macchina(pagato);
    await m.controllo.avvia();
    await m.avanza(60_000);
    c("fase già oltre la verifica alla prima lettura: una lettura sola, nessun ricontrollo", [1, "pagato", 0], [m.letture.length, m.ultimo()?.ordine?.fase, m.pendenti()]);
  }
  // da verifica a pagato: il ricontrollo si ferma
  {
    const m = macchina([verifica, verifica, pagato]);
    await m.controllo.avvia();
    await m.avanza(60_000);
    c("verifica, verifica, poi pagato: si ferma alla terza lettura e mostra «pagato»", [3, "pagato"], [m.letture.length, m.ultimo()?.ordine?.fase]);
  }
  // un rifiuto durante la finestra: si ritenta sul ritmo dei 5 s, senza dire «non trovato» prima del tempo
  {
    const m = macchina({ ok: false });
    await m.controllo.avvia();
    c("rifiuto alla prima lettura: ancora «carico» (si ritenta, non si dice «non trovato» subito)", "carico", m.ultimo()?.tipo);
    await m.avanza(10_000);
    c("…si ritenta ogni 5 s (3 letture a 10 s)", 3, m.letture.length);
    await m.avanza(110_000);
    c("…fino a 120 s, 25 letture in tutto, poi «non trovato»", [25, "assente"], [m.letture.length, m.ultimo()?.tipo]);
    await m.avanza(300_000);
    c("…e poi più niente", 25, m.letture.length);
  }
  // il rifiuto passa e arriva l'ordine (il database di un attimo)
  {
    const m = macchina([{ ok: false }, { ok: false }, pagato]);
    await m.controllo.avvia();
    await m.avanza(30_000);
    c("rifiuto, rifiuto, poi l'ordine: mostra l'ordine e si ferma", [3, "pagato"], [m.letture.length, m.ultimo()?.ordine?.fase]);
  }
  // la lettura che lancia = un rifiuto
  {
    const m = macchina([new Error("rete caduta"), pagato]);
    await m.controllo.avvia();
    c("una lettura che lancia non rompe la pagina: resta «carico»", "carico", m.ultimo()?.tipo);
    await m.avanza(5_000);
    c("…e il giro dopo trova l'ordine", "pagato", m.ultimo()?.ordine?.fase);
  }
  // scheda nascosta: si salta il giro, ma il tempo passa
  {
    let visibile = false;
    const m = macchina(verifica, { visibile: () => visibile });
    await m.controllo.avvia();
    await m.avanza(30_000);
    c("scheda nascosta: nessun giro di lettura (resta la prima)", 1, m.letture.length);
    visibile = true;
    await m.avanza(5_000);
    c("scheda di nuovo visibile: il giro successivo legge, sul ritmo di sempre", 2, m.letture.length);
    visibile = false;
    await m.avanza(300_000);
    c("tutta la finestra passata con la scheda nascosta: la finestra finisce lo stesso (compare «Aggiorna»)", [2, true], [m.letture.length, m.ultimo()?.finestraFinita]);
  }
  // «Aggiorna» = una lettura sola, il ciclo non riparte
  {
    const m = macchina([verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, verifica, pagato]);
    await m.controllo.avvia();
    await m.avanza(120_000);
    const prima = m.letture.length;
    await m.controllo.aggiorna();
    c("«Aggiorna» dopo la finestra: UNA lettura, e nessun giro programmato", [prima + 1, 0], [m.letture.length, m.pendenti()]);
    c("…e se l'ordine nel frattempo è pagato lo mostra", "pagato", m.ultimo()?.ordine?.fase);
    await m.avanza(300_000);
    c("…e poi non si legge più", prima + 1, m.letture.length);
  }
  // «Aggiorna» e un rifiuto (per esempio il limite): la pagina già vista non diventa «non trovato», e nessuna parola sul limite
  {
    const m = macchina([...Array(25).fill(verifica), { ok: false }]);
    await m.controllo.avvia();
    await m.avanza(120_000);
    await m.controllo.aggiorna();
    c("«Aggiorna» che riceve un rifiuto: resta l'ultimo ordine visto (mai «non trovato» su una pagina già valida)", ["ordine", "verifica"], [m.ultimo()?.tipo, m.ultimo()?.ordine?.fase]);
  }
  // «Aggiorna» senza nessuna risposta valida prima: il rifiuto è «non trovato»
  {
    const m = macchina({ ok: false });
    await m.controllo.avvia();
    await m.avanza(120_000);
    await m.controllo.aggiorna();
    c("«Aggiorna» dopo una finestra tutta di rifiuti: «non trovato»", "assente", m.ultimo()?.tipo);
  }
  // due «Aggiorna» insieme: una lettura sola
  {
    const m = macchina(verifica);
    await m.controllo.avvia();
    await m.avanza(120_000);
    const prima = m.letture.length;
    await Promise.all([m.controllo.aggiorna(), m.controllo.aggiorna()]);
    c("due «Aggiorna» insieme: una lettura sola", prima + 1, m.letture.length);
  }
  // ferma(): nessuna risposta tardiva cambia il disegno, nessun giro
  {
    const m = macchina(verifica);
    await m.controllo.avvia();
    m.controllo.ferma();
    const n = m.stati.length;
    await m.avanza(300_000);
    c("dopo `ferma()` (la pagina è stata lasciata) non si legge e non si cambia niente", [1, n], [m.letture.length, m.stati.length]);
  }

  // ═══ IL DISEGNO ════════════════════════════════════════════════════════════════════════════════════
  const h = P.React.createElement;
  const disegna = (stato, extra = {}) => P.rendi(h(P.VistaOrdine, { stato, riprova: FERMO, suRiprova: () => {}, suAggiorna: () => {}, inLettura: false, ...extra }));
  const NON_TROVATO = piatto(disegna({ tipo: "assente" }));

  const carico = disegna({ tipo: "carico" });
  c("carico: un riquadro `role=status`, senza «pagato», senza numero d'ordine, senza «aiuto»", [true, false, false, false], [/role="status"/.test(carico), /pagat|pagamento ricevuto/i.test(piatto(carico)), new RegExp(REF).test(carico), /aiuto/i.test(carico)]);

  const v = disegna(statoOrdine(verifica.ordine));
  c("verifica: la frase del server come titolo, `role=status`, il numero d'ordine NON c'è", [true, true, false], [piatto(v).includes("Stiamo verificando il pagamento."), /role="status"/.test(v), new RegExp(REF).test(v)]);
  c("verifica: mai «pagato» né «Pagamento ricevuto» da solo, né righe, né totali", false, /pagato|pagamento ricevuto|Patch di prova|7[.,]860|78,60/i.test(piatto(v)));
  c("verifica: nessun «Aggiorna», nessun «Serve aiuto?» (anche se il testo di assistenza è confermato) prima dei 2 minuti", [false, false], [
    /Aggiorna/.test(v),
    /Serve aiuto\?/.test(disegna(statoOrdine(verifica.ordine, {}, { ...TESTI_VUOTI, assistenza: ASSISTENZA }))),
  ]);
  const vFine = disegna(statoOrdine(verifica.ordine, { finestraFinita: true }));
  c("verifica dopo 2 minuti SENZA testo confermato: «Aggiorna» sì, nessuna riga d'assistenza e nessuna frase inventata", [true, false], [/Aggiorna/.test(vFine), /aiuto|assistenza|scriv|contatt/i.test(piatto(vFine))]);
  const vFineConTesto = piatto(disegna(statoOrdine(verifica.ordine, { finestraFinita: true }, { ...TESTI_VUOTI, assistenza: ASSISTENZA })));
  c("verifica dopo 2 minuti CON il testo `assistenza` confermato: «Serve aiuto?» e il testo del titolare, tale e quale", [true, true], [vFineConTesto.includes("Serve aiuto?"), vFineConTesto.includes(ASSISTENZA)]);
  c("verifica: nessuna casella, nessun bottone di pagamento", false, /type="checkbox"|Riprova il pagamento/.test(v + vFine));

  const p = piatto(disegna(statoOrdine(pagato.ordine)));
  c("pagato: titolo = la frase del server, numero d'ordine, righe con variante e quantità", [true, true, true, true, true], [p.includes("Pagamento ricevuto."), p.includes(REF), p.includes("Patch di prova"), p.includes("Colore 1B"), /Qtà\s*2|2\s*×|× 2/.test(p)]);
  c("pagato: subtotale, spedizione e totale in euro (dai centesimi)", [true, true, true], [/73,70\s*€/.test(p), /4,90\s*€/.test(p), /78,60\s*€/.test(p)]);
  c("pagato: «Spedizione a: CAP e città», e nient'altro dell'indirizzo", [true, false], [/00100\s+Roma/.test(p), /Via |telefono|@/i.test(p)]);
  c("pagato: nessuna casella, nessun «Riprova», nessun «Aggiorna», nessun «aiuto» senza testo confermato", false, /type="checkbox"|Riprova|Aggiorna|aiuto/i.test(disegna(statoOrdine(pagato.ordine))));
  c("pagato con testo confermato: «Serve aiuto?» e il testo", true, (() => { const x = piatto(disegna(statoOrdine(pagato.ordine, {}, { ...TESTI_VUOTI, assistenza: ASSISTENZA }))); return x.includes("Serve aiuto?") && x.includes(ASSISTENZA); })());
  c("pagato con testo `assistenza` vuoto ma `reso` pieno: nessun «Serve aiuto?» (si usa solo `assistenza`)", false, /Serve aiuto\?|TESTO-RESO/.test(disegna(statoOrdine(pagato.ordine, {}, { ...TESTI_VUOTI, reso: "TESTO-RESO" }))));

  const tl = disegna(statoOrdine(ordine({ fase: "spedito", frase: "Il tuo ordine è stato spedito.", tempo: { ricevuto: "2026-11-20T10:00:00.000Z", pagato: "2026-11-20T10:02:00.000Z", inPreparazione: "2026-11-21T08:00:00.000Z", spedito: "2026-11-21T15:00:00.000Z", consegnato: null }, tracking: { corriere: "BRT", numero: "TRK123456", url: "https://tracking.esempio.test/TRK123456" } })));
  const tlp = piatto(tl);
  c("spedito: le cinque tappe in ordine, la tappa corrente è marcata `aria-current`", [true, true], [
    ["Ordine ricevuto", "Pagamento ricevuto", "In preparazione", "Spedito", "Consegnato"].map((x) => tlp.indexOf(x)).every((n, i, a) => n >= 0 && (i === 0 || n > a[i - 1])),
    (tl.match(/aria-current="step"/g) ?? []).length === 1,
  ]);
  c("spedito: corriere, numero di tracking e collegamento «https» che si apre fuori, senza referrer", [true, true, true, true], [
    tlp.includes("BRT"), tlp.includes("TRK123456"),
    /<a [^>]*href="https:\/\/tracking\.esempio\.test\/TRK123456"/.test(tl),
    /<a [^>]*href="https:\/\/tracking[^>]*rel="[^"]*noopener[^"]*noreferrer|<a [^>]*rel="[^"]*noopener[^"]*noreferrer[^"]*"[^>]*href="https:\/\/tracking/.test(tl),
  ]);
  const senzaUrl = piatto(disegna(statoOrdine(ordine({ fase: "spedito", tracking: { corriere: "BRT", numero: "TRK123456", url: null } }))));
  c("spedito senza link: il numero c'è, il collegamento no", [true, false], [senzaUrl.includes("TRK123456"), /Segui il pacco/.test(senzaUrl)]);

  const an = disegna(statoOrdine(ordine({ fase: "annullato", frase: "L'ordine è stato annullato." })));
  const rimb = disegna(statoOrdine(ordine({ fase: "rimborsato", frase: "L'ordine è stato rimborsato.", rimborsatoCent: 7860 })));
  c("annullato e rimborsato: una scheda con la frase, senza la linea del tempo; il rimborsato dice quanto", [true, false, false, true], [piatto(an).includes("L'ordine è stato annullato."), /<ol/.test(an), /<ol/.test(rimb), /78,60\s*€/.test(piatto(rimb))]);

  const nr = ordine({ fase: "non_riuscito", frase: "Il pagamento non è andato a buon fine.", riprovabile: true });
  const nrH = disegna(statoOrdine(nr));
  c("non riuscito riprovabile: la frase, il numero, il riepilogo e il bottone «Riprova il pagamento»", [true, true, true, true], [piatto(nrH).includes("Il pagamento non è andato a buon fine."), piatto(nrH).includes(REF), piatto(nrH).includes("Patch di prova"), /<button[^>]*>[^<]*(<[^>]+>)*[^<]*Riprova il pagamento/.test(nrH)]);
  c("non riuscito NON riprovabile (annullato in mezzo): niente bottone", false, /Riprova il pagamento/.test(disegna(statoOrdine({ ...nr, riprovabile: false }))));
  c("scaduto riprovabile: lo stesso bottone", true, /Riprova il pagamento/.test(disegna(statoOrdine({ ...nr, fase: "scaduto" }))));
  const inCorso = disegna(statoOrdine(nr), { riprova: { tipo: "in_corso" } });
  c("riprova in corso: il bottone è spento e `aria-busy`", [true, true], [/<button[^>]*disabled/.test(inCorso), /aria-busy="true"/.test(inCorso)]);
  const prezzi = disegna(statoOrdine(nr), { riprova: { tipo: "prezzi", frase: "I prezzi sono cambiati: controlla il nuovo totale e conferma di nuovo." } });
  c("riprova: «prezzi cambiati» = la frase del server in un `role=alert` e un rinvio alla cassa", [true, true], [/role="alert"[^>]*>[^<]*I prezzi sono cambiati/.test(prezzi), /<a [^>]*href="\/shop\/checkout"/.test(prezzi)]);
  const err = disegna(statoOrdine(nr), { riprova: { tipo: "errore", frase: "Non siamo riusciti ad aprire il pagamento: riprova tra poco." } });
  c("riprova: un errore è una frase in un `role=alert` e il bottone resta (si può riprovare)", [true, true], [/role="alert"[^>]*>[^<]*Non siamo riusciti/.test(err), /Riprova il pagamento/.test(err)]);

  // «non trovato»: UNO per ogni rifiuto, senza chiave, senza dati dell'ordine
  c("non trovato: una pagina con il suo titolo e un rinvio allo shop, senza dati", [true, true, false], [/non trovato/i.test(NON_TROVATO), /href="\/shop"/.test(disegna({ tipo: "assente" })), /Patch|€|HG-/.test(NON_TROVATO)]);
  c("non trovato: lo stato è UNO (`{tipo:'assente'}`), quindi il disegno è lo stesso per chiave sbagliata, ref inesistente, limite e senza chiave", true, (() => {
    const a = disegna({ tipo: "assente" });
    return [1, 2, 3].every(() => disegna({ tipo: "assente" }) === a);
  })());

  // la chiave non è mai nel disegno
  const tuttiGliStati = [{ tipo: "carico" }, { tipo: "assente" }, statoOrdine(verifica.ordine), statoOrdine(verifica.ordine, { finestraFinita: true }), statoOrdine(pagato.ordine), statoOrdine(nr), statoOrdine(ordine({ fase: "spedito", tracking: { corriere: "BRT", numero: "T1", url: "https://t.esempio.test/T1" } }))];
  c("nessun disegno contiene la chiave", false, tuttiGliStati.some((s) => disegna(s).includes(CHIAVE)));

  // ═══ «RIPROVA IL PAGAMENTO» (D66) ═══════════════════════════════════════════════════════════════════
  const riprova = async ({ risposte, permessi = [{ valore: "permesso-1", presoA: 1_000_000 }], adesso = 1_000_500, ref = REF, t = CHIAVE }) => {
    const r = { corpi: [], attese: [], vai: [], permessi: 0, rinnovi: [] };
    let n = 0;
    const esito = await P.riprovaOrdine({
      ref,
      t,
      permesso: async (rinnova) => {
        r.permessi++;
        r.rinnovi.push(!!rinnova);
        return permessi[Math.min(r.permessi - 1, permessi.length - 1)];
      },
      invia: async (corpo) => {
        r.corpi.push(corpo);
        const x = risposte[Math.min(n++, risposte.length - 1)];
        if (x instanceof Error) throw x;
        return x;
      },
      adesso: () => adesso + r.attese.reduce((a, b) => a + b, 0),
      attendi: async (ms) => void r.attese.push(ms),
      vai: (u) => r.vai.push(u),
    });
    return { esito, ...r };
  };
  const URL_STRIPE = "https://checkout.stripe.com/c/pay/cs_test_prova#frammento";
  {
    const x = await riprova({ risposte: [{ stato: 200, corpo: { ok: true, url: URL_STRIPE } }] });
    c("riprova riuscita: manda `{azione:'riprova', ref, t, permesso}` e NIENT'ALTRO (nessun prezzo, nessun dato)", [{ azione: "riprova", ref: REF, t: CHIAVE, permesso: "permesso-1" }], x.corpi);
    c("riprova riuscita: porta il cliente all'indirizzo di Stripe (https)", [URL_STRIPE, "vai"], [x.vai[0], x.esito.tipo]);
  }
  {
    const x = await riprova({ risposte: [{ stato: 200, corpo: { ok: true, url: URL_STRIPE } }], adesso: 1_000_500 });
    c("il permesso deve avere almeno 3 secondi: si aspetta il resto prima di inviare (permesso preso 0,5 s fa → attesa ≥ 2,5 s)", true, x.attese.length >= 1 && x.attese[0] >= 2_500 && x.attese[0] <= 3_700);
    const y = await riprova({ risposte: [{ stato: 200, corpo: { ok: true, url: URL_STRIPE } }], adesso: 1_010_000 });
    c("…con un permesso già vecchio di 10 s non si aspetta niente", 0, y.attese.length);
  }
  {
    const x = await riprova({ risposte: [{ stato: 200, corpo: { ok: true, url: "http://checkout.stripe.test/x" } }] });
    const y = await riprova({ risposte: [{ stato: 200, corpo: { ok: true, url: "javascript:alert(1)" } }] });
    const z = await riprova({ risposte: [{ stato: 200, corpo: { ok: true } }] });
    c("un indirizzo che non è https (http, javascript:, assente) NON si apre: errore, nessun rinvio", [[], [], [], "errore", "errore", "errore"], [x.vai, y.vai, z.vai, x.esito.tipo, y.esito.tipo, z.esito.tipo]);
  }
  {
    const x = await riprova({ risposte: [{ stato: 409, corpo: { ok: false, motivo: "riprova_in_corso", frase: "Stiamo preparando un nuovo pagamento: attendi un istante." } }, { stato: 409, corpo: { ok: false, motivo: "riprova_in_corso" } }, { stato: 200, corpo: { ok: true, url: URL_STRIPE } }] });
    c("`riprova_in_corso`: ritenta dopo 2 s (due volte qui) e poi rinvia a Stripe", [2, true, 3, "vai"], [x.attese.filter((a) => a === 2_000).length, x.attese.every((a) => a <= 3_700), x.corpi.length, x.esito.tipo]);
    const y = await riprova({ risposte: [{ stato: 409, corpo: { ok: false, motivo: "riprova_in_corso", frase: "Stiamo preparando un nuovo pagamento: attendi un istante." } }] });
    c("`riprova_in_corso` che non passa mai: dopo qualche giro si ferma con la frase del server, senza girare all'infinito", [true, "errore", true], [y.corpi.length >= 3 && y.corpi.length <= 8, y.esito.tipo, /attendi un istante/.test(y.esito.frase ?? "")]);
  }
  {
    const x = await riprova({ risposte: [{ stato: 409, corpo: { ok: false, motivo: "prezzi_cambiati", frase: "I prezzi sono cambiati: controlla il nuovo totale e conferma di nuovo.", totaleCent: 8000, spedizioneCent: 490 } }] });
    c("`prezzi_cambiati`: esito «prezzi» con la frase del server; nessun secondo invio, nessun rinvio a Stripe", ["prezzi", 1, 0, "I prezzi sono cambiati: controlla il nuovo totale e conferma di nuovo."], [x.esito.tipo, x.corpi.length, x.vai.length, x.esito.frase]);
    const y = await riprova({ risposte: [{ stato: 409, corpo: { ok: false, motivo: "gia_pagato", frase: "x" } }] });
    c("`gia_pagato`: esito «pagato» (la pagina rilegge l'ordine), nessun rinvio a Stripe, nessun secondo invio", ["pagato", 1, 0], [y.esito.tipo, y.corpi.length, y.vai.length]);
  }
  {
    const caso = async (stato, corpo) => (await riprova({ risposte: [{ stato, corpo }] })).esito;
    const e1 = await caso(409, { ok: false, motivo: "non_riproponibile", frase: "Questo pagamento non si può riprendere: ricomincia dal carrello." });
    const e2 = await caso(429, { ok: false, motivo: "troppe_richieste", frase: "Troppi tentativi in poco tempo: riprova più tardi." });
    const e3 = await caso(503, { ok: false, motivo: "cassa_chiusa", frase: "Il negozio sta per aprire: riprova tra poco." });
    const e4 = await caso(404, { ok: false });
    const e5 = await caso(500, "html di un errore");
    c("gli altri rifiuti: esito «errore» con la frase del server (tagliata), mai il testo grezzo", ["errore", "Questo pagamento non si può riprendere: ricomincia dal carrello.", "Troppi tentativi in poco tempo: riprova più tardi.", "Il negozio sta per aprire: riprova tra poco."], [e1.tipo, e1.frase, e2.frase, e3.frase]);
    c("un rifiuto senza frase (404 uguale per tutti) o un corpo che non è un oggetto: errore con una frase nostra, breve", [true, true, true], [e4.tipo === "errore" && typeof e4.frase === "string" && e4.frase.length > 0 && e4.frase.length < 120, e5.tipo === "errore" && !/html/.test(e5.frase), true]);
    const lunga = await caso(500, { ok: false, motivo: "guasto", frase: "x".repeat(2000) });
    c("la frase del server si taglia (300 segni al massimo)", true, lunga.frase.length <= 300);
  }
  {
    const x = await riprova({ risposte: [new Error("rete caduta")] });
    c("la rete cade: esito «errore», nessun rinvio, nessuna eccezione", ["errore", 0], [x.esito.tipo, x.vai.length]);
    const y = await riprova({ risposte: [{ stato: 200, corpo: { ok: true, url: URL_STRIPE } }], permessi: [null] });
    c("senza permesso (la rotta non risponde): «errore», nessun invio", ["errore", 0], [y.esito.tipo, y.corpi.length]);
    const z = await riprova({ risposte: [{ stato: 403, corpo: { ok: false, motivo: "permesso", frase: "Ricarica la pagina e riprova." } }, { stato: 200, corpo: { ok: true, url: URL_STRIPE } }], permessi: [{ valore: "p1", presoA: 1_000_000 }, { valore: "p2", presoA: 1_000_000 }] });
    c("permesso rifiutato (403): se ne chiede uno nuovo UNA volta e si ritenta", [2, [false, true], "vai"], [z.corpi.length, z.rinnovi, z.esito.tipo]);
    const w = await riprova({ risposte: [{ stato: 403, corpo: { ok: false, motivo: "permesso", frase: "Ricarica la pagina e riprova." } }] });
    c("permesso rifiutato anche la seconda volta: errore con la frase del server, non si insiste", ["errore", 2], [w.esito.tipo, w.corpi.length]);
  }
}
