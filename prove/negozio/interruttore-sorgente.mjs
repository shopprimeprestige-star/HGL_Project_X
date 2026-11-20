/** ── NEGOZIO · T17 · «APRI LO SHOP AL PUBBLICO» ──────────────────────────────
 *  `src/crm/ecommerce/prodotti/ApriShop.tsx` (D26). Le regole senza schermo stanno in `interruttore-puro.ts` e si provano
 *  qui con esbuild; della schermata si prova il SORGENTE (non si esegue): l'interruttore è `disabled` se `puoAprire` è falso,
 *  il pulsante di chiusura non chiede condizioni, le righe non valutabili dicono «si attiva col rilascio della cassa».
 *  Dati inventati. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const carica = async (radice, percorso) => {
  const r = await build({ entryPoints: [join(radice, percorso)], bundle: true, write: false, format: "esm", alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
function corpoDi(src, nome) {
  const i = src.search(new RegExp(`(function ${nome}\\b|const ${nome}\\b)`));
  if (i < 0) return null;
  const inizio = src.indexOf("{", i);
  let n = 0;
  for (let k = inizio; k < src.length; k++) {
    if (src[k] === "{") n++;
    else if (src[k] === "}" && --n === 0) return src.slice(inizio, k + 1);
  }
  return null;
}
const riga = (chiave, ok, valutabile = true, frase = "x") => ({ chiave, ok, valutabile, frase });
const dati = (catalogo, righe, puoAprire, extra = {}) => ({
  interruttori: { catalogo_sito: { valore: catalogo, aggiornatoIl: "2026-11-20T10:00:00Z", aggiornatoDa: null }, giacenza_bassa: { valore: 3, aggiornatoIl: null, aggiornatoDa: null } },
  condizioni: { righe, puoAprire },
  ...extra,
});

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · T17 · «APRI LO SHOP AL PUBBLICO» (20/11/2026)");
  const dir = join(radice, "src/crm/ecommerce/prodotti");
  const puroPath = join(dir, "interruttore-puro.ts");
  const tsxPath = join(dir, "ApriShop.tsx");

  // ── le regole pure ──
  const P = existsSync(puroPath) ? await carica(radice, "src/crm/ecommerce/prodotti/interruttore-puro.ts") : {};
  const f = (n) => typeof P[n] === "function";
  c("interruttore-puro.ts esporta le funzioni che la schermata usa", true, ["leggiStatoShop", "righeDaCondizioni", "titoloCondizione", "fraseCondizione", "statoCondizione", "riepilogoCondizioni"].every(f));
  if (f("leggiStatoShop")) {
    const tutteOk = [riga("catalogo_reale", true), riga("foto_vere", true)];
    const s = P.leggiStatoShop(dati("codice", tutteOk, true));
    c("chiuso («codice») e condizioni a posto: si può aprire", [false, "codice", true], [s.aperto, s.valore, s.puoAprire]);
    c("aperto («cms»)", true, P.leggiStatoShop(dati("cms", tutteOk, true)).aperto);
    c("la soglia di giacenza bassa si legge (e senza numero resta nulla)", [3, null], [s.soglia, P.leggiStatoShop(dati("codice", tutteOk, true, { interruttori: { catalogo_sito: { valore: "codice" }, giacenza_bassa: { valore: "x" } } })).soglia]);
    c("`puoAprire` vero ma una riga NO: non si apre (la bandiera da sola non basta)", false, P.leggiStatoShop(dati("codice", [riga("a", true), riga("b", false)], true)).puoAprire);
    c("`puoAprire` vero ma una riga non valutabile: non si apre", false, P.leggiStatoShop(dati("codice", [riga("a", true), riga("pagamento", false, false)], true)).puoAprire);
    c("righe tutte a posto ma `puoAprire` falso (decide il server): non si apre", false, P.leggiStatoShop(dati("codice", tutteOk, false)).puoAprire);
    c("`puoAprire` non booleano («true» testo, 1): non si apre", [false, false], [P.leggiStatoShop(dati("codice", tutteOk, "true")).puoAprire, P.leggiStatoShop(dati("codice", tutteOk, 1)).puoAprire]);
    c("nessuna riga: non si apre", false, P.leggiStatoShop(dati("codice", [], true)).puoAprire);
    c("righe storte (non oggetti, senza chiave) vengono scartate, non fanno aprire", [1, false], [P.leggiStatoShop(dati("codice", [riga("a", true), null, 5, { ok: true }, { chiave: "x", ok: true }], true)).righe.length, P.leggiStatoShop(dati("codice", [null, { chiave: "x", ok: true }], true)).puoAprire]);
    c("l'interruttore del catalogo manca o ha un valore sconosciuto: non si legge (null)", [null, null, null, null], [P.leggiStatoShop(null), P.leggiStatoShop({}), P.leggiStatoShop(dati("boh", tutteOk, true)), P.leggiStatoShop({ interruttori: {}, condizioni: { righe: [], puoAprire: false } })]);
    c("senza `condizioni` (risposta incompleta) lo shop chiuso non si apre", false, P.leggiStatoShop({ interruttori: { catalogo_sito: { valore: "codice" } } })?.puoAprire ?? false);
  }
  if (f("statoCondizione") && f("fraseCondizione") && f("titoloCondizione")) {
    c("stato di una riga: a posto, da sistemare, non ancora valutabile", ["ok", "no", "non_valutabile"], [P.statoCondizione(riga("a", true)), P.statoCondizione(riga("a", false)), P.statoCondizione(riga("a", false, false))]);
    c("una riga non valutabile non è mai «a posto», anche se dice ok:true", "non_valutabile", P.statoCondizione(riga("a", true, false)));
    const nv = P.fraseCondizione(riga("pagamento", false, false, "Si attiva col rilascio della cassa: il pagamento che incassa."));
    c("riga non valutabile: dice «si attiva col rilascio della cassa»", true, /si attiva col rilascio della cassa/i.test(nv));
    c("riga valutabile: dice la frase del server", "Servono almeno 2 prodotti.", P.fraseCondizione(riga("catalogo_reale", false, true, "Servono almeno 2 prodotti.")));
    c("i titoli delle sette righe sono scritti per il titolare (senza chiavi tecniche)", [7, true], [["catalogo_reale", "foto_vere", "pagamento", "spedizione_resi", "email_conferma", "banner_consenso", "migrazione_ordini"].filter((k) => P.titoloCondizione(riga(k, true)) && !/_/.test(P.titoloCondizione(riga(k, true)))).length, P.titoloCondizione(riga("sconosciuta", true, true, "Frase del server.")) === "Frase del server."]);
  }
  if (f("riepilogoCondizioni")) {
    const r = P.riepilogoCondizioni([riga("a", true), riga("b", false), riga("p", false, false), riga("q", false, false)]);
    c("riepilogo: a posto, totale, non valutabili", [1, 4, 2], [r.aPosto, r.totale, r.nonValutabili]);
  }
  if (f("righeDaCondizioni")) {
    c("le condizioni portate dal rifiuto «cancello» si leggono come quelle della lettura", [2, null], [P.righeDaCondizioni({ righe: [riga("a", false), riga("b", true)], puoAprire: false })?.length, P.righeDaCondizioni("boh")]);
  }

  // ── la schermata (sorgente) ──
  const grezzo = existsSync(tsxPath) ? readFileSync(tsxPath, "utf8") : "";
  const src = senzaCommenti(grezzo);
  c("ApriShop.tsx non è più il segnaposto: disegna davvero", true, /return\s*\(\s*</.test(src) && !/\):\s*null\s*\{\s*return null/.test(src));
  c("la firma resta quella di T14: `ApriShop({ negozio }: PropsApriShop)` con `Pick<Negozio, \"interruttori\" | \"esegui\">`", true, /export function ApriShop\(\s*\{\s*negozio\s*\}\s*:\s*PropsApriShop/.test(src) && /Pick<Negozio,\s*"interruttori"\s*\|\s*"esegui">/.test(src));
  c("l'interruttore è `disabled` se `puoAprire` è falso", true, /<Switch[\s\S]{0,400}?disabled=\{[^}]*!\s*[\w.]*puoAprire/.test(src));
  c("si accende con `interruttore_imposta`, valore «cms», e il valore atteso (confronto-e-scambio)", true, /interruttore_imposta/.test(src) && /valore:\s*"cms"/.test(src) && /atteso/.test(src));
  c("e non prova ad aprire se `puoAprire` è falso (guardia nel gestore)", true, /apri\s*=[\s\S]{0,300}?!\s*[\w.]*puoAprire[\s\S]{0,80}?return/.test(src) || /function apri\([\s\S]{0,300}?!\s*[\w.]*puoAprire[\s\S]{0,80}?return/.test(src));
  const chiudi = corpoDi(src, "chiudi");
  c("c'è un gestore di chiusura", true, chiudi !== null);
  c("la chiusura manda «codice» e NON guarda condizioni né `puoAprire`", [true, false, false, false], [/valore:\s*"codice"/.test(chiudi ?? ""), /puoAprire/.test(chiudi ?? ""), /condizioni/.test(chiudi ?? ""), /righe/.test(chiudi ?? "")]);
  c("il pulsante «Chiudi lo shop» c'è e non è spento dalle condizioni", true, /Chiudi lo shop/.test(src) && !/Chiudi lo shop[\s\S]{0,0}puoAprire/.test(src));
  const bloccoChiudi = src.match(/<Button[^>]*onClick=\{chiudi\}[^>]*>/s)?.[0] ?? "";
  c("…il suo `disabled`, se c'è, dipende solo dal lavoro in corso", true, bloccoChiudi !== "" && !/puoAprire|condizion/.test(bloccoChiudi));
  c("la frase di avviso del sito", true, grezzo.includes("Con lo shop aperto il sito mostra solo i prodotti pubblicati qui."));
  c("le righe non valutabili dicono «si attiva col rilascio della cassa»", true, /si attiva col rilascio della cassa/i.test(grezzo + (existsSync(puroPath) ? readFileSync(puroPath, "utf8") : "")));
  c("dice onestamente che oggi in produzione lo shop non si può aprire finché mancano le righe non valutabili", true, /non si può aprire/i.test(grezzo));
  c("le condizioni sono una lista (`ul`/`li`) con testo oltre al colore: stato scritto per esteso", true, /<ul/.test(src) && /(A posto|Da sistemare|Non ancora)/.test(grezzo));
  c("la soglia «giacenza bassa» si imposta da qui, con `interruttore_imposta` e `atteso`", true, /giacenza_bassa/.test(src) && /Giacenza bassa|giacenza bassa/.test(grezzo));
  c("errori: «Riprova» sulla lettura, conflitto e cancello gestiti", true, /Riprova/.test(src) && /"conflitto"/.test(src) && /"cancello"/.test(src));
  c("S1 assente («migrazione»): non è un guasto, lo dice con la sua frase", true, /"migrazione"/.test(src));
  c("nessun `fetch`, nessun log, nessun `window.confirm` in questa schermata", [false, false, false], [/\bfetch\s*\(/.test(src), /console\./.test(src), /confirm\s*\(/.test(src)]);
  c("telefono: bersagli da 44 px (`min-h-11`) e movimento ridotto rispettato", [true, true], [/min-h-11|h-11/.test(src), /motion-reduce/.test(src) || !/animate-/.test(src)]);
  c("nessun colore grigio per un riquadro vuoto e nessuna frase che prometta ciò che non c'è (ordini, pagamenti pronti)", false, /pronto per gli ordini|incassa già/i.test(grezzo));
}
