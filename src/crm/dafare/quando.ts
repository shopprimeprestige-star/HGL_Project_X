/** ── IL «QUANDO» DELLA PAGINA «DA FARE OGGI» ───────────────────────────────
 *
 *  Le date e le ore di questa pagina si leggono, si ripuliscono e si dicono in
 *  italiano tutte da qui. Non disegna niente e non tocca il database: è
 *  vocabolario puro, e sta in un file suo per due motivi.
 *
 *  Il primo è che adesso le cose scritte a mano hanno un GIORNO scelto da chi
 *  scrive, e non più la data di oggi messa d'ufficio: dal momento in cui una
 *  data la digita una persona, «2026-02-31» e «0226-08-15» diventano casi
 *  reali, e vanno fermati in un posto solo (`dataPulita`) invece che in tre
 *  punti diversi con tre idee diverse di cosa sia una data.
 *
 *  Il secondo è che «domani» e «era per giovedì 21 agosto» sono la stessa frase
 *  che il CRM dice già altrove: nel riquadro di conferma del richiamo
 *  (crm/LeadDialog.tsx) e nella procedura guidata del «quando»
 *  (crm/QuickStatusDialog.tsx). Là dentro sono due copie private e identiche
 *  della stessa funzione; questa è la terza, ed è la prima esportata. Chi un
 *  giorno metterà mano a quei due file cancelli le sue e importi queste: la
 *  frase con cui il centro dice una data deve essere una sola, altrimenti fra
 *  un anno la stessa scadenza si legge in tre modi.
 *
 *  ⚠️ NIENTE UTC, MAI. Le date del CRM sono stringhe locali ("2026-08-15",
 *   "09:30") e si confrontano fra loro solo se nascono dallo stesso orologio:
 *   `toISOString()` d'estate, dopo le 22, restituisce già il giorno dopo — e
 *   una nota scritta la sera per «domani» finirebbe fra le cose di oggi. È la
 *   stessa regola, con le stesse parole, di `oggiIso` in crm/ui.tsx.
 *  ───────────────────────────────────────────────────────────────────────── */

import { oggiIso } from "@/crm/ui";

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_ORA = /^\d{1,2}:\d{2}$/;

/** ── MEZZOGIORNO, SEMPRE ───────────────────────────────────────────────────
 *  Ogni conto fra giorni parte dalle 12:00 e non dalla mezzanotte. Nelle due
 *  notti dell'ora legale un giorno dura 23 o 25 ore: partendo da mezzanotte, la
 *  differenza fra due date consecutive diventa 0,96 o 1,04 giorni, e
 *  l'arrotondamento fa dire «oggi» a domani una volta l'anno. A mezzogiorno lo
 *  scarto di un'ora non arriva mai a spostare il conto. */
