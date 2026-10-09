/** ── LA STESSA PERSONA, DUE SCHEDE ─────────────────────────────────────────
 *
 *  ── IL NUMERO CHE HA FATTO NASCERE QUESTO FILE ───────────────────────────
 *  Misurato in archivio il 7/10/2026: **ventinove numeri di telefono con due
 *  schede a testa, cinquantotto schede in tutto**. Non casi di scuola —
 *  *Cristiano Sibilia* stava sia in «da ricontattare» che in «acconto
 *  incassato»; *Roberto Tola* in «sta valutando» e in «da gestire in chat».
 *  Due storie della stessa persona, e chi la chiama ne legge una a caso.
 *
 *  L'avviso del campo rosso (crm/telefono-doppio) scatta solo quando si DIGITA
 *  un numero già presente: non trova niente di quello che è già dentro, e
 *  soprattutto non esisteva, in tutto il programma, nessun modo di UNIRE due
 *  schede. Qui ci sono i due pezzi che mancavano: trovarle, e fonderle senza
 *  perdere niente.
 *
 *  ── COME SI UNISCONO, E PERCHÉ COSÌ ──────────────────────────────────────
 *  Una resta (la **principale**) e l'altra viene **assorbita**. Sulla
 *  principale si copiano SOLO i campi che le mancano: quello che c'è già non
 *  si tocca mai. L'assorbita non si cancella — si segna da dove è andata
 *  (`unitoIn`) e si mette da parte, così esce dagli elenchi senza sparire
 *  dall'archivio.
 *
 *  ⚠️ NON SI CANCELLA NIENTE, MAI. Un'unione è un'ipotesi: due fratelli con lo
 *   stesso numero di casa sono due persone. Se si butta via la seconda scheda,
 *   quando si scopre l'errore non c'è più niente da rimettere a posto. Si
 *   mette da parte: è reversibile, e si vede.
 *  ⚠️ NON SI SOVRASCRIVE NIENTE. «Unire» non vuol dire che l'ultima arrivata
 *   vince: vuol dire riempire i buchi. Una nota, un appuntamento, uno stato
 *   avanzato che sparissero perché l'altra scheda era più nuova sarebbero
 *   esattamente la perdita che questo file esiste per evitare.
 *  ⚠️ «STESSO NUMERO» LO DECIDE `chiaveTelefono`, come dappertutto: la stessa
 *   funzione che fa diventare rosso il campo e che l'importazione usa per
 *   riconoscere i contatti di ritorno. Una terza idea di «stesso numero» qui
 *   dentro vorrebbe dire una schermata che mostra doppioni che per il resto
 *   del programma non esistono.
 *  ⚠️ «NON È LA STESSA PERSONA» È UNA RISPOSTA, e va ricordata: senza, la
 *   stessa coppia ricompare ogni volta che si apre la pagina e alla terza
 *   nessuno la guarda più.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Lead, LeadData, LeadStatus } from "@/crm/types";
import { eChiusuraVinta, eStatoDaChiamare } from "@/crm/types";
import { chiaveTelefono } from "./telefono-doppio";

export interface GruppoDoppio {
  /** Le ultime nove cifre: è l'impronta del numero. */
  chiave: string;
  /** Le schede, con la principale sempre per prima. */
  schede: Lead[];
}

/** Le schede già unite non sono più in gioco. */
export const eAssorbita = (l?: Lead | null): boolean => !!String(l?.data?.unitoIn || "").trim();

/** Qualcuno ha già detto «non è la stessa persona» su questa coppia? */
export function dichiarateDiverse(a?: Lead | null, b?: Lead | null): boolean {
  const ida = String(a?.id || "");
  const idb = String(b?.id || "");
  if (!ida || !idb) return false;
  const da = a?.data?.nonDoppioneDi ?? [];
  const db = b?.data?.nonDoppioneDi ?? [];
  return da.includes(idb) || db.includes(ida);
}

/** ── QUALE DELLE DUE RESTA ─────────────────────────────────────────────────
 *  Si tiene quella con la STORIA PIÙ AVANTI, non la più recente: una scheda
 *  creata ieri da un modulo del sito è vuota, e tenerla al posto di quella con
 *  sei mesi di trattativa dentro vorrebbe dire unire al contrario.
 *  L'ordine delle domande: ha comprato → non è più da chiamare → ha più campi
 *  pieni → è più vecchia (ha avuto più tempo per accumulare storia). */
