/** ── PROVE: IL MESSAGGIO «IBAN PER L'ACCONTO» (31/10/2026) ─────────────────────
 *  Richiesta del titolare: in Attesa acconto, un messaggio da cliccare nella chat con
 *  importo dell'acconto, causale, IBAN e intestatario presi in dinamico (messaggio normale,
 *  non un modello Meta). Regole in src/crm/chatwa/risposte-rapide.ts (segnaposto, formati,
 *  la risposta) e src/crm/chatwa/dati-acconto.ts (acconto e causale dal preventivo);
 *  le letture in rete stanno in useDatiAcconto.ts e si provano sul sorgente.
 *  Dati INVENTATI: l'IBAN è quello d'esempio dello standard, nessun dato vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveMessaggioIban(mod, { c, gruppo, radice }) {
  const R = mod["chatwa/risposte-rapide"];
  const D = mod["chatwa/dati-acconto"];
  const WA = mod["whatsapp"];
  const P = R.RISPOSTE_PREDEFINITE;
  const iban = P.find((r) => r.id === "iban_acconto");
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  const IBAN_FINTO = "IT60X0542811101000000123456";
  const COMPLETI = {
    nome: "mario",
    acconto: 300,
    causale: "Conferma ordine - IDPROVA1",
    iban: IBAN_FINTO,
    intestatario: "Azienda Prova S.r.l.",
  };

  gruppo("MESSAGGIO IBAN · LA RISPOSTA PREIMPOSTATA");
  c("esiste, col titolo del titolare", "IBAN per l'acconto", iban?.titolo);
  c("per lo stato «Attesa acconto» e il tema acconto", [["in_attesa_acconto"], ["acconto"]], [iban?.stati, iban?.temi]);
  c("è in evidenza (sale davanti alle altre nel suo stato)", true, iban?.inEvidenza === true);
  c("dà del tu come le altre di dopo la consulenza", true, R.DOPO_LA_CONSULENZA_COL_TU.includes("iban_acconto"));
  c("usa tutti i segnaposto del bonifico", true,
    ["{nome}", "{acconto}", "{intestatario}", "{iban}", "{causale}"].every((s) => iban.testo.includes(s)));
  c("invita al bonifico e chiede la ricevuta dopo averlo fatto", [true, true],
    [/bonifico/.test(iban.testo), /ricevuta/.test(iban.testo)]);
  c("lunghezza da messaggio normale (titolo corto, testo sotto i 600 caratteri)", true, iban.titolo.length <= 40 && iban.testo.length < 600);
  c("il testo preimpostato non contiene cifre né IBAN", false, /€|\d{4}/.test(iban.testo));
  c("id unico fra le predefinite", 1, P.filter((r) => r.id === "iban_acconto").length);

  gruppo("MESSAGGIO IBAN · TUTTI I VALORI RIEMPITI");
  const pieno = R.riempi(iban.testo, COMPLETI);
  c("il testo finale, parola per parola",
    "Ciao Mario, ecco i dati per fare il bonifico dell'acconto di 300,00 €:\n\n" +
      "Intestatario: Azienda Prova S.r.l.\nIBAN: IT60 X054 2811 1010 0000 0123 456\nCausale: Conferma ordine - IDPROVA1\n\n" +
      "Appena hai fatto il bonifico, mandami qui la ricevuta (anche una foto va bene), così confermiamo subito l'ordine.",
    pieno);
  c("nessun segnaposto resta: la casella non avvisa", [], WA.segnapostiResidui(pieno));
  c("anche con l'IBAN scritto minuscolo e con gli spazi nelle impostazioni", true,
    R.riempi("{iban}", { iban: "  it60 x054 2811 1010 0000 0123 456 " }) === "IT60 X054 2811 1010 0000 0123 456");
  c("un segnaposto ripetuto si riempie ovunque", "300,00 € e 300,00 €", R.riempi("{acconto} e {acconto}", { acconto: 300 }));
  c("gli spazi attorno a intestatario e causale si tolgono", "Ditta - Causa",
    R.riempi("{intestatario} - {causale}", { intestatario: "  Ditta ", causale: " Causa  " }));

  gruppo("MESSAGGIO IBAN · MANCA UN DATO: IL SEGNAPOSTO RESTA E LA CASELLA AVVISA");
  {
    const senzaPreventivo = R.riempi(iban.testo, { ...COMPLETI, acconto: null });
    c("manca il preventivo: {acconto} resta", true, senzaPreventivo.includes("{acconto}"));
    c("…e la casella lo segnala (solo quello)", ["{acconto}"], WA.segnapostiResidui(senzaPreventivo));
    c("…gli altri dati restano riempiti", true, senzaPreventivo.includes(`IBAN: IT60 X054`) && senzaPreventivo.includes("Azienda Prova"));
    c("importo a zero: non si inventa, il segnaposto resta", ["{acconto}"], WA.segnapostiResidui(R.riempi(iban.testo, { ...COMPLETI, acconto: 0 })));
    c("manca l'IBAN: {iban} resta e la casella lo segnala", ["{iban}"], WA.segnapostiResidui(R.riempi(iban.testo, { ...COMPLETI, iban: "" })));
    c("IBAN assente (undefined): {iban} resta", ["{iban}"], WA.segnapostiResidui(R.riempi(iban.testo, { ...COMPLETI, iban: undefined })));
    c("IBAN con una cifra sbagliata (controllo mod 97): non parte, {iban} resta", ["{iban}"],
      WA.segnapostiResidui(R.riempi(iban.testo, { ...COMPLETI, iban: "IT60X0542811101000000123457" })));
    c("manca l'intestatario: {intestatario} resta", ["{intestatario}"], WA.segnapostiResidui(R.riempi(iban.testo, { ...COMPLETI, intestatario: "  " })));
    c("manca la causale: {causale} resta", ["{causale}"], WA.segnapostiResidui(R.riempi(iban.testo, { ...COMPLETI, causale: null })));
    c("niente dati del bonifico: restano tutti e quattro", ["{acconto}", "{intestatario}", "{iban}", "{causale}"].sort(),
      WA.segnapostiResidui(R.riempi(iban.testo, { nome: "Mario" })).sort());
    c("un ripiego esplicito (se lo scrive lo studio) vale", "Importo da definire", R.riempi("{acconto|Importo da definire}", {}));
  }

  gruppo("MESSAGGIO IBAN · FORMATI DI IMPORTO E IBAN");
  c("300 → «300,00 €»", "300,00 €", R.importoPerMessaggio(300));
  c("migliaia con il punto, decimali con la virgola", "1.250,50 €", R.importoPerMessaggio(1250.5));
  c("milioni", "1.000.000,00 €", R.importoPerMessaggio(1000000));
  c("100 → «100,00 €» (l'acconto di casa)", "100,00 €", R.importoPerMessaggio(100));
  c("arrotonda ai centesimi, senza «99,100»", "100,00 €", R.importoPerMessaggio(99.999));
  c("0, negativo, NaN, null, testo: nessun importo", ["", "", "", "", ""],
    [R.importoPerMessaggio(0), R.importoPerMessaggio(-5), R.importoPerMessaggio(NaN), R.importoPerMessaggio(null), R.importoPerMessaggio("300")]);
  c("IBAN a blocchi di 4", "IT60 X054 2811 1010 0000 0123 456", R.ibanPerMessaggio(IBAN_FINTO));
  c("IBAN straniero valido (esempio dello standard)", "GB82 WEST 1234 5698 7654 32", R.ibanPerMessaggio("gb82west12345698765432"));
  c("IBAN già a blocchi: resta uguale", "IT60 X054 2811 1010 0000 0123 456", R.ibanPerMessaggio("IT60 X054 2811 1010 0000 0123 456"));
  c("IBAN con spazi strani e a capo", "IT60 X054 2811 1010 0000 0123 456", R.ibanPerMessaggio("IT60 X054\n28111010000001 23456"));
  c("troppo corto, con simboli o senza cifre di controllo: vuoto", ["", "", "", "", ""],
    [R.ibanPerMessaggio("IT60"), R.ibanPerMessaggio("IT60-X054-2811-1010-0000-0123-456"), R.ibanPerMessaggio("ITXX X054 2811 1010 0000 0123 456"), R.ibanPerMessaggio(""), R.ibanPerMessaggio(null)]);
  c("nessun gruppo da uno o due caratteri in fondo, nessuno spazio finale", true, !R.ibanPerMessaggio(IBAN_FINTO).endsWith(" "));

  gruppo("MESSAGGIO IBAN · ACCONTO E CAUSALE DAL PREVENTIVO");
  {
    const quote = (o = {}) => ({ quote_ref: "IDPROVA1", nome: "Mario", cognome: "Rossi", total: 1200, base_system: { id: "patch-standard" }, ...o });
    const cond = (listino) => JSON.stringify({ listino });
    const risposta = (o = {}) => ({ ok: true, quote: quote(), ...o });
    const acc = (j) => D.accontoDaPreventivo(j)?.acconto;
    const cau = (j) => D.accontoDaPreventivo(j)?.causale;

    c("acconto del listino fotografato", 300, acc(risposta({ condizioni: cond({ acconto: 300 }) })));
    c("l'acconto della soluzione scelta vince su quello generale", 150, acc(risposta({ condizioni: cond({ acconto: 300, accontoPerBase: { "patch-standard": 150 } }) })));
    c("un'altra soluzione ha il generale", 300, acc(risposta({ condizioni: cond({ acconto: 300, accontoPerBase: { altra: 150 } }) })));
    c("mai più del totale", 80, acc(risposta({ quote: quote({ total: 80 }), condizioni: cond({ acconto: 300 }) })));
    c("preventivo nato prima della fotografia: l'acconto di casa (100)", 100, acc(risposta()));
    c("condizioni illeggibili: l'acconto di casa", 100, acc(risposta({ condizioni: "{rotto" })));
    c("acconto a zero nel listino («non si chiede acconto»): nessun importo", null, acc(risposta({ condizioni: cond({ acconto: 0 }) })));
    c("totale zero o assente: nessun importo", [null, null], [acc(risposta({ quote: quote({ total: 0 }) })), acc(risposta({ quote: quote({ total: undefined }) }))]);
    c("risposta non ok, vuota o senza preventivo: niente", [null, null, null, null], [D.accontoDaPreventivo({ ok: false }), D.accontoDaPreventivo(null), D.accontoDaPreventivo("x"), D.accontoDaPreventivo({ ok: true })]);
    c("causale di casa: «Conferma ordine - numero», come sulla pagina del preventivo e sulla fattura", "Conferma ordine - IDPROVA1", cau(risposta()));
    c("il modello del listino di allora", "Acconto Mario Rossi - IDPROVA1", cau(risposta({ condizioni: cond({ causale: "Acconto {nome} - {numero}" }) })));
    c("il modello scritto a mano per quel preventivo vince", "Ordine IDPROVA1", cau(risposta({ causale: "Ordine {numero}", condizioni: cond({ causale: "Altro {numero}" }) })));
    c("senza numero nel modello, il numero si aggiunge (regola di causaleDi)", "Acconto IDPROVA1", cau(risposta({ causale: "Acconto" })));
    c("senza numero di preventivo: nessuna causale (non si inventa)", "", cau(risposta({ quote: quote({ quote_ref: "" }) })));

    c("senza preventivo: «Acconto Nome Cognome»", "Acconto Mario Rossi", D.causaleSenzaPreventivo(" Mario ", "Rossi"));
    c("solo il nome", "Acconto Mario", D.causaleSenzaPreventivo("Mario", ""));
    c("nessun nome: vuota, il segnaposto resta", ["", ""], [D.causaleSenzaPreventivo("", null), D.causaleSenzaPreventivo(undefined, undefined)]);
  }

  gruppo("MESSAGGIO IBAN · IN EVIDENZA IN ATTESA ACCONTO");
  {
    const ordine = (elenco, ctx) => R.suggerisci(elenco, ctx, 8).map((r) => r.id);
    c("in Attesa acconto è il primo suggerimento", "iban_acconto", ordine(P, { stato: "in_attesa_acconto" })[0]);
    c("…anche se il cliente ha scritto d'altro", "iban_acconto", ordine(P, { stato: "in_attesa_acconto", ultimoCliente: "quanto costa?" })[0]);
    c("…anche se il cliente chiede dei dati del bonifico", "iban_acconto", ordine(P, { stato: "in_attesa_acconto", ultimoCliente: "mi manda l'iban per il bonifico?" })[0]);
    c("…la vecchia «Acconto» resta fra i suggerimenti", true, ordine(P, { stato: "in_attesa_acconto" }).includes("acconto"));
    {
      //  Chi ha un elenco salvato dove la vecchia «Acconto» sta prima: la nuova è lo stesso davanti.
      const rovesciato = [...P].reverse();
      c("anche in un elenco salvato con un altro ordine", "iban_acconto", ordine(rovesciato, { stato: "in_attesa_acconto" })[0]);
    }
    c("in altri stati non si propone in cima", false, ["da_contattare", "acconto", "posa_in_sede", "sta_valutando", "appuntamento_fissato"].some((s) => ordine(P, { stato: s })[0] === "iban_acconto"));
    c("senza stato né messaggio non si propone in cima", false, ordine(P, {})[0] === "iban_acconto");
    c("lo trova il comando «/iban»", true, R.filtraRisposte(P, "iban").some((x) => x.risposta.id === "iban_acconto"));
    c("lo trova il comando «/IBAN per»", "iban_acconto", R.filtraRisposte(P, "iban per")[0]?.risposta.id);
  }

  gruppo("MESSAGGIO IBAN · ARRIVA ANCHE A CHI HA GIÀ UN ELENCO SALVATO");
  {
    const ids = (l) => l.map((x) => x.id);
    const salvataPrima = R.leggiRisposte(JSON.stringify({ v: 1, risposte: [{ id: "mia-1", titolo: "Mia", testo: "ciao" }] }));
    c("elenco salvato senza `viste` (prima del 29/10): la riceve in fondo", true, ids(salvataPrima).includes("iban_acconto"));
    const del29 = R.leggiRisposte(JSON.stringify({ v: 1, risposte: [{ id: "mia-1", titolo: "Mia", testo: "ciao" }], viste: [...R.PREDEFINITE_FINO_AL_28_10, "meet_adesso"] }));
    c("elenco salvato il 29-30/10: la riceve una volta", 1, ids(del29).filter((x) => x === "iban_acconto").length);
    c("la lista «fino al 28/10» NON la contiene (altrimenti non arriverebbe a nessuno)", false, R.PREDEFINITE_FINO_AL_28_10.includes("iban_acconto"));
    const dopoSalvataggio = R.leggiRisposte(R.scriviRisposte([{ id: "mia-1", titolo: "Mia", testo: "ciao" }]));
    c("chi ha salvato dopo averla vista e l'ha tolta non la rivede", false, ids(dopoSalvataggio).includes("iban_acconto"));
    c("già nell'elenco: non si doppia", 1, ids(R.leggiRisposte(JSON.stringify({ risposte: [{ id: "iban_acconto", titolo: "I", testo: "i" }] }))).filter((x) => x === "iban_acconto").length);
    const nuovaVoce = salvataPrima.find((x) => x.id === "iban_acconto");
    c("la copia consegnata porta lo stesso testo", iban.testo, nuovaVoce.testo);
  }

  gruppo("MESSAGGIO IBAN · LE LETTURE E IL COLLEGAMENTO NELLA CASELLA (sul sorgente)");
  {
    const casella = senzaCommenti(leggi("src/crm/chatwa/Casella.tsx"));
    const hook = senzaCommenti(leggi("src/crm/chatwa/useDatiAcconto.ts"));
    c("la casella passa a riempi acconto, causale, IBAN e intestatario", true,
      /acconto:\s*bonifico\.acconto/.test(casella) && /iban:\s*bonifico\.iban/.test(casella) && /intestatario:\s*bonifico\.intestatario/.test(casella) && /causale:/.test(casella));
    c("la causale di ripiego («Acconto Nome Cognome») solo se il preventivo non ne ha", true,
      /bonifico\.causalePreventivo\s*\|\|\s*causaleSenzaPreventivo/.test(casella));
    c("la casella non legge niente da sé (nessun fetch né leggiAzienda al volo)", false, /fetch\(|leggiAzienda/.test(casella));
    c("i dati si leggono in un effetto, non a ogni render né a ogni tasto", true, /useEffect\(/.test(hook) && !/bozza/.test(hook));
    c("l'effetto riparte per chat, non a ogni salvataggio della scheda (dipendenze: id, riferimento, stato)", true,
      /\[id,\s*rif,\s*inAttesa\]/.test(hook));
    c("IBAN e intestatario dalle impostazioni Fatture, in cache per la sessione", true,
      /leggiAzienda\(\)/.test(hook) && /aziendaLetta\s*\?\?=/.test(hook));
    c("un errore di lettura dell'azienda non resta in cache (la chat dopo riprova)", true, /aziendaLetta\s*=\s*null/.test(hook));
    c("il preventivo: legame `quoteRef`, rotta pubblica, ultimo della catena (`segui=1`)", true,
      /lead\.data\.quoteRef/.test(hook) && /\/api\/public\/quote\?ref=/.test(hook) && /segui=1/.test(hook));
    c("senza `quoteRef` il telefono solo in Attesa acconto, e scartando i sostituiti (preventivoDaCitare)", true,
      /in_attesa_acconto/.test(hook) && /preventivoDaCitare/.test(hook));
    c("la risposta di una chat vecchia che arriva tardi si butta", true, /let vivo = true/.test(hook) && /if \(!vivo\) return/.test(hook));
    c("un errore del preventivo non rompe la casella (i segnaposto restano)", true, /\.catch\(\(\) => null\)/.test(hook));
    c("nessun IBAN vero nel codice nuovo (solo quello d'esempio dello standard, nelle prove)", [],
      ["src/crm/chatwa/useDatiAcconto.ts", "src/crm/chatwa/dati-acconto.ts", "src/crm/chatwa/risposte-rapide.ts", "src/crm/chatwa/Casella.tsx"]
        .filter((f) => /\b[A-Z]{2}\d{2}[ ]?[A-Z0-9]{4}[ ]?\d{4}/.test(senzaCommenti(leggi(f)))));
    c("la finestra delle risposte elenca i nuovi segnaposto", true,
      ["{acconto}", "{iban}", "{intestatario}", "{causale}"].every((s) => leggi("src/crm/chatwa/RisposteRapide.tsx").includes(`{"${s}"}`)));
    c("l'anteprima al passaggio sul suggerimento è il testo riempito", true, /title=\{p\.riempi\(r\.testo\)\}/.test(leggi("src/crm/chatwa/RisposteRapide.tsx")));
  }
}
