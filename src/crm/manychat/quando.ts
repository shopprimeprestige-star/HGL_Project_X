/** ── CHI TOCCA ADESSO ──────────────────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 2 (Dev A). Le prove
 *  stanno in `prove/manychat/quando.mjs`.
 *
 *  Modulo PURO: l'orologio e il numero a caso arrivano da fuori.
 *
 *  ── LE REGOLE (PIANO §2a, SPEC §6-7) ──────────────────────────────────────
 *   - promemoria: bersaglio −25' dal meet, si accetta da −30' a −15'; oltre →
 *     «saltato: giro in ritardo». Chiave `p|tel9|AAAA-MM-GGTHH:MM`. Al massimo 3
 *     promemoria per telefono e giorno di meet.
 *     ⚠️ Prima del bersaglio NON parte: alle −30' si aspetta ancora. Il −30' è
 *      il limite di quanto il modello può dire «tra circa 25 minuti» senza
 *      mentire, non un invito a partire prima (la prova a secco del PO dice
 *      «meet 15:30 → promemoria alle 15:05»). La tolleranza vera è dopo: dalle
 *      −25' alle −15' il giro ha dieci minuti per arrivarci.
 *   - ricontatti: chiave `r|tel9|AAAA-MM-GG`; il giorno è `dataRicontatto` o
 *     quello di `callbackAt`; `oraRicontatto` facoltativa; dalle 9 alle 20 da
 *     lunedì a sabato, ora di Roma; recupero il giorno lavorativo dopo, UNA
 *     volta; mai una data precedente a `ultimaAccensione`. Due schede con lo
 *     stesso telefono fanno UNA voce.
 *   - ritmo fra due ricontatti: 27-33 minuti (numero casuale passato da fuori).
 *   - tetti: il minimo fra il valore del riquadro e le costanti qui sotto. Le
 *     costanti non si alzano da nessuna parte (né dal riquadro né dal browser).
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Consultant, LeadData } from "../types";
import { eAppuntamento } from "../types";
import { aRoma, oraNormale } from "../promemoria/formati";
import { istanteDiRoma } from "./contatto";
import {
  FRENO_ANCHE_PER_PROMEMORIA,
  STATI_ARRIVATI,
  aspettaRisposta,
  consensoWhatsapp,
  eImportato,
  eLeadDelConsulente,
  numeroWa,
  ultimeNoveCifre,
  type InvioPerFreno,
} from "./regole";
import { campiPromemoria, campiRicontatto } from "./testi";

/** Ricontatti al giorno. */
export const TETTO_RICONTATTI = 20;
/** Messaggi automatici in tutto al giorno (promemoria + ricontatti). */
export const TETTO_TOTALE = 40;
/** Ricontatti al giorno nei primi 7 giorni da `primaAccensione`. */
export const TETTO_PRIMA_SETTIMANA = 10;
/** Il ritmo fra due ricontatti, in minuti. */
export const RITMO_MIN = 27;
export const RITMO_MAX = 33;
/** Nessun nuovo invio a un telefono che ne ha avuto uno negli ultimi N secondi
 *  (le variabili `crm_*` stanno sul contatto: due invii vicini si pesterebbero). */
export const PAUSA_CONTATTO_S = 120;

/** Il promemoria ha il suo bersaglio a −25' dal meet… */
export const ANTICIPO_PROMEMORIA_MIN = 25;
/** …e si accetta fino a −15': oltre è «giro in ritardo». */
export const LIMITE_RITARDO_PROMEMORIA_MIN = 15;
/** Al massimo tre promemoria per telefono e giorno di meet. */
export const MAX_PROMEMORIA_PER_GIORNO = 3;
/** I ricontatti escono dalle 9:00 (compresa) alle 20:00 (esclusa), ora di Roma. */
export const APERTURA_RICONTATTI_MIN = 9 * 60;
export const CHIUSURA_RICONTATTI_MIN = 20 * 60;
/** La «prima settimana» dei tetti: i giorni dalla prima accensione. */
export const GIORNI_PRIMA_SETTIMANA = 7;

