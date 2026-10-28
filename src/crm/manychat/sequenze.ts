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
 *  - `decidiMeetDomani`: il promemoria 24 ore prima (`d|tel9|…`), sotto lo stesso
 *    interruttore «Giorno del meet».
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
 *   Commessa 2026-10-28 (WhatsApp a tutti gli importati e ai ritorni), in coda a
 *   `decidiLeadNuovi`: vedi `decidiImportatiERitorni`. Nessun consenso (decisione
 *   del titolare, «rischio mio»), nessuna finestra di 72 ore; restano STOP, revoca
 *   di «Ok a WhatsApp» e numero valido.
 *   Giorno del meet (nessuno dei due è frenato; contano nei tetti, STOP vale)
 *   - mattina: dalle 9:00 (7:30 se il meet è prima delle 10:00), finché
 *     mancano almeno 40 minuti; sotto, «c'è già il promemoria»;
 *   - ora esatta: da 0 a +10 minuti dall'inizio, col link; senza link non parte.
 *   24 ore prima (richiesta del titolare, 26/10; anche questo non frenato)
 *   - il bersaglio è l'ora del meet, il giorno prima (ora di Roma, non «meno 24
 *     ore»: col cambio d'ora sarebbe sfalsato di un'ora); prima delle 9:00 si
 *     porta alle 9:00, dalle 20:00 in poi alle 19:30;
 *   - parte dal bersaglio e per 2 ore, e comunque mai dalle 20:00 in poi;
 *   - se la consulenza è stata fissata meno di 24 ore prima dell'inizio non parte
 *     (c'è già la conferma), e non dice niente.
 *  ───────────────────────────────────────────────────────────────────────── */
import { STATI_APPUNTAMENTO, STATI_PRIMO_CONTATTO, eAppuntamento } from "../types";
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
import {
  campiCasiReali,
  campiMeetAdesso,
  campiMeetDomani,
  campiMeetOggi,
  campiPrimoContatto,
  campiRitorno,
} from "./testi";

/** Gli stati in cui un lead è ancora «nuovo» per queste sequenze.
 *  «attesa_whatsapp» (commessa 2026-10-28): è lo stato in cui il giro stesso porta un
 *  «da contattare» dopo il primo messaggio; il richiamo a 24 ore deve valere anche lì.
 *  Il primo contatto invece resta solo per chi non l'ha ancora ricevuto (vedi sotto). */
export const STATI_LEAD_NUOVO = ["da_contattare", "non_risponde", "segreteria", "attesa_whatsapp"];
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
/** Un'ora dopo la scadenza i «salta» di una sequenza o di un messaggio per stato non si
 *  ripetono più (usata anche da `stati.ts`). */
export const MEMORIA_SALTI_MIN = 60;
/** Al massimo due messaggi del mattino per telefono e giorno (meet spostato). */
export const MAX_MEET_OGGI_PER_GIORNO = 2;
/** 24 ore prima: se il meet è dalle 20:00 in poi il messaggio parte alle 19:30… */
export const ULTIMO_BERSAGLIO_DOMANI_MIN = 19 * 60 + 30;
/** …si accetta per 2 ore dal bersaglio (e mai dalle 20:00 in poi)… */
export const FINESTRA_MEET_DOMANI_MIN = 120;
/** …e non parte se la consulenza è stata fissata meno di così prima dell'inizio. */
export const FISSATA_ALMENO_ORE_PRIMA = 24;

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
  /** ISO: i primi contatti partiti prima di questa data non ricevono i casi reali. Se manca vale
   *  `CASI_REALI_DAL` (le prove la passano per provare le regole con date del passato). */
  casiRealiDal?: string | null;
}

export interface ContestoGiornoMeet extends ContestoQuando {
  /** come sopra: il consenso del modulo vale solo da questa data */
  fraseModuloDal: string | null;
}

/** Quale dei due messaggi del lead nuovo. */
export type ExtraLeadNuovo = {
  quale: "primo_contatto" | "richiamo_24h" | "ritorno" | "casi_reali";
  tel9: string;
};
/** I motivi di «aspetta» e «salta» dei due messaggi nuovi (importati e ritorni) portano
 *  questo prefisso: il giro ne riconosce il tipo e NON li conta fra i problemi (gli
 *  importati sono tanti: numeri e nomi storti riempirebbero i 20 posti dei problemi). */
