/** ── I RIQUADRI DELLA SCHEDA: LE REGOLE SENZA SCHERMO (riquadri-puro.ts) ──────
 *  Commessa 2026-11-25-editor-prodotti, E5 (SPEC §3.3 e §3.4, PIANO §1.3). Niente React e niente rete: quali riquadri ha la scheda e in che
 *  ordine, quali si vedono (senza opzioni, con opzioni, Invisible Derm), quali partono chiusi in un prodotto nuovo, a quale riquadro porta
 *  ogni voce di «Prima di pubblicare» e il segno «a posto / da sistemare (n)» di ciascuno.
 *  Sta SOPRA `sezioneDi` e `statoSezione` di `scheda-pura.ts`: le 11 sezioni di oggi (`SEZIONI`) non cambiano, qui ci sono solo i 15 riquadri
 *  nuovi e la mappa dalle une agli altri. Si prova in `prove/negozio/riquadri-puro.mjs`. */
import type { Voce } from "@/shop/cms/pubblicazione";
import {
  sezioneDi,
  statoSezione,
  type ConteggioSezione,
  type SezioneId,
  type TonoSezione,
} from "./scheda-pura";
import type { Modalita } from "./semplice-puro";

/* ══ L'ELENCO ═══════════════════════════════════════════════════════════════ */

export const RIQUADRI = [
  // colonna principale (SPEC §3.3), dall'alto
  { id: "titolo", titolo: "Titolo e descrizione", colonna: "principale", richiudibile: false },
  { id: "foto", titolo: "Foto e video", colonna: "principale", richiudibile: false },
  { id: "prezzo", titolo: "Prezzo", colonna: "principale", richiudibile: false },
  { id: "giacenza", titolo: "Giacenza", colonna: "principale", richiudibile: false },
  { id: "spedizione", titolo: "Spedizione", colonna: "principale", richiudibile: false },
  { id: "varianti", titolo: "Varianti", colonna: "principale", richiudibile: false },
  {
    id: "seo",
    titolo: "Anteprima nei motori di ricerca (SEO)",
    colonna: "principale",
    richiudibile: false,
  },
  { id: "caratteristiche", titolo: "Caratteristiche", colonna: "principale", richiudibile: true },
  { id: "uso", titolo: "Come si usa e cosa c'è dentro", colonna: "principale", richiudibile: true },
  { id: "reso", titolo: "Reso, consulenza e consegna", colonna: "principale", richiudibile: true },
  // colonna laterale (SPEC §3.4); «Prima di pubblicare» è un pannello a sé
  { id: "stato", titolo: "Stato", colonna: "laterale", richiudibile: false },
  { id: "canali", titolo: "Dove si vede", colonna: "laterale", richiudibile: false },
  { id: "organizzazione", titolo: "Organizzazione", colonna: "laterale", richiudibile: false },
  { id: "cataloghi", titolo: "Dati per i cataloghi", colonna: "laterale", richiudibile: true },
  { id: "note", titolo: "Note", colonna: "laterale", richiudibile: false },
] as const;
export type RiquadroId = (typeof RIQUADRI)[number]["id"];

/* ══ COSA SI VEDE E COSA PARTE CHIUSO ═══════════════════════════════════════ */

/** Con le opzioni Prezzo, Giacenza e Spedizione stanno nella tabella delle varianti; per Invisible Derm il Prezzo non c'è (D39). */
export function riquadriVisibili(o: { modalita: Modalita; invisibleDerm: boolean }): RiquadroId[] {
  const spenti: RiquadroId[] = [];
  if (o.invisibleDerm) spenti.push("prezzo");
  if (o.modalita === "opzioni") spenti.push("prezzo", "giacenza", "spedizione");
  return RIQUADRI.map((r) => r.id).filter((id) => !spenti.includes(id));
}

/** In un prodotto nuovo i riquadri richiudibili partono chiusi (la prima schermata serve a creare un prodotto semplice); in uno salvato tutto è aperto. */
export function apertoDiPartenza(id: RiquadroId, o: { nuovo: boolean }): boolean {
  const r = RIQUADRI.find((x) => x.id === id);
  return !(o.nuovo && r?.richiudibile);
}

/* ══ A QUALE RIQUADRO PORTA UNA VOCE ════════════════════════════════════════ */

/** Le sezioni di oggi → il riquadro dove stanno i loro campi. */
const DA_SEZIONE: Record<SezioneId, RiquadroId> = {
  identita: "titolo",
  categorie: "organizzazione",
  descrizione: "titolo",
  caratteristiche: "caratteristiche",
  prezzo: "prezzo",
  varianti: "varianti",
  foto: "foto",
  uso: "uso",
  reso: "reso",
  canali: "canali",
  ricerca: "seo",
};

/** I campi che le sezioni di oggi non conoscono (E5) e quelli che oggi stanno in «Nome e indirizzo» ma ora hanno un altro posto. */
const DA_CAMPO: Record<string, RiquadroId> = {
  slug: "seo",
  tipo: "organizzazione",
  marca: "organizzazione",
  fornitore: "organizzazione",
  mpn: "cataloghi",
  categoriaGoogle: "cataloghi",
  noteInterne: "note",
  notaTitolare: "note",
  gtin: "giacenza",
  pesoG: "spedizione",
  classeSpedizione: "spedizione",
  spedizione: "spedizione",
  // «manca una variante attiva»: senza opzioni la variante è l'Unica, che si sistema in Giacenza
  varianti: "giacenza",
};

/** Con le opzioni i campi di Prezzo, Giacenza e Spedizione non hanno più il loro riquadro: si sistemano nella tabella delle varianti. */
const SENZA_OPZIONI: readonly RiquadroId[] = ["prezzo", "giacenza", "spedizione"];

/** A quale riquadro porta una voce. Un campo che non conosco porta in cima (Titolo). */
export function riquadroDi(
  voce: Voce,
  ctx: { nome: string; sku: string; modalita: Modalita },
): RiquadroId {
  const sezione = sezioneDi(voce, ctx);
  const riquadro = Object.hasOwn(DA_CAMPO, voce.campo)
    ? DA_CAMPO[voce.campo]
    : voce.campo === "sku" && sezione === "identita"
      ? "giacenza"
      : DA_SEZIONE[sezione];
  return ctx.modalita === "opzioni" && SENZA_OPZIONI.includes(riquadro) ? "varianti" : riquadro;
}

/* ══ I CONTEGGI E IL SEGNO ══════════════════════════════════════════════════ */

/** Quante voci da sistemare (bloccanti) e da controllare (informative) per ogni riquadro; tutti i riquadri ci sono, anche a zero. */
export function conteggiPerRiquadro(
  bloccanti: readonly Voce[],
  informativi: readonly Voce[],
  ctx: { nome: string; sku: string; modalita: Modalita },
): Record<RiquadroId, ConteggioSezione> {
  const conti = Object.fromEntries(
    RIQUADRI.map((r) => [r.id, { bloccanti: 0, informativi: 0 }]),
  ) as Record<RiquadroId, ConteggioSezione>;
  for (const v of bloccanti) conti[riquadroDi(v, ctx)].bloccanti++;
  for (const v of informativi) conti[riquadroDi(v, ctx)].informativi++;
  return conti;
}

/** «a posto» / «da controllare (n)» / «da sistemare (n)»: la stessa frase di oggi, sempre testo (mai solo il colore). */
export const segnoRiquadro = (c: ConteggioSezione): { tono: TonoSezione; testo: string } =>
  statoSezione(c);
