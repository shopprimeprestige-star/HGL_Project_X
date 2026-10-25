/** ── PROVE: L'ORIGINE DEI LEAD IMPORTATI ───────────────────────────────────────────────
 *
 *  File d'area della commessa 2026-10-25 (Sheets e sequenze WhatsApp), compito U.
 *  Non serve toccare `prove/prove.mjs`, `prove/manychat.mjs` o `prove/sheets.mjs`
 *  (il collegamento c'è già). Dati inventati: nessun numero né nome vero.
 *
 *  Cinque blocchi:
 *   1. `origineDi` / `daGoogleSheets` / `origineInRiga`: da dove è entrata una scheda
 *      (foglio, file, a mano, scheda vecchia senza campi, dati storti), compresa una
 *      scheda fatta davvero da `schedaDaRiga` (il compito S);
 *   2. la riga d'origine della scheda e l'ordine «dal più recente»;
 *   3. il filtro Origine (`filtri-lista`): applicato, contato, nell'indirizzo;
 *   4. la voce «Lead da Google Sheets» di «Altro» (`reparti`) senza toccare le cinque
 *      voci di prima né le dieci viste;
 *   5. il sorgente dei pezzi che si disegnano: menu di Radix, solo testo React,
 *      nessun hook sotto un'uscita anticipata.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveOrigine(mod, { c, gruppo, radice }) {
  const OR = mod["importa/origine"];
  const FIL = mod["importa/filtri-lista"];
  const REP = mod["importa/reparti"];
  const IG = mod["sheets/ingresso"];
  const {
    origineDi,
    daGoogleSheets,
    origineInRiga,
    rigaOrigineScheda,
    ordinaPerArrivo,
    NOME_VIA,
    VIE_ORIGINE,
    VUOTO_GOOGLE_SHEETS,
  } = OR;

  /* ── I DATI DI PROVA ───────────────────────────────────────────────────── */
  const DA_FOGLIO = (o = {}) => ({
    nome: "Mario",
    importato: true,
    stato: "da_contattare",
    listaOrigine: { file: "Google Sheets · Lead HGL", il: "2026-10-25T08:14:03.000Z" },
    origineIngresso: {
      via: "google_sheets",
      foglio: "Lead HGL",
      scheda: "Foglio1",
      riga: 57,
      il: "2026-10-25T08:14:03.000Z",
    },
    ...o,
  });
  const DA_FILE = (o = {}) => ({
    nome: "Luca",
    importato: true,
    stato: "da_contattare",
    listaOrigine: { file: "lista_12ott.csv", il: "2026-10-12T09:00:00.000Z" },
    ...o,
  });
  const A_MANO = { nome: "Anna", importato: true, stato: "da_contattare" };

  /* ═══ 1. DA DOVE È ENTRATO ═══════════════════════════════════════════════ */
  gruppo("ORIGINE · DA DOVE È ENTRATA UNA SCHEDA");

  c(
    "dal foglio: via e etichetta col nome del foglio",
    { via: "google_sheets", etichetta: "Google Sheets · Lead HGL" },
    origineDi(DA_FOGLIO()),
  );
  c(
    "da file: «File · nome del file»",
    { via: "file", etichetta: "File · lista_12ott.csv" },
    origineDi(DA_FILE()),
  );
  c("senza niente: a mano", { via: "a_mano", etichetta: "A mano" }, origineDi(A_MANO));
  c("scheda vecchia, senza nessuno dei campi: a mano", "a_mano", origineDi({}).via);
  c(
    "senza scheda (null, undefined): a mano e nessun errore",
    "a_mano,a_mano",
    [origineDi(null).via, origineDi(undefined).via].join(","),
  );
  c(
    "il file con il nome vuoto non conta: a mano",
    "a_mano",
    origineDi({ listaOrigine: { file: "   ", il: "2026-10-12T09:00:00.000Z" } }).via,
  );
  c(
    "il foglio vince sul file (la scheda del foglio porta anche listaOrigine)",
    "google_sheets",
    origineDi(DA_FOGLIO({ listaOrigine: { file: "lista_12ott.csv", il: "x" } })).via,
  );
  c(
    "un nome di foglio con spazi e a capo si legge pulito",
    "Google Sheets · Lead HGL 2026",
    origineDi(
      DA_FOGLIO({
        origineIngresso: { via: "google_sheets", foglio: "  Lead \n HGL   2026 ", il: "x" },
      }),
    ).etichetta,
  );
  c(
    "senza il nome del foglio: solo «Google Sheets»",
    "Google Sheets",
    origineDi(DA_FOGLIO({ origineIngresso: { via: "google_sheets", foglio: "", il: "x" } }))
      .etichetta,
  );
  c(
    "un nome lunghissimo si taglia (la riga resta una riga)",
    true,
    origineDi(
      DA_FOGLIO({ origineIngresso: { via: "google_sheets", foglio: "x".repeat(500), il: "x" } }),
    ).etichetta.length <= 100,
  );
  c(
    "una via che non conosciamo non è il foglio",
    "a_mano",
    origineDi({ origineIngresso: { via: "csv_strano", foglio: "Lead HGL", il: "x" } }).via,
  );
  c(
    "dati storti (numeri, liste) non rompono niente",
    "a_mano,a_mano",
    [
      origineDi({ origineIngresso: 7, listaOrigine: 5 }).via,
      origineDi({ origineIngresso: [], listaOrigine: [] }).via,
    ].join(","),
  );
  c(
    "un nome di foglio che non è testo: resta «Google Sheets»",
    "google_sheets,Google Sheets",
    (({ via, etichetta }) => `${via},${etichetta}`)(
      origineDi({
        origineIngresso: { via: "google_sheets", foglio: { a: 1 }, il: "x" },
        listaOrigine: { file: 3 },
      }),
    ),
  );
  c(
    "«daGoogleSheets» dice sì solo al foglio",
    "true,false,false,false",
    [
      daGoogleSheets(DA_FOGLIO()),
      daGoogleSheets(DA_FILE()),
      daGoogleSheets(A_MANO),
      daGoogleSheets(null),
    ].join(","),
  );
  c(
    "le tre vie, nell'ordine in cui si mostrano",
    "google_sheets,file,a_mano",
    VIE_ORIGINE.join(","),
  );
  c(
    "i nomi delle tre vie",
    "Google Sheets,File,A mano",
    VIE_ORIGINE.map((v) => NOME_VIA[v]).join(","),
  );

  //  ── Sulla riga dell'elenco si scrive solo l'origine che serve sapere ────
  c("riga: il foglio si scrive", "Google Sheets · Lead HGL", origineInRiga(DA_FOGLIO()));
  c(
    "riga: file e a mano no (su ogni riga sarebbe rumore)",
    ",",
    [origineInRiga(DA_FILE()), origineInRiga(A_MANO)].join(","),
  );

  //  ── Una scheda fatta davvero dal compito S: lo stesso sguardo ───────────
  const richiesta = {
    versione: 1,
    foglio: { id: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", nome: "Lead HGL", scheda: "Foglio1" },
    riga: 57,
    intestazioni: ["id", "created_time", "ad_name", "full_name", "email", "phone_number"],
    valori: [
      "l:100000000000011",
      "2026-10-25T09:14:03+01:00",
      "Annuncio prova",
      "Mario Esempio",
      "mario@example.com",
      "p:+393330000101",
    ],
  };
  const fatta = await IG.schedaDaRiga(richiesta, new Date("2026-10-25T08:20:00Z"));
  c("la scheda di S è riconosciuta come del foglio", "google_sheets", origineDi(fatta.data).via);
  c(
    "e porta il nome del foglio, non l'id del file Google",
    "Google Sheets · Lead HGL",
    origineDi(fatta.data).etichetta,
  );
  c(
    "e l'etichetta è la stessa che S scrive in listaOrigine.file",
    fatta.data.listaOrigine.file,
    origineDi(fatta.data).etichetta,
  );

  /* ═══ 2. LA RIGA DELLA SCHEDA E L'ORDINE ═════════════════════════════════ */
  gruppo("ORIGINE · LA RIGA SULLA SCHEDA E «DAL PIÙ RECENTE»");
  const ADESSO = new Date("2026-10-26T10:00:00Z");
  c(
    "scheda: foglio, scheda del foglio, riga e quando",
    "Origine: Google Sheets · Lead HGL (Foglio1, riga 57) · arrivato il 25/10 alle 09:14",
    rigaOrigineScheda(
      DA_FOGLIO({
        origineIngresso: {
          via: "google_sheets",
          foglio: "Lead HGL",
          scheda: "Foglio1",
          riga: 57,
          il: "2026-10-25T08:14:03.000Z",
        },
      }),
      ADESSO,
    ),
  );
  c(
    "l'ora è quella di Roma (ora solare: UTC+1 il 25/10, dopo il cambio dell'ora)",
    "alle 09:14",
    /alle \d\d:\d\d/.exec(rigaOrigineScheda(DA_FOGLIO(), ADESSO))?.[0],
  );
  c(
    "in estate (UTC+2) l'ora è quella di Roma",
    "arrivato il 15/07 alle 14:30",
    /arrivato il .*/.exec(
      rigaOrigineScheda(
        DA_FOGLIO({
          origineIngresso: { via: "google_sheets", foglio: "F", il: "2026-07-15T12:30:00.000Z" },
        }),
        ADESSO,
      ),
    )?.[0],
  );
  c(
    "di un altro anno, l'anno si scrive",
    "arrivato il 05/12/2025 alle 10:14",
    /arrivato il .*/.exec(
      rigaOrigineScheda(
        DA_FOGLIO({
          origineIngresso: { via: "google_sheets", foglio: "F", il: "2025-12-05T09:14:03.000Z" },
        }),
        ADESSO,
      ),
    )?.[0],
  );
  c(
    "senza scheda e senza riga: niente parentesi",
    "Origine: Google Sheets · Lead HGL · arrivato il 25/10 alle 09:14",
    rigaOrigineScheda(
      DA_FOGLIO({
        origineIngresso: {
          via: "google_sheets",
          foglio: "Lead HGL",
          il: "2026-10-25T08:14:03.000Z",
        },
      }),
      ADESSO,
    ),
  );
  c(
    "solo la riga",
    "Origine: Google Sheets · Lead HGL (riga 3) · arrivato il 25/10 alle 09:14",
    rigaOrigineScheda(
      DA_FOGLIO({
        origineIngresso: {
          via: "google_sheets",
          foglio: "Lead HGL",
          riga: 3,
          il: "2026-10-25T08:14:03.000Z",
        },
      }),
      ADESSO,
    ),
  );
  c(
    "una riga che non è un numero intero ≥ 2 non si scrive",
    "Origine: Google Sheets · Lead HGL · arrivato il 25/10 alle 09:14",
    rigaOrigineScheda(
      DA_FOGLIO({
        origineIngresso: {
          via: "google_sheets",
          foglio: "Lead HGL",
          riga: "boh",
          il: "2026-10-25T08:14:03.000Z",
        },
      }),
      ADESSO,
    ),
  );
  c(
    "se il momento non si legge, la frase finisce senza",
    "Origine: Google Sheets · Lead HGL (Foglio1, riga 57)",
    rigaOrigineScheda(
      DA_FOGLIO({
        origineIngresso: {
          via: "google_sheets",
          foglio: "Lead HGL",
          scheda: "Foglio1",
          riga: 57,
          il: "ieri",
        },
      }),
      ADESSO,
    ),
  );
  c(
    "file, a mano, scheda vuota: nessuna riga (per il file c'è già «Da dove arriva»)",
    ",,",
    [
      rigaOrigineScheda(DA_FILE(), ADESSO),
      rigaOrigineScheda(A_MANO, ADESSO),
      rigaOrigineScheda(null, ADESSO),
    ].join(","),
  );

  const L = (id, data) => ({ id, data });
  const ordinati = ordinaPerArrivo([
    L(
      "vecchio",
      DA_FOGLIO({
        origineIngresso: { via: "google_sheets", foglio: "F", il: "2026-10-24T08:00:00.000Z" },
      }),
    ),
    L(
      "nuovo",
      DA_FOGLIO({
        origineIngresso: { via: "google_sheets", foglio: "F", il: "2026-10-25T09:00:00.000Z" },
      }),
    ),
    L(
      "senza-data",
      DA_FOGLIO({
        origineIngresso: { via: "google_sheets", foglio: "F", il: "boh" },
        listaOrigine: undefined,
      }),
    ),
    L(
      "medio",
      DA_FOGLIO({
        origineIngresso: { via: "google_sheets", foglio: "F", il: "2026-10-25T07:00:00.000Z" },
      }),
    ),
    L(
      "pari-a",
      DA_FOGLIO({
        origineIngresso: { via: "google_sheets", foglio: "F", il: "2026-10-25T07:00:00.000Z" },
      }),
    ),
  ]);
  c(
    "«dal più recente»: il più nuovo in cima, chi non ha data in fondo, a pari merito l'ordine di prima",
    "nuovo,medio,pari-a,vecchio,senza-data",
    ordinati.map((x) => x.id).join(","),
  );
  const prima = [L("a", DA_FILE()), L("b", DA_FOGLIO())];
  const copia = ordinaPerArrivo(prima);
  c("l'ordine non cambia l'elenco di partenza", "a,b", prima.map((x) => x.id).join(","));
  c("e ne dà uno nuovo", false, copia === prima);

  /* ═══ 3. IL FILTRO ORIGINE ═══════════════════════════════════════════════ */
  gruppo("ORIGINE · IL FILTRO NELLE LISTE");
  const OGGI = "2026-10-25";
  const riga = (id, data) => ({ id, data, motivo: "prima", modulo: undefined });
  const RIGHE = [
    riga("f1", DA_FOGLIO()),
    riga("f2", DA_FOGLIO({ nome: "Rita" })),
    riga("x1", DA_FILE()),
    riga("x2", DA_FILE({ nome: "Gian" })),
    riga("x3", DA_FILE({ nome: "Pia" })),
    riga("m1", A_MANO),
  ];
  const ids = (a) => a.map((r) => r.id).join(",");
  c("senza filtro passano tutte", "f1,f2,x1,x2,x3,m1", ids(FIL.applicaFiltri(RIGHE, {}, OGGI)));
  c(
    "Origine = Google Sheets: solo le schede del foglio",
    "f1,f2",
    ids(FIL.applicaFiltri(RIGHE, { origine: "google_sheets" }, OGGI)),
  );
  c("Origine = File", "x1,x2,x3", ids(FIL.applicaFiltri(RIGHE, { origine: "file" }, OGGI)));
  c("Origine = A mano", "m1", ids(FIL.applicaFiltri(RIGHE, { origine: "a_mano" }, OGGI)));
  const CON_NON_RISPONDE = [
    ...RIGHE,
    riga("f3", DA_FOGLIO({ nome: "Pia", stato: "non_risponde" })),
  ];
  c(
    "si somma agli altri filtri (in E): del foglio e mai chiamati",
    "f1,f2",
    ids(FIL.applicaFiltri(CON_NON_RISPONDE, { origine: "google_sheets", stato: "mai" }, OGGI)),
  );
  c(
    "…del foglio e che non rispondono",
    "f3",
    ids(
      FIL.applicaFiltri(CON_NON_RISPONDE, { origine: "google_sheets", stato: "nonRisponde" }, OGGI),
    ),
  );
  const op = FIL.opzioniFiltri(RIGHE, {}, OGGI);
  c(
    "le voci del menu: una per via, nell'ordine, col numero che esce premendola",
    "google_sheets:2,file:3,a_mano:1",
    op.origine.map((v) => `${v.valore}:${v.n}`).join(","),
  );
  const opScelta = FIL.opzioniFiltri(RIGHE, { origine: "google_sheets" }, OGGI);
  c(
    "i numeri non si smentiscono con la voce scelta (si conta senza il proprio filtro)",
    "google_sheets:2,file:3,a_mano:1",
    opScelta.origine.map((v) => `${v.valore}:${v.n}`).join(","),
  );
  c(
    "gli altri menu contano dentro l'origine scelta",
    2,
    opScelta.stato.find((x) => x.valore === "mai").n,
  );
  const opStato = FIL.opzioniFiltri(RIGHE, { stato: "nonRisponde" }, OGGI);
  c(
    "l'origine conta con gli altri filtri già accesi",
    "google_sheets:0,file:0,a_mano:0",
    opStato.origine.map((v) => `${v.valore}:${v.n}`).join(","),
  );
  c(
    "nell'indirizzo: origine valida",
    { origine: "google_sheets" },
    FIL.leggiRicercaImporta({ origine: "google_sheets" }),
  );
  c(
    "nell'indirizzo: tutte e tre le vie",
    "google_sheets,file,a_mano",
    ["google_sheets", "file", "a_mano"]
      .map((o) => FIL.leggiRicercaImporta({ origine: o }).origine)
      .join(","),
  );
  c(
    "nell'indirizzo: un'origine inventata si scarta",
    {},
    FIL.leggiRicercaImporta({ origine: "facebook" }),
  );
  c(
    "nell'indirizzo: un valore che non è testo si scarta",
    {},
    FIL.leggiRicercaImporta({ origine: ["google_sheets"] }),
  );
  c(
    "l'origine convive con gli altri parametri",
    { stato: "mai", origine: "file" },
    FIL.leggiRicercaImporta({ origine: "file", stato: "mai", altro: 1 }),
  );

  /* ═══ 4. LA VOCE DI «ALTRO» ══════════════════════════════════════════════ */
  gruppo("ORIGINE · LA VOCE «LEAD DA GOOGLE SHEETS» IN «ALTRO»");
  const { ALTRO, ALTRO_FILTRATE, vocePerVista, percorsoVista, linguettaDi } = REP;
  c(
    "c'è una voce che apre «Tutta la lista» col filtro Origine",
    "tutti,google_sheets",
    `${ALTRO_FILTRATE[0].vista},${ALTRO_FILTRATE[0].filtro.origine}`,
  );
  c("si chiama «Lead da Google Sheets»", "Lead da Google Sheets", ALTRO_FILTRATE[0].nome);
  c(
    "e ha la sua spiegazione",
    "I lead arrivati dal foglio Google collegato alle inserzioni, dal più recente",
    ALTRO_FILTRATE[0].titolo,
  );
  //  ⚠️ NON È UNA VISTA NUOVA e le voci di prima restano cinque: i controlli dei
  //   reparti in prove.mjs (cinque voci, nessuna vista in due posti) restano
  //   verdi senza toccarli.
  c("le cinque voci di prima sono ancora cinque", 5, ALTRO.length);
  c(
    "nessuna vista nuova: la voce usa una che c'è",
    true,
    ALTRO.some((x) => x.vista === ALTRO_FILTRATE[0].vista),
  );
  c("sta in «Altro»", "altro", linguettaDi("tutti"));
  c(
    "vocePerVista: «tutti» con l'origine del foglio è la voce nuova",
    "Lead da Google Sheets",
    vocePerVista("tutti", "google_sheets")?.nome,
  );
  c(
    "vocePerVista: «tutti» senza origine è «Tutta la lista»",
    "Tutta la lista",
    vocePerVista("tutti")?.nome,
  );
  c(
    "vocePerVista: «tutti» con un'altra origine è «Tutta la lista»",
    "Tutta la lista",
    vocePerVista("tutti", "file")?.nome,
  );
  c(
    "vocePerVista: le altre viste non cambiano",
    "Ripesca",
    vocePerVista("ripesca", "google_sheets")?.nome,
  );
  c("vocePerVista: la lista non è in Altro", undefined, vocePerVista("coda"));
  c(
    "percorso con il filtro del foglio",
    ["Altro", "Lead da Google Sheets"],
    percorsoVista("tutti", "google_sheets"),
  );
  c(
    "percorso di sempre, senza il secondo argomento",
    ["Altro", "Tutta la lista"],
    percorsoVista("tutti"),
  );
  //  ── Lasciando la voce, l'Origine che aveva messo si toglie ────────────
  const { filtriLasciandoLaVoce } = REP;
  const dalFoglio = { origine: "google_sheets", annuncio: "g:Gruppo A", stato: "mai" };
  c(
    "lasciando la voce del foglio l'Origine si toglie",
    { annuncio: "g:Gruppo A", stato: "mai" },
    filtriLasciandoLaVoce(dalFoglio, true),
  );
  c("e l'oggetto di partenza non cambia", "google_sheets", dalFoglio.origine);
  c(
    "un'Origine scelta a mano dal menu (non dalla voce) resta",
    true,
    filtriLasciandoLaVoce(dalFoglio, false) === dalFoglio,
  );
  c(
    "un'altra Origine (File) resta anche con la voce",
    true,
    (() => {
      const f = { origine: "file" };
      return filtriLasciandoLaVoce(f, true) === f;
    })(),
  );
  c(
    "senza Origine non c'è niente da togliere: lo stesso oggetto",
    true,
    (() => {
      const f = { stato: "mai" };
      return filtriLasciandoLaVoce(f, true) === f;
    })(),
  );

  c(
    "il vuoto della voce dice cosa aspettarsi",
    "Nessun lead dal foglio Google per ora",
    VUOTO_GOOGLE_SHEETS.titolo,
  );
  c(
    "…e che le righe arrivano entro un minuto",
    "Quando il foglio è collegato, le righe nuove compaiono qui entro un minuto.",
    VUOTO_GOOGLE_SHEETS.testo,
  );

  /* ═══ 5. IL SORGENTE DI CHI DISEGNA ══════════════════════════════════════ */
  gruppo("ORIGINE · COSA SI VEDE (sorgente)");
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const filtriTsx = leggi("src/crm/importa/FiltriLista.tsx");
  const altroTsx = leggi("src/crm/importa/MenuAltro.tsx");
  const tuttiTsx = leggi("src/crm/importa/SchedaTutti.tsx");
  const rigaTsx = leggi("src/crm/importa/RigaChiamata.tsx");
  const paginaTsx = leggi("src/routes/CRM.importa.tsx");
  const dialogTsx = leggi("src/crm/LeadDialog.tsx");

  c(
    "il menu Origine esiste ed è di Radix come gli altri",
    true,
    filtriTsx.includes("export function MenuOrigine") &&
      /<Popover\b/.test(
        filtriTsx
          .split("export function MenuOrigine")[1]
          .split("\nexport function ")[0]
          .split("\nfunction ")[0],
      ),
  );
  c("la barra di «Da chiamare» ha il menu Origine", true, /<MenuOrigine\b/.test(filtriTsx));
  c("«Tutta la lista» ha il menu Origine", true, /<MenuOrigine\b/.test(tuttiTsx));
  c("l'origine accesa si legge come etichetta da spegnere", true, filtriTsx.includes("Origine: "));
  c(
    "«Azzera filtri» spegne anche l'origine",
    true,
    /origine/.test(filtriTsx.split("function pulito")[1].split("\n}\n")[0]),
  );
  c("il menu Altro mostra la voce nuova", true, altroTsx.includes("ALTRO_FILTRATE"));
  c("e il tasto Altro dice quale voce è aperta", true, altroTsx.includes("vocePerVista("));
  c(
    "«Tutta la lista» riparte dall'origine che c'è nell'indirizzo",
    true,
    /useSearch\(\{ from: "\/CRM\/importa" \}\)/.test(tuttiTsx) && /search\.origine/.test(tuttiTsx),
  );
  c("la voce vuota usa il testo concordato", true, tuttiTsx.includes("VUOTO_GOOGLE_SHEETS"));
  c(
    "«Tutta la lista» dal foglio ordina dal più recente",
    true,
    tuttiTsx.includes("ordinaPerArrivo("),
  );
  c(
    "le righe dell'elenco scrivono l'origine del foglio",
    true,
    /origineInRiga\(/.test(tuttiTsx) && /origineInRiga\(/.test(paginaTsx),
  );
  c(
    "la riga «Poi» scrive l'origine accanto all'annuncio",
    true,
    /origine[\s\S]{0,40}annuncio|annuncio[\s\S]{0,200}origine/.test(rigaTsx),
  );
  c("la scheda grande dice da dove arriva", true, /origine \|\| null/.test(paginaTsx));
  c("la scheda del lead scrive la riga d'origine", true, dialogTsx.includes("rigaOrigineScheda("));
  //  ⚠️ La riga del consenso resta UNA: quella di `OkWhatsapp`/`vistaOkWhatsapp` (P).
  //   La scheda non ne aggiunge un'altra e non dice «vale / non vale»: non conosce
  //   la data della frase. Dice solo «Ha lasciato il numero nel modulo il …».
  c(
    "LeadDialog: una sola riga di consenso, quella di OkWhatsapp",
    1,
    (dialogTsx.match(/<OkWhatsapp\b/g) ?? []).length,
  );
  c(
    "LeadDialog: nessun verdetto «vale / non vale» scritto qui",
    false,
    /non vale|vale come consenso|precedente alla frase/.test(dialogTsx),
  );
  c(
    "LeadDialog: non passa la data della frase (il verdetto è di P, nel riquadro)",
    false,
    /fraseModuloDal/.test(dialogTsx),
  );
  //  ⚠️ OGNI STRADA FUORI DALLA VOCE PASSA DA UN POSTO SOLO, e «Già lavorati»,
  //   che resta su «Tutta la lista», lo chiama da sé.
  c(
    "la pagina toglie l'Origine della voce con filtriLasciandoLaVoce",
    true,
    /filtriLasciandoLaVoce\(filtri, daVoceFoglio\)/.test(paginaTsx),
  );
  c(
    "…da un effetto che guarda la vista (linguette, stanze, ricerca)",
    true,
    /useEffect\(\(\) => \{\s*if \(daVoceFoglio && vista !== "tutti"\) esciDalFoglio\(\);/.test(
      paginaTsx,
    ),
  );
  c(
    "…e il menu Altro toglie l'Origine prima di spegnere la voce",
    true,
    /if \(filtri\.origine === "google_sheets" && \(v === "tutti" \|\| daVoceFoglio\)\)\s*cambiaFiltri\(senzaOrigine\(\)\);\s*setDaVoceFoglio\(false\);/.test(
      paginaTsx,
    ),
  );
  c(
    "…e «Già lavorati» la chiama prima di aprire la lista",
    true,
    /esciDalFoglio\(\);\s*setStatoTutti\(st\);/.test(paginaTsx),
  );
  c(
    "«Tutta la lista» riceve il numero dal foglio dalla pagina, non lo ricalcola",
    true,
    /nDalFoglio=\{nDalFoglio\}/.test(paginaTsx) && !/daGoogleSheets\(/.test(tuttiTsx),
  );
  c(
    "la spiegazione del menu Origine sta sul pulsante, non su un contenitore",
    true,
    /titolo=\{SPIEGA_ORIGINE\[v\.valore\]\}/.test(filtriTsx),
  );
  for (const [nome, src] of [
    ["FiltriLista", filtriTsx],
    ["MenuAltro", altroTsx],
    ["SchedaTutti", tuttiTsx],
    ["RigaChiamata", rigaTsx],
    ["CRM.importa", paginaTsx],
    ["LeadDialog", dialogTsx],
  ]) {
    c(
      `${nome}: solo testo React, mai HTML da fuori`,
      false,
      /dangerouslySetInnerHTML|innerHTML\s*=/.test(src),
    );
  }
  c("MenuAltro: nessun menu fatto a mano", false, /<select\b|role="(listbox|menu)"/.test(altroTsx));
}
