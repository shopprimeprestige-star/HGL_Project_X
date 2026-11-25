/** ── DATI INVENTATI PER LE PROVE DEL NEGOZIO ───────────────────────────────
 *  ⚠️ Nomi e codici di fantasia (`PROVA-…`), foto con percorsi finti, nessun cliente.
 *   Mai nomi, telefoni, email o indirizzi veri, in nessuna prova di questa cartella.
 *  Le righe hanno la forma delle tabelle di S1 (colonne in italiano, snake_case):
 *  è quello che risponde il database, e che il finto `_finto-db.mjs` restituisce. */

export const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
export const ISTANTE = "2026-11-20T10:00:00.000Z";

/** Una categoria visibile. */
export const categoriaProva = (extra = {}) => ({
  id: uuid(0x100), slug: "categoria-prova", nome: "Categoria di prova", tipo: "categoria", frase: null,
  foto_path: null, seo_titolo: null, seo_descrizione: null, ordine: 1, visibile: true,
  creato_il: ISTANTE, aggiornato_il: ISTANTE, pubblicata_il: null,
  ...extra,
});

/** Un prodotto PUBBLICATO e completo (nome, descrizione, prezzo 28,90 €). */
export const prodottoProva = (extra = {}) => ({
  id: uuid(0x200), sku: "PROVA-001", slug: "prodotto-di-prova", nome: "Prodotto di prova", tipo: "cura",
  stato: "pubblicato", origine: null, prezzo_cent: 2890, marca: "Marca Finta", riga_presentazione: null,
  descrizione_breve: "Una descrizione breve inventata.", descrizione_lunga: null, per_chi: null,
  caratteristiche: [{ etichetta: "Formato", valore: "100 ml", stato: "confermato", fonte: "prova" }],
  contenuto: { passi: [], confezione: [], avvertenze: [], faq: [] },
  reso_consentito: null, reso_giorni: null, box_consulenza: false, correlato_id: null,
  canali: { sito: true, meta: false, google: false, tiktok: false },
  gtin: null, mpn: null, categoria_google: null, peso_g: null, classe_spedizione: null,
  fornitore: "Fornitore Finto", scheda_tecnica_path: null, note_interne: "nota interna inventata", nota_titolare: null,
  seo_titolo: null, seo_descrizione: null, seo_media_id: null,
  bozza_modifiche: null, bozza_modificata_il: null, id_codice: null,
  creato_il: ISTANTE, aggiornato_il: ISTANTE, pubblicato_il: ISTANTE,
  ...extra,
});

/** Una variante attiva con 5 pezzi; `prezzo_cent: null` = vale il prezzo del prodotto.
 *  `costo_cent` (migrazione 20261125, editor prodotti): senza, la riga è come quelle di prima della migrazione (colonna assente = nessun costo);
 *  `varianteProva({ costo_cent: 450 })` ha il costo di 4,50 € e `costo_cent: null` è «colonna presente, costo non scritto». */
export const varianteProva = (extra = {}) => ({
  id: uuid(0x300), prodotto_id: uuid(0x200), sku: "PROVA-001-A", nome: "Unica", opzioni: {},
  prezzo_cent: null, giacenza: 5, peso_g: null, attiva: true, gtin: null, ordine: 1,
  creato_il: ISTANTE, aggiornato_il: ISTANTE,
  ...extra,
});

/** Una foto principale quadrata, con testo alternativo. */
export const mediaProva = (extra = {}) => ({
  id: uuid(0x400), prodotto_id: uuid(0x200), categoria_id: null, variante_id: null, slot: "principale",
  sotto_ruolo: null, tipo: "foto", path_480: "prova/aaaaaaaaaaaa-480.webp", path_960: "prova/aaaaaaaaaaaa-960.webp",
  path_1600: "prova/aaaaaaaaaaaa-1600.webp", path_video: null, path_copertina: null, durata_s: null,
  alt: "Foto di prova del prodotto", testo_parlato: null, sottotitoli_ok: false, muto: false,
  ritrae_persone: false, liberatoria_ok: false, valore_opzione: null, ordine: 1, rimosso_il: null, creato_il: ISTANTE,
  ...extra,
});

/** Le tabelle di S1 già applicata, con un negozio piccolo: una categoria, un prodotto pubblicato con
 *  una variante e una foto, un prodotto in bozza con una variante. Gli interruttori sono quelli del seme. */
export const tabelleProva = () => ({
  shop_impostazioni: [
    { chiave: "catalogo_sito", valore: "codice", aggiornato_il: ISTANTE, aggiornato_da: null },
    { chiave: "giacenza_bassa", valore: 3, aggiornato_il: ISTANTE, aggiornato_da: null },
  ],
  shop_categorie: [categoriaProva()],
  shop_prodotti: [
    prodottoProva(),
    prodottoProva({ id: uuid(0x201), sku: "PROVA-002", slug: "prodotto-in-bozza", nome: "Prodotto in bozza", stato: "bozza", pubblicato_il: null }),
  ],
  shop_prodotti_categorie: [{ prodotto_id: uuid(0x200), categoria_id: uuid(0x100) }],
  shop_varianti: [
    varianteProva(),
    varianteProva({ id: uuid(0x301), prodotto_id: uuid(0x201), sku: "PROVA-002-A", giacenza: 0 }),
  ],
  shop_media: [mediaProva()],
  shop_giacenza_movimenti: [],
  shop_storico: [],
});
