/** ── STILE COMUNE DI /soluzioni (misure e colori della landing v3, sezione 4.1) ───────────────────
 *  Famiglie, contenitore e i due fondi con la griglia da 72 px. I colori sono i token `--hgl-*` di S2 con il
 *  valore della 4.1 come ripiego: se un token mancasse, la pagina resta leggibile e uguale. Le classi sono
 *  scritte per intero (Tailwind le trova solo così). */
import type { CSSProperties } from "react";

/** Anton: solo H1 e H2 (4.1). Titoli scritti in minuscolo nel codice, il maiuscolo è CSS. */
export const ANTON = "font-[family-name:AntonHGL,Impact,sans-serif] font-normal uppercase";
export const INTER = "font-[family-name:InterTightHGL,Inter,ui-sans-serif,system-ui,sans-serif]";
/** Contenitore da 1200 con margini di 20 (telefono) e 32 (computer). */
export const CONTENITORE = "mx-auto w-full max-w-[1200px] px-5 lg:px-8";
/** Etichette piccole: numeri 01-03 e «Solo da noi» (13 px, 600, maiuscolo, tracking 0,14em). */
export const ETICHETTA = `${INTER} text-[13px] font-semibold uppercase leading-none tracking-[0.14em]`;

const griglia = (colore: string) =>
  `linear-gradient(to right, ${colore} 1px, transparent 1px), linear-gradient(to bottom, ${colore} 1px, transparent 1px)`;

/** Fondo blu notte con la griglia HGL Blueprint da 72 px. */
export const STILE_NOTTE: CSSProperties = {
  backgroundColor: "var(--hgl-notte, #0A1430)",
  backgroundImage: griglia("rgba(201, 214, 255, 0.07)"),
  backgroundSize: "72px 72px",
};
/** Fondo chiaro (la spiegazione: «si è aperto un foglio»). */
export const STILE_CHIARO: CSSProperties = {
  backgroundColor: "var(--hgl-chiaro, #EEF2FF)",
  backgroundImage: griglia("rgba(10, 20, 48, 0.05)"),
  backgroundSize: "72px 72px",
};
