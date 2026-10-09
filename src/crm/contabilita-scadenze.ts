/** ── IL CALENDARIO FISCALE ─────────────────────────────────────────────────
 *
 *  Richiesta del committente, e la parte che ha chiesto di curare di più:
 *  sapere quanto manca alla scadenza PRIMA che sia passata. Una liquidazione
 *  IVA dimenticata non dà nessun segnale il giorno dopo: dà una sanzione
 *  qualche mese dopo, quando rimediare costa.
 *
 *  ── ⚠️ IL CONTO ALLA ROVESCIA SEGUE UNA SCADENZA SOLA ─────────────────────
 *  Il badge del menu mostra i giorni che mancano alla prossima LIQUIDAZIONE
 *  IVA, non alla prossima scadenza qualunque. La differenza è tutta:
 *  l'invio allo SDI delle fatture estere cade il 15 di OGNI mese, quindi un
 *  badge «prossima scadenza» sarebbe acceso undici mesi su dodici con un
 *  numero sempre sotto trenta — cioè un numero che non dice più niente e che
 *  si smette di guardare dopo una settimana. La liquidazione è invece la
 *  scadenza che chiude un periodo, quella per cui i conti vanno FATTI prima, ed
 *  è quella per cui novanta giorni di preavviso hanno un senso: sono i tre mesi
 *  del trimestre.
 *  Tutte le altre stanno nell'elenco della pagina, dove si leggono quando si
 *  guarda la contabilità, che è il momento in cui servono.
 *
 *  ── ⚠️ NON SOSTITUISCE IL COMMERCIALISTA ──────────────────────────────────
 *  Le date qui dentro sono quelle ordinarie di una S.r.l.s. con esercizio
 *  solare. Le proroghe dell'ultimo minuto — e ce n'è quasi ogni anno — questo
 *  programma non le conosce: la scadenza vera resta quella che dice chi tiene
 *  i libri. Serve a non arrivarci impreparati, non a decidere quando pagare.
 *  ───────────────────────────────────────────────────────────────────────── */

export type TipoScadenza =
  | "iva"
  | "lipe"
  | "estero"
  | "intrastat"
  | "imposte"
  | "acconto"
  | "dichiarazione";

export interface Scadenza {
  id: string;
  /** Il giorno in cui si paga o si trasmette davvero: già spostato al primo
   *  giorno lavorativo, quando quello di legge cade di sabato o di festa. */
  giorno: string;
  /** Quello scritto nella norma. Diverso dal precedente solo quando è slittato,
   *  e allora si dice: una data cambiata in silenzio sembra un errore. */
  giornoLegale: string;
  tipo: TipoScadenza;
  titolo: string;
  /** ── ⚠️ COSA C'È DA FARE, DETTO A CHI DI FISCO NON SA NIENTE ──────────
   *  Richiesta del committente, ed è quello che rende un calendario fiscale
   *  utile invece che minaccioso. Una riga, parole normali, nessuna sigla che
   *  non sia già stata spiegata. «Liquidazione periodica IVA» non dice niente
   *  a chi deve capire se stasera deve preoccuparsi; «paghi l'IVA incassata
   *  dai clienti meno quella pagata ai fornitori» sì. */
  cosa: string;
  /** La sfumatura che serve solo quando la scadenza è vicina: gli interessi,
   *  il rinvio possibile, cosa si perde a non farlo. Sta a parte perché in un
   *  elenco di otto scadenze è rumore, e sulla prima è la cosa che serve. */
  dettaglio: string;
  /** A che periodo si riferisce: «1° trimestre 2026», «agosto 2026». */
  periodo: string;
}

/** Come si liquida l'IVA. Il trimestrale è un'OPZIONE che si esercita in
 *  dichiarazione e vale sotto i 500.000 € di volume d'affari per chi presta
 *  servizi (800.000 € per le altre attività): sopra, è mensile per forza. */
export type RegimeLiquidazione = "trimestrale" | "mensile";

