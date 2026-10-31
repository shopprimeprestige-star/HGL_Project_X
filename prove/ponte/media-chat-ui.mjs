/** ── PROVE: I MEDIA DEL PONTE NELLA CHAT (compito T8) ──
 *
 *  Commessa 2026-10-31-media-e-archiviazione, PIANO (b), (c.2), (c2.2) passi bolla.
 *  Foto, vocali, video e documenti in chat: quale messaggio è un media, righe lette
 *  a gruppi, scarico con 3 insieme e LRU, indirizzi firmati che non entrano nel DOM,
 *  caricamento pigro (un osservatore per contenitore, `root` giusto), pressione lunga
 *  (click ignorato ~400 ms dal rilascio), foglio dei timer, Rispiega dal foglio.
 *  Nessuna rete e nessun dato vero: database, rete e IntersectionObserver sono finti,
 *  i numeri sono finti (39333000…). I tocchi veri e le misure a 375 e 1280 px stanno in
 *  Playwright (LAVAGNA); qui il disegno si controlla con `react-dom/server`.
 *
 *  Non registrata in `prove/ponte.mjs`: lo fa T11.
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
    .replace(/\s+/g, " ")
    .trim();
const dormi = (ms) => new Promise((r) => setTimeout(r, ms));
/** Un indirizzo firmato finto, con un «gettone» riconoscibile da cercare nel DOM. */
const FIRMATO =
  "https://progetto-finto.supabase.co/storage/v1/object/sign/ponte-media/x/y.bin?token=GETTONE-SEGRETO-123";
const UTENTE = "0b0b0b0b-1111-4222-8333-444444444444";
const uuid = (n) => `7c1e5f0a-9b2d-4e6f-8a3b-${String(n).padStart(12, "0")}`;

