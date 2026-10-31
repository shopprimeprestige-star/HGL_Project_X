/** ── PROVE: I MEDIA DEL PONTE · REGOLE DEL SERVER (media-tipi.ts, media.ts) ──
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T2 (PIANO a.4, b.2, D2,
 *  D13, condizione 1 del revisore). Le quattro categorie (foto, audio, video,
 *  documento) con `gestisciMedia` e `gestisciLettura` e porte finte: il
 *  database non c'è, si guarda che cosa la logica chiede e risponde.
 *  Le prove delle sole foto (30/10) restano in `immagini-regole.mjs`; la rotta
 *  vera, in `immagini-rotta.mjs`. L'SQL lo prova T1 (`prove/sql/…`).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs` (`ponte/media`,
 *  `ponte/media-tipi`). `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const UTENTE = "0b0b0b0b-1111-4222-8333-444444444444";
const ALTRO = "99999999-1111-4222-8333-444444444444";
const NUMERO = "393331234567";
const CHIAVE = `bw:${NUMERO}:3EB0A1`;
const UUID = "7c1e5f0a-9b2d-4e6f-8a3b-0d1c2e3f4a5b";
const MIB = 1024 * 1024;

const MIME = {
  foto: ["image/jpeg", "image/png", "image/webp"],
  audio: ["audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/amr"],
  video: ["video/mp4", "video/3gpp", "video/quicktime", "video/webm"],
  documento: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
};
const LIMITI = { foto: 8 * MIB, audio: 16 * MIB, video: 45 * MIB, documento: 25 * MIB };
const DOCX = MIME.documento[1];

const ACCESO = (auto) => JSON.stringify({ acceso: true, tettoGB: 5, ...(auto ? { auto } : {}) });

/** Le porte finte: registrano le chiamate e restituiscono quello che dice `o`. */
function porteFinte(o = {}) {
  const chiamate = [];
  const avvisi = [];
  const lancia = (chi) => {
    if (o.rompi === chi)
      throw { code: o.codice ?? "XX000", message: `errore con ${NUMERO} e Anna Finta dentro` };
  };
  return {
    chiamate,
    avvisi,
    async utente() {
      chiamate.push(["utente"]);
      lancia("utente");
      return o.utente === undefined ? UTENTE : o.utente;
    },
    async interruttore() {
      chiamate.push(["interruttore"]);
      lancia("interruttore");
      return o.interruttore === undefined
        ? ACCESO(["foto", "audio", "video", "documento"])
        : o.interruttore;
    },
    async richiestaInCorso(u, chiave) {
      chiamate.push(["richiestaInCorso", u, chiave]);
      lancia("richiestaInCorso");
      return o.richiesta ?? false;
    },
    async permesso(u, p) {
      chiamate.push(["permesso", u, { ...p }]);
      lancia("permesso");
      return "permesso" in o
        ? o.permesso
        : { esito: "carica", path: `${UTENTE}/${UUID}.${o.ext ?? "jpg"}` };
    },
    async dettagli(u, chiave, d) {
      chiamate.push(["dettagli", u, chiave, { ...d }]);
      lancia("dettagli");
    },
    async firmaCarico(path) {
      chiamate.push(["firmaCarico", path]);
      lancia("firmaCarico");
      return `https://x.supabase.co/storage/v1/object/upload/sign/ponte-media/${path}?token=t`;
    },
    async fatto(u, chiave) {
      chiamate.push(["fatto", u, chiave]);
      lancia("fatto");
      return o.fatto ?? { ok: true, stato: "pronta" };
    },
    async rimuovi(path) {
      chiamate.push(["rimuovi", path]);
      lancia("rimuovi");
    },
    async percorsoPronto(u, id) {
      chiamate.push(["percorsoPronto", u, id]);
      lancia("percorsoPronto");
      return o.riga === undefined
        ? { path: `${UTENTE}/${id}`, categoria: "foto", mime: "image/jpeg", nome: null }
        : o.riga;
    },
    async firmaLettura(path, secondi, opzioni) {
      chiamate.push(["firmaLettura", path, secondi, opzioni?.download]);
      lancia("firmaLettura");
      return `https://x.supabase.co/storage/v1/object/sign/ponte-media/${path}?token=l`;
    },
    avviso(codice, conteggi) {
      avvisi.push([codice, conteggi]);
    },
  };
}

const permessoDi = (o = {}) => ({
  v: 1,
  tipo: "media_permesso",
  chiave: CHIAVE,
  mime: "image/jpeg",
  byte: 1234,
  ...o,
});
const fattoDi = () => ({ v: 1, tipo: "media_fatto", chiave: CHIAVE });
const leggi = async (r) => ({ stato: r.status, json: await r.json() });
const logPulito = (avvisi) =>
  avvisi.every(
    ([k, n]) =>
      /^[a-z_]+$/.test(k) &&
      (n === undefined ||
        Object.entries(n).every(([ch, v]) => /^[a-z_]+$/.test(ch) && typeof v === "number")),
  ) && !/3933|3EB0|Anna|supabase|token|\.jpg|\.pdf|bw:|7c1e5f0a/.test(JSON.stringify(avvisi));

