/** ─────────────────────────────────────────────────────────────────────────
 *  I BLOCCHI DELLA DISPONIBILITÀ — E LA LORO SCADENZA
 *
 *  Un blocco è tempo che non si può prenotare: una chiusura del centro, una
 *  riunione del lunedì mattina, un consulente in malattia per un mese.
 *  Sono una cosa diversa dagli orari di lavoro e vanno tenuti separati: gli
 *  orari dicono quando si è aperti in generale, i blocchi tolgono pezzi a
 *  quell'apertura per un motivo che ha una data di nascita e, quasi sempre,
 *  anche una di morte.
 *
 *  PERCHÉ ESISTE LA SCADENZA
 *  Un blocco temporaneo senza scadenza resta lì per sempre: sei mesi dopo
 *  nessuno ricorda perché il martedì mattina è chiuso, e nessuno se la sente
 *  di toglierlo. Con la scadenza il blocco si spegne DA SOLO nel giorno
 *  giusto — ma non si cancella: resta scritto, con il suo motivo, e si può
 *  riaccendere spostando la data in avanti.
 *
 *  DUE PORTATE
 *   · senza `consulenteId` → vale per TUTTI i consulenti (chiusura del centro);
 *   · con `consulenteId`   → vale solo per quella persona.
 *
 *  DOVE VIVONO
 *  In `app_config`, chiave `crm_blocchi_disponibilita`, come JSON. La tabella
 *  è già la casa delle configurazioni trasversali del CRM e non richiede una
 *  migrazione: i blocchi sono pochi e si leggono tutti insieme.
 *
 *  COME ENTRANO NEL CALCOLO DEGLI ORARI LIBERI
 *  `slotBloccato()` legge un registro tenuto in memoria da questo file, non il
 *  database: il calcolo degli slot (crm/booking-utils) è sincrono e deve
 *  restare tale. Chi disegna disponibilità chiama prima `assicuraBlocchi()`
 *  (una volta sola per sessione) e da lì in poi il registro è pieno.
 *  ⚠️ Finché nessuno chiama `assicuraBlocchi()`, il registro è vuoto e i
 *  blocchi NON tolgono niente: il posto giusto da cui chiamarla è l'avvio del
 *  CRM (vedi la richiesta lasciata a chi possiede CRMContext).
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/date-format";
import type { ConsultantData, FasciaOraria, Pausa } from "./types";

// ── TIPI ────────────────────────────────────────────────────────────────────

/** Quando si ripete un blocco: una data sola, oppure ogni settimana. */
export type QuandoBlocco = "data" | "settimanale";

export interface BloccoDisponibilita {
  id: string;
  /** Assente = il blocco vale per TUTTI i consulenti. */
  consulenteId?: string;
  quando: QuandoBlocco;
  /** YYYY-MM-DD, solo se `quando === "data"`. */
  data?: string;
  /** 0 (domenica) … 6, solo se `quando === "settimanale"`. */
  dow?: number;
  /** Senza inizio/fine il blocco prende la giornata intera. */
  inizio?: string;
  fine?: string;
  motivo?: string;
  /** Ultimo giorno in cui il blocco vale, incluso. Vuoto = non scade mai. */
  scadenza?: string;
  /** Spento a mano: resta scritto ma non toglie niente. */
  attivo: boolean;
  /** ISO di creazione, serve solo a ordinare l'elenco. */
  creato: string;
}

/** Lo stato di un blocco è una cosa sola, e va detta a schermo:
 *   · attivo         → sta togliendo tempo adesso;
 *   · scaduto        → la scadenza è passata, non toglie più niente;
 *   · spento         → spento a mano;
 *   · da_controllare → ha una scadenza che non si riesce a leggere. */
export type StatoBlocco = "attivo" | "scaduto" | "spento" | "da_controllare";

export interface Intervallo {
  inizio: number;
  fine: number;
}

// ── DATE E ORARI, LETTI CON PRUDENZA ────────────────────────────────────────

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Oggi con l'orologio locale. `toISOString()` passa per UTC e dopo le 22, in
 *  estate, restituirebbe già domani: una scadenza confrontata con "domani" fa
 *  scadere i blocchi un giorno prima. */
