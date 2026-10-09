// ── IL REGISTRO UNICO DELLA SPESA ───────────────────────────────────────────
//
//  ── IL DIFETTO CHE QUESTO FILE ESISTE PER CHIUDERE ────────────────────────
//  Fino a ieri la pagina KPI conteneva DUE VOLTE gli stessi quattro numeri —
//  costo per cliente, ritorno sulla spesa, netto, la sottrazione riga per riga —
//  calcolati
//  su due spese diverse e senza dirlo: la panoramica usava solo la spesa
//  sincronizzata da Meta, la scheda «KPI manuale» solo quella scritta a mano.
//  Stesso periodo, stessa pagina, due «costo per cliente». Chi cambiava
//  linguetta vedeva il numero muoversi e concludeva che la pagina era rotta.
//
//  Qui la spesa diventa UNA SOLA, con una regola dichiarata:
//   · se un giorno ha una registrazione scritta a mano, VINCE LEI e basta —
//     chi l'ha scritta aveva il pannello degli annunci davanti, e sommarla alla
//     sincronizzazione conterebbe due volte la stessa giornata;
//   · altrimenti vale la spesa sincronizzata da Meta di quel giorno;
//   · in più, sui giorni non coperti a mano, la stima TikTok ricavata dal
//     budget giornaliero (TikTok non espone lo storico: è una stima, ed è
//     scritto in pagina).
//
//  ⚠️ CONSEGUENZA DA SAPERE: costo per lead, costo per cliente, ritorno sulla
//  spesa e netto CAMBIANO VALORE rispetto a prima. Non perché sia cambiata una
//  formula — `@/crm/kpi-calcoli` non si tocca e riceve questo elenco come
//  riceveva l'altro — ma perché prima ogni scheda ne vedeva metà.
//
//  ── I DUE NUMERI NUOVI, E PERCHÉ ──────────────────────────────────────────
//  · COPERTURA: su quanti giorni del periodo esiste davvero una spesa
//    registrata. Un costo per cliente calcolato su 27 giorni di spesa su 30 è
//    gonfiato del dieci per cento, e finora nessuno poteva accorgersene.
//  · ORIGINE: quanto del totale è sincronizzato, quanto scritto a mano, quanto
//    stimato. È la traccia che rende verificabile la regola qui sopra.
//
//  ── I DATI VERI NON RISPETTANO I TIPI ─────────────────────────────────────
//  Gli importi arrivano da un archivio e da un modulo: possono essere stringhe,
//  `null`, o mancare. Si legge con `Number()` secco, esattamente come fa
//  kpi-calcoli: una lettura più tollerante qui darebbe 1500 dove là dà 0, e la
//  stessa pagina mostrerebbe due spese diverse.

import type { AdSpending } from "@/crm/types";
import type { FiltroPeriodo } from "@/crm/kpi-calcoli";
import { giornoDi } from "@/crm/kpi-calcoli";
import { giorniDellaFinestra, type Estremi } from "@/crm/kpi/finestra";
import { oggiIso } from "@/crm/ui";

/** I canali a cui una spesa può essere attribuita. L'organico non ha spesa: è
 *  il senso della parola. */
export type CanaleSpesa = "meta" | "tiktok" | "organic";

export interface OrigineSpesa {
  /** Letta dalla sincronizzazione con Meta. */
  sincronizzata: number;
  /** Scritta a mano nel registro. */
  aMano: number;
  /** Stimata dal budget giornaliero TikTok: non è una lettura. */
  stimata: number;
  totale: number;
  /** Giorni in cui la registrazione a mano ha SOSTITUITO la sincronizzazione:
   *  è il numero che spiega perché il totale non è la somma dei due. */
  giorniSostituiti: number;
  /** Quante registrazioni a mano cadono nel periodo. */
  registrazioniAMano: number;
}

export interface CoperturaSpesa {
  /** Su «Tutto» non esiste un numero di giorni: la copertura non si calcola e
   *  lo si dice, invece di stampare un 100% inventato. */
  calcolabile: boolean;
  /** Giorni del periodo, ESCLUSO oggi (vedi `oggiDaRegistrare`). */
  giorniTotali: number;
  giorniCoperti: number;
  percentuale: number;
  /** I giorni senza un euro registrato, dal più recente. */
  scoperti: string[];
  /** Oggi è dentro il periodo e non ha ancora una spesa: non è un buco, è la
   *  giornata in corso, e va contata a parte per non far sembrare la copertura
   *  peggiore di com'è. */
  oggiDaRegistrare: boolean;
}

export interface RegistroSpesa {
  /** L'elenco da passare, IMMUTATO, alle formule di kpi-calcoli. */
  spese: AdSpending[];
  /** Lo stesso elenco diviso per canale, per la tabella del confronto. */
  perCanale: Record<CanaleSpesa, AdSpending[]>;
  /** Spesa che non si sa a quale canale appartenga: le registrazioni a mano
   *  non dicono da dove veniva il budget. Va dichiarata, altrimenti la somma
   *  delle righe per canale non torna con il totale e sembra un errore. */
  nonAttribuita: number;
  origine: OrigineSpesa;
  copertura: CoperturaSpesa;
}

