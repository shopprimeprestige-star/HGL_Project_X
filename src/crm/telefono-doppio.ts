/** ── QUESTO NUMERO CE L'ABBIAMO GIÀ ────────────────────────────────────────
 *
 *  Richiesta del committente: «fai che se aggiungo un numero di telefono che
 *  già è presente nel CRM segna rosso il campo del numero, e si apre un popup
 *  per andare a vedere la scheda del lead».
 *
 *  ── PERCHÉ SERVE ─────────────────────────────────────────────────────────
 *  Lo stesso cliente che richiama dopo tre mesi, il modulo compilato due
 *  volte, il contatto passato da un collega: si crea una scheda nuova, e da
 *  quel momento la stessa persona ha due storie. Quella vecchia — con le note,
 *  i tentativi, il preventivo, l'appuntamento mancato — non la guarda più
 *  nessuno, perché nessuno sa che c'è. Chi scrive il numero è l'ultima persona
 *  che può accorgersene, ed è l'unico momento in cui costa zero.
 *
 *  ── COME SI RICONOSCE LO STESSO NUMERO ───────────────────────────────────
 *  Si confrontano le ULTIME NOVE CIFRE. Lo stesso telefono, in archivio, può
 *  essere scritto in almeno sei modi:
 *      339 1234567 · +39 339 1234567 · 0039 339 1234567 · 3391234567
 *      +39-339-1234567 · 39 339 1234567
 *  Le ultime nove cifre sono uguali in tutti e sei (un cellulare italiano ha
 *  dieci cifre: nove bastano a distinguere e sopravvivono allo zero iniziale
 *  dei fissi scritto a volte sì e a volte no). È la stessa regola che usa già
 *  l'importazione delle installazioni, e due regole diverse di «stesso numero»
 *  nello stesso programma sono il modo di avere due archivi che non
 *  coincidono.
 *
 *  ⚠️ SOTTO LE SEI CIFRE NON SI DICE NIENTE. Mentre si scrive, un numero
 *   lungo tre cifre somiglia a mezzo archivio: segnare rosso al terzo tasto
 *   vuol dire un campo rosso che non significa niente, e dopo due volte non lo
 *   guarda più nessuno.
 *  ⚠️ LA SCHEDA NON SI CONFRONTA CON SÉ STESSA: aprendo un lead esistente il
 *   suo numero è già in archivio, ed è il suo. Senza `escludiId` ogni scheda
 *   aperta si dichiarerebbe doppia di sé.
 *  ⚠️ QUI NON SI DECIDE NIENTE E NON SI BLOCCA NIENTE: si dice soltanto «c'è
 *   già, è questa». Due persone possono davvero condividere un numero (madre e
 *   figlia, marito e moglie, il centralino di un'azienda): impedire di salvare
 *   sarebbe un programma che sa meglio di chi ha la persona al telefono.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il minimo che serve sapere di una scheda per riconoscerla. */
export interface SchedaConTelefono {
  id: string;
  data?: { telefono?: string | null; nome?: string | null; cognome?: string | null; stato?: string | null } | null;
}

/** Quante cifre servono prima di dire qualcosa. */
export const CIFRE_MINIME = 6;

/** Le ultime nove cifre: è l'impronta del numero, qualunque modo abbia chi
 *  l'ha scritto. Stringa vuota = non c'è abbastanza per dire niente. */
export function chiaveTelefono(t?: string | null): string {
  const cifre = String(t ?? "").replace(/\D/g, "");
  if (cifre.length < CIFRE_MINIME) return "";
  return cifre.slice(-9);
}

/** Lo stesso numero, scritto in due modi qualunque? */
export function stessoNumero(a?: string | null, b?: string | null): boolean {
  const x = chiaveTelefono(a);
  return !!x && x === chiaveTelefono(b);
}

/** Le schede che hanno già questo numero. Vuoto = è nuovo (o non si può ancora
 *  dire).
 *  ⚠️ L'ORDINE È QUELLO DELL'ELENCO, e chi chiama mostra la PRIMA: è la più
 *   vecchia, cioè quella che ha la storia dentro. */
export function schedeConLoStessoNumero<T extends SchedaConTelefono>(p: {
  telefono?: string | null;
  schede?: T[] | null;
  /** La scheda che si sta scrivendo: non è doppia di sé stessa. */
  escludiId?: string | null;
}): T[] {
  const chiave = chiaveTelefono(p.telefono);
  if (!chiave) return [];
  const io = String(p.escludiId || "");
  return (p.schede ?? []).filter(
    (l) => l && l.id !== io && chiaveTelefono(l.data?.telefono) === chiave,
  );
}

/** Che cosa dire sotto al campo rosso. Vuoto = non c'è niente da dire. */
export function avvisoDoppione(quante: number, nome?: string | null): string {
  if (quante <= 0) return "";
  const chi = String(nome || "").trim() || "una scheda senza nome";
  return quante === 1
    ? `Questo numero ce l'ha già ${chi}.`
    : `Questo numero ce l'hanno già ${quante} schede, la prima è ${chi}.`;
}
