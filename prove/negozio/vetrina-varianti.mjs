/** ── VETRINA V1 · T78 · LA SCELTA DELLA VARIANTE: REGOLE SENZA SCHERMO ───────
 *  `src/shop/cms/vetrina-varianti.ts`. Criteri V1-S3 (premendo «Aggiungi» senza scegliere il fuoco va alla scelta mancante e
 *  IL BOTTONE NON È DISABILITATO) e V1-S4 (variante esaurita: la parola «Esaurito» sta nell'etichetta accessibile; scegliendola
 *  il bottone diventa «Esaurito»). Dati inventati (`_dati-vetrina.mjs`), parole da `src/landing/testi-shop.ts`.
 *  Fuoco vero e `aria-live` sono [M]/[T] (D103): qui si prova solo DOVE deve andare il fuoco e quale stato ha il bottone. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO, CATALOGO_UNA_FOTO, INVISIBLE_DERM, trovaParoleVietate } from "./_dati-vetrina.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const V = mod["shop/cms/vetrina-varianti"];
  gruppo("VETRINA V1 · T78 · VARIANTI (23/11/2026)");

  const per = (slug) => CATALOGO.find((p) => p.slug === slug);
  const alfa = per("patch-prova-alfa"); // Colore ×3
  const beta = per("patch-prova-beta"); // Colore ×2, Lunghezza ×2
  const gamma = per("patch-prova-gamma"); // Colore, Lunghezza, Misura; esaurite: indici 0 e 5
  const delta = per("patch-prova-delta"); // solo Misura
  const epsilon = per("patch-prova-epsilon"); // una sola variante, esaurita
  const kit = per("kit-prova"); // nessuna opzione

  // ── campioniColore ──
  c("tre colori con la foto del campione: valore, campione {w480} e la prima lettera", [
    { valore: "Nero", campione: { w480: alfa.opzioni[0].valori[0].campione.w480 }, lettera: "N" },
    { valore: "Castano", campione: { w480: alfa.opzioni[0].valori[1].campione.w480 }, lettera: "C" },
    { valore: "Biondo", campione: { w480: alfa.opzioni[0].valori[2].campione.w480 }, lettera: "B" },
  ], V.campioniColore(alfa.opzioni));
  c("senza la foto del campione: `campione` null e la lettera (mai un colore inventato: nessun campo di colore)", [
    { valore: "Nero", campione: null, lettera: "N" },
    { valore: "Castano", campione: null, lettera: "C" },
    { valore: "Biondo", campione: null, lettera: "B" },
  ], V.campioniColore(CATALOGO_UNA_FOTO.find((p) => p.slug === "patch-prova-alfa").opzioni));
  c("con più opzioni, solo «Colore» è a campioni (Lunghezza no)", ["Nero", "Castano"], V.campioniColore(beta.opzioni).map((x) => x.valore));
  c("senza un'opzione colore (solo Misura, o nessuna opzione): nessun campione", [[], []], [V.campioniColore(delta.opzioni), V.campioniColore(kit.opzioni)]);
  c("il nome dell'opzione si riconosce senza badare alle maiuscole (colore, COLORE)", [2, 2], ["colore", "COLORE"].map((n) => V.campioniColore([{ nome: n, valori: [{ valore: "Rosso", campione: null }, { valore: "Blu", campione: null }] }]).length));
  c("la lettera è maiuscola e viene dal valore (anche accentata o minuscola)", ["È", "A"], V.campioniColore([{ nome: "Colore", valori: [{ valore: "èbano", campione: null }, { valore: " ambra", campione: null }] }]).map((x) => x.lettera));
  c("elenco non valido → nessun campione, nessun errore", [[], []], [V.campioniColore(undefined), V.campioniColore(null)]);

  // ── messaggioMancante: dove va il fuoco ──
  const mancante = (p, scelta) => V.messaggioMancante(p.opzioni, scelta);
  c("nulla scelto su un patch col colore: manca il colore, e la chiave del testo è quella del colore", { opzione: "Colore", chiave: "scheda.scegli.colore" }, mancante(alfa, {}));
  c("scelto il colore: scheda a una sola opzione completa → niente da dire", null, mancante(alfa, { Colore: "Nero" }));
  c("tre opzioni, nulla scelto: la PRIMA nell'ordine dei dati (Colore)", "Colore", mancante(gamma, {})?.opzione);
  c("scelto il colore: manca la Lunghezza", { opzione: "Lunghezza", chiave: "scheda.scegli.lunghezza" }, mancante(gamma, { Colore: "Nero" }));
  c("scelti colore e lunghezza: manca la Misura", { opzione: "Misura", chiave: "scheda.scegli.misura" }, mancante(gamma, { Colore: "Nero", Lunghezza: "Corta" }));
  c("tutto scelto → nessun messaggio, il bottone aggiunge", null, mancante(gamma, { Colore: "Nero", Lunghezza: "Corta", Misura: "Grande" }));
  c("scelta saltata nel mezzo (colore e misura sì, lunghezza no): manca la Lunghezza", "Lunghezza", mancante(gamma, { Colore: "Nero", Misura: "Piccola" })?.opzione);
  c("un valore che non esiste più (prodotto cambiato) vale come non scelto", "Colore", mancante(alfa, { Colore: "Fucsia" })?.opzione);
  c("valore vuoto o non testo vale come non scelto", ["Colore", "Colore"], [mancante(alfa, { Colore: "" })?.opzione, mancante(alfa, { Colore: 3 })?.opzione]);
  c("prodotto senza opzioni (kit): niente da scegliere", null, mancante(kit, {}));
  c("scelta assente (undefined, null): come niente scelto", ["Colore", "Colore"], [mancante(alfa, undefined)?.opzione, mancante(alfa, null)?.opzione]);
  c("la chiave non porta accenti né spazi e si deriva dal nome (anche per un'opzione nuova)", ["scheda.scegli.base", "scheda.scegli.finitura", "scheda.scegli.lunghezza"], [
    V.messaggioMancante([{ nome: "Base", valori: [{ valore: "Lace", campione: null }] }], {}).chiave,
    V.messaggioMancante([{ nome: "Finitura", valori: [{ valore: "Opaca", campione: null }] }], {}).chiave,
    V.messaggioMancante([{ nome: "Lunghézza", valori: [{ valore: "Corta", campione: null }] }], {}).chiave,
  ]);

  // ── statoBottone: mai disabilitato per mancanza di scelta ──
  const scelte = (p) => {
    // tutte le scelte parziali e complete del prodotto, come le farebbe un cliente
    const nomi = p.opzioni.map((o) => o.nome);
    let stati = [{}];
    for (const o of p.opzioni) stati = stati.flatMap((s) => [s, ...o.valori.map((v) => ({ ...s, [o.nome]: v.valore }))]);
    return { nomi, stati };
  };
  const bottone = (p, s) => V.statoBottone(V.varianteScelta(p, s), p.varianti);
  c("nessuna variante scelta, c'è disponibilità: «aggiungi», NON disabilitato (V1-S3)", "aggiungi", V.statoBottone(null, alfa.varianti));
  c("variante scelta e disponibile: aggiungi", "aggiungi", V.statoBottone({ disponibile: true }, alfa.varianti));
  c("variante scelta ed esaurita: esaurito (V1-S4)", "esaurito", V.statoBottone({ disponibile: false }, alfa.varianti));
  c("senza varianti note e senza scelta: aggiungi (la mancanza di scelta non disabilita mai)", ["aggiungi", "aggiungi", "aggiungi"], [V.statoBottone(null), V.statoBottone(undefined), V.statoBottone(null, [])]);
  c("prodotto tutto esaurito (Epsilon) senza scelta: già «esaurito» (§3.13: scheda con «Esaurito»)", "esaurito", V.statoBottone(null, epsilon.varianti));
  c("prodotto con almeno una variante disponibile, senza scelta: aggiungi", "aggiungi", V.statoBottone(null, gamma.varianti));
  c("Gamma: la variante 0 (Nero/Corta/Piccola) è esaurita → esaurito", "esaurito", bottone(gamma, { Colore: "Nero", Lunghezza: "Corta", Misura: "Piccola" }));
  c("Gamma: la variante 1 è disponibile → aggiungi", "aggiungi", bottone(gamma, { Colore: "Nero", Lunghezza: "Corta", Misura: "Grande" }));
  c("tutte le scelte, parziali e complete, di tutto il catalogo: lo stato è «aggiungi» o «esaurito», mai altro, e mai «esaurito» per mancanza di scelta se c'è disponibilità", [], (() => {
    const male = [];
    for (const p of CATALOGO.filter((x) => x.acquistabile)) {
      const { stati } = scelte(p);
      for (const s of stati) {
        const v = V.varianteScelta(p, s);
        const st = V.statoBottone(v, p.varianti);
        if (st !== "aggiungi" && st !== "esaurito") male.push(`${p.slug}: stato ${st}`);
        if (!v && p.varianti.some((x) => x.disponibile) && st !== "aggiungi") male.push(`${p.slug}: disabilitato senza scelta ${JSON.stringify(s)}`);
        if (v && st !== (v.disponibile ? "aggiungi" : "esaurito")) male.push(`${p.slug}: ${v.sku}`);
      }
    }
    return male;
  })());
  c("lo stato è una parola neutra: le parole del bottone restano in testi-shop.ts", [], ["aggiungi", "esaurito"].filter((s) => /\s|[A-Z]/.test(s)));

  // ── etichettaCampione: «Esaurito» nell'etichetta accessibile ──
  c("campione disponibile: solo il nome del colore", "Nero", V.etichettaCampione("Nero", false));
  c("campione esaurito: il nome e la parola «Esaurito» (testo di testi-shop.ts) nella stessa etichetta (V1-S4)", "Nero, Esaurito", V.etichettaCampione("Nero", true));
  c("l'etichetta esaurita porta davvero la parola del testo, non una copia", true, /\bEsaurito\b/.test(V.etichettaCampione("Castano", true)));
  c("nessuna parola vietata nelle etichette", [], trovaParoleVietate(["Nero", "Castano"].flatMap((v) => [V.etichettaCampione(v, false), V.etichettaCampione(v, true)]).join(" ")));

  // ── valoreEsaurito: quale campione disegnare con la diagonale ──
  c("nessun colore esaurito sul prodotto Alfa", [false, false, false], ["Nero", "Castano", "Biondo"].map((v) => V.valoreEsaurito(alfa, "Colore", v, {})));
  c("Gamma, con Lunghezza e Misura già scelte (Corta, Piccola): Nero ha solo la variante esaurita → esaurito, Castano no", [true, false], ["Nero", "Castano"].map((v) => V.valoreEsaurito(gamma, "Colore", v, { Lunghezza: "Corta", Misura: "Piccola" })));
  c("Gamma, senza altre scelte: Nero ha altre varianti disponibili → non esaurito", false, V.valoreEsaurito(gamma, "Colore", "Nero", {}));
  c("la scelta dello stesso gruppo non conta (Colore già scelto: si guarda ogni colore con le altre scelte)", [true, false], ["Nero", "Castano"].map((v) => V.valoreEsaurito(gamma, "Colore", v, { Colore: "Castano", Lunghezza: "Corta", Misura: "Piccola" })));
  c("l'unico valore dell'unica variante esaurita (Epsilon) → esaurito", true, V.valoreEsaurito(epsilon, "Colore", "Unico", {}));
  c("un valore che non esiste in nessuna variante vale esaurito (non si compra)", true, V.valoreEsaurito(alfa, "Colore", "Fucsia", {}));
  c("Invisible Derm: nessuna variante disponibile → ogni valore esaurito", [true, true], ["Piccola", "Grande"].map((v) => V.valoreEsaurito(INVISIBLE_DERM, "Misura", v, {})));

  // ── skuScelto: la variante che ha ESATTAMENTE queste opzioni ──
  c("Alfa, Castano → il secondo SKU", "PAT-ALFA-02", V.skuScelto(alfa, { Colore: "Castano" }));
  c("nessuna scelta su un prodotto con opzioni → null", null, V.skuScelto(alfa, {}));
  c("scelta parziale (Gamma, solo colore) → null", null, V.skuScelto(gamma, { Colore: "Nero" }));
  c("scelta completa su più opzioni, in qualunque ordine delle chiavi → lo stesso SKU", ["PAT-BETA-02", "PAT-BETA-02"], [V.skuScelto(beta, { Colore: "Nero", Lunghezza: "Media" }), V.skuScelto(beta, { Lunghezza: "Media", Colore: "Nero" })]);
  c("prodotto senza opzioni (kit): la sua unica variante, con la scelta vuota", "KIT-PROVA-01", V.skuScelto(kit, {}));
  c("valore inesistente o opzione in più → null", [null, null], [V.skuScelto(alfa, { Colore: "Fucsia" }), V.skuScelto(alfa, { Colore: "Nero", Misura: "M" })]);
  c("scelta assente (undefined, null) → null; senza opzioni resta la variante unica", [null, null], [V.skuScelto(alfa, undefined), V.skuScelto(alfa, null)]);
  c("varianteScelta dà la variante di quello SKU (con `disponibile`) o null", [["PAT-EPSILON-01", false], null], [(() => { const v = V.varianteScelta(epsilon, { Colore: "Unico" }); return [v.sku, v.disponibile]; })(), V.varianteScelta(alfa, {})]);
  c("non modifica l'ingresso (prodotti e scelte congelati)", true, (() => {
    const scelta = Object.freeze({ Colore: "Nero" });
    return V.skuScelto(alfa, scelta) === "PAT-ALFA-01" && V.messaggioMancante(alfa.opzioni, scelta) === null;
  })());

  // ── il file: riusa `varianteDaOpzioni`, non porta frasi, resta puro ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/vetrina-varianti.ts"), "utf8");
  const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("`skuScelto` riusa `varianteDaOpzioni` di adattatore.ts (una regola sola per «quale variante»)", true, /import\s*\{[^}]*\bvarianteDaOpzioni\b[^}]*\}\s*from\s*"\.\/adattatore"/.test(senzaCommenti));
  c("nessuna frase scritta nel codice: le parole stanno in testi-shop.ts", [], (senzaCommenti.match(/"[^"\n]*"/g) ?? []).filter((x) => /\s/.test(x.slice(1, -1)) && !/^"(?:\.\/|@\/)/.test(x)));
  c("niente tempo, caso, rete, schermo", [], ["Date", "setTimeout", "fetch", "window", "document", "Math.random", "console"].filter((k) => new RegExp(`(?<![\\w.])${k.replace(".", "\\.")}(?![\\w])`).test(senzaCommenti)));
  c("nessun colore scritto nel codice (mai un colore inventato per il campione)", [], senzaCommenti.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi) ?? []);
}
