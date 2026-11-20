/** ── NEGOZIO · T16 · FOTO E VIDEO DI UN PRODOTTO: LE REGOLE SENZA SCHERMO ───
 *  `src/crm/ecommerce/prodotti/media-puro.ts`: gli slot fissi, la descrizione per chi non vede (0/125), la scelta dello
 *  slot per più file, il riordino, e il CARICAMENTO come sequenza ripresa passo per passo (permesso → invio → registro),
 *  con le porte finte: niente rete, niente canvas. Dati inventati.
 *  Il modulo è impacchettato qui con esbuild (importa `ridimensiona` e `modello` con l'alias `@`). */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

const media = (id, slot, extra = {}) => ({
  id, prodottoId: "p1", categoriaId: null, varianteId: null, slot, sottoRuolo: null, tipo: slot === "video" ? "video" : "foto",
  path480: `foto/${id}-480.jpg`, path960: null, path1600: null, pathVideo: null, pathCopertina: null, durataS: null, alt: "x", testoParlato: null,
  sottotitoliOk: false, muto: false, ritraePersone: false, liberatoriaOk: false, valoreOpzione: null, ordine: 1, rimossoIl: null, ...extra,
});
const blob = (n) => ({ size: n, type: "image/jpeg" });

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · T16 · FOTO E VIDEO: GLI SLOT, LA DESCRIZIONE, IL CARICAMENTO (20/11/2026)");
  const M = await carica(radice, "src/crm/ecommerce/prodotti/media-puro.ts").catch((e) => ({ errore: String(e) }));
  c("media-puro.ts si compila e si carica", undefined, M.errore);
  if (M.errore) return;

  // ── gli slot fissi ──
  c("gli slot sono fissi e nell'ordine del Design: principale, foto 2-5, scala, video, confezione", ["principale", "foto2", "foto3", "foto4", "foto5", "scala", "video", "confezione"], M.SLOT_EDITOR.map((s) => s.slot));
  c("solo la foto principale è obbligatoria", ["principale"], M.SLOT_EDITOR.filter((s) => s.obbligatorio).map((s) => s.slot));
  c("il ruolo si sceglie solo per le foto 2-5", ["foto2", "foto3", "foto4", "foto5"], M.SLOT_EDITOR.filter((s) => s.conRuolo).map((s) => s.slot));
  c("le etichette sono quelle scritte per il titolare", ["Foto principale", "Foto di scala", "Video breve", "Foto della confezione"], ["principale", "scala", "video", "confezione"].map((k) => M.SLOT_EDITOR.find((s) => s.slot === k).etichetta));

  // ── descrizione per chi non vede ──
  c("limite 125", 125, M.MAX_ALT);
  c("vuota → rifiutata con la frase", [false, "Scrivi cosa si vede nella foto, per chi non può vederla."], (({ ok, frase }) => [ok, frase])(M.controllaAlt("")));
  c("solo spazi → rifiutata", false, M.controllaAlt("   \n ").ok);
  c("non è un testo → rifiutata", [false, false, false], [M.controllaAlt(null).ok, M.controllaAlt(undefined).ok, M.controllaAlt(42).ok]);
  c("125 segni → va; 126 → no, e dice quanti", [true, false, "La descrizione è troppo lunga: 126 segni su 125."], [M.controllaAlt("a".repeat(125)).ok, M.controllaAlt("a".repeat(126)).ok, M.controllaAlt("a".repeat(126)).frase]);
  c("gli spazi attorno non contano e si tolgono", [true, "Patch rosa"], (({ ok, alt }) => [ok, alt])(M.controllaAlt("  Patch rosa \n")));
  c("il contatore dice «n/125» sul testo com'è", ["0/125", "10/125", "130/125"], [M.contaAlt(""), M.contaAlt("0123456789"), M.contaAlt("a".repeat(130))]);
  c("proposta per la principale: il nome del prodotto", "Patch Rosa", M.altProposto("Patch Rosa", "principale", null));
  c("proposta per una foto 2-5: nome e ruolo", "Patch Rosa, retro della base", M.altProposto("Patch Rosa", "foto2", "retro_base"));
  c("…senza ruolo: nome e «altra foto»", "Patch Rosa, altra foto", M.altProposto("Patch Rosa", "foto3", null));
  c("proposta per scala, video e confezione", ["Patch Rosa, foto di scala", "Patch Rosa, video breve", "Patch Rosa, la confezione"], [M.altProposto("Patch Rosa", "scala", null), M.altProposto("Patch Rosa", "video", null), M.altProposto("Patch Rosa", "confezione", null)]);
  let sopra = 0;
  for (const nome of ["a", "Patch Rosa", "N".repeat(124), "N".repeat(125), "N".repeat(300), "", "   "])
    for (const slot of ["principale", "foto2", "scala", "video", "confezione"])
      for (const ruolo of [null, "retro_base", "altro"]) if (M.altProposto(nome, slot, ruolo).length > 125) sopra++;
  c("la proposta non supera mai 125 segni, anche con un nome lunghissimo o vuoto", 0, sopra);
  c("un nome vuoto non dà una proposta che comincia con la virgola", false, M.altProposto("  ", "foto2", "altro").startsWith(","));

  // ── quale media sta in quale slot ──
  const m = [media("a", "principale", { ordine: 1 }), media("b", "foto3", { ordine: 2 }), media("c", "foto3", { ordine: 3 }), media("r", "scala", { rimossoIl: "2026-11-20T10:00:00Z" })];
  const per = M.mediaPerSlot(m);
  c("un media rimosso non occupa lo slot", undefined, per.get("scala"));
  c("due media attivi nello stesso slot: vince sempre lo stesso (ordine, poi id), qualunque sia l'ordine di arrivo", ["b", "b"], [per.get("foto3").id, M.mediaPerSlot([...m].reverse()).get("foto3").id]);
  c("gli slot liberi per le foto, nell'ordine: il video non c'è", ["foto2", "foto4", "foto5", "scala", "confezione"], M.slotLiberiFoto(m));

  // ── più file insieme ──
  c("tre file con tutto libero → principale, foto 2, foto 3", [["principale", "foto2", "foto3"], 0], (({ slot, inEccesso }) => [slot, inEccesso])(M.assegnaSlot(3, M.slotLiberiFoto([]))));
  c("più file degli slot liberi: ne prende quanti ce ne stanno e dice quanti restano fuori", [["foto2", "foto4", "foto5", "scala", "confezione"], 2], (({ slot, inEccesso }) => [slot, inEccesso])(M.assegnaSlot(7, M.slotLiberiFoto(m))));
  c("zero file → niente", [[], 0], (({ slot, inEccesso }) => [slot, inEccesso])(M.assegnaSlot(0, ["principale"])));
  c("la frase per i file rimasti fuori", ["C'è posto solo per 5 foto: le ultime 2 non sono state prese.", "C'è posto solo per 5 foto: l'ultima non è stata presa."], [M.fraseInEccesso(5, 2), M.fraseInEccesso(5, 1)]);

  // ── riordino (solo le foto 2-5) ──
  const g = [media("p", "principale", { ordine: 1 }), media("f2", "foto2", { ordine: 2 }), media("f3", "foto3", { ordine: 3 }), media("sc", "scala", { ordine: 4 }), media("f4", "foto4", { ordine: 5 }), media("v", "video", { ordine: 6 })];
  c("galleria = foto 2-5 presenti, per ordine", ["f2", "f3", "f4"], M.galleria(g).map((x) => x.id));
  c("sposta f3 prima: scambia con f2, gli altri restano dove sono", ["p", "f3", "f2", "sc", "f4", "v"], M.ordineSposta(g, "f3", -1));
  c("sposta f3 dopo: scambia con f4 (salta la scala, che non è della galleria)", ["p", "f2", "f4", "sc", "f3", "v"], M.ordineSposta(g, "f3", 1));
  c("la prima non va prima, l'ultima non va dopo: niente da fare", [null, null], [M.ordineSposta(g, "f2", -1), M.ordineSposta(g, "f4", 1)]);
  c("la principale, la scala e un id che non c'è non si spostano", [null, null, null], [M.ordineSposta(g, "p", 1), M.ordineSposta(g, "sc", -1), M.ordineSposta(g, "zzz", 1)]);
  c("trascina f4 su f2: f4 prende il posto di f2, f2 e f3 scalano", ["p", "f4", "f2", "sc", "f3", "v"], M.ordineTrascina(g, "f4", "f2"));
  c("trascina f2 su f4: f2 va in fondo alla galleria", ["p", "f3", "f4", "sc", "f2", "v"], M.ordineTrascina(g, "f2", "f4"));
  c("trascinare su se stesso o su qualcosa che non è della galleria: niente", [null, null, null], [M.ordineTrascina(g, "f2", "f2"), M.ordineTrascina(g, "f2", "sc"), M.ordineTrascina(g, "p", "f2")]);
  c("l'ordine che esce ha tutti gli id, una volta sola", [true, true], [M.ordineSposta(g, "f3", -1).length === g.length, new Set(M.ordineTrascina(g, "f4", "f2")).size === g.length]);
  const sparso = [media("x1", "foto2", { ordine: 9 }), media("x2", "foto3", { ordine: 2 })];
  c("l'ordine di partenza è quello del campo `ordine`, non quello dell'elenco", ["x2", "x1"], M.galleria(sparso).map((x) => x.id));

  // ── l'indirizzo dell'anteprima ──
  c("l'indirizzo dell'anteprima: base + percorso, senza barre doppie", ["https://x.supabase.co/storage/v1/object/public/shop-media/foto/abc.jpg", null], [M.urlMedia("https://x.supabase.co/storage/v1/object/public/shop-media/", "/foto/abc.jpg"), M.urlMedia("https://x", null)]);
  c("senza base non si inventa un indirizzo", null, M.urlMedia("", "foto/abc.jpg"));
  c("la base deve essere https", [null, null], [M.urlMedia("http://x/y", "foto/a.jpg"), M.urlMedia("javascript:alert(1)//", "foto/a.jpg")]);

  // ── il caricamento ──
  await caricamento(M, c);
}

