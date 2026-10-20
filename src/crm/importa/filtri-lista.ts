/** ── I FILTRI DELLA LISTA DEI LEAD IMPORTATI ───────────────────────────────
 *
 *  La setter apre «Lead importati» e vuole restringere la lista con tre mani:
 *    ANNUNCIO   da quale gruppo di annunci / annuncio è arrivato (adset, ad)
 *    RISPOSTA   cosa ha risposto nel modulo (Problema, Fastidio, Zona…)
 *    STATO      perché è in lista (mai chiamato, da ritentare, promessa…)
 *  più la fetta di tempo che esisteva già.
 *
 *  Tutto qui è funzione pura: la pagina costruisce le righe, queste funzioni
 *  filtrano e contano. Niente React, niente rete, e quindi tutto provato in
 *  `proveDeiFiltriDellaLista`.
 *
 *  ⚠️ IL NUMERO ACCANTO A UNA VOCE È QUELLO CHE ESCE PREMENDOLA. Ogni
 *   dimensione si conta con gli ALTRI filtri già applicati e mai con il proprio:
 *   altrimenti, scelto un annuncio, i conti delle risposte direbbero «areata 4»
 *   e premendo ne uscirebbero 2. Per le risposte il «proprio» è la singola
 *   domanda: scelto Problema = areata, i numeri di Zona si contano fra le
 *   areata, mentre quelli di Problema restano tutti visibili per poter cambiare.
 *  ⚠️ UNA VOCE ACCESA COMPARE ANCHE A ZERO. Un annuncio spento da Meta, una
 *   risposta che nessuno ha più dato: il filtro nell'indirizzo resta valido, la
 *   lista è vuota e il suo chip si deve vedere per poterlo spegnere.
 *  ⚠️ NELL'INDIRIZZO LE RISPOSTE SONO UN ARRAY. Una risposta scritta a mano può
 *   contenere una virgola («chiazze, sulla nuca»): spezzare una stringa sulle
 *   virgole la romperebbe a metà e il filtro non troverebbe più nessuno. */

import type {
  LeadData,
  LeadStatus,
  MotivoChiamata,
  RisposteModulo,
  TrackingInfo,
  CampoModulo,
} from "../types";
import { CAMPI_MODULO } from "../types";
import { dentroLaFetta, FETTE_TEMPO, type FettaTempo } from "../quando-stato";
import { inAttesaWhatsapp } from "./attesa-whatsapp";
import { etichettaRisposta, pulisci, titoloDomanda, type DomandaModulo } from "../modulo-lead";

/** ⚠️ LE VOCI IN VISTA (20/10/2026): il titolare le vuole separate come prima
 *  del 12/10 — Non risponde, Segreteria, Richiamo concordato, Ci ricontatta
 *  lui — più «Attesa WhatsApp». «ritentare» e «promesse» (le coppie di prima)
 *  restano valide per gli indirizzi già salvati, ma non sono più pulsanti. */
export type StatoFiltro =
  | "tutti"
  | "mai"
  | "nonRisponde"
  | "segreteria"
  | "ritentare"
  | "richiamo"
  | "ciRicontatta"
  | "promesse"
  | "whatsapp"
  | "ritorno";

export const STATI_FILTRO: StatoFiltro[] = [
  "tutti",
  "mai",
  "nonRisponde",
  "segreteria",
  "ritentare",
  "richiamo",
  "ciRicontatta",
  "promesse",
  "whatsapp",
  "ritorno",
];

/** La riga cade nella voce `scelta` del filtro Stato?
 *  «Non risponde»/«Segreteria» sono le due metà di «Da ritentare», «Richiamo
 *  concordato»/«Ci ricontatta lui» quelle di «Promesse»: si riconoscono dallo
 *  stato della scheda. «Attesa WhatsApp» guarda il messaggio inviato
 *  (crm/importa/attesa-whatsapp) e si somma alle altre: chi è in attesa resta
 *  anche nel suo stato. */
