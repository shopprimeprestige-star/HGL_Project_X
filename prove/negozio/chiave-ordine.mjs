/** ── NEGOZIO · RILASCIO 2 · T48 · LA CHIAVE DELLA PAGINA ORDINE E IL RIFERIMENTO ──────────────────────
 *  `src/shop/cassa/chiave-ordine.ts` (D48, SPEC 8A n. 5):
 *   · `chiaveOrdine(chiaveServizio, ordineId)` = base64url(HMAC-SHA256(k_ordine, id)), con `k_ordine = hmacHex(chiaveServizio, "hgl-ordine-v1")`:
 *     stessa coppia → stessa chiave (l'email di conferma la RICALCOLA), ordine o chiave di servizio diversi → chiave diversa;
 *   · su `shop_orders` si salva solo `impronta(chiave)` (SHA-256); `verificaChiave(chiave, hash)` confronta a TEMPO COSTANTE
 *     e, se l'ordine non c'è (hash vuoto o storto), fa lo stesso un confronto fittizio: il tempo non dice se l'ordine esiste;
 *   · `nuovoRef(random)`: «HG-» e sei segni dell'alfabeto di Crockford (senza I, L, O, U); `refValido`;
 *   · le tre etichette (`hgl-eventi-v1`, `hgl-ordine-v1`, `hgl-cassa-v1`) danno chiavi diverse dalla stessa chiave di servizio.
 *  I vettori li calcola la prova con `node:crypto`, scritti per conto loro: nessuna chiave vera. */
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SERVIZIO = "chiave-di-servizio-di-prova-non-vera";
const ID = "00000000-0000-4000-8000-0000000000aa";
const kOrdine = (servizio) => createHmac("sha256", servizio).update("hgl-ordine-v1").digest("hex");
const attesa = (servizio, id) => createHmac("sha256", kOrdine(servizio)).update(id).digest("base64url");
const sha = (t) => createHash("sha256").update(t).digest("hex");
const cambiaUnSegno = (t) => t.slice(0, 10) + (t[10] === "a" ? "b" : "a") + t.slice(11);

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T48 · LA CHIAVE DELLA PAGINA ORDINE (21/11/2026)");
  const K = mod["shop/cassa/chiave-ordine"];
  c("il modulo src/shop/cassa/chiave-ordine.ts esiste", true, !!K);
  if (!K) return;
  const { chiaveOrdine, impronta, verificaChiave, nuovoRef, refValido, ugualiATempoCostante } = K;

  // ── la chiave ──
  const k1 = await chiaveOrdine(SERVIZIO, ID);
  c("la chiave è quella del contratto: HMAC con k_ordine, in base64url (vettore da node:crypto)", attesa(SERVIZIO, ID), k1);
  c("…43 segni da indirizzo, senza «=», «+», «/»", true, /^[A-Za-z0-9_-]{43}$/.test(k1));
  c("stessa coppia → stessa chiave (l'email la ricalcola)", k1, await chiaveOrdine(SERVIZIO, ID));
  c("ordine diverso → chiave diversa", false, k1 === (await chiaveOrdine(SERVIZIO, "00000000-0000-4000-8000-0000000000ab")));
  c("chiave di servizio diversa → chiave diversa", false, k1 === (await chiaveOrdine(SERVIZIO + "x", ID)));
  c("la chiave non contiene l'id dell'ordine né la chiave di servizio", false, k1.includes(ID) || k1.includes(SERVIZIO));
  for (const [nome, s, i] of [["chiave di servizio vuota", "", ID], ["chiave di servizio mancante", undefined, ID], ["chiave di servizio non testo", 5, ID], ["id vuoto", SERVIZIO, ""], ["id non testo", SERVIZIO, null]]) {
    let lanciata = false;
    try { await chiaveOrdine(s, i); } catch { lanciata = true; }
    c(`${nome} → lancia (mai una chiave debole)`, true, lanciata);
  }

  // ── le tre etichette ──
  const P = mod["lib/tracciamento/permesso"];
  const C = mod["shop/cassa/permesso-cassa"];
  c("l'etichetta dei permessi di R1 è ancora «hgl-eventi-v1»", "hgl-eventi-v1", P?.ETICHETTA_CHIAVE);
  c("le etichette della cassa sono «hgl-ordine-v1» e «hgl-cassa-v1»", ["hgl-ordine-v1", "hgl-cassa-v1"], [K.ETICHETTA_ORDINE, C?.ETICHETTA_CASSA]);
  if (P && C) {
    const derivate = await Promise.all([P.ETICHETTA_CHIAVE, K.ETICHETTA_ORDINE, C.ETICHETTA_CASSA].map((e) => P.hmacHex(SERVIZIO, e)));
    c("le tre etichette danno tre chiavi DIVERSE dalla stessa chiave di servizio", 3, new Set(derivate).size);
    c("…e nessuna è la chiave di servizio stessa", false, derivate.includes(SERVIZIO));
  }

  // ── l'impronta e il confronto ──
  const h = await impronta(k1);
  c("l'impronta è lo SHA-256 della chiave, in esadecimale (vettore da node:crypto)", sha(k1), h);
  c("…e non contiene la chiave", false, h.includes(k1));
  c("verificaChiave: la chiave giusta con la sua impronta → vero", true, await verificaChiave(k1, h));
  c("una chiave con un segno cambiato → falso", false, await verificaChiave(cambiaUnSegno(k1), h));
  c("l'impronta alterata di un segno → falso", false, await verificaChiave(k1, cambiaUnSegno(h)));
  c("la chiave di un altro ordine → falso", false, await verificaChiave(await chiaveOrdine(SERVIZIO, "00000000-0000-4000-8000-0000000000ab"), h));
  c("la chiave tagliata, allungata o vuota → falso", [false, false, false], [await verificaChiave(k1.slice(0, 42), h), await verificaChiave(k1 + "a", h), await verificaChiave("", h)]);
  for (const [nome, x] of [["null", null], ["undefined", undefined], ["un numero", 5], ["un oggetto", {}], ["un elenco", [k1]]]) c(`chiave ${nome} → falso, senza eccezione`, false, await verificaChiave(x, h));
  // ordine che non esiste: nessuna impronta (null, vuota, storta): falso, e senza eccezioni
  for (const [nome, x] of [["null", null], ["undefined", undefined], ["vuota", ""], ["troppo corta", "abc"], ["non esadecimale", "z".repeat(64)], ["maiuscola", h.toUpperCase()], ["un numero", 7]]) c(`ordine inesistente (impronta ${nome}) → falso`, false, await verificaChiave(k1, x));

  // ── confronto fittizio: con l'ordine inesistente si fa comunque il lavoro dell'impronta ──
  const sub = globalThis.crypto.subtle;
  const originale = sub.digest.bind(sub);
  let chiamate = 0;
  sub.digest = (...a) => { chiamate++; return originale(...a); };
  try {
    await verificaChiave(k1, h);
    const conOrdine = chiamate;
    chiamate = 0;
    await verificaChiave(k1, null);
    c("con l'ordine inesistente calcola comunque l'impronta (il confronto fittizio c'è)", [true, conOrdine], [chiamate >= 1, chiamate]);
    chiamate = 0;
    await verificaChiave("storta", null);
    c("…anche se la chiave è storta (nessuna uscita anticipata)", conOrdine, chiamate);
  } finally {
    sub.digest = originale;
  }
  const src = readFileSync(join(radice, "src/shop/cassa/chiave-ordine.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const corpoVerifica = /function verificaChiave[\s\S]*?\n}\n/.exec(src)?.[0] ?? "";
  c("verificaChiave ha un corpo da leggere", true, corpoVerifica.length > 40);
  c("il sorgente di verificaChiave usa ugualiATempoCostante e non confronta con === o !== le impronte", [true, false], [/ugualiATempoCostante\(/.test(corpoVerifica), /(?:atteso|hash|h)\s*[!=]==?\s*\w|\w\s*[!=]==?\s*(?:atteso|hash)\b/.test(corpoVerifica.replace(/typeof [^;)]*/g, ""))]);
  c("il sorgente ha un impronta fittizia per l'ordine inesistente (FITTIZIA)", true, /FITTIZI/.test(src));
  c("nessun console.* nel modulo (nessun dato nei log)", false, /console\./.test(src));
  c("nessun Math.random: il riferimento e la chiave non sono prevedibili", false, /Math\.random/.test(src));

  // ── ugualiATempoCostante ──
  c("ugualiATempoCostante: uguali → vero; diverse, di lunghezza diversa, non testo → falso", [true, false, false, false, false, true], [
    ugualiATempoCostante("abc", "abc"), ugualiATempoCostante("abc", "abd"), ugualiATempoCostante("abc", "ab"), ugualiATempoCostante("ab", "abc"), ugualiATempoCostante(1, 1), ugualiATempoCostante("", ""),
  ]);

  // ── il riferimento ──
  const bytes = (...b) => () => Uint8Array.from(b);
  const casuale = (b) => (n) => Uint8Array.from({ length: n }, (_, i) => b[i % b.length]);
  c("sei zeri → HG-000000", "HG-000000", nuovoRef(casuale([0])));
  c("byte 0, 1, 10, 31, 17, 30 → HG-01AZHY (alfabeto di Crockford: 10=A, 17=H, 30=Y, 31=Z)", "HG-01AZHY", nuovoRef(() => Uint8Array.from([0, 1, 10, 31, 17, 30])));
  c("si usano i 5 bit bassi: 35 (= 32 + 3) → 3, 255 → Z", ["HG-333333", "HG-ZZZZZZ"], [nuovoRef(casuale([35])), nuovoRef(casuale([255]))]);
  c("l'alfabeto non ha I, L, O, U (tutti i 32 valori)", [], (() => { const visti = []; for (let i = 0; i < 32; i++) visti.push(nuovoRef(casuale([i])).slice(3, 4)); return visti.filter((s) => /[ILOU]/.test(s)); })());
  c("…e i 32 segni sono tutti diversi", 32, new Set(Array.from({ length: 32 }, (_, i) => nuovoRef(casuale([i])).slice(3, 4))).size);
  let corta = false;
  try { nuovoRef(bytes(1, 2)); } catch { corta = true; }
  c("un generatore che dà meno di 6 byte → lancia (mai un riferimento corto)", true, corta);
  const veri = Array.from({ length: 20 }, () => nuovoRef());
  c("con il generatore vero i riferimenti sono validi e diversi fra loro (20 su 20)", [true, 20], [veri.every(refValido), new Set(veri).size]);
  c("refValido: HG-01AZHY sì", true, refValido("HG-01AZHY"));
  for (const x of ["", "hg-01azhy", "HG-01AZH", "HG-01AZHYY", "HG-01AZHI", "HG-01AZHL", "HG-01AZHO", "HG-01AZHU", "01AZHY", "HG-01AZ H", "HG-01AZ-Y", " HG-01AZHY", "HG-01AZHY\n", null, undefined, 5, {}]) c(`refValido(${JSON.stringify(x)}) → no`, false, refValido(x));
}
