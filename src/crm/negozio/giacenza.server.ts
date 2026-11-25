/** ── LA GIACENZA DEL CMS: IL SERVER (giacenza.server.ts) ────────────────────
 *  Commessa 2026-11-20-shop-completo (T09), PIANO D7 e §3.3.
 *  Azioni: `giacenza_muovi { varianteId, delta, motivo, nota? }` e `giacenza_imposta { varianteId, valore, motivo? }`.
 *
 *  ⚠️ La giacenza si muove SOLO con le funzioni SQL di S1 (`shop_giacenza_muovi`, `shop_giacenza_imposta`): blocco di
 *   riga, mai sotto zero, riga di movimento nella stessa transazione, `chi` e `giacenza_dopo` sempre. Qui non c'è nessuna
 *   scrittura diretta su `shop_varianti` né su `shop_giacenza_movimenti` (una prova lo controlla nel sorgente).
 *  ⚠️ Delta 0 (e «imposta» allo stesso numero) NON è un errore: S1 risponde con la giacenza di ora e non scrive niente.
 *  I motivi del CMS sono tre (`carico`, `rettifica`, `reso`): «ordine» e «annullo_ordine» sono dell'ordine vero. */
import { applicaMovimento } from "@/shop/cms/giacenza";
import { azioneDi, dati, eMancante, eOggetto, eUuid, gestisci, guasto, leggiCorpo, notaDi, rifiuta, senzaMigrazione, type EsitoDb, type PorteDb } from "./comune";

export const AZIONI_GIACENZA = ["giacenza_muovi", "giacenza_imposta"] as const;
const MOTIVI = ["carico", "rettifica", "reso"];
/** Un tetto per pezzi e movimenti: sta dentro un `integer` di Postgres e nessun errore tecnico arriva al titolare. */
const MAX_PEZZI = 1_000_000;
const FRASE_QUANTITA = `La quantità deve essere un numero intero, senza virgole (al massimo ${MAX_PEZZI.toLocaleString("it-IT")}).`;

const varianteDi = (x: unknown): string => {
  if (!eUuid(x)) throw rifiuta("valore", 400, "La variante indicata non è valida.");
  return x;
};
const motivoDi = (x: unknown, predefinito?: string): string => {
  const m = x === undefined && predefinito ? predefinito : x;
  if (typeof m !== "string" || !MOTIVI.includes(m)) throw rifiuta("valore", 400, "Il motivo deve essere carico, rettifica o reso.");
  return m;
};
const interoDi = (x: unknown, minimo: number): number => {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < minimo || x > MAX_PEZZI) throw rifiuta("valore", 400, FRASE_QUANTITA);
  return x;
};

/** La giacenza di dopo, come l'ha risposta il database. */
function giacenzaDopo(d: PorteDb, dove: string, r: EsitoDb): number {
  const n = dati(d, dove, r);
  if (typeof n !== "number" || !Number.isSafeInteger(n)) throw guasto(d, dove, { code: "risposta" });
  return n;
}

/** Il database ha rifiutato il movimento: dire perché, con parole da persona. `delta` = di quanto si voleva muovere. */
async function rifiutoDelMovimento(d: PorteDb, varianteId: string, delta: number, r: EsitoDb) {
  const codice = String(r.error?.code ?? "");
  const messaggio = String(r.error?.message ?? "");
  if (codice === "P0002") return rifiuta("variante_inesistente", 404, "Questa variante non esiste più: ricarica la pagina.");
  if (messaggio.includes("giacenza_negativa")) {
    // un solo controllo in più, solo per scrivere la frase: quanti ce ne sono ora
    let frase = "La giacenza è cambiata nel frattempo e non basta più: ricarica e riprova.";
    try {
      const l = await d.db.from("shop_varianti").select("giacenza").eq("id", varianteId).limit(1);
      const attuale = Array.isArray(l.data) && eOggetto(l.data[0]) ? l.data[0].giacenza : null;
      const verifica = applicaMovimento(attuale, delta);
      if (!verifica.ok && verifica.motivo === "giacenza_negativa") frase = verifica.frase;
    } catch {
      /* resta la frase generica */
    }
    return rifiuta("giacenza_negativa", 409, frase);
  }
  if (eMancante(r.error)) return senzaMigrazione();
  return guasto(d, "movimento", r.error);
}

export async function eseguiGiacenza(
  azione: string,
  corpo: Record<string, unknown>,
  chi: string,
  d: PorteDb,
): Promise<Record<string, unknown>> {
  // azione non riconosciuta: un rifiuto esplicito, mai un'azione di ripiego
  if (azione !== "giacenza_muovi" && azione !== "giacenza_imposta") throw rifiuta("azione_sconosciuta", 400, "Questa azione non è prevista.");
  const variante = varianteDi(corpo.varianteId);
  if (azione === "giacenza_muovi") {
    const delta = interoDi(corpo.delta, -MAX_PEZZI);
    const motivo = motivoDi(corpo.motivo);
    const nota = notaDi(corpo.nota);
    const r = await d.db.rpc("shop_giacenza_muovi", { p_variante: variante, p_delta: delta, p_motivo: motivo, p_nota: nota, p_chi: chi, p_ordine_ref: null });
    if (r.error) throw await rifiutoDelMovimento(d, variante, delta, r);
    return { giacenza: giacenzaDopo(d, "muovi", r), cambiato: delta !== 0 };
  }
  // giacenza_imposta: il valore assoluto dalla lista; il delta lo calcola il database sotto blocco
  const valore = interoDi(corpo.valore, 0);
  const motivo = motivoDi(corpo.motivo, "rettifica");
  const r = await d.db.rpc("shop_giacenza_imposta", { p_variante: variante, p_nuovo: valore, p_motivo: motivo, p_chi: chi });
  if (r.error) throw await rifiutoDelMovimento(d, variante, 0, r);
  return { giacenza: giacenzaDopo(d, "imposta", r) };
}

/** `POST` con la sola azione di giacenza (la rotta di T10 può anche chiamare `eseguiGiacenza` dopo aver letto il corpo). */
export function gestisciPOST(request: Request, d: PorteDb): Promise<Response> {
  return gestisci(request, d, async (chi) => {
    const corpo = await leggiCorpo(request);
    return eseguiGiacenza(azioneDi(corpo, AZIONI_GIACENZA), corpo, chi, d);
  });
}
