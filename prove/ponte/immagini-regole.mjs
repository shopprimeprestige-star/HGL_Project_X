/** ── PROVE: LE IMMAGINI DEL PONTE · REGOLE E LOGICA (media-tipi.ts, media.ts) ──
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T5 (PIANO c.3, c.4).
 *  `leggiInterruttore`, `leggiPermesso`, `gestisciMedia` e `gestisciLettura`
 *  con porte finte (`PorteMedia`): il database non c'è, si guarda che cosa la
 *  logica chiede e che cosa risponde. La rotta vera e le porte vere stanno in
 *  `immagini-rotta.mjs`; l'SQL lo prova `prove/sql/ponte-immagini.sql` (T4).
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
const NOME_FILE = "7c1e5f0a-9b2d-4e6f-8a3b-0d1c2e3f4a5b.jpg";
const PATH = NOME_FILE;
/** L'identificativo del file per la GET: il nome `<uuid>.<ext>`, senza dati del cliente. */
const ID = "5d2b9c4e-0a1f-4b7c-9e3d-6f8a1b2c3d4e.png";
const ACCESO = '{"acceso":true,"tettoGB":0.8}';
const MIB8 = 8 * 1024 * 1024;

/** Le porte finte: registrano le chiamate e restituiscono quello che dice `o`. */
function porteFinte(o = {}) {
  const chiamate = [];
  const avvisi = [];
  const lancia = (chi) => {
    if (o.rompi === chi) throw { code: o.codice ?? "XX000", message: `errore con ${NUMERO} e Anna Finta dentro` };
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
      return o.interruttore === undefined ? ACCESO : o.interruttore;
    },
    async permesso(u, p) {
      chiamate.push(["permesso", u, { ...p }]);
      lancia("permesso");
      return "permesso" in o ? o.permesso : { esito: "carica", path: PATH };
    },
    async firmaCarico(path) {
      chiamate.push(["firmaCarico", path]);
      lancia("firmaCarico");
      return `https://x.supabase.co/storage/v1/object/upload/sign/ponte-media/${path}?token=t`;
    },
    async fatto(u, chiave) {
      chiamate.push(["fatto", u, chiave]);
      lancia("fatto");
      return o.fatto ?? { stato: "pronta" };
    },
    async percorsoPronto(u, id) {
      chiamate.push(["percorsoPronto", u, id]);
      lancia("percorsoPronto");
      return o.percorso === undefined ? PATH : o.percorso;
    },
    async firmaLettura(path, secondi) {
      chiamate.push(["firmaLettura", path, secondi]);
      lancia("firmaLettura");
      return o.firma === undefined ? `https://x.supabase.co/storage/v1/object/sign/ponte-media/${path}?token=l` : o.firma;
    },
    avviso(codice, conteggi) {
      avvisi.push([codice, conteggi]);
    },
  };
}

const permessoDi = (o = {}) => ({ v: 1, tipo: "media_permesso", chiave: CHIAVE, mime: "image/jpeg", byte: 1234, ...o });
const fattoDi = (o = {}) => ({ v: 1, tipo: "media_fatto", chiave: CHIAVE, ...o });

async function leggi(r) {
  const testo = await r.text();
  try {
    return { stato: r.status, json: JSON.parse(testo), no_store: r.headers.get("cache-control") === "no-store" };
  } catch {
    return { stato: r.status, json: null, no_store: false };
  }
}

/** I log di una prova: solo codici e numeri, mai nient'altro. */
const logPulito = (avvisi) =>
  avvisi.every(
    ([k, n]) =>
      /^[a-z_]+$/.test(k) && (n === undefined || Object.entries(n).every(([ch, v]) => /^[a-z_]+$/.test(ch) && typeof v === "number")),
  ) && !/3933|3EB0|Anna|supabase|token|\.jpg|bw:/.test(JSON.stringify(avvisi));