export const PREFISSO_IMPORTATO = "da contattare: ";
export const PREFISSO_RITORNO = "ritorno: ";
/** Lo stesso per i casi reali (commessa 2026-10-28): STOP, revoca e attese non sono problemi del riquadro. */
export const PREFISSO_CASI = "casi reali: ";
/** ── CASI REALI: DA QUANDO VALE ──────────────────────────────────────────────
 *  Solo i primi contatti partiti da questo istante in poi ricevono `hgl_casi_reali`: chi
 *  l'ha avuto prima della pubblicazione non lo riceve (richiesta del titolare, «nessun
 *  recupero dei vecchi»). Un istante fisso nel codice, la scelta più semplice: i primi
 *  contatti non partono prima delle 9:00, quindi la mezzanotte del giorno dopo la
 *  pubblicazione non lascia scoperto nessuno.
 *  shortcut: costante, da riportare al giorno vero della pubblicazione se cambia (il capo
 *  progetto la controlla prima di collegare il flusso `hgl_casi_reali` in ManyChat); da
 *  cambiare in una colonna di `manychat_config` se serve poterla muovere senza pubblicare. */
export const CASI_REALI_DAL = "2026-10-29T00:00:00+01:00";
/** Quale dei due messaggi del giorno del meet, con l'inizio del meet. */
export type ExtraGiornoMeet = { quale: "meet_oggi" | "meet_adesso"; inizioMeet: Date };
/** Il promemoria 24 ore prima, con l'inizio del meet. */
export type ExtraMeetDomani = { quale: "meet_domani"; inizioMeet: Date };

/** «lunedì 26 ottobre» (ora di Roma). */
const GIORNO_A_PAROLE = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Rome",
});
export const quandoParte = (d: Date) =>
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
/** I messaggi che contano nel tetto dei lead nuovi. */
const TIPI_LEAD_NUOVI: InvioPerFreno["tipo"][] = [
  "primo_contatto",
  "richiamo_24h",
  "ritorno",
  "casi_reali",
];

/** Gli stati di chi la consulenza non l'ha mai avuta: quelli di primo contatto (`types.ts`)
 *  senza gli appuntamenti. Il testo di `hgl_ritorno` chiede «Vuole fissare la consulenza
 *  gratuita?»: a chi ne ha già avuta una (in chat, in valutazione, attesa acconto,
 *  ricontatto fissato, no-show, clienti…) non si scrive. Stato assente = nuovo = sì. */
const STATI_SENZA_CONSULENZA: string[] = STATI_PRIMO_CONTATTO.filter(
  (s) => !STATI_APPUNTAMENTO.includes(s),
);
const senzaConsulenza = (stato: unknown) =>
  !nonVuoto(stato) || STATI_SENZA_CONSULENZA.includes(String(stato));

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
      //  In «attesa_whatsapp» c'è già stato un primo contatto (o l'ha scritto qualcuno a mano):
      //  senza il suo invio nel registro non se ne manda un altro, solo il richiamo ha senso.
      if (d.stato === "attesa_whatsapp") continue;
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
    //  I casi reali (secondo messaggio, subito dopo il primo) non interrompono la sequenza.
    if (
      ultimoAutomatico(
        numero,
        invii.filter((i) => i.tipo !== "casi_reali"),
      )?.chiave !== primo.chiave
    ) {
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

  //  I casi reali passano davanti a ogni altro messaggio del lead nuovo: chi ha già ricevuto il
  //  primo contatto deve ricevere subito il secondo. Occupano un posto dei tetti.
  const casi = decidiCasiReali(
    ordinate,
    adesso,
    { invii, tetti, casiRealiDal: contesto.casiRealiDal },
    contaOggi(invii, oggi, TIPI_LEAD_NUOVI),
    contaOggi(invii, oggi, TIPI_NEI_TETTI),
  );
  const leadNuoviOggi = contaOggi(invii, oggi, TIPI_LEAD_NUOVI) + casi.emessi;
  const totaleOggi = contaOggi(invii, oggi, TIPI_NEI_TETTI) + casi.emessi;
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

  //  Commessa 2026-10-28: gli importati mai contattati e i ritorni. Chi la sequenza del
  //  modulo ha già messo in coda (primo contatto o richiamo) non lo guardano.
  const inSequenza = new Set([...primi, ...richiami].map((k) => k.tel9));
  const nuovi = decidiImportatiERitorni(
    ordinate,
    adesso,
    { invii, tetti },
    inSequenza,
    leadNuoviOggi,
    totaleOggi,
    uscita.filter((x) => x.tipo === "invia").length,
  );
  //  Se uno di questi due messaggi prende in carico una scheda, i vecchi «salta» di
  //  quella scheda (consenso mancante, sequenza finita…) non hanno più senso.
  const prese = new Set(nuovi.map((x) => x.scheda.id));
  const saltiRimasti = salti.filter((x) => !prese.has(x.scheda.id));
  saltiRimasti.sort((a, b) => a.scheda.id.localeCompare(b.scheda.id));
  return [...casi.uscita, ...uscita, ...nuovi, ...saltiRimasti];
}