export function pesoDiStoria(l?: Lead | null): number {
  const d: Partial<LeadData> = l?.data ?? {};
  const stato = String(d.stato ?? "") as LeadStatus;
  let p = 0;
  if (eChiusuraVinta(stato)) p += 10_000;
  if (stato && !eStatoDaChiamare(stato)) p += 1_000;
  //  Quanti campi dicono davvero qualcosa: è la misura più onesta di «quanta
  //  storia c'è dentro», e non dipende da quali campi esistono oggi.
  p +=
    Object.values(d).filter(
      (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    ).length * 10;
  return p;
}

export function principaleDi(schede: Lead[]): Lead | null {
  const buone = (schede ?? []).filter(Boolean);
  if (!buone.length) return null;
  return [...buone].sort((a, b) => {
    const d = pesoDiStoria(b) - pesoDiStoria(a);
    if (d !== 0) return d;
    //  A pari storia vince la più vecchia: è quella a cui puntano i link, i
    //  preventivi e le fatture già mandate.
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  })[0];
}

/** ── I GRUPPI DA GUARDARE ──────────────────────────────────────────────────
 *  Solo numeri con due o più schede ancora in gioco, principale per prima, e
 *  in cima i gruppi più numerosi. */
export function doppioniPerTelefono(leads?: Lead[] | null): GruppoDoppio[] {
  const per = new Map<string, Lead[]>();
  for (const l of leads ?? []) {
    if (!l?.data || eAssorbita(l)) continue;
    const k = chiaveTelefono(l.data.telefono);
    if (!k) continue;
    const dentro = per.get(k);
    if (dentro) dentro.push(l);
    else per.set(k, [l]);
  }
  const fuori: GruppoDoppio[] = [];
  for (const [chiave, schede] of per) {
    if (schede.length < 2) continue;
    //  ⚠️ Una coppia su cui qualcuno ha già risposto «non è la stessa persona»
    //   non si ripropone: a gruppi di due sparisce, a gruppi di tre resta ma
    //   senza quella coppia — ed è giusto, perché le altre due non le ha
    //   ancora guardate nessuno.
    const vive = schede.filter((a) => schede.some((b) => b !== a && !dichiarateDiverse(a, b)));
    if (vive.length < 2) continue;
    const capo = principaleDi(vive);
    fuori.push({
      chiave,
      schede: capo ? [capo, ...vive.filter((x) => x !== capo)] : vive,
    });
  }
  return fuori.sort((a, b) => b.schede.length - a.schede.length);
}

/** I campi che NON si copiano mai da una scheda all'altra: sono quelli che
 *  raccontano la riga in quanto riga, non la persona. */
const MAI_COPIATI = new Set<string>([
  "stato",
  "statoDa",
  "saltatoIl",
  "saltatoDa",
  "ricarico",
  "unitoIn",
  "unitoIl",
  "nonDoppioneDi",
  "ripescatoIl",
  "ripescatoDa",
  "ripescatoVolte",
  "importato",
  "createdAt",
]);

/** ── QUELLO CHE LA PRINCIPALE SI PRENDE ────────────────────────────────────
 *  Solo i buchi: ogni campo che la principale non ha e l'altra sì.
 *  ⚠️ LO STATO NON SI COPIA MAI, e non è una dimenticanza: lo stato dice a che
 *   punto è il discorso con quella persona, e due schede hanno due discorsi.
 *   Prenderlo dall'assorbita vorrebbe dire far tornare indietro — o avanti —
 *   una trattativa con un clic che prometteva solo di «unire i dati».
 *  ⚠️ E LE NOTE SI SOMMANO, non si sostituiscono: sono la cosa per cui si
 *   unisce. Una nota persa qui è il motivo per cui qualcuno richiamerà quella
 *   persona dicendole una cosa che aveva già detto di no. */
export function patchUnione(principale?: Lead | null, assorbita?: Lead | null): Partial<LeadData> {
  const a: Partial<LeadData> = principale?.data ?? {};
  const b: Partial<LeadData> = assorbita?.data ?? {};
  const fuori: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) {
    if (MAI_COPIATI.has(k)) continue;
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    const mio = (a as Record<string, unknown>)[k];
    const vuoto =
      mio === undefined || mio === null || mio === "" || (Array.isArray(mio) && !mio.length);
    if (vuoto) fuori[k] = v;
  }
  //  Le note sono il motivo per cui si unisce: si mettono in fila, con una
  //  riga che dice da dove arriva la seconda.
  const noteA = String(a.note ?? "").trim();
  const noteB = String(b.note ?? "").trim();
  if (noteB && noteB !== noteA) {
    fuori.note = noteA
      ? `${noteA}\n\n— dalla scheda unita (${nomeDi(assorbita)}) —\n${noteB}`
      : noteB;
  }
  return fuori as Partial<LeadData>;
}

const nomeDi = (l?: Lead | null): string =>
  `${l?.data?.nome ?? ""} ${l?.data?.cognome ?? ""}`.trim() || "senza nome";

/** Quello che si scrive sulla scheda ASSORBITA: da dove è andata, e via dagli
 *  elenchi. Non si cancella niente. */
export function patchAssorbita(
  principale?: Lead | null,
  chi?: string,
  ora: Date = new Date(),
): Partial<LeadData> {
  const id = String(principale?.id || "");
  if (!id) return {};
  return {
    unitoIn: id,
    unitoIl: ora.toISOString(),
    //  Messa da parte: esce dalla coda e dagli elenchi senza sparire
    //  dall'archivio. È lo stesso gesto del «salta», e si disfa allo stesso
    //  modo.
    saltatoIl: ora.toISOString(),
    ...(String(chi || "").trim() ? { saltatoDa: String(chi).trim() } : {}),
  };
}

/** «Non è la stessa persona»: la risposta si ricorda su TUTTE E DUE le schede,
 *  perché la coppia si può ritrovare da una parte o dall'altra. */
export function patchNonDoppione(mia?: Lead | null, altra?: Lead | null): Partial<LeadData> {
  const id = String(altra?.id || "");
  if (!id) return {};
  const gia = mia?.data?.nonDoppioneDi ?? [];
  if (gia.includes(id)) return {};
  return { nonDoppioneDi: [...gia, id] };
}