/** `Number()` secco come in kpi-calcoli, con lo scarto di NaN e infiniti: un
 *  importo scritto «circa 200» non deve propagarsi fino a rendere illeggibile
 *  il totale. */
function numero(valore: unknown): number {
  const n = Number(valore);
  return Number.isFinite(n) ? n : 0;
}

/** A quale canale appartiene una registrazione scritta a mano. Il modulo salva
 *  `fonte: "ADV"` e non chiede il canale: chi scrive la sera ha in mano un
 *  totale, non una ripartizione. Si riconosce solo quello che il campo dice
 *  davvero; tutto il resto resta «non attribuita» invece di essere infilato
 *  d'ufficio sotto Meta. */
function canaleDellaRegistrazione(fonte: unknown): CanaleSpesa | null {
  const f = String(fonte || "")
    .trim()
    .toLowerCase();
  if (f === "meta" || f === "facebook" || f === "instagram") return "meta";
  if (f === "tiktok") return "tiktok";
  return null;
}

/** Una riga di spesa che non esiste nel database ma serve alle formule: la
 *  sincronizzazione Meta e la stima TikTok non sono registrazioni. L'id porta
 *  il prefisso della provenienza, così una riga finta non si può scambiare per
 *  una registrazione correggibile. */
function rigaSintetica(
  prefisso: string,
  giorno: string,
  campagna: string,
  fonte: string,
  importo: number,
  userId: string,
): AdSpending {
  return {
    id: `${prefisso}-${giorno}`,
    user_id: userId,
    data: {
      data: giorno,
      campagna,
      fonte,
      importoSpeso: importo,
      //  Lead, meet e conversioni non si scrivono qui: arrivano dalle schede
      //  reali. Restano a zero perché il tipo li richiede.
      leadGenerati: 0,
      meetFissati: 0,
      conversioni: 0,
    },
    created_at: giorno,
    updated_at: giorno,
  };
}

export interface ArgomentiRegistro {
  /** Le registrazioni scritte a mano, tutte: il taglio lo fa `dentro`. */
  aMano: AdSpending[];
  /** La spesa Meta sincronizzata, già accorpata per giorno. */
  meta: { giorno: string; importo: number }[];
  /** Budget giornaliero TikTok dalle impostazioni. Zero = nessuna stima. */
  tiktokAlGiorno: number;
  estremi: Estremi;
  dentro: FiltroPeriodo;
  userId: string;
}

/** ── UNA SPESA SOLA, COSTRUITA DAVANTI A CHI LEGGE ─────────────────────────
 *  Restituisce l'elenco da dare alle formule più le due dichiarazioni che lo
 *  rendono verificabile. Non calcola nessun KPI: quelli restano in
 *  kpi-calcoli. */
