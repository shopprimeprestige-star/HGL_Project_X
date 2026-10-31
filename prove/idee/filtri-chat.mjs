/** ── PROVE: I FILTRI DELLA CHAT, A GRUPPI (30/10/2026) ───────────────────────
 *  Regole in src/crm/chatwa/filtri.ts. DAL 31/10/2026 I FILTRI SONO ESCLUSIVI: se ne accende uno solo
 *  alla volta (toccarne un altro spegne il primo); il consulente e la ricerca non sono filtri da
 *  azzerare e restano. Numeri «cosa vedresti se la scegliessi», «Da rispondere» come filtro, valori
 *  salvati non validi (più filtri salvati: ne resta uno).
 *  `passaFiltro` (cercaChat.ts) non cambia: le sue prove restano dove sono e qui si controlla che
 *  ogni voce vecchia, da sola, dia ESATTAMENTE le stesse chat di prima.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveFiltriChat(mod, { c, gruppo, radice }) {
  const F = mod["chatwa/filtri"];
  const { passaFiltro } = mod["chatwa/cercaChat"];
  const P = mod["chatwa/perStato"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  /** il sorgente senza commenti: le prove sui nomi guardano quello che si vede, non la storia */
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  // ── Un piccolo mondo di chat finte ────────────────────────────────────────────────────────────
  let n = 0;
  const chat = (o = {}) => {
    n++;
    const phone = `+39333000${String(n).padStart(4, "0")}`;
    const data = o.senzaScheda
      ? null
      : {
          stato: o.stato ?? "da_contattare",
          consulenteId: o.consulente ?? null,
          payment: o.acconto ? { accontoPagato: o.acconto } : null,
        };
    return {
      phone,
      unread: o.unread ?? 0,
      lead: data ? { data } : null,
      finestra: o.aperta === undefined ? null : { aperta: o.aperta },
      daRispondere: { attesa: o.attesa === true },
      stelle: o.stelle ?? 0,
    };
  };
  const mondo = [
    chat({ attesa: true, unread: 2, stato: "attesa_whatsapp", consulente: "luca" }),
    chat({ attesa: true, unread: 1, stato: "attesa_whatsapp", acconto: 100, stelle: 2 }),
    chat({ attesa: true, stato: "appuntamento_fissato", aperta: true, consulente: "luca" }),
    chat({ attesa: true, stato: "sta_valutando", unread: 1 }),
    chat({ attesa: true, senzaScheda: true }),
    chat({ stato: "appuntamento_fissato", aperta: false, consulente: "anna", stelle: 3 }),
    chat({ stato: "appuntamento_rifissato", aperta: false, acconto: 50 }),
    chat({ stato: "da_chiamare", consulente: "luca", stelle: 1 }),
    chat({ stato: "non_risponde", unread: 3 }),
    chat({ stato: "segreteria", consulente: "anna", acconto: 200, stelle: 2 }),
    chat({ stato: "per_ora_no", consulente: "luca" }),
    chat({ stato: "per_ora_no", acconto: 30 }),
    chat({ stato: "no_show" }),
    chat({ stato: "non_fatto", unread: 1, stelle: 1 }),
    chat({ senzaScheda: true, unread: 4, stelle: 3 }),
    chat({ senzaScheda: true }),
    chat({ stato: "sta_valutando", consulente: "anna" }),
    chat({ stato: "posa_in_sede", acconto: 500, consulente: "luca" }),
  ];
  const stelleDi = (tel) => mondo.find((x) => x.phone === tel)?.stelle ?? 0;
  const V = F.FILTRI_VUOTI;
  //  «Cliente assente» ha due valori (no_show, non_fatto): il filtro porta quello canonico.
  const NO_SHOW = P.filtroDelloStato("no_show");
  const con = (patch) => ({ ...V, ...patch });
  const passano = (f) => mondo.filter((x) => F.passaFiltri(x, f, stelleDi));
  const indice = (righe) => righe.map((x) => mondo.indexOf(x));

  gruppo("FILTRI CHAT: NIENTE DI OGGI SPARISCE (ogni voce vecchia, da sola, dà le stesse chat)");
  const vecchioNuovo = [
    ["with-lead", con({ tipo: "con-scheda" })],
    ["unknown", con({ tipo: "senza-scheda" })],
    ["da-chiamare", con({ coda: "da-chiamare" })],
    ["chiuso-24h", con({ finestra: "chiusa" })],
    ["aperto-24h", con({ finestra: "aperta" })],
    ["attesa-whatsapp", con({ fase: "attesa-whatsapp" })],
    ["per-ora-no", con({ fase: "per-ora-no" })],
    ["acconto", con({ acconto: true })],
  ];
  for (const [vecchio, nuovo] of vecchioNuovo)
    c(
      `«${vecchio}»: stesse chat di passaFiltro`,
      indice(mondo.filter((x) => passaFiltro(x, vecchio))),
      indice(passano(nuovo)),
    );
  c("nessun filtro = «Tutte»: ogni chat passa", mondo.length, passano(V).length);
  for (const s of P.STATI_PER_STATO)
    c(
      `stato «${s}»: stesse chat del filtro per stato`,
      indice(mondo.filter((x) => passaFiltro(x, P.filtroDelloStato(s)))),
      indice(passano(con({ fase: P.filtroDelloStato(s) }))),
    );
  c(
    "il consulente: solo i clienti assegnati a lui",
    indice(mondo.filter((x) => x.lead?.data?.consulenteId === "luca")),
    indice(passano(con({ consulente: "luca" }))),
  );
  c(
    "le stelle: solo le chat con 1, 2 o 3 stelle",
    indice(mondo.filter((x) => x.stelle > 0)),
    indice(passano(con({ stelle: true }))),
  );

  gruppo("FILTRI CHAT: IL MOTORE COMPONE ANCORA IN E (all'interfaccia ne arriva uno solo + il consulente)");
  c(
    "Attesa WhatsApp + Acconto versato: solo chi ha entrambi",
    1,
    passano(con({ fase: "attesa-whatsapp", acconto: true })).length,
  );
  c(
    "…ed è l'intersezione, non un'unione",
    indice(mondo.filter((x) => passaFiltro(x, "attesa-whatsapp") && passaFiltro(x, "acconto"))),
    indice(passano(con({ fase: "attesa-whatsapp", acconto: true }))),
  );
  c(
    "Da rispondere + Con stelle: solo chi ha entrambi",
    indice(mondo.filter((x) => x.daRispondere.attesa && x.stelle > 0)),
    indice(passano(con({ coda: "da-rispondere", stelle: true }))),
  );
  c(
    "«Con stelle» ora si combina con una fase (prima la spegneva)",
    indice(mondo.filter((x) => x.stelle > 0 && x.lead?.data?.stato === "attesa_whatsapp")),
    indice(passano(con({ stelle: true, fase: "attesa-whatsapp" }))),
  );
  c(
    "il consulente vale su tutto, anche «Da rispondere»",
    indice(
      mondo.filter(
        (x) =>
          x.daRispondere.attesa && x.lead?.data?.consulenteId === "luca",
      ),
    ),
    indice(passano(con({ coda: "da-rispondere", consulente: "luca" }))),
  );
  c(
    "«Da chiamare» ubbidisce anche agli altri gruppi (consulente + acconto)",
    indice(
      mondo.filter(
        (x) =>
          passaFiltro(x, "da-chiamare") &&
          x.lead?.data?.consulenteId === "anna" &&
          passaFiltro(x, "acconto"),
      ),
    ),
    indice(passano(con({ coda: "da-chiamare", consulente: "anna", acconto: true }))),
  );
  c(
    "sei gruppi accesi insieme: ogni condizione resta in E",
    0,
    passano(
      con({
        coda: "non-letti",
        stelle: true,
        fase: "attesa-whatsapp",
        finestra: "aperta",
        acconto: true,
        tipo: "con-scheda",
        consulente: "luca",
      }),
    ).length,
  );
  c(
    "la finestra vale solo per gli appuntamenti fissati (come oggi)",
    [true, false],
    [
      F.passaFiltri(mondo[2], con({ finestra: "aperta" }), stelleDi),
      F.passaFiltri(mondo[0], con({ finestra: "aperta" }), stelleDi),
    ],
  );

  gruppo("FILTRI CHAT: ESCLUSIVI, UNO SOLO ALLA VOLTA (31/10/2026)");
  const coda1 = F.commuta(V, "coda", "da-rispondere");
  const coda2 = F.commuta(coda1, "coda", "da-chiamare");
  c(
    "la seconda della coda prende il posto della prima",
    ["da-chiamare", 1],
    [coda2.coda, F.contaAccesi(coda2)],
  );
  c(
    "toccare di nuovo la voce accesa la spegne (torna «Tutte»)",
    V,
    F.commuta(coda2, "coda", "da-chiamare"),
  );
  c(
    "fase: Attesa WhatsApp poi Per ora no → solo l'ultima",
    "per-ora-no",
    F.commuta(F.commuta(V, "fase", "attesa-whatsapp"), "fase", "per-ora-no").fase,
  );
  c(
    "fase: poi uno degli «Altri stati» → solo quello",
    NO_SHOW,
    F.commuta(F.commuta(V, "fase", "per-ora-no"), "fase", NO_SHOW).fase,
  );
  // Tutte le coppie di voci di gruppi DIVERSI (e anche dello stesso): dopo la seconda ne resta una sola.
  const tutteLeVoci = [
    ...F.GRUPPI_FILTRI.flatMap((g) => g.voci),
    F.voceDelloStato(P.STATI_PER_STATO[0]),
  ];
  let coppieSbagliate = 0;
  for (const a1 of tutteLeVoci)
    for (const b1 of tutteLeVoci) {
      if (a1.campo === b1.campo && a1.valore === b1.valore) continue;
      const f = F.commuta(F.commuta(V, a1.campo, a1.valore), b1.campo, b1.valore);
      if (F.contaAccesi(f) !== 1 || !F.eAcceso(f, b1.campo, b1.valore) || F.eAcceso(f, a1.campo, a1.valore))
        coppieSbagliate++;
    }
  c(
    `toccare un'altra voce (${tutteLeVoci.length * (tutteLeVoci.length - 1)} coppie): il primo si spegne, resta solo il secondo`,
    0,
    coppieSbagliate,
  );
  c(
    "«Con stelle» spegne la coda (e viceversa): non si combinano",
    [true, null, "da-chiamare", false],
    ((a1, b1) => [a1.stelle, a1.coda, b1.coda, b1.stelle])(
      F.commuta(F.commuta(V, "coda", "da-rispondere"), "stelle", true),
      F.commuta(F.commuta(V, "stelle", true), "coda", "da-chiamare"),
    ),
  );
  c(
    "«Acconto versato» e «Senza scheda» (pannello) non si sommano",
    ["senza-scheda", false],
    ((f) => [f.tipo, f.acconto])(F.commuta(F.commuta(V, "acconto", true), "tipo", "senza-scheda")),
  );
  c(
    "«Con stelle» e «Acconto» sono interruttori: acceso/spento",
    [true, false],
    [
      F.commuta(V, "stelle", true).stelle,
      F.commuta(F.commuta(V, "stelle", true), "stelle", true).stelle,
    ],
  );
  const conLuca = con({ consulente: "luca" });
  c(
    "il consulente NON si azzera toccando una voce, né toccandola di nuovo",
    ["luca", "luca", "luca"],
    [
      F.commuta(conLuca, "fase", "per-ora-no").consulente,
      F.commuta(F.commuta(conLuca, "fase", "per-ora-no"), "tipo", "cliente").consulente,
      F.commuta(F.commuta(conLuca, "fase", "per-ora-no"), "fase", "per-ora-no").consulente,
    ],
  );
  c(
    "scegliere un consulente non spegne il filtro acceso",
    ["per-ora-no", "luca"],
    ((f) => [f.fase, f.consulente])(F.commuta(con({ fase: "per-ora-no" }), "consulente", "luca")),
  );
  c("commuta non muta l'ingresso", V, {
    coda: null,
    stelle: false,
    fase: null,
    finestra: null,
    acconto: false,
    tipo: null,
    consulente: "",
    ricontatti: false,
    io: "",
  });
  c(
    "soloUno: più filtri → ne resta uno, il più specifico (fase prima di coda), consulente intatto",
    { ...V, fase: "per-ora-no", consulente: "luca" },
    F.soloUno(con({ coda: "da-rispondere", stelle: true, fase: "per-ora-no", acconto: true, consulente: "luca" })),
  );
  c(
    "soloUno: uno solo o nessuno → uguale, e non muta l'ingresso",
    [V, con({ stelle: true })],
    [F.soloUno(V), F.soloUno(con({ stelle: true }))],
  );

  gruppo("FILTRI CHAT: «AZZERA», IL NUMERO SUL TASTO, LE ETICHETTE CON LA ✕");
  const molti = con({ fase: "attesa-whatsapp", acconto: true });
  c(
    "il numero sul tasto = i filtri accesi",
    [0, 2, 3],
    [F.contaAccesi(V), F.contaAccesi(molti), F.contaAccesi({ ...molti, consulente: "luca" })],
  );
  const nome = (id) => ({ luca: "Luca Rossi" })[id] ?? "?";
  c(
    "due etichette, nell'ordine dei gruppi, ognuna col suo campo",
    [
      ["fase", "Attesa WhatsApp"],
      ["acconto", "Acconto versato"],
    ],
    F.etichetteAccese(molti, nome).map((e) => [e.campo, e.etichetta]),
  );
  c(
    "togliere un'etichetta spegne solo quel gruppo",
    [1, null, true],
    ((f) => [F.contaAccesi(f), f.fase, f.acconto])(F.togli(molti, "fase")),
  );
  c(
    "un filtro per stato ha l'etichetta del CRM; il consulente il suo nome",
    ["Cliente assente", "Luca Rossi"],
    [
      F.etichetteAccese(con({ fase: NO_SHOW }), nome)[0].etichetta,
      F.etichetteAccese(con({ consulente: "luca" }), nome)[0].etichetta,
    ],
  );
  c(
    "«Azzera» (FILTRI_VUOTI) non lascia niente di acceso, consulente compreso",
    0,
    F.contaAccesi(F.FILTRI_VUOTI),
  );
  c(
    "con tutto acceso le etichette sono sette (una per gruppo + stelle)",
    7,
    F.etichetteAccese(
      con({
        coda: "non-letti",
        stelle: true,
        fase: "per-ora-no",
        finestra: "chiusa",
        acconto: true,
        tipo: "con-scheda",
        consulente: "luca",
      }),
      nome,
    ).length,
  );

  gruppo("FILTRI CHAT: NUMERI ONESTI (cosa vedresti se la scegliessi)");
  // Per OGNI stato dei filtri e OGNI voce: il numero = le righe che si vedono dopo averla scelta.
  const voci = [
    ...F.GRUPPI_FILTRI.flatMap((g) => g.voci),
    ...P.STATI_PER_STATO.map((s) => F.voceDelloStato(s)),
    { campo: "consulente", valore: "luca" },
    { campo: "consulente", valore: "anna" },
  ];
  const partenze = [
    V,
    con({ coda: "non-letti" }),
    con({ stelle: true }),
    con({ coda: "non-letti", stelle: true }),
    con({ fase: "attesa-whatsapp", acconto: true }),
    con({ coda: "da-chiamare", consulente: "anna" }),
    con({ coda: "da-rispondere", tipo: "con-scheda" }),
    con({ finestra: "chiusa", acconto: true, consulente: "luca" }),
    con({ consulente: "luca", stelle: true, tipo: "con-scheda" }),
  ];
  let disaccordi = 0;
  let positiviVuoti = 0;
  for (const f of partenze)
    for (const v of voci) {
      //  Esclusivi: la voce scelta prende il posto di quella accesa; il consulente resta.
      const dopo =
        v.campo === "consulente"
          ? { ...f, consulente: v.valore }
          : { ...V, consulente: f.consulente, [v.campo]: v.valore };
      const righe = mondo.filter((x) => F.passaFiltri(x, dopo, stelleDi));
      const numero = F.contaVoce(mondo, f, stelleDi, v.campo, v.valore);
      const attesoNumero =
        v.campo === "coda" && v.valore === "da-rispondere"
          ? righe.filter((x) => x.daRispondere.attesa).length
          : righe.length;
      if (numero !== attesoNumero) disaccordi++;
      if (numero > 0 && righe.length === 0) positiviVuoti++;
    }
  c(
    `il numero di ogni voce = le righe che si vedono (${partenze.length * voci.length} controlli)`,
    0,
    disaccordi,
  );
  c("nessuna combinazione mostra un numero maggiore di zero con l'elenco vuoto", 0, positiviVuoti);
  c(
    "da «Da rispondere», il numero di «Con stelle» = le chat con stelle da sole (la scelta sostituisce, non si somma)",
    [mondo.filter((x) => x.stelle > 0).length, true],
    [
      F.contaVoce(mondo, con({ coda: "da-rispondere" }), stelleDi, "stelle", true),
      F.contaVisibili(mondo, F.commuta(con({ coda: "da-rispondere" }), "stelle", true), stelleDi) ===
        F.contaVoce(mondo, con({ coda: "da-rispondere" }), stelleDi, "stelle", true),
    ],
  );
  c(
    "il numero di una voce non dipende da cosa è già acceso (tranne il consulente)",
    F.contaVoce(mondo, V, stelleDi, "coda", "da-chiamare"),
    F.contaVoce(mondo, con({ coda: "da-rispondere", acconto: true }), stelleDi, "coda", "da-chiamare"),
  );
  c(
    "il numero di «Da chiamare» tiene conto degli altri gruppi (consulente Anna)",
    mondo.filter((x) => passaFiltro(x, "da-chiamare") && x.lead?.data?.consulenteId === "anna")
      .length,
    F.contaVoce(mondo, con({ consulente: "anna" }), stelleDi, "coda", "da-chiamare"),
  );
  c(
    "una voce che si svuota resta contata a zero (non sparisce): Per ora no del consulente Anna",
    0,
    F.contaVoce(mondo, con({ consulente: "anna" }), stelleDi, "fase", "per-ora-no"),
  );
  c(
    "il numero di un consulente tiene il filtro acceso (il consulente si somma)",
    mondo.filter((x) => passaFiltro(x, "per-ora-no") && x.lead?.data?.consulenteId === "luca").length,
    F.contaVoce(mondo, con({ fase: "per-ora-no" }), stelleDi, "consulente", "luca"),
  );

  gruppo("FILTRI CHAT: «DA RISPONDERE» È ANCHE UN FILTRO");
  const attesa = mondo.filter((x) => x.daRispondere.attesa);
  c(
    "fa passare chi aspetta (l'ultimo messaggio è del cliente), senza altri riquadri",
    indice(attesa),
    indice(passano(con({ coda: "da-rispondere" }))),
  );
  c(
    "il numero della voce è quello del riquadro «Da rispondere»: gli stessi",
    attesa.length,
    F.contaVoce(mondo, V, stelleDi, "coda", "da-rispondere"),
  );
  c(
    "chi non aspetta e non è vecchio non passa",
    false,
    F.passaFiltri(mondo[7], con({ coda: "da-rispondere" }), stelleDi),
  );
  c(
    "è una coda: una sola alla volta con Da chiamare",
    "da-rispondere",
    F.commuta(F.commuta(V, "coda", "da-chiamare"), "coda", "da-rispondere").coda,
  );

  gruppo("FILTRI CHAT: NOMI, SPIEGAZIONI, ORDINE DEI GRUPPI");
  c(
    "i gruppi del pannello, in ordine",
    //  31/10/2026 (pannello più semplice): titoli brevi, «Pagamento» confluito in «Stato», «Ricontatti» in coda.
    ["Cosa fare adesso", "Stato", "Finestra 24h", "Chi", "Ricontatti"],
    F.GRUPPI_FILTRI.map((g) => g.titolo),
  );
  c(
    "le 3 voci sempre in vista, in ordine (niente «Non letti»)",
    ["Da rispondere", "Da chiamare", "Con stelle"],
    F.VOCI_GRIGLIA.map((v) => v.nome),
  );
  const nomi = F.GRUPPI_FILTRI.flatMap((g) => g.voci.map((v) => v.nome));
  c(
    "nomi nuovi, quelli del CRM per gli stati",
    [
      "Attesa WhatsApp",
      "Per ora no",
      "Si può scrivere",
      "Finestra chiusa",
      "Acconto versato",
      "Con scheda",
      "Senza scheda",
    ].every((x) => nomi.includes(x)),
    true,
  );
  c(
    "nessuno dei nomi oscuri di prima",
    false,
    nomi.some((x) =>
      /Chiuso 24h|24h aperto|Sconosciuti|Con lead|In osservazione|Per stato/.test(x),
    ),
  );
  c(
    "ogni voce del pannello ha la sua riga che spiega",
    true,
    F.GRUPPI_FILTRI.every((g) => g.voci.every((v) => v.spiega.length > 20)),
  );
  c(
    "«Finestra chiusa» ha il pallino rosso, «Si può scrivere» il verde",
    ["verde", "rosso"],
    [F.GRUPPI_FILTRI[2].voci[0].segno, F.GRUPPI_FILTRI[2].voci[1].segno],
  );
  c(
    "gli altri non hanno pallino (il colore non decora)",
    2,
    F.GRUPPI_FILTRI.flatMap((g) => g.voci).filter((v) => v.segno).length,
  );
  c(
    "«Altri stati»: gli stessi dell'elenco per stato del CRM, «Cliente assente» una volta sola",
    [P.STATI_PER_STATO.length, 1],
    [
      F.STATI_ALTRI.length,
      F.STATI_ALTRI.filter((s) => mod["types"].LEAD_STATUS_LABEL[s] === "Cliente assente").length,
    ],
  );
  c(
    "«Altri stati» non ripete Attesa WhatsApp, Da chiamare, Per ora no",
    [false, false, false],
    ["attesa_whatsapp", "da_chiamare", "per_ora_no"].map((s) => F.STATI_ALTRI.includes(s)),
  );

  gruppo("FILTRI CHAT: COSA SI RICORDA, E I VALORI SALVATI CHE NON ESISTONO PIÙ");
  const salvati = con({ fase: NO_SHOW, consulente: "luca" });
  const giro = F.leggiFiltri(F.scriviFiltriSessione(salvati), "luca");
  c("scritti e riletti sono uguali", salvati, giro);
  //  Salvati da una versione che li combinava: al caricamento ne resta uno solo, senza errori.
  const combinati = { coda: "da-rispondere", stelle: true, fase: NO_SHOW, acconto: true, tipo: "cliente" };
  c(
    "più filtri salvati: ne resta uno solo (il più specifico), il consulente resta",
    { ...V, fase: NO_SHOW, consulente: "luca" },
    F.leggiFiltri(JSON.stringify(combinati), "luca"),
  );
  c(
    "più filtri salvati senza fase: coda prima di stelle e tipo",
    { ...V, coda: "da-rispondere" },
    F.leggiFiltri(JSON.stringify({ coda: "da-rispondere", stelle: true, tipo: "cliente" }), null),
  );
  c(
    "più filtri salvati: mai più di un filtro acceso (escluso il consulente)",
    1,
    F.contaAccesi({ ...F.leggiFiltri(JSON.stringify(combinati), null), consulente: "" }),
  );
  c(
    "un filtro non valido salvato accanto a uno valido: vale il valido",
    { ...V, acconto: true },
    F.leggiFiltri(JSON.stringify({ fase: "stato:non_esiste", acconto: true }), null),
  );
  c("un «non-letti» salvato da una versione vecchia si ignora", null, F.leggiFiltri(JSON.stringify({ coda: "non-letti" }), null).coda);
  c(
    "il consulente NON sta nella sessione (ha il suo posto, che resta dopo la chiusura)",
    false,
    "consulente" in JSON.parse(F.scriviFiltriSessione(salvati)),
  );
  c("niente salvato: tutto spento", V, F.leggiFiltri(null, null));
  c("testo rotto: tutto spento, senza errori", V, F.leggiFiltri("{non json", ""));
  c(
    "non un oggetto (lista, numero): tutto spento",
    [V, V],
    [F.leggiFiltri("[1,2]", null), F.leggiFiltri("7", null)],
  );
  c(
    "stato scomparso dal CRM: la fase si ignora",
    null,
    F.leggiFiltri(JSON.stringify({ fase: "stato:non_esiste" }), null).fase,
  );
  c(
    "uno stato che ha già la sua voce (non è in «Altri stati»): non vale come stato",
    null,
    F.leggiFiltri(JSON.stringify({ fase: "stato:da_chiamare" }), null).fase,
  );
  c(
    "coda sconosciuta, finestra sconosciuta, tipo sconosciuto: si ignorano",
    [null, null, null],
    ((f) => [f.coda, f.finestra, f.tipo])(
      F.leggiFiltri(JSON.stringify({ coda: "x", finestra: "y", tipo: 3 }), null),
    ),
  );
  c(
    "tipi sbagliati (stringa al posto del booleano): spenti",
    [false, false],
    ((f) => [f.stelle, f.acconto])(
      F.leggiFiltri(JSON.stringify({ stelle: "si", acconto: 1 }), null),
    ),
  );
  c("un consulente salvato non-testo non rompe", "", F.leggiFiltri(null, undefined).consulente);
  const noti = new Set(["luca", "anna"]);
  c("consulente ancora in CRM: vale", "luca", F.filtriValidi(salvati, noti).consulente);
  c(
    "consulente cancellato: non filtra (e non resta un filtro acceso che non si vede)",
    ["", 1],
    ((f) => [f.consulente, F.contaAccesi(f)])(F.filtriValidi(salvati, new Set(["anna"]))),
  );
  c(
    "gli altri filtri non cambiano nel controllo del consulente",
    NO_SHOW,
    F.filtriValidi(salvati, new Set()).fase,
  );

  gruppo("FILTRI CHAT: COLLEGAMENTO NEI FILE");
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  const pannello = leggi("src/crm/chatwa/PannelloFiltri.tsx");
  const hookSalva = leggi("src/crm/chatwa/useFiltriChat.ts");
  const hook = leggi("src/crm/chatwa/useChatWa.ts");
  const tipi = leggi("src/crm/chatwa/tipi.ts");
  const cerca = leggi("src/crm/chatwa/cercaChat.ts");
  const viste = senzaCommenti(elenco) + senzaCommenti(pannello);
  c(
    "passaFiltro non è stato toccato: niente dei gruppi dentro",
    false,
    /filtri"|FiltriChat|passaFiltri/.test(cerca),
  );
  c(
    "ElencoChat compone i filtri con passaFiltri (non riscrive le regole)",
    true,
    /passaFiltri\(c, filtri, stelleDi\)/.test(elenco) &&
      !/passaFiltro\(/.test(senzaCommenti(elenco)),
  );
  c(
    "useChatWa tiene i filtri a gruppi, non più un filtro solo",
    true,
    /useFiltriChat\(user\?\.id\)/.test(hook) &&
      !/useState<FiltroChat>/.test(hook) &&
      /filtri: FiltriChat/.test(tipi) &&
      /setFiltri: \(f: FiltriChat\) => void/.test(tipi),
  );
  c(
    "il consulente sta su localStorage, gli altri filtri su sessionStorage, una chiave per utente",
    true,
    /hgl_chat_consulente_v1:\$\{utente\}/.test(hookSalva) &&
      /hgl_chat_filtri_v1:\$\{utente\}/.test(hookSalva) &&
      /window\.sessionStorage/.test(hookSalva) &&
      /window\.localStorage/.test(hookSalva),
  );
  c("la ricerca non si ricorda mai", false, /ricerca/i.test(senzaCommenti(hookSalva)));
  c(
    "se lo spazio del browser non c'è (navigazione privata) non si rompe",
    true,
    (hookSalva.match(/try \{/g) ?? []).length >= 2,
  );
  c(
    "ElencoChat: nessun nome oscuro di prima (tolto il commento, nel disegno)",
    false,
    /Chiuso 24h|24h aperto|Sconosciuti|Con lead|In osservazione|Per stato|Chiudono presto|soloStelle|FILA\b/.test(
      viste,
    ),
  );
  c(
    "il riquadro in scadenza ha il titolo nuovo",
    true,
    /Finestra in chiusura \(\{inScadenza\.length\}\) · scrivi ora, è gratis/.test(elenco),
  );
  c(
    "i titoli dei riquadri sono quelli nuovi",
    true,
    /Da rispondere \(\{inAttesa\.length\}\)/.test(elenco) &&
      /"Con stelle" : "Altre chat"/.test(elenco) &&
      /non di questo consulente/.test(elenco),
  );
  c(
    "elenco vuoto: «Nessuna chat con questi filtri» + «Azzera filtri»",
    true,
    /Nessuna chat con questi filtri/.test(elenco) && /Azzera filtri/.test(elenco),
  );
  c("titolo con il totale, «Tutte le chat»", true, /Tutte le chat/.test(elenco));
  c(
    "riepilogo «n di N chat» con una ✕ per etichetta",
    true,
    /\{trovate\.length\} di \{api\.chats\.length\} chat/.test(elenco) &&
      /Togli il filtro \$\{e\.etichetta\}/.test(elenco),
  );
  c(
    "annuncio per lo screen reader: aria-live educato con «N chat»",
    true,
    /role="status" aria-live="polite"/.test(elenco) && /\$\{trovate\.length\} chat/.test(elenco),
  );
  c(
    "riga unica dei filtri rapidi: scorre di lato, tasti da 44 px (h-11), aria-pressed",
    true,
    /RIGA_SCORREVOLE, "gap-2/.test(elenco) && /overflow-x-auto/.test(elenco) &&
      /aria-pressed=\{acceso\}/.test(elenco) &&
      /VOCI_RIGA\.map/.test(elenco) &&
      !/grid grid-cols-2/.test(elenco) &&
      (elenco.match(/flex h-11 shrink-0/g) ?? []).length >= 2,
  );
  c(
    "la riga, nell'ordine d'uso: Tutte · Da rispondere · Da chiamare · Con stelle · Sconosciuti · Ricontatti · Clienti (31/10: gli stati di chiamata solo dentro «Da chiamare»)",
    ["Da rispondere", "Da chiamare", "Con stelle", "Sconosciuti", "Ricontatti", "Clienti"],
    F.VOCI_RIGA.map((v) => v.nome),
  );
  {
    const tasto = readFileSync(join(process.cwd(), "src/crm/chatwa/PannelloFiltri.tsx"), "utf8");
    c(
      "con un consulente scelto il tasto «Filtri» ne porta il nome («Filtri · Giulia»), anche per lo screen reader",
      true,
      /p\.consulenti\.find\(\(x\) => x\.id === p\.filtri\.consulente\)/.test(tasto) &&
        /\{consulente && \(/.test(tasto) &&
        /consulente \$\{consulente\}/.test(tasto),
    );
  }
  //  ── «Non risponde» e «Da riprogrammare» in riga (31/10/2026): voci di fase già esistenti, nessuna regola nuova ──
  {
    const riga = (nome) => F.VOCI_RIGA.find((v) => v.nome === nome);
    //  31/10/2026, correzione del titolare: non stanno più nella riga generale
    //  («Non risponde» è un sottofiltro di «Da chiamare»; «Da riprogrammare» è in
    //  Filtri → Altri stati). Le voci restano, con le loro regole.
    c("«Non risponde» e «Da riprogrammare» NON sono nella riga generale", [undefined, undefined], [riga("Non risponde"), riga("Da riprogrammare")]);
    const NR = F.VOCE_NON_RISPONDE;
    const DR = F.VOCE_DA_RIPROGRAMMARE;
    const fraDue = (...v) => v.every(Boolean);
    c(
      "le due pastiglie sono voci della fase, con il valore del filtro per stato",
      [["fase", "stato:non_risponde"], ["fase", "stato:da_spostare"]],
      [[NR?.campo, NR?.valore], [DR?.campo, DR?.valore]],
    );
    c(
      "il nome è quello del CRM (non una parola nuova)",
      [mod["types"].LEAD_STATUS_LABEL.non_risponde, mod["types"].LEAD_STATUS_LABEL.da_spostare],
      [NR?.nome, DR?.nome],
    );
    c("ognuna spiega in una riga cosa mostra", true, fraDue(NR?.spiega?.length > 20, DR?.spiega?.length > 20));
    c(
      "il valore è una fase valida (si ricorda e si rilegge)",
      [true, true],
      [F.faseValida("stato:non_risponde"), F.faseValida("stato:da_spostare")],
    );
    //  Mondo: non_risponde (uno in «Da rispondere», uno di Luca), da_spostare (uno con tre stelle), da_chiamare.
    const nr1 = chat({ stato: "non_risponde" });
    const nr2 = chat({ stato: "non_risponde", attesa: true, consulente: "luca" });
    const ds1 = chat({ stato: "da_spostare", stelle: 3 });
    const ds2 = chat({ stato: "da_spostare", consulente: "luca" });
    const dc1 = chat({ stato: "da_chiamare" });
    const altro = chat({ stato: "sta_valutando" });
    const sc = chat({ senzaScheda: true });
    const m = [nr1, nr2, ds1, ds2, dc1, altro, sc];
    const stelle = (tel) => m.find((x) => x.phone === tel)?.stelle ?? 0;
    const quali = (f) => m.filter((x) => F.passaFiltri(x, f, stelle));
    const num = (f, v) => F.contaVoce(m, f, stelle, v.campo, v.valore);
    c("«Non risponde»: tutte le chat in quello stato, anche quella in «Da rispondere»", [nr1, nr2], quali(F.commuta(V, NR.campo, NR.valore)));
    c("«Da riprogrammare»: solo le chat in quello stato", [ds1, ds2], quali(F.commuta(V, DR.campo, DR.valore)));
    c("i numeri delle pastiglie", [2, 2], [num(V, NR), num(V, DR)]);
    c(
      "con un consulente il numero ne tiene conto (come le altre voci)",
      [1, 1],
      [num(con({ consulente: "luca" }), NR), num(con({ consulente: "luca" }), DR)],
    );
    //  Filtri esclusivi (main, 31/10): toccare una pastiglia spegne le altre voci; il consulente resta.
    c(
      "toccarla con «Con stelle» acceso spegne le stelle: restano solo le chat di quello stato",
      [con({ fase: DR.valore })],
      [F.commuta(con({ stelle: true }), DR.campo, DR.valore)],
    );
    c(
      "toccarla con la coda «Da chiamare» accesa spegne la coda",
      con({ fase: NR.valore }),
      F.commuta(con({ coda: "da-chiamare" }), NR.campo, NR.valore),
    );
    c(
      "il consulente scelto nel pannello resta e si somma (E)",
      [ds2],
      quali(F.commuta(con({ consulente: "luca" }), DR.campo, DR.valore)),
    );
    //  `passaFiltri` resta a gruppi in E: un filtro costruito a mano (non dal tocco) li somma ancora.
    c(
      "a livello di regola i gruppi diversi si sommano ancora (fase + stelle)",
      [ds1],
      quali(con({ fase: DR.valore, stelle: true })),
    );
    c(
      "fra loro si escludono (stessa fase): l'ultima sostituisce l'altra",
      "stato:da_spostare",
      F.commuta(F.commuta(V, NR.campo, NR.valore), DR.campo, DR.valore).fase,
    );
    c("un secondo tocco la spegne", null, F.commuta(F.commuta(V, DR.campo, DR.valore), DR.campo, DR.valore).fase);
    c(
      "la pastiglia «Non risponde» conta anche chi è in «Da rispondere» (il chip dentro «Da chiamare» no: i due numeri possono differire)",
      true,
      quali(F.commuta(V, NR.campo, NR.valore)).includes(nr2),
    );
    c("l'etichetta nel riepilogo dei filtri accesi è quella dello stato", "Da riprogrammare",
      F.etichetteAccese(F.commuta(V, DR.campo, DR.valore), () => "")[0]?.etichetta);
    c(
      "le due voci restano anche in «Altri stati» del pannello (stessi valori, nessun filtro nuovo)",
      [true, true],
      [F.STATI_ALTRI.includes("non_risponde"), F.STATI_ALTRI.includes("da_spostare")],
    );
  }
  c("«Tutte» è il primo tasto della riga", true, elenco.indexOf(">\n          Tutte\n") < elenco.indexOf("VOCI_RIGA.map"));
  c(
    "«Sconosciuti» è lo stesso filtro di «Senza scheda»: stesse chat, e senza «Non letti» nella riga",
    [indice(mondo.filter((x) => !x.lead)), false],
    [
      indice(passano(con({ tipo: "senza-scheda" }))),
      F.VOCI_RIGA.some((v) => /letti/i.test(v.nome)),
    ],
  );
  c(
    "stato della chiamata e quando richiamare: ci sono, in righe che scorrono (30/10/2026)",
    true,
    /aria-label="Stato della chiamata"/.test(elenco) &&
      /RIGA_SCORREVOLE/.test(elenco) &&
      /Quando richiamare/.test(elenco) &&
      /passaRichiamo\(c\.lead\?\.data, quandoAttivo, oggi\)/.test(elenco),
  );
  c(
    "il tasto Filtri porta il numero dei filtri accesi",
    true,
    /contaAccesi\(p\.filtri\)/.test(pannello) &&
      /<Contatore n=\{accesi\} acceso \/>/.test(pannello),
  );
  c(
    "pannello: foglio dal basso sul telefono, riquadro ancorato altrove",
    true,
    /side="bottom"/.test(pannello) &&
      /<PopoverTrigger asChild>/.test(pannello) &&
      /max-h-\[85dvh\]/.test(pannello) &&
      /70dvh/.test(pannello) &&
      /w-\[360px\]/.test(pannello) &&
      /lg:w-\[380px\]/.test(pannello),
  );
  c(
    "pannello: nel portale i token del CRM (crm-theme bg-white text-foreground), in entrambi",
    2,
    (
      senzaCommenti(pannello).match(
        /crm-theme[^"]*bg-white[^"]*text-foreground|crm-theme[^"]*text-foreground/g,
      ) ?? []
    ).length,
  );
  c(
    "pannello: Azzera, Mostra N chat, spiegazioni, Altri stati ripiegabile",
    true,
    /Azzera/.test(pannello) &&
      /Mostra \$\{mostra\} chat/.test(pannello) &&
      /voce\.spiega/.test(pannello) &&
      /aria-expanded=\{apertoAltri\}/.test(pannello) &&
      /Altri stati/.test(pannello),
  );
  c(
    "«Altri stati» si apre da solo se uno è scelto",
    true,
    /altroScelto/.test(pannello) && /altriAperti \|\| altroScelto/.test(pannello),
  );
  c(
    "consulente: tendina nativa «Tutti i consulenti», 16 px dove si tocca",
    true,
    /<select/.test(pannello) &&
      /Tutti i consulenti/.test(pannello) &&
      /text-base[^"]*lg:pointer-fine:text-\[13px\]/.test(pannello),
  );
  c(
    "bersagli: 44 px col dito (anche a 768), 32 dal computer col mouse",
    true,
    /min-h-11 lg:pointer-fine:min-h-8/.test(pannello) &&
      /h-11 lg:pointer-fine:h-8/.test(pannello) &&
      /min-h-11 lg:pointer-fine:min-h-8/.test(elenco) &&
      !/md:h-7|md:h-8/.test(elenco + pannello),
  );

  gruppo("FILTRI ESCLUSIVI E «TUTTE» COME WHATSAPP: COLLEGAMENTO (31/10/2026)");
  const elencoSC = senzaCommenti(elenco);
  c(
    "«Tutte» non ha più il riquadro «Senza scheda»: gli sconosciuti stanno nell'elenco unico",
    [false, false, false],
    [/Senza scheda/.test(elencoSC), /chatSenzaScheda|senzaSchedaCon|titolo-senza-scheda/.test(elencoSC), /\.\.\.senzaScheda/.test(elencoSC)],
  );
  c(
    "l'elenco «Tutte» è tutto ciò che resta dopo il blocco acconti, nell'ordine di WhatsApp",
    true,
    /ordinaComeWhatsapp\(\s*trovate\.filter\(\(c\) => !inBloccoTel\.has\(c\.phone\)\)/.test(elencoSC),
  );
  c(
    "il blocco «Acconto, da installare» e la barra del prossimo meet restano sopra l'elenco",
    true,
    /Acconto, da installare/.test(elenco) &&
      elenco.indexOf("<BarraProssimoMeet") < elenco.indexOf('id="titolo-da-installare"') &&
      elenco.indexOf('id="titolo-da-installare"') < elenco.indexOf("Tutte le chat, dall'ultimo messaggio"),
  );
  c(
    "la pastiglia «Sconosciuti» resta (il filtro per vederli a parte)",
    true,
    F.VOCI_RIGA.some((v) => v.nome === "Sconosciuti" && v.campo === "tipo" && v.valore === "senza-scheda"),
  );
  c(
    "la riga rapida e il pannello cambiano filtro solo con commuta (esclusivo)",
    true,
    //  La riga rapida usa la forma di main (fix/chat-filtro-unico, stesso comportamento): parte da
    //  FILTRI_VUOTI col consulente; il pannello passa da commuta, ora esclusiva.
    /commuta\(\{ \.\.\.FILTRI_VUOTI, consulente: filtri\.consulente \}, v\.campo, v\.valore\)/.test(elenco) &&
      /onCambia\(commuta\(filtri, v\.campo, v\.valore\)\)/.test(pannello),
  );
  c(
    "«Altri stati»: gli stati con chat si contano senza altri filtri (solo il consulente)",
    true,
    /passaFiltri\(\s*c,\s*\{ \.\.\.FILTRI_VUOTI, consulente: filtri\.consulente \},\s*stelleDi,?\s*\)/.test(elencoSC),
  );
  c(
    "il pannello lo dice: un filtro alla volta, il consulente si somma",
    [true, false],
    [/un filtro alla volta/i.test(pannello), /Gruppi diversi si sommano/.test(pannello)],
  );
  c(
    "il salvataggio passa da leggiFiltri, che tiene un filtro solo",
    true,
    /leggiFiltri\(/.test(hookSalva) && /soloUno\(/.test(leggi("src/crm/chatwa/filtri.ts")),
  );

  gruppo("FILTRI CHAT: CARATTERI E COLORI");
  c(
    "caratteri: solo la scala t-* (nessuna misura scritta a mano nei nuovi pezzi)",
    false,
    /text-\[\d/.test(pannello.replace(/lg:pointer-fine:text-\[13px\]/g, "")) ||
      /text-\[1\d/.test(elenco.replace(/lg:pointer-fine:text-\[13px\]/g, "")),
  );
  c(
    "titolo del pannello t-riga 600, titolo di gruppo t-etichetta 600, nota t-nota",
    true,
    /t-riga font-semibold/.test(pannello) &&
      /t-etichetta font-semibold uppercase tracking-wide/.test(pannello) &&
      /t-nota mt-0\.5 block/.test(pannello),
  );
  c(
    "contatore: t-etichetta, h-5, min-w-5, rounded-full, tabular-nums",
    true,
    /t-etichetta inline-flex h-5 min-w-5[^"]*rounded-full[^"]*tabular-nums/.test(pannello),
  );
  c(
    "acceso = UN solo colore: pieno primario (livello 1) e primario chiaro (livello 2)",
    true,
    /bg-primary text-primary-foreground/.test(pannello) &&
      /bg-primary text-primary-foreground/.test(elenco) &&
      /bg-primary\/10 text-\[color-mix\(in_oklab,var\(--primary\),black_25%\)\]/.test(elenco),
  );
  c(
    "nessun verde, azzurro o ambra come «acceso»: sky mai; emerald solo nel pallino; amber solo urgenza e stella",
    [0, 1],
    [(viste.match(/\bsky-/g) ?? []).length, (viste.match(/emerald-/g) ?? []).length],
  );
  c(
    "ambra: badge di «Da rispondere» se N > 0, riquadri, stella",
    true,
    /urgente && n > 0\s*\? "bg-amber-100 text-amber-900"/.test(pannello) &&
      /border-amber-200 bg-amber-50 text-amber-900/.test(elenco),
  );
  c(
    "rosso: pallino «Finestra chiusa» e richiami «Scaduti»",
    true,
    /bg-red-600/.test(pannello) && /x\.v === "scaduti"/.test(elenco) && /allarme[\s\S]{0,80}red-700/.test(elenco),
  );
  c(
    "il fuoco è un contorno pieno (non l'anello al 40%)",
    true,
    /focus-visible:outline-primary/.test(pannello) && !/group-focus-visible:ring/.test(elenco),
  );

  //  Contrasti MISURATI (30/10/2026, oklch dei token → sRGB, WCAG): bianco su primario 4,74; primario su
  //  bianco 4,88; badge ambra 8,2; muted-foreground su bianco 6,5. Sotto il minimo c'erano: bianco al 90%
  //  su primario (4,15), badge bianco al 20% (3,4), primario su primario al 10% (4,26), bordo `border`
  //  su bianco (1,35 contro 3), stella ambra-500 (2,15), pallino emerald-600 (3,8).
  c(
    "contrasto: mai testo bianco semitrasparente sul pieno primario",
    false,
    /primary-foreground\/\d/.test(viste),
  );
  c(
    "contrasto: il badge nel pulsante acceso è bianco pieno con testo primario (4,9:1)",
    true,
    /"bg-primary-foreground text-primary"/.test(pannello),
  );
  c(
    "contrasto: i controlli spenti hanno il bordo a 3:1 (muted-foreground al 70%)",
    true,
    /BORDO_TASTO = "border-muted-foreground\/70"/.test(pannello) &&
      (viste.match(/BORDO_TASTO/g) ?? []).length >= 8,
  );
  c(
    "contrasto: stella ambra-600 (3,2:1) e pallino verde emerald-700 (5,5:1)",
    [true, true],
    [/text-amber-600/.test(elenco), /bg-emerald-700/.test(pannello)],
  );
}
export function proveSconosciutiDaChiamare(mod, { c, gruppo }) {
  gruppo("CHAT: I NUMERI SENZA SCHEDA CON LA FINESTRA CHIUSA SONO DA CHIAMARE (30/10/2026)");
  const D = mod["chatwa/daChiamare"];
  c("senza scheda, finestra chiusa: da chiamare", "da_chiamare", D.statoChiamata({ lead: null, finestra: { aperta: false } }));
  c("senza scheda, finestra aperta o non calcolata: no", [null, null], [D.statoChiamata({ lead: null, finestra: { aperta: true } }), D.statoChiamata({ lead: null })]);
  c("con lo STOP o con più schede: no", [null, null], [D.statoChiamata({ lead: null, finestra: { aperta: false }, stop: true }), D.statoChiamata({ lead: null, finestra: { aperta: false }, schedaAmbigua: true })]);
  c("con la scheda vale lo stato come prima", [null, "non_risponde"], [D.statoChiamata({ lead: { data: { stato: "fatto" } }, finestra: { aperta: false } }), D.statoChiamata({ lead: { data: { stato: "non_risponde" } } })]);
  c("contano nel sottofiltro «Da chiamare»", 1, D.contaSottofiltri([{ lead: null, finestra: { aperta: false } }]).da_chiamare);
}
