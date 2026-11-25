/** ── NEGOZIO · RILASCIO 2 · T48 · IL PERMESSO DELLA CASSA E L'ANTI-SPAM ──────────────────────────────
 *  `src/shop/cassa/permesso-cassa.ts` e `src/shop/cassa/anti-spam.ts` (D49):
 *   · il permesso porta l'ISTANTE DI EMISSIONE dentro il token firmato (HMAC con la chiave derivata dall'etichetta `hgl-cassa-v1`):
 *     il tempo minimo lo legge il server dal token, non lo dichiara il client; meno di 3 s → troppo presto, oltre 30 min → scaduto;
 *   · un permesso degli eventi (R1) non vale per la cassa e uno della cassa non vale per gli eventi;
 *   · `improntaIndirizzo(ip, sale)`: l'indirizzo non sta mai in chiaro; `trappolaPiena(corpo)`: il campo `sito_web` deve restare vuoto;
 *   · finestre e massimi (10 ordini/ora, 10 riprove/ora, 120 letture/ora, 30 permessi/ora) in costanti per `shop_limite_consuma`.
 *  I vettori li calcola la prova con `node:crypto`. Nessuna chiave vera, nessun indirizzo vero (203.0.113.x è riservato alla documentazione). */
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SERVIZIO = "chiave-di-servizio-di-prova-non-vera";
const T0 = 1_700_000_000_000;
const kCassa = (servizio) => createHmac("sha256", servizio).update("hgl-cassa-v1").digest("hex");
const firma = (servizio, emesso) =>
  createHmac("sha256", kCassa(servizio)).update(String(emesso)).digest("hex");
