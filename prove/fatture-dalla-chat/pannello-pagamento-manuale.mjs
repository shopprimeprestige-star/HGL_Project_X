/** ── FATTURE DALLA CHAT · T17 · «SALVA PAGAMENTO» NEL PANNELLO (PannelloRigaChat.tsx) ──
 *  Commessa 2026-11-13-fatture-dalla-chat, T17 (collaudo T9 NON PASSATO: SPEC §9.3 passo 7/
 *  §9.7 criterio 3 non raggiungibile dall'interfaccia). Qui si disegna il componente VERO con
 *  `react-dom/server` (stesso schema di `prove/idee/fattura-chat-bolla.mjs`): niente interazione
 *  (nessun renderer con eventi in questa suite), ma il disegno — presenza/assenza del tasto,
 *  tasti da 44px, nessun campo duplicato — è quello reale.
 *
 *  ⚠️ Dati inventati: nessun CF, telefono o nome di persona vera. */
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function prove(_mod, { c, gruppo, radice }) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const richiedi = createRequire(import.meta.url);
  const dir = mkdtempSync(join(tmpdir(), "pannello-pagamento-manuale-"));

  writeFileSync(
    join(dir, "client.js"),
    `export const supabase = { from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) }) };`,
  );
  writeFileSync(
    join(dir, "auth.js"),
    `export const fetchCRM = async () => new Response('{}', { status: 500 });`,
  );
  writeFileSync(
    join(dir, "ingresso.tsx"),
    `import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export { React, renderToStaticMarkup };
export { PannelloRigaChat } from ${JSON.stringify(
      join(radice, "src/crm/fatture/dalla-chat/PannelloRigaChat.tsx"),
    )};`,
  );
  await esbuild.build({
    entryPoints: [join(dir, "ingresso.tsx")],
    nodePaths: [join(radice, "node_modules")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: join(dir, "ui.cjs"),
    logLevel: "error",
    loader: { ".tsx": "tsx" },
    jsx: "automatic",
    alias: { "@": join(radice, "src") },
    plugins: [
      {
        name: "rete-finta",
        setup(b) {
          b.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({
            path: join(dir, "client.js"),
          }));
          b.onResolve({ filter: /(^@\/crm\/|^\.\.\/|^\.\/)AuthContext$/ }, () => ({
            path: join(dir, "auth.js"),
          }));
        },
      },
    ],
  });
  const U = richiedi(join(dir, "ui.cjs"));
  const { React, renderToStaticMarkup, PannelloRigaChat } = U;
  const disegna = (el) => renderToStaticMarkup(el);

  const nessunaAzione = () => Promise.resolve(true);
  const campiBase = {
    nome: "Cliente",
    cognome: "DiFantasia",
    codiceFiscale: "",
    indirizzo: "",
    cap: "",
    comune: "",
    provincia: "",
    importo: null,
    data: "",
    modo: "",
    riferimento: "",
  };
  const rigaBase = {
    idRiga: "riga-1",
    numero: 1,
    stato: "errore",
    emettibile: false,
    campi: campiBase,
    motivi: [
      {
        codice: "chat_manca_pagamento",
        gravita: "blocca",
        strutturale: true,
        testo: "Manca lo screenshot del bonifico ricevuto: caricalo per completare questa riga.",
      },
    ],
    scheda: "scheda-1",
  };

  const props = (extra = {}) => ({
    riga: { ...rigaBase, ...extra.riga },
    rigaChat: { idRiga: "riga-1", scheda: "scheda-1", stato: "aperta", ...extra.rigaChat },
    posizione: 1,
    totale: 1,
    lotto: "lotto-1",
    nomeScheda: "Cliente DiFantasia",
    occupato: false,
    nPerAvviso: () => 0,
    onSalva: nessunaAzione,
    onCaricaPagamento: nessunaAzione,
    onScriviPagamento: nessunaAzione,
    onRileggiPagamento: () => undefined,
    onRileggiChat: () => undefined,
    onConfermaPerTutte: () => undefined,
    onApriScheda: () => undefined,
    onIndietro: () => undefined,
    onPrecedente: null,
    onSuccessiva: null,
    onProssima: null,
    ...extra,
  });

  gruppo("DALLA CHAT · T17 · «Salva pagamento» compare SOLO finché manca pagamento.lettura");
  {
    const senzaPagamento = disegna(React.createElement(PannelloRigaChat, props()));
    c(
      "manca pagamento.lettura (nessun pagamento affatto): il tasto «Salva pagamento» compare",
      true,
      /Salva pagamento/.test(senzaPagamento),
    );
    c(
      "…ed è alto 44px su mobile (h-11, come ogni altro tasto del pannello)",
      true,
      /Salva pagamento[\s\S]{0,5}<\/button>/.test(senzaPagamento) &&
        /class="[^"]*h-11[^"]*sm:h-9[^"]*"[^>]*>\s*Salva pagamento/.test(
          senzaPagamento.replace(/\n/g, " "),
        ),
    );
    c(
      "…è disabilitato quando importo/data/modo sono ancora vuoti (nessuna richiesta a vuoto)",
      true,
      /disabled=""[^>]*>\s*Salva pagamento|Salva pagamento[^<]*<\/button>/.test(senzaPagamento) &&
        new RegExp(
          '<button[^>]*disabled=""[^>]*>\\s*Salva pagamento'.replace(/\s\\s\*/g, "[\\s\\S]*"),
        ).test(senzaPagamento.replace(/\n/g, " ")) === true,
    );

    const conPagamentoScreenshot = disegna(
      React.createElement(
        PannelloRigaChat,
        props({
          riga: { ...rigaBase, motivi: [] },
          rigaChat: {
            idRiga: "riga-1",
            scheda: "scheda-1",
            stato: "aperta",
            pagamento: { stato: "letto", impronta: "x", lettura: { tipo: "pagamento" } },
          },
        }),
      ),
    );
    c(
      "pagamento.lettura già presente DA UNO SCREENSHOT (impronta non vuota): il tasto a mano NON compare — resta «Cambia screenshot»/«Rileggi il bonifico»",
      false,
      /Salva pagamento|Aggiorna pagamento/.test(conPagamentoScreenshot),
    );

    const conPagamentoAMano = disegna(
      React.createElement(
        PannelloRigaChat,
        props({
          riga: { ...rigaBase, motivi: [] },
          rigaChat: {
            idRiga: "riga-1",
            scheda: "scheda-1",
            stato: "aperta",
            pagamento: { stato: "letto", impronta: "", lettura: { tipo: "pagamento" } },
          },
        }),
      ),
    );
    c(
      // Correzione del DA RIFARE (punto 2): un pagamento già scritto a mano (impronta vuota)
      // resta correggibile, come «Cambia screenshot» per la via dello screenshot.
      "pagamento.lettura scritto A MANO (impronta vuota): il tasto resta, ma diventa «Aggiorna pagamento»",
      [true, false],
      [
        /Aggiorna pagamento/.test(conPagamentoAMano),
        />\s*Salva pagamento\s*</.test(conPagamentoAMano),
      ],
    );
  }

  gruppo("DALLA CHAT · T17 · nessun campo duplicato: gli stessi 4 della bulk, non copie nuove");
  {
    const html = disegna(React.createElement(PannelloRigaChat, props()));
    const conta = (etichetta) => (html.match(new RegExp(etichetta, "g")) ?? []).length;
    c(
      // «Importo pagato» da solo compare anche nel riepilogo in fondo (<dt>, un fatto diverso
      // dal campo di correzione): il campo vero è «Importo pagato (IVA compresa)».
      "«Importo pagato (IVA compresa)», «Data del pagamento» compaiono una volta sola come CAMPO (riusati, non duplicati)",
      [1, 1],
      [conta("Importo pagato \\(IVA compresa\\)"), conta("Data del pagamento")],
    );
  }

  gruppo("DALLA CHAT · T17 · lo screenshot resta facoltativo: la via esistente non cambia");
  {
    const html = disegna(React.createElement(PannelloRigaChat, props()));
    c(
      "il tasto «Carica lo screenshot del bonifico» è ancora lì, invariato",
      true,
      /Carica lo screenshot del bonifico/.test(html),
    );
    c(
      "l'avviso «Manca lo screenshot» esiste ancora e ora indica anche la via a mano",
      true,
      /Manca lo screenshot del bonifico ricevuto/.test(html) &&
        /scrivi il pagamento a mano/i.test(html),
    );
  }

  gruppo(
    "DALLA CHAT · T17 (correzione) · il clic su «Salva/Aggiorna pagamento» non si perde più dietro l'onBlur di un campo",
  );
  {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      join(radice, "src/crm/fatture/dalla-chat/PannelloRigaChat.tsx"),
      "utf8",
    );
    // Il collaudo Playwright su `c6bd1e2` ha trovato il clic perso: scrivere un campo (es. il
    // CRO) e cliccare SUBITO disabilitava il tasto un istante prima (l'onBlur del campo fa
    // `setLavorando(true)` in modo sincrono, `fermo = occupato || lavorando`). La correzione:
    // il gestore e il `disabled` del tasto non leggono più `fermo`/`lavorando` per NIENTE — solo
    // `occupato` (il lotto davvero impegnato altrove, visibile anche al resto del pannello) e il
    // proprio `inviandoPagamento`.
    const bloccoPagamento = src
      .slice(src.indexOf("const salvaPagamento = async"), src.indexOf("const azioneMotivo"))
      .replace(/\/\/.*$/gm, ""); // via i commenti: parlano apposta di «fermo»/«lavorando» (il perché del cambio)
    c(
      "il gestore salvaPagamento NON usa più fermo/lavorando nel CODICE per decidere se partire",
      [false, false],
      [/\bfermo\b/.test(bloccoPagamento), /setLavorando/.test(bloccoPagamento)],
    );
    c(
      "salvaPagamento esce presto solo per inviandoPagamento, occupato o campi incompleti",
      true,
      /if \(inviandoPagamento \|\| occupato \|\| !corpoPagamento\) return;/.test(src),
    );
    c(
      "il `disabled` del tasto usa occupato, non fermo/lavorando",
      [true, false],
      [
        /disabled=\{occupato \|\| inviandoPagamento \|\| !corpoPagamento\}/.test(src),
        /disabled=\{fermo \|\| inviandoPagamento/.test(src),
      ],
    );
  }

  gruppo("DALLA CHAT · T17 · niente dato personale nei log (sorgente)");
  {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      join(radice, "src/crm/fatture/dalla-chat/PannelloRigaChat.tsx"),
      "utf8",
    );
    c("nessun console.* nel pannello", false, /console\./.test(src));
    c(
      "corpoPagamentoDaBozze importato da usa-lotto-chat.ts, non ridefinito qui (zero secondo motore di validazione)",
      true,
      /import\s*\{\s*corpoPagamentoDaBozze,\s*leggiRottaChat\s*\}\s*from\s*"\.\/usa-lotto-chat"/.test(
        src,
      ),
    );
    c(
      // Correzione del DA RIFARE (punto 1, bloccante): il corpo per `scrivi-pagamento` deve
      // leggere le BOZZE dei campi (`pagamentoImportoBozza`/`pagamentoDataBozza`/
      // `pagamentoModoBozza`), mai `c.importo`/`c.data`/`c.modo` (che si aggiornano solo dopo
      // il giro di rete dell'onBlur) — altrimenti la gara segnalata dal revisore torna.
      "corpoPagamento è calcolato dalle BOZZE (corpoPagamentoDaBozze), non direttamente da c.importo/c.data/c.modo",
      [true, false, false, false],
      [
        /const corpoPagamento = corpoPagamentoDaBozze\(\s*\{\s*importoTesto:\s*pagamentoImportoBozza,\s*data:\s*pagamentoDataBozza,\s*modo:\s*pagamentoModoBozza,\s*riferimento:\s*rif,/.test(
          src,
        ),
        /corpoPagamentoDaBozze\([^)]*c\.importo/.test(src),
        /corpoPagamentoDaBozze\([^)]*c\.data/.test(src),
        /corpoPagamentoDaBozze\([^)]*c\.modo/.test(src),
      ],
    );
    c(
      // Ogni campo che alimenta il corpo ha una bozza AGGIORNATA AD OGNI TASTO (`onBozza`/la
      // selezione del modo), non solo al commit: altrimenti la gara resterebbe aperta su quel
      // campo specifico.
      "ogni bozza si aggiorna ad ogni tasto (onBozza sui 2 CampoTesto, setPagamentoModoBozza sulla pillola), non solo al commit",
      [true, true, true],
      [
        /onBozza=\{setPagamentoImportoBozza\}/.test(src),
        /onBozza=\{setPagamentoDataBozza\}/.test(src),
        /setPagamentoModoBozza\(m\)/.test(src),
      ],
    );
  }
}
