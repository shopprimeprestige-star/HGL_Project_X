/** ── «PRIMA DI PUBBLICARE»: LE REGOLE ───────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T06). Modulo PURO: nessun database, nessuna rete.
 *
 *  `controllaPubblicazione` è LA STESSA funzione per il pannello «Prima di pubblicare» (Design §4.10.2, in tempo
 *  reale mentre si scrive) e per il server (che rifiuta «Pubblica» con le stesse frasi): una regola sola, due usi.
 *   · BLOCCANTI: il prodotto non si pubblica finché ce n'è uno.
 *   · INFORMATIVI: si pubblica, ma il titolare deve saperlo.
 *  Ogni voce ha un `campo` (a cui il pannello porta con un clic) e una `frase` per il titolare. */
import { TETTI, skuValido, prezzoEffettivo, type Prodotto, type Variante, type Media } from "./modello";
import { controllaTesto } from "./testi";

export interface Voce {
  campo: string;
  frase: string;
}
export interface EsitoPubblicazione {
  bloccanti: Voce[];
  informativi: Voce[];
}
export interface SkuUsato {
  sku: string;
  prodottoId: string;
}
export interface ContestoPubblicazione {
  /** C'è una riga di spedizione (costo e tempi) per il negozio? `null` = non ancora valutabile (R1): non blocca; il R2 la fa valere. */
  spedizioneImpostata: boolean | null;
  /** Tutti gli SKU in uso, di prodotti E di varianti, col prodotto a cui appartengono (compresi quelli di questo prodotto). */
  tuttiGliSku: readonly SkuUsato[];
  /** Id dei media che chi ha caricato il file sa non essere quadrati (nella scheda si ritagliano). */
  mediaNonQuadrati?: readonly string[];
}

type ProdottoIn = Pick<
  Prodotto,
  | "id" | "sku" | "nome" | "prezzoCent" | "rigaPresentazione" | "descrizioneBreve" | "descrizioneLunga" | "perChi"
  | "caratteristiche" | "passi" | "confezione" | "avvertenze" | "faq" | "canali" | "seoTitolo" | "seoDescrizione"
>;
type VarianteIn = Pick<Variante, "sku" | "nome" | "prezzoCent" | "attiva">;
type MediaIn = Pick<Media, "id" | "slot" | "tipo" | "alt" | "muto" | "sottotitoliOk" | "ritraePersone" | "liberatoriaOk" | "rimossoIl" | "pathCopertina">;

/** Lo SKU è libero se nessun altro prodotto (o sue varianti) lo usa; `escludi` è l'id del prodotto che lo sta scrivendo. */
export const skuLibero = (sku: string, tuttiGliSku: readonly SkuUsato[], escludi?: string | null): boolean =>
  !tuttiGliSku.some((u) => u.sku === sku && u.prodottoId !== escludi);

const pieno = (t: unknown) => typeof t === "string" && t.trim() !== "";