export function cadeNelloStato(
  motivo: MotivoChiamata,
  d: Partial<LeadData>,
  scelta: StatoFiltro,
): boolean {
  if (scelta === "tutti") return true;
  if (scelta === "whatsapp") return inAttesaWhatsapp(d);
  //  ⚠️ I PULSANTI DI UNO STATO GUARDANO LO STATO DELLA SCHEDA, non il motivo
  //   della chiamata: un «richiamo» senza giorno ha motivo «ritento» e finiva
  //   sotto «Non risponde» (revisione del 20/10/2026). «Mostra solo quei
  //   contatti» vuol dire: con quello stato.
  const stato = d.stato;
  if (scelta === "mai") return stato === "da_contattare";
  if (scelta === "nonRisponde") return stato === "non_risponde";
  if (scelta === "segreteria") return stato === "segreteria";
  if (scelta === "richiamo") return stato === "richiamo";
  if (scelta === "ciRicontatta") return stato === "ci_ricontatta_lui";
  //  Le voci di prima (indirizzi salvati) e «Di ritorno» restano sul motivo.
  return statoDelFiltro(motivo, stato) === scelta;
}

export interface FiltriLista {
  /** `senza`, `g:<gruppo>` oppure `a:<gruppo>␟<annuncio>`. */
  annuncio?: string;
  /** Chiavi `<campo>|<id>` oppure `<campo>|t:<testo ripulito>`; al massimo una per domanda. */
  risposte?: string[];
  stato?: StatoFiltro;
  quando?: FettaTempo;
}

/** Una riga della lista. La pagina la costruisce con il motivo di T3 e il
 *  modulo letto di T2; qui si guarda soltanto. */
export interface RigaDaFiltrare {
  id: string;
  data: Partial<LeadData>;
  motivo: MotivoChiamata;
  modulo?: RisposteModulo;
}

/** Il separatore fra gruppo e annuncio nelle chiavi: un carattere che nei nomi
 *  di Meta non c'è («|», «-», «€» sì). */
const SEP = "␟";
export const SENZA = "senza";
export const GRUPPO_SENZA_ANNUNCIO = "Liste senza annuncio";

const pulito = (t: string | undefined) =>
  String(t ?? "")
    .replace(/\s+/g, " ")
    .trim();

/* ═══ ANNUNCIO ═══════════════════════════════════════════════════════════ */

export function etichettaAnnuncio(t?: TrackingInfo): {
  chiaveGruppo: string;
  gruppo: string;
  chiaveAnnuncio: string | null;
  annuncio: string | null;
} {
  const gruppoVero = pulito(t?.adset_name) || pulito(t?.campaign_name);
  const annuncio = pulito(t?.ad_name) || null;
  const gruppo = gruppoVero || GRUPPO_SENZA_ANNUNCIO;
  return {
    chiaveGruppo: gruppoVero ? `g:${gruppoVero}` : SENZA,
    gruppo,
    chiaveAnnuncio: annuncio ? `a:${gruppo}${SEP}${annuncio}` : null,
    annuncio,
  };
}

/** Il gruppo e l'annuncio dentro una chiave dell'indirizzo, per mostrare una
 *  voce accesa che non esiste più. */
function apriChiaveAnnuncio(chiave: string): {
  chiaveGruppo: string;
  gruppo: string;
  annuncio: string | null;
} {
  if (chiave === SENZA)
    return { chiaveGruppo: SENZA, gruppo: GRUPPO_SENZA_ANNUNCIO, annuncio: null };
  if (chiave.startsWith("g:"))
    return { chiaveGruppo: chiave, gruppo: chiave.slice(2), annuncio: null };
  const resto = chiave.slice(2);
  const i = resto.indexOf(SEP);
  const gruppo = resto.slice(0, i);
  return {
    chiaveGruppo: gruppo === GRUPPO_SENZA_ANNUNCIO ? SENZA : `g:${gruppo}`,
    gruppo,
    annuncio: resto.slice(i + 1),
  };
}

