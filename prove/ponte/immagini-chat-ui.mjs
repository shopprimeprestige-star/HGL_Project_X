/** ── PROVE: LA FOTO DEL PONTE NELLA CHAT (compito T7) ──
 *
 *  Commessa 2026-10-30-ponte-storico-completo, piano c.3 punto 4. Il disegno e la
 *  logica della foto: `fotoDelPonte` (quale messaggio), `caricaFoto` (indirizzo
 *  firmato → foto), `leggiRiga` (la riga di `ponte_wa_media`, a gruppi) e la bolla
 *  in ogni stato (pronta, in caricamento, errore, senza riga, in arrivo, vista).
 *  Si disegna con `react-dom/server` e dati finti: nessuna rete, nessun numero né
 *  nome vero (i numeri sono finti, 39333000…).
 *
 *  Il modulo del database è finto (registra le letture); la bolla è quella vera,
 *  impacchettata da esbuild. I tocchi veri e le misure a 375 e 1280 px non stanno
 *  qui: sono nella LAVAGNA (Playwright).
 *
 *  Non registrata in `prove/ponte.mjs`: lo fa T9.
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
/** Un indirizzo firmato finto, con un «gettone» riconoscibile da cercare nel DOM. */
const FIRMATO =
  "https://progetto-finto.supabase.co/storage/v1/object/sign/ponte-media/x/y.jpg?token=GETTONE-SEGRETO-123";

