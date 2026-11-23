/** ── VETRINA V1 · T76 · LE VOCI DI FIDUCIA (D87; criteri V1-H2, V1-T6) ──────────
 *  Modulo PURO: niente React, niente rete. Dice quali frasi di fiducia sono **vere** adesso e se la riga/la fascia che le porta si monta.
 *  Una voce o è vera (dato del server o testo confermato dal titolare) o **non c'è**: mai «da confermare», mai `{{…}}`, mai un corriere
 *  o un tempo che nessuno ha confermato (D62). Le fonti sono quelle di D87; le parole sono quelle di `testi-shop.ts` dove il documento le dà.
 *  Dove il documento non dà il testo (reso dai dati del prodotto, pagamenti, WhatsApp) servono frasi provvisorie: stanno in
 *  `TESTI_FIDUCIA_PROVVISORI`, in un punto solo, per il copywriter. Non si mettono in `testi-shop.ts` (non è di questo compito). */
import { TESTI_SHOP, riempi } from "@/landing/testi-shop";
import type { SpedizionePubblica } from "../cassa/spedizione";
import { filtraConfermati } from "./testi-confermati";

export type IdVoceFiducia = "studio" | "spedizione" | "reso" | "pagamenti" | "whatsapp" | "consulenza";
export interface VoceFiducia {
  id: IdVoceFiducia;
  testo: string;
}

/** Frasi che il documento non dà (T72 le lascia fuori perché «da confermare»): provvisorie, senza parole vietate. Da confermare dal copywriter. */
export const TESTI_FIDUCIA_PROVVISORI = {
  resoGiorni: "Reso entro {giorni} giorni",
  resoUnGiorno: "Reso entro {giorni} giorno",
  whatsapp: "Scrivici su WhatsApp: {testo}",
  pagamenti: "Pagamenti accettati: {metodi}",
};

export interface IngressiFiducia {
  /** Cosa risponde `tariffaSpedizione()`. */
  tariffa?: SpedizionePubblica | null;
  /** I testi confermati dal titolare (la porta `testiConfermati()`, già filtrata; qui si filtra comunque). */
  testi?: Record<string, unknown> | null;
  /** Il prodotto della scheda (solo il dato del reso). Senza prodotto (home, carrello) vale solo il testo del titolare. */
  prodotto?: { reso?: { consentito?: boolean | null; giorni?: number | null } | null } | null;
  /** Cosa risponde `cassaPubblica()`. */
  cassa?: { sicuro?: unknown; metodi?: unknown } | null;
  /** Studio e consulenza: i testi di `shop.fascia.*` come li ha il CRM. Non scritti = quelli di partenza; svuotati = voce nascosta. */
  fascia?: { studio?: unknown; consulenza?: unknown } | null;
}

const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const testoVero = (t: unknown): t is string => typeof t === "string" && t.trim() !== "";
/** Niente segnaposto aperti, niente «da confermare»: una frase così non si disegna. */
const pulito = (t: string) => !/[{}]/.test(t) && !/da confermare/i.test(t);
/** «Consegna in 2-4 giorni.» → «consegna in 2-4 giorni» (si legge dopo una virgola). */
const dopoVirgola = (frase: string) => {
  const f = frase.trim().replace(/[.\s]+$/, "");
  return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(f) ? f[0].toLowerCase() + f.slice(1) : f;
};

function spedizione(t: IngressiFiducia["tariffa"]): string | null {
  if (!t || t.stato !== "ok" || !Number.isSafeInteger(t.costoCent) || t.costoCent < 0) return null;
  const costo = EURO.format(t.costoCent / 100);
  // Tariffa non confermata: solo il costo (D62). Il corriere non esce mai.
  const tempi = t.confermata === true && testoVero(t.frase) ? dopoVirgola(t.frase) : null;
  const modello = TESTI_SHOP.scheda.spedizione; // «Spedizione: {costo}, {tempi}.»
  return tempi ? riempi(modello, { costo, tempi }) : riempi(modello.replace(", {tempi}", ""), { costo });
}

