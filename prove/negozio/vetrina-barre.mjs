/** ── VETRINA V1 · T79 · QUALE GUSCIO E QUALE BARRA FISSA PER OGNI PERCORSO (D72, D83) ──────────────────
 *  `src/shop/cms/vetrina-barre.ts`: funzioni pure, nessuna rete, nessuno schermo. Qui si prova ogni percorso: il guscio
 *  nuovo solo sulle cinque pagine V1, la barra fissa (consulenza su home e categoria, acquisto su scheda e carrello,
 *  nessuna altrove), MAI due barre, e che il guscio coincida con `usaInter`/`paginaInItaliano` di T71.
 *  Criteri: V1-H5 (mai due barre), V1-T8 (la consulenza solo dove deve), V1-T2 (guscio solo sulle pagine V1).
 *  Dati: solo percorsi inventati. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function prove(mod, { c, gruppo, radice }) {
  const B = mod["shop/cms/vetrina-barre"];
  gruppo("VETRINA V1 · T79 · GUSCIO E BARRA FISSA PER PERCORSO (23/11/2026)");
  c("il modulo c'è", true, !!B);
  if (!B) return;
  const { barraFissa, guscioPerPercorso, spazioRiservato } = B;

  /* Le cinque pagine V1, anche con query, hash, barra finale e maiuscole (il router non distingue). */
  const HOME = ["/shop", "/shop/", "/SHOP", "/shop?utm_source=meta", "/shop#prodotti", "/shop//"];
  const CATEGORIA = ["/shop/c/patch-pronte", "/shop/c/patch-pronte/", "/Shop/C/Patch-Pronte?ordine=prezzo", "/shop/c/x#su"];
  const CERCA = ["/shop/cerca", "/shop/cerca?q=colla", "/shop/Cerca/"];
  const SCHEDA = ["/shop/prodotto/patch-prova-alfa", "/shop/prodotto/patch-prova-alfa?anteprima=abc", "/SHOP/PRODOTTO/Patch-Prova-Alfa/"];
  const CARRELLO = ["/shop/carrello", "/shop/carrello/", "/shop/Carrello?x=1#top"];
  /* Tutto il resto: la cassa, l'ordine, il collaudo (di R2) e ciò che non esiste, anche con `cms`. */
  const ALTROVE = [
    "/shop/checkout", "/shop/checkout/", "/Shop/Checkout?x=1", "/shop/ordine", "/shop/ordine/HG-1", "/shop/ordine/HG-1?t=abc",
    "/shop/collaudo", "/shop/collaudo/", "/shop/xyz", "/shop/404", "/404", "/shopx", "/shopping", "/shop/c", "/shop/c/", "/shop/c/a/b",
    "/shop//c/x", "/shop/prodotto", "/shop/prodotto/", "/shop/prodotto/a/b", "/shop/cerca/altro", "/shop/carrello/altro", "/shop/cercare",
    "/shop/carrelli", "/shopx/carrello", "/x/shop", "/", "/blog", "/blog/un-articolo", "/CRM", "/invisible-derm", "", "shop",
  ];

  // ── guscioPerPercorso (D72) ──
  const guscio = (l) => l.map((p) => guscioPerPercorso(p));
  c("guscio NUOVO sulle cinque pagine V1 (con query, hash, barra finale, maiuscole)", true,
    [...HOME, ...CATEGORIA, ...CERCA, ...SCHEDA, ...CARRELLO].every((p) => guscioPerPercorso(p) === "nuovo"));
  c("guscio di OGGI per cassa, ordine, collaudo e percorsi sconosciuti", ALTROVE.map(() => "oggi"), guscio(ALTROVE));
  c("valori non testuali → di oggi, senza lanciare", ["oggi", "oggi", "oggi", "oggi"], [undefined, null, 5, {}].map((p) => guscioPerPercorso(p)));
  c("la cassa non è mai nel guscio nuovo (con e senza maiuscole)", ["oggi", "oggi", "oggi"], ["/shop/checkout", "/SHOP/CHECKOUT", "/shop/checkout?x=1"].map(guscioPerPercorso));

  /* Stessa lista di `usaInter` e `paginaInItaliano` (T71, D73): una tabella di percorsi di /shop, risposte uguali. */
  const CAR = mod["lib/carattere"];
  c("il modulo del carattere c'è (T71)", true, !!CAR);
  if (CAR) {
    const TABELLA = [...HOME, ...CATEGORIA, ...CERCA, ...SCHEDA, ...CARRELLO, ...ALTROVE.filter((p) => p.toLowerCase().includes("shop"))];
    c("guscio nuovo ⟺ usaInter ⟺ paginaInItaliano, su tutta la tabella di percorsi /shop",
      TABELLA.map(() => true),
      TABELLA.map((p) => (guscioPerPercorso(p) === "nuovo") === CAR.usaInter(p) && CAR.usaInter(p) === CAR.paginaInItaliano(p)));
  }

  // ── barraFissa (D83): una sola barra per percorso ──
  const barra = (l) => l.map((p) => barraFissa(p));
  c("home → consulenza", HOME.map(() => "consulenza"), barra(HOME));
  c("categoria → consulenza", CATEGORIA.map(() => "consulenza"), barra(CATEGORIA));
  c("scheda → acquisto", SCHEDA.map(() => "acquisto"), barra(SCHEDA));
  c("carrello → acquisto", CARRELLO.map(() => "acquisto"), barra(CARRELLO));
  c("cerca → nessuna barra", CERCA.map(() => null), barra(CERCA));
  c("cassa, ordine, collaudo, sconosciuti, altre pagine del sito → nessuna barra", ALTROVE.map(() => null), barra(ALTROVE));
  c("valori non testuali → nessuna barra, senza lanciare", [null, null, null, null], [undefined, null, 5, {}].map((p) => barraFissa(p)));

  /* La pagina «non trovata» (404), l'errore, l'anteprima e ciò che non si vende: stesso percorso della scheda o della categoria, nessuna barra. */
  const STATI = ["non_trovata", "errore", "non_in_vendita"];
  c("404, errore e non in vendita → nessuna barra, né sulla scheda né sulla categoria né sul carrello né sulla home",
    STATI.flatMap(() => [null, null, null, null]),
    STATI.flatMap((s) => ["/shop/prodotto/x", "/shop/c/x", "/shop/carrello", "/shop"].map((p) => barraFissa(p, s))));
  c("lo stato «normale» detto per esteso è come non dirlo", ["acquisto", "consulenza"], [barraFissa("/shop/prodotto/x", "normale"), barraFissa("/shop/c/x", "normale")]);
  c("uno stato sconosciuto non accende nessuna barra (chiuso, mai aperto)", [null, null], [barraFissa("/shop/prodotto/x", "boh"), barraFissa("/shop/c/x", 7)]);

  // ── MAI DUE BARRE, e mai fuori dal guscio nuovo ──
  const SEGMENTI = ["", "shop", "SHOP", "c", "prodotto", "cerca", "carrello", "checkout", "ordine", "collaudo", "x", "patch-pronte", "a b", "%20", "."];
  const GENERATI = new Set(["/", ""]);
  const FINALI = ["", "/", "?q=1", "#x", "/?a=b"];
  for (const a of SEGMENTI) for (const b of SEGMENTI) for (const d of SEGMENTI) for (const f of FINALI) GENERATI.add(`/${a}/${b}/${d}${f}`.replace(/\/{3,}/g, "//"));
  for (const a of SEGMENTI) for (const b of SEGMENTI) for (const f of FINALI) GENERATI.add(`/${a}/${b}${f}`);
  const tutti = [...GENERATI, ...HOME, ...CATEGORIA, ...CERCA, ...SCHEDA, ...CARRELLO, ...ALTROVE];
  c("la tabella dei percorsi generati è grande abbastanza", true, tutti.length > 2000);
  const esiti = tutti.map((p) => [p, barraFissa(p), guscioPerPercorso(p)]);
  c("una barra sola: ogni risposta è «consulenza», «acquisto» o niente (mai un elenco, mai due)", [],
    esiti.filter(([, b]) => !(b === null || b === "consulenza" || b === "acquisto")).map(([p]) => p));
  c("una barra c'è solo nel guscio nuovo (cassa, ordine e collaudo non ne hanno mai)", [],
    esiti.filter(([, b, g]) => b !== null && g !== "nuovo").map(([p]) => p));
  c("la stessa pagina non ha mai insieme barra di consulenza e d'acquisto: per ogni percorso e ogni stato la barra è una sola o nessuna",
    [],
    tutti.filter((p) => {
      const l = [barraFissa(p), barraFissa(p, "normale"), barraFissa(p, "non_trovata"), barraFissa(p, "errore"), barraFissa(p, "non_in_vendita")];
      return new Set(l.filter(Boolean)).size > 1;
    }));
  c("la consulenza solo su home e categoria; l'acquisto solo su scheda e carrello", [],
    esiti.filter(([p, b]) => {
      const n = p.split("#")[0].split("?")[0].toLowerCase().replace(/\/+$/, "");
      const homeOCategoria = n === "/shop" || /^\/shop\/c\/[^/]+$/.test(n);
      const schedaOCarrello = n === "/shop/carrello" || /^\/shop\/prodotto\/[^/]+$/.test(n);
      return (b === "consulenza" && !homeOCategoria) || (b === "acquisto" && !schedaOCarrello) || (homeOCategoria && b !== "consulenza") || (schedaOCarrello && b !== "acquisto");
    }).map(([p]) => p));
  c("nessun percorso del carrello, della cassa o della ricerca ha la consulenza (V1-T8, V1-K5)", [],
    esiti.filter(([p, b]) => b === "consulenza" && /^\/shop\/(carrello|checkout|cerca|ordine|collaudo)(\/|\?|#|$)/i.test(p)).map(([p]) => p));

  // ── spazioRiservato: ogni barra riserva il suo spazio in fondo ──
  const IPHONE = "env(safe-area-inset-bottom, 0px)";
  c("la consulenza riserva 56 px più la zona dei gesti (come la barra di oggi)", `calc(56px + ${IPHONE})`, spazioRiservato("consulenza"));
  c("l'acquisto riserva uno spazio più alto di quello della consulenza (c'è il bottone da 56 px)", true,
    parseInt(/calc\((\d+)px/.exec(spazioRiservato("acquisto"))?.[1] ?? "0", 10) > 56 && spazioRiservato("acquisto").endsWith(`+ ${IPHONE})`));
  c("nessuna barra → nessuno spazio", ["0px", "0px", "0px"], [spazioRiservato(null), spazioRiservato(undefined), spazioRiservato("boh")]);
  c("lo spazio segue la barra scelta per percorso: carrello e scheda uguali, home diversa da scheda", [true, true],
    [spazioRiservato(barraFissa("/shop/carrello")) === spazioRiservato(barraFissa("/shop/prodotto/x")), spazioRiservato(barraFissa("/shop")) !== spazioRiservato(barraFissa("/shop/prodotto/x"))]);

  // ── il sorgente è puro ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/vetrina-barre.ts"), "utf8");
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("nessun import, nessun DOM, nessuna memoria del browser, nessuna rete, nessun orologio", [], ["import ", "window", "document", "localStorage", "sessionStorage", "fetch(", "Date", "Math.random", "setTimeout"].filter((p) => codice.includes(p)));
}
