/** ── LE PROVE DI «LEAD IMPORTATI SEMPLICE» · le regole ─────────────────────
 *
 *  Commessa 2026-10-28-lead-importati-semplice (compito T2). `prove/prove.mjs`
 *  impacchetta i moduli nuovi di `src/crm/importa/` (pillole-stato, coda-pagina,
 *  avvisi-pagina, sezioni-altro) e chiama `proveLeadSemplice(mod, aiuti)` dopo
 *  `proveSheets`. Il disegno della pagina si prova in `lead-semplice-pagina.mjs`.
 *
 *  ⚠️ `aiuti` = { c, gruppo, radice }. Dati inventati: nomi di fantasia, nessun
 *   numero vero, nessuna email. Le date si scrivono in ora LOCALE, così la
 *   prova non cambia esito con il fuso del computer che la lancia.
 *  ───────────────────────────────────────────────────────────────────────── */

export async function proveLeadSemplice(mod, { c, gruppo }) {
  const CHIAM = mod["importa/chi-chiamare"];
  const FIL = mod["importa/filtri-lista"];
  const PIL = mod["importa/pillole-stato"];
  const CODA = mod["importa/coda-pagina"];
  const AVV = mod["importa/avvisi-pagina"];
  const ALT = mod["importa/sezioni-altro"];
  const REP = mod["importa/reparti"];
  const TEL = mod["importa/da-telefonare"];
  const ATT = mod["importa/attesa-whatsapp"];
  const T = mod["types"];

  gruppo("LEAD SEMPLICE · I MODULI NUOVI ESISTONO");
  for (const [nome, attese] of Object.entries({
    "importa/pillole-stato": ["statoCanonico", "conStatoCanonico", "pilloleAccese", "pilloleDaMostrare"],
    "importa/coda-pagina": ["eInCoda", "righePagina", "eFuoriCoda"],
    "importa/avvisi-pagina": ["avvisiPagina", "fraseAvvisi", "fraseGiro"],
    "importa/sezioni-altro": ["sezioniAltro", "tocchiPerRaggiungere"],
  })) {
    c(`${nome}: espone ${attese.join(", ")}`, attese.map(() => "function"), attese.map((f) => typeof mod[nome]?.[f]));
  }

  /* ═══ I LEAD: uno per ogni stato che conta ═══════════════════════════════ */
  const ADESSO = new Date(2026, 9, 28, 13, 0);
  const OGGI = "2026-10-28";
  const fa = (ore) => new Date(ADESSO.getTime() - ore * 3_600_000).toISOString();
  const base = { importato: true, nome: "Prova", createdAt: new Date(2026, 9, 1).toISOString() };
  const L = (id, data) => ({ id, data: { ...base, ...data } });
  const GRUPPO_A = { adset_name: "Gruppo A", ad_name: "Annuncio 1" };
  const RITORNO = { ricarico: { volte: 1, ultimo: new Date(2026, 9, 27).toISOString(), daDecidere: true } };

  const cont = L("cont", { stato: "da_contattare", tracking: GRUPPO_A, modulo: { problema: "areata" } });
  const manuale = L("manuale", { stato: "da_contattare", whatsappInviatoIl: fa(2), statoPrecedenteIl: fa(30) });
  const nr = L("nr", { stato: "non_risponde", noRispondeCount: 1 });
  const seg = L("seg", { stato: "segreteria", noRispondeCount: 1 });
  const att1h = L("att1h", {
    stato: "attesa_whatsapp", statoPrecedenteIl: fa(1), tracking: GRUPPO_A, modulo: { problema: "areata" },
  });
  const attOra = L("attOra", { stato: "attesa_whatsapp", statoPrecedenteIl: fa(2), modulo: { quando: "pranzo" } });
  const att11h = L("att11h", { stato: "attesa_whatsapp", statoPrecedenteIl: fa(11) });
  const attRit = L("attRit", { stato: "attesa_whatsapp", statoPrecedenteIl: fa(3), ...RITORNO });
  const dc = L("dc", { stato: "da_chiamare", statoPrecedenteIl: fa(1) });
  const ricScad = L("ricScad", { stato: "richiamo", dataRicontatto: "2026-10-27" });
  const ricFut = L("ricFut", { stato: "richiamo", dataRicontatto: "2026-11-05" });
  const ciArr = L("ciArr", { stato: "ci_ricontatta_lui", dataRicontatto: "2026-10-28" });
  const ciFut = L("ciFut", { stato: "ci_ricontatta_lui", dataRicontatto: "2026-11-02" });
  const rit = L("rit", { stato: "no_show", ...RITORNO });
  const app = L("app", { stato: "appuntamento_fissato" });
  const ni = L("ni", { stato: "annullato" });
  // Mescolati di proposito: niente deve dipendere dall'ordine di arrivo.
  const TUTTI = [ni, ciFut, att11h, nr, rit, ricFut, att1h, app, cont, seg, attRit, dc, ciArr, manuale, attOra, ricScad];
  const ids = (ls) => ls.map((l) => l.id).sort().join(",");
  // Le chiavi in ordine alfabetico: il confronto delle prove guarda anche l'ordine.
  const ord = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));

  /* ═══ 1. LISTA E CODA ════════════════════════════════════════════════════ */
  gruppo("LEAD SEMPLICE · LISTA E CODA (Attesa WhatsApp fuori coda, ma visibile)");
  const { lista, coda } = CODA.righePagina(TUTTI, ADESSO);
  c("la lista è quella di sempre (promesse future, appuntamenti e non interessati fuori)",
    "att11h,att1h,attOra,attRit,ciArr,cont,dc,manuale,nr,ricScad,rit,seg", ids(lista));
  c("la lista è IDENTICA a listaDaChiamare, nello stesso ordine",
    CHIAM.listaDaChiamare(TUTTI, ADESSO).map((l) => l.id), lista.map((l) => l.id));
  c("la coda è la lista senza chi aspetta solo la risposta (1 ora e 11 ore)",
    "attOra,attRit,ciArr,cont,dc,manuale,nr,ricScad,rit,seg", ids(coda));
  const posizioni = coda.map((l) => lista.findIndex((x) => x.id === l.id));
  c("la coda tiene l'ordine della lista", true, posizioni.every((p, i) => p >= 0 && (i === 0 || p > posizioni[i - 1])));
  const motivo = (l) => CHIAM.motivoChiamata(l, ADESSO).motivo;
  c("Attesa WhatsApp da 1 ora: motivo «ritento», fuori coda", ["ritento", false], [motivo(att1h), CODA.eInCoda(att1h, ADESSO)]);
  c("Attesa WhatsApp da 11 ore (il server non l'ha ancora spostato): fuori coda", false, CODA.eInCoda(att11h, ADESSO));
  c("Attesa WhatsApp con la sua fascia oraria arrivata: resta in coda (motivo «suaOra»)", ["suaOra", true], [motivo(attOra), CODA.eInCoda(attOra, ADESSO)]);
  c("Attesa WhatsApp che è anche un contatto di ritorno: resta in coda", ["ritorno", true], [motivo(attRit), CODA.eInCoda(attRit, ADESSO)]);
  c("Da chiamare, Non risponde, Segreteria, richiamo arrivato: in coda",
    [true, true, true, true], [dc, nr, seg, ricScad].map((l) => CODA.eInCoda(l, ADESSO)));
  c("chi non è in lista non è in coda", [false, false, false, false],
    [ricFut, ciFut, app, ni].map((l) => CODA.eInCoda(l, ADESSO)));
  c("il primo della coda non è mai un Attesa WhatsApp «ritento»",
    true, !(coda[0].data.stato === "attesa_whatsapp" && motivo(coda[0]) === "ritento"));
  c("…nemmeno dopo aver tolto i ritorni e le promesse: nessuno in coda aspetta soltanto",
    0, coda.filter((l) => l.data.stato === "attesa_whatsapp" && motivo(l) === "ritento").length);
  c("senza lead: lista e coda vuote", [0, 0], (() => { const r = CODA.righePagina([], ADESSO); return [r.lista.length, r.coda.length]; })());
  c("non tocca l'elenco ricevuto", 16, TUTTI.length);

  // eFuoriCoda: forzato AND non in coda AND non visibile.
  const inC = new Set(["a", "b"]);
  const vis = new Set(["a", "w"]);
  c("eFuoriCoda: niente nome portato in testa → no", false, CODA.eFuoriCoda(null, inC, vis));
  c("eFuoriCoda: nome in coda → no", false, CODA.eFuoriCoda("a", inC, vis));
  c("eFuoriCoda: nome fuori coda ma visibile (pillola Attesa accesa) → no", false, CODA.eFuoriCoda("w", inC, vis));
  c("eFuoriCoda: nome fuori coda e non visibile (trovato con la ricerca) → sì", true, CODA.eFuoriCoda("z", inC, vis));

  /* ═══ 2. LE RIGHE E I NUMERI DELLE PILLOLE ═══════════════════════════════ */
  gruppo("LEAD SEMPLICE · IL NUMERO SULLA PILLOLA = LE RIGHE CHE ESCONO");
  const idCoda = new Set(coda.map((l) => l.id));
  const righe = lista.map((l) => ({
    id: l.id, data: l.data, motivo: motivo(l), modulo: l.data.modulo, inCoda: idCoda.has(l.id),
  }));
  const conti = (f) => Object.fromEntries(FIL.opzioniFiltri(righe, f, OGGI).stato.map((x) => [x.valore, x.n]));
  const n0 = conti({});
  c("Tutta la coda = la coda (10), senza gli Attesa WhatsApp che aspettano", 10, n0.tutti);
  c("Da contattare = 2 (anche chi ha il WhatsApp scritto a mano)", 2, n0.mai);
  c("Attesa WhatsApp = 4 (1 ora, 11 ore, fascia arrivata, ritorno): contano lo stato", 4, n0.whatsapp);
  c("Da chiamare = 1", 1, n0.daChiamare);
  c("Non ha risposto = 2 (Non risponde + Segreteria)", 2, n0.nonRisposto);
  c("Richiamo concordato = 1 (il richiamo futuro non è in lista)", 1, n0.richiamo);
  c("Ci ricontatta lui = 1 (il giorno futuro non è in lista)", 1, n0.ciRicontatta);
  c("Di ritorno = 2", 2, n0.ritorno);
  const combinazioni = {
    "nessun altro filtro": {},
    "Annuncio": { annuncio: "g:Gruppo A" },
    "Quando = oggi": { quando: "oggi" },
    "Risposta": { risposte: ["problema|areata"] },
    "Annuncio + Risposta": { annuncio: "g:Gruppo A", risposte: ["problema|areata"] },
    "Origine": { origine: "file" },
  };
  for (const [nome, f] of Object.entries(combinazioni)) {
    const n = conti(f);
    const viste = Object.fromEntries(PIL.PILLOLE.map((id) => [id, FIL.applicaFiltri(righe, { ...f, stato: id }, OGGI).length]));
    c(`ogni pillola: il numero scritto = le righe viste (${nome})`,
      viste, Object.fromEntries(PIL.PILLOLE.map((id) => [id, n[id]])));
  }
  c("«Tutta la coda» (stato tutti) = nessuno stato: stesse righe", ids(FIL.applicaFiltri(righe, {}, OGGI)),
    ids(FIL.applicaFiltri(righe, { stato: "tutti" }, OGGI)));
  c("senza pillola le righe sono la coda, e solo lei", ids(coda), ids(FIL.applicaFiltri(righe, {}, OGGI)));
  c("con la pillola Attesa WhatsApp si vedono TUTTI gli Attesa, anche fuori coda",
    "att11h,att1h,attOra,attRit", ids(FIL.applicaFiltri(righe, { stato: "whatsapp" }, OGGI)));
  c("con Attesa WhatsApp il primo è uno degli Attesa (l'ha voluto la setter)",
    "attesa_whatsapp", FIL.applicaFiltri(righe, { stato: "whatsapp" }, OGGI)[0].data.stato);

  /* ── il default: «inCoda» assente = vero (revisore) ── */
  const senzaInCoda = righe.map(({ inCoda, ...r }) => r);
  const tutteVere = righe.map((r) => ({ ...r, inCoda: true }));
  c("inCoda assente = vero: nessuna riga scartata (prove vecchie e altre schermate)", righe.length, FIL.applicaFiltri(senzaInCoda, {}, OGGI).length);
  c("…come con inCoda vero per tutte", ids(FIL.applicaFiltri(tutteVere, {}, OGGI)), ids(FIL.applicaFiltri(senzaInCoda, {}, OGGI)));
  c("…e anche i conti delle pillole sono quelli di inCoda vero",
    FIL.opzioniFiltri(tutteVere, {}, OGGI).stato, FIL.opzioniFiltri(senzaInCoda, {}, OGGI).stato);
  c("una riga con inCoda falso e nessuna pillola: scartata", 0,
    FIL.applicaFiltri([{ id: "x", data: { stato: "attesa_whatsapp" }, motivo: "ritento", inCoda: false }], {}, OGGI).length);
  c("…con inCoda falso ma la pillola Attesa: c'è", 1,
    FIL.applicaFiltri([{ id: "x", data: { stato: "attesa_whatsapp" }, motivo: "ritento", inCoda: false }], { stato: "whatsapp" }, OGGI).length);

  /* ── i conti dei menu con un fuori coda e un filtro Annuncio (revisore) ── */
  gruppo("LEAD SEMPLICE · I MENU E IL FUORI CODA (con Annuncio acceso)");
  const fA = { annuncio: "g:Gruppo A" };
  const voceProblema = (o) => o.risposte.find((r) => r.campo === "problema")?.voci.find((v) => v.chiave === "problema|areata")?.n;
  const gruppoA = (o) => o.annuncio.find((g) => g.chiave === "g:Gruppo A")?.n;
  const oA = FIL.opzioniFiltri(righe, fA, OGGI);
  c("Annuncio A senza pillola: «cont» (in coda) sì, «att1h» (fuori coda) no", 1, voceProblema(oA));
  c("il menu Annuncio conta il gruppo A senza il fuori coda", 1, gruppoA(FIL.opzioniFiltri(righe, {}, OGGI)));
  c("…e il numero del gruppo = le righe che escono scegliendolo", FIL.applicaFiltri(righe, fA, OGGI).length, gruppoA(FIL.opzioniFiltri(righe, {}, OGGI)));
  c("la voce «Attesa WhatsApp» invece lo include (con Annuncio A)", 1, oA.stato.find((x) => x.valore === "whatsapp").n);
  c("…e sono le righe che escono toccandola", "att1h", ids(FIL.applicaFiltri(righe, { ...fA, stato: "whatsapp" }, OGGI)));
  const oAw = FIL.opzioniFiltri(righe, { ...fA, stato: "whatsapp" }, OGGI);
  c("con la pillola Attesa accesa i menu includono il fuori coda e non più la coda", 1, voceProblema(oAw));
  c("…ed è la riga di att1h", "att1h", ids(FIL.applicaFiltri(righe, { ...fA, stato: "whatsapp", risposte: ["problema|areata"] }, OGGI)));
  c("con Annuncio A, «Tutta la coda» = 1 (solo cont)", 1, oA.stato.find((x) => x.valore === "tutti").n);
  const oQ = FIL.opzioniFiltri(righe, { quando: "oggi" }, OGGI);
  c("«Quando = oggi»: il menu conta come le righe che escono",
    oQ.quando.map((x) => x.n), oQ.quando.map((x) => FIL.applicaFiltri(righe, { quando: x.valore }, OGGI).length));

  /* ═══ 3. LA FUSIONE E I VECCHI INDIRIZZI ═════════════════════════════════ */
  gruppo("LEAD SEMPLICE · NON HA RISPOSTO FONDE DUE STATI, I VECCHI INDIRIZZI RESTANO");
  c("«Non risponde» cade in «Non ha risposto»", true, FIL.cadeNelloStato("ritento", { stato: "non_risponde" }, "nonRisposto"));
  c("«Segreteria» cade in «Non ha risposto»", true, FIL.cadeNelloStato("ritento", { stato: "segreteria" }, "nonRisposto"));
  c("un richiamo no", false, FIL.cadeNelloStato("ritento", { stato: "richiamo" }, "nonRisposto"));
  c("un Attesa WhatsApp no", false, FIL.cadeNelloStato("ritento", { stato: "attesa_whatsapp" }, "nonRisposto"));
  c("sotto «Non ha risposto» ci sono entrambi, col conto giusto", "nr,seg", ids(FIL.applicaFiltri(righe, { stato: "nonRisposto" }, OGGI)));
  c("i due stati restano distinti nel database e nelle voci vecchie",
    ["nr", "seg"], [ids(FIL.applicaFiltri(righe, { stato: "nonRisponde" }, OGGI)), ids(FIL.applicaFiltri(righe, { stato: "segreteria" }, OGGI))]);
  c("gli stati dei lead non sono stati toccati", ["non_risponde", "segreteria"], [nr.data.stato, seg.data.stato]);
  const vecchi = {
    mai: ["mai", ["mai"]],
    nonRisponde: ["nonRisposto", ["nonRisposto"]],
    segreteria: ["nonRisposto", ["nonRisposto"]],
    ritentare: ["nonRisposto", ["nonRisposto"]],
    richiamo: ["richiamo", ["richiamo"]],
    ciRicontatta: ["ciRicontatta", ["ciRicontatta"]],
    promesse: ["promesse", ["richiamo", "ciRicontatta"]],
    whatsapp: ["whatsapp", ["whatsapp"]],
    daChiamare: ["daChiamare", ["daChiamare"]],
    ritorno: ["ritorno", ["ritorno"]],
  };
  for (const [vecchio, [stato, accese]] of Object.entries(vecchi)) {
    let letto;
    let errore = null;
    try {
      letto = PIL.conStatoCanonico(FIL.leggiRicercaImporta({ stato: vecchio }));
    } catch (e) {
      errore = String(e);
    }
    c(`indirizzo vecchio ?stato=${vecchio}: nessun errore, valore ${stato}, pillole ${accese.join("+")}`,
      [null, stato, accese], [errore, letto?.stato, PIL.pilloleAccese(letto?.stato)]);
  }
  const conAltro = PIL.conStatoCanonico(FIL.leggiRicercaImporta({ stato: "segreteria", annuncio: "g:Gruppo A", quando: "oggi" }));
  c("la traduzione tiene gli altri filtri", ord({ stato: "nonRisposto", annuncio: "g:Gruppo A", quando: "oggi" }), ord(conAltro));
  const nuovoGia = FIL.leggiRicercaImporta({ stato: "nonRisposto" });
  c("un valore già nuovo non cambia (stesso oggetto)", true, PIL.conStatoCanonico(nuovoGia) === nuovoGia);
  c("senza Stato non cambia niente", {}, PIL.conStatoCanonico(FIL.leggiRicercaImporta({})));
  c("uno Stato sconosciuto si scarta, la pagina si apre su «Tutta la coda»", ["tutti"], PIL.pilloleAccese(PIL.conStatoCanonico(FIL.leggiRicercaImporta({ stato: "boh" })).stato));
  c("il vecchio ?stato=ritentare dà le stesse righe di ?stato=nonRisposto",
    ids(FIL.applicaFiltri(righe, { stato: "nonRisposto" }, OGGI)), ids(FIL.applicaFiltri(righe, PIL.conStatoCanonico({ stato: "ritentare" }), OGGI)));
  c("?stato=promesse mostra richiami e «ci ricontatta lui» arrivati", "ciArr,ricScad", ids(FIL.applicaFiltri(righe, { stato: "promesse" }, OGGI)));
  c("statoCanonico: i tre fusi", ["nonRisposto", "nonRisposto", "nonRisposto", undefined], [
    PIL.statoCanonico("nonRisponde"), PIL.statoCanonico("segreteria"), PIL.statoCanonico("ritentare"), PIL.statoCanonico(undefined)]);

  /* ═══ 4. L'ORDINE, I NOMI, LE PILLOLE A ZERO ═════════════════════════════ */
  gruppo("LEAD SEMPLICE · LE OTTO PILLOLE: ORDINE, NOMI, ZERO");
  c("le pillole sono otto, nell'ordine della SPEC",
    ["tutti", "mai", "whatsapp", "daChiamare", "nonRisposto", "richiamo", "ciRicontatta", "ritorno"], PIL.PILLOLE);
  c("i nomi sono quelli della SPEC",
    ["Tutta la coda", "Da contattare", "Attesa WhatsApp", "Da chiamare", "Non ha risposto", "Richiamo concordato", "Ci ricontatta lui", "Di ritorno"],
    PIL.PILLOLE.map((id) => PIL.NOME_STATO[id]));
  c("nessun nome vuoto e ogni valore di Stato ha nome e spiegazione",
    true, FIL.STATI_FILTRO.every((s) => !!PIL.NOME_STATO[s] && !!PIL.SPIEGA_STATO[s]));
  c("«Tutti» non esiste più come nome", false, Object.values(PIL.NOME_STATO).includes("Tutti"));
  c("ogni pillola è uno Stato del filtro", true, PIL.PILLOLE.every((id) => FIL.STATI_FILTRO.includes(id)));
  const tuttiA = (v) => () => v;
  c("a zero ovunque: resta solo la prima (la accesa di partenza)", ["tutti"], PIL.pilloleDaMostrare(tuttiA(0), undefined));
  c("tutte con qualcuno: ci sono tutte e otto, in ordine", PIL.PILLOLE, PIL.pilloleDaMostrare(tuttiA(3), undefined));
  c("una pillola a zero non si mostra", false, PIL.pilloleDaMostrare((id) => (id === "daChiamare" ? 0 : 5), undefined).includes("daChiamare"));
  c("…ma se è quella accesa sì (per poterla spegnere)", true, PIL.pilloleDaMostrare((id) => (id === "daChiamare" ? 0 : 5), "daChiamare").includes("daChiamare"));
  c("la pillola accesa con un vecchio indirizzo (segreteria) è «Non ha risposto»", true,
    PIL.pilloleDaMostrare((id) => (id === "nonRisposto" ? 0 : 5), PIL.conStatoCanonico({ stato: "segreteria" }).stato).includes("nonRisposto"));
  c("?stato=promesse accende due pillole, anche a zero",
    ["richiamo", "ciRicontatta"], PIL.pilloleDaMostrare((id) => (id === "richiamo" || id === "ciRicontatta" ? 0 : 5), "promesse")
      .filter((id) => id === "richiamo" || id === "ciRicontatta"));
  c("«Tutta la coda» a zero con un'altra pillola accesa: nascosta", false,
    PIL.pilloleDaMostrare((id) => (id === "tutti" ? 0 : 2), "whatsapp").includes("tutti"));
  c("Attesa WhatsApp resta visibile anche se la coda è vuota (si trova lì)", true,
    PIL.pilloleDaMostrare((id) => (id === "whatsapp" ? 4 : 0), undefined).includes("whatsapp"));
  c("pilloleAccese: nessuno Stato o «tutti» = la prima", [["tutti"], ["tutti"]], [PIL.pilloleAccese(undefined), PIL.pilloleAccese("tutti")]);
  c("pilloleAccese: una sola per le altre", ["ritorno"], PIL.pilloleAccese("ritorno"));
  // Dalla riga dei dati veri: la riga mostrata dalla pagina con i numeri veri.
  const mostrate = PIL.pilloleDaMostrare((id) => n0[id], undefined);
  c("con i dati di prova si vedono tutte e otto (nessuna è a zero)", PIL.PILLOLE, mostrate);

  /* ═══ 5. «ATTESA WHATSAPP» GUARDA SOLO LO STATO ══════════════════════════ */
  gruppo("LEAD SEMPLICE · ATTESA WHATSAPP = LO STATO, NON IL TASTO PREMUTO");
  c("il tasto WhatsApp premuto (stato «da contattare») non basta", false, FIL.cadeNelloStato("prima", manuale.data, "whatsapp"));
  c("…ma il lead resta sotto «Da contattare»", true, FIL.cadeNelloStato("prima", manuale.data, "mai"));
  c("…e in coda", true, CODA.eInCoda(manuale, ADESSO));
  c("lo stato «Attesa WhatsApp» basta, anche senza il tasto premuto", true, FIL.cadeNelloStato("ritento", { stato: "attesa_whatsapp" }, "whatsapp"));
  c("il tasto premuto resta registrato (inAttesaWhatsapp non cambia)", true, ATT.inAttesaWhatsapp(manuale.data));

  /* ═══ 6. L'AVVISO, LA FRASE DEL GIRO ═════════════════════════════════════ */
  gruppo("LEAD SEMPLICE · UN SOLO AVVISO E LA FRASE DEL GIRO");
  const zero = { scaduti: 0, scadutiTutte: 0, daParte: 0, daParteTutti: 0, ritorni: 0 };
  c("tutto a zero: nessuna voce, nessuna fascia", [[], ""], [AVV.avvisiPagina(zero), AVV.fraseAvvisi(AVV.avvisiPagina(zero))]);
  c("una sola cosa: una voce sola", ["scaduti"], AVV.avvisiPagina({ ...zero, scaduti: 2, scadutiTutte: 2 }).map((v) => v.chiave));
  const tre = AVV.avvisiPagina({ scaduti: 19, scadutiTutte: 23, daParte: 8, daParteTutti: 8, ritorni: 36 });
  c("tre cose insieme: tre voci, nell'ordine della SPEC", ["scaduti", "daParte", "ritorni"], tre.map((v) => v.chiave));
  c("i testi", ["19 richiami scaduti (23 in tutto)", "8 messi da parte da più di 3 giorni", "36 ritorni da decidere"], tre.map((v) => v.testo));
  c("il numero scritto e le righe aperte: scaduti 19 su 23, ritorni 36 su 36", [[19, 23], [8, 8], [36, 36]], tre.map((v) => [v.n, v.righe]));
  c("dove si apre ogni voce", [{ stato: "promesse" }, { vista: "saltati" }, { stato: "ritorno" }], tre.map((v) => v.apre));
  c("quando il numero e le righe coincidono il testo non dice «in tutto»", false, tre.slice(1).some((v) => /in tutto/.test(v.testo)));
  c("quando differiscono il testo li dice entrambi (messi da parte)", "5 messi da parte da più di 3 giorni (12 in tutto)",
    AVV.avvisiPagina({ ...zero, daParte: 5, daParteTutti: 12 })[0].testo);
  c("il numero scritto è sempre dentro il testo", true, tre.every((v) => v.testo.startsWith(String(v.n))));
  c("singolare", ["1 richiamo scaduto", "1 messo da parte da più di 3 giorni", "1 ritorno da decidere"],
    AVV.avvisiPagina({ scaduti: 1, scadutiTutte: 1, daParte: 1, daParteTutti: 1, ritorni: 1 }).map((v) => v.testo));
  c("numeri storti (negativi, NaN, decimali) non scrivono assurdità", [], AVV.avvisiPagina({ scaduti: -3, scadutiTutte: Number.NaN, daParte: 0.4, daParteTutti: -1, ritorni: undefined }));
  c("le righe non sono mai meno del numero scritto", true,
    AVV.avvisiPagina({ ...zero, scaduti: 5, scadutiTutte: 2 }).every((v) => v.righe >= v.n));
  c("non c'è l'avviso «Attesa WhatsApp oltre 10 ore»", false, tre.some((v) => /10 ore|WhatsApp/.test(v.testo)));
  c("la frase corta del telefono", ["", "1 cosa da guardare", "3 cose da guardare"],
    [AVV.fraseAvvisi([]), AVV.fraseAvvisi(tre.slice(0, 1)), AVV.fraseAvvisi(tre)]);
  c("la frase del giro: 74 da chiamare, 12 fatti", "74 da chiamare oggi · 12 fatti", AVV.fraseGiro(74, 12));
  c("…senza fatti non scrive «0 fatti»", "74 da chiamare oggi", AVV.fraseGiro(74, 0));
  c("…un fatto solo", "5 da chiamare oggi · 1 fatto", AVV.fraseGiro(5, 1));
  c("coda vuota: «Sei in pari»", "Sei in pari", AVV.fraseGiro(0, 0));
  c("tutto fatto: «Sei in pari» e quanti", "Sei in pari · 12 fatti", AVV.fraseGiro(0, 12));
  c("il numero della frase è «Tutta la coda» (la coda intera, non la fetta dei filtri)", "10 da chiamare oggi", AVV.fraseGiro(coda.length, 0));

  /* ═══ 7. «ALTRO»: NIENTE SI È PERSO ══════════════════════════════════════ */
  gruppo("LEAD SEMPLICE · «ALTRO»: OGNI COSA IN DUE TOCCHI");
  const IN_CODA = new Set(["da_contattare", "non_risponde", "segreteria", "attesa_whatsapp", "da_chiamare", "richiamo", "ci_ricontatta_lui"]);
  const giaLavorati = T.ALL_LEAD_STATUSES.filter((s) => !IN_CODA.has(s)).map((stato) => ({ stato, n: 1 }));
  const sezioni = ALT.sezioniAltro({ giaLavorati });
  const voci = sezioni.flatMap((s) => s.voci);
  c("le sezioni, nell'ordine della SPEC", ["In attesa", "Fissati da me", "Già lavorati", "Liste", "Strumenti"], sezioni.map((s) => s.titolo));
  c("ogni voce ha un id diverso", voci.length, new Set(voci.map((v) => v.id)).size);
  c("ogni voce si raggiunge in due tocchi (Altro, voce)", true, voci.every((v) => ALT.tocchiPerRaggiungere(v) === 2));
  c("ogni voce ha nome, spiegazione e un'azione", true, voci.every((v) => v.nome && v.titolo && v.azione));
  const viste = new Set(voci.map((v) => v.azione.vista).filter(Boolean));
  const daAltro = ["whatsapp", "rimandati", "saltati", "miei", "tutti", "ripesca", "doppioni", "oggi"];
  c("ogni vista di reparti.ts raggiungibile è in «Altro» (coda = la pagina, ritorno = la pillola)", daAltro, daAltro.filter((v) => viste.has(v)));
  c("nessuna delle dieci viste senza strada (due stanno sulla pagina)", [], REP.LINGUETTE.flatMap((l) => l.viste.map((v) => v.vista))
    .concat(REP.ALTRO.filter((x) => x.vista).map((x) => x.vista)).filter((v) => v !== "coda" && v !== "ritorno" && !viste.has(v)));
  c("ogni voce dei vecchi ALTRO compare per nome", [], REP.ALTRO.filter((x) => !voci.some((v) => v.nome === x.nome)).map((x) => x.nome));
  c("«Lead da Google Sheets» compare, con il suo filtro", { vista: "tutti", filtro: { origine: "google_sheets" } },
    voci.find((v) => v.nome === "Lead da Google Sheets")?.azione);
  c("ogni voce delle tre linguette (tranne la pagina stessa) compare per nome", [],
    REP.LINGUETTE.flatMap((l) => l.viste).filter((v) => v.vista !== "coda" && !voci.some((x) => x.nome === v.nome)).map((v) => v.nome));
  c("«Elenco completo» è un collegamento vero a /CRM/avanzamento", { href: "/CRM/avanzamento" }, voci.find((v) => v.nome === "Elenco completo")?.azione);
  c("Carica, Assegna e Scorciatoie ci sono, con i permessi giusti",
    [["carica", "lead.crea"], ["assegna", "lead.assegna"], ["scorciatoie", undefined]],
    ["carica", "assegna", "scorciatoie"].map((p) => [p, voci.find((v) => v.azione.pannello === p)?.richiede]));
  c("tutti gli stati «Già lavorati» (con qualcuno dentro) hanno la loro voce, che apre Tutta la lista filtrata",
    giaLavorati.map((g) => g.stato), voci.filter((v) => v.azione.statoTutti).map((v) => v.azione.statoTutti));
  c("…e il numero sulla voce è quello ricevuto", true, voci.filter((v) => v.azione.statoTutti).every((v) => v.n === 1));
  c("gli stati già lavorati sono dieci o più (non interessato, appuntamento fissato, venduto, acconto…)", true, giaLavorati.length >= 10);
  c("stato a zero: la voce non c'è", false,
    ALT.sezioniAltro({ giaLavorati: [{ stato: "annullato", n: 0 }, { stato: "venduto", n: 4 }] })
      .flatMap((s) => s.voci).some((v) => v.azione.statoTutti === "annullato"));
  c("senza stati lavorati la sezione non c'è", false, ALT.sezioniAltro({ giaLavorati: [] }).some((s) => s.titolo === "Già lavorati"));
  c("nessuna sezione vuota", true, sezioni.every((s) => s.voci.length > 0));
  c("«In attesa» ha le tre stanze di prima", ["Scritti su WhatsApp", "Vedi dopo", "Messi da parte"], sezioni[0].voci.map((v) => v.nome));
  c("«Strumenti»: Ripesca, Doppioni, Note e promemoria, Elenco completo, Scorciatoie",
    ["Ripesca", "Doppioni", "Note e promemoria", "Elenco completo", "Scorciatoie da tastiera"], sezioni[4].voci.map((v) => v.nome));
  c("«Liste»: Tutta la lista, Google Sheets, Carica, Assegna",
    ["Tutta la lista", "Lead da Google Sheets", "Carica una lista", "Assegna"], sezioni[3].voci.map((v) => v.nome));

  /* ═══ 8. NIENTE TOCCA IL RESTO ═══════════════════════════════════════════ */
  gruppo("LEAD SEMPLICE · NON REGRESSIONE (STATI_DA_CHIAMARE, inLista, daTelefonareOggi)");
  c("STATI_DA_CHIAMARE: i sette stati di oggi, «Attesa WhatsApp» compreso",
    ["da_contattare", "non_risponde", "segreteria", "attesa_whatsapp", "da_chiamare", "richiamo", "ci_ricontatta_lui"], T.STATI_DA_CHIAMARE);
  c("«Attesa WhatsApp» è ancora uno stato da chiamare per tutti gli altri schermi", true, T.eStatoDaChiamare("attesa_whatsapp"));
  c("inLista: la stessa risposta di prima su ogni lead",
    ord({ att11h: true, att1h: true, attOra: true, attRit: true, ciArr: true, ciFut: false, cont: true, dc: true, manuale: true, nr: true, ni: false, app: false, ricFut: false, ricScad: true, rit: true, seg: true }),
    ord(Object.fromEntries(TUTTI.map((l) => [l.id, CHIAM.inLista(l, ADESSO)]))));
  c("daTelefonareOggi: la stessa risposta di prima (conta ancora gli Attesa WhatsApp)",
    ord({ att11h: true, att1h: true, attOra: true, attRit: true, ciArr: true, ciFut: false, cont: true, dc: true, manuale: true, nr: true, ni: false, app: false, ricFut: false, ricScad: true, rit: false, seg: true }),
    ord(Object.fromEntries(TUTTI.map((l) => [l.id, TEL.daTelefonareOggi(l.data, ADESSO)]))));
}