/** ── CASI REALI: IL SECONDO MESSAGGIO DOPO IL PRIMO CONTATTO (commessa 2026-10-28) ──
 *  Richiesta del titolare: dopo il primo messaggio un secondo modello (`hgl_casi_reali`) col
 *  link ai casi veri. Parte UNA volta per numero (`casi|tel9`) se:
 *   - un primo contatto (`n|tel9` o `n|tel9|r`) è ARRIVATO (registro: `inviato`) da `casiRealiDal`
 *     in poi e la scadenza della sua risposta non è passata (poi tocca al richiamo);
 *   - la scheda dice ancora «In attesa» da quel primo contatto: chi ha risposto («Ha risposto»,
 *     risposta sul registro), chi è stato cambiato a mano o ha un altro messaggio dopo il
 *     primo è in una conversazione vera e il link lo manda il consulente;
 *   - nessun appuntamento, nessuno STOP, nessuna revoca, il nome c'è.
 *  Non lo ferma «mai due senza risposta» (è lui il secondo, voluto), ma rispetta fascia
 *  oraria, pausa di 120 s per contatto e tetti: conta fra i lead nuovi e sotto la riserva.
 *  Non cambia lo stato della scheda né la scadenza della risposta (vedi `giro.ts`). */
function decidiCasiReali(
  ordinate: SchedaQuando[],
  adesso: Date,
  contesto: { invii: InvioPerFreno[]; tetti: typeof TETTI_DI_SERIE; casiRealiDal?: string | null },
  leadNuoviOggi: number,
  totaleOggi: number,
): { uscita: DecisioneQuando<ExtraLeadNuovo>[]; emessi: number } {
  type Esito = DecisioneQuando<ExtraLeadNuovo>;
  const { invii, tetti } = contesto;
  const ora = adesso.getTime();
  const dal = Date.parse(contesto.casiRealiDal ?? CASI_REALI_DAL);
  if (!Number.isFinite(dal)) return { uscita: [], emessi: 0 };

  //  Il primo contatto arrivato di ogni numero (il più recente, se ce n'è più d'uno).
  const primi = new Map<string, InvioPerFreno>();
  for (const i of invii) {
    if (i.tipo !== "primo_contatto" || i.stato !== "inviato") continue;
    if (!/^n\|\d+(\|r)?$/.test(i.chiave ?? "")) continue;
    const il = Date.parse(i.prenotatoIl);
    const tel9 = ultimeNoveCifre(i.telefono);
    if (!tel9 || !Number.isFinite(il) || il < dal) continue;
    const prima = primi.get(tel9);
    if (!prima || il > Date.parse(prima.prenotatoIl)) primi.set(tel9, i);
  }
  if (primi.size === 0) return { uscita: [], emessi: 0 };

  type Candidato = { scheda: SchedaQuando; tel9: string; inviatoIl: number };
  const candidati: Candidato[] = [];
  const salti: Esito[] = [];
  const visti = new Set<string>();
  for (const scheda of ordinate) {
    const d = scheda.data;
    const numero = numeroWa(d.telefono);
    const tel9 = numero ? ultimeNoveCifre(numero) : "";
    const primo = tel9 ? primi.get(tel9) : undefined;
    if (!numero || !primo) continue;
    //  Due schede con lo stesso telefono fanno UNA voce (la prima per id).
    if (visti.has(tel9)) continue;
    visti.add(tel9);
    if (chiaveGiaPresa(invii, `casi|${tel9}`)) continue; // una volta sola, in qualunque stato
    const inviatoIl = Date.parse(primo.prenotatoIl);
    //  Passata la scadenza della risposta del primo contatto è l'ora del richiamo: niente.
    if (ora >= scadenzaRicontatto(new Date(inviatoIl)).getTime()) continue;

    const salta = (motivo: string) =>
      salti.push({ tipo: "salta", scheda, motivo: PREFISSO_CASI + motivo });
    const cw = d.contattoWa;
    if (cw?.stato === "stop") {
      salta("STOP");
      continue;
    }
    if (d.okWhatsapp?.si === false) {
      salta("revoca di «Ok a WhatsApp»");
      continue;
    }
    //  Ha risposto, è stato cambiato a mano, ha un appuntamento o gli ha scritto qualcun altro:
    //  non è più il momento dei casi reali.
    if (cw?.stato !== "in_attesa" || cw.motivo !== "primo_contatto") continue;
    if (nonVuoto(d.dataMeeting) || eAppuntamento(d.stato)) continue;
    if (primo.rispostaIl) continue;
    if (ultimoAutomatico(numero, invii)?.chiave !== primo.chiave) continue;
    if (!aspettaRisposta(numero, invii, cw, adesso)) continue;
    const campi = campiCasiReali(d);
    if (campi.tipo === "salta") {
      salta(campi.motivo);
      continue;
    }
    candidati.push({ scheda, tel9, inviatoIl });
  }

  //  Chi aspetta da più tempo tocca per primo.
  candidati.sort((a, b) => a.inviatoIl - b.inviatoIl || a.scheda.id.localeCompare(b.scheda.id));
  const uscita: Esito[] = [];
  const parte = primoIstanteUtile(adesso);
  let emessi = 0;
  for (const k of candidati) {
    const aspetta = (motivo: string) =>
      uscita.push({ tipo: "aspetta", scheda: k.scheda, motivo: PREFISSO_CASI + motivo });
    if (parte.getTime() > ora) {
      aspetta(quandoParte(parte));
    } else if (leadNuoviOggi + emessi >= tetti.leadNuovi) {
      aspetta("tetto dei lead nuovi di oggi raggiunto: se ne parla domani");
    } else if (totaleOggi + emessi >= totaleSenzaRiserva(tetti.totale)) {
      aspetta("tetto di messaggi di oggi raggiunto: se ne parla domani");
    } else if (inPausa(invii, k.tel9, adesso)) {
      aspetta(FRASE_PAUSA);
    } else {
      emessi++;
      uscita.push({
        tipo: "invia",
        scheda: k.scheda,
        chiave: `casi|${k.tel9}`,
        extra: { quale: "casi_reali", tel9: k.tel9 },
      });
    }
  }
  return { uscita: [...uscita, ...salti], emessi };
}

