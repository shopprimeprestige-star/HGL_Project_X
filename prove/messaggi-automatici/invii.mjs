/** ── PROVE: CONFERMA E FATTURA (l'«acceso» effettivo) ──
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T5. Per la conferma della consulenza
 *  e per i dati-fattura l'interruttore sta nel REGISTRO dei messaggi automatici: `leggiConfig`
 *  dà l'«acceso» del registro e tiene il resto del vecchio JSON (`avvio`, `attivoDal`).
 *  Quello che c'è qui:
 *   - la fusione «registro + vecchio JSON» (`configConAcceso`): l'«acceso» del JSON non vale mai;
 *   - la conferma: da spenta il giro esce PRIMA di leggere le schede e di chiamare Meta; un
 *     `spento` arrivato comunque dalla porta è `riprova` (segno tolto, tentativo non consumato),
 *     mai `incerto`/errore; riacceso, il messaggio parte UNA volta; `avvio` e `attivoDal`
 *     passano intatti dal giro (nota N2 del revisore);
 *   - i sorgenti (letti come testo): ogni messaggio dichiara la sua chiave, le due rotte vecchie
 *     rifiutano `acceso` e tengono permessi e guardia.
 *  La parte «dati fattura» del giro è in `prove/dati-fattura.mjs` (ha già il suo database finto).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`.
 *  Dati inventati: nessun nome, numero o link di un cliente. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveInviiMessaggi(mod, { c, gruppo, radice }) {
  const P = mod["promemoria/pronto"];
  const G = mod["promemoria/giro"];
  const CAT = mod["messaggi-automatici/catalogo"];
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  //  Il codice senza commenti, per non farsi ingannare da una frase che nomina la cosa.
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /* ── LA FUSIONE: L'«ACCESO» È QUELLO DEL REGISTRO ─────────────────────── */
  gruppo("CONFERMA E FATTURA · L'«ACCESO» DEL REGISTRO VINCE SEMPRE");
  const vecchio = { acceso: true, avvio: "fatto", attivoDal: "2026-10-20T08:00:00.000Z" };
  c("registro spento, vecchio JSON acceso: spento; avvio e attivoDal restano", { acceso: false, avvio: "fatto", attivoDal: "2026-10-20T08:00:00.000Z" }, P.configConAcceso(vecchio, false));
  c("registro acceso, vecchio JSON spento: acceso", true, P.configConAcceso({ acceso: false, avvio: "da_fare" }, true).acceso);
  c("senza il vecchio JSON (riga mancante o storta): solo l'«acceso» del registro", [{ acceso: true }, { acceso: false }], [P.configConAcceso(null, true), P.configConAcceso(undefined, false)]);
  c("un «acceso» storto nel vecchio JSON (stringa) non conta", [false, true], [P.configConAcceso({ acceso: "true" }, false).acceso, P.configConAcceso({ acceso: "false" }, true).acceso]);
  c("il vecchio oggetto non si modifica", { acceso: true, avvio: "fatto", attivoDal: "2026-10-20T08:00:00.000Z" }, (P.configConAcceso(vecchio, false), vecchio));

  /* ── IL GIRO DELLA CONFERMA, CON PORTE FINTE ──────────────────────────── */
  const roma = (g, hm) => new Date(Date.parse(`${g}T${hm}:00Z`) - 2 * 3600_000);
  const ADESSO = roma("2026-10-22", "15:00");
  const LINK = "https://example.invalid/meetly/prova?chi=p1";
  const vecchiaScheda = new Date(ADESSO.getTime() - 3600_000).toISOString();
  const scheda = (id, d = {}) => ({ id, updated_at: vecchiaScheda, data: { nome: "Prova", telefono: "339 1234567", stato: "appuntamento_fissato", dataMeeting: "2026-10-23", oraMeeting: "10:00", ...d } });
  /** Come le due funzioni SQL: il segno si prende una volta sola. `registro` è l'«acceso» del registro. */
  function finto(o = {}) {
    const db = new Map((o.schede ?? [scheda("s1")]).map((s) => [s.id, JSON.parse(JSON.stringify(s))]));
    const log = [];
    let stato = o.stato ?? null;
    let json = o.json ?? { acceso: true, avvio: "fatto" };
    const registro = { acceso: o.registro ?? true };
    const scritture = [];
    const porte = {
      adesso: () => o.adesso ?? ADESSO,
      //  Come in `hooks/promemoria-whatsapp.ts`: il registro vince, il resto del JSON com'è.
      leggiConfig: async () => { log.push("config?"); return P.configConAcceso(json, registro.acceso); },
      scriviConfig: async (x) => { log.push("config!"); scritture.push(x); json = x; },
      leggiStato: async () => stato,
      scriviStato: async (x) => { stato = x; },
      provaMigrazione: async () => true,
      impostazioni: async () => [{ userId: "u1", haChiavi: true, haWaba: true, haAppSecret: true, mode: "live" }],
      schede: async () => { log.push("schede"); return [...db.values()].map((s) => ({ ...JSON.parse(JSON.stringify(s)), link: LINK })); },
      numeriStop: async () => [],
      aggancia: async (id, chiave, pezzo) => {
        log.push(`aggancia:${id}`);
        const s = db.get(id); const p = s.data.promemoria ?? {};
        if ((p.chiave ?? "") === chiave && (p.stato ?? "") !== "") return false;
        s.data.promemoria = { ...p, ...pezzo, chiave }; return true;
      },
      aggiorna: async (id, pezzo, seChiave) => {
        log.push(`aggiorna:${id}:${pezzo.stato ?? "-"}`);
        const s = db.get(id); const p = s.data.promemoria ?? {};
        if (seChiave != null && p.chiave !== seChiave) return false;
        s.data.promemoria = { ...p, ...pezzo }; return true;
      },
      controllaModello: async () => { log.push("modello"); return { trovato: true, stato: "APPROVED" }; },
      invia: async (imp, numero) => {
        log.push(`invia:${numero}`);
        //  `rispondi` = cosa dice la porta (come `RispostaInvio.manychat`), in ordine.
        if (o.rispondi?.length) return { manychat: o.rispondi.shift() };
        return { status: 200, corpo: { messages: [{ id: `wamid.${log.length}` }] } };
      },
      registraInvio: async () => { log.push("registra"); },
    };
    return { porte, db, log, registro, scritture, get stato() { return stato; }, get json() { return json; } };
  }
  const segno = (f, id = "s1") => f.db.get(id).data.promemoria ?? null;
  const invii = (f) => f.log.filter((x) => x.startsWith("invia")).length;

  gruppo("CONFERMA · REGISTRO SPENTO: IL GIRO NON FA NIENTE");
  let f = finto({ registro: false });
  let r = await G.giroPromemoria(f.porte, { prova: false });
  c("spenta: nessuna scheda letta, nessun segno, nessuna chiamata a Meta, nessun invio", [0, 0, 0, 0], [f.log.filter((x) => x === "schede").length, f.log.filter((x) => /^aggancia|^aggiorna/.test(x)).length, f.log.filter((x) => x === "modello").length, invii(f)]);
  c("…il motivo è «spento» e il giro non si ferma per un guasto", ["spento", false], [f.stato.blocco, !!f.stato.riprovaDopo]);
  c("…l'«acceso» del vecchio JSON (rimasto vero) non conta, e nel JSON non si scrive niente", [0], [f.scritture.length]);
  f = finto({ registro: false, json: { acceso: true, avvio: "da_fare", attivoDal: "2026-10-20T08:00:00.000Z" } });
  await G.giroPromemoria(f.porte, { prova: false });
  c("…nemmeno l'avvio si consuma da spenta: resta «da_fare»", "da_fare", f.json.avvio);

  gruppo("CONFERMA · «SPENTO» DALLA PORTA È «RIPROVA», MAI UN GUASTO");
  c("esito della porta «spento» → riprova (non incerto, non rifiuto)", { tipo: "riprova" }, P.esitoInvio({ manychat: "spento" }));
  c("gli altri esiti della porta restano com'erano", ["ok", "riprova", "riprova", "rifiuto", "incerto"], [P.esitoInvio({ manychat: "ok", waId: "mc:1" }).tipo, P.esitoInvio({ manychat: "gia_preso" }).tipo, P.esitoInvio({ manychat: "riprova_fra_poco" }).tipo, P.esitoInvio({ manychat: "stop" }).tipo, P.esitoInvio({ manychat: "esito_che_non_conosco" }).tipo]);
  //  Un «spento» che arriva comunque (registro girato in mezzo al giro): segno tolto, tentativo non consumato.
  f = finto({ rispondi: ["spento"] });
  r = await G.giroPromemoria(f.porte, { prova: false });
  c("un «spento» a giro già partito: segno tolto, nessun tentativo consumato", [null, null, 0], [segno(f).chiave, segno(f).stato, segno(f).volte]);
  c("…niente «meta_incerto», nessuna pausa, nessun blocco, conteggiato fra i rimandati", [true, undefined, false, 0, 1], [f.stato.pronto, f.stato.blocco, !!f.stato.riprovaDopo, r.inviati, r.inAttesa]);
  c("…e non è registrato come inviato", false, f.log.some((x) => x === "registra" || x.startsWith("aggiorna:s1:inviato")));
  const dopo = finto({ stato: f.stato, adesso: new Date(ADESSO.getTime() + 120_000), schede: [{ id: "s1", updated_at: vecchiaScheda, data: JSON.parse(JSON.stringify(f.db.get("s1").data)) }] });
  r = await G.giroPromemoria(dopo.porte, { prova: false });
  c("riacceso: il messaggio parte UNA volta, 1 tentativo sulla scheda", [1, "inviato", 1], [r.inviati, segno(dopo).stato, segno(dopo).volte]);
  await G.giroPromemoria(dopo.porte, { prova: false });
  c("…e al giro dopo non se ne aggiunge un altro", 1, invii(dopo));

  gruppo("CONFERMA · «AVVIO» E «ATTIVODAL» SI CONSERVANO (NOTA N2)");
  f = finto({ json: { acceso: true, avvio: "da_fare", attivoDal: "2026-10-20T08:00:00.000Z" }, schede: [{ ...scheda("s1"), updated_at: ADESSO.toISOString() }] });
  r = await G.giroPromemoria(f.porte, { prova: false });
  const scritto = f.scritture.at(-1);
  c("primo giro dopo l'accensione: preesistente, nessun invio, avvio «fatto», attivoDal com'era", ["preesistente", 0, "fatto", "2026-10-20T08:00:00.000Z"], [segno(f).stato, r.inviati, scritto?.avvio, scritto?.attivoDal]);
  //  Il giro riscrive il JSON con l'«acceso» del registro: è una riga morta, e non deve MAI rientrare.
  f.registro.acceso = false;
  c("l'«acceso» che il giro ha scritto nel vecchio JSON non si rilegge: col registro spento resta spento", [true, false, "fatto", "2026-10-20T08:00:00.000Z"], [scritto?.acceso, (await f.porte.leggiConfig()).acceso, (await f.porte.leggiConfig()).avvio, (await f.porte.leggiConfig()).attivoDal]);

  /* ── I SORGENTI ───────────────────────────────────────────────────────── */
  gruppo("CONFERMA E FATTURA · SORGENTI: LA CHIAVE È DICHIARATA, L'«ACCESO» VIENE DAL REGISTRO");
  const hook = senzaCommenti(leggi("src/routes/hooks/promemoria-whatsapp.ts"));
  const fatt = senzaCommenti(leggi("src/crm/fatture/dati-fattura.server.ts"));
  const giroFatt = senzaCommenti(leggi("src/crm/fatture/dati-fattura-giro.ts"));
  const chiavi = (t) => [...t.matchAll(/messaggio:\s*"([^"]+)"/g)].map((x) => x[1]);
  c("la conferma dichiara «conferma_consulenza» e i dati fattura «dati_fattura»", [["conferma_consulenza"], ["dati_fattura"]], [chiavi(hook), chiavi(fatt)]);
  c("…e sono chiavi del catalogo", [true, true], [CAT.eChiaveMessaggio("conferma_consulenza"), CAT.eChiaveMessaggio("dati_fattura")]);
  c("la conferma legge l'«acceso» dal registro con `messaggioAcceso` e la sua chiave (fail-closed: provato in registro.mjs), nessuna SELECT per conto suo", [true, true, true, false], [/messaggioAcceso\("conferma_consulenza"\)/.test(hook), /registro\.server"/.test(hook), /configConAcceso\(/.test(hook), /from\("messaggi_automatici"\)/.test(hook)]);
  c("i dati fattura leggono l'«acceso» dal registro con `messaggioAcceso` e la sua chiave (fail-closed: provato in registro.mjs), nessuna SELECT per conto suo", [true, true, true, false], [/messaggioAcceso\("dati_fattura"\)/.test(fatt), /registro\.server"/.test(fatt), /configConAcceso\(/.test(fatt), /from\("messaggi_automatici"\)/.test(fatt)]);
  c("nessuno dei due legge più `acceso` dal vecchio JSON", [false, false], [/acceso:\s*c\.acceso/.test(fatt), /\bc\.acceso\b/.test(fatt)]);
  c("l'esito della porta passa dalle traduzioni provate (niente più `default → errore` scritto a mano)", [true, false], [/esitoRichiestaDaPorta\(/.test(fatt), /case "gia_preso":/.test(fatt)]);
  c("l'avvio dei dati fattura parte da tutto ciò che non è «fatto»", [true, false], [/config\.avvio !== "fatto"/.test(giroFatt), /config\.avvio === "da_fare"/.test(giroFatt)]);

  gruppo("CONFERMA E FATTURA · LE ROTTE VECCHIE RIFIUTANO L'INTERRUTTORE");
  const cConf = senzaCommenti(leggi("src/routes/api.crm.promemoria-whatsapp.ts"));
  const cFatt = senzaCommenti(leggi("src/routes/api.crm.dati-fattura.ts"));
  c("conferma: ogni richiesta resta dietro la guardia col permesso «impostazioni»", (cConf.match(/(GET|POST): async/g) || []).length, (cConf.match(/await guardiaCRM\(request, cors, "impostazioni"\);\s*if \(!g\.ok\) return g\.risposta;/g) || []).length);
  c("conferma: senza titolare dei dati ancora 403 (GET e POST)", 2, (cConf.match(/if \(!g\.chi\.adminUserId\) return json\(\{ ok: false, error: "titolare" \}, 403\);/g) || []).length);
  c("conferma: il campo «acceso» è rifiutato (400) PRIMA di ogni altra cosa, e la rotta non scrive più il JSON", [true, true, false, false], [/b\.acceso !== undefined/.test(cConf), cConf.indexOf("b.acceso !== undefined") < cConf.indexOf("prova === true"), /scriviConfig\(/.test(cConf), /attivoDal|avvio/.test(cConf)]);
  c("conferma: resta «Controlla ora» (prova a secco)", true, /giroPromemoria\(porte, \{ prova: true \}\)/.test(cConf));
  c("dati fattura: il permesso «impostazioni» sul POST e su GET, «pagamenti» sulle foto, come prima", [2, 1], [(cFatt.match(/guardiaCRM\(request, cors, "impostazioni"\)/g) || []).length, (cFatt.match(/guardiaCRM\(request, cors, "pagamenti"\)/g) || []).length]);
  c("dati fattura: «acceso» rifiutato (400), niente più accensione né avvio scritti qui", [true, false], [/b\.acceso !== undefined/.test(cFatt), /dopo\.acceso|avvio/.test(cFatt)]);
  c("dati fattura: «modelloApprovato» si salva ancora", true, /dopo\.modelloApprovato = b\.modelloApprovato/.test(cFatt));
  c("le due rotte dicono dove si accende adesso", [true, true], [/Messaggi automatici/.test(cConf), /Messaggi automatici/.test(cFatt)]);
}
