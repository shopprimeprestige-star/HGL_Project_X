/** ── PROVE: L'ADATTATORE (registro → configurazione del giro) ──
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T2. `configDalRegistro`
 *  (`src/crm/messaggi-automatici/adattatore.ts`, puro) costruisce dal registro la STESSA
 *  forma che il giro legge oggi, più `messaggiSpenti` e `avviso`. Si prova:
 *   - ogni tabella del seme (PIANO (b)): messaggio → campo del giro;
 *   - gli stati col loro ISO (`no_show` produce anche `non_fatto`);
 *   - le famiglie: `leadNuovoDal` è il più recente; `messaggiSpenti` dentro la scelta;
 *   - registro illeggibile = tutto spento + avviso; chiave ignota = spenta;
 *   - le vecchie colonne di `manychat_config` per i messaggi NON si leggono più.
 *
 *  Dati inventati. `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
export async function proveAdattatoreMessaggi(mod, { c, gruppo }) {
  const A = mod["messaggi-automatici/adattatore"];
  const K = mod["messaggi-automatici/catalogo"];

  /** Il registro intero (25 righe), tutto spento; `acceso` = { chiave: ISO | true | false }. */
  const registro = (acceso = {}) =>
    K.CHIAVI_MESSAGGI.map((chiave) => {
      const v = acceso[chiave];
      return {
        chiave,
        acceso: v !== undefined && v !== false,
        acceso_dal: typeof v === "string" ? v : null,
      };
    });
  const D1 = "2026-10-29T08:00:00.000Z";
  const D2 = "2026-10-30T09:30:00.000Z";
  const D3 = "2026-10-31T07:15:00.000Z";
  const riga = (extra = {}) => ({
    user_id: "u-1",
    canale: "manychat",
    acceso: true,
    promemoria: false,
    ricontatti: false,
    lead_nuovo: false,
    giorno_meet: false,
    lead_nuovo_dal: null,
    stati: {},
    indirizzo_sede: "  Via Roma 1, Milano ",
    tetti: { ricontatti: 5 },
    flussi: { hgl_promemoria_meet: "ns-1" },
    prima_accensione: "2026-10-01T08:00:00Z",
    ultima_accensione: "2026-10-10T08:00:00Z",
    fermato_motivo: null,
    controlli: null,
    ...extra,
  });
  const SEI = [
    "primo_contatto",
    "richiamo_24h",
    "ritorno",
    "casi_reali",
    "meet_oggi",
    "meet_domani",
  ];

  gruppo("MESSAGGI AUTOMATICI · ADATTATORE · REGISTRO → CONFIGURAZIONE");
  c("l'adattatore esporta configDalRegistro", "function", typeof A.configDalRegistro);

  // ── tutto spento ──────────────────────────────────────────────────────
  const spento = A.configDalRegistro(riga(), registro());
  c(
    "registro tutto spento: nessun interruttore, nessuna data, nessuno stato",
    [false, false, false, false, null, {}, null],
    [
      spento.promemoria,
      spento.ricontatti,
      spento.leadNuovo,
      spento.giornoMeet,
      spento.leadNuovoDal,
      spento.stati,
      spento.avviso,
    ],
  );
  c(
    "registro tutto spento: le sei chiavi di famiglia sono «spente» (il giro le toglie dalla scelta)",
    SEI,
    spento.messaggiSpenti,
  );
  c(
    "il registro letto → `sequenze` vero (il registro è il suo aggiornamento)",
    true,
    spento.sequenze,
  );

  // ── una tabella alla volta ────────────────────────────────────────────
  const pm = A.configDalRegistro(riga(), registro({ promemoria_meet: true }));
  c(
    "`promemoria_meet` acceso → `promemoria`; gli altri interruttori restano spenti",
    [true, false, false, false],
    [pm.promemoria, pm.ricontatti, pm.leadNuovo, pm.giornoMeet],
  );
  const rf = A.configDalRegistro(riga(), registro({ ricontatto_fissato: D2 }));
  c(
    "`ricontatto_fissato` acceso → `ricontatti`; `ultimaAccensione` = la più recente fra il generale (10/10) e la sua accensione",
    [true, D2],
    [rf.ricontatti, rf.ultimaAccensione],
  );
  c(
    "…se il generale è stato riacceso DOPO, vale quella data",
    "2026-10-31T10:00:00Z",
    A.configDalRegistro(
      riga({ ultima_accensione: "2026-10-31T10:00:00Z" }),
      registro({ ricontatto_fissato: D2 }),
    ).ultimaAccensione,
  );
  c(
    "…`ricontatto_fissato` spento: la sua data non conta, resta quella del generale",
    ["2026-10-10T08:00:00Z", false],
    ((x) => [x.ultimaAccensione, x.ricontatti])(A.configDalRegistro(riga(), registro())),
  );
  c(
    "…senza data di accensione del generale né del messaggio: `ultimaAccensione` nulla",
    null,
    A.configDalRegistro(riga({ ultima_accensione: null }), registro({ ricontatto_fissato: true }))
      .ultimaAccensione,
  );

  // ── le famiglie ───────────────────────────────────────────────────────
  const lead1 = A.configDalRegistro(riga(), registro({ primo_contatto: D1 }));
  c(
    "un solo messaggio del «lead nuovo» acceso → `leadNuovo` vero, `leadNuovoDal` = la sua data",
    [true, D1],
    [lead1.leadNuovo, lead1.leadNuovoDal],
  );
  c(
    "…gli altri tre della famiglia (e i due del meet) sono «spenti» per la scelta",
    ["richiamo_24h", "ritorno", "casi_reali", "meet_oggi", "meet_domani"],
    lead1.messaggiSpenti,
  );
  const lead3 = A.configDalRegistro(
    riga(),
    registro({ primo_contatto: D1, richiamo_24h: D3, casi_reali: D2 }),
  );
  c(
    "più messaggi della famiglia accesi: `leadNuovoDal` è il PIÙ RECENTE (riaccenderne uno sposta la data di tutti, nessuna ondata)",
    D3,
    lead3.leadNuovoDal,
  );
  c(
    "…e il solo spento è quello che manca, dentro la scelta",
    ["ritorno", "meet_oggi", "meet_domani"],
    lead3.messaggiSpenti,
  );
  const senzaData = A.configDalRegistro(riga(), registro({ primo_contatto: true }));
  c(
    "acceso ma senza data di accensione: `leadNuovo` vero e `leadNuovoDal` nullo (il giro non vede nessun lead «nuovo»: nessuna ondata)",
    [true, null],
    [senzaData.leadNuovo, senzaData.leadNuovoDal],
  );
  c(
    "una data illeggibile vale «nessuna data»; fra due messaggi vince quella leggibile",
    [null, D2],
    [
      A.configDalRegistro(riga(), registro({ ritorno: "ieri" })).leadNuovoDal,
      A.configDalRegistro(riga(), registro({ ritorno: "ieri", casi_reali: D2 })).leadNuovoDal,
    ],
  );
  const meet = A.configDalRegistro(riga(), registro({ meet_oggi: true }));
  c(
    "`meet_oggi` solo → `giornoMeet` vero; `meet_domani` è «spento»",
    [true, true, false],
    [
      meet.giornoMeet,
      meet.messaggiSpenti.includes("meet_domani"),
      meet.messaggiSpenti.includes("meet_oggi"),
    ],
  );
  c(
    "`meet_domani` solo → `giornoMeet` vero; `meet_oggi` è «spento»",
    [true, true],
    ((x) => [x.giornoMeet, x.messaggiSpenti.includes("meet_oggi")])(
      A.configDalRegistro(riga(), registro({ meet_domani: true })),
    ),
  );
  c(
    "tutti e sei accesi: `messaggiSpenti` vuoto",
    [],
    A.configDalRegistro(riga(), registro(Object.fromEntries(SEI.map((k) => [k, D1]))))
      .messaggiSpenti,
  );

  // ── gli stati ─────────────────────────────────────────────────────────
  const stati = A.configDalRegistro(
    riga(),
    registro({ "stato:sta_valutando": D1, "stato:richiamo": D2, "stato:irreperibile": D3 }),
  );
  c(
    "stati accesi → `stati[x]` = la loro data ISO, per nome (senza «stato:»)",
    { sta_valutando: D1, irreperibile: D3, richiamo: D2 },
    stati.stati,
  );
  c(
    "«Cliente assente» produce anche `non_fatto`, con la stessa data",
    { no_show: D2, non_fatto: D2 },
    A.configDalRegistro(riga(), registro({ "stato:no_show": D2 })).stati,
  );
  const senzaDataStato = A.configDalRegistro(riga(), registro({ "stato:sta_valutando": true }));
  c(
    "uno stato acceso ma senza data: resta SPENTO (mai «adesso») e c'è un avviso",
    [{}, true],
    [
      senzaDataStato.stati,
      typeof senzaDataStato.avviso === "string" && senzaDataStato.avviso.length > 0,
    ],
  );
  c(
    "uno stato con data illeggibile: spento e avviso",
    [{}, true],
    ((x) => [x.stati, !!x.avviso])(
      A.configDalRegistro(riga(), registro({ "stato:richiamo": "boh" })),
    ),
  );
  c(
    "il solo ricontatto fissato NON entra in `stati` (è `ricontatti`)",
    {},
    A.configDalRegistro(riga(), registro({ ricontatto_fissato: D1 })).stati,
  );
  const statiDelCatalogo = K.CATALOGO.filter(
    (v) => v.chiave.startsWith("stato:") && !v.bloccataDalCodice,
  );
  c(
    "ogni stato non bloccato del catalogo, se acceso, finisce in `stati` con la sua data",
    [],
    statiDelCatalogo
      .filter((v) => {
        const nome = v.chiave.slice(6);
        const fuori = A.configDalRegistro(riga(), registro({ [v.chiave]: D1 })).stati;
        return fuori[nome] !== D1;
      })
      .map((v) => v.chiave),
  );
  c(
    "gli stati e i messaggi bloccati dal codice (acconto, messaggio all'ora): anche se il database li dà accesi, non entrano",
    [{}, true],
    ((x) => [x.stati, x.avviso === null])(
      A.configDalRegistro(riga(), registro({ "stato:in_attesa_acconto": D1, meet_adesso: true })),
    ),
  );

  // ── il resto della riga resta com'è; i vecchi interruttori non si leggono ──
  const intera = A.configDalRegistro(riga(), registro());
  c(
    "canale, generale, indirizzo, tetti, flussi, prima accensione e fermo restano quelli di `manychat_config`",
    [
      "manychat",
      true,
      "Via Roma 1, Milano",
      { ricontatti: 5 },
      { hgl_promemoria_meet: "ns-1" },
      "2026-10-01T08:00:00Z",
      null,
    ],
    [
      intera.canale,
      intera.acceso,
      intera.indirizzoSede,
      intera.tetti,
      intera.flussi,
      intera.primaAccensione,
      intera.fermatoMotivo,
    ],
  );
  const vecchi = A.configDalRegistro(
    riga({
      promemoria: true,
      ricontatti: true,
      lead_nuovo: true,
      giorno_meet: true,
      lead_nuovo_dal: D3,
      stati: { sta_valutando: D1, no_show: D1 },
    }),
    registro(),
  );
  c(
    "le vecchie colonne (promemoria, ricontatti, lead nuovo, giorno del meet, stati) NON si leggono più: decide il registro",
    [false, false, false, false, null, {}],
    [
      vecchi.promemoria,
      vecchi.ricontatti,
      vecchi.leadNuovo,
      vecchi.giornoMeet,
      vecchi.leadNuovoDal,
      vecchi.stati,
    ],
  );
  c(
    "senza riga di `manychat_config` (mai scritta): canale cloud, generale spento; il registro vale lo stesso",
    ["cloud", false, true],
    ((x) => [x.canale, x.acceso, x.promemoria])(
      A.configDalRegistro(null, registro({ promemoria_meet: true })),
    ),
  );
  c(
    "`undefined` come riga: come senza riga",
    ["cloud", false],
    ((x) => [x.canale, x.acceso])(A.configDalRegistro(undefined, registro())),
  );

  // ── fail-closed ───────────────────────────────────────────────────────
  const guasto = A.configDalRegistro(riga({ promemoria: true, lead_nuovo: true }), null);
  c(
    "registro illeggibile (null): tutto spento, anche se le vecchie colonne dicono sì",
    [false, false, false, false, null, {}, false],
    [
      guasto.promemoria,
      guasto.ricontatti,
      guasto.leadNuovo,
      guasto.giornoMeet,
      guasto.leadNuovoDal,
      guasto.stati,
      guasto.sequenze,
    ],
  );
  c(
    "…le sei chiavi di famiglia sono «spente» e c'è una frase di avviso",
    [SEI, true],
    [guasto.messaggiSpenti, typeof guasto.avviso === "string" && guasto.avviso.length > 10],
  );
  c(
    "…il resto della riga (canale, generale) resta leggibile",
    ["manychat", true],
    [guasto.canale, guasto.acceso],
  );
  const ignote = A.configDalRegistro(riga(), [
    { chiave: "inventata", acceso: true, acceso_dal: D1 },
    { chiave: "stato:sconosciuto", acceso: true, acceso_dal: D1 },
    { chiave: "promemoria_meet", acceso: "true", acceso_dal: null },
    { chiave: "ricontatto_fissato", acceso: 1, acceso_dal: null },
  ]);
  c(
    "chiavi sconosciute ignorate; un «acceso» che non è `true` esatto vale spento; righe mancanti = spente",
    [false, false, {}, SEI],
    [ignote.promemoria, ignote.ricontatti, ignote.stati, ignote.messaggiSpenti],
  );
  c(
    "registro vuoto (tabella senza righe): tutto spento, nessun avviso (è solo un registro vuoto)",
    [false, null],
    ((x) => [x.promemoria, x.avviso])(A.configDalRegistro(riga(), [])),
  );
  c(
    "la funzione non cambia i dati che riceve",
    true,
    (() => {
      const r = registro({ primo_contatto: D1 });
      const copia = JSON.stringify(r);
      A.configDalRegistro(riga(), r);
      return JSON.stringify(r) === copia;
    })(),
  );
}
