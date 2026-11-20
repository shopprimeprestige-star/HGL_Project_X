/** ── I TESTI DELLO SHOP: COSA NON SI SCRIVE, COSA SI SCONSIGLIA ────────────
 *  Commessa 2026-11-20-shop-completo (T06). Modulo PURO.
 *
 *  Il CMS è costruito perché certe cose non possano nemmeno essere scritte (SPEC §4 n. 10):
 *   · BLOCCANTI: una cifra o un «€» vicino a «Invisible Derm» (il costo si vede in consulenza, mai in vetrina),
 *     «sconto del», «risparmi», «prezzo barrato» (nessuno sconto senza un prezzo precedente vero);
 *   · AVVISI: le parole da non usare del Copywriter (§3.5.1): promesse che non si possono provare.
 *  Le parole si riconoscono per parola intera, senza badare alle maiuscole, anche al femminile e al plurale. */

export interface BloccoTesto {
  motivo: "cifra_invisible_derm" | "sconto" | "risparmi" | "prezzo_barrato";
  frase: string;
}
export interface AvvisoTesto {
  /** La parola come è scritta nel testo. */
  parola: string;
  frase: string;
  /** Dove sta nel testo (per sottolinearla): da incluso, a escluso. */
  da: number;
  a: number;
}

/** Le parole da non usare, con la forma con cui si cercano (le lettere finali variano: «garantita», «invisibili»). */
const ELENCO: readonly { parola: string; modello: string }[] = [
  { parola: "invisibile", modello: "invisibil[ei]" },
  { parola: "garantito", modello: "garantit[aeio]" },
  { parola: "premium", modello: "premium" },
  { parola: "cura la calvizie", modello: "cura\\s+la\\s+calvizie" },
  { parola: "ricrescita", modello: "ricrescit[ae]" },
  { parola: "riduce la caduta", modello: "riduce\\s+la\\s+caduta" },
  { parola: "definitivo", modello: "definitiv[aeio]" },
  { parola: "Remy", modello: "remy" },
  { parola: "europei", modello: "europe[aeio]" },
  { parola: "indistinguibile", modello: "indistinguibil[ei]" },
  { parola: "best seller", modello: "best[\\s-]?seller" },
];
export const PAROLE_DA_NON_USARE: readonly string[] = ELENCO.map((p) => p.parola);

/** Parola intera: `\b` di JS non conosce le lettere accentate. */
const intera = (modello: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${modello})(?![\\p{L}\\p{N}])`, "giu");
const RICERCHE = ELENCO.map((p) => intera(p.modello));

const INVISIBLE_DERM = /invisible\s+derm/giu;
/** Quanti segni attorno a «Invisible Derm» non possono contenere una cifra o un euro. */
const RAGGIO = 40;
const CIFRA = /[0-9€]/u;

const BLOCCHI: readonly { motivo: BloccoTesto["motivo"]; cerca: RegExp; frase: string }[] = [
  { motivo: "sconto", cerca: /(?<![\p{L}\p{N}])sconto\s+del/iu, frase: "Non si scrive «sconto del»: nello shop non ci sono sconti senza un prezzo precedente vero." },
  { motivo: "risparmi", cerca: /(?<![\p{L}\p{N}])risparmi(?![\p{L}\p{N}])/iu, frase: "Non si scrive «risparmi»: nello shop non si promettono risparmi." },
  { motivo: "prezzo_barrato", cerca: /prezzo\s+barrato/iu, frase: "Non si scrive «prezzo barrato»: nello shop non esiste un prezzo precedente da mostrare." },
];

export function controllaTesto(testo: unknown): { bloccanti: BloccoTesto[]; avvisi: AvvisoTesto[] } {
  const bloccanti: BloccoTesto[] = [];
  const avvisi: AvvisoTesto[] = [];
  if (typeof testo !== "string" || !testo.trim()) return { bloccanti, avvisi };

  for (const m of testo.matchAll(INVISIBLE_DERM)) {
    const fine = m.index + m[0].length;
    if (CIFRA.test(testo.slice(Math.max(0, m.index - RAGGIO), m.index)) || CIFRA.test(testo.slice(fine, fine + RAGGIO))) {
      bloccanti.push({ motivo: "cifra_invisible_derm", frase: "Vicino a «Invisible Derm» non si scrivono cifre né prezzi: il costo si vede in consulenza." });
      break;
    }
  }
  for (const b of BLOCCHI) if (b.cerca.test(testo)) bloccanti.push({ motivo: b.motivo, frase: b.frase });

  RICERCHE.forEach((ricerca) => {
    for (const m of testo.matchAll(ricerca))
      avvisi.push({ parola: m[0], frase: `Il testo contiene “${m[0].replace(/\s+/g, " ")}”: è una parola da non usare. Controlla.`, da: m.index, a: m.index + m[0].length });
  });
  return { bloccanti, avvisi: avvisi.sort((x, y) => x.da - y.da) };
}
