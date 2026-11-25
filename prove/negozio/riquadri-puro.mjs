/** ── EDITOR PRODOTTI · E5 · I RIQUADRI DELLA SCHEDA: LE REGOLE SENZA SCHERMO ─
 *  `src/crm/ecommerce/prodotti/riquadri-puro.ts`: quali riquadri ci sono, quali si vedono (senza opzioni / con opzioni / Invisible Derm),
 *  quali partono chiusi in un prodotto nuovo, a quale riquadro porta ogni voce di «Prima di pubblicare» e il segno «a posto / da sistemare (n)».
 *  È costruito sopra `sezioneDi` di `scheda-pura.ts` (le 11 sezioni di oggi non cambiano). Dati inventati. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";

const caricaBundle = (percorso, radice) => {
  const r = buildSync({ entryPoints: [percorso], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E5 · RIQUADRI: REGOLE PURE (25/11/2026)");
  const file = join(radice, "src/crm/ecommerce/prodotti/riquadri-puro.ts");
  const R = existsSync(file) ? await caricaBundle(file, radice) : {};
  c("riquadri-puro.ts esporta le funzioni", true, ["RIQUADRI", "riquadriVisibili", "apertoDiPartenza", "riquadroDi", "conteggiPerRiquadro", "segnoRiquadro"].every((n) => n in R));
  if (!existsSync(file)) return;

  // ── l'elenco ──
  const principale = R.RIQUADRI.filter((r) => r.colonna === "principale").map((r) => r.id);
  const laterale = R.RIQUADRI.filter((r) => r.colonna === "laterale").map((r) => r.id);
  c("colonna principale: i dieci riquadri della SPEC §3.3, nell'ordine", ["titolo", "foto", "prezzo", "giacenza", "spedizione", "varianti", "seo", "caratteristiche", "uso", "reso"], principale);
  c("colonna laterale: Stato, Dove si vede, Organizzazione, Dati per i cataloghi, Note", ["stato", "canali", "organizzazione", "cataloghi", "note"], laterale);
  c("gli identificativi sono tutti diversi", R.RIQUADRI.length, new Set(R.RIQUADRI.map((r) => r.id)).size);
  c("i titoli sono quelli della SPEC", ["Titolo e descrizione", "Foto e video", "Prezzo", "Giacenza", "Spedizione", "Varianti", "Anteprima nei motori di ricerca (SEO)", "Caratteristiche", "Come si usa e cosa c'è dentro", "Reso, consulenza e consegna"],
    R.RIQUADRI.filter((r) => r.colonna === "principale").map((r) => r.titolo));

  // ── cosa si vede ──
  const tutti = R.RIQUADRI.map((r) => r.id);
  c("senza opzioni: si vedono tutti", tutti, R.riquadriVisibili({ modalita: "semplice", invisibleDerm: false }));
  c("con opzioni: spariscono Prezzo, Giacenza e Spedizione", tutti.filter((i) => !["prezzo", "giacenza", "spedizione"].includes(i)), R.riquadriVisibili({ modalita: "opzioni", invisibleDerm: false }));
  c("Invisible Derm senza opzioni: manca solo il Prezzo", tutti.filter((i) => i !== "prezzo"), R.riquadriVisibili({ modalita: "semplice", invisibleDerm: true }));
  c("Invisible Derm con opzioni: come le opzioni", R.riquadriVisibili({ modalita: "opzioni", invisibleDerm: false }), R.riquadriVisibili({ modalita: "opzioni", invisibleDerm: true }));

  // ── cosa parte chiuso ──
  const chiusiNuovo = R.RIQUADRI.map((r) => r.id).filter((i) => !R.apertoDiPartenza(i, { nuovo: true }));
  c("prodotto nuovo: chiusi i riquadri 8-10 e i dati per i cataloghi", ["caratteristiche", "uso", "reso", "cataloghi"], chiusiNuovo);
  c("prodotto nuovo: i riquadri 1-7 sono aperti", true, principale.slice(0, 7).every((i) => R.apertoDiPartenza(i, { nuovo: true })));
  c("prodotto già salvato: tutto aperto", true, tutti.every((i) => R.apertoDiPartenza(i, { nuovo: false })));
  c("i richiudibili sono quelli che partono chiusi", ["caratteristiche", "uso", "reso", "cataloghi"], R.RIQUADRI.filter((r) => r.richiudibile).map((r) => r.id));

  // ── a quale riquadro porta una voce ──
  const ctx = { nome: "Patch Prova", sku: "HG-T01" };
  const dove = (campo, modalita, frase = "una frase") => R.riquadroDi({ campo, frase }, { ...ctx, modalita });
  for (const [campo, semplice, opzioni] of [
    ["nome", "titolo", "titolo"],
    ["descrizioneBreve", "titolo", "titolo"],
    ["descrizioneLunga", "titolo", "titolo"],
    ["rigaPresentazione", "titolo", "titolo"],
    ["perChi", "titolo", "titolo"],
    ["fotoPrincipale", "foto", "foto"],
    ["alt", "foto", "foto"],
    ["prezzo", "prezzo", "varianti"],
    ["gtin", "giacenza", "varianti"],
    ["varianti", "giacenza", "varianti"],
    ["pesoG", "spedizione", "varianti"],
    ["classeSpedizione", "spedizione", "varianti"],
    ["spedizione", "spedizione", "varianti"],
    ["slug", "seo", "seo"],
    ["seoTitolo", "seo", "seo"],
    ["seoDescrizione", "seo", "seo"],
    ["caratteristiche", "caratteristiche", "caratteristiche"],
    ["passi", "uso", "uso"],
    ["confezione", "uso", "uso"],
    ["avvertenze", "uso", "uso"],
    ["faq", "uso", "uso"],
    ["reso", "reso", "reso"],
    ["resoGiorni", "reso", "reso"],
    ["boxConsulenza", "reso", "reso"],
    ["correlatoId", "reso", "reso"],
    ["canali", "canali", "canali"],
    ["tipo", "organizzazione", "organizzazione"],
    ["marca", "organizzazione", "organizzazione"],
    ["fornitore", "organizzazione", "organizzazione"],
    ["categoria", "organizzazione", "organizzazione"],
    ["categorie", "organizzazione", "organizzazione"],
    ["mpn", "cataloghi", "cataloghi"],
    ["categoriaGoogle", "cataloghi", "cataloghi"],
    ["noteInterne", "note", "note"],
    ["notaTitolare", "note", "note"],
  ])
    c(`riquadroDi: «${campo}» → ${semplice}${semplice === opzioni ? "" : ` (con opzioni: ${opzioni})`}`, [semplice, opzioni], [dove(campo, "semplice"), dove(campo, "opzioni")]);
  c("riquadroDi: lo SKU del prodotto → Giacenza (senza opzioni)", "giacenza", dove("sku", "semplice", "Lo SKU “HG-T01” è già usato da un altro prodotto."));
  c("riquadroDi: lo SKU del prodotto con opzioni → Varianti (la Giacenza non c'è)", "varianti", dove("sku", "opzioni", "Lo SKU “HG-T01” è già usato da un altro prodotto."));
  c("riquadroDi: lo SKU di una variante → Varianti", "varianti", dove("sku", "semplice", "Lo SKU “ROSSO-S” è già usato."));
  c("riquadroDi: un campo sconosciuto porta in cima (Titolo)", "titolo", dove("qualcosaDiNuovo", "semplice"));

  // ── i conteggi e il segno ──
  const bloccanti = [{ campo: "nome", frase: "Scrivi il nome." }, { campo: "descrizioneBreve", frase: "Manca la descrizione breve." }, { campo: "fotoPrincipale", frase: "Manca la foto principale." }];
  const informativi = [{ campo: "seoTitolo", frase: "Il titolo SEO è lungo." }];
  const conti = R.conteggiPerRiquadro(bloccanti, informativi, { ...ctx, modalita: "semplice" });
  c("conteggi: Titolo ha due da sistemare", { bloccanti: 2, informativi: 0 }, conti.titolo);
  c("conteggi: Foto ne ha una", { bloccanti: 1, informativi: 0 }, conti.foto);
  c("conteggi: SEO ha una da controllare", { bloccanti: 0, informativi: 1 }, conti.seo);
  c("conteggi: ogni riquadro ha il suo conteggio, anche a zero", true, tutti.every((i) => conti[i] && conti[i].bloccanti >= 0));
  c("segno: da sistemare con il numero", { tono: "da_sistemare", testo: "da sistemare (2)" }, R.segnoRiquadro(conti.titolo));
  c("segno: da controllare con il numero", { tono: "da_controllare", testo: "da controllare (1)" }, R.segnoRiquadro(conti.seo));
  c("segno: a posto", { tono: "ok", testo: "a posto" }, R.segnoRiquadro(conti.prezzo));

  // ── sorgente ──
  const src = readFileSync(file, "utf8");
  c("riquadri-puro.ts: niente React e niente rete", false, /from "react"|\bfetch\(/.test(src));
  c("riquadri-puro.ts: si appoggia a sezioneDi di scheda-pura", true, /sezioneDi/.test(src) && /from "\.\/scheda-pura"/.test(src));
}
