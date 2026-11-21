/** ── NEGOZIO · T45 · I TESTI CONFERMATI (D63) ──────────────────────────────
 *  `src/shop/cms/testi-confermati.ts`: `CHIAVI_TESTI`, `filtraConfermati(grezzi)`. Vuoto, solo spazi o con
 *  `{{…}}` = `null` = la riga non si disegna. Nessun testo di servizio scritto nel codice. Dati inventati. */

export async function prove(mod, { c, gruppo }) {
  gruppo("NEGOZIO · I TESTI CONFERMATI (21/11/2026, T45)");
  const T = mod["shop/cms/testi-confermati"];
  if (!T) return c("il modulo src/shop/cms/testi-confermati.ts esiste", true, false);

  const CHIAVI = ["reso", "assistenza", "assistenza_whatsapp", "pronta_consegna", "garanzia", "firmatario"];
  c("le chiavi sono quelle di D63, in quest'ordine", CHIAVI, [...T.CHIAVI_TESTI]);
  const tutteNull = Object.fromEntries(CHIAVI.map((k) => [k, null]));
  c("nessun dato (undefined, null, testo, numero, elenco) → tutto null", Array(5).fill(tutteNull), [undefined, null, "reso", 4, ["reso"]].map((g) => T.filtraConfermati(g)));
  c("oggetto vuoto → tutto null, con tutte le chiavi", tutteNull, T.filtraConfermati({}));
  c("«» → null", null, T.filtraConfermati({ reso: "" }).reso);
  c("«  » (solo spazi, a capo, tab) → null", [null, null], [T.filtraConfermati({ reso: "  " }).reso, T.filtraConfermati({ reso: " \n\t " }).reso]);
  c("«Ti rispondiamo {{da confermare}}» → null", null, T.filtraConfermati({ assistenza: "Ti rispondiamo {{da confermare}}" }).assistenza);
  c("anche «{{» da solo, in testa o in fondo → null", [null, null], [T.filtraConfermati({ reso: "{{x" }).reso, T.filtraConfermati({ reso: "Reso entro 14 giorni {{" }).reso]);
  c("testo vero → il testo", "Reso entro 14 giorni dal ricevimento.", T.filtraConfermati({ reso: "Reso entro 14 giorni dal ricevimento." }).reso);
  c("il testo vero si restituisce senza spazi ai bordi", "Ciao", T.filtraConfermati({ garanzia: "  Ciao \n" }).garanzia);
  c("le parentesi graffe singole sono testo normale", "Tempi {da 2 a 4 giorni}", T.filtraConfermati({ pronta_consegna: "Tempi {da 2 a 4 giorni}" }).pronta_consegna);
  c("chiave sconosciuta ignorata (e non compare nel risultato)", CHIAVI, Object.keys(T.filtraConfermati({ novita_casella: "Sì", reso: "ok", zzz: "x" })));
  c("«__proto__» e «constructor» come chiavi non cambiano nulla", tutteNull, T.filtraConfermati(JSON.parse('{"__proto__":{"reso":"x"},"constructor":"y"}')));
  c("una chiave solo ereditata non vale (serve la chiave propria)", null, T.filtraConfermati(Object.create({ reso: "ereditato" })).reso);
  c("valore non testuale (numero, booleano, oggetto, elenco, null) → null", Array(5).fill(null), [7, true, { a: 1 }, ["x"], null].map((v) => T.filtraConfermati({ reso: v }).reso));
  const misto = T.filtraConfermati({ reso: "Reso 14 giorni", assistenza: "", assistenza_whatsapp: "{{numero}}", pronta_consegna: "Pronta consegna", garanzia: "  ", firmatario: "Mario Inventato" });
  c("un insieme misto: solo i testi veri restano", { reso: "Reso 14 giorni", assistenza: null, assistenza_whatsapp: null, pronta_consegna: "Pronta consegna", garanzia: null, firmatario: "Mario Inventato" }, misto);
  c("l'oggetto che entra non viene modificato", true, (() => { const g = { reso: " x ", assistenza: "{{y}}" }; const p = JSON.stringify(g); T.filtraConfermati(g); return JSON.stringify(g) === p; })());
  c("nessun testo di servizio scritto nel codice: con tutto vuoto non esce una sola parola", [], Object.values(T.filtraConfermati({})).filter((v) => v !== null));
}