export async function provePonteImmaginiChatUi(_mod, { c, gruppo, radice }) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const richiedi = createRequire(import.meta.url);
  const dir = mkdtempSync(join(tmpdir(), "ponte-immagini-ui-"));
  try {
    /* ── Impacchetto la bolla vera con il database finto ──────────────────── */
    writeFileSync(
      join(dir, "client.js"),
      `export const supabase = {
         from: (t) => ({
           select: (s) => ({
             in: async (k, v) => {
               globalThis.__letture.push({ t, s, k, v });
               const r = globalThis.__risposta;
               if (typeof r === "function") return r(t, v);
               return { data: [], error: null };
             },
           }),
         }),
       };`,
    );
    writeFileSync(
      join(dir, "auth.js"),
      "export const fetchCRM = async () => new Response('{}', { status: 500 });",
    );
    writeFileSync(join(dir, "crm.js"), "export const useCRM = () => ({ consultants: [] });");
    writeFileSync(
      join(dir, "ingresso.tsx"),
      `import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export { React, renderToStaticMarkup };
export { BollaMessaggio, VistaFotoPonte } from ${JSON.stringify(join(radice, "src/crm/chatwa/BollaMessaggio.tsx"))};
export { fotoDelPonte, caricaFoto, leggiRiga, idFoto, FRASE_NON_PIU, FRASE_RIPROVA } from ${JSON.stringify(join(radice, "src/crm/chatwa/usaMediaPonte.ts"))};`,
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
            b.onResolve({ filter: /^@\/crm\/CRMContext$/ }, () => ({ path: join(dir, "crm.js") }));
          },
        },
      ],
    });
    const U = richiedi(join(dir, "ui.cjs"));
    const {
      React,
      renderToStaticMarkup,
      BollaMessaggio,
      VistaFotoPonte,
      fotoDelPonte,
      caricaFoto,
      leggiRiga,
      idFoto,
    } = U;
    const disegna = (el) => renderToStaticMarkup(el);

    /* ═══ Quale messaggio è una foto del ponte ═══ */
    gruppo("PONTE · IMMAGINI · QUALE MESSAGGIO È UNA FOTO (T7)");
    const CH = "bw:393330000001:3EB0A1B2C3D4";
    //  L'identificativo della foto per la rotta GET: il nome casuale del file in Storage (`<uuid>.<ext>`), senza dati del cliente.
    const NOME = "7c1e5f0a-9b2d-4e6f-8a3b-0d1c2e3f4a5b";
    const ID = `${NOME}.jpg`;
    const UTENTE_FINTO = "0b0b0b0b-1111-4222-8333-444444444444";
    const base = { canale: "baileys", wa_message_id: CH, body: "📷 Foto" };
    c(
      "riga del ponte con «📷 Foto»: è una foto, senza didascalia",
      { chiave: CH, didascalia: "" },
      fotoDelPonte(base),
    );
    c(
      "con didascalia: la didascalia è il testo dopo i due punti",
      { chiave: CH, didascalia: "ecco la nuca" },
      fotoDelPonte({ ...base, body: "📷 Foto: ecco la nuca" }),
    );
    c(
      "l'emoji con selettore di variante (📷️) è la stessa",
      true,
      fotoDelPonte({ ...base, body: "📷\uFE0F Foto" }) !== null,
    );
    c(
      "riga di ManyChat (canale diverso): non è del ponte",
      null,
      fotoDelPonte({ ...base, canale: "manychat" }),
    );
    c(
      "canale assente (prima della migrazione): non è del ponte",
      null,
      fotoDelPonte({ ...base, canale: undefined }),
    );
    c(
      "chiave che non è `bw:`: no (mc-in:…, null)",
      [null, null],
      [
        fotoDelPonte({ ...base, wa_message_id: "mc-in:123" }),
        fotoDelPonte({ ...base, wa_message_id: null }),
      ],
    );
    c(
      "chiave con caratteri strani (finirebbe in un indirizzo): no",
      [null, null, null],
      ["bw:393330000001:a b", "bw:393330000001:a&x=1", "bw:abc:ID"].map((w) =>
        fotoDelPonte({ ...base, wa_message_id: w }),
      ),
    );
    c(
      "un testo qualunque con la chiave giusta non è una foto",
      [null, null],
      [fotoDelPonte({ ...base, body: "ciao" }), fotoDelPonte({ ...base, body: "Foto" })],
    );
    c(
      "un testo che CONTIENE «📷 Foto» ma comincia altrimenti non è una foto",
      null,
      fotoDelPonte({ ...base, body: "guarda 📷 Foto" }),
    );

    /* ═══ Chiedere e scaricare la foto ═══ */
    gruppo("PONTE · IMMAGINI · INDIRIZZO FIRMATO E SCARICO (T7)");
    const json = (o, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
    const jpeg = () =>
      new Response(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }), {
        status: 200,
      });
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
          return o.scarica ? o.scarica(u, init) : jpeg();
        },
      };
    };
    const r1 = rete();
    const ok = await caricaFoto(ID, r1);
    c(
      "tutto bene: restituisce la foto (Blob image/jpeg)",
      [true, "image/jpeg"],
      [ok.ok, ok.ok && ok.blob.type],
    );
    c(
      "chiede alla rotta GET con l'identificativo del file, senza cache",
      [`/api/crm/ponte-media?id=${ID}`, "GET", "no-store"],
      [r1.reg.chiesti[0].p, r1.reg.chiesti[0].init.method, r1.reg.chiesti[0].init.cache],
    );
    c(
      "…l'indirizzo non ha il numero del cliente né la chiave del messaggio",
      false,
      /3933300|bw:|bw%3A|chiave/.test(r1.reg.chiesti[0].p),
    );
    c(
      "scarica dall'indirizzo ricevuto, senza cookie né referrer, senza cache",
      [FIRMATO, "omit", "no-referrer", "no-store"],
      [
        r1.reg.scaricati[0].u,
        r1.reg.scaricati[0].init.credentials,
        r1.reg.scaricati[0].init.referrerPolicy,
        r1.reg.scaricati[0].init.cache,
      ],
    );
    c(
      "l'esito non porta l'indirizzo firmato (solo il Blob)",
      false,
      JSON.stringify({ ...ok, blob: undefined }).includes("GETTONE"),
    );
    const nonRiuscita = (e) => [e.ok, e.ok ? null : e.riprova];
    const e404 = await caricaFoto(ID, rete({ chiedi: () => json({ ok: false }, 404) }));
    c(
      "404 (riga assente o di un altro): «non più disponibile», niente Riprova",
      [false, false, true],
      [e404.ok, e404.riprova, e404.frase === U.FRASE_NON_PIU],
    );
    for (const st of [401, 403, 429, 500, 503]) {
      const e = await caricaFoto(ID, rete({ chiedi: () => json({ ok: false }, st) }));
      c(
        `${st} dalla rotta: errore con Riprova, frase pulita`,
        [false, true, U.FRASE_RIPROVA],
        [e.ok, e.riprova, e.frase],
      );
    }
    {
      const e = await caricaFoto(ID, rete({ chiedi: () => json({ ok: false, motivo: "storage" }, 503) }));
      c("503 «storage» (guasto passeggero): errore con Riprova, NON «non più disponibile»", [false, true, U.FRASE_RIPROVA], [e.ok, e.riprova, e.frase]);
    }
    for (const x of [CH, NOME, `${NOME}.svg`, ID.toUpperCase(), `${ID}&x=1`, `${UTENTE_FINTO}/${ID}`, "", "../x"]) {
      const r = rete();
      const e = await caricaFoto(x, r);
      c(`identificativo non valido «${x.slice(0, 14)}»: nessuna richiesta, errore`, [false, 0, 0], [e.ok, r.reg.chiesti.length, r.reg.scaricati.length]);
    }
    c(
      "rete caduta nella richiesta: errore con Riprova (non lancia)",
      [false, true],
      nonRiuscita(
        await caricaFoto(ID, rete({ chiedi: () => Promise.reject(new TypeError("rete")) })),
      ),
    );
    c(
      "rete caduta nello scarico: errore con Riprova",
      [false, true],
      nonRiuscita(
        await caricaFoto(ID, rete({ scarica: () => Promise.reject(new TypeError("rete")) })),
      ),
    );
    c(
      "scarico rifiutato (403 per indirizzo scaduto): errore con Riprova",
      [false, true],
      nonRiuscita(await caricaFoto(ID, rete({ scarica: () => new Response("", { status: 403 }) }))),
    );
    c(
      "risposta senza `url`, o con `url` non testo: errore",
      [
        [false, true],
        [false, true],
      ],
      [
        await caricaFoto(ID, rete({ chiedi: () => json({ ok: true }) })),
        await caricaFoto(ID, rete({ chiedi: () => json({ ok: true, url: 5 }) })),
      ].map(nonRiuscita),
    );
    c(
      "risposta che non è JSON: errore",
      [false, true],
      nonRiuscita(
        await caricaFoto(ID, rete({ chiedi: () => new Response("<html>", { status: 200 }) })),
      ),
    );
    for (const url of [
      "http://progetto-finto.supabase.co/x.jpg",
      "javascript:alert(1)",
      "data:image/jpeg;base64,AAAA",
      "non un indirizzo",
    ]) {
      const r = rete({ chiedi: () => json({ ok: true, url }) });
      const e = await caricaFoto(ID, r);
      c(
        `indirizzo non https «${url.slice(0, 20)}»: errore e nessuno scarico`,
        [false, 0],
        [e.ok, r.reg.scaricati.length],
      );
    }
    for (const tipo of ["image/svg+xml", "text/html", "application/octet-stream", ""]) {
      const e = await caricaFoto(
        ID,
        rete({ scarica: () => new Response(new Blob(["<svg onload=alert(1)>"], { type: tipo })) }),
      );
      c(
        `tipo «${tipo || "vuoto"}» non è una foto del ponte: errore, senza Riprova`,
        [false, false],
        nonRiuscita(e),
      );
    }
    c(
      "file vuoto: errore",
      false,
      (
        await caricaFoto(
          ID,
          rete({ scarica: () => new Response(new Blob([], { type: "image/png" })) }),
        )
      ).ok,
    );
    c(
      "file oltre 9 MiB: errore",
      false,
      (
        await caricaFoto(
          ID,
          rete({
            scarica: () =>
              new Response(new Blob([new Uint8Array(9 * 1024 * 1024 + 1)], { type: "image/webp" })),
          }),
        )
      ).ok,
    );
    c(
      "png e webp sono accettati",
      [true, true],
      [
        (
          await caricaFoto(
            ID,
            rete({ scarica: () => new Response(new Blob(["x"], { type: "image/png" })) }),
          )
        ).ok,
        (
          await caricaFoto(
            ID,
            rete({ scarica: () => new Response(new Blob(["x"], { type: "image/webp" })) }),
          )
        ).ok,
      ],
    );
    const ctrl = new AbortController();
    ctrl.abort();
    c(
      "richiesta annullata (la bolla sparisce): non lancia",
      false,
      (
        await caricaFoto(ID, {
          ...rete({ chiedi: () => Promise.reject(new DOMException("x", "AbortError")) }),
          segnale: ctrl.signal,
        })
      ).ok,
    );

    /* ═══ La riga in ponte_wa_media ═══ */
    gruppo("PONTE · IMMAGINI · LA RIGA, LETTA A GRUPPI (T7)");
    globalThis.__letture = [];
    //  Il percorso in Storage è `<utente>/<uuid>.<ext>`: l'identificativo per la rotta è l'uuid.
    const percorsoDi = () => `${UTENTE_FINTO}/${ID}`;
    globalThis.__risposta = (_t, v) => ({
      data: v
        .filter((x) => x.endsWith(":P"))
        .map((chiave) => ({ chiave, stato: "pronta", path: percorsoDi() }))
        .concat(
          v.filter((x) => x.endsWith(":C")).map((chiave) => ({ chiave, stato: "in_caricamento", path: percorsoDi() })),
        ),
      error: null,
    });
    const k = (id) => `bw:393330000001:${id}`;
    const tre = await Promise.all([leggiRiga(k("P")), leggiRiga(k("C")), leggiRiga(k("N"))]);
    c("pronta / in arrivo / senza riga", ["pronta", "in_arrivo", "nessuna"], tre);
    c(
      "tre bolle nello stesso istante = UNA lettura di `ponte_wa_media` con le tre chiavi",
      [1, "ponte_wa_media", 3],
      [globalThis.__letture.length, globalThis.__letture[0].t, globalThis.__letture[0].v.length],
    );
    c("…la lettura chiede chiave, stato e percorso (per l'identificativo)", "chiave,stato,path", globalThis.__letture[0].s);
    c("l'identificativo della foto pronta è il nome del file (uuid e estensione)", ID, idFoto(k("P")));
    c("…una riga non ancora pronta o senza riga non ha identificativo", [null, null, null], [idFoto(k("C")), idFoto(k("N")), idFoto("bw:393330000001:MAI")]);
    await leggiRiga(k("P"));
    c("una riga pronta resta in memoria: nessuna nuova lettura", 1, globalThis.__letture.length);
    await leggiRiga(k("N"));
    c("«senza riga» vale 30 s: subito dopo, nessuna nuova lettura", 1, globalThis.__letture.length);
    globalThis.__risposta = (_t, v) => ({
      data: v.map((chiave) => ({ chiave, stato: "pronta", path: `${UTENTE_FINTO}/${NOME}.png` })),
      error: null,
    });
    c("`fresco`: rilegge e vede che ora è pronta", "pronta", await leggiRiga(k("N"), true));
    c("…e ha il suo identificativo (anche con un'altra estensione)", `${NOME}.png`, idFoto(k("N")));
    c("…e ora quella lettura è una in più", 2, globalThis.__letture.length);
    const molte = Array.from({ length: 250 }, (_, i) => k(`M${i}`));
    globalThis.__letture = [];
    await Promise.all(molte.map((x) => leggiRiga(x)));
    c(
      "250 foto in chat: tre letture (100 + 100 + 50), mai un indirizzo enorme",
      [3, 100, 100, 50],
      [globalThis.__letture.length, ...globalThis.__letture.map((l) => l.v.length)],
    );
    globalThis.__risposta = () => ({ data: null, error: { message: "permessi" } });
    let rifiutata = false;
    await leggiRiga(k("E")).catch(() => (rifiutata = true));
    c("lettura fallita: la promessa rifiuta (la bolla resta «📷 Foto»)", true, rifiutata);
    globalThis.__risposta = (_t, v) => ({
      data: v.map((chiave) => ({ chiave, stato: "pronta", path: `${UTENTE_FINTO}/${NOME}.webp` })),
      error: null,
    });
    c("…un guasto non si ricorda: la volta dopo rilegge", "pronta", await leggiRiga(k("E")));
    globalThis.__risposta = (_t, v) => ({
      data: v.map((chiave, i) => ({ chiave, stato: "pronta", path: [`${UTENTE_FINTO}/${NOME}.svg`, `${UTENTE_FINTO}/non-un-uuid.jpg`, null, ID][i] })),
      error: null,
    });
    const strane = ["S0", "S1", "S2", "S3"].map(k);
    globalThis.__letture = [];
    await Promise.all(strane.map((x) => leggiRiga(x)));
    c("percorso con estensione non ammessa, senza uuid, nullo o senza cartella: pronta ma senza identificativo (mai usato in un indirizzo)", [null, null, null, null], strane.map(idFoto));

    /* ═══ La bolla, stato per stato ═══ */
    gruppo("PONTE · IMMAGINI · LA BOLLA, STATO PER STATO (T7)");
    const msg = (o = {}) => ({
      id: "m1",
      user_id: "u",
      lead_id: null,
      direction: "inbound",
      from_number: "393330000001",
      to_number: "393330000002",
      body: "📷 Foto",
      status: "received",
      wa_message_id: CH,
      error_message: null,
      created_at: "2026-10-30T11:58:00.000Z",
      delivered_at: null,
      read_at: null,
      canale: "baileys",
      ...o,
    });
    const nulla = () => undefined;
    const vista = (stato, o = {}) =>
      disegna(
        React.createElement(VistaFotoPonte, {
          stato,
          corpo: "📷 Foto",
          didascalia: "",
          inUscita: false,
          mostra: nulla,
          ricontrolla: nulla,
          nonSiApre: nulla,
          ...o,
        }),
      );
    const bolla = (m) => disegna(React.createElement(BollaMessaggio, { messaggio: m, lead: null }));

    const prima = bolla(msg());
    c(
      "appena disegnata (ancora non si sa): resta il testo «📷 Foto», nessun <img>, nessun tasto",
      [true, false, false],
      [testoDi(prima).includes("📷 Foto"), /<img\b/.test(prima), /<button\b/.test(prima)],
    );
    c(
      "…l'ora c'è e sta accanto al testo come prima (posata in basso a destra, non su una riga sua)",
      [true, true],
      [/\d\d:\d\d/.test(testoDi(prima)), /absolute bottom-1 right-2/.test(prima)],
    );
    c(
      "…ed è identica a quella della stessa riga senza ponte (canale manychat), a parte l'id",
      true,
      testoDi(prima) === testoDi(bolla(msg({ canale: "manychat", wa_message_id: "mc-in:q" }))),
    );
    for (const f of ["verifica", "nessuna"])
      c(`senza riga (${f}): è il testo «📷 Foto»`, "📷 Foto", testoDi(vista({ fase: f })));
    c(
      "senza riga: nessun tasto e nessun <img>",
      [false, false],
      [/<button\b/.test(vista({ fase: "nessuna" })), /<img\b/.test(vista({ fase: "nessuna" }))],
    );
    c(
      "senza riga con didascalia: resta il testo intero del cliente",
      "📷 Foto: ecco la nuca",
      testoDi(vista({ fase: "nessuna" }, { corpo: "📷 Foto: ecco la nuca" })),
    );

    const pronta = vista({ fase: "pronta" });
    c(
      "pronta: «Foto · Tocca per vedere», un tasto da 44 px, nessun <img>",
      [true, true, 1, false],
      [
        testoDi(pronta) === "Foto · Tocca per vedere",
        /min-h-11/.test(pronta),
        (pronta.match(/<button\b/g) ?? []).length,
        /<img\b/.test(pronta),
      ],
    );
    c(
      "pronta: il tasto ha l'icona disegnata, senza emoji",
      [true, false],
      [/lucide-image/.test(pronta), EMOJI.test(pronta)],
    );

    const carico = vista({ fase: "carico" });
    c(
      "in caricamento: «Carico la foto…», annunciato (role=status, aria-busy), rotellina, senza tasti",
      [true, true, true, true, false],
      [
        testoDi(carico) === "Carico la foto…",
        /role="status"/.test(carico),
        /aria-busy="true"/.test(carico),
        /animate-spin/.test(carico),
        /<button\b/.test(carico),
      ],
    );
    c(
      "in caricamento: stessa altezza minima del tasto (nessun salto)",
      true,
      /min-h-11/.test(carico),
    );

    const arrivo = vista({ fase: "in_arrivo" });
    c(
      "in arrivo: «Foto in arrivo» e «Ricontrolla» (tasto da 44 px), annunciato",
      [true, true, true],
      [
        testoDi(arrivo) === "Foto in arrivo Ricontrolla",
        /role="status"/.test(arrivo),
        /<button\b[^>]*min-h-11/.test(arrivo),
      ],
    );

    const errore = vista({
      fase: "errore",
      frase: "Non riesco a caricare la foto.",
      riprova: true,
    });
    c(
      "errore: la frase, «Riprova» da 44 px, annunciato, icona",
      [true, true, true, true],
      [
        testoDi(errore) === "Non riesco a caricare la foto. Riprova",
        /<button\b[^>]*min-h-11/.test(errore),
        /role="status"/.test(errore),
        /lucide-circle-alert|lucide-alert-circle/.test(errore),
      ],
    );
    const nonPiu = vista({
      fase: "errore",
      frase: "La foto non è più disponibile.",
      riprova: false,
    });
    c(
      "errore definitivo (404): la frase e basta, nessun tasto",
      ["La foto non è più disponibile.", false],
      [testoDi(nonPiu), /<button\b/.test(nonPiu)],
    );
    c(
      "errore: nessuna parola tecnica per il titolare",
      false,
      /\b(QR|Baileys|token|JID|LID|sessione|server|database|API|socket|log|ponte|bucket|blob|HTTP|404|500)\b/i.test(
        testoDi(errore) + testoDi(nonPiu),
      ),
    );

    const BLOB = "blob:http://localhost/0b1c2d3e-0000-4000-8000-000000000001";
    const mostrata = vista({ fase: "vista", src: BLOB });
    c(
      "vista: un <img> con la `blob:` locale, alt, senza referrer",
      [1, true, true, true],
      [
        (mostrata.match(/<img\b/g) ?? []).length,
        mostrata.includes(`src="${BLOB}"`),
        /alt="Foto inviata dal cliente"/.test(mostrata),
        /referrerpolicy="no-referrer"/i.test(mostrata),
      ],
    );
    c(
      "vista in uscita (mandata dal telefono): alt «Foto inviata»",
      true,
      /alt="Foto inviata"/.test(vista({ fase: "vista", src: BLOB }, { inUscita: true })),
    );
    c(
      "vista: nessun indirizzo firmato né `supabase.co` nel DOM",
      [false, false, false],
      [mostrata.includes("GETTONE"), /supabase\.co/.test(mostrata), /token=/.test(mostrata)],
    );
    c(
      "vista: altezza limitata (max-h-80, 20 rem) e mai più larga della bolla",
      true,
      /max-h-80/.test(mostrata) && /max-w-\[calc\(100%\+0\.75rem\)\]/.test(mostrata),
    );
    const conDida = vista({ fase: "vista", src: BLOB }, { didascalia: "ecco la <b>nuca</b>" });
    c(
      "didascalia del cliente: solo testo (il <b> non diventa un tag)",
      [true, false],
      [conDida.includes("ecco la &lt;b&gt;nuca&lt;/b&gt;"), conDida.includes("<b>")],
    );
    c(
      "nessuna fase è un collegamento (<a>): la foto non ha un indirizzo da aprire",
      false,
      ["pronta", "carico", "in_arrivo"].some((f) => /<a\b/.test(vista({ fase: f }))) ||
        /<a\b/.test(mostrata) ||
        /<a\b/.test(errore),
    );

    /* ── La bolla intera: entrata e uscita, e le altre righe com'erano ── */
    const uscita = bolla(msg({ direction: "outbound", status: "delivered" }));
    c(
      "in uscita (foto mandata dal telefono): stessa bolla verde, ora e spunta, testo «📷 Foto»",
      [true, true, true],
      [
        uscita.includes("bg-[#d9fdd3]"),
        /aria-label="Consegnato"/.test(uscita),
        testoDi(uscita).includes("📷 Foto"),
      ],
    );
    const altra = bolla(msg({ canale: "manychat", wa_message_id: "mc-in:abc" }));
    c(
      "riga di ManyChat con lo stesso testo: la bolla è un normale testo (nessuna foto del ponte)",
      [true, false],
      [testoDi(altra).includes("📷 Foto"), /<button\b/.test(altra)],
    );
    const testo = bolla(msg({ body: "Buongiorno", wa_message_id: "bw:393330000001:ABC" }));
    c(
      "riga del ponte con testo normale: testo normale",
      true,
      testoDi(testo).includes("Buongiorno"),
    );
    const media = bolla(
      msg({
        canale: "manychat",
        wa_message_id: "mc-in:z",
        body: "https://manybot-files.s3.eu-central-1.amazonaws.com/p/wa/2026/10/30/f.jpg",
      }),
    );
    c(
      "la foto di ManyChat (link) è ancora «Foto · Tocca per vedere» col suo tasto",
      true,
      testoDi(media).includes("Foto · Tocca per vedere"),
    );

    /* ═══ Il sorgente ═══ */
    gruppo("PONTE · IMMAGINI · IL SORGENTE (T7)");
    const sorgente = (p) => senzaCommenti(readFileSync(join(radice, p), "utf8"));
    const hook = sorgente("src/crm/chatwa/usaMediaPonte.ts");
    const bs = sorgente("src/crm/chatwa/BollaMessaggio.tsx");
    c(
      "l'indirizzo firmato non entra in uno stato React (nessun setState con `url`)",
      false,
      /set\w+\([^)]*\burl\b/.test(hook),
    );
    c(
      "la foto si mostra da `URL.createObjectURL` e si libera con `revokeObjectURL`",
      [true, true],
      [/URL\.createObjectURL\(/.test(hook), /URL\.revokeObjectURL\(/.test(hook)],
    );
    c(
      "la richiesta si annulla quando la bolla sparisce (AbortController)",
      [true, true],
      [/new AbortController\(\)/.test(hook), /\.abort\(\)/.test(hook)],
    );
    c(
      "la bolla non usa mai un indirizzo firmato in `src` o `href` (solo `stato.src`)",
      [false, true],
      [
        /(src|href)=\{url\}/.test(bs.slice(bs.indexOf("VistaFotoPonte"))),
        /src=\{stato\.src\}/.test(bs),
      ],
    );
    c(
      "il gancio legge la tabella con la sessione dell'utente (client del browser), non una chiave",
      [true, false],
      [/from\("ponte_wa_media"\)/.test(hook), /service_role|supabaseAdmin/.test(hook)],
    );
    c(
      "nessun log, nessun emoji nei due file (a parte il segnaposto del ponte)",
      [false, false],
      [/console\./.test(hook + bs), EMOJI.test(hook.replace(/📷/g, ""))],
    );
    c(
      "l'aggiornamento della riga è solo per i messaggi recenti e si ferma quando è pronta",
      [true, true],
      [/RECENTE_MS/.test(hook), /finita/.test(hook)],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    delete globalThis.__letture;
    delete globalThis.__risposta;
  }
}
