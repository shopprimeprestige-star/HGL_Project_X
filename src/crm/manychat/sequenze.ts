/** ── LE DUE SEQUENZE: LEAD NUOVO E GIORNO DEL MEET ─────────────────────────
 *
 *  Commessa 2026-10-25 (Sheets e sequenze WhatsApp), compito Q. Le prove stanno
 *  in `prove/manychat/sequenze.mjs`.
 *
 *  Modulo PURO, stessa forma di `quando.ts`: l'orologio, i consulenti, il
 *  registro degli invii e i tetti arrivano da fuori (`ContestoQuando`). Il giro
 *  sceglie fra le decisioni `invia` e prenota davvero (tetti e ritmo veri li
 *  applica l'SQL: qui è la stessa regola in lettura).
 *  - `decidiLeadNuovi`: primo contatto (`n|tel9`) e richiamo a 24 h (`n24|tel9`).
 *  - `decidiGiornoMeet`: mattina (`o|tel9|…`) e ora esatta (`a|tel9|…`); il
 *    promemoria dei 25' resta in `decidiPromemoria`.
 *
 *  ── LE REGOLE (PIANO §5a, §5b) ────────────────────────────────────────────
 *   Lead nuovo
 *   - è per chi ha lasciato il numero nel modulo delle inserzioni, DOPO la frase
 *     del consenso (`moduloVale`): un «Ok a WhatsApp» a voce non basta a farla
 *     partire; una revoca (`okWhatsapp.si === false`) o STOP la fermano;
 *   - solo lead entrati dopo l'ultima accensione dell'interruttore e da meno di
 *     72 ore; stato «da contattare» / «non risponde» / «segreteria», senza meet;
 *   - se la setter gli ha già scritto a mano (chat) dopo l'ingresso: niente;
 *   - primo contatto SUBITO, dalle 9 alle 20 da lunedì a sabato (ora di Roma),
 *     altrimenti alle 9:00 seguenti; il freno «mai due senza risposta» vale e
 *     il ritmo di 27-33' NON lo aspetta;
 *   - richiamo 24 ore dopo (stessa ora di Roma del giorno dopo, domenica →
 *     lunedì), fra le 9 e le 20, entro 48 ore dal bersaglio. È l'UNICA
 *     eccezione al freno, stretta: parte solo se l'ultimo messaggio automatico
 *     arrivato a quel numero è proprio il suo primo contatto, `inviato`, senza
 *     risposta. Il richiamo aspetta il ritmo. Dopo, basta: niente terzo messaggio.
 *   Giorno del meet (nessuno dei due è frenato; contano nei tetti, STOP vale)
 *   - mattina: dalle 9:00 (7:30 se il meet è prima delle 10:00), finché
 *     mancano almeno 40 minuti; sotto, «c'è già il promemoria»;
 *   - ora esatta: da 0 a +10 minuti dall'inizio, col link; senza link non parte.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento } from "../types";
import { aRoma, oraNormale } from "../promemoria/formati";
import { istanteDiRoma, scadenzaRicontatto } from "./contatto";
import {
  APERTURA_RICONTATTI_MIN,
  CHIUSURA_RICONTATTI_MIN,
  FRASE_FRENO,
  FRASE_PAUSA,
  TETTI_DI_SERIE,
  chiaveGiaPresa,
  contaOggi,
  giornoDellaSettimana,
  giornoDopo,
  giornoVero,
  inPausa,
  minutiDi,
  oraDi,
  totaleSenzaRiserva,
  type ContestoQuando,
  type DecisioneQuando,
  type SchedaQuando,
} from "./quando";
import {
  STATI_ARRIVATI,
  TIPI_NEI_TETTI,
  aspettaRisposta,
  consensoWhatsapp,
  eImportato,
  moduloVale,
  numeroWa,
  ultimeNoveCifre,
  ultimoAutomatico,
  type InvioPerFreno,
} from "./regole";
import { campiMeetAdesso, campiMeetOggi, campiPrimoContatto } from "./testi";

/** Gli stati in cui un lead è ancora «nuovo» per queste sequenze. */
export const STATI_LEAD_NUOVO = ["da_contattare", "non_risponde", "segreteria"];
/** Il primo contatto parte solo per chi è entrato (e ha compilato il modulo) da meno di così. */
export const FINESTRA_LEAD_NUOVO_ORE = 72;
/** Il richiamo si accetta fino a così dopo il suo bersaglio; oltre è scaduto. */
export const SCADENZA_RICHIAMO_ORE = 48;
/** La mattina del meet: dalle 9:00; se il meet è prima delle 10:00, dalle 7:30. */
export const MATTINA_MIN = 9 * 60;
export const MATTINA_PRESTO_MIN = 7 * 60 + 30;
export const MEET_PRESTO_PRIMA_DI_MIN = 10 * 60;
/** Il messaggio del mattino parte finché mancano almeno così tanti minuti al meet. */
export const ANTICIPO_MINIMO_MATTINA_MIN = 40;
/** Il messaggio all'ora esatta si accetta da 0 a +10 minuti dall'inizio… */
export const FINESTRA_MEET_ADESSO_MIN = 10;
/** …e per un'ora dopo l'inizio un ritardo si vede (salta) invece di sparire. */
const MEMORIA_RITARDO_MIN = 60;
/** Un'ora dopo la scadenza del richiamo i «salta» della sequenza non si ripetono più. */
const MEMORIA_SALTI_MIN = 60;
/** Al massimo due messaggi del mattino per telefono e giorno (meet spostato). */
export const MAX_MEET_OGGI_PER_GIORNO = 2;

