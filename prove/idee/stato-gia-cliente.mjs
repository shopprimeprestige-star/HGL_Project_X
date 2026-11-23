/** ── PROVE: STATO «GIÀ CLIENTE NOSTRO» (commessa 2026-11-23-stato-gia-cliente) ──
 *  Chi ha già comprato da noi ma riscrive (es. su WhatsApp) e rientra come lead nuovo: lo stato
 *  `gia_cliente` lo toglie dalla coda del setter, dai messaggi automatici e dai numeri, senza
 *  farlo passare per una vendita. Nessuna migrazione: lo stato è solo testo in `crm_leads.data`.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const OGGI = new Date();
const GIORNO = `${OGGI.getFullYear()}-${String(OGGI.getMonth() + 1).padStart(2, "0")}-${String(OGGI.getDate()).padStart(2, "0")}`;
const creato = `${GIORNO}T08:00:00.000Z`;

const scheda = (id, data) => ({
  id,
  user_id: "u",
  created_at: creato,
  updated_at: creato,
  data: { nome: "Prova", cognome: id, telefono: "", createdAt: creato, consulenteId: "m", ...data },
});
const consulente = (id) => ({
  id,
  user_id: "u",
  created_at: creato,
  updated_at: creato,
  data: {
    nome: `Cons ${id}`,
    attivo: true,
    giorniLavorativi: [0, 1, 2, 3, 4, 5, 6],
    fasceOrarie: [{ inizio: "09:00", fine: "13:00" }],
    pause: [],
    indisponibilita: [],
    faSetter: true,
    faConsulente: true,
  },
});

export function proveStatoGiaCliente(mod, { c, gruppo, radice }) {
  const T = mod["types"];
  const K = mod["kpi-calcoli"];
  const S = mod["kpi-setter"];
  const N = mod["kpi-netto"];
  const B = mod["conta-nei-kpi"];
  const F = mod["chatwa/filtri"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");

  gruppo("GIÀ CLIENTE · ETICHETTA, FASE E COLORE");
  c("l'etichetta", "Già cliente nostro", T.LEAD_STATUS_LABEL.gia_cliente);
  c("fase «chiusa»: né aperta, né vinta, né persa", "chiusa", T.LEAD_STATUS_PHASE.gia_cliente);
  c("tinta propria verde-acqua, diversa da «Chiuso/archiviato» e dal verde dell'incasso", true,
    /teal|cyan/.test(T.LEAD_STATUS_COLOR.gia_cliente) &&
      T.LEAD_STATUS_COLOR.gia_cliente !== T.LEAD_STATUS_COLOR.concluso &&
      T.LEAD_STATUS_COLOR.gia_cliente !== T.LEAD_PHASE_COLOR.vinta);
  c("gli altri stati non cambiano colore", [T.LEAD_PHASE_COLOR.chiusa, T.LEAD_PHASE_COLOR.vinta], [T.LEAD_STATUS_COLOR.concluso, T.LEAD_STATUS_COLOR.venduto]);

  gruppo("GIÀ CLIENTE · DOVE SI SCEGLIE");
  c("fra tutti gli stati (filtri, pipeline, esiti di chiamata)", [true, true], [T.ALL_LEAD_STATUSES.includes("gia_cliente"), T.POST_CALL_STATUSES.includes("gia_cliente")]);
  c("fra gli stati da scegliere", true, T.SELECTABLE_LEAD_STATUSES.includes("gia_cliente"));
  c("lead di una lista (setter in chat e importati): nel menu", true, T.statiPer({ importato: true }).includes("gia_cliente"));
  c("lead già avviato: nel menu", true, T.statiPer({}).includes("gia_cliente"));
  c("compare una volta sola per elenco", [1, 1, 1], [T.statiPer({ importato: true }), T.statiPer({}), T.SELECTABLE_LEAD_STATUSES].map((e) => e.filter((s) => s === "gia_cliente").length));
  c("non cambia nessuna etichetta esistente", ["Concluso", "Per ora no", "Attesa WhatsApp"].length, [T.LEAD_STATUS_LABEL.concluso, T.LEAD_STATUS_LABEL.per_ora_no, T.LEAD_STATUS_LABEL.attesa_whatsapp].filter(Boolean).length);
  const selettore = leggi("src/crm/SelettoreStatoDialog.tsx");
  c("nel selettore ha la sua icona", true, /gia_cliente: \w+/.test(selettore));

  gruppo("GIÀ CLIENTE · NON È UNA VENDITA");
  c("NON è fra gli stati vinti né una chiusura vinta", [false, false], [T.STATI_VINTI.includes("gia_cliente"), T.eChiusuraVinta("gia_cliente")]);
  c("NON è fra gli stati di conversione (fatturato, conversioni, notifiche)", false, K.STATI_CONVERSIONE.includes("gia_cliente"));
  c("eConversione resta falsa", false, K.eConversione({ data: { stato: "gia_cliente" } }));
  c("NON è in «Da chiamare»: esce dalla coda del setter", [false, false], [T.STATI_DA_CHIAMARE.includes("gia_cliente"), T.eStatoDaChiamare("gia_cliente")]);
  c("applyAutoStatus non la tocca senza acconto", "gia_cliente", T.applyAutoStatus({ stato: "gia_cliente", payment: { accontoPagato: 0 } }).stato);
  c("con un acconto vero torna a contare come vendita normale (riacquisto)", true, T.eChiusuraVinta(T.applyAutoStatus({ stato: "gia_cliente", payment: { accontoPagato: 200 } }).stato));
  c("eGiaCliente: solo lo stato, anche da testo grezzo", [true, false, false, false], [T.eGiaCliente("gia_cliente"), T.eGiaCliente("venduto"), T.eGiaCliente(null), T.eGiaCliente(undefined)]);

  gruppo("GIÀ CLIENTE · FILTRO «CLIENTI» DELLA CHAT");
  c("eClienteNostro: chi ha comprato O è già cliente", [true, true, true, false, false], [
    K.eClienteNostro({ data: { stato: "gia_cliente" } }),
    K.eClienteNostro({ data: { stato: "posa_in_sede" } }),
    K.eClienteNostro({ data: { stato: "da_contattare", payment: { accontoPagato: 200 } } }),
    K.eClienteNostro({ data: { stato: "da_chiamare" } }),
    K.eClienteNostro({ data: { stato: "annullato" } }),
  ]);
  const chat = (data) => ({ phone: "+39" + Math.random(), lead: data ? { id: "x", data } : null, finestra: null });
  const fc = { ...F.FILTRI_VUOTI, tipo: "cliente" };
  const nessuno = () => 0;
  c("il filtro «Clienti» mostra il «già cliente»", true, F.passaFiltri(chat({ stato: "gia_cliente" }), fc, nessuno));
  c("…e le vendite come prima", true, F.passaFiltri(chat({ stato: "venduto" }), fc, nessuno));
  c("…ma non chi è ancora da chiamare, né chi non ha scheda", [false, false], [F.passaFiltri(chat({ stato: "da_chiamare" }), fc, nessuno), F.passaFiltri(chat(null), fc, nessuno)]);
  c("il filtro per stato «Già cliente nostro» nasce da solo", true, mod["chatwa/perStato"].STATI_PER_STATO.includes("gia_cliente"));
  const testi = leggi("src/crm/chatwa/filtri.ts");
  c("la spiegazione di «Clienti» dice anche «Già cliente nostro» (nel pannello e nella riga)", 2, (testi.match(/segnato «Già cliente nostro»/g) ?? []).length);
  c("il filtro «Clienti» legge eClienteNostro, non più eConversione da solo", true, /!eClienteNostro\(c\.lead/.test(testi));

  gruppo("GIÀ CLIENTE · FUORI DAI KPI (UNA PORTA SOLA)");
  c("contaNeiKpi: «già cliente» non conta", false, B.contaNeiKpi(scheda("a", { stato: "gia_cliente" })));
  c("tutti gli altri stati e i lead senza stato contano come prima", [true, true, true, true], [
    B.contaNeiKpi(scheda("a", { stato: "da_chiamare" })),
    B.contaNeiKpi(scheda("a", { stato: "venduto" })),
    B.contaNeiKpi(scheda("a", {})),
    B.contaNeiKpi(scheda("a", { stato: "concluso" })),
  ]);
  c("righe senza data o null: contano, non rompono", [true, true, true], [B.contaNeiKpi({}), B.contaNeiKpi(null), B.contaNeiKpi({ data: null })]);
  c("il blocco orario esclude ancora", false, B.contaNeiKpi(scheda("a", { soloBlocco: true })));
  c("soloNeiKpi toglie i «già cliente»", ["a"], B.soloNeiKpi([scheda("a", { stato: "da_chiamare" }), scheda("x", { stato: "gia_cliente" })]).map((l) => l.id));
  const senza = [scheda("a", { stato: "da_chiamare" }), scheda("b", {})];
  c("senza «già cliente» l'elenco è la stessa lista (nessuna copia)", true, B.soloNeiKpi(senza) === senza);

  //  ── I NUMERI: 10 lead, 2 «già cliente» ─────────────────────────────────
  const veri = [
    scheda("l1", { stato: "appuntamento_fissato", dataMeeting: GIORNO, oraMeeting: "10:00", durataMeeting: 45 }),
    scheda("l2", { stato: "fatto", dataMeeting: GIORNO, oraMeeting: "11:00" }),
    scheda("l3", { stato: "venduto", dataMeeting: GIORNO, oraMeeting: "12:00", payment: { prezzoFinaleVendita: 1000, accontoPagato: 300 } }),
    scheda("l4", { stato: "no_show", dataMeeting: GIORNO, oraMeeting: "09:00" }),
    scheda("l5", { stato: "da_contattare", consulenteId: "s" }),
    scheda("l6", { stato: "da_chiamare", consulenteId: "s" }),
    scheda("l7", { stato: "annullato", consulenteId: "s" }),
    scheda("l8", { stato: "posa_in_sede", dataMeeting: GIORNO, oraMeeting: "12:30", payment: { prezzoFinaleVendita: 800, accontoPagato: 200 } }),
  ];
  //  Due «già cliente» scritti apposta per muovere ogni numero se contassero: con la data di oggi
  //  (lead, appuntamento, consulenza) e con soldi sulla scheda (fatturato, cliente).
  const giaClienti = [
    scheda("g1", { stato: "gia_cliente", dataMeeting: GIORNO, oraMeeting: "13:00", payment: { prezzoFinaleVendita: 500, accontoPagato: 100 } }),
    scheda("g2", { stato: "gia_cliente", consulenteId: "s" }),
  ];
  const tutti = [...veri, ...giaClienti];
  c("l'insieme è di 10 lead, 2 «già cliente»", [10, 2], [tutti.length, tutti.filter((l) => l.data.stato === "gia_cliente").length]);
  const consulenti = [consulente("m"), consulente("s")];
  const spese = [{ id: "s1", user_id: "u", created_at: creato, updated_at: creato, data: { data: GIORNO, campagna: "x", fonte: "meta", importoSpeso: 100, leadGenerati: 0, meetFissati: 0, conversioni: 0 } }];
  const tutto = K.creaFiltroPeriodo("tutto");
  const uguali = (nome, fn) => c(nome, JSON.stringify(fn(veri)), JSON.stringify(fn(tutti)));

  gruppo("GIÀ CLIENTE · CON 2 «GIÀ CLIENTE» SU 10 I NUMERI SONO COME SE NON CI FOSSERO");
  uguali("riepilogo generale lordo: lead, appuntamenti, consulenze, clienti, tasso di chiusura, fatturato", (l) => K.calcolaMetricheGenerali(l, spese, tutto, true));
  uguali("riepilogo generale netto", (l) => K.calcolaMetricheGenerali(l, spese, tutto, false));
  uguali("tabella per consulente: lead, consulenze, tasso di chiusura, classifica", (l) => K.calcolaMetricheConsulenti(l, consulenti, spese, tutto));
  uguali("dettaglio per giorno", (l) => K.calcolaGiorni(l, spese, tutto));
  uguali("meet fissati oggi/ieri/altro ieri", (l) => K.meetFissatiUltimiTreGiorni(l));
  uguali("setter: assegnati, fissati, presentati, no-show", (l) => S.calcolaMetricheSetter(l, consulenti, tutto));
  uguali("conto netto (fatturato, margini)", (l) => N.calcolaContoNetto(l, spese, tutto));
  uguali("feed AIOS (api.aios.kpi)", (l) =>
    mod["kpi/aios-feed"].costruisciFeedKpi({ adesso: OGGI, oggi: GIORNO, leads: l, pubblici: {}, spesaMeta: [], spesaTiktok: [], aMano: spese, tiktokAlGiorno: 0 }),
  );

  gruppo("GIÀ CLIENTE · LA PROVA È SENSIBILE E I LEAD DI PRIMA NON CAMBIANO");
  const comeVendita = giaClienti.map((l) => ({ ...l, data: { ...l.data, stato: "posa_in_sede" } }));
  const gen = (l) => K.calcolaMetricheGenerali(l, spese, tutto, true);
  c("gli stessi due, se fossero vendite normali, cambierebbero lead e clienti", true,
    gen([...veri, ...comeVendita]).lead > gen(veri).lead && gen([...veri, ...comeVendita]).conversioni > gen(veri).conversioni);
  c("0 «già cliente»: i numeri sono identici a oggi (stessi dati, stessa lista)", JSON.stringify(gen(veri)), JSON.stringify(gen(B.soloNeiKpi(veri))));
  c("da «già cliente» a chiusura vinta la scheda torna a contare come vendita", [false, true, true], [
    B.contaNeiKpi(giaClienti[0]),
    B.contaNeiKpi(comeVendita[0]),
    K.eConversione(comeVendita[0]),
  ]);

  gruppo("GIÀ CLIENTE · LA RETE DEI KPI: nessun calcolo legge lo stato a mano");
  c("nessun calcolo legge «gia_cliente» a mano (solo la porta unica)", [], [
    "src/crm/kpi-calcoli.ts", "src/crm/kpi-setter.ts", "src/crm/kpi-netto.ts", "src/crm/kpi/aios-feed.ts", "src/crm/ConsultantsPerformance.tsx", "src/crm/ads-financials.functions.ts",
  ].filter((f) => /gia_cliente|eGiaCliente/.test(leggi(f))));
  c("la rete dei file che contano (prova «solo blocco») resta in piedi e usa la stessa porta", true, /soloNeiKpi\(/.test(leggi("src/crm/kpi-calcoli.ts")) && /contaNeiKpi/.test(leggi("src/crm/conta-nei-kpi.ts")));

  gruppo("GIÀ CLIENTE · NESSUN MESSAGGIO AUTOMATICO");
  c("nessun messaggio per stato (TABELLA_STATI)", false, "gia_cliente" in mod["manychat/stati"].TABELLA_STATI);
  c("il giro non lo conosce come lead nuovo", false, mod["manychat/sequenze"].STATI_LEAD_NUOVO.includes("gia_cliente"));
  {
    //  Il ritorno (hgl_ritorno: «Vuole fissare la consulenza gratuita?») a un già cliente NON parte.
    const SEQ = mod["manychat/sequenze"];
    const ULTIMO = "2026-10-27T08:00:00.000Z";
    const rit = (stato, extra) => ({
      id: "r-1",
      data: { nome: "Dario", telefono: "333 000 0001", stato, importato: true, ricarico: { volte: 2, ultimo: ULTIMO, daDecidere: true }, ...extra },
    });
    const giro = (s) =>
      SEQ.decidiLeadNuovi([s], new Date("2026-10-27T10:00:00+01:00"), {
        consulenti: [{ id: "cons-1", data: { nome: "Filippo Demo", attivo: true, faConsulente: true, faSetter: false } }],
        invii: [],
        tetti: { ricontatti: 20, leadNuovi: 100, totale: 100 },
        fraseModuloDal: null,
        leadNuovoDal: "2026-10-20T06:00:00.000Z",
      });
    c("controllo: lo stesso ritorno in «Non risponde» riceve il messaggio", ["invia"], giro(rit("non_risponde")).filter((x) => x.tipo === "invia").map((x) => x.tipo));
    c("«già cliente» tornato da modulo: nessun messaggio, nemmeno un «salta»", [], giro(rit("gia_cliente")));
    c("…e se il suo stato di prima era di primo contatto ma ora è «già cliente»", [], giro(rit("gia_cliente", { ricarico: { volte: 2, ultimo: ULTIMO, daDecidere: true, inAttesaIl: ULTIMO, statoAllora: "non_risponde" } })));
    c("«già cliente» nuovo da modulo, senza ritorno: niente primo contatto", [], giro(rit("gia_cliente", { ricarico: undefined })));
  }
  {
    //  Il ritorno da modulo/foglio non sposta lo stato in «Attesa WhatsApp»: si perderebbe.
    const RIC = mod["importa/ricarico"];
    const ORA = new Date("2026-11-23T10:00:00Z");
    const p = RIC.patchRicarico({ nome: "Ada", telefono: "+393330000001", stato: "gia_cliente" }, "Lista.csv", ORA);
    c("un rientro da modulo/foglio lascia «già cliente» com'è", [undefined, undefined], [p?.stato, p?.statoPrecedente]);
    c("…mentre «non risponde» viene ancora spostato (controllo)", "attesa_whatsapp", RIC.patchRicarico({ nome: "Ada", telefono: "+393330000001", stato: "non_risponde" }, "Lista.csv", ORA)?.stato);
    c("…e il giro del server (ritorno rimasto indietro) non lo sposta", null, RIC.patchRitornoRimastoIndietro({ nome: "Ada", telefono: "+393330000001", stato: "gia_cliente", ricarico: { volte: 1, ultimo: "2026-10-25T09:00:00Z", daDecidere: true, statoAllora: "gia_cliente" } }, ORA));
  }
  c("il bot di prenotazione lo respinge già («stato non ammesso»)", true, /stato non ammesso/.test(leggi("src/crm/manychat/prenota-scheda.ts")));

  gruppo("GIÀ CLIENTE · LA PAGINA «TELEFONO» NON SI LAMENTA");
  {
    const tel = leggi("src/crm/kpi/TelefonoScheda.tsx");
    c("gli stati di primo contatto senza esito, escluso «già cliente», sono zero (nessun avviso in pagina)", true, /PRIMI_SENZA_ESITO = STATI_PRIMO_CONTATTO\.filter\([^)]*gia_cliente/.test(tel) || /eGiaCliente/.test(tel));
    c("e i «già cliente» non arrivano comunque alla pagina (leadsKpi)", true, /leadsKpi/.test(tel));
  }

  gruppo("GIÀ CLIENTE · L'AVVISO «RISULTA GIÀ CLIENTE» NELLA SCHEDA");
  {
    const L = leggi("src/crm/LeadDialog.tsx");
    c("cerca fra le schede con lo stesso numero una che è già cliente (eClienteNostro)", true, /doppioni\.find\(\(l\) => l\.data && eClienteNostro\(l\)\)/.test(L));
    c("non lo mostra se questa scheda lo è già", true, /!eClienteNostro\(\{ data: form \}\)/.test(L));
    c("il testo è «Risulta già cliente: vedi scheda …» e porta alla scheda", true, /Risulta già cliente: vedi scheda/.test(L) && /clienteAltrove && \(\s*<button/.test(L));
    c("la riga «Già cliente nostro» in alto compare solo con quello stato", true, /form\.stato === "gia_cliente" && \(/.test(L) && /Già cliente nostro\n/.test(L));
    //  La regola «una scheda già cliente altrove» provata sui dati: lo stesso criterio del sorgente.
    const K2 = mod["kpi-calcoli"];
    const altre = [{ id: "a", data: { stato: "da_chiamare" } }, { id: "b", data: { stato: "venduto" } }];
    c("con un doppione che ha comprato, lo trova; con uno da chiamare, no", ["b", undefined], [altre.find((l) => l.data && K2.eClienteNostro(l))?.id, altre.slice(0, 1).find((l) => l.data && K2.eClienteNostro(l))?.id]);
  }
}
