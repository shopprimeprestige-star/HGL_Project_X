/** ── LA CONSULENZA: CONFERMA A DUE PASSI E ASSENZA ─────────────────────────
 *
 *  Commessa 2026-10-30 (ottimizzazioni), pacchetto p5-consulenze. Prove in
 *  `prove/manychat/consulenze.mjs`. Modulo PURO: l'orologio e la sala d'attesa
 *  arrivano da fuori.
 *
 *  (10) CONFERMA A DUE PASSI — `confermaMancata`
 *   Il primo passo è il promemoria automatico della consulenza: quello del giorno
 *   prima (`meet_domani`, solo se gratis: `MEET_DOMANI_SOLO_GRATIS` in giro.ts, e
 *   un ok a quel messaggio vale come risposta) o, se non è partito, quello della
 *   mattina (`meet_oggi`). Se da 3 ore non c'è risposta, il secondo passo è una
 *   telefonata del consulente prima dell'inizio: la scheda va in cima a «Da fare»
 *   (`dafare/righe.tsx`, riga `conferma_meet`). Si legge tutto dalla storia del
 *   secondo stato (`contattoWa.storia`): nessuna lettura in più, nessuna colonna.
 *   Conta il PRIMO promemoria di QUESTA consulenza; dopo di lui solo altri invii
 *   automatici senza risposta. Una risposta qualunque, un cambio a mano o uno
 *   STOP la tolgono: il consulente sa già com'è.
 *
 *  (12) ASSENZA — `decidiAssenza`
 *   15 minuti dopo l'inizio, se nessuno ha bussato alla stanza Meetly della
 *   consulenza (la riga `sala_attesa:<codice>`, che OGNI ospite scrive entrando:
 *   shop/call.tsx, `bussaSulServer`), la scheda passa da sola a «Da
 *   riprogrammare» (`da_spostare`) col segno `assenzaAuto`. Il messaggio è quello
 *   che lo stato ha già (`hgl_da_riprogrammare`, TABELLA_STATI, sotto il suo
 *   interruttore), ma parte subito invece che dopo 30' (`eAssenzaAutomatica`,
 *   letta da stati.ts). Lo fa il server: hooks/assenza-meet.
 *   ⚠️ NEL DUBBIO NON SI SPOSTA NIENTE: stanza non nostra (nessuna sala da
 *    leggere), qualcuno in sala da un'ora prima dell'inizio in poi, un messaggio
 *    del cliente da 3 ore prima dell'inizio in poi («arrivo tra 5 minuti»), un
 *    esito già segnato, nessun consulente. Un falso «assente» scrive a chi è in
 *    collegamento; un vero assente non spostato lo segna il consulente come oggi.
 *   ⚠️ Oltre un'ora e mezza dall'inizio il giro non tocca più niente: dopo una
 *    pubblicazione o un fermo non si rimettono in moto le consulenze di ieri.
 *   ⚠️ LA PRESENZA NON SI POTA (revisione del 30/10): la riga della sala si pota
 *    dopo 30' (`DECISIONE_TTL_MS`), quindi un cliente entrato alle 11:00 alle
 *    11:35 non ci sarebbe più. Ogni bussata scrive anche `presenza_meet:<codice>`
 *    (l'ora dell'ultima bussata, mai potata: api.public.sala-attesa), e il giro
 *    legge tutte e due. Una presenza dall'ora prima dell'inizio in poi basta a
 *    non spostare MAI.
 *   ⚠️ INTERRUTTORE `assenza_auto` (app_config, spento di serie; Impostazioni →
 *    WhatsApp): spento, il giro SEGNALA soltanto — segno `assenzaSegnalata` sulla
 *    scheda e riga «Chiamare … non è entrato alla consulenza» in «Da fare»;
 *    stato e messaggi non cambiano. Acceso, sposta come sopra.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ContattoWa, LeadData, LeadStatus, VoceContattoWa } from "../types";
import { eAppuntamento } from "../types";
import { aRoma, oraNormale } from "../promemoria/formati";
import { DA_AUTOMATICO, istanteDiRoma } from "./contatto";
import { conNota } from "./prenota-scheda";

const MIN_MS = 60_000;
const ORA_MS = 60 * MIN_MS;

/** Dopo quante ore senza risposta al promemoria si chiama. */
export const ORE_PER_CONFERMARE = 3;
/** I promemoria che chiedono una risposta prima della consulenza. */
export const PROMEMORIA_DA_CONFERMARE = ["meet_domani", "meet_oggi"];
/** Dopo quanti minuti dall'inizio, senza nessuno in stanza, si sposta. */
export const ASSENZA_DOPO_MIN = 15;
/** Oltre questo dall'inizio il giro non tocca più la scheda. */
export const ASSENZA_ENTRO_MIN = 90;
/** Una bussata conta se arriva da così tanto prima dell'inizio in poi. */
export const PRESENZA_DA_MIN = 60;
/** Un messaggio del cliente da così tanto prima dell'inizio in poi lascia decidere il consulente. */
export const RISPOSTA_RECENTE_ORE = 3;

