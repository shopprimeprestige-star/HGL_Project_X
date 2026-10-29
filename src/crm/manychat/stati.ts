/** ── I MESSAGGI PER STATO ──────────────────────────────────────────────────
 *
 *  Commessa 2026-10-25 (Sheets e sequenze WhatsApp), compito T (piano §5g).
 *  Le prove stanno in `prove/manychat/stati.mjs`.
 *
 *  `TABELLA_STATI`: stato → modello, tag, regola del quando, chi. È l'UNICA
 *  tabella: il giro ne ricava il modello e il tag, il riquadro ne mostra le
 *  righe (`vista-pannello.ts`, la prova le confronta).
 *  `decidiPerStato`: i messaggi A EVENTO (`tipo = 'ricontatto'`, chiave
 *  `s|<codice>|tel9|<statoDal>`) e i due promemoria A ORARIO
 *  (`promemoria_chiamata` `ch|…`, `promemoria_sede` `sd|…`). I ricontatti A DATA
 *  stanno in `codaRicontatti` (`quando.ts`, chiave `r|tel9|giorno`).
 *  Modulo PURO: l'orologio e il registro arrivano da fuori.
 *
 *  ── LE TRE REGOLE DEL QUANDO ──────────────────────────────────────────────
 *   A DATA    il giorno di `dataRicontatto`, ritmo 27-33' (`codaRicontatti`).
 *   A EVENTO  una volta per evento: ogni volta che lo stato viene messo
 *             (`statoDal`, scritto da `conStatoDal`). Parte dopo l'attesa della
 *             tabella, dentro 9-20 lun-sab, entro 48 h dall'evento (72 h per
 *             «Irreperibile»); mai due messaggi dello stesso modello allo stesso
 *             numero in 7 giorni. Senza `statoDal`, o con `statoDal` prima
 *             dell'accensione dello stato: mai. Freno «mai due senza risposta» sì,
 *             ritmo e tetto dei ricontatti sì.
 *   A ORARIO  legati a un appuntamento preso: NON frenati, niente ritmo, ma nei
 *             tetti (contro il totale intero), con STOP e pausa per contatto.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadStatus } from "../types";
import { aRoma, oraNormale } from "../promemoria/formati";
import { istanteDiRoma } from "./contatto";
import {
  FRASE_FRENO,
  FRASE_PAUSA,
  TETTI_DI_SERIE,
  chiaveGiaPresa,
  contaOggi,
  giornoDellaSettimana,
  giornoADataDi,
  giornoVero,
  inPausa,
  oraDi,
  totaleSenzaRiserva,
  type ContestoQuando,
  type DecisioneQuando,
  type SchedaQuando,
} from "./quando";
import {
  STATI_ARRIVATI,
  TIPI_COL_RITMO,
  TIPI_NEI_TETTI,
  TIPI_SENZA_FRENO,
  aspettaRisposta,
  consensoWhatsapp,
  eDelConsulente,
  numeroWa,
  ultimeNoveCifre,
} from "./regole";
import { MEMORIA_SALTI_MIN, primoIstanteUtile, quandoParte } from "./sequenze";
import { campiPerStato } from "./testi";

/** Quando parte il messaggio di uno stato (piano §5g, «tre regole del quando»). */
export type QuandoStato = "a_data" | "a_evento" | "a_orario";

/** Una riga della tabella del §5g. */
export interface RigaStato {
  /** il nome del modello ManyChat, es. `hgl_ricontatto_consulenza` */
  modello: string;
  /** l'etichetta del tag ManyChat, es. `crm-ricontatto` */
  tag: string;
  quando: QuandoStato;
  /** chi riceve: i lead del consulente, o tutti (anche i lead importati) */
  chi: "consulente" | "tutti";
  /** a evento: i minuti di attesa dopo `statoDal` */
  attesaMin?: number;
  /** a evento: entro quante ore dall'evento (48, 72 per «Irreperibile») */
  entroOre?: number;
  /** a evento: il codice della chiave `s|<codice>|tel9|<statoDal>`, uguale per i
   *  modelli uguali (così «Non risponde» → «Segreteria» è un solo evento) */
  codice?: string;
  /** a evento: una volta per numero, per sempre (chiave `s|<codice>|tel9`) */
  unaVoltaPerNumero?: boolean;
}

const RICONTATTO: RigaStato = {
  modello: "hgl_ricontatto_consulenza",
  tag: "crm-ricontatto",
  quando: "a_data",
  chi: "consulente",
};
const NON_RISPONDE: RigaStato = {
  modello: "hgl_non_risponde",
  tag: "crm-stato-non-risponde",
  quando: "a_evento",
  chi: "tutti",
  attesaMin: 15,
  entroOre: 48,
  codice: "nr",
};
const ASSENTE: RigaStato = {
  modello: "hgl_cliente_assente",
  tag: "crm-stato-assente",
  quando: "a_evento",
  chi: "consulente",
  attesaMin: 30,
  entroOre: 48,
  codice: "as",
};