const ORA_MS = 3_600_000;
const MIN_MS = 60_000;

/** Cosa serve in più alle sequenze del lead nuovo. */
export interface ContestoLeadNuovi extends ContestoQuando {
  /** `controlli.fraseModulo.il`: da quando vale `consensoModulo`. `null` =
   *  nessuna data segnata, il consenso del modulo non vale per nessuno. */
  fraseModuloDal: string | null;
  /** `manychat_config.lead_nuovo_dal`: l'ultima accensione dell'interruttore.
   *  `null` = mai accesa: nessun lead è «nuovo». */
  leadNuovoDal: string | null;
  /** `manychat_giro.prossimo_ricontatto_dopo`: lo aspetta solo il richiamo. */
  prossimoDopo?: Date | null;
}

export interface ContestoGiornoMeet extends ContestoQuando {
  /** come sopra: il consenso del modulo vale solo da questa data */
  fraseModuloDal: string | null;
}

/** Quale dei due messaggi del lead nuovo. */
export type ExtraLeadNuovo = { quale: "primo_contatto" | "richiamo_24h"; tel9: string };
/** Quale dei due messaggi del giorno del meet, con l'inizio del meet. */
export type ExtraGiornoMeet = { quale: "meet_oggi" | "meet_adesso"; inizioMeet: Date };

/** «lunedì 26 ottobre» (ora di Roma). */
const GIORNO_A_PAROLE = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Rome",
});
const quandoParte = (d: Date) =>
  `parte alle ${oraDi(aRoma(d).minuti)} di ${GIORNO_A_PAROLE.format(d)}`;

/** Il primo istante utile per scrivere — dalle 9:00 alle 20:00 da lunedì a
 *  sabato, ora di Roma — non prima di `da`. Se `da` è già dentro la finestra
 *  restituisce `da` stesso; altrimenti le 9:00 del primo giorno utile (stesso
 *  giorno se è presto, il giorno dopo se è tardi, lunedì se è domenica). */
export function primoIstanteUtile(da: Date): Date {
  const { giorno, minuti } = aRoma(da);
  const domenica = giornoDellaSettimana(giorno) === 0;
  const chiuso = domenica || minuti >= CHIUSURA_RICONTATTI_MIN;
  if (!chiuso && minuti >= APERTURA_RICONTATTI_MIN) return da;
  let g = giorno;
  if (chiuso) {
    g = giornoDopo(g);
    if (giornoDellaSettimana(g) === 0) g = giornoDopo(g);
  }
  return istanteDiRoma(g, oraDi(APERTURA_RICONTATTI_MIN)) as Date;
}

