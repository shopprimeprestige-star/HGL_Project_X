/** ── PROVE: «USA PER FATTURA» NELLA CHAT BAILEYS (commessa 2026-11-13-fatture-dalla-chat, T15) ──
 *
 *  PIANO v3.1 §0bis.1/T15, SPEC §9.3/§9.6/§9.7. File toccati: `Conversazione.tsx`,
 *  `BollaMessaggio.tsx`, `FoglioMedia.tsx` (tutti in `src/crm/chatwa/`).
 *
 *  Come le altre prove su questi stessi componenti (`idee/rispiega.mjs`,
 *  `idee/modo-ponte.mjs`, `ponte/media-chat-ui.mjs`): niente interazione vera
 *  (Conversazione.tsx non è puro, nessun renderer con eventi in questa suite) —
 *  un controllo di testo sul sorgente per la logica che non si vede dal disegno
 *  (la mutua esclusione, il gate `modoPonte`), e `react-dom/server` per quello
 *  che si vede (classi, voci di menu, bottoni). I tocchi veri e le misure a
 *  390/1280 px restano a Playwright (LAVAGNA), come già per `media-chat-ui.mjs`.
 *
 *  ⚠️ Dati inventati: nessun numero, nome o testo di clienti veri.
 *
 *  `mod`: non serve (bundle proprio via esbuild, come `ponte/media-chat-ui.mjs`).
 *  `aiuti`: { c, gruppo, radice }. */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const senzaCommenti = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