/** Tre numeri: quanti messaggi, di che tipo, si possono mandare oggi. */
export interface Tetti {
  ricontatti: number;
  totale: number;
}

/** Un valore del riquadro limitato alla costante: mai sopra, mai negativo, mai
 *  un decimale. Qualunque cosa non sia un numero vale la costante (il riquadro
 *  può solo ABBASSARE). */
function abbassa(v: unknown, costante: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return costante;
  return Math.max(0, Math.min(costante, Math.floor(v)));
}

/** I tetti di oggi: il minimo fra il riquadro e le costanti (il riquadro a 500
 *  vale 20), con la prima settimana a 10 ricontatti.
 *  La prima settimana conta dalla PRIMA accensione (non dall'ultima: uno
 *  spegni-accendi non la fa ricominciare), con lo stesso confronto dell'SQL:
 *  `now() < prima_accensione + 7 giorni`. Una data mancante o illeggibile vale
 *  «sono ancora nella prima settimana»: nel dubbio i 10. */
export function tettiDelGiorno(
  riquadro: Partial<Tetti> | null | undefined,
  primaAccensione: string | null | undefined,
  adesso: Date,
): Tetti {
  let ricontatti = abbassa(riquadro?.ricontatti, TETTO_RICONTATTI);
  const totale = abbassa(riquadro?.totale, TETTO_TOTALE);
  const prima = primaAccensione ? Date.parse(primaAccensione) : Number.NaN;
  const nellaPrimaSettimana =
    !Number.isFinite(prima) || adesso.getTime() < prima + GIORNI_PRIMA_SETTIMANA * 86_400_000;
  if (nellaPrimaSettimana) ricontatti = Math.min(ricontatti, TETTO_PRIMA_SETTIMANA);
  return { ricontatti, totale };
}

/** Una scheda con il suo id, quanto serve a scegliere. */
export interface SchedaQuando {
  id: string;
  data: Partial<LeadData>;
}

export type DecisioneQuando<T> =
  | { tipo: "invia"; scheda: SchedaQuando; chiave: string; extra: T }
  | { tipo: "aspetta"; scheda: SchedaQuando; motivo: string }
  | { tipo: "salta"; scheda: SchedaQuando; motivo: string };

