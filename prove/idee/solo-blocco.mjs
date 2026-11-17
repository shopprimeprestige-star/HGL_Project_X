/** ── PROVE: «SOLO BLOCCO ORARIO» (commessa 2026-11-17-meet-solo-blocco) ─────
 *  Un meet spuntato «Solo blocco orario» occupa lo slot ma non muove NESSUN numero.
 *  Regola pura: src/crm/conta-nei-kpi.ts (`contaNeiKpi`, `soloNeiKpi`). Le prove usano i
 *  calcoli veri (kpi-calcoli, kpi-setter, kpi-netto, aios-feed, booking-utils) con schede
 *  inventate: nessun cliente vero. Il disegno (spunta, etichetta) si prova sul sorgente. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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
const consulente = (id, extra = {}) => ({
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
    ...extra,
  },
});

export function proveSoloBlocco(mod, { c, gruppo, radice }) {
  const B = mod["conta-nei-kpi"];
  const K = mod["kpi-calcoli"];
  const S = mod["kpi-setter"];
  const N = mod["kpi-netto"];
  const F = mod["kpi/aios-feed"];
  const BKG = mod["booking-utils"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");

  gruppo("SOLO BLOCCO · LA REGOLA UNICA");
  c("senza il campo conta (i lead di prima)", true, B.contaNeiKpi(scheda("a", {})));
  c("soloBlocco true: non conta", false, B.contaNeiKpi(scheda("a", { soloBlocco: true })));
  c("soloBlocco false o testo strano: conta", [true, true], [
    B.contaNeiKpi(scheda("a", { soloBlocco: false })),
    B.contaNeiKpi(scheda("a", { soloBlocco: "true" })),
  ]);
  c("righe senza data (archivio importato): contano, non rompono", [true, true, true], [
    B.contaNeiKpi({}),
    B.contaNeiKpi(null),
    B.contaNeiKpi({ data: null }),
  ]);
  const senzaBlocchi = [scheda("a", {}), scheda("b", {})];
  c("senza blocchi l'elenco è la stessa lista (nessuna copia)", true, B.soloNeiKpi(senzaBlocchi) === senzaBlocchi);
  c("con un blocco, resta solo chi conta", ["a"], B.soloNeiKpi([scheda("a", {}), scheda("x", { soloBlocco: true })]).map((l) => l.id));
  c("elenco non valido: lista vuota", [[], []], [B.soloNeiKpi(null), B.soloNeiKpi(undefined)]);
  const su = B.patchSoloBlocco(true, " Marta ", new Date("2026-11-17T10:00:00Z"));
  c("accendere scrive spunta, quando e chi", [true, "2026-11-17T10:00:00.000Z", "Marta"], [su.soloBlocco, su.soloBloccoIl, su.soloBloccoDa]);
  const giu = B.patchSoloBlocco(false);
  c("spegnere toglie tutte e tre le chiavi (valore undefined)", [true, true, true], [
    "soloBlocco" in giu && giu.soloBlocco === undefined,
    "soloBloccoIl" in giu && giu.soloBloccoIl === undefined,
    "soloBloccoDa" in giu && giu.soloBloccoDa === undefined,
  ]);

  //  ── I NUMERI ──────────────────────────────────────────────────────────
  const veri = [
    scheda("l1", { stato: "appuntamento_fissato", dataMeeting: GIORNO, oraMeeting: "10:00", durataMeeting: 45 }),
    scheda("l2", { stato: "fatto", dataMeeting: GIORNO, oraMeeting: "11:00" }),
    scheda("l3", { stato: "venduto", dataMeeting: GIORNO, oraMeeting: "12:00", payment: { prezzoFinaleVendita: 1000, accontoPagato: 300 } }),
    scheda("l4", { stato: "no_show", dataMeeting: GIORNO, oraMeeting: "09:00" }),
    scheda("l5", { stato: "da_contattare", consulenteId: "s" }),
  ];
  //  Blocchi di ogni genere: fissato, svolto, perfino «venduto» e no-show — nessuno deve contare.
  const blocchi = [
    scheda("b1", { stato: "appuntamento_fissato", dataMeeting: GIORNO, oraMeeting: "09:45", durataMeeting: 45, soloBlocco: true }),
    scheda("b2", { stato: "fatto", dataMeeting: GIORNO, oraMeeting: "10:30", soloBlocco: true }),
    scheda("b3", { stato: "venduto", dataMeeting: GIORNO, oraMeeting: "11:30", soloBlocco: true, payment: { prezzoFinaleVendita: 500, accontoPagato: 100 } }),
    scheda("b4", { stato: "no_show", dataMeeting: GIORNO, oraMeeting: "12:15", soloBlocco: true }),
  ];
  const tutti = [...veri, ...blocchi];
  const consulenti = [consulente("m"), consulente("s")];
  const spese = [{ id: "s1", user_id: "u", created_at: creato, updated_at: creato, data: { data: GIORNO, campagna: "x", fonte: "meta", importoSpeso: 100, leadGenerati: 0, meetFissati: 0, conversioni: 0 } }];
  const tutto = K.creaFiltroPeriodo("tutto");
  const uguali = (nome, fn) => c(nome, JSON.stringify(fn(veri)), JSON.stringify(fn(tutti)));

  gruppo("SOLO BLOCCO · CON I BLOCCHI I NUMERI RESTANO IDENTICI");
  uguali("riepilogo generale (lordo): lead, appuntamenti, consulenze, clienti, cvr, show-rate", (l) => K.calcolaMetricheGenerali(l, spese, tutto, true));
  uguali("riepilogo generale (netto)", (l) => K.calcolaMetricheGenerali(l, spese, tutto, false));
  uguali("tabella per consulente: lead, meet effettuati, tasso di conversione, classifica", (l) => K.calcolaMetricheConsulenti(l, consulenti, spese, tutto));
  uguali("dettaglio per giorno", (l) => K.calcolaGiorni(l, spese, tutto));
  uguali("meet fissati oggi/ieri/altro ieri", (l) => K.meetFissatiUltimiTreGiorni(l));
  uguali("setter: assegnati, fissati, presentati, no-show", (l) => S.calcolaMetricheSetter(l, consulenti, tutto));
  uguali("setter: l'elenco dietro il numero «fissati»", (l) => S.leadDelGruppoSetter(l, "m", "fissati", tutto).map((x) => x.id));
  uguali("conto netto", (l) => N.calcolaContoNetto(l, spese, tutto));
  uguali("feed AIOS (api.aios.kpi)", (l) =>
    F.costruisciFeedKpi({ adesso: OGGI, oggi: GIORNO, leads: l, pubblici: {}, spesaMeta: [], spesaTiktok: [], aMano: spese, tiktokAlGiorno: 0 }),
  );

  gruppo("SOLO BLOCCO · LA PROVA È SENSIBILE (senza spunta gli stessi lead contano)");
  const senzaSpunta = blocchi.map((l) => ({ ...l, data: { ...l.data, soloBlocco: undefined } }));
  const gen = (l) => K.calcolaMetricheGenerali(l, spese, tutto, true);
  c("gli stessi quattro lead SENZA spunta cambiano lead, appuntamenti e clienti", true,
    gen([...veri, ...senzaSpunta]).lead > gen(veri).lead &&
      gen([...veri, ...senzaSpunta]).appuntamenti > gen(veri).appuntamenti &&
      gen([...veri, ...senzaSpunta]).conversioni > gen(veri).conversioni);
  c("numeri di riferimento dell'insieme senza blocchi: 4 lead (il no-show non conta), 3 appuntamenti validi, 1 cliente",
    [4, 3, 1], [gen(veri).lead, gen(veri).appuntamenti, gen(veri).conversioni]);
  c("toglierla riporta il lead a contare (reversibile)", true, B.contaNeiKpi(senzaSpunta[0]));

  gruppo("SOLO BLOCCO · LO SLOT RESTA OCCUPATO");
  const cons = consulente("m");
  const libere = (leads) => BKG.getFreeSlotsForDate(cons, GIORNO, 45, leads);
  const griglia = (leads) => BKG.slotDelGiorno(cons, GIORNO, 45, leads).find((x) => x.ora === "09:45");
  const comeVero = (l) => ({ ...l, data: { ...l.data, soloBlocco: undefined } });
  c("senza lead la fascia delle 09:45 ha 0 presi", 0, griglia([]).presi);
  c("col blocco alle 09:45 la fascia ha 1 preso: lo slot è occupato", 1, griglia([blocchi[0]]).presi);
  c("la griglia col blocco è identica a quella con una consulenza vera allo stesso orario", griglia([comeVero(blocchi[0])]), griglia([blocchi[0]]));
  //  La fascia regge più consulenze (capienza): per vederla PIENA se ne riempie la capienza.
  const tre = [0, 1, 2].map((i) => ({ ...blocchi[0], id: `bb${i}` }));
  c("riempita la capienza di blocchi, 09:45 non è più fra gli orari liberi", [true, false], [libere([]).includes("09:45"), libere(tre).includes("09:45")]);
  c("gli orari liberi con blocchi sono identici a quelli con consulenze vere", libere(tre.map(comeVero)), libere(tre));

  gruppo("SOLO BLOCCO · AGENDA E PROMEMORIA NON LA CONOSCONO");
  for (const f of ["src/crm/booking-utils.ts", "src/crm/doppione-orario.ts", "src/crm/chatwa/prossimo-meet.ts", "src/crm/consulenze-del-giorno.ts"]) {
    c(`${f} non importa conta-nei-kpi (lo slot resta occupato)`, false, /conta-nei-kpi|soloBlocco/.test(leggi(f)));
  }

  gruppo("SOLO BLOCCO · AL CLIENTE NON PARTE NIENTE (promemoria e assenza)");
  {
    const I = mod["promemoria/invio"];
    const K2 = mod["manychat/consulenze"];
    const adesso = new Date("2026-10-22T13:00:00Z"); // giovedì 22/10 15:00 a Roma
    const d = { nome: "Prova", cognome: "Blocco", telefono: "339 1234567", stato: "appuntamento_fissato", dataMeeting: "2026-10-23", oraMeeting: "10:00" };
    const ingresso = (x) => ({ d: x, link: "https://esempio.test/meetly/x", aggiornataIl: new Date(adesso.getTime() - 300000).toISOString(), numeriStop: [], adesso, primoGiro: false });
    c("controllo: la stessa scheda senza spunta riceve il promemoria", "invia", I.decidiInvio(ingresso(d)).azione);
    c("con la spunta: nessun promemoria, e nessun segno sulla scheda", { azione: "niente" }, I.decidiInvio(ingresso({ ...d, soloBlocco: true })));
    c("tolta la spunta, il promemoria torna a partire", "invia", I.decidiInvio(ingresso({ ...d, soloBlocco: undefined })).azione);
    const inizio = Date.parse("2026-10-30T14:00:00.000Z");
    const dopo = new Date(inizio + 15 * 60000);
    const dA = { ...d, consulenteId: "m", dataMeeting: "2026-10-30", oraMeeting: "15:00" };
    c("controllo: assenza senza spunta, nessuno in stanza → si sposta", "sposta", K2.decidiAssenza(dA, dopo, [])?.tipo);
    c("con la spunta: nessuna assenza, nessun messaggio", null, K2.decidiAssenza({ ...dA, soloBlocco: true }, dopo, []));
  }

  gruppo("SOLO BLOCCO · OGNI CALCOLO PASSA DALLA FUNZIONE UNICA (sorgente)");
  for (const f of [
    "src/crm/kpi-calcoli.ts",
    "src/crm/kpi-setter.ts",
    "src/crm/kpi-netto.ts",
    "src/crm/ConsultantsPerformance.tsx",
    "src/crm/kpi/aios-feed.ts",
    "src/routes/consulente.kpi.tsx",
  ]) {
    c(`${f} usa soloNeiKpi`, true, /soloNeiKpi\(/.test(leggi(f)));
  }
  c("ads-financials: usa contaNeiKpi", true, /contaNeiKpi/.test(leggi("src/crm/ads-financials.functions.ts")));
  c("le schermate che contano in locale leggono leadsKpi", [], [
    "src/crm/kpi/FontiScheda.tsx",
    "src/crm/kpi/TelefonoScheda.tsx",
    "src/crm/kpi/RisposteAdsScheda.tsx",
    "src/crm/kpi/RisposteFormScheda.tsx",
    "src/crm/kpi/ConsultantFunnelKpiTab.tsx",
  ].filter((f) => !/leadsKpi/.test(leggi(f))));
  c("nessun calcolo legge soloBlocco a mano (solo conta-nei-kpi e i punti di scrittura)", [], [
    "src/crm/kpi-calcoli.ts", "src/crm/kpi-setter.ts", "src/crm/kpi-netto.ts", "src/crm/kpi/aios-feed.ts", "src/crm/ConsultantsPerformance.tsx",
  ].filter((f) => /\.soloBlocco/.test(leggi(f))));

  gruppo("SOLO BLOCCO · RETE DI SICUREZZA: nessun file che CONTA legge i lead grezzi");
  {
    //  Scorre tutto src/. Un file «che conta» (KPI, ads, attribuzione, spesa, o che chiama un calcolo
    //  dei numeri) non può leggere `leads` grezzi da useCRM() né `crm_leads` dal database senza passare
    //  da `leadsKpi` / `contaNeiKpi` / `soloNeiKpi`. Un file nuovo che lo fa fallisce qui: o lo si
    //  corregge, o lo si mette in ECCEZIONI con il motivo. Agenda, code di lavoro, trattative, chat,
    //  promemoria e fatture sono carico di lavoro, non numeri: non sono in questa rete.
    const ECCEZIONI = {
      "src/crm/ConsultantsPerformance.tsx": "passa i lead grezzi a calcolaMetricheConsulenti/leadDelGruppo, che filtrano da sole (soloNeiKpi all'ingresso)",
      "src/crm/ConsultantKPIDialog.tsx": "come sopra: solo calcolaMetriche* e leadDelGruppo*, che filtrano da sole",
      "src/crm/kpi/DaFareScheda.tsx": "lista di lavoro dei lead importati; il solo conteggio usa leadsKpi",
      "src/crm/kpi/ConsulentiScheda.tsx": "usa leadsKpi",
    };
    const CONTA = /calcolaMetrich|calcolaGiorni|calcolaContoNetto|meetFissatiUltimiTreGiorni|costruisciFeedKpi|buildCrmConvertedIndex|aggregate(Portatore|Pain|Urgenza|Hourly)|righeGiorni|costoPerLead|HealthGlobal/;
    const PERCORSO = /(^|\/)(kpi|attribution|tiktok-ads-manager|ads-manager)\/|kpi|ads-financials|Performance|campagne|spesa|Spesa|Health|avanzamento/;
    const files = [];
    const scorri = (dir) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) scorri(p);
        else if (/\.(ts|tsx)$/.test(n)) files.push(p);
      }
    };
    scorri(join(radice, "src"));
    const colpevoli = [];
    for (const f of files) {
      const rel = relative(radice, f);
      if (rel in ECCEZIONI || /\.gen\.ts$|integrations\/supabase\/types/.test(rel) || rel === "src/crm/conta-nei-kpi.ts") continue;
      const t = readFileSync(f, "utf8");
      const senza = t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
      if (!(CONTA.test(senza) || PERCORSO.test(rel))) continue;
      const filtra = /contaNeiKpi|soloNeiKpi|leadsKpi/.test(senza);
      //  const { leads, ... } = useCRM()  /  const { leads: x } = useCRM()  (ma non leadsKpi)
      const grezzoCtx = [...senza.matchAll(/const\s*\{([^}]*)\}\s*=\s*useCRM\(\)/g)].some((m) => /(^|[\s,])leads\s*(,|:|$)/.test(m[1]));
      const dbGrezzo = /from\("crm_leads"\)/.test(senza) && !/contaNeiKpi|soloNeiKpi/.test(senza);
      if (grezzoCtx || dbGrezzo) colpevoli.push(`${rel}${grezzoCtx ? " (useCRM().leads)" : ""}${dbGrezzo ? " (crm_leads)" : ""}`);
    }
    c("nessun file che conta legge lead grezzi (elenco dei colpevoli)", [], colpevoli);
    c("le eccezioni dichiarate esistono ancora e hanno un motivo", [], Object.entries(ECCEZIONI).filter(([f, m]) => !m || !files.some((x) => relative(radice, x) === f)).map(([f]) => f));
    //  I due casi che il collaudo ha chiesto per nome:
    const leggiSenza = (p) => leggi(p).replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
    c("RitornoScheda (appuntamenti con dataMeeting, elenchi, fuori periodo) parte da leadsKpi", true, /leadsKpi: leads/.test(leggiSenza("src/crm/kpi/RitornoScheda.tsx")));
    c("cvr-generale-utils non conta dataMeeting e i suoi due chiamanti passano leadsKpi", [false, true, true], [
      /dataMeeting/.test(leggiSenza("src/crm/kpi/cvr-generale-utils.ts")),
      /leadsKpi/.test(leggiSenza("src/crm/kpi/RisposteFormScheda.tsx")),
      /leadsKpi/.test(leggiSenza("src/crm/kpi/ConsultantFunnelKpiTab.tsx")),
    ]);
    //  La rete deve davvero accorgersi: un file finto che legge i lead grezzi verrebbe segnalato.
    const finto = "const { leads } = useCRM();\ncalcolaGiorni(leads)";
    c("la rete è sensibile: il file finto verrebbe preso", true,
      CONTA.test(finto) && [...finto.matchAll(/const\s*\{([^}]*)\}\s*=\s*useCRM\(\)/g)].some((m) => /(^|[\s,])leads\s*(,|:|$)/.test(m[1])));
  }

  gruppo("SOLO BLOCCO · LA SPUNTA E L'ETICHETTA (sorgente)");
  const sb = leggi("src/crm/SoloBlocco.tsx");
  c("componente unico: spunta col testo della richiesta, spenta di base", true, /TESTO_SOLO_BLOCCO/.test(sb) && /checked=\{!!acceso\}/.test(sb));
  c("il testo è quello deciso", "Solo blocco orario — non conta nelle statistiche", B.TESTO_SOLO_BLOCCO);
  c("l'etichetta si chiama «Blocco»", "Blocco", B.ETICHETTA_BLOCCO);
  for (const f of ["src/crm/LeadDialog.tsx", "src/crm/QuickStatusDialog.tsx", "src/crm/agenda/AgendaDaySheet.tsx"]) {
    c(`${f}: c'è la spunta`, true, /SpuntaSoloBlocco/.test(leggi(f)));
  }
  for (const f of ["src/crm/LeadDialog.tsx", "src/crm/AgendaTuttiConsulenti.tsx", "src/crm/agenda/AgendaDaySheet.tsx", "src/crm/MeetGiornalieri.tsx"]) {
    c(`${f}: c'è l'etichetta «Blocco»`, true, /EtichettaBlocco/.test(leggi(f)));
  }
}
