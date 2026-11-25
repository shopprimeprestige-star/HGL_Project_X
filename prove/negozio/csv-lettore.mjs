/** ── EDITOR PRODOTTI · E2a · IL LETTORE CSV ────────────────────────────────
 *  `src/crm/negozio/csv-lettore.ts`: da byte a righe di celle. UTF-8 con ripiego Windows-1252, `,` e `;`, virgolette, e il
 *  file ostile (virgolette mai chiuse, NUL e bidi, limiti, tempi). Dati inventati. Il modulo si impacchetta qui con esbuild. */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const utf8 = (s) => new TextEncoder().encode(s);
const latin1 = (s) => Uint8Array.from(Buffer.from(s, "latin1"));

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E2a · LETTORE CSV: CODIFICA, SEPARATORE, VIRGOLETTE, FILE OSTILE (25/11/2026)");
  const M = await carica(radice, "src/crm/negozio/csv-lettore.ts").catch((e) => ({ errore: String(e) }));
  c("csv-lettore.ts si compila e si carica", undefined, M.errore);
  if (M.errore) return;
  const L = (s) => M.leggiCsv(typeof s === "string" ? utf8(s) : s);

  // ── codifica ──
  const a = L("Handle,Title\nsiero,Siero è bello\n");
  c("UTF-8 senza BOM", [true, "utf-8", [["Handle", "Title"], ["siero", "Siero è bello"]], []], [a.ok, a.codifica, a.record, a.avvisi]);
  const b = L(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8("Handle,Title\nsiero,Crème\n")]));
  c("UTF-8 con BOM: il segnaposto non finisce nella prima intestazione", ["Handle", "utf-8", "Crème"], [b.record[0][0], b.codifica, b.record[1][1]]);
  const w = L(latin1("Handle;Title\nsiero;Caff\xE8 \xE0 \xF9 \xEC \xF2\n"));
  c("Windows-1252 con gli accenti: letto bene, senza avvisi", ["windows-1252", "Caffè à ù ì ò", []], [w.codifica, w.record[1][1], w.avvisi]);
  const eur = L(Uint8Array.from([...latin1("Handle,Title\nx,Prezzo "), 0x80, ...latin1("\n")]));
  c("Windows-1252: il simbolo dell'euro (byte 0x80)", "Prezzo €", eur.record[1][1]);
  const rotto = L(Uint8Array.from([...latin1("Handle,Title\nx,Pro"), 0x81, ...latin1("va\n")]));
  c("Windows-1252 con un byte non definito → avviso «caratteri che non riesco a leggere»", [1, true], [rotto.avvisi.length, /non riesco a leggere/.test(rotto.avvisi[0])]);
  const fffd = L("Handle,Title\nx,Pro�va\n");
  c("UTF-8 con il carattere rotto → avviso, il testo resta com'è", [1, "Pro�va"], [fffd.avvisi.length, fffd.record[1][1]]);
  const bomFallback = L(Uint8Array.from([0xef, 0xbb, 0xbf, ...latin1("Handle,Title\nx,Caff\xE8\n")]));
  c("BOM UTF-8 più un byte non UTF-8 (ripiego Windows-1252): la prima intestazione resta «Handle»", ["windows-1252", "Handle", "Caffè"], [bomFallback.codifica, bomFallback.record[0][0], bomFallback.record[1][1]]);
  c("UTF-16 → rifiutato con la frase, non letto a caso", [false, true], (({ ok, frase }) => [ok, /UTF-16/.test(frase)])(L(Uint8Array.from([0xff, 0xfe, 0x48, 0x00]))));

  // ── separatore ──
  c("virgola riconosciuta dall'intestazione", ",", L("a,b,c\n1,2,3\n").separatore);
  c("punto e virgola riconosciuto (Excel italiano)", [";", [["a", "b", "c"], ["1,5", "2", "3"]]], (({ separatore, record }) => [separatore, record])(L("a;b;c\n1,5;2;3\n")));
  c("i punti e virgola dentro le virgolette dell'intestazione non contano", ",", L('"a;b;c",d\n1,2\n').separatore);
  c("intestazione di una colonna sola → virgola", ",", L("Handle\nx\n").separatore);

  // ── virgolette e a capo ──
  c("virgola dentro le virgolette", [["a", "b"], ["uno, due", "tre"]], L('a,b\n"uno, due",tre\n').record);
  c("a capo dentro una cella tra virgolette", [["a", "b"], ["riga1\nriga2", "x"]], L('a,b\n"riga1\nriga2",x\n').record);
  c("«\"\"» dentro le virgolette è una virgoletta sola", [["a"], ['dice "ciao" e basta']], L('a\n"dice ""ciao"" e basta"\n').record);
  c("cella che è solo «\"\"\"\"» → una virgoletta", [["a"], ['"']], L('a\n""""\n').record);
  c("cella tra virgolette vuota", [["a", "b"], ["", "x"]], L('a,b\n"",x\n').record);
  c("una virgoletta in mezzo a una cella senza virgolette resta com'è", [["a"], ['5" di lunghezza']], L('a\n5" di lunghezza\n').record);
  c("testo dopo la virgoletta di chiusura: accodato, come fa Excel", [["a", "b"], ["xyz", "q"]], L('a,b\n"x"yz,q\n').record);
  c("a capo di Windows (CRLF)", [["a", "b"], ["1", "2"], ["3", "4"]], L("a,b\r\n1,2\r\n3,4\r\n").record);
  c("CR da solo come a capo", [["a", "b"], ["1", "2"], ["3", "4"]], L("a,b\r1,2\r3,4\r").record);
  c("CRLF dentro le virgolette resta dentro la cella", [["a"], ["x\r\ny"]], L('a\n"x\r\ny"\n').record);

  // ── fine del file e righe particolari ──
  c("riga finale senza a capo", [["a", "b"], ["1", "2"]], L("a,b\n1,2").record);
  c("a capo finale: nessuna riga fantasma", 2, L("a,b\n1,2\n").record.length);
  c("riga finale che finisce con una virgola → cella vuota in coda", [["a", "b"], ["1", ""]], L("a,b\n1,").record);
  c("celle vuote in mezzo", [["a", "b", "c"], ["", "x", ""]], L("a,b,c\n,x,\n").record);
  c("le righe vuote restano (il numero di riga di Excel è posizione + 1)", [["a"], [""], ["x"]], L("a\n\nx\n").record);
  c("file di sole intestazioni: solo l'intestazione", [["a", "b"]], L("a,b\n").record);

  // ── i limiti, PRIMA di leggere ──
  c("file vuoto → frase", [false, "Il file è vuoto."], (({ ok, frase }) => [ok, frase])(L(new Uint8Array(0))));
  const xlsx = L(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, ...new Array(40).fill(0x41)]));
  c("un .xlsx (magic «PK\\x03\\x04», anche se chiamato .csv) → «CSV UTF-8»", [false, true], [xlsx.ok, /CSV UTF-8/.test(xlsx.frase)]);
  c("il vecchio .xls (magic OLE) → stessa frase", [false, true], (({ ok, frase }) => [ok, /CSV UTF-8/.test(frase)])(L(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]))));
  c("2 MB esatti: il limite dei byte non scatta (il file è comunque una cella sola, e lo dice un'altra frase)", false, /troppo grande/.test(L(new Uint8Array(M.MAX_BYTE).fill(0x61)).frase ?? ""));
  const grande = L(new Uint8Array(M.MAX_BYTE + 1).fill(0x61));
  c("oltre 2 MB → frase che dice il limite", true, /2 MB/.test(grande.frase));
  const righe = (n) => "a,b\n" + Array.from({ length: n }, (_, i) => `${i},x`).join("\n") + "\n";
  c("5000 righe di dati passano", [true, 5001], (({ ok, record }) => [ok, record?.length])(L(righe(5000))));
  const troppe = L(righe(5001));
  c("5001 righe di dati → errore col limite", [false, true], [troppe.ok, /5000/.test(troppe.frase)]);
  c("le righe vuote in fondo non contano nel limite né restano nel risultato", [true, 5001], (({ ok, record }) => [ok, record?.length])(L(righe(5000) + "\n\n\n")));

  // ── il file sul File, prima di arrayBuffer() ──
  const F = (name, size) => M.controllaFile({ name, size });
  c("controllaFile: .csv normale va", { ok: true }, F("prodotti.csv", 1000));
  c("controllaFile: maiuscole nell'estensione", { ok: true }, F("PRODOTTI.CSV", 1000));
  c("controllaFile: .xlsx → «CSV UTF-8», senza leggere niente", [false, true], (({ ok, frase }) => [ok, /CSV UTF-8/.test(frase)])(F("prodotti.xlsx", 5000)));
  c("controllaFile: un file diverso → chiede un .csv", [false, true], (({ ok, frase }) => [ok, /\.csv/.test(frase)])(F("foto.png", 5000)));
  c("controllaFile: oltre 2 MB → frase", [false, true], (({ ok, frase }) => [ok, /2 MB/.test(frase)])(F("grande.csv", M.MAX_BYTE + 1)));
  c("controllaFile: 2 MB esatti vanno", true, F("giusto.csv", M.MAX_BYTE).ok);
  c("controllaFile: file vuoto → frase", false, F("vuoto.csv", 0).ok);

  // ── OSTILE: virgolette non chiuse ──
  const nonChiuse = L('Handle,Title\nx,"mai chiusa\nriga3,altro\nriga4,altro\n');
  c("virgoletta mai chiusa → errore con il numero di riga, non un file intero in una cella", [false, true], [nonChiuse.ok, /riga 2/.test(nonChiuse.frase)]);
  let t0 = performance.now();
  const enorme = L('a,b\n1,"' + "x".repeat(M.MAX_BYTE - 20));
  c("virgoletta aperta su 2 MB → si ferma con errore, in meno di un secondo", [false, true], [enorme.ok, performance.now() - t0 < 1000]);
  const conVuote = L('a\n\n\n\nx,"mai');
  c("il numero di riga conta anche le righe vuote prima (`a\\n\\n\\n\\nx,\"mai` → riga 5)", [false, true], [conVuote.ok, /riga 5\b/.test(conVuote.frase)]);
  const lungaDopoVuote = L('a\n\n\n"' + "x".repeat(M.MAX_CELLA_LETTURA + 5) + '"\n');
  c("cella lunghissima dopo due righe vuote → riga 4", true, /riga 4\b/.test(lungaDopoVuote.frase));
  const lungaNudaDopoVuote = L("a\n\n\n" + "x".repeat(M.MAX_CELLA_LETTURA + 5) + "\n");
  c("stessa cosa senza virgolette → riga 4", true, /riga 4\b/.test(lungaNudaDopoVuote.frase));
  const lunga = L('a\n"' + "x".repeat(M.MAX_CELLA_LETTURA + 5) + '"\n');
  c("una cella tra virgolette oltre il tetto di lettura → errore, anche se chiusa", [false, true], [lunga.ok, /lunghissima/.test(lunga.frase)]);
  const lungaNuda = L("a\n" + "x".repeat(M.MAX_CELLA_LETTURA + 5) + "\n");
  c("stessa cosa per una cella senza virgolette", false, lungaNuda.ok);
  const seimila = L("a\n" + "x".repeat(6000) + "\n");
  c("una cella da 6000 passa dal lettore: il tetto per cella lo applica E2b, riga per riga, con la sua frase", [true, 6000, 6000], [seimila.ok, seimila.record[1][0].length, M.MAX_CELLA]);

  // ── OSTILE: NUL, controllo, bidi ──
  const sporco = L("Handle,Title\nx,A\u0000B\u0007C‮DE⁦F‎G\u007FH\u0085I\n");
  c("NUL, controlli, bidi, DEL e C1 tolti dalle celle", "ABCDEFGHI", sporco.record[1][1]);
  c("…e un avviso con quanti sono", [1, true], [sporco.avvisi.length, /Ho tolto 7 caratteri/.test(sporco.avvisi[0])]);
  c("tab, a capo dentro le virgolette e Unicode normale restano", "a\tb\nc è 日本", L('x\n"a\tb\nc è 日本"\n').record[1][0]);
  c("nessun avviso su un file pulito", [], L("a,b\n1,2\n").avvisi);

  // ── OSTILE: nomi che pesano nei dizionari ──
  const proto = L("__proto__,constructor,toString,hasOwnProperty\n1,2,3,4\n");
  c("intestazioni __proto__, constructor, toString: sono solo testo, il risultato è fatto di array", [["__proto__", "constructor", "toString", "hasOwnProperty"], true], [proto.record[0], Array.isArray(proto.record) && Object.getPrototypeOf(proto.record[0]) === Array.prototype]);
  c("il lettore non sporca i prototipi", [undefined, undefined], [{}.polluted, [].polluted]);

  // ── lineare: 2 MB in meno di un secondo ──
  const riga = `siero,"${"x".repeat(150)}","${"a \"\"b\"\" c, d ".repeat(15)}"\n`;
  const duemb = "h,t,d\n" + riga.repeat(5000);
  t0 = performance.now();
  const r2mb = L(duemb);
  const ms = performance.now() - t0;
  c("circa 2 MB e 5000 righe vere: lette tutte, in meno di un secondo", [true, 5001, true, true], [r2mb.ok, r2mb.record?.length, duemb.length > 1_500_000, ms < 1000]);
  const molte = "a,b\n" + "1,2\n".repeat(5000);
  t0 = performance.now();
  const rm = L(molte);
  c("5000 righe corte: letto, in meno di un secondo", [true, true], [rm.ok, performance.now() - t0 < 1000]);
  const unaGrossa = "a\n" + '"' + "ab\"\"".repeat(10000) + '"\n';
  t0 = performance.now();
  const rg = L(unaGrossa);
  c("una cella da 40000 caratteri con 10000 «\"\"»: lineare, e le virgolette sono 10000", [true, 10000, true], [rg.ok, rg.record?.[1][0].split('"').length - 1, performance.now() - t0 < 1000]);
  c("lettore lineare: nel sorgente nessun «+=» sulle celle", false, /\bcella\s*\+=|\bpezzi\s*\+=|\bt\s*\+=/.test((await import("node:fs")).readFileSync(join(radice, "src/crm/negozio/csv-lettore.ts"), "utf8")));
}