/** ── Piccoli arnesi di calendario (tutti ora di Roma) ───────────────────── */
const GIORNO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** «AAAA-MM-GG» vero, altrimenti `null` (accetta anche un ISO: ne prende il giorno). */
function giornoVero(v: unknown): string | null {
  const g = typeof v === "string" ? v.slice(0, 10) : "";
  const m = GIORNO.exec(g);
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const x = new Date(Date.UTC(a, me - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === me - 1 && x.getUTCDate() === d ? g : null;
}
const giornoDopo = (g: string) => {
  const [a, m, d] = g.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
};
const giornoDellaSettimana = (g: string) => new Date(`${g}T00:00:00Z`).getUTCDay();
/** Il giorno in cui si recupera un ricontatto di `g`: il primo giorno dopo che
 *  non sia domenica. */
function giornoDiRecupero(g: string): string {
  const dopo = giornoDopo(g);
  return giornoDellaSettimana(dopo) === 0 ? giornoDopo(dopo) : dopo;
}
const dueCifre = (n: number) => String(n).padStart(2, "0");
const oraDi = (minuti: number) => `${dueCifre(Math.floor(minuti / 60))}:${dueCifre(minuti % 60)}`;
const minutiDi = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

/** Contatori di oggi sul registro: i messaggi che possono essere arrivati
 *  (prenotato / inviato / incerto, mai fallito o saltato), di oggi a Roma. */
function contaOggi(invii: InvioPerFreno[], oggi: string, tipi: InvioPerFreno["tipo"][]): number {
  return invii.filter((i) => {
    if (!tipi.includes(i.tipo) || !STATI_ARRIVATI.includes(i.stato)) return false;
    const t = Date.parse(i.prenotatoIl);
    return Number.isFinite(t) && aRoma(new Date(t)).giorno === oggi;
  }).length;
}

/** La chiave c'è già nel registro con un invio che può essere arrivato? (Una
 *  riga fallita o saltata non conta: si può riprovare.) */
const chiaveGiaPresa = (invii: InvioPerFreno[], chiave: string) =>
  invii.some((i) => i.chiave === chiave && STATI_ARRIVATI.includes(i.stato));

/** Pausa per contatto: un invio a quel telefono negli ultimi 120 s (le
 *  variabili `crm_*` stanno sul contatto: due invii vicini si pesterebbero). */
function inPausa(invii: InvioPerFreno[], tel9: string, adesso: Date): boolean {
  return invii.some((i) => {
    if (!STATI_ARRIVATI.includes(i.stato) || ultimeNoveCifre(i.telefono) !== tel9) return false;
    const t = Date.parse(i.prenotatoIl);
    const passati = (adesso.getTime() - t) / 1000;
    return Number.isFinite(t) && passati >= 0 && passati < PAUSA_CONTATTO_S;
  });
}

const FRASE_FRENO = "aspetta ancora una risposta";
const FRASE_PAUSA = "pausa per contatto: un invio a questo numero meno di due minuti fa";

/** Cosa serve a decidere oltre alle schede. Niente di tutto questo si legge
 *  dal database qui dentro: lo porta chi chiama (il giro). */
export interface ContestoQuando {
  /** i consulenti dell'installazione (nome per il modello, ruolo per i ricontatti) */
  consulenti: Pick<Consultant, "id" | "data">[];
  /** il registro `manychat_invii`: bastano gli ultimi giorni */
  invii?: InvioPerFreno[];
  /** i tetti di oggi, da `tettiDelGiorno` */
  tetti?: Tetti;
}

export interface ContestoPromemoria extends ContestoQuando {
  /** l'interruttore di regola: di serie `FRENO_ANCHE_PER_PROMEMORIA` */
  frenoAnchePerPromemoria?: boolean;
}

export interface ContestoRicontatti extends ContestoQuando {
  /** `manychat_giro.prossimo_ricontatto_dopo`: prima di quest'ora non parte un ricontatto */
  prossimoDopo?: Date | null;
}

const TETTI_DI_SERIE: Tetti = { ricontatti: TETTO_RICONTATTI, totale: TETTO_TOTALE };

/** Quali promemoria toccano adesso (bersaglio −25' dal meet, accettati fino a −15').
 *
 *  Risponde solo per i meet DI OGGI (o a meno di 30 minuti) che sono ancora un
 *  appuntamento e non sono ancora iniziati. Annullato, già iniziato, di un
 *  altro giorno, senza consulente, visita in sede: niente, nemmeno una riga.
 *  Un promemoria già partito (stessa chiave) non riparte e non fa rumore.
 *  Due schede con lo stesso telefono e lo stesso meet fanno UNA voce. */
export function decidiPromemoria(
  schede: SchedaQuando[],
  adesso: Date,
  contesto: ContestoPromemoria,
): DecisioneQuando<{ inizioMeet: Date }>[] {
  const invii = contesto.invii ?? [];
  const tetti = contesto.tetti ?? TETTI_DI_SERIE;
  const freno = contesto.frenoAnchePerPromemoria ?? FRENO_ANCHE_PER_PROMEMORIA;
  const oggi = aRoma(adesso).giorno;

  type Candidato = {
    scheda: SchedaQuando;
    inizio: Date;
    minuti: number;
    chiave: string;
    giornoMeet: string;
    numero: string;
    tel9: string;
  };
  const uscita: { inizio: number; id: string; d: DecisioneQuando<{ inizioMeet: Date }> }[] = [];
  const candidati: Candidato[] = [];

  for (const scheda of schede) {
    const d = scheda.data;
    if (!eAppuntamento(d.stato)) continue;
    if (!d.consulenteId || eImportato(scheda)) continue;
    const giornoMeet = giornoVero(d.dataMeeting);
    const ora = oraNormale(d.oraMeeting);
    if (!giornoMeet || !ora) continue;
    const inizio = istanteDiRoma(giornoMeet, ora);
    if (!inizio) continue;
    const minuti = (inizio.getTime() - adesso.getTime()) / 60_000;
    if (minuti <= 0) continue;
    if (giornoMeet !== oggi && minuti > 30) continue;

    const salta = (motivo: string) =>
      uscita.push({
        inizio: inizio.getTime(),
        id: scheda.id,
        d: { tipo: "salta", scheda, motivo },
      });
    const numero = numeroWa(d.telefono);
    if (d.contattoWa?.stato === "stop") {
      salta("STOP");
      continue;
    }
    if (!numero) {
      salta("numero non valido");
      continue;
    }
    if (!consensoWhatsapp(d).si) {
      salta("manca il consenso WhatsApp");
      continue;
    }
    const consulente = contesto.consulenti.find((c) => c.id === d.consulenteId);
    if (!consulente) {
      salta("consulente non trovato");
      continue;
    }
    const campi = campiPromemoria(d, consulente.data?.nome, scheda.id);
    if (campi.tipo === "salta") {
      salta(campi.motivo);
      continue;
    }
    const tel9 = ultimeNoveCifre(numero);
    candidati.push({
      scheda,
      inizio,
      minuti,
      giornoMeet,
      numero,
      tel9,
      chiave: `p|${tel9}|${giornoMeet}T${ora}`,
    });
  }

  //  Prima per ora di meet, poi per scheda: così fra due doppioni vince sempre
  //  la stessa. Una chiave = un promemoria.
  candidati.sort(
    (a, b) => a.inizio.getTime() - b.inizio.getTime() || a.scheda.id.localeCompare(b.scheda.id),
  );
  const viste = new Set<string>();
  for (const k of candidati) {
    if (viste.has(k.chiave)) continue;
    viste.add(k.chiave);
    const metti = (d: DecisioneQuando<{ inizioMeet: Date }>) =>
      uscita.push({ inizio: k.inizio.getTime(), id: k.scheda.id, d });
    const salta = (motivo: string) => metti({ tipo: "salta", scheda: k.scheda, motivo });

    if (chiaveGiaPresa(invii, k.chiave)) continue;
    const delGiorno = invii.filter(
      (i) =>
        i.tipo === "promemoria" &&
        STATI_ARRIVATI.includes(i.stato) &&
        ultimeNoveCifre(i.telefono) === k.tel9 &&
        (i.chiave ?? "").startsWith(`p|${k.tel9}|${k.giornoMeet}T`),
    ).length;
    if (delGiorno >= MAX_PROMEMORIA_PER_GIORNO) {
      salta(`già ${MAX_PROMEMORIA_PER_GIORNO} promemoria a questo numero per il giorno del meet`);
      continue;
    }
    if (freno && aspettaRisposta(k.numero, invii, k.scheda.data.contattoWa)) {
      salta(FRASE_FRENO);
      continue;
    }
    if (contaOggi(invii, oggi, ["promemoria", "ricontatto"]) >= tetti.totale) {
      salta("tetto di messaggi di oggi raggiunto");
      continue;
    }
    if (k.minuti > ANTICIPO_PROMEMORIA_MIN) {
      const parte = aRoma(new Date(k.inizio.getTime() - ANTICIPO_PROMEMORIA_MIN * 60_000));
      metti({ tipo: "aspetta", scheda: k.scheda, motivo: `parte alle ${oraDi(parte.minuti)}` });
      continue;
    }
    if (k.minuti < LIMITE_RITARDO_PROMEMORIA_MIN) {
      salta("saltato: giro in ritardo");
      continue;
    }
    if (inPausa(invii, k.tel9, adesso)) {
      metti({ tipo: "aspetta", scheda: k.scheda, motivo: FRASE_PAUSA });
      continue;
    }
    metti({ tipo: "invia", scheda: k.scheda, chiave: k.chiave, extra: { inizioMeet: k.inizio } });
  }

  return uscita.sort((a, b) => a.inizio - b.inizio || a.id.localeCompare(b.id)).map((x) => x.d);
}

/** La coda dei ricontatti di oggi, nell'ordine in cui toccano.
 *
 *  Chi c'è: i lead dei consulenti (`eLeadDelConsulente`) con una data di
 *  ricontatto — `dataRicontatto`, o il giorno di Roma di `callbackAt` — che sia
 *  OGGI, oppure quella del giorno lavorativo prima (il recupero, UNA volta
 *  sola: il giorno dopo, saltando la domenica). Mai una data precedente al
 *  giorno dell'ultima accensione. Gli altri: niente, nemmeno una riga.
 *
 *  L'ordine: prima i recuperi, poi chi ha l'ora fissata (la più vecchia), poi
 *  gli altri. Due schede con lo stesso telefono fanno UNA voce. Chi tocca adesso
 *  è la prima voce `invia`; le altre aspettano il loro turno (ora fissata,
 *  ritmo, pausa, tetto) o sono saltate col motivo (consenso, STOP, numero,
 *  «aspetta ancora una risposta»). Il tetto e il ritmo veri li applica l'SQL
 *  dentro la prenotazione: qui è la stessa regola in lettura, per decidere e
 *  per la prova a secco. */
export function codaRicontatti(
  schede: SchedaQuando[],
  adesso: Date,
  ultimaAccensione: string | null | undefined,
  contesto: ContestoRicontatti,
): DecisioneQuando<{ giorno: string; recupero: boolean }>[] {
  type Esito = DecisioneQuando<{ giorno: string; recupero: boolean }>;
  const invii = contesto.invii ?? [];
  const tetti = contesto.tetti ?? TETTI_DI_SERIE;
  const { giorno: oggi, minuti } = aRoma(adesso);
  //  Una data di accensione mancante vale «da oggi»: niente recuperi.
  const accesa = ultimaAccensione ? Date.parse(ultimaAccensione) : Number.NaN;
  const dalGiorno = Number.isFinite(accesa) ? aRoma(new Date(accesa)).giorno : oggi;

  type Candidato = {
    scheda: SchedaQuando;
    giorno: string;
    recupero: boolean;
    ora: string | null;
    chiave: string;
    numero: string;
    tel9: string;
  };
  const candidati: Candidato[] = [];
  const salti: Esito[] = [];

  for (const scheda of schede) {
    const d = scheda.data;
    if (!eLeadDelConsulente(scheda, contesto.consulenti)) continue;
    //  Il giorno del ricontatto: la data scritta, o (ripiego) il giorno di Roma di callbackAt.
    let giorno = giornoVero(d.dataRicontatto);
    if (!giorno && d.callbackAt) {
      const t = Date.parse(d.callbackAt);
      if (Number.isFinite(t)) giorno = aRoma(new Date(t)).giorno;
    }
    if (!giorno || giorno < dalGiorno || giorno > oggi) continue;
    const recupero = giorno < oggi;
    if (recupero && giornoDiRecupero(giorno) !== oggi) continue;

    const salta = (motivo: string) => salti.push({ tipo: "salta", scheda, motivo });
    const numero = numeroWa(d.telefono);
    if (d.contattoWa?.stato === "stop") {
      salta("STOP");
      continue;
    }
    if (!numero) {
      salta("numero non valido");
      continue;
    }
    if (!consensoWhatsapp(d).si) {
      salta("manca il consenso WhatsApp");
      continue;
    }
    const consulente = contesto.consulenti.find((c) => c.id === d.consulenteId);
    const campi = campiRicontatto(d, consulente?.data?.nome);
    if (campi.tipo === "salta") {
      salta(campi.motivo);
      continue;
    }
    const tel9 = ultimeNoveCifre(numero);
    const chiave = `r|${tel9}|${giorno}`;
    if (chiaveGiaPresa(invii, chiave)) continue;
    //  L'ora fissata vale per il suo giorno; il recupero parte come gli altri.
    const ora = recupero ? null : oraNormale(d.oraRicontatto);
    candidati.push({ scheda, giorno, recupero, ora, chiave, numero, tel9 });
  }

  candidati.sort(
    (a, b) =>
      Number(b.recupero) - Number(a.recupero) ||
      Number(!!b.ora) - Number(!!a.ora) ||
      (a.ora ?? "").localeCompare(b.ora ?? "") ||
      a.giorno.localeCompare(b.giorno) ||
      a.scheda.id.localeCompare(b.scheda.id),
  );

  const ricontattiOggi = contaOggi(invii, oggi, ["ricontatto"]);
  const totaleOggi = contaOggi(invii, oggi, ["promemoria", "ricontatto"]);
  const domenica = giornoDellaSettimana(oggi) === 0;
  const dentroOrario = minuti >= APERTURA_RICONTATTI_MIN && minuti < CHIUSURA_RICONTATTI_MIN;
  const prossimo = contesto.prossimoDopo ?? null;

  const uscita: Esito[] = [];
  const visti = new Set<string>();
  for (const k of candidati) {
    if (visti.has(k.tel9)) continue;
    visti.add(k.tel9);
    const aspetta = (motivo: string) => uscita.push({ tipo: "aspetta", scheda: k.scheda, motivo });

    if (aspettaRisposta(k.numero, invii, k.scheda.data.contattoWa)) {
      uscita.push({ tipo: "salta", scheda: k.scheda, motivo: FRASE_FRENO });
    } else if (domenica) {
      aspetta("domenica: niente ricontatti");
    } else if (!dentroOrario) {
      aspetta("fuori orario: i ricontatti escono dalle 9 alle 20");
    } else if (k.ora && minuti < minutiDi(k.ora)) {
      aspetta(`ora fissata: alle ${k.ora}`);
    } else if (ricontattiOggi >= tetti.ricontatti) {
      aspetta("tetto dei ricontatti di oggi raggiunto: se ne parla domani");
    } else if (totaleOggi >= tetti.totale) {
      aspetta("tetto di messaggi di oggi raggiunto: se ne parla domani");
    } else if (inPausa(invii, k.tel9, adesso)) {
      aspetta(FRASE_PAUSA);
    } else if (prossimo && prossimo.getTime() > adesso.getTime()) {
      aspetta(`ritmo: il prossimo ricontatto verso le ${oraDi(aRoma(prossimo).minuti)}`);
    } else {
      uscita.push({
        tipo: "invia",
        scheda: k.scheda,
        chiave: k.chiave,
        extra: { giorno: k.giorno, recupero: k.recupero },
      });
    }
  }

  salti.sort((a, b) => a.scheda.id.localeCompare(b.scheda.id));
  return [...uscita, ...salti];
}

/** Fra quanti minuti il prossimo ricontatto: 27-33, intero. `caso` è un numero
 *  fra 0 e 1 passato da fuori (`Math.random()` nelle porte vere, fisso nelle
 *  prove). Un valore fuori misura o non numerico non esce mai dai limiti. */
export function intervalloRicontatto(caso: number): number {
  const x =
    typeof caso === "number" && Number.isFinite(caso) ? Math.min(Math.max(caso, 0), 1) : 0.5;
  return Math.min(RITMO_MAX, RITMO_MIN + Math.floor(x * (RITMO_MAX - RITMO_MIN + 1)));
}
