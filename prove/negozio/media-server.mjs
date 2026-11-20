/** ── NEGOZIO · T09 · I PERMESSI DI CARICAMENTO ─────────────────────────────
 *  `src/crm/negozio/media.server.ts`: `POST /api/crm/negozio-media {tipo, mime, peso}` → permesso firmato per UN file nel
 *  bucket `shop-media`. Percorso sorteggiato (12 segni da `crypto.getRandomValues`), mai il nome del file né l'id del
 *  prodotto; mime e peso controllati; il modulo non legge né scrive il database (nessuna lettura di bozze). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { porte, post, leggi, guardiaNo } from "./_server.mjs";

const MB = 1024 * 1024;
const TOKEN = "TOKEN-SEGRETO-DI-PROVA";
const uuidProdotto = "00000000-0000-4000-8000-000000000200";

export async function prove(mod, { c, gruppo, radice }) {
  const M = mod["negozio/media.server"];
  gruppo("NEGOZIO · I PERMESSI DI CARICAMENTO (20/11/2026)");
  const chiamate = [];
  const storageOk = { creaPermesso: async (bucket, path) => { chiamate.push([bucket, path]); return { token: TOKEN, url: `https://storage.test/${bucket}/${path}?token=${TOKEN}` }; } };
  const esegui = async (corpo, opz = {}) => {
    const p = porte({ storage: opz.storage ?? storageOk, ...opz.porte });
    return { log: p.log, ...(await leggi(await M.gestisciPOST(post(corpo), p.d))) };
  };
  const foto = (extra = {}) => ({ tipo: "foto", mime: "image/webp", peso: 2 * MB, ...extra });

  // ── la guardia ──
  for (const stato of [401, 403]) {
    chiamate.length = 0;
    const r = await esegui(foto(), { porte: { guardia: guardiaNo(stato) } });
    c(`guardia negata (${stato}): nessun permesso firmato, zero log`, [stato, 0, 0], [r.stato, chiamate.length, r.log.length]);
  }

  // ── il caso che va bene ──
  chiamate.length = 0;
  const a = await esegui(foto());
  c("foto webp da 2 MB → ok, bucket shop-media, percorso, token e indirizzo", [200, true, "shop-media", true, TOKEN, true], [a.stato, a.corpo.ok, a.corpo.bucket, typeof a.corpo.path === "string", a.corpo.token, typeof a.corpo.url === "string"]);
  c("…il percorso è «foto/» + 12 segni sorteggiati + estensione del tipo", true, /^foto\/[a-z2-7]{12}\.webp$/.test(a.corpo.path));
  c("…il permesso è stato chiesto allo Storage per quel bucket e quel percorso, una volta sola", [[["shop-media", a.corpo.path]]], [chiamate]);
  const tipi = [["foto", "image/jpeg", "foto", "jpg"], ["foto", "image/png", "foto", "png"], ["foto", "image/avif", "foto", "avif"], ["video", "video/mp4", "video", "mp4"], ["video", "video/quicktime", "video", "mov"], ["copertina", "image/jpeg", "copertina", "jpg"], ["copertina", "image/webp", "copertina", "webp"]];
  for (const [tipo, mime, cartella, ext] of tipi) {
    const r = await esegui({ tipo, mime, peso: 1000 });
    c(`${tipo} ${mime} → ok, ${cartella}/…​.${ext}`, true, new RegExp(`^${cartella}/[a-z2-7]{12}\\.${ext}$`).test(r.corpo.path ?? ""));
  }

  // ── mime e peso ──
  for (const [nome, corpo] of [
    ["PDF", foto({ mime: "application/pdf" })], ["SVG (può contenere script)", foto({ mime: "image/svg+xml" })], ["GIF", foto({ mime: "image/gif" })], ["HEIC (si converte nel browser)", foto({ mime: "image/heic" })],
    ["mime con maiuscole storte", foto({ mime: "IMAGE/WEBP " })], ["mime vuoto", foto({ mime: "" })], ["mime non testo", foto({ mime: 5 })],
    ["foto con un mime di video", foto({ mime: "video/mp4" })], ["video con un mime di foto", { tipo: "video", mime: "image/jpeg", peso: 1000 }], ["copertina con un video", { tipo: "copertina", mime: "video/mp4", peso: 1000 }],
    ["tipo sconosciuto", foto({ tipo: "documento" })], ["tipo «constructor»", foto({ tipo: "constructor" })], ["tipo «toString»", foto({ tipo: "toString" })], ["mime «constructor»", foto({ mime: "constructor" })], ["mime «__proto__»", foto({ mime: "__proto__" })], ["tipo mancante", { mime: "image/jpeg", peso: 1000 }],
    ["foto da 11 MB", foto({ peso: 11 * MB })], ["video da 26 MB", { tipo: "video", mime: "video/mp4", peso: 26 * MB }], ["copertina da 11 MB", { tipo: "copertina", mime: "image/jpeg", peso: 11 * MB }],
    ["peso zero", foto({ peso: 0 })], ["peso negativo", foto({ peso: -5 })], ["peso decimale", foto({ peso: 1.5 })], ["peso in testo", foto({ peso: "1000" })], ["peso mancante", { tipo: "foto", mime: "image/jpeg" }], ["peso infinito", foto({ peso: 1e999 })],
  ]) {
    chiamate.length = 0;
    const r = await esegui(corpo);
    c(`${nome} → rifiutato (400) con la frase, nessun permesso firmato`, [400, false, true, 0], [r.stato, r.corpo.ok, typeof r.corpo.frase === "string" && r.corpo.frase.length > 10, chiamate.length]);
  }
  c("foto da 10 MB esatti → ok; video da 25 MB esatti → ok", [200, 200], [(await esegui(foto({ peso: 10 * MB }))).stato, (await esegui({ tipo: "video", mime: "video/quicktime", peso: 25 * MB })).stato]);
  const f26 = await esegui({ tipo: "video", mime: "video/mp4", peso: 26 * MB });
  c("…la frase del video troppo pesante dice il limite", true, /25 MB/.test(f26.corpo.frase));

  // ── il percorso ──
  const intrusi = await esegui(foto({ nome: "capelli-di-mario-rossi.jpg", filename: "IMG_0001.HEIC", prodottoId: uuidProdotto, sku: "PROVA-001", path: "../../altro" }));
  c("il nome del file, l'id del prodotto, lo SKU e un percorso suggerito dal client NON compaiono nel percorso", [false, false, false, false, false], [/capelli|mario|IMG_|HEIC/i.test(intrusi.corpo.path), intrusi.corpo.path.includes(uuidProdotto), /PROVA|000200/.test(intrusi.corpo.path), intrusi.corpo.path.includes(".."), intrusi.corpo.path.includes("altro")]);
  c("due percorsi consecutivi sono diversi", true, (await esegui(foto())).corpo.path !== (await esegui(foto())).corpo.path);
  const cento = new Set();
  for (let i = 0; i < 300; i++) cento.add((await esegui(foto())).corpo.path);
  c("300 permessi: 300 percorsi diversi", 300, cento.size);
  const fisso = await esegui(foto(), { porte: { caso: (n) => Uint8Array.from({ length: n }, (_, i) => i) } });
  c("il sorteggio passa dalla porta `caso` (byte casuali): byte 0..11 → alfabeto base32 senza spigoli", "foto/abcdefghijkl.webp", fisso.corpo.path);
  const alti = await esegui(foto(), { porte: { caso: (n) => Uint8Array.from({ length: n }, () => 255) } });
  c("…byte 255 → ultimo segno dell'alfabeto, sempre 12 segni", "foto/777777777777.webp", alti.corpo.path);

  // ── il token, i guasti, i log ──
  const rotto = await esegui(foto(), { storage: { creaPermesso: async () => { throw new Error(`Storage giù ${TOKEN}`); } } });
  c("lo Storage non risponde (eccezione) → 500 generico, nel log solo un codice", [500, false, ["permesso eccezione"], false], [rotto.stato, rotto.corpo.ok, rotto.log, JSON.stringify([rotto.corpo, rotto.log]).includes(TOKEN)]);
  const senzaToken = await esegui(foto(), { storage: { creaPermesso: async () => ({ token: "", url: "" }) } });
  c("lo Storage risponde senza token → 500, non si restituisce un permesso vuoto", [500, false], [senzaToken.stato, senzaToken.corpo.ok]);
  const log = await esegui(foto());
  c("a buon fine: nessun log, e il token compare solo nella risposta", [0, true], [log.log.length, JSON.stringify(log.corpo).includes(TOKEN)]);
  for (const [nome, corpo] of [["JSON rotto", "{no"], ["lista", "[1]"]]) {
    chiamate.length = 0;
    const r = await esegui(corpo);
    c(`corpo storto (${nome}) → 400, nessun permesso`, [400, 0], [r.stato, chiamate.length]);
  }

  // ── il sorgente ──
  const sorg = readFileSync(join(radice, "src/crm/negozio/media.server.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("il sorteggio usa crypto.getRandomValues e mai Math.random", [true, false], [sorg.includes("getRandomValues"), sorg.includes("Math.random")]);
  c("il bucket è shop-media", true, sorg.includes('"shop-media"'));
  c("nessuna lettura di bozze né accesso al database: niente chiamate al database né porta db, nessun permesso di lettura firmato", [], ['.from("', ".rpc(", ".select(", "d.db", "createSignedUrl", "download("].filter((t) => sorg.includes(t)));
}
