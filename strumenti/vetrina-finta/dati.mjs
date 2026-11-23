/** ── VETRINA FINTA · I DATI (T75) ──────────────────────────────────────────────
 *  Il catalogo INVENTATO che il finto Supabase (`server.mjs`) serve all'app: nomi, prezzi, foto e testi sono di prova
 *  (ogni nome dice «PROVA»), niente viene dal database vero né da foto vere.
 *
 *  Le righe hanno la forma delle viste `shop_v_*` di S1 (`supabase/migrations/20261120120000_shop_catalogo.sql`), quindi
 *  `costruisciPubblico`/`costruisciCategorie` le leggono come leggerebbero quelle vere (lo controlla la prova).
 *  Come la vista: una categoria senza prodotti pubblicati non c'è (`WHERE q.quanti > 0`).
 *
 *  Scenari: completo · vuoto · pochi · guasto · vecchio · stress.
 *   · guasto  = ogni richiesta al database risponde 503 (il database è giù);
 *   · vecchio = la migrazione S1 non è applicata: le tabelle `shop_*` non esistono (PGRST205), `landing_content` sì. */

/** L'unica chiave che il finto accetta e che il lanciatore mette nell'ambiente. Una chiave vera non vi somiglia. */
export const CHIAVE_FINTA = "chiave-finta-solo-per-prova-locale";

export const SCENARI = ["completo", "vuoto", "pochi", "guasto", "vecchio", "stress"];

