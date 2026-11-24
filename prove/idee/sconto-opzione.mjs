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

  //  ── DAL 21/11 IL LISTINO NON HA PIÙ UN CAMPO «SCONTO»: SI SCRIVE UN PREZZO NEGATIVO ──
  //   (vedi prove/idee/prezzi-negativi.mjs). Quello che resta qui serve ai preventivi
  //   già emessi con lo sconto dentro la voce (`scontoOpz`): si leggono come prima.
  c("il menu non applica più lo sconto del listino", undefined,
    buildMenu({ scontiOpzione: { "zona-frontale": 47.2 } }).scontiOpzione);
  const voci = L.vociDaListino({ scontiOpzione: { "zona-frontale": 47.2 } });
  c("l'editor non ha più il campo sconto", false, "sconto" in voci["zona-frontale"]);
  c("il listino salvato non riscrive scontiOpzione", false,
    "scontiOpzione" in L.listinoDaVoci(voci));
  c("il preventivo tipo ignora uno sconto-opzione vecchio", 0,
    L.calcolaPreventivoTipo(
      { preselezionatePerBase: { "invisible-derm": { "zona-frontale": true } }, scontiOpzione: { "zona-frontale": 47.2 } },
      { auto: [], quantita: {} }, "invisible-derm", 1).sconti.length);

  //  ── IL SORGENTE: i punti che la prova non può eseguire ──────────────────
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const pagina = leggi("src/routes/preventivo.tsx");
  c("la pagina non somma più lo sconto del listino", false,
    /scontoOpzioni\(/.test(pagina));
  c("il server legge ancora lo sconto dei preventivi emessi", true,
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
}
