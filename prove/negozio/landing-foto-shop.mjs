/** ── VETRINA V1 · T81 · LE FOTO `shop.*` SI RIDUCONO NELL'EDITOR (D99) ──────────────────────
 *  `src/landing/ridimensiona-shop.ts` (calcolo puro + la porta del browser) e il pezzo di
 *  `src/crm/LandingContentEditor.tsx` che la usa. Cosa deve valere (V1-T14, peso):
 *   · un lato massimo PER CAMPO: `heroFoto` 1100, `titolareFoto` 240, `pacco`/`coloriFoto`/`*Poster` 960 (lato lungo),
 *     `condivisione` 1200 × 630 (ritaglio al centro); mai ingrandire; il PNG con trasparenza passa su sfondo bianco;
 *   · i campi che non cominciano per `shop.` NON cambiano: `uploadFile` è identica a quella di 276c5d5 e l'UNICA riga
 *     tolta dall'editor è la chiamata `uploadFile(f, prefix)`, che senza `riduci` fa quello di prima;
 *   · il testo d'aiuto dice che l'originale non si salva.
 *  Il disegno vero (canvas) è dietro una porta: qui è finta; lo prova un browser vero (vedi LAVAGNA).
 *  Dati inventati, nessuna rete, nessun database. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requireQui = createRequire(import.meta.url);
const BASE = "276c5d5"; // shop-v1 prima di T81

/** Impacchetta il modulo con esbuild in una cartella temporanea, lo carica, poi cancella la cartella. */
async function carica(radice) {
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-foto-shop-"));
  try {
    const r = await esbuild.build({
      entryPoints: [join(radice, "src/landing/ridimensiona-shop.ts")], bundle: true, write: false, platform: "node", format: "cjs",
      alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
    });
    const file = join(dir, "ridimensiona-shop.cjs");
    writeFileSync(file, r.outputFiles[0].text);
    return requireQui(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Il testo di `function uploadFile…` fino alla `}` a inizio riga. */
const corpoUpload = (sorgente) => (sorgente.match(/async function uploadFile[\s\S]*?\n}\n/) ?? [""])[0];

/** Una porta finta: ricorda cosa le si chiede. */
function portaFinta({ larghezza, altezza, blob = new Blob(["jpeg"], { type: "image/jpeg" }) }) {
  const s = { lette: 0, chiuse: 0, disegni: [] };
  return {
    s,
    leggi: async () => (s.lette++, { sorgente: "sorgente", larghezza, altezza, chiudi: () => s.chiuse++ }),
    disegna: async (sorgente, piano, sfondo, tipo, qualita) => (s.disegni.push({ sorgente, piano, sfondo, tipo, qualita }), blob),
  };
}
const lancia = async (f) => { try { await f(); return "non lancia"; } catch (e) { return e.message; } };

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T81 · RIDURRE LE FOTO shop.* NELL'EDITOR (23/11/2026)");
  const R = await carica(radice);
  const U = (chiave, w, h) => { const l = R.latoMassimo(chiave); return l ? R.pianoRiduzione(l, w, h).uscita : null; };

  // ── la tabella dei lati massimi (D99): lato LUNGO, in orizzontale e in piedi ──
  const TABELLA = [["shop.heroFoto", 1100], ["shop.titolareFoto", 240], ["shop.pacco", 960], ["shop.coloriFoto", 960], ["shop.coloriPoster", 960], ["shop.curaPoster", 960]];
  for (const [chiave, lato] of TABELLA) {
    c(`${chiave}: 6000×4000 → lato lungo ${lato}`, { larghezza: lato, altezza: Math.round((4000 * lato) / 6000) }, U(chiave, 6000, 4000));
    c(`${chiave}: 4000×6000 (in piedi) → lato lungo ${lato}`, { larghezza: Math.round((4000 * lato) / 6000), altezza: lato }, U(chiave, 4000, 6000));
  }
  c("hero 4:5 da 3000×3750 → 880×1100 (come dice D99)", { larghezza: 880, altezza: 1100 }, U("shop.heroFoto", 3000, 3750));
  c("le foto con lato massimo non si ritagliano: il ritaglio è tutta la foto", { x: 0, y: 0, larghezza: 6000, altezza: 4000 }, R.pianoRiduzione(R.latoMassimo("shop.pacco"), 6000, 4000).ritaglio);

  // ── la condivisione: 1200 × 630, ritaglio al centro ──
  const cond = R.pianoRiduzione(R.latoMassimo("shop.condivisione"), 4000, 3000);
  c("condivisione 4000×3000 → ritaglio 4000×2100 al centro (y = 450)", { x: 0, y: 450, larghezza: 4000, altezza: 2100 }, cond.ritaglio);
  c("…uscita 1200×630", { larghezza: 1200, altezza: 630 }, cond.uscita);
  const alta = R.pianoRiduzione(R.latoMassimo("shop.condivisione"), 3000, 6000);
  c("condivisione in piedi 3000×6000 → ritaglio 3000×1575 al centro (y = 2212)", [{ x: 0, y: 2212, larghezza: 3000, altezza: 1575 }, { larghezza: 1200, altezza: 630 }], [alta.ritaglio, alta.uscita]);

  // ── mai ingrandire ──
  c("hero 800×600 resta 800×600", { larghezza: 800, altezza: 600 }, U("shop.heroFoto", 800, 600));
  c("hero 1100×880 (esatta) resta com'è; 1101×880 → 1100×879", [{ larghezza: 1100, altezza: 880 }, { larghezza: 1100, altezza: 879 }], [U("shop.heroFoto", 1100, 880), U("shop.heroFoto", 1101, 880)]);
  c("ritratto 100×100 resta 100×100 (non diventa 240)", { larghezza: 100, altezza: 100 }, U("shop.titolareFoto", 100, 100));
  c("condivisione 800×600 → ritaglio 800×420 e uscita 800×420, non 1200×630", [{ x: 0, y: 90, larghezza: 800, altezza: 420 }, { larghezza: 800, altezza: 420 }], [R.pianoRiduzione(R.latoMassimo("shop.condivisione"), 800, 600).ritaglio, R.pianoRiduzione(R.latoMassimo("shop.condivisione"), 800, 600).uscita]);
  c("condivisione 1200×630 esatta resta com'è", { larghezza: 1200, altezza: 630 }, U("shop.condivisione", 1200, 630));
  let oltre = 0;
  for (const [chiave] of [...TABELLA, ["shop.condivisione"]])
    for (const [w, h] of [[1, 1], [37, 5000], [240, 240], [241, 300], [959, 961], [1200, 630], [1201, 631], [2400, 1260], [9000, 100], [100, 9000], [6000, 4000]]) {
      const p = R.pianoRiduzione(R.latoMassimo(chiave), w, h);
      const r = p.ritaglio;
      if (p.uscita.larghezza > r.larghezza || p.uscita.altezza > r.altezza) oltre++; // uscita più grande di ciò che si ritaglia = ingrandita
      if (r.x < 0 || r.y < 0 || r.x + r.larghezza > w || r.y + r.altezza > h) oltre++; // ritaglio fuori dalla foto
      if (p.uscita.larghezza < 1 || p.uscita.altezza < 1 || !Number.isInteger(p.uscita.larghezza) || !Number.isInteger(p.uscita.altezza)) oltre++;
    }
  c("in nessun caso l'uscita supera il ritaglio, il ritaglio sta nella foto, misure intere ≥ 1", 0, oltre);

  // ── chi NON è un campo foto di shop.* non ha lato massimo ──
  const NO = ["id.hero", "s02.media", "s05.beforeImage", "reviews/posters", "shop", "shop.", "shopping.heroFoto", "Shop.heroFoto", "x.shop.heroFoto", "", "shop.heroFoto.alt", "shop.heroFoto.didascalia", "shop.coloriVideo", "shop.curaVideo", "shop.clienti.liberatoria", "shop.cat.patch.foto", "shop.a.bPoster", "shop.Poster2"];
  c("fuori dalla tabella nessun lato massimo (campi della landing, testi, video, liberatoria, chiavi strane)", NO.map(() => null), NO.map((k) => R.latoMassimo(k)));
  c("le chiavi della tabella e `condivisione` ce l'hanno", true, [...TABELLA.map(([k]) => k), "shop.condivisione"].every((k) => !!R.latoMassimo(k)));

  // ── misure che non si leggono ──
  const L = R.latoMassimo("shop.heroFoto");
  const storte = [[0, 100], [100, 0], [-5, 100], [100.5, 100], ["100", 100], [NaN, 100], [Infinity, 100], [null, undefined]];
  c("misure storte → errore in italiano, mai una foto 0×0", storte.map(() => true), storte.map(([w, h]) => /Non riesco a leggere/.test(String(((() => { try { R.pianoRiduzione(L, w, h); return ""; } catch (e) { return e.message; } })())))));

  // ── il flusso con la porta finta ──
  const png = new File([new Uint8Array(10)], "Foto Titolare.PNG", { type: "image/png" });
  const p1 = portaFinta({ larghezza: 3000, altezza: 2000 });
  const fuori = await R.riduciFotoShop(png, "shop.titolareFoto", p1);
  const d = p1.s.disegni[0];
  c("un PNG di shop.titolareFoto esce JPEG, con nome .jpg", ["image/jpeg", true], [fuori.type, /\.jpg$/.test(fuori.name) && !/png/i.test(fuori.name)]);
  c("…disegnato su sfondo bianco, JPEG, qualità 0,8, a 240×160", ["#ffffff", "image/jpeg", 0.8, { larghezza: 240, altezza: 160 }], [d.sfondo, d.tipo, d.qualita, d.piano.uscita]);
  c("…la foto letta si chiude (una lettura, una chiusura)", [1, 1], [p1.s.lette, p1.s.chiuse]);
  const jpg = new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" });
  const webp = new File([new Uint8Array(10)], "a.webp", { type: "image/webp" });
  c("anche JPEG e WebP si riducono", [1, 1], await (async () => { const a = portaFinta({ larghezza: 2000, altezza: 2000 }), b = portaFinta({ larghezza: 2000, altezza: 2000 }); await R.riduciFotoShop(jpg, "shop.pacco", a); await R.riduciFotoShop(webp, "shop.pacco", b); return [a.s.disegni.length, b.s.disegni.length]; })());

  const intatti = [["campo della landing", png, "s05.beforeImage"], ["campo id.*", png, "id.hero"], ["video su campo shop", new File([new Uint8Array(3)], "v.mp4", { type: "video/mp4" }), "shop.heroFoto"], ["GIF su campo shop", new File([new Uint8Array(3)], "a.gif", { type: "image/gif" }), "shop.heroFoto"], ["SVG su campo shop", new File([new Uint8Array(3)], "a.svg", { type: "image/svg+xml" }), "shop.heroFoto"], ["campo shop senza lato (liberatoria)", png, "shop.clienti.liberatoria"], ["testo shop", png, "shop.heroFoto.alt"]];
  for (const [nome, file, chiave] of intatti) {
    const p = portaFinta({ larghezza: 3000, altezza: 2000 });
    const out = await R.riduciFotoShop(file, chiave, p);
    c(`${nome}: lo STESSO file, la porta non si tocca`, [true, 0, 0], [out === file, p.s.lette, p.s.disegni.length]);
  }

  // ── formati che il browser non sa ridurre: rifiutati, non caricati interi ──
  const FRASE = "Questo formato non si può ridurre: salva la foto in JPG o PNG e riprova.";
  for (const [nome, tipo, file] of [["HEIC", "image/heic", "a.heic"], ["HEIF", "image/heif", "a.heif"], ["file senza tipo", "", "a.heic"], ["tipo qualunque", "application/pdf", "a.pdf"]]) {
    const p = portaFinta({ larghezza: 3000, altezza: 2000 });
    c(`${nome} su un campo shop con lato → errore chiaro, la porta non si tocca`, [FRASE, 0], [await lancia(() => R.riduciFotoShop(new File([new Uint8Array(3)], file, { type: tipo }), "shop.heroFoto", p)), p.s.lette]);
  }
  const pHeic = portaFinta({ larghezza: 3000, altezza: 2000 });
  c("HEIC su un campo senza lato (liberatoria) o non shop: lo STESSO file, nessun errore", [true, true], [
    await R.riduciFotoShop(new File([new Uint8Array(3)], "a.heic", { type: "image/heic" }), "shop.clienti.liberatoria", pHeic).then((o) => o.name === "a.heic", () => false),
    await R.riduciFotoShop(new File([new Uint8Array(3)], "a.heic", { type: "" }), "id.hero", pHeic).then((o) => o.name === "a.heic", () => false),
  ]);

  const vuota = portaFinta({ larghezza: 3000, altezza: 2000, blob: null });
  c("se il browser non riesce a scrivere il JPEG → errore in italiano, e la foto si chiude lo stesso", [true, 1], [/provane un'altra/.test(await lancia(() => R.riduciFotoShop(png, "shop.heroFoto", vuota))), vuota.s.chiuse]);
  const illeggibile = { leggi: async () => { throw new Error("Non riesco a leggere la foto: provane un'altra."); }, disegna: async () => { throw new Error("mai"); } };
  c("se la foto non si legge l'errore sale (niente caricamento dell'originale)", "Non riesco a leggere la foto: provane un'altra.", await lancia(() => R.riduciFotoShop(png, "shop.heroFoto", illeggibile)));

  // ── lo sfondo bianco sta DAVVERO nel disegno: il riempimento viene prima della foto ──
  const sorgenteModulo = readFileSync(join(radice, "src/landing/ridimensiona-shop.ts"), "utf8");
  const iStile = sorgenteModulo.indexOf("ctx.fillStyle = sfondo"), iRiempi = sorgenteModulo.indexOf("ctx.fillRect(0, 0, u.larghezza, u.altezza)"), iFoto = sorgenteModulo.indexOf("ctx.drawImage(");
  c("nel disegno vero: fillStyle = sfondo, poi fillRect su tutta l'uscita, POI drawImage (altrimenti un PNG trasparente diventa nero)", true, iStile > 0 && iStile < iRiempi && iRiempi < iFoto);
  c("…e lo sfondo che la funzione passa al disegno è il bianco (`SFONDO`, `#ffffff`)", [true, true], [/porta\.disegna\([^;]*, SFONDO, TIPO_USCITA, QUALITA\)/.test(sorgenteModulo), /SFONDO = "#ffffff"/.test(sorgenteModulo)]);

  // ── il testo d'aiuto ──
  const aiuto = (k) => R.aiutoFotoShop(k);
  c("l'aiuto dice che l'originale non si salva", true, TABELLA.map(([k]) => k).concat("shop.condivisione").every((k) => /l'originale non si salva/i.test(aiuto(k))));
  c("…e dice il lato massimo del campo", [true, true, true, true], [/1100 px/.test(aiuto("shop.heroFoto")), /240 px/.test(aiuto("shop.titolareFoto")), /960 px/.test(aiuto("shop.pacco")), /1200 × 630 px/.test(aiuto("shop.condivisione"))]);
  c("…e che non ingrandisce", true, /non (la )?ingrandi/i.test(aiuto("shop.heroFoto")));
  c("per i campi non shop o senza lato non c'è aiuto (niente testo sbagliato)", NO.map(() => null), NO.map(aiuto));

  // ── l'editor: i campi non shop non cambiano ──
  const ora = readFileSync(join(radice, "src/crm/LandingContentEditor.tsx"), "utf8");
  const prima = execFileSync("git", ["show", `${BASE}:src/crm/LandingContentEditor.tsx`], { cwd: radice, encoding: "utf8", maxBuffer: 1 << 24 });
  c("`uploadFile` (il caricamento dei campi id.*) è IDENTICA a quella di 276c5d5, byte per byte", [true, true], [corpoUpload(prima).length > 200 && corpoUpload(ora) === corpoUpload(prima), corpoUpload(ora).includes("upload(path, file, { upsert: false, contentType: file.type })")]);
  const diff = execFileSync("git", ["diff", "--unified=0", BASE, "--", "src/crm/LandingContentEditor.tsx"], { cwd: radice, encoding: "utf8", maxBuffer: 1 << 24 }).split("\n");
  const tolte = diff.filter((r) => r.startsWith("-") && !r.startsWith("---"));
  const aggiunte = diff.filter((r) => r.startsWith("+") && !r.startsWith("+++"));
  c("rispetto a 276c5d5 l'editor perde UNA sola riga: la chiamata `uploadFile(f, prefix)`", ["-                const url = await uploadFile(f, prefix);"], tolte);
  c("…e la riga che la sostituisce usa `riduci` solo se c'è (senza, fa quello di prima)", true, aggiunte.includes("+                const url = await uploadFile(riduci ? await riduci(f) : f, prefix);"));
  c("nessuna riga aggiunta tocca `uploadFile` come funzione né il percorso (`prefix`) dei campi", [false, false], [aggiunte.some((r) => /function uploadFile|supabase\.storage|Date\.now/.test(r)), aggiunte.some((r) => /prefix=/.test(r))]);
  c("`riduci` arriva a un solo MediaInput (quello dei campi del FieldRow), non alle recensioni", [1, 2], [(ora.match(/riduci=\{/g) ?? []).length, (ora.match(/<MediaInput/g) ?? []).length - 1]);
  c("…e solo se il campo è uno shop.* con lato massimo (ritorna `undefined` per gli altri)", true, /riduci=\{aiutoShop \? \(f\) => riduciFotoShop\(f, def\.key, portaBrowser\) : undefined\}/.test(ora) && /const aiutoShop = aiutoFotoShop\(def\.key\)/.test(ora));
  c("il testo d'aiuto è mostrato sotto il campo shop (e solo se c'è)", true, /\{aiutoShop && \(/.test(ora) && /\{aiutoShop\}/.test(ora));
  c("il vecchio aiuto «Puoi caricare un'immagine oppure un video» resta", true, ora.includes("Puoi caricare un'immagine oppure un video — il tipo viene rilevato automaticamente."));
}
