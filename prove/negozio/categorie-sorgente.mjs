/** ── NEGOZIO · T17 · LE CATEGORIE ────────────────────────────────────────────
 *  `src/crm/ecommerce/prodotti/Categorie.tsx` (Design §4.10.5, D36). Le regole senza schermo (lettura dell'elenco, spostamento,
 *  «Nascosta dal sito», le tre misure della foto, il corpo delle azioni) stanno in `categorie-puro.ts` e si provano con esbuild;
 *  della schermata si prova il SORGENTE: frecce da 44 px, indirizzo bloccato dopo la pubblicazione, nessuna cancellazione,
 *  il ridimensionamento è quello di T13 (non una copia). Dati inventati. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const carica = async (radice, percorso) => {
  const r = await build({ entryPoints: [join(radice, percorso)], bundle: true, write: false, format: "esm", alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const ID = (n) => `00000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`;
const cat = (n, extra = {}) => ({
  id: ID(n), slug: `categoria-${n}`, nome: `Categoria ${n}`, tipo: "categoria", frase: null, fotoPath: null, seoTitolo: null, seoDescrizione: null,
  ordine: n, visibile: true, pubblicataIl: null, versione: "2026-11-20T10:00:00.000Z", quanti: 2, nascosta: false, slugBloccato: false, ...extra,
});

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · T17 · LE CATEGORIE (20/11/2026)");
  const dir = join(radice, "src/crm/ecommerce/prodotti");
  const puroPath = join(dir, "categorie-puro.ts");
  const tsxPath = join(dir, "Categorie.tsx");
  const P = existsSync(puroPath) ? await carica(radice, "src/crm/ecommerce/prodotti/categorie-puro.ts") : {};
  const f = (n) => typeof P[n] === "function";
  c("categorie-puro.ts esporta le funzioni che la schermata usa", true, ["leggiCategorie", "spostaId", "motivoNascosta", "fraseProdotti", "urlFoto", "assegnaPercorsi", "corpoFoto", "corpoSalva"].every(f) && P.ETICHETTA_NASCOSTA === "Nascosta dal sito");

  if (f("leggiCategorie")) {
    const l = P.leggiCategorie({ categorie: [cat(1), cat(2, { slugBloccato: true, fotoPath: "foto/a.jpg" })] });
    c("legge l'elenco nell'ordine del server, con indirizzo bloccato e foto", [2, "categoria-1", false, true, "foto/a.jpg"], [l.length, l[0].slug, l[0].slugBloccato, l[1].slugBloccato, l[1].fotoPath]);
    c("senza elenco (risposta storta) → null, non un elenco vuoto", [null, null, null], [P.leggiCategorie(null), P.leggiCategorie({}), P.leggiCategorie({ categorie: "x" })]);
    c("righe storte scartate (senza id, nome non testo)", [1], [P.leggiCategorie({ categorie: [cat(1), null, 3, { id: "", nome: "x" }, { ...cat(2), nome: 5 }] }).length]);
    c("`quanti` non numerico vale 0; `visibile` non booleano vale falso (nel dubbio: nascosta)", [0, false], [P.leggiCategorie({ categorie: [{ ...cat(1), quanti: "9" }] })[0].quanti, P.leggiCategorie({ categorie: [{ ...cat(1), visibile: "si" }] })[0].visibile]);
    c("«slugBloccato» si ricava anche da `pubblicataIl` se la bandiera manca (più prudente)", true, P.leggiCategorie({ categorie: [{ ...cat(1), slugBloccato: undefined, pubblicataIl: "2026-11-01T00:00:00Z" }] })[0].slugBloccato);
  }
  if (f("spostaId")) {
    const ids = ["a", "b", "c"];
    c("sposta su e giù scambiando con il vicino", [["b", "a", "c"], ["a", "c", "b"]], [P.spostaId(ids, 1, -1), P.spostaId(ids, 1, 1)]);
    c("ai bordi non si muove (null)", [null, null], [P.spostaId(ids, 0, -1), P.spostaId(ids, 2, 1)]);
    c("indice fuori elenco → null; l'elenco di partenza non cambia", [null, ["a", "b", "c"]], [P.spostaId(ids, 7, 1), ids]);
  }
  if (f("motivoNascosta")) {
    c("visibile e con prodotti: non è nascosta", null, P.motivoNascosta({ visibile: true, quanti: 3 }));
    c("senza prodotti pubblicati: nascosta, e dice perché", true, /prodotti pubblicati|nessun prodotto/i.test(P.motivoNascosta({ visibile: true, quanti: 0 }) ?? ""));
    c("spenta: nascosta, e dice che è spenta", true, /spenta|accendi/i.test(P.motivoNascosta({ visibile: false, quanti: 4 }) ?? ""));
  }
  if (f("fraseProdotti")) c("«n prodotti pubblicati»: singolare, zero, plurale", ["1 prodotto pubblicato", "0 prodotti pubblicati", "12 prodotti pubblicati"], [P.fraseProdotti(1), P.fraseProdotti(0), P.fraseProdotti(12)]);
  if (f("urlFoto")) {
    const b = "https://x.supabase.co/storage/v1/object/public/shop-media";
    c("l'indirizzo della foto: base + percorso; senza base o con percorso storto, niente foto", [`${b}/foto/a.jpg`, null, null, null, null], [P.urlFoto(b, "foto/a.jpg"), P.urlFoto(undefined, "foto/a.jpg"), P.urlFoto(b, "../a.jpg"), P.urlFoto(b, "//evil.example/a.jpg"), P.urlFoto(b, null)]);
  }
  if (f("assegnaPercorsi")) {
    c("tre file per tre misure: ogni nome prende il suo percorso", [{ path480: "p1", path960: "p2", path1600: "p3" }], [P.assegnaPercorsi([{ lato: 480, per: [480] }, { lato: 960, per: [960] }, { lato: 1600, per: [1600] }], ["p1", "p2", "p3"])]);
    c("foto piccola: un file solo serve più nomi (stesso percorso)", [{ path480: "p1", path960: "p2", path1600: "p2" }], [P.assegnaPercorsi([{ lato: 480, per: [480] }, { lato: 700, per: [960, 1600] }], ["p1", "p2"])]);
    c("percorsi che mancano o misure che non coprono i tre nomi → null", [null, null], [P.assegnaPercorsi([{ lato: 480, per: [480] }], ["p1"]), P.assegnaPercorsi([{ lato: 480, per: [480] }, { lato: 960, per: [960] }, { lato: 1600, per: [1600] }], ["p1", "p2"])]);
  }
  if (f("corpoFoto")) {
    const k = cat(1);
    const corpo = P.corpoFoto(k, { path480: "a", path960: "b", path1600: "d" }, "  Una foto  ");
    c("corpo di `categoria_foto`: categoriaId, tre misure, alt senza spazi, versione", { categoriaId: ID(1), path480: "a", path960: "b", path1600: "d", alt: "Una foto", versione: k.versione }, corpo);
    c("senza versione o senza alt non c'è corpo (null)", [null, null], [P.corpoFoto({ ...k, versione: null }, { path480: "a", path960: "b", path1600: "d" }, "x"), P.corpoFoto(k, { path480: "a", path960: "b", path1600: "d" }, "  ")]);
    c("alt oltre 125 caratteri → null", null, P.corpoFoto(k, { path480: "a", path960: "b", path1600: "d" }, "x".repeat(126)));
  }
  if (f("corpoSalva")) {
    const nuova = P.corpoSalva(null, { nome: "  Parrucche ", slug: "parrucche", frase: " Le nostre " });
    c("nuova categoria: nome, indirizzo e frase puliti; niente `id` né `versione`", [{ nome: "Parrucche", slug: "parrucche", frase: "Le nostre" }], [nuova]);
    const k = cat(1, { nome: "Vecchia", slug: "vecchia", frase: "f" });
    c("esistente: manda `id` e `versione`; l'indirizzo cambiato si manda se non è bloccato", { id: ID(1), versione: k.versione, nome: "Nuova", slug: "nuova", frase: "f" }, P.corpoSalva(k, { nome: "Nuova", slug: "nuova", frase: "f" }));
    c("esistente con indirizzo BLOCCATO: lo `slug` non parte mai, anche se la schermata lo cambia", false, "slug" in P.corpoSalva(cat(1, { slugBloccato: true }), { nome: "Nuova", slug: "altro", frase: "" }));
    c("la frase vuota si manda come `null` (si toglie)", null, P.corpoSalva(k, { nome: "Vecchia", slug: "vecchia", frase: "  " }).frase);
    c("nome vuoto, troppo lungo, indirizzo non valido, frase troppo lunga: errore con frase, senza corpo", [true, true, true, true], [
      typeof P.corpoSalva(null, { nome: " ", slug: "x", frase: "" }).errore === "string",
      typeof P.corpoSalva(null, { nome: "x".repeat(61), slug: "x", frase: "" }).errore === "string",
      typeof P.corpoSalva(null, { nome: "Ok", slug: "Non Valido!", frase: "" }).errore === "string",
      typeof P.corpoSalva(null, { nome: "Ok", slug: "ok", frase: "x".repeat(201) }).errore === "string",
    ]);
    c("esistente senza versione: errore (non si salva alla cieca)", true, typeof P.corpoSalva({ ...k, versione: null }, { nome: "Ok", slug: "vecchia", frase: "" }).errore === "string");
  }

  // ── la schermata (sorgente) ──
  const grezzo = existsSync(tsxPath) ? readFileSync(tsxPath, "utf8") : "";
  const src = senzaCommenti(grezzo);
  c("Categorie.tsx non è più il segnaposto", true, /return\s*\(\s*</.test(src));
  c("la firma resta quella di T14: `Categorie({ negozio, cambiate }: PropsCategorie)`", true, /export function Categorie\(\s*\{\s*negozio\s*,\s*cambiate\s*\}\s*:\s*PropsCategorie/.test(src) && /Pick<Negozio,\s*"categorie"\s*\|\s*"esegui">/.test(src));
  c("nessuna cancellazione: niente «Elimina»/«Cancella», niente cestino, niente metodo DELETE, niente azione di eliminazione", [false, false, false, false], [/\b(Elimina|Cancella)\b/i.test(src), /Trash/.test(src), /DELETE/.test(src), /categoria_(elimina|cancella|rimuovi)/.test(src)]);
  c("le frecce su e giù ci sono e sono da 44 px (`h-11 w-11`), con nome per chi non vede", true, /ArrowUp/.test(src) && /ArrowDown/.test(src) && /h-11 w-11/.test(src) && /aria-label=\{`Sposta/.test(src));
  c("l'ordine si cambia con `categoria_ordina` e l'elenco completo (`ids`)", true, /categoria_ordina/.test(src) && /\bids\b/.test(src));
  c("la visibilità con `categoria_visibile` e la `versione`; la frase «Nascosta dal sito» c'è", true, /categoria_visibile/.test(src) && /ETICHETTA_NASCOSTA|Nascosta dal sito/.test(src));
  c("l'indirizzo è bloccato dopo la pubblicazione: il campo è `disabled`/`readOnly` con `slugBloccato`, col lucchetto", true, /(disabled|readOnly)=\{[^}]*(Bloccato|bloccato)/.test(src) && /Lock/.test(src));
  c("il ridimensionamento è quello di T13: importa `pianoFoto`, `disegnaMisure`, `controllaFile` da `ridimensiona`", true, /from\s*"@\/crm\/negozio\/ridimensiona"/.test(src) && ["pianoFoto", "disegnaMisure", "controllaFile"].every((n) => new RegExp(`\\b${n}\\b`).test(src)));
  c("…e non lo duplica: nessun calcolo del lato, nessun `Math.min(` sulle misure della foto", false, /Math\.min\([^)]*(larghezza|altezza|width|height)/i.test(src));
  c("il caricamento passa dal permesso firmato: `chiediPermesso` + `caricaConPermesso` (mai il gettone del CRM verso lo Storage)", true, /chiediPermesso/.test(src) && /caricaConPermesso/.test(src));
  c("la foto parte con `categoria_foto` e il corpo di `corpoFoto` (tre misure); mai la vecchia `path:` singola", [true, false], [/categoria_foto/.test(src) && /corpoFoto/.test(src), /\bpath:\s/.test(src)]);
  c("l'`alt` è obbligatorio: il tasto che salva la foto è spento senza", true, /alt/.test(src) && /disabled=\{[^}]*alt/i.test(src));
  c("stati: errore con «Riprova», conflitto di versione, S1 assente («migrazione»), nessuna categoria", true, /Riprova/.test(src) && /"conflitto"/.test(src) && /"migrazione"/.test(src) && /Nessuna categoria|Non c'è ancora nessuna categoria/.test(grezzo));
  c("una lettura che fallisce non svuota l'elenco già letto (ultima lettura buona + errore)", true, /ultimoBuono|ultimaBuona|elenco:\s*\w+\.elenco|\.\.\.\w+,\s*errore/.test(src));
  c("dopo ogni modifica riuscita chiama `cambiate()`", true, /cambiate\(\)/.test(src));
  c("nessun `fetch` diretto verso il CRM (solo `fetchCRM` per il permesso), nessun log", [false, false], [/(?<!Nudo)(?<![A-Za-z])fetch\s*\(/.test(src.replace(/fetchCRM/g, "")), /console\./.test(src)]);
  c("telefono: card in colonna (`flex-col`) e bersagli da 44 px; movimento ridotto rispettato", [true, true], [/flex-col/.test(src) && /min-h-11|h-11/.test(src), /motion-reduce/.test(src) || !/animate-/.test(src)]);
  c("lo slot vuoto della foto non è grigio: riquadro tratteggiato azzurro (come T16)", [false, true], [/border-dashed[^"`]*(gray|slate|neutral|zinc)-/.test(src), !/border-dashed/.test(src) || /border-dashed[^"`]*(sky|blue|primary)/.test(src)]);
}
