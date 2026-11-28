/** ── EDITOR PRODOTTI · E13 · LE FOTO DELL'IMPORT, CARICATE DAL BROWSER ──────────
 *  `src/crm/ecommerce/prodotti/importa/importa-foto.ts` con porte finte (scaricamento finto + caricamento finto): per ogni prodotto creato e per
 *  ogni «già presente» SENZA foto, ogni foto passa dalla stessa pipeline di EditorMedia (`nuovoLavoro` → `eseguiLavoro`) nello slot giusto;
 *  una foto fallita non ferma le altre; «Riprova» rifà solo quelle non riuscite. Poi il sorgente: un solo `fetch(`, solo verso l'host
 *  ammesso, nessun innerHTML, nessuna copia della pipeline (si riusa quella di EditorMedia). Dati inventati, nessuna rete vera. */
import { build } from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rendiComponente } from "./_rende.mjs";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const pieni = (html) => (html.match(/bg-primary text-primary-foreground/g) ?? []).length;

const CDN = "https://cdn.shopify.com/s/files/1/0001/files";
const DIR = "src/crm/ecommerce/prodotti/importa";
const prod = (handle, titolo) => ({ handle, titolo, tipo: "cura", categorie: [], sku: handle.toUpperCase(), prezzoCent: 100, varianti: [{ riga: 2, sku: handle.toUpperCase(), nome: "Unica", opzioni: {}, prezzoCent: null, pesoG: null, gtin: null, costoCent: null, giacenza: 0 }] });
const foto = (handle, n, alt = "") => Array.from({ length: n }, (_x, i) => ({ url: `${CDN}/${handle}-${i + 1}.jpg?v=1`, alt: i === 0 ? alt : "", posizione: i + 1, riga: 2 + i }));

/** Tre prodotti nuovi (creati), uno «già presente» con foto e uno senza, uno respinto dal server. */
function scenario() {
  const nuovi = [prod("uno", "Spazzola uno"), prod("due", "Pettine due"), prod("rifiutato", "Rifiutato"), prod("corsa", "Corsa")];
  const presenti = [prod("con-foto", "Con foto"), prod("senza-foto", "Senza foto")];
  const lettura = {
    prodotti: [...nuovi, ...presenti],
    foto: new Map([["uno", foto("uno", 5, "Spazzola uno vista dall'alto")], ["due", foto("due", 2)], ["rifiutato", foto("rifiutato", 1)], ["corsa", foto("corsa", 1)], ["con-foto", foto("con-foto", 2)], ["senza-foto", foto("senza-foto", 2)]]),
  };
  const analisi = { lettura, nuovi, giaPresenti: presenti.filter((p) => p.handle !== "corsa").map((p) => ({ handle: p.handle, prodottoId: `id-${p.handle}`, nome: p.titolo })) };
  const stato = {
    gruppi: [{ prodotti: nuovi, stato: "fatto", risultati: [
      { handle: "uno", esito: "creato", prodottoId: "id-uno" },
      { handle: "due", esito: "creato", prodottoId: "id-due" },
      { handle: "rifiutato", esito: "errore", errori: [{ riga: 2, frase: "no" }] },
      // creato da un altro nel frattempo: il server dice «già presente» → si controlla come gli altri già presenti
      { handle: "corsa", esito: "gia_presente", prodottoId: "id-corsa" },
    ] }],
    troppoGrandi: [],
    fermo: null,
  };
  return { analisi, stato };
}

