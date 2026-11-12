/** ── FATTURE BULK · T2 · RAGGRUPPAMENTO E RICOMPOSIZIONE ───────────────────
 *  `ordinaFile`, `contaGruppi`, `ricomponi` (PIANO §5 T2, SPEC §6.1 e §6.3).
 *  ⚠️ Dati inventati: qui contano solo i TIPI dei file, non c'è nessun dato
 *  di persona. La funzione lavora sul solo `tipo` perché è l'unica cosa che
 *  sopravvive alla pulizia dei dati (D11b). */
import { LOTTO_PROVA } from "./dati.mjs";

const I = "indirizzo", T = "tessera", P = "pagamento", A = "altro";

/** n file di tipo dato in sequenza, indici da `da`. */
const sequenza = (tipi, da = 0) => tipi.map((tipo, k) => ({ indice: da + k, tipo }));
/** k clienti regolari (indirizzo, tessera, pagamento). */
const regolari = (k) => sequenza(Array.from({ length: k * 3 }, (_, i) => [I, T, P][i % 3]));
const riassunto = (g) => g.map((r) => ({ id: r.idRiga, n: r.numero, ric: r.ricomposta, inc: r.incompleta, ord: r.ordineDiverso, manca: r.mancano }));

export async function prove(mod, { c, gruppo }) {
  const R = mod["fatture/bulk/raggruppa"];
  const K = mod["fatture/bulk/chiavi"];

  gruppo("BULK · T2 · ORDINE DEI FILE");
  const nomi = (a) => a.map((f) => f.nome);
  const f = (nome, modificatoIl = 0) => ({ nome, modificatoIl });
  c("naturale: «Screenshot 2» prima di «Screenshot 10»", ["Screenshot 2.png", "Screenshot 10.png", "Screenshot 11.png"],
    nomi(R.ordinaFile([f("Screenshot 10.png"), f("Screenshot 11.png"), f("Screenshot 2.png")], "nome")));
  c("naturale: le maiuscole non contano, i numeri sì", ["a2", "B10", "c1"].sort(), nomi(R.ordinaFile([f("c1"), f("B10"), f("a2")], "nome")).sort());
  c("per nome, a parità di nome vale la data del file", [1, 5], R.ordinaFile([f("x", 5), f("x", 1)], "nome").map((v) => v.modificatoIl));
  c("per data: prima la più vecchia", ["b", "a"], nomi(R.ordinaFile([f("a", 20), f("b", 10)], "data")));
  c("per data, a parità di data vale il nome naturale", ["s2", "s10"], nomi(R.ordinaFile([f("s10", 7), f("s2", 7)], "data")));
  c("nome e data danno ordini diversi quando devono", [["b", "a"], ["a", "b"]],
    [nomi(R.ordinaFile([f("a", 9), f("b", 1)], "data")), nomi(R.ordinaFile([f("b", 1), f("a", 9)], "nome"))]);
  const originale = [f("b", 2), f("a", 1)];
  const copia = JSON.stringify(originale);
  R.ordinaFile(originale, "nome");
  c("non muta l'input", copia, JSON.stringify(originale));
  c("restituisce gli stessi oggetti (le altre proprietà restano)", true,
    (() => { const x = { nome: "q", modificatoIl: 1, file: "F" }; return R.ordinaFile([x], "nome")[0] === x; })());
  c("elenco vuoto", [], R.ordinaFile([], "nome"));

  gruppo("BULK · T2 · QUANTI CLIENTI");
  c("300 file → 100 clienti, niente in più", { file: 300, gruppiCompleti: 100, fileInPiu: 0, clienti: 100, oltreIlLimite: false }, R.contaGruppi(300));
  c("301 file → 100 gruppi completi + 1 file in più", { file: 301, gruppiCompleti: 100, fileInPiu: 1, clienti: 100, oltreIlLimite: false }, R.contaGruppi(301));
  c("302 file → 2 file in più", [100, 2], [R.contaGruppi(302).gruppiCompleti, R.contaGruppi(302).fileInPiu]);
  c("600 file (il tetto) passano", [200, false], [R.contaGruppi(600).clienti, R.contaGruppi(600).oltreIlLimite]);
  c("601 file → da rifiutare", true, R.contaGruppi(601).oltreIlLimite);
  c("il tetto è quello di chiavi.ts", [K.MAX_FILE, false, true], [600, R.contaGruppi(K.MAX_FILE).oltreIlLimite, R.contaGruppi(K.MAX_FILE + 1).oltreIlLimite]);
  c("0 file → 0 clienti", [0, 0, 0], [R.contaGruppi(0).clienti, R.contaGruppi(0).fileInPiu, R.contaGruppi(0).gruppiCompleti]);
  c("un conteggio impossibile (negativo, con la virgola, NaN) è un errore, non un numero", [true, true, true],
    [-1, 2.5, NaN].map((n) => { try { R.contaGruppi(n); return false; } catch { return true; } }));

  gruppo("BULK · T2 · RICOMPOSIZIONE: IL CASO REGOLARE");
  const cento = R.ricomponi(regolari(100));
  c("300 file regolari → 100 righe, in ordine di caricamento", [100, 1, 100], [cento.length, cento[0].numero, cento[99].numero]);
  c("la prima riga è dei primi 3 file; la centesima degli ultimi 3", [[0, 1, 2], [297, 298, 299]], [cento[0].indici, cento[99].indici]);
  c("l'id della riga viene da idRigaDa", ["0000-0001-0002", "0297-0298-0299"], [cento[0].idRiga, cento[99].idRiga]);
  c("nessuna riga ricomposta, incompleta o in ordine diverso", [], cento.filter((r) => r.ricomposta || r.incompleta || r.ordineDiverso || r.mancano.length));
  c("i tipi presenti sono nell'ordine dei file", [I, T, P], cento[42].tipi);
  c("il numero è 1-based e consecutivo", true, cento.every((r, k) => r.numero === k + 1));
  c("nessun file in due righe", 300, new Set(cento.flatMap((r) => r.indici)).size);

  gruppo("BULK · T2 · TRE FILE IN ORDINE DIVERSO");
  const girato = R.ricomponi(sequenza([P, T, I]));
  c("pagamento/tessera/indirizzo → una riga, letta, con ordineDiverso", [1, true, false, false, true],
    [girato.length, girato[0].ordineDiverso, girato[0].incompleta, girato[0].ricomposta, girato[0].mancano.length === 0]);
  c("tutte le sei permutazioni tengono insieme i tre file; solo la normale non ha ordineDiverso",
    { "indirizzo,tessera,pagamento": false, "indirizzo,pagamento,tessera": true, "tessera,indirizzo,pagamento": true,
      "tessera,pagamento,indirizzo": true, "pagamento,indirizzo,tessera": true, "pagamento,tessera,indirizzo": true },
    Object.fromEntries([[I, T, P], [I, P, T], [T, I, P], [T, P, I], [P, I, T], [P, T, I]].map((s) => {
      const r = R.ricomponi(sequenza(s));
      return [s.join(","), r.length === 1 && r[0].indici.length === 3 ? r[0].ordineDiverso : "NO"];
    })));
  const mista = R.ricomponi([...regolari(2), ...sequenza([P, I, T], 6), ...regolari(1).map((x) => ({ ...x, indice: x.indice + 9 }))]);
  c("un ordine diverso in mezzo a gruppi regolari tocca solo quella riga", [false, false, true, false], mista.map((r) => r.ordineDiverso));

  gruppo("BULK · T2 · UN FILE MANCANTE: LA RICOMPOSIZIONE PER TIPI");
  // 299 file: manca la tessera del cliente 51 (indici 150 indirizzo, 151 tessera, 152 pagamento).
  // Un file mancante NON lascia un buco negli indici: quelli dopo scalano di uno (0..298).
  const senza = regolari(100).filter((x) => x.indice !== 151).map((x, k) => ({ ...x, indice: k }));
  const r299 = R.ricomponi(senza);
  c("299 file → 100 righe (nessun cliente perso)", 100, r299.length);
  c("fino al buco le righe sono regolari", true, r299.slice(0, 50).every((r) => !r.ricomposta && !r.incompleta));
  c("la riga senza tessera è incompleta e dice cosa manca", [true, [T], [150, 151]], [r299[50].incompleta, r299[50].mancano, r299[50].indici]);
  c("la riga incompleta non è «ricomposta» (è al suo posto, le manca solo un pezzo)", false, r299[50].ricomposta);
  c("tutti i clienti dopo il buco sono ricomposti (sempre da confermare)", [49, true], [r299.slice(51).length, r299.slice(51).every((r) => r.ricomposta)]);
  c("e quelli dopo il buco sono completi: nessun cliente perso in fondo", [true],
    [r299.slice(51, 99).every((r) => !r.incompleta)]);
  c("i file sono tutti dentro una riga e una sola", 299, new Set(r299.flatMap((r) => r.indici)).size);
  c("l'id della riga incompleta", "0150-0151", r299[50].idRiga);

  gruppo("BULK · T2 · «RICOMPOSTA» SI GIUDICA DAGLI INDICI DEI FILE, NON DALLA POSIZIONE NELL'ELENCO");
  c("tre file consecutivi che non partono da un multiplo di 3 (1,2,3) → ricomposta, anche se sono i primi dell'elenco", true,
    R.ricomponi(sequenza([I, T, P], 1))[0].ricomposta);
  c("tre file con un buco negli indici (0,1,3) → ricomposta, anche se nell'elenco sono vicini", true,
    R.ricomponi([{ indice: 0, tipo: I }, { indice: 1, tipo: T }, { indice: 3, tipo: P }])[0].ricomposta);
  c("tre file consecutivi dal 3 (3,4,5) passati da soli → al loro posto", false, R.ricomponi(sequenza([I, T, P], 3))[0].ricomposta);

  gruppo("BULK · T2 · 301 FILE, DUE TESSERE, ALTRO");
  const r301 = R.ricomponi([...regolari(100), { indice: 300, tipo: I }]);
  c("301 file → 101 righe; l'ultima ha solo l'indirizzo ed è incompleta", [101, true, [T, P], false], [r301.length, r301[100].incompleta, r301[100].mancano, r301[100].ricomposta]);
  c("le prime 100 restano regolari", true, r301.slice(0, 100).every((r) => !r.ricomposta && !r.incompleta));
  const due = R.ricomponi(sequenza([I, T, T, P]));
  c("due tessere consecutive → due clienti, nessuno dei due completo", [2, [P], [I], [[0, 1], [2, 3]]],
    [due.length, due[0].mancano, due[1].mancano, due.map((r) => r.indici)]);
  c("… il secondo è messo insieme dai tipi, il primo è al suo posto", [false, true], [due[0].ricomposta, due[1].ricomposta]);
  const treTessere = R.ricomponi(sequenza([I, T, T]));
  c("due tessere e niente pagamento: due righe, entrambe incomplete", [2, true, true], [treTessere.length, treTessere[0].incompleta, treTessere[1].incompleta]);
  c("tutti «altro» → nessun cliente", [], R.ricomponi(sequenza([A, A, A, A, A, A])));
  c("nessun file → nessun cliente", [], R.ricomponi([]));
  const conAltro = R.ricomponi(sequenza([I, A, P]));
  c("un «altro» (illeggibile) al posto della tessera occupa il suo posto: il cliente manca della tessera", [1, [T], false, [0, 1, 2]],
    [conAltro.length, conAltro[0].mancano, conAltro[0].ricomposta, conAltro[0].indici]);
  c("«altro» al posto dell'indirizzo non rovina i clienti dopo (il suo posto resta suo)", [2, [I], false, true],
    (() => { const r = R.ricomponi(sequenza([A, T, P, I, T, P])); return [r.length, r[0].mancano, r[0].ricomposta, r[1].mancano.length === 0 && !r[1].ricomposta]; })());
  const stray = R.ricomponi(sequenza([I, T, P, A, I, T, P]));
  c("un «altro» in più fra due clienti occupa un posto: nessuna riga dopo è completa e a posto (come per ogni file mancante)",
    [3, true], [stray.length, stray.slice(1).every((r) => r.incompleta || r.ricomposta)]);
  c("un gruppo non supera mai 3 file (un 4° non si incolla a un cliente già pieno)", true,
    R.ricomponi(sequenza([A, I, T, P, I, T, P])).every((r) => r.indici.length <= 3));

  gruppo("BULK · T2 · I TIPI DEI FILE RESTANO DENTRO LA RIGA");
  c("tipi: anche «altro», nell'ordine dei file", [I, A, P], conAltro[0].tipi);
  c("ricomposta è falso per i gruppi al loro posto, anche con l'ordine diverso o incompleti", false,
    R.ricomponi(sequenza([P, I, T, P])).some((r) => r.ricomposta));

  gruppo("BULK · T2 · DETERMINISMO E INPUT");
  const sparsi = regolari(5).reverse();
  c("l'ordine in cui arrivano i file non conta: si ordina per indice", riassunto(R.ricomponi(regolari(5))), riassunto(R.ricomponi(sparsi)));
  c("stessa entrata, stessa uscita", JSON.stringify(R.ricomponi(r299.flatMap((r) => r.indici.map((i) => ({ indice: i, tipo: [I, T, P][i % 3] }))))),
    JSON.stringify(R.ricomponi(r299.flatMap((r) => r.indici.map((i) => ({ indice: i, tipo: [I, T, P][i % 3] }))))));
  const congelato = Object.freeze(regolari(3).map((x) => Object.freeze(x)));
  c("non muta l'input (congelato)", 3, R.ricomponi(congelato).length);
  c("indice ripetuto = dato rovinato: errore, non una riga inventata", true, (() => { try { R.ricomponi([{ indice: 1, tipo: I }, { indice: 1, tipo: T }]); return false; } catch { return true; } })());
  c("un tipo sconosciuto (file non ancora letto) vale «altro»: la riga resta incompleta, mai pronta", [1, [T, P]],
    (() => { const r = R.ricomponi([{ indice: 0, tipo: I }, { indice: 1, tipo: "" }, { indice: 2, tipo: "" }]); return [r.length, r[0].mancano]; })());

  gruppo("BULK · T2 · DOPO LA PULIZIA DELLE LETTURE (D11b)");
  // I file di un lotto come stanno in app_config: con la lettura. Dopo l'emissione
  // di alcune righe la lettura e il percorso si svuotano; il tipo resta.
  const lotto = LOTTO_PROVA;
  const piene = senza.map((x) => ({ indice: x.indice, tipo: x.tipo, stato: "letto", impronta: "h".repeat(64), percorso: `u/bulk/${lotto}/${x.indice}.jpg`,
    lettura: { tipo: x.tipo, incerti: [] } }));
  const emesse = new Set(R.ricomponi(piene).slice(0, 20).flatMap((r) => r.indici));
  const pulite = piene.map((x) => (emesse.has(x.indice) ? { indice: x.indice, tipo: x.tipo, stato: "emessa", impronta: x.impronta } : x));
  c("le righe sono identiche prima e dopo lo svuotamento di 20 righe emesse (stessi idRiga)", riassunto(R.ricomponi(piene)), riassunto(R.ricomponi(pulite)));
  c("anche se tutto il lotto è svuotato tranne il tipo", riassunto(R.ricomponi(piene)),
    riassunto(R.ricomponi(piene.map((x) => ({ indice: x.indice, tipo: x.tipo })))));
}
