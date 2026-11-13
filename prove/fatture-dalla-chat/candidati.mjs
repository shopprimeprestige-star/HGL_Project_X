/** ── FATTURE DALLA CHAT · T1 · CANDIDATI E RICERCA MANUALE ──────────────────
 *  `haPagamentoSenzaFattura` (lista di partenza, SPEC §3 passo 1/§6.1) e
 *  `cercabileDaLead` (adattatore per la ricerca manuale, PIANO §4 T1): qui si
 *  prova che la ricerca sulle schede usa DAVVERO `combaciaRicerca` di
 *  `chatwa/cercaChat.ts` (già nel bundle condiviso, MODULI) — non una copia.
 *
 *  `candidati.ts` non è ancora nell'elenco `MODULI` di prove/prove.mjs (lo
 *  scrive il solo T0, e T0 ha aggiunto solo tipi/chiavi): per non toccare quel
 *  file (più sviluppatori in parallelo lo pesterebbero) si impacchetta QUI,
 *  con l'API di esbuild, esattamente come fa già `prove/fatture-bulk/interfaccia.mjs`
 *  per `cambio-riga.ts`. È il codice vero, non una copia: stesso file che va
 *  in produzione, solo impacchettato in un punto diverso. */
import { createRequire } from "node:module";
import { join } from "node:path";

async function impacchetta(radice, percorso) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const testo = esbuild.buildSync({
    entryPoints: [join(radice, percorso)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
}

const scheda = (nome, cognome, telefono) => ({
  id: "lead-" + nome,
  user_id: "u1",
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
  data: { nome, cognome, telefono, stato: "nuovo" },
});

export async function prove(mod, { c, gruppo, radice }) {
  const K = await impacchetta(radice, "src/crm/fatture/dalla-chat/candidati.ts");
  const { combaciaRicerca } = mod["chatwa/cercaChat"];

  gruppo("DALLA CHAT · T1 · haPagamentoSenzaFattura");
  c("acconto > 0 → sì", true, K.haPagamentoSenzaFattura({ accontoPagato: 150 }));
  c(
    "pagato per intero (anche con acconto 0 o assente) → sì",
    [true, true],
    [
      K.haPagamentoSenzaFattura({ statoPagamento: "pagato_interamente" }),
      K.haPagamentoSenzaFattura({ accontoPagato: 0, statoPagamento: "pagato_interamente" }),
    ],
  );
  c(
    "nessun pagamento → no",
    false,
    K.haPagamentoSenzaFattura({ statoPagamento: "nessun_pagamento" }),
  );
  c("acconto 0, nessuno stato → no", false, K.haPagamentoSenzaFattura({ accontoPagato: 0 }));
  c(
    "acconto negativo (dato corrotto) → no",
    false,
    K.haPagamentoSenzaFattura({ accontoPagato: -10 }),
  );
  c(
    "nessun payment in scheda (undefined/null) → no",
    [false, false],
    [K.haPagamentoSenzaFattura(undefined), K.haPagamentoSenzaFattura(null)],
  );

  gruppo("DALLA CHAT · T1 · cercabileDaLead → combaciaRicerca (import, non copia)");
  const mario = scheda("Mario", "Rossi", "+39 333 000 1111");
  const anna = scheda("Anna", "Bianchi", "348 222 3333");
  const cMario = K.cercabileDaLead(mario);
  const cAnna = K.cercabileDaLead(anna);
  c(
    "l'adattatore porta nome/cognome della scheda e il telefono così com'è scritto, niente contatto",
    { phone: "+39 333 000 1111", lead: { data: { nome: "Mario", cognome: "Rossi" } } },
    cMario,
  );
  c(
    "ricerca per nome → trova solo la scheda giusta",
    [true, false],
    [combaciaRicerca(cMario, "mario"), combaciaRicerca(cAnna, "mario")],
  );
  c(
    "ricerca per cognome (maiuscole/spazi ai bordi non contano) → trova solo la scheda giusta",
    [true, false],
    [combaciaRicerca(cMario, "  ROSSI  "), combaciaRicerca(cAnna, "  ROSSI  ")],
  );
  c(
    "ricerca per telefono scritto come in scheda (con «+39» e spazi) → trova solo la scheda giusta",
    [true, false],
    [combaciaRicerca(cMario, "+39 333 000 1111"), combaciaRicerca(cAnna, "+39 333 000 1111")],
  );
  c(
    "stessa ricerca scritta senza «+39» e senza spazi → trova comunque la scheda giusta",
    [true, false],
    [combaciaRicerca(cMario, "3330001111"), combaciaRicerca(cAnna, "3330001111")],
  );
  c(
    "ricerca per il solo prefisso nazionale (meno di 3 cifre) non basta da sola a far combaciare per numero",
    false,
    combaciaRicerca(cAnna, "39"),
  );
  c(
    "ricerca vuota → combacia con chiunque (comportamento di combaciaRicerca, non reimplementato)",
    [true, true],
    [combaciaRicerca(cMario, ""), combaciaRicerca(cAnna, "   ")],
  );

  gruppo("DALLA CHAT · T1 · nessuna logica di ricerca reimplementata nel file");
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(join(radice, "src/crm/fatture/dalla-chat/candidati.ts"), "utf8");
  c(
    "candidati.ts non ridefinisce il confronto per cifre/sottostringa del telefono o del nome: " +
      "nessun replace su \\D, nessun .includes() proprio, nessuna regex di ricerca — solo l'adattatore",
    [false, false, false],
    [
      /\\D/.test(src),
      /\.includes\(/.test(src),
      /new RegExp|[^\w]\/[^/]+\/[a-z]*\.test\(/.test(src),
    ],
  );
}
