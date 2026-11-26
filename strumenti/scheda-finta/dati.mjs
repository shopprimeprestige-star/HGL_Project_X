/** ── SCHEDA FINTA · I DATI (33 bozze inventate) ──────────────────────────────────────────────────────────────
 *  Il catalogo di partenza del finto: lo stesso numero di prodotti di quello vero (33), TUTTI in bozza, così niente di quanto si prova
 *  può diventare visibile. Nomi, codici e descrizioni dicono «PROVA»; nessun cliente, nessuna foto, nessuna chiave.
 *  Si riparte da qui a ogni avvio: il finto sta in memoria, chiudere il processo cancella tutto quello che si è scritto.
 *  Le righe hanno la forma delle tabelle di S1 con la colonna `costo_cent` della migrazione dell'editor (presente e vuota). */
import { categoriaProva, tabelleProva, uuid, prodottoProva, varianteProva } from "../../prove/negozio/dati.mjs";

export const PERSONA = "PROVA Collaudo";
export const QUANTI = 33;
const TIPI = ["patch", "cura", "kit"];
const OPZIONI = [
  [["Rosso", "Nero"], ["S", "M"]],
  [["Biondo", "Castano", "Nero"]],
];

export function seme() {
  const base = tabelleProva();
  const prodotti = [];
  const varianti = [];
  for (let i = 1; i <= QUANTI; i++) {
    const n = String(i).padStart(2, "0");
    const id = uuid(0x1000 + i);
    prodotti.push(prodottoProva({
      id, sku: `PROVA-B${n}`, slug: `prova-bozza-${n}`, nome: `PROVA · Bozza ${n}`, tipo: TIPI[i % 3],
      stato: "bozza", pubblicato_il: null, prezzo_cent: i % 6 === 0 ? 0 : 1000 + i * 55,
      descrizione_breve: i % 4 === 0 ? null : `PROVA: descrizione inventata del prodotto ${n}.`, note_interne: "PROVA: nota interna inventata",
    }));
    // 4 prodotti su 5 senza opzioni (la sola variante «Unica»); gli altri con 2 o 3 opzioni
    const gruppi = i % 5 === 0 ? OPZIONI[i % 2] : null;
    if (!gruppi) {
      varianti.push(varianteProva({ id: uuid(0x2000 + i * 10), prodotto_id: id, sku: `PROVA-B${n}`, giacenza: i % 4, costo_cent: null }));
    } else {
      const nomi = gruppi.length === 1 ? gruppi[0].map((v) => [v]) : gruppi[0].flatMap((a) => gruppi[1].map((b) => [a, b]));
      nomi.forEach((valori, k) => varianti.push(varianteProva({
        id: uuid(0x2000 + i * 10 + k), prodotto_id: id, sku: `PROVA-B${n}-${k + 1}`, nome: valori.join(" / "), ordine: k + 1,
        opzioni: Object.fromEntries(valori.map((v, j) => [j === 0 ? "Colore" : "Misura", v])), giacenza: k, costo_cent: null,
      })));
    }
  }
  return {
    ...base,
    shop_categorie: [categoriaProva({ nome: "PROVA · Categoria", slug: "prova-categoria" })],
    shop_prodotti: prodotti,
    shop_prodotti_categorie: prodotti.slice(0, 5).map((p) => ({ prodotto_id: p.id, categoria_id: uuid(0x100) })),
    shop_varianti: varianti,
    shop_media: [],
  };
}