function aMezzogiorno(iso: string): Date | null {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ── UNA DATA VERA, O NIENTE ───────────────────────────────────────────────
 *  Restituisce "" quando non si legge, e «non si legge» comprende il caso che
 *  la forma inganna: "2026-02-31" passa qualunque espressione regolare ed è un
 *  giorno che non esiste. Il controllo è il giro completo — la si costruisce e
 *  la si riscrive: se il calendario l'ha spostata al 3 marzo, non era una data.
 *  Il "" non è un ripiego silenzioso: chi chiama deve trattarlo come «questa
 *  data non c'è» e dirlo, non fabbricarne una di comodo. */
export function dataPulita(v: unknown): string {
  const s = String(v ?? "")
    .trim()
    .slice(0, 10);
  if (!RE_DATA.test(s)) return "";
  const d = aMezzogiorno(s);
  if (!d) return "";
  return oggiIso(d) === s ? s : "";
}

/** L'ora ridotta alla forma con cui la confrontano tutte le date del CRM:
 *  "9:5" non è un orario, "09:05" sì. Restituisce stringa vuota quando non si
 *  legge, così chi la riceve tratta la riga come «senza un'ora» invece di
 *  fabbricare un momento che non esiste. */
export function oraPulita(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!RE_ORA.test(s)) return "";
  const [h, m] = s.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return "";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Il momento esatto di un giorno più un'ora, in millisecondi con l'orologio
 *  LOCALE. `null` quando manca l'ora: senza ora non c'è un momento, e quindi
 *  non c'è niente da annunciare né da contare alla rovescia.
 *  ⚠️ È la stessa funzione — e per gli stessi motivi — di `istante()` in
 *   crm/notifications/eventi-crm.ts, che però lì è privata. Se un giorno viene
 *   esportata, questa si cancella e si importa quella. */
export function istanteDi(data?: string | null, ora?: string | null): number | null {
  const giorno = dataPulita(data);
  const hhmm = oraPulita(ora);
  if (!giorno || !hhmm) return null;
  const ms = new Date(`${giorno}T${hhmm}:00`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Quanti giorni separano due date: negativo = la seconda è nel passato.
 *  `null` quando una delle due non si legge — e «non lo so» non è «oggi»: è la
 *  stessa correzione già fatta in crm/ui.tsx, dove restituire 0 aveva messo
 *  centinaia di date storte dentro il conto della giornata. */
export function giorniFra(da: string, a: string): number | null {
  const d1 = aMezzogiorno(dataPulita(da));
  const d2 = aMezzogiorno(dataPulita(a));
  if (!d1 || !d2) return null;
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
}

/** La data di fra N giorni, in forma locale. Costruita a mano e non con
 *  `toISOString()`: vedi la nota UTC in cima al file. */
export function fraGiorni(n: number, da: Date = new Date()): string {
  const d = new Date(da.getFullYear(), da.getMonth(), da.getDate());
  d.setDate(d.getDate() + n);
  return oggiIso(d);
}

const GIORNI_LUNGHI = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
];

const MESI_LUNGHI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** La data detta come si dice a voce: «giovedì 21 agosto, ore 15:30».
 *  Una data in cifre si legge ma non si CONTROLLA, e quello che si controlla
 *  mentre si sceglie è il giorno della settimana: «2026-09-08» e «2026-08-09»
 *  si somigliano abbastanza da passare inosservati. */
export function quandoInChiaro(data?: string | null, ora?: string | null): string {
  const giorno = dataPulita(data);
  if (!giorno) return "";
  const d = aMezzogiorno(giorno);
  if (!d) return giorno;
  const orario = oraPulita(ora);
  const etichetta = `${GIORNI_LUNGHI[d.getDay()]} ${d.getDate()} ${MESI_LUNGHI[d.getMonth()]}`;
  return orario ? `${etichetta}, ore ${orario}` : etichetta;
}

/** «domani», «fra 8 giorni», «3 giorni fa». La distanza è l'unica cosa che dice
 *  se la data scelta è quella giusta: «21 agosto» da solo non lo dice. */
export function distanzaInChiaro(data?: string | null, oggi: string = oggiIso()): string {
  const g = giorniFra(oggi, dataPulita(data));
  if (g === null) return "";
  if (g === 0) return "oggi";
  if (g === 1) return "domani";
  if (g === -1) return "ieri";
  return g > 0 ? `fra ${g} giorni` : `${-g} giorni fa`;
}

/** ── IL «QUANDO» SCRITTO SULLA RIGA ────────────────────────────────────────
 *  Restituisce "" per le righe di OGGI, ed è la scelta che tiene la lista
 *  leggibile: in una pagina che si chiama «Da fare oggi» scrivere «per oggi»
 *  sotto ogni riga è rumore su quaranta righe su quaranta. Si dice il giorno
 *  soltanto quando NON è quello che ci si aspetta — ed è esattamente il caso in
 *  cui, non dicendolo, la riga mentirebbe.
 *  Al passato si usa l'imperfetto («era per ieri»): dice in una parola che il
 *  momento è passato e che la cosa è ancora lì. */
export function quandoDellaRiga(giorno: string, ora: string, oggi: string): string {
  const g = giorniFra(oggi, giorno);
  if (g === null || g === 0) return "";
  const orario = oraPulita(ora);
  const coda = orario ? `, ore ${orario}` : "";
  //  Ieri e domani hanno un nome: «per martedì 17 agosto» quando martedì è
  //  domani fa fare un conto per sapere una cosa che si può dire in una parola.
  if (g === 1) return `per domani${coda}`;
  if (g === -1) return `era per ieri${coda}`;
  const perEsteso = quandoInChiaro(giorno, ora);
  return g > 0 ? `per ${perEsteso} · fra ${g} giorni` : `era per ${perEsteso} · ${-g} giorni fa`;
}
