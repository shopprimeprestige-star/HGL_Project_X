/** ── PROVE: LA TABELLA DEI MEDIA È LA STESSA OVUNQUE (PARITÀ Mac ↔ server ↔ SQL) ──
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T11 (PIANO a.1, (f) T11).
 *  La tabella delle categorie (tipi, limiti, estensioni) e le regex degli
 *  identificativi sono scritte in più posti, perché il Mac, il Worker, il browser
 *  e il database non condividono codice:
 *    · Mac:     `strumenti/ponte-whatsapp/src/firma.mjs` (mime), `immagini.mjs` (limiti, tipo Baileys),
 *               `catalogo.mjs` (miniatura);
 *    · server:  `src/crm/ponte/media-tipi.ts` (tutto), `media.ts` (miniatura);
 *    · browser: `src/crm/chatwa/usaMediaPonte.ts` (`ID_MEDIA`, `PERCORSO_MEDIA`, tipi e pesi del blob);
 *    · SQL:     migrazione A (`…_ponte_media_tipi.sql`): bucket, CHECK di mime e byte,
 *               `ponte_wa_media_categoria/limite/estensione`, CHECK della miniatura.
 *  Se ne cambia una e non le altre, qui si vede. Si leggono i SORGENTI (nessun database).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MIB = 1024 * 1024;
const CATEGORIE = ["foto", "audio", "video", "documento"];
const UUID_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const UUID_B = "9b2c1a7e-5d3f-4e8a-b1c2-0d4e6f8a1b3c";

/** Le coppie `WHEN '<chiave>' THEN '<valore>'` del `CASE` di una funzione SQL. */
function coppieSql(sql, funzione) {
  const inizio = sql.indexOf(`FUNCTION public.${funzione}(`);
  if (inizio < 0) return null;
  const fine = sql.indexOf("END $$", inizio);
  const corpo = sql.slice(inizio, fine);
  return Object.fromEntries(
    [...corpo.matchAll(/WHEN '([^']+)' THEN '?([^'\s:]+)'?(?:::bigint)?/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
}

/** Le stringhe tra apici di una lista SQL (`ARRAY[…]` o `IN (…)`). */
const stringheSql = (testo) => [...testo.matchAll(/'([^']+)'/g)].map((m) => m[1]);

/** `usaMediaPonte.ts` costruisce le sue regex da un `UUID` e da un template: li ricompone come fa il codice. */
function regexTemplate(sorgente, nome) {
  const uuid = sorgente.match(/const UUID = "([^"]+)"/)?.[1];
  const modello = sorgente.match(new RegExp(`const ${nome} = new RegExp\\(\`([^\`]+)\`\\)`))?.[1];
  if (!uuid || !modello) return null;
  //  il template è una stringa di JS: `\\.` nel sorgente vale `\.` nella regex
  return new RegExp(modello.replaceAll("${UUID}", uuid).replaceAll("\\\\", "\\"));
}

export async function provePonteMediaParita(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const T = mod["ponte/media-tipi"];
  const F = await import(
    pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src/firma.mjs")).href
  );
  const I = await import(
    pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src/immagini.mjs")).href
  );
  //  Senza i commenti `--`: «come si annulla» contiene l'UPDATE inverso del bucket (8 MiB, tre tipi).
  const sqlA = leggi("supabase/migrations/20261031120000_ponte_media_tipi.sql").replace(
    /^\s*--.*$/gm,
    "",
  );
  const usa = leggi("src/crm/chatwa/usaMediaPonte.ts");

  gruppo("PONTE WHATSAPP · MEDIA · PARITÀ Mac ↔ server ↔ SQL (compito T11)");

  //  Il riferimento: PIANO a.1 (scritto qui una volta, a mano).
  const MIME_PIANO = {
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
  const LIMITI_PIANO = { foto: 8 * MIB, audio: 16 * MIB, video: 45 * MIB, documento: 25 * MIB };
  const TUTTI = CATEGORIE.flatMap((k) => MIME_PIANO[k]);

  /* ═══ 1. I MIME PER CATEGORIA ═════════════════════════════════════════════ */
  c("piano: 16 mime in 4 categorie", [16, 4], [TUTTI.length, CATEGORIE.length]);
  c("server (media-tipi): mime per categoria = PIANO a.1", MIME_PIANO, T.MIME_PER_CATEGORIA);
  c("Mac (firma.mjs): mime per categoria = server", T.MIME_PER_CATEGORIA, F.MIME_PER_CATEGORIA);
  c(
    "server: la categoria di ogni mime = quella del PIANO",
    Object.fromEntries(TUTTI.map((m) => [m, CATEGORIE.find((k) => MIME_PIANO[k].includes(m))])),
    Object.fromEntries(TUTTI.map((m) => [m, T.categoriaDi(m)])),
  );
  c(
    "Mac: la categoria di ogni mime = quella del server",
    Object.fromEntries(TUTTI.map((m) => [m, T.categoriaDi(m)])),
    Object.fromEntries(TUTTI.map((m) => [m, F.categoriaDaMime(m)])),
  );

  //  SQL: la funzione di categoria, il bucket e il CHECK di `mime`.
  const catSql = coppieSql(sqlA, "ponte_wa_media_categoria");
  c(
    "SQL: ponte_wa_media_categoria = la categoria del server per ognuno dei 16 mime (e nessuno in più)",
    Object.fromEntries(TUTTI.map((m) => [m, T.categoriaDi(m)])),
    catSql,
  );
  const bucket = sqlA.match(
    /UPDATE storage\.buckets\s+SET file_size_limit = (\d+),\s+allowed_mime_types = ARRAY\[([^\]]+)\]/,
  );
  c(
    "SQL: il bucket ammette esattamente i 16 mime (stesso ordine delle categorie)",
    TUTTI,
    bucket ? stringheSql(bucket[2]) : null,
  );
  const checkMime = sqlA.match(
    /ADD CONSTRAINT ponte_wa_media_mime_check CHECK \(mime IN \(([^)]+)\)\)/,
  );
  c(
    "SQL: il CHECK di `mime` ammette esattamente i 16 mime",
    TUTTI,
    checkMime ? stringheSql(checkMime[1]) : null,
  );
  c(
    "SQL: la colonna `categoria` ammette le 4 categorie e basta",
    CATEGORIE,
    stringheSql(
      sqlA.match(
        /ADD COLUMN IF NOT EXISTS categoria text[^\n]*CHECK \(categoria IN \(([^)]+)\)\)/,
      )?.[1] ?? "",
    ),
  );

  /* ═══ 2. I LIMITI DI PESO ═════════════════════════════════════════════════ */
  c(
    "server: limiti per categoria = PIANO a.1 (8 / 16 / 45 / 25 MiB)",
    LIMITI_PIANO,
    T.LIMITI_MEDIA,
  );
  c(
    "Mac (immagini.mjs): maxByte per categoria = server",
    T.LIMITI_MEDIA,
    Object.fromEntries(CATEGORIE.map((k) => [k, I.LIMITI_MEDIA[k]?.maxByte])),
  );
  c(
    "Mac: le categorie di LIMITI_MEDIA sono esattamente le 4",
    CATEGORIE,
    Object.keys(I.LIMITI_MEDIA),
  );
  const limSql = coppieSql(sqlA, "ponte_wa_media_limite");
  c(
    "SQL: ponte_wa_media_limite = limiti del server",
    Object.fromEntries(CATEGORIE.map((k) => [k, String(T.LIMITI_MEDIA[k])])),
    limSql,
  );
  const maxServer = Math.max(...Object.values(T.LIMITI_MEDIA));
  c(
    "SQL: il bucket ha come limite il più largo (video 45 MiB = 47.185.920 B)",
    [47185920, 47185920],
    [maxServer, Number(bucket?.[1])],
  );
  c(
    "SQL: il CHECK di `byte` arriva allo stesso limite",
    [`BETWEEN 0 AND ${maxServer}`],
    [sqlA.match(/CHECK \(byte (BETWEEN 0 AND \d+)\)/)?.[1]],
  );
  c(
    "45 MiB sta sotto il limite globale di Storage (50 MB decimali): nessun intervento sul pannello",
    true,
    maxServer < 50_000_000,
  );

  /* ═══ 3. LE ESTENSIONI DEL PERCORSO ═══════════════════════════════════════ */
  c(
    "server: un'estensione per ognuno dei 16 mime, tutte `[a-z0-9]{2,5}`",
    [true, true],
    [
      JSON.stringify(Object.keys(T.ESTENSIONE_PER_MIME)) === JSON.stringify(TUTTI),
      Object.values(T.ESTENSIONE_PER_MIME).every((e) => /^[a-z0-9]{2,5}$/.test(e)),
    ],
  );
  c(
    "server: le estensioni sono tutte diverse (il browser sceglie il lettore dal mime, ma il nome non è ambiguo)",
    Object.keys(T.ESTENSIONE_PER_MIME).length,
    new Set(Object.values(T.ESTENSIONE_PER_MIME)).size,
  );
  c(
    "SQL: ponte_wa_media_estensione = ESTENSIONE_PER_MIME del server",
    T.ESTENSIONE_PER_MIME,
    coppieSql(sqlA, "ponte_wa_media_estensione"),
  );

  /* ═══ 4. GLI IDENTIFICATIVI: `ID_MEDIA`, `PERCORSO_MEDIA` ═════════════════ */
  const idServer = T.ID_MEDIA;
  const percServer = T.PERCORSO_MEDIA;
  const idBrowser = regexTemplate(usa, "ID_MEDIA");
  const percBrowser = regexTemplate(usa, "PERCORSO_MEDIA");
  c(
    "browser (usaMediaPonte): ID_MEDIA e PERCORSO_MEDIA si leggono dal sorgente",
    [true, true],
    [idBrowser instanceof RegExp, percBrowser instanceof RegExp],
  );
  c("server e browser: stesso testo di ID_MEDIA", idServer.source, idBrowser?.source);
  const estensioni = Object.values(T.ESTENSIONE_PER_MIME);
  const buoni = [
    ...estensioni.map((e) => `${UUID_A}.${e}`),
    `${UUID_A}.ab`,
    `${UUID_A}.a1b2c`, // «nessun elenco»: la sceglie il database
  ];
  const cattivi = [
    `${UUID_A}`,
    `${UUID_A}.`,
    `${UUID_A}.a`, // 1 sola lettera
    `${UUID_A}.abcdef`, // 6
    `${UUID_A}.JPG`,
    `${UUID_A}.j-g`,
    `${UUID_A}.jpg/../x`,
    `x${UUID_A}.jpg`,
    `${UUID_A}.jpg\n`,
    `${UUID_A.toUpperCase()}.jpg`,
    `${UUID_A.slice(1)}.jpg`,
    `${UUID_A}/${UUID_B}.jpg`,
    `../${UUID_A}.jpg`,
    `bw:393331234567:3EB0A1`,
  ];
  const buoniPerc = buoni.map((x) => `${UUID_B}/${x}`);
  const cattiviPerc = [
    ...cattivi.map((x) => `${UUID_B}/${x}`),
    buoni[0], // senza cartella dell'utente
    `${UUID_B}/${UUID_A}/${UUID_A}.jpg`,
    `/${UUID_B}/${UUID_A}.jpg`,
    `${UUID_B}\\${UUID_A}.jpg`,
    `ponte-media/${UUID_B}/${UUID_A}.jpg`,
  ];
  const verdetto = (re, lista) => lista.map((x) => re.test(x));
  c(
    "ID_MEDIA del server: accetta tutte le estensioni dei 16 tipi e qualunque `[a-z0-9]{2,5}`",
    true,
    verdetto(idServer, buoni).every(Boolean),
  );
  c(
    "ID_MEDIA del server: rifiuta 1 o 6 caratteri, maiuscole, trattini, percorsi, righe in più, chiavi `bw:`",
    [],
    cattivi.filter((x) => idServer.test(x)),
  );
  c(
    "ID_MEDIA browser = server su tutti i casi buoni e cattivi",
    verdetto(idServer, [...buoni, ...cattivi]),
    verdetto(idBrowser, [...buoni, ...cattivi]),
  );
  c(
    "PERCORSO_MEDIA del server: accetta `<uuid>/<uuid>.<ext>` per ogni estensione",
    true,
    verdetto(percServer, buoniPerc).every(Boolean),
  );
  c(
    "PERCORSO_MEDIA del server: rifiuta tutto il resto",
    [],
    cattiviPerc.filter((x) => percServer.test(x)),
  );
  c(
    "PERCORSO_MEDIA browser = server su tutti i casi buoni e cattivi",
    verdetto(percServer, [...buoniPerc, ...cattiviPerc]),
    verdetto(percBrowser, [...buoniPerc, ...cattiviPerc]),
  );
  c(
    "il gruppo di PERCORSO_MEDIA del browser è il nome del file (`<uuid>.<ext>`) e passa ID_MEDIA",
    true,
    idServer.test(percBrowser?.exec(buoniPerc[0])?.[1] ?? ""),
  );
  //  Il percorso che il database sceglie (`<user_id>/<uuid>.<ext>`) passa le due regex per ogni mime.
  c(
    "SQL: il percorso scelto è `<user_id>::text || '/' || gen_random_uuid()::text || '.' || estensione` (due volte: permesso e richiedi)",
    2,
    [...sqlA.matchAll(/p_user_id::text \|\| '\/' \|\| gen_random_uuid\(\)::text \|\| '\.' \|\|/g)]
      .length,
  );
  c(
    "ogni estensione del database, nel percorso, passa PERCORSO_MEDIA (server e browser) e ID_MEDIA",
    [true, true, true],
    [
      estensioni.every((e) => percServer.test(`${UUID_B}/${UUID_A}.${e}`)),
      estensioni.every((e) => percBrowser.test(`${UUID_B}/${UUID_A}.${e}`)),
      estensioni.every((e) => idServer.test(`${UUID_A}.${e}`)),
    ],
  );

  /* ═══ 5. IL BLOB DEL BROWSER E IL TIPO DI BAILEYS ═════════════════════════ */
  //  Foto e vocali passano da `blob:`: stessi tipi dell'elenco; peso di poco sopra il limite (il flusso si legge a × 1,1).
  const blob = Object.fromEntries(
    [
      ...usa.matchAll(
        /^\s{2}(foto|audio):\s*\{\s*tipi:\s*\[([^\]]+)\],\s*pesoMax:\s*(\d+) \* 1024 \* 1024/gm,
      ),
    ].map((m) => [
      m[1],
      { tipi: stringheSql(m[2].replace(/"/g, "'")), pesoMax: Number(m[3]) * MIB },
    ]),
  );
  c(
    "browser: BLOB_AMMESSI ha foto e vocali (video e documenti non passano da blob)",
    ["foto", "audio"],
    Object.keys(blob),
  );
  c(
    "browser: i tipi del blob = mime del server per quella categoria",
    { foto: T.MIME_PER_CATEGORIA.foto, audio: T.MIME_PER_CATEGORIA.audio },
    { foto: blob.foto?.tipi, audio: blob.audio?.tipi },
  );
  c(
    "browser: il peso massimo del blob sta fra il limite e il limite + 1 MiB",
    [true, true],
    ["foto", "audio"].map(
      (k) => blob[k]?.pesoMax >= T.LIMITI_MEDIA[k] && blob[k]?.pesoMax <= T.LIMITI_MEDIA[k] + MIB,
    ),
  );
  c(
    "Mac: tipo per `downloadContentFromMessage`, una voce per categoria",
    { foto: "image", audio: "audio", video: "video", documento: "document" },
    I.TIPO_BAILEYS,
  );

  /* ═══ 6. LA MINIATURA (stessa regex, stesso limite, in ogni posto) ═══════ */
  const regexMin = "/^\\/9j\\/[A-Za-z0-9+/]*={0,2}$/";
  const sorgentiMiniatura = [
    "src/crm/ponte/media.ts",
    "strumenti/ponte-whatsapp/src/catalogo.mjs",
    "src/crm/chatwa/archivio.ts",
    "src/crm/chatwa/usaMediaPonte.ts",
  ];
  c(
    "la regex della miniatura è la stessa (media.ts, catalogo.mjs, archivio.ts, usaMediaPonte.ts)",
    sorgentiMiniatura.map(() => true),
    sorgentiMiniatura.map((p) => leggi(p).includes(`const MINIATURA = ${regexMin};`)),
  );
  c(
    "…e la stessa del CHECK SQL (colonna e funzione `dettagli`)",
    2,
    [
      ...sqlA.matchAll(
        /miniatura ~ '\^\/9j\/\[A-Za-z0-9\+\/\]\*=\{0,2\}\$'|p_miniatura ~ '\^\/9j\/\[A-Za-z0-9\+\/\]\*=\{0,2\}\$'/g,
      ),
    ].length,
  );
  c(
    "…e lo stesso limite di 12.000 caratteri (CHECK, funzione, catalogo)",
    [true, true, true],
    [
      /length\(miniatura\) <= 12000/.test(sqlA),
      /length\(p_miniatura\) <= 12000/.test(sqlA),
      /12_?000/.test(leggi("strumenti/ponte-whatsapp/src/catalogo.mjs")),
    ],
  );
}