/** Porte finte: registra le chiamate; `guasti` dice cosa fallisce (e quante volte). */
function porteFinte(guasti = {}) {
  const log = [];
  let n = 0;
  const conta = {};
  const guasta = (k) => (guasti[k] ?? 0) > (conta[k] = (conta[k] ?? 0) + 1) - 1;
  return {
    log,
    porte: {
      async permesso(f) {
        log.push(["permesso", f.tipo, f.mime, f.peso]);
        if (guasta("permesso")) return { ok: false, errore: { tipo: "server", messaggio: "Non riesco a preparare il caricamento: riprova tra un momento." } };
        n++;
        return { ok: true, permesso: { bucket: "shop-media", path: `${f.tipo}/p${n}.${f.tipo === "video" ? "mp4" : "jpg"}`, token: "t", url: `https://s/up/${n}` } };
      },
      async carica(p, b) {
        log.push(["carica", p.path, b.size]);
        if (guasta("carica")) return { ok: false, errore: { tipo: "rete", messaggio: "Non sono riuscito a caricare il file: controlla la connessione e riprova." } };
        return { ok: true };
      },
      async esegui(azione, dati) {
        log.push(["esegui", azione, dati]);
        if (guasta(azione)) return { ok: false, errore: { tipo: "server", messaggio: "Il server non risponde." } };
        return { ok: true, dati: azione === "media_registra" ? { media: { id: "nuovo" } } : azione === "media_flag" ? { avviso: guasti.avviso } : azione === "media_rimuovi" ? { avviso: guasti.avvisoRitiro } : {} };
      },
    },
  };
}
const foto = (extra = {}) => ({
  prodottoId: "p1", slot: "principale", sottoRuolo: null, alt: "Patch Rosa", tipo: "foto", muto: false, testoParlato: null, durataS: null,
  ritraePersone: false, liberatoriaOk: false, sottotitoliOk: false,
  file: [{ chiave: "480", tipo: "foto", blob: blob(10), mime: "image/jpeg", per: [480] }, { chiave: "960", tipo: "foto", blob: blob(20), mime: "image/jpeg", per: [960] }, { chiave: "1600", tipo: "foto", blob: blob(30), mime: "image/jpeg", per: [1600] }],
  ...extra,
});

