/** ── GLI INTERRUTTORI DEL CATALOGO: IL SERVER (interruttori.server.ts) ──────
 *  Commessa 2026-11-20-shop-completo (T09), PIANO D8, D26 e §3.3.
 *
 *  GET  ?interruttori                                     → `{ ok, interruttori, condizioni }`
 *  GET  ?cassa  (R2, T56)                                 → `{ ok, interruttori, condizioni, puoAccendereSicuro, ambiente }`
 *  POST { azione: "interruttore_imposta", chiave, valore, atteso }
 *       · `catalogo_sito`: `codice` | `cms`   (`cms` = «apri lo shop al pubblico»)
 *       · `giacenza_bassa`: intero da 0 a 9999 (0 = nessun avviso)
 *       · `cassa_sito` (R2, D56): `vecchia` | `stripe` (minuscolo: «Stripe» sarebbe letto «vecchia» da S4b e da `cassaDa`)
 *       · `resi_confermati` (R2): vero/falso, lo attesta a mano il titolare (pagina di spedizioni e resi, V2)
 *       · `pagamento_sicuro` (R2, D65): vero/falso; vero solo se `pagamentoIncassa` è vero
 *       · `metodi_pagamento` (R2, D65): elenco di `carta|apple_pay|google_pay|paypal|klarna`, senza doppioni
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · Si scrive SOLO con `shop_impostazione_imposta` (confronto-e-scambio sul valore ATTESO, la riga di storico la scrive
 *    il database nella stessa transazione). Nessuna scrittura diretta su `shop_impostazioni` né su `shop_storico`.
 *  · `atteso` è il valore che la schermata aveva davanti: se non è più quello → 409 col valore vero.
 *  · D26: `cms` si accende solo se `condizioniUscita` dice `puoAprire`; la risposta di rifiuto porta tutte le righe.
 *    `codice` si accetta SEMPRE e per chiudere il cancello non si valuta nemmeno (tornare indietro è un clic).
 *  · D56: `stripe` si accende solo se `condizioniCassa` dice `puoAccendere` (chiave, segreto del webhook, tariffa attiva, S4):
 *    una frase per ciascuna che manca, nessuna scrittura. `vecchia` si accetta SEMPRE, senza nemmeno chiedere i fatti.
 *  · D65: `pagamento_sicuro = true` solo con `pagamentoIncassa` vero; `false` sempre.
 *  · Non si creano chiavi nuove: se il seme manca, 404 (le chiavi del catalogo, S1) o 409 «migrazione» (quelle dei pagamenti, S4/S5).
 *  · I fatti che stanno fuori dal database (banner, e dal R2 pagamento, spedizioni, email, chiave e segreto di Stripe, tariffa, S4)
 *    arrivano dalla porta `fattiEsterni`, che la rotta collega: un fatto non passato è «non ancora valutabile» e vale «no».
 *    ⚠️ Le variabili d'ambiente non entrano mai nelle risposte: arrivano come booleani «presente/assente» e si copiano solo quelli. */
import { condizioniCassa, condizioniUscita, type FattiCassa, type StatoCancello } from "./cancello";
import { azioneDi, conflitto, dati, eMancante, gestisci, guasto, leggiCorpo, rifiuta, righe, senzaMigrazione, type PorteDb } from "./comune";
import { METODI_PAGAMENTO, eMetodo } from "./fatti.server";

export const AZIONI_INTERRUTTORI = ["interruttore_imposta"] as const;
const MAX_SOGLIA = 9999;

export type FattiEsterni = Omit<StatoCancello, "pubblicati" | "conFotoPrincipale"> & FattiCassa;
export interface PorteInterruttori extends PorteDb {
  /** Ciò che il database non sa: il banner dei cookie c'è? e, dal R2, pagamento, spedizioni, email, M2, e le precondizioni della cassa (`fatti.server.ts`). */
  fattiEsterni: () => FattiEsterni | Promise<FattiEsterni>;
}

const eBooleano = (v: unknown): v is boolean => typeof v === "boolean";
const eElencoMetodi = (v: unknown): boolean => Array.isArray(v) && v.length <= METODI_PAGAMENTO.length && v.every(eMetodo) && new Set(v).size === v.length;
/** Due valori sono lo stesso se uguali; due elenchi sono lo stesso se hanno le stesse voci, in qualunque ordine. */
const stessiValori = (a: unknown, b: unknown): boolean =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x) => b.includes(x)) : a === b;

