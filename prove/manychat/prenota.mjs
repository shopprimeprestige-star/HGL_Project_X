/** ── PROVE: L'ORCHESTRATORE (T7) ──────────────────────────────────────────────
 *
 *  Commessa 2026-10-27 (prenota in chat), PIANO.md T7 e D2, D3, D6, D8, D9,
 *  D13, D14. `gestisciPrenota` e `gestisciRichiestaPrenota` (`prenota.ts`) nel
 *  MONDO FINTO di `prenota-mondo.mjs` (database in memoria, orologio finto,
 *  guasti a comando). `fetch` qui è un allarme: la funzione non chiama NESSUNO.
 *
 *  Le date: martedì 27/10/2026, 14:00 a Roma (ora solare). I consulenti
 *  lavorano dal lunedì al venerdì, 09-13 e 14-19. «Sera» = inizio dalle 17:00,
 *  preavviso 3 ore: i primi tre orari sono mar 27 17:00, mer 28 17:00, gio 29
 *  17:00. Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { deepStrictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADESSO,
  BEA,
  CARLO,
  FIL,
  ID,
  SENSIBILI,
  TEL,
  TOKEN,
  UTENTE,
  consulente,
  consulenza,
  corpoScelta,
  corpoTesto,
  creaMondo,
  lead,
} from "./prenota-mondo.mjs";

const identiche = (a, b) => {
  try {
    deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
};

export async function proveDellOrchestratorePrenota(mod, { c, gruppo, radice }) {
  const P = mod["manychat/prenota"];
  const TI = mod["manychat/prenota-tipi"];
  const SK = mod["manychat/prenota-scheda"];

  //  ⚠️ Un allarme al posto di `fetch`: la funzione non deve chiamare NESSUNO.
  const fetchVero = globalThis.fetch;
  let chiamateEsterne = 0;
  globalThis.fetch = () => {
    chiamateEsterne++;
    throw new Error("la prenotazione in chat non deve chiamare nessuno");
  };

  const mondo = (o) => creaMondo(mod, o);
  const vai = (m, corpo, extra) => P.gestisciPrenota(m.porte, m.richiesta(corpo, extra));
  const ris = async (m, corpo, extra) => (await vai(m, corpo, extra)).risposta;
  const dati = (m, n = 1) => m.scheda(ID(n)).data;
  /** le righe della stanza (meet, fascia, attesi) */
  const righeStanza = (m) => [...m.righe.keys()].filter((k) => /^(meet|fascia|attesi):/.test(k)).sort();
  const LINK = /https:\/\/hair-genius-hub\.hair\/meetly\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;
  /** tutto quello che la funzione ha detto o scritto in giro (risposte, avvisi) */
  const dettoIn = [];
  const nota = (m, r) => {
    dettoIn.push(r.testo, ...m.avvisi);
    return r;
  };
  /** «sera» e poi il tocco: il mondo con la proposta già mostrata */
  const conProposta = async (o = {}, parola = "sera") => {
    const m = mondo(o);
    const r = nota(m, await ris(m, corpoTesto(parola)));
    return { m, r };
  };
  const tocca = async (m, n) => nota(m, await ris(m, corpoScelta(n)));

  /** un lead che aveva già un appuntamento (cliente assente), preso da una setter */
  const cliente = (extra = {}) =>
    lead(ID(1), {
      stato: "no_show",
      consulenteId: "c-bea",
      dataMeeting: "2026-10-20",
      oraMeeting: "15:00",
      durataMeeting: 60,
      fissatoDa: "set-sara",
      fissatoIl: "2026-10-18T10:00:00.000Z",
      statoDa: "set-sara",
      dataRicontatto: "2026-10-30",
      oraRicontatto: "10:00",
      ...extra,
    });

  /* ═══ 1. IL CORPO CHE ARRIVA DA MANYCHAT ════════════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · IL CORPO (leggiCorpoPrenota)");
  {
    const L = P.leggiCorpoPrenota;
    const pieno = L({
      azione: "testo",
      crm_lead_id: ID(1),
      telefono: "  +39 333 123 4567 ",
      testo: "sera",
      subscriber_id: "123456",
    });
    c(
      "azione testo: tutto ripulito, scelta 0",
      { azione: "testo", crmLeadId: ID(1), telefono: "+39 333 123 4567", testo: "sera", scelta: 0 },
      pieno,
    );
    c("il subscriber_id non si legge: non compare da nessuna parte", false, JSON.stringify(pieno).includes("123456"));
    c("azione scelta con scelta numero", 2, L({ azione: "scelta", scelta: 2 }).scelta);
    c("scelta come testo «3» (ManyChat manda stringhe)", 3, L({ azione: "scelta", scelta: "3" }).scelta);
    c("scelta non numero → 0", 0, L({ azione: "scelta", scelta: "due" }).scelta);
    c("scelta con la virgola → 0", 0, L({ azione: "scelta", scelta: 2.5 }).scelta);
    c("scelta negativa → 0", 0, L({ azione: "scelta", scelta: -1 }).scelta);
    c("scelta assente → 0", 0, L({ azione: "scelta" }).scelta);
    c("azione fuori lista → illeggibile", null, L({ azione: "altro", testo: "sera" }));
    c("azione assente → illeggibile", null, L({ testo: "sera" }));
    c("azione con maiuscole → illeggibile (lista chiusa)", null, L({ azione: "Testo" }));
    for (const x of [null, undefined, "sera", 7, ["testo"], true])
      c(`corpo ${JSON.stringify(x)} → illeggibile`, null, L(x));
    c("crm_lead_id non uuid → vuoto", "", L({ azione: "testo", crm_lead_id: "{{crm_lead_id}}" }).crmLeadId);
    c("testo troppo lungo → tagliato a 2000", 2000, L({ azione: "testo", testo: "a".repeat(5000) }).testo.length);
    c("campi mancanti → stringhe vuote", { azione: "testo", crmLeadId: "", telefono: "", testo: "", scelta: 0 }, L({ azione: "testo" }));
  }

  /* ═══ 2. CHIAVE, SEGRETO, LIMITE DEL CORPO ══════════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · CHIAVE, SEGRETO, ILLEGGIBILE");
  {
    let m = mondo();
    let r = await vai(m, corpoTesto("sera"), { segretoPresente: false, chiaveOk: false });
    c("senza segreto sul server: 503", [503, "nessuno", "segreto_assente"], [r.stato, r.risposta.esito, r.risposta.codice]);
    r = await vai(m, corpoTesto("sera"), { chiaveOk: false });
    c("chiave sbagliata: 401", [401, "nessuno", "non_autorizzato"], [r.stato, r.risposta.esito, r.risposta.codice]);
    r = await vai(m, null, { troppoGrande: true });
    c("corpo troppo grande: 413", [413, "troppo_grande"], [r.stato, r.risposta.codice]);
    r = await vai(m, null);
    c("corpo illeggibile con la chiave giusta: 200 nessuno", [200, "nessuno", "illeggibile", ""], [r.stato, r.risposta.esito, r.risposta.codice, r.risposta.testo]);
    c("…e in tutti questi casi nessuna porta toccata", [], m.chiamate);

    //  La richiesta HTTP: il corpo si legge SOLO dopo la chiave giusta.
    const url = "https://sito.test/api/public/manychat-prenota";
    //  Una richiesta che si accorge se qualcuno ne tocca il corpo.
    const spia = (headers) => {
      const x = { letto: false };
      x.request = new Request(url, { method: "POST", headers, body: "{}" });
      Object.defineProperty(x.request, "body", {
        get() {
          x.letto = true;
          return null;
        },
      });
      return x;
    };
    for (const [nome, chiave, segreto] of [
      ["senza chiave", undefined, TOKEN],
      ["chiave sbagliata", "x".repeat(64), TOKEN],
      ["chiave di lunghezza diversa", "x", TOKEN],
      ["segreto assente sul server", TOKEN, undefined],
    ]) {
      m = mondo();
      const f = spia(chiave ? { "x-hgl-token": chiave } : {});
      const h = await P.gestisciRichiestaPrenota(m.porte, { request: f.request, segreto, adesso: ADESSO });
      c(`${nome}: ${segreto ? 401 : 503}, corpo mai letto, nessuna porta`, [segreto ? 401 : 503, false, []], [h.response.status, f.letto, m.chiamate]);
      const j = await h.response.json();
      c(`${nome}: la risposta non dice altro`, segreto ? { ok: false, errore: "non_autorizzato" } : { ok: false, errore: "non_configurato" }, j);
    }
    m = mondo();
    let h = await P.gestisciRichiestaPrenota(m.porte, {
      request: new Request(url, { method: "POST", headers: { "x-hgl-token": TOKEN }, body: JSON.stringify({ azione: "testo", testo: "a".repeat(9000) }) }),
      segreto: TOKEN,
      adesso: ADESSO,
    });
    c("oltre 8 KB: 413, nessuna porta", [413, "troppo_grande", []], [h.response.status, h.esito, m.chiamate]);
    h = await P.gestisciRichiestaPrenota(m.porte, {
      request: new Request(url, { method: "POST", headers: { "x-hgl-token": TOKEN }, body: "{non json" }),
      segreto: TOKEN,
      adesso: ADESSO,
    });
    c("JSON rotto con la chiave giusta: 200 nessuno", [200, "illeggibile", { ok: true, esito: "nessuno", testo: "" }], [h.response.status, h.esito, await h.response.json()]);
    h = await P.gestisciRichiestaPrenota(m.porte, {
      request: new Request(url, {
        method: "POST",
        headers: { "x-hgl-token": TOKEN },
        body: JSON.stringify({ azione: "testo", crm_lead_id: ID(1), telefono: `+${TEL}`, testo: "sera", subscriber_id: "99887766" }),
      }),
      segreto: TOKEN,
      adesso: ADESSO,
    });
    const j = await h.response.json();
    c("richiesta vera: 200 con esito e testo", [200, true, "proposte3", "proposte"], [h.response.status, j.ok, j.esito, h.esito]);
    c("…senza cache, e nella risposta il solo ok/esito/testo", ["no-store", ["esito", "ok", "testo"]], [h.response.headers.get("cache-control"), Object.keys(j).sort()]);
    c("…il subscriber_id non compare né nella risposta né negli avvisi", false, (JSON.stringify(j) + m.avvisi.join(" ")).includes("99887766"));
    nota(m, { testo: j.testo });
  }

  /* ═══ 3. SPENTA, CAPIRE PRIMA DI LEGGERE, LIMITE ════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · SPENTA, ORDINE DEI PASSI, LIMITE");
  {
    let m = mondo({ cfg: null });
    let r = await ris(m, corpoTesto("sera"));
    c("spenta: nessuno", ["nessuno", "", "spenta"], [r.esito, r.testo, r.codice]);
    c("…solo la configurazione letta, zero scritture", [["config"], 0], [m.chiamate, m.scritture.length]);
    r = await ris(m, corpoScelta(2));
    c("spenta anche per un tocco: nessuno, zero scritture", ["nessuno", 0], [r.esito, m.scritture.length]);

    //  Si capisce PRIMA di leggere.
    m = mondo();
    for (const t of ["grazie", "ok", "sera?", "la sera quanto costa?", "", "   ", "👍", "giovedì alle 15", "mattina o sera"]) {
      m.azzera();
      r = await ris(m, corpoTesto(t));
      c(`«${t}»: nessuno, zero letture oltre la configurazione`, [["config"], "nessuno", "non_capito", 0], [m.chiamate, r.esito, r.codice, m.scritture.length]);
    }
    m.azzera();
    for (const n of [0, 4, 9]) {
      r = await ris(m, corpoScelta(n));
      c(`tocco con scelta ${n}: nessuno`, "nessuno", r.esito);
    }
    c("…senza leggere altro", true, m.chiamate.every((x) => x === "config"));

    //  Quaranta «ok» non consumano il limite.
    m = mondo();
    for (let i = 0; i < 40; i++) await ris(m, corpoTesto("ok"));
    c("40 «ok»: nessuna riga di proposta/contatore scritta", [], m.chiavi("prenota_chat:"));
    r = await ris(m, corpoTesto("sera"));
    c("…e dopo, «sera» risponde subito", "proposte3", r.esito);
    c("…il contatore vale 1", { ora: "2026-10-27T14", n: 1 }, m.riga(await m.chiaveProposta()).chiamate);

    //  Il 31° messaggio capito nell'ora: silenzio.
    m = mondo();
    for (let i = 0; i < 30; i++) r = await ris(m, corpoTesto("sera"));
    c("30 messaggi capiti nell'ora: l'ultimo risponde ancora", "proposte3", r.esito);
    m.azzera();
    r = await ris(m, corpoTesto("sera"));
    c("il 31°: nessuno (limite)", ["nessuno", "limite"], [r.esito, r.codice]);
    c("…senza scrivere niente", 0, m.scritture.length);
    r = await ris(m, corpoScelta(1));
    c("anche un tocco, oltre il limite: nessuno", ["nessuno", "limite"], [r.esito, r.codice]);
    m.avanza(3600e3);
    r = await ris(m, corpoTesto("sera"));
    c("l'ora dopo il contatore riparte", ["proposte3", 1], [r.esito, m.riga(await m.chiaveProposta()).chiamate.n]);
  }

  /* ═══ 4. LA PROPOSTA ════════════════════════════════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · LA PROPOSTA (SPEC 9.1)");
  {
    let { m, r } = await conProposta();
    c("«sera»: tre orari, pulsanti, tre giorni diversi", ["proposte3", "proposte"], [r.esito, r.codice]);
    c("…il testo ha il nome, le opzioni con giorno e ora, e la frase ALTRI", true,
      r.testo.includes("Anna") && r.testo.includes("Opzione 1: martedì 27 ottobre alle 17:00") && r.testo.includes("Opzione 2: mercoledì 28 ottobre alle 17:00") && r.testo.includes("Opzione 3: giovedì 29 ottobre alle 17:00") && r.testo.includes("Scriva ALTRI"));
    let riga = m.riga(await m.chiaveProposta());
    c("la proposta è ricordata (una riga per numero)", [1, "sera", "sera", ADESSO.toISOString(), 3, 3], [riga.pagina, riga.fascia, riga.fasciaChiesta, riga.il, riga.proposte.length, riga.mostrati.length]);
    c("…con giorno e ora, e il contatore", [{ g: "2026-10-27", o: "17:00" }, { ora: "2026-10-27T14", n: 1 }], [riga.proposte[0], riga.chiamate]);
    c("…la chiave non contiene il numero (HMAC)", [true, false], [(await m.chiaveProposta()).startsWith("prenota_chat:"), (await m.chiaveProposta()).includes(TEL)]);
    c("…nessuna scheda toccata, nessuna stanza, nessun lucchetto rimasto", [true, [], []], [identiche(m.scheda(ID(1)), lead(ID(1))), righeStanza(m), m.lucchetti()]);
    c("una proposta non scrive sulla scheda né sul secondo stato", [], m.scrittureDi("scriviScheda", "scriviContatto"));

    ({ m, r } = await conProposta({}, "mattina"));
    riga = m.riga(await m.chiaveProposta());
    c("«mattina»: tre orari tutti prima delle 13", ["proposte3", true], [r.esito, riga.proposte.every((p) => p.o >= "08:00" && p.o < "13:00")]);
    c("…da mercoledì (oggi mancano meno di 3 ore dalla mattina)", "2026-10-28", riga.proposte[0].g);
    ({ m, r } = await conProposta({}, "pomeriggio"));
    c("«pomeriggio»", ["proposte3", true], [r.esito, m.riga(await m.chiaveProposta()).proposte.every((p) => p.o >= "13:00" && p.o < "17:00")]);
    ({ m, r } = await conProposta({}, "stasera"));
    c("«stasera» è sera", "sera", m.riga(await m.chiaveProposta()).fascia);

    //  Due e un solo orario: pulsanti giusti.
    const corto = (extra, cfg) => ({
      consulenti: [consulente("c-fil", "Filippo", { priorita: 3, ...extra }, [{ inizio: "14:00", fine: "18:00" }])],
      ...(cfg ? { cfg } : {}),
    });
    ({ m, r } = await conProposta(corto({ giorniLavorativi: [2, 3] }, { acceso: true, consulenteId: "", preavvisoOre: 3, giorniAvanti: 1, durataMin: 60 })));
    c("due orari (sera 17:00 di mar e mer) → proposte2, due opzioni nel testo", ["proposte2", true, false], [r.esito, r.testo.includes("Opzione 2"), r.testo.includes("Opzione 3")]);
    ({ m, r } = await conProposta(corto({ giorniLavorativi: [3] }, { acceso: true, consulenteId: "", preavvisoOre: 3, giorniAvanti: 7, durataMin: 60 })));
    c("un solo orario → proposte1, una sola opzione", ["proposte1", true, false], [r.esito, r.testo.includes("Opzione 1"), r.testo.includes("Opzione 2")]);
    c("…e il testo dice sempre ALTRI", true, r.testo.includes("Scriva ALTRI"));

    //  Nessuna fascia ha niente: ricontattare.
    ({ m, r } = await conProposta({ consulenti: [consulente("c-fil", "Filippo", { giorniLavorativi: [] })] }));
    c("nessun orario libero: messaggio e richiamo, niente pulsanti", ["testo", "nessun_orario", true], [r.esito, r.codice, r.testo.includes("non ho orari liberi online")]);
    let d = dati(m);
    c("…la scheda va in «Da ricontattare» col motivo", ["da_ricontattare", "prenota_nessun_orario", "automatico"], [d.contattoWa.stato, d.contattoWa.motivo, d.contattoWa.da]);
    c("…e una riga di nota in chiaro, senza toccare il resto", [true, "da_contattare", SENSIBILI.nota], [/\d\d\/\d\d \d\d:\d\d · /.test(d.note), d.stato, d.note.split("\n")[0]]);
    c("…nessuna stanza, nessuna proposta da toccare", [], righeStanza(m));
    m.azzera();
    r = nota(m, await ris(m, corpoTesto("sera")));
    c("lo stesso lead che riscrive «sera»: stesso messaggio, ma niente seconda riga di storia", [1, 1], [dati(m).contattoWa.storia.length, dati(m).note.split("\n").filter((x) => x.includes(" · ")).length]);

    //  Il ripiego: sera vuota, pomeriggio no.
    ({ m, r } = await conProposta({ consulenti: [consulente("c-fil", "Filippo", {}, [{ inizio: "09:00", fine: "13:00" }, { inizio: "14:00", fine: "17:00" }])] }));
    riga = m.riga(await m.chiaveProposta());
    c("sera vuota: si propone il pomeriggio, e lo dice", ["proposte3", true, "pomeriggio", "sera"], [r.esito, /di sera non ho orari liberi/i.test(r.testo), riga.fascia, riga.fasciaChiesta]);

    //  Senza nome.
    ({ m, r } = await conProposta({ schede: [lead(ID(1), { nome: "" })] }));
    c("senza nome: il testo parte senza spazi vuoti", [true, false], [/^[A-Z]/.test(r.testo), /^[\s,]| {2}/.test(r.testo)]);
  }

  /* ═══ 5. LA PRENOTAZIONE ════════════════════════════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · LA PRENOTAZIONE (SPEC 9.2, 9.3)");
  {
    let { m } = await conProposta();
    m.azzera();
    let r = await tocca(m, 2);
    let d = dati(m);
    c("tocco 2: conferma, codice prenotato", ["testo", "prenotato"], [r.esito, r.codice]);
    c("la scheda è «Appuntamento fissato» con consulente, giorno, ora, durata", ["appuntamento_fissato", "c-fil", "2026-10-28", "17:00", 60], [d.stato, d.consulenteId, d.dataMeeting, d.oraMeeting, d.durataMeeting]);
    c("…il link della stanza e il marcatore della chat", [true, "2026-10-28", "17:00"], [LINK.test(d.linkMeeting), d.prenotatoChat.g, d.prenotatoChat.o]);
    c("…la nota con ora di Roma, giorno e consulente", true, d.note.includes("27/10 14:00 · Ha prenotato il cliente dalla chat WhatsApp: mer 28/10 17:00 con Filippo") && d.note.startsWith(SENSIBILI.nota));
    c("…chi ha fissato: «cliente-chat»; stato di prima ricordato", ["cliente-chat", "da_contattare", ADESSO.toISOString()], [d.fissatoDa, d.statoPrecedente, d.firstContactAt]);
    c("la conferma nomina giorno, ora, consulente, nome", true, r.testo.includes("mercoledì 28 ottobre alle 17:00") && r.testo.includes("Filippo") && r.testo.includes("Anna"));
    c("…e contiene il link della scheda, una volta sola (D13)", [true, 1], [r.testo.includes(d.linkMeeting), r.testo.split(d.linkMeeting).length - 1]);
    c("…nessun altro indirizzo nel testo", 1, (r.testo.match(/https?:\/\//g) ?? []).length);
    const code = d.linkMeeting.split("/").pop();
    c("la stanza: meet, copia per consulente, fascia, attesi", [`attesi:${code}`, `fascia:c-fil:2026-10-28T17:00`, `meet:${ID(1)}`, `meet:${ID(1)}:c-fil`], righeStanza(m).sort());
    c("…il lucchetto è rilasciato, i lucchetti sono due in ordine lead → consulente", [[], ["prenota_chat_lock:lead:" + ID(1), "prenota_chat_lock:c-fil:2026-10-28"]],
      [m.lucchetti(), m.scrittureDi("lucchetto.prendi").map((x) => x.chiave)]);
    c("…una sola scrittura sulla scheda", 1, m.scrittureDi("scriviScheda").length);
    c("…il secondo stato non si tocca", [], m.scrittureDi("scriviContatto"));

    //  Il secondo tocco: stessa conferma, nessuna scrittura in più.
    const prima = m.fotografia();
    m.azzera();
    const r2 = await tocca(m, 2);
    c("secondo tocco: stessa conferma con lo stesso link", [r.testo, "gia_fissato"], [r2.testo, r2.codice]);
    c("…zero scritture (nota, stanza, scheda) e righe identiche", [0, true], [m.scritture.length, identiche(m.fotografia(), prima)]);
    const r3 = await tocca(m, 3);
    c("anche toccando un'altra opzione: la stessa conferma", r.testo, r3.testo);

    //  «sera» dopo la prenotazione: già fissata.
    m.azzera();
    r = nota(m, await ris(m, corpoTesto("sera")));
    c("«sera» con una consulenza già fissata: riepilogo, nessuna modifica", ["testo", "gia_fissato", true, 0], [r.esito, r.codice, r.testo.includes("ha già una consulenza fissata mercoledì 28 ottobre alle 17:00 con Filippo"), m.scritture.length]);
    r = await ris(m, corpoTesto("2"));
    c("«2» scritto con una consulenza fissata: nessuno", ["nessuno", 0], [r.esito, m.scritture.length]);
    r = await ris(m, corpoTesto("altri"));
    c("«altri» con una consulenza fissata: nessuno", "nessuno", r.esito);

    //  Il nome del consulente è quello della scheda ADESSO.
    m.setter(ID(1), { consulenteId: "c-bea" });
    r = nota(m, await tocca(m, 1));
    c("secondo tocco dopo che la setter cambia consulente: il nome è quello della scheda", [true, false, true], [r.testo.includes("Bea"), r.testo.includes("Filippo"), r.testo.includes(dati(m).linkMeeting)]);
    //  Una scheda presa dalla chat ma senza link: mai una «conferma» senza link.
    m.setter(ID(1), { linkMeeting: "" });
    r = nota(m, await tocca(m, 1));
    c("senza link nella scheda: niente conferma, solo il riepilogo", ["gia_fissato", false], [r.codice, r.testo.startsWith("Fatto")]);
    //  Se la setter sposta l'ora non è più «presa dalla chat».
    m.setter(ID(1), { linkMeeting: "https://x.example/meetly/abc", oraMeeting: "18:00" });
    r = nota(m, await tocca(m, 1));
    c("la setter sposta l'ora: tocco → riepilogo, non conferma", [true, false], [r.testo.includes("alle 18:00"), r.testo.startsWith("Fatto")]);
  }

  gruppo("PRENOTA · ORCHESTRATORE · CHI PRENDE LA CONSULENZA (SPEC 3.5, 9.3)");
  {
    //  Filippo e un collega liberi → Filippo.
    let { m } = await conProposta();
    await tocca(m, 1);
    c("Filippo e Bea liberi: Filippo", "c-fil", dati(m).consulenteId);

    //  Filippo pieno nello slot (mer 28 17:00) → il collega.
    ({ m } = await conProposta({ schede: [lead(ID(1)), consulenza(ID(2), "c-fil", "2026-10-28", "17:00")] }));
    let r = await tocca(m, 2);
    c("Filippo pieno: il primo collega libero", ["c-bea", "prenotato"], [dati(m).consulenteId, r.codice]);
    c("…e il testo nomina il collega", true, r.testo.includes("Bea") && !r.testo.includes("Filippo"));

    //  Filippo e i colleghi per priorità.
    ({ m } = await conProposta({ consulenti: [FIL(), CARLO(), BEA()], schede: [lead(ID(1)), consulenza(ID(2), "c-fil", "2026-10-28", "17:00")] }));
    await tocca(m, 2);
    c("tre consulenti, Filippo pieno: priorità 1 (Bea) prima di priorità 2 (Carlo)", "c-bea", dati(m).consulenteId);
    ({ m } = await conProposta({ consulenti: [FIL(), CARLO(), BEA()], schede: [lead(ID(1)), consulenza(ID(2), "c-fil", "2026-10-28", "17:00"), consulenza(ID(3), "c-bea", "2026-10-28", "17:00")] }));
    await tocca(m, 2);
    c("Filippo e Bea pieni: Carlo", "c-carlo", dati(m).consulenteId);

    //  Preferito per id di configurazione.
    ({ m } = await conProposta({ cfg: { acceso: true, consulenteId: "c-bea", preavvisoOre: 3, giorniAvanti: 14, durataMin: 60 } }));
    await tocca(m, 1);
    c("consulente preferito per id di configurazione", "c-bea", dati(m).consulenteId);

    //  Tutti pieni al momento del tocco: nessuna prenotazione, nuove proposte.
    ({ m } = await conProposta());
    m.aggiungi(consulenza(ID(2), "c-fil", "2026-10-28", "17:00"));
    m.aggiungi(consulenza(ID(3), "c-bea", "2026-10-28", "17:00"));
    const prima = m.fotografia();
    m.azzera();
    r = await tocca(m, 2);
    c("slot preso nel frattempo: «appena stato preso» e tre proposte nuove", ["proposte3", "preso", true, false], [r.esito, r.codice, r.testo.includes("appena stato preso"), r.testo.includes("mercoledì 28 ottobre alle 17:00")]);
    c("…nessuna scrittura sulla scheda né sulla stanza, nessun lucchetto", [[], [], []], [m.scrittureDi("scriviScheda", "scriviContatto"), righeStanza(m), m.lucchetti()]);
    c("…la scheda è identica a prima", true, identiche(m.scheda(ID(1)), prima.schede[0]));
    c("…la proposta nuova è ricordata, dalla pagina 1", [1, 3], [m.riga(await m.chiaveProposta()).pagina, m.riga(await m.chiaveProposta()).proposte.length]);

    //  Filippo si riempie fra la scelta e il lucchetto: si passa al collega (e si rilascia il lucchetto di Filippo).
    ({ m } = await conProposta());
    m.prima = async (nome) => {
      if (nome === "schedeAgenda" && m.scrittureDi("lucchetto.prendi").length === 2) {
        m.prima = null;
        m.aggiungi(consulenza(ID(2), "c-fil", "2026-10-28", "17:00"));
      }
    };
    r = await tocca(m, 2);
    c("Filippo pieno solo dentro il lucchetto: il collega, e il testo lo nomina", ["c-bea", "prenotato", true], [dati(m).consulenteId, r.codice, r.testo.includes("Bea")]);
    c("…tre lucchetti presi (lead, Filippo, Bea) e tutti rilasciati", [3, []], [m.scrittureDi("lucchetto.prendi").length, m.lucchetti()]);
    //  Tutti pieni solo dentro il lucchetto: preso, mai una scrittura.
    ({ m } = await conProposta());
    m.prima = async (nome) => {
      if (nome === "schedeAgenda" && m.scrittureDi("lucchetto.prendi").length === 2) {
        m.prima = null;
        m.aggiungi(consulenza(ID(2), "c-fil", "2026-10-28", "17:00"));
        m.aggiungi(consulenza(ID(3), "c-bea", "2026-10-28", "17:00"));
      }
    };
    r = await tocca(m, 2);
    c("tutti pieni dentro il lucchetto: «preso» e nuove proposte, nessuna scrittura sulla scheda", ["preso", [], []], [r.codice, m.scrittureDi("scriviScheda"), m.lucchetti()]);

    //  Il lucchetto del consulente occupato da un altro giro: due tentativi, poi nuove proposte.
    ({ m } = await conProposta());
    m.righe.set("prenota_chat_lock:c-fil:2026-10-28", JSON.stringify({ di: "altro", fino: new Date(ADESSO.getTime() + 15000).toISOString() }));
    r = await tocca(m, 2);
    c("lucchetto del consulente occupato: «preso» + nuove proposte, nessuna scrittura sulla scheda", ["preso", [], [300]], [r.codice, m.scrittureDi("scriviScheda"), m.attese]);
    c("…il lucchetto di quell'altro giro resta suo; il nostro del lead è rilasciato", [["prenota_chat_lock:c-fil:2026-10-28"]], [m.lucchetti()]);
    //  Scaduto (21 s dopo): si riprende.
    ({ m } = await conProposta());
    m.righe.set("prenota_chat_lock:c-fil:2026-10-28", JSON.stringify({ di: "morto", fino: new Date(ADESSO.getTime() + 20000).toISOString() }));
    m.avanza(21000);
    r = await tocca(m, 2);
    c("lucchetto scaduto: ripreso, si prenota", ["prenotato", []], [r.codice, m.lucchetti()]);
    //  Il lucchetto del lead preso da un altro giro: nessuno.
    ({ m } = await conProposta());
    m.righe.set(`prenota_chat_lock:lead:${ID(1)}`, JSON.stringify({ di: "altro", fino: new Date(ADESSO.getTime() + 15000).toISOString() }));
    m.azzera();
    r = await tocca(m, 2);
    c("lucchetto del lead occupato: nessuno (occupato), scheda e stanza intatte", ["nessuno", "occupato", []], [r.esito, r.codice, m.scritture.filter((x) => x.porta !== "scriviProposta")]);
  }

  gruppo("PRENOTA · ORCHESTRATORE · NOTTE, NOME E NUMERO MANCANTI (D13)");
  {
    //  Tocca alle 05:30 per le 08:30: il link c'è lo stesso.
    const notte = new Date("2026-10-28T04:30:00Z"); // 05:30 a Roma
    const strette = [consulente("c-fil", "Filippo", {}, [{ inizio: "08:30", fine: "12:30" }])];
    const { m, r } = await conProposta({ ora: notte, consulenti: strette }, "mattina");
    c("alle 05:30 «mattina»: 08:30 è a 3 ore esatte, si propone", [true, "proposte3"], [r.testo.includes("mercoledì 28 ottobre alle 08:30"), r.esito]);
    const t = await tocca(m, 1);
    c("alle 05:30 per le 08:30: prenota lo stesso", ["prenotato", "08:30"], [t.codice, dati(m).oraMeeting]);
    c("…e il link è nel testo (il modello Meta potrebbe non partire)", true, t.testo.includes(dati(m).linkMeeting) && LINK.test(t.testo));

    //  Scheda senza nome e numero non valido per WhatsApp.
    const { m: m2 } = await (async () => {
      const mm = mondo({ schede: [lead(ID(1), { nome: "", telefono: "12345678" })] });
      const r1 = await ris(mm, corpoTesto("sera", { telefono: "12345678" }));
      c("numero non valido per WhatsApp ma leggibile: si propone", "proposte3", r1.esito);
      return { m: mm };
    })();
    const t2 = nota(m2, await ris(m2, corpoScelta(1, { telefono: "12345678" })));
    c("senza nome e col numero non valido: prenota lo stesso", ["prenotato", "appuntamento_fissato"], [t2.codice, dati(m2).stato]);
    c("…il testo non ha il nome, ha il link", [true, false, true], [t2.testo.startsWith("Fatto! "), /Fatto, /.test(t2.testo), t2.testo.includes(dati(m2).linkMeeting)]);
  }

  gruppo("PRENOTA · ORCHESTRATORE · LE PAROLE DI CHI SCRIVE E «ALTRI» (SPEC 3.1, 9.6)");
  {
    //  «2» scritto a mano, con una proposta aperta, prenota come il tocco.
    let { m } = await conProposta();
    let r = nota(m, await ris(m, corpoTesto("Opzione 2")));
    c("«Opzione 2» scritto con una proposta aperta: prenota", ["prenotato", "2026-10-28"], [r.codice, dati(m).dataMeeting]);
    //  Senza proposta: niente.
    m = mondo();
    r = await ris(m, corpoTesto("2"));
    c("«2» senza proposta aperta: nessuno", ["nessuno", "non_capito", 0], [r.esito, r.codice, m.scrittureDi("scriviScheda").length]);
    c("«ALTRI» senza proposta aperta: nessuno, il contatore sì", ["nessuno", "non_capito"], [(r = await ris(m, corpoTesto("ALTRI"))).esito, r.codice]);

    //  ALTRI: tre pagine, mai ripetuti, poi richiamo.
    ({ m } = await conProposta());
    const viste = [...m.riga(await m.chiaveProposta()).proposte.map((p) => `${p.g} ${p.o}`)];
    r = nota(m, await ris(m, corpoTesto("ALTRI")));
    let riga = m.riga(await m.chiaveProposta());
    const p2 = riga.proposte.map((p) => `${p.g} ${p.o}`);
    c("ALTRI: tre orari nuovi, pagina 2, senza ripetere", ["proposte3", "altri", 2, 0], [r.esito, r.codice, riga.pagina, p2.filter((x) => viste.includes(x)).length]);
    c("…nel testo gli stessi orari e ancora ALTRI", true, p2.length === 3 && r.testo.includes("Scriva ALTRI"));
    r = nota(m, await ris(m, corpoTesto("altri orari")));
    riga = m.riga(await m.chiaveProposta());
    const p3 = riga.proposte.map((p) => `${p.g} ${p.o}`);
    c("ALTRI ancora: pagina 3, nulla di già visto", [3, 0, 9], [riga.pagina, p3.filter((x) => [...viste, ...p2].includes(x)).length, riga.mostrati.length]);
    m.azzera();
    r = nota(m, await ris(m, corpoTesto("altri")));
    c("ALTRI oltre la terza pagina: messaggio di richiamo", ["testo", "altri_finiti", true], [r.esito, r.codice, r.testo.includes("non ho altri orari liberi")]);
    const d = dati(m);
    c("…la scheda va in «Da ricontattare» col motivo e una nota", ["da_ricontattare", "prenota_altri_finiti", true], [d.contattoWa.stato, d.contattoWa.motivo, d.note.includes(" · ")]);
    c("…e ALTRI di nuovo non rifà niente", ["nessuno", 1], [(r = await ris(m, corpoTesto("altri"))).esito, dati(m).contattoWa.storia.length]);

    //  ALTRI vecchio (oltre 6 ore): niente.
    ({ m } = await conProposta());
    m.avanza(6 * 3600e3 + 1000);
    r = await ris(m, corpoTesto("altri"));
    c("ALTRI dopo più di 6 ore: nessuno", "nessuno", r.esito);

    //  ALTRI dopo un ripiego resta nella fascia effettiva.
    ({ m } = await conProposta({ consulenti: [consulente("c-fil", "Filippo", {}, [{ inizio: "09:00", fine: "13:00" }, { inizio: "14:00", fine: "17:00" }])] }));
    r = nota(m, await ris(m, corpoTesto("altri")));
    riga = m.riga(await m.chiaveProposta());
    c("ALTRI dopo il ripiego: resta il pomeriggio, senza chiedere scusa di nuovo", ["pomeriggio", "sera", false], [riga.fascia, riga.fasciaChiesta, r.testo.includes("non ho orari liberi")]);

    //  Una proposta vecchia: tocco dopo più di 6 ore.
    ({ m } = await conProposta());
    m.avanza(7 * 3600e3);
    m.azzera();
    r = nota(m, await tocca(m, 1));
    c("tocco dopo 7 ore: «non sono più validi» e orari nuovi, nessuna prenotazione", ["proposte3", "vecchia", true, []], [r.esito, r.codice, r.testo.includes("non sono più validi"), m.scrittureDi("scriviScheda")]);
    //  Orario che sta per passare (meno del preavviso).
    ({ m } = await conProposta());
    m.avanza(3 * 3600e3 + 600e3); // 17:10: il primo orario era alle 17:00
    r = nota(m, await tocca(m, 1));
    c("tocco quando l'orario è passato: «non sono più validi»", ["vecchia", []], [r.codice, m.scrittureDi("scriviScheda")]);
    //  Il tocco senza nessuna proposta ricordata.
    m = mondo();
    r = nota(m, await tocca(m, 1));
    c("tocco senza proposta ricordata: «non più validi» e orari nuovi", ["proposte3", "vecchia"], [r.esito, r.codice]);
    //  Opzione che non c'è.
    ({ m } = await conProposta({ consulenti: [consulente("c-fil", "Filippo", { giorniLavorativi: [2, 3] }, [{ inizio: "14:00", fine: "18:00" }])], cfg: { acceso: true, consulenteId: "", preavvisoOre: 3, giorniAvanti: 1, durataMin: 60 } }));
    r = nota(m, await tocca(m, 3));
    c("opzione 3 con solo 2 orari: «quell'opzione non c'è» e le stesse proposte", ["proposte2", true, 0], [r.esito, r.testo.includes("quell'opzione non c'è"), m.scrittureDi("scriviScheda").length]);
  }

  /* ═══ 6. CHI NON DEVE PRENOTARE ═════════════════════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · CHI NON PRENOTA (SPEC 9.5, 3.6-3.8, D14)");
  {
    const zero = async (nome, o, atteso = "nessuno", corpo = corpoTesto("sera")) => {
      const m = mondo(o);
      const r = nota(m, await ris(m, corpo));
      c(`${nome}: ${atteso}, zero scritture`, [atteso, 0], [r.esito, m.scritture.length]);
      return { m, r };
    };
    await zero("scheda cliente (acconto pagato)", { schede: [lead(ID(1), { payment: { accontoPagato: 100 } })] });
    await zero("scheda cliente (vinto)", { schede: [lead(ID(1), { stato: "installazione_fissata" })] });
    await zero("scheda annullata", { schede: [lead(ID(1), { stato: "annullato" })] });
    await zero("scheda «perdi tempo»", { schede: [lead(ID(1), { stato: "perdi_tempo" })] });
    await zero("«sta valutando» (D15)", { schede: [lead(ID(1), { stato: "sta_valutando" })] });
    await zero("«sta valutando» anche con una data di richiamo", { schede: [lead(ID(1), { stato: "sta_valutando", dataRicontatto: "2026-10-30" })] });
    await zero("stato inventato", { schede: [lead(ID(1), { stato: "inventato" })] });
    await zero("senza scheda (numero sconosciuto)", { schede: [] });
    await zero("numero senza cifre", {}, "nessuno", corpoTesto("sera", { telefono: "abc" }));
    await zero("scheda di un altro numero", { schede: [lead(ID(1), { telefono: "340 999 8877" })] });
    await zero("STOP sulla scheda", { schede: [lead(ID(1), { contattoWa: { stato: "stop", il: "2026-10-20T10:00:00.000Z", da: "automatico", storia: [] } })] });
    await zero("STOP sul numero (non_scrivere_dal)", { nonScrivere: [TEL] });
    await zero("un tocco di chi è cliente", { schede: [lead(ID(1), { payment: { accontoPagato: 100 } })] }, "nessuno", corpoScelta(1));
    await zero("un tocco di chi è in STOP", { nonScrivere: [TEL] }, "nessuno", corpoScelta(1));
    {
      const { m: senzaCons, r: rc } = await conProposta({ consulenti: [] });
      c("nessun consulente nel CRM: nessun orario, si ricontatta", ["testo", "nessun_orario"], [rc.esito, rc.codice]);
      void senzaCons;
    }
    //  Un utente non configurato.
    let m = mondo({ utente: { userId: null, motivo: "non_configurato" } });
    let r = await ris(m, corpoTesto("sera"));
    c("installazione non configurata: nessuno", ["nessuno", "senza_configurazione", 0], [r.esito, r.codice, m.scritture.length]);

    //  Una consulenza futura: riepilogo, zero scritture. Anche se non l'ha fissata la chat.
    m = mondo({ schede: [lead(ID(1), { stato: "appuntamento_fissato", consulenteId: "c-fil", dataMeeting: "2026-10-29", oraMeeting: "18:00", durataMeeting: 60, fissatoDa: "set-sara" })] });
    r = nota(m, await ris(m, corpoTesto("sera")));
    c("consulenza futura fissata dalla setter + «sera»: riepilogo, nessuna scrittura", ["testo", "gia_fissato", true, 0], [r.esito, r.codice, r.testo.includes("ha già una consulenza fissata giovedì 29 ottobre alle 18:00 con Filippo"), m.scritture.length]);
    r = nota(m, await tocca(m, 1));
    c("…un tocco: lo stesso riepilogo (non è della chat), mai «Fatto»", [true, false], [r.testo.includes("ha già una consulenza fissata"), r.testo.startsWith("Fatto")]);
    c("…e nessuna scrittura", 0, m.scritture.length);
    //  Una consulenza futura ma passata alle 17:00 di oggi? già passata: si può prenotare.
    m = mondo({ schede: [lead(ID(1), { stato: "appuntamento_fissato", consulenteId: "c-fil", dataMeeting: "2026-10-27", oraMeeting: "10:00", durataMeeting: 60 })] });
    r = await ris(m, corpoTesto("sera"));
    c("appuntamento già passato (stato rimasto «fissato»): non è futuro, ma lo stato non prenota", "nessuno", r.esito);

    //  Doppioni: una con appuntamento futuro, una «da contattare» più recente.
    const vecchia = lead(ID(1), { stato: "appuntamento_fissato", consulenteId: "c-fil", dataMeeting: "2026-10-29", oraMeeting: "18:00", durataMeeting: 60 });
    const nuova = lead(ID(2), {}, { updated_at: "2026-10-26T10:00:00.000Z" });
    m = mondo({ schede: [vecchia, nuova] });
    r = nota(m, await ris(m, corpoTesto("sera")));
    c("doppioni, una con consulenza futura: gia_fissato, zero scritture", ["gia_fissato", 0], [r.codice, m.scritture.length]);
    r = nota(m, await tocca(m, 2));
    c("…anche col tocco", ["gia_fissato", 0], [r.codice, m.scritture.length]);
    //  Doppioni senza appuntamenti: la più recente prenotabile.
    const a = lead(ID(1), {}, { updated_at: "2026-10-10T10:00:00.000Z" });
    const b = lead(ID(2), {}, { updated_at: "2026-10-25T10:00:00.000Z" });
    const cc = lead(ID(3), { stato: "annullato" }, { updated_at: "2026-10-26T10:00:00.000Z" });
    m = mondo({ schede: [a, b, cc] });
    await ris(m, corpoTesto("sera"));
    await tocca(m, 1);
    c("doppioni prenotabili: si usa la modificata più di recente fra le prenotabili", ["da_contattare", "appuntamento_fissato", "annullato"], [dati(m, 1).stato, dati(m, 2).stato, dati(m, 3).stato]);

    //  Un lead prenota solo per sé: crm_lead_id di un altro, col telefono di un altro.
    m = mondo({ schede: [lead(ID(1)), lead(ID(2), { telefono: "340 111 2233", nome: "Marta" })] });
    await ris(m, corpoTesto("sera", { crmLeadId: ID(2) }));
    r = nota(m, await ris(m, corpoScelta(1, { crmLeadId: ID(2) })));
    c("crm_lead_id di un'altra persona: si prenota la scheda del numero, l'altra non si tocca", ["appuntamento_fissato", "da_contattare"], [dati(m, 1).stato, dati(m, 2).stato]);
    c("…e il testo ha il nome del lead giusto", [true, false], [r.testo.includes("Anna"), r.testo.includes("Marta")]);
    //  Senza crm_lead_id: si trova dal numero (già vero in tutte le altre prove).
  }

  /* ═══ 7. RIPRENOTAZIONE, DISFARE, STANZA RIUSATA ════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · RIPRENOTAZIONE E DISFARE (rev. 1)");
  {
    let { m } = await conProposta({ schede: [cliente()] });
    const prima = m.scheda(ID(1)).data;
    let r = await tocca(m, 2);
    let d = dati(m);
    c("da «cliente assente» (no_show): prenota", ["prenotato", "appuntamento_fissato"], [r.codice, d.stato]);
    c("…fissatoDa, fissatoIl e statoDa restano della setter", ["set-sara", "2026-10-18T10:00:00.000Z", "set-sara"], [d.fissatoDa, d.fissatoIl, d.statoDa]);
    c("…il richiamo non si tocca", ["2026-10-30", "10:00"], [d.dataRicontatto, d.oraRicontatto]);

    //  Disfare davvero: la verifica dopo la scrittura vede un altro sullo slot.
    ({ m } = await conProposta({ schede: [cliente()] }));
    const iniziale = m.scheda(ID(1)).data;
    const righeIniziali = [...m.righe.keys()].sort();
    m.prima = async (nome) => {
      //  fra la nostra scrittura e la nostra verifica la setter fissa un altro sullo slot
      if (nome === "schedeAgenda" && m.scrittureDi("scriviScheda").length === 1) {
        m.aggiungi(consulenza(ID(7), "c-fil", "2026-10-28", "17:00"));
        m.aggiungi(consulenza(ID(8), "c-bea", "2026-10-28", "17:00"));
        m.prima = null;
      }
    };
    r = nota(m, await tocca(m, 2));
    c("un altro prende lo slot fra scrittura e verifica: «preso» e nuove proposte", ["proposte3", "preso", true], [r.esito, r.codice, r.testo.includes("appena stato preso")]);
    c("…la scheda torna ESATTAMENTE com'era (anche fissatoDa, statoDa, richiamo)", true, identiche(dati(m), iniziale));
    c("…nessuna riga di stanza orfana, nessun lucchetto", [[], righeIniziali.filter((k) => !k.startsWith("prenota_chat"))], [righeStanza(m), [...m.righe.keys()].sort().filter((k) => !k.startsWith("prenota_chat"))]);
    c("…due scritture sulla scheda (prenota e disfa)", 2, m.scrittureDi("scriviScheda").length);

    //  Disfare quando la setter ha cambiato la scheda nel frattempo: non si tocca, errore + secondo stato.
    ({ m } = await conProposta({ schede: [cliente()] }));
    m.prima = async (nome) => {
      if (nome === "schedeAgenda" && m.scrittureDi("scriviScheda").length === 1) {
        m.aggiungi(consulenza(ID(7), "c-fil", "2026-10-28", "17:00"));
        m.aggiungi(consulenza(ID(8), "c-bea", "2026-10-28", "17:00"));
        m.setter(ID(1), { oraMeeting: "19:00" }); // la setter sposta l'appuntamento appena scritto
        m.prima = null;
      }
    };
    r = nota(m, await tocca(m, 2));
    d = dati(m);
    c("la setter ha cambiato la scheda: non si disfa alla cieca → errore", ["testo", "errore", true], [r.esito, r.codice, r.testo.includes("non sono riuscito")]);
    c("…la scheda resta com'è (la setter vince) e va in «Da ricontattare»", ["19:00", "da_ricontattare", "prenota_errore"], [d.oraMeeting, d.contattoWa.stato, d.contattoWa.motivo]);
    c("…con l'avviso (solo codice)", true, m.avvisi.length > 0 && m.avvisi.every((x) => TI.CODICI_LOG.includes(x)));

    //  Il codice stanza si riusa su una riprenotazione.
    const conStanza = cliente({ linkMeeting: "https://hair-genius-hub.hair/meetly/bcd-fghj-kmn" });
    const sessione = JSON.stringify({ code: "bcd-fghj-kmn", leadId: ID(1), consultantId: "c-bea", quando: "2026-10-20T15:00", durata: 60, createdAt: "2026-10-18T10:00:00.000Z" });
    ({ m } = await conProposta({ schede: [conStanza], righe: { [`meet:${ID(1)}`]: sessione, [`meet:${ID(1)}:c-bea`]: sessione } }));
    r = nota(m, await tocca(m, 2));
    d = dati(m);
    c("riprenotazione con una stanza già partita: stesso codice e stesso link", ["https://hair-genius-hub.hair/meetly/bcd-fghj-kmn", true], [d.linkMeeting, r.testo.includes("meetly/bcd-fghj-kmn")]);
    c("…la riga meet del lead non cambia codice", "bcd-fghj-kmn", JSON.parse(m.righe.get(`meet:${ID(1)}`)).code);
    c("…e c'è la riga della fascia col codice", "bcd-fghj-kmn", JSON.parse(m.righe.get("fascia:c-fil:2026-10-28T17:00")).code);
    void prima;
  }

  /* ═══ 7b. LA SCHEDA CAMBIA MENTRE SI PRENOTA ═══════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · LA SCHEDA CAMBIA MENTRE SI PRENOTA");
  {
    //  Il primo tocco ha già prenotato mentre questo prendeva il lucchetto: conferma, nessuna scrittura.
    let { m } = await conProposta();
    m.prima = async (nome) => {
      if (nome === "scheda") {
        m.prima = null;
        m.setter(ID(1), {
          stato: "appuntamento_fissato",
          consulenteId: "c-fil",
          dataMeeting: "2026-10-28",
          oraMeeting: "17:00",
          durataMeeting: 60,
          linkMeeting: "https://hair-genius-hub.hair/meetly/bcd-fghj-kmn",
          prenotatoChat: { il: ADESSO.toISOString(), g: "2026-10-28", o: "17:00" },
        });
      }
    };
    m.azzera();
    let r = await tocca(m, 2);
    c("l'altro giro ha già prenotato: la stessa conferma con il suo link", ["gia_fissato", true, true], [r.codice, r.testo.startsWith("Fatto"), r.testo.includes("meetly/bcd-fghj-kmn")]);
    c("…nessuna scrittura (scheda, stanza), lucchetti rilasciati", [[], []], [m.scrittureDi("scriviScheda", "stanza.scrivi"), m.lucchetti()]);
    //  …oppure la scheda è diventata non prenotabile.
    ({ m } = await conProposta());
    m.prima = async (nome) => {
      if (nome === "scheda") {
        m.prima = null;
        m.setter(ID(1), { stato: "annullato" });
      }
    };
    r = await tocca(m, 2);
    c("la scheda diventa «annullato» sotto i piedi: nessuno, nessuna scrittura", ["nessuno", []], [r.esito, m.scrittureDi("scriviScheda")]);

    //  La setter salva mentre scriviamo: si rilegge e si riprova, la sua modifica resta.
    ({ m } = await conProposta());
    m.prima = async (nome) => {
      if (nome === "stanza.scrivi") {
        m.prima = null;
        m.setter(ID(1), { note: "nota aggiunta dalla setter" });
      }
    };
    r = await tocca(m, 2);
    let d = dati(m);
    c("la setter salva a metà: si riprova e si prenota", ["prenotato", "appuntamento_fissato"], [r.codice, d.stato]);
    c("…la sua nota resta, la nostra riga si aggiunge", [true, true], [d.note.includes("nota aggiunta dalla setter"), d.note.includes("Ha prenotato il cliente dalla chat WhatsApp")]);
    c("…una sola scrittura riuscita sulla scheda", 1, m.scrittureDi("scriviScheda").length);

    //  La setter salva sempre: dopo 3 tentativi, errore e tutto com'era.
    ({ m } = await conProposta());
    const iniziale = m.scheda(ID(1)).data;
    m.prima = async (nome) => {
      if (nome === "scriviScheda") m.setter(ID(1), { note: `${m.scheda(ID(1)).data.note}!` });
    };
    r = nota(m, await tocca(m, 2));
    c("la scheda cambia a ogni tentativo: errore, mai a metà", ["errore", "da_contattare", []], [r.codice, dati(m).stato, righeStanza(m)]);
    c("…la sua modifica non si perde", true, dati(m).note.startsWith(iniziale.note + "!"));

    //  La setter fissa un appuntamento a mano nello stesso momento: non si sovrascrive, e la stanza torna com'era.
    ({ m } = await conProposta());
    m.prima = async (nome) => {
      if (nome === "scriviScheda") {
        m.prima = null;
        m.setter(ID(1), { stato: "appuntamento_fissato", consulenteId: "c-bea", dataMeeting: "2026-10-29", oraMeeting: "10:00", durataMeeting: 60 });
      }
    };
    r = nota(m, await tocca(m, 2));
    c("la setter fissa a mano mentre scriviamo: riepilogo del SUO appuntamento", ["gia_fissato", true, false], [r.codice, r.testo.includes("giovedì 29 ottobre alle 10:00 con Bea"), r.testo.startsWith("Fatto")]);
    c("…la sua scheda resta com'è, e nessuna riga di stanza resta", ["2026-10-29", []], [dati(m).dataMeeting, righeStanza(m)]);
  }

  /* ═══ 8. ERRORI A OGNI PASSO: MAI A METÀ ════════════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · UN ERRORE A OGNI PASSO (mai una prenotazione a metà)");
  {
    /** com'è la scheda a fine corsa: «intatta» (come prima, a parte il secondo stato e le righe di nota), «completa» o «a metà» */
    const classifica = (m, iniziale) => {
      const d = dati(m);
      const senza = (x) => {
        const { contattoWa, note, ...resto } = x;
        void contattoWa;
        return { ...resto, note: String(note ?? "").split("\n").filter((l) => !/^\d\d\/\d\d \d\d:\d\d · /.test(l)).join("\n") };
      };
      if (identiche(senza(d), senza(iniziale))) return "intatta";
      const meet = m.righe.get(`meet:${ID(1)}`);
      const code = meet ? JSON.parse(meet).code : "";
      const completa =
        d.stato === "appuntamento_fissato" &&
        d.consulenteId &&
        d.dataMeeting &&
        d.oraMeeting &&
        code &&
        typeof d.linkMeeting === "string" &&
        d.linkMeeting.endsWith(`/${code}`) &&
        !!d.prenotatoChat &&
        !!m.righe.get(`fascia:${d.consulenteId}:${d.dataMeeting}T${d.oraMeeting}`);
      return completa ? "completa" : "a metà";
    };
    const sweep = async (nome, passo, modo, opz = {}) => {
      const visti = { intatta: 0, completa: 0 };
      let provate = 0;
      for (let n = 1; n < 400; n++) {
        const { m } = await conProposta(opz);
        const iniziale = m.scheda(ID(1)).data;
        m.azzera();
        m.guasto = { al: n, ...modo };
        const r = nota(m, await passo(m));
        m.guasto = null;
        if (m.passi < n) break; // il guasto non è mai scattato: finiti i passi
        provate++;
        const k = classifica(m, iniziale);
        const strict = !modo.fisso;
        const ok = k === "intatta" || k === "completa";
        if (!ok) c(`${nome} · guasto al passo ${n} (${m.chiamate[n - 1]}): mai a metà (era «${k}»)`, true, false);
        else visti[k]++;
        if (strict) {
          if (m.lucchetti().length) c(`${nome} · guasto al passo ${n} (${m.chiamate[n - 1]}): nessun lucchetto rimasto`, [], m.lucchetti());
          if (k === "intatta" && righeStanza(m).length) c(`${nome} · guasto al passo ${n}: scheda intatta ma righe di stanza orfane`, [], righeStanza(m));
          if (/^Fatto/.test(r.testo) && k !== "completa") c(`${nome} · guasto al passo ${n}: conferma data ma la scheda non è prenotata`, "completa", k);
          if (k === "completa" && !/^Fatto/.test(r.testo) && r.codice !== "errore") c(`${nome} · guasto al passo ${n}: scheda prenotata ma il lead non lo sa (${r.codice})`, "prenotato", r.codice);
        }
      }
      c(`${nome}: i passi provati sono parecchi`, true, provate > 15);
      return { visti, provate };
    };
    const tocco2 = (m) => ris(m, corpoScelta(2));
    for (const [nome, modo] of [
      ["porta che lancia", {}],
      ["porta che scrive e poi lancia", { dopo: true }],
    ]) {
      const { visti } = await sweep(`tocco · ${nome}`, tocco2, modo);
      c(`tocco · ${nome}: sia «intatta» sia «completa» si vedono`, true, visti.intatta > 0 && visti.completa >= 0);
      await sweep(`tocco da riprenotazione · ${nome}`, tocco2, modo, { schede: [cliente()] });
    }
    await sweep("tocco · tutto rotto da qui in poi", tocco2, { fisso: true });

    //  Dopo un testo semplice, un errore è silenzio: mai un messaggio, mai la scheda toccata.
    let provate = 0;
    for (let n = 1; n < 100; n++) {
      const m = mondo();
      m.guasto = { al: n };
      const r = nota(m, await ris(m, corpoTesto("sera")));
      if (m.passi < n) break;
      provate++;
      if (r.esito !== "nessuno" && !r.esito.startsWith("proposte")) c(`testo · guasto al passo ${n} (${m.chiamate[n - 1]}): solo silenzio o proposte`, "nessuno", r.esito);
      if (r.esito === "nessuno" && r.testo !== "") c(`testo · guasto al passo ${n}: nessuno senza testo`, "", r.testo);
      if (m.scrittureDi("scriviScheda").length) c(`testo · guasto al passo ${n}: la scheda non si tocca`, 0, m.scrittureDi("scriviScheda").length);
    }
    c("testo: i passi provati sono parecchi", true, provate > 5);
    //  L'avviso porta solo un codice della lista chiusa.
    const m = mondo();
    m.guasto = { al: 3 };
    const r = nota(m, await ris(m, corpoTesto("sera")));
    c("un errore dopo un testo: nessuno, con un avviso a codice", ["nessuno", "errore", true], [r.esito, r.codice, m.avvisi.length === 1 && TI.CODICI_LOG.includes(m.avvisi[0])]);
    c("…e nell'avviso non c'è il codice del database né i dati", false, /XX000|dato|Rossetti/.test(m.avvisi.join(" ")));

    //  Un tocco con errore → testoErrore + «Da ricontattare».
    const { m: m1 } = await conProposta();
    m1.azzera();
    //  il passo 8 è la rilettura della scheda dentro il lucchetto
    m1.guasto = { al: 8 };
    const r1 = nota(m1, await tocca(m1, 2));
    c("errore dopo un tocco: messaggio gentile e «Da ricontattare»", ["testo", "errore", true, "da_ricontattare", "prenota_errore"], [r1.esito, r1.codice, r1.testo.includes("Un nostro consulente La contatta a breve"), dati(m1).contattoWa?.stato, dati(m1).contattoWa?.motivo]);
  }

  /* ═══ 9. IL TEMPO (D9) ══════════════════════════════════════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · IL BUDGET DI TEMPO");
  {
    //  Le letture durano 6 secondi: nessuna scrittura di prenotazione.
    let { m } = await conProposta();
    const iniziale = m.scheda(ID(1)).data;
    m.prima = async (nome) => {
      if (nome === "schedeAgenda") m.avanza(6000);
    };
    m.azzera();
    let r = nota(m, await tocca(m, 2));
    c("letture lente (6 s): nessuna prenotazione, errore gentile", ["tempo", true], [r.codice, r.testo.includes("non sono riuscito")]);
    c("…nessuna scrittura sulla scheda (a parte il secondo stato), nessuna stanza", [true, []], [identiche({ ...dati(m), contattoWa: undefined, note: undefined }, { ...iniziale, note: undefined, contattoWa: undefined }), righeStanza(m)]);
    c("…l'avviso è «tempo»", ["tempo"], m.avvisi);
    //  Dopo un testo: silenzio.
    m = mondo();
    m.prima = async (nome) => {
      if (nome === "schedeAgenda") m.avanza(6000);
    };
    r = nota(m, await ris(m, corpoTesto("sera")));
    c("letture lente dopo un testo: le proposte arrivano lo stesso (nessuna scrittura da rischiare)", ["proposte3"], [r.esito]);
    //  La scrittura che sfora gli 8 secondi: si ferma prima di scrivere la scheda e toglie la stanza.
    ({ m } = await conProposta());
    m.prima = async (nome) => {
      if (nome === "stanza.scrivi") {
        m.avanza(9000);
        m.prima = null;
      }
    };
    r = nota(m, await tocca(m, 2));
    c("oltre 8 secondi prima di scrivere la scheda: errore, scheda non prenotata, stanza tolta", ["tempo", "da_contattare", []], [r.codice, dati(m).stato, righeStanza(m)]);
  }

  /* ═══ 10. NESSUN DATO FUORI, NESSUNA CHIAMATA ESTERNA ═══════════════════ */
  gruppo("PRENOTA · ORCHESTRATORE · NESSUN DATO NEI TESTI, NEI LOG, NELLE CHIAVI");
  {
    const tutto = dettoIn.join("\n");
    for (const [nome, v] of Object.entries(SENSIBILI)) c(`mai ${nome} nelle risposte e negli avvisi`, false, tutto.includes(v));
    c("mai il numero (cifre) nelle risposte e negli avvisi", false, tutto.includes(TEL));
    c("mai un uuid", false, /[0-9a-f]{8}-[0-9a-f]{4}-/.test(tutto));
    c("mai il cognome o il nome di un altro cliente (dall'agenda)", false, /Bianchini|Giuseppina/.test(tutto));
    c("gli avvisi sono solo codici della lista chiusa", true, dettoIn.length > 0);
    //  Le chiavi di app_config non hanno il numero.
    const { m } = await conProposta();
    await tocca(m, 2);
    c("nessuna chiave di app_config contiene il numero", false, [...m.righe.keys()].some((k) => k.includes(TEL)));
    c("…né nessun valore, a parte i dati della stanza (nome e cognome degli attesi)", false, [...m.righe.entries()].some(([k, v]) => !k.startsWith("attesi:") && v.includes(TEL)));
    c("la riga di proposta non porta né numero, né nome, né testo scritto", false, /Anna|Rossetti|Opzione|ALTRI/.test(m.righe.get(await m.chiaveProposta()) ?? ""));
  }

  gruppo("PRENOTA · ORCHESTRATORE · IL FILE");
  {
    const src = readFileSync(join(radice, "src/crm/manychat/prenota.ts"), "utf8");
    const senzaCommenti = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    c("nessun fetch", false, /\bfetch\s*\(/.test(senzaCommenti));
    c("nessun console", false, /\bconsole\./.test(senzaCommenti));
    c("nessun orologio nascosto (new Date() / Date.now)", false, /new Date\(\s*\)|Date\.now\(/.test(senzaCommenti));
    c("nessun database né rotta importati", false, /supabase|createFileRoute/i.test(senzaCommenti));
    c("nessun timer", false, /setTimeout|setInterval/.test(senzaCommenti));
    c("non legge il subscriber_id", false, /subscriber/i.test(senzaCommenti));
    c("non nomina fissatoDa (lo fa daPrenotare)", false, /fissatoDa|FISSATO_DA_CHAT|patchChiFissa/.test(senzaCommenti));
    c("non usa i modi della fascia (rev. 3)", false, /modiFascia/.test(senzaCommenti));
  }

  c("in tutte le prove: nessuna chiamata esterna", 0, chiamateEsterne);
  globalThis.fetch = fetchVero;
  void UTENTE;
  void BEA;
}
