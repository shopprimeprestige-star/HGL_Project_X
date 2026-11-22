/** ── NEGOZIO · R2 · T63 · LISTA ORDINI E PANORAMICA, LE SCHERMATE (SPEC 8A n. 1 e 7; SPEC 7.4 n. 4 e 6) ───────────────────
 *  `src/crm/ecommerce/ElencoOrdini.tsx` e `Panoramica.tsx` dopo il Rilascio 2. Le regole dei conti e dei filtri sono già provate
 *  (`conti-pagamento`, `ordini-ui-r2`, `conti-invariati`): qui si prova che le due schermate le USANO come devono e mostrano le cose nuove.
 *   · la lista: i badge «PROVA», «In attesa», «Scaduto», «Fattura da fare», «Giacenza da verificare»; i filtri canale, pagamento, «Fattura da fare»,
 *     «Giacenza da verificare», «Mostra ordini di prova»; **con i filtri nuovi vuoti la lista è quella di oggi**;
 *   · nessun dato fiscale nella lista (solo il segno «Fattura da fare»);
 *   · il numeretto e il chip «Nuovo» non contano gli ordini in attesa (prova incrociata con `daLavorare` e `contaComeLavoro`);
 *   · la Panoramica: «Rimborsato», «N ordini di prova non contati», «N ordini in attesa di pagamento» FUORI dalle quattro cifre principali,
 *     che con questi ordini in più restano **identiche**; senza ordini nuovi la pagina non cambia.
 *  Non c'è un DOM: il disegno si prova con `react-dom/server` sui componenti veri (impacchettati con esbuild). Dati inventati (`@example.com`). */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";
import { rigaOrdineProva } from "../ecommerce/dati.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const ADESSO = new Date("2026-11-21T12:00:00.000Z");
const FUTURO = "2026-11-21T13:00:00.000Z";
const PASSATO = "2026-11-21T11:00:00.000Z";
const P = { da: "2026-11-01", a: "2026-11-30" };