const nonVuoto = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** ── LEAD NUOVO: PRIMO CONTATTO E RICHIAMO A 24 ORE ─────────────────────── */
export function decidiLeadNuovi(
  schede: SchedaQuando[],
  adesso: Date,
  contesto: ContestoLeadNuovi,
): DecisioneQuando<ExtraLeadNuovo>[] {
  type Esito = DecisioneQuando<ExtraLeadNuovo>;
  const invii = contesto.invii ?? [];
  const tetti = contesto.tetti ?? TETTI_DI_SERIE;
  const frase = contesto.fraseModuloDal;
  const { giorno: oggi } = aRoma(adesso);
  const ora = adesso.getTime();
  //  Interruttore mai acceso: nessun lead è «nuovo».
  const dal = contesto.leadNuovoDal ? Date.parse(contesto.leadNuovoDal) : Number.NaN;
  if (!Number.isFinite(dal)) return [];

  type Candidato = {
    scheda: SchedaQuando;
    numero: string;
    tel9: string;
    entrata: number;
    /** il primo contatto già partito (solo per il richiamo) */
    primo?: InvioPerFreno;
    bersaglio?: Date;
  };
  const primi: Candidato[] = [];
  const richiami: Candidato[] = [];
  const salti: Esito[] = [];
  const visti = new Set<string>();

  const ordinate = [...schede].sort((a, b) => a.id.localeCompare(b.id));
  for (const scheda of ordinate) {
    const d = scheda.data;
    //  ── Chi è un lead nuovo: i filtri che non fanno rumore ────────────────
    if (d.consensoModulo?.via !== "modulo_meta") continue;
    const entrata = Date.parse(d.origineIngresso?.il ?? d.listaOrigine?.il ?? "");
    if (!Number.isFinite(entrata) || entrata < dal) continue;
    if (!STATI_LEAD_NUOVO.includes(String(d.stato ?? ""))) continue;
    if (nonVuoto(d.dataMeeting)) continue;
    if (d.contattoWa?.stato === "ha_risposto") continue;

    const numero = numeroWa(d.telefono);
    const tel9 = numero ? ultimeNoveCifre(numero) : "";
    const primo = tel9 ? invii.find((i) => i.chiave === `n|${tel9}`) : undefined;
    let bersaglioPrimo: Date | undefined;
    if (tel9 && chiaveGiaPresa(invii, `n24|${tel9}`)) continue; // la sequenza è finita
    if (!primo) {
      //  Il primo contatto vale per 72 ore dall'ingresso e dal modulo.
      if (ora - entrata >= FINESTRA_LEAD_NUOVO_ORE * ORA_MS) continue;
      const il = typeof d.consensoModulo.il === "string" ? Date.parse(d.consensoModulo.il) : NaN;
      if (Number.isFinite(il) && ora - il >= FINESTRA_LEAD_NUOVO_ORE * ORA_MS) continue;
    } else {
      //  Il primo è in corso (invio che sta ancora partendo): non è ancora né finito né fallito.
      if (primo.stato === "prenotato") continue;
      //  Passato il tempo del richiamo (più un'ora in cui lo si vede) la sequenza tace:
      //  «scaduto», «sequenza finita» e STOP non si ripetono a ogni giro per giorni.
      //  shortcut: l'ora del primo invio è `prenotatoIl` (la prenotazione precede
      //  l'invio di pochi secondi), da cambiare se il registro porterà `inviato_il`.
      const inviatoIl = Date.parse(primo.prenotatoIl);
      if (!Number.isFinite(inviatoIl)) continue;
      bersaglioPrimo = scadenzaRicontatto(new Date(inviatoIl));
      const finoA =
        bersaglioPrimo.getTime() + SCADENZA_RICHIAMO_ORE * ORA_MS + MEMORIA_SALTI_MIN * MIN_MS;
      if (ora > finoA) continue;
    }
    //  La setter gli ha già scritto a mano: la sequenza non si intromette.
    if (
      tel9 &&
      invii.some(
        (i) =>
          i.tipo === "chat" &&
          STATI_ARRIVATI.includes(i.stato) &&
          ultimeNoveCifre(i.telefono) === tel9 &&
          Date.parse(i.prenotatoIl) >= entrata,
      )
    )
      continue;
    //  Due schede con lo stesso telefono fanno UNA voce.
    if (tel9) {
      if (visti.has(tel9)) continue;
      visti.add(tel9);
    }

    //  ── Chi è in sequenza ma non può partire: lo si dice ──────────────────
    const salta = (motivo: string) => salti.push({ tipo: "salta", scheda, motivo });
    if (d.contattoWa?.stato === "stop") {
      salta("STOP");
      continue;
    }
    if (!numero) {
      salta("numero non valido");
      continue;
    }
    if (!consensoWhatsapp(d, frase).si) {
      salta("manca il consenso WhatsApp");
      continue;
    }
    //  Un «Ok a WhatsApp» a voce basta ai promemoria, non a questa sequenza.
    if (!moduloVale(d, frase)) continue;
    const campi = campiPrimoContatto(d);
    if (campi.tipo === "salta") {
      salta(campi.motivo);
      continue;
    }

    if (!primo) {
      primi.push({ scheda, numero, tel9, entrata });
      continue;
    }

    //  ── Il richiamo: la sua unica eccezione al freno ──────────────────────
    if (primo.stato !== "inviato") {
      salta("sequenza finita: il primo contatto non risulta inviato (incerto, fallito o saltato)");
      continue;
    }
    if (ultimoAutomatico(numero, invii)?.chiave !== primo.chiave) {
      salta("sequenza finita: dopo il primo contatto è partito un altro messaggio");
      continue;
    }
    //  Risposta, cambio a mano o scadenza del freno: la sequenza è chiusa.
    if (!aspettaRisposta(numero, invii, d.contattoWa, adesso)) continue;
    const bersaglio = bersaglioPrimo as Date;
    if (ora > bersaglio.getTime() + SCADENZA_RICHIAMO_ORE * ORA_MS) {
      salta("saltato: richiamo scaduto");
      continue;
    }
    richiami.push({ scheda, numero, tel9, entrata, primo, bersaglio });
  }

  const leadNuoviOggi = contaOggi(invii, oggi, ["primo_contatto", "richiamo_24h"]);
  const totaleOggi = contaOggi(invii, oggi, TIPI_NEI_TETTI);
  const prossimo = contesto.prossimoDopo ?? null;
  const uscita: Esito[] = [];

  //  Chi aspetta da più tempo tocca per primo.
  primi.sort((a, b) => a.entrata - b.entrata || a.scheda.id.localeCompare(b.scheda.id));
  for (const k of primi) {
    const aspetta = (motivo: string) => uscita.push({ tipo: "aspetta", scheda: k.scheda, motivo });
    const parte = primoIstanteUtile(adesso);
    if (aspettaRisposta(k.numero, invii, k.scheda.data.contattoWa, adesso)) {
      uscita.push({ tipo: "salta", scheda: k.scheda, motivo: FRASE_FRENO });
    } else if (parte.getTime() > ora) {
      aspetta(quandoParte(parte));
    } else if (leadNuoviOggi >= tetti.leadNuovi) {
      aspetta("tetto dei lead nuovi di oggi raggiunto: se ne parla domani");
    } else if (totaleOggi >= totaleSenzaRiserva(tetti.totale)) {
      aspetta("tetto di messaggi di oggi raggiunto: se ne parla domani");
    } else if (inPausa(invii, k.tel9, adesso)) {
      aspetta(FRASE_PAUSA);
    } else {
      //  Il ritmo di 27-33' NON c'è: un primo contatto non lo aspetta né lo sposta.
      uscita.push({
        tipo: "invia",
        scheda: k.scheda,
        chiave: `n|${k.tel9}`,
        extra: { quale: "primo_contatto", tel9: k.tel9 },
      });
    }
  }

  richiami.sort(
    (a, b) =>
      (a.bersaglio as Date).getTime() - (b.bersaglio as Date).getTime() ||
      a.scheda.id.localeCompare(b.scheda.id),
  );
  for (const k of richiami) {
    const aspetta = (motivo: string) => uscita.push({ tipo: "aspetta", scheda: k.scheda, motivo });
    //  Mai prima del bersaglio, mai fuori dalla finestra: il primo istante utile.
    const parte = primoIstanteUtile(new Date(Math.max((k.bersaglio as Date).getTime(), ora)));
    if (parte.getTime() > ora) {
      aspetta(`richiamo: ${quandoParte(parte)}`);
    } else if (leadNuoviOggi >= tetti.leadNuovi) {
      aspetta("tetto dei lead nuovi di oggi raggiunto: se ne parla domani");
    } else if (totaleOggi >= totaleSenzaRiserva(tetti.totale)) {
      aspetta("tetto di messaggi di oggi raggiunto: se ne parla domani");
    } else if (inPausa(invii, k.tel9, adesso)) {
      aspetta(FRASE_PAUSA);
    } else if (prossimo && prossimo.getTime() > ora) {
      aspetta(`ritmo: il prossimo richiamo verso le ${oraDi(aRoma(prossimo).minuti)}`);
    } else {
      uscita.push({
        tipo: "invia",
        scheda: k.scheda,
        chiave: `n24|${k.tel9}`,
        extra: { quale: "richiamo_24h", tel9: k.tel9 },
      });
    }
  }

  salti.sort((a, b) => a.scheda.id.localeCompare(b.scheda.id));
  return [...uscita, ...salti];
}

