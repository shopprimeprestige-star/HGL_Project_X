// ── "COPIATO" ───────────────────────────────────────────────────────────────
//  Copiare un link è un gesto che non lascia traccia: senza una conferma non si
//  sa se è andata. Gli avvisi normali però vivono dentro la pagina, e i pannelli
//  del presentatore stanno a schermo intero sopra di essa: l'avviso finiva
//  dietro, e il clic sembrava non aver fatto nulla.
//  Questa conferma si disegna in fondo al documento, sopra qualsiasi cosa, e
//  sparisce da sola dopo un paio di secondi.
import { createRoot, type Root } from "react-dom/client";
import { Check } from "lucide-react";

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let timer = 0;

function pill(testo: string) {
  return (
    <div
      style={{ animation: "hg-copied .22s cubic-bezier(.2,.8,.2,1) both" }}
      className="pointer-events-none fixed bottom-24 left-1/2 z-[2147483000] flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-400/40 bg-[#0b1730] px-4 py-2.5 text-[13.5px] font-medium text-white shadow-2xl shadow-black/50"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
        <Check className="h-3 w-3 text-emerald-300" />
      </span>
      {testo}
    </div>
  );
}

/** Mostra la conferma per ~2 secondi. */
export function showCopied(testo = "Link copiato") {
  if (typeof document === "undefined") return;
  if (!host) {
    host = document.createElement("div");
    host.setAttribute("data-hg-noptr", "");
    document.body.appendChild(host);
    root = createRoot(host);
  }
  window.clearTimeout(timer);
  root?.render(pill(testo));
  timer = window.setTimeout(() => root?.render(null), 2200);
}

/** Copia un testo e conferma SUBITO.
 *
 *  La conferma non aspetta l'esito della copia, e non è una svista: in alcuni
 *  browser `writeText` restituisce una promessa che non si risolve MAI finché
 *  la finestra non torna in primo piano. Aspettandola, il riscontro non
 *  compariva affatto — cioè esattamente il problema che deve risolvere.
 *  Si copia con due strade in parallelo (API moderna e metodo storico): se una
 *  fallisce c'è l'altra, e il riscontro arriva comunque nell'istante del clic. */
export function copyLink(text: string, testo = "Link copiato") {
  let fatto = false;
  try {
    const p = navigator.clipboard?.writeText(text);
    if (p && typeof p.then === "function") { void p.then(() => { fatto = true; }).catch(() => storico(text)); }
    else storico(text);
  } catch { storico(text); }
  // se l'API non ha ancora risposto entro un attimo, si usa comunque il metodo
  // storico: copiare due volte lo stesso testo non fa alcun danno.
  window.setTimeout(() => { if (!fatto) storico(text); }, 150);
  showCopied(testo);
}

/** Metodo storico: funziona anche senza permessi e fuori da HTTPS. */
function storico(text: string) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch { /* senza appunti non si può fare altro */ }
}
