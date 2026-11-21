/** ── NEGOZIO · R2 · T54 · LE EMAIL DELLO SHOP: IL SERVER DEL CRM (permesso `impostazioni`) ───────────────────
 *  `src/crm/negozio/email.server.ts`: `GET ?modelli`, `modello_salva`, `modello_approva`, `modello_acceso`, `anteprima`.
 *  Regole (PIANO-R2 D53, T54; revisioni di T43 e T49):
 *   · guardia negata = zero chiamate al database e zero log (la guardia vera, «impostazioni», la collega la rotta di T57);
 *   · i modelli si scrivono SOLO con `rpc` (`shop_email_modello_salva/approva/acceso`): mai `.insert/.update/.upsert`;
 *   · salvare spegne e toglie l'approvazione (lo fa la funzione SQL); il nome di chi approva lo dà il SERVER (la guardia), mai il corpo;
 *   · «Accendi» e l'anteprima passano da `messaggioInviabile`: un testo non approvato, con `{{…}}` o con una graffa fuori elenco
 *     è rifiutato PRIMA di scrivere (nessuna chiamata di scrittura), con la frase che dice perché;
 *   · la versione (`aggiornatoIl`) si rilegge dopo ogni scrittura (anche `approva` la sposta); tabella assente → `migrazione`;
 *   · nel log solo codici. Dati inventati. Nessun accesso al database vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fintoDb } from "./_finto-db.mjs";
import { modelliEmailSeme } from "./_dati-r2.mjs";
import { porte, post, get, leggi, guardiaNo } from "./_server.mjs";

const sha = (t) => createHash("sha256").update(t, "utf8").digest("hex");
const CHIAVI = ["conferma_ordine", "spedito", "pagamento_non_riuscito", "rimborso", "annullato"];
const SEME_IL = "2026-11-20T10:00:00.000Z";

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO R2 · EMAIL: IL SERVER DEL CRM (T54)");
  const S = mod["negozio/email.server"];
  c("il modulo src/crm/negozio/email.server.ts esiste", true, !!S);
  if (!S) return;
  const T = mod["shop/email/tipi"];

  /** Ogni chiamata a `adesso` del database fa passare un minuto: la versione di un modello cambia a ogni scrittura. */
  const database = (modelli = modelliEmailSeme(), dbOpz = {}) => {
    let n = 0;
    return fintoDb({ tabelle: { shop_email_modelli: structuredClone(modelli), shop_storico: [] }, adesso: () => new Date(Date.UTC(2026, 10, 21, 10, ++n)).toISOString(), ...dbOpz });
  };
  const esegui = async (corpo, { db = database(), get: lettura = false, p = {} } = {}) => {
    const q = porte({ db, ...p });
    const r = lettura ? await S.gestisciGET(get(corpo), q.d) : await S.gestisciPOST(post(corpo), q.d);
    return { db, log: q.log, ...(await leggi(r)) };
  };
  const riga = (db, chiave) => db.tabelle.shop_email_modelli.find((m) => m.chiave === chiave);
  const scrivi = (db) => db.registro.filter((q) => q.op !== "select").map((q) => (q.op === "rpc" ? q.nome : `${q.tab}.${q.op}`));
  const TESTO = "Ciao {nome}, ordine {ref}.\nSegui: {link_ordine}";
  const OGGETTO = "Il tuo ordine {ref}";
  const salvaCorpo = (extra = {}) => ({ azione: "modello_salva", chiave: "annullato", atteso: SEME_IL, oggetto: OGGETTO, testo: TESTO, ...extra });
  /** Un modello già approvato e acceso (stato dopo il giro completo). */
  const approvato = (chiave = "annullato", extra = {}) => modelliEmailSeme().map((m) => (m.chiave === chiave ? { ...m, oggetto: OGGETTO, testo: TESTO, approvato_da: "Titolare Prova", approvato_il: SEME_IL, approvato_hash: sha(`${OGGETTO}\n${TESTO}`), ...extra } : m));

  // ── la guardia ──
  for (const stato of [401, 403]) {
    const g = await esegui("modelli", { get: true, p: { guardia: guardiaNo(stato) } });
    c(`guardia negata (${stato}) in lettura: zero chiamate e zero log`, [stato, 0, 0], [g.stato, g.db.chiamate, g.log.length]);
    for (const corpo of [salvaCorpo(), { azione: "modello_approva", chiave: "annullato", impronta: sha("x") }, { azione: "modello_acceso", chiave: "annullato", acceso: true }, { azione: "anteprima", chiave: "annullato", oggetto: "a", testo: "b" }]) {
      const r = await esegui(corpo, { p: { guardia: guardiaNo(stato) } });
      c(`guardia negata (${stato}) su ${corpo.azione}: zero chiamate e zero log`, [stato, 0, 0], [r.stato, r.db.chiamate, r.log.length]);
    }
  }

  // ── la lettura ──
  const l = await esegui("modelli", { get: true });
  c("GET ?modelli: i cinque modelli nell'ordine delle chiavi di S6", [200, true, CHIAVI], [l.stato, l.corpo.ok, l.corpo.modelli?.map((m) => m.chiave)]);
  const m0 = l.corpo.modelli?.[0] ?? {};
  c("…ogni modello: testo, interruttore, approvazione, versione (verbatim) e impronta del testo di oggi", [true, false, false, null, SEME_IL, sha(`${m0.oggetto}\n${m0.testo}`)], [typeof m0.testo === "string", m0.acceso, m0.approvato, m0.approvatoDa, m0.aggiornatoIl, m0.impronta]);
  c("…il seme: non inviabile perché spento; il contenuto dice «segnaposto» con la frase che lo spiega", [{ ok: false, motivo: "spento" }, "segnaposto", true], [{ ok: m0.inviabile?.ok, motivo: m0.inviabile?.motivo }, m0.contenuto?.motivo, typeof m0.contenuto?.frase === "string" && m0.contenuto.frase.length > 10]);
  c("…l'impronta di approvazione (`approvato_hash`) non esce dal server", false, JSON.stringify(l.corpo).includes("approvato_hash") || /"approvatoHash"/.test(JSON.stringify(l.corpo)));
  c("…con l'elenco delle variabili per modello (la sintassi a graffa singola), uguale a quello del modulo puro", true, JSON.stringify(l.corpo.variabili) === JSON.stringify(T.VARIABILI_PER_CHIAVE));
  c("…solo letture", [], scrivi(l.db));
  const lApp = await esegui("modelli", { get: true, db: database(approvato()) });
  const mA = lApp.corpo.modelli?.find((m) => m.chiave === "annullato") ?? {};
  c("un modello con testo vero e approvato: «approvato», contenuto ok; ancora spento → non inviabile per `spento`", [true, true, "Titolare Prova", "spento"], [mA.approvato, mA.contenuto?.ok, mA.approvatoDa, mA.inviabile?.motivo]);
  const lCamb = await esegui("modelli", { get: true, db: database(approvato("annullato", { testo: `${TESTO} (cambiato)` })) });
  c("testo cambiato dopo l'approvazione (impronta diversa) → non più «approvato»", false, lCamb.corpo.modelli?.find((m) => m.chiave === "annullato")?.approvato);
  const lAcc = await esegui("modelli", { get: true, db: database(approvato("annullato", { acceso: true })) });
  c("acceso + approvato + testo vero → `inviabile.ok`", true, lAcc.corpo.modelli?.find((m) => m.chiave === "annullato")?.inviabile?.ok);
  const altro = await esegui("boh", { get: true });
  c("GET senza ?modelli → 400, nessuna chiamata al database", [400, 0], [altro.stato, altro.db.chiamate]);
  const senzaTab = await esegui("modelli", { get: true, db: database(modelliEmailSeme(), { mancante: ["shop_email_modelli"] }) });
  c("tabella assente (S6 non applicata) → `migrazione` 409, mai un'eccezione", [409, "migrazione"], [senzaTab.stato, senzaTab.corpo.motivo]);
  const senzaTabP = await esegui(salvaCorpo(), { db: database(modelliEmailSeme(), { mancante: ["shop_email_modelli"] }) });
  c("…anche scrivendo", [409, "migrazione"], [senzaTabP.stato, senzaTabP.corpo.motivo]);

  // ── salvare ──
  const s = await esegui(salvaCorpo());
  c("modello_salva → una sola `rpc` con chiave, versione vista, testi e il nome di chi salva (dal server)", [["shop_email_modello_salva"], "annullato", SEME_IL, OGGETTO, TESTO, "Titolare Prova"], [scrivi(s.db), s.db.registro.find((q) => q.op === "rpc")?.args.p_chiave, s.db.registro.find((q) => q.op === "rpc")?.args.p_atteso, s.db.registro.find((q) => q.op === "rpc")?.args.p_oggetto, s.db.registro.find((q) => q.op === "rpc")?.args.p_testo, s.db.registro.find((q) => q.op === "rpc")?.args.p_chi]);
  c("…scritto; la risposta porta il modello riletto con la NUOVA versione e la nuova impronta", [200, true, OGGETTO, TESTO, true, sha(`${OGGETTO}\n${TESTO}`)], [s.stato, s.corpo.ok, riga(s.db, "annullato").oggetto, riga(s.db, "annullato").testo, s.corpo.modello?.aggiornatoIl !== SEME_IL && typeof s.corpo.modello?.aggiornatoIl === "string", s.corpo.modello?.impronta]);
  c("…il testo scritto dal titolare con `{nome}` non ha più il segnaposto: contenuto ok, ma NON approvato e spento", [true, false, false], [s.corpo.modello?.contenuto?.ok, s.corpo.modello?.approvato, s.corpo.modello?.acceso]);
  const sAcceso = await esegui(salvaCorpo({ atteso: SEME_IL }), { db: database(approvato("annullato", { acceso: true })) });
  c("salvare un modello acceso e approvato lo SPEGNE e toglie l'approvazione (lo fa il database)", [false, null, null], [riga(sAcceso.db, "annullato").acceso, riga(sAcceso.db, "annullato").approvato_hash, riga(sAcceso.db, "annullato").approvato_da]);
  const sVecchio = await esegui(salvaCorpo({ atteso: "2026-11-19T09:00:00.000Z" }));
  c("versione vista vecchia → 409 «conflitto», il testo nel database NON cambia, e la risposta porta il modello vero", [409, "conflitto", modelliEmailSeme()[4].testo, true], [sVecchio.stato, sVecchio.corpo.motivo, riga(sVecchio.db, "annullato").testo, typeof sVecchio.corpo.modello?.aggiornatoIl === "string"]);
  c("la stessa versione (stesso istante) scritta in un altro modo (`+00:00`, `.000Z`) vale uguale", 200, (await esegui(salvaCorpo({ atteso: "2026-11-20T10:00:00.000+00:00" }))).stato);
  const sporchi = [
    ["chiave sconosciuta", { chiave: "newsletter" }], ["chiave non testo", { chiave: 5 }], ["versione assente", { atteso: undefined }], ["versione non è una data", { atteso: "ieri" }],
    ["oggetto vuoto", { oggetto: "  " }], ["oggetto non testo", { oggetto: 12 }], ["oggetto con a capo", { oggetto: "Riga uno\nRiga due" }], ["oggetto di 201 segni", { oggetto: "x".repeat(201) }],
    ["testo vuoto", { testo: "" }], ["testo non testo", { testo: { a: 1 } }], ["testo di 8001 segni", { testo: "x".repeat(8001) }], ["testo con carattere di controllo", { testo: "ciao\u0000x" }],
  ];
  for (const [nome, extra] of sporchi) {
    const r = await esegui(salvaCorpo(extra));
    c(`modello_salva con ${nome} → 400 e ZERO chiamate al database`, [400, 0], [r.stato, r.db.chiamate]);
  }
  c("un oggetto di 200 segni e un testo di 8000 passano", 200, (await esegui(salvaCorpo({ oggetto: "x".repeat(200), testo: "y".repeat(8000) }))).stato);

  // ── approvare ──
  const ap = await esegui({ azione: "modello_approva", chiave: "annullato", impronta: sha(`${OGGETTO}\n${TESTO}`), chi: "Mario Inventato" }, { db: database(approvato("annullato", { approvato_da: null, approvato_il: null, approvato_hash: null })) });
  c("modello_approva → `rpc` con l'impronta del testo VISTO e il nome dato dal SERVER (mai `chi` del corpo)", [["shop_email_modello_approva"], sha(`${OGGETTO}\n${TESTO}`), "Titolare Prova"], [scrivi(ap.db), ap.db.registro.find((q) => q.op === "rpc")?.args.p_impronta, ap.db.registro.find((q) => q.op === "rpc")?.args.p_chi]);
  c("…approvato da chi ha la guardia; la risposta porta la versione NUOVA (l'approvazione la sposta); ancora spento", [200, "Titolare Prova", true, false], [ap.stato, riga(ap.db, "annullato").approvato_da, ap.corpo.modello?.approvato, riga(ap.db, "annullato").acceso]);
  c("…la nuova versione è diversa dalla vecchia (chi salva dopo deve usare questa)", true, typeof ap.corpo.modello?.aggiornatoIl === "string" && ap.corpo.modello.aggiornatoIl !== SEME_IL);
  const apVecchio = await esegui({ azione: "modello_approva", chiave: "annullato", impronta: sha("un altro testo\nche non è più questo") }, { db: database(approvato("annullato", { approvato_hash: null, approvato_da: null, approvato_il: null })) });
  c("impronta di un testo che nel frattempo è cambiato → 409, NESSUNA scrittura, il modello resta non approvato", [409, "conflitto", [], null], [apVecchio.stato, apVecchio.corpo.motivo, scrivi(apVecchio.db), riga(apVecchio.db, "annullato").approvato_hash]);
  const conSeg = database(modelliEmailSeme());
  const apSeg = await esegui({ azione: "modello_approva", chiave: "annullato", impronta: sha(`${riga(conSeg, "annullato").oggetto}\n${riga(conSeg, "annullato").testo}`) }, { db: conSeg });
  c("un testo con `{{da confermare}}` non si approva (nessun «approvato da…» su un segnaposto): 409 e nessuna scrittura", [409, "non_inviabile", "segnaposto", []], [apSeg.stato, apSeg.corpo.motivo, apSeg.corpo.perche, scrivi(apSeg.db)]);
  const sconosc = database(approvato("annullato", { testo: "Ciao {cognome}", approvato_hash: null, approvato_da: null, approvato_il: null }));
  const apSc = await esegui({ azione: "modello_approva", chiave: "annullato", impronta: sha(`${OGGETTO}\nCiao {cognome}`) }, { db: sconosc });
  c("…né un testo con una variabile che il messaggio non ha ({cognome}): rifiutato, nessuna scrittura", [409, "variabile_sconosciuta", []], [apSc.stato, apSc.corpo.perche, scrivi(apSc.db)]);
  for (const [nome, corpo] of [["chiave sconosciuta", { chiave: "x", impronta: sha("a") }], ["impronta non esadecimale", { chiave: "annullato", impronta: "abc" }], ["impronta assente", { chiave: "annullato" }]]) {
    const r = await esegui({ azione: "modello_approva", ...corpo });
    c(`modello_approva con ${nome} → 400, zero chiamate`, [400, 0], [r.stato, r.db.chiamate]);
  }

  // ── accendere: passa da `messaggioInviabile`, nessuna scrittura se non si può ──
  const accendi = (chiave = "annullato", acceso = true) => ({ azione: "modello_acceso", chiave, acceso });
  const nonAppr = await esegui(accendi(), { db: database(approvato("annullato", { approvato_hash: null, approvato_da: null, approvato_il: null })) });
  c("accendere un testo NON approvato → 409 con la frase, e NESSUNA scrittura (neanche la chiamata `rpc`)", [409, "non_inviabile", "non_approvato", [], false], [nonAppr.stato, nonAppr.corpo.motivo, nonAppr.corpo.perche, scrivi(nonAppr.db), riga(nonAppr.db, "annullato").acceso]);
  c("…la frase dice di approvarlo", true, /approv/i.test(nonAppr.corpo.frase ?? ""));
  const camb = await esegui(accendi(), { db: database(approvato("annullato", { testo: `${TESTO} (modificato dopo)` })) });
  c("accendere un testo approvato ma poi cambiato → «non_approvato», nessuna scrittura", ["non_approvato", []], [camb.corpo.perche, scrivi(camb.db)]);
  const segn = modelliEmailSeme().map((m) => (m.chiave === "annullato" ? { ...m, approvato_hash: sha(`${m.oggetto}\n${m.testo}`), approvato_da: "Titolare Prova", approvato_il: SEME_IL } : m));
  const sg = await esegui(accendi(), { db: database(segn) });
  c("accendere un testo approvato ma con `{{da confermare}}` → «segnaposto», nessuna scrittura", [409, "segnaposto", [], false], [sg.stato, sg.corpo.perche, scrivi(sg.db), riga(sg.db, "annullato").acceso]);
  c("…la frase parla del segnaposto", true, /segnaposto|\{\{/i.test(sg.corpo.frase ?? ""));
  const vs = await esegui(accendi(), { db: database(approvato("annullato", { testo: "Ciao {nome}, {cognome}", approvato_hash: sha(`${OGGETTO}\nCiao {nome}, {cognome}`) })) });
  c("approvato ma con una variabile che il messaggio non ha ({cognome}) → «variabile_sconosciuta», nessuna scrittura", ["variabile_sconosciuta", []], [vs.corpo.perche, scrivi(vs.db)]);
  const graffa = await esegui(accendi(), { db: database(approvato("annullato", { testo: "Ciao {nome", approvato_hash: sha(`${OGGETTO}\nCiao {nome`) })) });
  c("una graffa rimasta sola ({nome) → bloccato prima di accendere (il database non la vedrebbe)", ["variabile_sconosciuta", []], [graffa.corpo.perche, scrivi(graffa.db)]);
  const prezzi = await esegui(accendi("spedito"), { db: database(approvato("spedito", { testo: "Spedito: {totale}", approvato_hash: sha(`${OGGETTO}\nSpedito: {totale}`) })) });
  c("il prezzo `{totale}` in «spedito» (solo la conferma lo ha) → bloccato", ["variabile_sconosciuta", []], [prezzi.corpo.perche, scrivi(prezzi.db)]);
  const ok = await esegui(accendi(), { db: database(approvato("annullato")) });
  c("accendere un testo approvato e senza segnaposto → una `rpc`, acceso, risposta col modello `inviabile`", [200, ["shop_email_modello_acceso"], true, true, "Titolare Prova"], [ok.stato, scrivi(ok.db), riga(ok.db, "annullato").acceso, ok.corpo.modello?.inviabile?.ok, ok.db.registro.find((q) => q.op === "rpc")?.args.p_chi]);
  c("…lo storico lo scrive il database (riga `email`/`acceso`), non il server", [1, 0], [ok.db.tabelle.shop_storico.filter((x) => x.entita === "email" && x.campo === "acceso").length, ok.db.registro.filter((q) => q.tab === "shop_storico" && q.op !== "select").length]);
  const spegni = await esegui(accendi("annullato", false), { db: database(approvato("annullato", { acceso: true })) });
  c("spegnere si può SEMPRE: una `rpc`, spento", [200, false], [spegni.stato, riga(spegni.db, "annullato").acceso]);
  const spegniSeg = await esegui(accendi("annullato", false), { db: database(modelliEmailSeme().map((m) => ({ ...m, acceso: true }))) });
  c("…anche un testo non approvato e con segnaposto (chiudere non dipende dalle condizioni)", [200, false], [spegniSeg.stato, riga(spegniSeg.db, "annullato").acceso]);
  c("già nello stato chiesto → 200, «cambiato: false»", [200, false], await esegui(accendi("annullato", true), { db: database(approvato("annullato", { acceso: true })) }).then((r) => [r.stato, r.corpo.cambiato]));
  const rete = await esegui(accendi(), { db: database(approvato("annullato"), { errori: { "rpc.shop_email_modello_acceso": { error: { code: "55000", message: "modello_non_approvato PROVA" } } } }) });
  c("seconda rete: se il DATABASE rifiuta (55000 non approvato) la risposta è lo stesso 409 «non_inviabile», non un 500", [409, "non_inviabile"], [rete.stato, rete.corpo.motivo]);
  const rete2 = await esegui(accendi(), { db: database(approvato("annullato"), { errori: { "rpc.shop_email_modello_acceso": { error: { code: "23514", message: "modello_con_segnaposto PROVA" } } } }) });
  c("…e 23514 (segnaposto) idem", [409, "non_inviabile", "segnaposto"], [rete2.stato, rete2.corpo.motivo, rete2.corpo.perche]);
  for (const [nome, corpo] of [["acceso non booleano", { chiave: "annullato", acceso: "si" }], ["chiave sconosciuta", { chiave: "boh", acceso: true }], ["acceso assente", { chiave: "annullato" }]]) {
    const r = await esegui({ azione: "modello_acceso", ...corpo });
    c(`modello_acceso con ${nome} → 400, zero chiamate`, [400, 0], [r.stato, r.db.chiamate]);
  }

  // ── l'anteprima: un giudizio sul testo che si sta scrivendo, senza database ──
  const an = (corpo) => esegui({ azione: "anteprima", chiave: "annullato", oggetto: OGGETTO, testo: TESTO, ...corpo });
  const a1 = await an({});
  c("anteprima di un testo giusto → contenuto ok, nessuna chiamata al database", [200, true, 0], [a1.stato, a1.corpo.contenuto?.ok, a1.db.chiamate]);
  const a2 = await an({ testo: "{{da confermare}} Ciao" });
  c("…con `{{` → «segnaposto: non si può accendere» (con la frase), nessuna chiamata", [false, "segnaposto", true, 0], [a2.corpo.contenuto?.ok, a2.corpo.contenuto?.motivo, /\{\{|segnaposto/i.test(a2.corpo.contenuto?.frase ?? ""), a2.db.chiamate]);
  const a3 = await an({ testo: "Ciao {nome" });
  c("…con una graffa sola ({nome) → «variabile_sconosciuta»", "variabile_sconosciuta", a3.corpo.contenuto?.motivo);
  const a4 = await an({ chiave: "spedito", testo: "Totale {totale}" });
  c("…con una variabile di un altro messaggio ({totale} in «spedito») → «variabile_sconosciuta»", "variabile_sconosciuta", a4.corpo.contenuto?.motivo);
  c("…testo vuoto → «vuoto» (mentre si scrive non è un errore del server)", [200, "vuoto"], await an({ testo: "" }).then((r) => [r.stato, r.corpo.contenuto?.motivo]));
  c("…le variabili usate nel testo e quelle ammesse dal messaggio", [["ref", "nome", "link_ordine"].sort(), [...T.VARIABILI_PER_CHIAVE.annullato]], [[...(a1.corpo.variabili?.usate ?? [])].sort(), a1.corpo.variabili?.ammesse]);
  for (const [nome, extra] of [["chiave sconosciuta", { chiave: "x" }], ["testo non testo", { testo: 4 }], ["testo di 8001 segni", { testo: "x".repeat(8001) }]]) {
    const r = await an(extra);
    c(`anteprima con ${nome} → 400`, 400, r.stato);
  }

  // ── nessuna azione fuori elenco, nessuna scrittura diretta, nel log solo codici ──
  const fuori = await esegui({ azione: "cancella_tutto", chiave: "annullato" });
  c("azione sconosciuta → 400, nessuna chiamata", [400, "azione_sconosciuta", 0], [fuori.stato, fuori.corpo.motivo, fuori.db.chiamate]);
  const proto = await esegui({ azione: "constructor", chiave: "annullato" });
  c("`constructor` o `__proto__` come azione → 400", [400, 0], [proto.stato, proto.db.chiamate]);
  const tutte = [s, ap, ok, spegni, nonAppr, sg];
  c("in tutte le prove di scrittura: solo `rpc` delle tre funzioni di S6, nessun `.insert/.update/.upsert` su nessuna tabella", [], tutte.flatMap((r) => r.db.registro).filter((q) => q.op !== "select" && !(q.op === "rpc" && ["shop_email_modello_salva", "shop_email_modello_approva", "shop_email_modello_acceso"].includes(q.nome))).map((q) => `${q.tab}.${q.op}`));
  const g1 = await esegui("modelli", { get: true, db: database(modelliEmailSeme(), { errori: { "shop_email_modelli.select": { error: { code: "57P01", message: "PROVA cliente0@example.com Anna" } } } }) });
  const g2 = await esegui(salvaCorpo(), { db: database(modelliEmailSeme(), { errori: { "rpc.shop_email_modello_salva": { lancia: new Error("PROVA cliente0@example.com Anna") } } }) });
  const g3 = await esegui(accendi(), { db: database(approvato("annullato"), { errori: { "rpc.shop_email_modello_acceso": { error: { code: "57P01", message: "PROVA cliente0@example.com" } } } }) });
  c("guasto del database → 500 generico, senza testi dell'errore, mai un'eccezione", [500, 500, 500, false], [g1.stato, g2.stato, g3.stato, /PROVA|cliente0|Anna/.test(JSON.stringify([g1.corpo, g2.corpo, g3.corpo]))]);
  const log = [...g1.log, ...g2.log, ...g3.log];
  c("…e nel log solo codici", [true, []], [log.length > 0, log.filter((x) => !/^[a-z_]+( [A-Za-z0-9_]{1,30})?$/.test(x) || /PROVA|cliente0|Anna|@/.test(x))]);

  // ── i sorgenti ──
  const sorgente = readFileSync(join(radice, "src/crm/negozio/email.server.ts"), "utf8");
  const senza = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  c("email.server.ts: nessuna scrittura diretta (`.insert(`, `.update(`, `.upsert(`, `.delete(`), nessun `process.env`, nessun `console.`", [], [/\.insert\(|\.update\(|\.upsert\(|\.delete\(/, /process\.env|import\.meta\.env/, /console\./].filter((re) => re.test(senza)).map(String));
  c("…usa `messaggioInviabile` (la regola di T49, una sola) e non la riscrive", true, /messaggioInviabile/.test(senza) && !/includes\(["']\{\{["']\)/.test(senza));
  c("…nessuna chiave, nessun indirizzo, nessun «Scipioni»", [], [/\b(?:(?:sk|rk)_(?:test|live)|whsec|re)_[A-Za-z0-9]{16,}/, /Scipioni/i, /[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.(?:it|com|org|net|eu)\b/].filter((re) => re.test(senza)).map(String));
}
