/** ── PROVE: LE PAROLE DEL LEAD (T1) ──────────────────────────────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), SPEC 3.1 e 3.7. `capisciRisposta` è
 *  pura: dal testo del lead dice se è una fascia, una scelta fra le opzioni, la
 *  richiesta di altri orari, oppure niente (e allora risponde la setter).
 *  ⚠️ Il principio: una risposta sbagliata costa più del silenzio. Nel dubbio,
 *  «niente».
 *
 *  Ogni riga: [frase, senza proposta aperta, con proposta aperta]. Se l'esito è
 *  lo stesso basta scriverlo una volta. `F:sera` = fascia, `S:2` = scelta,
 *  `A` = altri, `-` = niente.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
export async function proveDelleParolePrenota(mod, { c, gruppo }) {
  gruppo("PRENOTA · LE PAROLE DEL LEAD (T1)");
  const { capisciRisposta } = mod["manychat/prenota-parole"];

  const leggi = (e) => {
    if (e === "-") return { tipo: "niente" };
    if (e === "A") return { tipo: "altri" };
    const [k, v] = e.split(":");
    return k === "F" ? { tipo: "fascia", fascia: v } : { tipo: "scelta", n: Number(v) };
  };
  const tabella = [
    // ── le fasce, in tutti i modi in cui un italiano le scrive
    ["sera", "F:sera"],
    ["Sera", "F:sera"],
    ["SERA", "F:sera"],
    ["sera?", "-"],
    ["sera.", "F:sera"],
    ["Sera!", "F:sera"],
    ["sera 😊", "F:sera"],
    ["😊", "-"],
    ["la sera", "F:sera"],
    ["di sera", "F:sera"],
    ["serata", "F:sera"],
    ["in serata", "F:sera"],
    ["stasera", "F:sera"],
    ["dopo cena", "F:sera"],
    ["Preferisco la sera, grazie", "F:sera"],
    ["Buonasera, la sera va bene", "F:sera"],
    ["mattina", "F:mattina"],
    ["Mattina", "F:mattina"],
    ["mattino", "F:mattina"],
    ["di mattina", "F:mattina"],
    ["la mattina presto", "F:mattina"],
    ["mattina presto, se possibile", "F:mattina"],
    ["stamattina", "F:mattina"],
    ["pomeriggio", "F:pomeriggio"],
    ["POMERIGGIO", "F:pomeriggio"],
    ["nel pomeriggio", "F:pomeriggio"],
    ["Il pomeriggio è meglio", "F:pomeriggio"],
    ["  sera  ", "F:sera"],
    ["sera\n", "F:sera"],
    // ── il saluto non è una scelta
    ["Buonasera", "-"],
    ["Buona sera", "-"],
    ["Buon pomeriggio", "-"],
    ["buongiorno", "-"],
    // ── due fasce, una domanda, un giorno o un'ora: non è una scelta
    ["mattina o sera", "-"],
    ["sera o pomeriggio", "-"],
    ["mattina, pomeriggio o sera, per me è uguale", "-"],
    ["la sera quanto costa?", "-"],
    ["la sera quanto costa", "-"],
    ["quando è la sera", "-"],
    ["giovedì alle 15", "-"],
    ["giovedì sera", "-"],
    ["giovedi sera", "-"],
    ["domani sera", "-"],
    ["sabato mattina", "-"],
    ["alle 18", "-"],
    ["alle 18:30", "-"],
    ["sera, verso le 19", "-"],
    ["dopo le 18", "-"],
    ["dopo le diciotto", "-"],
    ["18", "-"],
    ["18.30", "-"],
    ["il 29 ottobre", "-"],
    ["ottobre", "-"],
    ["la prossima settimana", "-"],
    ["oggi", "-"],
    ["non la mattina", "-"],
    ["non di sera", "-"],
    ["sera no", "-"],
    ["mai di mattina", "-"],
    ["la sera ma non il venerdì", "-"],
    // ── troppo lungo: più di 8 parole
    ["sera va bene per me grazie mille davvero", "F:sera"], // 8 parole: passa
    ["sera va bene per me grazie mille davvero tanto", "-"], // 9 parole: no
    ["Sono libera solo la sera dopo le ore di lavoro", "-"],
    // ── vuote e fuori tema
    ["", "-"],
    ["   ", "-"],
    ["\n\t", "-"],
    ["ok", "-"],
    ["sì", "-"],
    ["no", "-"],
    ["grazie", "-"],
    ["chi siete?", "-"],
    ["quanto costa", "-"],
    ["non mi interessa più", "-"],
    ["posso avere un numero di telefono", "-"],
    // ── le scelte: contano solo con una proposta aperta
    ["1", "-", "S:1"],
    ["2", "-", "S:2"],
    ["3", "-", "S:3"],
    ["2.", "-", "S:2"],
    [" 3 ", "-", "S:3"],
    ["1️⃣", "-", "S:1"],
    ["opzione 1", "-", "S:1"],
    ["Opzione 2", "-", "S:2"],
    ["opzione 3", "-", "S:3"],
    ["Opzione 3!", "-", "S:3"],
    ["OPZIONE 2", "-", "S:2"],
    ["opzione n. 2", "-", "S:2"],
    ["l'opzione 2", "-", "S:2"],
    ["scelgo l'opzione 3", "-", "S:3"],
    ["la 2", "-", "S:2"],
    ["il primo", "-", "S:1"],
    ["Il secondo", "-", "S:2"],
    ["il terzo", "-", "S:3"],
    ["la prima", "-", "S:1"],
    ["la terza, grazie", "-", "S:3"],
    ["vorrei il secondo per favore", "-", "S:2"],
    ["opzione due", "-", "S:2"],
    ["1 o 2", "-", "-"],
    ["opzione 1 e 3", "-", "-"],
    ["4", "-", "-"],
    ["0", "-", "-"],
    ["10", "-", "-"],
    ["opzione 4", "-", "-"],
    ["ho 2 figli", "-", "-"],
    ["secondo me no", "-", "-"],
    ["prima possibile", "-", "-"],
    ["opzione 2 sera", "-", "-"],
    ["opzione 2?", "-", "-"],
    // ── altri orari: anche questi solo con una proposta aperta
    ["altri", "-", "A"],
    ["ALTRI", "-", "A"],
    ["Altri.", "-", "A"],
    ["altre", "-", "A"],
    ["altro orario", "-", "A"],
    ["altri orari", "-", "A"],
    ["Altri orari, per favore", "-", "A"],
    ["scriva altri", "-", "A"],
    ["vorrei altri orari", "-", "A"],
    ["nessuno va bene", "-", "A"],
    ["Nessuno va bene.", "-", "A"],
    ["nessuna va bene", "-", "A"],
    ["nessuno di questi", "-", "A"],
    ["altri orari?", "-", "-"],
    ["altri giovedì", "-", "-"],
    ["altri orari dopo le 18", "-", "-"],
    ["altri orari di sera", "F:sera", "F:sera"],
    ["altro che sconto", "-", "-"],
    // ── una fascia nuova a proposta aperta si capisce comunque
    ["mattina", "F:mattina", "F:mattina"],
    ["preferisco il pomeriggio", "F:pomeriggio", "F:pomeriggio"],
  ];

  for (const [frase, senza, con = senza] of tabella) {
    const nome = JSON.stringify(frase);
    c(`${nome} senza proposta`, leggi(senza), capisciRisposta(frase, { propostaAperta: false }));
    c(`${nome} con proposta`, leggi(con), capisciRisposta(frase, { propostaAperta: true }));
  }
  c("la tabella ha almeno 60 frasi", true, tabella.length >= 60);

  //  ⚠️ Le chiavi del prototipo non sono numeri: «constructor» non è la scelta di niente.
  for (const proto of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf", "opzione constructor", "1 constructor"]) {
    for (const propostaAperta of [true, false]) {
      c(`«${proto}» (proposta ${propostaAperta ? "aperta" : "chiusa"}): niente`, { tipo: "niente" },
        capisciRisposta(proto, { propostaAperta }));
    }
  }
  for (const ok of ["1", "2", "3", "il terzo"]) {
    const r = capisciRisposta(ok, { propostaAperta: true });
    c(`la scelta «${ok}» è sempre un numero 1, 2 o 3`, true, r.tipo === "scelta" && [1, 2, 3].includes(r.n) && typeof r.n === "number");
  }

  //  Non lancia mai, qualunque cosa arrivi (la rotta passa il testo grezzo).
  for (const strano of [undefined, null, 5, {}, "x".repeat(10_000), "\u0000\u200b", "\u00df", "SERA\u0301"]) {
    let esito;
    try {
      esito = capisciRisposta(strano, { propostaAperta: true });
    } catch {
      esito = "lancia";
    }
    c(`input strano ${JSON.stringify(String(strano).slice(0, 12))}: non lancia`, true, typeof esito === "object");
  }
}