const due = (n: number) => String(n).padStart(2, "0");
const iso = (a: number, m: number, g: number) => `${a}-${due(m)}-${due(g)}`;

/** Pasqua, per Pasquetta — che è festa e sposta i versamenti.
 *  L'algoritmo è quello di Meeus/Jones/Butcher per il calendario gregoriano:
 *  si copia, non si inventa. */
function pasqua(anno: number): { m: number; g: number } {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const numeratore = h + l - 7 * m + 114;
  return { m: Math.floor(numeratore / 31), g: (numeratore % 31) + 1 };
}

/** Le feste civili che spostano una scadenza. ⚠️ Il santo patrono NO: è festa
 *  locale e non sposta i termini tributari, che sono nazionali. */
function feste(anno: number): Set<string> {
  const p = pasqua(anno);
  //  Il lunedì dell'Angelo: il giorno dopo Pasqua, con il mese che può girare.
  const dopoPasqua = new Date(Date.UTC(anno, p.m - 1, p.g + 1));
  return new Set([
    iso(anno, 1, 1),
    iso(anno, 1, 6),
    `${anno}-${due(dopoPasqua.getUTCMonth() + 1)}-${due(dopoPasqua.getUTCDate())}`,
    iso(anno, 4, 25),
    iso(anno, 5, 1),
    iso(anno, 6, 2),
    iso(anno, 8, 15),
    iso(anno, 11, 1),
    iso(anno, 12, 8),
    iso(anno, 12, 25),
    iso(anno, 12, 26),
  ]);
}

/** ── ⚠️ SABATO E FESTA SPOSTANO IN AVANTI ─────────────────────────────────
 *  art. 7 c. 1 lett. h) DL 70/2011: i versamenti che cadono di sabato o in un
 *  giorno festivo si fanno il primo giorno lavorativo successivo. Sembra un
 *  dettaglio e non lo è: il 16 novembre cade di domenica abbastanza spesso, e
 *  un programma che dicesse «scaduta ieri» mentre c'è ancora tempo fino a
 *  lunedì farebbe correre per niente — o peggio, farebbe smettere di credergli. */