/* ═══ STATO ══════════════════════════════════════════════════════════════ */

/** In quale voce del filtro Stato cade una riga, dato il suo motivo. */
export function statoDelFiltro(
  motivo: MotivoChiamata,
  stato?: LeadStatus,
): "mai" | "ritentare" | "promesse" | "ritorno" {
  switch (motivo) {
    case "promessa":
      return "promesse";
    case "ritorno":
      return "ritorno";
    case "nuovo":
    case "prima":
      return "mai";
    case "ritento":
      return "ritentare";
    case "suaOra":
      //  È la sua ora: se non l'abbiamo mai chiamato è una prima chiamata.
      return stato === "da_contattare" ? "mai" : "ritentare";
  }
}

/* ═══ RISPOSTA ═══════════════════════════════════════════════════════════ */

export interface ValoreRisposta {
  campo: CampoModulo;
  titolo: string;
  chiave: string;
  etichetta: string;
}

/** Le risposte di un lead che il filtro sa contare: solo le 7 domande note,
 *  una voce per domanda. Le domande sconosciute restano nella scheda e nei KPI:
 *  un elenco di testi liberi nel filtro non finirebbe mai. */
export function valoriRisposta(m?: RisposteModulo): ValoreRisposta[] {
  if (!m) return [];
  const out: ValoreRisposta[] = [];
  for (const campo of CAMPI_MODULO) {
    const titolo = titoloDomanda(campo);
    const id = m[campo];
    if (id) {
      out.push({
        campo,
        titolo,
        chiave: `${campo}|${id}`,
        etichetta: etichettaRisposta(campo, id),
      });
      continue;
    }
    //  Scritta com'è: a mano («giovedì dopo le 19») o con una domanda nostra
    //  ma una risposta che non sappiamo ricondurre a un codice.
    const testo =
      campo === "quando" && m.quandoTesto
        ? m.quandoTesto
        : (m.risposte ?? []).find((r) => r.campo === campo || (!r.campo && r.domanda === titolo))
            ?.risposta;
    const chiaveTesto = pulisci(testo ?? "");
    if (!chiaveTesto) continue;
    out.push({ campo, titolo, chiave: `${campo}|t:${chiaveTesto}`, etichetta: pulito(testo) });
  }
  return out;
}

/** Campo e resto di una chiave `campo|…`; niente se non è una chiave nostra. */
function apriChiaveRisposta(chiave: string): { campo: CampoModulo; resto: string } | null {
  const i = chiave.indexOf("|");
  if (i < 1) return null;
  const campo = chiave.slice(0, i) as CampoModulo;
  const resto = chiave.slice(i + 1);
  if (!CAMPI_MODULO.includes(campo) || !resto) return null;
  return { campo, resto };
}

