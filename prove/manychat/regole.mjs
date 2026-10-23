/** ── PROVE: CHI PUÒ RICEVERE ───────────────────────────────────────────────
 *
 *  File d'area della commessa 2026-10-23 (ManyChat), compito 2 (Dev A).
 *  Le regole di `regole.ts` e le variabili di `testi.ts`: il consenso, i
 *  lead importati, i lead del consulente, il numero, il freno «mai due volte
 *  senza risposta» (per TELEFONO), i campi che vanno su ManyChat.
 *  Tutte funzioni pure. Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs` (chiave
 *  `"manychat/<nome>"`). `aiuti`: `{ c, gruppo, radice }`. */
export async function proveRegole(mod, { c, gruppo }) {
  const R = mod["manychat/regole"];
  const T = mod["manychat/testi"];

  /* ── schede e persone inventate ────────────────────────────────────────── */
  const consulente = {
    id: "cons-1",
    data: { nome: "Giulia Demo", attivo: true, faConsulente: true, faSetter: false },
  };
  const setter = {
    id: "set-1",
    data: { nome: "Sara Demo", attivo: true, faConsulente: false, faSetter: true },
  };
  const spenta = {
    id: "cons-2",
    data: { nome: "Luca Demo", attivo: false, faConsulente: true, faSetter: false },
  };
  //  Una scheda mai compilata coi mestieri: vale il ripiego di `mestieriDi`
  //  («consulente sì»), così chi non ha mai aperto la scheda non sparisce.
  const vecchia = { id: "cons-3", data: { nome: "Piero Demo", attivo: true } };
  const tutti = [consulente, setter, spenta, vecchia];
  const lead = (data) => ({
    id: "lead-1",
    data: {
      nome: "Anna",
      cognome: "Prova",
      telefono: "333 000 0001",
      stato: "da_ricontattare",
      consulenteId: "cons-1",
      ...data,
    },
  });

  gruppo("MANYCHAT · CHI PUÒ RICEVERE (regole.ts)");

  /* ── consenso ──────────────────────────────────────────────────────────── */
  c(
    "senza niente: nessun consenso",
    { si: false, via: null, il: null, da: null },
    R.consensoWhatsapp({}),
  );
  c(
    "scheda null/undefined: nessun consenso",
    [false, false],
    [R.consensoWhatsapp(null).si, R.consensoWhatsapp(undefined).si],
  );
  c(
    "«Ok a WhatsApp» messo sulla scheda → consenso, con chi e quando",
    { si: true, via: "scheda", il: "2026-10-22T09:00:00.000Z", da: "Giulia Demo" },
    R.consensoWhatsapp({
      okWhatsapp: { si: true, il: "2026-10-22T09:00:00.000Z", da: "Giulia Demo" },
    }),
  );
  c(
    "…interruttore spento → niente",
    false,
    R.consensoWhatsapp({
      okWhatsapp: { si: false, il: "2026-10-22T09:00:00.000Z", da: "Giulia Demo" },
    }).si,
  );
  c(
    "la casella del modulo, quando un giorno ci sarà → consenso",
    { si: true, via: "modulo", il: "2026-10-01T08:00:00.000Z", da: null },
    R.consensoWhatsapp({ consensoModulo: { whatsapp: true, il: "2026-10-01T08:00:00.000Z" } }),
  );
  c(
    "…casella del modulo vuota o falsa → niente",
    [false, false],
    [
      R.consensoWhatsapp({ consensoModulo: {} }).si,
      R.consensoWhatsapp({ consensoModulo: { whatsapp: false } }).si,
    ],
  );
  c(
    "il consulente che SPEGNE «Ok a WhatsApp» batte la casella del modulo (revoca)",
    false,
    R.consensoWhatsapp({
      okWhatsapp: { si: false, il: "2026-10-23T09:00:00.000Z", da: "Giulia Demo" },
      consensoModulo: { whatsapp: true },
    }).si,
  );
  c(
    'un valore che non è proprio `true` non vale ("true", 1)',
    [false, false],
    [
      R.consensoWhatsapp({ okWhatsapp: { si: "true" } }).si,
      R.consensoWhatsapp({ okWhatsapp: { si: 1 } }).si,
    ],
  );

  /* ── lead importati ────────────────────────────────────────────────────── */
  c(
    "importato senza meet → è nella lista dei lead importati",
    true,
    R.eImportato({ data: { importato: true } }),
  );
  c(
    "importato con meet ma senza consulente → ancora importato",
    true,
    R.eImportato({ data: { importato: true, dataMeeting: "2026-10-24" } }),
  );
  c(
    "importato con meet E consulente → è uscito dalla lista",
    false,
    R.eImportato({ data: { importato: true, dataMeeting: "2026-10-24", consulenteId: "cons-1" } }),
  );
  c("non importato → no", false, R.eImportato({ data: { stato: "da_ricontattare" } }));

  /* ── lead del consulente ───────────────────────────────────────────────── */
  const eLC = (l) => R.eLeadDelConsulente(l, tutti);
  c(
    "i tre stati dei ricontatti sono dei consulenti",
    [true, true, true],
    [
      eLC(lead({ stato: "da_ricontattare" })),
      eLC(lead({ stato: "sta_valutando" })),
      eLC(lead({ stato: "fissa_meet_dopo" })),
    ],
  );
  c(
    "gli altri stati no (richiamo, ci ricontatta lui, appuntamento, perso)",
    [false, false, false, false],
    ["richiamo", "ci_ricontatta_lui", "appuntamento_fissato", "perso"].map((stato) =>
      eLC(lead({ stato })),
    ),
  );
  c("lead di un SETTER → no", false, eLC(lead({ consulenteId: "set-1" })));
  c("consulente non attivo → no", false, eLC(lead({ consulenteId: "cons-2" })));
  c("consulente che non esiste → no", false, eLC(lead({ consulenteId: "fantasma" })));
  c("senza consulente → no", false, eLC(lead({ consulenteId: null })));
  c(
    "consulente mai compilato coi mestieri → sì (ripiego di mestieriDi)",
    true,
    eLC(lead({ consulenteId: "cons-3" })),
  );
  c(
    "lead importato → no, anche nello stato giusto",
    false,
    eLC(lead({ importato: true, dataMeeting: undefined })),
  );
  c(
    "…ma importato che ha già meet e consulente è del consulente",
    true,
    eLC(lead({ importato: true, dataMeeting: "2026-10-24", consulenteId: "cons-1" })),
  );
  c("elenco dei consulenti vuoto → no", false, R.eLeadDelConsulente(lead({}), []));

  /* ── numero ────────────────────────────────────────────────────────────── */
  c("cellulare italiano → cifre col 39", "393330000001", R.numeroWa("333 000 0001"));
  c("con +39 e spazi → stesso numero", "393330000001", R.numeroWa("+39 333 000 0001"));
  c("scritto 0039 → stesso numero", "393330000001", R.numeroWa("0039 333 000 0001"));
  c(
    "un fisso o un numero corto → null",
    [null, null, null, null],
    [R.numeroWa("06 1234567"), R.numeroWa("123"), R.numeroWa(""), R.numeroWa(null)],
  );
  c(
    "le ultime nove cifre servono alle chiavi",
    ["330000001", ""],
    [R.ultimeNoveCifre("393330000001"), R.ultimeNoveCifre("12")],
  );

  /* ── il freno «mai due volte senza risposta», per TELEFONO ────────────── */
  const T0 = "2026-10-20T10:00:00.000Z";
  const dopo = (min) => new Date(Date.parse(T0) + min * 60_000).toISOString();
  const invio = (extra) => ({
    telefono: "393330000001",
    tipo: "ricontatto",
    stato: "inviato",
    prenotatoIl: T0,
    ...extra,
  });

  //  «Adesso» di serie: due ore dopo il primo invio (il freno scade solo dopo 7 giorni).
  const ADESSO = new Date(Date.parse(T0) + 120 * 60_000);
  const aspetta = (tel, invii, cont, adesso = ADESSO) =>
    R.aspettaRisposta(tel, invii, cont, adesso);

  c("nessun invio → non aspetta", false, aspetta("393330000001", [], undefined));
  c(
    "un ricontatto senza risposta → aspetta",
    true,
    aspetta("393330000001", [invio({})], undefined),
  );
  c(
    "…con la risposta → non aspetta",
    false,
    aspetta("393330000001", [invio({ rispostaIl: dopo(5) })], undefined),
  );
  c(
    "una conferma senza risposta conta (conferma + ricontatto = due messaggi senza risposta)",
    true,
    aspetta("393330000001", [invio({ tipo: "conferma" })], undefined),
  );
  c(
    "un promemoria senza risposta conta",
    true,
    aspetta("393330000001", [invio({ tipo: "promemoria" })], undefined),
  );
  c(
    "chat della setter, webinar e prove NON sono messaggi automatici del consulente",
    [false, false, false],
    ["chat", "webinar", "prova"].map((tipo) =>
      aspetta("393330000001", [invio({ tipo })], undefined),
    ),
  );
  c(
    "un invio fallito o saltato non è mai arrivato: non fa aspettare",
    [false, false],
    ["fallito", "saltato"].map((stato) => aspetta("393330000001", [invio({ stato })], undefined)),
  );
  c(
    "…prenotato e incerto invece sì (potrebbero essere arrivati)",
    [true, true],
    ["prenotato", "incerto"].map((stato) => aspetta("393330000001", [invio({ stato })], undefined)),
  );
  c(
    "è PER TELEFONO: l'invio di un altro numero non c'entra",
    false,
    aspetta("393330000002", [invio({})], undefined),
  );
  c(
    "…e due schede con lo stesso numero scritto in modo diverso sono lo stesso telefono",
    true,
    aspetta("3330000001", [invio({})], undefined),
  );
  c(
    "conta l'ULTIMO: il vecchio senza risposta, il nuovo con risposta → non aspetta",
    false,
    aspetta(
      "393330000001",
      [invio({}), invio({ prenotatoIl: dopo(60), rispostaIl: dopo(70) })],
      undefined,
    ),
  );
  c(
    "…il vecchio con risposta, il nuovo senza → aspetta",
    true,
    aspetta(
      "393330000001",
      [invio({ rispostaIl: dopo(5) }), invio({ prenotatoIl: dopo(60) })],
      undefined,
    ),
  );
  c(
    "l'ordine nell'elenco non conta, conta prenotatoIl",
    true,
    aspetta(
      "393330000001",
      [invio({ prenotatoIl: dopo(60) }), invio({ rispostaIl: dopo(5) })],
      undefined,
    ),
  );
  c(
    "una risposta arrivata dopo l'ultimo invio (anche su un'altra riga) lo sblocca",
    false,
    aspetta(
      "393330000001",
      [
        invio({}),
        invio({ prenotatoIl: dopo(60), tipo: "chat" }),
        invio({ tipo: "promemoria", prenotatoIl: dopo(30), rispostaIl: dopo(90) }),
      ],
      undefined,
    ),
  );
  c(
    "la riga sbloccata a mano (sbloccatoIl) non fa aspettare",
    false,
    aspetta("393330000001", [invio({ sbloccatoIl: dopo(10) })], undefined),
  );
  const contatto = (extra) => ({
    stato: "non_ha_risposto",
    il: dopo(1),
    da: "automatico",
    storia: [],
    ...extra,
  });
  c(
    "un cambio a mano DOPO l'ultimo invio (sbloccatoIl della scheda) sblocca",
    false,
    aspetta("393330000001", [invio({})], contatto({ sbloccatoIl: dopo(30) })),
  );
  c(
    "…un cambio a mano PRIMA dell'ultimo invio non sblocca quello nuovo",
    true,
    aspetta(
      "393330000001",
      [invio({ prenotatoIl: dopo(60) })],
      contatto({ sbloccatoIl: dopo(30) }),
    ),
  );
  c(
    "«Ha risposto» sulla scheda dopo l'invio sblocca",
    false,
    aspetta("393330000001", [invio({})], contatto({ stato: "ha_risposto", il: dopo(20) })),
  );
  c(
    "…«Ha risposto» di PRIMA dell'invio no",
    true,
    aspetta(
      "393330000001",
      [invio({ prenotatoIl: dopo(60) })],
      contatto({ stato: "ha_risposto", il: dopo(20) }),
    ),
  );
  c(
    "il ripristino da STOP (sbloccatoIl) sblocca",
    false,
    aspetta("393330000001", [invio({})], contatto({ stato: "contattato", sbloccatoIl: dopo(15) })),
  );
  c(
    "telefono vuoto o senza cifre → non aspetta (non c'è nessuno da frenare)",
    false,
    aspetta("", [invio({})], undefined),
  );
  //  Il freno scade (decisione del capo progetto).
  const giorni = (n) => new Date(Date.parse(T0) + n * 86_400_000);
  c("la costante: 7 giorni", 7, R.FRENO_SCADE_DOPO_GIORNI);
  c(
    "(b) 7 giorni senza risposta (qualunque tipo) → il freno non c'è più",
    [true, false],
    [
      aspetta("393330000001", [invio({})], undefined, new Date(giorni(7).getTime() - 1)),
      aspetta("393330000001", [invio({})], undefined, giorni(7)),
    ],
  );
  c(
    "…vale per ricontatto, conferma e promemoria",
    [false, false, false],
    ["ricontatto", "conferma", "promemoria"].map((tipo) =>
      aspetta("393330000001", [invio({ tipo })], undefined, giorni(8)),
    ),
  );
  const promemoria = (extra) =>
    invio({ tipo: "promemoria", chiave: "p|330000001|2026-10-20T15:30", ...extra });
  //  il meet delle 15:30 di Roma del 20/10 (ora legale) è alle 13:30Z
  c(
    "(a) promemoria senza risposta: finché il meet non è iniziato frena",
    true,
    aspetta("393330000001", [promemoria({})], undefined, new Date("2026-10-20T13:29:00.000Z")),
  );
  c(
    "(a) …iniziato il meet (15:30 di Roma) non frena più: il cliente si è collegato senza scrivere",
    false,
    aspetta("393330000001", [promemoria({})], undefined, new Date("2026-10-20T13:30:00.000Z")),
  );
  c(
    "(a) …vale solo per il promemoria: una conferma o un ricontatto con quella chiave strana no",
    [true, true],
    ["conferma", "ricontatto"].map((tipo) =>
      aspetta(
        "393330000001",
        [promemoria({ tipo })],
        undefined,
        new Date("2026-10-20T13:40:00.000Z"),
      ),
    ),
  );
  c(
    "(a) …un promemoria con la chiave illeggibile resta frenato fino ai 7 giorni",
    [true, false],
    [
      aspetta(
        "393330000001",
        [promemoria({ chiave: "boh" })],
        undefined,
        new Date("2026-10-21T13:40:00.000Z"),
      ),
      aspetta("393330000001", [promemoria({ chiave: null })], undefined, giorni(8)),
    ],
  );
  c(
    "(a) …il meet di un promemoria d'inverno si legge con l'ora solare (15:30 CET = 14:30Z)",
    [true, false],
    [
      aspetta(
        "393330000001",
        [
          promemoria({
            chiave: "p|330000001|2026-12-10T15:30",
            prenotatoIl: "2026-12-10T14:05:00.000Z",
          }),
        ],
        undefined,
        new Date("2026-12-10T14:29:00.000Z"),
      ),
      aspetta(
        "393330000001",
        [
          promemoria({
            chiave: "p|330000001|2026-12-10T15:30",
            prenotatoIl: "2026-12-10T14:05:00.000Z",
          }),
        ],
        undefined,
        new Date("2026-12-10T14:30:00.000Z"),
      ),
    ],
  );
  c(
    "interruttore di regola: il freno vale anche per il promemoria, finché il titolare non decide",
    true,
    R.FRENO_ANCHE_PER_PROMEMORIA,
  );

  /* ── testi.ts: le variabili dei due modelli (col Lei) ─────────────────── */
  gruppo("MANYCHAT · LE VARIABILI DEI MODELLI (testi.ts)");
  const meet = lead({
    stato: "appuntamento_fissato",
    dataMeeting: "2026-10-24",
    oraMeeting: "9:30",
    linkMeeting: "https://example.test/meetly/abc123",
  });
  const p = T.campiPromemoria(meet.data, "Giulia Demo", "lead-1");
  c(
    "promemoria → i quattro campi",
    ["campi", ["crm_nome", "crm_ora_meet", "crm_link_meet", "crm_consulente"]],
    [p.tipo, Object.keys(p.campi ?? {})],
  );
  c(
    "…nome, ora normalizzata e consulente",
    ["Anna", "09:30", "Giulia Demo"],
    [p.campi.crm_nome, p.campi.crm_ora_meet, p.campi.crm_consulente],
  );
  c("…il cognome NON va a ManyChat", false, JSON.stringify(p).includes("Prova"));
  c(
    "…il link è quello della stanza, con dentro chi lo riceve",
    true,
    /^https?:\/\/\S+meetly\/abc123\S*[?&]\S+/.test(p.campi.crm_link_meet),
  );
  c(
    "…senza l'id della scheda il link è quello della stanza, senza gettone",
    true,
    !/[?&]/.test(T.campiPromemoria(meet.data, "Giulia Demo").campi.crm_link_meet),
  );
  c(
    "link esterno scritto in scheda (non è una stanza nostra) → si usa così com'è",
    "https://meet.example.test/xyz",
    T.campiPromemoria(
      { ...meet.data, linkMeeting: "https://meet.example.test/xyz" },
      "Giulia Demo",
      "lead-1",
    ).campi.crm_link_meet,
  );
  const salta = (r) => [r.tipo, typeof r.motivo];
  c(
    "manca il link → salta (un modello col buco non parte)",
    ["salta", "string"],
    salta(T.campiPromemoria({ ...meet.data, linkMeeting: "" }, "Giulia Demo", "lead-1")),
  );
  c(
    "un appunto al posto del link («chiamo io») → salta",
    ["salta", "string"],
    salta(T.campiPromemoria({ ...meet.data, linkMeeting: "chiamo io" }, "Giulia Demo", "lead-1")),
  );
  c(
    "manca l'ora → salta",
    ["salta", "string"],
    salta(T.campiPromemoria({ ...meet.data, oraMeeting: "" }, "Giulia Demo", "lead-1")),
  );
  c(
    "manca il nome → salta",
    ["salta", "string"],
    salta(T.campiPromemoria({ ...meet.data, nome: "  " }, "Giulia Demo", "lead-1")),
  );
  c(
    "manca il consulente → salta",
    ["salta", "string"],
    salta(T.campiPromemoria(meet.data, "", "lead-1")),
  );
  c(
    "consulente null → salta",
    ["salta", "string"],
    salta(T.campiPromemoria(meet.data, null, "lead-1")),
  );
  c(
    "il nome con a-capo e spazi doppi esce ripulito (Meta rifiuta i parametri sporchi)",
    "Anna Maria",
    T.campiPromemoria({ ...meet.data, nome: "Anna\n  Maria" }, "Giulia Demo", "lead-1").campi
      .crm_nome,
  );

  const r = T.campiRicontatto(lead({}).data, "Giulia Demo");
  c(
    "ricontatto → nome e consulente, niente altro",
    ["campi", { crm_nome: "Anna", crm_consulente: "Giulia Demo" }],
    [r.tipo, r.campi],
  );
  c(
    "ricontatto senza nome → salta",
    ["salta", "string"],
    salta(T.campiRicontatto(lead({ nome: "" }).data, "Giulia Demo")),
  );
  c(
    "ricontatto senza consulente → salta",
    ["salta", "string"],
    salta(T.campiRicontatto(lead({}).data, undefined)),
  );

  c(
    "riconoscimento della risposta: lead, invio e telefono (solo cifre)",
    { crm_lead_id: "lead-1", crm_invio_id: "inv-1", crm_telefono: "393330000001" },
    T.campiDiRiconoscimento({ leadId: "lead-1", invioId: "inv-1", telefono: "+39 333 000 0001" }),
  );
  c(
    "…senza scheda (webinar, chat): niente crm_lead_id",
    { crm_invio_id: "inv-2", crm_telefono: "393330000001" },
    T.campiDiRiconoscimento({ invioId: "inv-2", telefono: "393330000001" }),
  );
  c(
    "campiPorta: solo i parametri del modello",
    { crm_v1: "Anna", crm_v2: "09:30" },
    T.campiPorta(["Anna", "09:30"]),
  );
  c("campiPorta: nessun parametro → nessun campo", {}, T.campiPorta([]));
  c(
    "campiPorta: quattro vanno",
    ["crm_v1", "crm_v2", "crm_v3", "crm_v4"],
    Object.keys(T.campiPorta(["a", "b", "c", "d"])),
  );
  let errore = null;
  try {
    T.campiPorta(["a", "b", "c", "d", "e"]);
  } catch (e) {
    errore = e.message;
  }
  c(
    "campiPorta: cinque → errore, mai un parametro tagliato",
    true,
    typeof errore === "string" && errore.length > 0,
  );
  c("mascheraNumero: «+39 333 ••• 0001»", "+39 333 ••• 0001", T.mascheraNumero("393330000001"));
  c("mascheraNumero: un numero corto non si legge mai intero", "•••", T.mascheraNumero("123"));
  c("mascheraNumero: vuoto → niente rotture", "•••", T.mascheraNumero(""));
  c(
    "mascheraNumero: un numero straniero non lascia il centro",
    "+44 ••• 6789",
    T.mascheraNumero("447700126789"),
  );
}
