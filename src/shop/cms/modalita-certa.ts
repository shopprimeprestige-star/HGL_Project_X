/** ── LA MODALITÀ DEL CATALOGO, LETTA CON UN ESITO CHE DICE ANCHE «NON LO SO» ─
 *  Commessa 2026-11-20-shop-completo (T21, correzione dopo la revisione). Modulo PURO: il collegamento al database è
 *  nell'involucro `modalita-certa.functions.ts`, qui si ricevono le porte (così si prova con un finto database).
 *
 *  Perché esiste: `modalita()` di `catalogo.server.ts` risponde `codice` anche quando la lettura FALLISCE (un guasto non
 *  deve rompere la pagina), e per 5 secondi se lo ricorda. Va bene per mostrare una pagina, NON per decidere di
 *  togliere dal carrello le righe del catalogo CMS: un solo guasto momentaneo, con il catalogo ancora in memoria sano,
 *  le faceva sparire. Qui la risposta è `codice` SOLO se il database ha risposto, sano, con la riga che dice «codice».
 *  Ogni altra cosa (riga assente, valore strano, errore, rete, tabella non ancora creata) è `incerto`: le righe restano.
 *  ⚠️ Legge sempre dal database (nessuna memoria): si chiama solo quando il carrello ha righe CMS e il sito dice `codice`.
 *  ⚠️ Non lancia mai. Non scrive mai. Nel log niente: il chiamante non ha bisogno di sapere perché. */
import type { ClienteDb } from "./catalogo.server";

export type ModalitaCerta = "codice" | "cms" | "incerto";

export async function leggiModalitaCerta(porte: { db: ClienteDb; forza?: string | null }): Promise<ModalitaCerta> {
  // l'interruttore di emergenza vale come ovunque: «cms» o «codice» decidono, ogni altro valore si ignora
  if (porte.forza === "cms" || porte.forza === "codice") return porte.forza;
  try {
    const r = await porte.db.from("shop_impostazioni").select("valore").eq("chiave", "catalogo_sito").maybeSingle();
    if (r.error) return "incerto";
    const valore = (r.data as { valore?: unknown } | null)?.valore;
    return valore === "codice" || valore === "cms" ? valore : "incerto";
  } catch {
    return "incerto";
  }
}
