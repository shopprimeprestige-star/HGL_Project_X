/** ── VETRINA V1 · T111a · SPAZIO DEL BANNER IN FONDO ALLA PAGINA (collaudo R1-1, 23/11/2026) ───────────────────────────
 *  Con il banner cookie aperto il fondo della pagina riservava lo spazio della barra ma non quello del banner: «Consulenza gratuita»,
 *  «Privacy», «Cookie» e «Gestisci cookie» del piè di pagina restavano sotto. `scroll-padding-bottom` non basta: la pagina non può
 *  scorrere oltre la sua fine. La resa non si misura senza un browser: la prova legge le regole CSS e dice nel nome COSA guarda.
 *  Regola: `mod[...]` non serve; nessuna rete, nessun dato. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T111a · SPAZIO DEL BANNER (23/11/2026)");
  const css = readFileSync(join(radice, "src/styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const guscio = readFileSync(join(radice, "src/components/shop/guscio/GuscioShop.tsx"), "utf8");
  /** Il corpo della regola con quel selettore esatto (primo livello), o "". */
  const regola = (sel) => css.match(new RegExp(`(?:^|\\})\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  const radice1 = regola("[data-shop-v1]");
  c("R1-1: `scroll-padding-bottom` conta banner + barra (`--barra-h` di partenza = `--banner-h`, la barra la riscrive con banner + altezza)", [true, true], [
    /--barra-h:\s*var\(--banner-h,\s*0px\)\s*;/.test(radice1), /scroll-padding-bottom:\s*calc\(var\(--barra-h,\s*0px\)\s*\+\s*16px\)/.test(radice1),
  ]);

  const fondo = regola('[data-shop-v1] [data-guscio="nuovo"]');
  c("R1-1: il guscio V1 riserva in fondo `--banner-h` (con `0px` di ripiego: senza banner non cambia niente) sotto lo spazio della barra", [true, true], [
    /(?:^|;)\s*padding-bottom:\s*var\(--banner-h,\s*0px\)\s*;?\s*$/.test(fondo.trim()), !/!important/.test(fondo),
  ]);
  c("R1-1: `data-guscio=\"nuovo\"` è davvero l'attributo del guscio, e lo spazio sta dopo la barra (la barra e il suo spazio sono figli del guscio)", [true, true], [
    /<div data-guscio="nuovo"/.test(guscio), guscio.indexOf("<BarraConsulenza") > guscio.indexOf("<FooterShop"),
  ]);
}
