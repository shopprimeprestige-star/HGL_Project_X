/** ── NEGOZIO · RILASCIO 2 · T48 · LA VALIDAZIONE DELLA RICHIESTA DI CASSA ─────────────────────────────
 *  `src/shop/cassa/validazione.ts` (SPEC 7.4 n. 6, D14, §3.1): `validaRichiesta(corpo)` → `{ok:true, valore}` con i dati NORMALIZZATI
 *  oppure `{ok:false, motivo:"valore", frase, campi:{campo: frase}}`. Si usano i validatori di T45 (nessun controllo copiato).
 *   · tetti di lunghezza per ogni testo; un valore che non è del tipo giusto non si converte mai, si rifiuta;
 *   · fattura: se richiesta, denominazione e codice fiscale (privato) o partita IVA (azienda) sono obbligatori e giusti;
 *   · le due caselle di legge devono valere esattamente `true`;
 *   · `attribuzione` solo con le chiavi ammesse (D14); senza consenso di marketing restano le sole `utm_*`;
 *   · le frasi non ripetono mai quanto ha scritto il cliente; le chiavi sconosciute del corpo non passano.
 *  Il CF dei vettori lo calcola la prova con l'algoritmo del DM 1976 scritto per conto suo (come `fiscale.mjs`): dati INVENTATI. */

const DISPARI = {
  0: 1,
  1: 0,
  2: 5,
  3: 7,
  4: 9,
  5: 13,
  6: 15,
  7: 17,
  8: 19,
  9: 21,
  A: 1,
  B: 0,
  C: 5,
  D: 7,
  E: 9,
  F: 13,
  G: 15,
  H: 17,
  I: 19,
  J: 21,
  K: 2,
  L: 4,
  M: 18,
  N: 20,
  O: 11,
  P: 3,
  Q: 6,
  R: 8,
  S: 12,
  T: 14,
  U: 16,
  V: 10,
  W: 22,
  X: 25,
  Y: 24,
  Z: 23,
};
const valorePari = (ch) => (/\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65);
const cfCompleto = (quindici) =>
  quindici +
  String.fromCharCode(
    65 +
      ([...quindici].reduce((s, ch, i) => s + (i % 2 === 0 ? DISPARI[ch] : valorePari(ch)), 0) %
        26),
  );
const luhnOk = (cifre) =>
  [...cifre].reverse().reduce((s, ch, i) => {
    let d = Number(ch);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    return s + d;
  }, 0) %
    10 ===
  0;
const pivaCompleta = (dieci) => {
  for (let d = 0; d < 10; d++) if (luhnOk(dieci + d)) return dieci + d;
  throw new Error("impossibile");
};
const CF = cfCompleto("XYZABC85C12Z404");
const PIVA = pivaCompleta("1234567890");

