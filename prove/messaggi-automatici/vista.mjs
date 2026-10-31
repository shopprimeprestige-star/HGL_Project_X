/** ── PROVE: LA VISTA DEL PANNELLO «MESSAGGI AUTOMATICI» ──────────────────────
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T7. Due parti:
 *   1. `messaggi-automatici/vista.ts` (puro): i sei momenti, l'anteprima dei testi,
 *      lo stato di ogni riga, le frasi di conferma (con quella per famiglia della
 *      nota N1 del revisore), gli errori (il 409 compreso), la fascia, le ultime
 *      modifiche;
 *   2. i sorgenti dei componenti, letti come testo: il pannello nuovo c'è ed è
 *      sotto il permesso «impostazioni»; i quattro riquadri vecchi NON accendono
 *      più i messaggi e rimandano al nuovo.
 *  Dati inventati, nessuna rete. La prova con il browser vero (clic, 409, errore di
 *  rete) è in `strumenti/` della commessa (Playwright, rotta intercettata).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveVistaMessaggi(mod, { c, gruppo, radice }) {
  const V = mod["messaggi-automatici/vista"];
  const K = mod["messaggi-automatici/catalogo"];
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  //  Una risposta della rotta: tutte spente tranne quelle dette. Dati inventati.
  const voce = (chiave, o = {}) => ({
    chiave,
    acceso: false,
    accesoDal: null,
    ultima: null,
    impedimento: null,
    ...o,
  });
  const risposta = (per = {}, resto = {}) => ({
    voci: K.CHIAVI_MESSAGGI.map((k) => voce(k, per[k] ?? {})),
    fascia: { generale: true, canale: "manychat", fermatoMotivo: null },
    ultime: [],
    ...resto,
  });
  const righe = (r) => V.raggruppa(r).flatMap((g) => g.righe);
  const riga = (r, k) => righe(r).find((x) => x.chiave === k);

  gruppo("MESSAGGI AUTOMATICI · PANNELLO · I SEI MOMENTI");
  const gr = V.raggruppa(risposta());
  c(
    "sei momenti, nell'ordine del piano",
    ["primo_contatto", "solleciti", "consulenza", "dopo_consulenza", "acconto_fattura", "webinar"],
    gr.map((g) => g.id),
  );
  c(
    "ogni momento ha il suo titolo",
    [
      "Primo contatto",
      "Solleciti",
      "Consulenza",
      "Dopo la consulenza",
      "Acconto e fattura",
      "Webinar",
    ],
    gr.map((g) => g.titolo),
  );
  c(
    "25 righe in tutto, ogni chiave in un solo momento",
    [25, 25],
    [
      gr.flatMap((g) => g.righe).length,
      new Set(gr.flatMap((g) => g.righe.map((x) => x.chiave))).size,
    ],
  );
  c(
    "quante righe per momento: 3, 8, 9, 2, 2, 1",
    [3, 8, 9, 2, 2, 1],
    gr.map((g) => g.righe.length),
  );
  c(
    "le righe di un momento stanno nell'ordine del catalogo",
    [],
    gr
      .filter((g) => {
        const att = K.CATALOGO.filter((v) => v.gruppo === g.id).map((v) => v.chiave);
        return JSON.stringify(att) !== JSON.stringify(g.righe.map((x) => x.chiave));
      })
      .map((g) => g.id),
  );
  c(
    "il conto degli accesi per momento",
    [2, 0, 0, 0, 0, 1],
    V.raggruppa(
      risposta({
        primo_contatto: { acceso: true },
        casi_reali: { acceso: true },
        webinar_in_diretta: { acceso: true },
      }),
    ).map((g) => g.accesi),
  );
  c(
    "una voce che la rotta non manda è spenta e ferma (si legge male = non si tocca)",
    [false, false],
    (() => {
      const r = risposta();
      r.voci = r.voci.filter((v) => v.chiave !== "ritorno");
      const x = riga(r, "ritorno");
      return [x.acceso, x.modificabile];
    })(),
  );

  gruppo("MESSAGGI AUTOMATICI · PANNELLO · NOME, ANTEPRIMA, QUANDO PARTE");
  const tutte = righe(risposta());
  c(
    "ogni riga ha nome, «quando parte» e almeno un'anteprima",
    [],
    tutte.filter((x) => !x.nome || !x.quando || x.anteprime.length === 0).map((x) => x.chiave),
  );
  c(
    "nessuna anteprima mostra un segnaposto grezzo ({{…}})",
    [],
    tutte.filter((x) => x.anteprime.some((a) => /\{\{|\}\}/.test(a.testo))).map((x) => x.chiave),
  );
  c(
    "…i segnaposto diventano [nome], [consulente], [data]…",
    [true, true],
    [
      /\[nome\]/.test(riga(risposta(), "primo_contatto").anteprime[0].testo),
      righe(risposta()).some((x) => x.anteprime.some((a) => /\[consulente\]/.test(a.testo))),
    ],
  );
  c(
    "il testo è quello del modello Meta del progetto (non inventato)",
    true,
    (() => {
      const W = mod["wa-meta-templates"];
      const corpo = W.findMetaTemplate("hgl_richiamo_24h").body.split("{{")[0].trim();
      return riga(risposta(), "richiamo_24h").anteprime[0].testo.startsWith(corpo);
    })(),
  );
  c(
    "il promemoria del giorno prima mostra il testo gratis e sotto la variante a pagamento, con il titolo",
    [2, true, true],
    (() => {
      const a = riga(risposta(), "meet_domani").anteprime;
      return [a.length, /gratis/i.test(a[0].titolo ?? ""), /pagamento/i.test(a[1].titolo ?? "")];
    })(),
  );
  c(
    "primo contatto e mattina del meet hanno due anteprime titolate; un messaggio semplice ne ha una senza titolo",
    [2, 2, 1, null],
    [
      riga(risposta(), "primo_contatto").anteprime.length,
      riga(risposta(), "meet_oggi").anteprime.length,
      riga(risposta(), "richiamo_24h").anteprime.length,
      riga(risposta(), "richiamo_24h").anteprime[0].titolo,
    ],
  );
  c(
    "senza modello (prenota in chat, webinar) si mostra la frase del catalogo",
    [true, true],
    ["prenota_chat", "webinar_in_diretta"].map(
      (k) =>
        riga(risposta(), k).anteprime[0].testo ===
        K.CATALOGO.find((v) => v.chiave === k).testoFisso,
    ),
  );
  c(
    "i messaggi per stato dicono che il consulente può scrivere il suo testo; gli altri no",
    [12, 0],
    [
      tutte.filter((x) => x.chiave.startsWith("stato:") && /consulente/i.test(x.notaTesto ?? ""))
        .length,
      tutte.filter((x) => !x.chiave.startsWith("stato:") && x.notaTesto).length,
    ],
  );

  gruppo("MESSAGGI AUTOMATICI · PANNELLO · LO STATO DI OGNI RIGA");
  const base = risposta({
    primo_contatto: { acceso: true },
    "stato:viene_in_sede": { impedimento: "Manca l'indirizzo della sede" },
    ritorno: { acceso: true, impedimento: "Manca la data della frase del modulo" },
  });
  c(
    "spenta e libera: si può accendere",
    ["spento", true, null],
    ((x) => [x.stato, x.modificabile, x.motivo])(riga(base, "richiamo_24h")),
  );
  c(
    "accesa: si può spegnere",
    ["acceso", true],
    ((x) => [x.stato, x.modificabile])(riga(base, "primo_contatto")),
  );
  c(
    "meet all'ora e acconto compaiono ma non si accendono, e dicono «nel codice»",
    [
      ["bloccato", false, true],
      ["bloccato", false, true],
    ],
    ["meet_adesso", "stato:in_attesa_acconto"].map((k) => {
      const x = riga(base, k);
      return [x.stato, x.modificabile, /codice/i.test(x.motivo ?? "")];
    }),
  );
  c(
    "…anche se la rotta le desse accese: non si toccano",
    false,
    riga(risposta({ meet_adesso: { acceso: true } }), "meet_adesso").modificabile,
  );
  c(
    "un impedimento (indirizzo sede, data della frase…) ferma l'accensione e dice la ragione",
    ["non_attivabile", false, "Manca l'indirizzo della sede"],
    ((x) => [x.stato, x.modificabile, x.motivo])(riga(base, "stato:viene_in_sede")),
  );
  c(
    "…ma una riga già accesa si può sempre spegnere",
    [true, "acceso"],
    ((x) => [x.modificabile, x.stato])(riga(base, "ritorno")),
  );
  c(
    "manca l'aggiornamento del database: nessuna riga si tocca, e lo dicono",
    [true, true],
    (() => {
      const r = righe(risposta({}, { mancaMigrazione: true }));
      const liberi = r.filter((x) => x.stato !== "bloccato");
      return [
        r.every((x) => !x.modificabile),
        liberi.every((x) => /database/i.test(x.motivo ?? "")),
      ];
    })(),
  );
  c(
    "«Spento da Filippo, 31/10 14:02» (ora di Roma) dal log",
    "Spento da Filippo, 31/10 14:02",
    riga(
      risposta({
        casi_reali: { ultima: { da: "Filippo", il: "2026-10-31T13:02:00.000Z", dopo: false } },
      }),
      "casi_reali",
    ).ultima,
  );
  c(
    "…«Acceso da …» se l'ultima modifica ha acceso; nessuna frase se il log non ha niente",
    ["Acceso da Giulia, 01/11 09:30", null],
    [
      riga(
        risposta({
          ritorno: { ultima: { da: "Giulia", il: "2026-11-01T08:30:00.000Z", dopo: true } },
        }),
        "ritorno",
      ).ultima,
      riga(risposta(), "ritorno").ultima,
    ],
  );

  gruppo("MESSAGGI AUTOMATICI · PANNELLO · LA CONFERMA PRIMA DI ACCENDERE");
  const LEAD = ["primo_contatto", "richiamo_24h", "ritorno", "casi_reali"];
  const testoDi = (cf) => [cf.titolo, ...cf.paragrafi, ...cf.avvisi].join(" ");
  c(
    "ogni messaggio che si accende ha la sua conferma, con il nome nel titolo",
    [],
    K.CATALOGO.filter((v) => !v.bloccataDalCodice)
      .filter((v) => {
        const cf = V.confermaAccensione(v.chiave, []);
        return (
          !cf.titolo.includes(v.nome) ||
          cf.paragrafi.length === 0 ||
          cf.paragrafi.some((p) => !p.trim())
        );
      })
      .map((v) => v.chiave),
  );
  c(
    "le quattro del «lead nuovo» (N1): con un'altra già accesa la conferma dice che la data riparte per tutte",
    [true, true, true],
    (() => {
      const t = testoDi(V.confermaAccensione("casi_reali", ["primo_contatto"]));
      return [
        /data di partenza/i.test(t),
        /già in sequenza non riceverà il richiamo/i.test(t),
        /entrato di notte/i.test(t),
      ];
    })(),
  );
  c(
    "…e nomina quelle già accese (per loro la data si sposta)",
    true,
    /Primo contatto/.test(testoDi(V.confermaAccensione("ritorno", ["primo_contatto"]))),
  );
  c(
    "…vale per tutte e quattro, e solo per loro",
    [LEAD.map(() => true), false, false],
    [
      LEAD.map((k) =>
        /già in sequenza non riceverà il richiamo/i.test(
          testoDi(
            V.confermaAccensione(
              k,
              LEAD.filter((x) => x !== k),
            ),
          ),
        ),
      ),
      /già in sequenza non riceverà/i.test(
        testoDi(V.confermaAccensione("meet_oggi", ["primo_contatto"])),
      ),
      /data di partenza dei quattro/i.test(
        testoDi(V.confermaAccensione("stato:no_show", ["primo_contatto"])),
      ),
    ],
  );
  c(
    "se nessuna della famiglia è accesa, la frase non spaventa a vuoto ma dice da quando vale",
    [false, true],
    (() => {
      const t = testoDi(V.confermaAccensione("primo_contatto", []));
      return [/già in sequenza non riceverà il richiamo/i.test(t), /da adesso in poi/i.test(t)];
    })(),
  );
  c(
    "un messaggio per stato dice che le schede già in quello stato non ricevono niente",
    true,
    /già in questo stato non ricevono niente/i.test(
      testoDi(V.confermaAccensione("stato:no_show", [])),
    ),
  );
  c(
    "conferma e fattura: chi c'è già non riceve niente",
    [true, true],
    [
      /già un appuntamento in agenda non riceve/i.test(
        testoDi(V.confermaAccensione("conferma_consulenza", [])),
      ),
      /già un acconto non riceve/i.test(testoDi(V.confermaAccensione("dati_fattura", []))),
    ],
  );
  c("il bottone dice «Accendi»", "Accendi", V.confermaAccensione("ritorno", []).etichetta);

  gruppo("MESSAGGI AUTOMATICI · PANNELLO · ERRORI, FASCIA, ULTIME MODIFICHE");
  c(
    "409: «è cambiato nel frattempo», si ricarica",
    true,
    /cambiato nel frattempo/i.test(V.fraseErrore(409, "Nel frattempo è cambiato: ricarica")),
  );
  c(
    "409 «Spento nel codice»: non è un conflitto, si dice il vero motivo",
    [true, false],
    [
      /codice/i.test(V.fraseErrore(409, "Spento nel codice")),
      /cambiato nel frattempo/i.test(V.fraseErrore(409, "Spento nel codice")),
    ],
  );
  c(
    "403 / 400 / rete / altro: ognuno la sua frase",
    [true, true, true, true],
    [
      /impostazioni/i.test(V.fraseErrore(403, "x")),
      /non è valida/i.test(V.fraseErrore(400, "x")),
      /non risponde/i.test(V.fraseErrore(0, "x")),
      V.fraseErrore(500, "boom <script>").length > 0,
    ],
  );
  c(
    "l'errore del server non finisce nella frase (può contenere dati)",
    false,
    /boom|script/i.test(V.fraseErrore(500, "boom <script>")),
  );
  c(
    "la rotta risponde 409 solo con la frase del conflitto: si riconosce il conflitto anche dallo stato",
    true,
    V.eConflitto(409) && !V.eConflitto(500),
  );
  const f = (o) =>
    V.fraseFascia({ generale: true, canale: "manychat", fermatoMotivo: null, ...o }, false);
  c("tutto in ordine: verde", "verde", f({}).tono);
  c(
    "generale spento: ambra, dice che il giro non scrive",
    ["ambra", true],
    ((x) => [x.tono, /non partono/i.test(x.frase)])(f({ generale: false })),
  );
  c(
    "canale Cloud API: lo dice, il giro non scrive",
    true,
    /Cloud API/.test(f({ canale: "cloud" }).frase),
  );
  c(
    "fermo automatico: rosso, col motivo",
    ["rosso", true],
    ((x) => [x.tono, /doppio invio/.test(x.frase)])(f({ fermatoMotivo: "doppio invio" })),
  );
  c(
    "manca la migrazione: rosso, la frase del database",
    ["rosso", true],
    ((x) => [x.tono, /aggiornamento del database/i.test(x.frase)])(
      V.fraseFascia({ generale: true, canale: "manychat", fermatoMotivo: null }, true),
    ),
  );
  c(
    "una riga del log: ora di Roma, chi, cosa, quale messaggio",
    "31/10 14:02 · Filippo ha spento «Sollecito dopo 24 ore»",
    V.fraseModifica({
      chiave: "richiamo_24h",
      prima: true,
      dopo: false,
      da: "Filippo",
      il: "2026-10-31T13:02:00.000Z",
    }),
  );
  c(
    "…una chiave che il catalogo non conosce non rompe l'elenco",
    true,
    /un messaggio/i.test(
      V.fraseModifica({
        chiave: "boh",
        prima: false,
        dopo: true,
        da: "Giulia",
        il: "2026-10-31T13:02:00.000Z",
      }),
    ),
  );

  gruppo("MESSAGGI AUTOMATICI · PANNELLO · I SORGENTI (nuovo pannello, vecchi riquadri)");
  const nuovo = leggi("src/crm/MessaggiAutomaticiPannello.tsx");
  const nuovoC = senzaCommenti(nuovo);
  const imp = leggi("src/routes/CRM.impostazioni.tsx");
  c(
    "il pannello nuovo parla solo con la rotta del CRM, col gettone, e non tocca il database dal browser",
    [true, true, false],
    [
      nuovoC.includes("/api/crm/messaggi-automatici"),
      /fetchCRM\(/.test(nuovoC),
      /supabase|app_config/.test(nuovoC),
    ],
  );
  c(
    "è visibile solo con il permesso «impostazioni»",
    true,
    /usePuo\(\)\("impostazioni"\)/.test(nuovoC) && /if \(!puo\w*\) return null/.test(nuovoC),
  );
  c(
    "gli hook stanno tutti sopra l'uscita anticipata",
    true,
    (() => {
      const i = nuovoC.indexOf("if (!puo");
      return i > 0 && !/\buse(State|Effect|Callback|Memo|Ref)\(/.test(nuovoC.slice(i));
    })(),
  );
  c(
    "usa gli interruttori della casa, la finestra di conferma e manda `prima` (il compare-and-set)",
    [true, true, true],
    [nuovoC.includes("<Switch"), nuovoC.includes("<Finestra"), /prima:/.test(nuovoC)],
  );
  c(
    "il 409 si mostra (avviso nella riga) e si rilegge",
    [true, true],
    [/role="alert"/.test(nuovoC), /eConflitto\(/.test(nuovoC)],
  );
  c(
    "il pannello nuovo è il PRIMO della scheda WhatsApp, una volta sola",
    [1, true],
    [
      (imp.match(/<MessaggiAutomaticiPannello \/>/g) ?? []).length,
      /<MessaggiAutomaticiPannello \/>\s*<WhatsAppSettingsSection \/>/.test(imp),
    ],
  );
  const vecchi = {
    "src/crm/ManychatPannello.tsx": leggi("src/crm/ManychatPannello.tsx"),
    "src/crm/PromemoriaWhatsappPannello.tsx": leggi("src/crm/PromemoriaWhatsappPannello.tsx"),
    "src/crm/DatiFatturaPannello.tsx": leggi("src/crm/DatiFatturaPannello.tsx"),
    "src/crm/PrenotaChatPannello.tsx": leggi("src/crm/PrenotaChatPannello.tsx"),
  };
  c(
    "nessun riquadro vecchio comanda più i messaggi: niente `interruttori` (salvo il generale), niente `stati` verso salvaManychat",
    [],
    Object.entries(vecchi)
      .filter(([, t]) => {
        const s = senzaCommenti(t);
        return (
          /interruttori:\s*\{\s*\[(?!chiave)/.test(s) ||
          /interruttori:\s*\{\s*(promemoria|ricontatti|leadNuovo|giornoMeet)/.test(s) ||
          /\bstati:\s*\{\s*\[/.test(s) ||
          /imposta\("(promemoria|ricontatti|leadNuovo|giornoMeet)"/.test(s) ||
          /accendiStato/.test(s)
        );
      })
      .map(([f]) => f),
  );
  c(
    "il generale resta in ManyChatPannello (è l'unico interruttore rimasto lì)",
    [true, 1],
    (() => {
      const s = senzaCommenti(vecchi["src/crm/ManychatPannello.tsx"]);
      return [/onCambia=\{impostaGenerale\}/.test(s), (s.match(/<Interruttore\b/g) ?? []).length];
    })(),
  );
  c(
    "conferma, fattura, prenota in chat: niente più Switch dell'«acceso» né scrittura di `acceso`",
    [],
    [
      "src/crm/PromemoriaWhatsappPannello.tsx",
      "src/crm/DatiFatturaPannello.tsx",
      "src/crm/PrenotaChatPannello.tsx",
    ].filter((f) => {
      const s = senzaCommenti(vecchi[f]);
      const switches = [...s.matchAll(/<Switch[^>]*>/g)].map((m) => m[0]);
      return (
        switches.some(
          (x) =>
            !/modelloApprovato/.test(x) &&
            !/modelloApprovato/.test(s.slice(s.indexOf(x), s.indexOf(x) + 200)),
        ) ||
        /(chiedi|cambia)\(\{\s*acceso/.test(s) ||
        /JSON\.stringify\(\{\s*acceso/.test(s)
      );
    }),
  );
  c(
    "…resta in DatiFattura lo Switch del modello approvato (non è un messaggio)",
    true,
    /modelloApprovato:\s*v/.test(vecchi["src/crm/DatiFatturaPannello.tsx"]),
  );
  c(
    "ogni riquadro vecchio rimanda a «Messaggi automatici»",
    [],
    Object.entries(vecchi)
      .filter(([, t]) => !/RimandoMessaggiAutomatici/.test(t))
      .map(([f]) => f),
  );
  c(
    "il rimando c'è nel pannello nuovo (esportato) e porta al riquadro",
    [true, true],
    [
      /export function RimandoMessaggiAutomatici/.test(nuovoC),
      /id=\{?"?ID_PANNELLO|id="messaggi-automatici"/.test(nuovoC),
    ],
  );
}
