/** ── VETRINA V1 · T89 · LE RIGHE DEL CARRELLO, LA QUANTITÀ, IL RIEPILOGO ────────────────────────────────────
 *  `RigaCarrelloShop`, `StepperQuantita`, `RiepilogoOrdine` (+ `AvvisoCarrello`), disegnati con i dati inventati di `_dati-vetrina.mjs`.
 *  Due modi di guardarli, nessun browser:
 *   (1) `rendiComponente` (`_rende.mjs`): il MARCHIO reso (44 px, 16 px, prezzi «…» e «—», ordine Prodotti → Spedizione → Totale…);
 *   (2) un «banco» per gli stati: i componenti sono impacchettati con un `useState` di prova che tiene i valori fra un disegno e l'altro,
 *       così si scrive nel campo, si preme, si richiama il componente e si LEGGE come è cambiato (`react-dom/server` non lo farebbe).
 *  Quello che resta solo da browser (fuoco, tastiera vera, lettore di schermo, 390 px) è di T103c e T106.
 *  I componenti NON sono montati in nessuna rotta (li monta T98): qui si provano da soli. Nessuna rete, nessun carrello vero. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CARRELLO_NUOVO, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

/** Una cifra come la scrive il disegno vero (senza `Intl`: lo spazio fisso dell'euro non conta qui). */
const formatta = (cent) => `${(cent / 100).toFixed(2).replace(".", ",")} €`;
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;
const copia = (x) => structuredClone(x);

/* ── il banco: i componenti con un `useState` che ricorda ─────────────────────────────────────────────────── */

/** Impacchetta i tre componenti. `react` DENTRO `src/` è un finto (stesso `useState` nella forma, ma con caselle tenute fuori dal disegno);
 *  tutto il resto (lucide, il router, il `jsx` di React) è quello vero. */
