/** ── DALLE RIGHE DEL CSV AI PRODOTTI (EDITOR PRODOTTI · E2b) ───────────────
 *  SPEC §6.1-6.5. Prende le righe di celle di `leggiCsv` e le trasforma in prodotti già normalizzati (`ProdottoImport`), con gli
 *  errori riga per riga (la riga 1 è l'intestazione, come in Excel) e gli avvisi. Non scrive niente e non apre niente: è una funzione pura.
 *   - Si raggruppa per Handle (come Shopify: la prima riga è il prodotto e la prima variante, le altre sono varianti);
 *   - colonne e gruppi stanno in `Map`: un'intestazione o un handle «__proto__» è solo un nome;
 *   - ogni cella ha un tetto di 6000 segni (qui, non nel lettore); i prezzi passano da `centDaEuro`;
 *   - un prodotto con un errore NON entra (nemmeno le altre varianti); gli altri sì. Tutto entra in bozza, senza foto, senza prezzo barrato. */
import { slugDa } from "@/shop/cms/modello";
import { eInvisibleDerm } from "@/shop/cms/pubblico";
import { MAX_CELLA } from "./csv-lettore";
import { COLONNE, mappaColonne, type ChiaveColonna } from "./csv-colonne";
import { LIMITI, type AvvisoRiga, type ErroreRiga, type ProdottoImport, type VarianteImport } from "./import-contratto";
import { leggiPrezzo, mostra, normalizzaSku, validaProdottoImport } from "./import-regole";
import { htmlInTesto } from "./html-testo";

export interface ProdottoRespinto {
  handle: string;
  titolo: string;
  /** La prima riga del prodotto. */
  riga: number;
}
export interface Conteggi {
  /** Righe di dati lette (vuote escluse). */
  righe: number;
  /** I prodotti trovati, anche quelli con errori. */
  prodotti: number;
  varianti: number;
  importabili: number;
  conErrori: number;
  avvisi: number;
  immaginiIgnorate: number;
  prodottiConBarrato: number;
}
export interface LetturaProdotti {
  /** Solo quelli SENZA errori: sono gli unici che si possono importare. */
  prodotti: ProdottoImport[];
  respinti: ProdottoRespinto[];
  errori: ErroreRiga[];
  avvisi: AvvisoRiga[];
  colonneIgnorate: string[];
  conteggi: Conteggi;
}
export interface OpzioniLettura {
  /** Le categorie che esistono già (le conosce il server, la verifica le porta al browser). */
  categorie: readonly { id: string; slug: string; nome: string }[];
}

const NIENTE: Conteggi = { righe: 0, prodotti: 0, varianti: 0, importabili: 0, conErrori: 0, avvisi: 0, immaginiIgnorate: 0, prodottiConBarrato: 0 };
const fermo = (riga: number, frase: string, colonneIgnorate: string[] = [], righe = 0): LetturaProdotti =>
  ({ prodotti: [], respinti: [], errori: [{ riga, frase }], avvisi: [], colonneIgnorate, conteggi: { ...NIENTE, righe } });

/** Le colonne che possono contenere a capo (testi lunghi): in un'altra, un a capo è il segno di una virgoletta spaiata. */
const COLONNE_LUNGHE = new Set<ChiaveColonna>(["corpo", "breve", "seoDescrizione", "altra"]);
const nomeColonna = (k: ChiaveColonna): string => COLONNE.find((x) => x.chiave === k)?.intestazione ?? k;
const uno = (t: string) => t.replace(/\s+/g, " ").trim();
const VERO = /^(?:true|vero|si|sì|yes|1|active|attivo)$/i;

/** Le due lettere (o cifre) del valore per lo SKU proposto, come `combinazioni()` della scheda: «Nero» → NE, «30 cm» → 30. */
const sigla = (valore: string): string =>
  (valore.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "") || "XX").slice(0, 2);

interface Gruppo {
  handle: string;
  righe: { riga: number; celle: readonly string[] }[];
  sparso: boolean;
}

