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
  const CT = mod["manychat/contatto"];
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
      //  righe già in whatsapp_messages prima della richiesta (anche di altri canali)
      storia: o.storia ?? [],
      entrateLette: 0,
      schede: o.schede ?? [],
      rpc: [],
      avvisi: [],
      letture: 0,
      guasto: o.guasto ?? null,
      //  il secondo stato (compito 3)
      rispostaLog: [],
      contattoLog: [],
      ultimaRisposta: null,
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
          created_at: msg.adesso.toISOString(),
        });
        return "nuovo";
      },
      //  Le ultime entrate del numero (eco del Default Reply): le righe di
      //  `storia` (scritte da altri canali o prima) più quelle scritte qui,
      //  senza i doppioni, la più nuova per prima, al più 5.
      ultimeEntrate: async (userId, tel) => {
        m.letture++;
        if (m.guasto === "entrate") throw { code: "XX004", message: `dato ${TEL}` };
        m.entrateLette++;
        return [...m.storia, ...m.messaggi]
          .map((x, i) => ({ x, i }))
          .filter(
            ({ x }) =>
              x.user_id === userId &&
              x.direction === "inbound" &&
              formati(tel).includes(x.from_number) &&
              x.canale !== "baileys" &&
              !x.duplicato_di,
          )
          .sort((a, b) => Date.parse(b.x.created_at) - Date.parse(a.x.created_at) || b.i - a.i)
          .slice(0, 5)
          .map(({ x }) => ({
            testo: x.body ?? "",
            il: new Date(x.created_at),
            media: x.media_type ?? null,
          }));
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
      //  `manychat_risposta_arrivata`: la PRIMA risposta resta (coalesce) e l'ora va anche sul giro.
      rispostaArrivata: async (userId, invioId, adesso) => {
        if (m.guasto === "risposta_il") throw { code: "XX003", message: `dato ${TEL}` };
        m.rispostaLog.push({ userId, invioId });
        m.ultimaRisposta = adesso.toISOString();
        const i = invioId && m.invii.find((x) => x.id === invioId && x.userId === userId);
        if (i) i.rispostaIl ??= adesso.toISOString();
      },
      contattoDi: async (userId, leadId) => {
        if (m.guasto === "contatto") throw { code: "XX002", message: `dato ${TEL}` };
        const s = m.schede.find((x) => x.id === leadId && x.userId === userId);
        return s ? { contattoWa: s.data.contattoWa } : null;
      },
      //  `contatto_wa_aggiorna`, con la guardia dello STOP appiccicoso.
      scriviContatto: async (userId, leadId, cambio) => {
        const s = m.schede.find((x) => x.id === leadId && x.userId === userId);
        if (!s) return false;
        if (s.data.contattoWa?.stato === "stop" && cambio.patch.da === "automatico") return false;
        s.data.contattoWa = CT.applicaCambio(s.data.contattoWa, cambio);
        m.contattoLog.push(cambio.patch.stato);
        return true;
      },
      conferma: (userId, tel, adesso) => ({
        schedeConMessaggio: async () => {
          if (m.guasto === "schede") throw { code: "XX001" };
          return m.schede.filter((s) => s.userId === userId);
        },
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
              r.non_scrivere_dal = adesso.toISOString();
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
  //  ⚠️ CAMBIATA DI PROPOSITO (chat WhatsApp, PIANO D7/R4, prova 1 di 4): uno
  //  sconosciuto ora si registra, con la sua riga in rubrica.
  c(
    "numero sconosciuto, non in rubrica, nessun invio → registrata",
    [200, "registrata"],
    [r.stato, r.esito],
  );
  c(
    "…riga in whatsapp_messages e riga contatto creata",
    [1, 2, `+${TEL}`],
    [m.messaggi.length, m.contatti.length, m.contatti[1]?.phone_e164],
  );
  //  ⚠️ CAMBIATA DI PROPOSITO (PIANO D7/R4, prova 2 di 4): lo STOP di uno
  //  sconosciuto non si perde più, la riga nasce prima di `segnaStop`.
  m = mondo({ contatti: [{ user_id: "u-1", phone_e164: "+393339999999", lead_id: null }] });
  r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "stop" }) }));
  c(
    "STOP di uno sconosciuto: riga creata e non_scrivere_dal scritto",
    [2, ADESSO.toISOString(), undefined],
    [
      m.contatti.length,
      m.contatti.find((x) => x.phone_e164 === `+${TEL}`)?.non_scrivere_dal,
      m.contatti.find((x) => x.phone_e164 === "+393339999999")?.non_scrivere_dal,
    ],
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
  //  ⚠️ CAMBIATA DI PROPOSITO (PIANO D7/R4, prova 3 di 4): l'invio dell'altra
  //  installazione continua a non contare, ma il numero ora si registra per la
  //  SUA installazione (u-1). Niente deve finire nell'altra.
  c("un invio di un'altra installazione non conta, il numero si registra per la sua", "registrata", r.esito);
  c(
    "…tutto in u-1: nessuna riga, nessuna ora di risposta e nessuna scheda toccata nell'altra",
    [true, true, 0, undefined],
    [
      m.messaggi.every((x) => x.user_id === "u-1"),
      m.contatti.every((x) => x.user_id === "u-1"),
      m.rispostaLog.length,
      m.invii[0].rispostaIl,
    ],
  );

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

  /* ── id di ManyChat lunghi (17 cifre): testo, mai numero ─────────────── */
  const LUNGO = "12345678901234567";
  const LUNGO_VICINO = "12345678901234568";
  m = mondo({ invii: [invioConferma({ subscriberId: LUNGO })] });
  r = await RS.gestisciRisposta(
    m.porte,
    richiesta({ corpo: corpo({ subscriberId: LUNGO, telefono: "" }) }),
  );
  c("subscriber_id di 17 cifre: stesso id → abbinato", [200, 1], [r.stato, m.messaggi.length]);
  m = mondo({ invii: [invioConferma({ subscriberId: LUNGO })] });
  r = await RS.gestisciRisposta(
    m.porte,
    richiesta({ corpo: corpo({ subscriberId: LUNGO_VICINO, telefono: "" }) }),
  );
  c(
    "…id che differisce solo nell'ultima cifra → ignorata",
    ["ignorata", 0],
    [r.esito, m.messaggi.length],
  );

  /* ── la lettura delle schede fallisce: il SÌ non si perde in silenzio ─── */
  m = mondo({
    guasto: "schede",
    invii: [invioConferma()],
    contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }],
    schede: [scheda()],
  });
  r = await RS.gestisciRisposta(m.porte, richiesta());
  c(
    "database che non legge le schede → esito «errore», non «registrata»",
    [200, "errore"],
    [r.stato, r.esito],
  );
  c(
    "…con un avviso, e nessun dato del cliente",
    [true, false],
    [m.avvisi.length > 0, m.avvisi.join(" ").includes(TEL)],
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

  /* ═══════════════════════════════════════════════════════════════════════
   *  IL SECONDO STATO E L'ORA DELLA RISPOSTA (compito 3)
   * ═══════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · LA RISPOSTA E IL SECONDO STATO");
  {
    const ALTRO_LEAD = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
    const U_ALTRO_INVIO = "22222222-3333-4444-8555-666666666666";
    const stessa = () => {
      const s = scheda();
      s.data.contattoWa = {
        stato: "in_attesa",
        il: "2026-10-23T13:55:00.000Z",
        da: "automatico",
        motivo: "ricontatto",
        scadeRisposta: "2026-10-24T13:55:00.000Z",
        invioId: U_INVIO,
        storia: [],
      };
      return s;
    };
    const conInvio = (extra = {}) =>
      mondo({
        invii: [invioConferma({ tipo: "ricontatto", ...extra })],
        contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }],
        schede: [stessa()],
      });

    let m = conInvio();
    let r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO, testo: "ok ci sono, a dopo" }) }));
    let ct = m.schede[0].data.contattoWa;
    c("«Ha risposto» sulla scheda giusta, con l'anteprima del testo", ["ha_risposto", ADESSO.toISOString(), "automatico", "ok ci sono, a dopo"], [ct.stato, ct.il, ct.da, ct.storia[0].anteprima]);
    c("…l'invio resta quello del ricontatto (invioId conservato)", U_INVIO, ct.invioId);
    c("…l'ora della risposta va sull'invio e sul giro (è ciò che sblocca il freno)", [[U_INVIO], ADESSO.toISOString(), ADESSO.toISOString()], [m.rispostaLog.map((x) => x.invioId), m.invii[0].rispostaIl, m.ultimaRisposta]);

    //  La conferma «SÌ»: l'ora della risposta c'è anche per lei, e la conferma resta confermata.
    m = mondo({ invii: [invioConferma()], contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }], schede: [scheda()] });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO }) }));
    c("il SÌ della conferma: confermato E risposta_il sulla riga della conferma", ["confermato", ADESSO.toISOString()], [r.esito, m.invii[0].rispostaIl]);
    c("…e la scheda passa a «Ha risposto»", "ha_risposto", m.schede[0].data.contattoWa?.stato);
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO, testo: "grazie" }), adesso: new Date(ADESSO.getTime() + 5 * 60_000) }));
    c("una seconda risposta non sposta l'ora della prima (resta la PRIMA)", ADESSO.toISOString(), m.invii[0].rispostaIl);

    //  STOP.
    m = conInvio();
    await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO, testo: "non mi scrivete più" }) }));
    c("«non mi scrivete più» → la scheda va in STOP (e non resta «Ha risposto»)", "stop", m.schede[0].data.contattoWa.stato);
    c("…e non_scrivere_dal è scritto sul numero", ADESSO.toISOString(), m.contatti[0].non_scrivere_dal);

    //  Le frasi che NON sono STOP (disdire un appuntamento): né la scheda né il numero si chiudono.
    for (const testo of [
      "Scusi, cancellami l'appuntamento di domani",
      "puoi cancellarmi la prenotazione?",
      "non contattatemi prima delle 18",
      "toglietemi una curiosità: è doloroso?",
    ]) {
      m = conInvio();
      await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO, testo }) }));
      c(
        `«${testo}» NON è STOP: scheda «Ha risposto», nessun non_scrivere_dal`,
        ["ha_risposto", undefined],
        [m.schede[0].data.contattoWa.stato, m.contatti[0].non_scrivere_dal],
      );
    }
    for (const testo of ["cancellatemi", "non scrivetemi più"]) {
      m = conInvio();
      await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO, testo }) }));
      c(
        `«${testo}» resta STOP: scheda in STOP e numero chiuso`,
        ["stop", ADESSO.toISOString()],
        [m.schede[0].data.contattoWa.stato, m.contatti[0].non_scrivere_dal],
      );
    }

    //  STOP appiccicoso: una risposta qualunque non lo toglie.
    m = conInvio();
    m.schede[0].data.contattoWa = { stato: "stop", il: "2026-10-22T10:00:00.000Z", da: "Sara Demo", storia: [] };
    await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO, testo: "ok vi ricontatto io" }) }));
    c("scheda già in STOP: una risposta non la toglie", "stop", m.schede[0].data.contattoWa.stato);

    //  Messaggio di un altro contatto: ignorata, niente sulla scheda.
    m = conInvio();
    m.schede.push({ id: ALTRO_LEAD, userId: "u-1", data: { telefono: "333 999 0000", dataMeeting: "2026-10-24", oraMeeting: "16:00" } });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO, subscriberId: "2000002", telefono: "+393339990000", testo: "ciao" }) }));
    c("l'invio è di un altro contatto → ignorata", "ignorata", r.esito);
    c("…né la scheda dell'invio né l'altra cambiano, e nessuna ora di risposta", [undefined, "in_attesa", 0], [m.schede[1].data.contattoWa, m.schede[0].data.contattoWa.stato, m.rispostaLog.length]);

    //  Uno sconosciuto: niente.
    m = mondo({ schede: [stessa()] });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "ciao" }) }));
    //  ⚠️ CAMBIATA DI PROPOSITO (PIANO D7/R4, prova 4 di 4): lo sconosciuto ora si registra. L'esito è «risposta» (non «registrata») perché la scheda `stessa()` ha un promemoria in attesa e lo stesso telefono: la conferma lo trova per numero, come per ogni altro messaggio. Restano 0 ore di risposta e 0 secondi stati (nessun lead collegato).
    c("sconosciuto non in rubrica → registrato, nessuna ora di risposta, nessun secondo stato", ["risposta", 1, 0, 0], [r.esito, m.messaggi.length, m.rispostaLog.length, m.contattoLog.length]);

    //  Senza invio ma con un contatto noto (Default Reply): «Ha risposto» sulla scheda della rubrica, ora solo sul giro.
    m = mondo({ contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }], schede: [stessa()] });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ subscriberId: "", testo: "buongiorno" }) }));
    c("Default Reply di un contatto noto → «Ha risposto» sulla scheda della rubrica", ["risposta", "ha_risposto", [null]], [r.esito, m.schede[0].data.contattoWa.stato, m.rispostaLog.map((x) => x.invioId)]);

    //  La stessa risposta due volte: la storia si scrive UNA volta.
    m = conInvio();
    await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO }) }));
    await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: "" }) }));
    c("flusso + Default Reply: una voce di storia sola, un'ora sola", [1, 1], [m.schede[0].data.contattoWa.storia.length, m.rispostaLog.length]);

    //  Un guasto del secondo stato non perde il resto.
    m = mondo({ invii: [invioConferma()], contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }], schede: [scheda()], guasto: "contatto" });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO }) }));
    c("secondo stato guasto: la conferma resta confermata e il messaggio è nel registro", ["confermato", 1], [r.esito, m.messaggi.length]);
    c("…l'avviso porta il codice, mai il numero", [true, false], [/XX002/.test(m.avvisi.join(" ")), m.avvisi.join(" ").includes(TEL)]);
    m = mondo({ invii: [invioConferma()], contatti: [{ user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD }], schede: [scheda()], guasto: "risposta_il" });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ crmInvioId: U_INVIO }) }));
    c("l'ora della risposta non si scrive: la conferma e la scheda vanno avanti lo stesso", ["confermato", "ha_risposto"], [r.esito, m.schede[0].data.contattoWa?.stato]);
    c("…avviso con il solo codice", [true, false], [/XX003/.test(m.avvisi.join(" ")), m.avvisi.join(" ").includes(TEL)]);
    void U_ALTRO_INVIO;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   *  L'ECO DEL DEFAULT REPLY (29/10/2026, fix/manychat-eco)
   *  Con la coesistenza, ogni messaggio mandato dall'app WhatsApp Business fa
   *  ripartire il Default Reply di ManyChat con `{{Last Text Input}}`, che è
   *  ancora l'ultimo testo del CLIENTE (caso vero: testo delle 13:31, eco alle
   *  17:22:13 e alle 17:23:03 dopo due vocali del titolare). L'impronta per
   *  minuto non la ferma: il minuto è cambiato.
   * ═══════════════════════════════════════════════════════════════════════ */
  gruppo("MANYCHAT · L'ECO DEL DEFAULT REPLY");
  {
    const TESTO = "Buongiorno, volevo sapere i prezzi per il trattamento e se avete posto sabato";
    const PRIMA = new Date(ADESSO.getTime() - 4 * 3600e3).toISOString();
    const entrata = (o = {}) => ({
      user_id: "u-1",
      direction: "inbound",
      from_number: `+${TEL}`,
      to_number: "manychat",
      body: TESTO,
      canale: "manychat",
      created_at: PRIMA,
      ...o,
    });
    const uscita = (o = {}) => ({
      user_id: "u-1",
      direction: "outbound",
      from_number: "baileys",
      to_number: `+${TEL}`,
      body: "🎤 Vocale",
      canale: "baileys",
      media_type: "vocale",
      created_at: new Date(ADESSO.getTime() - 5_000).toISOString(),
      ...o,
    });
    const noto = () => [
      { user_id: "u-1", phone_e164: `+${TEL}`, lead_id: U_LEAD, last_message_at: PRIMA },
    ];
    const conAppuntamento = () => {
      const s = scheda();
      s.data.contattoWa = {
        stato: "in_attesa",
        il: PRIMA,
        da: "automatico",
        motivo: "ricontatto",
        storia: [],
      };
      return s;
    };

    //  Il caso vero: testo del cliente 4 ore fa (riga ManyChat + riga del ponte
    //  abbinata), poi un vocale dall'app, e 5 s dopo l'eco.
    let m = mondo({
      invii: [invioConferma()],
      contatti: noto(),
      schede: [conAppuntamento()],
      storia: [
        entrata(),
        entrata({
          canale: "baileys",
          to_number: "baileys",
          duplicato_di: "riga-mc",
          created_at: PRIMA,
        }),
        uscita(),
      ],
    });
    let r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "eco del Default Reply (stesso testo dell'ultima entrata, 4 ore fa) → «eco»",
      [200, "eco"],
      [r.stato, r.esito],
    );
    c("…nessuna riga nuova in whatsapp_messages", 0, m.messaggi.length);
    c(
      "…la rubrica non si muove (niente non letti, niente «Da rispondere»)",
      PRIMA,
      m.contatti[0].last_message_at,
    );
    c(
      "…né ora della risposta, né conferma, né secondo stato",
      [0, 0, "in_attesa"],
      [m.rispostaLog.length, m.rpc.length, m.schede[0].data.contattoWa.stato],
    );

    //  Due eco di fila (17:22:13 e 17:23:03): tutte e due scartate.
    r = await RS.gestisciRisposta(
      m.porte,
      richiesta({ corpo: corpo({ testo: TESTO }), adesso: new Date(ADESSO.getTime() + 50_000) }),
    );
    c(
      "la seconda eco, un minuto dopo → ancora «eco», sempre zero righe",
      ["eco", 0],
      [r.esito, m.messaggi.length],
    );

    //  L'eco di un «Sì» non riconferma, l'eco di uno STOP non rifà lo STOP.
    m = mondo({
      invii: [invioConferma()],
      contatti: noto(),
      schede: [scheda()],
      storia: [entrata({ body: "Sì" })],
    });
    r = await RS.gestisciRisposta(
      m.porte,
      richiesta({ corpo: corpo({ crmInvioId: U_INVIO, testo: "Sì" }) }),
    );
    c(
      "eco di un «Sì» vecchio → «eco», la conferma non gira",
      ["eco", 0, undefined],
      [r.esito, m.rpc.length, m.schede[0].data.promemoria.confermatoIl],
    );
    m = mondo({ contatti: noto(), storia: [entrata({ body: "STOP" })] });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "STOP" }) }));
    c(
      "eco di uno STOP vecchio → «eco», non_scrivere_dal non si scrive",
      ["eco", undefined],
      [r.esito, m.contatti[0].non_scrivere_dal],
    );

    //  Lo stesso testo scritto in modo un po' diverso (maiuscole, spazi, a capo).
    m = mondo({
      contatti: noto(),
      storia: [
        entrata({
          body: "  buongiorno,  VOLEVO sapere i prezzi per il trattamento\ne se avete posto sabato ",
        }),
      ],
    });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "ultimo testo con maiuscole, spazi e a capo diversi → «eco»",
      ["eco", 0],
      [r.esito, m.messaggi.length],
    );

    //  Le righe del ponte non le legge nessuna regola (I1): un testo uguale
    //  visto SOLO dal ponte non fa scartare niente.
    m = mondo({ contatti: noto(), storia: [entrata({ canale: "baileys", to_number: "baileys" })] });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "stesso testo solo in una riga del ponte (4 ore fa, visibile) → registrato",
      ["registrata", 1],
      [r.esito, m.messaggi.length],
    );

    //  `Last Text Input` è l'ultimo TESTO: una foto dopo il testo non lo cambia.
    m = mondo({
      contatti: noto(),
      storia: [
        entrata(),
        entrata({
          canale: "baileys",
          to_number: "baileys",
          body: "📷 Foto",
          media_type: "foto",
          created_at: new Date(ADESSO.getTime() - 3600e3).toISOString(),
        }),
        entrata({
          body: "[messaggio senza testo]",
          created_at: new Date(ADESSO.getTime() - 3599e3).toISOString(),
        }),
      ],
    });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "testo, poi una foto (ponte e ManyChat), poi l'eco del testo → «eco»",
      ["eco", 0],
      [r.esito, m.messaggi.length],
    );

    //  L'eco di un VOCALE: ManyChat rimanda il link del file (29/10/2026, caso vero).
    const LINK = "https://manybot-files.s3.example/vocale-123.ogg";
    m = mondo({
      contatti: noto(),
      storia: [
        entrata(),
        entrata({ body: LINK, created_at: new Date(ADESSO.getTime() - 1500e3).toISOString() }),
      ],
    });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: LINK }) }));
    c("eco del link di un vocale (ultima entrata) → «eco», niente riga", ["eco", 0], [r.esito, m.messaggi.length]);
    m = mondo({
      contatti: noto(),
      storia: [entrata({ body: LINK, created_at: new Date(ADESSO.getTime() - 1500e3).toISOString() })],
    });
    r = await RS.gestisciRisposta(
      m.porte,
      richiesta({ corpo: corpo({ testo: "https://manybot-files.s3.example/vocale-456.ogg" }) }),
    );
    c("un vocale NUOVO (link diverso) → registrato", ["registrata", 1], [r.esito, m.messaggi.length]);

    //  Un testo nuovo, diverso dall'ultimo: si registra come sempre.
    m = mondo({ contatti: noto(), storia: [entrata(), uscita()] });
    r = await RS.gestisciRisposta(
      m.porte,
      richiesta({ corpo: corpo({ testo: "perfetto, a sabato" }) }),
    );
    c(
      "testo diverso dall'ultima entrata → registrato",
      ["registrata", 1],
      [r.esito, m.messaggi.length],
    );
    c("…e la rubrica si aggiorna", ADESSO.toISOString(), m.contatti[0].last_message_at);

    //  Conta solo l'ULTIMA entrata: un testo uguale a uno più vecchio si registra.
    m = mondo({
      contatti: noto(),
      storia: [
        entrata(),
        entrata({ body: "grazie", created_at: new Date(ADESSO.getTime() - 3600e3).toISOString() }),
      ],
    });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "testo uguale a un'entrata vecchia ma NON all'ultima → registrato",
      ["registrata", 1],
      [r.esito, m.messaggi.length],
    );

    //  Una riga doppione (duplicato_di) non è «l'ultima entrata».
    m = mondo({ contatti: noto(), storia: [entrata({ duplicato_di: "x" })] });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "l'unica entrata uguale è un doppione (duplicato_di) → registrato",
      ["registrata", 1],
      [r.esito, m.messaggi.length],
    );

    //  Lo stesso messaggio visto PRIMA dal ponte (pochi secondi fa): la copia
    //  ManyChat del messaggio vero si registra.
    m = mondo({
      contatti: noto(),
      storia: [
        entrata({
          canale: "baileys",
          to_number: "baileys",
          created_at: new Date(ADESSO.getTime() - 8_000).toISOString(),
        }),
      ],
    });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "stesso testo arrivato dal ponte 8 s prima → è lo stesso messaggio: registrato",
      ["registrata", 1],
      [r.esito, m.messaggi.length],
    );

    //  Flusso + Default Reply a cavallo del minuto (impronte diverse): un solo messaggio.
    m = mondo({
      contatti: noto(),
      storia: [entrata({ created_at: new Date(ADESSO.getTime() - 25_000).toISOString() })],
    });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "stesso testo da ManyChat 25 s prima, minuto diverso → «doppione», nessuna riga",
      ["doppione", 0],
      [r.esito, m.messaggi.length],
    );

    //  LIMITE ACCETTATO (documentato): il cliente che riscrive DAVVERO lo stesso
    //  identico testo dopo più di 60 s, senza altro testo in mezzo, si perde nel
    //  registro ManyChat (col ponte acceso la riga del ponte resta visibile).
    m = mondo({
      contatti: noto(),
      storia: [
        entrata({ body: "ok", created_at: new Date(ADESSO.getTime() - 120_000).toISOString() }),
      ],
    });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "ok" }) }));
    c(
      "LIMITE: lo stesso «ok» riscritto davvero 2 minuti dopo → scartato come «eco»",
      "eco",
      r.esito,
    );

    //  Il controllo si guasta: si registra come prima (meglio un doppione di un
    //  messaggio perso) e l'avviso ha solo il codice.
    m = mondo({ contatti: noto(), storia: [entrata()], guasto: "entrate" });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "lettura delle entrate guasta → si registra lo stesso",
      ["registrata", 1],
      [r.esito, m.messaggi.length],
    );
    c(
      "…avviso col solo codice, mai il numero",
      [true, false],
      [/XX004/.test(m.avvisi.join(" ")), m.avvisi.join(" ").includes(TEL)],
    );

    //  Un testo vuoto (solo segnaposto, da un noto) non si confronta.
    m = mondo({ contatti: noto(), storia: [entrata({ body: "[messaggio senza testo]" })] });
    r = await RS.gestisciRisposta(
      m.porte,
      richiesta({ corpo: corpo({ testo: "{{last_input_text}}" }) }),
    );
    c(
      "segnaposto da un noto con l'ultima entrata senza testo → registrato come prima",
      ["registrata", 1],
      [r.esito, m.messaggi.length],
    );

    //  Né eco né doppione per un altro numero o un'altra installazione.
    m = mondo({
      contatti: noto(),
      storia: [entrata({ from_number: "+393339999999" }), entrata({ user_id: "u-2" })],
    });
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: TESTO }) }));
    c(
      "lo stesso testo di un altro numero o di un altro utente → registrato",
      ["registrata", 1],
      [r.esito, m.messaggi.length],
    );

    //  Uno sconosciuto con solo segnaposto si scarta PRIMA di leggere le entrate.
    m = mondo();
    r = await RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo({ testo: "{{x}}" }) }));
    c(
      "sconosciuto con solo segnaposto → «segnaposto», le entrate non si leggono",
      ["segnaposto", 0],
      [r.esito, m.entrateLette],
    );
  }
  /* ── nessuna chiamata fuori, mai ───────────────────────────────────── */
  c("in tutte le prove: nessuna chiamata esterna", 0, chiamateEsterne);
  globalThis.fetch = fetchVero;
  void RT;
}
