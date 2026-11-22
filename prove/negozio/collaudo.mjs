/** ── NEGOZIO · RILASCIO 2 · T67 · IL COLLAUDO CON CHIAVE (PIANO-R2 D57, approvato dal capo progetto il 21/11) ───────
 *  Serve a provare dal telefono lo shop nuovo e la cassa Stripe in prova sul sito vero, senza aprirli al pubblico.
 *  Un link `…/shop/collaudo#k=<chiave>` (la chiave sta nel FRAMMENTO: non arriva mai al server né nei log), la pagina la manda con un
 *  POST a `/api/public/shop-collaudo`, che mette il cookie `__Host-hgl_collaudo` (4 ore). Con il cookie, SOLO per quel browser: catalogo
 *  `cms`, cassa `stripe`, e `Cache-Control: private, no-store` sull'HTML di /shop* e sui dati. Senza cookie: niente cambia.
 *
 *  Tre parti:
 *   1. il modulo puro `src/shop/cms/collaudo.ts` (chiave, cookie, link, i due gestori) e l'ordine di prova (`prova = true`);
 *   2. il SORGENTE delle funzioni, delle pagine e delle rotte (la chiave si legge dentro le funzioni, mai scritta);
 *   3. il BUILD VERO: `vite build` in una cartella temporanea, `vite preview` (si chiude con il kill del suo PID, mai `pkill`) e curl.
 *  ⚠️ Segreti, chiavi e dati INVENTATI. La parte 3 non usa né il database né Stripe: prova le INTESTAZIONI e i cookie. */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { fintoDb } from "./_finto-db.mjs";
import { partenzaDa } from "./_dati-r2.mjs";
import { stripeFinto, CHIAVE_PROVA, SEGRETO_PROVA } from "./_stripe-finto.mjs";
import { uuid } from "./dati.mjs";

const SEGRETO = "chiave-di-servizio-di-prova-non-vera"; // fa da segreto della firma, come per i permessi delle altre rotte
const ALTRO_SEGRETO = "un-altro-segreto-di-prova-diverso";
const SITO = "https://sito-di-prova.example";
const ORA = Date.parse("2026-11-22T10:00:00.000Z");
const ORE = 3_600_000;
const CHIAVE_REALE = ["sk", "live", "finta0000000000000000"].join("_");
const SCADUTO = { stato: 403, corpo: { ok: false } };

/** Un'alterazione che cambia un segno del testo (sempre diverso dall'originale). */
const altera = (t, i = t.length - 1) => t.slice(0, i) + (t[i] === "a" ? "b" : "a") + t.slice(i + 1);
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · IL COLLAUDO CON CHIAVE (22/11/2026, T67, D57)");
  const K = mod["shop/cms/collaudo"];
  const P = mod["lib/tracciamento/permesso"];
  c("il modulo src/shop/cms/collaudo.ts esiste", true, !!K);
  if (K) await proveModulo(K, P, mod, { c, gruppo, radice });
  proveSorgenti({ c, gruppo, radice });
  await proveBuild(K, { c, gruppo, radice });
}

