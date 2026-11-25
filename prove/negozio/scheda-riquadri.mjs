/** ── EDITOR PRODOTTI · E6 · I RIQUADRI DELLA SCHEDA E LA COLONNA LATERALE ────
 *  `src/crm/ecommerce/prodotti/scheda/`: RiquadroTitolo, RiquadroFoto, RiquadroPrezzo, RiquadroGiacenza, RiquadroSpedizione, RiquadroSeo,
 *  RiquadroContenuto, ColonnaLaterale, PrimaDiPubblicare (+ RiquadroCampi, il campo di testo comune). Sorgente (nessuna rete, nessun import
 *  da `client.ts`, nessuna parola vietata, file corti) e disegno con `rendiComponente` (esbuild + react-dom/server): Prezzo assente per
 *  Invisible Derm; Prezzo, Giacenza e Spedizione assenti con le opzioni; stato vuoto delle foto; costo spento con la sua frase; margine
 *  «Margine 48 %, utile 9,60 €»; categorie con ricerca; riquadri 8-10 chiusi per un prodotto nuovo; etichette collegate e errori a parole.
 *  Gli effetti non girano in `react-dom/server`: il clic si prova con le funzioni pure di E5. Dati inventati, nessuna rete. */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const attr = (html, nome) => [...html.matchAll(new RegExp(`${nome}="([^"]*)"`, "g"))].map((m) => m[1]);
const FILE = ["RiquadroCampi", "RiquadroTitolo", "RiquadroFoto", "RiquadroPrezzo", "RiquadroGiacenza", "RiquadroSpedizione", "RiquadroSeo", "RiquadroContenuto", "ColonnaLaterale", "PrimaDiPubblicare"];

