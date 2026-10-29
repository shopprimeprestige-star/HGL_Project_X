/** ── PROVE: CHAT WHATSAPP · LE RISPOSTE RAPIDE ──────────────────────────────────
 *
 *  Commessa 2026-10-28 (chat-risposte-rapide). Le regole pure di
 *  `src/crm/chatwa/risposte-rapide.ts`: il comando «/», il filtro «/n» e
 *  «/parola», l'ordine dei suggerimenti (ultimo messaggio del cliente + stato
 *  del lead), i segnaposto {nome}/{consulente}, la lettura sicura del valore
 *  salvato in `app_config` («wa_risposte_rapide»).
 *  Dati inventati: nessun numero, nessun nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveChatRisposte(mod, { c, gruppo, radice }) {
  const R = mod["chatwa/risposte-rapide"];
  const P = R.RISPOSTE_PREDEFINITE;
  const ids = (l) => l.map((x) => x.id);

  gruppo("CHAT · RISPOSTE RAPIDE · I TESTI PREDEFINITI");
  c("chiave di app_config", "wa_risposte_rapide", R.CHIAVE_CONFIG_RISPOSTE);
  c("fra 20 e 30 risposte", true, P.length >= 20 && P.length <= 30);
  c("id unici", P.length, new Set(ids(P)).size);
  c("titolo e testo pieni, titolo corto", true, P.every((r) => r.titolo.trim() && r.testo.trim() && r.titolo.length <= 40));
  //  Dal 29/10 (richiesta del titolare): col Lei il primo contatto e il prima della
  //  consulenza, col tu le risposte di dopo la consulenza (DOPO_LA_CONSULENZA_COL_TU).
  const colTu = new Set(R.DOPO_LA_CONSULENZA_COL_TU);
  c("prima della consulenza danno del Lei (niente «ti»/«tuo» al cliente)", [], P.filter((r) => !colTu.has(r.id) && /\b(?:ti|tuo|tua|hai|puoi|scrivimi)\b/i.test(r.testo)).map((r) => r.id));
  c("dopo la consulenza danno del tu (niente «Le»/«Sua»/«può»)", [], P.filter((r) => colTu.has(r.id) && (/\b(?:lei|sua|suo|può|gliele|mi scriva|preferisce|la ricontattiamo)\b/i.test(r.testo) || /\bLe\b/.test(r.testo))).map((r) => r.id));
  c("le risposte col tu esistono tutte", [...colTu].sort(), P.filter((r) => colTu.has(r.id)).map((r) => r.id).sort());
  c("niente cifre di prezzo inventate", [], P.filter((r) => /€|\beuro\b|\d+\s*(?:euro|€)/i.test(r.testo)).map((r) => r.id));
  c("niente indirizzi inventati: la sede è un segnaposto", true, P.filter((r) => /indirizzo|sede è in/i.test(r.testo)).every((r) => r.testo.includes("{indirizzo}") || !/\bvia\b|\bpiazza\b/i.test(r.testo)));
  c("niente promesse mediche", [], P.filter((r) => /\bguari|\bcura\b|\bricresc|garantit|ricrescita/i.test(r.testo)).map((r) => r.id));
  c("si parla di consulenza gratuita in videochiamata", true, P.some((r) => /gratuita/.test(r.testo) && /videochiamata/.test(r.testo)));
  c("ci sono prezzo, dove, conferma, sposta, foto, acconto, manutenzione, domicilio", true,
    ["prezzo", "dove", "conferma", "sposta", "foto", "acconto", "manutenzione", "domicilio"].every((t) => P.some((r) => r.temi?.includes(t))));

  gruppo("CHAT · RISPOSTE RAPIDE · IL COMANDO «/»");
  c("«/» apre l'elenco (ricerca vuota)", "", R.comandoDi("/"));
  c("«/2» → «2»", "2", R.comandoDi("/2"));
  c("«/Prezzo» → «prezzo»", "prezzo", R.comandoDi("/Prezzo"));
  c("spazi davanti contano come vuoto", "dove", R.comandoDi("  /dove"));
  c("testo normale: niente comando", null, R.comandoDi("Buongiorno"));
  c("«/» a metà frase: niente comando", null, R.comandoDi("a/b"));
  c("su più righe: niente comando (è un messaggio)", null, R.comandoDi("/ciao\naltro"));
  c("troppo lungo: niente comando", null, R.comandoDi("/" + "a".repeat(41)));
  c("vuoto: niente", null, R.comandoDi(""));

  gruppo("CHAT · RISPOSTE RAPIDE · IL FILTRO");
  const elenco = [
    { id: "a", titolo: "Info prezzi", testo: "Il costo lo vediamo in consulenza." },
    { id: "b", titolo: "Dove siete", testo: "La consulenza è online." },
    { id: "c", titolo: "Conferma", testo: "Perfetto, confermato." },
    { id: "d", titolo: "Prezzo dopo consulenza", testo: "Le mando il riepilogo." },
    { id: "e", titolo: "Grazie", testo: "Grazie a lei!" },
    { id: "f", titolo: "Uno", testo: "x" },
    { id: "g", titolo: "Due", testo: "x" },
    { id: "h", titolo: "Tre", testo: "x" },
    { id: "i", titolo: "Quattro", testo: "x" },
    { id: "l", titolo: "Dieci", testo: "x" },
    { id: "m", titolo: "Undici", testo: "x" },
  ];
  const f = (q) => R.filtraRisposte(elenco, q).map((x) => `${x.numero}:${x.risposta.id}`);
  c("vuoto: tutte, numerate dall'1 nell'ordine salvato", elenco.map((r, i) => `${i + 1}:${r.id}`), f(""));
  c("«/2»: la numero 2", ["2:b"], f("2"));
  c("«/1»: la 1 prima, poi 10 e 11", ["1:a", "10:l", "11:m"], f("1"));
  c("«/99»: nessuna", [], f("99"));
  c("«/prez»: prima chi ha la parola nel titolo all'inizio", ["1:a", "4:d"].sort(), f("prez").sort());
  c("…e il titolo che COMINCIA con la parola sta sopra", "4:d", f("prez")[0]);
  c("senza accenti e maiuscole", f("dove"), f("DOVÈ"));
  c("cerca anche nel testo", ["2:b"], f("online"));
  c("più parole: servono tutte", ["4:d"], f("prezzo riepilogo"));
  c("nessuna corrispondenza: vuoto", [], f("zzz"));

  gruppo("CHAT · RISPOSTE RAPIDE · I TEMI DEL MESSAGGIO DEL CLIENTE");
  const temi = (t) => R.temiDi(t);
  c("«Quanto costa?» → prezzo", true, temi("Buongiorno, quanto costa?").includes("prezzo"));
  c("«dove siete?» → dove", true, temi("Dove siete di preciso?").includes("dove"));
  c("«Sì» → conferma", true, temi("Sì").includes("conferma"));
  c("«ok perfetto» → conferma", true, temi("ok perfetto").includes("conferma"));
  c("«va bene domani alle 10» → conferma", true, temi("va bene domani alle 10").includes("conferma"));
  c("una frase lunga che contiene «si» non è una conferma", false,
    temi("si può fare anche se ho pochissimi capelli sulla parte alta della testa?").includes("conferma"));
  c("foto di ManyChat → foto", true, temi("https://manybot-files.s3.eu-central-1.amazonaws.com/pagina123/wa/2026/10/28/original_x.jpg").includes("foto"));
  c("«devo spostare l'appuntamento» → sposta", true, temi("Devo spostare l'appuntamento").includes("sposta"));
  c("«è un trapianto?» → chirurgia", true, temi("È un trapianto?").includes("chirurgia"));
  c("«posso fare la doccia?» → manutenzione", true, temi("posso fare la doccia?").includes("manutenzione"));
  c("«venite a casa?» → domicilio", true, temi("Venite voi a casa?").includes("domicilio"));
  c("«ci penso» → ci_penso", true, temi("Ci penso e vi faccio sapere").includes("ci_penso"));
  c("testo vuoto o nullo: nessun tema", [[], []], [temi(""), temi(null)]);
  {
    const lungo = "quanto ".repeat(20000) + "€";
    const t0 = performance.now();
    temi(lungo);
    c("un testo enorme non blocca (sotto 50 ms)", true, performance.now() - t0 < 50);
  }

  gruppo("CHAT · RISPOSTE RAPIDE · ORDINE DEI SUGGERIMENTI");
  const sug = (ultimo, stato, max = 3) => ids(R.suggerisci(P, { ultimoCliente: ultimo, stato }, max));
  c("chiede il prezzo → la risposta sul prezzo è la prima", "prezzo", sug("Salve quanto costa?", null)[0]);
  c("chiede dove siete → sede/consulenza video prima", "dove", sug("dove siete?", null)[0]);
  c("dice sì con il meet fissato → conferma consulenza", "conferma_meet", sug("Sì va bene", "appuntamento_fissato")[0]);
  c("manda una foto → ringrazia e propone la consulenza", "foto_ricevute",
    sug("https://manybot-files.s3.eu-central-1.amazonaws.com/pagina123/wa/2026/10/28/x.jpg", null)[0]);
  c("vuole spostare → sposta", "sposta", sug("non riesco domani, possiamo spostare?", null)[0]);
  c("chiede del trapianto → non chirurgico", "non_chirurgico", sug("ma è un trapianto?", null)[0]);
  c("nessun messaggio, stato «in attesa acconto» → acconto prima", "acconto", sug(null, "in_attesa_acconto")[0]);
  c("nessun messaggio, stato «non risponde» → non riesco a contattarla", "non_risponde", sug(null, "non_risponde")[0]);
  c("il messaggio vince sullo stato", "prezzo", sug("quanto costa?", "non_risponde")[0]);
  c("niente messaggio né stato: l'ordine salvato", ids(P.slice(0, 3)), sug(null, null));
  c("al massimo quante chieste", 5, R.suggerisci(P, { ultimoCliente: "ciao", stato: null }, 5).length);
  c("pari punteggio: vale l'ordine salvato", true, (() => {
    const l = R.suggerisci(P, { ultimoCliente: null, stato: null }, P.length);
    return l.every((r, i) => r.id === P[i].id);
  })());
  c("una risposta personalizzata (senza temi) non rompe niente", "mia", ids(R.suggerisci([{ id: "mia", titolo: "Mia", testo: "x" }], { ultimoCliente: "quanto costa", stato: "boh" }, 3))[0]);
  c("una predefinita modificata tiene i suoi temi (dall'id)", "prezzo",
    ids(R.suggerisci([{ id: "grazie", titolo: "G", testo: "g" }, { id: "prezzo", titolo: "Mio prezzo", testo: "mio testo" }], { ultimoCliente: "quanto costa", stato: null }, 2))[0]);

  gruppo("CHAT · RISPOSTE RAPIDE · ULTIMO MESSAGGIO DEL CLIENTE");
  const msg = (direction, body) => ({ direction, body });
  c("l'ultimo in entrata, anche se dopo abbiamo scritto noi", "quanto costa?",
    R.ultimoDelCliente([msg("inbound", "ciao"), msg("inbound", "quanto costa?"), msg("outbound", "Le scrivo")]));
  c("nessun messaggio del cliente: null", null, R.ultimoDelCliente([msg("outbound", "x")]));
  c("lista vuota: null", null, R.ultimoDelCliente([]));

  gruppo("CHAT · RISPOSTE RAPIDE · SEGNAPOSTO");
  const riempi = R.riempi;
  c("nome e consulente", "Buongiorno Mario, la segue Luca.", riempi("Buongiorno {nome}, la segue {consulente}.", { nome: "Mario", consulente: "Luca" }));
  c("nome minuscolo → maiuscola", "Ciao Mario!", riempi("Ciao {nome}!", { nome: "mario" }));
  c("spazi attorno al nome tolti", "Ciao Mario!", riempi("Ciao {nome}!", { nome: "  Mario " }));
  c("senza nome: sparisce con lo spazio davanti", "Buongiorno, grazie.", riempi("Buongiorno {nome}, grazie.", { nome: "" }));
  c("senza nome con ripiego: il ripiego", "Ciao cliente", riempi("Ciao {nome|cliente}", {}));
  c("consulente con ripiego, noto", "La segue Luca.", riempi("La segue {consulente|uno dei nostri consulenti}.", { consulente: "Luca" }));
  c("consulente con ripiego, ignoto", "La segue uno dei nostri consulenti.", riempi("La segue {consulente|uno dei nostri consulenti}.", { consulente: "" }));
  c("consulente ignoto senza ripiego: resta (la casella avvisa)", "Sono {consulente}.", riempi("Sono {consulente}.", {}));
  c("altri segnaposto restano: li scrive l'operatore", "Sede: {indirizzo}", riempi("Sede: {indirizzo}", { nome: "Mario" }));
  c("tutte le volte, non solo la prima", "Mario e Mario", riempi("{nome} e {nome}", { nome: "Mario" }));
  c("i predefiniti, riempiti, non lasciano {nome} né {consulente}", [], P.map((r) => riempi(r.testo, { nome: "Mario", consulente: "Luca" })).filter((t) => /\{(?:nome|consulente)[|}]/.test(t)));
  c("nome da usare: la scheda prima, poi il primo nome del contatto", ["Maria Grazia", "Paolo", ""],
    [R.nomePerMessaggio("Maria Grazia", "Paolo Esempio"), R.nomePerMessaggio("", " Paolo Esempio"), R.nomePerMessaggio(null, null)]);

  gruppo("CHAT · RISPOSTE RAPIDE · LETTURA DEL VALORE SALVATO");
  const leggi = R.leggiRisposte;
  c("niente di salvato: i predefiniti", ids(P), ids(leggi(null)));
  c("stringa vuota: i predefiniti", ids(P), ids(leggi("")));
  c("JSON rotto: i predefiniti (mai una pagina rotta)", ids(P), ids(leggi("{rotto")));
  c("un numero: i predefiniti", ids(P), ids(leggi("42")));
  c("risposte non elenco: i predefiniti", ids(P), ids(leggi('{"risposte":"x"}')));
  c("elenco vuoto salvato: vuoto (le ha tolte lo studio)", [], leggi('{"v":1,"risposte":[]}'));
  c("elenco di sole voci rotte: i predefiniti", ids(P), ids(leggi('{"risposte":[1,null,{"titolo":""}]}')));
  {
    const l = leggi(JSON.stringify({ v: 1, risposte: [
      { id: "x", titolo: " Mia ", testo: " Ciao " },
      { id: "x", titolo: "Doppia", testo: "stesso id" },
      { titolo: "Senza id", testo: "t" },
      { id: "<script>", titolo: "Id strano", testo: "t" },
      { id: "y", titolo: "", testo: "senza titolo" },
      { id: "z", titolo: "t".repeat(200), testo: "u".repeat(5000) },
      "testo",
    ] }));
    c("voci buone tenute, rotte scartate, spazi tolti", ["Mia", "Doppia", "Senza id", "Id strano", "t".repeat(60)], l.map((r) => r.titolo));
    c("id unici e puliti", true, new Set(ids(l)).size === l.length && l.every((r) => /^[\w-]{1,40}$/.test(r.id)));
    c("testo tagliato a 2000", 2000, l[4].testo.length);
  }
  c("accetta anche l'oggetto già letto", ["q"], ids(leggi({ v: 1, risposte: [{ id: "q", titolo: "Q", testo: "q" }] })));
  c("i temi non arrivano dal salvato: vengono dal codice", undefined, leggi('{"risposte":[{"id":"q","titolo":"Q","testo":"q","temi":["prezzo"]}]}')[0].temi);
  c("scritte e rilette uguali", ids(P), ids(leggi(R.scriviRisposte(P))));
  c("si salva solo id, titolo e testo", '{"v":1,"risposte":[{"id":"a","titolo":"A","testo":"t"}]}',
    R.scriviRisposte([{ id: "a", titolo: "A", testo: "t", temi: ["prezzo"], stati: ["x"] }]));
  c("più di 100 voci: si tengono le prime 100", 100,
    leggi(JSON.stringify({ risposte: Array.from({ length: 150 }, (_, i) => ({ id: `r${i}`, titolo: "T", testo: "t" })) })).length);

  gruppo("CHAT · RISPOSTE RAPIDE · AGGIUNGI, MODIFICA, ELIMINA");
  const base = [{ id: "a", titolo: "A", testo: "a" }, { id: "b", titolo: "B", testo: "b" }];
  c("modifica tiene il posto", ["a", "B2"], R.conRisposta(base, { id: "b", titolo: "B2", testo: "b" }).map((r) => r.id === "b" ? r.titolo : r.id));
  c("una nuova va in fondo", ["a", "b", "c"], ids(R.conRisposta(base, { id: "c", titolo: "C", testo: "c" })));
  c("elimina solo quella", ["a"], ids(R.senzaRisposta(base, "b")));
  c("l'elenco di partenza non cambia", ["a", "b"], ids(base));
  c("id nuovo unico", true, !ids(base).includes(R.nuovoId(base, "a")));
  c("ripristina: copia dei predefiniti (modificarla non li tocca)", true, (() => {
    const r = R.ripristinate();
    r[0].testo = "cambiato";
    return R.RISPOSTE_PREDEFINITE[0].testo !== "cambiato";
  })());

  gruppo("CHAT · RISPOSTE RAPIDE · LA CASELLA E IL SALVATAGGIO");
  const casella = readFileSync(join(radice, "src/crm/chatwa/Casella.tsx"), "utf8");
  const hook = readFileSync(join(radice, "src/crm/chatwa/useRisposteRapide.ts"), "utf8");
  c("inserire mette il testo nella casella, non invia", true, /setBozza\(/.test(casella) && !/inserisci[\s\S]{0,200}invia\(\)/.test(casella));
  c("salvataggi in fila che rileggono prima di scrivere (come le stelle)", true,
    /coda\.current = coda\.current\s*\.then\(/.test(hook) && /leggiRisposte\(data\?\.value\)/.test(hook));
  c("restano gli orari rapidi solo a chi ha l'agenda", true, /const puoAgenda = usePuo\(\)\("agenda"\)/.test(casella) && /orari && puoAgenda && configurata/.test(casella));
}
