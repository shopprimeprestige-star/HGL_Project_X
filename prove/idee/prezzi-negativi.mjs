/** ── PROVE: «PREZZI NEGATIVI NEL LISTINO» (commessa 2026-11-21-listino-prezzi-negativi) ──
 *  Il titolare: «una cosa come prezzo è −300. Quando la seleziono toglie quella cifra, ma non è
 *  uno sconto: quel servizio costa meno». Quindi un'opzione di sezione può avere un prezzo
 *  negativo: si scrive nel campo Prezzo del listino, si mostra come prezzo («−300 €»), si somma
 *  al totale come ogni voce (× quantità). Non è GRATIS, non è barrato, non è uno sconto.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function provePrezziNegativi(mod, { c, gruppo, radice }) {
  const Q = mod["shop/quote-menu"];
  const L = mod["shop/listino-condiviso"];
  const V = mod["shop/vista-parallela"];
  const { buildMenu, etichettaPrezzoVoce } = Q;
  const formatta = (n) => `${n < 0 ? "-" : ""}${Math.abs(n).toFixed(2).replace(".", ",")} €`;

  gruppo("PREZZI NEGATIVI NEL LISTINO");

  //  ── SCRIVERE UN IMPORTO CON IL SEGNO ────────────────────────────────────
  c("«-300»", -300, L.prezzoDaTesto("-300"));
  c("«−300» col segno meno tipografico", -300, L.prezzoDaTesto("−300"));
  c("«–300» col trattino lungo", -300, L.prezzoDaTesto("–300"));
  c("«-47,20» con la virgola", -47.2, L.prezzoDaTesto("-47,20"));
  c("«- 300 €» con spazi e simbolo", -300, L.prezzoDaTesto("- 300 €"));
  c("«-1.250» con il punto delle migliaia", -1250, L.prezzoDaTesto("-1.250"));
  c("un prezzo positivo resta com'era", 164.67, L.prezzoDaTesto("164,67"));
  c("«-» da solo non è un importo", null, L.prezzoDaTesto("-"));
  c("testo qualunque non è un importo", null, L.prezzoDaTesto("abc"));
  c("vuoto non è un importo", null, L.prezzoDaTesto(""));
  c("lo stesso metro lo usa il server (numero)", -300, L.prezzoDaValore(-300));
  c("…e il server (testo con virgola e segno)", -47.2, L.prezzoDaValore("−47,20"));
  c("…e il server scarta il non numero", null, L.prezzoDaValore(Number.NaN));
  c("«numeroDaTesto» non cambia: gli altri campi restano ≥ 0", null, L.numeroDaTesto("-5"));

  //  ── SALVATO E RILETTO UGUALE (solo le opzioni delle sezioni) ─────────────
  const voci = L.vociDaListino({});
  const bozza = { ...voci, "zona-frontale": { ...voci["zona-frontale"], prezzo: "−300" } };
  const scritto = L.listinoDaVoci(bozza);
  c("si salva -300", -300, scritto.prices["zona-frontale"]);
  c("e si rilegge «-300»", "-300", L.vociDaListino(scritto)["zona-frontale"].prezzo);
  const conVirgola = L.listinoDaVoci({ ...voci, "zona-frontale": { ...voci["zona-frontale"], prezzo: "-47,20" } });
  c("con la virgola: -47,2", -47.2, conVirgola.prices["zona-frontale"]);
  const base = L.listinoDaVoci({ ...voci, "patch-standard": { ...voci["patch-standard"], prezzo: "-5" } });
  c("una soluzione base NON può essere negativa", undefined, base.prices["patch-standard"]);
  c("l'editor la segnala non valida", true,
    L.prezzoNonValido(L.RIGHE.find((r) => r.id === "patch-standard"), "-5"));
  c("l'opzione di sezione negativa è valida", false,
    L.prezzoNonValido(L.RIGHE.find((r) => r.id === "zona-frontale"), "-300"));
  c("un testo senza senso no", true,
    L.prezzoNonValido(L.RIGHE.find((r) => r.id === "zona-frontale"), "abc"));
  const racconto = L.vociModificate(voci, bozza, formatta);
  c("il «prima → dopo» racconta il prezzo negativo",
    "-300,00 €", racconto[0].cambi.find((x) => x.campo === "Prezzo").dopo);
  c("senza avvisi da «GRATIS»", undefined, racconto[0].cambi.find((x) => x.campo === "Prezzo").avviso);
  c("le voci non hanno più «Sconto se scelta»", false,
    L.RIGHE.some((r) => "scontabile" in r));

  //  ── IL MENU: PREZZO VERO, MAI BARRATO ───────────────────────────────────
  const voce = (menu) => menu.sections.flatMap((s) => s.items).find((i) => i.id === "zona-frontale");
  c("il menu porta -300", -300, voce(buildMenu({ prices: { "zona-frontale": -300 } })).price);
  c("senza barrato", undefined, voce(buildMenu({ prices: { "zona-frontale": -300 }, was: { "zona-frontale": 500 } })).wasPrice);
  c("a «sconti spenti» resta -300 (non diventa 500)", -300,
    voce(buildMenu({ upsellSconti: false, prices: { "zona-frontale": -300 }, was: { "zona-frontale": 500 } })).price);
  c("etichetta: «−300,00 €», senza il «+»", "−300,00 €", etichettaPrezzoVoce(-300, formatta));
  c("etichetta: positivo con il «+»", "+47,20 €", etichettaPrezzoVoce(47.2, formatta));
  c("etichetta: zero resta GRATIS", "GRATIS", etichettaPrezzoVoce(0, formatta));

  //  ── IL TOTALE (preventivo tipo = stessa aritmetica della pagina) ─────────
  //  Invisible Derm + «Solo regione frontale» spuntata + installazione.
  const sp = { preselezionatePerBase: { "invisible-derm": { "zona-frontale": true } } };
  const nessuno = { auto: [], quantita: {} };
  const di = (l, s = nessuno, q = 1) => L.calcolaPreventivoTipo(l, s, "invisible-derm", q);
  const positivo = di(sp);
  const negativo = di({ ...sp, prices: { "zona-frontale": -300 } });
  c("totale: l'opzione a -300 abbassa di 347,20", 347.2, positivo.totale - negativo.totale);
  c("è un prezzo, non uno sconto: nessuna riga di sconto", 0, negativo.sconti.length);
  c("e non è nel «lordo» come sconto: il lordo scende", 347.2, positivo.lordo - negativo.lordo);
  c("la voce c'è, a -300", -300, negativo.voci.find((v) => v.nome === "Solo regione frontale").eur);
  const due = di({ ...sp, prices: { "zona-frontale": -300 } }, nessuno, 2);
  const dueSenza = di(sp, nessuno, 2);
  c("× quantità: con 2 impianti scende di 694,40", 694.4, dueSenza.totale - due.totale);
  const conCodice = di({ ...sp, prices: { "zona-frontale": -300 } }, { auto: [{ code: "VIDEO", etichetta: null, eur: 100 }], quantita: {} });
  c("insieme a un codice: scendono entrambi", 447.2, positivo.totale - conCodice.totale);
  const enorme = di({ ...sp, prices: { "zona-frontale": -99999 } }, { auto: [{ code: "VIDEO", etichetta: null, eur: 100 }], quantita: {} });
  c("mai sotto zero", 0, enorme.totale);
  c("il lordo non va sotto zero", 0, enorme.lordo);
  c("lo sconto non diventa negativo", 0, enorme.sconto);

  //  ── LA STIMA IN DIRETTA ─────────────────────────────────────────────────
  const stato = (selected) => ({ baseId: "invisible-derm", selected, qty: 1, fitting: "remoto" });
  const stima = (prices) => V.schedaDelPreventivo(stato(["zona-frontale"]), buildMenu({ prices })).totale;
  c("la stima in diretta scende di 347,20", 347.2, stima({}) - stima({ "zona-frontale": -300 }));
  c("la stima non va sotto zero", 0, stima({ "zona-frontale": -99999 }));

  //  ── IL SORGENTE: i punti che la prova non può eseguire ──────────────────
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const pagina = leggi("src/routes/preventivo.tsx");
  c("la pagina scrive il prezzo con il segno giusto", true, /etichettaPrezzoVoce\(/.test(pagina));
  c("un prezzo negativo non è «barrato» nella pagina", true,
    /const discounted = price >= 0 && /.test(pagina));
  c("il lordo della pagina non scende sotto zero", true,
    /const gross = Math\.max\(0,/.test(pagina));
  c("il server legge il prezzo col segno", true,
    /prezzoDaValore\(/.test(leggi("src/routes/api.presenter.pricing.ts")));
  c("l'editor non mostra più il campo sconto", false,
    /Sconto se scelta/.test(leggi("src/shop/SettingsListino.tsx")));
  c("l'editor blocca il salvataggio con un prezzo non valido", true,
    /prezzoNonValido\(/.test(leggi("src/shop/SettingsListino.tsx")));
  c("la rotta aperta legge il listino di chi conduce", true,
    /rigaPulita\(grezza, negativoDi\)/.test(leggi("src/routes/api.public.quote-create.ts")));

  //  ── LA ROTTA APERTA NON CREDE A UN PREZZO NEGATIVO MANDATO DA FUORI ──────
  //   `quote-create` non ha credenziali: una voce inventata con un prezzo negativo
  //   abbasserebbe un preventivo a piacere. Il segno meno passa solo per le
  //   opzioni che il listino del proprietario dichiara negative, e vale la cifra
  //   del LISTINO.
  const R = mod["shop/riga-preventivo"];
  const menuNeg = buildMenu({ prices: { "zona-frontale": -300 } });
  const negativoDi = (nome) => {
    const v = Q.voceDiListino(nome, menuNeg);
    return v && v.price < 0 ? v.price : null;
  };
  const prezzi = (upsells, fn) =>
    R.rigaPulita({ nome: "Prova", upsells }, fn).riga.upsells.map((u) => u.price);
  c("senza listino raggiungibile: un negativo mandato diventa 0", [0],
    prezzi([{ name: "Solo regione frontale", price: -300 }]));
  c("voce inventata con prezzo negativo: resta ≥ 0", [0],
    prezzi([{ name: "Voce finta", price: -500 }], negativoDi));
  c("voce con il nome di un'opzione POSITIVA: resta ≥ 0", [0],
    prezzi([{ name: "Solo vertice", price: -500 }], negativoDi));
  c("opzione negativa a listino: vale il LISTINO, non il mandato (più basso)", [-300],
    prezzi([{ name: "Solo regione frontale", price: -9999 }], negativoDi));
  c("…né il mandato più alto o positivo", [-300],
    prezzi([{ name: "Solo regione frontale", price: 50 }], negativoDi));
  c("…con la sotto-scelta nel nome (come le salva la pagina)", [-300],
    prezzi([{ name: "Solo regione frontale \u2014 variante", price: 0 }], negativoDi));
  c("prezzi positivi normali: invariati", [47.2, 0],
    prezzi([{ name: "Solo vertice", price: 47.2 }, { name: "Altro", price: 0 }], negativoDi));
}