export function primoGiornoUtile(giorno: string): string {
  const festivi = feste(Number(giorno.slice(0, 4)));
  const d = new Date(`${giorno}T00:00:00Z`);
  for (let i = 0; i < 10; i++) {
    const s = d.toISOString().slice(0, 10);
    const settimana = d.getUTCDay();
    if (settimana !== 0 && settimana !== 6 && !festivi.has(s)) return s;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return giorno;
}

const TRIMESTRI = ["1° trimestre", "2° trimestre", "3° trimestre", "4° trimestre"];
const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function fai(
  id: string,
  giornoLegale: string,
  tipo: TipoScadenza,
  titolo: string,
  cosa: string,
  periodo: string,
  dettaglio = "",
): Scadenza {
  return {
    id,
    giorno: primoGiornoUtile(giornoLegale),
    giornoLegale,
    tipo,
    titolo,
    cosa,
    dettaglio,
    periodo,
  };
}

/** Detta una volta sola: la frase dell'IVA è la stessa per il mensile e per il
 *  trimestrale, e scriverla due volte vuol dire che un giorno saranno diverse. */
const COSA_IVA =
  "Versi allo Stato l'IVA che hai incassato dai clienti, meno quella che hai pagato ai fornitori. Si paga con l'F24.";

/** ── LE SCADENZE DI UN ANNO ────────────────────────────────────────────────
 *  ⚠️ Le liquidazioni del quarto trimestre e la comunicazione di febbraio
 *   appartengono all'anno DOPO: chi guarda il 2026 a dicembre deve vedere il
 *   16 marzo 2027, altrimenti l'ultima scadenza dell'anno sparisce proprio
 *   quando è la più vicina. Per questo si generano su richiesta anche quelle
 *   dell'anno precedente, e `prossimeScadenze` guarda tre anni. */
export function scadenzeDellAnno(anno: number, regime: RegimeLiquidazione): Scadenza[] {
  const s: Scadenza[] = [];

  if (regime === "trimestrale") {
    //  ⚠️ I PRIMI TRE TRIMESTRI PAGANO L'1% DI INTERESSI, il quarto no perché
    //   si versa insieme al saldo annuale. È la contropartita dell'opzione, e
    //   chi la sceglie deve saperlo — quindi sta scritto nella riga.
    const q: [number, number, string][] = [
      [5, 16, "0"],
      [8, 20, "1"],
      [11, 16, "2"],
    ];
    q.forEach(([m, g, t]) => {
      const i = Number(t);
      s.push(
        fai(
          `iva-${anno}-t${i + 1}`,
          iso(anno, m, g),
          "iva",
          `IVA ${TRIMESTRI[i].toLowerCase()}`,
          COSA_IVA,
          `${TRIMESTRI[i]} ${anno}`,
          "Prima devi aver registrato tutte le fatture del trimestre, le tue e quelle dei fornitori: quelle che mancano sono soldi che paghi in più. Chi liquida ogni tre mesi paga anche l'1% di interessi.",
        ),
      );
    });
    s.push(
      fai(
        `iva-${anno}-t4`,
        iso(anno + 1, 3, 16),
        "iva",
        "IVA quarto trimestre",
        COSA_IVA,
        `4° trimestre ${anno}`,
        "Su questa non si paga l'1% di interessi, perché si versa insieme al conguaglio di tutto l'anno.",
      ),
    );
  } else {
    for (let m = 1; m <= 12; m++) {
      const dopo = m === 12 ? { a: anno + 1, m: 1 } : { a: anno, m: m + 1 };
      s.push(
        fai(
          `iva-${anno}-m${m}`,
          iso(dopo.a, dopo.m, 16),
          "iva",
          `IVA di ${MESI[m - 1]}`,
          COSA_IVA,
          `${MESI[m - 1]} ${anno}`,
          "Prima devi aver registrato tutte le fatture del mese, le tue e quelle dei fornitori: quelle che mancano sono soldi che paghi in più.",
        ),
      );
    }
  }

  //  ── LIPE: la comunicazione delle liquidazioni. Si manda anche a zero. ──
  const lipe: [number, number, number, string][] = [
    [anno, 5, 31, `1° trimestre ${anno}`],
    [anno, 9, 30, `2° trimestre ${anno}`],
    [anno, 11, 30, `3° trimestre ${anno}`],
    [anno + 1, 2, 28, `4° trimestre ${anno}`],
  ];
  lipe.forEach(([a, m, g, periodo], i) => {
    s.push(
      fai(
        `lipe-${anno}-${i + 1}`,
        iso(a, m, g),
        "lipe",
        `Comunicazione IVA · ${periodo}`,
        "Mandi allo Stato un modulo che dice quanta IVA hai calcolato. Non si paga niente: è solo una comunicazione, e la fa il commercialista.",
        periodo,
        "Va mandata anche quando non devi versare niente: la multa è per non averla mandata, non per non aver pagato.",
      ),
    );
  });

  //  ── LE FATTURE ESTERE ALLO SDI: il 15 di ogni mese, per il mese prima ──
  for (let m = 1; m <= 12; m++) {
    const dopo = m === 12 ? { a: anno + 1, m: 1 } : { a: anno, m: m + 1 };
    s.push(
      fai(
        `estero-${anno}-${m}`,
        iso(dopo.a, dopo.m, 15),
        "estero",
        `Fatture estere di ${MESI[m - 1]}`,
        "Le fatture che ti sono arrivate dall'estero vanno rimandate allo Stato, con l'IVA italiana scritta sopra da te. Una per una.",
        `${MESI[m - 1]} ${anno}`,
        "È quella che si dimentica più spesso, perché la fattura l'hai già pagata e sembra finita lì. Chi non la manda prende una multa per ogni documento, anche avendo pagato tutto il dovuto.",
      ),
    );
  }

  //  ── LE IMPOSTE SUL REDDITO, per un esercizio che chiude il 31 dicembre ──
  s.push(
    fai(
      `saldo-${anno}`,
      iso(anno, 6, 30),
      "imposte",
      `Tasse ${anno - 1} e primo anticipo ${anno}`,
      "Paghi le tasse sull'utile dell'anno scorso, più il primo anticipo su quelle di quest'anno.",
      `esercizio ${anno - 1}`,
      "Si può rateizzare in più mesi, oppure spostare al 30 luglio pagando lo 0,40% in più. È la scadenza più pesante dell'anno: conviene sapere prima quanto sarà.",
    ),
  );
  s.push(
    fai(
      `acconto2-${anno}`,
      iso(anno, 11, 30),
      "acconto",
      `Secondo anticipo tasse ${anno}`,
      "Paghi la seconda rata dell'anticipo sulle tasse di quest'anno.",
      `esercizio ${anno}`,
      "L'anticipo si calcola su quanto hai pagato l'anno scorso. Se quest'anno stai guadagnando meno, si può ridurre — ma se si sbaglia in basso ci sono sanzioni: lo decide il commercialista.",
    ),
  );
  s.push(
    fai(
      `redditi-${anno}`,
      iso(anno, 10, 31),
      "dichiarazione",
      `Dichiarazione dei redditi ${anno - 1}`,
      "Il commercialista manda la dichiarazione della società. Tu devi avergli già dato tutti i documenti dell'anno.",
      `esercizio ${anno - 1}`,
      "Se glieli porti a ottobre, li guarda a ottobre: quello che manca si scopre lì, quando non c'è più tempo per farselo mandare. Il pacchetto di questa pagina serve a non arrivarci così.",
    ),
  );
  s.push(
    fai(
      `ivannuale-${anno}`,
      iso(anno, 4, 30),
      "dichiarazione",
      `Dichiarazione IVA ${anno - 1}`,
      "Il commercialista manda il riepilogo dell'IVA di tutto l'anno scorso.",
      `esercizio ${anno - 1}`,
      "È anche l'ULTIMO giorno per detrarre l'IVA delle fatture dell'anno scorso: una fattura registrata dopo è imposta persa, e non si recupera più. Ed è il giorno in cui si sceglie se liquidare l'IVA ogni mese o ogni tre.",
    ),
  );
  //  ── IL BILANCIO ────────────────────────────────────────────────────────
  s.push(
    fai(
      `bilancio-${anno}`,
      iso(anno, 4, 29),
      "dichiarazione",
      `Bilancio ${anno - 1}`,
      "I soci si riuniscono e approvano il bilancio dell'anno scorso; poi si deposita in Camera di Commercio.",
      `esercizio ${anno - 1}`,
      "Entro 120 giorni dalla chiusura dell'anno, e il deposito entro 30 giorni dall'approvazione. Serve un verbale, anche con un socio solo.",
    ),
  );

  return s.sort((a, b) => a.giorno.localeCompare(b.giorno));
}

/** Quanti giorni mancano, contati sui giorni di calendario e non sulle ore:
 *  «mancano 2 giorni» non deve diventare 1 perché è passata l'ora di pranzo. */
export function giorniA(giorno: string, oggi: string): number {
  const a = Date.UTC(
    Number(oggi.slice(0, 4)),
    Number(oggi.slice(5, 7)) - 1,
    Number(oggi.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(giorno.slice(0, 4)),
    Number(giorno.slice(5, 7)) - 1,
    Number(giorno.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}

/** Le prossime, da oggi in avanti. Guarda tre anni perché le scadenze di
 *  dicembre appartengono già a quello dopo. */
export function prossimeScadenze(
  oggi: string,
  regime: RegimeLiquidazione,
  quante = 8,
  /** Le scadenze gia' segnate come fatte: restano nell'elenco della pagina —
   *  sapere che una cosa e' stata fatta e' un'informazione — ma chi decide se
   *  insistere (il badge, la striscia) le salta. Vedi `crm/contabilita-chiusure`. */
  chiuse?: Record<string, string>,
): (Scadenza & { mancano: number })[] {
  const anno = Number(oggi.slice(0, 4));
  return [
    ...scadenzeDellAnno(anno - 1, regime),
    ...scadenzeDellAnno(anno, regime),
    ...scadenzeDellAnno(anno + 1, regime),
  ]
    .filter((s) => s.giorno >= oggi && !(chiuse && chiuse[s.id]))
    .sort((a, b) => a.giorno.localeCompare(b.giorno))
    .slice(0, quante)
    .map((s) => ({ ...s, mancano: giorniA(s.giorno, oggi) }));
}

/** La liquidazione IVA che viene: è quella che comanda il conto alla rovescia. */
export function prossimaLiquidazione(
  oggi: string,
  regime: RegimeLiquidazione,
  chiuse?: Record<string, string>,
): (Scadenza & { mancano: number }) | null {
  return prossimeScadenze(oggi, regime, 60, chiuse).find((s) => s.tipo === "iva") ?? null;
}

/** Da quanti giorni prima il menu comincia a contare. Novanta: sono i tre mesi
 *  del trimestre, cioè da quando il periodo che si sta chiudendo è cominciato. */
export const PREAVVISO_BADGE = 90;
/** Da quanti giorni prima si comincia a insistere. Venticinque: richiesta del
 *  committente, ed è un buon numero — le fatture del periodo a quel punto ci
 *  sono quasi tutte, e c'è ancora tempo per farsi mandare quelle che mancano. */
export const PREAVVISO_AVVISO = 25;

/** ── ⚠️ OGNI QUANTO SI RICORDA ────────────────────────────────────────────
 *  Non tutti i giorni: un avviso che compare ogni giorno per venticinque
 *  giorni diventa un pezzo dell'arredamento entro il terzo. Rado all'inizio,
 *  fitto alla fine — che è il modo in cui ci si ricorda le cose davvero.
 *  L'ultima settimana è tutti i giorni, e il giorno stesso è ovvio. */
export function toccaAvvisare(mancano: number): boolean {
  if (mancano < 0) return true;
  if (mancano <= 7) return true;
  if (mancano <= PREAVVISO_AVVISO) return mancano % 5 === 0;
  return false;
}

/** Il conto alla rovescia del menu: numero, colore e frase. `null` = spento. */
export function badgeScadenza(
  oggi: string,
  regime: RegimeLiquidazione,
  chiuse?: Record<string, string>,
): { giorni: number; urgenza: "ritardo" | "oggi" | "info"; frase: string } | null {
  //  ⚠️ Una scadenza gia' fatta non conta piu' alla rovescia: si passa a
  //   quella dopo, che quasi sempre e' oltre i novanta giorni e quindi spegne
  //   il badge. Un promemoria che insiste dopo che la cosa e' stata fatta
  //   smette di essere un promemoria.
  const p = prossimaLiquidazione(oggi, regime, chiuse);
  if (!p || p.mancano > PREAVVISO_BADGE) return null;
  const urgenza = p.mancano <= 7 ? "ritardo" : p.mancano <= PREAVVISO_AVVISO ? "oggi" : "info";
  const quando =
    p.mancano === 0 ? "è oggi" : p.mancano === 1 ? "è domani" : `mancano ${p.mancano} giorni`;
  const slittata =
    p.giorno !== p.giornoLegale
      ? ` (il ${p.giornoLegale.slice(8)} cade di sabato o di festa, quindi slitta)`
      : "";
  return {
    giorni: p.mancano,
    urgenza,
    frase: `${p.titolo}: ${quando}, si versa il ${p.giorno.slice(8)}/${p.giorno.slice(5, 7)}${slittata}. Chiudi la contabilità del periodo prima di allora.`,
  };
}