const ORA = "2026-11-01T09:00:00+00:00";
const id = (tipo, n) => `${tipo}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Le colonne di ogni tabella che il finto conosce (una colonna fuori elenco dà 42703, come PostgREST). */
const COLONNE = {
  shop_v_prodotti: ["id", "sku", "slug", "nome", "tipo", "stato", "prezzo_cent", "marca", "riga_presentazione", "descrizione_breve", "descrizione_lunga", "per_chi", "caratteristiche", "contenuto", "categorie", "reso_consentito", "reso_giorni", "box_consulenza", "correlato_id", "gtin", "seo_titolo", "seo_descrizione", "seo_media_id", "aggiornato_il", "pubblicato_il"],
  shop_v_varianti: ["id", "prodotto_id", "sku", "nome", "opzioni", "prezzo_cent", "prezzo_effettivo_cent", "attiva", "disponibile", "gtin", "ordine"],
  shop_v_media: ["id", "prodotto_id", "categoria_id", "variante_id", "slot", "sotto_ruolo", "tipo", "path_480", "path_960", "path_1600", "path_video", "path_copertina", "durata_s", "alt", "testo_parlato", "sottotitoli_ok", "muto", "ritrae_persone", "liberatoria_ok", "valore_opzione", "ordine", "rimosso_il"],
  shop_v_categorie: ["id", "slug", "nome", "tipo", "frase", "foto_path", "seo_titolo", "seo_descrizione", "ordine", "visibile", "quanti"],
  shop_impostazioni: ["chiave", "valore"],
  shop_spedizioni_tariffe: ["paese", "nome", "corriere", "costo_cent", "gratis_da_cent", "giorni_min", "giorni_max", "attiva", "provvisoria", "confermata_il"],
  landing_content: ["id", "data", "updated_at", "updated_by"],
  funnel_settings: ["time_slots", "blocked_weekdays", "blocked_dates", "blocked_slots"],
  public_leads: ["data_slot", "ora_slot", "slot_released", "slot_pending"],
};

const CATEGORIE = [
  { n: 1, slug: "patch-prova", nome: "Patch di PROVA", frase: "Frase di prova per la categoria delle patch.", ordine: 1 },
  { n: 2, slug: "cura-prova", nome: "Cura di PROVA", frase: "Frase di prova per la categoria della cura.", ordine: 2 },
  { n: 3, slug: "collezione-vuota-prova", nome: "Collezione vuota di PROVA", frase: null, ordine: 3 }, // nessun prodotto: la vista la esclude
];

/* Un prodotto di prova: sku, slug, nome, tipo, prezzo in centesimi, categorie, opzioni (nome → valori), numero di foto. */
const PRODOTTI_COMPLETO = [
  { sku: "PR-PATCH-1", slug: "patch-prova-uno", nome: "Patch PROVA uno", tipo: "patch", prezzo: 12000, cat: ["patch-prova"], opzioni: { Colore: ["Nero", "Castano", "Biondo"], Lunghezza: ["10 cm", "15 cm"] }, foto: 5 },
  { sku: "PR-PATCH-2", slug: "patch-prova-due", nome: "Patch PROVA due", tipo: "patch", prezzo: 14500, cat: ["patch-prova"], opzioni: { Colore: ["Nero", "Grigio"] }, foto: 3 },
  { sku: "PR-PATCH-3", slug: "patch-prova-tre", nome: "Patch PROVA tre", tipo: "patch", prezzo: 9900, cat: ["patch-prova"], opzioni: {}, foto: 2 },
  { sku: "PR-PATCH-4", slug: "patch-prova-quattro", nome: "Patch PROVA quattro, con un nome volutamente molto lungo per vedere come va a capo nella scheda", tipo: "patch", prezzo: 18000, cat: ["patch-prova"], opzioni: { Misura: ["S", "M", "L"] }, foto: 1 },
  { sku: "PR-PATCH-5", slug: "patch-prova-cinque", nome: "Patch PROVA cinque", tipo: "patch", prezzo: 11000, cat: ["patch-prova"], opzioni: { Colore: ["Nero"] }, foto: 0 }, // senza foto
  { sku: "PR-CURA-1", slug: "cura-prova-uno", nome: "Shampoo PROVA", tipo: "cura", prezzo: 1900, cat: ["cura-prova"], opzioni: {}, foto: 2 },
  { sku: "PR-CURA-2", slug: "cura-prova-due", nome: "Colla PROVA", tipo: "cura", prezzo: 2400, cat: ["cura-prova"], opzioni: {}, foto: 2, esaurito: true },
  { sku: "PR-KIT-1", slug: "kit-prova", nome: "Kit PROVA", tipo: "kit", prezzo: 15900, cat: ["patch-prova", "cura-prova"], opzioni: {}, foto: 3, correlato: "PR-CURA-1" },
  // Invisible Derm: senza prezzo (D39); il nome lo fa riconoscere al codice
  { sku: "PR-ID-1", slug: "invisible-derm-prova", nome: "Invisible Derm PROVA", tipo: "patch", prezzo: 30000, cat: ["patch-prova"], opzioni: { Misura: ["S", "M"] }, foto: 3 },
];

const prodottoAttesa = (n, p) => ({
  id: id("1", n), sku: p.sku, slug: p.slug, nome: p.nome, tipo: p.tipo, stato: "pubblicato", prezzo_cent: p.prezzo,
  marca: "Marca di PROVA", riga_presentazione: "Riga di presentazione di prova",
  descrizione_breve: "Descrizione breve di prova: testo inventato, serve solo a riempire la pagina.",
  descrizione_lunga: "Descrizione lunga di prova.\nSecondo paragrafo di prova, scritto per vedere come va a capo il testo.",
  per_chi: "Per chi guarda la pagina di prova.",
  caratteristiche: [{ etichetta: "Materiale", valore: "Di prova", stato: "confermato", fonte: null }, { etichetta: "Peso", valore: "1 g di prova", stato: "confermato", fonte: null }],
  contenuto: { passi: ["Primo passo di prova", "Secondo passo di prova"], confezione: ["Una confezione di prova"], avvertenze: ["Avvertenza di prova"], faq: [{ d: "Domanda di prova?", r: "Risposta di prova." }] },
  categorie: CATEGORIE.filter((c) => p.cat.includes(c.slug)).sort((a, b) => a.ordine - b.ordine).map((c) => ({ slug: c.slug, nome: c.nome })),
  reso_consentito: true, reso_giorni: 14, box_consulenza: p.tipo === "patch", correlato_id: null, gtin: null,
  seo_titolo: null, seo_descrizione: null, seo_media_id: null, aggiornato_il: ORA, pubblicato_il: ORA,
});

const SLOT_FOTO = ["principale", "foto2", "foto3", "foto4", "foto5"];
const percorsi = (cartella, slot) => ({ path_480: `${cartella}/${slot}-480.svg`, path_960: `${cartella}/${slot}-960.svg`, path_1600: `${cartella}/${slot}-1600.svg` });
const riga = (colonne, valori) => Object.fromEntries(colonne.map((c) => [c, valori[c] ?? null]));

/** Combinazioni di tutte le opzioni: `{Colore:[a,b], Misura:[x]}` → `[{Colore:a,Misura:x},{Colore:b,Misura:x}]`. Senza opzioni, una variante sola. */
function combinazioni(opzioni) {
  return Object.entries(opzioni).reduce((acc, [nome, valori]) => acc.flatMap((o) => valori.map((v) => ({ ...o, [nome]: v }))), [{}]);
}

function costruisciCatalogo(specifiche) {
  const prodotti = [], varianti = [], media = [];
  specifiche.forEach((p, i) => {
    const n = i + 1;
    const pr = prodottoAttesa(n, p);
    const altro = p.correlato ? specifiche.findIndex((x) => x.sku === p.correlato) : -1;
    if (altro >= 0) pr.correlato_id = id("1", altro + 1);
    prodotti.push(riga(COLONNE.shop_v_prodotti, pr));
    combinazioni(p.opzioni).forEach((o, k, tutte) => {
      const nome = Object.values(o).join(" / ") || p.nome;
      varianti.push(riga(COLONNE.shop_v_varianti, {
        id: id("2", n * 100 + k), prodotto_id: pr.id, sku: `${p.sku}-${k + 1}`, nome, opzioni: o,
        // la prima variante ha un prezzo suo, le altre quello del prodotto; l'ultima di «esaurito» e di ogni quinto prodotto non c'è più
        prezzo_cent: k === 0 && tutte.length > 1 ? p.prezzo + 500 : null, prezzo_effettivo_cent: k === 0 && tutte.length > 1 ? p.prezzo + 500 : p.prezzo,
        attiva: true, disponibile: !(p.esaurito || (n % 5 === 0 && k === tutte.length - 1)), gtin: null, ordine: k,
      }));
    });
    for (let f = 0; f < p.foto; f++) {
      media.push(riga(COLONNE.shop_v_media, {
        id: id("3", n * 100 + f), prodotto_id: pr.id, slot: SLOT_FOTO[f], tipo: "foto", ...percorsi(`prodotti/${p.sku}`, SLOT_FOTO[f]),
        alt: `Foto di prova ${f + 1} di ${p.nome}`, sottotitoli_ok: false, muto: false, ritrae_persone: false, liberatoria_ok: false, ordine: f, rimosso_il: null,
      }));
    }
    if (p.foto >= 2) { // la foto di scala sulla mano di prova, e una pallina di colore per il primo colore
      media.push(riga(COLONNE.shop_v_media, {
        id: id("3", n * 100 + 90), prodotto_id: pr.id, slot: "scala", tipo: "foto", ...percorsi(`prodotti/${p.sku}`, "scala"),
        alt: `Foto di scala di prova di ${p.nome}`, sottotitoli_ok: false, muto: false, ritrae_persone: false, liberatoria_ok: false, ordine: 0, rimosso_il: null,
      }));
    }
    for (const [k, v] of (p.opzioni.Colore ?? []).entries()) {
      media.push(riga(COLONNE.shop_v_media, {
        id: id("3", n * 100 + 50 + k), prodotto_id: pr.id, slot: "campione", tipo: "foto", path_480: `prodotti/${p.sku}/campione-${k}-480.svg`,
        alt: `Campione ${v}`, ritrae_persone: false, liberatoria_ok: false, valore_opzione: v, ordine: k, rimosso_il: null,
      }));
    }
  });
  // le categorie come la vista: visibili e con almeno un prodotto pubblicato
  const categorie = CATEGORIE
    .map((c) => ({ c, quanti: prodotti.filter((p) => p.categorie.some((x) => x.slug === c.slug)).length }))
    .filter(({ quanti }) => quanti > 0)
    .map(({ c, quanti }) => riga(COLONNE.shop_v_categorie, {
      id: id("4", c.n), slug: c.slug, nome: c.nome, tipo: "categoria", frase: c.frase, ordine: c.ordine, visibile: true, quanti,
    }));
  for (const c of categorie) {
    const cat = CATEGORIE.find((x) => x.slug === c.slug);
    media.push(riga(COLONNE.shop_v_media, {
      id: id("3", 9000 + cat.n), categoria_id: c.id, slot: "principale", tipo: "foto", ...percorsi(`categorie/${c.slug}`, "principale"),
      alt: `Foto di prova della categoria ${c.nome}`, ritrae_persone: false, liberatoria_ok: false, ordine: 0, rimosso_il: null,
    }));
  }
  return { shop_v_prodotti: prodotti, shop_v_varianti: varianti, shop_v_media: media, shop_v_categorie: categorie };
}

/** 50 prodotti; il primo ha 50 varianti (5 colori × 10 lunghezze, il massimo che il CMS ammette). */
function prodottiStress() {
  return Array.from({ length: 50 }, (_, i) => ({
    sku: `PR-STRESS-${i + 1}`, slug: `stress-prova-${i + 1}`, nome: `Prodotto PROVA ${i + 1}`, tipo: i % 4 === 3 ? "cura" : "patch",
    prezzo: 5000 + i * 250, cat: [i % 4 === 3 ? "cura-prova" : "patch-prova"],
    opzioni: i === 0 ? { Colore: ["Nero", "Castano", "Biondo", "Grigio", "Rosso"], Lunghezza: Array.from({ length: 10 }, (_, k) => `${10 + k * 2} cm`) } : {},
    foto: i === 0 ? 5 : 1 + (i % 3),
  }));
}

const TARIFFA = { paese: "IT", nome: "Italia di prova", corriere: "Corriere di PROVA", costo_cent: 590, gratis_da_cent: null, giorni_min: 2, giorni_max: 4, attiva: true, provvisoria: false, confermata_il: "2026-01-01T00:00:00+00:00" };
const IMPOSTAZIONI = [{ chiave: "catalogo_sito", valore: "cms" }, { chiave: "cassa_sito", valore: "vecchia" }];
const LANDING = [{ id: "default", data: { texts: { "hero.eyebrow1": "Testo di PROVA per la landing" }, media: {} }, updated_at: ORA, updated_by: null }];

/** Le tabelle di uno scenario: `{ nome: { colonne, righe } }`, e come risponde il database (`modo`). */
export function datiScenario(nome) {
  if (!SCENARI.includes(nome)) throw new Error(`scenario sconosciuto: ${nome} (ammessi: ${SCENARI.join(", ")})`);
  const modo = nome === "guasto" ? "guasto" : nome === "vecchio" ? "vecchio" : "normale";
  const specifiche =
    nome === "stress" ? prodottiStress()
    : nome === "vuoto" ? []
    : nome === "pochi" ? [{ ...PRODOTTI_COMPLETO[0], opzioni: {}, foto: 1 }, { ...PRODOTTI_COMPLETO[5], foto: 0 }]
    : PRODOTTI_COMPLETO;
  const catalogo = costruisciCatalogo(specifiche);
  const righe = {
    ...catalogo,
    shop_impostazioni: IMPOSTAZIONI,
    // «pochi»: tariffa ancora provvisoria; «vuoto»: nessuna tariffa
    shop_spedizioni_tariffe: nome === "vuoto" ? [] : nome === "pochi" ? [{ ...TARIFFA, provvisoria: true, confermata_il: null }] : [TARIFFA],
    landing_content: nome === "vuoto" ? [] : LANDING,
    funnel_settings: [],
    public_leads: [],
  };
  const tabelle = Object.fromEntries(Object.entries(COLONNE).map(([t, colonne]) => [t, { colonne, righe: righe[t] ?? [] }]));
  return { nome, modo, tabelle };
}

/** Le tabelle che nel database vecchio (senza S1) non esistono. */
export const TABELLE_S1 = ["shop_v_prodotti", "shop_v_varianti", "shop_v_media", "shop_v_categorie", "shop_impostazioni", "shop_spedizioni_tariffe"];

/* ── le foto di prova ─────────────────────────────────────────────────────── */
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);

/** Il percorso `cartella/nome-<larghezza>.svg` → un quadrato con la scritta «PROVA» (mai una foto vera). `null` se il percorso non ha quella forma. */
export function svgProva(percorso) {
  const m = /^([A-Za-z0-9._\-/]{1,120})-(\d{2,4})\.svg$/.exec(percorso);
  if (!m) return null;
  if (m[1].split("/").some((parte) => !parte || /^\.+$/.test(parte))) return null;
  const lato = Number(m[2]);
  if (lato < 16 || lato > 2400) return null;
  const etichetta = m[1].split("/").slice(-2).join(" · ");
  let h = 0;
  for (const ch of m[1]) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lato}" height="${lato}" viewBox="0 0 100 100" role="img" aria-label="Immagine di prova">` +
    `<rect width="100" height="100" fill="hsl(${h} 25% 82%)"/>` +
    `<text x="50" y="54" font-family="sans-serif" font-size="18" font-weight="700" text-anchor="middle" fill="hsl(${h} 30% 28%)">PROVA</text>` +
    `<text x="50" y="68" font-family="sans-serif" font-size="5" text-anchor="middle" fill="hsl(${h} 30% 28%)">${esc(etichetta)}</text></svg>`;
}
