/** ── PROVE: LA ROTTA DELLE RISPOSTE · CONFERMA, REGISTRO, STOP ──────────────────────────
 *
 *  Commessa 2026-10-23 (ManyChat), compito U2 (poi il 3 aggiunge il secondo
 *  stato). `gestisciRisposta` e `gestisciRichiesta` con un database finto in
 *  memoria: si controlla cosa scrive, cosa NON scrive, e che non chiami mai
 *  nessuno fuori (né ManyChat né altro: `fetch` qui è un allarme).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo }`. */
export async function proveRisposta(mod, { c, gruppo }) {
  const RS = mod["manychat/risposta"];
  const RT = mod["manychat/ritorno"];
  const IV = mod["promemoria/invio"];
  gruppo("MANYCHAT · LA ROTTA DELLE RISPOSTE");

  const ADESSO = new Date("2026-10-23T14:00:20Z");
  const TEL = "393331234567";
  const SUB = "1000001";
  const U_INVIO = "11111111-2222-4333-8444-555555555555";
  const U_LEAD = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const TOKEN = "t".repeat(64);

  //  ⚠️ Un allarme al posto di `fetch`: la rotta non deve chiamare NESSUNO.
  const fetchVero = globalThis.fetch;
  let chiamateEsterne = 0;
  globalThis.fetch = () => {
    chiamateEsterne++;
    throw new Error("la rotta delle risposte non deve chiamare nessuno");
  };

  /** Il mondo finto: le tabelle in memoria e le porte che le toccano. */
  function mondo(o = {}) {
    const m = {
      utente: o.utente === undefined ? "u-1" : o.utente,
      motivoSenzaUtente: o.motivoSenzaUtente ?? "non_configurato",
      invii: o.invii ?? [],
      contatti: o.contatti ?? [],
      messaggi: [],
      schede: o.schede ?? [],
      rpc: [],
      avvisi: [],
      letture: 0,
      guasto: o.guasto ?? null,
    };
    const formati = (tel) => [`+${tel}`, tel];
    m.porte = {
      avviso: (x) => m.avvisi.push(x),
      utente: async () => {
        m.letture++;
        return m.utente ? { userId: m.utente } : { userId: null, motivo: m.motivoSenzaUtente };
      },
      invii: async (cerca) => {
        m.letture++;
        if (m.guasto === "invii") throw { code: "XX000", message: `dato ${TEL} e parole` };
        return m.invii.filter(
          (i) =>
            i.userId === cerca.userId &&
            Date.parse(i.prenotatoIl) >= cerca.dal.getTime() &&
            (i.id === cerca.crmInvioId ||
              (cerca.subscriberId && i.subscriberId === cerca.subscriberId) ||
              (cerca.telefono && i.telefono === cerca.telefono)),
        );
      },
      contattoNoto: async (userId, tel) => {
        m.letture++;
        const r = m.contatti.find(
          (x) => x.user_id === userId && formati(tel).includes(x.phone_e164),
        );
        return r ? { leadId: r.lead_id ?? null } : null;
      },
      registraMessaggio: async (userId, msg) => {
        m.letture++;
        if (m.messaggi.some((x) => x.wa_message_id === msg.waId)) return "doppione";
        m.messaggi.push({
          user_id: userId,
          lead_id: msg.leadId,
          wa_message_id: msg.waId,
          direction: "inbound",
          from_number: `+${msg.telefono}`,
          to_number: "manychat",
          body: msg.testo,
          canale: "manychat",
        });
        return "nuovo";
      },
      aggiornaContatto: async (userId, x) => {
        const r = m.contatti.find(
          (y) => y.user_id === userId && formati(x.telefono).includes(y.phone_e164),
        );
        if (r) {
          r.last_message_at = x.adesso.toISOString();
          if (x.leadId && !r.lead_id) r.lead_id = x.leadId;
        } else
          m.contatti.push({
            user_id: userId,
            phone_e164: `+${x.telefono}`,
            lead_id: x.leadId,
            last_message_at: x.adesso.toISOString(),
          });
      },
      conferma: (userId, tel) => ({
        schedeConMessaggio: async () => m.schede.filter((s) => s.userId === userId),
        aggiorna: async (id, pezzo, seChiave) => {
          m.rpc.push({ id, pezzo, seChiave });
          const s = m.schede.find((x) => x.id === id);
          if (s && s.data.promemoria?.chiave === seChiave)
            s.data.promemoria = { ...s.data.promemoria, ...pezzo };
          return { error: null };
        },
        segnaStop: async () => {
          for (const r of m.contatti)
            if (r.user_id === userId && formati(tel).includes(r.phone_e164))
              r.non_scrivere_dal = ADESSO.toISOString();
          return { error: null };
        },
        avviso: (x) => m.avvisi.push(`conferma: ${x}`),
      }),
    };
    return m;
  }

  const corpo = (o = {}) => ({
    crmInvioId: "",
    crmLeadId: "",
    subscriberId: SUB,
    telefono: `+${TEL}`,
    testo: "Sì",
    ...o,
  });
  const richiesta = (o = {}) => ({
    chiaveOk: true,
    segretoPresente: true,
    corpo: corpo(),
    adesso: ADESSO,
    ...o,
  });
  const invioConferma = (o = {}) => ({
    id: U_INVIO,
    userId: "u-1",
    leadId: U_LEAD,
    telefono: TEL,
    subscriberId: SUB,
    prenotatoIl: "2026-10-23T13:55:00Z",
    stato: "inviato",
    ...o,
  });
  const scheda = (o = {}) => {
    const data = {
      telefono: "333 123 4567",
      dataMeeting: "2026-10-24",
      oraMeeting: "16:00",
      ...o,
    };
    data.promemoria = {
      stato: "inviato",
      chiave: IV.chiaveAppuntamento(data),
      ...(o.promemoria ?? {}),
    };
    return { id: U_LEAD, userId: "u-1", data };
  };

  /* ── 503 / 401 / 413 ─────────────────────────────────────────────────── */
  let m = mondo();
  let r = await RS.gestisciRisposta(
    m.porte,
    richiesta({ segretoPresente: false, chiaveOk: false }),
  );
  c("segreto assente sul server → 503", 503, r.stato);
  c("…e non tocca il database", 0, m.letture);
  r = await RS.gestisciRisposta(m.porte, richiesta({ segretoPresente: false, chiaveOk: true }));
  c("segreto assente → 503 comunque (porta chiusa)", 503, r.stato);

  r = await RS.gestisciRisposta(m.porte, richiesta({ chiaveOk: false }));
  c("senza la chiave giusta → 401", 401, r.stato);
  c("…e non tocca il database", [0, 0, 0], [m.letture, m.messaggi.length, m.rpc.length]);

  r = await RS.gestisciRisposta(m.porte, richiesta({ troppoGrande: true, corpo: null }));
  c("corpo oltre 8 KB (chiave giusta) → 413", 413, r.stato);
  r = await RS.gestisciRisposta(
    m.porte,
    richiesta({ troppoGrande: true, chiaveOk: false, corpo: null }),
  );
  c("corpo grande ma chiave sbagliata → 401, non 413", 401, r.stato);
  r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: null }));
  c(
    "corpo illeggibile (chiave giusta) → 200, niente scritto",
    [200, "illeggibile", 0],
    [r.stato, r.esito, m.letture],
  );

  /* ── installazione non pronta ─────────────────────────────────────────── */
  m = mondo({ utente: null });
  r = await RS.gestisciRisposta(m.porte, richiesta());
  c(
    "manychat_config senza riga → 200, niente scritto, avviso a codice",
    [200, "senza_configurazione", 0, 1],
    [r.stato, r.esito, m.messaggi.length, m.avvisi.length],
  );
  m = mondo({ utente: null, motivoSenzaUtente: "manca_migrazione" });
  await RS.gestisciRisposta(m.porte, richiesta());
  c("migrazione M1 non applicata → l'avviso lo dice", true, /migrazione/.test(m.avvisi.join(" ")));

  /* ── il SÌ della conferma ─────────────────────────────────────────────── */
  m = mondo({
    invii: [invioConferma()],
    contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }],
    schede: [scheda()],
  });
  r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO }) }));
  c("SÌ col telefono del corpo → «confermato»", [200, "confermato"], [r.stato, r.esito]);
  c(
    "…la scheda porta confermatoIl e «whatsapp», via promemoria_aggiorna con la chiave",
    [ADESSO.toISOString(), "whatsapp", true],
    [
      m.schede[0].data.promemoria.confermatoIl,
      m.schede[0].data.promemoria.confermatoVia,
      m.rpc[0].seChiave === m.schede[0].data.promemoria.chiave,
    ],
  );
  c("…un solo messaggio in entrata, nel registro", 1, m.messaggi.length);
  const riga = m.messaggi[0];
  c(
    "…col lead dell'invio, il numero del cliente e il canale",
    [U_LEAD, `+${TEL}`, "manychat", "inbound", "Sì", "u-1"],
    [riga.lead_id, riga.from_number, riga.canale, riga.direction, riga.body, riga.user_id],
  );
  c(
    "…wa_message_id = mc-in:<impronta di 32 esadecimali>",
    true,
    /^mc-in:[0-9a-f]{32}$/.test(riga.wa_message_id),
  );
  c(
    "…e la rubrica si aggiorna (ultimo messaggio)",
    ADESSO.toISOString(),
    m.contatti[0].last_message_at,
  );

  //  Lo stesso SÌ da due strade (flusso + Default Reply): una riga sola.
  const rpcPrima = m.rpc.length;
  r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: "" }) }));
  c(
    "la stessa risposta due volte (flusso + Default Reply) → «doppione»",
    [200, "doppione"],
    [r.stato, r.esito],
  );
  c("…UNA riga in whatsapp_messages", 1, m.messaggi.length);
  c("…e la conferma non gira due volte", rpcPrima, m.rpc.length);
  r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "Grazie" }) }));
  c("un'altra risposta dello stesso contatto → una riga nuova", 2, m.messaggi.length);
  c(
    "…un «grazie» dopo il sì non toglie la conferma",
    true,
    !!m.schede[0].data.promemoria.confermatoIl,
  );
  const dopoUnMinuto = new Date(ADESSO.getTime() + 60_000);
  await RS.gestisciRisposta(m.porte, richiesta({ adesso: dopoUnMinuto }));
  c("lo stesso testo un minuto dopo → è un'altra risposta", 3, m.messaggi.length);

  /* ── una risposta che non è un sì ───────────────────────────────────── */
  m = mondo({
    invii: [invioConferma()],
    contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }],
    schede: [scheda()],
  });
  r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "ok ma alle 16?" }) }));
  c(
    "«ok ma alle 16?» non conferma: va alla setter",
    ["risposta", undefined, "ok ma alle 16?"],
    [r.esito, m.schede[0].data.promemoria.confermatoIl, m.schede[0].data.promemoria.rispostaTesto],
  );

  /* ── STOP ────────────────────────────────────────────────────────────── */
  m = mondo({
    invii: [invioConferma()],
    contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }],
    schede: [scheda()],
  });
  r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "STOP" }) }));
  c(
    "STOP → non_scrivere_dal sul numero",
    [200, "stop", ADESSO.toISOString()],
    [r.stato, r.esito, m.contatti[0].non_scrivere_dal],
  );
  c("…la scheda segna stopIl", ADESSO.toISOString(), m.schede[0].data.promemoria.stopIl);
  c("…e il messaggio STOP è comunque nel registro", 1, m.messaggi.length);

  //  Contatto con il numero scritto senza «+» (righe vecchie): lo STOP lo trova.
  m = mondo({
    invii: [invioConferma()],
    contatti: [{ user_id: "u-1", phone_e164: TEL, lead_id: U_LEAD }],
  });
  await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "basta" }) }));
  c(
    "STOP su una riga vecchia senza «+» → segnata",
    ADESSO.toISOString(),
    m.contatti[0].non_scrivere_dal,
  );

  //  STOP da un cliente che c'è nel registro invii ma non ancora in rubrica:
  //  la riga si crea PRIMA, così non_scrivere_dal non si perde.
  m = mondo({ invii: [invioConferma()] });
  await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "stop" }) }));
  c(
    "STOP senza riga in rubrica → la riga nasce e porta non_scrivere_dal",
    [1, ADESSO.toISOString()],
    [m.contatti.length, m.contatti[0]?.non_scrivere_dal],
  );

  /* ── sconosciuti e contatti sbagliati ───────────────────────────────── */
  m = mondo({ contatti: [{ user_id: "u-1", phone_e164: "+393339999999", lead_id: null }] });
  r = await RS.gestisciRisposta(
    m.porte,
    richiesta({ corpo: corpo({ testo: "Salve, chi siete?" }) }),
  );
  c(
    "numero sconosciuto, non in rubrica, nessun invio → ignorata",
    [200, "ignorata"],
    [r.stato, r.esito],
  );
  c(
    "…niente registrato, niente aggiunto in rubrica",
    [0, 1],
    [m.messaggi.length, m.contatti.length],
  );
  r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "stop" }) }));
  c(
    "…nemmeno uno STOP di uno sconosciuto tocca qualcosa",
    [0, 1],
    [m.messaggi.length, m.contatti.length],
  );

  m = mondo({ contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }] });
  r = await RS.gestisciRisposta(
    m.porte,
    richiesta({ corpo: corpo({ testo: "Buongiorno", subscriberId: "" }) }),
  );
  c(
    "Default Reply di un numero già in rubrica → registrata",
    [200, "registrata", 1],
    [r.stato, r.esito, m.messaggi.length],
  );
  c("…col lead della rubrica", U_LEAD, m.messaggi[0].lead_id);

  m = mondo({
    invii: [invioConferma({ id: U_INVIO, subscriberId: "2000002", telefono: "393338888888" })],
    contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }],
    schede: [scheda()],
  });
  r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO }) }));
  c("crm_invio_id di un altro contatto → ignorata", [200, "ignorata"], [r.stato, r.esito]);
  c(
    "…niente registrato e la conferma non si tocca",
    [0, 0, undefined],
    [m.messaggi.length, m.rpc.length, m.schede[0].data.promemoria.confermatoIl],
  );

  m = mondo({ invii: [invioConferma({ userId: "u-2" })] });
  r = await RS.gestisciRisposta(m.porte, richiesta());
  c("un invio di un'altra installazione non conta", "ignorata", r.esito);

  m = mondo({ invii: [invioConferma()] });
  r = await RS.gestisciRisposta(
    m.porte,
    richiesta({ corpo: corpo({ telefono: "", subscriberId: SUB }) }),
  );
  c(
    "senza telefono nel corpo si usa quello dell'invio",
    [1, `+${TEL}`],
    [m.messaggi.length, m.messaggi[0]?.from_number],
  );

  /* ── errori: mai nei log il numero, il testo, il subscriber ─────────── */
  m = mondo({ guasto: "invii" });
  r = await RS.gestisciRisposta(
    m.porte,
    richiesta({ corpo: corpo({ testo: "frase del cliente" }) }),
  );
  c("database guasto → 200 comunque, esito «errore»", [200, "errore"], [r.stato, r.esito]);
  const avvisi = m.avvisi.join(" | ");
  c("…l'avviso porta il codice", true, /XX000/.test(avvisi));
  c(
    "…e non porta numero, testo o subscriber_id",
    [false, false, false],
    [avvisi.includes(TEL), avvisi.includes("frase del cliente"), avvisi.includes(SUB)],
  );

  //  Tutti gli avvisi di una giornata intera di casi: nessuno ha dati del cliente.
  m = mondo({
    invii: [invioConferma()],
    contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }],
    schede: [scheda()],
  });
  for (const t of ["Sì", "stop", "boh"])
    await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: t }) }));
  c("nessun avviso nei casi buoni", 0, m.avvisi.length);

  /* ── la rotta intera: Request → Response ────────────────────────────── */
  const chiamaRotta = async (
    mm,
    { token = TOKEN, segreto = TOKEN, corpoReq, intestazioni } = {},
  ) => {
    const h = { "content-type": "application/json", ...(intestazioni ?? {}) };
    if (token !== null) h["x-hgl-token"] = token;
    const req = new Request("https://sito.test/api/public/manychat-risposta", {
      method: "POST",
      headers: h,
      body: typeof corpoReq === "string" ? corpoReq : JSON.stringify(corpoReq ?? {}),
    });
    const { response, esito } = await RS.gestisciRichiesta(mm.porte, {
      request: req,
      segreto: segreto === null ? undefined : segreto,
      adesso: ADESSO,
    });
    return {
      stato: response.status,
      json: await response.json(),
      esito,
      tipo: response.headers.get("content-type"),
    };
  };
  const json = (o = {}) => ({
    crm_invio_id: U_INVIO,
    crm_lead_id: U_LEAD,
    subscriber_id: SUB,
    telefono: `+${TEL}`,
    testo: "Sì",
    ...o,
  });
  const nuovo = () =>
    mondo({
      invii: [invioConferma()],
      contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }],
      schede: [scheda()],
    });

  m = nuovo();
  let q = await chiamaRotta(m, { corpoReq: json() });
  c(
    "rotta: SÌ con la chiave giusta → 200 {ok:true}",
    [200, { ok: true }, "confermato"],
    [q.stato, q.json, q.esito],
  );
  c(
    "…JSON, e la scheda è confermata",
    [true, true],
    [/json/.test(q.tipo), !!m.schede[0].data.promemoria.confermatoIl],
  );

  m = nuovo();
  q = await chiamaRotta(m, { segreto: null, corpoReq: json() });
  c("rotta: MANYCHAT_RITORNO_TOKEN assente sul server → 503", 503, q.stato);
  q = await chiamaRotta(m, { segreto: "", corpoReq: json() });
  c("rotta: segreto vuoto → 503", 503, q.stato);
  q = await chiamaRotta(m, { token: null, corpoReq: json() });
  c("rotta: intestazione assente → 401", 401, q.stato);
  const q2 = await chiamaRotta(m, { token: "x".repeat(64), corpoReq: json() });
  c("rotta: chiave sbagliata → 401, stesso corpo dell'assente", [401, q.json], [q2.stato, q2.json]);
  q = await chiamaRotta(m, { token: TOKEN.slice(1), corpoReq: json() });
  c("rotta: chiave di lunghezza diversa → 401", 401, q.stato);
  c("…e in tutti questi casi non si tocca niente", [0, 0], [m.letture, m.messaggi.length]);

  q = await chiamaRotta(m, { corpoReq: JSON.stringify(json({ testo: "x".repeat(9000) })) });
  c("rotta: 9 KB con la chiave giusta → 413", 413, q.stato);
  q = await chiamaRotta(m, { corpoReq: "questo non è json {" });
  c(
    "rotta: corpo non JSON → 200 {ok:true}, niente scritto",
    [200, { ok: true }, 0],
    [q.stato, q.json, m.messaggi.length],
  );
  q = await chiamaRotta(m, { corpoReq: "[1,2,3]" });
  c(
    "rotta: JSON che non è un oggetto → 200, niente scritto",
    [200, 0],
    [q.stato, m.messaggi.length],
  );

  m = mondo({ guasto: "invii" });
  q = await chiamaRotta(m, { corpoReq: json() });
  c("rotta: database guasto → comunque 200 {ok:true}", [200, { ok: true }], [q.stato, q.json]);

  m = nuovo();
  q = await chiamaRotta(m, { corpoReq: json({ testo: "x".repeat(3000) }) });
  c(
    "rotta: testo lungo (sotto 8 KB) → tagliato a 2000 nel registro",
    2000,
    m.messaggi[0].body.length,
  );

  /* ── nessuna chiamata fuori, mai ───────────────────────────────────── */
  c("in tutte le prove: nessuna chiamata esterna", 0, chiamateEsterne);
  globalThis.fetch = fetchVero;
  void RT;
}
