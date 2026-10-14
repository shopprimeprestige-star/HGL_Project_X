/** ── LA RICHIESTA DEL MODULO CORTO · REGOLE PURE ────────────────────────────
 *  Niente schermo, niente rete, niente `window`: le prove (`prove/sito/richiesta.mjs`)
 *  le guardano una per una. Il salvataggio vero sta in `lead-comune.ts`, il
 *  disegno in `ModuloCorto.tsx`.
 *
 *  ⚠️ Nome e telefono passano solo nel lead. Nel testo libero ("Altro") si tiene
 *  una riga sola di al massimo 120 caratteri, sempre trattata come testo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { PROBLEMI, type IdProblema } from "@/landing/testi-sito";
import { pulisciTesto, type Provenienza, type PuntoIngresso } from "@/landing/consulenza/regole";
import { TESTI_MODULO_CORTO, VERSIONE_CONSENSO_WA, type Fascia } from "./testi-modulo-corto";

export type PuntoSito = PuntoIngresso | "protocol" | "catalogo" | "blog";

export interface ModuloCortoDati {
  nome: string;
  telefono: string;
  fascia: Fascia | "";
  problema: IdProblema | null;
  problemaAltro: string;
  consensoWhatsapp: boolean;
}

export type CampoErrore = "nome" | "telefono" | "fascia" | "problema";

/** Stessa regola di `BookingFunnel`: 9-10 cifre, oppure 39 + 11-12 cifre in tutto. */
export function telefonoValido(raw: string): boolean {
  const cifre = (raw ?? "").trim().replace(/\D/g, "");
  return (cifre.length >= 9 && cifre.length <= 10) || (cifre.startsWith("39") && cifre.length >= 11 && cifre.length <= 12);
}

/** Il numero come lo salva il modulo lungo: sempre «+39» e le sole cifre, senza prefisso doppio.
 *  ⚠️ Il prefisso si taglia guardando le CIFRE, mai la stringa con gli spazi: 391, 392, 393 e 397 sono
 *  cellulari veri e iniziano per «39». Un numero italiano ha 9-10 cifre: con 11 o più, il «39» iniziale
 *  è il prefisso. */
export function telefonoDaInviare(raw: string): string {
  const cifre = (raw ?? "").replace(/\D/g, "");
  const numero = cifre.startsWith("0039") ? cifre.slice(4) : cifre.startsWith("39") && cifre.length >= 11 ? cifre.slice(2) : cifre;
  return numero ? `+39 ${numero}` : "";
}

/** Gli errori, con le frasi del Copywriter. Il consenso WhatsApp non dà mai errori. */
export function controllaModulo(d: ModuloCortoDati, o: { problemaObbligatorio: boolean }): Partial<Record<CampoErrore, string>> {
  const e: Partial<Record<CampoErrore, string>> = {};
  if (!d.nome.trim()) e.nome = TESTI_MODULO_CORTO.errori.nome;
  //  «0039 …» si accetta (il modulo lungo lo toglie mentre si scrive); `telefonoDaInviare` lo porta a «+39 …».
  if (!telefonoValido(d.telefono.replace(/^\s*\+?\s*0039/, ""))) e.telefono = TESTI_MODULO_CORTO.errori.telefono;
  if (!d.fascia) e.fascia = TESTI_MODULO_CORTO.errori.fascia;
  if (o.problemaObbligatorio && !d.problema) e.problema = TESTI_MODULO_CORTO.errori.problema;
  return e;
}

export interface ColonneSito {
  origine: Provenienza;
  punto_ingresso: PuntoSito;
  problema_principale: string | null;
  problema_altro: string | null;
  fascia_oraria: Fascia;
  prodotto_stock: string | null;
}

