/** ── LE PROVE DEI «DATI PER LA FATTURA DOPO L'ACCONTO» ──────────────────────
 *  Commessa 2026-10-30-oggi-e-fatture, parte B. `prove/prove.mjs` impacchetta
 *  `fatture/dati-fattura` e `fatture/dati-fattura-giro` e chiama `proveDatiFattura`.
 *  ⚠️ Dati inventati: nomi di fantasia, numeri e codici finti. Il codice fiscale di prova
 *   ha il carattere di controllo giusto (calcolato qui, non copiato da una persona).
 *  ───────────────────────────────────────────────────────────────────────── */
const ALF = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DISP = [1,0,5,7,9,13,15,17,19,21,1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23];
function cfConControllo(quindici) {
  let s = 0;
  for (let i = 0; i < 15; i++) {
    const k = ALF.indexOf(quindici[i]);
    s += i % 2 === 0 ? DISP[k] : k < 10 ? k : k - 10;
  }
  return quindici + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[s % 26];
}

export async function proveDatiFattura(mod, { c, gruppo, radice }) {
  const D = mod["fatture/dati-fattura"];
  const G = mod["fatture/dati-fattura-giro"];
  const M = mod["wa-meta-templates"];
  const CF = cfConControllo("RSSMRA80A01H501");
  const ADESSO = new Date("2026-10-30T10:00:00Z");
  const ore = (h) => new Date(ADESSO.getTime() - h * 3600e3).toISOString();

  gruppo("DATI FATTURA · I MODULI ESISTONO E IL MODELLO META C'È");
  c("moduli", ["function", "function"], [typeof D?.decidiRichiesta, typeof G?.giroDatiFattura]);
  const tpl = M.findMetaTemplate("hgl_dati_fattura");
  c("modello hgl_dati_fattura: Utility, italiano, una variabile", ["UTILITY", "it", 1], [tpl?.category, tpl?.language, tpl?.params.length]);
  c("il testo chiede nome, CF/P.IVA, indirizzo, PEC/SDI e invita alla foto", [true, true, true, true, true],
    ["nome e cognome", "codice fiscale", "indirizzo completo", "PEC", "foto"].map((p) => tpl.body.includes(p)));
  c("non inizia né finisce con una variabile (Meta lo rifiuterebbe)", [false, false], [/^\{\{/.test(tpl.body), /\}\}$/.test(tpl.body)]);

  gruppo("DATI FATTURA · QUANDO SI CHIEDE (UNA VOLTA, SOLO CON ACCONTO)");
  const base = {
    scheda: { telefono: "+393331112223", stato: "acconto", payment: { accontoPagato: 300 } },
    config: { acceso: true },
    ultimaEntrata: ore(2),
    stop: false,
    modelloPronto: false,
    adesso: ADESSO,
  };
  const d = (x) => D.decidiRichiesta({ ...base, ...x });
  c("finestra aperta → testo normale (gratis)", { azione: "invia", come: "testo" }, d({}));
  c("finestra chiusa e modello pronto → modello", { azione: "invia", come: "modello" }, d({ ultimaEntrata: ore(30), modelloPronto: true }));
  c("finestra chiusa e SENZA modello → promemoria, non parte niente",
    { azione: "promemoria", motivo: "finestra_chiusa_senza_modello" }, d({ ultimaEntrata: ore(30) }));
  c("mai scritto dal cliente → finestra chiusa", "promemoria", d({ ultimaEntrata: null }).azione);
  c("23 ore e mezza: oltre il margine → finestra chiusa", "promemoria", d({ ultimaEntrata: ore(23.5) }).azione);
  c("interruttore spento → niente", "spento", d({ config: { acceso: false } }).motivo);
  c("senza acconto → niente", "senza_acconto", d({ scheda: { ...base.scheda, payment: { accontoPagato: 0 } } }).motivo);
  c("acconto assente → niente", "senza_acconto", d({ scheda: { ...base.scheda, payment: {} } }).motivo);
  c("numero in STOP → niente", "stop", d({ stop: true }).motivo);
  c("senza telefono → niente", "senza_telefono", d({ scheda: { ...base.scheda, telefono: "" } }).motivo);
  c("ripensamento → niente", "stato", d({ scheda: { ...base.scheda, stato: "ripensamento" } }).motivo);
  for (const st of ["preesistente", "richiesta_inviata", "bozza_pronta", "da_guardare"])
    c(`già «${st}» → non si richiede una seconda volta`, "gia_chiesto", d({ scheda: { ...base.scheda, datiFattura: { stato: st } } }).motivo);
  c("in promemoria si può riprovare", "invia", d({ scheda: { ...base.scheda, datiFattura: { stato: "promemoria" } } }).azione);
  c("chiave dell'invio: stabile e senza il numero intero", `df|333111222|abc`.length > 0 && D.chiaveRichiesta("+39 333 111 2223", "abc") === "df|331112223|abc", true);
  c("nome per il modello: prima parola, maiuscola", ["Maria", "cliente"], [D.nomePerModello("MARIA rossi"), D.nomePerModello("")]);

  gruppo("DATI FATTURA · QUALE RISPOSTA VALE");
  const H = "https://manybot-files.s3.eu-central-1.amazonaws.com/pagina/wa/2026/10/30/";
  c("foto ManyChat → file immagine", { tipo: "file", url: H + "a.jpg", formato: "immagine" }, D.cosaFareConMessaggio(H + "a.jpg", "manychat"));
  c("PDF ManyChat → file pdf", "pdf", D.cosaFareConMessaggio(H + "a.pdf", "manychat").formato);
  c("vocale → niente", "niente", D.cosaFareConMessaggio(H + "a.ogg", "manychat").tipo);
  c("allegato di tipo strano (heic) → lo guarda una persona", "da_guardare", D.cosaFareConMessaggio(H + "a.heic", "manychat").tipo);
  c("link di un altro sito → resta testo, niente file", "niente", D.cosaFareConMessaggio("https://evil.example/pagina/wa/2026/10/30/a.jpg", "manychat").tipo);
  c("ponte: segnaposto foto → da guardare (senza file non si legge)", "da_guardare", D.cosaFareConMessaggio("[Foto]", "baileys").tipo);
  c("testo con codice fiscale → si legge", "testo", D.cosaFareConMessaggio(`Sono Mario Rossi, ${CF}, via Roma 1, 00100 Roma`, "manychat").tipo);
  c("testo con P.IVA → si legge", "testo", D.cosaFareConMessaggio("Rossi Srl partita iva 12345678901", "manychat").tipo);
  c("«grazie, a presto» → niente (non si paga l'AI)", "niente", D.cosaFareConMessaggio("Grazie mille, a presto!", "manychat").tipo);
  c("testo lunghissimo → niente", "niente", D.cosaFareConMessaggio(`${CF} ${"x ".repeat(900)}`, "manychat").tipo);
  c("entro 14 giorni sì, dopo no, prima no",
    [true, false, false, false],
    [D.entroIlTempo(ore(48), ore(1)), D.entroIlTempo(ore(15 * 24), ore(1)), D.entroIlTempo(ore(1), ore(48)), D.entroIlTempo(undefined, ore(1))]);
  c("tipo del file dall'estensione", ["image/jpeg", "application/pdf", null], [D.mimeDaUrl(H + "a.JPG"), D.mimeDaUrl(H + "a.pdf"), D.mimeDaUrl(H + "a.bin")]);
  const pc = D.percorsoFile("u1", "l1", "xyz", "image/png");
  c("percorso: utente/scheda/casuale.est, nessun nome", "u1/l1/xyz.png", pc);

  gruppo("DATI FATTURA · LA LETTURA DEL TESTO È PRUDENTE");
  const letto = D.leggiJsonDatiTesto("```json\n" + JSON.stringify({
    nome: "MARIO", cognome: "ROSSI", codiceFiscale: CF, indirizzo: "via roma 1", cap: "00100", comune: "ROMA", provincia: "rm",
    partitaIva: "12345678901", pec: "Mario@Pec.it", codiceDestinatario: "abcdefg", denominazione: "",
  }) + "\n```");
  c("campi ripuliti", { nome: "Mario", cognome: "Rossi", codiceFiscale: CF, cap: "00100", comune: "Roma", provincia: "RM", partitaIva: "12345678901", pec: "mario@pec.it", codiceDestinatario: "ABCDEFG" },
    Object.fromEntries(Object.entries(letto).filter(([k]) => !["indirizzo", "documenti"].includes(k))));
  const storto = D.leggiJsonDatiTesto(JSON.stringify({ codiceFiscale: CF.slice(0, 15) + "A".replace(CF[15], "B"), cap: "7010", partitaIva: "123", pec: "non-una-pec", codiceDestinatario: "123" }));
  c("CF col controllo sbagliato, CAP corto, P.IVA corta, PEC senza chiocciola, SDI corto: non entrano", {}, storto);
  c("risposta non JSON → vuoto", {}, D.leggiJsonDatiTesto("Non lo so"));
  c("più letture si uniscono (primo valore non vuoto)", { nome: "A", cognome: "B", cap: "00100" },
    D.unisciLetture([{ nome: "A" }, { nome: "X", cognome: "B" }, { cap: "00100" }]));

  gruppo("DATI FATTURA · LA BOZZA (MAI EMESSA, MAI SOVRASCRITTA)");
  const scheda = { id: "L1", nome: "Mario", cognome: "R", email: "M@x.it", payment: { accontoPagato: 122, prezzoFinaleVendita: 1000 } };
  const nuova = D.bozzaDaDati({ scheda, letti: { nome: "Mario", cognome: "Rossi", codiceFiscale: CF, indirizzo: "Via Roma 1", cap: "00100", comune: "Roma", provincia: "RM" }, esistente: null, aliquota: 22, adesso: ADESSO }).bozza;
  c("è una bozza: stato, numero 0, data vuota", ["bozza", 0, "", "", "bozza:L1"], [nuova.stato, nuova.numero, nuova.data, nuova.emessaIl, nuova.id]);
  c("acconto: importo dall'acconto, IVA scorporata (122 = 100 + 22)", [100, 22, 122, "acconto"], [nuova.imponibile, nuova.imposta, nuova.totale, nuova.tipo]);
  c("dal documento: cognome completo vince su quello sentito al telefono", "Rossi", nuova.cliente.cognome);
  c("cliente privato con i dati letti", [CF, "Via Roma 1", "00100", "Roma", "RM", false], [nuova.cliente.codiceFiscale, nuova.cliente.indirizzo, nuova.cliente.cap, nuova.cliente.comune, nuova.cliente.provincia, nuova.cliente.azienda]);
  c("tutto pagato → fattura «unica»", "unica", D.bozzaDaDati({ scheda: { ...scheda, payment: { accontoPagato: 1000, prezzoFinaleVendita: 1000 } }, letti: {}, esistente: null, aliquota: 22, adesso: ADESSO }).bozza.tipo);
  c("aliquota 0 (forfettario): imposta 0", [122, 0], (({ imponibile, imposta }) => [imponibile, imposta])(D.bozzaDaDati({ scheda, letti: {}, esistente: null, aliquota: 0, adesso: ADESSO }).bozza));
  const ric = D.bozzaDaDati({ scheda, letti: { nome: "Altro", cognome: "Nome", comune: "Milano", cap: "20100", pec: "a@b.it" }, esistente: nuova, aliquota: 22, adesso: ADESSO });
  c("bozza esistente: i campi pieni NON si toccano, i vuoti sì", ["Rossi", "Roma", "00100", "a@b.it"], [ric.bozza.cliente.cognome, ric.bozza.cliente.comune, ric.bozza.cliente.cap, ric.bozza.cliente.pec]);
  c("bozza esistente: importi e numero invariati", [nuova.totale, 0, "bozza"], [ric.bozza.totale, ric.bozza.numero, ric.bozza.stato]);
  const az = D.bozzaDaDati({ scheda, letti: { denominazione: "Rossi Srl", partitaIva: "12345678901", codiceDestinatario: "ABCDEFG" }, esistente: null, aliquota: 22, adesso: ADESSO }).bozza;
  c("azienda: ragione sociale, P.IVA, codice destinatario", [true, "Rossi Srl", "12345678901", "ABCDEFG"], [az.cliente.azienda, az.cliente.denominazione, az.cliente.partitaIva, az.cliente.codiceDestinatario]);

  gruppo("DATI FATTURA · «DA FARE» (PROMEMORIA)");
  const R = mod["dafare/righe"];
  const lead = (id, df) => ({ id, created_at: ore(100), data: { nome: id, cognome: "X", telefono: "+393331110000", stato: "acconto", createdAt: ore(100), payment: { accontoPagato: 100 }, ...(df ? { datiFattura: df } : {}) } });
  const righe = R.costruisciRighe({ leads: [lead("P", { stato: "promemoria", motivo: "finestra_chiusa_senza_modello" }), lead("G", { stato: "da_guardare" }), lead("I", { stato: "richiesta_inviata" }), lead("B", { stato: "bozza_pronta" }), lead("N")], task: [], ora: ADESSO }).filter((r) => r.tipo === "dati_fattura");
  c("in «Da fare» restano solo promemoria e da guardare", ["G", "P"], righe.map((r) => r.lead.id).sort());
  c("la frase dice cosa fare", true, righe.every((r) => r.cosa.startsWith("Chiedere i dati per la fattura a")));
  c("il filtro esiste", true, R.TIPI_RIGA.includes("dati_fattura") && !!R.META_RIGA.dati_fattura.filtro);

  gruppo("DATI FATTURA · NIENTE DATI PERSONALI IN app_config (se non nella bozza)");
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const srv = readFileSync(join(radice, "src/crm/fatture/dati-fattura.server.ts"), "utf8");
  const chiavi = [...srv.matchAll(/CHIAVE_[A-Z_]+ = "([^"]+)"/g)].map((x) => x[1]).sort();
  c("le uniche chiavi proprie in app_config: interruttore e lucchetto", ["dati_fattura_config", "dati_fattura_lock"], chiavi);
  c("nessuna cache dell'AI: niente prefisso di lettura, niente upsert di risposte", [false, false], [/dati_fattura_ai/.test(srv), /upsert\(\{ key: kc/.test(srv)]);
  c("l'unica scrittura di dati in app_config oltre a config/lucchetto è la bozza (archivio)", true, /fattura_bozza:\$\{f\.leadId\}/.test(srv));

  await proveGiro(mod, { c, gruppo, CF, ADESSO, ore, H });
}

/* ═══ IL GIRO, CON PORTE FINTE ═══════════════════════════════════════════ */
async function proveGiro(mod, { c, gruppo, CF, ADESSO, ore, H }) {
  const G = mod["fatture/dati-fattura-giro"];
  gruppo("DATI FATTURA · IL GIRO");
  const mondo = (o = {}) => {
    const m = {
      config: { acceso: true, avvio: "fatto" },
      schede: [],
      contatti: {},
      modello: false,
      esitoInvio: "ok",
      messaggi: {},
      scarica: true,
      ai: (i) => JSON.stringify(i.testo ? { nome: "Anna", cognome: "Verdi", codiceFiscale: CF, indirizzo: "Via Po 3", cap: "00198", comune: "Roma", provincia: "RM" } : { nome: "Anna", cognome: "Verdi", codiceFiscale: CF, indirizzo: "Via Po 3", cap: "00198", comune: "Roma", provincia: "RM", documenti: ["tessera sanitaria"] }),
      bozze: {},
      inviati: [],
      scritture: [],
      chiamateAi: 0,
      scaricati: [],
      lettureAi: [],
      lockOccupato: false,
      rilasci: 0,
      rifiutaBozzaPronta: 0,
      bozzeScritte: 0,
      versione: 0,
      ...o,
    };
    m.porte = {
      adesso: () => ADESSO,
      lucchetto: {
        prendi: async () => !m.lockOccupato,
        rilascia: async () => { m.rilasci++; },
      },
      leggiConfig: async () => m.config,
      salvaConfig: async (cfg) => { m.config = cfg; },
      //  Come il database vero: ogni giro riceve COPIE, e la scrittura è condizionata su updatedAt.
      schedeConAcconto: async () => m.schede.map((s) => structuredClone(s)),
      contatto: async (u, t) => m.contatti[t] ?? { ultimaEntrata: ore(1), stop: false },
      modelloPronto: async () => m.modello,
      invia: async (i) => { m.inviati.push(i); return m.esitoInvio; },
      scriviScheda: async (s, d) => {
        const rec = m.schede.find((x) => x.id === s.id);
        if (!rec || rec.updatedAt !== s.updatedAt) return false;
        if (d.stato === "bozza_pronta" && m.rifiutaBozzaPronta > 0) { m.rifiutaBozzaPronta--; return false; }
        rec.data.datiFattura = d;
        rec.updatedAt = `v${++m.versione}`;
        s.data = structuredClone(rec.data);
        s.updatedAt = rec.updatedAt;
        m.scritture.push(d);
        return true;
      },
      messaggiIn: async (u, l) => m.messaggi[l] ?? [],
      scaricaESalva: async (u, l, url) => { m.scaricati.push(url); return m.scarica ? { percorso: `${u}/${l}/f${m.scaricati.length}.jpg`, dataUrl: "data:image/jpeg;base64,AAAA" } : null; },
      leggi: async (i) => { m.chiamateAi++; m.lettureAi.push(i); return m.ai(i); },
      aliquota: async () => 22,
      leggiBozza: async (l) => m.bozze[l] ?? null,
      scriviBozza: async (f) => {
        if (m.bozzaGuasta) { m.bozzaGuasta = false; return "errore"; }
        m.bozzeScritte++;
        m.bozze[f.leadId] = f;
        return null;
      },
    };
    return m;
  };
  const S = (id, extra = {}) => ({ id, userId: "u1", updatedAt: "x", data: { nome: "Anna", cognome: "V", telefono: "+393331110000", stato: "acconto", payment: { accontoPagato: 244, prezzoFinaleVendita: 2000 }, ...extra } });

  let m = mondo({ config: { acceso: false }, schede: [S("A")] });
  c("spento: non scrive e non invia niente", ["spento", 0, 0], [(await G.giroDatiFattura(m.porte)).stato, m.inviati.length, m.scritture.length]);

  m = mondo({ config: { acceso: true, avvio: "da_fare" }, schede: [S("A"), S("B", { datiFattura: { stato: "bozza_pronta" } })] });
  let r = await G.giroDatiFattura(m.porte);
  c("avvio: chi ha già l'acconto diventa «preesistente», non riceve niente", ["avvio", 1, 0, "preesistente", "fatto"], [r.stato, r.preesistenti, m.inviati.length, m.schede[0].data.datiFattura.stato, m.config.avvio]);
  r = await G.giroDatiFattura(m.porte);
  c("dopo l'avvio il giro non li tocca", [0, 0], [r.richieste, m.inviati.length]);

  m = mondo({ schede: [S("A")] });
  r = await G.giroDatiFattura(m.porte);
  c("acconto + finestra aperta: parte UNA richiesta di testo", [1, "testo", "richiesta_inviata", "df|331110000|A"], [m.inviati.length, m.inviati[0]?.come, m.schede[0].data.datiFattura?.stato, m.inviati[0]?.chiave]);
  c("la richiesta ricorda quando è partita", ADESSO.toISOString(), m.schede[0].data.datiFattura.richiestaIl);
  await G.giroDatiFattura(m.porte);
  c("secondo giro: non ne parte un'altra", 1, m.inviati.length);

  m = mondo({ schede: [S("A")], contatti: { "+393331110000": { ultimaEntrata: ore(40), stop: false } } });
  r = await G.giroDatiFattura(m.porte);
  c("finestra chiusa, modello non pronto: promemoria, NON parte niente", [0, 1, "promemoria", "finestra_chiusa_senza_modello"], [m.inviati.length, r.promemoria, m.schede[0].data.datiFattura.stato, m.schede[0].data.datiFattura.motivo]);
  await G.giroDatiFattura(m.porte);
  c("il promemoria non si riscrive a ogni giro", 1, m.scritture.length);
  m.modello = true;
  await G.giroDatiFattura(m.porte);
  c("appena il modello c'è, la richiesta parte (come modello)", [1, "modello", "richiesta_inviata"], [m.inviati.length, m.inviati[0]?.come, m.schede[0].data.datiFattura.stato]);

  for (const [esito, atteso] of [["stop", "numero_in_stop"], ["saltato", "finestra_chiusa"], ["errore", "invio_non_riuscito"]]) {
    m = mondo({ schede: [S("A")], esitoInvio: esito });
    await G.giroDatiFattura(m.porte);
    c(`invio «${esito}» → promemoria «${atteso}»`, ["promemoria", atteso], [m.schede[0].data.datiFattura.stato, m.schede[0].data.datiFattura.motivo]);
  }
  m = mondo({ schede: [S("A")], esitoInvio: "riprova" });
  await G.giroDatiFattura(m.porte);
  c("pausa del contatto → torna promemoria (si riprova al prossimo giro)", ["promemoria", "pausa_contatto"], [m.schede[0].data.datiFattura.stato, m.schede[0].data.datiFattura.motivo]);
  m = mondo({ schede: [S("A")], esitoInvio: "incerto" });
  await G.giroDatiFattura(m.porte);
  c("esito incerto → segnata come inviata (non si rimanda)", "richiesta_inviata", m.schede[0].data.datiFattura.stato);
  m = mondo({ schede: [S("A")], esitoInvio: "gia_preso" });
  await G.giroDatiFattura(m.porte);
  c("chiave già nel registro → segnata come inviata, senza secondo messaggio", "richiesta_inviata", m.schede[0].data.datiFattura.stato);

  /* ── LA SICUREZZA: UN GIRO ALLA VOLTA, UN MESSAGGIO SOLO, UNA BOZZA SOLA ── */
  gruppo("DATI FATTURA · SICUREZZA (LUCCHETTO, INVIO IDEMPOTENTE, BOZZA DOPO LA SCHEDA)");
  m = mondo({ schede: [S("A")], lockOccupato: true });
  r = await G.giroDatiFattura(m.porte);
  c("lucchetto occupato: il giro non fa NIENTE", ["occupato", 0, 0, 0], [r.stato, m.inviati.length, m.scritture.length, m.rilasci]);
  m = mondo({ schede: [S("A")] });
  await G.giroDatiFattura(m.porte);
  c("lucchetto preso e rilasciato a fine giro", 1, m.rilasci);
  m = mondo({ schede: [S("A")] });
  m.porte.contatto = async () => { throw new Error("db giù"); };
  await G.giroDatiFattura(m.porte);
  c("anche se qualcosa si rompe il lucchetto viene rilasciato", 1, m.rilasci);
  m = mondo({ schede: [S("A")] });
  let statoPrimaDelInvio = null;
  m.porte.invia = async (i) => { statoPrimaDelInvio = m.schede[0].data.datiFattura?.stato; m.inviati.push(i); return "ok"; };
  await G.giroDatiFattura(m.porte);
  c("la scheda è già «richiesta inviata» PRIMA che il messaggio parta", "richiesta_inviata", statoPrimaDelInvio);
  m = mondo({ schede: [S("A"), S("B")] });
  const slot = m.porte.invia;
  m.porte.invia = async (i) => { await new Promise((r2) => setTimeout(r2, 5)); return slot(i); };
  const [g1, g2] = await Promise.all([G.giroDatiFattura(m.porte), G.giroDatiFattura(m.porte)]);
  c("DUE giri insieme (senza lucchetto): un solo messaggio per scheda", [2, 2], [m.inviati.length, g1.richieste + g2.richieste]);
  c("…e mai lo stesso lead due volte", 2, new Set(m.inviati.map((x) => x.leadId)).size);
  m = mondo({ schede: [S("A")], esitoInvio: "errore" });
  await G.giroDatiFattura(m.porte);
  await G.giroDatiFattura(m.porte);
  c("invio fallito: la prenotazione è tolta (promemoria) e non si riprova a raffica", "promemoria", m.schede[0].data.datiFattura.stato);

  /* ── LA RISPOSTA ── */
  const dopo = (h) => ore(h);
  const inviata = (id, extra = {}) => S(id, { datiFattura: { stato: "richiesta_inviata", richiestaIl: ore(5) }, ...extra });
  m = mondo({ schede: [inviata("A")], messaggi: { A: [{ id: "w1", body: H + "t.jpg", canale: "manychat", creatoIl: dopo(2) }, { id: "w0", body: "Ok grazie", canale: "manychat", creatoIl: dopo(3) }] } });
  r = await G.giroDatiFattura(m.porte);
  const dfa = m.schede[0].data.datiFattura;
  c("foto: scaricata, letta, BOZZA creata", [1, 1, 1, "bozza_pronta"], [m.scaricati.length, m.chiamateAi, r.bozze, dfa.stato]);
  c("la foto è nel bucket privato (percorso utente/scheda)", true, dfa.file.length === 1 && dfa.file[0].startsWith("u1/A/"));
  c("la bozza ha i dati letti e NON è emessa", ["Verdi", CF, "bozza", 0, 244], [m.bozze.A.cliente.cognome, m.bozze.A.cliente.codiceFiscale, m.bozze.A.stato, m.bozze.A.numero, m.bozze.A.totale]);
  c("messaggi letti ricordati", ["w0", "w1"], [...dfa.letti].sort());
  await G.giroDatiFattura(m.porte);
  c("secondo giro: nessun nuovo scarico né nuova lettura", [1, 1], [m.scaricati.length, m.chiamateAi]);

  /* sicurezza sulla risposta */
  const foto = (id = "w1") => ({ id, body: H + `${id}.jpg`, canale: "manychat", creatoIl: dopo(2) });
  m = mondo({ schede: [inviata("A")], messaggi: { A: [foto()] } });
  await G.giroDatiFattura(m.porte);
  c("bozza scritta: i dati interpretati NON restano sulla scheda", undefined, m.schede[0].data.datiFattura.letture);
  m = mondo({ schede: [inviata("A")], messaggi: { A: [foto()] }, rifiutaBozzaPronta: 1 });
  await G.giroDatiFattura(m.porte);
  c("la lettura è salvata SULLA SCHEDA con l'id del messaggio (non in app_config)", ["f:w1"], Object.keys(m.schede[0].data.datiFattura.letture ?? {}));
  c("…ed è già interpretata (campi puliti), non il testo del modello", CF, m.schede[0].data.datiFattura.letture["f:w1"].codiceFiscale);
  m = mondo({ schede: [inviata("A")], messaggi: { A: [foto()] }, rifiutaBozzaPronta: 1 });
  await G.giroDatiFattura(m.porte);
  c("scheda cambiata nel frattempo (scrittura rifiutata): la bozza NON si scrive", [0, 1], [m.bozzeScritte, m.chiamateAi]);
  await G.giroDatiFattura(m.porte);
  c("giro dopo: la bozza nasce SENZA rileggere con l'AI", [1, 1, "bozza_pronta"], [m.bozzeScritte, m.chiamateAi, m.schede[0].data.datiFattura.stato]);
  m = mondo({ schede: [inviata("A")], messaggi: { A: [foto()] }, bozzaGuasta: true });
  r = await G.giroDatiFattura(m.porte);
  c("bozza non scritta: la scheda torna com'era (si riprova), errore contato", ["richiesta_inviata", undefined, 1], [m.schede[0].data.datiFattura.stato, m.schede[0].data.datiFattura.letti, r.errori]);
  await G.giroDatiFattura(m.porte);
  c("…e il giro dopo la scrive, con la lettura AI già tenuta (una chiamata sola in tutto)", [1, 1, "bozza_pronta"], [m.bozzeScritte, m.chiamateAi, m.schede[0].data.datiFattura.stato]);
  m = mondo({ schede: [inviata("A")], messaggi: { A: [foto()] } });
  const ai0 = m.porte.leggi;
  m.porte.leggi = async (i, k) => { await new Promise((r2) => setTimeout(r2, 5)); return ai0(i, k); };
  await Promise.all([G.giroDatiFattura(m.porte), G.giroDatiFattura(m.porte)]);
  c("DUE giri insieme sulla stessa foto: UNA bozza sola", [1, "bozza_pronta"], [m.bozzeScritte, m.schede[0].data.datiFattura.stato]);

  m = mondo({ schede: [inviata("A")], messaggi: { A: [{ id: "w1", body: `Sono Anna Verdi ${CF} via Po 3 00198 Roma`, canale: "manychat", creatoIl: dopo(2) }] } });
  r = await G.giroDatiFattura(m.porte);
  c("testo coi dati: letto dallo stesso modo, bozza creata, nessun file", [1, 0, 1], [r.bozze, m.scaricati.length, m.chiamateAi]);

  m = mondo({ schede: [inviata("A")], messaggi: { A: [{ id: "w1", body: "Grazie!", canale: "manychat", creatoIl: dopo(2) }] } });
  r = await G.giroDatiFattura(m.porte);
  c("«Grazie!»: nessuna lettura, nessuna bozza, ma il messaggio è visto", [0, 0, 0], [m.chiamateAi, r.bozze, Object.keys(m.bozze).length]);

  m = mondo({ schede: [inviata("A")], messaggi: { A: [{ id: "w1", body: H + "t.jpg", canale: "manychat", creatoIl: dopo(2) }] }, ai: () => "{}" });
  r = await G.giroDatiFattura(m.porte);
  c("foto illeggibile: «da guardare», file conservato, nessuna bozza", ["da_guardare", "non_letto", 1, 0], [m.schede[0].data.datiFattura.stato, m.schede[0].data.datiFattura.motivo, m.schede[0].data.datiFattura.file.length, Object.keys(m.bozze).length]);

  m = mondo({ schede: [inviata("A")], messaggi: { A: [{ id: "w1", body: H + "t.jpg", canale: "manychat", creatoIl: dopo(2) }] }, scarica: false });
  await G.giroDatiFattura(m.porte);
  c("link che non si scarica: «da guardare», niente AI", ["da_guardare", "file_non_scaricato", 0], [m.schede[0].data.datiFattura.stato, m.schede[0].data.datiFattura.motivo, m.chiamateAi]);

  m = mondo({ schede: [inviata("A")], messaggi: { A: [{ id: "w1", body: "[Foto]", canale: "baileys", creatoIl: dopo(2) }] } });
  await G.giroDatiFattura(m.porte);
  c("foto dal ponte (senza file): «da guardare»", ["da_guardare", "media_senza_file"], [m.schede[0].data.datiFattura.stato, m.schede[0].data.datiFattura.motivo]);

  m = mondo({ schede: [inviata("A")], messaggi: { A: [{ id: "w1", body: H + "t.jpg", canale: "manychat", creatoIl: dopo(2) }] }, ai: () => null });
  r = await G.giroDatiFattura(m.porte);
  c("AI giù: errore contato, messaggio NON segnato letto (si riprova), nessuna bozza", [1, undefined, 0], [r.errori, m.schede[0].data.datiFattura.letti, Object.keys(m.bozze).length]);

  m = mondo({ schede: [S("A", { datiFattura: { stato: "richiesta_inviata", richiestaIl: ore(15 * 24) } })], messaggi: { A: [{ id: "w1", body: H + "t.jpg", canale: "manychat", creatoIl: dopo(2) }] } });
  await G.giroDatiFattura(m.porte);
  c("oltre 14 giorni dalla richiesta: non si legge più", 0, m.scaricati.length);

  m = mondo({ schede: [inviata("A")], messaggi: { A: [{ id: "w1", body: H + "t.jpg", canale: "manychat", creatoIl: dopo(6) }] } });
  await G.giroDatiFattura(m.porte);
  c("un messaggio PRIMA della richiesta non conta", 0, m.scaricati.length);

  const esistente = { id: "bozza:A", stato: "bozza", numero: 0, anno: 2026, serie: "", data: "", dataPagamento: "", tipo: "acconto", leadId: "A", leadNome: "Anna", preventivoRef: "", cliente: { azienda: false, denominazione: "", nome: "Anna", cognome: "Bianchi", codiceFiscale: "", partitaIva: "", indirizzo: "", civico: "", cap: "", comune: "", provincia: "", nazione: "IT", codiceDestinatario: "0000000", pec: "" }, righe: [], causale: "", imponibile: 10, imposta: 2.2, totale: 12.2, creataIl: "", emessaIl: "" };
  m = mondo({ schede: [inviata("A")], bozze: { A: esistente }, messaggi: { A: [{ id: "w1", body: H + "t.jpg", canale: "manychat", creatoIl: dopo(2) }] } });
  await G.giroDatiFattura(m.porte);
  c("bozza già esistente: il cognome scritto a mano non si tocca, i vuoti si riempiono, importo invariato", ["Bianchi", CF, 12.2], [m.bozze.A.cliente.cognome, m.bozze.A.cliente.codiceFiscale, m.bozze.A.totale]);

  m = mondo({ schede: [inviata("A")], messaggi: { A: Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, body: H + `t${i}.jpg`, canale: "manychat", creatoIl: dopo(2) })) } });
  await G.giroDatiFattura(m.porte);
  c("al massimo 6 file per scheda", true, m.schede[0].data.datiFattura.file.length <= 6);

  m = mondo({ schede: [S("A"), S("B")] });
  m.porte.invia = async (i) => { if (i.leadId === "A") throw new Error("rete"); return "ok"; };
  r = await G.giroDatiFattura(m.porte);
  c("una scheda che dà errore non ferma le altre", [1, 1], [r.errori, r.richieste]);
  c("il risultato del giro non porta dati (solo conteggi)", true, Object.values(r).every((v) => typeof v === "number" || typeof v === "string"));
}
