/** ── WHATSAPP: ORARI RAPIDI, DA RISPONDERE, STELLE ──────────────────────────
 *
 *  Richiesta del titolare (28/10/2026), dalla chat WhatsApp del CRM, computer
 *  e telefono:
 *   1. «qualcosa per vedere gli orari in modo semplice, rapido in chat: clicco
 *      i giorni e compone il messaggio che posso copiare e incollare, dove
 *      chiedo se gli vanno bene quelle date. Tipo oggi o domani»;
 *   2. «i messaggi che non ho ancora aperto e sono da rispondere hanno il loro
 *      filtro»;
 *   3. «impostarli in osservazione, da 1 a 3 stelle in base alla priorità,
 *      da impostare e vedere dalla lista».
 *  Qui le regole, pure e provate (prove/prove.mjs, proveDiWhatsappOrariStelle):
 *  la pagina le disegna.
 *
 *  ⚠️ GLI ORARI SONO QUELLI DI SLOT LIBERI (`useGiorniLiberi`): stessi posti,
 *   stessa squadra. Il messaggio non dice nomi di consulenti né quanti posti
 *   restano: al cliente servono il giorno e l'ora.
 *  ⚠️ LE STELLE STANNO IN `app_config` («wa_stelle»), una mappa numero → 1..3
 *   condivisa da tutto lo studio: la tabella delle chat non ha un campo libero
 *   e per una preferenza così non vale una modifica al database. Il numero è
 *   la chiave delle ultime nove cifre (`chiaveTelefono`), come dappertutto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { giornoParlato } from "./promemoria/formati";
import { chiaveTelefono } from "./telefono-doppio";

export const CHIAVE_CONFIG_STELLE = "wa_stelle";

export type Stelle = 0 | 1 | 2 | 3;
export type MappaStelle = Record<string, 1 | 2 | 3>;

/** La mappa salvata, ripulita: solo chiavi di numero e valori 1..3. */
export function leggiStelle(testo?: string | null): MappaStelle {
  try {
    const grezzo = JSON.parse(String(testo ?? "")) as unknown;
    const mappa =
      grezzo && typeof grezzo === "object"
        ? ((grezzo as { stelle?: unknown }).stelle ?? grezzo)
        : {};
    const out: MappaStelle = {};
    for (const [k, v] of Object.entries(mappa as Record<string, unknown>)) {
      const n = Number(v);
      if (/^\d{6,9}$/.test(k) && (n === 1 || n === 2 || n === 3)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export const scriviStelle = (m: MappaStelle): string => JSON.stringify({ v: 1, stelle: m });

/** Le stelle di un numero (0 = non in osservazione). */
export function stelleDi(m: MappaStelle, telefono?: string | null): Stelle {
  const k = chiaveTelefono(telefono);
  return (k && m[k]) || 0;
}

/** La mappa con le stelle nuove di un numero; 0 lo toglie. */
export function conStelle(
  m: MappaStelle,
  telefono: string | null | undefined,
  n: Stelle,
): MappaStelle {
  const k = chiaveTelefono(telefono);
  if (!k) return m;
  const out = { ...m };
  if (n === 0) delete out[k];
  else out[k] = n;
  return out;
}

/** ── STELLA 1 DAL GIRO (30/10/2026) ────────────────────────────────────────
 *  Titolare: quando parte il messaggio automatico dopo la consulenza, la chat
 *  va in priorità stella 1. Solo i quattro stati dopo la consulenza: Ricontatto
 *  fissato, In valutazione, Attesa acconto, Lead in chat. Se la chat ha già 2 o
 *  3 stelle si RIMETTE 1: il messaggio appena partito è la cosa da seguire.
 *  ⚠️ Lo scrive il server (il giro), mentre il browser può salvare le sue: la
 *   scrittura è condizionata alla riga letta (`scrivi(vecchio, nuovo)` torna
 *   falso se nel frattempo è cambiata) e riprova sulla riga nuova. Nessuna
 *   funzione SQL: basta un `update … where value = <letto>`. */
export const STATI_STELLA_UNO = [
  "da_ricontattare",
  "sta_valutando",
  "in_attesa_acconto",
  "gestire_in_chat",
] as const;

export interface PorteStelle {
  /** il testo di `wa_stelle` com'è adesso; `null` se la riga non c'è */
  leggi(): Promise<string | null>;
  /** scrive `nuovo` SOLO se la riga è ancora `vecchio` (`null` = ancora assente); falso se è cambiata */
  scrivi(vecchio: string | null, nuovo: string): Promise<boolean>;
}

/** Quanti tentativi prima di arrendersi: ogni conflitto è un salvataggio altrui nello stesso istante. */
export const TENTATIVI_STELLA = 4;

export async function mettiStellaUno(
  porte: PorteStelle,
  telefono: string | null | undefined,
): Promise<"messa" | "gia_uno" | "senza_numero" | "conflitto"> {
  if (!chiaveTelefono(telefono)) return "senza_numero";
  for (let i = 0; i < TENTATIVI_STELLA; i++) {
    const letto = await porte.leggi();
    const mappa = leggiStelle(letto);
    if (stelleDi(mappa, telefono) === 1) return "gia_uno";
    if (await porte.scrivi(letto, scriviStelle(conStelle(mappa, telefono, 1)))) return "messa";
  }
  return "conflitto";
}

/** Un tocco sulle stelle: 0 → 1 → 2 → 3 → 0. */
export const stellaDopo = (n: Stelle): Stelle => ((n + 1) % 4) as Stelle;

/** ── DA RISPONDERE ─────────────────────────────────────────────────────────
 *  L'ultimo messaggio della chat è suo, non nostro: tocca a noi. Vale anche se
 *  la chat è già stata aperta — aprirla non è rispondere. */
export function daRispondere(ultimo?: { direction?: string | null } | null): boolean {
  return ultimo?.direction === "inbound";
}

/** ── IL MESSAGGIO CON GLI ORARI ───────────────────────────────────────────
 *  Commessa 2026-10-28 (calendario): il tasto della casella apre una finestra
 *  col calendario di ogni consulente (crm/OrariRapidi); si scelgono più orari,
 *  anche di giorni e consulenti diversi, e «Crea messaggio» mette il testo
 *  nella casella. Qui la scelta, i gruppi per giorno e il testo. */

export interface OrarioScelto {
  /** AAAA-MM-GG */
  data: string;
  /** HH:MM */
  ora: string;
  /** con chi era libero quando è stato scelto ("tutti" o l'id). Il messaggio
   *  dice il nome solo se TUTTE le ore scelte sono dello stesso consulente
   *  (`consulenteComune`). */
  chi?: string;
}

/** L'id del consulente se tutte le ore scelte sono sue; altrimenti `null`
 *  (ore di più consulenti, o scelte con «Tutti»): il messaggio non dice nomi,
 *  perché un nome sbagliato promette al cliente una persona che quell'ora non
 *  è libera (revisione del 29/10/2026). */
export function consulenteComune(scelte: OrarioScelto[]): string | null {
  const chi = scelte[0]?.chi;
  if (!chi || chi === "tutti") return null;
  return scelte.every((s) => s.chi === chi) ? chi : null;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ORA = /^\d{1,2}:\d{2}$/;
const ora2 = (ora: string) => ora.padStart(5, "0");

/** Lo stesso orario scelto due volte (anche con due consulenti) è lo stesso orario. */
export const eScelto = (scelte: OrarioScelto[], data: string, ora: string): boolean =>
  scelte.some((s) => s.data === data && s.ora === ora2(ora));

/** Un tocco: se c'è lo toglie, se non c'è lo aggiunge in fondo. */
export function cambiaScelta(scelte: OrarioScelto[], s: OrarioScelto): OrarioScelto[] {
  if (!DATA.test(s.data) || !ORA.test(s.ora)) return scelte;
  const ora = ora2(s.ora);
  if (eScelto(scelte, s.data, ora))
    return scelte.filter((x) => !(x.data === s.data && x.ora === ora));
  return [...scelte, { ...s, ora }];
}

/** Le scelte per giorno: giorni in ordine, ore in ordine, niente doppioni. */
export function scelteDelGiorno(scelte: OrarioScelto[]): { data: string; ore: string[] }[] {
  const perGiorno = new Map<string, Set<string>>();
  for (const s of scelte) {
    if (!DATA.test(s.data) || !ORA.test(s.ora)) continue;
    perGiorno.set(s.data, (perGiorno.get(s.data) ?? new Set()).add(ora2(s.ora)));
  }
  return [...perGiorno.keys()]
    .sort()
    .map((data) => ({ data, ore: [...perGiorno.get(data)!].sort() }));
}

/** Prima di scrivere il messaggio: via quello che nel frattempo non è più
 *  libero (un'ora passata, un posto preso). `giorni` sono quelli di tutta la
 *  squadra; un giorno che non c'è fra quelli guardati non si giudica. */
export function scelteAncoraLibere(
  scelte: OrarioScelto[],
  giorni: { data: string; fasce: { ora: string }[] }[],
  oggi: string,
): OrarioScelto[] {
  const libere = new Map(giorni.map((g) => [g.data, new Set(g.fasce.map((f) => ora2(f.ora)))]));
  return scelte.filter((s) => {
    if (s.data < oggi) return false;
    const ore = libere.get(s.data);
    return !ore || ore.has(ora2(s.ora));
  });
}

/** Il consulente da cui parte il calendario: quello del lead, se è fra chi fa
 *  consulenze; altrimenti «Tutti». */
export const consulenteDiPartenza = (squadra: string[], consulenteId?: string | null): string =>
  consulenteId && squadra.includes(consulenteId) ? consulenteId : "tutti";

/** Il giorno visto da un consulente solo: le ore in cui LUI ha posto, coi
 *  suoi posti. È lo stesso che Slot liberi calcola scegliendo quella persona
 *  (`riassumiGiorno` con lei sola), ritagliato dal giorno di tutta la squadra:
 *  un calcolo solo, e le scelte fatte su consulenti diversi si controllano
 *  tutte sugli stessi giorni (prove: «il ritaglio di un consulente»). */
export function giornoDi<
  G extends { fasce: { ora: string; posti: number; chi: { id: string; posti: number }[] }[] },
>(g: G, chi: string): G {
  if (chi === "tutti") return g;
  const fasce = g.fasce.flatMap((f) => {
    const suo = f.chi.find((c) => c.id === chi);
    return suo ? [{ ...f, posti: suo.posti, chi: [suo] }] : [];
  });
  return { ...g, fasce, posti: fasce.reduce((t, f) => t + f.posti, 0) };
}

const piu = (data: string, giorni: number): string => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
};

/** «oggi, mercoledì 28 ottobre», «domani, giovedì 29 ottobre», «venerdì 30
 *  ottobre»: il giorno sempre per intero, il cliente non deve contare. */
export function giornoPerMessaggio(data: string, oggi: string): string {
  const parlato = giornoParlato(data) ?? data;
  if (data === oggi) return `oggi, ${parlato}`;
  if (data === piu(oggi, 1)) return `domani, ${parlato}`;
  return parlato;
}

/** «alle 15:00», «alle 15:00 o alle 17:30», «alle 10:00, 11:00 o 12:00». */
function oreInFila(ore: string[]): string {
  if (ore.length === 1) return `alle ${ore[0]}`;
  if (ore.length === 2) return `alle ${ore[0]} o alle ${ore[1]}`;
  return `alle ${ore.slice(0, -1).join(", ")} o ${ore.at(-1)}`;
}

const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Il testo da mandare: un giorno per riga («Domani, giovedì 29 ottobre: alle
 *  10:00 o alle 15:30»), le ore in ordine, la domanda in fondo. Col «Lei»,
 *  come gli altri messaggi dello studio. Vuoto se non c'è niente di scelto. */
export function messaggioOrari(
  scelte: OrarioScelto[],
  oggi: string,
  nome?: string | null,
  /** Il consulente scelto (non «Tutti»): entra nel testo, «Filippo è
   *  disponibile…» (richiesta del titolare, 29/10/2026). Vuoto = senza nome. */
  consulente?: string | null,
): string {
  const righe = scelteDelGiorno(scelte).map((r) => ({
    giorno: giornoPerMessaggio(r.data, oggi),
    ore: r.ore,
  }));
  if (righe.length === 0) return "";
  const quante = righe.reduce((n, r) => n + r.ore.length, 0);
  const parola =
    String(nome ?? "")
      .trim()
      .split(/\s+/)[0] ?? "";
  //  «mario» scritto a mano diventa «Mario».
  const primo = maiuscola(parola);
  const saluto = primo ? `Gentile ${primo}, ` : "";
  const chi = maiuscola(
    String(consulente ?? "")
      .trim()
      .split(/\s+/)[0] ?? "",
  );
  const apertura = chi
    ? `${chi} è disponibile per la consulenza gratuita online`
    : "per la consulenza gratuita online avrei";
  if (quante === 1) {
    const r = righe[0];
    //  «oggi, mercoledì 28 ottobre, alle 15:00»: la virgola chiude l'inciso.
    const giorno = r.giorno.includes(",") ? `${r.giorno},` : r.giorno;
    return maiuscola(
      `${saluto}${apertura}${chi ? "" : " libero"} ${giorno} ${oreInFila(r.ore)}.\n\nLe va bene?`,
    );
  }
  const elenco = righe.map((r) => `${maiuscola(r.giorno)}: ${oreInFila(r.ore)}`).join("\n");
  return maiuscola(
    `${saluto}${apertura}${chi ? " in questi orari" : " liberi questi orari"}:\n\n${elenco}\n\nQuale preferisce?`,
  );
}
