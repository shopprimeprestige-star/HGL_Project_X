/** L'ANTEPRIMA DEL LINK DI «GUARDATI CON I CAPELLI»
 *
 *  Questo link parte da una chat, quasi sempre da WhatsApp e quasi sempre a
 *  freddo: chi lo riceve non ha chiesto niente. Il riquadro nella chat è tutto
 *  quello che ha per decidere, e prima non c'era proprio — il link arrivava
 *  nudo, con l'indirizzo scritto in piccolo.
 *
 *  ── ⚠️ PERCHÉ QUESTE TRE PAROLE E NON ALTRE ──────────────────────────────
 *  Le tre pastiglie sono le tre cose che una persona pensa in quest'ordine
 *  esatto quando le si chiede una foto della propria faccia:
 *   · «cosa devo fare?»      → una foto, e basta;
 *   · «quanto ci vuole?»     → un minuto;
 *   · «dove finisce la mia faccia?» → resta sul telefono.
 *  L'ultima è la più importante e non è uno slogan: è vera, ed è la stessa
 *  promessa scritta sulla prima schermata della pagina (la foto non si salva).
 *  Se un giorno smettesse di essere vera, questa riga va tolta per prima.
 */
import { depositaScheda, disegnaScheda, COL, type Scheda } from "@/shop/scheda-anteprima";
import { PROVE_COMPRESE } from "@/prova/codici";

/** Una sola scheda per tutti i link della pagina: non cambia da persona a
 *  persona, quindi si deposita sotto un nome fisso. */
export const CODICE_SCHEDA = "generale";

//  ⚠️ Il numero del disegno vive in un modulo suo: lo legge anche la pagina
//   pubblica, che non deve tirarsi dietro il gestionale. Vedi versione-scheda.
export { VERSIONE_SCHEDA } from "./versione-scheda";

export function schedaCapelli(): Scheda {
  return {
    occhiello: "Anteprima capelli",
    titolo: "Guardati con i capelli",
    //  ⚠️ Corta: sulla tela arrivava a un dito dal bordo destro, e una riga
    //   che tocca il bordo su un'anteprima ritagliata è una riga tagliata.
    sotto: "Scegli il taglio e ti vedi subito. Il viso non si tocca.",
    pastiglie: [
      { icona: "foto", testo: "Una tua foto", tinta: COL.marcaChiara },
      { icona: "magia", testo: "In un minuto", tinta: "#a78bfa" },
      //  ⚠️ Verde: è l'unica pastiglia che rassicura invece di spiegare, e si
      //   deve distinguere dalle altre due a colpo d'occhio.
      { icona: "riservato", testo: "Resta sul telefono", tinta: "#34d399" },
    ],
    invito: "Provalo adesso",
    //  ⚠️ Il disegnino «prima → dopo»: su un link che chiede a una persona di
    //   mandare la propria faccia, due fotografie e una freccia spiegano in
    //   mezzo secondo quello che tre righe di testo non spiegano affatto.
    visuale: "capelli",
    badge: { testo: `${PROVE_COMPRESE} prove incluse`, icona: "taglio" },
  };
}

export const disegnaAnteprimaCapelli = (tela: HTMLCanvasElement) => disegnaScheda(tela, schedaCapelli());

export const depositaAnteprimaCapelli = (): Promise<boolean> =>
  depositaScheda("capelli", CODICE_SCHEDA, schedaCapelli());
