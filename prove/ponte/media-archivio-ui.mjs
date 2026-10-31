/** ── PROVE: IL PANNELLO «ARCHIVIAZIONE» (commessa 2026-10-31-media-e-archiviazione, compito T9) ──
 *
 *  Piano (d): le chat ordinate per MB con i file per tipo; liberare una chat, una
 *  selezione o tutto, sempre con conferma; a passi da 500 file, ripetuti finché
 *  non resta niente, con l'avanzamento; solo con il permesso «impostazioni».
 *
 *  Si prova in tre strati, tutti con dati e server FINTI (nessuna rete, nessun
 *  cliente vero: i numeri sono 39333000…):
 *    1. `archivio.ts`: letture difensive, pesi, frasi, e `liberaAPassi` contro un
 *       server finto che libera al massimo 500 file per richiesta;
 *    2. `usaArchivio.ts`: il «negozio» di stato (elenco, chat aperta, selezione,
 *       conferma, lavoro, ripresa, evento `ponte-media-liberati`) senza React;
 *    3. `PannelloArchiviazione.tsx`: il corpo disegnato con `react-dom/server`
 *       negli stati che il negozio produce, e il tasto in `PaginaChat`.
 *  I tocchi veri e le misure a 375 e 1280 px sono nella LAVAGNA (Playwright).
 *
 *  Non registrata in `prove/ponte.mjs`: la registra T11.
 *  `mod`: i moduli di `prove/prove.mjs` (qui non servono). `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EMOJI = /\p{Extended_Pictographic}/u;
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const testoDi = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** Una miniatura JPEG minima ma valida per la regola `^/9j/[A-Za-z0-9+/]*={0,2}$`. */
const MINIATURA =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/";
const NUM_A = "393330000001"; // la chat più pesante
const NUM_B = "393330000002";
const NUM_C = "393330000003";
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