function reso(prodotto: IngressiFiducia["prodotto"], testo: string | null): string | null {
  const r = prodotto?.reso;
  if (r?.consentito === false) return null; // per questo prodotto il reso non c'è: una regola generale sarebbe falsa
  if (testo) return testo;
  const giorni = r?.giorni;
  if (r?.consentito !== true || typeof giorni !== "number" || !Number.isSafeInteger(giorni) || giorni < 1) return null;
  return riempi(giorni === 1 ? TESTI_FIDUCIA_PROVVISORI.resoUnGiorno : TESTI_FIDUCIA_PROVVISORI.resoGiorni, { giorni });
}

function pagamenti(cassa: IngressiFiducia["cassa"]): string | null {
  if (cassa?.sicuro !== true || !Array.isArray(cassa.metodi)) return null;
  const metodi = cassa.metodi.filter(testoVero).map((m) => m.trim());
  return metodi.length ? riempi(TESTI_FIDUCIA_PROVVISORI.pagamenti, { metodi: metodi.join(", ") }) : null;
}

/** Il testo di studio o consulenza: non scritto (`undefined`, `null`, non testo) = quello di partenza; scritto ma vuoto o con segnaposto = nascosto. */
const costante = (valore: unknown, partenza: string): string | null => {
  const t = typeof valore === "string" ? valore : partenza;
  return t.trim() === "" ? null : t.trim();
};

/** D87: le sole voci vere, nell'ordine in cui compaiono (studio, spedizione, reso, pagamenti, WhatsApp, consulenza). */
export function vociFiducia(dati: IngressiFiducia = {}): VoceFiducia[] {
  const testi = filtraConfermati(dati?.testi);
  const wa = testi.assistenza_whatsapp;
  const voci: [IdVoceFiducia, string | null][] = [
    ["studio", costante(dati?.fascia?.studio, TESTI_SHOP.fascia.studio)],
    ["spedizione", spedizione(dati?.tariffa)],
    ["reso", reso(dati?.prodotto, testi.reso)],
    ["pagamenti", pagamenti(dati?.cassa)],
    ["whatsapp", wa ? riempi(TESTI_FIDUCIA_PROVVISORI.whatsapp, { testo: wa }) : null],
    ["consulenza", costante(dati?.fascia?.consulenza, TESTI_SHOP.fascia.consulenza)],
  ];
  return voci.flatMap(([id, testo]) => (testo !== null && pulito(testo) ? [{ id, testo }] : []));
}

const BLOCCO: readonly IdVoceFiducia[] = ["spedizione", "reso", "pagamenti", "whatsapp"];
const FASCIA: readonly IdVoceFiducia[] = ["studio", "spedizione", "reso", "consulenza"];
const eVoce = (v: unknown): v is VoceFiducia => !!v && typeof v === "object" && testoVero((v as VoceFiducia).testo) && typeof (v as VoceFiducia).id === "string";
const di = (voci: unknown, ammesse: readonly IdVoceFiducia[]) => (Array.isArray(voci) ? voci.filter(eVoce).filter((v) => ammesse.includes(v.id)) : []);

/** La riga sotto il bottone della scheda e del carrello: spedizione, reso, pagamenti, WhatsApp. Zero voci → `null` (non si monta). */
export function montaBlocco(voci: readonly VoceFiducia[]): VoceFiducia[] | null {
  const v = di(voci, BLOCCO);
  return v.length ? v : null;
}

/** La fascia della home: studio, spedizione, reso, consulenza. Una voce sola o nessuna → `null` (non si monta). */
export function montaFascia(voci: readonly VoceFiducia[]): VoceFiducia[] | null {
  const v = di(voci, FASCIA);
  return v.length >= 2 ? v : null;
}
