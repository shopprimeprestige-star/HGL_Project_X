/** ── E-COMMERCE · T11 · LA PAGINA «E-commerce», LA VOCE DI MENU, IL PERMESSO ───
 *  `src/crm/ecommerce/pagina.ts` (puro: periodo e indirizzo della pagina), `Panoramica.tsx`, `ElencoOrdini.tsx`,
 *  `src/routes/CRM.ecommerce.tsx` (il guscio), la riga di `permessi.ts` e la voce di `CRMSidebar.tsx`.
 *  Le parti pure si provano con i moduli impacchettati; le schermate si disegnano sul serio con `react-dom/server`
 *  (stesso esbuild del resto delle prove) su ordini inventati (`dati.mjs`), niente rete, niente database.
 *  Gli istanti sono costruiti in ORA LOCALE (come il filtro periodo del CRM): stesso esito in ogni fuso. */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";
import { rigaOrdineProva } from "./dati.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const O = mod["ecommerce/ordine"];
  const K = mod["ecommerce/conti"];
  const PG = mod["ecommerce/pagina"];
  const PRM = mod["permessi"];
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  /** Il testo senza commenti: le prove sul codice non devono farsi ingannare dalle spiegazioni. */
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");

  gruppo("E-COMMERCE · LA PAGINA, LA VOCE DI MENU, IL PERMESSO (18/11/2026)");

  // ── aiuti ──
  const loc = (a, m, g, h = 12, mi = 0, s = 0) => new Date(a, m - 1, g, h, mi, s).toISOString();
  let seq = 0;
  const ord = (extra = {}) => {
    seq++;
    return O.normalizzaOrdine(rigaOrdineProva({
      id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
      order_ref: `HG-U${seq}`,
      nome: `Cliente${seq}`,
      telefono: `+39 300 200 ${String(1000 + seq)}`,
      email: `cliente${seq}@example.com`,
      created_at: loc(2026, 11, 10),
      ...extra,
    }));
  };

  // ── il permesso della pagina (PIANO T11, SPEC §9.2) ──
  c("«/CRM/ecommerce» vuole «pagamenti»", "pagamenti", PRM.permessoDiPagina("/CRM/ecommerce"));
  c("anche con la barra finale e con un sotto-percorso", ["pagamenti", "pagamenti"], [PRM.permessoDiPagina("/CRM/ecommerce/"), PRM.permessoDiPagina("/CRM/ecommerce/x")]);
  c("un indirizzo che comincia uguale ma è un'altra pagina NON eredita il permesso", null, PRM.permessoDiPagina("/CRM/ecommerce-x"));
  c("il setter non ha «pagamenti» (SPEC §10.2: i setter non la vedono)", false, PRM.PERMESSI_RUOLO.setter.includes("pagamenti"));
  c("un consulente (livello e mestiere) sì: documenta il perimetro scelto", [true, true], [PRM.PERMESSI_RUOLO.consulente.includes("pagamenti"), PRM.PERMESSI_MESTIERE.faConsulente.includes("pagamenti")]);
  c("chi fa solo il setter, con i mestieri, non la ha", false, PRM.permessiDeiMestieri({ faSetter: true }).includes("pagamenti"));
  c("l'admin ha tutto, quindi anche questa", true, PRM.PERMESSI_RUOLO.admin.includes("pagamenti"));

  // ── il periodo: dal filtro del CRM ai giorni dei conti ──
  const adesso = new Date(2026, 10, 18, 15, 0, 0);
  c("di partenza: gli ultimi 30 giorni, come il bottone «30g» del filtro", { from: "2026-10-20", to: "2026-11-18" }, PG.rangeDiPartenza(adesso));
  c("estremi su giorni locali anche a mezzanotte e un minuto", { from: "2026-10-20", to: "2026-11-18" }, PG.rangeDiPartenza(new Date(2026, 10, 18, 0, 1)));
  const tre = [ord({ created_at: loc(2026, 3, 2, 0, 30) }), ord({ created_at: loc(2026, 11, 10, 23, 59, 59) })];
  c("da…a: i due giorni scelti", { da: "2026-11-01", a: "2026-11-10" }, PG.periodoDaRange({ from: "2026-11-01", to: "2026-11-10" }, tre, adesso));
  c("solo «Da» = un giorno solo", { da: "2026-11-05", a: "2026-11-05" }, PG.periodoDaRange({ from: "2026-11-05", to: null }, tre, adesso));
  c("solo «A» = un giorno solo, NON «fino a» (come rangeBoundsAsDates)", { da: "2026-11-05", a: "2026-11-05" }, PG.periodoDaRange({ from: null, to: "2026-11-05" }, tre, adesso));
  c("stesso risultato di rangeBoundsAsDates del filtro (testo)", true, /from \|\| to|range\.from \|\| range\.to/.test(senzaCommenti(leggi("src/crm/ecommerce/pagina.ts"))));
  c("capovolto resta capovolto (nessun ordine dentro, la pagina lo dice)", { da: "2026-11-10", a: "2026-11-01" }, PG.periodoDaRange({ from: "2026-11-10", to: "2026-11-01" }, tre, adesso));
  const tutto = PG.periodoDaRange({ from: null, to: null }, tre, adesso);
  c("«Tutto»: dal giorno del primo ordine (00:30 locale = il suo giorno) a oggi, nessuna data inventata", { da: "2026-03-02", a: "2026-11-18" }, tutto);
  c("«Tutto» comprende ogni ordine, anche l'ultimo secondo del giorno", [true, true], tre.map((o) => K.nelPeriodo(o, tutto)));
  c("«Tutto» comprende un ordine con la data nel futuro", { da: "2026-03-02", a: "2026-12-24" }, PG.periodoDaRange({ from: null, to: null }, [...tre, ord({ created_at: loc(2026, 12, 24, 9) })], adesso));
  c("«Tutto» senza ordini: solo oggi (niente 3660 giorni di grafico)", { da: "2026-11-18", a: "2026-11-18" }, PG.periodoDaRange({ from: null, to: null }, [], adesso));
  c("«Tutto» ignora le date illeggibili", { da: "2026-11-10", a: "2026-11-18" }, PG.periodoDaRange({ from: null, to: null }, [{ creatoIl: "boh" }, ord({ created_at: loc(2026, 11, 10) })], adesso));
  c("l'andamento di «Tutto» parte dal primo ordine, non da 3660 giorni fa", 262, K.andamento(tre, tutto).length);

  c("euro: centesimi sempre, migliaia col punto (dalle cinque cifre, come in italiano), mai NaN", ["€ 73,33", "€ 12.345,50", "€ 0,00", "€ 0,00"], [PG.euro(73.333), PG.euro(12345.5), PG.euro(0), PG.euro(NaN)]);

  // ── l'indirizzo: ?scheda=…&stato=…&ordine=… ──
  c("indirizzo vuoto: Panoramica, niente filtri", {}, PG.leggiRicerca({}));
  c("scheda ordini con uno stato (il clic su «Spedito» della Panoramica)", { scheda: "ordini", stato: "spedito" }, PG.leggiRicerca({ scheda: "ordini", stato: "spedito" }));
  c("valori che non conosciamo si scartano (scheda futura, stato inventato, oggetti)", {}, PG.leggiRicerca({ scheda: "clienti", stato: "rotto", ordine: { x: 1 } }));
  c("«panoramica» esplicita = la scheda di partenza, indirizzo pulito", {}, PG.leggiRicerca({ scheda: "panoramica" }));
  c("l'ordine aperto: solo testo non vuoto e corto", [{ ordine: "abc" }, {}, {}], [PG.leggiRicerca({ ordine: "abc" }), PG.leggiRicerca({ ordine: "" }), PG.leggiRicerca({ ordine: "x".repeat(101) })]);
  c("i numeri nell'indirizzo non fanno danno", {}, PG.leggiRicerca({ scheda: 3, stato: 1, ordine: 7 }));

  // ── la voce di menu (sul testo: il componente non si carica senza React) ──
  const barra = leggi("src/crm/CRMSidebar.tsx");
  const barraNuda = senzaCommenti(barra);
  const iVoce = barraNuda.indexOf('titolo: "E-commerce"');
  const voce = iVoce < 0 ? "" : barraNuda.slice(iVoce, barraNuda.indexOf("\n      },", iVoce));
  c("la voce «E-commerce» esiste", true, iVoce > 0);
  c("va a /CRM/ecommerce, per chi ha «pagamenti» e lo schema «leads»", [true, true, true], [/url: "\/CRM\/ecommerce"/.test(voce), /permesso: "pagamenti"/.test(voce), /scheme: "leads"/.test(voce)]);
  c("accende il numeretto «ecommerce_nuovi»", true, /badge: "ecommerce_nuovi"/.test(voce));
  const iFatture = barraNuda.indexOf('titolo: "Fatture"');
  c("sta nel gruppo «Strumenti», subito dopo «Fatture»", [true, 0, 1], [iFatture > barraNuda.indexOf('titolo: "Strumenti"') && iFatture < iVoce, (barraNuda.slice(iFatture + 10, iVoce).match(/titolo: "/g) || []).length, (barraNuda.slice(barraNuda.indexOf('titolo: "Strumenti"'), iVoce).match(/voci: \[/g) || []).length]);
  c("la chiave del numeretto è fra quelle ammesse", true, /ChiaveBadgeMenu = ChiaveConteggio \| "wa_da_rispondere" \| "ecommerce_nuovi"/.test(barraNuda));
  c("il conto si legge SOLO se la voce si vede (stessa condizione della chat)", true, /useOrdiniNuovi\(vedeEcommerce\)/.test(barraNuda) && /const vedeEcommerce =[^;]*puoVedere\(/.test(barraNuda) && /canAccess\(/.test(barraNuda.slice(barraNuda.indexOf("const vedeEcommerce"), barraNuda.indexOf("const vedeEcommerce") + 200)));
  c("e nessun altro punto lo chiama con un valore fisso", 1, (barraNuda.match(/useOrdiniNuovi\(/g) || []).length);
  c("senza voce visibile il numero è 0: il valore vecchio non si vede (nota 4 del revisore T10)", true, /n:\s*vedeEcommerce \? \(?ordiniNuovi \?\? 0\)? : 0/.test(barraNuda));
  c("è rosa (urgenza «ritardo») e il titolo dice «da lavorare»", true, /ecommerce_nuovi: \{[\s\S]{0,400}urgenza: "ritardo"[\s\S]{0,400}da lavorare/.test(barraNuda));
  c("niente nuovo `console.*` nella barra per questa voce", false, /console\.[a-z]+\([^)]*[Oo]rdin/.test(barraNuda));

  // ── il guscio della pagina ──
  const guscioT = leggi("src/routes/CRM.ecommerce.tsx");
  const guscio = senzaCommenti(guscioT);
  c("la rotta è /CRM/ecommerce e legge ?scheda= con leggiRicerca", true, /createFileRoute\("\/CRM\/ecommerce"\)/.test(guscio) && /validateSearch[^\n]*leggiRicerca/.test(guscio));
  c("gli ordini si leggono UNA volta, nel guscio (useOrdini)", 1, (guscio.match(/useOrdini\(\)/g) || []).length);
  c("niente supabase nel guscio, nelle schede e nei conti: gli ordini passano solo dalla rotta", [false, false, false], ["src/routes/CRM.ecommerce.tsx", "src/crm/ecommerce/Panoramica.tsx", "src/crm/ecommerce/ElencoOrdini.tsx"].map((f) => /@\/integrations\/supabase|createClient|\.from\(["']/.test(senzaCommenti(leggi(f)))));
  c("il periodo parte da rangeDiPartenza e passa da periodoDaRange (mai rangeMatch sugli ordini)", [true, true, false], [/rangeDiPartenza\(/.test(guscio), /periodoDaRange\(/.test(guscio), /rangeMatch/.test(guscio)]);
  c("usa il filtro del CRM", true, /<DateRangeFilter/.test(guscio));
  c("con errore di permesso o di sessione la lista NON si mostra: si esce prima di disegnare le schede (nota 3 del revisore T10)", [true, true], [
    /const bloccato = lettura\.errore\?\.tipo === "permesso" \|\| lettura\.errore\?\.tipo === "sessione"/.test(guscio),
    guscio.indexOf("if (bloccato") > 0 && guscio.indexOf("if (bloccato") < guscio.indexOf("<Panoramica") && guscio.indexOf("if (bloccato") < guscio.indexOf("<ElencoOrdini"),
  ]);
  c("avviso fisso se la migrazione manca", true, /migrazionePronta === false/.test(guscio));
  c("dichiara le righe non leggibili (scartati)", true, /scartati > 0/.test(guscio) && /non si (possono|può) leggere/.test(guscioT));
  c("dichiara il tetto di lettura (troncato)", true, /troncato/.test(guscio));
  c("errore di lettura: «Riprova» e, se i dati ci sono, avviso piccolo", true, /Riprova/.test(guscio) && /aggiorna\(\)/.test(guscio));
  c("«ultimo aggiornamento hh:mm» e tasto «Aggiorna»", true, /oraHHmm\(/.test(guscio) && /Aggiorna/.test(guscio));
  c("passa la migrazione e le azioni alla scheda Ordini (per T12)", true, /migrazionePronta/.test(guscio) && /<ElencoOrdini/.test(guscio));
  c("nessun log, nessuna parola «elimina» nella pagina", [false, false], [/console\./.test(guscio), /elimin|cancell|delete/i.test(guscio)]);

  // ── la Panoramica: onesta nelle etichette, senza rifare i conti ──
  const panT = leggi("src/crm/ecommerce/Panoramica.tsx");
  const pan = senzaCommenti(panT);
  c("la Panoramica usa i conti di T4, tutti", [true, true, true, true, true], ["panoramica(", "ordiniFermi(", "andamento(", "piuVenduti(", "riacquisto("].map((f) => pan.includes(f)));
  c("e non ne rifà nessuno (niente reduce, niente somme a mano)", [false, false], [/\.reduce\(/.test(pan), /\+= /.test(pan)]);
  c("etichetta onesta: «Hanno ordinato più di una volta», mai «clienti di ritorno»", [true, false], [/Hanno ordinato più di una volta/.test(panT), /clienti di ritorno/i.test(pan)]);
  c("«Incassato» dice che sono gli ordini del periodo risultati pagati", true, /ordini del periodo risultati pagati/i.test(panT));
  c("dichiara gli importi fuori norma (importiAnomali)", true, /importiAnomali/.test(pan));
  c("«di cui N annullati» nell'incassato", true, /annullatiPagati/.test(pan) && /di cui/.test(panT));
  c("i clienti che ricomprano si riconoscono da telefono ed email, senza schede (R2)", true, /telefono ed email/i.test(panT));
  c("riacquisto riceve TUTTI gli ordini, non quelli già filtrati (condizione 3 del revisore T4)", true, /riacquisto\(lettura\.ordini,|riacquisto\(ordini,/.test(pan));
  c("clic su uno stato = scheda Ordini filtrata", true, /apriStato\(/.test(pan));
  c("l'andamento mostrato è corto, dichiarato come scorciatoia", true, /shortcut:/.test(panT));

  // ── le schermate disegnate sul serio ──
  const dove = mkdtempSync(join(tmpdir(), "pagina-"));
  try {
    const req = createRequire(join(radice, "package.json"));
    //  react e react-dom restano QUELLI DEL PROGETTO (stesso file, stessa istanza): due copie non si parlano e gli hook si rompono.
    const reactDelProgetto = { name: "react-del-progetto", setup(b) {
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({ path: req.resolve(a.path), external: true }));
    } };
    const tsx = async (entrata, nome) => {
      await build({ entryPoints: [join(radice, entrata)], bundle: true, platform: "node", format: "cjs", outfile: join(dove, `${nome}.cjs`),
        loader: { ".tsx": "tsx", ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".webp": "dataurl" }, alias: { "@": join(radice, "src") },
        plugins: [reactDelProgetto], logLevel: "silent", jsx: "automatic" });
      return createRequire(import.meta.url)(join(dove, `${nome}.cjs`));
    };
    const { createElement: h } = req("react");
    const { renderToStaticMarkup } = req("react-dom/server");
    const { Panoramica } = await tsx("src/crm/ecommerce/Panoramica.tsx", "panoramica");
    const { ElencoOrdini } = await tsx("src/crm/ecommerce/ElencoOrdini.tsx", "elenco");
    const adessoR = new Date(2026, 10, 18, 15, 0, 0);
    const P = { da: "2026-11-10", a: "2026-11-12" };
    const lettura = (ordini, extra = {}) => ({ ordini, caricato: true, inCaricamento: false, inAggiornamento: false, errore: null, scartati: 0, troncato: false, migrazionePronta: true, ultimoAggiornamento: 0, ...extra });
    const voce2 = (nome, prezzo, qty = 1, extra = {}) => ({ product_id: nome.toLowerCase().replace(/\W+/g, "-"), name: nome, slug: nome.toLowerCase(), qty, unit_price: prezzo, variant: null, ...extra });
    const disegna = (ordini, extra = {}, periodo = P, apriStato = () => {}) =>
      renderToStaticMarkup(h(Panoramica, { lettura: lettura(ordini, extra), periodo, adesso: adessoR, apriStato }));
    const testo = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

    // sei ordini finti: A nuovo 100 | B spedito 50 pagato | C annullato 30 | D annullato 20 pagato | E consegnato 70 pagato | F fuori periodo
    const A = ord({ total: 100, subtotal: 100, shipping: 0, status: "nuovo", created_at: loc(2026, 11, 10), items: [voce2("Patch classica", 50, 2)] });
    const B = ord({ total: 50, subtotal: 50, shipping: 0, status: "spedito", pagato_il: loc(2026, 11, 11), pagato_importo: 50, items: [voce2("Patch classica", 50, 1, { variant: "Beige" })] });
    const C = ord({ total: 30, subtotal: 30, shipping: 0, status: "annullato", items: [voce2("Cura", 30)] });
    const D = ord({ total: 20, subtotal: 20, shipping: 0, status: "annullato", pagato_il: loc(2026, 11, 11), pagato_importo: 20, items: [voce2("Cura", 20)] });
    const E = ord({ total: 70, subtotal: 70, shipping: 0, status: "consegnato", pagato_il: loc(2026, 11, 11), items: [voce2("Cura", 35, 2)] });
    const F = ord({ total: 999, subtotal: 999, shipping: 0, status: "nuovo", created_at: loc(2026, 11, 20), items: [voce2("Altro", 999)] });
    const cifre = K.panoramica([A, B, C, D, E, F], P);

    const html = disegna([A, B, C, D, E, F]);
    const t = testo(html);
    c("(prova di sanità) le cifre di riferimento sono quelle attese", [3, 220, 140, 3, 1, 1], [cifre.ordini.n, cifre.ordini.totale, cifre.incassato.importo, cifre.incassato.n, cifre.daIncassare.n, cifre.annullatiPagati]);
    c("le cifre in pagina sono quelle di conti.ts, non altre", true, t.includes("140") && /Incassato/.test(t) && /Da incassare/.test(t));
    c("ordini nel periodo: 3 (gli annullati sono esclusi) e valore medio", true, /Ordini[^0-9]{0,40}3\b/.test(t) && /73,33/.test(t));
    c("incassato: «di cui 1 annullato» (la cifra coincide con le righe «pagato = sì»)", true, /di cui 1 annullat/.test(t));
    c("ordini per stato: i cinque stati col loro numero", [true, true], [["Nuovo", "In preparazione", "Spedito", "Consegnato", "Annullato"].every((s) => t.includes(s)), /Annullato[^0-9]{0,20}2\b/.test(t)]);
    c("la prima riga dei più venduti è la patch, con 3 pezzi", true, /Patch classica[^A-Za-z]{0,60}3/.test(t));
    c("più venduti: la variante si apre dalla riga (details/summary, senza script)", true, /<details/.test(html) && /Beige/.test(t));
    c("ordine fuori periodo: non è nelle cifre ma è «nuovo» di sempre", true, !t.includes("999"));
    c("niente «NaN», «undefined» o «Infinity» in pagina", false, /NaN|undefined|Infinity|\[object/.test(t));

    // periodo vuoto con ordini presenti
    const vuoto = testo(disegna([A, B, C, D, E, F], {}, { da: "2026-01-01", a: "2026-01-02" }));
    c("periodo senza ordini: lo dice e suggerisce di cambiare periodo", true, /Nessun ordine in questo periodo/.test(vuoto) && /periodo/.test(vuoto));
    c("…senza «NaN» e senza grafici vuoti", false, /NaN|undefined|Infinity/.test(vuoto));
    // nessun ordine in assoluto
    const zero = testo(disegna([]));
    c("nessun ordine in tabella: stato vuoto chiaro e cifre a zero", true, /Nessun ordine/.test(zero) && !/NaN|undefined|Infinity/.test(zero));

    // fermi: nuovi da più di 48 ore, anche fuori periodo
    const fermo = ord({ status: "nuovo", created_at: loc(2026, 11, 14), total: 10, subtotal: 10, shipping: 0 });
    const conFermi = testo(disegna([fermo]));
    c("ordini fermi: l'ordine nuovo da 4 giorni compare anche se il periodo è un altro", true, /fermi/i.test(conFermi) && /HG-U/.test(conFermi));
    const senzaFermi = testo(disegna([ord({ status: "nuovo", created_at: loc(2026, 11, 18, 10) })]));
    c("un ordine di stamattina non è fermo", true, /Nessun ordine fermo/i.test(senzaFermi));

    // importi assurdi e righe vuote non rompono la pagina e vengono dichiarati
    const strano = [ord({ total: -50, subtotal: -50, shipping: 0, status: "consegnato" }), ord({ total: 1e300, subtotal: 1e300, shipping: 0, status: "consegnato" }), ord({ items: [], total: 0, subtotal: 0, status: "consegnato" })];
    const ts = testo(disegna(strano));
    c("importi negativi/enormi: pagina intera e avviso «2 ordini del periodo hanno un importo fuori norma»", true, /2 ordini del periodo hanno un importo fuori norma/.test(ts) && !/NaN|undefined|Infinity|e\+/.test(ts));

    // riacquisto
    const r1 = ord({ telefono: "+39 300 000 0042", email: "a@example.com", nome: "Anna", cognome: "Repetita", created_at: loc(2026, 11, 10), total: 20, subtotal: 20, shipping: 0 });
    const r2 = ord({ telefono: "0039 300 000 0042", email: "A@Example.com ", nome: "Anna", cognome: "Repetita", created_at: loc(2026, 11, 11), total: 30, subtotal: 30, shipping: 0 });
    const tr = testo(disegna([r1, r2, ord({ created_at: loc(2026, 11, 12) })]));
    c("«Hanno ordinato più di una volta»: Anna con due ordini (telefono scritto in due modi)", true, /Hanno ordinato più di una volta/.test(tr) && /Anna Repetita/.test(tr) && /1 su 2|1 di 2|50 ?%/.test(tr));
    // il clic su uno stato
    const clic = [];
    const x = renderToStaticMarkup(h(Panoramica, { lettura: lettura([A]), periodo: P, adesso: adessoR, apriStato: (s) => clic.push(s) }));
    c("ogni stato è un pulsante vero (accessibile da tastiera)", true, /<button[^>]*>[\s\S]{0,300}Spedito/.test(x));

    // la scheda Ordini (segnaposto in R2): conta le stesse righe della Panoramica
    const el = testo(renderToStaticMarkup(h(ElencoOrdini, { lettura: lettura([A, B, C, D, E, F]), periodo: P, stato: "annullato", migrazionePronta: true })));
    c("la scheda Ordini filtrata per stato dice quante righe ha: 2 annullati, come la Panoramica", true, /2/.test(el) && /Annullat/.test(el));
    const nonRotto = testo(renderToStaticMarkup(h(ElencoOrdini, { lettura: lettura([A]), periodo: P, migrazionePronta: false })));
    c("senza filtro e con la migrazione mancante non si rompe", false, /NaN|undefined|Infinity/.test(nonRotto));
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}