/** ── IMPORTATI MAI CONTATTATI E CONTATTI DI RITORNO (commessa 2026-10-28) ────
 *  Richiesta del titolare: «tutti i lead importati da contattare tranne quelli già
 *  in chat» e «i lead di ritorno, con il loro messaggio, appena entrano». Decisioni:
 *  nessun consenso («rischio mio»), nessuna finestra: al primo giro prende anche i
 *  vecchi. Restano STOP, revoca di «Ok a WhatsApp» e numero valido.
 *
 *  Primo contatto (`n|tel9`): ogni lead (importato o no, dal 28/10) in stato «da contattare», senza meet, senza
 *  nessun secondo stato del contatto (già in chat / già scritto) e senza un invio
 *  ARRIVATO a quel numero (qualunque tipo, chat compresa). Una volta sola per numero;
 *  se l'unico `n|tel9` è «fallito» si ritenta UNA volta con `n|tel9|r`.
 *  Ritorno (`r|tel9|<ultimo ritorno>`): il `ricarico` è salito; non ha mai avuto una
 *  consulenza (stato di primo contatto, nessuna `dataMeeting`, nessun acconto), e dopo `ricarico.ultimo` nessuno gli ha scritto (invio arrivato,
 *  cambio del secondo stato, «Contatta su WhatsApp»). Una volta per ritorno. Il freno
 *  «mai due senza risposta» non lo ferma: è lui che ci ha scritto.
 *  I ritorni passano avanti agli importati; uno stesso numero è UNA voce sola.
 *  shortcut: il registro letto dal giro copre 8 giorni; un invio più vecchio a un
 *  numero senza segni sulla scheda non si vede qui (l'SQL ferma comunque le chiavi
 *  già prese). Da cambiare se serve guardare più indietro. */