/** Per ogni interruttore: quali valori sono ammessi e la frase se non lo sono. */
const REGOLE: Record<string, { valido: (v: unknown) => boolean; frase: string }> = {
  catalogo_sito: { valido: (v) => v === "codice" || v === "cms", frase: "Il catalogo del sito può essere solo «codice» o «cms»." },
  giacenza_bassa: { valido: (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= MAX_SOGLIA, frase: `La soglia di giacenza bassa è un numero intero da 0 a ${MAX_SOGLIA} (0 = nessun avviso).` },
  cassa_sito: { valido: (v) => v === "vecchia" || v === "stripe", frase: "La cassa del sito può essere solo «vecchia» o «stripe» (tutto minuscolo)." },
  resi_confermati: { valido: eBooleano, frase: "«Resi confermati» può essere solo sì o no." },
  pagamento_sicuro: { valido: eBooleano, frase: "«Pagamento sicuro» può essere solo sì o no." },
  metodi_pagamento: { valido: eElencoMetodi, frase: `I metodi di pagamento possono essere solo: ${METODI_PAGAMENTO.join(", ")}, ognuno una volta.` },
};
const CHIAVI = Object.keys(REGOLE);
/** Le due che `GET ?interruttori` mostra da sempre (R1) e le quattro che mostra `GET ?cassa` (R2). */
const CHIAVI_CATALOGO = ["catalogo_sito", "giacenza_bassa"];
const CHIAVI_CASSA = ["cassa_sito", "pagamento_sicuro", "metodi_pagamento", "resi_confermati"];

/** Lo stato del catalogo per il cancello: quanti pubblicati e quanti hanno una foto principale che il pubblico vede. */
async function statoDelCatalogo(d: PorteDb): Promise<StatoCancello> {
  const pubblicati = new Set(righe(dati(d, "cancello", await d.db.from("shop_prodotti").select("id").eq("stato", "pubblicato").limit(5000))).map((r) => r.id));
  const foto = righe(dati(d, "cancello", await d.db.from("shop_media").select("prodotto_id, ritrae_persone, liberatoria_ok").eq("slot", "principale").is("rimosso_il", null).limit(10000)));
  // stessa regola del trigger e delle viste: una persona senza liberatoria non esce, quindi non è una foto
  const conFoto = new Set(foto.filter((m) => m.ritrae_persone !== true || m.liberatoria_ok === true).map((m) => m.prodotto_id));
  return { pubblicati: pubblicati.size, conFotoPrincipale: [...pubblicati].filter((id) => conFoto.has(id)).length };
}

async function condizioni(d: PorteInterruttori) {
  return condizioniUscita({ ...(await statoDelCatalogo(d)), ...(await d.fattiEsterni()) });
}

async function leggiValore(d: PorteDb, chiave: string): Promise<unknown> {
  const r = righe(dati(d, "lettura", await d.db.from("shop_impostazioni").select("valore").eq("chiave", chiave).limit(1)));
  if (!r.length) {
    if (CHIAVI_CASSA.includes(chiave))
      throw rifiuta("migrazione", 409, `Questo interruttore non esiste ancora nel database: manca l'aggiornamento ${chiave === "resi_confermati" ? "delle spedizioni (migrazione S5)" : "dei pagamenti (migrazione S4)"}. Chiedi a chi gestisce il database di applicarlo.`);
    throw rifiuta("non_trovato", 404, "Questo interruttore non esiste nel database: manca il seme della migrazione del catalogo.");
  }
  return r[0].valore;
}

async function imposta(corpo: Record<string, unknown>, chi: string, d: PorteInterruttori) {
  const chiave = corpo.chiave;
  if (typeof chiave !== "string" || !CHIAVI.includes(chiave)) throw rifiuta("valore", 400, "Questo interruttore non esiste.");
  const regola = REGOLE[chiave];
  if (!regola.valido(corpo.valore)) throw rifiuta("valore", 400, regola.frase);
  if (!regola.valido(corpo.atteso)) throw rifiuta("valore", 400, "Manca il valore che vedevi prima del cambio: ricarica la pagina.");
  const valore = corpo.valore, atteso = corpo.atteso;

  const corrente = await leggiValore(d, chiave);
  if (!stessiValori(corrente, atteso)) throw conflitto("Questo interruttore è stato cambiato da qualcun altro nel frattempo: ricarica la pagina.", { valore: corrente });
  if (stessiValori(corrente, valore)) return { chiave, valore, cambiato: false };

  if (chiave === "catalogo_sito" && valore === "cms") {
    const e = await condizioni(d);
    if (!e.puoAprire)
      throw rifiuta("cancello", 409, `Lo shop non si può ancora aprire. ${e.righe.filter((x) => !x.ok).map((x) => x.frase).join(" ")}`, { condizioni: e });
  }

  if (chiave === "cassa_sito" && valore === "stripe") {
    const e = condizioniCassa(await d.fattiEsterni());
    if (!e.puoAccendere)
      throw rifiuta("cassa", 409, `La cassa Stripe non si può ancora accendere. ${e.righe.filter((x) => !x.ok).map((x) => x.frase).join(" ")}`, { condizioni: e });
  }
  if (chiave === "pagamento_sicuro" && valore === true && (await d.fattiEsterni()).pagamentoIncassa !== true)
    throw rifiuta("cassa", 409, "«Pagamento sicuro» si accende solo dopo un pagamento reale che sia stato rimborsato per intero: finché non c'è, la vetrina non può dirlo.");

  const r = await d.db.rpc("shop_impostazione_imposta", { p_chiave: chiave, p_atteso: corrente, p_nuovo: valore, p_chi: chi });
  if (r.error) throw eMancante(r.error) ? senzaMigrazione() : guasto(d, "scambio", r.error);
  if (r.data !== true) throw conflitto("Questo interruttore è stato cambiato da qualcun altro nel frattempo: ricarica la pagina.");
  return { chiave, valore, cambiato: true };
}

export const eseguiInterruttori = async (azione: string, corpo: Record<string, unknown>, chi: string, d: PorteInterruttori) => {
  if (azione !== "interruttore_imposta") throw rifiuta("azione_sconosciuta", 400, "Questa azione non è prevista."); // mai un'azione di ripiego
  return imposta(corpo, chi, d);
};

/** L'elenco degli interruttori `chiavi` come li vede la schermata: valore, versione, chi (`null` se la riga non c'è: seme non applicato). */
async function fotografia(d: PorteInterruttori, chiavi: string[]) {
  const r = righe(dati(d, "lettura", await d.db.from("shop_impostazioni").select("chiave, valore, aggiornato_il, aggiornato_da").limit(100)));
  return Object.fromEntries(
    chiavi.map((k) => {
      const x = r.find((y) => y.chiave === k);
      return [k, { valore: x?.valore ?? null, aggiornatoIl: x?.aggiornato_il ?? null, aggiornatoDa: x?.aggiornato_da ?? null }];
    }),
  );
}

/** `GET ?cassa`: gli interruttori della cassa, le condizioni per accendere `stripe`, e se «pagamento sicuro» si può accendere.
 *  `ambiente` dice solo presente/assente (mai i valori): si copiano i booleani noti, non si spalma ciò che passa la porta. */
async function leggiCassa(d: PorteInterruttori) {
  const interruttori = await fotografia(d, CHIAVI_CASSA);
  let fatti: FattiEsterni | null = null;
  try {
    fatti = await d.fattiEsterni();
  } catch {
    d.log("fatti");
  }
  const f = fatti ?? {};
  return {
    interruttori,
    // come per il catalogo: se i fatti non si leggono, lo stato dell'interruttore arriva lo stesso, con le condizioni vuote («non si può accendere») e un avviso
    condizioni: fatti
      ? condizioniCassa(f)
      : { puoAccendere: false, righe: [], avviso: "Non riesco a controllare le condizioni ora: riprova tra un momento." },
    puoAccendereSicuro: f.pagamentoIncassa === true,
    ambiente: { chiavePresente: f.chiavePresente === true, segretoPresente: f.segretoPresente === true, tariffaAttiva: f.tariffaAttiva === true, s4Presente: f.s4Presente === true },
  };
}

export const gestisciGET = (request: Request, d: PorteInterruttori): Promise<Response> =>
  gestisci(request, d, async () => {
    const p = new URL(request.url).searchParams;
    if (p.has("cassa")) return leggiCassa(d);
    if (!p.has("interruttori")) throw rifiuta("azione_sconosciuta", 400, "Questa lettura non è prevista.");
    const interruttori = await fotografia(d, CHIAVI_CATALOGO);
    // Chiudere lo shop non deve mai dipendere dalle condizioni: se le loro query falliscono, lo stato aperto/chiuso arriva lo stesso,
    // con le condizioni vuote (lo shop non si può aprire) e un avviso. Nessun testo dell'errore.
    const cond = await condizioni(d).catch(() => {
      d.log("condizioni");
      return { puoAprire: false, righe: [], avviso: "Non riesco a controllare le condizioni ora: riprova tra un momento." };
    });
    return { interruttori, condizioni: cond };
  });

export const gestisciPOST = (request: Request, d: PorteInterruttori): Promise<Response> =>
  gestisci(request, d, async (chi) => {
    const corpo = await leggiCorpo(request);
    return eseguiInterruttori(azioneDi(corpo, AZIONI_INTERRUTTORI), corpo, chi, d);
  });
