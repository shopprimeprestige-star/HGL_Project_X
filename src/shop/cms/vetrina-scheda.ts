/** ── VETRINA V1 · T78 · I BLOCCHI DELLA SCHEDA: QUALI E IN CHE ORDINE (parte pura) ─
 *  Cosa deve valere (SPEC §4.5.4 n. 7-8, V1-S5, V1-T8):
 *   · l'ordine è fisso: galleria, acquisto, colore (solo patch), confezione, come si usa, scheda tecnica, FAQ, box, «Ti serve anche»;
 *   · il box «Non è il prodotto giusto per te?» sta DOPO le FAQ, solo su una patch con `boxConsulenza`; mai sulla cura, mai sul kit;
 *   · «Ti serve anche»: UNA sola card, mai Invisible Derm, mai senza prezzo (la card ha «Aggiungi»);
 *   · «Scheda tecnica»: nessuna riga «da confermare», nessun segnaposto `{{…}}`, nessuna riga vuota; senza righe il blocco non c'è;
 *   · il kit mostra la sua confezione come «Cosa contiene», un elenco di testo (D81);
 *   · il pop-up d'uscita si monta solo sulla scheda di una patch con il carrello VUOTO (`popupPuoMontarsi`).
 *  Qui si decide QUALI blocchi e con quali dati: il disegno è di T88a/T88b/T97b e le parole di `testi-shop.ts`. Nessun React, nessuna rete.
 *  Recensioni: non esistono in questa commessa, quindi nessun blocco. */
import { eInvisibleDerm } from "./pubblico";
import type { ProdottoPubblico } from "./modello";
import { ordinaGalleria } from "./vetrina-galleria";

type Riga = ProdottoPubblico["caratteristiche"][number];

export type Blocco =
  | { id: "galleria" }
  /** `rigaSpedizione`: la riga «Spedizione» si disegna solo con una tariffa, e mai dove non si compra. */
  | { id: "acquisto"; acquistabile: boolean; rigaSpedizione: boolean }
  | { id: "colore" }
  /** `titolo`: «Nella confezione» (`confezione`) o, sul kit, «Cosa contiene» (`cosaContiene`): le voci sono sempre un elenco di testo. */
  | { id: "confezione"; titolo: "confezione" | "cosaContiene"; voci: string[] }
  | { id: "comeSiUsa" }
  | { id: "schedaTecnica"; righe: Riga[] }
  | { id: "faq" }
  | { id: "box" }
  | { id: "tiServeAnche"; correlato: NonNullable<ProdottoPubblico["correlato"]> };

/** Cosa sa la pagina oltre al prodotto. `testi` e `cassa` non cambiano i blocchi (le voci di fiducia sono di `BloccoAcquisto`): ci sono perché
 *  la pagina passa sempre tutto insieme. `carrelloVuoto` serve al pop-up, non ai blocchi. */
export interface ContestoScheda {
  tariffa?: { stato: string } | null;
  testi?: unknown;
  cassa?: unknown;
  carrelloVuoto?: boolean | null;
}

/** Una riga della scheda tecnica vale se ha etichetta e valore e non è «da confermare» (in qualunque forma) né porta un segnaposto `{{…}}`. */
const DA_CONFERMARE = /da\s+confermare|\{\{/i;
const rigaVera = (r: Riga): boolean =>
  typeof r?.etichetta === "string" && typeof r?.valore === "string" && r.etichetta.trim() !== "" && r.valore.trim() !== "" && !DA_CONFERMARE.test(`${r.etichetta} ${r.valore}`);

const pieno = (x: readonly unknown[] | null | undefined): boolean => Array.isArray(x) && x.length > 0;

/** Il box e il pop-up parlano di una consulenza per CHI COMPRA una patch: mai su un prodotto che non si compra (Invisible Derm), mai sulla cura o sul kit. */
const eUnaPatchInVendita = (p: ProdottoPubblico | null | undefined): p is ProdottoPubblico => !!p && p.tipo === "patch" && p.acquistabile === true;

/** I blocchi della scheda di `p`, nell'ordine in cui si disegnano. Un blocco senza niente da mostrare non c'è. */
export function bloccheScheda(p: ProdottoPubblico, contesto?: ContestoScheda | null): Blocco[] {
  const righe = (Array.isArray(p.caratteristiche) ? p.caratteristiche : []).filter(rigaVera);
  const c = p.correlato;
  // «Ti serve anche»: una sola card, con prezzo (ha «Aggiungi»), mai Invisible Derm, mai la scheda stessa
  const proponibile = !!c && c.prezzoDaCent !== null && c.slug !== p.slug && !eInvisibleDerm(c.nome, c.slug);
  return [
    ...(ordinaGalleria(p.media).length > 0 ? [{ id: "galleria" } as const] : []),
    { id: "acquisto", acquistabile: p.acquistabile === true, rigaSpedizione: p.acquistabile === true && contesto?.tariffa?.stato === "ok" },
    ...(p.tipo === "patch" ? [{ id: "colore" } as const] : []),
    ...(pieno(p.confezione) ? [{ id: "confezione", titolo: p.tipo === "kit" ? "cosaContiene" : "confezione", voci: p.confezione } as const] : []),
    ...(pieno(p.passi) ? [{ id: "comeSiUsa" } as const] : []),
    ...(righe.length > 0 ? [{ id: "schedaTecnica", righe } as const] : []),
    ...(pieno(p.faq) ? [{ id: "faq" } as const] : []),
    ...(eUnaPatchInVendita(p) && p.boxConsulenza === true ? [{ id: "box" } as const] : []),
    ...(proponibile ? [{ id: "tiServeAnche", correlato: c } as const] : []),
  ];
}

/** Il pop-up d'uscita: solo sulla scheda di una patch in vendita e SOLO se il carrello è vuoto (`true`: se non si sa ancora, non si disturba). */
export function popupPuoMontarsi(p: ProdottoPubblico | null | undefined, carrelloVuoto: boolean | null | undefined): boolean {
  return eUnaPatchInVendita(p) && carrelloVuoto === true;
}