async function caricaBanco(radice) {
  const richiedi = createRequire(join(radice, "package.json"));
  const esbuild = richiedi("esbuild");
  const reale = richiedi.resolve("react");
  const dir = mkdtempSync(join(tmpdir(), "prova-t89-"));
  try {
    const entrata = join(dir, "entrata.tsx");
    const componenti = join(radice, "src/components/shop/carrello");
    writeFileSync(
      entrata,
      `export * from ${JSON.stringify(join(componenti, "StepperQuantita.tsx"))};
       export * from ${JSON.stringify(join(componenti, "RigaCarrelloShop.tsx"))};
       export * from ${JSON.stringify(join(componenti, "RiepilogoOrdine.tsx"))};
       export { renderToStaticMarkup } from "react-dom/server";
       /** Un componente con le sue caselle: \`rendi(props)\` lo richiama (le caselle restano), \`rendi()\` riusa le ultime props. */
       export function monta(Componente, props) {
         const banco = { caselle: [], i: 0 };
         let ultime = props;
         return { rendi(nuove) { if (nuove) ultime = nuove; globalThis.__banco = banco; banco.i = 0; return Componente(ultime); }, caselle: banco.caselle };
       }`,
    );
    const finto = `
      export * from ${JSON.stringify(reale)};
      export const useState = (iniziale) => {
        const b = globalThis.__banco;
        const k = b.i++;
        if (!(k in b.caselle)) b.caselle[k] = typeof iniziale === "function" ? iniziale() : iniziale;
        return [b.caselle[k], (v) => { b.caselle[k] = typeof v === "function" ? v(b.caselle[k]) : v; }];
      };`;
    const r = await esbuild.build({
      entryPoints: [entrata],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      loader: { ".tsx": "tsx" },
      alias: { "@": join(radice, "src") },
      absWorkingDir: radice,
      nodePaths: [join(radice, "node_modules")],
      logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ DEV: false, PROD: true, SSR: true }) },
      plugins: [
        {
          name: "react-finto",
          setup(b) {
            b.onResolve({ filter: /^react$/ }, (a) => (a.importer.startsWith(join(radice, "src")) ? { path: "react", namespace: "react-finto" } : null));
            b.onLoad({ filter: /.*/, namespace: "react-finto" }, () => ({ contents: finto, loader: "js", resolveDir: radice }));
          },
        },
      ],
    });
    const file = join(dir, "banco.cjs");
    writeFileSync(file, r.outputFiles[0].text);
    return richiedi(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ── come si legge un albero di elementi (quello che il componente RESTITUISCE, prima del disegno) ─────────── */

const figli = (e) => [e?.props?.children ?? []].flat(Infinity);
const testoDi = (e) => (e == null || typeof e === "boolean" ? "" : typeof e === "object" ? figli(e).map(testoDi).join("") : String(e));
function tutti(e, ok, fuori = []) {
  if (e && typeof e === "object") {
    if (ok(e)) fuori.push(e);
    for (const f of figli(e)) tutti(f, ok, fuori);
  }
  return fuori;
}
const bottone = (albero, testo) => tutti(albero, (e) => e.type === "button" && testoDi(e).includes(testo))[0];
const campo = (albero) => tutti(albero, (e) => e.type === "input")[0];
const regione = (albero) => tutti(albero, (e) => e.props?.role === "status")[0];

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T89 · RIGHE DEL CARRELLO, QUANTITÀ, RIEPILOGO (23/11/2026)");
  const V = mod["shop/cms/vetrina-carrello"];
  const dir = join(radice, "src/components/shop/carrello");
  const file = (n) => join(dir, n);
  const sorgenti = Object.fromEntries(["StepperQuantita", "RigaCarrelloShop", "RiepilogoOrdine"].map((n) => [n, readFileSync(file(`${n}.tsx`), "utf8")]));
  const banco = await caricaBanco(radice);
  const { StepperQuantita, quantitaDaTesto, QUANTITA_MIN, QUANTITA_MAX, RiepilogoOrdine, monta } = banco;

  // ════ LA QUANTITÀ: LA PARTE PURA ═════════════════════════════════════════════════════════════════════════
  c("limiti: da 1 a 99 (come `setQty` del carrello di oggi, che non va oltre 99)", [1, 99], [QUANTITA_MIN, QUANTITA_MAX]);
  c("testo → quantità: «7» → 7", 7, quantitaDaTesto("7", 2, 1, 99));
  c("testo → quantità: «0» sale al minimo (togliere si fa con «Togli»)", 1, quantitaDaTesto("0", 2, 1, 99));
  c("testo → quantità: «150» scende al massimo", 99, quantitaDaTesto("150", 2, 1, 99));
  c("testo → quantità: vuoto o senza cifre = la quantità di prima", [2, 2, 2], [quantitaDaTesto("", 2, 1, 99), quantitaDaTesto("abc", 2, 1, 99), quantitaDaTesto("-", 2, 1, 99)]);
  c("testo → quantità: «07» e « 12 » si leggono come numeri", [7, 12], [quantitaDaTesto("07", 2, 1, 99), quantitaDaTesto(" 12 ", 2, 1, 99)]);

  // ════ LA QUANTITÀ: GLI STATI (il banco) ══════════════════════════════════════════════════════════════════
  const cambi = [];
  const props = (extra = {}) => ({ qty: 2, nome: "Patch Alfa", onCambia: (n) => cambi.push(n), ...extra });
  const nuovo = (extra) => { cambi.length = 0; return monta(StepperQuantita, props(extra)); };

  let s = nuovo();
  bottone(s.rendi(), "Aumenta").props.onClick();
  c("«+» chiede la quantità successiva (2 → 3)", [3], cambi);
  s = nuovo();
  bottone(s.rendi(), "Diminuisci").props.onClick();
  c("«−» chiede la quantità precedente (2 → 1)", [1], cambi);

  s = nuovo({ qty: 99 });
  c("al massimo (99) «+» è spento", true, bottone(s.rendi(), "Aumenta").props.disabled === true);
  bottone(s.rendi(), "Aumenta").props.onClick();
  c("…e anche se il clic arrivasse lo stesso non chiede niente (limite nel gestore, non solo nell'attributo)", [], cambi);
  c("al massimo «−» resta acceso", true, bottone(s.rendi(), "Diminuisci").props.disabled !== true);

  s = nuovo({ qty: 1 });
  c("al minimo (1) «−» è spento: togliere si fa con «Togli», non scendendo a zero", true, bottone(s.rendi(), "Diminuisci").props.disabled === true);
  bottone(s.rendi(), "Diminuisci").props.onClick();
  c("…e il clic che arrivasse lo stesso non chiede niente", [], cambi);
  c("al minimo «+» resta acceso", true, bottone(s.rendi(), "Aumenta").props.disabled !== true);

  // scrivere nel campo: la bozza cambia lo stato, il numero vero parte solo alla conferma
  s = nuovo();
  c("a riposo il campo mostra la quantità vera", "2", campo(s.rendi()).props.value);
  campo(s.rendi()).props.onChange({ target: { value: "7" } });
  c("scrivere «7»: il campo mostra «7» (lo stato è cambiato davvero)", "7", campo(s.rendi()).props.value);
  c("…ma finché non si conferma nessuna quantità parte", [], cambi);
  campo(s.rendi()).props.onChange({ target: { value: "a7b" } });
  c("le lettere non entrano nel campo", "7", campo(s.rendi()).props.value);
  campo(s.rendi()).props.onChange({ target: { value: "1234" } });
  c("più cifre del massimo (99 = 2 cifre) non entrano", "12", campo(s.rendi()).props.value);
  campo(s.rendi()).props.onChange({ target: { value: "7" } });
  campo(s.rendi()).props.onBlur();
  c("uscendo dal campo la quantità scritta parte (7)", [7], cambi);
  c("…e la bozza si chiude: il campo torna a mostrare la quantità vera del carrello", "2", campo(s.rendi()).props.value);
  c("…col carrello aggiornato mostra 7", "7", campo(s.rendi({ ...props(), qty: 7 })).props.value);

  s = nuovo();
  campo(s.rendi()).props.onChange({ target: { value: "9" } });
  const invio = { key: "Enter", prevented: false, preventDefault() { this.prevented = true; } };
  campo(s.rendi()).props.onKeyDown(invio);
  c("Invio conferma (9) e non invia nessun modulo", [[9], true], [cambi, invio.prevented]);
  c("…e chiude la bozza", "2", campo(s.rendi()).props.value);

  s = nuovo();
  campo(s.rendi()).props.onChange({ target: { value: "9" } });
  campo(s.rendi()).props.onKeyDown({ key: "Escape", preventDefault() {} });
  c("Esc butta la bozza: il campo torna alla quantità vera e niente parte", ["2", []], [campo(s.rendi()).props.value, cambi]);
  campo(s.rendi()).props.onBlur();
  c("…e l'uscita dal campo dopo Esc non conferma più niente", [], cambi);

  s = nuovo();
  campo(s.rendi()).props.onChange({ target: { value: "" } });
  c("campo svuotato per riscrivere: resta vuoto mentre si scrive", "", campo(s.rendi()).props.value);
  campo(s.rendi()).props.onBlur();
  c("uscendo dal campo vuoto non parte niente e torna la quantità di prima", [[], "2"], [cambi, campo(s.rendi()).props.value]);

  s = nuovo();
  campo(s.rendi()).props.onChange({ target: { value: "0" } });
  campo(s.rendi()).props.onBlur();
  c("scrivere «0» porta al minimo (1), non toglie la riga", [1], cambi);
  s = nuovo({ qty: 5 });
  campo(s.rendi()).props.onChange({ target: { value: "5" } });
  campo(s.rendi()).props.onBlur();
  c("riscrivere la stessa quantità non chiede niente", [], cambi);

  s = nuovo({ min: 2, max: 6, qty: 3 });
  campo(s.rendi()).props.onChange({ target: { value: "9" } });
  campo(s.rendi()).props.onBlur();
  c("min e max sono proprietà: con max 6 il «9» scritto diventa 6", [6], cambi);
  s = nuovo({ min: 2, max: 6, qty: 2 });
  c("…e con min 2 e quantità 2 «−» è spento", true, bottone(s.rendi(), "Diminuisci").props.disabled === true);

  // l'annuncio per chi non vede: una regione che c'è sempre e dice la quantità
  s = nuovo({ qty: 2 });
  const prima = regione(s.rendi());
  c("la regione «status» c'è già al primo disegno (una regione nuova non verrebbe letta) e dice nome e quantità", [true, "Patch Alfa: quantità 2"], [prima?.props["aria-live"] !== "off", testoDi(prima)]);
  c("quando la quantità cambia lo stesso nodo dice la nuova (5)", "Patch Alfa: quantità 5", testoDi(regione(s.rendi({ ...props(), qty: 5 }))));
  c("l'annuncio non toglie il testo dal campo e dai bottoni (nome per i lettori di schermo)", [true, true], [/Aumenta la quantità/.test(testoDi(bottone(s.rendi(), "Aumenta"))), /Patch Alfa/.test(testoDi(bottone(s.rendi(), "Aumenta")))]);

  // ════ LA QUANTITÀ: IL DISEGNO ════════════════════════════════════════════════════════════════════════════
  const dis = (nome, p, extra = {}) => rendiComponente(radice, file(`${nome}.tsx`), nome, p, extra);
  const hS = (await dis("StepperQuantita", props())).html;
  const hSmax = (await dis("StepperQuantita", props({ qty: 99 }))).html;
  const tag = (html, nome) => html.match(new RegExp(`<${nome}\\b[^>]*>`, "g")) ?? [];
  c("tre elementi che si toccano: «−», campo, «+»", [2, 1], [tag(hS, "button").length, tag(hS, "input").length]);
  c("tutti da 44 px: i bottoni h-11 w-11, il campo h-11 (e largo almeno 44)", [true, true], [tag(hS, "button").every((b) => /\bh-11\b/.test(b) && /\bw-11\b/.test(b)), /\bh-11\b/.test(tag(hS, "input")[0]) && /\b(w-12|w-14|min-w-11)\b/.test(tag(hS, "input")[0])]);
  c("8 px fra un elemento e l'altro (gap-2): V1-T11", true, /\bgap-2\b/.test(hS));
  c("il campo è da 16 px (text-base, mai text-sm: sotto i 16 il telefono ingrandisce da solo)", [true, false], [/\btext-base\b/.test(tag(hS, "input")[0]), /\btext-(xs|sm)\b/.test(tag(hS, "input")[0])]);
  c("campo numerico per il telefono: tastiera dei numeri, niente freccine del browser (type=text)", [true, true, true], [/inputMode="numeric"/.test(tag(hS, "input")[0]), /type="text"/.test(tag(hS, "input")[0]), !/type="number"/.test(hS)]);
  c("il campo ha il suo nome per chi non lo vede (Quantità + nome del prodotto)", true, /aria-label="Quantità Patch Alfa"/.test(tag(hS, "input")[0]));
  c("i bottoni hanno testo per chi non li vede: «Aumenta la quantità Patch Alfa», con l'icona nascosta", [true, true], [/Aumenta la quantità Patch Alfa<\/span>/.test(hS), conta(hS, /<svg\b[^>]*aria-hidden="true"/g) === 2]);
  c("la regione dell'annuncio è nascosta alla vista (sr-only) ma c'è", true, /<span role="status" class="sr-only">Patch Alfa: quantità 2<\/span>/.test(hS));
  c("al massimo il «+» ha l'attributo disabled, il «−» no", [true, false], [/<button\b[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>).)*Aumenta/.test(hSmax), /<button\b[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>).)*Diminuisci/.test(hSmax)]);
  c("il fuoco è visibile (shop-anello) su tutti e tre", 3, conta(hS, /shop-anello/g));

  // ════ LA RIGA ════════════════════════════════════════════════════════════════════════════════════════════
  const vista = (lines = CARRELLO_NUOVO, stato = "ok") => V.righeVista(lines, stato);
  const alfa = vista().righe[0];
  const azioni = () => { const a = { quantita: [], tolte: [] }; return { a, onQuantita: (k, n) => a.quantita.push([k, n]), onTogli: (k) => a.tolte.push(k) }; };
  const disegnaRiga = async (riga, extra = {}, stato = {}) => {
    const { a, ...gestori } = azioni();
    const r = await dis("RigaCarrelloShop", { riga, formatta, ...gestori, ...extra }, stato);
    return { ...r, a };
  };
  const { html: hR, pagina: pR, a: aR } = await disegnaRiga(alfa);
  const tR = leggibile(hR);
  c("è una voce di elenco (<li>): la lista la apre la pagina", true, /^<li\b/.test(hR) && /<\/li>$/.test(hR));
  c("il nome è un link alla scheda del prodotto", [`/shop/prodotto/${alfa.slug}`, true], [(hR.match(/<a\b[^>]*href="([^"]*)"/) ?? [])[1], new RegExp(`<a\\b[^>]*>(?:<span[^>]*>)?${alfa.nome}<`).test(hR)]);
  c("sotto il nome la variante come l'ha data il server, una volta sola", [true, 1], [tR.includes(alfa.varianteNome), tR.split(alfa.varianteNome).length - 1]);
  c("foto: un solo <img>, dal componente FotoShop, quadrata, con alt vuoto (il nome è lì accanto), lazy", [1, 'alt=""', "lazy"], [conta(hR, /<img\b/g), (hR.match(/<img\b[^>]*(alt="[^"]*")/) ?? [])[1], (hR.match(/loading="([^"]*)"/) ?? [])[1]]);
  c("foto: 72 px sul telefono, 96 da sm (stessa misura che FotoShop dà all'uso miniatura)", [true, true], [/\bh-18\b|h-\[72px\]/.test(hR), /sm:h-24|sm:h-\[96px\]/.test(hR)]);
  c("il prezzo di riga è quello della vista (cifra del server), in cifre tabulari", [true, true], [tR.includes(formatta(alfa.riga.cent)), /tabular-nums/.test(hR)]);
  c("ordine di lettura nella riga: nome → variante → prezzo → quantità → «Togli»", true, [alfa.nome, alfa.varianteNome, formatta(alfa.riga.cent), "Aumenta la quantità", "Togli"].map((x) => tR.indexOf(x)).every((v, i, l) => v >= 0 && (i === 0 || v > l[i - 1])));
  c("a 320 px nessuna barra orizzontale: quantità e «Togli» vanno a capo (flex-wrap) e il nome può stringersi (min-w-0, 2 righe)", [true, true, true], [/<div\b[^>]*\bflex-wrap\b[^>]*>.*Togli/.test(hR), /<a\b[^>]*\bmin-w-0\b/.test(hR), /line-clamp-2/.test(hR)]);
  c("«Togli» è un bottone da 44 px in altezza", true, /<button\b(?=[^>]*\bmin-h-11\b)(?=[^>]*\bmin-w-11\b)[^>]*>Togli/.test(hR));
  c("«Togli» ha il nome del prodotto per chi non lo vede", true, /Togli<span class="sr-only"> Patch Alfa|Togli<span class="sr-only"> .*<\/span>/.test(hR) && tR.includes(`Togli ${alfa.nome}`));
  c("lo stepper della riga ha il nome del prodotto", true, hR.includes(`aria-label="Quantità ${alfa.nome}"`));
  c("la quantità mostrata è quella della riga", String(alfa.qty), (hR.match(/<input\b[^>]*value="([^"]*)"/) ?? [])[1]);
  // i gestori veri della riga: i clic arrivano con la CHIAVE della riga
  const clic = (pagina, testo) => pagina.gestori.find((g) => g.tipo === "button" && testoDi({ props: g.props }).includes(testo)).props.onClick;
  clic(pR, "Togli")();
  c("«Togli» chiede di togliere QUELLA riga (la chiave), nient'altro", [alfa.key], aR.tolte);
  clic(pR, "Aumenta")();
  c("«+» della riga chiede la quantità nuova per QUELLA riga", [[alfa.key, alfa.qty + 1]], aR.quantita);
  clic(pR, "Diminuisci")();
  c("«−» della riga: qui la quantità è 1, quindi è spento e non chiede niente", alfa.qty === 1 ? [[alfa.key, alfa.qty + 1]] : [[alfa.key, alfa.qty + 1], [alfa.key, alfa.qty - 1]], aR.quantita);

  // la riga con due pezzi: «−» chiede 1
  const beta = vista().righe[1];
  const { html: hB, pagina: pB, a: aB } = await disegnaRiga(beta);
  c("riga con 2 pezzi: il prezzo mostrato è quello di RIGA (pezzo × 2), non quello del pezzo", [true, false, true], [leggibile(hB).includes(formatta(beta.riga.cent)), leggibile(hB).includes(formatta(beta.unitario.cent)), beta.riga.cent === beta.unitario.cent * 2]);
  clic(pB, "Diminuisci")();
  c("riga con 2 pezzi: «−» chiede 1 per la sua chiave", [[beta.key, beta.qty - 1]], aB.quantita);
  // la chiave della riga non è lo SKU: i gestori devono usare la CHIAVE (è quella che il carrello conosce)
  const conChiave = copia(CARRELLO_NUOVO).map((l) => ({ ...l, key: `${l.sku}|chiave-diversa` }));
  const rChiave = vista(conChiave).righe[1];
  const { pagina: pK, a: aK } = await disegnaRiga(rChiave);
  clic(pK, "Diminuisci")();
  clic(pK, "Togli")();
  c("con una chiave diversa dallo SKU: quantità e «Togli» usano la chiave", [[[rChiave.key, rChiave.qty - 1]], [rChiave.key]], [aK.quantita, aK.tolte]);

  // i prezzi: cifra solo con «ok» (D89, V1-T9)
  const manomesse = copia(CARRELLO_NUOVO).map((l) => ({ ...l, snap: { ...l.snap, prezzoCent: 777700 } })); // un prezzo cambiato a mano nel browser
  const ciaoCifra = formatta(777700);
  const controllo = (await disegnaRiga(vista(manomesse, "controllo").righe[0])).html;
  c("in controllo il prezzo di riga è «…» e la cifra ricordata dal browser NON c'è", [true, false, false], [leggibile(controllo).includes("…"), controllo.includes("7777"), controllo.includes("777700")]);
  const nonVerificabile = (await disegnaRiga(vista(manomesse, "non_verificabile").righe[0])).html;
  c("non verificabile: «—» e nessuna cifra", [true, false], [leggibile(nonVerificabile).includes("—"), nonVerificabile.includes("7777")]);
  const ok = (await disegnaRiga(vista(manomesse, "ok").righe[0])).html;
  c("con «ok» la cifra è quella che arriva (il disegno non la corregge: lo fa il gancio prima)", true, leggibile(ok).includes(ciaoCifra));
  c("nessun «da calcolare» in nessun stato", false, [controllo, nonVerificabile, ok].some((h) => /da calcolare/i.test(h)));
  c("il prezzo ha un posto largo abbastanza (min-w) perché «…» e la cifra non spostino la riga", true, /<p\b[^>]*\bmin-w-\d+[^>]*tabular-nums|<p\b[^>]*tabular-nums[^>]*\bmin-w-\d+|<p\b(?=[^>]*\bmin-w-)(?=[^>]*tabular-nums)/.test(hR));

  // senza foto: il riquadro tiene il posto
  const senzaFoto = (await disegnaRiga({ ...alfa, foto: null })).html;
  c("riga senza foto: nessun <img> ma il riquadro c'è (la riga non cambia disposizione) e non è letto", [0, true], [conta(senzaFoto, /<img\b/g), /<span\b(?=[^>]*aria-hidden="true")(?=[^>]*aspect-ratio)/.test(senzaFoto)]);

  // l'avviso in riga (ambra, icona, testo, role=status che c'è sempre)
  const senzaAvviso = hR;
  c("senza avviso la regione «status» c'è lo stesso, vuota (per essere letta quando arriva)", [2, true], [conta(senzaAvviso, /role="status"/g), /<div role="status"[^>]*><\/div>|<div[^>]*role="status"[^>]*><\/div>/.test(senzaAvviso)]);
  const testoAvviso = "Di questo prodotto ne abbiamo 3. Abbiamo portato la quantità a 3.";
  const conAvviso = (await disegnaRiga(alfa, { avviso: testoAvviso })).html;
  c("con avviso: il testo è dentro una regione «status»", true, new RegExp(`<div[^>]*role="status"[^>]*>(?:(?!</div>).)*${testoAvviso.replace(/[.]/g, "\\.")}`).test(conAvviso));
  c("l'avviso è ambra (sfondo, bordo e testo) e ha un'icona nascosta alla lettura", [true, true, true, true], [/bg-amber-50/.test(conAvviso), /border-amber-/.test(conAvviso), /text-amber-9\d\d/.test(conAvviso), /<svg\b[^>]*aria-hidden="true"/.test(conAvviso.slice(conAvviso.indexOf('role="status"')))]);
  c("l'avviso non è rosso (il rosso non si usa nelle pagine V1)", false, /\b(bg|text|border)-(red|rose)-/.test(conAvviso));
  c("un avviso vuoto o null non disegna nessun riquadro", [false, false], [(await disegnaRiga(alfa, { avviso: "" })).html.includes("bg-amber-50"), (await disegnaRiga(alfa, { avviso: null })).html.includes("bg-amber-50")]);
  c("`AvvisoCarrello` è esportato: la pagina lo usa per le righe tolte e per la frase generale", [true, true], [/export function AvvisoCarrello/.test(sorgenti.RigaCarrelloShop), typeof banco.AvvisoCarrello === "function"]);
  const hAvviso = (await rendiComponente(radice, file("RigaCarrelloShop.tsx"), "AvvisoCarrello", { testo: "Una frase per la pagina." })).html;
  c("`AvvisoCarrello` da solo: regione + riquadro ambra + testo", [true, true], [/role="status"/.test(hAvviso), /bg-amber-50/.test(hAvviso) && hAvviso.includes("Una frase per la pagina.")]);
  c("`AvvisoCarrello` senza testo: solo la regione vuota", [true, false], [/role="status"/.test((await rendiComponente(radice, file("RigaCarrelloShop.tsx"), "AvvisoCarrello", { testo: null })).html), (await rendiComponente(radice, file("RigaCarrelloShop.tsx"), "AvvisoCarrello", { testo: null })).html.includes("bg-amber-50")]);

  // ════ IL RIEPILOGO ═══════════════════════════════════════════════════════════════════════════════════════
  const vOk = vista(CARRELLO_NUOVO, "ok");
  const tariffa = { stato: "ok", costoCent: 490 };
  const rOk = V.riepilogo(vOk, tariffa);
  const disegnaRiepilogo = (riepilogo, extra = {}) => dis("RiepilogoOrdine", { riepilogo, formatta, ...extra });
  const hOk = (await disegnaRiepilogo(rOk)).html;
  const tOk = leggibile(hOk);
  c("le tre voci nell'ordine: Prodotti → Spedizione → Totale", true, ["Prodotti", "Spedizione", "Totale"].map((x) => tOk.indexOf(x)).every((v, i, l) => v >= 0 && (i === 0 || v > l[i - 1])));
  c("«IVA inclusa» è nella voce del Totale", true, /Totale[^<]*(<[^>]*>[^<]*){0,3}IVA inclusa/.test(hOk));
  c("le cifre sono quelle del riepilogo: prodotti, spedizione (490), totale", [true, true, true], [tOk.includes(formatta(rOk.prodotti.cent)), tOk.includes(formatta(490)), tOk.includes(formatta(rOk.prodotti.cent + 490))]);
  c("totale = prodotti + spedizione (nessun sconto, nessuna soglia)", rOk.prodotti.cent + 490, rOk.totale.cent);
  c("il Totale è l'ultima cifra e ha più peso (font-semibold) delle altre; mai il carattere più grande della pagina (≤ text-xl)", [true, false], [/<dd\b[^>]*font-semibold[^>]*>[^<]*<\/dd>\s*<\/div>\s*<a|font-semibold[^>]*>[^<]*€/.test(hOk), /\btext-(2xl|3xl|4xl|5xl)\b/.test(hOk)]);
  c("è una lista di descrizioni (dl): voce e valore legati per chi legge con lo schermo", [true, 3], [/<dl\b/.test(hOk), conta(hOk, /<dt\b/g)]);
  c("nessuna barra di spedizione gratuita, nessuna consulenza, nessun «da calcolare»", false, /gratuit|gratis|ti mancano|consulenza|da calcolare/i.test(hOk));
  c("niente prezzi barrati né sconti", false, /<del|<s>|line-through|sconto|-\d+ ?%/i.test(hOk));

  const bottoneCassa = (h) => (h.match(/<a\b[^>]*>(?:(?!<\/a>).)*Vai alla cassa/) ?? [""])[0];
  const b = bottoneCassa(hOk);
  c("«Vai alla cassa» è un link alla cassa di oggi (PERCORSO_CASSA = /shop/checkout)", ["/shop/checkout", "/shop/checkout"], [(b.match(/href="([^"]*)"/) ?? [])[1], V.PERCORSO_CASSA]);
  c("il bottone è l'unico pieno (notte, 48 px almeno) e porta il marchio che nasconde la barra fissa", [true, true, true], [/bg-\[#0A1430\]/.test(b), /\b(h|min-h)-1[2-4]\b/.test(b), /data-barra-nascondi="vista"/.test(b)]);

  const rControllo = V.riepilogo(vista(manomesse, "controllo"), { stato: "attesa", costoCent: null });
  const hControllo = (await disegnaRiepilogo(rControllo)).html;
  c("in controllo: prodotti, spedizione e totale sono «…» e la cifra manomessa non c'è", [3, false], [conta(leggibile(hControllo).replace(/Vai alla cassa/, ""), /…/g), /7777|777700/.test(hControllo)]);
  c("…e il bottone «Vai alla cassa» resta (D89)", true, bottoneCassa(hControllo).includes("/shop/checkout"));
  const rNon = V.riepilogo(vista(manomesse, "non_verificabile"), { stato: "assente", costoCent: null });
  const hNon = (await disegnaRiepilogo(rNon)).html;
  c("non verificabile: tre «—», nessuna cifra, nessun «da calcolare»", [3, false, false], [conta(leggibile(hNon), /—/g), /7777|777700|\d,\d\d €/.test(hNon), /da calcolare/i.test(hNon)]);
  const rSenzaTariffa = V.riepilogo(vOk, { stato: "assente", costoCent: null });
  const hSenza = (await disegnaRiepilogo(rSenzaTariffa)).html;
  c("tariffa che manca: spedizione e totale «—» (mai un totale senza spedizione)", [true, false], [conta(leggibile(hSenza), /—/g) === 2, leggibile(hSenza).includes(formatta(rOk.prodotti.cent + 490))]);
  c("il bottone resta acceso in ogni stato (ok, controllo, non verificabile, senza tariffa): niente disabled né aria-disabled", false, [hOk, hControllo, hNon, hSenza].some((h) => /disabled/.test(bottoneCassa(h))));
  c("i soldi vengono da `riepilogo()`: il componente non somma niente", true, !/\+ ?\w*\.?cent|reduce\(|\bsomma\b/.test(sorgenti.RiepilogoOrdine));

  // il bottone per la barra fissa: il riferimento passa davvero al link (il banco legge l'albero, non il disegno)
  const rif = { current: null };
  const albero = monta(RiepilogoOrdine, { riepilogo: rOk, formatta, refBottone: rif }).rendi();
  const link = tutti(albero, (e) => e.props?.to === "/shop/checkout")[0];
  c("`refBottone` arriva al link «Vai alla cassa» (serve a chi misura quando il bottone è a schermo)", [true, "vista"], [link?.props.ref === rif, link?.props["data-barra-nascondi"]]);
  c("senza `refBottone` il link non ha riferimento (e non lancia)", true, tutti(monta(RiepilogoOrdine, { riepilogo: rOk, formatta }).rendi(), (e) => e.props?.to === "/shop/checkout")[0]?.props.ref === undefined);

  // ════ I TESTI E IL CODICE ════════════════════════════════════════════════════════════════════════════════
  const testiShop = readFileSync(join(radice, "src/landing/testi-shop.ts"), "utf8");
  for (const [nome, src] of Object.entries(sorgenti)) {
    c(`${nome}: nessuna parola vietata, niente «{{» né «da confermare» (nemmeno nei commenti)`, [], trovaParoleVietate(src));
    c(`${nome}: nessun tracciamento (fbq, ttq, gtag), nessun localStorage, nessun fetch, nessun HTML a mano`, false, /\b(fbq|ttq|gtag|localStorage|fetch)\b|dangerouslySetInnerHTML/.test(src));
    c(`${nome}: non scrive soldi (nessun Intl.NumberFormat, nessun «€» nel codice, commenti a parte)`, false, /Intl\.NumberFormat|€/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));
  }
  c("i testi visibili vengono da testi-shop: Togli, Prodotti, Spedizione, Totale, IVA inclusa, Vai alla cassa", true, ["togli", "prodotti", "spedizione", "totale", "ivaInclusa", "vaiAllaCassa"].every((k) => /TESTI_SHOP\.carrello|\bt\.|\{ ?[^}]*\} = TESTI_SHOP\.carrello/.test(sorgenti.RigaCarrelloShop + sorgenti.RiepilogoOrdine) && new RegExp(`\\b${k}\\b`).test(sorgenti.RigaCarrelloShop + sorgenti.RiepilogoOrdine) && new RegExp(`${k}:`).test(testiShop)));
  c("i testi della quantità vengono da TESTI_PROVVISORI.carrello (quantita, diminuisci, aumenta, annuncio)", true, ["quantita", "diminuisci", "aumenta", "annuncio"].every((k) => new RegExp(`\\b${k}\\b`).test(sorgenti.StepperQuantita) && new RegExp(`${k}:`).test(testiShop.slice(testiShop.indexOf("export const TESTI_PROVVISORI")))));
  c("nessuna frase scritta nei componenti (stringhe con spazio fra lettere in italiano): solo classi e segni", [], (Object.values(sorgenti).join("\n").match(/>[A-Za-zÀ-ú]+ [A-Za-zÀ-ú ]+</g) ?? []));
  c("nessun rosso, nessuna ombra, nessun barrato nelle classi", false, /\b(bg|text|border)-(red|rose)-|\bshadow-|line-through/.test(Object.values(sorgenti).join("\n")));
  c("la riga usa FotoShop (D98), non un <img> a mano", [true, false], [/<FotoShop\b/.test(sorgenti.RigaCarrelloShop), /<img\b/.test(sorgenti.RigaCarrelloShop)]);
  c("la riga e il riepilogo usano `testoPrezzo` di T79 (una cifra solo con «ok»)", [true, true], [/testoPrezzo\(/.test(sorgenti.RigaCarrelloShop), /testoPrezzo\(/.test(sorgenti.RiepilogoOrdine)]);
  c("li monta solo `PaginaCarrello` (T98), nessuna route li nomina direttamente", ["src/components/shop/pagine/PaginaCarrello.tsx"], ["src/routes", "src/components"].flatMap((d) => grep(radice, d, /carrello\/(RigaCarrelloShop|StepperQuantita|RiepilogoOrdine)/)));
}

/** I file di `cartella` (dentro `radice`, ricorsivo) il cui testo contiene `re`: solo i nomi, per una prova «nessuno lo importa ancora». */
import { readdirSync, statSync } from "node:fs";
function grep(radice, cartella, re) {
  const fuori = [];
  const giro = (p) => {
    for (const f of readdirSync(p)) {
      const q = join(p, f);
      if (statSync(q).isDirectory()) giro(q);
      else if (/\.(tsx?|mjs)$/.test(f) && !q.includes("/components/shop/carrello/") && re.test(readFileSync(q, "utf8"))) fuori.push(q.slice(radice.length + 1));
    }
  };
  giro(join(radice, cartella));
  return fuori;
}
