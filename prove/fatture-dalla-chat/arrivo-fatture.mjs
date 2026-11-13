/** ── FATTURE DALLA CHAT · T16 · L'ARRIVO SU FATTURE › DALLA CHAT ───────────
 *  Commessa 2026-11-13-fatture-dalla-chat (PIANO T16, dopo T8+T15). SPEC §9.3
 *  passo 6 («si apre l'anteprima della fattura di quel cliente»), §9.6 («alla
 *  stessa pagina Fatture, sezione "Dalla chat" della Via 1»).
 *
 *  Due pezzi puri, provati qui con `esbuild` (stesso schema di
 *  `schede-chat-da-lead.mjs`, T8): niente rete, niente React montato.
 *
 *  1. `leggiRicercaFatture` (`src/routes/CRM.fatture.tsx`): i due parametri di
 *     ricerca `apriLotto`/`apriRiga` arrivano dal browser (query string) — si
 *     validano PRIMA di usarli in qualunque fetch o confronto, riusando
 *     `lottoValido`/`idRigaValido` già scritti e provati per le chiavi di
 *     `app_config` (nessuna regex reinventata qui). Un valore che non supera
 *     il controllo si scarta IN SILENZIO (stesso principio di
 *     `leggiRicercaChat`, `chatwa/stato.ts`): mai un errore, mai quel valore
 *     dentro una chiave o un URL dopo di qui.
 *  2. `rigaApribileDelLink` (`src/crm/fatture/bulk/FinestraBulk.tsx`): decide
 *     se la riga del link è ancora apribile (per lo scroll/l'evidenziazione)
 *     o se il link è vecchio (riga mai esistita, già emessa, già scartata) —
 *     in quel caso chi chiama mostra l'avviso onesto invece di evidenziare
 *     niente.
 *  3. `apertaAllArrivo`/`modalitaAllArrivo`: lo stato INIZIALE della finestra
 *     («Carica in blocco» aperta, già su «Dalla chat») quando si arriva dal
 *     link — correzione del revisore su `523eb98`: la finestra non si apriva
 *     da sola, e nessuna prova lo misurava. Pure, senza montare React (il
 *     revisore accetta questa via in alternativa a un render). */
import { createRequire } from "node:module";
import { join } from "node:path";

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

const LOTTO = "lotto-0123abcd";
const RIGA = "3f2a9c1e-77b0-4c1d-9d2e-0a1b2c3d4e5f";

const rigaValutata = (idRiga, stato) => ({ idRiga, stato });