export function controllaPubblicazione(
  prodotto: ProdottoIn,
  varianti: readonly VarianteIn[] | null | undefined,
  media: readonly MediaIn[] | null | undefined,
  categorie: readonly unknown[] | null | undefined,
  contesto: ContestoPubblicazione,
): EsitoPubblicazione {
  const bloccanti: Voce[] = [];
  const informativi: Voce[] = [];
  const b = (campo: string, frase: string) => bloccanti.push({ campo, frase });
  const i = (campo: string, frase: string) => informativi.push({ campo, frase });

  const vs = varianti ?? [];
  const attive = vs.filter((v) => v.attiva);
  const vivi = (media ?? []).filter((m) => !m.rimossoIl);
  const foto = vivi.filter((m) => m.tipo === "foto");

  // Foto: la principale (come nel trigger di S1: se ritrae persone serve la liberatoria, altrimenti non esce e non vale),
  // e il testo alternativo di ognuna (per chi non vede).
  if (!foto.some((m) => m.slot === "principale" && (!m.ritraePersone || m.liberatoriaOk))) b("fotoPrincipale", "Manca la foto principale: il prodotto resta in bozza.");
  const senzaAlt = foto.filter((m) => !pieno(m.alt)).length;
  if (senzaAlt > 0) b("alt", `Manca il testo alternativo di ${senzaAlt} foto.`);

  // Varianti e prezzo: il prezzo che conta è quello effettivo (variante, o prodotto se la variante non ne ha).
  if (attive.length === 0) b("varianti", "Serve almeno una variante attiva.");
  const senzaPrezzo = attive.filter((v) => {
    const p = prezzoEffettivo(prodotto, v);
    return !Number.isInteger(p) || p <= 0;
  });
  if (senzaPrezzo.length > 0) b("prezzo", `Il prezzo deve essere maggiore di zero. Da sistemare: ${senzaPrezzo.map((v) => v.nome).join(", ")}.`);

  // SKU: unico fra prodotti e varianti insieme. Il prodotto e la sua variante possono avere lo stesso (le 33 migrate).
  const sku = (nome: string, valore: string) => {
    if (!pieno(valore)) return b("sku", `Manca lo SKU di “${nome}”.`);
    if (!skuValido(valore)) return b("sku", `Lo SKU “${valore}” non è valido: maiuscolo, senza spazi (per esempio HG-T01).`);
    if (!skuLibero(valore, contesto.tuttiGliSku, prodotto.id)) b("sku", `Lo SKU “${valore}” è già usato da un altro prodotto.`);
  };
  sku(prodotto.nome, prodotto.sku);
  vs.forEach((v) => sku(v.nome, v.sku));
  const doppi = vs.map((v) => v.sku).filter((s, k, tutti) => pieno(s) && tutti.indexOf(s) !== k);
  if (doppi.length > 0) b("sku", `Lo SKU “${doppi[0]}” è scritto su due varianti: ogni variante ha il suo.`);

  if (!categorie || categorie.length === 0) b("categoria", "Scegli almeno una categoria.");
  if (!pieno(prodotto.descrizioneBreve)) b("descrizioneBreve", "Manca la descrizione breve.");

  // Un video con il parlato ha i sottotitoli impressi (si guarda anche senza audio).
  for (const m of vivi)
    if (m.tipo === "video" && !m.muto && !m.sottotitoliOk)
      b("video", "Un video con il parlato ha bisogno dei sottotitoli: mettili nel video e spunta «Ho messo i sottotitoli nel video».");

  if (!prodotto.canali || !Object.values(prodotto.canali).some(Boolean)) b("canali", "Accendi almeno un canale (sito, Meta, Google o TikTok).");
  if (contesto.spedizioneImpostata === false) b("spedizione", "Manca una riga di spedizione (costo e tempi) impostata per il negozio.");

  // Testi: le cifre vicino a «Invisible Derm» e gli sconti non si pubblicano; le parole da non usare si segnalano.
  const testi: [string, unknown][] = [
    ["nome", prodotto.nome], ["rigaPresentazione", prodotto.rigaPresentazione], ["descrizioneBreve", prodotto.descrizioneBreve],
    ["descrizioneLunga", prodotto.descrizioneLunga], ["perChi", prodotto.perChi],
    ["passi", (prodotto.passi ?? []).join("\n")], ["confezione", (prodotto.confezione ?? []).join("\n")],
    ["avvertenze", (prodotto.avvertenze ?? []).join("\n")],
    ["faq", (prodotto.faq ?? []).map((f) => `${f.d}\n${f.r}`).join("\n")],
    ["seoTitolo", prodotto.seoTitolo], ["seoDescrizione", prodotto.seoDescrizione],
  ];
  for (const [campo, testo] of testi) {
    const esito = controllaTesto(testo);
    for (const x of esito.bloccanti) b(campo, x.frase);
    for (const frase of new Set(esito.avvisi.map((a) => a.frase))) i(campo, frase);
  }

  // Da sapere (non blocca).
  for (const r of prodotto.caratteristiche ?? [])
    if (r.stato === "da_confermare") i("caratteristiche", `La riga “${r.etichetta}” è da confermare: resta nascosta nella scheda.`);
  if ((prodotto.seoTitolo?.length ?? 0) > TETTI.seoTitolo) i("seoTitolo", `Il titolo SEO è lungo ${prodotto.seoTitolo!.length} segni: oltre ${TETTI.seoTitolo} i motori di ricerca lo tagliano.`);
  if ((prodotto.seoDescrizione?.length ?? 0) > TETTI.seoDescrizione)
    i("seoDescrizione", `La descrizione SEO è lunga ${prodotto.seoDescrizione!.length} segni: oltre ${TETTI.seoDescrizione} i motori di ricerca la tagliano.`);
  const nonQuadrate = foto.filter((m) => contesto.mediaNonQuadrati?.includes(m.id)).length;
  if (nonQuadrate > 0) i("media", nonQuadrate === 1 ? "Una foto non è quadrata: nella scheda viene ritagliata." : `${nonQuadrate} foto non sono quadrate: nella scheda vengono ritagliate.`);
  const senzaCopertina = vivi.filter((m) => m.tipo === "video" && !pieno(m.pathCopertina)).length;
  if (senzaCopertina > 0) i("video", senzaCopertina === 1 ? "Manca la copertina del video." : `Mancano le copertine di ${senzaCopertina} video.`);
  const senzaLiberatoria = vivi.filter((m) => m.ritraePersone && !m.liberatoriaOk).length;
  if (senzaLiberatoria > 0)
    i("media", senzaLiberatoria === 1 ? "Una foto ritrae persone e manca la liberatoria: non esce nella scheda." : `${senzaLiberatoria} foto ritraggono persone e manca la liberatoria: non escono nella scheda.`);

  return { bloccanti, informativi };
}
