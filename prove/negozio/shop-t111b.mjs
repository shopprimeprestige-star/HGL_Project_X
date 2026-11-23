/** ── VETRINA V1 · T111b · carrello e larghezze (23/11/2026) ─────────────────────────────────────────────────────────────────
 *  Dai collaudi R2 e R3. Qui si legge il sorgente (senza commenti): le prove che DISEGNANO sono negli altri file, ma `renderToStaticMarkup` non
 *  vede le chiavi di React né le larghezze. Le misure vere (Chrome vero, React vero, carrello che arriva da `localStorage` dopo il primo disegno, LayoutShift;
 *  riga a 320 con testo al 200 %) sono prese a mano con un banco fuori dal repository, non sono in suite.
 *  · T111b-1 (R2-2, R3-1): CLS del carrello con righe. Vuoto e righe stanno nello stesso posto della pagina: senza `key` React riusa il `div` del vuoto per
 *    la griglia e Chrome conta come spostamento il salto di 106 px (0,078-0,129 a 390 e 320). Con una `key` per ramo i due sono nodi diversi (nuovi, non spostati).
 *  · T111b-2 (R2-1): una parola lunga nel nome della variante rendeva la colonna `1fr` larga quanto la parola (minimo del contenuto) e la riga sporgeva a 320 al 200 %.
 *  · T111b-3 (R3-4, A22): ricerca, scheda e carrello hanno il contenitore della testata (`max-w-7xl`, 16/24/40 px): a 1440 partono da x = 120. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T111b · CARRELLO E LARGHEZZE (23/11/2026)");
  const leggi = (f) => senzaCommenti(readFileSync(join(radice, "src/components/shop", f), "utf8"));
  const carrello = leggi("pagine/PaginaCarrello.tsx");
  const riga = leggi("carrello/RigaCarrelloShop.tsx");

  // ── T111b-1: il ramo con le righe e il ramo vuoto hanno ciascuno la sua chiave (nodi diversi, non lo stesso `div` che cambia classi)
  c("T111b-1: la griglia con le righe ha `key=\"righe\"` e il ramo vuoto `key=\"vuoto\"`", [true, true], [
    /<div key="righe" className="mt-6 grid gap-8/.test(carrello), /<div key="vuoto" className="py-8 sm:py-12">/.test(carrello)]);
  c("T111b-1: l'altezza minima di T109b resta (senza, il piè di pagina scende e conta: 0,04-0,09 misurati)", true, /<div className="mx-auto min-h-\[calc\(100svh-3rem\)\]/.test(carrello));

  // ── T111b-2: la colonna del testo può stringersi (0 come minimo) e la variante va a capo anche dentro una parola
  c("T111b-2: la colonna del nome ha `minmax(0,1fr)` (non `1fr`, che non scende sotto la parola più lunga)", [true, false], [
    /grid-cols-\[minmax\(0,1fr\)_auto\]/.test(riga), /grid-cols-\[1fr_auto\]/.test(riga)]);
  c("T111b-2: il nome della variante va a capo anche dentro una parola (`break-words`)", true, /<p className="col-start-1 break-words text-sm text-ink-muted">/.test(riga));
  c("T111b-2: il prezzo non cambia (minimo 5 rem, a destra): a 390 e al 100 % la riga è com'era", true, /col-start-2 row-start-1 flex min-h-11 min-w-20 items-center justify-end/.test(riga));

  // ── T111b-3: A22. Il contenitore della categoria e della testata: `max-w-7xl px-4 min-[360px]:px-6 lg:px-10`
  const categoria = leggi("pagine/PaginaCategoria.tsx");
  const testata = leggi("guscio/ShopHeader.tsx");
  const CONTENITORE = /\bmax-w-7xl\b[^"]*\bpx-4\b[^"]*\bmin-\[360px\]:px-6\b[^"]*\blg:px-10\b/;
  c("T111b-3: la categoria e la testata hanno `max-w-7xl` con 16/24/40 px (il modello da copiare)", [true, true], [CONTENITORE.test(categoria), CONTENITORE.test(testata)]);
  for (const [nome, file] of [["ricerca", "pagine/PaginaCerca.tsx"], ["scheda", "pagine/PaginaScheda.tsx"], ["carrello", "pagine/PaginaCarrello.tsx"]]) {
    const src = leggi(file);
    const radiceDiv = (src.match(/<div className="mx-auto [^"]*"/) ?? [""])[0];
    c(`T111b-3: ${nome}: il contenitore è \`max-w-7xl px-4 min-[360px]:px-6 lg:px-10\`, non più \`max-w-6xl\``, [true, false], [CONTENITORE.test(radiceDiv), /max-w-6xl/.test(radiceDiv)]);
  }
}
