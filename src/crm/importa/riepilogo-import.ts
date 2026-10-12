/** ── IL RIEPILOGO DELL'ANTEPRIMA D'IMPORTAZIONE ────────────────────────────
 *
 *  Prima di importare, la setter vuole sapere cosa sta per entrare: quanti
 *  lead per gruppo di annunci e per annuncio, e cosa hanno risposto alle
 *  domande del modulo. Stesse regole dei filtri della lista (`etichettaAnnuncio`
 *  e `valoriRisposta`): quello che legge qui è quello che troverà poi nei
 *  menu, con gli stessi nomi.
 *
 *  ⚠️ I LEAD SENZA ANNUNCIO NON SONO UN GRUPPO FINTO: si contano a parte
 *   (`senzaAnnuncio`), così la somma dei gruppi più questo numero fa il totale. */

import type { CampoModulo, LeadData } from "../types";
import { CAMPI_MODULO } from "../types";
import { etichettaAnnuncio, SENZA, valoriRisposta } from "./filtri-lista";

export interface RiepilogoImport {
  perGruppo: { gruppo: string; n: number; annunci: { annuncio: string; n: number }[] }[];
  perDomanda: { campo: CampoModulo; titolo: string; risposte: { etichetta: string; n: number }[] }[];
  /** I lead senza gruppo né campagna (anche se hanno un ad_name). */
  senzaAnnuncio: number;
  /** Fra quelli senza gruppo, i nomi di annuncio che il file ha dato lo stesso:
   *  non si perdono. */
  annunciSenzaGruppo: { annuncio: string; n: number }[];
}

const perNumero = <T extends { n: number }>(a: T, b: T, nome: (x: T) => string) =>
  b.n - a.n || nome(a).localeCompare(nome(b), "it");

export function riepilogoImport(leads: Partial<LeadData>[]): RiepilogoImport {
  const gruppi = new Map<string, { gruppo: string; n: number; annunci: Map<string, number> }>();
  const domande = new Map<CampoModulo, { titolo: string; risposte: Map<string, { etichetta: string; n: number }> }>();
  let senzaAnnuncio = 0;
  const senzaGruppo = new Map<string, number>();

  for (const l of leads) {
    const e = etichettaAnnuncio(l.tracking);
    if (e.chiaveGruppo === SENZA) {
      senzaAnnuncio++;
      if (e.annuncio) senzaGruppo.set(e.annuncio, (senzaGruppo.get(e.annuncio) ?? 0) + 1);
    } else {
      const g = gruppi.get(e.chiaveGruppo) ?? { gruppo: e.gruppo, n: 0, annunci: new Map<string, number>() };
      g.n++;
      if (e.annuncio) g.annunci.set(e.annuncio, (g.annunci.get(e.annuncio) ?? 0) + 1);
      gruppi.set(e.chiaveGruppo, g);
    }
    for (const v of valoriRisposta(l.modulo)) {
      const d = domande.get(v.campo) ?? { titolo: v.titolo, risposte: new Map() };
      const r = d.risposte.get(v.chiave) ?? { etichetta: v.etichetta, n: 0 };
      r.n++;
      d.risposte.set(v.chiave, r);
      domande.set(v.campo, d);
    }
  }

  return {
    perGruppo: [...gruppi.values()]
      .map((g) => ({
        gruppo: g.gruppo,
        n: g.n,
        annunci: [...g.annunci].map(([annuncio, n]) => ({ annuncio, n })).sort((a, b) => perNumero(a, b, (x) => x.annuncio)),
      }))
      .sort((a, b) => perNumero(a, b, (x) => x.gruppo)),
    //  Le domande nell'ordine del modulo (CAMPI_MODULO), non per numero: si
    //  leggono sempre nello stesso posto.
    perDomanda: [...domande]
      .sort(([a], [b]) => CAMPI_MODULO.indexOf(a) - CAMPI_MODULO.indexOf(b))
      .map(([campo, d]) => ({
        campo,
        titolo: d.titolo,
        risposte: [...d.risposte.values()].sort((a, b) => perNumero(a, b, (x) => x.etichetta)),
      })),
    senzaAnnuncio,
    annunciSenzaGruppo: [...senzaGruppo]
      .map(([annuncio, n]) => ({ annuncio, n }))
      .sort((a, b) => perNumero(a, b, (x) => x.annuncio)),
  };
}
