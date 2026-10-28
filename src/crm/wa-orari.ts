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

/** Un tocco sulle stelle: 0 → 1 → 2 → 3 → 0. */
export const stellaDopo = (n: Stelle): Stelle => ((n + 1) % 4) as Stelle;

/** ── DA RISPONDERE ─────────────────────────────────────────────────────────
 *  L'ultimo messaggio della chat è suo, non nostro: tocca a noi. Vale anche se
 *  la chat è già stata aperta — aprirla non è rispondere. */
export function daRispondere(ultimo?: { direction?: string | null } | null): boolean {
  return ultimo?.direction === "inbound";
}

/** ── IL MESSAGGIO CON GLI ORARI ─────────────────────────────────────────── */

export interface OrarioScelto {
  /** AAAA-MM-GG */
  data: string;
  /** HH:MM */
  ora: string;
}

const piu = (data: string, giorni: number): string => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
};

/** «oggi», «domani», oppure «venerdì 31 ottobre». */
export function giornoPerMessaggio(data: string, oggi: string): string {
  if (data === oggi) return "oggi";
  if (data === piu(oggi, 1)) return "domani";
  return giornoParlato(data) ?? data;
}

/** «alle 15:00», «alle 15:00 o alle 17:30», «alle 10:00, 11:00 o 12:00». */
function oreInFila(ore: string[]): string {
  if (ore.length === 1) return `alle ${ore[0]}`;
  if (ore.length === 2) return `alle ${ore[0]} o alle ${ore[1]}`;
  return `alle ${ore.slice(0, -1).join(", ")} o ${ore.at(-1)}`;
}

/** Il testo da mandare: un giorno per riga, le ore in ordine, la domanda in
 *  fondo. Col «lei», come gli altri messaggi dello studio. Vuoto se non c'è
 *  niente di scelto. */
export function messaggioOrari(
  scelte: OrarioScelto[],
  oggi: string,
  nome?: string | null,
  /** il consulente che farà la consulenza (solo il nome): entra nel testo */
  consulente?: string | null,
): string {
  const perGiorno = new Map<string, Set<string>>();
  for (const s of scelte) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.data) || !/^\d{1,2}:\d{2}$/.test(s.ora)) continue;
    const ora = s.ora.padStart(5, "0");
    perGiorno.set(s.data, (perGiorno.get(s.data) ?? new Set()).add(ora));
  }
  if (perGiorno.size === 0) return "";
  const righe = [...perGiorno.keys()].sort().map((data) => {
    const ore = [...perGiorno.get(data)!].sort();
    return { giorno: giornoPerMessaggio(data, oggi), ore };
  });
  const quante = righe.reduce((n, r) => n + r.ore.length, 0);
  const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const parola =
    String(nome ?? "")
      .trim()
      .split(/\s+/)[0] ?? "";
  //  «mario» scritto a mano diventa «Mario».
  const primo = parola ? maiuscola(parola) : "";
  const saluto = primo ? `Gentile ${primo}, ` : "";
  const chi =
    String(consulente ?? "")
      .trim()
      .split(/\s+/)[0] ?? "";
  //  Col consulente: «Filippo è disponibile per…» (richiesta del 28/10).
  const apertura = chi
    ? `${maiuscola(chi)} è disponibile per la consulenza gratuita online`
    : "per la consulenza gratuita online avrei";
  if (quante === 1) {
    const r = righe[0];
    return maiuscola(
      chi
        ? `${saluto}${apertura} ${r.giorno} ${oreInFila(r.ore)}.\n\nLe va bene?`
        : `${saluto}${apertura} libero ${r.giorno} ${oreInFila(r.ore)}.\n\nLe va bene?`,
    );
  }
  const elenco = righe.map((r) => `• ${r.giorno} ${oreInFila(r.ore)}`).join("\n");
  return maiuscola(
    chi
      ? `${saluto}${apertura} in questi orari:\n\n${elenco}\n\nQuale preferisce?`
      : `${saluto}${apertura} liberi questi orari:\n\n${elenco}\n\nQuale preferisce?`,
  );
}