export async function provePonteMediaChatUi(_mod, { c, gruppo, radice }) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const richiedi = createRequire(import.meta.url);
  const dir = mkdtempSync(join(tmpdir(), "ponte-media-ui-"));
  const salvati = {};
  for (const k of ["IntersectionObserver", "getComputedStyle", "window"])
    salvati[k] = globalThis[k];
  try {
    /* ── Impacchetto i file veri con database e rete finti ─────────────────── */
    writeFileSync(
      join(dir, "client.js"),
      `export const supabase = {
         from: (t) => ({
           select: (s) => ({
             in: async (k, v) => {
               globalThis.__letture.push({ t, s, k, v });
               const r = globalThis.__risposta;
               if (typeof r === "function") return r(t, v, s);
               return { data: [], error: null };
             },
             eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
           }),
         }),
       };`,
    );
    writeFileSync(
      join(dir, "auth.js"),
      "export const fetchCRM = async () => new Response('{}', { status: 500 }); export const useAuth = () => ({ user: null });",
    );
    writeFileSync(join(dir, "crm.js"), "export const useCRM = () => ({ consultants: [] });");
    writeFileSync(
      join(dir, "ingresso.tsx"),
      `import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export { React, renderToStaticMarkup };
export { BollaMessaggio } from ${JSON.stringify(join(radice, "src/crm/chatwa/BollaMessaggio.tsx"))};
export { VistaMediaPonte } from ${JSON.stringify(join(radice, "src/crm/chatwa/MediaPonte.tsx"))};
export { FoglioMedia } from ${JSON.stringify(join(radice, "src/crm/chatwa/FoglioMedia.tsx"))};
export * from ${JSON.stringify(join(radice, "src/crm/chatwa/usaMediaPonte.ts"))};
export { osservaVisibile, osservatoriAttivi, contenitoreCheScorre, ATTESA_MS, MARGINE_PX } from ${JSON.stringify(join(radice, "src/crm/chatwa/usaVisibile.ts"))};`,
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
            b.onResolve({ filter: /(^@\/crm\/|^\.\.\/)AuthContext$/ }, () => ({
              path: join(dir, "auth.js"),
            }));
            b.onResolve({ filter: /^@\/crm\/CRMContext$/ }, () => ({ path: join(dir, "crm.js") }));
          },
        },
      ],
    });
    const U = richiedi(join(dir, "ui.cjs"));
    const { React, renderToStaticMarkup, BollaMessaggio, VistaMediaPonte, FoglioMedia } = U;
    const disegna = (el) => renderToStaticMarkup(el);
    const json = (o, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
    const CH = "bw:393330000001:3EB0A1B2C3D4";
    const base = { canale: "baileys", wa_message_id: CH, body: "📷 Foto" };

    /* ═══ Quale messaggio è un media del ponte ═══ */
    gruppo("PONTE · MEDIA · QUALE MESSAGGIO È UN MEDIA (T8)");
    const cat = (body) => U.mediaDelPonte({ ...base, body })?.categoria ?? null;
    c(
      "«📷 Foto» = foto, «🎤 Vocale» = audio, «🎥 Video» = video, «📎 Documento» = documento",
      ["foto", "audio", "video", "documento"],
      ["📷 Foto", "🎤 Vocale", "🎥 Video", "📎 Documento"].map(cat),
    );
    c("il vocale con la durata («🎤 Vocale 0:12») è audio", "audio", cat("🎤 Vocale 0:12"));
    c(
      "con la didascalia: foto e video la riportano",
      ["ecco la nuca", "guarda"],
      [
        U.mediaDelPonte({ ...base, body: "📷 Foto: ecco la nuca" }).didascalia,
        U.mediaDelPonte({ ...base, body: "🎥 Video: guarda" }).didascalia,
      ],
    );
    c(
      "documento: «📎 Documento: scheda.pdf» è un documento (il nome viene dalla riga)",
      "documento",
      cat("📎 Documento: scheda.pdf"),
    );
    c(
      "«📎 Allegato», «📍 Posizione» e simili NON sono media del ponte",
      [null, null, null],
      ["📎 Allegato", "📍 Posizione", "👤 Contatto"].map(cat),
    );
    c("testo che CONTIENE il segnaposto ma comincia altrimenti: no", null, cat("guarda 🎥 Video"));
    c(
      "ManyChat (canale diverso) e chiavi non `bw:`: no",
      [null, null, null],
      [
        U.mediaDelPonte({ ...base, canale: "manychat" }),
        U.mediaDelPonte({ ...base, wa_message_id: "mc-in:1" }),
        U.mediaDelPonte({ ...base, wa_message_id: "bw:393330000001:a b" }),
      ],
    );
    c(
      "`fotoDelPonte` resta: foto sì, vocale no",
      [true, false],
      [U.fotoDelPonte(base) !== null, U.fotoDelPonte({ ...base, body: "🎤 Vocale" }) !== null],
    );
    {
      const t0 = Date.now();
      U.mediaDelPonte({ ...base, body: "🎤" + " ".repeat(50_000) + "x" });
      U.mediaDelPonte({ ...base, body: "📎 Documento:" + " ".repeat(50_000) + "x" });
      c("regole veloci anche con testi lunghi (nessun backtracking)", true, Date.now() - t0 < 100);
    }

    /* ═══ Indirizzo firmato e scarico, per categoria ═══ */
    gruppo("PONTE · MEDIA · INDIRIZZO FIRMATO E SCARICO (T8)");
    const ID_JPG = `${uuid(1)}.jpg`;
    const rete = (o = {}) => {
      const reg = { chiesti: [], scaricati: [] };
      return {
        reg,
        chiedi: async (p, init) => {
          reg.chiesti.push({ p, init });
          return o.chiedi ? o.chiedi(p, init) : json({ ok: true, url: FIRMATO });
        },
        scarica: async (u, init) => {
          reg.scaricati.push({ u, init });
          return o.scarica
            ? o.scarica(u, init)
            : new Response(new Blob([new Uint8Array(8)], { type: o.tipo ?? "image/jpeg" }), {
                status: 200,
              });
        },
      };
    };
    {
      const r = rete();
      const e = await U.caricaBlob(ID_JPG, "foto", r);
      c(
        "foto: chiede `uso=vedi`, scarica senza cookie né referrer",
        [`/api/crm/ponte-media?id=${ID_JPG}&uso=vedi`, "omit", "no-referrer", true],
        [
          r.reg.chiesti[0].p,
          r.reg.scaricati[0].init.credentials,
          r.reg.scaricati[0].init.referrerPolicy,
          e.ok,
        ],
      );
      c(
        "…l'esito non porta l'indirizzo firmato",
        false,
        JSON.stringify({ ...e, blob: undefined }).includes("GETTONE"),
      );
    }
    for (const est of ["ogg", "m4a", "mp3", "aac", "amr", "opus", "heic", "a1"]) {
      const id = `${uuid(2)}.${est}`;
      const r = rete({ tipo: "audio/ogg" });
      const e = await U.caricaBlob(id, "audio", r);
      c(`estensione «.${est}» (qualunque [a-z0-9]{2,5}): accettata`, true, e.ok);
    }
    for (const x of [
      `${uuid(3)}.j`,
      `${uuid(3)}.abcdef`,
      `${uuid(3)}.JPG`,
      `${uuid(3)}.j-g`,
      `${uuid(3)}`,
      `${UTENTE}/${uuid(3)}.jpg`,
      `${ID_JPG}&uso=apri`,
      "",
    ]) {
      const r = rete();
      const e = await U.caricaBlob(x, "foto", r);
      c(
        `identificativo non valido «${x.slice(0, 16)}»: nessuna richiesta`,
        [false, 0],
        [e.ok, r.reg.chiesti.length],
      );
    }
    for (const [categoria, tipo, atteso] of [
      ["foto", "image/svg+xml", false],
      ["foto", "text/html", false],
      ["foto", "audio/ogg", false],
      ["audio", "image/jpeg", false],
      ["audio", "text/html", false],
      ["audio", "audio/ogg", true],
      ["audio", "audio/mp4", true],
      ["audio", "audio/mpeg", true],
      ["audio", "audio/aac", true],
      ["audio", "audio/amr", true],
      ["audio", "audio/ogg; codecs=opus", true],
      ["audio", "audio/x-evil", false],
    ]) {
      const e = await U.caricaBlob(`${uuid(4)}.bin`, categoria, rete({ tipo }));
      c(
        `${categoria} con tipo «${tipo}»: ${atteso ? "ok" : "rifiutato, senza Riprova"}`,
        atteso ? [true] : [false, false],
        atteso ? [e.ok] : [e.ok, e.riprova],
      );
    }
    c(
      "video e documento non passano da `blob:` (mai scaricati in memoria)",
      [false, false],
      [
        (await U.caricaBlob(`${uuid(5)}.mp4`, "video", rete())).ok,
        (await U.caricaBlob(`${uuid(5)}.pdf`, "documento", rete())).ok,
      ],
    );
    c(
      "audio oltre 17 MiB: rifiutato; foto oltre 9 MiB: rifiutata",
      [false, false],
      [
        (
          await U.caricaBlob(
            `${uuid(6)}.ogg`,
            "audio",
            rete({
              scarica: () =>
                new Response(
                  new Blob([new Uint8Array(17 * 1024 * 1024 + 1)], { type: "audio/ogg" }),
                ),
            }),
          )
        ).ok,
        (
          await U.caricaBlob(
            ID_JPG,
            "foto",
            rete({
              scarica: () =>
                new Response(
                  new Blob([new Uint8Array(9 * 1024 * 1024 + 1)], { type: "image/png" }),
                ),
            }),
          )
        ).ok,
      ],
    );
    {
      const e = await U.caricaBlob(
        ID_JPG,
        "foto",
        rete({ chiedi: () => json({ ok: false }, 404) }),
      );
      c(
        "404: file perso (definitivo), niente Riprova",
        [false, false, true],
        [e.ok, e.riprova, e.perso === true],
      );
      const e2 = await U.caricaBlob(
        ID_JPG,
        "foto",
        rete({ chiedi: () => json({ ok: false, motivo: "storage" }, 503) }),
      );
      c(
        "503: errore con Riprova, NON perso",
        [false, true, false],
        [e2.ok, e2.riprova, e2.perso === true],
      );
    }
    {
      const r = rete();
      const e = await U.chiediUrl(`${uuid(7)}.mp4`, "video", "video", r);
      c(
        "`chiediUrl` video: `uso=video` e restituisce l'indirizzo (solo https)",
        [`/api/crm/ponte-media?id=${uuid(7)}.mp4&uso=video`, true],
        [r.reg.chiesti[0].p, e.ok && e.url === FIRMATO],
      );
      const e2 = await U.chiediUrl(
        `${uuid(7)}.pdf`,
        "apri",
        "documento",
        rete({ chiedi: () => json({ ok: true, url: "http://x.test/a.pdf" }) }),
      );
      c("`chiediUrl` con un indirizzo non https: errore", false, e2.ok);
      const e3 = await U.chiediUrl(
        `${uuid(7)}.pdf`,
        "apri",
        "documento",
        rete({ chiedi: () => Promise.reject(new TypeError("rete")) }),
      );
      c(
        "`chiediUrl` con la rete caduta: errore con Riprova, non lancia",
        [false, true],
        [e3.ok, e3.riprova],
      );
    }

    /* ═══ Tre alla volta e cache LRU ═══ */
    gruppo("PONTE · MEDIA · TRE DOWNLOAD INSIEME E CACHE LRU (T8)");
    {
      U.svuotaBlob();
      let attivi = 0;
      let picco = 0;
      const lenta = {
        chiedi: async () => json({ ok: true, url: FIRMATO }),
        scarica: async () => {
          attivi++;
          picco = Math.max(picco, attivi);
          await dormi(15);
          attivi--;
          return new Response(new Blob([new Uint8Array(100)], { type: "image/jpeg" }));
        },
      };
      const esiti = await Promise.all(
        Array.from({ length: 10 }, (_, i) => U.scaricaMedia(`${uuid(100 + i)}.jpg`, "foto", lenta)),
      );
      c(
        "10 foto insieme: mai più di 3 scarichi contemporanei",
        [true, 3],
        [esiti.every((e) => e.ok), picco],
      );
      const r = rete();
      const di = await U.scaricaMedia(`${uuid(100)}.jpg`, "foto", r);
      c(
        "la stessa foto una seconda volta: dalla cache, nessuna rete",
        [true, 0, 0],
        [di.ok, r.reg.chiesti.length, r.reg.scaricati.length],
      );
    }
    {
      U.svuotaBlob();
      const grossa = (n) => ({
        chiedi: async () => json({ ok: true, url: FIRMATO }),
        scarica: async () => new Response(new Blob([new Uint8Array(n)], { type: "image/png" })),
      });
      const MB = 1024 * 1024;
      for (let i = 0; i < 5; i++)
        await U.scaricaMedia(`${uuid(200 + i)}.png`, "foto", grossa(8 * MB)); // 40 MB: il più vecchio esce
      c(
        "cache oltre 32 MB: esce la meno recente, restano le ultime",
        [false, true, true, true, true],
        [0, 1, 2, 3, 4].map((i) => U.blobInCache(`${uuid(200 + i)}.png`) !== null),
      );
      c("…la cache non supera mai 32 MB", true, U.pesoCache() <= 32 * MB);
      U.blobInCache(`${uuid(201)}.png`); // lo rinfresca
      await U.scaricaMedia(`${uuid(205)}.png`, "foto", grossa(8 * MB));
      c(
        "usare una voce la rende «recente»: esce la successiva",
        [true, false],
        [U.blobInCache(`${uuid(201)}.png`) !== null, U.blobInCache(`${uuid(202)}.png`) !== null],
      );
      U.dimenticaBlob(`${uuid(201)}.png`);
      c(
        "`dimenticaBlob` (404 dopo una liberazione): la voce sparisce",
        null,
        U.blobInCache(`${uuid(201)}.png`),
      );
      const rotta = await U.scaricaMedia(`${uuid(300)}.png`, "foto", {
        chiedi: async () => json({ ok: false }, 503),
        scarica: async () => new Response(""),
      });
      c(
        "un guasto non entra in cache",
        [false, null],
        [rotta.ok, U.blobInCache(`${uuid(300)}.png`)],
      );
    }

    /* ═══ La riga, letta a gruppi ═══ */
    gruppo("PONTE · MEDIA · LA RIGA IN ponte_wa_media E LE RICHIESTE (T8)");
    const k = (id) => `bw:393330000001:${id}`;
    const MINI = "/9j/4AAQSkZJRgABAQ" + "A".repeat(20) + "==";
    const riga = (chiave, o = {}) => ({
      chiave,
      stato: "pronta",
      path: `${UTENTE}/${ID_JPG}`,
      categoria: "foto",
      nome: null,
      byte: 1200,
      durata_s: null,
      larghezza: 800,
      altezza: 600,
      miniatura: MINI,
      scade_il: null,
      ...o,
    });
    globalThis.__letture = [];
    globalThis.__risposta = (t, v) => {
      if (t === "ponte_wa_media_richieste")
        return {
          data: v
            .filter((x) => x.endsWith(":R"))
            .map((chiave) => ({ chiave, stato: "in_attesa", motivo: null, timer_s: 3600 })),
          error: null,
        };
      return {
        data: v
          .filter((x) => /:[PC]$/.test(x))
          .map((x) => riga(x, x.endsWith(":C") ? { stato: "in_caricamento", path: null } : {})),
        error: null,
      };
    };
    {
      const [p, cc, n] = await Promise.all([
        U.leggiRiga(k("P")),
        U.leggiRiga(k("C")),
        U.leggiRiga(k("N")),
      ]);
      c(
        "pronta / in caricamento / senza riga",
        ["pronta", "in_caricamento", "nessuna"],
        [p.stato, cc.stato, n.stato],
      );
      const media = globalThis.__letture.filter((l) => l.t === "ponte_wa_media");
      const rich = globalThis.__letture.filter((l) => l.t === "ponte_wa_media_richieste");
      c(
        "tre bolle nello stesso istante = UNA lettura della tabella e UNA delle richieste",
        [1, 1, 3, 3],
        [media.length, rich.length, media[0].v.length, rich[0].v.length],
      );
      c(
        "la lettura chiede le colonne del PIANO",
        "chiave,stato,path,categoria,nome,byte,durata_s,larghezza,altezza,miniatura,scade_il",
        media[0].s,
      );
      c(
        "…e delle richieste: chiave, stato, motivo, timer_s",
        "chiave,stato,motivo,timer_s",
        rich[0].s,
      );
      c(
        "la riga pronta porta categoria, dimensioni, miniatura e l'identificativo del file",
        ["foto", 800, 600, MINI, ID_JPG, ID_JPG],
        [p.categoria, p.larghezza, p.altezza, p.miniatura, p.id, U.idFoto(k("P"))],
      );
      c("in caricamento / senza riga: nessun identificativo", [null, null], [cc.id, n.id]);
    }
    {
      globalThis.__letture = [];
      await U.leggiRiga(k("P"));
      c("pronta resta in memoria: nessuna nuova lettura", 0, globalThis.__letture.length);
      await U.leggiRiga(k("N"));
      c("«senza riga» vale 30 s: nessuna nuova lettura", 0, globalThis.__letture.length);
      const r = await U.leggiRiga(k("R"));
      c(
        "una richiesta in attesa si legge dalla tabella delle richieste",
        [{ stato: "in_attesa", motivo: null, timer_s: 3600 }],
        [r.richiesta],
      );
      globalThis.__letture = [];
      await U.leggiRiga(k("R"));
      c(
        "…e una riga con richiesta in corso NON si ricorda (si rilegge ogni volta)",
        true,
        globalThis.__letture.length > 0,
      );
    }
    {
      globalThis.__letture = [];
      const molte = Array.from({ length: 250 }, (_, i) => k(`M${i}`));
      await Promise.all(molte.map((x) => U.leggiRiga(x)));
      const m = globalThis.__letture.filter((l) => l.t === "ponte_wa_media").map((l) => l.v.length);
      c("250 media in chat: letture da 100 + 100 + 50, mai un indirizzo enorme", [100, 100, 50], m);
    }
    {
      globalThis.__risposta = (t, v) => ({
        data:
          t === "ponte_wa_media"
            ? v.map((x, i) =>
                riga(x, {
                  miniatura: [
                    "javascript:alert(1)",
                    "/9j/<script>",
                    "/9j/" + "A".repeat(12_001),
                    MINI,
                  ][i],
                  path: i === 3 ? `${UTENTE}/${uuid(9)}.ogg` : `${UTENTE}/${ID_JPG}`,
                }),
              )
            : [],
        error: null,
      });
      const ks = ["V0", "V1", "V2", "V3"].map(k);
      const rr = await Promise.all(ks.map((x) => U.leggiRiga(x)));
      c(
        "miniatura fuori regola (non base64 JPEG, o oltre 12.000 caratteri): scartata",
        [null, null, null, MINI],
        rr.map((x) => x.miniatura),
      );
      c("percorso con estensione qualunque: l'identificativo c'è", `${uuid(9)}.ogg`, rr[3].id);
    }
    {
      globalThis.__risposta = (t, v, s) => {
        if (t === "ponte_wa_media" && s.includes("categoria"))
          return { data: null, error: { message: "colonna inesistente" } };
        return {
          data:
            t === "ponte_wa_media"
              ? v.map((x) => ({ chiave: x, stato: "pronta", path: `${UTENTE}/${ID_JPG}` }))
              : [],
          error: null,
        };
      };
      const x = await U.leggiRiga(k("OLD"));
      c(
        "prima della migrazione A (colonne nuove assenti): rilegge con le colonne di prima, la foto si vede",
        ["pronta", ID_JPG],
        [x.stato, x.id],
      );
      globalThis.__risposta = () => ({ data: null, error: { message: "permessi" } });
      let rifiutata = false;
      await U.leggiRiga(k("ERR")).catch(() => (rifiutata = true));
      c(
        "lettura fallita davvero: la promessa rifiuta (la bolla resta il testo di sempre)",
        true,
        rifiutata,
      );
      globalThis.__risposta = (t, v) => ({
        data: t === "ponte_wa_media" ? v.map((x) => riga(x)) : [],
        error: null,
      });
      c(
        "…un guasto non si ricorda: la volta dopo rilegge",
        "pronta",
        (await U.leggiRiga(k("ERR"))).stato,
      );
      U.dimenticaRiga();
      globalThis.__letture = [];
      await U.leggiRiga(k("ERR"));
      c(
        "`dimenticaRiga()` (evento «ponte-media-liberati»): rilegge anche le pronte",
        1,
        globalThis.__letture.filter((l) => l.t === "ponte_wa_media").length,
      );
    }

    /* ═══ Le fasi ═══ */
    gruppo("PONTE · MEDIA · LE FASI DELLA BOLLA (T8)");
    const R = (o) => ({
      stato: "nessuna",
      id: null,
      categoria: null,
      nome: null,
      byte: null,
      durata_s: null,
      larghezza: null,
      altezza: null,
      miniatura: null,
      scade_il: null,
      richiesta: null,
      ...o,
    });
    const fase = (r, ctx = {}) =>
      U.faseDaRiga(r, { adesso: 1_000_000, richiestoAlle: null, ...ctx }).fase;
    c(
      "nessuna riga o liberato: segnaposto (il testo di sempre)",
      ["nessuna", "nessuna"],
      [fase(R({})), fase(R({ stato: "liberato" }))],
    );
    c(
      "pronta: pronta (anche con una richiesta vecchia non_disponibile)",
      ["pronta", "pronta"],
      [
        fase(R({ stato: "pronta" })),
        fase(
          R({
            stato: "pronta",
            richiesta: { stato: "non_disponibile", motivo: "errore", timer_s: null },
          }),
        ),
      ],
    );
    c(
      "in caricamento senza richiesta: in arrivo",
      "in_arrivo",
      fase(R({ stato: "in_caricamento" })),
    );
    c(
      "richiesta in attesa o in corso: richiesto",
      ["richiesto", "richiesto", "richiesto"],
      [
        fase(R({ richiesta: { stato: "in_attesa" } })),
        fase(R({ richiesta: { stato: "in_corso" } })),
        fase(R({ stato: "in_caricamento", richiesta: { stato: "in_corso" } })),
      ],
    );
    c(
      "richiesto da più di 90 s: «senza risposta» con Riprova",
      "senza_risposta",
      fase(R({ richiesta: { stato: "in_attesa" } }), { richiestoAlle: 1_000_000 - 91_000 }),
    );
    c(
      "richiesto da 89 s: ancora richiesto",
      "richiesto",
      fase(R({ richiesta: { stato: "in_attesa" } }), { richiestoAlle: 1_000_000 - 89_000 }),
    );
    const nd = (motivo) =>
      U.faseDaRiga(R({ stato: "liberato", richiesta: { stato: "non_disponibile", motivo } }), {
        adesso: 0,
        richiestoAlle: null,
      });
    c(
      "scaduta: «Non più disponibile su WhatsApp: aprilo dal telefono», senza Riprova",
      ["non_disponibile", "Non più disponibile su WhatsApp: aprilo dal telefono", false],
      [nd("scaduta").fase, nd("scaduta").frase, nd("scaduta").riprova],
    );
    c(
      "non catalogato: non recuperabile da qui, senza Riprova",
      [false, true],
      [
        nd("non_catalogato").riprova,
        /non recuperabile da qui: aprilo dal telefono/i.test(nd("non_catalogato").frase),
      ],
    );
    c(
      "tetto: «Spazio pieno: libera qualcosa da Archiviazione», con Riprova",
      ["Spazio pieno: libera qualcosa da Archiviazione", true],
      [nd("tetto").frase, nd("tetto").riprova],
    );
    c(
      "errore: con Riprova; spenta, troppo_grande e tipo: senza",
      [true, false, false, false],
      [nd("errore").riprova, nd("spenta").riprova, nd("troppo_grande").riprova, nd("tipo").riprova],
    );
    c(
      "un motivo sconosciuto: errore con Riprova, frase pulita",
      [true, false],
      [nd("boh").riprova, /boh|undefined/.test(nd("boh").frase)],
    );
    c(
      "le frasi non hanno parole tecniche",
      false,
      /\b(QR|Baileys|token|JID|LID|sessione|server|database|API|socket|log|bucket|blob|HTTP|404|500|Mac)\b/i.test(
        ["scaduta", "non_catalogato", "tetto", "errore", "spenta", "troppo_grande", "tipo", "boh"]
          .map((m) => nd(m).frase)
          .join(" "),
      ),
    );

    /* ═══ Azioni verso il server ═══ */
    gruppo("PONTE · MEDIA · AZIONI VERSO IL SERVER (T8)");
    {
      const visti = [];
      const chiedi = async (p, init) => (visti.push({ p, init }), json({ ok: true }));
      await U.azioneMedia({ azione: "richiedi", chiave: CH, timer: 3600 }, chiedi);
      await U.azioneMedia({ azione: "timer", chiave: CH, timer: "tieni" }, chiedi);
      await U.azioneMedia({ azione: "libera", chiave: CH }, chiedi);
      c(
        "POST a /api/crm/ponte-media-azione, JSON, senza cache",
        ["/api/crm/ponte-media-azione", "POST", "no-store"],
        [visti[0].p, visti[0].init.method, visti[0].init.cache],
      );
      c(
        "corpo: richiedi / timer / libera con la sola chiave singola",
        [
          { azione: "richiedi", chiave: CH, timer: 3600 },
          { azione: "timer", chiave: CH, timer: "tieni" },
          { azione: "libera", chiave: CH },
        ],
        visti.map((x) => JSON.parse(x.init.body)),
      );
      const r = await U.azioneMedia({ azione: "libera", chiave: CH }, async () =>
        json({ ok: false, motivo: "non_trovata" }, 404),
      );
      c("risposta di rifiuto: {ok:false, motivo}", [false, "non_trovata"], [r.ok, r.motivo]);
      const r2 = await U.azioneMedia({ azione: "libera", chiave: CH }, async () =>
        Promise.reject(new TypeError("rete")),
      );
      c("rete caduta: {ok:false}, non lancia", false, r2.ok);
      const r3 = await U.azioneMedia(
        { azione: "richiedi", chiave: "chiave strana", timer: 5 },
        chiedi,
      );
      c("chiave o timer fuori regola: nessuna richiesta", [false, 3], [r3.ok, visti.length]);
    }

    /* ═══ Il click dopo la pressione lunga ═══ */
    gruppo("PONTE · MEDIA · IL CLICK DOPO LA PRESSIONE LUNGA (T8)");
    {
      let t = 10_000;
      const s = U.nuovoSoppressoreClick(() => t);
      c("prima di qualunque pressione lunga: il click passa", false, s.blocca());
      s.inizia();
      s.scatta();
      c("pressione scattata, dito ancora giù: il click non passa", true, s.blocca());
      t += 5000;
      c("…anche dopo molto tempo, finché il dito non è alzato", true, s.blocca());
      s.rilascia();
      t += 399;
      c("rilascio: per 399 ms il click non passa", true, s.blocca());
      t += 2;
      c(
        "…a 401 ms dal rilascio è di nuovo libero (scadenza, non un flag acceso)",
        false,
        s.blocca(),
      );
      // iOS: il click dopo il rilascio spesso non arriva. Il tocco VERO che segue deve passare.
      const s2 = U.nuovoSoppressoreClick(() => t);
      s2.inizia();
      s2.scatta();
      s2.rilascia();
      t += 600; // nessun click è arrivato; l'utente tocca di nuovo
      s2.inizia();
      c("il click che non arriva non inghiotte il tocco successivo", false, s2.blocca());
      const s3 = U.nuovoSoppressoreClick(() => t);
      s3.inizia();
      s3.scatta();
      s3.inizia(); // un nuovo tocco senza rilascio visto (annullato)
      c("un nuovo tocco azzera sempre lo stato", false, s3.blocca());
      const s4 = U.nuovoSoppressoreClick(() => t);
      s4.inizia();
      s4.rilascia();
      c("rilascio senza pressione lunga: il click passa", false, s4.blocca());
    }
    c(
      "`escludiPressione`: i tasti del media (data-media-pl) non sono esclusi, Riprova/Apri sì",
      [true, true, true, true],
      [
        /a,button:not\(\[data-media-pl\]\),audio,video,input,\[role='slider'\]/.test(
          U.ESCLUDI_PRESSIONE ?? "",
        ),
        !/(^|,)button(,|$)/.test(U.ESCLUDI_PRESSIONE ?? ""),
        U.ESCLUDI_PRESSIONE.includes("audio") && U.ESCLUDI_PRESSIONE.includes("video"),
        U.ESCLUDI_PRESSIONE.includes("[role='slider']"),
      ],
    );

    /* ═══ Caricamento pigro ═══ */
    gruppo("PONTE · MEDIA · UN OSSERVATORE PER CONTENITORE, ROOT GIUSTO (T8)");
    {
      const creati = [];
      class IOFinto {
        constructor(cb, opz) {
          this.cb = cb;
          this.opz = opz;
          this.visti = new Set();
          creati.push(this);
        }
        observe(el) {
          this.visti.add(el);
          this.cb([{ target: el, isIntersecting: !!el.__dentro }]); // la prima consegna c'è sempre
        }
        unobserve(el) {
          this.visti.delete(el);
        }
        disconnect() {
          this.visti.clear();
        }
        emetti(el, dentro) {
          el.__dentro = dentro;
          if (this.visti.has(el)) this.cb([{ target: el, isIntersecting: dentro }]);
        }
      }
      globalThis.IntersectionObserver = IOFinto;
      globalThis.getComputedStyle = (el) => ({ overflowY: el.__oy ?? "visible" });
      const pagina = { parentElement: null, __oy: "visible" };
      const scorre = { parentElement: pagina, __oy: "auto" };
      const colonna = { parentElement: scorre, __oy: "visible" };
      const altro = { parentElement: { parentElement: null, __oy: "scroll" }, __oy: "visible" };
      altro.parentElement.__oy = "scroll";
      c(
        "il contenitore è il primo antenato con overflow-y auto/scroll",
        [true, true, true],
        [
          U.contenitoreCheScorre({ parentElement: colonna }) === scorre,
          U.contenitoreCheScorre(altro) === altro.parentElement,
          U.contenitoreCheScorre({ parentElement: pagina }) === null,
        ],
      );
      // 200 messaggi, 40 con media: i media sono dentro `colonna`, dentro `scorre`.
      const bolle = Array.from({ length: 200 }, (_, i) => ({
        parentElement: colonna,
        __i: i,
        __dentro: false,
        __media: i % 5 === 0,
      }));
      const vicine = new Set([188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199]);
      for (const b of bolle) b.__dentro = vicine.has(b.__i); // chat aperta in fondo
      const partite = [];
      const smetti = bolle
        .filter((b) => b.__media)
        .map((b) => U.osservaVisibile(b, () => partite.push(b.__i)));
      c("40 bolle con media nello stesso contenitore: UN solo osservatore", 1, creati.length);
      c(
        "…con `root` = il contenitore che scorre e un margine di 300 px sopra e sotto",
        [true, "300px 0px"],
        [creati[0].opz.root === scorre, creati[0].opz.rootMargin],
      );
      c("…e `osservatoriAttivi` lo conferma", 1, U.osservatoriAttivi());
      await dormi(U.ATTESA_MS + 60);
      c(
        "dopo l'attesa partono solo le bolle vicine alla vista (190, 195)",
        [190, 195],
        partite.slice().sort((a, b) => a - b),
      );
      c(
        "…le altre 38 non hanno chiesto niente",
        38,
        bolle.filter((b) => b.__media).length - partite.length,
      );
      // La chat si apre in alto, poi si posiziona in fondo: le bolle in alto NON devono scattare.
      const alto = bolle.filter((b) => b.__media && b.__i < 20);
      const partiteAlto = [];
      for (const b of alto) b.__dentro = true;
      const smettiAlto = alto.map((b) => U.osservaVisibile(b, () => partiteAlto.push(b.__i)));
      await dormi(40); // primo disegno
      for (const b of alto) creati[0].emetti(b, false); // l'effetto porta la chat in fondo
      await dormi(U.ATTESA_MS + 60);
      c(
        "bolle in alto viste per un attimo e uscite prima della conferma: nessuna richiesta",
        0,
        partiteAlto.length,
      );
      // Una bolla che entra e resta in vista parte; una che passa veloce no.
      const lenta = { parentElement: colonna, __dentro: false };
      const veloce = { parentElement: colonna, __dentro: false };
      const visteLenta = [];
      const visteVeloce = [];
      U.osservaVisibile(lenta, () => visteLenta.push(1));
      U.osservaVisibile(veloce, () => visteVeloce.push(1));
      creati[0].emetti(lenta, true);
      creati[0].emetti(veloce, true);
      await dormi(40);
      creati[0].emetti(veloce, false);
      await dormi(U.ATTESA_MS + 60);
      c(
        "scorrendo: parte quella che resta in vista, non quella che passa",
        [1, 0],
        [visteLenta.length, visteVeloce.length],
      );
      creati[0].emetti(lenta, true);
      await dormi(U.ATTESA_MS + 60);
      c("una volta sola per bolla", 1, visteLenta.length);
      // Un secondo contenitore = un secondo osservatore.
      const altroScorre = { parentElement: null, __oy: "auto" };
      const unaltra = { parentElement: altroScorre };
      const fermaAltra = U.osservaVisibile(unaltra, () => undefined);
      c("un altro contenitore che scorre = un altro osservatore", 2, U.osservatoriAttivi());
      fermaAltra();
      smetti.forEach((f) => f());
      smettiAlto.forEach((f) => f());
      c(
        "quando le bolle spariscono gli osservatori si chiudono (nessuna perdita)",
        1,
        U.osservatoriAttivi(),
      ); // resta `lenta`/`veloce`
      // Senza IntersectionObserver: tutto visibile subito.
      delete globalThis.IntersectionObserver;
      let subito = 0;
      U.osservaVisibile({ parentElement: null }, () => subito++);
      c("senza IntersectionObserver si carica subito (come prima)", 1, subito);
    }

    /* ── Il sorgente ── */
    gruppo("PONTE · MEDIA · IL SORGENTE (T8)");
    const sorgente = (p) => senzaCommenti(readFileSync(join(radice, p), "utf8"));
    const hook = sorgente("src/crm/chatwa/usaMediaPonte.ts");
    const vis = sorgente("src/crm/chatwa/usaVisibile.ts");
    const mp = sorgente("src/crm/chatwa/MediaPonte.tsx");
    const fm = sorgente("src/crm/chatwa/FoglioMedia.tsx");
    const bs = sorgente("src/crm/chatwa/BollaMessaggio.tsx");
    const tutti = hook + vis + mp + fm + bs;
    c(
      "l'indirizzo firmato non entra in uno stato React (nessun setState con `url`)",
      false,
      /set\w+\([^)]*\burl\b/.test(hook + mp),
    );
    c(
      "niente HTML/SVG inline né iframe/object/embed/srcdoc/innerHTML",
      false,
      /dangerouslySetInnerHTML|innerHTML|<iframe|<object|<embed|srcDoc|srcdoc|<svg[\s>]/i.test(
        tutti.replace(/import[^;]*;/g, ""),
      ),
    );
    c(
      "nessun log né emoji nei file nuovi",
      [false, false],
      [/console\./.test(tutti), EMOJI.test((hook + vis + mp + fm).replace(/[📷🎤🎥📎]/gu, ""))],
    );
    c(
      "`ponte_wa_media` e le richieste si leggono col client del browser, mai con una chiave",
      [true, true, false],
      [
        /tabella\("ponte_wa_media"\)/.test(hook),
        /tabella\("ponte_wa_media_richieste"\)/.test(hook),
        /service_role|supabaseAdmin/.test(hook),
      ],
    );
    c(
      "MediaPonte non mette mai un indirizzo firmato in `src` o `href` (il video lo riceve per proprietà)",
      false,
      /(src|href)=\{(url|firmato|indirizzo)\}/.test(mp),
    );
    c(
      "il video riceve l'indirizzo per proprietà (`.src =`), una volta ancora all'errore",
      [true, true],
      [/\.src\s*=\s*\w+/.test(mp), /onError=/.test(mp.slice(mp.indexOf("<video")))],
    );
    c(
      "il documento si apre con window.open nel gesto (prima di ogni await), poi opener = null",
      [true, true, true],
      [
        /window\.open\(\s*""\s*,\s*"_blank"\s*\)/.test(hook),
        /\.opener\s*=\s*null/.test(hook),
        hook.indexOf("window.open") < hook.indexOf('await chiediUrl(id, "apri"'),
      ],
    );
    c(
      "il click dopo la pressione lunga: scadenza, mai un flag che resta acceso",
      [true, true],
      [/nuovoSoppressoreClick/.test(bs), /onClickCapture/.test(bs)],
    );
    c(
      "il foglio sta FUORI dalla bolla (eventi del portale non risalgono alla pressione lunga)",
      true,
      /<FoglioMedia/.test(bs),
    );
    c(
      'l\'osservatore non usa lo scroll (nessun addEventListener("scroll") nei file di vista)',
      false,
      /addEventListener\(\s*["']scroll/.test(vis + mp),
    );
    c(
      "niente `touch-none` sulla foto (la chat non scorrerebbe), solo `manipulation`",
      [false, true],
      [/touch-none/.test(mp), /touch-manipulation/.test(mp)],
    );
  } finally {
    for (const [k, v] of Object.entries(salvati)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
    rmSync(dir, { recursive: true, force: true });
    delete globalThis.__letture;
    delete globalThis.__risposta;
  }
}