/** Le sei colonne nuove di `public_leads`. «Altro» → la parola Altro, il testo libero va a parte. */
export function colonneSito(d: ModuloCortoDati, s: { origine: Provenienza; punto: PuntoSito; prodotto?: string }): ColonneSito {
  if (!d.fascia) throw new Error("fascia mancante: controllaModulo va chiamato prima");
  const voce = PROBLEMI.find((p) => p.id === d.problema);
  const altro = voce?.id === "altro" ? pulisciTesto(d.problemaAltro) : "";
  const prodotto = s.origine === "stock" ? pulisciTesto(s.prodotto) : "";
  return {
    origine: s.origine,
    punto_ingresso: s.punto,
    problema_principale: !voce ? null : voce.id === "altro" ? "Altro" : voce.etichetta,
    problema_altro: altro || null,
    fascia_oraria: d.fascia,
    prodotto_stock: prodotto || null,
  };
}

/** Con le colonne, `pain_points` porta solo l'etichetta (le statistiche delle risposte restano pulite). */
export function painPointsConColonne(c: ColonneSito): string[] {
  return c.problema_principale ? [c.problema_principale] : [];
}

/** Senza le colonne (migrazione non applicata): tutto in `pain_points`, formato del giro 1 + `Richiamo`. */
export function painPointsDiRiserva(c: ColonneSito): string[] {
  const righe: string[] = [];
  if (c.problema_principale) {
    const voce = c.problema_principale === "Altro" ? PROBLEMI.find((p) => p.id === "altro") : null;
    righe.push(`Problema: ${voce ? voce.etichetta : c.problema_principale}`);
    if (c.problema_altro) righe.push(`Problema (altro): ${c.problema_altro}`);
  }
  righe.push(`Provenienza: ${c.origine}`);
  righe.push(`Ingresso: ${c.punto_ingresso}`);
  if (c.prodotto_stock) righe.push(`Protesi: ${c.prodotto_stock}`);
  righe.push(`Richiamo: ${c.fascia_oraria}`);
  return righe;
}

/** Casella non spuntata → nessuna chiave. L'ora la scrive il trigger del cantiere WhatsApp, non il browser. */
export function campiConsenso(d: ModuloCortoDati): { consenso_whatsapp: true; consenso_whatsapp_versione: string } | Record<string, never> {
  return d.consensoWhatsapp ? { consenso_whatsapp: true, consenso_whatsapp_versione: VERSIONE_CONSENSO_WA } : {};
}

/** Le chiavi del lead del modulo corto che il modulo lungo (`BookingFunnel`) non ha, o viceversa.
 *  La prova di deriva (`prove/sito/lead.mjs`) accetta SOLO queste; ogni altra differenza la rende rossa. */
export const DIFFERENZE_AMMESSE: readonly string[] = [
  // id: il modulo corto sceglie l'id del lead per poterlo aggiornare col calendario (un lead per persona).
  "id",
  // chiave_orario_hash: l'impronta della chiave che permette di fissare l'orario sullo stesso lead.
  "chiave_orario_hash",
  // origine: stock o consulenza, dal punto del sito da cui parte la richiesta.
  "origine",
  // punto_ingresso: barra, pannello, box, pop-up, modulo Protocol, home.
  "punto_ingresso",
  // problema_principale: la voce scelta (le etichette del Copywriter).
  "problema_principale",
  // problema_altro: il testo di «Altro», una riga di al massimo 120 caratteri.
  "problema_altro",
  // fascia_oraria: mattina, pomeriggio o sera, per il richiamo.
  "fascia_oraria",
  // prodotto_stock: la protesi guardata, solo se la richiesta parte dallo shop.
  "prodotto_stock",
  // consenso_whatsapp: lo aggiunge a BookingFunnel il compito 7 di crm-whatsapp-automatico; il modulo corto lo manda solo con la casella spuntata.
  "consenso_whatsapp",
  // consenso_whatsapp_versione: come sopra, con la versione del testo della casella.
  "consenso_whatsapp_versione",
];

/** Colonna che non c'è (PGRST204, 42703) o controllo non rispettato (23514): migrazione non applicata. */
export function erroreDaRitentare(code?: string): boolean {
  return code === "PGRST204" || code === "42703" || code === "23514";
}

/** Stesso id già salvato: doppio tocco o rete caduta dopo il salvataggio. */
export function giaSalvato(code?: string): boolean {
  return code === "23505";
}