/** Il modulo come lo scrive il titolare (tutto testo), con valori inventati. */
const MODULO = {
  nome: "", slug: "", sku: "", tipo: "patch", marca: "", rigaPresentazione: "", descrizioneBreve: "", descrizioneLunga: "", perChi: "",
  caratteristiche: [], prezzo: "", passi: "", confezione: "", avvertenze: "", faq: [], reso: "", resoGiorni: "", boxConsulenza: false, correlatoId: "",
  canali: { sito: true, meta: false, google: false, tiktok: false }, seoTitolo: "", seoDescrizione: "",
  gtin: "", mpn: "", categoriaGoogle: "", pesoG: "", classeSpedizione: "", fornitore: "", noteInterne: "", notaTitolare: "",
};

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E6 · RIQUADRI DELLA SCHEDA E COLONNA LATERALE (25/11/2026)");
  const R = requireQui(requireQui.resolve("react", { paths: [radice] }));
  const e = R.createElement;
  const dir = join(radice, "src/crm/ecommerce/prodotti/scheda");
  const percorso = (n) => join(dir, `${n}.tsx`);
  c("i dieci file esistono", FILE.map(() => true), FILE.map((n) => existsSync(percorso(n))));
  if (!FILE.every((n) => existsSync(percorso(n)))) return;

  // ════ IL SORGENTE ════
  const src = Object.fromEntries(FILE.map((n) => [n, readFileSync(percorso(n), "utf8")]));
  for (const [nome, s] of Object.entries(src)) {
    const k = senzaCommenti(s);
    for (const vietato of [/compareAt/i, /prezzo\s+barrato/i, /\brating\b/i, /best\s*seller/i, /\bstelle\b/i, /sconto/i, /\bdelete\b/, /Elimina/, /parseFloat/, /\*\s*100\b/])
      c(`${nome}: nessuna occorrenza di ${vietato}`, false, vietato.test(k));
    c(`${nome}: nessuna rete (fetch, esegui, XMLHttpRequest)`, false, /\bfetch\(|\.esegui\(|\besegui\b|XMLHttpRequest/.test(k));
    c(`${nome}: non importa da client.ts né dal server`, false, /from\s+["'][^"']*(\/client|\.server|\/negozio\/client)["']/.test(k));
    c(`${nome}: nessuna ombra, nessun scorrimento orizzontale, nessun colore scritto a mano`, [false, false, false], [/\bshadow(-|\b)/.test(k), /overflow-x/.test(k), /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/.test(k.replace(/&#\d+;|&#x[0-9a-f]+;/gi, ""))]);
    c(`${nome}: nessun @shopify e nessun tasto pieno (uno solo per schermata, lo mette il guscio)`, [false, false], [/@shopify/.test(k), /variant="default"|variant="destructive"/.test(k)]);
    c(`${nome}: passaggi animati con motion-reduce`, true, !/\btransition(-\w+)?\b/.test(k) || /motion-reduce:transition-none/.test(k));
    c(`${nome}: sotto le 450 righe`, true, s.split("\n").length < 450);
    // ogni campo vero usa le classi del kit (44 px sul telefono, 36 sul computer): niente campi scritti a mano
    const inizi = [...k.matchAll(/<(input|select|textarea)\b/g)].map((m) => m.index);
    const campi = inizi.map((i, n) => k.slice(i, inizi[n + 1] ?? i + 900)).filter((t) => !/type="checkbox"/.test(t.slice(0, 200)));
    c(`${nome}: ogni campo di testo ha CLASSI_CAMPO`, campi.length, campi.filter((t) => /CLASSI_CAMPO/.test(t)).length);
  }
  c("le righe con casella o interruttore sono alte 44 px sul telefono", true, /label[\s\S]{0,200}min-h-11/.test(src["ColonnaLaterale"]) && /label[\s\S]{0,200}min-h-11/.test(src["RiquadroContenuto"]));
  c("«Prima di pubblicare»: tasto che apre alto 44 px e focus visibile", true, /min-h-11[\s\S]{0,200}focus-visible:ring-2|focus-visible:ring-2[\s\S]{0,200}min-h-11/.test(src["PrimaDiPubblicare"]));

  // ════ IL DISEGNO ════
  // nessuna chiamata di rete durante il disegno: `fetch` finto che registra
  let reti = 0;
  const fetchVero = globalThis.fetch;
  globalThis.fetch = () => { reti++; return Promise.reject(new Error("rete vietata nei riquadri")); };
  const vedi = async (nome, props, file = nome) => (await rendiComponente(radice, percorso(file), nome, props)).html;
  const base = { modulo: { ...MODULO }, cambia: () => {}, errori: {}, avvisi: {} };
  /** Ogni campo (non casella, non pulsante) ha un'etichetta collegata. */
  const senzaEtichetta = (html) => {
    const per = new Set(attr(html, "for"));
    return [...html.matchAll(/<(input|select|textarea)\b[^>]*>/g)]
      .filter((m) => !/type="checkbox"|type="hidden"/.test(m[0]))
      .map((m) => /\bid="([^"]*)"/.exec(m[0])?.[1] ?? "(senza id)")
      .filter((id) => !per.has(id));
  };
  const tutti = [];
  try {
    // ── Titolo ──
    const t0 = await vedi("RiquadroTitolo", base);
    tutti.push(t0);
    c("Titolo: titolo del riquadro e id sez-titolo / pan-titolo", true, leggibile(t0).includes("Titolo e descrizione") && /id="sez-titolo"/.test(t0) && /id="pan-titolo"/.test(t0));
    c("Titolo: contatori «0 / 120», «0 / 300», «0 / 5000»", true, ["0 / 120", "0 / 300", "0 / 5000"].every((x) => leggibile(t0).includes(x)));
    c("Titolo: la descrizione breve dice che serve per pubblicare", true, leggibile(t0).includes("Obbligatoria per pubblicare"));
    c("Titolo: «Altri testi» è chiuso se i due campi sono vuoti", false, /<details[^>]*\bopen/.test(t0));
    const t1 = await vedi("RiquadroTitolo", { ...base, modulo: { ...MODULO, perChi: "Chi perde i capelli" } });
    c("Titolo: «Altri testi» si apre da solo se c'è già un testo", true, /<details[^>]*\bopen/.test(t1));
    const t2 = await vedi("RiquadroTitolo", { ...base, errori: { rigaPresentazione: "La riga è troppo lunga." } });
    c("Titolo: «Altri testi» si apre da solo se c'è un errore, e l'errore è a parole", true, /<details[^>]*\bopen/.test(t2) && leggibile(t2).includes("La riga è troppo lunga.") && /aria-invalid="true"/.test(t2));
    const t3 = await vedi("RiquadroTitolo", { ...base, modulo: { ...MODULO, nome: "x".repeat(121) }, errori: { nome: "Il titolo è troppo lungo." }, avvisi: { nome: { avvisi: ["Evita «miracoloso»."] } }, avviso: e("p", null, "AVVISO-DEL-GUSCIO") });
    c("Titolo: l'errore e l'avviso stanno accanto al campo, l'avviso del guscio in cima", true, /aria-describedby="f-nome-errore f-nome-avvisi"/.test(t3) && leggibile(t3).includes("Evita «miracoloso».") && leggibile(t3).includes("121 / 120 · troppo lungo") && t3.indexOf("AVVISO-DEL-GUSCIO") < t3.indexOf("f-nome"));
    c("Titolo: ogni campo ha la sua etichetta", [], senzaEtichetta(t0 + t1));

    // ── Foto ──
    const f0 = await vedi("RiquadroFoto", { nuovo: true, children: e("p", null, "EDITOR-FOTO") });
    c("Foto, prodotto nuovo: «Premi Salva bozza per aggiungere le foto.» e niente editor", [true, false], [leggibile(f0).includes("Premi Salva bozza per aggiungere le foto."), leggibile(f0).includes("EDITOR-FOTO")]);
    const f1 = await vedi("RiquadroFoto", { nuovo: false, children: e("p", null, "EDITOR-FOTO") });
    c("Foto, prodotto salvato: c'è l'editor che passa il guscio, non la frase", [true, false], [leggibile(f1).includes("EDITOR-FOTO"), leggibile(f1).includes("Premi Salva bozza")]);
    tutti.push(f0, f1);

    // ── Prezzo ──
    const pz = { ...base, modalita: "semplice", invisibleDerm: false, pubblicato: false, costo: "10,40", cambiaCosto: () => {}, costoDisponibile: true };
    const p0 = await vedi("RiquadroPrezzo", { ...pz, modulo: { ...MODULO, prezzo: "20,00" } });
    tutti.push(p0);
    c("Prezzo 20,00 e costo 10,40: «Margine 48 %, utile 9,60 €»", true, leggibile(p0).includes("Margine 48 %, utile 9,60 €"));
    c("Prezzo: «Un solo prezzo, IVA inclusa.» e nessun prezzo barrato", [true, false], [leggibile(p0).includes("Un solo prezzo, IVA inclusa."), /barrat|sconti/i.test(leggibile(p0))]);
    c("Prezzo: il margine sta in una zona che si annuncia (aria-live)", true, /aria-live="polite"[^>]*>[^<]*Margine 48/.test(p0));
    c("Prezzo: i campi hanno etichetta (Prezzo, Costo) e il costo è facoltativo", [], senzaEtichetta(p0));
    c("Prezzo: il costo dice a parole che non compare sul sito", true, leggibile(p0).includes("non compare mai sul sito"));
    const p1 = await vedi("RiquadroPrezzo", { ...pz, modulo: { ...MODULO, prezzo: "20,00" }, costo: "25,00" });
    c("Prezzo: costo più alto del prezzo lo dice a parole", true, leggibile(p1).includes("il costo è più alto del prezzo"));
    const p2 = await vedi("RiquadroPrezzo", { ...pz, modulo: { ...MODULO, prezzo: "20,00" }, costoDisponibile: false, costo: "" });
    c("Prezzo, senza migrazione: costo spento con la frase, nessun margine", [true, true, false], [leggibile(p2).includes("Per il costo serve un aggiornamento del database."), /<input[^>]*id="f-costo"[^>]*\sdisabled=""|<input[^>]*\sdisabled=""[^>]*id="f-costo"/.test(p2), /Margine/.test(p2)]);
    const p3 = await vedi("RiquadroPrezzo", { ...pz, invisibleDerm: true });
    c("Prezzo per Invisible Derm: il riquadro non c'è", "", p3);
    const p4 = await vedi("RiquadroPrezzo", { ...pz, modalita: "opzioni" });
    c("Prezzo con le opzioni: il riquadro non c'è", "", p4);
    const p5 = await vedi("RiquadroPrezzo", { ...pz, modulo: { ...MODULO, prezzo: "abc" }, errori: { prezzo: "Scrivi il prezzo in euro, per esempio 19,90." }, costoErrore: "Il costo non è un numero." });
    c("Prezzo: errori del prezzo e del costo a parole, con aria-invalid", [true, true, 2], [leggibile(p5).includes("Scrivi il prezzo in euro") && leggibile(p5).includes("Il costo non è un numero."), /<input[^>]*id="f-costo"[^>]*aria-invalid="true"|<input[^>]*aria-invalid="true"[^>]*id="f-costo"/.test(p5), (p5.match(/aria-invalid="true"/g) ?? []).length]);
    const p6 = await vedi("RiquadroPrezzo", { ...pz, pubblicato: true, prezzoVivo: "19,90", azionePrezzo: e("button", { type: "button" }, "Applica il nuovo prezzo") });
    c("Prezzo pubblicato: «si applica subito», prezzo vivo e il tasto del guscio", true, ["si applica subito", "Sul sito ora: € 19,90", "Applica il nuovo prezzo"].every((x) => leggibile(p6).includes(x)));
    c("Prezzo bozza: niente «si applica subito» né «Sul sito ora»", false, /si applica subito|Sul sito ora/.test(leggibile(p0)));

    // ── Giacenza ──
    const gz = { ...base, modalita: "semplice", invisibleDerm: false, nuovo: false, skuBloccato: false, giacenzaAttuale: 10, quantita: "10", cambiaQuantita: () => {}, motivo: "carico", cambiaMotivo: () => {}, soglia: 5 };
    const g0 = await vedi("RiquadroGiacenza", { ...gz, modulo: { ...MODULO, sku: "HG-T01" } });
    tutti.push(g0);
    c("Giacenza: SKU, barcode, quantità, motivo con Carico / Rettifica / Reso", true, ["SKU", "Barcode (GTIN)", "Quantità disponibile", "Motivo del cambio", "Carico", "Rettifica", "Reso"].every((x) => leggibile(g0).includes(x)));
    c("Giacenza: «In magazzino ora: 10.» e la soglia in sola lettura", [true, true], [leggibile(g0).includes("In magazzino ora: 10."), leggibile(g0).includes("Scorta bassa sotto 5 pezzi")]);
    c("Giacenza: i campi hanno etichetta", [], senzaEtichetta(g0));
    c("Giacenza: nessuna variazione se la quantità non cambia", false, /Salvando, la giacenza/.test(g0));
    const g1 = await vedi("RiquadroGiacenza", { ...gz, quantita: "15" });
    c("Giacenza 10 → 15: «Salvando, la giacenza sale di 5 (carico).»", true, leggibile(g1).includes("Salvando, la giacenza sale di 5 (carico)."));
    const g2 = await vedi("RiquadroGiacenza", { ...gz, quantita: "4", motivo: "reso" });
    c("Giacenza 10 → 4 con motivo Reso: scende di 6 (reso)", true, leggibile(g2).includes("Salvando, la giacenza scende di 6 (reso)."));
    const g3 = await vedi("RiquadroGiacenza", { ...gz, quantita: "12,5" });
    c("Giacenza «12,5»: errore a parole e aria-invalid", [true, true], [leggibile(g3).includes("La quantità è un numero intero da 0 a 1.000.000"), /<input[^>]*id="f-giacenza"[^>]*aria-invalid="true"|<input[^>]*aria-invalid="true"[^>]*id="f-giacenza"/.test(g3)]);
    const g4 = await vedi("RiquadroGiacenza", { ...gz, nuovo: true, giacenzaAttuale: 0, quantita: "10", soglia: null });
    c("Giacenza, prodotto nuovo: «Quantità iniziale», niente motivo, niente soglia se non letta", [true, false, false], [leggibile(g4).includes("Quantità iniziale"), /Motivo del cambio/.test(g4), /Scorta bassa/.test(g4)]);
    const g5 = await vedi("RiquadroGiacenza", { ...gz, skuBloccato: true, modulo: { ...MODULO, sku: "HG-T01" } });
    c("Giacenza, già pubblicato: lo SKU è bloccato e lo dice", [true, true], [/<input[^>]*id="f-sku"[^>]*\sdisabled=""|<input[^>]*\sdisabled=""[^>]*id="f-sku"/.test(g5), leggibile(g5).includes("lo SKU non si cambia più")]);
    c("Giacenza con le opzioni o Invisible Derm senza opzioni: opzioni = nessun riquadro", ["", ""], [await vedi("RiquadroGiacenza", { ...gz, modalita: "opzioni" }), await vedi("RiquadroGiacenza", { ...gz, modalita: "opzioni", invisibleDerm: true })]);
    c("Giacenza per Invisible Derm senza opzioni: c'è (solo il Prezzo manca)", true, (await vedi("RiquadroGiacenza", { ...gz, invisibleDerm: true })).includes("Giacenza"));
    const g6 = await vedi("RiquadroGiacenza", { ...gz, linkSoglia: e("a", { href: "/crm/impostazioni" }, "Apri le impostazioni") });
    c("Giacenza: il link alle impostazioni è quello che passa il chiamante", true, leggibile(g6).includes("Apri le impostazioni"));

    // ── Spedizione ──
    const s0 = await vedi("RiquadroSpedizione", { ...base, modalita: "semplice", invisibleDerm: false });
    tutti.push(s0);
    c("Spedizione: peso in grammi e classe di spedizione, con etichetta", [true, true, []], [leggibile(s0).includes("Peso (grammi)"), leggibile(s0).includes("Classe di spedizione"), senzaEtichetta(s0)]);
    c("Spedizione con le opzioni: il riquadro non c'è", "", await vedi("RiquadroSpedizione", { ...base, modalita: "opzioni", invisibleDerm: false }));
    const s1 = await vedi("RiquadroSpedizione", { ...base, modulo: { ...MODULO, pesoG: "12,5" }, errori: { pesoG: "Il peso è un numero intero di grammi." }, modalita: "semplice", invisibleDerm: false });
    c("Spedizione: peso sbagliato = frase a parole + aria-invalid", [true, true], [leggibile(s1).includes("Il peso è un numero intero di grammi."), /aria-invalid="true"/.test(s1)]);

    // ── SEO ──
    const se = { ...base, pubblicato: false, dominio: "hairgenius.it" };
    const e0 = await vedi("RiquadroSeo", { ...se, modulo: { ...MODULO, nome: "Patch Notte", slug: "patch-notte", descrizioneBreve: "Per dormire sereni." } });
    tutti.push(e0);
    c("SEO: anteprima come Google (indirizzo, titolo dal nome, descrizione dalla breve)", true, leggibile(e0).includes("hairgenius.it › shop › prodotto › patch-notte") && leggibile(e0).includes("Patch Notte") && leggibile(e0).includes("Per dormire sereni."));
    c("SEO: titolo blu e indirizzo verde nell'anteprima", true, /text-sky-800[^>]*>Patch Notte/.test(e0) && /text-emerald-800[^>]*>hairgenius/.test(e0));
    c("SEO: contatori «0 / 60» e «0 / 155» e l'anteprima è un gruppo con nome", true, leggibile(e0).includes("0 / 60") && leggibile(e0).includes("0 / 155") && /role="group"/.test(e0) && /aria-label="Anteprima come in Google"/.test(e0));
    c("SEO: «Dal titolo» c'è in bozza e l'indirizzo si scrive", [true, false], [leggibile(e0).includes("Dal titolo"), /<input[^>]*id="f-slug"[^>]*\sdisabled=""/.test(e0)]);
    const e1 = await vedi("RiquadroSeo", { ...se, pubblicato: true, modulo: { ...MODULO, slug: "patch-notte" } });
    c("SEO pubblicato: l'indirizzo è bloccato e lo dice, niente «Dal titolo»", [true, true, false], [/<input[^>]*id="f-slug"[^>]*\sdisabled=""|<input[^>]*\sdisabled=""[^>]*id="f-slug"/.test(e1), leggibile(e1).includes("l'indirizzo non si cambia più"), leggibile(e1).includes("Dal titolo")]);
    const lungo = "p".repeat(80);
    const e2 = await vedi("RiquadroSeo", { ...se, modulo: { ...MODULO, seoTitolo: lungo, seoDescrizione: "d".repeat(200) } });
    c("SEO: l'anteprima taglia come Google (60 e 155 segni, con i puntini) e i contatori lo dicono", [true, true, true], [leggibile(e2).includes("p".repeat(59) + "…"), leggibile(e2).includes("d".repeat(154) + "…"), leggibile(e2).includes("80 / 60 · troppo lungo")]);
    c("SEO: senza foto passate, il campo «Immagine di condivisione» non c'è", false, /Immagine di condivisione/.test(e0));
    const e3 = await vedi("RiquadroSeo", { ...se, immagini: [{ id: "m1", nome: "Foto principale del prodotto" }], immagineId: "m1", cambiaImmagine: () => {} });
    c("SEO: con le foto, «Immagine di condivisione» è un menu con etichetta", [true, []], [leggibile(e3).includes("Immagine di condivisione"), senzaEtichetta(e3)]);
    c("SEO: ogni campo ha un'etichetta", [], senzaEtichetta(e0 + e1 + e2));

    // ── I tre riquadri richiudibili ──
    const chiusi = { caratteristiche: false, uso: false, reso: false };
    const k0 = await vedi("RiquadroContenuto", { ...base, aperti: chiusi, alterna: () => {}, correlabili: [{ id: "p2", nome: "Crema Notte" }] });
    tutti.push(k0);
    c("Contenuto, prodotto nuovo: i tre riquadri sono chiusi (aria-expanded false, pannello hidden)", [3, 3], [(k0.match(/aria-expanded="false"/g) ?? []).length, (k0.match(/<div id="pan-[a-z]+"[^>]*hidden|hidden=""[^>]*id="pan-/g) ?? []).length]);
    c("Contenuto: i tre titoli della SPEC", true, ["Caratteristiche", "Come si usa e cosa c'è dentro", "Reso, consulenza e consegna"].every((x) => leggibile(k0).includes(x)));
    c("Contenuto: ogni titolo è un bottone alto 44 px", 3, (k0.match(/<button[^>]*id="sez-[a-z]+"[^>]*min-h-11|<button[^>]*min-h-11[^>]*id="sez-/g) ?? []).length);
    const k1 = await vedi("RiquadroContenuto", { ...base, aperti: { caratteristiche: true, uso: true, reso: true }, alterna: () => {}, correlabili: [{ id: "p2", nome: "Crema Notte" }], errori: { resoGiorni: "I giorni sono un numero intero." }, modulo: { ...MODULO, reso: "si", resoGiorni: "x" } });
    tutti.push(k1);
    c("Contenuto aperto: tre aria-expanded true, nessun hidden", [3, 0], [(k1.match(/aria-expanded="true"/g) ?? []).length, (k1.match(/<div id="pan-[a-z]+"[^>]*hidden/g) ?? []).length]);
    c("Contenuto: i campi dell'uso, del reso e «Ti serve anche» (con il prodotto collegabile)", true, ["Come si usa", "Nella confezione", "Avvertenze", "Giorni per il reso", "Box «consulenza»", "Ti serve anche", "Crema Notte", "Nessuno"].every((x) => leggibile(k1).includes(x)));
    c("Contenuto: errore dei giorni a parole, e i giorni si spengono se il reso non è «sì»", [true, false, true], [leggibile(k1).includes("I giorni sono un numero intero."), /<input[^>]*id="f-resoGiorni"[^>]*\sdisabled=""/.test(k1), /<input[^>]*id="f-resoGiorni"[^>]*\sdisabled=""/.test(await vedi("RiquadroContenuto", { ...base, aperti: { caratteristiche: true, uso: true, reso: true }, alterna: () => {}, correlabili: [] }))]);
    c("Contenuto: ogni campo ha un'etichetta (e «Ti serve anche» compare una volta sola)", [[], 1], [senzaEtichetta(k1), (k1.match(/id="f-correlatoId"/g) ?? []).length]);
    c("Contenuto: il segno del riquadro arriva dal guscio", true, leggibile(await vedi("RiquadroContenuto", { ...base, aperti: chiusi, alterna: () => {}, correlabili: [], segni: { uso: { tono: "da_sistemare", testo: "da sistemare (2)" } } })).includes("da sistemare (2)"));

    // ── Colonna laterale ──
    const elenco = [
      { id: "c1", nome: "Cura dei capelli" }, { id: "c2", nome: "Patch" }, { id: "c3", nome: "Kit" }, { id: "c4", nome: "Collezione autunno" },
      { id: "c5", nome: "Sérum" }, { id: "c6", nome: "Accessori" }, { id: "c7", nome: "Regali" }, { id: "c8", nome: "Novità" },
    ];
    const col = { ...base, stato: "bozza", categorie: { elenco, scelte: ["c2"], scegli: () => {} }, cataloghiAperto: false, alternaCataloghi: () => {} };
    const caselle = (h) => h.match(/<fieldset[^>]*id="f-categoria"[\s\S]*?<\/fieldset>/)?.[0] ?? h;
    const l0 = await vedi("ColonnaLaterale", { ...col, prima: e("aside", null, "PANNELLO-PRIMA"), azioniStato: e("button", { type: "button" }, "Archivia") });
    tutti.push(l0);
    c("Colonna: Stato, Dove si vede, Organizzazione, Dati per i cataloghi, Note (in quest'ordine, con «Prima» dopo lo Stato)", true,
      ["Stato", "PANNELLO-PRIMA", "Dove si vede", "Organizzazione", "Dati per i cataloghi", "Note"].map((t) => l0.indexOf(t === "PANNELLO-PRIMA" ? t : `>${t}<`)).every((n, i, a) => n >= 0 && (i === 0 || n > a[i - 1])));
    c("Colonna: lo stato si legge a parole (Bozza) e porta il tasto del guscio", [true, true], [leggibile(l0).includes("Bozza"), leggibile(l0).includes("Archivia")]);
    c("Colonna: la frase della bozza dice che «Pubblicato» viene solo dal tasto Pubblica", true, leggibile(l0).includes("solo col tasto Pubblica"));
    const interruttori = [...l0.matchAll(/<button[^>]*role="switch"[^>]*>/g)].map((m) => m[0]);
    c("Colonna: quattro interruttori dei canali, ognuno col suo nome, solo il sito è acceso", [["Sito", "Meta (Facebook e Instagram)", "Google Merchant", "TikTok"], ["Sito"]], [interruttori.map((t) => /aria-label="([^"]*)"/.exec(t)?.[1]), interruttori.filter((t) => /aria-checked="true"/.test(t)).map((t) => /aria-label="([^"]*)"/.exec(t)?.[1])]);
    c("Colonna: Tipo, Marca, Fornitore, MPN, Categoria Google, Nota interna, Nota del titolare, con etichetta", [true, []], [["Tipo", "Marca", "Fornitore", "Codice produttore (MPN)", "Categoria Google", "Nota interna", "Nota del titolare"].every((x) => leggibile(l0).includes(x)), senzaEtichetta(l0)]);
    c("Colonna: le note dicono che non si vedono mai sul sito", 2, (leggibile(l0).match(/non si vede mai sul sito/g) ?? []).length);
    c("Colonna: «Dati per i cataloghi» è richiudibile e chiuso (aria-expanded false, pannello hidden)", [true, true], [/<button[^>]*id="sez-cataloghi"[^>]*aria-expanded="false"|<button[^>]*aria-expanded="false"[^>]*id="sez-cataloghi"/.test(l0), /id="pan-cataloghi"[^>]*hidden|hidden=""[^>]*id="pan-cataloghi"/.test(l0)]);
    c("Colonna: il prodotto collegato NON è qui (sta in «Reso, consulenza e consegna»)", false, /Ti serve anche/.test(l0));
    // categorie con ricerca
    c("Categorie: campo di ricerca con etichetta, tutte le otto in elenco, «Patch» spuntata", [true, 8, 1], [/<input[^>]*id="f-categoria-ricerca"/.test(l0) && /for="f-categoria-ricerca"/.test(l0), (caselle(l0).match(/type="checkbox"/g) ?? []).length, (caselle(l0).match(/type="checkbox"[^>]*\schecked=""/g) ?? []).length]);
    c("Categorie: le scelte si leggono scritte sopra l'elenco", true, leggibile(l0).includes("Scelte: Patch."));
    const l1 = await vedi("CategorieScelta", { ...col.categorie, ricercaIniziale: "cur" }, "ColonnaLaterale");
    c("Categorie, ricerca «cur»: resta solo «Cura dei capelli»", [1, true], [(l1.match(/type="checkbox"/g) ?? []).length, leggibile(l1).includes("Cura dei capelli")]);
    const l2 = await vedi("CategorieScelta", { ...col.categorie, ricercaIniziale: "SERUM" }, "ColonnaLaterale");
    c("Categorie, ricerca senza maiuscole né accenti: «SERUM» trova «Sérum»", [1, true], [(l2.match(/type="checkbox"/g) ?? []).length, leggibile(l2).includes("Sérum")]);
    const l3 = await vedi("CategorieScelta", { ...col.categorie, ricercaIniziale: "zzz" }, "ColonnaLaterale");
    c("Categorie, ricerca che non trova niente: lo dice a parole", [0, true], [(l3.match(/type="checkbox"/g) ?? []).length, leggibile(l3).includes("Nessuna categoria si chiama così.")]);
    const l4 = await vedi("CategorieScelta", { ...col.categorie, ricercaIniziale: "kit" }, "ColonnaLaterale");
    c("Categorie: una scelta nascosta dalla ricerca resta scritta in «Scelte» (non si perde di vista)", true, leggibile(l4).includes("Scelte: Patch."));
    const l5 = await vedi("CategorieScelta", { ...col.categorie, occupato: true }, "ColonnaLaterale");
    c("Categorie, salvataggio in corso: le caselle sono spente", [8, 8], [(l5.match(/type="checkbox"/g) ?? []).length, (l5.match(/type="checkbox"[^>]*\sdisabled=""/g) ?? []).length]);
    c("Categorie: in lettura «Carico le categorie…», vuote lo dicono, un errore è a parole", [true, true, true], [
      leggibile(await vedi("CategorieScelta", { elenco: null, scelte: [], scegli: () => {} }, "ColonnaLaterale")).includes("Carico le categorie…"),
      leggibile(await vedi("CategorieScelta", { elenco: [], scelte: [], scegli: () => {} }, "ColonnaLaterale")).includes("Non c'è ancora nessuna categoria"),
      /role="alert"[^>]*>[^<]*Non riesco a leggere le categorie\./.test(await vedi("CategorieScelta", { elenco: null, scelte: [], scegli: () => {}, errore: "Non riesco a leggere le categorie." }, "ColonnaLaterale")),
    ]);
    c("Categorie: la zona delle caselle scorre in verticale (mai in orizzontale)", [true, false], [/max-h-56 overflow-y-auto/.test(l0), /overflow-x/.test(l0)]);
    // stato e cataloghi aperto
    const l6 = await vedi("ColonnaLaterale", { ...col, stato: "pubblicato", cataloghiAperto: true });
    c("Colonna: Pubblicato e Archiviato hanno le loro frasi", [true, true], [leggibile(l6).includes("Pubblicato") && leggibile(l6).includes("finché non pubblichi le modifiche"), leggibile(await vedi("ColonnaLaterale", { ...col, stato: "archiviato" })).includes("Rimettilo in bozza")]);
    c("Colonna: «Dati per i cataloghi» aperto = aria-expanded true", true, /<button[^>]*id="sez-cataloghi"[^>]*aria-expanded="true"|<button[^>]*aria-expanded="true"[^>]*id="sez-cataloghi"/.test(l6));
    const l7 = await vedi("ColonnaLaterale", { ...col, errori: { canali: "Accendi almeno un canale." } });
    c("Colonna: errore dei canali a parole, collegato al gruppo", [true, true], [leggibile(l7).includes("Accendi almeno un canale.") && /role="alert"/.test(l7), /aria-describedby="f-canali-errore"/.test(l7)]);
    c("Colonna: il gruppo dei canali ha l'id f-canali, a cui porta «Vai»", true, /<fieldset[^>]*id="f-canali"/.test(l0));

    // ── Prima di pubblicare ──
    const voci = [{ campo: "nome", frase: "Scrivi il titolo del prodotto." }, { campo: "prezzo", frase: "Il prezzo deve essere maggiore di zero." }];
    const info = [{ campo: "seoTitolo", frase: "Il titolo SEO è più lungo di 60 segni." }];
    const pd = { bloccanti: voci, informativi: info, vai: () => {}, archiviato: false, vecchio: false, aperto: false, alterna: () => {} };
    const d0 = await vedi("PrimaDiPubblicare", pd);
    tutti.push(d0);
    c("Prima di pubblicare: «mancano 2 cose» sul telefono, con aria-expanded false", [true, true], [leggibile(d0).includes("Prima di pubblicare · mancano 2 cose"), /aria-expanded="false"/.test(d0)]);
    c("Prima di pubblicare: ogni voce ha la sua frase e «Vai» (2 bloccanti + 1 da sapere)", [3, true, true], [(d0.match(/>Vai</g) ?? []).length, leggibile(d0).includes("Scrivi il titolo del prodotto.") && leggibile(d0).includes("Il prezzo deve essere maggiore di zero."), leggibile(d0).includes("Da sapere (non ferma la pubblicazione)") && leggibile(d0).includes("Il titolo SEO è più lungo di 60 segni.")]);
    c("Prima di pubblicare: elenco con nome «Cose da sistemare»; la regione ha un nome (aside)", [true, true], [/aria-label="Cose da sistemare"/.test(d0), /<aside[^>]*aria-label="Prima di pubblicare"/.test(d0)]);
    c("Prima di pubblicare: chiuso sul telefono (hidden), sempre aperto dal computer (lg:flex) e in vista scorrendo (lg:sticky)", [true, true], [/class="[^"]*\bhidden lg:flex/.test(d0), /lg:sticky/.test(d0)]);
    const d1 = await vedi("PrimaDiPubblicare", { ...pd, aperto: true, bloccanti: [voci[0]], informativi: [] });
    c("Prima di pubblicare: «manca 1 cosa», aperto = aria-expanded true e pannello visibile", [true, true, false], [leggibile(d1).includes("manca 1 cosa"), /aria-expanded="true"/.test(d1), /id="prima-di-pubblicare"[^>]*\bhidden lg:flex/.test(d1)]);
    const d2 = await vedi("PrimaDiPubblicare", { ...pd, bloccanti: [], informativi: [] });
    c("Prima di pubblicare, niente da sistemare: «Tutto a posto: puoi pubblicare.»", [true, true], [leggibile(d2).includes("Tutto a posto: puoi pubblicare."), leggibile(d2).includes("tutto a posto")]);
    c("Prima di pubblicare: archiviato e vecchio catalogo hanno le frasi di oggi", [true, true], [leggibile(await vedi("PrimaDiPubblicare", { ...pd, bloccanti: [], informativi: [], archiviato: true })).includes("rimettilo in bozza per pubblicarlo"), leggibile(await vedi("PrimaDiPubblicare", { ...pd, bloccanti: [], informativi: [], vecchio: true })).includes("Prima usa questo prodotto dal vecchio catalogo.")]);
    c("Prima di pubblicare: nessun tasto «Pubblica» (sta nella testata e nella barra del guscio)", false, /Pubblica<|>Pubblica</.test(d0 + d1 + d2));

    // ── TUTTI ──
    c("tutti i riquadri disegnati: nessuna parola vietata della vetrina", [], trovaParoleVietate(leggibile(tutti.join(" ")).replace(/da confermare/gi, "")));
    c("tutti i riquadri disegnati: nessun overflow-x e nessun tasto pieno", [false, false], [tutti.some((h) => /overflow-x/.test(h)), tutti.some((h) => /bg-primary[^"]*text-primary-foreground/.test(h))]);
    c("nessuna chiamata di rete mentre si disegnano", 0, reti);
  } finally {
    globalThis.fetch = fetchVero;
  }
}