/* ══ 1 · IL MODULO PURO ═══════════════════════════════════════════════════════════════════════════════════════ */
async function proveModulo(K, P, mod, { c, gruppo, radice }) {
  gruppo("T67 · LA CHIAVE, IL COOKIE, IL LINK");
  c("le costanti: nome del cookie con __Host-, etichetta, chiave 2 ore, cookie 4 ore (Max-Age 14400)", ["__Host-hgl_collaudo", "hgl-collaudo-v1", 2 * ORE, 14400], [K.NOME_COOKIE, K.ETICHETTA_COLLAUDO, K.VALIDITA_CHIAVE_MS, K.VALIDITA_COOKIE_S]);

  const chiave = await K.emettiChiaveCollaudo(SEGRETO, ORA);
  c("la chiave è «<istante>.<64 esadecimali>» (solo segni da frammento di indirizzo)", true, /^\d{13}\.[0-9a-f]{64}$/.test(chiave));
  c("verificaChiaveCollaudo: vale subito, a 1 ora, a 2 ore esatte", [true, true, true], await Promise.all([0, 1 * ORE, 2 * ORE].map((d) => K.verificaChiaveCollaudo(chiave, SEGRETO, ORA + d))));
  c("…non vale a 2 ore e 1 millisecondo, né a 3 ore (una chiave di 3 ore fa è rifiutata)", [false, false], await Promise.all([2 * ORE + 1, 3 * ORE].map((d) => K.verificaChiaveCollaudo(chiave, SEGRETO, ORA + d))));
  c("…non vale se arriva dal futuro (orologio sfasato di più di un minuto), vale entro 60 secondi", [false, true], [await K.verificaChiaveCollaudo(chiave, SEGRETO, ORA - 61_000), await K.verificaChiaveCollaudo(chiave, SEGRETO, ORA - 60_000)]);
  c("…non vale alterata (firma, istante), con un altro segreto, senza segreto", [false, false, false, false, false], [
    await K.verificaChiaveCollaudo(altera(chiave), SEGRETO, ORA),
    await K.verificaChiaveCollaudo(`${ORA + 5}.${chiave.split(".")[1]}`, SEGRETO, ORA),
    await K.verificaChiaveCollaudo(chiave, ALTRO_SEGRETO, ORA),
    await K.verificaChiaveCollaudo(chiave, "", ORA),
    await K.verificaChiaveCollaudo(chiave, undefined, ORA),
  ]);
  const stranghe = [undefined, null, "", 5, {}, [], "x", ".", `${ORA}.`, `.${"a".repeat(64)}`, `${ORA}.${"A".repeat(64)}`, `${ORA}.${"a".repeat(63)}`, `${ORA}.${"a".repeat(64)}0`, chiave + chiave, " " + chiave];
  const esiti = [];
  for (const s of stranghe) esiti.push(await K.verificaChiaveCollaudo(s, SEGRETO, ORA).catch(() => "ECCEZIONE"));
  c("valori strani (vuoto, numero, oggetto, troppo corto/lungo, maiuscole, spazi): mai un'eccezione, sempre «no»", stranghe.map(() => false), esiti);
  c("l'istante o l'orologio non sono numeri → «no», nessuna eccezione", [false, false], [await K.verificaChiaveCollaudo(chiave, SEGRETO, "adesso").catch(() => "ECCEZIONE"), await K.verificaChiaveCollaudo(chiave, SEGRETO, NaN).catch(() => "ECCEZIONE")]);
  // un'altra etichetta (stessa forma, firmata con la chiave derivata di un'altra funzione): ignorata
  const derivata = (etichetta) => P.hmacHex(SEGRETO, etichetta);
  const emesso = String(ORA);
  const conEtichetta = async (etichetta) => `${emesso}.${await P.hmacHex(await derivata(etichetta), emesso)}`;
  c("una firma con un'altra etichetta (eventi, cassa) non vale come chiave né come cookie", [false, false, false, false], [
    await K.verificaChiaveCollaudo(await conEtichetta("hgl-eventi-v1"), SEGRETO, ORA),
    await K.verificaChiaveCollaudo(await conEtichetta("hgl-cassa-v1"), SEGRETO, ORA),
    await K.verificaCookieCollaudo(await conEtichetta("hgl-eventi-v1"), SEGRETO, ORA),
    await K.verificaCookieCollaudo(await conEtichetta("hgl-cassa-v1"), SEGRETO, ORA),
  ]);
  c("senza segreto l'emissione lancia (il Worker non emette), mai una chiave debole", [true, true], [await K.emettiChiaveCollaudo("", ORA).then(() => false, () => true), await K.emettiCookieCollaudo(undefined, ORA).then(() => false, () => true)]);

  const cookie = await K.emettiCookieCollaudo(SEGRETO, ORA);
  c("il valore del cookie ha la stessa forma, ma NON è la chiave (la chiave non vale come cookie e viceversa)", [true, false, false, true], [/^\d{13}\.[0-9a-f]{64}$/.test(cookie), cookie === chiave, await K.verificaCookieCollaudo(chiave, SEGRETO, ORA), await K.verificaCookieCollaudo(cookie, SEGRETO, ORA)]);
  c("il cookie vale 4 ore esatte, non 4 ore e 1 millisecondo; la chiave (2 ore) non vale come cookie dopo 2 ore", [true, false], [await K.verificaCookieCollaudo(cookie, SEGRETO, ORA + 4 * ORE), await K.verificaCookieCollaudo(cookie, SEGRETO, ORA + 4 * ORE + 1)]);
  c("il cookie alterato, di un altro segreto o senza segreto non vale", [false, false, false], [await K.verificaCookieCollaudo(altera(cookie), SEGRETO, ORA), await K.verificaCookieCollaudo(cookie, ALTRO_SEGRETO, ORA), await K.verificaCookieCollaudo(cookie, "", ORA)]);

  // ── l'intestazione del cookie e la lettura ──
  gruppo("T67 · IL COOKIE: ATTRIBUTI E LETTURA");
  const set = K.intestazioneSetCookie(cookie);
  const pezzi = set.split(";").map((p) => p.trim());
  c("Set-Cookie: nome __Host-, valore, Secure, HttpOnly, SameSite=Lax, Path=/", [true, true, true, true, true], [set.startsWith(`__Host-hgl_collaudo=${cookie};`), pezzi.includes("Secure"), pezzi.includes("HttpOnly"), pezzi.includes("SameSite=Lax"), pezzi.includes("Path=/")]);
  c("Set-Cookie: NESSUN Domain, Max-Age 14400 (al più)", [false, true], [/domain/i.test(set), pezzi.some((p) => /^Max-Age=\d+$/.test(p) && Number(p.slice(8)) <= 14400 && Number(p.slice(8)) > 0)]);
  c("il valore è scritto come arriva (nessun segno da proteggere) e nessun punto e virgola in più", true, set.split(";").length === 6);
  c("leggiCookie: il valore del nostro cookie fra altri, con spazi e senza", [cookie, cookie, cookie], [K.leggiCookie(`a=1; __Host-hgl_collaudo=${cookie}; b=2`), K.leggiCookie(`__Host-hgl_collaudo=${cookie}`), K.leggiCookie(`a=1;__Host-hgl_collaudo=${cookie};b=2`)]);
  c("leggiCookie: assente, vuoto, nome simile, prefisso diverso → null", [null, null, null, null, null, null], [K.leggiCookie(""), K.leggiCookie(null), K.leggiCookie(undefined), K.leggiCookie(`hgl_collaudo=${cookie}`), K.leggiCookie(`x__Host-hgl_collaudo=${cookie}`), K.leggiCookie(`__Host-hgl_collaudo_2=${cookie}`)]);
  c("leggiCookie: il primo se ce ne sono due; nome con = nel valore non si rompe; mai un'eccezione", [cookie, "a=b", null], [K.leggiCookie(`__Host-hgl_collaudo=${cookie}; __Host-hgl_collaudo=altro`), K.leggiCookie("__Host-hgl_collaudo=a=b"), (() => { try { return K.leggiCookie(42); } catch { return "ECCEZIONE"; } })()]);
  c("collaudoValido: il cookie giusto nell'intestazione sì; alterato, scaduto, di altra etichetta, assente, chiave al posto del cookie no", [true, false, false, false, false, false], [
    await K.collaudoValido(`foo=1; __Host-hgl_collaudo=${cookie}`, SEGRETO, ORA + ORE),
    await K.collaudoValido(`__Host-hgl_collaudo=${altera(cookie)}`, SEGRETO, ORA),
    await K.collaudoValido(`__Host-hgl_collaudo=${cookie}`, SEGRETO, ORA + 4 * ORE + 1),
    await K.collaudoValido(`__Host-hgl_collaudo=${await conEtichetta("hgl-cassa-v1")}`, SEGRETO, ORA),
    await K.collaudoValido(null, SEGRETO, ORA),
    await K.collaudoValido(`__Host-hgl_collaudo=${chiave}`, SEGRETO, ORA),
  ]);
  c("collaudoValido: senza segreto (non configurato) o con un segreto vuoto → no, mai un'eccezione", [false, false], [await K.collaudoValido(`__Host-hgl_collaudo=${cookie}`, undefined, ORA).catch(() => "ECCEZIONE"), await K.collaudoValido(`__Host-hgl_collaudo=${cookie}`, "", ORA).catch(() => "ECCEZIONE")]);

  // ── il link ──
  const link = K.linkCollaudo(SITO, chiave);
  c("il link: SITO + /shop/collaudo#k=<chiave>, e NON ha «?k=» né alcun «?»", [`${SITO}/shop/collaudo#k=${chiave}`, false, false], [link, link.includes("?k="), link.includes("?")]);
  c("chiaveDaFrammento: «#k=<chiave>» → la chiave; assente, vuoto o altro → null", [chiave, chiave, null, null, null, null], [K.chiaveDaFrammento(`#k=${chiave}`), K.chiaveDaFrammento(`#a=1&k=${chiave}`), K.chiaveDaFrammento(""), K.chiaveDaFrammento("#k="), K.chiaveDaFrammento("#x=1"), K.chiaveDaFrammento(null)]);
  c("chiaveDaFrammento: una chiave troppo lunga o con segni strani si scarta (null)", [null, null], [K.chiaveDaFrammento(`#k=${"a".repeat(200)}`), K.chiaveDaFrammento("#k=<script>")]);
  c("`private, no-store` è la sola intestazione del collaudo (mai `public`)", ["private, no-store", false], [K.CACHE_COLLAUDO, /public/.test(K.CACHE_COLLAUDO)]);

  // ═════ il gestore pubblico: POST {k} → cookie ═════
  gruppo("T67 · LA ROTTA PUBBLICA: LA CHIAVE DIVENTA COOKIE");
  const log = [];
  const porte = (extra = {}) => ({ segreto: () => SEGRETO, adesso: () => ORA + 60_000, log: (x) => log.push(x), ...extra });
  const post = (corpo, extra = {}) => new Request(`${SITO}/api/public/shop-collaudo`, { method: "POST", headers: { "content-type": "application/json", ...extra }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
  const leggiR = async (r) => ({ stato: r.status, testo: await r.text(), set: r.headers.get("set-cookie"), cache: r.headers.get("cache-control") });
  const ok = await leggiR(await K.gestisciCollaudo(post({ k: chiave }), porte()));
  const valoreSet = /^__Host-hgl_collaudo=([^;]+)/.exec(ok.set ?? "")?.[1];
  c("chiave giusta → 200 {ok:true}, `no-store`, e il cookie del collaudo", [200, { ok: true }, "no-store", true], [ok.stato, JSON.parse(ok.testo), ok.cache, !!valoreSet]);
  c("…il cookie ha tutti gli attributi giusti e vale quattro ore dall'emissione", [true, true, false], [!!ok.set && ["Secure", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=14400"].every((a) => ok.set.split(";").map((x) => x.trim()).includes(a)), await K.verificaCookieCollaudo(valoreSet, SEGRETO, ORA + 60_000 + 4 * ORE), /domain/i.test(ok.set ?? "")]);
  c("…la risposta non contiene né la chiave né il segreto", [false, false], [ok.testo.includes(chiave), ok.testo.includes(SEGRETO)]);
  const rifiuti = {
    "firma alterata": await leggiR(await K.gestisciCollaudo(post({ k: altera(chiave) }), porte())),
    "scaduta (3 ore)": await leggiR(await K.gestisciCollaudo(post({ k: chiave }), porte({ adesso: () => ORA + 3 * ORE }))),
    "altro segreto": await leggiR(await K.gestisciCollaudo(post({ k: chiave }), porte({ segreto: () => ALTRO_SEGRETO }))),
    "segreto non configurato": await leggiR(await K.gestisciCollaudo(post({ k: chiave }), porte({ segreto: () => undefined }))),
    "segreto che lancia": await leggiR(await K.gestisciCollaudo(post({ k: chiave }), porte({ segreto: () => { throw new Error("guasto"); } }))),
    "senza k": await leggiR(await K.gestisciCollaudo(post({}), porte())),
    "k numero": await leggiR(await K.gestisciCollaudo(post({ k: 5 }), porte())),
    "k è il cookie (altra etichetta di messaggio)": await leggiR(await K.gestisciCollaudo(post({ k: cookie }), porte())),
    "non è JSON": await leggiR(await K.gestisciCollaudo(post("{non json"), porte())),
    "è una lista": await leggiR(await K.gestisciCollaudo(post("[1,2]"), porte())),
    "corpo vuoto": await leggiR(await K.gestisciCollaudo(new Request(`${SITO}/x`, { method: "POST" }), porte())),
    "corpo enorme": await leggiR(await K.gestisciCollaudo(post({ k: chiave, riempi: "x".repeat(20_000) }), porte())),
  };
  const nomi = Object.keys(rifiuti);
  const primo = rifiuti[nomi[0]];
  const diversi = nomi.filter((n) => rifiuti[n].stato !== primo.stato || rifiuti[n].testo !== primo.testo || rifiuti[n].cache !== "no-store");
  c("ogni rifiuto è UGUALE agli altri (stesso stato, stesso corpo, `no-store`): chi sbaglia non impara niente", [], diversi);
  c("…è un 403 {ok:false}, e NESSUN rifiuto mette un cookie", [403, { ok: false }, []], [primo.stato, JSON.parse(primo.testo), nomi.filter((n) => rifiuti[n].set)]);
  c("il corpo enorme non si legge oltre il tetto (nessuna chiave e nessun segreto in giro)", [false, false], [JSON.stringify(rifiuti).includes(chiave), JSON.stringify(rifiuti).includes(SEGRETO)]);
  c("nel log solo codici (mai la chiave, il segreto, il cookie, il testo di un errore)", [true, false, false, false, false], [log.every((x) => /^[a-z0-9_ ]{1,40}$/.test(x)), log.some((x) => x.includes(chiave)), log.some((x) => x.includes(SEGRETO)), log.some((x) => x.includes(cookie)), log.some((x) => /guasto/.test(x))]);

  // ═════ l'azione del CRM: guardia «pagamenti» e link ═════
  gruppo("T67 · IL CRM: L'AZIONE «collaudo_chiave» DÀ IL LINK");
  const guardiaOk = async () => ({ ok: true, nome: "Titolare Prova" });
  const guardiaNo = (stato) => async () => ({ ok: false, risposta: new Response(JSON.stringify({ ok: false, motivo: "permesso" }), { status: stato, headers: { "content-type": "application/json" } }) });
  const chiamate = { guardia: 0, smista: 0, gOk: null };
  const log2 = [];
  const porteCrm = (extra = {}) => ({ guardia: async (r) => (chiamate.guardia++, (extra.guardia ?? guardiaOk)(r)), segreto: () => SEGRETO, sito: SITO, adesso: () => ORA, log: (x) => log2.push(x), ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== "guardia")) });
  const smista = async (g) => (chiamate.smista++, (chiamate.gOk = g), new Response(JSON.stringify({ ok: true, smistata: true }), { status: 200 }));
  const crm = (corpo, intestazioni = {}) => new Request(`${SITO}/api/crm/negozio`, { method: "POST", headers: { "content-type": "application/json", ...intestazioni }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
  const azzera = () => { chiamate.guardia = 0; chiamate.smista = 0; chiamate.gOk = null; log2.length = 0; };

  azzera();
  const rc = await K.collaudoOSmista(crm({ azione: "collaudo_chiave" }), porteCrm(), smista);
  const corpoC = await rc.json();
  c("collaudo_chiave con la guardia aperta → 200 {ok:true, link}, `no-store`, la guardia chiamata UNA volta, niente smistamento", [200, true, "no-store", 1, 0], [rc.status, corpoC.ok, rc.headers.get("cache-control"), chiamate.guardia, chiamate.smista]);
  const chiaveDelLink = /#k=([^#&]+)$/.exec(corpoC.link ?? "")?.[1];
  c("il link comincia per SITO/shop/collaudo#k=, ha la chiave nel frammento, non ha «?»", [true, false, true], [String(corpoC.link).startsWith(`${SITO}/shop/collaudo#k=`), String(corpoC.link).includes("?"), !!chiaveDelLink]);
  c("…la chiave del link è firmata col segreto, vale 2 ore dall'emissione e non un minuto in più", [true, true, false], [await K.verificaChiaveCollaudo(chiaveDelLink, SEGRETO, ORA), await K.verificaChiaveCollaudo(chiaveDelLink, SEGRETO, ORA + 2 * ORE), await K.verificaChiaveCollaudo(chiaveDelLink, SEGRETO, ORA + 2 * ORE + 1)]);
  c("…la risposta dice fino a quando vale (2 ore) e non porta il segreto", [true, false], [typeof corpoC.scadeIl === "string" && Date.parse(corpoC.scadeIl) === ORA + 2 * ORE, JSON.stringify(corpoC).includes(SEGRETO)]);
  c("…nel log niente (nemmeno la chiave)", [true], [log2.every((x) => !x.includes(chiaveDelLink ?? "x") && !x.includes(SEGRETO))]);
  for (const stato of [401, 403]) {
    azzera();
    const r = await K.collaudoOSmista(crm({ azione: "collaudo_chiave" }), porteCrm({ guardia: guardiaNo(stato) }), smista);
    const t = await r.text();
    c(`guardia negata (${stato}) → la risposta della guardia, nessun link, nessuno smistamento`, [stato, false, 0], [r.status, t.includes("#k="), chiamate.smista]);
  }
  azzera();
  let letti = 0;
  const flusso = new ReadableStream({ pull(k) { letti++; k.enqueue(new TextEncoder().encode("x".repeat(1000))); } }, { highWaterMark: 0 });
  const rg = await K.collaudoOSmista(new Request(`${SITO}/api/crm/negozio`, { method: "POST", body: flusso, duplex: "half", headers: { "content-type": "application/json" } }), porteCrm({ guardia: guardiaNo(403) }), smista).catch(() => null);
  c("guardia negata con un corpo che non finisce mai: il corpo NON si legge (la guardia viene prima di tutto)", [403, true], [rg?.status, letti <= 1]);
  azzera();
  const rs = await K.collaudoOSmista(crm({ azione: "prodotto_salva", id: "x" }), porteCrm(), smista);
  c("un'altra azione passa allo smistamento con la guardia già fatta (una sola chiamata alla guardia)", [200, true, 1, 1, true], [rs.status, (await rs.json()).smistata, chiamate.guardia, chiamate.smista, chiamate.gOk?.ok === true]);
  azzera();
  const gran = JSON.stringify({ azione: "prodotto_salva", nota: "y".repeat(50_000) });
  await K.collaudoOSmista(crm(gran), porteCrm(), smista);
  c("un corpo grande (prodotti) passa allo smistamento senza essere scambiato per il collaudo", [1, 1], [chiamate.smista, chiamate.guardia]);
  azzera();
  await K.collaudoOSmista(crm("{non json"), porteCrm(), smista);
  await K.collaudoOSmista(new Request(`${SITO}/api/crm/negozio`, { method: "POST" }), porteCrm(), smista);
  c("corpo rotto o vuoto → allo smistamento (lo rifiuta lui con la sua frase)", 2, chiamate.smista);
  // il corpo, dopo l'ispezione, arriva intero allo smistamento (la richiesta non è stata consumata)
  azzera();
  let corpoVisto = null;
  const smistaLegge = async () => (corpoVisto = await rq.text(), new Response("{}"));
  const rq = crm({ azione: "prodotto_salva", id: "42" });
  await K.collaudoOSmista(rq, porteCrm(), smistaLegge);
  c("la richiesta originale resta leggibile per lo smistamento (nessun corpo consumato)", { azione: "prodotto_salva", id: "42" }, JSON.parse(corpoVisto ?? "null"));
  azzera();
  const senza = await K.collaudoOSmista(crm({ azione: "collaudo_chiave" }), porteCrm({ segreto: () => undefined }), smista);
  const tSenza = await senza.json();
  c("senza segreto nell'ambiente: 503, nessun link, una frase che dice cosa manca (senza dirne il nome)", [503, false, true, false], [senza.status, tSenza.ok, typeof tSenza.frase === "string" && tSenza.frase.length > 0, JSON.stringify(tSenza).includes("SUPABASE")]);
  azzera();
  const lancia = await K.collaudoOSmista(crm({ azione: "collaudo_chiave" }), porteCrm({ guardia: async () => { throw new Error("guasto con dati veri"); } }), smista);
  c("la guardia che lancia → 500 {ok:false} e nel log solo un codice", [500, false, true], [lancia.status, (await lancia.json()).ok, log2.length > 0 && log2.every((x) => /^[a-z0-9_ ]{1,40}$/.test(x) && !/dati veri/.test(x))]);

  // ═════ un ordine fatto con il cookie ═════
  gruppo("T67 · UN ORDINE FATTO CON IL COOKIE: `prova` SEGUE LA CHIAVE DI STRIPE");
  const H = mod["shop/cassa/collega.server"];
  const KS = mod["shop/cassa/cassa.server"];
  const PC = mod["shop/cassa/permesso-cassa"];
  const S = mod["shop/stripe/client"];
  if (!H || !KS || !PC || !S) return c("i moduli della cassa (collega, cassa, permesso, client di Stripe) esistono", true, false);
  const VARIANTI = [{ sku: "PROVA-A", giacenza: 5, prezzo_cent: 2500, nome_prodotto: "Prodotto Alfa", slug: "prodotto-alfa", nome: "Unica" }];
  const TARIFFA = { stato: "ok", costoCent: 490, confermata: false, corriere: null, tempi: null, frase: null };
  const T0 = Date.parse("2026-11-20T12:00:00.000Z");
  const ordina = async ({ chiaveStripe, cookieValido }) => {
    const iso = () => new Date(T0).toISOString();
    const db = fintoDb({ tabelle: partenzaDa({ varianti: VARIANTI, ordini: [] }, iso), adesso: iso });
    const finto = stripeFinto({ chiave: chiaveStripe, adesso: () => T0 / 1000 });
    let n = 0;
    // la cassa effettiva come la dà il collaudo: `stripe` solo con il cookie valido (senza, la cassa vecchia)
    const cassa = async () => (cookieValido ? "stripe" : "vecchia");
    const ambiente = { STRIPE_SECRET_KEY: chiaveStripe, STRIPE_WEBHOOK_SECRET: SEGRETO_PROVA, SUPABASE_SERVICE_ROLE_KEY: SEGRETO };
    const porte = H.porteCassa({ db, richiesta: new Request(`${SITO}/api/public/shop-cassa`, { method: "POST", headers: { "cf-connecting-ip": "203.0.113.7", "user-agent": "ProvaBrowser/1" } }), cassa, tariffa: async () => TARIFFA, log: () => undefined, ambiente });
    porte.stripe = S.creaClientStripe({ chiave: chiaveStripe, fetch: finto.fetch });
    porte.adesso = () => T0;
    porte.random = (k) => Uint8Array.from({ length: k }, (_, i) => (++n * 7 + i * 13) & 255);
    const corpo = {
      permesso: await PC.emettiPermessoCassa(SEGRETO, T0 - 5000), tentativo: uuid(0x1001), totaleAttesoCent: 2 * 2500 + 490, righe: [{ sku: "PROVA-A", qty: 2 }],
      contatti: { nome: "Zefirino", cognome: "Quartarolo", email: "zefirino.q@example.com", telefono: "+39 300 000 7741" },
      spedizione: { indirizzo: "Via Gelsomini 77", citta: "Pontelagoscuro", cap: "44123", provincia: "FE", nazione: "IT" },
      consensi: { termini: true, privacy: true, versione: "2026-11-01" }, consensoMarketing: false, sito_web: "",
    };
    const r = await KS.gestisciCassa(new Request(`${SITO}/api/public/shop-cassa`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) }), porte);
    return { r, ordini: db.tabelle.shop_orders, db, finto };
  };
  const conCookiePro = await ordina({ chiaveStripe: CHIAVE_PROVA, cookieValido: true });
  c("con il cookie valido e una chiave Stripe di PROVA: la cassa accetta e l'ordine ha `prova = true`", [200, true, 1, true], [conCookiePro.r.stato, conCookiePro.r.corpo.ok, conCookiePro.ordini.length, conCookiePro.ordini[0]?.prova]);
  const conCookieReale = await ordina({ chiaveStripe: CHIAVE_REALE, cookieValido: true });
  c("con il cookie e una chiave REALE: l'ordine è vero (`prova = false`): serve al «pagamento reale rimborsato» del cancello", [200, 1, false], [conCookieReale.r.stato, conCookieReale.ordini.length, conCookieReale.ordini[0]?.prova]);
  const senzaCookie = await ordina({ chiaveStripe: CHIAVE_PROVA, cookieValido: false });
  c("senza il cookie (cassa vecchia) la cassa nuova è chiusa: 503 `cassa_chiusa`, nessun ordine, nessuna chiamata a Stripe", [503, "cassa_chiusa", 0, 0], [senzaCookie.r.stato, senzaCookie.r.corpo.motivo, senzaCookie.ordini.length, senzaCookie.finto.chiamate.length]);
}

/* ══ 2 · IL SORGENTE ══════════════════════════════════════════════════════════════════════════════════════════ */
function proveSorgenti({ c, gruppo, radice }) {
  gruppo("T67 · IL SORGENTE: LA CHIAVE SI LEGGE DENTRO LE FUNZIONI, LE PAGINE E LE ROTTE");
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : null);
  const FILE = {
    modulo: "src/shop/cms/collaudo.ts",
    catalogo: "src/shop/cms/catalogo.functions.ts",
    cassaSito: "src/shop/cms/cassa-sito.functions.ts",
    shop: "src/routes/shop.tsx",
    pagina: "src/routes/shop.collaudo.tsx",
    pubblica: "src/routes/api.public.shop-collaudo.ts",
    cassa: "src/routes/api.public.shop-cassa.ts",
    crm: "src/routes/api.crm.negozio.ts",
  };
  const src = Object.fromEntries(Object.entries(FILE).map(([k, f]) => [k, leggi(f)]));
  for (const [k, f] of Object.entries(FILE)) c(`${f} esiste`, true, src[k] !== null);
  const nudo = (k) => senzaCommenti(src[k] ?? "");

  // nessun segreto scritto, nessun process.env fuori da una funzione
  const fuoriDaFunzioni = (testo, nome) => {
    const sf = ts.createSourceFile(nome, testo, ts.ScriptTarget.Latest, true, nome.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const fuori = [];
    const dentro = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true; return false; };
    (function visita(n) {
      if (ts.isPropertyAccessExpression(n) && n.expression.getText() === "process" && n.name.text === "env" && !dentro(n)) fuori.push(n.parent.getText().slice(0, 60));
      ts.forEachChild(n, visita);
    })(sf);
    return fuori;
  };
  for (const k of ["modulo", "catalogo", "cassaSito", "pubblica", "crm", "cassa", "shop", "pagina"])
    if (src[k]) c(`${FILE[k]}: nessun process.env letto a livello di modulo (l'ambiente si legge dentro le funzioni, a ogni richiesta)`, [], fuoriDaFunzioni(src[k], FILE[k]));
  for (const k of Object.keys(FILE))
    if (src[k]) c(`${FILE[k]}: nessuna chiave o segreto scritto, nessun console.log, nessuna intestazione CORS`, [false, false, false], [/eyJ[A-Za-z0-9_-]{20,}|sk_(live|test)_|whsec_[A-Za-z0-9]|[0-9a-f]{40,}/.test(nudo(k)), /console\.log\(/.test(nudo(k)), /Access-Control|cors/i.test(nudo(k))]);

  // il modulo: puro, nessun ambiente, nessun fetch
  if (src.modulo) c("collaudo.ts: puro (nessun process.env, nessun import.meta.env, nessun client del server né fetch)", false, /process\.env|import\.meta\.env|client\.server|supabaseAdmin|\bfetch\(/.test(nudo("modulo")));

  // le due funzioni del server e la cassa
  if (src.catalogo) {
    const t = nudo("catalogo");
    c("catalogo.functions.ts: il segreto è `SUPABASE_SERVICE_ROLE_KEY` (nessuna variabile nuova), letto con process.env dentro la funzione; il cookie dalla richiesta", [true, true], [/process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(t), /getRequestHeader\(\s*["']cookie["']\s*\)/.test(t)]);
    c("catalogo.functions.ts: con il collaudo il catalogo è `cms` (forza «cms» su un'istanza a parte) e l'intestazione è `private, no-store` (CACHE_COLLAUDO)", [true, true], [/forza:\s*["']cms["']/.test(t), /CACHE_COLLAUDO/.test(t)]);
    c("catalogo.functions.ts: la memoria pubblica non si tocca (la stessa `catalogoPubblico` e `public, max-age=30` di prima)", [true, true], [/export async function catalogoPubblico\(\)/.test(t), /cache:\s*string \| \(\(r: T\) => string\)\s*=\s*"public, max-age=30"/.test(t)]);
    c("catalogo.functions.ts: resta con le sue sei funzioni del server (la funzione per `shop.tsx` sta in cassa-sito.functions.ts)", 6, (t.match(/createServerFn\(/g) ?? []).length);
  }
  if (src.cassaSito) {
    const t = nudo("cassaSito");
    c("cassa-sito.functions.ts: con il collaudo la cassa effettiva è `stripe` senza leggere il database, e la risposta non si tiene (no-store)", [true, true], [/collaudo/i.test(t) && /["']stripe["']/.test(t), /private, no-store|CACHE_COLLAUDO|guasto: true/.test(t)]);
    c("cassa-sito.functions.ts: una funzione del server dice a `shop.tsx` se il collaudo è attivo (`collaudoDellaVisita`)", true, /export const collaudoDellaVisita\s*=\s*createServerFn/.test(t));
    c("cassa-sito.functions.ts: `cassaEffettivaDelServer` senza argomenti legge il cookie dalla richiesta in corso (la rotta del permesso la chiama così)", true, /export async function cassaEffettivaDelServer\(\s*cookie\??\s*:/.test(t) && /collaudoDellaRichiesta|getRequestHeader/.test(t));
  }
  if (src.shop) {
    const t = nudo("shop");
    c("shop.tsx: `headers` mette `private, no-store` solo quando il collaudo c'è (e non dichiara altro)", [true, true], [/headers:\s*\(/.test(t) && /CACHE_COLLAUDO/.test(t), !/["']Cache-Control["']\s*:\s*["']public/.test(t)]);
    c("shop.tsx: senza il collaudo il contesto è quello di prima (`{ modalita }`, nessuna chiave in più che finirebbe nell'HTML)", true, /:\s*\{\s*modalita\s*\}\s*;/.test(t) || /return\s*\{\s*modalita\s*\}\s*;/.test(t));
    c("shop.tsx: il collaudo si chiede solo sul server (nel browser `headers` non conta e la visita non cambia)", true, /typeof window\s*===\s*["']undefined["']/.test(t));
  }
  if (src.cassa) c("api.public.shop-cassa.ts: la cassa effettiva si chiede con il cookie di QUESTA richiesta", true, /request\.headers\.get\(["']cookie["']\)/.test(nudo("cassa")) && /cassaEffettivaDelServer\(\s*cookie\s*\)/.test(nudo("cassa")));
  if (src.crm) {
    const t = nudo("crm");
    c("api.crm.negozio.ts: i gestori restano UNA chiamata `gestisciGET/POST(request, dipendenze)` (la guardia «pagamenti» resta la prima cosa)", [true, 2], [/GET:\s*\(\{ request \}\)\s*=>\s*gestisciGET\(request, dipendenze\)/.test(t) && /POST:\s*\(\{ request \}\)\s*=>\s*gestisciPOST\(request, dipendenze\)/.test(t), (t.match(/(GET|POST):/g) ?? []).length]);
    c("api.crm.negozio.ts: `collaudo_chiave` passa da `collaudoOSmista` con la guardia del CRM, il segreto letto dentro la funzione e SITO (non `Host`/`Origin`)", [true, true, true, false], [/collaudoOSmista\(/.test(t), /segreto:\s*\(\)\s*=>\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(t), /\bSITO\b/.test(t), /request\.headers\.get\(["'](host|origin)["']\)/i.test(t)]);
    c("api.crm.negozio.ts: il corpo non si legge nella rotta (lo fa il modulo, dopo la guardia)", false, /request\.(json|text|arrayBuffer|formData)\(/.test(t));
  }
  if (src.pubblica) {
    const t = nudo("pubblica");
    c("api.public.shop-collaudo.ts: rotta /api/public/shop-collaudo, solo POST, una chiamata a `gestisciCollaudo`, ambiente letto nel gestore, `try/catch`, nessun GET", [true, true, true, true, false], [t.includes('createFileRoute("/api/public/shop-collaudo")'), /POST:/.test(t), /gestisciCollaudo\(/.test(t), /try\s*\{/.test(t) && /catch/.test(t), /\bGET:/.test(t)]);
    c("api.public.shop-collaudo.ts: nel log solo codici (il `log` riceve un codice, l'eccezione una parola sola)", [true, true], [/log:\s*\(codice\)\s*=>\s*console\.warn\(`\[shop-collaudo\] \$\{codice\}`\)/.test(t), (t.match(/console\./g) ?? []).length === 2]);
  }
  if (src.pagina) {
    const t = nudo("pagina");
    c("shop.collaudo.tsx: legge il FRAMMENTO (#k=), lo manda con un POST a /api/public/shop-collaudo, non lo scrive in nessun indirizzo", [true, true, true, false], [/location\.hash/.test(t) && /chiaveDaFrammento/.test(t), /["']\/api\/public\/shop-collaudo["']/.test(t) && /method:\s*["']POST["']/.test(t), /\bk\b/.test(t) && /body:\s*JSON\.stringify\(\{\s*k/.test(t), /[?&]k=/.test(t)]);
    c("shop.collaudo.tsx: toglie il frammento dalla cronologia e poi RICARICA la pagina del negozio (così il server vede il cookie e la visita riparte da zero)", [true, true], [/history\.replaceState/.test(t), /location\.assign\(\s*["']\/shop["']\s*\)/.test(t)]);
    c("shop.collaudo.tsx: nessuno script di terzi né pixel (non importa niente del tracciamento), non si indicizza, mai in cache", [false, true, true], [/tracciamento|fbq|gtag|ttq|googletagmanager/i.test(t), /noindex/.test(t), /CACHE_COLLAUDO/.test(t)]);
    c("shop.collaudo.tsx: un errore ha una frase in italiano e dice come uscirne (nessun testo tecnico, nessuna chiave)", true, /Il link non è più valido|non è più valido/.test(t) && /CRM/.test(t));
  }
}

/* ══ 3 · IL BUILD VERO ════════════════════════════════════════════════════════════════════════════════════════ */
const libera = () => new Promise((ok, no) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => ok(port)); }); s.on("error", no); });
const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));

async function proveBuild(K, { c, gruppo, radice }) {
  gruppo("T67 · IL BUILD VERO: LE INTESTAZIONI DI /shop* E DELLE FUNZIONI (vite build + vite preview + curl)");
  const base = mkdtempSync(join(tmpdir(), "collaudo-"));
  const vite = join(radice, "node_modules/vite/bin/vite.js");
  // `vite build` rigenera `src/routeTree.gen.ts`: la prova lo rimette com'era (non va nel commit)
  const albero = join(radice, "src/routeTree.gen.ts");
  const alberoPrima = existsSync(albero) ? readFileSync(albero, "utf8") : null;
  let figlio = null;
  let logPreview = "";
  try {
    try {
      execFileSync(process.execPath, [vite, "build", "--outDir", join(base, "dist")], { cwd: radice, stdio: ["ignore", "pipe", "pipe"], timeout: 420_000, env: { ...process.env, NODE_ENV: "production" } });
    } catch (e) {
      return c("`vite build` in una cartella temporanea riesce", 0, `uscita ${e.status ?? "?"}: ${String(e.stderr ?? e.message).split("\n").slice(-6).join(" | ").slice(0, 400)}`);
    }
    c("`vite build` in una cartella temporanea riesce (outDir fuori dal progetto)", true, existsSync(join(base, "dist/server/server.js")));
    // il server compilato importa i pacchetti: si cerca `node_modules` salendo dalla cartella temporanea
    symlinkSync(join(radice, "node_modules"), join(base, "node_modules"));
    const porta = await libera();
    const segreto = `segreto-di-prova-${porta}-non-vero`; // il segreto di QUESTA corsa: il server di prova e la prova lo condividono
    // ⚠️ il `.env` del progetto punta al database VERO: il server di prova riceve un indirizzo che non risponde (porta 9) e una chiave finta, quindi non lo raggiunge mai
    figlio = spawn(process.execPath, [vite, "preview", "--outDir", join(base, "dist"), "--host", "127.0.0.1", "--port", String(porta), "--strictPort"], {
      cwd: radice,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: segreto, STRIPE_SECRET_KEY: CHIAVE_PROVA, STRIPE_WEBHOOK_SECRET: SEGRETO_PROVA, SUPABASE_URL: "http://127.0.0.1:9", SHOP_CATALOGO_FORZA: "", SHOP_CASSA_FORZA: "" },
    });
    figlio.stdout.on("data", (d) => { logPreview += d; });
    figlio.stderr.on("data", (d) => { logPreview += d; });
    const url = (p) => `http://127.0.0.1:${porta}${p}`;
    const curl = (p, { metodo = "GET", cookie, corpo, intestazioni = {} } = {}) => {
      const fi = join(base, "h.txt"), fo = join(base, "o.bin");
      const args = ["-sS", "--max-time", "30", "-X", metodo, "-D", fi, "-o", fo, ...(cookie ? ["-H", `Cookie: ${cookie}`] : []), ...Object.entries(intestazioni).flatMap(([k, v]) => ["-H", `${k}: ${v}`]), ...(corpo !== undefined ? ["-H", "Content-Type: application/json", "--data-binary", corpo] : []), url(p)];
      execFileSync("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
      const righe = readFileSync(fi, "utf8").split(/\r?\n/);
      const stato = Number(/^HTTP\/\S+ (\d+)/.exec(righe[0])?.[1]);
      const h = new Map();
      for (const r of righe.slice(1)) { const i = r.indexOf(":"); if (i > 0) h.set(r.slice(0, i).toLowerCase(), (h.get(r.slice(0, i).toLowerCase()) ? h.get(r.slice(0, i).toLowerCase()) + ", " : "") + r.slice(i + 1).trim()); }
      return { stato, h, testo: readFileSync(fo, "utf8") };
    };
    // il server è pronto quando risponde
    let pronto = false;
    for (let i = 0; i < 80 && !pronto; i++) {
      try { pronto = curl("/shop").stato === 200; } catch { await aspetta(500); }
    }
    c("`vite preview` risponde (servito dal build, in una porta libera)", true, pronto);
    if (!pronto) return c("…log del server di prova", "", logPreview.slice(-400));

    // ── i valori «di oggi» (confronto con R1: `cache-control` dell'HTML è quello della radice) ──
    const OGGI = "no-cache, must-revalidate";
    const SENZA_CHIAVI = (x) => !/private|no-store|public/.test(x ?? "");
    //  ⚠️ solo pagine che col database irraggiungibile di questa prova rispondono 200: la scheda e la categoria «cms» senza database rispondono 500 o rimandano a /shop
    const pagine = ["/shop", "/shop/carrello", "/shop/checkout"];
    //  l'HTML porta gli istanti del rendering (`u:<ms>`) e le impronte dei file: sono la sola cosa che cambia da una richiesta all'altra
    const stabile = (t) => t.replace(/u:\d{13}/g, "u:T");
    const ora = Date.now();
    const cookieBuono = `__Host-hgl_collaudo=${await K?.emettiCookieCollaudo(segreto, ora)}`;
    const cookieVecchio = `__Host-hgl_collaudo=${await K?.emettiCookieCollaudo(segreto, ora - 4 * ORE - 60_000)}`;
    const cookieAltro = `__Host-hgl_collaudo=${await K?.emettiCookieCollaudo(ALTRO_SEGRETO, ora)}`;
    const cookieAlterato = `__Host-hgl_collaudo=${altera(String(await K?.emettiCookieCollaudo(segreto, ora)))}`;
    const cookieChiave = `__Host-hgl_collaudo=${await K?.emettiChiaveCollaudo(segreto, ora)}`;
    const cookieNomeSbagliato = `hgl_collaudo=${await K?.emettiCookieCollaudo(segreto, ora)}`;

    // senza cookie: come oggi
    const senza = Object.fromEntries(pagine.map((p) => [p, curl(p)]));
    c("SENZA cookie: l'HTML di /shop* ha `cache-control` come oggi (no-cache, must-revalidate), nessun Set-Cookie, nessun private/no-store/public", pagine.map(() => [OGGI, undefined]), pagine.map((p) => [senza[p].h.get("cache-control"), senza[p].h.get("set-cookie")]));
    c("SENZA cookie: l'HTML è quello del catalogo di oggi (piè di pagina «Protesi e cura di grado premium»)", true, senza["/shop"].testo.includes("Protesi e cura di grado premium") && !senza["/shop"].testo.includes("Patch e prodotti per la cura"));
    c("SENZA cookie: nell'HTML non c'è traccia del collaudo (nessuna chiave `collaudo` nel contesto portato al browser)", false, /collaudo/i.test(senza["/shop"].testo.replace(/\/shop\/collaudo/g, "")));
    const doppio = curl("/shop");
    c("SENZA cookie: due richieste di fila, stesse intestazioni (tolta la data) e stesso HTML al byte", true, [...doppio.h].filter(([k]) => k !== "date").map(([k, v]) => `${k}=${v}`).join("|") === [...senza["/shop"].h].filter(([k]) => k !== "date").map(([k, v]) => `${k}=${v}`).join("|") && stabile(doppio.testo) === stabile(senza["/shop"].testo));

    // cookie alterato, scaduto, di un altro segreto, nome sbagliato, la chiave al posto del cookie: ignorati = come senza
    for (const [nome, ck] of Object.entries({ alterato: cookieAlterato, scaduto: cookieVecchio, "di un altro segreto": cookieAltro, "con il nome senza __Host-": cookieNomeSbagliato, "la chiave al posto del cookie": cookieChiave })) {
      const r = curl("/shop", { cookie: ck });
      c(`cookie ${nome}: ignorato (stesse intestazioni e stesso HTML di senza cookie)`, [OGGI, true], [r.h.get("cache-control"), stabile(r.testo) === stabile(senza["/shop"].testo)]);
    }

    // con il cookie valido: private, no-store su tutto /shop*, catalogo cms
    for (const p of pagine) {
      const r = curl(p, { cookie: cookieBuono });
      c(`cookie valido: ${p} → \`cache-control: private, no-store\` (mai public) sull'HTML`, ["private, no-store", false], [r.h.get("cache-control"), /public/.test(r.h.get("cache-control") ?? "")]);
    }
    const conCookie = curl("/shop", { cookie: cookieBuono });
    c("cookie valido: l'HTML è quello del catalogo nuovo (`cms`: «Patch e prodotti per la cura»)", [true, false], [conCookie.testo.includes("Patch e prodotti per la cura"), conCookie.testo.includes("Protesi e cura di grado premium")]);
    c("cookie valido: le altre intestazioni dell'HTML non cambiano (stesso content-type e codifica)", [senza["/shop"].h.get("content-type"), senza["/shop"].h.get("content-encoding")], [conCookie.h.get("content-type"), conCookie.h.get("content-encoding")]);
    const fuori = curl("/privacy-policy", { cookie: cookieBuono });
    const fuoriSenza = curl("/privacy-policy");
    c("cookie valido: una pagina fuori da /shop* non cambia (stessa `cache-control` di senza cookie)", [true, OGGI], [fuori.h.get("cache-control") === fuoriSenza.h.get("cache-control"), fuori.h.get("cache-control")]);

    // la pagina del collaudo
    const pc = curl("/shop/collaudo");
    c("/shop/collaudo: risponde 200, `private, no-store`, non si indicizza, nessun pixel né script di terzi", [200, "private, no-store", true, false], [pc.stato, pc.h.get("cache-control"), /noindex/.test(pc.testo), /fbevents|googletagmanager|analytics\.tiktok|connect\.facebook\.net|gtag\/js/.test(pc.testo)]);

    // le funzioni del server: l'indirizzo si legge dal manifesto del build
    const server = readFileSync(join(base, "dist/server/server.js"), "utf8");
    const idDi = (nome) => new RegExp(`"([0-9a-f]{40,})":\\s*\\{\\s*functionName:\\s*"${nome}_createServerFn_handler"`).exec(server)?.[1];
    const fn = (nome, cookie, metodo = "GET", corpo) => { const id = idDi(nome); return id ? curl(`/_serverFn/${id}`, { metodo, cookie, corpo, intestazioni: { "x-tsr-serverFn": "true" } }) : null; };
    const testoFn = (r) => r?.testo ?? "";
    const m0 = fn("modalitaCatalogo"), m1 = fn("modalitaCatalogo", cookieBuono), mX = fn("modalitaCatalogo", cookieAlterato);
    c("modalitaCatalogo senza cookie: come oggi (`public, max-age=30`, risponde «codice»)", ["public, max-age=30", true], [m0?.h.get("cache-control"), /"s":"codice"/.test(testoFn(m0))]);
    c("modalitaCatalogo con cookie valido: «cms», `private, no-store`", ["private, no-store", true, false], [m1?.h.get("cache-control"), /"s":"cms"/.test(testoFn(m1)), /public/.test(m1?.h.get("cache-control") ?? "")]);
    c("modalitaCatalogo con cookie alterato: come senza cookie", ["public, max-age=30", true], [mX?.h.get("cache-control"), /"s":"codice"/.test(testoFn(mX))]);
    const s0 = fn("cassaDelSito"), s1 = fn("cassaDelSito", cookieBuono);
    c("cassaDelSito senza cookie: la cassa vecchia, come oggi (senza database: `no-store`)", [true, "no-store"], [/"s":"vecchia"/.test(testoFn(s0)), s0?.h.get("cache-control")]);
    c("cassaDelSito con cookie valido: «stripe», `private, no-store`", [true, "private, no-store"], [/"s":"stripe"/.test(testoFn(s1)), s1?.h.get("cache-control")]);
    for (const nome of ["elencoProdotti", "elencoCategorie", "schedaProdotto"]) {
      const a = fn(nome), b = fn(nome, cookieBuono);
      c(`${nome}: con cookie valido \`private, no-store\`; senza cookie la stessa intestazione di oggi (mai private per il pubblico)`, [true, "private, no-store"], [!!a && !/private/.test(a.h.get("cache-control") ?? ""), b?.h.get("cache-control")]);
    }
    //  `cassaPubblica` (vetrina) entra nel build solo quando una rotta la usa: finché non c'è, non si prova qui; col collaudo risponde `no-store` (sorgente: `guasto: true`)
    const cp = fn("cassaPubblica", cookieBuono);
    if (cp) c("cassaPubblica (vetrina) con cookie valido: nessuna copia `public` (la cassa nuova non finisce in una cache condivisa)", true, !/public/.test(cp.h.get("cache-control") ?? "public"));

    // il permesso della cassa: con la cassa vecchia 503; con il cookie la cassa si apre (chiavi presenti in questo ambiente di prova)
    const p0 = curl("/api/public/shop-cassa-permesso");
    const p1 = curl("/api/public/shop-cassa-permesso", { cookie: cookieBuono });
    c("permesso della cassa SENZA cookie: 503 `cassa_chiusa`, no-store (la cassa vecchia resta)", [503, "no-store"], [p0.stato, p0.h.get("cache-control")]);
    c("permesso della cassa CON cookie valido: la cassa non è più «chiusa» (non 503), sempre `no-store`", [true, "no-store"], [p1.stato !== 503 && !/cassa_chiusa/.test(p1.testo), p1.h.get("cache-control")]);
    const k0 = curl("/api/public/shop-cassa", { metodo: "POST", corpo: "{}" });
    const k1 = curl("/api/public/shop-cassa", { metodo: "POST", corpo: "{}", cookie: cookieBuono });
    c("la rotta di cassa SENZA cookie risponde `cassa_chiusa` (503); CON cookie valido la cassa è aperta (risponde altro: il corpo vuoto è rifiutato)", [503, true, "no-store"], [k0.stato, k1.stato !== 503 && !/cassa_chiusa/.test(k1.testo), k1.h.get("cache-control")]);

    // il POST che mette il cookie
    const chiave = await K?.emettiChiaveCollaudo(segreto, Date.now());
    const buono = curl("/api/public/shop-collaudo", { metodo: "POST", corpo: JSON.stringify({ k: chiave }) });
    const setc = buono.h.get("set-cookie") ?? "";
    const attributi = setc.split(";").map((x) => x.trim());
    c("POST /api/public/shop-collaudo con la chiave giusta: 200, `no-store`, cookie __Host- con Secure, HttpOnly, SameSite=Lax, Path=/, Max-Age 14400, senza Domain", [200, "no-store", true, true, true, true, true, true, false], [buono.stato, buono.h.get("cache-control"), setc.startsWith("__Host-hgl_collaudo="), attributi.includes("Secure"), attributi.includes("HttpOnly"), attributi.includes("SameSite=Lax"), attributi.includes("Path=/"), attributi.includes("Max-Age=14400"), /domain/i.test(setc)]);
    const valore = /^__Host-hgl_collaudo=([^;]+)/.exec(setc)?.[1];
    const dopo = curl("/shop", { cookie: `__Host-hgl_collaudo=${valore}` });
    c("il cookie che il server ha messo apre davvero il collaudo (HTML `private, no-store`, catalogo nuovo)", ["private, no-store", true], [dopo.h.get("cache-control"), dopo.testo.includes("Patch e prodotti per la cura")]);
    const rifiuti = [
      curl("/api/public/shop-collaudo", { metodo: "POST", corpo: JSON.stringify({ k: altera(String(chiave)) }) }),
      curl("/api/public/shop-collaudo", { metodo: "POST", corpo: JSON.stringify({ k: await K?.emettiChiaveCollaudo(segreto, Date.now() - 3 * ORE) }) }),
      curl("/api/public/shop-collaudo", { metodo: "POST", corpo: JSON.stringify({ k: await K?.emettiChiaveCollaudo(ALTRO_SEGRETO, Date.now()) }) }),
      curl("/api/public/shop-collaudo", { metodo: "POST", corpo: "{non json" }),
      curl("/api/public/shop-collaudo", { metodo: "POST", corpo: "{}" }),
    ];
    c("chiave alterata / di 3 ore fa / di un altro segreto / corpo rotto / senza chiave: 403, tutti uguali, nessun cookie", [true, true, true], [rifiuti.every((r) => r.stato === 403 && !r.h.get("set-cookie")), rifiuti.every((r) => r.testo === rifiuti[0].testo), rifiuti.every((r) => r.h.get("cache-control") === "no-store")]);
    const g = curl("/api/public/shop-collaudo");
    c("un GET sulla rotta non mette cookie", false, !!g.h.get("set-cookie"));
    // l'indirizzo con la chiave nella ricerca (`?k=`) non è una cosa: non apre niente e non lascia segni
    const q = curl(`/shop/collaudo?k=${chiave}`);
    c("la chiave in `?k=` nell'indirizzo non fa niente (nessun Set-Cookie) e la pagina resta `private, no-store`", [false, "private, no-store"], [!!q.h.get("set-cookie"), q.h.get("cache-control")]);
    // il server non ha scritto la chiave né il segreto nel suo log
    const cookieVal = valore ?? "x";
    c("la chiave, il cookie e il segreto non compaiono nel log del server", [false, false, false], [logPreview.includes(String(chiave)), logPreview.includes(cookieVal), logPreview.includes(segreto)]);
  } finally {
    if (figlio?.pid) {
      try { process.kill(figlio.pid, "SIGTERM"); } catch { /* già chiuso */ }
      await aspetta(500);
      try { process.kill(figlio.pid, 0); process.kill(figlio.pid, "SIGKILL"); } catch { /* chiuso */ }
    }
    if (alberoPrima !== null && existsSync(albero) && readFileSync(albero, "utf8") !== alberoPrima) writeFileSync(albero, alberoPrima);
    rmSync(base, { recursive: true, force: true });
  }
}