/** ── GIORNO DEL MEET: LA MATTINA E L'ORA ESATTA ──────────────────────────── */
export function decidiGiornoMeet(
  schede: SchedaQuando[],
  adesso: Date,
  contesto: ContestoGiornoMeet,
): DecisioneQuando<ExtraGiornoMeet>[] {
  type Esito = DecisioneQuando<ExtraGiornoMeet>;
  const invii = contesto.invii ?? [];
  const tetti = contesto.tetti ?? TETTI_DI_SERIE;
  const frase = contesto.fraseModuloDal;
  const { giorno: oggi } = aRoma(adesso);
  const ora = adesso.getTime();

  const uscita: { inizio: number; id: string; ordine: number; d: Esito }[] = [];
  const candidati: {
    scheda: SchedaQuando;
    inizio: Date;
    giornoMeet: string;
    ora: string;
    numero: string;
    tel9: string;
    consulente: string | undefined;
  }[] = [];

  for (const scheda of schede) {
    const d = scheda.data;
    if (!eAppuntamento(d.stato)) continue;
    if (!d.consulenteId || eImportato(scheda)) continue;
    const giornoMeet = giornoVero(d.dataMeeting);
    const hm = oraNormale(d.oraMeeting);
    if (!giornoMeet || !hm || giornoMeet !== oggi) continue;
    const inizio = istanteDiRoma(giornoMeet, hm);
    if (!inizio) continue;
    const salta = (motivo: string) =>
      uscita.push({
        inizio: inizio.getTime(),
        id: scheda.id,
        ordine: 0,
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
    if (!consensoWhatsapp(d, frase).si) {
      salta("manca il consenso WhatsApp");
      continue;
    }
    const consulente = contesto.consulenti.find((c) => c.id === d.consulenteId);
    if (!consulente) {
      salta("consulente non trovato");
      continue;
    }
    candidati.push({
      scheda,
      inizio,
      giornoMeet,
      ora: hm,
      numero,
      tel9: ultimeNoveCifre(numero),
      consulente: consulente.data?.nome,
    });
  }

  //  Prima per ora di meet, poi per scheda: fra due doppioni vince sempre la stessa.
  candidati.sort(
    (a, b) => a.inizio.getTime() - b.inizio.getTime() || a.scheda.id.localeCompare(b.scheda.id),
  );
  const viste = new Set<string>();
  for (const k of candidati) {
    const quale = `${k.tel9}|${k.giornoMeet}T${k.ora}`;
    if (viste.has(quale)) continue;
    viste.add(quale);
    const inizio = k.inizio.getTime();
    const metti = (ordine: number, d: Esito) => uscita.push({ inizio, id: k.scheda.id, ordine, d });
    const delTelefono = (i: { telefono: string }) => ultimeNoveCifre(i.telefono) === k.tel9;
    const diOggi = (i: { prenotatoIl: string }) => {
      const t = Date.parse(i.prenotatoIl);
      return Number.isFinite(t) && aRoma(new Date(t)).giorno === oggi;
    };
    const motiviDati = new Set<string>();
    /** un motivo dei dati (nome mancante…) uguale per i due messaggi si dice una volta */
    const saltaDati = (ordine: number, motivo: string) => {
      if (motiviDati.has(motivo)) return;
      motiviDati.add(motivo);
      metti(ordine, { tipo: "salta", scheda: k.scheda, motivo });
    };
    const tettoRaggiunto = () => contaOggi(invii, oggi, TIPI_NEI_TETTI) >= tetti.totale;

    // ── la mattina ──────────────────────────────────────────────────────────
    const chiaveO = `o|${k.tel9}|${k.giornoMeet}T${k.ora}`;
    inMattina: if (!chiaveGiaPresa(invii, chiaveO) && inizio > ora) {
      const campi = campiMeetOggi(k.scheda.data, k.consulente);
      if (campi.tipo === "salta") {
        saltaDati(0, campi.motivo);
        break inMattina;
      }
      const prestoMin = minutiDi(k.ora) < MEET_PRESTO_PRIMA_DI_MIN;
      const aperturaMin = prestoMin ? MATTINA_PRESTO_MIN : MATTINA_MIN;
      const apertura = (istanteDiRoma(k.giornoMeet, oraDi(aperturaMin)) as Date).getTime();
      const ultimo = inizio - ANTICIPO_MINIMO_MATTINA_MIN * MIN_MS;
      if (
        invii.some(
          (i) =>
            i.tipo === "conferma" &&
            STATI_ARRIVATI.includes(i.stato) &&
            delTelefono(i) &&
            diOggi(i),
        )
      ) {
        metti(0, {
          tipo: "salta",
          scheda: k.scheda,
          motivo: "la conferma è già partita oggi: basta quella",
        });
        break inMattina;
      }
      const giaPartiti = invii.filter(
        (i) =>
          i.tipo === "meet_oggi" && STATI_ARRIVATI.includes(i.stato) && delTelefono(i) && diOggi(i),
      ).length;
      if (giaPartiti >= MAX_MEET_OGGI_PER_GIORNO) {
        metti(0, {
          tipo: "salta",
          scheda: k.scheda,
          motivo: `già ${MAX_MEET_OGGI_PER_GIORNO} messaggi del mattino a questo numero oggi`,
        });
        break inMattina;
      }
      if (ultimo < apertura || ora > ultimo) {
        metti(0, { tipo: "salta", scheda: k.scheda, motivo: "saltato: c'è già il promemoria" });
      } else if (ora < apertura) {
        metti(0, {
          tipo: "aspetta",
          scheda: k.scheda,
          motivo: `messaggio del mattino: parte alle ${oraDi(aperturaMin)}`,
        });
      } else if (tettoRaggiunto()) {
        metti(0, {
          tipo: "salta",
          scheda: k.scheda,
          motivo: "tetto di messaggi di oggi raggiunto",
        });
      } else if (inPausa(invii, k.tel9, adesso)) {
        metti(0, { tipo: "aspetta", scheda: k.scheda, motivo: FRASE_PAUSA });
      } else {
        metti(0, {
          tipo: "invia",
          scheda: k.scheda,
          chiave: chiaveO,
          extra: { quale: "meet_oggi", inizioMeet: k.inizio },
        });
      }
    }

    // ── l'ora esatta, col link ──────────────────────────────────────────────
    const chiaveA = `a|${k.tel9}|${k.giornoMeet}T${k.ora}`;
    const dopoMin = (ora - inizio) / MIN_MS;
    oraEsatta: if (!chiaveGiaPresa(invii, chiaveA) && dopoMin <= MEMORIA_RITARDO_MIN) {
      const campi = campiMeetAdesso(k.scheda.data, k.consulente, k.scheda.id);
      if (campi.tipo === "salta") {
        saltaDati(1, campi.motivo);
        break oraEsatta;
      }
      if (dopoMin > FINESTRA_MEET_ADESSO_MIN) {
        metti(1, { tipo: "salta", scheda: k.scheda, motivo: "saltato: giro in ritardo" });
      } else if (dopoMin < 0) {
        metti(1, {
          tipo: "aspetta",
          scheda: k.scheda,
          motivo: `messaggio all'ora: parte alle ${k.ora}`,
        });
      } else if (tettoRaggiunto()) {
        metti(1, {
          tipo: "salta",
          scheda: k.scheda,
          motivo: "tetto di messaggi di oggi raggiunto",
        });
      } else if (inPausa(invii, k.tel9, adesso)) {
        metti(1, { tipo: "aspetta", scheda: k.scheda, motivo: FRASE_PAUSA });
      } else {
        metti(1, {
          tipo: "invia",
          scheda: k.scheda,
          chiave: chiaveA,
          extra: { quale: "meet_adesso", inizioMeet: k.inizio },
        });
      }
    }
  }

  return uscita
    .sort((a, b) => a.inizio - b.inizio || a.id.localeCompare(b.id) || a.ordine - b.ordine)
    .map((x) => x.d);
}
