/** ── PROVE: L'INGRESSO DAL FOGLIO GOOGLE ───────────────────────────────────────────────
 *
 *  File d'area della commessa 2026-10-25 (Sheets e sequenze WhatsApp), compito S.
 *  Non serve toccare `prove/prove.mjs`, `prove/manychat.mjs` o `prove/sheets.mjs`
 *  (il collegamento c'è già). Dati inventati: nessun numero né nome vero.
 *
 *  Tre blocchi:
 *   1. `traduciRighe` / `traduciCsv` (il caso «una riga del foglio = una riga di
 *      un file Meta», e i due campi in più: `metaLeadId`, `consensoModulo`);
 *   2. la rotta (`gestisciIngresso`) con un database finto in memoria che rispetta
 *      il lucchetto per telefono, il tetto e il registro: si guarda cosa scrive,
 *      cosa NON scrive e cosa finisce in risposta e nei log;
 *   3. lo script Apps Script (`strumenti/google-sheets/ingresso-crm.gs`) eseguito
 *      in Node con un finto Google: segni, tentativi per riga, righe ordinate,
 *      `installa` che rifiuta; e il suo corpo dato in pasto alla rotta vera.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import vm from "node:vm";

/** Le chiavi in ordine fisso: due oggetti uguali danno la stessa stringa. */
const ordina = (v) =>
  Array.isArray(v)
    ? v.map(ordina)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .filter((k) => v[k] !== undefined)
            .map((k) => [k, ordina(v[k])]),
        )
      : v;
const J = (v) => JSON.stringify(ordina(v));