const sha = (t) => createHash("sha256").update(t).digest("hex");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T48 · IL PERMESSO DELLA CASSA E L'ANTI-SPAM (21/11/2026)");
  const C = mod["shop/cassa/permesso-cassa"];
  const A = mod["shop/cassa/anti-spam"];
  c("il modulo src/shop/cassa/permesso-cassa.ts esiste", true, !!C);
  c("il modulo src/shop/cassa/anti-spam.ts esiste", true, !!A);
  if (!C || !A) return;
  const { emettiPermessoCassa, verificaPermessoCassa } = C;
  const SEC = 1000;
  const MIN = 60 * SEC;

  // ── il token ──
  const t = await emettiPermessoCassa(SERVIZIO, T0);
  c(
    "forma: «<istante in ms>.<firma esadecimale di 64 segni>»",
    true,
    /^\d{1,16}\.[0-9a-f]{64}$/.test(t),
  );
  c("l'istante di emissione sta DENTRO il token", String(T0), t.split(".")[0]);
  c(
    "la firma è HMAC-SHA256 con la chiave derivata da «hgl-cassa-v1» (vettore da node:crypto)",
    firma(SERVIZIO, T0),
    t.split(".")[1],
  );
  c(
    "due istanti diversi → due permessi diversi",
    false,
    t === (await emettiPermessoCassa(SERVIZIO, T0 + 1)),
  );
  c(
    "l'istante si arrotonda per difetto (1700000000000,9 → 1700000000000)",
    t,
    await emettiPermessoCassa(SERVIZIO, T0 + 0.9),
  );
  c("il token non contiene la chiave di servizio", false, t.includes(SERVIZIO));
  for (const [nome, k] of [
    ["vuota", ""],
    ["mancante", undefined],
    ["non testo", 3],
  ]) {
    let lanciata = false;
    try {
      await emettiPermessoCassa(k, T0);
    } catch {
      lanciata = true;
    }
    c(`chiave di servizio ${nome} → emettere lancia (il Worker risponde 503)`, true, lanciata);
  }
  let nonNumero = false;
  try {
    await emettiPermessoCassa(SERVIZIO, NaN);
  } catch {
    nonNumero = true;
  }
  c("istante non numerico → lancia", true, nonNumero);

  // ── l'età: 3 secondi minimo, 30 minuti massimo ──
  const verifica = (adesso, ...resto) => verificaPermessoCassa(t, SERVIZIO, adesso, ...resto);
  c(
    "emesso 2 s fa → rifiutato: troppo presto",
    { ok: false, motivo: "troppo_presto" },
    await verifica(T0 + 2 * SEC),
  );
  c(
    "emesso 2,999 s fa → ancora troppo presto",
    { ok: false, motivo: "troppo_presto" },
    await verifica(T0 + 2999),
  );
  c(
    "emesso 0 s fa (subito) → troppo presto",
    { ok: false, motivo: "troppo_presto" },
    await verifica(T0),
  );
  c("emesso esattamente 3 s fa → ok", { ok: true }, await verifica(T0 + 3 * SEC));
  c("emesso 4 s fa → ok", { ok: true }, await verifica(T0 + 4 * SEC));
  c("emesso 10 minuti fa → ok", { ok: true }, await verifica(T0 + 10 * MIN));
  c("emesso esattamente 30 minuti fa → ok", { ok: true }, await verifica(T0 + 30 * MIN));
  c(
    "emesso 30 minuti e 1 ms fa → scaduto",
    { ok: false, motivo: "scaduto" },
    await verifica(T0 + 30 * MIN + 1),
  );
  c(
    "emesso 31 minuti fa → scaduto",
    { ok: false, motivo: "scaduto" },
    await verifica(T0 + 31 * MIN),
  );
  c(
    "emesso nel futuro (orologi sfasati) → troppo presto, mai ok",
    { ok: false, motivo: "troppo_presto" },
    await verifica(T0 - 5 * SEC),
  );
  c(
    "il minimo e il massimo si possono cambiare: minimo 10 s → a 4 s troppo presto",
    { ok: false, motivo: "troppo_presto" },
    await verifica(T0 + 4 * SEC, 10 * SEC),
  );
  c(
    "…massimo 1 minuto → a 2 minuti scaduto",
    { ok: false, motivo: "scaduto" },
    await verifica(T0 + 2 * MIN, 3 * SEC, MIN),
  );
  c(
    "i valori di partenza sono 3 s e 30 minuti",
    [3000, 1_800_000],
    [C.ETA_MINIMA_MS, C.ETA_MASSIMA_MS],
  );

  // ── alterazioni ──
  const [emesso, sig] = t.split(".");
  const adesso = T0 + 10 * SEC;
  const nonValido = { ok: false, motivo: "non_valido" };
  c(
    "firma alterata di un segno → non valido",
    nonValido,
    await verificaPermessoCassa(
      `${emesso}.${sig.slice(0, 63)}${sig[63] === "a" ? "b" : "a"}`,
      SERVIZIO,
      adesso,
    ),
  );
  c(
    "istante cambiato (più vecchio, per saltare il minimo) con la firma di prima → non valido",
    nonValido,
    await verificaPermessoCassa(`${T0 - 60 * SEC}.${sig}`, SERVIZIO, adesso),
  );
  c(
    "istante cambiato (più nuovo, per allungare la vita) → non valido",
    nonValido,
    await verificaPermessoCassa(`${T0 + 9 * SEC}.${sig}`, SERVIZIO, T0 + 20 * MIN + 10 * SEC),
  );
  c(
    "firmato con un'altra chiave di servizio → non valido",
    nonValido,
    await verificaPermessoCassa(await emettiPermessoCassa(SERVIZIO + "x", T0), SERVIZIO, adesso),
  );
  c(
    "verificato con un'altra chiave di servizio → non valido",
    nonValido,
    await verificaPermessoCassa(t, SERVIZIO + "x", adesso),
  );
  for (const [nome, x] of [
    ["vuoto", ""],
    ["senza punto", emesso + sig],
    ["con tre parti", `${t}.00`],
    ["firma maiuscola", `${emesso}.${sig.toUpperCase()}`],
    ["firma corta", `${emesso}.${sig.slice(0, 63)}`],
    ["istante non numerico", `abc.${sig}`],
    ["istante di 17 cifre", `${"1".repeat(17)}.${sig}`],
    ["istante con segno", `-${emesso}.${sig}`],
    ["null", null],
    ["undefined", undefined],
    ["un numero", 5],
    ["un oggetto", { t }],
    ["un elenco", [t]],
  ])
    c(
      `token ${nome} → non valido, senza eccezione`,
      nonValido,
      await verificaPermessoCassa(x, SERVIZIO, adesso),
    );
  for (const [nome, k] of [
    ["vuota", ""],
    ["mancante", undefined],
    ["non testo", null],
  ])
    c(
      `chiave di servizio ${nome} → verificare dà non valido, senza eccezione`,
      nonValido,
      await verificaPermessoCassa(t, k, adesso),
    );
  for (const [nome, a] of [
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["testo", "1"],
    ["undefined", undefined],
    ["null", null],
  ])
    c(
      `«adesso» ${nome} → non valido, mai ok`,
      nonValido,
      await verificaPermessoCassa(t, SERVIZIO, a),
    );

  // ── i permessi degli eventi e della cassa non si scambiano ──
  const P = mod["lib/tracciamento/permesso"];
  if (P) {
    const chiaveEventi = await P.derivaChiave(SERVIZIO);
    const degliEventi = await P.emettiPermesso(chiaveEventi, T0);
    // L'orario è scelto perché il TEMPO vada bene a entrambi: a rifiutare deve essere solo la firma.
    c(
      "(controllo) il permesso degli eventi è valido per gli eventi, a quell'ora",
      true,
      await P.verificaPermesso(degliEventi, chiaveEventi, T0 - SEC),
    );
    c(
      "un permesso degli eventi (R1) NON vale per la cassa",
      nonValido,
      await verificaPermessoCassa(degliEventi, SERVIZIO, T0 + 20 * MIN),
    );
    const dellaCassa = await emettiPermessoCassa(SERVIZIO, T0 + 10 * MIN);
    c(
      "(controllo) il permesso della cassa è valido per la cassa, a quell'ora",
      { ok: true },
      await verificaPermessoCassa(dellaCassa, SERVIZIO, T0 + 20 * MIN),
    );
    c(
      "un permesso della cassa NON vale per gli eventi (R1)",
      false,
      await P.verificaPermesso(dellaCassa, chiaveEventi, T0),
    );
  }

  // ── il sorgente ──
  const lettura = (f) =>
    readFileSync(join(radice, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  const sCassa = lettura("src/shop/cassa/permesso-cassa.ts");
  c(
    "permesso-cassa usa hmacHex di R1 (non una copia) e il confronto a tempo costante",
    true,
    /hmacHex/.test(sCassa) &&
      /ugualiATempoCostante/.test(sCassa) &&
      /from\s+"@\/lib\/tracciamento\/permesso"/.test(sCassa),
  );
  c(
    "nessun === o !== fra la firma ricevuta e quella attesa",
    false,
    /(?:firma|sig|atteso|attesa)\w*\s*[!=]==?\s*\w/.test(sCassa.replace(/typeof [^;)]*/g, "")),
  );
  c(
    "permesso-cassa: nessun console.*, nessun Math.random",
    false,
    /console\.|Math\.random/.test(sCassa),
  );
  c(
    "il file di R1 non è stato toccato (nessuna esportazione nuova in permesso.ts)",
    false,
    /ugualiATempoCostante|hgl-cassa/.test(
      readFileSync(join(radice, "src/lib/tracciamento/permesso.ts"), "utf8"),
    ),
  );

  // ── anti-spam: l'impronta dell'indirizzo ──
  const SALE = "sale-di-prova";
  const IP = "203.0.113.7";
  const h = await A.improntaIndirizzo(IP, SALE);
  c("l'impronta è esadecimale di 64 segni", true, /^[0-9a-f]{64}$/.test(h));
  c(
    "l'indirizzo non compare in chiaro (né a pezzi) nell'impronta",
    false,
    h.includes(IP) || h.includes("203.0.113") || h.includes(IP.replaceAll(".", "")),
  );
  c("stesso indirizzo e stesso sale → stessa impronta", h, await A.improntaIndirizzo(IP, SALE));
  c(
    "due indirizzi diversi → impronte diverse",
    false,
    h === (await A.improntaIndirizzo("203.0.113.8", SALE)),
  );
  c(
    "lo stesso indirizzo con un altro sale → impronta diversa (il sale conta)",
    false,
    h === (await A.improntaIndirizzo(IP, SALE + "x")),
  );
  c(
    "non è l'impronta nuda dell'indirizzo (senza sale non si ricava per tentativi)",
    false,
    h === sha(IP),
  );
  const v6 = await A.improntaIndirizzo("2001:db8::1", SALE);
  c(
    "un indirizzo IPv6 funziona e non compare in chiaro",
    [true, false],
    [/^[0-9a-f]{64}$/.test(v6), v6.includes("2001:db8")],
  );
  const ignoto = await A.improntaIndirizzo(null, SALE);
  c(
    "indirizzo mancante (null, vuoto, non testo) → un'unica impronta «sconosciuto», mai un errore",
    [true, ignoto, ignoto, ignoto],
    [
      /^[0-9a-f]{64}$/.test(ignoto),
      await A.improntaIndirizzo("", SALE),
      await A.improntaIndirizzo(undefined, SALE),
      await A.improntaIndirizzo(42, SALE),
    ],
  );
  for (const [nome, s] of [
    ["vuoto", ""],
    ["mancante", undefined],
    ["non testo", 7],
  ]) {
    let lanciata = false;
    try {
      await A.improntaIndirizzo(IP, s);
    } catch {
      lanciata = true;
    }
    c(`sale ${nome} → lancia (senza sale l'impronta di un IPv4 si indovina)`, true, lanciata);
  }
  const sale = await A.saleLimiti(SERVIZIO);
  c(
    "il sale dei limiti si deriva dalla chiave di servizio con la sua etichetta, e non è altra chiave",
    [true, false, false],
    [/^[0-9a-f]{64}$/.test(sale), sale === kCassa(SERVIZIO), sale === SERVIZIO],
  );
  let senzaChiave = false;
  try {
    await A.saleLimiti("");
  } catch {
    senzaChiave = true;
  }
  c("senza chiave di servizio il sale non si fa (lancia)", true, senzaChiave);

  // ── la trappola ──
  c(
    "`sito_web` vuoto o assente → la trappola è vuota",
    [false, false, false, false, false],
    [
      A.trappolaPiena({ sito_web: "" }),
      A.trappolaPiena({}),
      A.trappolaPiena({ sito_web: null }),
      A.trappolaPiena({ sito_web: undefined }),
      A.trappolaPiena({ sito_web: "   " }),
    ],
  );
  c(
    "`sito_web` compilato → trappola piena (testo, numero, vero, oggetto, elenco)",
    [true, true, true, true, true, true],
    ["http://spam.example", "x", 0, true, { a: 1 }, ["x"]].map((v) =>
      A.trappolaPiena({ sito_web: v }),
    ),
  );
  c(
    "corpo che non è un oggetto → trappola vuota (ci pensa la validazione)",
    [false, false, false, false],
    [null, undefined, "x", 5].map((x) => A.trappolaPiena(x)),
  );
  c(
    "il nome del campo è esattamente sito_web: «Sito_web», «sito-web», «website» non contano",
    [false, false, false],
    [
      A.trappolaPiena({ Sito_web: "x" }),
      A.trappolaPiena({ "sito-web": "x" }),
      A.trappolaPiena({ website: "x" }),
    ],
  );

  // ── i limiti (D49) ──
  c(
    "limiti: 10 ordini/ora, 10 riprove/ora, 120 letture/ora, 30 permessi/ora",
    { ordine: [3600, 10], riprova: [3600, 10], lettura: [3600, 120], permesso: [3600, 30] },
    Object.fromEntries(Object.entries(A.LIMITI ?? {}).map(([k, v]) => [k, [v.finestraS, v.max]])),
  );
  c(
    "i valori sono interi positivi (la funzione SQL rifiuta il resto)",
    true,
    Object.values(A.LIMITI ?? {}).every(
      (v) =>
        Number.isSafeInteger(v.finestraS) &&
        v.finestraS > 0 &&
        Number.isSafeInteger(v.max) &&
        v.max > 0,
    ),
  );
  c(
    "chiaveLimite: «uso:impronta», chiavi separate per uso (D49)",
    [`ordine:${h}`, `permesso:${h}`, false],
    [
      A.chiaveLimite("ordine", h),
      A.chiaveLimite("permesso", h),
      A.chiaveLimite("ordine", h) === A.chiaveLimite("riprova", h),
    ],
  );
  for (const [nome, uso, imp] of [
    ["uso sconosciuto", "pagina", h],
    ["impronta vuota", "ordine", ""],
    ["impronta non esadecimale", "ordine", "203.0.113.7"],
    ["uso non testo", 5, h],
  ]) {
    let lanciata = false;
    try {
      A.chiaveLimite(uso, imp);
    } catch {
      lanciata = true;
    }
    c(`chiaveLimite con ${nome} → lancia`, true, lanciata);
  }
  const sAnti = lettura("src/shop/cassa/anti-spam.ts");
  c(
    "anti-spam: nessun console.* (nessun indirizzo nei log), nessun Math.random, nessuna memoria condivisa per i limiti",
    false,
    /console\.|Math\.random|new Map\(|new Set\(/.test(sAnti),
  );
}
