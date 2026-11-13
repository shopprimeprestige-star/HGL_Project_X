/** ── FATTURE DALLA CHAT · T11.2 · IL PAGAMENTO SCRITTO A MANO ───────────────
 *  Commessa 2026-11-13-fatture-dalla-chat (SPEC §9.3 passo 7, §9.7 criterio 3,
 *  PIANO T11.2). `pagamentoManualeValido({importo,data,modo,riferimento})`:
 *  puro, nessuna rete. I controlli minimi (importo intero positivo, data
 *  AAAA-MM-GG di un giorno vero, modo in `MetodoPagamento`) sono quelli che
 *  decidono se il chiamante può scrivere `chat_fatture_p` o deve rispondere
 *  `richiesta_non_valida` senza scrivere nulla. */
import { createRequire } from "node:module";
import { join } from "node:path";
import { LOTTO_PROVA, SCHEDA_PROVA, SCHEDA_PROVA_ALTRA } from "./dati.mjs";

async function impacchetta(radice, percorsoRelativo) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const risultato = esbuild.buildSync({
    entryPoints: [join(radice, percorsoRelativo)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const testo = risultato.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
}

const BASE = { importo: 100, data: "2026-11-01", modo: "bonifico", riferimento: "CRO123456" };

export async function prove(_mod, { c, gruppo, radice }) {
  const P = await impacchetta(radice, "src/crm/fatture/dalla-chat/pagamento-manuale.ts");

  gruppo("DALLA CHAT · T11.2 · 4 campi validi → LetturaPagamento pronta per rigaSinteticaDa");
  {
    const l = P.pagamentoManualeValido(BASE);
    c("torna un oggetto (non null)", true, l !== null);
    c("tipo = pagamento", "pagamento", l?.tipo);
    c("importo riportato tale e quale", 100, l?.importo);
    c("data riportata tale e quale", "2026-11-01", l?.data);
    c("modo riportato tale e quale", "bonifico", l?.modo);
    c("riferimento riportato tale e quale", "CRO123456", l?.riferimento);
    c("esito = completato (un pagamento scritto a mano non è «in corso»)", "completato", l?.esito);
    c("valuta = EUR", "EUR", l?.valuta);
    c("nessun incerto (è scritto a mano, non letto da un'AI)", 0, l?.incerti?.length);
    c("paganteCognome vuoto (non si chiede qui, SPEC §9.3)", "", l?.paganteCognome);
    c("importoAltro null (non c'è un secondo importo da dubitare)", null, l?.importoAltro);
  }

  gruppo(
    "DALLA CHAT · T11.2 · il riferimento è l'UNICO campo facoltativo (modi-di-incasso.ts: «IL DATO NON È MAI OBBLIGATORIO»)",
  );
  {
    const l = P.pagamentoManualeValido({ ...BASE, riferimento: "" });
    c("riferimento vuoto → comunque valida", true, l !== null);
    c("riferimento resta vuoto (non inventato)", "", l?.riferimento);
  }

  gruppo(
    "DALLA CHAT · T11.2 · importo: deve essere un intero positivo (decisione del titolare: fattura sempre un importo intero)",
  );
  {
    c("importo 0 → non valido", null, P.pagamentoManualeValido({ ...BASE, importo: 0 }));
    c("importo negativo → non valido", null, P.pagamentoManualeValido({ ...BASE, importo: -50 }));
    c(
      "importo con decimali → non valido (qui, non nella bulk)",
      null,
      P.pagamentoManualeValido({ ...BASE, importo: 99.5 }),
    );
    c("importo stringa → non valido", null, P.pagamentoManualeValido({ ...BASE, importo: "100" }));
    c(
      "importo assente → non valido",
      null,
      P.pagamentoManualeValido({ ...BASE, importo: undefined }),
    );
    c("importo NaN → non valido", null, P.pagamentoManualeValido({ ...BASE, importo: NaN }));
    c(
      "importo Infinity → non valido",
      null,
      P.pagamentoManualeValido({ ...BASE, importo: Infinity }),
    );
  }

  gruppo("DALLA CHAT · T11.2 · data: AAAA-MM-GG di un giorno che esiste davvero nel calendario");
  {
    c("31 febbraio → non valido", null, P.pagamentoManualeValido({ ...BASE, data: "2026-02-31" }));
    c(
      "formato gg/mm/aaaa → non valido (si vuole AAAA-MM-GG)",
      null,
      P.pagamentoManualeValido({ ...BASE, data: "01/11/2026" }),
    );
    c("data vuota → non valido", null, P.pagamentoManualeValido({ ...BASE, data: "" }));
    c(
      "data con orario → non valido (solo AAAA-MM-GG, niente altro)",
      null,
      P.pagamentoManualeValido({ ...BASE, data: "2026-11-01T10:00:00Z" }),
    );
    c(
      "29 febbraio 2024 (bisestile) → valido",
      true,
      P.pagamentoManualeValido({ ...BASE, data: "2024-02-29" }) !== null,
    );
    c(
      "29 febbraio 2026 (non bisestile) → non valido",
      null,
      P.pagamentoManualeValido({ ...BASE, data: "2026-02-29" }),
    );
  }

  gruppo(
    "DALLA CHAT · T11.2 · modo: deve stare nell'elenco chiuso MetodoPagamento (modi-di-incasso.ts)",
  );
  {
    c(
      "contanti → valido",
      "contanti",
      P.pagamentoManualeValido({ ...BASE, modo: "contanti" })?.modo,
    );
    c("carta → valido", "carta", P.pagamentoManualeValido({ ...BASE, modo: "carta" })?.modo);
    c("pos → valido", "pos", P.pagamentoManualeValido({ ...BASE, modo: "pos" })?.modo);
    c(
      "paypal (fuori elenco) → non valido, mai un bonifico di ripiego",
      null,
      P.pagamentoManualeValido({ ...BASE, modo: "paypal" }),
    );
    c(
      "satispay (fuori elenco) → non valido",
      null,
      P.pagamentoManualeValido({ ...BASE, modo: "satispay" }),
    );
    c("modo vuoto → non valido", null, P.pagamentoManualeValido({ ...BASE, modo: "" }));
    c("modo assente → non valido", null, P.pagamentoManualeValido({ ...BASE, modo: undefined }));
  }

  gruppo("DALLA CHAT · T11.2 · un'iniezione nel riferimento non sopravvive (nessun campo in più)");
  {
    const l = P.pagamentoManualeValido({ ...BASE, riferimento: "CRO<script>1234567890" });
    c(
      "il riferimento è tagliato/ripulito, non eseguito né propagato tale e quale",
      true,
      !l.riferimento.includes("<script>"),
    );
  }

  /* ══ INTEGRAZIONE CON valuta-chat.ts (T3, NON TOCCATA): la riga si sblocca ═
   *  La prova che il piano chiede esplicitamente per T11.2: dopo `scrivi-pagamento` la riga non
   *  deve più mostrare `chat_manca_pagamento` né i 3 motivi generici (`importo_mancante`/
   *  `modo_mancante`/`data_mancante`) — e questo deve succedere SENZA toccare `valuta-chat.ts`,
   *  perché `pagamentoManualeValido` produce una `LetturaPagamento` della stessa identica forma di
   *  quella letta da uno screenshot. Un'impronta vuota (`chat.server.ts` scrive sempre
   *  `impronta:""` per `scrivi-pagamento`, non c'è nessuno screenshot) non genera mai un doppione
   *  per screenshot (verificato in `doppioni-e-schede.ts`: il controllo scatta solo `if (imp)`),
   *  ma il riferimento scritto a mano resta un vero doppione se ripetuto. */
  const VC = await impacchetta(radice, "src/crm/fatture/dalla-chat/valuta-chat.ts");
  const AZIENDA = {
    denominazione: "ESEMPIO CAPELLI S.R.L.",
    partitaIva: "12345670017",
    codiceFiscale: "12345670017",
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
  const ctx = (x = {}) => ({
    lotto: {
      lotto: LOTTO_PROVA,
      creatoIl: "2026-11-13T08:00:00.000Z",
      descrizione: "",
      dataSeManca: "",
      firmaImpostazioni: "f",
    },
    azienda: AZIENDA,
    oggi: "2026-11-13",
    emesse: [],
    bozze: [],
    schede: [],
    impronteAltriLotti: [],
    ...x,
  });
  const schedaMario = {
    id: SCHEDA_PROVA,
    nome: "Mario",
    cognome: "Rossi",
    codiceFiscale: "",
    telefono: "331234567",
    importoScheda: null,
  };
  const schedaAnna = {
    id: SCHEDA_PROVA_ALTRA,
    nome: "Anna",
    cognome: "Verdi",
    codiceFiscale: "",
    telefono: "339876543",
    importoScheda: null,
  };
  const rigaSenzaChat = (idRiga, scheda) => ({
    idRiga,
    scheda: scheda.id,
    stato: "aperta",
    chat: { letta: true, motivi: [], segnaposto: false },
  });

  gruppo(
    "DALLA CHAT · T11.2 · dopo scrivi-pagamento la riga si sblocca (zero modifiche a valuta-chat.ts)",
  );
  {
    const prima = VC.valutaRigaChat(rigaSenzaChat(SCHEDA_PROVA, schedaMario), schedaMario, ctx());
    c(
      "prima: chat_manca_pagamento è bloccante",
      true,
      prima.motivi.some((m) => m.codice === "chat_manca_pagamento" && m.gravita === "blocca"),
    );

    const lettura = P.pagamentoManualeValido(BASE);
    const rigaConPagamento = {
      ...rigaSenzaChat(SCHEDA_PROVA, schedaMario),
      pagamento: { stato: "letto", impronta: "", lettura },
    };
    const dopo = VC.valutaRigaChat(rigaConPagamento, schedaMario, ctx());
    c(
      "dopo: chat_manca_pagamento è sparito",
      false,
      dopo.motivi.some((m) => m.codice === "chat_manca_pagamento"),
    );
    c(
      "dopo: nessuno dei 3 motivi generici (importo/modo/data mancante)",
      false,
      dopo.motivi.some((m) =>
        ["importo_mancante", "modo_mancante", "data_mancante"].includes(m.codice),
      ),
    );
    c(
      "dopo: importo/data/modo/riferimento sono quelli scritti a mano",
      true,
      dopo.campi.importo === 100 &&
        dopo.campi.data === "2026-11-01" &&
        dopo.campi.modo === "bonifico" &&
        dopo.campi.riferimento === "CRO123456",
    );
  }

  gruppo(
    "DALLA CHAT · T11.2 · stesso riferimento scritto a mano su 2 righe → doppione_riferimento (bloccante), un'impronta vuota non ne genera uno per screenshot",
  );
  {
    const lettura1 = P.pagamentoManualeValido(BASE);
    const lettura2 = P.pagamentoManualeValido({ ...BASE, importo: 200 }); // stesso riferimento, importo diverso
    const righe = [
      {
        riga: {
          ...rigaSenzaChat(SCHEDA_PROVA, schedaMario),
          pagamento: { stato: "letto", impronta: "", lettura: lettura1 },
        },
        scheda: schedaMario,
      },
      {
        riga: {
          ...rigaSenzaChat(SCHEDA_PROVA_ALTRA, schedaAnna),
          pagamento: { stato: "letto", impronta: "", lettura: lettura2 },
        },
        scheda: schedaAnna,
      },
    ];
    const { righe: valutate } = VC.valutaLottoChat(righe, ctx());
    c(
      "riga 1: doppione_riferimento bloccante",
      true,
      valutate[0].motivi.some((m) => m.codice === "doppione_riferimento" && m.gravita === "blocca"),
    );
    c(
      "riga 2: anche lei doppione_riferimento (è reciproco)",
      true,
      valutate[1].motivi.some((m) => m.codice === "doppione_riferimento" && m.gravita === "blocca"),
    );
    c(
      "nessun doppione_screenshot: l'impronta vuota non ne genera uno (doppioni-e-schede.ts: `if (imp)`)",
      false,
      valutate[0].motivi.some((m) => m.codice === "doppione_screenshot") ||
        valutate[1].motivi.some((m) => m.codice === "doppione_screenshot"),
    );
  }
}