export async function proveFatturaChatBolla(_mod, { c, gruppo, radice }) {
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const conv = senzaCommenti(leggi("src/crm/chatwa/Conversazione.tsx"));
  const bolla = senzaCommenti(leggi("src/crm/chatwa/BollaMessaggio.tsx"));
  const foglio = senzaCommenti(leggi("src/crm/chatwa/FoglioMedia.tsx"));
  const rispiegaTs = leggi("src/crm/risposte-ai/rispiega.ts");
  const useRispostaAiTs = leggi("src/crm/chatwa/useRispostaAi.ts");

  /* ═══ 1. MUTUA ESCLUSIONE NEI DUE SENSI (osservazione del revisore su v3; PIANO §0bis.1/T15) ═══ */
  gruppo("USA PER FATTURA · MUTUA ESCLUSIONE NEI DUE SENSI (prova dedicata)");
  c(
    "«fattura» (il prop passato a BollaMessaggio) non si accende mentre «Rispiega con AI» è già attiva: `!ai.attivo` c'è",
    true,
    /fattura=\{[\s\S]{0,400}?!ai\.attivo[\s\S]{0,120}?selezionabileFattura\(m\)[\s\S]{0,60}?\?\s*\{\s*onInizia:\s*\(\)\s*=>\s*fattura\.commuta\(m\)/.test(
      conv,
    ),
  );
  c(
    "…e viceversa: la condizione ESISTENTE di «rispiega» guadagna `&& !fattura.fatturaAttiva` — una selezione-fattura già iniziata (1 bolla scelta) spegne «Rispiega con AI»",
    true,
    /!modoPonte &&\s*!ai\.attivo &&\s*!bolla &&\s*selezionabile\(m\) &&\s*!fattura\.fatturaAttiva\s*\?\s*\{/.test(
      conv,
    ),
  );
  c(
    "nello stesso commit (lo stesso file): le due condizioni compaiono entrambe",
    true,
    conv.includes("!fattura.fatturaAttiva") && conv.includes("!ai.attivo"),
  );
  c(
    "la nuova selezione NON tocca lo stato di «Rispiega»/«Rispondi con AI»: nessuna riga di `risposte-ai/rispiega.ts`, `useRispostaAi.ts` cambiata da questa prova (il file resta quello della commessa 2026-10-30, nessun import da `dalla-chat/`)",
    [false, false],
    [
      /dalla-chat|fattura/i.test(rispiegaTs),
      /dalla-chat|useSelezioneFattura/i.test(useRispostaAiTs),
    ],
  );
  c(
    "…e la riga del ternario in Conversazione.tsx resta la stessa, salvo la sola `&& !fattura.fatturaAttiva` aggiunta: nessun cambio al criterio `selezionabile(m)`, a `ai.apriRispiega`",
    true,
    /onInizia:\s*\(\)\s*=>\s*\{\s*lungo\.current = true;\s*ai\.apriRispiega\(m\.id\);\s*\}/.test(
      conv,
    ),
  );

  /* ═══ 2. ATTIVO SOLO IN modoPonte (punto 2 del compito): nella chat normale non cambia nulla ═══ */
  gruppo("USA PER FATTURA · SOLO IN modoPonte (BAILEYS)");
  c(
    "il prop `fattura` di BollaMessaggio richiede `modoPonte` come PRIMA condizione",
    true,
    /fattura=\{[\s\S]{0,400}?modoPonte &&\s*puoFatturare &&\s*!ai\.attivo &&\s*!bolla &&\s*selezionabileFattura\(m\)/.test(
      conv,
    ),
  );
  c(
    "l'overlay di selezione (le bolle successive, aggiunte col tocco) richiede anch'esso `modoPonte`",
    true,
    /\) : modoPonte &&\s*puoFatturare &&\s*fattura\.fatturaAttiva/.test(conv),
  );
  c(
    "l'hook `useSelezioneFattura` riceve `null` come telefono fuori da modoPonte: fuori da lì `fatturaAttiva` non si accende mai",
    true,
    /useSelezioneFattura\(modoPonte \? \(attiva\?\.phone \?\? null\) : null\)/.test(conv),
  );
  c(
    "la barra «Usa per fattura» (BarraFattura) sostituisce la fascia «sola lettura» SOLO dentro il ramo `modoPonte`, mai al posto della Casella",
    true,
    /\{modoPonte \? \(\s*puoFatturare && fattura\.fatturaAttiva \? \(\s*<BarraFattura/.test(conv),
  );
  c(
    "a NON modoPonte: la Casella resta montata con le stesse props di prima (riga identica alla Via 1)",
    true,
    /<Casella api=\{api\} linkWa=\{nativo\?\.href\} onFissaAppuntamento=\{onFissaAppuntamento\} \/>/.test(
      conv,
    ),
  );

  /* ═══ 3. IL PERMESSO «pagamenti» (stesso gate della bulk, nessun permesso nuovo) ═══ */
  gruppo("USA PER FATTURA · IL PERMESSO");
  c(
    'il permesso si legge con `usePuo()("pagamenti")`, lo stesso della bulk/Via 1',
    true,
    /usePuo\(\)\("pagamenti"\)/.test(conv),
  );
  c(
    "senza il permesso («puoFatturare» falso) niente selezione, niente barra: ogni condizione lo richiede",
    true,
    /modoPonte &&\s*puoFatturare &&\s*!ai\.attivo &&\s*!bolla &&\s*selezionabileFattura\(m\)/.test(
      conv,
    ) && /modoPonte &&\s*puoFatturare &&\s*fattura\.fatturaAttiva/.test(conv),
  );

  /* ═══ 4. NAVIGAZIONE E AZZERA (punti 3 e 4 del compito, nota del revisore su T14) ═══ */
  gruppo("USA PER FATTURA · NAVIGAZIONE VERSO FATTURE E azzera()");
  c(
    "dopo il successo si naviga su /CRM/fatture con apriLotto e apriRiga",
    true,
    /to:\s*"\/CRM\/fatture"[\s\S]{0,80}search:\s*\{\s*apriLotto:\s*r\.lotto,\s*apriRiga:\s*r\.idRiga/.test(
      conv,
    ),
  );
  c(
    "…e SOLO dopo aver chiamato `fattura.azzera()` prima della navigazione (nota del revisore su T14: una selezione vecchia non deve restare visibile)",
    true,
    /fatturaCompletata = \(r: \{ lotto: string; idRiga: string \}\) => \{\s*fattura\.azzera\(\);\s*void navigate\(/.test(
      conv,
    ),
  );
  c(
    "il risultato di `usaPerFattura`/`continua` arriva per davvero (non un `fase` osservato con useEffect): BarraFattura chiama `onFinita` solo se il risultato non è `null`",
    true,
    /const risultato = await azione\(\);\s*if \(risultato\) onFinita\(risultato\);/.test(conv),
  );

  /* ═══ 5. 0/N SCHEDE: IL CRM NON SCEGLIE DA SOLO (punto 5 del compito, PIANO T12/T14) ═══ */
  gruppo("USA PER FATTURA · 0 O PIÙ SCHEDE, NESSUNA SCELTA AUTOMATICA");
  c(
    "zero schede: si chiede di creare la scheda (lo stesso tasto già nella chat), nessuna scheda creata da sola",
    true,
    /fase\.tipo === "zero-schede"[\s\S]{0,400}onClick=\{onCreaScheda\}/.test(conv),
  );
  c(
    "più schede: si elencano TUTTE (una per ogni `Lead` tornato da `schedePerNumero`/T12), un tasto ciascuna — nessun `[0]` o scelta implicita",
    true,
    /fase\.tipo === "scegli-scheda"[\s\S]{0,400}fattura\.fase\.schede\.map\(\(l\) =>/.test(conv),
  );
  c(
    "ogni scheda elencata chiama `continua(l.id)`, mai un id scelto in automatico dal componente",
    true,
    /onClick=\{\(\) => void vai\(\(\) => fattura\.continua\(l\.id\)\)\}/.test(conv),
  );

  /* ═══ 6. IL FOGLIO MEDIA: «SCEGLI PER LA FATTURA» (PIANO §0bis.1, bolle-immagine) ═══ */
  gruppo("FOGLIOMEDIA · LA VOCE «SCEGLI PER LA FATTURA»");
  c(
    "`PropsCorpoFoglio` guadagna `onFattura`, facoltativo (come `onRispiega`)",
    true,
    /onFattura\?:\s*\(\) => void;/.test(foglio),
  );
  c(
    "la voce compare solo se `onFattura` è data, stesso schema di `onRispiega`",
    true,
    /p\.onFattura && \(/.test(foglio) && /Scegli per la fattura/.test(foglio),
  );

  /* ═══ 7. BollaMessaggio · PROPAGA «fattura» COME «rispiega» (stesso schema, righe parallele) ═══ */
  gruppo("BOLLAMESSAGGIO · PROPAGAZIONE DI «fattura»");
  c(
    "`conPressione` si accende anche con `fattura` sola (nessun `rispiega`, nessun `media`)",
    true,
    /conPressione = !!rispiega \|\| !!fattura \|\| !!media;/.test(bolla),
  );
  c(
    "sulla pressione lunga, senza media: `rispiega` vince se c'è, altrimenti `fattura` — mai entrambi insieme (coerente col punto 1: a monte Conversazione.tsx non passa mai i due insieme)",
    true,
    /else if \(rispiega\) rispiega\.onInizia\(\);\s*else fattura\?\.onInizia\(\);/.test(bolla),
  );
  c(
    "la freccia del computer (MenuFreccia) accetta `fattura` e, su un media, lo passa al foglio come «onFattura», stesso schema di «onRispiega»",
    true,
    /fattura\?:\s*\{ onInizia: \(\) => void \};/.test(bolla) &&
      /onFattura=\{\s*fattura\s*\?\s*\(\) => \{\s*chiudiFoglio\(\);\s*setTimeout\(fattura\.onInizia, 0\);/.test(
        bolla,
      ),
  );
  c(
    "il menu della bolla (per il computer) offre «Usa per fattura» quando c'è `fattura`",
    true,
    /Usa per fattura/.test(bolla) && /fattura && \(/.test(bolla),
  );

  /* ═══ 8. IL DISEGNO: render reale coi componenti (react-dom/server, come ponte/media-chat-ui.mjs) ═══ */
  gruppo("USA PER FATTURA · IL DISEGNO (BollaMessaggio, CorpoFoglio, BarraFattura)");
  const esbuild = createRequire(import.meta.url)("esbuild");
  const richiedi = createRequire(import.meta.url);
  const dir = mkdtempSync(join(tmpdir(), "fattura-chat-bolla-"));
  try {
    writeFileSync(
      join(dir, "client.js"),
      `export const supabase = { from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }), eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };`,
    );
    writeFileSync(
      join(dir, "auth.js"),
      `export const fetchCRM = async () => new Response('{}', { status: 500 });
       export const useAuth = () => ({ user: null });
       export const usePuo = () => () => true;
       export const intestazioniCRM = async () => ({});`,
    );
    writeFileSync(
      join(dir, "crm.js"),
      `export const useCRM = () => ({ consultants: [], leads: [] });`,
    );
    writeFileSync(join(dir, "router.js"), `export const useNavigate = () => () => {};`);
    writeFileSync(
      join(dir, "ingresso.tsx"),
      `import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export { React, renderToStaticMarkup };
export { BollaMessaggio } from ${JSON.stringify(join(radice, "src/crm/chatwa/BollaMessaggio.tsx"))};
export { FoglioMedia, CorpoFoglio } from ${JSON.stringify(join(radice, "src/crm/chatwa/FoglioMedia.tsx"))};
export { BarraFattura } from ${JSON.stringify(join(radice, "src/crm/chatwa/Conversazione.tsx"))};`,
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
            b.onResolve({ filter: /(^@\/crm\/|^\.\.\/|^\.\/)CRMContext$/ }, () => ({
              path: join(dir, "crm.js"),
            }));
            b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
              path: join(dir, "router.js"),
            }));
          },
        },
      ],
    });
    const U = richiedi(join(dir, "ui.cjs"));
    const { React, renderToStaticMarkup, BollaMessaggio, CorpoFoglio, BarraFattura } = U;
    const disegna = (el) => renderToStaticMarkup(el);
    const sì = { onInizia: () => undefined };

    const msg = (o = {}) => ({
      id: "m1",
      user_id: "u",
      lead_id: null,
      direction: "inbound",
      from_number: "393330000001",
      to_number: "393330000002",
      body: "Il mio indirizzo è via Roma 1",
      status: "received",
      wa_message_id: null,
      error_message: null,
      created_at: "2026-11-13T11:00:00.000Z",
      delivered_at: null,
      read_at: null,
      canale: "manychat",
      ...o,
    });

    /* ── Testo, solo fattura (nessun rispiega) ── */
    const soloFattura = disegna(
      React.createElement(BollaMessaggio, { messaggio: msg(), lead: null, fattura: sì }),
    );
    c(
      "testo con SOLO `fattura` (nessun `rispiega`): la bolla accetta la pressione (select-none) e la freccia è il menu (per il computer)",
      [true, true, true],
      [
        /pointer-coarse:select-none/.test(soloFattura),
        /aria-label="Azioni su questo messaggio"/.test(soloFattura),
        /aria-haspopup="menu"/.test(soloFattura),
      ],
    );
    const nessuno = disegna(React.createElement(BollaMessaggio, { messaggio: msg(), lead: null }));
    c(
      "testo senza `rispiega` né `fattura`: nessuna freccia (comportamento di sempre)",
      false,
      /Azioni su/.test(nessuno),
    );

    /* ── Media del ponte (Baileys), con `fattura` e senza `rispiega` ── */
    const CH = "bw:393330000001:3EB0A1B2C3D4";
    const mediaB = disegna(
      React.createElement(BollaMessaggio, {
        messaggio: msg({ canale: "baileys", wa_message_id: CH, body: "📷 Foto" }),
        lead: null,
        fattura: sì,
      }),
    );
    c(
      "media del ponte con `fattura` (senza `rispiega`): la freccia apre il foglio (un solo tasto), non il menu — e accetta la pressione",
      [true, false, true],
      [
        /aria-label="Azioni su questo file"/.test(mediaB),
        /aria-haspopup="menu"/.test(mediaB),
        /pointer-coarse:select-none/.test(mediaB),
      ],
    );

    /* ── CorpoFoglio: la voce «Scegli per la fattura», sola, con «Rispiega», o nessuna ── */
    const nulla = () => undefined;
    const corpo = (o = {}) =>
      disegna(
        React.createElement(CorpoFoglio, {
          modo: "solo",
          categoria: "foto",
          scadeIl: null,
          onMostra: nulla,
          onTimer: nulla,
          onElimina: nulla,
          ...o,
        }),
      );
    c(
      "solo `onFattura`: la voce «Scegli per la fattura» c'è, «Rispiega con AI» no",
      [true, false],
      [
        /Scegli per la fattura/.test(corpo({ onFattura: nulla })),
        /Rispiega con AI/.test(corpo({ onFattura: nulla })),
      ],
    );
    c(
      "solo `onRispiega` (comportamento di sempre, non rotto da questa commessa): «Rispiega con AI» c'è, «Scegli per la fattura» no",
      [true, false],
      [
        /Rispiega con AI/.test(corpo({ onRispiega: nulla })),
        /Scegli per la fattura/.test(corpo({ onRispiega: nulla })),
      ],
    );
    c(
      "entrambe: le due voci compaiono insieme, in una sola fascia (un solo border-t)",
      [true, true, 1],
      [
        /Rispiega con AI/.test(corpo({ onRispiega: nulla, onFattura: nulla })),
        /Scegli per la fattura/.test(corpo({ onRispiega: nulla, onFattura: nulla })),
        (corpo({ onRispiega: nulla, onFattura: nulla }).match(/border-t border-border/g) ?? [])
          .length,
      ],
    );
    c("nessuna delle due: niente fascia in più", false, /Rispiega|fattura/i.test(corpo()));

    /* ── BarraFattura: le tre diramazioni del passo 4, mai una scelta automatica ── */
    const nomeLead = (id, nome, cognome) => ({ id, data: { nome, cognome } });
    const fatturaFinta = (fase, scelti = ["a", "b"]) => ({
      scelti,
      fase,
      fatturaAttiva: scelti.length > 0,
      commuta: () => undefined,
      azzera: () => undefined,
      usaPerFattura: async () => null,
      continua: async () => null,
    });
    const barra = (fase, extra = {}) =>
      disegna(
        React.createElement(BarraFattura, {
          fattura: fatturaFinta(fase),
          leads: [],
          onCreaScheda: () => undefined,
          onFinita: () => undefined,
          ...extra,
        }),
      );
    const inattiva = barra({ tipo: "inattiva" });
    c(
      "stato di partenza (2 bolle scelte, nessuna richiesta ancora partita): contatore e i due tasti, nessun messaggio di errore/scelta",
      [true, true, false, false, false],
      [
        /2 bolle scelte per la fattura/.test(inattiva),
        />Usa per fattura</.test(inattiva.replace(/<svg[\s\S]*?<\/svg>/g, "")),
        /zero-schede|scegli-scheda/.test(inattiva),
        /role="alert"/.test(inattiva),
        /disabled=""/.test(inattiva),
      ],
    );
    const lavoro = barra({ tipo: "lavoro" });
    c(
      "in lavoro: «Annulla» e «Usa per fattura» disabilitati (niente doppio tocco a metà di una richiesta)",
      2,
      (lavoro.match(/disabled=""/g) ?? []).length,
    );
    const err = barra({ tipo: "errore", messaggio: "La rete non risponde: riprova." });
    c(
      "errore: la frase si legge (role=alert), i tasti restano attivi (si può riprovare)",
      [true, true, 0],
      [
        /role="alert"/.test(err),
        /La rete non risponde: riprova\./.test(err),
        (err.match(/disabled=""/g) ?? []).length,
      ],
    );
    const zero = barra({ tipo: "zero-schede" });
    c(
      "zero schede: il tasto «Crea scheda» c'è (lo stesso gesto già nella chat), nessuna scheda scelta da sola",
      true,
      /Crea scheda/.test(zero),
    );
    const piu = barra({
      tipo: "scegli-scheda",
      schede: [nomeLead("1", "Maria", "Bianchi"), nomeLead("2", "Giulia", "Bianchi")],
    });
    c(
      "più schede: ENTRAMBE elencate per nome (madre/figlia sullo stesso numero), nessun `[0]` scelto da solo",
      [true, true],
      [/Maria Bianchi/.test(piu), /Giulia Bianchi/.test(piu)],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
