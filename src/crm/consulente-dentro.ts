/** ── CHI È DENTRO, E QUANTO PUÒ GUARDARE DEGLI ALTRI (31/10/2026) ────────────
 *  Richiesta del titolare: il prossimo meet e le cose da fare sono quelli del consulente che ha
 *  fatto l'accesso, non quelli degli altri; il titolare, che entra con email e password e non è
 *  nessun consulente, vede tutto e sceglie dal menu.
 *
 *  NESSUNA MAPPATURA NUOVA. Chi è dentro lo dice `useConsulenteCollegato()` (il consulente che ha
 *  digitato il PIN: stesso id di `lead.data.consulenteId` e di `consultants[].id`); se è admin lo
 *  dice `accesso.ruolo`; se fa consulenze lo dice `faConsulenze(puo)` (permessi.ts), la stessa
 *  domanda della porta d'ingresso e di «Oggi». Qui si mettono insieme le tre risposte, in un
 *  posto solo, così la barra del meet e il pannello «Oggi» non possono decidere in modo diverso.
 *
 *  ⚠️ COME TUTTO IL CRM, NASCONDE E NON DIFENDE: la lista dei lead arriva intera al browser. È
 *   un filtro dell'interfaccia (vedi anche la nota in vista-oggi.ts).
 *  Provato in prove/idee/oggi-del-consulente.mjs. */

export interface ConsulenteDentro {
  /** Il consulente da mostrare; `""` = tutti. */
  id: string;
  /** true = non può guardare quelli degli altri (il menu non c'è). */
  bloccato: boolean;
}

export function consulenteDelloSchermo({
  collegatoId,
  admin,
  faConsulenze,
}: {
  collegatoId?: string | null;
  admin: boolean;
  faConsulenze: boolean;
}): ConsulenteDentro {
  const id = String(collegatoId ?? "").trim();
  //  Senza PIN (titolare) o senza consulenze (setter: nessun meet è «suo»): tutti, com'era.
  //  L'admin, anche col PIN, parte su TUTTI (richiesta del titolare, 31/10/2026: «anche io vedo
  //  solo i miei meet. Correggi»): sceglie lui dal menu se vuole vedere un consulente solo.
  if (!id || !faConsulenze || admin) return { id: "", bloccato: false };
  return { id, bloccato: true };
}

/** Il consulente da usare davvero. `scelto` è quel che l'utente ha toccato nel menu: `null` =
 *  non ha toccato niente (si parte su di lui), `""` = «Tutti». Se è bloccato la scelta non conta. */
export function chiVale(dentro: ConsulenteDentro, scelto: string | null): string {
  if (dentro.bloccato) return dentro.id;
  return scelto ?? dentro.id;
}
