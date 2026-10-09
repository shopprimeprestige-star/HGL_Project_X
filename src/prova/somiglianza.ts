/** ── QUALE TAGLIO VERO ASSOMIGLIA A QUELLO CHE HAI COMPOSTO ────────────────
 *
 *  ⚠️ IL DIFETTO CHE QUESTO FILE RISOLVE: i tagli composti uscivano come
 *   parrucche. Non è colpa del modello, è la differenza fra i due materiali.
 *   Un taglio del catalogo arriva al modello con la sua FOTOGRAFIA vera
 *   accanto — «fai così» — e infatti viene bene. Un taglio composto arriva
 *   solo a parole, e le parole dicono le misure ma non dicono come stanno i
 *   capelli su una testa: quanto volume hanno davvero, quanto si vede il
 *   cranio sotto, come si sfilacciano i bordi. Il modello riempie quei vuoti
 *   con l'idea media di «capelli», che è una parrucca.
 *
 *  Qui si cerca, fra i tagli veri del catalogo, quello che somiglia di più a
 *  quello composto — e la sua fotografia si allega come ESEMPIO DI REALISMO.
 *  Non è il taglio da copiare: quello resta scritto a parole, e le parole
 *  vincono. È un campione di come sono fatti i capelli veri.
 *
 *  ⚠️ Le caratteristiche si LEGGONO dalle schede, non si scrivono a mano: le
 *   schede nascono da fotografie lette una per una, e riscriverle qui vorrebbe
 *   dire tenere allineati a mano due elenchi — cioè non tenerli allineati.
 */
import type { Composto } from "./composto";
import { TAGLI } from "./tagli";

export interface Caratteristiche {
  /** corto, medio, lungo: la stessa scala del taglio composto */
  lunghezza: string;
  /** liscio, mosso, riccio */
  texture: string;
  /** avanti, indietro, lato, alzato, naturale */
  direzione: string;
  /** il ciuffo c'è o non c'è */
  ciuffo: boolean;
  /** i lati sono sfumati, rasati o accorciati a macchinetta */
  sfumatura: boolean;
}

/** ⚠️ I centimetri vincono sulle parole: «medium-length top around 10cm» e
 *  «medium taper» sono la stessa parola per due cose diverse, e contando le
 *  parole un taglio con i lati sfumati passava per un taglio medio. */
export function caratteristicheDi(inglese: string): Caratteristiche {
  const s = String(inglese || "").toLowerCase();
  const cm = s.match(/(\d+)\s*cm/);
  const misura = cm ? Number(cm[1]) : 0;
  const lunghezza = misura
    ? (misura <= 5 ? "corto" : misura <= 10 ? "medio" : "lungo")
    : /\blong\b|shoulder/.test(s)
      ? "lungo"
      : /\bmedium[- ]length\b/.test(s)
        ? "medio"
        : "corto";
  return {
    lunghezza,
    texture: /curl|coil|afro/.test(s) ? "riccio" : /wav/.test(s) ? "mosso" : "liscio",
    direzione: /forward/.test(s)
      ? "avanti"
      : /backward|styled back|swept back|slicked back/.test(s)
        ? "indietro"
        : /to the side|side part|side-part|swept to one side|to one side/.test(s)
          ? "lato"
          : /upward|upwards/.test(s)
            ? "alzato"
            : "naturale",
    //  ⚠️ «no defined parting or fringe» contiene la parola «fringe»: cercarla
    //   e basta faceva risultare un ciuffo proprio dove la scheda dice che non
    //   c'è. La negazione si guarda per prima.
    ciuffo: /fringe/.test(s) && !/no (defined )?(parting or )?fringe|without a fringe/.test(s),
    sfumatura: /fade|faded|taper|tapered|undercut|shaved|buzz/.test(s),
  };
}

/** ── QUANTO SI SOMIGLIANO ──────────────────────────────────────────────────
 *  I pesi non sono a caso: la TEXTURE e la LUNGHEZZA sono quello che si vede
 *  da lontano e che rende credibile la fotografia come esempio; la direzione e
 *  il ciuffo si possono correggere a parole senza che la fotografia disturbi.
 */
const SCALA = ["corto", "medio", "lungo"];

export function somiglianza(c: Composto, k: Caratteristiche): number {
  let punti = 0;
  /** ── ⚠️ LA LUNGHEZZA NON È UN PUNTO COME GLI ALTRI ──────────────────────
   *  DIFETTO VISTO PROVANDO: a «corto, liscio, all'indietro» veniva allegata
   *  la fotografia di una chioma LUNGA pettinata indietro — perché texture e
   *  direzione insieme pesavano più della lunghezza. Una fotografia sbagliata
   *  accanto al testo è peggio di nessuna fotografia: il modello guarda
   *  quella, e la lunghezza è la prima cosa che si vede. Qui una lunghezza
   *  vicina vale poco e una lontana COSTA: meglio un esempio con la texture
   *  sbagliata ma della lunghezza giusta. */
  const suo = SCALA.indexOf(String(c.lunghezza || "").replace("molto_lungo", "lungo"));
  const altro = SCALA.indexOf(k.lunghezza);
  if (suo >= 0 && altro >= 0) punti += 6 - 4 * Math.abs(suo - altro);
  //  Riccio e riccio stretto sono lo stesso materiale per una fotografia.
  const texture = String(c.texture || "").replace("riccio_stretto", "riccio");
  if (texture === k.texture) punti += 3;
  /** ⚠️ «Naturale» non è una direzione: è quello che resta quando la scheda
   *  non ne nomina nessuna. Contarlo come somiglianza faceva vincere un taglio
   *  di media lunghezza su uno della lunghezza giusta — per un dato che in
   *  realtà mancava. */
  if (c.direzione && c.direzione !== "naturale" && c.direzione === k.direzione) punti += 2;
  if (typeof c.ciuffo === "string" && (c.ciuffo !== "senza") === k.ciuffo) punti += 1;
  //  I laterali contano solo se sono stati scelti: chi non li ha scelti non
  //  deve ricevere un esempio rasato per caso.
  if (c.laterali && c.laterali !== "come_il_taglio") {
    const vuoleSfumatura = c.laterali.startsWith("sfumatura") || c.laterali === "corti_uniformi"
      || c.laterali === "undercut";
    if (vuoleSfumatura === k.sfumatura) punti += 1;
  }
  return punti;
}

/** La chiave del taglio vero più vicino, o vuoto se il composto non basta.
 *  ⚠️ A parità vince il primo del catalogo: una scelta stabile vale più di una
 *   scelta astuta — la stessa composizione deve dare sempre lo stesso esempio,
 *   se no due prove uguali escono diverse e non si capisce perché. */
export function taglioPiuVicino(c: Composto | null | undefined): string {
  if (!c?.lunghezza || !c?.texture) return "";
  let miglior = "";
  let massimo = -1;
  for (const t of TAGLI) {
    const p = somiglianza(c, caratteristicheDi(t.inglese));
    if (p > massimo) {
      massimo = p;
      miglior = t.chiave;
    }
  }
  //  ⚠️ Sotto la metà dei punti forti non è un esempio, è un taglio a caso: e
  //   una fotografia sbagliata accanto al testo è peggio di nessuna
  //   fotografia, perché il modello guarda quella.
  return massimo >= 3 ? miglior : "";
}
