/** ── VETRINA V1 · T100a · IL 500 DELLE ROTTE V1 (categoria, ricerca, home, carrello) ──────────────────────────────────────────
 *  Queste quattro rotte non hanno una pagina d'errore loro: con `codice` vale quella predefinita del router (oggi), con `cms` quella del guscio nuovo
 *  (`ErroreShop`, via `ErroreRottaShop`), che dice alla pagina il suo stato e perciò non lascia la barra della consulenza (`barraFissa(percorso, "errore")` è `null`).
 *  Cosa deve valere:
 *   · con `cms` nel contesto: la pagina 500 del guscio (`data-pagina-errore`, titolo di `err500`), mai il predefinito, mai il testo dell'errore;
 *   · con `codice`, o senza contesto (lettura fallita): SOLO il predefinito del router, identico, e niente del guscio nuovo;
 *   · il 404 NON si collega (di proposito): con `cms` queste rotte non lanciano mai `notFound`, con `codice` il 404 è quello della radice (fuori dal guscio):
 *     un `notFoundComponent` di rotta lo porterebbe dentro il guscio di oggi. Nessuna delle quattro rotte ne ha uno;
 *   · il 500 di una pagina V1 non ha la barra: `barraFissa` dà `null` con lo stato «errore» su ognuno dei quattro percorsi, e `ErroreShop` segnala quello stato.
 *  Come si prova: `rendi` (la rotta vera con i finti del router, `erroreDelRouter` = il predefinito del router) e il sorgente. Dati inventati, nessuna rete.
 *  Una prova non lancia MAI: un'eccezione è un rosso con il suo nome. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rendi } from "./_rende.mjs";

const ROTTE = [
  ["categoria", "src/routes/shop.c.$slug.tsx", "/shop/c/patch-pronte"],
  ["ricerca", "src/routes/shop.cerca.tsx", "/shop/cerca"],
  ["home", "src/routes/shop.index.tsx", "/shop"],
  ["carrello", "src/routes/shop.carrello.tsx", "/shop/carrello"],
];
const PREDEFINITO = "PREDEFINITO-DEL-ROUTER";
const FALLITO = (e) => ({ html: `<<eccezione: ${e?.message ?? e}>>` });
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T100a · IL 500 DELLE QUATTRO ROTTE V1 (cms = guscio nuovo, codice = router)");
  const BARRE = mod["shop/cms/vetrina-barre"];
  const err500 = /data-pagina-errore/;
  const guscio = senzaCommenti(readFileSync(join(radice, "src/components/shop/guscio/GuscioShop.tsx"), "utf8"));

  const disegna = (file, context) =>
    rendi(radice, file, { componente: "errorComponent", context, server: {}, erroreDelRouter: () => PREDEFINITO }).catch(FALLITO).then((r) => r.html);

  for (const [nome, file, percorso] of ROTTE) {
    const [cms, codice, senza] = await Promise.all([disegna(file, { modalita: "cms" }), disegna(file, { modalita: "codice" }), disegna(file, undefined)]);
    c(`${nome}, 500 con \`cms\`: la pagina del guscio nuovo, mai il predefinito del router`, [true, false], [err500.test(cms), cms.includes(PREDEFINITO)]);
    c(`${nome}, 500 con \`codice\` (o senza contesto): solo il predefinito del router, niente del guscio nuovo`, [PREDEFINITO, PREDEFINITO], [codice, senza]);
    const sorgente = senzaCommenti(readFileSync(join(radice, file), "utf8"));
    c(`${nome}: la rotta ha il suo \`errorComponent\` che passa \`cms\` dal suo contesto, e NESSUN \`notFoundComponent\` (il 404 resta della radice)`, [true, true, false], [
      /errorComponent:\s*Errore\w+/.test(sorgente), /<ErroreRottaShop \{\.\.\.props\} cms=\{Route\.useRouteContext\(\)\.modalita === "cms"\} \/>/.test(sorgente), /notFoundComponent|NonTrovataShop/.test(sorgente),
    ]);
    c(`${nome} (${percorso}): sopra un 500 non c'è nessuna barra fissa (\`barraFissa\` con lo stato «errore»)`, null, BARRE.barraFissa(percorso, "errore"));
  }
  c("controllo: senza errore la home e la categoria HANNO la barra della consulenza (il «null» dell'errore dice qualcosa)", ["consulenza", "consulenza"], [BARRE.barraFissa("/shop", "normale"), BARRE.barraFissa("/shop/c/patch-pronte", "normale")]);
  c("`ErroreRottaShop`: con `cms` è `ErroreShop` (che segnala «errore» al guscio), con `codice` il predefinito del router; senza predefinito ripiega sul 500 del guscio", [true, true, true], [
    /return cms \|\| !Predefinito \? <ErroreShop error=\{props\.error\} \/> : <Predefinito \{\.\.\.props\} \/>/.test(guscio),
    /useRouter\(\)\.options\.defaultErrorComponent/.test(guscio), /export function ErroreShop\([\s\S]*?useStatoPagina\("errore"\)/.test(guscio),
  ]);
}
