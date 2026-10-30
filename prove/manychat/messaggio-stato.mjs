/** ── PROVE: IL MESSAGGIO DELLO STATO LO SCRIVE IL CONSULENTE ──────────────────
 *
 *  Commessa 2026-10-30-messaggio-per-stato. Le regole pure di
 *  `src/crm/manychat/messaggio-stato.ts` (cosa si legge dalla scheda, quando vale, che
 *  modello e che testo partono) e il loro uso in `conStatoDal` (il testo si azzera col cambio
 *  di stato). Il giro e la porta hanno le loro prove in `giro.mjs` e `porta.mjs`; i controlli
 *  sulla finestra dell'interfaccia in fondo a questo file. Dati inventati.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveMessaggioStato(mod, { c, gruppo, radice }) {
  const M = mod["manychat/messaggio-stato"];
  const D = mod["stato-dal"];
  const T = mod["wa-meta-templates"];
  const ADESSO = new Date("2026-10-30T10:00:00Z");

  gruppo("MESSAGGIO PER STATO · QUALI STATI HANNO UN MESSAGGIO");
  c(
    "«Attesa acconto», «Richiamo concordato», «Non risponde» sì; «Da contattare» e «Venduto» no",
    [true, true, true, false, false, false],
    [
      M.statoHaMessaggio("in_attesa_acconto"),
      M.statoHaMessaggio("richiamo"),
      M.statoHaMessaggio("non_risponde"),
      M.statoHaMessaggio("da_contattare"),
      M.statoHaMessaggio("venduto"),
      M.statoHaMessaggio(undefined),
    ],
  );

  gruppo("MESSAGGIO PER STATO · COSA SI LEGGE DALLA SCHEDA");
  const ms = (extra) => ({
    stato: "in_attesa_acconto",
    testo: "Ciao {nome}, ti scrivo per l'acconto",
    fuoriFinestra: "stato",
    scrittoIl: "2026-10-30T09:00:00.000Z",
    ...extra,
  });
  const scheda = (extra, stato = "in_attesa_acconto") => ({ nome: "Anna", stato, ...extra });
  c(
    "scheda dello stesso stato: si legge com'è",
    ms(),
    M.leggiMessaggioStato(scheda({ messaggioStato: ms() })),
  );
  c(
    "stato cambiato: il testo non vale più (null)",
    null,
    M.leggiMessaggioStato(scheda({ messaggioStato: ms() }, "sta_valutando")),
  );
  c("nessun messaggio salvato → null", null, M.leggiMessaggioStato(scheda({})));
  c(
    "testo vuoto e «modello dello stato» → come oggi (null)",
    null,
    M.leggiMessaggioStato(scheda({ messaggioStato: ms({ testo: "   " }) })),
  );
  c(
    "testo vuoto ma scelta «generico» → vale (serve fuori finestra)",
    { ...ms({ testo: "" }), fuoriFinestra: "generico" },
    M.leggiMessaggioStato(
      scheda({ messaggioStato: ms({ testo: "", fuoriFinestra: "generico" }) }),
    ),
  );
  c(
    "scelta sconosciuta → «stato» (il modello di serie)",
    "stato",
    M.leggiMessaggioStato(scheda({ messaggioStato: ms({ fuoriFinestra: "boh" }) }))?.fuoriFinestra,
  );
  c(
    "forma rotta (stringa, numero, array, testo non stringa) → null, senza lanciare",
    [null, null, null, null],
    [
      M.leggiMessaggioStato(scheda({ messaggioStato: "ciao" })),
      M.leggiMessaggioStato(scheda({ messaggioStato: 5 })),
      M.leggiMessaggioStato(scheda({ messaggioStato: [] })),
      M.leggiMessaggioStato(scheda({ messaggioStato: ms({ testo: 42 }) })),
    ],
  );
  c(
    "testo troppo lungo: tagliato a MAX_TESTO_MESSAGGIO, mai oltre",
    M.MAX_TESTO_MESSAGGIO,
    M.leggiMessaggioStato(scheda({ messaggioStato: ms({ testo: "a".repeat(5000) }) })).testo.length,
  );
  c("scheda assente → null", [null, null], [M.leggiMessaggioStato(null), M.leggiMessaggioStato(undefined)]);

  gruppo("MESSAGGIO PER STATO · IL TESTO CON IL NOME");
  c("{nome} → il nome", "Ciao Anna, ti scrivo", M.testoConNome("Ciao {nome}, ti scrivo", "Anna"));
  c("{Nome} e {NOME} valgono uguale", "Anna Anna", M.testoConNome("{Nome} {NOME}", "Anna"));
  c("senza {nome} il testo resta com'è (spazi ai bordi tolti)", "Ci sentiamo", M.testoConNome("  Ci sentiamo \n", "Anna"));
  c("{nome} ma nome mancante → null (mai «{nome}» al cliente)", null, M.testoConNome("Ciao {nome}", ""));
  c("senza {nome} il nome non serve", "Ok", M.testoConNome("Ok", ""));
  c("testo vuoto → null", null, M.testoConNome("   ", "Anna"));

  gruppo("MESSAGGIO PER STATO · CHE COSA PARTE");
  const S = (m, finestra, generico = true) =>
    M.sceltaInvio(m, { finestraAperta: finestra, flussoGenericoCollegato: generico, nome: "Anna" });
  c(
    "nessun messaggio: modello dello stato, niente testo (come oggi)",
    { generico: false, testoLibero: null },
    S(null, true),
  );
  c(
    "testo + finestra aperta → testo libero (col nome)",
    { generico: false, testoLibero: "Ciao Anna, ti scrivo per l'acconto" },
    S(ms(), true),
  );
  c(
    "testo + finestra chiusa + «stato» → modello dello stato",
    { generico: false, testoLibero: null },
    S(ms(), false),
  );
  c(
    "testo + finestra chiusa + «generico» → il generico",
    { generico: true, testoLibero: null },
    S(ms({ fuoriFinestra: "generico" }), false),
  );
  c(
    "…ma se il flusso del generico non è collegato → modello dello stato",
    { generico: false, testoLibero: null },
    S(ms({ fuoriFinestra: "generico" }), false, false),
  );
  c(
    "senza testo + «generico» + finestra APERTA → resta il modello dello stato (la scelta vale oltre le 24 ore)",
    { generico: false, testoLibero: null },
    S(ms({ testo: "", fuoriFinestra: "generico" }), true),
  );
  c(
    "senza testo + «generico» + finestra chiusa → il generico",
    { generico: true, testoLibero: null },
    S(ms({ testo: "", fuoriFinestra: "generico" }), false),
  );
  c(
    "testo + «generico» + finestra aperta → testo libero, e il generico di riserva (se ManyChat rifiuta il testo)",
    { generico: true, testoLibero: "Ciao Anna, ti scrivo per l'acconto" },
    S(ms({ fuoriFinestra: "generico" }), true),
  );
  c(
    "testo con {nome} ma nome mancante, finestra aperta → niente testo libero, ripiega sul modello",
    { generico: false, testoLibero: null },
    M.sceltaInvio(ms({ testo: "Ciao {nome}" }), {
      finestraAperta: true,
      flussoGenericoCollegato: true,
      nome: "",
    }),
  );

  gruppo("MESSAGGIO PER STATO · COSA SI SALVA");
  c(
    "testo + scelta → l'oggetto con stato, testo pulito e data",
    {
      stato: "in_attesa_acconto",
      testo: "Ciao",
      fuoriFinestra: "generico",
      scrittoIl: ADESSO.toISOString(),
    },
    M.messaggioPerSalvare("in_attesa_acconto", "  Ciao ", "generico", ADESSO),
  );
  c(
    "vuoto e «modello dello stato» (non toccato) → undefined: la chiave sparisce, come oggi",
    undefined,
    M.messaggioPerSalvare("in_attesa_acconto", "  ", "stato", ADESSO),
  );
  c(
    "vuoto ma «generico» → si salva (la scelta conta anche senza testo)",
    "generico",
    M.messaggioPerSalvare("in_attesa_acconto", "", "generico", ADESSO)?.fuoriFinestra,
  );
  c(
    "stato senza messaggio → undefined",
    undefined,
    M.messaggioPerSalvare("venduto", "ciao", "stato", ADESSO),
  );

  gruppo("MESSAGGIO PER STATO · IL MODELLO GENERICO");
  const g = T.findMetaTemplate(M.MODELLO_GENERICO);
  c("nome del modello", "hgl_come_eravamo_rimasti", M.MODELLO_GENERICO);
  c(
    "è in MODELLI_MANYCHAT: MARKETING, lead_name e consultant_name",
    ["MARKETING", ["lead_name", "consultant_name"]],
    [g?.category, g?.params.map((p) => p.key)],
  );
  c(
    "il testo è quello chiesto dal titolare",
    "Ciao {{1}}, buongiorno! Come va?\n\nSono {{2}} di Hair Genius Labs, ti scrivo per sapere alla fine come eravamo rimasti.",
    g?.body,
  );

  gruppo("MESSAGGIO PER STATO · CAMBIA LO STATO, IL TESTO SI AZZERA");
  const prima = { stato: "in_attesa_acconto", messaggioStato: ms(), nome: "Anna" };
  c(
    "stesso stato: la scheda resta identica (lo stesso oggetto)",
    true,
    ((x) => D.conStatoDal(prima, x, ADESSO) === x)({ ...prima, nome: "Anna B." }),
  );
  c(
    "stato cambiato: il vecchio testo sparisce, statoDal si scrive",
    [false, ADESSO.toISOString(), "sta_valutando"],
    ((r) => ["messaggioStato" in r, r.statoDal, r.stato])(
      D.conStatoDal(prima, { ...prima, stato: "sta_valutando" }, ADESSO),
    ),
  );
  c(
    "…anche quando lo stato TORNA a quello di prima (A → B → A): il testo vecchio non rivive",
    false,
    "messaggioStato" in
      D.conStatoDal(
        { stato: "sta_valutando", messaggioStato: ms() },
        { stato: "in_attesa_acconto", messaggioStato: ms() },
        ADESSO,
      ),
  );
  c(
    "stato cambiato E testo nuovo scritto nello stesso salvataggio: il nuovo resta",
    ms({ testo: "Nuovo", scrittoIl: "2026-10-30T10:00:00.000Z" }),
    D.conStatoDal(
      { stato: "sta_valutando" },
      {
        stato: "in_attesa_acconto",
        messaggioStato: ms({ testo: "Nuovo", scrittoIl: "2026-10-30T10:00:00.000Z" }),
      },
      ADESSO,
    ).messaggioStato,
  );
  c(
    "testo nuovo ma per un altro stato (rotto): non resta",
    false,
    "messaggioStato" in
      D.conStatoDal(
        { stato: "sta_valutando" },
        { stato: "in_attesa_acconto", messaggioStato: ms({ stato: "richiamo", scrittoIl: "x" }) },
        ADESSO,
      ),
  );
}
