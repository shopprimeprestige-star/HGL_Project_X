/** ── EDITOR PRODOTTI · E13 · LE FOTO LETTE DAL CSV DI SHOPIFY ─────────────────
 *  `src/crm/negozio/csv-prodotti.ts`: per ogni prodotto le foto in ordine di «Image Position» (righe di sole foto comprese), «Variant Image» in coda
 *  se non c'è già, niente doppioni, l'alt di «Image Alt Text»; al massimo 5 (principale + foto2..foto5), le altre «oltre il limite»; solo
 *  `https://cdn.shopify.com` (ogni altro indirizzo è un avviso e si salta). Le foto NON entrano nel prodotto che va al server. Dati inventati. */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

/** L'intestazione di un'esportazione di Shopify, così com'è. */
const INT = "Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare At Price,Variant Requires Shipping,Variant Taxable,Variant Barcode,Image Src,Image Position,Image Alt Text,Gift Card,SEO Title,SEO Description,Variant Image,Variant Weight Unit,Cost per item,Status".split(",");
const tab = (righe) => [INT, ...righe.map((r) => INT.map((h) => r[h] ?? ""))];
const CDN = "https://cdn.shopify.com/s/files/1/0001/files";

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E13 · LE FOTO DAL CSV DI SHOPIFY (26/11/2026)");
  const M = await carica(radice, "src/crm/negozio/csv-prodotti.ts").catch((e) => ({ errore: String(e) }));
  c("csv-prodotti.ts si compila e si carica", undefined, M.errore);
  if (M.errore) return;
  const L = (righe) => M.leggiProdottiCsv(tab(righe), { categorie: [] });

  c("l'elenco chiuso degli indirizzi ammessi è una costante: solo cdn.shopify.com", ["cdn.shopify.com"], M.HOST_FOTO && [...M.HOST_FOTO]);
  const ammesso = (u) => (typeof M.urlFotoAmmesso === "function" ? M.urlFotoAmmesso(u) : "manca");
  c("indirizzi ammessi e no (https, host esatto, niente utente, niente porta, niente http)",
    [true, true, false, false, false, false, false, false, false, false],
    [`${CDN}/a.jpg?v=1`, "HTTPS://CDN.SHOPIFY.COM/x.png", "http://cdn.shopify.com/a.jpg", "https://cdn.shopify.com.esempio.invalid/a.jpg", "https://esempio.invalid/cdn.shopify.com/a.jpg",
      "https://utente@cdn.shopify.com/a.jpg", "https://cdn.shopify.com:8443/a.jpg", "//cdn.shopify.com/a.jpg", "javascript:alert(1)", "non è un indirizzo"].map(ammesso));

  // ── un prodotto con varianti, righe di sole foto in disordine, Variant Image, alt ──
  const r = L([
    { Handle: "pettine", Title: "Pettine", "Option1 Name": "Colore", "Option1 Value": "Nero", "Variant SKU": "PE-NE", "Variant Price": "10", "Image Src": `${CDN}/p1.jpg?v=11`, "Image Position": "1", "Image Alt Text": "  Pettine   nero  ", "Variant Image": `${CDN}/v-rosso.jpg?v=5` },
    { Handle: "pettine", "Option1 Value": "Rosso", "Variant SKU": "PE-RO", "Variant Price": "10", "Variant Image": `${CDN}/p3.jpg?v=3` },
    { Handle: "pettine", "Image Src": `${CDN}/p3.jpg?v=3`, "Image Position": "3" },
    { Handle: "pettine", "Image Src": `${CDN}/p2.jpg?v=2`, "Image Position": "2", "Image Alt Text": "Di lato" },
    { Handle: "pettine", "Image Src": `${CDN}/p1.jpg?v=99`, "Image Position": "4" },
  ]);
  const fp = r.foto?.get?.("pettine") ?? [];
  c("le foto sono per prodotto (una Map per handle), in ordine di Image Position, poi le Variant Image nuove", [`${CDN}/p1.jpg?v=11`, `${CDN}/p2.jpg?v=2`, `${CDN}/p3.jpg?v=3`, `${CDN}/v-rosso.jpg?v=5`], fp.map((f) => f.url));
  c("…la posizione è 1..N nell'ordine (1 = principale), con la riga del file", [[1, 2, 3, 4], [2, 5, 4, 2]], [fp.map((f) => f.posizione), fp.map((f) => f.riga)]);
  c("…l'alt viene da Image Alt Text (spazi ripuliti); vuoto se il file non lo dice", ["Pettine nero", "Di lato", "", ""], fp.map((f) => f.alt));
  c("…niente doppioni: la stessa foto con un altro «?v=» o ripetuta come Variant Image conta una volta", 4, fp.length);
  c("la riga di sole foto non diventa una variante", 2, r.prodotti[0]?.varianti.length);
  c("le colonne delle foto non sono più fra quelle ignorate", [], r.colonneIgnorate.filter((x) => /^(Image|Variant Image)/.test(x)));

  // ── oltre 5, indirizzi non di Shopify, prodotto con errori ──
  const molte = Array.from({ length: 7 }, (_x, i) => ({ Handle: "spazzola", ...(i === 0 ? { Title: "Spazzola", "Variant SKU": "SP", "Variant Price": "5" } : {}), "Image Src": `${CDN}/s${i + 1}.jpg`, "Image Position": String(i + 1) }));
  const x = L([
    ...molte,
    { Handle: "olio", Title: "Olio", "Variant SKU": "OL", "Variant Price": "5", "Image Src": "https://esempio.invalid/o1.jpg", "Image Position": "1" },
    { Handle: "olio", "Image Src": `${CDN}/o2.jpg`, "Image Position": "2", "Image Alt Text": "Olio" },
    { Handle: "olio", "Image Src": "http://cdn.shopify.com/o3.jpg", "Image Position": "3" },
    { Handle: "rotto", Title: "Rotto", "Variant SKU": "RO", "Variant Price": "abc", "Image Src": `${CDN}/r1.jpg`, "Image Position": "1" },
  ]);
  c("oltre 5 per prodotto: si tengono le prime 5 (principale + foto2..foto5)", [`${CDN}/s1.jpg`, `${CDN}/s5.jpg`, 5], [x.foto?.get?.("spazzola")?.[0]?.url, x.foto?.get?.("spazzola")?.[4]?.url, x.foto?.get?.("spazzola")?.length]);
  c("un indirizzo non di Shopify non prende un posto: la foto buona diventa la principale", [[`${CDN}/o2.jpg`], [1]], [(x.foto?.get?.("olio") ?? []).map((f) => f.url), (x.foto?.get?.("olio") ?? []).map((f) => f.posizione)]);
  c("…e ogni foto saltata è un avviso sulla sua riga: «foto saltata: indirizzo non di Shopify»", [9, 11], x.avvisi.filter((a) => /foto saltata: indirizzo non di Shopify/i.test(a.frase)).map((a) => a.riga));
  c("un prodotto con errori non entra: nessuna foto per lui, e non si contano", [false, 0], [x.foto?.has?.("rotto") ?? "manca", x.prodotti.filter((p) => p.handle === "rotto").length]);
  c("conteggi: 6 foto da caricare, 2 oltre le 5, 2 saltate (non di Shopify)", [6, 2, 2], [x.conteggi.fotoDaCaricare, x.conteggi.fotoOltre, x.conteggi.fotoSaltate]);
  c("l'avviso generale dice «6 foto da caricare, 2 oltre le 5 per prodotto»; niente più «si caricano a mano»", [true, false], [x.avvisi.some((a) => a.riga === 0 && /6 foto da caricare, 2 oltre le 5 per prodotto/.test(a.frase)), x.avvisi.some((a) => /a mano|non importat/.test(a.frase))]);
  c("il conteggio vecchio non c'è più", false, "immaginiIgnorate" in x.conteggi);

  // ── il contratto: le foto restano nel browser ──
  const tutto = JSON.stringify([...r.prodotti, ...x.prodotti]);
  c("le foto NON viaggiano verso il server: nessun indirizzo né campo foto nel ProdottoImport", [false, false], [/cdn\.shopify|esempio\.invalid/.test(tutto), /"(foto|immagin\w*|image\w*)"/i.test(tutto)]);
  const senza = L([{ Handle: "nudo", Title: "Nudo", Type: "cura", "Variant SKU": "NU", "Variant Price": "1" }]);
  c("un file senza foto: nessun avviso sulle foto, conteggi a zero, mappa vuota", [0, 0, 0, 0], [senza.avvisi.length, senza.conteggi.fotoDaCaricare, senza.conteggi.fotoOltre, senza.foto?.size ?? -1]);
  const posVuota = L([
    { Handle: "pv", Title: "Pv", "Variant SKU": "PV", "Variant Price": "1", "Image Src": `${CDN}/b.jpg` },
    { Handle: "pv", "Image Src": `${CDN}/a.jpg`, "Image Position": "1" },
  ]);
  c("una foto senza Image Position va dopo quelle numerate (nell'ordine del file)", [`${CDN}/a.jpg`, `${CDN}/b.jpg`], (posVuota.foto?.get?.("pv") ?? []).map((f) => f.url));
}