async function caricamento(M, c) {
  // ── foto riuscita ──
  const f1 = porteFinte();
  const l1 = M.nuovoLavoro(foto());
  const passi = [];
  const e1 = await M.eseguiLavoro(l1, f1.porte, (fatti, totale) => passi.push([fatti, totale]));
  c("foto riuscita: ok", true, e1.ok);
  c("…tre permessi (uno per misura), tre invii, un registro: in quest'ordine", ["permesso", "carica", "permesso", "carica", "permesso", "carica", "esegui"], f1.log.map((x) => x[0]));
  c("…il permesso dice tipo, mime e peso di OGNI misura (mai l'originale)", [["permesso", "foto", "image/jpeg", 10], ["permesso", "foto", "image/jpeg", 20], ["permesso", "foto", "image/jpeg", 30]], f1.log.filter((x) => x[0] === "permesso"));
  const reg = f1.log.find((x) => x[0] === "esegui");
  c("…il registro è media_registra con slot, alt e i tre percorsi che ha deciso il server", ["media_registra", { prodottoId: "p1", slot: "principale", alt: "Patch Rosa", sottoRuolo: null, path480: "foto/p1.jpg", path960: "foto/p2.jpg", path1600: "foto/p3.jpg" }], [reg[1], reg[2]]);
  c("…l'avanzamento sale da 0 a «tutti i passi» (4), senza saltare indietro", [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]], passi);
  c("…nel registro non c'è nessun nome di file né dato del file", false, /\.(heic|jpe?g|png)\b.*nome|nomeFile|name/i.test(JSON.stringify(reg[2])));

  // ── una foto piccola: un solo file per più misure ──
  const f2 = porteFinte();
  await M.eseguiLavoro(M.nuovoLavoro(foto({ file: [{ chiave: "480", tipo: "foto", blob: blob(5), mime: "image/jpeg", per: [480] }, { chiave: "600", tipo: "foto", blob: blob(9), mime: "image/jpeg", per: [960, 1600] }] })), f2.porte);
  const r2 = f2.log.find((x) => x[0] === "esegui")[2];
  c("foto piccola: un file per 960 e 1600, due permessi soli, stessi percorsi", [2, true, true], [f2.log.filter((x) => x[0] === "permesso").length, r2.path960 === r2.path1600, r2.path480 !== r2.path960]);

  // ── la ripresa: fallisce il secondo invio ──
  const f3 = porteFinte({ carica: 0 });
  let k = 0;
  const porte3 = { ...f3.porte, carica: async (p, b) => (++k === 2 ? { ok: false, errore: { tipo: "rete", messaggio: "Non sono riuscito a caricare il file: controlla la connessione e riprova." } } : f3.porte.carica(p, b)) };
  const l3 = M.nuovoLavoro(foto());
  const e3 = await M.eseguiLavoro(l3, porte3);
  c("secondo invio fallito: ok false con la frase del client, non definitivo", [false, "Non sono riuscito a caricare il file: controlla la connessione e riprova.", false], [e3.ok, e3.frase, e3.definitivo]);
  c("…il registro NON parte", false, f3.log.some((x) => x[0] === "esegui"));
  c("…il primo file resta caricato e ricordato", ["480"], Object.keys(l3.caricati));
  f3.log.length = 0;
  const e3b = await M.eseguiLavoro(l3, porte3);
  c("ripresa: riuscita", true, e3b.ok);
  c("…ripete solo ciò che mancava: 2 permessi e 2 invii (non 3), poi il registro", ["permesso", "carica", "permesso", "carica", "esegui"], f3.log.map((x) => x[0]));
  c("…e il registro ha i tre percorsi, quello del primo invio compreso", true, ["path480", "path960", "path1600"].every((p) => typeof f3.log.find((x) => x[0] === "esegui")[2][p] === "string"));

  // ── il permesso che non arriva ──
  const f4 = porteFinte({ permesso: 1 });
  const l4 = M.nuovoLavoro(foto());
  const e4 = await M.eseguiLavoro(l4, f4.porte);
  c("permesso rifiutato: si ferma subito, con la frase del server", [false, "Non riesco a preparare il caricamento: riprova tra un momento.", 1], [e4.ok, e4.frase, f4.log.filter((x) => x[0] === "permesso").length]);
  c("…nessun invio senza permesso", false, f4.log.some((x) => x[0] === "carica"));

  // ── niente ritentativi infiniti ──
  const f5 = porteFinte({ permesso: 99 });
  const l5 = M.nuovoLavoro(foto());
  const esiti = [];
  for (let i = 0; i < 5; i++) esiti.push(await M.eseguiLavoro(l5, f5.porte));
  c("al massimo 3 tentativi: il quarto non parte nemmeno", [3, 3], [M.MAX_TENTATIVI, f5.log.filter((x) => x[0] === "permesso").length]);
  c("…il terzo fallimento è «definitivo» e dice di scegliere di nuovo la foto", [false, false, true, true, true], esiti.map((e) => e.ok === false && !!e.definitivo));
  c("…la frase del tentativo rifiutato", "Ho riprovato 3 volte senza riuscirci: scegli di nuovo la foto.", esiti[4].frase);
  const f6 = porteFinte();
  const l6 = M.nuovoLavoro(foto());
  await M.eseguiLavoro(l6, f6.porte);
  const n6 = f6.log.length;
  const e6 = await M.eseguiLavoro(l6, f6.porte);
  c("rilanciare un lavoro già finito non fa niente e dice ok", [true, n6], [e6.ok, f6.log.length]);

  // ── il registro fallisce dopo gli invii: i file non si rimandano ──
  const f7 = porteFinte({ media_registra: 1 });
  const l7 = M.nuovoLavoro(foto());
  const e7 = await M.eseguiLavoro(l7, f7.porte);
  c("registro fallito: ok false con la frase del server", [false, "Il server non risponde."], [e7.ok, e7.frase]);
  f7.log.length = 0;
  const e7b = await M.eseguiLavoro(l7, f7.porte);
  c("ripresa dopo un registro fallito: nessun nuovo permesso né invio, solo il registro", [true, ["esegui"]], [e7b.ok, f7.log.map((x) => x[0])]);

  // ── i caratteri della persona: dopo il registro, con media_flag ──
  const f8 = porteFinte({ avviso: "La foto è stata ritirata perché manca la liberatoria." });
  const e8 = await M.eseguiLavoro(M.nuovoLavoro(foto({ ritraePersone: true, liberatoriaOk: false })), f8.porte);
  const fl = f8.log.find((x) => x[1] === "media_flag");
  c("foto con una persona: dopo il registro parte media_flag con l'id nuovo", ["media_flag", { mediaId: "nuovo", flag: { ritraePersone: true, liberatoriaOk: false } }], [fl[1], fl[2]]);
  c("…l'avviso del server arriva a chi ha chiamato", "La foto è stata ritirata perché manca la liberatoria.", e8.avviso);
  const f9 = porteFinte();
  await M.eseguiLavoro(M.nuovoLavoro(foto()), f9.porte);
  c("foto senza persone, senza sottotitoli: nessun media_flag", false, f9.log.some((x) => x[1] === "media_flag"));
  const f10 = porteFinte({ media_flag: 1 });
  const l10 = M.nuovoLavoro(foto({ ritraePersone: true, liberatoriaOk: true }));
  const e10 = await M.eseguiLavoro(l10, f10.porte);
  f10.log.length = 0;
  await M.eseguiLavoro(l10, f10.porte);
  c("media_flag fallito: la foto c'è già; la ripresa rifà SOLO media_flag, non un secondo registro", [false, ["esegui"], "media_flag"], [e10.ok, f10.log.map((x) => x[0]), f10.log[0][1]]);

  const video = {
    prodottoId: "p1", slot: "video", sottoRuolo: null, alt: "Patch Rosa, video breve", tipo: "video", muto: false, testoParlato: "Ciao, sono io", durataS: 11.2,
    ritraePersone: false, liberatoriaOk: false, sottotitoliOk: true,
    file: [{ chiave: "video", tipo: "video", blob: blob(900), mime: "video/mp4" }, { chiave: "copertina", tipo: "copertina", blob: blob(40), mime: "image/jpeg", per: [960] }],
  };

  // ── media_flag che non riesce: una persona senza il suo segno NON resta in linea ──
  const persona = () => foto({ ritraePersone: true, liberatoriaOk: true });
  const FRASE_RITIRATA = "La foto non è stata pubblicata: riprova a caricarla.";
  const fl_g1 = porteFinte({ media_flag: 99, avvisoRitiro: "Senza foto principale il prodotto è tornato in bozza." });
  const fl_lg1 = M.nuovoLavoro(persona());
  const fl_r1 = [];
  for (let i = 0; i < 3; i++) fl_r1.push(await M.eseguiLavoro(fl_lg1, fl_g1.porte));
  c("flag fallito 1ª e 2ª volta: non definitivo, ma la foto è già salvata → `cambiato: true` (chi chiama deve rileggere)", [[true, true], [false, false]], [fl_r1.slice(0, 2).map((e) => e.ok === false && e.definitivo === false && e.cambiato === true), fl_r1.slice(0, 2).map((e) => !!e.ritirata)]);
  const fl_rit = fl_g1.log.filter((x) => x[1] === "media_rimuovi");
  c("flag fallito 3 volte con `ritraePersone`: il media si RITIRA con `media_rimuovi` e `liberatoriaRevocata: true`", [1, { prodottoId: "p1", mediaId: "nuovo", liberatoriaRevocata: true }], [fl_rit.length, fl_rit[0]?.[2]]);
  c("…l'esito dice che la foto non è stata pubblicata, che è definitivo, che l'archivio è cambiato, e porta l'avviso del server", [false, true, true, true, FRASE_RITIRATA, "Senza foto principale il prodotto è tornato in bozza."], [fl_r1[2].ok, fl_r1[2].definitivo, fl_r1[2].cambiato, fl_r1[2].ritirata, fl_r1[2].frase, fl_r1[2].avviso]);
  c("…la frase NON dice che la foto «non è stata salvata» né «scegli di nuovo» in modo falso", false, /scegli di nuovo/.test(fl_r1[2].frase));
  const fl_dopo = await M.eseguiLavoro(fl_lg1, fl_g1.porte);
  c("rilanciare un lavoro già ritirato: stesso esito, nessuna nuova chiamata", [true, fl_g1.log.filter((x) => x[1] === "media_rimuovi").length], [fl_dopo.ok === false && fl_dopo.frase === FRASE_RITIRATA, 1]);
  const fl_g2 = porteFinte({ media_flag: 99, media_rimuovi: 99 });
  const fl_lg2 = M.nuovoLavoro(persona());
  let fl_r2;
  for (let i = 0; i < 3; i++) fl_r2 = await M.eseguiLavoro(fl_lg2, fl_g2.porte);
  c("flag e ritiro falliti entrambi: la foto È in linea e lo si dice (senza «Scarta» falso), l'archivio è cambiato", [false, true, true, false, "La foto è salvata, ma non sono riuscito a registrare che ritrae una persona né a toglierla: aprila con Modifica e correggila subito."], [fl_r2.ok, fl_r2.definitivo, fl_r2.cambiato, !!fl_r2.ritirata, fl_r2.frase]);
  const fl_g3 = porteFinte({ media_flag: 99 });
  const fl_lg3 = M.nuovoLavoro(foto({ ritraePersone: false, sottotitoliOk: true }));
  let fl_r3;
  for (let i = 0; i < 3; i++) fl_r3 = await M.eseguiLavoro(fl_lg3, fl_g3.porte);
  c("flag fallito senza `ritraePersone`: NESSUN ritiro (non serve), solo una frase vera e `cambiato`", [0, false, true, true, "La foto è salvata, ma una sua impostazione non è stata registrata: aprila con Modifica e controllala."], [fl_g3.log.filter((x) => x[1] === "media_rimuovi").length, fl_r3.ok, fl_r3.definitivo, fl_r3.cambiato, fl_r3.frase]);
  const fl_g4 = porteFinte({ media_flag: 99 });
  const fl_lg4 = M.nuovoLavoro({ ...video, ritraePersone: false, sottotitoliOk: true });
  let fl_r4;
  for (let i = 0; i < 3; i++) fl_r4 = await M.eseguiLavoro(fl_lg4, fl_g4.porte);
  c("lo stesso per un video: la frase parla del video", "Il video è salvato, ma una sua impostazione non è stata registrata: aprilo con Modifica e controllalo.", fl_r4.frase);
  const fl_g5 = porteFinte({ permesso: 99 });
  const fl_r5 = await M.eseguiLavoro(M.nuovoLavoro(persona()), fl_g5.porte);
  c("un fallimento PRIMA del registro non cambia niente sul server: `cambiato` falso", [false, false], [fl_r5.ok, fl_r5.cambiato]);
  const fl_g6 = porteFinte({ media_registra: 99 });
  const fl_r6 = await M.eseguiLavoro(M.nuovoLavoro(persona()), fl_g6.porte);
  c("registro fallito: `cambiato` falso e nessun ritiro", [false, 0], [fl_r6.cambiato, fl_g6.log.filter((x) => x[1] === "media_rimuovi").length]);

  // ── il video ──
  const f11 = porteFinte();
  const e11 = await M.eseguiLavoro(M.nuovoLavoro(video), f11.porte);
  const rv = f11.log.find((x) => x[1] === "media_registra");
  c("video: due permessi (video e copertina), poi media_registra con i due percorsi, la durata intera e il testo parlato", [true, ["permesso", "carica", "permesso", "carica", "esegui", "esegui"], { slot: "video", pathVideo: "video/p1.mp4", pathCopertina: "copertina/p2.jpg", durataS: 12, muto: false, testoParlato: "Ciao, sono io" }], [e11.ok, f11.log.map((x) => x[0]), { slot: rv[2].slot, pathVideo: rv[2].pathVideo, pathCopertina: rv[2].pathCopertina, durataS: rv[2].durataS, muto: rv[2].muto, testoParlato: rv[2].testoParlato }]);
  c("…e i sottotitoli messi arrivano con media_flag dopo il registro", ["media_flag", { mediaId: "nuovo", flag: { sottotitoliOk: true } }], [f11.log[5][1], f11.log[5][2]]);
  const f12 = porteFinte();
  await M.eseguiLavoro(M.nuovoLavoro({ ...video, muto: true, testoParlato: null, sottotitoliOk: false }), f12.porte);
  const rm = f12.log.find((x) => x[1] === "media_registra")[2];
  c("video muto: `muto` true nel registro, nessun testo parlato, nessun media_flag", [true, null, false], [rm.muto, rm.testoParlato, f12.log.some((x) => x[1] === "media_flag")]);
  const f13 = porteFinte();
  await M.eseguiLavoro(M.nuovoLavoro({ ...video, file: [video.file[0]] }), f13.porte);
  c("video senza copertina: si registra senza (la copertina è un di più, la scheda lo dirà)", [null], [f13.log.find((x) => x[1] === "media_registra")[2].pathCopertina]);

  // ── porte che lanciano ──
  const f14 = porteFinte();
  const brutte = { ...f14.porte, carica: async () => { throw new Error("segreto-token-123"); } };
  const e14 = await M.eseguiLavoro(M.nuovoLavoro(foto()), brutte);
  c("una porta che lancia: ok false con una frase nostra, mai il testo dell'eccezione", [false, false], [e14.ok, /segreto/.test(JSON.stringify(e14))]);
}
