/** ── VETRINA V1 · T78 · LA GALLERIA DELLA SCHEDA: ORDINE E CONTROLLI ─────────
 *  `src/shop/cms/vetrina-galleria.ts` (funzioni pure, nessun browser). Criterio V1-S2: la foto di scala è la SECONDA;
 *  un video senza copertina non si mostra; con UNA foto sola nessuna freccia, puntino o miniatura.
 *  ⚠️ «Una foto = nessun controllo» ha UNA sola fonte: `controlliGalleria` di `vetrina-interazioni.ts` (T105). Qui si prova che
 *  `controlli(n)` la usa e non la riscrive. Dati inventati (`_dati-vetrina.mjs`), testi da `src/landing/testi-shop.ts`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO, CATALOGO_UNA_FOTO, CATALOGO_SENZA_FOTO, INVISIBLE_DERM, trovaParoleVietate } from "./_dati-vetrina.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const G = mod["shop/cms/vetrina-galleria"];
  const I = mod["shop/cms/vetrina-interazioni"];
  gruppo("VETRINA V1 · T78 · GALLERIA (23/11/2026)");

  const alfa = CATALOGO.find((p) => p.slug === "patch-prova-alfa");
  const slotDi = (d) => d.map((x) => (x.tipo === "video" ? "video" : x.slot));
  const copia = (m) => structuredClone(m);

  // ── ordinaGalleria: l'ordine di §4.4.3 ──
  const piena = G.ordinaGalleria(alfa.media);
  c("principale, scala, foto 2-5, video: sette diapositive; la confezione resta fuori", ["principale", "scala", "foto2", "foto3", "foto4", "foto5", "video"], slotDi(piena));
  c("la foto di scala è la SECONDA (V1-S2)", "scala", slotDi(piena)[1]);
  c("le foto hanno le tre misure, il video il file e la copertina", [true, true], [piena.slice(0, 6).every((d) => d.tipo === "foto" && d.src.w480 && d.src.w960 && d.src.w1600), piena[6].tipo === "video" && !!piena[6].video && !!piena[6].copertina]);
  c("ogni diapositiva porta id e descrizione (alt) del suo media", true, piena.every((d) => { const m = alfa.media.find((x) => x.id === d.id); return !!m && d.alt === m.alt; }));

  const rovesciata = copia(alfa.media).reverse();
  c("l'ordine dei media in ingresso non conta: rovesciati danno lo stesso risultato", slotDi(piena), slotDi(G.ordinaGalleria(rovesciata)));
  const scalaInFondo = copia(alfa.media).map((m) => (m.slot === "scala" ? { ...m, ordine: 99 } : m));
  c("la scala resta seconda anche con `ordine` alto (conta lo slot, non il numero)", "scala", slotDi(G.ordinaGalleria(scalaInFondo))[1]);
  const foto2InTesta = copia(alfa.media).map((m) => (m.slot === "foto2" ? { ...m, ordine: -5 } : m));
  c("una foto 2-5 con `ordine` basso non passa davanti alla scala", ["principale", "scala"], slotDi(G.ordinaGalleria(foto2InTesta)).slice(0, 2));
  const scambiate = copia(alfa.media).map((m) => (m.slot === "foto2" ? { ...m, ordine: 4 } : m.slot === "foto4" ? { ...m, ordine: 2 } : m));
  c("fra le foto 2-5 conta `ordine` (il CRM le riordina cambiando solo quello)", ["foto4", "foto3", "foto2", "foto5"], slotDi(G.ordinaGalleria(scambiate)).slice(2, 6));
  const parita = copia(alfa.media).map((m) => (["foto2", "foto3"].includes(m.slot) ? { ...m, ordine: 3 } : m));
  c("a parità di `ordine` decide l'id, sempre lo stesso (foto2 prima di foto3)", ["foto2", "foto3"], G.ordinaGalleria(parita).slice(2, 4).map((d) => d.slot));
  c("il video è sempre l'ultimo, anche con `ordine` 0", "video", slotDi(G.ordinaGalleria(copia(alfa.media).map((m) => (m.slot === "video" ? { ...m, ordine: 0 } : m)))).at(-1));
  c("due foto nello stesso slot: ne resta una sola, la prima per `ordine` e id", ["principale"], (() => {
    const doppia = [...copia(alfa.media), { ...copia(alfa.media)[0], id: "zzz-doppione", ordine: 9 }];
    const r = G.ordinaGalleria(doppia).filter((d) => d.slot === "principale");
    return r.map((d) => (d.id === "patch-prova-alfa-principale" ? "principale" : d.id));
  })());

  // ── il video: solo con la copertina ──
  const senzaCopertina = (v) => copia(alfa.media).map((m) => (m.slot === "video" ? { ...m, ...v } : m));
  c("video senza copertina (null): fuori (V1-S2)", ["principale", "scala", "foto2", "foto3", "foto4", "foto5"], slotDi(G.ordinaGalleria(senzaCopertina({ copertina: null }))));
  c("video con copertina vuota o di soli spazi: fuori", [6, 6], [G.ordinaGalleria(senzaCopertina({ copertina: "" })).length, G.ordinaGalleria(senzaCopertina({ copertina: "   " })).length]);
  c("video senza il file (video null) ma con la copertina: fuori", 6, G.ordinaGalleria(senzaCopertina({ video: null })).length);
  c("video con file e copertina: dentro, l'ultimo", "video", slotDi(G.ordinaGalleria(alfa.media)).at(-1));
  c("un video senza copertina non lascia buchi né controlli in più: 6 diapositive, controlli per 6", [6, true], (() => { const n = G.ordinaGalleria(senzaCopertina({ copertina: null })).length; return [n, G.controlli(n).frecce]; })());

  // ── le foto che non si possono disegnare ──
  c("una foto senza `src` (o senza le tre misure) non è una diapositiva", ["principale", "scala", "foto3", "foto4", "foto5", "video"], slotDi(G.ordinaGalleria(copia(alfa.media).map((m) => (m.slot === "foto2" ? { ...m, src: null } : m)))));
  c("senza una delle tre misure: fuori", 6, G.ordinaGalleria(copia(alfa.media).map((m) => (m.slot === "foto2" ? { ...m, src: { w480: m.src.w480, w960: "", w1600: m.src.w1600 } } : m))).length);
  c("senza media o con un elenco non valido: nessuna diapositiva, nessun errore", [[], [], []], [G.ordinaGalleria([]), G.ordinaGalleria(undefined), G.ordinaGalleria(null)]);
  c("confezione e campione non sono della galleria", ["principale"], slotDi(G.ordinaGalleria([
    ...alfa.media.filter((m) => m.slot === "principale"),
    ...alfa.media.filter((m) => m.slot === "confezione"),
    { ...alfa.media[0], id: "camp", slot: "campione" },
  ])));
  c("una sola foto (catalogo «una»): una diapositiva", [1, "principale"], (() => { const d = G.ordinaGalleria(CATALOGO_UNA_FOTO[0].media); return [d.length, d[0].slot]; })());
  c("nessuna foto (catalogo «vuota»): nessuna diapositiva", 0, G.ordinaGalleria(CATALOGO_SENZA_FOTO[0].media).length);
  c("Invisible Derm ha la sua galleria come gli altri (nessuna cifra nei dati)", 7, G.ordinaGalleria(INVISIBLE_DERM.media).length);
  c("non modifica l'ingresso (anche congelato) e restituisce un elenco nuovo", [true, true], (() => {
    const congelato = Object.freeze(alfa.media.map((m) => Object.freeze({ ...m })));
    const r = G.ordinaGalleria(congelato);
    return [r !== congelato, congelato.length === 8];
  })());
  c("a parità di dati, lo stesso risultato (nessun caso, nessun orologio)", slotDi(piena), slotDi(G.ordinaGalleria(alfa.media)));

  // ── controlli(n): una foto = nessun controllo, via `controlliGalleria` ──
  const nessuno = { frecce: false, puntini: false, miniature: false };
  const tutti = { frecce: true, puntini: true, miniature: true };
  c("UNA foto: nessuna freccia, nessun puntino, nessuna miniatura (V1-S2)", nessuno, G.controlli(1));
  c("nessuna foto: nessun controllo", nessuno, G.controlli(0));
  c("due foto: tutti i controlli", tutti, G.controlli(2));
  c("da 2 a 7 foto: tutti i controlli", [], [2, 3, 4, 5, 6, 7].filter((n) => JSON.stringify(G.controlli(n)) !== JSON.stringify(tutti)));
  c("numero non valido (NaN, negativo): nessun controllo", [nessuno, nessuno], [G.controlli(NaN), G.controlli(-2)]);
  c("la regola è quella di T105: per ogni n i tre controlli coincidono con `controlliGalleria(...).mostra`", [], (() => {
    const male = [];
    for (let n = 0; n <= 8; n++) {
      const mostra = I.controlliGalleria({ indice: 0, totale: n }).mostra;
      const k = G.controlli(n);
      if (k.frecce !== mostra || k.puntini !== mostra || k.miniature !== mostra) male.push(n);
    }
    return male;
  })());
  c("tutto il catalogo: i controlli seguono il numero di diapositive vere", [], CATALOGO.concat(CATALOGO_UNA_FOTO, CATALOGO_SENZA_FOTO).filter((p) => {
    const n = G.ordinaGalleria(p.media).length;
    return G.controlli(n).frecce !== (n > 1);
  }).map((p) => p.slug));

  // ── etichettaDiapositiva ──
  c("la prima di cinque: «Foto 1 di 5» (testo di testi-shop.ts)", "Foto 1 di 5", G.etichettaDiapositiva(0, 5, "foto"));
  c("l'ultima di sette, un video: stessa frase, il numero cambia", "Foto 7 di 7", G.etichettaDiapositiva(6, 7, "video"));
  c("indice fuori campo: si ferma dentro (mai «Foto 9 di 5», mai «Foto 0»)", ["Foto 5 di 5", "Foto 1 di 5"], [G.etichettaDiapositiva(8, 5, "foto"), G.etichettaDiapositiva(-3, 5, "foto")]);
  c("nessuna diapositiva: etichetta vuota", "", G.etichettaDiapositiva(0, 0, "foto"));
  c("nessuna parola vietata e nessun segnaposto rimasto", [], trovaParoleVietate([0, 1, 4].map((i) => G.etichettaDiapositiva(i, 5, "foto")).join(" ")));

  // ── il file: usa T105, non la riscrive, e non porta frasi ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/vetrina-galleria.ts"), "utf8");
  const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("importa `controlliGalleria` da vetrina-interazioni (una sola fonte per V1-S2)", true, /import\s*\{[^}]*\bcontrolliGalleria\b[^}]*\}\s*from\s*"\.\/vetrina-interazioni"/.test(senzaCommenti));
  c("non riscrive la regola: nessun confronto con 1 sul numero di foto", [], senzaCommenti.match(/\b(?:n|totale|numero|quante)\s*(?:<=|>=|>|<|===|!==|==)\s*1\b/g) ?? []);
  c("nessuna frase scritta nel codice: le parole stanno in testi-shop.ts", [], (senzaCommenti.match(/"[^"\n]*"/g) ?? []).filter((x) => /\s/.test(x.slice(1, -1)) && !/^"(?:\.\/|@\/)/.test(x)));
  c("niente tempo, caso, rete, schermo", [], ["Date", "setTimeout", "fetch", "window", "document", "Math.random", "console"].filter((k) => new RegExp(`(?<![\\w.])${k.replace(".", "\\.")}(?![\\w])`).test(senzaCommenti)));
}