export async function provePonteImmaginiRegole(mod, { c, gruppo, radice }) {
  const T = mod["ponte/media-tipi"];
  const M = mod["ponte/media"];
  const sorgente = (f) => readFileSync(join(radice, f), "utf8");
  const senzaCommenti = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  /* ═══ 1. I CONTRATTI ════════════════════════════════════════════════════ */
  gruppo("PONTE · IMMAGINI · CONTRATTI (T5)");
  c("il tetto di una foto è 8 MiB", MIB8, T.MEDIA_MAX_BYTE);
  c("solo jpeg, png, webp: mai SVG né HTML", ["image/jpeg", "image/png", "image/webp"], [...T.MEDIA_MIME]);
  c("i rifiuti del Worker: lista chiusa", ["spenta", "tetto", "troppo_grande", "tipo"], [...T.MOTIVI_RIFIUTO_MEDIA]);
  c("bucket e chiave dell'interruttore", ["ponte-media", "ponte_immagini"], [T.BUCKET_MEDIA, T.CHIAVE_INTERRUTTORE]);
  c("il tetto di serie è 0,8 GB; il link di lettura dura 300 secondi", [0.8, 300], [T.TETTO_GB_DI_SERIE, T.FIRMA_LETTURA_S]);
  c("l'identificativo del file per la GET: <uuid minuscolo>.<jpg|png|webp>, mai la chiave né un numero", [true, true, true, false, false, false, false, false, false, false],
    [ID, NOME_FILE, "5d2b9c4e-0a1f-4b7c-9e3d-6f8a1b2c3d4e.webp", "5d2b9c4e-0a1f-4b7c-9e3d-6f8a1b2c3d4e", "5d2b9c4e-0a1f-4b7c-9e3d-6f8a1b2c3d4e.svg", ID.toUpperCase(), CHIAVE, `${UTENTE}/${ID}`, `${ID}\n`, `${ID}&x=1`].map((k) => T.ID_MEDIA.test(k)));
  c("la chiave del messaggio: bw:<cifre>:<id>", [true, true, false, false, false, false, false],
    [CHIAVE, "bw:393331234567:a.b-c_D", "bw:123:x", "xx:393331234567:3EB0A1", "bw:393331234567:", "bw:393331234567:a b", `${CHIAVE}\n`].map((k) => T.CHIAVE_MEDIA.test(k)));

  /* ═══ 2. L'INTERRUTTORE (c.4) ═══════════════════════════════════════════ */
  gruppo("PONTE · IMMAGINI · L'INTERRUTTORE (T5)");
  const SPENTO = { acceso: false, tettoGB: 0.8 };
  c("acceso con il suo tetto", { acceso: true, tettoGB: 0.8 }, M.leggiInterruttore('{"acceso":true,"tettoGB":0.8}'));
  c("acceso con un altro tetto", { acceso: true, tettoGB: 0.5 }, M.leggiInterruttore('{"acceso":true,"tettoGB":0.5}'));
  c("spento esplicito", SPENTO, M.leggiInterruttore('{"acceso":false,"tettoGB":0.8}'));
  c("riga assente (null, undefined): spento", [SPENTO, SPENTO], [M.leggiInterruttore(null), M.leggiInterruttore(undefined)]);
  c("testo rotto, vuoto, non un oggetto: spento", [SPENTO, SPENTO, SPENTO, SPENTO, SPENTO],
    ["{non è json", "", "true", "[]", "null"].map((x) => M.leggiInterruttore(x)));
  c("«acceso» che non è proprio true (stringa, numero): spento", [SPENTO, SPENTO, SPENTO],
    ['{"acceso":"true","tettoGB":0.8}', '{"acceso":1}', '{"tettoGB":0.8}'].map((x) => M.leggiInterruttore(x)));
  c("tetto rotto (zero, negativo, testo, enorme): acceso ma con 0,8", [0.8, 0.8, 0.8, 0.8],
    ['{"acceso":true,"tettoGB":0}', '{"acceso":true,"tettoGB":-3}', '{"acceso":true,"tettoGB":"molto"}', '{"acceso":true,"tettoGB":1e9}'].map((x) => M.leggiInterruttore(x).tettoGB));
  c("un valore già oggetto (colonna jsonb) vale come il testo", { acceso: true, tettoGB: 0.8 }, M.leggiInterruttore({ acceso: true, tettoGB: 0.8 }));
  c("il tetto in byte: GB × 10^9, intero", [800_000_000, 500_000_000], [M.tettoInByte(0.8), M.tettoInByte(0.5)]);

  /* ═══ 3. IL CORPO DEL MAC ═══════════════════════════════════════════════ */
  gruppo("PONTE · IMMAGINI · LA LETTURA DEI CORPI (T5)");
  c("permesso valido: chiave, numero ricavato dalla chiave, mime, byte", { chiave: CHIAVE, numero: NUMERO, mime: "image/jpeg", byte: 1234 }, M.leggiPermesso(permessoDi()));
  c("il numero non arriva dal corpo: un campo `numero` o `user_id` in più è ignorato", { chiave: CHIAVE, numero: NUMERO, mime: "image/jpeg", byte: 1234 },
    M.leggiPermesso({ ...permessoDi(), numero: "393339999999", user_id: ALTRO }));
  const storti = {
    "v sbagliata": permessoDi({ v: 2 }),
    "tipo sbagliato": permessoDi({ tipo: "lotto" }),
    "chiave senza bw:": permessoDi({ chiave: `wa:${NUMERO}:x` }),
    "chiave con numero corto": permessoDi({ chiave: "bw:123:x" }),
    "chiave non testo": permessoDi({ chiave: 5 }),
    "mime non testo": permessoDi({ mime: 5 }),
    "byte zero": permessoDi({ byte: 0 }),
    "byte negativo": permessoDi({ byte: -1 }),
    "byte con la virgola": permessoDi({ byte: 1.5 }),
    "byte testo": permessoDi({ byte: "100" }),
    "byte infinito": permessoDi({ byte: Infinity }),
    "byte assente": { v: 1, tipo: "media_permesso", chiave: CHIAVE, mime: "image/png" },
    "non un oggetto": [1, 2],
    "null": null,
  };
  for (const [nome, corpo] of Object.entries(storti)) c(`permesso storto (${nome}): non valido`, null, M.leggiPermesso(corpo));
  c("fatto valido: la sola chiave", { chiave: CHIAVE, numero: NUMERO }, M.leggiFatto(fattoDi()));
  c("fatto storto (chiave sbagliata, v sbagliata, tipo sbagliato)", [null, null, null],
    [fattoDi({ chiave: "x" }), fattoDi({ v: 3 }), fattoDi({ tipo: "media_permesso" })].map((x) => M.leggiFatto(x)));
  c("chiave di lettura: valida o null", [{ chiave: CHIAVE, numero: NUMERO }, null, null, null],
    [CHIAVE, "bw:1:2", null, 7].map((x) => M.leggiChiave(x)));
  c("il percorso: uuid.estensione, senza il numero, senza cartelle strane", [true, true, false, false, false, false, false, false],
    [PATH, `u/${PATH}`, `${NUMERO}.jpg`, "../x.jpg", "/x.jpg", "a//b.jpg", "x.svg", 5].map((p) => M.percorsoValido(p, NUMERO)));

  /* ═══ 4. media_permesso ═════════════════════════════════════════════════ */
  gruppo("PONTE · IMMAGINI · media_permesso (T5)");
  {
    // Spento: nessun altro lavoro, nessuna funzione SQL.
    for (const [nome, valore] of [["spento", '{"acceso":false,"tettoGB":0.8}'], ["assente", null], ["rotto", "{rotto"]]) {
      const p = porteFinte({ interruttore: valore });
      const x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()));
      c(`interruttore ${nome}: 200 rifiutato «spenta»`, [200, { ok: true, esito: "rifiutato", motivo: "spenta" }], [x.stato, x.json]);
      c(`…${nome}: né la funzione SQL né la firma vengono chiamate`, [], p.chiamate.map((k) => k[0]).filter((n) => n !== "interruttore"));
    }

    // Il giro che riesce.
    let p = porteFinte();
    let x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()));
    c("acceso: carica, con l'URL di carico firmato", [200, "carica", true], [x.stato, x.json?.esito, /^https:\/\/x\.supabase\.co\/storage\/v1\/object\/upload\/sign\/ponte-media\//.test(x.json?.url_carico)]);
    c("…la risposta ha solo ok, esito, url_carico (il percorso non esce)", ["esito", "ok", "url_carico"], Object.keys(x.json).sort());
    c("…no-store", true, x.no_store);
    const sql = p.chiamate.find((k) => k[0] === "permesso");
    c("…la funzione SQL riceve l'utente del server, la chiave, il numero della chiave, mime, byte e il tetto in byte",
      [UTENTE, { chiave: CHIAVE, numero: NUMERO, mime: "image/jpeg", byte: 1234, tettoByte: 800_000_000 }], [sql?.[1], sql?.[2]]);
    c("…la firma si chiede per il percorso della funzione SQL", [["firmaCarico", PATH]], p.chiamate.filter((k) => k[0] === "firmaCarico"));
    c("…il tetto viene dall'interruttore (0,5 GB → 500 milioni di byte)", 500_000_000,
      await (async () => {
        const q = porteFinte({ interruttore: '{"acceso":true,"tettoGB":0.5}' });
        await M.gestisciMedia(q, UTENTE, permessoDi());
        return q.chiamate.find((k) => k[0] === "permesso")?.[2].tettoByte;
      })());

    // Limiti decisi dal TypeScript, prima del database.
    p = porteFinte();
    x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi({ byte: MIB8 })));
    c("esattamente 8 MiB: passa", "carica", x.json?.esito);
    p = porteFinte();
    x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi({ byte: MIB8 + 1 })));
    c("8 MiB + 1: rifiutato «troppo_grande»", [200, { ok: true, esito: "rifiutato", motivo: "troppo_grande" }], [x.stato, x.json]);
    c("…senza chiamare la funzione SQL", [], p.chiamate.map((k) => k[0]).filter((n) => n === "permesso" || n === "firmaCarico"));
    for (const mime of ["image/svg+xml", "text/html", "image/gif", "IMAGE/JPEG", "image/jpeg; charset=x", "application/octet-stream", ""]) {
      p = porteFinte();
      x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi({ mime })));
      c(`tipo «${mime}»: rifiutato «tipo», niente SQL`, [{ ok: true, esito: "rifiutato", motivo: "tipo" }, 0],
        [x.json, p.chiamate.filter((k) => k[0] === "permesso").length]);
    }
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      x = await leggi(await M.gestisciMedia(porteFinte(), UTENTE, permessoDi({ mime })));
      c(`tipo «${mime}»: ammesso`, "carica", x.json?.esito);
    }

    // Le risposte della funzione SQL.
    x = await leggi(await M.gestisciMedia(porteFinte({ permesso: { esito: "gia_presente" } }), UTENTE, permessoDi()));
    c("la funzione dice gia_presente: 200 gia_presente, senza firma", [200, { ok: true, esito: "gia_presente" }], [x.stato, x.json]);
    p = porteFinte({ permesso: { esito: "gia_presente" } });
    await M.gestisciMedia(p, UTENTE, permessoDi());
    c("…e la firma non si è chiesta", 0, p.chiamate.filter((k) => k[0] === "firmaCarico").length);
    for (const motivo of ["tetto", "troppo_grande", "tipo"]) {
      p = porteFinte({ permesso: { esito: "rifiutato", motivo } });
      x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()));
      c(`la funzione rifiuta («${motivo}»): lo stesso rifiuto al Mac, senza firma`, [{ ok: true, esito: "rifiutato", motivo }, 0],
        [x.json, p.chiamate.filter((k) => k[0] === "firmaCarico").length]);
    }
    const strane = {
      "rifiuto con un motivo inventato": { esito: "rifiutato", motivo: "boh" },
      "carica senza percorso": { esito: "carica" },
      "carica con un percorso che esce dalla cartella": { esito: "carica", path: "../altro.jpg" },
      "carica con un percorso che contiene il numero": { esito: "carica", path: `${NUMERO}/a.jpg` },
      "carica con una cartella assoluta": { esito: "carica", path: "/a.jpg" },
      "esito sconosciuto": { esito: "forse" },
      "nulla": null,
    };
    for (const [nome, permesso] of Object.entries(strane)) {
      p = porteFinte({ permesso });
      x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()));
      c(`risposta SQL storta (${nome}): 500 database, nessuna firma`, [500, { ok: false, errore: "database" }, 0],
        [x.stato, x.json, p.chiamate.filter((k) => k[0] === "firmaCarico").length]);
    }

    // I guasti.
    for (const rompi of ["permesso", "firmaCarico", "interruttore"]) {
      p = porteFinte({ rompi, codice: "08006" });
      x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()));
      c(`il database dice no (${rompi}): 500 database, il Mac ritenta`, [500, { ok: false, errore: "database" }], [x.stato, x.json]);
      c(`…il log dice solo il codice`, true, logPulito(p.avvisi));
    }
    //  22023 = argomento non valido per la funzione SQL (chiave, numero o utente): è colpa del corpo, non del database.
    for (const rompi of ["permesso", "interruttore"]) {
      p = porteFinte({ rompi, codice: "22023" });
      x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()));
      c(`SQLSTATE 22023 (${rompi}): 400 corpo_non_valido, non 500`, [400, { ok: false, errore: "corpo_non_valido" }], [x.stato, x.json]);
      c("…il log dice solo il codice", true, logPulito(p.avvisi) && p.avvisi.some(([k]) => k === "media_non_valido"));
    }
    for (const codice of ["42883", "PGRST202", "42P01", "PGRST205"]) {
      p = porteFinte({ rompi: "permesso", codice });
      x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi()));
      c(`migrazione non applicata (${codice}): 503 migrazione`, [503, { ok: false, errore: "migrazione" }], [x.stato, x.json]);
    }
    p = porteFinte({ rompi: "permesso", codice: "42883" });
    await M.gestisciMedia(p, UTENTE, permessoDi());
    c("…e il log dice «media_migrazione»", true, p.avvisi.some(([k]) => k === "media_migrazione"));

    // Corpo non valido, ordine.
    p = porteFinte();
    x = await leggi(await M.gestisciMedia(p, UTENTE, permessoDi({ byte: 0 })));
    c("corpo non valido: 400 corpo_non_valido, il database non si tocca", [400, { ok: false, errore: "corpo_non_valido" }, []], [x.stato, x.json, p.chiamate]);
    x = await leggi(await M.gestisciMedia(porteFinte(), UTENTE, { v: 1, tipo: "altro" }));
    c("tipo che non è del media: 400", 400, x.stato);

    // Log.
    p = porteFinte();
    await M.gestisciMedia(p, UTENTE, permessoDi());
    await M.gestisciMedia(p, UTENTE, permessoDi({ mime: "image/gif" }));
    await M.gestisciMedia(porteFinte(), UTENTE, permessoDi({ byte: 0 }));
    c("nei log solo codici e contatori (nessun numero, chiave, percorso, URL)", true, logPulito(p.avvisi));
    c("…e qualcosa si scrive davvero", true, p.avvisi.length >= 2);
  }

  /* ═══ 5. media_fatto ════════════════════════════════════════════════════ */
  gruppo("PONTE · IMMAGINI · media_fatto (T5)");
  {
    for (const stato of ["pronta", "in_caricamento", "assente"]) {
      const p = porteFinte({ fatto: { stato, byte: 99 } });
      const x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
      c(`la funzione dice «${stato}»: 200 con lo stesso esito (e basta)`, [200, { ok: true, esito: stato }], [x.stato, x.json]);
      c(`…la funzione riceve l'utente del server e la chiave`, [["fatto", UTENTE, CHIAVE]], p.chiamate.filter((k) => k[0] === "fatto"));
    }
    let p = porteFinte({ fatto: { stato: "inventato" } });
    let x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
    c("stato sconosciuto dalla funzione: 500 database", [500, { ok: false, errore: "database" }], [x.stato, x.json]);
    p = porteFinte({ rompi: "fatto", codice: "08006" });
    x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
    c("guasto del database: 500", 500, x.stato);
    p = porteFinte({ rompi: "fatto", codice: "42883" });
    x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
    c("migrazione assente: 503 migrazione", [503, "migrazione"], [x.stato, x.json?.errore]);
    p = porteFinte({ rompi: "fatto", codice: "22023" });
    x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
    c("SQLSTATE 22023 in media_fatto: 400 corpo_non_valido, non 500", [400, "corpo_non_valido"], [x.stato, x.json?.errore]);
    p = porteFinte();
    x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi({ chiave: "bw:1:2" })));
    c("chiave storta: 400, il database non si tocca", [400, []], [x.stato, p.chiamate]);
    p = porteFinte({ interruttore: null });
    x = await leggi(await M.gestisciMedia(p, UTENTE, fattoDi()));
    c("anche a interruttore spento un caricamento già partito si chiude (media_fatto non guarda l'interruttore)", ["pronta", false],
      [x.json?.esito, p.chiamate.some((k) => k[0] === "interruttore")]);
    c("nei log solo codici e contatori", true, logPulito(p.avvisi));
  }

  /* ═══ 6. LA LETTURA (GET) ═══════════════════════════════════════════════ */
  gruppo("PONTE · IMMAGINI · gestisciLettura (T5)");
  {
    const chiedi = (p, o = {}) => M.gestisciLettura(p, { adminUserId: UTENTE, id: ID, ...o });
    let p = porteFinte();
    let x = await chiedi(p);
    c("riga pronta dell'utente: 200 con l'URL firmato", [200, true], [x.stato, /^https:\/\/x\.supabase\.co\/storage\/v1\/object\/sign\/ponte-media\//.test(x.corpo.url)]);
    c("…ok e url, nient'altro (né percorso né numero)", ["ok", "url"], Object.keys(x.corpo).sort());
    c("…la riga si cerca per l'utente della sessione e l'identificativo (mai la chiave); la firma dura 300 secondi",
      [["percorsoPronto", UTENTE, ID], ["firmaLettura", PATH, 300]], p.chiamate.filter((k) => k[0] === "percorsoPronto" || k[0] === "firmaLettura"));

    p = porteFinte();
    x = await chiedi(p, { adminUserId: "" });
    c("sessione senza installazione: 403, niente database", [403, "non_autorizzato", []], [x.stato, x.corpo.motivo, p.chiamate.filter((k) => k[0] !== "utente")]);
    p = porteFinte();
    x = await chiedi(p, { adminUserId: ALTRO });
    c("installazione diversa da quella del database: 403, la riga non si cerca", [403, "non_autorizzato", []], [x.stato, x.corpo.motivo, p.chiamate.filter((k) => k[0] === "percorsoPronto")]);
    x = await chiedi(porteFinte({ utente: null }));
    c("database senza utente configurato: 403", 403, x.stato);
    for (const id of [null, undefined, "", CHIAVE, "bw:1:2", NOME_FILE.toUpperCase(), `${ID}\n`, `${UTENTE}/${ID}`, ID.replace(".png", ""), ID.replace(".png", ".svg"), 5, "x".repeat(500)]) {
      p = porteFinte();
      x = await chiedi(p, { id });
      c(`identificativo non valido (${String(id).slice(0, 12)}): 400, la riga non si cerca`, [400, "id_non_valido", []], [x.stato, x.corpo.motivo, p.chiamate.filter((k) => k[0] === "percorsoPronto")]);
    }
    p = porteFinte({ percorso: null });
    x = await chiedi(p);
    c("nessuna riga pronta (altro utente, in caricamento, assente): 404, nessuna firma", [404, "non_trovata", 0], [x.stato, x.corpo.motivo, p.chiamate.filter((k) => k[0] === "firmaLettura").length]);
    x = await chiedi(porteFinte({ firma: null }));
    c("l'oggetto non c'è in Storage (la firma fallisce): 404", [404, "non_trovata"], [x.stato, x.corpo.motivo]);
    for (const rompi of ["utente", "percorsoPronto", "firmaLettura"]) {
      p = porteFinte({ rompi, codice: "08006" });
      x = await chiedi(p);
      c(`guasto del database (${rompi}): 500 database`, [500, "database", true], [x.stato, x.corpo.motivo, logPulito(p.avvisi)]);
    }
    x = await chiedi(porteFinte({ rompi: "percorsoPronto", codice: "42P01" }));
    c("tabella assente: 503 migrazione", [503, "migrazione"], [x.stato, x.corpo.motivo]);
    //  Un guasto passeggero di Storage (rete, 5xx) NON è «la foto non c'è più»: 503, e la chat lascia Riprova.
    p = porteFinte({ rompi: "firmaLettura", codice: "storage" });
    x = await chiedi(p);
    c("Storage in errore (non «oggetto assente»): 503 storage, non 404", [503, "storage", true], [x.stato, x.corpo.motivo, logPulito(p.avvisi)]);
    c("…il log lo dice con un codice fisso", true, p.avvisi.some(([k]) => k === "media_storage"));
    c("«oggetto assente» (la porta risponde null) resta 404", 404, (await chiedi(porteFinte({ firma: null }))).stato);

    //  Che cosa è «oggetto assente» per Storage: solo lo stato 404 (anche nel corpo, con HTTP 400); tutto il resto è un guasto.
    c("oggettoAssente: 404 sì (status o statusCode, numero o testo)", [true, true, true, true], [{ status: 404 }, { statusCode: "404" }, { status: 400, statusCode: "404" }, { statusCode: 404 }].map(M.oggettoAssente));
    c("oggettoAssente: 400, 403, 429, 500, 503, rete, vuoto, testo no", [false, false, false, false, false, false, false, false, false, false], [
      { status: 400, statusCode: "400" }, { status: 403 }, { status: 429 }, { status: 500 }, { status: 503 }, new TypeError("fetch failed"), {}, null, undefined, "404"].map(M.oggettoAssente));
    c("oggettoAssente: un messaggio che contiene «404» non basta", false, M.oggettoAssente({ message: "Object not found 404", status: 500 }));
    c("percorsoDi: <utente>/<nome del file>, nient'altro", `${UTENTE}/${ID}`, M.percorsoDi(UTENTE, ID));
  }

  /* ═══ 7. I SORGENTI ═════════════════════════════════════════════════════ */
  gruppo("PONTE · IMMAGINI · SORGENTI (T5)");
  {
    for (const f of ["src/crm/ponte/media-tipi.ts", "src/crm/ponte/media.ts"]) {
      const t = senzaCommenti(sorgente(f));
      c(`${f}: puro (niente console, fetch, database, process.env)`, [false, false, false, false],
        [/console\./.test(t), /\bfetch\s*\(/.test(t), /supabase/i.test(t), /process\.env/.test(t)]);
    }
    const server = senzaCommenti(sorgente("src/crm/ponte/media.server.ts"));
    c("media.server: le funzioni SQL per nome, e nessun'altra", ["ponte_wa_media_fatto", "ponte_wa_media_permesso"],
      [...new Set([...server.matchAll(/\.rpc(?:<.*?>)?\(\s*"(\w+)"/g)].map((x) => x[1]))].sort());
    c("media.server: le sole tabelle sono app_config, manychat_config e ponte_wa_media", ["app_config", "manychat_config", "ponte_wa_media"],
      [...new Set([...server.matchAll(/\.from\(\s*"(\w+)"/g)].map((x) => x[1]))].sort());
    c("media.server: la chiave di servizio col cast, mai il messaggio d'errore, niente fetch", [true, false, false],
      [server.includes("supabaseAdmin as unknown as") || server.includes("supabaseAdmin.storage"), /\.message\b/.test(server), /\bfetch\s*\(/.test(server)]);
    c("media.server: la riga si cerca per utente e percorso `<utente>/<id>` (mai per chiave); Storage assente = 404, il resto lancia", [true, true, true, false],
      [/percorsoDi\(userId, id\)/.test(server), /oggettoAssente\(error\)/.test(server), /code: "storage"/.test(server), /\.eq\("chiave"/.test(server)]);
    c("media.server: nessuna scrittura diretta (il database si scrive solo con le due funzioni)", false, /\.(insert|update|upsert|delete)\(/.test(server));
    c("media.server: il bucket è quello di T4 e non si sceglie dal corpo", true, server.includes("BUCKET_MEDIA"));
    const ingresso = senzaCommenti(sorgente("src/crm/ponte/ingresso.ts"));
    c("ingresso.ts: i rami media solo con la porta `media`", true, /!!i\.media\s*&&/.test(ingresso));
    c("ingresso.ts: l'utente resta quello di porte.utente(), il corpo non lo sceglie mai", true, /gestisciMedia\(i\.media!?,\s*userId,/.test(ingresso));
    c("media.ts: l'utente non si legge mai dal corpo", false, /json\.(user_id|userId|utente)\b/.test(senzaCommenti(sorgente("src/crm/ponte/media.ts"))));
  }
}