export async function prove(_mod, { c, gruppo, radice }) {
  const Rotta = await impacchetta(radice, "src/routes/CRM.fatture.tsx");

  gruppo("DALLA CHAT · T16 · leggiRicercaFatture: apriLotto/apriRiga validati prima di tutto");

  c(
    "due valori validi → tornano entrambi, intatti",
    { apriLotto: LOTTO, apriRiga: RIGA },
    Rotta.leggiRicercaFatture({ apriLotto: LOTTO, apriRiga: RIGA }),
  );

  c("niente parametri → oggetto vuoto, nessun crash", {}, Rotta.leggiRicercaFatture({}));

  c(
    "solo apriLotto, valido → apriRiga resta assente (non undefined scritto a caso)",
    false,
    Object.prototype.hasOwnProperty.call(
      Rotta.leggiRicercaFatture({ apriLotto: LOTTO }),
      "apriRiga",
    ),
  );

  c(
    "apriLotto con un formato non ammesso (maiuscole, spazi) → scartato in silenzio",
    [undefined, undefined, undefined],
    [
      Rotta.leggiRicercaFatture({ apriLotto: "LOTTO MAIUSCOLO" }).apriLotto,
      Rotta.leggiRicercaFatture({ apriLotto: "ab" }).apriLotto, // troppo corto per lottoValido
      Rotta.leggiRicercaFatture({ apriLotto: "" }).apriLotto,
    ],
  );

  c(
    "apriLotto con un tentativo di XSS → scartato, mai nel risultato",
    undefined,
    Rotta.leggiRicercaFatture({ apriLotto: "<img src=x onerror=alert(1)>" }).apriLotto,
  );

  c(
    "apriRiga non in forma UUID → scartato in silenzio",
    [undefined, undefined],
    [
      Rotta.leggiRicercaFatture({ apriRiga: "non-un-uuid" }).apriRiga,
      Rotta.leggiRicercaFatture({ apriRiga: "<script>alert(1)</script>" }).apriRiga,
    ],
  );

  c(
    "un valore che non è una stringa (array, dalla query string ripetuta; numero; null) → scartato",
    [undefined, undefined, undefined],
    [
      Rotta.leggiRicercaFatture({ apriLotto: [LOTTO, LOTTO] }).apriLotto,
      Rotta.leggiRicercaFatture({ apriRiga: 12345 }).apriRiga,
      Rotta.leggiRicercaFatture({ apriLotto: null }).apriLotto,
    ],
  );

  c(
    "`raw` non è un oggetto (undefined) → oggetto vuoto, nessun crash",
    {},
    Rotta.leggiRicercaFatture(),
  );

  const Finestra = await impacchetta(radice, "src/crm/fatture/bulk/FinestraBulk.tsx");

  gruppo("DALLA CHAT · T16 · rigaApribileDelLink: il link è ancora buono, o è vecchio?");

  c(
    "idRiga assente → nessuna riga da evidenziare, anche con righe presenti",
    undefined,
    Finestra.rigaApribileDelLink([rigaValutata(RIGA, "pronto")], undefined),
  );

  c(
    "la riga c'è ed è aperta (pronto) → è quella",
    RIGA,
    Finestra.rigaApribileDelLink([rigaValutata(RIGA, "pronto")], RIGA)?.idRiga,
  );

  c(
    "la riga c'è ed è aperta (da_controllare) → è quella",
    RIGA,
    Finestra.rigaApribileDelLink([rigaValutata(RIGA, "da_controllare")], RIGA)?.idRiga,
  );

  c(
    "la riga esiste ma è GIÀ EMESSA → link vecchio, undefined (non si evidenzia una riga chiusa)",
    undefined,
    Finestra.rigaApribileDelLink([rigaValutata(RIGA, "emessa")], RIGA),
  );

  c(
    "la riga esiste ma è SCARTATA → link vecchio, undefined",
    undefined,
    Finestra.rigaApribileDelLink([rigaValutata(RIGA, "scartata")], RIGA),
  );

  c(
    "idRiga non corrisponde a nessuna riga del lotto → undefined (lotto diverso, link rotto)",
    undefined,
    Finestra.rigaApribileDelLink([rigaValutata("altra-riga", "pronto")], RIGA),
  );

  c(
    "più righe nel lotto → prende quella giusta, non la prima",
    RIGA,
    Finestra.rigaApribileDelLink(
      [
        rigaValutata("altra-riga-1", "pronto"),
        rigaValutata(RIGA, "errore"),
        rigaValutata("altra-riga-2", "pronto"),
      ],
      RIGA,
    )?.idRiga,
  );

  gruppo("DALLA CHAT · T16 · lo stato INIZIALE della finestra, quando si arriva dal link");

  c(
    "apriLotto presente → la finestra parte già aperta (bulkAperto), non chiusa",
    true,
    Rotta.apertaAllArrivo(LOTTO),
  );

  c(
    "nessun apriLotto (la pagina si apre normale) → la finestra parte chiusa, come sempre",
    false,
    Rotta.apertaAllArrivo(undefined),
  );

  c(
    "apriLotto presente → la modalità parte già su «chat», non su «screenshot»",
    "chat",
    Finestra.modalitaAllArrivo(LOTTO),
  );

  c(
    "nessun apriLotto → la modalità parte su «screenshot», come sempre (SPEC §3, invariata)",
    "screenshot",
    Finestra.modalitaAllArrivo(undefined),
  );
}