export async function provePonteMediaArchivioUi(_mod, { c, gruppo, radice }) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const richiedi = createRequire(import.meta.url);
  const dir = mkdtempSync(join(tmpdir(), "ponte-archivio-ui-"));
  try {
    /* ── Impacchetto i tre file veri con la rete e il database finti ─────── */
    writeFileSync(
      join(dir, "client.js"),
      "export const supabase = { rpc: async () => ({ data: null, error: null }), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };",
    );
    writeFileSync(
      join(dir, "auth.js"),
      "export const fetchCRM = async () => new Response('{}', { status: 500 }); export const usePuo = () => () => true;",
    );
    writeFileSync(
      join(dir, "ingresso.tsx"),
      `import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export { React, renderToStaticMarkup };
export * from ${JSON.stringify(join(radice, "src/crm/chatwa/archivio.ts"))};
export { creaArchivio } from ${JSON.stringify(join(radice, "src/crm/chatwa/usaArchivio.ts"))};
export { CorpoArchivio, TestoConfermaTutto } from ${JSON.stringify(join(radice, "src/crm/chatwa/PannelloArchiviazione.tsx"))};`,
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
            b.onResolve({ filter: /^@\/crm\/AuthContext$/ }, () => ({
              path: join(dir, "auth.js"),
            }));
          },
        },
      ],
    });
    const U = richiedi(join(dir, "ui.cjs"));
    const { React, renderToStaticMarkup, creaArchivio, CorpoArchivio, TestoConfermaTutto } = U;
    const disegna = (el) => renderToStaticMarkup(el);

    /* ═══ 1 · Letture, pesi e frasi ═══ */
    gruppo("ARCHIVIAZIONE · LETTURE E FRASI (T9)");
    c(
      "costanti: pagina da 50, selezione a lotti di 200, 2.000 chat",
      [50, 200, 2000],
      [U.PAGINA, U.MAX_CHIAVI, U.CHAT_MAX],
    );
    c(
      "peso leggibile: B, KB, MB e GB con la virgola, senza zeri inutili",
      ["0 B", "999 B", "1 KB", "12,4 MB", "340 MB", "1,24 GB", "16,7 GB", "5 GB"],
      [0, 999, 1000, 12_400_000, 340_000_000, 1_240_000_000, 16_700_000_000, 5e9].map(
        U.formatoPeso,
      ),
    );
    c(
      "peso non valido (negativo, NaN, testo): «0 B», mai «NaN»",
      ["0 B", "0 B", "0 B"],
      [-5, Number.NaN, "x"].map(U.formatoPeso),
    );
    c(
      "numeri con il punto delle migliaia",
      ["7", "1.500", "2.000", "12.345.678"],
      [7, 1500, 2000, 12345678].map(U.numero),
    );
    c(
      "file: singolare e plurale",
      ["1 file", "0 file", "2 file", "4.200 file"],
      [1, 0, 2, 4200].map(U.fraseFile),
    );
    c(
      "tipi di una chat: foto · vocali · video · doc, senza gli zeri",
      "12 foto · 3 vocali · 1 video · 4 doc",
      U.etichettaTipi({ foto: 12, audio: 3, video: 1, documento: 4 }),
    );
    c(
      "…un solo vocale e un solo documento",
      "1 foto · 1 vocale · 1 doc",
      U.etichettaTipi({ foto: 1, audio: 1, video: 0, documento: 1 }),
    );
    c(
      "…nessun file: stringa vuota",
      "",
      U.etichettaTipi({ foto: 0, audio: 0, video: 0, documento: 0 }),
    );
    const T0 = Date.parse("2026-10-31T12:00:00Z");
    const fra = (ms) => new Date(T0 + ms).toISOString();
    c(
      "scadenza: minuti, ore, giorni, già scaduta, nessun timer",
      ["tra 5 min", "tra 1 h", "tra 23 h", "tra 7 g", "in eliminazione", null],
      [
        U.fraseScadenza(fra(5 * 60_000), T0),
        U.fraseScadenza(fra(3_600_000), T0),
        U.fraseScadenza(fra(23 * 3_600_000), T0),
        U.fraseScadenza(fra(7 * 86_400_000), T0),
        U.fraseScadenza(fra(-1000), T0),
        U.fraseScadenza(null, T0),
      ],
    );
    c(
      "tetto: testo JSON di app_config in GB da 10^9; assurdo o rotto = 5 GB di serie",
      [5e9, 8e9, 5e9, 5e9, 5e9],
      [
        U.leggiTetto('{"acceso":true,"tettoGB":5}'),
        U.leggiTetto({ acceso: true, tettoGB: 8 }),
        U.leggiTetto("{rotto"),
        U.leggiTetto('{"tettoGB":-3}'),
        U.leggiTetto('{"tettoGB":9999}'),
      ],
    );
    c("tetto: valore assente = nessun tetto da mostrare", null, U.leggiTetto(null));

    const grezzoRiass = {
      byte_totali: 3_400_000_000,
      file: 5200,
      senza_file: 40,
      con_timer: 12,
      liberati: 900,
      per_tipo: {
        foto: { n: 4000, byte: 1_000_000_000 },
        audio: { n: 700, byte: 100_000_000 },
        video: { n: 100, byte: 2_000_000_000 },
        documento: { n: 400, byte: 300_000_000 },
      },
    };
    c(
      "riassunto: letto campo per campo",
      {
        byteTotali: 3_400_000_000,
        file: 5200,
        senzaFile: 40,
        conTimer: 12,
        liberati: 900,
        perTipo: {
          foto: { n: 4000, byte: 1_000_000_000 },
          audio: { n: 700, byte: 100_000_000 },
          video: { n: 100, byte: 2_000_000_000 },
          documento: { n: 400, byte: 300_000_000 },
        },
      },
      U.leggiRiassunto(grezzoRiass),
    );
    c(
      "riassunto: tipo mancante = zero; numeri negativi o testo = zero",
      { n: 0, byte: 0 },
      U.leggiRiassunto({ ...grezzoRiass, per_tipo: { foto: { n: -4, byte: "x" } } }).perTipo.video,
    );
    c(
      "riassunto che non è un oggetto: null",
      [null, null, null],
      [null, 5, "x"].map(U.leggiRiassunto),
    );

    const rigaChat = (numero, byte, foto = 1, audio = 0, video = 0, documento = 0) => ({
      numero,
      byte,
      foto,
      audio,
      video,
      documento,
      ultimo_il: "2026-10-30T09:00:00Z",
    });
    c(
      "chat: ordinate per MB decrescenti anche se il server le desse in disordine",
      [NUM_A, NUM_B, NUM_C],
      U.leggiChat([
        rigaChat(NUM_C, 5_000_000),
        rigaChat(NUM_A, 90_000_000),
        rigaChat(NUM_B, 40_000_000),
      ]).map((x) => x.numero),
    );
    c(
      "chat: righe senza numero valido o con peso non numerico scartate",
      [NUM_A],
      U.leggiChat([
        rigaChat(NUM_A, 1000),
        rigaChat("abc", 1000),
        rigaChat("", 5),
        { numero: NUM_B, byte: "tanto" },
        null,
        7,
      ]).map((x) => x.numero),
    );
    c("chat: non un elenco = elenco vuoto", [], U.leggiChat({ no: 1 }));

    const rigaMedia = (chiave, extra = {}) => ({
      chiave,
      categoria: "foto",
      nome: null,
      byte: 2_100_000,
      durata_s: null,
      miniatura: MINIATURA,
      scade_il: null,
      creato_il: "2026-10-29T10:00:00Z",
      ...extra,
    });
    const m1 = U.leggiMedia([
      rigaMedia(`bw:${NUM_A}:AAA1`),
      rigaMedia(`bw:${NUM_A}:AAA2`, { miniatura: "<script>alert(1)</script>" }),
      rigaMedia(`bw:${NUM_A}:AAA3`, { categoria: "strano" }),
      rigaMedia("mc-in:123"),
      rigaMedia(`bw:${NUM_A}:AAA4`, { categoria: "audio", durata_s: 38, miniatura: null }),
    ]);
    c(
      "media: tengo le chiavi `bw:` con una categoria nota (3 su 5)",
      [`bw:${NUM_A}:AAA1`, `bw:${NUM_A}:AAA2`, `bw:${NUM_A}:AAA4`],
      m1.map((x) => x.chiave),
    );
    c(
      "media: la miniatura che non è base64 JPEG diventa nulla (finirebbe in un `src`)",
      [MINIATURA, null],
      [m1[0].miniatura, m1[1].miniatura],
    );
    c("media: durata e categoria lette", ["audio", 38], [m1[2].categoria, m1[2].durataS]);

    /* ═══ 2 · I passi di «libera» contro un server finto ═══ */
    gruppo("ARCHIVIAZIONE · LIBERA A PASSI DA 500 (T9)");
    /** Un server che libera al massimo 500 file per richiesta e dice quanti ne restano. */
    const servente = (o = {}) => {
      const reg = { richieste: [] };
      let restano = o.totale ?? 1234;
      const peso = o.peso ?? 2_000_000;
      let n = 0;
      return {
        reg,
        restano: () => restano,
        chiedi: async (percorso, init) => {
          n++;
          const corpo = JSON.parse(init.body);
          reg.richieste.push({ percorso, metodo: init.method, corpo, intest: init.headers });
          const f = o.rispondi?.(n, corpo);
          if (f) return f;
          const quanti = Math.min(500, restano);
          restano -= quanti;
          return json({
            ok: true,
            liberati: quanti,
            byte: quanti * peso,
            restano,
            non_riusciti: 0,
          });
        },
      };
    };
    const mai = () => false;

    {
      const s = servente({ totale: 1234 });
      const passi = [];
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: (a) => passi.push(a),
      });
      c(
        "«tutto» con 1.234 file: tre passi (500 + 500 + 234) fino a restano 0",
        [3, "finito", 1234, 0],
        [s.reg.richieste.length, e.esito, e.liberati, e.restano],
      );
      c(
        "…ogni richiesta è POST alla rotta delle azioni, col solo `tutto: true`",
        ["/api/crm/ponte-media-azione", "POST", { azione: "libera", tutto: true }],
        [s.reg.richieste[0].percorso, s.reg.richieste[0].metodo, s.reg.richieste[2].corpo],
      );
      c(
        "…l'avanzamento è dato a ogni passo (500, 1000, 1234) con i byte liberati",
        [
          [500, 734],
          [1000, 234],
          [1234, 0],
        ],
        passi.map((p) => [p.liberati, p.restano]),
      );
      c("…byte liberati sommati", 1234 * 2_000_000, e.byte);
      c("…il corpo dice che è JSON", "application/json", s.reg.richieste[0].intest["Content-Type"]);
    }
    {
      const s = servente({ totale: 0 });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "niente da liberare: una richiesta sola, finito, zero",
        [1, "finito", 0],
        [s.reg.richieste.length, e.esito, e.liberati],
      );
    }
    {
      const s = servente({ totale: 700 });
      const e = await U.liberaAPassi({ azione: "libera", numero: NUM_A }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "una chat: il corpo porta il `numero`, due passi",
        [{ azione: "libera", numero: NUM_A }, 2, 700],
        [s.reg.richieste[0].corpo, s.reg.richieste.length, e.liberati],
      );
    }
    {
      const s = servente({ totale: 1 });
      const e = await U.liberaAPassi({ azione: "libera", chiave: `bw:${NUM_A}:AAA1` }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "una chiave sola: una richiesta con `chiave`",
        [{ azione: "libera", chiave: `bw:${NUM_A}:AAA1` }, 1],
        [s.reg.richieste[0].corpo, e.liberati],
      );
    }
    {
      const chiavi = Array.from({ length: 450 }, (_, i) => `bw:${NUM_A}:K${i}`);
      const s = servente({
        rispondi: (_n, corpo) =>
          json({
            ok: true,
            liberati: corpo.chiavi.length,
            byte: corpo.chiavi.length * 1000,
            restano: 0,
            non_riusciti: 0,
          }),
      });
      const e = await U.liberaAPassi({ azione: "libera", chiavi }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "selezione di 450: lotti da 200 + 200 + 50, nessuno oltre 200",
        [3, [200, 200, 50], 450],
        [s.reg.richieste.length, s.reg.richieste.map((r) => r.corpo.chiavi.length), e.liberati],
      );
      c(
        "…le chiavi partono tutte, una volta sola",
        450,
        new Set(s.reg.richieste.flatMap((r) => r.corpo.chiavi)).size,
      );
    }
    {
      //  Il secondo passo cade: restano i 500 già liberati e si può riprendere.
      const s = servente({
        totale: 1234,
        rispondi: (n) => (n === 2 ? json({ ok: false, motivo: "storage" }, 503) : null),
      });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "guasto del server al secondo passo: errore, ma i 500 già liberati restano contati",
        ["errore", "server", 500, 734],
        [e.esito, e.motivo, e.liberati, e.restano],
      );
      const e2 = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "…riprendere (stessa richiesta) finisce il lavoro: restano 0, 734 liberati",
        ["finito", 0, 734],
        [e2.esito, e2.restano, e2.liberati],
      );
    }
    {
      const s = servente({ rispondi: () => json({ ok: false, motivo: "permesso" }, 403) });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "403 (manca «impostazioni»): errore `permesso`, una richiesta sola, niente ripetizioni",
        ["errore", "permesso", 1],
        [e.esito, e.motivo, s.reg.richieste.length],
      );
    }
    {
      const s = servente({ rispondi: () => json({ ok: false }, 401) });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c("401: errore `sessione`", "sessione", e.motivo);
    }
    {
      const s = servente({ rispondi: () => json({ ok: false, motivo: "migrazione" }, 503) });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "503 «migrazione»: errore `migrazione` (database non ancora aggiornato)",
        "migrazione",
        e.motivo,
      );
    }
    {
      const e = await U.liberaAPassi(
        { azione: "libera", tutto: true },
        () => Promise.reject(new TypeError("rete")),
        { fermato: mai, onPasso: () => {} },
      );
      c("rete caduta: errore `rete`, non lancia", ["errore", "rete"], [e.esito, e.motivo]);
    }
    for (const [nome, corpo] of [
      ["non JSON", new Response("<html>", { status: 200 })],
      ["senza i numeri", json({ ok: true })],
      [
        "con numeri negativi",
        json({ ok: true, liberati: -1, byte: 0, restano: 0, non_riusciti: 0 }),
      ],
      ["con `ok: false` e 200", json({ ok: false, motivo: "x" })],
    ]) {
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, async () => corpo.clone(), {
        fermato: mai,
        onPasso: () => {},
      });
      c(`risposta ${nome}: errore \`risposta\``, ["errore", "risposta"], [e.esito, e.motivo]);
    }
    {
      //  Un passo che non libera niente mentre ne restano: non si gira all'infinito.
      const s = servente({
        rispondi: () => json({ ok: true, liberati: 0, byte: 0, restano: 12, non_riusciti: 12 }),
      });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "nessun progresso con file che restano: si ferma con `bloccato` dopo UN passo",
        ["errore", "bloccato", 1, 12, 12],
        [e.esito, e.motivo, s.reg.richieste.length, e.restano, e.nonRiusciti],
      );
    }
    {
      //  Qualche file non riesce ma il resto avanza: i non riusciti si sommano, il lavoro continua.
      const s = servente({
        rispondi: (n) =>
          n === 1
            ? json({ ok: true, liberati: 490, byte: 490, restano: 100, non_riusciti: 10 })
            : n === 2
              ? json({ ok: true, liberati: 95, byte: 95, restano: 5, non_riusciti: 5 })
              : json({ ok: true, liberati: 0, byte: 0, restano: 5, non_riusciti: 5 }),
      });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
      });
      c(
        "non riusciti: l'ultimo passo li dice (5), il lavoro non finge di aver finito",
        ["errore", "bloccato", 585, 5, 5],
        [e.esito, e.motivo, e.liberati, e.restano, e.nonRiusciti],
      );
    }
    {
      //  «Ferma»: si guarda fra un passo e l'altro, mai a metà.
      let fermo = false;
      const s = servente({ totale: 1234 });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: () => fermo,
        onPasso: () => {
          fermo = true;
        },
      });
      c(
        "ferma dopo il primo passo: `fermato`, una richiesta, 734 restano",
        ["fermato", 1, 500, 734],
        [e.esito, s.reg.richieste.length, e.liberati, e.restano],
      );
    }
    {
      const s = servente({ totale: 100 });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: () => true,
        onPasso: () => {},
      });
      c(
        "già fermato prima di cominciare: nessuna richiesta",
        ["fermato", 0],
        [e.esito, s.reg.richieste.length],
      );
    }
    {
      //  Il server non finisce mai (bug): un tetto ai passi, 4 per la prova.
      const s = servente({
        rispondi: () => json({ ok: true, liberati: 1, byte: 1, restano: 999999, non_riusciti: 0 }),
      });
      const e = await U.liberaAPassi({ azione: "libera", tutto: true }, s.chiedi, {
        fermato: mai,
        onPasso: () => {},
        passiMax: 4,
      });
      c(
        "tetto di sicurezza ai passi: si ferma con `troppi_passi`",
        ["errore", "troppi_passi", 4],
        [e.esito, e.motivo, s.reg.richieste.length],
      );
    }
    c(
      "frasi d'errore: tutte scritte per il titolare, senza codici né gergo",
      true,
      [
        "permesso",
        "sessione",
        "migrazione",
        "server",
        "rete",
        "risposta",
        "bloccato",
        "troppi_passi",
      ]
        .map(U.fraseErrore)
        .every((f) => typeof f === "string" && f.length > 20 && !/undefined|\[object|null/.test(f)),
    );

    /* ═══ 3 · Il negozio di stato ═══ */
    gruppo("ARCHIVIAZIONE · IL NEGOZIO DI STATO (T9)");
    /** Un database finto: tre chat, 6 media nella prima, `restano` che scende. */
    const faiRete = (o = {}) => {
      const reg = { rpc: [], eventi: 0 };
      const tutteLeChat = o.chat ?? [
        rigaChat(NUM_C, 5_000_000, 2, 0, 0, 0),
        rigaChat(NUM_A, 90_000_000, 12, 3, 1, 4),
        rigaChat(NUM_B, 40_000_000, 5, 0, 0, 1),
      ];
      const serv = servente({ totale: o.totale ?? 1234, rispondi: o.rispondi });
      const media =
        o.media ??
        Array.from({ length: 60 }, (_, i) =>
          rigaMedia(`bw:${NUM_A}:M${String(i).padStart(2, "0")}`, {
            byte: 1_000_000 + i,
            creato_il: new Date(Date.parse("2026-10-30T10:00:00Z") - i * 60_000).toISOString(),
            categoria: i % 4 === 0 ? "video" : "foto",
            scade_il: i === 1 ? "2026-11-01T12:00:00Z" : null,
          }),
        );
      return {
        reg,
        serv,
        reti: {
          rpc: async (fn, args) => {
            reg.rpc.push({ fn, args });
            if (o.rpc) {
              const r = o.rpc(fn, args);
              if (r) return r;
            }
            if (fn === "ponte_wa_archivio_riassunto") return { data: grezzoRiass, error: null };
            if (fn === "ponte_wa_archivio_chat") return { data: tutteLeChat, error: null };
            if (fn === "ponte_wa_archivio_media") {
              const dopo = args.p_prima_chiave
                ? media.findIndex((m) => m.chiave === args.p_prima_chiave) + 1
                : 0;
              return { data: media.slice(dopo, dopo + args.p_limite), error: null };
            }
            return { data: null, error: { code: "42883" } };
          },
          tetto: async () => ("tetto" in o ? o.tetto : '{"acceso":true,"tettoGB":5}'),
          chiedi: serv.chiedi,
        },
        notifica: () => {
          reg.eventi++;
        },
      };
    };
    const nuovo = (o) => {
      const f = faiRete(o);
      const a = creaArchivio(f.reti, { notifica: f.notifica });
      return { f, a, st: () => a.leggi() };
    };

    {
      const { f, a, st } = nuovo();
      c("prima di caricare: fase `carico`", "carico", st().lettura.fase);
      await a.carica();
      const L = st().lettura;
      c(
        "carica: riassunto + chat + tetto 5 GB",
        ["ok", 3_400_000_000, 3, 5e9],
        [L.fase, L.riassunto.byteTotali, L.chat.length, L.tettoByte],
      );
      c(
        "…le chat sono per MB decrescenti",
        [NUM_A, NUM_B, NUM_C],
        L.chat.map((x) => x.numero),
      );
      c(
        "…le due letture sono le funzioni SQL del piano, senza parametri",
        [
          ["ponte_wa_archivio_riassunto", {}],
          ["ponte_wa_archivio_chat", {}],
        ],
        f.reg.rpc.slice(0, 2).map((x) => [x.fn, x.args ?? {}]),
      );
      c("…meno di 2.000 chat: nessun avviso", false, L.piuDi2000);
    }
    {
      const molte = Array.from({ length: 2000 }, (_, i) =>
        rigaChat(`3933300${String(i).padStart(5, "0")}`, 5000 - i),
      );
      const { a, st } = nuovo({ chat: molte });
      await a.carica();
      c(
        "esattamente 2.000 chat: il pannello lo dichiara (potrebbero essere di più)",
        [2000, true],
        [st().lettura.chat.length, st().lettura.piuDi2000],
      );
    }
    {
      const { a, st } = nuovo({
        rpc: (fn) =>
          fn === "ponte_wa_archivio_chat" ? { data: null, error: { code: "XX000" } } : null,
      });
      await a.carica();
      c(
        "lettura che fallisce: fase `errore` con una frase, niente dati a metà",
        ["errore", true],
        [
          st().lettura.fase,
          typeof st().lettura.frase === "string" && st().lettura.frase.length > 10,
        ],
      );
      c("…la frase non è un codice", false, /XX000|undefined/.test(st().lettura.frase));
    }
    {
      const { a, st } = nuovo({
        rpc: () => ({
          data: null,
          error: { code: "PGRST202", message: "Could not find the function" },
        }),
      });
      await a.carica();
      c(
        "funzione SQL mancante (migrazione B non applicata): lo dice, senza gergo di database",
        [true, false],
        [
          /aggiorn|migrazione|non ancora/i.test(st().lettura.frase),
          /PGRST|function/i.test(st().lettura.frase),
        ],
      );
    }
    {
      const { a, st } = nuovo({ tetto: null });
      await a.carica();
      c(
        "tetto illeggibile: il pannello funziona lo stesso (tetto nullo)",
        ["ok", null],
        [st().lettura.fase, st().lettura.tettoByte],
      );
    }
    {
      //  Due caricamenti uno sopra l'altro: vale l'ultimo, nessun doppio stato.
      const { a, st } = nuovo();
      await Promise.all([a.carica(), a.carica()]);
      c("due carica() insieme: stato coerente", "ok", st().lettura.fase);
    }

    {
      const { f, a, st } = nuovo();
      await a.carica();
      await a.apriChat(NUM_A);
      c(
        "apri una chat: prima pagina da 50, `fine` falso",
        [NUM_A, "ok", 50, false],
        [st().numero, st().media.fase, st().media.voci.length, st().media.fine],
      );
      const ultima = f.reg.rpc.filter((x) => x.fn === "ponte_wa_archivio_media").at(-1);
      c(
        "…la lettura chiede il numero, 50 righe, nessun cursore",
        { p_numero: NUM_A, p_limite: 50, p_prima_il: null, p_prima_chiave: null },
        ultima.args,
      );
      await a.altre();
      const ultima2 = f.reg.rpc.filter((x) => x.fn === "ponte_wa_archivio_media").at(-1);
      c(
        "altre: cursore keyset = data e chiave dell'ultima riga già letta",
        [`bw:${NUM_A}:M49`, "ok", 60, true],
        [ultima2.args.p_prima_chiave, st().media.fase, st().media.voci.length, st().media.fine],
      );
      c("…senza doppioni", 60, new Set(st().media.voci.map((v) => v.chiave)).size);
      await a.altre();
      c(
        "altre a fine elenco: nessuna richiesta in più",
        2,
        f.reg.rpc.filter((x) => x.fn === "ponte_wa_archivio_media").length,
      );
    }
    {
      const { a, st } = nuovo({
        rpc: (fn) =>
          fn === "ponte_wa_archivio_media" ? { data: null, error: { code: "XX000" } } : null,
      });
      await a.carica();
      await a.apriChat(NUM_A);
      c(
        "media che non si leggono: `errore` nell'elenco, l'elenco delle chat resta",
        ["errore", "ok"],
        [st().media.fase, st().lettura.fase],
      );
    }
    {
      //  Si apre un'altra chat mentre la prima legge ancora: vale solo l'ultima.
      let sblocca;
      const bloccata = new Promise((r) => (sblocca = r));
      const { a, st } = nuovo({
        rpc: (fn, args) =>
          fn === "ponte_wa_archivio_media" && args.p_numero === NUM_A
            ? bloccata.then(() => ({ data: [rigaMedia(`bw:${NUM_A}:LENTA`)], error: null }))
            : fn === "ponte_wa_archivio_media"
              ? { data: [rigaMedia(`bw:${NUM_B}:VELOCE`)], error: null }
              : null,
      });
      await a.carica();
      const lenta = a.apriChat(NUM_A);
      await a.apriChat(NUM_B);
      sblocca();
      await lenta;
      c(
        "risposta in ritardo di una chat già lasciata: scartata",
        [NUM_B, [`bw:${NUM_B}:VELOCE`]],
        [st().numero, st().media.voci.map((v) => v.chiave)],
      );
    }

    {
      const { a, st } = nuovo();
      await a.carica();
      await a.apriChat(NUM_A);
      const k0 = `bw:${NUM_A}:M00`;
      const k1 = `bw:${NUM_A}:M01`;
      a.scegli(k0);
      a.scegli(k1);
      c("selezione: due scelte", [k0, k1], st().scelte);
      a.scegli(k0);
      c("…toccare di nuovo toglie", [k1], st().scelte);
      a.scegli("bw:393330000099:NONCARICATA");
      c("…una chiave che non è nell'elenco non entra", [k1], st().scelte);
      a.scegliTutte();
      c("seleziona tutti: tutte le 50 caricate", 50, st().scelte.length);
      a.scegliTutte();
      c("…di nuovo: nessuna", 0, st().scelte.length);
      a.scegli(k0);
      a.tornaElenco();
      c(
        "tornare all'elenco azzera chat aperta, media e selezione",
        [null, 0, 0],
        [st().numero, st().media.voci.length, st().scelte.length],
      );
    }

    {
      const { a, st } = nuovo();
      await a.carica();
      await a.apriChat(NUM_A);
      a.scegli(`bw:${NUM_A}:M00`);
      a.chiedi({ tipo: "selezione" });
      a.svuota();
      c(
        "deseleziona: nessuna scelta e nessuna conferma pendente",
        [[], null],
        [st().scelte, st().conferma],
      );
    }
    {
      //  Conferma: prima si chiede, poi si fa; annullare non manda niente.
      const { f, a, st } = nuovo({ totale: 1234 });
      await a.carica();
      a.chiedi({ tipo: "tutto" });
      c("chiedi «tutto»: la conferma è in attesa", { tipo: "tutto" }, st().conferma);
      a.annulla();
      c(
        "annulla: nessuna conferma e NESSUNA richiesta di cancellazione",
        [null, 0],
        [st().conferma, f.serv.reg.richieste.length],
      );
      a.chiedi({ tipo: "selezione" });
      c("«selezione» senza scelte: ignorata", null, st().conferma);
      a.chiedi({ tipo: "chat", numero: "abc" });
      c("«chat» con un numero che non è nell'elenco: ignorata", null, st().conferma);
    }
    {
      const { f, a, st } = nuovo({ totale: 1234 });
      await a.carica();
      a.chiedi({ tipo: "tutto" });
      const prima = f.reg.rpc.length;
      const fine = a.conferma();
      c(
        "durante: lavoro `in_corso`, conferma chiusa",
        ["in_corso", null],
        [st().lavoro.fase, st().conferma],
      );
      c("…i file previsti sono quelli del riassunto (5.200)", 5200, st().lavoro.previsti);
      await fine;
      const Lv = st().lavoro;
      c(
        "«libera tutto» concluso: finito, 1.234 liberati, restano 0, 3 richieste",
        ["finito", 1234, 0, 3],
        [Lv.fase, Lv.liberati, Lv.restano, f.serv.reg.richieste.length],
      );
      c("…l'evento `ponte-media-liberati` parte UNA volta, a lavoro finito", 1, f.reg.eventi);
      c(
        "…poi il pannello si rilegge (riassunto e chat di nuovo)",
        true,
        f.reg.rpc.slice(prima).some((x) => x.fn === "ponte_wa_archivio_riassunto") &&
          f.reg.rpc.slice(prima).some((x) => x.fn === "ponte_wa_archivio_chat"),
      );
      a.chiudiEsito();
      c("chiudi l'esito: nessun lavoro", null, st().lavoro);
    }
    {
      const { f, a, st } = nuovo({ totale: 700 });
      await a.carica();
      a.chiedi({ tipo: "chat", numero: NUM_A });
      await a.conferma();
      c(
        "libera una chat: la richiesta porta il numero; previsti = file della chat (12+3+1+4)",
        [{ azione: "libera", numero: NUM_A }, 20],
        [f.serv.reg.richieste[0].corpo, st().lavoro.previsti],
      );
    }
    {
      const { f, a, st } = nuovo({
        rispondi: (_n, corpo) =>
          json({
            ok: true,
            liberati: corpo.chiavi.length,
            byte: 2_000_001,
            restano: 0,
            non_riusciti: 0,
          }),
      });
      await a.carica();
      await a.apriChat(NUM_A);
      a.scegli(`bw:${NUM_A}:M00`);
      a.scegli(`bw:${NUM_A}:M02`);
      a.chiedi({ tipo: "selezione" });
      await a.conferma();
      c(
        "libera la selezione: `chiavi` con le due scelte, finito",
        [{ azione: "libera", chiavi: [`bw:${NUM_A}:M00`, `bw:${NUM_A}:M02`] }, "finito", 2],
        [f.serv.reg.richieste[0].corpo, st().lavoro.fase, st().lavoro.liberati],
      );
      c(
        "…la selezione si svuota e l'elenco della chat si rilegge da capo",
        [0, true],
        [
          st().scelte.length,
          f.reg.rpc.filter((x) => x.fn === "ponte_wa_archivio_media").length >= 2,
        ],
      );
      c("…evento una volta", 1, f.reg.eventi);
    }
    {
      //  Il secondo passo cade: «Riprendi» rifà la stessa richiesta e conclude; l'evento parte a ogni fine di lavoro che ha liberato.
      const { f, a, st } = nuovo({
        totale: 1234,
        rispondi: (n) => (n === 2 ? json({ ok: false, motivo: "storage" }, 503) : null),
      });
      await a.carica();
      a.chiedi({ tipo: "tutto" });
      await a.conferma();
      c(
        "guasto a metà: lavoro `errore`, 500 liberati, frase e Riprendi",
        ["errore", 500, 734, "server"],
        [st().lavoro.fase, st().lavoro.liberati, st().lavoro.restano, st().lavoro.motivo],
      );
      c("…l'evento parte lo stesso (500 file sono davvero spariti)", 1, f.reg.eventi);
      await a.riprendi();
      c(
        "riprendi: finito, i liberati si sommano (1.234 in tutto)",
        ["finito", 1234, 0],
        [st().lavoro.fase, st().lavoro.liberati, st().lavoro.restano],
      );
      c("…evento di nuovo a fine lavoro", 2, f.reg.eventi);
    }
    {
      const { f, a, st } = nuovo({
        rispondi: () => json({ ok: false, motivo: "permesso" }, 403),
      });
      await a.carica();
      a.chiedi({ tipo: "tutto" });
      await a.conferma();
      c(
        "403: errore `permesso` e NESSUN evento (non è sparito niente)",
        ["errore", "permesso", 0],
        [st().lavoro.fase, st().lavoro.motivo, f.reg.eventi],
      );
    }
    {
      //  «Ferma» chiamato mentre il server lavora: si ferma fra i passi, poi si può riprendere.
      let a2;
      const f = faiRete({
        totale: 1234,
        rispondi: (n) => {
          if (n === 1) queueMicrotask(() => a2.ferma());
          return null;
        },
      });
      a2 = creaArchivio(f.reti, { notifica: f.notifica });
      await a2.carica();
      a2.chiedi({ tipo: "tutto" });
      await a2.conferma();
      c(
        "ferma: `fermato` dopo il passo in corso, 500 liberati, 734 restano",
        ["fermato", 500, 734, 1],
        [
          a2.leggi().lavoro.fase,
          a2.leggi().lavoro.liberati,
          a2.leggi().lavoro.restano,
          f.serv.reg.richieste.length,
        ],
      );
      await a2.riprendi();
      c(
        "…riprendi: finisce",
        ["finito", 1234],
        [a2.leggi().lavoro.fase, a2.leggi().lavoro.liberati],
      );
    }
    {
      //  Mentre lavora non se ne fanno altri.
      const { f, a, st } = nuovo({ totale: 1234 });
      await a.carica();
      a.chiedi({ tipo: "tutto" });
      const primo = a.conferma();
      a.chiedi({ tipo: "tutto" });
      const secondo = a.conferma();
      await Promise.all([primo, secondo]);
      c(
        "un secondo avvio mentre lavora è ignorato (3 richieste in tutto, non 6)",
        3,
        f.serv.reg.richieste.length,
      );
      c("…e non si apre una conferma nuova", null, st().conferma);
    }
    {
      const { a, st } = nuovo({ totale: 100 });
      await a.carica();
      const iscritti = [];
      const via = a.iscriviti(() => iscritti.push(a.leggi().lavoro?.fase ?? null));
      a.chiedi({ tipo: "tutto" });
      await a.conferma();
      via();
      const n = iscritti.length;
      a.chiudiEsito();
      c(
        "chi si iscrive viene avvisato dei cambi di stato (e dopo l'uscita non più)",
        [true, n],
        [iscritti.includes("in_corso") && iscritti.includes("finito"), iscritti.length],
      );
      c("…(lo stato resta leggibile)", null, st().lavoro);
    }
    {
      //  Chiudere il pannello a metà lavoro: `distruggi` ferma dopo il passo, senza rilasciare altro.
      const f = faiRete({ totale: 1234 });
      const a = creaArchivio(f.reti, { notifica: f.notifica });
      await a.carica();
      a.chiedi({ tipo: "tutto" });
      const corsa = a.conferma();
      a.distruggi();
      await corsa;
      c(
        "distruggi durante il lavoro: si ferma al passo in corso (1 richiesta), mai oltre",
        1,
        f.serv.reg.richieste.length,
      );
    }

    /* ═══ 4 · Il corpo disegnato ═══ */
    gruppo("ARCHIVIAZIONE · IL CORPO NEGLI STATI (T9)");
    const NOMI = { [NUM_A]: "Giulia Bianchi", [NUM_B]: "Marco Prova", [NUM_C]: "+39 333 000 0003" };
    const nomeDi = (n) => NOMI[n] ?? n;
    const corpo = (a, adesso = T0) =>
      disegna(
        React.createElement(CorpoArchivio, {
          stato: a.leggi(),
          azioni: a,
          nomeDi,
          adesso,
        }),
      );

    {
      const { a } = nuovo();
      const html0 = corpo(a);
      c(
        "prima della lettura: scheletri annunciati, nessun testo di dati",
        true,
        /aria-busy="true"/.test(html0) && !/Giulia/.test(html0),
      );
      await a.carica();
      const html = corpo(a);
      const t = testoDi(html);
      c(
        "elenco: spazio usato, tetto, tipi e timer",
        [true, true, true, true],
        [
          /3,4 GB/.test(t),
          /di 5 GB/.test(t),
          /Foto/.test(t) && /Vocali/.test(t) && /Video/.test(t) && /Documenti/.test(t),
          /12 con timer/.test(t),
        ],
      );
      c(
        "…la barra dello spazio è una vera progressbar con il valore (68%)",
        true,
        /role="progressbar"/.test(html) && /aria-valuenow="68"/.test(html),
      );
      c(
        "…le chat in ordine di MB: Giulia (90), Marco (40), numero (5)",
        true,
        t.indexOf("Giulia Bianchi") < t.indexOf("Marco Prova") &&
          t.indexOf("Marco Prova") < t.indexOf("+39 333 000 0003"),
      );
      c(
        "…il peso di ogni chat e il conteggio per tipo",
        [true, true, true],
        [/90 MB/.test(t), /12 foto · 3 vocali · 1 video · 4 doc/.test(t), /5 foto · 1 doc/.test(t)],
      );
      c(
        "…un «Libera» per chat, col nome nell'etichetta per chi non vede",
        3,
        (html.match(/aria-label="Libera la chat di [^"]+"/g) ?? []).length,
      );
      c(
        "…«Libera tutto» c'è e non è il tasto principale (nessun `bg-destructive` pieno nell'elenco)",
        [true, false],
        [/Libera tutto/.test(t), /bg-destructive[^/]/.test(html)],
      );
      c("…niente emoji", false, EMOJI.test(t));
      const tasti = html.match(/<button[^>]*aria-label="Libera la chat di[^>]*>/g) ?? [];
      c(
        "…tasti alti almeno 44 px sul telefono (min-h-11) per ogni «Libera»",
        [3, true],
        [tasti.length, tasti.every((x) => x.includes("min-h-11"))],
      );
    }
    {
      const { a } = nuovo({
        chat: Array.from({ length: 2000 }, (_, i) =>
          rigaChat(`3933300${String(i).padStart(5, "0")}`, 5000 - i),
        ),
      });
      await a.carica();
      const t = testoDi(corpo(a));
      c(
        "esattamente 2.000 chat: l'avviso «Libera tutto le libera tutte» è scritto",
        [true, true],
        [/2\.000 chat/.test(t), /Libera tutto/.test(t) && /tutte/.test(t)],
      );
    }
    {
      const { a } = nuovo();
      await a.carica();
      a.chiedi({ tipo: "chat", numero: NUM_B });
      const t = testoDi(corpo(a));
      c(
        "conferma in riga: dice file e peso della chat (6 file, 40 MB) e che restano i segnaposto",
        [true, true, true],
        [
          /Libero 6 file \(40 MB\)\?/.test(t),
          /segnaposto/.test(t),
          /Sì, libera/.test(t) && /Annulla/.test(t),
        ],
      );
      c(
        "…solo la riga di Marco è in conferma (le altre hanno ancora «Libera»)",
        2,
        (corpo(a).match(/aria-label="Libera la chat di/g) ?? []).length,
      );
    }
    {
      const { a } = nuovo({
        chat: [],
        rpc: (fn) =>
          fn === "ponte_wa_archivio_riassunto"
            ? {
                data: { ...grezzoRiass, byte_totali: 0, file: 0, con_timer: 0, per_tipo: {} },
                error: null,
              }
            : null,
      });
      await a.carica();
      const t = testoDi(corpo(a));
      c(
        "archivio vuoto: lo dice e non offre «Libera tutto»",
        [true, false],
        [/Nessun file/.test(t), /Libera tutto/.test(t)],
      );
    }
    {
      const { a } = nuovo({
        rpc: (fn) =>
          fn === "ponte_wa_archivio_riassunto" ? { data: null, error: { code: "XX000" } } : null,
      });
      await a.carica();
      const html = corpo(a);
      c(
        "errore di lettura: avviso (role=alert) con «Riprova»",
        [true, true],
        [/role="alert"/.test(html), /Riprova/.test(testoDi(html))],
      );
    }
    {
      const { a } = nuovo();
      await a.carica();
      await a.apriChat(NUM_A);
      a.scegli(`bw:${NUM_A}:M00`);
      a.scegli(`bw:${NUM_A}:M01`);
      const html = corpo(a);
      const t = testoDi(html);
      c(
        "chat aperta: i suoi media, 50 per pagina, con «Carica altri»",
        [50, true],
        [(html.match(/type="checkbox"/g) ?? []).length, /Carica altri/.test(t)],
      );
      c(
        "…selezione: «Libera selezionati (2, 2 MB)»",
        true,
        /Libera selezionati \(2, 2 MB\)/.test(t),
      );
      c(
        "…le due righe scelte sono segnate (checked) e le altre no",
        2,
        (html.match(/checked=""/g) ?? []).length,
      );
      c(
        "…la miniatura valida diventa `data:image/jpeg;base64`, il testo del nome resta testo",
        true,
        /src="data:image\/jpeg;base64,\/9j\//.test(html),
      );
      c(
        "…un timer attivo si legge («tra 1 g» per il file in scadenza fra 24 ore)",
        true,
        /tra 1 g/.test(t),
      );
      a.chiedi({ tipo: "selezione" });
      const tc = testoDi(corpo(a));
      c(
        "conferma della selezione: «Libero 2 file (2 MB)?» con Sì, libera e Annulla",
        [true, true],
        [/Libero 2 file \(2 MB\)\?/.test(tc), /Sì, libera/.test(tc) && /Annulla/.test(tc)],
      );
    }
    {
      //  Nomi e didascalie sono testo di un cliente: mai HTML.
      const { a } = nuovo({
        media: [
          rigaMedia(`bw:${NUM_A}:X1`, {
            categoria: "documento",
            nome: "<img src=x onerror=alert(1)>.pdf",
            miniatura: null,
          }),
        ],
      });
      await a.carica();
      await a.apriChat(NUM_A);
      const html = corpo(a);
      c(
        "nome file ostile: appare come testo, nessun tag creato",
        [false, true],
        [/<img src=x/.test(html), html.includes("&lt;img src=x")],
      );
    }
    {
      const { a } = nuovo({ totale: 1234 });
      await a.carica();
      a.chiedi({ tipo: "tutto" });
      const corsa = a.conferma();
      const html = corpo(a);
      const t = testoDi(html);
      c(
        "lavoro in corso: avanzamento annunciato (status), barra, «Ferma»",
        [true, true, true],
        [/role="status"/.test(html), /Libero/.test(t) && /di 5\.200 file/.test(t), /Ferma/.test(t)],
      );
      const tasti = html.match(/<button[^>]*aria-label="Libera la chat di[^>]*>/g) ?? [];
      c(
        "…la barra di avanzamento dice il suo valore a chi non la vede",
        true,
        /role="progressbar"[^>]*aria-valuenow="0"|aria-valuenow="0"[^>]*role="progressbar"/.test(
          html,
        ),
      );
      c(
        "…mentre lavora tutti i «Libera» sono disattivati",
        [3, true],
        [tasti.length, tasti.every((x) => x.includes("disabled"))],
      );
      await corsa;
      const tf = testoDi(corpo(a));
      c(
        "lavoro finito: «Fatto: liberati 1.234 file (2,47 GB)»",
        true,
        /Fatto: liberati 1\.234 file \(2,47 GB\)/.test(tf),
      );
    }
    {
      const { a } = nuovo({
        totale: 1234,
        rispondi: (n) => (n === 2 ? json({ ok: false, motivo: "storage" }, 503) : null),
      });
      await a.carica();
      a.chiedi({ tipo: "tutto" });
      await a.conferma();
      const html = corpo(a);
      const t = testoDi(html);
      c(
        "lavoro caduto: avviso con la frase, i 500 già liberati e «Riprendi»",
        [true, true, true],
        [/role="alert"/.test(html), /500 file/.test(t), /Riprendi/.test(t)],
      );
    }
    {
      //  «Libera tutto» ha il suo AlertDialog: il testo si prova a parte (il portale non gira sul server).
      const t = testoDi(
        disegna(React.createElement(TestoConfermaTutto, { file: 5200, byte: 3_400_000_000 })),
      );
      c(
        "conferma di «Libera tutto»: numero di file e GB, e dice cosa resta",
        [true, true, true],
        [/5\.200 file/.test(t), /3,4 GB/.test(t), /segnaposto/.test(t)],
      );
    }

    /* ═══ 5 · Il sorgente: permesso, tasto, nessun segreto ═══ */
    gruppo("ARCHIVIAZIONE · SORGENTE E INTESTAZIONE (T9)");
    const pagina = readFileSync(join(radice, "src/crm/chatwa/PaginaChat.tsx"), "utf8");
    const pannello = readFileSync(join(radice, "src/crm/chatwa/PannelloArchiviazione.tsx"), "utf8");
    const hook = readFileSync(join(radice, "src/crm/chatwa/usaArchivio.ts"), "utf8");
    const puro = readFileSync(join(radice, "src/crm/chatwa/archivio.ts"), "utf8");
    c(
      "PaginaChat: il tasto e il pannello si vedono solo con «impostazioni»",
      [true, true],
      [
        /const vedeArchivio = usePuo\(\)\("impostazioni"\)/.test(pagina),
        /\{vedeArchivio && <TastoArchiviazione/.test(pagina) &&
          /\{vedeArchivio && \(\s*<PannelloArchiviazione/.test(pagina),
      ],
    );
    c(
      "PaginaChat: il pannello riceve le chat per i nomi (nessuna lettura in più)",
      true,
      /<PannelloArchiviazione[\s\S]*?chats=\{api\.chats\}/.test(pagina),
    );
    c(
      "PaginaChat: il resto non cambia (le colonne e il pannello Oggi sono dove erano)",
      [true, true, true],
      [
        /<ElencoChat api=\{apiElenco\}/.test(pagina),
        /<Conversazione\s+api=\{apiPagina\}/.test(pagina),
        /<TastoCosti onClick/.test(pagina),
      ],
    );
    const tutto = [pannello, hook, puro].map(senzaCommenti).join("\n");
    c(
      "nessuna chiave, nessun indirizzo firmato, nessun log",
      [false, false, false],
      [
        /service_role|SUPABASE_[A-Z_]+|apikey/i.test(tutto),
        /token=|sign\//.test(tutto),
        /console\./.test(tutto),
      ],
    );
    c(
      "il browser legge solo le tre funzioni SQL e la riga del tetto; scrive solo dalla rotta del Worker",
      [
        ["ponte_wa_archivio_riassunto", "ponte_wa_archivio_chat", "ponte_wa_archivio_media"],
        ["app_config"],
        false,
        true,
      ],
      [
        ["ponte_wa_archivio_riassunto", "ponte_wa_archivio_chat", "ponte_wa_archivio_media"].filter(
          (n) => hook.includes(n),
        ),
        [...tutto.matchAll(/\.from\("([^"]+)"\)/g)].map((m) => m[1]),
        /\.(insert|upsert)\(|\.from\([^)]*\)\s*\.(delete|update)\(|storage\.from|\.remove\(/.test(
          tutto,
        ),
        /\/api\/crm\/ponte-media-azione/.test(puro),
      ],
    );
    c(
      "il pannello non importa i file degli altri compiti (nessun import incrociato con la bolla)",
      false,
      /from "\.\/(BollaMessaggio|MediaPonte|FoglioMedia|usaMediaPonte|usaVisibile)"/.test(
        pannello + hook + puro,
      ),
    );
    c(
      "contratto con T8: l'evento si chiama `ponte-media-liberati`, creato con `new Event`",
      true,
      /new Event\("ponte-media-liberati"\)/.test(hook + puro),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