export function oggiLocale(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Giorno della settimana di una data, oppure null se la data non si legge.
 *  Una data illeggibile non è "oggi" e non è "lunedì": è "non lo so", e chi
 *  chiama deve poterlo distinguere invece di ricevere un numero inventato. */
export function dowDiData(iso: string): number | null {
  if (!RE_DATA.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

/** "09:30" → 570. Null se non è un orario. */
export function minutiDaOra(hhmm?: string | null): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 570 → "09:30". */
export function oraDaMinuti(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minuti → "3h 30m", per un conto che si legge a colpo d'occhio. */
export function oreLeggibili(minuti: number): string {
  if (minuti <= 0) return "0h";
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── STATO DEL BLOCCO ────────────────────────────────────────────────────────

export function statoBlocco(b: BloccoDisponibilita, oggi: string = oggiLocale()): StatoBlocco {
  if (!b.attivo) return "spento";
  if (b.scadenza) {
    //  Scadenza illeggibile: non si può dire che sia passata, quindi il blocco
    //  continua a valere. Togliere tempo a chi non lo aspetta è un fastidio;
    //  APRIRE l'agenda per una data storta è un appuntamento fissato dentro a
    //  una chiusura, e lo si scopre col cliente davanti.
    if (!RE_DATA.test(b.scadenza)) return "da_controllare";
    if (b.scadenza < oggi) return "scaduto";
  }
  return "attivo";
}

/** Un blocco toglie tempo solo se è attivo (o se la sua scadenza è illeggibile,
 *  e allora resta prudentemente in piedi). */
export function bloccoInVigore(b: BloccoDisponibilita, oggi: string = oggiLocale()): boolean {
  const s = statoBlocco(b, oggi);
  return s === "attivo" || s === "da_controllare";
}

/** Il blocco riguarda questo consulente? Senza `consulenteId` riguarda tutti. */
export function bloccoRiguarda(b: BloccoDisponibilita, consulenteId?: string): boolean {
  if (!b.consulenteId) return true;
  return !!consulenteId && b.consulenteId === consulenteId;
}

/** Il blocco cade in questa data? (non tiene conto della scadenza: quella la
 *  guarda `bloccoInVigore`, così l'elenco a schermo può mostrare anche i
 *  blocchi scaduti sul giorno che colpivano). */
export function bloccoCadeIl(b: BloccoDisponibilita, dataIso: string): boolean {
  if (b.quando === "data") return !!b.data && b.data === dataIso;
  const dow = dowDiData(dataIso);
  return dow !== null && b.dow === dow;
}

/** L'intervallo tolto da un blocco, in minuti dalla mezzanotte.
 *  Un blocco senza orari prende la giornata intera: è la chiusura. */
export function intervalloDelBlocco(b: BloccoDisponibilita): Intervallo {
  const i = minutiDaOra(b.inizio);
  const f = minutiDaOra(b.fine);
  if (i === null || f === null || f <= i) return { inizio: 0, fine: 24 * 60 };
  return { inizio: i, fine: f };
}

/** Gli intervalli tolti da tutti i blocchi che valgono per questo consulente in
 *  questa data. È il pezzo che serve sia al calcolo degli slot sia al conto
 *  delle ore aperte: uno solo, così i due numeri non possono discordare. */
export function intervalliBloccati(
  blocchi: BloccoDisponibilita[],
  consulenteId: string | undefined,
  dataIso: string,
  oggi: string = oggiLocale(),
): Intervallo[] {
  return blocchi
    .filter(
      (b) => bloccoRiguarda(b, consulenteId) && bloccoInVigore(b, oggi) && bloccoCadeIl(b, dataIso),
    )
    .map(intervalloDelBlocco);
}

// ── IL REGISTRO IN MEMORIA ──────────────────────────────────────────────────
//  Il calcolo degli slot è sincrono: non può aspettare una fetch. Qui si tiene
//  l'ultima copia letta, e si aggiorna a ogni salvataggio.

let registro: BloccoDisponibilita[] = [];

export function registraBlocchi(list: BloccoDisponibilita[]): void {
  registro = list;
}

export function blocchiRegistrati(): BloccoDisponibilita[] {
  return registro;
}

/** LA RIGA CHE SERVE AL CALCOLO DEGLI ORARI LIBERI.
 *  Vero se il pezzo di tempo [inizioMin, fineMin) di quel giorno è coperto da
 *  un blocco in vigore per quel consulente. */
export function slotBloccato(
  consulenteId: string,
  dataIso: string,
  inizioMin: number,
  fineMin: number,
  oggi: string = oggiLocale(),
): boolean {
  if (registro.length === 0) return false;
  return intervalliBloccati(registro, consulenteId, dataIso, oggi).some(
    (b) => inizioMin < b.fine && fineMin > b.inizio,
  );
}

// ── LETTURA E SCRITTURA ─────────────────────────────────────────────────────

export const CHIAVE_BLOCCHI = "crm_blocchi_disponibilita";

/** ── PERCHÉ `app_config` SI DESCRIVE A MANO ─────────────────────────────────
 *  La tabella è arrivata con una migrazione a parte e non compare nei tipi
 *  generati di Supabase: senza questa descrizione ogni chiamata sarebbe un
 *  errore di tipo. Stessa scelta già fatta in CRM.whatsapp.tsx.
 *  ⚠️ È esportata perché la porta su `app_config` deve restare UNA: la
 *   capienza delle fasce (crm/capienza.ts) passa da qui invece di descriversi
 *   la tabella una seconda volta. Il giorno in cui i tipi verranno rigenerati
 *   si cancella questo blocco e basta. */
export const dbConfig = supabase as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{ data: { value?: string } | null }>;
      };
    };
    upsert: (
      v: Record<string, unknown>,
      o: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ripulisce quello che arriva dal database: un blocco storto non deve poter
 *  far esplodere la pagina né, peggio, chiudere l'agenda per sbaglio. */
function normalizzaBlocco(grezzo: unknown): BloccoDisponibilita | null {
  if (!grezzo || typeof grezzo !== "object") return null;
  const r = grezzo as Record<string, unknown>;
  const quando: QuandoBlocco = r.quando === "settimanale" ? "settimanale" : "data";
  const data = typeof r.data === "string" && RE_DATA.test(r.data) ? r.data : undefined;
  const dow = typeof r.dow === "number" && r.dow >= 0 && r.dow <= 6 ? r.dow : undefined;
  //  Un blocco che non sa quando cade non blocca niente e confonde l'elenco.
  if (quando === "data" && !data) return null;
  if (quando === "settimanale" && dow === undefined) return null;
  const inizio =
    typeof r.inizio === "string" && minutiDaOra(r.inizio) !== null ? r.inizio : undefined;
  const fine = typeof r.fine === "string" && minutiDaOra(r.fine) !== null ? r.fine : undefined;
  return {
    id: typeof r.id === "string" && r.id ? r.id : nuovoId(),
    consulenteId: typeof r.consulenteId === "string" && r.consulenteId ? r.consulenteId : undefined,
    quando,
    data,
    dow,
    inizio,
    fine,
    motivo: typeof r.motivo === "string" ? r.motivo : undefined,
    //  La scadenza si tiene anche se illeggibile: cancellarla in silenzio
    //  renderebbe eterno un blocco nato temporaneo.
    scadenza: typeof r.scadenza === "string" && r.scadenza ? r.scadenza : undefined,
    attivo: r.attivo !== false,
    creato: typeof r.creato === "string" && r.creato ? r.creato : new Date().toISOString(),
  };
}

export function leggiBlocchiDaJson(testo: string | null | undefined): BloccoDisponibilita[] {
  if (!testo) return [];
  try {
    const parsed = JSON.parse(testo) as unknown;
    const lista = Array.isArray(parsed)
      ? parsed
      : ((parsed as { blocchi?: unknown[] } | null)?.blocchi ?? []);
    if (!Array.isArray(lista)) return [];
    return lista.map(normalizzaBlocco).filter((b): b is BloccoDisponibilita => b !== null);
  } catch {
    //  Configurazione illeggibile: meglio nessun blocco che una pagina bianca.
    //  Il salvataggio successivo riscrive il campo per intero.
    return [];
  }
}

//  La lettura si fa una volta per sessione: il registro serve a un calcolo
//  sincrono, non a una schermata, e ribatterlo a ogni slot sarebbe una fetch
//  per riga di calendario.
let attesa: Promise<BloccoDisponibilita[]> | null = null;

export async function caricaBlocchi(): Promise<BloccoDisponibilita[]> {
  const { data } = await dbConfig
    .from("app_config")
    .select("value")
    .eq("key", CHIAVE_BLOCCHI)
    .maybeSingle();
  const lista = leggiBlocchiDaJson(data?.value);
  registraBlocchi(lista);
  return lista;
}

export async function salvaBlocchi(
  lista: BloccoDisponibilita[],
): Promise<{ ok: boolean; errore?: string }> {
  const { error } = await dbConfig.from("app_config").upsert(
    {
      key: CHIAVE_BLOCCHI,
      value: JSON.stringify({ v: 1, blocchi: lista }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, errore: error.message };
  //  Il registro si aggiorna solo se la scrittura è andata: altrimenti a
  //  schermo si vedrebbe una chiusura che il database non conosce.
  registraBlocchi(lista);
  attesa = Promise.resolve(lista);
  return { ok: true };
}

/** I blocchi, letti una volta sola per sessione. Chi disegna disponibilità la
 *  chiama e poi può usare `slotBloccato` sincrono. */
export function assicuraBlocchi(): Promise<BloccoDisponibilita[]> {
  if (!attesa) {
    attesa = caricaBlocchi().catch(() => {
      //  Una lettura fallita non deve restare "in cache" come elenco vuoto per
      //  sempre: al prossimo giro si riprova.
      attesa = null;
      return [];
    });
  }
  return attesa;
}

/** Da chiamare quando i blocchi cambiano fuori da qui (import, ripristino). */
export function invalidaCacheBlocchi(): void {
  attesa = null;
}

// ── COME SI RACCONTA UN BLOCCO ──────────────────────────────────────────────

const GIORNI_LUNGHI = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

/** "Ogni lunedì · 09:00–11:00" oppure "Lun 17 ago · giornata intera".
 *  La data si scrive come la scrive il resto del CRM: "2026-08-17" in mezzo a
 *  una frase costringe chi legge a fare il conto con il calendario. */
export function descriviBlocco(b: BloccoDisponibilita): string {
  const quando =
    b.quando === "settimanale"
      ? `Ogni ${GIORNI_LUNGHI[b.dow ?? 0].toLowerCase()}`
      : b.data
        ? formatDate(b.data, { short: true })
        : "data mancante";
  const orario =
    minutiDaOra(b.inizio) !== null && minutiDaOra(b.fine) !== null
      ? `${b.inizio}–${b.fine}`
      : "giornata intera";
  return `${quando} · ${orario}`;
}

// ── QUANTO SI È APERTI ──────────────────────────────────────────────────────
//  Chi imposta gli orari non sa mai se ha chiuso troppo: se ne accorge quando
//  l'agenda non propone più niente a nessuno. Qui il conto è esplicito, e tiene
//  dentro tutto quello che toglie tempo — pause comprese.

function ordinaEUnisci(intervalli: Intervallo[]): Intervallo[] {
  const validi = intervalli.filter((i) => i.fine > i.inizio).sort((a, b) => a.inizio - b.inizio);
  const out: Intervallo[] = [];
  for (const i of validi) {
    const ultimo = out[out.length - 1];
    if (ultimo && i.inizio <= ultimo.fine) ultimo.fine = Math.max(ultimo.fine, i.fine);
    else out.push({ ...i });
  }
  return out;
}

function sottrai(base: Intervallo[], togli: Intervallo[]): Intervallo[] {
  const buchi = ordinaEUnisci(togli);
  let resto = ordinaEUnisci(base);
  for (const t of buchi) {
    const next: Intervallo[] = [];
    for (const r of resto) {
      if (t.fine <= r.inizio || t.inizio >= r.fine) {
        next.push(r);
        continue;
      }
      if (t.inizio > r.inizio) next.push({ inizio: r.inizio, fine: t.inizio });
      if (t.fine < r.fine) next.push({ inizio: t.fine, fine: r.fine });
    }
    resto = next;
  }
  return resto;
}

function durata(intervalli: Intervallo[]): number {
  return intervalli.reduce((n, i) => n + (i.fine - i.inizio), 0);
}

export interface OreDelGiorno {
  /** minuti di fascia oraria prima di togliere qualsiasi cosa */
  lordi: number;
  /** minuti tolti da pause e blocchi */
  tolti: number;
  /** minuti davvero prenotabili */
  netti: number;
  /** almeno un blocco tocca questo giorno */
  conBlocchi: boolean;
}

/** Il conto di UN giorno. Le pause arrivano da fuori (`pauseDelGiorno` di
 *  booking-utils, che è l'unica lettura ammessa del campo `pause`): questo file
 *  non importa booking-utils perché è booking-utils a importare questo, e un
 *  anello fra i due si paga in avvii bianchi. */
export function oreDelGiorno(opts: {
  lavorativo: boolean;
  fasce: FasciaOraria[];
  pause: Pausa[];
  blocchi: Intervallo[];
}): OreDelGiorno {
  if (!opts.lavorativo)
    return { lordi: 0, tolti: 0, netti: 0, conBlocchi: opts.blocchi.length > 0 };
  const fasce: Intervallo[] = [];
  for (const f of opts.fasce) {
    const i = minutiDaOra(f?.inizio);
    const fi = minutiDaOra(f?.fine);
    if (i === null || fi === null || fi <= i) continue;
    fasce.push({ inizio: i, fine: fi });
  }
  const lordi = durata(ordinaEUnisci(fasce));
  const buchi: Intervallo[] = [];
  for (const p of opts.pause) {
    const i = minutiDaOra(p?.inizio);
    const fi = minutiDaOra(p?.fine);
    if (i === null || fi === null || fi <= i) continue;
    buchi.push({ inizio: i, fine: fi });
  }
  buchi.push(...opts.blocchi);
  const netti = durata(sottrai(fasce, buchi));
  return { lordi, tolti: Math.max(0, lordi - netti), netti, conBlocchi: opts.blocchi.length > 0 };
}

// ── LE PAUSE SI RISCRIVONO NELLA FORMA IN CUI SI SONO TROVATE ───────────────
//  Il tipo dichiara `Pausa[]`, ma nell'archivio importato le pause sono un
//  OGGETTO per giorno. Chi legge lo sa già (pauseDelGiorno); chi SCRIVE deve
//  saperlo altrettanto: salvare un elenco sopra un oggetto cancellerebbe le
//  pause di tutti gli altri giorni, e nessuno se ne accorgerebbe fino al primo
//  appuntamento fissato dentro la pausa pranzo.

export function pauseSonoAOggetto(dati: ConsultantData): boolean {
  const grezzo = dati.pause as unknown;
  return !!grezzo && !Array.isArray(grezzo) && typeof grezzo === "object";
}

/** Restituisce il valore da salvare in `pause` sostituendo SOLO il giorno dato,
 *  nella stessa forma già presente nella scheda. */
export function scriviPauseDelGiorno(
  dati: ConsultantData,
  dow: number,
  pause: Pausa[],
): ConsultantData["pause"] {
  const nuove = pause.map((p) => ({ giorno: dow, inizio: p.inizio, fine: p.fine }));
  const grezzo = dati.pause as unknown;
  if (grezzo && !Array.isArray(grezzo) && typeof grezzo === "object") {
    const per = { ...(grezzo as Record<string, unknown>) };
    if (nuove.length === 0) delete per[String(dow)];
    else per[String(dow)] = nuove;
    return per as unknown as ConsultantData["pause"];
  }
  const elenco = Array.isArray(grezzo) ? (grezzo as Pausa[]).filter(Boolean) : [];
  return [...elenco.filter((p) => p?.giorno !== dow), ...nuove];
}
