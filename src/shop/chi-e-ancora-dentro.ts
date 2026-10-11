/** ── CHI SE N'È ANDATO NON STA PIÙ NEL PANNELLO ────────────────────────────
 *
 *  Segnalazione del committente, con la schermata del pannello «Cosa vede il
 *  cliente» sotto gli occhi: «se l'utente non c'è più in consulenza deve
 *  essere rimosso anche dalla lista degli utenti».
 *
 *  ── PERCHÉ RESTAVA LÌ ────────────────────────────────────────────────────
 *  Le persone del pannello arrivano dall'elenco degli ATTESI della stanza
 *  (api.presenter.sala-attesa), che è un elenco scritto in archivio: ci finisce
 *  chi era in agenda, e — da quando una consulenza si apre anche mandando un
 *  link — anche chi entra scrivendo il proprio nome alla porta, che viene
 *  registrato come persona della stanza (api.presenter.atteso-ospite).
 *  Quell'elenco non si accorcia mai. Uno che entra, parla dieci minuti e
 *  chiude, resta scritto lì: la sua riga continua a occupare il pannello, con
 *  il suo selettore «Segue me / Il suo» che comanda lo schermo di nessuno.
 *
 *  ── LA REGOLA ────────────────────────────────────────────────────────────
 *  Sparisce chi È STATO DENTRO E ADESSO NON C'È PIÙ. Le tre parti contano
 *  tutte:
 *   · CHI NON È MAI ENTRATO RESTA. È il cliente dell'appuntamento che deve
 *     ancora arrivare: la sua riga dice «non entrato», ed è l'unica cosa che
 *     il consulente vuole vedere mentre lo aspetta. Toglierlo vorrebbe dire
 *     cancellare la sala d'attesa.
 *   · CHI È DENTRO ADESSO RESTA, ovviamente.
 *   · CHI ERA DENTRO E NON C'È PIÙ se ne va, ma solo dopo un minuto di
 *     assenza. ⚠️ SENZA LA GRAZIA SI TOGLIE CHI STA RICARICANDO LA PAGINA:
 *     chiudendo la scheda il cliente manda «bye» e sparisce dall'elenco
 *     nell'istante stesso, e una ricarica è indistinguibile da un'uscita per
 *     i primi secondi. Un minuto è largo per una ricarica e breve abbastanza
 *     perché il pannello non racconti una bugia.
 *
 *  ⚠️ NON SI CANCELLA NIENTE DALL'ARCHIVIO. Qui si decide solo che cosa
 *   MOSTRARE. L'elenco degli attesi è anche l'identità del cliente — la sua
 *   pagina ci si riconosce dentro per sapere qual è la sua stanza di
 *   preventivo (`personaDaAdottare`) — e cancellare una riga per un'assenza
 *   mal misurata vorrebbe dire spostargli il preventivo sotto le mani mentre
 *   lo compila. Se torna, la riga ricompare da sé: basta che si rifaccia vivo.
 *  ⚠️ CHI NON HA UNA SCHEDA NON SI TOGLIE MAI: quelle righe nascono dai
 *   riquadri di chi è collegato ADESSO (`personeDelPannello`), quindi
 *   esistono solo finché la persona c'è. Filtrarle di nuovo qui vorrebbe dire
 *   toglierle due volte, e con una memoria che non le riguarda.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Da quanto deve mancare una persona prima di sparire dal pannello. */
export const GRAZIA_USCITA_MS = 60_000;

/** Quando ciascuno è stato visto in linea l'ultima volta (leadId → istante). */
export type MemoriaPresenze = Record<string, number>;

/** Segna chi c'è adesso. Torna una memoria NUOVA se qualcosa è cambiato, e
 *  quella di prima se non è cambiato niente: così chi la tiene in una variabile
 *  di stato non ridisegna il pannello a ogni giro. */
export function segnaChiCÈ(
  memoria: MemoriaPresenze | null | undefined,
  inLinea: string[] | null | undefined,
  adesso = Date.now(),
): MemoriaPresenze {
  const vecchia = memoria ?? {};
  const chi = (inLinea ?? []).map((x) => String(x || "").trim()).filter(Boolean);
  if (!chi.length) return vecchia;
  const nuova = { ...vecchia };
  for (const id of chi) nuova[id] = adesso;
  return nuova;
}

/** È stato dentro e adesso non c'è più (da abbastanza tempo da non essere una
 *  ricarica)? */
export function seNeÈAndato(p: {
  leadId?: string | null;
  memoria?: MemoriaPresenze | null;
  /** Chi è collegato adesso. `null`/`undefined` = non si sa: non si toglie nessuno. */
  inLinea?: string[] | null;
  /** ── ⚠️ QUANTI COLLEGATI NON SI SANNO RICONOSCERE ────────────────────
   *  Un cliente la cui scheda è aperta da prima di un aggiornamento non
   *  annuncia il proprio gettone: si vede il suo riquadro e non si sa chi è.
   *  Finché in stanza c'è anche UNO così, «quella persona non c'è più» non è
   *  una cosa che si può dire — potrebbe essere proprio lui. Si aspetta che
   *  la stanza sia fatta di gente riconosciuta, e allora si decide. */
  ignoti?: number;
  adesso?: number;
  grazia?: number;
}): boolean {
  const id = String(p.leadId || "").trim();
  if (!id) return false;
  //  Non si sa chi c'è: una finestra del preventivo aperta fuori dalla
  //  consulenza non può saperlo, e togliere righe al buio è peggio che
  //  lasciarle.
  if (!p.inLinea) return false;
  if ((p.ignoti ?? 0) > 0) return false;
  if (p.inLinea.includes(id)) return false;
  const visto = p.memoria?.[id];
  //  Mai visto dentro: è ancora atteso, non è andato via.
  if (!visto) return false;
  return (p.adesso ?? Date.now()) - visto > (p.grazia ?? GRAZIA_USCITA_MS);
}

/** Le persone del pannello, meno chi se n'è andato. */
export function ancoraDentro<T extends { leadId?: string | null; senzaScheda?: boolean }>(
  persone: T[] | null | undefined,
  p: { memoria?: MemoriaPresenze | null; inLinea?: string[] | null; ignoti?: number; adesso?: number; grazia?: number },
): T[] {
  return (persone ?? []).filter(
    (x) => x.senzaScheda || !seNeÈAndato({ ...p, leadId: x.leadId }),
  );
}
