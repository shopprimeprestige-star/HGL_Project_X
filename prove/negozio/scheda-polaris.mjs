/** ── EDITOR PRODOTTI · E5 · IL KIT DI STILE POLARIS: DISEGNATO DAVVERO ───────
 *  `src/crm/ecommerce/prodotti/scheda/polaris.tsx` (pagina, riquadro, badge di stato, banner, campo con etichetta) e `scheda/pezzi.tsx`
 *  (Campo, VoceLink, Caratteristiche, Domande). Sorgente (nessuna libreria nuova, nessuna ombra, nessun overflow orizzontale, nessuna parola
 *  vietata) e disegno con `rendiComponente` (esbuild + react-dom/server): etichetta `htmlFor`/`id`, `aria-invalid` + frase, badge con testo oltre
 *  al colore, contatore «84 / 300», riquadro richiudibile con `aria-expanded`, campi alti 44 px sul telefono e 36 sul computer.
 *  Gli effetti non girano in `react-dom/server`: il comportamento al clic si prova con le funzioni pure (`riquadri-puro.mjs`).
 *  Dati inventati, nessuna rete. */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
/** Il testo che si legge, senza marcatura. */
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const attr = (html, nome) => [...html.matchAll(new RegExp(`${nome}="([^"]*)"`, "g"))].map((m) => m[1]);

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E5 · KIT POLARIS DISEGNATO (25/11/2026)");
  const R = requireQui(requireQui.resolve("react", { paths: [radice] }));
  const e = R.createElement;
  const polaris = join(radice, "src/crm/ecommerce/prodotti/scheda/polaris.tsx");
  const pezzi = join(radice, "src/crm/ecommerce/prodotti/scheda/pezzi.tsx");
  c("i due file del kit esistono", [true, true], [existsSync(polaris), existsSync(pezzi)]);
  if (!existsSync(polaris) || !existsSync(pezzi)) return;

  // ════ IL SORGENTE ════
  const src = { "polaris.tsx": readFileSync(polaris, "utf8"), "pezzi.tsx": readFileSync(pezzi, "utf8") };
  for (const [nome, s] of Object.entries(src)) {
    const k = senzaCommenti(s);
    for (const vietato of [/compareAt/i, /prezzo\s+barrato/i, /\brating\b/i, /best\s*seller/i, /\bstelle\b/i, /sconto/i, /\bdelete\b/, /Elimina/, /parseFloat/, /\*\s*100\b/])
      c(`${nome}: nessuna occorrenza di ${vietato}`, false, vietato.test(k));
    c(`${nome}: nessuna rete`, false, /\bfetch\(|\.esegui\(|XMLHttpRequest/.test(k));
    c(`${nome}: nessuna ombra`, false, /\bshadow(-|\b)/.test(k));
    c(`${nome}: nessun scorrimento orizzontale`, false, /overflow-x/.test(k));
    c(`${nome}: nessun colore scritto a mano (#…, rgb, oklch)`, false, /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/.test(k.replace(/&#\d+;|&#x[0-9a-f]+;/gi, "")));
    c(`${nome}: nessun @shopify/polaris`, false, /@shopify/.test(k));
    c(`${nome}: tutti i passaggi animati rispettano motion-reduce`, true, !/\btransition(-\w+)?\b/.test(k) || /motion-reduce:transition-none/.test(k));
    c(`${nome}: il tasto pieno non c'è (uno solo per schermata, lo mette il guscio)`, false, /variant="default"|variant="destructive"/.test(k));
    c(`${nome}: sotto le 450 righe`, true, s.split("\n").length < 450);
  }
  c("polaris.tsx esporta i cinque pezzi", true, ["PaginaScheda", "RiquadroPolaris", "BadgeStato", "Banner", "CampoP"].every((n) => new RegExp(`export function ${n}\\(`).test(src["polaris.tsx"])));
  c("pezzi.tsx esporta i quattro pezzi spostati dal guscio", true, ["Campo", "VoceLink", "Caratteristiche", "Domande"].every((n) => new RegExp(`export function ${n}\\(`).test(src["pezzi.tsx"])));
  // le classi del CAMPO (la costante), non un `min-h-11` qualunque del file: altrimenti un campo a 36 px ovunque resterebbe verde
  const classiCampo = src["polaris.tsx"].match(/export const CLASSI_CAMPO =\s*"([^"]*)"/)?.[1] ?? "";
  c("i campi sono alti 44 px sul telefono e 36 sul computer (CLASSI_CAMPO: min-h-11, md:min-h-9)", [true, true], [/(^|\s)min-h-11(\s|$)/.test(classiCampo), /(^|\s)md:min-h-9(\s|$)/.test(classiCampo)]);
  c("il testo dei campi è 16 px sul telefono (CLASSI_CAMPO)", true, /(^|\s)text-\[16px\](\s|$)/.test(classiCampo));
  c("riquadri: bordo sottile, angoli di 12 px (rounded-xl) e fondo bianco", true, /rounded-xl border border-border bg-card/.test(src["polaris.tsx"]));
  c("titolo del riquadro 14 px grassetto", true, /text-\[14px\] font-semibold/.test(src["polaris.tsx"]));
  c("focus visibile su tutto ciò che si tocca", true, (src["polaris.tsx"].match(/focus-visible:ring-2/g) ?? []).length >= 2);

  // ════ CampoP ════
  const campoP = async (props) => (await rendiComponente(radice, polaris, "CampoP", props)).html;
  const unCampo = (p) => e("input", { ...p, defaultValue: "", name: "prova" });
  const base = { id: "f-nome", etichetta: "Titolo", children: unCampo };
  const h1 = await campoP(base);
  c("CampoP: l'etichetta è collegata al campo (htmlFor = id)", [["f-nome"], ["f-nome"]], [attr(h1, "for"), attr(h1, "id").filter((i) => i === "f-nome")]);
  c("CampoP: senza errore aria-invalid è false", true, /aria-invalid="false"/.test(h1) && !/role="alert"/.test(h1));
  const h2 = await campoP({ ...base, errore: "Scrivi il nome del prodotto." });
  c("CampoP: con un errore aria-invalid è true", true, /aria-invalid="true"/.test(h2));
  c("CampoP: l'errore è scritto a parole, in un avviso", true, /role="alert"[^>]*>[\s\S]*Scrivi il nome del prodotto\./.test(h2));
  c("CampoP: il campo punta all'errore con aria-describedby", true, /aria-describedby="f-nome-errore"/.test(h2) && /id="f-nome-errore"/.test(h2));
  const h3 = await campoP({ ...base, aiuto: "Il nome che vede il cliente.", contatore: { n: 84, max: 300 } });
  c("CampoP: l'aiuto sta sotto il campo e il campo lo richiama", true, /id="f-nome-aiuto"/.test(h3) && /aria-describedby="f-nome-aiuto"/.test(h3) && h3.indexOf("<input") < h3.indexOf("Il nome che vede il cliente."));
  c("CampoP: contatore «84 / 300»", true, leggibile(h3).includes("84 / 300"));
  const h4 = await campoP({ ...base, contatore: { n: 301, max: 300 } });
  c("CampoP: oltre il massimo il contatore lo dice a parole, non solo col colore", true, leggibile(h4).includes("301 / 300") && /troppo lungo|oltre/i.test(leggibile(h4)));
  const h5 = await campoP({ ...base, avvisi: ["Evita la parola «miracoloso»."] });
  c("CampoP: gli avvisi non bloccano (nessun aria-invalid)", true, /aria-invalid="false"/.test(h5) && leggibile(h5).includes("Evita la parola"));
  const h6 = await campoP({ ...base, facoltativo: true });
  c("CampoP: «facoltativo» sta dentro l'etichetta (lo legge anche chi non vede)", true, /<label[^>]*>[^<]*<[^>]*>\s*\(facoltativo\)/.test(h6) || /<label[^>]*>[^]*?facoltativo[^]*?<\/label>/.test(h6));
  c("CampoP: etichetta + aiuto + errore + contatore senza parole vietate", [], trovaParoleVietate(leggibile(h2 + h3 + h4 + h5 + h6)));

  // ════ BadgeStato ════
  const badge = async (stato) => (await rendiComponente(radice, polaris, "BadgeStato", { stato })).html;
  const [bb, bp, ba] = [await badge("bozza"), await badge("pubblicato"), await badge("archiviato")];
  c("BadgeStato: il testo dice lo stato (non solo il colore)", ["Bozza", "Pubblicato", "Archiviato"], [leggibile(bb), leggibile(bp), leggibile(ba)]);
  c("BadgeStato: ha un puntino nascosto a chi legge lo schermo", true, [bb, bp, ba].every((h) => /aria-hidden="true"/.test(h)));
  c("BadgeStato: tre aspetti diversi", 3, new Set([bb, bp, ba].map((h) => attr(h, "class").join("|"))).size);
  c("BadgeStato: il pubblicato è verde", true, /emerald/.test(bp) && !/emerald/.test(bb) && !/emerald/.test(ba));

  // ════ Banner ════
  const banner = async (props) => (await rendiComponente(radice, polaris, "Banner", props)).html;
  const bi = await banner({ tono: "info", children: "Le foto si aggiungono dopo il primo salvataggio." });
  const bat = await banner({ tono: "attenzione", titolo: "Attenzione", children: "Manca il costo." });
  const bE = await banner({ tono: "errore", children: "Non sono riuscito a salvare.", azione: e("button", { type: "button" }, "Riprova") });
  c("Banner informativo: avviso gentile (role=status), testo e icona nascosta", true, /role="status"/.test(bi) && leggibile(bi).includes("dopo il primo salvataggio") && /aria-hidden="true"/.test(bi));
  c("Banner attenzione: titolo e testo", true, /role="status"/.test(bat) && leggibile(bat).startsWith("Attenzione") && leggibile(bat).includes("Manca il costo."));
  c("Banner errore: role=alert, e il tasto che gli passa il guscio", true, /role="alert"/.test(bE) && leggibile(bE).includes("Riprova"));
  c("Banner: tre colori diversi", 3, new Set([bi, bat, bE].map((h) => attr(h, "class")[0])).size);

  // ════ RiquadroPolaris ════
  const riq = async (props) => (await rendiComponente(radice, polaris, "RiquadroPolaris", props)).html;
  const corpo = e("p", null, "dentro il riquadro");
  const r1 = await riq({ id: "prezzo", titolo: "Prezzo", children: corpo });
  c("RiquadroPolaris fisso: titolo di secondo livello, nessun bottone", true, /<h2[^>]*>[\s\S]*Prezzo/.test(r1) && !/<button/.test(r1));
  c("RiquadroPolaris: il contenuto c'è, il pannello ha il suo id", true, /id="pan-prezzo"/.test(r1) && leggibile(r1).includes("dentro il riquadro"));
  const r2 = await riq({ id: "uso", titolo: "Come si usa", children: corpo, aperto: false, alterna: () => {}, segno: { tono: "da_sistemare", testo: "da sistemare (2)" } });
  c("RiquadroPolaris richiudibile: bottone con aria-expanded e aria-controls", true, /<button[^>]*aria-expanded="false"/.test(r2) && /aria-controls="pan-uso"/.test(r2));
  c("RiquadroPolaris chiuso: il pannello è nascosto (hidden)", true, /id="pan-uso"[^>]*hidden/.test(r2) || /hidden=""[^>]*id="pan-uso"/.test(r2));
  c("RiquadroPolaris: il segno dice «da sistemare (2)» a parole", true, leggibile(r2).includes("da sistemare (2)"));
  const r3 = await riq({ id: "uso", titolo: "Come si usa", children: corpo, aperto: true, alterna: () => {}, segno: { tono: "ok", testo: "a posto" } });
  c("RiquadroPolaris aperto: aria-expanded true e pannello visibile", true, /aria-expanded="true"/.test(r3) && !/id="pan-uso"[^>]*hidden/.test(r3));
  c("RiquadroPolaris: il segno «a posto» ha testo e icona nascosta", true, leggibile(r3).includes("a posto") && /aria-hidden="true"/.test(r3));
  c("RiquadroPolaris: i tre segni hanno colori diversi", 3, new Set(await Promise.all([["ok", "a posto"], ["da_sistemare", "da sistemare (1)"], ["da_controllare", "da controllare (1)"]].map(async ([tono, testo]) => attr(await riq({ id: "x", titolo: "T", children: corpo, aperto: true, alterna: () => {}, segno: { tono, testo } }), "class").find((k) => /emerald|rose|amber/.test(k)))) ).size);
  const r4 = await riq({ id: "prezzo", titolo: "Prezzo", children: corpo, subito: true, azione: e("button", { type: "button" }, "Applica prezzo") });
  c("RiquadroPolaris: «si applica subito» e l'azione del guscio", true, leggibile(r4).includes("si applica subito") && leggibile(r4).includes("Applica prezzo"));
  c("RiquadroPolaris: il titolo richiudibile è alto almeno 44 px sul telefono", true, /<button[^>]*min-h-11/.test(r2));

  // ════ PaginaScheda ════
  const pag = (await rendiComponente(radice, polaris, "PaginaScheda", { testata: e("header", null, "TESTATA"), principale: e("div", null, "COLONNA-A"), laterale: e("div", null, "COLONNA-B") })).html;
  c("PaginaScheda: testata, colonna principale e colonna laterale, in quest'ordine", true, pag.indexOf("TESTATA") < pag.indexOf("COLONNA-A") && pag.indexOf("COLONNA-A") < pag.indexOf("COLONNA-B"));
  c("PaginaScheda: fondo grigio chiaro, una colonna sul telefono e due dal computer", true, /bg-muted/.test(pag) && /lg:grid-cols-/.test(pag));
  c("PaginaScheda: margine ai bordi sul telefono e niente scorrimento orizzontale", true, /\bp-3\b|\bpx-3\b/.test(pag) && !/overflow-x/.test(pag));
  c("PaginaScheda: colonne che si stringono (min-w-0), così nulla sfora", true, /min-w-0/.test(pag));

  // ════ i pezzi spostati dal guscio ════
  const vc = async (nome, props) => (await rendiComponente(radice, pezzi, nome, props)).html;
  const hc = await vc("Campo", { k: "nome", etichetta: "Titolo", errore: "Scrivi il nome del prodotto.", contatore: { n: 3, max: 120 }, children: unCampo });
  c("Campo: l'id viene da idCampo (f-nome), lo stesso a cui porta «Vai»", true, /id="f-nome"/.test(hc) && /for="f-nome"/.test(hc));
  c("Campo: errore a parole, aria-invalid e contatore «3 / 120»", true, /aria-invalid="true"/.test(hc) && leggibile(hc).includes("Scrivi il nome del prodotto.") && leggibile(hc).includes("3 / 120"));
  const voce = { campo: "nome", frase: "Scrivi il nome del prodotto." };
  const hb = await vc("VoceLink", { voce, tono: "blocco", vai: () => {} });
  const hi = await vc("VoceLink", { voce: { campo: "seoTitolo", frase: "Il titolo SEO è lungo." }, tono: "info", vai: () => {} });
  c("VoceLink: la frase e «Vai», alta almeno 44 px", true, leggibile(hb).includes("Scrivi il nome del prodotto.") && /Vai/.test(leggibile(hb)) && /<button[^>]*min-h-11/.test(hb));
  c("VoceLink: bloccante e informativa hanno colori diversi", true, attr(hb, "class")[0] !== attr(hi, "class")[0]);
  const modulo = {
    caratteristiche: [
      { etichetta: "Materiale", valore: "Seta", stato: "confermato", fonte: "scheda fornitore" },
      { etichetta: "Colore", valore: "Nero", stato: "da_confermare", fonte: null },
    ],
    faq: [{ d: "Si lava?", r: "Sì, con acqua tiepida." }],
  };
  const vuoto = await vc("Caratteristiche", { modulo: { caratteristiche: [] }, cambia: () => {}, avvisi: [] });
  c("Caratteristiche vuote: dice che non ce n'è nessuna, con il tasto per aggiungerne", true, leggibile(vuoto).includes("Non c'è ancora nessuna caratteristica.") && leggibile(vuoto).includes("Aggiungi una caratteristica"));
  const hk = await vc("Caratteristiche", { modulo, cambia: () => {}, errore: "Una caratteristica è a metà.", avvisi: [] });
  c("Caratteristiche: ancora f-caratteristiche, due righe, due «Togli la riga»", [true, 2], [/id="f-caratteristiche"/.test(hk), (leggibile(hk).match(/Togli la riga/g) ?? []).length]);
  c("Caratteristiche: ogni campo ha la sua etichetta (Nome, Valore, Stato, Fonte × 2)", 8, (hk.match(/<label/g) ?? []).length);
  c("Caratteristiche: l'errore è scritto a parole", true, /role="alert"[^>]*>[\s\S]*Una caratteristica è a metà\./.test(hk));
  c("Caratteristiche: ogni campo e ogni «Togli la riga» dice il numero di riga (aria-label)", true,
    ["Nome, riga 1", "Valore, riga 1", "Stato, riga 1", "Fonte, riga 1", "Nome, riga 2", "Valore, riga 2", "Togli la riga 2"].every((t) => attr(hk, "aria-label").includes(t)));
  c("Caratteristiche: il contenitore richiama errore e avvisi (aria-describedby)", true, /id="f-caratteristiche"[^>]*aria-describedby="f-caratteristiche-errore f-caratteristiche-avvisi"/.test(
    (await vc("Caratteristiche", { modulo, cambia: () => {}, errore: "Una caratteristica è a metà.", avvisi: ["Evita questa parola."] }))));
  c("Caratteristiche: senza errore né avvisi niente aria-describedby sul contenitore", false, /id="f-caratteristiche"[^>]*aria-describedby/.test(await vc("Caratteristiche", { modulo, cambia: () => {}, avvisi: [] })));
  c("Caratteristiche e Domande: dopo «Vai» il focus si vede (anello su :focus, non outline-none nudo)", [true, true], [hk, await vc("Domande", { modulo, cambia: () => {}, avvisi: [] })].map((h) => /<div id="f-(caratteristiche|faq)"[^>]*tabindex="-1"[^>]*focus:ring-2/.test(h) && !/<div id="f-(caratteristiche|faq)"[^>]*class="[^"]*(^|\s)outline-none/.test(h)));
  c("Caratteristiche: le righe non sono riquadri dentro il riquadro", false, /rounded-lg border|rounded-xl border|rounded-md border p-/.test(hk.replace(/<(input|select|textarea)[^>]*>/g, "")));
  const hd = await vc("Domande", { modulo, cambia: () => {}, avvisi: [] });
  c("Domande: ancora f-faq, domanda e risposta con le etichette", true, /id="f-faq"/.test(hd) && leggibile(hd).includes("Domanda") && leggibile(hd).includes("Risposta") && leggibile(hd).includes("Aggiungi una domanda"));
  c("Domande: aria-label col numero di riga e aria-describedby di errore e avvisi", true,
    ["Domanda 1", "Risposta 1", "Togli la domanda 1"].every((t) => attr(hd, "aria-label").includes(t)) &&
      /id="f-faq"[^>]*aria-describedby="f-faq-errore f-faq-avvisi"/.test(await vc("Domande", { modulo, cambia: () => {}, errore: "Una domanda è a metà.", avvisi: ["Evita."] })));
  c("Domande: «Togli la domanda», mai «Elimina»", true, leggibile(hd).includes("Togli la domanda") && !/Elimina/.test(hd));
  // «da confermare» è il nome dello stato di una caratteristica nel CRM (esiste già nel guscio): è vietato sulla vetrina, non qui
  c("pezzi: nessuna parola vietata nel testo disegnato", [], trovaParoleVietate(leggibile(hc + hb + hi + vuoto + hk + hd)).filter((p) => p !== "da confermare"));
}