/** Stato → riga. «Attesa acconto» ha il suo modello (`hgl_acconto`, commessa
 *  2026-10-29) ma resta A DATA, come prima, con il suo interruttore.
 *  «Cliente assente» è `no_show` E `non_fatto`; «Non risponde» e
 *  «Segreteria» sono due stati con lo stesso modello e lo stesso evento (`nr`).
 *  «Da riprogrammare» è A DATA se ha una data, altrimenti a evento dopo 30'
 *  (`attesaMin`, `codice: "rp"`). Gli stati che non ci sono (Da contattare,
 *  Attesa WhatsApp, Ci ricontatta lui, Non interessato, Perditempo,
 *  Ripensamento, tutti quelli dopo la vendita) non hanno messaggio, per scelta. */
export const TABELLA_STATI: Partial<Record<LeadStatus, RigaStato>> = {
  da_ricontattare: RICONTATTO,
  sta_valutando: RICONTATTO,
  in_attesa_acconto: {
    modello: "hgl_acconto",
    tag: "crm-stato-acconto",
    quando: "a_data",
    chi: "consulente",
  },
  gestire_in_chat: RICONTATTO,
  fissa_meet_dopo: {
    modello: "hgl_meet_da_fissare",
    tag: "crm-stato-meet-da-fissare",
    quando: "a_data",
    chi: "consulente",
  },
  da_spostare: {
    modello: "hgl_da_riprogrammare",
    tag: "crm-stato-riprogrammare",
    quando: "a_data",
    chi: "consulente",
    attesaMin: 30,
    entroOre: 48,
    codice: "rp",
  },
  richiamo: {
    modello: "hgl_richiamo_concordato",
    tag: "crm-stato-richiamo",
    quando: "a_orario",
    chi: "consulente",
  },
  non_risponde: NON_RISPONDE,
  segreteria: NON_RISPONDE,
  no_show: ASSENTE,
  non_fatto: ASSENTE,
  viene_in_sede: {
    modello: "hgl_promemoria_sede",
    tag: "crm-stato-sede",
    quando: "a_orario",
    chi: "tutti",
  },
  sede_disdetta: {
    modello: "hgl_sede_disdetta",
    tag: "crm-stato-sede-disdetta",
    quando: "a_evento",
    chi: "tutti",
    attesaMin: 15,
    entroOre: 48,
    codice: "sdd",
  },
  irreperibile: {
    modello: "hgl_ultimo_tentativo",
    tag: "crm-stato-irreperibile",
    quando: "a_evento",
    chi: "tutti",
    attesaMin: 60,
    entroOre: 72,
    codice: "irr",
    unaVoltaPerNumero: true,
  },
};

/** Una chiamata concordata: si scrive da 30 a 10 minuti prima. */
export const CHIAMATA_DA_MIN = 30;
export const CHIAMATA_A_MIN = 10;
/** Mai due messaggi dello stesso modello allo stesso numero in 7 giorni. */
export const GIORNI_FRA_DUE_UGUALI = 7;

const ORA_MS = 3_600_000;
const MIN_MS = 60_000;

/** Cosa serve in più ai messaggi per stato. */
export interface ContestoStati extends ContestoQuando {
  fraseModuloDal: string | null;
  /** `manychat_config.stati`: stato → ISO dell'accensione (assente = spento) */
  statiAccesi: Record<string, string>;
  /** `manychat_config.indirizzo_sede`: vuoto → `promemoria_sede` non parte */
  indirizzoSede: string | null;
  /** `manychat_giro.prossimo_ricontatto_dopo`: lo aspettano i messaggi a evento */
  prossimoDopo?: Date | null;
}

export type ExtraStato = {
  tipo: "ricontatto" | "promemoria_chiamata" | "promemoria_sede";
  stato: LeadStatus;
  /** a orario: l'inizio dell'appuntamento (per «In attesa» fino a quel momento) */
  inizio: Date | null;
};

/** Il giorno di Roma di un istante ISO, `null` se illeggibile. */
function giornoDi(iso: string | undefined): string | null {
  const t = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(t) ? aRoma(new Date(t)).giorno : null;
}

/** I messaggi per stato che toccano adesso: a evento e a orario, nell'ordine in
 *  cui toccano; poi i salti col motivo. Per ogni scheda vale il modello dello
 *  stato ATTUALE (il giro rilegge la scheda prima di inviare). Ogni stato ha il
 *  suo interruttore in `statiAccesi`, spento di serie: spento → nemmeno una riga. */