/** Come si legge una chiave che nessuna riga ha più. */
function etichettaDiChiave(chiave: string): string {
  const a = apriChiaveRisposta(chiave);
  if (!a) return chiave;
  if (a.resto.startsWith("t:")) {
    const t = a.resto.slice(2);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return etichettaRisposta(a.campo, a.resto);
}

/** Al massimo una risposta per domanda: se ce ne sono due, vale l'ultima
 *  (è l'ultima che la persona ha premesso). L'ordine di chi resta non cambia. */
function unaPerDomanda(chiavi: string[]): string[] {
  const ultima = new Map<string, number>();
  chiavi.forEach((k, i) => ultima.set(apriChiaveRisposta(k)?.campo ?? k, i));
  return chiavi.filter((k, i) => ultima.get(apriChiaveRisposta(k)?.campo ?? k) === i);
}

/* ═══ APPLICARE I FILTRI ═════════════════════════════════════════════════ */

/** Quali filtri lasciar fuori da un conto: la dimensione che si sta contando. */
interface Escludi {
  annuncio?: boolean;
  campo?: CampoModulo;
  stato?: boolean;
  quando?: boolean;
}

function passa(r: RigaDaFiltrare, f: FiltriLista, oggi: string, no: Escludi = {}): boolean {
  if (f.annuncio && !no.annuncio) {
    const e = etichettaAnnuncio(r.data.tracking);
    if (f.annuncio !== e.chiaveGruppo && f.annuncio !== e.chiaveAnnuncio) return false;
  }
  if (f.stato && f.stato !== "tutti" && !no.stato) {
    if (!cadeNelloStato(r.motivo, r.data, f.stato)) return false;
  }
  if (f.quando && !no.quando && !dentroLaFetta(r.data, f.quando, oggi)) return false;
  const scelte = unaPerDomanda(f.risposte ?? []);
  if (scelte.length) {
    const sue = new Set(valoriRisposta(r.modulo).map((v) => v.chiave));
    for (const k of scelte) {
      if (no.campo && apriChiaveRisposta(k)?.campo === no.campo) continue;
      if (!sue.has(k)) return false;
    }
  }
  return true;
}

/** Le righe che passano tutti i filtri, in E. Non cambia l'ordine né l'elenco
 *  di partenza. */
export function applicaFiltri<R extends RigaDaFiltrare>(
  righe: R[],
  f: FiltriLista,
  oggi: string,
): R[] {
  return righe.filter((r) => passa(r, f, oggi));
}

/* ═══ LE VOCI DEI MENU, CON I LORO NUMERI ════════════════════════════════ */

export interface OpzioniFiltri {
  annuncio: {
    chiave: string;
    gruppo: string;
    n: number;
    annunci: { chiave: string; annuncio: string; n: number }[];
  }[];
  risposte: {
    campo: CampoModulo;
    titolo: string;
    voci: { chiave: string; etichetta: string; n: number }[];
  }[];
  stato: { valore: StatoFiltro; n: number }[];
  quando: { valore: FettaTempo; n: number }[];
}

const perNumero = <T extends { n: number }>(a: T, b: T, nome: (x: T) => string) =>
  b.n - a.n || nome(a).localeCompare(nome(b), "it");

export function opzioniFiltri(
  righe: RigaDaFiltrare[],
  f: FiltriLista,
  oggi: string,
): OpzioniFiltri {
  //  ── Annuncio: conta senza il filtro annuncio ────────────────────────────
  const gruppi = new Map<
    string,
    {
      chiave: string;
      gruppo: string;
      n: number;
      annunci: Map<string, { chiave: string; annuncio: string; n: number }>;
    }
  >();
  const gruppoDi = (chiave: string, gruppo: string) => {
    let g = gruppi.get(chiave);
    if (!g) gruppi.set(chiave, (g = { chiave, gruppo, n: 0, annunci: new Map() }));
    return g;
  };
  for (const r of righe) {
    if (!passa(r, f, oggi, { annuncio: true })) continue;
    const e = etichettaAnnuncio(r.data.tracking);
    const g = gruppoDi(e.chiaveGruppo, e.gruppo);
    g.n++;
    if (e.chiaveAnnuncio && e.annuncio) {
      const a = g.annunci.get(e.chiaveAnnuncio) ?? {
        chiave: e.chiaveAnnuncio,
        annuncio: e.annuncio,
        n: 0,
      };
      a.n++;
      g.annunci.set(e.chiaveAnnuncio, a);
    }
  }
  //  La voce accesa che non ha più nessuno si aggiunge a zero.
  if (f.annuncio) {
    const a = apriChiaveAnnuncio(f.annuncio);
    const g = gruppoDi(a.chiaveGruppo, a.gruppo);
    if (a.annuncio !== null && !g.annunci.has(f.annuncio)) {
      g.annunci.set(f.annuncio, { chiave: f.annuncio, annuncio: a.annuncio, n: 0 });
    }
  }
  const annuncio = [...gruppi.values()]
    .map((g) => ({
      chiave: g.chiave,
      gruppo: g.gruppo,
      n: g.n,
      annunci: [...g.annunci.values()].sort((a, b) => perNumero(a, b, (x) => x.annuncio)),
    }))
    //  ⚠️ «Liste senza annuncio» sta sempre in fondo, anche se ha più lead: non è
    //   un annuncio da scegliere ma il mucchio di quelli che non ne hanno uno.
    .sort(
      (a, b) =>
        Number(a.chiave === SENZA) - Number(b.chiave === SENZA) || perNumero(a, b, (x) => x.gruppo),
    );

  //  ── Risposte: ogni domanda si conta senza il proprio filtro ─────────────
  const scelte = unaPerDomanda(f.risposte ?? []);
  const risposte: OpzioniFiltri["risposte"] = [];
  for (const campo of CAMPI_MODULO) {
    const voci = new Map<string, { chiave: string; etichetta: string; n: number }>();
    let titolo = titoloDomanda(campo);
    for (const r of righe) {
      if (!passa(r, f, oggi, { campo })) continue;
      const v = valoriRisposta(r.modulo).find((x) => x.campo === campo);
      if (!v) continue;
      titolo = v.titolo;
      const x = voci.get(v.chiave) ?? { chiave: v.chiave, etichetta: v.etichetta, n: 0 };
      x.n++;
      voci.set(v.chiave, x);
    }
    const accesa = scelte.find((k) => apriChiaveRisposta(k)?.campo === campo);
    if (accesa && !voci.has(accesa))
      voci.set(accesa, { chiave: accesa, etichetta: etichettaDiChiave(accesa), n: 0 });
    if (!voci.size) continue;
    risposte.push({
      campo,
      titolo,
      voci: [...voci.values()].sort((a, b) => perNumero(a, b, (x) => x.etichetta)),
    });
  }

  //  ── Stato e tempo: contano con tutti gli altri filtri ───────────────────
  const stato = STATI_FILTRO.map((valore) => ({
    valore,
    n: righe.filter((r) => passa(r, { ...f, stato: valore }, oggi)).length,
  }));
  const quando = FETTE_TEMPO.map((valore) => ({
    valore,
    n: righe.filter((r) => passa(r, { ...f, quando: valore }, oggi)).length,
  }));

  return { annuncio, risposte, stato, quando };
}

/* ═══ L'INDIRIZZO ════════════════════════════════════════════════════════ */

/** Legge i parametri dell'indirizzo e scarta tutto ciò che non conosce: un
 *  indirizzo vecchio o scritto a mano non deve rompere la pagina né tenere
 *  accesi filtri che nessuno vede. `risposte` è un array (TanStack lo scrive in
 *  JSON); una stringa sola diventa una chiave sola e NON si spezza sulle
 *  virgole. */
export function leggiRicercaImporta(raw: Record<string, unknown>): FiltriLista {
  const out: FiltriLista = {};
  const a = raw.annuncio;
  if (
    typeof a === "string" &&
    (a === SENZA || (/^[ag]:./.test(a) && (a[0] === "g" || a.includes(SEP))))
  ) {
    out.annuncio = a;
  }
  const grezze = Array.isArray(raw.risposte)
    ? raw.risposte
    : typeof raw.risposte === "string"
      ? [raw.risposte]
      : [];
  const buone = unaPerDomanda(
    grezze.filter((k): k is string => typeof k === "string" && apriChiaveRisposta(k) !== null),
  );
  if (buone.length) out.risposte = buone;
  if (typeof raw.stato === "string" && (STATI_FILTRO as string[]).includes(raw.stato))
    out.stato = raw.stato as StatoFiltro;
  if (typeof raw.quando === "string" && (FETTE_TEMPO as string[]).includes(raw.quando))
    out.quando = raw.quando as FettaTempo;
  return out;
}
