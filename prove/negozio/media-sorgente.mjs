/** ── NEGOZIO · T16 · FOTO E VIDEO: LA SCHERMATA, PROVATA SUL SORGENTE ───────
 *  `EditorMedia.tsx` (e `media-browser.ts`) non si eseguono qui: si controlla ciò che il testo deve e non deve avere.
 *  Il comportamento vero (canvas, orientamento EXIF, sfondo bianco, telefono) si prova in un Chrome vero: vedi LAVAGNA.
 *  Regole: nessun `delete`; nessun nome del file originale (mai nei dati, mai nel percorso); `alt` obbligatorio prima di «Salva»;
 *  lo slot vuoto è azzurro e tratteggiato, mai grigio; più file e fotocamera; avanzamento e ripresa; l'originale non esce. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Il commit da cui parte T16 (ramo `shop-r1-m`). */
const BASE = "277e018";
const senzaCommenti = (t) => t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, "$1").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const leggi = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · T16 · FOTO E VIDEO: LA SCHERMATA SUL SORGENTE (20/11/2026)");
  const dir = join(radice, "src/crm/ecommerce/prodotti");
  const grezzo = leggi(join(dir, "EditorMedia.tsx"));
  const ed = senzaCommenti(grezzo);
  const br = senzaCommenti(leggi(join(dir, "media-browser.ts")));
  const pu = senzaCommenti(leggi(join(dir, "media-puro.ts")));
  const tutto = ed + br + pu;

  c("EditorMedia.tsx esporta `EditorMedia` e `PropsEditorMedia` con la firma di T14", [true, true, true], [
    /export function EditorMedia\(/.test(ed), /export interface PropsEditorMedia/.test(ed),
    ["prodotto:", "media:", "esegui:", "aggiorna:"].every((p) => ed.includes(p)),
  ]);
  c("non è più un segnaposto: disegna davvero (non ritorna solo null) e importa React", true, /return\s*\(\s*</.test(ed) && /from "react"/.test(ed));
  c("in cima c'è il commento con le props e il compito (T16)", [true, true], [/T16/.test(grezzo.slice(0, grezzo.indexOf("*/") + 2)), /props/i.test(grezzo.slice(0, grezzo.indexOf("*/") + 2))]);

  // ── mai cancellare, mai il nome del file ──
  c("nessuna cancellazione, nessun «Elimina»: «Togli» chiama `media_rimuovi`", [false, true, true], [/\bdelete\b|Elimina|\.remove\(\)|\bunlink\b/i.test(tutto), ed.includes('"media_rimuovi"'), /Togli/.test(ed)]);
  c("il nome del file di chi carica non si legge mai (`.name`) né finisce in un percorso o in un dato", false, /\.name\b|webkitRelativePath|lastModified/.test(tutto));
  c("il percorso non lo costruisce la schermata: nessuna stringa «foto/», «video/» o «copertina/»", false, /["'`](foto|copertina)\/|["'`]video\/(?!\*|mp4|quicktime)|\$\{[^}]*\}\.(jpe?g|mp4|mov)/.test(tutto));
  c("l'originale non esce: il permesso e l'invio ricevono solo i blob ridimensionati (`disegnaMisure`), mai `file` o `File`", [true, false], [/disegnaMisure\(/.test(ed), /caricaConPermesso\([^)]*\bfile\b/.test(ed)]);

  // ── alt obbligatorio ──
  c("la descrizione si controlla con `controllaAlt` e il contatore `contaAlt` (0/125)", [true, true, true], [/controllaAlt\(/.test(ed), /contaAlt\(/.test(ed), /maxLength|MAX_ALT/.test(ed)]);
  c("«Salva» è spento (`disabled`) finché la descrizione non è valida", true, /disabled=\{[^}]*(altOk|!alt\.ok|!verifica\.ok|!ok)/.test(ed.replace(/\s+/g, " ")) || /disabled=\{!?[A-Za-z.]*alt[A-Za-z.]*/.test(ed));
  c("anche per le foto già caricate: `media_alt` solo con una descrizione valida", [true, true], [ed.includes('"media_alt"'), /media_alt[\s\S]{0,400}controllaAlt|controllaAlt[\s\S]{0,600}media_alt/.test(ed)]);
  c("la descrizione è un campo con etichetta (non solo un segnaposto) e dice cos'è: «per chi non vede»", true, /<label[\s\S]{0,200}per chi non vede/i.test(ed) || /per chi non vede/i.test(ed));

  // ── slot vuoto: azzurro e tratteggiato, mai grigio ──
  const vuoto = ed.match(/SLOT_VUOTO\s*=\s*\n?\s*(["'`])([\s\S]*?)\1/)?.[2] ?? "";
  c("lo slot vuoto ha una costante `SLOT_VUOTO` con bordo tratteggiato azzurro", [true, true], [/border-dashed/.test(vuoto), /border-sky-\d+/.test(vuoto)]);
  c("…e in quelle classi non c'è nessun grigio (gray, slate, zinc, neutral, stone, muted, secondary, accent)", false, /\b(gray|slate|zinc|neutral|stone|muted|secondary|accent)\b/.test(vuoto));
  c("…la scritta è «+ Carica»", true, /\+ Carica/.test(ed));
  c("in tutta la schermata nessun riquadro tratteggiato grigio", false, /border-dashed[^"'`]*\b(gray|slate|zinc|neutral|stone|border-border)\b|\b(gray|slate|zinc|neutral|stone)[^"'`]*border-dashed/.test(ed));

  // ── telefono: più file, fotocamera ──
  c("la scelta dei file accetta più file (`multiple`) e i tipi giusti, senza `image/*` (così iPhone converte il HEIC)", [true, true, false], [/\bmultiple\b/.test(ed), /image\/jpeg,image\/png,image\/webp,image\/avif/.test(ed), /accept="image\/\*"/.test(ed)]);
  c("c'è un tasto «Scatta» che apre la fotocamera (`capture`)", true, /capture=/.test(ed) && /Scatta/.test(ed));
  c("il video si sceglie con un campo che accetta video (e la fotocamera dei telefoni)", true, /accept="video\//.test(ed) || /accept=\{?["'`]video/.test(ed));
  c("più file: si assegnano agli slot liberi (`assegnaSlot`) e si dice quanti restano fuori (`fraseInEccesso`)", [true, true], [/assegnaSlot\(/.test(ed), /fraseInEccesso\(/.test(ed)]);
  c("i bersagli da toccare sono di almeno 44 px (`min-h-11`/`h-11`/`size-11`)", true, (ed.match(/\b(min-h-11|h-11|size-11)\b/g) ?? []).length >= 6);
  c("la griglia è a 2 colonne sul telefono e a 4 più in largo", true, /grid-cols-2/.test(ed) && /(md|lg|xl):grid-cols-4/.test(ed));

  // ── ridimensionamento e caricamento ──
  c("usa le funzioni di T13: `pianoFoto`, `controllaFile`, `disegnaMisure`, `chiediPermesso`, `caricaConPermesso`", true,
    ["pianoFoto", "controllaFile", "disegnaMisure", "chiediPermesso", "caricaConPermesso"].every((f) => new RegExp(`\\b${f}\\b`).test(ed)));
  c("il caricamento passa da `eseguiLavoro` (un passo alla volta, ripresa, 3 tentativi)", true, /eseguiLavoro\(/.test(ed) && /nuovoLavoro\(/.test(ed));
  c("avanzamento visibile: una barra `role=\"progressbar\"` con valori e la frase «Carico»", true, /role="progressbar"/.test(ed) && /aria-valuenow/.test(ed) && /aria-valuemax/.test(ed));
  c("ripresa: un tasto «Riprova» sui file falliti, e «Scarta» quando i tentativi sono finiti", true, /Riprova/.test(ed) && /definitivo/.test(ed));
  c("nessun ritentativo da solo: nessun `setInterval` e nessun `setTimeout` che rilanci il caricamento", false, /setInterval\(|setTimeout\(/.test(ed));
  c("il ritaglio si sposta con un cursore (`type=\"range\"`) e `object-position` mostra il quadrato vero", true, /type="range"/.test(ed) && /objectPosition/.test(ed));
  c("l'indirizzo firmato deve essere https: lo controllano `chiediPermesso` e `caricaConPermesso` (T13): la schermata non invia con `fetch` suo, solo con `caricaConPermesso`", [true, false], [/caricaConPermesso\(/.test(ed), /\bfetch\(\s*(?!u\b)/.test(ed.replace(/\(u, i\) => fetch\(u, i\)/g, ""))]);
  c("video: durata misurata nel browser (`leggiVideo`), copertina a 1 s, «Testo parlato», muto e sottotitoli", [true, true, true, true], [/leggiVideo\(/.test(ed), /Testo parlato/.test(ed), /È muto/.test(ed), /Ho messo i sottotitoli nel video/.test(ed)]);
  c("persone: «Ho la liberatoria scritta di chi è ritratto» con `media_flag`", true, /Ho la liberatoria scritta di chi è ritratto/.test(ed) && ed.includes('"media_flag"'));
  c("riordino: frecce, trascinamento e `media_ordina`", [true, true, true], [/ordineSposta\(/.test(ed), /draggable/.test(ed) && /ordineTrascina\(/.test(ed), ed.includes('"media_ordina"')]);

  // ── la parte del browser ──
  c("`media-browser.ts`: orientamento letto dal file (`imageOrientation: \"from-image\"`)", true, /imageOrientation:\s*"from-image"/.test(br));
  c("…e il riquadro si riempie con lo `sfondo` PRIMA di disegnare la foto", true, br.search(/fillStyle\s*=\s*sfondo/) >= 0 && br.search(/fillRect/) < br.search(/drawImage\(sorgente/));
  c("…nessun log, nessun `fetch`", false, /console\.|\bfetch\(/.test(br + ed.replace(/\(u, i\) => fetch\(u, i\)/g, "")));

  // ── il perimetro ──
  c("nessun log, nessun archivio del browser", false, /console\.|localStorage|sessionStorage|indexedDB/.test(tutto));
  c("nessun colore scritto a mano (esadecimale) nella schermata", false, /#[0-9a-fA-F]{3,8}\b/.test(ed));
  let toccati = null;
  try {
    toccati = [
      ...execFileSync("git", ["-C", radice, "diff", "--name-only", BASE], { encoding: "utf8" }).split("\n"),
      ...execFileSync("git", ["-C", radice, "ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\n"),
    ].filter(Boolean);
  } catch {
    toccati = null; // shortcut: il commit di partenza non c'è (repository nuovo): non si può confrontare; si toglie quando BASE non serve più
  }
  if (toccati) {
    const ammessi = /^src\/crm\/ecommerce\/prodotti\/(EditorMedia\.tsx|media-puro\.ts|media-browser\.ts)$|^prove\/negozio\/(media-puro|media-sorgente|pagina-negozio)\.mjs$/;
    c("nel diff ci sono solo i file di T16 (non `CRM.ecommerce.tsx`, non gli altri segnaposto, non `routeTree.gen.ts`, non `client.ts`)", [], toccati.filter((f) => !ammessi.test(f)));
  }
}
