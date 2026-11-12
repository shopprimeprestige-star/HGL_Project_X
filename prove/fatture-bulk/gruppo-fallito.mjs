/** ── FATTURE BULK · UN CLIENTE NON SPARISCE MAI ───────────────────────────
 *  Correzione di T14: un gruppo la cui lettura AI è fallita per intero (tre file `errore`, tipo vuoto) finiva
 *  fatto di soli «altro» e `ricomponi` lo scartava: nessuna riga, nessun «Rileggi», cliente mai fatturato né segnalato.
 *  Ora lo tiene se un suo file è fallito (`fallito`), e browser e server ricompongono allo stesso modo.
 *  Dati di fantasia. Il mondo finto è quello di T9 (`server.mjs`). */
import { AZIENDA, dip, mondo, richiesta, semina } from "./server.mjs";

const L = "lotto-0123abcd";
const I = "indirizzo", T = "tessera", P = "pagamento", A = "altro";
const sequenza = (tipi, da = 0, fallito = false) => tipi.map((tipo, k) => ({ indice: da + k, tipo, ...(fallito ? { fallito: true } : {}) }));

export async function prove(mod, { c, gruppo }) {
  const R = mod["fatture/bulk/raggruppa"];
  const B = mod["fatture/bulk/bulk.server"];
  const U = mod["fatture/bulk/usa-lotto"];

  gruppo("BULK · CLIENTE MAI PERSO · ricomponi");
  const tre = R.ricomponi(sequenza([A, A, A], 0, true));
  c("tre «altro» di un gruppo fallito → una riga (indici 0-1-2, nessun tipo valido, incompleta)", [1, "0000-0001-0002", [I, T, P], true],
    [tre.length, tre[0]?.idRiga, tre[0]?.mancano.slice().sort((a, b) => [I, T, P].indexOf(a) - [I, T, P].indexOf(b)), tre[0]?.incompleta]);
  c("senza file falliti i soli «altro» restano senza cliente (T2 invariato)", [], R.ricomponi(sequenza([A, A, A])));
  c("basta UN file fallito nel gruppo di soli «altro»", 1, R.ricomponi([{ indice: 0, tipo: A }, { indice: 1, tipo: A, fallito: true }, { indice: 2, tipo: A }]).length);
  const dieci = R.ricomponi([...sequenza([I, T, P], 0), ...sequenza([A, A, A], 3, true), ...sequenza([I, T, P], 6)]);
  c("un gruppo fallito in mezzo non sposta i clienti dopo: stessi idRiga, 3 righe", ["0000-0001-0002", "0003-0004-0005", "0006-0007-0008"], dieci.map((r) => r.idRiga));
  c("i clienti dopo restano al loro posto", [false, false, false], dieci.map((r) => r.ricomposta));

  gruppo("BULK · CLIENTE MAI PERSO · 10 clienti, un gruppo letto male, server e browser");
  const KO = { testo: "non è json", fine: "stop" };
  const normale = mondo().porte.ai;
  /** Un mondo il cui AI sbaglia alla chiamata `quale` (1-based) con una risposta senza JSON → `illeggibile`. */
  const conErrore = (quale) => {
    const w = mondo({ risposteAi: (immagini, n) => (n === quale ? KO : normale(immagini, 0)) });
    return w;
  };
  const ctx = (testata) => ({ lotto: testata, azienda: AZIENDA, oggi: "2026-11-12", emesse: [], bozze: [], schede: [], impronteAltriLotti: [] });
  const chiama = (w) => ({
    post: async (corpo) => {
      const r = await B.gestisciPOST(richiesta("POST", corpo), dip(w));
      return { stato: r.status, corpo: await r.json() };
    },
    get: async (query) => {
      const r = await B.gestisciGET(richiesta("GET", undefined, query), dip(w));
      return { stato: r.status, corpo: await r.json() };
    },
  });
  {
    const w = conErrore(5);
    semina(w, { n: 30 });
    const { post, get } = chiama(w);
    const esiti = [];
    for (let g = 0; g < 10; g += 1) esiti.push((await post({ azione: "leggi-gruppo", lotto: L, gruppo: g })).corpo.codice ?? "ok");
    c("la lettura del gruppo 4 fallisce, le altre 9 no", ["illeggibile", 9], [esiti[4], esiti.filter((e) => e === "ok").length]);

    const vedi = (det) => U.valutaIlLotto({ file: det.file, decisioni: Object.fromEntries(det.righe.map((r) => [r.idRiga, r])) }, ctx(det.testata));
    let d = (await get(`?lotto=${L}`)).corpo;
    c("sul server il gruppo 4 ha tre file in errore e tipo vuoto", [3, ["", "", ""]],
      [d.file.filter((f) => f.stato === "errore").length, d.file.filter((f) => f.stato === "errore").map((f) => f.tipo)]);

    const idErrore = "0012-0013-0014";
    let v = vedi(d);
    c("browser: 10 righe, una sola in «Errore» (la quinta)", [10, [idErrore]],
      [v.righe.length, v.righe.filter((r) => r.stato === "errore").map((r) => r.idRiga)]);
    c("… col motivo «lettura non riuscita» che manda a «Rileggi»", [true, true],
      (() => { const m = v.righe.find((r) => r.stato === "errore")?.motivi[0]; return [m?.codice === "lettura_fallita", /Rileggi/.test(m?.testo ?? "")]; })());
    c("il server conta 10 righe aperte (stessi clienti del browser)", 10, (await get("")).corpo[0].righeAperte);
    c("`gruppiDaLeggere` non rilegge da solo il gruppo in errore: il «Rileggi» è un gesto a pagamento", false,
      U.gruppiDaLeggere(d.file, new Set(), 30).includes(4));

    d = (await get(`?lotto=${L}`)).corpo;
    v = vedi(d);
    c("ricarica del lotto: sempre 10 righe, la quinta in «Errore» con lo stesso id", [10, idErrore], [v.righe.length, v.righe.find((r) => r.stato === "errore")?.idRiga]);

    const ri = await post({ azione: "rileggi", lotto: L, indici: [12, 13, 14] });
    c("«Rileggi» sul gruppo: tre file letti", [200, ["letto", "letto", "letto"]], [ri.stato, ri.corpo.file.map((f) => f.stato)]);
    v = vedi((await get(`?lotto=${L}`)).corpo);
    c("dopo «Rileggi» sempre 10 righe e nessuna in errore", [10, 0], [v.righe.length, v.righe.filter((r) => r.stato === "errore").length]);
  }

  gruppo("BULK · CLIENTE MAI PERSO · scartare la riga in errore");
  {
    const w = conErrore(2);
    semina(w, { n: 6 });
    const { post, get } = chiama(w);
    for (let g = 0; g < 2; g += 1) await post({ azione: "leggi-gruppo", lotto: L, gruppo: g });
    const id = "0003-0004-0005";
    const s = await post({ azione: "salva-riga", lotto: L, idRiga: id, scarta: true });
    c("«Scarta» sulla riga in errore è ammesso (prima: non_trovato)", [200, "scartata"], [s.stato, s.corpo.riga?.stato]);
    const d = (await get(`?lotto=${L}`)).corpo;
    const v = U.valutaIlLotto({ file: d.file, decisioni: Object.fromEntries(d.righe.map((r) => [r.idRiga, r])) }, ctx(d.testata));
    c("dopo lo scarto la riga resta nell'elenco come «scartata» (i file sono ormai ridotti, tipo vuoto)", [2, "scartata"],
      [v.righe.length, v.righe.find((r) => r.idRiga === id)?.stato]);
  }
}
