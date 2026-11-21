/** ── NEGOZIO · T50 · SPEDIZIONI: IL SERVER DEL CRM ─────────────────────────
 *  `src/crm/negozio/spedizioni.server.ts`: `GET ?spedizioni`, `tariffa_salva`, `tariffa_conferma`, `corrieri_salva`.
 *  Regole (PIANO-R2 §6.1 T50, D51, D62; revisioni di T42 e T45):
 *   · guardia negata = zero chiamate al database e zero log;
 *   · costo 0..99900 centesimi interi; tempi 1..60 (non 0), tutti e due o nessuno, min <= max;
 *   · valore visto vecchio → 409; si scrive SOLO con `rpc` (`shop_tariffa_imposta`, `shop_impostazione_imposta`);
 *   · la conferma toglie `provvisoria` (lo fa la funzione SQL: qui lo si controlla sul finto);
 *   · dopo «Salva» su una tariffa già confermata c'è un avviso;
 *   · tabella assente → `{ok:false, motivo:"migrazione"}`, mai un'eccezione.
 *  Dati inventati. Nessun accesso al database vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tariffaSeme, ID_TARIFFA_SEME } from "./_dati-r2.mjs";
import { porte, post, get, leggi, guardiaNo, ADESSO } from "./_server.mjs";

const CORRIERI_SEME = ["BRT", "GLS", "SDA", "DHL", "UPS", "Poste Italiane"].map((nome) => ({ nome, modello: "" }));
const ISTANTE = "2026-11-20T10:00:00.000Z";
const tabelle = (extra = {}) => ({
  shop_spedizioni_tariffe: [tariffaSeme()],
  shop_impostazioni: [{ chiave: "corrieri", valore: structuredClone(CORRIERI_SEME), aggiornato_il: ISTANTE, aggiornato_da: null }],
  shop_storico: [],
  ...extra,
});
const confermata = () => tariffaSeme({ provvisoria: false, confermata_il: "2026-11-20T11:00:00.000Z", corriere: "BRT", giorni_min: 2, giorni_max: 4, aggiornato_il: "2026-11-20T11:00:00.000Z" });

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · SPEDIZIONI: IL SERVER DEL CRM (21/11/2026, T50)");
  const S = mod["negozio/spedizioni.server"];
  if (!S) return c("il modulo src/crm/negozio/spedizioni.server.ts esiste", true, false);
  const SP = mod["shop/cassa/spedizione"];

  const aperti = [];
  const esegui = async (corpo, opz = {}) => {
    const db = opz.db ?? fintoDb({ tabelle: opz.tabelle ?? tabelle() });
    aperti.push(db);
    const p = porte({ db, ...opz.porte });
    const r = opz.get ? await S.gestisciGET(get(corpo), p.d) : await S.gestisciPOST(post(corpo), p.d);
    return { db, log: p.log, ...(await leggi(r)) };
  };
  const leggiRiga = (db) => db.tabelle.shop_spedizioni_tariffe.find((r) => r.id === ID_TARIFFA_SEME);
  const salva = (extra = {}, atteso = ISTANTE) => ({ azione: "tariffa_salva", id: ID_TARIFFA_SEME, atteso, nome: "Spedizione tracciata in Italia", corriere: null, costoCent: 490, giorniMin: null, giorniMax: null, attiva: true, ...extra });
  const conferma = (atteso = ISTANTE) => ({ azione: "tariffa_conferma", id: ID_TARIFFA_SEME, atteso });
  const salvaCorrieri = (corrieri, atteso = CORRIERI_SEME) => ({ azione: "corrieri_salva", corrieri, atteso });
  const rpcDi = (db) => db.registro.filter((q) => q.op === "rpc");

  // ── la guardia ──
  for (const stato of [401, 403]) {
    const g = await esegui("spedizioni", { get: true, porte: { guardia: guardiaNo(stato) } });
    for (const corpo of [salva({ costoCent: 590 }), conferma(), salvaCorrieri([{ nome: "BRT", modello: "" }])]) {
      const p = await esegui(corpo, { porte: { guardia: guardiaNo(stato) } });
      c(`guardia negata (${stato}) su ${corpo.azione}: zero chiamate al database e zero log`, [stato, 0, 0], [p.stato, p.db.chiamate, p.log.length]);
    }
    c(`guardia negata (${stato}) in lettura: zero chiamate e zero log`, [stato, 0, 0], [g.stato, g.db.chiamate, g.log.length]);
  }

  // ── la lettura ──
  const l = await esegui("spedizioni", { get: true });
  c("GET ?spedizioni: la tariffa con i campi del CRM, provvisoria e non confermata", [200, true, ID_TARIFFA_SEME, 490, null, null, true, true, false],
    [l.stato, l.corpo.ok, l.corpo.tariffa?.id, l.corpo.tariffa?.costoCent, l.corpo.tariffa?.giorniMin, l.corpo.tariffa?.giorniMax, l.corpo.tariffa?.attiva, l.corpo.tariffa?.provvisoria, l.corpo.tariffa?.confermata]);
  c("…con la versione (aggiornatoIl) che serve al «Salva» e i sei corrieri del seme", [ISTANTE, CORRIERI_SEME], [l.corpo.tariffa?.aggiornatoIl, l.corpo.corrieri]);
  c("…solo letture", [], l.db.registro.filter((q) => q.op !== "select"));
  const lc = await esegui("spedizioni", { get: true, tabelle: tabelle({ shop_spedizioni_tariffe: [confermata()] }) });
  c("tariffa confermata nel passato → `confermata` vero", [true, "BRT", 2, 4], [lc.corpo.tariffa?.confermata, lc.corpo.tariffa?.corriere, lc.corpo.tariffa?.giorniMin, lc.corpo.tariffa?.giorniMax]);
  const lf = await esegui("spedizioni", { get: true, tabelle: tabelle({ shop_spedizioni_tariffe: [tariffaSeme({ provvisoria: false, confermata_il: "2026-11-21T12:00:00.000Z" })] }) });
  c("`confermata_il` nel futuro → ancora non confermata (come la vede il pubblico)", false, lf.corpo.tariffa?.confermata);
  const ln = await esegui("spedizioni", { get: true, tabelle: tabelle({ shop_spedizioni_tariffe: [] }) });
  c("tabella presente ma senza righe → tariffa nulla, niente errore", [200, null], [ln.stato, ln.corpo.tariffa]);
  const lg = await esegui("spedizioni", { get: true, tabelle: tabelle({ shop_spedizioni_tariffe: [tariffaSeme({ attiva: false }), tariffaSeme({ id: "00000000-0000-4000-8000-00000000800b", attiva: true, costo_cent: 690, creato_il: "2026-11-20T11:00:00.000Z" })] }) });
  c("fra due righe la tariffa mostrata è l'attiva", 690, lg.corpo.tariffa?.costoCent);
  const altro = await esegui("boh", { get: true });
  c("GET senza ?spedizioni → 400, nessuna chiamata", [400, 0], [altro.stato, altro.db.chiamate]);

  // ── lo storico dal database ──
  const s1 = await esegui(salva({ costoCent: 590, corriere: "BRT" }));
  const dopoSalva = s1.db;
  const l2 = await esegui("spedizioni", { get: true, db: dopoSalva });
  c("lo storico viene dal database: una riga per campo cambiato, con chi, prima e dopo", [["costo_cent", 490, 590, "Titolare Prova"], ["corriere", null, "BRT", "Titolare Prova"]],
    [["costo_cent", "corriere"].map((campo) => { const r = l2.corpo.storico?.find((x) => x.campo === campo); return [r?.campo, r?.prima, r?.dopo, r?.chi]; })].flat());
  const sf = await esegui("spedizioni", { get: true, db: fintoDb({ tabelle: tabelle(), errori: { "shop_storico.select": { error: { code: "57P01", message: "PROVA storico" } } } }) });
  c("se lo storico non si legge la tariffa arriva lo stesso (storico vuoto, log col solo codice)", [200, true, 0, false], [sf.stato, sf.corpo.tariffa?.id === ID_TARIFFA_SEME, sf.corpo.storico?.length, JSON.stringify(sf.corpo).includes("PROVA storico")]);

  // ── tariffa_salva: il caso buono ──
  c("salva costo 590 e BRT → 200 con la tariffa nuova (i tempi restano vuoti)", [200, true, true, 590, "BRT", null, null, true],
    [s1.stato, s1.corpo.ok, s1.corpo.cambiato, s1.corpo.tariffa?.costoCent, s1.corpo.tariffa?.corriere, s1.corpo.tariffa?.giorniMin, s1.corpo.tariffa?.giorniMax, s1.corpo.tariffa?.attiva]);
  c("…la riga nel database è cambiata e ha una versione nuova", [590, "BRT", true], [leggiRiga(s1.db).costo_cent, leggiRiga(s1.db).corriere, leggiRiga(s1.db).aggiornato_il !== ISTANTE]);
  c("…la versione restituita è quella vera del database", leggiRiga(s1.db).aggiornato_il, s1.corpo.tariffa?.aggiornatoIl);
  const rpc1 = rpcDi(s1.db);
  c("…UNA sola chiamata di scrittura: la funzione shop_tariffa_imposta, con i soli campi cambiati, senza conferma, con chi", [1, "shop_tariffa_imposta", ID_TARIFFA_SEME, { corriere: "BRT", costo_cent: 590 }, false, "Titolare Prova"],
    [rpc1.length, rpc1[0]?.nome, rpc1[0]?.args.p_id, rpc1[0]?.args.p_campi, rpc1[0]?.args.p_conferma, rpc1[0]?.args.p_chi]);
  c("…tariffa provvisoria: nessun avviso di «già confermata»", false, "avviso" in s1.corpo && Boolean(s1.corpo.avviso));
  const conTempi = await esegui(salva({ costoCent: 490, giorniMin: 2, giorniMax: 4 }));
  c("tempi 2 e 4 → in giorni_min / giorni_max (interi)", [200, { giorni_min: 2, giorni_max: 4 }], [conTempi.stato, rpcDi(conTempi.db)[0]?.args.p_campi]);
  const stessiGiorni = await esegui(salva({ giorniMin: 3, giorniMax: 3 }));
  c("tempi uguali (3 e 3) → ammessi (min <= max)", 200, stessiGiorni.stato);
  const estremi = [["costo 0", { costoCent: 0 }], ["costo 99900", { costoCent: 99900 }], ["tempi 1-60", { giorniMin: 1, giorniMax: 60 }], ["nome di 80 segni", { nome: "x".repeat(80) }], ["corriere vuoto → nessun corriere", { corriere: "   " }], ["spenta", { attiva: false }]];
  for (const [nome, extra] of estremi) c(`caso limite ammesso: ${nome}`, 200, (await esegui(salva(extra))).stato);
  c("corriere «   » diventa vuoto (null), non una riga di spazi", null, leggiRiga((await esegui(salva({ corriere: "   " }), { tabelle: tabelle({ shop_spedizioni_tariffe: [tariffaSeme({ corriere: "GLS" })] }) })).db).corriere);
  const senzaTempi = await esegui(salva({ giorniMin: null, giorniMax: null }), { tabelle: tabelle({ shop_spedizioni_tariffe: [tariffaSeme({ giorni_min: 2, giorni_max: 4 })] }) });
  c("tempi tolti (entrambi vuoti) → si cancellano dal database (null)", [200, null, null], [senzaTempi.stato, leggiRiga(senzaTempi.db).giorni_min, leggiRiga(senzaTempi.db).giorni_max]);

  // ── tariffa_salva: i valori storti, tutti prima del database ──
  const storti = [
    ["costo negativo (-1)", { costoCent: -1 }], ["costo 99901", { costoCent: 99901 }], ["costo 100.000 € (10.000.000 cent)", { costoCent: 10_000_000 }], ["costo decimale (4,9)", { costoCent: 4.9 }],
    ["costo «590» (testo)", { costoCent: "590" }], ["costo non un numero (NaN)", { costoCent: NaN }], ["costo nullo", { costoCent: null }], ["costo infinito", { costoCent: Infinity }], ["costo mancante", { costoCent: undefined }],
    ["tempi minimo 0", { giorniMin: 0, giorniMax: 3 }], ["tempi massimo 0", { giorniMin: 0, giorniMax: 0 }], ["tempi massimo 61", { giorniMin: 2, giorniMax: 61 }], ["tempi minimo 61", { giorniMin: 61, giorniMax: 61 }], ["tempi negativi", { giorniMin: -1, giorniMax: 3 }],
    ["tempi min > max (5 e 3)", { giorniMin: 5, giorniMax: 3 }], ["tempi decimali", { giorniMin: 2.5, giorniMax: 4 }], ["tempi in testo", { giorniMin: "2", giorniMax: "4" }],
    ["solo il minimo", { giorniMin: 2, giorniMax: null }], ["solo il massimo", { giorniMin: null, giorniMax: 4 }],
    ["nome vuoto", { nome: "" }], ["nome di soli spazi", { nome: "   " }], ["nome oltre 80", { nome: "x".repeat(81) }], ["nome non testo", { nome: 5 }], ["nome con caratteri di controllo", { nome: "ciao\u0000" }],
    ["corriere oltre 40", { corriere: "x".repeat(41) }], ["corriere non testo", { corriere: 7 }],
    ["attiva «sì»", { attiva: "sì" }], ["attiva mancante", { attiva: undefined }], ["attiva 1", { attiva: 1 }],
    ["id non è un uuid", { id: "tariffa-1" }], ["id mancante", { id: undefined }], ["id oggetto", { id: {} }],
    ["atteso mancante", { atteso: undefined }], ["atteso non una data", { atteso: "ieri" }], ["atteso numero", { atteso: 5 }],
  ];
  for (const [nome, extra] of storti) {
    const r = await esegui(salva(extra));
    c(`${nome} → 400 «valore», nessuna chiamata al database, niente scritto`, [400, "valore", 0, 0], [r.stato, r.corpo.motivo, r.db.chiamate, r.db.scritture.length]);
    c(`…${nome}: la frase è in italiano e c'è`, true, typeof r.corpo.frase === "string" && r.corpo.frase.length > 8);
  }
  const cost = await esegui(salva({ costoCent: -5 }));
  c("la frase del costo storto nomina il costo e il tetto", true, /costo/i.test(cost.corpo.frase) && /999/.test(cost.corpo.frase));
  const giorni = await esegui(salva({ giorniMin: 0, giorniMax: 3 }));
  c("la frase dei tempi dice da 1 a 60", true, /1/.test(giorni.corpo.frase) && /60/.test(giorni.corpo.frase));

  // ── versione vecchia, id sconosciuto, nessun cambio, corse ──
  const vec = await esegui(salva({ costoCent: 590 }, "2026-11-19T09:00:00.000Z"));
  c("valore visto vecchio → 409 conflitto, con la tariffa vera, niente scritto, nessuna chiamata di scrittura", [409, "conflitto", 490, ISTANTE, 0, 0], [vec.stato, vec.corpo.motivo, vec.corpo.tariffa?.costoCent, vec.corpo.tariffa?.aggiornatoIl, vec.db.scritture.length, rpcDi(vec.db).length]);
  const forma = await esegui(salva({ costoCent: 590 }, "2026-11-20T10:00:00+00:00"));
  c("la stessa versione scritta con +00:00 invece di Z è la stessa versione (stesso istante)", [200, true], [forma.stato, forma.corpo.cambiato]);
  const senzaId = await esegui(salva({ id: "00000000-0000-4000-8000-0000000099ff" }));
  c("id che non esiste → 404 non_trovato, niente scritto", [404, "non_trovato", 0], [senzaId.stato, senzaId.corpo.motivo, senzaId.db.scritture.length]);
  const uguale = await esegui(salva());
  c("nessun campo cambiato → 200 «non cambiato», nessuna scrittura, nessuna chiamata di funzione", [200, false, 0, 0], [uguale.stato, uguale.corpo.cambiato, uguale.db.scritture.length, rpcDi(uguale.db).length]);
  const corsa = await esegui(salva({ costoCent: 590 }), { db: fintoDb({ tabelle: tabelle(), prima: { "rpc.shop_tariffa_imposta": (t) => { t.shop_spedizioni_tariffe[0].aggiornato_il = "2026-11-20T11:30:00.000Z"; } } }) });
  c("un altro salva fra la lettura e lo scambio (la funzione risponde false) → 409, non «ok»", [409, "conflitto", false], [corsa.stato, corsa.corpo.motivo, corsa.corpo.ok]);

  // ── l'avviso su una tariffa già confermata ──
  const av = await esegui(salva({ costoCent: 590, corriere: "BRT", giorniMin: 2, giorniMax: 4 }, "2026-11-20T11:00:00.000Z"), { tabelle: tabelle({ shop_spedizioni_tariffe: [confermata()] }) });
  c("«Salva» su una tariffa già confermata → 200 e un avviso: già confermata, la modifica è subito visibile ai clienti", [200, true, true, true], [av.stato, av.corpo.cambiato, /già confermata/i.test(av.corpo.avviso ?? ""), /clienti/i.test(av.corpo.avviso ?? "")]);
  c("…e la tariffa resta confermata (la modifica non la riporta provvisoria: lo dice l'avviso)", true, av.corpo.tariffa?.confermata);
  const avUguale = await esegui(salva({ costoCent: 490, corriere: "BRT", giorniMin: 2, giorniMax: 4 }, "2026-11-20T11:00:00.000Z"), { tabelle: tabelle({ shop_spedizioni_tariffe: [confermata()] }) });
  c("tariffa confermata e nessun cambio → nessun avviso", [false, false], [avUguale.corpo.cambiato, Boolean(avUguale.corpo.avviso)]);

  // ── tariffa_conferma ──
  const cf = await esegui(conferma());
  const rigaCf = leggiRiga(cf.db);
  c("«Conferma la tariffa» → 200; `provvisoria` torna falsa e `confermata_il` è scritta", [200, true, false, ADESSO, true], [cf.stato, cf.corpo.cambiato, rigaCf.provvisoria, rigaCf.confermata_il, rigaCf.confermata_il != null]);
  c("…la risposta dice `confermata`", true, cf.corpo.tariffa?.confermata);
  c("…il pubblico la vede confermata (con la funzione di T45 sulla riga scritta)", [true, 490], [SP.leggiSpedizione(rigaCf, Date.parse(ADESSO)).confermata, SP.leggiSpedizione(rigaCf, Date.parse(ADESSO)).costoCent]);
  const rpcCf = rpcDi(cf.db);
  c("…una sola funzione, con conferma vera e nessun campo", [1, "shop_tariffa_imposta", true, {}, "Titolare Prova"], [rpcCf.length, rpcCf[0]?.nome, rpcCf[0]?.args.p_conferma, rpcCf[0]?.args.p_campi, rpcCf[0]?.args.p_chi]);
  c("…lo storico ha la riga «confermata»", true, cf.db.tabelle.shop_storico.some((r) => r.entita === "tariffa" && r.campo === "confermata" && r.chi === "Titolare Prova"));
  const cf2 = await esegui(conferma("2026-11-20T11:00:00.000Z"), { tabelle: tabelle({ shop_spedizioni_tariffe: [confermata()] }) });
  c("già confermata → 200 «non cambiato», nessuna scrittura (la data della conferma non si sposta)", [200, false, 0, 0], [cf2.stato, cf2.corpo.cambiato, cf2.db.scritture.length, rpcDi(cf2.db).length]);
  const cfv = await esegui(conferma("2026-11-19T09:00:00.000Z"));
  c("conferma con il valore visto vecchio → 409, niente scritto", [409, "conflitto", true, 0], [cfv.stato, cfv.corpo.motivo, leggiRiga(cfv.db).provvisoria, cfv.db.scritture.length]);
  const cfi = await esegui({ ...conferma(), id: "00000000-0000-4000-8000-0000000099ff" });
  c("conferma di un id che non esiste → 404", [404, 0], [cfi.stato, cfi.db.scritture.length]);
  for (const [nome, corpo] of [["id storto", { ...conferma(), id: "x" }], ["atteso mancante", { azione: "tariffa_conferma", id: ID_TARIFFA_SEME }], ["atteso storto", conferma("boh")]]) {
    const r = await esegui(corpo);
    c(`conferma con ${nome} → 400, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }
  const cfCorsa = await esegui(conferma(), { db: fintoDb({ tabelle: tabelle(), prima: { "rpc.shop_tariffa_imposta": (t) => { t.shop_spedizioni_tariffe[0].aggiornato_il = "2026-11-20T11:30:00.000Z"; } } }) });
  c("conferma e intanto un altro salva (funzione = false) → 409, non «ok»", [409, "conflitto"], [cfCorsa.stato, cfCorsa.corpo.motivo]);

  // ── corrieri_salva ──
  const MOD = "https://tracking.esempio.test/cerca?n={numero}";
  const nuovi = [{ nome: "BRT", modello: MOD }, { nome: "Corriere locale", modello: "" }];
  const co = await esegui(salvaCorrieri(nuovi));
  const rigaCo = co.db.tabelle.shop_impostazioni.find((r) => r.chiave === "corrieri");
  c("corrieri_salva: due voci → 200, il valore nel database è l'elenco nuovo", [200, true, nuovi], [co.stato, co.corpo.cambiato, rigaCo.valore]);
  c("…con la funzione shop_impostazione_imposta (chiave «corrieri», atteso = quello di prima) e una riga di storico", [1, "shop_impostazione_imposta", "corrieri", CORRIERI_SEME, nuovi, "Titolare Prova", 1],
    [rpcDi(co.db).length, rpcDi(co.db)[0]?.nome, rpcDi(co.db)[0]?.args.p_chiave, rpcDi(co.db)[0]?.args.p_atteso, rpcDi(co.db)[0]?.args.p_nuovo, rpcDi(co.db)[0]?.args.p_chi, co.db.tabelle.shop_storico.length]);
  c("…il link del corriere si costruisce con il modello salvato (T45)", "https://tracking.esempio.test/cerca?n=ABC123", SP.corriereLink(co.corpo.corrieri, "BRT", "ABC123"));
  const extra = await esegui(salvaCorrieri([{ nome: "BRT", modello: "", url: "https://x.test", evil: 1 }]));
  c("chiavi in più nelle voci (url, evil) non si salvano: solo {nome, modello}", [[{ nome: "BRT", modello: "" }]], [extra.db.tabelle.shop_impostazioni.find((r) => r.chiave === "corrieri").valore]);
  const spazi = await esegui(salvaCorrieri([{ nome: "  BRT  ", modello: "  " }]));
  c("nome e modello senza spazi ai bordi", [[{ nome: "BRT", modello: "" }]], [spazi.db.tabelle.shop_impostazioni.find((r) => r.chiave === "corrieri").valore]);
  c("elenco vuoto ammesso (nessun corriere)", [200, []], [(await esegui(salvaCorrieri([]))).stato, (await esegui(salvaCorrieri([]))).db.tabelle.shop_impostazioni[0].valore]);
  const venti = Array.from({ length: 20 }, (_, i) => ({ nome: `Corriere ${i + 1}`, modello: "" }));
  c("20 voci → ammesse", 200, (await esegui(salvaCorrieri(venti))).stato);
  const unico = await esegui(salvaCorrieri(nuovi), { tabelle: tabelle({ shop_impostazioni: [{ chiave: "corrieri", valore: [{ nome: "BRT", modello: "" }], aggiornato_il: ISTANTE, aggiornato_da: null }] }) });
  c("il valore visto è quello dell'elenco com'era (ok anche con un elenco più corto)", 200, (await esegui(salvaCorrieri(nuovi, [{ nome: "BRT", modello: "" }]), { tabelle: tabelle({ shop_impostazioni: [{ chiave: "corrieri", valore: [{ nome: "BRT", modello: "" }], aggiornato_il: ISTANTE, aggiornato_da: null }] }) })).stato);
  c("…e con l'elenco di un altro (valore visto vecchio) → 409 con l'elenco vero", [409, "conflitto", [{ nome: "BRT", modello: "" }]], [unico.stato, unico.corpo.motivo, unico.corpo.corrieri]);
  const stortiC = [
    ["21 voci", salvaCorrieri([...venti, { nome: "Uno in più", modello: "" }])], ["non un elenco", salvaCorrieri("BRT")], ["elenco mancante", { azione: "corrieri_salva", atteso: CORRIERI_SEME }],
    ["voce non un oggetto", salvaCorrieri(["BRT"])], ["voce nulla", salvaCorrieri([null])], ["nome vuoto", salvaCorrieri([{ nome: "", modello: "" }])], ["nome di soli spazi", salvaCorrieri([{ nome: "   ", modello: "" }])],
    ["nome oltre 40", salvaCorrieri([{ nome: "x".repeat(41), modello: "" }])], ["nome non testo", salvaCorrieri([{ nome: 5, modello: "" }])], ["nome con caratteri di controllo", salvaCorrieri([{ nome: "A\u0007", modello: "" }])],
    ["nomi doppi (anche con le maiuscole)", salvaCorrieri([{ nome: "BRT", modello: "" }, { nome: "brt", modello: "" }])],
    ["modello http://", salvaCorrieri([{ nome: "BRT", modello: "http://x.test/{numero}" }])], ["modello javascript:", salvaCorrieri([{ nome: "BRT", modello: "javascript:alert({numero})" }])],
    ["modello data:", salvaCorrieri([{ nome: "BRT", modello: "data:text/html,{numero}" }])], ["modello senza {numero}", salvaCorrieri([{ nome: "BRT", modello: "https://x.test/cerca" }])],
    ["modello con {numero} nel nome del sito", salvaCorrieri([{ nome: "BRT", modello: "https://{numero}.x.test/" }])], ["modello con @ nel nome del sito", salvaCorrieri([{ nome: "BRT", modello: "https://x.test@{numero}/" }])],
    ["modello con spazi", salvaCorrieri([{ nome: "BRT", modello: "https://x.test/ {numero}" }])], ["modello oltre 300", salvaCorrieri([{ nome: "BRT", modello: `https://x.test/${"a".repeat(300)}?n={numero}` }])],
    ["modello non testo", salvaCorrieri([{ nome: "BRT", modello: 5 }])], ["modello mancante", salvaCorrieri([{ nome: "BRT" }])],
    ["atteso mancante", { azione: "corrieri_salva", corrieri: [] }], ["atteso non un elenco", salvaCorrieri([], "x")],
  ];
  for (const [nome, corpo] of stortiC) {
    const r = await esegui(corpo);
    c(`corrieri: ${nome} → 400, nessuna chiamata al database`, [400, 0, 0], [r.stato, r.db.chiamate, r.db.scritture.length]);
  }
  const cuguale = await esegui(salvaCorrieri(CORRIERI_SEME));
  c("corrieri: stesso elenco → 200 «non cambiato», nessuna funzione chiamata", [200, false, 0], [cuguale.stato, cuguale.corpo.cambiato, rpcDi(cuguale.db).length]);
  const cvec = await esegui(salvaCorrieri(nuovi, [{ nome: "Vecchio", modello: "" }]));
  c("corrieri: valore visto vecchio → 409 con l'elenco vero, niente scritto", [409, "conflitto", CORRIERI_SEME, 0], [cvec.stato, cvec.corpo.motivo, cvec.corpo.corrieri, cvec.db.scritture.length]);
  const cmanca = await esegui(salvaCorrieri(nuovi), { tabelle: tabelle({ shop_impostazioni: [] }) });
  c("corrieri: il seme di S5 manca → 409 «migrazione» (non lo crea da sé)", [409, "migrazione", 0], [cmanca.stato, cmanca.corpo.motivo, cmanca.db.scritture.length]);
  const ccorsa = await esegui(salvaCorrieri(nuovi), { db: fintoDb({ tabelle: tabelle(), prima: { "rpc.shop_impostazione_imposta": (t) => { t.shop_impostazioni[0].valore = [{ nome: "Altro", modello: "" }]; } } }) });
  c("corrieri: un altro salva fra la lettura e lo scambio → 409, non «ok»", [409, "conflitto"], [ccorsa.stato, ccorsa.corpo.motivo]);

  // ── tabella assente, funzione assente, guasti ──
  for (const [nome, opzioni] of [["tabella assente (42P01)", { mancante: ["shop_spedizioni_tariffe"] }], ["tabella assente (PGRST205)", { mancante: ["shop_spedizioni_tariffe"], codiceMancante: "PGRST205" }], ["niente di S1 e S5", { mancante: true }]]) {
    const mg = await esegui("spedizioni", { get: true, db: fintoDb({ tabelle: tabelle(), ...opzioni }) });
    const mp = await esegui(salva({ costoCent: 590 }), { db: fintoDb({ tabelle: tabelle(), ...opzioni }) });
    const mc = await esegui(conferma(), { db: fintoDb({ tabelle: tabelle(), ...opzioni }) });
    c(`S5 non applicata, ${nome} → {ok:false, motivo:"migrazione"} in lettura, salva e conferma (mai un'eccezione)`, [[409, false, "migrazione"], [409, false, "migrazione"], [409, false, "migrazione"]],
      [[mg.stato, mg.corpo.ok, mg.corpo.motivo], [mp.stato, mp.corpo.ok, mp.corpo.motivo], [mc.stato, mc.corpo.ok, mc.corpo.motivo]]);
  }
  const sf2 = await esegui(salva({ costoCent: 590 }), { db: fintoDb({ tabelle: tabelle(), errori: { "rpc.shop_tariffa_imposta": { error: { code: "PGRST202", message: "PROVA funzione" } } } }) });
  c("la funzione SQL non c'è (PGRST202) → 409 «migrazione»", [409, "migrazione"], [sf2.stato, sf2.corpo.motivo]);
  const sg = await esegui(salva({ costoCent: 590 }), { db: fintoDb({ tabelle: tabelle(), errori: { "rpc.shop_tariffa_imposta": { error: { code: "XX003", message: "PROVA riga intera con dati" } } } }) });
  c("errore della funzione → 500 generico, log col solo codice, nessun testo nella risposta", [500, ["scambio XX003"], false], [sg.stato, sg.log, /PROVA|XX003|dati/.test(JSON.stringify(sg.corpo))]);
  const alt = await esegui(salva({ costoCent: 590 }), { db: fintoDb({ tabelle: tabelle(), errori: { "rpc.shop_tariffa_imposta": { error: { code: "23505", message: "duplicate" } } } }), tabelle: undefined });
  c("un'altra tariffa già attiva (23505) → 409 con una frase che lo dice", [409, "conflitto", true], [alt.stato, alt.corpo.motivo, /attiva/i.test(alt.corpo.frase ?? "")]);
  const rl = await esegui("spedizioni", { get: true, db: fintoDb({ tabelle: tabelle(), errori: { "shop_spedizioni_tariffe.select": { error: { code: "57P01", message: "PROVA lettura" } } } }) });
  c("lettura che fallisce → 500 generico, log col solo codice", [500, false, 1], [rl.stato, /PROVA/.test(JSON.stringify(rl.corpo)), rl.log.length]);
  c("…e il codice è nel log, il testo no", [true, false], [rl.log.some((x) => x.includes("57P01")), rl.log.some((x) => x.includes("PROVA"))]);
  const rx = await esegui("spedizioni", { get: true, db: fintoDb({ tabelle: tabelle(), errori: { "shop_spedizioni_tariffe.select": { lancia: new TypeError("PROVA rete con dati") } } }) });
  c("il database lancia un'eccezione → 500 generico, mai un'eccezione fuori, nel log solo il nome del tipo", [500, "interno", false, ["eccezione TypeError"]], [rx.stato, rx.corpo.motivo, /PROVA/.test(JSON.stringify(rx.corpo)), rx.log]);
  const gx = await S.gestisciGET(get("spedizioni"), porte({ db: fintoDb({ tabelle: tabelle() }), guardia: async () => { throw new Error("PROVA guardia"); } }).d);
  c("la guardia che lancia → 500 JSON, non un'eccezione", 500, gx.status);

  // ── corpo storto e azioni sconosciute ──
  for (const [nome, corpo] of [["JSON rotto", "{no"], ["lista", "[]"], ["azione sconosciuta", { azione: "tariffa_boh" }], ["senza azione", { id: ID_TARIFFA_SEME }], ["azione di un altro modulo", { azione: "interruttore_imposta", chiave: "catalogo_sito", valore: "cms", atteso: "codice" }]]) {
    const r = await esegui(corpo);
    c(`corpo storto (${nome}) → 400, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }
  for (const nome of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    const r = await esegui({ azione: nome, id: ID_TARIFFA_SEME });
    c(`azione «${nome}» → 400 azione_sconosciuta, nessuna chiamata`, [400, "azione_sconosciuta", 0], [r.stato, r.corpo.motivo, r.db.chiamate]);
  }
  const grande = await esegui(JSON.stringify({ azione: "tariffa_salva", nome: "x".repeat(40_000) }));
  c("corpo di 40.000 segni → 413, nessuna chiamata", [413, 0], [grande.stato, grande.db.chiamate]);
  c("le azioni del modulo", ["corrieri_salva", "tariffa_conferma", "tariffa_salva"], [...S.AZIONI_SPEDIZIONI].sort());

  // ── il registro di tutte le chiamate: si scrive solo con rpc ──
  const scritture = aperti.flatMap((db) => db.registro.filter((q) => q.tab && q.op !== "select").map((q) => `${q.tab}.${q.op}`));
  c(`in tutte le ${aperti.length} corse: nessuna scrittura diretta su nessuna tabella (nemmeno su shop_spedizioni_tariffe)`, [], scritture);
  const funzioni = [...new Set(aperti.flatMap((db) => rpcDi(db).map((q) => q.nome)))].sort();
  c("…e le sole funzioni chiamate sono le due del compito", ["shop_impostazione_imposta", "shop_tariffa_imposta"], funzioni);
  c("…nessuna lettura delle tabelle dei soldi o degli ordini", [], [...new Set(aperti.flatMap((db) => db.registro.filter((q) => q.tab && !["shop_spedizioni_tariffe", "shop_impostazioni", "shop_storico"].includes(q.tab)).map((q) => q.tab)))]);

  // ── il sorgente ──
  const sorg = readFileSync(join(radice, "src/crm/negozio/spedizioni.server.ts"), "utf8");
  const nudo = sorg.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("il sorgente non scrive mai direttamente: niente .insert( .update( .upsert( .delete(", [], [".insert(", ".update(", ".upsert(", ".delete("].filter((t) => nudo.includes(t)));
  c("…passa da shop_tariffa_imposta e shop_impostazione_imposta", [true, true], [nudo.includes("shop_tariffa_imposta"), nudo.includes("shop_impostazione_imposta")]);
  c("…non conosce la cifra di ripiego (490) né la costante della cassa vecchia: il ripiego sta solo in tariffaSpedizione()", [false, false], [/\b490\b/.test(nudo), nudo.includes("SPEDIZIONE_CMS_CENT")]);
  c("…non scrive mai nel log altro che codici (nessun console, nessun messaggio dell'errore)", [false, false], [/console\./.test(nudo), /\.message/.test(nudo)]);
}
