/** ── PROVE: I TESTI (T3) ─────────────────────────────────────────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), SPEC 2 (testi), 3.7 e 7.2. Sono le
 *  frasi che il CRM scrive al lead dentro la finestra delle 24 ore; il
 *  titolare può cambiarle in un solo file (`prenota-testi.ts`).
 *
 *  Cosa si prova: ogni testo con e senza nome, mai oltre 900 caratteri (i
 *  messaggi WhatsApp con pulsanti ne ammettono 1024), il link della stanza
 *  nella conferma una volta sola, e che dal lead non esca altro che il nome di
 *  battesimo (niente cognome, telefono, id, note).
 *
 *  Dati inventati. 2026-10-29 è un giovedì.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
export async function proveDeiTestiPrenota(mod, { c, gruppo }) {
  gruppo("PRENOTA · I TESTI (T3)");
  const X = mod["manychat/prenota-testi"];

  const P3 = [
    { g: "2026-10-29", o: "18:00" },
    { g: "2026-10-30", o: "17:30" },
    { g: "2026-11-02", o: "19:00" },
  ];
  const LINK = "https://hub.example.it/stanza/abc123";
  const URL_ = /https?:\/\/|www\./gi;
  const HA_URL = (t) => /https?:\/\/|www\./i.test(t);
  const CONTROLLO = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/;

  /** i controlli di forma che valgono per ogni testo */
  const forma = (nome, t) => {
    c(`${nome}: è testo non vuoto`, true, typeof t === "string" && t.trim().length > 0);
    c(`${nome}: al massimo 900 caratteri`, true, t.length <= 900);
    c(`${nome}: nessun carattere di controllo`, false, CONTROLLO.test(t));
    c(`${nome}: al massimo un a-capo doppio di fila`, false, /\n{3}/.test(t));
    c(`${nome}: né spazi ai bordi né doppi né prima di un a-capo`, false, t !== t.trim() || /  | \n|\n /.test(t));
    c(`${nome}: nessun «undefined», «null» o «[object»`, false, /\bundefined\b|\bnull\b|\[object|\bNaN\b/.test(t));
    c(`${nome}: nessuna virgola o punto orfani`, false, /(^|\s)[,.;:]/.test(t) || /,,|\.\./.test(t));
  };

  // ── Le frasi, parola per parola (il titolare le legge qui)
  c(
    "conferma: la frase della SPEC, con il link in una riga a sé",
    "Fatto! La consulenza è fissata per giovedì 29 ottobre alle 18:00 con Filippo.\n\n" +
      `Per collegarsi il giorno della consulenza:\n${LINK}\n\n` +
      "Le ricorderemo l'appuntamento anche con un messaggio.",
    X.testoConferma({ giorno: "2026-10-29", ora: "18:00", consulente: "Filippo", link: LINK }),
  );
  c(
    "conferma con nome",
    "Fatto, Anna! La consulenza è fissata per giovedì 29 ottobre alle 18:00 con Filippo.\n\n" +
      `Per collegarsi il giorno della consulenza:\n${LINK}\n\n` +
      "Le ricorderemo l'appuntamento anche con un messaggio.",
    X.testoConferma({ nome: "Anna", giorno: "2026-10-29", ora: "18:00", consulente: "Filippo", link: LINK }),
  );
  c(
    "proposte con 3 orari",
    "Anna, ecco gli orari liberi di sera per la consulenza gratuita:\n\n" +
      "Opzione 1: giovedì 29 ottobre alle 18:00\n" +
      "Opzione 2: venerdì 30 ottobre alle 17:30\n" +
      "Opzione 3: lunedì 2 novembre alle 19:00\n\n" +
      "Tocchi il pulsante dell'opzione che preferisce.\n" +
      "Nessuno va bene? Scriva ALTRI",
    X.testoProposte({ nome: "Anna", proposte: P3, fasciaChiesta: "sera", ripiego: false }),
  );
  c(
    "già fissata (SPEC 3.8)",
    "Ha già una consulenza fissata giovedì 29 ottobre alle 18:00 con Filippo. Se vuole cambiarla ci scriva e La aiutiamo.",
    X.testoGiaFissato({ giorno: "2026-10-29", ora: "18:00", consulente: "Filippo" }),
  );
  c(
    "nessun orario (SPEC 3.7)",
    "In questi giorni non ho orari liberi online. Un nostro consulente La contatta per trovare insieme l'orario.",
    X.testoNessunOrario({}),
  );
  c(
    "errore (SPEC 3.7)",
    "Non sono riuscito a completare la prenotazione. Un nostro consulente La contatta a breve.",
    X.testoErrore({}),
  );
  c(
    "orario preso (SPEC 3.7)",
    "Quell'orario è appena stato preso. Ecco quelli ancora liberi:\n\n" +
      "Opzione 1: giovedì 29 ottobre alle 18:00\n\n" +
      "Tocchi il pulsante dell'opzione che preferisce.\n" +
      "Nessuno va bene? Scriva ALTRI",
    X.testoPreso({ proposte: [P3[0]] }),
  );
  c("proposta vecchia (SPEC 3.7)", true,
    X.testoVecchia({ proposte: P3 }).startsWith("Gli orari che Le avevo mandato non sono più validi. Ecco quelli aggiornati:\n\n"));
  c("«quell'opzione non c'è»", true, X.testoOpzioneNonCe({ proposte: P3 }).startsWith("Quell'opzione non c'è. "));

  // ── Forma, con e senza nome
  const nomi = [undefined, null, "", "  ", "Anna", "anna maria", "  ANNA  "];
  const dueProposte = P3.slice(0, 2);
  const unaProposta = P3.slice(0, 1);
  const per = (nome) => ({ nome });
  const app = (nome) => ({ nome, giorno: "2026-10-29", ora: "18:00", consulente: "Filippo Demo", link: LINK });
  for (const nome of nomi) {
    const etichetta = `nome ${JSON.stringify(nome)}`;
    forma(`proposte (3) · ${etichetta}`, X.testoProposte({ nome, proposte: P3, fasciaChiesta: "sera" }));
    forma(`proposte (2) · ${etichetta}`, X.testoProposte({ nome, proposte: dueProposte, fasciaChiesta: "mattina" }));
    forma(`proposte (1) · ${etichetta}`, X.testoProposte({ nome, proposte: unaProposta }));
    forma(`conferma · ${etichetta}`, X.testoConferma(app(nome)));
    forma(`già fissato · ${etichetta}`, X.testoGiaFissato(app(nome)));
    forma(`preso · ${etichetta}`, X.testoPreso({ nome, proposte: P3 }));
    forma(`vecchia · ${etichetta}`, X.testoVecchia({ nome, proposte: P3 }));
    forma(`nessun orario · ${etichetta}`, X.testoNessunOrario(per(nome)));
    forma(`altri finiti · ${etichetta}`, X.testoAltriFiniti(per(nome)));
    forma(`errore · ${etichetta}`, X.testoErrore(per(nome)));
    forma(`opzione non c'è · ${etichetta}`, X.testoOpzioneNonCe({ nome, proposte: P3 }));
    forma(`attesa · ${etichetta}`, X.testoAttesa(per(nome)));
  }
  forma("attesa senza argomenti", X.testoAttesa());

  // ── Il nome: solo il nome di battesimo, con la maiuscola
  const conNome = (nome) => X.testoErrore({ nome });
  c("nome: «anna maria» → Anna", "Anna, non sono riuscito a completare la prenotazione. Un nostro consulente La contatta a breve.",
    conNome("anna maria"));
  c("nome: «ANNA» in maiuscolo → Anna", true, conNome("  ANNA  ").startsWith("Anna, "));
  c("nome: «D'Angelo» tiene l'apostrofo", true, conNome("D'Angelo").startsWith("D'Angelo, "));
  c("nome: «Anna-Maria» tiene il trattino", true, conNome("Anna-Maria Rossi").startsWith("Anna-Maria, "));
  c("nome: «Zoë» con la dieresi", true, conNome("zoë").startsWith("Zoë, "));
  c("nome: senza nome la frase comincia con la maiuscola e senza virgola",
    "Non sono riuscito a completare la prenotazione. Un nostro consulente La contatta a breve.", conNome(undefined));
  for (const strano of ["😊", "123", "http://cattivo.example", "www.cattivo.it", "a@b.it", "<b>x</b>", "\n\t", "..."]) {
    const t = X.testoErrore({ nome: strano });
    c(`nome strano ${JSON.stringify(strano)}: non entra nel testo`,
      "Non sono riuscito a completare la prenotazione. Un nostro consulente La contatta a breve.", t);
  }
  c("nome con un a-capo dentro: solo la prima parola", true,
    X.testoErrore({ nome: "Anna\nRossi" }).startsWith("Anna, non"));
  c("nome lunghissimo: tagliato a 30 lettere", true,
    X.testoErrore({ nome: "A".repeat(200) }).split(",")[0].length === 30);

  // ── Le proposte
  for (const [n, lista] of [[3, P3], [2, dueProposte], [1, unaProposta]]) {
    const t = X.testoProposte({ nome: "Anna", proposte: lista, fasciaChiesta: "sera" });
    c(`proposte (${n}): finisce con «Nessuno va bene? Scriva ALTRI»`, true, t.endsWith("Nessuno va bene? Scriva ALTRI"));
    c(`proposte (${n}): ${n} righe «Opzione», numerate da 1`,
      lista.map((_, i) => `Opzione ${i + 1}: `),
      t.split("\n").filter((r) => r.startsWith("Opzione ")).map((r) => r.slice(0, 11)));
    c(`proposte (${n}): non c'è un'opzione in più`, false, t.includes(`Opzione ${n + 1}`));
  }
  c("proposte: ne mostra al massimo 3 (i pulsanti sono 3)", 3,
    X.testoProposte({ proposte: [...P3, { g: "2026-11-03", o: "18:00" }] }).split("\n").filter((r) => r.startsWith("Opzione ")).length);
  c("proposte: ogni orario è «giorno data alle HH:MM»", true,
    X.testoProposte({ proposte: [{ g: "2026-11-03", o: "9:05" }] }).includes("Opzione 1: martedì 3 novembre alle 09:05\n"));
  c("proposte: fascia chiesta mattina", true,
    X.testoProposte({ proposte: [{ g: "2026-11-03", o: "09:00" }], fasciaChiesta: "mattina" }).startsWith("Ecco gli orari liberi di mattina "));
  c("proposte: fascia chiesta pomeriggio", true,
    X.testoProposte({ proposte: [{ g: "2026-11-03", o: "15:00" }], fasciaChiesta: "pomeriggio" }).startsWith("Ecco gli orari liberi del pomeriggio "));
  c("proposte: senza fascia (dopo «ALTRI») non nomina nessuna fascia", true,
    !/di mattina|del pomeriggio|di sera/.test(X.testoProposte({ proposte: P3 })));
  const rip = X.testoProposte({ nome: "Anna", proposte: [{ g: "2026-11-03", o: "15:00" }], fasciaChiesta: "sera", ripiego: true });
  c("ripiego: dice che di sera non c'è e offre il pomeriggio", true,
    rip.startsWith("Anna, di sera non ho orari liberi. Ecco quelli del pomeriggio:\n\n"));
  forma("ripiego", rip);
  c("ripiego nella stessa fascia chiesta: niente frase che si contraddice", true,
    X.testoProposte({ proposte: [{ g: "2026-11-03", o: "18:00" }], fasciaChiesta: "sera", ripiego: true })
      .startsWith("Ecco gli orari liberi di sera per la consulenza gratuita:"));
  c("ripiego: finisce comunque con ALTRI", true, rip.endsWith("Nessuno va bene? Scriva ALTRI"));
  c("proposte vuote: ripiega sul messaggio «nessun orario», mai una lista vuota",
    X.testoNessunOrario({ nome: "Anna" }), X.testoProposte({ nome: "Anna", proposte: [] }));
  c("preso/vecchia/non c'è con liste vuote: «nessun orario»", [true, true, true], [
    X.testoPreso({ proposte: [] }), X.testoVecchia({ proposte: [] }), X.testoOpzioneNonCe({ proposte: [] }),
  ].map((t) => t === X.testoNessunOrario({})));

  // ── Data e ora non valide: ripulite e corte, la conferma resta sotto i 900
  const ostile = "<b>https://cattivo.example/x</b>\n".repeat(40);
  const conOstile = X.testoConferma({ nome: "Anna", giorno: ostile, ora: ostile, consulente: "Filippo", link: LINK });
  forma("conferma con data e ora ostili", conOstile);
  c("data e ora ostili: nessun altro indirizzo oltre al link", 1, (conOstile.match(URL_) ?? []).length);
  c("data e ora ostili: niente < > nella riga dell'appuntamento", false, /[<>]/.test(conOstile.split("\n")[0]));
  c("data e ora ostili: la riga dell'appuntamento è corta", true, conOstile.split("\n")[0].length < 150);
  const proposteOstili = X.testoProposte({ proposte: [{ g: ostile, o: ostile }, ...P3.slice(0, 2)] });
  forma("proposte con un orario ostile", proposteOstili);
  c("orario ostile: le opzioni restano 3, numerate", 3, proposteOstili.split("\n").filter((r) => r.startsWith("Opzione ")).length);
  c("orario ostile: nessun indirizzo", false, HA_URL(proposteOstili));
  c("data e ora non valide ma innocue: scritte come arrivano", true,
    X.testoProposte({ proposte: [{ g: "2026-02-30", o: "25:00" }] }).includes("Opzione 1: 2026-02-30 alle 25:00\n"));

  // ── La conferma: giorno, ora, consulente e il link, una volta sola
  const lungoLink = "https://hub.example.it/stanza/" + "x".repeat(50); // 80 caratteri
  c("il link di prova è di 80 caratteri", 80, lungoLink.length);
  const lunga = X.testoConferma({
    nome: "N".repeat(40), giorno: "2026-10-29", ora: "18:00", consulente: "C".repeat(40) + " Cognome", link: lungoLink,
  });
  forma("conferma con link di 80 e nomi di 40", lunga);
  c("conferma lunga: il link c'è intero e una volta sola", 1, lunga.split(lungoLink).length - 1);
  c("conferma lunga: nessun altro indirizzo", 1, (lunga.match(URL_) ?? []).length);
  c("conferma lunga: sotto i 900 con margine (nomi tagliati a 30)", true, lunga.length < 600);
  c("conferma lunga: il cognome del consulente non c'è", false, lunga.includes("Cognome"));
  c("conferma: il link è in una riga a sé (niente punto attaccato)", true,
    X.testoConferma(app("Anna")).split("\n").includes(LINK));
  c("conferma: nomina giorno, ora e consulente", [true, true, true], (() => {
    const t = X.testoConferma(app("Anna"));
    return [t.includes("giovedì 29 ottobre"), t.includes("18:00"), t.includes("con Filippo.")];
  })());
  c("conferma: solo il nome di battesimo del consulente", false, X.testoConferma(app("Anna")).includes("Demo"));
  c("conferma: «Le scriviamo il link» non esiste più", false, /scriviamo il link/i.test(X.testoConferma(app("Anna"))));
  c("conferma senza consulente: non resta un «con» appeso", true,
    X.testoConferma({ giorno: "2026-10-29", ora: "18:00", link: LINK }).startsWith("Fatto! La consulenza è fissata per giovedì 29 ottobre alle 18:00.\n"));
  c("conferma: spazi e a-capo dentro il link non passano", true,
    X.testoConferma({ giorno: "2026-10-29", ora: "18:00", link: ` ${LINK}\n` }).includes(`:\n${LINK}\n\n`));
  c("conferma: le altre frasi non portano mai un link", [false, false, false, false, false], [
    X.testoGiaFissato(app("Anna")), X.testoPreso({ proposte: P3 }), X.testoVecchia({ proposte: P3 }),
    X.testoProposte({ proposte: P3 }), X.testoErrore({}),
  ].map((t) => HA_URL(t) || t.includes("stanza")));

  // ── Nessun dato oltre al nome di battesimo (SPEC 7.2)
  const scheda = {
    id: "lead-11111111-2222-3333-4444-555555555555",
    nome: "Maria Grazia",
    cognome: "Bianchi-Verdi",
    telefono: "+39 333 555 0147",
    email: "segreta@example.it",
    note: "allergica alla tinta, preventivo 1200 euro",
    consulenteId: "cons-9999",
    giorno: "2026-10-29",
    ora: "18:00",
    consulente: "Filippo",
    link: LINK,
    proposte: P3,
  };
  const tutti = [
    X.testoProposte(scheda), X.testoConferma(scheda), X.testoGiaFissato(scheda), X.testoPreso(scheda),
    X.testoVecchia(scheda), X.testoNessunOrario(scheda), X.testoAltriFiniti(scheda), X.testoErrore(scheda),
    X.testoOpzioneNonCe(scheda), X.testoAttesa(scheda),
  ];
  for (const sensibile of ["Bianchi", "Verdi", "333", "0147", "segreta", "example.it/segreta", "allergica", "1200", "cons-9999", "lead-1111", "5555", "Grazia"]) {
    c(`scheda piena di dati: «${sensibile}» non esce in nessun testo`, false, tutti.some((t) => t.includes(sensibile)));
  }
  c("scheda piena di dati: esce solo il nome di battesimo", true, tutti.some((t) => t.includes("Maria,")));

  // ── Pure: stesso ingresso, stesso testo; l'ingresso non si tocca
  const ingresso = { nome: "Anna", proposte: P3, fasciaChiesta: "sera" };
  const copia = JSON.stringify(ingresso);
  c("pura: due chiamate danno lo stesso testo", X.testoProposte(ingresso), X.testoProposte(ingresso));
  c("pura: l'ingresso non cambia", copia, JSON.stringify(ingresso));
}