export async function proveMediaRegole(mod, { c, gruppo, radice }) {
  const T = mod["ponte/media-tipi"];
  const M = mod["ponte/media"];
  const sorgente = (f) => readFileSync(join(radice, f), "utf8");
  const senzaCommenti = (x) =>
    x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  /* ═══ 1. LA TABELLA DELLE CATEGORIE (a.1) ═══════════════════════════════ */
  gruppo("MEDIA · LA TABELLA DELLE QUATTRO CATEGORIE (T2)");
  c("le categorie, in ordine", ["foto", "audio", "video", "documento"], [...T.CATEGORIE_MEDIA]);
  c(
    "i limiti: foto 8, audio 16, documento 25, video 45 MiB (47.185.920 B: sotto i 50 MB decimali di Storage)",
    [LIMITI, 47185920],
    [T.LIMITI_MEDIA, T.LIMITI_MEDIA.video],
  );
  c(
    "i mime canonici per categoria (identici a PIANO a.1)",
    MIME,
    Object.fromEntries(Object.entries(T.MIME_PER_CATEGORIA).map(([k, v]) => [k, [...v]])),
  );
  c(
    "ogni mime sta in una sola categoria",
    true,
    new Set(Object.values(MIME).flat()).size === Object.values(MIME).flat().length,
  );
  c(
    "categoriaDi: ogni mime canonico torna alla sua categoria",
    [],
    Object.entries(MIME).flatMap(([cat, ms]) => ms.filter((m) => T.categoriaDi(m) !== cat)),
  );
  c(
    "categoriaDi: fuori elenco = null (OLE, txt, csv, zip, html, svg, gif, parametri, maiuscole, vuoto, non testo)",
    Array(14).fill(null),
    [
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "text/plain",
      "text/csv",
      "application/zip",
      "text/html",
      "image/svg+xml",
      "image/gif",
      "audio/ogg; codecs=opus",
      "IMAGE/JPEG",
      "",
      null,
      5,
    ].map(T.categoriaDi),
  );
  //  Condizione 1 del revisore: un `documentMessage` con mime immagine è un segnaposto, mai una foto «come documento».
  c(
    "un mime immagine non è mai «documento»: la categoria dei documenti non ne contiene",
    [],
    MIME.documento.filter((m) => m.startsWith("image/")),
  );
  c(
    "…e l'elenco dei documenti ammessi è PDF, docx, xlsx, pptx e basta",
    4,
    T.MIME_PER_CATEGORIA.documento.length,
  );
  c("MEDIA_MIME: tutti i mime canonici, 16", 16, T.MEDIA_MIME.length);
  c(
    "estensione del file per ogni mime: due-cinque lettere o cifre minuscole, e ogni mime ne ha una",
    [],
    Object.values(MIME)
      .flat()
      .filter((m) => !/^[a-z0-9]{2,5}$/.test(T.ESTENSIONE_PER_MIME[m] ?? "")),
  );
  c(
    "i motivi di rifiuto, lista chiusa (+ liberato, manuale)",
    ["spenta", "tetto", "troppo_grande", "tipo", "liberato", "manuale"],
    [...T.MOTIVI_RIFIUTO_MEDIA],
  );
  c("il tetto di serie sale a 5 GB", 5, T.TETTO_GB_DI_SERIE);
  c(
    "lo stato «liberato» e i due usi di lettura sono nei contratti",
    [["vedi", "video", "apri"], 1800, 300],
    [[...T.USI_LETTURA], T.FIRMA_VIDEO_S, T.FIRMA_LETTURA_S],
  );
  c(
    "ID_MEDIA: estensione qualunque [a-z0-9]{2,5}",
    [true, true, true, true, true, true],
    ["pdf", "docx", "ogg", "m4a", "3gp", "x1"].map((e) => T.ID_MEDIA.test(`${UUID}.${e}`)),
  );
  c(
    "ID_MEDIA: senza estensione, di una lettera, di sei, maiuscola o con un punto in più: no",
    [false, false, false, false, false],
    [UUID, `${UUID}.d`, `${UUID}.docxyz`, `${UUID}.PDF`, `${UUID}.p.f`].map((k) =>
      T.ID_MEDIA.test(k),
    ),
  );
  c(
    "ID_MEDIA: niente cartelle, chiave, maiuscole, a capo",
    [false, false, false, false],
    [`${UTENTE}/${UUID}.pdf`, CHIAVE, `${UUID.toUpperCase()}.pdf`, `${UUID}.pdf\n`].map((k) =>
      T.ID_MEDIA.test(k),
    ),
  );
  c(
    "PERCORSO_MEDIA: <uuid>/<uuid>.<ext> e nient'altro",
    [true, true, false, false, false, false, false],
    [
      `${UTENTE}/${UUID}.pdf`,
      `${UTENTE}/${UUID}.m4a`,
      `${UTENTE}/${UUID}`,
      `${UTENTE}/../${UUID}.pdf`,
      `${UTENTE}/${UUID}.pdf/x`,
      `x/${UUID}.pdf`,
      `${NUMERO}/${UUID}.pdf`,
    ].map((p) => T.PERCORSO_MEDIA.test(p)),
  );

  /* ═══ 2. L'INTERRUTTORE E LE CATEGORIE AUTOMATICHE (D7) ═════════════════ */
  gruppo("MEDIA · INTERRUTTORE: LE CATEGORIE AUTOMATICHE (T2)");
  c(
    "senza `auto` valgono solo le foto",
    ["foto"],
    M.leggiInterruttore('{"acceso":true,"tettoGB":5}').auto,
  );
  c(
    "`auto` con tutte e quattro",
    ["foto", "audio", "video", "documento"],
    M.leggiInterruttore('{"acceso":true,"tettoGB":5,"auto":["foto","audio","video","documento"]}')
      .auto,
  );
  c(
    "`auto` vuoto = nessuna categoria automatica (scelta esplicita)",
    [],
    M.leggiInterruttore('{"acceso":true,"auto":[]}').auto,
  );
  c(
    "`auto` con voci sconosciute, doppie o non testo: restano le buone, una volta",
    ["audio"],
    M.leggiInterruttore('{"acceso":true,"auto":["audio","gif",5,null,"audio"]}').auto,
  );
  c(
    "`auto` che non è una lista: come se mancasse (solo foto)",
    [["foto"], ["foto"], ["foto"]],
    [
      '{"acceso":true,"auto":"video"}',
      '{"acceso":true,"auto":{"video":1}}',
      '{"acceso":true,"auto":null}',
    ].map((x) => M.leggiInterruttore(x).auto),
  );
  c(
    "spento: acceso false (con l'auto di serie)",
    [false, ["foto"]],
    (({ acceso, auto }) => [acceso, auto])(
      M.leggiInterruttore('{"acceso":false,"auto":["video"]}'),
    ),
  );
  c("senza tetto scritto vale 5 GB", 5, M.leggiInterruttore('{"acceso":true}').tettoGB);

  /* ═══ 3. media_permesso PER CATEGORIA ═══════════════════════════════════ */
  gruppo("MEDIA · media_permesso · COERENZA mime ↔ categoria ↔ limite (T2)");
  {
    for (const [cat, mimes] of Object.entries(MIME)) {
      for (const mime of mimes) {
        const p = porteFinte({ ext: T.ESTENSIONE_PER_MIME[mime] });
        const x = await leggi(
          await M.gestisciMedia(p, UTENTE, permessoDi({ mime, byte: LIMITI[cat] })),
        );
        c(`${cat} ${mime}: al limite esatto passa`, [200, "carica"], [x.stato, x.json.esito]);
        const q = porteFinte();
        const y = await leggi(
          await M.gestisciMedia(q, UTENTE, permessoDi({ mime, byte: LIMITI[cat] + 1 })),
        );
        c(
          `…a +1 byte: troppo_grande, senza SQL`,
          [{ ok: true, esito: "rifiutato", motivo: "troppo_grande" }, 0],
          [y.json, q.chiamate.filter((k) => k[0] === "permesso").length],
        );
      }
    }
    //  Il limite è quello della categoria, non il più largo: 20 MiB vanno bene per un video e non per una foto o un audio.
    for (const [mime, esito] of [
      ["video/mp4", "carica"],
      ["application/pdf", "carica"],
      ["audio/ogg", "rifiutato"],
      ["image/png", "rifiutato"],
    ]) {
      const x = await leggi(
        await M.gestisciMedia(porteFinte(), UTENTE, permessoDi({ mime, byte: 20 * MIB })),
      );
      c(`20 MiB di ${mime}: ${esito}`, esito, x.json.esito);
    }
    //  Mime fuori elenco: tipo, mai il database.
    for (const mime of [
      "application/msword",
      "application/vnd.ms-excel",
      "text/plain",
      "text/csv",
      "application/zip",
      "text/html",
      "image/svg+xml",
      "image/gif",
      "audio/ogg; codecs=opus",
      "video/x-msvideo",
      "application/octet-stream",
      "",
    ]) {
      const p = porteFinte();
      const x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi({ mime })));
      c(
        `mime «${mime}»: tipo, niente SQL`,
        [{ ok: true, esito: "rifiutato", motivo: "tipo" }, 0],
        [x.json, p.chiamate.filter((k) => k[0] === "permesso").length],
      );
    }
    //  Il percorso del database: l'estensione è libera ([a-z0-9]{2,5}), il resto no.
    for (const ext of ["pdf", "docx", "m4a", "3gp", "ogg", "webm"]) {
      const x = await leggi(
        await M.gestisciMedia(porteFinte({ ext }), UTENTE, permessoDi({ mime: "video/mp4" })),
      );
      c(`percorso del database con estensione «${ext}»: carica`, "carica", x.json.esito);
    }
    for (const path of [
      `${UTENTE}/${UUID}.toolong`,
      `${UTENTE}/${UUID}.x`,
      `${UTENTE}/${UUID}.JPG`,
      `${UTENTE}/../x.pdf`,
      `${NUMERO}/${UUID}.pdf`,
      `${UTENTE}/${NUMERO}.pdf`,
    ]) {
      const p = porteFinte({ permesso: { esito: "carica", path } });
      const x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()));
      c(
        `percorso storto (${path.replace(UTENTE, "u").replace(UUID, "id")}): 500 database, nessuna firma`,
        [500, 0],
        [x.stato, p.chiamate.filter((k) => k[0] === "firmaCarico").length],
      );
    }
    //  I motivi che arrivano dal database.
    for (const motivo of ["tetto", "troppo_grande", "tipo", "liberato", "manuale"]) {
      const p = porteFinte({ permesso: { esito: "rifiutato", motivo } });
      const x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()));
      c(
        `la funzione rifiuta («${motivo}»): lo stesso rifiuto al Mac`,
        { ok: true, esito: "rifiutato", motivo },
        x.json,
      );
    }
    const p = porteFinte({ permesso: { esito: "rifiutato", motivo: "boh" } });
    c(
      "motivo inventato dal database: 500",
      500,
      (await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()))).stato,
    );
    //  La spedizione al database porta i dati di sempre.
    const q = porteFinte();
    await M.gestisciMedia(q, UTENTE, permessoDi({ mime: "video/webm", byte: 777 }));
    c(
      "la funzione SQL riceve utente, chiave, numero, mime, byte e il tetto (5 GB = 5.000.000.000 byte)",
      [
        UTENTE,
        { chiave: CHIAVE, numero: NUMERO, mime: "video/webm", byte: 777, tettoByte: 5_000_000_000 },
      ],
      [
        q.chiamate.find((k) => k[0] === "permesso")?.[1],
        q.chiamate.find((k) => k[0] === "permesso")?.[2],
      ],
    );
  }

  /* ═══ 4. `auto` E `richiesto` ═══════════════════════════════════════════ */
  gruppo("MEDIA · categorie automatiche e lavori «richiesto» (T2)");
  {
    // `auto` assente = solo foto.
    const solo = { interruttore: ACCESO(undefined) };
    for (const [mime, esito, motivo] of [
      ["image/jpeg", "carica"],
      ["audio/ogg", "rifiutato", "manuale"],
      ["video/mp4", "rifiutato", "manuale"],
      ["application/pdf", "rifiutato", "manuale"],
    ]) {
      const p = porteFinte(solo);
      const x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi({ mime })));
      c(
        `senza «auto»: ${mime} → ${esito}${motivo ? ` «${motivo}»` : ""}`,
        [esito, motivo ?? undefined, motivo ? 0 : 1],
        [x.json.esito, x.json.motivo, p.chiamate.filter((k) => k[0] === "permesso").length],
      );
    }
    //  Una categoria non automatica non tocca il database né il resto.
    let p = porteFinte({ interruttore: ACCESO(["foto", "audio"]) });
    let x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi({ mime: "video/mp4" })));
    c(
      "video fuori da «auto»: manuale, senza SQL né firma",
      [{ ok: true, esito: "rifiutato", motivo: "manuale" }, []],
      [x.json, p.chiamate.filter((k) => ["permesso", "firmaCarico", "dettagli"].includes(k[0]))],
    );
    x = await leggi(
      await M.gestisciMedia(
        porteFinte({ interruttore: ACCESO(["foto", "audio"]) }),
        UTENTE,
        permessoDi({ mime: "audio/mpeg" }),
      ),
    );
    c("audio dentro «auto»: carica", "carica", x.json.esito);

    // `richiesto`: vale solo se c'è una richiesta in_corso per quella chiave.
    p = porteFinte({ interruttore: ACCESO(undefined), richiesta: true });
    x = await leggi(
      await M.gestisciMedia(p, UTENTE, permessoDi({ mime: "video/mp4", richiesto: true })),
    );
    c(
      "richiesto con richiesta in_corso: il video passa anche se «auto» non lo prevede",
      "carica",
      x.json.esito,
    );
    c(
      "…la richiesta si cerca per l'utente del server e per la chiave del corpo",
      [["richiestaInCorso", UTENTE, CHIAVE]],
      p.chiamate.filter((k) => k[0] === "richiestaInCorso"),
    );
    p = porteFinte({ interruttore: ACCESO(undefined), richiesta: false });
    x = await leggi(
      await M.gestisciMedia(p, UTENTE, permessoDi({ mime: "video/mp4", richiesto: true })),
    );
    c(
      "richiesto SENZA richiesta in_corso: ignorato, vale `auto` (manuale), nessun SQL di permesso",
      [{ ok: true, esito: "rifiutato", motivo: "manuale" }, 0],
      [x.json, p.chiamate.filter((k) => k[0] === "permesso").length],
    );
    p = porteFinte({ interruttore: ACCESO(undefined), richiesta: false });
    x = await leggi(
      await M.gestisciMedia(p, UTENTE, permessoDi({ mime: "image/png", richiesto: true })),
    );
    c(
      "richiesto senza richiesta, ma per una foto: passa come ogni foto automatica",
      "carica",
      x.json.esito,
    );
    for (const richiesto of [false, undefined, "true", 1, null]) {
      p = porteFinte({ richiesta: true });
      await M.gestisciMedia(p, UTENTE, permessoDi({ richiesto }));
      c(
        `richiesto = ${JSON.stringify(richiesto)}: la tabella delle richieste non si legge (solo un true vero)`,
        0,
        p.chiamate.filter((k) => k[0] === "richiestaInCorso").length,
      );
    }
    //  Anche un lavoro richiesto subisce interruttore e limiti.
    p = porteFinte({ interruttore: '{"acceso":false}', richiesta: true });
    x = await leggi(
      await M.gestisciMedia(p, UTENTE, permessoDi({ mime: "video/mp4", richiesto: true })),
    );
    c(
      "richiesto con interruttore spento: «spenta», la richiesta non si legge",
      [{ ok: true, esito: "rifiutato", motivo: "spenta" }, 0],
      [x.json, p.chiamate.filter((k) => k[0] === "richiestaInCorso").length],
    );
    p = porteFinte({ interruttore: ACCESO(undefined), richiesta: true });
    x = await leggi(
      await M.gestisciMedia(
        p,
        UTENTE,
        permessoDi({ mime: "video/mp4", byte: LIMITI.video + 1, richiesto: true }),
      ),
    );
    c("richiesto sopra il limite: troppo_grande", "troppo_grande", x.json.motivo);
    p = porteFinte({ interruttore: ACCESO(undefined), richiesta: true });
    x = await leggi(
      await M.gestisciMedia(p, UTENTE, permessoDi({ mime: "application/msword", richiesto: true })),
    );
    c("richiesto con mime fuori elenco: tipo", "tipo", x.json.motivo);
    for (const [rompi, codice, stato] of [
      ["richiestaInCorso", "08006", 500],
      ["richiestaInCorso", "42P01", 503],
    ]) {
      p = porteFinte({ interruttore: ACCESO(undefined), rompi, codice });
      x = await leggi(
        await M.gestisciMedia(p, UTENTE, permessoDi({ mime: "video/mp4", richiesto: true })),
      );
      c(`lettura della richiesta in errore (${codice}): ${stato}`, stato, x.stato);
    }
    //  `leggiPermesso`: il flag e i dettagli si riconoscono, il resto no.
    c(
      "leggiPermesso: `richiesto: true` letto; assente, false o storto = non c'è",
      [true, undefined, undefined, undefined],
      [
        permessoDi({ richiesto: true }),
        permessoDi(),
        permessoDi({ richiesto: false }),
        permessoDi({ richiesto: "si" }),
      ].map((j) => M.leggiPermesso(j)?.richiesto),
    );
  }

  /* ═══ 5. I DETTAGLI (nome, durata, dimensioni, miniatura) ═══════════════ */
  gruppo("MEDIA · dettagli: solo su «carica», valori fuori misura = NULL (T2)");
  {
    const MINI = "/9j/4AAQSkZJRgABAQ" + "A".repeat(40) + "==";
    let p = porteFinte();
    let x = await leggi(
      await M.gestisciMedia(
        p,
        UTENTE,
        permessoDi({
          mime: "video/mp4",
          nome: "Gita al mare.mp4",
          durata_s: 93,
          larghezza: 1280,
          altezza: 720,
          miniatura: MINI,
        }),
      ),
    );
    const d = p.chiamate.find((k) => k[0] === "dettagli");
    c(
      "su carica, i dettagli vanno alla porta (utente del server, chiave)",
      [
        UTENTE,
        CHIAVE,
        { nome: "Gita al mare.mp4", durata_s: 93, larghezza: 1280, altezza: 720, miniatura: MINI },
      ],
      [d?.[1], d?.[2], d?.[3]],
    );
    c(
      "…prima della firma di carico",
      ["dettagli", "firmaCarico"],
      p.chiamate.map((k) => k[0]).filter((n) => n === "dettagli" || n === "firmaCarico"),
    );
    c(
      "…la risposta al Mac non li ripete",
      ["esito", "ok", "url_carico"],
      Object.keys(x.json).sort(),
    );
    //  Solo su carica.
    for (const permesso of [
      { esito: "gia_presente" },
      { esito: "rifiutato", motivo: "tetto" },
      { esito: "rifiutato", motivo: "liberato" },
    ]) {
      p = porteFinte({ permesso });
      await M.gestisciMedia(p, UTENTE, permessoDi({ nome: "x.pdf", miniatura: MINI }));
      c(
        `dettagli non scritti con esito «${permesso.esito}${permesso.motivo ? `/${permesso.motivo}` : ""}»`,
        0,
        p.chiamate.filter((k) => k[0] === "dettagli").length,
      );
    }
    p = porteFinte({ interruttore: ACCESO(["foto"]) });
    await M.gestisciMedia(p, UTENTE, permessoDi({ mime: "video/mp4", nome: "x.mp4" }));
    c(
      "dettagli non scritti per una categoria non automatica",
      0,
      p.chiamate.filter((k) => k[0] === "dettagli").length,
    );
    //  Senza dettagli non si chiama.
    p = porteFinte();
    await M.gestisciMedia(p, UTENTE, permessoDi());
    c(
      "nessun dettaglio nel corpo: la porta non si chiama",
      0,
      p.chiamate.filter((k) => k[0] === "dettagli").length,
    );
    //  Fuori misura = null, mai errore.
    p = porteFinte();
    x = await leggi(
      await M.gestisciMedia(
        p,
        UTENTE,
        permessoDi({
          durata_s: -4,
          larghezza: 0,
          altezza: 1e9,
          miniatura: "<script>alert(1)</script>",
          nome: "ok.jpg",
        }),
      ),
    );
    c(
      "durata negativa, larghezza 0, altezza enorme, miniatura non base64: NULL; il nome buono resta; nessun errore",
      [200, { nome: "ok.jpg", durata_s: null, larghezza: null, altezza: null, miniatura: null }],
      [x.stato, p.chiamate.find((k) => k[0] === "dettagli")?.[3]],
    );
    for (const miniatura of [
      "aGVsbG8=",
      "/9j/" + "A".repeat(12000),
      "/9j/AAAA\n",
      "/9j/AA AA",
      5,
      {},
    ]) {
      p = porteFinte();
      await M.gestisciMedia(p, UTENTE, permessoDi({ miniatura, nome: "n.jpg" }));
      c(
        `miniatura non ammessa (${String(typeof miniatura === "string" ? miniatura.slice(0, 10) : typeof miniatura)}): NULL`,
        null,
        p.chiamate.find((k) => k[0] === "dettagli")?.[3].miniatura,
      );
    }
    p = porteFinte();
    await M.gestisciMedia(p, UTENTE, permessoDi({ miniatura: "/9j/" + "A".repeat(11990) }));
    c(
      "miniatura di 11.994 caratteri (sotto 12.000): ammessa",
      true,
      typeof p.chiamate.find((k) => k[0] === "dettagli")?.[3].miniatura === "string",
    );
    for (const [nome, atteso] of [
      ["a‮b⁦c.pdf", "abc.pdf"],
      ["../../etc/passwd", "....etcpasswd"],
      ["a\\b/c.docx", "abc.docx"],
      ["tab\tnuova\nriga.pdf", "tabnuovariga.pdf"],
      ["   ", null],
      ["", null],
      ["x".repeat(300), "x".repeat(120)],
    ]) {
      p = porteFinte();
      await M.gestisciMedia(p, UTENTE, permessoDi({ nome, durata_s: 5 }));
      c(
        `nome ripulito: ${JSON.stringify(nome.slice(0, 18))} → ${JSON.stringify(atteso?.slice(0, 18) ?? null)}`,
        atteso,
        p.chiamate.find((k) => k[0] === "dettagli")?.[3].nome,
      );
    }
    //  Il database dice no ai dettagli.
    p = porteFinte({ rompi: "dettagli", codice: "08006" });
    x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi({ nome: "a.jpg" })));
    c(
      "la porta dei dettagli in errore: 500 database (il Mac ritenta), nessuna firma",
      [500, 0],
      [x.stato, p.chiamate.filter((k) => k[0] === "firmaCarico").length],
    );
    c("…il log dice solo il codice", true, logPulito(p.avvisi));
    c(
      "log di un giro completo: solo codici e contatori",
      true,
      logPulito(
        await (async () => {
          const q = porteFinte();
          await M.gestisciMedia(q, UTENTE, permessoDi({ nome: "Anna.jpg", miniatura: MINI }));
          return q.avvisi;
        })(),
      ),
    );
  }

  /* ═══ 6. media_fatto: tipo e troppo_grande → rimozione ═════════════════ */
  gruppo("MEDIA · media_fatto: l'oggetto di un tipo o di un peso sbagliato si rimuove (T2)");
  {
    const PATH = `${UTENTE}/${UUID}.pdf`;
    for (const stato of ["tipo", "troppo_grande"]) {
      const p = porteFinte({ fatto: { ok: true, stato, path: PATH } });
      const x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
      c(
        `la funzione dice «${stato}»: il Mac riceve lo stesso esito`,
        [200, { ok: true, esito: stato }],
        [x.stato, x.json],
      );
      c(
        "…e l'oggetto si rimuove, una volta, col percorso del database",
        [["rimuovi", PATH]],
        p.chiamate.filter((k) => k[0] === "rimuovi"),
      );
      c("…il log dice solo il codice", true, logPulito(p.avvisi));
    }
    for (const stato of ["pronta", "in_caricamento", "assente"]) {
      const p = porteFinte({
        fatto: { ok: stato !== "assente", stato, path: PATH, byte: 5, mime: "application/pdf" },
      });
      const x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
      c(
        `«${stato}»: nessuna rimozione, esito invariato`,
        [{ ok: true, esito: stato }, 0],
        [x.json, p.chiamate.filter((k) => k[0] === "rimuovi").length],
      );
    }
    //  Il percorso viene dal database ma si ricontrolla: mai un altro utente, mai fuori forma.
    for (const path of [
      `${ALTRO}/${UUID}.pdf`,
      `${UTENTE}/../${UUID}.pdf`,
      `${UTENTE}/${UUID}`,
      `${UTENTE}/${UUID}.pdf/x`,
      `${NUMERO}/${UUID}.pdf`,
      "",
      null,
      undefined,
      5,
      `${UTENTE}/${UUID}.PDF`,
    ]) {
      const p = porteFinte({ fatto: { ok: true, stato: "tipo", path } });
      const x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
      c(
        `percorso da rimuovere non valido (${String(path).replace(UTENTE, "u").replace(ALTRO, "altro").replace(UUID, "id").slice(0, 24)}): non si rimuove, l'esito arriva lo stesso`,
        [200, "tipo", 0],
        [x.stato, x.json.esito, p.chiamate.filter((k) => k[0] === "rimuovi").length],
      );
    }
    //  Rimozione fallita: l'esito è definitivo comunque (lo sweep degli orfani pulirà).
    let p = porteFinte({
      fatto: { ok: true, stato: "tipo", path: PATH },
      rompi: "rimuovi",
      codice: "storage",
    });
    let x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
    c(
      "Storage non rimuove: l'esito «tipo» arriva lo stesso (200)",
      [200, "tipo"],
      [x.stato, x.json.esito],
    );
    c(
      "…e il log lo dice con un codice fisso, senza percorso",
      true,
      logPulito(p.avvisi) && p.avvisi.some(([k]) => k === "media_storage"),
    );
    p = porteFinte({ fatto: { ok: true, stato: "boh" } });
    x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
    c("stato sconosciuto: 500 database", 500, x.stato);
  }

  /* ═══ 7. LA LETTURA: `uso` CONTRO LA CATEGORIA ═════════════════════════ */
  gruppo("MEDIA · gestisciLettura: uso contro categoria, download solo non-PDF (T2)");
  {
    const ID = (ext) => `${UUID}.${ext}`;
    const riga = (categoria, mime, nome = null) => ({
      path: `${UTENTE}/${ID("bin")}`,
      categoria,
      mime,
      nome,
    });
    const chiedi = (p, o = {}) =>
      M.gestisciLettura(p, { adminUserId: UTENTE, id: ID("jpg"), ...o });
    // Compatibilità con l'interfaccia di oggi: nessun `uso` = vedi.
    let p = porteFinte();
    let x = await chiedi(p);
    c(
      "senza `uso` (la chiamata di oggi): vale «vedi», foto, 300 s, nessun download",
      [200, 300, undefined],
      [
        x.stato,
        p.chiamate.find((k) => k[0] === "firmaLettura")?.[2],
        p.chiamate.find((k) => k[0] === "firmaLettura")?.[3],
      ],
    );
    c("…la risposta è ok e url, nient'altro", ["ok", "url"], Object.keys(x.corpo).sort());
    // La matrice uso × categoria.
    const casi = [
      ["foto", "image/png", "vedi", 200],
      ["foto", "image/png", "video", 400],
      ["foto", "image/png", "apri", 400],
      ["audio", "audio/ogg", "vedi", 200],
      ["audio", "audio/ogg", "apri", 200],
      ["audio", "audio/ogg", "video", 400],
      ["video", "video/mp4", "video", 200],
      ["video", "video/mp4", "vedi", 400],
      ["video", "video/mp4", "apri", 400],
      ["documento", "application/pdf", "apri", 200],
      ["documento", "application/pdf", "vedi", 400],
      ["documento", "application/pdf", "video", 400],
    ];
    for (const [categoria, mime, uso, stato] of casi) {
      p = porteFinte({ riga: riga(categoria, mime) });
      x = await chiedi(p, { uso });
      c(
        `${categoria} con uso=${uso}: ${stato}${stato === 400 ? " uso_non_valido, nessuna firma" : ""}`,
        [stato, stato === 400 ? "uso_non_valido" : undefined, stato === 400 ? 0 : 1],
        [x.stato, x.corpo.motivo, p.chiamate.filter((k) => k[0] === "firmaLettura").length],
      );
    }
    // Uso inventato: 400 senza leggere la riga.
    for (const uso of ["scarica", "VEDI", "", "vedi,video", 5, {}]) {
      p = porteFinte();
      x = await chiedi(p, { uso });
      c(
        `uso inventato (${JSON.stringify(uso)}): 400 uso_non_valido, la riga non si legge`,
        [400, "uso_non_valido", 0],
        [x.stato, x.corpo.motivo, p.chiamate.filter((k) => k[0] === "percorsoPronto").length],
      );
    }
    // Durata della firma: video 30 minuti, il resto 5.
    p = porteFinte({ riga: riga("video", "video/mp4") });
    await chiedi(p, { uso: "video" });
    c(
      "video: il link dura 1.800 secondi, senza download",
      [1800, undefined],
      [
        p.chiamate.find((k) => k[0] === "firmaLettura")?.[2],
        p.chiamate.find((k) => k[0] === "firmaLettura")?.[3],
      ],
    );
    p = porteFinte({ riga: riga("audio", "audio/ogg") });
    await chiedi(p, { uso: "vedi" });
    c(
      "audio «vedi»: 300 secondi, inline",
      [300, undefined],
      [
        p.chiamate.find((k) => k[0] === "firmaLettura")?.[2],
        p.chiamate.find((k) => k[0] === "firmaLettura")?.[3],
      ],
    );
    // Content-Disposition: lo decide il server dalla colonna `mime`.
    p = porteFinte({ riga: riga("documento", "application/pdf", "Preventivo.pdf") });
    await chiedi(p, { uso: "apri" });
    c(
      "PDF: inline (nessun download)",
      undefined,
      p.chiamate.find((k) => k[0] === "firmaLettura")?.[3],
    );
    for (const [mime, ext] of [
      [DOCX, "docx"],
      [MIME.documento[2], "xlsx"],
      [MIME.documento[3], "pptx"],
    ]) {
      p = porteFinte({ riga: riga("documento", mime, "Relazione finale") });
      await chiedi(p, { uso: "apri" });
      c(
        `${ext}: attachment con il nome ripulito e l'estensione forzata dal mime`,
        `Relazione finale.${ext}`,
        p.chiamate.find((k) => k[0] === "firmaLettura")?.[3],
      );
    }
    p = porteFinte({ riga: riga("documento", DOCX, "falso.pdf") });
    await chiedi(p, { uso: "apri" });
    c(
      "un nome che dice .pdf per un docx: l'estensione la decide il mime (falso.docx)",
      "falso.docx",
      p.chiamate.find((k) => k[0] === "firmaLettura")?.[3],
    );
    p = porteFinte({ riga: riga("documento", DOCX, '../../a"b\r\n;c‮.exe') });
    await chiedi(p, { uso: "apri" });
    const dl = p.chiamate.find((k) => k[0] === "firmaLettura")?.[3];
    c(
      "nome ostile (cartelle, virgolette, a capo, bidi, .exe): solo ASCII sicuro, mai un percorso, mai .exe; l'estensione è del mime",
      [true, false, false, true],
      [/^[A-Za-z0-9._ -]+\.docx$/.test(dl), /\/|\.\./.test(dl), /exe/.test(dl), dl.length <= 90],
    );
    p = porteFinte({ riga: riga("documento", DOCX, null) });
    await chiedi(p, { uso: "apri" });
    c(
      "senza nome (riga liberata o mai scritto): «file.docx»",
      "file.docx",
      p.chiamate.find((k) => k[0] === "firmaLettura")?.[3],
    );
    p = porteFinte({ riga: riga("audio", "audio/ogg", null) });
    await chiedi(p, { uso: "apri" });
    c(
      "vocale scaricato («apri»): attachment «file.ogg»",
      "file.ogg",
      p.chiamate.find((k) => k[0] === "firmaLettura")?.[3],
    );
    p = porteFinte({ riga: riga("documento", "application/x-strano", "a.bin") });
    await chiedi(p, { uso: "apri" });
    c(
      "mime non canonico nella riga (non dovrebbe esistere): mai inline, mai un'estensione inventata",
      "a",
      p.chiamate.find((k) => k[0] === "firmaLettura")?.[3],
    );
    //  I casi di prima.
    p = porteFinte({ riga: null });
    x = await chiedi(p);
    c("nessuna riga pronta: 404 non_trovata", [404, "non_trovata"], [x.stato, x.corpo.motivo]);
    x = await chiedi(porteFinte(), { id: ID("docx") });
    c("identificativo con estensione qualunque: valido", 200, x.stato);
    x = await chiedi(porteFinte(), { id: `${UUID}.toolongext` });
    c(
      "estensione troppo lunga: 400 id_non_valido",
      [400, "id_non_valido"],
      [x.stato, x.corpo.motivo],
    );
    x = await chiedi(porteFinte(), { adminUserId: ALTRO, uso: "boh" });
    c("installazione diversa: 403 prima di guardare `uso`", 403, x.stato);
    p = porteFinte({ rompi: "firmaLettura", codice: "storage" });
    x = await chiedi(p);
    c(
      "Storage in errore: 503 storage, log pulito",
      [503, "storage", true],
      [x.stato, x.corpo.motivo, logPulito(p.avvisi)],
    );
    c(
      "log di una lettura completa: solo codici e contatori",
      true,
      logPulito(
        await (async () => {
          const q = porteFinte({ riga: riga("documento", DOCX, "Anna.docx") });
          await chiedi(q, { uso: "apri" });
          return q.avvisi;
        })(),
      ),
    );
  }

  /* ═══ 8. nomeSicuro ═════════════════════════════════════════════════════ */
  gruppo("MEDIA · nomeSicuro: il nome del file scaricato (T2)");
  c(
    "tiene lettere, cifre, spazio, trattino, trattino basso; l'estensione la mette il mime",
    ["Fattura 2026-10_a.pdf"],
    [M.nomeSicuro("Fattura 2026-10_a", "application/pdf")],
  );
  c(
    "toglie l'estensione scritta dal mittente",
    ["Foglio.xlsx"],
    [M.nomeSicuro("Foglio.docx", MIME.documento[2])],
  );
  c(
    "accenti e simboli diventano «_»; gli spazi doppi si riducono a uno",
    ["Citt_ _ di Roma.docx"],
    [M.nomeSicuro("Città ✓ di   Roma", DOCX)],
  );
  c(
    "lunghezza: al più 80 caratteri più l'estensione",
    true,
    M.nomeSicuro("x".repeat(500), DOCX).length <= 85,
  );
  c(
    "vuoto, solo punti o nullo: «file»",
    ["file.docx", "file.docx", "file.docx"],
    [M.nomeSicuro("...", DOCX), M.nomeSicuro("", DOCX), M.nomeSicuro(null, DOCX)],
  );
  c(
    "nome che comincia con un punto non diventa un file nascosto",
    false,
    M.nomeSicuro(".bashrc", DOCX).startsWith("."),
  );
  c(
    "mime senza estensione nota: nessuna estensione inventata",
    "a",
    M.nomeSicuro("a.bin", "application/x-strano"),
  );

  /* ═══ 9. I SORGENTI ═════════════════════════════════════════════════════ */
  gruppo("MEDIA · SORGENTI (T2)");
  {
    for (const f of ["src/crm/ponte/media-tipi.ts", "src/crm/ponte/media.ts"]) {
      const t = senzaCommenti(sorgente(f));
      c(
        `${f}: puro (niente console, fetch, database, process.env)`,
        [false, false, false, false],
        [/console\./.test(t), /\bfetch\s*\(/.test(t), /supabase/i.test(t), /process\.env/.test(t)],
      );
    }
    const db = senzaCommenti(sorgente("src/crm/ponte/media-db.server.ts"));
    c(
      "media-db.server: esporta dbMedia, lancia e utenteDelPonte",
      [true, true, true],
      [
        /export const dbMedia\b/.test(db),
        /export const lancia\b/.test(db),
        /export const utenteDelPonte\b/.test(db),
      ],
    );
    c(
      "media-db.server: l'utente viene da manychat_config (id=1); mai il messaggio d'errore; nessuna scrittura",
      [true, false, false],
      [
        /from\("manychat_config"\)/.test(db) && /\.eq\("id", 1\)/.test(db),
        /\.message\b/.test(db),
        /\.(insert|update|upsert|delete)\(/.test(db),
      ],
    );
    const server = senzaCommenti(sorgente("src/crm/ponte/media.server.ts"));
    c(
      "media.server: usa le tre funzioni comuni e non ne ha una copia",
      [true, false, false],
      [
        /from "\.\/media-db\.server"/.test(server),
        /const db = \(\) =>/.test(server),
        /const lancia = /.test(server),
      ],
    );
    c(
      "media.server: le funzioni SQL per nome, e nessun'altra",
      ["ponte_wa_media_dettagli", "ponte_wa_media_fatto", "ponte_wa_media_permesso"],
      [...new Set([...server.matchAll(/\.rpc(?:<.*?>)?\(\s*"(\w+)"/g)].map((x) => x[1]))].sort(),
    );
    c(
      "media.server: le sole tabelle sono app_config, ponte_wa_media e ponte_wa_media_richieste (manychat_config sta in media-db)",
      ["app_config", "ponte_wa_media", "ponte_wa_media_richieste"],
      [...new Set([...server.matchAll(/\.from\(\s*"(\w+)"/g)].map((x) => x[1]))].sort(),
    );
    c(
      "media.server: nessuna scrittura diretta, mai il messaggio d'errore, nessun fetch",
      [false, false, false],
      [
        /\.(insert|update|upsert|delete)\(/.test(server),
        /\.message\b/.test(server),
        /\bfetch\s*\(/.test(server),
      ],
    );
    c(
      "media.server: il bucket è la costante BUCKET_MEDIA; la rimozione è di un solo percorso alla volta",
      [true, true],
      [server.includes("BUCKET_MEDIA"), /\.remove\(\[path\]\)/.test(server)],
    );
    c(
      "media.server: la richiesta si cerca in_corso, per utente e chiave",
      true,
      /ponte_wa_media_richieste[\s\S]*\.eq\("user_id", userId\)[\s\S]*\.eq\("chiave", chiave\)[\s\S]*\.eq\("stato", "in_corso"\)/.test(
        server,
      ),
    );
    c(
      "media.server: il link firmato porta `download` solo se richiesto",
      true,
      /createSignedUrl\(\s*path,\s*secondi,\s*opzioni\?\.download \? \{ download: opzioni\.download \} : undefined,?\s*\)/.test(
        server,
      ),
    );
    const logiche = senzaCommenti(sorgente("src/crm/ponte/media.ts"));
    c(
      "media.ts: l'utente non si legge mai dal corpo; l'estensione del percorso non è un elenco",
      [false, false],
      [/json\.(user_id|userId|utente)\b/.test(logiche), /\(jpg\|png\|webp\)/.test(logiche)],
    );
    const rotta = senzaCommenti(sorgente("src/routes/api.crm.ponte-media.ts"));
    c(
      "rotta GET: legge `id` e `uso`, nient'altro; una sola guardia; no-store",
      [true, true, 1, true],
      [
        /searchParams\.get\("id"\)/.test(rotta),
        /searchParams\.get\("uso"\)/.test(rotta),
        (rotta.match(/guardiaCRM\(/g) ?? []).length,
        rotta.includes("no-store"),
      ],
    );
  }
}
