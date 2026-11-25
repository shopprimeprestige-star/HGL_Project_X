/** ── EDITOR PRODOTTI · E2a · DA HTML A TESTO ───────────────────────────────
 *  `src/crm/negozio/html-testo.ts`: la colonna «Body (HTML)» diventa testo con paragrafi. Niente DOM, entità decodificate
 *  una volta sola, script e stile buttati col loro contenuto. Dati inventati. */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E2a · DA HTML A TESTO: TAG, ENTITÀ, TESTO OSTILE (25/11/2026)");
  const M = await carica(radice, "src/crm/negozio/html-testo.ts").catch((e) => ({ errore: String(e) }));
  c("html-testo.ts si compila e si carica", undefined, M.errore);
  if (M.errore) return;
  const T = M.htmlInTesto;

  // ── i tag ──
  c("paragrafi → testo con una riga vuota fra l'uno e l'altro", "Primo.\n\nSecondo.", T("<p>Primo.</p><p>Secondo.</p>"));
  c("<br> → a capo", "uno\ndue\ntre", T("uno<br>due<br/>tre<BR />"));
  c("<ul><li> → un elenco con «- »", "Contiene:\n\n- acqua\n- glicerina", T("<p>Contiene:</p><ul><li>acqua</li><li>glicerina</li></ul>"));
  c("<script> e <style> spariscono COL contenuto", "Ciao Fine", T('Ciao <script>alert("x")</script><style>p{color:red}</style>Fine'));
  c("<SCRIPT> in maiuscolo e con attributi", "ab", T('a<SCRIPT type="text/javascript">x()</SCRIPT >b'));
  c("<script> mai chiuso: tutto il resto va via, niente resta", "prima", T("prima<script>alert(1) e poi altro testo"));
  c("le immagini spariscono (le foto non si importano)", "Guarda qui", T('Guarda <img src="https://esempio.it/a.jpg" alt="foto"> qui'));
  c("immagine con «>» dentro un attributo", "ab", T('a<img alt="x > y" src="z">b'));
  c("i commenti spariscono", "ab", T("a<!-- nascosto <b>x</b> -->b"));
  c("i titoli e i div chiudono un paragrafo", "Titolo\n\nCorpo", T("<h2>Titolo</h2><div>Corpo</div>"));
  c("gli attributi (link, stile, evento) non entrano nel testo", "vedi sito", T('vedi <a href="https://x.it" onclick="rubo()" style="color:red">sito</a>'));
  c("un «<» che non apre un tag resta testo", "se a < b allora 3 <5", T("se a < b allora 3 <5"));
  c("un tag mai chiuso a fine testo non lascia pezzi", "prima", T("prima <a href=\"x"));
  c("grassetto, corsivo, span: si toglie il tag, resta il testo", "molto bello", T("<b>molto</b> <em>bello</em>"));

  // ── gli a capo del sorgente ──
  c("dentro l'HTML un a capo del sorgente è uno spazio", "una frase lunga\n\naltra", T("<p>una frase\nlunga</p>\n<p>altra</p>"));
  c("senza tag un a capo è un a capo vero", "riga1\nriga2\n\nriga4", T("riga1\r\nriga2\n\n\n\nriga4"));
  c("spazi e tab ripetuti si riducono, i bordi si puliscono", "a b", T("  a \t  b \n "));
  c("vuoto, null, undefined → stringa vuota", ["", "", ""], [T(""), T(null), T(undefined)]);

  // ── entità: UNA volta sola ──
  c("&amp;lt;script&amp;gt; → «&lt;script&gt;», mai «<script>»", "&lt;script&gt;", T("&amp;lt;script&amp;gt;"));
  c("&amp;amp; → «&amp;»", "&amp;", T("&amp;amp;"));
  c("&lt;b&gt; → testo «<b>» (resta testo, non è un tag e non si rilegge)", "<b>", T("&lt;b&gt;"));
  c("le entità di tutti i giorni", "Crème & Siero «A» – 5 € à è é ì ò ù", T("Cr&egrave;me &amp; Siero &laquo;A&raquo; &ndash; 5 &euro; &agrave; &egrave; &eacute; &igrave; &ograve; &ugrave;"));
  c("&nbsp; è uno spazio", "a b", T("a&nbsp;b"));
  c("numeriche decimali ed esadecimali", "È è €", T("&#200; &#xE8; &#x20AC;"));
  c("entità sconosciuta: lasciata com'è", "&inesistente; e &", T("&inesistente; e &amp;"));
  c("entità con maiuscole che non esistono nella tabella non diventano altro", "&AMP;", T("&AMP;"));
  c("numeriche pericolose (NUL, controllo, surrogato, fuori Unicode, segnaposto interno) → tolte", "ab", T("a&#0;&#7;&#xD800;&#x110000;&#xE000;&#xE001;&#127;b"));
  c("il segnaposto interno scritto nel testo non diventa un a capo", "ab", T("ab"));
  c("«__proto__» come nome di entità non è un'entità", "&__proto__; &constructor; &toString;", T("&__proto__; &constructor; &toString;"));
  c("un tag scritto come entità non si apre", "<script>alert(1)</script>", T("&lt;script&gt;alert(1)&lt;/script&gt;"));

  // ── lineare ──
  let t0 = performance.now();
  const r1 = T("<p>x".repeat(300_000));
  c("300.000 tag in fila: lineare (meno di un secondo)", true, performance.now() - t0 < 1000 && r1.length > 0);
  t0 = performance.now();
  T("<a ".repeat(300_000));
  c("300.000 tag mai chiusi: lineare", true, performance.now() - t0 < 1000);
  t0 = performance.now();
  T("<script>" + "<script>".repeat(300_000));
  c("script mai chiuso e annidato: lineare", true, performance.now() - t0 < 1000);
  t0 = performance.now();
  T("&amp;".repeat(500_000));
  c("500.000 entità: lineare", true, performance.now() - t0 < 1000);
}
