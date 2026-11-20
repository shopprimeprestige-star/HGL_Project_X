/** ── «APRI LO SHOP AL PUBBLICO»: LE REGOLE SENZA SCHERMO (interruttore-puro.ts) ───────────────────
 *  Commessa 2026-11-20-shop-completo, T17 (D26). Legge ciò che `?interruttori` risponde (`{ interruttori, condizioni }`) e
 *  lo trasforma in ciò che `ApriShop.tsx` disegna. Si prova da solo (prove/negozio/interruttore-sorgente.mjs).
 *
 *  ⚠️ Il server è l'unico che decide se lo shop si apre (`cms` solo se `puoAprire`). Qui la stessa regola si rifà per non
 *  accendere un interruttore che verrebbe rifiutato: `puoAprire` vale solo se la risposta lo dice VERO **e** ogni riga è
 *  valutabile e a posto. Nel dubbio (risposta storta, righe che mancano) lo shop non si apre. */

export interface RigaCondizione {
  chiave: string;
  ok: boolean;
  /** `false` = oggi non si sa verificare (nel R1: la cassa). La riga vale «no» e dice che si attiva col rilascio della cassa. */
  valutabile: boolean;
  frase: string;
}
export type StatoRiga = "ok" | "no" | "non_valutabile";
export interface StatoShop {
  /** `catalogo_sito`: «cms» = lo shop è aperto al pubblico, «codice» = chiuso. */
  valore: "codice" | "cms";
  aperto: boolean;
  /** La soglia «giacenza bassa» (0 = nessun avviso); `null` se non si legge. */
  soglia: number | null;
  righe: RigaCondizione[];
  puoAprire: boolean;
}

const eOggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Le righe ben formate; le altre si scartano (una riga che non si capisce non può far aprire niente). */
function leggiRighe(x: unknown): RigaCondizione[] {
  if (!Array.isArray(x)) return [];
  return x.flatMap((r) =>
    eOggetto(r) && typeof r.chiave === "string" && r.chiave && typeof r.ok === "boolean" && typeof r.valutabile === "boolean" && typeof r.frase === "string"
      ? [{ chiave: r.chiave, ok: r.ok, valutabile: r.valutabile, frase: r.frase }]
      : [],
  );
}

export const statoCondizione = (r: RigaCondizione): StatoRiga => (!r.valutabile ? "non_valutabile" : r.ok ? "ok" : "no");

/** Le condizioni di una risposta (`{ righe, puoAprire }`), per la lettura e per il rifiuto «cancello». `null` se non si capisce. */
export function righeDaCondizioni(condizioni: unknown): RigaCondizione[] | null {
  return eOggetto(condizioni) && Array.isArray(condizioni.righe) ? leggiRighe(condizioni.righe) : null;
}

/** `true` solo se il server lo dice e ogni riga è valutabile e a posto (e ce n'è almeno una). */
export function puoAprireDa(condizioni: unknown): boolean {
  const righe = righeDaCondizioni(condizioni);
  return eOggetto(condizioni) && condizioni.puoAprire === true && righe !== null && righe.length > 0 && righe.every((r) => statoCondizione(r) === "ok");
}

export function leggiStatoShop(dati: unknown): StatoShop | null {
  if (!eOggetto(dati) || !eOggetto(dati.interruttori)) return null;
  const catalogo = dati.interruttori.catalogo_sito;
  const valore = eOggetto(catalogo) ? catalogo.valore : null;
  if (valore !== "codice" && valore !== "cms") return null;
  const g = dati.interruttori.giacenza_bassa;
  const soglia = eOggetto(g) && typeof g.valore === "number" && Number.isSafeInteger(g.valore) && g.valore >= 0 ? g.valore : null;
  return { valore, aperto: valore === "cms", soglia, righe: righeDaCondizioni(dati.condizioni) ?? [], puoAprire: puoAprireDa(dati.condizioni) };
}

/** I titoli per il titolare. Una chiave sconosciuta usa la frase del server. */
const TITOLI: Record<string, string> = {
  catalogo_reale: "Almeno 2 prodotti pubblicati con la foto principale",
  foto_vere: "Nessun prodotto pubblicato senza foto principale",
  pagamento: "Il pagamento incassa davvero",
  spedizione_resi: "Spedizioni e resi scritti",
  email_conferma: "L'email di conferma ordine parte",
  banner_consenso: "Il banner dei cookie è attivo",
  migrazione_ordini: "Gli ordini sono protetti",
};
export const titoloCondizione = (r: RigaCondizione): string => TITOLI[r.chiave] ?? r.frase;

export const FRASE_NON_VALUTABILE = "Si attiva col rilascio della cassa.";
/** Sotto il titolo: la frase del server, tranne per le righe che oggi non si sanno valutare. */
export const fraseCondizione = (r: RigaCondizione): string => (r.valutabile ? r.frase : FRASE_NON_VALUTABILE);

export function riepilogoCondizioni(righe: readonly RigaCondizione[]) {
  return {
    aPosto: righe.filter((r) => statoCondizione(r) === "ok").length,
    totale: righe.length,
    nonValutabili: righe.filter((r) => !r.valutabile).length,
  };
}