/** Il segno della scheda spostata da sola. Non sta in `LeadData` (file comune):
 *  è un campo libero del JSON, come `prenotatoChat`. */
export interface AssenzaAuto {
  /** ISO: uguale a `statoDal` del cambio */
  il: string;
  /** la consulenza saltata, «AAAA-MM-GGTHH:MM» (ora di Roma) */
  meet: string;
}
type SchedaConAssenza = Partial<LeadData> & {
  assenzaAuto?: AssenzaAuto;
  assenzaSegnalata?: AssenzaAuto;
};

/** L'interruttore in `app_config`. Vale solo `acceso: true` esatto: una riga
 *  assente o illeggibile è spenta. */
export const CHIAVE_ASSENZA_AUTO = "assenza_auto";
export function leggiAssenzaAuto(testo: string | null | undefined): boolean {
  try {
    return (JSON.parse(String(testo ?? "")) as { acceso?: unknown })?.acceso === true;
  } catch {
    return false;
  }
}
export const rigaAssenzaAuto = (acceso: boolean): string => JSON.stringify({ acceso });

/** La presenza che non si pota: `presenza_meet:<codice>` = ms dell'ultima bussata. */
export const BASE_PRESENZA = "presenza_meet";
export function leggiPresenza(testo: string | null | undefined): number | null {
  const n = Number(String(testo ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** «AAAA-MM-GGTHH:MM» della consulenza in scheda, `null` se non si legge. */
function meetDi(d: Partial<LeadData>): string | null {
  const inizio = inizioConsulenza(d);
  const ora = oraNormale(d.oraMeeting);
  return inizio && ora ? `${aRoma(inizio).giorno}T${ora}` : null;
}

/** L'inizio della consulenza (ora di Roma), `null` se giorno o ora non si leggono. */
export function inizioConsulenza(d: Partial<LeadData> | null | undefined): Date | null {
  const giorno = String(d?.dataMeeting ?? "").slice(0, 10);
  const ora = oraNormale(d?.oraMeeting);
  return ora ? istanteDiRoma(giorno, ora) : null;
}

/** Il giorno prima («AAAA-MM-GG»). */
function giornoPrima(g: string): string {
  const [a, m, d] = g.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** Il promemoria è di QUESTA consulenza: il giorno prima o il giorno stesso. */
function delMeet(v: VoceContattoWa, giornoMeet: string): boolean {
  const t = Date.parse(v.il);
  if (!Number.isFinite(t)) return false;
  const g = aRoma(new Date(t)).giorno;
  return v.motivo === "meet_domani" ? g === giornoPrima(giornoMeet) : g === giornoMeet;
}

/** Dopo il promemoria si accettano solo altri invii automatici senza risposta. */
const SENZA_RISPOSTA = ["in_attesa", "contattato", "non_ha_risposto"];
const automaticoSenzaRisposta = (v: Pick<ContattoWa, "stato" | "da">) =>
  v.da === DA_AUTOMATICO && SENZA_RISPOSTA.includes(v.stato);

export interface ConfermaMancata {
  inizio: Date;
  /** quando è partito il primo promemoria senza risposta */
  promemoriaIl: Date;
}

/** ── (10) LA CONSULENZA DA CONFERMARE A VOCE ─────────────────────────────── */
export function confermaMancata(
  d: Partial<LeadData> | null | undefined,
  adesso: Date,
): ConfermaMancata | null {
  if (!d || !eAppuntamento(d.stato)) return null;
  const c = d.contattoWa;
  if (!c || !automaticoSenzaRisposta(c)) return null;
  const inizio = inizioConsulenza(d);
  if (!inizio || inizio.getTime() <= adesso.getTime()) return null;
  const giornoMeet = aRoma(inizio).giorno;
  //  La storia ha la voce nuova in testa: si legge in ordine di tempo.
  const voci = [...(c.storia ?? [])].reverse();
  const i = voci.findIndex(
    (v) =>
      v.stato === "in_attesa" &&
      v.da === DA_AUTOMATICO &&
      PROMEMORIA_DA_CONFERMARE.includes(v.motivo ?? "") &&
      delMeet(v, giornoMeet),
  );
  if (i < 0) return null;
  if (!voci.slice(i + 1).every(automaticoSenzaRisposta)) return null;
  const il = Date.parse(voci[i].il);
  if (adesso.getTime() - il < ORE_PER_CONFERMARE * ORA_MS) return null;
  return { inizio, promemoriaIl: new Date(il) };
}

/** Una persona della sala d'attesa: basta l'ora (ms) dell'ultima volta che si è fatta viva. */
export interface BussataSala {
  at: number;
}

export type EsitoAssenza =
  | { tipo: "sposta"; patch: Partial<LeadData> & { assenzaAuto: AssenzaAuto } }
  | { tipo: "segnala"; patch: { assenzaSegnalata: AssenzaAuto } }
  | { tipo: "lascia"; motivo: string };

const dueCifre = (n: number) => String(n).padStart(2, "0");

/** ── (12) NESSUNO IN STANZA 15' DOPO L'INIZIO ─────────────────────────────
 *  `sala`: le persone della riga `sala_attesa:<codice>` così come sono salvate
 *  (anche quelle già uscite) più la presenza che non si pota (`{ at: visto }`);
 *  `null` = la consulenza non ha una stanza Meetly.
 *  `acceso`: l'interruttore `assenza_auto`. Spento → `segnala`, una volta per
 *  consulenza; acceso → `sposta`.
 *  `null` in uscita = la scheda non è affar suo (nessun appuntamento in questa
 *  finestra); `lascia` = sarebbe affar suo, ma nel dubbio resta com'è. */
export function decidiAssenza(
  d: Partial<LeadData> | null | undefined,
  adesso: Date,
  sala: BussataSala[] | null,
  acceso = true,
): EsitoAssenza | null {
  if (!d || !eAppuntamento(d.stato)) return null;
  const inizio = inizioConsulenza(d);
  if (!inizio) return null;
  const da = inizio.getTime();
  const passati = adesso.getTime() - da;
  if (passati < ASSENZA_DOPO_MIN * MIN_MS || passati > ASSENZA_ENTRO_MIN * MIN_MS) return null;
  const lascia = (motivo: string): EsitoAssenza => ({ tipo: "lascia", motivo });
  if (!String(d.consulenteId ?? "").trim()) return lascia("senza consulente");
  if (sala === null) return lascia("senza stanza Meetly: non si sa se è entrato");
  if (sala.some((p) => Number(p?.at) >= da - PRESENZA_DA_MIN * MIN_MS))
    return lascia("è entrato in stanza");
  const c = d.contattoWa;
  const ultimaRisposta = [c, ...(c?.storia ?? [])]
    .filter((v): v is VoceContattoWa => v?.stato === "ha_risposto")
    .map((v) => Date.parse(v.il))
    .filter(Number.isFinite);
  if (ultimaRisposta.some((t) => t >= da - RISPOSTA_RECENTE_ORE * ORA_MS))
    return lascia("ha scritto da poco: decide il consulente");

  const iso = adesso.toISOString();
  const meet = meetDi(d) as string;
  if (!acceso) {
    //  Una volta sola per consulenza: il giro passa ogni 5' e non riscrive la scheda.
    if ((d as SchedaConAssenza).assenzaSegnalata?.meet === meet) return null;
    return { tipo: "segnala", patch: { assenzaSegnalata: { il: iso, meet } } };
  }
  const r = aRoma(adesso);
  const [, mese, giorno] = r.giorno.split("-");
  const ora = oraNormale(d.oraMeeting) as string;
  const riga =
    `${giorno}/${mese} ${dueCifre(Math.floor(r.minuti / 60))}:${dueCifre(r.minuti % 60)} · ` +
    `Non si è collegato alla consulenza delle ${ora}: messo in «Da riprogrammare» in automatico`;
  return {
    tipo: "sposta",
    patch: {
      stato: "da_spostare",
      statoPrecedente: d.stato as LeadStatus,
      statoPrecedenteIl: iso,
      statoDal: iso,
      note: conNota(d.note, riga),
      assenzaAuto: { il: iso, meet },
    },
  };
}

/** La scheda è in «Da riprogrammare» perché l'ha spostata `decidiAssenza`, e
 *  da allora lo stato non è cambiato: il messaggio dello stato parte subito. */
export function eAssenzaAutomatica(d: Partial<LeadData> | null | undefined): boolean {
  const a = (d as SchedaConAssenza | null | undefined)?.assenzaAuto;
  return d?.stato === "da_spostare" && !!a?.il && a.il === d.statoDal;
}

/** La consulenza ancora in piedi della scheda è quella segnalata come «non è
 *  entrato» (interruttore spento): la pagina «Da fare» ne fa una telefonata. */
export function assenzaSegnalataDi(d: Partial<LeadData> | null | undefined): AssenzaAuto | null {
  if (!d || !eAppuntamento(d.stato)) return null;
  const a = (d as SchedaConAssenza).assenzaSegnalata;
  return a?.meet && a.meet === meetDi(d) ? a : null;
}

/** ── IL GIRO, CON LE PORTE DA FUORI (prove: database finto) ──────────────── */
export interface RigaScheda {
  id: string;
  data: Partial<LeadData>;
  updated_at: string;
}
export interface PorteAssenza {
  /** l'interruttore `assenza_auto` */
  acceso(): Promise<boolean>;
  /** gli appuntamenti in piedi di ieri e di oggi */
  appuntamenti(adesso: Date): Promise<RigaScheda[]>;
  /** sala d'attesa + presenza che non si pota; `null` = nessuna stanza Meetly */
  presenze(d: Partial<LeadData>): Promise<BussataSala[] | null>;
  /** scrive SOLO se `updated_at` è ancora quello letto; `false` = cambiata nel frattempo */
  scrivi(r: RigaScheda, data: Partial<LeadData>, adesso: Date): Promise<boolean>;
}

export async function giroAssenza(porte: PorteAssenza, adesso: Date) {
  const acceso = await porte.acceso();
  const schede = await porte.appuntamenti(adesso);
  const conto = {
    acceso,
    appuntamenti: schede.length,
    spostati: 0,
    segnalati: 0,
    lasciati: 0,
    cambiatiNelFrattempo: 0,
  };
  for (const r of schede) {
    //  Prima la regola senza sala (finestra, stato, già segnalata): la sala si
    //  legge solo per chi sarebbe davvero da toccare.
    if (!decidiAssenza(r.data, adesso, [], acceso)) continue;
    const esito = decidiAssenza(r.data, adesso, await porte.presenze(r.data), acceso);
    if (!esito) continue;
    if (esito.tipo === "lascia") {
      conto.lasciati++;
      continue;
    }
    if (await porte.scrivi(r, { ...r.data, ...esito.patch }, adesso)) {
      if (esito.tipo === "sposta") conto.spostati++;
      else conto.segnalati++;
    } else conto.cambiatiNelFrattempo++;
  }
  return conto;
}