function decidiImportatiERitorni(
  ordinate: SchedaQuando[],
  adesso: Date,
  contesto: { invii: InvioPerFreno[]; tetti: typeof TETTI_DI_SERIE },
  inSequenza: Set<string>,
  leadNuoviOggi: number,
  totaleOggi: number,
  gia: number,
): DecisioneQuando<ExtraLeadNuovo>[] {
  type Esito = DecisioneQuando<ExtraLeadNuovo>;
  type Candidato = {
    scheda: SchedaQuando;
    tel9: string;
    chiave: string;
    quale: "primo_contatto" | "ritorno";
    /** per l'ordine: il più recente passa per primo */
    quando: number;
  };
  const { invii, tetti } = contesto;
  const ora = adesso.getTime();
  const presi = new Set(inSequenza);
  const candidati: Candidato[] = [];
  const uscita: Esito[] = [];
  /** i «salta» vanno in coda: nella prova a secco (che mostra le prime 100 righe) i candidati vengono prima */
  const salti: Esito[] = [];
  const arrivati = (tel9: string) =>
    invii.filter((i) => STATI_ARRIVATI.includes(i.stato) && ultimeNoveCifre(i.telefono) === tel9);

  for (const scheda of ordinate) {
    const d = scheda.data;
    const numero = numeroWa(d.telefono);
    const tel9 = numero ? ultimeNoveCifre(numero) : "";
    //  Uno stesso numero è UNA voce sola (anche se la sequenza del modulo l'ha già presa).
    if (tel9 && presi.has(tel9)) continue;
    const salta = (prefisso: string, motivo: string) =>
      salti.push({ tipo: "salta", scheda, motivo: prefisso + motivo });
    /** I filtri che restano sempre, uguali per i due messaggi; `true` = detto con un «salta» */
    const nonPuo = (prefisso: string): boolean => {
      if (d.contattoWa?.stato === "stop") salta(prefisso, "STOP");
      else if (d.okWhatsapp?.si === false) salta(prefisso, "revoca di «Ok a WhatsApp»");
      else if (!numero) salta(prefisso, "numero non valido");
      else return false;
      if (tel9) presi.add(tel9);
      return true;
    };

    //  ── Ritorno: se il `ricarico` è salito la scheda è sua, e basta ──────────
    const ultimo = Date.parse(String(d.ricarico?.ultimo ?? ""));
    if (Number.isFinite(ultimo)) {
      //  Solo chi non ha mai avuto una consulenza: stato di primo contatto, nessuna data di
      //  meet (passata o futura), nessun acconto.
      if (!senzaConsulenza(d.stato) || nonVuoto(d.dataMeeting)) continue;
      if (Number(d.payment?.accontoPagato) > 0) continue;
      const dopo = (iso: unknown) => Date.parse(String(iso ?? "")) > ultimo;
      //  Già scritto DOPO il ritorno (invio arrivato, cambio del secondo stato, «Contatta su
      //  WhatsApp»): niente. Fa eccezione lo STOP, che si dice sempre.
      const contattato =
        dopo(d.contattoWa?.il) ||
        dopo(d.ricarico?.whatsappIl) ||
        (!!tel9 && arrivati(tel9).some((i) => dopo(i.prenotatoIl)));
      if (contattato && d.contattoWa?.stato !== "stop") continue;
      if (nonPuo(PREFISSO_RITORNO)) continue;
      const chiave = `r|${tel9}|${d.ricarico?.ultimo}`;
      if (chiaveGiaPresa(invii, chiave)) continue;
      const campi = campiRitorno(d);
      presi.add(tel9);
      if (campi.tipo === "salta") salta(PREFISSO_RITORNO, campi.motivo);
      else candidati.push({ scheda, tel9, chiave, quale: "ritorno", quando: ultimo });
      continue;
    }

    //  ── Lead «da contattare» mai contattato (importato o no: richiesta del titolare
    //  28/10, «tutti i lead da contattare, anche quelli vecchi») ─────────────────
    if (d.stato !== "da_contattare" || nonVuoto(d.dataMeeting)) continue;
    //  Qualunque secondo stato è «già in chat / già scritto». Due eccezioni: STOP (si dice) e
    //  «non raggiungibile», che lascia il posto a UN ritentativo (sotto).
    const staScritto = d.contattoWa?.stato;
    if (staScritto && staScritto !== "non_raggiungibile" && staScritto !== "stop") continue;
    if (nonPuo(PREFISSO_IMPORTATO)) continue;
    if (arrivati(tel9).length > 0) continue;
    const base = `n|${tel9}`;
    const primo = invii.find((i) => i.chiave === base);
    let chiave = base;
    if (primo) {
      if (primo.stato !== "fallito" || chiaveGiaPresa(invii, `${base}|r`)) continue;
      chiave = `${base}|r`;
    }
    if (staScritto === "non_raggiungibile" && chiave === base) continue;
    const campi = campiPrimoContatto(d);
    presi.add(tel9);
    if (campi.tipo === "salta") {
      salta(PREFISSO_IMPORTATO, campi.motivo);
      continue;
    }
    const entrata = Date.parse(
      String(d.origineIngresso?.il ?? d.listaOrigine?.il ?? d.createdAt ?? ""),
    );
    candidati.push({
      scheda,
      tel9,
      chiave,
      quale: "primo_contatto",
      quando: Number.isFinite(entrata) ? entrata : 0,
    });
  }

  //  I ritorni prima, poi gli importati; dentro ciascuno il più recente per primo.
  candidati.sort(
    (a, b) =>
      Number(b.quale === "ritorno") - Number(a.quale === "ritorno") ||
      b.quando - a.quando ||
      a.scheda.id.localeCompare(b.scheda.id),
  );
  const parte = primoIstanteUtile(adesso);
  //  Ogni messaggio che parte occupa un posto nei tetti: oltre, si aspetta domani.
  let emessi = gia;
  for (const k of candidati) {
    const prefisso = k.quale === "ritorno" ? PREFISSO_RITORNO : PREFISSO_IMPORTATO;
    const aspetta = (motivo: string) =>
      uscita.push({ tipo: "aspetta", scheda: k.scheda, motivo: prefisso + motivo });
    if (parte.getTime() > ora) {
      aspetta(quandoParte(parte));
    } else if (leadNuoviOggi + emessi >= tetti.leadNuovi) {
      aspetta("tetto dei lead nuovi di oggi raggiunto: se ne parla domani");
    } else if (totaleOggi + emessi >= totaleSenzaRiserva(tetti.totale)) {
      aspetta("tetto di messaggi di oggi raggiunto: se ne parla domani");
    } else if (inPausa(invii, k.tel9, adesso)) {
      aspetta(FRASE_PAUSA);
    } else {
      emessi++;
      uscita.push({
        tipo: "invia",
        scheda: k.scheda,
        chiave: k.chiave,
        extra: { quale: k.quale, tel9: k.tel9 },
      });
    }
  }
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

/** ── 24 ORE PRIMA DEL MEET ───────────────────────────────────────────────── */
export function decidiMeetDomani(
  schede: SchedaQuando[],
  adesso: Date,
  contesto: ContestoGiornoMeet,
): DecisioneQuando<ExtraMeetDomani>[] {
  type Esito = DecisioneQuando<ExtraMeetDomani>;
  const invii = contesto.invii ?? [];
  const tetti = contesto.tetti ?? TETTI_DI_SERIE;
  const frase = contesto.fraseModuloDal;
  const { giorno: oggi } = aRoma(adesso);
  const domani = giornoDopo(oggi);
  const ora = adesso.getTime();

  const uscita: { inizio: number; id: string; d: Esito }[] = [];
  const candidati: {
    scheda: SchedaQuando;
    inizio: Date;
    ora: string;
    tel9: string;
    consulente: string | undefined;
    bersaglioMin: number;
    parte: number;
  }[] = [];

  //  Un ordine fisso: fra due doppioni vince sempre la stessa scheda.
  for (const scheda of [...schede].sort((a, b) => a.id.localeCompare(b.id))) {
    const d = scheda.data;
    if (!eAppuntamento(d.stato)) continue;
    if (!d.consulenteId || eImportato(scheda)) continue;
    const giornoMeet = giornoVero(d.dataMeeting);
    const hm = oraNormale(d.oraMeeting);
    //  Solo i meet di domani: quelli di oggi sono del giorno del meet.
    if (!giornoMeet || !hm || giornoMeet !== domani) continue;
    const inizio = istanteDiRoma(giornoMeet, hm);
    if (!inizio) continue;
    //  Il bersaglio è l'ora del meet, il giorno prima (cioè oggi), dentro la fascia 9-20.
    const minMeet = minutiDi(hm);
    const bersaglioMin =
      minMeet < APERTURA_RICONTATTI_MIN
        ? APERTURA_RICONTATTI_MIN
        : minMeet >= CHIUSURA_RICONTATTI_MIN
          ? ULTIMO_BERSAGLIO_DOMANI_MIN
          : minMeet;
    const parte = (istanteDiRoma(oggi, oraDi(bersaglioMin)) as Date).getTime();
    //  La conferma di QUESTA consulenza: se a questo numero ne è partita una da
    //  24 ore prima dell'inizio (o dal bersaglio, se viene prima) in poi, è stata
    //  fissata da poco e il promemoria sarebbe un doppione: niente, in silenzio.
    //  Come la mattina del meet, non ci si fida di `fissatoIl`, che una
    //  riprenotazione può lasciare vecchio.
    const tel = ultimeNoveCifre(numeroWa(d.telefono));
    const dopo = Math.min(inizio.getTime() - FISSATA_ALMENO_ORE_PRIMA * ORA_MS, parte);
    if (
      tel &&
      invii.some(
        (i) =>
          i.tipo === "conferma" &&
          STATI_ARRIVATI.includes(i.stato) &&
          ultimeNoveCifre(i.telefono) === tel &&
          Date.parse(i.prenotatoIl) >= dopo,
      )
    )
      continue;
    //  Freno in più: fissata meno di 24 ore prima dell'inizio, niente. Senza
    //  `fissatoIl` vale `createdAt` (il lead non è fissato prima di esistere);
    //  senza nessuna data parte: finestra e conferma la proteggono già.
    const fissata = Date.parse(String(d.fissatoIl ?? "")) || Date.parse(String(d.createdAt ?? ""));
    if (Number.isFinite(fissata) && inizio.getTime() - fissata < FISSATA_ALMENO_ORE_PRIMA * ORA_MS)
      continue;
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
      ora: hm,
      tel9: ultimeNoveCifre(numero),
      consulente: consulente.data?.nome,
      bersaglioMin,
      parte,
    });
  }

  candidati.sort(
    (a, b) => a.inizio.getTime() - b.inizio.getTime() || a.scheda.id.localeCompare(b.scheda.id),
  );
  const viste = new Set<string>();
  for (const k of candidati) {
    const quale = `${k.tel9}|${k.inizio.toISOString()}`;
    if (viste.has(quale)) continue;
    viste.add(quale);
    const metti = (d: Esito) => uscita.push({ inizio: k.inizio.getTime(), id: k.scheda.id, d });
    const chiave = `d|${k.tel9}|${domani}T${k.ora}`;
    if (chiaveGiaPresa(invii, chiave)) continue;
    const campi = campiMeetDomani(k.scheda.data, k.consulente);
    if (campi.tipo === "salta") {
      metti({ tipo: "salta", scheda: k.scheda, motivo: campi.motivo });
      continue;
    }

    const { parte, bersaglioMin } = k;
    const chiusura = (istanteDiRoma(oggi, oraDi(CHIUSURA_RICONTATTI_MIN)) as Date).getTime();
    const fine = Math.min(parte + FINESTRA_MEET_DOMANI_MIN * MIN_MS, chiusura);
    if (ora < parte) {
      metti({
        tipo: "aspetta",
        scheda: k.scheda,
        motivo: `promemoria 24 ore prima: parte alle ${oraDi(bersaglioMin)}`,
      });
    } else if (ora >= fine) {
      //  Scaduto: per un'ora il ritardo si vede, poi tace.
      if (ora < fine + MEMORIA_SALTI_MIN * MIN_MS)
        metti({ tipo: "salta", scheda: k.scheda, motivo: "saltato: giro in ritardo" });
    } else if (contaOggi(invii, oggi, TIPI_NEI_TETTI) >= tetti.totale) {
      metti({ tipo: "salta", scheda: k.scheda, motivo: "tetto di messaggi di oggi raggiunto" });
    } else if (inPausa(invii, k.tel9, adesso)) {
      metti({ tipo: "aspetta", scheda: k.scheda, motivo: FRASE_PAUSA });
    } else {
      metti({
        tipo: "invia",
        scheda: k.scheda,
        chiave,
        extra: { quale: "meet_domani", inizioMeet: k.inizio },
      });
    }
  }

  return uscita.sort((a, b) => a.inizio - b.inizio || a.id.localeCompare(b.id)).map((x) => x.d);
}