export function leggiProdottiCsv(record: readonly (readonly string[])[], opz: OpzioniLettura): LetturaProdotti {
  if (record.length === 0) return fermo(1, "Il file non contiene prodotti: manca anche la riga con i nomi delle colonne.");
  const mappa = mappaColonne(record[0]);
  const mancano = (["handle", "titolo"] as const).filter((k) => !mappa.indici.has(k)).map(nomeColonna);
  if (mancano.length) return fermo(1, `Nel file manca la colonna ${mancano.join(" e la colonna ")}. Scarica il file modello e usa quelle intestazioni.`, mappa.ignorate);

  const cella = (celle: readonly string[], k: ChiaveColonna): string => {
    const i = mappa.indici.get(k);
    return i === undefined ? "" : (celle[i] ?? "").trim();
  };

  /* ── 1. le righe → i gruppi (un prodotto ciascuno) ── */
  const gruppi = new Map<string, Gruppo>();
  const erroriFile: ErroreRiga[] = [];
  const avvisiFile: AvvisoRiga[] = [];
  let righe = 0;
  let ultimo: Gruppo | null = null;
  let aCapoStrani = 0;
  let primoStrano = 0;
  for (let i = 1; i < record.length; i++) {
    const celle = record[i];
    if (celle.every((x) => x.trim() === "")) continue;
    const riga = i + 1;
    righe++;
    const handle = slugDa(cella(celle, "handle"));
    const titolo = cella(celle, "titolo");
    let gruppo: Gruppo | undefined;
    if (cella(celle, "handle") || titolo) {
      const chiave = handle || slugDa(titolo) ? `h:${handle || slugDa(titolo)}` : `r:${riga}`;
      gruppo = gruppi.get(chiave);
      if (gruppo && gruppo !== ultimo) gruppo.sparso = true;
      if (!gruppo) { gruppo = { handle: handle || slugDa(titolo), righe: [], sparso: false }; gruppi.set(chiave, gruppo); }
    } else if (ultimo) gruppo = ultimo;
    else { erroriFile.push({ riga, frase: "Questa riga non ha né Handle né Title: non so a quale prodotto appartiene." }); continue; }
    gruppo.righe.push({ riga, celle });
    ultimo = gruppo;
    // Un a capo in una colonna che non è un testo lungo, o più celle dell'intestazione: di solito è una virgoletta spaiata che ha unito più righe.
    const strano =
      (celle.length > record[0].length && celle.slice(record[0].length).some((x) => x.trim() !== "")) ||
      [...mappa.indici].some(([k, j]) => !COLONNE_LUNGHE.has(k) && /[\n\r]/.test(celle[j] ?? ""));
    if (strano) { aCapoStrani++; if (!primoStrano) primoStrano = riga; }
  }
  if (gruppi.size === 0) return fermo(erroriFile[0]?.riga ?? 1, erroriFile[0]?.frase ?? "Il file non contiene prodotti: ci sono solo le intestazioni o righe vuote.", mappa.ignorate, righe);
  if (gruppi.size > LIMITI.prodottiPerFile)
    return fermo(1, `Il file ha ${gruppi.size} prodotti: il massimo è ${LIMITI.prodottiPerFile} per volta. Dividilo in più file.`, mappa.ignorate, righe);

  /* ── 2. ogni gruppo → un prodotto ── */
  const categorieNote = opz.categorie.map((c) => ({ slug: c.slug, nome: c.nome.trim().toLowerCase() }));
  const costruiti: { g: Gruppo; p: ProdottoImport; errori: ErroreRiga[]; avvisi: AvvisoRiga[]; titolo: string }[] = [];
  let immagini = 0;
  let conBarrato = 0;
  let pubblicati = 0;

  for (const g of gruppi.values()) {
    const E: ErroreRiga[] = [];
    const A: AvvisoRiga[] = [];
    const err = (riga: number, frase: string) => E.push({ riga, handle: g.handle, frase });
    const avv = (riga: number, frase: string) => A.push({ riga, handle: g.handle, frase });
    const [prima] = g.righe;
    const riga1 = prima.riga;

    // tetto per cella (qui, non nel lettore) e conteggio di ciò che si ignora
    let barrato = false;
    let pub = false;
    for (const r of g.righe) {
      const lunga = r.celle.findIndex((x) => x.length > MAX_CELLA);
      if (lunga >= 0) {
        err(r.riga, `La cella «${(record[0][lunga] ?? "").trim() || `colonna ${lunga + 1}`}» ha ${r.celle[lunga].length} segni: il massimo è ${MAX_CELLA}.`);
      }
      if (cella(r.celle, "immagine")) immagini++;
      if (cella(r.celle, "immagineVariante")) immagini++;
      if (cella(r.celle, "barrato")) barrato = true;
      if (VERO.test(cella(r.celle, "pubblicato")) || /^active$/i.test(cella(r.celle, "stato"))) pub = true;
    }
    if (barrato) conBarrato++;
    if (pub) pubblicati++;

    const rawHandle = cella(prima.celle, "handle");
    if (rawHandle && g.handle && rawHandle !== g.handle) avv(riga1, `L'indirizzo «${mostra(rawHandle)}» è diventato «${g.handle}».`);
    if (g.sparso) avv(riga1, "Le righe di questo prodotto non sono vicine nel file: le ho unite lo stesso.");

    const titolo = uno(cella(prima.celle, "titolo"));
    const lungo = (k: ChiaveColonna) => { const t = cella(prima.celle, k); return t.length > MAX_CELLA ? "" : t; };

    // tipo
    const tipoGrezzo = uno(cella(prima.celle, "tipo")).toLowerCase();
    const tipo = tipoGrezzo === "patch" || tipoGrezzo === "cura" || tipoGrezzo === "kit" ? tipoGrezzo : "cura";
    if (tipo !== tipoGrezzo) avv(riga1, tipoGrezzo ? `Il tipo «${mostra(tipoGrezzo)}» non è patch, cura o kit: l'ho messo «cura», lo cambi nella scheda.` : "Manca il tipo (patch, cura o kit): l'ho messo «cura», lo cambi nella scheda.");

    // opzioni: i nomi stanno nella prima riga che li scrive (come Shopify), i valori in ogni riga
    const nomi: string[] = ["", "", ""];
    const opt = (k: number, parte: "Nome" | "Valore") => `opt${k}${parte}` as ChiaveColonna;
    for (const r of g.righe) for (let k = 1; k <= 3; k++) if (!nomi[k - 1]) nomi[k - 1] = uno(cella(r.celle, opt(k, "Nome")));
    let massimoOpzioni = 0;
    for (const r of g.righe)
      for (const o of mappa.oltre) if ((r.celle[o.indice] ?? "").trim() && o.numero > massimoOpzioni) { massimoOpzioni = o.numero; }
    if (massimoOpzioni) {
      const r = g.righe.find((x) => mappa.oltre.some((o) => (x.celle[o.indice] ?? "").trim()));
      err(r?.riga ?? riga1, `Ci sono ${massimoOpzioni} opzioni, il massimo è 3.`);
    }

    const varianti: VarianteImport[] = [];
    const senzaSku: number[] = [];
    const combo = new Map<string, number>();
    g.righe.forEach((r, n) => {
      const opzioni: [string, string][] = [];
      for (let k = 1; k <= 3; k++) {
        const val = uno(cella(r.celle, opt(k, "Valore")));
        if (!val) continue;
        if (nomi[k - 1].toLowerCase() === "title" && val.toLowerCase() === "default title") continue; // un prodotto semplice, come lo esporta Shopify
        if (!nomi[k - 1]) { err(r.riga, `Il valore «${mostra(val)}» non ha il nome dell'opzione: scrivilo in Option${k} Name.`); continue; }
        opzioni.push([nomi[k - 1], val]);
      }
      const sku = normalizzaSku(cella(r.celle, "sku"));
      const prezzoT = cella(r.celle, "prezzo");
      const qtaT = cella(r.celle, "giacenza");
      const grammiT = cella(r.celle, "grammi");
      const barcode = uno(cella(r.celle, "barcode"));
      const costoT = cella(r.celle, "costo");
      // Le righe che portano solo una foto (come le esporta Shopify) non sono varianti.
      if (n > 0 && !sku && !prezzoT && !qtaT && !grammiT && !barcode && !costoT && opzioni.length === 0) return;

      const prezzo = leggiPrezzo(prezzoT, "Variant Price");
      if (!prezzo.ok) err(r.riga, prezzo.frase);
      const costo = leggiPrezzo(costoT, "Cost per item");
      if (!costo.ok) err(r.riga, costo.frase);
      const intero = (t: string, colonna: string, max: number): number | null => {
        if (!t) return null;
        if (!/^\d+(?:[.,]0+)?$/.test(t)) { err(r.riga, `${colonna} «${mostra(t)}» non è valida: scrivi un numero intero, 0 o più (senza decimali né punti).`); return null; }
        const x = Number(t.replace(/[.,]0+$/, ""));
        if (x > max) { err(r.riga, `${colonna} «${mostra(t)}» è troppo alta: il massimo è ${max}.`); return null; }
        return x;
      };
      const giacenza = intero(qtaT, "La giacenza (Variant Inventory Qty)", LIMITI.giacenza) ?? 0;
      const grammi = intero(grammiT, "Il peso (Variant Grams)", LIMITI.peso);

      const chiave = opzioni.map(([, x]) => x.toLowerCase()).join("\u0001");
      if (opzioni.length) {
        const gia = combo.get(chiave);
        if (gia) err(r.riga, `La variante «${opzioni.map(([, x]) => x).join(" / ")}» è già alla riga ${gia}.`);
        else combo.set(chiave, r.riga);
      }
      if (!sku) senzaSku.push(varianti.length);
      varianti.push({
        riga: r.riga,
        sku,
        nome: opzioni.length ? opzioni.map(([, x]) => x).join(" / ") : "Unica",
        // Object.fromEntries crea chiavi proprie: un'opzione chiamata «__proto__» resta un nome.
        opzioni: Object.fromEntries(opzioni),
        prezzoCent: prezzo.ok ? prezzo.cent : null,
        pesoG: grammi ? grammi : null,
        gtin: barcode || null,
        costoCent: costo.ok ? costo.cent : null,
        giacenza,
      });
    });
    if (varianti.length > 1)
      for (const v of varianti) if (Object.keys(v.opzioni).length === 0) err(v.riga, "La variante non ha opzioni: con più varianti ogni riga ha bisogno di Option1 Name e Option1 Value (per esempio Colore: Nero).");

    // gli SKU mancanti: se ne propone uno, e si dice
    const primoSku = varianti[0]?.sku ?? "";
    const skuProdotto = primoSku || normalizzaSku(g.handle).slice(0, 40);
    const usati = new Set(varianti.map((v) => v.sku).filter(Boolean));
    for (const n of senzaSku) {
      const v = varianti[n];
      if (!skuProdotto) { err(v.riga, "Manca lo SKU (Variant SKU) e non posso ricavarlo: scrivilo."); continue; }
      const sigle = Object.values(v.opzioni).map(sigla).join("-");
      const proposto = sigle ? `${skuProdotto}-${sigle}` : skuProdotto;
      let x = proposto.slice(0, 40);
      for (let k = 2; usati.has(x) && sigle; k++) x = proposto.slice(0, 40 - `-${k}`.length) + `-${k}`;
      usati.add(x);
      v.sku = x;
      avv(v.riga, `Manca lo SKU: propongo ${x}.`);
    }

    // il prezzo, il peso e il barcode del prodotto sono quelli della prima variante
    const derm = eInvisibleDerm(titolo, g.handle);
    const [v0] = varianti;
    let prezzoCent = v0?.prezzoCent ?? 0;
    if (derm && (prezzoCent > 0 || varianti.some((v) => (v.prezzoCent ?? 0) > 0))) {
      avv(riga1, "Invisible Derm non ha prezzo nello shop: ho scartato il prezzo del file (il costo si vede in consulenza).");
      prezzoCent = 0;
      for (const v of varianti) v.prezzoCent = null;
    }
    for (const v of varianti) if (v.prezzoCent === prezzoCent && v !== v0) v.prezzoCent = null;
    if (v0) v0.prezzoCent = null; // la prima variante vale «il prezzo del prodotto»
    const peso = v0?.pesoG ?? undefined;
    for (const v of varianti.slice(1)) if (v.pesoG !== null && v.pesoG === peso) v.pesoG = null;
    const unica = varianti.length === 1;
    const gtinProdotto = unica ? varianti[0].gtin ?? undefined : undefined;
    if (v0) { if (unica) v0.gtin = null; v0.pesoG = null; }

    // le categorie: quelle che esistono entrano, le altre sono un avviso
    const categorie: string[] = [];
    const elenco = (g.righe.map((r) => cella(r.celle, "categorie")).find(Boolean) ?? "").split("|").map(uno).filter(Boolean);
    for (const nome of elenco) {
      const trovata = categorieNote.find((c) => c.slug === nome.toLowerCase() || c.slug === slugDa(nome) || c.nome === nome.toLowerCase());
      if (!trovata) avv(riga1, `La categoria «${mostra(nome)}» non esiste: creala in Categorie, il prodotto entra senza.`);
      else if (!categorie.includes(trovata.slug)) categorie.push(trovata.slug);
    }

    const corpoGrezzo = lungo("corpo");
    const marca = uno(cella(prima.celle, "marca"));
    const breve = lungo("breve").trim();
    const lunga = htmlInTesto(corpoGrezzo).trim();
    const catG = uno(cella(prima.celle, "catGoogle"));
    const forn = uno(cella(prima.celle, "fornitore"));
    const seoT = uno(cella(prima.celle, "seoTitolo"));
    const seoD = uno(lungo("seoDescrizione"));
    const prodotto: ProdottoImport = {
      handle: g.handle,
      titolo,
      tipo,
      ...(marca ? { marca } : {}),
      ...(breve ? { descrizioneBreve: breve } : {}),
      ...(lunga ? { descrizioneLunga: lunga } : {}),
      ...(catG ? { categoriaGoogle: catG } : {}),
      ...(forn ? { fornitore: forn } : {}),
      ...(seoT ? { seoTitolo: seoT } : {}),
      ...(seoD ? { seoDescrizione: seoD } : {}),
      categorie,
      sku: primoSku || skuProdotto,
      prezzoCent,
      ...(peso ? { pesoG: peso } : {}),
      ...(gtinProdotto ? { gtin: gtinProdotto } : {}),
      varianti,
    };
    // Gli stessi controlli che rifà il server (lunghezze, parole vietate, SKU, massimi).
    const esito = validaProdottoImport(prodotto, {});
    E.push(...esito.errori);
    A.push(...esito.avvisi);
    costruiti.push({ g, p: prodotto, errori: E, avvisi: A, titolo });
  }

  /* ── 3. SKU scritto due volte nel file, su prodotti diversi (l'errore è del secondo) ── */
  const visti = new Map<string, { riga: number; gruppo: Gruppo }>();
  for (const c of costruiti) {
    const suoi = new Set<string>();
    for (const v of c.p.varianti) {
      if (!v.sku) continue;
      const prima = visti.get(v.sku);
      if (prima && prima.gruppo !== c.g && !suoi.has(v.sku))
        c.errori.push({ riga: v.riga, handle: c.g.handle, frase: `Lo SKU ${v.sku} è scritto due volte nel file (righe ${prima.riga} e ${v.riga}).` });
      if (!prima) visti.set(v.sku, { riga: v.riga, gruppo: c.g });
      suoi.add(v.sku);
    }
  }

  /* ── 4. l'esito ── */
  const prodotti: ProdottoImport[] = [];
  const respinti: ProdottoRespinto[] = [];
  const errori: ErroreRiga[] = [...erroriFile];
  const avvisi: AvvisoRiga[] = [...avvisiFile];
  let nVarianti = 0;
  for (const c of costruiti) {
    nVarianti += c.p.varianti.length;
    avvisi.push(...c.avvisi);
    if (c.errori.length === 0) { prodotti.push(c.p); continue; }
    const tutte = c.g.righe.map((r) => r.riga);
    respinti.push({ handle: c.g.handle, titolo: c.titolo, riga: tutte[0] });
    errori.push(...c.errori.map((e) => ({ ...e, righeProdotto: tutte })));
  }
  errori.sort((a, b) => a.riga - b.riga);
  avvisi.sort((a, b) => a.riga - b.riga);

  const generali: AvvisoRiga[] = [];
  if (conBarrato) generali.push({ riga: 0, frase: `${conBarrato} ${conBarrato === 1 ? "prodotto aveva" : "prodotti avevano"} un prezzo barrato: non è stato importato (nello shop non ci sono prezzi barrati).` });
  if (immagini) generali.push({ riga: 0, frase: `${immagini} ${immagini === 1 ? "immagine non importata" : "immagini non importate"}: le foto si caricano a mano dalla scheda del prodotto.` });
  if (pubblicati) generali.push({ riga: 0, frase: "Il file chiede di pubblicare alcuni prodotti (Published o Status): tutto entra in bozza, si pubblica dalla scheda." });
  if (aCapoStrani) generali.push({ riga: primoStrano, frase: `Alla riga ${primoStrano} c'è un a capo dove non dovrebbe (o più celle del previsto): forse una virgoletta spaiata ha unito più righe. Ho letto ${righe} righe e ${gruppi.size} prodotti: controlla che siano quelli che ti aspetti.` });
  if (mappa.doppie.length) generali.push({ riga: 1, frase: `Le colonne ${mappa.doppie.map((x) => `«${x}»`).join(", ")} sono scritte due volte: vale la prima.` });
  avvisi.unshift(...generali);

  return {
    prodotti,
    respinti,
    errori,
    avvisi,
    colonneIgnorate: mappa.ignorate,
    conteggi: { righe, prodotti: gruppi.size, varianti: nVarianti, importabili: prodotti.length, conErrori: respinti.length, avvisi: avvisi.length, immaginiIgnorate: immagini, prodottiConBarrato: conBarrato },
  };
}
