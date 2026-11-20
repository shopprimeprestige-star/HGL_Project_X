/** ── GLI INTERRUTTORI DEL CATALOGO: IL SERVER (interruttori.server.ts) ──────
 *  Commessa 2026-11-20-shop-completo (T09), PIANO D8, D26 e §3.3.
 *
 *  GET  ?interruttori                                     → `{ ok, interruttori, condizioni }`
 *  POST { azione: "interruttore_imposta", chiave, valore, atteso }
 *       · `catalogo_sito`: `codice` | `cms`   (`cms` = «apri lo shop al pubblico»)
 *       · `giacenza_bassa`: intero da 0 a 9999 (0 = nessun avviso)
 *
 *  ── LE REGOLE ───────────────────────────────────────────────────────────────
 *  · Si scrive SOLO con `shop_impostazione_imposta` (confronto-e-scambio sul valore ATTESO, la riga di storico la scrive
 *    il database nella stessa transazione). Nessuna scrittura diretta su `shop_impostazioni` né su `shop_storico`.
 *  · `atteso` è il valore che la schermata aveva davanti: se non è più quello → 409 col valore vero.
 *  · D26: `cms` si accende solo se `condizioniUscita` dice `puoAprire`; la risposta di rifiuto porta tutte le righe.
 *    `codice` si accetta SEMPRE e per chiudere il cancello non si valuta nemmeno (tornare indietro è un clic).
 *  · Non si creano chiavi nuove: se il seme di S1 manca, 404.
 *  · I fatti che stanno fuori dal database (banner, e dal R2 pagamento, spedizioni, email, M2) arrivano dalla porta
 *    `fattiEsterni`, che la rotta collega: un fatto non passato è «non ancora valutabile» e vale «no». */
import { condizioniUscita, type StatoCancello } from "./cancello";
import { azioneDi, conflitto, dati, eMancante, gestisci, guasto, leggiCorpo, rifiuta, righe, senzaMigrazione, type PorteDb } from "./comune";

export const AZIONI_INTERRUTTORI = ["interruttore_imposta"] as const;
const MAX_SOGLIA = 9999;

export type FattiEsterni = Omit<StatoCancello, "pubblicati" | "conFotoPrincipale">;
export interface PorteInterruttori extends PorteDb {
  /** Ciò che il database non sa: il banner dei cookie c'è? e, dal R2, pagamento, spedizioni, email, M2. */
  fattiEsterni: () => FattiEsterni | Promise<FattiEsterni>;
}

/** Per ogni interruttore: quali valori sono ammessi e la frase se non lo sono. */
const REGOLE: Record<string, { valido: (v: unknown) => boolean; frase: string }> = {
  catalogo_sito: { valido: (v) => v === "codice" || v === "cms", frase: "Il catalogo del sito può essere solo «codice» o «cms»." },
  giacenza_bassa: { valido: (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= MAX_SOGLIA, frase: `La soglia di giacenza bassa è un numero intero da 0 a ${MAX_SOGLIA} (0 = nessun avviso).` },
};
const CHIAVI = Object.keys(REGOLE);

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
  if (!r.length) throw rifiuta("non_trovato", 404, "Questo interruttore non esiste nel database: manca il seme della migrazione del catalogo.");
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
  if (corrente !== atteso) throw conflitto("Questo interruttore è stato cambiato da qualcun altro nel frattempo: ricarica la pagina.", { valore: corrente });
  if (corrente === valore) return { chiave, valore, cambiato: false };

  if (chiave === "catalogo_sito" && valore === "cms") {
    const e = await condizioni(d);
    if (!e.puoAprire)
      throw rifiuta("cancello", 409, `Lo shop non si può ancora aprire. ${e.righe.filter((x) => !x.ok).map((x) => x.frase).join(" ")}`, { condizioni: e });
  }

  const r = await d.db.rpc("shop_impostazione_imposta", { p_chiave: chiave, p_atteso: atteso, p_nuovo: valore, p_chi: chi });
  if (r.error) throw eMancante(r.error) ? senzaMigrazione() : guasto(d, "scambio", r.error);
  if (r.data !== true) throw conflitto("Questo interruttore è stato cambiato da qualcun altro nel frattempo: ricarica la pagina.");
  return { chiave, valore, cambiato: true };
}

export const eseguiInterruttori = async (azione: string, corpo: Record<string, unknown>, chi: string, d: PorteInterruttori) => {
  if (azione !== "interruttore_imposta") throw rifiuta("azione_sconosciuta", 400, "Questa azione non è prevista."); // mai un'azione di ripiego
  return imposta(corpo, chi, d);
};

export const gestisciGET = (request: Request, d: PorteInterruttori): Promise<Response> =>
  gestisci(request, d, async () => {
    if (!new URL(request.url).searchParams.has("interruttori")) throw rifiuta("azione_sconosciuta", 400, "Questa lettura non è prevista.");
    const r = righe(dati(d, "lettura", await d.db.from("shop_impostazioni").select("chiave, valore, aggiornato_il, aggiornato_da").limit(100)));
    const interruttori = Object.fromEntries(
      CHIAVI.map((k) => {
        const x = r.find((y) => y.chiave === k);
        return [k, { valore: x?.valore ?? null, aggiornatoIl: x?.aggiornato_il ?? null, aggiornatoDa: x?.aggiornato_da ?? null }];
      }),
    );
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
