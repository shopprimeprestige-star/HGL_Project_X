/** ── PROVE: CHAT WHATSAPP · MEDIA E SEGNAPOSTO ─────────────────────────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), PIANO.md T2 (D8, D10, D14, R1, R8).
 *  Il testo lo scrive il cliente su una rotta pubblica: qui si prova che
 *  (1) un media è riconosciuto SOLO se è un URL di manybot-files nella forma
 *  vista dal vivo, (2) tutto il resto resta testo (mai un link né un `src`),
 *  (3) nessun testo, per cattivo che sia, fa lavorare le funzioni più di 50 ms.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */

export async function proveChatMedia(mod, { c, gruppo }) {
  const { classificaTesto, eSoloSegnaposto, anteprimaIn, HOST_MEDIA_AMMESSI } = mod["chatwa/media"];

  const H = "manybot-files.s3.eu-central-1.amazonaws.com";
  const H2 = "manybot-files.s3.amazonaws.com";
  const P = "pagina123/wa/2026/10/28";
  const url = (file, host = H) => `https://${host}/${P}/${file}`;
  const tipo = (t) => classificaTesto(t).tipo;

  // ── I MEDIA RICONOSCIUTI ─────────────────────────────────────────────────────
  gruppo("CHAT MEDIA · I LINK DI MANYCHAT (D14)");
  c("host ammessi: i due di ManyChat", [H, H2], [...HOST_MEDIA_AMMESSI]);

  const vero = classificaTesto(url("original_abc123.ogg"));
  c(".ogg del titolare → audio", "audio", vero.tipo);
  c("  etichetta «🎤 Vocale»", "🎤 Vocale", vero.etichetta);
  c("  url = href normalizzato", url("original_abc123.ogg"), vero.url);
  for (const est of ["oga", "mp3", "m4a", "opus", "aac", "amr", "OGG", "Mp3"]) {
    c(`.${est} → audio`, "audio", tipo(url(`x.${est}`)));
  }
  for (const est of ["jpg", "jpeg", "png", "webp", "JPG"]) {
    c(`.${est} → immagine`, "immagine", tipo(url(`x.${est}`)));
  }
  c("immagine: etichetta «📷 Foto»", "📷 Foto", classificaTesto(url("x.jpg")).etichetta);
  c(".mp4 → video", "video", tipo(url("x.mp4")));
  c("video: etichetta «🎥 Video»", "🎥 Video", classificaTesto(url("x.mp4")).etichetta);
  c(".pdf → documento", "documento", tipo(url("x.pdf")));
  c("documento: etichetta «📎 Documento»", "📎 Documento", classificaTesto(url("x.pdf")).etichetta);
  c(".zip → allegato", "allegato", tipo(url("x.zip")));
  c("senza estensione → allegato", "allegato", tipo(url("x")));
  c("allegato: etichetta «📎 Allegato»", "📎 Allegato", classificaTesto(url("x.zip")).etichetta);
  c("secondo host ammesso → audio", "audio", tipo(url("x.ogg", H2)));
  c("query string ammessa (link firmati)", "audio", tipo(url("x.ogg") + "?X-Amz-Signature=abc&e=1"));
  c("  e l'url la conserva", url("x.ogg") + "?X-Amz-Signature=abc&e=1", classificaTesto(url("x.ogg") + "?X-Amz-Signature=abc&e=1").url);
  c("spazi e a capo FUORI dal link si tolgono", "audio", tipo(`  ${url("x.ogg")}\n`));
  c("  e l'url è pulito", url("x.ogg"), classificaTesto(`  ${url("x.ogg")}\n`).url);
  c("virgolette nel nome: ammesse ma l'url le esce codificate (%22)", [ "audio", url('x%22.ogg') ], (({ tipo, url: u }) => [tipo, u])(classificaTesto(url('x".ogg'))));
  c("tab finale tolto come lo spazio", "audio", tipo(url("x.ogg") + "\t"));

  // ── R8: LE FORME CATTIVE ─────────────────────────────────────────────────────
  gruppo("CHAT MEDIA · I LINK CATTIVI RESTANO TESTO (R8)");
  c("schema HTTPS:// maiuscolo → ammesso", "audio", tipo(`HTTPS://${H}/${P}/x.ogg`));
  c("  e l'url è l'href in minuscolo", url("x.ogg"), classificaTesto(`HTTPS://${H}/${P}/x.ogg`).url);
  c("host MAIUSCOLO → ammesso", "audio", tipo(`https://${H.toUpperCase()}/${P}/x.ogg`));
  c("  e l'url ha l'host in minuscolo", url("x.ogg"), classificaTesto(`https://${H.toUpperCase()}/${P}/x.ogg`).url);

  const testi = {
    "http:// al posto di https://": `http://${H}/${P}/x.ogg`,
    "host diverso": `https://evil.example/${P}/x.ogg`,
    "host ammesso come sottodominio di evil": `https://${H}.evil.example/${P}/x.ogg`,
    "host con prefisso": `https://x${H}/${P}/x.ogg`,
    "host con punto finale": `https://${H}./${P}/x.ogg`,
    "user:pass@ davanti": `https://user:pass@${H}/${P}/x.ogg`,
    "solo user@ davanti": `https://user@${H}/${P}/x.ogg`,
    "porta :8443": `https://${H}:8443/${P}/x.ogg`,
    "porta :443 esplicita": `https://${H}:443/${P}/x.ogg`,
    "frammento #x": `https://${H}/${P}/x.ogg#x`,
    "frammento vuoto #": `https://${H}/${P}/x.ogg#`,
    "frase attorno": `ascolta ${url("x.ogg")}`,
    "frase dopo": `${url("x.ogg")} grazie`,
    "due URL": `${url("x.ogg")} ${url("y.ogg")}`,
    "due URL su due righe": `${url("x.ogg")}\n${url("y.ogg")}`,
    "spazio dentro": `https://${H}/${P}/x y.ogg`,
    "a capo dentro il percorso": `https://${H}/${P}/x\ny.ogg`,
    "a capo dentro l'host": `https://manybot-files.s3.eu-central-1\n.amazonaws.com/${P}/x.ogg`,
    "tab dentro l'host": `https://manybot-files.s3.eu-central-1.amazon\taws.com/${P}/x.ogg`,
    "a capo e poi un altro host": `${url("x.ogg")}\nhttps://evil.example/x`,
    "a capo e poi un altro host (CR)": `${url("x.ogg")}\rhttps://evil.example/x`,
    "backslash prima di @evil": `https://${H}\\@evil.example/${P}/x.ogg`,
    "backslash nel percorso": `https://${H}/pagina123\\wa/2026/10/28/x.ogg`,
    "%2e nel percorso": `https://${H}/%2e%2e/wa/2026/10/28/x.ogg`,
    "%2E maiuscolo": `https://${H}/pagina123/wa/2026/10/28/%2E%2E.ogg`,
    "%2f nel percorso": `https://${H}/pagina123%2Fwa/2026/10/28/x.ogg`,
    "%5c nel percorso": `https://${H}/pagina123%5Cwa/2026/10/28/x.ogg`,
    "percorso /x.ogg": `https://${H}/x.ogg`,
    "percorso /p/wa/x.ogg": `https://${H}/p/wa/x.ogg`,
    "percorso con un livello in più": `https://${H}/${P}/a/b.ogg`,
    "percorso senza file": `https://${H}/${P}/`,
    "percorso senza la pagina": `https://${H}/wa/2026/10/28/x.ogg`,
    "anno a due cifre": `https://${H}/p/wa/26/10/28/x.ogg`,
    "mese a tre cifre": `https://${H}/p/wa/2026/010/28/x.ogg`,
    "«wa» diverso": `https://${H}/p/xx/2026/10/28/x.ogg`,
    "punti nel percorso (..)": `https://${H}/${P}/../x.ogg`,
    "estensione finta nell'host, nessuna nel percorso": `https://evil.example/.ogg`,
    "javascript:": "javascript:alert(1)",
    "data:": "data:audio/ogg;base64,AAAA",
    "ftp:": `ftp://${H}/${P}/x.ogg`,
    "schema vuoto //": `//${H}/${P}/x.ogg`,
    "senza schema": `${H}/${P}/x.ogg`,
    "carattere non ASCII": `https://${H}/${P}/è.ogg`,
    "solo lo schema": "https://",
    "testo semplice": "ciao, sono Anna",
  };
  for (const [nome, t] of Object.entries(testi)) {
    const r = classificaTesto(t);
    c(`${nome} → testo`, "testo", r.tipo);
    c(`  e nessun url`, undefined, r.url);
  }
  c("testo normale: l'etichetta è il testo stesso", "ciao, sono Anna", classificaTesto("ciao, sono Anna").etichetta);

  // ── SEGNAPOSTO ───────────────────────────────────────────────────────────────
  gruppo("CHAT MEDIA · I SEGNAPOSTO NON RISOLTI (D8)");
  const sp = [
    ["{{last_input_text}}", true],
    ["{{a}} {{b}}", true],
    ["{{a}}{{b}}", true],
    ["  {{a}}  ", true],
    ["\n{{a}}\n{{b}}\n", true],
    ["{{}}", true],
    ["{{a}} ciao", false],
    ["ciao {{a}}", false],
    ["{}", false],
    ["{ciao}", false],
    ["{{a}", false],
    ["{{a}}}", false],
    ["{{{a}}}", false],
    ["{{a{b}}}", false],
    ["", false],
    ["   ", false],
    ["ciao", false],
  ];
  for (const [t, atteso] of sp) c(`eSoloSegnaposto(${JSON.stringify(t)})`, atteso, eSoloSegnaposto(t));
  for (const v of [null, undefined, 5, {}, []]) c(`eSoloSegnaposto(${JSON.stringify(v)}) non lancia → false`, false, eSoloSegnaposto(v));

  c("{{last_input_text}} → illeggibile", "illeggibile", tipo("{{last_input_text}}"));
  c("  etichetta «Messaggio non leggibile»", "Messaggio non leggibile", classificaTesto("{{last_input_text}}").etichetta);
  c("  nessun url", undefined, classificaTesto("{{last_input_text}}").url);
  c("{{a}} {{b}} → illeggibile", "illeggibile", tipo("{{a}} {{b}}"));
  c("[messaggio senza testo] → illeggibile", "illeggibile", tipo("[messaggio senza testo]"));
  c("  anche con spazi attorno", "illeggibile", tipo("  [messaggio senza testo]\n"));
  c("{{a}} ciao → testo", "testo", tipo("{{a}} ciao"));
  c("{} e {ciao} → testo", ["testo", "testo"], [tipo("{}"), tipo("{ciao}")]);
  c("stringa vuota → testo, etichetta vuota", { tipo: "testo", etichetta: "" }, classificaTesto(""));

  // ── R1: IL TEMPO ─────────────────────────────────────────────────────────────
  gruppo("CHAT MEDIA · NESSUN TESTO FA LAVORARE TROPPO (R1)");
  const cattivi = {
    '"{{a}}  " ×40 + x': "{{a}}  ".repeat(40) + "x",
    '"{{a}}" ×2000 + x': "{{a}}".repeat(2000) + "x",
    "10000 spazi + x": " ".repeat(10000) + "x",
    '"{{" + 10000 a': "{{" + "a".repeat(10000),
    '"{{a}} " ×5000 + {': "{{a}} ".repeat(5000) + "{",
    "10000 a capo + x": "\n".repeat(10000) + "x",
    "URL da 8000 caratteri nel percorso": `https://${H}/${P}/${"a".repeat(8000)}.ogg`,
    "URL da 8000 caratteri nella query": `${url("x.ogg")}?${"a".repeat(8000)}`,
    "URL da 8000 barre": `https://${H}/${"/".repeat(8000)}`,
    "8000 caratteri di https://": "https://".repeat(1000),
  };
  for (const [nome, t] of Object.entries(cattivi)) {
    for (const [fn, f] of [["classificaTesto", classificaTesto], ["eSoloSegnaposto", eSoloSegnaposto], ["anteprimaIn", anteprimaIn]]) {
      const da = performance.now();
      f(t);
      const ms = performance.now() - da;
      c(`${fn}(${nome}) sotto 50 ms`, true, ms < 50);
    }
  }

  // ── ANTEPRIMA ────────────────────────────────────────────────────────────────
  gruppo("CHAT MEDIA · L'ANTEPRIMA IN ELENCO (D10)");
  c("testo corto invariato", "ciao Anna", anteprimaIn("ciao Anna"));
  c("100 caratteri esatti: invariato", "a".repeat(100), anteprimaIn("a".repeat(100)));
  c("101 caratteri → 100 + «…»", "a".repeat(100) + "…", anteprimaIn("a".repeat(101)));
  c("300 caratteri → 100 + «…»", "b".repeat(100) + "…", anteprimaIn("b".repeat(300)));
  c("vocale → «🎤 Vocale»", "🎤 Vocale", anteprimaIn(url("x.ogg")));
  c("foto → «📷 Foto»", "📷 Foto", anteprimaIn(url("x.jpg")));
  c("video → «🎥 Video»", "🎥 Video", anteprimaIn(url("x.mp4")));
  c("pdf → «📎 Documento»", "📎 Documento", anteprimaIn(url("x.pdf")));
  c("altro allegato → «📎 Allegato»", "📎 Allegato", anteprimaIn(url("x.zip")));
  c("{{...}} → «Messaggio non leggibile»", "Messaggio non leggibile", anteprimaIn("{{last_input_text}}"));
  c("[messaggio senza testo] → «Messaggio non leggibile»", "Messaggio non leggibile", anteprimaIn("[messaggio senza testo]"));
  c("link di altro host: resta il testo (troncato)", ("https://evil.example/" + "a".repeat(200)).slice(0, 100) + "…", anteprimaIn("https://evil.example/" + "a".repeat(200)));
  for (const v of [null, undefined, 5, {}, []]) {
    let esito;
    try { esito = anteprimaIn(v); } catch { esito = "LANCIA"; }
    c(`anteprimaIn(${JSON.stringify(v)}) non lancia → ""`, "", esito);
    let cl;
    try { cl = classificaTesto(v).tipo; } catch { cl = "LANCIA"; }
    c(`classificaTesto(${JSON.stringify(v)}) non lancia → testo`, "testo", cl);
  }

  // niente emoji tagliate a metà
  const famiglia = "👨‍👩‍👧‍👦";
  const t99 = "a".repeat(99);
  c("emoji ZWJ al limite: intera, mai a metà", t99 + famiglia + "…", anteprimaIn(t99 + famiglia + "b".repeat(10)));
  c("emoji semplice al limite: intera", t99 + "😀" + "…", anteprimaIn(t99 + "😀" + "b".repeat(10)));
  c("100 emoji: invariato (≠ 100 unità di testo)", "😀".repeat(100), anteprimaIn("😀".repeat(100)));
  c("150 emoji → 100 emoji + «…»", "😀".repeat(100) + "…", anteprimaIn("😀".repeat(150)));
  const fine = anteprimaIn("😀".repeat(150));
  c("  nessuna metà di coppia surrogata", false, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(fine));
}
