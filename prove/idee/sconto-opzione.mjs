/** ── PROVE: «SCONTO LEGATO A UN'OPZIONE» (commessa 2026-11-21-preventivo-sconto-opzione) ──
 *  Scegliendo un'opzione del preventivo (es. «Solo regione frontale») il totale scende di
 *  quanto dice il listino. Regola pura: src/shop/quote-menu.ts (`scontoOpzioni`), letta anche
 *  dal menu (`buildMenu`), dal listino (shop/listino-condiviso) e dalla stima in diretta.
 *  Dati inventati: nessun cliente vero. Il disegno (campo nel listino, riga nel riepilogo) si
 *  prova sul sorgente, perché la pagina non si può aprire dentro `npm test`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveScontoOpzione(mod, { c, gruppo, radice }) {
  const Q = mod["shop/quote-menu"];
  const L = mod["shop/listino-condiviso"];
  const V = mod["shop/vista-parallela"];
  const { scontoOpzioni, buildMenu } = Q;

  gruppo("SCONTO LEGATO A UN'OPZIONE");

  const frontale = { id: "zona-frontale", name: "Solo regione frontale" };
  const vertice = { id: "zona-vertice", name: "Solo vertice" };

  //  ── LA FUNZIONE PURA ────────────────────────────────────────────────────
  c("senza listino: nessuno sconto", 0, scontoOpzioni(undefined, [frontale], 1).totale);
  c("opzione scelta con sconto: scende dello sconto", 47.2,
    scontoOpzioni({ "zona-frontale": 47.2 }, [frontale], 1).totale);
  c("opzione NON scelta: nessuno sconto", 0,
    scontoOpzioni({ "zona-frontale": 47.2 }, [vertice], 1).totale);
  c("la riga dice quale opzione e quanto",
    [{ id: "zona-frontale", nome: "Solo regione frontale", eur: 47.2 }],
    scontoOpzioni({ "zona-frontale": 47.2 }, [frontale, vertice], 1).righe);
  c("due opzioni con sconto: si sommano", 57.2,
    scontoOpzioni({ "zona-frontale": 47.2, "zona-vertice": 10 }, [frontale, vertice], 1).totale);
  c("con 2 impianti lo sconto è per impianto", 94.4,
    scontoOpzioni({ "zona-frontale": 47.2 }, [frontale], 2).totale);
  c("i centesimi non sbavano (3 impianti)", 141.6,
    scontoOpzioni({ "zona-frontale": 47.2 }, [frontale], 3).totale);
  c("zero = nessuno sconto, e nessuna riga", 0,
    scontoOpzioni({ "zona-frontale": 0 }, [frontale], 1).righe.length);
  c("valori storti si scartano (testo, negativo, NaN)", 0,
    scontoOpzioni({ "zona-frontale": "47,20", "zona-vertice": -5, x: NaN }, [frontale, vertice], 1).totale);

  //  ── IL MENU LO PORTA CON SÉ ─────────────────────────────────────────────
  c("buildMenu: listino vecchio senza il campo", {}, buildMenu({ prices: { "zona-frontale": 50 } }).scontiOpzione);
  c("buildMenu: lo sconto salvato arriva al menu", { "zona-frontale": 47.2 },
    buildMenu({ scontiOpzione: { "zona-frontale": 47.2 } }).scontiOpzione);
  c("sconti spenti: niente sconto-opzione (si vende a prezzo pieno)", {},
    buildMenu({ upsellSconti: false, scontiOpzione: { "zona-frontale": 47.2 } }).scontiOpzione);
  c("una voce nascosta non porta sconto", {},
    buildMenu({ disabled: { "zona-frontale": true }, scontiOpzione: { "zona-frontale": 47.2 } }).scontiOpzione);

  //  ── IL LISTINO: SI SCRIVE CON LA VIRGOLA, SI SALVA, SI RILEGGE ───────────
  const voci = L.vociDaListino({});
  c("listino vecchio: il campo c'è ed è vuoto", "", voci["zona-frontale"].sconto);
  const bozza = { ...voci, "zona-frontale": { ...voci["zona-frontale"], sconto: "47,20" } };
  const scritto = L.listinoDaVoci(bozza);
  c("con la virgola: si salva 47,2", { "zona-frontale": 47.2 }, scritto.scontiOpzione);
  c("riletto torna «47,2»", "47,2", L.vociDaListino(scritto)["zona-frontale"].sconto);
  c("campo vuoto: non si scrive niente", {}, L.listinoDaVoci(voci).scontiOpzione);
  const racconto = L.vociModificate(voci, bozza, (n) => `${n} €`);
  c("il «prima → dopo» lo racconta",
    ["Sconto se scelta"], racconto.flatMap((m) => m.cambi.map((x) => x.campo)));
  c("una voce di base non ha il campo sconto", false,
    L.RIGHE.find((r) => r.id === "patch-standard").scontabile === true);
  c("una voce di sezione sì", true, L.RIGHE.find((r) => r.id === "zona-frontale").scontabile);

  //  ── IL TOTALE (preventivo tipo del pannello = stessa aritmetica della pagina) ──
  //  Invisible Derm 589 + «Solo regione frontale» 47,20 + installazione 70.
  const spuntata = { preselezionatePerBase: { "invisible-derm": { "zona-frontale": true } } };
  const senza = L.calcolaPreventivoTipo(spuntata, { auto: [], quantita: {} }, "invisible-derm", 1);
  const con = L.calcolaPreventivoTipo(
    { ...spuntata, scontiOpzione: { "zona-frontale": 47.2 } },
    { auto: [], quantita: {} }, "invisible-derm", 1);
  c("totale: l'opzione scelta toglie lo sconto", 47.2, senza.totale - con.totale);
  c("il lordo non cambia (lo sconto non è un prezzo)", senza.lordo, con.lordo);
  c("e c'è la riga «Sconto Solo regione frontale»", true,
    con.sconti.some((s) => s.nome === "Sconto Solo regione frontale" && Math.abs(s.eur - 47.2) < 0.005));
  const conCodice = L.calcolaPreventivoTipo(
    { ...spuntata, scontiOpzione: { "zona-frontale": 47.2 } },
    { auto: [{ code: "VIDEO", etichetta: null, eur: 100 }], quantita: {} }, "invisible-derm", 1);
  c("si somma con un codice sconto", 147.2, con.sconto + 100);
  c("…e il totale scende di entrambi", 147.2, senza.totale - conCodice.totale);
  const enorme = L.calcolaPreventivoTipo(
    { ...spuntata, scontiOpzione: { "zona-frontale": 99999 } },
    { auto: [{ code: "VIDEO", etichetta: null, eur: 100 }], quantita: {} }, "invisible-derm", 1);
  c("mai sotto zero", 0, enorme.totale);
  c("e lo sconto non supera il lordo", enorme.lordo, enorme.sconto);
  c("listino vecchio (senza campo): totale com'era", senza.totale,
    L.calcolaPreventivoTipo(spuntata, { auto: [], quantita: {} }, "invisible-derm", 1).totale);

  //  ── LA STIMA IN DIRETTA (vista parallela) ───────────────────────────────
  const menu = buildMenu({ scontiOpzione: { "zona-frontale": 47.2 } });
  const stato = (selected) => ({ baseId: "invisible-derm", selected, qty: 1, fitting: "remoto" });
  const stimaCon = V.schedaDelPreventivo(stato(["zona-frontale"]), menu).totale;
  const stimaSenza = V.schedaDelPreventivo(stato(["zona-frontale"]), buildMenu({})).totale;
  c("la stima in diretta scende dello sconto", 47.2, stimaSenza - stimaCon);

  //  ── IL SORGENTE: i punti che la prova non può eseguire ──────────────────
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const pagina = leggi("src/routes/preventivo.tsx");
  c("la pagina somma lo sconto-opzione agli altri", true,
    /scontoOpzioni\(menu\.scontiOpzione,\s*selectedItems,\s*qty\)/.test(pagina));
  c("il salvataggio server non scarta il campo", true,
    /scontiOpzione/.test(leggi("src/routes/api.presenter.pricing.ts")));
  c("il server scompone lo sconto salvato", true,
    /kind:\s*"opzione"/.test(leggi("src/routes/api.public.quote.ts")));
  //  ── «AZZERA SCONTI»: lo sconto-opzione non deve sopravvivere nella copia ──
  //   Il browser dichiara `reset` e il server ricopia le voci senza `scontoOpz`;
  //   altrimenti, azzerando e mettendo un codice >= sconto, la riapertura
  //   spiegherebbe il totale con una riga «Sconto <opzione>» che non c'è più.
  const revise = leggi("src/routes/api.presenter.quote-revise.ts");
  c("azzera: il browser lo dichiara al server", true,
    /\.\.\.\(azzera \? \{ reset: true \} : \{\}\)/.test(pagina));
  c("azzera: il server ricopia le voci senza scontoOpz", true,
    /b\.reset === true[\s\S]{0,200}scontoOpz/.test(revise));
  c("listino: uno sconto illeggibile blocca il salvataggio", true,
    /r\.scontabile[\s\S]{0,200}\.sconto/.test(leggi("src/shop/SettingsListino.tsx").split("const nonValide")[1].slice(0, 700)));
}
