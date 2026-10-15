/** ── DOVE STANNO LE CAMERE DEL CONSULENTE ──────────────────────────────────
 *
 *  Segnalazione del titolare (15/10/2026): «quando metto l'opzione
 *  videochiamata, in basso non ci sono i pulsanti di controllo. Quelli devono
 *  esserci sempre, in qualsiasi modalità».
 *
 *  ⚠️ PERCHÉ UNA REGOLA SOLA. Le camere possono stare in cinque posti — a
 *   tutta pagina, nella colonna a destra, sopra il copione, in una finestra
 *   staccata, chiuse — e ognuno era deciso da una condizione scritta a parte
 *   nel disegno. Aggiungendo «Camere grandi» (schermo intero della pagina, con
 *   le barre) due condizioni potevano essere vere insieme e le camere
 *   comparivano due volte. Qui ne esce sempre una sola.
 *
 *  L'ORDINE CONTA: chiuse a mano vince su tutto (la linguetta per riaprirle
 *   resta); poi «Camere grandi», scelta esplicita del consulente; poi il
 *   copione aperto; poi la videochiamata pulita dove si conduce; il resto in
 *   colonna.
 *  ───────────────────────────────────────────────────────────────────────── */

export type Veste = "pagina" | "colonna" | "copione" | "finestra" | "chiuse";

export function vesteCamere(p: {
  mode: "content" | "call" | "presenter" | "client";
  /** Il consulente sta condividendo lo schermo. */
  sharing: boolean;
  /** Il teleprompter (il copione) è aperto. */
  tele: boolean;
  /** Le camere sono state estratte dal copione in una finestra. */
  undocked: boolean;
  /** Le camere sono state chiuse a mano. */
  camClosed: boolean;
  /** «Riduci a lato» premuto in videochiamata. */
  lato: boolean;
  /** Siamo dove la consulenza si conduce (non sul gestionale). */
  inConsulenza: boolean;
  /** «Camere grandi · solo per te» acceso. */
  grandi: boolean;
}): Veste {
  if (p.camClosed) return "chiuse";
  if (p.grandi) return "pagina";
  if (p.tele) return p.undocked ? "finestra" : "copione";
  if (p.mode === "call" && !p.sharing && !p.lato && p.inConsulenza) return "pagina";
  return "colonna";
}