export function decidiPerStato(
  schede: SchedaQuando[],
  adesso: Date,
  contesto: ContestoStati,
): DecisioneQuando<ExtraStato>[] {
  type Esito = DecisioneQuando<ExtraStato>;
  const invii = contesto.invii ?? [];
  const tetti = contesto.tetti ?? TETTI_DI_SERIE;
  const frase = contesto.fraseModuloDal;
  const { giorno: oggi } = aRoma(adesso);
  const ora = adesso.getTime();
  const prossimo = contesto.prossimoDopo ?? null;

  const uscita: { ordine: number; id: string; d: Esito }[] = [];
  const salti: Esito[] = [];
  const viste = new Set<string>();

  const ricontattiOggi = contaOggi(invii, oggi, ["ricontatto"]);
  const totaleOggi = contaOggi(invii, oggi, TIPI_NEI_TETTI);

  for (const scheda of [...schede].sort((a, b) => a.id.localeCompare(b.id))) {
    const d = scheda.data;
    const stato = String(d.stato ?? "") as LeadStatus;
    const riga = TABELLA_STATI[stato];
    if (!riga) continue;
    //  «Da riprogrammare» SENZA data passa a evento; con la data è un ricontatto a data.
    const aEvento =
      riga.quando === "a_evento" || (stato === "da_spostare" && !giornoADataDi(d, oggi));
    if (riga.quando === "a_data" && !aEvento) continue;
    const acceso = giornoDi(contesto.statiAccesi[stato]);
    const accesoIl = Date.parse(contesto.statiAccesi[stato] ?? "");
    if (acceso === null) continue;
    //  «Chi»: i lead del consulente (non gli importati), oppure tutti.
    if (riga.chi === "consulente" && !eDelConsulente(scheda, contesto.consulenti)) continue;

    const numero = numeroWa(d.telefono);
    const tel9 = numero ? ultimeNoveCifre(numero) : "";
    const consulente = contesto.consulenti.find((c) => c.id === d.consulenteId);
    const salta = (motivo: string) => salti.push({ tipo: "salta", scheda, motivo });
    const metti = (ordine: number, x: Esito) => uscita.push({ ordine, id: scheda.id, d: x });

    /** STOP, numero, consenso, variabili del modello: chi non può ricevere. */
    const prerequisiti = (): boolean => {
      if (d.contattoWa?.stato === "stop") return (salta("STOP"), false);
      if (!numero) return (salta("numero non valido"), false);
      if (!consensoWhatsapp(d, frase).si) return (salta("manca il consenso WhatsApp"), false);
      const campi = campiPerStato(stato, d, consulente?.data?.nome, contesto.indirizzoSede);
      if (campi.tipo === "salta") return (salta(campi.motivo), false);
      return true;
    };

    // ══ A ORARIO ═══════════════════════════════════════════════════════════
    if (riga.quando === "a_orario") {
      const chiamata = stato === "richiamo";
      const giorno = giornoVero(chiamata ? d.dataRicontatto : d.dataVieneInSede);
      const hm = oraNormale(chiamata ? d.oraRicontatto : d.oraVieneInSede);
      if (!giorno) continue;
      if (chiamata && !hm) continue; // senza ora della chiamata: niente
      const inizio = hm ? istanteDiRoma(giorno, hm) : null;
      if (inizio && inizio.getTime() <= ora) continue;
      //  Il giorno e la finestra in cui scrivere.
      let da: number;
      let a: number;
      if (chiamata) {
        if (giorno !== oggi || giorno < acceso) continue;
        const apertura = istanteDiRoma(giorno, "09:00") as Date;
        const chiusura = istanteDiRoma(giorno, "20:00") as Date;
        da = Math.max((inizio as Date).getTime() - CHIAMATA_DA_MIN * MIN_MS, apertura.getTime());
        a = Math.min((inizio as Date).getTime() - CHIAMATA_A_MIN * MIN_MS, chiusura.getTime());
        if (giornoDellaSettimana(giorno) === 0 || da > a) continue; // domenica, o fuori finestra
      } else {
        //  Il giorno prima dell'appuntamento (la domenica non si scrive: sabato).
        let prima = giornoPrima(giorno);
        if (giornoDellaSettimana(prima) === 0) prima = giornoPrima(prima);
        if (prima !== oggi || prima < acceso) continue;
        //  Preso meno di 24 ore prima: basta quel che si sono detti.
        const preso = Date.parse(d.statoDal ?? "");
        if (inizio && Number.isFinite(preso) && inizio.getTime() - preso < 24 * ORA_MS) continue;
        da = (istanteDiRoma(oggi, "09:00") as Date).getTime();
        a = (istanteDiRoma(oggi, "20:00") as Date).getTime() - MIN_MS;
      }
      const chiave = `${chiamata ? "ch" : "sd"}|${tel9}|${giorno}T${hm ?? "00:00"}`;
      if (tel9 && chiaveGiaPresa(invii, chiave)) continue;
      if (viste.has(chiave)) continue;
      viste.add(chiave);
      if (!prerequisiti()) continue;
      const extra: ExtraStato = {
        tipo: chiamata ? "promemoria_chiamata" : "promemoria_sede",
        stato,
        inizio,
      };
      if (ora < da) {
        metti(0, {
          tipo: "aspetta",
          scheda,
          motivo: `parte alle ${oraDi(aRoma(new Date(da)).minuti)}`,
        });
      } else if (ora > a) {
        salta(chiamata ? "saltato: giro in ritardo" : "saltato: oltre le 20:00");
      } else if (totaleOggi >= tetti.totale) {
        salta("tetto di messaggi di oggi raggiunto");
      } else if (inPausa(invii, tel9, adesso)) {
        metti(0, { tipo: "aspetta", scheda, motivo: FRASE_PAUSA });
      } else {
        metti(0, { tipo: "invia", scheda, chiave, extra });
      }
      continue;
    }

    // ══ A EVENTO ═══════════════════════════════════════════════════════════
    const codice = riga.codice as string;
    const evento = Date.parse(d.statoDal ?? "");
    //  Senza `statoDal` (stato messo prima, o da una strada che non lo scrive): mai.
    if (!Number.isFinite(evento)) continue;
    //  «Serve statoDal dopo l'accensione»: lo stato messo prima non riceve niente.
    if (evento < accesoIl) continue;
    const entro = evento + (riga.entroOre ?? 48) * ORA_MS;
    if (ora > entro + MEMORIA_SALTI_MIN * MIN_MS) continue;
    const chiave = riga.unaVoltaPerNumero
      ? `s|${codice}|${tel9}`
      : `s|${codice}|${tel9}|${d.statoDal}`;
    if (tel9 && chiaveGiaPresa(invii, chiave)) continue;
    if (viste.has(chiave)) continue;
    viste.add(chiave);
    if (!prerequisiti()) continue;
    const settimana = invii.some(
      (i) =>
        (i.chiave ?? "").startsWith(`s|${codice}|${tel9}|`) &&
        STATI_ARRIVATI.includes(i.stato) &&
        ora - Date.parse(i.prenotatoIl) < GIORNI_FRA_DUE_UGUALI * 24 * ORA_MS,
    );
    const extra: ExtraStato = { tipo: "ricontatto", stato, inizio: null };
    const parte = primoIstanteUtile(
      new Date(Math.max(evento + (riga.attesaMin ?? 0) * MIN_MS, ora)),
    );
    if (settimana) {
      salta("già un messaggio uguale a questo numero negli ultimi 7 giorni");
    } else if (ora > entro) {
      salta("saltato: messaggio scaduto");
    } else if (
      !TIPI_SENZA_FRENO.includes(extra.tipo) &&
      aspettaRisposta(numero as string, invii, d.contattoWa, adesso)
    ) {
      salti.push({ tipo: "salta", scheda, motivo: FRASE_FRENO });
    } else if (parte.getTime() > ora) {
      metti(1, { tipo: "aspetta", scheda, motivo: quandoParte(parte) });
    } else if (ricontattiOggi >= tetti.ricontatti) {
      metti(1, {
        tipo: "aspetta",
        scheda,
        motivo: "tetto dei ricontatti di oggi raggiunto: se ne parla domani",
      });
    } else if (totaleOggi >= totaleSenzaRiserva(tetti.totale)) {
      metti(1, {
        tipo: "aspetta",
        scheda,
        motivo: "tetto di messaggi di oggi raggiunto: se ne parla domani",
      });
    } else if (inPausa(invii, tel9, adesso)) {
      metti(1, { tipo: "aspetta", scheda, motivo: FRASE_PAUSA });
    } else if (TIPI_COL_RITMO.includes(extra.tipo) && prossimo && prossimo.getTime() > ora) {
      metti(1, {
        tipo: "aspetta",
        scheda,
        motivo: `ritmo: il prossimo ricontatto verso le ${oraDi(aRoma(prossimo).minuti)}`,
      });
    } else {
      metti(1, { tipo: "invia", scheda, chiave, extra });
    }
  }

  uscita.sort((a, b) => a.ordine - b.ordine || a.id.localeCompare(b.id));
  salti.sort((a, b) => a.scheda.id.localeCompare(b.scheda.id));
  return [...uscita.map((x) => x.d), ...salti];
}

/** Il giorno prima («AAAA-MM-GG»). */
function giornoPrima(g: string): string {
  const [a, m, d] = g.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
}
