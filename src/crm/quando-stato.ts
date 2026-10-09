/** ── DA QUANDO UNA SCHEDA È IN QUESTO STATO ────────────────────────────────
 *
 *  Richiesta del committente: «se chiamo e metto segreteria su un lead nuovo
 *  dev'essere categorizzato nel giorno corretto, e il giorno dopo devo poter
 *  filtrare per quando ho messo quello stato».
 *
 *  Il dato c'è già e lo scrive `updateLead` (crm/CRMContext) a ogni cambio:
 *  `statoPrecedenteIl`, l'ISTANTE in cui la scheda è entrata nello stato in cui
 *  si trova adesso. Quello che mancava è leggerlo bene, e poterci filtrare.
 *
 *  ── ⚠️ L'ISTANTE È IN UTC, IL GIORNO DI LAVORO NO ────────────────────────
 *  `new Date().toISOString()` scrive l'ora di Greenwich. Tagliarne i primi
 *  dieci caratteri — come si fa con i campi che sono GIÀ un giorno, tipo
 *  `dataRicontatto` — dà il giorno SBAGLIATO per tutta la fascia in cui in
 *  Italia è già domani e a Greenwich no: un «segreteria» segnato all'una di
 *  notte finiva catalogato il giorno prima, e la mattina dopo non compariva
 *  fra quelli di ieri né fra quelli di oggi. È lo stesso motivo per cui in
 *  questo progetto il giorno di oggi non si ricava mai da `toISOString`
 *  (vedi `giornoISO` in crm/InstallationScheduleDialog).
 *  Qui l'istante si converte nel giorno LOCALE, che è quello in cui la
 *  telefonata è stata fatta davvero.
 *
 *  ── ⚠️ CHI NON È MAI STATO TOCCATO ───────────────────────────────────────
 *  Una lista appena importata non ha nessun cambio di stato: quelle schede sono
 *  «da contattare» da quando sono arrivate, e il giorno giusto è quello
 *  dell'importazione (`createdAt`). Rispondere «non si sa» le farebbe sparire
 *  da ogni filtro sul tempo — cioè proprio dalle liste nuove, che sono la
 *  maggioranza di questa pagina.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il giorno LOCALE di un istante ISO, come «2026-09-22». Vuoto se illeggibile.
 *  ⚠️ Accetta anche un valore che è già un giorno («2026-09-22»): in quel caso
 *   lo restituisce com'è, senza passare da `Date` — una data senza ora viene
 *   letta come mezzanotte UTC, e in Italia mezzanotte UTC è il giorno prima. */
export function giornoLocale(iso: string | undefined | null): string {
  const t = String(iso ?? "").trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const gg = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${gg}`;
}

/** Il giorno in cui questa scheda è entrata nello stato in cui si trova ora.
 *  Vuoto solo se non si sa proprio niente. */
export function giornoDelloStato(
  d: { statoPrecedenteIl?: string; createdAt?: string } | undefined | null,
): string {
  return giornoLocale(d?.statoPrecedenteIl) || giornoLocale(d?.createdAt);
}

/** Le fette di tempo con cui si guarda una coda. L'ordine è quello in cui si
 *  premono: prima «sempre», poi il giro di oggi, poi quello di ieri, poi la
 *  settimana — che è il passo con cui si recupera l'arretrato. */
export type FettaTempo = "sempre" | "oggi" | "ieri" | "settimana";

export const FETTE_TEMPO: FettaTempo[] = ["sempre", "oggi", "ieri", "settimana"];

export const NOME_FETTA_TEMPO: Record<FettaTempo, string> = {
  sempre: "Sempre",
  oggi: "Oggi",
  ieri: "Ieri",
  settimana: "Ultimi 7 giorni",
};

export const SPIEGA_FETTA_TEMPO: Record<FettaTempo, string> = {
  sempre: "Tutta la coda, da qualunque giorno",
  oggi: "Quelli a cui hai messo questo stato oggi",
  ieri: "Quelli di ieri: il giro rimasto a metà",
  settimana: "Gli ultimi sette giorni, oggi compreso",
};

/** Quanti giorni fa, rispetto a `oggi`. `null` se una delle due non si legge.
 *  ⚠️ Si conta sui GIORNI, non sulle ore: due istanti a otto ore di distanza
 *   possono stare in due giorni diversi, ed è il giorno che si guarda quando si
 *   riprende un giro il mattino dopo. */
export function giorniFa(giorno: string, oggi: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno) || !/^\d{4}-\d{2}-\d{2}$/.test(oggi)) return null;
  const a = Date.parse(`${giorno}T12:00:00Z`);
  const b = Date.parse(`${oggi}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Vero se lo stato di questa scheda è stato messo dentro la fetta scelta.
 *  ⚠️ «sempre» dice sì anche a chi non ha nessuna data: è l'unica risposta
 *   onesta — una scheda di cui non si sa niente non va nascosta dal filtro che
 *   dichiara di non filtrare. Le altre fette invece la escludono: «oggi» deve
 *   voler dire oggi, non «oggi e quelli che non sappiamo». */
export function dentroLaFetta(
  d: { statoPrecedenteIl?: string; createdAt?: string } | undefined | null,
  fetta: FettaTempo,
  oggi: string,
): boolean {
  if (fetta === "sempre") return true;
  const quanti = giorniFa(giornoDelloStato(d), oggi);
  if (quanti === null) return false;
  if (fetta === "oggi") return quanti === 0;
  if (fetta === "ieri") return quanti === 1;
  //  ⚠️ Oggi compreso, e niente futuro: una data avanti nel tempo è un dato
  //   storto (un orologio indietro, un importo con la data sbagliata) e dentro
  //   «ultimi sette giorni» non ci sta.
  return quanti >= 0 && quanti <= 6;
}