/** Le porte finte: registrano tutto. `guasti.scarica(url)` / `guasti.registra(dati)` → true = fallisce. */
function porteFinte({ guasti = {}, media = {} } = {}) {
  const log = { scaricati: [], preparati: 0, registrati: [], letti: [] };
  let n = 0;
  return {
    log,
    porte: {
      async scarica(url) {
        log.scaricati.push(url);
        if (guasti.scarica?.(url)) throw new Error("Non riesco a scaricare la foto da Shopify: riprova.");
        return new Blob([new Uint8Array(2000)], { type: guasti.tipo?.(url) ?? "image/jpeg" });
      },
      async prepara(blob) {
        log.preparati++;
        return [480, 960, 1600].map((lato) => ({ chiave: String(lato), tipo: "foto", blob, mime: "image/jpeg", per: [lato] }));
      },
      carico: {
        permesso: async () => ({ ok: true, permesso: { path: `p/${++n}.jpg` } }),
        carica: async () => ({ ok: true }),
        esegui: async (azione, dati) => {
          if (azione !== "media_registra") return { ok: false, errore: { messaggio: `azione inattesa ${azione}` } };
          if (guasti.registra?.(dati)) return { ok: false, errore: { messaggio: "Il server non ha salvato la foto." } };
          log.registrati.push(dati);
          return { ok: true, dati: { media: { id: `m${log.registrati.length}` } } };
        },
      },
      async media(id) {
        log.letti.push(id);
        return media[id] === undefined ? [] : media[id];
      },
    },
  };
}

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E13 · LE FOTO DELL'IMPORT: FLUSSO CON PORTE FINTE E SORGENTE (26/11/2026)");
  const F = await carica(radice, `${DIR}/importa-foto.ts`).catch((e) => ({ errore: String(e) }));
  c("importa-foto.ts si compila e si carica", undefined, F.errore);
  if (F.errore) return;
  const CON_FOTO = { "id-con-foto": [{ id: "x1", slot: "principale", ordine: 1, rimossoIl: null }] };

  // ── quante foto, prima di premere ──
  const { analisi, stato } = scenario();
  c("anteprima: le foto dei nuovi e dei già presenti (prima di sapere chi ha già foto)", 5 + 2 + 1 + 1 + 2 + 2, F.fotoPreviste(analisi));

  // ── il giro completo ──
  const s0 = F.avviaFoto(analisi, stato);
  c("chi entra: i creati, i già presenti (anteprima e server); non il respinto", ["uno", "due", "corsa", "con-foto", "senza-foto"], s0.prodotti.map((p) => p.handle));
  const { log, porte } = porteFinte({ media: CON_FOTO });
  const aggiornamenti = [];
  const s1 = await F.eseguiFoto(s0, porte, { aggiorna: (x) => aggiornamenti.push(F.avanzamentoFoto(x).fatte) });
  const reg = (id) => log.registrati.filter((d) => d.prodottoId === id);
  c("ordine degli slot: posizione 1 → principale, 2..5 → foto2..foto5", ["principale", "foto2", "foto3", "foto4", "foto5"], reg("id-uno").map((d) => d.slot));
  c("…le tre misure caricate, registrate con i percorsi del server", [true, true], [reg("id-uno").every((d) => d.path480 && d.path960 && d.path1600), log.preparati === log.scaricati.length]);
  c("alt: quello del file se c'è, altrimenti `altProposto` (nome del prodotto); nessuna persona ritratta", ["Spazzola uno vista dall'alto", "Spazzola uno, altra foto", false, false],
    [reg("id-uno")[0]?.alt, reg("id-uno")[1]?.alt, reg("id-uno").some((d) => d.ritraePersone), reg("id-uno").some((d) => d.liberatoriaOk)]);
  c("«già presente» CON foto → saltato: niente scaricato, niente registrato", [0, 0], [log.scaricati.filter((u) => u.includes("con-foto")).length, reg("id-con-foto").length]);
  c("«già presente» SENZA foto (anche quello detto dal server) → caricato", [["principale", "foto2"], ["principale"]], [reg("id-senza-foto").map((d) => d.slot), reg("id-corsa").map((d) => d.slot)]);
  c("la scheda si legge solo per i già presenti, una volta ciascuno", ["id-con-foto", "id-corsa", "id-senza-foto"], [...log.letti].sort());
  const a1 = F.avanzamentoFoto(s1);
  c("riepilogo: 10 caricate, 0 non riuscite, 2 saltate (già con foto), 12 di 12 (il respinto non conta)", [10, 0, 2, 12, 12, 100], [a1.caricate, a1.nonRiuscite, a1.saltate, a1.fatte, a1.totale, a1.percento]);
  c("l'avanzamento si annuncia mentre va avanti (sale fino al totale)", [true, 12], [aggiornamenti.length >= 10 && aggiornamenti.every((x, i) => i === 0 || x >= aggiornamenti[i - 1]), aggiornamenti.at(-1)]);
  c("la frase: «Foto caricate 10 · non riuscite 0»", "Foto caricate 10 · non riuscite 0", F.fraseFoto(a1));

  // ── sovrascritto dal file («aggiornato»): le foto del file prendono il posto di quelle che c'erano, senza leggere la scheda ──
  const statoSov = { ...stato, gruppi: [...stato.gruppi, { prodotti: [], stato: "fatto", risultati: [{ handle: "con-foto", esito: "aggiornato", prodottoId: "id-con-foto" }] }] };
  const sSov = F.avviaFoto(analisi, statoSov);
  const pSov = porteFinte({ media: CON_FOTO });
  await F.eseguiFoto(sSov, pSov.porte);
  const statoNo = { ...stato, gruppi: [...stato.gruppi, { prodotti: [], stato: "fatto", risultati: [{ handle: "senza-foto", esito: "errore", errori: [{ riga: 2, frase: "no" }] }] }] };
  c("un già presente che il server ha respinto non riceve foto", false, F.avviaFoto(analisi, statoNo).prodotti.some((p) => p.handle === "senza-foto"));
  c("«aggiornato» CON foto → le sue foto si caricano negli stessi spazi (media_registra sostituisce), la scheda non si legge", [true, ["principale", "foto2"], false], [sSov.prodotti.find((p) => p.handle === "con-foto")?.sostituisci, pSov.log.registrati.filter((d) => d.prodottoId === "id-con-foto").map((d) => d.slot), pSov.log.letti.includes("id-con-foto")]);

  // ── una fallita non ferma le altre; riprova solo le fallite ──
  const rotta = `${CDN}/uno-2.jpg?v=1`;
  const g = porteFinte({ media: CON_FOTO, guasti: { scarica: (u) => u === rotta, registra: (d) => d.prodottoId === "id-due" && d.slot === "foto2", tipo: (u) => (u.includes("senza-foto-2") ? "text/html" : undefined) } });
  const sg = await F.eseguiFoto(F.avviaFoto(analisi, stato), g.porte);
  const ag = F.avanzamentoFoto(sg);
  c("una foto che non si scarica non ferma le altre: uno ha 4 foto, la foto3..5 dopo la rotta salgono", [["principale", "foto3", "foto4", "foto5"], 7, 3], [g.log.registrati.filter((d) => d.prodottoId === "id-uno").map((d) => d.slot), ag.caricate, ag.nonRiuscite]);
  const nr = F.nonRiuscite(sg);
  c("le non riuscite si elencano con prodotto, posizione e frase (scaricamento, server, tipo di file)", [["Spazzola uno", 2], ["Pettine due", 2], ["Senza foto", 2]], nr.map((x) => [x.nome, x.posizione]));
  c("…con la frase giusta (un tipo che non è una foto è respinto da `controllaFile` prima di prepararla)", [true, true, true], [/scaricare/.test(nr[0]?.frase ?? ""), /non ha salvato/.test(nr[1]?.frase ?? ""), /JPG, PNG, WebP o AVIF/.test(nr[2]?.frase ?? "")]);
  c("la frase finale dice quante non sono riuscite", "Foto caricate 7 · non riuscite 3", F.fraseFoto(ag));

  const r = porteFinte({ media: { ...CON_FOTO, "id-senza-foto": [{ id: "y", slot: "principale", ordine: 1, rimossoIl: null }] } });
  const sr = await F.eseguiFoto(F.riprovaFoto(sg), r.porte);
  c("«Riprova» rifà SOLO le non riuscite: 2 scaricate (la terza aveva già i file pronti: riparte dal registro)", [[rotta, `${CDN}/senza-foto-2.jpg?v=1`], 1], [r.log.scaricati, r.log.registrati.filter((d) => d.prodottoId === "id-due").length]);
  c("…nello slot giusto, e senza rileggere la scheda dei già presenti già controllati", [["id-due", "foto2"], ["id-senza-foto", "foto2"], ["id-uno", "foto2"], []], [...r.log.registrati.map((d) => [d.prodottoId, d.slot]).sort(), r.log.letti]);
  c("…alla fine tutte caricate", [10, 0], [F.avanzamentoFoto(sr).caricate, F.avanzamentoFoto(sr).nonRiuscite]);

  // ── la lettura della scheda che non riesce, l'interruzione, i tre tentativi ──
  const l = porteFinte({ media: { "id-senza-foto": null } });
  const sl = await F.eseguiFoto(F.avviaFoto(analisi, stato), l.porte);
  c("se non riesco a sapere se un già presente ha foto, non carico niente su di lui (non si sovrascrive mai): non riuscite, si riprova", [0, 2], [l.log.registrati.filter((d) => d.prodottoId === "id-senza-foto").length, F.nonRiuscite(sl).filter((x) => x.nome === "Senza foto").length]);
  let k = 0;
  const si = await F.eseguiFoto(F.avviaFoto(analisi, stato), porteFinte({ media: CON_FOTO }).porte, { interrompi: () => k++ >= 3 });
  const ai = F.avanzamentoFoto(si);
  c("«Interrompi»: si ferma dopo la foto in corso; le altre restano da fare e «Riprova» le riprende", [true, true, 10], [ai.daFare > 0, ai.caricate < 10, F.avanzamentoFoto(await F.eseguiFoto(F.riprovaFoto(si), porteFinte({ media: CON_FOTO }).porte)).caricate]);
  const t = porteFinte({ guasti: { registra: (d) => d.prodottoId === "id-due" } });
  let st = F.avviaFoto({ ...analisi, giaPresenti: [] }, { ...stato, gruppi: [{ ...stato.gruppi[0], risultati: stato.gruppi[0].risultati.filter((x) => x.handle === "due") }] });
  for (let i = 0; i < 3; i++) st = await F.eseguiFoto(i ? F.riprovaFoto(st) : st, t.porte);
  c("dopo 3 tentativi la foto si riscarica da capo (come «scegli di nuovo il file»), mai da sola", [2, 2], [t.log.scaricati.length, F.avanzamentoFoto(st).nonRiuscite]);
  await F.eseguiFoto(F.riprovaFoto(st), t.porte);
  c("…al quarto «Riprova» riparte dallo scaricamento", 4, t.log.scaricati.length);

  // ── lo scaricamento vero: solo l'host ammesso ──
  const veroFetch = globalThis.fetch;
  const chiamate = [];
  globalThis.fetch = async (url, init) => { chiamate.push({ url, init }); return url.includes("rotta") ? { ok: false, status: 404, url } : url.includes("altrove") ? { ok: true, url: "https://esempio.invalid/x.jpg", blob: async () => new Blob(["x"]) } : { ok: true, url, blob: async () => new Blob(["x"], { type: "image/png" }) }; };
  try {
    const esito = async (u) => { try { return (await F.scaricaFoto(u)).type; } catch (e) { return `errore: ${e.message}`; } };
    const fuori = await esito("https://esempio.invalid/a.jpg");
    c("scaricaFoto: un indirizzo non di Shopify non parte nemmeno (nessuna fetch)", [true, 0], [/^errore: .*Shopify/.test(fuori), chiamate.length]);
    c("…uno di Shopify parte con mode cors e credentials omit, e restituisce la foto", ["image/png", "cors", "omit"], [await esito(`${CDN}/a.png`), chiamate[0]?.init?.mode, chiamate[0]?.init?.credentials]);
    c("…una risposta non 2xx e un rimbalzo verso un altro host sono un errore a parole", [true, true], [/^errore: /.test(await esito(`${CDN}/rotta.jpg`)), /^errore: /.test(await esito(`${CDN}/altrove.jpg`))]);
  } finally {
    globalThis.fetch = veroFetch;
  }

  // ── il sorgente ──
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const fo = senzaCommenti(leggi(`${DIR}/importa-foto.ts`));
  const br = senzaCommenti(leggi(`${DIR}/foto-browser.ts`));
  const ed = senzaCommenti(leggi("src/crm/ecommerce/prodotti/EditorMedia.tsx"));
  c("importa-foto.ts: UN solo `fetch(`, dentro `scaricaFoto`, dopo il controllo `urlFotoAmmesso`, con cors e senza credenziali", [1, true, true],
    [(fo.match(/\bfetch\(/g) ?? []).length, /if \(!urlFotoAmmesso\(url\)\)[\s\S]{0,200}\bfetch\(url, \{\s*mode: "cors",\s*credentials: "omit",\s*redirect: "error",\s*referrerPolicy: "no-referrer",?\s*\}\)/.test(fo), /urlFotoAmmesso\(r\.url\)/.test(fo)]);
  c("importa-foto.ts: una foto fatta lascia andare le sue misure (`lavoro: null`), niente rimbalzi verso altri host", [true, true], [/stato: "fatta", frase: null, lavoro: null/.test(fo), /redirect: "error"/.test(fo)]);
  c("foto-browser.ts: nessun `fetch(` (scarica con `scaricaFoto`)", [false, true], [/\bfetch\(/.test(br), /scaricaFoto/.test(br)]);
  for (const [nome, s] of [["importa-foto.ts", fo], ["foto-browser.ts", br]]) {
    c(`${nome}: nessun innerHTML, outerHTML, dangerouslySetInnerHTML, document.write, eval`, false, /innerHTML|outerHTML|dangerouslySetInnerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/.test(s));
    c(`${nome}: nessun log, nessun archivio del browser, nessun XMLHttpRequest`, false, /console\.|localStorage|sessionStorage|indexedDB|XMLHttpRequest|sendBeacon/.test(s));
    c(`${nome}: non copia la pipeline (niente disegnaMisure, chiediPermesso, caricaConPermesso, canvas qui)`, false, /disegnaMisure\(|chiediPermesso\(|caricaConPermesso\(|getContext\(|createElement\("canvas"\)/.test(s));
  }
  c("importa-foto.ts riusa `nuovoLavoro` + `eseguiLavoro` (media-puro) e `controllaFile` (ridimensiona)", [true, true, true], [/nuovoLavoro\(/.test(fo), /eseguiLavoro\(/.test(fo), /controllaFile\(\{ tipo: "foto"/.test(fo)]);
  c("foto-browser.ts usa le porte e la preparazione di EditorMedia (la stessa funzione che usa la scheda)", [true, true], [/from "\.\.\/EditorMedia"/.test(br) && /\bporte\(/.test(br), /fotoDaCaricare\(/.test(br)]);
  c("EditorMedia: `fotoDaCaricare` è la funzione che usa anche `preparaFile`", [true, true], [/export async function fotoDaCaricare\(/.test(ed), /return fotoDaCaricare\(b\.file, b\.punto\)/.test(ed)]);
  const fin = senzaCommenti(leggi(`${DIR}/FinestraImporta.tsx`));
  c("FinestraImporta: la finestra non si chiude mentre salgono le foto (`occupata` guarda anche le foto)", true, /const occupata =\s*fase\.passo === "importa" && \(fase\.inCorso \|\| fase\.fotoInCorso\)/.test(fin));

  // ── il disegno del passo 3 con le foto ──
  const nulla = () => {};
  const a12 = { lettura: { colonneIgnorate: [], conteggi: {}, foto: new Map() }, nuovi: [], giaPresenti: [], errori: [], nProdottiConErrori: 0, avvisi: [], righe: [], record: [], separatore: "," };
  const fatto = { gruppi: [], troppoGrandi: [], fermo: null };
  const p3 = async (extra) => (await rendiComponente(radice, join(DIR, "PassoImporta.tsx"), "PassoImporta", { analisi: a12, stato: fatto, inCorso: false, interrompi: nulla, riprendi: nulla, scaricaErrori: nulla, vaiAiProdotti: nulla, chiudi: nulla, riprovaFoto: nulla, ...extra })).html;
  const sMeta = await F.eseguiFoto(F.avviaFoto(analisi, stato), porteFinte({ media: CON_FOTO }).porte, { interrompi: (() => { let j = 0; return () => j++ >= 4; })() });
  const hIn = await p3({ foto: sMeta, fotoInCorso: true });
  const statoFoto = (h) => h.match(/<p class="sr-only" role="status">(Carico le foto[^<]*)<\/p>/)?.[1];
  const am = F.avanzamentoFoto(sMeta);
  const nomeBarra = `Carico le foto: ${am.fatte} di 12`;
  c("passo 3, foto in corso: seconda barra «Carico le foto: N di 12» (role=status sempre montato), nessun tasto pieno, «Interrompi»", [true, nomeBarra, true, 0, true],
    [am.fatte > 0 && am.fatte < 12, statoFoto(hIn), hIn.includes(`aria-label="${nomeBarra}"`) && /role="progressbar"/.test(hIn), pieni(hIn), leggibile(hIn).includes("Interrompi")]);
  const hFine = await p3({ foto: sg, fotoInCorso: false });
  c("passo 3, foto finite con errori: «Foto caricate 7 · non riuscite 3», l'elenco (prodotto + posizione) e «Riprova le foto non riuscite», un solo tasto pieno",
    [true, true, true, 1, "Carico le foto: 12 di 12"], [leggibile(hFine).includes("Foto caricate 7 · non riuscite 3"), leggibile(hFine).includes("Spazzola uno · foto 2"), leggibile(hFine).includes("Riprova le foto non riuscite"), pieni(hFine), statoFoto(hFine)]);
  // ── il passo 2: quante foto, e il file ricaricato per le sole foto ──
  const tasto = (html, testo) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]).find((b) => leggibile(b).includes(testo));
  const spento = (b) => b === undefined || /\sdisabled(=""|\s|>)/.test(b);
  const base2 = { nomeFile: "f.csv", errori: [], avvisi: [], righe: [], nProdottiConErrori: 0, importaDisponibile: true, lettura: { ...analisi.lettura, colonneIgnorate: [], conteggi: { prodotti: 6, varianti: 6 } } };
  const p2 = async (a) => (await rendiComponente(radice, join(DIR, "PassoControllo.tsx"), "PassoControllo", { analisi: { ...base2, ...a }, cambiaFile: nulla, scaricaErrori: nulla, importa: nulla })).html;
  const h2 = await p2({ nuovi: analisi.nuovi, daAggiornare: [], giaPresenti: analisi.giaPresenti });
  c("passo 2: dice quante foto verranno caricate dopo i prodotti (13), il tasto resta «Importa 4 prodotti in bozza»", [true, true, 1], [/Dopo i prodotti carico fino a 13 foto da Shopify/.test(leggibile(h2)), !spento(tasto(h2, "Importa 4 prodotti in bozza")), pieni(h2)]);
  const hSolo = await p2({ nuovi: [], daAggiornare: [], giaPresenti: analisi.giaPresenti });
  c("passo 2, nessun prodotto da mandare ma foto: «Carica 4 foto» acceso, un solo tasto pieno", [true, 1], [!spento(tasto(hSolo, "Carica 4 foto")), pieni(hSolo)]);
  const hSov = await p2({ nuovi: [], daAggiornare: analisi.lettura.prodotti.filter((p) => ["con-foto", "senza-foto"].includes(p.handle)), giaPresenti: analisi.giaPresenti });
  c("passo 2, file già importato: «Sovrascrivi 2 prodotti» acceso, e dice che le foto del file prendono il posto di quelle che c'erano", [true, 1, true], [!spento(tasto(hSov, "Sovrascrivi 2 prodotti")), pieni(hSov), /prendono il\s+posto di quelle che c'erano/.test(leggibile(hSov))]);

  const hNo = await p3({});
  c("passo 3 senza foto: nessuna seconda barra (come prima)", [undefined, false], [statoFoto(hNo), /Carico le foto/.test(hNo)]);
}
