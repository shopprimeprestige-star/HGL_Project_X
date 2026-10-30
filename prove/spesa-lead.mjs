/** ── PROVE: LEAD DI OGGI E SPESA PUBBLICITARIA DAL TASTO WHATSAPP (30/10/2026) ──
 *
 *  Commessa 2026-10-30-spesa-lead-oggi. Il calcolo è puro (`chatwa/spesa-lead`):
 *  giorno di arrivo di un lead (ora di Roma), spesa del giorno (a mano vince su
 *  Meta, come nel registro KPI), costo per lead, totale del periodo. La spesa si
 *  salva nella tabella che c'è già (`crm_ad_spending`): nessuna migrazione.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveSpesaLead(mod, { c, gruppo, radice }) {
  const S = mod["chatwa/spesa-lead"];
  const lead = (id, data = {}) => ({ id, data: { nome: `N${id}`, ...data } });
  const mano = (giorno, importo, id = giorno) => ({
    id,
    user_id: "u",
    data: {
      data: giorno,
      campagna: "x",
      fonte: "ADV",
      importoSpeso: importo,
      leadGenerati: 0,
      meetFissati: 0,
      conversioni: 0,
    },
  });

  gruppo("SPESA LEAD · IL GIORNO DI ARRIVO È QUELLO DI ROMA");
  c(
    "createdAt UTC dopo le 22 (ora legale): a Roma è già il giorno dopo",
    "2026-10-25",
    S.giornoDiArrivo({ createdAt: "2026-10-24T22:30:00Z" }),
  );
  c(
    "…d'inverno (UTC+1) alle 23:30 UTC è già domani, alle 22:30 no",
    ["2026-12-02", "2026-12-01"],
    [
      S.giornoDiArrivo({ createdAt: "2026-12-01T23:30:00Z" }),
      S.giornoDiArrivo({ createdAt: "2026-12-01T22:30:00Z" }),
    ],
  );
  c(
    "un giorno senza ora vale quel giorno",
    "2026-10-24",
    S.giornoDiArrivo({ createdAt: "2026-10-24" }),
  );
  c(
    "origineIngresso.il (foglio Google) vince su createdAt",
    "2026-10-30",
    S.giornoDiArrivo({
      createdAt: "2026-10-28T10:00:00Z",
      origineIngresso: { via: "google_sheets", foglio: "f", il: "2026-10-30T07:00:00Z" },
    }),
  );
  c(
    "lista da file SENZA data nel file: l'arrivo non si conosce, non è un lead di oggi",
    null,
    S.giornoDiArrivo({
      createdAt: "2026-10-30T07:00:00Z",
      listaOrigine: { file: "a.csv", il: "2026-10-30T07:00:00Z", dataDalFile: false },
    }),
  );
  c(
    "lista da file CON la data letta dal file: vale createdAt",
    "2026-10-12",
    S.giornoDiArrivo({
      createdAt: "2026-10-12T09:00:00Z",
      listaOrigine: { file: "a.csv", il: "2026-10-30T07:00:00Z", dataDalFile: true },
    }),
  );
  c(
    "data mancante o illeggibile: null (mai «oggi»)",
    [null, null, null, null],
    [
      S.giornoDiArrivo({}),
      S.giornoDiArrivo({ createdAt: "boh" }),
      S.giornoDiArrivo(null),
      S.giornoDiArrivo(undefined),
    ],
  );

  gruppo("SPESA LEAD · I GIORNI DELL'ELENCO (OGGI DI ROMA, POI INDIETRO)");
  const alle = new Date("2026-10-29T23:30:00Z"); // a Roma è già il 30 alle 00:30
  c("oggi è il giorno di Roma, non quello UTC", "2026-10-30", S.giorniRecenti(alle, 1)[0]);
  c(
    "7 giorni dal più recente, anche a cavallo del cambio d'ora (25/10)",
    [
      "2026-10-30",
      "2026-10-29",
      "2026-10-28",
      "2026-10-27",
      "2026-10-26",
      "2026-10-25",
      "2026-10-24",
    ],
    S.giorniRecenti(alle, 7),
  );
  c(
    "30 giorni, tutti diversi, l'ultimo è il 1 ottobre",
    [30, "2026-10-01"],
    (() => {
      const g = S.giorniRecenti(alle, 30);
      return [new Set(g).size, g[29]];
    })(),
  );
  c(
    "a cavallo dell'anno",
    ["2027-01-01", "2026-12-31", "2026-12-30"],
    S.giorniRecenti(new Date("2027-01-01T10:00:00Z"), 3),
  );

  gruppo("SPESA LEAD · QUANTI LEAD PER GIORNO");
  const giorni = ["2026-10-30", "2026-10-29", "2026-10-28"];
  const leads = [
    lead("a", { createdAt: "2026-10-30T08:00:00Z" }),
    lead("b", { createdAt: "2026-10-30T10:00:00Z" }),
    lead("c", { createdAt: "2026-10-29T08:00:00Z" }),
    lead("d", { createdAt: "2026-10-20T08:00:00Z" }), // fuori elenco
    lead("e", {}), // senza data
    null,
  ];
  c(
    "conta per giorno di Roma, scarta senza data e fuori elenco",
    [2, 1, 0],
    giorni.map((g) => S.leadPerGiorno(leads, giorni).get(g) ?? 0),
  );
  c(
    "nessuna scheda: tutti zero, nessun errore",
    [0, 0, 0],
    giorni.map((g) => S.leadPerGiorno(undefined, giorni).get(g) ?? 0),
  );

  gruppo("SPESA LEAD · LA SPESA DEL GIORNO (A MANO VINCE SU META, COME NEL REGISTRO KPI)");
  const meta = new Map([
    ["2026-10-29", 30],
    ["2026-10-28", 0],
  ]);
  const m30 = S.spesaDelGiorno("2026-10-30", [mano("2026-10-30", 42.5)], meta);
  c("scritta a mano", [42.5, "mano", 1], [m30.euro, m30.origine, m30.registrazioni]);
  const m29 = S.spesaDelGiorno("2026-10-29", [], meta);
  c(
    "sincronizzata da Meta se a mano non c'è",
    [30, "meta", 0],
    [m29.euro, m29.origine, m29.registrazioni],
  );
  const mVince = S.spesaDelGiorno("2026-10-29", [mano("2026-10-29T00:00:00", 50)], meta);
  c(
    "a mano e Meta nello stesso giorno: vale SOLO la mano (niente doppio conto)",
    [50, "mano"],
    [mVince.euro, mVince.origine],
  );
  const due = S.spesaDelGiorno(
    "2026-10-30",
    [mano("2026-10-30", 10, "x"), mano("2026-10-30", 5.5, "y")],
    new Map(),
  );
  c(
    "due registrazioni a mano: si sommano, e si dice che sono due",
    [15.5, 2],
    [due.euro, due.registrazioni],
  );
  const nulla = S.spesaDelGiorno("2026-10-28", [], meta);
  c("Meta a zero o niente: nessuna spesa (null), non 0", [null, null], [nulla.euro, nulla.origine]);
  c(
    "importi storti (stringa, NaN, null) non rompono",
    [12, 1],
    (() => {
      const r = S.spesaDelGiorno(
        "2026-10-30",
        [mano("2026-10-30", "12"), mano("2026-10-30", NaN, "n"), mano("2026-10-30", null, "m")],
        new Map(),
      );
      return [r.euro, 1];
    })(),
  );
  c(
    "registrazione di un altro giorno non conta",
    null,
    S.spesaDelGiorno("2026-10-30", [mano("2026-10-29", 99)], new Map()).euro,
  );
  c(
    "elenco di registrazioni mancante o con righe storte: nessun errore",
    [null, null],
    [
      S.spesaDelGiorno("2026-10-30", undefined, new Map()).euro,
      S.spesaDelGiorno("2026-10-30", [null, {}, { data: null }], new Map()).euro,
    ],
  );

  gruppo("SPESA LEAD · IL COSTO PER LEAD");
  c("spesa / lead", 8.5, S.costoPerLead(42.5, 5));
  c("zero lead: trattino (null), mai Infinity", null, S.costoPerLead(42.5, 0));
  c(
    "spesa vuota: trattino",
    [null, null, null],
    [S.costoPerLead(null, 5), S.costoPerLead(0, 5), S.costoPerLead(-3, 5)],
  );
  c(
    "valori non numerici: trattino",
    [null, null],
    [S.costoPerLead(NaN, 5), S.costoPerLead(10, NaN)],
  );

  gruppo("SPESA LEAD · LE RIGHE E IL TOTALE DEL PERIODO");
  const righe = S.righeGiorni({ giorni, leads, aMano: [mano("2026-10-30", 20)], meta });
  c(
    "una riga per giorno, nell'ordine dato",
    giorni,
    righe.map((r) => r.giorno),
  );
  c(
    "oggi: 2 lead, 20 €, 10 € a lead",
    [2, 20, 10],
    [righe[0].lead, righe[0].euro, righe[0].costoLead],
  );
  c(
    "29: 1 lead, 30 € da Meta, 30 € a lead",
    [1, 30, "meta", 30],
    [righe[1].lead, righe[1].euro, righe[1].origine, righe[1].costoLead],
  );
  c(
    "28: 0 lead e nessuna spesa → trattino",
    [0, null, null],
    [righe[2].lead, righe[2].euro, righe[2].costoLead],
  );
  const tot = S.totale(righe);
  c(
    "totale: lead di tutti i giorni, spesa, costo su quelli CON spesa",
    [3, 50, 3, 2, 50 / 3],
    [tot.lead, tot.spesa, tot.leadConSpesa, tot.giorniConSpesa, tot.costoLead],
  );
  const totSenza = S.totale(S.righeGiorni({ giorni, leads, aMano: [], meta: new Map() }));
  c(
    "senza spesa: costo per lead null",
    [3, 0, null],
    [totSenza.lead, totSenza.spesa, totSenza.costoLead],
  );
  const righeSpesaSenzaLead = S.righeGiorni({
    giorni,
    leads: [],
    aMano: [mano("2026-10-30", 20)],
    meta: new Map(),
  });
  c(
    "spesa ma 0 lead: costo per lead null (non infinito), la spesa però è nel totale",
    [20, 0, null],
    (() => {
      const t = S.totale(righeSpesaSenzaLead);
      return [t.spesa, t.lead, t.costoLead];
    })(),
  );

  gruppo("SPESA LEAD · LA PAGINA USA LE REGOLE, NON UNA COPIA");
  const pannello = readFileSync(join(radice, "src/crm/chatwa/PannelloSpesaLead.tsx"), "utf8");
  const pagina = readFileSync(join(radice, "src/crm/chatwa/PaginaChat.tsx"), "utf8");
  c("il pannello importa il calcolo da spesa-lead", true, /from "\.\/spesa-lead"/.test(pannello));
  c(
    "la spesa si scrive nella tabella che c'è già (registraSpesa/correggiSpesa/eliminaSpesa)",
    true,
    /registraSpesa/.test(pannello) &&
      /correggiSpesa/.test(pannello) &&
      /eliminaSpesa/.test(pannello),
  );
  c(
    "nessuna tabella nuova: il pannello non nomina spesa_ads_giorno",
    false,
    /spesa_ads_giorno/.test(pannello),
  );
  c(
    "l'intestazione della chat monta il tasto, e solo per chi vede i costi",
    true,
    /<TastoSpesaLead/.test(pagina) && /vedeCosti[\s\S]{0,40}TastoSpesaLead/.test(pagina),
  );
  c("tasto da almeno 44 px sul telefono", true, /min-h-11/.test(pannello));
  c(
    "niente scorrimento orizzontale nel pannello",
    false,
    /overflow-x-auto|overflow-x-scroll/.test(pannello),
  );
}
