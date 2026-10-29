/** ── LE PROVE DELLE TRE IDEE PER LE RIGHE DELLA CHAT (30/10/2026) ───────────
 *
 *  Commessa 2026-10-30-idee-chat, ramo idee-righe. Idea 1 (✓ Confermato / Da
 *  confermare nella riga), idea 7 (finestra in scadenza), idea 8 (wa.me col
 *  messaggio già scritto). `prove/prove.mjs` impacchetta `chatwa/segniRiga` e
 *  `chatwa/testoWhatsapp` e chiama `proveIdeeRighe(mod, { c, gruppo, radice })`.
 *  ⚠️ Un file solo, fuori da prove.mjs, così i rami delle altre idee non si
 *   pestano i piedi sul file grande.
 *  ───────────────────────────────────────────────────────────────────────── */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveIdeeRighe(mod, { c, gruppo, radice }) {
  const S = mod["chatwa/segniRiga"];
  const T = mod["chatwa/testoWhatsapp"];
  const A = mod["chatwa/apriWhatsapp"];
  const I = mod["promemoria/invio"];
  const src = (f) => readFileSync(join(radice, "src/crm/chatwa", f), "utf8");

  //  Venerdì 30/10/2026, 10:00 a Roma (ora solare dal 25/10) = 09:00 UTC.
  const adesso = new Date("2026-10-30T09:00:00Z");
  const scheda = (extra = {}) => ({
    nome: "Mario",
    cognome: "Rossi",
    telefono: "+39 339 1234567",
    stato: "appuntamento_fissato",
    dataMeeting: "2026-10-30",
    oraMeeting: "15:00",
    ...extra,
  });
  const conSi = (d) => ({
    ...d,
    promemoria: {
      stato: "inviato",
      chiave: I.chiaveAppuntamento(d),
      inviatoIl: "2026-10-30T07:00:00Z",
      confermatoIl: "2026-10-30T07:30:00Z",
    },
  });

  /* ── IDEA 1 · CONFERMA ────────────────────────────────────────────────── */
  gruppo("CHAT RIGHE · IDEA 1: «CONFERMATO» E «DA CONFERMARE»");
  c("ha confermato: ✓ Confermato", "confermato", S.segnoConferma(conSi(scheda()), adesso)?.tipo);
  c("testo del segno verde", "Confermato", S.segnoConferma(conSi(scheda()), adesso)?.testo);
  c(
    "promemoria non ancora partito: Da confermare",
    "daConfermare",
    S.segnoConferma(scheda(), adesso)?.tipo,
  );
  c("testo del segno arancione", "Da confermare", S.segnoConferma(scheda(), adesso)?.testo);
  const inviato = scheda();
  inviato.promemoria = {
    stato: "inviato",
    chiave: I.chiaveAppuntamento(inviato),
    inviatoIl: "2026-10-30T08:00:00Z",
  };
  c(
    "promemoria inviato senza risposta: Da confermare",
    "daConfermare",
    S.segnoConferma(inviato, adesso)?.tipo,
  );
  const risposto = scheda();
  risposto.promemoria = {
    stato: "inviato",
    chiave: I.chiaveAppuntamento(risposto),
    inviatoIl: "2026-10-30T07:00:00Z",
    rispostaIl: "2026-10-30T07:10:00Z",
    rispostaTesto: "non posso",
  };
  c(
    "ha risposto «non posso»: Da confermare",
    "daConfermare",
    S.segnoConferma(risposto, adesso)?.tipo,
  );
  c(
    "anche il rifissato",
    "confermato",
    S.segnoConferma(conSi(scheda({ stato: "appuntamento_rifissato" })), adesso)?.tipo,
  );
  c(
    "domani e fra 6 giorni: il segno c'è",
    [true, true],
    [
      S.segnoConferma(scheda({ dataMeeting: "2026-10-31" }), adesso) !== null,
      S.segnoConferma(scheda({ dataMeeting: "2026-11-05" }), adesso) !== null,
    ],
  );
  c("oltre 7 giorni: niente", null, S.segnoConferma(scheda({ dataMeeting: "2026-11-10" }), adesso));
  c(
    "ieri e oggi già passata: niente",
    [null, null],
    [
      S.segnoConferma(scheda({ dataMeeting: "2026-10-29" }), adesso),
      S.segnoConferma(scheda({ oraMeeting: "09:30" }), adesso),
    ],
  );
  c(
    "altri stati: niente",
    [null, null],
    [
      S.segnoConferma(scheda({ stato: "attesa_whatsapp" }), adesso),
      S.segnoConferma(scheda({ stato: "venduto" }), adesso),
    ],
  );
  c(
    "senza data, senza scheda: niente",
    [null, null, null],
    [
      S.segnoConferma(scheda({ dataMeeting: "" }), adesso),
      S.segnoConferma(undefined, adesso),
      S.segnoConferma(null, adesso),
    ],
  );
  c(
    "ora illeggibile: conta il giorno intero",
    "daConfermare",
    S.segnoConferma(scheda({ oraMeeting: "boh" }), adesso)?.tipo,
  );

  /* ── IDEA 7 · FINESTRA IN SCADENZA ────────────────────────────────────── */
  gruppo("CHAT RIGHE · IDEA 7: «CHIUDE TRA…» E L'ORDINE NEL FILTRO");
  const t0 = adesso.getTime();
  const chat = (phone, minutiAllaChiusura, extra = {}) => ({
    phone,
    lead: { data: { stato: "appuntamento_fissato" } },
    finestra: {
      aperta: true,
      frase: "x",
      scadeIl: new Date(t0 + minutiAllaChiusura * 60_000).toISOString(),
    },
    ...extra,
  });
  c(
    "3 ore e 20: «chiude tra 3h 20m»",
    "chiude tra 3h 20m",
    S.scadenzaFinestra(chat("a", 200), t0)?.testo,
  );
  c("tre ore giuste: «3h»", "chiude tra 3h", S.scadenzaFinestra(chat("a", 180), t0)?.testo);
  c("45 minuti: «45 min»", "chiude tra 45 min", S.scadenzaFinestra(chat("a", 45), t0)?.testo);
  c(
    "30 secondi: almeno «1 min»",
    "chiude tra 1 min",
    S.scadenzaFinestra(chat("a", 0.5), t0)?.testo,
  );
  c("quattro ore giuste: dentro", "chiude tra 4h", S.scadenzaFinestra(chat("a", 240), t0)?.testo);
  c("quattro ore e un minuto: fuori", null, S.scadenzaFinestra(chat("a", 241), t0));
  c(
    "già chiusa o chiude adesso: niente",
    [null, null],
    [S.scadenzaFinestra(chat("a", -5), t0), S.scadenzaFinestra(chat("a", 0), t0)],
  );
  c(
    "finestra chiusa (aperta=false): niente",
    null,
    S.scadenzaFinestra(
      chat("a", 60, {
        finestra: { aperta: false, frase: "x", scadeIl: new Date(t0 + 3_600_000).toISOString() },
      }),
      t0,
    ),
  );
  c(
    "senza scadeIl o con data rotta: niente",
    [null, null],
    [
      S.scadenzaFinestra(chat("a", 60, { finestra: { aperta: true, frase: "x" } }), t0),
      S.scadenzaFinestra(
        chat("a", 60, { finestra: { aperta: true, frase: "x", scadeIl: "ieri" } }),
        t0,
      ),
    ],
  );
  c(
    "altri stati e senza scheda: niente",
    [null, null],
    [
      S.scadenzaFinestra(chat("a", 60, { lead: { data: { stato: "attesa_whatsapp" } } }), t0),
      S.scadenzaFinestra(chat("a", 60, { lead: null }), t0),
    ],
  );
  c(
    "il rifissato conta",
    "chiude tra 1h",
    S.scadenzaFinestra(chat("a", 60, { lead: { data: { stato: "appuntamento_rifissato" } } }), t0)
      ?.testo,
  );
  const righe = [
    chat("lontana", 600),
    chat("tarda", 200),
    chat("presto", 20),
    chat("chiusa", -1),
    chat("media", 90),
  ];
  c(
    "in cima dalla scadenza più vicina, le altre escluse",
    ["presto", "media", "tarda"],
    S.ordinaPerScadenza(righe, t0).map((x) => x.phone),
  );
  c(
    "l'elenco di partenza non cambia",
    ["lontana", "tarda", "presto", "chiusa", "media"],
    righe.map((x) => x.phone),
  );
  c(
    "a parità di minuti resta l'ordine di prima",
    ["x", "y"],
    S.ordinaPerScadenza([chat("x", 30), chat("y", 30)], t0).map((r) => r.phone),
  );
  c(
    "restaInBreve",
    ["1 min", "59 min", "1h", "1h 1m", "4h"],
    [
      S.restaInBreve(0),
      S.restaInBreve(59),
      S.restaInBreve(60),
      S.restaInBreve(61),
      S.restaInBreve(240),
    ],
  );

  /* ── IDEA 8 · WA.ME CON IL MESSAGGIO GIÀ SCRITTO ──────────────────────── */
  gruppo("CHAT RIGHE · IDEA 8: WA.ME CON IL TESTO GIÀ SCRITTO");
  const android =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
  const tel = "+39 333 123 4567";
  const frase = "Buongiorno Mario, ci vediamo alle 15:00 & dopo è «bene»?";
  c("senza testo: wa.me come prima", "https://wa.me/393331234567", A.linkWaMe(tel));
  c(
    "testo vuoto o spazi: come senza",
    ["https://wa.me/393331234567", "https://wa.me/393331234567"],
    [A.linkWaMe(tel, ""), A.linkWaMe(tel, "   ")],
  );
  c(
    "con testo: ?text= codificato",
    "https://wa.me/393331234567?text=" + encodeURIComponent(frase),
    A.linkWaMe(tel, frase),
  );
  c("numero falso: nessun link, anche col testo", "", A.linkWaMe("123", frase));
  c(
    "iPhone: wa.me col testo",
    "https://wa.me/393331234567?text=" + encodeURIComponent(frase),
    A.linkApriWhatsapp(tel, iphone, frase),
  );
  const lAnd = A.linkApriWhatsapp(tel, android, frase);
  c(
    "Android: text= nell'intent, dopo il telefono",
    true,
    lAnd.startsWith(
      "intent://send/?phone=393331234567&text=" +
        encodeURIComponent(frase) +
        "#Intent;scheme=whatsapp;package=com.whatsapp.w4b;",
    ),
  );
  c(
    "Android: il ripiego wa.me porta lo stesso testo",
    true,
    lAnd.endsWith(
      "S.browser_fallback_url=" +
        encodeURIComponent("https://wa.me/393331234567?text=" + encodeURIComponent(frase)) +
        ";end",
    ),
  );
  c(
    "Android senza testo: l'intent di prima, uguale",
    "intent://send/?phone=393331234567#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=" +
      encodeURIComponent("https://wa.me/393331234567") +
      ";end",
    A.linkApriWhatsapp(tel, android),
  );
  c(
    "nel link non restano & o spazi del testo",
    true,
    !/[ &«]/.test(A.linkWaMe(tel, frase).split("?text=")[1]),
  );

  const lead = (d) => ({ data: d });
  const chatDi = (d, contact = null) => ({ lead: lead(d), contact });
  c(
    "oggi, link assente: promemoria della mattina",
    "promemoria_oggi",
    T.idPromemoria(scheda(), adesso),
  );
  c(
    "oggi, link presente ma lontano: ancora la mattina",
    "promemoria_oggi",
    T.idPromemoria(scheda({ linkMeeting: "https://meet.example/abc" }), adesso),
  );
  const quasi = (min) => new Date(new Date("2026-10-30T14:00:00Z").getTime() - min * 60_000); // consulenza alle 15:00 a Roma = 14:00 UTC
  c(
    "link e 35 minuti: link fra poco",
    "link_fra_poco",
    T.idPromemoria(scheda({ linkMeeting: "https://meet.example/abc" }), quasi(35)),
  );
  c(
    "link e 36 minuti: ancora la mattina",
    "promemoria_oggi",
    T.idPromemoria(scheda({ linkMeeting: "https://meet.example/abc" }), quasi(36)),
  );
  c(
    "senza link a 20 minuti: la mattina (mai {link} vuoto)",
    "promemoria_oggi",
    T.idPromemoria(scheda(), quasi(20)),
  );
  c("consulenza già iniziata: niente", null, T.idPromemoria(scheda(), quasi(-5)));
  c(
    "domani: promemoria del giorno prima",
    "promemoria_domani",
    T.idPromemoria(scheda({ dataMeeting: "2026-10-31" }), adesso),
  );
  c(
    "domani anche di sera tardi (23:30 a Roma)",
    "promemoria_domani",
    T.idPromemoria(scheda({ dataMeeting: "2026-10-31" }), new Date("2026-10-30T22:30:00Z")),
  );
  c(
    "dopodomani, ieri, senza ora, senza data: niente",
    [null, null, null, null],
    [
      T.idPromemoria(scheda({ dataMeeting: "2026-11-01" }), adesso),
      T.idPromemoria(scheda({ dataMeeting: "2026-10-29" }), adesso),
      T.idPromemoria(scheda({ oraMeeting: "" }), adesso),
      T.idPromemoria(scheda({ dataMeeting: "" }), adesso),
    ],
  );
  c(
    "altri stati: niente",
    [null, null],
    [
      T.idPromemoria(scheda({ stato: "attesa_whatsapp" }), adesso),
      T.idPromemoria(undefined, adesso),
    ],
  );

  const oggi = T.testoPerWhatsapp(chatDi(scheda()), "Giulia", adesso);
  c(
    "oggi: il testo della mattina, riempito",
    "Buongiorno Mario, ci vediamo oggi alle 15:00 per la consulenza online con Giulia.\n\nPoco prima le mando qui il link per collegarsi.",
    oggi,
  );
  c(
    "nome dal contatto se la scheda non ce l'ha",
    true,
    T.testoPerWhatsapp(
      chatDi(scheda({ nome: "" }), { display_name: "luca bianchi" }),
      "Giulia",
      adesso,
    ).startsWith("Buongiorno Luca,"),
  );
  c(
    "consulente ignoto: il ripiego del testo",
    true,
    T.testoPerWhatsapp(chatDi(scheda()), null, adesso).includes("con uno dei nostri consulenti"),
  );
  const dom = T.testoPerWhatsapp(
    chatDi(scheda({ dataMeeting: "2026-10-31", oraMeeting: "9:05" })),
    "Giulia",
    adesso,
  );
  c(
    "domani: giorno e ora a parole",
    true,
    dom.includes("di domani, sabato 31 ottobre alle 09:05 con Giulia"),
  );
  const fra = T.testoPerWhatsapp(
    chatDi(scheda({ linkMeeting: "https://meet.example/abc" })),
    "Giulia",
    quasi(20),
  );
  c(
    "link fra poco: il link c'è",
    true,
    fra.includes("Il link è questo: https://meet.example/abc") && fra.includes("alle 15:00"),
  );
  c(
    "nessun segnaposto rimasto nei testi buoni",
    [false, false, false],
    [oggi, dom, fra].map((t) => /\{[^{}]*\}/.test(t)),
  );
  c(
    "altri stati: nessun testo",
    "",
    T.testoPerWhatsapp(chatDi(scheda({ stato: "attesa_whatsapp" })), "Giulia", adesso),
  );
  c(
    "senza scheda: nessun testo",
    "",
    T.testoPerWhatsapp({ lead: null, contact: null }, "Giulia", adesso),
  );
  const custom = (testo) => [{ id: "promemoria_oggi", titolo: "x", testo }];
  c(
    "segnaposto rimasto ({indirizzo}): nessun testo",
    "",
    T.testoPerWhatsapp(
      chatDi(scheda()),
      "Giulia",
      adesso,
      custom("Ciao {nome}, vieni in {indirizzo}"),
    ),
  );
  c(
    "segnaposto del link non riempito: nessun testo",
    "",
    T.testoPerWhatsapp(chatDi(scheda()), "Giulia", adesso, custom("Ciao {nome}, il link: {link}")),
  );
  c(
    "risposta tolta dall'elenco: nessun testo",
    "",
    T.testoPerWhatsapp(chatDi(scheda()), "Giulia", adesso, []),
  );
  c(
    "testo troppo lungo: nessun testo",
    "",
    T.testoPerWhatsapp(chatDi(scheda()), "Giulia", adesso, custom("a".repeat(1200))),
  );
  c("testo di buona lunghezza dopo la codifica", true, encodeURIComponent(oggi).length < 600);

  /* ── IL COLLEGAMENTO NEI FILE ─────────────────────────────────────────── */
  gruppo("CHAT RIGHE · COLLEGAMENTO NEI COMPONENTI");
  const riga = src("RigaChat.tsx");
  const conv = src("Conversazione.tsx");
  const elenco = src("ElencoChat.tsx");
  c(
    "useChatWa copia scadeIl nella finestra",
    true,
    /finestra = \{ aperta: f\.aperta, frase: f\.frase, scadeIl: f\.scadeIl \}/.test(
      src("useChatWa.ts"),
    ),
  );
  c(
    "ChatItem.finestra ha scadeIl",
    true,
    /finestra\?: \{ aperta: boolean; frase: string; scadeIl\?: string \| null \}/.test(
      src("tipi.ts"),
    ),
  );
  c(
    "riga: segno di conferma e bollino «chiude tra»",
    true,
    /segnoConferma\(c\.lead\?\.data/.test(riga) &&
      /scadenzaFinestra\(c, adesso\)/.test(riga) &&
      /\{scadenza\.testo\}/.test(riga),
  );
  c(
    "riga: i segni non allargano la riga (stanno fra le pastiglie che vanno a capo)",
    true,
    /flex flex-wrap items-center[^"]*pl-\[68px\]/.test(riga) && /whitespace-nowrap/.test(riga),
  );
  c(
    "riga: il link col testo, solo a finestra chiusa",
    true,
    /testoPerWhatsapp\(c, nomeConsulente, new Date\(adesso\)\)/.test(riga) &&
      /finestra && !finestra\.aperta\s*\?\s*linkApriWhatsapp/.test(riga),
  );
  c(
    "intestazione della chat: lo stesso testo, solo a finestra chiusa",
    true,
    /attiva\.finestra\?\.aperta === false\s*\?\s*testoPerWhatsapp\(/.test(conv),
  );
  c(
    "elenco: «24h aperto» ha il riquadro delle scadenze in cima",
    true,
    /filtro === "aperto-24h"\s*\?\s*ordinaPerScadenza\(/.test(elenco) &&
      elenco.indexOf('id="titolo-in-scadenza"') < elenco.indexOf('id="titolo-da-rispondere"'),
  );
  c(
    "elenco: una chat in scadenza non si ripete negli altri riquadri",
    true,
    /!inScadenzaTel\.has\(c\.phone\)/.test(elenco) &&
      (elenco.match(/inScadenzaTel\.has/g) || []).length === 2,
  );
}