export function costruisciRegistroSpesa({
  aMano,
  meta,
  tiktokAlGiorno,
  estremi,
  dentro,
  userId,
}: ArgomentiRegistro): RegistroSpesa {
  const spese: AdSpending[] = [];
  const perCanale: Record<CanaleSpesa, AdSpending[]> = { meta: [], tiktok: [], organic: [] };
  const origine: OrigineSpesa = {
    sincronizzata: 0,
    aMano: 0,
    stimata: 0,
    totale: 0,
    giorniSostituiti: 0,
    registrazioniAMano: 0,
  };
  let nonAttribuita = 0;

  /* ── 1. LE REGISTRAZIONI SCRITTE A MANO ─────────────────────────────────
     Vincono sul giorno intero. Si tengono le righe originali, con il loro id e
     la loro campagna: servono a poterle correggere dal registro. */
  const manoPerGiorno = new Map<string, AdSpending[]>();
  for (const s of Array.isArray(aMano) ? aMano : []) {
    if (!s || typeof s !== "object" || !s.data || typeof s.data !== "object") continue;
    if (!dentro(s.data.data)) continue;
    const g = giornoDi(s.data.data);
    if (!g) continue;
    const righe = manoPerGiorno.get(g) ?? [];
    righe.push(s);
    manoPerGiorno.set(g, righe);
  }

  for (const [, righe] of manoPerGiorno) {
    for (const s of righe) {
      const importo = numero(s.data.importoSpeso);
      spese.push(s);
      origine.aMano += importo;
      origine.registrazioniAMano++;
      const canale = canaleDellaRegistrazione(s.data.fonte);
      if (canale) perCanale[canale].push(s);
      else nonAttribuita += importo;
    }
  }

  /* ── 2. LA SPESA SINCRONIZZATA ──────────────────────────────────────────
     Solo sui giorni che nessuno ha scritto a mano. */
  const metaPerGiorno = new Map<string, number>();
  for (const r of Array.isArray(meta) ? meta : []) {
    const g = giornoDi(r?.giorno);
    if (!g || !dentro(g)) continue;
    metaPerGiorno.set(g, (metaPerGiorno.get(g) || 0) + numero(r?.importo));
  }

  for (const [g, importo] of metaPerGiorno) {
    if (manoPerGiorno.has(g)) {
      //  Il giorno è già coperto a mano: la riga sincronizzata NON entra, e si
      //  conta perché il totale possa essere spiegato.
      origine.giorniSostituiti++;
      continue;
    }
    if (importo <= 0) continue;
    const riga = rigaSintetica("meta", g, "Meta (sincronizzata)", "meta", importo, userId);
    spese.push(riga);
    perCanale.meta.push(riga);
    origine.sincronizzata += importo;
  }

  /* ── 3. LA STIMA TIKTOK ─────────────────────────────────────────────────
     Senza un budget dichiarato non si inventa una spesa; su «Tutto» non esiste
     un numero di giorni su cui spalmarla e la stima non si fa. */
  const giorniFinestra =
    estremi.giorni === null ? null : giorniDellaFinestra(estremi.da, estremi.a);

  if (tiktokAlGiorno > 0 && giorniFinestra) {
    for (const g of giorniFinestra) {
      if (!dentro(g) || manoPerGiorno.has(g)) continue;
      const riga = rigaSintetica(
        "tiktok",
        g,
        "TikTok (stima da budget giornaliero)",
        "tiktok",
        tiktokAlGiorno,
        userId,
      );
      spese.push(riga);
      perCanale.tiktok.push(riga);
      origine.stimata += tiktokAlGiorno;
    }
  }

  origine.totale = origine.aMano + origine.sincronizzata + origine.stimata;

  /* ── 4. LA COPERTURA ────────────────────────────────────────────────────
     Coperto = giorno con una spesa REGISTRATA, a mano o sincronizzata. La
     stima TikTok non conta: se contasse, con un budget impostato la copertura
     risulterebbe sempre del 100% e il numero smetterebbe di dire qualcosa.
     Oggi sta fuori dal conto: non è un buco, è la giornata in corso. */
  const oggi = oggiIso();
  const copertura: CoperturaSpesa = {
    calcolabile: false,
    giorniTotali: 0,
    giorniCoperti: 0,
    percentuale: 0,
    scoperti: [],
    oggiDaRegistrare: false,
  };

  if (giorniFinestra) {
    const coperto = (g: string) =>
      (manoPerGiorno.get(g)?.some((s) => numero(s.data.importoSpeso) > 0) ?? false) ||
      (metaPerGiorno.get(g) || 0) > 0;

    for (const g of giorniFinestra) {
      if (g === oggi) {
        copertura.oggiDaRegistrare = !coperto(g);
        continue;
      }
      copertura.giorniTotali++;
      if (coperto(g)) copertura.giorniCoperti++;
      else copertura.scoperti.push(g);
    }
    copertura.scoperti.reverse(); // dal più recente: è quello che si va a registrare
    copertura.calcolabile = copertura.giorniTotali > 0;
    copertura.percentuale = copertura.calcolabile
      ? (copertura.giorniCoperti / copertura.giorniTotali) * 100
      : 0;
  }

  return { spese, perCanale, nonAttribuita, origine, copertura };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DUE NUMERI CHE NASCONO QUI E NON IN kpi-calcoli
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PREZZO MEDIO DI VENDITA ───────────────────────────────────────────────
 *  Fatturato lordo ÷ clienti. Esiste per un solo motivo: stare ACCANTO al costo
 *  per cliente. Da soli sono due cifre, insieme sono un verdetto — «€ 480 per
 *  cliente su € 4.100 di vendita media» si legge in un secondo.
 *  Senza clienti non è misurabile e vale zero, che chi disegna mostra come
 *  trattino: un prezzo medio di 0 € sarebbe una bugia. */
export function prezzoMedioDiVendita(fatturatoLordo: number, conversioni: number): number {
  return conversioni > 0 ? fatturatoLordo / conversioni : 0;
}

/** ── LE SCHEDE CHE NON STANNO IN NESSUNA FINESTRA ──────────────────────────
 *  `creaFiltroPeriodo` scarta in silenzio le schede con data di ingresso
 *  mancante o illeggibile: non compaiono in nessun periodo, nemmeno in «Tutto».
 *  Con 843 schede importate da un CRM precedente possono essere decine, e
 *  chiunque rifaccia i conti a mano trova un totale che non torna. Si contano
 *  una volta e si dicono in fondo alla pagina. */
export function schedeFuoriDaOgniPeriodo(leads: { data?: { createdAt?: string } }[]): number {
  if (!Array.isArray(leads)) return 0;
  let n = 0;
  for (const l of leads) {
    const v = l?.data?.createdAt;
    if (!v) {
      n++;
      continue;
    }
    if (Number.isNaN(new Date(v).getTime())) n++;
  }
  return n;
}