export async function prove(mod, { c, gruppo, radice }) {
  const O = mod["ecommerce/ordine"];
  const U = mod["ecommerce/ordini-ui"];
  const K = mod["ecommerce/conti"];
  const PG = mod["ecommerce/pagamento"];
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
  gruppo("NEGOZIO · R2 · T63 · LISTA ORDINI E PANORAMICA (22/11/2026)");

  // ── gli ordini inventati ──
  let minuto = 0;
  const base = (n, ref, extra = {}) => rigaOrdineProva({ id: uuid(n), order_ref: ref, created_at: `2026-11-10T09:${String(10 + minuto++).padStart(2, "0")}:00.000Z`, ...extra });
  const stripe = (n, ref, extra = {}) => base(n, ref, { stato_pagamento: "pagato", pagato_il: "2026-11-10T10:00:00.000Z", pagato_importo: 24.9, metodo_pagamento: "stripe", canale: "sito", totale_cent: 2490, ...extra });
  const righe = [
    stripe(0xa1, "HG-A1"), //                                                                                                    pagato, cassa nuova
    stripe(0xa2, "HG-A2", { stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, scade_il: FUTURO }), //            in attesa (la sessione è aperta)
    stripe(0xb2, "HG-B2", { stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, scade_il: FUTURO }), //            un'altra in attesa
    stripe(0xa3, "HG-A3", { stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, scade_il: PASSATO }), //          in attesa ma la scadenza è passata: «scaduto»
    stripe(0xa4, "HG-A4", { prova: true }), //                                                                                   di prova
    stripe(0xa5, "HG-A5", { fattura_richiesta: true, fattura_nota: "NOTA-FISCALE-FINTA" }), //                                    fattura da fare
    stripe(0xa6, "HG-A6", { fattura_richiesta: true, fattura_emessa_il: "2026-11-11T08:00:00.000Z" }), //                         fattura già emessa
    stripe(0xa7, "HG-A7", { giacenza_da_verificare: true }), //                                                                  giacenza da verificare
    base(0xa8, "HG-A8"), //                                                                                                      di prima, non pagato
    base(0xa9, "HG-A9", { pagato_il: "2026-11-11T08:00:00.000Z", pagato_importo: 24.9, metodo_pagamento: "bonifico" }), //         di prima, pagato
    stripe(0xaa, "HG-AA", { stato_pagamento: "rimborsato_in_parte", rimborsato_cent: 500 }), //                                  rimborsato in parte (5,00 €)
  ];
  const ordini = O.normalizzaTutti(righe).ordini;
  const soloDiPrima = O.normalizzaTutti([base(0xc1, "HG-C1"), base(0xc2, "HG-C2", { pagato_il: "2026-11-11T08:00:00.000Z", pagato_importo: 24.9 })]).ordini;
  const senzaProva = ordini.filter((o) => !o.prova);
  const ref = (o) => o.ref;

  // ── 1 · sul sorgente ──
  const elT = leggi("src/crm/ecommerce/ElencoOrdini.tsx");
  const panT = leggi("src/crm/ecommerce/Panoramica.tsx");
  const el = senzaCommenti(elT);
  const pan = senzaCommenti(panT);
  const kpiPrincipali = pan.slice(pan.indexOf("<KpiRiga colonne={4}"), pan.indexOf("</KpiRiga>", pan.indexOf("<KpiRiga colonne={4}")));
  c("Panoramica: le quattro cifre principali ci sono (blocco trovato)", true, kpiPrincipali.includes("p.ordini") && kpiPrincipali.includes("p.incassato") && kpiPrincipali.includes("p.daIncassare") && kpiPrincipali.includes("fermi"));
  c("Panoramica: nessuna cifra principale usa gli in attesa, la prova o i rimborsi (restano fuori)", false, /inAttesa|\.prova|rimborsato|statoPagamento|statoEffettivo/.test(kpiPrincipali));
  c("Panoramica: «in attesa», «di prova» e «Rimborsato» si leggono da `panoramica()` di conti.ts, senza rifare i conti", [true, false], [/p\.inAttesa/.test(pan) && /p\.prova/.test(pan) && /p\.rimborsato/.test(pan), /\.reduce\(|\+= /.test(pan)]);
  c("ElencoOrdini: usa `filtraOrdini` e `conteggiPerStato` di ordini-ui (nessun filtro rifatto a mano, nessun dato fiscale)", [true, true, false, false], [
    /filtraOrdini\(/.test(el), /conteggiPerStato\(/.test(el), /fatturaNota|\.cf\b|\.piva\b|codice fiscale|partita iva/i.test(el), /fatturaEmessaIl\s*(===|!==)[^)]*\.filter|\.filter\([^)]*fattura/.test(el),
  ]);
  c("le due schermate: nessun log, nessun «Elimina», nessun window.confirm, nessun supabase", [false, false, false, false], [
    /console\./.test(el + pan), /elimin|cancella ordine|delete/i.test(el + pan), /window\.confirm|confirm\(/.test(el + pan), /@\/integrations\/supabase|createClient/.test(el + pan),
  ]);

  // ── 2 · i filtri nuovi: la scelta → i filtri di ordini-ui ──
  const bundle = async (entrata, nome, dove) => {
    const req = createRequire(join(radice, "package.json"));
    //  react e react-dom restano QUELLI DEL PROGETTO (stesso file, stessa istanza): due copie non si parlano e gli hook si rompono.
    const reactDelProgetto = { name: "react-del-progetto", setup(b) { b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({ path: req.resolve(a.path), external: true })); } };
    await build({ entryPoints: [join(radice, entrata)], bundle: true, platform: "node", format: "cjs", outfile: join(dove, `${nome}.cjs`),
      loader: { ".tsx": "tsx", ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".webp": "dataurl" }, alias: { "@": join(radice, "src") },
      plugins: [reactDelProgetto], logLevel: "silent", jsx: "automatic" });
    return createRequire(import.meta.url)(join(dove, `${nome}.cjs`));
  };
  const dove = mkdtempSync(join(tmpdir(), "ordini-schermata-"));
  try {
    const req = createRequire(join(radice, "package.json"));
    const { createElement: h } = req("react");
    const { renderToStaticMarkup } = req("react-dom/server");
    const E = await bundle("src/crm/ecommerce/ElencoOrdini.tsx", "elenco", dove);
    const Pn = await bundle("src/crm/ecommerce/Panoramica.tsx", "panoramica", dove);
    const VUOTE = E.SCELTE_R2_VUOTE ?? null;
    const filtriR2 = typeof E.filtriR2 === "function" ? E.filtriR2 : () => "«filtriR2» non esiste";
    const ids = (scelte, extra = {}) => U.filtraOrdini(ordini, { periodo: P, ...extra, ...filtriR2({ ...VUOTE, ...scelte }, ADESSO) }).map((o) => o.ref).sort();
    const TUTTI = ordini.map(ref).sort();

    c("scelte vuote: il predefinito è «tutto com'è oggi»: nessun filtro nuovo, gli ordini di prova si vedono", [{}, true], [filtriR2(VUOTE, ADESSO), VUOTE?.mostraProva]);
    c("con le scelte vuote la lista è quella di oggi: stesse righe di `filtraOrdini` senza filtri nuovi, per ogni stato, pagato e ricerca", true, (() => {
      for (const stato of [undefined, "nuovo", "spedito"]) for (const pagato of [undefined, "si", "no"]) for (const ricerca of [undefined, "HG-A5", "esempio"]) {
        const oggi = U.filtraOrdini(ordini, { periodo: P, stato, pagato, ricerca }).map(ref);
        const ora = U.filtraOrdini(ordini, { periodo: P, stato, pagato, ricerca, ...filtriR2(VUOTE, ADESSO) }).map(ref);
        if (JSON.stringify(oggi) !== JSON.stringify(ora)) return false;
      }
      return U.filtraOrdini(ordini, { periodo: P }).length === ordini.length;
    })());
    c("«Fattura da fare»: la fattura richiesta e non emessa (non la emessa, non chi non l'ha chiesta)", ["HG-A5"], ids({ fatturaDaFare: true }));
    c("«Giacenza da verificare»: solo gli ordini segnati", ["HG-A7"], ids({ giacenzaDaVerificare: true }));
    c("canale «sito»: la cassa nuova (non gli ordini di prima)", [TUTTI.filter((r) => r !== "HG-A8" && r !== "HG-A9"), ["HG-A8", "HG-A9"]], [ids({ canale: "sito" }), ids({ canale: "vecchio" })]);
    c("pagamento «in attesa»: le due con la sessione aperta; «scaduto»: quella con la scadenza passata (D52, legge `adesso`)", [["HG-A2", "HG-B2"], ["HG-A3"]], [ids({ statoPagamento: "in_attesa" }), ids({ statoPagamento: "scaduto" })]);
    c("pagamento «rimborsato in parte»", ["HG-AA"], ids({ statoPagamento: "rimborsato_in_parte" }));
    c("«Mostra ordini di prova» spento: l'ordine di prova sparisce, gli altri restano", [TUTTI.filter((r) => r !== "HG-A4"), true], [ids({ mostraProva: false }), ids({ mostraProva: true }).includes("HG-A4")]);
    c("filtri insieme: cassa nuova + «Fattura da fare» + senza prova", ["HG-A5"], ids({ canale: "sito", fatturaDaFare: true, mostraProva: false }));

    // ── 3 · la lista disegnata ──
    const lettura = (o, extra = {}) => ({ ordini: o, caricato: true, inCaricamento: false, inAggiornamento: false, errore: null, scartati: 0, troncato: false, migrazionePronta: true, ultimoAggiornamento: 0, ...extra });
    const storico = async () => ({ ok: true, eventi: [] });
    const esegui = async () => ({ ok: false });
    const elenco = (o, extra = {}) => renderToStaticMarkup(h(E.ElencoOrdini, { lettura: lettura(o), periodo: P, migrazionePronta: true, imposta: () => {}, esegui, storico, adesso: ADESSO, ...extra }));
    const testo = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
    const html = elenco(ordini);
    const parti = html.split('data-riga=""');
    const intestazione = testo(parti[0]);
    const riga = (r) => testo(parti.slice(1).find((p) => p.includes(`>${r}<`)) ?? `«${r}» non c'è`);
    c("la lista di oggi: una riga per ogni ordine del periodo (anche in attesa e di prova), senza filtri nuovi attivi", ordini.length, parti.length - 1);
    c("badge «PROVA» sull'ordine di prova, e solo su quello", [true, false, false], [/PROVA/.test(riga("HG-A4")), /PROVA/.test(riga("HG-A1")), /PROVA/.test(riga("HG-A8"))]);
    c("badge «In attesa» sugli ordini in attesa; «Scaduto» su quello con la scadenza passata (non «In attesa»)", [true, true, true, false], [/In attesa/.test(riga("HG-A2")), /In attesa/.test(riga("HG-B2")), /Scaduto/.test(riga("HG-A3")), /In attesa/.test(riga("HG-A3"))]);
    c("un ordine in attesa non si presenta «Pagato»", false, /Pagato/.test(riga("HG-A2")) || /Pagato/.test(riga("HG-A3")));
    c("«Fattura da fare» sulla riga che l'ha chiesta e non emessa; non sulla emessa né sulle altre", [true, false, false], [/Fattura da fare/.test(riga("HG-A5")), /Fattura da fare/.test(riga("HG-A6")), /Fattura da fare/.test(riga("HG-A1"))]);
    c("«Giacenza da verificare» sulla riga segnata, solo lì", [true, false], [/Giacenza da verificare/.test(riga("HG-A7")), /Giacenza da verificare/.test(riga("HG-A1"))]);
    c("«Rimborsato in parte» sulla riga col rimborso", true, /Rimborsato in parte/.test(riga("HG-AA")));
    c("gli ordini di prima si leggono come oggi: «Pagato» / «Non pagato», nessun badge nuovo", [true, true, false, false], [
      /Non pagato/.test(riga("HG-A8")), /Pagato/.test(riga("HG-A9")) && !/Non pagato/.test(riga("HG-A9")),
      /PROVA|In attesa|Scaduto|Fattura da fare|Giacenza da verificare|Rimborsato/.test(riga("HG-A8")), /PROVA|In attesa|Scaduto|Fattura da fare|Giacenza da verificare|Rimborsato/.test(riga("HG-A9")),
    ]);
    c("la cassa nuova si legge dalla riga (colonna «canale»); gli ordini di prima non portano niente", [true, false], [/Cassa nuova/.test(riga("HG-A1")), /Cassa nuova/.test(riga("HG-A8"))]);
    c("nessun dato fiscale nella lista: la nota della fattura non compare", false, html.includes("NOTA-FISCALE-FINTA"));
    c("i filtri nuovi ci sono, con le loro etichette", [true, true, true, true, true], ["Canale", "Pagamento", "Fattura da fare", "Giacenza da verificare", "Mostra ordini di prova"].map((x) => intestazione.includes(x)));
    c("i filtri di prima restano: gli stati, «Pagati», «Non pagati», la ricerca", true, ["Tutti", "Nuovo", "In preparazione", "Spedito", "Consegnato", "Annullato", "Pagati", "Non pagati"].every((x) => intestazione.includes(x)) && /type="search"/.test(html));

    // ── 4 · il chip «Nuovo» e il numeretto: gli in attesa non contano ──
    const chip = (htm, nome) => Number(new RegExp(`${nome}</span><span[^>]*>(\\d+)</span>`).exec(htm.split('aria-label="Filtra per pagamento"')[0])?.[1] ?? NaN);
    const htmlSP = elenco(senzaProva);
    const numeretto = K.daLavorare(senzaProva);
    const comeLavoro = senzaProva.filter((o) => o.stato === "nuovo" && PG.contaComeLavoro(o)).length;
    c("un ordine in attesa non è nel chip «Nuovo» e il chip torna col numeretto del menu (senza ordini di prova)", [7, 7, 7, 7], [numeretto, comeLavoro, chip(htmlSP, "Nuovo"), chip(htmlSP, "Tutti")]);
    c("…e le tre non pagate si vedono lo stesso in lista (sono 10 righe senza la prova, 7 nei chip)", [10, true], [(htmlSP.split('data-riga=""').length - 1), /In attesa/.test(htmlSP) && /Scaduto/.test(htmlSP)]);
    const nota = (htm) => /numeretto/.test(testo(htm.split('data-riga=""')[0] + htm.split('data-riga=""').slice(-1)[0]));
    c("la lista dice perché i numeri dei filtri sono meno delle righe (solo se ci sono ordini non pagati)", [true, false], [nota(htmlSP), nota(elenco(soloDiPrima))]);
    c("lista vuota di ordini nuovi, solo ordini di prima: nessuna parola nuova in pagina", false, /PROVA|In attesa|Scaduto|Fattura da fare ?<|Giacenza da verificare ?<|numeretto/.test(testo(elenco(soloDiPrima).split('data-riga=""').slice(1).join(" "))));
    c("niente «NaN», «undefined», «Infinity» in pagina", false, /NaN|undefined|Infinity|\[object/.test(testo(html)));

    // ── 4b · con un chip di stato scelto (anche dal clic della Panoramica) i non pagati non ci sono (SPEC 8A n. 1) ──
    const righeDi = (htm) => htm.split('data-riga=""').slice(1);
    const conStato = elenco(ordini, { stato: "nuovo" });
    c("chip «Nuovo» scelto: gli ordini in attesa e scaduti non compaiono in lista", [false, false, false], ["HG-A2", "HG-B2", "HG-A3"].map((r) => conStato.includes(`>${r}<`)));
    c("…le righe sono quante dice il chip (anche gli ordini di prova, che il chip conta)", [8, 8], [righeDi(conStato).length, chip(conStato, "Nuovo")]);
    c("…gli ordini pagati, di prima e di prova restano", [true, true, true, true], ["HG-A1", "HG-A4", "HG-A8", "HG-AA"].map((r) => conStato.includes(`>${r}<`)));
    c("con «Tutti» e i filtri vuoti la lista è quella di oggi: ci sono anche gli ordini non pagati (11 righe)", [11, true], [righeDi(html).length, ["HG-A2", "HG-B2", "HG-A3"].every((r) => html.includes(`>${r}<`))]);
    c("anche gli altri stati escludono i non pagati: nessun ordine in attesa sotto «Annullato»", false, /In attesa|Scaduto/.test(testo(elenco(ordini.map((o) => ({ ...o, stato: "annullato" })), { stato: "annullato" }).split('data-riga=""').slice(1).join(" "))));

    // ── 4c · il bottone di riga dice anche i badge (lettore di schermo) ──
    const etichetta = (r) => new RegExp(`aria-label="(Apri ordine ${r},[^"]*)"`).exec(html)?.[1] ?? "";
    c("aria-label della riga: il numero, il nome e il badge di pagamento di sempre", [true, true, true], [/^Apri ordine HG-A8, /.test(etichetta("HG-A8")) && /Non pagato/.test(etichetta("HG-A8")), /Pagato/.test(etichetta("HG-A9")) && !/Non pagato/.test(etichetta("HG-A9")), /Pagato/.test(etichetta("HG-A1"))]);
    c("aria-label della riga: PROVA, In attesa, Scaduto, Fattura da fare, Giacenza da verificare, Rimborsato in parte", [true, true, true, true, true, true], [
      /PROVA/.test(etichetta("HG-A4")), /In attesa/.test(etichetta("HG-A2")), /Scaduto/.test(etichetta("HG-A3")), /Fattura da fare/.test(etichetta("HG-A5")), /Giacenza da verificare/.test(etichetta("HG-A7")), /Rimborsato in parte/.test(etichetta("HG-AA")),
    ]);
    c("aria-label della riga: nessun badge che la riga non ha", [false, false, false], [/PROVA|Fattura|Giacenza|In attesa/.test(etichetta("HG-A1")), /Fattura/.test(etichetta("HG-A6")), /PROVA|Fattura|Giacenza|In attesa|Scaduto/.test(etichetta("HG-A8"))]);

    // ── 5 · la Panoramica ──
    const pano = (o, extra = {}) => renderToStaticMarkup(h(Pn.Panoramica, { lettura: lettura(o), periodo: P, adesso: ADESSO, apriStato: () => {}, ...extra }));
    const hp = pano(ordini);
    const tp = testo(hp);
    c("«N ordini in attesa di pagamento»: i due con la sessione aperta (quello scaduto in lettura no)", true, /2 ordini in attesa di pagamento/.test(tp));
    c("«N ordine di prova non contato» (singolare giusto)", true, /1 ordine di prova non contato/.test(tp));
    c("«Rimborsato» con l'importo (5,00 €) e il numero di ordini", true, /Rimborsato/.test(tp) && /5,00/.test(tp.slice(tp.indexOf("Rimborsato"))));
    c("la sezione si chiama «Da sapere» (il rimborso è già dentro «Incassato»: «Fuori dalle cifre» sarebbe inesatto)", [true, false], [/Da sapere/.test(tp), /Fuori dalle cifre/.test(hp)]);
    const fine = (t) => t.indexOf("risultati pagati");
    const principali = (htm) => { const t = testo(htm); return t.slice(0, fine(t)); };
    const conExtra = O.normalizzaTutti(righe).ordini;
    const senzaExtra = conExtra.filter((o) => !["HG-A2", "HG-B2", "HG-A3", "HG-A4"].includes(o.ref));
    c("le cifre principali (Ordini, Incassato, Da incassare, Ordini fermi) NON cambiano con gli in attesa e di prova in più", [true, true], [principali(pano(senzaExtra)).length > 50, principali(pano(senzaExtra)) === principali(pano(conExtra))]);
    c("…e nemmeno i cinque stati dei conti («Nuovo» = solo chi si lavora)", [7, 7], [K.panoramica(senzaExtra, P, ADESSO).perStato.nuovo, K.panoramica(conExtra, P, ADESSO).perStato.nuovo]);
    c("«Nuovo» nei cinque stati della pagina: 7, senza gli in attesa e la prova", 7, Number(/Ordini per stato Nuovo (\d+)/.exec(tp)?.[1] ?? NaN));
    const tPrima = testo(pano(soloDiPrima));
    c("senza ordini nuovi la Panoramica non dice niente di nuovo (le cifre di sempre, come sempre)", false, /in attesa di pagamento|di prova non|Rimborsato|non contat/.test(tPrima));
    c("con soli ordini in attesa nel periodo la pagina li dice lo stesso, senza «NaN»", [true, false], [/1 ordine in attesa di pagamento/.test(testo(pano(O.normalizzaTutti([stripe(0xd1, "HG-D1", { stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, scade_il: FUTURO })]).ordini))), /NaN|undefined|Infinity/.test(tp)]);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}
