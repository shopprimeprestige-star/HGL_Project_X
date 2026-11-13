/** ── FATTURE DALLA CHAT · T3 · L'ADATTATORE AL MOTORE (valuta-chat.ts) ──────
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO §4, T3). `valuta-chat.ts` non
 *  si bundla con `MODULI` di `prove/prove.mjs` (quell'elenco lo scrive il solo
 *  T0): si impacchetta QUI con esbuild, stesso schema di
 *  `prove/fatture-bulk/interfaccia.mjs` per `cambio-riga.ts`.
 *  ⚠️ Dati inventati: nomi di fantasia, CF col carattere di controllo calcolato
 *   (copia di `cfConControllo`, come già fa `prove/fatture-bulk/dati.mjs`).
 *   Nessun dato vero, in nessuna prova di questo file. */
import { createRequire } from "node:module";
import { join } from "node:path";
import { LOTTO_PROVA, SCHEDA_PROVA, SCHEDA_PROVA_ALTRA } from "./dati.mjs";

const ALF = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DISP = [
  1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8,
  12, 14, 16, 10, 22, 25, 24, 23,
];
/** I primi 15 caratteri più il carattere di controllo giusto. */
function cfConControllo(quindici) {
  let s = 0;
  for (let i = 0; i < 15; i++) {
    const k = ALF.indexOf(quindici[i]);
    s += i % 2 === 0 ? DISP[k] : k < 10 ? k : k - 10;
  }
  return quindici + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[s % 26];
}
function pivaConControllo(dieci) {
  let s = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(dieci[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    s += d;
  }
  return dieci + String((10 - (s % 10)) % 10);
}

/** Mario Rossi: il cliente scelto al passo 1. */
const CF_MARIO = cfConControllo("RSSMRA80A01H501");
/** Anna Rossi: la moglie, tessera trovata nella stessa chat (il caso del revisore). */
const CF_ANNA = cfConControllo("RSSNNA85M41H501");
/** Un CF diverso da CF_MARIO, scritto (forse male) sulla scheda. */
const CF_SCHEDA_DIVERSO = cfConControllo("RSSMRA75A01H501");

const PIVA = pivaConControllo("1234567001");
const AZIENDA = {
  denominazione: "ESEMPIO CAPELLI S.R.L.",
  partitaIva: PIVA,
  codiceFiscale: PIVA,
  regimeFiscale: "RF01",
  indirizzo: "Via dei Ciliegi",
  civico: "5",
  cap: "20100",
  comune: "Milano",
  provincia: "MI",
  nazione: "IT",
  reaUfficio: "",
  reaNumero: "",
  pec: "esempio@pec.example",
  iban: "IT60X0542811101000000123456",
  aliquotaPredefinita: 22,
  primoNumero: 1,
  annoNumerazione: 2026,
  serie: "",
};

const OGGI = "2026-11-13";
const lotto = (x = {}) => ({
  lotto: LOTTO_PROVA,
  creatoIl: "2026-11-13T08:00:00.000Z",
  descrizione: "",
  dataSeManca: "",
  firmaImpostazioni: "f",
  ...x,
});
const ctx = (x = {}) => ({
  lotto: lotto(),
  azienda: AZIENDA,
  oggi: OGGI,
  emesse: [],
  bozze: [],
  schede: [],
  impronteAltriLotti: [],
  ...x,
});

/** La scheda scelta al passo 1: Mario Rossi, nessun pagamento noto (di default). */
const scheda = (x = {}) => ({
  id: SCHEDA_PROVA,
  nome: "Mario",
  cognome: "Rossi",
  codiceFiscale: "",
  telefono: "331234567",
  importoScheda: null,
  ...x,
});

const lTessera = (x = {}) => ({
  tipo: "tessera",
  nome: "Mario",
  cognome: "Rossi",
  codiceFiscale: CF_MARIO,
  cfLetto: CF_MARIO,
  incerti: [],
  ...x,
});
const lIndirizzo = (x = {}) => ({
  tipo: "indirizzo",
  indirizzo: "Via dei Tigli 4",
  cap: "20100",
  comune: "Milano",
  provincia: "MI",
  telefono: "331234567",
  nome: "Mario",
  cognome: "Rossi",
  indirizzoDiSpedizione: false,
  incerti: [],
  ...x,
});
const lPagamento = (x = {}) => ({
  tipo: "pagamento",
  importo: 120,
  importoAltro: null,
  valuta: "EUR",
  esito: "completato",
  data: "2026-11-10",
  meseGiorno: "",
  dataTesto: "10/11/2026",
  annoVisibile: true,
  formatoAmbiguo: false,
  modo: "bonifico",
  modoIncerto: false,
  riferimento: "RIF123456",
  paganteCognome: "Rossi",
  incerti: [],
  ...x,
});

/** Una `RigaChat` «aperta», con lettura di chat e pagamento regolari (tutto a posto). */
const rigaChat = (x = {}) => ({
  idRiga: SCHEDA_PROVA,
  scheda: SCHEDA_PROVA,
  stato: "aperta",
  chat: {
    letta: true,
    tessera: lTessera(),
    indirizzo: lIndirizzo(),
    motivi: [],
    segnaposto: false,
  },
  pagamento: { stato: "letto", impronta: "imp-pag-1", lettura: lPagamento() },
  ...x,
});

const ha = (r, codice, gravita) =>
  r.motivi.some((m) => m.codice === codice && (!gravita || m.gravita === gravita));

export async function prove(_mod, { c, gruppo, radice }) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const impacchettato = esbuild.buildSync({
    entryPoints: [join(radice, "src/crm/fatture/dalla-chat/valuta-chat.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).outputFiles[0].text;
  const VC = await import(
    `data:text/javascript;base64,${Buffer.from(impacchettato).toString("base64")}`
  );

  /* ══ 1. rigaSinteticaDa: i 3 ruoli fissi, mai ricomposta ══════════════════ */
  gruppo("DALLA CHAT · T3 · rigaSinteticaDa");
  {
    const s = scheda();
    const { gruppo: g, file } = VC.rigaSinteticaDa(rigaChat(), s);
    c(
      "il gruppo non è mai incompleta/ordineDiverso/ricomposta, idRiga = quello della riga",
      { incompleta: false, ordineDiverso: false, ricomposta: false, idRiga: SCHEDA_PROVA },
      {
        incompleta: g.incompleta,
        ordineDiverso: g.ordineDiverso,
        ricomposta: g.ricomposta,
        idRiga: g.idRiga,
      },
    );
    c(
      "i 3 ruoli, in ordine: indirizzo, tessera, pagamento",
      ["indirizzo", "tessera", "pagamento"],
      file.map((f) => f.tipo),
    );
    c(
      "la lettura della tessera ha nome/cognome della SCHEDA, non quelli passati alla lettura (qui uguali, lo scenario «familiare» è sotto)",
      { nome: "Mario", cognome: "Rossi" },
      { nome: file[1].lettura.nome, cognome: file[1].lettura.cognome },
    );
  }
  {
    // ⚠️ Nota del revisore sul piano v2: SEMPRE, anche senza nessuna tessera trovata (nessun CF).
    const s = scheda();
    const { file } = VC.rigaSinteticaDa(
      rigaChat({ chat: { letta: true, motivi: [], segnaposto: false } }),
      s,
    );
    c(
      "nome/cognome della scheda anche se in chat non si è trovata NESSUNA tessera",
      { nome: "Mario", cognome: "Rossi", codiceFiscale: "" },
      {
        nome: file[1].lettura.nome,
        cognome: file[1].lettura.cognome,
        codiceFiscale: file[1].lettura.codiceFiscale,
      },
    );
  }
  {
    // L'incertezza letta sulla foto per nome/cognome non deve mai finire nella lettura sintetica:
    // quei due campi non vengono mai da lì, quindi non sono mai «da confermare» per questo.
    const s = scheda();
    const { file } = VC.rigaSinteticaDa(
      rigaChat({
        chat: {
          letta: true,
          tessera: lTessera({ incerti: ["nome", "cognome", "codiceFiscale"] }),
          indirizzo: lIndirizzo(),
          motivi: [],
          segnaposto: false,
        },
      }),
      s,
    );
    c(
      "«nome»/«cognome» non restano mai negli incerti della lettura sintetica (solo codiceFiscale)",
      ["codiceFiscale"],
      file[1].lettura.incerti,
    );
  }

  /* ══ 2. La riga perfetta: nessuna soppressione quando il pagamento c'è ═══ */
  gruppo("DALLA CHAT · T3 · LA RIGA PERFETTA (pagamento già letto, importo che combacia)");
  {
    const s = scheda({ importoScheda: 120 });
    const r = VC.valutaRigaChat(rigaChat(), s, ctx({ schede: [s] }));
    c(
      "stato «pronto», non emettibile finché non si conferma",
      ["pronto", false],
      [r.stato, r.emettibile],
    );
    c(
      "i campi vengono dalla scheda e dalla chat, come una riga bulk equivalente",
      {
        nome: "Mario",
        cognome: "Rossi",
        codiceFiscale: CF_MARIO,
        importo: 120,
        data: "2026-11-10",
      },
      {
        nome: r.campi.nome,
        cognome: r.campi.cognome,
        codiceFiscale: r.campi.codiceFiscale,
        importo: r.campi.importo,
        data: r.campi.data,
      },
    );
    c(
      "nessuna soppressione di motivi quando il pagamento c'è (niente chat_manca_pagamento)",
      false,
      ha(r, "chat_manca_pagamento"),
    );
  }

  /* ══ 3. Tessera di un familiare: nome/cognome sempre scheda, cf_non_combacia ═ */
  gruppo("DALLA CHAT · T3 · LA TESSERA DI UN FAMILIARE (il caso del revisore)");
  {
    const s = scheda(); // Mario Rossi, codiceFiscale vuoto in scheda: isola il caso da «scheda_cf_diverso».
    const riga = rigaChat({
      chat: {
        letta: true,
        tessera: lTessera({
          nome: "Anna",
          cognome: "Rossi",
          codiceFiscale: CF_ANNA,
          cfLetto: CF_ANNA,
        }),
        indirizzo: lIndirizzo({ nome: "Anna", cognome: "Rossi" }),
        motivi: [],
        segnaposto: false,
      },
    });
    const r = VC.valutaRigaChat(riga, s, ctx({ schede: [s] }));
    c(
      "CampiRiga.nome/.cognome sono SEMPRE quelli della scheda (Mario Rossi), mai quelli letti sulla foto (Anna)",
      { nome: "Mario", cognome: "Rossi" },
      { nome: r.campi.nome, cognome: r.campi.cognome },
    );
    c(
      "il codice fiscale letto (quello di Anna) resta, non si azzera",
      CF_ANNA,
      r.campi.codiceFiscale,
    );
    c(
      "la riga è «Da controllare», col motivo cf_non_combacia (conferma)",
      "da_controllare",
      r.stato,
    );
    c("cf_non_combacia c'è, per gravità «conferma»", true, ha(r, "cf_non_combacia", "conferma"));
    c(
      "nessun secondo motivo duplicato che dica la stessa cosa (un solo motivo sul CF/nome)",
      1,
      r.motivi.filter((m) => m.campo === "codiceFiscale" || m.codice === "cf_non_combacia").length,
    );
  }

  /* ══ 4. Riga senza nessuna lettura: asterischi + Errore, un solo motivo sul pagamento ═ */
  gruppo("DALLA CHAT · T3 · NIENTE TROVATO IN CHAT, NESSUN BONIFICO ANCORA");
  {
    const s = scheda();
    const riga = rigaChat({
      chat: {
        letta: true,
        motivi: [
          {
            codice: "chat_nessuna_trovata",
            gravita: "avviso",
            testo: "Nessuna chat trovata per questo numero: completa a mano.",
          },
        ],
        segnaposto: false,
      },
      pagamento: undefined,
    });
    const r = VC.valutaRigaChat(riga, s, ctx({ schede: [s] }));
    c("la riga è «Errore» (il bloccante strutturale è il pagamento mancante)", "errore", r.stato);
    c(
      "chat_manca_pagamento c'è, blocca, strutturale",
      true,
      ha(r, "chat_manca_pagamento", "blocca"),
    );
    c(
      "i tre motivi generici sul pagamento (prodotti da esaminaRiga da sola) NON ci sono",
      [false, false, false],
      [ha(r, "importo_mancante"), ha(r, "modo_mancante"), ha(r, "data_mancante")],
    );
    c(
      "CF e indirizzo restano visibili nello stesso elenco (asterisco), non sostituiti dal motivo del pagamento",
      [true, true, true, true, true],
      [
        ha(r, "cf_mancante", "blocca"),
        ha(r, "indirizzo_mancante", "blocca"),
        ha(r, "cap_mancante", "blocca"),
        ha(r, "comune_mancante", "blocca"),
        ha(r, "provincia_mancante", "blocca"),
      ],
    );
    c(
      "nome/cognome non mancano mai (vengono dalla scheda anche senza nessuna tessera trovata)",
      [false, false],
      [ha(r, "nome_mancante"), ha(r, "cognome_mancante")],
    );
    c(
      "l'avviso di T2 (nessuna chat trovata) resta nell'elenco",
      true,
      ha(r, "chat_nessuna_trovata", "avviso"),
    );
  }

  /* ══ 5. Importo del bonifico diverso da quello già in scheda ═════════════ */
  gruppo("DALLA CHAT · T3 · IMPORTO DEL BONIFICO DIVERSO DA QUELLO DELLA SCHEDA");
  {
    const s = scheda({ importoScheda: 100 });
    const r = VC.valutaRigaChat(
      rigaChat({
        pagamento: { stato: "letto", impronta: "imp-pag-2", lettura: lPagamento({ importo: 150 }) },
      }),
      s,
      ctx({ schede: [s] }),
    );
    c("la riga è «Da controllare», non bloccata", "da_controllare", r.stato);
    c(
      "chat_importo_diverso c'è, per gravità «conferma» (non blocca)",
      true,
      ha(r, "chat_importo_diverso", "conferma"),
    );
    c(
      "il testo confronta i due importi (150 € dello screenshot, 100 € già in scheda)",
      true,
      /150 €.*100 €/.test(r.motivi.find((m) => m.codice === "chat_importo_diverso").testo),
    );
  }

  /* ══ 6. CF della chat diverso da quello già scritto sulla scheda ═════════ */
  gruppo("DALLA CHAT · T3 · CF DIVERSO DA QUELLO GIÀ SCRITTO SULLA SCHEDA");
  {
    const s = scheda({ codiceFiscale: CF_SCHEDA_DIVERSO }); // scritto a mano sulla scheda, diverso da quello letto in chat
    const r = VC.valutaRigaChat(rigaChat(), s, ctx({ schede: [s] }));
    c(
      "scheda_cf_diverso c'è, per gravità «conferma» (motivo della bulk, non uno nostro)",
      true,
      ha(r, "scheda_cf_diverso", "conferma"),
    );
    c(
      "niente cf_non_combacia (il CF letto combacia col nome della scheda)",
      false,
      ha(r, "cf_non_combacia"),
    );
  }

  /* ══ 7. Doppioni: stesso riferimento del bonifico in due righe del lotto ═ */
  gruppo("DALLA CHAT · T3 · DOPPIONI (stessa trovaDoppioni, stesso import)");
  {
    const s1 = scheda({ id: SCHEDA_PROVA, importoScheda: null });
    const s2 = scheda({
      id: SCHEDA_PROVA_ALTRA,
      nome: "Luca",
      cognome: "Bianchi",
      importoScheda: null,
    });
    const riga1 = rigaChat({ idRiga: SCHEDA_PROVA, scheda: SCHEDA_PROVA });
    const riga2 = rigaChat({
      idRiga: SCHEDA_PROVA_ALTRA,
      scheda: SCHEDA_PROVA_ALTRA,
      chat: {
        letta: true,
        tessera: lTessera({ nome: "Luca", cognome: "Bianchi", codiceFiscale: "", cfLetto: "" }),
        indirizzo: lIndirizzo({ nome: "Luca", cognome: "Bianchi" }),
        motivi: [],
        segnaposto: false,
      },
      pagamento: {
        stato: "letto",
        impronta: "imp-pag-3",
        lettura: lPagamento({ riferimento: "RIF123456" }),
      }, // STESSO riferimento della riga 1
    });
    const { righe } = VC.valutaLottoChat(
      [
        { riga: riga1, scheda: s1 },
        { riga: riga2, scheda: s2 },
      ],
      ctx({ schede: [s1, s2] }),
    );
    c(
      "tutte e due le righe portano doppione_riferimento, che blocca (come nella bulk)",
      [true, true],
      [
        ha(righe[0], "doppione_riferimento", "blocca"),
        ha(righe[1], "doppione_riferimento", "blocca"),
      ],
    );
  }

  /* ══ 8. Il §0: impronteAltriLotti passato dal chiamante, non ignorato ════ */
  gruppo("DALLA CHAT · T3 · impronteAltriLotti (§0, nessun codice nuovo qui: passa tale e quale)");
  {
    const s = scheda({ importoScheda: 120 });
    const senzaAltriLotti = VC.valutaRigaChat(
      rigaChat(),
      s,
      ctx({ schede: [s], impronteAltriLotti: [] }),
    );
    const conAltroLotto = VC.valutaRigaChat(
      rigaChat(),
      s,
      ctx({ schede: [s], impronteAltriLotti: ["imp-pag-1"] }),
    );
    c(
      "senza altri lotti aperti, nessun doppione di screenshot",
      false,
      ha(senzaAltriLotti, "doppione_screenshot"),
    );
    c(
      "con l'impronta del pagamento già vista in un altro lotto «dalla chat» aperto, doppione_screenshot blocca",
      true,
      ha(conAltroLotto, "doppione_screenshot", "blocca"),
    );
  }

  /* ══ 9. Righe chiuse: nessuna regola in più, come nella bulk ═════════════ */
  gruppo("DALLA CHAT · T3 · RIGHE EMESSE/SCARTATE NON RICHIAMANO esaminaRiga");
  {
    const s = scheda();
    const emessaR = VC.valutaRigaChat(
      rigaChat({
        stato: "emessa",
        pagamento: undefined,
        emessa: { id: "2026-0001", numero: 1, data: "2026-11-10" },
      }),
      s,
      ctx({ schede: [s], emesse: [] }),
    );
    c(
      "riga emessa: stato «emessa», nessun motivo nostro aggiunto (niente chat_manca_pagamento)",
      ["emessa", []],
      [emessaR.stato, emessaR.motivi],
    );
    const scartataR = VC.valutaRigaChat(
      rigaChat({ stato: "scartata", pagamento: undefined }),
      s,
      ctx({ schede: [s] }),
    );
    c(
      "riga scartata: stato «scartata», nessun motivo nostro aggiunto",
      ["scartata", []],
      [scartataR.stato, scartataR.motivi],
    );
  }
}