export async function proveIngresso(mod, { c, gruppo, radice }) {
  const IG = mod["sheets/ingresso"];
  const IMP = mod["import-backup"];
  const TEL = mod["telefono-doppio"];

  /* ── I DATI DI PROVA: un modulo Meta vero nella forma, persone inventate ──── */
  const ADESSO = new Date("2026-10-25T10:20:00Z");
  const TOKEN = "t".repeat(48);
  const FOGLIO_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
  const D1 = "come_consideri_il_tuo_problema?";
  const D2 = "conosci_hair_genius_labs_e_il_mondo_dell'infoltimento_capelli_non_chirurgico?";
  const D3 = "in_quale_zona_d'italia_ti_trovi?";
  const D4 =
    "quando_preferiresti_ricevere_una_telefonata_per_concordare_l'appuntamento_di_consulenza_gratuita_e_ottenere_maggiori_informazioni?_(indica_giorno_e_ora_indicativi)";
  const INTEST = [
    "id", "created_time", "ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name",
    "form_id", "form_name", "is_organic", "platform", D1, D2, D3, D4,
    "full_name", "email", "phone_number", "lead_status",
  ];
  const riga = (n, nome, tel, o = {}) => [
    `l:10000000000000${n}`,
    o.quando ?? "2026-10-25T09:14:03+01:00",
    "ag:120253730513900721",
    "589€ - 001 - ok",
    "as:120253730513890721",
    "BROAD | ITALIA",
    "c:120253730513880721",
    "Hair Genius Labs | 24 giugno - Copy 3",
    "f:1623446622641118",
    "Modulo senza titolo 30/11/24, 01:36-copy",
    "false",
    "fb",
    "è_importante:_sto_valutando_seriamente_di_prendere_provvedimenti_nel_breve-medio_termine.",
    "sì:_vi_seguo_da_un_po’.",
    "nord_italia",
    "mattina_(9:00–12:00)",
    nome,
    o.email ?? `${nome.split(" ")[0].toLowerCase()}@example.com`,
    tel,
    "CREATED",
  ];
  const RIGA_META = riga("11", "Mario Esempio", "p:+393330000101");
  const CINQUE = [
    RIGA_META,
    riga("12", "Luca Prova", "p:+393330000102", { quando: "2026-10-25T09:20:11+01:00" }),
    riga("13", "Anna Finta", "p:+393330000103", { email: "" }),
    riga("14", "Gian Maria Esempio", "p:+393330000104"),
    riga("15", "Rita Verdi", "p:+393330000105"),
  ];
  const csvCella = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csvDi = (intest, righe) => [intest, ...righe].map((r) => r.map(csvCella).join(",")).join("\n");

  const corpo = (valori, sopra = {}) => ({
    versione: 1,
    foglio: { id: FOGLIO_ID, nome: "Lead HGL", scheda: "Foglio1" },
    riga: 57,
    intestazioni: INTEST,
    valori,
    ...sopra,
  });
  const URL_ROTTA = "https://crm.example/api/public/sheets-ingresso";
  const richiesta = (c0, { token = TOKEN } = {}) =>
    new Request(URL_ROTTA, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { "x-hgl-token": token } : {}) },
      body: typeof c0 === "string" ? c0 : JSON.stringify(c0),
    });
  /** Un corpo che segna se qualcuno lo legge, e senza `Content-Length`. */
  const corpoSpia = (testo, spia) => {
    let dato = false;
    return new ReadableStream(
      {
        pull(ctrl) {
          spia.letto = true;
          if (dato) return ctrl.close();
          dato = true;
          ctrl.enqueue(new TextEncoder().encode(testo));
        },
      },
      { highWaterMark: 0 },
    );
  };
  const richiestaStream = (testo, spia, token = TOKEN) =>
    new Request(URL_ROTTA, {
      method: "POST",
      headers: { "x-hgl-token": token },
      body: corpoSpia(testo, spia),
      duplex: "half",
    });

  /** Il database finto: il registro, le schede con la loro «versione» (`updated_at`),
   *  il tetto del giorno e il lucchetto per telefono. Rifà in memoria i passi di
   *  `sheets_ingresso_scrivi` (S1) nello stesso ordine: già ricevuta → tetto →
   *  registro → lucchetto → id Meta → numero → crea. */
  function mondo(o = {}) {
    const m = {
      utente: o.utente === undefined ? "u-1" : o.utente,
      ingressi: new Map(),
      schede: (o.schede ?? []).map((s) => ({ v: 1, userId: "u-1", ...s })),
      guasti: { scrivi: null, scriviScheda: 0, chiudi: 0, ...(o.guasti ?? {}) },
      durante: o.durante ?? null,
      chiamate: { scrivi: 0, leggiScheda: 0, scriviScheda: 0, chiudi: 0 },
      nuoveSchede: 0,
    };
    for (let i = 0; i < (o.ingressiDiOggi ?? 0); i++)
      m.ingressi.set(`x:${i}`, { esito: "nuovo", leadId: null });
    const lucchetti = new Map();
    const conLucchetto = async (k, fn) => {
      const prima = lucchetti.get(k) ?? Promise.resolve();
      let rilascia;
      lucchetti.set(k, new Promise((r) => (rilascia = r)));
      await prima;
      try {
        return await fn();
      } finally {
        rilascia();
      }
    };
    const respiro = () => new Promise((r) => setImmediate(r));
    m.porte = {
      utente: async () => m.utente,
      scrivi: async (i) => {
        m.chiamate.scrivi++;
        if (m.guasti.scrivi) throw m.guasti.scrivi;
        const vecchia = m.ingressi.get(i.chiave);
        if (vecchia) return { esito: "gia_ricevuto", stato: vecchia.esito, leadId: vecchia.leadId };
        if (m.ingressi.size >= IG.TETTO_RIGHE_GIORNO) return { esito: "tetto" };
        const voce = { esito: "in_corso", leadId: null };
        m.ingressi.set(i.chiave, voce);
        const dentro = async () => {
          await respiro();
          if (i.metaId) {
            const gia = m.schede.find(
              (s) => s.data.metaLeadId === i.metaId || s.data.datiFile?.id === i.metaId,
            );
            if (gia) return Object.assign(voce, { esito: "gia_presente", leadId: gia.id }) && { esito: "gia_presente", leadId: gia.id };
          }
          if (i.tel9) {
            const trovata = m.schede.find((s) => TEL.chiaveTelefono(s.data.telefono) === i.tel9);
            if (trovata) {
              Object.assign(voce, { esito: "ritorno_da_segnare", leadId: trovata.id });
              return { esito: "ritorno", leadId: trovata.id };
            }
          }
          await respiro();
          const id = `nuova-${m.schede.length + 1}`;
          m.schede.push({ id, userId: i.userId, v: 1, data: JSON.parse(JSON.stringify(i.data)) });
          m.nuoveSchede++;
          Object.assign(voce, { esito: "nuovo", leadId: id });
          return { esito: "nuovo", leadId: id };
        };
        return i.tel9 ? conLucchetto(`${i.userId}|${i.tel9}`, dentro) : dentro();
      },
      leggiScheda: async (_u, id) => {
        m.chiamate.leggiScheda++;
        const s = m.schede.find((x) => x.id === id);
        if (!s) return null;
        const letta = { data: JSON.parse(JSON.stringify(s.data)), versione: String(s.v) };
        if (m.durante) {
          const f = m.durante;
          m.durante = null;
          f(s); // qualcuno scrive la scheda DOPO la nostra lettura
        }
        return letta;
      },
      scriviScheda: async (_u, id, data, versione) => {
        m.chiamate.scriviScheda++;
        if (m.guasti.scriviScheda > 0) {
          m.guasti.scriviScheda--;
          throw { code: "XX000", message: `dato 393330000101 ${JSON.stringify(data).slice(0, 20)}` };
        }
        const s = m.schede.find((x) => x.id === id);
        if (!s || String(s.v) !== versione) return false;
        s.data = JSON.parse(JSON.stringify(data));
        s.v++;
        return true;
      },
      chiudi: async ({ chiave, esito }) => {
        m.chiamate.chiudi++;
        if (m.guasti.chiudi > 0) {
          m.guasti.chiudi--;
          throw { code: "08006" };
        }
        const voce = m.ingressi.get(chiave);
        if (voce && voce.esito === "ritorno_da_segnare" && esito === "ritorno") {
          voce.esito = "ritorno";
          return true;
        }
        return false;
      },
    };
    return m;
  }
  /** Una richiesta → stato HTTP, corpo JSON ed esito per i log. */
  async function manda(m, req, segreto = TOKEN) {
    const { response, esito } = await IG.gestisciIngresso(m.porte, { request: req, segreto, adesso: ADESSO });
    let json = null;
    try {
      json = await response.clone().json();
    } catch {
      /* corpo non JSON */
    }
    return { stato: response.status, json, esito, testo: await response.text() };
  }

  /* ═════════ 1. `traduciRighe` E `traduciCsv` ═════════════════════════════════ */
  gruppo("SHEETS · traduciRighe: la riga del foglio e il file Meta");

  c("import-backup espone traduciRighe", "function", typeof IMP.traduciRighe);
  const fileCinque = csvDi(INTEST, CINQUE);
  const daFile = IMP.traduciCsv(fileCinque);
  c("traduciCsv: 5 righe Meta, 5 schede, 0 scartate", [5, 0], [daFile.leads.length, daFile.scartate]);
  c(
    "traduciCsv = divisione + traduciRighe (stesso risultato, anche i conteggi)",
    J({ ...daFile, leads: daFile.leads.map((l) => ({ ...l, listaOrigine: { dataDalFile: l.listaOrigine.dataDalFile } })) }),
    (() => {
      const r = IMP.traduciRighe(INTEST, CINQUE);
      return J({ ...r, leads: r.leads.map((l) => ({ ...l, listaOrigine: { dataDalFile: l.listaOrigine.dataDalFile } })) });
    })(),
  );
  c("traduciCsv di un testo vuoto: niente schede", { leads: [], colonneConservate: [], scartate: 0, intestazioniRiallineate: 0 }, IMP.traduciCsv(""));
  c("traduciRighe senza righe: niente schede", 0, IMP.traduciRighe(INTEST, []).leads.length);

  const l0 = daFile.leads[0];
  c("l'id del lead Meta: «l:…» dalla prima cella che lo è", "l:1000000000000011", l0.metaLeadId);
  c("…e resta anche fra i dati originali", "l:1000000000000011", l0.datiFile?.id);
  c(
    "consensoModulo da un file Meta: fatto, non permesso (via, fonte csv_meta, data del modulo)",
    { whatsapp: true, il: "2026-10-25T09:14:03+01:00", via: "modulo_meta", fonte: "csv_meta" },
    l0.consensoModulo,
  );
  const senzaMeta = IMP.traduciCsv("full_name,phone_number\nMario Esempio,3331234567").leads[0];
  c("un CSV che non è di Meta: niente consenso del modulo", undefined, senzaMeta.consensoModulo);
  c("…e niente metaLeadId", undefined, senzaMeta.metaLeadId);
  const senzaTel = IMP.traduciCsv(csvDi(INTEST, [riga("21", "Mario Esempio", "")])).leads[0];
  c("riga Meta senza telefono: niente consenso (nessun numero da scrivere)", undefined, senzaTel.consensoModulo);
  const formSenzaId = IMP.traduciCsv(
    "created_time,form_name,platform,full_name,phone_number\n2026-10-20T10:00:00Z,Modulo X,ig,Mario Esempio,3331234567",
  ).leads[0];
  c("senza id ma con modulo e piattaforma Meta: consenso (csv_meta)", "modulo_meta", formSenzaId.consensoModulo?.via);
  const formNonMeta = IMP.traduciCsv(
    "created_time,form_name,platform,full_name,phone_number\n2026-10-20T10:00:00Z,Modulo X,sito,Mario Esempio,3331234567",
  ).leads[0];
  c("modulo ma piattaforma non Meta: niente consenso", undefined, formNonMeta.consensoModulo);
  const senzaData = IMP.traduciCsv(
    "id,platform,full_name,phone_number\nl:1000000000000099,fb,Mario Esempio,3331234567",
  ).leads[0];
  c(
    "CSV Meta senza created_time: il = null (mai l'ora di caricamento): non vale",
    { whatsapp: true, il: null, via: "modulo_meta", fonte: "csv_meta" },
    senzaData.consensoModulo,
  );
  const dataIllegibile = IMP.traduciCsv(
    "id,created_time,platform,full_name,phone_number\nl:1000000000000098,ieri sera,fb,Mario Esempio,3331234567",
  ).leads[0];
  c("data del modulo illeggibile: il = null", null, dataIllegibile.consensoModulo?.il);

  // La cella con a capo, «;» e virgolette (la risposta «Altro» del modulo): una riga sola
  const ALTRO = 'Vorrei sapere:\r\nprima riga; seconda "tra virgolette", terza';
  const intestAltro = [...INTEST.slice(0, 16), "altro", ...INTEST.slice(16)];
  const rigaAltro = [...riga("31", "Mario Esempio", "p:+393330000131").slice(0, 16), ALTRO, ...riga("31", "Mario Esempio", "p:+393330000131").slice(16)];
  const tAltro = IMP.traduciRighe(intestAltro, [rigaAltro]);
  c("cella con a capo, «;» e «\"»: una scheda, nessuna scartata", [1, 0], [tAltro.leads.length, tAltro.scartate]);
  const sAltro = tAltro.leads[0];
  c(
    "…i campi restano al loro posto",
    ["Mario", "Esempio", "+393330000131", "mario@example.com"],
    [sAltro.nome, sAltro.cognome, sAltro.telefono, sAltro.email],
  );
  c(
    "…e il testo libero arriva intero (a capo, «;» e virgolette) fra i dati",
    true,
    J(sAltro).includes("prima riga; seconda") && J(sAltro).includes("virgolette"),
  );

  /* ═════════ 2. LA ROTTA ══════════════════════════════════════════════════════ */
  gruppo("SHEETS · la rotta: chiave, limiti, forma");

  // costanti
  c("TETTO_RIGHE_GIORNO è 300", 300, IG.TETTO_RIGHE_GIORNO);

  {
    const m = mondo();
    const spia = { letto: false };
    const r = await manda(m, richiestaStream(JSON.stringify(corpo(RIGA_META)), spia), "");
    c("segreto assente sul server: 503 non_configurato", [503, { ok: false, errore: "non_configurato" }], [r.stato, r.json]);
    c("…senza leggere il corpo e senza toccare il database", [false, 0, 0], [spia.letto, m.chiamate.scrivi, m.nuoveSchede]);
  }
  for (const [nome, token] of [["sbagliata", "x".repeat(48)], ["di lunghezza diversa", "t"], ["assente", null], ["vuota", ""]]) {
    const m = mondo();
    const spia = { letto: false };
    const req = token === null
      ? new Request(URL_ROTTA, { method: "POST", body: corpoSpia("{}", spia), duplex: "half" })
      : richiestaStream("{}", spia, token);
    const r = await manda(m, req);
    c(`chiave ${nome}: 401, stesso corpo per tutti`, [401, { ok: false, errore: "non_autorizzato" }, false], [r.stato, r.json, spia.letto]);
  }
  {
    const m = mondo();
    const spia = { letto: false };
    const grande = JSON.stringify(corpo(RIGA_META)) + " ".repeat(9 * 1024);
    const r = await manda(m, richiestaStream(grande, spia));
    c("9 KB senza Content-Length con la chiave giusta: 413", [413, { ok: false, errore: "troppo_grande" }], [r.stato, r.json]);
    c("…e non scrive niente", [0, 0], [m.chiamate.scrivi, m.nuoveSchede]);
  }
  {
    const m = mondo();
    const cattive = [
      ["JSON illeggibile", "{non json"],
      ["non è un oggetto", "[1,2]"],
      ["versione 2", { ...corpo(RIGA_META), versione: 2 }],
      ["foglio mancante", { ...corpo(RIGA_META), foglio: undefined }],
      ["nome del foglio oltre 100", corpo(RIGA_META, { foglio: { id: "a", nome: "x".repeat(101), scheda: "S" } })],
      ["scheda oltre 100", corpo(RIGA_META, { foglio: { id: "a", nome: "N", scheda: "x".repeat(101) } })],
      ["riga 1", corpo(RIGA_META, { riga: 1 })],
      ["riga decimale", corpo(RIGA_META, { riga: 5.5 })],
      ["valori più corti delle intestazioni", corpo(RIGA_META.slice(0, 5))],
      ["celle che non sono testo", corpo(RIGA_META.map((v, i) => (i === 3 ? 7 : v)))],
      ["61 celle", { ...corpo(Array(61).fill("a")), intestazioni: Array(61).fill("b") }],
      ["nessuna cella", { ...corpo([]), intestazioni: [] }],
      ["una cella oltre 1000 caratteri", corpo(RIGA_META.map((v, i) => (i === 3 ? "x".repeat(1001) : v)))],
    ];
    for (const [nome, cc] of cattive) {
      const r = await manda(m, richiesta(cc));
      c(`forma sbagliata (${nome}): 400`, [400, { ok: false, errore: "forma" }], [r.stato, r.json]);
    }
    c("…nessuna scrittura per nessuna di queste", [0, 0], [m.chiamate.scrivi, m.nuoveSchede]);
    c("leggiRichiesta accetta la riga Meta e dà la forma pulita", 20, IG.leggiRichiesta(corpo(RIGA_META))?.valori.length);
    c(
      "leggiRichiesta toglie il carattere nullo (Postgres lo rifiuta)",
      "ab",
      IG.leggiRichiesta(corpo(RIGA_META.map((v, i) => (i === 3 ? "a\u0000b" : v))))?.valori[3],
    );
  }

  gruppo("SHEETS · la rotta: una riga diventa una scheda");
  {
    const m = mondo();
    const r = await manda(m, richiesta(corpo(RIGA_META)));
    c("la riga Meta del piano: 200 nuovo", [200, { ok: true, esito: "nuovo" }], [r.stato, r.json]);
    c("una scheda sola", 1, m.schede.length);
    const d = m.schede[0].data;
    c("nome, cognome e telefono senza «p:»", ["Mario", "Esempio", "+393330000101"], [d.nome, d.cognome, d.telefono]);
    c("risposte del modulo come voci", ["valutando", "segue"], [d.modulo?.urgenza, d.modulo?.conoscenza]);
    c(
      "tracking: inserzione, campagna, modulo, fonte Meta",
      ["120253730513900721", "Hair Genius Labs | 24 giugno - Copy 3", "Modulo senza titolo 30/11/24, 01:36-copy", "meta"],
      [d.tracking?.ad_id, d.tracking?.campaign_name, d.tracking?.form_name, d.tracking?.source],
    );
    c("id del lead Meta sulla scheda", "l:1000000000000011", d.metaLeadId);
    c(
      "consensoModulo dal foglio: modulo_meta, google_sheets, data del modulo",
      { whatsapp: true, il: "2026-10-25T09:14:03+01:00", via: "modulo_meta", fonte: "google_sheets" },
      d.consensoModulo,
    );
    c(
      "origineIngresso: foglio per nome, scheda, riga, ora d'ingresso",
      { via: "google_sheets", foglio: "Lead HGL", scheda: "Foglio1", riga: 57, il: ADESSO.toISOString() },
      d.origineIngresso,
    );
    c("origine per i filtri: «Google Sheets · Lead HGL»", "Google Sheets · Lead HGL", d.listaOrigine?.file);
    c("importata, da contattare, senza consulente", [true, "da_contattare", null], [d.importato, d.stato, d.consulenteId]);
    c("l'id del foglio Google non entra nella scheda", false, J(d).includes(FOGLIO_ID));
    c("l'ora d'ingresso della lista è quella della richiesta", ADESSO.toISOString(), d.listaOrigine?.il);
  }
  // Ogni riga di un file Meta di 5 righe, mandata dalla rotta = la stessa riga caricata da file
  {
    const norm = (d) => ({
      ...d,
      listaOrigine: { dataDalFile: d.listaOrigine?.dataDalFile },
      origineIngresso: undefined,
      consensoModulo: d.consensoModulo ? { ...d.consensoModulo, fonte: undefined } : undefined,
    });
    for (let i = 0; i < CINQUE.length; i++) {
      const m = mondo();
      await manda(m, richiesta(corpo(CINQUE[i])));
      c(
        `riga ${i + 1} di 5 (${CINQUE[i][16]}): scheda uguale a quella del file, a parte origine e fonte`,
        J(norm(daFile.leads[i])),
        J(norm(m.schede[0].data)),
      );
    }
  }
  {
    const m = mondo();
    const r = await manda(m, richiesta(corpo(rigaAltro, { intestazioni: intestAltro })));
    c("cella con a capo, «;» e «\"» dalla rotta: una scheda, campi al loro posto", [200, 1, "Mario", "+393330000131"], [r.stato, m.schede.length, m.schede[0]?.data.nome, m.schede[0]?.data.telefono]);
  }
  {
    // una colonna «stato» scritta a mano nel foglio non decide
    const intest = [...INTEST, "stato"];
    const m = mondo();
    await manda(m, richiesta(corpo([...RIGA_META, "venduto"], { intestazioni: intest })));
    c("colonna «stato» del foglio ignorata: sempre «da contattare»", "da_contattare", m.schede[0]?.data.stato);
    const m2 = mondo();
    await manda(m2, richiesta(corpo([...RIGA_META, "x"], { intestazioni: [...INTEST, "consulenteId"] })));
    c("…e una colonna «consulenteId» non assegna nessuno", null, m2.schede[0]?.data.consulenteId);
  }
  {
    // telefono salvato come numero dal foglio
    const m = mondo();
    const v = RIGA_META.map((x, i) => (i === 18 ? "393331234567" : x));
    await manda(m, richiesta(corpo(v)));
    c("telefono numerico «393331234567»: letto", "393331234567", m.schede[0]?.data.telefono);
  }
  {
    // foglio fatto a mano: data all'italiana, nessun id, nessun modulo Meta
    const m = mondo();
    const r = await manda(
      m,
      richiesta(corpo(["25/10/2026 09:15", "Paolo Finto", "3331234567"], { intestazioni: ["data", "full_name", "telefono"] })),
    );
    const d = m.schede[0]?.data;
    c("riga a mano (nome, telefono, data): nuova scheda", [200, "nuovo", "Paolo", "Finto"], [r.stato, r.json?.esito, d?.nome, d?.cognome]);
    c("…consenso del foglio (lo riempie Meta) con la data letta all'italiana", "2026-10-25", d?.consensoModulo?.il?.slice(0, 10));
    const m2 = mondo();
    await manda(m2, richiesta(corpo(["Paolo Finto", "3331234567"], { intestazioni: ["nome", "telefono"] })));
    c("…senza data leggibile: il = null, non vale", [true, null], [m2.schede[0]?.data.consensoModulo?.whatsapp, m2.schede[0]?.data.consensoModulo?.il]);
    const m3 = mondo();
    await manda(m3, richiesta(corpo(["Paolo Finto", ""], { intestazioni: ["nome", "telefono"] })));
    c("…senza telefono: nessun consenso", undefined, m3.schede[0]?.data.consensoModulo);
  }
  {
    // Una riga sola non deve far dubitare dell'intestazione per una casella vuota o un nome di una parola
    const leggibile = (d) => Object.keys(d.datiFile ?? {}).some((k) => /^colonna \d+/.test(k));
    const senzaEmail = riga("81", "Anna Finta", "p:+393330000181", { email: "" });
    const m1 = mondo();
    await manda(m1, richiesta(corpo(senzaEmail)));
    c("riga senza email: i dati originali tengono il nome vero delle colonne", false, leggibile(m1.schede[0].data));
    const m2 = mondo();
    await manda(m2, richiesta(corpo(riga("82", "Marco", "p:+393330000182"))));
    c("nome di una parola sola: idem", [false, "Marco"], [leggibile(m2.schede[0].data), m2.schede[0].data.nome]);
    // …ma un'intestazione davvero smentita dai dati resta smentita: il telefono sotto l'email
    const spostata = riga("83", "Mario Esempio", "p:+393330000183");
    [spostata[17], spostata[18]] = [spostata[18], spostata[17]];
    const m3 = mondo();
    await manda(m3, richiesta(corpo(spostata)));
    c("intestazione smentita dai dati (telefono nella colonna dell'email): si legge dai dati e non ci si fida", ["+393330000183", true], [m3.schede[0].data.telefono, leggibile(m3.schede[0].data)]);
  }
  {
    // riga senza nome né telefono
    const m = mondo();
    const r = await manda(m, richiesta(corpo(["2026-10-25T09:14:03Z", "false"], { intestazioni: ["created_time", "is_organic"] })));
    c("senza nome né telefono: 200 scartata con il motivo", [200, "scartata", true], [r.stato, r.json?.esito, typeof r.json?.motivo === "string"]);
    c("…e non tocca il database", [0, 0], [m.chiamate.scrivi, m.nuoveSchede]);
  }

  gruppo("SHEETS · la rotta: niente doppioni");
  {
    const m = mondo();
    const a = await manda(m, richiesta(corpo(RIGA_META)));
    const b = await manda(m, richiesta(corpo(RIGA_META)));
    c("la stessa richiesta due volte: nuovo, poi gia_ricevuto", ["nuovo", "gia_ricevuto"], [a.json?.esito, b.json?.esito]);
    c("…una scheda sola", 1, m.schede.length);
    const stessaRigaAltroNumeroRiga = await manda(m, richiesta(corpo(RIGA_META, { riga: 99 })));
    c("…anche se la riga del foglio è cambiata (ordinato): gia_ricevuto", "gia_ricevuto", stessaRigaAltroNumeroRiga.json?.esito);
  }
  {
    // stesso numero, id Meta diverso → contatto di ritorno, con patchRicarico
    const vecchia = {
      id: "s1",
      data: {
        nome: "Mario",
        cognome: "Vecchio",
        telefono: "333 0000101",
        stato: "sta_valutando",
        note: "chiamato lunedì, vuole richiamo",
        consulenteId: "cons-1",
        tracking: { utm_source: "sito" },
      },
    };
    const m = mondo({ schede: [vecchia] });
    const r = await manda(m, richiesta(corpo(riga("42", "Mario Esempio", "p:+393330000101"))));
    c("stesso numero, altro id: 200 ritorno", [200, "ritorno"], [r.stato, r.json?.esito]);
    c("…nessuna scheda nuova", 1, m.schede.length);
    const d = m.schede[0].data;
    c("…contatore +1, daDecidere, lista, stato di allora", [1, true, "Google Sheets · Lead HGL", "sta_valutando"], [d.ricarico?.volte, d.ricarico?.daDecidere, d.ricarico?.lista, d.ricarico?.statoAllora]);
    c("…stato, note e consulente intatti", ["sta_valutando", "chiamato lunedì, vuole richiamo", "cons-1", "Vecchio"], [d.stato, d.note, d.consulenteId, d.cognome]);
    c("…il tracking si riempie e non sostituisce (vince quello che c'era)", ["sito", "120253730513900721"], [d.tracking?.utm_source, d.tracking?.ad_id]);
    c("…le risposte del modulo entrano (la scheda non ne aveva)", "valutando", d.modulo?.urgenza);
    c("…consenso del modulo scritto (la scheda non ne aveva)", "modulo_meta", d.consensoModulo?.via);
    c("…la chiave d'ingresso è nella stessa patch", ["m:1000000000000042"], d.ricarico?.chiaviIngresso);
    c("…il registro è chiuso come «ritorno»", "ritorno", m.ingressi.get("m:1000000000000042")?.esito);
    // Una seconda ricompilazione dello stesso numero con un altro id: +1 ancora, due chiavi
    const r2 = await manda(m, richiesta(corpo(riga("43", "Mario Esempio", "p:+393330000101"))));
    c("una terza richiesta, id nuovo: ritorno, contatore 2, due chiavi", ["ritorno", 2, 2], [r2.json?.esito, m.schede[0].data.ricarico?.volte, m.schede[0].data.ricarico?.chiaviIngresso?.length]);
    // Le chiavi sono al massimo 5
    for (let n = 44; n < 52; n++) await manda(m, richiesta(corpo(riga(String(n), "Mario Esempio", "p:+393330000101"))));
    c("le chiavi tenute sono le ultime 5, la più nuova in testa", [5, "m:1000000000000051"], [m.schede[0].data.ricarico?.chiaviIngresso?.length, m.schede[0].data.ricarico?.chiaviIngresso?.[0]]);
  }
  {
    // chi ha revocato il WhatsApp non riceve il consenso del modulo con il ritorno
    const m = mondo({ schede: [{ id: "s1", data: { nome: "Mario", telefono: "3330000101", stato: "da_contattare", okWhatsapp: { si: false } } }] });
    await manda(m, richiesta(corpo(riga("52", "Mario Esempio", "p:+393330000101"))));
    c("ritorno su una scheda con revoca: il consenso del modulo NON si scrive", [1, undefined], [m.schede[0].data.ricarico?.volte, m.schede[0].data.consensoModulo]);
    const m2 = mondo({ schede: [{ id: "s1", data: { nome: "Mario", telefono: "3330000101", stato: "da_contattare", consensoModulo: { whatsapp: true, il: "2026-10-01T10:00:00Z", via: "modulo_meta", fonte: "csv_meta" } } }] });
    await manda(m2, richiesta(corpo(riga("53", "Mario Esempio", "p:+393330000101"))));
    c("ritorno su una scheda che il consenso ce l'ha già: non si riscrive", "2026-10-01T10:00:00Z", m2.schede[0].data.consensoModulo?.il);
  }
  {
    // ritorno interrotto: la scrittura della scheda fallisce 3 volte → 503, poi si ripete
    const m = mondo({
      schede: [{ id: "s1", data: { nome: "Mario", telefono: "3330000101", stato: "da_contattare" } }],
      guasti: { scriviScheda: 3 },
    });
    const a = await manda(m, richiesta(corpo(riga("61", "Mario Esempio", "p:+393330000101"))));
    c("scrittura della scheda che fallisce 3 volte: 503, lo script riprova", 503, a.stato);
    c("…il testo dell'errore del database (col numero) non esce", false, a.testo.includes("393330000101"));
    c("…registro ancora «da segnare», contatore fermo", ["ritorno_da_segnare", undefined], [m.ingressi.get("m:1000000000000061")?.esito, m.schede[0].data.ricarico?.volte]);
    const b = await manda(m, richiesta(corpo(riga("61", "Mario Esempio", "p:+393330000101"))));
    c("ripetuto: ritorno, contatore +1 UNA volta", [200, "ritorno", 1], [b.stato, b.json?.esito, m.schede[0].data.ricarico?.volte]);
    const cc = await manda(m, richiesta(corpo(riga("61", "Mario Esempio", "p:+393330000101"))));
    c("e una terza volta: gia_ricevuto, contatore ancora 1", ["gia_ricevuto", 1], [cc.json?.esito, m.schede[0].data.ricarico?.volte]);
  }
  {
    // l'esito sul registro fallisce DOPO la scrittura della scheda
    const m = mondo({
      schede: [{ id: "s1", data: { nome: "Mario", telefono: "3330000101", stato: "da_contattare" } }],
      guasti: { chiudi: 1 },
    });
    const a = await manda(m, richiesta(corpo(riga("62", "Mario Esempio", "p:+393330000101"))));
    c("esito che fallisce dopo la scrittura: 503 (si riprova)", [503, 1], [a.stato, m.schede[0].data.ricarico?.volte]);
    const b = await manda(m, richiesta(corpo(riga("62", "Mario Esempio", "p:+393330000101"))));
    c("al secondo arrivo il contatore resta +1 (chiave già sulla scheda)", [200, "ritorno", 1, 1], [b.stato, b.json?.esito, m.schede[0].data.ricarico?.volte, m.chiamate.scriviScheda]);
    c("…e il registro si chiude", "ritorno", m.ingressi.get("m:1000000000000062")?.esito);
  }
  {
    // qualcuno modifica la scheda fra la nostra lettura e la nostra scrittura
    const m = mondo({
      schede: [{ id: "s1", data: { nome: "Mario", telefono: "3330000101", stato: "da_contattare", note: "vecchia" } }],
      durante: (s) => {
        s.data.stato = "non_risponde";
        s.data.note = "scritta nel frattempo";
        s.v++;
      },
    });
    const r = await manda(m, richiesta(corpo(riga("63", "Mario Esempio", "p:+393330000101"))));
    const d = m.schede[0].data;
    c("scheda cambiata sotto di noi: si rilegge e si rifà sul valore nuovo", [200, 2, "non_risponde", "scritta nel frattempo", 1], [r.stato, m.chiamate.scriviScheda, d.stato, d.note, d.ricarico?.volte]);
  }
  {
    const m = mondo({ schede: [{ id: "s1", data: { nome: "Mario", telefono: "3330000101", stato: "da_contattare", ricarico: { volte: 2, ultimo: "2026-10-01T10:00:00Z" } } }] });
    m.porte.leggiScheda = async () => null;
    const r = await manda(m, richiesta(corpo(riga("64", "Mario Esempio", "p:+393330000101"))));
    c("scheda sparita fra registro e lettura: nessun errore (niente da segnare)", [200, "ritorno"], [r.stato, r.json?.esito]);
  }
  {
    // l'id è già su una scheda caricata da file → gia_presente, nemmeno il ritorno
    const daCsv = IMP.traduciCsv(csvDi(INTEST, [RIGA_META])).leads[0];
    const m = mondo({ schede: [{ id: "s1", data: daCsv }] });
    const r = await manda(m, richiesta(corpo(RIGA_META)));
    c("id Meta già su una scheda da file: gia_presente", [200, "gia_presente"], [r.stato, r.json?.esito]);
    c("…niente scheda nuova e il contatore di ritorno non si muove", [1, undefined], [m.schede.length, m.schede[0].data.ricarico]);
    // scheda vecchia col solo id nei dati originali (caricata prima di questa commessa)
    const vecchia = { ...daCsv, metaLeadId: undefined };
    const m2 = mondo({ schede: [{ id: "s1", data: vecchia }] });
    const r2 = await manda(m2, richiesta(corpo(RIGA_META)));
    c("…vale anche per le schede senza metaLeadId (datiFile.id)", "gia_presente", r2.json?.esito);
  }
  {
    // due richieste insieme, stesso numero: una scheda e un ritorno (il finto rispetta il lucchetto)
    const m = mondo();
    const [a, b] = await Promise.all([
      manda(m, richiesta(corpo(riga("71", "Mario Esempio", "p:+393330000171")))),
      manda(m, richiesta(corpo(riga("72", "Mario Esempio", "p:+393330000171")))),
    ]);
    c("due richieste insieme, stesso numero: una scheda sola", 1, m.schede.length);
    c("…una è «nuovo» e l'altra «ritorno»", ["nuovo", "ritorno"], [a.json?.esito, b.json?.esito].sort());
    c("…contatore di ritorno 1", 1, m.schede[0].data.ricarico?.volte);
    // trigger del foglio e giro di sicurezza: la STESSA richiesta due volte insieme
    const m2 = mondo();
    const [x, y] = await Promise.all([
      manda(m2, richiesta(corpo(RIGA_META))),
      manda(m2, richiesta(corpo(RIGA_META))),
    ]);
    c("la stessa richiesta due volte insieme: una scheda", [1, ["gia_ricevuto", "nuovo"]], [m2.schede.length, [x.json?.esito, y.json?.esito].sort()]);
  }

  gruppo("SHEETS · la rotta: chiave d'idempotenza");
  {
    const senzaId = INTEST.filter((x) => x !== "id");
    const valSenzaId = (n, nome, tel, o) => riga(n, nome, tel, o).slice(1);
    const rq = (valori, sopra) => IG.leggiRichiesta(corpo(valori, { intestazioni: senzaId, ...sopra }));
    const chiave = async (valori, sopra) => {
      const r = rq(valori, sopra);
      const s = await IG.schedaDaRiga(r, ADESSO);
      return s.chiave;
    };
    const k1 = await chiave(valSenzaId("1", "Mario Esempio", "p:+393330000101"));
    c("senza id Meta: chiave «f:» + 32 esadecimali", true, /^f:[0-9a-f]{32}$/.test(k1));
    c("…stabile (la stessa riga dà la stessa chiave)", k1, await chiave(valSenzaId("1", "Mario Esempio", "p:+393330000101")));
    c("…non dipende dalla riga del foglio", k1, await chiave(valSenzaId("1", "Mario Esempio", "p:+393330000101"), { riga: 200 }));
    c("…cambia con un'altra data del modulo", true, k1 !== (await chiave(valSenzaId("1", "Mario Esempio", "p:+393330000101", { quando: "2026-10-26T10:00:00Z" }))));
    c("…cambia con un altro foglio", true, k1 !== (await chiave(valSenzaId("1", "Mario Esempio", "p:+393330000101"), { foglio: { id: "altro", nome: "Lead HGL", scheda: "Foglio1" } })));
    c("…cambia con un altro numero", true, k1 !== (await chiave(valSenzaId("1", "Mario Esempio", "p:+393330000102"))));
    c("…non porta nome né numero in chiaro", false, /Mario|0101/.test(k1));
    const kSenzaTutto = await chiave(["Mario Esempio", "—"], { intestazioni: ["nome", "nota"] });
    c("senza telefono e senza data: impronta di tutte le celle", true, /^f:[0-9a-f]{32}$/.test(kSenzaTutto));
    c("…cambia se cambia una cella", true, kSenzaTutto !== (await chiave(["Mario Esempio", "-"], { intestazioni: ["nome", "nota"] })));
    const sMeta = await IG.schedaDaRiga(IG.leggiRichiesta(corpo(RIGA_META)), ADESSO);
    c("con l'id Meta: «m:» + cifre", ["m:1000000000000011", "330000101"], [sMeta.chiave, sMeta.tel9]);
  }

  gruppo("SHEETS · la rotta: installazione, tetto, errori del database");
  {
    const m = mondo({ utente: null });
    const r = await manda(m, richiesta(corpo(RIGA_META)));
    c("manychat_config senza user_id: 503 non_configurato", [503, "non_configurato"], [r.stato, r.json?.errore]);
  }
  {
    const m = mondo({ ingressiDiOggi: IG.TETTO_RIGHE_GIORNO });
    const r = await manda(m, richiesta(corpo(RIGA_META)));
    c("301ª riga del giorno: 503 «tetto», niente scritto", [503, { ok: false, errore: "tetto" }, 0], [r.stato, r.json, m.nuoveSchede]);
    const m2 = mondo({ ingressiDiOggi: IG.TETTO_RIGHE_GIORNO - 1 });
    const r2 = await manda(m2, richiesta(corpo(RIGA_META)));
    c("la 300ª passa", [200, "nuovo"], [r2.stato, r2.json?.esito]);
    // già ricevuta risponde anche a tetto raggiunto
    const r3 = await manda(m2, richiesta(corpo(RIGA_META)));
    c("a tetto raggiunto, una riga già ricevuta risponde ancora gia_ricevuto", "gia_ricevuto", r3.json?.esito);
  }
  {
    const SEGRETO_DB = "Failing row contains ({\"nome\":\"Mario\",\"telefono\":\"+393330000101\"})";
    const m = mondo({ guasti: { scrivi: { code: "23502", message: SEGRETO_DB } } });
    const r = await manda(m, richiesta(corpo(RIGA_META)));
    c("errore del database su una riga: 500 (si conta su quella riga)", [500, { ok: false, errore: "errore" }], [r.stato, r.json]);
    c("…nella risposta e nel log solo il codice, mai il messaggio", [false, false, "errore:23502"], [r.testo.includes("Mario") || r.testo.includes("0101"), String(r.esito).includes("0101") || String(r.esito).includes("Mario"), r.esito]);
    for (const code of ["42P01", "42883", "PGRST202", "PGRST205"]) {
      const mm = mondo({ guasti: { scrivi: { code, message: "no" } } });
      const rr = await manda(mm, richiesta(corpo(RIGA_META)));
      c(`S1 mancante (${code}): 503, lo script riprova`, [503, "non_pronto"], [rr.stato, rr.json?.errore]);
    }
    const m2 = mondo({ guasti: { scrivi: { message: "senza codice" } } });
    const r2 = await manda(m2, richiesta(corpo(RIGA_META)));
    c("errore senza codice (rete, servizio): 503, il log dice solo «non_pronto:?»", [503, "non_pronto:?"], [r2.stato, r2.esito]);
    const m3 = mondo({ guasti: { scrivi: { code: "x'; drop table--", message: "" } } });
    const r3 = await manda(m3, richiesta(corpo(RIGA_META)));
    c("un codice strano non finisce nel log così com'è", "non_pronto:?", r3.esito);
    const m4 = mondo({ guasti: { scrivi: { code: "08006", message: "connessione" } } });
    c("connessione caduta (08xxx): 503, non è colpa della riga", 503, (await manda(m4, richiesta(corpo(RIGA_META)))).stato);
  }
  {
    const m = mondo();
    const r = await manda(m, richiesta(corpo(RIGA_META)));
    c("esito per i log: una parola, senza dati", "nuovo", r.esito);
    c("la risposta non contiene nome, telefono, id, testo", false, /Mario|Esempio|0101|10000000000000|valutando/.test(r.testo));
  }

  /* ═════════ 3. LA ROTTA E LE PORTE VERE: IL TESTO ═══════════════════════════ */
  gruppo("SHEETS · il collegamento (testo dei file)");
  {
    const rotta = readFileSync(join(radice, "src/routes/api.public.sheets-ingresso.ts"), "utf8");
    const porte = readFileSync(join(radice, "src/crm/sheets/porte.server.ts"), "utf8");
    c("la rotta chiama gestisciIngresso col segreto SHEETS_INGRESSO_TOKEN", true, /gestisciIngresso\(/.test(rotta) && /process\.env\.SHEETS_INGRESSO_TOKEN/.test(rotta));
    c("la rotta logga solo stato ed esito", true, /console\.info\(`\[sheets-ingresso\] \$\{response\.status\} \$\{esito\}`\)/.test(rotta));
    c("la rotta non stampa mai il corpo, la richiesta o l'errore", false, /console\.\w+\([^)]*(request|corpo|error|err\b|e\b\))/.test(rotta.replace(/\[sheets-ingresso\][^`]*`/, "")));
    c("le porte lanciano solo {code}, mai il messaggio", false, /throw\s+(new\s+Error|e\b|error\b)|\.message/.test(porte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")));
    c("le porte scrivono la scheda solo se updated_at combacia", true, /\.eq\("updated_at"/.test(porte));
    c("le porte usano le due funzioni di S1", true, /sheets_ingresso_scrivi/.test(porte) && /sheets_ingresso_esito/.test(porte));
    c("ogni query porta user_id (e le funzioni p_user_id)", [true, true], [(porte.match(/\.eq\("user_id"/g) ?? []).length >= 2, (porte.match(/p_user_id/g) ?? []).length >= 2]);
  }

  /* ═════════ 4. LO SCRIPT APPS SCRIPT, IN UN FINTO GOOGLE ════════════════════ */
  await proveLoScript({ IG, c, gruppo, radice, INTEST, RIGA_META, CINQUE, FOGLIO_ID, ADESSO, mondo, manda, richiesta, corpo });
}

/* ═══════════════════════════════════════════════════════════════════════════
   LO SCRIPT
   Il codice vero del file `.gs`, eseguito con `vm` e un finto Google. Il finto
   `UrlFetchApp` è SINCRONO (come in Apps Script) e risponde con quello che
   decide la prova; i corpi mandati si registrano, e alla fine si danno alla
   rotta vera (async) per vedere che il contratto regge. */
async function proveLoScript({ IG, c, gruppo, radice, INTEST, RIGA_META, CINQUE, FOGLIO_ID, ADESSO, mondo, manda, richiesta, corpo }) {
  gruppo("SHEETS · lo script Apps Script (finto Google)");
  const percorso = join(radice, "strumenti/google-sheets/ingresso-crm.gs");
  let sorgente = "";
  try {
    sorgente = readFileSync(percorso, "utf8");
  } catch {
    c("lo script esiste in strumenti/google-sheets/ingresso-crm.gs", true, false);
    return;
  }
  c("lo script non contiene chiavi né indirizzi veri", false, /[0-9a-f]{40,}|https:\/\/[a-z0-9.-]+\.(workers\.dev|pages\.dev|lovable)/i.test(sorgente));
  c("lo script apre il foglio per id (autonomo, non legato al foglio)", [true, false], [/SpreadsheetApp\.openById/.test(sorgente), /getActiveSpreadsheet/.test(sorgente)]);
  c("i trigger si legano al foglio per id", true, /forSpreadsheet\(/.test(sorgente));

  /** Il finto Google. `righe` = matrice di valori GREZZI (la prima è l'intestazione). */
  function google(righe, prop = {}, opz = {}) {
    const g = {
      righe: righe.map((r) => [...r]),
      prop: { FOGLIO_ID, CRM_URL: "https://crm.example/api/public/sheets-ingresso", CRM_TOKEN: "t".repeat(48), ...prop },
      trigger: [],
      inviati: [],
      errori: [],
      avvisi: [],
      lucchettoLibero: true,
      rispondi: opz.rispondi ?? (() => ({ codice: 200, corpo: { ok: true, esito: "nuovo" } })),
      ordina: null,
      durante: null,
    };
    const mostrato = (v) =>
      v instanceof Date ? v.toISOString() : v === undefined || v === null ? "" : typeof v === "number" ? String(v).replace(/\.0+$/, "") : String(v);
    const pad = (r, n) => Array.from({ length: n }, (_, i) => r[i] ?? "");
    //  Due schede: quella di Meta (`g.righe`) e quella dei segni (`g.segniRighe`,
    //  `null` finché lo script non la crea).
    g.segniRighe = null;
    const scheda = (nome, leggi) => {
      const largo = () => Math.max(1, ...leggi().map((r) => r.length));
      return {
        getName: () => nome,
        getParent: () => libro,
        getLastRow: () => leggi().length,
        getLastColumn: () => (leggi().length ? largo() : 0),
        appendRow: (v) => { leggi().push([...v]); },
        getRange: (r, col, nr = 1, nc = 1) => ({
          getValues: () => Array.from({ length: nr }, (_, i) => pad(leggi()[r - 1 + i] ?? [], largo()).slice(col - 1, col - 1 + nc)),
          getDisplayValues: () => Array.from({ length: nr }, (_, i) => pad(leggi()[r - 1 + i] ?? [], largo()).slice(col - 1, col - 1 + nc).map(mostrato)),
          setValue: (v) => {
            const rr = leggi();
            while (rr.length < r) rr.push([]);
            rr[r - 1][col - 1] = v;
          },
          setValues: (m) => {
            const rr = leggi();
            m.forEach((riga, i) => {
              while (rr.length < r + i) rr.push([]);
              riga.forEach((v, j) => { rr[r - 1 + i][col - 1 + j] = v; });
            });
          },
        }),
      };
    };
    const foglio = scheda("Foglio1", () => g.righe);
    const segni = scheda("Invii al CRM", () => g.segniRighe);
    const libro = {
      getName: () => "Lead HGL",
      getSheetByName: (n) => (n === "Foglio1" ? foglio : n === "Invii al CRM" && g.segniRighe ? segni : null),
      getSheets: () => (g.segniRighe ? [foglio, segni] : [foglio]),
      insertSheet: (n) => {
        if (n !== "Invii al CRM") throw new Error("scheda inattesa: " + n);
        g.segniRighe = [];
        return segni;
      },
    };
    const sandbox = {
      console: {
        error: (m) => g.errori.push(String(m)),
        warn: (m) => g.avvisi.push(String(m)),
        log: () => {},
        info: () => {},
      },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (k) => (k in g.prop ? g.prop[k] : null),
          setProperty: (k, v) => { g.prop[k] = String(v); },
          deleteProperty: (k) => { delete g.prop[k]; },
        }),
      },
      LockService: {
        getScriptLock: () => ({ tryLock: () => g.lucchettoLibero, releaseLock: () => {} }),
      },
      SpreadsheetApp: {
        openById: (id) => {
          if (id !== FOGLIO_ID) throw new Error("foglio sconosciuto");
          return libro;
        },
      },
      ScriptApp: {
        getProjectTriggers: () => g.trigger.map((t) => ({ getHandlerFunction: () => t.f, _t: t })),
        deleteTrigger: (t) => { g.trigger = g.trigger.filter((x) => x !== t._t); },
        newTrigger: (f) => {
          const t = { f, tipo: null, ogni: null };
          const catena = {
            forSpreadsheet: (id) => { t.foglio = id; return { onChange: () => { t.tipo = "onChange"; return catena }, onFormSubmit: () => { t.tipo = "onFormSubmit"; return catena } }; },
            timeBased: () => ({ everyMinutes: (n) => { t.tipo = "tempo"; t.ogni = n; return catena; } }),
            create: () => { g.trigger.push(t); return t; },
          };
          return catena;
        },
      },
      Utilities: {
        DigestAlgorithm: { SHA_256: "SHA_256" },
        computeDigest: (_a, s) => Array.from(createHash("sha256").update(String(s)).digest()).map((b) => (b > 127 ? b - 256 : b)),
        base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => (b < 0 ? b + 256 : b))).toString("base64url"),
        formatDate: (d, tz, fmt0) => {
          const fmt = fmt0.replace(/'/g, "");
          const p = Object.fromEntries(
            new Intl.DateTimeFormat("it-IT", { timeZone: tz === "Etc/UTC" ? "UTC" : tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
              .formatToParts(d).map((x) => [x.type, x.value]),
          );
          return fmt.replace("yyyy", p.year).replace("MM", p.month).replace("dd", p.day).replace("HH", p.hour).replace("mm", p.minute).replace("ss", p.second);
        },
        newBlob: (s) => ({ getBytes: () => Array.from(Buffer.from(String(s), "utf8")) }),
      },
      UrlFetchApp: {
        fetch: (url, o) => {
          const corpoInviato = JSON.parse(o.payload);
          g.inviati.push({ url, corpo: corpoInviato, token: o.headers["X-HGL-Token"], opzioni: o });
          if (g.durante) { const f = g.durante; g.durante = null; f(g); }
          const r = g.rispondi(corpoInviato, g.inviati.length);
          if (r === "rete") throw new Error("Address unavailable");
          return { getResponseCode: () => r.codice, getContentText: () => JSON.stringify(r.corpo ?? {}) };
        },
      },
      Date, JSON, Math, Number, String, Array, Object, RegExp, Error,
    };
    vm.createContext(sandbox);
    vm.runInContext(sorgente, sandbox, { filename: "ingresso-crm.gs" });
    g.f = sandbox;
    g.vai = (nome) => vm.runInContext(`${nome}()`, sandbox);
    g.col = (nome) => (g.righe[0] ?? []).indexOf(nome);
    //  Il segno di ogni riga di lead della scheda di Meta, nel suo ordine, letto
    //  dalla scheda dei segni per id Meta: «data · esito», o "" se non c'è.
    g.segni = () =>
      g.righe
        .filter((r) => !r.some((v) => String(v).trim().toLowerCase() === "created_time"))
        .map((r) => {
          const k = r.find((v) => /^l:\d{6,}$/.test(String(v)));
          const s = (g.segniRighe ?? []).slice(1).find((x) => x[0] === k);
          return s ? `${s[1]} · ${s[2]}` : "";
        });
    return g;
  }

  const unaRiga = (n, nome = "Mario Esempio") => riga_(n, nome);
  function riga_(n, nome) {
    return [`l:10000000000000${n}`, "2026-10-25T09:14:03+01:00", nome, `p:+39333000${String(n).padStart(4, "0")}`, "CREATED"];
  }
  const INT = ["id", "created_time", "full_name", "phone_number", "lead_status"];

  // ── installazione ──────────────────────────────────────────────────────────
  {
    const g = google([INT, unaRiga("11")]);
    g.vai("installa");
    c("installa: due trigger sul foglio (onChange, onFormSubmit) e il giro di sicurezza al minuto (di serie)", [["onChange", FOGLIO_ID], ["onFormSubmit", FOGLIO_ID], ["tempo", 1]].map((x) => x.join("|")), g.trigger.map((t) => [t.tipo, t.tipo === "tempo" ? t.ogni : t.foglio].join("|")));
    c("installa: la scheda di Meta resta com'era (nessuna colonna in più)", [[...INT], 2], [g.righe[0], g.righe.length]);
    c("installa: i segni vanno nella scheda a parte «Invii al CRM»", ["Chiave", "Ultimo invio", "Esito"], g.segniRighe?.[0]);
    g.vai("installa");
    c("installa due volte: i trigger non si raddoppiano", 3, g.trigger.length);
    const g1 = google([INT], { OGNI_MINUTI: "1" });
    g1.vai("installa");
    c("OGNI_MINUTI = 1: il giro di sicurezza è al minuto", 1, g1.trigger.find((t) => t.tipo === "tempo")?.ogni);
    const gAssente = google([INT]);
    gAssente.vai("installa");
    c("OGNI_MINUTI assente: il giro è al minuto (di serie 1)", 1, gAssente.trigger.find((t) => t.tipo === "tempo")?.ogni);
    const g5 = google([INT], { OGNI_MINUTI: "5" });
    g5.vai("installa");
    c("OGNI_MINUTI = 5: ogni 5 minuti", 5, g5.trigger.find((t) => t.tipo === "tempo")?.ogni);
    const g9 = google([INT], { OGNI_MINUTI: "9" });
    g9.vai("installa");
    c("OGNI_MINUTI strano: 1", 1, g9.trigger.find((t) => t.tipo === "tempo")?.ogni);
  }
  {
    const muro = Array.from({ length: 25 }, (_, i) => riga_(String(10 + i), "Mario Esempio"));
    const g = google([INT, ...muro]);
    let errore = "";
    try { g.vai("installa"); } catch (e) { errore = e.message; }
    c("installa con 25 righe senza segno: rifiuta e dice di lanciare segnaGiaPresenti", [true, 0], [/segnaGiaPresenti/.test(errore), g.trigger.length]);
    c("…e non ha mandato niente", 0, g.inviati.length);
    g.vai("segnaGiaPresenti");
    c("segnaGiaPresenti: tutte segnate, nessun invio", [true, 0], [g.segni().every((s) => /già presente/.test(s)), g.inviati.length]);
    g.vai("installa");
    c("…poi installa passa", [3, 0], [g.trigger.length, g.inviati.length]);
    const g2 = google([INT, ...muro], { GIA_PRESENTI_FATTO: "si" });
    g2.vai("installa");
    c("con GIA_PRESENTI_FATTO = si installa anche con 25 righe (le manda tutte)", true, g2.trigger.length === 3);
    const g3 = google([INT, riga_("90", "Solo Una")]);
    g3.vai("installa");
    c("poche righe senza segno (≤ 20): installa e le invia", [1, 3], [g3.inviati.length, g3.trigger.length]);
  }
  for (const [nome, prop] of [["CRM_URL senza https", { CRM_URL: "http://crm.example/api" }], ["CRM_URL vuoto", { CRM_URL: "" }], ["CRM_TOKEN mancante", { CRM_TOKEN: "" }], ["FOGLIO_ID mancante", { FOGLIO_ID: "" }]]) {
    const g = google([INT, unaRiga("11")], prop);
    let errore = "";
    try { g.vai("installa"); } catch (e) { errore = e.message; }
    g.vai("giroDiSicurezza");
    c(`proprietà sbagliata (${nome}): installa rifiuta, il giro non invia`, [true, 0], [errore.length > 0, g.inviati.length]);
  }
  {
    const g = google([INT]);
    g.vai("installa");
    g.vai("disinstalla");
    c("disinstalla: toglie i trigger dello script", 0, g.trigger.length);
  }

  // ── l'invio ─────────────────────────────────────────────────────────────────
  {
    const g = google([INT, unaRiga("11")]);
    g.vai("giroDiSicurezza");
    c("riga nuova: un solo POST, con la chiave nell'intestazione, a https", [1, "t".repeat(48), true], [g.inviati.length, g.inviati[0]?.token, g.inviati[0]?.url.startsWith("https://")]);
    c("…senza seguire gli rimandi, e non con la colonna del segno", [false, false], [g.inviati[0]?.opzioni.followRedirects, g.inviati[0]?.corpo.intestazioni.includes("Inviato al CRM")]);
    c("…segno «nuova scheda» con data e ora di Roma", true, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} · nuova scheda$/.test(g.segni()[0]));
    g.vai("giroDiSicurezza");
    c("al giro dopo la riga segnata non si rimanda", 1, g.inviati.length);
    const b = g.inviati[0].corpo;
    c("il corpo: versione 1, foglio (id, nome, scheda), riga 2", [1, FOGLIO_ID, "Lead HGL", "Foglio1", 2], [b.versione, b.foglio.id, b.foglio.nome, b.foglio.scheda, b.riga]);
  }
  {
    // Date e numeri del foglio
    const g = google([["created_time", "full_name", "phone_number"], [new Date("2026-10-25T08:14:03Z"), "Mario Esempio", 393331234567]]);
    g.vai("giroDiSicurezza");
    const v = g.inviati[0]?.corpo.valori;
    c("una data del foglio parte come ISO UTC, un telefono numerico con tutte le cifre", ["2026-10-25T08:14:03Z", "393331234567"], [v?.[0], v?.[2]]);
  }
  {
    // 3 righe: la seconda va in 500, le altre passano; dopo 5 giri «errore: da guardare»
    const g = google([INT, unaRiga("11"), unaRiga("12", "Luca Prova"), unaRiga("13", "Anna Finta")], {}, {
      rispondi: (b) => (b.valori[0] === "l:1000000000000012" ? { codice: 500, corpo: { ok: false } } : { codice: 200, corpo: { ok: true, esito: "nuovo" } }),
    });
    g.vai("giroDiSicurezza");
    c("un 500 su una riga: le altre passano nello stesso giro", [3, true, "", true], [g.inviati.length, /nuova scheda/.test(g.segni()[0]), g.segni()[1], /nuova scheda/.test(g.segni()[2])]);
    for (let i = 0; i < 3; i++) g.vai("giroDiSicurezza");
    c("…dopo 4 giri la riga ancora non è segnata", "", g.segni()[1]);
    g.vai("giroDiSicurezza");
    c("…dopo 5 tentativi: «errore: da guardare (500)»", "errore: da guardare (500)", g.segni()[1].replace(/^[\d/: ]+· /, ""));
    const prima = g.inviati.length;
    g.vai("giroDiSicurezza");
    c("…e non si riprova più", prima, g.inviati.length);
    c("…il contatore dei tentativi si pulisce", false, Object.keys(g.prop).some((k) => k.startsWith("t|")));
  }
  {
    // 401 ferma il giro (non insiste), 503 anche, la rete anche
    for (const [nome, risposta, attesaInviati] of [["401", { codice: 401, corpo: {} }, 1], ["503", { codice: 503, corpo: { errore: "tetto" } }, 1], ["rete", "rete", 1]]) {
      const g = google([INT, unaRiga("11"), unaRiga("12")], {}, { rispondi: () => risposta });
      g.vai("giroDiSicurezza");
      c(`${nome}: il giro si ferma alla prima riga e non segna niente`, [attesaInviati, ["", ""]], [g.inviati.length, g.segni()]);
    }
    const g = google([INT, unaRiga("11")], {}, { rispondi: () => ({ codice: 401 }) });
    g.vai("giroDiSicurezza");
    c("401: lo script lo scrive nei registri senza stampare la chiave", [true, false], [g.errori.length > 0, g.errori.join().includes("t".repeat(10))]);
  }
  {
    // 404, 3xx, 429, 502, 504, 522…: non sono colpa della riga → il giro si ferma, 6 giri di fila, nessun segno e nessun contatore
    for (const codice of [404, 302, 429, 502, 504, 522]) {
      const g = google([INT, unaRiga("11"), unaRiga("12")], {}, { rispondi: () => ({ codice, corpo: {} }) });
      for (let i = 0; i < 6; i++) g.vai("giroDiSicurezza");
      c(`${codice} per 6 giri: un solo tentativo a giro, nessun segno, nessun contatore salvato`, [6, ["", ""], false], [g.inviati.length, g.segni(), Object.keys(g.prop).some((k) => k.startsWith("t|"))]);
      c(`${codice}: lo dice nei registri col codice`, true, g.avvisi.some((a) => a.includes(String(codice))));
    }
    // 400 e 413: la riga si segna e si va avanti
    const g = google([INT, unaRiga("11"), unaRiga("12")], {}, {
      rispondi: (b) => (b.valori[0].endsWith("11") ? { codice: 400, corpo: {} } : { codice: 413, corpo: {} }),
    });
    g.vai("giroDiSicurezza");
    c("400 e 413: righe segnate «non inviata», non si riprovano", [2, true, true], [g.inviati.length, /non inviata: riga non leggibile/.test(g.segni()[0]), /non inviata: riga troppo lunga/.test(g.segni()[1])]);
  }
  {
    // frasi degli esiti
    const esiti = { ritorno: "contatto di ritorno", gia_ricevuto: "già ricevuto", gia_presente: "già nel CRM", scartata: "scartata: senza nome né telefono" };
    for (const [e, frase] of Object.entries(esiti)) {
      const g = google([INT, unaRiga("11")], {}, { rispondi: () => ({ codice: 200, corpo: { ok: true, esito: e } }) });
      g.vai("giroDiSicurezza");
      c(`esito «${e}» → «${frase}»`, frase, g.segni()[0].replace(/^[\d/: ]+· /, ""));
    }
  }
  {
    // righe ordinate durante un giro: i segni vanno per chiave, non per posizione
    const g = google([INT, unaRiga("11"), unaRiga("12", "Luca Prova")]);
    g.durante = (gg) => {
      // qualcuno ordina il foglio mentre il CRM sta rispondendo alla prima riga: le due si scambiano
      [gg.righe[1], gg.righe[2]] = [gg.righe[2], gg.righe[1]];
    };
    g.vai("giroDiSicurezza");
    c("righe scambiate durante l'invio: ognuna ha il suo segno, nessuna rimandata", [2, ["l:1000000000000011", "l:1000000000000012"]], [g.inviati.length, g.inviati.map((i) => i.corpo.valori[0])]);
    g.vai("giroDiSicurezza");
    c("…al giro dopo non riparte niente", [2, true], [g.inviati.length, g.segni().every((x) => /nuova scheda/.test(x))]);
  }
  {
    // 27/10/2026: Meta ha scritto il lead nuovo SOPRA la riga dei titoli
    const g = google([unaRiga("21", "Nuovo Sopra"), INT, unaRiga("11"), unaRiga("12", "Luca Prova")]);
    const metaPrima = JSON.stringify(g.righe);
    g.vai("giroDiSicurezza");
    c("titoli in riga 2: il lead sopra parte con i titoli giusti, la riga dei titoli no", [3, ["l:1000000000000021", "l:1000000000000011", "l:1000000000000012"], false],
      [g.inviati.length, g.inviati.map((i) => i.corpo.valori[0]), g.inviati.some((i) => i.corpo.valori.includes("created_time"))]);
    c("…i titoli mandati sono quelli della riga dei titoli", [...INT], g.inviati[0]?.corpo.intestazioni);
    c("…il lead sopra viaggia con riga 2 (il CRM vuole riga ≥ 2)", 2, g.inviati[0]?.corpo.riga);
    const m = mondo();
    const r = await manda(m, richiesta(g.inviati[0].corpo));
    c("…e la rotta vera lo accetta: scheda nuova", ["nuovo", 1], [r.json?.esito, m.schede.length]);
    c("…e la scheda di Meta non è stata toccata", metaPrima, JSON.stringify(g.righe));
  }
  {
    // la colonna dei segni di prima, se è rimasta nella scheda di Meta, non viaggia
    const g = google([[...INT, "Inviato al CRM"], [...unaRiga("11"), "26/10/2026 22:49 · nuova scheda"], [...unaRiga("12", "Luca Prova"), ""]]);
    g.vai("giroDiSicurezza");
    c("vecchia colonna: la riga già segnata lì NON si rimanda, quella senza segno sì", [1, "l:1000000000000012"], [g.inviati.length, g.inviati[0]?.corpo.valori[0]]);
    c("…il segno vecchio passa nella scheda «Invii al CRM»", true, /nuova scheda/.test(g.segni()[0]));
    c("vecchia colonna «Inviato al CRM»: non è fra i titoli né fra i valori mandati", [false, 5], [g.inviati[0]?.corpo.intestazioni.includes("Inviato al CRM"), g.inviati[0]?.corpo.valori.length]);
  }
  {
    // 27/10: Meta ha svuotato il titolo «id» in A e l'ha messo in fondo, su una colonna vuota
    const titoliRotti = ["", ...INT.slice(1), "id"];
    const g = google([unaRiga("21", "Nuovo Sopra"), titoliRotti, unaRiga("11")]);
    g.vai("giroDiSicurezza");
    const b0 = g.inviati[0]?.corpo;
    c("«id» spostato: la colonna senza titolo coi codici l:… viaggia come «id», l'«id» vuoto no", [[...INT], "l:1000000000000021"],
      [b0?.intestazioni, b0?.valori[b0?.intestazioni.indexOf("id")]]);
    const m = mondo();
    await manda(m, richiesta(b0));
    c("…e il CRM riceve l'id Meta del lead", "l:1000000000000021", m.schede[0]?.data.metaLeadId);
  }
  {
    // senza riga dei titoli non si manda niente
    const g = google([unaRiga("11"), unaRiga("12")]);
    g.vai("giroDiSicurezza");
    c("nessuna riga con «created_time»: non manda niente e lo dice", [0, true], [g.inviati.length, g.avvisi.some((a) => /titoli/.test(a))]);
  }
  {
    // un limite per giro, e il lucchetto
    const tante = Array.from({ length: 30 }, (_, i) => riga_(String(10 + i), "Mario Esempio"));
    const g = google([INT, ...tante], { GIA_PRESENTI_FATTO: "si" });
    g.vai("giroDiSicurezza");
    c("al massimo 20 righe per giro", 20, g.inviati.length);
    g.vai("giroDiSicurezza");
    c("…il giro dopo prende le altre 10", [30, true], [g.inviati.length, g.segni().every((s) => s !== "")]);
    const g2 = google([INT, unaRiga("11")]);
    g2.lucchettoLibero = false;
    g2.vai("giroDiSicurezza");
    c("c'è già un invio in corso (lucchetto): il giro non fa niente", 0, g2.inviati.length);
    const g3 = google([INT, ["", "", "", "", ""]]);
    g3.vai("giroDiSicurezza");
    c("una riga tutta vuota non si invia", 0, g3.inviati.length);
    const g4 = google([INT, ["l:1000000000000050", "2026-10-25T09:14:03+01:00", "x".repeat(900) + "ä".repeat(5000), "p:+393330000050", "CREATED"].map((v) => v)]);
    g4.vai("giroDiSicurezza");
    c("celle lunghe: tagliate a 1000 caratteri per cella", true, g4.inviati.every((i) => i.corpo.valori.every((v) => v.length <= 1000)));
  }
  {
    // la rotta accetta davvero quello che lo script manda (contratto)
    const g = google([INT, ...CINQUE.slice(0, 3).map((r, i) => [r[0], r[1], r[16], r[18], r[19]])]);
    g.vai("giroDiSicurezza");
    const m = mondo();
    const esiti = [];
    for (const i of g.inviati) esiti.push((await manda(m, richiesta(i.corpo))).json?.esito);
    c("i corpi dello script, dati alla rotta vera: tre schede nuove", [["nuovo", "nuovo", "nuovo"], 3], [esiti, m.schede.length]);
    c("…con nome, telefono e id Meta al loro posto", ["Mario", "+393330000101", "l:1000000000000011"], [m.schede[0].data.nome, m.schede[0].data.telefono, m.schede[0].data.metaLeadId]);
    const chiavi = g.inviati.map((i) => i.corpo.riga);
    c("…le righe del foglio viaggiano (2, 3, 4)", [2, 3, 4], chiavi);
  }
  void ADESSO;
  void IG;
}