const corpoOk = () => ({
  permesso: "1700000000000.permesso-di-prova",
  tentativo: "00000000-0000-4000-8000-000000000001",
  totaleAttesoCent: 8260,
  righe: [
    { sku: "PROVA-A", qty: 2 },
    { sku: "PROVA-B", qty: 1 },
  ],
  contatti: {
    nome: "Anna",
    cognome: "Prova",
    email: "anna@example.com",
    telefono: "+39 300 000 0001",
  },
  spedizione: {
    indirizzo: "Via Finta 1",
    citta: "Cittafinta",
    cap: "00100",
    provincia: "RM",
    nazione: "IT",
  },
  note: "Citofono guasto",
  consensi: { termini: true, privacy: true, versione: "2026-11-20" },
  consensoMarketing: false,
  sito_web: "",
});
/** Una copia con una modifica: `m(c => { c.contatti.nome = "" })`. */
const con = (m) => {
  const c = corpoOk();
  m(c);
  return c;
};
const italiana = (f) =>
  typeof f === "string" &&
  f.length >= 8 &&
  /[a-zàèéìòù]{3}/.test(f) &&
  !/[{}]|undefined|\[object/.test(f);

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T48 · LA VALIDAZIONE DELLA RICHIESTA DI CASSA (21/11/2026)");
  const V = mod["shop/cassa/validazione"];
  c("il modulo src/shop/cassa/validazione.ts esiste", true, !!V);
  if (!V) return;
  const { validaRichiesta } = V;
  const campiDi = (corpo) => {
    const e = validaRichiesta(corpo);
    return e.ok ? null : e.campi;
  };
  const rifiuta = (nome, corpo, campo) => {
    const e = validaRichiesta(corpo);
    c(
      nome,
      campo ? [false, true] : false,
      campo ? [e.ok, !!e.campi && typeof e.campi[campo] === "string"] : e.ok,
    );
    return e;
  };

  // ── il caso onesto, normalizzato ──
  const ok = validaRichiesta(corpoOk());
  c("una richiesta onesta passa", true, ok.ok);
  c(
    "il valore normalizzato ha le sole chiavi del contratto",
    [
      "attribuzione",
      "consensi",
      "consensoMarketing",
      "contatti",
      "fattura",
      "note",
      "permesso",
      "righe",
      "spedizione",
      "tentativo",
      "totaleAttesoCent",
    ],
    Object.keys(ok.valore ?? {}).sort(),
  );
  c(
    "…contatti e spedizione ripuliti",
    {
      contatti: {
        nome: "Anna",
        cognome: "Prova",
        email: "anna@example.com",
        telefono: "+393000000001",
      },
      spedizione: {
        indirizzo: "Via Finta 1",
        citta: "Cittafinta",
        cap: "00100",
        provincia: "RM",
        nazione: "IT",
      },
    },
    { contatti: ok.valore?.contatti, spedizione: ok.valore?.spedizione },
  );
  c(
    "…righe come {sku, qty}, totale atteso, tentativo, permesso, consensi",
    {
      righe: [
        { sku: "PROVA-A", qty: 2 },
        { sku: "PROVA-B", qty: 1 },
      ],
      totaleAttesoCent: 8260,
      note: "Citofono guasto",
      fattura: null,
      consensoMarketing: false,
    },
    {
      righe: ok.valore?.righe,
      totaleAttesoCent: ok.valore?.totaleAttesoCent,
      note: ok.valore?.note,
      fattura: ok.valore?.fattura,
      consensoMarketing: ok.valore?.consensoMarketing,
    },
  );
  c(
    "…i consensi tornano con la versione dei testi di legge",
    { termini: true, privacy: true, versione: "2026-11-20" },
    ok.valore?.consensi,
  );
  c("la trappola `sito_web` non entra nel valore", false, "sito_web" in (ok.valore ?? {}));

  const sporca = con((x) => {
    x.isAdmin = true;
    x.prezzoCent = 1;
    x.righe[0].prezzoCent = 1;
    x.righe[0].unit_price = 0.01;
    x.contatti.ruolo = "admin";
    x.spedizione.corriere = "x";
  });
  const vs = validaRichiesta(sporca);
  c(
    "chiavi sconosciute (anche prezzi dentro le righe) NON passano",
    true,
    vs.ok && !/isAdmin|prezzo|unit_price|ruolo|corriere/.test(JSON.stringify(vs.valore)),
  );

  // ── forma del corpo ──
  for (const [nome, v] of [
    ["null", null],
    ["undefined", undefined],
    ["testo", "ciao"],
    ["un elenco", []],
    ["un numero", 3],
  ])
    rifiuta(`corpo ${nome} → rifiutato, senza eccezione`, v);
  for (const [nome, v] of [
    ["contatti", undefined],
    ["spedizione", null],
    ["consensi", "si"],
  ])
    rifiuta(
      `sezione ${nome} mancante o storta → rifiutata`,
      con((x) => {
        const k = nome;
        x[k] = v;
      }),
    );
  const falla = validaRichiesta(
    con((x) => {
      x.contatti.nome = "";
    }),
  );
  c(
    "l'errore ha motivo valore, una frase generale in italiano e le frasi per campo",
    ["valore", true, true],
    [falla.motivo, italiana(falla.frase), italiana(falla.campi?.nome)],
  );

  // ── i testi: obbligatori, tetti, non testo ──
  for (const [sezione, campo] of [
    ["contatti", "nome"],
    ["contatti", "cognome"],
    ["contatti", "email"],
    ["contatti", "telefono"],
    ["spedizione", "indirizzo"],
    ["spedizione", "citta"],
    ["spedizione", "cap"],
    ["spedizione", "provincia"],
  ]) {
    rifiuta(
      `${campo} vuoto → campi.${campo}`,
      con((x) => {
        x[sezione][campo] = "";
      }),
      campo,
    );
    rifiuta(
      `${campo} di soli spazi → campi.${campo}`,
      con((x) => {
        x[sezione][campo] = "   ";
      }),
      campo,
    );
    rifiuta(
      `${campo} non testo (numero) → campi.${campo}`,
      con((x) => {
        x[sezione][campo] = 12;
      }),
      campo,
    );
    rifiuta(
      `${campo} mancante → campi.${campo}`,
      con((x) => {
        delete x[sezione][campo];
      }),
      campo,
    );
  }
  rifiuta(
    "nome di 61 caratteri → campi.nome",
    con((x) => {
      x.contatti.nome = "a".repeat(61);
    }),
    "nome",
  );
  c(
    "nome di 60 caratteri → accettato",
    true,
    validaRichiesta(
      con((x) => {
        x.contatti.nome = "a".repeat(60);
      }),
    ).ok,
  );
  rifiuta(
    "indirizzo di 10.000 caratteri → campi.indirizzo",
    con((x) => {
      x.spedizione.indirizzo = "Via ".repeat(2500);
    }),
    "indirizzo",
  );
  rifiuta(
    "città di 10.000 caratteri → campi.citta",
    con((x) => {
      x.spedizione.citta = "x".repeat(10_000);
    }),
    "citta",
  );
  rifiuta(
    "note di 10.000 caratteri → campi.note",
    con((x) => {
      x.note = "x".repeat(10_000);
    }),
    "note",
  );
  c(
    "note di 500 caratteri → accettate; 501 → rifiutate",
    [true, false],
    [
      validaRichiesta(
        con((x) => {
          x.note = "x".repeat(500);
        }),
      ).ok,
      validaRichiesta(
        con((x) => {
          x.note = "x".repeat(501);
        }),
      ).ok,
    ],
  );
  c(
    "note assenti, null o vuote → null (non obbligatorie)",
    [null, null, null],
    [undefined, null, "  "].map(
      (n) =>
        validaRichiesta(
          con((x) => {
            x.note = n;
          }),
        ).valore?.note,
    ),
  );
  rifiuta(
    "note non testo → campi.note",
    con((x) => {
      x.note = { a: 1 };
    }),
    "note",
  );
  c(
    "spazi doppi e ai bordi tolti, i ritorni a capo delle note restano",
    ["Anna Maria", "riga uno\nriga due"],
    (() => {
      const e = validaRichiesta(
        con((x) => {
          x.contatti.nome = "  Anna   Maria ";
          x.note = "  riga uno\nriga due  ";
        }),
      );
      return [e.valore?.contatti.nome, e.valore?.note];
    })(),
  );
  c(
    "i caratteri di controllo (NUL, ESC, BEL) spariscono",
    ["AnnaX", "Via Y"],
    (() => {
      const e = validaRichiesta(
        con((x) => {
          x.contatti.nome = "Anna\u0000\u001bX";
          x.spedizione.indirizzo = "Via\u0007 Y";
        }),
      );
      return [e.valore?.contatti.nome, e.valore?.spedizione.indirizzo];
    })(),
  );
  c(
    "nome fatto solo di caratteri di controllo → rifiutato",
    true,
    !!campiDi(
      con((x) => {
        x.contatti.nome = "\u0000\u0001";
      }),
    )?.nome,
  );

  // ── email, telefono, CAP, provincia, nazione ──
  c(
    "email maiuscola con spazi → minuscola e senza spazi",
    "anna@example.com",
    validaRichiesta(
      con((x) => {
        x.contatti.email = "  Anna@Example.COM ";
      }),
    ).valore?.contatti.email,
  );
  for (const e of [
    "anna",
    "anna@",
    "@example.com",
    "anna@example",
    "anna@@example.com",
    "an na@example.com",
    "anna@example..com",
    "a@b.c",
  ])
    rifiuta(
      `email «${e}» → campi.email`,
      con((x) => {
        x.contatti.email = e;
      }),
      "email",
    );
  rifiuta(
    "email oltre 254 caratteri → campi.email",
    con((x) => {
      x.contatti.email = `${"a".repeat(250)}@example.com`;
    }),
    "email",
  );
  rifiuta(
    "telefono «abc» → campi.telefono",
    con((x) => {
      x.contatti.telefono = "abc";
    }),
    "telefono",
  );
  rifiuta(
    "telefono di 3 cifre → campi.telefono",
    con((x) => {
      x.contatti.telefono = "123";
    }),
    "telefono",
  );
  rifiuta(
    "CAP di 4 cifre → campi.cap",
    con((x) => {
      x.spedizione.cap = "1234";
    }),
    "cap",
  );
  rifiuta(
    "CAP con lettere → campi.cap",
    con((x) => {
      x.spedizione.cap = "00A00";
    }),
    "cap",
  );
  rifiuta(
    "provincia fuori elenco (XX) → campi.provincia",
    con((x) => {
      x.spedizione.provincia = "XX";
    }),
    "provincia",
  );
  c(
    "provincia minuscola → maiuscola",
    "MI",
    validaRichiesta(
      con((x) => {
        x.spedizione.provincia = " mi ";
      }),
    ).valore?.spedizione.provincia,
  );
  rifiuta(
    "nazione FR → campi.nazione (solo Italia)",
    con((x) => {
      x.spedizione.nazione = "FR";
    }),
    "nazione",
  );
  c(
    "nazione assente → IT; «it» → IT",
    ["IT", "IT"],
    [
      validaRichiesta(
        con((x) => {
          delete x.spedizione.nazione;
        }),
      ).valore?.spedizione.nazione,
      validaRichiesta(
        con((x) => {
          x.spedizione.nazione = "it";
        }),
      ).valore?.spedizione.nazione,
    ],
  );

  // ── tentativo, totale atteso, permesso, righe (la FORMA: i limiti di quantità sono di calcolo.ts) ──
  rifiuta(
    "tentativo che non è un UUID → campi.tentativo",
    con((x) => {
      x.tentativo = "uno";
    }),
    "tentativo",
  );
  rifiuta(
    "tentativo mancante → campi.tentativo",
    con((x) => {
      delete x.tentativo;
    }),
    "tentativo",
  );
  for (const [nome, v] of [
    ["decimale", 82.6],
    ["testo", "8260"],
    ["negativo", -1],
    ["mancante", undefined],
    ["Infinity", Infinity],
  ])
    rifiuta(
      `totaleAttesoCent ${nome} → campi.totaleAttesoCent`,
      con((x) => {
        x.totaleAttesoCent = v;
      }),
      "totaleAttesoCent",
    );
  rifiuta(
    "permesso mancante → campi.permesso",
    con((x) => {
      delete x.permesso;
    }),
    "permesso",
  );
  rifiuta(
    "permesso non testo → campi.permesso",
    con((x) => {
      x.permesso = 5;
    }),
    "permesso",
  );
  rifiuta(
    "permesso di 10.000 caratteri → campi.permesso",
    con((x) => {
      x.permesso = "x".repeat(10_000);
    }),
    "permesso",
  );
  rifiuta(
    "righe vuote → campi.righe",
    con((x) => {
      x.righe = [];
    }),
    "righe",
  );
  rifiuta(
    "righe non è un elenco → campi.righe",
    con((x) => {
      x.righe = "PROVA-A";
    }),
    "righe",
  );
  rifiuta(
    "31 righe → campi.righe",
    con((x) => {
      x.righe = Array.from({ length: 31 }, (_, i) => ({ sku: `PROVA-${i}`, qty: 1 }));
    }),
    "righe",
  );
  c(
    "30 righe → accettate",
    true,
    validaRichiesta(
      con((x) => {
        x.righe = Array.from({ length: 30 }, (_, i) => ({ sku: `PROVA-${i}`, qty: 1 }));
      }),
    ).ok,
  );
  rifiuta(
    "riga con SKU non testo → campi.righe",
    con((x) => {
      x.righe = [{ sku: 7, qty: 1 }];
    }),
    "righe",
  );
  rifiuta(
    "riga con SKU vuoto → campi.righe",
    con((x) => {
      x.righe = [{ sku: "", qty: 1 }];
    }),
    "righe",
  );
  rifiuta(
    "riga con quantità testo («2») → campi.righe (niente conversioni)",
    con((x) => {
      x.righe = [{ sku: "PROVA-A", qty: "2" }];
    }),
    "righe",
  );
  rifiuta(
    "riga con quantità decimale → campi.righe",
    con((x) => {
      x.righe = [{ sku: "PROVA-A", qty: 1.5 }];
    }),
    "righe",
  );
  rifiuta(
    "riga che non è un oggetto → campi.righe",
    con((x) => {
      x.righe = [null];
    }),
    "righe",
  );
  c(
    "quantità 25 per la forma passa: la rifiuta il calcolo, riga per riga, con lo SKU",
    true,
    validaRichiesta(
      con((x) => {
        x.righe = [{ sku: "PROVA-A", qty: 25 }];
      }),
    ).ok,
  );

  // ── le due caselle di legge ──
  rifiuta(
    "consensi.termini:false → campi.termini",
    con((x) => {
      x.consensi.termini = false;
    }),
    "termini",
  );
  rifiuta(
    "consensi.privacy:false → campi.privacy",
    con((x) => {
      x.consensi.privacy = false;
    }),
    "privacy",
  );
  rifiuta(
    "consensi.termini:'true' (testo) → campi.termini",
    con((x) => {
      x.consensi.termini = "true";
    }),
    "termini",
  );
  rifiuta(
    "consensi.privacy:1 → campi.privacy",
    con((x) => {
      x.consensi.privacy = 1;
    }),
    "privacy",
  );
  const senzaConsensi = campiDi(
    con((x) => {
      delete x.consensi;
    }),
  );
  c(
    "consensi mancanti → rifiutata la richiesta, con la frase sulle due caselle",
    [true, true],
    [!!senzaConsensi?.termini, !!senzaConsensi?.privacy],
  );
  rifiuta(
    "versione dei testi mancante → campi.versione",
    con((x) => {
      delete x.consensi.versione;
    }),
    "versione",
  );
  rifiuta(
    "versione lunga 10.000 caratteri → campi.versione",
    con((x) => {
      x.consensi.versione = "v".repeat(10_000);
    }),
    "versione",
  );
  c(
    "consensoMarketing: true → true; 'true', 1, assente → false (mai per sbaglio)",
    [true, false, false, false],
    [true, "true", 1, undefined].map(
      (v) =>
        validaRichiesta(
          con((x) => {
            x.consensoMarketing = v;
          }),
        ).valore?.consensoMarketing,
    ),
  );

  // ── la fattura ──
  const privato = (m = () => {}) =>
    con((x) => {
      x.fattura = { tipo: "privato", denominazione: "Anna Prova", cf: CF };
      m(x.fattura);
    });
  const azienda = (m = () => {}) =>
    con((x) => {
      x.fattura = {
        tipo: "azienda",
        denominazione: "Finta Srl",
        piva: PIVA,
        sdi: "abcdefg",
        pec: "Finta@Pec.example.com",
      };
      m(x.fattura);
    });
  c(
    "fattura assente, null o undefined → fattura: null",
    [null, null, null],
    [
      (x) => {
        delete x.fattura;
      },
      (x) => {
        x.fattura = null;
      },
      (x) => {
        x.fattura = undefined;
      },
    ].map((m) => validaRichiesta(con(m)).valore?.fattura),
  );
  const fp = validaRichiesta(privato());
  c(
    "privato con CF giusto → accettata, CF in maiuscolo",
    { tipo: "privato", denominazione: "Anna Prova", cf: CF },
    fp.valore?.fattura,
  );
  c(
    "…anche col CF scritto minuscolo e con spazi",
    CF,
    validaRichiesta(
      privato((f) => {
        f.cf = ` ${CF.toLowerCase().slice(0, 6)} ${CF.toLowerCase().slice(6)} `;
      }),
    ).valore?.fattura?.cf,
  );
  const cfSbagliato = CF.slice(0, 15) + (CF[15] === "A" ? "B" : "A");
  const e1 = rifiuta(
    "fattura privato con CF sbagliato → campi.cf",
    privato((f) => {
      f.cf = cfSbagliato;
    }),
    "cf",
  );
  c(
    "…e il CF che ha scritto il cliente non compare nella risposta",
    false,
    JSON.stringify(e1).includes(cfSbagliato),
  );
  rifiuta(
    "fattura privato senza CF → campi.cf",
    privato((f) => {
      delete f.cf;
    }),
    "cf",
  );
  rifiuta(
    "fattura privato con CF vuoto → campi.cf",
    privato((f) => {
      f.cf = "  ";
    }),
    "cf",
  );
  rifiuta(
    "fattura senza denominazione → campi.denominazione",
    privato((f) => {
      f.denominazione = "";
    }),
    "denominazione",
  );
  rifiuta(
    "denominazione di 10.000 caratteri → campi.denominazione",
    privato((f) => {
      f.denominazione = "x".repeat(10_000);
    }),
    "denominazione",
  );
  rifiuta(
    "fattura con tipo sconosciuto → campi.tipo",
    privato((f) => {
      f.tipo = "ente";
    }),
    "tipo",
  );
  rifiuta(
    "fattura che non è un oggetto → campi.fattura",
    con((x) => {
      x.fattura = "si";
    }),
    "fattura",
  );
  rifiuta(
    "fattura come elenco → campi.fattura",
    con((x) => {
      x.fattura = [{ tipo: "privato" }];
    }),
    "fattura",
  );
  const fa = validaRichiesta(azienda());
  c(
    "azienda con P.IVA, SDI e PEC giusti → accettata e normalizzata (SDI maiuscolo, PEC minuscola)",
    {
      tipo: "azienda",
      denominazione: "Finta Srl",
      piva: PIVA,
      sdi: "ABCDEFG",
      pec: "finta@pec.example.com",
    },
    fa.valore?.fattura,
  );
  rifiuta(
    "azienda con P.IVA sbagliata → campi.piva",
    azienda((f) => {
      f.piva = PIVA.slice(0, 10) + String((Number(PIVA[10]) + 1) % 10);
    }),
    "piva",
  );
  rifiuta(
    "azienda senza P.IVA → campi.piva",
    azienda((f) => {
      delete f.piva;
    }),
    "piva",
  );
  rifiuta(
    "azienda con SDI di 6 caratteri → campi.sdi",
    azienda((f) => {
      f.sdi = "ABCDEF";
    }),
    "sdi",
  );
  rifiuta(
    "azienda con PEC senza dominio → campi.pec",
    azienda((f) => {
      f.pec = "finta@";
    }),
    "pec",
  );
  c(
    "azienda senza SDI né PEC → accettata (si può usare 0000000: non è un blocco di vendita)",
    true,
    validaRichiesta(
      azienda((f) => {
        delete f.sdi;
        delete f.pec;
      }),
    ).ok,
  );
  c(
    "azienda con il CF numerico di 11 cifre → accettato; con CF sbagliato → campi.cf",
    [true, true],
    [
      validaRichiesta(
        azienda((f) => {
          f.cf = PIVA;
        }),
      ).ok,
      !!campiDi(
        azienda((f) => {
          f.cf = "123";
        }),
      )?.cf,
    ],
  );
  c(
    "i campi di fattura passati vuoti non entrano nel valore",
    { tipo: "privato", denominazione: "Anna Prova", cf: CF },
    validaRichiesta(
      privato((f) => {
        f.piva = "";
        f.sdi = "  ";
        f.pec = null;
      }),
    ).valore?.fattura,
  );
  c(
    "più errori insieme: tutti i campi sbagliati sono segnalati (non solo il primo)",
    [true, true, true],
    (() => {
      const k = campiDi(
        con((x) => {
          x.contatti.nome = "";
          x.spedizione.cap = "1";
          x.fattura = { tipo: "privato", denominazione: "A", cf: "x" };
        }),
      );
      return [!!k?.nome, !!k?.cap, !!k?.cf];
    })(),
  );

  // ── le frasi non ripetono il dato ──
  const segreti = {
    nome: "SEGRETONOME",
    email: "segretoemail@@x",
    telefono: "SEGRETOTEL",
    cap: "SEGRETO",
    provincia: "SEGRETO",
    indirizzo: "x".repeat(300) + "SEGRETOVIA",
  };
  const eS = validaRichiesta(
    con((x) => {
      x.contatti.nome = "S".repeat(200) + "SEGRETONOME";
      x.contatti.email = segreti.email;
      x.contatti.telefono = segreti.telefono;
      x.spedizione.cap = segreti.cap;
      x.spedizione.provincia = segreti.provincia;
      x.spedizione.indirizzo = segreti.indirizzo;
    }),
  );
  c(
    "nessuna frase ripete quello che ha scritto il cliente",
    false,
    /segreto/i.test(JSON.stringify(eS)),
  );
  c(
    "tutte le frasi per campo sono in italiano",
    [],
    Object.entries(eS.campi ?? {})
      .filter(([, f]) => !italiana(f))
      .map(([k]) => k),
  );

  // ── l'attribuzione (D14) ──
  const attr = {
    utm_source: "prova",
    utm_medium: "cpc",
    utm_campaign: "autunno",
    fbclid: "fb-click",
    gclid: "g-click",
    ttclid: "tt-click",
    gbraid: "gb",
    fbp: "fb.1.123.456",
    fbc: "fb.1.123.abc",
    external_id: "ext-1",
    ad_id: "123",
    extra: "no",
    email: "a@b.it",
    telefono: "+39000",
  };
  const senzaConsenso = validaRichiesta(
    con((x) => {
      x.attribuzione = attr;
      x.consensoMarketing = false;
    }),
  ).valore?.attribuzione;
  c(
    "senza consenso di marketing: restano SOLO le utm_*",
    { utm_campaign: "autunno", utm_medium: "cpc", utm_source: "prova" },
    Object.fromEntries(Object.entries(senzaConsenso ?? {}).sort()),
  );
  c(
    "…`fbp` assente (e fbc, ttclid, gclid, external_id)",
    false,
    ["fbp", "fbc", "ttclid", "gclid", "external_id", "fbclid"].some(
      (k) => k in (senzaConsenso ?? {}),
    ),
  );
  const conConsenso = validaRichiesta(
    con((x) => {
      x.attribuzione = attr;
      x.consensoMarketing = true;
    }),
  ).valore?.attribuzione;
  c(
    "con il consenso: utm_*, click id e cookie delle piattaforme (chiavi ammesse)",
    [
      "ad_id",
      "external_id",
      "fbc",
      "fbclid",
      "fbp",
      "gbraid",
      "gclid",
      "ttclid",
      "utm_campaign",
      "utm_medium",
      "utm_source",
    ],
    Object.keys(conConsenso ?? {}).sort(),
  );
  c(
    "…ma mai chiavi sconosciute, né email o telefono",
    false,
    ["extra", "email", "telefono"].some((k) => k in (conConsenso ?? {})),
  );
  c(
    "valori non testo (oggetto, numero, elenco), vuoti o oltre 200 caratteri → scartati, la vendita non si ferma",
    { utm_source: "ok" },
    (() => {
      const e = validaRichiesta(
        con((x) => {
          x.attribuzione = {
            utm_source: "ok",
            utm_medium: { a: 1 },
            utm_term: 5,
            utm_content: ["x"],
            utm_campaign: "",
            utm_id: "x".repeat(201),
          };
        }),
      );
      return e.ok ? e.valore.attribuzione : e;
    })(),
  );
  c(
    "attribuzione che non è un oggetto (testo, elenco, null, assente) → {} e la vendita passa",
    [{}, {}, {}, {}],
    ["utm_source=a", ["utm_source"], null, undefined].map((a) => {
      const e = validaRichiesta(
        con((x) => {
          x.attribuzione = a;
        }),
      );
      return e.ok ? e.valore.attribuzione : e;
    }),
  );
  const tante = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`utm_k${i}`, "v"]));
  c(
    "al massimo 20 chiavi (nessun carico di dati dal browser)",
    true,
    Object.keys(
      validaRichiesta(
        con((x) => {
          x.attribuzione = tante;
        }),
      ).valore?.attribuzione ?? {},
    ).length <= 20,
  );
  c(
    "«__proto__» e «constructor» non passano e non rompono niente",
    [true, "prova", false],
    (() => {
      const a = JSON.parse('{"__proto__":{"utm_x":"1"},"constructor":"x","utm_source":"prova"}');
      const e = validaRichiesta(
        con((x) => {
          x.attribuzione = a;
          x.consensoMarketing = true;
        }),
      );
      return [
        e.ok,
        e.valore?.attribuzione?.utm_source,
        Object.prototype.hasOwnProperty.call(e.valore?.attribuzione ?? {}, "constructor"),
      ];
    })(),
  );
  c(
    "chiavi utm_ con maiuscole o simboli (UTM_SOURCE, utm_a-b, utm_) → scartate",
    {},
    validaRichiesta(
      con((x) => {
        x.attribuzione = { UTM_SOURCE: "a", "utm_a-b": "b", utm_: "c", "utm_ source": "d" };
      }),
    ).valore?.attribuzione,
  );

  // ── il sorgente ──
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const src = readFileSync(join(radice, "src/shop/cassa/validazione.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  c(
    "usa i validatori di T45 (fiscale.ts), non una copia",
    true,
    /from\s+"\.\/fiscale"/.test(src) &&
      /validaCodiceFiscale/.test(src) &&
      /validaPartitaIva/.test(src) &&
      /validaProvincia/.test(src),
  );
  c("non scrive nei log (nessun console.*)", false, /console\./.test(src));
}
