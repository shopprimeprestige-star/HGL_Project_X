/** ── DA HTML A TESTO SEMPLICE (EDITOR PRODOTTI · E2a) ───────────────────────
 *  La colonna «Body (HTML)» di un CSV Shopify porta HTML; la scheda prodotto vuole testo con paragrafi. Niente `innerHTML`
 *  né `DOMParser`: si scorre la stringa una volta (lineare, anche su un testo ostile) e si butta via ogni tag.
 *   - `<script>`, `<style>` e i commenti spariscono COL contenuto; le immagini spariscono (le foto non si importano);
 *   - `<br>` è un a capo; `<p>`, `<div>`, titoli, liste e tabelle chiudono un paragrafo; ogni `<li>` parte con «- »;
 *   - le entità si decodificano UNA volta sola, alla fine: `&amp;lt;b&amp;gt;` diventa `&lt;b&gt;`, mai `<b>`;
 *   - il risultato è testo: chi lo mostra lo scrive come testo (React lo protegge), non come HTML. */

const ENTITA: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  euro: "€", deg: "°", copy: "©", reg: "®", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  agrave: "à", egrave: "è", eacute: "é", igrave: "ì", ograve: "ò", ugrave: "ù",
  Agrave: "À", Egrave: "È", Eacute: "É", Igrave: "Ì", Ograve: "Ò", Ugrave: "Ù",
};

// Segnaposto privati per gli a capo che decidiamo noi: così si distinguono dagli a capo del sorgente.
const PAR = "";
const RIGA = "";
// Tag che chiudono un blocco (paragrafo nuovo). Gli altri tag si tolgono e basta.
const BLOCCHI = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "tr", "blockquote", "section", "article", "header", "footer", "pre", "hr"]);

function simbolo(corpo: string): string | null {
  if (corpo[0] === "#") {
    const hex = corpo[1] === "x" || corpo[1] === "X";
    const cp = parseInt(corpo.slice(hex ? 2 : 1), hex ? 16 : 10);
    // Niente NUL, controlli, surrogati, valori fuori dall'Unicode, né invisibili e bidi (gli stessi che toglie il lettore del CSV): si tolgono.
    if (!Number.isFinite(cp) || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) || cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || cp === 0xe000 || cp === 0xe001 || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0x2028 && cp <= 0x202e) || (cp >= 0x2060 && cp <= 0x2069) || cp === 0xfeff || cp === 0xfffe || cp === 0xffff) return "";
    if (cp === 0xa0) return " ";
    return String.fromCodePoint(cp);
  }
  return Object.hasOwn(ENTITA, corpo) ? ENTITA[corpo] : null;
}

export function htmlInTesto(html: string): string {
  const s = String(html ?? "").replace(/[]/g, "");
  const n = s.length;
  const pezzi: string[] = [];
  let haTag = false;
  let da = 0; // inizio del testo non ancora spostato in `pezzi`
  let i = 0;
  while (i < n) {
    const lt = s.indexOf("<", i);
    if (lt < 0) break;
    const k = s.charCodeAt(lt + 1);
    const inizioTag = (k >= 65 && k <= 90) || (k >= 97 && k <= 122) || k === 47 || k === 33 || k === 63; // lettera, «/», «!», «?»
    if (!inizioTag) {
      i = lt + 1; // un «<» che non apre un tag (es. «a < b») resta testo
      continue;
    }
    haTag = true;
    pezzi.push(s.slice(da, lt));
    if (s.startsWith("<!--", lt)) {
      const fine = s.indexOf("-->", lt + 4);
      i = da = fine < 0 ? n : fine + 3;
      continue;
    }
    // fine del tag: il primo «>» fuori dalle virgolette degli attributi; senza «>» il tag mangia il resto, come fa il browser
    let j = lt + 1;
    let virgolette = 0;
    while (j < n) {
      const c = s.charCodeAt(j);
      if (virgolette) { if (c === virgolette) virgolette = 0; }
      else if (c === 34 || c === 39) virgolette = c;
      else if (c === 62) break;
      j++;
    }
    const tag = s.slice(lt + 1, j);
    i = da = Math.min(j + 1, n);
    const nome = /^\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(tag)?.[1]?.toLowerCase() ?? "";
    const chiude = tag[0] === "/";
    if (!chiude && (nome === "script" || nome === "style")) {
      // si salta fino al tag di chiusura (senza, fino alla fine)
      const cerca = new RegExp(`</${nome}[\\s/>]`, "gi");
      cerca.lastIndex = i;
      const m = cerca.exec(s);
      if (!m) { i = da = n; break; }
      const fineChiusura = s.indexOf(">", m.index);
      i = da = fineChiusura < 0 ? n : fineChiusura + 1;
    } else if (nome === "br") pezzi.push(RIGA);
    else if (nome === "li") { if (!chiude) pezzi.push(`${RIGA}- `); }
    else if (BLOCCHI.has(nome)) pezzi.push(PAR);
  }
  pezzi.push(s.slice(da));

  let t = pezzi.join("");
  // Dentro l'HTML un a capo del sorgente è uno spazio; in un testo senza tag, invece, è un a capo vero.
  if (haTag) t = t.replace(/\r\n|\r|\n/g, " ");
  t = t.replace(/\r\n|\r/g, "\n");
  // Le entità, una sola volta: quello che escono non si rilegge.
  t = t.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z][a-zA-Z0-9]{1,8});/g, (tutto, corpo: string) => simbolo(corpo) ?? tutto);
  t = t.replace(//g, "\n").replace(//g, "\n\n");
  return t
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
