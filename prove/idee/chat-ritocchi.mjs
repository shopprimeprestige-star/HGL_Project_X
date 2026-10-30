/** ── PROVE: RITOCCHI ALLA CHAT (30/10/2026, commessa 2026-10-30-chat-ritocchi) ─────────────────────
 *  1. sottofiltri di «Da chiamare» come le pillole (una riga che scorre, 44 px, più leggera)
 *  2. cornetta e stato anche sulle chat senza nome/scheda; lo stato crea la scheda
 *  3. niente «Abbina a una scheda» in riga: resta «Crea scheda»
 *  4. riquadro «Senza scheda (N)» in cima
 *  5. pillola «Clienti» (stessa definizione dei KPI: `eConversione`)
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveSottofiltriScorrevoli(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  gruppo("CHAT RITOCCHI 1: SOTTOFILTRI DI «DA CHIAMARE» COME LE PILLOLE");
  const blocco = elenco.slice(elenco.indexOf('filtri.coda === "da-chiamare" && ('));
  const sotto = blocco.slice(0, blocco.indexOf("role=\"status\""));
  c("stessa riga scorrevole delle pillole principali (una costante sola)", true,
    (elenco.match(/\{RIGA_SCORREVOLE\}|RIGA_SCORREVOLE,|className=\{RIGA_SCORREVOLE|cn\(RIGA_SCORREVOLE/g) ?? []).length >= 2 &&
      /const RIGA_SCORREVOLE =[\s\S]{0,120}overflow-x-auto overscroll-x-contain/.test(elenco));
  c("i sottofiltri non vanno più a capo", false, /flex-wrap/.test(sotto));
  const tasto = elenco.slice(elenco.indexOf("const sottoTasto"), elenco.indexOf("/** Il tasto di un chip"));
  c("tasti da 44 px sul telefono, il numero accanto, acceso = aria-pressed", true,
    /h-11/.test(tasto) && /aria-pressed=\{sottoAttivo === x\.v\}/.test(sotto) && /conti\[x\.v\]/.test(sotto) && /sottoTasto\(/.test(sotto));
  c("più leggeri: testo piccolo (t-nota), solo linea sotto, nessun pieno primario", true,
    /t-nota/.test(tasto) && /border-b-2/.test(tasto) && !/bg-primary/.test(tasto));
  c("«Quando richiamare» (Scaduti/Oggi/Domani…) diventa una riga uguale, senza il menu a tendina", true,
    /Quando richiamare/.test(sotto) && !/<select/.test(sotto) && /aria-pressed=\{quandoAttivo === x\.v\}/.test(sotto));
}
